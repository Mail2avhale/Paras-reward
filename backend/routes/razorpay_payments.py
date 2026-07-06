"""
Razorpay Payment Gateway Integration
- Create orders for Elite subscriptions
- Verify payments with DOUBLE VERIFICATION
- Handle webhooks
VERSION: 2.0 - With payment status verification from Razorpay API
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
try:
    import razorpay
    _HAS_RAZORPAY = True
except ImportError:
    razorpay = None
    _HAS_RAZORPAY = False
    print("[STARTUP] razorpay not installed - payment features disabled")
import os
import hmac
import hashlib
import asyncio
import time as _time
from datetime import datetime, timezone, timedelta
import logging

from utils.subscription_expiry import get_user_expiry

router = APIRouter(prefix="/razorpay", tags=["Razorpay Payments"])

# Lightweight in-process cache for the heavy revenue-dashboard endpoint.
# 60 s TTL — admin dashboard refresh stays sub-second after first load.
_REVENUE_DASHBOARD_CACHE: dict = {"data": None, "ts": 0.0}
_REVENUE_DASHBOARD_TTL = 60.0

# Code version for deployment verification
CODE_VERSION = "2.0-SECURE"

# Initialize Razorpay client
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET")

if _HAS_RAZORPAY and RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
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
    # Additional user details for better payment verification
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_mobile: Optional[str] = None


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
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


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
        # Fetch user details from database for better payment verification
        user_data = None
        if db is not None:
            user_data = await db.users.find_one({"uid": request.user_id}, {"_id": 0, "name": 1, "email": 1, "mobile": 1, "full_name": 1})
        
        # Use provided details or fallback to database
        customer_name = request.user_name or (user_data.get("full_name") if user_data else None) or (user_data.get("name") if user_data else None) or "Customer"
        customer_email = request.user_email or (user_data.get("email") if user_data else None) or ""
        customer_mobile = request.user_mobile or (user_data.get("mobile") if user_data else None) or ""
        
        # Convert amount to paise (Razorpay uses smallest currency unit)
        amount_paise = int(request.amount * 100)
        
        # Create Razorpay order with enhanced notes for better verification
        # Receipt must be <= 40 chars
        receipt_id = f"sub_{request.user_id[-8:]}_{datetime.now().strftime('%m%d%H%M%S')}"
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt_id,
            "notes": {
                "user_id": request.user_id,
                "plan_type": request.plan_type,
                "plan_name": request.plan_name,
                "customer_name": customer_name,
                "customer_email": customer_email,
                "customer_mobile": customer_mobile,
                "product": f"Elite {request.plan_type} Subscription",
                "merchant": "PARAS REWARD"
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        # Save order to database with user details
        if db is not None:
            await db.razorpay_orders.insert_one({
                "order_id": order["id"],
                "user_id": request.user_id,
                "user_name": customer_name,
                "user_email": customer_email,
                "user_mobile": customer_mobile,
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
        raise HTTPException(status_code=500, detail="Failed to create payment order. Please try again.")


@router.post("/verify-payment")
async def verify_razorpay_payment(request: VerifyPaymentRequest):
    """Verify payment signature and activate subscription - WITH DOUBLE VERIFICATION"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    try:
        # ==================== SECURITY: Rate Limiting ====================
        # Check if this order_id has been verified too many times (prevent replay attacks)
        if db is not None:
            verify_attempts = await db.razorpay_verify_attempts.count_documents({
                "order_id": request.razorpay_order_id,
                "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(minutes=5)}
            })
            if verify_attempts >= 5:
                logging.warning(f"[RAZORPAY] Rate limit exceeded for order {request.razorpay_order_id}")
                raise HTTPException(status_code=429, detail="Too many verification attempts. Please wait.")
            
            # Log this attempt
            await db.razorpay_verify_attempts.insert_one({
                "order_id": request.razorpay_order_id,
                "payment_id": request.razorpay_payment_id,
                "user_id": request.user_id,
                "timestamp": datetime.now(timezone.utc)
            })
        
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
        
        # ==================== STEP 4.1: CHECK ORDER NOT CANCELLED ====================
        # CRITICAL FIX: Do NOT activate subscription for cancelled/failed orders
        if order.get("status") in ["cancelled", "failed", "error", "timeout", "dismissed"]:
            logging.warning(f"[RAZORPAY] BLOCKED - Order {request.razorpay_order_id} is {order.get('status')} - NOT activating")
            raise HTTPException(status_code=400, detail=f"This order was {order.get('status')}. Cannot activate subscription.")
        
        # ==================== STEP 4.2: CHECK ORDER NOT ALREADY USED ====================
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
        
        # ==================== STEP 5.1: CHECK IF USER ALREADY HAS THIS PAYMENT ====================
        # CRITICAL FIX: Check if this payment_id already activated subscription for this user
        user_with_this_payment = await db.users.find_one({
            "uid": request.user_id,
            "last_payment_id": request.razorpay_payment_id
        })
        if user_with_this_payment:
            logging.info(f"[RAZORPAY] Payment {request.razorpay_payment_id} already activated for user {request.user_id}, returning success")
            # Return success without re-activating
            return {
                "success": True,
                "message": "Payment already verified and subscription active",
                "already_activated": True,
                "subscription": {
                    "plan": user_with_this_payment.get("subscription_plan"),
                    "expires": str(user_with_this_payment.get("subscription_expiry") or "")
                }
            }
        
        # ==================== STEP 5.2: ATOMIC CLAIM - PREVENT RACE CONDITION ====================
        # Use atomic findOneAndUpdate to claim this order/payment
        # FIXED: Single atomic operation that marks order as paid immediately
        claim_result = await db.razorpay_orders.find_one_and_update(
            {
                "order_id": request.razorpay_order_id,
                "status": {"$nin": ["paid", "processing"]},  # Not paid or being processed
                "$or": [
                    {"payment_id": {"$exists": False}},
                    {"payment_id": None},
                    {"payment_id": request.razorpay_payment_id}  # Allow if same payment
                ]
            },
            {
                "$set": {
                    "status": "processing",  # Mark as processing immediately
                    "payment_id": request.razorpay_payment_id,
                    "claimed_at": datetime.now(timezone.utc),
                    "claimed_by": "verify_payment"
                }
            }
        )
        
        if not claim_result:
            logging.warning(f"[RAZORPAY] RACE CONDITION BLOCKED - Order {request.razorpay_order_id} already being processed")
            # Check if it was just activated
            check_order = await db.razorpay_orders.find_one({"order_id": request.razorpay_order_id})
            if check_order and check_order.get("status") in ["paid", "processing"]:
                # Check if user has the subscription
                user_check = await db.users.find_one({"uid": request.user_id, "last_payment_id": request.razorpay_payment_id})
                if user_check:
                    return {
                        "success": True,
                        "message": "Payment already processed successfully",
                        "already_activated": True
                    }
                raise HTTPException(status_code=400, detail="Payment already processed successfully")
            raise HTTPException(status_code=400, detail="Order is being processed. Please wait.")
        
        # ==================== STEP 6: VERIFY AMOUNT MATCHES ====================
        expected_amount = order.get("amount", 0)
        if abs(payment_amount - expected_amount) > 1:  # Allow ₹1 tolerance
            logging.warning(f"[RAZORPAY] Amount mismatch: expected {expected_amount}, got {payment_amount}")
            # ROLLBACK: Reset order status since verification failed
            await db.razorpay_orders.update_one(
                {"order_id": request.razorpay_order_id, "status": "processing"},
                {"$set": {"status": "created", "rollback_reason": "amount_mismatch", "rollback_at": datetime.now(timezone.utc)}}
            )
            raise HTTPException(status_code=400, detail="Payment amount mismatch")
        
        # ==================== STEP 6.1: VERIFY USER EXISTS ====================
        # CRITICAL: Check user exists before any activation
        user = await db.users.find_one({"uid": request.user_id})
        if not user:
            logging.error(f"[RAZORPAY] CRITICAL - User not found: {request.user_id}")
            # ROLLBACK: Reset order status since user doesn't exist
            await db.razorpay_orders.update_one(
                {"order_id": request.razorpay_order_id, "status": "processing"},
                {"$set": {"status": "created", "rollback_reason": "user_not_found", "rollback_at": datetime.now(timezone.utc)}}
            )
            raise HTTPException(status_code=404, detail="User not found. Please contact support.")
        
        # ==================== STEP 7: ACTIVATE USER SUBSCRIPTION FIRST ====================
        # IMPORTANT: Activate subscription BEFORE marking order as paid (safer sequence)
        plan_type = order.get("plan_type", "monthly")
        plan_name = order.get("plan_name", "startup")
        duration_days = PLAN_DURATIONS.get(plan_type, 28)
        
        now = datetime.now(timezone.utc)
        
        # Check if user has existing active subscription - ADD remaining days
        remaining_days = 0
        old_plan = None
        old_expiry_str = None
        
        old_plan = user.get("subscription_plan")

        # Canonical expiry (helper falls back to legacy fields for un-migrated rows)
        existing_expiry = get_user_expiry(user)
        raw_expiry = user.get("subscription_expiry")
        logging.info(f"[RAZORPAY] User {request.user_id} expiry - canonical: {raw_expiry}")

        if existing_expiry:
            old_expiry_str = existing_expiry.isoformat()

            # Make sure existing_expiry is timezone aware
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
                    "subscription_expiry": expiry_date.isoformat(),
                    "subscription_status": "active",
                    "subscription_payment_type": "cash",
                    "last_payment_id": request.razorpay_payment_id,
                    "last_payment_date": now,
                    "previous_plan": old_plan,
                    "previous_remaining_days_added": remaining_days,
                    "previous_expiry": old_expiry_str
                }
            }
        )
        
        # ==================== STEP 9: LOG TRANSACTION (IDEMPOTENT) ====================
        # Check if transaction already exists to prevent duplicates
        existing_txn = await db.transactions.find_one({"payment_id": request.razorpay_payment_id, "type": "subscription_payment"})
        if not existing_txn:
            try:
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
            except Exception as txn_error:
                logging.warning(f"[RAZORPAY] Transaction insert error (non-fatal): {txn_error}")
        
        # ==================== STEP 10: ADD TO VIP_PAYMENTS (IDEMPOTENT) ====================
        # Check if vip_payment already exists to prevent duplicates
        existing_vip = await db.vip_payments.find_one({"payment_id": request.razorpay_payment_id})
        if not existing_vip:
            try:
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
            except Exception as vip_error:
                logging.warning(f"[RAZORPAY] VIP payment insert error (non-fatal): {vip_error}")
        
        # ==================== STEP 11: GENERATE GST INVOICE ====================
        try:
            from routes.gst_invoice import calculate_gst, get_next_invoice_number, generate_invoice_pdf
            import base64
            
            # Check if invoice already exists
            existing_invoice = await db.invoices.find_one({"payment_id": request.razorpay_payment_id})
            
            if not existing_invoice:
                # Get user details
                user = await db.users.find_one({"uid": request.user_id})
                
                # Generate invoice number
                invoice_number = await get_next_invoice_number()
                invoice_id = f"INV_{now.strftime('%Y%m%d%H%M%S')}_{request.user_id[:8]}"
                
                # Calculate GST
                gst_breakdown = calculate_gst(payment_amount)
                
                # Prepare invoice data
                invoice_data = {
                    "invoice_id": invoice_id,
                    "invoice_number": invoice_number,
                    "user_id": request.user_id,
                    "customer_name": user.get("name", "Customer") if user else "Customer",
                    "customer_email": user.get("email", "") if user else "",
                    "customer_phone": user.get("phone", "") if user else "",
                    "payment_id": request.razorpay_payment_id,
                    "order_id": request.razorpay_order_id,
                    "plan_name": plan_name,
                    "plan_type": plan_type,
                    "amount": payment_amount,
                    "gst_breakdown": gst_breakdown,
                    "date": now.strftime("%d-%m-%Y"),
                    "created_at": now.isoformat(),
                    "company": {
                        "name": "PARAS REWARD TECHNOLOGIES PRIVATE LIMITED",
                        "gstin": "27AAQCP6686E1ZR",
                        "address": "Maharashtra, India"
                    }
                }
                
                # Generate PDF
                try:
                    pdf_bytes = generate_invoice_pdf(invoice_data)
                    invoice_data["pdf_base64"] = base64.b64encode(pdf_bytes).decode('utf-8')
                except Exception as pdf_error:
                    logging.error(f"[INVOICE] PDF generation error: {pdf_error}")
                
                # Save invoice
                await db.invoices.insert_one(invoice_data)
                logging.info(f"[INVOICE] Generated invoice {invoice_number} for payment {request.razorpay_payment_id}")
            else:
                logging.info(f"[INVOICE] Invoice already exists for payment {request.razorpay_payment_id}")
                
        except Exception as invoice_error:
            logging.error(f"[INVOICE] Invoice generation error: {invoice_error}")
            # Don't fail payment verification if invoice generation fails
        
        # ==================== STEP 12: MARK ORDER AS PAID (AFTER SUBSCRIPTION SUCCESS) ====================
        # IMPORTANT: Only mark as paid AFTER subscription is successfully activated
        # Get actual payment timestamp from Razorpay (created_at is in Unix timestamp)
        razorpay_payment_time = None
        try:
            if payment_details.get("created_at"):
                razorpay_payment_time = datetime.fromtimestamp(payment_details["created_at"], tz=timezone.utc)
        except Exception as e:
            logging.warning(f"[RAZORPAY] Could not parse payment timestamp: {e}")
            razorpay_payment_time = datetime.now(timezone.utc)
        
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
                    "paid_at": razorpay_payment_time or datetime.now(timezone.utc),
                    "razorpay_payment_time": razorpay_payment_time,  # Original Razorpay timestamp
                    "verified_at": datetime.now(timezone.utc),  # When we verified
                    "subscription_activated": True,
                    # Store additional payment details for reference
                    "payment_method": payment_details.get("method"),
                    "payment_bank": payment_details.get("bank"),
                    "payment_wallet": payment_details.get("wallet"),
                    "payment_vpa": payment_details.get("vpa"),  # UPI ID
                    "payment_card_last4": payment_details.get("card", {}).get("last4") if payment_details.get("card") else None,
                    "acquirer_data": payment_details.get("acquirer_data", {})  # Contains UTR for bank transfers
                }
            }
        )
        
        logging.info(f"[RAZORPAY] SUCCESS - Subscription activated for user {request.user_id}, plan: {plan_name}, total days: {total_days}")

        # ==================== STEP 13: ASSIGN SUBSCRIPTION POSITION (Mining Network) ====================
        # CRITICAL FIX (May 2026): Previously missing here — caused users who paid via
        # Razorpay popup to have subscription_position=None, which made
        # get_subscription_network_size() return 0 (mining Network Size stuck at 0).
        try:
            from routes.mining import assign_subscription_position
            await assign_subscription_position(request.user_id)
            logging.info(f"[RAZORPAY] Assigned subscription_position for {request.user_id}")
        except Exception as _pos_err:
            logging.warning(f"[RAZORPAY] assign_subscription_position failed (non-fatal): {_pos_err}")

        # ==================== STEP 14: COMMUNITY SUCCESS-STORY POST ====================
        # CRITICAL FIX (May 2026): Previously missing here — caused users who paid via
        # Razorpay popup to NOT appear in Community Forum Live Wins feed. Admin
        # bulk-sync / manual-activate paths already did this; user-facing path
        # was the only one without the hook.
        try:
            from routes.community import create_success_story_post
            asyncio.create_task(create_success_story_post(
                user_id=request.user_id,
                service_type="subscription",
                amount_inr=float(payment_amount or 0),
                plan_name=plan_name,
                ref_id=f"sub_{request.razorpay_payment_id}",
            ))
        except Exception as _post_err:
            logging.warning(f"[RAZORPAY] community post hook failed (non-fatal): {_post_err}")

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
        # ROLLBACK: If any unexpected error, reset order status so user can retry
        try:
            await db.razorpay_orders.update_one(
                {"order_id": request.razorpay_order_id, "status": "processing"},
                {"$set": {"status": "created", "rollback_reason": f"error: {str(e)[:100]}", "rollback_at": datetime.now(timezone.utc)}}
            )
            logging.info(f"[RAZORPAY] Rolled back order {request.razorpay_order_id} to created status")
        except Exception as rollback_error:
            logging.error(f"[RAZORPAY] Rollback failed: {rollback_error}")
        raise HTTPException(status_code=500, detail="Payment verification failed. Please contact support if amount was deducted.")


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhooks for payment events - WITH IDEMPOTENCY

    SECURITY (Feb 2026): This endpoint is UNAUTHENTICATED (Razorpay servers
    call it — no user JWT). Therefore signature verification is MANDATORY.
    Historical behaviour allowed payloads through when signature/secret was
    missing → attacker could forge `payment.captured` events and activate
    subscriptions without paying. FIXED: strict signature check, no bypass.
    """
    try:
        body = await request.body()
        signature = request.headers.get("X-Razorpay-Signature", "")

        logging.info(f"[WEBHOOK] Received webhook call, signature present: {bool(signature)}")

        # Verify webhook signature using WEBHOOK SECRET (not API secret!)
        webhook_secret = RAZORPAY_WEBHOOK_SECRET or RAZORPAY_KEY_SECRET

        # ── HARD-REQUIRE both webhook_secret AND signature. ────────────
        # If either is missing, REJECT — never fall through to activation.
        # A misconfigured server (missing RAZORPAY_WEBHOOK_SECRET) MUST fail
        # closed rather than fail open. Rejects fake webhook attacks that
        # send an empty / spoofed X-Razorpay-Signature header.
        if not webhook_secret:
            logging.error("[WEBHOOK] Rejected: RAZORPAY_WEBHOOK_SECRET not configured on server")
            raise HTTPException(
                status_code=503,
                detail="Webhook secret not configured on server. Refusing to process webhook."
            )
        if not signature:
            logging.warning("[WEBHOOK] Rejected: missing X-Razorpay-Signature header")
            raise HTTPException(status_code=401, detail="Missing webhook signature")

        expected_signature = hmac.new(
            webhook_secret.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_signature):
            logging.warning(f"[WEBHOOK] Rejected: invalid signature. len(got)={len(signature)}")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

        payload = await request.json()
        event = payload.get("event")

        logging.info(f"[WEBHOOK] Event received: {event}")
        
        if event == "payment.captured":
            payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment.get("order_id")
            payment_id = payment.get("id")
            amount = payment.get("amount", 0) / 100  # Convert paise to INR
            
            if db is not None and order_id:
                # ==================== STEP 1: CHECK IF PAYMENT ALREADY PROCESSED ====================
                # CRITICAL: First check if this exact payment_id already activated a subscription
                existing_user = await db.users.find_one({"last_payment_id": payment_id})
                if existing_user:
                    logging.info(f"[WEBHOOK] Payment {payment_id} already activated for user {existing_user.get('uid')}, skipping")
                    return {"status": "ok", "message": "Payment already processed"}
                
                # ==================== STEP 2: CHECK ORDER STATUS ====================
                order = await db.razorpay_orders.find_one({"order_id": order_id})
                if not order:
                    logging.warning(f"[WEBHOOK] Order {order_id} not found in database")
                    return {"status": "error", "message": "Order not found"}
                
                # CRITICAL FIX: Check if order was cancelled - DO NOT activate cancelled orders
                if order.get("status") in ["cancelled", "failed", "error", "timeout", "dismissed"]:
                    logging.warning(f"[WEBHOOK] Order {order_id} is {order.get('status')} - NOT activating subscription")
                    return {"status": "ok", "message": f"Order was {order.get('status')}, skipping activation"}
                
                # If order already paid, skip
                if order.get("status") in ["paid", "processing"]:
                    logging.info(f"[WEBHOOK] Order {order_id} already {order.get('status')}, skipping webhook activation")
                    return {"status": "ok", "message": "Order already processed"}
                
                # ==================== STEP 3: ATOMIC CLAIM ORDER ====================
                # Use atomic findOneAndUpdate - only claim if not already paid/processing
                claim_result = await db.razorpay_orders.find_one_and_update(
                    {
                        "order_id": order_id,
                        "status": {"$nin": ["paid", "processing"]},  # Not paid or being processed
                    },
                    {
                        "$set": {
                            "status": "processing",  # Mark as processing to prevent race condition
                            "webhook_claimed": True,
                            "webhook_claimed_at": datetime.now(timezone.utc),
                            "payment_id": payment_id
                        }
                    }
                )
                
                if not claim_result:
                    logging.info(f"[WEBHOOK] Order {order_id} already being processed elsewhere, skipping")
                    return {"status": "ok", "message": "Order being processed"}
                
                order = claim_result  # Use the claimed order
                user_id = order.get("user_id")
                
                # ==================== STEP 4: DOUBLE CHECK USER'S LAST PAYMENT ====================
                # Critical: Recheck after claiming to handle race conditions
                user = await db.users.find_one({"uid": user_id})
                if user and user.get("last_payment_id") == payment_id:
                    logging.info(f"[WEBHOOK] Payment {payment_id} already activated via verify-payment, marking order paid and skipping")
                    await db.razorpay_orders.update_one(
                        {"order_id": order_id},
                        {"$set": {"status": "paid", "activated_by": "verify_payment"}}
                    )
                    return {"status": "ok", "message": "Already activated via verify-payment"}
                
                # ==================== STEP 5: ATOMIC USER CLAIM ====================
                # Try to claim this payment for this user atomically
                claim_user = await db.users.find_one_and_update(
                    {
                        "uid": user_id,
                        "last_payment_id": {"$ne": payment_id}  # Only if not already this payment
                    },
                    {
                        "$set": {"_webhook_claiming": payment_id}
                    }
                )
                
                if not claim_user:
                    logging.info(f"[WEBHOOK] Payment {payment_id} already claimed for user {user_id}, skipping")
                    await db.razorpay_orders.update_one(
                        {"order_id": order_id},
                        {"$set": {"status": "paid", "skipped_reason": "user_already_has_payment"}}
                    )
                    return {"status": "ok", "message": "Payment already processed for user"}
                
                user = claim_user  # Use claimed user data
                
                # ==================== STEP 6: CALCULATE SUBSCRIPTION ====================
                plan_type = order.get("plan_type", "monthly")
                plan_name = order.get("plan_name", "startup")
                duration_days = PLAN_DURATIONS.get(plan_type, 28)
                now = datetime.now(timezone.utc)
                remaining_days = 0
                
                # Calculate remaining days from existing subscription
                existing_expiry = get_user_expiry(user)
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
                
                # ==================== STEP 7: UPDATE USER SUBSCRIPTION ====================
                await db.users.update_one(
                    {"uid": user_id},
                    {
                        "$set": {
                            "subscription_plan": plan_name,
                            "subscription_start": now,
                            "subscription_expiry": expiry_date.isoformat(),
                            "subscription_status": "active",
                            "subscription_payment_type": "cash",
                            "last_payment_id": payment_id,
                            "last_payment_date": now,
                            "previous_remaining_days_added": remaining_days,
                            "activated_via": "webhook"
                        },
                        "$unset": {"_webhook_claiming": ""}
                    }
                )
                
                # ==================== STEP 8: MARK ORDER AS PAID ====================
                await db.razorpay_orders.update_one(
                    {"order_id": order_id},
                    {
                        "$set": {
                            "status": "paid",
                            "webhook_payment_id": payment_id,
                            "captured_at": datetime.now(timezone.utc),
                            "payment_captured": True,
                            "verified_amount": amount,
                            "activated_by": "webhook"
                        }
                    }
                )
                
                # ==================== STEP 9: LOG TRANSACTION ====================
                # Check if transaction already exists for this payment
                existing_txn = await db.transactions.find_one({
                    "payment_id": payment_id,
                    "type": "subscription_payment"
                })
                
                if not existing_txn:
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
                
                logging.info(f"[WEBHOOK] ✅ Subscription activated for user {user_id}, plan: {plan_name}, total days: {total_days}")
            
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
    
    # Also include subscription_payments (PRC-based payments)
    sub_payments = await db.subscription_payments.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    for sp in sub_payments:
        # Normalize to match razorpay_orders shape for frontend
        sp["order_id"] = sp.get("order_id", f"sub_{sp.get('created_at', '')}")
        sp["amount"] = sp.get("inr_equivalent", sp.get("amount", 0))
        if "status" not in sp:
            sp["status"] = "paid"
        sp["payment_method"] = sp.get("payment_method", "prc")
        sp["source"] = "subscription_payments"
    
    # Merge and deduplicate (prefer razorpay_orders if same order_id exists)
    existing_ids = {p.get("order_id") for p in payments}
    for sp in sub_payments:
        if sp.get("order_id") not in existing_ids:
            payments.append(sp)
    
    # Sort merged list by created_at descending
    # Handle mixed datetime/string types by converting to string for comparison
    def get_sort_key(x):
        created_at = x.get("created_at", "")
        if isinstance(created_at, datetime):
            return created_at.isoformat()
        return str(created_at) if created_at else ""
    
    payments.sort(key=get_sort_key, reverse=True)
    
    # Add user-friendly status messages
    for p in payments:
        status = p.get("status", "created")
        if status == "paid":
            p["status_message"] = "Payment successful - Subscription activated"
            p["status_color"] = "green"
        elif status == "created":
            p["status_message"] = "Payment pending - Complete payment to activate"
            p["status_color"] = "yellow"
        elif status == "failed":
            p["status_message"] = f"Payment failed - {p.get('failure_reason', 'Please try again')}"
            p["status_color"] = "red"
        elif status == "error":
            p["status_message"] = f"Error occurred - {p.get('failure_reason', 'Contact support')}"
            p["status_color"] = "orange"
        elif status == "cancelled":
            p["status_message"] = "Payment cancelled"
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
    raw_expiry = user.get("subscription_expiry")

    # Calculate remaining days
    parsed_expiry = get_user_expiry(user)
    remaining_days = 0

    if parsed_expiry and parsed_expiry > now:
        remaining_days = (parsed_expiry - now).days

    total_days = duration_days + remaining_days
    new_expiry = now + timedelta(days=total_days)

    return {
        "user_id": user_id,
        "user_name": user.get("name"),
        "current_plan": user.get("subscription_plan"),
        "raw_fields": {
            "subscription_expiry": raw_expiry,
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
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")



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
                            existing_expiry = get_user_expiry(user)
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
                                    "subscription_expiry": expiry_date.isoformat(),
                                    "subscription_status": "active",
                                    "subscription_payment_type": "cash",
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
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")



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
                                        existing_expiry = get_user_expiry(user)
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
                                            "subscription_expiry": expiry_date.isoformat(),
                                            "subscription_status": "active",
                                            "subscription_payment_type": "cash",
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
            existing_expiry = get_user_expiry(user)
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
                "subscription_expiry": expiry_date.isoformat(),
                "subscription_status": "active",
                "subscription_payment_type": "cash",
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
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")



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
        existing_expiry = get_user_expiry(user)
        
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
                "subscription_expiry": expiry_date.isoformat(),
                "subscription_status": "active",
                "subscription_payment_type": "cash",
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
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")




@router.post("/admin/find-unfixed-subscriptions")
async def find_unfixed_subscriptions(request: Request):
    """
    Find ALL users with extended subscriptions who haven't been fixed yet.
    
    This searches ALL users (not just from transactions) where:
    - subscription_expiry - last_payment_date > 35 days
    - subscription_fixed_v2 is not True
    """
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        # Find all active subscribers
        users = await db.users.find({
            "last_payment_date": {"$exists": True, "$ne": None},
            "subscription_fixed_v2": {"$ne": True}
        }, {"_id": 0}).limit(1000).to_list(1000)
        
        unfixed = []
        now = datetime.now(timezone.utc)
        
        for u in users:
            payment = u.get("last_payment_date")
            expiry = u.get("subscription_expiry")
            
            if not payment or not expiry:
                continue
            
            # Parse dates
            if isinstance(payment, str):
                try:
                    payment = datetime.fromisoformat(payment.replace('Z', '+00:00'))
                except:
                    continue
            if isinstance(expiry, str):
                try:
                    expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                except:
                    continue
            
            if payment.tzinfo is None:
                payment = payment.replace(tzinfo=timezone.utc)
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            
            days = (expiry - payment).days
            
            if days > 35:  # More than 28 + buffer
                unfixed.append({
                    "uid": u.get("uid"),
                    "name": u.get("name"),
                    "email": u.get("email"),
                    "last_payment_date": str(payment),
                    "current_expiry": str(expiry),
                    "current_days": days,
                    "should_be_days": 28,
                    "extra_days": days - 28
                })
        
        return {
            "success": True,
            "total_checked": len(users),
            "unfixed_count": len(unfixed),
            "unfixed_users": unfixed,
            "uids": [u["uid"] for u in unfixed]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[FIND-UNFIXED] Error: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


@router.post("/admin/batch-fix-users")
async def batch_fix_users(request: Request):
    """
    Fix multiple users by UIDs.
    
    Usage:
    curl -X POST "/api/razorpay/admin/batch-fix-users" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456", "uids": ["uid1", "uid2", ...], "dry_run": true}'
    """
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        uids = data.get("uids", [])
        dry_run = data.get("dry_run", True)
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        if not uids:
            raise HTTPException(status_code=400, detail="uids list required")
        
        results = []
        fixed_count = 0
        
        for uid in uids:
            user = await db.users.find_one({"uid": uid}, {"_id": 0})
            if not user:
                results.append({"uid": uid, "status": "NOT_FOUND"})
                continue
            
            payment = user.get("last_payment_date")
            expiry = user.get("subscription_expiry")
            
            if not payment:
                results.append({"uid": uid, "name": user.get("name"), "status": "NO_PAYMENT_DATE"})
                continue
            
            # Get remaining days from transaction
            last_txn = await db.transactions.find_one(
                {"user_id": uid, "type": "subscription_payment"},
                sort=[("timestamp", -1)]
            )
            remaining_days = 0
            if last_txn:
                remaining_days = min(last_txn.get("remaining_days_added", 0) or 0, 28)
            
            # Parse dates
            if isinstance(payment, str):
                payment = datetime.fromisoformat(payment.replace('Z', '+00:00'))
            if isinstance(expiry, str):
                expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
            
            if payment.tzinfo is None:
                payment = payment.replace(tzinfo=timezone.utc)
            if expiry and expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            
            current_days = (expiry - payment).days if expiry else 0
            correct_total = 28 + remaining_days
            correct_expiry = payment + timedelta(days=correct_total)
            
            if current_days <= correct_total + 7:
                results.append({
                    "uid": uid, 
                    "name": user.get("name"), 
                    "status": "ALREADY_OK",
                    "current_days": current_days
                })
                continue
            
            if not dry_run:
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "subscription_start": payment,
                            "subscription_expiry": correct_expiry.isoformat(),
                            "subscription_fixed": True,
                            "subscription_fixed_v2": True,
                            "fixed_at": datetime.now(timezone.utc),
                            "original_wrong_days": current_days,
                            "correct_total_days": correct_total,
                            "legitimate_remaining_days": remaining_days,
                            "fix_reason": f"Batch fix: 28 + {remaining_days} = {correct_total} days"
                        }
                    }
                )
                fixed_count += 1
            
            results.append({
                "uid": uid,
                "name": user.get("name"),
                "old_days": current_days,
                "remaining_days": remaining_days,
                "new_total_days": correct_total,
                "new_expiry": correct_expiry.isoformat(),
                "status": "FIXED" if not dry_run else "WOULD_FIX"
            })
        
        return {
            "success": True,
            "mode": "DRY_RUN" if dry_run else "LIVE",
            "processed": len(uids),
            "fixed_count": fixed_count if not dry_run else 0,
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[BATCH-FIX] Error: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


# ==================== FIX DOUBLE-ACTIVATED SUBSCRIPTIONS ====================

@router.post("/admin/fix-double-activation")
async def fix_double_activation_subscriptions(request: Request):
    """
    ADMIN TOOL: Fix subscriptions that got 52 days instead of 28 days due to double activation bug.
    
    This will:
    1. Find users whose subscription was activated twice (via verify-payment AND webhook)
    2. Reduce their expiry to correct value (28 days from subscription_start)
    
    Usage:
    curl -X POST "/api/razorpay/admin/fix-double-activation" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456", "dry_run": true}'
    
    Set dry_run=false to actually make changes.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        dry_run = data.get("dry_run", True)
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        # Find transactions with double activation pattern
        # (same user, same payment_id, both verify-payment and webhook records)
        pipeline = [
            {
                "$match": {
                    "type": "subscription_payment",
                    "total_days": {"$gt": 35}  # More than 28 + buffer
                }
            },
            {
                "$group": {
                    "_id": "$user_id",
                    "transactions": {"$push": "$$ROOT"},
                    "count": {"$sum": 1},
                    "max_total_days": {"$max": "$total_days"}
                }
            },
            {
                "$match": {
                    "max_total_days": {"$gte": 50, "$lte": 60}  # 52 days range
                }
            },
            {"$limit": 100}
        ]
        
        affected_users = await db.transactions.aggregate(pipeline).to_list(100)
        
        results = []
        fixed_count = 0
        
        for entry in affected_users:
            user_id = entry["_id"]
            max_days = entry["max_total_days"]
            
            # Get user's current subscription
            user = await db.users.find_one({"uid": user_id}, {"_id": 0})
            if not user:
                continue
            
            # Use last_payment_date as the correct start (not subscription_start which might be old)
            payment_date = user.get("last_payment_date")
            subscription_start = user.get("subscription_start")
            current_expiry = user.get("subscription_expiry")
            
            # Get remaining days that were legitimately added (from transaction record)
            # Find the most recent subscription transaction for this user
            last_txn = await db.transactions.find_one(
                {"user_id": user_id, "type": "subscription_payment"},
                sort=[("timestamp", -1)]
            )
            
            legitimate_remaining_days = 0
            if last_txn:
                legitimate_remaining_days = last_txn.get("remaining_days_added", 0) or 0
                # Cap at reasonable amount (max 28 days remaining from previous subscription)
                legitimate_remaining_days = min(legitimate_remaining_days, 28)
            
            # Prefer last_payment_date, fallback to subscription_start
            correct_start = payment_date or subscription_start
            if not correct_start:
                continue
            
            # Parse dates
            if isinstance(correct_start, str):
                try:
                    correct_start = datetime.fromisoformat(correct_start.replace('Z', '+00:00'))
                except:
                    continue
            
            if isinstance(current_expiry, str):
                try:
                    current_expiry = datetime.fromisoformat(current_expiry.replace('Z', '+00:00'))
                except:
                    continue
            
            if correct_start.tzinfo is None:
                correct_start = correct_start.replace(tzinfo=timezone.utc)
            if current_expiry and current_expiry.tzinfo is None:
                current_expiry = current_expiry.replace(tzinfo=timezone.utc)
            
            # Calculate current days from correct_start
            now = datetime.now(timezone.utc)
            current_days = (current_expiry - correct_start).days if current_expiry else 0
            
            # Correct total days = 28 (plan) + legitimate remaining days
            correct_total_days = 28 + legitimate_remaining_days
            
            # Check if over-extended (more than correct total from payment date)
            if current_days > correct_total_days + 7:  # More than correct + buffer
                correct_expiry = correct_start + timedelta(days=correct_total_days)
                
                result = {
                    "user_id": user_id,
                    "name": user.get("name"),
                    "email": user.get("email"),
                    "last_payment_date": str(payment_date) if payment_date else None,
                    "subscription_start": str(subscription_start) if subscription_start else None,
                    "used_date": correct_start.isoformat(),
                    "current_expiry": current_expiry.isoformat() if current_expiry else None,
                    "current_days": current_days,
                    "legitimate_remaining_days": legitimate_remaining_days,
                    "correct_total_days": correct_total_days,
                    "correct_expiry": correct_expiry.isoformat(),
                    "days_to_remove": current_days - correct_total_days
                }
                
                if not dry_run:
                    # Fix the subscription - also update subscription_start to correct date
                    await db.users.update_one(
                        {"uid": user_id},
                        {
                            "$set": {
                                "subscription_start": correct_start,
                                "subscription_expiry": correct_expiry.isoformat(),
                                "subscription_fixed": True,
                                "subscription_fixed_v2": True,
                                "fixed_at": datetime.now(timezone.utc),
                                "original_wrong_days": current_days,
                                "correct_total_days": correct_total_days,
                                "legitimate_remaining_days": legitimate_remaining_days,
                                "fix_reason": f"Double activation fix v2: 28 + {legitimate_remaining_days} remaining = {correct_total_days} days"
                            }
                        }
                    )
                    result["status"] = "FIXED"
                    fixed_count += 1
                else:
                    result["status"] = "WOULD_FIX"
                
                results.append(result)
        
        return {
            "success": True,
            "mode": "DRY_RUN" if dry_run else "LIVE",
            "affected_users_found": len(results),
            "fixed_count": fixed_count if not dry_run else 0,
            "users": results,
            "message": "Set dry_run=false to actually fix these subscriptions" if dry_run else f"Fixed {fixed_count} subscriptions"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[FIX-DOUBLE] Error: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


@router.post("/admin/fix-specific-user")
async def fix_specific_user_subscription(request: Request):
    """
    ADMIN TOOL: Fix a specific user's subscription.
    
    Formula: expiry = last_payment_date + 28 + remaining_days
    
    Usage:
    curl -X POST "/api/razorpay/admin/fix-specific-user" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456", "user_id": "xxx"}'
    
    Or specify custom days:
      -d '{"admin_pin": "123456", "user_id": "xxx", "plan_days": 28, "remaining_days": 5}'
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        user_id = data.get("user_id")
        plan_days = data.get("plan_days", 28)  # Base plan days
        custom_remaining = data.get("remaining_days")  # Optional: override remaining days
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        user = await db.users.find_one({"uid": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Use last_payment_date as primary, fallback to subscription_start
        payment_date = user.get("last_payment_date")
        subscription_start = user.get("subscription_start")
        current_expiry = user.get("subscription_expiry")
        
        # Get remaining days from transaction record (if not custom specified)
        remaining_days = 0
        if custom_remaining is not None:
            remaining_days = custom_remaining
        else:
            # Find from transaction record
            last_txn = await db.transactions.find_one(
                {"user_id": user_id, "type": "subscription_payment"},
                sort=[("timestamp", -1)]
            )
            if last_txn:
                remaining_days = last_txn.get("remaining_days_added", 0) or 0
                remaining_days = min(remaining_days, 28)  # Cap at 28
        
        # Prefer last_payment_date
        correct_start = payment_date or subscription_start
        if not correct_start:
            raise HTTPException(status_code=400, detail="User has no payment date or subscription_start")
        
        # Parse dates
        if isinstance(correct_start, str):
            correct_start = datetime.fromisoformat(correct_start.replace('Z', '+00:00'))
        if isinstance(current_expiry, str):
            current_expiry = datetime.fromisoformat(current_expiry.replace('Z', '+00:00'))
        
        if correct_start.tzinfo is None:
            correct_start = correct_start.replace(tzinfo=timezone.utc)
        
        if current_expiry and current_expiry.tzinfo is None:
            current_expiry = current_expiry.replace(tzinfo=timezone.utc)
        
        # Calculate correct total: plan_days + remaining_days
        correct_total_days = plan_days + remaining_days
        correct_expiry = correct_start + timedelta(days=correct_total_days)
        
        # Current days from correct start
        current_days = (current_expiry - correct_start).days if current_expiry else 0
        
        # Update
        await db.users.update_one(
            {"uid": user_id},
            {
                "$set": {
                    "subscription_start": correct_start,
                    "subscription_expiry": correct_expiry.isoformat(),
                    "subscription_fixed": True,
                    "subscription_fixed_v2": True,
                    "fixed_at": datetime.now(timezone.utc),
                    "original_wrong_days": current_days,
                    "correct_total_days": correct_total_days,
                    "legitimate_remaining_days": remaining_days,
                    "fix_reason": f"Manual fix v2: {plan_days} + {remaining_days} remaining = {correct_total_days} days"
                }
            }
        )
        
        return {
            "success": True,
            "user_id": user_id,
            "name": user.get("name"),
            "last_payment_date": str(payment_date) if payment_date else None,
            "old_subscription_start": str(subscription_start) if subscription_start else None,
            "new_subscription_start": correct_start.isoformat(),
            "old_expiry": current_expiry.isoformat() if current_expiry else None,
            "old_days": current_days,
            "plan_days": plan_days,
            "remaining_days_added": remaining_days,
            "new_total_days": correct_total_days,
            "new_expiry": correct_expiry.isoformat(),
            "message": f"Fixed: {plan_days} (plan) + {remaining_days} (remaining) = {correct_total_days} days"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[FIX-USER] Error: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")



# ==================== FIX CANCELLED ORDERS WITH ACTIVE SUBSCRIPTIONS ====================

@router.post("/admin/fix-cancelled-subscriptions")
async def fix_cancelled_order_subscriptions(request: Request):
    """
    CRITICAL FIX: Find and reverse subscriptions for cancelled/failed orders.
    
    This handles the bug where cancelled orders still activated Elite subscriptions.
    
    Will:
    1. Find all cancelled/failed orders where user still has Elite subscription
    2. Check if user has NO paid orders for current subscription period
    3. Downgrade user to Explorer plan
    
    Usage:
    curl -X POST "/api/razorpay/admin/fix-cancelled-subscriptions" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456", "dry_run": true}'
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        dry_run = data.get("dry_run", True)
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        # Find all cancelled/failed orders
        cancelled_orders = await db.razorpay_orders.find({
            "status": {"$in": ["cancelled", "failed", "error", "timeout", "dismissed"]}
        }).to_list(10000)
        
        logging.info(f"[FIX-CANCELLED] Found {len(cancelled_orders)} cancelled/failed orders")
        
        affected_users = []
        fixed_count = 0
        already_correct = 0
        has_paid_order = 0
        
        for order in cancelled_orders:
            user_id = order.get("user_id")
            if not user_id:
                continue

            # Get user — CRITICAL BUG FIX (Feb 2026): the users collection
            # keys on `uid`, NOT `user_id`. Previous version silently found
            # zero users → downgraded nobody → the audit endpoint reported
            # false-negative "all clean" while dozens of leaks stayed live.
            user = await db.users.find_one({"uid": user_id})
            if not user:
                continue

            current_plan = user.get("subscription_plan", "explorer")

            # Only process users on PAID plans (Elite / Growth / Startup).
            # Explorer is free — a cancelled order there is a no-op.
            if current_plan not in ("elite", "growth", "startup"):
                already_correct += 1
                continue
            
            # Check if user has ANY paid orders that justify their Elite subscription
            paid_order = await db.razorpay_orders.find_one({
                "user_id": user_id,
                "status": "paid"
            })
            
            if paid_order:
                has_paid_order += 1
                continue  # User has a legitimate paid order
            
            # User has Elite but NO paid orders - this is the bug!
            affected_users.append({
                "user_id": user_id,
                "user_name": user.get("name", "Unknown"),
                "email": user.get("email"),
                "mobile": user.get("mobile"),
                "current_plan": current_plan,
                "subscription_expiry": str(user.get("subscription_expiry") or ""),
                "cancelled_order_id": order.get("order_id"),
                "cancelled_reason": order.get("failure_reason", "Unknown")
            })
            
            if not dry_run:
                # Downgrade to Explorer (uid, not user_id)
                await db.users.update_one(
                    {"uid": user_id},
                    {
                        "$set": {
                            "subscription_plan": "explorer",
                            "subscription_expiry": None,
                            "subscription_start": None,
                            "downgrade_reason": f"Cancelled order {order.get('order_id')} - no paid orders",
                            "downgrade_date": datetime.now(timezone.utc).isoformat(),
                            "admin_fixed": True,
                            "previous_plan_at_downgrade": current_plan,
                        }
                    }
                )
                fixed_count += 1
                logging.info(f"[FIX-CANCELLED] Downgraded {user_id} ({user.get('name')}) from {current_plan} → Explorer — no paid orders")
        
        return {
            "success": True,
            "dry_run": dry_run,
            "summary": {
                "total_cancelled_orders": len(cancelled_orders),
                "already_correct_plan": already_correct,
                "has_valid_paid_order": has_paid_order,
                "affected_users_count": len(affected_users),
                "fixed_count": fixed_count if not dry_run else 0
            },
            "affected_users": affected_users[:100],  # Limit to 100 for response
            "message": f"{'Would fix' if dry_run else 'Fixed'} {len(affected_users)} users with cancelled orders but Elite subscription"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[FIX-CANCELLED] Error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


@router.post("/admin/audit-cancelled-elite")
async def audit_cancelled_with_elite(request: Request):
    """
    AUDIT: Find ALL cancelled orders where user currently has Elite subscription.
    This shows even users who have valid paid orders - for manual review.
    
    Use this to understand the subscription status of users with cancelled orders.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        # Find all cancelled/failed orders
        cancelled_orders = await db.razorpay_orders.find({
            "status": {"$in": ["cancelled", "failed", "error", "timeout", "dismissed"]}
        }).sort("created_at", -1).to_list(10000)
        
        results = []
        
        # Track processed users to avoid duplicates
        processed_users = set()
        
        for order in cancelled_orders:
            user_id = order.get("user_id")
            if not user_id or user_id in processed_users:
                continue
            
            processed_users.add(user_id)
            
            # Get user — BUG FIX (Feb 2026): user schema uses `uid` not `user_id`.
            user = await db.users.find_one({"uid": user_id})
            if not user:
                continue

            current_plan = user.get("subscription_plan", "explorer")

            # Show ALL paid plans (elite / growth / startup), not just elite.
            if current_plan not in ("elite", "growth", "startup"):
                continue
            
            # Get all orders for this user
            all_orders = await db.razorpay_orders.find({
                "user_id": user_id
            }).sort("created_at", -1).to_list(100)
            
            paid_orders = [o for o in all_orders if o.get("status") == "paid"]
            cancelled_orders_user = [o for o in all_orders if o.get("status") in ["cancelled", "failed", "error", "timeout", "dismissed"]]
            
            results.append({
                "user_id": user_id,
                "name": user.get("name"),
                "email": user.get("email"),
                "mobile": user.get("mobile"),
                "current_plan": current_plan,
                "subscription_expiry": str(user.get("subscription_expiry") or ""),
                "total_orders": len(all_orders),
                "paid_orders": len(paid_orders),
                "cancelled_orders": len(cancelled_orders_user),
                "latest_paid_order": paid_orders[0].get("order_id") if paid_orders else None,
                "latest_paid_date": str(paid_orders[0].get("created_at")) if paid_orders else None,
                "latest_cancelled_order": cancelled_orders_user[0].get("order_id") if cancelled_orders_user else None,
                "latest_cancelled_date": str(cancelled_orders_user[0].get("created_at")) if cancelled_orders_user else None,
                "has_legitimate_subscription": len(paid_orders) > 0
            })
        
        # Separate into categories
        legitimate = [r for r in results if r["has_legitimate_subscription"]]
        suspicious = [r for r in results if not r["has_legitimate_subscription"]]
        
        return {
            "success": True,
            "summary": {
                "total_elite_users_with_cancelled_orders": len(results),
                "legitimate_subscriptions": len(legitimate),
                "suspicious_no_paid_orders": len(suspicious)
            },
            "suspicious_users": suspicious[:50],
            "legitimate_users_sample": legitimate[:20],
            "message": f"Found {len(suspicious)} users with Elite but NO paid orders - these need manual review"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[AUDIT] Error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


@router.post("/admin/audit-single-user")
async def audit_single_user(request: Request):
    """
    LASER-FOCUSED SINGLE-USER AUDIT (Feb 5 2026)
    =============================================
    Given a user identifier (name / email / mobile / uid), returns EVERY
    payment-related evidence source so an admin can eyeball whether the
    user's active subscription came from a legitimate payment or is a
    leaked activation.

    Zero writes — pure read. Safe to call anytime.

    Auth: admin_pin=123456.

    Usage (production):
      curl -X POST "https://www.parasreward.com/api/razorpay/admin/audit-single-user" \\
        -H "Content-Type: application/json" \\
        -d '{"admin_pin":"123456","query":"Sadadiya"}'

    `query` can match: uid (exact) / email (contains) / mobile (contains) /
    name (contains, case-insensitive). Returns UP TO 5 matching users so
    you can disambiguate common names.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        query = (data.get("query") or "").strip()
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        if not query or len(query) < 3:
            raise HTTPException(status_code=400, detail="query must be at least 3 chars")

        # Multi-field search — try uid exact first, then contains on others.
        candidates = await db.users.find(
            {"$or": [
                {"uid": query},
                {"email": {"$regex": query, "$options": "i"}},
                {"mobile": {"$regex": query}},
                {"name": {"$regex": query, "$options": "i"}},
            ]},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1,
             "subscription_plan": 1, "subscription_expiry": 1,
             "subscription_start": 1, "subscription_status": 1,
             "subscription_payment_type": 1, "last_prc_subscription": 1,
             "subscription_type": 1, "activated_via": 1,
             "subscription_expired": 1, "subscription_history": 1,
             "membership_type": 1, "migrated_from_vip": 1,
             "admin_upgraded": 1, "admin_fixed": 1,
             "test_account": 1, "role": 1, "created_at": 1,
             "downgrade_reason": 1, "previous_plan_at_downgrade": 1,
             "last_payment_id": 1, "sponsored_by": 1,
             "sale_elite_received_from": 1, "gifted_subscription": 1},
        ).to_list(5)

        if not candidates:
            return {
                "success": True,
                "matches_found": 0,
                "message": f"No user matched '{query}'.",
            }

        results = []
        for u in candidates:
            uid = u.get("uid")
            if not uid:
                continue

            # Fetch ALL evidence sources in parallel-ish (mongo motor)
            all_orders = await db.razorpay_orders.find(
                {"user_id": uid},
                {"_id": 0, "order_id": 1, "status": 1, "amount": 1,
                 "created_at": 1, "notes": 1},
            ).sort("created_at", -1).to_list(50)

            paid_orders = [o for o in all_orders if o.get("status") == "paid"]
            cancelled_orders = [
                o for o in all_orders
                if o.get("status") in
                ["cancelled", "failed", "error", "timeout", "dismissed"]
            ]
            pending_orders = [
                o for o in all_orders
                if o.get("status") in ["created", "pending", "attempted"]
            ]

            try:
                sub_payments = await db.subscription_payments.find(
                    {"user_id": uid},
                    {"_id": 0, "payment_id": 1, "status": 1, "plan_name": 1,
                     "payment_method": 1, "prc_amount": 1, "inr_equivalent": 1,
                     "created_at": 1, "activated_by_admin": 1},
                ).sort("created_at", -1).to_list(50)
            except Exception:
                sub_payments = []

            try:
                sub_transactions = await db.transactions.find(
                    {"user_id": uid,
                     "type": {"$in": [
                         "subscription_prc", "subscription_payment",
                         "subscription", "elite_activation", "plan_purchase",
                     ]}},
                    {"_id": 0, "type": 1, "amount": 1, "created_at": 1,
                     "description": 1, "admin_action": 1},
                ).sort("created_at", -1).to_list(50)
            except Exception:
                sub_transactions = []

            # ── VERDICT LOGIC (matches /audit-paid-plans-without-payment) ──
            role = (u.get("role") or "").lower().strip()
            reasons_for_legit = []
            if role in ("admin", "sub_admin", "moderator", "staff", "system"):
                reasons_for_legit.append(f"role={role}")
            if u.get("admin_upgraded") is True:
                reasons_for_legit.append("admin_upgraded=true")
            if u.get("admin_fixed") is True:
                reasons_for_legit.append("admin_fixed=true (already reconciled)")
            if u.get("migrated_from_vip") is True:
                reasons_for_legit.append("migrated_from_vip (legacy VIP)")
            if u.get("subscription_payment_type") == "prc":
                reasons_for_legit.append("subscription_payment_type=prc")
            if u.get("last_prc_subscription"):
                reasons_for_legit.append("has last_prc_subscription timestamp")
            if u.get("test_account") is True:
                reasons_for_legit.append("test_account=true")
            # Sponsored / gift subscriptions — beneficiary of legit gift.
            if u.get("sponsored_by") or u.get("sale_elite_received_from") or u.get("gifted_subscription"):
                reasons_for_legit.append(
                    f"gift-recipient (sponsored_by={u.get('sponsored_by') or u.get('sale_elite_received_from')})"
                )
            # `activated_via` is stamped by the auto-sync / manual-activate paths
            # that require a real captured Razorpay payment. Trust it.
            if u.get("activated_via"):
                reasons_for_legit.append(f"activated_via={u.get('activated_via')}")
            # Any historical subscription_history entry — legacy grants.
            sh = u.get("subscription_history")
            if isinstance(sh, list) and len(sh) > 0:
                reasons_for_legit.append(f"subscription_history has {len(sh)} entries")
            # last_payment_id present = user was linked to a real payment at some point.
            if u.get("last_payment_id"):
                reasons_for_legit.append(f"last_payment_id={u.get('last_payment_id')[:20]}…")

            if paid_orders:
                reasons_for_legit.append(
                    f"{len(paid_orders)} paid Razorpay order(s)"
                )
            if sub_payments:
                # Only count subscription_payments with status=paid as legit.
                # A failed / cancelled sub_payment does NOT prove real payment.
                paid_sub_payments = [
                    p for p in sub_payments
                    if (p.get("status") or "").lower() == "paid"
                ]
                if paid_sub_payments:
                    reasons_for_legit.append(
                        f"{len(paid_sub_payments)} PAID subscription_payments row(s)"
                    )
            if sub_transactions:
                reasons_for_legit.append(
                    f"{len(sub_transactions)} subscription txn(s) in transactions"
                )

            current_plan = u.get("subscription_plan", "explorer")
            is_paid_plan = current_plan in ("elite", "growth", "startup")

            if not is_paid_plan:
                verdict = "USER_NOT_ON_PAID_PLAN"
                summary = f"Current plan is '{current_plan}' — nothing to worry about."
            elif reasons_for_legit:
                verdict = "LEGITIMATE"
                summary = (
                    f"Subscription IS backed by real payment/grant. Evidence: "
                    + "; ".join(reasons_for_legit)
                )
            else:
                verdict = "SUSPICIOUS_LEAK"
                summary = (
                    f"⚠️ User is on '{current_plan}' plan but has NO paid "
                    "orders, NO subscription_payments, NO PRC flag, NO VIP "
                    "migration, and NO admin grant. Recent cancelled/failed "
                    f"orders: {len(cancelled_orders)}. This is a real leak — "
                    "candidate for downgrade."
                )

            results.append({
                "uid": uid,
                "name": u.get("name"),
                "email": u.get("email"),
                "mobile": u.get("mobile"),
                "current_plan": current_plan,
                "subscription_start": str(u.get("subscription_start") or ""),
                "subscription_expiry": str(u.get("subscription_expiry") or ""),
                "subscription_status": u.get("subscription_status"),
                "membership_type": u.get("membership_type"),
                "role": u.get("role"),
                "user_created_at": str(u.get("created_at") or ""),

                # Verdict
                "verdict": verdict,
                "verdict_summary": summary,
                "legit_evidence": reasons_for_legit,

                # Legacy grant flags (quick eyeball)
                "flags": {
                    "admin_upgraded": u.get("admin_upgraded"),
                    "admin_fixed": u.get("admin_fixed"),
                    "migrated_from_vip": u.get("migrated_from_vip"),
                    "subscription_payment_type": u.get("subscription_payment_type"),
                    "last_prc_subscription": u.get("last_prc_subscription"),
                    "test_account": u.get("test_account"),
                    "downgrade_reason": u.get("downgrade_reason"),
                    "previous_plan_at_downgrade": u.get("previous_plan_at_downgrade"),
                    "last_payment_id": u.get("last_payment_id"),
                    # Additional signals — Feb 6 2026
                    "activated_via": u.get("activated_via"),
                    "subscription_type": u.get("subscription_type"),
                    "subscription_expired": u.get("subscription_expired"),
                    "sponsored_by": u.get("sponsored_by"),
                    "sale_elite_received_from": u.get("sale_elite_received_from"),
                    "gifted_subscription": u.get("gifted_subscription"),
                    "subscription_history_count": (
                        len(u.get("subscription_history") or [])
                        if isinstance(u.get("subscription_history"), list) else None
                    ),
                },

                # Full evidence — payment history
                "razorpay_orders_summary": {
                    "total": len(all_orders),
                    "paid": len(paid_orders),
                    "cancelled_or_failed": len(cancelled_orders),
                    "pending": len(pending_orders),
                },
                "recent_paid_orders": paid_orders[:5],
                "recent_cancelled_or_failed_orders": cancelled_orders[:5],
                "recent_pending_orders": pending_orders[:5],
                "subscription_payments_count": len(sub_payments),
                "recent_subscription_payments": sub_payments[:5],
                "subscription_transactions_count": len(sub_transactions),
                "recent_subscription_transactions": sub_transactions[:5],
            })

        return {
            "success": True,
            "matches_found": len(results),
            "users": results,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[AUDIT-SINGLE] Error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


@router.post("/admin/audit-paid-plans-without-payment")
async def audit_paid_plans_without_payment(request: Request):
    """
    COMPREHENSIVE AUDIT (Feb 2026) — Find every user currently on a PAID plan
    (elite / growth / startup) who has NO evidence of a legitimate payment.

    "Legitimate payment" = any of:
      1. A razorpay_order with status="paid" for this user, OR
      2. A `subscription_payments` row (admin/PRC-based activations), OR
      3. An `admin_fixed=True` flag on the user (already reconciled), OR
      4. `admin_upgraded=True` (manually granted by admin) — bypasses check.

    Users failing ALL of these are HIGHLY suspicious — the plan was likely
    activated via the webhook-bypass revenue leak (fixed Feb 5 2026) or the
    cron cancelled-order gap. Support should manually review each row before
    downgrading in bulk.

    Auth: admin PIN `123456` required. `dry_run=true` by default — no writes.

    Usage:
      curl -X POST "$API/api/razorpay/admin/audit-paid-plans-without-payment" \\
        -H "Content-Type: application/json" \\
        -d '{"admin_pin":"123456","dry_run":true}'
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        dry_run = bool(data.get("dry_run", True))
        limit = int(data.get("limit", 500))
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")

        paid_plans = ["elite", "growth", "startup"]
        cursor = db.users.find(
            {"subscription_plan": {"$in": paid_plans}},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1,
             "subscription_plan": 1, "subscription_expiry": 1,
             "subscription_start": 1, "admin_upgraded": 1,
             "admin_fixed": 1, "created_at": 1,
             # Feb 5 2026 (v2 audit): also honour these legit-legacy flags
             # to avoid downgrading users granted subscriptions before the
             # razorpay_orders collection existed or via VIP migration.
             "migrated_from_vip": 1,
             "subscription_payment_type": 1,
             "last_prc_subscription": 1,
             "membership_type": 1,
             "subscription_status": 1,
             "test_account": 1,
             "role": 1,
             # Feb 6 2026 (v3 audit): additional signals for legit legacy grants.
             "activated_via": 1,
             "last_payment_id": 1,
             "sponsored_by": 1,
             "sale_elite_received_from": 1,
             "gifted_subscription": 1,
             "subscription_history": 1}
        )
        users_on_paid_plan = await cursor.to_list(50000)
        logging.info(f"[AUDIT-PAID] Scanning {len(users_on_paid_plan)} paid-plan users")

        suspicious = []
        legit_paid = 0
        legit_prc = 0
        legit_admin_granted = 0
        legit_vip_migration = 0
        legit_prc_flag = 0
        legit_tx_subscription = 0
        legit_admin_role = 0
        legit_activated_via = 0
        legit_last_payment_id = 0
        legit_gift_recipient = 0
        legit_sub_history = 0

        for u in users_on_paid_plan:
            uid = u.get("uid")
            if not uid:
                continue

            # ── Fast-path legit checks (in order of cost) ───────────────────
            # 0. Admin / staff roles — never downgrade platform accounts.
            role = (u.get("role") or "").lower().strip()
            if role in ("admin", "sub_admin", "moderator", "staff", "system"):
                legit_admin_role += 1
                continue

            # 1. Trust admin-granted / already-reconciled flags
            if u.get("admin_upgraded") is True or u.get("admin_fixed") is True:
                legit_admin_granted += 1
                continue

            # 2. Legacy VIP → Startup migration (server.py:15855)
            if u.get("migrated_from_vip") is True:
                legit_vip_migration += 1
                continue

            # 3. PRC-based subscription flag (admin_misc.py:1189)
            if u.get("subscription_payment_type") == "prc":
                legit_prc_flag += 1
                continue
            if u.get("last_prc_subscription"):
                legit_prc_flag += 1
                continue

            # 4. Test / seed accounts
            if u.get("test_account") is True:
                legit_admin_role += 1
                continue

            # 5. Gift recipient — someone else sponsored this user's plan
            if u.get("sponsored_by") or u.get("sale_elite_received_from") or u.get("gifted_subscription"):
                legit_gift_recipient += 1
                continue

            # 6. Activated via a legit auto/manual sync path (requires captured payment)
            if u.get("activated_via"):
                legit_activated_via += 1
                continue

            # 7. Historical subscription_history — legacy grants
            sh = u.get("subscription_history")
            if isinstance(sh, list) and len(sh) > 0:
                legit_sub_history += 1
                continue

            # 8. last_payment_id linked to any real payment
            if u.get("last_payment_id"):
                legit_last_payment_id += 1
                continue

            # 9. Any paid Razorpay order?
            has_paid_order = await db.razorpay_orders.find_one(
                {"user_id": uid, "status": "paid"},
                {"_id": 0, "order_id": 1},
            )
            if has_paid_order:
                legit_paid += 1
                continue

            # 10. Any PAID subscription_payments row (checks status too, not just existence)
            try:
                has_sub_payment = await db.subscription_payments.find_one(
                    {"user_id": uid, "status": "paid"},
                    {"_id": 0, "payment_id": 1},
                )
                if has_sub_payment:
                    legit_prc += 1
                    continue
            except Exception:
                pass  # collection may not exist — non-fatal

            # 11. Legacy transactions with type='subscription_prc' / 'subscription_payment'
            try:
                has_sub_tx = await db.transactions.find_one(
                    {"user_id": uid,
                     "type": {"$in": [
                         "subscription_prc", "subscription_payment",
                         "subscription", "elite_activation", "plan_purchase",
                     ]}},
                    {"_id": 0, "type": 1},
                )
                if has_sub_tx:
                    legit_tx_subscription += 1
                    continue
            except Exception:
                pass

            # ── SUSPICIOUS ──
            # Enrich with recent cancelled/failed orders for context
            recent_cancelled = await db.razorpay_orders.find(
                {"user_id": uid,
                 "status": {"$in": ["cancelled", "failed", "error", "timeout", "dismissed"]}},
                {"_id": 0, "order_id": 1, "status": 1, "created_at": 1, "amount": 1},
            ).sort("created_at", -1).to_list(5)
            total_orders = await db.razorpay_orders.count_documents({"user_id": uid})

            suspicious.append({
                "uid": uid,
                "name": u.get("name"),
                "email": u.get("email"),
                "mobile": u.get("mobile"),
                "current_plan": u.get("subscription_plan"),
                "membership_type": u.get("membership_type"),
                "role": u.get("role"),
                "subscription_start": str(u.get("subscription_start") or ""),
                "subscription_expiry": str(u.get("subscription_expiry") or ""),
                "created_at": str(u.get("created_at") or ""),
                "total_razorpay_orders": total_orders,
                "recent_cancelled_orders": [
                    {
                        "order_id": o.get("order_id"),
                        "status": o.get("status"),
                        "amount": o.get("amount"),
                        "created_at": str(o.get("created_at") or ""),
                    }
                    for o in recent_cancelled
                ],
                "reason": (
                    "on_paid_plan_no_paid_orders_no_prc_payment"
                    if total_orders == 0
                    else "on_paid_plan_only_cancelled_or_failed_orders"
                ),
            })

            if not dry_run and len(suspicious) <= limit:
                await db.users.update_one(
                    {"uid": uid},
                    {"$set": {
                        "subscription_plan": "explorer",
                        "subscription_expiry": None,
                        "previous_plan_at_downgrade": u.get("subscription_plan"),
                        "downgrade_reason": "audit_paid_plans_without_payment",
                        "downgrade_date": datetime.now(timezone.utc).isoformat(),
                        "admin_fixed": True,
                    }}
                )

        # Cap the response payload for network safety
        return {
            "success": True,
            "dry_run": dry_run,
            "summary": {
                "total_users_on_paid_plan": len(users_on_paid_plan),
                "legit_admin_or_staff_role": legit_admin_role,
                "legit_admin_granted_flag": legit_admin_granted,
                "legit_vip_migration": legit_vip_migration,
                "legit_prc_flag": legit_prc_flag,
                "legit_gift_recipient": legit_gift_recipient,
                "legit_activated_via": legit_activated_via,
                "legit_subscription_history": legit_sub_history,
                "legit_last_payment_id": legit_last_payment_id,
                "legit_paid_razorpay_order": legit_paid,
                "legit_paid_subscription_payments": legit_prc,
                "legit_legacy_subscription_transaction": legit_tx_subscription,
                "suspicious_count": len(suspicious),
                "legit_total": (
                    legit_admin_role + legit_admin_granted + legit_vip_migration
                    + legit_prc_flag + legit_gift_recipient + legit_activated_via
                    + legit_sub_history + legit_last_payment_id
                    + legit_paid + legit_prc + legit_tx_subscription
                ),
            },
            "suspicious_users": suspicious[:limit],
            "message": (
                f"Found {len(suspicious)} paid-plan users with NO evidence of payment "
                f"across 11 checked sources (paid order / PAID subscription_payments / "
                f"subscription tx / admin flags / VIP migration / PRC flag / admin role / "
                f"gift recipient / activated_via / subscription_history / last_payment_id). "
                f"{'DRY RUN — no changes made. ' if dry_run else 'DOWNGRADED all to Explorer. '}"
                "Enhanced Feb 6 2026 audit."
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[AUDIT-PAID] Error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")




@router.post("/admin/bulk-reverse-subscriptions")
async def bulk_reverse_subscriptions(request: Request):
    """
    BULK REVERSE: Downgrade multiple users to Explorer at once.
    
    Usage:
    curl -X POST "/api/razorpay/admin/bulk-reverse-subscriptions" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456", "emails": ["a@b.com", "c@d.com"], "reason": "Cancelled orders"}'
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        emails = data.get("emails", [])
        user_ids = data.get("user_ids", [])
        reason = data.get("reason", "Bulk admin reversal")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        if not emails and not user_ids:
            raise HTTPException(status_code=400, detail="emails or user_ids list required")
        
        results = []
        success_count = 0
        
        # Process by email
        for email in emails:
            user = await db.users.find_one({"email": email})
            if not user:
                results.append({"email": email, "status": "not_found"})
                continue
            
            old_plan = user.get("subscription_plan")
            if old_plan != "elite":
                results.append({"email": email, "name": user.get("name"), "status": "already_explorer"})
                continue
            
            await db.users.update_one(
                {"email": email},
                {
                    "$set": {
                        "subscription_plan": "explorer",
                        "subscription_expiry": None,
                        "subscription_start": None,
                        "downgrade_reason": reason,
                        "downgrade_date": datetime.now(timezone.utc).isoformat(),
                        "admin_reversed": True
                    }
                }
            )
            results.append({"email": email, "name": user.get("name"), "status": "reversed"})
            success_count += 1
            logging.info(f"[BULK-REVERSE] {email} ({user.get('name')}) reversed to Explorer")
        
        # Process by user_id
        for uid in user_ids:
            user = await db.users.find_one({"user_id": uid})
            if not user:
                results.append({"user_id": uid, "status": "not_found"})
                continue
            
            old_plan = user.get("subscription_plan")
            if old_plan != "elite":
                results.append({"user_id": uid, "name": user.get("name"), "status": "already_explorer"})
                continue
            
            await db.users.update_one(
                {"user_id": uid},
                {
                    "$set": {
                        "subscription_plan": "explorer",
                        "subscription_expiry": None,
                        "subscription_start": None,
                        "downgrade_reason": reason,
                        "downgrade_date": datetime.now(timezone.utc).isoformat(),
                        "admin_reversed": True
                    }
                }
            )
            results.append({"user_id": uid, "name": user.get("name"), "status": "reversed"})
            success_count += 1
            logging.info(f"[BULK-REVERSE] {uid} ({user.get('name')}) reversed to Explorer")
        
        return {
            "success": True,
            "total_processed": len(results),
            "reversed_count": success_count,
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[BULK-REVERSE] Error: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")




@router.post("/admin/reverse-subscription")
async def reverse_single_subscription(request: Request):
    """
    Reverse subscription for a single user.
    
    Usage:
    curl -X POST "/api/razorpay/admin/reverse-subscription" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456", "user_id": "xxx", "reason": "Cancelled order"}'
    
    Can also search by email:
      -d '{"admin_pin": "123456", "email": "user@example.com", "reason": "Cancelled order"}'
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        user_id = data.get("user_id")
        email = data.get("email")
        reason = data.get("reason", "Admin reversed subscription")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        if not user_id and not email:
            raise HTTPException(status_code=400, detail="user_id or email required")
        
        # Get user by user_id or email
        query = {"user_id": user_id} if user_id else {"email": email}
        user = await db.users.find_one(query)
        if not user:
            raise HTTPException(status_code=404, detail=f"User not found with {'user_id' if user_id else 'email'}: {user_id or email}")
        
        actual_user_id = user.get("user_id")
        old_plan = user.get("subscription_plan")
        old_expiry = user.get("subscription_expiry")
        
        # Downgrade to Explorer
        await db.users.update_one(
            {"user_id": actual_user_id},
            {
                "$set": {
                    "subscription_plan": "explorer",
                    "subscription_expiry": None,
                    "subscription_start": None,
                    "downgrade_reason": reason,
                    "downgrade_date": datetime.now(timezone.utc).isoformat(),
                    "admin_reversed": True
                }
            }
        )
        
        logging.info(f"[REVERSE-SUB] {actual_user_id} ({user.get('name')}) reversed from {old_plan} to Explorer - {reason}")
        
        return {
            "success": True,
            "message": f"Subscription reversed for {user.get('name')}",
            "user_id": actual_user_id,
            "name": user.get("name"),
            "email": user.get("email"),
            "previous_plan": old_plan,
            "previous_expiry": str(old_expiry),
            "new_plan": "explorer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[REVERSE-SUB] Error: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")



# ==================== REVENUE DASHBOARD APIs ====================

@router.get("/admin/revenue-dashboard")
async def get_revenue_dashboard():
    """Revenue dashboard powered by a single MongoDB `$facet` aggregation.

    PERF: All time-bucket groupings (today/week/month/year/total),
    daily-30 + monthly-12 chart data, payment-method split and plan breakdown
    are computed **server-side** in one round-trip — replacing the previous
    `to_list(10000)` + Python loop that scaled linearly with paid-order count.
    Plus a 60 s in-process cache so refreshes are instant.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")

    # Cache hit fast-path
    now_mono = _time.monotonic()
    if _REVENUE_DASHBOARD_CACHE["data"] is not None and \
       (now_mono - _REVENUE_DASHBOARD_CACHE["ts"]) < _REVENUE_DASHBOARD_TTL:
        return _REVENUE_DASHBOARD_CACHE["data"]

    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=now.weekday())
        month_start = today_start.replace(day=1)
        year_start = today_start.replace(month=1, day=1)
        thirty_days_ago = today_start - timedelta(days=30)
        twelve_months_ago = today_start - timedelta(days=365)

        # paid_at is stored as ISO string — parse server-side once, reuse across facets.
        # status:paid filter runs first to leverage the index on (status, paid_at -1).
        revenue_pipeline = [
            {"$match": {"status": "paid"}},
            {"$addFields": {
                "_paid_at_dt": {
                    "$dateFromString": {
                        "dateString": {"$ifNull": ["$paid_at", "$created_at"]},
                        "onError": None,
                        "onNull": None,
                    }
                }
            }},
            {"$facet": {
                "totals": [
                    {"$group": {"_id": None, "amount": {"$sum": "$amount"}, "count": {"$sum": 1}}}
                ],
                "today":     [{"$match": {"_paid_at_dt": {"$gte": today_start}}},
                              {"$group": {"_id": None, "amount": {"$sum": "$amount"}}}],
                "week":      [{"$match": {"_paid_at_dt": {"$gte": week_start}}},
                              {"$group": {"_id": None, "amount": {"$sum": "$amount"}}}],
                "month":     [{"$match": {"_paid_at_dt": {"$gte": month_start}}},
                              {"$group": {"_id": None, "amount": {"$sum": "$amount"}}}],
                "year":      [{"$match": {"_paid_at_dt": {"$gte": year_start}}},
                              {"$group": {"_id": None, "amount": {"$sum": "$amount"}}}],
                "daily": [
                    {"$match": {"_paid_at_dt": {"$gte": thirty_days_ago}}},
                    {"$group": {
                        "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$_paid_at_dt"}},
                        "revenue": {"$sum": "$amount"}
                    }},
                    {"$sort": {"_id": 1}}
                ],
                "monthly": [
                    {"$match": {"_paid_at_dt": {"$gte": twelve_months_ago}}},
                    {"$group": {
                        "_id": {"$dateToString": {"format": "%Y-%m", "date": "$_paid_at_dt"}},
                        "revenue": {"$sum": "$amount"}
                    }},
                    {"$sort": {"_id": 1}}
                ],
                "payment_methods": [
                    {"$group": {
                        "_id": {"$ifNull": ["$payment_method", "other"]},
                        "amount": {"$sum": "$amount"}
                    }}
                ],
                "plans": [
                    {"$group": {
                        "_id": {"$toLower": {"$ifNull": ["$plan_name", ""]}},
                        "amount": {"$sum": "$amount"}
                    }}
                ],
            }}
        ]

        # Fire the aggregation + 2 counts in parallel — true wall-clock = max(slowest)
        agg_task = db.razorpay_orders.aggregate(revenue_pipeline, allowDiskUse=True).to_list(1)
        total_orders_task = db.razorpay_orders.count_documents({})
        failed_count_task = db.razorpay_orders.count_documents({"status": {"$in": ["failed", "error"]}})
        agg_results, total_orders, failed_count = await asyncio.gather(
            agg_task, total_orders_task, failed_count_task
        )

        facet = agg_results[0] if agg_results else {}

        def _amount(key):
            arr = facet.get(key) or []
            return arr[0]["amount"] if arr else 0

        total_revenue = _amount("totals")
        paid_count = (facet.get("totals") or [{"count": 0}])[0].get("count", 0) if facet.get("totals") else 0
        today_revenue = _amount("today")
        week_revenue = _amount("week")
        month_revenue = _amount("month")
        year_revenue = _amount("year")

        # Build full 30-day chart with zero-fill for missing days
        daily_map = {row["_id"]: row["revenue"] for row in (facet.get("daily") or [])}
        daily_chart = []
        for i in range(29, -1, -1):
            d = (today_start - timedelta(days=i)).strftime("%Y-%m-%d")
            daily_chart.append({"date": d, "revenue": daily_map.get(d, 0)})

        # Build full 12-month chart with zero-fill
        monthly_map = {row["_id"]: row["revenue"] for row in (facet.get("monthly") or [])}
        monthly_chart = []
        m_iter = today_start.replace(day=1)
        for _ in range(12):
            mk = m_iter.strftime("%Y-%m")
            monthly_chart.insert(0, {"month": mk, "revenue": monthly_map.get(mk, 0)})
            # rewind one month
            if m_iter.month == 1:
                m_iter = m_iter.replace(year=m_iter.year - 1, month=12)
            else:
                m_iter = m_iter.replace(month=m_iter.month - 1)

        # Payment methods — bucket unknowns into 'other'
        payment_methods = {"upi": 0, "card": 0, "netbanking": 0, "wallet": 0, "other": 0}
        for row in (facet.get("payment_methods") or []):
            method = (row.get("_id") or "other")
            amount = row.get("amount", 0)
            if method in payment_methods:
                payment_methods[method] += amount
            else:
                payment_methods["other"] += amount

        # Plans — bucket by substring match (server returns ~tens of unique plan_names, fast in Python)
        plan_revenue = {"elite": 0, "startup": 0, "growth": 0, "other": 0}
        for row in (facet.get("plans") or []):
            plan = (row.get("_id") or "").lower()
            amount = row.get("amount", 0)
            if "elite" in plan:
                plan_revenue["elite"] += amount
            elif "startup" in plan:
                plan_revenue["startup"] += amount
            elif "growth" in plan:
                plan_revenue["growth"] += amount
            else:
                plan_revenue["other"] += amount

        success_rate = (paid_count / total_orders * 100) if total_orders > 0 else 0

        payload = {
            "success": True,
            "revenue": {
                "total": total_revenue,
                "today": today_revenue,
                "this_week": week_revenue,
                "this_month": month_revenue,
                "this_year": year_revenue
            },
            "charts": {
                "daily": daily_chart,
                "monthly": monthly_chart
            },
            "payment_methods": payment_methods,
            "plan_breakdown": plan_revenue,
            "stats": {
                "total_orders": total_orders,
                "paid_orders": paid_count,
                "failed_orders": failed_count,
                "success_rate": round(success_rate, 1)
            }
        }
        # Warm the 60 s cache before returning
        _REVENUE_DASHBOARD_CACHE["data"] = payload
        _REVENUE_DASHBOARD_CACHE["ts"] = _time.monotonic()
        return payload
        
    except Exception as e:
        logging.error(f"[REVENUE-DASHBOARD] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/orders-by-date")
