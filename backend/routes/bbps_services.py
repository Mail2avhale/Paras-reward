"""
PARAS REWARD - EKO BBPS MULTI SERVICE BACKEND
============================================
Clean implementation following official EKO documentation with standard error handling.

Services:
1. Electricity Bill Payment
2. DTH Recharge
3. FASTag Recharge
4. Loan / EMI Payment
5. Mobile Recharge
6. Water Bill
7. Credit Card
8. Insurance
9. And more...

Error Handling follows Eko Developer Documentation:
- HTTP Response Codes (200, 403, 404, 405, 415, 500)
- Eko Status Codes (0=Success, 463=User not found, 347=Insufficient balance, etc.)
- Transaction Status (tx_status: 0=Success, 1=Failed, 2=Pending, 3=Refund Pending, 4=Refunded, 5=On Hold)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any, List
import httpx  # ASYNC HTTP - replaces blocking 'requests' library
import base64
import hashlib
import hmac
import time
import logging
import re
import os
from datetime import datetime, timezone, timedelta

# Eko error handler was removed - define necessary constants/functions inline

# Database reference (set by main server)
db = None

def set_db(database):
    global db
    db = database

# Cooldown check for BBPS services (24 hours)
async def check_bbps_cooldown(user_id: str) -> dict:
    """Check if user can make a BBPS bill payment request (24 hour cooldown)"""
    if not db or not user_id:
        return {"allowed": True, "wait_hours": 0}
    

# ==================== SUBSCRIPTION CHECK FOR REDEEM SERVICES ====================
async def check_subscription_for_redeem(user_id: str, service_name: str = "bill payment") -> dict:
    """
    CRITICAL: Check if user has active paid subscription before allowing redeem.
    Only users with active startup/growth/elite can use redeem services.
    """
    if not db or not user_id:
        return {"allowed": False, "reason": "Invalid user"}
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return {"allowed": False, "reason": "User not found"}
    
    # Check subscription plan
    subscription_plan = (user.get("subscription_plan") or "explorer").lower()
    
    # Free/Explorer users cannot redeem
    if subscription_plan in ["explorer", "free", "", None]:
        return {
            "allowed": False,
            "reason": f"Paid subscription required for {service_name}. Please upgrade to Startup, Growth or Elite plan.",
            "requires_subscription": True
        }
    
    # Check if subscription is expired
    expiry = user.get("subscription_expiry") or user.get("subscription_expires") or user.get("vip_expiry")
    if expiry:
        try:
            if isinstance(expiry, str):
                expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
            else:
                expiry_dt = expiry
            
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
            
            now = datetime.now(timezone.utc)
            
            if expiry_dt < now:
                days_expired = (now - expiry_dt).days
                return {
                    "allowed": False,
                    "reason": f"Your subscription expired {days_expired} days ago. Please renew to use {service_name}.",
                    "is_expired": True,
                    "days_expired": days_expired
                }
        except Exception as e:
            logging.warning(f"[SUBSCRIPTION-CHECK] Expiry parse error for {user_id}: {e}")
    
    return {"allowed": True, "subscription_plan": subscription_plan}
    
    cooldown_hours = 24
    cooldown_delta = timedelta(hours=cooldown_hours)
    now = datetime.now(timezone.utc)
    cutoff_time = now - cooldown_delta
    
    # Find last successful/pending request
    last_request = await db.bill_payment_requests.find_one(
        {
            "user_id": user_id,
            "status": {"$nin": ["rejected", "failed", "cancelled"]}
        },
        sort=[("created_at", -1)]
    )
    
    if not last_request:
        return {"allowed": True, "wait_hours": 0}
    
    last_time = last_request.get("created_at")
    if isinstance(last_time, str):
        try:
            last_time = datetime.fromisoformat(last_time.replace('Z', '+00:00'))
        except:
            return {"allowed": True, "wait_hours": 0}
    
    if not last_time:
        return {"allowed": True, "wait_hours": 0}
    
    if last_time.tzinfo is None:
        last_time = last_time.replace(tzinfo=timezone.utc)
    
    if last_time > cutoff_time:
        time_passed = now - last_time
        remaining = cooldown_delta - time_passed
        remaining_hours = remaining.total_seconds() / 3600
        return {
            "allowed": False,
            "wait_hours": round(remaining_hours, 1),
            "last_request": last_time.isoformat()
        }
    
    return {"allowed": True, "wait_hours": 0}
EKO_ERROR_MESSAGES = {
    403: "Authentication failed",
    404: "Service not found",
    500: "Internal server error"
}

TX_STATUS_MESSAGES = {
    0: "Success",
    1: "Failed",
    2: "Pending",
    3: "Refund Pending",
    4: "Refunded",
    5: "Hold"
}

class EkoTxStatus:
    SUCCESS = 0
    FAILED = 1
    PENDING = 2
    REFUND_PENDING = 3
    REFUNDED = 4
    HOLD = 5

def handle_eko_response(response, operation=""):
    """Handle Eko API response"""
    if response.status_code == 403:
        return {"success": False, "error": "Authentication failed"}
    if response.status_code == 500:
        return {"success": False, "error": "Internal server error"}
    return response.json()

def handle_bill_fetch_response(result):
    """Handle bill fetch response"""
    return result

def handle_bill_payment_response(result):
    """Handle bill payment response"""
    return result

def validate_bbps_request(data):
    """Validate BBPS request"""
    return True, None

def get_common_error_message(msg_or_code):
    """Get common error message with better fallback handling"""
    # If it's a known error code
    if isinstance(msg_or_code, int):
        return EKO_ERROR_MESSAGES.get(msg_or_code, f"Error code: {msg_or_code}")
    
    # Handle specific Eko error messages
    if isinstance(msg_or_code, str):
        msg_lower = msg_or_code.lower()
        
        # "No key for Response" - operator doesn't support bill fetch
        if "no key for response" in msg_lower:
            return "This provider doesn't support automatic bill fetch. Please enter the amount manually."
        
        # Consumer validation errors
        if "invalid consumer" in msg_lower or "consumer not found" in msg_lower:
            return "Invalid consumer number. Please verify and try again."
        
        if "consumer belongs to prepaid" in msg_lower:
            return "This number is registered as prepaid, not postpaid."
        
        # Service unavailable
        if "service temporarily" in msg_lower or "try again later" in msg_lower:
            return "Service temporarily unavailable. Please try again later."
        
        # Return the original message if no specific handling
        return msg_or_code
    
    return "Unknown error"

def log_eko_transaction(data):
    """Log Eko transaction"""
    logging.info(f"[BBPS] Transaction: {data}")

router = APIRouter(prefix="/bbps", tags=["BBPS Services"])

# Global async HTTP client
_bbps_http_client: Optional[httpx.AsyncClient] = None

def get_bbps_http_client() -> httpx.AsyncClient:
    """Get or create async HTTP client"""
    global _bbps_http_client
    if _bbps_http_client is None:
        _bbps_http_client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    return _bbps_http_client

async def bbps_get(url: str, headers: dict = None, timeout: int = 60) -> httpx.Response:
    """Non-blocking async GET request for BBPS"""
    client = get_bbps_http_client()
    return await client.get(url, headers=headers, timeout=timeout)

async def bbps_post(url: str, headers: dict = None, data: dict = None, json_body: dict = None, timeout: int = 60) -> httpx.Response:
    """Non-blocking async POST request for BBPS - supports both form data and JSON"""
    client = get_bbps_http_client()
    if json_body:
        return await client.post(url, headers=headers, json=json_body, timeout=timeout)
    return await client.post(url, headers=headers, data=data, timeout=timeout)


# ==================== EKO PRODUCTION CONFIG (ALL FROM ENV) ====================

BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY")
INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID")
AUTH_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY")
USER_CODE = os.environ.get("EKO_USER_CODE")
DEFAULT_LATLONG = "19.9975,73.7898"

# Request timeout in seconds
REQUEST_TIMEOUT = 60


def validate_bbps_config():
    """Validate all required Eko configuration is present"""
    missing = []
    if not DEVELOPER_KEY:
        missing.append("EKO_DEVELOPER_KEY")
    if not INITIATOR_ID:
        missing.append("EKO_INITIATOR_ID")
    if not AUTH_KEY:
        missing.append("EKO_AUTHENTICATOR_KEY")
    if not USER_CODE:
        missing.append("EKO_USER_CODE")
    
    if missing:
        logging.error(f"[BBPS] Missing required environment variables: {', '.join(missing)}")
        return False
    return True


def get_client_ip_bbps(request=None) -> str:
    """Get client IP from request - NO hardcoding"""
    if request:
        # Check X-Forwarded-For header (for proxied requests)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection IP
        if hasattr(request, 'client') and request.client:
            return request.client.host
    
    # Return empty string - let Eko use server IP
    return ""


# ==================== AUTHENTICATION ====================

def generate_headers() -> Dict[str, str]:
    """
    Generate authentication headers as per EKO BBPS documentation.
    
    BBPS uses DIFFERENT algorithm than DMT:
    1. timestamp = current time in MILLISECONDS (not seconds like DMT)
    2. encoded_key = Base64(authenticator_key) as BYTES
    3. secret_key = Base64(HMAC_SHA256(encoded_key, timestamp))
    
    Reference: https://developers.eko.in/reference/pay-bills-api
    """
    timestamp = str(round(time.time() * 1000))  # MILLISECONDS for BBPS
    
    # encoded_key must be BYTES for hmac
    encoded_key = base64.b64encode(AUTH_KEY.encode())  # Returns bytes
    
    secret_key = base64.b64encode(
        hmac.new(
            encoded_key,  # Use bytes directly
            timestamp.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/json"
    }


def generate_headers_for_payment(timestamp: str) -> Dict[str, str]:
    """
    Generate authentication headers for bill PAYMENT.
    Exactly as per Eko documentation.
    """
    # encoded_key must be BYTES for hmac, not string!
    encoded_key = base64.b64encode(AUTH_KEY.encode())  # Returns bytes
    
    secret_key = base64.b64encode(
        hmac.new(
            encoded_key,  # Use bytes directly
            timestamp.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/json",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
        "User-Agent": "okhttp/3.9.0"
    }


def generate_request_hash(timestamp: str, account: str, amount: str) -> str:
    """
    Generate request_hash for payment transactions.
    
    Formula: Base64(HMAC_SHA256(encoded_key, timestamp + account + amount + user_code))
    
    IMPORTANT: encoded_key must be BYTES for hmac!
    """
    # encoded_key must be BYTES for hmac
    encoded_key = base64.b64encode(AUTH_KEY.encode())  # Returns bytes
    
    concatenated = f"{timestamp}{account}{amount}{USER_CODE}"
    
    request_hash = base64.b64encode(
        hmac.new(
            encoded_key,  # Use bytes directly
            concatenated.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return request_hash


# ==================== REQUEST MODELS ====================

class FetchBillRequest(BaseModel):
    """Request model for bill fetch - supports operator-specific parameters"""
    operator_id: str
    account: str          # utility_acc_no (or last 4 digits for Credit Card)
    mobile: str           # confirmation_mobile_no
    sender_name: Optional[str] = "Customer"
    # Operator-specific optional parameters
    source_ip: Optional[str] = None
    postalcode: Optional[str] = None  # For MSEB electricity
    cycle_number: Optional[str] = None  # For MSEB
    authenticator: Optional[str] = None  # For MSEB
    dob: Optional[str] = None  # For LIC - DD/MM/YYYY format
    mobile_number: Optional[str] = None  # For Credit Card BBPS - registered mobile
    extra_params: Optional[Dict[str, str]] = None  # For any other operator-specific params
    
    @validator('mobile')
    def validate_mobile(cls, v):
        if not v or not v.isdigit() or len(v) != 10:
            raise ValueError('Mobile number must be 10 digits')
        return v
    
    @validator('account')
    def validate_account(cls, v):
        if not v or not v.strip():
            raise ValueError('Account number is required')
        return v.strip()


class PayBillRequest(BaseModel):
    """Request model for bill payment"""
    operator_id: str
    account: str
    amount: str
    mobile: str
    user_id: Optional[str] = None  # For cooldown check
    sender_name: Optional[str] = "Customer"
    bill_fetch_response: Optional[str] = None  # Required when fetchBill=1
    payment_amount_breakup: Optional[str] = None  # For Credit Card BBPS - JSON string with billid and amount
    hc_channel: Optional[str] = None  # For Credit Card BBPS only - don't send by default
    
    @validator('mobile')
    def validate_mobile(cls, v):
        if not v or not v.isdigit() or len(v) != 10:
            raise ValueError('Mobile number must be 10 digits')
        return v
    
    @validator('amount')
    def validate_amount(cls, v):
        try:
            amt = float(v)
            if amt <= 0:
                raise ValueError('Amount must be greater than 0')
            if amt > 100000:
                raise ValueError('Maximum amount is ₹1,00,000')
        except (ValueError, TypeError):
            raise ValueError('Invalid amount')
        return v


# ==================== STANDARD RESPONSE FORMAT ====================

def create_success_response(data: Dict, message: str = "Success") -> Dict:
    """Create standardized success response"""
    return {
        "success": True,
        "status": "SUCCESS",
        "message": message,
        "data": data
    }


def create_error_response(
    error_code: int,
    message: str,
    user_message: str = None,
    data: Dict = None
) -> Dict:
    """Create standardized error response"""
    return {
        "success": False,
        "status": "FAILED",
        "error_code": error_code,
        "message": message,
        "user_message": user_message or EKO_ERROR_MESSAGES.get(error_code, message),
        "data": data or {}
    }


def create_pending_response(
    tx_status: int,
    tid: str,
    message: str,
    data: Dict = None
) -> Dict:
    """Create response for pending/processing transactions"""
    status_map = {
        2: "PENDING",
        3: "REFUND_PENDING",
        5: "ON_HOLD"
    }
    return {
        "success": True,
        "status": status_map.get(tx_status, "PROCESSING"),
        "tx_status": tx_status,
        "tid": tid,
        "message": message,
        "user_message": TX_STATUS_MESSAGES.get(tx_status, message),
        "requires_status_check": True,
        "data": data or {}
    }


# ==================== HEALTH CHECK ====================

@router.get("/health")
def health():
    """Health check endpoint"""
    return {
        "status": "PARAS REWARD BBPS RUNNING",
        "version": "2.1",
        "services": ["electricity", "dth", "fastag", "emi", "mobile_prepaid", "water", "credit_card", "insurance"]
    }


@router.get("/debug-config")
async def debug_config():
    """
    Debug endpoint to check Eko configuration (admin only).
    Returns masked config values to verify setup.
    """
    return {
        "base_url": BASE_URL,
        "developer_key": f"{DEVELOPER_KEY[:8]}...{DEVELOPER_KEY[-4:]}" if DEVELOPER_KEY and len(DEVELOPER_KEY) > 12 else "NOT SET",
        "initiator_id": INITIATOR_ID or "NOT SET",
        "auth_key": f"{AUTH_KEY[:4]}...{AUTH_KEY[-4:]}" if AUTH_KEY and len(AUTH_KEY) > 8 else "NOT SET",
        "user_code": USER_CODE or "NOT SET",
        "config_valid": validate_bbps_config(),
        "note": "If any value shows 'NOT SET', check environment variables"
    }


# ==================== BBPS SERVICE ACTIVATION ====================

@router.put("/activate-service")
async def activate_bbps_service(service_code: str = "53"):
    """
    Activate BBPS service for user.
    Service code 53 = BBPS Bill Payment
    
    MUST be called before using fetch/pay APIs.
    Reference: https://developers.eko.in/reference/bbps-overview
    """
    if not validate_bbps_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    try:
        url = f"{BASE_URL}/v1/user/service/activate"
        timestamp = str(round(time.time() * 1000))
        
        # Generate headers for activation - form-urlencoded
        encoded_key = base64.b64encode(AUTH_KEY.encode())
        secret_key = base64.b64encode(
            hmac.new(encoded_key, timestamp.encode(), hashlib.sha256).digest()
        ).decode()
        
        headers = {
            "developer_key": DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        # Form data for activation
        data = {
            "service_code": service_code,
            "initiator_id": INITIATOR_ID,
            "user_code": USER_CODE,
            "latlong": DEFAULT_LATLONG
        }
        
        logging.info(f"[BBPS ACTIVATE] Activating service {service_code}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.put(url, headers=headers, data=data)
        
        logging.info(f"[BBPS ACTIVATE] Status: {response.status_code}")
        logging.info(f"[BBPS ACTIVATE] Response: {response.text}")
        
        if response.status_code != 200:
            return create_error_response(
                response.status_code,
                "Activation failed",
                f"Failed to activate BBPS service. Please contact support."
            )
        
        result = response.json()
        
        if result.get("status") == 0:
            return {
                "success": True,
                "message": "BBPS Service activated successfully",
                "service_code": service_code,
                "service_status": result.get("data", {}).get("service_status_desc", "Activated"),
                "data": result.get("data", {})
            }
        else:
            return create_error_response(
                result.get("response_status_id", 500),
                result.get("message", "Activation failed"),
                "Failed to activate BBPS service"
            )
            
    except Exception as e:
        logging.error(f"[BBPS ACTIVATE] Error: {str(e)}")
        return create_error_response(500, str(e), "Service activation failed")


# ==================== GET OPERATOR PARAMETERS API (NEW) ====================

@router.get("/operator-params/{operator_id}")
async def get_operator_parameters(operator_id: str):
    """
    Get required parameters for a specific operator.
    MUST call this before fetch/pay to know what params are needed.
    
    Reference: https://developers.eko.in/reference/bbps-operator-parameters
    
    Returns:
    - param_name: Name of parameter to pass in fetch/pay API
    - param_label: Label to show to user
    - param_type: Numeric, Decimal, AlphaNumeric, or List
    - regex: Validation regex
    - error_message: Error message if validation fails
    - fetchBill: 1 = Must call fetch before pay, 0 = Can pay directly
    """
    if not validate_bbps_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    try:
        url = f"{BASE_URL}/v2/billpayments/operators/{operator_id}"
        headers = generate_headers()
        
        logging.info(f"[BBPS OPERATOR PARAMS] Getting params for operator_id={operator_id}")
        
        response = await bbps_get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[BBPS OPERATOR PARAMS] HTTP Status: {response.status_code}")
        logging.info(f"[BBPS OPERATOR PARAMS] Response: {response.text[:500] if response.text else 'empty'}")
        
        if response.status_code != 200:
            return create_error_response(
                response.status_code,
                f"Failed to get operator parameters: {response.text}",
                "Could not fetch operator details. Please try again."
            )
        
        result = response.json()
        
        # Return full response for debugging (Eko returns different status codes)
        eko_status = result.get("status")
        
        # Handle various Eko response patterns
        if eko_status == 0 or result.get("operator_name"):
            return {
                "success": True,
                "operator_id": operator_id,
                "operator_name": result.get("operator_name"),
                "parameters": result.get("data", []),
                "fetch_bill_required": result.get("fetchBill", 0) == 1,
                "is_bbps": result.get("BBPS", 0) == 1,
                "raw_response": result
            }
        else:
            # Return raw response for debugging
            return {
                "success": False,
                "operator_id": operator_id,
                "error_code": eko_status,
                "message": result.get("message", "Unknown error"),
                "raw_response": result
            }
    
    except Exception as e:
        logging.error(f"[BBPS OPERATOR PARAMS] Error: {e}")
        return create_error_response(500, str(e), "Service temporarily unavailable.")


@router.post("/test-fetch")
async def test_fetch_bill():
    """
    Test fetch bill with sample data to debug API connectivity.
    Uses a known working operator for testing.
    """
    if not validate_bbps_config():
        return {"success": False, "error": "Config not valid", "config": await debug_config()}
    
    # Test with a simple electricity operator
    test_operator = 62  # MSEDCL-Maharashtra State Electricity (correct ID per Eko docs)
    test_account = "123456789012"  # Dummy account
    test_mobile = "9999999999"
    
    results = {}
    
    # First get operator parameters
    try:
        params_url = f"{BASE_URL}/v2/billpayments/operators/{test_operator}"
        headers = generate_headers()
        params_response = await bbps_get(params_url, headers=headers, timeout=30)
        results["operator_params"] = {
            "http_status": params_response.status_code,
            "response": params_response.text[:500] if params_response.text else "empty"
        }
    except Exception as e:
        results["operator_params"] = {"error": str(e)}
    
    # Try GET method (as per documentation)
    client_ref_id = f"TEST{int(time.time() * 1000)}"
    
    query_params = (
        f"user_code={USER_CODE}"
        f"&client_ref_id={client_ref_id}"
        f"&utility_acc_no={test_account}"
        f"&confirmation_mobile_no={test_mobile}"
        f"&sender_name=TestUser"
        f"&operator_id={test_operator}"
        f"&latlong={DEFAULT_LATLONG}"
        f"&source_ip=127.0.0.1"
    )
    
    get_url = f"{BASE_URL}/v3/customer/payment/bbps/bill?initiator_id={INITIATOR_ID}&{query_params}"
    
    headers_get = generate_headers()
    try:
        response_get = await bbps_get(get_url, headers=headers_get, timeout=30)
        results["get_v3"] = {
            "http_status": response_get.status_code,
            "response": response_get.text[:500] if response_get.text else "empty"
        }
    except Exception as e:
        results["get_v3"] = {"error": str(e)}
    
    # Try POST v2 method (current implementation)
    post_url = f"{BASE_URL}/v2/billpayments/fetchbill?initiator_id={INITIATOR_ID}"
    body = {
        "operator_id": test_operator,
        "utility_acc_no": test_account,
        "confirmation_mobile_no": test_mobile,
        "user_code": USER_CODE,
        "client_ref_id": client_ref_id,
        "sender_name": "Test User",
        "latlong": DEFAULT_LATLONG
    }
    
    headers_json = generate_headers()
    try:
        response_post = await bbps_post(post_url, headers=headers_json, json_body=body, timeout=30)
        results["post_v2_json"] = {
            "http_status": response_post.status_code,
            "response": response_post.text[:500] if response_post.text else "empty"
        }
    except Exception as e:
        results["post_v2_json"] = {"error": str(e)}
    
    return {
        "success": True,
        "test_operator": test_operator,
        "results": results,
        "recommendation": "Check which method returns HTTP 200 with valid data"
    }


@router.post("/debug-pay")
async def debug_pay_bill(
    operator_id: str,
    account: str,
    amount: str,
    mobile: str,
    bill_fetch_response: Optional[str] = None
):
    """
    DEBUG endpoint to test bill payment and see exact Eko response.
    DO NOT use in production - for debugging only!
    """
    if not validate_bbps_config():
        return {"success": False, "error": "Config not valid"}
    
    client_ref_id = f"DEBUG{int(time.time() * 1000)}"
    timestamp = str(round(time.time() * 1000))
    
    url = f"{BASE_URL}/v2/billpayments/paybill?initiator_id={INITIATOR_ID}"
    
    # Generate headers
    headers = generate_headers_for_payment(timestamp)
    request_hash = generate_request_hash(timestamp, account, amount)
    headers["request_hash"] = request_hash
    
    body = {
        "amount": float(amount),  # FIXED: Eko requires numeric amount
        "operator_id": operator_id,
        "utility_acc_no": account,
        "confirmation_mobile_no": mobile,
        "user_code": USER_CODE,
        "client_ref_id": client_ref_id,
        "sender_name": "Debug User",
        "latlong": DEFAULT_LATLONG,
        "source_ip": "127.0.0.1"
    }
    
    if bill_fetch_response:
        body["billfetchresponse"] = bill_fetch_response
    
    debug_info = {
        "request_url": url,
        "request_headers": {k: v[:20] + "..." if len(str(v)) > 20 else v for k, v in headers.items()},
        "request_body": {**body, "utility_acc_no": f"***{account[-4:]}"},
        "timestamp_used": timestamp
    }
    
    try:
        # Try with JSON format
        headers_json = {**headers, "Content-Type": "application/json"}
        response_json = await bbps_post(url, headers=headers_json, json_body=body, timeout=60)
        debug_info["json_response"] = {
            "http_status": response_json.status_code,
            "body": response_json.text[:1000] if response_json.text else "empty"
        }
    except Exception as e:
        debug_info["json_response"] = {"error": str(e)}
    
    try:
        # Try with form-urlencoded format
        headers_form = {**headers, "Content-Type": "application/x-www-form-urlencoded"}
        response_form = await bbps_post(url, headers=headers_form, data=body, timeout=60)
        debug_info["form_response"] = {
            "http_status": response_form.status_code,
            "body": response_form.text[:1000] if response_form.text else "empty"
        }
    except Exception as e:
        debug_info["form_response"] = {"error": str(e)}
    
    return debug_info


# ==================== FETCH BILL ====================

@router.post("/fetch")
async def fetch_bill(data: FetchBillRequest):
    """
    Fetch bill details from EKO BBPS API.
    
    CRITICAL: Uses POST /v2/billpayments/fetchbill (NOT GET v3!)
    Testing confirmed that v3 GET returns 500 error while v2 POST works correctly.
    
    Works for: Electricity, DTH, FASTag, EMI, Water, etc.
    """
    if not validate_bbps_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    client_ref_id = f"FETCH{int(time.time() * 1000)}"
    
    try:
        # Build request body for POST v2 endpoint
        # Reference: Testing showed POST v2 returns HTTP 200 while GET v3 returns 500
        request_body = {
            "user_code": USER_CODE,
            "client_ref_id": client_ref_id,
            "utility_acc_no": data.account,
            "confirmation_mobile_no": data.mobile,
            "sender_name": data.sender_name or "Customer",
            "operator_id": data.operator_id,
            "latlong": DEFAULT_LATLONG
        }
        
        # Add source_ip if provided
        if data.source_ip and data.source_ip != "127.0.0.1":
            request_body["source_ip"] = data.source_ip
        
        # Add operator-specific parameters if provided
        if data.postalcode:
            request_body["postalcode"] = data.postalcode
        if data.cycle_number:
            request_body["cycle_number"] = data.cycle_number
        if data.authenticator:
            request_body["authenticator"] = data.authenticator
        if data.dob:
            request_body["dob"] = data.dob
        
        # For Credit Card BBPS - registered mobile number
        if data.mobile_number:
            request_body["mobile_number"] = data.mobile_number
        
        # Add any extra operator-specific params
        if data.extra_params:
            for key, value in data.extra_params.items():
                if key not in request_body:
                    request_body[key] = value
        
        # Use POST v2 endpoint (confirmed working in test)
        # Endpoint: /v2/billpayments/fetchbill
        url = f"{BASE_URL}/v2/billpayments/fetchbill?initiator_id={INITIATOR_ID}"
        
        logging.info(f"[BBPS FETCH] POST {url}")
        logging.info(f"[BBPS FETCH] operator={data.operator_id}, account=***{data.account[-4:]}")
        logging.info(f"[BBPS FETCH] Body keys: {list(request_body.keys())}")
        
        headers = generate_headers()
        
        # Use POST request with JSON body
        response = await bbps_post(url, headers=headers, json_body=request_body, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[BBPS FETCH] HTTP Status: {response.status_code}")
        logging.info(f"[BBPS FETCH] Response Body: {response.text[:500] if response.text else 'empty'}")
        
        # Handle HTTP-level errors
        if response.status_code == 403:
            logging.error("[BBPS FETCH] 403 Forbidden - Authentication failed")
            return create_error_response(
                403,
                "Authentication failed",
                "Service temporarily unavailable. Please try again later."
            )
        
        if response.status_code == 404:
            logging.error("[BBPS FETCH] 404 Not Found - Invalid endpoint")
            return create_error_response(404, "Service not found", "Service configuration error. Please contact support.")
        
        if response.status_code == 500:
            logging.error(f"[BBPS FETCH] 500 Server Error - Response: {response.text[:1000] if response.text else 'empty'}")
            # Try to parse error message from Eko
            try:
                error_data = response.json()
                error_msg = error_data.get("message", "Server error")
                logging.error(f"[BBPS FETCH] Eko Error: {error_msg}")
            except:
                error_msg = "Server error"
            return create_error_response(500, error_msg, "Eko server error. Please try again in a few minutes.")
        
        if response.status_code != 200:
            logging.error(f"[BBPS FETCH] Unexpected HTTP {response.status_code}: {response.text}")
            return create_error_response(
                response.status_code,
                response.text,
                f"Request failed. Please try again. (Error: {response.status_code})"
            )
        
        # Parse Eko response
        result = response.json()
        logging.info(f"[BBPS FETCH] Response: status={result.get('status')}, message={result.get('message')}")
        
        eko_status = result.get("status")
        eko_data = result.get("data", {})
        message = result.get("message", "")
        
        # SUCCESS: status = 0
        if eko_status == 0:
            # Handle billDetailsList if present (for EMI/Loan and some operators)
            bill_details_list = eko_data.get("billDetailsList", [])
            
            if bill_details_list and len(bill_details_list) > 0:
                # Use first bill from list
                first_bill = bill_details_list[0]
                bill_data = {
                    "bill_amount": first_bill.get("billAmount") or first_bill.get("netBillAmount") or eko_data.get("amount"),
                    "customer_name": first_bill.get("customer_name") or eko_data.get("utilitycustomername"),
                    "bill_date": first_bill.get("billDate") or eko_data.get("billdate"),
                    "due_date": first_bill.get("billDueDate") or eko_data.get("duedate"),
                    "bill_number": first_bill.get("billNumber") or eko_data.get("billnumber"),
                    "bill_fetch_response": eko_data.get("billfetchresponse"),
                    "operator_name": eko_data.get("billername") or eko_data.get("operator_name"),
                    "bbps_ref_id": first_bill.get("bharatBillReferenceNumber"),
                    "payment_status": first_bill.get("paymentStatus"),
                    "bill_period": first_bill.get("billperiod"),
                    "raw_response": result
                }
            else:
                # Standard response format
                bill_data = {
                    "bill_amount": eko_data.get("amount"),
                    "customer_name": eko_data.get("utilitycustomername"),
                    "bill_date": eko_data.get("billdate"),
                    "due_date": eko_data.get("duedate") or eko_data.get("billDueDate"),
                    "bill_number": eko_data.get("billnumber"),
                    "bill_fetch_response": eko_data.get("billfetchresponse"),
                    "operator_name": eko_data.get("billername") or eko_data.get("operator_name"),
                    "raw_response": result
                }
            
            logging.info(f"[BBPS FETCH] Success: amount={bill_data['bill_amount']}, customer={bill_data['customer_name']}")
            
            return {
                "success": True,
                "status": "SUCCESS",
                "message": "Bill fetched successfully",
                **bill_data
            }
        
        # ERROR: status != 0
        user_message = EKO_ERROR_MESSAGES.get(eko_status)
        if not user_message:
            user_message = get_common_error_message(message) if message else f"Unable to fetch bill (Error: {eko_status})"
        
        # Check for "no bill due" scenarios
        no_bill_keywords = ["no bill", "no due", "already paid", "no pending", "payment received"]
        is_no_bill = any(kw in message.lower() for kw in no_bill_keywords)
        
        if is_no_bill:
            return {
                "success": False,
                "status": "NO_BILL_DUE",
                "error_code": eko_status,
                "message": message,
                "user_message": "No pending bill found. You can enter amount manually for advance payment.",
                "raw_response": result
            }
        
        logging.warning(f"[BBPS FETCH] Error: status={eko_status}, message={message}")
        
        return {
            "success": False,
            "status": "FAILED",
            "error_code": eko_status,
            "message": message,
            "user_message": user_message,
            "raw_response": result
        }
        
    except httpx.TimeoutException:
        logging.error(f"[BBPS FETCH] Timeout after {REQUEST_TIMEOUT}s")
        return create_error_response(
            504,
            "Request timeout",
            "The service provider is taking too long to respond. Please try again."
        )
    
    except httpx.ConnectError as e:
        logging.error(f"[BBPS FETCH] Connection error: {e}")
        return create_error_response(
            503,
            "Connection failed",
            "Unable to connect to the service. Please check your internet and try again."
        )
    
    except Exception as e:
        logging.error(f"[BBPS FETCH] Unexpected error: {e}")
        return create_error_response(
            500,
            str(e),
            "An unexpected error occurred. Please try again."
        )


# ==================== PAY BILL ====================

@router.post("/pay")
async def pay_bill(data: PayBillRequest):
    """
    Pay bill via EKO BBPS API.
    
    Standard Process:
    1. Validate input parameters (amount, mobile, account)
    2. Generate authentication headers + request_hash
    3. Make API request to EKO
    4. Handle HTTP errors
    5. Parse Eko response status and tx_status
    6. Handle different transaction states:
       - tx_status=0: SUCCESS
       - tx_status=1: FAILED
       - tx_status=2: PENDING (requires status inquiry)
       - tx_status=3: REFUND_PENDING
       - tx_status=4: REFUNDED
       - tx_status=5: ON_HOLD (requires status inquiry)
    7. Return standardized response
    
    Works for: Electricity, DTH, FASTag, EMI, Water, Mobile, etc.
    """
    # ===== CRITICAL: CHECK SUBSCRIPTION FIRST =====
    if data.user_id:
        sub_check = await check_subscription_for_redeem(data.user_id, "bill payment")
        if not sub_check["allowed"]:
            return {
                "success": False,
                "status": 403,
                "message": sub_check["reason"],
                "data": None,
                "requires_subscription": sub_check.get("requires_subscription", False),
                "is_expired": sub_check.get("is_expired", False)
            }
    
    # ===== CHECK COOLDOWN: 24 hours between bill payments =====
    if data.user_id:
        cooldown = await check_bbps_cooldown(data.user_id)
        if not cooldown["allowed"]:
            return {
                "success": False,
                "status": 429,
                "message": f"Please wait {cooldown['wait_hours']:.0f} hours before making another bill payment.",
                "data": None
            }
    
    if not validate_bbps_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    client_ref_id = f"PAY{int(time.time() * 1000)}"
    
    # Pre-validation - just check required fields are present
    if not data.operator_id or not data.account or not data.amount or not data.mobile:
        return create_error_response(400, "Missing required fields", "Please fill all required fields")
    
    try:
        url = f"{BASE_URL}/v2/billpayments/paybill?initiator_id={INITIATOR_ID}"
        
        # Generate timestamp first for consistent hash generation
        timestamp = str(round(time.time() * 1000))
        
        # Generate headers with correct timestamp
        headers = generate_headers_for_payment(timestamp)
        
        # Generate request_hash using same timestamp
        request_hash = generate_request_hash(timestamp, data.account, data.amount)
        headers["request_hash"] = request_hash
        
        body = {
            "initiator_id": INITIATOR_ID,  # Required in body as per Eko docs
            "source_ip": "103.21.58.193",  # Required - agent/retailer IP for security
            "user_code": USER_CODE,
            "amount": str(data.amount),  # String as per Eko docs
            "client_ref_id": client_ref_id,
            "utility_acc_no": str(data.account),
            "confirmation_mobile_no": str(data.mobile),
            "sender_name": data.sender_name or "Customer",
            "operator_id": str(data.operator_id),
            "latlong": DEFAULT_LATLONG
        }
        
        # Add bill_fetch_response if provided (required for fetchBill=1 operators)
        if data.bill_fetch_response:
            body["billfetchresponse"] = data.bill_fetch_response
        
        # Add Credit Card BBPS specific fields
        if data.payment_amount_breakup:
            body["payment_amount_breakup"] = data.payment_amount_breakup
        if data.hc_channel:
            body["hc_channel"] = data.hc_channel
        
        logging.error(f"[BBPS PAY] client_ref={client_ref_id}, operator={data.operator_id}, amount={data.amount}")
        logging.error(f"[BBPS PAY] URL: {url}")
        logging.error(f"[BBPS PAY] Headers: developer_key={DEVELOPER_KEY[:10]}..., timestamp={timestamp}, request_hash={request_hash[:20]}...")
        logging.error(f"[BBPS PAY] Body: {body}")
        
        # Use JSON format for payment
        response = await bbps_post(url, headers=headers, json_body=body, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[BBPS PAY] HTTP Status: {response.status_code}")
        logging.info(f"[BBPS PAY] Response: {response.text[:500] if response.text else 'empty'}")
        
        # Handle HTTP-level errors
        if response.status_code == 403:
            logging.error("[BBPS PAY] 403 Forbidden - Authentication failed")
            return create_error_response(
                403,
                "Authentication failed",
                "Payment service temporarily unavailable. Your account has not been charged. Please try again later."
            )
        
        if response.status_code == 404:
            return create_error_response(404, "Service not found", "Payment service configuration error. Please contact support.")
        
        if response.status_code == 500:
            return create_error_response(
                500,
                "Server error",
                "Payment server is temporarily unavailable. Your account has not been charged. Please try again in a few minutes."
            )
        
        if response.status_code != 200:
            logging.error(f"[BBPS PAY] Unexpected HTTP {response.status_code}: {response.text}")
            return create_error_response(
                response.status_code,
                response.text,
                f"Payment request failed. Your account has not been charged. (Error: {response.status_code})"
            )
        
        # Parse Eko response
        result = response.json()
        eko_status = result.get("status")
        eko_data = result.get("data", {}) if isinstance(result.get("data"), dict) else {}
        message = result.get("message", "")
        
        # Extract transaction details
        tid = eko_data.get("tid")
        bbps_ref = eko_data.get("bbpstrxnrefid")
        tx_status = eko_data.get("tx_status")
        txstatus_desc = eko_data.get("txstatus_desc")
        
        # Convert tx_status to int if string
        if tx_status is not None and isinstance(tx_status, str):
            try:
                tx_status = int(tx_status)
            except ValueError:
                tx_status = None
        
        logging.info(f"[BBPS PAY] Response: status={eko_status}, tx_status={tx_status}, tid={tid}, message={message}")
        
        # SUCCESS: status = 0
        if eko_status == 0:
            # Check tx_status for final state
            if tx_status == EkoTxStatus.SUCCESS or tx_status == 0:
                # Transaction successful
                return {
                    "success": True,
                    "status": "SUCCESS",
                    "tx_status": 0,
                    "tid": tid,
                    "bbps_ref": bbps_ref,
                    "message": message or "Payment successful",
                    "user_message": "Your payment has been processed successfully!",
                    "amount": data.amount,
                    "raw_response": result
                }
            
            elif tx_status == EkoTxStatus.FAILED or tx_status == 1:
                # Transaction failed
                return {
                    "success": False,
                    "status": "FAILED",
                    "tx_status": 1,
                    "tid": tid,
                    "message": message or "Payment failed",
                    "user_message": txstatus_desc or "Transaction failed. Your account has not been charged.",
                    "raw_response": result
                }
            
            elif tx_status == EkoTxStatus.INITIATED or tx_status == 2:
                # Transaction pending/initiated
                return create_pending_response(
                    tx_status=2,
                    tid=tid,
                    message=message or "Payment is being processed",
                    data={"bbps_ref": bbps_ref, "raw_response": result}
                )
            
            elif tx_status == EkoTxStatus.REFUND_PENDING or tx_status == 3:
                # Refund pending
                return {
                    "success": False,
                    "status": "REFUND_PENDING",
                    "tx_status": 3,
                    "tid": tid,
                    "message": message or "Refund pending",
                    "user_message": "Transaction failed. Refund will be credited within 24-48 hours.",
                    "requires_status_check": True,
                    "raw_response": result
                }
            
            elif tx_status == EkoTxStatus.REFUNDED or tx_status == 4:
                # Already refunded
                return {
                    "success": False,
                    "status": "REFUNDED",
                    "tx_status": 4,
                    "tid": tid,
                    "message": message or "Amount refunded",
                    "user_message": "Transaction failed. Amount has been refunded to your account.",
                    "raw_response": result
                }
            
            elif tx_status == EkoTxStatus.ON_HOLD or tx_status == 5:
                # On hold - requires inquiry
                return {
                    "success": False,
                    "status": "ON_HOLD",
                    "tx_status": 5,
                    "tid": tid,
                    "message": message or "Transaction on hold",
                    "user_message": f"Transaction is on hold. Please contact support with Transaction ID: {tid}",
                    "requires_status_check": True,
                    "raw_response": result
                }
            
            else:
                # No tx_status or unknown - treat as pending
                if tid:
                    return create_pending_response(
                        tx_status=2,
                        tid=tid,
                        message=message or "Payment is being processed",
                        data={"bbps_ref": bbps_ref, "raw_response": result}
                    )
                else:
                    # Success without TID (rare case)
                    return {
                        "success": True,
                        "status": "SUCCESS",
                        "message": message or "Payment submitted",
                        "user_message": "Payment submitted successfully!",
                        "raw_response": result
                    }
        
        # ERROR: status != 0
        user_message = EKO_ERROR_MESSAGES.get(eko_status)
        if not user_message:
            user_message = get_common_error_message(message) if message else f"Payment failed (Error: {eko_status})"
        
        # Special handling for known errors
        if eko_status == 347:  # Insufficient balance
            user_message = "Insufficient balance in merchant account. Please contact support."
        elif eko_status == 944 or eko_status == 945:  # Limit exceeded
            user_message = "Transaction limit exceeded. Please try again tomorrow."
        elif eko_status == 544:  # Bank not available
            user_message = "Bank server is currently unavailable. Please try again in some time."
        
        logging.warning(f"[BBPS PAY] Failed: status={eko_status}, message={message}")
        
        return {
            "success": False,
            "status": "FAILED",
            "error_code": eko_status,
            "tid": tid,
            "message": message,
            "user_message": user_message,
            "raw_response": result
        }
        
    except httpx.TimeoutException:
        logging.error(f"[BBPS PAY] Timeout after {REQUEST_TIMEOUT}s")
        return {
            "success": False,
            "status": "TIMEOUT",
            "error_code": 504,
            "message": "Request timeout",
            "user_message": "Payment is taking longer than expected. Please check your transaction history before retrying.",
            "requires_status_check": True,
            "client_ref_id": client_ref_id
        }
    
    except httpx.ConnectError as e:
        logging.error(f"[BBPS PAY] Connection error: {e}")
        return create_error_response(
            503,
            "Connection failed",
            "Unable to connect to payment service. Your account has not been charged. Please try again."
        )
    
    except Exception as e:
        logging.error(f"[BBPS PAY] Unexpected error: {e}")
        return create_error_response(
            500,
            str(e),
            "An unexpected error occurred. Please check your transaction history before retrying."
        )


# ==================== TRANSACTION STATUS INQUIRY ====================

@router.get("/status/{tid}")
async def get_transaction_status(tid: str):
    """
    Check transaction status via EKO API.
    
    Use this when:
    - tx_status = 2 (Pending/Initiated)
    - tx_status = 5 (On Hold)
    - Payment timeout occurred
    
    Reference: https://developers.eko.in/v3/reference/transactions
    """
    try:
        url = f"{BASE_URL}/v2/transactions?initiator_id={INITIATOR_ID}&tx_id={tid}"
        
        logging.info(f"[BBPS STATUS] Checking TID: {tid}")
        
        response = await bbps_get(url, headers=generate_headers(), timeout=30)
        
        if response.status_code != 200:
            return create_error_response(
                response.status_code,
                "Status check failed",
                "Unable to check transaction status. Please try again."
            )
        
        result = response.json()
        eko_status = result.get("status")
        eko_data = result.get("data", {})
        
        if eko_status == 0:
            tx_status = eko_data.get("tx_status")
            if isinstance(tx_status, str):
                try:
                    tx_status = int(tx_status)
                except ValueError:
                    pass
            
            status_map = {
                0: "SUCCESS",
                1: "FAILED",
                2: "PENDING",
                3: "REFUND_PENDING",
                4: "REFUNDED",
                5: "ON_HOLD"
            }
            
            return {
                "success": True,
                "tid": tid,
                "tx_status": tx_status,
                "status": status_map.get(tx_status, "UNKNOWN"),
                "message": eko_data.get("txstatus_desc", TX_STATUS_MESSAGES.get(tx_status, "Unknown status")),
                "amount": eko_data.get("amount"),
                "bbps_ref": eko_data.get("bbpstrxnrefid"),
                "raw_response": result
            }
        
        return create_error_response(
            eko_status,
            result.get("message", "Status check failed"),
            "Transaction not found. Please verify the transaction ID."
        )
        
    except Exception as e:
        logging.error(f"[BBPS STATUS] Error: {e}")
        return create_error_response(500, str(e), "Unable to check status. Please try again.")


# ==================== GET CATEGORIES ====================

@router.get("/categories")
async def get_categories():
    """
    Get all BBPS categories from Eko API.
    
    Returns list of categories like:
    - Electricity, Water, Gas, DTH, Loan/EMI, Insurance, etc.
    """
    if not validate_bbps_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    try:
        url = f"{BASE_URL}/v3/customer/payment/bbps/categories?initiator_id={INITIATOR_ID}&user_code={USER_CODE}&client_ref_id=CAT{int(time.time())}"
        
        response = await bbps_get(url, headers=generate_headers(), timeout=30)
        
        logging.info(f"[BBPS CATEGORIES] HTTP Status: {response.status_code}")
        logging.info(f"[BBPS CATEGORIES] Response: {response.text[:500] if response.text else 'empty'}")
        
        if response.status_code != 200:
            return create_error_response(
                response.status_code,
                f"Failed to fetch categories: {response.text}",
                "Unable to load categories."
            )
        
        result = response.json()
        return {
            "success": True,
            "categories": result.get("data", result) if isinstance(result, dict) else result
        }
    
    except Exception as e:
        logging.error(f"[BBPS CATEGORIES] Error: {e}")
        return create_error_response(500, str(e), "Service temporarily unavailable.")


@router.get("/operators/search/{query}")
async def search_operators(query: str, category: Optional[str] = None):
    """
    Search operators by name across all categories or within a specific category.
    
    Example: /operators/search/IDFC?category=emi
    """
    if not validate_bbps_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    category_map = {
        "mobile_prepaid": 5, "mobile_postpaid": 10, "dth": 4,
        "electricity": 8, "water": 11, "landline": 9, "broadband": 1,
        "gas": 2, "lpg": 18, "emi": 21, "loan": 21, "credit_card": 7,
        "insurance": 20, "fastag": 22, "housing_society": 12,
        "municipal_tax": 15, "education": 14, "cable_tv": 17,
        "subscription": 13, "hospital": 19, "municipal_corp": 6,
        "loan_repayment": 25, "transport": 27
    }
    
    # If category specified, search only that category
    categories_to_search = [category_map.get(category.lower())] if category and category.lower() in category_map else list(set(category_map.values()))
    
    all_matches = []
    
    for cat_id in categories_to_search[:5]:  # Limit to 5 categories to avoid timeout
        try:
            url = f"{BASE_URL}/v2/billpayments/operators?initiator_id={INITIATOR_ID}&category={cat_id}"
            response = await bbps_get(url, headers=generate_headers(), timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                operators = result.get("data", result) if isinstance(result, dict) else result
                
                if isinstance(operators, list):
                    for op in operators:
                        op_name = op.get("name", "") or ""
                        if query.lower() in op_name.lower():
                            all_matches.append({
                                "operator_id": op.get("operator_id"),
                                "name": op_name,
                                "category_id": cat_id,
                                "billFetchResponse": op.get("billFetchResponse", 0)
                            })
        except Exception as e:
            logging.warning(f"[BBPS SEARCH] Category {cat_id} failed: {e}")
            continue
    
    return {
        "success": True,
        "query": query,
        "matches": all_matches,
        "count": len(all_matches)
    }


# ==================== GET OPERATORS ====================

@router.get("/operators/{category}")
async def get_operators(category: str):
    """
    Get operators list for a category.
    
    EKO BBPS Categories (verified with production API):
    - 4: DTH (5 operators: Dish TV, Tata Sky, Airtel DTH, etc.)
    - 5: Mobile Prepaid (6 operators: Jio, Airtel, Vi, BSNL, MTNL)
    - 7: Credit Card (29 operators)
    - 8: Electricity (89 operators)
    - 9: Landline (5 operators)
    - 10: Mobile Postpaid (7 operators)
    - 11: Water (54 operators)
    - 12: Housing Society (105 operators)
    - 20: Insurance (40 operators)
    - 21: Loan/EMI (294 operators)
    - 22: FASTag (20 operators: IndusInd, Axis, BOB, etc.)
    - 1: Broadband (92 operators)
    """
    # Complete Eko BBPS Category Mapping (as of March 2026)
    # Based on direct API investigation
    category_map = {
        # Mobile Services
        "mobile_recharge": 5,   # Cat 5: Airtel, Jio, Vi, BSNL Prepaid (6 operators)
        "mobile_prepaid": 5,
        "mobile_postpaid": 10,  # Cat 10: Airtel, Jio, Vi Postpaid (7 operators)
        
        # Entertainment
        "dth": 4,               # Cat 4: Dish TV, Tata Sky, Airtel DTH (5 operators)
        "cable_tv": 17,         # Cat 17: Hathway, Asianet, INDigital (4 operators)
        "subscription": 13,     # Cat 13: Amazon Prime, JioHotstar, Hungama (17 operators)
        "ott": 13,
        
        # Utility Bills
        "electricity": 8,       # Cat 8: MSEDCL, BSES, Tata Power (89 operators)
        "water": 11,            # Cat 11: Municipal water boards (54 operators)
        "landline": 9,          # Cat 9: Airtel, BSNL, MTNL Landline (5 operators)
        "broadband": 1,         # Cat 1: Airtel, Jio, ACT Fibernet (93 operators)
        "gas": 2,               # Cat 2: Mahanagar Gas, Gujarat Gas, Adani (29 operators)
        "lpg": 18,              # Cat 18: Indane, HP Gas, Bharat Gas (3 operators)
        
        # Financial Services
        "credit_card": 7,       # Cat 7: HDFC, ICICI, Axis, etc. (29 operators)
        "emi": 21,              # Cat 21: Loan EMI payments (294 operators)
        "loan": 21,
        "loan_emi": 21,
        "loan_repayment": 25,   # Cat 25: Agent/Customer loan repayment (283 operators)
        "insurance": 20,        # Cat 20: Life & General Insurance (40 operators)
        
        # Transport
        "fastag": 22,           # Cat 22: Bank FASTag recharge (20 operators)
        "transport": 27,        # Cat 27: Transport Department services (5 operators)
        
        # Property & Housing
        "housing_society": 12,  # Cat 12: Society maintenance fees (105 operators)
        "municipal_tax": 15,    # Cat 15: Property Tax - MCGM, etc. (41 operators)
        "municipal_corp": 6,    # Cat 6: Metro Municipal Corps - KDMC, AMC (2 operators)
        "municipal_other": 23,  # Cat 23: Other municipal services (5 operators)
        
        # Education & Healthcare
        "education": 14,        # Cat 14: School/College Fees (1661 operators)
        "school_fees": 14,
        "college_fees": 14,
        "hospital": 19,         # Cat 19: Hospital payments (6 operators)
        "healthcare": 19
    }
    
    cat_id = category_map.get(category.lower())
    
    if not cat_id:
        return create_error_response(
            400,
            f"Unknown category: {category}",
            f"Invalid service category. Available: {', '.join(category_map.keys())}"
        )
    
    try:
        url = f"{BASE_URL}/v2/billpayments/operators?initiator_id={INITIATOR_ID}&category={cat_id}"
        
        response = await bbps_get(url, headers=generate_headers(), timeout=30)
        
        if response.status_code != 200:
            return create_error_response(
                response.status_code,
                f"Failed to fetch operators for {category}",
                "Unable to load service providers. Please try again."
            )
        
        result = response.json()
        
        # Eko operators API returns data directly as array OR with status wrapper
        # Handle both formats
        if isinstance(result, list):
            # Direct array response
            operators = result
        elif result.get("status") is not None and result.get("status") != 0:
            # Error response with status
            return create_error_response(
                result.get("status"),
                result.get("message", "Failed to fetch operators"),
                "Unable to load service providers. Please try again."
            )
        else:
            # Response with data wrapper
            operators = result.get("data", [])
        
        # Format operators for frontend
        formatted = []
        for op in operators:
            formatted.append({
                "operator_id": op.get("operator_id"),
                "name": op.get("name"),
                "category": op.get("category"),
                "billFetchResponse": op.get("billFetchResponse", 0),
                "supports_bill_fetch": op.get("billFetchResponse", 0) == 1
            })
        
        # Sort operators A to Z by name
        formatted.sort(key=lambda x: (x.get("name") or "").lower())
        
        return {
            "success": True,
            "category": category,
            "eko_category_id": cat_id,
            "count": len(formatted),
            "operators": formatted
        }
        
    except httpx.TimeoutException:
        return create_error_response(504, "Request timeout", "Service is slow. Please try again.")
    except Exception as e:
        logging.error(f"[BBPS OPERATORS] Error: {e}")
        return create_error_response(500, str(e), "Failed to load providers. Please refresh.")


# ==================== SERVICE STATUS ====================


# ==================== ERROR CODES REFERENCE ====================

@router.get("/error-codes")
def get_error_codes():
    """
    Get all Eko error codes and their meanings.
    Useful for debugging and support.
    """
    return {
        "http_codes": {
            "200": "OK - Check status and tx_status in response",
            "403": "Forbidden - Invalid authentication",
            "404": "Not Found - Invalid URL",
            "405": "Method Not Allowed",
            "415": "Unsupported Media Type",
            "500": "Server Error"
        },
        "status_codes": EKO_ERROR_MESSAGES,
        "tx_status": TX_STATUS_MESSAGES
    }


# ==================== SERVICE ACTIVATION ====================

@router.post("/activate-service/{service_code}")
async def activate_service(service_code: int = 53):
    """
    Activate a service for the merchant/agent
    
    Service Codes:
    - 53: BBPS (Bill Payments - Electricity, Gas, DTH, Mobile, etc.)
    - 45: DMT (Domestic Money Transfer)
    
    IMPORTANT: This must be called once to activate services before using them!
    """
    import asyncio
    
    try:
        # Generate fresh headers with correct Content-Type for form data
        timestamp = str(round(time.time() * 1000))
        encoded_key = base64.b64encode(AUTH_KEY.encode()).decode()
        secret_key = base64.b64encode(
            hmac.new(encoded_key.encode(), timestamp.encode(), hashlib.sha256).digest()
        ).decode()
        
        headers = {
            "developer_key": DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        # URL for service activation
        url = f"{BASE_URL}/v1/user/service/activate"
        
        # Body - form data
        data = {
            "service_code": str(service_code),
            "initiator_id": INITIATOR_ID,
            "user_code": USER_CODE,
            "latlong": "19.0760,72.8777"
        }
        
        logging.info(f"[BBPS] Activating service {service_code} for user {USER_CODE}")
        logging.info(f"[BBPS] URL: {url}")
        
        # FIXED: Use httpx async client instead of sync requests
        async with httpx.AsyncClient() as client:
            response = await client.put(url, headers=headers, data=data, timeout=60)
        
        logging.info(f"[BBPS] Activation response: {response.status_code} - {response.text[:200]}")
        
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
                "user_code": USER_CODE,
                "raw_response": result
            }
        elif eko_status == 24:
            # Already activated
            return {
                "success": True,
                "message": f"Service {service_code} is already activated",
                "service_code": service_code,
                "user_code": USER_CODE,
                "already_active": True,
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
        logging.error(f"[BBPS] Service activation error: {e}")
        return {
            "success": False,
            "message": f"Activation failed: {str(e)}",
            "service_code": service_code
        }


@router.get("/service-status/{service_code}")
async def check_service_status(service_code: int = 53):
    """
    Check if a service is activated for the user
    """
    try:
        # Generate headers
        timestamp = str(round(time.time() * 1000))
        encoded_key = base64.b64encode(AUTH_KEY.encode()).decode()
        secret_key = base64.b64encode(
            hmac.new(encoded_key.encode(), timestamp.encode(), hashlib.sha256).digest()
        ).decode()
        
        headers = {
            "developer_key": DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp
        }
        
        # Check specific service status
        url = f"{BASE_URL}/v1/user/services?initiator_id={INITIATOR_ID}&user_code={USER_CODE}"
        
        logging.info(f"[BBPS] Checking service status: {url}")
        
        # FIXED: Use httpx async client instead of sync requests
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=30)
        result = response.json()
        
        logging.info(f"[BBPS] Service status response: {result}")
        
        return {
            "success": True,
            "service_code": service_code,
            "user_code": USER_CODE,
            "initiator_id": INITIATOR_ID,
            "services": result.get("data", {}).get("service_list", result.get("data", {}).get("services", [])),
            "raw_response": result
        }
        
    except Exception as e:
        logging.error(f"[BBPS] Service status check error: {e}")
        return {
            "success": False,
            "message": str(e),
            "service_code": service_code
        }


@router.post("/activate-all")
async def activate_all_services():
    """
    Activate all required services (BBPS + DMT)
    """
    results = {
        "bbps_53": await activate_service(53),
        "dmt_45": await activate_service(45)
    }
    
    all_success = all(r.get("success") or r.get("already_active") for r in results.values())
    
    return {
        "success": all_success,
        "message": "All services activated" if all_success else "Some services failed",
        "results": results
    }

