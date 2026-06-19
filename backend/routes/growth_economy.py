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

=== FORMULA LOCK v1.0 (April 2026) ===
3 Core Formulas are LOCKED. Do NOT modify without admin confirmation.
1. Network Size → Single Leg Tree (get_active_network_size)
2. Mining Speed → Single Leg Tree (calculate_mining_rate in mining.py)
3. Redeem Unlock % → Single Leg Tree (get_user_unlock_percent)
Locked by: Admin directive, April 9 2026
"""

import math
import logging
import asyncio
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/growth", tags=["Growth Economy"])

# Database reference (set from main server)
db = None

# 60-second TTL cache for active network size — called on every redeem-limit
# check, every admin page row, every dashboard load.
_ACTIVE_NETWORK_CACHE: dict = {}  # uid -> (ts_sec, int_count)
_ACTIVE_NETWORK_CACHE_TTL: float = 60.0


def invalidate_active_network_cache(user_id=None):
    if user_id:
        _ACTIVE_NETWORK_CACHE.pop(user_id, None)
    else:
        _ACTIVE_NETWORK_CACHE.clear()


def set_db(database):
    global db
    db = database


# ==================== CONSTANTS ====================

DEFAULT_BASE_MINING = 1000  # Base daily PRC (user's own mining) — matches mining.py
DEFAULT_BASE_MINING_THRESHOLD = 250  # Network size threshold: base=1000 if < 250, base=0 if >= 250
DEFAULT_NETWORK_CAP_BASE = 800  # Tier 1: Base cap
DEFAULT_NETWORK_CAP_DIRECT_MAX = 4000  # Tier 2: Max from directs (L1)
DEFAULT_NETWORK_CAP_MAX = 8000  # Tier 6: Absolute max from L1-L5 cascade
DEFAULT_CAP_PER_DIRECT = 16  # +16 cap per L1 (direct) referral
DEFAULT_CAP_PER_L1_INDIRECT = 5  # +5 cap per L2 (L1 indirect) referral
DEFAULT_CAP_PER_L3 = 3  # +3 cap per L3 referral
DEFAULT_CAP_PER_L4 = 2  # +2 cap per L4 referral
DEFAULT_CAP_PER_L5 = 1  # +1 cap per L5 referral
DEFAULT_MIN_PRC_PER_USER = 2.5  # Minimum PRC per user in team (at 16384 users)
DEFAULT_MAX_PRC_PER_USER = 7.142857  # Maximum PRC per user (at 2 users = 50/7)

DEFAULT_REDEEM_PERCENT = 70  # Default redeem percentage
DEFAULT_BURN_RATE_PRC = 5  # 5% burn for Elite by PRC
DEFAULT_BURN_RATE_CASH = 1  # 1% burn for Elite by Cash/Razorpay
DEFAULT_PROCESSING_FEE_INR = 10  # ₹10 processing fee
DEFAULT_ADMIN_CHARGE_PERCENT = 20  # 20% admin charges on PRC


# ==================== FORMULA LOCK SYSTEM ====================
# LOCKED: April 9, 2026 — DO NOT MODIFY WITHOUT ADMIN CONFIRMATION
# These tiers and formulas are immutable. Any change requires explicit unlock.

LOCKED_TIER_TABLE = (
    (2, 4), (4, 4), (8, 5), (16, 6), (32, 6), (64, 6),
    (128, 7), (256, 7), (512, 8), (1024, 9), (2048, 9),
    (4096, 9), (8192, 10)
)

# Integrity hash of the locked tier table — used to detect tampering
LOCKED_TIER_HASH = hashlib.sha256(str(LOCKED_TIER_TABLE).encode()).hexdigest()

FORMULA_LOCK = {
    "version": "1.0",
    "locked_at": "2026-04-09",
    "locked_by": "Admin Directive",
    "formulas": {
        "network_size": "Single Leg Tree (tree_position > my_position, paid + mining_active)",
        "mining_speed": "Single Leg Tree → effective_network × prc_per_user (mining.py)",
        "redeem_unlock_pct": "Single Leg Tree → calculate_growth_level(active_network_size)"
    },
    "tier_hash": LOCKED_TIER_HASH,
    "max_unlock_pct": 90,
    "tier_count": 13
}

def verify_formula_integrity():
    """Verify that locked formulas have not been tampered with."""
    errors = []
    
    # 1. Verify tier table hash
    current_hash = hashlib.sha256(str(LOCKED_TIER_TABLE).encode()).hexdigest()
    if current_hash != LOCKED_TIER_HASH:
        errors.append("TIER TABLE TAMPERED: hash mismatch")
    
    # 2. Verify tier count
    if len(LOCKED_TIER_TABLE) != 13:
        errors.append(f"TIER COUNT CHANGED: expected 13, got {len(LOCKED_TIER_TABLE)}")
    
    # 3. Verify max unlock is 90%
    total = sum(c for _, c in LOCKED_TIER_TABLE)
    if total != 90:
        errors.append(f"MAX UNLOCK CHANGED: expected 90%, got {total}%")
    
    # 4. Verify known checkpoints
    checkpoints = {1: 2.0, 33: 25.19, 253: 44.84, 334: 47.44, 487: 52.22}
    for net_size, expected_pct in checkpoints.items():
        calc = calculate_growth_level(net_size)
        if abs(calc - expected_pct) > 0.01:
            errors.append(f"FORMULA DRIFT: network={net_size}, expected={expected_pct}%, got={calc}%")
    
    return {
        "locked": True,
        "version": FORMULA_LOCK["version"],
        "integrity": "VALID" if not errors else "COMPROMISED",
        "errors": errors,
        "tier_hash": current_hash,
        "tier_count": len(LOCKED_TIER_TABLE),
        "max_unlock_pct": sum(c for _, c in LOCKED_TIER_TABLE),
        "formulas": FORMULA_LOCK["formulas"]
    }


# ==================== PYDANTIC MODELS ====================

class EconomySettings(BaseModel):
    redeem_percent: int = DEFAULT_REDEEM_PERCENT
    burn_rate: float = DEFAULT_BURN_RATE_PRC
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
    """Get dynamic PRC rate - delegates to single source of truth."""
    from utils.helpers import get_prc_rate
    return float(await get_prc_rate(db))


async def get_economy_settings() -> dict:
    """Get economy settings from database with defaults"""
    try:
        settings = await db.economy_settings.find_one({"active": True})
        if settings:
            return {
                "redeem_percent": settings.get("redeem_percent", DEFAULT_REDEEM_PERCENT),
                "burn_rate_prc": settings.get("burn_rate_prc", DEFAULT_BURN_RATE_PRC),
                "burn_rate_cash": settings.get("burn_rate_cash", DEFAULT_BURN_RATE_CASH),
                "burn_rate": settings.get("burn_rate", DEFAULT_BURN_RATE_PRC),
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
        "burn_rate_prc": DEFAULT_BURN_RATE_PRC,
        "burn_rate_cash": DEFAULT_BURN_RATE_CASH,
        "burn_rate": DEFAULT_BURN_RATE_PRC,
        "processing_fee_inr": DEFAULT_PROCESSING_FEE_INR,
        "admin_charge_percent": DEFAULT_ADMIN_CHARGE_PERCENT,
        "base_mining": DEFAULT_BASE_MINING,
        "min_prc_per_user": DEFAULT_MIN_PRC_PER_USER,
        "max_prc_per_user": DEFAULT_MAX_PRC_PER_USER,
    }


# ==================== MINING FORMULA ====================

def calculate_prc_per_user(network_size: int, min_prc: float = DEFAULT_MIN_PRC_PER_USER, max_prc: float = DEFAULT_MAX_PRC_PER_USER) -> float:
    """
    Calculate PRC per user in network based on network size (Growth Network).
    
    Formula: PRC_per_user = max(2.5, 5 × (21 - log₂(N)) / 14)
    
    Spreadsheet reference:
    | Users | PRC/User |
    |   2   |  7.14    |
    |   4   |  6.79    |
    |   8   |  6.43    |
    |  16   |  6.07    |
    |  32   |  5.71    |
    |  64   |  5.36    |
    | 128   |  5.00    |
    | 256   |  4.64    |
    | 512   |  4.29    |
    | 1024  |  3.93    |
    | 2048  |  3.57    |
    | 4096  |  3.21    |
    | 8192  |  2.86    |
    |16384  |  2.50    |
    """
    if network_size <= 0:
        return 0  # No team = no team bonus
    
    if network_size == 1:
        return max_prc  # 1 user = max rate
    
    # PRC_per_user = max(2.5, 5 × (21 - log₂(N)) / 14)
    log_value = math.log2(max(2, network_size))
    prc_per_user = 5 * (21 - log_value) / 14
    
    return round(max(min_prc, prc_per_user), 6)


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
    """
    tier1 = DEFAULT_NETWORK_CAP_BASE  # 800
    tier2_bonus = DEFAULT_CAP_PER_DIRECT * direct_referrals  # 16 x L1
    tier3_bonus = DEFAULT_CAP_PER_L1_INDIRECT * l1_indirect_referrals  # 5 x L2
    tier4_bonus = DEFAULT_CAP_PER_L3 * l3_count  # 3 x L3
    tier5_bonus = DEFAULT_CAP_PER_L4 * l4_count  # 2 x L4
    tier6_bonus = DEFAULT_CAP_PER_L5 * l5_count  # 1 x L5
    
    raw_cap = tier1 + tier2_bonus + tier3_bonus + tier4_bonus + tier5_bonus + tier6_bonus
    final_cap = min(DEFAULT_NETWORK_CAP_MAX, raw_cap)
    
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


