"""
PARAS REWARD - EKO DMT Service (ICICI Route v1)
================================================

Complete EKO DMT Integration using ONLY v1 APIs.
NO v3 APIs used. NO OTP flow required for ICICI route.

Flow:
1. Customer Search: GET /v1/customers/mobile_number:{mobile}
2. Customer Registration: PUT /v1/customers/mobile_number:{mobile}
3. Add Recipient: PUT /v1/customers/mobile_number:{mobile}/recipients
4. Get Recipients: GET /v1/customers/mobile_number:{mobile}/recipients
5. Money Transfer: POST /v1/transactions
6. Transaction Status: GET /v1/transactions/{reference_id}

Business Rules:
- 100 PRC = ₹1
- Minimum redeem: ₹100
- Maximum daily: ₹5000
"""

import os
import time
import hashlib
import base64
import hmac
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dmt", tags=["EKO DMT ICICI v1"])

# ============================================================================
# EKO PRODUCTION CONFIGURATION (ICICI Route)
# ============================================================================

EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "7c179a397b4710e71b2248d1f5892d19")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "mining-formula-v2")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")

# Whitelisted IPs
SOURCE_IP = "34.44.149.98"

# Business Rules - Defaults (actual values from DB)
DEFAULT_PRC_TO_INR_RATE = 100  # 100 PRC = ₹1
MIN_REDEEM_INR = 100
MAX_DAILY_INR = 5000

# Request timeout
REQUEST_TIMEOUT = 30

# Database reference
db = None

def set_db(database):
    global db
    db = database

def get_db():
    return db

def get_prc_rate():
    """Get PRC to INR rate from database - DYNAMIC"""
    try:
        if db is None:
            return DEFAULT_PRC_TO_INR_RATE
        
        settings = db.dmt_settings.find_one({"_id": "dmt_config"})
        if settings:
            return settings.get("prc_to_inr_rate", DEFAULT_PRC_TO_INR_RATE)
        
        admin_settings = db.settings.find_one({"key": "dmt_settings"})
        if admin_settings:
            return admin_settings.get("prc_rate", DEFAULT_PRC_TO_INR_RATE)
        
        return DEFAULT_PRC_TO_INR_RATE
    except:
        return DEFAULT_PRC_TO_INR_RATE


# ============================================================================
# EKO AUTHENTICATION
# ============================================================================

def generate_secret_key():
    """
    Generate EKO secret key using CORRECT algorithm.
    
    CORRECT Algorithm (from Eko Node.js reference):
    1. Base64 encode the AUTHENTICATOR_KEY (not developer_key!)
    2. Get current timestamp in MILLISECONDS
    3. Compute HMAC-SHA256 of timestamp using the base64-encoded authenticator key
    4. Base64 encode the HMAC result to get secret-key
    
    Returns:
        tuple: (secret_key, timestamp_ms)
    """
    # Step 1: Base64 encode the AUTHENTICATOR KEY (CRITICAL!)
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
    
    # Step 2: Get timestamp in MILLISECONDS
    timestamp_ms = str(int(time.time() * 1000))
    
    # Step 3: HMAC-SHA256 of timestamp using encoded authenticator key
    hmac_obj = hmac.new(
        encoded_key.encode('utf-8'),
        timestamp_ms.encode('utf-8'),
        hashlib.sha256
    )
    
    # Step 4: Base64 encode the result
    secret_key = base64.b64encode(hmac_obj.digest()).decode('utf-8')
    
    logger.info(f"[EKO AUTH] Timestamp: {timestamp_ms}, Key generated with authenticator")
    return secret_key, timestamp_ms


def get_eko_headers():
    """Generate EKO API headers with authentication."""
    secret_key, timestamp = generate_secret_key()
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/x-www-form-urlencoded"
    }


# ============================================================================
# REQUEST MODELS
# ============================================================================

class CustomerSearchRequest(BaseModel):
    mobile: str
    user_id: str

