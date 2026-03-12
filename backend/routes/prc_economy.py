"""
PARAS REWARD - PRC TOKEN ECONOMY CONTROL SYSTEM
================================================

This module implements the complete PRC token economy control system including:
- Dynamic PRC Value Control Engine (5 factors)
- Redeem Pressure Monitoring
- Whale Wallet Protection
- Emergency Protection Mode (AUTO-PAUSE)
- System Stability Index

Reference: PARAS REWARD TOKEN ECONOMY DOCUMENT
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Tuple, Optional
import logging

# ==================== CONSTANTS ====================

# Base Token Value
PRC_INR_RATE = 10  # 10 PRC = ₹1 (Base reference rate)

# Price Safety Limits (Section 13)
MINIMUM_RATE = 6   # Minimum: 6 PRC = ₹1 (most valuable)
MAXIMUM_RATE = 20  # Maximum: 20 PRC = ₹1 (least valuable)

# Whale Wallet Threshold (Section 17)
WHALE_THRESHOLD = 500000  # 500,000 PRC
WHALE_BURN_RATE = 2.0     # 2% burn for whale wallets
NORMAL_BURN_RATE = 1.0    # 1% burn for normal wallets

# Redeem Pressure Thresholds (Section 14-15)
SAFE_REDEEM_RATIO = 0.15  # 15% is safe threshold
EMERGENCY_SPIKE_THRESHOLD = 2.0  # 200% spike triggers emergency

# Emergency Auto-Pause Settings
EMERGENCY_PAUSE_DURATION_HOURS = 24  # Auto-pause for 24 hours
EMERGENCY_CHECK_INTERVAL_MINUTES = 5  # Check every 5 minutes

# Rate Update Interval
RATE_UPDATE_INTERVAL_DAYS = 30  # Update every 30 days

# Supply Thresholds (Section 7)
SUPPLY_THRESHOLDS = {
    "very_low": 100_000_000,    # < 100M PRC
    "low": 500_000_000,          # < 500M PRC
    "medium": 1_000_000_000,     # < 1B PRC
}

# Cache for economy calculations
_economy_cache = {}
ECONOMY_CACHE_TTL = 300  # 5 minutes


# ==================== SUPPLY FACTOR (Section 7) ====================

async def calculate_supply_factor(db) -> float:
    """
    Calculate Supply Factor based on circulating PRC supply.
    
    Logic:
    - < 100M PRC → 0.8 (low supply = higher value)
    - < 500M PRC → 1.0 (normal)
    - < 1B PRC → 1.2 (high supply = lower value)
    - >= 1B PRC → 1.5 (very high supply)
    
    Returns: SupplyFactor (0.8 - 1.5)
    """
    try:
        # Get total circulating PRC (sum of all user balances)
        pipeline = [
            {"$group": {"_id": None, "total_prc": {"$sum": "$prc_balance"}}}
        ]
        result = await db.users.aggregate(pipeline).to_list(1)
        circulating_prc = result[0]["total_prc"] if result else 0
        
        if circulating_prc < SUPPLY_THRESHOLDS["very_low"]:
            return 0.8
        elif circulating_prc < SUPPLY_THRESHOLDS["low"]:
            return 1.0
        elif circulating_prc < SUPPLY_THRESHOLDS["medium"]:
            return 1.2
        else:
            return 1.5
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Supply factor error: {e}")
        return 1.0


# ==================== REDEEM DEMAND FACTOR (Section 8) ====================

async def calculate_redeem_factor(db) -> float:
    """
    Calculate Redeem Demand Factor.
    
    RedeemDemand = TotalRedeemRequests / ActiveUsers
    
    Logic:
    - < 0.05 → 0.9 (low demand = higher value)
    - < 0.15 → 1.0 (normal)
    - >= 0.15 → 1.2 (high demand = lower value)
    
    Returns: RedeemFactor (0.9 - 1.2)
    """
    try:
        now = datetime.now(timezone.utc)
        last_30_days = now - timedelta(days=30)
        
        # Count redeem requests in last 30 days
        redeem_count = await db.redeem_requests.count_documents({
            "created_at": {"$gte": last_30_days.isoformat()}
        })
        
        # Count active users (with activity in last 30 days)
        active_users = await db.users.count_documents({
            "last_login": {"$gte": last_30_days.isoformat()},
            "subscription_plan": {"$nin": ["explorer", "free", "", None]}
        })
        
        if active_users == 0:
            return 1.0
        
        redeem_demand = redeem_count / active_users
        
        if redeem_demand < 0.05:
            return 0.9
        elif redeem_demand < 0.15:
            return 1.0
        else:
            return 1.2
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Redeem factor error: {e}")
        return 1.0


# ==================== BURN FACTOR (Section 9) ====================

async def calculate_burn_factor(db) -> float:
    """
    Calculate Burn Factor based on burn activity.
    
    BurnRatio = BurnedPRC / TotalPRC
    
    Logic:
    - > 0.05 (5%) → 0.9 (high burn = higher value)
    - <= 0.05 → 1.0 (normal)
    
    Returns: BurnFactor (0.9 - 1.0)
    """
    try:
        now = datetime.now(timezone.utc)
        last_30_days = now - timedelta(days=30)
        
        # Get total burned PRC in last 30 days
        pipeline = [
            {"$match": {
                "type": "prc_burn",
                "timestamp": {"$gte": last_30_days}
            }},
            {"$group": {"_id": None, "total_burned": {"$sum": "$amount"}}}
        ]
        burn_result = await db.transactions.aggregate(pipeline).to_list(1)
        total_burned = burn_result[0]["total_burned"] if burn_result else 0
        
        # Get total circulating PRC
        supply_result = await db.users.aggregate([
            {"$group": {"_id": None, "total_prc": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        total_prc = supply_result[0]["total_prc"] if supply_result else 1
        
        if total_prc == 0:
            return 1.0
        
        burn_ratio = abs(total_burned) / total_prc
        
        if burn_ratio > 0.05:
            return 0.9
        else:
            return 1.0
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Burn factor error: {e}")
        return 1.0


# ==================== ACTIVE USER FACTOR (Section 10) ====================

async def calculate_user_factor(db) -> float:
    """
    Calculate Active User Factor.
    
    Logic:
    - > 500,000 users → 0.85 (very high = lower value per user)
    - > 100,000 users → 0.95 (high)
    - <= 100,000 users → 1.05 (low = higher value)
    
    Returns: UserFactor (0.85 - 1.05)
    """
    try:
        now = datetime.now(timezone.utc)
        last_30_days = now - timedelta(days=30)
        
        # Count active paid users
        active_users = await db.users.count_documents({
            "last_login": {"$gte": last_30_days.isoformat()},
            "subscription_plan": {"$nin": ["explorer", "free", "", None]}
        })
        
        if active_users > 500000:
            return 0.85
        elif active_users > 100000:
            return 0.95
        else:
            return 1.05
    except Exception as e:
        logging.error(f"[PRC ECONOMY] User factor error: {e}")
        return 1.0


# ==================== UTILITY USAGE FACTOR (Section 11) ====================

async def calculate_utility_factor(db) -> float:
    """
    Calculate Utility Usage Factor.
    
    UtilityUsage = PRC_Spent / PRC_Mined
    
    Logic:
    - > 0.50 (50%) → 0.9 (high usage = higher value)
    - <= 0.50 → 1.05 (low usage = lower value)
    
    Returns: UtilityFactor (0.9 - 1.05)
    """
    try:
        now = datetime.now(timezone.utc)
        last_30_days = now - timedelta(days=30)
        
        # Get PRC spent (bill payments, orders, etc.)
        spent_pipeline = [
            {"$match": {
                "type": {"$in": ["order", "bill_payment_request", "gift_voucher_request"]},
                "timestamp": {"$gte": last_30_days}
            }},
            {"$group": {"_id": None, "total_spent": {"$sum": "$amount"}}}
        ]
        spent_result = await db.transactions.aggregate(spent_pipeline).to_list(1)
        prc_spent = abs(spent_result[0]["total_spent"]) if spent_result else 0
        
        # Get PRC mined
        mined_pipeline = [
            {"$match": {
                "type": {"$in": ["mining_reward", "prc_credit", "mining"]},
                "timestamp": {"$gte": last_30_days}
            }},
            {"$group": {"_id": None, "total_mined": {"$sum": "$amount"}}}
        ]
        mined_result = await db.transactions.aggregate(mined_pipeline).to_list(1)
        prc_mined = mined_result[0]["total_mined"] if mined_result else 1
        
        if prc_mined == 0:
            return 1.0
        
        utility_usage = prc_spent / prc_mined
        
        if utility_usage > 0.50:
            return 0.9
        else:
            return 1.05
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Utility factor error: {e}")
        return 1.0


# ==================== PRC VALUE CONTROL ENGINE (Section 6) ====================

async def calculate_dynamic_prc_rate(db) -> Dict:
    """
    Calculate dynamic PRC rate using all 5 ecosystem factors.
    
    FinalRate = BaseRate × SupplyFactor × RedeemFactor × BurnFactor × UserFactor × UtilityFactor
    
    Result is clamped between MinimumRate (6) and MaximumRate (20).
    
    Returns: Dict with rate details and all factors
    """
    try:
        # Check cache first
        cache_key = "prc_dynamic_rate"
        if cache_key in _economy_cache:
            cached_data, cache_time = _economy_cache[cache_key]
            if (datetime.now(timezone.utc) - cache_time).total_seconds() < ECONOMY_CACHE_TTL:
                return cached_data
        
        # Calculate all factors
        supply_factor = await calculate_supply_factor(db)
        redeem_factor = await calculate_redeem_factor(db)
        burn_factor = await calculate_burn_factor(db)
        user_factor = await calculate_user_factor(db)
        utility_factor = await calculate_utility_factor(db)
        
        # Calculate final rate
        raw_rate = (PRC_INR_RATE * supply_factor * redeem_factor * 
                   burn_factor * user_factor * utility_factor)
        
        # Clamp to safety limits (Section 13)
        final_rate = max(MINIMUM_RATE, min(MAXIMUM_RATE, round(raw_rate)))
        
        result = {
            "base_rate": PRC_INR_RATE,
            "final_rate": final_rate,
            "raw_rate": round(raw_rate, 2),
            "inr_value": round(1 / final_rate, 4),  # Value of 1 PRC in INR
            "factors": {
                "supply_factor": supply_factor,
                "redeem_factor": redeem_factor,
                "burn_factor": burn_factor,
                "user_factor": user_factor,
                "utility_factor": utility_factor
            },
            "limits": {
                "minimum_rate": MINIMUM_RATE,
                "maximum_rate": MAXIMUM_RATE
            },
            "calculated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Cache the result
        _economy_cache[cache_key] = (result, datetime.now(timezone.utc))
        
        # Save to database for sync access
        await save_calculated_rate(db, result)
        
        return result
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Dynamic rate calculation error: {e}")
        return {
            "base_rate": PRC_INR_RATE,
            "final_rate": PRC_INR_RATE,
            "error": str(e)
        }


def get_dynamic_rate_sync() -> int:
    """
    Synchronous version to get dynamic PRC rate.
    Uses cached value or calculates fresh if cache expired.
    
    This is used by DMT/withdrawal services that need sync rate access.
    Returns: final_rate (int) - e.g., 10 means 10 PRC = ₹1
    """
    try:
        from pymongo import MongoClient
        import os
        
        # Check memory cache first
        cache_key = "prc_dynamic_rate"
        if cache_key in _economy_cache:
            cached_data, cache_time = _economy_cache[cache_key]
            if (datetime.now(timezone.utc) - cache_time).total_seconds() < ECONOMY_CACHE_TTL:
                return cached_data.get("final_rate", PRC_INR_RATE)
        
        # Fetch from database (last calculated value)
        client = MongoClient(os.environ.get("MONGO_URL"))
        sync_db = client[os.environ.get("DB_NAME", "test_database")]
        
        # Check if we have a stored calculated rate
        stored_rate = sync_db.system_settings.find_one({"type": "prc_dynamic_rate"})
        if stored_rate:
            calc_time = stored_rate.get("calculated_at")
            if calc_time:
                # Check if calculation is recent (within cache TTL)
                if isinstance(calc_time, str):
                    calc_time = datetime.fromisoformat(calc_time.replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - calc_time).total_seconds() < ECONOMY_CACHE_TTL:
                    return stored_rate.get("final_rate", PRC_INR_RATE)
        
        # Fallback to admin-set rate in dmt_settings
        dmt_settings = sync_db.dmt_settings.find_one({"_id": "dmt_config"})
        if dmt_settings:
            return dmt_settings.get("prc_to_inr_rate", PRC_INR_RATE)
        
        return PRC_INR_RATE
        
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Sync rate fetch error: {e}")
        return PRC_INR_RATE


async def save_calculated_rate(db, rate_data: Dict):
    """Save the calculated dynamic rate to database for sync access"""
    try:
        await db.system_settings.update_one(
            {"type": "prc_dynamic_rate"},
            {"$set": {
                "type": "prc_dynamic_rate",
                **rate_data,
                "updated_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Failed to save rate: {e}")


# ==================== REDEEM PRESSURE MONITOR (Section 14) ====================

async def get_redeem_pressure(db) -> Dict:
    """
    Monitor daily redeem pressure.
    
    RedeemPressure = TotalPRCRedeemedToday / ActiveUsers
    SafeThreshold = 0.15
    
    Returns: Dict with pressure metrics and status
    """
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Get total PRC redeemed today
        pipeline = [
            {"$match": {
                "status": {"$in": ["completed", "processing", "pending"]},
                "created_at": {"$gte": today_start.isoformat()}
            }},
            {"$group": {"_id": None, "total_redeemed": {"$sum": "$amount"}}}
        ]
        redeem_result = await db.redeem_requests.aggregate(pipeline).to_list(1)
        total_redeemed_today = redeem_result[0]["total_redeemed"] if redeem_result else 0
        
        # Get active users count
        last_30_days = now - timedelta(days=30)
        active_users = await db.users.count_documents({
            "last_login": {"$gte": last_30_days.isoformat()},
            "subscription_plan": {"$nin": ["explorer", "free", "", None]}
        })
        
        if active_users == 0:
            active_users = 1
        
        # Calculate pressure
        redeem_pressure = total_redeemed_today / active_users
        
        # Determine status
        if redeem_pressure > SAFE_REDEEM_RATIO * 2:
            status = "critical"
            message = "Redeem pressure critical! Consider activating protection mode."
        elif redeem_pressure > SAFE_REDEEM_RATIO:
            status = "high"
            message = "Redeem pressure above safe threshold."
        else:
            status = "normal"
            message = "Redeem pressure within safe limits."
        
        return {
            "redeem_pressure": round(redeem_pressure, 4),
            "safe_threshold": SAFE_REDEEM_RATIO,
            "total_redeemed_today": round(total_redeemed_today, 2),
            "active_users": active_users,
            "status": status,
            "message": message,
            "protection_recommended": redeem_pressure > SAFE_REDEEM_RATIO,
            "timestamp": now.isoformat()
        }
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Redeem pressure error: {e}")
        return {"error": str(e), "status": "unknown"}


# ==================== WHALE WALLET PROTECTION (Section 17) ====================

def get_burn_rate_for_wallet(prc_balance: float) -> float:
    """
    Determine burn rate based on wallet balance.
    
    - Balance > 500,000 PRC → 2% burn rate
    - Balance <= 500,000 PRC → 1% burn rate
    
    Returns: Burn rate percentage
    """
    if prc_balance > WHALE_THRESHOLD:
        return WHALE_BURN_RATE
    return NORMAL_BURN_RATE


async def get_whale_wallets(db, limit: int = 100) -> list:
    """
    Get list of whale wallets (>500,000 PRC).
    
    Returns: List of whale wallet details
    """
    try:
        whales = await db.users.find(
            {"prc_balance": {"$gt": WHALE_THRESHOLD}},
            {"uid": 1, "name": 1, "email": 1, "prc_balance": 1, "_id": 0}
        ).sort("prc_balance", -1).limit(limit).to_list(limit)
        
        return [{
            **whale,
            "burn_rate": WHALE_BURN_RATE,
            "is_whale": True
        } for whale in whales]
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Whale wallet query error: {e}")
        return []


# ==================== EMERGENCY PROTECTION MODE (Section 18) ====================

async def check_emergency_conditions(db) -> Dict:
    """
    Check if emergency protection mode should be activated.
    
    Trigger: Redeem requests spike > 200% compared to average
    
    Returns: Dict with emergency status and recommended actions
    """
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Get today's redeem request count
        today_count = await db.redeem_requests.count_documents({
            "created_at": {"$gte": today_start.isoformat()}
        })
        
        # Get average daily requests over last 30 days
        last_30_days = now - timedelta(days=30)
        total_30_days = await db.redeem_requests.count_documents({
            "created_at": {"$gte": last_30_days.isoformat(), "$lt": today_start.isoformat()}
        })
        avg_daily = total_30_days / 30 if total_30_days > 0 else 1
        
        # Calculate spike ratio
        spike_ratio = today_count / avg_daily if avg_daily > 0 else 0
        
        # Check if emergency threshold exceeded
        is_emergency = spike_ratio > EMERGENCY_SPIKE_THRESHOLD
        
        return {
            "is_emergency": is_emergency,
            "spike_ratio": round(spike_ratio, 2),
            "emergency_threshold": EMERGENCY_SPIKE_THRESHOLD,
            "today_requests": today_count,
            "avg_daily_requests": round(avg_daily, 2),
            "recommended_actions": [
                "Pause redeem for 24 hours",
                "Notify admin immediately",
                "Investigate unusual activity"
            ] if is_emergency else [],
            "message": "🚨 EMERGENCY: Abnormal redeem activity detected!" if is_emergency else "System operating normally",
            "timestamp": now.isoformat()
        }
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Emergency check error: {e}")
        return {"error": str(e), "is_emergency": False}


# ==================== EMERGENCY AUTO-PAUSE SYSTEM ====================

async def get_emergency_pause_status(db) -> Dict:
    """
    Get current emergency pause status from database.
    
    Returns:
    - is_paused: bool - Whether redeems are currently paused
    - paused_at: datetime - When pause was activated
    - paused_until: datetime - When pause will auto-expire
    - reason: str - Why pause was triggered
    - triggered_by: str - 'auto' or 'admin'
    """
    try:
        status = await db.system_settings.find_one({"key": "emergency_redeem_pause"})
        
        if not status:
            return {
                "is_paused": False,
                "paused_at": None,
                "paused_until": None,
                "reason": None,
                "triggered_by": None
            }
        
        now = datetime.now(timezone.utc)
        paused_until = status.get("paused_until")
        
        # Check if pause has expired
        if paused_until:
            if isinstance(paused_until, str):
                paused_until = datetime.fromisoformat(paused_until.replace('Z', '+00:00'))
            
            if now > paused_until:
                # Pause expired - clear it
                await db.system_settings.delete_one({"key": "emergency_redeem_pause"})
                logging.info("[PRC ECONOMY] Emergency pause expired - auto-resumed")
                return {
                    "is_paused": False,
                    "paused_at": None,
                    "paused_until": None,
                    "reason": "Pause expired - auto-resumed",
                    "triggered_by": None
                }
        
        return {
            "is_paused": status.get("is_paused", False),
            "paused_at": status.get("paused_at"),
            "paused_until": status.get("paused_until"),
            "reason": status.get("reason"),
            "triggered_by": status.get("triggered_by", "unknown"),
            "spike_ratio": status.get("spike_ratio")
        }
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Get pause status error: {e}")
        return {"is_paused": False, "error": str(e)}


async def activate_emergency_pause(db, reason: str, spike_ratio: float = 0, triggered_by: str = "auto") -> Dict:
    """
    Activate emergency redeem pause.
    
    Args:
        db: Database connection
        reason: Why pause was triggered
        spike_ratio: The spike ratio that triggered the pause
        triggered_by: 'auto' or 'admin'
    
    Returns: Status of activation
    """
    try:
        now = datetime.now(timezone.utc)
        paused_until = now + timedelta(hours=EMERGENCY_PAUSE_DURATION_HOURS)
        
        pause_data = {
            "key": "emergency_redeem_pause",
            "is_paused": True,
            "paused_at": now.isoformat(),
            "paused_until": paused_until.isoformat(),
            "reason": reason,
            "triggered_by": triggered_by,
            "spike_ratio": spike_ratio,
            "updated_at": now.isoformat()
        }
        
        await db.system_settings.update_one(
            {"key": "emergency_redeem_pause"},
            {"$set": pause_data},
            upsert=True
        )
        
        # Log the emergency activation
        await db.system_logs.insert_one({
            "type": "emergency_pause_activated",
            "reason": reason,
            "spike_ratio": spike_ratio,
            "triggered_by": triggered_by,
            "paused_until": paused_until.isoformat(),
            "timestamp": now.isoformat()
        })
        
        logging.warning(f"[PRC ECONOMY] 🚨 EMERGENCY PAUSE ACTIVATED - Reason: {reason}, Spike: {spike_ratio}x")
        
        return {
            "success": True,
            "is_paused": True,
            "paused_at": now.isoformat(),
            "paused_until": paused_until.isoformat(),
            "duration_hours": EMERGENCY_PAUSE_DURATION_HOURS,
            "reason": reason,
            "message": f"🚨 Emergency redeem pause activated for {EMERGENCY_PAUSE_DURATION_HOURS} hours"
        }
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Activate pause error: {e}")
        return {"success": False, "error": str(e)}


async def deactivate_emergency_pause(db, deactivated_by: str = "admin") -> Dict:
    """
    Manually deactivate emergency redeem pause (Admin override).
    
    Args:
        db: Database connection
        deactivated_by: Who deactivated ('admin' or 'auto')
    
    Returns: Status of deactivation
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Get current status first
        current = await db.system_settings.find_one({"key": "emergency_redeem_pause"})
        
        if not current or not current.get("is_paused"):
            return {
                "success": True,
                "message": "No active emergency pause to deactivate",
                "was_paused": False
            }
        
        # Remove the pause
        await db.system_settings.delete_one({"key": "emergency_redeem_pause"})
        
        # Log the deactivation
        await db.system_logs.insert_one({
            "type": "emergency_pause_deactivated",
            "deactivated_by": deactivated_by,
            "original_reason": current.get("reason"),
            "was_paused_at": current.get("paused_at"),
            "timestamp": now.isoformat()
        })
        
        logging.info(f"[PRC ECONOMY] ✅ Emergency pause deactivated by {deactivated_by}")
        
        return {
            "success": True,
            "message": "Emergency redeem pause deactivated",
            "was_paused": True,
            "deactivated_by": deactivated_by,
            "deactivated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Deactivate pause error: {e}")
        return {"success": False, "error": str(e)}