async def get_l1_indirect_count(user_id: str) -> int:
    """
    Count L1 Indirect Referrals = users referred by user's direct referrals.
    Handles mixed referred_by (uid or referral_code).
    """
    counts = await get_downline_level_counts(user_id, max_depth=2)
    return counts.get("l2", 0)


async def get_downline_level_counts(user_id: str, max_depth: int = 5) -> dict:
    """
    BFS walk the referral tree from user_id up to max_depth (default L1-L5).
    Returns counts at each level: {"l1": int, "l2": int, "l3": int, "l4": int, "l5": int}
    Handles mixed referred_by (uid or referral_code).
    """
    counts = {f"l{i}": 0 for i in range(1, max_depth + 1)}
    try:
        # Seed with the user's own uid + referral_code
        user_doc = await db.users.find_one({"uid": user_id}, {"_id": 0, "referral_code": 1})
        seed_values = [user_id]
        if user_doc and user_doc.get("referral_code"):
            seed_values.append(user_doc["referral_code"])
        
        current_parents = list(set(seed_values))
        for depth in range(1, max_depth + 1):
            if not current_parents:
                break
            children = await db.users.find(
                {"referred_by": {"$in": current_parents}},
                {"_id": 0, "uid": 1, "referral_code": 1}
            ).to_list(50000)
            counts[f"l{depth}"] = len(children)
            if not children:
                break
            # Next parents = uids + referral_codes of these children
            next_parents = [c["uid"] for c in children if c.get("uid")]
            next_parents += [c["referral_code"] for c in children if c.get("referral_code")]
            current_parents = list(set(next_parents))
        return counts
    except Exception as e:
        logging.error(f"Error walking downline for {user_id}: {e}")
        return counts


