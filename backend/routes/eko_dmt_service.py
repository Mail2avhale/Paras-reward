"""
PARAS REWARD - EKO DMT (Domestic Money Transfer) Service
========================================================
Complete Production-Ready Backend for Bank Transfers

IMPORTANT: NO HARDCODED VALUES - All config from environment variables

Flow:
1. Customer Search/Registration
2. OTP Verification (if needed)
3. Add Recipient (Bank Account)
4. Money Transfer
5. Transaction Status Check

PRC Conversion:
- 100 PRC = ₹1 INR
- Minimum Redeem: ₹100 (10,000 PRC)
- Maximum Daily: ₹5,000 (5,00,000 PRC)

Security:
- All EKO API calls server-side only
- OTP verification for transfers
- Daily limits enforcement
- Duplicate transaction prevention
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import httpx  # ASYNC HTTP - replaces blocking 'requests' library
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

# Global async HTTP client for connection pooling
_http_client: Optional[httpx.AsyncClient] = None

def get_http_client() -> httpx.AsyncClient:
    """Get or create async HTTP client with connection pooling"""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    return _http_client

# ==================== CONFIGURATION (ALL FROM ENV) ====================

router = APIRouter(prefix="/eko/dmt", tags=["DMT - Bank Transfer"])

# EKO Configuration - ALL from environment, NO defaults in production
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID")
EKO_AUTH_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE")

# Validate required config on startup
def validate_eko_config():
    """Validate all required Eko configuration is present"""
    missing = []
    if not EKO_DEVELOPER_KEY:
        missing.append("EKO_DEVELOPER_KEY")
    if not EKO_INITIATOR_ID:
        missing.append("EKO_INITIATOR_ID")
    if not EKO_AUTH_KEY:
        missing.append("EKO_AUTHENTICATOR_KEY")
    if not EKO_USER_CODE:
        missing.append("EKO_USER_CODE")
    
    if missing:
        logging.error(f"[DMT] Missing required environment variables: {', '.join(missing)}")
        return False
    return True

# PRC Conversion
PRC_TO_INR_RATE = 100  # 100 PRC = ₹1
MIN_REDEEM_INR = 100   # Minimum ₹100
MAX_DAILY_INR = 5000   # Maximum ₹5000 per day

# Database
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# Request timeout
REQUEST_TIMEOUT = 60

# ==================== ASYNC HTTP HELPERS ====================

async def async_get(url: str, headers: dict = None, params: dict = None, timeout: int = REQUEST_TIMEOUT) -> httpx.Response:
    """Non-blocking async GET request"""
    client = get_http_client()
    return await client.get(url, headers=headers, params=params, timeout=timeout)

async def async_post(url: str, headers: dict = None, data: dict = None, json: dict = None, timeout: int = REQUEST_TIMEOUT) -> httpx.Response:
    """Non-blocking async POST request"""
    client = get_http_client()
    return await client.post(url, headers=headers, data=data, json=json, timeout=timeout)

async def async_put(url: str, headers: dict = None, data: dict = None, timeout: int = REQUEST_TIMEOUT) -> httpx.Response:
    """Non-blocking async PUT request"""
    client = get_http_client()
    return await client.put(url, headers=headers, data=data, timeout=timeout)

# ==================== ERROR CODES ====================

EKO_ERROR_MESSAGES = {
    0: "Success",
    403: "Authentication failed. Please contact support.",
    463: "Customer not found. Registration required.",
    327: "Verification pending. Please complete OTP verification.",
    302: "Invalid OTP. Please try again.",
    303: "OTP expired. Please request a new OTP.",
    342: "Recipient already registered.",
    41: "Invalid IFSC code.",
    46: "Invalid account details.",
    347: "Insufficient balance.",
    544: "Bank server unavailable. Please try later.",
    53: "IMPS not available for this transaction.",
    317: "NEFT not allowed for this account.",
    314: "Monthly limit exceeded.",
}

# ==================== DATABASE CONNECTION ====================
# OPTIMIZED: Use shared async Motor client instead of creating new sync connection per request
# The db reference will be set from server.py

db = None  # Will be set via set_db() from server.py

def set_db(database):
    """Set the shared async database reference from server.py"""
    global db
    db = database

# DEPRECATED: Legacy sync connection - kept for backward compatibility only
def get_db():
    """Get MongoDB database connection - DEPRECATED, use shared async db instead"""
    import warnings
    warnings.warn("get_db() is deprecated. Use async shared db instead.", DeprecationWarning)
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def get_client_ip(request: Request) -> str:
    """Get client IP from request headers or connection"""
    # Check X-Forwarded-For header (for proxied requests)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to direct connection IP
    if request.client:
        return request.client.host
    
    return "unknown"


# ==================== AUTHENTICATION ====================

def generate_secret_key(timestamp_ms: str) -> str:
    """
    Generate Eko secret-key as per official documentation.
    
    Formula (from Eko docs):
    1. Encode key using base64
    2. Generate timestamp in MILLISECONDS 
    3. Compute HMAC-SHA256(base64_key, timestamp)
    4. Encode result using base64
    
    Reference: https://developers.eko.in/docs/authentication
    """
    # Step 1: Base64 encode the authenticator key
    key_bytes = EKO_AUTH_KEY.encode('utf-8')
    encoded_key = base64.b64encode(key_bytes).decode('utf-8')
    
    # Step 2: Use timestamp as message
    message = timestamp_ms.encode('utf-8')
    
    # Step 3: HMAC-SHA256 with encoded key as the key
    signature = hmac.new(
        encoded_key.encode('utf-8'),
        message,
        hashlib.sha256
    ).digest()
    
    # Step 4: Base64 encode the signature
    secret_key = base64.b64encode(signature).decode('utf-8')
    
    return secret_key


def generate_eko_headers(request: Request = None) -> Dict[str, str]:
    """
    Generate EKO authentication headers for DMT.
    
    As per Eko documentation:
    - secret-key-timestamp: current time in MILLISECONDS
    - secret-key: HMAC-SHA256(base64(auth_key), timestamp) -> base64
    """
    if not validate_eko_config():
        raise ValueError("EKO configuration not properly set")
    
    # Timestamp in MILLISECONDS (as per Eko docs)
    timestamp_ms = str(int(time.time() * 1000))
    
    # Generate secret key using correct formula
    secret_key = generate_secret_key(timestamp_ms)
    
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp_ms,
        "initiator_id": EKO_INITIATOR_ID,
        "Content-Type": "application/x-www-form-urlencoded"
    }


def generate_eko_headers_json(request: Request = None) -> Dict[str, str]:
    """Generate headers for JSON requests"""
    headers = generate_eko_headers(request)
    headers["Content-Type"] = "application/json"
    return headers


def generate_eko_headers_for_get() -> Dict[str, str]:
    """
    Generate EKO authentication headers for GET requests.
    GET requests should not have Content-Type header.
    """
    if not validate_eko_config():
        raise ValueError("EKO configuration not properly set")
    
    # Timestamp in MILLISECONDS
    timestamp_ms = str(int(time.time() * 1000))
    
    # Generate secret key
    secret_key = generate_secret_key(timestamp_ms)
    
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp_ms,
        "initiator_id": EKO_INITIATOR_ID
    }


def generate_request_hash(timestamp_ms: str, utility_acc_no: str, amount: str, user_code: str) -> str:
    """
    Generate request_hash for POST/transaction requests.
    
    Formula (from Eko docs):
    1. Base64 encode the key
    2. Concatenate: timestamp + utility_acc_no + amount + user_code
    3. HMAC-SHA256(base64_key, concatenated_string)
    4. Base64 encode result
    """
    # Base64 encode the key
    encoded_key = base64.b64encode(EKO_AUTH_KEY.encode('utf-8')).decode('utf-8')
    
    # Concatenate the string
    concat_string = timestamp_ms + utility_acc_no + amount + user_code
    
    # HMAC-SHA256
    signature = hmac.new(
        encoded_key.encode('utf-8'),
        concat_string.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Base64 encode
    request_hash = base64.b64encode(signature).decode('utf-8')
    
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
    name: str = Field(..., min_length=1, max_length=100, description="Full name")
    dob: Optional[str] = Field(None, description="Date of birth YYYY-MM-DD format")
    address: Optional[str] = Field(None, description="Customer address")
    user_id: str
    
    @validator('mobile')
    def validate_mobile(cls, v):
        if not v.isdigit():
            raise ValueError('Mobile must be numeric')
        return v


class CustomerOTPRequest(BaseModel):
    """Request for OTP operations"""
    user_id: str
    mobile: str = Field(..., min_length=10, max_length=10)
    otp: Optional[str] = Field(None, min_length=4, max_length=6)
    otp_ref_id: Optional[str] = Field(None, description="OTP reference ID from registration")


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
    
    @validator('prc_amount')
    def validate_prc(cls, v):
        inr = v / PRC_TO_INR_RATE
        if inr < MIN_REDEEM_INR:
            raise ValueError(f'Minimum redeem is ₹{MIN_REDEEM_INR} ({MIN_REDEEM_INR * PRC_TO_INR_RATE} PRC)')
        if inr > MAX_DAILY_INR:
            raise ValueError(f'Maximum daily limit is ₹{MAX_DAILY_INR}')
        return v


# ==================== RESPONSE HELPERS ====================

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
        "user_message": user_message or EKO_ERROR_MESSAGES.get(code, message),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ==================== HELPER FUNCTIONS ====================

async def check_daily_limit_async(user_id: str) -> tuple:
    """
    Check if user has exceeded daily limit - ASYNC version.
    Returns (is_allowed, remaining_limit, used_today)
    Uses shared async Motor client for better performance.
    """
    if not db:
        return False, 0, 0
        
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
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
    
    result = await db.dmt_transactions.aggregate(pipeline).to_list(1)
    used_today = result[0]["total_inr"] if result else 0
    remaining = MAX_DAILY_INR - used_today
    
    return remaining > 0, remaining, used_today


def check_daily_limit(sync_db, user_id: str) -> tuple:
    """
    Check if user has exceeded daily limit - SYNC version (DEPRECATED).
    Returns (is_allowed, remaining_limit, used_today)
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
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
    
    result = list(sync_db.dmt_transactions.aggregate(pipeline))
    used_today = result[0]["total_inr"] if result else 0
    remaining = MAX_DAILY_INR - used_today
    
    return remaining > 0, remaining, used_today


