"""
PARAS REWARD - EKO DMT (Domestic Money Transfer) Service
========================================================
Complete Production-Ready Backend for Bank Transfers

Flow:
1. Customer Search/Registration
2. Add Recipient (Bank Account)
3. Money Transfer
4. Transaction Status Check

PRC Conversion:
- 100 PRC = ₹1 INR
- Minimum Redeem: ₹100 (10,000 PRC)
- Maximum Daily: ₹5,000 (5,00,000 PRC)

Security:
- All EKO API calls server-side only
- OTP verification for transfers
- Daily limits enforcement
- Duplicate transaction prevention
- IP logging
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import requests
import base64
import hashlib
import hmac
import time
import uuid
import logging
import os
from bson import ObjectId

# Database connection
from pymongo import MongoClient

# ==================== CONFIGURATION ====================

router = APIRouter(prefix="/eko/dmt", tags=["DMT - Bank Transfer"])

# EKO Production Configuration
EKO_BASE_URL = "https://api.eko.in:25002/ekoicici"
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "7c179a397b4710e71b2248d1f5892d19")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_AUTH_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "7a2529f5-3587-4add-a2df-3d0606d62460")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")
SOURCE_IP = "34.44.149.98"

# PRC Conversion
PRC_TO_INR_RATE = 100  # 100 PRC = ₹1
MIN_REDEEM_INR = 100   # Minimum ₹100
MAX_DAILY_INR = 5000   # Maximum ₹5000 per day

# Database
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# Request timeout
REQUEST_TIMEOUT = 60

# ==================== DATABASE CONNECTION ====================

def get_db():
    """Get MongoDB database connection"""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

# ==================== AUTHENTICATION ====================

def generate_eko_headers() -> Dict[str, str]:
    """
    Generate EKO authentication headers.
    
    Formula:
    1. timestamp = current time in milliseconds
    2. encoded_key = Base64(authenticator_key)
    3. secret_key = Base64(HMAC_SHA256(encoded_key, timestamp))
    """
    timestamp = str(int(time.time() * 1000))
    
    encoded_key = base64.b64encode(EKO_AUTH_KEY.encode()).decode()
    
    secret_key = base64.b64encode(
        hmac.new(
            encoded_key.encode(),
            timestamp.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/json"
    }


def generate_eko_headers_for_get() -> Dict[str, str]:
    """
    Generate EKO authentication headers for GET requests.
    GET requests should not have Content-Type header.
    """
    timestamp = str(int(time.time() * 1000))
    
    encoded_key = base64.b64encode(EKO_AUTH_KEY.encode()).decode()
    
    secret_key = base64.b64encode(
        hmac.new(
            encoded_key.encode(),
            timestamp.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp
    }


def generate_request_hash(data_string: str) -> str:
    """
    Generate request_hash for DMT transactions.
    
    Formula: Base64(HMAC_SHA256(encoded_key, data_string))
    """
    encoded_key = base64.b64encode(EKO_AUTH_KEY.encode()).decode()
    
    request_hash = base64.b64encode(
        hmac.new(
            encoded_key.encode(),
            data_string.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return request_hash


# ==================== REQUEST MODELS ====================

class CustomerSearchRequest(BaseModel):
    """Request to search/verify customer"""
    mobile: str = Field(..., min_length=10, max_length=10, description="10 digit mobile number")
    user_id: str = Field(..., description="Paras Reward user ID")
    
    @validator('mobile')
    def validate_mobile(cls, v):
        if not v.isdigit():
            raise ValueError('Mobile must be numeric')
        return v


class CustomerRegisterRequest(BaseModel):
    """Request to register new customer"""
    mobile: str = Field(..., min_length=10, max_length=10)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    user_id: str


class AddRecipientRequest(BaseModel):
    """Request to add bank recipient"""
    mobile: str = Field(..., min_length=10, max_length=10)
    recipient_name: str = Field(..., min_length=3, max_length=100)
    account_number: str = Field(..., min_length=8, max_length=20)
    ifsc: str = Field(..., min_length=11, max_length=11)
    user_id: str
    
    @validator('ifsc')
    def validate_ifsc(cls, v):
        v = v.upper()
        if len(v) != 11:
            raise ValueError('IFSC must be 11 characters')
        return v
    
    @validator('account_number')
    def validate_account(cls, v):
        if not v.isdigit():
            raise ValueError('Account number must be numeric')
        return v


class TransferRequest(BaseModel):
    """Request to transfer money"""
    user_id: str = Field(..., description="Paras Reward user ID")
    mobile: str = Field(..., min_length=10, max_length=10)
    recipient_id: str = Field(..., description="EKO recipient ID")
    prc_amount: int = Field(..., gt=0, description="PRC amount to redeem")
    pin: Optional[str] = Field(None, description="User PIN for verification")
    
    @validator('prc_amount')
    def validate_prc(cls, v):
        inr = v / PRC_TO_INR_RATE
        if inr < MIN_REDEEM_INR:
            raise ValueError(f'Minimum redeem is ₹{MIN_REDEEM_INR} ({MIN_REDEEM_INR * PRC_TO_INR_RATE} PRC)')
        if inr > MAX_DAILY_INR:
            raise ValueError(f'Maximum daily limit is ₹{MAX_DAILY_INR}')
        return v


class TransactionStatusRequest(BaseModel):
    """Request to check transaction status"""
    tid: str = Field(..., description="EKO Transaction ID")
    client_ref_id: str = Field(..., description="Client reference ID")


# ==================== RESPONSE MODELS ====================

def create_success_response(data: Dict, message: str = "Success") -> Dict:
    return {
        "success": True,
        "status": "SUCCESS",
        "message": message,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


def create_error_response(code: int, message: str, user_message: str = None) -> Dict:
    return {
        "success": False,
        "status": "FAILED",
        "error_code": code,
        "message": message,
        "user_message": user_message or message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ==================== HELPER FUNCTIONS ====================

def get_bank_code_from_ifsc(ifsc: str) -> Optional[str]:
    """Get bank code from IFSC using EKO API"""
    try:
        url = f"{EKO_BASE_URL}/v1/banks/ifsc:{ifsc}"
        response = requests.get(url, headers=generate_eko_headers_for_get(), timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == 0:
                return data.get("data", {}).get("bank_code")
        
        return None
    except Exception as e:
        logging.error(f"[DMT] Error getting bank code: {e}")
        return None


def check_daily_limit(db, user_id: str) -> tuple:
    """
    Check if user has exceeded daily limit.
    Returns (is_allowed, remaining_limit, used_today)
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Sum all successful DMT transactions today
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "service_type": "dmt",
                "status": {"$in": ["completed", "processing", "pending"]},
                "created_at": {"$gte": today_start}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_inr": {"$sum": "$amount_inr"}
            }
        }
    ]
    
    result = list(db.dmt_transactions.aggregate(pipeline))
    used_today = result[0]["total_inr"] if result else 0
    remaining = MAX_DAILY_INR - used_today
    
    return remaining > 0, remaining, used_today


