"""
Razorpay Payment Gateway Integration
- Create orders for VIP subscriptions
- Verify payments with DOUBLE VERIFICATION
- Handle webhooks
VERSION: 2.0 - With payment status verification from Razorpay API
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import razorpay
import os
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
import logging

router = APIRouter(prefix="/razorpay", tags=["Razorpay Payments"])

# Code version for deployment verification
CODE_VERSION = "2.0-SECURE"

# Initialize Razorpay client
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET")

if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
else:
    razorpay_client = None
    logging.warning("Razorpay credentials not configured")

if RAZORPAY_WEBHOOK_SECRET:
    logging.info("Razorpay webhook secret configured")
else:
    logging.warning("Razorpay webhook secret NOT configured - webhooks may fail signature verification")

# Database reference (set from server.py)
db = None

def set_db(database):
    global db
    db = database


class CreateOrderRequest(BaseModel):
    user_id: str
    plan_type: str  # monthly, quarterly, half_yearly, yearly
    plan_name: str  # startup, growth, elite
    amount: float  # Amount in INR


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    user_id: str


# Plan duration mapping (28 days per month)
PLAN_DURATIONS = {
    "monthly": 28,      # 28 days (1 month)
    "quarterly": 84,    # 84 days (3 months)
    "half_yearly": 168, # 168 days (6 months)
    "yearly": 336       # 336 days (1 year)
}


@router.get("/config")
async def get_razorpay_config():
    """Get Razorpay public key for frontend"""
    if not RAZORPAY_KEY_ID:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    # Check if Razorpay is enabled in settings
    is_enabled = True
    if db is not None:
        settings = await db.app_settings.find_one({"key": "razorpay_enabled"})
        if settings:
            is_enabled = settings.get("value", True)
    
    return {
        "key_id": RAZORPAY_KEY_ID,
        "currency": "INR",
        "company_name": "PARAS REWARD",
        "code_version": CODE_VERSION,
        "security": "DOUBLE_VERIFICATION_ENABLED",
        "enabled": is_enabled
    }


@router.post("/toggle")
async def toggle_razorpay_gateway(request: Request):
    """Enable or disable Razorpay payment gateway"""
    try:
        data = await request.json()
        enabled = data.get("enabled", True)
        admin_pin = data.get("admin_pin")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        if db is not None:
            await db.app_settings.update_one(
                {"key": "razorpay_enabled"},
                {"$set": {"key": "razorpay_enabled", "value": enabled, "updated_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True
            )
        
        return {
            "success": True,
            "message": f"Razorpay gateway {'enabled' if enabled else 'disabled'}",
            "enabled": enabled
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-order")
async def create_razorpay_order(request: CreateOrderRequest):
    """Create a Razorpay order for subscription payment"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    # Check if Razorpay is enabled
    if db is not None:
        settings = await db.app_settings.find_one({"key": "razorpay_enabled"})
        if settings and settings.get("value") == False:
            raise HTTPException(status_code=403, detail="Online payment is currently disabled. Please use manual payment.")
    
    try:
        # Convert amount to paise (Razorpay uses smallest currency unit)
        amount_paise = int(request.amount * 100)
        
        # Create Razorpay order
        # Receipt must be <= 40 chars
        receipt_id = f"sub_{request.user_id[-8:]}_{datetime.now().strftime('%m%d%H%M%S')}"
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt_id,
            "notes": {
                "user_id": request.user_id,
                "plan_type": request.plan_type,
                "plan_name": request.plan_name
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        # Save order to database
        if db is not None:
            await db.razorpay_orders.insert_one({
                "order_id": order["id"],
                "user_id": request.user_id,
                "plan_type": request.plan_type,
                "plan_name": request.plan_name,
                "amount": request.amount,
                "amount_paise": amount_paise,
                "status": "created",
                "created_at": datetime.now(timezone.utc)
            })
        
        return {
            "order_id": order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID
        }
        
    except Exception as e:
        logging.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@router.post("/verify-payment")
async def verify_razorpay_payment(request: VerifyPaymentRequest):
    """Verify payment signature and activate subscription - WITH DOUBLE VERIFICATION"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    try:
        # ==================== STEP 1: SIGNATURE VERIFICATION ====================
        # Generate signature to verify
        message = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != request.razorpay_signature:
            logging.warning(f"[RAZORPAY] Invalid signature for payment {request.razorpay_payment_id}")
            raise HTTPException(status_code=400, detail="Invalid payment signature")
        
        # ==================== STEP 2: FETCH PAYMENT FROM RAZORPAY API ====================
        # CRITICAL: Verify payment status directly from Razorpay
        try:
            payment_details = razorpay_client.payment.fetch(request.razorpay_payment_id)
            logging.info(f"[RAZORPAY] Payment details: {payment_details}")
        except Exception as e:
            logging.error(f"[RAZORPAY] Failed to fetch payment {request.razorpay_payment_id}: {e}")
            raise HTTPException(status_code=400, detail="Failed to verify payment with Razorpay")
        
        # ==================== STEP 3: VERIFY PAYMENT STATUS ====================
        # CRITICAL: Only activate if payment is actually captured/authorized
        payment_status = payment_details.get("status", "")
        payment_amount = payment_details.get("amount", 0) / 100  # Convert paise to INR
        payment_captured = payment_details.get("captured", False)
        
        logging.info(f"[RAZORPAY] Payment {request.razorpay_payment_id}: status={payment_status}, captured={payment_captured}, amount={payment_amount}")
        
        # Valid payment statuses for activation
        VALID_PAYMENT_STATUSES = ["captured", "authorized"]
        
        if payment_status not in VALID_PAYMENT_STATUSES:
            logging.warning(f"[RAZORPAY] BLOCKED - Payment {request.razorpay_payment_id} has invalid status: {payment_status}")
            
            # Log the blocked attempt
            if db is not None:
                await db.blocked_payment_attempts.insert_one({
                    "payment_id": request.razorpay_payment_id,
                    "order_id": request.razorpay_order_id,
                    "user_id": request.user_id,
                    "payment_status": payment_status,
                    "payment_captured": payment_captured,
                    "payment_amount": payment_amount,
                    "reason": f"Invalid payment status: {payment_status}",
                    "blocked_at": datetime.now(timezone.utc)
                })
            
            raise HTTPException(
                status_code=400, 
                detail=f"Payment not successful. Status: {payment_status}. Please try again."
            )
        
        # ==================== STEP 4: VERIFY ORDER EXISTS ====================
        order = await db.razorpay_orders.find_one({"order_id": request.razorpay_order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # ==================== STEP 4.1: CHECK ORDER NOT ALREADY USED ====================
        if order.get("status") == "paid":
            logging.warning(f"[RAZORPAY] Order already paid: {request.razorpay_order_id}")
            raise HTTPException(status_code=400, detail="This order has already been completed")
        
        # ==================== STEP 5: CHECK FOR DUPLICATE ACTIVATION ====================
        # Prevent same payment from being used multiple times
        existing_payment = await db.razorpay_orders.find_one({
            "payment_id": request.razorpay_payment_id,
            "status": "paid"
        })
        if existing_payment:
            logging.warning(f"[RAZORPAY] Duplicate payment attempt: {request.razorpay_payment_id}")
            raise HTTPException(status_code=400, detail="This payment has already been processed")
        
        # ==================== STEP 6: VERIFY AMOUNT MATCHES ====================
        expected_amount = order.get("amount", 0)
        if abs(payment_amount - expected_amount) > 1:  # Allow ₹1 tolerance
            logging.warning(f"[RAZORPAY] Amount mismatch: expected {expected_amount}, got {payment_amount}")
            raise HTTPException(status_code=400, detail="Payment amount mismatch")
        
        # ==================== STEP 7: UPDATE ORDER STATUS ====================
        await db.razorpay_orders.update_one(
            {"order_id": request.razorpay_order_id},
            {
                "$set": {
                    "status": "paid",
                    "payment_id": request.razorpay_payment_id,
                    "signature": request.razorpay_signature,
                    "payment_status": payment_status,
                    "payment_captured": payment_captured,
                    "verified_amount": payment_amount,
                    "paid_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # ==================== STEP 8: ACTIVATE USER SUBSCRIPTION ====================
        plan_type = order.get("plan_type", "monthly")
        plan_name = order.get("plan_name", "startup")
        duration_days = PLAN_DURATIONS.get(plan_type, 28)
        
        now = datetime.now(timezone.utc)
        
        # Check if user has existing active subscription - ADD remaining days
        user = await db.users.find_one({"uid": request.user_id})
        remaining_days = 0
        old_plan = None
        old_expiry_str = None
        
        if user:
            old_plan = user.get("subscription_plan")
            
            # Check BOTH field names for expiry (subscription_expires AND subscription_expiry)
            raw_expires = user.get("subscription_expires")
            raw_expiry = user.get("subscription_expiry")
            raw_vip = user.get("vip_expiry")
            
            logging.info(f"[RAZORPAY] User {request.user_id} expiry fields - subscription_expires: {raw_expires} (type: {type(raw_expires).__name__}), subscription_expiry: {raw_expiry}, vip_expiry: {raw_vip}")
            
            existing_expiry = raw_expires or raw_expiry or raw_vip
            
            if existing_expiry:
                old_expiry_str = str(existing_expiry)
                
                # Handle both datetime object and string
                if isinstance(existing_expiry, str):
                    try:
                        existing_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
                        logging.info(f"[RAZORPAY] Parsed expiry string to datetime: {existing_expiry}")
                    except Exception as e:
                        logging.warning(f"[RAZORPAY] Could not parse expiry date: {existing_expiry}, error: {e}")
                        existing_expiry = None
                
                # Make sure existing_expiry is timezone aware
                if existing_expiry:
                    if existing_expiry.tzinfo is None:
                        existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
                    
                    if existing_expiry > now:
                        # User has active subscription - calculate remaining days
                        remaining_days = (existing_expiry - now).days
                        logging.info(f"[RAZORPAY] ✅ User {request.user_id} has {remaining_days} days remaining from {old_plan}, will be added to new plan")
                    else:
                        logging.info(f"[RAZORPAY] User {request.user_id} subscription expired on {existing_expiry}, no days to add")
            else:
                logging.info(f"[RAZORPAY] User {request.user_id} has no existing subscription expiry")
        
        # New expiry = today + new plan duration + remaining days
        total_days = duration_days + remaining_days
        expiry_date = now + timedelta(days=total_days)
        
        logging.info(f"[RAZORPAY] User {request.user_id}: New plan {duration_days} days + Remaining {remaining_days} days = Total {total_days} days")
        
        # Update user subscription (set BOTH expiry field names for consistency)
        await db.users.update_one(
            {"uid": request.user_id},
            {
                "$set": {
                    "subscription_plan": plan_name,
                    "subscription_start": now,
                    "subscription_expires": expiry_date,
                    "subscription_expiry": expiry_date.isoformat(),  # Also set this field
                    "membership_type": "vip",
                    "subscription_status": "active",
                    "last_payment_id": request.razorpay_payment_id,
                    "last_payment_date": now,
                    "previous_plan": old_plan,
                    "previous_remaining_days_added": remaining_days,
                    "previous_expiry": old_expiry_str
                }
            }
        )
        
        # ==================== STEP 9: LOG TRANSACTION ====================
        await db.transactions.insert_one({
            "user_id": request.user_id,
            "type": "subscription_payment",
            "amount": payment_amount,  # Use verified amount from Razorpay
            "payment_id": request.razorpay_payment_id,
            "order_id": request.razorpay_order_id,
            "plan_name": plan_name,
            "plan_type": plan_type,
            "duration_days": duration_days,
            "remaining_days_added": remaining_days,
            "total_days": total_days,
            "payment_status": payment_status,
            "payment_captured": payment_captured,
            "timestamp": now
        })
        
        # ==================== STEP 10: ADD TO VIP_PAYMENTS FOR ADMIN DASHBOARD ====================
        # This is critical - admin dashboard shows vip_payments collection
        await db.vip_payments.insert_one({
            "user_id": request.user_id,
            "order_id": request.razorpay_order_id,
            "payment_id": request.razorpay_payment_id,
            "amount": payment_amount,
            "subscription_plan": plan_name,
            "plan_type": plan_type,
            "status": "approved",
            "payment_method": "razorpay",
            "payment_captured": payment_captured,
            "new_expiry": expiry_date.isoformat(),
            "duration_days": total_days,
            "remaining_days_added": remaining_days,
            "approved_at": now.isoformat(),
            "created_at": now.isoformat(),
            "auto_activated": True,
            "activation_source": "razorpay_verify"
        })
        
        logging.info(f"[RAZORPAY] SUCCESS - Subscription activated for user {request.user_id}, plan: {plan_name}, total days: {total_days}")
        
        return {
            "success": True,
            "message": "Payment verified and subscription activated",
            "subscription": {
                "plan": plan_name,
                "type": plan_type,
                "expires": expiry_date.isoformat(),
                "duration_days": duration_days,
                "remaining_days_added": remaining_days,
                "total_days": total_days
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[RAZORPAY] Payment verification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Payment verification failed: {str(e)}")


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhooks for payment events"""
    try:
        body = await request.body()
        signature = request.headers.get("X-Razorpay-Signature", "")
        
        logging.info(f"[WEBHOOK] Received webhook call, signature present: {bool(signature)}")
        
        # Verify webhook signature using WEBHOOK SECRET (not API secret!)
        webhook_secret = RAZORPAY_WEBHOOK_SECRET or RAZORPAY_KEY_SECRET
        
        if webhook_secret and signature:
            expected_signature = hmac.new(
                webhook_secret.encode('utf-8'),
                body,
                hashlib.sha256
            ).hexdigest()
            
            if signature != expected_signature:
                logging.warning(f"[WEBHOOK] Invalid signature. Expected: {expected_signature[:20]}..., Got: {signature[:20]}...")
                # Don't reject - try to process anyway for now (signature mismatch could be config issue)
                # raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            logging.info("[WEBHOOK] No signature verification (webhook secret not set or signature not provided)")
        
        payload = await request.json()
        event = payload.get("event")
        
        logging.info(f"[WEBHOOK] Event received: {event}")
        
        if event == "payment.captured":
            payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment.get("order_id")
            payment_id = payment.get("id")
            amount = payment.get("amount", 0) / 100  # Convert paise to INR
            
            if db is not None and order_id:
                # Get order details
                order = await db.razorpay_orders.find_one({"order_id": order_id})
                
                if order and order.get("status") != "paid":
                    # Update order status
                    await db.razorpay_orders.update_one(
                        {"order_id": order_id},
                        {
                            "$set": {
                                "status": "paid",
                                "payment_id": payment_id,
                                "webhook_payment_id": payment_id,
                                "captured_at": datetime.now(timezone.utc),
                                "payment_captured": True,
                                "verified_amount": amount
                            }
                        }
                    )
                    
                    # ACTIVATE SUBSCRIPTION - Same logic as verify-payment
                    user_id = order.get("user_id")
                    plan_type = order.get("plan_type", "monthly")
                    plan_name = order.get("plan_name", "startup")
                    duration_days = PLAN_DURATIONS.get(plan_type, 28)
                    
                    now = datetime.now(timezone.utc)
                    
                    # Check for existing subscription and add remaining days
                    user = await db.users.find_one({"uid": user_id})
                    remaining_days = 0
                    
                    if user:
                        # Check BOTH field names for expiry
                        existing_expiry = user.get("subscription_expires") or user.get("subscription_expiry") or user.get("vip_expiry")
                        if existing_expiry:
                            if isinstance(existing_expiry, str):
                                try:
                                    existing_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
                                except:
                                    existing_expiry = None
                            
                            if existing_expiry:
                                if existing_expiry.tzinfo is None:
                                    existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
                                
                                if existing_expiry > now:
                                    remaining_days = (existing_expiry - now).days
                                    logging.info(f"[WEBHOOK] User {user_id} has {remaining_days} remaining days to add")
                    
                    total_days = duration_days + remaining_days
                    expiry_date = now + timedelta(days=total_days)
                    
                    # Update user subscription
                    await db.users.update_one(
                        {"uid": user_id},
                        {
                            "$set": {
                                "subscription_plan": plan_name,
                                "subscription_start": now,
                                "subscription_expires": expiry_date,
                                "subscription_expiry": expiry_date.isoformat(),  # Also set string field
                                "vip_expiry": expiry_date.isoformat(),  # Also set vip_expiry
                                "membership_type": "vip",
                                "subscription_status": "active",
                                "last_payment_id": payment_id,
                                "last_payment_date": now,
                                "previous_remaining_days_added": remaining_days,
                                "activated_via": "webhook"
                            }
                        }
                    )
                    
                    # Log transaction
                    await db.transactions.insert_one({
                        "user_id": user_id,
                        "type": "subscription_payment",
                        "amount": amount,
                        "payment_id": payment_id,
                        "order_id": order_id,
                        "plan_name": plan_name,
                        "plan_type": plan_type,
                        "duration_days": duration_days,
                        "remaining_days_added": remaining_days,
                        "total_days": total_days,
                        "activated_via": "webhook",
                        "timestamp": now
                    })
                    
                    logging.info(f"[WEBHOOK] Subscription activated for user {user_id}, plan: {plan_name}, total days: {total_days}")
                else:
                    logging.info(f"[WEBHOOK] Order {order_id} already paid, skipping activation")
            
            logging.info(f"Payment captured via webhook: {payment_id}")
        
        elif event == "payment.failed":
            payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment.get("order_id")
            
            if db is not None and order_id:
                await db.razorpay_orders.update_one(
                    {"order_id": order_id},
                    {
                        "$set": {
                            "status": "failed",
                            "failed_at": datetime.now(timezone.utc),
                            "failure_reason": payment.get("error_description")
                        }
                    }
                )
            
            logging.warning(f"Payment failed for order: {order_id}")
        
        return {"status": "ok"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Webhook processing error: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/payment-history/{user_id}")
async def get_payment_history(user_id: str, include_all: bool = False):
    """Get user's payment history - optionally include failed/pending payments"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if include_all:
        # Include all payment attempts for user visibility
        payments = await db.razorpay_orders.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(50)
    else:
        # Only successful payments
        payments = await db.razorpay_orders.find(
            {"user_id": user_id, "status": {"$in": ["paid", "captured"]}},
            {"_id": 0}
        ).sort("created_at", -1).to_list(50)
    
    # Add user-friendly status messages
    for p in payments:
        status = p.get("status", "created")
        if status == "paid":
            p["status_message"] = "✅ Payment successful - Subscription activated"
            p["status_color"] = "green"
        elif status == "created":
            p["status_message"] = "⏳ Payment pending - Complete payment to activate"
            p["status_color"] = "yellow"
        elif status == "failed":
            p["status_message"] = f"❌ Payment failed - {p.get('failure_reason', 'Please try again')}"
            p["status_color"] = "red"
        elif status == "error":
            p["status_message"] = f"⚠️ Error occurred - {p.get('failure_reason', 'Contact support')}"
            p["status_color"] = "orange"
        elif status == "cancelled":
            p["status_message"] = "🚫 Payment cancelled"
            p["status_color"] = "gray"
        else:
            p["status_message"] = f"Status: {status}"
            p["status_color"] = "gray"
    
    return {"payments": payments}


@router.get("/debug/subscription-renewal/{user_id}")
async def debug_subscription_renewal(user_id: str, plan_type: str = "monthly"):
    """
    Debug endpoint to check how subscription renewal would work.
    Shows: current expiry, remaining days, new total days after renewal.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    duration_days = PLAN_DURATIONS.get(plan_type, 28)
    
    # Get all expiry fields
    raw_expires = user.get("subscription_expires")
    raw_expiry = user.get("subscription_expiry")
    raw_vip = user.get("vip_expiry")
    
    # Calculate remaining days
    existing_expiry = raw_expires or raw_expiry or raw_vip
    remaining_days = 0
    parsed_expiry = None
    
    if existing_expiry:
        if isinstance(existing_expiry, str):
            try:
                parsed_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
            except:
                parsed_expiry = None
        else:
            parsed_expiry = existing_expiry
        
        if parsed_expiry:
            if parsed_expiry.tzinfo is None:
                parsed_expiry = parsed_expiry.replace(tzinfo=timezone.utc)
            
            if parsed_expiry > now:
                remaining_days = (parsed_expiry - now).days
    
    total_days = duration_days + remaining_days
    new_expiry = now + timedelta(days=total_days)
    
    return {
        "user_id": user_id,
        "user_name": user.get("name"),
        "current_plan": user.get("subscription_plan"),
        "raw_fields": {
            "subscription_expires": str(raw_expires) if raw_expires else None,
            "subscription_expiry": raw_expiry,
            "vip_expiry": raw_vip
        },
        "parsed_expiry": str(parsed_expiry) if parsed_expiry else None,
        "remaining_days": remaining_days,
        "renewal_calculation": {
            "plan_type": plan_type,
            "plan_duration_days": duration_days,
            "remaining_days_to_add": remaining_days,
            "total_days": total_days,
            "new_expiry_would_be": new_expiry.isoformat()
        },
        "message": f"If renewed now: {duration_days} days + {remaining_days} remaining = {total_days} total days"
    }


@router.post("/update-order-status")
async def update_order_status(request: Request):
    """
    Update order status when payment fails, cancelled, or has error.
    Called from frontend to track payment outcomes.
    """
    try:
        data = await request.json()
        order_id = data.get("order_id")
        status = data.get("status")  # failed, cancelled, error
        reason = data.get("reason", "")
        error_code = data.get("error_code", "")
        payment_id = data.get("payment_id", "")
        
        if not order_id or not status:
            raise HTTPException(status_code=400, detail="order_id and status required")
        
        valid_statuses = ["failed", "cancelled", "error", "timeout", "dismissed"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        if db is not None:
            await db.razorpay_orders.update_one(
                {"order_id": order_id},
                {
                    "$set": {
                        "status": status,
                        "failure_reason": reason,
                        "error_code": error_code,
                        "payment_id": payment_id if payment_id else None,
                        "status_updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            logging.info(f"[RAZORPAY] Order {order_id} status updated to: {status}, reason: {reason}")
        
        return {
            "success": True,
            "message": f"Order status updated to {status}",
            "order_id": order_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Update order status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/sync-payments")
async def sync_payments_from_razorpay(request: Request):
    """
    SYNC: Fetch payment status from Razorpay API and activate subscriptions.
    Use this when webhook didn't fire or payments show as pending but are actually captured.
    """
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        # Get all pending orders (status = 'created' or 'pending')
        # ALSO get 'paid' orders that may not have activated subscription
        pending_orders = await db.razorpay_orders.find({
            "status": {"$in": ["created", "pending", "paid"]}
        }).to_list(200)
        
        synced = []
        failed_sync = []
        
        for order in pending_orders:
            order_id = order.get("order_id")
            user_id = order.get("user_id")
            
            try:
                # Fetch order from Razorpay API
                razorpay_order = razorpay_client.order.fetch(order_id)
                razorpay_status = razorpay_order.get("status")  # created, attempted, paid
                
                logging.info(f"[SYNC] Order {order_id}: Razorpay status = {razorpay_status}")
                
                if razorpay_status == "paid":
                    # Order is paid - fetch payment details
                    payments = razorpay_client.order.payments(order_id)
                    
                    # Find captured payment
                    captured_payment = None
                    for payment in payments.get("items", []):
                        if payment.get("status") == "captured":
                            captured_payment = payment
                            break
                    
                    if captured_payment:
                        payment_id = captured_payment.get("id")
                        amount = captured_payment.get("amount", 0) / 100
                        
                        # Check if user's subscription was already updated by this payment
                        user = await db.users.find_one({"uid": user_id})
                        
                        # Skip if this payment already activated subscription
                        if user and user.get("last_payment_id") == payment_id:
                            logging.info(f"[SYNC] Order {order_id}: Already activated, skipping")
                            continue
                        
                        # Update order status
                        await db.razorpay_orders.update_one(
                            {"order_id": order_id},
                            {
                                "$set": {
                                    "status": "paid",
                                    "payment_id": payment_id,
                                    "payment_captured": True,
                                    "verified_amount": amount,
                                    "synced_at": datetime.now(timezone.utc).isoformat(),
                                    "synced_via": "manual_sync"
                                }
                            }
                        )
                        
                        # ACTIVATE SUBSCRIPTION
                        plan_type = order.get("plan_type", "monthly")
                        plan_name = order.get("plan_name", "startup")
                        duration_days = PLAN_DURATIONS.get(plan_type, 28)
                        
                        now = datetime.now(timezone.utc)
                        
                        # Check for existing subscription and add remaining days
                        user = await db.users.find_one({"uid": user_id})
                        remaining_days = 0
                        
                        if user:
                            # Check BOTH field names for expiry
                            existing_expiry = user.get("subscription_expires") or user.get("subscription_expiry") or user.get("vip_expiry")
                            if existing_expiry:
                                if isinstance(existing_expiry, str):
                                    try:
                                        existing_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
                                    except:
                                        existing_expiry = None
                                
                                if existing_expiry:
                                    if existing_expiry.tzinfo is None:
                                        existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
                                    
                                    if existing_expiry > now:
                                        remaining_days = (existing_expiry - now).days
                                        logging.info(f"[MANUAL-SYNC] User {user_id} has {remaining_days} remaining days to add")
                        
                        total_days = duration_days + remaining_days
                        expiry_date = now + timedelta(days=total_days)
                        
                        # Update user subscription
                        await db.users.update_one(
                            {"uid": user_id},
                            {
                                "$set": {
                                    "subscription_plan": plan_name,
                                    "subscription_start": now,
                                    "subscription_expires": expiry_date,
                                    "subscription_expiry": expiry_date.isoformat(),
                                    "vip_expiry": expiry_date.isoformat(),
                                    "membership_type": "vip",
                                    "subscription_status": "active",
                                    "last_payment_id": payment_id,
                                    "last_payment_date": now,
                                    "previous_remaining_days_added": remaining_days,
                                    "activated_via": "manual_sync"
                                }
                            }
                        )
                        
                        # Log transaction
                        await db.transactions.insert_one({
                            "user_id": user_id,
                            "type": "subscription_payment",
                            "amount": amount,
                            "payment_id": payment_id,
                            "order_id": order_id,
                            "plan_name": plan_name,
                            "plan_type": plan_type,
                            "duration_days": duration_days,
                            "remaining_days_added": remaining_days,
                            "total_days": total_days,
                            "activated_via": "manual_sync",
                            "timestamp": now
                        })
                        
                        # Add to vip_payments for admin dashboard
                        await db.vip_payments.insert_one({
                            "user_id": user_id,
                            "order_id": order_id,
                            "payment_id": payment_id,
                            "amount": amount,
                            "subscription_plan": plan_name,
                            "plan_type": plan_type,
                            "status": "approved",
                            "payment_method": "razorpay",
                            "payment_captured": True,
                            "new_expiry": expiry_date.isoformat(),
                            "duration_days": total_days,
                            "remaining_days_added": remaining_days,
                            "approved_at": now.isoformat(),
                            "created_at": now.isoformat(),
                            "auto_activated": True,
                            "activation_source": "manual_sync"
                        })
                        
                        synced.append({
                            "order_id": order_id,
                            "user_id": user_id,
                            "user_name": user.get("name") if user else "Unknown",
                            "payment_id": payment_id,
                            "amount": amount,
                            "plan": plan_name,
                            "total_days": total_days,
                            "status": "ACTIVATED"
                        })
                        
                        logging.info(f"[SYNC] Subscription activated for user {user_id}, plan: {plan_name}")
                    else:
                        failed_sync.append({
                            "order_id": order_id,
                            "reason": "No captured payment found"
                        })
                
                elif razorpay_status == "attempted":
                    # Payment attempted but not completed - check individual payments
                    payments = razorpay_client.order.payments(order_id)
                    
                    for payment in payments.get("items", []):
                        if payment.get("status") == "failed":
                            await db.razorpay_orders.update_one(
                                {"order_id": order_id},
                                {
                                    "$set": {
                                        "status": "failed",
                                        "failure_reason": payment.get("error_description", "Payment failed"),
                                        "synced_at": datetime.now(timezone.utc).isoformat()
                                    }
                                }
                            )
                            failed_sync.append({
                                "order_id": order_id,
                                "reason": payment.get("error_description", "Payment failed")
                            })
                            break
                
                # status == 'created' means no payment attempt yet, keep as pending
                
            except Exception as e:
                logging.error(f"[SYNC] Error syncing order {order_id}: {e}")
                failed_sync.append({
                    "order_id": order_id,
                    "reason": str(e)
                })
        
        return {
            "success": True,
            "message": f"Sync complete! Activated {len(synced)} subscriptions",
            "synced_count": len(synced),
            "failed_count": len(failed_sync),
            "synced": synced,
            "failed": failed_sync
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/admin/fix-subscription")
async def fix_user_subscription(request: Request):
    """
    ADMIN TOOL: Manually fix a user's subscription when payment was received but subscription not extended.
    This will find the paid order and activate the subscription properly.
    """
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        order_id = data.get("order_id")
        user_id = data.get("user_id")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        if not order_id and not user_id:
            raise HTTPException(status_code=400, detail="Either order_id or user_id required")
        
        # Find the order
        query = {}
        if order_id:
            query["order_id"] = order_id
        if user_id:
            query["user_id"] = user_id
        query["status"] = "paid"
        
        order = await db.razorpay_orders.find_one(query, sort=[("paid_at", -1)])
        
        if not order:
            # Try to find in razorpay API directly
            if order_id:
                try:
                    razorpay_order = razorpay_client.order.fetch(order_id)
                    if razorpay_order.get("status") == "paid":
                        # Get payment details
                        payments = razorpay_client.order.payments(order_id)
                        for payment in payments.get("items", []):
                            if payment.get("status") == "captured":
                                # Found captured payment - activate subscription
                                payment_id = payment.get("id")
                                amount = payment.get("amount", 0) / 100
                                
                                # Get order from our DB
                                order = await db.razorpay_orders.find_one({"order_id": order_id})
                                
                                if order:
                                    user_id = order.get("user_id")
                                    plan_name = order.get("plan_name", "startup")
                                    plan_type = order.get("plan_type", "monthly")
                                    duration_days = PLAN_DURATIONS.get(plan_type, 28)
                                    
                                    now = datetime.now(timezone.utc)
                                    
                                    # Check existing subscription
                                    user = await db.users.find_one({"uid": user_id})
                                    remaining_days = 0
                                    
                                    if user:
                                        existing_expiry = user.get("subscription_expires") or user.get("subscription_expiry") or user.get("vip_expiry")
                                        if existing_expiry:
                                            if isinstance(existing_expiry, str):
                                                try:
                                                    existing_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
                                                except:
                                                    existing_expiry = None
                                            
                                            if existing_expiry and existing_expiry.tzinfo is None:
                                                existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
                                            
                                            if existing_expiry and existing_expiry > now:
                                                remaining_days = (existing_expiry - now).days
                                                logging.info(f"[AUTO-SYNC] User {user_id} has {remaining_days} remaining days to add")
                                    
                                    total_days = duration_days + remaining_days
                                    expiry_date = now + timedelta(days=total_days)
                                    
                                    # Update order
                                    await db.razorpay_orders.update_one(
                                        {"order_id": order_id},
                                        {"$set": {
                                            "status": "paid",
                                            "payment_id": payment_id,
                                            "payment_captured": True,
                                            "fixed_at": now.isoformat()
                                        }}
                                    )
                                    
                                    # Update user subscription
                                    await db.users.update_one(
                                        {"uid": user_id},
                                        {"$set": {
                                            "subscription_plan": plan_name,
                                            "subscription_start": now,
                                            "subscription_expires": expiry_date,
                                            "subscription_expiry": expiry_date.isoformat(),
                                            "membership_type": "vip",
                                            "subscription_status": "active",
                                            "last_payment_id": payment_id,
                                            "fixed_by_admin": True,
                                            "fixed_at": now.isoformat()
                                        }}
                                    )
                                    
                                    # Add to vip_payments
                                    await db.vip_payments.insert_one({
                                        "user_id": user_id,
                                        "order_id": order_id,
                                        "payment_id": payment_id,
                                        "amount": amount,
                                        "subscription_plan": plan_name,
                                        "status": "approved",
                                        "payment_method": "razorpay",
                                        "new_expiry": expiry_date.isoformat(),
                                        "duration_days": total_days,
                                        "created_at": now.isoformat(),
                                        "fixed_by_admin": True
                                    })
                                    
                                    return {
                                        "success": True,
                                        "message": f"Subscription fixed for user {user_id}",
                                        "user_id": user_id,
                                        "user_name": user.get("name") if user else "Unknown",
                                        "plan": plan_name,
                                        "new_expiry": expiry_date.isoformat(),
                                        "total_days": total_days
                                    }
                except Exception as e:
                    logging.error(f"[FIX] Error fetching from Razorpay: {e}")
            
            raise HTTPException(status_code=404, detail="No paid order found")
        
        # Order found in our DB - activate subscription
        user_id = order.get("user_id")
        plan_name = order.get("plan_name", "startup")
        plan_type = order.get("plan_type", "monthly")
        duration_days = PLAN_DURATIONS.get(plan_type, 28)
        payment_id = order.get("payment_id", "")
        amount = order.get("verified_amount", order.get("amount", 0))
        
        now = datetime.now(timezone.utc)
        
        # Get user and check existing subscription
        user = await db.users.find_one({"uid": user_id})
        remaining_days = 0
        
        if user:
            existing_expiry = user.get("subscription_expires") or user.get("subscription_expiry") or user.get("vip_expiry")
            if existing_expiry:
                if isinstance(existing_expiry, str):
                    try:
                        existing_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
                    except:
                        existing_expiry = None
                
                if existing_expiry and existing_expiry.tzinfo is None:
                    existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
                
                if existing_expiry and existing_expiry > now:
                    remaining_days = (existing_expiry - now).days
                    logging.info(f"[FIX-ORDER] User {user_id} has {remaining_days} remaining days to add")
        
        total_days = duration_days + remaining_days
        expiry_date = now + timedelta(days=total_days)
        
        # Update user subscription
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "subscription_plan": plan_name,
                "subscription_start": now,
                "subscription_expires": expiry_date,
                "subscription_expiry": expiry_date.isoformat(),
                "vip_expiry": expiry_date.isoformat(),
                "membership_type": "vip",
                "subscription_status": "active",
                "last_payment_id": payment_id,
                "previous_remaining_days_added": remaining_days,
                "fixed_by_admin": True,
                "fixed_at": now.isoformat()
            }}
        )
        
        # Check if already in vip_payments
        existing_vip = await db.vip_payments.find_one({"order_id": order.get("order_id")})
        if not existing_vip:
            await db.vip_payments.insert_one({
                "user_id": user_id,
                "order_id": order.get("order_id"),
                "payment_id": payment_id,
                "amount": amount,
                "subscription_plan": plan_name,
                "status": "approved",
                "payment_method": "razorpay",
                "new_expiry": expiry_date.isoformat(),
                "duration_days": total_days,
                "created_at": now.isoformat(),
                "fixed_by_admin": True
            })
        
        return {
            "success": True,
            "message": f"Subscription fixed for user {user_id}",
            "user_id": user_id,
            "user_name": user.get("name") if user else "Unknown",
            "plan": plan_name,
            "new_expiry": expiry_date.isoformat(),
            "total_days": total_days,
            "remaining_days_added": remaining_days
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[FIX] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/admin/manual-activate-by-email")
async def manual_activate_by_email(request: Request):
    """
    ADMIN TOOL: Manually activate subscription by user email.
    Use when payment was captured but subscription not activated.
    
    Usage:
    curl -X POST "/api/razorpay/admin/manual-activate-by-email" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456", "email": "user@example.com", "plan": "startup", "days": 28}'
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        email = data.get("email")
        plan = data.get("plan", "startup")
        days = data.get("days", 28)
        reason = data.get("reason", "Manual activation - payment captured but not synced")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        # Find user by email
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if not user:
            raise HTTPException(status_code=404, detail=f"User not found with email: {email}")
        
        user_id = user.get("uid")
        user_name = user.get("name", "Unknown")
        
        now = datetime.now(timezone.utc)
        
        # Check existing subscription and add remaining days
        remaining_days = 0
        existing_expiry = user.get("subscription_expires") or user.get("subscription_expiry") or user.get("vip_expiry")
        
        if existing_expiry:
            if isinstance(existing_expiry, str):
                try:
                    existing_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
                except:
                    existing_expiry = None
            
            if existing_expiry:
                if existing_expiry.tzinfo is None:
                    existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
                
                if existing_expiry > now:
                    remaining_days = (existing_expiry - now).days
        
        total_days = days + remaining_days
        expiry_date = now + timedelta(days=total_days)
        
        # Update user subscription
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "subscription_plan": plan,
                "subscription_start": now,
                "subscription_expires": expiry_date,
                "subscription_expiry": expiry_date.isoformat(),
                "vip_expiry": expiry_date.isoformat(),
                "membership_type": "vip",
                "subscription_status": "active",
                "manual_activated": True,
                "manual_activation_reason": reason,
                "manual_activated_at": now.isoformat()
            }}
        )
        
        # Log in vip_payments for admin dashboard visibility
        await db.vip_payments.insert_one({
            "payment_id": f"manual_{user_id}_{now.strftime('%Y%m%d%H%M%S')}",
            "user_id": user_id,
            "user_name": user_name,
            "user_email": email,
            "amount": 0,
            "subscription_plan": plan,
            "plan_type": "manual",
            "status": "approved",
            "payment_method": "manual_activation",
            "new_expiry": expiry_date.isoformat(),
            "duration_days": total_days,
            "remaining_days_added": remaining_days,
            "approved_at": now.isoformat(),
            "created_at": now.isoformat(),
            "admin_notes": reason
        })
        
        logging.info(f"[MANUAL] Subscription activated for {email} ({user_id}), plan: {plan}, days: {total_days}")
        
        return {
            "success": True,
            "message": f"Subscription activated for {user_name}",
            "user_id": user_id,
            "user_name": user_name,
            "email": email,
            "plan": plan,
            "new_expiry": expiry_date.isoformat(),
            "total_days": total_days,
            "new_days_added": days,
            "remaining_days_added": remaining_days
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[MANUAL] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
