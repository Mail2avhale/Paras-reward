"""
PARAS REWARD - Chatbot Bank Withdrawal System
==============================================
Hidden bank withdrawal via chatbot with admin DMT processing

Flow:
1. User requests withdrawal via chatbot
2. System validates: KYC, minimum amount, balance
3. User provides bank details
4. Request created with fees calculation
5. Admin processes via Eko DMT
6. Status updates sent to user

Fees:
- Processing Fee: ₹10 (flat)
- Admin Charge: 20% of amount

Configuration:
- Minimum: ₹500
- KYC: Mandatory
- OTP: Not required
- Verification: Self-declaration
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re

router = APIRouter(prefix="/chatbot-redeem", tags=["Chatbot Withdrawal"])

# Database instance (set from server.py)
db = None

def set_db(database):
    global db
    db = database

# ==================== CONFIGURATION ====================

MIN_WITHDRAWAL_INR = 500  # Minimum ₹500
PROCESSING_FEE = 10  # ₹10 flat
ADMIN_CHARGE_PERCENT = 20  # 20%
PRC_TO_INR_RATE = 10  # 10 PRC = ₹1

# ==================== MODELS ====================

class WithdrawalRequest(BaseModel):
    uid: str
    amount_inr: float = Field(..., ge=MIN_WITHDRAWAL_INR)
    account_holder_name: str = Field(..., min_length=3)
    account_number: str = Field(..., min_length=9, max_length=18)
    bank_name: str = Field(..., min_length=2)
    ifsc_code: str = Field(..., pattern=r'^[A-Z]{4}0[A-Z0-9]{6}$')
    
    @validator('account_number')
    def validate_account_number(cls, v):
        if not v.isdigit():
            raise ValueError('Account number must contain only digits')
        return v
    
    @validator('ifsc_code')
    def validate_ifsc(cls, v):
        return v.upper()
    
    @validator('account_holder_name')
    def validate_name(cls, v):
        return v.strip().upper()

class AdminProcessRequest(BaseModel):
    admin_uid: str
    action: str  # 'approve', 'reject', 'process_dmt'
    rejection_reason: Optional[str] = None
    dmt_transaction_id: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

def calculate_fees(amount_inr: float) -> dict:
    """Calculate fees for withdrawal"""
    processing_fee = PROCESSING_FEE
    admin_charge = amount_inr * (ADMIN_CHARGE_PERCENT / 100)
    total_fees = processing_fee + admin_charge
    net_amount = amount_inr - total_fees
    prc_required = amount_inr * PRC_TO_INR_RATE
    
    return {
        "amount_inr": amount_inr,
        "processing_fee": processing_fee,
        "admin_charge": admin_charge,
        "admin_charge_percent": ADMIN_CHARGE_PERCENT,
        "total_fees": total_fees,
        "net_amount": net_amount,
        "prc_required": prc_required
    }

def generate_request_id() -> str:
    """Generate unique withdrawal request ID"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = uuid.uuid4().hex[:6].upper()
    return f"WD-{timestamp}-{random_part}"

async def check_user_eligibility(uid: str) -> dict:
    """Check if user is eligible for withdrawal"""
    user = await db.users.find_one({"uid": uid})
    
    if not user:
        return {"eligible": False, "reason": "User not found"}
    
    # Check KYC status
    kyc_status = user.get("kyc_status", "not_submitted")
    if kyc_status != "verified":
        return {
            "eligible": False, 
            "reason": "KYC verification आवश्यक आहे. कृपया आधी KYC पूर्ण करा.",
            "kyc_status": kyc_status
        }
    
    # Get PRC balance
    prc_balance = user.get("prc_balance", 0)
    inr_balance = prc_balance / PRC_TO_INR_RATE
    
    if inr_balance < MIN_WITHDRAWAL_INR:
        return {
            "eligible": False,
            "reason": f"Minimum ₹{MIN_WITHDRAWAL_INR} आवश्यक आहे. तुमचा balance: ₹{inr_balance:.0f}",
            "balance_inr": inr_balance,
            "prc_balance": prc_balance
        }
    
    return {
        "eligible": True,
        "user_name": user.get("name"),
        "mobile": user.get("mobile"),
        "prc_balance": prc_balance,
        "balance_inr": inr_balance,
        "min_withdrawal": MIN_WITHDRAWAL_INR,
        "max_withdrawal": inr_balance
    }

# ==================== API ENDPOINTS ====================

@router.get("/eligibility/{uid}")
async def check_eligibility(uid: str):
    """Check if user is eligible for withdrawal"""
    return await check_user_eligibility(uid)

@router.get("/calculate-fees")
async def get_fee_calculation(amount: float):
    """Calculate fees for given amount"""
    if amount < MIN_WITHDRAWAL_INR:
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum withdrawal amount is ₹{MIN_WITHDRAWAL_INR}"
        )
    return calculate_fees(amount)

