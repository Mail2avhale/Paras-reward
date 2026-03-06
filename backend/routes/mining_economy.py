"""
PARAS REWARD - NEW MINING ECONOMY SYSTEM
=========================================

Formula (Per Hour):
- Base Rate = 20.83 PRC/hr (500 PRC/day ÷ 24)
- Single Leg Bonus = 0.375 PRC/hr per PAID downline (max 500 users)
- Team Boost = L1: +5%, L2: +3%, L3: +2%

Final Mining Rate = BaseRate + SingleLegBonus + TeamBoost (ADDITIVE)

Single Leg Rules:
- Global pool sorted by user's created_at (joining date/time)
- Each user's downline = PAID active users who joined AFTER them
- FREE/Explorer users are NOT counted in single leg

Active User = Subscription PAID + KYC verified + Active mining session
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Tuple, Optional
import logging

# ==================== CONSTANTS ====================

# Base mining rate (500 PRC/day = 20.83 PRC/hour)
DAILY_BASE_BONUS = 500
HOURLY_BASE_RATE = DAILY_BASE_BONUS / 24  # 20.833...

# Single Leg bonus per active downline user
DAILY_SINGLE_LEG_BONUS_PER_USER = 9  # 9 PRC/day per user (changed from 12)
HOURLY_SINGLE_LEG_BONUS_PER_USER = DAILY_SINGLE_LEG_BONUS_PER_USER / 24  # 0.375 PRC/hour per user

# Maximum downline users to count
MAX_SINGLE_LEG_USERS = 500

# Team Boost Multipliers (3 Levels)
TEAM_BOOST_LEVELS = {
    'level_1': 0.05,  # +5% per L1 active user
    'level_2': 0.03,  # +3% per L2 active user
    'level_3': 0.02,  # +2% per L3 active user
}

# Free/Explorer plans that don't qualify
FREE_PLANS = ['explorer', 'free', '', None]


async def get_single_leg_downline_count(db, user_created_at: str, user_uid: str) -> int:
    """
    Get count of active users who joined AFTER this user (Single Leg Global Pool)
    
    Single Leg Logic:
    - All users sorted by created_at (joining date/time)
    - User's downline = users who joined AFTER them
    - Only ACTIVE users count (subscription + KYC + mining session)
    
    Args:
        db: Database connection
        user_created_at: User's joining date (ISO format string)
        user_uid: User's UID (to exclude self)
    
    Returns:
        Count of active downline users (max 500)
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Query: Users joined AFTER this user, with active subscription
        # Active = subscription not expired + KYC verified + has active mining session
        
        # Build the query for active users joined after this user
        query = {
            "created_at": {"$gt": user_created_at},
            "uid": {"$ne": user_uid},  # Exclude self
            # Subscription active check
            "$or": [
                {"subscription_expiry": {"$gt": now.isoformat()}},
                {"subscription_expires": {"$gt": now.isoformat()}},
                {"vip_expiry": {"$gt": now.isoformat()}}
            ],
            # KYC verified
            "kyc_status": "verified",
            # Active mining session
            "$or": [
                {"mining_active": True},
                {"mining_session_end": {"$gt": now.isoformat()}}
            ]
        }
        
        # Use aggregation with $and for multiple $or conditions
        pipeline = [
            {
                "$match": {
                    "created_at": {"$gt": user_created_at},
                    "uid": {"$ne": user_uid},
                    "kyc_status": "verified",
                    # MUST be a paid subscriber (NOT free/explorer)
                    "subscription_plan": {"$nin": ["explorer", "free", "", None]},
                    # Must have active subscription
                    "$or": [
                        {"subscription_expiry": {"$gt": now.isoformat()}},
                        {"subscription_expires": {"$gt": now.isoformat()}},
                        {"vip_expiry": {"$gt": now.isoformat()}}
                    ]
                }
            },
            {
                "$match": {
                    # Must have active mining session
                    "$or": [
                        {"mining_active": True},
                        {"mining_session_end": {"$gt": now.isoformat()}}
                    ]
                }
            },
            {
                "$limit": MAX_SINGLE_LEG_USERS
            },
            {
                "$count": "total"
            }
        ]
        
        result = await db.users.aggregate(pipeline).to_list(1)
        
        if result and len(result) > 0:
            count = min(result[0].get("total", 0), MAX_SINGLE_LEG_USERS)
            return count
        
        return 0
        
    except Exception as e:
        logging.error(f"[Mining] Single leg count error: {e}")
        return 0


