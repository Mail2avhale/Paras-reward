"""
Admin VIP Routes - VIP payments and subscription management
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin VIP"])

# Database and cache references
db = None
cache = None

# Helper function references
log_admin_action = None
check_and_grant_referral_reward = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

def set_helpers(helpers: dict):
    global log_admin_action, check_and_grant_referral_reward
    log_admin_action = helpers.get('log_admin_action')
    check_and_grant_referral_reward = helpers.get('check_and_grant_referral_reward')


# ========== VIP PAYMENTS ==========

@router.get("/vip-payments/pending-count")
async def get_pending_payments_count():
    """Get pending VIP payments count (cached)"""
    try:
        if cache:
            cached = await cache.get("pending_payments_count")
            if cached is not None:
                return {"count": cached}
        
        count = await db.vip_payments.count_documents({"status": "pending"})
        if cache:
            await cache.set("pending_payments_count", count, ttl=10)
        return {"count": count}
    except Exception as e:
        return {"count": 0, "error": str(e)}


@router.get("/vip-payments")
async def get_admin_vip_payments(status: str = None, page: int = 1, limit: int = 50):
    """Get VIP payments for admin verification - OPTIMIZED with caching"""
    try:
        cache_key = f"admin_vip_payments:{status or 'all'}:p{page}:l{limit}"
        
        if cache:
            cached = await cache.get(cache_key)
            if cached:
                return cached
        
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        total = await db.vip_payments.count_documents(query)
        
        payments = await db.vip_payments.find(
            query, 
            {
                "_id": 0,
                "payment_id": 1, "user_id": 1, "subscription_plan": 1, "plan_type": 1,
                "amount": 1, "utr_number": 1, "screenshot_url": 1, "date": 1, "time": 1,
                "status": 1, "submitted_at": 1, "approved_at": 1, "rejected_at": 1, "admin_notes": 1
            }
        ).sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)
        
        if not payments:
            result = {"payments": [], "total": total, "page": page, "pages": 0}
            if cache:
                await cache.set(cache_key, result, ttl=30)
            return result
        
        # Batch fetch user details
        user_ids = list(set(p.get("user_id") for p in payments if p.get("user_id")))
        users_data = {}
        
        if user_ids:
            users_cursor = db.users.find(
                {"uid": {"$in": user_ids}}, 
                {"_id": 0, "uid": 1, "name": 1, "email": 1, "phone": 1, "mobile": 1, "city": 1, "state": 1,
                 "subscription_plan": 1, "subscription_expiry": 1, "prc_balance": 1, "total_mined": 1,
                 "kyc_status": 1, "referral_code": 1, "created_at": 1, "membership_type": 1}
            )
            async for user in users_cursor:
                users_data[user.get("uid")] = user
        
        # Batch count previous payments
        prev_payments_pipeline = [
            {"$match": {"user_id": {"$in": user_ids}, "status": {"$in": ["approved", "completed"]}}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
        ]
        prev_payments_result = await db.vip_payments.aggregate(prev_payments_pipeline).to_list(100)
        prev_payments_map = {r["_id"]: r["count"] for r in prev_payments_result}
        
        # Enrich payments
        for payment in payments:
            user_id = payment.get("user_id")
            if user_id and user_id in users_data:
                user = users_data[user_id]
                payment["user_name"] = user.get("name", "Unknown")
                payment["user_email"] = user.get("email", "")
                payment["user_phone"] = user.get("phone") or user.get("mobile", "")
                payment["user_mobile"] = user.get("mobile", "")
                payment["user_city"] = user.get("city", "")
                payment["user_state"] = user.get("state", "")
                payment["current_plan"] = user.get("subscription_plan") or user.get("membership_type", "explorer")
                payment["current_expiry"] = user.get("subscription_expiry", "")
                payment["user_prc_balance"] = user.get("prc_balance", 0)
                payment["user_total_mined"] = user.get("total_mined", 0)
                payment["user_kyc_status"] = user.get("kyc_status", "pending")
                payment["user_referral_code"] = user.get("referral_code", "")
                payment["user_created_at"] = user.get("created_at", "")
            else:
                payment["user_name"] = "Unknown User"
                payment["user_email"] = ""
                payment["user_phone"] = ""
                payment["user_prc_balance"] = 0
                payment["user_kyc_status"] = "unknown"
            
            payment["user_previous_payments"] = prev_payments_map.get(user_id, 0)
            payment["user_total_orders"] = 0
        
        result = {
            "payments": payments,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
        
        cache_ttl = 5 if status == "pending" else 30
        if cache:
            await cache.set(cache_key, result, ttl=cache_ttl)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vip-payment/{payment_id}/approve")
async def approve_vip_payment(payment_id: str, request: Request):
    """Approve VIP payment and activate membership"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        notes = data.get("notes", "")
        correct_plan = data.get("correct_plan")
        correct_duration = data.get("correct_duration")
        
        payment = await db.vip_payments.find_one({"payment_id": payment_id})
        if not payment:
            raise HTTPException(status_code=404, detail=f"Payment not found: {payment_id}")
        
        current_status = payment.get("status")
        if current_status != "pending":
            if current_status == "approved":
                return {"message": "Payment already approved", "status": "approved", "success": True}
            raise HTTPException(status_code=400, detail=f"Payment already {current_status}")
        
        user_id = payment.get("user_id")
        
        original_plan = payment.get("subscription_plan", "startup")
        original_duration = payment.get("plan_type", "monthly")
        
        subscription_plan = correct_plan if correct_plan else original_plan
        plan_type = correct_duration if correct_duration else original_duration
        
        plan_corrected = (correct_plan and correct_plan != original_plan) or (correct_duration and correct_duration != original_duration)
        
        now = datetime.now(timezone.utc)
        duration_days = {"monthly": 30, "quarterly": 90, "half_yearly": 180, "yearly": 365}.get(plan_type, 30)
        
        user = await db.users.find_one({"uid": user_id})
        
        start_date = now
        if user:
            current_expiry = user.get("subscription_expiry") or user.get("vip_expiry")
            if current_expiry:
                try:
                    if isinstance(current_expiry, str):
                        current_expiry_dt = datetime.fromisoformat(current_expiry.replace('Z', '+00:00'))
                    else:
                        current_expiry_dt = current_expiry
                    
                    if current_expiry_dt > now:
                        start_date = current_expiry_dt
                except Exception as e:
                    logging.error(f"Error parsing expiry date: {e}")
                    start_date = now
        
        new_expiry = (start_date + timedelta(days=duration_days)).isoformat()
        # Note: subscription_plan is already set above using correct_plan or original_plan
        
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "membership_type": "vip",
                "subscription_plan": subscription_plan,
                "subscription_expiry": new_expiry,
                "vip_expiry": new_expiry,
                "vip_activated_at": now.isoformat(),
                "last_subscription_renewed": now.isoformat()
            }}
        )
        
        txn_number = f"SUB{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
        
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "approved",
                "txn_number": txn_number,
                "approved_at": now.isoformat(),
                "approved_by": admin_id,
                "admin_notes": notes,
                "subscription_extended": start_date != now,
                "new_expiry": new_expiry,
                "plan_corrected": plan_corrected,
                "original_plan_claimed": original_plan,
                "original_duration_claimed": original_duration,
                "actual_plan_approved": subscription_plan,
                "actual_duration_approved": plan_type
            }}
        )
        
        await db.company_wallets.update_one(
            {"wallet_type": "subscription"},
            {"$inc": {"balance": payment.get("amount", 0), "total_credit": payment.get("amount", 0)},
             "$set": {"last_updated": now.isoformat()}},
            upsert=True
        )
        
        await db.activity_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "action": "vip_payment_approved",
            "user_id": user_id,
            "admin_id": admin_id,
            "payment_id": payment_id,
            "amount": payment.get("amount"),
            "plan_type": plan_type,
            "subscription_plan": subscription_plan,
            "plan_corrected": plan_corrected,
            "extended": start_date != now,
            "new_expiry": new_expiry,
            "timestamp": now.isoformat()
        })
        
        if check_and_grant_referral_reward:
            try:
                await check_and_grant_referral_reward(user_id, now)
            except Exception as e:
                logging.error(f"Error checking referral reward: {e}")
        
        if start_date != now:
            remaining = (start_date - now).days
            message = f"Payment approved! Subscription extended. {remaining} remaining + {duration_days} new = {remaining + duration_days} total days"
        else:
            message = f"Payment approved! {duration_days} days subscription activated"
        
        if cache:
            try:
                await cache.delete("admin_vip_payments:pending:p1:l50")
                await cache.delete("admin_vip_payments:all:p1:l50")
            except:
                pass
        
        return {"success": True, "message": message, "new_expiry": new_expiry}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vip-payment/{payment_id}/reject")
