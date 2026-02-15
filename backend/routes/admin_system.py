"""
Admin System Routes - Database, cache, and system management
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin System"])

# Database and cache references
db = None
cache = None

# Helper function references
log_admin_action = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

def set_helpers(helpers: dict):
    global log_admin_action
    log_admin_action = helpers.get('log_admin_action')


# ========== DATABASE MANAGEMENT ==========

@router.post("/db/create-indexes")
async def create_database_indexes():
    """Create ALL necessary database indexes for optimal performance"""
    try:
        import asyncio
        indexes_created = []
        errors = []
        
        async def safe_create_index(collection, index_spec, **kwargs):
            try:
                await db[collection].create_index(index_spec, background=True, **kwargs)
                return True
            except Exception as e:
                errors.append(f"{collection}: {str(e)}")
                return False
        
        # ========== USERS ==========
        await safe_create_index("users", "uid", unique=True)
        await safe_create_index("users", "email", unique=True)
        await safe_create_index("users", "mobile", sparse=True)
        await safe_create_index("users", "phone", sparse=True)
        await safe_create_index("users", "subscription_plan")
        await safe_create_index("users", "kyc_status")
        await safe_create_index("users", "created_at")
        await safe_create_index("users", "referral_code", unique=True, sparse=True)
        await safe_create_index("users", [("subscription_plan", 1), ("is_active", 1)])
        await safe_create_index("users", [("prc_balance", -1)])
        indexes_created.append("users: 10 indexes")
        
        # ========== TRANSACTIONS ==========
        await safe_create_index("transactions", "user_id")
        await safe_create_index("transactions", "type")
        await safe_create_index("transactions", "status")
        await safe_create_index("transactions", "created_at")
        await safe_create_index("transactions", [("user_id", 1), ("created_at", -1)])
        await safe_create_index("transactions", [("type", 1), ("created_at", -1)])
        indexes_created.append("transactions: 6 indexes")
        
        # ========== VIP PAYMENTS ==========
        await safe_create_index("vip_payments", "user_id")
        await safe_create_index("vip_payments", "status")
        await safe_create_index("vip_payments", "created_at")
        await safe_create_index("vip_payments", "plan")
        await safe_create_index("vip_payments", [("status", 1), ("created_at", -1)])
        await safe_create_index("vip_payments", "approved_at")
        indexes_created.append("vip_payments: 6 indexes")
        
        # ========== ORDERS ==========
        await safe_create_index("orders", "user_id")
        await safe_create_index("orders", "status")
        await safe_create_index("orders", "created_at")
        await safe_create_index("orders", [("status", 1), ("created_at", -1)])
        await safe_create_index("orders", [("user_id", 1), ("created_at", -1)])
        indexes_created.append("orders: 5 indexes")
        
        # ========== BANK WITHDRAWAL REQUESTS ==========
        await safe_create_index("bank_withdrawal_requests", "user_id")
        await safe_create_index("bank_withdrawal_requests", "status")
        await safe_create_index("bank_withdrawal_requests", "created_at")
        await safe_create_index("bank_withdrawal_requests", [("status", 1), ("created_at", -1)])
        indexes_created.append("bank_withdrawal_requests: 4 indexes")
        
        # ========== BILL PAYMENTS ==========
        await safe_create_index("bill_payments", "user_id")
        await safe_create_index("bill_payments", "status")
        await safe_create_index("bill_payments", "created_at")
        await safe_create_index("bill_payments", [("status", 1), ("created_at", -1)])
        indexes_created.append("bill_payments: 4 indexes")
        
        # ========== BILL PAYMENT REQUESTS ==========
        await safe_create_index("bill_payment_requests", "user_id")
        await safe_create_index("bill_payment_requests", "status")
        await safe_create_index("bill_payment_requests", "created_at")
        await safe_create_index("bill_payment_requests", [("status", 1), ("created_at", -1)])
        indexes_created.append("bill_payment_requests: 4 indexes")
        
        # ========== GIFT VOUCHERS ==========
        await safe_create_index("gift_voucher_requests", "user_id")
        await safe_create_index("gift_voucher_requests", "status")
        await safe_create_index("gift_voucher_requests", "created_at")
        await safe_create_index("gift_voucher_requests", [("status", 1), ("created_at", -1)])
        indexes_created.append("gift_voucher_requests: 4 indexes")
        
        # ========== KYC DOCUMENTS ==========
        await safe_create_index("kyc_documents", "user_id")
        await safe_create_index("kyc_documents", "status")
        await safe_create_index("kyc_documents", "created_at")
        await safe_create_index("kyc_documents", [("status", 1), ("created_at", -1)])
        indexes_created.append("kyc_documents: 4 indexes")
        
        # ========== ACTIVITY LOGS ==========
        await safe_create_index("activity_logs", "user_id")
        await safe_create_index("activity_logs", "action_type")
        await safe_create_index("activity_logs", "created_at")
        await safe_create_index("activity_logs", [("user_id", 1), ("created_at", -1)])
        indexes_created.append("activity_logs: 4 indexes")
        
        # ========== NOTIFICATIONS ==========
        await safe_create_index("notifications", "user_id")
        await safe_create_index("notifications", "user_uid")
        await safe_create_index("notifications", "read")
        await safe_create_index("notifications", "created_at")
        await safe_create_index("notifications", [("user_uid", 1), ("read", 1), ("created_at", -1)])
        indexes_created.append("notifications: 5 indexes")
        
        return {
            "success": True, 
            "message": "All indexes created successfully!",
            "indexes_created": indexes_created,
            "errors": errors if errors else None,
            "total_collections": len(indexes_created)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/db/index-status")
async def get_index_status():
    """Get database index status"""
    try:
        indexes = {}
        
        collections = ["users", "transactions", "orders", "vip_payments", "activity_logs"]
        for coll in collections:
            try:
                coll_indexes = await db[coll].index_information()
                indexes[coll] = list(coll_indexes.keys())
            except Exception:
                indexes[coll] = []
        
        return {"indexes": indexes}
    except Exception as e:
        return {"error": str(e)}


@router.get("/database/stats")
async def get_database_stats():
    """Get database statistics"""
    try:
        stats = {
            "users": await db.users.count_documents({}),
            "transactions": await db.transactions.count_documents({}),
            "orders": await db.orders.count_documents({}),
            "vip_payments": await db.vip_payments.count_documents({}),
            "activity_logs": await db.activity_logs.count_documents({})
        }
        
        # Get recent activity
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        stats["today"] = {
            "new_users": await db.users.count_documents({"created_at": {"$gte": today_start}}),
            "transactions": await db.transactions.count_documents({"created_at": {"$gte": today_start}}),
            "orders": await db.orders.count_documents({"created_at": {"$gte": today_start}})
        }
        
        return stats
    except Exception as e:
        return {"error": str(e)}


@router.post("/database/cleanup")
async def cleanup_database(request: Request):
    """Clean up old data from database"""
    data = await request.json()
    admin_id = data.get("admin_id")
    days_to_keep = data.get("days_to_keep", 90)
    
    admin = await db.users.find_one({"uid": admin_id})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days_to_keep)).isoformat()
    
    # Clean up old activity logs
    logs_deleted = await db.activity_logs.delete_many({"timestamp": {"$lt": cutoff_date}})
    
    # Clean up old security alerts
    alerts_deleted = await db.security_alerts.delete_many({"created_at": {"$lt": cutoff_date}})
    
    # Clean up old login history
    login_deleted = await db.login_history.delete_many({"login_time": {"$lt": cutoff_date}})
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="database_cleanup",
            entity_type="system",
            details={
                "logs_deleted": logs_deleted.deleted_count,
                "alerts_deleted": alerts_deleted.deleted_count,
                "login_history_deleted": login_deleted.deleted_count,
                "cutoff_date": cutoff_date
            }
        )
    
    return {
        "success": True,
        "deleted": {
            "activity_logs": logs_deleted.deleted_count,
            "security_alerts": alerts_deleted.deleted_count,
            "login_history": login_deleted.deleted_count
        }
    }


# ========== CACHE MANAGEMENT ==========

@router.get("/system/cache-stats")
async def get_cache_stats():
    """Get cache statistics"""
    if not cache:
        return {"cache_enabled": False}
    
    try:
        # Get cache stats (implementation depends on cache backend)
        return {"cache_enabled": True, "status": "active"}
    except Exception as e:
        return {"cache_enabled": True, "error": str(e)}


@router.post("/system/clear-cache")
async def clear_system_cache(request: Request):
    """Clear system cache"""
    data = await request.json()
    admin_id = data.get("admin_id")
    cache_type = data.get("cache_type", "all")
    
    admin = await db.users.find_one({"uid": admin_id})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    cleared = []
    
    if cache:
        try:
            # Clear specific cache types
            if cache_type in ["all", "dashboard"]:
                cleared.append("dashboard")
            if cache_type in ["all", "user"]:
                cleared.append("user")
            if cache_type in ["all", "stats"]:
                cleared.append("stats")
        except Exception as e:
            logging.error(f"Cache clear error: {e}")
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="cache_cleared",
            entity_type="system",
            details={"cache_type": cache_type, "cleared": cleared}
        )
    
    return {"success": True, "cleared": cleared}


# ========== SYSTEM DIAGNOSTICS ==========

@router.get("/system/index-stats")
async def get_system_index_stats():
    """Get system index statistics"""
    try:
        collections = await db.list_collection_names()
        index_stats = {}
        
        for coll in collections[:20]:  # Limit to first 20 collections
            try:
                indexes = await db[coll].index_information()
                index_stats[coll] = len(indexes)
            except Exception:
                index_stats[coll] = 0
        
        return {"collections": len(collections), "index_stats": index_stats}
    except Exception as e:
        return {"error": str(e)}


@router.get("/system/dashboard-diagnostic")
async def get_dashboard_diagnostic():
    """Get diagnostic information for admin dashboard"""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        diagnostic = {
            "timestamp": now.isoformat(),
            "database": {
                "connected": True,
                "collections": len(await db.list_collection_names())
            },
            "cache": {
                "enabled": cache is not None
            },
            "today_activity": {
                "new_users": await db.users.count_documents({"created_at": {"$gte": today_start}}),
                "transactions": await db.transactions.count_documents({"created_at": {"$gte": today_start}}),
                "pending_payments": await db.vip_payments.count_documents({"status": "pending"})
            }
        }
        
        return diagnostic
    except Exception as e:
        return {"error": str(e), "timestamp": datetime.now(timezone.utc).isoformat()}


@router.post("/system/refresh-dashboard")
async def refresh_dashboard_data(request: Request):
    """Force refresh dashboard data"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    admin = await db.users.find_one({"uid": admin_id})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if cache:
        try:
            # Clear dashboard-related caches
            await cache.delete("admin_dashboard")
            await cache.delete("admin_stats")
        except Exception:
            pass
    
    return {"success": True, "message": "Dashboard data refreshed"}


