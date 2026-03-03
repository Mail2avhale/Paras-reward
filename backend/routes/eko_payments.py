"""
Eko.in API Integration - LIVE
- BBPS Bill Payments (Electricity, Gas, Water, Mobile, DTH, etc.)
- DMT (Domestic Money Transfer)

Documentation: https://developers.eko.in

Error Codes Reference: https://developers.eko.in/docs/error-codes
"""

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
import hashlib
import hmac
import base64
import json
import time
import uuid
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/eko", tags=["Eko Bill Payment & DMT"])

# Eko API Configuration - LIVE
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID")
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")  # Default retailer code

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ==================== EKO ERROR CODES (Official Documentation) ====================

# For financial transactions: status = 0 means success, else fail
# For non-financial: check both status and response_type_id

EKO_STATUS_CODES = {
    # Success
    "0": "Success",
    
    # User/Agent Related Errors
    "463": "User not found",
    "327": "Enrollment done. Verification pending",
    "17": "User wallet already exists",
    "31": "Agent can not be registered",
    "319": "Invalid Sender/Initiator",
    "1237": "ID proof number already exists in the system",
    "585": "Customer already KYC Approved",
    
    # Sender Related
    "132": "Sender name should only contain letters",
    "945": "Sender/Beneficiary limit has been exhausted for this month",
    
    # OTP Related Errors
    "302": "Wrong OTP",
    "303": "OTP expired",
    
    # Recipient Related Errors
    "342": "Recipient already registered",
    "145": "Recipient mobile number should be numeric",
    "140": "Recipient mobile number should be 10 digit",
    "131": "Recipient name should only contain letters",
    "122": "Recipient name length should be in between 1 and 50",
    "39": "Max recipient limit reached",
    "313": "Recipient registration not done",
    "350": "Verification failed. Recipient name not found",
    "536": "Invalid recipient type format",
    "537": "Invalid recipient type length",
    "44": "Customer not found",
    "45": "Recipient not found / Incomplete IFSC Code",
    
    # Bank/IFSC Related Errors
    "41": "Wrong IFSC",
    "48": "Recipient bank not found",
    "136": "Please provide valid IFSC format",
    "508": "Invalid IFSC for the selected bank",
    "521": "IFSC not found in the system",
    
    # Account Related Errors
    "102": "Invalid Account number length",
    "46": "Invalid account details",
    
    # Transaction Related Errors
    "317": "NEFT not allowed",
    "53": "IMPS transaction not allowed",
    "55": "Error from NPCI",
    "460": "Invalid channel",
    "344": "IMPS is not available in this bank",
    "168": "TID does not exist",
    "544": "Transaction not processed. Bank is not available now",
    
    # Balance/Limit Related Errors
    "347": "Insufficient balance",
    "314": "Failed! Monthly limit exceeds",
    
    # HTTP/Server Errors
    "400": "Bad Request - Invalid parameters",
    "403": "Access denied - check IP whitelist or service not activated",
    "404": "Resource not found",
    "500": "Internal server error",
    "503": "Service temporarily unavailable",
    "504": "Gateway timeout"
}

# Transaction Status Codes (tx_status field)
EKO_TX_STATUS_CODES = {
    0: {"status": "Success", "description": "Transaction Successful", "is_final": True, "action": "None - Transaction complete"},
    1: {"status": "Fail", "description": "Transaction Failed", "is_final": True, "action": "Initiate refund if applicable"},
    2: {"status": "Initiated", "description": "Response Awaited/Initiated (NEFT pending)", "is_final": False, "action": "Poll status after 5-10 minutes"},
    3: {"status": "Refund Pending", "description": "Refund is being processed", "is_final": False, "action": "Wait for refund completion"},
    4: {"status": "Refunded", "description": "Amount has been refunded", "is_final": True, "action": "None - Refund complete"},
    5: {"status": "Hold", "description": "Transaction Inquiry Required", "is_final": False, "action": "Contact Eko support with TID"}
}

def get_eko_error_message(status_code) -> str:
    """Get human-readable error message from Eko status code"""
    return EKO_STATUS_CODES.get(str(status_code), f"Unknown error (code: {status_code})")

def get_tx_status_info(tx_status: int) -> dict:
    """Get transaction status information"""
    return EKO_TX_STATUS_CODES.get(tx_status, {
        "status": "Unknown",
        "description": f"Unknown status code: {tx_status}",
        "is_final": False,
        "action": "Contact support"
    })

def is_retryable_error(status_code) -> bool:
    """Check if error is retryable (temporary failures)"""
    retryable = ["544", "503", "504", "55"]  # Bank unavailable, timeout, NPCI error
    return str(status_code) in retryable

def needs_manual_review(status_code) -> bool:
    """Check if error requires manual admin review"""
    manual = ["347", "314", "403", "319", "945", "5"]  # Balance, limits, access, hold
    return str(status_code) in manual


# ==================== HELPER FUNCTIONS ====================

def generate_secret_key(timestamp: str):
    """
    Generate secret-key using HMAC-SHA256 as per Eko Reference documentation
    https://developers.eko.in/reference/authenticationn
    
    Algorithm:
    1. Base64 encode the Authenticator Key FIRST
    2. HMAC-SHA256(timestamp, encoded_key)
    3. Base64 encode the result
    """
    if not EKO_AUTHENTICATOR_KEY:
        return None
    
    # Step 1: Base64 encode the authenticator key FIRST (as per Reference docs)
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
    
    # Step 2: HMAC SHA256 of timestamp using encoded key
    signature = hmac.new(
        encoded_key.encode('utf-8'),
        timestamp.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Step 3: Base64 encode the signature
    return base64.b64encode(signature).decode('utf-8')


def get_secret_key_timestamp():
    """Get current timestamp in milliseconds - use int() for consistent results"""
    return str(int(time.time() * 1000))


def generate_request_hash(timestamp: str, utility_acc_no: str, amount: str, user_code: str):
    """
    Generate request_hash for Eko API BBPS Pay Bill
    https://developers.eko.in/reference/authenticationn
    
    Algorithm:
    1. Base64 encode the authenticator key FIRST
    2. Concatenate: timestamp + utility_acc_no + amount + user_code
    3. HMAC-SHA256 with encoded key
    4. Base64 encode the result
    
    Parameters:
    - timestamp: 13 digit milliseconds timestamp (SAME as secret-key-timestamp)
    - utility_acc_no: Account/mobile number
    - amount: Transaction amount as string
    - user_code: EKO user code
    
    Returns:
    - Base64 encoded HMAC-SHA256 hash
    """
    if not EKO_AUTHENTICATOR_KEY:
        return None
    
    # Step 1: Base64 encode the authenticator key FIRST
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
    
    # Step 2: Concatenate parameters (ORDER IS CRITICAL!)
    concatenated_string = timestamp + utility_acc_no + amount + user_code
    
    # Step 3: HMAC SHA256 with encoded key
    signature = hmac.new(
        encoded_key.encode('utf-8'),
        concatenated_string.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Step 4: Base64 encode the result
    return base64.b64encode(signature).decode('utf-8')


async def make_eko_request(endpoint: str, method: str = "GET", data: dict = None, form_data: bool = False):
    """Make authenticated request to Eko API - Using base64 encoded key as per Eko Reference docs"""
    import requests as req
    
    if not EKO_DEVELOPER_KEY or not EKO_AUTHENTICATOR_KEY:
        raise HTTPException(status_code=500, detail="Eko API credentials not configured")
    
    url = f"{EKO_BASE_URL}{endpoint}"
    
    # Add initiator_id to URL query params
    if "?" not in url:
        url = f"{url}?initiator_id={EKO_INITIATOR_ID}"
    elif "initiator_id" not in url:
        url = f"{url}&initiator_id={EKO_INITIATOR_ID}"
    
    # Generate timestamp
    timestamp = str(int(time.time() * 1000))
    
    # Generate secret-key: Base64 encode key first, then HMAC (as per Reference docs)
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
    secret_key = base64.b64encode(
        hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    
    # Base headers
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
    }
    
    if data is None:
        data = {}
    
    # Generate request_hash for POST requests
    if method.upper() == "POST":
        headers["Content-Type"] = "application/json"
        
        # Extract values for request_hash
        utility_acc_no = data.get("utility_acc_no", "")
        amount = str(data.get("amount", ""))
        user_code = data.get("user_code", EKO_USER_CODE)
        
        # request_hash = HMAC-SHA256(timestamp + utility_acc_no + amount + user_code, encoded_key)
        concat_str = timestamp + utility_acc_no + amount + user_code
        request_hash = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), concat_str.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        headers["request_hash"] = request_hash
        
        print(f"=== MAKE_EKO_REQUEST DEBUG ===")
        print(f"URL: {url}")
        print(f"Timestamp: {timestamp}")
        print(f"Concat: {concat_str}")
        print(f"Request Hash: {request_hash}")
        print(f"Body: {data}")
    
    try:
        if method.upper() == "GET":
            response = req.get(url, headers=headers, params=data, timeout=60)
        elif method.upper() == "POST":
            body_json = json.dumps(data, separators=(',', ':'))
            print(f"Body JSON: {body_json}")
            print(f"Headers: {headers}")
            response = req.post(url, headers=headers, data=body_json, timeout=60)
        elif method.upper() == "PUT":
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            response = req.put(url, headers=headers, data=data, timeout=60)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text[:300]}")
        
        try:
            result = response.json()
        except:
            result = {"message": f"Parse error. Status: {response.status_code}", "raw": response.text[:200]}
        
        # Check for Eko specific errors
        if result.get("message") == "No key for Response":
            raise HTTPException(status_code=400, detail="Service not enabled for this operator. Contact Eko support.")
        
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=result.get("message", str(result)))
        
        return result
        
    except req.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Connection error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")


# ==================== PYDANTIC MODELS ====================

# ==================== SERVICE ACTIVATION ====================
# As per Eko docs: https://developers.eko.in/reference/bbps-1
# Must activate service before using BBPS APIs

@router.post("/activate-service/{service_code}")
async def activate_service(service_code: int = 53, user_code: str = None):
    """
    Activate a service for the merchant/user
    
    Service Codes:
    - 53: BBPS (Bill Payments - Electricity, Gas, DTH, etc.)
    - 45: DMT (Domestic Money Transfer)
    
    As per Eko docs: https://developers.eko.in/reference/bbps-1
    """
    import requests as req
    
    try:
        # Generate timestamp
        timestamp = str(int(time.time() * 1000))
        
        # Generate secret-key
        encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
        secret_key = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        # URL - use production base
        url = f"{EKO_BASE_URL}/v1/user/service/activate"
        
        # Headers
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        # Body - form data
        data = {
            "service_code": str(service_code),
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": user_code or EKO_USER_CODE,
            "latlong": "19.0760,72.8777"
        }
        
        logging.info(f"=== ACTIVATE SERVICE ===")
        logging.info(f"URL: {url}")
        logging.info(f"Service Code: {service_code}")
        logging.info(f"User Code: {data['user_code']}")
        
        # Make request
        response = req.put(url, headers=headers, data=data, timeout=60)
        
        logging.info(f"Response Status: {response.status_code}")
        logging.info(f"Response Body: {response.text[:500]}")
        
        try:
            result = response.json()
        except:
            result = {"raw": response.text, "parse_error": True}
        
        eko_status = result.get("status")
        
        if eko_status == 0:
            return {
                "success": True,
                "message": f"Service {service_code} activated successfully!",
                "service_code": service_code,
                "user_code": data['user_code'],
                "raw_response": result
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "Activation failed"),
                "error_code": str(eko_status),
                "service_code": service_code,
                "raw_response": result
            }
            
    except Exception as e:
        logging.error(f"Service activation failed: {e}")
        return {
            "success": False,
            "message": f"Activation failed: {str(e)}"
        }


@router.get("/check-service-status/{service_code}")
async def check_service_status(service_code: int = 53, user_code: str = None):
    """
    Check if a service is activated for the user
    """
    import requests as req
    
    try:
        timestamp = str(int(time.time() * 1000))
        encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
        secret_key = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        url = f"{EKO_BASE_URL}/v1/user/service/status"
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
        }
        
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": user_code or EKO_USER_CODE,
            "service_code": str(service_code)
        }
        
        response = req.get(url, headers=headers, params=params, timeout=60)
        
        try:
            result = response.json()
        except:
            result = {"raw": response.text}
        
        return {
            "service_code": service_code,
            "user_code": params['user_code'],
            "http_status": response.status_code,
            "response": result
        }
        
    except Exception as e:
        return {"error": str(e)}


@router.post("/activate-all-services")
async def activate_all_services(user_code: str = None):
    """
    Activate all required services for bill payments
    - 53: BBPS (Bill Payments)
    - 45: DMT (Money Transfer)
    """
    results = []
    service_codes = [53, 45]  # BBPS and DMT
    
    for code in service_codes:
        result = await activate_service(code, user_code)
        results.append({
            "service_code": code,
            "result": result
        })
    
    return {
        "message": "Service activation completed",
        "results": results
    }


# ==================== BILL PAYMENT CHARGES ====================
BILL_PLATFORM_FEE = 10  # ₹10 fixed platform fee
BILL_ADMIN_CHARGE_PERCENT = 20  # 20% admin charge
PRC_RATE = 10  # 10 PRC = ₹1

def calculate_bill_payment_charges(amount: float) -> dict:
    """
    Calculate charges for bill payment
    
    Platform Fee: ₹10 fixed
    Admin Charge: 20% of amount
    
    Returns dict with all charge breakdowns
    """
    amount_inr = float(amount)
    platform_fee = BILL_PLATFORM_FEE
    admin_charge = int(amount_inr * (BILL_ADMIN_CHARGE_PERCENT / 100))
    total_charges = platform_fee + admin_charge
    total_amount = amount_inr + total_charges
    
    return {
        "amount_inr": amount_inr,
        "platform_fee_inr": platform_fee,
        "admin_charge_inr": admin_charge,
        "admin_charge_percent": BILL_ADMIN_CHARGE_PERCENT,
        "total_charges_inr": total_charges,
        "total_amount_inr": total_amount,
        # PRC equivalents
        "amount_prc": int(amount_inr * PRC_RATE),
        "platform_fee_prc": platform_fee * PRC_RATE,
        "admin_charge_prc": admin_charge * PRC_RATE,
        "total_charges_prc": total_charges * PRC_RATE,
        "total_prc_required": int(total_amount * PRC_RATE)
    }


class BillFetchRequest(BaseModel):
    category: str  # electricity, water, gas, mobile_postpaid, dth, broadband, etc.
    biller_id: str
    customer_params: dict  # {param_name: value} e.g., {"ca_number": "123456789"}


class BillPayRequest(BaseModel):
    user_id: str
    category: str
    biller_id: str
    customer_params: dict
    amount: float
    bill_fetch_ref: Optional[str] = None


class DMTRecipientRequest(BaseModel):
    customer_mobile: str
    recipient_name: str
    recipient_mobile: str
    bank_ifsc: str
    account_number: str


class DMTTransferRequest(BaseModel):
    user_id: str
    customer_mobile: str
    recipient_id: str
    amount: float
    otp: Optional[str] = None


# ==================== BBPS BILL PAYMENT APIs ====================

