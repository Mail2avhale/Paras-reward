"""
Community Reward Caps — Monthly FIFO Reward-Ceiling Enforcement (Feb 20, 2026)
==============================================================================
Prevents unlimited commission/reward earning per user per calendar month.

Cap table (INR/month → 10x PRC using fixed 10 PRC = ₹1 rate)
-------------------------------------------------------------
    Community Member (user)      →   ₹1,00,000   → 10,00,000 PRC
    District Community Leader    →   ₹3,00,000   → 30,00,000 PRC
    Regional Community Leader    →   ₹4,00,000   → 40,00,000 PRC
    State Community Leader       →   ₹5,00,000   → 50,00,000 PRC
    National Community Leader    →  ₹10,00,000   → 1,00,00,000 PRC

Behaviour (per user's Feb 2026 decision — Q2=a "silent skip")
-------------------------------------------------------------
    • Cap tracks ALL earning-type credits from prc_ledger for the current
      UTC calendar month (entry_type=="credit").
    • When the recipient's cumulative monthly earnings would EXCEED their
      role cap, the incoming credit is SILENTLY SKIPPED — no ledger row,
      no balance change, no roll-up to next upline.
    • Skipped commissions remain in the system's PRC treasury (revenue
      leak stopped).
    • Cap resets on the 1st day of every UTC calendar month at 00:00.

Config is admin-editable via /api/admin/community-caps/config so ops can
tune the ₹ amounts without a code redeploy.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/community", tags=["Community Reward Caps"])
admin_router = APIRouter(prefix="/admin/community-caps", tags=["Admin — Community Caps"])

# ─── module state ────────────────────────────────────────────────────────
db = None
cache = None


def set_db(database) -> None:
    global db
    db = database


def set_cache(cache_manager) -> None:
    global cache
    cache = cache_manager


# ─── constants ───────────────────────────────────────────────────────────
# Fixed 10 PRC = ₹1 conversion. Source: /app/backend/utils/helpers.py PRC_INR_RATE.
PRC_PER_INR = 10

# Default monthly cap table (INR per user per calendar month).
DEFAULT_CAPS_INR = {
    "user":                     100_000,
    "district_partner":         300_000,
    "regional_state_partner":   400_000,
    "state_partner":            500_000,
    "national_partner":       1_000_000,
}

# Human-readable labels — kept in sync with routes/partner_positions.POSITION_CONFIG
ROLE_LABELS = {
    "user":                    "Community Member",
    "district_partner":        "District Community Leader",
    "regional_state_partner":  "Regional Community Leader",
    "state_partner":           "State Community Leader",
    "national_partner":        "National Community Leader",
}

# Earning-type ledger entries counted against the cap.
# Anything that credits the user's balance from PARTNER/DOWNLINE activity
# or ecosystem rewards. Own-mining (mining_collect) is INCLUDED per user's
# Q1=b "all earning types" decision.
EARNING_LEDGER_TYPES = [
    "mining_referral_reward",   # community bonus from downlines
    "mining_collect",           # own daily mining
    "ad_reward",                # ads watched
    "referral",                 # legacy subscription referral commission
    "referral_joined",          # signup bonus
    "subscription_referral_reward",  # forward-looking
    "quantum_voucher_bonus",    # forward-looking
    "community_bonus",          # forward-looking
    "leadership_reward",        # forward-looking
]


# ─── config cache (5-min TTL) ────────────────────────────────────────────
import time as _time
_CFG_CACHE = {"value": None, "expiry": 0}
_CFG_TTL = 300  # 5 min


async def _load_caps_inr(force_refresh: bool = False) -> dict:
    """Load admin-configured monthly caps (INR) from app_settings. Falls
    back to DEFAULT_CAPS_INR when the doc is missing / malformed.
    """
    if not force_refresh and _CFG_CACHE["value"] is not None and _CFG_CACHE["expiry"] > _time.time():
        return _CFG_CACHE["value"]

    result = dict(DEFAULT_CAPS_INR)
    if db is not None:
        try:
            doc = await db.app_settings.find_one(
                {"key": "community_reward_caps_inr"},
                {"_id": 0, "value": 1},
            )
            if doc and isinstance(doc.get("value"), dict):
                for role, default_inr in DEFAULT_CAPS_INR.items():
                    raw = doc["value"].get(role)
                    try:
                        v = int(raw) if raw is not None else default_inr
                        if v < 0:
                            v = default_inr
                        result[role] = v
                    except Exception:
                        result[role] = default_inr
        except Exception as e:
            logger.warning(f"[CAPS] load failed, using defaults: {e}")

    _CFG_CACHE["value"] = result
    _CFG_CACHE["expiry"] = _time.time() + _CFG_TTL
    return result


def _invalidate_cache() -> None:
    _CFG_CACHE["value"] = None
    _CFG_CACHE["expiry"] = 0


def _current_month_iso_bounds() -> tuple[str, str]:
    """Return (start_iso, end_iso) — inclusive start, exclusive end — for
    the current UTC calendar month. Uses ISO-formatted strings because
    prc_ledger stores `timestamp`/`created_at` as ISO strings.
    """
    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    if now.month == 12:
        end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return start.isoformat(), end.isoformat()


# ─── PUBLIC HELPERS ──────────────────────────────────────────────────────
async def get_role_monthly_cap_prc(position: Optional[str]) -> float:
    """Return the monthly cap in PRC for a given partner_position."""
    pos = (position or "user").lower().strip()
    caps_inr = await _load_caps_inr()
    inr = int(caps_inr.get(pos, caps_inr.get("user", 0)))
    return float(inr * PRC_PER_INR)


async def get_month_earned_prc(uid: str) -> float:
    """Sum all EARNING-type credits for `uid` in the current UTC calendar
    month. Reads from prc_ledger.

    Returns 0.0 on any error — cap enforcement must never *harden* a
    failure (a bad read should not accidentally credit past the cap; but
    it also must not skip a legitimate credit). We choose lenient (0.0)
    so a transient Mongo issue doesn't block legitimate commission — the
    cap will re-tighten on the next credit event when Mongo recovers.
    """
    if db is None or not uid:
        return 0.0
    start_iso, end_iso = _current_month_iso_bounds()
    try:
        pipeline = [
            {
                "$match": {
                    "user_id": uid,
                    "entry_type": "credit",
                    "type": {"$in": EARNING_LEDGER_TYPES},
                    # Match either `timestamp` OR `created_at` — both are
                    # written as ISO strings by our various writers.
                    "$or": [
                        {"timestamp": {"$gte": start_iso, "$lt": end_iso}},
                        {"created_at": {"$gte": start_iso, "$lt": end_iso}},
                    ],
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        cursor = db.prc_ledger.aggregate(pipeline)
        docs = await cursor.to_list(length=1)
        if docs:
            return round(float(docs[0].get("total", 0) or 0), 6)
    except Exception as e:
        logger.warning(f"[CAPS] month earned lookup failed for {uid}: {e}")
    return 0.0


async def get_remaining_cap_prc(uid: str, position: Optional[str]) -> float:
    """Return remaining monthly cap headroom in PRC (never negative)."""
    cap = await get_role_monthly_cap_prc(position)
    used = await get_month_earned_prc(uid)
    return round(max(0.0, cap - used), 6)


async def can_credit(uid: str, position: Optional[str], amount: float) -> tuple[bool, float, float]:
    """Fast cap check used inline by mining_commission.

    Returns (allowed, cap_prc, used_prc). `allowed` is True iff the full
    `amount` fits under the recipient's monthly cap. Partial credits are
    NOT granted (Q2=a "silent skip" — either full credit or no credit).
    """
    if amount <= 0:
        return True, 0.0, 0.0
    cap = await get_role_monthly_cap_prc(position)
    used = await get_month_earned_prc(uid)
    allowed = (used + amount) <= cap
    return allowed, cap, used


# ─── USER ENDPOINT ───────────────────────────────────────────────────────
@router.get("/monthly-cap-status/{uid}")
async def get_monthly_cap_status(uid: str):
    """Return the recipient's current monthly cap usage — used by the
    Community Dashboard "Reward Ceiling" widget so users can see how
    much headroom is left before their monthly cap resets on the 1st.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "uid": 1, "name": 1, "partner_position": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = (user.get("partner_position") or "user").lower().strip()
    cap_prc = await get_role_monthly_cap_prc(role)
    used_prc = await get_month_earned_prc(uid)
    remaining_prc = round(max(0.0, cap_prc - used_prc), 6)
    used_pct = round((used_prc / cap_prc) * 100.0, 2) if cap_prc > 0 else 0.0

    # Month bounds for UI countdown
    now = datetime.now(timezone.utc)
    if now.month == 12:
        next_reset = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        next_reset = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    seconds_to_reset = int((next_reset - now).total_seconds())

    return {
        "success": True,
        "uid": uid,
        "role": role,
        "role_label": ROLE_LABELS.get(role, role),
        "cap_prc": round(cap_prc, 2),
        "cap_inr": round(cap_prc / PRC_PER_INR, 2),
        "used_prc": round(used_prc, 2),
        "used_inr": round(used_prc / PRC_PER_INR, 2),
        "remaining_prc": remaining_prc,
        "remaining_inr": round(remaining_prc / PRC_PER_INR, 2),
        "used_pct": used_pct,
        "capped": used_prc >= cap_prc,
        "reset_at_utc": next_reset.isoformat(),
        "seconds_to_reset": seconds_to_reset,
    }