# ========== USER LOCKOUT MANAGEMENT ==========

@router.get("/clear-all-lockouts-now")
async def quick_clear_lockouts():
    """Quick endpoint to clear all login lockouts"""
    result = await db.login_attempts.delete_many({})
    return {"cleared": result.deleted_count}


@router.post("/clear-all-lockouts")
async def clear_all_lockouts(request: Request):
    """Clear all login lockouts with admin verification"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    if admin_id:
        admin = await db.users.find_one({"uid": admin_id})
        if not admin or admin.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.login_attempts.delete_many({})
    
    if log_admin_action and admin_id:
        await log_admin_action(
            admin_uid=admin_id,
            action="lockouts_cleared",
            entity_type="security",
            details={"cleared_count": result.deleted_count}
        )
    
    return {"success": True, "cleared": result.deleted_count}


@router.get("/force-fix/{identifier}")
async def force_fix_user_lockout(identifier: str):
    """Force fix user lockout by identifier"""
    result = await db.login_attempts.delete_many({
        "$or": [
            {"identifier": identifier},
            {"identifier": identifier.lower()}
        ]
    })
    return {"success": True, "cleared": result.deleted_count, "identifier": identifier}


@router.post("/force-fix-user/{identifier}")
async def force_fix_user_account(identifier: str, request: Request):
    """Force fix user account issues"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    # Clear login attempts
    await db.login_attempts.delete_many({
        "$or": [
            {"identifier": identifier},
            {"identifier": identifier.lower()}
        ]
    })
    
    # Find user
    user = await db.users.find_one({
        "$or": [
            {"email": {"$regex": f"^{identifier}$", "$options": "i"}},
            {"mobile": identifier},
            {"uid": identifier}
        ]
    })
    
    if not user:
        return {"success": False, "error": "User not found"}
    
    # Reset any lockout flags
    await db.users.update_one(
        {"uid": user["uid"]},
        {"$unset": {"login_locked_until": "", "failed_login_count": ""}}
    )
    
    return {"success": True, "user_uid": user["uid"], "email": user.get("email")}


