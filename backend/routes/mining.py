"""
Mining Routes - Extracted from server.py
========================================
Handles all PRC mining related endpoints:
- /mining/start/{uid} - Start 24-hour mining session
- /mining/status/{uid} - Get current mining status
- /mining/claim/{uid} - Claim mined coins
- /mining/collect/{uid} - Collect rewards without resetting
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import asyncio
import logging

# Import WalletService for ledger tracking (Phase 2)
from app.services import WalletService

router = APIRouter(prefix="/mining", tags=["Mining"])

# Module-level variables (set by server.py)
db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

# Helper functions will be injected
_is_paid_subscriber = None
_calculate_mining_rate = None
_log_transaction = None
_log_activity = None
_create_notification = None
_create_social_notification = None

def set_helpers(helpers: dict):
    global _is_paid_subscriber, _calculate_mining_rate, _log_transaction
    global _log_activity, _create_notification, _create_social_notification
    _is_paid_subscriber = helpers.get("is_paid_subscriber")
    _calculate_mining_rate = helpers.get("calculate_mining_rate")
    _log_transaction = helpers.get("log_transaction")
    _log_activity = helpers.get("log_activity")
    _create_notification = helpers.get("create_notification")
    _create_social_notification = helpers.get("create_social_notification")


class MiningCollectRequest(BaseModel):
    amount: Optional[float] = None


@router.post("/start/{uid}")
async def start_mining(uid: str):
    """Start 24-hour mining session - All users can start, only paid can collect"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    session_end = now + timedelta(hours=24)
    
    # Check if there's an active session
    if user.get("mining_start_time"):
        start_time = datetime.fromisoformat(user["mining_start_time"]) if isinstance(user["mining_start_time"], str) else user["mining_start_time"]
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        
        # If session is still active (less than 24 hours)
        if now < start_time + timedelta(hours=24):
            remaining_hours = ((start_time + timedelta(hours=24)) - now).total_seconds() / 3600
            return {
                "message": "Mining session already active",
                "session_active": True,
                "session_start": start_time.isoformat(),
                "session_end": (start_time + timedelta(hours=24)).isoformat(),
                "remaining_hours": round(remaining_hours, 2)
            }
    
    # Start new 24-hour session
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "mining_start_time": now.isoformat(),
            "mining_session_end": session_end.isoformat(),
            "mining_active": True,
            "last_login": now.isoformat()
        }}
    )
    
    # Log mining started activity
    if _log_transaction:
        await _log_transaction(
            user_id=uid,
            wallet_type="prc",
            transaction_type="mining_started",
            amount=0,
            description="Started 24-hour mining session",
            metadata={
                "session_start": now.isoformat(),
                "session_end": session_end.isoformat()
            }
        )
    
    # Log to activity_logs
    if _log_activity:
        await _log_activity(
            user_id=uid,
            action_type="mining_started",
            description="Started 24-hour rewards session",
            metadata={"session_start": now.isoformat(), "session_end": session_end.isoformat()}
        )
    
    # Notify referrer when referral becomes active
    if user.get("referred_by") and _create_social_notification:
        referrer_uid = user["referred_by"]
        user_name = user.get("name", "Your referral")
        
        # Check if this is the first time this user is mining
        previous_mining = await db.transactions.find_one({
            "user_id": uid,
            "transaction_type": "mining_started",
            "created_at": {"$lt": now.isoformat()}
        })
        
        # Only notify if this is the first mining session
        if not previous_mining:
            await _create_social_notification(
                user_uid=referrer_uid,
                notification_type="referral_active",
                title="⚡ Referral Now Active!",
                message=f"{user_name} just started mining! You'll earn bonus PRC from their activity.",
                from_uid=uid,
                from_name=user_name,
                icon="🚀",
                action_url="/network"
            )
    
    # Invalidate caches
    if cache:
        await cache.delete(f"mining_status:{uid}")
        await cache.delete(f"mining_rate:{uid}")
        await cache.delete(f"user_data:{uid}")
    
    return {
        "message": "Mining started successfully",
        "session_active": True,
        "session_start": now.isoformat(),
        "session_end": session_end.isoformat(),
        "remaining_hours": 24
    }


