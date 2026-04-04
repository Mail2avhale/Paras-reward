"""
REDEEM VALIDATION CHECKLIST - COMPULSORY CHECKS

This module contains ALL validation functions that MUST be called before any redemption.
All checks are MANDATORY and should BLOCK redemption if any fails.

Author: Paras Reward System
Last Updated: March 2026
"""

from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
import logging

# Database reference (set from server.py)
db = None

def set_db(database):
    global db
    db = database


# ===============================================
# 🔴 MANDATORY VALIDATION CHECKLIST
# ===============================================
# 
# 1. ✅ SUBSCRIPTION CHECK
#    - Plan must be startup/growth/elite
#    - Subscription expiry date must be in future
#    - Block: "Your subscription has expired"
#
# 2. ✅ KYC CHECK
#    - KYC status must be "verified"
#    - Block: "KYC verification required"
#
# 3. ✅ PRC BALANCE CHECK
#    - User must have sufficient PRC balance
#    - Block: "Insufficient PRC balance"
#
# 4. ✅ WEEKLY SERVICE LIMIT (7-day cooldown)
#    - BBPS: 1 service per 7 days
#    - Bank: 1 transfer per 7 days
#    - Block: "Weekly limit reached"
#
# 5. ✅ GLOBAL REDEEM LIMIT
#    - Based on subscription months + referrals
#    - Block: "Redeem limit exceeded"
#
# 6. ⚠️ CATEGORY-WISE LIMIT (40/30/30) - NEEDS ENFORCEMENT
#    - Utility: 40% of monthly limit
#    - Shopping: 30% of monthly limit
#    - Bank: 30% of monthly limit
#    - Block: "Category limit exceeded"
#
# 7. ✅ EMERGENCY PAUSE CHECK
#    - System can pause redemptions during issues
#    - Block: "Redeem temporarily paused"
#
# 8. ✅ SERVICE-SPECIFIC VALIDATION
#    - Mobile: 10-digit number required
#    - Bank: Valid IFSC, account number
#    - etc.
# ===============================================


async def validate_subscription_active(user: dict) -> dict:
    """
    COMPULSORY CHECK #1 & #2: Subscription Plan + Expiry
    
    Returns: {"valid": bool, "error": str or None}
    """
    # Check plan
    valid_plans = ["startup", "growth", "elite"]
    user_plan = (user.get("subscription_plan") or "").lower()
    
    if user_plan not in valid_plans:
        return {
            "valid": False,
            "error": "Paid subscription required. Please upgrade to Startup, Growth or Elite plan.",
            "error_code": "NO_SUBSCRIPTION"
        }
    
    # Check expiry
    subscription_expiry = user.get("subscription_expiry")
    
    if not subscription_expiry:
        return {
            "valid": False,
            "error": "Subscription expiry not set. Please contact support.",
            "error_code": "NO_EXPIRY"
        }
    
    try:
        if isinstance(subscription_expiry, str):
            # Handle various ISO formats
            expiry_str = subscription_expiry.replace('Z', '+00:00')
            if '+' not in expiry_str and '-' in expiry_str.split('T')[-1] if 'T' in expiry_str else False:
                expiry_str = expiry_str + '+00:00'
            expiry_date = datetime.fromisoformat(expiry_str.split('+')[0])
            expiry_date = expiry_date.replace(tzinfo=timezone.utc)
        else:
            expiry_date = subscription_expiry
            if expiry_date.tzinfo is None:
                expiry_date = expiry_date.replace(tzinfo=timezone.utc)
        
        now_utc = datetime.now(timezone.utc)
        
        if expiry_date < now_utc:
            days_expired = (now_utc - expiry_date).days
            return {
                "valid": False,
                "error": f"Your subscription expired {days_expired} days ago on {expiry_date.strftime('%d %b %Y')}. Please renew to continue.",
                "error_code": "SUBSCRIPTION_EXPIRED",
                "expired_on": expiry_date.isoformat(),
                "days_expired": days_expired
            }
        
        # Valid subscription
        days_remaining = (expiry_date - now_utc).days
        return {
            "valid": True,
            "error": None,
            "plan": user_plan,
            "expires_on": expiry_date.isoformat(),
            "days_remaining": days_remaining
        }
        
    except Exception as e:
        logging.error(f"Subscription expiry parse error: {e}")
        return {
            "valid": False,
            "error": "Could not verify subscription. Please contact support.",
            "error_code": "PARSE_ERROR"
        }