async def calculate_mining_speed(user_id: str) -> dict:
    """
    Wrapper: calls the single source-of-truth formula in mining.py.
    Kept for backward compatibility with growth economy stats API.
    """
    from routes.mining import calculate_mining_rate
    rate_data = await calculate_mining_rate(user_id)
    if "error" in rate_data:
        raise HTTPException(status_code=404, detail=rate_data["error"])
    
    return {
        "base_mining": rate_data.get("base_rate", 0),
        "network_mining": rate_data.get("network_rate", 0),
        "total_daily_prc": rate_data.get("total_daily_rate", 0),
        "prc_per_user": rate_data.get("prc_per_user", 0),
        "network_size": rate_data.get("network_size", 0),
        "raw_network_size": rate_data.get("raw_network_size", 0),
        "network_cap": rate_data.get("network_cap", 0),
        "direct_referrals": rate_data.get("direct_referrals", 0),
        "l1_indirect_referrals": rate_data.get("l1_indirect_referrals", 0),
        "l3_count": rate_data.get("l3_count", 0),
        "l4_count": rate_data.get("l4_count", 0),
        "l5_count": rate_data.get("l5_count", 0),
        "cap_tier1_base": rate_data.get("cap_tier1_base", 0),
        "cap_tier2_bonus": rate_data.get("cap_tier2_bonus", 0),
        "cap_tier3_bonus": rate_data.get("cap_tier3_bonus", 0),
        "cap_tier4_bonus": rate_data.get("cap_tier4_bonus", 0),
        "cap_tier5_bonus": rate_data.get("cap_tier5_bonus", 0),
        "cap_tier6_bonus": rate_data.get("cap_tier6_bonus", 0),
        "subscription_multiplier": rate_data.get("boost_multiplier", 1.0),
        "per_hour_prc": round(rate_data.get("total_daily_rate", 0) / 24, 2),
    }


