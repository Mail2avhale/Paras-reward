"""
Admin Misc Routes - Miscellaneous admin operations
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

# Import WalletService for ledger-based PRC operations (Phase 4 Architecture)
from app.services import WalletService

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Misc"])

# Database reference
db = None

# Helpers
log_admin_action = None
hash_password = None

def set_db(database):
    global db
    db = database

def set_helpers(helpers: dict):
    global log_admin_action, hash_password
    log_admin_action = helpers.get('log_admin_action')
    hash_password = helpers.get('hash_password')


# ========== ADMIN MANAGEMENT ==========

@router.post("/create-first-admin")
async def create_first_admin(request: Request):
    """Create the first admin user"""
    # Check if admin already exists
    existing_admin = await db.users.find_one({"role": "admin"})
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin user already exists")
    
    data = await request.json()
    
    admin_user = {
        "uid": str(uuid.uuid4()),
        "email": data.get("email"),
        "password_hash": hash_password(data.get("password")) if hash_password else data.get("password"),
        "name": data.get("name", "Admin"),
        "role": "admin",
        "is_active": True,
        "subscription_plan": "elite",
        "prc_balance": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_user)
    admin_user.pop("_id", None)
    admin_user.pop("password_hash", None)
    
    return {"success": True, "message": "First admin created", "uid": admin_user["uid"]}


@router.post("/promote")
async def promote_user(request: Request):
    """Promote user to admin/sub_admin"""
    data = await request.json()
    admin_id = data.get("admin_id")
    target_uid = data.get("target_uid")
    new_role = data.get("role", "sub_admin")
    
    if new_role not in ["sub_admin", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Verify admin
    admin = await db.users.find_one({"uid": admin_id})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admin can promote users")
    
    # Update target user
    result = await db.users.update_one(
        {"uid": target_uid},
        {"$set": {
            "role": new_role,
            "promoted_at": datetime.now(timezone.utc).isoformat(),
            "promoted_by": admin_id
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="user_promoted",
            entity_type="user",
            entity_id=target_uid,
            details={"new_role": new_role}
        )
    
    return {"success": True, "message": f"User promoted to {new_role}"}


# ========== USER ROLE MANAGEMENT ==========

@router.put("/users/{uid}/role")
async def update_user_role(uid: str, request: Request):
    """Update user role"""
    data = await request.json()
    admin_id = data.get("admin_id")
    new_role = data.get("role")
    
    if new_role not in ["user", "sub_admin", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"uid": uid},
        {"$set": {"role": new_role, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": f"User role updated to {new_role}"}


@router.put("/users/{uid}/status")
async def update_user_status(uid: str, request: Request):
    """Update user status (active/inactive)"""
    data = await request.json()
    is_active = data.get("is_active", True)
    
    result = await db.users.update_one(
        {"uid": uid},
        {"$set": {"is_active": is_active, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": f"User status updated to {'active' if is_active else 'inactive'}"}


@router.delete("/users/{uid}")
async def delete_user(uid: str, admin_id: str):
    """Delete (deactivate) a user"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin user")
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "is_active": False,
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": admin_id
        }}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="user_deleted",
            entity_type="user",
            entity_id=uid
        )
    
    return {"success": True, "message": "User deleted"}


# ========== SUBSCRIPTION MANAGEMENT ==========

@router.post("/users/{uid}/subscription")
async def update_user_subscription(uid: str, request: Request):
    """Update user subscription"""
    data = await request.json()
    admin_id = data.get("admin_id")
    plan = data.get("plan", "startup")
    duration_days = int(data.get("duration_days", 30))
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    
    # Check if extending existing subscription
    current_expiry = user.get("subscription_expiry")
    start_date = now
    
    if current_expiry:
        try:
            current_expiry_dt = datetime.fromisoformat(current_expiry.replace('Z', '+00:00'))
            if current_expiry_dt > now:
                start_date = current_expiry_dt
        except Exception:
            pass
    
    new_expiry = (start_date + timedelta(days=duration_days)).isoformat()
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "subscription_plan": plan,
            "subscription_expiry": new_expiry,
            "subscription_updated_at": now.isoformat(),
            "subscription_updated_by": admin_id
        }}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="subscription_updated",
            entity_type="user",
            entity_id=uid,
            details={"plan": plan, "duration_days": duration_days, "new_expiry": new_expiry}
        )
    
    return {"success": True, "message": "Subscription updated", "new_expiry": new_expiry}


