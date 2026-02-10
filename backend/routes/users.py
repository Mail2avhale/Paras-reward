"""
User Routes - All user-related API endpoints
Extracted from server.py for better code organization

Includes:
- User profile management
- Profile picture upload/delete
- Dashboard data
- User stats
- Account deletion
"""

from fastapi import APIRouter, HTTPException, Request, File, UploadFile
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
import base64

# Create router
router = APIRouter(tags=["Users"])

# Database and cache references - will be set from main server
db = None
cache = None

# Helper function references - will be set during initialization
hash_password = None
verify_password = None
check_unique_fields = None
get_duplicate_field_owner = None
log_activity = None
log_transaction = None
create_social_notification = None

def set_db(database):
    """Set the database reference"""
    global db
    db = database

def set_cache(cache_manager):
    """Set the cache reference"""
    global cache
    cache = cache_manager

def set_helpers(helpers: dict):
    """Set helper function references"""
    global hash_password, verify_password, check_unique_fields
    global get_duplicate_field_owner, log_activity, log_transaction
    global create_social_notification
    
    hash_password = helpers.get('hash_password')
    verify_password = helpers.get('verify_password')
    check_unique_fields = helpers.get('check_unique_fields')
    get_duplicate_field_owner = helpers.get('get_duplicate_field_owner')
    log_activity = helpers.get('log_activity')
    log_transaction = helpers.get('log_transaction')
    create_social_notification = helpers.get('create_social_notification')


# ========== USER DATA ENDPOINTS ==========

@router.get("/users/{uid}")
async def get_user(uid: str):
    """Get user data by UID"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.pop("password_hash", None)
    user.pop("reset_token", None)
    user["_id"] = str(user["_id"])
    
    return user


@router.get("/users/children/{uid}")
async def get_user_children(uid: str):
    """Get children (subordinates) of a user"""
    try:
        children = await db.users.find({
            "parent_id": uid
        }).to_list(None)
        
        for child in children:
            child.pop("password_hash", None)
            child.pop("reset_token", None)
            child.pop("_id", None)
        
        return {"children": children, "count": len(children)}
    except Exception as e:
        logging.error(f"Error fetching children: {str(e)}")
        return {"children": [], "count": 0}


@router.get("/user/{uid}/birthday-check")
async def check_user_birthday(uid: str):
    """Check if today is user's birthday"""
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "birthday": 1, "date_of_birth": 1, "name": 1})
        if not user:
            return {"is_birthday": False, "message": None}
        
        birthday = user.get("birthday") or user.get("date_of_birth")
        if not birthday:
            return {"is_birthday": False, "message": None}
        
        today = datetime.now(timezone.utc)
        
        # Parse birthday (could be in various formats)
        if isinstance(birthday, str):
            try:
                if len(birthday) == 10:  # YYYY-MM-DD format
                    birth_date = datetime.strptime(birthday, "%Y-%m-%d")
                elif "T" in birthday:  # ISO format
                    birth_date = datetime.fromisoformat(birthday.replace('Z', '+00:00'))
                else:
                    return {"is_birthday": False, "message": None}
            except:
                return {"is_birthday": False, "message": None}
        else:
            birth_date = birthday
        
        # Check if today matches birthday (month and day)
        is_birthday = (today.month == birth_date.month and today.day == birth_date.day)
        
        if is_birthday:
            user_name = user.get("name", "").split()[0] if user.get("name") else "User"
            return {
                "is_birthday": True,
                "message": f"🎂 Happy Birthday, {user_name}! 🎉 Wishing you a wonderful day filled with joy!"
            }
        
        return {"is_birthday": False, "message": None}
    except Exception as e:
        logging.error(f"Birthday check error: {e}")
        return {"is_birthday": False, "message": None}


# ========== PROFILE MANAGEMENT ==========

