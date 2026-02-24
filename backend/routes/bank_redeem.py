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

def get_current_week_monday():
    """Get Monday 00:00 of current week"""
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    monday = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    next_monday = monday + timedelta(days=7)
    return monday, next_monday

async def check_loan_emi_this_week(user_id: str) -> dict:
    """Check if user has done loan_emi this week"""
    monday, next_monday = get_current_week_monday()
    monday_str = monday.isoformat()
    
    loan_emi_request = await db.bill_payment_requests.find_one({
        "user_id": user_id,
        "request_type": "loan_emi",
        "created_at": {"$gte": monday_str},
        "status": {"$nin": ["rejected", "cancelled"]}
    })
    
    return {
        "has_loan_emi": loan_emi_request is not None,
        "loan_emi_request": loan_emi_request,
        "next_monday": next_monday.isoformat()
    }

# Processing fees - EMI style
# <= ₹499: 50% of amount
# > ₹499: Flat ₹10
def get_processing_fee(amount_inr: int) -> int:
    """Calculate processing fee like EMI"""
    if amount_inr <= 499:
        return int(amount_inr * 0.5)  # 50% of amount
    else:
        return 10  # Flat ₹10

# Admin charge percentage - 20%
ADMIN_CHARGE_PERCENT = 20

# Slider allows any amount from 100 to max
MIN_AMOUNT = 100
MAX_AMOUNT = 25000


