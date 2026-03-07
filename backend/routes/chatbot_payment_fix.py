"""
PARAS REWARD - Chatbot Payment Issue Auto-Resolution
=====================================================
Automatically resolve subscription payment issues via chatbot

Flow:
1. User reports: "Payment झाले पण subscription activate नाही"
2. Chatbot collects: Amount, Date, Payment ID/UTR
3. System searches razorpay_orders matching criteria
4. Verifies with Razorpay API
5. Auto-activates subscription if payment confirmed

Configuration:
- Time Limit: 30 days
- Required: Amount + Date + Payment ID/UTR
- Security: Only logged-in user's own payments
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import os
import requests
import base64
import re

router = APIRouter(prefix="/chatbot-payment-fix", tags=["Chatbot Payment Fix"])

# Database instance
db = None

def set_db(database):
    global db
    db = database

# ==================== CONFIGURATION ====================

TIME_LIMIT_DAYS = 30  # Only resolve payments from last 30 days
MAX_ATTEMPTS_PER_DAY = 5  # Rate limiting

# Razorpay credentials
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")

# ==================== MODELS ====================

class PaymentSearchRequest(BaseModel):
    uid: str
    amount: float = Field(..., gt=0)
    payment_date: str  # DD/MM/YYYY or YYYY-MM-DD format
    payment_id: Optional[str] = None  # pay_xxxx format
    utr_number: Optional[str] = None
    
    @validator('payment_date')
    def parse_date(cls, v):
        # Try multiple date formats
        formats = ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d %m %Y']
        for fmt in formats:
            try:
                parsed = datetime.strptime(v.strip(), fmt)
                return parsed.strftime('%Y-%m-%d')
            except:
                continue
        raise ValueError('Invalid date format. Use DD/MM/YYYY')
    
    @validator('payment_id')
    def validate_payment_id(cls, v):
        if v and not v.startswith('pay_'):
            # Try to extract payment ID
            match = re.search(r'pay_[A-Za-z0-9]+', v)
            if match:
                return match.group()
            return None
        return v

class ResolutionResult(BaseModel):
    success: bool
    message: str
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    plan_activated: Optional[str] = None
    validity_added: Optional[int] = None

# ==================== HELPER FUNCTIONS ====================

def get_razorpay_auth():
    """Get Razorpay API authentication header"""
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        return None
    auth_string = f"{RAZORPAY_KEY_ID}:{RAZORPAY_KEY_SECRET}"
    auth_bytes = base64.b64encode(auth_string.encode()).decode()
    return {"Authorization": f"Basic {auth_bytes}"}

async def verify_razorpay_payment(payment_id: str) -> dict:
    """Verify payment status with Razorpay API"""
    headers = get_razorpay_auth()
    if not headers:
        return {"error": "Razorpay credentials not configured"}
    
    try:
        response = requests.get(
            f"https://api.razorpay.com/v1/payments/{payment_id}",
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"Razorpay API error: {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

async def verify_razorpay_order(order_id: str) -> dict:
    """Get order details from Razorpay API"""
    headers = get_razorpay_auth()
    if not headers:
        return {"error": "Razorpay credentials not configured"}
    
    try:
        response = requests.get(
            f"https://api.razorpay.com/v1/orders/{order_id}",
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"Razorpay API error: {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

async def get_payments_for_order(order_id: str) -> list:
    """Get all payments for an order from Razorpay"""
    headers = get_razorpay_auth()
    if not headers:
        return []
    
    try:
        response = requests.get(
            f"https://api.razorpay.com/v1/orders/{order_id}/payments",
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("items", [])
        return []
    except:
        return []

async def check_rate_limit(uid: str) -> bool:
    """Check if user has exceeded daily resolution attempts"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    attempts = await db.payment_resolution_attempts.count_documents({
        "uid": uid,
        "date": today
    })
    
    return attempts < MAX_ATTEMPTS_PER_DAY

async def log_resolution_attempt(uid: str, request_data: dict, result: dict):
    """Log resolution attempt for audit and rate limiting"""
    await db.payment_resolution_attempts.insert_one({
        "attempt_id": str(uuid.uuid4()),
        "uid": uid,
        "date": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request": request_data,
        "result": result
    })