@router.post("/request")
async def create_withdrawal_request(request: WithdrawalRequest):
    """Create new withdrawal request via chatbot"""
    
    # Check eligibility
    eligibility = await check_user_eligibility(request.uid)
    if not eligibility.get("eligible"):
        raise HTTPException(status_code=400, detail=eligibility.get("reason"))
    
    # Check sufficient balance
    fees = calculate_fees(request.amount_inr)
    prc_required = fees["prc_required"]
    
    user = await db.users.find_one({"uid": request.uid})
    prc_balance = user.get("prc_balance", 0)
    
    if prc_balance < prc_required:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Required: {prc_required:.0f} PRC, Available: {prc_balance:.0f} PRC"
        )
    
    # Generate request ID
    request_id = generate_request_id()
    now = datetime.now(timezone.utc).isoformat()
    
    # Create withdrawal request document
    withdrawal_doc = {
        "request_id": request_id,
        "uid": request.uid,
        "user_name": user.get("name"),
        "user_mobile": user.get("mobile"),
        
        # Amount details
        "amount_inr": request.amount_inr,
        "processing_fee": fees["processing_fee"],
        "admin_charge": fees["admin_charge"],
        "total_fees": fees["total_fees"],
        "net_amount": fees["net_amount"],
        "prc_deducted": prc_required,
        
        # Bank details
        "account_holder_name": request.account_holder_name,
        "account_number": request.account_number,
        "bank_name": request.bank_name,
        "ifsc_code": request.ifsc_code,
        
        # Status
        "status": "pending",  # pending, processing, completed, rejected
        "created_at": now,
        "updated_at": now,
        
        # DMT processing (filled by admin)
        "dmt_transaction_id": None,
        "dmt_status": None,
        "processed_by": None,
        "processed_at": None,
        "rejection_reason": None,
        
        # Source
        "source": "chatbot"
    }
    
    # Deduct PRC from user balance
    await db.users.update_one(
        {"uid": request.uid},
        {
            "$inc": {"prc_balance": -prc_required},
            "$set": {"updated_at": now}
        }
    )
    
    # Save withdrawal request
    await db.chatbot_withdrawal_requests.insert_one(withdrawal_doc)
    
    # Save/update user's bank account for future use
    await db.user_bank_accounts.update_one(
        {
            "uid": request.uid,
            "account_number": request.account_number
        },
        {
            "$set": {
                "uid": request.uid,
                "account_holder_name": request.account_holder_name,
                "account_number": request.account_number,
                "bank_name": request.bank_name,
                "ifsc_code": request.ifsc_code,
                "verified": False,  # Self-declared
                "last_used": now,
                "created_at": now
            }
        },
        upsert=True
    )
    
    # Log transaction
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "uid": request.uid,
        "type": "withdrawal_request",
        "amount_prc": -prc_required,
        "amount_inr": request.amount_inr,
        "reference_id": request_id,
        "status": "pending",
        "description": f"Bank withdrawal request - {request.bank_name}",
        "created_at": now
    })
    
    return {
        "success": True,
        "request_id": request_id,
        "message": "Withdrawal request submitted successfully!",
        "details": {
            "amount": request.amount_inr,
            "fees": fees["total_fees"],
            "net_amount": fees["net_amount"],
            "prc_deducted": prc_required,
            "bank": f"{request.bank_name} - ****{request.account_number[-4:]}",
            "expected_days": "5-7 working days"
        }
    }

@router.get("/status/{request_id}")
async def get_request_status(request_id: str):
    """Get status of a withdrawal request"""
    request_doc = await db.chatbot_withdrawal_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Mask sensitive data
    request_doc["account_number"] = "****" + request_doc["account_number"][-4:]
    
    return request_doc

