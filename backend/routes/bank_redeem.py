"""
Bank Account Redeem Routes - PRC to Bank withdrawal
Users can save bank details and request PRC withdrawal to bank account
- Weekly limit: 1 request per week
- Fixed denominations: 100, 500, 1000, 5000, 10000, 25000
- Processing fees + 20% admin charges
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

# Create router
router = APIRouter(tags=["Bank Redeem"])

# Database reference
db = None

# Cache reference  
cache = None

# Helpers
log_transaction = None
create_notification = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

def set_helpers(helpers: dict):
    global log_transaction, create_notification
    log_transaction = helpers.get('log_transaction')
    create_notification = helpers.get('create_notification')

# Processing fees for each denomination
PROCESSING_FEES = {
    100: 10,
    500: 25,
    1000: 50,
    5000: 100,
    10000: 200,
    25000: 500
}

# Admin charge percentage
ADMIN_CHARGE_PERCENT = 20

# Valid denominations
VALID_DENOMINATIONS = [100, 500, 1000, 5000, 10000, 25000]


def calculate_total_prc(amount_inr: int) -> dict:
    """Calculate total PRC needed for withdrawal"""
    if amount_inr not in VALID_DENOMINATIONS:
        return None
    
    processing_fee = PROCESSING_FEES.get(amount_inr, 0)
    admin_charge = amount_inr * (ADMIN_CHARGE_PERCENT / 100)
    total_inr = amount_inr + processing_fee + admin_charge
    
    # PRC rate: 10 PRC = 1 INR
    prc_rate = 10
    
    return {
        "amount_inr": amount_inr,
        "processing_fee_inr": processing_fee,
        "admin_charge_inr": admin_charge,
        "admin_charge_percent": ADMIN_CHARGE_PERCENT,
        "total_inr": total_inr,
        "amount_prc": amount_inr * prc_rate,
        "processing_fee_prc": processing_fee * prc_rate,
        "admin_charge_prc": admin_charge * prc_rate,
        "total_prc": total_inr * prc_rate
    }


# ========== BANK DETAILS MANAGEMENT ==========

@router.get("/bank-details/{user_id}")
async def get_bank_details(user_id: str):
    """Get user's saved bank details"""
    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "bank_details": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    bank_details = user.get("bank_details")
    if not bank_details:
        return {"has_bank_details": False, "bank_details": None}
    
    # Mask account number for security (show only last 4 digits)
    masked_account = "XXXX" + bank_details.get("account_number", "")[-4:] if bank_details.get("account_number") else None
    
    return {
        "has_bank_details": True,
        "bank_details": {
            "account_holder_name": bank_details.get("account_holder_name"),
            "account_number_masked": masked_account,
            "ifsc_code": bank_details.get("ifsc_code"),
            "bank_name": bank_details.get("bank_name"),
            "updated_at": bank_details.get("updated_at")
        }
    }


@router.post("/bank-details/{user_id}")
async def save_bank_details(user_id: str, request: Request):
    """Save or update user's bank details"""
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    
    # Validate required fields
    required_fields = ["account_holder_name", "account_number", "ifsc_code", "bank_name"]
    for field in required_fields:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"{field.replace('_', ' ').title()} is required")
    
    # Normalize names for comparison
    account_holder_name = data["account_holder_name"].strip().upper()
    user_profile_name = user.get("name", "").strip().upper()
    
    # Validate: Account Holder Name must match Profile Name
    # Remove extra spaces and compare
    def normalize_name(name):
        return " ".join(name.split())
    
    normalized_holder = normalize_name(account_holder_name)
    normalized_profile = normalize_name(user_profile_name)
    
    if normalized_holder != normalized_profile:
        raise HTTPException(
            status_code=400, 
            detail=f"Account holder name must match your profile name: '{user_profile_name}'"
        )
    
    # Validate IFSC format (11 characters: 4 letters + 0 + 6 alphanumeric)
    ifsc = data["ifsc_code"].upper().strip()
    if len(ifsc) != 11:
        raise HTTPException(status_code=400, detail="IFSC code must be 11 characters")
    
    # IFSC format: First 4 chars = Bank code (letters), 5th char = 0, Last 6 = Branch code
    import re
    ifsc_pattern = r'^[A-Z]{4}0[A-Z0-9]{6}$'
    if not re.match(ifsc_pattern, ifsc):
        raise HTTPException(
            status_code=400, 
            detail="Invalid IFSC format. Must be: 4 letters + 0 + 6 alphanumeric (e.g., SBIN0001234)"
        )
    
    # Validate account number (8-18 digits)
    account_number = data["account_number"].strip()
    if not account_number.isdigit() or len(account_number) < 8 or len(account_number) > 18:
        raise HTTPException(status_code=400, detail="Account number must be 8-18 digits")
    
    bank_details = {
        "account_holder_name": data["account_holder_name"].strip().upper(),
        "account_number": account_number,
        "ifsc_code": ifsc,
        "bank_name": data["bank_name"].strip().upper(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"bank_details": bank_details}}
    )
    
    return {"success": True, "message": "Bank details saved successfully"}