async def activate_subscription(uid: str, order_doc: dict, payment_info: dict) -> dict:
    """Activate subscription for user after payment verification"""
    now = datetime.now(timezone.utc)
    
    # Get plan details
    plan_type = order_doc.get("plan_type", "basic")
    plan_name = order_doc.get("plan_name", "Basic Plan")
    
    # Plan validity mapping (days)
    plan_validity = {
        "basic": 30,
        "plus": 30,
        "premium": 30,
        "enterprise": 30,
        "explorer": 30
    }
    
    validity_days = plan_validity.get(plan_type.lower(), 30)
    
    # Get current user
    user = await db.users.find_one({"uid": uid})
    if not user:
        return {"success": False, "message": "User not found"}
    
    # Calculate new expiry (add to existing if not expired)
    current_expiry = user.get("subscription_expiry_date") or user.get("subscription_expires")
    
    if current_expiry:
        if isinstance(current_expiry, str):
            try:
                current_expiry = datetime.fromisoformat(current_expiry.replace('Z', '+00:00'))
            except:
                current_expiry = now
        
        if current_expiry > now:
            # Add to existing validity
            new_expiry = current_expiry + timedelta(days=validity_days)
        else:
            # Start fresh
            new_expiry = now + timedelta(days=validity_days)
    else:
        new_expiry = now + timedelta(days=validity_days)
    
    # Update user subscription
    await db.users.update_one(
        {"uid": uid},
        {
            "$set": {
                "subscription_plan": plan_type,
                "subscription_name": plan_name,
                "subscription_status": "active",
                "subscription_expiry_date": new_expiry.isoformat(),
                "subscription_expires": new_expiry.isoformat(),
                "membership_type": "vip" if plan_type.lower() != "explorer" else "free",
                "updated_at": now.isoformat()
            }
        }
    )
    
    # Update order status
    await db.razorpay_orders.update_one(
        {"order_id": order_doc.get("order_id")},
        {
            "$set": {
                "status": "paid",
                "razorpay_payment_id": payment_info.get("id"),
                "payment_verified_at": now.isoformat(),
                "resolved_via": "chatbot_auto_fix",
                "updated_at": now.isoformat()
            }
        }
    )
    
    # Log to vip_payments
    await db.vip_payments.insert_one({
        "payment_id": str(uuid.uuid4()),
        "uid": uid,
        "order_id": order_doc.get("order_id"),
        "razorpay_payment_id": payment_info.get("id"),
        "amount": order_doc.get("amount"),
        "plan_type": plan_type,
        "plan_name": plan_name,
        "validity_days": validity_days,
        "status": "success",
        "resolved_via": "chatbot_auto_fix",
        "created_at": now.isoformat()
    })
    
    # Log transaction
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "uid": uid,
        "type": "subscription_activation",
        "amount": order_doc.get("amount"),
        "reference_id": order_doc.get("order_id"),
        "payment_id": payment_info.get("id"),
        "status": "completed",
        "description": f"Subscription activated via chatbot - {plan_name}",
        "resolved_via": "chatbot_auto_fix",
        "created_at": now.isoformat()
    })
    
    return {
        "success": True,
        "plan_type": plan_type,
        "plan_name": plan_name,
        "validity_days": validity_days,
        "new_expiry": new_expiry.isoformat()
    }

# ==================== API ENDPOINTS ====================

@router.get("/check-pending/{uid}")
async def check_pending_payments(uid: str):
    """Check if user has any pending/unresolved payments"""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=TIME_LIMIT_DAYS)
    
    # Find orders that might need resolution
    pending_orders = await db.razorpay_orders.find({
        "user_id": uid,
        "status": {"$in": ["created", "pending"]},
        "created_at": {"$gte": cutoff_date}
    }, {"_id": 0}).sort("created_at", -1).to_list(length=10)
    
    if not pending_orders:
        return {
            "has_pending": False,
            "message": "कोणतेही pending payments सापडले नाहीत"
        }
    
    return {
        "has_pending": True,
        "count": len(pending_orders),
        "orders": [
            {
                "order_id": o.get("order_id"),
                "amount": o.get("amount"),
                "plan": o.get("plan_name"),
                "date": o.get("created_at").strftime("%d/%m/%Y") if isinstance(o.get("created_at"), datetime) else str(o.get("created_at"))[:10]
            }
            for o in pending_orders
        ],
        "message": f"तुमचे {len(pending_orders)} pending payment(s) सापडले"
    }

