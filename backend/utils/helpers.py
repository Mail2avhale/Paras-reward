"""
PARAS REWARD - Common Utilities
================================
Helper functions used across the application
"""

from datetime import datetime, timezone
from typing import Any
import hashlib
import secrets
import string


# =============== PRC INR RATE — FIXED 10:1 (June 2026) ===============
# Single, fixed rate across the entire app. The dynamic-rate engine was
# removed in the June 2026 cleanup (5-factor calc, manual overrides,
# burn rate, stability index, whale protection, emergency pause).
#
# Fixed conversion: 10 PRC = ₹1 (i.e., 1 PRC = ₹0.10)
# All redeem, invoice, leaderboard, mining, and bank-transfer logic
# should use these helpers — no per-request DB lookups.

PRC_INR_RATE = 10  # FIXED: 10 PRC = ₹1


async def get_prc_rate(database=None) -> int:
    """Return the fixed 10 PRC = ₹1 conversion rate."""
    return PRC_INR_RATE


def get_prc_rate_sync(database_sync=None) -> int:
    """Synchronous variant of get_prc_rate. Returns fixed 10."""
    return PRC_INR_RATE



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
    
    # Rule 3: Check expiry date (uses the canonical helper which falls back to
    # legacy fields for un-migrated rows).
    from utils.subscription_expiry import get_user_expiry  # local import — avoid circular at module load
    expiry_date = get_user_expiry(user)
    has_expiry = expiry_date is not None
    if expiry_date and now < expiry_date:
        return True
    
    # Rule 4: Paid plan + no expiry → assume active (missing data ≠ expired)
    if not has_expiry and plan in ['elite', 'vip', 'startup', 'growth', 'pro', 'premium']:
        return True
    
    # Rule 5: Explicitly expired
    if user.get('subscription_expired') is True:
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
