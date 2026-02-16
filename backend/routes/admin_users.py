"""
Admin Users Routes - User management for admin panel
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging
import uuid

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Users"])

# Database and cache references
db = None
cache = None

# Helper function references
log_admin_action = None
hash_password = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager


async def send_notification(user_id: str, title: str, message: str, notif_type: str, icon: str = "🔔", action_url: str = None):
    """Send notification to user"""
    try:
        notification = {
            "notification_id": str(uuid.uuid4()),
            "user_id": user_id,
            "user_uid": user_id,
            "title": title,
            "message": message,
            "type": notif_type,
            "icon": icon,
            "action_url": action_url,
            "read": False,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    except Exception as e:
        logging.error(f"Failed to send notification: {e}")


def set_helpers(helpers: dict):
    global log_admin_action, hash_password
    log_admin_action = helpers.get('log_admin_action')
    hash_password = helpers.get('hash_password')


# ========== USER LISTING & SEARCH ==========

@router.get("/users")
async def get_admin_users(
    page: int = 1,
    limit: int = 50,
    search: str = None,
    status: str = None,
    membership: str = None,
    kyc_status: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
):
    """Get users list with advanced filtering for admin panel - OPTIMIZED"""
    import asyncio
    
    query = {}
    
    if search:
        search_term = search.strip()
        # For UID exact match (faster)
        if len(search_term) > 10 and search_term.isalnum():
            query["uid"] = search_term
        else:
            query["$or"] = [
                {"name": {"$regex": search_term, "$options": "i"}},
                {"email": {"$regex": search_term, "$options": "i"}},
                {"mobile": {"$regex": search_term, "$options": "i"}},
                {"uid": search_term}
            ]
    
    if status == "active":
        query["is_active"] = True
        query["is_banned"] = {"$ne": True}
    elif status == "banned":
        query["is_banned"] = True
    elif status == "inactive":
        query["is_active"] = False
    
    if membership:
        query["$or"] = [
            {"membership_type": membership},
            {"subscription_plan": membership}
        ] if "$or" not in query else query.get("$or")
        if "$or" in query and search:
            query["subscription_plan"] = membership
    
    if kyc_status:
        query["kyc_status"] = kyc_status
    
    skip = (page - 1) * limit
    sort_direction = -1 if sort_order == "desc" else 1
    
    # Projection - only needed fields
    projection = {"_id": 0, "password_hash": 0, "password": 0, "reset_token": 0, "biometric_credentials": 0}
    
    # Run count and find in PARALLEL
    count_task = db.users.count_documents(query)
    find_task = db.users.find(query, projection).sort(sort_by, sort_direction).skip(skip).limit(limit).to_list(limit)
    
    total, users = await asyncio.gather(count_task, find_task)
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "filters_applied": {
            "search": search,
            "status": status,
            "membership": membership,
            "kyc_status": kyc_status
        }
    }


@router.get("/users/search-suggestions")
async def get_search_suggestions(q: str = "", limit: int = 10):
    """
    Advanced search suggestions - returns matching users as user types
    Searches by: name, email, phone, uid
    """
    if not q or len(q) < 2:
        return {"suggestions": []}
    
    # Build search query - search across multiple fields
    search_query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"mobile": {"$regex": q, "$options": "i"}},
            {"uid": {"$regex": q, "$options": "i"}}
        ]
    }
    
    # Fetch matching users with limited fields
    users = await db.users.find(
        search_query,
        {
            "_id": 0,
            "uid": 1,
            "name": 1,
            "email": 1,
            "phone": 1,
            "mobile": 1,
            "subscription_plan": 1,
            "kyc_status": 1,
            "prc_balance": 1
        }
    ).limit(limit).to_list(limit)
    
    # Format suggestions
    suggestions = []
    for user in users:
        phone = user.get("phone") or user.get("mobile") or ""
        suggestions.append({
            "uid": user.get("uid"),
            "name": user.get("name", "Unknown"),
            "email": user.get("email", ""),
            "phone": phone,
            "subscription_plan": user.get("subscription_plan", "free"),
            "kyc_status": user.get("kyc_status", "pending"),
            "prc_balance": user.get("prc_balance", 0),
            "display_text": f"{user.get('name', 'Unknown')} ({user.get('uid', '')})",
            "subtitle": f"{user.get('email', '')} • {phone}"
        })
    
    return {
        "suggestions": suggestions,
        "query": q,
        "count": len(suggestions)
    }
async def get_admin_user_stats():
    """Get user statistics for admin dashboard"""
    try:
        total_users = await db.users.count_documents({})
        active_users = await db.users.count_documents({"is_active": True, "is_banned": {"$ne": True}})
        vip_users = await db.users.count_documents({"membership_type": "vip"})
        banned_users = await db.users.count_documents({"is_banned": True})
        
        # Today's stats
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        new_today = await db.users.count_documents({"created_at": {"$gte": today_start}})
        
        # KYC stats
        kyc_pending = await db.users.count_documents({"kyc_status": "pending"})
        kyc_approved = await db.users.count_documents({"kyc_status": "approved"})
        kyc_rejected = await db.users.count_documents({"kyc_status": "rejected"})
        
        # Subscription breakdown
        subscription_stats = await db.users.aggregate([
            {"$group": {"_id": "$subscription_plan", "count": {"$sum": 1}}}
        ]).to_list(10)
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "vip_users": vip_users,
            "banned_users": banned_users,
            "new_today": new_today,
            "kyc": {
                "pending": kyc_pending,
                "approved": kyc_approved,
                "rejected": kyc_rejected
            },
            "subscriptions": {s["_id"] or "none": s["count"] for s in subscription_stats}
        }
    except Exception as e:
        logging.error(f"User stats error: {e}")
        return {"error": str(e)}


@router.get("/users/{uid}")
async def get_admin_user_detail(uid: str):
    """Get detailed user info for admin"""
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "password_hash": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get recent transactions
    recent_txns = await db.transactions.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get referral info
    referral_count = await db.users.count_documents({"referred_by": uid})
    
    # Get recent orders
    recent_orders = await db.orders.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "user": user,
        "recent_transactions": recent_txns,
        "referral_count": referral_count,
        "recent_orders": recent_orders
    }


# ========== USER MANAGEMENT ==========

@router.put("/users/{uid}")
async def update_admin_user(uid: str, request: Request):
    """Update user details (admin)"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Fields that admin can update
    allowed_fields = [
        "name", "email", "mobile", "role", "membership_type", "subscription_plan",
        "subscription_expiry", "prc_balance", "is_active", "is_banned",
        "kyc_status", "notes"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = admin_id
    
    await db.users.update_one({"uid": uid}, {"$set": update_data})
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="user_updated",
            entity_type="user",
            entity_id=uid,
            details={"fields_updated": list(update_data.keys())}
        )
    
    return {"success": True, "message": "User updated"}


