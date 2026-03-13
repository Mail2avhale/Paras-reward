"""
PARAS REWARD - EKO DMT V3 Levin API Service
============================================
Based on: https://developers.eko.in/v3/reference/levin-dmt-flow

This service implements the Eko V3 Levin DMT flow which REQUIRES OTP for every transaction.

V3 LEVIN FLOW (Mandatory OTP):
1. Get Sender Info (Check if customer exists)
2. Onboard Sender (Register new customer)
3. Add Recipient (Bank account)
4. Send Transaction OTP → OTP sent to sender mobile
5. Initiate Transaction with OTP → Transfer complete

IMPORTANT: V3 requires 2-step transfer:
- Step 1: Send OTP (POST /ekoapi/v3/customer/payment/ppi/otp)
- Step 2: Transfer with OTP (POST /ekoapi/v3/customer/payment/dmt-levin)

API Endpoints (Production):
- Base URL: https://api.eko.in:25002
- OTP: POST /ekoapi/v3/customer/payment/ppi/otp
- Transfer: POST /ekoapi/v3/customer/payment/dmt-levin
- Inquiry: GET /ekoapi/v2/transactions

Note: V1 API is deprecated and returns "Refund Pending" for all transfers.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import httpx
import base64
import hashlib
import hmac
import time
import uuid
import logging
import os
from bson import ObjectId
from pymongo import MongoClient

# Router
router = APIRouter(prefix="/eko/dmt-v3", tags=["DMT V3 Levin"])

# Database (set from server.py)
db = None

def set_db(database):
    global db
    db = database

# ==================== CONFIGURATION ====================

# Eko V3 API Configuration
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_V3_BASE = "https://api.eko.in:25002"  # V3 API base
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID")
EKO_AUTH_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE")

# Database
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# PRC Config
DEFAULT_PRC_TO_INR_RATE = 100
MIN_TRANSFER_INR = 100
DEFAULT_DAILY_LIMIT = 25000

# Request timeout
REQUEST_TIMEOUT = 60

# Async HTTP client
_http_client: Optional[httpx.AsyncClient] = None

def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    return _http_client

# ==================== VALIDATION ====================

def validate_config():
    """Validate Eko configuration"""
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
        logging.error(f"[DMT-V3] Missing: {', '.join(missing)}")
        return False
    return True

# ==================== AUTHENTICATION ====================

def generate_secret_key(timestamp_ms: str) -> str:
    """
    Generate Eko secret-key as per V3 documentation.
    
    Formula:
    1. Base64 encode the authenticator key
    2. HMAC-SHA256(base64_key, timestamp_ms)
    3. Base64 encode result
    """
    if not EKO_AUTH_KEY:
        raise ValueError("EKO_AUTHENTICATOR_KEY not set")
    
    # Base64 encode key (as bytes)
    encoded_key = base64.b64encode(EKO_AUTH_KEY.encode('utf-8'))
    
    # HMAC-SHA256
    signature = hmac.new(
        encoded_key,
        timestamp_ms.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Base64 encode signature
    return base64.b64encode(signature).decode('utf-8')


def get_v3_headers() -> Dict[str, str]:
    """Generate V3 API headers"""
    if not validate_config():
        raise ValueError("Eko configuration not set")
    
    timestamp_ms = str(int(time.time() * 1000))
    secret_key = generate_secret_key(timestamp_ms)
    
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp_ms,
        "Content-Type": "application/x-www-form-urlencoded"
    }


def get_v3_headers_get() -> Dict[str, str]:
    """Generate V3 API headers for GET requests (no Content-Type)"""
    headers = get_v3_headers()
    del headers["Content-Type"]
    return headers

# ==================== DATABASE HELPERS ====================

def get_sync_db():
    """Get sync MongoDB connection"""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def get_prc_rate():
    """Get PRC to INR rate"""
    try:
        from routes.prc_economy import get_dynamic_rate_sync
        return get_dynamic_rate_sync()
    except Exception:
        return DEFAULT_PRC_TO_INR_RATE


def get_dmt_settings(sync_db):
    """Get DMT settings from database"""
    settings = sync_db.dmt_v3_settings.find_one({"_id": "dmt_v3_config"})
    if not settings:
        default = {
            "_id": "dmt_v3_config",
            "enabled": True,
            "daily_limit_inr": DEFAULT_DAILY_LIMIT,
            "min_transfer_inr": MIN_TRANSFER_INR,
            "created_at": datetime.now(timezone.utc)
        }
        sync_db.dmt_v3_settings.insert_one(default)
        return default
    return settings


def is_dmt_enabled():
    """Check if DMT V3 is enabled"""
    sync_db = get_sync_db()
    settings = get_dmt_settings(sync_db)
    return settings.get("enabled", True)

# ==================== REQUEST MODELS ====================

class CustomerSearchRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    user_id: str
    
    @validator('mobile')
    def validate_mobile(cls, v):
        if not v.isdigit():
            raise ValueError('Mobile must be numeric')
        return v


class CustomerRegisterRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    name: str = Field(..., min_length=2, max_length=100)
    user_id: str


class AddRecipientRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    recipient_name: str = Field(..., min_length=2, max_length=100)
    account_number: str = Field(..., min_length=8, max_length=20)
    ifsc: str = Field(..., min_length=11, max_length=11)
    user_id: str
    
    @validator('ifsc')
    def validate_ifsc(cls, v):
        return v.upper()
    
    @validator('account_number')
    def validate_account(cls, v):
        if not v.isdigit():
            raise ValueError('Account number must be numeric')
        return v


class SendOTPRequest(BaseModel):
    """Request to send transaction OTP - V3 MANDATORY"""
    user_id: str
    mobile: str = Field(..., min_length=10, max_length=10)
    recipient_id: str
    amount_inr: float = Field(..., ge=100)


class TransferRequest(BaseModel):
    """Execute transfer with OTP - V3 MANDATORY"""
    user_id: str
    mobile: str = Field(..., min_length=10, max_length=10)
    recipient_id: str
    amount_inr: float = Field(..., ge=100)
    otp: str = Field(..., min_length=4, max_length=6)
    otp_ref_id: str

# ==================== RESPONSE HELPERS ====================

def success_response(data: Dict, message: str = "Success") -> Dict:
    return {
        "success": True,
        "status": "SUCCESS",
        "message": message,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


def error_response(code: int, message: str, user_message: str = None) -> Dict:
    return {
        "success": False,
        "status": "FAILED",
        "error_code": code,
        "message": message,
        "user_message": user_message or message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ==================== DAILY LIMIT CHECK ====================

async def check_daily_limit(user_id: str) -> tuple:
    """Check user's daily transfer limit"""
    if db is None:
        return False, 0, 0
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "status": {"$in": ["completed", "processing", "pending", "otp_sent"]},
                "created_at": {"$gte": today_start.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_inr": {"$sum": "$amount_inr"}
            }
        }
    ]
    
    result = await db.dmt_v3_transactions.aggregate(pipeline).to_list(1)
    used_today = result[0]["total_inr"] if result else 0
    
    sync_db = get_sync_db()
    settings = get_dmt_settings(sync_db)
    max_daily = settings.get("daily_limit_inr", DEFAULT_DAILY_LIMIT)
    remaining = max_daily - used_today
    
    return remaining > 0, remaining, used_today