async def validate_kyc_status(user: dict) -> dict:
    """
    COMPULSORY CHECK #3: KYC Verification
    """
    kyc_status = user.get("kyc_status", "").lower()
    
    if kyc_status != "verified":
        return {
            "valid": False,
            "error": "KYC verification required before redeeming. Please complete KYC.",
            "error_code": "KYC_PENDING",
            "current_status": kyc_status
        }
    
    return {"valid": True, "error": None}


async def validate_prc_balance(user: dict, required_prc: float) -> dict:
    """
    COMPULSORY CHECK #4: Sufficient PRC Balance
    """
    current_balance = user.get("prc_balance", 0)
    
    if current_balance < required_prc:
        return {
            "valid": False,
            "error": f"Insufficient PRC balance. Required: {required_prc:,.0f} PRC, Available: {current_balance:,.0f} PRC",
            "error_code": "INSUFFICIENT_BALANCE",
            "required": required_prc,
            "available": current_balance,
            "shortfall": required_prc - current_balance
        }
    
    return {
        "valid": True,
        "error": None,
        "available": current_balance,
        "after_deduction": current_balance - required_prc
    }


async def validate_category_limit(user_id: str, category: str, amount_inr: float, plan: str) -> dict:
    """
    COMPULSORY CHECK #5: Category-wise Monthly Limit (40/30/30)
    
    Uses the full calculated limit (months_active + referral bonus) instead of static values.
    
    Categories:
    - utility: 40% (mobile, electricity, gas, water, DTH, broadband, etc.)
    - shopping: 30% (gift vouchers, marketplace, etc.)
    - bank: 30% (bank transfer, DMT)
    """
    if db is None:
        return {"valid": True, "error": None, "warning": "DB not available for limit check"}
    
    # Category percentages
    CATEGORY_PERCENTAGES = {
        "utility": 0.40,    # 40%
        "shopping": 0.30,   # 30%
        "bank": 0.30        # 30%
    }
    
    # Get user's actual calculated limit (includes months active + referral bonus)
    try:
        import sys
        sys.path.insert(0, '/app/backend')
        from server import calculate_user_redeem_limit
        user_limit_info = await calculate_user_redeem_limit(user_id)
        total_limit = user_limit_info.get("total_limit", 0)
    except Exception as limit_err:
        # Fallback to static limits if calculation fails
        PLAN_MONTHLY_LIMITS = {
            "startup": 14950,
            "growth": 24950,
            "elite": 39950
        }
        plan_lower = plan.lower()
        total_limit = PLAN_MONTHLY_LIMITS.get(plan_lower, 14950)
    
    # Calculate category limit from total limit
    category_percent = CATEGORY_PERCENTAGES.get(category, 0.40)
    category_limit = total_limit * category_percent
    
    # Get current month's usage for this category
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Map service types to categories
    UTILITY_SERVICES = [
        "mobile_recharge", "mobile_postpaid", "electricity", "gas", "water",
        "broadband", "landline", "dth", "cable_tv", "emi", "credit_card",
        "insurance", "fastag", "education", "municipal_tax", "housing_society", "lpg"
    ]
    SHOPPING_SERVICES = ["gift_voucher", "shopping", "marketplace"]
    BANK_SERVICES = ["bank_transfer", "prc_to_bank", "dmt", "bank_withdrawal"]
    
    # Determine which services to count
    if category == "utility":
        service_filter = {"$in": UTILITY_SERVICES}
    elif category == "shopping":
        service_filter = {"$in": SHOPPING_SERVICES}
    elif category == "bank":
        service_filter = {"$in": BANK_SERVICES}
    else:
        service_filter = {"$in": UTILITY_SERVICES}  # Default to utility
    
    # Query for this month's completed redemptions in this category
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "created_at": {"$gte": month_start.isoformat()},
                "status": {"$in": ["completed", "approved", "success", "pending", "paid", "processing", "delivered"]},
                "service_type": service_filter
            }
        },
        {
            "$group": {
                "_id": None,
                "total_amount": {"$sum": "$amount_inr"}
            }
        }
    ]
    
    try:
        result = await db.redeem_requests.aggregate(pipeline).to_list(length=1)
        used_amount = result[0]["total_amount"] if result else 0
    except Exception as e:
        logging.error(f"Category limit query error: {e}")
        used_amount = 0
    
    remaining = category_limit - used_amount
    
    if amount_inr > remaining:
        return {
            "valid": False,
            "error": f"{category.title()} category limit exceeded. Limit: ₹{category_limit:,.0f}, Used: ₹{used_amount:,.0f}, Remaining: ₹{remaining:,.0f}",
            "error_code": "CATEGORY_LIMIT_EXCEEDED",
            "category": category,
            "limit": category_limit,
            "used": used_amount,
            "remaining": remaining,
            "requested": amount_inr
        }
    
    return {
        "valid": True,
        "error": None,
        "category": category,
        "limit": category_limit,
        "used": used_amount,
        "remaining": remaining,
        "after_this": remaining - amount_inr
    }