@router.post("/users/{uid}/ban")
async def ban_user(uid: str, request: Request):
    """Ban a user"""
    data = await request.json()
    admin_id = data.get("admin_id")
    reason = data.get("reason", "Violation of terms")
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot ban admin users")
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "is_banned": True,
            "is_active": False,
            "ban_reason": reason,
            "banned_at": datetime.now(timezone.utc).isoformat(),
            "banned_by": admin_id
        }}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="user_banned",
            entity_type="user",
            entity_id=uid,
            details={"reason": reason}
        )
    
    return {"success": True, "message": f"User {uid} has been banned"}


@router.post("/users/{uid}/reset-pin")
async def admin_reset_user_pin(uid: str, request: Request):
    """Admin reset user's PIN to random 6-digit PIN"""
    import random
    
    data = await request.json()
    admin_id = data.get("admin_id")
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate random 6-digit PIN (avoiding weak patterns)
    while True:
        new_pin = str(random.randint(100000, 999999))
        # Ensure not all same digits
        if len(set(new_pin)) > 1:
            break
    
    if not hash_password:
        raise HTTPException(status_code=500, detail="Hash function not available")
    
    hashed_pin = hash_password(new_pin)
    
    await db.users.update_one(
        {"uid": uid},
        {
            "$set": {
                "password": hashed_pin,
                "pin_migrated": True,
                "pin_reset_by_admin": True,
                "pin_reset_at": datetime.now(timezone.utc).isoformat(),
                "pin_reset_by": admin_id,
                "must_change_pin": True,
                "failed_login_attempts": 0,
                "locked_until": None
            }
        }
    )
    
    # Clear any lockouts
    await db.login_attempts.delete_many({
        "$or": [
            {"identifier": user.get("email", "")},
            {"identifier": user.get("mobile", "")},
            {"identifier": uid}
        ]
    })
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="user_pin_reset",
            entity_type="user",
            entity_id=uid,
            details={"user_email": user.get("email"), "user_name": user.get("name")}
        )
    
    return {
        "success": True, 
        "message": f"PIN reset successfully",
        "new_pin": new_pin,
        "user_email": user.get("email"),
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("name", ""),
        "note": "Share this PIN with user. They must change it after login."
    }


