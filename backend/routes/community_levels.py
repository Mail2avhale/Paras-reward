"""
Community Level Progression (Feb 16, 2026)
==========================================
10-level progressive Community Bonus system for USER-tier members (users
without an assigned Partner Position).

Rules
-----
1. Levels 1-3: always unlocked (0 requirement), pay 1.0% each.
2. Level 4-10: unlock progressively based on number of L1 direct downlines
   who are ACTIVE ELITE (Elite subscription + not expired).
     L4  → 10 active elite  → 1.5%
     L5  → 20              → 2.0%
     L6  → 30              → 2.5%
     L7  → 40              → 3.0%
     L8  → 50              → 3.5%
     L9  → 60              → 4.0%
     L10 → 70              → 4.5%
3. The user themselves must be Elite Active to RECEIVE any commission
   (enforced in mining_commission.distribute_mining_collect_commission).
4. Coexists with Partner Positions — if a user has a partner_position other
   than "user", the Partner Position config takes precedence over this
   10-level table.

Auto-migration
--------------
No DB migration needed. The current earnable level is derived on-the-fly
from the live L1 active elite count at each mining collect event. An
existing Elite user with 70+ downlines automatically earns L10 without
any manual promotion.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/community", tags=["Community Level Progression"])

# --------- MODULE STATE ----------
db = None  # Injected via set_db() from server.py at startup


def set_db(database) -> None:
    global db
    db = database


# --------- LEVEL TABLE (source of truth) ----------
COMMUNITY_LEVEL_TABLE = [
    {"level": 1,  "percent": 1.0, "required_l1_active_elite": 0},
    {"level": 2,  "percent": 1.0, "required_l1_active_elite": 0},
    {"level": 3,  "percent": 1.0, "required_l1_active_elite": 0},
    {"level": 4,  "percent": 1.5, "required_l1_active_elite": 10},
    {"level": 5,  "percent": 2.0, "required_l1_active_elite": 20},
    {"level": 6,  "percent": 2.5, "required_l1_active_elite": 30},
    {"level": 7,  "percent": 3.0, "required_l1_active_elite": 40},
    {"level": 8,  "percent": 3.5, "required_l1_active_elite": 50},
    {"level": 9,  "percent": 4.0, "required_l1_active_elite": 60},
    {"level": 10, "percent": 4.5, "required_l1_active_elite": 70},
]
MAX_LEVEL = len(COMMUNITY_LEVEL_TABLE)  # 10
ELITE_PLANS = ["elite", "vip", "startup", "growth", "pro"]


def get_max_earnable_level(l1_active_elite_count: int) -> int:
    """Return the highest level (1-10) the user is entitled to earn at, given
    their current L1 Active Elite downline count.

    Since L1-L3 are unlocked with 0 requirement, the minimum returned is 3.
    """
    max_lvl = 3
    for row in COMMUNITY_LEVEL_TABLE:
        if l1_active_elite_count >= row["required_l1_active_elite"]:
            max_lvl = row["level"]
    return max_lvl


def get_level_percent(level: int) -> float:
    """Return the community-bonus % for a given level (1-10). 0 if invalid."""
    if 1 <= level <= MAX_LEVEL:
        return float(COMMUNITY_LEVEL_TABLE[level - 1]["percent"])
    return 0.0


async def count_l1_active_elite(uid: str, referral_code: Optional[str]) -> int:
    """Count L1 direct downlines who are Elite Active.
    Mirrors partner_positions._count_l1_active_elite (kept locally to avoid
    a circular import).
    """
    if db is None:
        return 0
    tokens = [uid]
    if referral_code:
        tokens.append(referral_code)
    return await db.users.count_documents({
        "referred_by": {"$in": tokens},
        "subscription_expired": {"$ne": True},
        "$or": [
            {"subscription_plan": {"$in": ELITE_PLANS}},
            {"membership_type": {"$in": ELITE_PLANS}},
        ],
    })


async def get_level_progression(uid: str) -> dict:
    """Full progression breakdown used by the /community/level-progression
    endpoint and by the commission engine (indirectly via
    get_max_earnable_level_for_uid).
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "uid": 1, "name": 1, "referral_code": 1,
         "subscription_plan": 1, "membership_type": 1,
         "subscription_expired": 1, "partner_position": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    plan = (user.get("subscription_plan") or "").lower()
    mem = (user.get("membership_type") or "").lower()
    is_elite = (plan in ELITE_PLANS or mem in ELITE_PLANS) and user.get("subscription_expired") is not True

    active_count = await count_l1_active_elite(uid, user.get("referral_code"))
    current_level = get_max_earnable_level(active_count)

    # Build the levels list annotated with unlocked flag + progress
    levels_out = []
    for row in COMMUNITY_LEVEL_TABLE:
        req = int(row["required_l1_active_elite"])
        unlocked = active_count >= req
        levels_out.append({
            "level": row["level"],
            "percent": row["percent"],
            "required_l1_active_elite": req,
            "unlocked": unlocked,
            "is_current": row["level"] == current_level,
        })

    # Next level target
    next_target = None
    if current_level < MAX_LEVEL:
        next_row = COMMUNITY_LEVEL_TABLE[current_level]  # index current_level = next level's row
        next_req = int(next_row["required_l1_active_elite"])
        missing = max(0, next_req - active_count)
        progress_pct = 0.0
        if next_req > 0:
            progress_pct = round(min(100.0, (active_count / next_req) * 100), 1)
        next_target = {
            "next_level": next_row["level"],
            "next_percent": next_row["percent"],
            "required_l1_active_elite": next_req,
            "current_count": active_count,
            "missing_count": missing,
            "progress_pct": progress_pct,
        }

    partner_position = (user.get("partner_position") or "user").lower()
    partner_position_active = partner_position != "user"

    return {
        "success": True,
        "uid": uid,
        "name": user.get("name"),
        "elite_active": is_elite,
        "elite_required_for_earning": True,
        "l1_active_elite_count": active_count,
        "current_level": current_level,
        "current_percent": get_level_percent(current_level),
        "max_level": MAX_LEVEL,
        "levels": levels_out,
        "next_level": next_target,
        "partner_position": partner_position,
        "partner_position_overrides_levels": partner_position_active,
    }


async def get_max_earnable_level_for_uid(uid: str, referral_code: Optional[str]) -> int:
    """Fast helper used by mining_commission — returns just the max
    earnable level integer without the full report payload.
    """
    active_count = await count_l1_active_elite(uid, referral_code)
    return get_max_earnable_level(active_count)


# ---------- ENDPOINTS ----------
@router.get("/level-progression/{uid}")
async def api_get_level_progression(uid: str):
    """Return the current user's 10-level Community Bonus progression."""
    return await get_level_progression(uid)


@router.get("/level-table")
async def api_get_level_table():
    """Public read-only reference for the level table (percent + requirement)."""
    return {
        "success": True,
        "max_level": MAX_LEVEL,
        "levels": COMMUNITY_LEVEL_TABLE,
        "notes": [
            "Levels 1-3 unlocked by default (0 requirement).",
            "Each higher level unlocks when your L1 Active Elite direct downline count reaches the threshold.",
            "You must be Elite Active to receive Community Bonus.",
            "Partner Position holders (District/Regional/State/National Coordinator) use their own tier config which overrides this table.",
        ],
    }
