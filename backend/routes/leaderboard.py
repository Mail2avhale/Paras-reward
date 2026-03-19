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
