"""
Partner Positions System (Feb 6 2026)
======================================
Multi-tier referral position system where admins assign users to ranks that
grant commission on their downline's Main Dashboard mining collects.

Positions & Rules:
   USER (default)                — L1-L3 tiers, cap 500,  1% commission
   DISTRICT_PARTNER              — L1-L4 tiers, cap 1000, 1% commission
   REGIONAL_STATE_PARTNER        — L1-L5 tiers, cap 2000, 1% commission
   STATE_PARTNER                 — L1-L6 tiers, cap 4000, 1% commission
   NATIONAL_PARTNER              — L1-L7 tiers, cap 8000, 1% commission

CAP semantics: total ACROSS all applicable levels combined (not per-level).
If active downlines exceed cap, only the earliest-position `cap`-many count.

Recipient requirement: must be on Elite plan (5b) to actually get commission.
Trigger: Main Dashboard mining collect only (not Paras Mall).

Hybrid mode: users WITHOUT partner_position assignment still get the legacy
3-tier `mining_commission_tiers` config commission. Only when a position is
assigned does the new position-based path override.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────
# POSITION CONFIGURATION
# ────────────────────────────────────────────────────────────────────────
POSITION_CONFIG = {
    "user":                    {"levels": 3, "cap": 500,  "commission_pct": 0.01, "label": "User"},
    "district_partner":        {"levels": 4, "cap": 1000, "commission_pct": 0.01, "label": "District Partner"},
    "regional_state_partner":  {"levels": 5, "cap": 2000, "commission_pct": 0.01, "label": "Regional State Partner"},
    "state_partner":           {"levels": 6, "cap": 4000, "commission_pct": 0.01, "label": "State Partner"},
    "national_partner":        {"levels": 7, "cap": 8000, "commission_pct": 0.01, "label": "National Partner"},
}
VALID_POSITIONS = tuple(POSITION_CONFIG.keys())
DEFAULT_POSITION = "user"


# ────────────────────────────────────────────────────────────────────────
# STRUCTURAL BONUS-GATE REQUIREMENT (Feb 6 2026 — user-confirmed spec)
# ────────────────────────────────────────────────────────────────────────
# To ACTIVATE commission earning, each partner must have a fully-valid
# downline structure. Validation is RECURSIVE + L1-DIRECT-ONLY:
#
#   NATIONAL  → 5 STATE (each individually valid)
#   STATE     → 3 REGIONAL_STATE (each individually valid)
#   REGIONAL  → 5 DISTRICT (each individually valid)
#   DISTRICT  → 100 active Elite users (leaf requirement)
#
# Only L1 direct downlines count (users whose `referred_by` == this user's
# uid or referral_code). Failure to meet the count OR failure of ANY
# child's structure demotes this partner to USER-tier commission for the
# collect event (per Q2=b). Elite plan gate applies on top independently.
#
# Feb 7 2026 — Config now loaded from db.app_settings (key='partner_structure_
# requirement'). Ops can tune 100/5/3/5 without a code deploy via the
# /api/admin/partners/structure-config endpoint. Falls back to the hard-
# coded defaults below if the doc is missing or malformed.
POSITION_STRUCTURE_REQUIREMENT_DEFAULT = {
    "district_partner":         {"child": "elite_user",             "min_count": 100},
    "regional_state_partner":   {"child": "district_partner",       "min_count": 5},
    "state_partner":            {"child": "regional_state_partner", "min_count": 3},
    "national_partner":         {"child": "state_partner",          "min_count": 5},
}
# Backwards-compat alias. Tests and legacy imports keep this name; the
# loader reads whichever value it holds at call time (see _load_structure_
# requirement) so monkeypatching still works in tests.
POSITION_STRUCTURE_REQUIREMENT = dict(POSITION_STRUCTURE_REQUIREMENT_DEFAULT)

# Valid child types accepted by the loader/validator.
_VALID_CHILD_TYPES = {
    "elite_user",
    "district_partner",
    "regional_state_partner",
    "state_partner",
    "national_partner",
}


# In-memory TTL cache — 5-minute expiry per user's Q4=c choice.
# Key: f"{uid}:{position}"  Value: (expiry_epoch, is_valid_bool)
import time as _time
_STRUCTURE_CACHE: dict = {}
_STRUCTURE_CACHE_TTL_SEC = 300  # 5 minutes

# Config cache — same 5-min TTL. Separate key so config edits invalidate
# independently of per-user validity results.
_CONFIG_CACHE_KEY = "__structure_config__"
_CONFIG_CACHE_TTL_SEC = 300


def _cache_get(key: str):
    ent = _STRUCTURE_CACHE.get(key)
    if not ent:
        return None
    if ent[0] < _time.time():
        _STRUCTURE_CACHE.pop(key, None)
        return None
    return ent[1]


def _cache_set(key: str, value, ttl: int = _STRUCTURE_CACHE_TTL_SEC):
    _STRUCTURE_CACHE[key] = (_time.time() + ttl, value)


def clear_structure_cache(uid: Optional[str] = None) -> int:
    """Testing / admin helper — drop cache entries. Returns count removed.
    When `uid` is None ALL entries are cleared, including the config cache.
    When `uid` is a specific string, only that user's validity entries are
    dropped (the shared config cache is preserved).
    """
    if uid is None:
        n = len(_STRUCTURE_CACHE)
        _STRUCTURE_CACHE.clear()
        return n
    removed = [k for k in list(_STRUCTURE_CACHE.keys()) if k.startswith(f"{uid}:")]
    for k in removed:
        _STRUCTURE_CACHE.pop(k, None)
    return len(removed)


def _validate_structure_config(cfg: dict) -> dict:
    """Coerce a raw config dict to the safe shape. Missing / bad rows fall
    back to the corresponding default entry. Never raises.
    """
    out = {}
    for pos in ("district_partner", "regional_state_partner", "state_partner", "national_partner"):
        row = cfg.get(pos) if isinstance(cfg, dict) else None
        default = POSITION_STRUCTURE_REQUIREMENT_DEFAULT[pos]
        if not isinstance(row, dict):
            out[pos] = dict(default)
            continue
        child = str(row.get("child", default["child"])).lower().strip()
        if child not in _VALID_CHILD_TYPES:
            child = default["child"]
        try:
            min_count = int(row.get("min_count", default["min_count"]))
        except Exception:
            min_count = default["min_count"]
        if min_count < 0:
            min_count = default["min_count"]
        out[pos] = {"child": child, "min_count": min_count}
    return out


async def _load_structure_requirement(force_refresh: bool = False) -> dict:
    """Return the effective structure-requirement config. Reads from
    db.app_settings (key='partner_structure_requirement'), coerces / falls
    back on error, and caches for 5 min. Tests can override by monkey-
    patching `POSITION_STRUCTURE_REQUIREMENT` — the loader honours the
    monkeypatched module attribute when db lookup returns None.
    """
    if not force_refresh:
        cached = _cache_get(_CONFIG_CACHE_KEY)
        if cached is not None:
            return cached

    # Prefer app_settings doc when available.
    if db is not None:
        try:
            doc = await db.app_settings.find_one(
                {"key": "partner_structure_requirement"},
                {"_id": 0, "value": 1},
            )
            if doc and isinstance(doc.get("value"), dict):
                cfg = _validate_structure_config(doc["value"])
                _cache_set(_CONFIG_CACHE_KEY, cfg, ttl=_CONFIG_CACHE_TTL_SEC)
                return cfg
        except Exception as e:
            logger.warning(f"[PARTNERS] structure config load failed, using in-memory: {e}")

    # Fallback — honour whatever POSITION_STRUCTURE_REQUIREMENT currently
    # holds (default OR test-monkeypatched value). Do NOT cache the fall-
    # back so tests toggling the attribute see updates immediately.
    #
    # Special case: if the module attr is an EMPTY dict, respect that as an
    # explicit "no requirements" signal (used by tests). Otherwise validate
    # + backfill defaults for any missing positions.
    if not POSITION_STRUCTURE_REQUIREMENT:
        return {}
    return _validate_structure_config(POSITION_STRUCTURE_REQUIREMENT)


def position_meta(position: Optional[str]) -> dict:
    """Return config for a position (or default USER)."""
    p = (position or DEFAULT_POSITION).lower().strip()
    return POSITION_CONFIG.get(p, POSITION_CONFIG[DEFAULT_POSITION])


# ────────────────────────────────────────────────────────────────────────
# STRUCTURE VALIDATION (Feb 6 2026 — parallelised Feb 7 2026)
# ────────────────────────────────────────────────────────────────────────
async def _count_l1_active_elite(uid: str, referral_code: Optional[str]) -> int:
    """Single-query Mongo count of L1 direct downlines who are active Elite.
    Avoids loading the full user documents into Python — critical for
    DISTRICT partners with up to 100 downlines.
    """
    if db is None:
        return 0
    tokens = [uid]
    if referral_code:
        tokens.append(referral_code)
    ELITE = ["elite", "vip", "startup", "growth", "pro"]
    return await db.users.count_documents({
        "referred_by": {"$in": tokens},
        "subscription_expired": {"$ne": True},
        "$or": [
            {"subscription_plan": {"$in": ELITE}},
            {"membership_type": {"$in": ELITE}},
        ],
    })


async def _fetch_l1_partner_children(uid: str, referral_code: Optional[str], child_position: str) -> list:
    """L1 direct downlines whose `partner_position` == `child_position`.
    Projection returns only what recursive validation needs.
    """
    if db is None:
        return []
    tokens = [uid]
    if referral_code:
        tokens.append(referral_code)
    return await db.users.find(
        {"referred_by": {"$in": tokens}, "partner_position": child_position},
        {"_id": 0, "uid": 1, "referral_code": 1},
    ).to_list(20000)


async def _fetch_l1_downlines(uid: str, referral_code: Optional[str]) -> list:
    """All L1 direct downlines of `uid` — anyone whose `referred_by` matches
    the user's uid OR their referral_code (system stores either).
    Kept for backwards-compat; new code prefers the targeted helpers above.
    """
    if db is None:
        return []
    tokens = [uid]
    if referral_code:
        tokens.append(referral_code)
    return await db.users.find(
        {"referred_by": {"$in": tokens}},
        {"_id": 0, "uid": 1, "referral_code": 1, "partner_position": 1,
         "subscription_plan": 1, "membership_type": 1,
         "subscription_expired": 1}
    ).to_list(20000)


def _is_active_elite(u: dict) -> bool:
    """Local shadow of mining_commission._is_elite_active — kept here to
    avoid a circular import at module-load time."""
    if not u:
        return False
    plan = (u.get("subscription_plan") or "").lower()
    mem = (u.get("membership_type") or "").lower()
    ELITE = {"elite", "vip", "startup", "growth", "pro"}
    if plan not in ELITE and mem not in ELITE:
        return False
    if u.get("subscription_expired") is True:
        return False
    return True


async def is_structure_valid(uid: str, position: str) -> bool:
    """Recursive full-chain validation. USER position → always True.
    Uses 5-minute TTL in-memory cache. Never raises; on error returns False.

    Feb 7 2026 — Parallelises sibling `is_structure_valid` calls via
    asyncio.gather so a NATIONAL_PARTNER's 5 STATE checks run concurrently
    instead of serially. Leaf DISTRICT count now uses a Mongo aggregation
    (count_documents with a match filter) instead of hydrating documents.
    """
    import asyncio as _aio

    pos = (position or "user").lower().strip()
    if pos == "user":
        return True

    cfg = await _load_structure_requirement()
    req = cfg.get(pos)
    if not req:
        return True  # unknown position → don't block

    key = f"{uid}:{pos}"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    if db is None:
        return False

    try:
        me = await db.users.find_one(
            {"uid": uid},
            {"_id": 0, "uid": 1, "referral_code": 1},
        )
        if not me:
            _cache_set(key, False)
            return False

        min_count = int(req["min_count"])
        child_type = req["child"]
        referral_code = me.get("referral_code")

        # LEAF path — DISTRICT → 100 active elite L1 downlines.
        if child_type == "elite_user":
            count = await _count_l1_active_elite(uid, referral_code)
            result = count >= min_count
            _cache_set(key, result)
            return result

        # RECURSIVE path — count L1 children with the required partner
        # position AND whose OWN structure is individually valid.
        children = await _fetch_l1_partner_children(uid, referral_code, child_type)
        if len(children) < min_count:
            # Not enough matching children even before recursing.
            _cache_set(key, False)
            return False

        # Parallel-fanout: check all children concurrently. First `min_count`
        # valid ones are all we need, but gather() runs them in parallel so
        # the total wall-time = max(child) not sum(child).
        results = await _aio.gather(
            *[is_structure_valid(c["uid"], child_type) for c in children]
        )
        valid = sum(1 for ok in results if ok)
        met = valid >= min_count
        _cache_set(key, met)
        return met
    except Exception as e:
        logger.warning(f"[PARTNERS] structure check failed for {uid}/{pos}: {e}")
        return False


async def get_structure_report(uid: str, position: str) -> dict:
    """Detailed structure breakdown for a partner — powers the Invite badge
    and the admin audit endpoint. Returns child counts (raw + valid) so the
    UI can render 'Progress 3 / 5 State Partners valid'.

    Feb 7 2026 — LEAF DISTRICT uses count_documents aggregation. Higher
    tiers parallelise child validations via asyncio.gather.
    """
    import asyncio as _aio

    pos = (position or "user").lower().strip()
    if pos == "user":
        return {"applicable": False, "position": "user"}

    cfg = await _load_structure_requirement()
    req = cfg.get(pos)
    if not req or db is None:
        return {"applicable": False, "position": pos}

    me = await db.users.find_one(
        {"uid": uid}, {"_id": 0, "uid": 1, "referral_code": 1}
    )
    if not me:
        return {"applicable": True, "position": pos, "error": "user_not_found"}

    child_type = req["child"]
    min_count = int(req["min_count"])
    referral_code = me.get("referral_code")

    if child_type == "elite_user":
        current = await _count_l1_active_elite(uid, referral_code)
        return {
            "applicable": True,
            "position": pos,
            "child_type": "elite_user",
            "child_label": "Active Elite Users",
            "required_count": min_count,
            "current_count": current,
            "structure_met": current >= min_count,
        }

    # Higher-tier: raw match count + parallel validity of each child
    matched = await _fetch_l1_partner_children(uid, referral_code, child_type)
    if matched:
        valid_flags = await _aio.gather(
            *[is_structure_valid(u["uid"], child_type) for u in matched]
        )
        current = sum(1 for v in valid_flags if v)
    else:
        current = 0

    return {
        "applicable": True,
        "position": pos,
        "child_type": child_type,
        "child_label": POSITION_CONFIG.get(child_type, {}).get("label", child_type),
        "required_count": min_count,
        "current_count": current,
        "raw_child_count": len(matched),
        "structure_met": current >= min_count,
    }




# ────────────────────────────────────────────────────────────────────────
# ROUTER
# ────────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/partners", tags=["Partner Positions"])
admin_router = APIRouter(prefix="/admin/partners", tags=["Admin — Partner Positions"])

db = None


def set_db(database) -> None:
    global db
    db = database


# ────────────────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ────────────────────────────────────────────────────────────────────────
class AssignPositionRequest(BaseModel):
    admin_id: str
    query: str = Field(..., min_length=3, description="mobile / email / uid")
    position: Literal[
        "user", "district_partner", "regional_state_partner",
        "state_partner", "national_partner",
    ]


class RevokePositionRequest(BaseModel):
    admin_id: str
    uid: str


# ────────────────────────────────────────────────────────────────────────
# ADMIN ENDPOINTS
# ────────────────────────────────────────────────────────────────────────
@admin_router.post("/assign")
async def admin_assign_position(
    body: AssignPositionRequest,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Assign a partner position to a user (search by mobile / email / uid).
    Also drops an in-app notification for the user.
    """
    import os
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    if body.position not in POSITION_CONFIG:
        raise HTTPException(status_code=400, detail=f"Invalid position. Choose one of: {list(POSITION_CONFIG.keys())}")

    # Resolve user — escape the query so regex metacharacters like '.*' in
    # user-controlled input cannot broaden the match to unintended users.
    q = body.query.strip()
    q_safe = re.escape(q)
    user = await db.users.find_one({
        "$or": [
            {"uid": q},
            {"mobile": q},
            {"email": {"$regex": f"^{q_safe}$", "$options": "i"}},
        ]
    }, {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "email": 1,
        "subscription_plan": 1, "partner_position": 1})
    if not user:
        raise HTTPException(status_code=404, detail=f"No user found matching '{q}'")

    now_iso = datetime.now(timezone.utc).isoformat()
    meta = POSITION_CONFIG[body.position]
    await db.users.update_one(
        {"uid": user["uid"]},
        {"$set": {
            "partner_position": body.position,
            "partner_position_assigned_at": now_iso,
            "partner_position_assigned_by": body.admin_id,
        }}
    )

    # In-app notification (5b — Elite requirement is applied at commission
    # calculation time; we still notify even non-Elite users so they know).
    try:
        await db.notifications.insert_one({
            "notification_id": str(uuid.uuid4()),
            "user_id": user["uid"],
            "user_uid": user["uid"],
            "type": "partner_position_assigned",
            "title": f"🎉 Promoted to {meta['label']}",
            "message": (
                f"You've been promoted to {meta['label']}. You will now earn "
                f"{meta['commission_pct']*100:.0f}% commission from your L1-L{meta['levels']} "
                f"downlines' Main Dashboard mining collects (Elite plan required to receive)."
            ),
            "created_at": now_iso,
            "read": False,
            "is_read": False,
            "position": body.position,
        })
    except Exception as e:
        logger.warning(f"[PARTNERS] notification insert failed for {user['uid']}: {e}")

    logger.info(f"[PARTNERS] Admin {body.admin_id} assigned {body.position} to {user['uid']} ({user.get('name')})")
    return {
        "success": True,
        "user": {
            "uid": user["uid"],
            "name": user.get("name"),
            "mobile": user.get("mobile"),
            "previous_position": user.get("partner_position") or DEFAULT_POSITION,
            "new_position": body.position,
            "config": meta,
        },
        "message": f"{user.get('name')} → {meta['label']}",
    }


