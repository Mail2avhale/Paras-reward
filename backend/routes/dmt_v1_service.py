"""
PARAS REWARD - DMT V1 Service (Domestic Money Transfer)
=======================================================
Eko API V1 integration for bank transfers.

Features:
- Customer registration with OTP verification
- Recipient (beneficiary) management
- Bank account transfers via IMPS/NEFT
- Transaction status tracking
- PRC-based payment with WalletService integration
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import logging
import uuid
import os
import httpx
import hashlib
import hmac
import base64

# Import WalletService for ledger-based PRC operations
from app.services import WalletService

router = APIRouter(prefix="/eko/dmt", tags=["DMT V1 - Money Transfer"])

# Database reference
db = None

def set_db(database):
    global db
    db = database

# ==================== EKO V1 CONFIGURATION ====================

EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "7c179a397b4710e71b2248d1f5892d19")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "7a2529f5-3587-4add-a2df-3d0606d62460")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")

# DMT Settings
DMT_ENABLED = True
DMT_DAILY_LIMIT = 200000  # ₹2 lakh per day
DMT_PER_TXN_LIMIT = 25000  # ₹25,000 per transaction
DMT_MIN_AMOUNT = 100  # Minimum ₹100
DMT_COMMISSION_RATE = 0.01  # 1% commission

# ==================== HELPER FUNCTIONS ====================

def generate_eko_secret_key(timestamp: str) -> str:
    """Generate secret key for Eko API authentication."""
    key = EKO_AUTHENTICATOR_KEY
    encoded_key = base64.b64encode(key.encode()).decode()
    signature = hmac.new(
        encoded_key.encode(),
        timestamp.encode(),
        hashlib.sha256
    ).digest()
    return base64.b64encode(signature).decode()

def get_eko_headers() -> dict:
    """Get headers for Eko API requests."""
    timestamp = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": generate_eko_secret_key(timestamp),
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/x-www-form-urlencoded"
    }

def calculate_charges(amount: float) -> dict:
    """Calculate transfer charges."""
    commission = round(amount * DMT_COMMISSION_RATE, 2)
    total_prc = amount + commission
    return {
        "amount": amount,
        "commission": commission,
        "total_prc": total_prc,
        "commission_rate": f"{DMT_COMMISSION_RATE * 100}%"
    }

# ==================== PYDANTIC MODELS ====================

class CustomerSearchRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    user_id: str

class CustomerRegisterRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    name: str
    user_id: str

class OTPVerifyRequest(BaseModel):
    mobile: str
    otp: str
    user_id: str

class RecipientAddRequest(BaseModel):
    mobile: str  # Customer mobile
    account_number: str
    ifsc: str
    recipient_name: str
    bank_name: Optional[str] = None
    user_id: str

class TransferRequest(BaseModel):
    mobile: str  # Customer mobile
    recipient_id: str
    amount: float = Field(..., ge=100, le=25000)
    user_id: str
    remarks: Optional[str] = "Fund Transfer"

# ==================== HEALTH & STATUS ====================

@router.get("/health")
async def dmt_health():
    """Check DMT service health."""
    return {
        "status": "healthy" if DMT_ENABLED else "disabled",
        "service": "DMT V1",
        "enabled": DMT_ENABLED,
        "daily_limit": DMT_DAILY_LIMIT,
        "per_txn_limit": DMT_PER_TXN_LIMIT,
        "min_amount": DMT_MIN_AMOUNT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/wallet/{user_id}")
async def get_user_wallet(user_id: str):
    """Get user PRC balance and daily transfer limits."""
    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get today's transfers
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    daily_transfers = await db.dmt_transactions.aggregate([
        {
            "$match": {
                "user_id": user_id,
                "status": "success",
                "created_at": {"$gte": today.isoformat()}
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    daily_used = daily_transfers[0]["total"] if daily_transfers else 0
    daily_remaining = max(0, DMT_DAILY_LIMIT - daily_used)
    
    return {
        "success": True,
        "prc_balance": user.get("prc_balance", 0),
        "daily_limit": DMT_DAILY_LIMIT,
        "daily_used": daily_used,
        "daily_remaining": daily_remaining,
        "per_txn_limit": DMT_PER_TXN_LIMIT,
        "min_amount": DMT_MIN_AMOUNT
    }

# ==================== CUSTOMER MANAGEMENT ====================

@router.post("/customer/search")
async def search_customer(request: CustomerSearchRequest):
    """Search for existing customer by mobile number."""
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    try:
        headers = get_eko_headers()
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{request.mobile}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=headers)
            result = response.json()
        
        logging.info(f"[DMT] Customer search: {request.mobile} -> {result.get('response_status_id')}")
        
        # Response codes: 0 = success, others = error
        if result.get("response_status_id") == 0:
            return {
                "success": True,
                "customer_exists": True,
                "customer": result.get("data", {}),
                "message": "Customer found"
            }
        elif result.get("response_status_id") == 462:
            # Customer not registered
            return {
                "success": True,
                "customer_exists": False,
                "message": "Customer not registered. Please register first."
            }
        else:
            return {
                "success": False,
                "customer_exists": False,
                "message": result.get("message", "Customer search failed"),
                "error_code": result.get("response_status_id")
            }
            
    except Exception as e:
        logging.error(f"[DMT] Customer search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@router.post("/customer/register")
async def register_customer(request: CustomerRegisterRequest):
    """Register new customer for DMT."""
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    try:
        headers = get_eko_headers()
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{request.mobile}?initiator_id={EKO_INITIATOR_ID}"
        
        data = {
            "name": request.name,
            "user_code": EKO_USER_CODE
        }
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.put(url, headers=headers, data=data)
            result = response.json()
        
        logging.info(f"[DMT] Customer register: {request.mobile} -> {result.get('response_status_id')}")
        
        # Store customer locally
        await db.dmt_customers.update_one(
            {"mobile": request.mobile},
            {
                "$set": {
                    "name": request.name,
                    "user_id": request.user_id,
                    "eko_response": result,
                    "status": "pending_otp" if result.get("response_status_id") == 0 else "failed",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )
        
        if result.get("response_status_id") == 0:
            return {
                "success": True,
                "message": "OTP sent to customer mobile",
                "otp_required": True,
                "data": result.get("data", {})
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "Registration failed"),
                "error_code": result.get("response_status_id")
            }
            
    except Exception as e:
        logging.error(f"[DMT] Customer register error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/customer/verify-otp")
async def verify_customer_otp(request: OTPVerifyRequest):
    """Verify OTP for customer registration."""
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    try:
        headers = get_eko_headers()
        url = f"{EKO_BASE_URL}/v1/customers/verification/otp:{request.otp}?initiator_id={EKO_INITIATOR_ID}&id_type=mobile_number&id={request.mobile}&user_code={EKO_USER_CODE}"
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.put(url, headers=headers)
            result = response.json()
        
        logging.info(f"[DMT] OTP verify: {request.mobile} -> {result.get('response_status_id')}")
        
        if result.get("response_status_id") == 0:
            # Update local record
            await db.dmt_customers.update_one(
                {"mobile": request.mobile},
                {"$set": {"status": "verified", "verified_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            return {
                "success": True,
                "message": "Customer verified successfully",
                "customer": result.get("data", {})
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "OTP verification failed"),
                "error_code": result.get("response_status_id")
            }
            
    except Exception as e:
        logging.error(f"[DMT] OTP verify error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OTP verification failed: {str(e)}")

@router.post("/customer/resend-otp")
async def resend_customer_otp(request: CustomerSearchRequest):
    """Resend OTP for customer registration."""
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    try:
        headers = get_eko_headers()
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{request.mobile}/otp?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=headers)
            result = response.json()
        
        logging.info(f"[DMT] Resend OTP: {request.mobile} -> {result.get('response_status_id')}")
        
        if result.get("response_status_id") == 0:
            return {
                "success": True,
                "message": "OTP resent successfully"
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "Failed to resend OTP"),
                "error_code": result.get("response_status_id")
            }
            
    except Exception as e:
        logging.error(f"[DMT] Resend OTP error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to resend OTP: {str(e)}")

# ==================== RECIPIENT (BENEFICIARY) MANAGEMENT ====================

@router.post("/recipient/add")
async def add_recipient(request: RecipientAddRequest):
    """Add new recipient (beneficiary) for a customer."""
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    try:
        headers = get_eko_headers()
        # V1 endpoint for adding recipient
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{request.mobile}/recipients?initiator_id={EKO_INITIATOR_ID}"
        
        data = {
            "recipient_name": request.recipient_name,
            "recipient_mobile": request.mobile,  # Can be same as customer
            "recipient_type": "3",  # Bank account
            "bank_ifsc": request.ifsc,
            "acc": request.account_number,
            "user_code": EKO_USER_CODE
        }
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.put(url, headers=headers, data=data)
            result = response.json()
        
        logging.info(f"[DMT] Add recipient: {request.account_number} -> {result.get('response_status_id')}")
        
        if result.get("response_status_id") == 0:
            recipient_data = result.get("data", {})
            recipient_id = recipient_data.get("recipient_id") or recipient_data.get("recipient_id_type")
            
            # Store recipient locally
            await db.dmt_recipients.update_one(
                {"customer_mobile": request.mobile, "account_number": request.account_number},
                {
                    "$set": {
                        "recipient_id": recipient_id,
                        "recipient_name": request.recipient_name,
                        "ifsc": request.ifsc,
                        "bank_name": request.bank_name or recipient_data.get("bank", ""),
                        "user_id": request.user_id,
                        "status": "active",
                        "eko_data": recipient_data,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}
                },
                upsert=True
            )
            
            return {
                "success": True,
                "message": "Recipient added successfully",
                "recipient_id": recipient_id,
                "data": recipient_data
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "Failed to add recipient"),
                "error_code": result.get("response_status_id")
            }
            
    except Exception as e:
        logging.error(f"[DMT] Add recipient error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add recipient: {str(e)}")

@router.get("/recipients/{mobile}")
async def get_recipients(mobile: str):
    """Get list of recipients for a customer."""
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    try:
        headers = get_eko_headers()
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{mobile}/recipients?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=headers)
            result = response.json()
        
        logging.info(f"[DMT] Get recipients: {mobile} -> {result.get('response_status_id')}")
        
        if result.get("response_status_id") == 0:
            recipients = result.get("data", {}).get("recipient_list", [])
            return {
                "success": True,
                "recipients": recipients,
                "count": len(recipients)
            }
        else:
            # Also check local DB
            local_recipients = await db.dmt_recipients.find(
                {"customer_mobile": mobile, "status": "active"},
                {"_id": 0}
            ).to_list(50)
            
            return {
                "success": True,
                "recipients": local_recipients,
                "count": len(local_recipients),
                "source": "local"
            }
            
    except Exception as e:
        logging.error(f"[DMT] Get recipients error: {str(e)}")
        # Fallback to local
        local_recipients = await db.dmt_recipients.find(
            {"customer_mobile": mobile, "status": "active"},
            {"_id": 0}
        ).to_list(50)
        
        return {
            "success": True,
            "recipients": local_recipients,
            "count": len(local_recipients),
            "source": "local_fallback"
        }

# ==================== MONEY TRANSFER ====================

@router.post("/transfer")
async def initiate_transfer(request: TransferRequest):
    """Initiate money transfer to recipient."""
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    # Validate amount
    if request.amount < DMT_MIN_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Minimum transfer amount is ₹{DMT_MIN_AMOUNT}")
    
    if request.amount > DMT_PER_TXN_LIMIT:
        raise HTTPException(status_code=400, detail=f"Maximum transfer amount is ₹{DMT_PER_TXN_LIMIT}")
    
    # Check user balance
    user = await db.users.find_one({"uid": request.user_id}, {"_id": 0, "prc_balance": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    charges = calculate_charges(request.amount)
    
    if user.get("prc_balance", 0) < charges["total_prc"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient PRC balance. Required: {charges['total_prc']}, Available: {user.get('prc_balance', 0)}"
        )
    
    # Check daily limit
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    daily_transfers = await db.dmt_transactions.aggregate([
        {
            "$match": {
                "user_id": request.user_id,
                "status": "success",
                "created_at": {"$gte": today.isoformat()}
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    daily_used = daily_transfers[0]["total"] if daily_transfers else 0
    
    if daily_used + request.amount > DMT_DAILY_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Daily limit exceeded. Used: ₹{daily_used}, Limit: ₹{DMT_DAILY_LIMIT}"
        )
    
    # Generate transaction ID
    txn_id = f"DMT{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc)
    
    # Deduct PRC using WalletService
    debit_result = WalletService.debit(
        user_id=request.user_id,
        amount=charges["total_prc"],
        txn_type="dmt_transfer",
        description=f"DMT Transfer: ₹{request.amount} to {request.recipient_id}",
        reference=txn_id
    )
    
    if not debit_result.get("success"):
        raise HTTPException(status_code=400, detail=debit_result.get("error", "Failed to deduct PRC"))
    
    # Create transaction record
    transaction = {
        "txn_id": txn_id,
        "user_id": request.user_id,
        "customer_mobile": request.mobile,
        "recipient_id": request.recipient_id,
        "amount": request.amount,
        "charges": charges,
        "total_deducted": charges["total_prc"],
        "status": "pending",
        "remarks": request.remarks,
        "created_at": now.isoformat()
    }
    
    await db.dmt_transactions.insert_one(transaction)
    
    try:
        # Call Eko API for transfer
        headers = get_eko_headers()
        timestamp = str(int(now.timestamp() * 1000))
        
        # Generate request hash
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{request.mobile}/recipients/recipient_id:{request.recipient_id}/transfer?initiator_id={EKO_INITIATOR_ID}"
        
        data = {
            "amount": str(int(request.amount)),
            "client_ref_id": txn_id,
            "channel": "2",  # IMPS
            "user_code": EKO_USER_CODE,
            "latlong": "28.6139,77.2090"  # Delhi coordinates
        }
        
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            response = await client.post(url, headers=headers, data=data)
            result = response.json()
        
        logging.info(f"[DMT] Transfer: {txn_id} -> {result.get('response_status_id')}")
        
        if result.get("response_status_id") == 0:
            # Success
            eko_data = result.get("data", {})
            
            await db.dmt_transactions.update_one(
                {"txn_id": txn_id},
                {
                    "$set": {
                        "status": "success",
                        "eko_txn_id": eko_data.get("tid"),
                        "eko_data": eko_data,
                        "completed_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Transfer successful",
                "txn_id": txn_id,
                "eko_txn_id": eko_data.get("tid"),
                "amount": request.amount,
                "charges": charges,
                "new_balance": debit_result.get("balance_after")
            }
        else:
            # Failed - Refund PRC
            refund_result = WalletService.credit(
                user_id=request.user_id,
                amount=charges["total_prc"],
                txn_type="dmt_refund",
                description=f"DMT Transfer Failed: {result.get('message', 'Unknown error')}",
                reference=txn_id
            )
            
            await db.dmt_transactions.update_one(
                {"txn_id": txn_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": result.get("message"),
                        "error_code": result.get("response_status_id"),
                        "refunded": True,
                        "refund_txn": refund_result.get("txn_id"),
                        "failed_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            return {
                "success": False,
                "message": result.get("message", "Transfer failed"),
                "txn_id": txn_id,
                "error_code": result.get("response_status_id"),
                "refunded": True,
                "new_balance": refund_result.get("balance_after") if refund_result.get("success") else None
            }
            
    except Exception as e:
        logging.error(f"[DMT] Transfer error: {str(e)}")
        
        # Refund on error
        refund_result = WalletService.credit(
            user_id=request.user_id,
            amount=charges["total_prc"],
            txn_type="dmt_refund",
            description=f"DMT Transfer Error: {str(e)[:50]}",
            reference=txn_id
        )
        
        await db.dmt_transactions.update_one(
            {"txn_id": txn_id},
            {
                "$set": {
                    "status": "failed",
                    "error": str(e),
                    "refunded": True,
                    "refund_txn": refund_result.get("txn_id"),
                    "failed_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")

@router.get("/status/{txn_id}")
async def get_transfer_status(txn_id: str):
    """Get transfer status by transaction ID."""
    transaction = await db.dmt_transactions.find_one({"txn_id": txn_id}, {"_id": 0})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return {
        "success": True,
        "transaction": transaction
    }

@router.get("/transactions/{user_id}")
async def get_user_transactions(user_id: str, limit: int = 20, skip: int = 0):
    """Get user's DMT transaction history."""
    transactions = await db.dmt_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.dmt_transactions.count_documents({"user_id": user_id})
    
    return {
        "success": True,
        "transactions": transactions,
        "total": total,
        "page": skip // limit + 1,
        "limit": limit
    }