@router.delete("/bank-details/{user_id}")
async def delete_bank_details(user_id: str):
    """Delete user's bank details"""
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"uid": user_id},
        {"$unset": {"bank_details": ""}}
    )
    
    return {"success": True, "message": "Bank details deleted"}


# ========== WITHDRAWAL REQUESTS ==========

@router.get("/bank-redeem/denominations")
async def get_denominations():
    """Get available withdrawal denominations and fees"""
    denominations = []
    for amount in VALID_DENOMINATIONS:
        calc = calculate_total_prc(amount)
        denominations.append(calc)
    
    return {
        "denominations": denominations,
        "admin_charge_percent": ADMIN_CHARGE_PERCENT,
        "weekly_limit": 1,
        "note": "One withdrawal request allowed per week"
    }


@router.get("/bank-redeem/check-eligibility/{user_id}")
async def check_withdrawal_eligibility(user_id: str):
    """Check if user can make a withdrawal request this week"""
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if bank details exist
    if not user.get("bank_details"):
        return {
            "eligible": False,
            "reason": "no_bank_details",
            "message": "Please add your bank details first"
        }
    
    # Check KYC status
    if user.get("kyc_status") != "verified":
        return {
            "eligible": False,
            "reason": "kyc_pending",
            "message": "KYC verification required for bank withdrawals"
        }
    
    # Check for existing request this week
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    recent_request = await db.bank_withdrawal_requests.find_one({
        "user_id": user_id,
        "created_at": {"$gte": week_start.isoformat()},
        "status": {"$in": ["pending", "approved", "processing"]}
    })
    
    if recent_request:
        return {
            "eligible": False,
            "reason": "weekly_limit",
            "message": "You can only request one withdrawal per week",
            "next_eligible_date": (datetime.fromisoformat(recent_request["created_at"].replace('Z', '+00:00')) + timedelta(days=7)).isoformat(),
            "existing_request": {
                "request_id": recent_request.get("request_id"),
                "amount": recent_request.get("amount_inr"),
                "status": recent_request.get("status"),
                "created_at": recent_request.get("created_at")
            }
        }
    
    return {
        "eligible": True,
        "prc_balance": user.get("prc_balance", 0),
        "bank_details": {
            "bank_name": user["bank_details"].get("bank_name"),
            "account_masked": "XXXX" + user["bank_details"].get("account_number", "")[-4:]
        }
    }


@router.post("/bank-redeem/request/{user_id}")
async def create_withdrawal_request(user_id: str, request: Request):
    """Create a new bank withdrawal request"""
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    amount_inr = data.get("amount_inr")
    
    # Validate amount
    if amount_inr not in VALID_DENOMINATIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid amount. Valid denominations: {', '.join(map(str, VALID_DENOMINATIONS))}"
        )
    
    # Check bank details
    if not user.get("bank_details"):
        raise HTTPException(status_code=400, detail="Please add your bank details first")
    
    # Check KYC
    if user.get("kyc_status") != "verified":
        raise HTTPException(status_code=400, detail="KYC verification required for withdrawals")
    
    # Check weekly limit
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    recent_request = await db.bank_withdrawal_requests.find_one({
        "user_id": user_id,
        "created_at": {"$gte": week_start.isoformat()},
        "status": {"$in": ["pending", "approved", "processing"]}
    })
    
    if recent_request:
        raise HTTPException(status_code=400, detail="Weekly limit reached. One withdrawal per week allowed.")
    
    # Calculate charges
    charges = calculate_total_prc(amount_inr)
    total_prc = charges["total_prc"]
    
    # Check PRC balance
    prc_balance = user.get("prc_balance", 0)
    if prc_balance < total_prc:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient PRC balance. Required: {total_prc} PRC, Available: {prc_balance} PRC"
        )
    
    # Create request
    now = datetime.now(timezone.utc)
    request_id = f"BWR{now.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    
    withdrawal_request = {
        "request_id": request_id,
        "user_id": user_id,
        "amount_inr": amount_inr,
        "processing_fee_inr": charges["processing_fee_inr"],
        "admin_charge_inr": charges["admin_charge_inr"],
        "total_inr": charges["total_inr"],
        "total_prc_deducted": total_prc,
        "bank_details": user["bank_details"].copy(),
        "status": "pending",
        "created_at": now.isoformat(),
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "user_mobile": user.get("mobile", "")
    }
    
    # Deduct PRC from user balance
    await db.users.update_one(
        {"uid": user_id},
        {"$inc": {"prc_balance": -total_prc}}
    )
    
    # Create the request
    await db.bank_withdrawal_requests.insert_one(withdrawal_request)
    
    # Log transaction
    transaction = {
        "transaction_id": f"TXN{now.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}",
        "user_id": user_id,
        "type": "bank_withdrawal_request",
        "amount": -total_prc,
        "description": f"Bank withdrawal request - ₹{amount_inr}",
        "reference_id": request_id,
        "created_at": now.isoformat()
    }
    await db.transactions.insert_one(transaction)
    
    # Create notification
    if create_notification:
        try:
            await create_notification(
                user_id=user_id,
                title="Bank Withdrawal Request",
                message=f"Your withdrawal request of ₹{amount_inr} has been submitted. {total_prc} PRC deducted.",
                notification_type="withdrawal"
            )
        except Exception as e:
            logging.error(f"Notification error: {e}")
    
    return {
        "success": True,
        "message": "Withdrawal request submitted successfully",
        "request_id": request_id,
        "amount_inr": amount_inr,
        "total_prc_deducted": total_prc,
        "charges": charges
    }