@admin_router.post("/revoke")
async def admin_revoke_position(
    body: RevokePositionRequest,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Revert a user's position back to USER (default)."""
    import os
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    result = await db.users.update_one(
        {"uid": body.uid},
        {"$set": {
            "partner_position": DEFAULT_POSITION,
            "partner_position_assigned_at": datetime.now(timezone.utc).isoformat(),
            "partner_position_assigned_by": body.admin_id,
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "uid": body.uid, "new_position": DEFAULT_POSITION}


@admin_router.get("/list")
async def admin_list_partners(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    """List all users currently holding a non-USER partner position."""
    import os
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    partners = await db.users.find(
        {"partner_position": {"$in": [
            "district_partner", "regional_state_partner",
            "state_partner", "national_partner",
        ]}},
        {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "email": 1,
         "subscription_plan": 1, "partner_position": 1,
         "partner_position_assigned_at": 1, "partner_position_assigned_by": 1}
    ).to_list(5000)

    for p in partners:
        p["position_label"] = POSITION_CONFIG.get(
            p.get("partner_position", "user"), POSITION_CONFIG["user"]
        )["label"]

    return {
        "success": True,
        "total_partners": len(partners),
        "partners": partners,
    }


# ────────────────────────────────────────────────────────────────────────
# USER-FACING ENDPOINT (Invite Page)
# ────────────────────────────────────────────────────────────────────────
@router.get("/my-position/{uid}")
async def get_my_position(uid: str):
    """Return the current user's partner position + cap usage breakdown per
    level. Powers the Invite page position badge.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "uid": 1, "name": 1, "partner_position": 1,
         "subscription_plan": 1, "membership_type": 1,
         "subscription_expired": 1, "referral_code": 1}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    position = user.get("partner_position") or DEFAULT_POSITION
    meta = position_meta(position)

    # Elite eligibility — must match mining_commission._is_elite_active exactly,
    # else the UI badge would tell an eligible user to "upgrade" while the
    # commission engine happily pays them. Import lazily to avoid a hard
    # circular-import at module load.
    try:
        from routes.mining_commission import _is_elite_active
        commission_active = _is_elite_active(user)
    except Exception:
        commission_active = (user.get("subscription_plan") or "").lower() == "elite"

    # Compute per-tier downline counts up to the position's max level
    try:
        from routes.growth_economy import get_downline_level_counts
        level_counts = await get_downline_level_counts(uid, max_depth=meta["levels"])
    except Exception:
        level_counts = {f"l{i+1}": 0 for i in range(meta["levels"])}

    per_level = []
    total = 0
    for i in range(1, meta["levels"] + 1):
        c = int(level_counts.get(f"l{i}", 0))
        per_level.append({"level": i, "count": c})
        total += c

    # Structural bonus-gate (Feb 6 2026). USER position never requires it.
    structure_report = await get_structure_report(uid, position)
    structure_met = True
    if structure_report.get("applicable"):
        structure_met = bool(structure_report.get("structure_met", False))

    # Final commission_active = Elite plan AND structure met.
    final_commission_active = commission_active and structure_met

    return {
        "success": True,
        "uid": uid,
        "name": user.get("name"),
        "partner_position": position,
        "position_label": meta["label"],
        "position_config": meta,
        "subscription_plan": user.get("subscription_plan"),
        "elite_required_for_commission": True,
        "elite_active": commission_active,
        "structure_required": structure_report.get("applicable", False),
        "structure_report": structure_report,
        "structure_met": structure_met,
        "commission_active": final_commission_active,
        "cap": meta["cap"],
        "per_level_counts": per_level,
        "total_downlines_in_scope": total,
        "cap_used_pct": round(min(100.0, (total / meta["cap"]) * 100), 2) if meta["cap"] > 0 else 0,
        "over_cap": total > meta["cap"],
        "counted_towards_commission": min(total, meta["cap"]),
    }


# ────────────────────────────────────────────────────────────────────────
# ADMIN AUDIT — Structure health check for a single partner
# ────────────────────────────────────────────────────────────────────────
@admin_router.get("/audit-structure/{uid}")
async def admin_audit_structure(
    uid: str,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Return the detailed structure report for a partner uid so admins can
    diagnose why a bonus is / isn't active."""
    import os
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "uid": 1, "name": 1, "mobile": 1,
         "partner_position": 1, "subscription_plan": 1, "membership_type": 1,
         "subscription_expired": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    pos = (user.get("partner_position") or "user").lower()
    report = await get_structure_report(uid, pos)
    elite_active = _is_active_elite(user)
    return {
        "success": True,
        "user": {
            "uid": user["uid"], "name": user.get("name"),
            "mobile": user.get("mobile"),
            "partner_position": pos,
        },
        "elite_active": elite_active,
        "structure_report": report,
        "commission_active": elite_active and (report.get("structure_met", True) if report.get("applicable") else True),
    }


# ────────────────────────────────────────────────────────────────────────
# ADMIN — Structure Requirement Config (Feb 7 2026)
# ────────────────────────────────────────────────────────────────────────
# Lets ops tune the 100 / 5 / 3 / 5 thresholds without a code deploy.
# Stored as a single document in db.app_settings with key='partner_structure
# _requirement' and shape:
#   { key: "partner_structure_requirement",
#     value: { district_partner: {child, min_count}, ... } }
# Changes take effect on the next _load_structure_requirement() call (cache
# TTL is 5 min; PATCH endpoint invalidates the cache immediately).

class StructureConfigUpdate(BaseModel):
    admin_id: str
    config: dict  # { position: {child, min_count} } — coerced server-side


@admin_router.get("/structure-config")
async def admin_get_structure_config(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Return the current effective structure-requirement config (merged
    with defaults). Also returns the raw doc from app_settings for edit UI.
    """
    import os
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    effective = await _load_structure_requirement(force_refresh=True)
    raw_doc = await db.app_settings.find_one(
        {"key": "partner_structure_requirement"},
        {"_id": 0, "value": 1, "updated_at": 1, "updated_by": 1},
    )
    return {
        "success": True,
        "effective_config": effective,
        "defaults": POSITION_STRUCTURE_REQUIREMENT_DEFAULT,
        "stored_doc": raw_doc,
        "cache_ttl_sec": _CONFIG_CACHE_TTL_SEC,
    }


@admin_router.post("/structure-config")
async def admin_update_structure_config(
    body: StructureConfigUpdate,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Upsert the structure-requirement config. Body: `config` = full dict
    of the 4 partner tiers (missing entries fall back to default). Invalid
    child types / negative counts are coerced to defaults. Cache is cleared
    immediately so the next validity check reads the fresh config.
    """
    import os
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    coerced = _validate_structure_config(body.config or {})
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one(
        {"key": "partner_structure_requirement"},
        {"$set": {
            "key": "partner_structure_requirement",
            "value": coerced,
            "updated_at": now_iso,
            "updated_by": body.admin_id,
        }},
        upsert=True,
    )
    # Purge caches so the change takes effect on the very next call.
    _STRUCTURE_CACHE.pop(_CONFIG_CACHE_KEY, None)
    # All per-user validity results are now stale relative to the new
    # thresholds; drop them too.
    validity_keys = [k for k in list(_STRUCTURE_CACHE.keys()) if k != _CONFIG_CACHE_KEY]
    for k in validity_keys:
        _STRUCTURE_CACHE.pop(k, None)

    logger.info(f"[PARTNERS] Structure config updated by {body.admin_id}: {coerced}")
    return {
        "success": True,
        "config": coerced,
        "cache_purged": len(validity_keys),
        "message": "Structure requirements updated. Change is live.",
    }


@admin_router.post("/structure-config/reset")
async def admin_reset_structure_config(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Delete the app_settings override → engine falls back to hard-coded
    defaults (100 / 5 / 3 / 5). Cache purged so revert is immediate.
    """
    import os
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    result = await db.app_settings.delete_one({"key": "partner_structure_requirement"})
    clear_structure_cache()  # clear everything including config
    return {
        "success": True,
        "deleted": result.deleted_count,
        "message": "Reverted to hard-coded defaults.",
        "defaults": POSITION_STRUCTURE_REQUIREMENT_DEFAULT,
    }