@router.put("/user/{uid}/profile")
async def update_profile(uid: str, request: Request):
    """Update user profile"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    
    updatable_fields = [
        "first_name", "middle_name", "last_name", "name",
        "gender", "date_of_birth", "birthday", "bio",
        "mobile", "phone", "alternate_mobile", "email",
        "address", "address_line1", "address_line2",
        "state", "district", "taluka", "tahsil", "city", "village", "pincode",
        "emergency_contact_name", "emergency_contact_number",
        "aadhaar_number", "pan_number", "upi_id",
        "profile_picture",
        "two_factor_enabled", "login_notifications", "transaction_alerts",
        "biometric_enabled", "session_timeout"
    ]
    
    update_data = {}
    for field in updatable_fields:
        if field in data:
            update_data[field] = data[field]
    
    if any(f in data for f in ["first_name", "middle_name", "last_name"]):
        name_parts = []
        if data.get('first_name') or user.get('first_name'):
            name_parts.append(data.get('first_name', user.get('first_name', '')))
        if data.get('middle_name') or user.get('middle_name'):
            name_parts.append(data.get('middle_name', user.get('middle_name', '')))
        if data.get('last_name') or user.get('last_name'):
            name_parts.append(data.get('last_name', user.get('last_name', '')))
        update_data['name'] = ' '.join(filter(None, name_parts))
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    if 'mobile' in update_data and update_data['mobile']:
        existing_user = await db.users.find_one({
            "mobile": update_data['mobile'],
            "uid": {"$ne": uid}
        })
        if existing_user:
            raise HTTPException(status_code=400, detail="This mobile number is already registered with another account")
    
    try:
        await db.users.update_one({"uid": uid}, {"$set": update_data})
    except Exception as e:
        if "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="This mobile number is already registered with another account")
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")
    
    if cache:
        await cache.delete(f"user_data:{uid}")
    
    return {"message": "Profile updated successfully"}


@router.post("/user/{uid}/upload-profile-picture")
async def upload_profile_picture(uid: str, file: UploadFile = File(...)):
    """Upload profile picture (stores as base64)"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    content = await file.read()
    
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size must be less than 5MB")
    
    base64_image = base64.b64encode(content).decode('utf-8')
    image_data_url = f"data:{file.content_type};base64,{base64_image}"
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "profile_picture": image_data_url,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Profile picture uploaded successfully",
        "profile_picture": image_data_url[:100] + "..."
    }


