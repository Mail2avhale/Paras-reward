"""
Mining Routes - GROWTH ECONOMY SYSTEM (March 2026)
====================================================

Mining Formula:
- Base: 500 PRC/day
- Team Bonus: N × PRC_per_user(N)
- PRC_per_user(N) = max(2.5, 5 × (21 - log₂(N)) / 14)

Network Cap:
- 0 direct referrals → 800 users cap
- ≥1 direct referral → 4000 users cap

Subscription Speed:
- Explorer: Shows speed (demo), CANNOT collect
- Elite (Razorpay/Manual): 100% speed
- Elite (PRC payment): 70% speed
"""

import math
import logging
import time
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

BASE_MINING_PRC = 500  # Base daily PRC (user's own mining)
MIN_PRC_PER_USER = 2.5  # Minimum PRC per user at 16384 network
NETWORK_CAP_NO_REFERRAL = 800  # Cap when 0 direct referrals
NETWORK_CAP_WITH_REFERRAL = 4000  # Cap when ≥1 direct referral
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


def calculate_network_cap(direct_referrals: int) -> int:
    """
    Calculate maximum network capacity based on direct referrals
    
    Formula: NetworkCap = min(4000, 800 + 16 × D)
    - 0 referrals → 800
    - 1 referral → 816
    - 2 referrals → 832
    - ...
    - 200 referrals → 4000 (cap)
    """
    cap = 800 + (16 * direct_referrals)
    return min(4000, cap)


