"""
Admin VIP Routes - VIP payments and subscription management
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging
import asyncio
from pymongo.errors import ServerSelectionTimeoutError, AutoReconnect, NetworkTimeout


async def db_operation_with_retry(operation, max_retries=3, delay=0.5):
    """Execute database operation with retry logic for timeout errors"""
    last_error = None
    for attempt in range(max_retries):
        try:
            return await operation()
        except (ServerSelectionTimeoutError, AutoReconnect, NetworkTimeout) as e:
            last_error = e
            logging.warning(f"DB operation retry {attempt + 1}/{max_retries}: {str(e)[:100]}")
            if attempt < max_retries - 1:
                await asyncio.sleep(delay * (attempt + 1))
        except Exception as e:
            # For other exceptions, don't retry
            raise e
    # Return None instead of raising - let caller handle gracefully
    logging.error(f"DB operation failed after {max_retries} retries: {str(last_error)[:100]}")
    return None

# Create router
router = APIRouter(prefix="/admin", tags=["Admin VIP"])

# Database and cache references
db = None
cache = None

# Helper function references
log_admin_action = None
check_and_grant_referral_reward = None
create_user_notification = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

def set_helpers(helpers: dict):
    global log_admin_action, check_and_grant_referral_reward, create_user_notification
    log_admin_action = helpers.get('log_admin_action')
    check_and_grant_referral_reward = helpers.get('check_and_grant_referral_reward')
    create_user_notification = helpers.get('create_notification')


async def send_notification(user_id: str, title: str, message: str, notif_type: str, icon: str = "🔔", action_url: str = None):
    """Send notification to user"""
    try:
        if create_user_notification:
            await create_user_notification(user_id, title, message, notif_type, None, icon, action_url)
        else:
            # Fallback: direct insert
            notification = {
                "notification_id": str(uuid.uuid4()),
                "user_id": user_id,
                "user_uid": user_id,
                "title": title,
                "message": message,
                "type": notif_type,
                "icon": icon,
                "action_url": action_url,
                "read": False,
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification)
    except Exception as e:
        logging.error(f"Failed to send notification: {e}")


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


@router.post("/vip-cache-clear")
async def clear_admin_cache(request: Request = None):
    """Clear admin VIP cache for fresh data"""
    try:
        if cache:
            # Clear common cache keys
            keys_to_clear = [
                "pending_payments_count",
                "subscription_stats",
                "admin_stats"
            ]
            for key in keys_to_clear:
                await cache.delete(key)
            
            # Clear paginated cache (first 10 pages)
            for status in ["pending", "approved", "rejected", "all"]:
                for page in range(1, 11):
                    for limit in [10, 20, 50]:
                        await cache.delete(f"admin_vip_payments:{status}:p{page}:l{limit}")
        
        return {"success": True, "message": "Cache cleared"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/vip-payments")
async def get_admin_vip_payments(
    status: str = None, 
    page: int = 1, 
    limit: int = 50, 
    nocache: bool = False,
    time_filter: str = None,  # today, week, month
    plan: str = None,  # startup, growth, elite
    duration: str = None  # monthly, quarterly, half_yearly, yearly
):
    """Get VIP payments for admin verification - OPTIMIZED with caching, filters and retry"""
    try:
        cache_key = f"admin_vip_payments:{status or 'all'}:p{page}:l{limit}:{time_filter}:{plan}:{duration}"
        
        if cache and not nocache and not time_filter and not plan and not duration:
            try:
                cached = await cache.get(cache_key)
                if cached:
                    return cached
            except Exception:
                pass  # Ignore cache errors
        
        query = {}
        if status:
            query["status"] = status
        
        # Filter out entries without user_id for approved status
        if status == "approved":
            query["user_id"] = {"$exists": True, "$nin": [None, ""]}
        
        # Time filter
        if time_filter:
            now = datetime.now(timezone.utc)
            if time_filter == "today":
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif time_filter == "week":
                start_date = now - timedelta(days=7)
            elif time_filter == "month":
                start_date = now - timedelta(days=30)
            else:
                start_date = None
            
            if start_date:
                # Check for both created_at and approved_at based on status
                date_field = "approved_at" if status == "approved" else "created_at"
                query[date_field] = {"$gte": start_date.isoformat()}
        
        # Plan filter
        if plan and plan != "all":
            query["subscription_plan"] = plan
        
        # Duration filter
        if duration and duration != "all":
            query["plan_type"] = duration
        
        skip = (page - 1) * limit
        
        # Use retry for count operation
        total = await db_operation_with_retry(
            lambda: db.vip_payments.count_documents(query)
        )
        
        # Handle DB failure gracefully
        if total is None:
            total = 0
        
        # Determine sort field and order based on status - latest first
        if status == "approved":
            sort_field = "approved_at"
        elif status == "rejected":
            sort_field = "rejected_at"
        else:
            sort_field = "submitted_at"
        
        # Use retry for find operation
        async def fetch_payments():
            return await db.vip_payments.find(
                query, 
                {
                    "_id": 0,
                    "payment_id": 1, "user_id": 1, "subscription_plan": 1, "plan_type": 1,
                    "amount": 1, "utr_number": 1, "screenshot_url": 1, "date": 1, "time": 1,
                    "status": 1, "submitted_at": 1, "approved_at": 1, "rejected_at": 1, "admin_notes": 1,
                    "new_expiry": 1, "rejection_reason": 1
                }
            ).sort(sort_field, -1).skip(skip).limit(limit).to_list(limit)
        
        payments = await db_operation_with_retry(fetch_payments)
        
        # Handle DB failure gracefully - return empty list instead of error
        if payments is None:
            payments = []
        
        if not payments:
            result = {"payments": [], "total": total, "page": page, "pages": 0}
            if cache:
                try:
                    await cache.set(cache_key, result, ttl=30)
                except Exception:
                    pass
            return result
        
        # Batch fetch user details
        user_ids = list(set(p.get("user_id") for p in payments if p.get("user_id")))
        users_data = {}
        
        if user_ids:
            async def fetch_users():
                return await db.users.find(
                    {"uid": {"$in": user_ids}}, 
                    {"_id": 0, "uid": 1, "name": 1, "email": 1, "phone": 1, "mobile": 1, "city": 1, "state": 1,
                     "subscription_plan": 1, "subscription_expiry": 1, "prc_balance": 1, "total_mined": 1,
                     "kyc_status": 1, "referral_code": 1, "created_at": 1, "membership_type": 1}
                ).to_list(500)
            
            users_list = await db_operation_with_retry(fetch_users)
            if users_list:
                for user in users_list:
                    users_data[user.get("uid")] = user
        
        # Batch count previous payments with retry
        async def fetch_prev_payments():
            prev_payments_pipeline = [
                {"$match": {"user_id": {"$in": user_ids}, "status": {"$in": ["approved", "completed"]}}},
                {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
            ]
            return await db.vip_payments.aggregate(prev_payments_pipeline).to_list(100)
        
        prev_payments_result = await db_operation_with_retry(fetch_prev_payments) if user_ids else []
        prev_payments_map = {r["_id"]: r["count"] for r in (prev_payments_result or [])}
        
        # Enrich payments
        for payment in payments:
            user_id = payment.get("user_id")
            
            # Add plan and duration fields for frontend compatibility
            payment["plan"] = payment.get("subscription_plan") or payment.get("plan", "")
            payment["duration"] = payment.get("plan_type") or payment.get("duration", "monthly")
            
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
    except (ServerSelectionTimeoutError, AutoReconnect, NetworkTimeout) as e:
        logging.error(f"Database timeout in vip-payments: {str(e)[:100]}")
        # Return empty result instead of 503 error
        return {
            "payments": [],
            "total": 0,
            "page": page,
            "pages": 0,
            "db_error": True,
            "message": "Database slow - please try again"
        }
    except Exception as e:
        logging.error(f"Error in vip-payments: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vip-payment/{payment_id}/approve")
async def approve_vip_payment(payment_id: str, request: Request):
    """Approve VIP payment and activate membership with retry logic"""
    try:
        # Handle empty body
        try:
            data = await request.json()
        except Exception:
            data = {}
        
        admin_id = data.get("admin_id")
        notes = data.get("notes", "")
        correct_plan = data.get("correct_plan")
        correct_duration = data.get("correct_duration")
        
        # Wrap database operations with retry logic
        payment = await db_operation_with_retry(
            lambda: db.vip_payments.find_one({"payment_id": payment_id})
        )
        
        # Check if DB operation failed (returned None due to timeout)
        if payment is None:
            # Try direct query without retry wrapper
            try:
                payment = await db.vip_payments.find_one({"payment_id": payment_id})
            except Exception as e:
                logging.error(f"Direct DB query failed: {e}")
                raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")
        
        if not payment:
            raise HTTPException(status_code=404, detail=f"Payment not found: {payment_id}")
        
        current_status = payment.get("status")
        # Allow approval of pending OR rejected payments (re-approval feature)
        if current_status not in ["pending", "rejected"]:
            if current_status == "approved":
                return {"message": "Payment already approved", "status": "approved", "success": True}
            raise HTTPException(status_code=400, detail=f"Payment cannot be approved - current status: {current_status}")
        
        user_id = payment.get("user_id")
        
        original_plan = payment.get("subscription_plan", "startup")
        original_duration = payment.get("plan_type", "monthly")
        
        subscription_plan = correct_plan if correct_plan else original_plan
        plan_type = correct_duration if correct_duration else original_duration
        
        plan_corrected = (correct_plan and correct_plan != original_plan) or (correct_duration and correct_duration != original_duration)
        
        now = datetime.now(timezone.utc)
        duration_days = {"monthly": 30, "quarterly": 90, "half_yearly": 180, "yearly": 365}.get(plan_type, 30)
        
        user = await db_operation_with_retry(
            lambda: db.users.find_one({"uid": user_id})
        )
        
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
        
        await db_operation_with_retry(
            lambda: db.users.update_one(
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
        )
        
        txn_number = f"SUB{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
        
        await db_operation_with_retry(
            lambda: db.vip_payments.update_one(
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
        )
        
        await db_operation_with_retry(
            lambda: db.company_wallets.update_one(
                {"wallet_type": "subscription"},
                {"$inc": {"balance": payment.get("amount", 0), "total_credit": payment.get("amount", 0)},
                 "$set": {"last_updated": now.isoformat()}},
                upsert=True
            )
        )
        
        await db_operation_with_retry(
            lambda: db.activity_logs.insert_one({
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
        )
        
        if check_and_grant_referral_reward:
            try:
                await check_and_grant_referral_reward(user_id, now)
            except Exception as e:
                logging.error(f"Error checking referral reward: {e}")
        
        # Send notification to user
        plan_name = subscription_plan.upper()
        await send_notification(
            user_id=user_id,
            title="🎉 Subscription Activated!",
            message=f"Congratulations! Your {plan_name} subscription has been activated for {duration_days} days. Enjoy premium benefits!",
            notif_type="subscription_approved",
            icon="🎉",
            action_url="/subscription"
        )
        
        if start_date != now:
            remaining = (start_date - now).days
            message = f"Payment approved! Subscription extended. {remaining} remaining + {duration_days} new = {remaining + duration_days} total days"
        else:
            message = f"Payment approved! {duration_days} days subscription activated"
        
        if cache:
            try:
                await cache.delete("admin_vip_payments:pending:p1:l50")
                await cache.delete("admin_vip_payments:all:p1:l50")
            except Exception:
                pass
        
        return {"success": True, "message": message, "new_expiry": new_expiry}
    except HTTPException:
        raise
    except (ServerSelectionTimeoutError, AutoReconnect, NetworkTimeout) as e:
        logging.error(f"Database timeout during subscription approval: {str(e)}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")
    except Exception as e:
        logging.error(f"Error in approve_vip_payment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vip-payment/{payment_id}/reject")
async def reject_vip_payment(payment_id: str, request: Request):
    """Reject VIP payment with retry logic"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        reason = data.get("reason", "Payment rejected by admin")
        
        payment = await db_operation_with_retry(
            lambda: db.vip_payments.find_one({"payment_id": payment_id})
        )
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") != "pending":
            raise HTTPException(status_code=400, detail=f"Payment already {payment.get('status')}")
        
        now = datetime.now(timezone.utc)
        user_id = payment.get("user_id")
        
        await db_operation_with_retry(
            lambda: db.vip_payments.update_one(
                {"payment_id": payment_id},
                {"$set": {
                    "status": "rejected",
                    "rejected_at": now.isoformat(),
                    "rejected_by": admin_id,
                    "rejection_reason": reason
                }}
            )
        )
        
        await db_operation_with_retry(
            lambda: db.activity_logs.insert_one({
                "log_id": str(uuid.uuid4()),
                "action": "vip_payment_rejected",
                "user_id": user_id,
                "admin_id": admin_id,
                "payment_id": payment_id,
                "reason": reason,
                "timestamp": now.isoformat()
            })
        )
        
        # Send notification to user about rejection
        if user_id:
            await send_notification(
                user_id=user_id,
                title="❌ Payment Rejected",
                message=f"Your subscription payment has been rejected. Reason: {reason}. Please submit a new payment with correct details.",
                notif_type="subscription_rejected",
                icon="❌",
                action_url="/subscription"
            )
        
        if cache:
            try:
                await cache.delete("admin_vip_payments:pending:p1:l50")
                await cache.delete("admin_vip_payments:all:p1:l50")
            except Exception:
                pass
        
        return {"success": True, "message": "Payment rejected"}
    except HTTPException:
        raise
    except (ServerSelectionTimeoutError, AutoReconnect, NetworkTimeout) as e:
        logging.error(f"Database timeout during subscription rejection: {str(e)}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")
    except Exception as e:
        logging.error(f"Error in reject_vip_payment: {str(e)}")
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
    """Update VIP payment/subscription details - Admin correction feature"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    payment = await db_operation_with_retry(
        lambda: db.vip_payments.find_one({"payment_id": payment_id})
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    user_id = payment.get("user_id")
    
    # Allowed updates for payment record
    payment_updates = {}
    user_updates = {}
    
    # Plan update
    if "plan" in data and data["plan"]:
        new_plan = data["plan"]
        payment_updates["subscription_plan"] = new_plan
        payment_updates["actual_plan_approved"] = new_plan
        user_updates["subscription_plan"] = new_plan
    
    # Duration update
    if "duration" in data and data["duration"]:
        new_duration = data["duration"]
        payment_updates["plan_type"] = new_duration
        payment_updates["actual_duration_approved"] = new_duration
    
    # Amount update
    if "amount" in data:
        payment_updates["amount"] = data["amount"]
    
    # Expiry date update - this is the key admin correction feature
    if "expires_at" in data and data["expires_at"]:
        new_expiry = data["expires_at"]
        # Ensure ISO format
        if not new_expiry.endswith('Z') and 'T' not in new_expiry:
            new_expiry = f"{new_expiry}T23:59:59.000Z"
        
        payment_updates["new_expiry"] = new_expiry
        user_updates["subscription_expiry"] = new_expiry
        user_updates["vip_expiry"] = new_expiry
    
    now = datetime.now(timezone.utc)
    
    if payment_updates:
        payment_updates["updated_at"] = now.isoformat()
        payment_updates["admin_corrected"] = True
        payment_updates["corrected_by"] = admin_id
        payment_updates["corrected_at"] = now.isoformat()
        
        await db_operation_with_retry(
            lambda: db.vip_payments.update_one(
                {"payment_id": payment_id},
                {"$set": payment_updates}
            )
        )
    
    # Update user's subscription details
    if user_updates and user_id:
        user_updates["last_subscription_updated"] = now.isoformat()
        await db_operation_with_retry(
            lambda: db.users.update_one(
                {"uid": user_id},
                {"$set": user_updates}
            )
        )
    
    # Log the admin correction
    await db_operation_with_retry(
        lambda: db.activity_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "action": "subscription_corrected",
            "admin_id": admin_id,
            "user_id": user_id,
            "payment_id": payment_id,
            "changes": {k: v for k, v in data.items() if k != "admin_id"},
            "timestamp": now.isoformat()
        })
    )
    
    # Send notification to user about subscription update
    if user_id:
        await send_notification(
            user_id=user_id,
            title="📝 Subscription Updated",
            message="Your subscription details have been updated by admin. Please check your subscription status.",
            notif_type="subscription_updated",
            icon="📝",
            action_url="/subscription"
        )
    
    return {"success": True, "message": "Subscription updated successfully"}


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
        
        # Convert to plan_counts format - null/empty/missing plans count as explorer
        plan_counts = {"explorer": 0, "startup": 0, "growth": 0, "elite": 0}
        total_users = 0
        for stat in stats:
            plan_name = stat.get("_id")
            count = stat.get("count", 0)
            total_users += count
            if plan_name in plan_counts:
                plan_counts[plan_name] = count
            elif plan_name is None or plan_name == "" or plan_name is False:
                # Count null/empty/missing subscription_plan as explorer (free users)
                plan_counts["explorer"] += count
        
        # Get pending payments count (fast query)
        pending_payments = await db.vip_payments.count_documents({"status": "pending"})
        
        # Skip monthly revenue calculation for speed (can be added to separate endpoint)
        result = {
            "by_plan": stats,
            "total_users": total_users,
            "vip_users": plan_counts["startup"] + plan_counts["growth"] + plan_counts["elite"],
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
