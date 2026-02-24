"""
Comprehensive User Logging System
- PRC Balance Change Logs
- User Activity Logs  
- Admin Action Logs
- Burn Operation Logs

Created: February 2026
Purpose: Debug issues like paid users losing PRC balance
"""

from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
import uuid
import logging

router = APIRouter(prefix="/admin/logs", tags=["User Logs"])

db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager


# ==================== PRC BALANCE CHANGE LOG ====================

async def log_prc_balance_change(
    user_id: str,
    user_email: str,
    action: str,
    amount: float,
    balance_before: float,
    balance_after: float,
    reason: str,
    source_function: str,
    metadata: Dict = None
):
    """
    Log every PRC balance change with full details.
    This is the PRIMARY debugging tool for balance issues.
    
    Args:
        user_id: User's UID
        user_email: User's email for easy identification
        action: credit/debit/burn/adjustment
        amount: Amount changed (positive)
        balance_before: Balance before change
        balance_after: Balance after change
        reason: Human-readable reason
        source_function: Which function/API made this change
        metadata: Additional context
    """
    log_entry = {
        "log_id": f"PRC-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6].upper()}",
        "user_id": user_id,
        "user_email": user_email,
        "action": action,
        "amount": round(amount, 4),
        "balance_before": round(balance_before, 4),
        "balance_after": round(balance_after, 4),
        "change": round(balance_after - balance_before, 4),
        "reason": reason,
        "source_function": source_function,
        "metadata": metadata or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime('%Y-%m-%d')
    }
    
    try:
        await db.prc_balance_logs.insert_one(log_entry)
        logging.info(f"[PRC LOG] {user_email}: {action} {amount} PRC | {balance_before} -> {balance_after} | {reason}")
    except Exception as e:
        logging.error(f"[PRC LOG ERROR] Failed to log: {e}")
    
    return log_entry


# ==================== BURN OPERATION LOG ====================

async def log_burn_operation(
    operation_type: str,
    total_users_checked: int,
    users_burned: int,
    users_skipped: int,
    total_prc_burned: float,
    skipped_users_details: List[Dict],
    burned_users_details: List[Dict],
    settings_used: Dict = None
):
    """
    Log every burn operation with complete details.
    Essential for debugging why a user was or wasn't burned.
    
    Args:
        operation_type: explorer_burn/free_burn/expired_sub_burn/auto_burn
        total_users_checked: How many users were evaluated
        users_burned: How many actually burned
        users_skipped: How many skipped (protected)
        total_prc_burned: Total PRC burned
        skipped_users_details: List of skipped users with reasons
        burned_users_details: List of burned users
        settings_used: Burn settings that were active
    """
    log_entry = {
        "operation_id": f"BURN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6].upper()}",
        "operation_type": operation_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        "summary": {
            "total_users_checked": total_users_checked,
            "users_burned": users_burned,
            "users_skipped": users_skipped,
            "total_prc_burned": round(total_prc_burned, 4),
            "protection_rate": f"{(users_skipped / total_users_checked * 100) if total_users_checked > 0 else 0:.1f}%"
        },
        "settings_used": settings_used or {},
        "skipped_users": skipped_users_details[:100],  # Limit to 100 for storage
        "burned_users": burned_users_details[:100],
        "skipped_count_full": len(skipped_users_details),
        "burned_count_full": len(burned_users_details)
    }
    
    try:
        await db.burn_operation_logs.insert_one(log_entry)
        logging.info(f"[BURN LOG] {operation_type}: checked={total_users_checked}, burned={users_burned}, skipped={users_skipped}, total_prc={total_prc_burned:.2f}")
    except Exception as e:
        logging.error(f"[BURN LOG ERROR] Failed to log: {e}")
    
    return log_entry


# ==================== USER ACTIVITY LOG ====================

async def log_user_activity(
    user_id: str,
    user_email: str,
    activity_type: str,
    description: str,
    ip_address: str = None,
    device_info: str = None,
    metadata: Dict = None
):
    """
    Log user activities like login, mining, orders, etc.
    
    Args:
        user_id: User's UID
        user_email: User's email
        activity_type: login/logout/mining_start/mining_end/order/withdrawal/profile_update/etc
        description: Human-readable description
        ip_address: User's IP
        device_info: Device/browser info
        metadata: Additional context
    """
    log_entry = {
        "log_id": f"ACT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6].upper()}",
        "user_id": user_id,
        "user_email": user_email,
        "activity_type": activity_type,
        "description": description,
        "ip_address": ip_address,
        "device_info": device_info,
        "metadata": metadata or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime('%Y-%m-%d')
    }
    
    try:
        await db.user_activity_logs.insert_one(log_entry)
    except Exception as e:
        logging.error(f"[ACTIVITY LOG ERROR] Failed to log: {e}")
    
    return log_entry


