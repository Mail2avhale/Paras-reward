"""
In-App Notifications System
Created: February 2026

Handles all user notifications:
- Payment status changes (approved/rejected)
- New referral joined
- Subscription expiry reminders
- PRC credited notifications
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging

router = APIRouter(prefix="/notifications", tags=["Notifications"])

db = None

def set_db(database):
    global db
    db = database


# Notification Types
NOTIFICATION_TYPES = {
    "payment_approved": {
        "title": "Payment Approved",
        "icon": "check-circle",
        "color": "green"
    },
    "payment_rejected": {
        "title": "Payment Rejected",
        "icon": "x-circle",
        "color": "red"
    },
    "referral_joined": {
        "title": "New Referral",
        "icon": "user-plus",
        "color": "blue"
    },
    "subscription_expiry": {
        "title": "Subscription Expiring",
        "icon": "alert-triangle",
        "color": "yellow"
    },
    "prc_credited": {
        "title": "PRC Credited",
        "icon": "coins",
        "color": "purple"
    },
    "prc_debited": {
        "title": "PRC Debited",
        "icon": "minus-circle",
        "color": "orange"
    },
    "kyc_approved": {
        "title": "KYC Approved",
        "icon": "shield-check",
        "color": "green"
    },
    "kyc_rejected": {
        "title": "KYC Rejected",
        "icon": "shield-x",
        "color": "red"
    },
    "general": {
        "title": "Notification",
        "icon": "bell",
        "color": "gray"
    }
}


async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    data: dict = None
):
    """
    Create a new notification for a user
    
    Args:
        user_id: User's UID
        notification_type: Type of notification (payment_approved, referral_joined, etc.)
        title: Notification title
        message: Notification message
        data: Additional data (amount, request_id, etc.)
    """
    try:
        type_info = NOTIFICATION_TYPES.get(notification_type, NOTIFICATION_TYPES["general"])
        
        notification = {
            "user_id": user_id,
            "type": notification_type,
            "title": title or type_info["title"],
            "message": message,
            "icon": type_info["icon"],
            "color": type_info["color"],
            "data": data or {},
            "read": False,
            "created_at": datetime.now(timezone.utc)
        }
        
        result = await db.notifications.insert_one(notification)
        logging.info(f"[NOTIFICATION] Created for user {user_id}: {notification_type} - {title}")
        
        return str(result.inserted_id)
    except Exception as e:
        logging.error(f"Error creating notification: {e}")
        return None


@router.get("/user/{user_id}")
async def get_user_notifications(
    user_id: str,
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False)
):
    """Get notifications for a user"""
    try:
        query = {"user_id": user_id}
        if unread_only:
            query["read"] = False
        
        notifications = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
        
        # Get unread count
        unread_count = await db.notifications.count_documents({"user_id": user_id, "read": False})
        
        # Convert ObjectId to string
        for n in notifications:
            n["_id"] = str(n["_id"])
            if n.get("created_at"):
                n["created_at"] = n["created_at"].isoformat()
        
        return {
            "notifications": notifications,
            "unread_count": unread_count,
            "total": len(notifications)
        }
    except Exception as e:
        logging.error(f"Error fetching notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/unread-count")
async def get_unread_count(user_id: str):
    """Get unread notification count for a user"""
    try:
        count = await db.notifications.count_documents({"user_id": user_id, "read": False})
        return {"unread_count": count}
    except Exception as e:
        logging.error(f"Error getting unread count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark-read/{notification_id}")
async def mark_notification_read(notification_id: str):
    """Mark a single notification as read"""
    try:
        from bson import ObjectId
        result = await db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True}
    except Exception as e:
        logging.error(f"Error marking notification read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark-all-read/{user_id}")
async def mark_all_notifications_read(user_id: str):
    """Mark all notifications as read for a user"""
    try:
        result = await db.notifications.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        
        return {"success": True, "marked_count": result.modified_count}
    except Exception as e:
        logging.error(f"Error marking all notifications read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear/{user_id}")
async def clear_old_notifications(user_id: str, days: int = Query(30, ge=1, le=90)):
    """Clear notifications older than specified days"""
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        result = await db.notifications.delete_many({
            "user_id": user_id,
            "created_at": {"$lt": cutoff}
        })
        
        return {"success": True, "deleted_count": result.deleted_count}
    except Exception as e:
        logging.error(f"Error clearing notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Helper function to send notifications for common events
async def notify_payment_status(user_id: str, status: str, amount_inr: float, payment_type: str, reason: str = None):
    """Send notification for payment status change"""
    if status == "approved":
        await create_notification(
            user_id=user_id,
            notification_type="payment_approved",
            title="Payment Approved ✓",
            message=f"Your {payment_type} request of ₹{amount_inr:,.0f} has been approved and processed.",
            data={"amount_inr": amount_inr, "payment_type": payment_type}
        )
    elif status == "rejected":
        await create_notification(
            user_id=user_id,
            notification_type="payment_rejected",
            title="Payment Rejected",
            message=f"Your {payment_type} request of ₹{amount_inr:,.0f} was rejected. Reason: {reason or 'Not specified'}. PRC has been refunded.",
            data={"amount_inr": amount_inr, "payment_type": payment_type, "reason": reason}
        )


async def notify_referral_joined(user_id: str, referral_name: str, referral_email: str):
    """Send notification when a new referral joins"""
    await create_notification(
        user_id=user_id,
        notification_type="referral_joined",
        title="New Team Member!",
        message=f"{referral_name} joined using your referral code. Earn more rewards!",
        data={"referral_name": referral_name, "referral_email": referral_email}
    )


async def notify_prc_credited(user_id: str, amount: float, reason: str):
    """Send notification when PRC is credited"""
    await create_notification(
        user_id=user_id,
        notification_type="prc_credited",
        title=f"+{amount:,.0f} PRC Credited",
        message=f"You received {amount:,.0f} PRC. Reason: {reason}",
        data={"amount": amount, "reason": reason}
    )


async def notify_subscription_expiry(user_id: str, plan_name: str, days_left: int):
    """Send notification for subscription expiry reminder"""
    await create_notification(
        user_id=user_id,
        notification_type="subscription_expiry",
        title="Subscription Expiring Soon",
        message=f"Your {plan_name} subscription expires in {days_left} days. Renew to continue earning rewards!",
        data={"plan_name": plan_name, "days_left": days_left}
    )