# ==================== LOGGING ====================

async def log_transaction(log_data: Dict):
    """Log DMT transaction"""
    if db is None:
        return
    log_data["timestamp"] = datetime.now(timezone.utc).isoformat()
    await db.dmt_v3_logs.insert_one(log_data)

# ==================== V3 API ENDPOINTS ====================

@router.get("/health")
def health_check():
    """DMT V3 Service Health Check"""
    config_valid = validate_config()
    sync_db = get_sync_db()
    settings = get_dmt_settings(sync_db)
    
    return {
        "status": "DMT V3 LEVIN SERVICE RUNNING" if config_valid else "CONFIG ERROR",
        "api_version": "V3 Levin",
        "enabled": settings.get("enabled", True),
        "config_valid": config_valid,
        "daily_limit_inr": settings.get("daily_limit_inr", DEFAULT_DAILY_LIMIT),
        "min_transfer_inr": MIN_TRANSFER_INR,
        "otp_required": True,  # V3 ALWAYS requires OTP
        "flow": "Send OTP → Enter OTP → Transfer"
    }


@router.get("/wallet/{user_id}")
async def get_wallet(user_id: str):
    """Get user's PRC wallet balance"""
    sync_db = get_sync_db()
    
    user = sync_db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prc_balance = user.get("prc_balance", 0)
    prc_rate = get_prc_rate()
    inr_equivalent = prc_balance / prc_rate
    
    is_allowed, remaining, used = await check_daily_limit(user_id)
    settings = get_dmt_settings(sync_db)
    
    return success_response({
        "prc_balance": prc_balance,
        "inr_equivalent": round(inr_equivalent, 2),
        "prc_rate": prc_rate,
        "daily_limit_inr": settings.get("daily_limit_inr", DEFAULT_DAILY_LIMIT),
        "used_today_inr": used,
        "remaining_limit_inr": max(0, remaining),
        "min_transfer_inr": MIN_TRANSFER_INR,
        "can_transfer": inr_equivalent >= MIN_TRANSFER_INR and is_dmt_enabled(),
        "dmt_enabled": is_dmt_enabled()
    })