# ==================== ADMIN ACTION LOG ====================

async def log_admin_action(
    admin_id: str,
    admin_email: str,
    action_type: str,
    target_type: str,
    target_id: str,
    description: str,
    before_state: Dict = None,
    after_state: Dict = None,
    ip_address: str = None,
    metadata: Dict = None
):
    """
    Log all admin actions for audit trail.
    
    Args:
        admin_id: Admin's UID
        admin_email: Admin's email
        action_type: approve/reject/adjust/ban/unban/update_settings/etc
        target_type: user/subscription/withdrawal/order/settings/etc
        target_id: ID of affected entity
        description: Human-readable description
        before_state: State before change
        after_state: State after change
        ip_address: Admin's IP
        metadata: Additional context
    """
    log_entry = {
        "log_id": f"ADM-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6].upper()}",
        "admin_id": admin_id,
        "admin_email": admin_email,
        "action_type": action_type,
        "target_type": target_type,
        "target_id": target_id,
        "description": description,
        "before_state": before_state,
        "after_state": after_state,
        "ip_address": ip_address,
        "metadata": metadata or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime('%Y-%m-%d')
    }
    
    try:
        await db.admin_action_logs.insert_one(log_entry)
        logging.info(f"[ADMIN LOG] {admin_email}: {action_type} on {target_type}/{target_id}")
    except Exception as e:
        logging.error(f"[ADMIN LOG ERROR] Failed to log: {e}")
    
    return log_entry


# ==================== API ENDPOINTS ====================