@router.get("/charges/calculate")
async def calculate_charges_api(amount: float):
    """
    Calculate service charges for bill payment
    
    Platform Fee: ₹10 (fixed)
    Admin Charge: 20% of amount
    
    Example: ₹199 recharge
    - Platform Fee: ₹10
    - Admin Charge: ₹40 (20% of 199)
    - Total: ₹249 = 2490 PRC
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    charges = calculate_bill_payment_charges(amount)
    return {
        "success": True,
        "charges": charges
    }


@router.get("/charges/config")
async def get_charges_config():
    """Get current charges configuration"""
    return {
        "platform_fee_inr": BILL_PLATFORM_FEE,
        "admin_charge_percent": BILL_ADMIN_CHARGE_PERCENT,
        "prc_rate": PRC_RATE,
        "description": f"Platform Fee: ₹{BILL_PLATFORM_FEE} + Admin: {BILL_ADMIN_CHARGE_PERCENT}% of amount"
    }


@router.get("/config")
async def get_eko_config():
    """Get Eko configuration status"""
    return {
        "configured": bool(EKO_DEVELOPER_KEY and EKO_AUTHENTICATOR_KEY),
        "base_url": EKO_BASE_URL,
        "initiator_id": EKO_INITIATOR_ID,
        "environment": "sandbox" if "staging" in EKO_BASE_URL else "production"
    }


@router.get("/debug-auth")
async def debug_eko_auth():
    """
    Debug endpoint to verify Eko authentication values
    Use this to verify secret-key generation is correct
    """
    import time
    
    # Step 1: Get timestamp in milliseconds
    timestamp = str(int(time.time() * 1000))
    
    # Step 2: Base64 encode the authenticator key
    key = EKO_AUTHENTICATOR_KEY
    key_bytes = key.encode('utf-8')
    encoded_key = base64.b64encode(key_bytes).decode('utf-8')
    
    # Step 3: HMAC SHA256
    encoded_key_bytes = encoded_key.encode('utf-8')
    message = timestamp.encode('utf-8')
    signature = hmac.new(encoded_key_bytes, message, hashlib.sha256).digest()
    
    # Step 4: Base64 encode result
    secret_key = base64.b64encode(signature).decode('utf-8')
    
    # Generate request_hash for test values
    utility_acc_no = "9922400782"
    amount = "19"
    user_code = EKO_INITIATOR_ID
    concat_string = timestamp + utility_acc_no + amount + user_code
    request_hash = base64.b64encode(
        hmac.new(encoded_key_bytes, concat_string.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    
    return {
        "verification": {
            "timestamp_format": "milliseconds (13 digits)" if len(timestamp) == 13 else f"WRONG: {len(timestamp)} digits",
            "timestamp_value": timestamp,
            "auth_key_first_8": EKO_AUTHENTICATOR_KEY[:8] + "...",
            "auth_key_last_8": "..." + EKO_AUTHENTICATOR_KEY[-8:],
            "encoded_key_first_20": encoded_key[:20] + "...",
            "secret_key": secret_key,
            "secret_key_length": len(secret_key)
        },
        "headers_to_send": {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "Content-Type": "application/json"
        },
        "request_hash_example": {
            "for_params": f"utility_acc_no={utility_acc_no}, amount={amount}, user_code={user_code}",
            "concat_string_preview": concat_string[:30] + "...",
            "request_hash": request_hash
        },
        "api_config": {
            "base_url": EKO_BASE_URL,
            "initiator_id": EKO_INITIATOR_ID,
            "recharge_endpoint": "/v2/billpayments/paybill"
        }
    }


# ==================== SIMPLE TEST ENDPOINT (EXACT EKO FORMAT) ====================
@router.get("/debug-full")
async def debug_full_auth():
    """
    Complete debug of Eko authentication - shows all intermediate values
    Use this to compare with working implementations
    """
    import time
    
    # Fixed test values for comparison
    timestamp = str(int(time.time() * 1000))
    auth_key = EKO_AUTHENTICATOR_KEY
    
    # Method 1: Raw key (as per new guide)
    secret_key_raw = base64.b64encode(
        hmac.new(auth_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    
    # Method 2: Base64 encoded key first (as per old Eko docs)
    encoded_key = base64.b64encode(auth_key.encode('utf-8')).decode('utf-8')
    secret_key_encoded = base64.b64encode(
        hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    
    # Test body for request_hash
    test_body = {
        "source_ip": "127.0.0.1",
        "user_code": EKO_USER_CODE,
        "amount": "10",
        "client_ref_id": "TEST123456",
        "utility_acc_no": "9970100782",
        "confirmation_mobile_no": EKO_INITIATOR_ID,
        "sender_name": "TestUser",
        "operator_id": "1",
        "latlong": "19.0760,72.8777"
    }
    
    url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"
    body_json_compact = json.dumps(test_body, separators=(',', ':'))
    
    # Request hash - Simple SHA256
    hash_input = "POST" + url + body_json_compact
    request_hash_sha256 = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
    
    # Request hash - HMAC with raw key
    request_hash_hmac_raw = base64.b64encode(
        hmac.new(auth_key.encode('utf-8'), hash_input.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    
    # Request hash - HMAC with encoded key  
    request_hash_hmac_encoded = base64.b64encode(
        hmac.new(encoded_key.encode('utf-8'), hash_input.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    
    return {
        "timestamp": timestamp,
        "auth_key_preview": f"{auth_key[:8]}...{auth_key[-8:]}",
        "secret_key_methods": {
            "method1_raw_key": secret_key_raw,
            "method2_base64_key": secret_key_encoded,
            "note": "Try both methods - one should work"
        },
        "request_hash_methods": {
            "hash_input_preview": hash_input[:100] + "...",
            "method1_sha256_hex": request_hash_sha256,
            "method2_hmac_raw_base64": request_hash_hmac_raw,
            "method3_hmac_encoded_base64": request_hash_hmac_encoded,
            "note": "Try all three methods"
        },
        "test_body": test_body,
        "body_json_compact": body_json_compact,
        "url": url
    }


@router.post("/test-all-methods")
async def test_all_auth_methods(
    mobile: str = "9970100782",
    operator: str = "1",
    amount: str = "10"
):
    """
    Test bill payment with ALL possible auth method combinations
    Returns which combination works (if any)
    """
    import time
    
    timestamp = str(int(time.time() * 1000))
    auth_key = EKO_AUTHENTICATOR_KEY
    encoded_key = base64.b64encode(auth_key.encode('utf-8')).decode('utf-8')
    
    user_code = EKO_USER_CODE
    client_ref_id = f"TEST{datetime.now().strftime('%Y%m%d%H%M%S')}"
    url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"
    
    body = {
        "source_ip": "127.0.0.1",
        "user_code": user_code,
        "amount": amount,
        "client_ref_id": client_ref_id,
        "utility_acc_no": mobile,
        "confirmation_mobile_no": EKO_INITIATOR_ID,
        "sender_name": "TestUser",
        "operator_id": operator,
        "latlong": "19.0760,72.8777"
    }
    body_json = json.dumps(body, separators=(',', ':'))
    
    # Generate all possible secret keys
    secret_keys = {
        "raw": base64.b64encode(hmac.new(auth_key.encode(), timestamp.encode(), hashlib.sha256).digest()).decode(),
        "encoded": base64.b64encode(hmac.new(encoded_key.encode(), timestamp.encode(), hashlib.sha256).digest()).decode()
    }
    
    # Generate all possible request hashes
    hash_input = "POST" + url + body_json
    concat_old = timestamp + mobile + amount + user_code
    
    request_hashes = {
        "sha256_hex": hashlib.sha256(hash_input.encode()).hexdigest(),
        "hmac_raw_b64": base64.b64encode(hmac.new(auth_key.encode(), hash_input.encode(), hashlib.sha256).digest()).decode(),
        "hmac_encoded_b64": base64.b64encode(hmac.new(encoded_key.encode(), hash_input.encode(), hashlib.sha256).digest()).decode(),
        "old_format_raw": base64.b64encode(hmac.new(auth_key.encode(), concat_old.encode(), hashlib.sha256).digest()).decode(),
        "old_format_encoded": base64.b64encode(hmac.new(encoded_key.encode(), concat_old.encode(), hashlib.sha256).digest()).decode()
    }
    
    results = []
    
    # Test each combination
    for sk_name, secret_key in secret_keys.items():
        for rh_name, request_hash in request_hashes.items():
            headers = {
                "developer_key": EKO_DEVELOPER_KEY,
                "secret-key": secret_key,
                "secret-key-timestamp": timestamp,
                "request_hash": request_hash,
                "Content-Type": "application/json"
            }
            
            try:
                async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                    response = await client.post(url, headers=headers, content=body_json)
                    
                    try:
                        resp_json = response.json()
                        message = resp_json.get("message", "")
                        status = resp_json.get("status", resp_json.get("response_status_id", -1))
                    except:
                        message = response.text[:100]
                        status = -1
                    
                    results.append({
                        "secret_key_method": sk_name,
                        "request_hash_method": rh_name,
                        "http_status": response.status_code,
                        "eko_status": status,
                        "message": message,
                        "success": response.status_code == 200 and status == 0
                    })
                    
            except Exception as e:
                results.append({
                    "secret_key_method": sk_name,
                    "request_hash_method": rh_name,
                    "error": str(e)
                })
    
    # Find successful combination
    successful = [r for r in results if r.get("success")]
    
    return {
        "timestamp_used": timestamp,
        "url": url,
        "body_preview": body_json[:80] + "...",
        "total_combinations_tested": len(results),
        "successful_combinations": successful,
        "all_results": results
    }


@router.get("/debug-recharge-test")
async def debug_recharge_test():
    """
    Debug endpoint to test Eko recharge API and show exact response.
    Use this to diagnose "No key for Response" errors.
    """
    import time
    
    try:
        # Test values
        mobile = "9970100782"
        operator = "1"  # Airtel
        amount = "10"
        
        # Step 1: Generate timestamp (milliseconds)
        timestamp = str(int(time.time() * 1000))
        
        # Step 2: Generate secret-key
        if not EKO_AUTHENTICATOR_KEY:
            return {"error": "EKO_AUTHENTICATOR_KEY not set", "key_preview": "None"}
        
        key_bytes = EKO_AUTHENTICATOR_KEY.encode('utf-8')
        encoded_key = base64.b64encode(key_bytes).decode('utf-8')
        encoded_key_bytes = encoded_key.encode('utf-8')
        
        signature = hmac.new(encoded_key_bytes, timestamp.encode('utf-8'), hashlib.sha256).digest()
        secret_key = base64.b64encode(signature).decode('utf-8')
        
        # Step 3: Generate request_hash
        user_code = EKO_USER_CODE or EKO_INITIATOR_ID
        concat_str = timestamp + mobile + amount + user_code
        request_hash = base64.b64encode(
            hmac.new(encoded_key_bytes, concat_str.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        # Build request
        client_ref_id = f"DEBUG{int(time.time())}"
        url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "request_hash": request_hash,
            "Content-Type": "application/json"
        }
        
        body = {
            "initiator_id": EKO_INITIATOR_ID,
            "source_ip": "127.0.0.1",
            "user_code": user_code,
            "amount": amount,
            "client_ref_id": client_ref_id,
            "utility_acc_no": mobile,
            "confirmation_mobile_no": EKO_INITIATOR_ID,
            "sender_name": "DebugTest",
            "operator_id": operator,
            "latlong": "19.0760,72.8777"
        }
        
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            response = await client.post(url, headers=headers, json=body)
            
            return {
                "test_params": {
                    "mobile": mobile,
                    "operator": operator,
                    "amount": amount,
                    "user_code": user_code
                },
                "request": {
                    "url": url,
                    "timestamp": timestamp,
                    "auth_key_preview": f"{EKO_AUTHENTICATOR_KEY[:8]}...{EKO_AUTHENTICATOR_KEY[-8:]}",
                    "initiator_id": EKO_INITIATOR_ID
                },
                "response": {
                    "http_status": response.status_code,
                    "headers": dict(response.headers),
                    "body_raw": response.text[:1000],
                    "body_json": response.json() if response.headers.get("content-type", "").startswith("application/json") else "Not JSON"
                }
            }
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }


@router.post("/test-recharge")
async def test_recharge_exact_format(
    mobile: str = "9970100782",
    operator: str = "1",  # Airtel = 1
    amount: str = "10"
):
    """
    Test recharge endpoint using Eko auth format.
    Uses requests library (not httpx) with raw key bytes as per Eko Python docs.
    """
    import time
    import requests as req
    
    try:
        # Step 1: Generate timestamp (milliseconds - 13 digits)
        timestamp = str(int(time.time() * 1000))  # Use int() not round()
        
        # Step 2: Generate secret-key using Base64 encoded key (as per Eko Reference docs)
        encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
        secret_key = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        # Step 3: Build request body
        user_code = EKO_USER_CODE
        client_ref_id = f"TEST{int(time.time())}"
        
        url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"
        
        body = {
            "source_ip": "127.0.0.1",
            "user_code": user_code,
            "amount": amount,
            "client_ref_id": client_ref_id,
            "utility_acc_no": mobile,
            "confirmation_mobile_no": EKO_INITIATOR_ID,
            "sender_name": "TestUser",
            "operator_id": str(operator),  # String as per Eko docs example
            "latlong": "19.0760,72.8777"
        }
        
        # Step 4: Generate request_hash using Base64 encoded key
        concat_str = timestamp + mobile + amount + user_code
        request_hash = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), concat_str.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        body_json = json.dumps(body, separators=(',', ':'))
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "request_hash": request_hash,
            "Content-Type": "application/json"
        }
        
        logging.info(f"=== TEST RECHARGE ===")
        logging.info(f"URL: {url}")
        logging.info(f"Concat: {concat_str}")
        logging.info(f"Body: {body_json}")
        
        # Use requests library with data=body_json
        response = req.post(url, headers=headers, data=body_json, timeout=60)
        
        try:
            result = response.json()
        except:
            result = {"raw_response": response.text, "parse_error": True}
        
        return {
            "success": result.get("status") == 0,
            "http_status": response.status_code,
            "request_details": {
                "url": url,
                "timestamp": timestamp,
                "client_ref_id": client_ref_id,
                "mobile": mobile,
                "operator_id": operator,
                "amount": amount,
                "concat": concat_str,
                "request_hash": request_hash
            },
            "eko_response": result
        }
        
    except Exception as e:
        logging.error(f"Test recharge failed: {e}")
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.get("/balance")
async def get_eko_balance():
    """Get Eko settlement account balance"""
    try:
        result = await make_eko_request(
            f"/v1/customers/mobile_number:{EKO_INITIATOR_ID}/balance",
            method="GET"
        )
        return {
            "success": True,
            "balance": result.get("data", {}).get("balance", "0.0"),
            "currency": result.get("data", {}).get("currency", "INR"),
            "message": result.get("message")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.put("/activate-bbps")
async def activate_bbps_service():
    """
    Activate BBPS service for the merchant
    Service code 53 = BBPS (Bill Payment)
    This must be called before using any bill payment APIs
    """
    return await activate_eko_service("53", "BBPS (Bill Payments)")


@router.put("/activate-dmt")
async def activate_dmt_service():
    """
    Activate DMT service for the merchant
    Service code 45 = DMT (Money Transfer/Payout)
    This must be called before using any fund transfer APIs
    """
    return await activate_eko_service("45", "DMT (Money Transfer)")


@router.put("/activate-all-services")
async def activate_all_eko_services():
    """
    Activate ALL Eko services for the merchant
    """
    services = {
        "45": "DMT (Money Transfer)",
        "53": "BBPS (Bill Payments)",
        "39": "Settlement",
        "4": "AePS (Cash Withdrawal)"
    }
    
    results = {}
    for code, name in services.items():
        result = await activate_eko_service(code, name)
        results[name] = {
            "service_code": code,
            "success": result.get("success", False),
            "status": result.get("response", {}).get("data", {}).get("service_status_desc", "Unknown"),
            "message": result.get("message", "")
        }
    
    all_success = all(r["success"] for r in results.values())
    return {
        "success": all_success,
        "message": "All services activated!" if all_success else "Some services failed",
        "services": results
    }


@router.get("/service-status")
async def get_service_status():
    """
    Get activation status of all Eko services
    """
    try:
        timestamp = get_secret_key_timestamp()
        secret_key = generate_secret_key(timestamp)
        
        url = f"{EKO_BASE_URL}/v1/user/services?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE or EKO_INITIATOR_ID}"
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url, headers=headers)
            
            try:
                result = response.json()
            except:
                result = {"raw_response": response.text}
            
            return {
                "success": response.status_code == 200,
                "services": result.get("data", result)
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def activate_eko_service(service_code: str, service_name: str):
    """
    Helper function to activate any Eko service
    """
    try:
        timestamp = get_secret_key_timestamp()
        secret_key = generate_secret_key(timestamp)
        
        url = f"{EKO_BASE_URL}/v1/user/service/activate"
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "service_code": service_code,
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE or EKO_INITIATOR_ID,
            "latlong": "19.0760,72.8777"
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.put(url, headers=headers, data=data)
            
            logging.info(f"{service_name} Activation Response: {response.status_code} - {response.text}")
            
            try:
                result = response.json()
            except:
                result = {"raw_response": response.text}
            
            if response.status_code == 200 and result.get("status") == 0:
                return {
                    "success": True,
                    "message": f"{service_name} service activated successfully!",
                    "response": result
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", f"{service_name} activation failed"),
                    "status_code": response.status_code,
                    "response": result
                }
                
    except Exception as e:
        logging.error(f"{service_name} activation failed: {e}")
        return {"success": False, "error": str(e)}


# ==================== GET OPERATOR PARAMETERS ====================
@router.get("/bbps/operator-params/{operator_id}")
async def get_operator_parameters(operator_id: int):
    """
    Get required parameters for a specific operator.
    This is MANDATORY before calling paybill API.
    
    Returns: List of parameters with their regex, type, and labels
    """
    try:
        result = await make_eko_request(
            f"/v2/billpayments/operators/{operator_id}",
            method="GET"
        )
        
        return {
            "success": True,
            "operator_id": operator_id,
            "operator_name": result.get("operator_name", ""),
            "fetch_bill_required": result.get("fetchBill") == 1,
            "is_bbps": result.get("BBPS") == 1,
            "parameters": result.get("data", []),
            "raw_response": result
        }
    except Exception as e:
        logging.error(f"Failed to get operator params: {e}")
        return {"success": False, "error": str(e), "operator_id": operator_id}


# ==================== ERROR CODES REFERENCE ENDPOINT ====================

@router.get("/error-codes")
async def get_all_error_codes():
    """
    Get complete list of Eko API error codes and transaction status codes
    Reference: https://developers.eko.in/docs/error-codes
    """
    return {
        "success": True,
        "documentation_url": "https://developers.eko.in/docs/error-codes",
        "notes": {
            "financial_transactions": "For all financial transactions, status = 0 should be treated as successful else fail",
            "non_financial_requests": "For non-financial requests, check both status and response_type_id parameters",
            "tx_status": "Current state of transaction can be retrieved from tx_status and txstatus_desc parameter"
        },
        "status_codes": EKO_STATUS_CODES,
        "tx_status_codes": EKO_TX_STATUS_CODES,
        "error_categories": {
            "user_agent": ["463", "327", "17", "31", "319", "1237", "585"],
            "otp": ["302", "303"],
            "recipient": ["342", "145", "140", "131", "122", "39", "313", "350", "536", "537", "44", "45"],
            "bank_ifsc": ["41", "48", "136", "508", "521"],
            "account": ["102", "46"],
            "transaction": ["317", "53", "55", "460", "344", "168", "544"],
            "balance_limit": ["347", "314", "945"],
            "http_server": ["400", "403", "404", "500", "503", "504"]
        },
        "retryable_errors": ["544", "503", "504", "55"],
        "manual_review_required": ["347", "314", "403", "319", "945"]
    }


@router.get("/error-codes/{code}")
async def get_specific_error(code: str):
    """Get details for a specific error code"""
    # Check if it's a status code
    if code in EKO_STATUS_CODES:
        return {
            "code": code,
            "type": "status_code",
            "message": EKO_STATUS_CODES[code],
            "is_retryable": is_retryable_error(code),
            "needs_manual_review": needs_manual_review(code)
        }
    
    # Check if it's a tx_status code
    try:
        tx_code = int(code)
        if tx_code in EKO_TX_STATUS_CODES:
            info = EKO_TX_STATUS_CODES[tx_code]
            return {
                "code": code,
                "type": "tx_status",
                "status": info["status"],
                "description": info["description"],
                "is_final": info["is_final"],
                "recommended_action": info["action"]
            }
    except ValueError:
        pass
    
    return {
        "code": code,
        "type": "unknown",
        "message": f"Error code {code} not found in documentation",
        "suggestion": "Contact Eko support for details"
    }


@router.get("/bbps/categories")
async def get_bill_categories():
    """Get available bill payment categories"""
    # Static list - can be fetched from Eko API
    categories = [
        {"id": "electricity", "name": "Electricity", "icon": "⚡"},
        {"id": "water", "name": "Water", "icon": "💧"},
        {"id": "gas", "name": "Gas/LPG", "icon": "🔥"},
        {"id": "mobile_postpaid", "name": "Mobile Postpaid", "icon": "📱"},
        {"id": "landline", "name": "Landline", "icon": "☎️"},
        {"id": "broadband", "name": "Broadband", "icon": "🌐"},
        {"id": "dth", "name": "DTH", "icon": "📺"},
        {"id": "fastag", "name": "FASTag", "icon": "🚗"},
        {"id": "insurance", "name": "Insurance", "icon": "🛡️"},
        {"id": "loan_emi", "name": "Loan EMI", "icon": "💰"},
        {"id": "credit_card", "name": "Credit Card", "icon": "💳"},
        {"id": "education", "name": "Education Fees", "icon": "🎓"},
        {"id": "municipal_tax", "name": "Municipal Tax", "icon": "🏛️"},
    ]
    return {"categories": categories}


@router.get("/bbps/billers/{category}")
async def get_billers_by_category(category: str):
    """Get list of billers for a category"""
    try:
        # Eko API endpoint for billers
        # Base URL already contains /ekoicici, so just add the remaining path
        result = await make_eko_request(
            "/v2/billpayments/operators",
            method="GET",
            data={"category": category}
        )
        return result
    except Exception as e:
        logging.warning(f"Eko billers API failed: {e}")
        # Return sample billers if API fails
        sample_billers = {
            "electricity": [
                {"id": "MSEB", "name": "Maharashtra State Electricity Board"},
                {"id": "TATA_POWER", "name": "Tata Power"},
                {"id": "ADANI", "name": "Adani Electricity"},
            ],
            "mobile_postpaid": [
                {"id": "JIO", "name": "Jio Postpaid"},
                {"id": "AIRTEL", "name": "Airtel Postpaid"},
                {"id": "VI", "name": "Vi Postpaid"},
            ]
        }
        return {"billers": sample_billers.get(category, []), "note": f"Sample data - {str(e)}"}


# ==================== EKO BBPS OPERATORS BY CATEGORY ====================
# Eko operator_category mapping:
# 1 = Broadband, 2 = Gas, 4 = DTH, 5 = Mobile Prepaid, 6 = Municipal Tax
# 7 = Credit Card, 8 = Electricity, 9 = Landline, 10 = Mobile Postpaid
# 11 = Water, 12 = Loan/EMI, 13 = Insurance, 14 = FASTag, etc.

EKO_CATEGORY_MAP = {
    "electricity": 8,
    "gas": 2,
    "water": 11,
    "dth": 4,
    "mobile_prepaid": 5,
    "mobile_postpaid": 10,
    "broadband": 1,
    "landline": 9,
    "credit_card": 7,
    "loan_emi": 21,
    "insurance": 20,
    "fastag": 22,
    "municipal_tax": 15,
    "lpg": 18,
    "education": 14,
    "cable_tv": 17,
    "hospital": 19
}

@router.get("/bbps/operators/{service_type}")
async def get_bbps_operators_by_service(service_type: str):
    """
    Get BBPS operators filtered by service type
    
    service_type: electricity, gas, water, dth, mobile_prepaid, mobile_postpaid, 
                  broadband, landline, credit_card, loan_emi, insurance, fastag, lpg
    """
    try:
        # Get all operators from Eko
        result = await make_eko_request(
            "/v2/billpayments/operators",
            method="GET"
        )
        
        all_operators = result.get("data", [])
        
        # Get category ID for filtering
        category_id = EKO_CATEGORY_MAP.get(service_type.lower())
        
        if category_id is not None:
            # Filter by category
            filtered = [
                {
                    "id": str(op.get("operator_id")),
                    "operator_id": op.get("operator_id"),
                    "name": op.get("name", ""),
                    "category": op.get("operator_category"),
                    "bill_fetch": op.get("billFetchResponse", 0) == 1,
                    "kyc_required": op.get("kyc_required", 0) == 1
                }
                for op in all_operators 
                if op.get("operator_category") == category_id
            ]
        else:
            # Return all operators if no category match
            filtered = [
                {
                    "id": str(op.get("operator_id")),
                    "operator_id": op.get("operator_id"),
                    "name": op.get("name", ""),
                    "category": op.get("operator_category"),
                    "bill_fetch": op.get("billFetchResponse", 0) == 1,
                    "kyc_required": op.get("kyc_required", 0) == 1
                }
                for op in all_operators
            ]
        
        # Sort by name
        filtered.sort(key=lambda x: x.get("name", ""))
        
        return {
            "success": True,
            "service_type": service_type,
            "category_id": category_id,
            "operators": filtered,
            "count": len(filtered),
            "source": "eko_api"
        }
        
    except Exception as e:
        logging.error(f"Failed to fetch BBPS operators: {e}")
        # Return fallback operators
        fallback = get_fallback_operators(service_type)
        return {
            "success": True,
            "service_type": service_type,
            "operators": fallback,
            "count": len(fallback),
            "source": "fallback",
            "error": str(e)
        }


def get_fallback_operators(service_type: str):
    """Fallback operators when Eko API fails"""
    fallbacks = {
        "electricity": [
            {"id": "22", "name": "BSES Rajdhani", "operator_id": 22},
            {"id": "23", "name": "BSES Yamuna", "operator_id": 23},
            {"id": "24", "name": "Tata Power - Delhi", "operator_id": 24},
            {"id": "62", "name": "MSEDCL (Maharashtra)", "operator_id": 62},
            {"id": "56", "name": "BESCOM (Bangalore)", "operator_id": 56},
            {"id": "149", "name": "TNEB (Tamil Nadu)", "operator_id": 149},
            {"id": "131", "name": "UPPCL", "operator_id": 131},
        ],
        "gas": [
            {"id": "28", "name": "Mahanagar Gas", "operator_id": 28},
            {"id": "50", "name": "Gujarat Gas", "operator_id": 50},
            {"id": "51", "name": "Adani Gas", "operator_id": 51},
            {"id": "65", "name": "Indraprastha Gas (IGL)", "operator_id": 65},
        ],
        "water": [
            {"id": "water_1", "name": "Delhi Jal Board", "operator_id": 0},
            {"id": "water_2", "name": "Mumbai Water", "operator_id": 0},
            {"id": "water_3", "name": "Bangalore Water Supply", "operator_id": 0},
        ],
        "dth": [
            {"id": "16", "name": "Dish TV", "operator_id": 16},
            {"id": "20", "name": "Tata Sky / Tata Play", "operator_id": 20},
            {"id": "21", "name": "Airtel DTH", "operator_id": 21},
            {"id": "95", "name": "D2H", "operator_id": 95},
            {"id": "111", "name": "Sun Direct", "operator_id": 111},
        ],
        "mobile_prepaid": [
            {"id": "1", "name": "Airtel Prepaid", "operator_id": 1},
            {"id": "5", "name": "BSNL Prepaid", "operator_id": 5},
            {"id": "90", "name": "Jio Prepaid", "operator_id": 90},
            {"id": "400", "name": "Vi Prepaid", "operator_id": 400},
        ],
        "mobile_postpaid": [
            {"id": "2", "name": "Airtel Postpaid", "operator_id": 2},
            {"id": "6", "name": "BSNL Postpaid", "operator_id": 6},
            {"id": "93", "name": "Jio Postpaid", "operator_id": 93},
            {"id": "401", "name": "Vi Postpaid", "operator_id": 401},
        ],
        "credit_card": [
            {"id": "5303", "name": "HDFC Credit Card", "operator_id": 5303},
            {"id": "5299", "name": "ICICI Credit Card", "operator_id": 5299},
            {"id": "5304", "name": "Axis Bank Credit Card", "operator_id": 5304},
            {"id": "5306", "name": "Yes Bank Credit Card", "operator_id": 5306},
        ],
        "loan_emi": [
            {"id": "340", "name": "Bajaj Finance", "operator_id": 340},
            {"id": "280", "name": "Tata Capital", "operator_id": 280},
            {"id": "476", "name": "LIC Housing Finance", "operator_id": 476},
            {"id": "2822", "name": "Mahindra Finance", "operator_id": 2822},
            {"id": "321", "name": "AU Bank Loan Repayment", "operator_id": 321},
        ],
        "lpg": [
            {"id": "438", "name": "Indane Gas (Indian Oil)", "operator_id": 438},
            {"id": "270", "name": "HP Gas", "operator_id": 270},
            {"id": "275", "name": "Bharat Gas (BPCL)", "operator_id": 275},
        ],
        "insurance": [
            {"id": "ins_1", "name": "ICICI Prudential Life Insurance", "operator_id": 0},
            {"id": "ins_2", "name": "LIC", "operator_id": 0},
        ],
        "fastag": [
            {"id": "fastag_1", "name": "Paytm FASTag", "operator_id": 0},
            {"id": "fastag_2", "name": "ICICI FASTag", "operator_id": 0},
        ]
    }
    return fallbacks.get(service_type.lower(), [])


# ==================== MOBILE RECHARGE APIs ====================

@router.get("/recharge/operators")
async def get_mobile_operators():
    """Get list of mobile operators for prepaid recharge"""
    try:
        result = await make_eko_request(
            "/v1/operators",
            method="GET",
            data={"service_type": "1"}  # 1 = Mobile prepaid
        )
        
        # Parse Eko response format
        operators = []
        if result.get("data"):
            for op in result.get("data", []):
                operators.append({
                    "id": op.get("operator_id"),
                    "name": op.get("operator_name"),
                    "code": op.get("operator_code"),
                    "icon": "📱"
                })
        
        return {"success": True, "operators": operators}
        
    except Exception as e:
        logging.warning(f"Eko operators API failed: {e}")
        # Fallback static operators
        static_operators = [
            {"id": "JIO", "name": "Jio", "code": "JIO", "icon": "📱"},
            {"id": "AIRTEL", "name": "Airtel", "code": "AIRTEL", "icon": "📱"},
            {"id": "VI", "name": "Vi (Vodafone Idea)", "code": "VI", "icon": "📱"},
            {"id": "BSNL", "name": "BSNL", "code": "BSNL", "icon": "📱"}
        ]
        return {"success": True, "operators": static_operators, "source": "fallback"}


@router.get("/recharge/circles")
async def get_recharge_circles():
    """Get list of telecom circles"""
    try:
        result = await make_eko_request(
            "/v1/circles",
            method="GET"
        )
        
        circles = []
        if result.get("data"):
            for c in result.get("data", []):
                circles.append({
                    "id": c.get("circle_id"),
                    "name": c.get("circle_name")
                })
        
        return {"success": True, "circles": circles}
        
    except Exception as e:
        logging.warning(f"Eko circles API failed: {e}")
        # Fallback static circles
        static_circles = [
            {"id": "MH", "name": "Maharashtra"},
            {"id": "MUM", "name": "Mumbai"},
            {"id": "DL", "name": "Delhi"},
            {"id": "KA", "name": "Karnataka"},
            {"id": "TN", "name": "Tamil Nadu"},
            {"id": "UP_E", "name": "UP East"},
            {"id": "UP_W", "name": "UP West"},
            {"id": "GJ", "name": "Gujarat"},
            {"id": "RJ", "name": "Rajasthan"},
            {"id": "AP", "name": "Andhra Pradesh"},
            {"id": "WB", "name": "West Bengal"},
            {"id": "KL", "name": "Kerala"},
            {"id": "PB", "name": "Punjab"},
            {"id": "HR", "name": "Haryana"},
            {"id": "MP", "name": "Madhya Pradesh"},
            {"id": "BH", "name": "Bihar"},
            {"id": "OR", "name": "Orissa"},
            {"id": "AS", "name": "Assam"},
            {"id": "NE", "name": "North East"},
            {"id": "HP", "name": "Himachal Pradesh"},
            {"id": "JK", "name": "Jammu & Kashmir"},
            {"id": "CHN", "name": "Chennai"},
            {"id": "KOL", "name": "Kolkata"}
        ]
        return {"success": True, "circles": static_circles, "source": "fallback"}


@router.get("/recharge/plans/{operator}/{circle}")
async def get_recharge_plans(operator: str, circle: str):
    """Get available recharge plans for an operator and circle - from database or fallback"""
    try:
        # First try to get plans from database (admin managed)
        if db is not None:
            db_plans = await db.recharge_plans.find(
                {"operator": operator.upper(), "is_active": True},
                {"_id": 0}
            ).sort("amount", 1).to_list(100)
            
            if db_plans and len(db_plans) > 0:
                return {"success": True, "plans": db_plans, "source": "database"}
        
        # Fallback to Eko API
        result = await make_eko_request(
            "/v1/recharge/plans",
            method="GET",
            data={
                "operator_id": operator,
                "circle_id": circle
            }
        )
        
        plans = []
        if result.get("data"):
            for p in result.get("data", []):
                plans.append({
                    "id": p.get("plan_id"),
                    "amount": p.get("amount"),
                    "description": p.get("description", p.get("talktime", "")),
                    "validity": p.get("validity"),
                    "plan_type": p.get("plan_type", ""),
                    "data": p.get("data", ""),
                    "talktime": p.get("talktime", "")
                })
        
        return {"success": True, "plans": plans}
        
    except Exception as e:
        logging.warning(f"Eko plans API failed: {e}")
        # Return REAL operator plans from hardcoded fallback
        real_plans = get_real_operator_plans(operator)
        return {"success": True, "plans": real_plans, "source": "cached"}


# ==================== ADMIN PLAN MANAGEMENT APIs ====================

class RechargePlanModel(BaseModel):
    operator: str
    amount: int
    description: str
    validity: str
    plan_type: str = "Data"
    data: Optional[str] = ""
    talktime: Optional[str] = ""
    is_active: bool = True


@router.post("/admin/plans/add")
async def add_recharge_plan(plan: RechargePlanModel):
    """Admin: Add a new recharge plan"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    plan_doc = {
        "id": f"{plan.operator.lower()}_{plan.amount}",
        "operator": plan.operator.upper(),
        "amount": plan.amount,
        "description": plan.description,
        "validity": plan.validity,
        "plan_type": plan.plan_type,
        "data": plan.data,
        "talktime": plan.talktime,
        "is_active": plan.is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - update if exists, insert if new
    await db.recharge_plans.update_one(
        {"operator": plan.operator.upper(), "amount": plan.amount},
        {"$set": plan_doc},
        upsert=True
    )
    
    return {"success": True, "message": f"Plan ₹{plan.amount} added for {plan.operator}"}