@router.post("/customer/search")
async def search_customer(req: CustomerSearchRequest, request: Request):
    """
    Search for customer in Eko system.
    Uses V1 API for customer lookup (works same in V3).
    """
    if not validate_config():
        return error_response(500, "Configuration error", "Service unavailable")
    
    logging.info(f"[DMT-V3] Customer Search: {req.mobile}")
    
    try:
        # V1 customer search still works for V3
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        client = get_http_client()
        response = await client.get(url, headers=get_v3_headers_get(), timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT-V3] Search Response: {response.status_code}")
        
        if response.status_code == 403:
            return error_response(403, "Authentication failed", "Service unavailable")
        
        result = response.json()
        eko_status = result.get("status")
        
        # Log search
        await log_transaction({
            "action": "customer_search",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "eko_status": eko_status,
            "response": result
        })
        
        if eko_status == 0:
            # Customer found
            data = result.get("data", {})
            return success_response({
                "customer_exists": True,
                "customer_id": data.get("customer_id"),
                "mobile": req.mobile,
                "name": data.get("name"),
                "available_limit": data.get("available_limit", 25000),
                "used_limit": data.get("used_limit", 0),
                "state": data.get("state"),
                "state_desc": data.get("state_desc"),
                "message": "Customer found. आता recipient select करून OTP मागवा."
            }, "Customer found")
        
        elif eko_status == 463:
            # Not registered
            return success_response({
                "customer_exists": False,
                "mobile": req.mobile,
                "message": "Customer नोंदणीकृत नाही. Registration करा."
            }, "Registration required")
        
        else:
            return error_response(eko_status, result.get("message", "Search failed"))
    
    except Exception as e:
        logging.error(f"[DMT-V3] Search Error: {e}")
        return error_response(500, str(e), "Search failed")


@router.post("/customer/register")
async def register_customer(req: CustomerRegisterRequest, request: Request):
    """
    Register new customer in Eko system.
    Uses V1 API for registration.
    """
    if not validate_config():
        return error_response(500, "Configuration error", "Service unavailable")
    
    logging.info(f"[DMT-V3] Register: {req.mobile}, Name: {req.name}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "name": req.name.upper(),
            "user_code": EKO_USER_CODE
        }
        
        client = get_http_client()
        response = await client.put(url, headers=get_v3_headers(), data=payload, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT-V3] Register Response: {response.status_code}")
        
        if response.status_code == 403:
            return error_response(403, "Authentication failed", "Service unavailable")
        
        result = response.json()
        eko_status = result.get("status")
        data = result.get("data", {})
        
        await log_transaction({
            "action": "customer_register",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "name": req.name,
            "eko_status": eko_status,
            "response": result
        })
        
        if eko_status == 0:
            return success_response({
                "registered": True,
                "customer_id": data.get("customer_id"),
                "mobile": req.mobile,
                "name": req.name,
                "state": data.get("state"),
                "message": "Registration पूर्ण! आता recipient add करा."
            }, "Customer registered")
        
        else:
            return error_response(eko_status, result.get("message", "Registration failed"))
    
    except Exception as e:
        logging.error(f"[DMT-V3] Register Error: {e}")
        return error_response(500, str(e), "Registration failed")


