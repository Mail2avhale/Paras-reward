"""
PARAS REWARD - GROWTH ECONOMY SYSTEM
=====================================

Complete Economy System with:
1. Mining Formula (Per User - Decreasing)
2. Growth Network (Referral Capacity)
3. Redeem System with Dynamic PRC Rate
4. Admin Controls

All calculations use Dynamic PRC to INR Rate
MLM-Free Terminology Used Throughout
"""

import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Tuple
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

router = APIRouter(prefix="/growth", tags=["Growth Economy"])

# Database reference (set from main server)
db = None

def set_db(database):
    global db
    db = database


# ==================== CONSTANTS ====================

DEFAULT_BASE_MINING = 550  # Base daily PRC
DEFAULT_NETWORK_CAP_BASE = 800  # Base network capacity
DEFAULT_NETWORK_CAP_PER_REFERRAL = 16  # Capacity increase per direct referral
DEFAULT_MAX_NETWORK_CAP = 4000  # Maximum network capacity
DEFAULT_MIN_PRC_PER_USER = 3  # Minimum PRC per user
DEFAULT_MAX_PRC_PER_USER = 8  # Maximum PRC per user (at start)

DEFAULT_REDEEM_PERCENT = 70  # Default redeem percentage
DEFAULT_BURN_RATE = 5  # 5% burn on every redeem
DEFAULT_PROCESSING_FEE_INR = 10  # ₹10 processing fee
DEFAULT_ADMIN_CHARGE_PERCENT = 20  # 20% admin charges on PRC


# ==================== PYDANTIC MODELS ====================

class EconomySettings(BaseModel):
    redeem_percent: int = DEFAULT_REDEEM_PERCENT
    burn_rate: float = DEFAULT_BURN_RATE
    processing_fee_inr: float = DEFAULT_PROCESSING_FEE_INR
    admin_charge_percent: float = DEFAULT_ADMIN_CHARGE_PERCENT
    base_mining: int = DEFAULT_BASE_MINING
    min_prc_per_user: float = DEFAULT_MIN_PRC_PER_USER
    max_prc_per_user: float = DEFAULT_MAX_PRC_PER_USER


class RedeemCalculation(BaseModel):
    redeem_prc: float
    burn_prc: float
    processing_fee_prc: float
    admin_charge_prc: float
    total_prc_deducted: float
    user_gets_inr: float
    prc_rate: float


class MiningSpeed(BaseModel):
    base_mining: float
    network_mining: float
    total_daily_prc: float
    prc_per_user: float
    network_size: int
    network_cap: int
    subscription_multiplier: float


class GrowthNetworkStats(BaseModel):
    direct_referrals: int
    network_size: int
    network_cap: int
    growth_level: int
    unlock_percent: int


# ==================== HELPER FUNCTIONS ====================

async def get_dynamic_prc_rate() -> float:
    """
    Get dynamic PRC rate from database/economy system.
    Returns: PRC per INR (e.g., 2.0 means 2 PRC = ₹1)
    """
    try:
        # Check for manual override first
        override = await db.app_settings.find_one({"key": "prc_rate_manual_override"})
        if override and override.get("enabled"):
            rate = override.get("rate", 2)
            expires_at = override.get("expires_at")
            if expires_at:
                try:
                    expiry = datetime.fromisoformat(str(expires_at).replace('Z', '+00:00'))
                    if expiry > datetime.now(timezone.utc):
                        return float(rate)
                except Exception:
                    pass
            else:
                return float(rate)
        
        # Try economy calculation
        try:
            from routes.prc_economy import calculate_dynamic_prc_rate
            rate_data = await calculate_dynamic_prc_rate(db)
            if rate_data:
                if isinstance(rate_data, dict):
                    return float(rate_data.get("final_rate", 2))
                return float(rate_data)
        except Exception as e:
            logging.warning(f"Economy rate calculation failed: {e}")
        
        # Database setting fallback
        rate_setting = await db.app_settings.find_one({"key": "prc_to_inr_rate"})
        if rate_setting and rate_setting.get("value"):
            return float(rate_setting.get("value"))
        
        settings = await db.settings.find_one({})
        if settings and settings.get("prc_to_inr_rate"):
            return float(settings.get("prc_to_inr_rate"))
            
    except Exception as e:
        logging.error(f"Error getting PRC rate: {e}")
    
    return 2.0  # Default fallback


