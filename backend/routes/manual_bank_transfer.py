"""
PARAS REWARD - Manual Bank Transfer Redeem System
=================================================
Complete fintech-style redeem system where users convert PRC to INR bank transfer.
Admin manually processes transfers and marks requests as PAID/FAILED.

PRC Conversion: 1 INR = 10 PRC
Fee Structure:
  - Transaction Fee: ₹10 flat
  - Admin Fee: 20% of withdrawal amount
  
Limits:
  - Minimum: ₹200
  - Maximum: ₹10,000
"""

import logging
import re
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator
import os

router = APIRouter(prefix="/bank-transfer", tags=["Bank Transfer"])

# Database reference (set by server.py)
db = None

# Global redeem limit check function (set by server.py)
check_redeem_limit_func = None

# Weekly one service limit check function (set by server.py)
check_weekly_one_service_func = None

def set_db(database):
    global db
    db = database

def set_redeem_limit_check(func):
    global check_redeem_limit_func
    check_redeem_limit_func = func

def set_weekly_one_service_check(func):
    global check_weekly_one_service_func
    check_weekly_one_service_func = func

# ==================== CONSTANTS ====================

TRANSACTION_FEE = 10  # ₹10 flat fee
ADMIN_FEE_PERCENT = 20  # 20% admin fee
MIN_WITHDRAWAL = 200  # ₹200 minimum
MAX_WITHDRAWAL = 10000  # ₹10,000 maximum

# Eko API for IFSC verification
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "")

# Dynamic PRC Rate helper
async def get_dynamic_prc_rate():
    """Get PRC rate from dynamic economy system, fallback to database"""
    try:
        # Try to import from main server's dynamic rate function
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # First try dynamic economy calculation
        try:
            from routes.prc_economy import calculate_dynamic_prc_rate
            rate_data = await calculate_dynamic_prc_rate(db)
            if rate_data:
                if isinstance(rate_data, dict):
                    return int(rate_data.get("final_rate", 10))
                return int(rate_data)
        except:
            pass
        
        # Check for manual override
        override = await db.app_settings.find_one({"key": "prc_rate_manual_override"})
        if override and override.get("enabled"):
            override_rate = override.get("rate")
            expires_at = override.get("expires_at")
            if expires_at:
                from datetime import datetime, timezone
                try:
                    expiry = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    if expiry > datetime.now(timezone.utc):
                        return int(override_rate)
                except:
                    pass
            else:
                return int(override_rate)
        
        # Fallback to database settings
        rate_setting = await db.app_settings.find_one({"key": "prc_to_inr_rate"})
        if rate_setting and rate_setting.get("value"):
            return int(rate_setting.get("value"))
        settings = await db.settings.find_one({})
        if settings and settings.get("prc_to_inr_rate"):
            return int(settings.get("prc_to_inr_rate"))
    except Exception as e:
        logging.error(f"[BANK_TRANSFER] Error getting PRC rate: {e}")
    return 10  # Default fallback

# ==================== MODELS ====================

class BankDetails(BaseModel):
    account_holder_name: str = Field(..., min_length=3, max_length=100)
    account_number: str = Field(..., min_length=9, max_length=18)
    ifsc_code: str = Field(..., min_length=11, max_length=11)
    
    @validator('ifsc_code')
    def validate_ifsc(cls, v):
        v = v.upper().strip()
        if not re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', v):
            raise ValueError('Invalid IFSC format. Must be: 4 letters + 0 + 6 alphanumeric (e.g., HDFC0001234)')
        return v
    
    @validator('account_number')
    def validate_account(cls, v):
        v = v.strip()
        if not v.isdigit():
            raise ValueError('Account number must contain only digits')
        return v

class RedeemRequest(BaseModel):
    user_id: str
    amount: int = Field(..., ge=MIN_WITHDRAWAL, le=MAX_WITHDRAWAL)
    bank_details: BankDetails

class AdminActionRequest(BaseModel):
    request_id: str
    admin_id: str
    remark: Optional[str] = None
    utr_number: Optional[str] = None  # For paid requests

# ==================== HELPER FUNCTIONS ====================