@router.get("/status/{uid}")
async def get_mining_status(uid: str):
    """Get current mining status with session info - cached for 30 seconds"""
    from routes.mining_economy import calculate_new_mining_rate, HOURLY_BASE_RATE
    
    # Short cache for mining status (30 seconds)
    cache_key = f"mining_status:{uid}"
    if cache:
        cached_status = await cache.get(cache_key)
        if cached_status:
            return cached_status
    
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "profile_picture": 0, "password_hash": 0, "pin_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    session_active = False
    remaining_hours = 0
    session_start = None
    session_end = None
    mined_this_session = 0
    
    # Get FULL mining breakdown including single leg info
    hourly_rate, per_minute_rate, full_breakdown = await calculate_new_mining_rate(db, uid, cache)
    
    # Extract single leg info for frontend
    single_leg_info = {
        "active_downline": full_breakdown.get("single_leg", {}).get("active_downline", 0),
        "total_downline": full_breakdown.get("single_leg", {}).get("total_downline", 0),
        "bonus_prc_per_day": full_breakdown.get("single_leg", {}).get("bonus_prc_per_day", 0),
        "bonus_prc_per_hour": full_breakdown.get("single_leg", {}).get("bonus_prc_per_hour", 0),
        "max_users": 800,
        "prc_per_user_per_day": 5
    }
    
    # Extract boost breakdown for team levels
    boost_breakdown = full_breakdown.get("boost_breakdown", {})
    active_referrals = sum(d.get("active", 0) for d in boost_breakdown.values())
    
    # Convert boost breakdown to referral_breakdown format
    referral_breakdown = {}
    for level_key, level_data in boost_breakdown.items():
        referral_breakdown[level_key] = {
            'count': level_data.get('active', 0),
            'active_count': level_data.get('active', 0),
            'total_count': level_data.get('count', 0),
            'percentage': {'level_1': 10, 'level_2': 5, 'level_3': 3}.get(level_key, 0),
            'bonus': level_data.get('bonus_prc', 0)
        }
    
    base_rate = full_breakdown.get("base_with_single_leg", HOURLY_BASE_RATE)
    rate_per_minute = per_minute_rate
    
    # Check if mining session is active
    mining_active = user.get("mining_active")
    if user.get("mining_start_time") and (mining_active is True or mining_active is None):
        start_time = datetime.fromisoformat(user["mining_start_time"]) if isinstance(user["mining_start_time"], str) else user["mining_start_time"]
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        
        session_end_time = start_time + timedelta(hours=24)
        
        if now < session_end_time:
            session_active = True
            remaining_hours = (session_end_time - now).total_seconds() / 3600
            session_start = start_time.isoformat()
            session_end = session_end_time.isoformat()
            
            # Calculate mined coins during this session
            elapsed_minutes = (now - start_time).total_seconds() / 60
            mined_this_session = elapsed_minutes * rate_per_minute
        else:
            # Session expired, mark as inactive (fire and forget)
            asyncio.create_task(db.users.update_one(
                {"uid": uid},
                {"$set": {"mining_active": False}}
            ))
    
    mining_rate_per_hour = rate_per_minute * 60
    
    result = {
        "current_balance": user.get("prc_balance", 0),
        "mining_rate": mining_rate_per_hour,
        "mining_rate_per_hour": mining_rate_per_hour,
        "base_rate": base_rate,
        "active_referrals": active_referrals,
        "referral_breakdown": referral_breakdown,
        "single_leg_info": single_leg_info,
        "boost_multiplier": full_breakdown.get("boost_multiplier", 1.0),
        "total_mined": user.get("total_mined", 0),
        "session_active": session_active,
        "remaining_hours": round(remaining_hours, 2) if session_active else 0,
        "session_start": session_start,
        "session_end": session_end,
        "mined_this_session": round(mined_this_session, 2),
        "is_mining": session_active
    }
    
    # Cache for 30 seconds
    if cache:
        await cache.set(cache_key, result, ttl=120)  # 2 minutes - increased for stability
    
    return result