@router.get("/bank-redeem/history/{user_id}")
async def get_withdrawal_history(user_id: str, page: int = 1, limit: int = 10):
    """Get user's withdrawal request history"""
    skip = (page - 1) * limit
    
    requests = await db.bank_withdrawal_requests.find(
        {"user_id": user_id},
        {"_id": 0, "bank_details.account_number": 0}  # Don't expose full account number
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.bank_withdrawal_requests.count_documents({"user_id": user_id})
    
    # Mask account numbers in response
    for req in requests:
        if req.get("bank_details"):
            req["bank_details"]["account_masked"] = "XXXX" + req["bank_details"].get("account_number", "")[-4:] if req["bank_details"].get("account_number") else "XXXX"
            req["bank_details"].pop("account_number", None)
    
    return {
        "requests": requests,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit
    }


# ========== ADMIN ENDPOINTS ==========

@router.get("/admin/bank-redeem/requests")
async def get_admin_withdrawal_requests(
    status: str = None,
    page: int = 1,
    limit: int = 50
):
    """Get all bank withdrawal requests for admin"""
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    
    requests = await db.bank_withdrawal_requests.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.bank_withdrawal_requests.count_documents(query)
    
    # Get stats
    stats = await db.bank_withdrawal_requests.aggregate([
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount_inr"}
        }}
    ]).to_list(10)
    
    stats_dict = {s["_id"]: {"count": s["count"], "total": s["total_amount"]} for s in stats}
    
    return {
        "requests": requests,
        "total": total,
        "page": page,
        "stats": stats_dict
    }


@router.post("/admin/bank-redeem/{request_id}/approve")
async def approve_withdrawal(request_id: str, request: Request):
    """Approve a bank withdrawal request"""
    data = await request.json()
    admin_id = data.get("admin_id")
    transaction_ref = data.get("transaction_ref", "")
    admin_notes = data.get("admin_notes", "")
    
    withdrawal = await db.bank_withdrawal_requests.find_one({"request_id": request_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if withdrawal.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {withdrawal.get('status')}")
    
    now = datetime.now(timezone.utc)
    
    await db.bank_withdrawal_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": admin_id,
            "transaction_ref": transaction_ref,
            "admin_notes": admin_notes
        }}
    )
    
    # Notify user
    if create_notification:
        try:
            await create_notification(
                user_id=withdrawal["user_id"],
                title="Withdrawal Approved!",
                message=f"Your bank withdrawal of ₹{withdrawal['amount_inr']} has been approved and transferred to your bank account.",
                notification_type="withdrawal"
            )
        except:
            pass
    
    return {"success": True, "message": "Withdrawal approved"}


@router.post("/admin/bank-redeem/{request_id}/reject")
async def reject_withdrawal(request_id: str, request: Request):
    """Reject a bank withdrawal request and refund PRC"""
    data = await request.json()
    admin_id = data.get("admin_id")
    reason = data.get("reason", "Rejected by admin")
    
    withdrawal = await db.bank_withdrawal_requests.find_one({"request_id": request_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if withdrawal.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {withdrawal.get('status')}")
    
    now = datetime.now(timezone.utc)
    user_id = withdrawal["user_id"]
    refund_amount = withdrawal.get("total_prc_deducted", 0)
    
    # Refund PRC
    await db.users.update_one(
        {"uid": user_id},
        {"$inc": {"prc_balance": refund_amount}}
    )
    
    # Log refund transaction
    await db.transactions.insert_one({
        "transaction_id": f"REF{now.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}",
        "user_id": user_id,
        "type": "bank_withdrawal_refund",
        "amount": refund_amount,
        "description": f"Bank withdrawal rejected - ₹{withdrawal['amount_inr']} refunded",
        "reference_id": request_id,
        "created_at": now.isoformat()
    })
    
    # Update request status
    await db.bank_withdrawal_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": now.isoformat(),
            "rejected_by": admin_id,
            "rejection_reason": reason
        }}
    )
    
    # Notify user
    if create_notification:
        try:
            await create_notification(
                user_id=user_id,
                title="Withdrawal Rejected",
                message=f"Your withdrawal request of ₹{withdrawal['amount_inr']} was rejected. {refund_amount} PRC refunded. Reason: {reason}",
                notification_type="withdrawal"
            )
        except:
            pass
    
    return {"success": True, "message": "Withdrawal rejected and PRC refunded"}


@router.get("/admin/bank-redeem/pending-count")
async def get_pending_count():
    """Get count of pending bank withdrawal requests"""
    count = await db.bank_withdrawal_requests.count_documents({"status": "pending"})
    return {"pending_count": count}
