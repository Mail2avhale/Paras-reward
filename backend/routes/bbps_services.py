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
import requests
import base64
import hashlib
import hmac
import time
import logging
import re

from .eko_error_handler import (
    handle_eko_response,
    handle_bill_fetch_response,
    handle_bill_payment_response,
    validate_bbps_request,
    get_common_error_message,
    log_eko_transaction,
    EKO_ERROR_MESSAGES,
    TX_STATUS_MESSAGES,
    EkoTxStatus
)

router = APIRouter(prefix="/bbps", tags=["BBPS Services"])

# ==================== EKO PRODUCTION CONFIG (ALL FROM ENV) ====================
import os

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
    2. encoded_key = Base64(authenticator_key)
    3. secret_key = Base64(HMAC_SHA256(encoded_key, timestamp))
    
    Reference: https://developers.eko.in/reference/pay-bills-api
    """
    timestamp = str(round(time.time() * 1000))  # MILLISECONDS for BBPS
    
    encoded_key = base64.b64encode(AUTH_KEY.encode()).decode()
    
    secret_key = base64.b64encode(
        hmac.new(
            encoded_key.encode(),
            timestamp.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "initiator_id": INITIATOR_ID,
        "Content-Type": "application/json"  # BBPS uses JSON for fetch, form-urlencoded for pay
    }


def generate_headers_for_payment(timestamp: str) -> Dict[str, str]:
    """
    Generate authentication headers for bill PAYMENT (uses form-urlencoded).
    Payment API requires request_hash in addition to regular auth.
    """
    encoded_key = base64.b64encode(AUTH_KEY.encode()).decode()
    
    secret_key = base64.b64encode(
        hmac.new(
            encoded_key.encode(),
            timestamp.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "initiator_id": INITIATOR_ID,
        "Content-Type": "application/x-www-form-urlencoded"  # Payment uses form data
    }


def generate_request_hash(timestamp: str, account: str, amount: str) -> str:
    """
    Generate request_hash for payment transactions.
    
    Formula: Base64(HMAC_SHA256(encoded_key, timestamp + account + amount + user_code))
    
    Reference: https://developers.eko.in/reference/pay-bills-api
    """
    encoded_key = base64.b64encode(AUTH_KEY.encode()).decode()
    
    concatenated = f"{timestamp}{account}{amount}{USER_CODE}"
    
    request_hash = base64.b64encode(
        hmac.new(
            encoded_key.encode(),
            concatenated.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return request_hash


# ==================== REQUEST MODELS ====================

class FetchBillRequest(BaseModel):
    """Request model for bill fetch"""
    operator_id: str
    account: str          # utility_acc_no
    mobile: str           # confirmation_mobile_no
    sender_name: Optional[str] = "Customer"
    
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
    sender_name: Optional[str] = "Customer"
    bill_fetch_response: Optional[str] = None  # Required when billFetchResponse=1
    
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
        "version": "2.0",
        "services": ["electricity", "dth", "fastag", "emi", "mobile_prepaid", "water", "credit_card", "insurance"]
    }


# ==================== FETCH BILL ====================

@router.post("/fetch")
def fetch_bill(data: FetchBillRequest):
    """
    Fetch bill details from EKO BBPS API.
    
    Standard Process:
    1. Validate input parameters
    2. Generate authentication headers
    3. Make API request to EKO
    4. Handle HTTP errors (403, 404, 500, etc.)
    5. Parse Eko response status
    6. Return standardized response
    
    Works for: Electricity, DTH, FASTag, EMI, Water, etc.
    """
    if not validate_bbps_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    client_ref_id = f"FETCH{int(time.time() * 1000)}"
    
    try:
        url = f"{BASE_URL}/v2/billpayments/fetchbill?initiator_id={INITIATOR_ID}"
        
        body = {
            "operator_id": data.operator_id,
            "utility_acc_no": data.account,
            "confirmation_mobile_no": data.mobile,
            "user_code": USER_CODE,
            "client_ref_id": client_ref_id,
            "sender_name": data.sender_name or "Customer",
            "latlong": DEFAULT_LATLONG
        }
        
        logging.info(f"[BBPS FETCH] client_ref={client_ref_id}, operator={data.operator_id}, account=***{data.account[-4:]}")
        
        headers = generate_headers()
        response = requests.post(url, json=body, headers=headers, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[BBPS FETCH] HTTP Status: {response.status_code}")
        
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
            logging.error("[BBPS FETCH] 500 Server Error")
            return create_error_response(500, "Server error", "Eko server is temporarily unavailable. Please try again in a few minutes.")
        
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
            bill_data = {
                "bill_amount": eko_data.get("amount"),
                "customer_name": eko_data.get("utilitycustomername"),
                "bill_date": eko_data.get("billdate"),
                "due_date": eko_data.get("duedate"),
                "bill_number": eko_data.get("billnumber"),
                "bill_fetch_response": eko_data.get("billfetchresponse"),
                "operator_name": eko_data.get("operator_name"),
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
        
    except requests.exceptions.Timeout:
        logging.error(f"[BBPS FETCH] Timeout after {REQUEST_TIMEOUT}s")
        return create_error_response(
            504,
            "Request timeout",
            "The service provider is taking too long to respond. Please try again."
        )
    
    except requests.exceptions.ConnectionError as e:
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
def pay_bill(data: PayBillRequest):
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
    if not validate_bbps_config():
        return create_error_response(500, "Service configuration error", "Service temporarily unavailable.")
    
    client_ref_id = f"PAY{int(time.time() * 1000)}"
    
    # Pre-validation
    is_valid, validation_error = validate_bbps_request(
        data.operator_id,
        data.account,
        data.amount,
        data.mobile
    )
    
    if not is_valid:
        return create_error_response(400, validation_error, validation_error)
    
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
            "amount": data.amount,
            "operator_id": data.operator_id,
            "utility_acc_no": data.account,
            "confirmation_mobile_no": data.mobile,
            "user_code": USER_CODE,
            "client_ref_id": client_ref_id,
            "sender_name": data.sender_name or "Customer",
            "latlong": DEFAULT_LATLONG
        }
        
        # Add bill_fetch_response if provided (required for some operators)
        if data.bill_fetch_response:
            body["billfetchresponse"] = data.bill_fetch_response
        
        logging.info(f"[BBPS PAY] client_ref={client_ref_id}, operator={data.operator_id}, amount={data.amount}")
        
        # Use data= for form-urlencoded (as per Eko docs for payment)
        response = requests.post(url, data=body, headers=headers, timeout=REQUEST_TIMEOUT)
        
        logging.info(f"[BBPS PAY] HTTP Status: {response.status_code}")
        
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
        
    except requests.exceptions.Timeout:
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
    
    except requests.exceptions.ConnectionError as e:
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
def get_transaction_status(tid: str):
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
        
        response = requests.get(url, headers=generate_headers(), timeout=30)
        
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


# ==================== GET OPERATORS ====================

@router.get("/operators/{category}")
def get_operators(category: str):
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
    category_map = {
        # Mobile Recharge - Category 5 has Jio, Airtel, Vi, BSNL
        "mobile_recharge": 5,
        "mobile_prepaid": 5,
        "mobile_postpaid": 10,
        
        # DTH
        "dth": 4,
        
        # Utility Bills
        "electricity": 8,
        "water": 11,
        "landline": 9,
        "broadband": 1,
        "gas": 8,  # Some gas uses electricity category
        
        # Financial
        "emi": 21,
        "loan": 21,
        "loan_emi": 21,
        "credit_card": 7,
        "insurance": 20,
        
        # Transport & Others
        "fastag": 22,
        "housing_society": 12,
        "municipal_tax": 12
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
        
        response = requests.get(url, headers=generate_headers(), timeout=30)
        
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
        
    except requests.exceptions.Timeout:
        return create_error_response(504, "Request timeout", "Service is slow. Please try again.")
    except Exception as e:
        logging.error(f"[BBPS OPERATORS] Error: {e}")
        return create_error_response(500, str(e), "Failed to load providers. Please refresh.")


# ==================== GET OPERATOR PARAMETERS ====================

@router.get("/operator-params/{operator_id}")
def get_operator_params(operator_id: str):
    """
    Get required parameters for a specific operator.
    
    Returns field validation rules (regex, min/max length, field names).
    Essential for proper form validation before payment.
    """
    try:
        url = f"{BASE_URL}/v2/billpayments/operators/{operator_id}/params?initiator_id={INITIATOR_ID}"
        
        response = requests.get(url, headers=generate_headers(), timeout=30)
        
        if response.status_code != 200:
            return create_error_response(
                response.status_code,
                "Failed to fetch operator parameters",
                "Unable to load form requirements. Please try again."
            )
        
        result = response.json()
        
        # Eko params API can return data directly or with status wrapper
        if isinstance(result, dict) and result.get("status") is not None and result.get("status") != 0:
            return create_error_response(
                result.get("status"),
                result.get("message"),
                "Unable to load form requirements for this provider."
            )
        
        # Get params - could be direct result or in data field
        params = result.get("data", result) if isinstance(result, dict) else {}
        
        return {
            "success": True,
            "operator_id": operator_id,
            "operator_name": params.get("name"),
            "category": params.get("category"),
            "billFetchResponse": params.get("billFetchResponse", 0),
            "supports_bill_fetch": params.get("billFetchResponse", 0) == 1,
            "parameters": params.get("parameters", []),
            "raw_response": params
        }
        
    except Exception as e:
        logging.error(f"[BBPS PARAMS] Error: {e}")
        return create_error_response(500, str(e), "Failed to load provider details.")


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
