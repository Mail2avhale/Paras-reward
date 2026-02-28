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

if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
else:
    razorpay_client = None
    logging.warning("Razorpay credentials not configured")

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
            existing_expiry = user.get("subscription_expires") or user.get("subscription_expiry") or user.get("vip_expiry")
            
            if existing_expiry:
                old_expiry_str = str(existing_expiry)
                
                # Handle both datetime object and string
                if isinstance(existing_expiry, str):
                    try:
                        existing_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
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
                        logging.info(f"[RAZORPAY] User {request.user_id} has {remaining_days} days remaining from {old_plan}, will be added to new plan")
        
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
        
        # Verify webhook signature
        if RAZORPAY_KEY_SECRET:
            expected_signature = hmac.new(
                RAZORPAY_KEY_SECRET.encode('utf-8'),
                body,
                hashlib.sha256
            ).hexdigest()
            
            if signature != expected_signature:
                logging.warning("Invalid webhook signature")
                raise HTTPException(status_code=400, detail="Invalid signature")
        
        payload = await request.json()
        event = payload.get("event")
        
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
                        existing_expiry = user.get("subscription_expires")
                        if existing_expiry:
                            if isinstance(existing_expiry, str):
                                try:
                                    existing_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
                                except:
                                    existing_expiry = None
                            
                            if existing_expiry and existing_expiry > now:
                                remaining_days = (existing_expiry - now).days
                    
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
                                "membership_type": "vip",
                                "subscription_status": "active",
                                "last_payment_id": payment_id,
                                "last_payment_date": now,
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
async def get_payment_history(user_id: str):
    """Get user's payment history"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    payments = await db.razorpay_orders.find(
        {"user_id": user_id, "status": {"$in": ["paid", "captured"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"payments": payments}


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
        
        # Get all pending orders (status = 'created')
        pending_orders = await db.razorpay_orders.find({
            "status": {"$in": ["created", "pending"]}
        }).to_list(100)
        
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
                            existing_expiry = user.get("subscription_expires")
                            if existing_expiry:
                                if isinstance(existing_expiry, str):
                                    try:
                                        existing_expiry = datetime.fromisoformat(existing_expiry.replace('Z', '+00:00'))
                                    except:
                                        existing_expiry = None
                                
                                if existing_expiry and existing_expiry > now:
                                    remaining_days = (existing_expiry - now).days
                        
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
                                    "membership_type": "vip",
                                    "subscription_status": "active",
                                    "last_payment_id": payment_id,
                                    "last_payment_date": now,
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
