"""
Community Leader Bonus Multiplier & Status (Feb 16, 2026)
=========================================================
Layered on top of the existing Partner Position system (District / Regional
/ State / National Coordinator). Adds a bonus MULTIPLIER on each approved
Community Leader's earning so their share of a downline's mining collect is
higher than a plain user's 10-level Community Bonus %.

    Leader Bonus % = User's 10-level Community Bonus % × Role Multiplier

Multipliers (defaults, admin-configurable via /admin/community-leader/multipliers)
  district_partner        → 1.25
  regional_state_partner  → 1.50
  state_partner           → 1.75
  national_partner        → 2.00
  user                    → 1.00  (no multiplier)

Only APPROVED leaders receive the multiplier. Since the previous fork's
`admin_assign_position` is treated as an implicit approval action (per the
user's decision: "पूर्वीचा जो फ्लो आहे. Admin assign and approve touch राहुदे NO
touching"), any user with `partner_position != "user"` is treated as an
approved Community Leader.

Elite subscription is still required to actually receive commission — the
multiplier applies on top of an already-earned amount.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/community-leader", tags=["Community Leader"])
admin_router = APIRouter(prefix="/admin/community-leader", tags=["Admin — Community Leader"])

# --------- MODULE STATE ----------
db = None


def set_db(database) -> None:
    global db
    db = database


# --------- DEFAULT MULTIPLIER TABLE (source of truth) ----------
DEFAULT_MULTIPLIERS = {
    "user":                    1.00,
    "district_partner":        1.25,
    "regional_state_partner":  1.50,
    "state_partner":           1.75,
    "national_partner":        2.00,
}

# Human-readable labels used across UI + audit logs. Kept in sync with
# routes/partner_positions.POSITION_CONFIG.
ROLE_LABELS = {
    "user":                    "Community Member",
    "district_partner":        "District Community Leader",
    "regional_state_partner":  "Regional Community Leader",
    "state_partner":           "State Community Leader",
    "national_partner":        "National Community Leader",
}


import time as _time
_CFG_CACHE = {"value": None, "expiry": 0}
_CFG_TTL = 300  # 5 min


async def _load_multipliers(force_refresh: bool = False) -> dict:
    """Read the admin-configurable multipliers from app_settings. Falls back
    to DEFAULT_MULTIPLIERS if the doc is missing / malformed. 5-min cache.
    """
    if not force_refresh and _CFG_CACHE["value"] is not None and _CFG_CACHE["expiry"] > _time.time():
        return _CFG_CACHE["value"]

    result = dict(DEFAULT_MULTIPLIERS)
    if db is not None:
        try:
            doc = await db.app_settings.find_one(
                {"key": "community_leader_multipliers"},
                {"_id": 0, "value": 1},
            )
            if doc and isinstance(doc.get("value"), dict):
                for role, default_mul in DEFAULT_MULTIPLIERS.items():
                    raw = doc["value"].get(role)
                    try:
                        m = float(raw) if raw is not None else default_mul
                        # Sanity clamp — multiplier in [0.5, 10.0]
                        if m < 0.5 or m > 10.0:
                            m = default_mul
                        result[role] = round(m, 4)
                    except Exception:
                        result[role] = default_mul
        except Exception as e:
            logger.warning(f"[COMMUNITY-LEADER] multiplier config load failed: {e}")

    _CFG_CACHE["value"] = result
    _CFG_CACHE["expiry"] = _time.time() + _CFG_TTL
    return result


async def get_role_multiplier(position: Optional[str]) -> float:
    """Return the bonus multiplier for a given partner_position.
    Unknown / falsy → 1.0 (no multiplier).
    """
    pos = (position or "user").lower().strip()
    if pos == "user":
        return 1.0
    cfg = await _load_multipliers()
    return float(cfg.get(pos, 1.0))


def _invalidate_cache() -> None:
    _CFG_CACHE["value"] = None
    _CFG_CACHE["expiry"] = 0


# --------- USER-FACING ENDPOINTS ----------
@router.get("/status/{uid}")
async def get_leader_status(uid: str):
    """Return the user's Community Leader status:
      • role + label + multiplier
      • active flag (has partner_position != user)
      • effective bonus % based on their current 10-level Community Bonus
      • Elite Active flag (needed to actually earn)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "uid": 1, "name": 1, "partner_position": 1,
         "partner_position_assigned_at": 1, "partner_position_assigned_by": 1,
         "subscription_plan": 1, "membership_type": 1,
         "subscription_expired": 1, "referral_code": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = (user.get("partner_position") or "user").lower().strip()
    multiplier = await get_role_multiplier(role)
    is_leader = role != "user"

    # Pull the user's current 10-level community bonus (base %)
    try:
        from routes.community_levels import get_level_progression
        lvl = await get_level_progression(uid)
        base_pct = float(lvl.get("current_percent", 1.0))
        current_level = int(lvl.get("current_level", 3))
    except Exception:
        base_pct = 1.0
        current_level = 3

    effective_pct = round(base_pct * multiplier, 4)

    plan = (user.get("subscription_plan") or "").lower()
    mem = (user.get("membership_type") or "").lower()
    elite_active = (plan in ("elite", "vip", "startup", "growth", "pro")
                    or mem in ("elite", "vip", "startup", "growth", "pro")) \
                   and user.get("subscription_expired") is not True

    return {
        "success": True,
        "uid": uid,
        "name": user.get("name"),
        "role": role,
        "role_label": ROLE_LABELS.get(role, role),
        "is_leader": is_leader,
        "leader_status": "approved" if is_leader else "not_applicable",
        "bonus_multiplier": multiplier,
        "base_community_bonus_pct": base_pct,
        "effective_community_bonus_pct": effective_pct,
        "current_level": current_level,
        "elite_active": elite_active,
        "approved_at": user.get("partner_position_assigned_at"),
        "approved_by": user.get("partner_position_assigned_by"),
    }


