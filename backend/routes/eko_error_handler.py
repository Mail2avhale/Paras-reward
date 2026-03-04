"""
EKO API ERROR HANDLER - Standard Error Handling for All BBPS Services
Based on Official Eko Developer Documentation

This module provides:
1. HTTP Response Code Handling
2. Eko Status Code Handling  
3. Transaction Status (tx_status) Handling
4. User-friendly Error Messages
5. Retry Logic for Transient Errors
6. Transaction Status Inquiry
"""

import logging
from typing import Dict, Any, Optional, Tuple
from enum import Enum
from dataclasses import dataclass

# ==================== EKO HTTP RESPONSE CODES ====================

class EkoHttpStatus:
    """HTTP Response codes from Eko API"""
    OK = 200                    # Check status, tx_status, message in response
    FORBIDDEN = 403             # Incorrect secret-key or timestamp
    NOT_FOUND = 404             # Wrong URL
    METHOD_NOT_ALLOWED = 405    # Wrong HTTP method (GET/POST/PUT/DELETE)
    UNSUPPORTED_MEDIA = 415     # Wrong Content-Type
    SERVER_ERROR = 500          # API cannot connect to Eko servers


# ==================== EKO STATUS CODES ====================

class EkoStatusCode:
    """Response status codes from Eko API"""
    SUCCESS = 0
    
    # User/Agent Errors
    USER_NOT_FOUND = 463
    ENROLLMENT_PENDING = 327
    WALLET_EXISTS = 17
    AGENT_NOT_ALLOWED = 31
    INVALID_CHANNEL = 460
    INVALID_SENDER = 319
    
    # Validation Errors
    SENDER_NAME_LETTERS_ONLY = 132
    RECIPIENT_NAME_LETTERS_ONLY = 131
    RECIPIENT_NAME_LENGTH = 122
    RECIPIENT_MOBILE_NUMERIC = 145
    RECIPIENT_MOBILE_10_DIGIT = 140
    INVALID_RECIPIENT_TYPE_FORMAT = 536
    INVALID_RECIPIENT_TYPE_LENGTH = 537
    MAX_RECIPIENT_LIMIT = 39
    RECIPIENT_NOT_REGISTERED = 313
    
    # IFSC/Bank Errors
    WRONG_IFSC = 41
    INCOMPLETE_IFSC = 44  # Also 45
    INVALID_IFSC_FORMAT = 136
    INVALID_IFSC_FOR_BANK = 508
    IFSC_NOT_FOUND = 521
    BANK_NOT_FOUND = 48
    INVALID_ACCOUNT_LENGTH = 102
    INVALID_ACCOUNT_DETAILS = 46
    
    # Transaction Errors
    NEFT_NOT_ALLOWED = 317
    IMPS_NOT_ALLOWED = 53
    IMPS_NOT_AVAILABLE = 344
    NPCI_ERROR = 55
    TID_NOT_EXIST = 168
    VERIFICATION_FAILED = 350
    BANK_NOT_AVAILABLE = 544
    
    # Limit/Balance Errors
    INSUFFICIENT_BALANCE = 347
    MONTHLY_LIMIT_EXCEEDED = 314
    LIMIT_EXHAUSTED = 945
    
    # OTP Errors
    WRONG_OTP = 302
    OTP_EXPIRED = 303
    
    # KYC Errors
    ID_PROOF_EXISTS = 1237
    KYC_ALREADY_APPROVED = 585
    
    # Recipient Errors
    RECIPIENT_ALREADY_REGISTERED = 342


# ==================== EKO TX_STATUS CODES ====================

class EkoTxStatus:
    """Transaction status codes from Eko API (tx_status field)"""
    SUCCESS = 0           # Transaction successful
    FAILED = 1            # Transaction failed
    INITIATED = 2         # Response Awaited / Initiated (NEFT)
    REFUND_PENDING = 3    # Refund is pending
    REFUNDED = 4          # Amount refunded
    ON_HOLD = 5           # On Hold - Transaction Inquiry Required


# ==================== ERROR MESSAGE MAPPING ====================

