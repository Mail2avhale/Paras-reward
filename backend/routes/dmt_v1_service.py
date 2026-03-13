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

# ==================== EKO CONFIGURATION ====================

# Base URL for Eko API V1 (V3 NOT ACTIVATED for this account)
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")

# Credentials
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
        # Call Eko V1 API for transfer (V3 NOT ACTIVATED - using V1 only)
        headers = get_eko_headers()
        
        # V1 Fund Transfer API - Direct POST to transfer endpoint
        # URL format: /v1/customers/mobile_number:{mobile}/recipients/recipient_id:{recipient_id}/transfer
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{request.mobile}/recipients/recipient_id:{request.recipient_id}/transfer?initiator_id={EKO_INITIATOR_ID}"
        
        # V1 Transfer request body - x-www-form-urlencoded format
        # Required params as per Eko V1 docs
        data = {
            "amount": str(int(request.amount)),
            "client_ref_id": txn_id[:20],  # Max 20 chars, unique reference
            "channel": "2",  # 2 = IMPS
            "user_code": EKO_USER_CODE,
            "latlong": "28.6139,77.2090"  # Mandatory lat-long
        }
        
        logging.info(f"[DMT V1] Transfer Request: {txn_id}")
        logging.info(f"[DMT V1] URL: {url}")
        logging.info(f"[DMT V1] Data: {data}")
        logging.info(f"[DMT V1] Headers: developer_key={EKO_DEVELOPER_KEY[:10]}..., timestamp={headers.get('secret-key-timestamp')}")
        
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            response = await client.post(url, headers=headers, data=data)
            
            logging.info(f"[DMT V1] Response Status: {response.status_code}")
            logging.info(f"[DMT V1] Response Body: {response.text[:500] if response.text else 'EMPTY'}")
            
            # Handle 204 No Content - Usually means service not activated or wrong endpoint
            if response.status_code == 204 or not response.text:
                logging.error(f"[DMT V1] Got 204/Empty response - Service may not be activated")
                raise Exception("Eko API returned empty response (204). DMT service may not be activated for this account. Please contact Eko support.")
            
            # Handle 500 Internal Server Error
            if response.status_code == 500:
                logging.error(f"[DMT V1] Got 500 Internal Server Error")
                raise Exception("Eko API returned 500 Internal Server Error. Please contact Eko support.")
            
            result = response.json()
        
        logging.info(f"[DMT V1] Transfer Response: {txn_id} -> status_id={result.get('response_status_id')}, message={result.get('message')}")
        
        if result.get("response_status_id") == 0:
            # Success
            eko_data = result.get("data", {})
            
            # Extract UTR/Bank Reference Number
            utr_number = eko_data.get("bank_ref_num") or eko_data.get("utr") or eko_data.get("txstatus_desc")
            
            await db.dmt_transactions.update_one(
                {"txn_id": txn_id},
                {
                    "$set": {
                        "status": "success",
                        "eko_txn_id": eko_data.get("tid"),
                        "utr_number": utr_number,
                        "eko_data": eko_data,
                        "completed_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Transfer successful! Money sent via IMPS.",
                "txn_id": txn_id,
                "eko_txn_id": eko_data.get("tid"),
                "utr_number": utr_number,
                "amount": request.amount,
                "charges": charges,
                "recipient_id": request.recipient_id,
                "customer_mobile": request.mobile,
                "new_balance": debit_result.get("balance_after"),
                "transfer_mode": "IMPS"
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
        logging.error(f"[DMT V1] Transfer error for {txn_id}: {str(e)}")
        
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


@router.get("/status/check/{txn_id}")
async def check_status_from_eko(txn_id: str, user_id: str):
    """
    Check transaction status directly from Eko API.
    Useful for pending transactions or status verification.
    """
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    # Get local transaction
    transaction = await db.dmt_transactions.find_one({"txn_id": txn_id})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    eko_txn_id = transaction.get("eko_txn_id")
    
    if not eko_txn_id:
        return {
            "success": True,
            "status": transaction.get("status"),
            "message": "Transaction did not reach Eko (failed before API call)",
            "local_data": {
                "txn_id": txn_id,
                "status": transaction.get("status"),
                "error": transaction.get("error")
            }
        }
    
    try:
        headers = get_eko_headers()
        url = f"{EKO_BASE_URL}/v1/transactions/{eko_txn_id}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=headers)
            result = response.json()
        
        logging.info(f"[DMT] Status check {txn_id}: {result.get('response_status_id')}")
        
        if result.get("response_status_id") == 0:
            eko_data = result.get("data", {})
            eko_status = eko_data.get("tx_status")
            
            # Map Eko status to our status
            status_map = {
                0: "success",
                1: "failed", 
                2: "pending",
                3: "refund_pending"
            }
            new_status = status_map.get(eko_status, "unknown")
            
            # Update local record
            update_data = {
                "eko_status_check": result,
                "eko_tx_status": eko_status,
                "status_checked_at": datetime.now(timezone.utc).isoformat()
            }
            
            # If status changed to success, update
            if new_status == "success" and transaction.get("status") != "success":
                update_data["status"] = "success"
                update_data["utr_number"] = eko_data.get("bank_ref_num") or eko_data.get("utr")
                update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            
            # If failed and not refunded, process refund
            if new_status == "failed" and not transaction.get("refunded"):
                update_data["status"] = "failed"
                
                # Auto refund PRC
                refund_result = WalletService.credit(
                    user_id=transaction.get("user_id"),
                    amount=transaction.get("total_deducted", 0),
                    txn_type="dmt_status_refund",
                    description=f"DMT Failed (status check): {txn_id}",
                    reference=txn_id
                )
                update_data["refunded"] = True
                update_data["refund_txn"] = refund_result.get("txn_id")
            
            await db.dmt_transactions.update_one(
                {"txn_id": txn_id},
                {"$set": update_data}
            )
            
            return {
                "success": True,
                "eko_status": eko_status,
                "status": new_status,
                "utr_number": eko_data.get("bank_ref_num") or eko_data.get("utr"),
                "eko_data": eko_data
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "Failed to get status"),
                "error_code": result.get("response_status_id")
            }
            
    except Exception as e:
        logging.error(f"[DMT] Status check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@router.get("/banks")
async def get_bank_list():
    """Get list of supported banks for DMT."""
    banks = [
        {"code": "SBIN", "name": "State Bank of India"},
        {"code": "HDFC", "name": "HDFC Bank"},
        {"code": "ICIC", "name": "ICICI Bank"},
        {"code": "AXIS", "name": "Axis Bank"},
        {"code": "PUNB", "name": "Punjab National Bank"},
        {"code": "BARB", "name": "Bank of Baroda"},
        {"code": "CNRB", "name": "Canara Bank"},
        {"code": "UBIN", "name": "Union Bank of India"},
        {"code": "IDFB", "name": "IDFC First Bank"},
        {"code": "KKBK", "name": "Kotak Mahindra Bank"},
        {"code": "YESB", "name": "Yes Bank"},
        {"code": "INDB", "name": "IndusInd Bank"},
        {"code": "MAHB", "name": "Bank of Maharashtra"},
        {"code": "CBIN", "name": "Central Bank of India"},
        {"code": "BKID", "name": "Bank of India"},
        {"code": "IOBA", "name": "Indian Overseas Bank"},
        {"code": "IDIB", "name": "Indian Bank"},
        {"code": "PSIB", "name": "Punjab & Sind Bank"},
        {"code": "UCBA", "name": "UCO Bank"},
    ]
    
    return {
        "success": True,
        "banks": banks,
        "count": len(banks)
    }


@router.get("/ifsc/{ifsc_code}")
async def validate_ifsc(ifsc_code: str):
    """Validate IFSC code and get bank/branch details."""
    if not ifsc_code or len(ifsc_code) != 11:
        return {
            "success": False,
            "valid": False,
            "message": "IFSC code must be 11 characters"
        }
    
    bank_code = ifsc_code[:4].upper()
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"https://ifsc.razorpay.com/{ifsc_code.upper()}")
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "valid": True,
                    "ifsc": ifsc_code.upper(),
                    "bank": data.get("BANK"),
                    "branch": data.get("BRANCH"),
                    "address": data.get("ADDRESS"),
                    "city": data.get("CITY"),
                    "state": data.get("STATE")
                }
            else:
                return {
                    "success": True,
                    "valid": False,
                    "message": "Invalid IFSC code"
                }
    except Exception as e:
        logging.warning(f"IFSC validation failed: {str(e)}")
        return {
            "success": True,
            "valid": True,
            "ifsc": ifsc_code.upper(),
            "bank_code": bank_code,
            "message": "IFSC format valid (external validation unavailable)"
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


# ==================== REFUND APIs (Eko V1) ====================

class RefundOTPRequest(BaseModel):
    eko_txn_id: str  # Eko transaction ID (tid from transfer response)
    user_id: str

class RefundRequest(BaseModel):
    eko_txn_id: str  # Eko transaction ID
    otp: str  # OTP received by customer
    user_id: str

@router.post("/refund/resend-otp")
async def resend_refund_otp(request: RefundOTPRequest):
    """
    Resend OTP to customer for refund process.
    
    When a DMT transaction fails, Eko automatically sends an OTP to customer.
    Use this API to resend that OTP if customer didn't receive it.
    
    Eko API: POST /transactions/:id/refund/otp
    """
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    try:
        headers = get_eko_headers()
        url = f"{EKO_BASE_URL}/v1/transactions/{request.eko_txn_id}/refund/otp?initiator_id={EKO_INITIATOR_ID}"
        
        data = {
            "user_code": EKO_USER_CODE
        }
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=headers, data=data)
            result = response.json()
        
        logging.info(f"[DMT REFUND] Resend OTP for txn {request.eko_txn_id}: {result.get('response_status_id')}")
        
        # Update local transaction record
        await db.dmt_transactions.update_one(
            {"eko_txn_id": request.eko_txn_id},
            {
                "$set": {
                    "refund_otp_sent": True,
                    "refund_otp_sent_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {
                    "refund_history": {
                        "action": "otp_resent",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "eko_response": result
                    }
                }
            }
        )
        
        if result.get("response_status_id") == 0:
            return {
                "success": True,
                "message": "Refund OTP sent to customer mobile",
                "eko_txn_id": request.eko_txn_id,
                "data": result.get("data", {})
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "Failed to resend OTP"),
                "error_code": result.get("response_status_id"),
                "eko_txn_id": request.eko_txn_id
            }
            
    except Exception as e:
        logging.error(f"[DMT REFUND] Resend OTP error for {request.eko_txn_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to resend OTP: {str(e)}")


