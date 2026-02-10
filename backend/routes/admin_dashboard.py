"""
Admin Dashboard Routes - Stats, charts, and dashboard data
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])

# Database and cache references
db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager


# ========== DEBUG & STATS ==========

@router.get("/debug/stats-live")
async def get_live_stats():
    """Get live statistics for debugging"""
    try:
        total_users = await db.users.count_documents({})
        vip_users = await db.users.count_documents({"membership_type": "vip"})
        pending_payments = await db.vip_payments.count_documents({"status": "pending"})
        pending_orders = await db.orders.count_documents({"status": "pending"})
        
        return {
            "total_users": total_users,
            "vip_users": vip_users,
            "pending_payments": pending_payments,
            "pending_orders": pending_orders,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/stats")
async def get_admin_stats():
    """Get comprehensive admin statistics"""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        week_start = (now - timedelta(days=7)).isoformat()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        # User stats
        total_users = await db.users.count_documents({})
        new_today = await db.users.count_documents({"created_at": {"$gte": today_start}})
        new_week = await db.users.count_documents({"created_at": {"$gte": week_start}})
        new_month = await db.users.count_documents({"created_at": {"$gte": month_start}})
        vip_users = await db.users.count_documents({"membership_type": "vip"})
        
        # Revenue stats
        month_revenue = await db.vip_payments.aggregate([
            {"$match": {"status": "approved", "approved_at": {"$gte": month_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        # Order stats
        total_orders = await db.orders.count_documents({})
        pending_orders = await db.orders.count_documents({"status": "pending"})
        
        # PRC stats
        total_prc = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        
        return {
            "users": {
                "total": total_users,
                "new_today": new_today,
                "new_week": new_week,
                "new_month": new_month,
                "vip": vip_users
            },
            "revenue": {
                "month": round(month_revenue[0]["total"], 2) if month_revenue else 0
            },
            "orders": {
                "total": total_orders,
                "pending": pending_orders
            },
            "prc": {
                "total_circulation": round(total_prc[0]["total"], 4) if total_prc else 0
            },
            "generated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"Admin stats error: {e}")
        return {"error": str(e)}


@router.get("/dashboard-all")
async def get_dashboard_all():
    """Get all dashboard data in one call"""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        # Counts
        total_users = await db.users.count_documents({})
        vip_users = await db.users.count_documents({"membership_type": "vip"})
        pending_payments = await db.vip_payments.count_documents({"status": "pending"})
        pending_orders = await db.orders.count_documents({"status": "pending"})
        
        # Today's new users
        new_today = await db.users.count_documents({"created_at": {"$gte": today_start}})
        
        # Recent activity
        recent_payments = await db.vip_payments.find(
            {"status": "pending"},
            {"_id": 0, "payment_id": 1, "user_id": 1, "amount": 1, "submitted_at": 1}
        ).sort("submitted_at", -1).limit(5).to_list(5)
        
        recent_orders = await db.orders.find(
            {"status": "pending"},
            {"_id": 0, "order_id": 1, "user_id": 1, "total_prc": 1, "created_at": 1}
        ).sort("created_at", -1).limit(5).to_list(5)
        
        return {
            "counts": {
                "total_users": total_users,
                "vip_users": vip_users,
                "pending_payments": pending_payments,
                "pending_orders": pending_orders,
                "new_users_today": new_today
            },
            "recent_payments": recent_payments,
            "recent_orders": recent_orders,
            "generated_at": now.isoformat()
        }
    except Exception as e:
        return {"error": str(e)}


# ========== ADDITIONAL CHARTS ==========

@router.get("/charts/user-growth")
async def get_user_growth_chart(days: int = 30):
    """Get user growth chart data"""
    try:
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)
        
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date.isoformat()}}},
            {"$addFields": {"date": {"$substr": ["$created_at", 0, 10]}}},
            {"$group": {"_id": "$date", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        
        data = await db.users.aggregate(pipeline).to_list(days + 1)
        
        return {
            "labels": [d["_id"] for d in data],
            "values": [d["count"] for d in data],
            "days": days
        }
    except Exception as e:
        return {"labels": [], "values": [], "error": str(e)}


@router.get("/charts/prc-circulation")
async def get_prc_circulation_chart(days: int = 30):
    """Get PRC circulation chart data"""
    try:
        # Get daily transaction totals
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)
        
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date.isoformat()}}},
            {"$addFields": {"date": {"$substr": ["$created_at", 0, 10]}}},
            {"$group": {
                "_id": "$date",
                "mined": {"$sum": {"$cond": [{"$eq": ["$type", "mining"]}, "$amount", 0]}},
                "spent": {"$sum": {"$cond": [{"$in": ["$type", ["order", "bill_payment"]]}, {"$abs": "$amount"}, 0]}}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        data = await db.transactions.aggregate(pipeline).to_list(days + 1)
        
        return {
            "labels": [d["_id"] for d in data],
            "mined": [round(d["mined"], 2) for d in data],
            "spent": [round(d["spent"], 2) for d in data],
            "days": days
        }
    except Exception as e:
        return {"labels": [], "mined": [], "spent": [], "error": str(e)}


@router.get("/charts/orders")
async def get_orders_chart(days: int = 30):
    """Get orders chart data"""
    try:
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)
        
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date.isoformat()}}},
            {"$addFields": {"date": {"$substr": ["$created_at", 0, 10]}}},
            {"$group": {
                "_id": "$date",
                "count": {"$sum": 1},
                "total_prc": {"$sum": "$total_prc"}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        data = await db.orders.aggregate(pipeline).to_list(days + 1)
        
        return {
            "labels": [d["_id"] for d in data],
            "counts": [d["count"] for d in data],
            "totals": [round(d.get("total_prc", 0), 2) for d in data],
            "days": days
        }
    except Exception as e:
        return {"labels": [], "counts": [], "totals": [], "error": str(e)}