EKO_ERROR_MESSAGES = {
    # HTTP Errors
    403: "Authentication failed. Invalid secret-key or timestamp. Please contact support.",
    404: "Service endpoint not found. Please try again later.",
    405: "Invalid request method. Please try again.",
    415: "Invalid request format. Please try again.",
    500: "Eko server is temporarily unavailable. Please try again in a few minutes.",
    
    # Status Code Errors
    0: "Success",
    463: "User not found. Please complete registration first.",
    327: "Enrollment done. Verification is pending.",
    17: "User wallet already exists.",
    31: "Agent registration failed. Please contact support.",
    132: "Sender name should only contain letters.",
    302: "Incorrect OTP. Please try again.",
    303: "OTP has expired. Please request a new OTP.",
    342: "This recipient is already registered.",
    145: "Recipient mobile number should be numeric only.",
    140: "Recipient mobile number should be 10 digits.",
    131: "Recipient name should only contain letters.",
    122: "Recipient name should be between 1 and 50 characters.",
    39: "Maximum recipient limit reached. Please remove an existing recipient.",
    41: "Invalid IFSC code. Please check and try again.",
    44: "Incomplete IFSC code. Please enter complete 11-character IFSC.",
    45: "Incomplete IFSC code. Please enter complete 11-character IFSC.",
    536: "Invalid recipient type format.",
    537: "Invalid recipient type length.",
    48: "Bank not found. Please check IFSC code.",
    102: "Invalid account number length. Please check your account number.",
    136: "Invalid IFSC format. IFSC should be 11 characters (e.g., SBIN0001234).",
    508: "IFSC code does not match the selected bank.",
    521: "IFSC code not found in our system. Please verify the code.",
    313: "Recipient registration not complete. Please register first.",
    317: "NEFT transfer is not allowed for this account.",
    53: "IMPS transfer is not allowed for this transaction.",
    55: "Transaction failed due to NPCI error. Please try again.",
    460: "Invalid payment channel selected.",
    319: "Invalid sender or initiator details.",
    314: "Monthly transaction limit exceeded. Please try again next month.",
    350: "Account verification failed. Recipient name not found.",
    344: "IMPS is not available for this bank. Please try NEFT.",
    46: "Invalid account details. Please verify account number and IFSC.",
    168: "Transaction ID does not exist.",
    1237: "This ID proof number is already registered in the system.",
    585: "Customer KYC is already approved.",
    347: "Insufficient balance. Please add funds to continue.",
    945: "Transaction limit has been exhausted for this month.",
    544: "Transaction failed. Bank is currently unavailable. Please try later.",
}

# TX Status Messages
TX_STATUS_MESSAGES = {
    0: "Transaction successful",
    1: "Transaction failed",
    2: "Transaction initiated. Awaiting response (may take up to 24 hours for NEFT)",
    3: "Refund is pending. Amount will be credited within 24-48 hours",
    4: "Amount has been refunded to your account",
    5: "Transaction is on hold. Please contact support with your transaction ID",
}


# ==================== ERROR RESPONSE DATACLASS ====================

@dataclass
class EkoResponse:
    """Standardized Eko API response"""
    success: bool
    status: str  # SUCCESS, FAILED, PENDING, REFUND_PENDING, REFUNDED, ON_HOLD
    message: str
    user_message: str  # User-friendly message
    error_code: Optional[int] = None
    tx_status: Optional[int] = None
    tid: Optional[str] = None
    bbps_ref: Optional[str] = None
    amount: Optional[str] = None
    raw_response: Optional[Dict] = None
    should_retry: bool = False
    requires_inquiry: bool = False


# ==================== MAIN ERROR HANDLER ====================

def handle_eko_response(
    http_status: int,
    response_data: Dict[Any, Any],
    service_type: str = "BBPS"
) -> EkoResponse:
    """
    Standard handler for all Eko API responses.
    
    Args:
        http_status: HTTP response code (200, 403, 404, etc.)
        response_data: JSON response from Eko API
        service_type: Type of service (BBPS, DMT, Recharge, etc.)
    
    Returns:
        EkoResponse with standardized fields
    """
    
    # Handle HTTP-level errors first
    if http_status != 200:
        return handle_http_error(http_status, service_type)
    
    # Extract Eko response fields
    eko_status = response_data.get("status")
    tx_status = response_data.get("data", {}).get("tx_status") if isinstance(response_data.get("data"), dict) else None
    message = response_data.get("message", "")
    data = response_data.get("data", {})
    
    # Handle string tx_status (convert to int)
    if tx_status is not None and isinstance(tx_status, str):
        try:
            tx_status = int(tx_status)
        except ValueError:
            tx_status = None
    
    logging.info(f"[EKO-{service_type}] status={eko_status}, tx_status={tx_status}, message={message}")
    
    # SUCCESS: status = 0
    if eko_status == 0:
        return handle_success_response(data, tx_status, message, response_data, service_type)
    
    # ERROR: status != 0
    return handle_error_response(eko_status, message, response_data, service_type)


def handle_http_error(http_status: int, service_type: str) -> EkoResponse:
    """Handle HTTP-level errors (403, 404, 500, etc.)"""
    
    user_message = EKO_ERROR_MESSAGES.get(http_status, f"Request failed with status {http_status}")
    
    # Determine if retry is possible
    should_retry = http_status in [500, 502, 503, 504]  # Server errors are retryable
    
    return EkoResponse(
        success=False,
        status="FAILED",
        message=f"HTTP {http_status}",
        user_message=user_message,
        error_code=http_status,
        should_retry=should_retry,
        requires_inquiry=False
    )