@router.delete("/user/{uid}/profile-picture")
async def delete_profile_picture(uid: str):
    """Delete profile picture"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "profile_picture": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Profile picture deleted successfully"}


@router.put("/user/{uid}/complete-profile")
async def complete_profile(uid: str, request: Request):
    """Complete user profile with all additional fields"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    
    unique_fields = {
        "mobile": "Mobile number",
        "aadhaar_number": "Aadhaar number", 
        "pan_number": "PAN number"
    }
    
    for field, field_label in unique_fields.items():
        if data.get(field):
            value = data[field].strip()
            if field == "pan_number":
                value = value.upper()
            if field == "aadhaar_number":
                value = value.replace(" ", "")
            
            data[field] = value
            
            if not await check_unique_fields(field, value, exclude_uid=uid):
                owner = await get_duplicate_field_owner(field, value)
                owner_hint = ""
                if owner:
                    masked_email = owner.get("email", "")[:3] + "***" if owner.get("email") else ""
                    owner_hint = f" (already registered with {masked_email})"
                
                raise HTTPException(
                    status_code=400,
                    detail=f"{field_label} already registered{owner_hint}. कृपया दुसरा {field_label} वापरा."
                )
    
    update_data = {
        "first_name": data.get("first_name"),
        "middle_name": data.get("middle_name"),
        "last_name": data.get("last_name"),
        "mobile": data.get("mobile"),
        "gender": data.get("gender"),
        "date_of_birth": data.get("date_of_birth"),
        "address_line1": data.get("address_line1"),
        "address_line2": data.get("address_line2"),
        "city": data.get("city"),
        "state": data.get("state"),
        "district": data.get("district"),
        "tahsil": data.get("tahsil"),
        "pincode": data.get("pincode"),
        "aadhaar_number": data.get("aadhaar_number"),
        "pan_number": data.get("pan_number"),
        "upi_id": data.get("upi_id"),
        "profile_complete": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    if any(f in data for f in ["first_name", "middle_name", "last_name"]):
        name_parts = []
        if data.get('first_name'):
            name_parts.append(data['first_name'])
        if data.get('middle_name'):
            name_parts.append(data['middle_name'])
        if data.get('last_name'):
            name_parts.append(data['last_name'])
        if name_parts:
            update_data['name'] = ' '.join(name_parts)
    
    await db.users.update_one({"uid": uid}, {"$set": update_data})
    
    return {"message": "Profile completed successfully", "profile_complete": True}


@router.post("/user/{uid}/change-password")
async def change_user_password(uid: str, request: Request):
    """Change user password"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Both passwords are required")
    
    if not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Password not set for this account")
    
    if not verify_password(current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    new_hash = hash_password(new_password)
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "password_hash": new_hash,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password changed successfully"}


@router.post("/user/{uid}/change-pin")
async def change_user_pin(uid: str, request: Request):
    """Change user PIN"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    current_pin = data.get("current_pin")
    new_pin = data.get("new_pin")
    
    if not current_pin or not new_pin:
        raise HTTPException(status_code=400, detail="Both current and new PIN are required")
    
    if len(new_pin) != 6 or not new_pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 6 digits")
    
    # Check for weak PINs (all same digits)
    if len(set(new_pin)) == 1:
        raise HTTPException(status_code=400, detail="PIN cannot have all same digits")
    
    # Verify current PIN (stored as hashed password)
    stored_password = user.get("password") or user.get("password_hash")
    if not stored_password:
        raise HTTPException(status_code=400, detail="PIN not set for this account")
    
    if not verify_password(current_pin, stored_password):
        raise HTTPException(status_code=401, detail="Current PIN is incorrect")
    
    # Hash and save new PIN
    new_hash = hash_password(new_pin)
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "password": new_hash,
            "pin_migrated": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "PIN changed successfully"}


# ========== ACCOUNT DELETION ==========

@router.post("/user/{uid}/request-account-deletion")
async def request_account_deletion(uid: str, request: Request):
    """Request account deletion with soft delete (30 day grace period)"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_deleted") or user.get("deletion_scheduled_at"):
        raise HTTPException(status_code=400, detail="Account is already scheduled for deletion")
    
    data = await request.json()
    password = data.get("password")
    reason = data.get("reason", "User requested deletion")
    
    if not password:
        raise HTTPException(status_code=400, detail="Password confirmation required")
    
    if not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Password not set for this account")
    
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    now = datetime.now(timezone.utc)
    deletion_date = now + timedelta(days=30)
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "deletion_scheduled_at": now.isoformat(),
            "deletion_scheduled_for": deletion_date.isoformat(),
            "deletion_reason": reason,
            "is_active": False,
            "updated_at": now.isoformat()
        }}
    )
    
    if log_activity:
        await log_activity(
            user_id=uid,
            action_type="account_deletion_requested",
            description=f"Account deletion requested. Will be deleted on {deletion_date.strftime('%Y-%m-%d')}",
            metadata={"reason": reason, "deletion_date": deletion_date.isoformat()}
        )
    
    return {
        "message": "Account deletion scheduled",
        "deletion_date": deletion_date.isoformat(),
        "can_cancel_until": deletion_date.isoformat()
    }


@router.post("/user/{uid}/cancel-account-deletion")
async def cancel_account_deletion(uid: str, request: Request):
    """Cancel scheduled account deletion"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get("deletion_scheduled_at"):
        raise HTTPException(status_code=400, detail="No deletion scheduled for this account")
    
    if user.get("is_deleted"):
        raise HTTPException(status_code=400, detail="Account has already been deleted")
    
    data = await request.json()
    password = data.get("password")
    
    if not password:
        raise HTTPException(status_code=400, detail="Password confirmation required")
    
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    await db.users.update_one(
        {"uid": uid},
        {
            "$set": {
                "is_active": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$unset": {
                "deletion_scheduled_at": "",
                "deletion_scheduled_for": "",
                "deletion_reason": ""
            }
        }
    )
    
    if log_activity:
        await log_activity(
            user_id=uid,
            action_type="account_deletion_cancelled",
            description="Account deletion cancelled by user"
        )
    
    return {"message": "Account deletion cancelled successfully"}


