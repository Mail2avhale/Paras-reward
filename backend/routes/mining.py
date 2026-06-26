"""
Reward Routes - GROWTH ECONOMY SYSTEM (April 2026)
====================================================

FORMULA v2.0 (April 18, 2026) - Subscription Position Based Mining
===================================================================
CHANGE: Mining network now based on subscription purchase/renewal ORDER,
not user joining date. Each subscription/renewal assigns a new position.
Network = active subscriptions after your position.

Referrals & Redeem Limit: UNCHANGED (still tree_position based)

Reward Formula (Single Source of Truth):
- Base: 1000 PRC/day (below 250 network), 0 (above 250)
- Team Bonus: N x PRC_per_user(N)
- PRC_per_user(N) = max(2.5, 5 x (21 - log2(N)) / 14)

6-Tier Network Cap (L1-L5 Cascade, Jun 2026):
- Tier 1 (Base):     800 (everyone)
- Tier 2 (L1):       +16 per direct referral
- Tier 3 (L2):       +5  per L2 (L1 indirect)
- Tier 4 (L3):       +3  per L3 referral
- Tier 5 (L4):       +2  per L4 referral
- Tier 6 (L5):       +1  per L5 referral
- Formula: min(8000, 800 + 16*L1 + 5*L2 + 3*L3 + 2*L4 + 1*L5)

Subscription:
- Explorer: Shows rate (demo), CANNOT collect
- Elite (Razorpay/Manual): 100% rate
"""

import math
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
import asyncio
import uuid

# Lazy auth-dependency wrapper. `server.get_current_user` is defined
# AFTER this module is imported (server.py imports us at line 107 but
# defines the dep at line 249), so we can't do `from server import ...`
# at module top — that would crash with a circular-import error.
# Instead we declare a wrapper with the SAME signature (HTTPBearer +
# HTTPAuthorizationCredentials) and resolve the real dependency at
# call time.
_security = HTTPBearer(auto_error=False)


async def _require_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    from server import get_current_user as _real_dep
    return await _real_dep(credentials)


router = APIRouter(prefix="/mining", tags=["Mining"])

# Module-level variables
db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

def set_helpers(helpers: dict):
    pass


# ==================== MINING FORMULA CONSTANTS ====================

BASE_MINING_PRC = 1000  # Base daily PRC (when network < 250)
BASE_MINING_THRESHOLD = 250  # Network size threshold: base=1000 if < 250, base=0 if >= 250
MIN_PRC_PER_USER = 2.5  # Minimum PRC per user at 16384 network
NETWORK_CAP_BASE = 800  # Tier 1: Base cap (single leg)
NETWORK_CAP_MAX = 8000  # Tier 6: Absolute max from L1-L5 cascade
CAP_PER_DIRECT = 16  # +16 cap per L1 (direct) referral
CAP_PER_L1_INDIRECT = 5  # +5 cap per L2 (L1 indirect) referral
CAP_PER_L3 = 3  # +3 cap per L3 referral
CAP_PER_L4 = 2  # +2 cap per L4 referral
CAP_PER_L5 = 1  # +1 cap per L5 referral
SESSION_DURATION_HOURS = 24  # Mining session duration
COLLECT_TO_START_COOLDOWN_SECONDS = 60  # Forced wait between collect and next session (AdMob retention)


# ==================== SUBSCRIPTION POSITION SYSTEM ====================
# v2.0 (April 2026) - Mining network based on subscription order, not join order
# Position assigned on every subscription purchase/renewal
# Network = count of active subscriptions with position > yours

async def assign_subscription_position(user_id: str) -> int:
    """
    Assign next subscription_position to a user on subscription purchase/renewal.
    Returns the new position number.
    """
    try:
        # Get next position (atomic increment on a counter doc)
        counter = await db.app_settings.find_one_and_update(
            {"_id": "subscription_position_counter"},
            {"$inc": {"counter": 1}},
            upsert=True,
            return_document=True
        )
        new_position = counter.get("counter", 1)
        
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Update user's subscription_position
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "subscription_position": new_position,
                "subscription_position_at": now_iso
            }}
        )
        
        logging.info(f"[SUB-POSITION] Assigned position {new_position} to user {user_id}")
        return new_position
    except Exception as e:
        logging.error(f"[SUB-POSITION] Error assigning position for {user_id}: {e}")
        return 0