@router.post("/search-payment")
async def search_payment(request: PaymentSearchRequest):
    """Search for matching payment based on user input"""
    
    # Rate limiting
    if not await check_rate_limit(request.uid):
        raise HTTPException(
            status_code=429,
            detail=f"दिवसाची limit ({MAX_ATTEMPTS_PER_DAY} attempts) संपली. उद्या पुन्हा प्रयत्न करा."
        )
    
    # Validate at least one identifier provided
    if not request.payment_id and not request.utr_number:
        raise HTTPException(
            status_code=400,
            detail="कृपया Payment ID (pay_xxx) किंवा UTR number द्या"
        )
    
    # Parse date
    try:
        search_date = datetime.strptime(request.payment_date, '%Y-%m-%d')
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Check time limit
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=TIME_LIMIT_DAYS)
    if search_date < cutoff_date.replace(tzinfo=None):
        raise HTTPException(
            status_code=400,
            detail=f"फक्त last {TIME_LIMIT_DAYS} days च्या payments resolve करता येतात. जुन्या payments साठी admin ला contact करा."
        )
    
    result = {
        "found": False,
        "message": "Payment सापडले नाही",
        "details": None
    }
    
    # Strategy 1: Search by Payment ID directly with Razorpay
    if request.payment_id:
        payment_info = await verify_razorpay_payment(request.payment_id)
        
        if "error" not in payment_info:
            # Found payment, verify details
            payment_amount = payment_info.get("amount", 0) / 100  # Convert paise to rupees
            payment_status = payment_info.get("status")
            order_id = payment_info.get("order_id")
            
            # Verify amount matches (allow ±1 rupee tolerance)
            if abs(payment_amount - request.amount) <= 1:
                # Check if this order belongs to the user
                order_doc = await db.razorpay_orders.find_one({
                    "order_id": order_id,
                    "user_id": request.uid
                })
                
                if order_doc:
                    result = {
                        "found": True,
                        "payment_id": request.payment_id,
                        "order_id": order_id,
                        "amount": payment_amount,
                        "status": payment_status,
                        "plan": order_doc.get("plan_name"),
                        "order_status": order_doc.get("status"),
                        "can_resolve": payment_status == "captured" and order_doc.get("status") != "paid"
                    }
                else:
                    result["message"] = "हे payment तुमच्या account शी match होत नाही"
            else:
                result["message"] = f"Amount match होत नाही. Payment: ₹{payment_amount}, तुम्ही सांगितले: ₹{request.amount}"
    
    # Strategy 2: Search in our database by amount + date
    if not result["found"]:
        date_start = search_date - timedelta(days=1)
        date_end = search_date + timedelta(days=1)
        
        # Search orders
        order_doc = await db.razorpay_orders.find_one({
            "user_id": request.uid,
            "amount": {"$gte": request.amount - 1, "$lte": request.amount + 1},
            "created_at": {"$gte": date_start, "$lte": date_end}
        })
        
        if order_doc:
            # Check with Razorpay if any payment was made for this order
            payments = await get_payments_for_order(order_doc.get("order_id"))
            
            for payment in payments:
                if payment.get("status") == "captured":
                    result = {
                        "found": True,
                        "payment_id": payment.get("id"),
                        "order_id": order_doc.get("order_id"),
                        "amount": payment.get("amount", 0) / 100,
                        "status": payment.get("status"),
                        "plan": order_doc.get("plan_name"),
                        "order_status": order_doc.get("status"),
                        "can_resolve": order_doc.get("status") != "paid"
                    }
                    break
    
    # Log attempt
    await log_resolution_attempt(
        request.uid,
        {
            "amount": request.amount,
            "date": request.payment_date,
            "payment_id": request.payment_id,
            "utr": request.utr_number
        },
        result
    )
    
    return result

@router.post("/resolve-payment")
async def resolve_payment(request: PaymentSearchRequest):
    """Search and auto-resolve payment issue"""
    
    # First search for the payment
    search_result = await search_payment(request)
    
    if not search_result.get("found"):
        return ResolutionResult(
            success=False,
            message=search_result.get("message", "Payment सापडले नाही. कृपया details check करा.")
        )
    
    if not search_result.get("can_resolve"):
        if search_result.get("order_status") == "paid":
            return ResolutionResult(
                success=False,
                message="हे payment आधीच activate झाले आहे! कृपया app restart करा आणि check करा."
            )
        return ResolutionResult(
            success=False,
            message=f"Payment status: {search_result.get('status')}. Auto-resolve होऊ शकत नाही. Admin ला contact करा."
        )
    
    # Get order document
    order_doc = await db.razorpay_orders.find_one({
        "order_id": search_result.get("order_id")
    })
    
    if not order_doc:
        return ResolutionResult(
            success=False,
            message="Order record सापडले नाही"
        )
    
    # Activate subscription
    activation_result = await activate_subscription(
        request.uid,
        order_doc,
        {"id": search_result.get("payment_id")}
    )
    
    if activation_result.get("success"):
        return ResolutionResult(
            success=True,
            message=f"✅ तुमचे payment verify झाले आणि subscription activate झाली!",
            order_id=search_result.get("order_id"),
            payment_id=search_result.get("payment_id"),
            plan_activated=activation_result.get("plan_name"),
            validity_added=activation_result.get("validity_days")
        )
    else:
        return ResolutionResult(
            success=False,
            message=activation_result.get("message", "Activation failed")
        )

@router.get("/resolution-history/{uid}")
async def get_resolution_history(uid: str, limit: int = 10):
    """Get user's payment resolution attempt history"""
    attempts = await db.payment_resolution_attempts.find(
        {"uid": uid},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    return {"attempts": attempts, "total": len(attempts)}

@router.get("/admin/stats")
async def get_resolution_stats():
    """Admin stats for payment resolutions"""
    
    total_attempts = await db.payment_resolution_attempts.count_documents({})
    
    # Successful resolutions (from vip_payments with chatbot tag)
    successful = await db.vip_payments.count_documents({
        "resolved_via": "chatbot_auto_fix"
    })
    
    # Today's attempts
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    today_attempts = await db.payment_resolution_attempts.count_documents({
        "date": today
    })
    
    return {
        "total_attempts": total_attempts,
        "successful_resolutions": successful,
        "today_attempts": today_attempts
    }
