"""
Redeem Category System
======================
Divides user's monthly redeem limit into categories:
- Utility (40%): Gift Vouchers, BBPS, Subscription, Others
- Shopping (30%): E-commerce products (future)
- Bank (30%): Bank transfers/withdrawals

Each category has:
- Separate limit based on percentage of total limit
- Separate usage tracking
- Separate carry forward
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
import logging
import os

router = APIRouter(prefix="", tags=["redeem-categories"])

# Import db from server to use the same connection
import sys
sys.path.insert(0, '/app/backend')

# Get database connection from server module
def get_db():
    from server import db
    return db

# Default category configuration
DEFAULT_CATEGORIES = {
    "utility": {
        "name": "Utility",
        "percentage": 40,
        "services": ["gift_voucher", "bbps", "subscription", "recharge", "bill_payment", "other"],
        "description": "Gift Vouchers, BBPS, Subscription & Others",
        "icon": "zap",
        "color": "blue"
    },
    "shopping": {
        "name": "Shopping", 
        "percentage": 30,
        "services": ["shopping", "ecommerce", "product"],
        "description": "E-commerce Products",
        "icon": "shopping-bag",
        "color": "green"
    },
    "bank": {
        "name": "Bank",
        "percentage": 30,
        "services": ["bank_transfer", "bank_withdrawal", "bank_redeem"],
        "description": "Bank Transfer & Withdrawal",
        "icon": "landmark",
        "color": "orange"
    }
}


async def get_category_settings():
    """Get category percentage settings from database"""
    settings = await get_db().app_settings.find_one({"key": "redeem_categories"}, {"_id": 0})
    if settings and settings.get("categories"):
        return settings.get("categories")
    return DEFAULT_CATEGORIES


async def get_user_category_override(uid: str):
    """Get user-specific category percentage override"""
    override = await get_db().user_category_overrides.find_one({"uid": uid}, {"_id": 0})
    return override


async def get_user_total_limit(user: dict) -> dict:
    """Import and call the main limit calculation function"""
    # Import from server to avoid circular imports
    import sys
    sys.path.insert(0, '/app/backend')
    from server import calculate_user_monthly_redeem_limit
    return await calculate_user_monthly_redeem_limit(user)


async def get_category_usage(uid: str, category: str, start_date: datetime) -> float:
    """Get total PRC used in a specific category since start_date"""
    
    # Map category to service types
    category_services = {
        "utility": ["gift_voucher", "bbps", "subscription", "recharge", "bill_payment", "mobile_recharge", "dth", "electricity", "gas", "water", "broadband", "landline", "postpaid", "fastag", "loan_emi", "insurance", "other"],
        "shopping": ["shopping", "ecommerce", "product"],
        "bank": ["bank_transfer", "bank_withdrawal", "bank_redeem", "manual_bank"]
    }
    
    services = category_services.get(category, [])
    
    # Query redemptions for this user in this category
    total_used = 0
    
    # Check unified_redemptions collection
    pipeline = [
        {
            "$match": {
                "user_id": uid,
                "service_type": {"$in": services},
                "created_at": {"$gte": start_date.isoformat()},
                "status": {"$in": ["completed", "pending", "processing", "approved"]}
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$prc_deducted"}
            }
        }
    ]
    
    result = await get_db().unified_redemptions.aggregate(pipeline).to_list(1)
    if result:
        total_used += result[0].get("total", 0)
    
    # Check bank_transfers for bank category
    if category == "bank":
        bank_pipeline = [
            {
                "$match": {
                    "user_id": uid,
                    "created_at": {"$gte": start_date.isoformat()},
                    "status": {"$in": ["completed", "paid", "pending", "processing"]}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$prc_amount"}
                }
            }
        ]
        bank_result = await get_db().bank_transfers.aggregate(bank_pipeline).to_list(1)
        if bank_result:
            total_used += bank_result[0].get("total", 0)
    
    # Check gift_voucher_requests for utility
    if category == "utility":
        voucher_pipeline = [
            {
                "$match": {
                    "user_id": uid,
                    "created_at": {"$gte": start_date.isoformat()},
                    "status": {"$in": ["completed", "approved", "pending", "processing"]}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$prc_amount"}
                }
            }
        ]
        voucher_result = await get_db().gift_voucher_requests.aggregate(voucher_pipeline).to_list(1)
        if voucher_result:
            total_used += voucher_result[0].get("total", 0)
    
    return total_used


async def get_category_carry_forward(uid: str, category: str) -> float:
    """Get carry forward amount for a specific category"""
    carry_forward_doc = await get_db().category_carry_forward.find_one({
        "uid": uid,
        "category": category
    }, {"_id": 0})
    
    if carry_forward_doc:
        return carry_forward_doc.get("amount", 0)
    return 0


async def calculate_user_category_limits(user: dict) -> dict:
    """
    Calculate category-wise limits for a user
    
    Returns:
    {
        "total_limit": 50000,
        "categories": {
            "utility": {"limit": 20000, "used": 5000, "remaining": 15000, "carry_forward": 2000, ...},
            "shopping": {"limit": 15000, "used": 0, "remaining": 15000, "carry_forward": 0, ...},
            "bank": {"limit": 15000, "used": 8000, "remaining": 7000, "carry_forward": 1000, ...}
        }
    }
    """
    uid = user.get("uid")
    
    # Get total limit
    total_limit_data = await get_user_total_limit(user)
    total_limit = total_limit_data.get("limit", 0)
    monthly_limit = total_limit_data.get("monthly_limit", 0)
    
    # Get category settings (global or user-specific override)
    categories = await get_category_settings()
    user_override = await get_user_category_override(uid)
    
    if user_override and user_override.get("categories"):
        # Merge user override with defaults
        for cat_key, cat_override in user_override.get("categories", {}).items():
            if cat_key in categories:
                categories[cat_key]["percentage"] = cat_override.get("percentage", categories[cat_key]["percentage"])
    
    # Get subscription start date for usage calculation
    sub_info = user.get("subscription_info", {})
    sub_start = sub_info.get("start_date") or user.get("subscription_start_date")
    
    if sub_start:
        if isinstance(sub_start, str):
            try:
                start_date = datetime.fromisoformat(sub_start.replace('Z', '+00:00'))
            except ValueError:
                start_date = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            start_date = sub_start
    else:
        # Default to start of current month
        start_date = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Calculate per-category limits and usage
    result = {
        "total_limit": total_limit,
        "monthly_limit": monthly_limit,
        "total_carry_forward": total_limit_data.get("carry_forward", 0),
        "categories": {},
        "calculation_date": datetime.now(timezone.utc).isoformat(),
        "billing_start": start_date.isoformat()
    }
    
    for cat_key, cat_config in categories.items():
        percentage = cat_config.get("percentage", 0)
        
        # Calculate this category's limit from TOTAL LIMIT (includes referral bonus + months active)
        # This ensures users get their full accumulated limit across categories
        cat_limit_from_total = (total_limit * percentage) / 100
        
        # Also calculate monthly base for reference
        cat_monthly_base = (monthly_limit * percentage) / 100
        
        # Get carry forward for this category
        cat_carry_forward = await get_category_carry_forward(uid, cat_key)
        
        # Total limit for this category = allocation from total limit + carry forward
        cat_total_limit = cat_limit_from_total + cat_carry_forward
        
        # Get usage for this category
        cat_used = await get_category_usage(uid, cat_key, start_date)
        
        # Calculate remaining
        cat_remaining = max(0, cat_total_limit - cat_used)
        
        result["categories"][cat_key] = {
            "name": cat_config.get("name"),
            "description": cat_config.get("description"),
            "icon": cat_config.get("icon"),
            "color": cat_config.get("color"),
            "percentage": percentage,
            "monthly_limit": round(cat_monthly_base, 2),  # Base monthly for reference
            "limit_from_total": round(cat_limit_from_total, 2),  # Actual limit from total
            "carry_forward": round(cat_carry_forward, 2),
            "total_limit": round(cat_total_limit, 2),
            "used": round(cat_used, 2),
            "remaining": round(cat_remaining, 2),
            "usage_percent": round((cat_used / cat_total_limit * 100) if cat_total_limit > 0 else 0, 1)
        }
    
    return result


@router.get("/settings")
async def get_category_settings_api():
    """Get global category percentage settings"""
    categories = await get_category_settings()
    return {
        "success": True,
        "categories": categories
    }


@router.post("/settings")
async def update_category_settings(request: Request):
    """Update global category percentage settings (Admin only)"""
    data = await request.json()
    categories = data.get("categories", {})
    
    # Validate percentages sum to 100
    total_percent = sum(cat.get("percentage", 0) for cat in categories.values())
    if total_percent != 100:
        raise HTTPException(status_code=400, detail=f"Category percentages must sum to 100%, got {total_percent}%")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await get_db().app_settings.update_one(
        {"key": "redeem_categories"},
        {
            "$set": {
                "key": "redeem_categories",
                "categories": categories,
                "updated_at": now
            }
        },
        upsert=True
    )
    
    logging.info(f"[ADMIN] Redeem categories updated: {categories}")
    
    return {"success": True, "message": "Category settings updated"}


@router.get("/user/{uid}")
async def get_user_category_limits(uid: str):
    """Get category-wise limits for a specific user"""
    print(f"[CATEGORY] Fetching limits for user: {uid}")
    db = get_db()
    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    print(f"[CATEGORY] User found: {user is not None}")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    limits = await calculate_user_category_limits(user)
    
    return {
        "success": True,
        "uid": uid,
        **limits
    }


@router.post("/user/{uid}/override")
async def set_user_category_override(uid: str, request: Request):
    """Set user-specific category percentage override (Admin only)"""
    data = await request.json()
    categories = data.get("categories", {})
    
    # Validate percentages sum to 100
    total_percent = sum(cat.get("percentage", 0) for cat in categories.values())
    if total_percent != 100:
        raise HTTPException(status_code=400, detail=f"Category percentages must sum to 100%, got {total_percent}%")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await get_db().user_category_overrides.update_one(
        {"uid": uid},
        {
            "$set": {
                "uid": uid,
                "categories": categories,
                "updated_at": now,
                "updated_by": data.get("admin_id")
            }
        },
        upsert=True
    )
    
    logging.info(f"[ADMIN] User {uid} category override set: {categories}")
    
    return {"success": True, "message": f"Category override set for user {uid}"}


@router.delete("/user/{uid}/override")
async def remove_user_category_override(uid: str):
    """Remove user-specific category override (revert to global settings)"""
    result = await get_db().user_category_overrides.delete_one({"uid": uid})
    
    if result.deleted_count == 0:
        return {"success": True, "message": "No override found for user"}
    
    logging.info(f"[ADMIN] User {uid} category override removed")
    
    return {"success": True, "message": f"Category override removed for user {uid}"}


@router.post("/check-limit")
async def check_category_limit(request: Request):
    """
    Check if user has sufficient limit in a specific category
    Used before processing any redemption
    """
    data = await request.json()
    uid = data.get("uid")
    category = data.get("category")  # utility, shopping, bank
    amount_prc = data.get("amount_prc", 0)
    
    if not uid or not category:
        raise HTTPException(status_code=400, detail="uid and category required")
    
    user = await get_db().users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    limits = await calculate_user_category_limits(user)
    
    cat_data = limits.get("categories", {}).get(category)
    if not cat_data:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    
    remaining = cat_data.get("remaining", 0)
    has_limit = remaining >= amount_prc
    
    return {
        "success": True,
        "has_limit": has_limit,
        "category": category,
        "requested": amount_prc,
        "remaining": remaining,
        "shortfall": max(0, amount_prc - remaining) if not has_limit else 0,
        "message": "Sufficient limit" if has_limit else f"Insufficient {cat_data['name']} limit. Need {amount_prc} PRC, have {remaining} PRC"
    }


@router.post("/record-usage")
async def record_category_usage(request: Request):
    """
    Record PRC usage in a specific category
    Called after successful redemption
    """
    data = await request.json()
    uid = data.get("uid")
    category = data.get("category")
    amount_prc = data.get("amount_prc", 0)
    service_type = data.get("service_type")
    reference_id = data.get("reference_id")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Record in category_usage collection for tracking
    await get_db().category_usage.insert_one({
        "uid": uid,
        "category": category,
        "amount_prc": amount_prc,
        "service_type": service_type,
        "reference_id": reference_id,
        "created_at": now
    })
    
    logging.info(f"[CATEGORY] User {uid} used {amount_prc} PRC in {category} category")
    
    return {"success": True, "message": "Usage recorded"}


@router.post("/calculate-carry-forward")
async def calculate_and_store_carry_forward(request: Request):
    """
    Calculate and store carry forward for all categories at month end
    Should be called by a scheduled job at the end of each billing cycle
    """
    data = await request.json()
    uid = data.get("uid")
    
    if not uid:
        raise HTTPException(status_code=400, detail="uid required")
    
    user = await get_db().users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    limits = await calculate_user_category_limits(user)
    now = datetime.now(timezone.utc).isoformat()
    
    carry_forward_records = []
    
    for cat_key, cat_data in limits.get("categories", {}).items():
        remaining = cat_data.get("remaining", 0)
        
        if remaining > 0:
            # Store carry forward for this category
            await get_db().category_carry_forward.update_one(
                {"uid": uid, "category": cat_key},
                {
                    "$set": {
                        "uid": uid,
                        "category": cat_key,
                        "amount": remaining,
                        "calculated_at": now,
                        "source_month": datetime.now(timezone.utc).strftime("%Y-%m")
                    }
                },
                upsert=True
            )
            
            carry_forward_records.append({
                "category": cat_key,
                "amount": remaining
            })
    
    return {
        "success": True,
        "uid": uid,
        "carry_forward": carry_forward_records,
        "calculated_at": now
    }
