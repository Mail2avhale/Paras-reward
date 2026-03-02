"""
Unified Redeem System v2 - Complete Rewrite
=============================================
PhonePe-style unified interface for all Eko services:
- Mobile Recharge
- DTH Recharge
- Electricity Bill
- Gas Bill (PNG)
- EMI Payment
- DMT (Money Transfer to Bank)

Features:
- Admin approval workflow for all transactions
- New charging logic: Eko charge + ₹10 flat + 20% admin charge
- Advanced admin dashboard with filters & pagination
- Eko API integration for actual payments
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging
import uuid
import os
import httpx
import hashlib
import hmac
import base64
import time
import json

router = APIRouter(prefix="/redeem", tags=["Unified Redeem v2"])

# Database reference
db = None

def set_db(database):
    global db
    db = database

# ==================== EKO CONFIGURATION ====================

EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")

def generate_eko_secret_key(timestamp: str) -> str:
    """Generate secret key for Eko API authentication"""
    key = EKO_AUTHENTICATOR_KEY
    encoded_key = base64.b64encode(key.encode()).decode()
    signature = hmac.new(
        encoded_key.encode(),
        timestamp.encode(),
        hashlib.sha256
    ).digest()
    return base64.b64encode(signature).decode()

def generate_eko_request_hash(timestamp: str, utility_acc_no: str, amount: str, user_code: str) -> str:
    """Generate request hash for Eko API"""
    key = EKO_AUTHENTICATOR_KEY
    encoded_key = base64.b64encode(key.encode()).decode()
    data = f"{timestamp}{utility_acc_no}{amount}{user_code}"
    signature = hmac.new(
        encoded_key.encode(),
        data.encode(),
        hashlib.sha256
    ).digest()
    return base64.b64encode(signature).decode()

# ==================== CONSTANTS ====================

# Service Types
SERVICE_TYPES = {
    "mobile_recharge": {"name": "Mobile Recharge", "icon": "smartphone", "category": 5},
    "dth": {"name": "DTH Recharge", "icon": "tv", "category": 4},
    "electricity": {"name": "Electricity Bill", "icon": "zap", "category": 8},
    "gas": {"name": "Gas Bill (PNG)", "icon": "flame", "category": 2},
    "emi": {"name": "EMI Payment", "icon": "building", "category": 21},
    "dmt": {"name": "Bank Transfer (DMT)", "icon": "banknote", "category": 0}
}

# Charging Logic
PLATFORM_FEE = 10  # ₹10 flat fee
ADMIN_CHARGE_PERCENT = 20  # 20% of transaction amount
PRC_RATE = 10  # 10 PRC = ₹1

# Status Flow
STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_REJECTED = "rejected"


# ==================== EKO API FUNCTIONS ====================

async def get_eko_balance() -> dict:
    """Get Eko wallet balance"""
    try:
        timestamp = str(int(datetime.now().timestamp() * 1000))
        secret_key = generate_eko_secret_key(timestamp)
        
        url = f"{EKO_BASE_URL}/v1/user/balance"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params, headers=headers)
            data = response.json()
            
            if data.get("status") == 0 or data.get("response_status_id") == 0:
                return {
                    "success": True,
                    "balance": data.get("data", {}).get("balance", 0),
                    "locked_amount": data.get("data", {}).get("locked_amount", 0)
                }
            else:
                return {
                    "success": False,
                    "balance": 0,
                    "error": data.get("message", "Failed to get balance")
                }
    except Exception as e:
        logging.error(f"Eko balance error: {str(e)}")
        return {"success": False, "balance": 0, "error": str(e)}


async def execute_eko_recharge(request_doc: dict) -> dict:
    """
    Execute mobile/DTH recharge via Eko BBPS API
    Uses the verified working authentication from eko_payments module
    """
    try:
        details = request_doc.get("details", {})
        amount = str(int(request_doc["amount_inr"]))
        mobile = details.get("mobile_number") or details.get("consumer_number") or ""
        operator = str(details.get("operator_id") or details.get("operator", ""))
        
        # Import the working function from eko_payments
        # This uses module-level EKO credentials which are properly loaded
        from routes.eko_payments import test_recharge_exact_format
        
        logging.info(f"[EKO] Executing recharge: mobile={mobile}, operator={operator}, amount={amount}")
        
        # Call the working endpoint function directly
        result = await test_recharge_exact_format(mobile=mobile, operator=operator, amount=amount)
        
        if result.get("success"):
            eko_response = result.get("eko_response", {})
            return {
                "success": True,
                "status": "SUCCESS",
                "eko_tid": eko_response.get("data", {}).get("tid"),
                "utr": eko_response.get("data", {}).get("bbpstrxnrefid"),
                "message": eko_response.get("message", "Recharge successful")
            }
        else:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": result.get("eko_response", {}).get("status"),
                "message": result.get("eko_response", {}).get("message", "Transaction failed")
            }
            
    except Exception as e:
        logging.error(f"[EKO] Recharge error: {str(e)}")
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e)
        }
            
    except Exception as e:
        logging.error(f"Eko recharge error: {str(e)}")
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e)
        }


async def execute_eko_dmt(request_doc: dict) -> dict:
    """Execute DMT (Bank Transfer) via Eko API"""
    try:
        from routes.eko_payments import make_eko_request, EKO_USER_CODE as EKO_UC
        
        details = request_doc.get("details", {})
        amount = str(int(request_doc["amount_inr"]))
        account_no = details.get("account_number", "")
        ifsc = details.get("ifsc_code", "")
        
        body = {
            "recipient_name": details.get("account_holder", "Customer"),
            "account": account_no,
            "ifsc": ifsc,
            "amount": amount,
            "user_code": EKO_UC,
            "client_ref_id": request_doc["request_id"],
            "sender_mobile": details.get("mobile", EKO_INITIATOR_ID),
            "channel": "2",  # IMPS
            "source_ip": "127.0.0.1",
            "latlong": "19.0760,72.8777"
        }
        
        logging.info(f"Eko DMT Request: {body}")
        
        result = await make_eko_request(
            "/v1/dmt/transaction",
            method="POST",
            data=body
        )
        
        logging.info(f"Eko DMT Response: {result}")
        
        status_code = str(result.get("status", result.get("response_status_id", -1)))
        
        if status_code == "0":
            return {
                "success": True,
                "status": "SUCCESS",
                "eko_tid": result.get("data", {}).get("tid") or result.get("txn_id"),
                "utr": result.get("data", {}).get("utr"),
                "message": "Transfer successful"
            }
        elif status_code == "2":
            return {
                "success": True,
                "status": "PROCESSING",
                "eko_tid": result.get("data", {}).get("tid") or result.get("txn_id"),
                "message": "Transfer processing"
            }
        else:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": status_code,
                "message": result.get("message", "Transfer failed")
            }
            
    except Exception as e:
        logging.error(f"Eko DMT error: {str(e)}")
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e)
        }


# ==================== MODELS ====================

class RedeemRequestCreate(BaseModel):
    """Create a new redeem request"""
    user_id: str
    service_type: str  # mobile_recharge, dth, electricity, gas, emi, dmt
    amount: float = Field(..., gt=0, description="Transaction amount in INR")
    details: Dict[str, Any]  # Service-specific details
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "service_type": "mobile_recharge",
                "amount": 199,
                "details": {
                    "mobile_number": "9876543210",
                    "operator": "JIO",
                    "circle": "MH"
                }
            }
        }


class AdminApproveRequest(BaseModel):
    """Admin approval for redeem request"""
    request_id: str
    admin_id: str
    action: str = Field(..., pattern="^(approve|reject)$")
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class AdminCompleteRequest(BaseModel):
    """Admin marks transaction as completed (manual)"""
    request_id: str
    admin_id: str
    eko_tid: Optional[str] = None
    utr_number: Optional[str] = None
    completion_notes: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================

def calculate_charges(amount: float) -> dict:
    """
    Calculate all charges for a transaction
    
    Formula:
    - Platform Fee: ₹10 (flat)
    - Admin Charge: 20% of transaction amount
    - Total = Amount + Platform Fee + Admin Charge
    
    Note: Eko's service charge is included in the amount itself
    """
    amount_inr = float(amount)
    platform_fee = PLATFORM_FEE
    admin_charge = round(amount_inr * (ADMIN_CHARGE_PERCENT / 100))
    total_charges = platform_fee + admin_charge
    total_amount = amount_inr + total_charges
    
    return {
        "amount_inr": amount_inr,
        "platform_fee_inr": platform_fee,
        "admin_charge_inr": admin_charge,
        "admin_charge_percent": ADMIN_CHARGE_PERCENT,
        "total_charges_inr": total_charges,
        "total_amount_inr": total_amount,
        # PRC equivalents (10 PRC = ₹1)
        "amount_prc": int(amount_inr * PRC_RATE),
        "platform_fee_prc": platform_fee * PRC_RATE,
        "admin_charge_prc": admin_charge * PRC_RATE,
        "total_charges_prc": total_charges * PRC_RATE,
        "total_prc_required": int(total_amount * PRC_RATE)
    }


def generate_request_id() -> str:
    """Generate unique request ID"""
    return f"RDM{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def serialize_doc(doc: dict) -> dict:
    """Serialize MongoDB document for JSON response"""
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == "_id":
            result["id"] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value
    return result


# ==================== USER APIs ====================

@router.get("/services")
async def get_available_services():
    """Get all available redeem services"""
    services = []
    for service_id, info in SERVICE_TYPES.items():
        services.append({
            "id": service_id,
            "name": info["name"],
            "icon": info["icon"],
            "eko_category": info["category"]
        })
    return {
        "success": True,
        "services": services,
        "charges_info": {
            "platform_fee": f"₹{PLATFORM_FEE} (flat)",
            "admin_charge": f"{ADMIN_CHARGE_PERCENT}% of amount",
            "prc_rate": f"{PRC_RATE} PRC = ₹1"
        }
    }


@router.get("/calculate-charges")
async def calculate_charges_api(amount: float = Query(..., gt=0)):
    """
    Calculate charges for a given amount
    
    Returns breakdown of all charges including PRC equivalent
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    return {
        "success": True,
        "charges": calculate_charges(amount)
    }