@router.get("/user/{uid}/deletion-status")
async def get_deletion_status(uid: str):
    """Get account deletion status"""
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "deletion_scheduled_at": 1, "deletion_scheduled_for": 1, "is_deleted": 1})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_deleted"):
        return {
            "is_scheduled_for_deletion": False,
            "is_deleted": True,
            "message": "Account has been permanently deleted"
        }
    
    if not user.get("deletion_scheduled_at"):
        return {
            "is_scheduled_for_deletion": False,
            "can_recover": True,
            "message": "Account is active"
        }
    
    deletion_date = user.get("deletion_scheduled_for")
    now = datetime.now(timezone.utc)
    
    if deletion_date:
        try:
            deletion_dt = datetime.fromisoformat(deletion_date.replace('Z', '+00:00'))
            days_remaining = (deletion_dt - now).days
            
            return {
                "is_scheduled_for_deletion": True,
                "deletion_date": deletion_date,
                "days_remaining": max(0, days_remaining),
                "can_cancel": days_remaining > 0,
                "message": f"Account will be deleted in {days_remaining} days"
            }
        except:
            pass
    
    return {
        "is_scheduled_for_deletion": True,
        "can_recover": False,
        "message": "Account is scheduled for permanent deletion"
    }


# ========== USER STATS ==========