def calculate_total_prc(amount_inr: int) -> dict:
    """Calculate total PRC needed for withdrawal - EMI style fees + 20% admin"""
    if amount_inr < MIN_AMOUNT:
        return None
    
    processing_fee = get_processing_fee(amount_inr)
    admin_charge = int(amount_inr * (ADMIN_CHARGE_PERCENT / 100))  # 20% admin charge
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
        "total_prc": int(total_inr * prc_rate)
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
    """Get fee info for slider - EMI style fees"""
    # Sample calculations for common amounts
    sample_amounts = [100, 200, 300, 400, 500, 1000, 2000, 5000]
    samples = []
    for amount in sample_amounts:
        calc = calculate_total_prc(amount)
        if calc:
            samples.append(calc)
    
    return {
        "min_amount": MIN_AMOUNT,
        "max_amount": MAX_AMOUNT,
        "fee_structure": {
            "below_500": "50% of amount",
            "above_500": "Flat ₹10"
        },
        "samples": samples,
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
    
    # STRICT: Check if user has done loan_emi this week
    emi_check = await check_loan_emi_this_week(user_id)
    if emi_check["has_loan_emi"]:
        return {
            "eligible": False,
            "reason": "emi_done_this_week",
            "message": f"Weekly limit: Only ONE of Pay EMI or Bank Redeem or PRC Savings Vault Redeem allowed per week. You have already done Pay EMI this week. Try again from Monday ({emi_check['next_monday'][:10]})."
        }
    
    # Check for existing bank withdrawal request this week
    monday, next_monday = get_current_week_monday()
    monday_str = monday.isoformat()
    recent_request = await db.bank_withdrawal_requests.find_one({
        "user_id": user_id,
        "created_at": {"$gte": monday_str},
        "status": {"$nin": ["rejected", "cancelled"]}
    })
    
    if recent_request:
        return {
            "eligible": False,
            "reason": "weekly_limit",
            "message": f"Weekly limit: Only 1 Bank Redeem allowed per week. Try again from Monday ({next_monday.isoformat()[:10]}).",
            "next_eligible_date": next_monday.isoformat(),
            "existing_request": {
                "request_id": recent_request.get("request_id"),
                "amount": recent_request.get("amount_inr"),
                "status": recent_request.get("status"),
                "created_at": recent_request.get("created_at")
            }
        }
    
    # STRICT: Check if user has done RD (PRC Savings Vault) redeem this week
    rd_redeem_request = await db.bank_redeem_requests.find_one({
        "user_id": user_id,
        "request_type": "rd_redeem",
        "created_at": {"$gte": monday_str},
        "status": {"$nin": ["rejected", "cancelled"]}
    })
    
    if rd_redeem_request:
        return {
            "eligible": False,
            "reason": "rd_redeem_done_this_week",
            "message": f"Weekly limit: Only ONE of Pay EMI or Bank Redeem or PRC Savings Vault Redeem allowed per week. You have already done PRC Savings Vault Redeem this week. Try again from Monday ({next_monday.isoformat()[:10]})."
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
    
    # ===== CHECK IF BANK REDEEM SERVICE IS ENABLED =====
    settings = await db.settings.find_one({}, {"_id": 0, "service_toggles": 1})
    toggles = settings.get("service_toggles", {}) if settings else {}
    if not toggles.get("bank_redeem", True):
        raise HTTPException(
            status_code=503, 
            detail="Service temporarily down. Please try again later."
        )
    # ===================================================
    
    # Validate amount - slider allows any amount from MIN to MAX
    if not amount_inr or amount_inr < MIN_AMOUNT:
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum withdrawal amount is ₹{MIN_AMOUNT}"
        )
    
    if amount_inr > MAX_AMOUNT:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum withdrawal amount is ₹{MAX_AMOUNT}"
        )
    
    # Check bank details
    if not user.get("bank_details"):
        raise HTTPException(status_code=400, detail="Please add your bank details first")
    
    # Check KYC
    if user.get("kyc_status") != "verified":
        raise HTTPException(status_code=400, detail="KYC verification required for withdrawals")
    
    # STRICT: Check if user has done loan_emi this week
    emi_check = await check_loan_emi_this_week(user_id)
    if emi_check["has_loan_emi"]:
        raise HTTPException(
            status_code=429, 
            detail=f"Weekly limit: Only ONE of Pay EMI or Bank Redeem or PRC Savings Vault Redeem allowed per week. You have already done Pay EMI this week. Try again from Monday ({emi_check['next_monday'][:10]})."
        )
    
    # Check weekly bank redeem limit
    monday, next_monday = get_current_week_monday()
    monday_str = monday.isoformat()
    recent_request = await db.bank_withdrawal_requests.find_one({
        "user_id": user_id,
        "created_at": {"$gte": monday_str},
        "status": {"$nin": ["rejected", "cancelled"]}
    })
    
    if recent_request:
        raise HTTPException(
            status_code=429, 
            detail=f"Weekly limit: Only 1 Bank Redeem allowed per week. Try again from Monday ({next_monday.isoformat()[:10]})."
        )
    
    # STRICT: Check if user has done RD (PRC Savings Vault) redeem this week
    rd_redeem_request = await db.bank_redeem_requests.find_one({
        "user_id": user_id,
        "request_type": "rd_redeem",
        "created_at": {"$gte": monday_str},
        "status": {"$nin": ["rejected", "cancelled"]}
    })
    
    if rd_redeem_request:
        raise HTTPException(
            status_code=429, 
            detail=f"Weekly limit: Only ONE of Pay EMI or Bank Redeem or PRC Savings Vault Redeem allowed per week. You have already done PRC Savings Vault Redeem this week. Try again from Monday ({next_monday.isoformat()[:10]})."
        )
    
    # Calculate charges - EMI style
    charges = calculate_total_prc(amount_inr)
    if not charges:
        raise HTTPException(status_code=400, detail="Invalid amount")
    total_prc = charges["total_prc"]
    
    # Check PRC balance
    prc_balance = user.get("prc_balance", 0)
    if prc_balance < total_prc:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient PRC balance. Required: {total_prc} PRC, Available: {prc_balance} PRC"
        )
    
    # User can redeem up to 100% of their balance
    # (Balance check already done above - no additional limit needed)
    
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



# ========== USER EDIT PENDING REQUEST ==========