async def get_subscription_network_size(user_id: str) -> int:
    """
    v2.0 Mining Network Size - Subscription Order Based.
    
    Network = count of users with:
    - subscription_position > my position
    - subscription_expiry > now (active subscription)
    
    This replaces get_network_size() for MINING ONLY.
    Redeem limit still uses old tree_position system.
    """
    try:
        now = datetime.now(timezone.utc)
        now_str = now.isoformat()
        
        user = await db.users.find_one(
            {"uid": user_id},
            {"_id": 0, "subscription_position": 1}
        )
        if not user or not user.get("subscription_position"):
            return 0
        
        my_position = user["subscription_position"]
        
        # Count active subscriptions with higher position
        active_filter = {
            "subscription_position": {"$gt": my_position},
            "subscription_plan": {"$in": ["elite", "vip", "startup", "growth", "pro", "Elite", "VIP", "Startup", "Growth", "Pro"]},
            "$or": [
                {"subscription_expiry": {"$gt": now_str}},
                {"subscription_expiry": {"$gt": now}},
                {"subscription_expires": {"$gt": now_str}},
                {"subscription_expires": {"$gt": now}}
            ]
        }
        
        count = await db.users.count_documents(active_filter)
        return count
    except Exception as e:
        logging.error(f"[SUB-POSITION] Error getting subscription network for {user_id}: {e}")
        return 0


# ==================== HELPER FUNCTIONS ====================

def calculate_prc_per_user(network_size: int) -> float:
    """
    Calculate PRC per user based on network size (Decreasing formula)
    
    Formula: PRC_per_user = max(2.5, 5 × (21 - log₂(N)) / 14)
    
    Spreadsheet:
    | Users | PRC/User |
    |   2   |  7.14    |
    | 128   |  5.00    |
    |16384  |  2.50    |
    """
    if network_size <= 0:
        return 0  # No team = no team bonus
    
    if network_size == 1:
        # 1 user: 5 × (21 - 0) / 14 = 7.5, but cap per spreadsheet pattern
        return 5 * (21 - math.log2(2)) / 14  # Treat as 2 → 7.142857
    
    log_value = math.log2(max(2, network_size))
    prc_per_user = 5 * (21 - log_value) / 14
    
    return round(max(MIN_PRC_PER_USER, prc_per_user), 6)


def calculate_network_cap(direct_referrals: int, l1_indirect_referrals: int = 0,
                          l3_count: int = 0, l4_count: int = 0, l5_count: int = 0) -> dict:
    """
    6-Tier Network Cap Formula (L1-L5 Cascade, June 2026):
    
    Tier 1 (Base):     800 (everyone)
    Tier 2 (L1):       +16 per direct referral
    Tier 3 (L2):       +5  per L2 (L1 indirect)
    Tier 4 (L3):       +3  per L3 referral
    Tier 5 (L4):       +2  per L4 referral
    Tier 6 (L5):       +1  per L5 referral
    
    Formula: min(8000, 800 + 16*L1 + 5*L2 + 3*L3 + 2*L4 + 1*L5)
    
    Examples:
    - 0 referrals → 800
    - 10 L1, 0 L2-L5 → 960
    - 200 L1, 400 L2 → 800 + 3200 + 2000 = 6000
    - 200 L1, 400 L2, 500 L3, 600 L4, 700 L5 → 800+3200+2000+1500+1200+700 = 8000 (capped)
    """
    tier1 = NETWORK_CAP_BASE  # 800
    tier2_bonus = CAP_PER_DIRECT * direct_referrals  # 16 x L1
    tier3_bonus = CAP_PER_L1_INDIRECT * l1_indirect_referrals  # 5 x L2
    tier4_bonus = CAP_PER_L3 * l3_count  # 3 x L3
    tier5_bonus = CAP_PER_L4 * l4_count  # 2 x L4
    tier6_bonus = CAP_PER_L5 * l5_count  # 1 x L5
    
    raw_cap = tier1 + tier2_bonus + tier3_bonus + tier4_bonus + tier5_bonus + tier6_bonus
    final_cap = min(NETWORK_CAP_MAX, raw_cap)
    
    return {
        "cap": final_cap,
        "tier1_base": tier1,
        "tier2_bonus": tier2_bonus,
        "tier3_bonus": tier3_bonus,
        "tier4_bonus": tier4_bonus,
        "tier5_bonus": tier5_bonus,
        "tier6_bonus": tier6_bonus,
        "direct_referrals": direct_referrals,
        "l1_indirect_referrals": l1_indirect_referrals,
        "l3_count": l3_count,
        "l4_count": l4_count,
        "l5_count": l5_count,
    }