@router.get("/diagnose-user/{identifier}")
async def diagnose_user_account(identifier: str):
    """Diagnose user account issues"""
    user = await db.users.find_one({
        "$or": [
            {"email": {"$regex": f"^{identifier}$", "$options": "i"}},
            {"mobile": identifier},
            {"uid": identifier}
        ]
    }, {"_id": 0, "password_hash": 0})
    
    if not user:
        return {"found": False, "identifier": identifier}
    
    # Check login attempts
    login_attempts = await db.login_attempts.find(
        {"identifier": {"$in": [identifier, identifier.lower(), user.get("email", "").lower()]}}
    ).to_list(10)
    
    for attempt in login_attempts:
        attempt.pop("_id", None)
    
    return {
        "found": True,
        "user": {
            "uid": user.get("uid"),
            "email": user.get("email"),
            "mobile": user.get("mobile"),
            "is_active": user.get("is_active"),
            "is_banned": user.get("is_banned"),
            "pin_migrated": user.get("pin_migrated"),
            "created_at": user.get("created_at")
        },
        "login_attempts": login_attempts
    }


@router.get("/migrate-to-pin/{identifier}")
async def migrate_user_to_pin_quick(identifier: str):
    """Quick endpoint to migrate user to PIN system"""
    user = await db.users.find_one({
        "$or": [
            {"email": {"$regex": f"^{identifier}$", "$options": "i"}},
            {"mobile": identifier},
            {"uid": identifier}
        ]
    })
    
    if not user:
        return {"success": False, "error": "User not found"}
    
    await db.users.update_one(
        {"uid": user["uid"]},
        {"$set": {"pin_migrated": True}}
    )
    
    return {"success": True, "user_uid": user["uid"]}


@router.post("/migrate-user-to-pin/{identifier}")
async def migrate_user_to_pin(identifier: str, request: Request):
    """Migrate user to PIN authentication system"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    user = await db.users.find_one({
        "$or": [
            {"email": {"$regex": f"^{identifier}$", "$options": "i"}},
            {"mobile": identifier},
            {"uid": identifier}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"uid": user["uid"]},
        {"$set": {
            "pin_migrated": True,
            "pin_migrated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if log_admin_action and admin_id:
        await log_admin_action(
            admin_uid=admin_id,
            action="user_pin_migrated",
            entity_type="user",
            entity_id=user["uid"]
        )
    
    return {"success": True, "user_uid": user["uid"], "email": user.get("email")}
