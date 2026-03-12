"""
PARAS REWARD - EKO DMT v3 Service (Production Ready)
====================================================

This module implements the complete EKO DMT Customer Verification with OTP
following the official EKO developer documentation.

EKO v3 API Flow:
1. Check Customer: GET /v3/customers/mobile_number:{mobile}
2. Customer Onboarding: POST /v3/customer/account/{customer_id}
3. Send OTP: POST /v3/customer/account/{customer_id}/ppi-digikhata/otp/send
4. Verify OTP: POST /v3/customer/account/{customer_id}/ppi-digikhata/otp/verify
5. Add Recipient: PUT /v1/customers/mobile_number:{mobile}/recipients
6. Transaction OTP: POST /v3/customer/payment/dmt-fino/otp
7. Money Transfer: POST /v1/transactions

Customer States:
- 1 = OTP pending
- 2 = OTP verified (non KYC)
- 3 = KYC pending
- 4 = Fully verified customer
"""

import os
import time
import hashlib
import base64
import hmac
import logging
import requests
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/eko/v3", tags=["EKO DMT v3"])

# ============================================================================
# EKO PRODUCTION CONFIGURATION
# ============================================================================

EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "7c179a397b4710e71b2248d1f5892d19")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "7a2529f5-3587-4add-a2df-3d0606d62460")

# Whitelisted Server IPs
WHITELISTED_IPS = ["34.44.149.98", "34.10.166.75"]

# Request timeout
REQUEST_TIMEOUT = 30

# Database reference (will be set by server.py)
db = None

def set_db(database):
    global db
    db = database

def get_db():
    return db


# ============================================================================
# EKO AUTHENTICATION - Secret Key Generation
# ============================================================================

def generate_eko_secret_key():
    """
    Generate EKO secret key as per documentation.
    
    CORRECT Formula (from Eko docs):
    1. Base64 encode the authenticator key
    2. Use HMAC-SHA256 with the encoded key
    3. Sign the timestamp in MILLISECONDS
    4. Base64 encode the result
    
    IMPORTANT: Timestamp must be in milliseconds, not seconds!
    """
    timestamp_ms = str(int(time.time() * 1000))  # MILLISECONDS, not seconds
    
    # Step 1: Base64 encode the authenticator key
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
    
    # Step 2: HMAC-SHA256 with the encoded key, signing the timestamp
    signature = hmac.new(
        encoded_key.encode('utf-8'),
        timestamp_ms.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Step 3: Base64 encode the signature
    secret_key = base64.b64encode(signature).decode('utf-8')
    
    logger.info(f"[EKO-AUTH] Generated secret key with timestamp: {timestamp_ms}")
    
    return secret_key, timestamp_ms


def get_eko_headers():
    """
    Generate EKO API headers with authentication.
    """
    secret_key, timestamp = generate_eko_secret_key()
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "initiator_id": EKO_INITIATOR_ID,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    return headers


def get_eko_json_headers():
    """
    Generate EKO API headers for JSON requests.
    """
    secret_key, timestamp = generate_eko_secret_key()
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "initiator_id": EKO_INITIATOR_ID,
        "Content-Type": "application/json"
    }
    
    return headers


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CustomerCheckRequest(BaseModel):
    mobile: str
    user_id: str

class CustomerOnboardRequest(BaseModel):
    mobile: str
    first_name: str
    last_name: str
    user_id: str
    email: Optional[str] = None

class SendOTPRequest(BaseModel):
    mobile: str
    user_id: str

class VerifyOTPRequest(BaseModel):
    mobile: str
    otp: str
    otp_ref_id: str
    user_id: str

class AddRecipientRequest(BaseModel):
    mobile: str
    recipient_name: str
    account_number: str
    ifsc: str
    bank_code: Optional[str] = None
    user_id: str