async def check_and_auto_pause(db) -> Dict:
    """
    Main function to check emergency conditions and auto-pause if needed.
    
    This should be called:
    1. By a scheduled job every 5 minutes
    2. Before processing any redeem request
    
    Returns: Current emergency status and any actions taken
    """
    try:
        # First check if already paused
        pause_status = await get_emergency_pause_status(db)
        if pause_status.get("is_paused"):
            return {
                "action": "already_paused",
                "status": pause_status,
                "message": "Redeem is already paused"
            }
        
        # Check emergency conditions
        emergency = await check_emergency_conditions(db)
        
        if emergency.get("is_emergency"):
            # AUTO-ACTIVATE PAUSE!
            spike_ratio = emergency.get("spike_ratio", 0)
            reason = f"Auto-triggered: Redeem spike {spike_ratio}x (threshold: {EMERGENCY_SPIKE_THRESHOLD}x)"
            
            activation = await activate_emergency_pause(
                db,
                reason=reason,
                spike_ratio=spike_ratio,
                triggered_by="auto"
            )
            
            return {
                "action": "pause_activated",
                "emergency": emergency,
                "activation": activation,
                "message": f"🚨 AUTO-PAUSE ACTIVATED: {reason}"
            }
        
        return {
            "action": "no_action",
            "emergency": emergency,
            "message": "System normal - no pause needed"
        }
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Check and auto-pause error: {e}")
        return {"action": "error", "error": str(e)}