@router.get("/users/{uid}/subscription-history")
async def get_user_subscription_history(uid: str):
    """Get user's subscription history"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get payment history
    payments = await db.vip_payments.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(50)
    
    return {
        "current": {
            "plan": user.get("subscription_plan"),
            "expiry": user.get("subscription_expiry")
        },
        "payment_history": payments
    }


# ========== RENEWAL NOTIFICATIONS ==========

@router.post("/run-explorer-burn")
async def run_explorer_burn(request: Request):
    """DEPRECATED - Burn module removed March 2026"""
    return {"success": True, "deprecated": True, "message": "Burn module removed March 2026"}

@router.post("/smart-burn")
async def smart_burn_check_and_run(request: Request):
    """DEPRECATED - Burn module removed March 2026"""
    return {"success": True, "deprecated": True, "message": "Burn module removed March 2026", "burn_executed": False}

@router.post("/run-prc-burn")
async def run_prc_burn_manual(request: Request):
    """Manually trigger auto-burn for all expired subscription users"""
    from routes.burning import run_auto_burn_all_expired
    try:
        await run_auto_burn_all_expired()
        # Fetch latest job log
        job = await db.burn_job_logs.find_one(
            {"job_type": "cron_auto_burn"},
            {"_id": 0},
            sort=[("timestamp", -1)]
        )
        return {
            "success": True,
            "message": f"Auto-burn completed: {job.get('users_burned', 0)} users burned, {job.get('total_prc_burned', 0)} PRC total",
            "result": job
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.get("/burn-stats")
async def get_burn_stats():
    """Get auto-burn statistics for admin dashboard"""
    # Latest job log
    last_job = await db.burn_job_logs.find_one(
        {"job_type": "cron_auto_burn"},
        {"_id": 0},
        sort=[("timestamp", -1)]
    )
    # Total burns all time
    pipeline = [
        {"$match": {"type": "auto_burn"}},
        {"$group": {
            "_id": None,
            "total_burned": {"$sum": {"$abs": "$amount"}},
            "total_transactions": {"$sum": 1},
            "unique_users": {"$addToSet": "$uid"}
        }}
    ]
    agg = await db.prc_transactions.aggregate(pipeline).to_list(1)
    stats = agg[0] if agg else {}

    # Recent burn transactions (last 10)
    recent = await db.prc_transactions.find(
        {"type": "auto_burn"},
        {"_id": 0, "uid": 1, "amount": 1, "balance_after": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)

    # Eligible users count (expired with balance)
    eligible = await db.users.count_documents({
        "prc_balance": {"$gt": 0.01},
        "subscription_status": {"$ne": "active"}
    })

    return {
        "success": True,
        "last_job": last_job,
        "all_time": {
            "total_burned": round(stats.get("total_burned", 0), 2),
            "total_transactions": stats.get("total_transactions", 0),
            "unique_users": len(stats.get("unique_users", [])),
        },
        "eligible_users": eligible,
        "recent_burns": recent,
    }

@router.get("/burn-settings")
async def get_burn_settings():
    """Get current burn configuration"""
    return {
        "success": True,
        "settings": {
            "daily_burn_percent": 3.33,
            "burn_type": "auto_continuous",
            "schedule": "Every 12 hours (5:30 AM & 5:30 PM UTC)",
            "target": "Users with expired/no active subscriptions",
        }
    }


@router.post("/send-renewal-notifications")
async def send_renewal_notifications(request: Request):
    """Send renewal notifications to expiring Elite users"""
    data = await request.json()
    admin_id = data.get("admin_id")
    days_before = int(data.get("days_before", 7))
    
    now = datetime.now(timezone.utc)
    expiry_threshold = (now + timedelta(days=days_before)).isoformat()
    
    # Find users with expiring subscriptions (Elite plan or legacy paid plans)
    expiring_users = await db.users.find({
        "subscription_plan": {"$in": ["elite", "startup", "growth", "vip", "pro"]},
        "subscription_expiry": {"$lte": expiry_threshold, "$gte": now.isoformat()}
    }, {"_id": 0, "uid": 1, "email": 1, "name": 1, "subscription_expiry": 1}).to_list(1000)
    
    # Create notifications
    notifications_created = 0
    for user in expiring_users:
        await db.notifications.insert_one({
            "notification_id": str(uuid.uuid4()),
            "user_id": user["uid"],
            "type": "renewal_reminder",
            "title": "Subscription Expiring Soon",
            "message": f"Your Elite subscription will expire soon. Renew now to continue enjoying benefits!",
            "is_read": False,
            "created_at": now.isoformat()
        })
        notifications_created += 1
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="renewal_notifications_sent",
            entity_type="system",
            details={"notifications_sent": notifications_created, "days_before": days_before}
        )
    
    return {"success": True, "notifications_sent": notifications_created}


# ========== PROFIT WALLET OPERATIONS ==========

@router.post("/profit-wallet/credit")
async def credit_profit_wallet(request: Request):
    """Credit user's profit wallet"""
    data = await request.json()
    admin_id = data.get("admin_id")
    user_id = data.get("user_id")
    amount = float(data.get("amount", 0))
    reason = data.get("reason", "Admin credit")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"uid": user_id},
        {"$inc": {"profit_wallet_balance": amount}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"PWC{now.strftime('%Y%m%d%H%M%S')}",
        "user_id": user_id,
        "type": "profit_wallet_credit",
        "amount": amount,
        "description": reason,
        "admin_id": admin_id,
        "created_at": now.isoformat()
    })
    
    return {"success": True, "message": f"Credited {amount} to profit wallet"}