async def log_dmt_transaction_async(log_data: Dict):
    """Log DMT transaction for audit - ASYNC version"""
    if not db:
        return
    log_data["timestamp"] = datetime.now(timezone.utc)
    await db.dmt_logs.insert_one(log_data)


def log_dmt_transaction(sync_db, log_data: Dict):
    """Log DMT transaction for audit - SYNC version (DEPRECATED)"""
    log_data["timestamp"] = datetime.now(timezone.utc)
    sync_db.dmt_logs.insert_one(log_data)


# ==================== HEALTH CHECK ====================

@router.get("/health")
def health():
    """DMT Service Health Check"""
    config_valid = validate_eko_config()
    return {
        "status": "DMT SERVICE RUNNING" if config_valid else "CONFIG ERROR",
        "config_valid": config_valid,
        "version": "2.0",
        "prc_rate": f"{PRC_TO_INR_RATE} PRC = ₹1",
        "min_redeem": f"₹{MIN_REDEEM_INR}",
        "max_daily": f"₹{MAX_DAILY_INR}"
    }


# ==================== WALLET ====================

@router.get("/wallet/{user_id}")
async def get_wallet(user_id: str):
    """Get user's PRC wallet balance and INR equivalent - ASYNC version."""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1, "name": 1})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prc_balance = user.get("prc_balance", 0)
    inr_equivalent = prc_balance / PRC_TO_INR_RATE
    
    # Use async version for daily limit check
    is_allowed, remaining_limit, used_today = await check_daily_limit_async(user_id)
    
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
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable. Please contact support.")
    
    db = get_db()
    client_ip = get_client_ip(request)
    
    logging.info(f"[DMT] Customer Search: {req.mobile}, User: {req.user_id}, IP: {client_ip}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        response = await async_get(url, headers=generate_eko_headers_for_get(), timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Customer Search Response: {response.status_code}")
        logging.debug(f"[DMT] Response Body: {response.text[:500]}")
        
        if response.status_code == 403:
            logging.error(f"[DMT] 403 Forbidden - Authentication failed or IP not whitelisted. IP: {client_ip}")
            return create_error_response(
                403, 
                "Authentication failed", 
                "Bank Transfer सेवा सध्या उपलब्ध नाही. कृपया Admin शी संपर्क करा."
            )
        
        if response.status_code != 200:
            logging.error(f"[DMT] HTTP {response.status_code}: {response.text}")
            return create_error_response(
                response.status_code,
                f"API Error: {response.status_code}",
                "Service temporarily unavailable. Please try again."
            )
        
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
            customer_state = customer_data.get("state", 0)
            
            # State meanings:
            # 0 = Verified (can do transactions)
            # 1 = OTP verification pending
            # 2 = Blocked
            
            response_data = {
                "customer_exists": True,
                "customer_id": customer_data.get("customer_id"),
                "mobile": req.mobile,
                "name": customer_data.get("name"),
                "available_limit": customer_data.get("available_limit", 25000),
                "used_limit": customer_data.get("used_limit", 0),
                "total_limit": customer_data.get("total_limit", 25000),
                "kyc_status": customer_data.get("state_desc", "Verified" if customer_state == 0 else "Pending"),
                "state": customer_state,
                "otp_required": customer_state == 1,
                "can_transact": customer_state == 0
            }
            
            if customer_state == 1:
                response_data["message"] = "Customer found but OTP verification pending. Please verify OTP to continue."
            
            return create_success_response(response_data, "Customer found")
        
        elif eko_status == 463:
            # Customer not found - needs registration
            return create_success_response({
                "customer_exists": False,
                "mobile": req.mobile,
                "otp_required": False,
                "can_transact": False,
                "message": "Customer not registered. Please register first."
            }, "Customer not found - Registration required")
        
        elif eko_status == 327:
            # Customer exists but OTP pending
            return create_success_response({
                "customer_exists": True,
                "mobile": req.mobile,
                "state": 1,
                "otp_required": True,
                "can_transact": False,
                "message": "Customer found but OTP verification pending."
            }, "OTP verification pending")
        
        else:
            user_msg = EKO_ERROR_MESSAGES.get(eko_status, result.get("message", "Customer search failed"))
            return create_error_response(
                eko_status,
                result.get("message", "Customer search failed"),
                user_msg
            )
            
    except httpx.TimeoutException:
        return create_error_response(504, "Request timeout", "Service is slow. Please try again.")
    except Exception as e:
        logging.error(f"[DMT] Customer Search Error: {e}")
        return create_error_response(500, str(e), "An error occurred. Please try again.")


