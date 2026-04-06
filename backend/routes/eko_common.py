"""
EKO Common Utilities
====================
Shared utilities for all Eko API integrations.
All credentials loaded from environment variables - NO hardcoding.
"""
import os
import base64
import hashlib
import hmac
import time
import logging
import requests
from fastapi import HTTPException

# All EKO credentials from .env — no defaults, fail fast if missing
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "")


def generate_eko_secret_key(timestamp: str) -> str:
    """Generate secret-key for Eko API authentication"""
    if not EKO_AUTHENTICATOR_KEY:
        raise HTTPException(status_code=500, detail="EKO_AUTHENTICATOR_KEY not configured")
    
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode()).decode()
    signature = hmac.new(
        encoded_key.encode(),
        timestamp.encode(),
        hashlib.sha256
    ).digest()
    return base64.b64encode(signature).decode()


def generate_request_hash(timestamp: str, utility_acc_no: str, amount: str, user_code: str) -> str:
    """Generate request-hash for Eko payment requests"""
    if not EKO_AUTHENTICATOR_KEY:
        raise HTTPException(status_code=500, detail="EKO_AUTHENTICATOR_KEY not configured")
    
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode()).decode()
    message = f"{timestamp}{utility_acc_no}{amount}{user_code}"
    signature = hmac.new(
        encoded_key.encode(),
        message.encode(),
        hashlib.sha256
    ).digest()
    return base64.b64encode(signature).decode()


def get_eko_headers(timestamp: str, include_request_hash: bool = False, 
                    utility_acc_no: str = "", amount: str = "", user_code: str = "") -> dict:
    """Get standard Eko API headers"""
    secret_key = generate_eko_secret_key(timestamp)
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    if include_request_hash:
        uc = user_code or EKO_USER_CODE
        request_hash = generate_request_hash(timestamp, utility_acc_no, amount, uc)
        headers["request_hash"] = request_hash
    
    return headers


async def make_eko_request(endpoint: str, method: str = "GET", data: dict = None, form_data: bool = False) -> dict:
    """
    Make authenticated request to Eko API
    
    Args:
        endpoint: API endpoint (e.g., /v2/billpayments/paybill)
        method: HTTP method (GET/POST/PUT)
        data: Request body data
        form_data: Whether to send as form data (True) or JSON (False)
    
    Returns:
        dict: Eko API response
    """
    if not EKO_BASE_URL or not EKO_DEVELOPER_KEY or not EKO_AUTHENTICATOR_KEY:
        raise HTTPException(status_code=500, detail="Eko API credentials not configured")
    
    timestamp = str(round(time.time() * 1000))  # MILLISECONDS as per EKO docs
    
    # Build URL with initiator_id
    url = f"{EKO_BASE_URL}{endpoint}"
    if "?" in url:
        url += f"&initiator_id={EKO_INITIATOR_ID}"
    else:
        url += f"?initiator_id={EKO_INITIATOR_ID}"
    
    # Add user_code to data if not present
    if data and "user_code" not in data:
        data["user_code"] = EKO_USER_CODE
    
    # Generate headers
    utility_acc_no = data.get("utility_acc_no", "") if data else ""
    amount = str(data.get("amount", "")) if data else ""
    user_code = data.get("user_code", EKO_USER_CODE) if data else EKO_USER_CODE
    
    headers = get_eko_headers(
        timestamp, 
        include_request_hash=(method.upper() == "POST"),
        utility_acc_no=utility_acc_no,
        amount=amount,
        user_code=user_code
    )
    
    logging.info(f"[EKO API] Timestamp: {timestamp}")
    logging.info(f"[EKO API] URL: {url}")
    logging.info(f"[EKO API] Body: {data}")
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=60)
        elif method.upper() == "POST":
            if form_data:
                response = requests.post(url, headers=headers, data=data, timeout=60)
            else:
                headers["Content-Type"] = "application/json"
                response = requests.post(url, headers=headers, json=data, timeout=60)
        elif method.upper() == "PUT":
            if form_data:
                response = requests.put(url, headers=headers, data=data, timeout=60)
            else:
                headers["Content-Type"] = "application/json"
                response = requests.put(url, headers=headers, json=data, timeout=60)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported HTTP method: {method}")
        
        logging.info(f"[EKO API] Response Status: {response.status_code}")
        logging.info(f"[EKO API] Response: {response.text[:500]}")
        
        result = response.json()
        
        # Check for Eko-specific error codes
        if result.get("status") == 463:
            raise HTTPException(
                status_code=503, 
                detail="Service not enabled for this operator. Contact Eko support."
            )
        
        return result
        
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Eko API timeout")
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Eko API connection error")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[EKO API] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Eko API error: {str(e)}")


# Eko status codes for error messages
EKO_STATUS_CODES = {
    0: "Success",
    1: "Failure",
    2: "Pending",
    3: "Refunded",
    4: "Invalid Sender/Initiator",
    5: "Insufficient balance",
    6: "Authentication failed",
    7: "Service unavailable",
    463: "Service not enabled for operator"
}

TX_STATUS_CODES = {
    0: "Success",
    1: "Failed",
    2: "Response awaited (Pending)",
    3: "Refunded"
}


def get_eko_error_message(code: int) -> str:
    """Get human-readable error message for Eko status code"""
    return EKO_STATUS_CODES.get(code, f"Unknown error (code: {code})")


def get_tx_status_message(status: int) -> str:
    """Get human-readable transaction status message"""
    return TX_STATUS_CODES.get(status, f"Unknown status (code: {status})")
