"""
Admin Reports Routes - Analytics, charts, and reporting
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Reports"])

# Database and cache references
db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager


# ========== CHARTS & ANALYTICS ==========

@router.get("/charts/users")
async def get_user_growth_chart(period: str = "month", days: int = 30):
    """Get user growth chart data"""
    try:
        now = datetime.now(timezone.utc)
        
        if period == "week":
            days = 7
        elif period == "month":
            days = 30
        elif period == "year":
            days = 365
        
        start_date = now - timedelta(days=days)
        
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date.isoformat()}}},
            {"$addFields": {
                "date": {"$substr": ["$created_at", 0, 10]}
            }},
            {"$group": {
                "_id": "$date",
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        data = await db.users.aggregate(pipeline).to_list(days + 1)
        
        return {
            "labels": [d["_id"] for d in data],
            "values": [d["count"] for d in data],
            "period": period,
            "days": days
        }
    except Exception as e:
        logging.error(f"User chart error: {e}")
        return {"labels": [], "values": [], "error": str(e)}


@router.get("/charts/transactions")
async def get_transaction_chart(period: str = "month", days: int = 30):
    """Get transaction volume chart data"""
    try:
        now = datetime.now(timezone.utc)
        
        if period == "week":
            days = 7
        elif period == "month":
            days = 30
        
        start_date = now - timedelta(days=days)
        
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date.isoformat()}}},
            {"$addFields": {
                "date": {"$substr": ["$created_at", 0, 10]}
            }},
            {"$group": {
                "_id": "$date",
                "count": {"$sum": 1},
                "volume": {"$sum": {"$abs": "$amount"}}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        data = await db.transactions.aggregate(pipeline).to_list(days + 1)
        
        return {
            "labels": [d["_id"] for d in data],
            "counts": [d["count"] for d in data],
            "volumes": [round(d["volume"], 2) for d in data],
            "period": period,
            "days": days
        }
    except Exception as e:
        logging.error(f"Transaction chart error: {e}")
        return {"labels": [], "counts": [], "volumes": [], "error": str(e)}


@router.get("/charts/revenue")
async def get_revenue_chart(period: str = "month", days: int = 30):
    """Get revenue chart data"""
    try:
        now = datetime.now(timezone.utc)
        
        if period == "week":
            days = 7
        elif period == "month":
            days = 30
        elif period == "year":
            days = 365
        
        start_date = now - timedelta(days=days)
        
        pipeline = [
            {"$match": {
                "status": "approved",
                "approved_at": {"$gte": start_date.isoformat()}
            }},
            {"$addFields": {
                "date": {"$substr": ["$approved_at", 0, 10]}
            }},
            {"$group": {
                "_id": "$date",
                "revenue": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        data = await db.vip_payments.aggregate(pipeline).to_list(days + 1)
        
        return {
            "labels": [d["_id"] for d in data],
            "revenue": [round(d["revenue"], 2) for d in data],
            "count": [d["count"] for d in data],
            "period": period,
            "days": days
        }
    except Exception as e:
        logging.error(f"Revenue chart error: {e}")
        return {"labels": [], "revenue": [], "count": [], "error": str(e)}


@router.get("/charts/subscriptions")
async def get_subscription_chart():
    """Get subscription distribution chart"""
    try:
        pipeline = [
            {"$group": {
                "_id": "$subscription_plan",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}}
        ]
        
        data = await db.users.aggregate(pipeline).to_list(10)
        
        labels = [d["_id"] or "none" for d in data]
        values = [d["count"] for d in data]
        
        return {"labels": labels, "values": values}
    except Exception as e:
        logging.error(f"Subscription chart error: {e}")
        return {"labels": [], "values": [], "error": str(e)}


# ========== REPORTS ==========

@router.get("/reports/summary")
async def get_summary_report(period: str = "month"):
    """Get summary report for specified period"""
    try:
        now = datetime.now(timezone.utc)
        
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        elif period == "year":
            start_date = now - timedelta(days=365)
        else:
            start_date = now - timedelta(days=30)
        
        start_str = start_date.isoformat()
        
        # New users
        new_users = await db.users.count_documents({"created_at": {"$gte": start_str}})
        
        # VIP conversions
        vip_conversions = await db.vip_payments.count_documents({
            "status": "approved",
            "approved_at": {"$gte": start_str}
        })
        
        # Revenue
        revenue_pipeline = [
            {"$match": {"status": "approved", "approved_at": {"$gte": start_str}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        revenue_result = await db.vip_payments.aggregate(revenue_pipeline).to_list(1)
        total_revenue = revenue_result[0]["total"] if revenue_result else 0
        
        # Transactions
        txn_count = await db.transactions.count_documents({"created_at": {"$gte": start_str}})
        
        # Active users (logged in during period)
        active_users = await db.login_history.aggregate([
            {"$match": {"login_time": {"$gte": start_str}}},
            {"$group": {"_id": "$user_id"}},
            {"$count": "count"}
        ]).to_list(1)
        active_count = active_users[0]["count"] if active_users else 0
        
        return {
            "period": period,
            "start_date": start_str,
            "end_date": now.isoformat(),
            "new_users": new_users,
            "vip_conversions": vip_conversions,
            "total_revenue": round(total_revenue, 2),
            "transaction_count": txn_count,
            "active_users": active_count,
            "generated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"Summary report error: {e}")
        return {"error": str(e)}


@router.get("/reports/users")
async def get_user_report(start_date: str = None, end_date: str = None):
    """Get detailed user report"""
    try:
        now = datetime.now(timezone.utc)
        
        if not start_date:
            start_date = (now - timedelta(days=30)).isoformat()
        if not end_date:
            end_date = now.isoformat()
        
        # User registration trend
        reg_pipeline = [
            {"$match": {"created_at": {"$gte": start_date, "$lte": end_date}}},
            {"$addFields": {"date": {"$substr": ["$created_at", 0, 10]}}},
            {"$group": {"_id": "$date", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        registrations = await db.users.aggregate(reg_pipeline).to_list(100)
        
        # User stats
        total = await db.users.count_documents({})
        period_new = await db.users.count_documents({"created_at": {"$gte": start_date, "$lte": end_date}})
        vip = await db.users.count_documents({"membership_type": "vip"})
        
        return {
            "period": {"start": start_date, "end": end_date},
            "total_users": total,
            "new_in_period": period_new,
            "vip_users": vip,
            "daily_registrations": registrations,
            "generated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"User report error: {e}")
        return {"error": str(e)}


@router.get("/reports/revenue")
async def get_revenue_report(start_date: str = None, end_date: str = None):
    """Get detailed revenue report"""
    try:
        now = datetime.now(timezone.utc)
        
        if not start_date:
            start_date = (now - timedelta(days=30)).isoformat()
        if not end_date:
            end_date = now.isoformat()
        
        # VIP payment revenue
        vip_pipeline = [
            {"$match": {
                "status": "approved",
                "approved_at": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": "$subscription_plan",
                "count": {"$sum": 1},
                "revenue": {"$sum": "$amount"}
            }}
        ]
        vip_by_plan = await db.vip_payments.aggregate(vip_pipeline).to_list(10)
        
        # Total revenue
        total_pipeline = [
            {"$match": {
                "status": "approved",
                "approved_at": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]
        total_result = await db.vip_payments.aggregate(total_pipeline).to_list(1)
        
        return {
            "period": {"start": start_date, "end": end_date},
            "total_revenue": round(total_result[0]["total"], 2) if total_result else 0,
            "total_transactions": total_result[0]["count"] if total_result else 0,
            "by_plan": {p["_id"] or "unknown": {"count": p["count"], "revenue": round(p["revenue"], 2)} for p in vip_by_plan},
            "generated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"Revenue report error: {e}")
        return {"error": str(e)}


# ========== ANALYTICS ==========

@router.get("/analytics/overview")
async def get_analytics_overview():
    """Get analytics overview"""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        week_start = (now - timedelta(days=7)).isoformat()
        month_start = (now - timedelta(days=30)).isoformat()
        
        overview = {
            "users": {
                "total": await db.users.count_documents({}),
                "today": await db.users.count_documents({"created_at": {"$gte": today_start}}),
                "week": await db.users.count_documents({"created_at": {"$gte": week_start}}),
                "month": await db.users.count_documents({"created_at": {"$gte": month_start}})
            },
            "transactions": {
                "today": await db.transactions.count_documents({"created_at": {"$gte": today_start}}),
                "week": await db.transactions.count_documents({"created_at": {"$gte": week_start}}),
                "month": await db.transactions.count_documents({"created_at": {"$gte": month_start}})
            },
            "orders": {
                "pending": await db.orders.count_documents({"status": "pending"}),
                "today": await db.orders.count_documents({"created_at": {"$gte": today_start}}),
                "week": await db.orders.count_documents({"created_at": {"$gte": week_start}})
            },
            "vip_payments": {
                "pending": await db.vip_payments.count_documents({"status": "pending"}),
                "approved_today": await db.vip_payments.count_documents({
                    "status": "approved",
                    "approved_at": {"$gte": today_start}
                })
            },
            "generated_at": now.isoformat()
        }
        
        return overview
    except Exception as e:
        logging.error(f"Analytics overview error: {e}")
        return {"error": str(e)}


@router.get("/analytics/retention")
async def get_retention_analytics():
    """Get user retention analytics"""
    try:
        now = datetime.now(timezone.utc)
        
        # Users who logged in multiple times
        retention_pipeline = [
            {"$group": {
                "_id": "$user_id",
                "login_count": {"$sum": 1},
                "first_login": {"$min": "$login_time"},
                "last_login": {"$max": "$login_time"}
            }},
            {"$match": {"login_count": {"$gt": 1}}},
            {"$count": "returning_users"}
        ]
        
        retention_result = await db.login_history.aggregate(retention_pipeline).to_list(1)
        returning_users = retention_result[0]["returning_users"] if retention_result else 0
        
        total_users = await db.users.count_documents({})
        
        return {
            "total_users": total_users,
            "returning_users": returning_users,
            "retention_rate": round((returning_users / total_users * 100), 2) if total_users > 0 else 0,
            "generated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"Retention analytics error: {e}")
        return {"error": str(e)}


@router.get("/analytics/conversion")
async def get_conversion_analytics():
    """Get VIP conversion analytics"""
    try:
        total_users = await db.users.count_documents({})
        vip_users = await db.users.count_documents({"membership_type": "vip"})
        
        # Conversion by source
        conversion_pipeline = [
            {"$match": {"membership_type": "vip"}},
            {"$group": {
                "_id": "$subscription_plan",
                "count": {"$sum": 1}
            }}
        ]
        by_plan = await db.users.aggregate(conversion_pipeline).to_list(10)
        
        return {
            "total_users": total_users,
            "vip_users": vip_users,
            "conversion_rate": round((vip_users / total_users * 100), 2) if total_users > 0 else 0,
            "by_plan": {p["_id"] or "unknown": p["count"] for p in by_plan},
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logging.error(f"Conversion analytics error: {e}")
        return {"error": str(e)}
