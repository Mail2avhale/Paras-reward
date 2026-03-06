"""
Referral Routes - All referral-related API endpoints
OPTIMIZED for 3000+ users with caching
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
import logging
import secrets
import string

# Create router
router = APIRouter(prefix="/referral", tags=["Referral"])

# Database reference - will be set from main server
db = None
cache = None  # Cache reference

def set_db(database):
    """Set the database reference"""
    global db
    db = database

def set_cache(cache_instance):
    """Set cache reference"""
    global cache
    cache = cache_instance

# Import helper functions from server (will be set during initialization)
get_multi_level_referrals = None
get_base_rate = None

def set_helpers(multi_level_func, base_rate_func):
    """Set helper function references"""
    global get_multi_level_referrals, get_base_rate
    get_multi_level_referrals = multi_level_func
    get_base_rate = base_rate_func


@router.get("/code/{uid}")
async def get_referral_code(uid: str):
    """Get user's referral code - generates one if missing"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate referral code if missing
    if not user.get("referral_code"):
        referral_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
        
        # Update user with new referral code
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"referral_code": referral_code}}
        )
        
        return {"referral_code": referral_code}
    
    return {"referral_code": user.get("referral_code")}


@router.get("/lookup/{referral_code}")
async def lookup_referral_code(referral_code: str):
    """
    Lookup referrer info by referral code
    Returns referrer's name if code is valid
    Used for real-time validation in registration form
    """
    if not referral_code or len(referral_code) < 3:
        raise HTTPException(status_code=400, detail="Invalid referral code format")
    
    # Find referrer by code (case-insensitive)
    referrer = await db.users.find_one(
        {"referral_code": referral_code.upper()},
        {"_id": 0, "name": 1, "subscription_plan": 1, "referral_code": 1}
    )
    
    if not referrer:
        raise HTTPException(status_code=404, detail="Referral code not found")
    
    return {
        "valid": True,
        "referrer_name": referrer.get("name", "Unknown"),
        "referrer_plan": referrer.get("subscription_plan", "explorer"),
        "referral_code": referrer.get("referral_code")
    }


@router.post("/apply/{uid}")
async def apply_referral(uid: str, referral_code: str):
    """Apply referral code"""
    # Check if user already has referrer
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("referred_by"):
        raise HTTPException(status_code=400, detail="Referral already applied")
    
    # Find referrer
    referrer = await db.users.find_one({"referral_code": referral_code.upper()})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referrer["uid"] == uid:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")
    
    # Update user with referrer info
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "referred_by": referrer["uid"],
            "referred_by_name": referrer.get("name", "A Friend")
        }}
    )
    
    # Update referrer's referral count
    await db.users.update_one(
        {"uid": referrer["uid"]},
        {"$inc": {"referral_count": 1}}
    )
    
    return {"message": "Referral applied successfully", "referrer_name": referrer.get("name")}


