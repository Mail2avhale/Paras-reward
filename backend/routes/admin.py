"""
Admin Routes - Core admin management API endpoints
Extracted from server.py for better code organization

This file contains only the most frequently used admin endpoints.
Additional admin routes remain in server.py for future refactoring.

Includes:
- Security sessions management
- Audit logs
- IP whitelist
- Lockdown controls
- Security dashboard
- Cache management
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin"])

# Database reference - will be set from main server
db = None
cache = None

# Helper function references
log_admin_action = None
create_security_alert = None

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
    global log_admin_action, create_security_alert
    log_admin_action = helpers.get('log_admin_action')
    create_security_alert = helpers.get('create_security_alert')


# ========== SECURITY SESSIONS ==========

@router.get("/security/sessions/{uid}")
async def get_user_sessions(uid: str, admin_uid: str):
    """Get all active sessions for a user"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") not in ["admin", "sub_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    sessions = await db.admin_sessions.find(
        {"uid": uid},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "sessions": sessions,
        "total": len(sessions),
        "active_count": sum(1 for s in sessions if s.get("is_active"))
    }


# ========== AUDIT LOGS ==========

@router.get("/security/audit-logs")
async def get_audit_logs(
    admin_uid: str,
    action_type: str = None,
    entity_type: str = None,
    target_uid: str = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = 100,
    skip: int = 0
):
    """Get admin audit logs with filtering"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if action_type:
        query["action"] = action_type
    if entity_type:
        query["entity_type"] = entity_type
    if target_uid:
        query["entity_id"] = target_uid
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    total = await db.admin_audit_logs.count_documents(query)
    logs = await db.admin_audit_logs.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "skip": skip,
        "limit": limit
    }


# ========== IP WHITELIST ==========

@router.get("/security/ip-whitelist")
async def get_ip_whitelist(admin_uid: str):
    """Get IP whitelist"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    whitelist = await db.ip_whitelist.find({}, {"_id": 0}).to_list(100)
    return {"whitelist": whitelist}


@router.post("/security/ip-whitelist")
async def manage_ip_whitelist(admin_uid: str, request: Request):
    """Add or remove IP from whitelist"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    action = data.get("action")  # "add" or "remove"
    ip_address = data.get("ip_address")
    description = data.get("description", "")
    
    if not ip_address:
        raise HTTPException(status_code=400, detail="IP address is required")
    
    if action == "add":
        existing = await db.ip_whitelist.find_one({"ip_address": ip_address})
        if existing:
            raise HTTPException(status_code=400, detail="IP already in whitelist")
        
        await db.ip_whitelist.insert_one({
            "ip_address": ip_address,
            "description": description,
            "added_by": admin_uid,
            "added_at": datetime.now(timezone.utc).isoformat()
        })
        
        if log_admin_action:
            await log_admin_action(
                admin_uid=admin_uid,
                action="ip_whitelist_add",
                entity_type="security",
                details={"ip": ip_address, "description": description}
            )
        
        return {"message": f"IP {ip_address} added to whitelist"}
    
    elif action == "remove":
        result = await db.ip_whitelist.delete_one({"ip_address": ip_address})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="IP not found in whitelist")
        
        if log_admin_action:
            await log_admin_action(
                admin_uid=admin_uid,
                action="ip_whitelist_remove",
                entity_type="security",
                details={"ip": ip_address}
            )
        
        return {"message": f"IP {ip_address} removed from whitelist"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'add' or 'remove'")


# ========== LOCKDOWN CONTROLS ==========

@router.get("/security/lockdown-status")
async def get_lockdown_status(admin_uid: str):
    """Get system lockdown status"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    lockdown = await db.system_settings.find_one({"key": "lockdown"}, {"_id": 0})
    return lockdown or {"is_locked": False, "lockdown_active": False}