async def check_subscription_expiry(user: dict) -> dict:
    """
    Check if user's subscription has expired.
    If expired, check for upcoming plans to auto-activate.
    If no upcoming plan, auto-set to explorer.
    Also restores subscription if user is explorer but has active payment.
    """
    if not user:
        return user
    
    uid = user.get("uid")
    plan = user.get("subscription_plan", "explorer")
    
    # SYNC FIX: If user is explorer, check subscription_payments for active subscription
    if plan.lower() in ["explorer", "free", ""]:
        try:
            active_payment = await db.subscription_payments.find_one(
                {"user_id": uid, "status": {"$in": ["paid", "Paid", "PAID"]}},
                {"_id": 0, "subscription_end": 1, "new_expiry": 1, "subscription_expiry": 1, "plan_name": 1},
                sort=[("created_at", -1)]
            )
            if active_payment:
                payment_expiry = active_payment.get("subscription_end") or active_payment.get("new_expiry") or active_payment.get("subscription_expiry")
                if payment_expiry:
                    now = datetime.now(timezone.utc)
                    if isinstance(payment_expiry, str):
                        exp_dt = datetime.fromisoformat(payment_expiry.replace('Z', '+00:00'))
                    else:
                        exp_dt = payment_expiry
                    if exp_dt.tzinfo is None:
                        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                    if exp_dt > now:
                        # Active payment found! Restore subscription
                        payment_plan = active_payment.get("plan_name", "elite")
                        if payment_plan not in ["elite", "startup", "premium"]:
                            payment_plan = "elite"
                        await db.users.update_one(
                            {"uid": uid},
                            {"$set": {
                                "subscription_plan": payment_plan,
                                "subscription_expiry": payment_expiry if isinstance(payment_expiry, str) else payment_expiry.isoformat(),
                                "subscription_status": "active",
                                "subscription_expired": False,
                                "membership_type": "vip"
                            }}
                        )
                        user["subscription_plan"] = payment_plan
                        user["subscription_expired"] = False
                        user["subscription_status"] = "active"
                        logging.info(f"[SUBSCRIPTION-SYNC] Restored {uid} to {payment_plan} from payment record")
                        if cache:
                            await cache.delete(f"user_data:{uid}")
                            await cache.delete(f"user:dashboard:{uid}")
                        return user
        except Exception as e:
            logging.error(f"[SUBSCRIPTION-SYNC] Error checking payments for {uid}: {e}")
        return user  # Still explorer
    
    expiry = user.get("subscription_expiry") or user.get("subscription_expires")
    if not expiry:
        return user  # No expiry set, keep current plan
    
    try:
        if isinstance(expiry, str):
            expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
        elif isinstance(expiry, datetime):
            expiry_dt = expiry
        else:
            return user
        
        # Ensure timezone-aware comparison (MongoDB datetimes can be naive)
        if expiry_dt.tzinfo is None:
            expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
        
        now = datetime.now(timezone.utc)
        if now > expiry_dt:
            # Subscription expired → set to explorer
            logging.info(f"[SUBSCRIPTION] Expired for {uid}, setting to explorer")
            await db.users.update_one(
                {"uid": uid},
                {"$set": {
                    "subscription_plan": "explorer",
                    "subscription_expired": True,
                    "subscription_expired_at": now.isoformat(),
                    "subscription_status": "expired"
                }}
            )
            user["subscription_plan"] = "explorer"
            user["subscription_expired"] = True
            
            # Invalidate cache
            if cache:
                await cache.delete(f"user_data:{uid}")
                await cache.delete(f"user:dashboard:{uid}")
    except Exception as e:
        logging.error(f"Error checking subscription expiry: {e}")
    
    return user


