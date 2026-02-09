"""
Referral Routes - All referral-related API endpoints
Extracted from server.py for better code organization
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

def set_db(database):
    """Set the database reference"""
    global db
    db = database

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
async def get_referrals(uid: str):
    """Get list of referrals"""
    referrals = await db.users.find(
        {"referred_by": uid}, 
        {"_id": 0, "uid": 1, "name": 1, "profile_picture": 1, "last_login": 1}
    ).to_list(200)
    
    # Check if active
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    for ref in referrals:
        last_login = datetime.fromisoformat(ref.get("last_login")) if isinstance(ref.get("last_login"), str) else ref.get("last_login")
        ref["is_active"] = last_login >= yesterday if last_login else False
    
    return {"referrals": referrals, "total": len(referrals)}


@router.get("/stats/{uid}")
async def get_referral_stats(uid: str):
    """Get referral statistics for a user"""
    # Total referrals
    total_referrals = await db.users.count_documents({"referred_by": uid})
    
    # Active referrals (logged in within last 24 hours)
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    
    # Get all referrals to check activity
    all_referrals = await db.users.find(
        {"referred_by": uid}, 
        {"_id": 0, "uid": 1, "last_login": 1, "membership_type": 1, "is_active": 1}
    ).to_list(None)
    
    active_count = 0
    vip_count = 0
    
    for ref in all_referrals:
        # Check if VIP
        if ref.get("membership_type") == "vip":
            vip_count += 1
        
        # Check if active (logged in recently and account is active)
        if ref.get("is_active", True):
            last_login = ref.get("last_login")
            if last_login:
                try:
                    last_login_dt = datetime.fromisoformat(last_login) if isinstance(last_login, str) else last_login
                    if last_login_dt >= yesterday:
                        active_count += 1
                except:
                    pass
    
    return {
        "total_referrals": total_referrals,
        "active_referrals": active_count,
        "vip_referrals": vip_count
    }


@router.get("/multi-level-stats/{uid}")
async def get_multi_level_referral_stats(uid: str):
    """
    Get detailed multi-level referral statistics for a user
    Shows: total, active, inactive count for each level + mining speed bonus
    """
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(hours=24)
    
    # Get multi-level referrals
    referrals_by_level = await get_multi_level_referrals(uid, max_levels=5)
    
    # Get referral bonus settings
    settings = await db.settings.find_one({}, {"_id": 0, "referral_bonus_settings": 1})
    if settings and "referral_bonus_settings" in settings:
        bonus_percentages = {
            'level_1': settings["referral_bonus_settings"].get("level_1", 10),
            'level_2': settings["referral_bonus_settings"].get("level_2", 5),
            'level_3': settings["referral_bonus_settings"].get("level_3", 2.5),
            'level_4': settings["referral_bonus_settings"].get("level_4", 1.5),
            'level_5': settings["referral_bonus_settings"].get("level_5", 1),
        }
    else:
        bonus_percentages = {
            'level_1': 10,
            'level_2': 5,
            'level_3': 2.5,
            'level_4': 1.5,
            'level_5': 1,
        }
    
    # Get base rate for calculating mining speed bonus
    base_rate = await get_base_rate()
    
    level_stats = []
    total_all_levels = 0
    total_active_all = 0
    total_inactive_all = 0
    total_mining_bonus = 0.0
    
    for level_num in range(1, 6):
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
                except:
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
            "mining_speed_bonus_display": f"+{round(level_mining_bonus, 2)} PRC/day"
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
            "total_mining_bonus_display": f"+{round(total_mining_bonus, 2)} PRC/day",
            "effective_mining_rate": round(base_rate + total_mining_bonus, 4),
            "effective_mining_rate_display": f"{round(base_rate + total_mining_bonus, 2)} PRC/day"
        },
        "bonus_percentages": bonus_percentages,
        "generated_at": now.isoformat()
    }