@router.post("/claim/{uid}")
async def claim_mining(uid: str):
    """Claim mined coins from current session"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Use helper function - subscription_plan is source of truth
    is_vip = _is_paid_subscriber(user) if _is_paid_subscriber else False
    
    # IMPORTANT: Free/Explorer users CANNOT collect PRC
    if not is_vip:
        subscription_plan = user.get("subscription_plan", "explorer")
        raise HTTPException(
            status_code=403, 
            detail=f"Free/Explorer users cannot collect PRC. Please upgrade to VIP to claim your mined coins. Current plan: {subscription_plan}"
        )
    
    # Derive membership_type for backward compatibility
    subscription_plan = user.get("subscription_plan", "explorer")
    membership_type = "vip" if is_vip else "free"
    
    # Check if mining session exists
    mining_active = user.get("mining_active")
    if mining_active is False or not user.get("mining_start_time"):
        raise HTTPException(status_code=400, detail="No active mining session")
    
    now = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(user["mining_start_time"]) if isinstance(user["mining_start_time"], str) else user["mining_start_time"]
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    
    # Check if session is still active
    session_end_time = start_time + timedelta(hours=24)
    if now >= session_end_time:
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"mining_active": False}}
        )
        raise HTTPException(status_code=400, detail="Mining session expired. Please start a new session.")
    
    # Calculate mined coins
    elapsed_minutes = (now - start_time).total_seconds() / 60
    rate_per_minute, base_rate, total_active_referrals, referral_breakdown = await _calculate_mining_rate(uid) if _calculate_mining_rate else (0, 0, 0, {})
    mined_amount = elapsed_minutes * rate_per_minute
    
    # User receives 100% (vault disabled)
    user_receives = mined_amount
    
    # PHASE 2: Use WalletService for ledger tracking
    if user_receives > 0:
        credit_result = WalletService.credit(
            user_id=uid,
            amount=user_receives,
            txn_type="mining",
            description=f"Mining reward ({round(elapsed_minutes, 1)} mins)",
            reference=f"MINE-{int(now.timestamp())}"
        )
        if credit_result["success"]:
            logging.info(f"[Mining] Credited {user_receives} PRC to {uid} via WalletService")
            new_balance = credit_result["balance_after"]
        else:
            logging.error(f"[Mining] WalletService credit failed: {credit_result}")
            # Fallback to direct update
            current_balance = user.get("prc_balance") or 0
            new_balance = current_balance + user_receives
    else:
        current_balance = user.get("prc_balance") or 0
        new_balance = current_balance
    
    # Get current total mined
    current_total_mined = user.get("total_mined") or 0
    if not isinstance(current_total_mined, (int, float)):
        current_total_mined = 0
    new_total_mined = current_total_mined + mined_amount
    
    # Calculate expiry date (never for VIP)
    expiry_date = None if is_vip else (now + timedelta(days=2)).isoformat()
    
    # Mining history entry
    mining_entry = {
        "amount": user_receives,
        "total_mined": mined_amount,
        "luxury_savings": 0,
        "timestamp": now.isoformat(),
        "burned": False,
        "expires_at": expiry_date,
        "membership_type": membership_type
    }
    
    # Calculate referral bonus portion
    referral_bonus_portion = 0
    if referral_breakdown:
        total_bonus = sum(ld.get('bonus', 0) for ld in referral_breakdown.values())
        if total_bonus > 0 and rate_per_minute > 0:
            referral_bonus_portion = (total_bonus / (rate_per_minute * 1440)) * mined_amount
    
    # Build update operation (prc_balance already updated by WalletService)
    update_op = {
        "$set": {
            "total_mined": new_total_mined,
            "mining_start_time": now.isoformat(),
            "mining_active": True
        },
        "$push": {"mining_history": mining_entry}
    }
    
    if referral_bonus_portion > 0:
        update_op["$inc"] = {"total_referral_earnings": referral_bonus_portion}
    
    await db.users.update_one({"uid": uid}, update_op)
    
    # Parallel DB operations
    parallel_tasks = []
    
    # Referral bonus transactions
    if referral_bonus_portion > 0 and referral_breakdown:
        level_breakdown = {k: v for k, v in referral_breakdown.items() if k.startswith('level_')}
        total_breakdown_bonus = sum(ld.get('bonus', 0) for ld in level_breakdown.values())
        
        for level_key, level_data in level_breakdown.items():
            level_bonus = level_data.get('bonus', 0)
            if level_bonus > 0 and total_breakdown_bonus > 0:
                level_share = (level_bonus / total_breakdown_bonus) * referral_bonus_portion
                level_num = int(level_key.replace('level_', ''))
                active_count = level_data.get('active_count', 0)
                
                parallel_tasks.append(db.transactions.insert_one({
                    "transaction_id": f"txn_ref_{uuid.uuid4()}",
                    "user_id": uid,
                    "type": "referral_bonus",
                    "amount": round(level_share, 4),
                    "prc_earned": round(level_share, 4),
                    "level": level_num,
                    "description": f"Level {level_num} Bonus",
                    "timestamp": now.isoformat(),
                    "created_at": now.isoformat(),
                    "active_referrals": active_count,
                    "bonus_percent": level_data.get('bonus_percent', 0) * 100
                }))
    
    # Transaction record
    transaction_id = f"txn_{uuid.uuid4()}"
    parallel_tasks.append(db.transactions.insert_one({
        "transaction_id": transaction_id,
        "user_id": uid,
        "type": "mining",
        "amount": mined_amount,
        "inr_amount": 0,
        "description": "Mining rewards claimed",
        "timestamp": now.isoformat(),
        "expires_at": expiry_date,
        "expired": False,
        "balance_after": new_balance,
        "metadata": {
            "membership_type": membership_type,
            "validity": "2 days" if not is_vip else "lifetime"
        }
    }))
    
    # Wallet transaction
    parallel_tasks.append(db.wallet_transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": uid,
        "type": "credit",
        "wallet_type": "prc",
        "amount": mined_amount,
        "description": "Mining rewards claimed",
        "balance_after": new_balance,
        "created_at": now.isoformat(),
        "expires_at": expiry_date
    }))
    
    # Notification
    if _create_notification:
        validity_msg = " (Valid for 2 days - Upgrade to VIP for lifetime validity)" if not is_vip else " (Lifetime validity)"
        parallel_tasks.append(_create_notification(
            user_id=uid,
            title="Mining Rewards Claimed! ⛏️",
            message=f"You've claimed {round(user_receives, 2)} PRC from mining{validity_msg}. New balance: {round(new_balance, 2)} PRC",
            notification_type="mining",
            related_id=None,
            icon="⛏️"
        ))
    
    # Execute parallel tasks
    if parallel_tasks:
        await asyncio.gather(*parallel_tasks, return_exceptions=True)
    
    # Invalidate caches
    if cache:
        await cache.delete(f"mining_status:{uid}")
        await cache.delete(f"user:dashboard:{uid}")
        await cache.delete(f"user_data:{uid}")
    
    response = {
        "success": True,
        "amount": round(user_receives, 4),
        "claimed_amount": round(user_receives, 4),
        "total_mined_this_session": round(mined_amount, 4),
        "new_balance": round(new_balance, 4),
        "total_mined": round(new_total_mined, 4),
        "membership_type": membership_type,
        "validity": "2 days" if not is_vip else "lifetime",
        "expires_at": expiry_date,
        "message": f"Successfully claimed {round(user_receives, 2)} PRC!",
        "session_reset": True,
        "new_session_start": now.isoformat(),
        "new_session_end": (now + timedelta(hours=24)).isoformat(),
        "remaining_hours": 24
    }
    
    return response


@router.post("/collect/{uid}")
async def collect_mining_rewards(uid: str, request: MiningCollectRequest = None):
    """Collect earned PRC from active mining session without resetting session"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    is_vip = _is_paid_subscriber(user) if _is_paid_subscriber else False
    
    subscription_plan = user.get("subscription_plan", "explorer")
    membership_type = "vip" if is_vip else "free"
    
    # Free users cannot collect PRC
    if not is_vip:
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"mining_start_time": now.isoformat()}}
        )
        
        if _log_activity:
            await _log_activity(
                user_id=uid,
                action_type="mining_collect_blocked",
                description="Free user attempted to collect PRC - blocked",
                metadata={"subscription_plan": subscription_plan}
            )
        
        return {
            "success": False,
            "blocked": True,
            "message": "तुम्ही Free user आहात. PRC collect करण्यासाठी Startup किंवा Elite plan घ्या! 🚀",
            "message_en": "You are a Free user. Upgrade to Startup or Elite plan to collect PRC!",
            "prc_collected": 0,
            "new_balance": user.get("prc_balance", 0),
            "membership_type": membership_type,
            "upgrade_required": True,
            "session_restarted": True
        }
    
    # Check if mining session is active
    if not user.get("mining_start_time"):
        raise HTTPException(status_code=400, detail="No active mining session")
    
    start_time = user["mining_start_time"]
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    
    session_end = start_time + timedelta(hours=24)
    
    # Calculate earned amount
    elapsed_minutes = (min(now, session_end) - start_time).total_seconds() / 60
    rate_per_minute, base_rate, active_referrals, referral_breakdown = await _calculate_mining_rate(uid) if _calculate_mining_rate else (0, 0, 0, {})
    calculated_amount = elapsed_minutes * rate_per_minute
    
    prc_to_collect = request.amount if request and request.amount and request.amount <= calculated_amount else calculated_amount
    
    if prc_to_collect < 0.01:
        raise HTTPException(status_code=400, detail="Minimum collection is 0.01 PRC")
    
    # PHASE 2: Use WalletService for ledger tracking
    credit_result = WalletService.credit(
        user_id=uid,
        amount=prc_to_collect,
        txn_type="mining_collect",
        description=f"Mining collection ({round(elapsed_minutes, 1)} mins)",
        reference=f"COLLECT-{int(now.timestamp())}"
    )
    
    if credit_result["success"]:
        new_balance = credit_result["balance_after"]
        logging.info(f"[Mining] Collected {prc_to_collect} PRC for {uid} via WalletService")
    else:
        # Fallback
        current_balance = user.get("prc_balance") or 0
        new_balance = current_balance + prc_to_collect
    
    # Get current total mined
    current_total_mined = user.get("total_mined") or 0
    if not isinstance(current_total_mined, (int, float)):
        current_total_mined = 0
    new_total_mined = current_total_mined + prc_to_collect
    
    expiry_date = None if is_vip else (now + timedelta(days=2)).isoformat()
    
    mining_entry = {
        "amount": prc_to_collect,
        "timestamp": now.isoformat(),
        "burned": False,
        "expires_at": expiry_date,
        "membership_type": membership_type
    }
    
    # Update user (prc_balance already updated by WalletService)
    await db.users.update_one(
        {"uid": uid},
        {
            "$set": {
                "total_mined": new_total_mined,
                "mining_start_time": now.isoformat()
            },
            "$push": {"mining_history": mining_entry}
        }
    )
    
    # Log transaction
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": uid,
        "type": "mining",
        "amount": prc_to_collect,
        "description": "Mining rewards collected",
        "timestamp": now.isoformat(),
        "expires_at": expiry_date,
        "status": "completed"
    })
    
    # Log activity
    if _log_activity:
        await _log_activity(
            user_id=uid,
            action_type="mining_collected",
            description=f"Collected {prc_to_collect:.2f} PRC from mining session",
            metadata={"amount": prc_to_collect, "new_balance": new_balance}
        )
    
    # Invalidate caches
    if cache:
        await cache.delete(f"mining_status:{uid}")
        await cache.delete(f"user:dashboard:{uid}")
        await cache.delete(f"user_data:{uid}")
    
    return {
        "success": True,
        "prc_collected": round(prc_to_collect, 4),
        "new_balance": round(new_balance, 4),
        "total_mined": round(new_total_mined, 4),
        "membership_type": membership_type,
        "validity": "lifetime" if is_vip else "2 days",
        "expires_at": expiry_date
    }
