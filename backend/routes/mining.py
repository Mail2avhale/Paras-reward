"""
Mining Routes - GROWTH ECONOMY SYSTEM (March 2026)
====================================================

Mining Formula:
- Base: 500 PRC/day
- Team Bonus: N × PRC_per_user(N)
- PRC_per_user(N) = max(2.5, 5 × (21 - log₂(N)) / 14)

3-Tier Network Cap:
- Tier 1 (Base/Single Leg): 800 cap (everyone starts here)
- Tier 2 (Direct Referrals): +16 per direct referral, up to 4000
- Tier 3 (L1 Indirect Referrals): +5 per L1 indirect, up to 6000
- Formula: min(6000, 800 + 16×D + 5×L1)

Subscription Speed:
- Explorer: Shows speed (demo), CANNOT collect
- Elite (Razorpay/Manual): 100% speed
- Elite (PRC payment): 70% speed
"""

import math
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import asyncio
import uuid

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
NETWORK_CAP_DIRECT_MAX = 4000  # Tier 2: Max cap from direct referrals
NETWORK_CAP_MAX = 6000  # Tier 3: Max cap from L1 indirect referrals
CAP_PER_DIRECT = 16  # +16 cap per direct referral
CAP_PER_L1_INDIRECT = 5  # +5 cap per L1 indirect referral
SESSION_DURATION_HOURS = 24  # Mining session duration


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