@router.get("/prc-balance")
async def get_prc_balance_logs(
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    action: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """
    Get PRC balance change logs with filtering.
    Essential for debugging balance issues.
    """
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    if user_email:
        query["user_email"] = {"$regex": user_email, "$options": "i"}
    if action:
        query["action"] = action
    if date_from:
        query["date"] = {"$gte": date_from}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = date_to
        else:
            query["date"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    
    total = await db.prc_balance_logs.count_documents(query)
    logs = await db.prc_balance_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/prc-balance/user/{user_identifier}")
async def get_user_prc_history(user_identifier: str, limit: int = 100):
    """
    Get complete PRC history for a specific user.
    Use email or UID to search.
    """
    # Search by email or UID
    query = {
        "$or": [
            {"user_id": user_identifier},
            {"user_email": {"$regex": f"^{user_identifier}$", "$options": "i"}}
        ]
    }
    
    logs = await db.prc_balance_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Calculate summary
    total_credits = sum(l.get("amount", 0) for l in logs if l.get("action") == "credit")
    total_debits = sum(l.get("amount", 0) for l in logs if l.get("action") == "debit")
    total_burns = sum(l.get("amount", 0) for l in logs if l.get("action") == "burn")
    
    return {
        "user_identifier": user_identifier,
        "logs": logs,
        "summary": {
            "total_entries": len(logs),
            "total_credits": round(total_credits, 2),
            "total_debits": round(total_debits, 2),
            "total_burns": round(total_burns, 2),
            "net_change": round(total_credits - total_debits - total_burns, 2)
        }
    }


@router.get("/burn-operations")
async def get_burn_operation_logs(
    operation_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """
    Get burn operation logs.
    Shows what happened in each burn job.
    """
    query = {}
    
    if operation_type:
        query["operation_type"] = operation_type
    if date_from:
        query["date"] = {"$gte": date_from}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = date_to
        else:
            query["date"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    
    total = await db.burn_operation_logs.count_documents(query)
    logs = await db.burn_operation_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/burn-operations/check-user/{user_identifier}")
async def check_user_in_burn_logs(user_identifier: str):
    """
    Check if a specific user was ever burned or skipped in burn operations.
    Essential for debugging issues like nisha@gmail.com.
    """
    # Search in skipped_users and burned_users arrays
    burned_logs = await db.burn_operation_logs.find({
        "$or": [
            {"burned_users.user_id": user_identifier},
            {"burned_users.user_email": {"$regex": user_identifier, "$options": "i"}},
            {"skipped_users.user_id": user_identifier},
            {"skipped_users.user_email": {"$regex": user_identifier, "$options": "i"}}
        ]
    }, {"_id": 0}).sort("timestamp", -1).limit(50).to_list(50)
    
    burned_instances = []
    skipped_instances = []
    
    for log in burned_logs:
        for bu in log.get("burned_users", []):
            if user_identifier.lower() in (bu.get("user_id", "") + bu.get("user_email", "")).lower():
                burned_instances.append({
                    "operation_id": log.get("operation_id"),
                    "operation_type": log.get("operation_type"),
                    "timestamp": log.get("timestamp"),
                    "amount_burned": bu.get("amount_burned"),
                    "reason": bu.get("reason")
                })
        
        for su in log.get("skipped_users", []):
            if user_identifier.lower() in (su.get("user_id", "") + su.get("user_email", "")).lower():
                skipped_instances.append({
                    "operation_id": log.get("operation_id"),
                    "operation_type": log.get("operation_type"),
                    "timestamp": log.get("timestamp"),
                    "skip_reason": su.get("reason")
                })
    
    return {
        "user_identifier": user_identifier,
        "was_ever_burned": len(burned_instances) > 0,
        "was_ever_skipped": len(skipped_instances) > 0,
        "burn_count": len(burned_instances),
        "skip_count": len(skipped_instances),
        "burned_instances": burned_instances,
        "skipped_instances": skipped_instances
    }


@router.get("/user-activity")
async def get_user_activity_logs(
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    activity_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """Get user activity logs with filtering."""
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    if user_email:
        query["user_email"] = {"$regex": user_email, "$options": "i"}
    if activity_type:
        query["activity_type"] = activity_type
    if date_from:
        query["date"] = {"$gte": date_from}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = date_to
        else:
            query["date"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    
    total = await db.user_activity_logs.count_documents(query)
    logs = await db.user_activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/admin-actions")
async def get_admin_action_logs(
    admin_id: Optional[str] = None,
    admin_email: Optional[str] = None,
    action_type: Optional[str] = None,
    target_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """Get admin action logs with filtering."""
    query = {}
    
    if admin_id:
        query["admin_id"] = admin_id
    if admin_email:
        query["admin_email"] = {"$regex": admin_email, "$options": "i"}
    if action_type:
        query["action_type"] = action_type
    if target_type:
        query["target_type"] = target_type
    if date_from:
        query["date"] = {"$gte": date_from}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = date_to
        else:
            query["date"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    
    total = await db.admin_action_logs.count_documents(query)
    logs = await db.admin_action_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/dashboard")
async def get_logs_dashboard():
    """
    Get overview of all logs for admin dashboard.
    Shows recent activity across all log types.
    """
    now = datetime.now(timezone.utc)
    today = now.strftime('%Y-%m-%d')
    week_ago = (now - timedelta(days=7)).strftime('%Y-%m-%d')
    
    # Count logs
    prc_logs_today = await db.prc_balance_logs.count_documents({"date": today})
    prc_logs_week = await db.prc_balance_logs.count_documents({"date": {"$gte": week_ago}})
    
    activity_logs_today = await db.user_activity_logs.count_documents({"date": today})
    activity_logs_week = await db.user_activity_logs.count_documents({"date": {"$gte": week_ago}})
    
    admin_logs_today = await db.admin_action_logs.count_documents({"date": today})
    admin_logs_week = await db.admin_action_logs.count_documents({"date": {"$gte": week_ago}})
    
    burn_logs_week = await db.burn_operation_logs.count_documents({"date": {"$gte": week_ago}})
    
    # Recent critical events (burns, large balance changes)
    recent_burns = await db.prc_balance_logs.find(
        {"action": "burn", "date": {"$gte": week_ago}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    # Large balance changes (> 100 PRC)
    large_changes = await db.prc_balance_logs.find(
        {"amount": {"$gte": 100}, "date": {"$gte": week_ago}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    return {
        "summary": {
            "prc_balance_logs": {"today": prc_logs_today, "week": prc_logs_week},
            "user_activity_logs": {"today": activity_logs_today, "week": activity_logs_week},
            "admin_action_logs": {"today": admin_logs_today, "week": admin_logs_week},
            "burn_operation_logs": {"week": burn_logs_week}
        },
        "recent_burns": recent_burns,
        "large_balance_changes": large_changes,
        "generated_at": now.isoformat()
    }


@router.post("/create-indexes")
async def create_log_indexes():
    """Create indexes for efficient log querying."""
    try:
        # PRC Balance Logs indexes
        await db.prc_balance_logs.create_index([("user_id", 1), ("timestamp", -1)])
        await db.prc_balance_logs.create_index([("user_email", 1)])
        await db.prc_balance_logs.create_index([("date", -1)])
        await db.prc_balance_logs.create_index([("action", 1), ("date", -1)])
        
        # Burn Operation Logs indexes
        await db.burn_operation_logs.create_index([("timestamp", -1)])
        await db.burn_operation_logs.create_index([("operation_type", 1), ("date", -1)])
        
        # User Activity Logs indexes
        await db.user_activity_logs.create_index([("user_id", 1), ("timestamp", -1)])
        await db.user_activity_logs.create_index([("activity_type", 1), ("date", -1)])
        
        # Admin Action Logs indexes
        await db.admin_action_logs.create_index([("admin_id", 1), ("timestamp", -1)])
        await db.admin_action_logs.create_index([("action_type", 1), ("date", -1)])
        await db.admin_action_logs.create_index([("target_type", 1), ("target_id", 1)])
        
        return {"success": True, "message": "All log indexes created successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}