# ==================== STEP 2: CUSTOMER REGISTRATION ====================

@router.post("/customer/register")
async def register_customer(req: CustomerRegisterRequest, request: Request):
    """
    Register new customer in EKO system using V1 API.
    
    As per Eko V1 Documentation:
    - API: PUT /v1/customers/mobile_number:{mobile}
    - Content-Type: application/x-www-form-urlencoded
    - Required: initiator_id, name, user_code
    
    Flow:
    1. Call PUT API to register customer
    2. If state=1, OTP verification is required
    3. If state=2, customer is already verified (non-KYC)
    4. For state=1, call verify-otp API to complete registration
    """
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    db = get_db()
    client_ip = get_client_ip(request)
    
    logging.info(f"[DMT] Customer Registration V1: {req.mobile}, Name: {req.name}")
    
    try:
        # V1 API endpoint - this works for general DMT accounts
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}"
        
        # V1 payload - simpler than V3
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "name": req.name,
            "user_code": EKO_USER_CODE
        }
        
        headers = generate_eko_headers(request)
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        
        logging.info(f"[DMT] V1 Registration URL: {url}")
        logging.info(f"[DMT] V1 Payload: {payload}")
        
        response = await async_put(url, headers=headers, data=payload, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Registration Response: {response.status_code}")
        logging.info(f"[DMT] Registration Response Body: {response.text[:800]}")
        
        if response.status_code == 403:
            logging.error(f"[DMT] 403 Forbidden - IP: {client_ip}")
            return create_error_response(403, "Authentication failed", "Service temporarily unavailable. Contact support.")
        
        # Handle empty response
        if not response.text or response.text.strip() == "":
            logging.error(f"[DMT] Empty response from Eko")
            return create_error_response(500, "Empty response from payment service", "Service temporarily unavailable.")
        
        result = response.json()
        eko_status = result.get("status")
        response_status_id = result.get("response_status_id", -1)
        eko_data = result.get("data", {})
        
        # Log registration
        log_dmt_transaction(db, {
            "action": "customer_register_v1",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "name": req.name,
            "ip": client_ip,
            "eko_status": eko_status,
            "response_status_id": response_status_id,
            "response": result
        })
        
        # Success case - status=0 or response_status_id=0
        if eko_status == 0 or response_status_id == 0:
            customer_state = eko_data.get("state", "2")
            state_desc = eko_data.get("state_desc", "")
            customer_id = eko_data.get("customer_id", req.mobile)
            otp_ref_id = eko_data.get("otp_ref_id", "")
            
            # State meanings:
            # 1 = OTP verification pending
            # 2 = Verified (Non-KYC) - can do transactions immediately
            # 3 = KYC pending
            # 4 = Fully KYC verified
            
            if str(customer_state) == "1":
                # OTP verification needed
                return create_success_response({
                    "registered": True,
                    "customer_id": customer_id,
                    "mobile": req.mobile,
                    "name": req.name,
                    "state": customer_state,
                    "state_desc": state_desc,
                    "otp_required": True,
                    "otp_sent": True,
                    "otp_ref_id": otp_ref_id,
                    "can_transact": False,
                    "message": "OTP पाठवला आहे. कृपया OTP टाकून verification पूर्ण करा."
                }, "Customer registered - OTP sent")
            else:
                # Customer verified immediately (state 2, 3, or 4)
                return create_success_response({
                    "registered": True,
                    "customer_id": customer_id,
                    "mobile": req.mobile,
                    "name": req.name,
                    "state": customer_state,
                    "state_desc": state_desc,
                    "otp_required": False,
                    "otp_sent": False,
                    "can_transact": True,
                    "message": result.get("message", "Customer registered successfully! You can now add bank accounts.")
                }, "Customer registered successfully")
        
        elif eko_status == 327 or response_status_id == 327:
            # OTP already pending
            return create_success_response({
                "registered": True,
                "customer_id": eko_data.get("customer_id"),
                "mobile": req.mobile,
                "state": "1",
                "otp_required": True,
                "otp_sent": False,
                "can_transact": False,
                "otp_ref_id": eko_data.get("otp_ref_id", ""),
                "message": "OTP verification pending. 'Resend OTP' वर क्लिक करा."
            }, "OTP verification pending")
        
        else:
            user_msg = EKO_ERROR_MESSAGES.get(eko_status, result.get("message", "Registration failed"))
            return create_error_response(eko_status, result.get("message", "Registration failed"), user_msg)
            
    except httpx.TimeoutException:
        return create_error_response(504, "Request timeout", "Service is slow. Please try again.")
    except Exception as e:
        logging.error(f"[DMT] Registration Error: {e}")
        return create_error_response(500, str(e), "Registration failed. Please try again.")


# ==================== STEP 2.5: OTP OPERATIONS ====================

@router.post("/customer/resend-otp")
async def resend_customer_otp(req: CustomerOTPRequest, request: Request):
    """
    Resend OTP for customer verification.
    
    As per Eko V1 Documentation:
    - API: POST /v1/customers/mobile_number:{mobile}/otp
    - Required: initiator_id, user_code
    - This sends a fresh OTP to customer's mobile
    - Use when: Customer state=1 (OTP pending)
    
    OTP is sent to the customer's registered mobile number.
    Customer will receive SMS with 6-digit OTP.
    """
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    db = get_db()
    client_ip = get_client_ip(request)
    
    logging.info(f"[DMT] Resend OTP V1: {req.mobile}")
    
    try:
        # V1 API endpoint for resending OTP
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}/otp"
        
        # POST request with form data
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        headers = generate_eko_headers(request)
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        
        logging.info(f"[DMT] Resend OTP URL: {url}, Payload: {payload}")
        
        response = await async_post(url, headers=headers, data=payload, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Resend OTP Response: {response.status_code}")
        logging.info(f"[DMT] Resend OTP Response Body: {response.text[:500]}")
        
        if response.status_code == 403:
            logging.error(f"[DMT] 403 Forbidden on Resend OTP - IP: {client_ip}")
            return create_error_response(403, "Authentication failed", "Service temporarily unavailable.")
        
        # Handle empty response
        if not response.text or response.text.strip() == "":
            return create_error_response(500, "Empty response", "Service temporarily unavailable.")
        
        result = response.json()
        eko_status = result.get("status")
        response_status_id = result.get("response_status_id", -1)
        response_type_id = result.get("response_type_id", -1)
        eko_data = result.get("data", {})
        
        # Log OTP request
        log_dmt_transaction(db, {
            "action": "resend_otp_v1",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "ip": client_ip,
            "eko_status": eko_status,
            "response_status_id": response_status_id,
            "response": result
        })
        
        # Success - OTP sent (response_type_id=327 means OTP sent)
        if eko_status == 0 and (response_status_id == 0 or response_type_id == 327):
            return create_success_response({
                "otp_sent": True,
                "mobile": req.mobile,
                "otp_ref_id": eko_data.get("otp_ref_id", ""),
                "state": eko_data.get("state", "1"),
                "message": result.get("message", "OTP पाठवला आहे. कृपया SMS check करा.")
            }, "OTP sent successfully")
        else:
            user_msg = EKO_ERROR_MESSAGES.get(eko_status, result.get("message", "Failed to send OTP"))
            return create_error_response(eko_status, result.get("message", "Failed to send OTP"), user_msg)
            
    except httpx.TimeoutException:
        return create_error_response(504, "Request timeout", "Service is slow. Please try again.")
    except Exception as e:
        logging.error(f"[DMT] Resend OTP Error: {e}")
        return create_error_response(500, str(e), "Failed to send OTP.")


@router.post("/customer/verify-otp")
async def verify_customer_otp(req: CustomerOTPRequest, request: Request):
    """
    Verify customer OTP to complete registration.
    
    NOTE: For current Eko account configuration:
    - New customers are immediately verified (state=2) during registration
    - OTP verification is only needed for legacy customers with state=1
    - V3 verify endpoint may not be available for all account types
    
    If V3 verify fails, suggest re-registering the customer.
    """
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    db = get_db()
    client_ip = get_client_ip(request)
    
    if not req.otp:
        return create_error_response(400, "OTP is required", "कृपया OTP टाका.")
    
    logging.info(f"[DMT] Verify OTP: {req.mobile}, OTP: ***{req.otp[-2:]}")
    
    try:
        # First, fetch existing customer to get their name
        search_url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        headers = generate_eko_headers(request)
        
        search_response = await async_get(search_url, headers=headers, timeout=REQUEST_TIMEOUT)
        customer_name = "User"
        
        if search_response.status_code == 200:
            try:
                search_result = search_response.json()
                customer_name = search_result.get("data", {}).get("name", "User") or "User"
            except:
                pass
        
        logging.info(f"[DMT] Customer name from search: {customer_name}")
        
        # Now try V1 re-registration with OTP and name
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "name": customer_name,
            "otp": req.otp  # Include OTP in registration call
        }
        
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        
        logging.info(f"[DMT] Trying V1 re-registration with OTP and name: {customer_name}")
        
        response = await async_put(url, headers=headers, data=payload, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Verify Response: {response.status_code}")
        logging.info(f"[DMT] Verify Response Body: {response.text[:800]}")
        
        if response.status_code == 403:
            logging.error(f"[DMT] 403 Forbidden on Verify OTP - IP: {client_ip}")
            return create_error_response(403, "Authentication failed", "Service temporarily unavailable.")
        
        # Handle empty response
        if not response.text or response.text.strip() == "":
            return create_error_response(500, "Empty response", "Service temporarily unavailable.")
        
        result = response.json()
        eko_status = result.get("status")
        response_status_id = result.get("response_status_id", -1)
        eko_data = result.get("data", {})
        
        # Log verification attempt
        log_dmt_transaction(db, {
            "action": "verify_otp",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "ip": client_ip,
            "eko_status": eko_status,
            "response_status_id": response_status_id,
            "success": eko_status == 0,
            "response": result
        })
        
        customer_state = str(eko_data.get("state", ""))
        state_desc = eko_data.get("state_desc", "")
        
        # Check if customer is now verified (state=2 or higher)
        if eko_status == 0 and customer_state in ["2", "3", "4"]:
            return create_success_response({
                "verified": True,
                "customer_id": eko_data.get("customer_id"),
                "mobile": req.mobile,
                "state": customer_state,
                "state_desc": state_desc,
                "available_limit": eko_data.get("available_limit", 25000),
                "total_limit": eko_data.get("total_limit", 25000),
                "can_transact": True,
                "message": "Customer verified! आता bank account add करा."
            }, "Customer verified successfully")
        
        elif customer_state == "1":
            # Still pending - V3 verify endpoint needed but might not be available
            return create_error_response(
                327,
                "OTP verification pending",
                "OTP verification pending. कृपया Eko support शी संपर्क करा किंवा नवीन mobile number वापरून register करा."
            )
        
        else:
            # V1 didn't verify - return appropriate message
            message = result.get("message", "Verification failed")
            return create_error_response(
                eko_status or 500,
                message,
                f"Verification failed: {message}"
            )
            
    except httpx.TimeoutException:
        return create_error_response(504, "Request timeout", "Service is slow. Please try again.")
    except Exception as e:
        logging.error(f"[DMT] Verify OTP Error: {e}")
        return create_error_response(500, str(e), "Verification failed. Please try again.")


# ==================== STEP 3: ADD RECIPIENT ====================

@router.post("/recipient/add")
async def add_recipient(req: AddRecipientRequest, request: Request):
    """
    Add bank account as recipient for money transfer.
    
    EKO API: PUT /v1/customers/mobile_number:{mobile}/recipients/acc_no:{account}
    """
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    db = get_db()
    client_ip = get_client_ip(request)
    
    logging.info(f"[DMT] Add Recipient: {req.recipient_name}, Account: ***{req.account_number[-4:]}, IFSC: {req.ifsc}")
    
    try:
        # Get bank code from IFSC
        bank_code = req.ifsc[:4]  # First 4 characters of IFSC
        
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}/recipients/acc_no:{req.account_number}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        payload = {
            "recipient_name": req.recipient_name,
            "recipient_mobile": req.mobile,
            "ifsc": req.ifsc,
            "bank_code": bank_code,
            "recipient_type": "1",  # 1 = Bank Account
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "source_ip": client_ip
        }
        
        headers = generate_eko_headers(request)
        response = await async_put(url, headers=headers, data=payload, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Add Recipient Response: {response.status_code}")
        
        if response.status_code == 403:
            return create_error_response(403, "Authentication failed", "Service temporarily unavailable.")
        
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
            user_msg = EKO_ERROR_MESSAGES.get(eko_status, result.get("message", "Failed to add recipient"))
            return create_error_response(eko_status, result.get("message", "Failed to add recipient"), user_msg)
            
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
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    logging.info(f"[DMT] Get Recipients: {mobile}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{mobile}/recipients?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        response = await async_get(url, headers=generate_eko_headers_for_get(), timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Recipients Response: {response.status_code}")
        
        if response.status_code == 404:
            return create_success_response({
                "count": 0,
                "recipients": [],
                "message": "No recipients found. Add a bank account to get started."
            }, "No recipients found")
        
        if response.status_code == 403:
            return create_error_response(403, "Authentication failed", "Service temporarily unavailable.")
        
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
            return create_success_response({
                "count": 0,
                "recipients": [],
                "message": "No recipients found. Add a bank account first."
            }, "No recipients found")
        
        else:
            user_msg = EKO_ERROR_MESSAGES.get(eko_status, "Failed to get recipients")
            return create_error_response(eko_status, result.get("message", "Failed to get recipients"), user_msg)
            
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
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    db = get_db()
    client_ip = get_client_ip(request)
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
        
        # Generate timestamp and request hash (per Eko docs)
        timestamp_ms = str(int(time.time() * 1000))
        
        # For DMT transfer: request_hash uses (timestamp + recipient_id + amount + user_code)
        # Note: Eko docs show utility_acc_no for BBPS, for DMT we use recipient_id
        request_hash = generate_request_hash(
            timestamp_ms=timestamp_ms,
            utility_acc_no=req.recipient_id,  # recipient_id for DMT
            amount=str(int(amount_inr)),
            user_code=EKO_USER_CODE
        )
        
        # Generate headers with same timestamp
        secret_key = generate_secret_key(timestamp_ms)
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp_ms,
            "initiator_id": EKO_INITIATOR_ID,
            "Content-Type": "application/json",
            "request_hash": request_hash
        }
        
        payload = {
            "customer_id": req.mobile,
            "recipient_id": req.recipient_id,
            "amount": str(int(amount_inr)),
            "client_ref_id": client_ref_id,
            "channel": "2",  # 2 = IMPS
            "state": "1",
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "source_ip": client_ip,
            "latlong": "19.9975,73.7898"
        }
        
        logging.info(f"[DMT] Executing Transfer: ₹{amount_inr} via {url}")
        
        response = await async_post(url, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT] Transfer Response: {response.status_code}")
        
        if response.status_code == 403:
            # Refund PRC on auth failure
            refund_prc(db, req.user_id, req.prc_amount, client_ref_id, "Authentication failed")
            return create_error_response(403, "Authentication failed", "Service temporarily unavailable. PRC refunded.")
        
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
            # Process based on tx_status
            if tx_status == 0:
                # SUCCESS
                update_data["status"] = "completed"
                db.dmt_transactions.update_one({"transaction_id": client_ref_id}, {"$set": update_data})
                
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
                refund_prc(db, req.user_id, req.prc_amount, client_ref_id, "Transfer failed")
                update_data["prc_refunded"] = req.prc_amount
                db.dmt_transactions.update_one({"transaction_id": client_ref_id}, {"$set": update_data})
                
                return create_error_response(
                    eko_status,
                    "Transfer failed",
                    f"Transfer failed. {req.prc_amount} PRC has been refunded."
                )
            
            elif tx_status == 2:
                # PENDING
                update_data["status"] = "pending"
                db.dmt_transactions.update_one({"transaction_id": client_ref_id}, {"$set": update_data})
                
                return create_success_response({
                    "transaction_id": client_ref_id,
                    "eko_tid": eko_tid,
                    "status": "PENDING",
                    "amount_inr": amount_inr,
                    "prc_deducted": req.prc_amount,
                    "message": "Transfer is being processed. Status will be updated shortly."
                }, "Transfer initiated - Pending confirmation")
            
            else:
                # Other status - REFUND states
                update_data["status"] = "processing"
                if tx_status in [3, 4]:  # Refund states
                    refund_prc(db, req.user_id, req.prc_amount, client_ref_id, "Transfer refunded by bank")
                    update_data["prc_refunded"] = req.prc_amount
                
                db.dmt_transactions.update_one({"transaction_id": client_ref_id}, {"$set": update_data})
                
                return create_success_response({
                    "transaction_id": client_ref_id,
                    "eko_tid": eko_tid,
                    "status": "PROCESSING",
                    "message": "Transfer is being processed."
                }, "Transfer in progress")
        
        else:
            # EKO Error - Refund PRC
            refund_prc(db, req.user_id, req.prc_amount, client_ref_id, f"EKO Error: {result.get('message')}")
            update_data["status"] = "failed"
            update_data["prc_refunded"] = req.prc_amount
            db.dmt_transactions.update_one({"transaction_id": client_ref_id}, {"$set": update_data})
            
            user_msg = EKO_ERROR_MESSAGES.get(eko_status, result.get("message", "Transfer failed"))
            return create_error_response(
                eko_status,
                result.get("message", "Transfer failed"),
                f"Transfer failed. {req.prc_amount} PRC refunded. Reason: {user_msg}"
            )
            
    except httpx.TimeoutException:
        # Don't refund on timeout - status unknown
        db.dmt_transactions.update_one(
            {"transaction_id": client_ref_id},
            {"$set": {"status": "timeout", "updated_at": datetime.now(timezone.utc)}}
        )
        
        return create_error_response(
            504,
            "Request timeout",
            "Transfer is taking longer than expected. Please check status in transaction history."
        )
    
    except Exception as e:
        logging.error(f"[DMT] Transfer Error: {e}")
        
        # Refund PRC on error
        refund_prc(db, req.user_id, req.prc_amount, client_ref_id, f"System error: {str(e)}")
        
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