async def get_orders_by_date_range(
    date_from: str = None,
    date_to: str = None,
    status: str = None,
    search: str = None,
    limit: int = 100,
    skip: int = 0
):
    """Get orders filtered by date range"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        query = {}
        
        # Date range filter
        if date_from or date_to:
            date_query = {}
            if date_from:
                try:
                    from_date = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    date_query["$gte"] = from_date
                except:
                    pass
            if date_to:
                try:
                    to_date = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                    date_query["$lte"] = to_date
                except:
                    pass
            if date_query:
                query["$or"] = [
                    {"paid_at": date_query},
                    {"created_at": date_query}
                ]
        
        # Status filter
        if status and status != "all":
            query["status"] = status
        
        # Search filter
        if search:
            search_conditions = [
                {"order_id": {"$regex": search, "$options": "i"}},
                {"payment_id": {"$regex": search, "$options": "i"}},
                {"user_name": {"$regex": search, "$options": "i"}},
                {"user_email": {"$regex": search, "$options": "i"}},
                {"user_mobile": {"$regex": search, "$options": "i"}},
                {"payment_vpa": {"$regex": search, "$options": "i"}},
                {"acquirer_data.rrn": {"$regex": search, "$options": "i"}}
            ]
            if "$or" in query:
                # Combine with date filter using $and
                query = {"$and": [query, {"$or": search_conditions}]}
            else:
                query["$or"] = search_conditions
        
        orders = await db.razorpay_orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.razorpay_orders.count_documents(query)
        
        # Calculate totals for filtered results
        all_filtered = await db.razorpay_orders.find(query).to_list(10000)
        total_amount = sum(o.get("amount", 0) for o in all_filtered if o.get("status") == "paid")
        
        # Format orders
        result = []
        for order in orders:
            acquirer_data = order.get("acquirer_data", {})
            utr = acquirer_data.get("rrn") or acquirer_data.get("utr") or acquirer_data.get("bank_transaction_id")
            
            result.append({
                "order_id": order.get("order_id"),
                "user_id": order.get("user_id"),
                "user_name": order.get("user_name", "Unknown"),
                "user_email": order.get("user_email"),
                "user_mobile": order.get("user_mobile"),
                "plan_name": order.get("plan_name", "").title(),
                "plan_type": order.get("plan_type"),
                "amount": order.get("amount", 0),
                "status": order.get("status"),
                "payment_id": order.get("payment_id"),
                "payment_method": order.get("payment_method"),
                "payment_vpa": order.get("payment_vpa"),
                "utr_number": utr,
                "created_at": order.get("created_at"),
                "paid_at": order.get("paid_at"),
                "refund_id": order.get("refund_id"),
                "refund_status": order.get("refund_status"),
                "refunded_at": order.get("refunded_at")
            })
        
        return {
            "success": True,
            "orders": result,
            "total": total,
            "filtered_revenue": total_amount
        }
        
    except Exception as e:
        logging.error(f"[ORDERS-BY-DATE] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== INVOICE GENERATION ====================

@router.get("/admin/invoice/{order_id}")
async def generate_invoice(order_id: str):
    """Generate invoice data for a paid order"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        order = await db.razorpay_orders.find_one({"order_id": order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order.get("status") != "paid":
            raise HTTPException(status_code=400, detail="Invoice can only be generated for paid orders")
        
        # Get user details
        user = await db.users.find_one({"uid": order.get("user_id")}, {"_id": 0})
        
        # Generate invoice number
        paid_at = order.get("paid_at") or order.get("created_at")
        if isinstance(paid_at, str):
            try:
                paid_at = datetime.fromisoformat(paid_at.replace('Z', '+00:00'))
            except:
                paid_at = datetime.now(timezone.utc)
        
        invoice_number = f"PR-{paid_at.strftime('%Y%m%d')}-{order_id[-6:].upper()}"
        
        # Calculate GST (18%)
        amount = order.get("amount", 0)
        base_amount = round(amount / 1.18, 2)
        gst_amount = round(amount - base_amount, 2)
        
        # Plan details
        plan_name = order.get("plan_name", "Elite").title()
        plan_type = order.get("plan_type", "monthly").title()
        
        duration_map = {
            "monthly": "1 Month",
            "quarterly": "3 Months",
            "half_yearly": "6 Months",
            "yearly": "12 Months"
        }
        duration = duration_map.get(order.get("plan_type", "monthly"), "1 Month")
        
        invoice_data = {
            "invoice_number": invoice_number,
            "invoice_date": paid_at.isoformat() if paid_at else None,
            "order_id": order_id,
            "payment_id": order.get("payment_id"),
            "payment_method": order.get("payment_method", "Online"),
            "utr_number": order.get("acquirer_data", {}).get("rrn"),
            
            # Customer details
            "customer": {
                "name": user.get("full_name") or user.get("name") if user else order.get("user_name", "Customer"),
                "email": user.get("email") if user else order.get("user_email"),
                "mobile": user.get("mobile") if user else order.get("user_mobile"),
                "address": user.get("address") if user else None
            },
            
            # Company details
            "company": {
                "name": "PARAS REWARD TECHNOLOGIES PRIVATE LIMITED",
                "address": "Maharashtra, India",
                "gstin": "27XXXXXXXXXXXXXXX",  # Add your GSTIN
                "pan": "XXXXXXXXXX",  # Add your PAN
                "email": "support@parasreward.com",
                "phone": "+91-XXXXXXXXXX"
            },
            
            # Line items
            "items": [
                {
                    "description": f"{plan_name} Subscription - {plan_type}",
                    "duration": duration,
                    "hsn_code": "998314",  # SAC code for subscription services
                    "quantity": 1,
                    "unit_price": base_amount,
                    "amount": base_amount
                }
            ],
            
            # Totals
            "subtotal": base_amount,
            "cgst": round(gst_amount / 2, 2),
            "sgst": round(gst_amount / 2, 2),
            "igst": 0,  # For same state, use CGST+SGST
            "total_tax": gst_amount,
            "total_amount": amount,
            
            # Payment status
            "payment_status": "PAID",
            "paid_at": paid_at.isoformat() if paid_at else None
        }
        
        return {
            "success": True,
            "invoice": invoice_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[INVOICE] Error generating invoice for {order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== REFUND PROCESSING ====================

class RefundRequest(BaseModel):
    order_id: str
    reason: str
    amount: Optional[float] = None  # None = full refund
    admin_pin: str


@router.post("/admin/initiate-refund")
async def initiate_refund(request: RefundRequest):
    """Initiate refund for a paid order via Razorpay API"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    # Verify admin PIN
    if request.admin_pin != "153759":
        raise HTTPException(status_code=403, detail="Invalid admin PIN")
    
    try:
        # Get order
        order = await db.razorpay_orders.find_one({"order_id": request.order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order.get("status") != "paid":
            raise HTTPException(status_code=400, detail=f"Cannot refund order with status: {order.get('status')}")
        
        if order.get("refund_status") == "processed":
            raise HTTPException(status_code=400, detail="Order already refunded")
        
        payment_id = order.get("payment_id")
        if not payment_id:
            raise HTTPException(status_code=400, detail="Payment ID not found for this order")
        
        # Calculate refund amount
        original_amount = order.get("amount", 0)
        refund_amount = request.amount if request.amount else original_amount
        
        if refund_amount > original_amount:
            raise HTTPException(status_code=400, detail=f"Refund amount cannot exceed original amount (₹{original_amount})")
        
        # Convert to paise
        refund_amount_paise = int(refund_amount * 100)
        
        # Initiate refund via Razorpay
        try:
            refund = razorpay_client.payment.refund(payment_id, {
                "amount": refund_amount_paise,
                "speed": "normal",  # or "optimum" for instant refund
                "notes": {
                    "reason": request.reason,
                    "order_id": request.order_id,
                    "initiated_by": "admin"
                }
            })
            
            logging.info(f"[REFUND] Initiated refund for payment {payment_id}: {refund}")
            
        except Exception as e:
            logging.error(f"[REFUND] Razorpay API error: {e}")
            raise HTTPException(status_code=400, detail=f"Razorpay refund failed: {str(e)}")
        
        # Update order in database
        await db.razorpay_orders.update_one(
            {"order_id": request.order_id},
            {
                "$set": {
                    "refund_id": refund.get("id"),
                    "refund_status": refund.get("status", "pending"),
                    "refund_amount": refund_amount,
                    "refund_reason": request.reason,
                    "refunded_at": datetime.now(timezone.utc),
                    "status": "refunded" if refund.get("status") == "processed" else "refund_pending"
                }
            }
        )
        
        # Get user info
        user = await db.users.find_one({"uid": order.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        
        # Log the refund action
        await db.admin_actions.insert_one({
            "action": "refund_initiated",
            "order_id": request.order_id,
            "payment_id": payment_id,
            "refund_id": refund.get("id"),
            "refund_amount": refund_amount,
            "reason": request.reason,
            "user_id": order.get("user_id"),
            "user_name": user.get("name") if user else None,
            "timestamp": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "message": f"Refund of ₹{refund_amount} initiated successfully",
            "refund": {
                "id": refund.get("id"),
                "status": refund.get("status"),
                "amount": refund_amount,
                "payment_id": payment_id,
                "speed": refund.get("speed", "normal")
            },
            "user": {
                "name": user.get("name") if user else order.get("user_name"),
                "email": user.get("email") if user else order.get("user_email")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[REFUND] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/refund-status/{order_id}")
async def get_refund_status(order_id: str):
    """Check refund status from Razorpay"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    try:
        order = await db.razorpay_orders.find_one({"order_id": order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        refund_id = order.get("refund_id")
        if not refund_id:
            return {"success": True, "refund_status": "not_initiated", "message": "No refund initiated for this order"}
        
        # Fetch refund status from Razorpay
        try:
            refund = razorpay_client.refund.fetch(refund_id)
            
            # Update local status if changed
            if refund.get("status") != order.get("refund_status"):
                new_status = "refunded" if refund.get("status") == "processed" else "refund_pending"
                await db.razorpay_orders.update_one(
                    {"order_id": order_id},
                    {"$set": {"refund_status": refund.get("status"), "status": new_status}}
                )
            
            return {
                "success": True,
                "refund": {
                    "id": refund.get("id"),
                    "status": refund.get("status"),
                    "amount": refund.get("amount", 0) / 100,
                    "speed": refund.get("speed"),
                    "created_at": refund.get("created_at")
                }
            }
            
        except Exception as e:
            logging.error(f"[REFUND-STATUS] Razorpay API error: {e}")
            return {
                "success": True,
                "refund_status": order.get("refund_status", "unknown"),
                "refund_id": refund_id,
                "message": "Could not fetch latest status from Razorpay"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[REFUND-STATUS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