def calculate_network_cap(direct_referrals: int, l1_indirect_referrals: int = 0) -> dict:
    """
    3-Tier Network Cap Formula:
    
    Tier 1 (Base): 800 cap (everyone)
    Tier 2 (Direct): +16 per direct referral → max 4000
    Tier 3 (L1 Indirect): +5 per L1 indirect → max 6000
    
    Formula: min(6000, 800 + 16×D + 5×L1)
    
    Examples:
    - 0 directs, 0 L1 → 800
    - 10 directs, 0 L1 → 960
    - 200 directs, 0 L1 → 4000 (Tier 2 capped)
    - 200 directs, 400 L1 → 6000 (Tier 3 capped)
    """
    tier1 = NETWORK_CAP_BASE  # 800
    tier2_bonus = CAP_PER_DIRECT * direct_referrals  # 16 × D
    tier3_bonus = CAP_PER_L1_INDIRECT * l1_indirect_referrals  # 5 × L1
    
    raw_cap = tier1 + tier2_bonus + tier3_bonus
    final_cap = min(NETWORK_CAP_MAX, raw_cap)
    
    return {
        "cap": final_cap,
        "tier1_base": tier1,
        "tier2_bonus": min(tier2_bonus, NETWORK_CAP_DIRECT_MAX - NETWORK_CAP_BASE),
        "tier3_bonus": min(tier3_bonus, NETWORK_CAP_MAX - NETWORK_CAP_DIRECT_MAX),
        "direct_referrals": direct_referrals,
        "l1_indirect_referrals": l1_indirect_referrals
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


async def get_network_size(user_id: str) -> int:
    """
    Get total ACTIVE network size for a user using Single Leg Tree.
    
    Single Leg: All users arranged by joining date.
    User's network = all ACTIVE users who joined AFTER them.
    Active user = Elite subscription + active mining session (not expired).
    
    Uses tree_position for efficient single-query lookup.
    """
    try:
        now = datetime.now(timezone.utc)
        now_str = now.isoformat()
        
        # Get user's tree position
        user = await db.users.find_one(
            {"uid": user_id},
            {"_id": 0, "tree_position": 1}
        )
        if not user or not user.get("tree_position"):
            return 0
        
        my_position = user["tree_position"]
        
        # Count ACTIVE users below this user in single leg tree
        # Handle both string and datetime formats for mining_session_end
        active_filter = {
            "tree_position": {"$gt": my_position},
            "subscription_plan": {"$in": ["elite", "vip", "startup", "growth", "pro", "Elite", "VIP", "Startup", "Growth", "Pro"]},
            "mining_active": True,
            "$or": [
                {"mining_session_end": {"$gt": now_str}},
                {"mining_session_end": {"$gt": now}},
                {"mining_session_end": {"$exists": False}},
                {"mining_session_end": None}
            ]
        }
        
        total_count = await db.users.count_documents(active_filter)
        return total_count
    except Exception as e:
        logging.error(f"Error getting network size: {e}")
        return 0


async def get_l1_indirect_count(user_id: str) -> int:
    """
    Count L1 Indirect Referrals = users referred by user's direct referrals.
    Efficient: Only fetches UIDs, then counts.
    """
    try:
        # Step 1: Get UIDs of direct referrals
        direct_uids = await db.users.distinct("uid", {"referred_by": user_id})
        if not direct_uids:
            return 0
        # Step 2: Count users referred by those direct referrals
        l1_count = await db.users.count_documents({"referred_by": {"$in": direct_uids}})
        return l1_count
    except Exception as e:
        logging.error(f"Error counting L1 indirects for {user_id}: {e}")
        return 0


async def calculate_mining_rate(user_id: str) -> dict:
    """
    Calculate user's mining rate based on Growth Economy formulas
    
    Returns:
    - base_rate: 1000 PRC/day if network < 250, else 0
    - network_rate: N × PRC_per_user(N)
    - total_rate: base + network
    - per_second_rate: total / 86400
    - boost_multiplier: subscription type multiplier
    - 3-tier network cap breakdown
    """
    # Get user data
    user = await db.users.find_one({"uid": user_id}, {"_id": 0})
    if not user:
        return {"error": "User not found"}
    
    # Get direct referrals count + L1 indirect count in parallel
    direct_referrals, l1_indirect_referrals, network_size = await asyncio.gather(
        db.users.count_documents({"referred_by": user_id}),
        get_l1_indirect_count(user_id),
        get_network_size(user_id)
    )
    
    # Calculate 3-tier network cap
    cap_info = calculate_network_cap(direct_referrals, l1_indirect_referrals)
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
    # Elite via Razorpay/Manual = 100%, Elite via PRC = 70%
    # Explorer = 100% (demo - shows speed but can't collect)
    subscription_plan = user.get("subscription_plan", "explorer")
    subscription_payment_type = user.get("subscription_payment_type", "cash")
    is_elite = subscription_plan.lower() in ["elite", "vip", "startup", "growth", "pro"]
    
    if is_elite and subscription_payment_type == "prc":
        boost_multiplier = 0.70
    else:
        boost_multiplier = 1.0  # Cash/Razorpay/Manual Elite OR Explorer (demo)
    
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
        "l1_indirect_referrals": l1_indirect_referrals,
        "cap_tier1_base": cap_info["tier1_base"],
        "cap_tier2_bonus": cap_info["tier2_bonus"],
        "cap_tier3_bonus": cap_info["tier3_bonus"],
        "boost_multiplier": boost_multiplier,
        "subscription_type": subscription_payment_type,
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
            "can_start": not mining_active,  # All users can start (Explorer + Elite)
            "can_collect": is_elite and mined_coins > 0,  # Only Elite can collect
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
            "cap_tier1_base": rate_info.get("cap_tier1_base", 800),
            "cap_tier2_bonus": rate_info.get("cap_tier2_bonus", 0),
            "cap_tier3_bonus": rate_info.get("cap_tier3_bonus", 0),
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
        session_end = now + timedelta(hours=SESSION_DURATION_HOURS)
        
        # Start session
        await db.users.update_one(
            {"uid": uid},
            {
                "$set": {
                    "mining_active": True,
                    "mining_start_time": now.isoformat(),
                    "mining_session_end": session_end.isoformat(),
                    "last_mining_action": now.isoformat()
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
async def collect_mining(uid: str):
    """Collect mined PRC from current session - Elite only"""
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check subscription expiry
        user = await check_subscription_expiry(user)
        
        # Only Elite users can collect
        subscription_plan = user.get("subscription_plan", "explorer")
        is_elite = subscription_plan.lower() in ["elite", "vip", "startup", "growth", "pro"]
        if not is_elite:
            raise HTTPException(
                status_code=403,
                detail="Elite subscription required to collect PRC. Upgrade to collect!"
            )
        
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
        
        # Credit PRC to user
        current_balance = user.get("prc_balance", 0)
        new_balance = round(current_balance + mined_coins, 6)
        
        # Auto-start new session after collect
        new_session_start = now
        new_session_end = now + timedelta(hours=SESSION_DURATION_HOURS)
        
        # Update user: credit PRC + start new session in one atomic operation
        await db.users.update_one(
            {"uid": uid},
            {
                "$set": {
                    "prc_balance": new_balance,
                    "mining_active": True,
                    "mining_start_time": new_session_start.isoformat(),
                    "mining_session_end": new_session_end.isoformat(),
                    "last_mining_collect": now.isoformat(),
                    "last_mining_action": now.isoformat()
                },
                "$inc": {
                    "total_mined_prc": mined_coins,
                    "total_mined": mined_coins
                }
            }
        )
        
        # Record transaction
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": uid,
            "type": "credit",
            "amount": mined_coins,
            "transaction_type": "mining",
            "description": "Mining session collection",
            "balance_after": new_balance,
            "timestamp": now.isoformat()
        })
        
        # Invalidate ALL user-related caches so all pages see updated balance
        if cache:
            await cache.delete(f"user_data:{uid}")
            await cache.delete(f"user:dashboard:{uid}")
        
        return {
            "success": True,
            "message": f"Collected {mined_coins:.4f} PRC",
            "collected_amount": mined_coins,
            "new_balance": new_balance,
            "session_duration_seconds": elapsed_seconds,
            "auto_started": True,
            "new_session_start": new_session_start.isoformat(),
            "new_session_end": new_session_end.isoformat()
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
            "network_cap_formula": "min(6000, 800 + 16×D + 5×L1)",
            "base_rate": rate_info["base_rate"],
            "network_size": rate_info["network_size"],
            "raw_network_size": rate_info.get("raw_network_size", rate_info["network_size"]),
            "network_cap": rate_info["network_cap"],
            "cap_tier1_base": rate_info.get("cap_tier1_base", 800),
            "cap_tier2_bonus": rate_info.get("cap_tier2_bonus", 0),
            "cap_tier3_bonus": rate_info.get("cap_tier3_bonus", 0),
            "prc_per_user": rate_info["prc_per_user"],
            "network_rate": rate_info["network_rate"],
            "boost_multiplier": rate_info["boost_multiplier"],
            "subscription_type": rate_info["subscription_type"],
            "total_daily_rate": rate_info["total_daily_rate"],
            "final_rate": rate_info["per_second_rate"],
            "direct_referrals": rate_info["direct_referrals"],
            "l1_indirect_referrals": rate_info.get("l1_indirect_referrals", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Rate breakdown error: {e}")
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