async def get_tree_network_size(user_id: str) -> int:
    """
    Get TOTAL network size based on Single Leg Tree position.
    
    In Single Leg Tree, ALL users below your position are in your network.
    This is the CORRECT function for redeem limit % calculation.
    
    network_size = count of users WHERE tree_position > my_tree_position
    """
    try:
        user = await db.users.find_one(
            {"uid": user_id},
            {"_id": 0, "tree_position": 1}
        )
        if not user or not user.get("tree_position"):
            return 0
        
        my_position = user["tree_position"]
        count = await db.users.count_documents({"tree_position": {"$gt": my_position}})
        return count
    except Exception as e:
        logging.error(f"Error getting tree network size for {user_id}: {e}")
        return 0



async def get_network_size(user_id: str, max_depth: int = 10) -> int:
    """
    Get total network size = all users referred by this user (direct + indirect).
    
    Network = Direct referrals + their referrals (recursive).
    This counts ALL referrals, not just active ones.
    
    IMPORTANT: referred_by field may contain either uid OR referral_code,
    so we must query both to ensure accurate BFS traversal.
    """
    try:
        # Get user's referral_code too (referred_by can store either uid or referral_code)
        user = await db.users.find_one({"uid": user_id}, {"_id": 0, "uid": 1, "referral_code": 1})
        if not user:
            return 0
        
        referral_code = user.get("referral_code", "")
        
        # Count direct referrals using both uid and referral_code
        or_conditions = [{"referred_by": user_id}]
        if referral_code:
            or_conditions.append({"referred_by": referral_code})
        
        direct_count = await db.users.count_documents({"$or": or_conditions})
        
        if direct_count == 0:
            return 0
        
        # BFS to count all downstream referrals
        total = 0
        current_level_ids = [user_id]
        current_level_codes = [referral_code] if referral_code else []
        visited = {user_id}
        
        for depth in range(max_depth):
            if not current_level_ids and not current_level_codes:
                break
            
            # Build match: referred_by matches ANY uid or referral_code in current level
            search_values = list(set(current_level_ids + current_level_codes))
            if not search_values:
                break
            
            next_level_users = await db.users.find(
                {"referred_by": {"$in": search_values}},
                {"_id": 0, "uid": 1, "referral_code": 1}
            ).to_list(length=10000)
            
            if not next_level_users:
                break
            
            # Deduplicate (avoid counting same user twice or infinite loops)
            new_users = [u for u in next_level_users if u["uid"] not in visited]
            if not new_users:
                break
            
            total += len(new_users)
            for u in new_users:
                visited.add(u["uid"])
            
            current_level_ids = [u["uid"] for u in new_users]
            current_level_codes = [u.get("referral_code", "") for u in new_users if u.get("referral_code")]
        
        return total
    except Exception as e:
        logging.error(f"Error getting network size: {e}")
        return 0