@router.post("/profit-wallet/deduct")
async def deduct_profit_wallet(request: Request):
    """Deduct from user's profit wallet"""
    data = await request.json()
    admin_id = data.get("admin_id")
    user_id = data.get("user_id")
    amount = float(data.get("amount", 0))
    reason = data.get("reason", "Admin deduction")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("profit_wallet_balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"uid": user_id},
        {"$inc": {"profit_wallet_balance": -amount}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"PWD{now.strftime('%Y%m%d%H%M%S')}",
        "user_id": user_id,
        "type": "profit_wallet_debit",
        "amount": -amount,
        "description": reason,
        "admin_id": admin_id,
        "created_at": now.isoformat()
    })
    
    return {"success": True, "message": f"Deducted {amount} from profit wallet"}


@router.post("/profit-wallet/adjust")
async def adjust_profit_wallet(request: Request):
    """Adjust user's profit wallet (credit or debit)"""
    data = await request.json()
    admin_id = data.get("admin_id")
    user_id = data.get("user_id")
    adjustment = float(data.get("adjustment", 0))
    reason = data.get("reason", "Admin adjustment")
    
    if adjustment == 0:
        raise HTTPException(status_code=400, detail="Adjustment cannot be zero")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_balance = user.get("profit_wallet_balance", 0) + adjustment
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="Resulting balance cannot be negative")
    
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"profit_wallet_balance": new_balance}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"PWA{now.strftime('%Y%m%d%H%M%S')}",
        "user_id": user_id,
        "type": "profit_wallet_adjustment",
        "amount": adjustment,
        "description": reason,
        "admin_id": admin_id,
        "created_at": now.isoformat()
    })
    
    return {"success": True, "new_balance": new_balance}


# ========== MONTHLY FEES ==========