def handle_success_response(
    data: Dict,
    tx_status: Optional[int],
    message: str,
    raw_response: Dict,
    service_type: str
) -> EkoResponse:
    """Handle successful Eko response (status = 0)"""
    
    tid = data.get("tid") if isinstance(data, dict) else None
    bbps_ref = data.get("bbpstrxnrefid") if isinstance(data, dict) else None
    amount = data.get("amount") if isinstance(data, dict) else None
    
    # Check tx_status for final transaction state
    if tx_status is None:
        # No tx_status means simple success (non-financial or fetch operations)
        return EkoResponse(
            success=True,
            status="SUCCESS",
            message=message or "Operation successful",
            user_message="Request completed successfully",
            tx_status=tx_status,
            tid=tid,
            bbps_ref=bbps_ref,
            amount=amount,
            raw_response=raw_response
        )
    
    # Handle specific tx_status values
    if tx_status == EkoTxStatus.SUCCESS:
        return EkoResponse(
            success=True,
            status="SUCCESS",
            message=message or "Transaction successful",
            user_message=TX_STATUS_MESSAGES[0],
            tx_status=0,
            tid=tid,
            bbps_ref=bbps_ref,
            amount=amount,
            raw_response=raw_response
        )
    
    elif tx_status == EkoTxStatus.FAILED:
        return EkoResponse(
            success=False,
            status="FAILED",
            message=message or "Transaction failed",
            user_message=TX_STATUS_MESSAGES[1],
            tx_status=1,
            tid=tid,
            raw_response=raw_response
        )
    
    elif tx_status == EkoTxStatus.INITIATED:
        return EkoResponse(
            success=True,
            status="PENDING",
            message=message or "Transaction initiated",
            user_message=TX_STATUS_MESSAGES[2],
            tx_status=2,
            tid=tid,
            bbps_ref=bbps_ref,
            raw_response=raw_response,
            requires_inquiry=True
        )
    
    elif tx_status == EkoTxStatus.REFUND_PENDING:
        return EkoResponse(
            success=False,
            status="REFUND_PENDING",
            message=message or "Refund pending",
            user_message=TX_STATUS_MESSAGES[3],
            tx_status=3,
            tid=tid,
            raw_response=raw_response,
            requires_inquiry=True
        )
    
    elif tx_status == EkoTxStatus.REFUNDED:
        return EkoResponse(
            success=False,
            status="REFUNDED",
            message=message or "Amount refunded",
            user_message=TX_STATUS_MESSAGES[4],
            tx_status=4,
            tid=tid,
            raw_response=raw_response
        )
    
    elif tx_status == EkoTxStatus.ON_HOLD:
        return EkoResponse(
            success=False,
            status="ON_HOLD",
            message=message or "Transaction on hold",
            user_message=TX_STATUS_MESSAGES[5],
            tx_status=5,
            tid=tid,
            raw_response=raw_response,
            requires_inquiry=True
        )
    
    # Unknown tx_status
    return EkoResponse(
        success=False,
        status="UNKNOWN",
        message=f"Unknown transaction status: {tx_status}",
        user_message="Transaction status unknown. Please contact support.",
        tx_status=tx_status,
        tid=tid,
        raw_response=raw_response,
        requires_inquiry=True
    )


def handle_error_response(
    eko_status: int,
    message: str,
    raw_response: Dict,
    service_type: str
) -> EkoResponse:
    """Handle Eko error response (status != 0)"""
    
    # Get user-friendly message
    user_message = EKO_ERROR_MESSAGES.get(eko_status, message or f"Error code: {eko_status}")
    
    # Check for specific retryable errors
    retryable_errors = [544]  # Bank not available - can retry
    should_retry = eko_status in retryable_errors
    
    # Check for errors that need status inquiry
    inquiry_errors = []  # None currently
    requires_inquiry = eko_status in inquiry_errors
    
    return EkoResponse(
        success=False,
        status="FAILED",
        message=message or f"Error: {eko_status}",
        user_message=user_message,
        error_code=eko_status,
        raw_response=raw_response,
        should_retry=should_retry,
        requires_inquiry=requires_inquiry
    )


# ==================== COMMON ERROR MESSAGES ====================

def get_common_error_message(message: str) -> str:
    """Map common Eko error messages to user-friendly versions"""
    
    common_errors = {
        "No mapping rule matched": "Service configuration error. Please try again or contact support.",
        "Agent not allowed": "This service is not activated for your account. Please contact support.",
        "Agent not allowed to do this transaction": "You are not authorized for this transaction type.",
        "Customer not allowed": "Customer account is restricted. Please contact support.",
        "No Key for Response": "Invalid request parameters. Please check your input and try again.",
        "Kindly use your production key": "Configuration error. Please contact support.",
        "Service not activated": "This service is not activated. Please contact support.",
    }
    
    for key, user_msg in common_errors.items():
        if key.lower() in message.lower():
            return user_msg
    
    return message