@router.get("/dashboard/{uid}")
async def get_leader_dashboard(uid: str):
    """Full Leader Dashboard payload. Non-leaders get their eligibility
    picture (progress toward District requirement) plus the multiplier table
    so they can see the ladder ahead.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    status = await get_leader_status(uid)

    # Structure report — reuse partner_positions helper. It returns the
    # child_type + required_count + current_count + structure_met flags
    # already based on POSITION_STRUCTURE_REQUIREMENT.
    role = status["role"]
    structure_report = None
    try:
        from routes.partner_positions import get_structure_report
        # Show what's required for the NEXT tier (or current if already at top)
        _ORDER = ["user", "district_partner", "regional_state_partner",
                  "state_partner", "national_partner"]
        idx = _ORDER.index(role) if role in _ORDER else 0
        target_role = _ORDER[min(idx + 1, len(_ORDER) - 1)] if role != "national_partner" else "national_partner"
        structure_report = await get_structure_report(uid, target_role)
    except Exception as e:
        logger.debug(f"[COMMUNITY-LEADER] structure report fetch failed: {e}")

    # Direct child-leader counts (for own tier reporting when they're a leader)
    own_children = {}
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "uid": 1, "referral_code": 1})
        if user:
            tokens = [uid]
            ref = user.get("referral_code")
            if ref:
                tokens.append(ref)
            for child_role in ("district_partner", "regional_state_partner", "state_partner"):
                cnt = await db.users.count_documents({
                    "referred_by": {"$in": tokens},
                    "partner_position": child_role,
                    "subscription_expired": {"$ne": True},
                })
                own_children[child_role] = cnt
    except Exception:
        pass

    multipliers = await _load_multipliers()
    ladder = [
        {
            "role": r,
            "label": ROLE_LABELS.get(r, r),
            "multiplier": multipliers.get(r, 1.0),
            "is_current": r == role,
        }
        for r in ("user", "district_partner", "regional_state_partner", "state_partner", "national_partner")
    ]

    return {
        **status,
        "structure_toward_next": structure_report,
        "direct_leader_counts": own_children,
        "multiplier_ladder": ladder,
    }


@router.get("/multiplier-table")
async def public_multiplier_table():
    """Read-only public copy of the current multiplier table."""
    cfg = await _load_multipliers()
    return {
        "success": True,
        "multipliers": cfg,
        "labels": ROLE_LABELS,
        "formula": "Leader Bonus % = User's 10-level Community Bonus % × Role Multiplier",
    }


# --------- ADMIN ENDPOINTS (multiplier config) ----------
class MultiplierUpdate(BaseModel):
    admin_id: str
    multipliers: dict  # {role: float} — missing roles keep current value


@admin_router.get("/multipliers")
async def admin_get_multipliers(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    current = await _load_multipliers(force_refresh=True)
    raw = await db.app_settings.find_one(
        {"key": "community_leader_multipliers"},
        {"_id": 0, "value": 1, "updated_at": 1, "updated_by": 1},
    )
    return {
        "success": True,
        "effective": current,
        "defaults": DEFAULT_MULTIPLIERS,
        "labels": ROLE_LABELS,
        "stored_doc": raw,
    }


@admin_router.post("/multipliers")
async def admin_update_multipliers(
    body: MultiplierUpdate,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    current = dict(DEFAULT_MULTIPLIERS)
    # Merge stored doc first (if any) so we keep unchanged roles.
    try:
        stored = await db.app_settings.find_one(
            {"key": "community_leader_multipliers"},
            {"_id": 0, "value": 1},
        )
        if stored and isinstance(stored.get("value"), dict):
            for k, v in stored["value"].items():
                if k in DEFAULT_MULTIPLIERS:
                    try:
                        current[k] = float(v)
                    except Exception:
                        pass
    except Exception:
        pass

    # Coerce incoming updates
    for role, raw in (body.multipliers or {}).items():
        if role not in DEFAULT_MULTIPLIERS:
            continue
        try:
            m = float(raw)
            if 0.5 <= m <= 10.0:
                current[role] = round(m, 4)
        except Exception:
            continue

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one(
        {"key": "community_leader_multipliers"},
        {"$set": {
            "key": "community_leader_multipliers",
            "value": current,
            "updated_at": now_iso,
            "updated_by": body.admin_id,
        }},
        upsert=True,
    )
    _invalidate_cache()
    logger.info(f"[COMMUNITY-LEADER] Multipliers updated by {body.admin_id}: {current}")
    return {"success": True, "multipliers": current, "message": "Multipliers updated. Change is live."}


@admin_router.post("/multipliers/reset")
async def admin_reset_multipliers(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    await db.app_settings.delete_one({"key": "community_leader_multipliers"})
    _invalidate_cache()
    return {
        "success": True,
        "message": "Reverted to hard-coded defaults.",
        "defaults": DEFAULT_MULTIPLIERS,
    }
