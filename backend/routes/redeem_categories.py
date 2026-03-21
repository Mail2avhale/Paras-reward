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
    """Import and call the main limit calculation function with months + referral"""
    # Import from server to avoid circular imports
    import sys
    sys.path.insert(0, '/app/backend')
    from server import calculate_user_redeem_limit
    
    # calculate_user_redeem_limit takes user_id, not user dict
    user_id = user.get("uid")
    limit_data = await calculate_user_redeem_limit(user_id)
    
    # Return in compatible format
    return {
        "limit": limit_data.get("total_limit", 0),
        "monthly_limit": limit_data.get("monthly_limit", 0),
        "total_limit": limit_data.get("total_limit", 0),
        "months_active": limit_data.get("months_active", 1),
        "active_referrals": limit_data.get("active_referrals", 0),
        "referral_percentage_increase": limit_data.get("referral_percentage_increase", 0),
        "base_limit": limit_data.get("base_limit", 0),
        "carry_forward": 0,  # Carry forward is built into total_limit
        "enabled": True
    }


async def get_category_usage(uid: str, category: str, start_date: datetime) -> float:
    """
    Get total PRC used in a specific category since start_date.
    
    COMPREHENSIVE - checks ALL collections for the category:
    - Utility: Gift vouchers, BBPS, Subscription, Recharges, Bill payments, etc.
    - Shopping: Orders, E-commerce
    - Bank: Bank transfers, DMT, Withdrawals
    """
    
    # All possible SUCCESS statuses (both cases)
    success_statuses = [
        "completed", "COMPLETED", "Completed",
        "pending", "PENDING", "Pending",
        "processing", "PROCESSING", "Processing",
        "approved", "APPROVED", "Approved",
        "success", "SUCCESS", "Success",
        "paid", "PAID", "Paid",
        "delivered", "DELIVERED", "Delivered"
    ]
    
    # Map category to service types
    category_services = {
        "utility": [
            "gift_voucher", "bbps", "subscription", "subscription_prc", "recharge", 
            "bill_payment", "mobile_recharge", "mobile_prepaid", "mobile_postpaid",
            "dth", "electricity", "gas", "water", "broadband", "landline", 
            "postpaid", "fastag", "loan_emi", "insurance", "lpg", "cable_tv",
            "education", "municipal_tax", "housing_society", "credit_card", "other"
        ],
        "shopping": ["shopping", "ecommerce", "product", "marketplace", "order"],
        "bank": ["bank_transfer", "bank_withdrawal", "bank_redeem", "manual_bank", "dmt", "prc_to_bank"]
    }
    
    services = category_services.get(category, [])
    db = get_db()
    total_used = 0
    start_date_str = start_date.isoformat() if isinstance(start_date, datetime) else str(start_date)
    
    # Helper function to safely aggregate
    async def safe_aggregate(collection_name, match_query, sum_field):
        try:
            pipeline = [
                {"$match": match_query},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": [f"${sum_field}", 0]}}}}
            ]
            result = await db[collection_name].aggregate(pipeline).to_list(1)
            total = result[0].get("total", 0) if result else 0
            # Debug logging
            if total > 0:
                logging.debug(f"[CATEGORY-{category}] Found {total} in {collection_name}.{sum_field}")
            return total
        except Exception as e:
            logging.warning(f"[CATEGORY] Error querying {collection_name}: {e}")
            return 0
    
    # ALSO check with $gte on created_at as date object (for ISO string dates)
    async def safe_aggregate_with_date(collection_name, match_query_base, sum_field, start_dt):
        """Try both string and date comparison for created_at"""
        try:
            # First try with ISO string
            match_str = {**match_query_base, "created_at": {"$gte": start_dt.isoformat()}}
            pipeline = [
                {"$match": match_str},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": [f"${sum_field}", 0]}}}}
            ]
            result = await db[collection_name].aggregate(pipeline).to_list(1)
            total = result[0].get("total", 0) if result else 0
            
            # If no result, try without date filter to see if there's ANY data
            if total == 0:
                match_no_date = {k: v for k, v in match_query_base.items() if k != "created_at"}
                pipeline_no_date = [
                    {"$match": match_no_date},
                    {"$group": {"_id": None, "total": {"$sum": {"$ifNull": [f"${sum_field}", 0]}}}}
                ]
                result_no_date = await db[collection_name].aggregate(pipeline_no_date).to_list(1)
                total_no_date = result_no_date[0].get("total", 0) if result_no_date else 0
                if total_no_date > 0:
                    logging.debug(f"[CATEGORY-{category}] Found {total_no_date} in {collection_name} WITHOUT date filter - possible date format issue")
                    # Return the total without date filter for now (to debug)
                    return total_no_date
            
            return total
        except Exception as e:
            logging.warning(f"[CATEGORY] Error querying {collection_name}: {e}")
            return 0
    
    # ═══════════════════════════════════════════════════════════════════════
    # 1. unified_redemptions (newer unified collection)
    # ═══════════════════════════════════════════════════════════════════════
    unified = await safe_aggregate(
        "unified_redemptions",
        {"user_id": uid, "service_type": {"$in": services}, "created_at": {"$gte": start_date_str}, "status": {"$in": success_statuses}},
        "prc_deducted"
    )
    total_used += unified
    
    # ═══════════════════════════════════════════════════════════════════════
    # 2. redeem_requests (main redemption collection) - includes ALL service types
    # NOTE: For bank category, we handle this separately to avoid double counting
    # ═══════════════════════════════════════════════════════════════════════
    if category != "bank":
        redeem_req = await safe_aggregate(
            "redeem_requests",
            {"user_id": uid, "service_type": {"$in": services}, "created_at": {"$gte": start_date_str}, "status": {"$in": success_statuses}},
            "total_prc_deducted"
        )
        # Also check prc_amount if total_prc_deducted is 0
        if redeem_req == 0:
            redeem_req = await safe_aggregate(
                "redeem_requests",
                {"user_id": uid, "service_type": {"$in": services}, "created_at": {"$gte": start_date_str}, "status": {"$in": success_statuses}},
                "prc_amount"
            )
        total_used += redeem_req
    
    # ═══════════════════════════════════════════════════════════════════════
    # CATEGORY-SPECIFIC COLLECTIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    if category == "utility":
        # Gift Voucher Requests
        voucher = await safe_aggregate(
            "gift_voucher_requests",
            {"user_id": uid, "created_at": {"$gte": start_date_str}, "status": {"$in": success_statuses}},
            "prc_amount"
        )
        if voucher == 0:
            voucher = await safe_aggregate(
                "gift_voucher_requests",
                {"user_id": uid, "created_at": {"$gte": start_date_str}, "status": {"$in": success_statuses}},
                "total_prc_deducted"
            )
        total_used += voucher
        
        # Bill Payment Requests (BBPS)
        bbps = await safe_aggregate(
            "bill_payment_requests",
            {"user_id": uid, "created_at": {"$gte": start_date_str}, "status": {"$in": success_statuses}},
            "prc_used"
        )
        if bbps == 0:
            bbps = await safe_aggregate(
                "bill_payment_requests",
                {"user_id": uid, "created_at": {"$gte": start_date_str}, "status": {"$in": success_statuses}},
                "total_prc_deducted"
            )
        total_used += bbps
        
        # PRC Subscription Payments
        sub_prc = await safe_aggregate(
            "subscription_payments",
            {"user_id": uid, "payment_method": "prc", "created_at": {"$gte": start_date_str}, "status": {"$in": success_statuses}},
            "prc_amount"
        )
        total_used += sub_prc
        
        # Recharge Requests (legacy)
        recharge = await safe_aggregate(
            "recharge_requests",
            {"user_id": uid, "created_at": {"$gte": start_date_str}, "status": {"$in": success_statuses}},
            "prc_used"
        )
        total_used += recharge
        
    elif category == "bank":
        # ═══════════════════════════════════════════════════════════════════════
        # IMPORTANT: Bank withdrawals can be stored in FOUR collections!
        # 1. redeem_requests (with bank service_type)
        # 2. bank_withdrawal_requests
        # 3. bank_transfer_requests (NEW - from manual_bank_transfer route)
        # 4. bank_transfers, dmt_transactions, etc.
        # ═══════════════════════════════════════════════════════════════════════
        
        # 1. redeem_requests with bank-related service_type
        bank_redeem = await safe_aggregate(
            "redeem_requests",
            {"user_id": uid, "status": {"$in": success_statuses}, 
             "service_type": {"$in": ["bank_transfer", "bank_withdrawal", "bank_redeem", "manual_bank", "prc_to_bank", "bank"]}},
            "total_prc_deducted"
        )
        if bank_redeem == 0:
            bank_redeem = await safe_aggregate(
                "redeem_requests",
                {"user_id": uid, "status": {"$in": success_statuses},
                 "service_type": {"$in": ["bank_transfer", "bank_withdrawal", "bank_redeem", "manual_bank", "prc_to_bank", "bank"]}},
                "prc_amount"
            )
        total_used += bank_redeem
        
        # 2. redeem_requests by BTR request_id pattern (backup check)
        bank_btr = await safe_aggregate(
            "redeem_requests",
            {"user_id": uid, "status": {"$in": success_statuses},
             "request_id": {"$regex": "^BTR"}},
            "total_prc_deducted"
        )
        if bank_btr == 0:
            bank_btr = await safe_aggregate(
                "redeem_requests",
                {"user_id": uid, "status": {"$in": success_statuses},
                 "request_id": {"$regex": "^BTR"}},
                "prc_amount"
            )
        if bank_redeem == 0:
            total_used += bank_btr
        
        # 3. bank_transfer_requests (CRITICAL - THIS IS WHERE manual_bank_transfer SAVES!)
        bt_requests = await safe_aggregate(
            "bank_transfer_requests",
            {"user_id": uid, "status": {"$in": success_statuses}},
            "total_prc_deducted"
        )
        if bt_requests == 0:
            bt_requests = await safe_aggregate(
                "bank_transfer_requests",
                {"user_id": uid, "status": {"$in": success_statuses}},
                "prc_deducted"
            )
        if bt_requests == 0:
            bt_requests = await safe_aggregate(
                "bank_transfer_requests",
                {"user_id": uid, "status": {"$in": success_statuses}},
                "total_prc"
            )
        total_used += bt_requests
        
        # 4. Bank Transfers collection (legacy)
        bank = await safe_aggregate(
            "bank_transfers",
            {"user_id": uid, "status": {"$in": success_statuses}},
            "prc_amount"
        )
        if bank == 0:
            bank = await safe_aggregate(
                "bank_transfers",
                {"user_id": uid, "status": {"$in": success_statuses}},
                "total_prc_deducted"
            )
        total_used += bank
        
        # 5. Bank Withdrawal Requests collection
        bank_wd = await safe_aggregate(
            "bank_withdrawal_requests",
            {"user_id": uid, "status": {"$in": success_statuses}},
            "prc_amount"
        )
        if bank_wd == 0:
            bank_wd = await safe_aggregate(
                "bank_withdrawal_requests",
                {"user_id": uid, "status": {"$in": success_statuses}},
                "total_prc_deducted"
            )
        total_used += bank_wd
        
        # 6. Bank Redeem Requests collection
        bank_redeem_coll = await safe_aggregate(
            "bank_redeem_requests",
            {"user_id": uid, "status": {"$in": success_statuses}},
            "prc_amount"
        )
        total_used += bank_redeem_coll
        
        # 7. DMT Transactions
        dmt = await safe_aggregate(
            "dmt_transactions",
            {"user_id": uid, "status": {"$in": success_statuses}},
            "prc_deducted"
        )
        if dmt == 0:
            dmt = await safe_aggregate(
                "dmt_transactions",
                {"user_id": uid, "status": {"$in": success_statuses}},
                "prc_amount"
            )
        total_used += dmt
        
        # 8. Chatbot Withdrawals (deprecated)
        chatbot = await safe_aggregate(
            "chatbot_withdrawal_requests",
            {"user_id": uid, "status": {"$in": success_statuses}},
            "prc_amount"
        )
        total_used += chatbot
        
    elif category == "shopping":
        # Orders
        orders = await safe_aggregate(
            "orders",
            {"user_id": uid, "created_at": {"$gte": start_date_str}, "status": {"$nin": ["cancelled", "refunded", "failed", "CANCELLED", "REFUNDED", "FAILED"]}},
            "total_prc"
        )
        total_used += orders
    
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