@router.get("/list/{uid}")
async def get_referrals(uid: str, limit: int = 50, page: int = 1):
    """Get list of referrals - OPTIMIZED with pagination and caching"""
    import asyncio
    
    # Check cache first
    cache_key = f"referral_list:{uid}:p{page}:l{limit}"
    if cache:
        cached = await cache.get(cache_key)
        if cached:
            return cached
    
    skip = (page - 1) * limit
    yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    # Use aggregation to add is_active field directly
    pipeline = [
        {"$match": {"referred_by": uid}},
        {"$project": {
            "_id": 0,
            "uid": 1,
            "name": 1,
            "profile_picture": 1,
            "last_login": 1,
            "subscription_plan": 1,
            "is_active": {
                "$cond": {
                    "if": {"$gte": ["$last_login", yesterday]},
                    "then": True,
                    "else": False
                }
            }
        }},
        {"$sort": {"last_login": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    referrals_task = db.users.aggregate(pipeline).to_list(limit)
    total_task = db.users.count_documents({"referred_by": uid})
    
    referrals, total = await asyncio.gather(referrals_task, total_task)
    
    result = {
        "referrals": referrals,
        "total": total,
        "page": page,
        "limit": limit
    }
    
    # Cache for 1 minute
    if cache:
        await cache.set(cache_key, result, ttl=60)
    
    return result


@router.get("/stats/{uid}")
async def get_referral_stats(uid: str):
    """Get referral statistics for a user - OPTIMIZED with caching and parallel queries"""
    import asyncio
    
    # Check cache first
    cache_key = f"referral_stats:{uid}"
    if cache:
        cached = await cache.get(cache_key)
        if cached:
            return cached
    
    yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    # Run all queries in PARALLEL
    total_task = db.users.count_documents({"referred_by": uid})
    
    # Use aggregation for active count - much faster than fetching all
    active_pipeline = [
        {"$match": {
            "referred_by": uid,
            "is_active": {"$ne": False},
            "last_login": {"$gte": yesterday}
        }},
        {"$count": "active"}
    ]
    
    vip_task = db.users.count_documents({
        "referred_by": uid,
        "membership_type": "vip"
    })
    
    active_task = db.users.aggregate(active_pipeline).to_list(1)
    
    total_referrals, active_result, vip_count = await asyncio.gather(
        total_task, active_task, vip_task
    )
    
    active_count = active_result[0]["active"] if active_result else 0
    
    result = {
        "total_referrals": total_referrals,
        "active_referrals": active_count,
        "vip_referrals": vip_count
    }
    
    # Cache for 2 minutes
    if cache:
        await cache.set(cache_key, result, ttl=120)
    
    return result


@router.get("/multi-level-stats/{uid}")
async def get_multi_level_referral_stats(uid: str):
    """
    Get detailed multi-level referral statistics for a user
    Shows: total, active, inactive count for each level + mining speed bonus
    
    NEW SYSTEM (March 2026): Only 3 levels now
    - Level 1: +10% per active user
    - Level 2: +5% per active user
    - Level 3: +3% per active user
    """
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(hours=24)
    
    # Get multi-level referrals (3 levels only now)
    referrals_by_level = await get_multi_level_referrals(uid, max_levels=3)
    
    # NEW: Fixed bonus percentages for 3 levels
    bonus_percentages = {
        'level_1': 10,   # +10%
        'level_2': 5,    # +5%
        'level_3': 3,    # +3%
    }
    
    # Get base rate for calculating mining speed bonus
    base_rate = await get_base_rate()
    
    level_stats = []
    total_all_levels = 0
    total_active_all = 0
    total_inactive_all = 0
    total_mining_bonus = 0.0
    
    # Only 3 levels now (not 5)
    for level_num in range(1, 4):
        level_key = f"level_{level_num}"
        level_users = referrals_by_level.get(level_key, [])
        
        total_count = len(level_users)
        active_count = 0
        inactive_count = 0
        
        for user in level_users:
            last_login = user.get("last_login")
            is_active = False
            
            if last_login:
                try:
                    if isinstance(last_login, str):
                        last_login_dt = datetime.fromisoformat(last_login.replace('Z', '+00:00'))
                    else:
                        last_login_dt = last_login
                    is_active = last_login_dt >= yesterday
                except Exception:
                    pass
            
            if is_active:
                active_count += 1
            else:
                inactive_count += 1
        
        # Calculate mining speed bonus for this level
        bonus_percentage = bonus_percentages.get(level_key, 0)
        level_mining_bonus = active_count * (bonus_percentage / 100) * base_rate
        
        level_stats.append({
            "level": level_num,
            "level_name": f"Level {level_num}",
            "total": total_count,
            "active": active_count,
            "inactive": inactive_count,
            "bonus_percentage": bonus_percentage,
            "mining_speed_bonus": round(level_mining_bonus, 4),
            "mining_speed_bonus_display": f"+{round(level_mining_bonus, 2)} PRC/hr"
        })
        
        total_all_levels += total_count
        total_active_all += active_count
        total_inactive_all += inactive_count
        total_mining_bonus += level_mining_bonus
    
    return {
        "user_id": uid,
        "base_mining_rate": base_rate,
        "levels": level_stats,
        "summary": {
            "total_referrals": total_all_levels,
            "total_active": total_active_all,
            "total_inactive": total_inactive_all,
            "total_mining_bonus": round(total_mining_bonus, 4),
            "total_mining_bonus_display": f"+{round(total_mining_bonus, 2)} PRC/hr",
            "effective_mining_rate": round(base_rate + total_mining_bonus, 4),
            "effective_mining_rate_display": f"{round(base_rate + total_mining_bonus, 2)} PRC/hr"
        },
        "bonus_percentages": bonus_percentages,
        "generated_at": now.isoformat()
    }
