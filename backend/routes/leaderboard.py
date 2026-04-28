"""
PARAS REWARD - Leaderboard Routes
==================================
All leaderboard related API endpoints
"""

from fastapi import APIRouter
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

# Database reference - will be set by server.py
db = None

def set_db(database):
    global db
    db = database


@router.get("")
async def get_leaderboard(limit: int = 50):
    """Get overall leaderboard by PRC balance"""
    users = await db.users.find(
        {"prc_balance": {"$gt": 0}},
        {"_id": 0, "uid": 1, "name": 1, "first_name": 1, "prc_balance": 1, 
         "profile_picture": 1, "subscription_plan": 1}
    ).sort("prc_balance", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for idx, user in enumerate(users, 1):
        name = user.get("name") or user.get("first_name") or "User"
        leaderboard.append({
            "rank": idx,
            "user_id": user["uid"],
            "name": name,
            "prc_balance": round(user.get("prc_balance", 0), 2),
            "profile_picture": user.get("profile_picture"),
            "subscription_plan": user.get("subscription_plan", "explorer")
        })
    
    return {"leaderboard": leaderboard}


@router.get("/miners")
async def get_top_miners(period: str = "all_time", limit: int = 100):
    """Get top miners leaderboard"""
    
    # Calculate time filter
    time_filter = {}
    if period == "weekly":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        time_filter = {"created_at": {"$gte": week_ago}}
    elif period == "monthly":
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        time_filter = {"created_at": {"$gte": month_ago}}
    
    # Aggregate mining totals (tap_game removed - feature deprecated)
    pipeline = [
        {"$match": {**{"type": {"$in": ["mining"]}}, **time_filter}},
        {"$group": {
            "_id": "$user_id",
            "total_mined": {"$sum": "$amount"}
        }},
        {"$sort": {"total_mined": -1}},
        {"$limit": limit}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(limit)
    
    # Get user details
    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = await db.users.find_one({"uid": result["_id"]})
        if user:
            leaderboard.append({
                "rank": idx,
                "user_id": result["_id"],
                "name": user.get("name", "Unknown"),
                "total_mined": round(result["total_mined"], 2),
                "subscription_plan": user.get("subscription_plan", "explorer")
            })
    
    return {"leaderboard": leaderboard, "period": period}


@router.get("/referrers")
async def get_top_referrers(limit: int = 100):
    """Get top referrers leaderboard (by friends invited)"""
    
    # Aggregate referral counts
    pipeline = [
        {"$match": {"referred_by": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$referred_by",
            "total_referrals": {"$sum": 1}
        }},
        {"$sort": {"total_referrals": -1}},
        {"$limit": limit}
    ]
    
    results = await db.users.aggregate(pipeline).to_list(limit)
    
    # Get user details
    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = await db.users.find_one({"uid": result["_id"]})
        if user:
            leaderboard.append({
                "rank": idx,
                "user_id": result["_id"],
                "name": user.get("name", "Unknown"),
                "friends_invited": result["total_referrals"],
                "subscription_plan": user.get("subscription_plan", "explorer")
            })
    
    return {"leaderboard": leaderboard}


@router.get("/earners")
async def get_top_earners(limit: int = 100):
    """Get top earners leaderboard by total earned"""
    
    # Aggregate total earnings from transactions
    pipeline = [
        {"$match": {"type": {"$in": ["mining", "referral_bonus", "daily_reward"]}}},
        {"$group": {
            "_id": "$user_id",
            "total_earned": {"$sum": "$amount"}
        }},
        {"$sort": {"total_earned": -1}},
        {"$limit": limit}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(limit)
    
    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = await db.users.find_one({"uid": result["_id"]})
        if user:
            leaderboard.append({
                "rank": idx,
                "user_id": result["_id"],
                "name": user.get("name", "Unknown"),
                "total_earned": round(result["total_earned"], 2),
                "subscription_plan": user.get("subscription_plan", "explorer")
            })
    
    return {"leaderboard": leaderboard}


@router.get("/weekly")
async def get_weekly_leaderboard(limit: int = 50):
    """Get weekly leaderboard - top performers this week"""
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}, "type": {"$in": ["mining", "referral_bonus"]}}},
        {"$group": {
            "_id": "$user_id",
            "weekly_earnings": {"$sum": "$amount"}
        }},
        {"$sort": {"weekly_earnings": -1}},
        {"$limit": limit}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(limit)
    
    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = await db.users.find_one({"uid": result["_id"]})
        if user:
            leaderboard.append({
                "rank": idx,
                "user_id": result["_id"],
                "name": user.get("name", "Unknown"),
                "weekly_earnings": round(result["weekly_earnings"], 2),
                "profile_picture": user.get("profile_picture")
            })
    
    return {"leaderboard": leaderboard, "period": "weekly"}


# ============================================================================
# TOP REDEEMERS — Lifetime across ALL services (for Community + Live Strip)
# ============================================================================
_TOP_REDEEMERS_CACHE: dict = {"ts": 0, "data": None}
_TOP_REDEEMERS_TTL = 30 * 60  # 30 minutes


