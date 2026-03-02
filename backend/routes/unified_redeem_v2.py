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
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging
import uuid

router = APIRouter(prefix="/redeem", tags=["Unified Redeem v2"])

# Database reference
db = None

def set_db(database):
    global db
    db = database

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
        "message": f"Request submitted successfully! Admin will process within 24-48 hours.",
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
    Admin: Mark request as completed (manual completion after Eko processing)
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
    
    update_data = {
        "status": STATUS_COMPLETED,
        "eko_tid": data.eko_tid,
        "utr_number": data.utr_number,
        "admin_notes": data.completion_notes,
        "completed_at": now.isoformat(),
        "completed_by": data.admin_id,
        "updated_at": now.isoformat()
    }
    
    await db.redeem_requests.update_one(
        {"request_id": data.request_id},
        {
            "$set": update_data,
            "$push": {
                "status_history": {
                    "status": STATUS_COMPLETED,
                    "timestamp": now.isoformat(),
                    "by": data.admin_id,
                    "note": data.completion_notes or "Completed by admin"
                }
            }
        }
    )
    
    return {
        "success": True,
        "message": "Request marked as completed",
        "status": STATUS_COMPLETED
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
