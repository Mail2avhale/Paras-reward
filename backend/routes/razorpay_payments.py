"""
Razorpay Payment Gateway Integration
- Create orders for VIP subscriptions
- Verify payments
- Handle webhooks
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
    "monthly": 28,
    "quarterly": 84,
    "half_yearly": 168,
    "yearly": 336
}


@router.get("/config")
async def get_razorpay_config():
    """Get Razorpay public key for frontend"""
    if not RAZORPAY_KEY_ID:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    return {
        "key_id": RAZORPAY_KEY_ID,
        "currency": "INR",
        "company_name": "PARAS REWARD"
    }


@router.post("/create-order")
async def create_razorpay_order(request: CreateOrderRequest):
    """Create a Razorpay order for subscription payment"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    try:
        # Convert amount to paise (Razorpay uses smallest currency unit)
        amount_paise = int(request.amount * 100)
        
        # Create Razorpay order
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"order_{request.user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
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
    """Verify payment signature and activate subscription"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    try:
        # Verify signature
        params_dict = {
            'razorpay_order_id': request.razorpay_order_id,
            'razorpay_payment_id': request.razorpay_payment_id,
            'razorpay_signature': request.razorpay_signature
        }
        
        # Generate signature to verify
        message = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != request.razorpay_signature:
            raise HTTPException(status_code=400, detail="Invalid payment signature")
        
        # Get order details from database
        order = await db.razorpay_orders.find_one({"order_id": request.razorpay_order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Update order status
        await db.razorpay_orders.update_one(
            {"order_id": request.razorpay_order_id},
            {
                "$set": {
                    "status": "paid",
                    "payment_id": request.razorpay_payment_id,
                    "signature": request.razorpay_signature,
                    "paid_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Activate user subscription
        plan_type = order.get("plan_type", "monthly")
        plan_name = order.get("plan_name", "startup")
        duration_days = PLAN_DURATIONS.get(plan_type, 28)
        
        now = datetime.now(timezone.utc)
        expiry_date = now + timedelta(days=duration_days)
        
        # Update user subscription
        await db.users.update_one(
            {"uid": request.user_id},
            {
                "$set": {
                    "subscription_plan": plan_name,
                    "subscription_start": now,
                    "subscription_expires": expiry_date,
                    "membership_type": "vip",
                    "subscription_status": "active",
                    "last_payment_id": request.razorpay_payment_id,
                    "last_payment_date": now
                }
            }
        )
        
        # Log transaction
        await db.transactions.insert_one({
            "user_id": request.user_id,
            "type": "subscription_payment",
            "amount": order.get("amount"),
            "payment_id": request.razorpay_payment_id,
            "order_id": request.razorpay_order_id,
            "plan_name": plan_name,
            "plan_type": plan_type,
            "duration_days": duration_days,
            "timestamp": now
        })
        
        return {
            "success": True,
            "message": "Payment verified and subscription activated",
            "subscription": {
                "plan": plan_name,
                "type": plan_type,
                "expires": expiry_date.isoformat(),
                "duration_days": duration_days
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Payment verification failed: {e}")
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
            
            # Update order status
            if db and order_id:
                await db.razorpay_orders.update_one(
                    {"order_id": order_id},
                    {
                        "$set": {
                            "status": "captured",
                            "webhook_payment_id": payment_id,
                            "captured_at": datetime.now(timezone.utc)
                        }
                    }
                )
            
            logging.info(f"Payment captured: {payment_id}")
        
        elif event == "payment.failed":
            payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment.get("order_id")
            
            if db and order_id:
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
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    payments = await db.razorpay_orders.find(
        {"user_id": user_id, "status": {"$in": ["paid", "captured"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"payments": payments}