async def calculate_fees(amount: int) -> dict:
    """Calculate all fees for a withdrawal amount with dynamic PRC rate."""
    prc_rate = await get_dynamic_prc_rate()
    admin_fee = int(amount * ADMIN_FEE_PERCENT / 100)
    total_inr = amount + admin_fee + TRANSACTION_FEE
    total_prc = total_inr * prc_rate
    
    return {
        "withdrawal_amount": amount,
        "admin_fee": admin_fee,
        "admin_fee_percent": ADMIN_FEE_PERCENT,
        "transaction_fee": TRANSACTION_FEE,
        "total_inr": total_inr,
        "total_prc": total_prc,
        "prc_rate": prc_rate,
        "user_receives": amount  # What user actually gets in bank
    }

async def verify_ifsc_eko(ifsc: str) -> dict:
    """Verify IFSC code using Eko API and get bank details."""
    try:
        # First try Eko API
        if EKO_DEVELOPER_KEY and EKO_INITIATOR_ID:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {
                    "developer_key": EKO_DEVELOPER_KEY,
                    "Content-Type": "application/json"
                }
                
                response = await client.get(
                    f"{EKO_BASE_URL}/v1/banks/ifsc/{ifsc}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == 0 or data.get("response_status_id") == 0:
                        bank_data = data.get("data", {})
                        return {
                            "valid": True,
                            "bank_name": bank_data.get("bank", bank_data.get("bank_name", "")),
                            "branch": bank_data.get("branch", ""),
                            "city": bank_data.get("city", ""),
                            "state": bank_data.get("state", ""),
                            "source": "eko"
                        }
        
        # Fallback: Extract bank name from IFSC prefix
        bank_codes = {
            "HDFC": "HDFC Bank",
            "ICIC": "ICICI Bank",
            "SBIN": "State Bank of India",
            "UTIB": "Axis Bank",
            "KKBK": "Kotak Mahindra Bank",
            "PUNB": "Punjab National Bank",
            "CNRB": "Canara Bank",
            "UBIN": "Union Bank of India",
            "IOBA": "Indian Overseas Bank",
            "BARB": "Bank of Baroda",
            "BKID": "Bank of India",
            "IDIB": "Indian Bank",
            "MAHB": "Bank of Maharashtra",
            "CBIN": "Central Bank of India",
            "YESB": "Yes Bank",
            "FDRL": "Federal Bank",
            "INDB": "IndusInd Bank",
            "RATN": "RBL Bank",
            "KARB": "Karnataka Bank",
            "SRCB": "Saraswat Bank",
            "AUBL": "AU Small Finance Bank",
            "ESFB": "Equitas Small Finance Bank",
            "USFB": "Ujjivan Small Finance Bank",
            "PAYTM": "Paytm Payments Bank",
            "AIRP": "Airtel Payments Bank",
            "JAKA": "Jammu & Kashmir Bank",
            "SIBL": "South Indian Bank",
            "KVBL": "Karur Vysya Bank",
            "TMBL": "Tamilnad Mercantile Bank",
            "DLXB": "Dhanlaxmi Bank",
            "LAVB": "Lakshmi Vilas Bank",
            "CIUB": "City Union Bank",
            "CSBK": "Catholic Syrian Bank",
            "DCBL": "DCB Bank",
            "IDFB": "IDFC First Bank",
            "BDBL": "Bandhan Bank",
        }
        
        prefix = ifsc[:4].upper()
        bank_name = bank_codes.get(prefix, f"Bank ({prefix})")
        
        return {
            "valid": True,
            "bank_name": bank_name,
            "branch": "",
            "city": "",
            "state": "",
            "source": "ifsc_prefix"
        }
        
    except Exception as e:
        logging.error(f"IFSC verification error: {e}")
        # Return basic info on error
        return {
            "valid": True,
            "bank_name": f"Bank ({ifsc[:4]})",
            "branch": "",
            "source": "fallback"
        }

# ==================== USER APIs ====================

@router.get("/config")
async def get_config():
    """Get redeem configuration for frontend with dynamic PRC rate."""
    # Get dynamic PRC rate from settings (default 10)
    prc_rate = 10  # Default fallback
    try:
        rate_setting = await db.app_settings.find_one({"key": "prc_to_inr_rate"})
        if rate_setting and rate_setting.get("value"):
            prc_rate = rate_setting.get("value", 10)
        else:
            settings = await db.settings.find_one({})
            if settings and settings.get("prc_to_inr_rate"):
                prc_rate = settings.get("prc_to_inr_rate", 10)
    except Exception as e:
        logging.warning(f"Error fetching PRC rate: {e}")
    
    return {
        "prc_rate": prc_rate,
        "transaction_fee": TRANSACTION_FEE,
        "admin_fee_percent": ADMIN_FEE_PERCENT,
        "min_withdrawal": MIN_WITHDRAWAL,
        "max_withdrawal": MAX_WITHDRAWAL,
        "note": f"1 INR = {prc_rate} PRC"
    }

@router.get("/calculate-fees")
async def calculate_fees_api(amount: int = Query(..., ge=MIN_WITHDRAWAL, le=MAX_WITHDRAWAL)):
    """Calculate fees for a given withdrawal amount."""
    return {
        "success": True,
        "fees": await calculate_fees(amount)
    }

@router.post("/verify-ifsc")
async def verify_ifsc(ifsc: str):
    """Verify IFSC code and get bank details."""
    ifsc = ifsc.upper().strip()
    
    # Validate format
    if not re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', ifsc):
        raise HTTPException(status_code=400, detail="Invalid IFSC format")
    
    result = await verify_ifsc_eko(ifsc)
    return {
        "success": True,
        "ifsc": ifsc,
        "bank_details": result
    }

@router.post("/request")
async def create_redeem_request(request: RedeemRequest):
    """
    Create a new bank transfer redeem request.
    
    Process:
    1. Validate bank details (IFSC)
    2. Check 24-hour cooldown
    3. Check global redeem limit
    4. Check PRC balance
    5. Calculate fees
    6. Deduct PRC
    7. Create pending request
    """
    from app.services.wallet_service_v2 import WalletServiceV2
    
    try:
        user_id = request.user_id
        amount = request.amount
        bank = request.bank_details
        
        # 1. Validate amount limits
        if amount < MIN_WITHDRAWAL:
            raise HTTPException(status_code=400, detail=f"Minimum withdrawal is ₹{MIN_WITHDRAWAL}")
        if amount > MAX_WITHDRAWAL:
            raise HTTPException(status_code=400, detail=f"Maximum withdrawal is ₹{MAX_WITHDRAWAL}")
        
        # 2. Get user
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # 2.5. CHECK 24-HOUR COOLDOWN
        cooldown_hours = 24
        now = datetime.now(timezone.utc)
        cutoff_time = now - timedelta(hours=cooldown_hours)
        
        last_request = await db.bank_withdrawal_requests.find_one(
            {
                "user_id": user_id,
                "status": {"$nin": ["rejected", "failed", "cancelled"]}
            },
            sort=[("created_at", -1)]
        )
        
        if last_request:
            last_time = last_request.get("created_at")
            if isinstance(last_time, str):
                try:
                    last_time = datetime.fromisoformat(last_time.replace('Z', '+00:00'))
                except:
                    last_time = None
            
            if last_time:
                if last_time.tzinfo is None:
                    last_time = last_time.replace(tzinfo=timezone.utc)
                
                if last_time > cutoff_time:
                    time_passed = now - last_time
                    remaining = timedelta(hours=cooldown_hours) - time_passed
                    remaining_hours = remaining.total_seconds() / 3600
                    raise HTTPException(
                        status_code=429,
                        detail=f"Please wait {remaining_hours:.0f} hours before requesting another bank transfer."
                    )
        
        # 3. Check KYC
        if user.get("kyc_status") != "verified":
            raise HTTPException(status_code=403, detail="KYC verification required for bank transfers")
        
        # 3.5. Check Weekly ONE SERVICE Limit
        if check_weekly_one_service_func:
            weekly_check = await check_weekly_one_service_func(user_id, "bank_transfer")
            if not weekly_check.get("allowed"):
                raise HTTPException(
                    status_code=403,
                    detail=weekly_check.get("reason_en", weekly_check.get("reason", "Weekly service limit reached"))
                )
        
        # 4. Calculate fees with dynamic PRC rate
        fees = await calculate_fees(amount)
        total_prc = fees["total_prc"]
        
        # 5. Check Global Redeem Limit
        if check_redeem_limit_func:
            limit_check = await check_redeem_limit_func(user_id, total_prc)
            if not limit_check.get("allowed"):
                limit_info = limit_check.get("limit_info", {})
                raise HTTPException(
                    status_code=403,
                    detail=f"Redeem limit exceeded. Monthly limit: {limit_info.get('total_limit', 0):,.0f} PRC, Used: {limit_info.get('total_redeemed', 0):,.0f} PRC, Remaining: {limit_info.get('remaining_limit', 0):,.0f} PRC"
                )
        
        # 6. Verify IFSC and get bank name
        ifsc_result = await verify_ifsc_eko(bank.ifsc_code)
        bank_name = ifsc_result.get("bank_name", "Unknown Bank")
        
        # 7. Check PRC balance
        current_balance = float(user.get("prc_balance", 0))
        if current_balance < total_prc:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient PRC balance. Required: {total_prc:,} PRC, Available: {current_balance:,.2f} PRC"
            )
        
        # 8. Check for duplicate pending request
        existing_pending = await db.bank_transfer_requests.find_one({
            "user_id": user_id,
            "status": "pending"
        })
        if existing_pending:
            raise HTTPException(
                status_code=400,
                detail="You already have a pending request. Please wait for it to be processed."
            )
        
        # 8. Generate request ID
        request_id = f"BTR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"
        
        # 9. Deduct PRC using WalletServiceV2
        debit_result = WalletServiceV2.debit(
            user_id=user_id,
            amount=total_prc,
            txn_type="bank_transfer",
            description=f"Bank Transfer: ₹{amount} to A/C {bank.account_number[-4:]}",
            reference=request_id,
            service_type="bank_transfer"
        )
        
        if not debit_result.get("success"):
            raise HTTPException(status_code=400, detail=debit_result.get("error", "Failed to deduct PRC"))
        
        # 10. Create request record
        request_data = {
            "request_id": request_id,
            "user_id": user_id,
            "user_name": user.get("name", ""),
            "user_phone": user.get("mobile", ""),
            "user_email": user.get("email", ""),
            
            # Amount details
            "withdrawal_amount": amount,
            "admin_fee": fees["admin_fee"],
            "transaction_fee": fees["transaction_fee"],
            "total_inr": fees["total_inr"],
            "prc_deducted": total_prc,
            
            # Bank details
            "account_holder_name": bank.account_holder_name,
            "account_number": bank.account_number,
            "ifsc_code": bank.ifsc_code,
            "bank_name": bank_name,
            "branch": ifsc_result.get("branch", ""),
            
            # Status
            "status": "pending",
            "admin_remark": None,
            "utr_number": None,
            "processed_by": None,
            "processed_at": None,
            
            # Timestamps
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            
            # PRC transaction reference
            "prc_txn_id": debit_result.get("txn_id"),
            "prc_refunded": False
        }
        
        await db.bank_transfer_requests.insert_one(request_data)
        
        logging.info(f"[BANK TRANSFER] New request: {request_id} | User: {user_id} | Amount: ₹{amount} | PRC: {total_prc}")
        
        return {
            "success": True,
            "message": "Bank transfer request submitted successfully",
            "request": {
                "request_id": request_id,
                "amount": amount,
                "total_prc_deducted": total_prc,
                "bank_name": bank_name,
                "account_number": f"XXXX{bank.account_number[-4:]}",
                "status": "pending",
                "estimated_processing": "24-48 hours"
            },
            "new_balance": debit_result.get("balance_after", 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[BANK TRANSFER] Request error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Server error. Please try again.")

@router.get("/my-requests/{user_id}")
async def get_user_requests(
    user_id: str,
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    skip: int = 0
):
    """Get user's bank transfer request history."""
    try:
        query = {"user_id": user_id}
        if status:
            query["status"] = status
        
        requests = await db.bank_transfer_requests.find(
            query,
            {"_id": 0}
        ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)  # 1 = oldest first
        
        total = await db.bank_transfer_requests.count_documents(query)
        
        # Mask account numbers for security
        for req in requests:
            if req.get("account_number"):
                req["account_number_masked"] = f"XXXX{req['account_number'][-4:]}"
        
        return {
            "success": True,
            "requests": requests,
            "total": total,
            "limit": limit,
            "skip": skip
        }
        
    except Exception as e:
        logging.error(f"Error fetching user requests: {e}")
        raise HTTPException(status_code=500, detail="Server error")

# ==================== ADMIN APIs ====================

@router.get("/admin/requests")
async def get_all_requests(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    skip: int = 0,
    search: Optional[str] = None
):
    """Get all bank transfer requests for admin."""
    try:
        query = {}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"request_id": {"$regex": search, "$options": "i"}},
                {"user_name": {"$regex": search, "$options": "i"}},
                {"user_phone": {"$regex": search, "$options": "i"}},
                {"account_number": {"$regex": search, "$options": "i"}}
            ]
        
        requests = await db.bank_transfer_requests.find(
            query,
            {"_id": 0}
        ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)  # 1 = oldest first
        
        total = await db.bank_transfer_requests.count_documents(query)
        
        # Get counts by status
        pending_count = await db.bank_transfer_requests.count_documents({"status": "pending"})
        paid_count = await db.bank_transfer_requests.count_documents({"status": "paid"})
        failed_count = await db.bank_transfer_requests.count_documents({"status": "failed"})
        
        # Calculate totals
        pipeline = [
            {"$group": {
                "_id": "$status",
                "total_amount": {"$sum": "$withdrawal_amount"},
                "total_prc": {"$sum": "$prc_deducted"}
            }}
        ]
        totals = await db.bank_transfer_requests.aggregate(pipeline).to_list(10)
        totals_dict = {t["_id"]: t for t in totals}
        
        return {
            "success": True,
            "requests": requests,
            "pagination": {
                "total": total,
                "limit": limit,
                "skip": skip,
                "pages": (total + limit - 1) // limit
            },
            "stats": {
                "pending": {
                    "count": pending_count,
                    "amount": totals_dict.get("pending", {}).get("total_amount", 0),
                    "prc": totals_dict.get("pending", {}).get("total_prc", 0)
                },
                "paid": {
                    "count": paid_count,
                    "amount": totals_dict.get("paid", {}).get("total_amount", 0),
                    "prc": totals_dict.get("paid", {}).get("total_prc", 0)
                },
                "failed": {
                    "count": failed_count,
                    "amount": totals_dict.get("failed", {}).get("total_amount", 0),
                    "prc": totals_dict.get("failed", {}).get("total_prc", 0)
                }
            }
        }
        
    except Exception as e:
        logging.error(f"Error fetching admin requests: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.get("/admin/request/{request_id}")
async def get_request_details(request_id: str):
    """Get detailed view of a specific request."""
    try:
        request = await db.bank_transfer_requests.find_one(
            {"request_id": request_id},
            {"_id": 0}
        )
        
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Get user details
        user = await db.users.find_one(
            {"uid": request.get("user_id")},
            {"_id": 0, "password": 0, "pin_hash": 0, "password_hash": 0}
        )
        
        return {
            "success": True,
            "request": request,
            "user": {
                "name": user.get("name") if user else "Unknown",
                "phone": user.get("mobile") if user else "",
                "email": user.get("email") if user else "",
                "prc_balance": user.get("prc_balance") if user else 0,
                "kyc_status": user.get("kyc_status") if user else "unknown"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching request details: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post("/admin/mark-paid")
async def mark_request_paid(action: AdminActionRequest):
    """Mark a request as paid after manual bank transfer."""
    try:
        request = await db.bank_transfer_requests.find_one({"request_id": action.request_id})
        
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request.get("status") != "pending":
            raise HTTPException(status_code=400, detail=f"Request is already {request.get('status')}")
        
        # Update request
        await db.bank_transfer_requests.update_one(
            {"request_id": action.request_id},
            {
                "$set": {
                    "status": "paid",
                    "utr_number": action.utr_number,
                    "admin_remark": action.remark or "Payment completed",
                    "processed_by": action.admin_id,
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logging.info(f"[BANK TRANSFER] Marked PAID: {action.request_id} | Admin: {action.admin_id} | UTR: {action.utr_number}")
        
        # TODO: Send notification to user
        
        return {
            "success": True,
            "message": f"Request {action.request_id} marked as PAID",
            "utr_number": action.utr_number
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error marking paid: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post("/admin/mark-failed")
async def mark_request_failed(action: AdminActionRequest):
    """Mark a request as failed and refund PRC."""
    from app.services.wallet_service_v2 import WalletServiceV2
    
    try:
        request = await db.bank_transfer_requests.find_one({"request_id": action.request_id})
        
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request.get("status") != "pending":
            raise HTTPException(status_code=400, detail=f"Request is already {request.get('status')}")
        
        if request.get("prc_refunded"):
            raise HTTPException(status_code=400, detail="PRC already refunded")
        
        # Refund PRC
        prc_to_refund = request.get("prc_deducted", 0)
        user_id = request.get("user_id")
        
        if prc_to_refund > 0:
            credit_result = WalletServiceV2.credit(
                user_id=user_id,
                amount=prc_to_refund,
                txn_type="refund",
                description=f"Bank Transfer Failed: {action.remark or 'Request rejected'}",
                reference=action.request_id,
                service_type="bank_transfer_refund"
            )
            
            if not credit_result.get("success"):
                logging.error(f"Failed to refund PRC for {action.request_id}: {credit_result}")
                raise HTTPException(status_code=500, detail="Failed to refund PRC")
        
        # Update request
        await db.bank_transfer_requests.update_one(
            {"request_id": action.request_id},
            {
                "$set": {
                    "status": "failed",
                    "admin_remark": action.remark or "Request rejected",
                    "processed_by": action.admin_id,
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "prc_refunded": True,
                    "refund_txn_id": credit_result.get("txn_id") if prc_to_refund > 0 else None
                }
            }
        )
        
        logging.info(f"[BANK TRANSFER] Marked FAILED: {action.request_id} | Admin: {action.admin_id} | Refund: {prc_to_refund} PRC")
        
        # TODO: Send notification to user
        
        return {
            "success": True,
            "message": f"Request {action.request_id} marked as FAILED. {prc_to_refund:,} PRC refunded.",
            "prc_refunded": prc_to_refund
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error marking failed: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Server error")


class BulkActionRequest(BaseModel):
    """Request model for bulk actions"""
    request_ids: list = Field(default=[], description="List of request IDs to process")
    admin_id: str = Field(..., description="Admin user ID")
    remark: str = Field(default="Bulk action", description="Reason for bulk action")
    mark_all_pending: bool = Field(default=False, description="If true, mark ALL pending requests")


@router.post("/admin/bulk-mark-failed")
async def bulk_mark_failed(action: BulkActionRequest):
    """
    Bulk mark requests as failed. Can either:
    1. Mark specific request_ids as failed
    2. Mark ALL pending requests as failed (if mark_all_pending=True)
    
    PRC will be refunded for each failed request.
    """
    try:
        failed_count = 0
        error_count = 0
        total_refunded = 0
        
        # Get requests to process
        if action.mark_all_pending:
            # Get ALL pending requests
            requests_to_fail = await db.bank_transfer_requests.find(
                {"status": "pending"}
            ).to_list(1000)
        else:
            # Get specific requests
            requests_to_fail = await db.bank_transfer_requests.find(
                {"request_id": {"$in": action.request_ids}, "status": "pending"}
            ).to_list(len(action.request_ids))
        
        if not requests_to_fail:
            return {
                "success": True,
                "message": "No pending requests found to process",
                "failed_count": 0,
                "total_refunded": 0
            }
        
        # Process each request
        for request in requests_to_fail:
            try:
                request_id = request.get("request_id")
                prc_to_refund = request.get("prc_deducted", 0)
                user_id = request.get("user_id")
                
                # Refund PRC directly to user's balance
                if prc_to_refund > 0 and user_id:
                    await db.users.update_one(
                        {"uid": user_id},
                        {"$inc": {"prc_balance": prc_to_refund}}
                    )
                    total_refunded += prc_to_refund
                
                # Update request status
                await db.bank_transfer_requests.update_one(
                    {"request_id": request_id},
                    {
                        "$set": {
                            "status": "failed",
                            "admin_remark": action.remark or "Bulk failed by admin",
                            "processed_by": action.admin_id,
                            "processed_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "prc_refunded": True
                        }
                    }
                )
                
                failed_count += 1
                
            except Exception as req_err:
                logging.error(f"Error processing request {request.get('request_id')}: {req_err}")
                error_count += 1
        
        logging.info(f"[BANK TRANSFER] Bulk FAILED: {failed_count} requests | Admin: {action.admin_id} | Refund: {total_refunded} PRC")
        
        return {
            "success": True,
            "message": f"Marked {failed_count} requests as failed. {total_refunded:,} PRC refunded.",
            "failed_count": failed_count,
            "error_count": error_count,
            "total_refunded": total_refunded
        }
        
    except Exception as e:
        logging.error(f"Bulk fail error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Server error")


@router.post("/admin/bulk-mark-paid")
async def bulk_mark_paid(action: BulkActionRequest):
    """
    Bulk mark selected requests as paid.
    Note: UTR number will be set as "BULK-{timestamp}" for bulk operations.
    """
    try:
        if not action.request_ids or len(action.request_ids) == 0:
            raise HTTPException(status_code=400, detail="No request IDs provided")
        
        paid_count = 0
        error_count = 0
        bulk_utr = f"BULK-{int(datetime.now().timestamp())}"
        
        for request_id in action.request_ids:
            try:
                request = await db.bank_transfer_requests.find_one({
                    "request_id": request_id,
                    "status": "pending"
                })
                
                if not request:
                    error_count += 1
                    continue
                
                await db.bank_transfer_requests.update_one(
                    {"request_id": request_id},
                    {
                        "$set": {
                            "status": "paid",
                            "utr_number": bulk_utr,
                            "admin_remark": action.remark or "Bulk paid by admin",
                            "processed_by": action.admin_id,
                            "processed_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                paid_count += 1
                
            except Exception as req_err:
                logging.error(f"Error processing request {request_id}: {req_err}")
                error_count += 1
        
        logging.info(f"[BANK TRANSFER] Bulk PAID: {paid_count} requests | Admin: {action.admin_id} | UTR: {bulk_utr}")
        
        return {
            "success": True,
            "message": f"Marked {paid_count} requests as paid.",
            "paid_count": paid_count,
            "error_count": error_count,
            "bulk_utr": bulk_utr
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Bulk paid error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Server error")


@router.get("/admin/stats")
async def get_admin_stats():
    """Get dashboard statistics for admin."""
    try:
        # Counts by status
        pending = await db.bank_transfer_requests.count_documents({"status": "pending"})
        paid = await db.bank_transfer_requests.count_documents({"status": "paid"})
        failed = await db.bank_transfer_requests.count_documents({"status": "failed"})
        
        # Sum of PRC
        pipeline = [
            {"$group": {
                "_id": "$status",
                "total_prc": {"$sum": "$prc_deducted"},
                "total_inr": {"$sum": "$withdrawal_amount"}
            }}
        ]
        sums = await db.bank_transfer_requests.aggregate(pipeline).to_list(10)
        sums_dict = {s["_id"]: s for s in sums}
        
        # Total PRC burned (paid requests)
        total_prc_burned = sums_dict.get("paid", {}).get("total_prc", 0)
        
        # Today's stats
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_pending = await db.bank_transfer_requests.count_documents({
            "status": "pending",
            "created_at": {"$regex": f"^{today}"}
        })
        today_paid = await db.bank_transfer_requests.count_documents({
            "status": "paid",
            "processed_at": {"$regex": f"^{today}"}
        })
        
        return {
            "success": True,
            "stats": {
                "total_pending": pending,
                "total_paid": paid,
                "total_failed": failed,
                "total_prc_burned": total_prc_burned,
                "pending_amount": sums_dict.get("pending", {}).get("total_inr", 0),
                "paid_amount": sums_dict.get("paid", {}).get("total_inr", 0),
                "today": {
                    "new_requests": today_pending,
                    "processed": today_paid
                }
            }
        }
        
    except Exception as e:
        logging.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail="Server error")