async def check_subscription_expiry(user: dict) -> dict:
    """
    Check if user's subscription has expired.
    If expired, auto-set to explorer and return updated user dict.
    Returns the (possibly updated) user dict.
    """
    if not user:
        return user
    
    plan = user.get("subscription_plan", "explorer")
    if plan.lower() in ["explorer", "free", ""]:
        return user  # Already explorer, nothing to check
    
    expiry = user.get("subscription_expiry") or user.get("subscription_expires")
    if not expiry:
        return user  # No expiry set
    
    try:
        if isinstance(expiry, str):
            expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
        elif isinstance(expiry, datetime):
            expiry_dt = expiry
        else:
            return user
        
        now = datetime.now(timezone.utc)
        if now > expiry_dt:
            # Subscription expired → set to explorer
            uid = user.get("uid")
            logging.info(f"[SUBSCRIPTION] Expired for {uid}, setting to explorer")
            await db.users.update_one(
                {"uid": uid},
                {"$set": {
                    "subscription_plan": "explorer",
                    "subscription_expired": True,
                    "subscription_expired_at": now.isoformat()
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


# In-memory cache for network size (TTL: 5 minutes)
_network_cache = {}
NETWORK_CACHE_TTL = 300  # 5 minutes


async def get_network_size(user_id: str) -> int:
    """
    Get ACTIVE network size for mining rate calculation.
    Active = Elite + mining_active + session not expired.
    Uses batched BFS + in-memory cache (5 min TTL).
    """
    # Check cache first
    cache_key = f"active_{user_id}"
    cached = _network_cache.get(cache_key)
    if cached and (time.time() - cached["ts"]) < NETWORK_CACHE_TTL:
        return cached["val"]
    
    try:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        # Get all UIDs in network (use cached tree if available)
        all_uids = await _get_network_uids(user_id)
        
        if not all_uids:
            _network_cache[cache_key] = {"val": 0, "ts": time.time()}
            return 0
        
        # Single query to count active users
        uid_list = list(all_uids)[:NETWORK_CAP_WITH_REFERRAL]
        active_count = await db.users.count_documents({
            "uid": {"$in": uid_list},
            "subscription_plan": {"$in": ["elite", "vip", "startup", "growth", "pro", "Elite", "VIP"]},
            "mining_active": True,
            "mining_session_end": {"$gt": now_iso}
        })
        
        _network_cache[cache_key] = {"val": active_count, "ts": time.time()}
        return active_count
    except Exception as e:
        logging.error(f"Error getting network size: {e}")
        return 0


async def _get_network_uids(user_id: str) -> set:
    """Get all UIDs in a user's network tree. Cached for 5 minutes."""
    cache_key = f"tree_{user_id}"
    cached = _network_cache.get(cache_key)
    if cached and (time.time() - cached["ts"]) < NETWORK_CACHE_TTL:
        return cached["val"]
    
    all_uids = set()
    current_level = {user_id}
    
    while current_level and len(all_uids) < NETWORK_CAP_WITH_REFERRAL:
        all_uids.update(current_level)
        remaining = NETWORK_CAP_WITH_REFERRAL - len(all_uids)
        if remaining <= 0:
            break
        next_docs = await db.users.find(
            {"referred_by": {"$in": list(current_level)}},
            {"uid": 1, "_id": 0}
        ).to_list(remaining + 100)
        next_level = {d["uid"] for d in next_docs if d.get("uid") and d["uid"] not in all_uids}
        if not next_level:
            break
        current_level = next_level
    
    all_uids.discard(user_id)
    _network_cache[cache_key] = {"val": all_uids, "ts": time.time()}
    return all_uids


async def calculate_mining_rate(user_id: str) -> dict:
    """
    Calculate user's mining rate based on Growth Economy formulas.
    Uses cached network stats from user document for instant response.
    Network stats refreshed every 30 minutes max.
    """
    user = await db.users.find_one({"uid": user_id}, {"_id": 0})
    if not user:
        return {"error": "User not found"}
    
    # Get direct referrals count (fast - uses index)
    direct_referrals = await db.users.count_documents({"referred_by": user_id})
    
    # Get network size — use cached value from user doc if fresh enough
    REFRESH_INTERVAL = 1800  # 30 minutes
    cached_network = user.get("_cached_network_size")
    cached_at = user.get("_cached_network_at", "")
    need_refresh = True
    network_size = 0
    
    if cached_network is not None and cached_at:
        try:
            cached_dt = datetime.fromisoformat(str(cached_at).replace('Z', '+00:00'))
            age = (datetime.now(timezone.utc) - cached_dt).total_seconds()
            if age < REFRESH_INTERVAL:
                network_size = cached_network
                need_refresh = False
        except Exception:
            pass
    
    if need_refresh:
        network_size = await get_network_size(user_id)
        # Store in user document for future fast lookups
        try:
            await db.users.update_one(
                {"uid": user_id},
                {"$set": {
                    "_cached_network_size": network_size,
                    "_cached_network_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        except Exception as e:
            logging.warning(f"Cache update failed for {user_id}: {e}")
    
    # Calculate network cap
    network_cap = calculate_network_cap(direct_referrals)
    effective_network = min(network_size, network_cap)
    prc_per_user = calculate_prc_per_user(effective_network)
    
    base_rate = BASE_MINING_PRC
    network_rate = effective_network * prc_per_user
    
    subscription_plan = user.get("subscription_plan", "explorer")
    subscription_payment_type = user.get("subscription_payment_type", "cash")
    is_elite = subscription_plan.lower() in ["elite", "vip", "startup", "growth", "pro"]
    
    if is_elite and subscription_payment_type == "prc":
        boost_multiplier = 0.70
    else:
        boost_multiplier = 1.0
    
    total_daily_rate = (base_rate + network_rate) * boost_multiplier
    per_second_rate = total_daily_rate / 86400
    
    return {
        "base_rate": base_rate,
        "network_rate": round(network_rate, 2),
        "prc_per_user": round(prc_per_user, 6),
        "network_size": effective_network,
        "network_cap": network_cap,
        "direct_referrals": direct_referrals,
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
                    "total_mined_prc": mined_coins
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
            "daily_formula": "Daily PRC = 500 + (N × PRC_per_user)",
            "network_cap_formula": "0 refs → 800, ≥1 ref → 4000",
            "base_rate": rate_info["base_rate"],
            "network_size": rate_info["network_size"],
            "network_cap": rate_info["network_cap"],
            "prc_per_user": rate_info["prc_per_user"],
            "network_rate": rate_info["network_rate"],
            "boost_multiplier": rate_info["boost_multiplier"],
            "subscription_type": rate_info["subscription_type"],
            "total_daily_rate": rate_info["total_daily_rate"],
            "final_rate": rate_info["per_second_rate"],
            "direct_referrals": rate_info["direct_referrals"]
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