@router.post("/apply-monthly-fees")
async def apply_monthly_fees(request: Request):
    """Apply monthly maintenance fees using WalletService (with ledger entries)"""
    data = await request.json()
    admin_id = data.get("admin_id")
    fee_amount = float(data.get("fee_amount", 0))
    
    if fee_amount <= 0:
        raise HTTPException(status_code=400, detail="Fee amount must be positive")
    
    # Get all users with balance > fee
    users = await db.users.find(
        {"prc_balance": {"$gte": fee_amount}},
        {"_id": 0, "uid": 1}
    ).to_list(10000)
    
    fees_collected = 0
    users_charged = 0
    failed_users = []
    
    for user in users:
        # Use WalletService for ledger-tracked fee deduction
        result = WalletService.debit(
            user_id=user["uid"],
            amount=fee_amount,
            txn_type="monthly_fee",
            description="Monthly maintenance fee",
            reference=f"MONTHLY-FEE-{admin_id or 'system'}"
        )
        
        if result.get("success"):
            fees_collected += fee_amount
            users_charged += 1
        else:
            failed_users.append(user["uid"])
    
    logging.info(f"[ADMIN] Monthly fees applied: {users_charged} users charged, {fees_collected} PRC collected. Failed: {len(failed_users)}")
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="monthly_fees_applied",
            entity_type="system",
            details={"fee_amount": fee_amount, "users_charged": users_charged, "total_collected": fees_collected, "failed_count": len(failed_users)}
        )
    
    return {
        "success": True,
        "users_charged": users_charged,
        "total_collected": round(fees_collected, 2),
        "failed_count": len(failed_users)
    }


# ========== ADMIN LOGIN AS USER (IMPERSONATION) ==========

@router.post("/login-as-user")
async def admin_login_as_user(request: Request):
    """
    Admin Impersonation - Login as any user without PIN.
    
    Features:
    - Only super admins can use this
    - Generates temporary session token (1 hour validity)
    - All actions logged as admin impersonation
    - Returns user data + special impersonation token
    
    Usage:
    1. Admin enters target user mobile/UID
    2. System generates impersonation session
    3. Frontend opens new window with user session
    """
    try:
        data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    admin_uid = data.get("admin_uid", "")
    admin_pin = data.get("admin_pin", "")
    target_mobile = data.get("target_mobile", "")
    target_uid = data.get("target_uid", "")
    
    if not admin_uid:
        raise HTTPException(status_code=400, detail="Admin UID required")
    
    if not target_mobile and not target_uid:
        raise HTTPException(status_code=400, detail="Target user mobile or UID required")
    
    # Verify admin
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    # Check admin role
    admin_role = admin.get("role", "")
    if admin_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can use this feature")
    
    # Verify admin PIN (optional but recommended)
    if admin_pin:
        stored_pin = admin.get("pin_hash", admin.get("pin", ""))
        if stored_pin and str(admin_pin) != str(stored_pin):
            raise HTTPException(status_code=401, detail="Invalid admin PIN")
    
    # Find target user
    if target_mobile:
        target_user = await db.users.find_one({"mobile": target_mobile})
    else:
        target_user = await db.users.find_one({"uid": target_uid})
    
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    # Generate impersonation session token
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=1)  # 1 hour validity
    
    impersonation_token = f"IMP_{uuid.uuid4().hex}"
    
    # Create impersonation session record
    session_record = {
        "token": impersonation_token,
        "admin_uid": admin_uid,
        "admin_name": admin.get("name", "Admin"),
        "target_uid": target_user.get("uid"),
        "target_mobile": target_user.get("mobile"),
        "target_name": target_user.get("name"),
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "is_active": True,
        "actions_log": []
    }
    
    await db.admin_impersonation_sessions.insert_one(session_record)
    
    # Update user's session token temporarily
    await db.users.update_one(
        {"uid": target_user.get("uid")},
        {"$set": {
            "session_token": impersonation_token,
            "session_expires_at": expires_at.isoformat(),
            "impersonated_by": admin_uid
        }}
    )
    
    # Log admin action
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_uid,
            action="login_as_user",
            entity_type="user",
            entity_id=target_user.get("uid"),
            details={
                "target_uid": target_user.get("uid"),
                "target_mobile": target_user.get("mobile"),
                "target_name": target_user.get("name"),
                "session_token": impersonation_token[:10] + "...",
                "expires_at": expires_at.isoformat()
            }
        )
    
    # Prepare user data (exclude sensitive fields)
    user_data = {
        "uid": target_user.get("uid"),
        "name": target_user.get("name"),
        "mobile": target_user.get("mobile"),
        "email": target_user.get("email"),
        "prc_balance": target_user.get("prc_balance", 0),
        "subscription_plan": target_user.get("subscription_plan", "explorer"),
        "kyc_status": target_user.get("kyc_status", "not_submitted"),
        "session_token": impersonation_token,
        "is_impersonation": True,
        "impersonated_by_admin": admin.get("name", "Admin")
    }
    
    return {
        "success": True,
        "message": f"Logged in as {target_user.get('name')} ({target_user.get('mobile')})",
        "user": user_data,
        "session_token": impersonation_token,
        "expires_at": expires_at.isoformat(),
        "expires_in_minutes": 60,
        "warning": "⚠️ You are logged in as this user. All actions will be logged.",
        "open_url": f"/dashboard?impersonation_token={impersonation_token}"
    }