@router.post("/users/{uid}/unban")
async def unban_user(uid: str, request: Request):
    """Unban a user"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"uid": uid},
        {
            "$set": {
                "is_banned": False,
                "is_active": True,
                "unbanned_at": datetime.now(timezone.utc).isoformat(),
                "unbanned_by": admin_id
            },
            "$unset": {"ban_reason": ""}
        }
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="user_unbanned",
            entity_type="user",
            entity_id=uid
        )
    
    return {"success": True, "message": f"User {uid} has been unbanned"}


@router.post("/users/{uid}/reset-password")
async def admin_reset_user_password(uid: str, request: Request):
    """Reset user password (admin)"""
    data = await request.json()
    admin_id = data.get("admin_id")
    new_password = data.get("new_password")
    
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hashed = hash_password(new_password) if hash_password else new_password
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "password_hash": hashed,
            "password": hashed,
            "password_reset_at": datetime.now(timezone.utc).isoformat(),
            "password_reset_by": admin_id
        }}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="user_password_reset",
            entity_type="user",
            entity_id=uid
        )
    
    return {"success": True, "message": "Password reset successfully"}


@router.post("/users/{uid}/adjust-balance")
async def adjust_user_balance(uid: str, request: Request):
    """Adjust user PRC balance"""
    data = await request.json()
    admin_id = data.get("admin_id")
    adjustment = float(data.get("adjustment", 0))
    reason = data.get("reason", "Admin adjustment")
    
    if adjustment == 0:
        raise HTTPException(status_code=400, detail="Adjustment cannot be zero")
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_balance = user.get("prc_balance", 0) + adjustment
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="Resulting balance cannot be negative")
    
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {"prc_balance": new_balance, "updated_at": now.isoformat()}}
    )
    
    # Log transaction
    await db.transactions.insert_one({
        "transaction_id": f"ADJ{now.strftime('%Y%m%d%H%M%S')}",
        "user_id": uid,
        "type": "admin_credit" if adjustment > 0 else "admin_debit",
        "amount": adjustment,
        "description": reason,
        "admin_id": admin_id,
        "created_at": now.isoformat()
    })
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="balance_adjusted",
            entity_type="user",
            entity_id=uid,
            details={"adjustment": adjustment, "reason": reason, "new_balance": new_balance}
        )
    
    return {"success": True, "new_balance": new_balance}


# ========== KYC MANAGEMENT ==========

@router.get("/kyc/pending")
async def get_pending_kyc(page: int = 1, limit: int = 50):
    """Get users with pending KYC"""
    skip = (page - 1) * limit
    
    total = await db.users.count_documents({"kyc_status": "pending"})
    users = await db.users.find(
        {"kyc_status": "pending"},
        {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "created_at": 1,
         "aadhaar_number": 1, "pan_number": 1, "kyc_documents": 1}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"users": users, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.post("/kyc/{uid}/approve")
async def approve_kyc(uid: str, request: Request):
    """Approve user KYC"""
    try:
        try:
            data = await request.json()
        except Exception:
            data = {}
        admin_id = data.get("admin_id")
        
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "kyc_status": "verified",
                "kyc_approved_at": datetime.now(timezone.utc).isoformat(),
                "kyc_approved_by": admin_id
            }}
        )
        
        # Send notification to user
        await send_notification(
            user_id=uid,
            title="✅ KYC Verified Successfully!",
            message="Congratulations! Your KYC verification is complete. You can now access all features and make withdrawals.",
            notif_type="kyc_approved",
            icon="✅",
            action_url="/profile"
        )
        
        if log_admin_action:
            await log_admin_action(
                admin_uid=admin_id,
                action="kyc_approved",
                entity_type="user",
                entity_id=uid
            )
        
        return {"success": True, "message": "KYC approved"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/kyc/{uid}/reject")
async def reject_kyc(uid: str, request: Request):
    """Reject user KYC"""
    try:
        try:
            data = await request.json()
        except Exception:
            data = {}
        admin_id = data.get("admin_id")
        reason = data.get("reason", "Documents not valid")
        
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "kyc_status": "rejected",
                "kyc_rejection_reason": reason,
                "kyc_rejected_at": datetime.now(timezone.utc).isoformat(),
                "kyc_rejected_by": admin_id
            }}
        )
        
        # Send notification to user
        await send_notification(
            user_id=uid,
            title="❌ KYC Verification Failed",
            message=f"Your KYC verification was rejected. Reason: {reason}. Please re-submit with correct documents.",
            notif_type="kyc_rejected",
            icon="❌",
            action_url="/kyc"
        )
        
        if log_admin_action:
            await log_admin_action(
                admin_uid=admin_id,
                action="kyc_rejected",
                entity_type="user",
                entity_id=uid,
                details={"reason": reason}
            )
        
        return {"success": True, "message": "KYC rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== ADMIN EXISTENCE CHECK ==========

@router.get("/check-admin-exists")
async def check_admin_exists():
    """Check if any admin user exists"""
    admin = await db.users.find_one({"role": "admin"})
    return {"admin_exists": admin is not None}