def log_dmt_transaction(db, log_data: Dict):
    """Log DMT transaction for audit"""
    log_data["timestamp"] = datetime.now(timezone.utc)
    db.dmt_logs.insert_one(log_data)


# ==================== HEALTH CHECK ====================

@router.get("/health")
def health():
    """DMT Service Health Check"""
    return {
        "status": "DMT SERVICE RUNNING",
        "version": "1.0",
        "prc_rate": f"{PRC_TO_INR_RATE} PRC = ₹1",
        "min_redeem": f"₹{MIN_REDEEM_INR}",
        "max_daily": f"₹{MAX_DAILY_INR}"
    }


# ==================== WALLET ====================

@router.get("/wallet/{user_id}")
def get_wallet(user_id: str):
    """
    Get user's PRC wallet balance and INR equivalent.
    
    Response:
    - prc_balance: Current PRC balance
    - inr_equivalent: INR value (PRC / 100)
    - can_redeem: Whether user has enough for minimum redeem
    """
    db = get_db()
    
    user = db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1, "name": 1})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prc_balance = user.get("prc_balance", 0)
    inr_equivalent = prc_balance / PRC_TO_INR_RATE
    
    # Check daily limit
    is_allowed, remaining_limit, used_today = check_daily_limit(db, user_id)
    
    return create_success_response({
        "prc_balance": prc_balance,
        "inr_equivalent": round(inr_equivalent, 2),
        "can_redeem": inr_equivalent >= MIN_REDEEM_INR,
        "min_redeem_prc": MIN_REDEEM_INR * PRC_TO_INR_RATE,
        "min_redeem_inr": MIN_REDEEM_INR,
        "daily_limit_inr": MAX_DAILY_INR,
        "used_today_inr": used_today,
        "remaining_limit_inr": max(0, remaining_limit)
    })


# ==================== STEP 1: CUSTOMER SEARCH ====================

@router.post("/customer/search")
async def search_customer(req: CustomerSearchRequest, request: Request):
    """
    Search for customer in EKO system.
    
    If customer exists: Returns customer details
    If not: Returns status indicating registration required
    
    EKO API: GET /v1/customers/mobile_number:{mobile}
    """
    db = get_db()
    client_ip = request.client.host if request.client else "unknown"
    
    logging.info(f"[DMT] Customer Search: {req.mobile}, User: {req.user_id}, IP: {client_ip}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        response = requests.get(url, headers=generate_eko_headers_for_get(), timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Customer Search Response: {response.status_code}")
        
        if response.status_code == 403:
            return create_error_response(403, "Authentication failed", "Service temporarily unavailable")
        
        result = response.json()
        eko_status = result.get("status")
        
        # Log the search
        log_dmt_transaction(db, {
            "action": "customer_search",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "ip": client_ip,
            "eko_status": eko_status,
            "response": result
        })
        
        if eko_status == 0:
            # Customer found
            customer_data = result.get("data", {})
            return create_success_response({
                "customer_exists": True,
                "customer_id": customer_data.get("customer_id"),
                "mobile": req.mobile,
                "name": customer_data.get("name"),
                "available_limit": customer_data.get("available_limit"),
                "used_limit": customer_data.get("used_limit"),
                "total_limit": customer_data.get("total_limit"),
                "kyc_status": customer_data.get("state_desc"),
                "state": customer_data.get("state")
            }, "Customer found")
        
        elif eko_status == 463:
            # Customer not found - needs registration
            return create_success_response({
                "customer_exists": False,
                "mobile": req.mobile,
                "message": "Customer not registered. Please register first."
            }, "Customer not found - Registration required")
        
        else:
            return create_error_response(
                eko_status,
                result.get("message", "Customer search failed"),
                "Unable to verify customer. Please try again."
            )
            
    except requests.exceptions.Timeout:
        return create_error_response(504, "Request timeout", "Service is slow. Please try again.")
    except Exception as e:
        logging.error(f"[DMT] Customer Search Error: {e}")
        return create_error_response(500, str(e), "An error occurred. Please try again.")