async def get_economy_settings() -> dict:
    """Get economy settings from database with defaults"""
    try:
        settings = await db.economy_settings.find_one({"active": True})
        if settings:
            return {
                "redeem_percent": settings.get("redeem_percent", DEFAULT_REDEEM_PERCENT),
                "burn_rate": settings.get("burn_rate", DEFAULT_BURN_RATE),
                "processing_fee_inr": settings.get("processing_fee_inr", DEFAULT_PROCESSING_FEE_INR),
                "admin_charge_percent": settings.get("admin_charge_percent", DEFAULT_ADMIN_CHARGE_PERCENT),
                "base_mining": settings.get("base_mining", DEFAULT_BASE_MINING),
                "min_prc_per_user": settings.get("min_prc_per_user", DEFAULT_MIN_PRC_PER_USER),
                "max_prc_per_user": settings.get("max_prc_per_user", DEFAULT_MAX_PRC_PER_USER),
            }
    except Exception as e:
        logging.error(f"Error getting economy settings: {e}")
    
    return {
        "redeem_percent": DEFAULT_REDEEM_PERCENT,
        "burn_rate": DEFAULT_BURN_RATE,
        "processing_fee_inr": DEFAULT_PROCESSING_FEE_INR,
        "admin_charge_percent": DEFAULT_ADMIN_CHARGE_PERCENT,
        "base_mining": DEFAULT_BASE_MINING,
        "min_prc_per_user": DEFAULT_MIN_PRC_PER_USER,
        "max_prc_per_user": DEFAULT_MAX_PRC_PER_USER,
    }


# ==================== MINING FORMULA ====================

def calculate_prc_per_user(network_size: int, min_prc: float = DEFAULT_MIN_PRC_PER_USER, max_prc: float = DEFAULT_MAX_PRC_PER_USER) -> float:
    """
    Calculate PRC per user based on network size (Decreasing formula)
    
    Formula: R(U) = max(min_prc, max_prc - 0.5 × log₂(U))
    
    As network grows, PRC per user decreases (anti-inflation)
    """
    if network_size <= 0:
        return max_prc
    
    # R(U) = max(3, 8 - 0.5 × log₂(U))
    log_value = math.log2(max(1, network_size))
    prc_per_user = max_prc - (0.5 * log_value)
    
    return max(min_prc, round(prc_per_user, 2))


def calculate_network_cap(direct_referrals: int) -> int:
    """
    Calculate maximum network capacity based on direct referrals
    
    Formula: NetworkCap = min(4000, 800 + 16 × D)
    """
    cap = DEFAULT_NETWORK_CAP_BASE + (DEFAULT_NETWORK_CAP_PER_REFERRAL * direct_referrals)
    return min(DEFAULT_MAX_NETWORK_CAP, cap)