async def get_team_boost_multiplier(db, user_uid: str) -> Tuple[float, Dict]:
    """
    Calculate Team Boost Multiplier from 3 levels of referrals
    
    L1 = Direct referrals (+10% each)
    L2 = Referrals of L1 (+5% each)
    L3 = Referrals of L2 (+3% each)
    
    BoostMultiplier = 1 + (L1_active × 0.10) + (L2_active × 0.05) + (L3_active × 0.03)
    
    Returns:
        Tuple of (multiplier, breakdown dict)
    """
    try:
        now = datetime.now(timezone.utc)
        
        breakdown = {
            'level_1': {'count': 0, 'active': 0, 'boost': 0.0},
            'level_2': {'count': 0, 'active': 0, 'boost': 0.0},
            'level_3': {'count': 0, 'active': 0, 'boost': 0.0}
        }
        
        # Level 1: Direct referrals
        l1_users = await db.users.find(
            {"referred_by": user_uid},
            {"_id": 0, "uid": 1, "subscription_expiry": 1, "subscription_expires": 1, 
             "vip_expiry": 1, "kyc_status": 1, "mining_active": 1, "mining_session_end": 1}
        ).to_list(None)
        
        breakdown['level_1']['count'] = len(l1_users)
        l1_uids = []
        
        for user in l1_users:
            if is_user_active(user, now):
                breakdown['level_1']['active'] += 1
                l1_uids.append(user['uid'])
        
        breakdown['level_1']['boost'] = breakdown['level_1']['active'] * TEAM_BOOST_LEVELS['level_1']
        
        # Level 2: Referrals of L1
        if l1_uids:
            l2_users = await db.users.find(
                {"referred_by": {"$in": l1_uids}},
                {"_id": 0, "uid": 1, "subscription_expiry": 1, "subscription_expires": 1,
                 "vip_expiry": 1, "kyc_status": 1, "mining_active": 1, "mining_session_end": 1}
            ).to_list(None)
            
            breakdown['level_2']['count'] = len(l2_users)
            l2_uids = []
            
            for user in l2_users:
                if is_user_active(user, now):
                    breakdown['level_2']['active'] += 1
                    l2_uids.append(user['uid'])
            
            breakdown['level_2']['boost'] = breakdown['level_2']['active'] * TEAM_BOOST_LEVELS['level_2']
            
            # Level 3: Referrals of L2
            if l2_uids:
                l3_users = await db.users.find(
                    {"referred_by": {"$in": l2_uids}},
                    {"_id": 0, "uid": 1, "subscription_expiry": 1, "subscription_expires": 1,
                     "vip_expiry": 1, "kyc_status": 1, "mining_active": 1, "mining_session_end": 1}
                ).to_list(None)
                
                breakdown['level_3']['count'] = len(l3_users)
                
                for user in l3_users:
                    if is_user_active(user, now):
                        breakdown['level_3']['active'] += 1
                
                breakdown['level_3']['boost'] = breakdown['level_3']['active'] * TEAM_BOOST_LEVELS['level_3']
        
        # Calculate total multiplier
        total_boost = (
            breakdown['level_1']['boost'] +
            breakdown['level_2']['boost'] +
            breakdown['level_3']['boost']
        )
        
        multiplier = 1.0 + total_boost
        
        return multiplier, breakdown
        
    except Exception as e:
        logging.error(f"[Mining] Team boost error: {e}")
        return 1.0, {}


def is_user_active(user: Dict, now: datetime) -> bool:
    """
    Check if user is active for mining bonus purposes
    
    Active = Subscription active + KYC verified + Active mining session
    """
    # Check KYC
    if user.get('kyc_status') != 'verified':
        return False
    
    # Check subscription expiry
    subscription_active = False
    for field in ['subscription_expiry', 'subscription_expires', 'vip_expiry']:
        expiry = user.get(field)
        if expiry:
            try:
                if isinstance(expiry, str):
                    expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                else:
                    expiry_dt = expiry
                
                if expiry_dt.tzinfo is None:
                    expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
                
                if expiry_dt > now:
                    subscription_active = True
                    break
            except:
                continue
    
    if not subscription_active:
        return False
    
    # Check mining session
    if user.get('mining_active') == True:
        return True
    
    session_end = user.get('mining_session_end')
    if session_end:
        try:
            if isinstance(session_end, str):
                session_end_dt = datetime.fromisoformat(session_end.replace('Z', '+00:00'))
            else:
                session_end_dt = session_end
            
            if session_end_dt.tzinfo is None:
                session_end_dt = session_end_dt.replace(tzinfo=timezone.utc)
            
            if session_end_dt > now:
                return True
        except:
            pass
    
    return False