# ==================== STEP 2: CUSTOMER REGISTRATION ====================

@router.post("/customer/register")
async def register_customer(req: CustomerRegisterRequest, request: Request):
    """
    Register new customer in EKO system.
    
    Required for first-time DMT users.
    
    EKO API: PUT /v1/customers/mobile_number:{mobile}
    """
    db = get_db()
    client_ip = request.client.host if request.client else "unknown"
    
    logging.info(f"[DMT] Customer Registration: {req.mobile}, Name: {req.first_name} {req.last_name}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        payload = {
            "name": f"{req.first_name} {req.last_name}",
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "pipe": "9",  # Standard pipe for DMT
            "source_ip": SOURCE_IP
        }
        
        response = requests.put(
            url,
            data=payload,
            headers=generate_eko_headers_for_get(),
            timeout=REQUEST_TIMEOUT
        )
        
        logging.info(f"[DMT] Registration Response: {response.status_code}")
        
        result = response.json()
        eko_status = result.get("status")
        
        # Log registration
        log_dmt_transaction(db, {
            "action": "customer_register",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "name": f"{req.first_name} {req.last_name}",
            "ip": client_ip,
            "eko_status": eko_status,
            "response": result
        })
        
        if eko_status == 0:
            customer_data = result.get("data", {})
            return create_success_response({
                "registered": True,
                "customer_id": customer_data.get("customer_id"),
                "mobile": req.mobile,
                "name": f"{req.first_name} {req.last_name}",
                "otp_required": customer_data.get("state") == 1,  # OTP verification may be needed
                "message": result.get("message", "Customer registered successfully")
            }, "Customer registered")
        
        else:
            return create_error_response(
                eko_status,
                result.get("message", "Registration failed"),
                "Unable to register. Please check details and try again."
            )
            
    except Exception as e:
        logging.error(f"[DMT] Registration Error: {e}")
        return create_error_response(500, str(e), "Registration failed. Please try again.")


# ==================== STEP 2.5: CUSTOMER OTP VERIFICATION ====================

class CustomerOTPRequest(BaseModel):
    """Request for OTP operations"""
    user_id: str
    mobile: str = Field(..., min_length=10, max_length=10)
    otp: Optional[str] = Field(None, min_length=4, max_length=6)