@router.get("/user/stats/today/{uid}")
async def get_user_today_stats(uid: str):
    """Get today's PRC earned and spent for a user - CACHED 60 sec"""
    # Cache key for today's stats
    cache_key = f"user:stats:today:{uid}"
    
    if cache:
        cached = await cache.get(cache_key)
        if cached:
            return cached
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_str = today_start.isoformat()
    
    # Get today's earnings
    earnings_pipeline = [
        {
            "$match": {
                "user_id": uid,
                "created_at": {"$gte": today_str},
                "type": {"$in": ["mining_reward", "referral_bonus", "tap_reward", "bonus"]}
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    earnings_result = await db.transactions.aggregate(earnings_pipeline).to_list(1)
    today_earned = earnings_result[0]["total"] if earnings_result else 0
    
    # Get today's spending
    spending_pipeline = [
        {
            "$match": {
                "user_id": uid,
                "created_at": {"$gte": today_str},
                "type": {"$in": ["bill_payment", "gift_voucher", "marketplace_purchase", "withdrawal"]}
            }
        },
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
    ]
    
    spending_result = await db.transactions.aggregate(spending_pipeline).to_list(1)
    today_spent = spending_result[0]["total"] if spending_result else 0
    
    result = {
        "today_earned": round(today_earned, 4),
        "today_spent": round(today_spent, 4),
        "net_change": round(today_earned - today_spent, 4),
        "date": today_start.strftime("%Y-%m-%d")
    }
    
    # Cache for 60 seconds
    if cache:
        await cache.set(cache_key, result, ttl=60)
    
    return result


@router.get("/user/stats/redeemed/{uid}")
async def get_user_redeemed_stats(uid: str):
    """Get user's total redeemed PRC statistics - CACHED 5 min"""
    # Cache key for redeemed stats
    cache_key = f"user:stats:redeemed:{uid}"
    
    if cache:
        cached = await cache.get(cache_key)
        if cached:
            return cached
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get bill payment totals
    bp_total = await db.bill_payment_requests.aggregate([
        {"$match": {"user_id": uid, "status": {"$in": ["approved", "completed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_prc_deducted"}}}
    ]).to_list(1)
    
    # Get gift voucher totals
    gv_total = await db.gift_voucher_requests.aggregate([
        {"$match": {"user_id": uid, "status": {"$in": ["approved", "completed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_prc_deducted"}}}
    ]).to_list(1)
    
    # Get marketplace order totals
    orders_total = await db.orders.aggregate([
        {"$match": {"user_id": uid, "status": {"$in": ["completed", "delivered"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_prc"}}}
    ]).to_list(1)
    
    result = {
        "bill_payments": round(bp_total[0]["total"] if bp_total else 0, 2),
        "gift_vouchers": round(gv_total[0]["total"] if gv_total else 0, 2),
        "marketplace": round(orders_total[0]["total"] if orders_total else 0, 2),
        "total_redeemed": round(
            (bp_total[0]["total"] if bp_total else 0) +
            (gv_total[0]["total"] if gv_total else 0) +
            (orders_total[0]["total"] if orders_total else 0),
            2
        )
    }
    
    # Cache for 5 minutes
    if cache:
        await cache.set(cache_key, result, ttl=300)
    
    return result


@router.get("/user/{uid}/dashboard")
async def get_user_dashboard_combined(uid: str):
    """Combined API for User Dashboard - returns ALL data in ONE call"""
    cache_key = f"user:dashboard:{uid}"
    
    if cache:
        cached = await cache.get(cache_key)
        if cached:
            return cached
    
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    
    # Check mining session validity
    mining_active = False
    mining_session_end = None
    remaining_hours = 0
    mined_this_session = 0
    
    if user.get("mining_start_time"):
        start_time = user["mining_start_time"]
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        
        session_end = start_time + timedelta(hours=24)
        if now < session_end:
            mining_active = True
            mining_session_end = session_end.isoformat()
            remaining_hours = (session_end - now).total_seconds() / 3600
            
            elapsed_hours = (now - start_time).total_seconds() / 3600
            base_rate = user.get("mining_rate", 0.5)
            mined_this_session = elapsed_hours * base_rate
    
    referral_count = await db.users.count_documents({"referred_by": uid})
    
    recent_activity = await db.transactions.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    subscription_plan = user.get("subscription_plan", "explorer")
    subscription_expiry = user.get("subscription_expiry")
    subscription_start = (
        user.get("subscription_start_date") or 
        user.get("subscription_start") or 
        user.get("subscription_created_at") or 
        user.get("vip_activation_date") or
        user.get("vip_activated_at")
    )
    
    result = {
        "user": {
            "uid": uid,
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "mobile": user.get("mobile", ""),
            "prc_balance": round(user.get("prc_balance", 0), 4),
            "total_mined": round(user.get("total_mined", 0), 4),
            "total_redeemed": round(user.get("total_redeemed", 0), 2),
            "referral_count": referral_count,
            "referral_code": user.get("referral_code", ""),
            "subscription_plan": subscription_plan,
            "subscription_expiry": subscription_expiry,
            "subscription_start": subscription_start,
            "mining_rate": user.get("mining_rate", 0.5),
            "created_at": user.get("created_at"),
            "profile_image": user.get("profile_image"),
            "kyc_status": user.get("kyc_status", "pending"),
            "city": user.get("city", ""),
            "district": user.get("district", ""),
            "state": user.get("state", "")
        },
        "mining": {
            "active": mining_active,
            "session_end": mining_session_end,
            "remaining_hours": round(remaining_hours, 2),
            "mined_this_session": round(mined_this_session, 4),
            "session_start": user.get("mining_start_time")
        },
        "recent_activity": recent_activity,
        "cached_at": now.isoformat()
    }
    
    if cache:
        await cache.set(cache_key, result, ttl=30)
    
    return result
