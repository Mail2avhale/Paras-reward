"""
PARAS REWARD - Common Utilities
================================
Helper functions used across the application
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import hashlib
import secrets
import string


# =============== PRC DYNAMIC RATE — SINGLE SOURCE OF TRUTH ===============
# ALL modules MUST use this function instead of local rate lookups.
# Priority: Manual Override → system_settings cache → Recalculate → Default 10

PRC_INR_RATE_DEFAULT = 10  # 10 PRC = ₹1 (base reference)
_rate_cache = {}
_RATE_CACHE_TTL = 300  # 5 minutes

async def get_prc_rate(database) -> int:
    """
    SINGLE SOURCE OF TRUTH for PRC dynamic rate.
    
    Priority:
    1. Manual override (app_settings.prc_rate_manual_override) — if enabled and not expired
    2. Cached dynamic rate (system_settings.prc_dynamic_rate) — if < 5 min old
    3. Fresh calculation via prc_economy.calculate_dynamic_prc_rate — saves result to DB
    4. Default: 10
    
    Returns: int (e.g., 11 means 11 PRC = 1 INR)
    """
    import logging
    
    # Priority 1: Manual override
    try:
        override = await database.app_settings.find_one({"key": "prc_rate_manual_override"})
        if override and override.get("enabled"):
            override_rate = override.get("rate")
            expires_at = override.get("expires_at")
            if expires_at:
                try:
                    expiry = datetime.fromisoformat(str(expires_at).replace('Z', '+00:00'))
                    if expiry > datetime.now(timezone.utc):
                        return int(override_rate)
                except Exception:
                    pass
            elif override_rate and override_rate > 0:
                return int(override_rate)
    except Exception as e:
        logging.warning(f"[PRC RATE] Override check failed: {e}")
    
    # Priority 2: Cached DB rate (shared across all workers)
    try:
        saved = await database.system_settings.find_one(
            {"type": "prc_dynamic_rate"},
            {"_id": 0, "final_rate": 1, "updated_at": 1, "calculated_at": 1}
        )
        if saved and saved.get("final_rate"):
            updated = saved.get("updated_at") or saved.get("calculated_at")
            if updated:
                if isinstance(updated, str):
                    updated = datetime.fromisoformat(updated.replace('Z', '+00:00'))
                if updated.tzinfo is None:
                    updated = updated.replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - updated).total_seconds()
                if age < _RATE_CACHE_TTL:
                    return int(saved["final_rate"])
    except Exception as e:
        logging.warning(f"[PRC RATE] DB cache read failed: {e}")
    
    # Priority 3: Recalculate fresh
    try:
        from routes.prc_economy import calculate_dynamic_prc_rate
        rate_data = await calculate_dynamic_prc_rate(database)
        if rate_data:
            if isinstance(rate_data, dict):
                return int(rate_data.get("final_rate", PRC_INR_RATE_DEFAULT))
            return int(rate_data)
    except Exception as e:
        logging.warning(f"[PRC RATE] Economy calculation failed: {e}")
    
    # Priority 4: Any stored rate (even stale)
    try:
        saved = await database.system_settings.find_one(
            {"type": "prc_dynamic_rate"}, {"_id": 0, "final_rate": 1}
        )
        if saved and saved.get("final_rate"):
            return int(saved["final_rate"])
    except Exception:
        pass
    
    return PRC_INR_RATE_DEFAULT


def get_prc_rate_sync(database_sync=None) -> int:
    """
    Synchronous version for non-async contexts.
    Reads from system_settings only (no recalculation).
    """
    import logging
    try:
        if database_sync is None:
            from pymongo import MongoClient
            import os
            client = MongoClient(os.environ.get("MONGO_URL"))
            database_sync = client[os.environ.get("DB_NAME", "test_database")]
        
        stored = database_sync.system_settings.find_one(
            {"type": "prc_dynamic_rate"}, {"_id": 0, "final_rate": 1}
        )
        if stored and stored.get("final_rate"):
            return int(stored["final_rate"])
    except Exception as e:
        logging.error(f"[PRC RATE SYNC] Failed: {e}")
    
    return PRC_INR_RATE_DEFAULT



def generate_referral_code(length: int = 8) -> str:
    """Generate a random referral code"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(length))


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP"""
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def get_current_time() -> datetime:
    """Get current UTC time"""
    return datetime.now(timezone.utc)


def is_subscription_active(user: dict) -> bool:
    """
    BULLETPROOF check if user has active paid subscription.
    Single source of truth — used by burning.py, mining.py, and all other modules.
    Rules:
    1. Explorer/free plan → NOT active (even if status says "active" — data inconsistency)
    2. subscription_status == "active" → True
    3. Any expiry date in future → True
    4. Paid plan (elite/vip/growth) + NO expiry data → ASSUME True (safe default)
    5. subscription_expired == True → False
    6. Otherwise → False
    """
    # Rule 1: Explorer/free = not active
    plan = user.get('subscription_plan', 'explorer').lower()
    if plan in ['explorer', 'free', '', 'none']:
        return False
    
    now = datetime.now(timezone.utc)
    
    # Rule 2: Explicit active status
    if user.get('subscription_status') == 'active':
        return True
    
    # Rule 3: Check expiry dates
    has_expiry = False
    for field in ['subscription_expiry', 'subscription_expires', 'vip_expiry', 'subscription_end_date']:
        expiry = user.get(field)
        if not expiry:
            continue
        has_expiry = True
        if isinstance(expiry, str):
            try:
                expiry_date = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
            except:
                continue
        else:
            expiry_date = expiry
        
        if expiry_date.tzinfo is None:
            expiry_date = expiry_date.replace(tzinfo=timezone.utc)
        
        if now < expiry_date:
            return True
    
    # Rule 4: Paid plan + no expiry → assume active (missing data ≠ expired)
    if not has_expiry and plan in ['elite', 'vip', 'startup', 'growth', 'pro', 'premium']:
        return True
    
    # Rule 5: Explicitly expired
    if user.get('subscription_expired') == True:
        return False
    
    return False


def get_subscription_plan(user: dict) -> str:
    """Get user's subscription plan"""
    return user.get('subscription_plan', 'explorer').lower()


