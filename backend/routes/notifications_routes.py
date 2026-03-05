"""
User Notifications Routes
In-app notifications for transfers, payments, etc.
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import logging

router = APIRouter(prefix="/notifications", tags=["User Notifications"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ========== HELPER FUNCTIONS ==========

async def create_notification(
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "info",  # info, success, error, warning
    category: str = "general",  # transfer, payment, kyc, system
    reference_id: str = None,
    action_url: str = None
):
    """Create a new notification for user"""
    try:
        notification = {
            "notification_id": f"notif_{int(datetime.now().timestamp())}_{user_id[-6:]}",
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notification_type,
            "category": category,
            "reference_id": reference_id,
            "action_url": action_url,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.notifications.insert_one(notification)
        logging.info(f"[NOTIFICATION] Created for {user_id}: {title}")
        return notification
    except Exception as e:
        logging.error(f"[NOTIFICATION] Create error: {e}")
        return None


# ========== API ENDPOINTS ==========

@router.get("/")
async def get_user_notifications(
    user_id: str,
    page: int = 1,
    limit: int = 20,
    unread_only: bool = False
):
    """Get user's notifications"""
    try:
        skip = (page - 1) * limit
        
        query = {"user_id": user_id}
        if unread_only:
            query["read"] = False
        
        notifications = await db.notifications.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        total = await db.notifications.count_documents(query)
        unread_count = await db.notifications.count_documents({"user_id": user_id, "read": False})
        
        return {
            "success": True,
            "data": {
                "notifications": notifications,
                "total": total,
                "unread_count": unread_count,
                "page": page
            }
        }
    except Exception as e:
        logging.error(f"[NOTIFICATION] Get error: {e}")
        return {"success": False, "message": str(e)}


@router.get("/unread-count")
async def get_unread_count(user_id: str):
    """Get count of unread notifications"""
    try:
        count = await db.notifications.count_documents({
            "user_id": user_id,
            "read": False
        })
        
        return {"success": True, "count": count}
    except Exception as e:
        return {"success": False, "count": 0, "message": str(e)}


@router.patch("/mark-read/{notification_id}")
async def mark_as_read(notification_id: str, user_id: str):
    """Mark single notification as read"""
    try:
        result = await db.notifications.update_one(
            {"notification_id": notification_id, "user_id": user_id},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True, "message": "Marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.patch("/mark-all-read")
async def mark_all_as_read(user_id: str):
    """Mark all notifications as read for user"""
    try:
        result = await db.notifications.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "message": f"Marked {result.modified_count} notifications as read"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.delete("/delete/{notification_id}")
async def delete_notification(notification_id: str, user_id: str):
    """Delete a notification"""
    try:
        result = await db.notifications.delete_one({
            "notification_id": notification_id,
            "user_id": user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True, "message": "Notification deleted"}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.delete("/clear-all")
async def clear_all_notifications(user_id: str):
    """Clear all notifications for user"""
    try:
        result = await db.notifications.delete_many({"user_id": user_id})
        
        return {
            "success": True,
            "message": f"Cleared {result.deleted_count} notifications"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}
