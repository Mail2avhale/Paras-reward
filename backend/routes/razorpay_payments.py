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
                    "expires": str(user_with_this_payment.get("subscription_expiry") or user_with_this_payment.get("subscription_expires"))
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
                    "subscription_status": "active",
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
            from routes.gst_invoice import generate_invoice, calculate_gst, get_next_invoice_number, generate_invoice_pdf
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
    """Handle Razorpay webhooks for payment events - WITH IDEMPOTENCY"""
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
                # SECURITY FIX: Reject invalid signatures to prevent fake webhook attacks
                raise HTTPException(status_code=401, detail="Invalid webhook signature")
        else:
            logging.warning("[WEBHOOK] No signature verification - WEBHOOK SECRET not configured!")
            # Allow processing but log warning - admin should configure webhook secret
        
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
                
                # ==================== STEP 7: UPDATE USER SUBSCRIPTION ====================
                await db.users.update_one(
                    {"uid": user_id},
                    {
                        "$set": {
                            "subscription_plan": plan_name,
                            "subscription_start": now,
                            "subscription_expires": expiry_date,
                            "subscription_expiry": expiry_date.isoformat(),
                            "subscription_status": "active",
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
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")




@router.post("/admin/find-unfixed-subscriptions")
async def find_unfixed_subscriptions(request: Request):
    """
    Find ALL users with extended subscriptions who haven't been fixed yet.
    
    This searches ALL users (not just from transactions) where:
    - subscription_expires - last_payment_date > 35 days
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
            expiry = u.get("subscription_expires") or u.get("subscription_expiry")
            
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
            expiry = user.get("subscription_expires") or user.get("subscription_expiry")
            
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
                            "subscription_expires": correct_expiry,
                            "subscription_expiry": correct_expiry.isoformat(),
                            "vip_expiry": correct_expiry.isoformat(),
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
            current_expiry = user.get("subscription_expires") or user.get("subscription_expiry")
            
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
                                "subscription_expires": correct_expiry,
                                "subscription_expiry": correct_expiry.isoformat(),
                                "vip_expiry": correct_expiry.isoformat(),
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
        current_expiry = user.get("subscription_expires") or user.get("subscription_expiry")
        
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
                    "subscription_expires": correct_expiry,
                    "subscription_expiry": correct_expiry.isoformat(),
                    "vip_expiry": correct_expiry.isoformat(),
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
            
            # Get user
            user = await db.users.find_one({"user_id": user_id})
            if not user:
                continue
            
            current_plan = user.get("subscription_plan", "explorer")
            
            # Only process if user has Elite but order is cancelled
            if current_plan != "elite":
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
                "subscription_expiry": str(user.get("subscription_expiry") or user.get("subscription_expires")),
                "cancelled_order_id": order.get("order_id"),
                "cancelled_reason": order.get("failure_reason", "Unknown")
            })
            
            if not dry_run:
                # Downgrade to Explorer
                await db.users.update_one(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "subscription_plan": "explorer",
                            "subscription_expires": None,
                            "subscription_expiry": None,
                            "subscription_start": None,
                            "downgrade_reason": f"Cancelled order {order.get('order_id')} - no paid orders",
                            "downgrade_date": datetime.now(timezone.utc).isoformat(),
                            "admin_fixed": True
                        }
                    }
                )
                fixed_count += 1
                logging.info(f"[FIX-CANCELLED] Downgraded {user_id} ({user.get('name')}) to Explorer - no paid orders")
        
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
            
            # Get user
            user = await db.users.find_one({"user_id": user_id})
            if not user:
                continue
            
            current_plan = user.get("subscription_plan", "explorer")
            
            # Only show Elite users
            if current_plan != "elite":
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
                "subscription_expiry": str(user.get("subscription_expiry") or user.get("subscription_expires")),
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
                        "subscription_expires": None,
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
                        "subscription_expires": None,
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
        old_expiry = user.get("subscription_expiry") or user.get("subscription_expires")
        
        # Downgrade to Explorer
        await db.users.update_one(
            {"user_id": actual_user_id},
            {
                "$set": {
                    "subscription_plan": "explorer",
                    "subscription_expires": None,
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
