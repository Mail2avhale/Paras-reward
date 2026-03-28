"""
Mining Routes - NEW GROWTH ECONOMY SYSTEM (March 2026)
=======================================================

Mining Formula (Per User - Decreasing):
- R(U) = max(3, 8 - 0.5 × log₂(U))
- Daily PRC = 550 + (U × R(U))

Network Cap Formula:
- NetworkCap = min(4000, 800 + 16×D)

Subscription Multiplier:
- Cash Payment: 100% mining speed
- PRC Payment: 70% mining speed
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

BASE_MINING_PRC = 550  # Base daily PRC
MIN_PRC_PER_USER = 3  # Minimum PRC per network user
MAX_PRC_PER_USER = 8  # Maximum PRC per network user (early users)
NETWORK_CAP_BASE = 800  # Base network capacity
NETWORK_CAP_PER_REFERRAL = 16  # Capacity increase per direct referral
MAX_NETWORK_CAP = 4000  # Maximum network capacity
SESSION_DURATION_HOURS = 24  # Mining session duration


# ==================== HELPER FUNCTIONS ====================

def calculate_prc_per_user(network_size: int) -> float:
    """
    Calculate PRC per user based on network size (Decreasing formula)
    
    Formula: R(U) = max(3, 8 - 0.5 × log₂(U))
    
    As network grows, PRC per user decreases
    """
    if network_size <= 0:
        return MAX_PRC_PER_USER
    
    log_value = math.log2(max(1, network_size))
    prc_per_user = MAX_PRC_PER_USER - (0.5 * log_value)
    
    return max(MIN_PRC_PER_USER, round(prc_per_user, 4))


def calculate_network_cap(direct_referrals: int) -> int:
    """
    Calculate maximum network capacity based on direct referrals
    
    Formula: NetworkCap = min(4000, 800 + 16 × D)
    """
    cap = NETWORK_CAP_BASE + (NETWORK_CAP_PER_REFERRAL * direct_referrals)
    return min(MAX_NETWORK_CAP, cap)


async def get_network_size(user_id: str) -> int:
    """Get total network size for a user (all downstream referrals)"""
    try:
        visited = set()
        queue = [user_id]
        total_count = 0
        
        while queue and len(visited) < MAX_NETWORK_CAP:
            current_user = queue.pop(0)
            if current_user in visited:
                continue
            visited.add(current_user)
            
            referrals = await db.users.find(
                {"referred_by": current_user},
                {"uid": 1, "_id": 0}
            ).to_list(500)
            
            for ref in referrals:
                ref_uid = ref.get("uid")
                if ref_uid and ref_uid not in visited:
                    queue.append(ref_uid)
                    total_count += 1
        
        return total_count
    except Exception as e:
        logging.error(f"Error getting network size: {e}")
        return 0


async def calculate_mining_rate(user_id: str) -> dict:
    """
    Calculate user's mining rate based on Growth Economy formulas
    
    Returns:
    - base_rate: 550 PRC/day (base)
    - network_rate: U × R(U) PRC/day
    - total_rate: base + network
    - per_second_rate: total / 86400
    - boost_multiplier: subscription type multiplier
    """
    # Get user data
    user = await db.users.find_one({"uid": user_id}, {"_id": 0})
    if not user:
        return {"error": "User not found"}
    
    # Get direct referrals count
    direct_referrals = await db.users.count_documents({"referred_by": user_id})
    
    # Get network size
    network_size = await get_network_size(user_id)
    
    # Calculate network cap
    network_cap = calculate_network_cap(direct_referrals)
    
    # Limit network size to cap
    effective_network = min(network_size, network_cap)
    
    # Calculate PRC per user
    prc_per_user = calculate_prc_per_user(effective_network)
    
    # Calculate rates
    base_rate = BASE_MINING_PRC
    network_rate = effective_network * prc_per_user
    
    # Subscription multiplier (Cash = 100%, PRC = 70%)
    subscription_type = user.get("subscription_payment_type", "cash")
    boost_multiplier = 0.70 if subscription_type == "prc" else 1.0
    
    # Apply multiplier
    total_daily_rate = (base_rate + network_rate) * boost_multiplier
    per_second_rate = total_daily_rate / 86400  # 24 hours in seconds
    
    return {
        "base_rate": base_rate,
        "network_rate": round(network_rate, 2),
        "prc_per_user": prc_per_user,
        "network_size": effective_network,
        "network_cap": network_cap,
        "direct_referrals": direct_referrals,
        "boost_multiplier": boost_multiplier,
        "subscription_type": subscription_type,
        "total_daily_rate": round(total_daily_rate, 2),
        "per_second_rate": round(per_second_rate, 6),
        "final_rate": round(per_second_rate, 6)  # Alias for compatibility
    }


# ==================== API ENDPOINTS ====================

@router.get("/status/{uid}")
async def get_mining_status(uid: str):
    """
    Get current mining status for a user
    
    Returns session info, mined coins, mining rate, etc.
    """
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check subscription status
        subscription_plan = user.get("subscription_plan", "explorer")
        is_elite = subscription_plan.lower() in ["elite", "vip", "startup", "growth", "pro"]
        
        if not is_elite:
            return {
                "mining_active": False,
                "mined_coins": 0,
                "mining_rate": 0,
                "can_start": False,
                "requires_subscription": True,
                "message": "Upgrade to Elite subscription to start mining"
            }
        
        # Calculate mining rate
        rate_info = await calculate_mining_rate(uid)
        
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
            "can_start": is_elite and not mining_active,
            "can_collect": mined_coins > 0,
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
    """Start a new mining session"""
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check subscription
        subscription_plan = user.get("subscription_plan", "explorer")
        is_elite = subscription_plan.lower() in ["elite", "vip", "startup", "growth", "pro"]
        
        if not is_elite:
            raise HTTPException(
                status_code=403,
                detail="Elite subscription required to start mining"
            )
        
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
    """Collect mined PRC from current session"""
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
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
        
        # Update user
        await db.users.update_one(
            {"uid": uid},
            {
                "$set": {
                    "prc_balance": new_balance,
                    "mining_active": False,
                    "mining_start_time": None,
                    "mining_session_end": None,
                    "last_mining_collect": now.isoformat()
                },
                "$inc": {
                    "total_mined_prc": mined_coins
                }
            }
        )
        
        # Record transaction
        await db.transactions.insert_one({
            "txn_id": str(uuid.uuid4()),
            "user_id": uid,
            "type": "credit",
            "amount": mined_coins,
            "transaction_type": "mining",
            "description": "Mining session collection",
            "balance_after": new_balance,
            "timestamp": now.isoformat()
        })
        
        return {
            "success": True,
            "message": f"Collected {mined_coins:.4f} PRC",
            "collected_amount": mined_coins,
            "new_balance": new_balance,
            "session_duration_seconds": elapsed_seconds
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
            "formula": "R(U) = max(3, 8 - 0.5 × log₂(U))",
            "daily_formula": "Daily PRC = 550 + (U × R(U))",
            "network_cap_formula": "NetworkCap = min(4000, 800 + 16×D)",
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