@router.put("/bank-redeem/request/{user_id}/{request_id}")
async def edit_pending_request(user_id: str, request_id: str, request: Request):
    """
    Allow user to edit their pending bank redeem request
    - Only pending requests can be edited
    - Can change: amount, bank details
    - PRC will be adjusted accordingly
    """
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get the existing request
    existing_request = await db.bank_withdrawal_requests.find_one({
        "request_id": request_id,
        "user_id": user_id
    })
    
    if not existing_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Only pending requests can be edited
    if existing_request.get("status") != "pending":
        raise HTTPException(
            status_code=400, 
            detail=f"Only pending requests can be edited. Current status: {existing_request.get('status')}"
        )
    
    data = await request.json()
    new_amount_inr = data.get("amount_inr")
    new_bank_details = data.get("bank_details")
    
    if not new_amount_inr and not new_bank_details:
        raise HTTPException(status_code=400, detail="No changes provided")
    
    old_amount_inr = existing_request.get("amount_inr", 0)
    old_total_prc = existing_request.get("total_prc_deducted", 0)
    
    updates = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    prc_adjustment = 0
    
    # Handle amount change
    if new_amount_inr and new_amount_inr != old_amount_inr:
        # Validate new amount
        if new_amount_inr < MIN_AMOUNT or new_amount_inr > MAX_AMOUNT:
            raise HTTPException(
                status_code=400, 
                detail=f"Amount must be between ₹{MIN_AMOUNT} and ₹{MAX_AMOUNT}"
            )
        
        # Calculate new charges
        new_charges = calculate_charges(new_amount_inr)
        new_total_prc = calculate_total_prc(new_amount_inr)
        
        if not new_total_prc:
            raise HTTPException(status_code=400, detail="Invalid amount")
        
        new_total_prc = new_total_prc["total_prc"]
        prc_adjustment = old_total_prc - new_total_prc  # Positive = refund, Negative = deduct more
        
        # Check if user has enough balance for additional deduction
        if prc_adjustment < 0:
            current_balance = user.get("prc_balance", 0)
            if current_balance < abs(prc_adjustment):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient PRC balance. Need {abs(prc_adjustment)} more PRC."
                )
        
        updates.update({
            "amount_inr": new_amount_inr,
            "processing_fee_inr": new_charges["processing_fee_inr"],
            "admin_charge_inr": new_charges["admin_charge_inr"],
            "total_inr": new_charges["total_inr"],
            "total_prc_deducted": new_total_prc
        })
    
    # Handle bank details change
    if new_bank_details:
        # Validate bank details
        if new_bank_details.get("account_number"):
            acc_num = new_bank_details["account_number"].replace(" ", "")
            if len(acc_num) < 9 or len(acc_num) > 18:
                raise HTTPException(status_code=400, detail="Account number must be 9-18 digits")
            new_bank_details["account_number"] = acc_num
        
        if new_bank_details.get("ifsc_code"):
            ifsc = new_bank_details["ifsc_code"].upper()
            import re
            if not re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', ifsc):
                raise HTTPException(status_code=400, detail="Invalid IFSC format")
            new_bank_details["ifsc_code"] = ifsc
        
        # Merge with existing bank details
        current_bank = existing_request.get("bank_details", {})
        current_bank.update(new_bank_details)
        updates["bank_details"] = current_bank
    
    # Apply updates
    await db.bank_withdrawal_requests.update_one(
        {"request_id": request_id},
        {"$set": updates}
    )
    
    # Adjust PRC balance if amount changed
    if prc_adjustment != 0:
        await db.users.update_one(
            {"uid": user_id},
            {"$inc": {"prc_balance": prc_adjustment}}
        )
        
        # Log the adjustment transaction
        now = datetime.now(timezone.utc)
        adjustment_type = "prc_refund" if prc_adjustment > 0 else "prc_deduction"
        await db.transactions.insert_one({
            "transaction_id": f"TXN{now.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}",
            "user_id": user_id,
            "type": adjustment_type,
            "amount": prc_adjustment,
            "description": f"Bank redeem request edit: ₹{old_amount_inr} → ₹{new_amount_inr}",
            "reference_id": request_id,
            "created_at": now.isoformat()
        })
    
    return {
        "success": True,
        "message": "Request updated successfully",
        "request_id": request_id,
        "changes": {
            "amount_changed": new_amount_inr != old_amount_inr if new_amount_inr else False,
            "bank_details_changed": new_bank_details is not None,
            "prc_adjustment": prc_adjustment
        }
    }


@router.delete("/bank-redeem/request/{user_id}/{request_id}")
async def cancel_pending_request(user_id: str, request_id: str):
    """
    Allow user to cancel their pending bank redeem request
    - Full PRC refund on cancellation
    """
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get the existing request
    existing_request = await db.bank_withdrawal_requests.find_one({
        "request_id": request_id,
        "user_id": user_id
    })
    
    if not existing_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Only pending requests can be cancelled
    if existing_request.get("status") != "pending":
        raise HTTPException(
            status_code=400, 
            detail=f"Only pending requests can be cancelled. Current status: {existing_request.get('status')}"
        )
    
    prc_to_refund = existing_request.get("total_prc_deducted", 0)
    
    # Update request status
    now = datetime.now(timezone.utc)
    await db.bank_withdrawal_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
            "cancelled_by": "user"
        }}
    )
    
    # Refund PRC
    if prc_to_refund > 0:
        await db.users.update_one(
            {"uid": user_id},
            {"$inc": {"prc_balance": prc_to_refund}}
        )
        
        # Log refund transaction
        await db.transactions.insert_one({
            "transaction_id": f"TXN{now.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}",
            "user_id": user_id,
            "type": "prc_refund",
            "amount": prc_to_refund,
            "description": f"Bank redeem request cancelled - ₹{existing_request.get('amount_inr', 0)}",
            "reference_id": request_id,
            "created_at": now.isoformat()
        })
    
    return {
        "success": True,
        "message": "Request cancelled successfully",
        "request_id": request_id,
        "prc_refunded": prc_to_refund
    }