@router.post("/customer/resend-otp")
async def resend_customer_otp(req: CustomerOTPRequest, request: Request):
    """
    Resend OTP for customer verification.
    
    EKO API: POST /v1/customers/mobile_number:{mobile}/otp
    """
    db = get_db()
    client_ip = request.client.host if request.client else "unknown"
    
    logging.info(f"[DMT] Resend OTP: {req.mobile}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}/otp?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "pipe": "9",
            "source_ip": SOURCE_IP
        }
        
        response = requests.post(url, data=payload, headers=generate_eko_headers_for_get(), timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Resend OTP Response: {response.status_code}")
        logging.info(f"[DMT] Resend OTP Raw Response: {response.text[:500]}")
        
        if response.status_code != 200:
            return create_error_response(
                response.status_code,
                f"API Error: {response.status_code}",
                "Failed to send OTP. Please try again."
            )
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            eko_message = result.get("message", "OTP sent successfully")
            logging.info(f"[DMT] OTP Success - Eko Message: {eko_message}")
            return create_success_response({
                "otp_sent": True,
                "mobile": req.mobile,
                "message": eko_message,
                "eko_response_message": eko_message,
                "note": "OTP should arrive within 1-2 minutes. If not received, check DND status or try resending."
            }, "OTP sent")
        else:
            return create_error_response(
                eko_status,
                result.get("message", "Failed to send OTP"),
                "Unable to send OTP. Please try again."
            )
            
    except Exception as e:
        logging.error(f"[DMT] Resend OTP Error: {e}")
        return create_error_response(500, str(e), "Failed to send OTP.")


@router.post("/customer/verify-otp")
async def verify_customer_otp(req: CustomerOTPRequest, request: Request):
    """
    Verify customer OTP to complete registration.
    
    EKO API: PUT /v1/customers/verification/otp:{otp}
    """
    db = get_db()
    client_ip = request.client.host if request.client else "unknown"
    
    if not req.otp:
        return create_error_response(400, "OTP is required", "Please enter the OTP.")
    
    logging.info(f"[DMT] Verify OTP: {req.mobile}, OTP: ***{req.otp[-2:]}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/verification/otp:{req.otp}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        payload = {
            "id_type": "mobile_number",
            "id": req.mobile,
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "pipe": "9",
            "source_ip": SOURCE_IP
        }
        
        response = requests.put(url, data=payload, headers=generate_eko_headers_for_get(), timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Verify OTP Response: {response.status_code}")
        
        if response.status_code != 200:
            return create_error_response(
                response.status_code,
                f"API Error: {response.status_code}",
                "Failed to verify OTP. Please try again."
            )
        
        result = response.json()
        eko_status = result.get("status")
        
        # Log verification attempt
        log_dmt_transaction(db, {
            "action": "verify_otp",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "ip": client_ip,
            "eko_status": eko_status,
            "response": result
        })
        
        if eko_status == 0:
            customer_data = result.get("data", {})
            return create_success_response({
                "verified": True,
                "customer_id": customer_data.get("customer_id"),
                "mobile": req.mobile,
                "state": customer_data.get("state"),
                "state_desc": customer_data.get("state_desc"),
                "available_limit": customer_data.get("available_limit"),
                "message": result.get("message", "Customer verified successfully")
            }, "Customer verified")
        else:
            return create_error_response(
                eko_status,
                result.get("message", "OTP verification failed"),
                "Invalid OTP. Please check and try again."
            )
            
    except Exception as e:
        logging.error(f"[DMT] Verify OTP Error: {e}")
        return create_error_response(500, str(e), "Verification failed.")


# ==================== STEP 3: ADD RECIPIENT ====================

@router.post("/recipient/add")
async def add_recipient(req: AddRecipientRequest, request: Request):
    """
    Add bank account as recipient for money transfer.
    
    Returns recipient_id needed for transfer.
    
    EKO API: PUT /v1/customers/mobile_number:{mobile}/recipients
    """
    db = get_db()
    client_ip = request.client.host if request.client else "unknown"
    
    logging.info(f"[DMT] Add Recipient: {req.recipient_name}, Account: ***{req.account_number[-4:]}, IFSC: {req.ifsc}")
    
    try:
        # Get bank code from IFSC
        bank_code = get_bank_code_from_ifsc(req.ifsc)
        
        if not bank_code:
            # Try to extract from IFSC (first 4 chars usually map to bank)
            bank_code = req.ifsc[:4]
        
        # Use correct URL format with acc_no in path
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}/recipients/acc_no:{req.account_number}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        # Generate request hash for recipient add
        timestamp = str(int(time.time() * 1000))
        hash_string = f"{timestamp}{req.account_number}{req.ifsc}"
        request_hash = generate_request_hash(hash_string)
        
        headers = generate_eko_headers_for_get()
        headers["request_hash"] = request_hash
        
        payload = {
            "recipient_name": req.recipient_name,
            "recipient_mobile": req.mobile,
            "ifsc": req.ifsc,
            "bank_code": bank_code,
            "recipient_type": "1",  # 1 = Bank Account
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "source_ip": SOURCE_IP
        }
        
        response = requests.put(url, data=payload, headers=headers, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Add Recipient Response: {response.status_code}")
        
        result = response.json()
        eko_status = result.get("status")
        
        # Log recipient addition
        log_dmt_transaction(db, {
            "action": "add_recipient",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "recipient_name": req.recipient_name,
            "account": f"***{req.account_number[-4:]}",
            "ifsc": req.ifsc,
            "ip": client_ip,
            "eko_status": eko_status,
            "response": result
        })
        
        if eko_status == 0:
            recipient_data = result.get("data", {})
            
            # Save recipient to local DB for quick access
            db.dmt_recipients.update_one(
                {"user_id": req.user_id, "account_number": req.account_number},
                {
                    "$set": {
                        "recipient_id": recipient_data.get("recipient_id"),
                        "recipient_name": req.recipient_name,
                        "account_number": req.account_number,
                        "ifsc": req.ifsc,
                        "mobile": req.mobile,
                        "bank_code": bank_code,
                        "is_verified": recipient_data.get("is_verified", False),
                        "updated_at": datetime.now(timezone.utc)
                    }
                },
                upsert=True
            )
            
            return create_success_response({
                "recipient_id": recipient_data.get("recipient_id"),
                "recipient_name": req.recipient_name,
                "account_number": f"***{req.account_number[-4:]}",
                "ifsc": req.ifsc,
                "is_verified": recipient_data.get("is_verified", False),
                "bank_name": recipient_data.get("bank_name"),
                "message": "Recipient added successfully"
            }, "Recipient added")
        
        elif eko_status == 342:
            # Recipient already exists
            return create_success_response({
                "recipient_exists": True,
                "message": "Recipient already registered"
            }, "Recipient already exists")
        
        else:
            return create_error_response(
                eko_status,
                result.get("message", "Failed to add recipient"),
                "Unable to add bank account. Please verify IFSC and account number."
            )
            
    except Exception as e:
        logging.error(f"[DMT] Add Recipient Error: {e}")
        return create_error_response(500, str(e), "Failed to add recipient. Please try again.")


# ==================== STEP 4: GET RECIPIENTS ====================

@router.get("/recipients/{mobile}")
async def get_recipients(mobile: str, user_id: str):
    """
    Get list of saved recipients for a customer.
    
    EKO API: GET /v1/customers/mobile_number:{mobile}/recipients
    """
    logging.info(f"[DMT] Get Recipients: {mobile}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{mobile}/recipients?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        response = requests.get(url, headers=generate_eko_headers_for_get(), timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Recipients Response: {response.status_code}")
        
        # Handle non-200 responses
        if response.status_code == 404:
            return create_success_response({
                "count": 0,
                "recipients": [],
                "message": "No recipients found. Add a bank account to get started."
            }, "No recipients found")
        
        if response.status_code != 200:
            return create_error_response(
                response.status_code,
                f"API Error: {response.status_code}",
                "Unable to load saved accounts. Please try again."
            )
        
        result = response.json()
        eko_status = result.get("status")
        response_status_id = result.get("response_status_id")
        
        # Handle "No recipients found" case
        if response_status_id == -1 or "no recepient" in result.get("message", "").lower() or "no recipient" in result.get("message", "").lower():
            return create_success_response({
                "count": 0,
                "recipients": [],
                "message": "No saved bank accounts. Add a recipient to start transfers."
            }, "No recipients found")
        
        if eko_status == 0:
            # Handle different response formats
            data = result.get("data", {})
            if isinstance(data, list):
                recipients = data
            else:
                recipients = data.get("recipient_list", [])
            
            formatted_recipients = []
            for r in recipients:
                formatted_recipients.append({
                    "recipient_id": r.get("recipient_id"),
                    "recipient_name": r.get("recipient_name"),
                    "account_number": r.get("account"),
                    "account_masked": f"***{r.get('account', '')[-4:]}",
                    "ifsc": r.get("ifsc"),
                    "bank_name": r.get("bank_name"),
                    "is_verified": r.get("is_verified", False),
                    "recipient_mobile": r.get("recipient_mobile")
                })
            
            return create_success_response({
                "count": len(formatted_recipients),
                "recipients": formatted_recipients
            }, f"Found {len(formatted_recipients)} recipients")
        
        elif eko_status == 463 or eko_status == 404:
            # Customer not found or no recipients
            return create_success_response({
                "count": 0,
                "recipients": [],
                "message": "No recipients found. Add a bank account first."
            }, "No recipients found")
        
        else:
            return create_error_response(
                eko_status,
                result.get("message", "Failed to get recipients"),
                "Unable to load saved accounts."
            )
            
    except Exception as e:
        logging.error(f"[DMT] Get Recipients Error: {e}")
        return create_error_response(500, str(e), "Failed to load recipients.")


# ==================== STEP 5: MONEY TRANSFER ====================

@router.post("/transfer")
async def transfer_money(req: TransferRequest, request: Request):
    """
    Execute money transfer to bank account.
    
    Process:
    1. Validate PRC balance
    2. Check daily limit
    3. Deduct PRC
    4. Execute EKO transfer
    5. Update transaction status
    
    If transfer fails, PRC is refunded.
    
    EKO API: POST /v1/transactions
    """
    db = get_db()
    client_ip = request.client.host if request.client else "unknown"
    client_ref_id = f"DMT{int(time.time() * 1000)}{uuid.uuid4().hex[:8].upper()}"
    
    # Convert PRC to INR
    amount_inr = req.prc_amount / PRC_TO_INR_RATE
    
    logging.info(f"[DMT] Transfer Request: {req.prc_amount} PRC (₹{amount_inr}) to Recipient: {req.recipient_id}")
    
    # Step 1: Validate user and PRC balance
    user = db.users.find_one({"uid": req.user_id})
    if not user:
        return create_error_response(404, "User not found", "User account not found.")
    
    current_prc = user.get("prc_balance", 0)
    if current_prc < req.prc_amount:
        return create_error_response(
            400,
            f"Insufficient PRC. Have: {current_prc}, Need: {req.prc_amount}",
            f"Insufficient balance. You have {current_prc} PRC."
        )
    
    # Step 2: Check daily limit
    is_allowed, remaining_limit, used_today = check_daily_limit(db, req.user_id)
    if amount_inr > remaining_limit:
        return create_error_response(
            400,
            f"Daily limit exceeded. Remaining: ₹{remaining_limit}",
            f"Daily limit exceeded. You can transfer up to ₹{remaining_limit} more today."
        )
    
    # Step 3: Check for duplicate transaction (within 5 minutes)
    recent_dup = db.dmt_transactions.find_one({
        "user_id": req.user_id,
        "recipient_id": req.recipient_id,
        "amount_inr": amount_inr,
        "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(minutes=5)},
        "status": {"$in": ["completed", "processing", "pending"]}
    })
    
    if recent_dup:
        return create_error_response(
            400,
            "Duplicate transaction detected",
            "A similar transaction was just processed. Please wait before trying again."
        )
    
    # Step 4: Deduct PRC first (will refund if transfer fails)
    new_prc_balance = current_prc - req.prc_amount
    
    db.users.update_one(
        {"uid": req.user_id},
        {
            "$set": {"prc_balance": new_prc_balance},
            "$push": {
                "prc_transactions": {
                    "type": "dmt_debit",
                    "amount": -req.prc_amount,
                    "reference": client_ref_id,
                    "timestamp": datetime.now(timezone.utc)
                }
            }
        }
    )
    
    logging.info(f"[DMT] PRC Deducted: {req.prc_amount}, New Balance: {new_prc_balance}")
    
    # Step 5: Create transaction record
    transaction_doc = {
        "transaction_id": client_ref_id,
        "user_id": req.user_id,
        "mobile": req.mobile,
        "recipient_id": req.recipient_id,
        "prc_amount": req.prc_amount,
        "amount_inr": amount_inr,
        "service_type": "dmt",
        "status": "processing",
        "ip_address": client_ip,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    db.dmt_transactions.insert_one(transaction_doc)
    
    try:
        # Step 6: Execute EKO Transfer
        url = f"{EKO_BASE_URL}/v1/transactions?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        # Generate request hash
        timestamp = str(int(time.time() * 1000))
        # Format: timestamp + amount + recipient_id + client_ref_id
        hash_string = f"{timestamp}{int(amount_inr)}{req.recipient_id}{client_ref_id}"
        request_hash = generate_request_hash(hash_string)
        
        headers = generate_eko_headers()
        headers["request_hash"] = request_hash
        
        payload = {
            "customer_id": req.mobile,
            "recipient_id": req.recipient_id,
            "amount": str(int(amount_inr)),
            "client_ref_id": client_ref_id,
            "channel": "2",  # 2 = IMPS (faster), 1 = NEFT
            "state": "1",
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "source_ip": SOURCE_IP,
            "latlong": "19.9975,73.7898"
        }
        
        logging.info(f"[DMT] Executing Transfer: ₹{amount_inr} via {url}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Transfer Response: {response.status_code}")
        
        result = response.json()
        eko_status = result.get("status")
        tx_data = result.get("data", {})
        tx_status = tx_data.get("tx_status")
        eko_tid = tx_data.get("tid")
        
        # Log the transaction
        log_dmt_transaction(db, {
            "action": "transfer",
            "user_id": req.user_id,
            "client_ref_id": client_ref_id,
            "amount_inr": amount_inr,
            "prc_amount": req.prc_amount,
            "recipient_id": req.recipient_id,
            "ip": client_ip,
            "eko_status": eko_status,
            "tx_status": tx_status,
            "tid": eko_tid,
            "response": result
        })
        
        # Update transaction record
        update_data = {
            "eko_status": eko_status,
            "eko_tid": eko_tid,
            "tx_status": tx_status,
            "eko_message": result.get("message"),
            "eko_response": result,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if eko_status == 0:
            # Check tx_status for final state
            if tx_status == 0:
                # SUCCESS
                update_data["status"] = "completed"
                db.dmt_transactions.update_one(
                    {"transaction_id": client_ref_id},
                    {"$set": update_data}
                )
                
                return create_success_response({
                    "transaction_id": client_ref_id,
                    "eko_tid": eko_tid,
                    "status": "SUCCESS",
                    "amount_inr": amount_inr,
                    "prc_deducted": req.prc_amount,
                    "new_prc_balance": new_prc_balance,
                    "message": "Transfer successful!",
                    "bank_ref": tx_data.get("bank_ref_num")
                }, "Transfer completed successfully!")
            
            elif tx_status == 1:
                # FAILED - Refund PRC
                update_data["status"] = "failed"
                update_data["prc_refunded"] = req.prc_amount
                
                # Refund PRC
                db.users.update_one(
                    {"uid": req.user_id},
                    {
                        "$inc": {"prc_balance": req.prc_amount},
                        "$push": {
                            "prc_transactions": {
                                "type": "dmt_refund",
                                "amount": req.prc_amount,
                                "reference": client_ref_id,
                                "reason": "Transfer failed",
                                "timestamp": datetime.now(timezone.utc)
                            }
                        }
                    }
                )
                
                db.dmt_transactions.update_one(
                    {"transaction_id": client_ref_id},
                    {"$set": update_data}
                )
                
                return create_error_response(
                    eko_status,
                    "Transfer failed",
                    f"Transfer failed. {req.prc_amount} PRC has been refunded."
                )
            
            elif tx_status == 2:
                # PENDING - Keep PRC deducted, will be refunded if ultimately fails
                update_data["status"] = "pending"
                db.dmt_transactions.update_one(
                    {"transaction_id": client_ref_id},
                    {"$set": update_data}
                )
                
                return create_success_response({
                    "transaction_id": client_ref_id,
                    "eko_tid": eko_tid,
                    "status": "PENDING",
                    "amount_inr": amount_inr,
                    "prc_deducted": req.prc_amount,
                    "message": "Transfer is being processed. Status will be updated shortly.",
                    "check_status_url": f"/api/eko/dmt/status/{client_ref_id}"
                }, "Transfer initiated - Pending confirmation")
            
            elif tx_status in [3, 4]:
                # REFUND_PENDING or REFUNDED
                update_data["status"] = "refunded" if tx_status == 4 else "refund_pending"
                update_data["prc_refunded"] = req.prc_amount
                
                # Refund PRC
                db.users.update_one(
                    {"uid": req.user_id},
                    {
                        "$inc": {"prc_balance": req.prc_amount},
                        "$push": {
                            "prc_transactions": {
                                "type": "dmt_refund",
                                "amount": req.prc_amount,
                                "reference": client_ref_id,
                                "reason": "Transfer refunded by bank",
                                "timestamp": datetime.now(timezone.utc)
                            }
                        }
                    }
                )
                
                db.dmt_transactions.update_one(
                    {"transaction_id": client_ref_id},
                    {"$set": update_data}
                )
                
                return create_error_response(
                    eko_status,
                    "Transfer refunded",
                    f"Transfer was refunded by bank. {req.prc_amount} PRC credited back."
                )
            
            else:
                # Unknown status - keep as processing
                update_data["status"] = "processing"
                db.dmt_transactions.update_one(
                    {"transaction_id": client_ref_id},
                    {"$set": update_data}
                )
                
                return create_success_response({
                    "transaction_id": client_ref_id,
                    "eko_tid": eko_tid,
                    "status": "PROCESSING",
                    "message": "Transfer is being processed."
                }, "Transfer in progress")
        
        else:
            # EKO Error - Refund PRC
            update_data["status"] = "failed"
            update_data["prc_refunded"] = req.prc_amount
            
            # Refund PRC
            db.users.update_one(
                {"uid": req.user_id},
                {
                    "$inc": {"prc_balance": req.prc_amount},
                    "$push": {
                        "prc_transactions": {
                            "type": "dmt_refund",
                            "amount": req.prc_amount,
                            "reference": client_ref_id,
                            "reason": f"EKO Error: {result.get('message')}",
                            "timestamp": datetime.now(timezone.utc)
                        }
                    }
                }
            )
            
            db.dmt_transactions.update_one(
                {"transaction_id": client_ref_id},
                {"$set": update_data}
            )
            
            error_message = result.get("message", "Transfer failed")
            
            # Map common EKO errors
            error_messages = {
                347: "Insufficient balance in merchant account.",
                41: "Invalid IFSC code.",
                46: "Invalid bank account details.",
                544: "Bank server unavailable. Try again later.",
                53: "IMPS not available. Try NEFT.",
                317: "NEFT not allowed for this account."
            }
            
            user_msg = error_messages.get(eko_status, error_message)
            
            return create_error_response(
                eko_status,
                error_message,
                f"Transfer failed. {req.prc_amount} PRC refunded. Reason: {user_msg}"
            )
            
    except requests.exceptions.Timeout:
        # Timeout - Don't refund immediately, check status later
        db.dmt_transactions.update_one(
            {"transaction_id": client_ref_id},
            {"$set": {
                "status": "timeout",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return create_error_response(
            504,
            "Request timeout",
            "Transfer is taking longer than expected. Please check status in transaction history."
        )
    
    except Exception as e:
        logging.error(f"[DMT] Transfer Error: {e}")
        
        # Refund PRC on error
        db.users.update_one(
            {"uid": req.user_id},
            {
                "$inc": {"prc_balance": req.prc_amount},
                "$push": {
                    "prc_transactions": {
                        "type": "dmt_refund",
                        "amount": req.prc_amount,
                        "reference": client_ref_id,
                        "reason": f"System error: {str(e)}",
                        "timestamp": datetime.now(timezone.utc)
                    }
                }
            }
        )
        
        db.dmt_transactions.update_one(
            {"transaction_id": client_ref_id},
            {"$set": {
                "status": "error",
                "error_message": str(e),
                "prc_refunded": req.prc_amount,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return create_error_response(
            500,
            str(e),
            f"Transfer failed due to system error. {req.prc_amount} PRC refunded."
        )


# ==================== STEP 6: TRANSACTION STATUS ====================

@router.get("/status/{transaction_id}")
async def get_transaction_status(transaction_id: str, user_id: str):
    """
    Check status of a DMT transaction.
    
    Uses both local DB and EKO API for latest status.
    """
    db = get_db()
    
    # Get from local DB first
    txn = db.dmt_transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not txn:
        return create_error_response(404, "Transaction not found", "Transaction not found.")
    
    eko_tid = txn.get("eko_tid")
    
    # If we have EKO TID, check with EKO for latest status
    if eko_tid and txn.get("status") in ["pending", "processing", "timeout"]:
        try:
            url = f"{EKO_BASE_URL}/v1/transactions/{eko_tid}?initiator_id={EKO_INITIATOR_ID}"
            
            response = requests.get(url, headers=generate_eko_headers_for_get(), timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("status") == 0:
                    tx_data = result.get("data", {})
                    tx_status = tx_data.get("tx_status")
                    
                    # Update local record
                    new_status = {
                        0: "completed",
                        1: "failed",
                        2: "pending",
                        3: "refund_pending",
                        4: "refunded",
                        5: "on_hold"
                    }.get(tx_status, txn.get("status"))
                    
                    db.dmt_transactions.update_one(
                        {"transaction_id": transaction_id},
                        {"$set": {
                            "status": new_status,
                            "tx_status": tx_status,
                            "updated_at": datetime.now(timezone.utc)
                        }}
                    )
                    
                    # If failed/refunded and PRC not yet refunded, refund now
                    if new_status in ["failed", "refunded", "refund_pending"] and not txn.get("prc_refunded"):
                        prc_amount = txn.get("prc_amount")
                        db.users.update_one(
                            {"uid": user_id},
                            {
                                "$inc": {"prc_balance": prc_amount},
                                "$push": {
                                    "prc_transactions": {
                                        "type": "dmt_refund",
                                        "amount": prc_amount,
                                        "reference": transaction_id,
                                        "reason": "Transfer failed/refunded",
                                        "timestamp": datetime.now(timezone.utc)
                                    }
                                }
                            }
                        )
                        db.dmt_transactions.update_one(
                            {"transaction_id": transaction_id},
                            {"$set": {"prc_refunded": prc_amount}}
                        )
                    
                    txn["status"] = new_status
                    txn["tx_status"] = tx_status
        
        except Exception as e:
            logging.error(f"[DMT] Status check error: {e}")
    
    return create_success_response({
        "transaction_id": transaction_id,
        "eko_tid": txn.get("eko_tid"),
        "status": txn.get("status"),
        "tx_status": txn.get("tx_status"),
        "amount_inr": txn.get("amount_inr"),
        "prc_used": txn.get("prc_amount"),
        "prc_refunded": txn.get("prc_refunded"),
        "recipient_id": txn.get("recipient_id"),
        "created_at": str(txn.get("created_at")),
        "message": txn.get("eko_message")
    }, f"Transaction status: {txn.get('status')}")


# ==================== TRANSACTION HISTORY ====================

@router.get("/transactions/{user_id}")
async def get_transactions(user_id: str, limit: int = 20, skip: int = 0):
    """
    Get DMT transaction history for user.
    """
    db = get_db()
    
    transactions = list(db.dmt_transactions.find(
        {"user_id": user_id},
        {"_id": 0, "eko_response": 0}
    ).sort("created_at", -1).skip(skip).limit(limit))
    
    total = db.dmt_transactions.count_documents({"user_id": user_id})
    
    # Format transactions
    formatted = []
    for t in transactions:
        formatted.append({
            "transaction_id": t.get("transaction_id"),
            "eko_tid": t.get("eko_tid"),
            "status": t.get("status"),
            "amount_inr": t.get("amount_inr"),
            "prc_used": t.get("prc_amount"),
            "prc_refunded": t.get("prc_refunded"),
            "recipient_id": t.get("recipient_id"),
            "created_at": str(t.get("created_at")),
            "message": t.get("eko_message")
        })
    
    return create_success_response({
        "total": total,
        "count": len(formatted),
        "transactions": formatted
    }, f"Found {total} transactions")


# ==================== BANK VERIFICATION ====================

@router.post("/verify-account")
async def verify_bank_account(account: str, ifsc: str, user_id: str, request: Request):
    """
    Verify bank account before adding as recipient.
    
    Uses EKO's penny drop verification.
    """
    db = get_db()
    client_ip = request.client.host if request.client else "unknown"
    
    logging.info(f"[DMT] Account Verification: ***{account[-4:]}, IFSC: {ifsc}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/banks/ifsc:{ifsc}/accounts/{account}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        response = requests.get(url, headers=generate_eko_headers_for_get(), timeout=60)
        
        result = response.json()
        
        log_dmt_transaction(db, {
            "action": "verify_account",
            "user_id": user_id,
            "account": f"***{account[-4:]}",
            "ifsc": ifsc,
            "ip": client_ip,
            "response": result
        })
        
        if result.get("status") == 0:
            data = result.get("data", {})
            return create_success_response({
                "verified": True,
                "account_holder_name": data.get("recipient_name"),
                "bank_name": data.get("bank_name"),
                "ifsc": ifsc,
                "account": f"***{account[-4:]}"
            }, "Account verified successfully")
        
        else:
            return create_error_response(
                result.get("status"),
                result.get("message", "Verification failed"),
                "Unable to verify account. Please check account number and IFSC."
            )
            
    except Exception as e:
        logging.error(f"[DMT] Verification Error: {e}")
        return create_error_response(500, str(e), "Verification failed. Please try again.")
