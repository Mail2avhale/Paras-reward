"""
PARAS REWARD - EKO DMT v3 SERVICE
=================================
Complete implementation supporting:
- Airtel DMT Flow
- Fino DMT Flow  
- Levin DMT Flow

All flows include:
1. Sender Profile Check
2. Sender Registration with Aadhaar OTP
3. eKYC Verification
4. Recipient Management
5. Transaction OTP
6. Money Transfer
7. Transaction Status

Reference: 
- https://developers.eko.in/v3/reference/airtel-dmt-flow
- https://developers.eko.in/v3/reference/fino-dmt-flow
- https://developers.eko.in/v3/reference/levin-dmt-flow
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from enum import Enum
import requests
import base64
import hashlib
import hmac
import time
import uuid
import logging
import os
from pymongo import MongoClient

router = APIRouter(prefix="/dmt/v3", tags=["DMT v3 - Advanced Bank Transfer"])

# ==================== CONFIGURATION ====================

EKO_BASE_URL = "https://api.eko.in:25002/ekoicici"
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "7c179a397b4710e71b2248d1f5892d19")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_AUTH_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "7a2529f5-3587-4add-a2df-3d0606d62460")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")
SOURCE_IP = "34.44.149.98"

# Database
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# PRC Settings
PRC_TO_INR_RATE = 100
MIN_REDEEM_INR = 100
MAX_DAILY_INR = 5000

REQUEST_TIMEOUT = 60


# ==================== ENUMS ====================

class DMTProvider(str, Enum):
    AIRTEL = "airtel"
    FINO = "fino"
    LEVIN = "levin"


class TransferChannel(str, Enum):
    IMPS = "2"
    NEFT = "1"


# ==================== DATABASE ====================

def get_db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


# ==================== AUTHENTICATION ====================

def generate_headers() -> Dict[str, str]:
    """Generate EKO v3 authentication headers"""
    timestamp = str(int(time.time() * 1000))
    encoded_key = base64.b64encode(EKO_AUTH_KEY.encode()).decode()
    secret_key = base64.b64encode(
        hmac.new(encoded_key.encode(), timestamp.encode(), hashlib.sha256).digest()
    ).decode()
    
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/x-www-form-urlencoded"
    }


def generate_request_hash(data: str) -> str:
    """Generate request hash for secure transactions"""
    encoded_key = base64.b64encode(EKO_AUTH_KEY.encode()).decode()
    return base64.b64encode(
        hmac.new(encoded_key.encode(), data.encode(), hashlib.sha256).digest()
    ).decode()


# ==================== REQUEST MODELS ====================

class GetSenderRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    provider: DMTProvider = DMTProvider.AIRTEL
    user_id: str
    
    @validator('mobile')
    def validate_mobile(cls, v):
        if not v.isdigit():
            raise ValueError('Mobile must be numeric')
        return v


class OnboardSenderRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    name: str = Field(..., min_length=3, max_length=100)
    provider: DMTProvider = DMTProvider.AIRTEL
    user_id: str


class AadhaarOTPRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    aadhaar: str = Field(..., min_length=12, max_length=12)
    provider: DMTProvider = DMTProvider.AIRTEL
    user_id: str
    
    @validator('aadhaar')
    def validate_aadhaar(cls, v):
        if not v.isdigit() or len(v) != 12:
            raise ValueError('Aadhaar must be 12 digits')
        return v


class ValidateOTPRequest(BaseModel):
    mobile: str
    otp: str = Field(..., min_length=4, max_length=6)
    otp_ref_id: str
    provider: DMTProvider = DMTProvider.AIRTEL
    user_id: str


class AddRecipientRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    recipient_name: str = Field(..., min_length=3, max_length=100)
    account_number: str = Field(..., min_length=8, max_length=20)
    ifsc: str = Field(..., min_length=11, max_length=11)
    provider: DMTProvider = DMTProvider.AIRTEL
    user_id: str
    
    @validator('ifsc')
    def validate_ifsc(cls, v):
        return v.upper()


class SendTransactionOTPRequest(BaseModel):
    mobile: str
    amount: float = Field(..., gt=0)
    recipient_id: str
    provider: DMTProvider = DMTProvider.AIRTEL
    user_id: str


class InitiateTransactionRequest(BaseModel):
    mobile: str
    recipient_id: str
    amount: float
    otp: str
    otp_ref_id: str
    channel: TransferChannel = TransferChannel.IMPS
    provider: DMTProvider = DMTProvider.AIRTEL
    user_id: str
    prc_amount: Optional[int] = None  # If using PRC


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


def log_transaction(db, data: Dict):
    data["timestamp"] = datetime.now(timezone.utc)
    db.dmt_v3_logs.insert_one(data)


# ==================== PROVIDER URL MAPPING ====================

def get_provider_urls(provider: DMTProvider) -> Dict[str, str]:
    """Get API endpoints for each provider"""
    
    base = EKO_BASE_URL
    
    if provider == DMTProvider.AIRTEL:
        return {
            "get_sender": f"{base}/v3/customers/mobile_number:{{mobile}}",
            "onboard": f"{base}/v3/customers",
            "generate_otp": f"{base}/v3/customers/mobile_number:{{mobile}}/aadhaar/otp",
            "validate_otp": f"{base}/v3/customers/mobile_number:{{mobile}}/aadhaar/verify",
            "ekyc": f"{base}/v3/customers/mobile_number:{{mobile}}/ekyc",
            "add_recipient": f"{base}/v3/customers/mobile_number:{{mobile}}/recipients",
            "get_recipients": f"{base}/v3/customers/mobile_number:{{mobile}}/recipients",
            "send_txn_otp": f"{base}/v3/transactions/otp",
            "initiate_txn": f"{base}/v3/transactions"
        }
    
    elif provider == DMTProvider.FINO:
        return {
            "get_sender": f"{base}/v3/fino/customers/mobile_number:{{mobile}}",
            "ekyc": f"{base}/v3/fino/customers/ekyc",
            "validate_otp": f"{base}/v3/fino/customers/ekyc/verify",
            "add_recipient": f"{base}/v3/fino/customers/mobile_number:{{mobile}}/recipients",
            "get_recipients": f"{base}/v3/fino/customers/mobile_number:{{mobile}}/recipients",
            "send_txn_otp": f"{base}/v3/fino/transactions/otp",
            "initiate_txn": f"{base}/v3/fino/transactions"
        }
    
    elif provider == DMTProvider.LEVIN:
        return {
            "get_sender": f"{base}/v3/levin/customers/mobile_number:{{mobile}}",
            "onboard": f"{base}/v3/levin/customers",
            "generate_otp": f"{base}/v3/levin/customers/mobile_number:{{mobile}}/aadhaar/otp",
            "validate_otp": f"{base}/v3/levin/customers/mobile_number:{{mobile}}/aadhaar/verify",
            "ekyc": f"{base}/v3/levin/customers/mobile_number:{{mobile}}/ekyc",
            "add_recipient": f"{base}/v3/levin/customers/mobile_number:{{mobile}}/recipients",
            "get_recipients": f"{base}/v3/levin/customers/mobile_number:{{mobile}}/recipients",
            "send_txn_otp": f"{base}/v3/levin/transactions/otp",
            "initiate_txn": f"{base}/v3/levin/transactions"
        }
    
    return {}


# ==================== HEALTH CHECK ====================

@router.get("/health")
def health():
    return {
        "status": "DMT v3 SERVICE RUNNING",
        "providers": ["airtel", "fino", "levin"],
        "features": [
            "Aadhaar OTP Verification",
            "Biometric eKYC",
            "Transaction OTP",
            "IMPS/NEFT Transfer"
        ],
        "prc_rate": f"{PRC_TO_INR_RATE} PRC = ₹1"
    }


# ==================== STEP 1: GET SENDER PROFILE ====================

@router.post("/sender/profile")
async def get_sender_profile(req: GetSenderRequest, request: Request):
    """
    Check if customer is registered on EKO platform.
    
    Airtel: GET /v3/customers/mobile_number:{mobile}
    Fino: GET /v3/fino/customers/mobile_number:{mobile}
    Levin: GET /v3/levin/customers/mobile_number:{mobile}
    """
    db = get_db()
    urls = get_provider_urls(req.provider)
    
    logging.info(f"[DMT-v3] Get Sender: {req.mobile}, Provider: {req.provider}")
    
    try:
        url = urls["get_sender"].format(mobile=req.mobile)
        url += f"?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        response = requests.get(url, headers=generate_headers(), timeout=REQUEST_TIMEOUT)
        
        log_transaction(db, {
            "action": "get_sender",
            "provider": req.provider,
            "mobile": req.mobile,
            "user_id": req.user_id,
            "status_code": response.status_code
        })
        
        if response.status_code == 403:
            return error_response(403, "Authentication failed", "Service temporarily unavailable")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            return success_response({
                "registered": True,
                "mobile": req.mobile,
                "name": data.get("name"),
                "available_limit": data.get("available_limit"),
                "used_limit": data.get("used_limit"),
                "total_limit": data.get("total_limit"),
                "state": data.get("state"),
                "kyc_status": data.get("state_desc"),
                "provider": req.provider
            }, "Customer found")
        
        elif eko_status == 463:
            return success_response({
                "registered": False,
                "mobile": req.mobile,
                "provider": req.provider,
                "next_step": "onboard_sender"
            }, "Customer not registered - Onboarding required")
        
        else:
            return error_response(eko_status, result.get("message", "Failed"))
            
    except Exception as e:
        logging.error(f"[DMT-v3] Get Sender Error: {e}")
        return error_response(500, str(e))


# ==================== STEP 2: ONBOARD SENDER ====================

@router.post("/sender/onboard")
async def onboard_sender(req: OnboardSenderRequest, request: Request):
    """
    Register new customer on EKO platform.
    After this, Aadhaar verification is required.
    """
    db = get_db()
    urls = get_provider_urls(req.provider)
    
    logging.info(f"[DMT-v3] Onboard Sender: {req.mobile}, Provider: {req.provider}")
    
    try:
        url = urls.get("onboard", urls["get_sender"].replace("/mobile_number:{mobile}", ""))
        url += f"?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        payload = {
            "name": req.name,
            "mobile": req.mobile,
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "pipe": "9",
            "source_ip": SOURCE_IP
        }
        
        response = requests.put(url, data=payload, headers=generate_headers(), timeout=REQUEST_TIMEOUT)
        
        result = response.json()
        eko_status = result.get("status")
        
        log_transaction(db, {
            "action": "onboard_sender",
            "provider": req.provider,
            "mobile": req.mobile,
            "name": req.name,
            "user_id": req.user_id,
            "eko_status": eko_status
        })
        
        if eko_status == 0:
            return success_response({
                "onboarded": True,
                "mobile": req.mobile,
                "name": req.name,
                "next_step": "generate_aadhaar_otp",
                "message": "Customer registered. Aadhaar verification required."
            }, "Customer onboarded - Aadhaar verification pending")
        
        else:
            return error_response(eko_status, result.get("message", "Onboarding failed"))
            
    except Exception as e:
        logging.error(f"[DMT-v3] Onboard Error: {e}")
        return error_response(500, str(e))


# ==================== STEP 3: GENERATE AADHAAR OTP ====================

@router.post("/sender/aadhaar/otp")
async def generate_aadhaar_otp(req: AadhaarOTPRequest, request: Request):
    """
    Send OTP to Aadhaar-linked mobile for verification.
    Returns otp_ref_id needed for next step.
    """
    db = get_db()
    urls = get_provider_urls(req.provider)
    
    logging.info(f"[DMT-v3] Generate Aadhaar OTP: {req.mobile}, Provider: {req.provider}")
    
    try:
        url = urls["generate_otp"].format(mobile=req.mobile)
        url += f"?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        payload = {
            "aadhaar_number": req.aadhaar,
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "source_ip": SOURCE_IP
        }
        
        response = requests.post(url, data=payload, headers=generate_headers(), timeout=REQUEST_TIMEOUT)
        
        result = response.json()
        eko_status = result.get("status")
        
        log_transaction(db, {
            "action": "generate_aadhaar_otp",
            "provider": req.provider,
            "mobile": req.mobile,
            "aadhaar_masked": f"XXXX-XXXX-{req.aadhaar[-4:]}",
            "user_id": req.user_id,
            "eko_status": eko_status
        })
        
        if eko_status == 0:
            data = result.get("data", {})
            return success_response({
                "otp_sent": True,
                "otp_ref_id": data.get("otp_ref_id"),
                "message": "OTP sent to Aadhaar-linked mobile",
                "next_step": "validate_aadhaar_otp"
            }, "OTP sent successfully")
        
        else:
            return error_response(eko_status, result.get("message", "Failed to send OTP"))
            
    except Exception as e:
        logging.error(f"[DMT-v3] Aadhaar OTP Error: {e}")
        return error_response(500, str(e))


# ==================== STEP 4: VALIDATE AADHAAR OTP ====================

@router.post("/sender/aadhaar/verify")
async def validate_aadhaar_otp(req: ValidateOTPRequest, request: Request):
    """
    Verify Aadhaar OTP to complete registration.
    """
    db = get_db()
    urls = get_provider_urls(req.provider)
    
    logging.info(f"[DMT-v3] Validate Aadhaar OTP: {req.mobile}, Provider: {req.provider}")
    
    try:
        url = urls["validate_otp"].format(mobile=req.mobile)
        url += f"?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        payload = {
            "otp": req.otp,
            "otp_ref_id": req.otp_ref_id,
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "source_ip": SOURCE_IP
        }
        
        response = requests.post(url, data=payload, headers=generate_headers(), timeout=REQUEST_TIMEOUT)
        
        result = response.json()
        eko_status = result.get("status")
        
        log_transaction(db, {
            "action": "validate_aadhaar_otp",
            "provider": req.provider,
            "mobile": req.mobile,
            "otp_ref_id": req.otp_ref_id,
            "user_id": req.user_id,
            "eko_status": eko_status
        })
        
        if eko_status == 0:
            return success_response({
                "verified": True,
                "message": "Aadhaar verified successfully",
                "next_step": "ekyc" if req.provider != DMTProvider.FINO else "add_recipient"
            }, "Aadhaar verification successful")
        
        elif eko_status == 302:
            return error_response(302, "Wrong OTP", "Incorrect OTP. Please try again.")
        
        elif eko_status == 303:
            return error_response(303, "OTP expired", "OTP has expired. Please request a new one.")
        
        else:
            return error_response(eko_status, result.get("message", "Verification failed"))
            
    except Exception as e:
        logging.error(f"[DMT-v3] Validate OTP Error: {e}")
        return error_response(500, str(e))


# ==================== STEP 5: ADD RECIPIENT ====================

@router.post("/recipient/add")
async def add_recipient(req: AddRecipientRequest, request: Request):
    """
    Add bank account as recipient for transfer.
    """
    db = get_db()
    urls = get_provider_urls(req.provider)
    
    logging.info(f"[DMT-v3] Add Recipient: {req.recipient_name}, Provider: {req.provider}")
    
    try:
        url = urls["add_recipient"].format(mobile=req.mobile)
        url += f"?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        # Generate request hash
        timestamp = str(int(time.time() * 1000))
        hash_data = f"{timestamp}{req.account_number}{req.ifsc}"
        request_hash = generate_request_hash(hash_data)
        
        headers = generate_headers()
        headers["request_hash"] = request_hash
        
        payload = {
            "recipient_name": req.recipient_name,
            "acc_no": req.account_number,
            "ifsc": req.ifsc,
            "recipient_mobile": req.mobile,
            "recipient_type": "1",
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "source_ip": SOURCE_IP
        }
        
        response = requests.put(url, data=payload, headers=headers, timeout=REQUEST_TIMEOUT)
        
        result = response.json()
        eko_status = result.get("status")
        
        log_transaction(db, {
            "action": "add_recipient",
            "provider": req.provider,
            "mobile": req.mobile,
            "recipient_name": req.recipient_name,
            "account_masked": f"***{req.account_number[-4:]}",
            "ifsc": req.ifsc,
            "user_id": req.user_id,
            "eko_status": eko_status
        })
        
        if eko_status == 0:
            data = result.get("data", {})
            
            # Save locally
            db.dmt_recipients.update_one(
                {"user_id": req.user_id, "account_number": req.account_number},
                {
                    "$set": {
                        "recipient_id": data.get("recipient_id"),
                        "recipient_name": req.recipient_name,
                        "account_number": req.account_number,
                        "ifsc": req.ifsc,
                        "provider": req.provider,
                        "updated_at": datetime.now(timezone.utc)
                    }
                },
                upsert=True
            )
            
            return success_response({
                "recipient_id": data.get("recipient_id"),
                "recipient_name": req.recipient_name,
                "account_masked": f"***{req.account_number[-4:]}",
                "ifsc": req.ifsc,
                "next_step": "send_transaction_otp"
            }, "Recipient added successfully")
        
        elif eko_status == 342:
            return success_response({
                "already_exists": True,
                "message": "Recipient already registered"
            }, "Recipient exists")
        
        else:
            return error_response(eko_status, result.get("message", "Failed to add recipient"))
            
    except Exception as e:
        logging.error(f"[DMT-v3] Add Recipient Error: {e}")
        return error_response(500, str(e))


# ==================== STEP 6: GET RECIPIENTS ====================

@router.get("/recipients/{mobile}")
async def get_recipients(mobile: str, provider: DMTProvider = DMTProvider.AIRTEL, user_id: str = ""):
    """
    Get list of saved recipients for customer.
    """
    urls = get_provider_urls(provider)
    
    logging.info(f"[DMT-v3] Get Recipients: {mobile}, Provider: {provider}")
    
    try:
        url = urls["get_recipients"].format(mobile=mobile)
        url += f"?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        response = requests.get(url, headers=generate_headers(), timeout=REQUEST_TIMEOUT)
        
        if response.status_code == 404:
            return success_response({
                "count": 0,
                "recipients": [],
                "message": "No recipients found"
            }, "No recipients")
        
        result = response.json()
        
        # Handle "no recipients" response
        if result.get("response_status_id") == -1 or "no recepient" in str(result.get("message", "")).lower():
            return success_response({
                "count": 0,
                "recipients": [],
                "message": "No saved bank accounts"
            }, "No recipients")
        
        if result.get("status") == 0:
            data = result.get("data", {})
            recipients = data.get("recipient_list", []) if isinstance(data, dict) else data
            
            formatted = []
            for r in recipients:
                formatted.append({
                    "recipient_id": r.get("recipient_id"),
                    "recipient_name": r.get("recipient_name"),
                    "account_masked": f"***{r.get('account', '')[-4:]}",
                    "ifsc": r.get("ifsc"),
                    "bank_name": r.get("bank_name"),
                    "is_verified": r.get("is_verified", False)
                })
            
            return success_response({
                "count": len(formatted),
                "recipients": formatted
            }, f"Found {len(formatted)} recipients")
        
        return error_response(result.get("status"), result.get("message", "Failed"))
        
    except Exception as e:
        logging.error(f"[DMT-v3] Get Recipients Error: {e}")
        return error_response(500, str(e))


# ==================== STEP 7: SEND TRANSACTION OTP ====================

@router.post("/transaction/otp")
async def send_transaction_otp(req: SendTransactionOTPRequest, request: Request):
    """
    Send OTP for transaction authorization.
    """
    db = get_db()
    urls = get_provider_urls(req.provider)
    
    logging.info(f"[DMT-v3] Send Transaction OTP: ₹{req.amount}, Provider: {req.provider}")
    
    try:
        url = urls["send_txn_otp"]
        url += f"?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        payload = {
            "customer_id": req.mobile,
            "recipient_id": req.recipient_id,
            "amount": str(int(req.amount)),
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "source_ip": SOURCE_IP
        }
        
        response = requests.post(url, data=payload, headers=generate_headers(), timeout=REQUEST_TIMEOUT)
        
        result = response.json()
        eko_status = result.get("status")
        
        log_transaction(db, {
            "action": "send_transaction_otp",
            "provider": req.provider,
            "mobile": req.mobile,
            "amount": req.amount,
            "recipient_id": req.recipient_id,
            "user_id": req.user_id,
            "eko_status": eko_status
        })
        
        if eko_status == 0:
            data = result.get("data", {})
            return success_response({
                "otp_sent": True,
                "otp_ref_id": data.get("otp_ref_id"),
                "amount": req.amount,
                "message": "OTP sent to registered mobile",
                "next_step": "initiate_transaction"
            }, "Transaction OTP sent")
        
        else:
            return error_response(eko_status, result.get("message", "Failed to send OTP"))
            
    except Exception as e:
        logging.error(f"[DMT-v3] Transaction OTP Error: {e}")
        return error_response(500, str(e))


# ==================== STEP 8: INITIATE TRANSACTION ====================

@router.post("/transaction/initiate")
async def initiate_transaction(req: InitiateTransactionRequest, request: Request):
    """
    Execute money transfer after OTP verification.
    """
    db = get_db()
    urls = get_provider_urls(req.provider)
    client_ref_id = f"DMT3_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6].upper()}"
    
    logging.info(f"[DMT-v3] Initiate Transaction: ₹{req.amount}, Provider: {req.provider}")
    
    # If using PRC, validate and deduct
    prc_deducted = 0
    user = None
    
    if req.prc_amount:
        user = db.users.find_one({"uid": req.user_id})
        if not user:
            return error_response(404, "User not found")
        
        if user.get("prc_balance", 0) < req.prc_amount:
            return error_response(400, "Insufficient PRC balance")
        
        # Deduct PRC
        db.users.update_one(
            {"uid": req.user_id},
            {"$inc": {"prc_balance": -req.prc_amount}}
        )
        prc_deducted = req.prc_amount
    
    try:
        url = urls["initiate_txn"]
        url += f"?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        # Generate request hash
        timestamp = str(int(time.time() * 1000))
        hash_data = f"{timestamp}{int(req.amount)}{req.recipient_id}{client_ref_id}"
        request_hash = generate_request_hash(hash_data)
        
        headers = generate_headers()
        headers["request_hash"] = request_hash
        
        payload = {
            "customer_id": req.mobile,
            "recipient_id": req.recipient_id,
            "amount": str(int(req.amount)),
            "otp": req.otp,
            "otp_ref_id": req.otp_ref_id,
            "client_ref_id": client_ref_id,
            "channel": req.channel.value,
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "source_ip": SOURCE_IP,
            "latlong": "19.9975,73.7898"
        }
        
        response = requests.post(url, data=payload, headers=headers, timeout=REQUEST_TIMEOUT)
        
        result = response.json()
        eko_status = result.get("status")
        tx_data = result.get("data", {})
        tx_status = tx_data.get("tx_status")
        eko_tid = tx_data.get("tid")
        
        # Save transaction
        txn_doc = {
            "transaction_id": client_ref_id,
            "eko_tid": eko_tid,
            "user_id": req.user_id,
            "mobile": req.mobile,
            "recipient_id": req.recipient_id,
            "amount": req.amount,
            "prc_used": prc_deducted,
            "provider": req.provider,
            "channel": req.channel,
            "eko_status": eko_status,
            "tx_status": tx_status,
            "status": "processing",
            "created_at": datetime.now(timezone.utc)
        }
        
        log_transaction(db, {
            "action": "initiate_transaction",
            "provider": req.provider,
            **txn_doc,
            "response": result
        })
        
        if eko_status == 0:
            if tx_status == 0:
                txn_doc["status"] = "completed"
                db.dmt_v3_transactions.insert_one(txn_doc)
                
                return success_response({
                    "transaction_id": client_ref_id,
                    "eko_tid": eko_tid,
                    "status": "SUCCESS",
                    "amount": req.amount,
                    "prc_deducted": prc_deducted,
                    "bank_ref": tx_data.get("bank_ref_num"),
                    "message": "Transfer successful!"
                }, "Transfer completed")
            
            elif tx_status == 1:
                # Failed - Refund PRC
                txn_doc["status"] = "failed"
                txn_doc["prc_refunded"] = prc_deducted
                db.dmt_v3_transactions.insert_one(txn_doc)
                
                if prc_deducted > 0:
                    db.users.update_one(
                        {"uid": req.user_id},
                        {"$inc": {"prc_balance": prc_deducted}}
                    )
                
                return error_response(
                    1,
                    "Transfer failed",
                    f"Transfer failed. {prc_deducted} PRC refunded." if prc_deducted else "Transfer failed."
                )
            
            elif tx_status == 2:
                txn_doc["status"] = "pending"
                db.dmt_v3_transactions.insert_one(txn_doc)
                
                return success_response({
                    "transaction_id": client_ref_id,
                    "eko_tid": eko_tid,
                    "status": "PENDING",
                    "amount": req.amount,
                    "message": "Transfer is being processed"
                }, "Transfer pending")
            
            else:
                txn_doc["status"] = "processing"
                db.dmt_v3_transactions.insert_one(txn_doc)
                
                return success_response({
                    "transaction_id": client_ref_id,
                    "status": "PROCESSING"
                }, "Transfer in progress")
        
        else:
            # Error - Refund PRC
            txn_doc["status"] = "failed"
            txn_doc["prc_refunded"] = prc_deducted
            txn_doc["error"] = result.get("message")
            db.dmt_v3_transactions.insert_one(txn_doc)
            
            if prc_deducted > 0:
                db.users.update_one(
                    {"uid": req.user_id},
                    {"$inc": {"prc_balance": prc_deducted}}
                )
            
            return error_response(
                eko_status,
                result.get("message", "Transfer failed"),
                f"Transfer failed. {prc_deducted} PRC refunded." if prc_deducted else result.get("message")
            )
            
    except Exception as e:
        logging.error(f"[DMT-v3] Transaction Error: {e}")
        
        # Refund PRC on error
        if prc_deducted > 0:
            db.users.update_one(
                {"uid": req.user_id},
                {"$inc": {"prc_balance": prc_deducted}}
            )
        
        return error_response(500, str(e), f"Transfer failed. {prc_deducted} PRC refunded." if prc_deducted else str(e))


# ==================== TRANSACTION STATUS ====================

@router.get("/transaction/status/{transaction_id}")
async def get_transaction_status(transaction_id: str, user_id: str):
    """Check transaction status"""
    db = get_db()
    
    txn = db.dmt_v3_transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not txn:
        return error_response(404, "Transaction not found")
    
    return success_response({
        "transaction_id": transaction_id,
        "eko_tid": txn.get("eko_tid"),
        "status": txn.get("status"),
        "amount": txn.get("amount"),
        "prc_used": txn.get("prc_used"),
        "prc_refunded": txn.get("prc_refunded"),
        "provider": txn.get("provider"),
        "created_at": str(txn.get("created_at"))
    }, f"Status: {txn.get('status')}")


# ==================== TRANSACTION HISTORY ====================

@router.get("/transactions/{user_id}")
async def get_transaction_history(user_id: str, limit: int = 20, skip: int = 0):
    """Get user's DMT transaction history"""
    db = get_db()
    
    txns = list(db.dmt_v3_transactions.find(
        {"user_id": user_id},
        {"_id": 0, "response": 0}
    ).sort("created_at", -1).skip(skip).limit(limit))
    
    total = db.dmt_v3_transactions.count_documents({"user_id": user_id})
    
    return success_response({
        "total": total,
        "transactions": txns
    }, f"Found {total} transactions")