@router.get("/admin/eko-balance")
async def get_admin_eko_balance():
    """Get Eko wallet balance for admin dashboard - uses existing Eko balance endpoint"""
    try:
        # Use existing make_eko_request from eko_payments
        from routes.eko_payments import make_eko_request
        
        result = await make_eko_request(
            f"/v1/customers/mobile_number:{EKO_INITIATOR_ID}/balance",
            method="GET"
        )
        
        balance_str = result.get("data", {}).get("balance", "0")
        try:
            balance = float(balance_str)
        except (ValueError, TypeError):
            balance = 0
            
        return {
            "success": True,
            "balance": balance,
            "currency": result.get("data", {}).get("currency", "INR"),
            "locked_amount": 0,
            "message": result.get("message")
        }
    except Exception as e:
        logging.error(f"Eko balance error: {str(e)}")
        return {"success": False, "balance": 0, "error": str(e)}


@router.post("/request")
async def create_redeem_request(request: RedeemRequestCreate):
    """
    Create a new redeem request
    
    Flow:
    1. Validate user exists and has KYC verified
    2. Check PRC balance
    3. Deduct PRC from user wallet
    4. Create pending request for admin approval
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Validate service type
    if request.service_type not in SERVICE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid service type. Must be one of: {list(SERVICE_TYPES.keys())}"
        )
    
    # Get user
    user = await db.users.find_one({"uid": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check KYC status
    if user.get("kyc_status") != "verified":
        raise HTTPException(status_code=403, detail="KYC verification required for redeem")
    
    # Check subscription plan
    valid_plans = ["startup", "growth", "elite"]
    user_plan = (user.get("subscription_plan") or "").lower()
    if user_plan not in valid_plans:
        raise HTTPException(
            status_code=403, 
            detail="Paid subscription required. Please upgrade to Startup, Growth or Elite plan."
        )
    
    # Calculate charges
    charges = calculate_charges(request.amount)
    total_prc_required = charges["total_prc_required"]
    
    # Check PRC balance
    current_balance = user.get("prc_balance", 0)
    if current_balance < total_prc_required:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient PRC balance. Required: {total_prc_required} PRC, Available: {current_balance} PRC"
        )
    
    # Generate request ID
    request_id = generate_request_id()
    
    # Create request document
    now = datetime.now(timezone.utc)
    request_doc = {
        "request_id": request_id,
        "user_id": request.user_id,
        "user_name": user.get("name", ""),
        "user_mobile": user.get("mobile", ""),
        "service_type": request.service_type,
        "service_name": SERVICE_TYPES[request.service_type]["name"],
        "amount_inr": request.amount,
        "details": request.details,
        # Charges breakdown
        "charges": charges,
        "total_prc_deducted": total_prc_required,
        # Status
        "status": STATUS_PENDING,
        "status_history": [
            {"status": STATUS_PENDING, "timestamp": now.isoformat(), "note": "Request created"}
        ],
        # Timestamps
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        # Eko transaction details (filled after processing)
        "eko_tid": None,
        "eko_status": None,
        "utr_number": None,
        # Admin fields
        "approved_by": None,
        "approved_at": None,
        "rejection_reason": None,
        "admin_notes": None,
        "completed_at": None
    }
    
    # Deduct PRC from user
    new_balance = current_balance - total_prc_required
    await db.users.update_one(
        {"uid": request.user_id},
        {
            "$set": {"prc_balance": new_balance},
            "$push": {
                "prc_transactions": {
                    "type": "debit",
                    "amount": total_prc_required,
                    "description": f"Redeem: {SERVICE_TYPES[request.service_type]['name']} - ₹{request.amount}",
                    "reference_id": request_id,
                    "balance_after": new_balance,
                    "timestamp": now.isoformat()
                }
            }
        }
    )
    
    # Insert request
    await db.redeem_requests.insert_one(request_doc)
    
    return {
        "success": True,
        "message": "Request submitted successfully! Admin will process within 24-48 hours.",
        "request_id": request_id,
        "charges": charges,
        "prc_deducted": total_prc_required,
        "new_balance": new_balance
    }


@router.get("/user/{user_id}/requests")
async def get_user_requests(
    user_id: str,
    status: Optional[str] = None,
    service_type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0)
):
    """Get all redeem requests for a user with optional filters"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Build query
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    if service_type:
        query["service_type"] = service_type
    
    # Get total count
    total = await db.redeem_requests.count_documents(query)
    
    # Get requests
    cursor = db.redeem_requests.find(query).sort("created_at", -1).skip(skip).limit(limit)
    requests = []
    async for doc in cursor:
        requests.append(serialize_doc(doc))
    
    return {
        "success": True,
        "requests": requests,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.get("/user/{user_id}/request/{request_id}")
async def get_request_details(user_id: str, request_id: str):
    """Get details of a specific request"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    request_doc = await db.redeem_requests.find_one({
        "request_id": request_id,
        "user_id": user_id
    })
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {
        "success": True,
        "request": serialize_doc(request_doc)
    }


# ==================== ADMIN APIs ====================

@router.get("/admin/requests")
async def get_admin_requests(
    status: Optional[str] = None,
    service_type: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    sort_by: str = Query("created_at", pattern="^(created_at|amount_inr|approved_at|completed_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """
    Admin: Get all redeem requests with advanced filtering and pagination
    
    Filters:
    - status: pending, approved, processing, completed, failed, rejected
    - service_type: mobile_recharge, dth, electricity, gas, emi, dmt
    - search: Search by request_id, user_name, user_mobile
    - date_from, date_to: Date range filter
    - min_amount, max_amount: Amount range filter
    
    Sorting:
    - sort_by: created_at, amount_inr, approved_at, completed_at
    - sort_order: asc, desc
    
    Pagination:
    - page: Page number (1-indexed)
    - per_page: Items per page (max 100)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Build query
    query = {}
    
    if status:
        # Support comma-separated statuses (e.g., "pending,approved,processing")
        if ',' in status:
            status_list = [s.strip() for s in status.split(',')]
            query["status"] = {"$in": status_list}
        else:
            query["status"] = status
    
    if service_type:
        query["service_type"] = service_type
    
    if search:
        query["$or"] = [
            {"request_id": {"$regex": search, "$options": "i"}},
            {"user_name": {"$regex": search, "$options": "i"}},
            {"user_mobile": {"$regex": search, "$options": "i"}}
        ]
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    if min_amount is not None:
        query["amount_inr"] = {"$gte": min_amount}
    
    if max_amount is not None:
        if "amount_inr" in query:
            query["amount_inr"]["$lte"] = max_amount
        else:
            query["amount_inr"] = {"$lte": max_amount}
    
    # Calculate skip
    skip = (page - 1) * per_page
    
    # Sort direction
    sort_direction = -1 if sort_order == "desc" else 1
    
    # Get total count
    total = await db.redeem_requests.count_documents(query)
    
    # Get requests
    cursor = db.redeem_requests.find(query).sort(sort_by, sort_direction).skip(skip).limit(per_page)
    requests = []
    async for doc in cursor:
        requests.append(serialize_doc(doc))
    
    # Calculate pagination info
    total_pages = (total + per_page - 1) // per_page
    
    return {
        "success": True,
        "requests": requests,
        "pagination": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        "filters_applied": {
            "status": status,
            "service_type": service_type,
            "search": search,
            "date_range": {"from": date_from, "to": date_to} if date_from or date_to else None,
            "amount_range": {"min": min_amount, "max": max_amount} if min_amount or max_amount else None
        }
    }


@router.get("/admin/stats")
async def get_admin_stats():
    """Get dashboard statistics for admin"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Count by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount_inr"}}}
    ]
    status_stats = {}
    async for doc in db.redeem_requests.aggregate(pipeline):
        status_stats[doc["_id"]] = {
            "count": doc["count"],
            "total_amount": doc["total_amount"]
        }
    
    # Count by service type
    pipeline = [
        {"$group": {"_id": "$service_type", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount_inr"}}}
    ]
    service_stats = {}
    async for doc in db.redeem_requests.aggregate(pipeline):
        service_stats[doc["_id"]] = {
            "count": doc["count"],
            "total_amount": doc["total_amount"]
        }
    
    # Today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "total_amount": {"$sum": "$amount_inr"}}}
    ]
    today_stats = {"count": 0, "total_amount": 0}
    async for doc in db.redeem_requests.aggregate(today_pipeline):
        today_stats = {"count": doc["count"], "total_amount": doc["total_amount"]}
    
    return {
        "success": True,
        "by_status": status_stats,
        "by_service": service_stats,
        "today": today_stats,
        "pending_count": status_stats.get(STATUS_PENDING, {}).get("count", 0)
    }


@router.post("/admin/approve")
async def admin_approve_request(data: AdminApproveRequest):
    """
    Admin: Approve or reject a redeem request
    
    - approve: Moves to 'approved' status, ready for Eko processing
    - reject: Moves to 'rejected' status, refunds PRC to user
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Get request
    request_doc = await db.redeem_requests.find_one({"request_id": data.request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc["status"] != STATUS_PENDING:
        raise HTTPException(
            status_code=400, 
            detail=f"Request is not pending. Current status: {request_doc['status']}"
        )
    
    now = datetime.now(timezone.utc)
    
    if data.action == "approve":
        # Approve the request
        update_data = {
            "status": STATUS_APPROVED,
            "approved_by": data.admin_id,
            "approved_at": now.isoformat(),
            "admin_notes": data.notes,
            "updated_at": now.isoformat()
        }
        
        await db.redeem_requests.update_one(
            {"request_id": data.request_id},
            {
                "$set": update_data,
                "$push": {
                    "status_history": {
                        "status": STATUS_APPROVED,
                        "timestamp": now.isoformat(),
                        "by": data.admin_id,
                        "note": data.notes or "Approved by admin"
                    }
                }
            }
        )
        
        return {
            "success": True,
            "message": "Request approved successfully",
            "status": STATUS_APPROVED
        }
    
    else:  # reject
        if not data.rejection_reason:
            raise HTTPException(status_code=400, detail="Rejection reason is required")
        
        # Refund PRC to user
        user_id = request_doc["user_id"]
        refund_amount = request_doc["total_prc_deducted"]
        
        user = await db.users.find_one({"uid": user_id})
        if user:
            current_balance = user.get("prc_balance", 0)
            new_balance = current_balance + refund_amount
            
            await db.users.update_one(
                {"uid": user_id},
                {
                    "$set": {"prc_balance": new_balance},
                    "$push": {
                        "prc_transactions": {
                            "type": "credit",
                            "amount": refund_amount,
                            "description": f"Refund: {request_doc['service_name']} request rejected",
                            "reference_id": data.request_id,
                            "balance_after": new_balance,
                            "timestamp": now.isoformat()
                        }
                    }
                }
            )
        
        # Update request
        update_data = {
            "status": STATUS_REJECTED,
            "approved_by": data.admin_id,
            "approved_at": now.isoformat(),
            "rejection_reason": data.rejection_reason,
            "admin_notes": data.notes,
            "updated_at": now.isoformat(),
            "prc_refunded": True,
            "refund_amount": refund_amount
        }
        
        await db.redeem_requests.update_one(
            {"request_id": data.request_id},
            {
                "$set": update_data,
                "$push": {
                    "status_history": {
                        "status": STATUS_REJECTED,
                        "timestamp": now.isoformat(),
                        "by": data.admin_id,
                        "note": f"Rejected: {data.rejection_reason}"
                    }
                }
            }
        )
        
        return {
            "success": True,
            "message": f"Request rejected. {refund_amount} PRC refunded to user.",
            "status": STATUS_REJECTED,
            "refund_amount": refund_amount
        }


@router.post("/admin/complete")
async def admin_complete_request(data: AdminCompleteRequest):
    """
    Admin: Execute Eko payment and complete request
    This actually calls Eko API to do the recharge/payment
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Get request
    request_doc = await db.redeem_requests.find_one({"request_id": data.request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc["status"] not in [STATUS_APPROVED, STATUS_PROCESSING]:
        raise HTTPException(
            status_code=400,
            detail=f"Request cannot be completed. Current status: {request_doc['status']}"
        )
    
    now = datetime.now(timezone.utc)
    service_type = request_doc.get("service_type", "")
    
    # Update status to processing
    await db.redeem_requests.update_one(
        {"request_id": data.request_id},
        {
            "$set": {"status": STATUS_PROCESSING, "updated_at": now.isoformat()},
            "$push": {
                "status_history": {
                    "status": STATUS_PROCESSING,
                    "timestamp": now.isoformat(),
                    "by": data.admin_id,
                    "note": "Processing Eko transaction"
                }
            }
        }
    )
    
    # Execute Eko API based on service type
    if service_type == "dmt":
        eko_result = await execute_eko_dmt(request_doc)
    else:
        # Mobile, DTH, Electricity, Gas, EMI - all use BBPS
        eko_result = await execute_eko_recharge(request_doc)
    
    if eko_result.get("success"):
        # SUCCESS or PROCESSING
        final_status = STATUS_COMPLETED if eko_result.get("status") == "SUCCESS" else STATUS_PROCESSING
        
        update_data = {
            "status": final_status,
            "eko_tid": eko_result.get("eko_tid") or data.eko_tid,
            "utr_number": eko_result.get("utr") or data.utr_number,
            "eko_status": eko_result.get("status"),
            "eko_message": eko_result.get("message"),
            "admin_notes": data.completion_notes,
            "completed_at": now.isoformat() if final_status == STATUS_COMPLETED else None,
            "completed_by": data.admin_id,
            "updated_at": now.isoformat()
        }
        
        await db.redeem_requests.update_one(
            {"request_id": data.request_id},
            {
                "$set": update_data,
                "$push": {
                    "status_history": {
                        "status": final_status,
                        "timestamp": now.isoformat(),
                        "by": data.admin_id,
                        "note": f"Eko: {eko_result.get('message')} | TID: {eko_result.get('eko_tid')}"
                    }
                }
            }
        )
        
        return {
            "success": True,
            "message": eko_result.get("message", "Transaction processed"),
            "status": final_status,
            "eko_tid": eko_result.get("eko_tid"),
            "utr": eko_result.get("utr")
        }
    else:
        # FAILED - Refund PRC to user
        user_id = request_doc["user_id"]
        refund_amount = request_doc["total_prc_deducted"]
        
        user = await db.users.find_one({"uid": user_id})
        if user:
            current_balance = user.get("prc_balance", 0)
            new_balance = current_balance + refund_amount
            
            await db.users.update_one(
                {"uid": user_id},
                {
                    "$set": {"prc_balance": new_balance},
                    "$push": {
                        "prc_transactions": {
                            "type": "credit",
                            "amount": refund_amount,
                            "description": f"Refund: Eko transaction failed - {eko_result.get('message')}",
                            "reference_id": data.request_id,
                            "balance_after": new_balance,
                            "timestamp": now.isoformat()
                        }
                    }
                }
            )
        
        update_data = {
            "status": STATUS_FAILED,
            "eko_status": "FAILED",
            "eko_error_code": eko_result.get("error_code"),
            "eko_message": eko_result.get("message"),
            "admin_notes": data.completion_notes,
            "prc_refunded": True,
            "refund_amount": refund_amount,
            "updated_at": now.isoformat()
        }
        
        await db.redeem_requests.update_one(
            {"request_id": data.request_id},
            {
                "$set": update_data,
                "$push": {
                    "status_history": {
                        "status": STATUS_FAILED,
                        "timestamp": now.isoformat(),
                        "by": data.admin_id,
                        "note": f"Eko Failed: {eko_result.get('message')} | Refunded {refund_amount} PRC"
                    }
                }
            }
        )
        
        return {
            "success": False,
            "message": f"Eko transaction failed: {eko_result.get('message')}. {refund_amount} PRC refunded to user.",
            "status": STATUS_FAILED,
            "error": eko_result.get("message"),
            "refund_amount": refund_amount
        }


@router.get("/admin/request/{request_id}")
async def get_admin_request_details(request_id: str):
    """Admin: Get full details of a request"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    request_doc = await db.redeem_requests.find_one({"request_id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get user details
    user = await db.users.find_one({"uid": request_doc["user_id"]}, {"_id": 0, "password": 0, "pin": 0})
    
    return {
        "success": True,
        "request": serialize_doc(request_doc),
        "user": user
    }


@router.post("/admin/check-status/{request_id}")
async def check_eko_transaction_status(request_id: str, admin_id: str = "admin"):
    """
    Admin: Check status of pending Eko transaction
    Updates status based on Eko API response
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    request_doc = await db.redeem_requests.find_one({"request_id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc["status"] != STATUS_PROCESSING:
        return {
            "success": True,
            "message": f"Request is not in processing state. Current status: {request_doc['status']}",
            "status": request_doc["status"]
        }
    
    eko_tid = request_doc.get("eko_tid")
    if not eko_tid:
        return {
            "success": False,
            "message": "No Eko TID found for this request"
        }
    
    try:
        from routes.eko_payments import make_eko_request
        
        # Check transaction status from Eko
        result = await make_eko_request(
            f"/v1/transactions/{eko_tid}",
            method="GET"
        )
        
        now = datetime.now(timezone.utc)
        tx_status = str(result.get("data", {}).get("tx_status", result.get("status", -1)))
        
        status_map = {
            "0": STATUS_COMPLETED,
            "1": STATUS_FAILED,
            "2": STATUS_PROCESSING,
            "3": "refund_pending",
            "4": "refunded",
            "5": "hold"
        }
        
        new_status = status_map.get(tx_status, STATUS_PROCESSING)
        
        if new_status == STATUS_COMPLETED:
            # Success - Update status
            await db.redeem_requests.update_one(
                {"request_id": request_id},
                {
                    "$set": {
                        "status": STATUS_COMPLETED,
                        "eko_status": "SUCCESS",
                        "utr_number": result.get("data", {}).get("utr") or result.get("data", {}).get("bbpstrxnrefid"),
                        "completed_at": now.isoformat(),
                        "updated_at": now.isoformat()
                    },
                    "$push": {
                        "status_history": {
                            "status": STATUS_COMPLETED,
                            "timestamp": now.isoformat(),
                            "by": admin_id,
                            "note": "Status check: Transaction successful"
                        }
                    }
                }
            )
            return {
                "success": True,
                "message": "Transaction completed successfully!",
                "status": STATUS_COMPLETED,
                "utr": result.get("data", {}).get("utr")
            }
            
        elif new_status == STATUS_FAILED or new_status in ["refund_pending", "refunded"]:
            # Failed - Refund PRC
            user_id = request_doc["user_id"]
            refund_amount = request_doc["total_prc_deducted"]
            
            user = await db.users.find_one({"uid": user_id})
            if user:
                current_balance = user.get("prc_balance", 0)
                new_balance = current_balance + refund_amount
                
                await db.users.update_one(
                    {"uid": user_id},
                    {
                        "$set": {"prc_balance": new_balance},
                        "$push": {
                            "prc_transactions": {
                                "type": "credit",
                                "amount": refund_amount,
                                "description": "Refund: Eko transaction failed on status check",
                                "reference_id": request_id,
                                "balance_after": new_balance,
                                "timestamp": now.isoformat()
                            }
                        }
                    }
                )
            
            await db.redeem_requests.update_one(
                {"request_id": request_id},
                {
                    "$set": {
                        "status": STATUS_FAILED,
                        "eko_status": "FAILED",
                        "prc_refunded": True,
                        "refund_amount": refund_amount,
                        "updated_at": now.isoformat()
                    },
                    "$push": {
                        "status_history": {
                            "status": STATUS_FAILED,
                            "timestamp": now.isoformat(),
                            "by": admin_id,
                            "note": f"Status check: Failed. {refund_amount} PRC refunded"
                        }
                    }
                }
            )
            
            return {
                "success": False,
                "message": f"Transaction failed. {refund_amount} PRC refunded to user.",
                "status": STATUS_FAILED,
                "refund_amount": refund_amount
            }
        else:
            # Still processing
            return {
                "success": True,
                "message": "Transaction still processing. Check again later.",
                "status": STATUS_PROCESSING,
                "eko_status": tx_status
            }
            
    except Exception as e:
        logging.error(f"Status check error: {str(e)}")
        return {
            "success": False,
            "message": f"Error checking status: {str(e)}"
        }


@router.post("/admin/manual-refund/{request_id}")
async def manual_refund_request(request_id: str, admin_id: str = "admin", reason: str = "Manual refund by admin"):
    """
    Admin: Manually refund PRC for any request
    Use when Eko transaction is stuck or needs manual intervention
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    request_doc = await db.redeem_requests.find_one({"request_id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc.get("prc_refunded"):
        return {
            "success": False,
            "message": "PRC already refunded for this request"
        }
    
    if request_doc["status"] == STATUS_COMPLETED:
        return {
            "success": False,
            "message": "Cannot refund completed request"
        }
    
    now = datetime.now(timezone.utc)
    user_id = request_doc["user_id"]
    refund_amount = request_doc["total_prc_deducted"]
    
    user = await db.users.find_one({"uid": user_id})
    if user:
        current_balance = user.get("prc_balance", 0)
        new_balance = current_balance + refund_amount
        
        await db.users.update_one(
            {"uid": user_id},
            {
                "$set": {"prc_balance": new_balance},
                "$push": {
                    "prc_transactions": {
                        "type": "credit",
                        "amount": refund_amount,
                        "description": f"Manual Refund: {reason}",
                        "reference_id": request_id,
                        "balance_after": new_balance,
                        "timestamp": now.isoformat()
                    }
                }
            }
        )
    
    await db.redeem_requests.update_one(
        {"request_id": request_id},
        {
            "$set": {
                "status": STATUS_FAILED,
                "prc_refunded": True,
                "refund_amount": refund_amount,
                "refund_reason": reason,
                "updated_at": now.isoformat()
            },
            "$push": {
                "status_history": {
                    "status": STATUS_FAILED,
                    "timestamp": now.isoformat(),
                    "by": admin_id,
                    "note": f"Manual refund: {reason}. {refund_amount} PRC refunded"
                }
            }
        }
    )
    
    return {
        "success": True,
        "message": f"{refund_amount} PRC refunded successfully",
        "refund_amount": refund_amount
    }