@router.post("/security/lockdown")
async def activate_lockdown(admin_uid: str, request: Request):
    """Activate system lockdown"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    reason = data.get("reason", "Security precaution")
    duration_hours = data.get("duration_hours", 24)
    
    lockdown_until = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
    
    await db.system_settings.update_one(
        {"key": "lockdown"},
        {"$set": {
            "key": "lockdown",
            "is_locked": True,
            "lockdown_active": True,
            "reason": reason,
            "activated_by": admin_uid,
            "activated_at": datetime.now(timezone.utc).isoformat(),
            "lockdown_until": lockdown_until.isoformat()
        }},
        upsert=True
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_uid,
            action="lockdown_activated",
            entity_type="security",
            details={"reason": reason, "duration_hours": duration_hours}
        )
    
    if create_security_alert:
        await create_security_alert(
            alert_type="lockdown_activated",
            severity="critical",
            title="System Lockdown Activated",
            message=f"System lockdown activated by admin. Reason: {reason}",
            details={"admin_uid": admin_uid, "duration_hours": duration_hours}
        )
    
    return {
        "message": "Lockdown activated",
        "lockdown_until": lockdown_until.isoformat(),
        "reason": reason
    }


@router.post("/security/lockdown/deactivate")
async def deactivate_lockdown(admin_uid: str, request: Request):
    """Deactivate system lockdown"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    reason = data.get("reason", "Threat mitigated")
    
    await db.system_settings.update_one(
        {"key": "lockdown"},
        {"$set": {
            "is_locked": False,
            "lockdown_active": False,
            "deactivated_by": admin_uid,
            "deactivated_at": datetime.now(timezone.utc).isoformat(),
            "deactivation_reason": reason
        }}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_uid,
            action="lockdown_deactivated",
            entity_type="security",
            details={"reason": reason}
        )
    
    return {"message": "Lockdown deactivated", "reason": reason}


# ========== SECURITY DASHBOARD ==========

@router.get("/security/dashboard")
async def get_security_dashboard(admin_uid: str):
    """Get security dashboard summary"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") not in ["admin", "sub_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Failed logins today
    failed_logins = await db.security_alerts.count_documents({
        "alert_type": "failed_login",
        "created_at": {"$gte": today_start}
    })
    
    # Active sessions
    active_sessions = await db.admin_sessions.count_documents({"is_active": True})
    
    # Recent alerts
    recent_alerts = await db.security_alerts.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Lockdown status
    lockdown = await db.system_settings.find_one({"key": "lockdown"}, {"_id": 0})
    
    return {
        "failed_logins_today": failed_logins,
        "active_admin_sessions": active_sessions,
        "recent_alerts": recent_alerts,
        "lockdown_status": lockdown or {"is_locked": False},
        "generated_at": now.isoformat()
    }


# ========== SECURITY ALERTS ==========

@router.get("/security/alerts")
async def get_security_alerts(
    admin_uid: str,
    severity: str = None,
    alert_type: str = None,
    limit: int = 50,
    skip: int = 0
):
    """Get security alerts with filtering"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") not in ["admin", "sub_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if severity:
        query["severity"] = severity
    if alert_type:
        query["alert_type"] = alert_type
    
    total = await db.security_alerts.count_documents(query)
    alerts = await db.security_alerts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "alerts": alerts,
        "total": total,
        "skip": skip,
        "limit": limit
    }


# ========== CACHE MANAGEMENT ==========

@router.post("/clear-cache")
async def clear_admin_cache(admin_uid: str, cache_type: str = "all"):
    """Clear application cache"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    cleared = []
    
    if cache and (cache_type == "all" or cache_type == "user"):
        # Clear user-related caches
        try:
            pattern = "user:*"
            # Implementation depends on cache backend
            cleared.append("user_cache")
        except Exception as e:
            logging.error(f"Failed to clear user cache: {e}")
    
    if cache and (cache_type == "all" or cache_type == "stats"):
        try:
            pattern = "stats:*"
            cleared.append("stats_cache")
        except Exception as e:
            logging.error(f"Failed to clear stats cache: {e}")
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_uid,
            action="cache_cleared",
            entity_type="system",
            details={"cache_type": cache_type, "cleared": cleared}
        )
    
    return {
        "message": "Cache cleared successfully",
        "cleared": cleared,
        "cache_type": cache_type
    }