async def calculate_mining_rate(user_id: str) -> dict:
    """
    LOCKED FORMULA v1.0 (April 9, 2026)
    ====================================
    Calculate user's mining rate based on Single Leg Tree.
    
    Returns:
    - base_rate: 1000 PRC/day if network < 250, else 0
    - network_rate: N × PRC_per_user(N)  [N = Single Leg Tree active users]
    - total_rate: base + network
    - per_second_rate: total / 86400
    - boost_multiplier: subscription type multiplier
    - 3-tier network cap breakdown
    
    DO NOT CHANGE network source without admin confirmation.
    """
    # Get user data
    user = await db.users.find_one({"uid": user_id}, {"_id": 0})
    if not user:
        return {"error": "User not found"}
    
    # Get L1-L5 downline counts (single BFS) + subscription network size in parallel
    # June 2026: Cap now cascades L1-L5 (Tier 4-6 added). BFS helper handles
    # mixed referred_by (uid or referral_code) for ALL levels including L1.
    from routes.growth_economy import get_downline_level_counts
    level_counts, network_size = await asyncio.gather(
        get_downline_level_counts(user_id, max_depth=5),
        get_subscription_network_size(user_id)
    )
    direct_referrals = level_counts.get("l1", 0)
    l2_count = level_counts.get("l2", 0)
    l3_count = level_counts.get("l3", 0)
    l4_count = level_counts.get("l4", 0)
    l5_count = level_counts.get("l5", 0)
    
    # Calculate 6-tier network cap (L1-L5 cascade)
    cap_info = calculate_network_cap(direct_referrals, l2_count, l3_count, l4_count, l5_count)
    network_cap = cap_info["cap"]
    
    # Limit network size to cap
    effective_network = min(network_size, network_cap)
    
    # Calculate PRC per user using new formula
    prc_per_user = calculate_prc_per_user(effective_network)
    
    # Calculate rates
    # Base rule: 1000 PRC/day if network < 250, else 0 (only network bonus)
    base_rate = BASE_MINING_PRC if effective_network < BASE_MINING_THRESHOLD else 0
    network_rate = effective_network * prc_per_user
    
    # Subscription multiplier:
    # All Elite/paid plans = 100% (PRC subscription payment deprecated April 2026)
    # Explorer = 100% (demo - shows speed but can't collect)
    subscription_plan = user.get("subscription_plan", "explorer")
    boost_multiplier = 1.0
    
    # Apply multiplier
    total_daily_rate = (base_rate + network_rate) * boost_multiplier
    per_second_rate = total_daily_rate / 86400  # 24 hours in seconds
    
    return {
        "base_rate": base_rate,
        "network_rate": round(network_rate, 2),
        "prc_per_user": round(prc_per_user, 6),
        "network_size": effective_network,
        "raw_network_size": network_size,
        "network_cap": network_cap,
        "direct_referrals": direct_referrals,
        "l1_indirect_referrals": l2_count,
        "l3_count": l3_count,
        "l4_count": l4_count,
        "l5_count": l5_count,
        "cap_tier1_base": cap_info["tier1_base"],
        "cap_tier2_bonus": cap_info["tier2_bonus"],
        "cap_tier3_bonus": cap_info["tier3_bonus"],
        "cap_tier4_bonus": cap_info["tier4_bonus"],
        "cap_tier5_bonus": cap_info["tier5_bonus"],
        "cap_tier6_bonus": cap_info["tier6_bonus"],
        "boost_multiplier": boost_multiplier,
        "subscription_type": "standard",
        "subscription_plan": subscription_plan,
        "total_daily_rate": round(total_daily_rate, 2),
        "per_second_rate": round(per_second_rate, 6),
        "final_rate": round(per_second_rate, 6)
    }


# ==================== API ENDPOINTS ====================