async def reject_vip_payment(payment_id: str, request: Request):
    """Reject VIP payment"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        reason = data.get("reason", "Payment rejected by admin")
        
        payment = await db.vip_payments.find_one({"payment_id": payment_id})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") != "pending":
            raise HTTPException(status_code=400, detail=f"Payment already {payment.get('status')}")
        
        now = datetime.now(timezone.utc)
        
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "rejected",
                "rejected_at": now.isoformat(),
                "rejected_by": admin_id,
                "rejection_reason": reason
            }}
        )
        
        await db.activity_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "action": "vip_payment_rejected",
            "user_id": payment.get("user_id"),
            "admin_id": admin_id,
            "payment_id": payment_id,
            "reason": reason,
            "timestamp": now.isoformat()
        })
        
        if cache:
            try:
                await cache.delete("admin_vip_payments:pending:p1:l50")
                await cache.delete("admin_vip_payments:all:p1:l50")
            except:
                pass
        
        return {"success": True, "message": "Payment rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/vip-payment/{payment_id}")
async def delete_vip_payment(payment_id: str, admin_id: str):
    """Delete VIP payment record (admin only)"""
    admin = await db.users.find_one({"uid": admin_id})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.vip_payments.delete_one({"payment_id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="vip_payment_deleted",
            entity_type="payment",
            entity_id=payment_id
        )
    
    return {"success": True, "message": "Payment deleted"}


@router.delete("/vip-payments/{payment_id}")
async def delete_vip_payment_alt(payment_id: str):
    """Delete VIP payment record"""
    result = await db.vip_payments.delete_one({"payment_id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"success": True, "message": "Payment deleted"}


@router.put("/vip-payments/{payment_id}")
async def update_vip_payment(payment_id: str, request: Request):
    """Update VIP payment/subscription details"""
    data = await request.json()
    
    payment = await db.vip_payments.find_one({"payment_id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Allowed updates
    updates = {}
    if "plan" in data:
        updates["plan"] = data["plan"]
    if "duration" in data:
        updates["duration"] = data["duration"]
    if "amount" in data:
        updates["amount"] = data["amount"]
    if "expires_at" in data:
        updates["expires_at"] = data["expires_at"]
    
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": updates}
        )
        
        # Also update user subscription if plan changed
        if "plan" in updates or "expires_at" in updates:
            user_updates = {}
            if "plan" in updates:
                user_updates["subscription_plan"] = updates["plan"]
            if "expires_at" in updates:
                user_updates["subscription_expires_at"] = updates["expires_at"]
            
            if user_updates:
                await db.users.update_one(
                    {"uid": payment.get("user_id")},
                    {"$set": user_updates}
                )
    
    return {"success": True, "message": "Subscription updated"}


# ========== SUBSCRIPTION MANAGEMENT ==========

@router.get("/subscription-stats")
async def get_subscription_stats():
    """Get subscription statistics with caching"""
    try:
        # Try cache first
        cache_key = "admin:subscription_stats"
        if cache:
            cached = await cache.get(cache_key)
            if cached:
                return cached
        
        # Optimized: Use single aggregation for plan counts
        pipeline = [
            {"$group": {
                "_id": "$subscription_plan",
                "count": {"$sum": 1}
            }}
        ]
        stats = await db.users.aggregate(pipeline).to_list(10)
        
        # Convert to plan_counts format
        plan_counts = {"explorer": 0, "startup": 0, "growth": 0, "elite": 0}
        total_users = 0
        for stat in stats:
            plan_name = stat.get("_id")
            count = stat.get("count", 0)
            total_users += count
            if plan_name in plan_counts:
                plan_counts[plan_name] = count
        
        # Get pending payments count (fast query)
        pending_payments = await db.vip_payments.count_documents({"status": "pending"})
        
        # Skip monthly revenue calculation for speed (can be added to separate endpoint)
        result = {
            "by_plan": stats,
            "total_users": total_users,
            "vip_users": sum(plan_counts.values()),  # All subscription plans are VIP
            "plan_counts": plan_counts,
            "pending_payments": pending_payments,
            "monthly_revenue": 0  # Calculated separately if needed
        }
        
        # Cache for 30 seconds
        if cache:
            await cache.set(cache_key, result, ttl=30)
        
        return result
    except Exception as e:
        # Return partial data on error
        return {
            "plan_counts": {"explorer": 0, "startup": 0, "growth": 0, "elite": 0},
            "total_users": 0,
            "vip_users": 0,
            "pending_payments": 0,
            "monthly_revenue": 0,
            "error": str(e)
        }


@router.get("/subscription/pricing")
async def get_subscription_pricing():
    """Get current subscription pricing"""
    pricing = await db.settings.find_one({"key": "subscription_pricing"}, {"_id": 0})
    return pricing or {"plans": {}}


@router.post("/subscription/pricing")
async def update_subscription_pricing(request: Request):
    """Update subscription pricing"""
    data = await request.json()
    admin_id = data.get("admin_id")
    pricing = data.get("pricing")
    
    admin = await db.users.find_one({"uid": admin_id})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"key": "subscription_pricing"},
        {"$set": {"key": "subscription_pricing", "plans": pricing, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"success": True, "message": "Pricing updated"}


@router.get("/subscription-pricing-reference")
async def get_subscription_pricing_reference():
    """Get subscription pricing reference table"""
    pricing = {
        "explorer": {"name": "Explorer", "mining_rate": 0.5, "price": 0},
        "startup": {"name": "Startup", "mining_rate": 1.0, "prices": {"monthly": 199, "quarterly": 549, "half_yearly": 999, "yearly": 1799}},
        "growth": {"name": "Growth", "mining_rate": 2.0, "prices": {"monthly": 499, "quarterly": 1399, "half_yearly": 2499, "yearly": 4499}},
        "elite": {"name": "Elite", "mining_rate": 5.0, "prices": {"monthly": 1499, "quarterly": 4199, "half_yearly": 7499, "yearly": 13499}}
    }
    return pricing


@router.get("/vip-migration-status")
async def get_vip_migration_status():
    """Get VIP to subscription migration status"""
    legacy_vip_count = await db.users.count_documents({
        "membership_type": "vip",
        "$or": [
            {"subscription_plan": {"$exists": False}},
            {"subscription_plan": None},
            {"subscription_plan": ""}
        ]
    })
    
    migrated_count = await db.users.count_documents({
        "membership_type": "vip",
        "subscription_plan": {"$in": ["startup", "growth", "elite"]}
    })
    
    return {
        "legacy_vip_users": legacy_vip_count,
        "migrated_users": migrated_count,
        "migration_complete": legacy_vip_count == 0
    }


@router.post("/migrate-vip-users")
async def migrate_vip_users_to_subscription(request: Request):
    """Migrate legacy VIP users to new subscription system"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        
        admin = await db.users.find_one({"uid": admin_id})
        if not admin or admin.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        result = await db.users.update_many(
            {
                "membership_type": "vip",
                "$or": [
                    {"subscription_plan": {"$exists": False}},
                    {"subscription_plan": None},
                    {"subscription_plan": ""}
                ]
            },
            {"$set": {"subscription_plan": "startup"}}
        )
        
        if log_admin_action:
            await log_admin_action(
                admin_uid=admin_id,
                action="vip_migration",
                entity_type="system",
                details={"migrated_count": result.modified_count}
            )
        
        return {
            "success": True,
            "migrated_count": result.modified_count,
            "message": f"Migrated {result.modified_count} users to startup plan"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