@router.get("/monthly-cap-config")
async def public_cap_config():
    """Read-only copy of the current cap table — used by the ladder widget
    so users can see the ceiling for each role above them.
    """
    caps_inr = await _load_caps_inr()
    return {
        "success": True,
        "prc_per_inr": PRC_PER_INR,
        "caps": [
            {
                "role": r,
                "label": ROLE_LABELS.get(r, r),
                "cap_inr": caps_inr.get(r, 0),
                "cap_prc": caps_inr.get(r, 0) * PRC_PER_INR,
            }
            for r in ("user", "district_partner", "regional_state_partner", "state_partner", "national_partner")
        ],
        "notes": [
            "Cap resets on the 1st of every UTC calendar month.",
            "When your monthly earnings reach the cap, further commission credits are silently skipped for the rest of the month.",
            "The cap tracks ALL earning-type PRC credits combined (mining, ad rewards, referral rewards).",
        ],
    }


# ─── ADMIN CONFIG ENDPOINTS ──────────────────────────────────────────────
class CapUpdate(BaseModel):
    admin_id: str
    caps_inr: dict = Field(..., description="{role: inr_amount}")


@admin_router.get("/config")
async def admin_get_caps(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    effective = await _load_caps_inr(force_refresh=True)
    stored = await db.app_settings.find_one(
        {"key": "community_reward_caps_inr"},
        {"_id": 0, "value": 1, "updated_at": 1, "updated_by": 1},
    )
    return {
        "success": True,
        "prc_per_inr": PRC_PER_INR,
        "defaults_inr": DEFAULT_CAPS_INR,
        "effective_inr": effective,
        "labels": ROLE_LABELS,
        "stored_doc": stored,
    }


@admin_router.post("/config")
async def admin_update_caps(
    body: CapUpdate,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    # Start from defaults, overlay stored, overlay incoming.
    current = dict(DEFAULT_CAPS_INR)
    try:
        stored = await db.app_settings.find_one(
            {"key": "community_reward_caps_inr"}, {"_id": 0, "value": 1}
        )
        if stored and isinstance(stored.get("value"), dict):
            for k, v in stored["value"].items():
                if k in DEFAULT_CAPS_INR:
                    try:
                        current[k] = int(v)
                    except Exception:
                        pass
    except Exception:
        pass

    for role, raw in (body.caps_inr or {}).items():
        if role not in DEFAULT_CAPS_INR:
            continue
        try:
            v = int(raw)
            if v >= 0:
                current[role] = v
        except Exception:
            continue

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one(
        {"key": "community_reward_caps_inr"},
        {"$set": {
            "key": "community_reward_caps_inr",
            "value": current,
            "updated_at": now_iso,
            "updated_by": body.admin_id,
        }},
        upsert=True,
    )
    _invalidate_cache()
    logger.info(f"[CAPS] Updated by {body.admin_id}: {current}")
    return {
        "success": True,
        "caps_inr": current,
        "message": "Community reward caps updated. Change is live.",
    }


@admin_router.post("/config/reset")
async def admin_reset_caps(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    await db.app_settings.delete_one({"key": "community_reward_caps_inr"})
    _invalidate_cache()
    return {
        "success": True,
        "message": "Reverted to hard-coded defaults.",
        "defaults_inr": DEFAULT_CAPS_INR,
    }


@admin_router.get("/audit")
async def admin_audit_caps(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
    limit: int = 50,
):
    """List users approaching or over their monthly cap. Used by the
    admin monitoring dashboard to spot users whose commissions are
    being silently skipped.
    """
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    start_iso, end_iso = _current_month_iso_bounds()
    pipeline = [
        {
            "$match": {
                "entry_type": "credit",
                "type": {"$in": EARNING_LEDGER_TYPES},
                "$or": [
                    {"timestamp": {"$gte": start_iso, "$lt": end_iso}},
                    {"created_at": {"$gte": start_iso, "$lt": end_iso}},
                ],
            }
        },
        {"$group": {"_id": "$user_id", "earned_prc": {"$sum": "$amount"}}},
        {"$sort": {"earned_prc": -1}},
        {"$limit": max(1, min(limit, 500))},
    ]
    rows = await db.prc_ledger.aggregate(pipeline).to_list(length=limit)
    caps_inr = await _load_caps_inr()
    out = []
    for row in rows:
        uid = row["_id"]
        if not uid:
            continue
        user = await db.users.find_one(
            {"uid": uid},
            {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "partner_position": 1},
        )
        role = ((user or {}).get("partner_position") or "user").lower().strip()
        cap_prc = int(caps_inr.get(role, caps_inr.get("user", 0))) * PRC_PER_INR
        earned_prc = round(float(row.get("earned_prc", 0) or 0), 2)
        used_pct = round((earned_prc / cap_prc) * 100.0, 2) if cap_prc > 0 else 0.0
        out.append({
            "uid": uid,
            "name": (user or {}).get("name"),
            "mobile": (user or {}).get("mobile"),
            "role": role,
            "role_label": ROLE_LABELS.get(role, role),
            "earned_prc": earned_prc,
            "earned_inr": round(earned_prc / PRC_PER_INR, 2),
            "cap_prc": cap_prc,
            "cap_inr": cap_prc // PRC_PER_INR if PRC_PER_INR else 0,
            "used_pct": used_pct,
            "capped": earned_prc >= cap_prc,
        })
    return {
        "success": True,
        "month_start_utc": start_iso,
        "month_end_utc": end_iso,
        "users": out,
    }