@router.get("/history/{uid}")
async def get_user_history(uid: str, limit: int = 20, skip: int = 0):
    """Get user's withdrawal request history"""
    requests = await db.chatbot_withdrawal_requests.find(
        {"uid": uid},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Mask account numbers
    for req in requests:
        req["account_number"] = "****" + req["account_number"][-4:]
    
    total = await db.chatbot_withdrawal_requests.count_documents({"uid": uid})
    
    return {
        "requests": requests,
        "total": total,
        "pending": sum(1 for r in requests if r["status"] == "pending"),
        "completed": sum(1 for r in requests if r["status"] == "completed"),
        "rejected": sum(1 for r in requests if r["status"] == "rejected")
    }

@router.get("/saved-accounts/{uid}")
async def get_saved_accounts(uid: str):
    """Get user's saved bank accounts"""
    accounts = await db.user_bank_accounts.find(
        {"uid": uid},
        {"_id": 0}
    ).sort("last_used", -1).to_list(length=10)
    
    # Mask account numbers
    for acc in accounts:
        acc["account_number_masked"] = "****" + acc["account_number"][-4:]
    
    return {"accounts": accounts}

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending")
async def get_pending_requests(limit: int = 50, skip: int = 0):
    """Get all pending withdrawal requests for admin"""
    requests = await db.chatbot_withdrawal_requests.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.chatbot_withdrawal_requests.count_documents({"status": "pending"})
    
    return {
        "requests": requests,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/admin/all")
async def get_all_requests(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all withdrawal requests with optional status filter"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.chatbot_withdrawal_requests.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.chatbot_withdrawal_requests.count_documents(query)
    
    # Stats
    stats = {
        "pending": await db.chatbot_withdrawal_requests.count_documents({"status": "pending"}),
        "processing": await db.chatbot_withdrawal_requests.count_documents({"status": "processing"}),
        "completed": await db.chatbot_withdrawal_requests.count_documents({"status": "completed"}),
        "rejected": await db.chatbot_withdrawal_requests.count_documents({"status": "rejected"})
    }
    
    return {
        "requests": requests,
        "total": total,
        "stats": stats
    }

@router.get("/admin/request/{request_id}")
async def get_request_details(request_id: str):
    """Get full details of a withdrawal request for admin"""
    request_doc = await db.chatbot_withdrawal_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get user details
    user = await db.users.find_one(
        {"uid": request_doc["uid"]},
        {"_id": 0, "name": 1, "mobile": 1, "email": 1, "kyc_status": 1, "prc_balance": 1}
    )
    
    request_doc["user_details"] = user
    
    return request_doc

@router.post("/admin/process/{request_id}")
async def process_request(request_id: str, process_data: AdminProcessRequest):
    """Admin process withdrawal request"""
    request_doc = await db.chatbot_withdrawal_requests.find_one({"request_id": request_id})
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if process_data.action == "reject":
        # Reject and refund PRC
        await db.chatbot_withdrawal_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "rejected",
                    "rejection_reason": process_data.rejection_reason or "Admin rejected",
                    "processed_by": process_data.admin_uid,
                    "processed_at": now,
                    "updated_at": now
                }
            }
        )
        
        # Refund PRC to user
        await db.users.update_one(
            {"uid": request_doc["uid"]},
            {"$inc": {"prc_balance": request_doc["prc_deducted"]}}
        )
        
        # Log refund
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "uid": request_doc["uid"],
            "type": "withdrawal_refund",
            "amount_prc": request_doc["prc_deducted"],
            "reference_id": request_id,
            "status": "completed",
            "description": f"Withdrawal rejected - PRC refunded",
            "created_at": now
        })
        
        return {"success": True, "message": "Request rejected and PRC refunded"}
    
    elif process_data.action == "approve":
        # Mark as processing (admin will initiate DMT separately)
        await db.chatbot_withdrawal_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "processing",
                    "processed_by": process_data.admin_uid,
                    "updated_at": now
                }
            }
        )
        return {"success": True, "message": "Request approved, ready for DMT processing"}
    
    elif process_data.action == "complete_dmt":
        # Mark as completed after successful DMT
        await db.chatbot_withdrawal_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "completed",
                    "dmt_transaction_id": process_data.dmt_transaction_id,
                    "dmt_status": "success",
                    "processed_by": process_data.admin_uid,
                    "processed_at": now,
                    "updated_at": now
                }
            }
        )
        
        # Update transaction log
        await db.transactions.update_one(
            {"reference_id": request_id},
            {"$set": {"status": "completed"}}
        )
        
        return {"success": True, "message": "Withdrawal completed successfully"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@router.get("/admin/stats")
async def get_withdrawal_stats():
    """Get withdrawal statistics for admin dashboard"""
    
    # Count by status
    pending = await db.chatbot_withdrawal_requests.count_documents({"status": "pending"})
    processing = await db.chatbot_withdrawal_requests.count_documents({"status": "processing"})
    completed = await db.chatbot_withdrawal_requests.count_documents({"status": "completed"})
    rejected = await db.chatbot_withdrawal_requests.count_documents({"status": "rejected"})
    
    # Total amounts
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": None,
            "total_amount": {"$sum": "$amount_inr"},
            "total_fees": {"$sum": "$total_fees"},
            "count": {"$sum": 1}
        }}
    ]
    
    completed_stats = await db.chatbot_withdrawal_requests.aggregate(pipeline).to_list(1)
    
    return {
        "counts": {
            "pending": pending,
            "processing": processing,
            "completed": completed,
            "rejected": rejected,
            "total": pending + processing + completed + rejected
        },
        "completed_summary": completed_stats[0] if completed_stats else {
            "total_amount": 0,
            "total_fees": 0,
            "count": 0
        }
    }