@router.get("/impersonation-sessions")
async def get_impersonation_sessions(admin_uid: str = None, active_only: bool = True):
    """Get list of admin impersonation sessions"""
    query = {}
    
    if admin_uid:
        query["admin_uid"] = admin_uid
    
    if active_only:
        query["is_active"] = True
        query["expires_at"] = {"$gt": datetime.now(timezone.utc).isoformat()}
    
    sessions = await db.admin_impersonation_sessions.find(
        query,
        {"_id": 0, "token": 0}  # Don't expose token in list
    ).sort("created_at", -1).to_list(length=50)
    
    return {
        "success": True,
        "sessions": sessions,
        "count": len(sessions)
    }


@router.post("/end-impersonation")
async def end_impersonation_session(request: Request):
    """End an active impersonation session"""
    try:
        data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    token = data.get("token", "")
    admin_uid = data.get("admin_uid", "")
    
    if not token:
        raise HTTPException(status_code=400, detail="Session token required")
    
    # Find session
    session = await db.admin_impersonation_sessions.find_one({"token": token})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update session
    await db.admin_impersonation_sessions.update_one(
        {"token": token},
        {"$set": {
            "is_active": False,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "ended_by": admin_uid
        }}
    )
    
    # Clear user's impersonation token
    target_uid = session.get("target_uid")
    if target_uid:
        await db.users.update_one(
            {"uid": target_uid, "session_token": token},
            {"$unset": {
                "impersonated_by": "",
                "session_token": "",
                "session_expires_at": ""
            }}
        )
    
    return {
        "success": True,
        "message": "Impersonation session ended"
    }


@router.get("/search-user-for-impersonation")
async def search_user_for_impersonation(query: str):
    """Search users by mobile, name, or email for impersonation"""
    if not query or len(query) < 3:
        raise HTTPException(status_code=400, detail="Search query must be at least 3 characters")
    
    # Search by mobile, name, or email
    search_filter = {
        "$or": [
            {"mobile": {"$regex": query, "$options": "i"}},
            {"name": {"$regex": query, "$options": "i"}},
            {"email": {"$regex": query, "$options": "i"}}
        ]
    }
    
    users = await db.users.find(
        search_filter,
        {
            "_id": 0,
            "uid": 1,
            "name": 1,
            "mobile": 1,
            "email": 1,
            "subscription_plan": 1,
            "prc_balance": 1,
            "kyc_status": 1
        }
    ).limit(10).to_list(length=10)
    
    return {
        "success": True,
        "users": users,
        "count": len(users)
    }



# ========== USER COOLDOWN MANAGEMENT ==========