async def get_active_network_size(user_id: str) -> int:
    """
    Get ACTIVE network size for mining reward calculation.
    Active = paid subscription + active mining session.
    Uses tree_position for single leg tree lookup.

    60-second in-memory cache — called from redeem-limit + dashboard + admin
    pages on every request, don't need minute-level freshness.
    """
    import time as _t
    now_sec = _t.time()
    cached = _ACTIVE_NETWORK_CACHE.get(user_id)
    if cached and (now_sec - cached[0] < _ACTIVE_NETWORK_CACHE_TTL):
        return cached[1]
    try:
        now = datetime.now(timezone.utc)
        now_str = now.isoformat()

        user = await db.users.find_one(
            {"uid": user_id},
            {"_id": 0, "tree_position": 1}
        )
        if not user or not user.get("tree_position"):
            _ACTIVE_NETWORK_CACHE[user_id] = (now_sec, 0)
            return 0
        
        my_position = user["tree_position"]
        
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
        _ACTIVE_NETWORK_CACHE[user_id] = (now_sec, total_count)
        # Cheap cleanup
        if len(_ACTIVE_NETWORK_CACHE) > 5000:
            stale = [k for k, (ts, _) in _ACTIVE_NETWORK_CACHE.items()
                     if now_sec - ts >= _ACTIVE_NETWORK_CACHE_TTL]
            for k in stale:
                _ACTIVE_NETWORK_CACHE.pop(k, None)
        return total_count
    except Exception as e:
        logging.error(f"Error getting active network size: {e}")
        return 0


# ==================== GROWTH NETWORK (REFERRAL) ====================

async def get_growth_network_stats(user_id: str) -> dict:
    """
    Get Growth Network statistics with 6-Tier Cap breakdown (L1-L5 cascade).
    """
    # Get user's referral_code for mixed referred_by lookup
    user_doc = await db.users.find_one({"uid": user_id}, {"_id": 0, "referral_code": 1})
    user_ref_code = user_doc.get("referral_code", "") if user_doc else ""
    
    ref_or = [{"referred_by": user_id}]
    if user_ref_code:
        ref_or.append({"referred_by": user_ref_code})
    
    # Parallel fetch (L1-L5 counts come from one BFS walk)
    direct_referrals, level_counts, network_size, active_network_size, tree_network_size = await asyncio.gather(
        db.users.count_documents({"$or": ref_or}),
        get_downline_level_counts(user_id, max_depth=5),
        get_network_size(user_id),
        get_active_network_size(user_id),
        get_tree_network_size(user_id)
    )
    
    l2_count = level_counts.get("l2", 0)
    l3_count = level_counts.get("l3", 0)
    l4_count = level_counts.get("l4", 0)
    l5_count = level_counts.get("l5", 0)
    
    # Calculate 6-tier network cap (L1-L5 cascade)
    cap_info = calculate_network_cap(direct_referrals, l2_count, l3_count, l4_count, l5_count)
    
    # Calculate redeem limit % based on ACTIVE network (tree_position + paid + mining active)
    redeem_limit_percent = calculate_growth_level(active_network_size)
    
    return {
        "direct_referrals": direct_referrals,
        "l1_indirect_referrals": l2_count,
        "l3_count": l3_count,
        "l4_count": l4_count,
        "l5_count": l5_count,
        "network_size": active_network_size,
        "referral_network_size": network_size,
        "active_network_size": active_network_size,
        "tree_network_size": tree_network_size,
        "network_cap": cap_info["cap"],
        "cap_tier1_base": cap_info["tier1_base"],
        "cap_tier2_bonus": cap_info["tier2_bonus"],
        "cap_tier3_bonus": cap_info["tier3_bonus"],
        "cap_tier4_bonus": cap_info["tier4_bonus"],
        "cap_tier5_bonus": cap_info["tier5_bonus"],
        "cap_tier6_bonus": cap_info["tier6_bonus"],
        "redeem_limit_percent": redeem_limit_percent,
        "unlock_percent": redeem_limit_percent
    }