# ==================== ADMIN ROUTES ====================

@router.get("/admin/settings")
async def get_dmt_settings():
    """Get DMT service settings."""
    return {
        "success": True,
        "settings": {
            "enabled": DMT_ENABLED,
            "daily_limit": DMT_DAILY_LIMIT,
            "per_txn_limit": DMT_PER_TXN_LIMIT,
            "min_amount": DMT_MIN_AMOUNT,
            "commission_rate": DMT_COMMISSION_RATE
        }
    }

@router.post("/admin/enable")
async def enable_dmt():
    """Enable DMT service."""
    global DMT_ENABLED
    DMT_ENABLED = True
    return {"success": True, "message": "DMT service enabled"}

@router.post("/admin/disable")
async def disable_dmt():
    """Disable DMT service."""
    global DMT_ENABLED
    DMT_ENABLED = False
    return {"success": True, "message": "DMT service disabled"}

@router.post("/admin/set-limit")
async def set_dmt_limit(request: Request):
    """Set DMT daily limit."""
    global DMT_DAILY_LIMIT
    data = await request.json()
    new_limit = data.get("limit", DMT_DAILY_LIMIT)
    DMT_DAILY_LIMIT = new_limit
    return {"success": True, "message": f"Daily limit set to ₹{new_limit}"}

@router.get("/admin/transactions")
async def get_all_transactions(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all DMT transactions (admin)."""
    query = {}
    if status:
        query["status"] = status
    
    transactions = await db.dmt_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.dmt_transactions.count_documents(query)
    
    return {
        "success": True,
        "transactions": transactions,
        "total": total
    }

@router.get("/admin/stats")
async def get_dmt_stats():
    """Get DMT statistics."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Today's stats
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today.isoformat()}}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "amount": {"$sum": "$amount"}
        }}
    ]
    today_stats = await db.dmt_transactions.aggregate(today_pipeline).to_list(10)
    
    # Total stats
    total_pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "amount": {"$sum": "$amount"}
        }}
    ]
    total_stats = await db.dmt_transactions.aggregate(total_pipeline).to_list(10)
    
    def format_stats(stats_list):
        result = {"success": 0, "failed": 0, "pending": 0}
        for s in stats_list:
            if s["_id"] in result:
                result[s["_id"]] = {"count": s["count"], "amount": s["amount"]}
        return result
    
    return {
        "success": True,
        "today": format_stats(today_stats),
        "total": format_stats(total_stats),
        "service_enabled": DMT_ENABLED
    }