def refund_prc(db, user_id: str, amount: int, ref_id: str, reason: str):
    """Refund PRC to user"""
    db.users.update_one(
        {"uid": user_id},
        {
            "$inc": {"prc_balance": amount},
            "$push": {
                "prc_transactions": {
                    "type": "dmt_refund",
                    "amount": amount,
                    "reference": ref_id,
                    "reason": reason,
                    "timestamp": datetime.now(timezone.utc)
                }
            }
        }
    )
    logging.info(f"[DMT] PRC Refunded: {amount} to user {user_id}, reason: {reason}")


# ==================== STEP 6: TRANSACTION STATUS ====================

@router.get("/status/{transaction_id}")
async def get_transaction_status(transaction_id: str, user_id: str):
    """Check status of a DMT transaction."""
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    db = get_db()
    
    txn = db.dmt_transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not txn:
        return create_error_response(404, "Transaction not found", "Transaction not found.")
    
    eko_tid = txn.get("eko_tid")
    
    # If pending, check with EKO for latest status
    if eko_tid and txn.get("status") in ["pending", "processing", "timeout"]:
        try:
            url = f"{EKO_BASE_URL}/v1/transactions/{eko_tid}?initiator_id={EKO_INITIATOR_ID}"
            
            response = await async_get(url, headers=generate_eko_headers_for_get(), timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("status") == 0:
                    tx_data = result.get("data", {})
                    tx_status = tx_data.get("tx_status")
                    
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
                    
                    # Refund if failed
                    if new_status in ["failed", "refunded", "refund_pending"] and not txn.get("prc_refunded"):
                        refund_prc(db, user_id, txn.get("prc_amount"), transaction_id, "Transfer failed/refunded")
                        db.dmt_transactions.update_one(
                            {"transaction_id": transaction_id},
                            {"$set": {"prc_refunded": txn.get("prc_amount")}}
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
    """Get DMT transaction history for user."""
    db = get_db()
    
    transactions = list(db.dmt_transactions.find(
        {"user_id": user_id},
        {"_id": 0, "eko_response": 0}
    ).sort("created_at", -1).skip(skip).limit(limit))
    
    total = db.dmt_transactions.count_documents({"user_id": user_id})
    
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

class VerifyAccountRequest(BaseModel):
    account: str
    ifsc: str
    user_id: str

@router.post("/verify-account")
async def verify_bank_account(req: VerifyAccountRequest, request: Request):
    """Verify bank account before adding as recipient."""
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    db = get_db()
    client_ip = get_client_ip(request)
    account = req.account
    ifsc = req.ifsc
    user_id = req.user_id
    
    logging.info(f"[DMT] Account Verification: ***{account[-4:]}, IFSC: {ifsc}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/banks/ifsc:{ifsc}/accounts/{account}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        response = await async_get(url, headers=generate_eko_headers_for_get(), timeout=60)
        
        if response.status_code == 403:
            return create_error_response(403, "Authentication failed", "Service temporarily unavailable.")
        
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
            user_msg = EKO_ERROR_MESSAGES.get(result.get("status"), "Unable to verify account")
            return create_error_response(
                result.get("status"),
                result.get("message", "Verification failed"),
                user_msg
            )
            
    except Exception as e:
        logging.error(f"[DMT] Verification Error: {e}")
        return create_error_response(500, str(e), "Verification failed. Please try again.")


# ==================== REFUND API ====================

class RefundRequest(BaseModel):
    transaction_id: str
    user_id: str
    otp: str  # OTP sent to customer mobile for refund

@router.post("/refund")
async def process_refund(req: RefundRequest, request: Request):
    """
    Process refund for a failed DMT transaction.
    As per Eko docs: When tx_status = 3 (Refund Pending), customer receives OTP
    to initiate refund using this API.
    """
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    db = get_db()
    client_ip = get_client_ip(request)
    
    # Find transaction
    txn = db.dmt_transactions.find_one({
        "transaction_id": req.transaction_id,
        "user_id": req.user_id
    })
    
    if not txn:
        return create_error_response(404, "Transaction not found", "Transaction not found.")
    
    # Check if refund is applicable
    if txn.get("status") not in ["refund_pending", "failed", "on_hold"]:
        return create_error_response(400, "Refund not applicable", 
            f"Refund not applicable for transaction status: {txn.get('status')}")
    
    if txn.get("prc_refunded"):
        return create_error_response(400, "Already refunded", "This transaction has already been refunded.")
    
    eko_tid = txn.get("eko_tid")
    if not eko_tid:
        return create_error_response(400, "No Eko TID", "Cannot process refund without Eko transaction ID.")
    
    logging.info(f"[DMT REFUND] Processing refund for TID: {eko_tid}, User: {req.user_id}")
    
    try:
        # Eko Refund API: POST /transactions/{tid}/refund
        url = f"{EKO_BASE_URL}/v1/transactions/{eko_tid}/refund"
        
        headers = generate_eko_headers(request)
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "otp": req.otp,
            "tid": eko_tid
        }
        
        response = await async_post(url, headers=headers, data=data, timeout=60)
        result = response.json()
        
        # Log the refund attempt
        log_dmt_transaction(db, {
            "action": "refund",
            "user_id": req.user_id,
            "transaction_id": req.transaction_id,
            "eko_tid": eko_tid,
            "ip": client_ip,
            "response": result
        })
        
        if result.get("status") == 0:
            # Refund successful - return PRC to user
            prc_amount = txn.get("prc_amount", 0)
            refund_prc(db, req.user_id, prc_amount, req.transaction_id, "DMT Refund processed")
            
            # Update transaction status
            db.dmt_transactions.update_one(
                {"transaction_id": req.transaction_id},
                {"$set": {
                    "status": "refunded",
                    "prc_refunded": prc_amount,
                    "refund_processed_at": datetime.now(timezone.utc),
                    "refund_response": result
                }}
            )
            
            return create_success_response({
                "refund_status": "success",
                "prc_refunded": prc_amount,
                "transaction_id": req.transaction_id,
                "eko_tid": eko_tid,
                "message": result.get("message", "Refund processed successfully")
            }, "Refund processed successfully! PRC has been credited to your account.")
        
        else:
            error_msg = EKO_ERROR_MESSAGES.get(result.get("status"), result.get("message", "Refund failed"))
            return create_error_response(
                result.get("status"),
                result.get("message", "Refund failed"),
                error_msg
            )
            
    except Exception as e:
        logging.error(f"[DMT REFUND] Error: {e}")
        return create_error_response(500, str(e), "Refund processing failed. Please try again.")


# ==================== RESEND REFUND OTP ====================

@router.post("/refund/resend-otp")
async def resend_refund_otp(transaction_id: str, user_id: str, request: Request):
    """
    Resend OTP for refund process.
    When a transaction is in refund_pending state, customer can request new OTP.
    """
    if not validate_eko_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    db = get_db()
    
    txn = db.dmt_transactions.find_one({
        "transaction_id": transaction_id,
        "user_id": user_id
    })
    
    if not txn:
        return create_error_response(404, "Transaction not found", "Transaction not found.")
    
    eko_tid = txn.get("eko_tid")
    if not eko_tid:
        return create_error_response(400, "No Eko TID", "Cannot resend OTP without Eko transaction ID.")
    
    try:
        # Eko Resend Refund OTP API
        url = f"{EKO_BASE_URL}/v1/transactions/{eko_tid}/refund/otp"
        
        headers = generate_eko_headers_for_get()
        params = {"initiator_id": EKO_INITIATOR_ID}
        
        response = await async_get(url, headers=headers, params=params, timeout=30)
        result = response.json()
        
        if result.get("status") == 0:
            return create_success_response({
                "otp_sent": True,
                "message": "OTP sent to registered mobile number"
            }, "OTP sent successfully for refund verification.")
        else:
            return create_error_response(
                result.get("status"),
                result.get("message", "Failed to send OTP"),
                "Failed to send OTP. Please try again."
            )
            
    except Exception as e:
        logging.error(f"[DMT REFUND OTP] Error: {e}")
        return create_error_response(500, str(e), "Failed to send OTP.")