def calculate_growth_level(network_size: int) -> float:
    """
    LOCKED FORMULA v1.0 (April 9, 2026)
    ====================================
    Calculate CUMULATIVE redeem limit percentage based on SINGLE LEG TREE network size.
    
    Uses LOCKED_TIER_TABLE — DO NOT MODIFY without admin confirmation.
    
    | Team  | Tier %  | Cumulative % |
    |   2   |   4     |      4       |
    |   4   |   4     |      8       |
    |   8   |   5     |     13       |
    |  16   |   6     |     19       |
    |  32   |   6     |     25       |
    |  64   |   6     |     31       |
    | 128   |   7     |     38       |
    | 256   |   7     |     45       |
    | 512   |   8     |     53       |
    |1024   |   9     |     62       |
    |2048   |   9     |     71       |
    |4096   |   9     |     80       |
    |8192   |  10     |     90       |
    
    Between tiers, contribution is proportional per user.
    Max total: 90%
    """
    if network_size < 1:
        return 0
    
    total = 0
    prev = 0
    for threshold, contribution in LOCKED_TIER_TABLE:
        bracket_size = threshold - prev
        if network_size >= threshold:
            total += contribution
        elif network_size > prev:
            total += (network_size - prev) / bracket_size * contribution
            break
        else:
            break
        prev = threshold
    
    return round(total, 2)


async def get_user_unlock_percent(user_id: str) -> float:
    """
    LOCKED FORMULA v1.0 (April 9, 2026)
    ====================================
    Get user's unlock percentage based on Single Leg Tree active network size.
    Uses tree_position-based active network (same as mining reward).
    DO NOT CHANGE to BFS/referral network without admin confirmation.
    """
    network_size = await get_active_network_size(user_id)
    unlock_percent = calculate_growth_level(network_size)
    
    return unlock_percent


# ==================== REDEEM CALCULATION ====================

async def calculate_redeem_charges(redeem_prc: float, user_id: str = None) -> dict:
    """
    Calculate all redeem charges with Dynamic Burn Rate
    
    Burn Rate:
    - Elite by Cash/Razorpay: 1% burn
    - Elite by PRC: 5% burn
    
    Other Charges:
    - Processing Fee: ₹10 converted to PRC at dynamic rate
    - Admin Charges: 20% of X PRC
    """
    settings = await get_economy_settings()
    prc_rate = await get_dynamic_prc_rate()
    
    # Dynamic burn rate based on subscription payment type
    burn_rate_percent = settings["burn_rate_cash"]  # Default 1% (Cash/Razorpay)
    subscription_payment_type = "cash"
    
    if user_id:
        user = await db.users.find_one({"uid": user_id}, {"_id": 0, "subscription_payment_type": 1})
        if user:
            subscription_payment_type = user.get("subscription_payment_type", "cash")
            if subscription_payment_type == "prc":
                burn_rate_percent = settings["burn_rate_prc"]  # 5% for PRC subscription
    
    # Burn calculation
    burn_rate = burn_rate_percent / 100
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
        "burn_rate_percent": burn_rate_percent,
        "subscription_payment_type": subscription_payment_type,
        "processing_fee_inr": processing_fee_inr,
        "processing_fee_prc": processing_fee_prc,
        "admin_charge_percent": settings["admin_charge_percent"],
        "admin_charge_prc": admin_charge_prc,
        "total_prc_deducted": total_prc_deducted,
        "user_gets_inr": user_gets_inr,
        "prc_rate": prc_rate,
        "breakdown": {
            "redeem_value": f"{redeem_prc} PRC",
            "burning": f"{burn_prc} PRC ({burn_rate_percent}%)",
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


# ==================== FORMULA LOCK VERIFICATION ====================

@router.get("/admin/formula-lock-status")
async def get_formula_lock_status():
    """
    Admin endpoint: Verify integrity of all 3 locked formulas.
    Returns VALID if all formulas are unchanged, COMPROMISED if any drift detected.
    """
    result = verify_formula_integrity()
    return {"success": True, "lock_status": result}