class TransferRequest(BaseModel):
    mobile: str
    recipient_id: str
    amount: float
    user_id: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_response(success: bool, status: str, message: str, data: dict = None, user_message: str = None):
    """Create standardized API response"""
    return {
        "success": success,
        "status": status,
        "message": message,
        "data": data or {},
        "user_message": user_message or message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


async def log_otp_event(mobile: str, otp_ref_id: str, event_type: str, ip: str, response: dict):
    """Log OTP events for audit"""
    if db:
        await db.eko_otp_logs.insert_one({
            "mobile": mobile,
            "otp_ref_id": otp_ref_id,
            "event_type": event_type,
            "ip_address": ip,
            "response": response,
            "timestamp": datetime.now(timezone.utc)
        })


async def log_transaction(user_id: str, mobile: str, amount: float, recipient_id: str, 
                          reference_id: str, response: dict, status: str):
    """Log DMT transactions"""
    if db:
        await db.eko_dmt_transactions.insert_one({
            "user_id": user_id,
            "mobile": mobile,
            "amount": amount,
            "recipient_id": recipient_id,
            "reference_id": reference_id,
            "api_response": response,
            "status": status,
            "timestamp": datetime.now(timezone.utc)
        })


# ============================================================================
# STEP 1: CHECK CUSTOMER
# ============================================================================

@router.post("/customer/check")
async def check_customer(req: CustomerCheckRequest, request: Request):
    """
    Step 1: Check if customer exists in EKO system.
    
    API: GET /v3/customers/mobile_number:{mobile}
    
    Returns customer profile if exists, or indicates new customer.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if not req.mobile or len(req.mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid mobile number", 
                              user_message="कृपया 10 अंकी मोबाइल नंबर टाका")
    
    logger.info(f"[EKO-V3] Checking customer: {req.mobile}")
    
    try:
        url = f"{EKO_BASE_URL}/v3/customers/mobile_number:{req.mobile}"
        
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": "20810200"
        }
        
        response = requests.get(url, params=params, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        
        logger.info(f"[EKO-V3] Customer check response: {response.status_code}")
        logger.info(f"[EKO-V3] Customer check body: {response.text[:500]}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            # Customer exists
            customer_data = result.get("data", {})
            state = customer_data.get("state", "0")
            
            state_descriptions = {
                "0": "New customer",
                "1": "OTP pending",
                "2": "OTP verified (non-KYC)",
                "3": "KYC pending", 
                "4": "Fully verified"
            }
            
            return create_response(True, "SUCCESS", "Customer found", {
                "customer_exists": True,
                "customer_id": customer_data.get("customer_id"),
                "mobile": req.mobile,
                "name": customer_data.get("name"),
                "state": state,
                "state_description": state_descriptions.get(str(state), "Unknown"),
                "available_limit": customer_data.get("available_limit"),
                "used_limit": customer_data.get("used_limit"),
                "total_limit": customer_data.get("total_limit"),
                "is_verified": str(state) in ["2", "3", "4"],
                "needs_otp": str(state) == "1"
            }, user_message="Customer verified")
            
        elif eko_status == 463 or "does not exist" in result.get("message", "").lower():
            # New customer - needs onboarding
            return create_response(True, "NEW_CUSTOMER", "Customer not found", {
                "customer_exists": False,
                "mobile": req.mobile,
                "needs_onboarding": True
            }, user_message="नवीन customer - कृपया नाव टाकून register करा")
            
        else:
            return create_response(False, "EKO_ERROR", result.get("message", "Unknown error"),
                                  user_message="Service temporarily unavailable")
            
    except requests.Timeout:
        logger.error(f"[EKO-V3] Customer check timeout")
        return create_response(False, "TIMEOUT", "Request timeout",
                              user_message="Server busy - कृपया पुन्हा try करा")
    except Exception as e:
        logger.error(f"[EKO-V3] Customer check error: {e}")
        return create_response(False, "ERROR", str(e),
                              user_message="Service error - कृपया पुन्हा try करा")


# ============================================================================
# STEP 2: CUSTOMER ONBOARDING
# ============================================================================

@router.post("/customer/onboard")
async def onboard_customer(req: CustomerOnboardRequest, request: Request):
    """
    Step 2: Onboard new customer to EKO system.
    
    API: POST /v3/customer/account/{customer_id}
    
    This will register the customer and trigger OTP.
    Returns otp_ref_id which must be stored for verification.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if not req.mobile or len(req.mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid mobile number",
                              user_message="कृपया 10 अंकी मोबाइल नंबर टाका")
    
    if not req.first_name or not req.last_name:
        return create_response(False, "VALIDATION_ERROR", "Name required",
                              user_message="कृपया नाव टाका")
    
    logger.info(f"[EKO-V3] Onboarding customer: {req.mobile}, Name: {req.first_name} {req.last_name}")
    
    try:
        # Customer ID is the mobile number
        customer_id = req.mobile
        url = f"{EKO_BASE_URL}/v3/customer/account/{customer_id}"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": "20810200",
            "first_name": req.first_name,
            "last_name": req.last_name,
            "mobile_number": req.mobile,
            "email": req.email or f"{req.mobile}@parasreward.com"
        }
        
        response = requests.post(url, data=payload, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        
        logger.info(f"[EKO-V3] Onboard response: {response.status_code}")
        logger.info(f"[EKO-V3] Onboard body: {response.text[:500]}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            otp_ref_id = data.get("otp_ref_id")
            
            # Store OTP reference in database
            if db and otp_ref_id:
                await db.eko_otp_refs.update_one(
                    {"mobile": req.mobile},
                    {"$set": {
                        "otp_ref_id": otp_ref_id,
                        "user_id": req.user_id,
                        "created_at": datetime.now(timezone.utc),
                        "status": "pending"
                    }},
                    upsert=True
                )
            
            await log_otp_event(req.mobile, otp_ref_id, "onboard", client_ip, result)
            
            return create_response(True, "SUCCESS", "Customer registered", {
                "customer_id": customer_id,
                "mobile": req.mobile,
                "otp_ref_id": otp_ref_id,
                "otp_sent": True,
                "message": result.get("message", "OTP sent to mobile")
            }, user_message=f"OTP {req.mobile} वर पाठवला आहे")
            
        else:
            return create_response(False, "EKO_ERROR", result.get("message", "Registration failed"),
                                  user_message="Registration failed - कृपया पुन्हा try करा")
            
    except Exception as e:
        logger.error(f"[EKO-V3] Onboard error: {e}")
        return create_response(False, "ERROR", str(e),
                              user_message="Service error")


# ============================================================================
# STEP 3: SEND OTP (for existing customers with pending verification)
# ============================================================================

@router.post("/customer/otp/send")
async def send_otp(req: SendOTPRequest, request: Request):
    """
    Step 3: Send OTP to customer for verification.
    
    API: POST /v3/customer/account/{customer_id}/ppi-digikhata/otp/send
    
    This triggers OTP delivery to the registered mobile number.
    Returns otp_ref_id for verification.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if not req.mobile or len(req.mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid mobile number",
                              user_message="कृपया 10 अंकी मोबाइल नंबर टाका")
    
    logger.info(f"[EKO-V3] Sending OTP to: {req.mobile}")
    
    try:
        customer_id = req.mobile
        url = f"{EKO_BASE_URL}/v3/customer/account/{customer_id}/ppi-digikhata/otp/send"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": "20810200"
        }
        
        response = requests.post(url, data=payload, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        
        logger.info(f"[EKO-V3] Send OTP response: {response.status_code}")
        logger.info(f"[EKO-V3] Send OTP body: {response.text}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            otp_ref_id = data.get("otp_ref_id")
            
            # Store OTP reference
            if db and otp_ref_id:
                await db.eko_otp_refs.update_one(
                    {"mobile": req.mobile},
                    {"$set": {
                        "otp_ref_id": otp_ref_id,
                        "user_id": req.user_id,
                        "created_at": datetime.now(timezone.utc),
                        "status": "sent"
                    }},
                    upsert=True
                )
            
            await log_otp_event(req.mobile, otp_ref_id, "send_otp", client_ip, result)
            
            return create_response(True, "SUCCESS", "OTP sent", {
                "otp_sent": True,
                "mobile": req.mobile,
                "otp_ref_id": otp_ref_id,
                "message": result.get("message", "OTP sent successfully"),
                "note": "OTP 1-2 मिनिटात येईल. DND check करा."
            }, user_message=f"OTP {req.mobile} वर पाठवला!")
            
        else:
            error_msg = result.get("message", "Failed to send OTP")
            logger.error(f"[EKO-V3] OTP send failed: {error_msg}")
            
            return create_response(False, "EKO_ERROR", error_msg, {
                "eko_status": eko_status,
                "eko_message": error_msg
            }, user_message="OTP पाठवता आला नाही - कृपया पुन्हा try करा")
            
    except Exception as e:
        logger.error(f"[EKO-V3] Send OTP error: {e}")
        return create_response(False, "ERROR", str(e),
                              user_message="Service error")


# ============================================================================
# STEP 4: VERIFY OTP
# ============================================================================

@router.post("/customer/otp/verify")
async def verify_otp(req: VerifyOTPRequest, request: Request):
    """
    Step 4: Verify OTP entered by customer.
    
    API: POST /v3/customer/account/{customer_id}/ppi-digikhata/otp/verify
    
    Body: otp, otp_ref_id
    
    If successful, customer state changes to verified.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if not req.mobile or len(req.mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid mobile number",
                              user_message="कृपया 10 अंकी मोबाइल नंबर टाका")
    
    if not req.otp or len(req.otp) < 4:
        return create_response(False, "VALIDATION_ERROR", "Invalid OTP",
                              user_message="कृपया valid OTP टाका")
    
    if not req.otp_ref_id:
        return create_response(False, "VALIDATION_ERROR", "OTP reference missing",
                              user_message="कृपया पुन्हा OTP मागवा")
    
    logger.info(f"[EKO-V3] Verifying OTP for: {req.mobile}, OTP: ***{req.otp[-2:]}, Ref: {req.otp_ref_id}")
    
    try:
        customer_id = req.mobile
        url = f"{EKO_BASE_URL}/v3/customer/account/{customer_id}/ppi-digikhata/otp/verify"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": "20810200",
            "otp": req.otp,
            "otp_ref_id": req.otp_ref_id
        }
        
        response = requests.post(url, data=payload, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        
        logger.info(f"[EKO-V3] Verify OTP response: {response.status_code}")
        logger.info(f"[EKO-V3] Verify OTP body: {response.text}")
        
        result = response.json()
        eko_status = result.get("status")
        
        await log_otp_event(req.mobile, req.otp_ref_id, "verify_otp", client_ip, result)
        
        if eko_status == 0:
            data = result.get("data", {})
            
            # Update OTP reference status
            if db:
                await db.eko_otp_refs.update_one(
                    {"mobile": req.mobile},
                    {"$set": {
                        "status": "verified",
                        "verified_at": datetime.now(timezone.utc)
                    }}
                )
            
            return create_response(True, "SUCCESS", "OTP verified", {
                "verified": True,
                "customer_id": customer_id,
                "mobile": req.mobile,
                "state": data.get("state", "2"),
                "available_limit": data.get("available_limit"),
                "message": result.get("message", "Customer verified successfully")
            }, user_message="✅ Verification successful!")
            
        else:
            error_msg = result.get("message", "OTP verification failed")
            
            # Handle specific errors
            if "invalid" in error_msg.lower():
                user_msg = "❌ चुकीचा OTP - कृपया पुन्हा check करा"
            elif "expired" in error_msg.lower():
                user_msg = "⏰ OTP expired - कृपया नवीन OTP मागवा"
            elif "retry" in error_msg.lower() or "limit" in error_msg.lower():
                user_msg = "🚫 Too many attempts - कृपया 10 मिनिटानंतर try करा"
            else:
                user_msg = "Verification failed - कृपया पुन्हा try करा"
            
            return create_response(False, "VERIFICATION_FAILED", error_msg, {
                "eko_status": eko_status,
                "eko_message": error_msg
            }, user_message=user_msg)
            
    except Exception as e:
        logger.error(f"[EKO-V3] Verify OTP error: {e}")
        return create_response(False, "ERROR", str(e),
                              user_message="Service error")


# ============================================================================
# STEP 5: GET CUSTOMER STATUS (KYC Check)
# ============================================================================

@router.get("/customer/status/{mobile}")
async def get_customer_status(mobile: str, request: Request):
    """
    Step 5: Get customer verification/KYC status.
    
    States:
    - 1 = OTP pending
    - 2 = OTP verified (non-KYC)
    - 3 = KYC pending
    - 4 = Fully verified customer
    
    Only state 2, 3, 4 can add recipients and do transfers.
    """
    if not mobile or len(mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid mobile number")
    
    try:
        url = f"{EKO_BASE_URL}/v3/customers/mobile_number:{mobile}"
        
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": "20810200"
        }
        
        response = requests.get(url, params=params, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        result = response.json()
        
        if result.get("status") == 0:
            data = result.get("data", {})
            state = str(data.get("state", "0"))
            
            state_info = {
                "0": {"description": "New customer", "can_transact": False},
                "1": {"description": "OTP pending", "can_transact": False},
                "2": {"description": "OTP verified", "can_transact": True},
                "3": {"description": "KYC pending", "can_transact": True},
                "4": {"description": "Fully verified", "can_transact": True}
            }
            
            info = state_info.get(state, {"description": "Unknown", "can_transact": False})
            
            return create_response(True, "SUCCESS", "Customer status retrieved", {
                "mobile": mobile,
                "state": state,
                "state_description": info["description"],
                "can_add_recipient": info["can_transact"],
                "can_transfer": info["can_transact"],
                "available_limit": data.get("available_limit"),
                "used_limit": data.get("used_limit"),
                "total_limit": data.get("total_limit")
            })
        else:
            return create_response(False, "NOT_FOUND", "Customer not found")
            
    except Exception as e:
        logger.error(f"[EKO-V3] Status check error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# STEP 6: ADD RECIPIENT (Bank Account)
# ============================================================================

@router.post("/recipient/add")
async def add_recipient(req: AddRecipientRequest, request: Request):
    """
    Step 6: Add recipient (bank account) for customer.
    
    API: PUT /v1/customers/mobile_number:{mobile}/recipients
    
    Only verified customers (state >= 2) can add recipients.
    Returns recipient_id which is used for transfers.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if not req.account_number or not req.ifsc:
        return create_response(False, "VALIDATION_ERROR", "Account number and IFSC required",
                              user_message="कृपया account number आणि IFSC टाका")
    
    logger.info(f"[EKO-V3] Adding recipient for: {req.mobile}, Account: ***{req.account_number[-4:]}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}/recipients"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": "20810200",
            "recipient_name": req.recipient_name,
            "account": req.account_number,
            "ifsc": req.ifsc.upper()
        }
        
        if req.bank_code:
            payload["bank_code"] = req.bank_code
        
        response = requests.put(url, data=payload, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        
        logger.info(f"[EKO-V3] Add recipient response: {response.status_code}")
        logger.info(f"[EKO-V3] Add recipient body: {response.text[:500]}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            recipient_id = data.get("recipient_id")
            
            # Store recipient in database
            if db and recipient_id:
                await db.eko_recipients.update_one(
                    {"recipient_id": recipient_id},
                    {"$set": {
                        "mobile": req.mobile,
                        "user_id": req.user_id,
                        "recipient_name": req.recipient_name,
                        "account_number": req.account_number[-4:],  # Store only last 4 digits
                        "ifsc": req.ifsc.upper(),
                        "created_at": datetime.now(timezone.utc)
                    }},
                    upsert=True
                )
            
            return create_response(True, "SUCCESS", "Recipient added", {
                "recipient_id": recipient_id,
                "recipient_name": req.recipient_name,
                "account": f"****{req.account_number[-4:]}",
                "ifsc": req.ifsc.upper(),
                "bank_name": data.get("bank_name", "")
            }, user_message="✅ Bank account added!")
            
        else:
            error_msg = result.get("message", "Failed to add recipient")
            
            if "ifsc" in error_msg.lower():
                user_msg = "Invalid IFSC code - कृपया check करा"
            elif "account" in error_msg.lower():
                user_msg = "Invalid account number"
            else:
                user_msg = "Bank account add करता आला नाही"
            
            return create_response(False, "EKO_ERROR", error_msg, user_message=user_msg)
            
    except Exception as e:
        logger.error(f"[EKO-V3] Add recipient error: {e}")
        return create_response(False, "ERROR", str(e),
                              user_message="Service error")


# ============================================================================
# STEP 7: TRANSACTION OTP (before transfer)
# ============================================================================

@router.post("/transaction/otp/send")
async def send_transaction_otp(req: SendOTPRequest, request: Request):
    """
    Step 7: Send OTP for transaction authorization.
    
    API: POST /v3/customer/payment/dmt-fino/otp
    
    This OTP is required before initiating a bank transfer.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    logger.info(f"[EKO-V3] Sending transaction OTP to: {req.mobile}")
    
    try:
        url = f"{EKO_BASE_URL}/v3/customer/payment/dmt-fino/otp"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": "20810200",
            "customer_id": req.mobile
        }
        
        response = requests.post(url, data=payload, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        
        logger.info(f"[EKO-V3] Transaction OTP response: {response.status_code}")
        logger.info(f"[EKO-V3] Transaction OTP body: {response.text}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            otp_ref_id = data.get("otp_ref_id")
            
            await log_otp_event(req.mobile, otp_ref_id, "transaction_otp", client_ip, result)
            
            return create_response(True, "SUCCESS", "Transaction OTP sent", {
                "otp_sent": True,
                "mobile": req.mobile,
                "otp_ref_id": otp_ref_id
            }, user_message=f"Transaction OTP {req.mobile} वर पाठवला!")
            
        else:
            return create_response(False, "EKO_ERROR", result.get("message", "Failed to send OTP"),
                                  user_message="OTP पाठवता आला नाही")
            
    except Exception as e:
        logger.error(f"[EKO-V3] Transaction OTP error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# STEP 8 & 9: MONEY TRANSFER
# ============================================================================

@router.post("/transfer")
async def initiate_transfer(req: TransferRequest, request: Request):
    """
    Step 8 & 9: Initiate money transfer.
    
    API: POST /v1/transactions
    
    Prerequisites:
    - Customer must be verified (state >= 2)
    - Recipient must be added
    - Transaction OTP must be verified (if required)
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if req.amount < 100:
        return create_response(False, "VALIDATION_ERROR", "Minimum transfer amount is ₹100",
                              user_message="Minimum ₹100 transfer करता येतो")
    
    if req.amount > 25000:
        return create_response(False, "VALIDATION_ERROR", "Maximum transfer amount is ₹25,000",
                              user_message="Maximum ₹25,000 एका वेळी transfer करता येतो")
    
    # Generate unique reference ID
    reference_id = f"PARAS{int(time.time())}{req.mobile[-4:]}"
    
    logger.info(f"[EKO-V3] Initiating transfer: {req.mobile} -> {req.recipient_id}, Amount: {req.amount}, Ref: {reference_id}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/transactions"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": "20810200",
            "customer_mobile": req.mobile,
            "recipient_id": req.recipient_id,
            "amount": int(req.amount),
            "reference_id": reference_id,
            "channel": "2",  # Web/API channel
            "latlong": "0,0"
        }
        
        response = requests.post(url, data=payload, headers=get_eko_headers(), timeout=60)
        
        logger.info(f"[EKO-V3] Transfer response: {response.status_code}")
        logger.info(f"[EKO-V3] Transfer body: {response.text}")
        
        result = response.json()
        eko_status = result.get("status")
        
        await log_transaction(req.user_id, req.mobile, req.amount, req.recipient_id, 
                             reference_id, result, "completed" if eko_status == 0 else "failed")
        
        if eko_status == 0:
            data = result.get("data", {})
            
            return create_response(True, "SUCCESS", "Transfer successful", {
                "tid": data.get("tid"),
                "reference_id": reference_id,
                "amount": req.amount,
                "recipient_id": req.recipient_id,
                "bank_ref_num": data.get("bank_ref_num"),
                "message": result.get("message", "Transfer completed")
            }, user_message=f"✅ ₹{req.amount} successfully transferred!")
            
        else:
            error_msg = result.get("message", "Transfer failed")
            return create_response(False, "TRANSFER_FAILED", error_msg, {
                "reference_id": reference_id,
                "eko_status": eko_status
            }, user_message="Transfer failed - amount will be refunded if deducted")
            
    except Exception as e:
        logger.error(f"[EKO-V3] Transfer error: {e}")
        return create_response(False, "ERROR", str(e),
                              user_message="Transfer error - कृपया support शी संपर्क करा")


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "EKO DMT V3 SERVICE RUNNING",
        "version": "3.0",
        "base_url": EKO_BASE_URL,
        "initiator_id": EKO_INITIATOR_ID[:4] + "****",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