def is_paid_subscriber(user: dict) -> bool:
    """Check if user is a paid subscriber (not free/explorer)"""
    plan = get_subscription_plan(user)
    return plan not in ['explorer', 'free', '', None] and is_subscription_active(user)


def is_kyc_verified(user: dict) -> bool:
    """Check if user has verified KYC"""
    return user.get('kyc_status', '').lower() == 'verified'


def format_currency(amount: float, currency: str = "₹") -> str:
    """Format amount as currency string"""
    return f"{currency}{amount:,.2f}"


def format_prc(amount: float) -> str:
    """Format PRC amount"""
    return f"{amount:,.2f} PRC"


def safe_float(value: Any, default: float = 0.0) -> float:
    """Safely convert value to float"""
    try:
        return float(value) if value is not None else default
    except (ValueError, TypeError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    """Safely convert value to int"""
    try:
        return int(value) if value is not None else default
    except (ValueError, TypeError):
        return default


def hash_string(value: str) -> str:
    """Create SHA256 hash of a string"""
    return hashlib.sha256(value.encode()).hexdigest()


def mask_email(email: str) -> str:
    """Mask email for privacy (e.g., t***@gmail.com)"""
    if not email or '@' not in email:
        return email
    
    local, domain = email.split('@', 1)
    if len(local) <= 2:
        masked_local = local[0] + '***'
    else:
        masked_local = local[0] + '***' + local[-1]
    
    return f"{masked_local}@{domain}"


def mask_phone(phone: str) -> str:
    """Mask phone number for privacy (e.g., ******1234)"""
    if not phone:
        return phone
    
    # Remove non-digits
    digits = ''.join(c for c in phone if c.isdigit())
    
    if len(digits) <= 4:
        return '*' * len(digits)
    
    return '*' * (len(digits) - 4) + digits[-4:]


def calculate_prc_to_inr(prc_amount: float, rate: float = 10.0) -> float:
    """Convert PRC to INR (estimated value)"""
    return prc_amount / rate


def calculate_inr_to_prc(inr_amount: float, rate: float = 10.0) -> float:
    """Convert INR to PRC"""
    return inr_amount * rate


def get_greeting() -> str:
    """Get time-based greeting"""
    hour = datetime.now(timezone.utc).hour
    
    if 5 <= hour < 12:
        return "Good Morning"
    elif 12 <= hour < 17:
        return "Good Afternoon"
    elif 17 <= hour < 21:
        return "Good Evening"
    else:
        return "Good Night"


def days_until(target_date: datetime) -> int:
    """Calculate days until a target date"""
    now = datetime.now(timezone.utc)
    if target_date.tzinfo is None:
        target_date = target_date.replace(tzinfo=timezone.utc)
    
    delta = target_date - now
    return max(0, delta.days)


def days_since(past_date: datetime) -> int:
    """Calculate days since a past date"""
    now = datetime.now(timezone.utc)
    if past_date.tzinfo is None:
        past_date = past_date.replace(tzinfo=timezone.utc)
    
    delta = now - past_date
    return max(0, delta.days)