@router.get("/user-cooldown/{phone_or_uid}")
async def check_user_cooldown(phone_or_uid: str):
    """
    Check user's cooldown status and their recent requests.
    This helps admin understand why a user might be blocked.
    """
    # Find user
    user = await db.users.find_one({
        "$or": [
            {"phone": phone_or_uid},
            {"uid": phone_or_uid},
            {"email": phone_or_uid}
        ]
    }, {"_id": 0, "password_hash": 0, "pin_hash": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    uid = user.get("uid")
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    # Get all requests in last 7 days
    redeem_requests = await db.redeem_requests.find({
        "user_id": uid,
        "created_at": {"$gte": seven_days_ago}
    }, {"_id": 0}).sort("created_at", -1).to_list(20)
    
    gift_requests = await db.gift_voucher_requests.find({
        "user_id": uid,
        "created_at": {"$gte": seven_days_ago}
    }, {"_id": 0}).sort("created_at", -1).to_list(10)
    
    bank_requests = await db.bank_transfer_requests.find({
        "user_id": uid,
        "created_at": {"$gte": seven_days_ago}
    }, {"_id": 0}).sort("created_at", -1).to_list(10)
    
    # Check which requests would actually trigger cooldown (only completed/success)
    blocking_bbps = [r for r in redeem_requests if r.get("status", "").lower() in ["completed", "success", "approved"]]
    blocking_gift = [r for r in gift_requests if r.get("status", "").lower() in ["completed", "success", "approved", "delivered"]]
    blocking_bank = [r for r in bank_requests if r.get("status", "").lower() in ["completed", "success", "approved"]]
    
    return {
        "success": True,
        "user": {
            "uid": uid,
            "name": user.get("name"),
            "phone": user.get("phone"),
            "subscription_plan": user.get("subscription_plan"),
            "prc_balance": user.get("prc_balance")
        },
        "cooldown_status": {
            "bbps_blocked": len(blocking_bbps) > 0,
            "gift_blocked": len(blocking_gift) > 0,
            "bank_blocked": len(blocking_bank) > 0,
            "blocking_bbps_requests": blocking_bbps,
            "blocking_gift_requests": blocking_gift,
            "blocking_bank_requests": blocking_bank
        },
        "all_recent_requests": {
            "redeem_requests": redeem_requests,
            "gift_requests": gift_requests,
            "bank_requests": bank_requests
        },
        "note": "Only 'completed/success/approved' status requests trigger cooldown. Failed/pending/processing requests do NOT block users."
    }


@router.post("/clear-user-cooldown/{phone_or_uid}")
async def clear_user_cooldown(phone_or_uid: str, request: Request):
    """
    Clear a user's cooldown by marking their failed/stuck requests appropriately.
    This allows users to retry if their transactions genuinely failed.
    """
    data = await request.json()
    reason = data.get("reason", "Admin cleared cooldown")
    
    # Find user
    user = await db.users.find_one({
        "$or": [
            {"phone": phone_or_uid},
            {"uid": phone_or_uid}
        ]
    }, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    uid = user.get("uid")
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    # Find requests that are blocking (not completed/success but also not already failed)
    # These are typically stuck in pending/processing
    blocking_statuses = ["pending", "processing", "PENDING", "PROCESSING", "initiated", "INITIATED"]
    
    # Update stuck requests to "cancelled_by_admin"
    result = await db.redeem_requests.update_many(
        {
            "user_id": uid,
            "created_at": {"$gte": seven_days_ago},
            "status": {"$in": blocking_statuses}
        },
        {
            "$set": {
                "status": "cancelled_by_admin",
                "admin_note": reason,
                "cancelled_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Log the action
    if log_admin_action:
        await log_admin_action(
            action="clear_cooldown",
            admin_id="system",
            target_user=uid,
            details={"reason": reason, "requests_updated": result.modified_count}
        )
    
    return {
        "success": True,
        "message": f"Cleared cooldown for user {user.get('name')} ({user.get('phone')})",
        "requests_updated": result.modified_count,
        "note": "User can now make new requests"
    }