class CustomerRegisterRequest(BaseModel):
    mobile: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    user_id: str

class AddRecipientRequest(BaseModel):
    mobile: str
    recipient_name: str
    account: str
    ifsc: str
    bank_code: Optional[str] = None
    user_id: str

class TransferRequest(BaseModel):
    user_id: str
    mobile: str
    recipient_id: str
    prc_amount: int  # Amount in PRC

class RedeemRequest(BaseModel):
    user_id: str
    mobile: str
    bank_account: str
    ifsc: str
    recipient_name: str
    prc_amount: int

class VerifyAccountRequest(BaseModel):
    account: str
    ifsc: str
    customer_id: str = "9970100782"  # Default customer for verification


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_response(success: bool, status: str, message: str, data: dict = None):
    """Create standardized API response"""
    return {
        "success": success,
        "status": status,
        "message": message,
        "data": data or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


def prc_to_inr(prc_amount: int) -> float:
    """Convert PRC to INR using dynamic rate"""
    rate = get_prc_rate()
    return prc_amount / rate


def inr_to_prc(inr_amount: float) -> int:
    """Convert INR to PRC using dynamic rate"""
    rate = get_prc_rate()
    return int(inr_amount * rate)


async def log_transaction(user_id: str, reference_id: str, amount: float, 
                         recipient_id: str, status: str, response: dict, ip: str):
    """Log transaction for audit"""
    if db is not None:
        await db.dmt_transactions.insert_one({
            "user_id": user_id,
            "reference_id": reference_id,
            "amount": amount,
            "recipient_id": recipient_id,
            "status": status,
            "api_response": response,
            "ip_address": ip,
            "timestamp": datetime.now(timezone.utc)
        })


async def get_user_daily_total(user_id: str) -> float:
    """Get user's total DMT amount for today"""
    if db is None:
        return 0
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "status": "success",
                "timestamp": {"$gte": today_start}
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$amount"}
            }
        }
    ]
    
    result = await db.dmt_transactions.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0


# ============================================================================
# STEP 1: CUSTOMER SEARCH
# ============================================================================