@router.get("/status/{uid}")
async def get_mining_status(uid: str):
    """
    Get current mining status for a user
    
    Returns session info, mined coins, mining rate, etc.
    Explorer can start sessions but cannot collect.
    """
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check subscription expiry first
        user = await check_subscription_expiry(user)
        
        # Check subscription status
        subscription_plan = user.get("subscription_plan", "explorer")
        is_elite = subscription_plan.lower() in ["elite", "vip", "startup", "growth", "pro"]
        
        # Calculate mining rate for ALL users
        rate_info = await calculate_mining_rate(uid)
        
        # ALL users (Explorer + Elite) can have active sessions
        
        # Get session info
        mining_active = user.get("mining_active", False)
        session_start = user.get("mining_start_time")
        session_end = user.get("mining_session_end")
        
        mined_coins = 0
        time_remaining = 0
        session_progress = 0
        
        if mining_active and session_start:
            now = datetime.now(timezone.utc)
            
            # Parse session times
            if isinstance(session_start, str):
                session_start = datetime.fromisoformat(session_start.replace('Z', '+00:00'))
            if isinstance(session_end, str):
                session_end = datetime.fromisoformat(session_end.replace('Z', '+00:00'))
            
            # Calculate mined coins
            elapsed_seconds = (now - session_start).total_seconds()
            mined_coins = elapsed_seconds * rate_info["per_second_rate"]
            
            # Calculate time remaining
            if session_end:
                time_remaining = max(0, (session_end - now).total_seconds())
                total_session = (session_end - session_start).total_seconds()
                session_progress = min(100, (elapsed_seconds / total_session) * 100)
            
            # Check if session expired
            if session_end and now > session_end:
                mining_active = False
                # Calculate final mined coins for expired session
                mined_coins = total_session * rate_info["per_second_rate"]
        
        # Calculate remaining hours
        remaining_hours = time_remaining / 3600 if time_remaining > 0 else 0
        
        # Compute start cooldown remaining (collect→start wait, AdMob retention)
        cooldown_remaining = 0
        next_avail_iso = user.get("next_session_available_at")
        if next_avail_iso and not mining_active:
            try:
                next_avail_dt = datetime.fromisoformat(next_avail_iso.replace('Z', '+00:00')) if isinstance(next_avail_iso, str) else next_avail_iso
                if next_avail_dt.tzinfo is None:
                    next_avail_dt = next_avail_dt.replace(tzinfo=timezone.utc)
                cooldown_remaining = max(0, int((next_avail_dt - datetime.now(timezone.utc)).total_seconds()))
            except Exception:
                cooldown_remaining = 0
        
        return {
            "mining_active": mining_active,
            "session_active": mining_active,  # Alias for frontend compatibility
            "mined_coins": round(max(0, mined_coins), 6),
            "mined_this_session": round(max(0, mined_coins), 6),  # Alias for frontend
            "mining_rate": rate_info["per_second_rate"],
            "mining_rate_per_hour": rate_info["per_second_rate"] * 3600,  # PRC per hour
            "total_daily_rate": rate_info["total_daily_rate"],
            "base_rate": rate_info["base_rate"],
            "network_rate": rate_info["network_rate"],
            "boost_multiplier": rate_info["boost_multiplier"],
            "can_start": (not mining_active) and (cooldown_remaining == 0),
            "can_collect": is_elite and mined_coins > 0,  # Only Elite can collect
            "start_cooldown_seconds": cooldown_remaining,
            "next_session_available_at": next_avail_iso if cooldown_remaining > 0 else None,
            "is_explorer": not is_elite,
            "session_start": session_start.isoformat() if isinstance(session_start, datetime) else session_start,
            "session_end": session_end.isoformat() if isinstance(session_end, datetime) else session_end,
            "time_remaining": int(time_remaining),
            "remaining_hours": round(remaining_hours, 2),  # For frontend
            "session_progress": round(session_progress, 2),
            "network_size": rate_info["network_size"],
            "network_cap": rate_info["network_cap"],
            "direct_referrals": rate_info["direct_referrals"],
            "l1_indirect_referrals": rate_info.get("l1_indirect_referrals", 0),
            "l3_count": rate_info.get("l3_count", 0),
            "l4_count": rate_info.get("l4_count", 0),
            "l5_count": rate_info.get("l5_count", 0),
            "cap_tier1_base": rate_info.get("cap_tier1_base", 800),
            "cap_tier2_bonus": rate_info.get("cap_tier2_bonus", 0),
            "cap_tier3_bonus": rate_info.get("cap_tier3_bonus", 0),
            "cap_tier4_bonus": rate_info.get("cap_tier4_bonus", 0),
            "cap_tier5_bonus": rate_info.get("cap_tier5_bonus", 0),
            "cap_tier6_bonus": rate_info.get("cap_tier6_bonus", 0),
            "prc_per_user": rate_info["prc_per_user"],
            "subscription_type": rate_info["subscription_type"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Mining status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start/{uid}")
async def start_mining(uid: str):
    """Start a new mining session - Explorer and Elite both can start"""
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check subscription expiry
        user = await check_subscription_expiry(user)
        
        # Explorer and Elite both can start sessions (no elite check)
        
        # Check if already mining (but allow if session expired)
        if user.get("mining_active"):
            session_end = user.get("mining_session_end")
            if session_end:
                # Parse session end time
                if isinstance(session_end, str):
                    session_end = datetime.fromisoformat(session_end.replace('Z', '+00:00'))
                
                # If session expired, auto-collect and allow new session
                now = datetime.now(timezone.utc)
                if now > session_end:
                    # Session expired - auto-reset (user should collect first)
                    logging.info(f"[MINING] Session expired for {uid}, auto-resetting")
                    await db.users.update_one(
                        {"uid": uid},
                        {"$set": {"mining_active": False}}
                    )
                else:
                    # Session still active
                    raise HTTPException(
                        status_code=400,
                        detail="Mining session already active"
                    )
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Mining session already active"
                )
        
        now = datetime.now(timezone.utc)
        
        # Enforce 60-second cooldown between collect and next session (AdMob retention)
        next_avail = user.get("next_session_available_at")
        if next_avail:
            try:
                if isinstance(next_avail, str):
                    next_avail_dt = datetime.fromisoformat(next_avail.replace('Z', '+00:00'))
                else:
                    next_avail_dt = next_avail
                if next_avail_dt.tzinfo is None:
                    next_avail_dt = next_avail_dt.replace(tzinfo=timezone.utc)
                if now < next_avail_dt:
                    remaining = int((next_avail_dt - now).total_seconds())
                    raise HTTPException(
                        status_code=429,
                        detail=f"Please wait {remaining}s before starting the next session"
                    )
            except HTTPException:
                raise
            except Exception:
                pass  # Bad data - allow start
        
        session_end = now + timedelta(hours=SESSION_DURATION_HOURS)
        
        # Start session
        await db.users.update_one(
            {"uid": uid},
            {
                "$set": {
                    "mining_active": True,
                    "mining_start_time": now.isoformat(),
                    "mining_session_end": session_end.isoformat(),
                    "last_mining_action": now.isoformat(),
                    "next_session_available_at": None
                }
            }
        )
        
        # Invalidate user data cache
        if cache:
            await cache.delete(f"user_data:{uid}")
            await cache.delete(f"user:dashboard:{uid}")
        
        # Get rate info
        rate_info = await calculate_mining_rate(uid)
        
        return {
            "success": True,
            "message": "Mining session started",
            "session_start": now.isoformat(),
            "session_end": session_end.isoformat(),
            "duration_hours": SESSION_DURATION_HOURS,
            "mining_rate": rate_info["per_second_rate"],
            "total_daily_rate": rate_info["total_daily_rate"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Start mining error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collect/{uid}")
async def collect_mining(uid: str, current_user: dict = Depends(_require_authenticated_user)):
    """Collect mined PRC from current session.

    SECURITY (Jun 24, 2026): bound to `get_current_user`. The path `uid`
    MUST match the authenticated user — otherwise we 403. This prevents
    an attacker who knows another user's uid from collecting on their
    behalf (which, given the explorer-burn flow, could be used to grief
    a user by forcing premature session end + burn).

    Elite-tier users: mined PRC is credited to wallet.
    Explorer-tier users: mined PRC is BURNED immediately (not credited).
        Their session still ends and cooldown starts, and they can still
        earn the +5-10 ad bonus afterwards which IS credited normally
        via /api/ads/rewarded/credit. This lets free users participate
        in the rewarded-ad funnel while monetised PRC remains an Elite
        benefit. Burns are recorded in prc_ledger as DEBIT entries so
        users see exactly what happened on their PRC Statement.
    """
    if current_user.get("uid") != uid:
        raise HTTPException(
            status_code=403,
            detail="You can only collect on your own account."
        )
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check subscription expiry
        user = await check_subscription_expiry(user)
        
        # Plan / tier detection — Explorer if BOTH plan and membership are
        # explorer (or missing). This dual-field check matches the rest of
        # the codebase's tier signaling.
        subscription_plan = (user.get("subscription_plan") or "explorer").lower()
        membership_type = (user.get("membership_type") or "explorer").lower()
        ELITE_PLANS = {"elite", "vip", "startup", "growth", "pro"}
        is_elite = (subscription_plan in ELITE_PLANS) or (membership_type in ELITE_PLANS)
        
        session_start = user.get("mining_start_time")
        session_end = user.get("mining_session_end")
        
        if not session_start:
            raise HTTPException(
                status_code=400,
                detail="No active mining session"
            )
        
        now = datetime.now(timezone.utc)
        
        # Parse times
        if isinstance(session_start, str):
            session_start = datetime.fromisoformat(session_start.replace('Z', '+00:00'))
        if isinstance(session_end, str):
            session_end = datetime.fromisoformat(session_end.replace('Z', '+00:00'))
        
        # Calculate mined coins
        rate_info = await calculate_mining_rate(uid)
        
        if session_end and now > session_end:
            # Session expired - calculate for full session
            elapsed_seconds = (session_end - session_start).total_seconds()
        else:
            # Session still active
            elapsed_seconds = (now - session_start).total_seconds()
        
        mined_coins = round(elapsed_seconds * rate_info["per_second_rate"], 6)
        
        if mined_coins <= 0:
            raise HTTPException(
                status_code=400,
                detail="No coins to collect"
            )
        
        # Credit PRC to wallet — but ONLY for Elite users.
        # For Explorer users, the wallet is left untouched (the mined PRC
        # is burned). We still end the session and start the cooldown so
        # the ad-bonus funnel proceeds identically for both tiers.
        current_balance = user.get("prc_balance", 0)
        if is_elite:
            new_balance = round(current_balance + mined_coins, 6)
        else:
            new_balance = current_balance  # burn — wallet unchanged
        
        # NOTE: Do NOT auto-start a new session. User must manually click "Start Session"
        # after a 60-second cooldown (drives AdMob impression RPM by keeping user in app).
        cooldown_until = now + timedelta(seconds=COLLECT_TO_START_COOLDOWN_SECONDS)
        
        # Update user: credit PRC (Elite only) + stop mining + record collect time for cooldown.
        # `total_mined_*` counters are still bumped for Explorer so analytics see the
        # mined volume even though the PRC was burned at collect time.
        user_set = {
            "mining_active": False,
            "mining_start_time": None,
            "mining_session_end": None,
            "last_mining_collect": now.isoformat(),
            "next_session_available_at": cooldown_until.isoformat(),
            "last_mining_action": now.isoformat(),
        }
        if is_elite:
            user_set["prc_balance"] = new_balance

        await db.users.update_one(
            {"uid": uid},
            {
                "$set": user_set,
                "$inc": {
                    "total_mined_prc": mined_coins,
                    "total_mined": mined_coins,
                },
            },
        )
        
        # Record transaction (legacy `transactions` collection — kept for
        # backward compatibility; PRC Statement is sourced from prc_ledger).
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": uid,
            "type": "credit" if is_elite else "burn",
            "amount": mined_coins,
            "transaction_type": "mining" if is_elite else "mining_burn",
            "description": "Mining session collection" if is_elite else "Explorer plan — session PRC burned",
            "balance_after": new_balance,
            "timestamp": now.isoformat()
        })

        # ── PRC LEDGER entry ─────────────────────────────────────────
        # Elite: CREDIT entry (mining_collect).
        # Explorer: DEBIT entry (mining_session_burn). The wallet itself
        # didn't move, so balance_before == balance_after — this makes
        # the row read clearly as "you mined this, but it was burned".
        try:
            await db.prc_ledger.insert_one({
                "txn_id": str(uuid.uuid4()),
                "user_id": uid,
                "type": "mining_collect" if is_elite else "mining_session_burn",
                "entry_type": "credit" if is_elite else "debit",
                "amount": mined_coins if is_elite else -mined_coins,
                "balance_before": round(current_balance, 2),
                "balance_after": round(new_balance, 2),
                "reference": now.isoformat(),
                "service_type": "main_mining",
                "service_label": "Main Mining",
                "service_ref_id": now.isoformat(),
                "description": (
                    f"Main Mining session collected — +{mined_coins:.4f} PRC"
                    if is_elite
                    else f"Explorer plan — session PRC burned ({mined_coins:.4f} PRC)"
                ),
                "timestamp": now.isoformat(),
                "created_at": now.isoformat(),
            })
        except Exception as _ledger_err:
            logging.error(f"[MINING] PRC ledger write failed: {_ledger_err}")

        # Pool wallet + employee pool credits are tied to mined volume,
        # not to whether the user kept their PRC. They run for both tiers.
        try:
            from routes.pool_wallet import credit_pool_wallet
            await credit_pool_wallet(uid, mined_coins, user.get("name", ""))
        except Exception as pool_err:
            logging.error(f"[MINING] Pool wallet credit error: {pool_err}")
        
        try:
            from routes.employee_management import credit_employee_pool
            await credit_employee_pool(mined_coins, uid, user.get("name", ""))
        except Exception as emp_pool_err:
            logging.error(f"[MINING] Employee pool credit error: {emp_pool_err}")
        
        # Invalidate ALL user-related caches so all pages see updated balance
        if cache:
            await cache.delete(f"user_data:{uid}")
            await cache.delete(f"user:dashboard:{uid}")
        
        return {
            "success": True,
            "message": (
                f"Collected {mined_coins:.4f} PRC"
                if is_elite
                else "Session ended. Watch ad below for bonus PRC."
            ),
            "collected_amount": mined_coins,
            "new_balance": new_balance,
            "burned": (not is_elite),
            "tier": "elite" if is_elite else "explorer",
            "session_duration_seconds": elapsed_seconds,
            "auto_started": False,
            "cooldown_seconds": COLLECT_TO_START_COOLDOWN_SECONDS,
            "next_session_available_at": cooldown_until.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Collect mining error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/claim/{uid}")
async def claim_mining(uid: str):
    """Alias for collect - for backward compatibility"""
    return await collect_mining(uid)


@router.get("/rate-breakdown/{uid}")
async def get_rate_breakdown(uid: str):
    """
    Get detailed breakdown of mining rate calculation
    
    Shows Growth Economy formula components
    """
    try:
        rate_info = await calculate_mining_rate(uid)
        
        if "error" in rate_info:
            raise HTTPException(status_code=404, detail=rate_info["error"])
        
        return {
            "formula": "PRC_per_user = max(2.5, 5 × (21 - log₂(N)) / 14)",
            "daily_formula": f"Daily PRC = {rate_info['base_rate']} + (N × PRC_per_user) [Base=1000 if network<250, else 0]",
            "network_cap_formula": "min(8000, 800 + 16*L1 + 5*L2 + 3*L3 + 2*L4 + 1*L5)",
            "base_rate": rate_info["base_rate"],
            "network_size": rate_info["network_size"],
            "raw_network_size": rate_info.get("raw_network_size", rate_info["network_size"]),
            "network_cap": rate_info["network_cap"],
            "cap_tier1_base": rate_info.get("cap_tier1_base", 800),
            "cap_tier2_bonus": rate_info.get("cap_tier2_bonus", 0),
            "cap_tier3_bonus": rate_info.get("cap_tier3_bonus", 0),
            "cap_tier4_bonus": rate_info.get("cap_tier4_bonus", 0),
            "cap_tier5_bonus": rate_info.get("cap_tier5_bonus", 0),
            "cap_tier6_bonus": rate_info.get("cap_tier6_bonus", 0),
            "prc_per_user": rate_info["prc_per_user"],
            "network_rate": rate_info["network_rate"],
            "boost_multiplier": rate_info["boost_multiplier"],
            "subscription_type": rate_info["subscription_type"],
            "total_daily_rate": rate_info["total_daily_rate"],
            "final_rate": rate_info["per_second_rate"],
            "direct_referrals": rate_info["direct_referrals"],
            "l1_indirect_referrals": rate_info.get("l1_indirect_referrals", 0),
            "l3_count": rate_info.get("l3_count", 0),
            "l4_count": rate_info.get("l4_count", 0),
            "l5_count": rate_info.get("l5_count", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Rate breakdown error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============================================================================
# DIAGNOSTIC — Compare mining rates across users (admin only)
# ----------------------------------------------------------------------------
# Added May 11, 2026 in response to "all users show 50.1 PRC/hour" report.
# Returns per-user rate breakdown so admin can verify whether rates are
# actually uniform or merely *look* similar in the UI.
# ============================================================================
@router.get("/admin/rates-diagnostic")
async def admin_mining_rates_diagnostic(limit: int = 30, plan: str = "elite"):
    """For every Elite-active user, dump the network + cap + per-user PRC.
    Helps spot the case where many users share the same effective_network
    (capped at 800) → same mining rate.
    """
    try:
        now = datetime.now(timezone.utc).isoformat()
        users = await db.users.find(
            {
                "subscription_plan": {"$in": [plan.lower(), plan.upper(), plan.title()]},
                "$or": [
                    {"subscription_expiry": {"$gt": now}},
                    {"subscription_expires": {"$gt": now}},
                ],
            },
            {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "subscription_position": 1}
        ).limit(limit).to_list(length=limit)

        rows = []
        unique_rates = set()
        for u in users:
            try:
                rate = await calculate_mining_rate(u["uid"])
                if rate.get("error"):
                    continue
                per_hour = round(rate["per_second_rate"] * 3600, 2)
                unique_rates.add(per_hour)
                rows.append({
                    "uid": u["uid"],
                    "name": u.get("name"),
                    "mobile": u.get("mobile"),
                    "subscription_position": u.get("subscription_position"),
                    "raw_network_size": rate.get("raw_network_size"),
                    "network_cap": rate.get("network_cap"),
                    "effective_network": rate.get("network_size"),
                    "direct_referrals": rate.get("direct_referrals"),
                    "l1_indirect_referrals": rate.get("l1_indirect_referrals"),
                    "base_rate": rate.get("base_rate"),
                    "network_rate": rate.get("network_rate"),
                    "total_daily_rate": rate.get("total_daily_rate"),
                    "per_hour": per_hour,
                })
            except Exception as e:
                logging.warning(f"diagnostic error for {u['uid']}: {e}")

        return {
            "success": True,
            "users_checked": len(rows),
            "unique_rates_count": len(unique_rates),
            "unique_rates": sorted(unique_rates),
            "is_suspiciously_uniform": len(unique_rates) <= 2 and len(rows) >= 5,
            "rows": rows,
        }
    except Exception as e:
        logging.error(f"Mining rates diagnostic error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/history/{uid}")
async def get_mining_history(uid: str, limit: int = 20):
    """Get mining collection history"""
    try:
        history = await db.transactions.find(
            {"user_id": uid, "transaction_type": "mining"},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        return {
            "history": history,
            "count": len(history)
        }
    except Exception as e:
        logging.error(f"Mining history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
