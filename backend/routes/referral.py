"""
Referral Routes - DEPRECATED
============================
Referral bonus system has been removed.
These endpoints return deprecation notices.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

router = APIRouter(prefix="/referral", tags=["Referral - DEPRECATED"])

db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_instance):
    global cache
    cache = cache_instance

def set_helpers(*args, **kwargs):
    pass

DEPRECATION_MESSAGE = "Referral bonus feature has been removed. Please contact support for more information."

@router.get("/code/{uid}")
async def get_referral_code_deprecated(uid: str):
    """Get user's referral code - kept for sharing purposes"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "referral_code": 1, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "referral_code": user.get("referral_code", ""),
        "message": "Referral bonus feature has been removed. Code kept for reference only.",
        "bonus_active": False
    }

@router.get("/stats/{uid}")
async def get_referral_stats_deprecated(uid: str):
    """DEPRECATED: Referral stats"""
    return {
        "deprecated": True,
        "message": DEPRECATION_MESSAGE,
        "total_referrals": 0,
        "active_referrals": 0,
        "bonus_earned": 0,
        "feature_removed": True
    }

@router.get("/list/{uid}")
async def get_referral_list_deprecated(uid: str):
    """DEPRECATED: Referral list"""
    return {
        "deprecated": True,
        "message": DEPRECATION_MESSAGE,
        "referrals": [],
        "feature_removed": True
    }

@router.get("/network/{uid}")
async def get_network_deprecated(uid: str):
    """DEPRECATED: Network/MLM structure"""
    return {
        "deprecated": True,
        "message": "Level bonus (L1, L2, L3) feature has been removed.",
        "level_1": [],
        "level_2": [],
        "level_3": [],
        "feature_removed": True
    }

@router.get("/bonus/{uid}")
async def get_referral_bonus_deprecated(uid: str):
    """DEPRECATED: Referral bonus calculation"""
    return {
        "deprecated": True,
        "message": DEPRECATION_MESSAGE,
        "bonus_rate": 0,
        "level_bonus": {"L1": 0, "L2": 0, "L3": 0},
        "feature_removed": True
    }

@router.post("/apply")
async def apply_referral_code_deprecated():
    """DEPRECATED: Apply referral code"""
    raise HTTPException(
        status_code=410,
        detail=DEPRECATION_MESSAGE
    )
