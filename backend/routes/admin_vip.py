"""
Admin VIP Routes - SIMPLIFIED VERSION
Clean, simple subscription management without complex patterns
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging
import asyncio

router = APIRouter(prefix="/admin", tags=["Admin VIP"])

# Database reference
db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

def set_helpers(helpers: dict):
    pass  # Not needed in simple version


# ========== VIP PAYMENTS ==========

@router.get("/vip-payments")
async def get_vip_payments(
    status: str = None,
    page: int = 1,
    limit: int = 20,
    time_filter: str = None,
    plan: str = None,
    duration: str = None,
    search: str = None,
    date_from: str = None,
    date_to: str = None
):
    """Get VIP payments list - Simple version"""
    try:
        query = {}
        
        if status:
            query["status"] = status
        
        # Search filter
        if search:
            search_users = await db.users.find({
                "$or": [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"email": {"$regex": search, "$options": "i"}},
                    {"phone": {"$regex": search, "$options": "i"}}
                ]
            }, {"_id": 0, "uid": 1}).to_list(100)
            user_ids = [u["uid"] for u in search_users]
            
            query["$or"] = [
                {"user_id": {"$in": user_ids}} if user_ids else {"user_id": None},
                {"utr_number": {"$regex": search, "$options": "i"}},
                {"user_name": {"$regex": search, "$options": "i"}},
                {"user_email": {"$regex": search, "$options": "i"}}
            ]
        
        # Date range filter
        if date_from or date_to:
            date_field = "approved_at" if status == "approved" else "submitted_at"
            date_query = {}
            if date_from:
                date_query["$gte"] = f"{date_from}T00:00:00"
            if date_to:
                date_query["$lte"] = f"{date_to}T23:59:59"
            if date_query:
                query[date_field] = date_query
        # Time filter (legacy - today/week/month)
        elif time_filter:
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
                date_field = "approved_at" if status == "approved" else "submitted_at"
                query[date_field] = {"$gte": start_date.isoformat()}
        
        # Plan filter
        if plan and plan != "all":
            query["subscription_plan"] = plan
        
        # Duration filter
        if duration and duration != "all":
            query["plan_type"] = duration
        
        skip = (page - 1) * limit
        
        # Sort by appropriate field
        sort_field = "submitted_at"
        if status == "approved":
            sort_field = "approved_at"
        elif status == "rejected":
            sort_field = "rejected_at"
        
        # Get total count
        total = await db.vip_payments.count_documents(query)
        
        # Get payments - FIFO: oldest first (ascending order)
        payments_cursor = db.vip_payments.find(
            query,
            {"_id": 0}
        ).sort(sort_field, 1).skip(skip).limit(limit)
        
        payments = await payments_cursor.to_list(limit)
        
        if not payments:
            return {
                "payments": [],
                "total": total,
                "page": page,
                "pages": 0
            }
        
        # Get user details
        user_ids = list(set(p.get("user_id") for p in payments if p.get("user_id")))
        users_map = {}
        
        if user_ids:
            users_cursor = db.users.find(
                {"uid": {"$in": user_ids}},
                {"_id": 0, "uid": 1, "name": 1, "email": 1, "phone": 1, "mobile": 1, "subscription": 1}
            )
            users_list = await users_cursor.to_list(500)
            users_map = {u["uid"]: u for u in users_list}
        
        # Enrich payments with user info and subscription expiry
        for payment in payments:
            user_id = payment.get("user_id")
            user = users_map.get(user_id, {})
            
            payment["user_name"] = user.get("name") or payment.get("user_name") or "Unknown"
            payment["user_email"] = user.get("email") or payment.get("user_email") or ""
            payment["user_phone"] = user.get("phone") or user.get("mobile") or payment.get("user_phone") or ""
            payment["plan"] = payment.get("subscription_plan", "")
            payment["duration"] = payment.get("plan_type", "monthly")
            
            # If new_expiry not set but it's approved, get user's subscription expiry
            if status == "approved" and not payment.get("new_expiry"):
                user_sub = user.get("subscription", {})
                payment["new_expiry"] = user_sub.get("expires_at") or user_sub.get("end_date")
        
        return {
            "payments": payments,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    
    except Exception as e:
        logging.error(f"Error fetching payments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vip-payments/pending-count")
async def get_pending_count():
    """Get pending payments count"""
    try:
        count = await db.vip_payments.count_documents({"status": "pending"})
        return {"count": count}
    except Exception as e:
        return {"count": 0, "error": str(e)}


@router.post("/vip-payment/{payment_id}/approve")
async def approve_payment(payment_id: str, request: Request):
    """Approve VIP payment - with timeout handling"""
    try:
        # Parse request body
        try:
            data = await request.json()
        except:
            data = {}
        
        admin_id = data.get("admin_id")
        correct_plan = data.get("correct_plan")
        correct_duration = data.get("correct_duration")
        notes = data.get("notes", "")
        
        # Step 1: Find payment with timeout
        try:
            payment = await asyncio.wait_for(
                db.vip_payments.find_one(
                    {"payment_id": payment_id},
                    {"_id": 0}
                ),
                timeout=10.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Database timeout. Please try again.")
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") == "approved":
            return {"success": True, "message": "Already approved"}
        
        if payment.get("status") not in ["pending", "rejected"]:
            raise HTTPException(status_code=400, detail=f"Cannot approve - status: {payment.get('status')}")
        
        user_id = payment.get("user_id")
        
        # Determine plan and duration
        plan = correct_plan or payment.get("subscription_plan", "startup")
        duration = correct_duration or payment.get("plan_type", "monthly")
        
        # Calculate expiry (28 days per month)
        now = datetime.now(timezone.utc)
        duration_days = {
            "monthly": 28
        }.get(duration, 28)
        
        # Check current user expiry with timeout
        try:
            user = await asyncio.wait_for(
                db.users.find_one({"uid": user_id}, {"_id": 0, "subscription_expiry": 1}),
                timeout=10.0
            )
        except asyncio.TimeoutError:
            user = None  # Continue without extension
        
        start_date = now
        if user:
            current_expiry = user.get("subscription_expiry")
            if current_expiry:
                try:
                    if isinstance(current_expiry, str):
                        exp_dt = datetime.fromisoformat(current_expiry.replace('Z', '+00:00'))
                    else:
                        exp_dt = current_expiry
                    if exp_dt > now:
                        start_date = exp_dt
                except:
                    pass
        
        new_expiry = (start_date + timedelta(days=duration_days)).isoformat()
        
        # Step 2: Update payment status with timeout
        try:
            await asyncio.wait_for(
                db.vip_payments.update_one(
                    {"payment_id": payment_id},
                    {"$set": {
                        "status": "approved",
                        "approved_at": now.isoformat(),
                        "approved_by": admin_id,
                        "admin_notes": notes,
                        "new_expiry": new_expiry,
                        "actual_plan_approved": plan,
                        "actual_duration_approved": duration
                    }}
                ),
                timeout=15.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Database timeout while updating payment. Please retry.")
        
        # Step 3: Update user subscription with timeout
        try:
            await asyncio.wait_for(
                db.users.update_one(
                    {"uid": user_id},
                    {"$set": {
                        "membership_type": "vip",
                        "subscription_plan": plan,
                        "subscription_expiry": new_expiry,
                        "vip_expiry": new_expiry,
                        "vip_activated_at": now.isoformat()
                    }}
                ),
                timeout=15.0
            )
        except asyncio.TimeoutError:
            # Payment already approved, user update failed
            raise HTTPException(status_code=504, detail="Subscription activated but user update timed out. Please check user status.")
        
        # Step 4: Update company wallet (optional - don't fail if error)
        try:
            await db.company_wallets.update_one(
                {"wallet_type": "subscription"},
                {
                    "$inc": {"balance": payment.get("amount", 0)},
                    "$set": {"last_updated": now.isoformat()}
                },
                upsert=True
            )
        except Exception as e:
            logging.warning(f"Wallet update failed: {e}")
        
        # Step 5: Log activity (optional)
        try:
            await db.activity_logs.insert_one({
                "log_id": str(uuid.uuid4()),
                "action": "vip_payment_approved",
                "user_id": user_id,
                "admin_id": admin_id,
                "payment_id": payment_id,
                "amount": payment.get("amount"),
                "plan": plan,
                "duration": duration,
                "new_expiry": new_expiry,
                "timestamp": now.isoformat()
            })
        except:
            pass
        
        extended = start_date != now
        if extended:
            remaining = (start_date - now).days
            msg = f"Approved! Extended: {remaining} + {duration_days} = {remaining + duration_days} days"
        else:
            msg = f"Approved! {duration_days} days activated"
        
        return {"success": True, "message": msg, "new_expiry": new_expiry}
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Approval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vip-payment/{payment_id}/reject")
async def reject_payment(payment_id: str, request: Request):
    """Reject VIP payment"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        reason = data.get("reason", "Payment rejected")
        
        # Find payment
        payment = await db.vip_payments.find_one({"payment_id": payment_id}, {"_id": 0})
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot reject - status: {payment.get('status')}")
        
        now = datetime.now(timezone.utc)
        
        # Update payment
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "rejected",
                "rejected_at": now.isoformat(),
                "rejected_by": admin_id,
                "rejection_reason": reason
            }}
        )
        
        # Create notification for user
        try:
            await db.notifications.insert_one({
                "notification_id": str(uuid.uuid4()),
                "user_id": payment.get("user_id"),
                "title": "Payment Rejected",
                "message": f"Your payment was rejected. Reason: {reason}",
                "type": "payment_rejected",
                "read": False,
                "created_at": now.isoformat()
            })
        except:
            pass
        
        return {"success": True, "message": "Payment rejected"}
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Rejection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/vip-payments/{payment_id}")
async def delete_payment(payment_id: str):
    """Delete VIP payment record"""
    result = await db.vip_payments.delete_one({"payment_id": payment_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return {"success": True, "message": "Payment deleted"}


@router.put("/vip-payments/{payment_id}")
async def update_payment(payment_id: str, request: Request):
    """Update VIP payment/subscription details"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        
        payment = await db.vip_payments.find_one({"payment_id": payment_id}, {"_id": 0})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        user_id = payment.get("user_id")
        now = datetime.now(timezone.utc)
        
        payment_updates = {"updated_at": now.isoformat()}
        user_updates = {}
        
        if "plan" in data and data["plan"]:
            payment_updates["subscription_plan"] = data["plan"]
            payment_updates["actual_plan_approved"] = data["plan"]
            user_updates["subscription_plan"] = data["plan"]
        
        if "duration" in data and data["duration"]:
            payment_updates["plan_type"] = data["duration"]
            payment_updates["actual_duration_approved"] = data["duration"]
        
        if "amount" in data:
            payment_updates["amount"] = data["amount"]
        
        if "expires_at" in data and data["expires_at"]:
            new_expiry = data["expires_at"]
            if "T" not in new_expiry:
                new_expiry = f"{new_expiry}T23:59:59.000Z"
            payment_updates["new_expiry"] = new_expiry
            user_updates["subscription_expiry"] = new_expiry
            user_updates["vip_expiry"] = new_expiry
        
        # Update payment
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": payment_updates}
        )
        
        # Update user if needed
        if user_updates and user_id:
            await db.users.update_one(
                {"uid": user_id},
                {"$set": user_updates}
            )
        
        return {"success": True, "message": "Updated successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== STATS ==========

@router.get("/subscription-stats")
async def get_subscription_stats():
    """Get subscription statistics"""
    try:
        # Count by plan
        pipeline = [
            {"$group": {"_id": "$subscription_plan", "count": {"$sum": 1}}}
        ]
        stats = await db.users.aggregate(pipeline).to_list(10)
        
        plan_counts = {"explorer": 0, "startup": 0, "growth": 0, "elite": 0}
        total = 0
        
        for stat in stats:
            plan = stat.get("_id")
            count = stat.get("count", 0)
            total += count
            
            if plan in plan_counts:
                plan_counts[plan] = count
            elif not plan or plan == "":
                plan_counts["explorer"] += count
        
        pending = await db.vip_payments.count_documents({"status": "pending"})
        
        return {
            "plan_counts": plan_counts,
            "total_users": total,
            "vip_users": plan_counts["startup"] + plan_counts["growth"] + plan_counts["elite"],
            "pending_payments": pending,
            "monthly_revenue": 0
        }
    
    except Exception as e:
        logging.error(f"Stats error: {e}")
        return {
            "plan_counts": {"explorer": 0, "startup": 0, "growth": 0, "elite": 0},
            "total_users": 0,
            "vip_users": 0,
            "pending_payments": 0
        }


@router.post("/vip-cache-clear")
async def clear_cache():
    """Clear VIP cache"""
    return {"success": True, "message": "Cache cleared"}


@router.get("/subscription-pricing-reference")
async def get_pricing_reference():
    """Get pricing reference (monthly only)"""
    return {
        "explorer": {"name": "Explorer", "mining_rate": 0.5, "price": 0},
        "startup": {"name": "Startup", "mining_rate": 1.0, "prices": {"monthly": 199}},
        "growth": {"name": "Growth", "mining_rate": 2.0, "prices": {"monthly": 499}},
        "elite": {"name": "Elite", "mining_rate": 5.0, "prices": {"monthly": 1499}}
    }
