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
    """Get live statistics for debugging - CACHED 30 sec"""
    cache_key = "admin:debug:stats_live"
    
    if cache:
        cached = await cache.get(cache_key)
        if cached:
            return cached
    
    try:
        total_users = await db.users.count_documents({})
        elite_users = await db.users.count_documents({"subscription_plan": {"$in": ["elite", "startup", "growth", "vip", "pro"]}})
        pending_payments = await db.vip_payments.count_documents({"status": "pending"})
        pending_orders = await db.orders.count_documents({"status": "pending"})
        
        result = {
            "total_users": total_users,
            "elite_users": elite_users,
            "pending_payments": pending_payments,
            "pending_orders": pending_orders,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if cache:
            await cache.set(cache_key, result, ttl=30)
        
        return result
    except Exception as e:
        return {"error": str(e)}


@router.get("/stats")
async def get_admin_stats():
    """Get comprehensive admin statistics - CACHED 60 sec - OPTIMIZED with parallel queries"""
    import asyncio
    
    cache_key = "admin:stats:comprehensive"
    
    if cache:
        cached = await cache.get(cache_key)
        if cached:
            return cached
    
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        week_start = (now - timedelta(days=7)).isoformat()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        # Run ALL queries in parallel for faster response
        results = await asyncio.gather(
            # User counts
            db.users.count_documents({}),  # 0: total_users
            db.users.count_documents({"created_at": {"$gte": today_start}}),  # 1: new_today
            db.users.count_documents({"created_at": {"$gte": week_start}}),  # 2: new_week
            db.users.count_documents({"created_at": {"$gte": month_start}}),  # 3: new_month
            db.users.count_documents({"subscription_plan": {"$in": ["elite", "startup", "growth", "vip", "pro"]}}),  # 4: elite_users
            
            # Revenue
            db.vip_payments.aggregate([
                {"$match": {"status": "approved", "approved_at": {"$gte": month_start}}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1),  # 5: month_revenue
            
            # Orders
            db.orders.count_documents({}),  # 6: total_orders
            db.orders.count_documents({"status": "pending"}),  # 7: pending_orders
            
            # PRC total
            db.users.aggregate([
                {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
            ]).to_list(1),  # 8: total_prc
            
            # Subscription counts
            db.users.count_documents({
                "$or": [
                    {"subscription_plan": "explorer"},
                    {"subscription_plan": None},
                    {"subscription_plan": ""},
                    {"subscription_plan": {"$exists": False}}
                ]
            }),  # 9: explorer_count
            db.users.count_documents({"subscription_plan": "startup"}),  # 10: startup_count
            db.users.count_documents({"subscription_plan": "growth"}),  # 11: growth_count
            db.users.count_documents({"subscription_plan": "elite"}),  # 12: elite_count
            
            # Active mining users (Elite + mining_active + valid session)
            db.users.count_documents({
                "subscription_plan": {"$in": ["elite", "vip", "startup", "growth", "pro", "Elite", "VIP", "Startup", "Growth", "Pro"]},
                "mining_active": True,
                "$or": [
                    {"mining_session_end": {"$gt": now.isoformat()}},
                    {"mining_session_end": {"$gt": now}},
                    {"mining_session_end": {"$exists": False}},
                    {"mining_session_end": None}
                ]
            }),  # 13: active_mining
            
            # TOTAL PRC MINED (all-time)
            db.users.aggregate([
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$total_mined", 0]}}}}
            ]).to_list(1),  # 14: total_mined
            
            # TOTAL PRC BURNED (all-time from burn_logs)
            db.burn_logs.aggregate([
                {"$group": {"_id": None, "total": {"$sum": {"$abs": {"$ifNull": ["$amount", 0]}}}}}
            ]).to_list(1),  # 15: total_burned
            
            # TOTAL PRC REDEEMED - Orders
            db.orders.aggregate([
                {"$match": {"status": {"$in": ["completed", "delivered"]}}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$total_prc", 0]}}}}
            ]).to_list(1),  # 16: redeemed_orders
            
            # TOTAL PRC REDEEMED - Bill Payments
            db.bill_payment_requests.aggregate([
                {"$match": {"status": {"$in": ["completed", "approved"]}}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$total_prc_deducted", 0]}}}}
            ]).to_list(1),  # 17: redeemed_bills
            
            # TOTAL PRC REDEEMED - Gift Vouchers
            db.gift_voucher_requests.aggregate([
                {"$match": {"status": {"$in": ["completed", "approved"]}}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$total_prc_deducted", 0]}}}}
            ]).to_list(1),  # 18: redeemed_vouchers
            
            # TOTAL PRC REDEEMED - Bank Withdrawals
            db.bank_withdrawal_requests.aggregate([
                {"$match": {"status": {"$in": ["completed", "approved"]}}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$prc_amount", {"$ifNull": ["$total_prc_deducted", 0]}]}}}}
            ]).to_list(1),  # 19: redeemed_bank
            
            # TOTAL PRC REDEEMED - Bank Transfers
            db.bank_transfer_requests.aggregate([
                {"$match": {"status": {"$in": ["completed", "approved", "paid"]}}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$prc_deducted", {"$ifNull": ["$total_prc_deducted", 0]}]}}}}
            ]).to_list(1),  # 20: redeemed_bank_transfer
            
            # TOTAL PRC REDEEMED - PRC Subscriptions
            db.subscription_payments.aggregate([
                {"$match": {"payment_method": "prc", "status": {"$in": ["paid", "completed"]}}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$prc_amount", 0]}}}}
            ]).to_list(1),  # 21: redeemed_prc_subs
            
            # TOTAL PRC REDEEMED - DMT Transactions
            db.dmt_transactions.aggregate([
                {"$match": {"status": {"$in": ["completed", "approved", "success"]}}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$prc_deducted", {"$ifNull": ["$prc_amount", 0]}]}}}}
            ]).to_list(1),  # 22: redeemed_dmt
            
            # TOTAL PRC REDEEMED - Unified Redemptions
            db.unified_redemptions.aggregate([
                {"$match": {"status": {"$in": ["completed", "approved", "success"]}}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$prc_deducted", {"$ifNull": ["$prc_amount", 0]}]}}}}
            ]).to_list(1),  # 23: redeemed_unified
            
            return_exceptions=True
        )
        
        # Extract results safely
        total_users = results[0] if not isinstance(results[0], Exception) else 0
        new_today = results[1] if not isinstance(results[1], Exception) else 0
        new_week = results[2] if not isinstance(results[2], Exception) else 0
        new_month = results[3] if not isinstance(results[3], Exception) else 0
        vip_users = results[4] if not isinstance(results[4], Exception) else 0
        month_revenue = results[5] if not isinstance(results[5], Exception) else []
        total_orders = results[6] if not isinstance(results[6], Exception) else 0
        pending_orders = results[7] if not isinstance(results[7], Exception) else 0
        total_prc = results[8] if not isinstance(results[8], Exception) else []
        explorer_count = results[9] if not isinstance(results[9], Exception) else 0
        startup_count = results[10] if not isinstance(results[10], Exception) else 0
        growth_count = results[11] if not isinstance(results[11], Exception) else 0
        elite_count = results[12] if not isinstance(results[12], Exception) else 0
        active_mining = results[13] if not isinstance(results[13], Exception) else 0
        inactive_mining = total_users - active_mining
        
        # New PRC Economy stats
        total_mined_agg = results[14] if not isinstance(results[14], Exception) else []
        total_burned_agg = results[15] if not isinstance(results[15], Exception) else []
        
        total_prc_mined = round(total_mined_agg[0]["total"], 2) if total_mined_agg else 0
        total_prc_burned = round(total_burned_agg[0]["total"], 2) if total_burned_agg else 0
        
        # Complete PRC Redeemed (all collections summed)
        def safe_agg(idx):
            r = results[idx] if not isinstance(results[idx], Exception) else []
            return round(r[0]["total"], 2) if r else 0
        
        total_prc_redeemed = sum([safe_agg(i) for i in range(16, 24)])
        
        # Calculate total PRC circulation
        total_prc_value = round(total_prc[0]["total"], 4) if total_prc else 0
        
        result = {
            "users": {
                "total": total_users,
                "new_today": new_today,
                "new_week": new_week,
                "new_month": new_month,
                "elite": vip_users,
                "active_mining": active_mining,
                "inactive_mining": inactive_mining
            },
            "subscription_stats": {
                "explorer": explorer_count,
                "startup": startup_count,
                "growth": growth_count,
                "elite": elite_count
            },
            "revenue": {
                "month": round(month_revenue[0]["total"], 2) if month_revenue else 0
            },
            "orders": {
                "total": total_orders,
                "pending": pending_orders
            },
            "prc": {
                "total_circulation": total_prc_value,
                "total_mined": total_prc_mined,
                "total_redeemed": total_prc_redeemed,
                "total_burned": total_prc_burned,
                "available_for_redeem": round(max(0, total_prc_value), 2)
            },
            "total_prc": total_prc_value,
            "generated_at": now.isoformat()
        }
        
        # Cache result for 2 minutes for faster dashboard loading
        if cache:
            await cache.set(cache_key, result, ttl=120)
        
        return result
        
    except Exception as e:
        logging.error(f"Admin stats error: {e}")
        return {"error": str(e)}


@router.get("/dashboard-all")
async def get_dashboard_all():
    """Get all dashboard data in one call - OPTIMIZED with parallel queries"""
    import asyncio
    
    try:
        # Check cache first
        cache_key = "admin:dashboard:all"
        if cache:
            cached = await cache.get(cache_key)
            if cached:
                return cached
        
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        # Run ALL queries in PARALLEL
        results = await asyncio.gather(
            db.users.count_documents({}),  # total_users
            db.users.count_documents({"subscription_plan": {"$in": ["elite", "startup", "growth", "vip", "pro"]}}),  # elite_users
            db.vip_payments.count_documents({"status": "pending"}),  # pending_payments
            db.orders.count_documents({"status": "pending"}),  # pending_orders
            db.users.count_documents({"created_at": {"$gte": today_start}}),  # new_today
            db.vip_payments.find(
                {"status": "pending"},
                {"_id": 0, "payment_id": 1, "user_id": 1, "amount": 1, "submitted_at": 1}
            ).sort("submitted_at", -1).limit(5).to_list(5),  # recent_payments
            db.orders.find(
                {"status": "pending"},
                {"_id": 0, "order_id": 1, "user_id": 1, "total_prc": 1, "created_at": 1}
            ).sort("created_at", -1).limit(5).to_list(5),  # recent_orders
            return_exceptions=True
        )
        
        response = {
            "counts": {
                "total_users": results[0] if not isinstance(results[0], Exception) else 0,
                "vip_users": results[1] if not isinstance(results[1], Exception) else 0,
                "pending_payments": results[2] if not isinstance(results[2], Exception) else 0,
                "pending_orders": results[3] if not isinstance(results[3], Exception) else 0,
                "new_users_today": results[4] if not isinstance(results[4], Exception) else 0
            },
            "recent_payments": results[5] if not isinstance(results[5], Exception) else [],
            "recent_orders": results[6] if not isinstance(results[6], Exception) else [],
            "generated_at": now.isoformat()
        }
        
        # Cache for 30 seconds
        if cache:
            await cache.set(cache_key, response, ttl=30)
        
        return response
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