@router.get("/admin/plans/{operator}")
async def get_admin_plans(operator: str):
    """Admin: Get all plans for an operator"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    plans = await db.recharge_plans.find(
        {"operator": operator.upper()},
        {"_id": 0}
    ).sort("amount", 1).to_list(100)
    
    return {"success": True, "operator": operator.upper(), "plans": plans, "count": len(plans)}


@router.delete("/admin/plans/{operator}/{amount}")
async def delete_recharge_plan(operator: str, amount: int):
    """Admin: Delete a recharge plan"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    result = await db.recharge_plans.delete_one(
        {"operator": operator.upper(), "amount": amount}
    )
    
    if result.deleted_count > 0:
        return {"success": True, "message": f"Plan ₹{amount} deleted for {operator}"}
    else:
        raise HTTPException(status_code=404, detail="Plan not found")


@router.post("/admin/plans/seed")
async def seed_default_plans():
    """Admin: Seed database with default plans for all operators"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    operators = ["JIO", "AIRTEL", "VI", "BSNL"]
    total_added = 0
    
    for operator in operators:
        plans = get_real_operator_plans(operator)
        for plan in plans:
            plan_doc = {
                "id": plan.get("id", f"{operator.lower()}_{plan['amount']}"),
                "operator": operator,
                "amount": plan["amount"],
                "description": plan["description"],
                "validity": plan["validity"],
                "plan_type": plan.get("plan_type", "Data"),
                "data": plan.get("data", ""),
                "talktime": plan.get("talktime", ""),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.recharge_plans.update_one(
                {"operator": operator, "amount": plan["amount"]},
                {"$set": plan_doc},
                upsert=True
            )
            total_added += 1
    
    return {"success": True, "message": f"Seeded {total_added} plans for {len(operators)} operators"}


@router.put("/admin/plans/toggle/{operator}/{amount}")
async def toggle_plan_status(operator: str, amount: int):
    """Admin: Toggle plan active/inactive status"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    plan = await db.recharge_plans.find_one(
        {"operator": operator.upper(), "amount": amount}
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    new_status = not plan.get("is_active", True)
    
    await db.recharge_plans.update_one(
        {"operator": operator.upper(), "amount": amount},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": f"Plan ₹{amount} is now {'active' if new_status else 'inactive'}"}


# ==================== AUTO OPERATOR & CIRCLE DETECTION ====================

# Mobile number prefix to operator mapping (India)
MOBILE_PREFIX_TO_OPERATOR = {
    # Jio prefixes (9xxx, 8xxx, 7xxx series)
    "6": "JIO",  # Most 6xxx numbers are Jio
    "70": "JIO", "71": "JIO", "72": "JIO", "73": "JIO", "74": "JIO",
    "75": "JIO", "76": "JIO", "77": "JIO", "78": "JIO", "79": "JIO",
    "80": "JIO", "81": "JIO", "82": "JIO", "83": "JIO",
    "89": "JIO", "90": "JIO", 
    
    # Airtel prefixes
    "84": "AIRTEL", "85": "AIRTEL", "86": "AIRTEL", "87": "AIRTEL", "88": "AIRTEL",
    "91": "AIRTEL", "92": "AIRTEL", "93": "AIRTEL", "94": "AIRTEL",
    "95": "AIRTEL", "96": "AIRTEL", "97": "AIRTEL", "98": "AIRTEL", "99": "AIRTEL",
    
    # Vi (Vodafone Idea) prefixes
    "79": "VI", "80": "VI", "81": "VI", "82": "VI",
    "70": "VI", "72": "VI", "73": "VI", "74": "VI",
    "97": "VI", "98": "VI", "99": "VI",
    
    # BSNL prefixes
    "94": "BSNL",
}

# More accurate operator detection using first 4 digits
MOBILE_4DIGIT_TO_OPERATOR = {
    # Jio confirmed prefixes
    "6000": "JIO", "6001": "JIO", "6002": "JIO", "6003": "JIO",
    "6200": "JIO", "6201": "JIO", "6202": "JIO", "6203": "JIO",
    "6290": "JIO", "6291": "JIO", "6292": "JIO",
    "6370": "JIO", "6371": "JIO", "6372": "JIO",
    "7000": "JIO", "7001": "JIO", "7002": "JIO", "7003": "JIO",
    "7020": "JIO", "7021": "JIO", "7022": "JIO",
    "7038": "JIO", "7039": "JIO",
    "7066": "JIO", "7083": "JIO", "7208": "JIO", "7219": "JIO",
    "7304": "JIO", "7400": "JIO", "7506": "JIO", "7507": "JIO",
    "7666": "JIO", "7710": "JIO", "7715": "JIO", "7718": "JIO",
    "7738": "JIO", "7756": "JIO", "7757": "JIO",
    "8080": "JIO", "8081": "JIO", "8082": "JIO",
    "8160": "JIO", "8200": "JIO", "8238": "JIO", "8286": "JIO",
    "8291": "JIO", "8369": "JIO", "8454": "JIO", "8459": "JIO",
    "8469": "JIO", "8488": "JIO", "8511": "JIO",
    "8591": "JIO", "8600": "JIO", "8617": "JIO", "8655": "JIO",
    "8657": "JIO", "8668": "JIO", "8669": "JIO",
    "8779": "JIO", "8793": "JIO", "8796": "JIO", "8828": "JIO",
    "8850": "JIO", "8879": "JIO", "8898": "JIO",
    "9004": "JIO", "9029": "JIO", "9082": "JIO", "9137": "JIO",
    "9152": "JIO", "9167": "JIO", "9209": "JIO", "9220": "JIO",
    "9321": "JIO", "9324": "JIO", "9372": "JIO", "9403": "JIO",
    "9619": "JIO", "9702": "JIO", "9757": "JIO", "9819": "JIO",
    "9820": "JIO", "9821": "JIO", "9833": "JIO", "9860": "JIO",
    "9867": "JIO", "9869": "JIO", "9920": "JIO", "9930": "JIO",
    
    # Airtel confirmed prefixes
    "7303": "AIRTEL", "7838": "AIRTEL", "7982": "AIRTEL", "8010": "AIRTEL",
    "8076": "AIRTEL", "8130": "AIRTEL", "8178": "AIRTEL", "8285": "AIRTEL",
    "8375": "AIRTEL", "8376": "AIRTEL", "8377": "AIRTEL",
    "8447": "AIRTEL", "8448": "AIRTEL", "8527": "AIRTEL", "8584": "AIRTEL",
    "8587": "AIRTEL", "8588": "AIRTEL", "8595": "AIRTEL", "8700": "AIRTEL",
    "8744": "AIRTEL", "8750": "AIRTEL", "8800": "AIRTEL", "8826": "AIRTEL",
    "8860": "AIRTEL", "8882": "AIRTEL", "9205": "AIRTEL", "9211": "AIRTEL",
    "9212": "AIRTEL", "9250": "AIRTEL", "9289": "AIRTEL", "9310": "AIRTEL",
    "9311": "AIRTEL", "9312": "AIRTEL", "9350": "AIRTEL", "9540": "AIRTEL",
    "9555": "AIRTEL", "9560": "AIRTEL", "9599": "AIRTEL", "9650": "AIRTEL",
    "9654": "AIRTEL", "9711": "AIRTEL", "9717": "AIRTEL", "9718": "AIRTEL",
    "9810": "AIRTEL", "9811": "AIRTEL", "9818": "AIRTEL", "9868": "AIRTEL",
    "9871": "AIRTEL", "9873": "AIRTEL", "9899": "AIRTEL", "9910": "AIRTEL",
    "9911": "AIRTEL", "9953": "AIRTEL", "9958": "AIRTEL", "9971": "AIRTEL",
    "9990": "AIRTEL", "9999": "AIRTEL",
    
    # Vi (Vodafone Idea) confirmed prefixes  
    "7011": "VI", "7042": "VI", "7065": "VI", "7206": "VI", "7290": "VI",
    "7292": "VI", "7428": "VI", "7503": "VI", "7678": "VI", "7827": "VI",
    "7830": "VI", "7836": "VI", "7840": "VI", "7982": "VI", "8003": "VI",
    "8057": "VI", "8058": "VI", "8059": "VI", "8107": "VI", "8171": "VI",
    "8218": "VI", "8219": "VI", "8287": "VI", "8295": "VI", "8318": "VI",
    "8368": "VI", "8383": "VI", "8396": "VI", "8470": "VI", "8506": "VI",
    "8512": "VI", "8527": "VI", "8570": "VI", "8586": "VI", "8630": "VI",
    "8690": "VI", "8700": "VI", "8755": "VI", "8860": "VI", "9015": "VI",
    "9015": "VI", "9136": "VI", "9205": "VI", "9289": "VI", "9310": "VI",
    "9560": "VI", "9650": "VI", "9711": "VI", "9810": "VI", "9818": "VI",
    "9871": "VI", "9873": "VI", "9899": "VI", "9910": "VI", "9999": "VI",
    
    # BSNL prefixes
    "9402": "BSNL", "9415": "BSNL", "9425": "BSNL", "9435": "BSNL",
    "9447": "BSNL", "9448": "BSNL", "9449": "BSNL", "9450": "BSNL",
    "9452": "BSNL", "9454": "BSNL", "9455": "BSNL", "9456": "BSNL",
}

# Circle detection based on mobile number patterns
MOBILE_PREFIX_TO_CIRCLE = {
    # Maharashtra & Mumbai
    "98200": "MH", "98210": "MH", "98220": "MH", "98230": "MH",
    "98600": "MH", "98670": "MH", "98690": "MH",
    "88050": "MH", "88280": "MH", "88500": "MH", "88790": "MH",
    "90040": "MUM", "90820": "MUM", "91520": "MUM", "91670": "MUM",
    "93210": "MUM", "93240": "MUM", "93720": "MUM", "96190": "MUM",
    "97020": "MUM", "97570": "MUM", "98190": "MUM", "98200": "MUM",
    "98300": "MUM", "98330": "MUM", "98670": "MUM", "98690": "MUM",
    "99200": "MUM", "99300": "MUM",
    
    # Delhi NCR
    "98100": "DL", "98110": "DL", "98180": "DL", "98680": "DL",
    "98710": "DL", "98730": "DL", "98990": "DL", "99100": "DL",
    "99110": "DL", "99530": "DL", "99580": "DL", "99710": "DL",
    "99900": "DL", "99990": "DL",
    "87000": "DL", "87440": "DL", "87500": "DL", "88000": "DL",
    "88260": "DL", "88600": "DL", "88820": "DL",
    
    # Karnataka
    "98440": "KA", "98450": "KA", "98800": "KA", "98860": "KA",
    "97410": "KA", "97420": "KA", "97310": "KA",
    "80500": "KA", "81050": "KA", "81470": "KA", "81970": "KA",
    "87220": "KA", "87920": "KA", "88610": "KA",
    
    # Tamil Nadu & Chennai
    "98400": "TN", "98410": "TN", "98420": "TN", "98430": "TN",
    "97890": "TN", "97910": "TN", "98900": "TN",
    "90030": "CHN", "90420": "CHN", "90430": "CHN", "90920": "CHN",
    "94440": "CHN", "97100": "CHN", "97800": "CHN",
    
    # Gujarat
    "98240": "GJ", "98250": "GJ", "98790": "GJ", "98980": "GJ",
    "90990": "GJ", "91040": "GJ", "91060": "GJ",
    "70160": "GJ", "72020": "GJ", "75670": "GJ", "75750": "GJ",
    "78740": "GJ", "79840": "GJ", "81280": "GJ", "81600": "GJ",
    
    # UP East & West
    "97920": "UP_E", "97940": "UP_E", "98380": "UP_E", "98390": "UP_E",
    "94500": "UP_E", "94520": "UP_E", "94540": "UP_E", "94550": "UP_E",
    "98370": "UP_W", "98970": "UP_W", "95480": "UP_W",
    
    # Punjab & Haryana
    "98140": "PB", "98150": "PB", "98880": "PB", "94170": "PB",
    "98120": "HR", "98130": "HR", "99960": "HR", "96710": "HR",
    
    # Rajasthan
    "98280": "RJ", "98290": "RJ", "98290": "RJ",
    "70140": "RJ", "72300": "RJ", "76650": "RJ", "86900": "RJ",
    
    # West Bengal & Kolkata
    "98300": "WB", "98310": "WB", "98320": "WB", "98360": "WB",
    "90070": "KOL", "91630": "KOL", "93310": "KOL", "97480": "KOL",
}


def detect_operator_from_mobile(mobile: str) -> dict:
    """
    Detect operator and circle from mobile number
    Returns: {operator: str, circle: str, confidence: str}
    """
    if not mobile or len(mobile) < 10:
        return {"operator": None, "circle": None, "confidence": "none"}
    
    # Clean mobile number
    mobile = mobile.strip().replace(" ", "").replace("-", "")
    if mobile.startswith("+91"):
        mobile = mobile[3:]
    if mobile.startswith("91") and len(mobile) == 12:
        mobile = mobile[2:]
    
    if len(mobile) != 10 or not mobile.isdigit():
        return {"operator": None, "circle": None, "confidence": "none"}
    
    operator = None
    circle = None
    confidence = "low"
    
    # Try 4-digit prefix first (highest accuracy)
    prefix_4 = mobile[:4]
    if prefix_4 in MOBILE_4DIGIT_TO_OPERATOR:
        operator = MOBILE_4DIGIT_TO_OPERATOR[prefix_4]
        confidence = "high"
    else:
        # Try 2-digit prefix
        prefix_2 = mobile[:2]
        if prefix_2 in MOBILE_PREFIX_TO_OPERATOR:
            operator = MOBILE_PREFIX_TO_OPERATOR[prefix_2]
            confidence = "medium"
    
    # Try circle detection (5-digit prefix)
    prefix_5 = mobile[:5]
    if prefix_5 in MOBILE_PREFIX_TO_CIRCLE:
        circle = MOBILE_PREFIX_TO_CIRCLE[prefix_5]
    
    # Default circle based on common patterns
    if not circle:
        circle = "MH"  # Default to Maharashtra (most common)
    
    return {
        "operator": operator,
        "circle": circle,
        "confidence": confidence
    }


@router.get("/recharge/detect/{mobile}")
async def detect_operator_and_plans(mobile: str):
    """
    Auto-detect operator and circle from mobile number, then fetch plans
    Returns operator info and available plans
    """
    detection = detect_operator_from_mobile(mobile)
    
    if not detection["operator"]:
        return {
            "success": False,
            "message": "Could not detect operator from this number",
            "mobile": mobile,
            "detection": detection,
            "suggestions": [
                {"id": "JIO", "name": "Jio"},
                {"id": "AIRTEL", "name": "Airtel"},
                {"id": "VI", "name": "Vi (Vodafone Idea)"},
                {"id": "BSNL", "name": "BSNL"}
            ]
        }
    
    # Fetch plans for detected operator
    operator = detection["operator"]
    circle = detection["circle"] or "MH"
    
    try:
        # First try database
        plans = []
        if db is not None:
            db_plans = await db.recharge_plans.find(
                {"operator": operator, "is_active": True},
                {"_id": 0}
            ).sort("amount", 1).to_list(50)
            
            if db_plans and len(db_plans) > 0:
                plans = db_plans
        
        # Fallback to hardcoded plans
        if not plans:
            plans = get_real_operator_plans(operator)
        
        # Get operator display name
        operator_names = {
            "JIO": "Jio",
            "AIRTEL": "Airtel",
            "VI": "Vi (Vodafone Idea)",
            "BSNL": "BSNL"
        }
        
        # Get circle display name
        circle_names = {
            "MH": "Maharashtra",
            "MUM": "Mumbai",
            "DL": "Delhi NCR",
            "KA": "Karnataka",
            "TN": "Tamil Nadu",
            "CHN": "Chennai",
            "GJ": "Gujarat",
            "UP_E": "UP East",
            "UP_W": "UP West",
            "PB": "Punjab",
            "HR": "Haryana",
            "RJ": "Rajasthan",
            "WB": "West Bengal",
            "KOL": "Kolkata",
            "AP": "Andhra Pradesh",
            "KL": "Kerala",
            "MP": "Madhya Pradesh",
            "BH": "Bihar"
        }
        
        return {
            "success": True,
            "mobile": mobile,
            "detection": {
                "operator": operator,
                "operator_name": operator_names.get(operator, operator),
                "circle": circle,
                "circle_name": circle_names.get(circle, circle),
                "confidence": detection["confidence"]
            },
            "plans": plans,
            "plan_count": len(plans)
        }
        
    except Exception as e:
        logging.error(f"Error fetching plans: {e}")
        return {
            "success": True,
            "mobile": mobile,
            "detection": detection,
            "plans": [],
            "error": str(e)
        }


# ==================== DTH PLANS MANAGEMENT ====================

@router.get("/dth/plans/{operator}")
async def get_dth_plans(operator: str):
    """Get DTH plans for an operator - from database or fallback"""
    try:
        # First try database
        if db is not None:
            db_plans = await db.dth_plans.find(
                {"operator": operator.upper(), "is_active": True},
                {"_id": 0}
            ).sort("amount", 1).to_list(100)
            
            if db_plans and len(db_plans) > 0:
                return {"success": True, "plans": db_plans, "source": "database"}
        
        # Fallback to hardcoded DTH plans
        dth_plans = get_real_dth_plans(operator)
        return {"success": True, "plans": dth_plans, "source": "cached"}
        
    except Exception as e:
        logging.warning(f"DTH plans fetch failed: {e}")
        dth_plans = get_real_dth_plans(operator)
        return {"success": True, "plans": dth_plans, "source": "cached"}


def get_real_dth_plans(operator: str):
    """Get real DTH plans - updated periodically"""
    operator_upper = operator.upper()
    
    # Tata Play (Tata Sky) Plans
    tatasky_plans = [
        {"id": "tata_220", "amount": 220, "description": "Hindi Lite HD", "validity": "1 Month", "channels": "200+"},
        {"id": "tata_289", "amount": 289, "description": "Hindi Smart HD", "validity": "1 Month", "channels": "280+"},
        {"id": "tata_349", "amount": 349, "description": "Hindi Value HD", "validity": "1 Month", "channels": "320+"},
        {"id": "tata_449", "amount": 449, "description": "Hindi Premium HD", "validity": "1 Month", "channels": "400+"},
        {"id": "tata_499", "amount": 499, "description": "Super Value Pack", "validity": "1 Month", "channels": "450+"},
        {"id": "tata_599", "amount": 599, "description": "Ultra HD Pack", "validity": "1 Month", "channels": "500+"},
    ]
    
    # Airtel Digital TV Plans
    airtel_dth_plans = [
        {"id": "airdth_195", "amount": 195, "description": "Value Lite HD", "validity": "1 Month", "channels": "180+"},
        {"id": "airdth_260", "amount": 260, "description": "Value Sports HD", "validity": "1 Month", "channels": "220+"},
        {"id": "airdth_325", "amount": 325, "description": "Value Prime HD", "validity": "1 Month", "channels": "280+"},
        {"id": "airdth_410", "amount": 410, "description": "Premium HD", "validity": "1 Month", "channels": "350+"},
        {"id": "airdth_499", "amount": 499, "description": "All Sports HD", "validity": "1 Month", "channels": "400+"},
    ]
    
    # Dish TV Plans
    dishtv_plans = [
        {"id": "dish_216", "amount": 216, "description": "Super Family HD", "validity": "1 Month", "channels": "190+"},
        {"id": "dish_296", "amount": 296, "description": "Diamond HD", "validity": "1 Month", "channels": "270+"},
        {"id": "dish_350", "amount": 350, "description": "Diamond Sports HD", "validity": "1 Month", "channels": "300+"},
        {"id": "dish_449", "amount": 449, "description": "Platinum HD", "validity": "1 Month", "channels": "380+"},
        {"id": "dish_549", "amount": 549, "description": "Titanium HD", "validity": "1 Month", "channels": "450+"},
    ]
    
    # D2H Plans
    d2h_plans = [
        {"id": "d2h_220", "amount": 220, "description": "Gold HD", "validity": "1 Month", "channels": "200+"},
        {"id": "d2h_280", "amount": 280, "description": "Gold Sports HD", "validity": "1 Month", "channels": "250+"},
        {"id": "d2h_350", "amount": 350, "description": "Diamond HD", "validity": "1 Month", "channels": "300+"},
        {"id": "d2h_450", "amount": 450, "description": "Diamond Sports HD", "validity": "1 Month", "channels": "380+"},
        {"id": "d2h_550", "amount": 550, "description": "Platinum HD", "validity": "1 Month", "channels": "450+"},
    ]
    
    # Sun Direct Plans
    sundirect_plans = [
        {"id": "sun_199", "amount": 199, "description": "Bronze HD", "validity": "1 Month", "channels": "150+"},
        {"id": "sun_299", "amount": 299, "description": "Silver HD", "validity": "1 Month", "channels": "220+"},
        {"id": "sun_399", "amount": 399, "description": "Gold HD", "validity": "1 Month", "channels": "300+"},
        {"id": "sun_499", "amount": 499, "description": "Platinum HD", "validity": "1 Month", "channels": "380+"},
    ]
    
    if "TATA" in operator_upper or "SKY" in operator_upper:
        return tatasky_plans
    elif "AIRTEL" in operator_upper:
        return airtel_dth_plans
    elif "DISH" in operator_upper:
        return dishtv_plans
    elif "D2H" in operator_upper or "VIDEOCON" in operator_upper:
        return d2h_plans
    elif "SUN" in operator_upper:
        return sundirect_plans
    else:
        return tatasky_plans  # Default


@router.post("/admin/dth/plans/seed")
async def seed_dth_plans():
    """Admin: Seed database with DTH plans"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    operators = ["TATA_SKY", "AIRTEL_DTH", "DISH_TV", "D2H", "SUN_DIRECT"]
    total_added = 0
    
    for operator in operators:
        plans = get_real_dth_plans(operator)
        for plan in plans:
            plan_doc = {
                "id": plan.get("id"),
                "operator": operator,
                "amount": plan["amount"],
                "description": plan["description"],
                "validity": plan["validity"],
                "channels": plan.get("channels", ""),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.dth_plans.update_one(
                {"operator": operator, "amount": plan["amount"]},
                {"$set": plan_doc},
                upsert=True
            )
            total_added += 1
    
    return {"success": True, "message": f"Seeded {total_added} DTH plans for {len(operators)} operators"}


@router.get("/admin/dth/plans/{operator}")
async def get_admin_dth_plans(operator: str):
    """Admin: Get all DTH plans for an operator"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    plans = await db.dth_plans.find(
        {"operator": operator.upper()},
        {"_id": 0}
    ).sort("amount", 1).to_list(100)
    
    return {"success": True, "operator": operator.upper(), "plans": plans, "count": len(plans)}