async def calculate_new_mining_rate(db, uid: str, cache=None) -> Tuple[float, float, Dict]:
    """
    Calculate mining rate using NEW economy formula
    
    Formula:
    BaseRate = 20.83 + (SingleLegUsers × 0.5) PRC/hour
    FinalRate = BaseRate × BoostMultiplier
    
    Args:
        db: Database connection
        uid: User's UID
        cache: Optional cache instance
    
    Returns:
        Tuple of (hourly_rate, per_minute_rate, breakdown)
    """
    # Check cache first
    cache_key = f"new_mining_rate:{uid}"
    if cache:
        cached = await cache.get(cache_key)
        if cached:
            return (
                cached.get('hourly_rate', HOURLY_BASE_RATE),
                cached.get('per_minute_rate', HOURLY_BASE_RATE / 60),
                cached.get('breakdown', {})
            )
    
    # Get user data
    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "uid": 1, "created_at": 1, "subscription_plan": 1,
         "subscription_expiry": 1, "subscription_expires": 1, "vip_expiry": 1,
         "kyc_status": 1}
    )
    
    if not user:
        return HOURLY_BASE_RATE, HOURLY_BASE_RATE / 60, {}
    
    # Check if user has active subscription
    now = datetime.now(timezone.utc)
    subscription_active = False
    
    for field in ['subscription_expiry', 'subscription_expires', 'vip_expiry']:
        expiry = user.get(field)
        if expiry:
            try:
                if isinstance(expiry, str):
                    expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                else:
                    expiry_dt = expiry
                
                if expiry_dt.tzinfo is None:
                    expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
                
                if expiry_dt > now:
                    subscription_active = True
                    break
            except:
                continue
    
    # Free users get base rate only (no bonuses)
    user_plan = (user.get('subscription_plan') or '').lower()
    if user_plan in FREE_PLANS or not subscription_active:
        return HOURLY_BASE_RATE, HOURLY_BASE_RATE / 60, {
            'base_rate': HOURLY_BASE_RATE,
            'single_leg_users': 0,
            'single_leg_bonus': 0,
            'boost_multiplier': 1.0,
            'final_rate': HOURLY_BASE_RATE,
            'is_free_user': True
        }
    
    # Get user's created_at for single leg calculation
    user_created_at = user.get('created_at')
    if not user_created_at:
        user_created_at = now.isoformat()
    
    # Step 1: Get Single Leg downline count
    single_leg_count = await get_single_leg_downline_count(db, user_created_at, uid)
    single_leg_bonus = single_leg_count * HOURLY_SINGLE_LEG_BONUS_PER_USER
    
    # Step 2: Calculate base rate (with single leg) - this is the "Base Rate" shown to user
    base_rate_with_single_leg = HOURLY_BASE_RATE + single_leg_bonus
    
    # Step 3: Get Team Boost (L1, L2, L3 bonuses in PRC/hr)
    # These are ADDED, not multiplied
    boost_multiplier, boost_breakdown = await get_team_boost_multiplier(db, uid)
    
    # Calculate L1, L2, L3 bonuses in PRC/hr (percentage of base_rate_with_single_leg)
    l1_bonus_prc = boost_breakdown.get('level_1', {}).get('boost', 0) * base_rate_with_single_leg
    l2_bonus_prc = boost_breakdown.get('level_2', {}).get('boost', 0) * base_rate_with_single_leg
    l3_bonus_prc = boost_breakdown.get('level_3', {}).get('boost', 0) * base_rate_with_single_leg
    
    total_level_bonus = l1_bonus_prc + l2_bonus_prc + l3_bonus_prc
    
    # Step 4: Calculate final rate = Base Rate + L1 + L2 + L3 (ADDITION, not multiplication)
    # NEW FORMULA: Total = BaseRate(daily+single_leg) + L1_bonus + L2_bonus + L3_bonus
    final_hourly_rate = base_rate_with_single_leg + total_level_bonus
    per_minute_rate = final_hourly_rate / 60
    
    # Update boost_breakdown with PRC/hr values for each level
    for level_key in ['level_1', 'level_2', 'level_3']:
        if level_key in boost_breakdown:
            boost_pct = boost_breakdown[level_key].get('boost', 0)
            boost_breakdown[level_key]['bonus_prc'] = round(boost_pct * base_rate_with_single_leg, 4)
    
    breakdown = {
        'base_rate': round(HOURLY_BASE_RATE, 4),
        'single_leg_users': single_leg_count,
        'single_leg_bonus': round(single_leg_bonus, 4),
        'base_with_single_leg': round(base_rate_with_single_leg, 4),
        'l1_bonus': round(l1_bonus_prc, 4),
        'l2_bonus': round(l2_bonus_prc, 4),
        'l3_bonus': round(l3_bonus_prc, 4),
        'total_level_bonus': round(total_level_bonus, 4),
        'boost_multiplier': round(boost_multiplier, 4),  # Kept for backward compatibility
        'boost_breakdown': boost_breakdown,
        'final_rate': round(final_hourly_rate, 4),
        'per_minute_rate': round(per_minute_rate, 6),
        'daily_estimate': round(final_hourly_rate * 24, 2),
        'is_free_user': False
    }
    
    # Cache for 60 seconds
    if cache:
        await cache.set(cache_key, {
            'hourly_rate': final_hourly_rate,
            'per_minute_rate': per_minute_rate,
            'breakdown': breakdown
        }, ttl=60)
    
    return final_hourly_rate, per_minute_rate, breakdown


# ==================== UTILITY FUNCTIONS ====================

def format_mining_rate_display(hourly_rate: float) -> str:
    """Format mining rate for UI display"""
    return f"{round(hourly_rate, 2)} PRC/hr"


def calculate_daily_estimate(hourly_rate: float) -> float:
    """Calculate estimated daily PRC from hourly rate"""
    return hourly_rate * 24


def calculate_monthly_estimate(hourly_rate: float) -> float:
    """Calculate estimated monthly PRC from hourly rate"""
    return hourly_rate * 24 * 30