async def is_redeem_allowed(db) -> Tuple[bool, str]:
    """
    Quick check if redeem is currently allowed.
    
    Use this before processing any redeem request.
    
    Returns:
        Tuple[bool, str]: (is_allowed, reason_if_blocked)
    """
    try:
        pause_status = await get_emergency_pause_status(db)
        
        if pause_status.get("is_paused"):
            paused_until = pause_status.get("paused_until", "unknown")
            return (False, f"Redeem temporarily paused until {paused_until}. Reason: {pause_status.get('reason', 'Emergency protection')}")
        
        return (True, "Redeem allowed")
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Check redeem allowed error: {e}")
        # On error, allow redeem (fail-open for user convenience)
        return (True, "Check failed - allowing by default")


# ==================== SYSTEM STABILITY INDEX (Section 19) ====================

async def calculate_stability_index(db) -> Dict:
    """
    Calculate ecosystem stability score.
    
    StabilityScore = BurnRate + ActiveUsers + UtilityUsage - RedeemPressure
    
    Score interpretation:
    - > 80: Excellent stability
    - 60-80: Good stability
    - 40-60: Moderate stability
    - < 40: Poor stability - adjustments needed
    
    Returns: Dict with stability metrics
    """
    try:
        # Get all factors
        redeem_pressure_data = await get_redeem_pressure(db)
        rate_data = await calculate_dynamic_prc_rate(db)
        emergency_data = await check_emergency_conditions(db)
        
        # Extract values
        redeem_pressure = redeem_pressure_data.get("redeem_pressure", 0)
        burn_factor = rate_data.get("factors", {}).get("burn_factor", 1.0)
        user_factor = rate_data.get("factors", {}).get("user_factor", 1.0)
        utility_factor = rate_data.get("factors", {}).get("utility_factor", 1.0)
        
        # Calculate stability score (0-100)
        # Higher is better
        base_score = 50
        
        # Burn activity contribution (+10 if high burn)
        burn_contribution = 10 if burn_factor < 1.0 else 0
        
        # User activity contribution (+15 if healthy user base)
        user_contribution = 15 if user_factor <= 1.0 else 5
        
        # Utility usage contribution (+15 if high usage)
        utility_contribution = 15 if utility_factor < 1.0 else 5
        
        # Redeem pressure penalty (-20 if high pressure)
        pressure_penalty = -20 if redeem_pressure > SAFE_REDEEM_RATIO else 0
        
        # Emergency penalty (-30 if emergency)
        emergency_penalty = -30 if emergency_data.get("is_emergency", False) else 0
        
        stability_score = max(0, min(100, 
            base_score + burn_contribution + user_contribution + 
            utility_contribution + pressure_penalty + emergency_penalty
        ))
        
        # Determine health status
        if stability_score >= 80:
            health_status = "excellent"
            health_message = "Ecosystem is highly stable and healthy"
        elif stability_score >= 60:
            health_status = "good"
            health_message = "Ecosystem is stable with minor monitoring needed"
        elif stability_score >= 40:
            health_status = "moderate"
            health_message = "Ecosystem needs attention - consider adjustments"
        else:
            health_status = "poor"
            health_message = "Ecosystem unstable - immediate action required"
        
        return {
            "stability_score": stability_score,
            "health_status": health_status,
            "health_message": health_message,
            "components": {
                "base_score": base_score,
                "burn_contribution": burn_contribution,
                "user_contribution": user_contribution,
                "utility_contribution": utility_contribution,
                "pressure_penalty": pressure_penalty,
                "emergency_penalty": emergency_penalty
            },
            "current_rate": rate_data.get("final_rate", PRC_INR_RATE),
            "redeem_pressure": round(redeem_pressure, 4),
            "is_emergency": emergency_data.get("is_emergency", False),
            "recommendations": get_stability_recommendations(stability_score, redeem_pressure, emergency_data.get("is_emergency", False)),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Stability index error: {e}")
        return {"error": str(e), "stability_score": 50}


def get_stability_recommendations(score: int, redeem_pressure: float, is_emergency: bool) -> list:
    """Generate recommendations based on stability metrics"""
    recommendations = []
    
    if is_emergency:
        recommendations.append("🚨 Activate emergency protection mode")
        recommendations.append("Pause all redeems for 24 hours")
    
    if redeem_pressure > SAFE_REDEEM_RATIO:
        recommendations.append("📊 High redeem pressure detected")
        recommendations.append("Consider adjusting PRC rate upward")
        recommendations.append("Enable redeem queue system")
    
    if score < 40:
        recommendations.append("⚠️ System stability critical")
        recommendations.append("Review mining inflation rate")
        recommendations.append("Increase burn percentage temporarily")
    elif score < 60:
        recommendations.append("📈 Monitor system closely")
        recommendations.append("Consider rate adjustment in next cycle")
    
    if not recommendations:
        recommendations.append("✅ System healthy - no action required")
    
    return recommendations


# ==================== COMPREHENSIVE ECONOMY DASHBOARD ====================

async def get_economy_dashboard(db) -> Dict:
    """
    Get comprehensive PRC economy dashboard with all metrics.
    
    Returns: Complete economy status for admin dashboard
    """
    try:
        rate_data = await calculate_dynamic_prc_rate(db)
        pressure_data = await get_redeem_pressure(db)
        emergency_data = await check_emergency_conditions(db)
        stability_data = await calculate_stability_index(db)
        whale_wallets = await get_whale_wallets(db, limit=10)
        
        # Get circulating supply
        supply_result = await db.users.aggregate([
            {"$group": {"_id": None, "total_prc": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        circulating_supply = supply_result[0]["total_prc"] if supply_result else 0
        
        return {
            "prc_rate": {
                "current": rate_data.get("final_rate", PRC_INR_RATE),
                "base": PRC_INR_RATE,
                "inr_value": rate_data.get("inr_value", 0.1),
                "factors": rate_data.get("factors", {})
            },
            "supply": {
                "circulating": round(circulating_supply, 2),
                "formatted": f"{circulating_supply:,.0f} PRC"
            },
            "redeem_pressure": pressure_data,
            "emergency_status": emergency_data,
            "stability": stability_data,
            "whale_wallets": {
                "count": len(whale_wallets),
                "threshold": WHALE_THRESHOLD,
                "top_whales": whale_wallets[:5]
            },
            "settings": {
                "whale_threshold": WHALE_THRESHOLD,
                "whale_burn_rate": WHALE_BURN_RATE,
                "normal_burn_rate": NORMAL_BURN_RATE,
                "safe_redeem_ratio": SAFE_REDEEM_RATIO,
                "rate_limits": {
                    "min": MINIMUM_RATE,
                    "max": MAXIMUM_RATE
                }
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Dashboard error: {e}")
        return {"error": str(e)}