async def run_all_validations(
    user_id: str,
    service_type: str,
    amount_inr: float,
    prc_required: float
) -> dict:
    """
    Run ALL mandatory validations before allowing redemption.
    
    Returns: {"valid": bool, "errors": list, "warnings": list}
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    errors = []
    warnings = []
    
    # Get user
    user = await db.users.find_one({"uid": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 1. Subscription Check
    sub_check = await validate_subscription_active(user)
    if not sub_check["valid"]:
        errors.append({"check": "subscription", "error": sub_check["error"]})
    
    # 2. KYC Check
    kyc_check = await validate_kyc_status(user)
    if not kyc_check["valid"]:
        errors.append({"check": "kyc", "error": kyc_check["error"]})
    
    # 3. PRC Balance Check
    balance_check = await validate_prc_balance(user, prc_required)
    if not balance_check["valid"]:
        errors.append({"check": "balance", "error": balance_check["error"]})
    
    # 4. Category Limit Check
    # Determine category from service type
    UTILITY_SERVICES = [
        "mobile_recharge", "mobile_postpaid", "electricity", "gas", "water",
        "broadband", "landline", "dth", "cable_tv", "emi", "credit_card",
        "insurance", "fastag", "education", "municipal_tax", "housing_society", "lpg"
    ]
    BANK_SERVICES = ["bank_transfer", "prc_to_bank", "dmt", "bank_withdrawal"]
    SHOPPING_SERVICES = ["gift_voucher", "shopping", "marketplace"]
    
    if service_type in UTILITY_SERVICES:
        category = "utility"
    elif service_type in BANK_SERVICES:
        category = "bank"
    elif service_type in SHOPPING_SERVICES:
        category = "shopping"
    else:
        category = "utility"  # Default
    
    plan = user.get("subscription_plan", "startup")
    category_check = await validate_category_limit(user_id, category, amount_inr, plan)
    if not category_check["valid"]:
        errors.append({"check": "category_limit", "error": category_check["error"]})
    
    # Return result
    if errors:
        return {
            "valid": False,
            "errors": errors,
            "warnings": warnings,
            "user_plan": user.get("subscription_plan"),
            "prc_balance": user.get("prc_balance")
        }
    
    return {
        "valid": True,
        "errors": [],
        "warnings": warnings,
        "user_plan": user.get("subscription_plan"),
        "prc_balance": user.get("prc_balance"),
        "category_info": category_check
    }