@router.post("/refund/process")
async def process_refund(request: RefundRequest):
    """
    Process refund for a failed DMT transaction.
    
    This API is used to safely refund cash to customer when transaction fails:
    1. When transaction fails, Eko automatically sends OTP to customer
    2. Ask customer for that OTP
    3. Call this API with the OTP as consent that cash was refunded
    4. After this, Eko will refund eValue to your account
    
    Eko API: POST /transactions/:id/refund
    """
    if not DMT_ENABLED:
        raise HTTPException(status_code=503, detail="DMT service is currently disabled")
    
    # Get local transaction record
    local_txn = await db.dmt_transactions.find_one({"eko_txn_id": request.eko_txn_id})
    
    if not local_txn:
        # Try to find by our txn_id
        local_txn = await db.dmt_transactions.find_one({"txn_id": request.eko_txn_id})
    
    try:
        headers = get_eko_headers()
        url = f"{EKO_BASE_URL}/v1/transactions/{request.eko_txn_id}/refund?initiator_id={EKO_INITIATOR_ID}"
        
        data = {
            "otp": request.otp,
            "user_code": EKO_USER_CODE
        }
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=headers, data=data)
            result = response.json()
        
        logging.info(f"[DMT REFUND] Process refund for txn {request.eko_txn_id}: {result.get('response_status_id')}")
        
        now = datetime.now(timezone.utc)
        
        if result.get("response_status_id") == 0:
            # Refund successful - update local record
            refund_data = result.get("data", {})
            
            update_data = {
                "refund_status": "success",
                "refund_completed_at": now.isoformat(),
                "eko_refund_response": result,
                "refund_amount": refund_data.get("amount") or (local_txn.get("amount") if local_txn else 0)
            }
            
            if local_txn:
                await db.dmt_transactions.update_one(
                    {"_id": local_txn["_id"]},
                    {
                        "$set": update_data,
                        "$push": {
                            "refund_history": {
                                "action": "refund_completed",
                                "timestamp": now.isoformat(),
                                "eko_response": result
                            }
                        }
                    }
                )
                
                # Credit PRC back to user if not already done
                if not local_txn.get("prc_refunded"):
                    refund_amount = local_txn.get("total_deducted", 0)
                    if refund_amount > 0:
                        credit_result = WalletService.credit(
                            user_id=local_txn.get("user_id") or request.user_id,
                            amount=refund_amount,
                            txn_type="eko_refund",
                            description=f"Eko Refund: Transaction {request.eko_txn_id}",
                            reference=f"REFUND-{request.eko_txn_id}"
                        )
                        
                        await db.dmt_transactions.update_one(
                            {"_id": local_txn["_id"]},
                            {
                                "$set": {
                                    "prc_refunded": True,
                                    "prc_refund_txn": credit_result.get("txn_id")
                                }
                            }
                        )
                        
                        logging.info(f"[DMT REFUND] PRC credited: {refund_amount} to {local_txn.get('user_id')}")
            
            return {
                "success": True,
                "message": "Refund processed successfully",
                "eko_txn_id": request.eko_txn_id,
                "refund_amount": refund_data.get("amount"),
                "data": refund_data
            }
        else:
            # Refund failed
            if local_txn:
                await db.dmt_transactions.update_one(
                    {"_id": local_txn["_id"]},
                    {
                        "$set": {
                            "refund_status": "failed",
                            "refund_error": result.get("message")
                        },
                        "$push": {
                            "refund_history": {
                                "action": "refund_failed",
                                "timestamp": now.isoformat(),
                                "error": result.get("message"),
                                "eko_response": result
                            }
                        }
                    }
                )
            
            return {
                "success": False,
                "message": result.get("message", "Refund failed"),
                "error_code": result.get("response_status_id"),
                "eko_txn_id": request.eko_txn_id
            }
            
    except Exception as e:
        logging.error(f"[DMT REFUND] Process refund error for {request.eko_txn_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")


@router.get("/refund/pending")
async def get_pending_refunds(user_id: Optional[str] = None, limit: int = 50):
    """
    Get list of transactions eligible for refund.
    
    Returns failed transactions that haven't been refunded yet.
    """
    query = {
        "status": "failed",
        "$or": [
            {"refund_status": {"$exists": False}},
            {"refund_status": {"$nin": ["success", "completed"]}}
        ]
    }
    
    if user_id:
        query["user_id"] = user_id
    
    transactions = await db.dmt_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "pending_refunds": transactions,
        "count": len(transactions)
    }


@router.get("/refund/history/{eko_txn_id}")
async def get_refund_history(eko_txn_id: str):
    """Get refund history for a specific transaction."""
    
    transaction = await db.dmt_transactions.find_one(
        {"$or": [{"eko_txn_id": eko_txn_id}, {"txn_id": eko_txn_id}]},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return {
        "success": True,
        "transaction": transaction,
        "refund_history": transaction.get("refund_history", []),
        "refund_status": transaction.get("refund_status", "not_initiated")
    }

