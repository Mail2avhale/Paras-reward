"""
EKO Common Utilities
====================
Shared utilities for all Eko API integrations (BBPS, DMT)

This module contains:
- EKO API configuration
- Authentication helpers
- Common request function
- Error code mappings
"""

import os
import base64
import hashlib
import hmac
import time
import logging
import requests
from fastapi import HTTPException

# ==================== EKO API CONFIGURATION ====================
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")

# ==================== AUTHENTICATION HELPERS ====================

def generate_eko_secret_key(timestamp: str) -> str:
    """Generate secret-key for Eko API authentication"""
    if not EKO_AUTHENTICATOR_KEY:
        raise ValueError("EKO_AUTHENTICATOR_KEY not configured")
    
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
    secret_key = base64.b64encode(
        hmac.new(encoded_key.encode('utf-8'), timestamp.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    return secret_key

def generate_request_hash(timestamp: str, utility_acc_no: str, amount: str, user_code: str) -> str:
    """Generate request_hash for POST requests"""
    if not EKO_AUTHENTICATOR_KEY:
        raise ValueError("EKO_AUTHENTICATOR_KEY not configured")
    
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8')).decode('utf-8')
    concat_str = timestamp + utility_acc_no + amount + user_code
    request_hash = base64.b64encode(
        hmac.new(encoded_key.encode('utf-8'), concat_str.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    return request_hash

def get_eko_headers(timestamp: str = None, include_request_hash: bool = False, 
                    utility_acc_no: str = "", amount: str = "", user_code: str = None) -> dict:
    """Get standard Eko API headers"""
    if timestamp is None:
        timestamp = str(int(time.time() * 1000))
    
    if user_code is None:
        user_code = EKO_USER_CODE
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": generate_eko_secret_key(timestamp),
        "secret-key-timestamp": timestamp,
    }
    
    if include_request_hash:
        headers["request_hash"] = generate_request_hash(timestamp, utility_acc_no, amount, user_code)
        headers["Content-Type"] = "application/json"
    
    return headers

# ==================== MAIN REQUEST FUNCTION ====================

async def make_eko_request(endpoint: str, method: str = "GET", data: dict = None, form_data: bool = False):
    """Make authenticated request to Eko API
    
    Args:
        endpoint: API endpoint path (e.g., /v1/bill/fetchbill)
        method: HTTP method (GET, POST, PUT)
        data: Request data/parameters
        form_data: If True, send as form data instead of JSON
    
    Returns:
        dict: Eko API response
    
    Raises:
        HTTPException: On API errors
    """
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
    
    # Generate secret-key
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
        
        utility_acc_no = data.get("utility_acc_no", "")
        amount = str(data.get("amount", ""))
        user_code = data.get("user_code", EKO_USER_CODE)
        
        concat_str = timestamp + utility_acc_no + amount + user_code
        request_hash = base64.b64encode(
            hmac.new(encoded_key.encode('utf-8'), concat_str.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        headers["request_hash"] = request_hash
        
        logging.info(f"[EKO API] Timestamp: {timestamp}, Concat: {concat_str}")
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, params=data, timeout=120)
        elif method.upper() == "POST":
            logging.info(f"[EKO API] URL: {url}")
            logging.info(f"[EKO API] Body: {data}")
            response = requests.post(url, json=data, headers=headers, timeout=120)
        elif method.upper() == "PUT":
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            response = requests.put(url, headers=headers, data=data, timeout=60)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        logging.info(f"[EKO API] Response Status: {response.status_code}")
        logging.info(f"[EKO API] Response: {response.text[:300]}")
        
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
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Connection error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[EKO API] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")

# ==================== ERROR CODE MAPPINGS ====================

EKO_STATUS_CODES = {
    "0": "Success",
    "463": "User not found",
    "327": "Enrollment done. Verification pending",
    "17": "User wallet already exists",
    "31": "Agent cannot be registered",
    "319": "Invalid Sender/Initiator",
    "302": "Wrong OTP",
    "303": "OTP expired",
    "342": "Recipient already registered",
    "313": "Recipient registration not done",
    "350": "Verification failed. Recipient name not found",
    "41": "Wrong IFSC",
    "48": "Recipient bank not found",
    "102": "Invalid Account number length",
    "46": "Invalid account details",
    "317": "NEFT not allowed",
    "53": "IMPS transaction not allowed",
    "55": "Error from NPCI",
    "344": "IMPS is not available in this bank",
    "168": "TID does not exist",
    "544": "Transaction not processed. Bank is not available now",
    "339": "Transaction failed",
    "347": "Insufficient balance in agent wallet",
    "338": "Limit exceeded for customer",
}

TX_STATUS_CODES = {
    0: "Success - Transaction completed",
    1: "Failed - Transaction failed",
    2: "Pending - Transaction in progress",
    3: "Refund Pending - Refund initiated",
    4: "Refunded - Amount refunded",
    5: "On Hold - Transaction on hold",
}

def get_eko_error_message(code: str) -> str:
    """Get human-readable error message for Eko status code"""
    return EKO_STATUS_CODES.get(str(code), f"Unknown error (Code: {code})")

def get_tx_status_message(status: int) -> str:
    """Get human-readable message for transaction status"""
    return TX_STATUS_CODES.get(status, f"Unknown status ({status})")