def _mask_name(full_name: str, first_name: str = "") -> str:
    """'Vishal Rohitkumar Rundhiya' → 'Vishal R.' ; fallback to 'User' ."""
    first = (first_name or "").strip()
    full = (full_name or "").strip()
    if not first:
        first = full.split()[0] if full else ""
    if not first:
        return "User"
    # Last initial from full name (if more than one word)
    parts = full.split()
    last_initial = ""
    if len(parts) >= 2 and parts[-1] and parts[-1][0].isalpha():
        last_initial = f" {parts[-1][0].upper()}."
    return f"{first}{last_initial}"


def _city_for(user: dict) -> str:
    return (
        user.get("city")
        or user.get("district")
        or user.get("state")
        or ""
    )


async def _sum_prc_by_user(pipeline_match: dict, pipeline_group_field: str,
                           coll_name: str) -> dict:
    """Return {user_id: sum_prc} for given collection + numeric field."""
    pipeline = [
        {"$match": pipeline_match},
        {"$group": {
            "_id": "$user_id",
            "total": {"$sum": {"$ifNull": [f"${pipeline_group_field}", 0]}},
        }},
    ]
    result = {}
    try:
        async for row in db[coll_name].aggregate(pipeline, allowDiskUse=True):
            uid = row.get("_id")
            if uid:
                result[uid] = result.get(uid, 0) + float(row.get("total") or 0)
    except Exception as e:
        import logging
        logging.warning(f"[top-redeemers] agg on {coll_name} failed: {e}")
    return result


@router.get("/top-redeemers")
async def get_top_redeemers(limit: int = 50):
    """Top N users by LIFETIME PRC redeemed/spent across all services.
    Uses aggregation on multiple collections + 30-min in-memory cache.
    Returns masked names + city only (privacy-safe, shareable).
    """
    import time
    import logging

    now = time.time()
    if (_TOP_REDEEMERS_CACHE["data"] is not None
            and now - _TOP_REDEEMERS_CACHE["ts"] < _TOP_REDEEMERS_TTL
            and len(_TOP_REDEEMERS_CACHE["data"]) >= limit):
        return {
            "leaderboard": _TOP_REDEEMERS_CACHE["data"][:limit],
            "cached": True,
            "refreshed_at": _TOP_REDEEMERS_CACHE["ts"],
        }

    # Paid / approved / completed / pending / success — count as "used"
    STATUS_OK = {"$in": ["paid", "approved", "completed", "success",
                          "pending", "processing"]}

    totals: dict = {}

    # Each tuple: (collection, status_filter, prc_field)
    sources = [
        ("bank_transfer_requests", {"status": STATUS_OK}, "prc_deducted"),
        ("bank_withdrawal_requests", {"status": STATUS_OK}, "total_prc_deducted"),
        ("bank_redeem_requests", {"status": STATUS_OK}, "total_prc_deducted"),
        ("bill_payment_requests", {"status": STATUS_OK}, "total_prc_deducted"),
        ("recharge_requests", {"status": STATUS_OK}, "total_prc_deducted"),
        ("gift_voucher_requests", {"status": STATUS_OK}, "total_prc_deducted"),
        ("subscription_payments", {"status": STATUS_OK}, "prc_amount"),
        ("dmt_transactions", {"status": STATUS_OK}, "total_prc_deducted"),
    ]
    for coll, match, field in sources:
        partial = await _sum_prc_by_user(match, field, coll)
        for uid, prc in partial.items():
            totals[uid] = totals.get(uid, 0) + prc

    if not totals:
        logging.warning("[top-redeemers] no data across any service")
        return {"leaderboard": [], "cached": False, "refreshed_at": int(now)}

    # Sort & take top N (extra buffer for filter-out-admins)
    top_ids = sorted(totals.items(), key=lambda x: -x[1])[:limit * 2]

    # Hydrate user info
    user_ids = [t[0] for t in top_ids]
    user_docs = {u["uid"]: u for u in await db.users.find(
        {"uid": {"$in": user_ids}},
        {"_id": 0, "uid": 1, "name": 1, "first_name": 1, "last_name": 1,
         "city": 1, "district": 1, "state": 1, "role": 1,
         "profile_picture": 1, "subscription_plan": 1}
    ).to_list(len(user_ids))}

    # PRC rate
    try:
        from utils.helpers import get_prc_rate
        prc_rate = float(await get_prc_rate(db)) or 13.0
    except Exception:
        prc_rate = 13.0

    leaderboard = []
    rank = 0
    for uid, prc in top_ids:
        if len(leaderboard) >= limit:
            break
        user = user_docs.get(uid)
        if not user:
            continue
        if user.get("role") == "admin":
            continue
        rank += 1
        leaderboard.append({
            "rank": rank,
            "user_id": uid,
            "name_masked": _mask_name(user.get("name"), user.get("first_name")),
            "city": _city_for(user),
            "total_redeemed_prc": round(prc, 2),
            "total_redeemed_inr": round(prc / prc_rate, 2) if prc_rate else 0,
            "subscription_plan": user.get("subscription_plan", "explorer"),
            "has_avatar": bool(user.get("profile_picture")),
        })

    _TOP_REDEEMERS_CACHE["ts"] = int(now)
    _TOP_REDEEMERS_CACHE["data"] = leaderboard
    return {
        "leaderboard": leaderboard,
        "cached": False,
        "refreshed_at": int(now),
        "prc_rate": prc_rate,
    }