@router.post("/customer/search")
async def customer_search(req: CustomerSearchRequest, request: Request):
    """
    STEP 1: Check if customer exists in EKO system.
    
    API: GET /v1/customers/mobile_number:{mobile}
    """
    if not req.mobile or len(req.mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid 10-digit mobile number")
    
    logger.info(f"[DMT] Customer search: {req.mobile}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        headers = get_eko_headers()
        logger.info(f"[DMT] Customer search URL: {url}")
        logger.info(f"[DMT] Customer search headers: developer_key={headers.get('developer_key', '')[:8]}...")
        
        response = requests.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT)
        logger.info(f"[DMT] Customer search response: {response.status_code}")
        logger.info(f"[DMT] Customer search body: {response.text[:500] if response.text else 'EMPTY'}")
        
        # Handle 403 Forbidden (IP not whitelisted)
        if response.status_code == 403:
            return create_response(False, "IP_NOT_WHITELISTED", "IP not whitelisted with Eko. Contact admin to whitelist preview IP.", {
                "http_status": 403,
                "raw_response": response.text[:200] if response.text else "Empty"
            })
        
        # Handle empty response
        if not response.text or not response.text.strip():
            return create_response(False, "EMPTY_RESPONSE", "Eko API returned empty response", {
                "http_status": response.status_code
            })
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            # Customer exists
            data = result.get("data", {})
            return create_response(True, "SUCCESS", "Customer found", {
                "customer_exists": True,
                "mobile": req.mobile,
                "name": data.get("name"),
                "available_limit": data.get("available_limit"),
                "used_limit": data.get("used_limit"),
                "total_limit": data.get("total_limit"),
                "state": data.get("state")
            })
        elif eko_status == 463 or "not exist" in result.get("message", "").lower():
            # Customer doesn't exist - needs registration
            return create_response(True, "NOT_FOUND", "Customer not found - registration required", {
                "customer_exists": False,
                "mobile": req.mobile,
                "needs_registration": True
            })
        else:
            return create_response(False, "EKO_ERROR", result.get("message", "Unknown error"))
            
    except requests.Timeout:
        return create_response(False, "TIMEOUT", "Request timeout - try again")
    except Exception as e:
        logger.error(f"[DMT] Customer search error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# STEP 2: CUSTOMER REGISTRATION
# ============================================================================

@router.post("/customer/register")
async def customer_register(req: CustomerRegisterRequest, request: Request):
    """
    STEP 2: Register new customer in EKO system.
    
    API: PUT /v1/customers/mobile_number:{mobile}
    
    Fields: first_name, last_name, email
    """
    if not req.mobile or len(req.mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid 10-digit mobile number")
    
    if not req.first_name or not req.last_name:
        return create_response(False, "VALIDATION_ERROR", "First name and last name required")
    
    logger.info(f"[DMT] Customer registration: {req.mobile}, Name: {req.first_name} {req.last_name}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "first_name": req.first_name,
            "last_name": req.last_name,
            "email": req.email or f"{req.mobile}@parasreward.com"
        }
        
        response = requests.put(url, data=payload, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        logger.info(f"[DMT] Registration response: {response.status_code} - {response.text[:300]}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            
            # Store customer in our database
            if db is not None:
                await db.dmt_customers.update_one(
                    {"mobile": req.mobile},
                    {"$set": {
                        "user_id": req.user_id,
                        "first_name": req.first_name,
                        "last_name": req.last_name,
                        "email": req.email,
                        "registered_at": datetime.now(timezone.utc)
                    }},
                    upsert=True
                )
            
            return create_response(True, "SUCCESS", "Customer registered successfully", {
                "mobile": req.mobile,
                "name": f"{req.first_name} {req.last_name}",
                "registered": True
            })
        else:
            return create_response(False, "EKO_ERROR", result.get("message", "Registration failed"))
            
    except requests.Timeout:
        return create_response(False, "TIMEOUT", "Request timeout - try again")
    except Exception as e:
        logger.error(f"[DMT] Registration error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# ACCOUNT VERIFICATION (Penny Drop)
# ============================================================================

@router.post("/account/verify")
async def verify_bank_account(req: VerifyAccountRequest, request: Request):
    """
    Verify bank account before adding as recipient.
    
    This performs a penny drop verification to get the actual account holder name.
    Important: Always verify account before transfer to avoid failed transactions.
    
    API: POST /v2/banks/ifsc:{ifsc}/accounts/{account}
    """
    if not req.account or not req.ifsc:
        return create_response(False, "VALIDATION_ERROR", "Account number and IFSC required")
    
    logger.info(f"[DMT] Verify account: ***{req.account[-4:]}, IFSC: {req.ifsc}")
    
    try:
        # Use v2 API for account verification
        url = f"{EKO_BASE_URL.replace('/ekoicici', '/ekoicici')}/v2/banks/ifsc:{req.ifsc.upper()}/accounts/{req.account}"
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "customer_id": req.customer_id,
            "user_code": EKO_USER_CODE,
            "client_ref_id": f"AVS{int(time.time())}"
        }
        
        response = requests.post(url, data=payload, headers=get_eko_headers(), timeout=60)
        logger.info(f"[DMT] Account verification response: {response.status_code} - {response.text[:500]}")
        
        result = response.json()
        eko_status = result.get("status")
        response_type = result.get("response_type_id")
        
        data = result.get("data", {})
        
        # Success cases
        if eko_status == 0:
            # response_type_id 61 = Account details found with name
            # response_type_id 345 = Already registered, name not available
            if response_type == 61:
                return create_response(True, "VERIFIED", "Account verified successfully", {
                    "recipient_name": data.get("recipient_name", ""),
                    "account": req.account,
                    "ifsc": req.ifsc.upper(),
                    "bank": data.get("bank", ""),
                    "is_name_editable": data.get("is_name_editable", "0"),
                    "verification_fee": data.get("fee", "0"),
                    "tid": data.get("tid", "")
                })
            elif response_type == 345:
                return create_response(True, "ALREADY_REGISTERED", result.get("message", "Recipient already registered"), {
                    "recipient_name": data.get("recipient_name", ""),
                    "account": req.account,
                    "ifsc": req.ifsc.upper(),
                    "is_name_editable": data.get("is_name_editable", "0"),
                    "note": "Account already added. Name may not be verified."
                })
            else:
                return create_response(True, "SUCCESS", result.get("message", "Verification completed"), data)
        
        # Error cases
        if response_type == 1796:
            return create_response(False, "VERIFICATION_NOT_AVAILABLE", "Account verification not available for this bank", {
                "suggestion": "Add recipient directly and verify through small test transaction"
            })
        
        return create_response(False, "VERIFICATION_FAILED", result.get("message", "Verification failed"), {
            "eko_status": eko_status,
            "response_type": response_type
        })
        
    except requests.Timeout:
        return create_response(False, "TIMEOUT", "Verification timeout - try again")
    except Exception as e:
        logger.error(f"[DMT] Account verification error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# STEP 3: ADD RECIPIENT (Bank Account)
# ============================================================================

@router.post("/recipient/add")
async def add_recipient(req: AddRecipientRequest, request: Request):
    """
    STEP 3: Add recipient (beneficiary bank account).
    
    API: PUT /v1/customers/mobile_number:{mobile}/recipients
    
    Fields: recipient_name, account, ifsc, bank_code
    
    Returns: recipient_id (store this for transfers)
    """
    if not req.mobile or len(req.mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid mobile number")
    
    if not req.account or not req.ifsc:
        return create_response(False, "VALIDATION_ERROR", "Account number and IFSC required")
    
    logger.info(f"[DMT] Add recipient: {req.mobile}, Account: ***{req.account[-4:]}, IFSC: {req.ifsc}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}/recipients"
        
        # JSON payload for PUT request
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "recipient_name": req.recipient_name,
            "account": req.account,
            "ifsc": req.ifsc.upper()
        }
        
        if req.bank_code:
            payload["bank_code"] = req.bank_code
        
        # Use JSON headers for PUT request
        headers = get_eko_headers()
        headers["Content-Type"] = "application/json"
        headers["Accept"] = "application/json"
        
        response = requests.put(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
        logger.info(f"[DMT] Add recipient response: {response.status_code} - {response.text[:500]}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            recipient_id = data.get("recipient_id")
            
            # Store recipient in database
            if db is not None and recipient_id:
                await db.dmt_recipients.update_one(
                    {"recipient_id": str(recipient_id)},
                    {"$set": {
                        "user_id": req.user_id,
                        "mobile": req.mobile,
                        "recipient_name": req.recipient_name,
                        "account_last4": req.account[-4:],
                        "ifsc": req.ifsc.upper(),
                        "bank_name": data.get("bank_name", ""),
                        "created_at": datetime.now(timezone.utc)
                    }},
                    upsert=True
                )
            
            return create_response(True, "SUCCESS", "Recipient added successfully", {
                "recipient_id": recipient_id,
                "recipient_name": req.recipient_name,
                "account": f"****{req.account[-4:]}",
                "ifsc": req.ifsc.upper(),
                "bank_name": data.get("bank_name", "")
            })
        else:
            error_msg = result.get("message", "Failed to add recipient")
            
            # User-friendly error messages
            if "ifsc" in error_msg.lower():
                return create_response(False, "INVALID_IFSC", "Invalid IFSC code")
            elif "account" in error_msg.lower():
                return create_response(False, "INVALID_ACCOUNT", "Invalid account number")
            else:
                return create_response(False, "EKO_ERROR", error_msg)
            
    except requests.Timeout:
        return create_response(False, "TIMEOUT", "Request timeout - try again")
    except Exception as e:
        logger.error(f"[DMT] Add recipient error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# STEP 4: GET RECIPIENT LIST
# ============================================================================

@router.get("/recipients/{mobile}")
async def get_recipients(mobile: str, user_id: str = None, request: Request = None):
    """
    STEP 4: Get all recipients (beneficiaries) for a customer.
    
    API: GET /v1/customers/mobile_number:{mobile}/recipients
    """
    if not mobile or len(mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid mobile number")
    
    logger.info(f"[DMT] Get recipients: {mobile}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{mobile}/recipients"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        response = requests.get(url, params=params, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        logger.info(f"[DMT] Recipients response: {response.status_code} - {response.text[:500]}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            recipients = data.get("recipient_list", [])
            
            # Format recipients
            formatted_recipients = []
            for r in recipients:
                formatted_recipients.append({
                    "recipient_id": r.get("recipient_id"),
                    "recipient_name": r.get("recipient_name"),
                    "account": f"****{r.get('account', '')[-4:]}",
                    "ifsc": r.get("ifsc"),
                    "bank_name": r.get("bank_name", ""),
                    "is_verified": r.get("is_verified", False)
                })
            
            return create_response(True, "SUCCESS", f"Found {len(formatted_recipients)} recipients", {
                "recipients": formatted_recipients,
                "count": len(formatted_recipients)
            })
        else:
            return create_response(True, "SUCCESS", "No recipients found", {
                "recipients": [],
                "count": 0
            })
            
    except requests.Timeout:
        return create_response(False, "TIMEOUT", "Request timeout - try again")
    except Exception as e:
        logger.error(f"[DMT] Get recipients error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# STEP 5: INITIATE MONEY TRANSFER
# ============================================================================

@router.post("/transfer")
async def initiate_transfer(req: TransferRequest, request: Request):
    """
    STEP 5: Initiate money transfer.
    
    API: POST /v1/transactions
    
    Fields: customer_mobile, recipient_id, amount, reference_id
    
    PRC is deducted ONLY after successful transfer.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Validate PRC amount using dynamic rate
    prc_rate = get_prc_rate()
    if req.prc_amount < MIN_REDEEM_INR * prc_rate:
        return create_response(False, "MIN_AMOUNT", f"Minimum {MIN_REDEEM_INR * prc_rate} PRC (₹{MIN_REDEEM_INR}) required")
    
    inr_amount = prc_to_inr(req.prc_amount)
    
    if inr_amount > MAX_DAILY_INR:
        return create_response(False, "MAX_AMOUNT", f"Maximum ₹{MAX_DAILY_INR} per transfer")
    
    # Check daily limit
    daily_total = await get_user_daily_total(req.user_id)
    if daily_total + inr_amount > MAX_DAILY_INR:
        remaining = MAX_DAILY_INR - daily_total
        return create_response(False, "DAILY_LIMIT", f"Daily limit exceeded. Remaining: ₹{remaining}")
    
    # Check PRC balance
    if db is not None:
        user = await db.users.find_one({"uid": req.user_id})
        if not user:
            return create_response(False, "USER_NOT_FOUND", "User not found")
        
        prc_balance = user.get("prc_balance", 0)
        if prc_balance < req.prc_amount:
            return create_response(False, "INSUFFICIENT_BALANCE", f"Insufficient PRC. Balance: {prc_balance}")
    
    # Generate unique reference ID
    reference_id = f"PARAS{int(time.time())}{req.mobile[-4:]}"
    
    logger.info(f"[DMT] Transfer: {req.mobile} -> {req.recipient_id}, Amount: ₹{inr_amount}, Ref: {reference_id}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/transactions"
        
        # Generate request_hash for transaction security
        encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
        timestamp_ms = str(int(time.time() * 1000))
        
        # HMAC for secret-key
        hmac_secret = hmac.new(encoded_key.encode('utf-8'), timestamp_ms.encode('utf-8'), hashlib.sha256)
        secret_key = base64.b64encode(hmac_secret.digest()).decode('utf-8')
        
        # HMAC for request_hash (timestamp + utility_acc_no + amount + user_code)
        concat_str = timestamp_ms + "" + str(int(inr_amount)) + EKO_USER_CODE
        hmac_hash = hmac.new(encoded_key.encode('utf-8'), concat_str.encode('utf-8'), hashlib.sha256)
        request_hash = base64.b64encode(hmac_hash.digest()).decode('utf-8')
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp_ms,
            "request_hash": request_hash,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": req.mobile,
            "recipient_id": req.recipient_id,
            "amount": str(int(inr_amount)),
            "client_ref_id": reference_id,
            "channel": "2",
            "state": "1",  # 1 = Commit transaction
            "latlong": "19.0760,72.8777",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        }
        
        response = requests.post(url, data=payload, headers=headers, timeout=60)
        logger.info(f"[DMT] Transfer response: {response.status_code} - {response.text[:500]}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            tid = data.get("tid")
            bank_ref = data.get("bank_ref_num")
            
            # SUCCESS - Deduct PRC
            if db is not None:
                await db.users.update_one(
                    {"uid": req.user_id},
                    {"$inc": {"prc_balance": -req.prc_amount}}
                )
            
            # Log successful transaction
            await log_transaction(req.user_id, reference_id, inr_amount, 
                                 req.recipient_id, "success", result, client_ip)
            
            return create_response(True, "SUCCESS", "Transfer successful!", {
                "tid": tid,
                "reference_id": reference_id,
                "bank_ref_num": bank_ref,
                "amount_inr": inr_amount,
                "prc_deducted": req.prc_amount,
                "message": result.get("message", "Money transferred successfully")
            })
        else:
            # FAILED - Don't deduct PRC
            await log_transaction(req.user_id, reference_id, inr_amount,
                                 req.recipient_id, "failed", result, client_ip)
            
            error_msg = result.get("message", "Transfer failed")
            return create_response(False, "TRANSFER_FAILED", error_msg, {
                "reference_id": reference_id,
                "prc_deducted": 0
            })
            
    except requests.Timeout:
        await log_transaction(req.user_id, reference_id, inr_amount,
                             req.recipient_id, "timeout", {}, client_ip)
        return create_response(False, "TIMEOUT", "Transfer timeout - check status")
    except Exception as e:
        logger.error(f"[DMT] Transfer error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# STEP 6: TRANSACTION STATUS
# ============================================================================

@router.get("/status/{reference_id}")
async def get_transaction_status(reference_id: str, request: Request):
    """
    STEP 6: Check transaction status.
    
    API: GET /v1/transactions/{reference_id}
    """
    if not reference_id:
        return create_response(False, "VALIDATION_ERROR", "Reference ID required")
    
    logger.info(f"[DMT] Transaction status: {reference_id}")
    
    try:
        url = f"{EKO_BASE_URL}/v1/transactions/{reference_id}"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        response = requests.get(url, params=params, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        logger.info(f"[DMT] Status response: {response.status_code} - {response.text[:300]}")
        
        result = response.json()
        eko_status = result.get("status")
        
        if eko_status == 0:
            data = result.get("data", {})
            tx_status = data.get("tx_status", "UNKNOWN")
            
            # Map status
            status_map = {
                "0": "SUCCESS",
                "1": "PENDING",
                "2": "REFUNDED",
                "3": "FAILED"
            }
            
            return create_response(True, "SUCCESS", "Transaction status retrieved", {
                "reference_id": reference_id,
                "tid": data.get("tid"),
                "tx_status": status_map.get(str(tx_status), tx_status),
                "amount": data.get("amount"),
                "bank_ref_num": data.get("bank_ref_num"),
                "message": result.get("message", "")
            })
        else:
            return create_response(False, "NOT_FOUND", "Transaction not found")
            
    except requests.Timeout:
        return create_response(False, "TIMEOUT", "Request timeout")
    except Exception as e:
        logger.error(f"[DMT] Status error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# WALLET API
# ============================================================================

@router.get("/wallet/{user_id}")
async def get_wallet(user_id: str):
    """
    GET /wallet
    
    Returns PRC balance and INR equivalent.
    """
    if db is None:
        return create_response(False, "ERROR", "Database not available")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return create_response(False, "USER_NOT_FOUND", "User not found")
    
    prc_balance = user.get("prc_balance", 0)
    inr_equivalent = prc_to_inr(prc_balance)
    prc_rate = get_prc_rate()
    
    return create_response(True, "SUCCESS", "Wallet retrieved", {
        "prc_balance": prc_balance,
        "inr_equivalent": inr_equivalent,
        "conversion_rate": f"{prc_rate} PRC = ₹1",
        "min_redeem_prc": MIN_REDEEM_INR * prc_rate,
        "max_daily_prc": MAX_DAILY_INR * prc_rate,
        "prc_rate": prc_rate
    })


# ============================================================================
# COMPLETE REDEEM FLOW (Single API)
# ============================================================================

@router.post("/redeem")
async def redeem_prc(req: RedeemRequest, request: Request):
    """
    POST /redeem
    
    Complete PRC to Bank transfer in one API call.
    
    Flow:
    1. Check PRC balance
    2. Convert PRC → INR
    3. Search customer (create if needed)
    4. Add recipient (if new)
    5. Transfer money
    6. Deduct PRC
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Validate
    if not req.mobile or len(req.mobile) != 10:
        return create_response(False, "VALIDATION_ERROR", "Invalid mobile number")
    
    if not req.bank_account or not req.ifsc:
        return create_response(False, "VALIDATION_ERROR", "Bank account and IFSC required")
    
    prc_rate = get_prc_rate()
    if req.prc_amount < MIN_REDEEM_INR * prc_rate:
        return create_response(False, "MIN_AMOUNT", f"Minimum ₹{MIN_REDEEM_INR} ({MIN_REDEEM_INR * prc_rate} PRC) required")
    
    inr_amount = prc_to_inr(req.prc_amount)
    
    if inr_amount > MAX_DAILY_INR:
        return create_response(False, "MAX_AMOUNT", f"Maximum ₹{MAX_DAILY_INR} per transfer")
    
    # Check PRC balance
    if db is not None:
        user = await db.users.find_one({"uid": req.user_id})
        if not user:
            return create_response(False, "USER_NOT_FOUND", "User not found")
        
        prc_balance = user.get("prc_balance", 0)
        if prc_balance < req.prc_amount:
            return create_response(False, "INSUFFICIENT_BALANCE", 
                                  f"Insufficient PRC. Balance: {prc_balance}, Required: {req.prc_amount}")
    
    # Check daily limit
    daily_total = await get_user_daily_total(req.user_id)
    if daily_total + inr_amount > MAX_DAILY_INR:
        remaining = MAX_DAILY_INR - daily_total
        return create_response(False, "DAILY_LIMIT", f"Daily limit exceeded. Remaining: ₹{remaining}")
    
    logger.info(f"[DMT] Redeem flow: User {req.user_id}, Mobile {req.mobile}, Amount ₹{inr_amount}")
    
    try:
        # STEP 1: Search Customer
        search_url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}"
        search_params = {"initiator_id": EKO_INITIATOR_ID, "user_code": EKO_USER_CODE}
        search_resp = requests.get(search_url, params=search_params, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        search_result = search_resp.json()
        
        # STEP 2: Register if not exists
        if search_result.get("status") != 0:
            logger.info(f"[DMT] Customer not found, registering: {req.mobile}")
            reg_url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}"
            reg_payload = {
                "initiator_id": EKO_INITIATOR_ID,
                "user_code": EKO_USER_CODE,
                "first_name": req.recipient_name.split()[0] if req.recipient_name else "User",
                "last_name": req.recipient_name.split()[-1] if req.recipient_name and len(req.recipient_name.split()) > 1 else "User",
                "email": f"{req.mobile}@parasreward.com"
            }
            reg_resp = requests.put(reg_url, data=reg_payload, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
            reg_result = reg_resp.json()
            
            if reg_result.get("status") != 0:
                return create_response(False, "REGISTRATION_FAILED", reg_result.get("message", "Customer registration failed"))
        
        # STEP 3: Add Recipient
        logger.info(f"[DMT] Adding recipient: {req.bank_account[-4:]}")
        recip_url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{req.mobile}/recipients"
        recip_payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "recipient_name": req.recipient_name,
            "account": req.bank_account,
            "ifsc": req.ifsc.upper()
        }
        recip_resp = requests.put(recip_url, data=recip_payload, headers=get_eko_headers(), timeout=REQUEST_TIMEOUT)
        recip_result = recip_resp.json()
        
        if recip_result.get("status") != 0:
            error_msg = recip_result.get("message", "Failed to add recipient")
            if "ifsc" in error_msg.lower():
                return create_response(False, "INVALID_IFSC", "Invalid IFSC code")
            return create_response(False, "RECIPIENT_FAILED", error_msg)
        
        recipient_id = recip_result.get("data", {}).get("recipient_id")
        if not recipient_id:
            return create_response(False, "RECIPIENT_FAILED", "Could not get recipient ID")
        
        # STEP 4: Transfer Money
        reference_id = f"PARAS{int(time.time())}{req.mobile[-4:]}"
        logger.info(f"[DMT] Initiating transfer: ₹{inr_amount}, Ref: {reference_id}")
        
        tx_url = f"{EKO_BASE_URL}/v1/transactions"
        tx_payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_mobile": req.mobile,
            "recipient_id": recipient_id,
            "amount": int(inr_amount),
            "reference_id": reference_id,
            "channel": "2",
            "latlong": "0,0"
        }
        tx_resp = requests.post(tx_url, data=tx_payload, headers=get_eko_headers(), timeout=60)
        tx_result = tx_resp.json()
        
        if tx_result.get("status") == 0:
            # SUCCESS - Deduct PRC
            tx_data = tx_result.get("data", {})
            
            if db is not None:
                await db.users.update_one(
                    {"uid": req.user_id},
                    {"$inc": {"prc_balance": -req.prc_amount}}
                )
            
            await log_transaction(req.user_id, reference_id, inr_amount,
                                 recipient_id, "success", tx_result, client_ip)
            
            return create_response(True, "SUCCESS", "Money transferred successfully!", {
                "tid": tx_data.get("tid"),
                "reference_id": reference_id,
                "bank_ref_num": tx_data.get("bank_ref_num"),
                "amount_inr": inr_amount,
                "prc_deducted": req.prc_amount,
                "recipient_id": recipient_id
            })
        else:
            # FAILED - Don't deduct PRC
            await log_transaction(req.user_id, reference_id, inr_amount,
                                 recipient_id, "failed", tx_result, client_ip)
            
            return create_response(False, "TRANSFER_FAILED", tx_result.get("message", "Transfer failed"), {
                "reference_id": reference_id,
                "prc_deducted": 0
            })
            
    except requests.Timeout:
        return create_response(False, "TIMEOUT", "Request timeout - please check transaction status")
    except Exception as e:
        logger.error(f"[DMT] Redeem error: {e}")
        return create_response(False, "ERROR", str(e))


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    prc_rate = get_prc_rate()
    return {
        "status": "DMT SERVICE RUNNING",
        "version": "1.0",
        "route": "ICICI v1",
        "base_url": EKO_BASE_URL,
        "conversion": f"{prc_rate} PRC = ₹1",
        "min_redeem": f"₹{MIN_REDEEM_INR}",
        "max_daily": f"₹{MAX_DAILY_INR}",
        "prc_rate": prc_rate,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