@router.post("/recipient/add")
async def add_recipient(req: AddRecipientRequest, request: Request):
    """
    Add bank account as recipient.
    Uses V1 API format.
    """
    if not validate_config():
        return error_response(500, "Configuration error", "Service unavailable")
    
    sync_db = get_sync_db()
    logging.info(f"[DMT-V3] Add Recipient: {req.recipient_name}, IFSC: {req.ifsc}")
    
    try:
        # V1 URL format: acc_ifsc:{account}_{ifsc_lowercase}
        ifsc_lower = req.ifsc.lower()
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}/recipients/acc_ifsc:{req.account_number}_{ifsc_lower}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        payload = {
            "recipient_name": req.recipient_name.upper(),
            "recipient_mobile": req.mobile,
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        client = get_http_client()
        response = await client.put(url, headers=get_v3_headers(), data=payload, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT-V3] Add Recipient Response: {response.status_code}")
        
        result = response.json()
        eko_status = result.get("status")
        data = result.get("data", {})
        
        await log_transaction({
            "action": "add_recipient",
            "user_id": req.user_id,
            "mobile": req.mobile,
            "recipient_name": req.recipient_name,
            "account": f"***{req.account_number[-4:]}",
            "ifsc": req.ifsc,
            "eko_status": eko_status,
            "response": result
        })
        
        if eko_status == 0 or eko_status == 342:  # 342 = already exists
            recipient_id = data.get("recipient_id")
            
            # Save locally
            sync_db.dmt_v3_recipients.update_one(
                {"user_id": req.user_id, "account_number": req.account_number},
                {
                    "$set": {
                        "recipient_id": recipient_id,
                        "recipient_name": req.recipient_name.upper(),
                        "account_number": req.account_number,
                        "ifsc": req.ifsc,
                        "mobile": req.mobile,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                upsert=True
            )
            
            return success_response({
                "recipient_id": recipient_id,
                "recipient_name": req.recipient_name.upper(),
                "account_masked": f"***{req.account_number[-4:]}",
                "ifsc": req.ifsc,
                "message": "Recipient added! आता OTP मागवा transfer साठी."
            }, "Recipient added")
        
        else:
            return error_response(eko_status, result.get("message", "Failed to add recipient"))
    
    except Exception as e:
        logging.error(f"[DMT-V3] Add Recipient Error: {e}")
        return error_response(500, str(e), "Failed to add recipient")


@router.get("/recipients/{mobile}")
async def get_recipients(mobile: str, user_id: str):
    """Get list of recipients for customer"""
    if not validate_config():
        return error_response(500, "Configuration error", "Service unavailable")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{mobile}/recipients?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        client = get_http_client()
        response = await client.get(url, headers=get_v3_headers_get(), timeout=REQUEST_TIMEOUT)
        
        if response.status_code == 404:
            return success_response({
                "count": 0,
                "recipients": [],
                "message": "No recipients. कृपया bank account add करा."
            }, "No recipients")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            recipients = data.get("recipient_list", []) if isinstance(data, dict) else data
            
            formatted = []
            for r in recipients:
                formatted.append({
                    "recipient_id": r.get("recipient_id"),
                    "recipient_name": r.get("recipient_name"),
                    "account_number": r.get("account"),
                    "account_masked": f"***{r.get('account', '')[-4:]}",
                    "ifsc": r.get("ifsc"),
                    "bank_name": r.get("bank_name"),
                    "is_verified": r.get("is_verified", False)
                })
            
            return success_response({
                "count": len(formatted),
                "recipients": formatted
            }, f"Found {len(formatted)} recipients")
        
        return success_response({"count": 0, "recipients": []}, "No recipients")
    
    except Exception as e:
        logging.error(f"[DMT-V3] Get Recipients Error: {e}")
        return error_response(500, str(e), "Failed to load recipients")


# ==================== V3 TRANSFER FLOW ====================

@router.post("/send-otp")
async def send_transaction_otp(req: SendOTPRequest, request: Request):
    """
    STEP 1: Send OTP for transaction.
    
    V3 API: POST /ekoapi/v3/customer/payment/ppi/otp
    
    This is MANDATORY before every transfer in V3 API.
    """
    if not validate_config():
        return error_response(500, "Configuration error", "Service unavailable")
    
    if not is_dmt_enabled():
        return error_response(503, "DMT disabled", "DMT service सध्या बंद आहे.")
    
    sync_db = get_sync_db()
    
    # Check user and balance
    user = sync_db.users.find_one({"uid": req.user_id})
    if not user:
        return error_response(404, "User not found", "User not found")
    
    prc_rate = get_prc_rate()
    prc_required = req.amount_inr * prc_rate
    prc_balance = user.get("prc_balance", 0)
    
    if prc_balance < prc_required:
        return error_response(400, "Insufficient balance", f"कमी PRC balance. आवश्यक: {int(prc_required)}")
    
    # Check daily limit
    is_allowed, remaining, _ = await check_daily_limit(req.user_id)
    if req.amount_inr > remaining:
        return error_response(400, "Daily limit exceeded", f"Daily limit पूर्ण. शिल्लक: ₹{int(remaining)}")
    
    logging.info(f"[DMT-V3] Send OTP: ₹{req.amount_inr} to recipient {req.recipient_id}")
    
    try:
        # V3 API endpoint for OTP
        url = f"{EKO_V3_BASE}/ekoapi/v3/customer/payment/ppi/otp"
        
        headers = get_v3_headers()
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": req.mobile,
            "recipient_id": req.recipient_id,
            "beneficiary_id": req.recipient_id,  # Same as recipient_id
            "amount": str(int(req.amount_inr)),
            "service_code": "80"  # Fixed for Levin DMT
        }
        
        logging.info(f"[DMT-V3] OTP URL: {url}")
        logging.info(f"[DMT-V3] OTP Payload: {payload}")
        
        client = get_http_client()
        response = await client.post(url, headers=headers, data=payload, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT-V3] OTP Response: {response.status_code}")
        logging.info(f"[DMT-V3] OTP Response Body: {response.text[:500]}")
        
        if response.status_code == 403:
            return error_response(403, "Authentication failed", "Service unavailable")
        
        result = response.json()
        eko_status = result.get("status", result.get("response_status_id"))
        data = result.get("data", {})
        
        # Generate transaction ID
        txn_id = f"DMTV3-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6].upper()}"
        
        # Log OTP request
        await log_transaction({
            "action": "send_otp",
            "txn_id": txn_id,
            "user_id": req.user_id,
            "mobile": req.mobile,
            "recipient_id": req.recipient_id,
            "amount_inr": req.amount_inr,
            "eko_status": eko_status,
            "response": result
        })
        
        # Check for success
        if eko_status in [0, "0"]:
            otp_ref_id = data.get("otp_ref_id", "")
            
            # Create pending transaction
            await db.dmt_v3_transactions.insert_one({
                "txn_id": txn_id,
                "user_id": req.user_id,
                "mobile": req.mobile,
                "recipient_id": req.recipient_id,
                "amount_inr": req.amount_inr,
                "prc_amount": prc_required,
                "otp_ref_id": otp_ref_id,
                "status": "otp_sent",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            return success_response({
                "txn_id": txn_id,
                "otp_sent": True,
                "otp_ref_id": otp_ref_id,
                "amount_inr": req.amount_inr,
                "prc_required": int(prc_required),
                "message": f"📱 OTP पाठवला! {req.mobile} वर SMS तपासा."
            }, "OTP sent to customer mobile")
        
        else:
            return error_response(
                eko_status,
                result.get("message", "OTP पाठवता आला नाही"),
                result.get("message", "OTP पाठवता आला नाही. पुन्हा प्रयत्न करा.")
            )
    
    except httpx.TimeoutException:
        return error_response(504, "Timeout", "Request timeout. पुन्हा प्रयत्न करा.")
    except Exception as e:
        logging.error(f"[DMT-V3] Send OTP Error: {e}")
        return error_response(500, str(e), "OTP पाठवता आला नाही.")


@router.post("/transfer")
async def execute_transfer(req: TransferRequest, request: Request):
    """
    STEP 2: Execute transfer with OTP.
    
    V3 API: POST /ekoapi/v3/customer/payment/dmt-levin
    
    This MUST be called with OTP received from send-otp endpoint.
    """
    if not validate_config():
        return error_response(500, "Configuration error", "Service unavailable")
    
    if not is_dmt_enabled():
        return error_response(503, "DMT disabled", "DMT service सध्या बंद आहे.")
    
    sync_db = get_sync_db()
    
    # Validate user
    user = sync_db.users.find_one({"uid": req.user_id})
    if not user:
        return error_response(404, "User not found", "User not found")
    
    # Check balance
    prc_rate = get_prc_rate()
    prc_required = req.amount_inr * prc_rate
    prc_balance = user.get("prc_balance", 0)
    
    if prc_balance < prc_required:
        return error_response(400, "Insufficient balance", f"कमी PRC balance. आवश्यक: {int(prc_required)}")
    
    # Generate client_ref_id
    client_ref_id = f"PR{int(time.time())}{uuid.uuid4().hex[:4].upper()}"
    
    logging.info(f"[DMT-V3] Transfer: ₹{req.amount_inr} with OTP to recipient {req.recipient_id}")
    
    # DEDUCT PRC FIRST
    new_balance = prc_balance - prc_required
    sync_db.users.update_one(
        {"uid": req.user_id},
        {
            "$set": {"prc_balance": new_balance},
            "$push": {
                "prc_transactions": {
                    "type": "dmt_v3_debit",
                    "amount": -prc_required,
                    "reference": client_ref_id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    logging.info(f"[DMT-V3] PRC Deducted: {int(prc_required)}, New Balance: {int(new_balance)}")
    
    try:
        # V3 API endpoint for transfer
        url = f"{EKO_V3_BASE}/ekoapi/v3/customer/payment/dmt-levin"
        
        headers = get_v3_headers()
        
        # Current timestamp for Eko
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": req.mobile,
            "recipient_id": req.recipient_id,
            "amount": str(int(req.amount_inr)),
            "timestamp": timestamp,
            "currency": "INR",
            "client_ref_id": client_ref_id,
            "channel": "2",  # IMPS
            "state": "1",
            "latlong": "19.9975,73.7898",
            "recipient_id_type": "1",
            "otp": req.otp,
            "otp_ref_id": req.otp_ref_id
        }
        
        logging.info(f"[DMT-V3] Transfer URL: {url}")
        logging.info(f"[DMT-V3] Transfer Payload: {payload}")
        
        client = get_http_client()
        response = await client.post(url, headers=headers, data=payload, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[DMT-V3] Transfer Response: {response.status_code}")
        logging.info(f"[DMT-V3] Transfer Response Body: {response.text[:800]}")
        
        result = response.json()
        eko_status = result.get("status", result.get("response_status_id"))
        data = result.get("data", {})
        tx_status = data.get("tx_status")
        eko_tid = data.get("tid", "")
        bank_ref = data.get("bank_ref_num", "")
        eko_message = result.get("message", "")
        
        # Log transaction
        await log_transaction({
            "action": "transfer",
            "client_ref_id": client_ref_id,
            "user_id": req.user_id,
            "mobile": req.mobile,
            "recipient_id": req.recipient_id,
            "amount_inr": req.amount_inr,
            "prc_amount": prc_required,
            "eko_status": eko_status,
            "tx_status": tx_status,
            "tid": eko_tid,
            "bank_ref": bank_ref,
            "response": result
        })
        
        # Save transaction
        txn_doc = {
            "txn_id": client_ref_id,
            "user_id": req.user_id,
            "mobile": req.mobile,
            "recipient_id": req.recipient_id,
            "amount_inr": req.amount_inr,
            "prc_amount": prc_required,
            "eko_tid": eko_tid,
            "bank_ref": bank_ref,
            "eko_status": eko_status,
            "tx_status": tx_status,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Parse result
        # tx_status meanings:
        # 0 = Success
        # 1 = Fail
        # 2 = Initiated (Pending)
        # 3 = Refund Pending
        # 4 = Refunded
        # 5 = Hold
        
        try:
            tx_status_int = int(tx_status) if tx_status is not None else -1
        except (ValueError, TypeError):
            tx_status_int = -1
        
        if eko_status in [0, "0"] and tx_status_int == 0:
            # SUCCESS!
            txn_doc["status"] = "completed"
            await db.dmt_v3_transactions.insert_one(txn_doc)
            
            return success_response({
                "txn_id": client_ref_id,
                "eko_tid": eko_tid,
                "status": "SUCCESS",
                "amount_inr": req.amount_inr,
                "prc_deducted": int(prc_required),
                "new_prc_balance": int(new_balance),
                "bank_ref": bank_ref,
                "message": "✅ Transfer successful! पैसे bank account मध्ये पोहोचले."
            }, "Transfer successful!")
        
        elif tx_status_int == 1:
            # FAILED - Refund PRC
            txn_doc["status"] = "failed"
            txn_doc["prc_refunded"] = prc_required
            await db.dmt_v3_transactions.insert_one(txn_doc)
            
            refund_prc(sync_db, req.user_id, prc_required, client_ref_id, "Transfer failed")
            
            return error_response(
                eko_status,
                "Transfer failed",
                f"❌ Transfer failed. {int(prc_required)} PRC refunded."
            )
        
        elif tx_status_int == 2:
            # PENDING - Keep PRC deducted
            txn_doc["status"] = "pending"
            await db.dmt_v3_transactions.insert_one(txn_doc)
            
            return success_response({
                "txn_id": client_ref_id,
                "eko_tid": eko_tid,
                "status": "PENDING",
                "amount_inr": req.amount_inr,
                "prc_deducted": int(prc_required),
                "message": "⏳ Transfer processing. Status थोड्या वेळात update होईल."
            }, "Transfer pending")
        
        elif tx_status_int in [3, 4]:
            # REFUND PENDING/REFUNDED
            txn_doc["status"] = "refund_pending" if tx_status_int == 3 else "refunded"
            txn_doc["prc_refunded"] = prc_required
            await db.dmt_v3_transactions.insert_one(txn_doc)
            
            refund_prc(sync_db, req.user_id, prc_required, client_ref_id, "Bank refund")
            
            return error_response(
                eko_status,
                "Transfer refunded by bank",
                f"❌ Bank ने transfer refund केला. {int(prc_required)} PRC परत मिळाले."
            )
        
        else:
            # Unknown status or error - Refund to be safe
            txn_doc["status"] = "error"
            txn_doc["error_message"] = eko_message
            txn_doc["prc_refunded"] = prc_required
            await db.dmt_v3_transactions.insert_one(txn_doc)
            
            refund_prc(sync_db, req.user_id, prc_required, client_ref_id, f"Error: {eko_message}")
            
            return error_response(
                eko_status or 500,
                eko_message or "Transfer failed",
                f"❌ Transfer failed. {int(prc_required)} PRC refunded. Error: {eko_message}"
            )
    
    except httpx.TimeoutException:
        # Timeout - Don't auto-refund, need to check status
        await db.dmt_v3_transactions.insert_one({
            "txn_id": client_ref_id,
            "user_id": req.user_id,
            "mobile": req.mobile,
            "recipient_id": req.recipient_id,
            "amount_inr": req.amount_inr,
            "prc_amount": prc_required,
            "status": "timeout",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return error_response(
            504,
            "Timeout",
            "⏳ Transfer timeout. Status check करा. PRC deducted आहे."
        )
    
    except Exception as e:
        logging.error(f"[DMT-V3] Transfer Error: {e}")
        
        # Error - Refund PRC
        refund_prc(sync_db, req.user_id, prc_required, client_ref_id, f"System error: {str(e)}")
        
        return error_response(500, str(e), f"❌ Error. {int(prc_required)} PRC refunded.")


def refund_prc(sync_db, user_id: str, amount: float, ref_id: str, reason: str):
    """Refund PRC to user"""
    sync_db.users.update_one(
        {"uid": user_id},
        {
            "$inc": {"prc_balance": amount},
            "$push": {
                "prc_transactions": {
                    "type": "dmt_v3_refund",
                    "amount": amount,
                    "reference": ref_id,
                    "reason": reason,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    logging.info(f"[DMT-V3] PRC Refunded: {int(amount)} to user {user_id}")


# ==================== STATUS CHECK ====================

@router.get("/status/{txn_id}")
async def get_transaction_status(txn_id: str, user_id: str):
    """Check transaction status"""
    sync_db = get_sync_db()
    
    # Find local transaction
    txn = await db.dmt_v3_transactions.find_one(
        {"txn_id": txn_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not txn:
        return error_response(404, "Transaction not found", "Transaction सापडले नाही")
    
    # If pending/timeout, check with Eko
    if txn.get("status") in ["pending", "timeout", "otp_sent"]:
        eko_tid = txn.get("eko_tid")
        if eko_tid:
            try:
                url = f"{EKO_V3_BASE}/ekoapi/v2/transactions?client_ref_id={txn_id}"
                
                client = get_http_client()
                response = await client.get(url, headers=get_v3_headers_get(), timeout=30)
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("status") == 0:
                        data = result.get("data", {})
                        tx_status = data.get("tx_status")
                        
                        status_map = {
                            0: "completed",
                            1: "failed",
                            2: "pending",
                            3: "refund_pending",
                            4: "refunded"
                        }
                        
                        new_status = status_map.get(tx_status, txn.get("status"))
                        
                        await db.dmt_v3_transactions.update_one(
                            {"txn_id": txn_id},
                            {"$set": {
                                "status": new_status,
                                "tx_status": tx_status,
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                        
                        # Refund if failed
                        if new_status in ["failed", "refunded"] and not txn.get("prc_refunded"):
                            refund_prc(sync_db, user_id, txn.get("prc_amount", 0), txn_id, "Transfer failed")
                        
                        txn["status"] = new_status
            except Exception as e:
                logging.error(f"[DMT-V3] Status check error: {e}")
    
    return success_response({
        "txn_id": txn_id,
        "status": txn.get("status"),
        "amount_inr": txn.get("amount_inr"),
        "prc_amount": txn.get("prc_amount"),
        "eko_tid": txn.get("eko_tid"),
        "bank_ref": txn.get("bank_ref"),
        "created_at": txn.get("created_at")
    })


@router.get("/transactions/{user_id}")
async def get_user_transactions(user_id: str, limit: int = 20, skip: int = 0):
    """Get user's transaction history"""
    transactions = await db.dmt_v3_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.dmt_v3_transactions.count_documents({"user_id": user_id})
    
    return success_response({
        "transactions": transactions,
        "total": total,
        "skip": skip,
        "limit": limit
    })


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/settings")
async def get_admin_settings():
    """Get DMT V3 settings"""
    sync_db = get_sync_db()
    settings = get_dmt_settings(sync_db)
    settings.pop("_id", None)
    return success_response(settings)


@router.post("/admin/enable")
async def enable_dmt():
    """Enable DMT V3 service"""
    sync_db = get_sync_db()
    sync_db.dmt_v3_settings.update_one(
        {"_id": "dmt_v3_config"},
        {"$set": {"enabled": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return success_response({"enabled": True}, "DMT V3 enabled")


@router.post("/admin/disable")
async def disable_dmt():
    """Disable DMT V3 service"""
    sync_db = get_sync_db()
    sync_db.dmt_v3_settings.update_one(
        {"_id": "dmt_v3_config"},
        {"$set": {"enabled": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return success_response({"enabled": False}, "DMT V3 disabled")


@router.post("/admin/set-limit")
async def set_daily_limit(limit_inr: int):
    """Set daily transfer limit"""
    if limit_inr < 100 or limit_inr > 200000:
        raise HTTPException(status_code=400, detail="Limit must be between ₹100 and ₹2,00,000")
    
    sync_db = get_sync_db()
    sync_db.dmt_v3_settings.update_one(
        {"_id": "dmt_v3_config"},
        {"$set": {"daily_limit_inr": limit_inr, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return success_response({"daily_limit_inr": limit_inr}, f"Daily limit set to ₹{limit_inr}")


@router.get("/admin/stats")
async def get_dmt_stats():
    """Get DMT V3 statistics"""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Today's stats
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today.isoformat()}}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_inr": {"$sum": "$amount_inr"}
        }}
    ]
    
    today_stats = await db.dmt_v3_transactions.aggregate(today_pipeline).to_list(20)
    
    # Total stats
    total = await db.dmt_v3_transactions.count_documents({})
    completed = await db.dmt_v3_transactions.count_documents({"status": "completed"})
    failed = await db.dmt_v3_transactions.count_documents({"status": "failed"})
    pending = await db.dmt_v3_transactions.count_documents({"status": {"$in": ["pending", "otp_sent"]}})
    
    return success_response({
        "today": {stat["_id"]: {"count": stat["count"], "total_inr": stat["total_inr"]} for stat in today_stats},
        "total_transactions": total,
        "completed": completed,
        "failed": failed,
        "pending": pending,
        "success_rate": round((completed / total * 100) if total > 0 else 0, 2)
    })