# ==================== BILL FETCH SPECIFIC HANDLER ====================

def handle_bill_fetch_response(response_data: Dict) -> Dict:
    """
    Handle bill fetch response specifically.
    
    Bill fetch can return:
    - Success with bill details
    - Success with "no bill due"
    - Error (validation, service not available, etc.)
    """
    
    eko_status = response_data.get("status")
    message = response_data.get("message", "")
    data = response_data.get("data", {})
    
    if eko_status == 0:
        # Success - extract bill details
        bill_amount = data.get("amount") or data.get("billAmount")
        customer_name = data.get("utilitycustomername") or data.get("customerName")
        bill_date = data.get("billdate")
        due_date = data.get("duedate")
        bill_number = data.get("billnumber")
        
        return {
            "success": True,
            "bill_amount": bill_amount,
            "customer_name": customer_name,
            "bill_date": bill_date,
            "due_date": due_date,
            "bill_number": bill_number,
            "message": message or "Bill fetched successfully",
            "raw_response": response_data
        }
    
    # Error response
    user_message = EKO_ERROR_MESSAGES.get(eko_status, message)
    
    # Check for "no bill due" type messages
    no_bill_keywords = ["no bill", "no due", "payment received", "already paid", "no pending"]
    is_no_bill = any(kw in message.lower() for kw in no_bill_keywords)
    
    return {
        "success": False,
        "is_no_bill_due": is_no_bill,
        "error_code": eko_status,
        "message": message,
        "user_message": user_message if not is_no_bill else "No pending bill found. You can enter amount manually.",
        "raw_response": response_data
    }


# ==================== BILL PAYMENT SPECIFIC HANDLER ====================

def handle_bill_payment_response(response_data: Dict) -> Dict:
    """
    Handle bill payment response specifically.
    
    Payment can return:
    - Success (tx_status = 0)
    - Failed (tx_status = 1)
    - Pending/Initiated (tx_status = 2)
    - Refund states (tx_status = 3, 4)
    - On Hold (tx_status = 5)
    """
    
    result = handle_eko_response(200, response_data, "PAYMENT")
    
    return {
        "success": result.success,
        "status": result.status,
        "message": result.message,
        "user_message": result.user_message,
        "tid": result.tid,
        "bbps_ref": result.bbps_ref,
        "tx_status": result.tx_status,
        "requires_inquiry": result.requires_inquiry,
        "raw_response": result.raw_response
    }


# ==================== VALIDATE BEFORE TRANSACTION ====================

def validate_bbps_request(
    operator_id: str,
    account_number: str,
    amount: str,
    mobile: str
) -> Tuple[bool, str]:
    """
    Validate BBPS request parameters before making API call.
    
    Returns:
        (is_valid, error_message)
    """
    
    # Operator ID validation
    if not operator_id or not str(operator_id).strip():
        return False, "Please select a service provider"
    
    # Account number validation
    if not account_number or not str(account_number).strip():
        return False, "Please enter your account/consumer number"
    
    # Amount validation
    try:
        amt = float(amount)
        if amt <= 0:
            return False, "Amount must be greater than 0"
        if amt > 100000:
            return False, "Maximum transaction amount is ₹1,00,000"
    except (ValueError, TypeError):
        return False, "Please enter a valid amount"
    
    # Mobile validation
    if not mobile or len(str(mobile).strip()) != 10:
        return False, "Please enter a valid 10-digit mobile number"
    
    if not str(mobile).isdigit():
        return False, "Mobile number should contain only digits"
    
    return True, ""


# ==================== TRANSACTION STATUS MAPPER ====================

def get_transaction_status_for_db(eko_response: EkoResponse) -> str:
    """Map Eko response to database status"""
    
    status_map = {
        "SUCCESS": "completed",
        "FAILED": "failed",
        "PENDING": "processing",
        "REFUND_PENDING": "refund_pending",
        "REFUNDED": "refunded",
        "ON_HOLD": "on_hold",
        "UNKNOWN": "pending_inquiry"
    }
    
    return status_map.get(eko_response.status, "unknown")


# ==================== LOGGING HELPER ====================

def log_eko_transaction(
    service_type: str,
    operation: str,
    request_data: Dict,
    response: EkoResponse
):
    """Log Eko transaction for debugging and audit"""
    
    log_level = logging.INFO if response.success else logging.WARNING
    
    logging.log(
        log_level,
        f"[EKO-{service_type}] {operation} | "
        f"status={response.status} | "
        f"tx_status={response.tx_status} | "
        f"tid={response.tid} | "
        f"error_code={response.error_code} | "
        f"message={response.message}"
    )