async def calculate_mining_speed(user_id: str) -> dict:
    """
    Calculate user's mining speed based on their Growth Network
    
    Formula:
    - Base Mining: 550 PRC/day
    - Network Mining: U × R(U) where R(U) = max(3, 8 - 0.5 × log₂(U))
    - Total: 550 + Network Mining
    - Subscription Multiplier: Cash=100%, PRC=70%
    """
    settings = await get_economy_settings()
    
    # Get user data
    user = await db.users.find_one({"uid": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get direct referrals count
    direct_referrals = await db.users.count_documents({"referred_by": user_id})
    
    # Get network size (users in growth network - active members referred directly or indirectly)
    # For now, use direct referrals as network base
    network_size = await get_network_size(user_id)
    
    # Calculate network cap
    network_cap = calculate_network_cap(direct_referrals)
    
    # Limit network size to cap
    effective_network = min(network_size, network_cap)
    
    # Calculate PRC per user
    prc_per_user = calculate_prc_per_user(
        effective_network, 
        settings["min_prc_per_user"], 
        settings["max_prc_per_user"]
    )
    
    # Calculate network mining
    network_mining = effective_network * prc_per_user
    
    # Base mining
    base_mining = settings["base_mining"]
    
    # Subscription multiplier (Cash = 100%, PRC = 70%)
    subscription_type = user.get("subscription_payment_type", "cash")
    subscription_multiplier = 0.70 if subscription_type == "prc" else 1.0
    
    # Total daily PRC
    total_daily_prc = (base_mining + network_mining) * subscription_multiplier
    
    return {
        "base_mining": base_mining,
        "network_mining": round(network_mining, 2),
        "total_daily_prc": round(total_daily_prc, 2),
        "prc_per_user": prc_per_user,
        "network_size": effective_network,
        "network_cap": network_cap,
        "direct_referrals": direct_referrals,
        "subscription_multiplier": subscription_multiplier,
        "subscription_type": subscription_type
    }


async def get_network_size(user_id: str, max_depth: int = 10) -> int:
    """
    Get total network size (all users in growth network)
    Uses BFS to traverse referral tree
    """
    try:
        visited = set()
        queue = [user_id]
        total_count = 0
        
        while queue and len(visited) < DEFAULT_MAX_NETWORK_CAP:
            current_user = queue.pop(0)
            if current_user in visited:
                continue
            visited.add(current_user)
            
            # Find users referred by current user
            referrals = await db.users.find(
                {"referred_by": current_user},
                {"uid": 1, "_id": 0}
            ).to_list(1000)
            
            for ref in referrals:
                ref_uid = ref.get("uid")
                if ref_uid and ref_uid not in visited:
                    queue.append(ref_uid)
                    total_count += 1
        
        return total_count
    except Exception as e:
        logging.error(f"Error getting network size: {e}")
        return 0


# ==================== GROWTH NETWORK (REFERRAL) ====================

async def get_growth_network_stats(user_id: str) -> dict:
    """
    Get Growth Network statistics for a user
    
    Returns:
    - Direct Referrals count
    - Network Size (total members)
    - Network Cap (max capacity)
    - Growth Level
    - Unlock Percent
    """
    # Get direct referrals
    direct_referrals = await db.users.count_documents({"referred_by": user_id})
    
    # Get network size
    network_size = await get_network_size(user_id)
    
    # Calculate network cap
    network_cap = calculate_network_cap(direct_referrals)
    
    # Calculate growth level based on network size
    growth_level = calculate_growth_level(network_size)
    
    # Calculate unlock percent
    unlock_percent = await get_user_unlock_percent(user_id)
    
    return {
        "direct_referrals": direct_referrals,
        "network_size": network_size,
        "network_cap": network_cap,
        "growth_level": growth_level,
        "unlock_percent": unlock_percent
    }


def calculate_growth_level(network_size: int) -> int:
    """
    Calculate growth level based on cumulative network size.
    
    Per-Level Users × 5 = Points | Cumulative Users → Level → Unlock%
    L1:  2 users  (cum: 2)   → 10%
    L2:  4 users  (cum: 6)   → 20%
    L3:  8 users  (cum: 14)  → 30%
    L4:  16 users (cum: 30)  → 40%
    L5:  32 users (cum: 62)  → 50%
    L6:  64 users (cum: 126) → 60%
    L7:  128 users(cum: 254) → 70%
    L8:  200 users(cum: 454) → 80%
    L9:  200 users(cum: 654) → 90%
    L10: 146 users(cum: 800) → 100%
    """
    thresholds = [2, 6, 14, 30, 62, 126, 254, 454, 654, 800]
    level = 0
    for i, threshold in enumerate(thresholds):
        if network_size >= threshold:
            level = i + 1
    return level


async def get_user_unlock_percent(user_id: str) -> int:
    """
    Get user's unlock percentage based on Growth Network size.
    
    Network Size → Level → Unlock%:
    10→10%, 20→20%, 40→30%, 80→40%, 160→50%, 320→60%, 640→70%, 800→80%, 1000+→100%
    
    Admin can set a MAX CAP (default 70%). 
    Final unlock = min(network_unlock, admin_max_cap)
    """
    settings = await get_economy_settings()
    admin_max_cap = settings.get("redeem_percent", DEFAULT_REDEEM_PERCENT)
    
    # Calculate unlock from network level
    network_size = await get_network_size(user_id)
    growth_level = calculate_growth_level(network_size)
    network_unlock = min(100, growth_level * 10)
    
    # Cap at admin max
    final_unlock = min(network_unlock, admin_max_cap)
    
    return final_unlock


# ==================== REDEEM CALCULATION ====================

async def calculate_redeem_charges(redeem_prc: float, user_id: str = None) -> dict:
    """
    Calculate all redeem charges with Dynamic PRC Rate
    
    Formula:
    - Redeem Value: X PRC
    - PRC Burning: 5% of X
    - Processing Fee: ₹10 converted to PRC at dynamic rate
    - Admin Charges: 20% of X PRC
    
    Total Deducted = X + (5% burn) + (Processing PRC) + (20% admin)
    User Gets = X PRC × (1/PRC_Rate) = ₹ value
    """
    settings = await get_economy_settings()
    prc_rate = await get_dynamic_prc_rate()
    
    # Burn calculation (5% of redeem PRC)
    burn_rate = settings["burn_rate"] / 100
    burn_prc = round(redeem_prc * burn_rate, 2)
    
    # Processing fee (₹10 → PRC)
    processing_fee_inr = settings["processing_fee_inr"]
    processing_fee_prc = round(processing_fee_inr * prc_rate, 2)
    
    # Admin charges (20% of redeem PRC)
    admin_charge_percent = settings["admin_charge_percent"] / 100
    admin_charge_prc = round(redeem_prc * admin_charge_percent, 2)
    
    # Total PRC to be deducted from user
    total_prc_deducted = round(redeem_prc + burn_prc + processing_fee_prc + admin_charge_prc, 2)
    
    # INR user will receive
    user_gets_inr = round(redeem_prc / prc_rate, 2)
    
    return {
        "redeem_prc": redeem_prc,
        "burn_prc": burn_prc,
        "burn_rate_percent": settings["burn_rate"],
        "processing_fee_inr": processing_fee_inr,
        "processing_fee_prc": processing_fee_prc,
        "admin_charge_percent": settings["admin_charge_percent"],
        "admin_charge_prc": admin_charge_prc,
        "total_prc_deducted": total_prc_deducted,
        "user_gets_inr": user_gets_inr,
        "prc_rate": prc_rate,
        "breakdown": {
            "redeem_value": f"{redeem_prc} PRC",
            "burning": f"{burn_prc} PRC ({settings['burn_rate']}%)",
            "processing_fee": f"{processing_fee_prc} PRC (₹{processing_fee_inr})",
            "admin_charges": f"{admin_charge_prc} PRC ({settings['admin_charge_percent']}%)",
            "total_deducted": f"{total_prc_deducted} PRC",
            "you_get": f"₹{user_gets_inr}"
        }
    }


async def calculate_redeem_from_inr(inr_amount: float, user_id: str = None) -> dict:
    """
    Calculate PRC needed to redeem a specific INR amount
    
    If user wants ₹1000:
    - PRC needed = ₹1000 × PRC_Rate
    - Then add burn, processing, admin charges
    """
    prc_rate = await get_dynamic_prc_rate()
    
    # PRC equivalent for desired INR
    base_prc = round(inr_amount * prc_rate, 2)
    
    # Now calculate full charges
    return await calculate_redeem_charges(base_prc, user_id)


# ==================== API ENDPOINTS ====================

@router.get("/mining-speed/{user_id}")
async def api_get_mining_speed(user_id: str):
    """
    Get user's mining speed
    
    Returns:
    - Base Mining (550 PRC/day)
    - Network Mining (U × R(U))
    - Total Daily PRC
    - Network Size & Cap
    - Subscription Multiplier
    """
    try:
        speed = await calculate_mining_speed(user_id)
        return {
            "success": True,
            "data": speed
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Mining speed error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/network-stats/{user_id}")
async def api_get_network_stats(user_id: str):
    """
    Get Growth Network statistics
    
    Returns:
    - Direct Referrals
    - Network Size
    - Network Cap
    - Growth Level
    - Unlock Percent
    """
    try:
        stats = await get_growth_network_stats(user_id)
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        logging.error(f"Network stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calculate-redeem")
async def api_calculate_redeem(redeem_prc: float, user_id: str = None):
    """
    Calculate redeem charges for given PRC amount
    
    All calculations use Dynamic PRC Rate
    """
    try:
        if redeem_prc <= 0:
            raise HTTPException(status_code=400, detail="Redeem PRC must be positive")
        
        charges = await calculate_redeem_charges(redeem_prc, user_id)
        return {
            "success": True,
            "data": charges
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Redeem calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calculate-redeem-inr")
async def api_calculate_redeem_from_inr(inr_amount: float, user_id: str = None):
    """
    Calculate PRC needed to redeem specific INR amount
    """
    try:
        if inr_amount <= 0:
            raise HTTPException(status_code=400, detail="INR amount must be positive")
        
        charges = await calculate_redeem_from_inr(inr_amount, user_id)
        return {
            "success": True,
            "data": charges
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Redeem INR calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/economy-settings")
async def api_get_economy_settings():
    """Get current economy settings"""
    try:
        settings = await get_economy_settings()
        prc_rate = await get_dynamic_prc_rate()
        return {
            "success": True,
            "data": {
                **settings,
                "prc_rate": prc_rate
            }
        }
    except Exception as e:
        logging.error(f"Economy settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prc-rate")
async def api_get_prc_rate():
    """Get current dynamic PRC rate"""
    try:
        rate = await get_dynamic_prc_rate()
        return {
            "success": True,
            "prc_rate": rate,
            "description": f"{rate} PRC = ₹1"
        }
    except Exception as e:
        logging.error(f"PRC rate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/economy-settings")
async def api_update_economy_settings(
    redeem_percent: int = None,
    burn_rate: float = None,
    processing_fee_inr: float = None,
    admin_charge_percent: float = None,
    base_mining: int = None
):
    """
    Admin: Update economy settings
    
    Options:
    - redeem_percent: 50, 60, 70, 80, 100
    - burn_rate: Default 5%
    - processing_fee_inr: Default ₹10
    - admin_charge_percent: Default 20%
    - base_mining: Default 550
    """
    try:
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        
        if redeem_percent is not None:
            if redeem_percent not in [50, 60, 70, 80, 100]:
                raise HTTPException(status_code=400, detail="Redeem percent must be 50, 60, 70, 80, or 100")
            update_data["redeem_percent"] = redeem_percent
        
        if burn_rate is not None:
            if burn_rate < 0 or burn_rate > 20:
                raise HTTPException(status_code=400, detail="Burn rate must be between 0 and 20")
            update_data["burn_rate"] = burn_rate
        
        if processing_fee_inr is not None:
            if processing_fee_inr < 0:
                raise HTTPException(status_code=400, detail="Processing fee must be positive")
            update_data["processing_fee_inr"] = processing_fee_inr
        
        if admin_charge_percent is not None:
            if admin_charge_percent < 0 or admin_charge_percent > 50:
                raise HTTPException(status_code=400, detail="Admin charge must be between 0 and 50")
            update_data["admin_charge_percent"] = admin_charge_percent
        
        if base_mining is not None:
            if base_mining < 0:
                raise HTTPException(status_code=400, detail="Base mining must be positive")
            update_data["base_mining"] = base_mining
        
        # Upsert economy settings
        await db.economy_settings.update_one(
            {"active": True},
            {"$set": update_data},
            upsert=True
        )
        
        # Get updated settings
        settings = await get_economy_settings()
        
        return {
            "success": True,
            "message": "Economy settings updated",
            "data": settings
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Update economy settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/set-prc-rate")
async def api_set_prc_rate(rate: float, expires_hours: int = None):
    """
    Admin: Set manual PRC rate override
    
    Args:
    - rate: PRC per INR (e.g., 2.0 means 2 PRC = ₹1)
    - expires_hours: Optional, how long override lasts (None = permanent)
    """
    try:
        if rate <= 0:
            raise HTTPException(status_code=400, detail="Rate must be positive")
        
        override_data = {
            "key": "prc_rate_manual_override",
            "enabled": True,
            "rate": rate,
            "set_at": datetime.now(timezone.utc).isoformat(),
            "set_by": "admin"
        }
        
        if expires_hours:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
            override_data["expires_at"] = expires_at.isoformat()
        else:
            override_data["expires_at"] = None
        
        await db.app_settings.update_one(
            {"key": "prc_rate_manual_override"},
            {"$set": override_data},
            upsert=True
        )
        
        return {
            "success": True,
            "message": f"PRC rate set to {rate}",
            "expires_at": override_data.get("expires_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Set PRC rate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/prc-rate-override")
async def api_remove_prc_rate_override():
    """Admin: Remove manual PRC rate override, return to dynamic calculation"""
    try:
        await db.app_settings.update_one(
            {"key": "prc_rate_manual_override"},
            {"$set": {"enabled": False}}
        )
        
        rate = await get_dynamic_prc_rate()
        
        return {
            "success": True,
            "message": "PRC rate override removed, using dynamic rate",
            "current_rate": rate
        }
    except Exception as e:
        logging.error(f"Remove PRC rate override error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