# ==================== END ADMIN PLAN MANAGEMENT ====================


def get_real_operator_plans(operator: str):
    """Get real operator plans - updated periodically"""
    operator_upper = operator.upper()
    
    # JIO Plans (Updated Dec 2025)
    jio_plans = [
        {"id": "jio_149", "amount": 149, "description": "Unlimited calls + 1GB/day + 100 SMS/day", "validity": "14 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "jio_199", "amount": 199, "description": "Unlimited calls + 1.5GB/day + 100 SMS/day", "validity": "14 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "jio_249", "amount": 249, "description": "Unlimited calls + 1.5GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "jio_299", "amount": 299, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_349", "amount": 349, "description": "Unlimited calls + 2GB/day + 100 SMS/day + JioTV", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_449", "amount": 449, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "56 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_479", "amount": 479, "description": "Unlimited calls + 1.5GB/day + Disney+ Hotstar", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "jio_599", "amount": 599, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "84 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_666", "amount": 666, "description": "Unlimited calls + 1.5GB/day", "validity": "84 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "jio_899", "amount": 899, "description": "Unlimited calls + 2GB/day + Netflix", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_2999", "amount": 2999, "description": "Unlimited calls + 2.5GB/day", "validity": "365 days", "plan_type": "Data", "data": "2.5GB/day"},
        {"id": "jio_19", "amount": 19, "description": "Data Pack - 1GB", "validity": "1 day", "plan_type": "Data Add-on", "data": "1GB"},
        {"id": "jio_51", "amount": 51, "description": "Data Pack - 6GB", "validity": "28 days", "plan_type": "Data Add-on", "data": "6GB"},
    ]
    
    # AIRTEL Plans (Updated Dec 2025)
    airtel_plans = [
        {"id": "air_179", "amount": 179, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_265", "amount": 265, "description": "Unlimited calls + 1GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "air_299", "amount": 299, "description": "Unlimited calls + 1.5GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "air_349", "amount": 349, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_455", "amount": 455, "description": "Unlimited calls + 1GB/day", "validity": "84 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "air_479", "amount": 479, "description": "Unlimited calls + 1.5GB/day + Disney+ Hotstar", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "air_549", "amount": 549, "description": "Unlimited calls + 2GB/day", "validity": "56 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_666", "amount": 666, "description": "Unlimited calls + 1.5GB/day", "validity": "77 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "air_719", "amount": 719, "description": "Unlimited calls + 1.5GB/day", "validity": "84 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "air_839", "amount": 839, "description": "Unlimited calls + 2GB/day", "validity": "84 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_2999", "amount": 2999, "description": "Unlimited calls + 2GB/day", "validity": "365 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_19", "amount": 19, "description": "Talktime ₹14.95", "validity": "NA", "plan_type": "Talktime", "talktime": "₹14.95"},
    ]
    
    # VI (Vodafone Idea) Plans (Updated Dec 2025)
    vi_plans = [
        {"id": "vi_179", "amount": 179, "description": "Unlimited calls + 2GB total", "validity": "28 days", "plan_type": "Data", "data": "2GB total"},
        {"id": "vi_269", "amount": 269, "description": "Unlimited calls + 1GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "vi_299", "amount": 299, "description": "Unlimited calls + 1.5GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "vi_349", "amount": 349, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "vi_479", "amount": 479, "description": "Unlimited calls + 1.5GB/day + Disney+ Hotstar", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "vi_539", "amount": 539, "description": "Unlimited calls + 1GB/day", "validity": "84 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "vi_719", "amount": 719, "description": "Unlimited calls + 1.5GB/day", "validity": "84 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "vi_839", "amount": 839, "description": "Unlimited calls + 2GB/day", "validity": "84 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "vi_2899", "amount": 2899, "description": "Unlimited calls + 1.5GB/day", "validity": "365 days", "plan_type": "Data", "data": "1.5GB/day"},
    ]
    
    # BSNL Plans (Updated Dec 2025)
    bsnl_plans = [
        {"id": "bsnl_107", "amount": 107, "description": "Unlimited calls + 1GB/day", "validity": "21 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "bsnl_187", "amount": 187, "description": "Unlimited calls + 2GB/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "bsnl_247", "amount": 247, "description": "Unlimited calls + 1GB/day", "validity": "30 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "bsnl_397", "amount": 397, "description": "Unlimited calls + 2GB/day", "validity": "60 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "bsnl_447", "amount": 447, "description": "Unlimited calls + 1GB/day", "validity": "60 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "bsnl_485", "amount": 485, "description": "Unlimited calls + 1.5GB/day", "validity": "90 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "bsnl_997", "amount": 997, "description": "Unlimited calls + 2GB/day", "validity": "180 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "bsnl_1999", "amount": 1999, "description": "Unlimited calls + 2GB/day", "validity": "365 days", "plan_type": "Data", "data": "2GB/day"},
    ]
    
    # Return based on operator
    if "JIO" in operator_upper:
        return jio_plans
    elif "AIRTEL" in operator_upper:
        return airtel_plans
    elif "VI" in operator_upper or "VODAFONE" in operator_upper or "IDEA" in operator_upper:
        return vi_plans
    elif "BSNL" in operator_upper:
        return bsnl_plans
    else:
        # Generic fallback
        return jio_plans  # Default to Jio plans


@router.post("/recharge/process")
async def process_mobile_recharge(
    mobile_number: str,
    operator_id: str,
    amount: float,
    circle_id: str = None,
    user_id: str = None
):
    """Process mobile prepaid recharge via Eko BBPS API"""
    try:
        txn_ref = f"RCH{datetime.now().strftime('%Y%m%d%H%M%S')}{mobile_number[-4:]}"
        user_code = EKO_USER_CODE or '20810200'
        amount_str = str(int(amount))
        
        # Map operator name to Eko numeric operator_id
        # Eko requires numeric IDs, not string names
        OPERATOR_ID_MAP = {
            # Mobile Prepaid (Category 5)
            "AIRTEL": "1", "AIRTEL PREPAID": "1", "1": "1",
            "JIO": "90", "JIO PREPAID": "90", "90": "90",
            "VI": "400", "VI PREPAID": "400", "VODAFONE": "400", "IDEA": "400", "400": "400",
            "BSNL": "5", "BSNL PREPAID": "5", "BSNL  PREPAID": "5", "5": "5",
            "MTNL DELHI": "91", "MTNL DELHI PREPAID": "91", "91": "91",
            "MTNL MUMBAI": "508", "MTNL MUMBAI PREPAID": "508", "508": "508",
            
            # DTH (Category 4)
            "DISH TV": "16", "DISH": "16", "16": "16",
            "TATA SKY": "20", "TATA PLAY": "20", "TATASKY": "20", "20": "20",
            "AIRTEL DTH": "21", "AIRTEL DIGITAL TV": "21", "21": "21",
            "D2H": "95", "VIDEOCON D2H": "95", "VIDEOCON": "95", "95": "95",
            "BIG TV": "17", "BIG TV DTH": "17", "BIGTV": "17", "17": "17",
            "SUN DIRECT": "111", "SUNDIRECT": "111", "111": "111",
        }
        
        # Convert operator_id to Eko numeric ID
        eko_operator_id = OPERATOR_ID_MAP.get(operator_id.upper().strip(), operator_id)
        
        logging.info(f"Operator mapping: {operator_id} -> {eko_operator_id}")
        
        # Use EXACT same method as test-paybill (which works!)
        timestamp = get_secret_key_timestamp()
        secret_key = generate_secret_key(timestamp)
        request_hash = generate_request_hash(timestamp, mobile_number, amount_str, user_code)

        url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"

        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "request_hash": request_hash,
            "Content-Type": "application/json"
        }

        body = {
            "initiator_id": EKO_INITIATOR_ID,  # Required in body as per Eko docs
            "utility_acc_no": mobile_number,
            "confirmation_mobile_no": EKO_INITIATOR_ID,
            "sender_name": "Customer",
            "operator_id": eko_operator_id,  # Use mapped numeric ID
            "amount": amount_str,
            "client_ref_id": txn_ref,
            "source_ip": "127.0.0.1",
            "latlong": "19.0760,72.8777",
            "user_code": user_code
        }
        
        logging.info(f"=== EKO RECHARGE REQUEST ===")
        logging.info(f"URL: {url}")
        logging.info(f"Operator: {operator_id} -> Eko ID: {eko_operator_id}")
        logging.info(f"Mobile: {mobile_number}, Amount: {amount_str}")
        logging.info(f"Body: {body}")
        logging.info(f"=== END REQUEST ===")

        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            response = await client.post(url, headers=headers, json=body)
            
            logging.info(f"=== EKO RECHARGE RESPONSE ===")
            logging.info(f"HTTP Status: {response.status_code}")
            logging.info(f"Response Body: {response.text[:1000]}")
            logging.info(f"=== END RESPONSE ===")
            
            # Handle non-JSON responses (like HTML error pages)
            try:
                result = response.json()
            except Exception as json_error:
                logging.error(f"JSON Parse Error: {json_error}")
                logging.error(f"Raw Response: {response.text}")
                
                # Check for common error patterns in raw response
                raw = response.text.lower()
                if "forbidden" in raw or "403" in raw:
                    error_msg = "Access denied (403) - IP not whitelisted or service not activated"
                elif "unauthorized" in raw or "401" in raw:
                    error_msg = "Authentication failed (401) - Check developer_key"
                elif "not found" in raw or "404" in raw:
                    error_msg = "Endpoint not found (404) - Check API URL"
                elif "<!doctype" in raw or "<html" in raw:
                    error_msg = "Received HTML instead of JSON - API endpoint error"
                else:
                    error_msg = f"Invalid response from Eko API: {response.text[:200]}"
                
                return {
                    "success": False,
                    "txn_ref": txn_ref,
                    "message": f"Eko Error: {error_msg}",
                    "http_status": response.status_code,
                    "raw_response": response.text[:500]
                }
        
        # DEBUG: Log full response
        logging.info(f"=== EKO RECHARGE PARSED RESPONSE ===")
        logging.info(f"Full response: {result}")
        logging.info(f"=== END RESPONSE ===")
        
        # Check for Eko-specific errors first
        eko_status = result.get("status")
        response_status_id = result.get("response_status_id")
        tx_status = result.get("tx_status")
        message = result.get("message", "")
        
        # Get error details if present
        if eko_status and eko_status != 0 and eko_status != "0":
            error_msg = get_eko_error_message(eko_status)
            logging.warning(f"Eko returned error status {eko_status}: {error_msg}")
        
        # Check if Eko returned success
        # Eko uses status=0 for success OR message contains "Success"
        is_success = (
            (eko_status == 0 or eko_status == "0") or 
            (response_status_id == 0 or response_status_id == "0") or
            (tx_status == 0 or tx_status == "0") or
            "Success" in message
        )
        
        # Check for failure indicators
        if "fail" in message.lower() or "invalid" in message.lower() or "error" in message.lower():
            is_success = False
        
        # Log transaction
        if db is not None:
            await db.eko_transactions.insert_one({
                "type": "mobile_recharge",
                "user_id": user_id,
                "mobile_number": mobile_number,
                "operator_id": operator_id,
                "amount": amount,
                "circle_id": circle_id,
                "txn_ref": txn_ref,
                "eko_response": result,
                "status": "success" if is_success else "failed",
                "eko_status": eko_status,
                "eko_tx_status": tx_status,
                "timestamp": datetime.now(timezone.utc)
            })
        
        if is_success:
            return {
                "success": True,
                "txn_ref": txn_ref,
                "eko_txn_id": result.get("tid") or result.get("txstatus_desc"),
                "eko_status": eko_status,
                "tx_status": tx_status,
                "message": result.get("message", "Recharge successful!"),
                "eko_response": result
            }
        else:
            # Return failure with details
            error_msg = result.get("message") or result.get("txstatus_desc") or "Recharge failed"
            return {
                "success": False,
                "txn_ref": txn_ref,
                "eko_status": eko_status,
                "tx_status": tx_status,
                "message": f"Eko Error: {error_msg}",
                "eko_response": result
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Mobile recharge failed: {e}")
        raise HTTPException(status_code=500, detail=f"Recharge failed: {str(e)}")


@router.get("/dth/operators")
async def get_dth_operators():
    """Get list of DTH operators"""
    try:
        result = await make_eko_request(
            "/v1/operators",
            method="GET",
            data={"service_type": "2"}  # 2 = DTH
        )
        
        operators = []
        if result.get("data"):
            for op in result.get("data", []):
                operators.append({
                    "id": op.get("operator_id"),
                    "name": op.get("operator_name"),
                    "code": op.get("operator_code"),
                    "icon": "📺"
                })
        
        return {"success": True, "operators": operators}
        
    except Exception as e:
        logging.warning(f"Eko DTH operators API failed: {e}")
        static_operators = [
            {"id": "TATA_SKY", "name": "Tata Play (Tata Sky)", "code": "TATASKY", "icon": "📺"},
            {"id": "AIRTEL_DTH", "name": "Airtel Digital TV", "code": "AIRTEL", "icon": "📺"},
            {"id": "DISH_TV", "name": "Dish TV", "code": "DISHTV", "icon": "📺"},
            {"id": "D2H", "name": "D2H Videocon", "code": "D2H", "icon": "📺"},
            {"id": "SUN_DIRECT", "name": "Sun Direct", "code": "SUNDIRECT", "icon": "📺"}
        ]
        return {"success": True, "operators": static_operators, "source": "fallback"}


@router.post("/bbps/fetch-bill")
async def fetch_bill(request: BillFetchRequest):
    """
    Fetch bill details before payment
    Required for services like Electricity, Gas, Water where bill amount needs to be fetched first
    """
    try:
        utility_acc_no = list(request.customer_params.values())[0] if request.customer_params else ""
        client_ref_id = f"FETCH{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Eko API call to fetch bill
        result = await make_eko_request(
            "/v2/billpayments/fetchbill",
            method="POST",
            data={
                "utility_acc_no": utility_acc_no,
                "operator_id": request.biller_id,
                "confirmation_mobile_no": EKO_INITIATOR_ID,
                "sender_name": "Customer",
                "user_code": EKO_USER_CODE,
                "client_ref_id": client_ref_id,
                "source_ip": "127.0.0.1",
                "latlong": "19.0760,72.8777"
            }
        )
        
        # Log the fetch
        if db is not None:
            await db.bill_fetch_logs.insert_one({
                "category": request.category,
                "biller_id": request.biller_id,
                "customer_params": request.customer_params,
                "response": result,
                "timestamp": datetime.now(timezone.utc)
            })
        
        # Parse Eko response and return structured data
        eko_status = result.get("status")
        
        if eko_status == 0:
            # Success - bill fetched
            data = result.get("data", {})
            return {
                "success": True,
                "bill_amount": data.get("amount"),
                "customer_name": data.get("utilitycustomername"),
                "bill_date": data.get("billdate"),
                "due_date": data.get("duedate"),
                "bill_number": data.get("billnumber"),
                "billfetchresponse": data.get("billfetchresponse"),  # Required for payment
                "raw_response": result
            }
        else:
            # Error from Eko
            error_msg = result.get("message", "Bill fetch failed")
            return {
                "success": False,
                "error_code": str(eko_status),
                "message": error_msg,
                "raw_response": result
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Bill fetch failed: {e}")
        return {
            "success": False,
            "message": f"Bill fetch failed: {str(e)}"
        }


@router.post("/bbps/pay-bill")
async def pay_bill(request: BillPayRequest):
    """
    Pay a bill through BBPS
    Supports: Electricity, Gas, Water, DTH, Broadband, Mobile Postpaid, etc.
    """
    try:
        # Create unique transaction reference
        txn_ref = f"PARAS{datetime.now().strftime('%Y%m%d%H%M%S')}{str(request.user_id)[-6:]}"
        utility_acc_no = list(request.customer_params.values())[0] if request.customer_params else ""
        
        # Build request body
        request_body = {
            "utility_acc_no": utility_acc_no,
            "operator_id": request.biller_id,
            "amount": str(int(request.amount)),
            "confirmation_mobile_no": EKO_INITIATOR_ID,
            "sender_name": request.customer_params.get("sender_name", "Customer"),
            "client_ref_id": txn_ref,
            "user_code": EKO_USER_CODE,
            "source_ip": "127.0.0.1",
            "latlong": "19.0760,72.8777"
        }
        
        # Add billfetchresponse if available (required for some operators)
        if request.bill_fetch_ref:
            request_body["billfetchresponse"] = request.bill_fetch_ref
        
        # Eko API call to pay bill
        result = await make_eko_request(
            "/v2/billpayments/paybill",
            method="POST",
            data=request_body
        )
        
        # Log transaction
        if db is not None:
            await db.eko_transactions.insert_one({
                "type": "bill_payment",
                "user_id": request.user_id,
                "category": request.category,
                "biller_id": request.biller_id,
                "customer_params": request.customer_params,
                "amount": request.amount,
                "txn_ref": txn_ref,
                "eko_response": result,
                "status": result.get("status", "pending"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        # Parse Eko response
        eko_status = result.get("status")
        data = result.get("data", {})
        
        if eko_status == 0:
            # Success
            return {
                "success": True,
                "txn_ref": txn_ref,
                "eko_tid": data.get("tid"),
                "utr": data.get("bbpstrxnrefid"),
                "status": "SUCCESS",
                "message": result.get("message", "Bill payment successful")
            }
        else:
            # Failed - return clear error
            error_msg = result.get("message", "Payment failed")
            return {
                "success": False,
                "txn_ref": txn_ref,
                "error_code": str(eko_status),
                "status": "FAILED",
                "message": error_msg
            }
        
    except HTTPException as e:
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e.detail) if hasattr(e, 'detail') else str(e)
        }
    except Exception as e:
        logging.error(f"Bill payment failed: {e}")
        return {
            "success": False,
            "status": "FAILED",
            "message": f"Payment failed: {str(e)}"
        }


@router.get("/bbps/transaction-status/{txn_ref}")
async def get_bill_transaction_status(txn_ref: str):
    """Get status of a bill payment transaction"""
    try:
        result = await make_eko_request(
            "/v2/billpayments/status",
            method="GET",
            data={"client_ref_id": txn_ref}
        )
        return result
    except Exception:
        # Check local database
        if db is not None:
            txn = await db.eko_transactions.find_one(
                {"txn_ref": txn_ref},
                {"_id": 0}
            )
            if txn:
                return {"transaction": txn, "source": "local_db"}
        raise HTTPException(status_code=404, detail="Transaction not found")


# ==================== DMT (Money Transfer) APIs ====================

@router.post("/dmt/register-sender")
async def register_dmt_sender(mobile: str, name: str):
    """Register a sender for DMT"""
    try:
        result = await make_eko_request(
            "/v2/customers",
            method="POST",
            data={
                "mobile": mobile,
                "name": name
            }
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sender registration failed: {str(e)}")


@router.get("/dmt/sender/{mobile}")
async def get_sender_details(mobile: str):
    """Get sender details and KYC status"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{mobile}",
            method="GET"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Sender not found: {str(e)}")


@router.post("/dmt/add-recipient")
async def add_dmt_recipient(request: DMTRecipientRequest):
    """Add a bank account recipient for DMT"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{request.customer_mobile}/recipients",
            method="POST",
            data={
                "recipient_name": request.recipient_name,
                "recipient_mobile": request.recipient_mobile,
                "bank_ifsc": request.bank_ifsc,
                "account": request.account_number
            }
        )
        
        # Log recipient addition
        if db is not None:
            await db.dmt_recipients.insert_one({
                "customer_mobile": request.customer_mobile,
                "recipient_name": request.recipient_name,
                "bank_ifsc": request.bank_ifsc,
                "account_last4": request.account_number[-4:],
                "eko_recipient_id": result.get("recipient_id"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recipient addition failed: {str(e)}")


@router.get("/dmt/recipients/{mobile}")
async def get_dmt_recipients(mobile: str):
    """Get list of recipients for a sender"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{mobile}/recipients",
            method="GET"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Recipients not found: {str(e)}")


@router.post("/dmt/verify-account")
async def verify_bank_account(ifsc: str, account_number: str):
    """Verify bank account before transfer"""
    try:
        result = await make_eko_request(
            "/v2/banks/ifsc/accounts/verify",
            method="POST",
            data={
                "ifsc": ifsc,
                "account": account_number
            }
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Account verification failed: {str(e)}")


@router.post("/dmt/send-otp")
async def send_dmt_otp(mobile: str, amount: float):
    """Send OTP for DMT transaction"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{mobile}/otp",
            method="POST",
            data={"amount": str(int(amount))}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OTP sending failed: {str(e)}")


@router.post("/dmt/transfer")
async def initiate_dmt_transfer(request: DMTTransferRequest):
    """Initiate money transfer to bank account"""
    try:
        # Create unique transaction reference
        txn_ref = f"DMT{datetime.now().strftime('%Y%m%d%H%M%S')}{request.user_id[-6:]}"
        
        result = await make_eko_request(
            f"/v2/customers/{request.customer_mobile}/transfer",
            method="POST",
            data={
                "recipient_id": request.recipient_id,
                "amount": str(int(request.amount)),
                "otp": request.otp,
                "client_ref_id": txn_ref,
                "latlong": "19.0760,72.8777",
                "source_ip": "34.170.12.145"
            }
        )
        
        # Log transaction
        if db is not None:
            await db.eko_transactions.insert_one({
                "type": "dmt_transfer",
                "user_id": request.user_id,
                "customer_mobile": request.customer_mobile,
                "recipient_id": request.recipient_id,
                "amount": request.amount,
                "txn_ref": txn_ref,
                "eko_response": result,
                "status": result.get("status", "pending"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        return {
            "success": True,
            "txn_ref": txn_ref,
            "eko_txn_id": result.get("tid"),
            "status": result.get("status"),
            "message": result.get("message", "Transfer initiated")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"DMT transfer failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")


@router.get("/dmt/transaction-status/{txn_ref}")
async def get_dmt_transaction_status(txn_ref: str):
    """Get status of a DMT transaction"""
    try:
        result = await make_eko_request(
            "/v2/transactions/status",
            method="GET",
            data={"client_ref_id": txn_ref}
        )
        return result
    except Exception:
        # Check local database
        if db is not None:
            txn = await db.eko_transactions.find_one(
                {"txn_ref": txn_ref},
                {"_id": 0}
            )
            if txn:
                return {"transaction": txn, "source": "local_db"}
        raise HTTPException(status_code=404, detail="Transaction not found")


# ==================== TRANSACTION HISTORY ====================

@router.get("/transactions/{user_id}")
async def get_user_eko_transactions(user_id: str, limit: int = 50):
    """Get user's Eko transaction history"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    transactions = await db.eko_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(None)
    
    return {"transactions": transactions}


# ==================== WEBHOOK ====================

@router.post("/webhook")
async def eko_webhook(request: Request):
    """Handle Eko transaction status callbacks"""
    try:
        payload = await request.json()
        
        txn_ref = payload.get("client_ref_id")
        status = payload.get("status")
        eko_txn_id = payload.get("tid")
        
        logging.info(f"Eko webhook: {txn_ref} - {status}")
        
        # Update transaction status
        if db is not None and txn_ref:
            await db.eko_transactions.update_one(
                {"txn_ref": txn_ref},
                {
                    "$set": {
                        "status": status,
                        "eko_txn_id": eko_txn_id,
                        "webhook_data": payload,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
        
        return {"status": "ok"}
        
    except Exception as e:
        logging.error(f"Eko webhook error: {e}")
        return {"status": "error", "message": str(e)}



# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/status")
async def get_eko_integration_status():
    """Get Eko integration status and configuration"""
    try:
        from services.eko_service import EkoConfig
        
        config_status = EkoConfig.get_config_status()
        
        # Try to get balance if configured
        balance_info = {"balance": 0, "error": None}
        if config_status["configured"]:
            try:
                from services.eko_service import EkoService
                service = EkoService(db)
                balance_response = await service.check_wallet_balance()
                if balance_response.success:
                    balance_info = {
                        "balance": balance_response.data.get("balance", 0),
                        "currency": "INR"
                    }
                else:
                    balance_info["error"] = balance_response.message
            except Exception as e:
                balance_info["error"] = str(e)
        
        return {
            "success": True,
            "configuration": config_status,
            "wallet": balance_info,
            "status": "operational" if config_status["configured"] else "not_configured"
        }
    except ImportError:
        return {
            "success": False,
            "configuration": {"configured": False},
            "wallet": {"balance": 0},
            "status": "service_unavailable"
        }


@router.get("/admin/transaction/{transaction_id}")
async def get_transaction_status_admin(transaction_id: str, use_client_ref: bool = False):
    """
    Admin endpoint to check transaction status from Eko
    
    Args:
        transaction_id: Eko TID or client reference ID
        use_client_ref: If true, treat transaction_id as client reference
    """
    try:
        from services.eko_service import EkoService
        
        service = EkoService(db)
        response = await service.check_transaction_status(transaction_id, use_client_ref)
        
        return {
            "success": response.success,
            "transaction_id": transaction_id,
            "eko_tid": response.eko_tid,
            "tx_status": response.tx_status.value if response.tx_status else None,
            "tx_status_desc": response.tx_status.description if response.tx_status else None,
            "utr_number": response.utr_number,
            "message": response.message,
            "data": response.data
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="Eko service not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/sync-pending")
async def sync_pending_eko_transactions():
    """
    Manually trigger sync of all pending Eko transactions
    Updates status from Eko API for transactions in pending/processing state
    """
    try:
        from services.eko_service import EkoService, EkoStatusUpdater
        
        service = EkoService(db)
        updater = EkoStatusUpdater(db, service)
        
        # Sync bank withdrawal requests
        bank_result = await updater.update_pending_transactions("bank_withdrawal_requests")
        
        # Sync bill payment requests
        bill_result = await updater.update_pending_transactions("bill_payment_requests")
        
        return {
            "success": True,
            "results": {
                "bank_withdrawals": bank_result,
                "bill_payments": bill_result
            },
            "total_updated": bank_result.get("updated", 0) + bill_result.get("updated", 0),
            "total_checked": bank_result.get("checked", 0) + bill_result.get("checked", 0)
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="Eko service not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/verify-account")
async def verify_bank_account_admin(request: Request):
    """
    Admin endpoint to verify bank account details
    
    Request body:
    {
        "ifsc": "HDFC0001234",
        "account_number": "1234567890"
    }
    """
    try:
        from services.eko_service import EkoService
        
        data = await request.json()
        ifsc = data.get("ifsc")
        account_number = data.get("account_number")
        
        if not ifsc or not account_number:
            raise HTTPException(status_code=400, detail="IFSC and account number required")
        
        service = EkoService(db)
        response = await service.verify_bank_account(ifsc, account_number)
        
        return {
            "success": response.success,
            "verified": response.success,
            "account_holder": response.data.get("account_holder") if response.data else None,
            "message": response.message
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="Eko service not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/logs")
async def get_eko_transaction_logs(
    page: int = 1,
    limit: int = 50,
    status: str = None
):
    """
    Get Eko transaction logs for admin monitoring
    """
    try:
        query = {}
        if status:
            query["success"] = status.lower() == "success"
        
        skip = (page - 1) * limit
        
        logs = await db.eko_transaction_logs.find(
            query, {"_id": 0}
        ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
        
        total = await db.eko_transaction_logs.count_documents(query)
        
        return {
            "success": True,
            "logs": logs,
            "total": total,
            "page": page,
            "total_pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STATUS CODES REFERENCE ====================
@router.get("/status-codes")
async def get_eko_status_codes():
    """Get reference for Eko transaction status codes"""
    return {
        "transaction_status": {
            "0": "Success - Transaction completed successfully",
            "1": "Failed - Transaction failed",
            "2": "Initiated/Response Awaited - NEFT pending or awaiting bank response",
            "3": "Refund Pending - Transaction failed, refund in process",
            "4": "Refunded - Amount has been refunded",
            "5": "Hold - Transaction on hold, inquiry required"
        },
        "error_codes": {
            "44": "Customer not found",
            "45": "Recipient not found",
            "131": "Invalid OTP",
            "302": "Insufficient balance",
            "303": "Daily limit exceeded",
            "304": "Monthly limit exceeded",
            "305": "Invalid amount",
            "306": "Invalid IFSC",
            "307": "Invalid account number",
            "308": "Account verification failed",
            "309": "Transfer failed - bank error",
            "310": "Transfer timeout",
            "311": "Duplicate transaction",
            "312": "Invalid recipient",
            "403": "Access denied - IP not whitelisted",
            "500": "Internal server error",
            "503": "Service temporarily unavailable"
        },
        "channels": {
            "1": "NEFT - National Electronic Funds Transfer (batch, slower)",
            "2": "IMPS - Immediate Payment Service (instant)"
        }
    }



# ==================== ADMIN DIRECT API ENDPOINTS ====================
# These endpoints are for admin-only direct access to Eko services
# No approval workflow required

class AdminPayBillRequest(BaseModel):
    utility_acc_no: str
    operator_id: str
    amount: float
    bill_type: str = "electricity"  # electricity, dth, mobile_prepaid, etc.

@router.post("/bbps/paybill")
async def admin_direct_paybill(request: AdminPayBillRequest):
    """
    Admin Direct Bill Payment via Eko BBPS API
    Supports: DTH, Electricity, Gas, Mobile Postpaid, Broadband, etc.
    """
    try:
        txn_ref = f"ADM{datetime.now().strftime('%Y%m%d%H%M%S')}{request.utility_acc_no[-4:]}"
        
        result = await make_eko_request(
            f"/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}",
            method="POST",
            data={
                "utility_acc_no": request.utility_acc_no,
                "confirmation_mobile_no": EKO_INITIATOR_ID,
                "sender_name": "Customer",
                "operator_id": str(request.operator_id),
                "amount": str(int(request.amount)),
                "client_ref_id": txn_ref,
                "source_ip": "127.0.0.1",
                "latlong": "19.0760,72.8777",
                "user_code": EKO_USER_CODE
            }
        )
        
        # Log transaction
        if db is not None:
            await db.admin_eko_transactions.insert_one({
                "type": f"admin_{request.bill_type}",
                "utility_acc_no": request.utility_acc_no,
                "operator_id": request.operator_id,
                "amount": request.amount,
                "txn_ref": txn_ref,
                "eko_response": result,
                "status": result.get("status", "pending"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        # Parse Eko response
        eko_status = result.get("status")
        data = result.get("data", {})
        
        # Check if transaction was successful
        if eko_status == 0:
            return {
                "success": True,
                "txn_ref": txn_ref,
                "eko_tid": data.get("tid"),
                "utr": data.get("bbpstrxnrefid"),
                "status": "SUCCESS",
                "message": f"{request.bill_type.replace('_', ' ').title()} payment successful"
            }
        else:
            # Return clear error message
            error_msg = result.get("message", "Payment failed")
            return {
                "success": False,
                "txn_ref": txn_ref,
                "error_code": str(eko_status) if eko_status else "UNKNOWN",
                "status": "FAILED",
                "message": error_msg
            }
        
    except HTTPException as e:
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e.detail) if hasattr(e, 'detail') else str(e)
        }
    except Exception as e:
        logging.error(f"Admin direct paybill failed: {e}")
        return {
            "success": False,
            "status": "FAILED",
            "message": f"Payment failed: {str(e)}"
        }



@router.post("/test-paybill")
async def test_paybill_direct(mobile: str = "9936606966", amount: str = "29"):
    """Direct test of paybill API - for debugging"""
    user_code = EKO_USER_CODE or '20810200'
    amount_str = str(int(float(amount)))
    
    # Use EXACT same method as recharge/process
    timestamp = get_secret_key_timestamp()
    secret_key = generate_secret_key(timestamp)
    request_hash = generate_request_hash(timestamp, mobile, amount_str, user_code)

    url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"

    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "request_hash": request_hash,
        "Content-Type": "application/json"
    }

    body = {
        "utility_acc_no": mobile,
        "confirmation_mobile_no": EKO_INITIATOR_ID,
        "sender_name": "Customer",
        "operator_id": "90",
        "amount": amount_str,
        "client_ref_id": f"TEST{timestamp[-8:]}",
        "source_ip": "127.0.0.1",
        "latlong": "19.0760,72.8777",
        "user_code": user_code
    }

    async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
        response = await client.post(url, headers=headers, json=body)
        return {
            "request": {"url": url, "headers": headers, "body": body},
            "response": {"status": response.status_code, "body": response.json()}
        }


# ==================== BBPS BILL PAYMENT (FORM-URLENCODED) ====================

@router.post("/bbps/pay-bill-v2")
async def bbps_pay_bill_form(
    utility_acc_no: str = Query(..., description="Consumer/Account number"),
    operator_id: str = Query(..., description="Eko operator ID"),
    amount: str = Query(..., description="Payment amount in INR"),
    sender_name: str = Query("ParasReward", description="Sender/Customer name"),
    reference_id: str = Query(None, description="Optional reference ID")
):
    """
    BBPS Bill Payment API using application/x-www-form-urlencoded format.
    
    This is the CORRECT format for BBPS services:
    - DTH (category 4)
    - Electricity (category 8)
    - Gas (category 2)
    - EMI/Loan (category 21)
    - Water (category 11)
    
    The request_hash formula for BBPS is:
    HMAC-SHA256(timestamp + utility_acc_no + amount + operator_id + reference_id, base64(auth_key))
    
    Args:
        utility_acc_no: Consumer/Account number
        operator_id: Eko operator ID (e.g., 16 for Dish TV, 62 for MSEDCL)
        amount: Payment amount in INR
        sender_name: Sender/Customer name
        reference_id: Optional reference ID (auto-generated if not provided)
    """
    import requests as req
    
    try:
        # Step 1: Generate timestamp (milliseconds)
        timestamp = str(int(time.time() * 1000))
        
        # Step 2: Generate secret-key using Base64 encoded key (as per Eko Reference docs)
        encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
        secret_key = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        # Step 3: Generate reference_id if not provided
        if not reference_id:
            reference_id = f"BBPS{datetime.now().strftime('%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"
        
        # Step 4: Generate request_hash using Base64 encoded key
        # BBPS hash formula: timestamp + utility_acc_no + amount + user_code
        raw_string = timestamp + utility_acc_no + amount + EKO_USER_CODE
        
        request_hash = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), raw_string.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        # Step 5: Prepare JSON body
        url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"
        
        body = {
            "source_ip": "127.0.0.1",
            "user_code": EKO_USER_CODE,
            "amount": amount,
            "client_ref_id": reference_id,
            "utility_acc_no": utility_acc_no,
            "confirmation_mobile_no": EKO_INITIATOR_ID,
            "sender_name": sender_name,
            "operator_id": operator_id,
            "latlong": "19.0760,72.8777"
        }
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "request_hash": request_hash,
            "Content-Type": "application/json"
        }
        
        body_json = json.dumps(body, separators=(',', ':'))
        
        logging.info(f"=== BBPS PAY BILL (JSON) ===")
        logging.info(f"URL: {url}")
        logging.info(f"Operator: {operator_id}, Account: {utility_acc_no[-4:] if utility_acc_no else 'NA'}, Amount: {amount}")
        logging.info(f"Hash raw string: {raw_string[:50]}...")
        logging.info(f"Request Hash: {request_hash}")
        
        # Use data=body_json
        response = req.post(url, data=body_json, headers=headers, timeout=60)
        
        logging.info(f"Response Status: {response.status_code}")
        logging.info(f"Response Body: {response.text[:300]}")
        
        if response.status_code == 403:
            return {
                "success": False,
                "http_status": 403,
                "error": "Access denied (403). Please verify IP whitelist with Eko.",
                "request_details": {
                    "url": url,
                    "operator_id": operator_id,
                    "utility_acc_no": utility_acc_no[-4:] if utility_acc_no else "NA",
                    "amount": amount
                }
            }
        
        try:
            result = response.json()
        except:
            return {
                "success": False,
                "http_status": response.status_code,
                "error": f"Invalid response: {response.text[:200]}",
                "parse_error": True
            }
        
        # Check Eko response status
        eko_status = result.get("status")
        tx_status = result.get("data", {}).get("tx_status")
        
        if eko_status == 0:
            return {
                "success": True,
                "http_status": response.status_code,
                "eko_response": result,
                "transaction": {
                    "tid": result.get("data", {}).get("tid"),
                    "utr": result.get("data", {}).get("bbpstrxnrefid"),
                    "client_ref_id": reference_id,
                    "message": result.get("message", "Bill payment successful")
                }
            }
        elif tx_status == 2:
            return {
                "success": True,
                "http_status": response.status_code,
                "eko_response": result,
                "transaction": {
                    "tid": result.get("data", {}).get("tid"),
                    "status": "PROCESSING",
                    "client_ref_id": reference_id,
                    "message": "Payment initiated, processing"
                }
            }
        else:
            return {
                "success": False,
                "http_status": response.status_code,
                "eko_response": result,
                "error": result.get("message", f"Eko error code: {eko_status}")
            }
            
    except Exception as e:
        logging.error(f"BBPS pay bill error: {e}")
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


async def execute_bbps_bill_payment(
    utility_acc_no: str,
    operator_id: str,
    amount: str,
    customer_mobile: str = None,
    reference_id: str = None
) -> dict:
    """
    Execute BBPS bill payment via Eko API.
    Used for DTH, Gas, EMI services.
    
    OFFICIAL EKO DOCUMENTATION FORMAT:
    - Content-Type: application/json
    - secret-key: Base64(HMAC_SHA256(timestamp, encoded_key))
    - request_hash: Base64(HMAC_SHA256(timestamp + utility_acc_no + amount + user_code, encoded_key))
    - encoded_key = base64_encode(access_key)
    - Body: JSON with operator_id, utility_acc_no, amount
    - API call: json=payload
    """
    import requests as req
    
    try:
        # Step 1: Generate timestamp (13 digits - milliseconds)
        timestamp = str(int(time.time() * 1000))
        
        # Step 2: Use Base64 encoded key (as per Eko Reference docs)
        encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
        
        # Step 3: Generate secret-key
        secret_key = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        # Step 4: Generate request_hash
        # request_hash = timestamp + utility_acc_no + amount + user_code
        concatenated_string = timestamp + utility_acc_no + amount + EKO_USER_CODE
        
        request_hash = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), concatenated_string.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        # Step 5: Prepare URL
        url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"
        
        # Step 6: Headers
        headers = {
            "Content-Type": "application/json",
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "request_hash": request_hash
        }
        
        # Step 7: JSON body - SAME FORMAT as working mobile recharge
        client_ref_id = f"BBPS{int(time.time())}"
        payload = {
            "source_ip": "127.0.0.1",
            "user_code": EKO_USER_CODE,
            "amount": amount,
            "client_ref_id": client_ref_id,
            "utility_acc_no": utility_acc_no,
            "confirmation_mobile_no": EKO_INITIATOR_ID,
            "sender_name": "ParasReward",
            "operator_id": str(operator_id),
            "latlong": "19.0760,72.8777"
        }
        
        logging.info(f"[BBPS] URL: {url}")
        logging.info(f"[BBPS] Operator: {operator_id}, Account: {utility_acc_no[-4:] if utility_acc_no else 'NA'}, Amount: {amount}")
        logging.info(f"[BBPS] Hash concat: {concatenated_string[:50]}...")
        
        # Step 8: API call with data=json_string (SAME AS WORKING RECHARGE)
        body_json = json.dumps(payload, separators=(',', ':'))
        response = req.post(url, headers=headers, data=body_json, timeout=60)
        
        logging.info(f"[BBPS] Response: {response.status_code}")
        logging.info(f"[BBPS] Body: {response.text[:300]}")
        
        if response.status_code == 403:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": "403",
                "message": "Access denied (403). Check IP whitelist or credentials."
            }
        
        try:
            result = response.json()
        except:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": str(response.status_code),
                "message": f"Invalid response: {response.text[:100]}"
            }
        
        eko_status = result.get("status")
        tx_status = result.get("data", {}).get("tx_status")
        eko_tid = result.get("data", {}).get("tid")
        bbps_ref = result.get("data", {}).get("bbpstrxnrefid")
        
        if eko_status == 0:
            return {
                "success": True,
                "status": "SUCCESS",
                "eko_tid": eko_tid,
                "utr": bbps_ref,
                "message": result.get("message", "Payment successful")
            }
        elif tx_status == 2:
            return {
                "success": True,
                "status": "PROCESSING",
                "eko_tid": eko_tid,
                "message": "Payment processing"
            }
        else:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": str(eko_status),
                "eko_tid": eko_tid,
                "message": result.get("message", f"Eko error: {eko_status}")
            }
            
    except Exception as e:
        logging.error(f"[BBPS] Error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e)
        }



# ==================== ELECTRICITY BILL PAYMENT (DEDICATED) ====================

async def execute_electricity_payment(
    consumer_number: str,
    operator_id: str,
    amount: str,
    customer_mobile: str = None
) -> dict:
    """
    Execute ELECTRICITY bill payment via Eko API.
    
    OFFICIAL EKO DOCUMENTATION FORMAT:
    - Content-Type: application/json
    - secret-key: Base64(HMAC_SHA256(timestamp, encoded_key))
    - request_hash: Base64(HMAC_SHA256(timestamp + utility_acc_no + amount + user_code, encoded_key))
    - encoded_key = base64_encode(access_key)
    - Body: JSON with operator_id, utility_acc_no, amount
    - API call: json=payload
    
    NOTE: Testing showed timestamp + utility_acc_no + amount (without user_code) also worked.
    Using official formula with user_code for consistency.
    """
    import requests as req
    
    try:
        # Step 1: Generate timestamp (13 digits - milliseconds)
        timestamp = str(int(time.time() * 1000))
        
        # Step 2: Use Base64 encoded key (as per Eko Reference docs)
        encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
        
        # Step 3: Generate secret-key
        secret_key = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        # Step 4: Generate request_hash
        # For Bill Payments: timestamp + utility_acc_no + amount + user_code
        concatenated_string = timestamp + consumer_number + amount + EKO_USER_CODE
        
        request_hash = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), concatenated_string.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        
        # Step 5: Prepare URL
        url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"
        
        # Step 6: Headers
        headers = {
            "Content-Type": "application/json",
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "request_hash": request_hash
        }
        
        # Step 7: JSON body - SAME FORMAT as working mobile recharge
        client_ref_id = f"ELEC{int(time.time())}"
        payload = {
            "source_ip": "127.0.0.1",
            "user_code": EKO_USER_CODE,
            "amount": amount,
            "client_ref_id": client_ref_id,
            "utility_acc_no": consumer_number,
            "confirmation_mobile_no": EKO_INITIATOR_ID,
            "sender_name": "ParasReward",
            "operator_id": str(operator_id),
            "latlong": "19.0760,72.8777"
        }
        
        logging.info(f"=== ELECTRICITY PAYMENT ===")
        logging.info(f"URL: {url}")
        logging.info(f"Consumer: {consumer_number[-4:] if consumer_number else 'NA'}")
        logging.info(f"Operator: {operator_id}, Amount: {amount}")
        logging.info(f"Hash concat: {concatenated_string[:50]}...")
        
        # Step 8: API call with data=json_string (SAME AS WORKING MOBILE RECHARGE)
        body_json = json.dumps(payload, separators=(',', ':'))
        response = req.post(url, headers=headers, data=body_json, timeout=60)
        
        logging.info(f"Response: {response.status_code}")
        logging.info(f"Body: {response.text[:500]}")
        
        if response.status_code == 403:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": "403",
                "message": "Access denied (403). Check IP whitelist or credentials."
            }
        
        try:
            result = response.json()
        except:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": str(response.status_code),
                "message": f"Non-JSON response: {response.text[:200]}"
            }
        
        logging.info(f"Eko Response: {result}")
        
        eko_status = result.get("status")
        tx_status = result.get("data", {}).get("tx_status")
        eko_tid = result.get("data", {}).get("tid")
        bbps_ref = result.get("data", {}).get("bbpstrxnrefid")
        
        if eko_status == 0:
            return {
                "success": True,
                "status": "SUCCESS",
                "eko_tid": eko_tid,
                "utr": bbps_ref,
                "message": result.get("message", "Electricity payment successful")
            }
        elif tx_status == 2:
            return {
                "success": True,
                "status": "PROCESSING",
                "eko_tid": eko_tid,
                "message": "Payment processing"
            }
        else:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": str(eko_status),
                "eko_tid": eko_tid,
                "message": result.get("message", f"Eko error: {eko_status}")
            }
            
    except Exception as e:
        logging.error(f"[ELECTRICITY] Error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e)
        }


@router.post("/electricity/pay")
async def electricity_pay_endpoint(
    consumer_number: str = Query(..., description="Consumer/Account number"),
    operator_id: str = Query(..., description="Eko electricity operator ID"),
    amount: str = Query(..., description="Bill amount in INR"),
    customer_mobile: str = Query(None, description="Customer mobile number")
):
    """
    Test endpoint for electricity bill payment.
    Uses official Eko documentation format.
    """
    return await execute_electricity_payment(
        consumer_number=consumer_number,
        operator_id=operator_id,
        amount=amount,
        customer_mobile=customer_mobile
    )



# ==================== DMT v3 (DOMESTIC MONEY TRANSFER) APIs ====================
# EKO DMT v3 PRODUCTION FORMAT:
# Base URL: https://api.eko.in:25002/ekoapi/v3
# Content-Type: application/json
# Hash Formula for Transfer: timestamp + customer_id + recipient_id + amount + client_ref_id

DMT_BASE_URL = "https://api.eko.in:25002/ekoicici/v1"


class DMTRecipientRequestV3(BaseModel):
    """Request model for adding bank recipient (v3)"""
    customer_id: str
    recipient_name: str
    bank_code: str
    account_number: str
    ifsc: str
    recipient_mobile: str


class DMTTransferRequestV3(BaseModel):
    """Request model for money transfer (v3)"""
    customer_id: str
    recipient_id: str
    amount: int
    channel: str = "IMPS"  # IMPS or NEFT
    client_ref_id: str = None


def generate_dmt_v3_headers(timestamp: str = None, request_hash: str = None, content_type: str = None):
    """Generate authentication headers for DMT APIs using Base64 encoded key"""
    if not timestamp:
        timestamp = str(int(time.time() * 1000))
    
    # Use Base64 encoded key (as per Eko Reference docs)
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
    
    secret_key = base64.b64encode(
        hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
    }
    
    # Only add Content-Type if specified
    if content_type:
        headers["Content-Type"] = content_type
    
    if request_hash:
        headers["request_hash"] = request_hash
    
    return headers, encoded_key, timestamp


def generate_dmt_v3_request_hash(encoded_key: str, raw_string: str) -> str:
    """Generate request_hash for DMT v3 financial transactions using Base64 encoded key"""
    return base64.b64encode(
        hmac.new(encoded_key.encode('utf-8'), raw_string.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')


@router.get("/dmt/v3/customer/{mobile}")
async def get_dmt_customer_v3(mobile: str):
    """
    STEP 1: Check if Customer exists
    
    API: GET /ekoapi/v3/customer/profile/{mobile}
    Query params: initiator_id, user_code, service_code
    No request_hash required.
    
    Returns: Customer info if exists, or status 333 if not found
    """
    import requests as req
    
    try:
        headers, _, _ = generate_dmt_v3_headers()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        
        url = f"{DMT_BASE_URL}/customers/mobile_number:{mobile}"
        
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[DMT-v3] Check customer: {mobile}")
        logging.info(f"[DMT-v3] URL: {url}")
        
        response = req.get(url, headers=headers, params=params, timeout=30)
        
        logging.info(f"[DMT-v3] Status: {response.status_code}")
        logging.info(f"[DMT-v3] Response: {response.text[:500]}")
        
        try:
            result = response.json()
            customer_exists = result.get("status") == 0
            customer_data = result.get("data", {})
            
            return {
                "success": True,
                "customer_exists": customer_exists,
                "customer_data": customer_data if customer_exists else None,
                "available_limit": customer_data.get("available_limit", 0) if customer_exists else 25000,
                "used_limit": customer_data.get("used_limit", 0) if customer_exists else 0,
                "state": customer_data.get("state", 0) if customer_exists else 0,
                "state_desc": {
                    0: "Not Registered",
                    1: "OTP Verification Pending",
                    2: "OTP Verified (Non-KYC)",
                    3: "KYC Verification Pending",
                    4: "Full KYC Verified",
                    5: "Name Change Pending",
                    8: "Partial KYC"
                }.get(customer_data.get("state", 0), "Unknown"),
                "raw_response": result
            }
        except:
            return {
                "success": False,
                "http_status": response.status_code,
                "error": response.text[:300]
            }
            
    except Exception as e:
        logging.error(f"[DMT-v3] Error: {e}")
        return {"success": False, "error": str(e)}


@router.post("/dmt/v3/customer/create")
async def create_dmt_customer_v3(
    mobile: str,
    name: str,
    dob: str = None,  # Format: YYYY-MM-DD
    address: str = None
):
    """
    STEP 2: Create new customer (Sends OTP to mobile)
    
    API: PUT /ekoapi/v3/customers/{mobile}
    Content-Type: application/x-www-form-urlencoded
    
    After this, call verify OTP API to complete registration
    """
    import requests as req
    
    try:
        headers, encoded_key, timestamp = generate_dmt_v3_headers()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        
        url = f"{DMT_BASE_URL}/customers/mobile_number:{mobile}"
        
        # Form data for creating customer
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "name": name,
            "pipe": "9",  # Default DMT pipe
            "user_code": EKO_USER_CODE
        }
        
        # Optional fields
        if dob:
            data["dob"] = dob
        if address:
            data["residence_address"] = json.dumps({"address": address})
        
        logging.info(f"[DMT-v3] Create customer: {mobile}")
        logging.info(f"[DMT-v3] URL: {url}")
        logging.info(f"[DMT-v3] Data: {data}")
        
        response = req.put(url, headers=headers, data=data, timeout=30)
        
        logging.info(f"[DMT-v3] Status: {response.status_code}")
        logging.info(f"[DMT-v3] Response: {response.text[:500]}")
        
        try:
            result = response.json()
            eko_status = result.get("status")
            
            if eko_status == 0:
                return {
                    "success": True,
                    "message": "OTP sent to customer mobile. Call verify OTP to complete registration.",
                    "customer_mobile": mobile,
                    "otp_ref_id": result.get("data", {}).get("otp_ref_id"),
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to create customer"),
                    "error_code": str(eko_status),
                    "raw_response": result
                }
        except:
            return {
                "success": False,
                "http_status": response.status_code,
                "error": response.text[:300]
            }
            
    except Exception as e:
        logging.error(f"[DMT-v3] Error: {e}")
        return {"success": False, "error": str(e)}


@router.post("/dmt/v3/customer/verify-otp")
async def verify_dmt_customer_otp_v3(
    mobile: str,
    otp: str,
    otp_ref_id: str = None
):
    """
    STEP 3: Verify OTP to complete customer registration
    
    API: PUT /ekoapi/v3/customers/verification/{mobile}
    Content-Type: application/x-www-form-urlencoded
    """
    import requests as req
    
    try:
        headers, _, _ = generate_dmt_v3_headers()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        
        url = f"{DMT_BASE_URL}/customers/verification/otp:{mobile}"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "otp": otp
        }
        
        if otp_ref_id:
            data["otp_ref_id"] = otp_ref_id
        
        logging.info(f"[DMT-v3] Verify OTP for: {mobile}")
        logging.info(f"[DMT-v3] URL: {url}")
        
        response = req.put(url, headers=headers, data=data, timeout=30)
        
        logging.info(f"[DMT-v3] Status: {response.status_code}")
        logging.info(f"[DMT-v3] Response: {response.text[:500]}")
        
        try:
            result = response.json()
            eko_status = result.get("status")
            
            if eko_status == 0:
                return {
                    "success": True,
                    "message": "Customer verified successfully!",
                    "customer_mobile": mobile,
                    "customer_data": result.get("data", {}),
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "OTP verification failed"),
                    "error_code": str(eko_status),
                    "raw_response": result
                }
        except:
            return {
                "success": False,
                "http_status": response.status_code,
                "error": response.text[:300]
            }
            
    except Exception as e:
        logging.error(f"[DMT-v3] Error: {e}")
        return {"success": False, "error": str(e)}


@router.get("/dmt/v3/customer/{mobile}/recipients")
async def get_dmt_recipients_v3(mobile: str):
    """
    STEP 4: Get list of recipients (beneficiaries) for a customer
    
    API: GET /ekoicici/v1/customers/mobile_number:{mobile}/recipients
    """
    import requests as req
    
    try:
        headers, _, _ = generate_dmt_v3_headers()
        # Remove Content-Type for GET request
        if "Content-Type" in headers:
            del headers["Content-Type"]
        
        url = f"{DMT_BASE_URL}/customers/mobile_number:{mobile}/recipients"
        
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[DMT-v3] Get recipients for: {mobile}")
        logging.info(f"[DMT-v3] URL: {url}")
        
        response = req.get(url, headers=headers, params=params, timeout=30)
        
        logging.info(f"[DMT-v3] Status: {response.status_code}")
        logging.info(f"[DMT-v3] Response: {response.text[:500]}")
        
        try:
            result = response.json()
            
            if result.get("status") == 0:
                recipients = result.get("data", {}).get("recipient_list", [])
                return {
                    "success": True,
                    "customer_mobile": mobile,
                    "recipients": recipients,
                    "count": len(recipients),
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to fetch recipients"),
                    "raw_response": result
                }
        except:
            return {
                "success": False,
                "http_status": response.status_code,
                "error": response.text[:300]
            }
            
    except Exception as e:
        logging.error(f"[DMT-v3] Error: {e}")
        return {"success": False, "error": str(e)}


@router.post("/dmt/v3/recipient/add")
async def add_dmt_recipient_v3(request: DMTRecipientRequestV3):
    """
    STEP 5: Add Beneficiary/Recipient
    
    API: PUT /ekoicici/v1/customers/mobile_number:{mobile}/recipients
    Content-Type: application/x-www-form-urlencoded
    """
    import requests as req
    
    try:
        headers, encoded_key, timestamp = generate_dmt_v3_headers(content_type="application/x-www-form-urlencoded")
        
        url = f"{DMT_BASE_URL}/customers/mobile_number:{request.customer_id}/recipients"
        
        # Form data for adding recipient
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "recipient_name": request.recipient_name,
            "bank_ifsc": request.ifsc,
            "account": request.account_number,
            "recipient_mobile": request.recipient_mobile or request.customer_id,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[DMT] Add recipient for customer: {request.customer_id}")
        logging.info(f"[DMT] URL: {url}")
        logging.info(f"[DMT] Data: {data}")
        
        # Use PUT with form data
        response = req.put(url, headers=headers, data=data, timeout=30)
        
        logging.info(f"[DMT] Status: {response.status_code}")
        logging.info(f"[DMT] Response: {response.text[:500]}")
        
        try:
            result = response.json()
            eko_status = result.get("status")
            
            if eko_status == 0:
                recipient_data = result.get("data", {})
                return {
                    "success": True,
                    "message": "Recipient added successfully!",
                    "recipient_id": recipient_data.get("recipient_id"),
                    "recipient_id_type": recipient_data.get("recipient_id_type"),
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to add recipient"),
                    "error_code": str(eko_status),
                    "raw_response": result
                }
        except:
            return {
                "success": False,
                "http_status": response.status_code,
                "error": response.text[:300]
            }
            
    except Exception as e:
        logging.error(f"[DMT] Error: {e}")
        return {"success": False, "error": str(e)}


@router.post("/dmt/v3/transfer")
async def initiate_dmt_transfer_v3(request: DMTTransferRequestV3):
    """
    STEP 3: DMT Money Transfer
    
    API: POST /ekoapi/v3/transactions
    Content-Type: application/json
    
    request_hash RAW STRING: timestamp + customer_id + recipient_id + amount + client_ref_id
    """
    import requests as req
    
    try:
        # Generate client_ref_id if not provided
        client_ref_id = request.client_ref_id or f"TXN{datetime.now().strftime('%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"
        
        headers, encoded_key, timestamp = generate_dmt_v3_headers()
        
        # request_hash RAW STRING: timestamp + customer_id + recipient_id + amount + client_ref_id
        raw_string = timestamp + request.customer_id + request.recipient_id + str(request.amount) + client_ref_id
        request_hash = generate_dmt_v3_request_hash(encoded_key, raw_string)
        headers["request_hash"] = request_hash
        
        url = f"{DMT_BASE_URL}/transactions"
        
        payload = {
            "service_code": "45",
            "customer_id": request.customer_id,
            "recipient_id": request.recipient_id,
            "amount": request.amount,
            "channel": request.channel,
            "client_ref_id": client_ref_id
        }
        
        logging.info(f"[DMT-v3] Transfer: {request.amount} to {request.recipient_id}")
        logging.info(f"[DMT-v3] URL: {url}")
        logging.info(f"[DMT-v3] Hash raw: {raw_string[:60]}...")
        logging.info(f"[DMT-v3] Payload: {payload}")
        
        response = req.post(url, json=payload, headers=headers, timeout=60)
        
        logging.info(f"[DMT-v3] Status: {response.status_code}")
        logging.info(f"[DMT-v3] Response: {response.text[:500]}")
        
        try:
            result = response.json()
            
            eko_status = result.get("status")
            tx_status = result.get("data", {}).get("tx_status")
            
            if eko_status == 0:
                return {
                    "success": True,
                    "status": "SUCCESS",
                    "http_status": response.status_code,
                    "data": result,
                    "transaction": {
                        "tid": result.get("data", {}).get("tid"),
                        "utr": result.get("data", {}).get("utr"),
                        "client_ref_id": client_ref_id,
                        "amount": request.amount
                    }
                }
            elif str(tx_status) == "2":
                return {
                    "success": True,
                    "status": "PROCESSING",
                    "http_status": response.status_code,
                    "data": result,
                    "transaction": {
                        "tid": result.get("data", {}).get("tid"),
                        "client_ref_id": client_ref_id
                    }
                }
            else:
                return {
                    "success": False,
                    "status": "FAILED",
                    "http_status": response.status_code,
                    "data": result,
                    "error": result.get("message", f"Eko error: {eko_status}")
                }
                
        except:
            return {
                "success": False,
                "http_status": response.status_code,
                "error": response.text[:300]
            }
            
    except Exception as e:
        logging.error(f"[DMT-v3] Error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return {"success": False, "error": str(e)}


@router.get("/dmt/v3/banks")
async def get_dmt_banks_v3():
    """Get list of supported banks for DMT"""
    banks = [
        {"bank_code": "SBIN", "name": "State Bank of India"},
        {"bank_code": "HDFC", "name": "HDFC Bank"},
        {"bank_code": "ICIC", "name": "ICICI Bank"},
        {"bank_code": "UTIB", "name": "Axis Bank"},
        {"bank_code": "KKBK", "name": "Kotak Mahindra Bank"},
        {"bank_code": "PUNB", "name": "Punjab National Bank"},
        {"bank_code": "BARB", "name": "Bank of Baroda"},
        {"bank_code": "YESB", "name": "Yes Bank"},
        {"bank_code": "DBSS", "name": "DBS Bank"},
        {"bank_code": "IDFB", "name": "IDFC First Bank"},
    ]
    
    return {
        "success": True,
        "banks": banks,
        "note": "Use bank_code in recipient add API"
    }


async def execute_dmt_transfer_v3(
    customer_id: str,
    recipient_id: str,
    amount: int,
    channel: str = "IMPS"
) -> dict:
    """
    Internal function to execute DMT v3 transfer.
    Called from unified_redeem_v2.py for bank transfer service.
    
    OFFICIAL FORMAT:
    - Content-Type: application/json
    - request_hash: timestamp + customer_id + recipient_id + amount + client_ref_id
    """
    import requests as req
    
    try:
        client_ref_id = f"TXN{datetime.now().strftime('%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"
        
        headers, encoded_key, timestamp = generate_dmt_v3_headers()
        
        # request_hash: timestamp + customer_id + recipient_id + amount + client_ref_id
        raw_string = timestamp + customer_id + recipient_id + str(amount) + client_ref_id
        request_hash = generate_dmt_v3_request_hash(encoded_key, raw_string)
        headers["request_hash"] = request_hash
        
        url = f"{DMT_BASE_URL}/transactions"
        
        payload = {
            "service_code": "45",
            "customer_id": customer_id,
            "recipient_id": recipient_id,
            "amount": amount,
            "channel": channel,
            "client_ref_id": client_ref_id
        }
        
        logging.info(f"[DMT-v3] Execute: {amount} to {recipient_id}")
        logging.info(f"[DMT-v3] Hash raw: {raw_string[:60]}...")
        
        response = req.post(url, json=payload, headers=headers, timeout=60)
        
        logging.info(f"[DMT-v3] Status: {response.status_code}")
        logging.info(f"[DMT-v3] Response: {response.text[:500]}")
        
        if response.status_code == 403:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": "403",
                "message": "Access denied (403)"
            }
        
        try:
            result = response.json()
        except:
            return {
                "success": False,
                "status": "FAILED",
                "message": f"Invalid response: {response.text[:100]}"
            }
        
        eko_status = result.get("status")
        tx_status = result.get("data", {}).get("tx_status")
        
        if eko_status == 0:
            return {
                "success": True,
                "status": "SUCCESS",
                "eko_tid": result.get("data", {}).get("tid"),
                "utr": result.get("data", {}).get("utr"),
                "client_ref_id": client_ref_id,
                "message": result.get("message", "Transfer successful")
            }
        elif str(tx_status) == "2":
            return {
                "success": True,
                "status": "PROCESSING",
                "eko_tid": result.get("data", {}).get("tid"),
                "client_ref_id": client_ref_id,
                "message": "Transfer processing"
            }
        else:
            return {
                "success": False,
                "status": "FAILED",
                "error_code": str(eko_status),
                "message": result.get("message", f"Eko error: {eko_status}")
            }
            
    except Exception as e:
        logging.error(f"[DMT-v3] Error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e)
        }
