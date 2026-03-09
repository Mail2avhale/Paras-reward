"""
Admin Routes Base Module
========================
Common utilities and dependencies for all admin routes.
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid

# Module-level variables (set by server.py)
db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

# Helper function references
_log_activity = None
_log_transaction = None
_create_notification = None

def set_helpers(helpers: dict):
    global _log_activity, _log_transaction, _create_notification
    _log_activity = helpers.get("log_activity")
    _log_transaction = helpers.get("log_transaction")
    _create_notification = helpers.get("create_notification")


async def log_admin_action(admin_uid: str, action: str, target_uid: str = None, details: dict = None):
    """Log admin action to audit log"""
    if db:
        await db.admin_audit_logs.insert_one({
            "admin_uid": admin_uid,
            "action": action,
            "target_uid": target_uid,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })


async def verify_admin(request: Request) -> dict:
    """Verify request is from admin user"""
    # This would typically verify JWT token and check admin role
    # For now, returns basic admin info
    return {"uid": "admin", "role": "admin"}