# ========== ADMIN ENDPOINTS ==========

@router.get("/admin/bank-redeem/requests")
async def get_admin_withdrawal_requests(
    status: str = None,
    page: int = 1,
    limit: int = 50,
    search: str = None,
    date_from: str = None,
    date_to: str = None,
    sort_order: str = "desc"
):
    """Get all bank withdrawal requests for admin with search and date filters"""
    query = {}
    if status:
        query["status"] = status
    
    # Date range filtering
    if date_from or date_to:
        date_query = {}
        if date_from:
            # Convert date string (YYYY-MM-DD) to ISO format with start of day
            date_query["$gte"] = f"{date_from}T00:00:00+00:00"
        if date_to:
            # Convert date string (YYYY-MM-DD) to ISO format with end of day
            date_query["$lte"] = f"{date_to}T23:59:59+00:00"
        if date_query:
            query["created_at"] = date_query
    
    # If search provided, find matching user IDs first
    if search:
        search_users = await db.users.find({
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}},
                {"mobile": {"$regex": search, "$options": "i"}}
            ]
        }, {"_id": 0, "uid": 1}).to_list(100)
        user_ids_to_search = [u["uid"] for u in search_users]
        
        # Search by user_id or request_id or bank name
        query["$or"] = [
            {"user_id": {"$in": user_ids_to_search}} if user_ids_to_search else {"user_id": None},
            {"request_id": {"$regex": search, "$options": "i"}},
            {"bank_details.bank_name": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    
    # Sort order: asc = oldest first, desc = newest first
    sort_direction = 1 if sort_order == "asc" else -1
    
    requests_list = await db.bank_withdrawal_requests.find(
        query,
        {"_id": 0}
    ).sort("created_at", sort_direction).skip(skip).limit(limit).to_list(limit)
    
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
        "requests": requests_list,
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
    
    # Get admin details for tracking
    admin_user = await db.users.find_one({"uid": admin_id}, {"_id": 0, "name": 1, "email": 1})
    admin_name = admin_user.get("name", "Admin") if admin_user else "Admin"
    
    await db.bank_withdrawal_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": admin_id,
            "approved_by_name": admin_name,
            "processed_by": admin_name,
            "processed_by_uid": admin_id,
            "processed_at": now.isoformat(),
            "transaction_ref": transaction_ref,
            "admin_notes": admin_notes
        }}
    )
    
    # Notify user
    if create_notification:
        try:
            await create_notification(
                user_id=withdrawal["user_id"],
                title="Payment Approved ✓",
                message=f"Your bank withdrawal of ₹{withdrawal['amount_inr']:,.0f} has been approved and transferred to your bank account.",
                notification_type="payment_approved",
                data={"amount_inr": withdrawal['amount_inr'], "payment_type": "bank_withdrawal"}
            )
        except Exception:
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
    
    # Get admin details for tracking
    admin_user = await db.users.find_one({"uid": admin_id}, {"_id": 0, "name": 1, "email": 1})
    admin_name = admin_user.get("name", "Admin") if admin_user else "Admin"
    
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
            "rejected_by_name": admin_name,
            "processed_by": admin_name,
            "processed_by_uid": admin_id,
            "processed_at": now.isoformat(),
            "rejection_reason": reason
        }}
    )
    
    # Notify user
    if create_notification:
        try:
            await create_notification(
                user_id=user_id,
                title="Payment Rejected",
                message=f"Your withdrawal request of ₹{withdrawal['amount_inr']:,.0f} was rejected. {refund_amount:,.0f} PRC refunded. Reason: {reason}",
                notification_type="payment_rejected",
                data={"amount_inr": withdrawal['amount_inr'], "reason": reason, "payment_type": "bank_withdrawal"}
            )
        except Exception:
            pass
    
    return {"success": True, "message": "Withdrawal rejected and PRC refunded"}


@router.get("/admin/bank-redeem/pending-count")
async def get_pending_count():
    """Get count of pending bank withdrawal requests"""
    count = await db.bank_withdrawal_requests.count_documents({"status": "pending"})
    return {"pending_count": count}
