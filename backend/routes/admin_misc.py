"""
Admin Misc Routes - Miscellaneous admin operations
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

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
        "membership_type": "vip",
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
        except:
            pass
    
    new_expiry = (start_date + timedelta(days=duration_days)).isoformat()
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "membership_type": "vip",
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
            "expiry": user.get("subscription_expiry"),
            "membership_type": user.get("membership_type")
        },
        "payment_history": payments
    }


# ========== RENEWAL NOTIFICATIONS ==========

@router.post("/run-explorer-burn")
async def run_explorer_burn(request: Request):
    """Run explorer PRC burn (set free users PRC to 0)"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    result = await db.users.update_many(
        {"membership_type": {"$ne": "vip"}, "prc_balance": {"$gt": 0}},
        {"$set": {"prc_balance": 0}}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="explorer_burn",
            entity_type="system",
            details={"users_affected": result.modified_count}
        )
    
    return {"success": True, "users_affected": result.modified_count}


@router.post("/send-renewal-notifications")
async def send_renewal_notifications(request: Request):
    """Send renewal notifications to expiring VIP users"""
    data = await request.json()
    admin_id = data.get("admin_id")
    days_before = int(data.get("days_before", 7))
    
    now = datetime.now(timezone.utc)
    expiry_threshold = (now + timedelta(days=days_before)).isoformat()
    
    # Find users with expiring subscriptions
    expiring_users = await db.users.find({
        "membership_type": "vip",
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
            "message": f"Your VIP subscription will expire soon. Renew now to continue enjoying benefits!",
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
    """Apply monthly maintenance fees"""
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
    
    now = datetime.now(timezone.utc)
    fees_collected = 0
    users_charged = 0
    
    for user in users:
        await db.users.update_one(
            {"uid": user["uid"]},
            {"$inc": {"prc_balance": -fee_amount}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": f"MF{now.strftime('%Y%m%d%H%M%S')}{users_charged}",
            "user_id": user["uid"],
            "type": "monthly_fee",
            "amount": -fee_amount,
            "description": "Monthly maintenance fee",
            "created_at": now.isoformat()
        })
        
        fees_collected += fee_amount
        users_charged += 1
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="monthly_fees_applied",
            entity_type="system",
            details={"fee_amount": fee_amount, "users_charged": users_charged, "total_collected": fees_collected}
        )
    
    return {
        "success": True,
        "users_charged": users_charged,
        "total_collected": round(fees_collected, 2)
    }
