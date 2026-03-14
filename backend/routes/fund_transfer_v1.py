"""
Fund Transfer Service (DMT V1)
Easy salary disbursal and vendor payments using Eko V1 API

Reference: https://developers.eko.in/v1/reference/fund-transfer-overview
"""

import os
import hmac
import base64
import hashlib
import time
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
import httpx

router = APIRouter(prefix="/fund-transfer", tags=["Fund Transfer V1"])

# ==================== CONFIGURATION ====================

DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "")
AUTH_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "")
USER_CODE = os.environ.get("EKO_USER_CODE", "")
BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")

# Payment modes
PAYMENT_MODE = {
    "NEFT": "4",
    "IMPS": "5",
    "RTGS": "13"
}

# Account types
ACCOUNT_TYPE = {
    "SAVINGS": "1",
    "CURRENT": "2"
}

# ==================== MODELS ====================

class FundTransferRequest(BaseModel):
    """Request model for fund transfer"""
    recipient_name: str
    account: str
    ifsc: str
    amount: str
    client_ref_id: Optional[str] = None
    payment_mode: Optional[str] = "IMPS"  # NEFT, IMPS, RTGS
    account_type: Optional[str] = "SAVINGS"  # SAVINGS, CURRENT
    sender_name: Optional[str] = "Paras Reward"
    remarks: Optional[str] = None
    
    @validator('account')
    def validate_account(cls, v):
        if not v or len(v) < 9 or len(v) > 18:
            raise ValueError('Account number must be 9-18 digits')
        return v
    
    @validator('ifsc')
    def validate_ifsc(cls, v):
        if not v or len(v) != 11:
            raise ValueError('IFSC code must be 11 characters')
        return v.upper()
    
    @validator('amount')
    def validate_amount(cls, v):
        try:
            amt = float(v)
            if amt < 1:
                raise ValueError('Minimum amount is ₹1')
            if amt > 200000:
                raise ValueError('Maximum amount is ₹2,00,000 per transaction')
        except (ValueError, TypeError):
            raise ValueError('Invalid amount')
        return v


class TransferStatusRequest(BaseModel):
    """Request model for checking transfer status"""
    tid: Optional[str] = None
    client_ref_id: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================

def validate_config() -> bool:
    """Validate Eko configuration"""
    return all([DEVELOPER_KEY, INITIATOR_ID, AUTH_KEY, USER_CODE])


def generate_headers(timestamp: str = None) -> Dict[str, str]:
    """
    Generate authentication headers for Fund Transfer API
    """
    if not timestamp:
        timestamp = str(int(round(time.time() * 1000)))
    
    encoded_key = base64.b64encode(AUTH_KEY.encode())
    secret_key = base64.b64encode(
        hmac.new(encoded_key, timestamp.encode(), hashlib.sha256).digest()
    ).decode()
    
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/x-www-form-urlencoded"
    }


def create_error_response(code: int, message: str, detail: str = None):
    """Create standardized error response"""
    return {
        "success": False,
        "status": "FAILED",
        "error_code": code,
        "message": message,
        "detail": detail or message
    }


# ==================== API ENDPOINTS ====================

@router.get("/health")
async def health_check():
    """Check Fund Transfer service health"""
    return {
        "service": "Fund Transfer V1",
        "status": "healthy" if validate_config() else "misconfigured",
        "config_valid": validate_config(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.put("/activate")
async def activate_fund_transfer_service():
    """
    Activate Fund Transfer service (service_code = 45)
    MUST be called before any transaction in production
    """
    if not validate_config():
        return create_error_response(500, "Service configuration error")
    
    try:
        url = f"{BASE_URL}/v1/user/service/activate"
        timestamp = str(int(round(time.time() * 1000)))
        headers = generate_headers(timestamp)
        
        data = {
            "service_code": "45",
            "initiator_id": INITIATOR_ID,
            "user_code": USER_CODE,
            "latlong": "19.9975,73.7898"
        }
        
        logging.info(f"[FUND TRANSFER] Activating service 45")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.put(url, headers=headers, data=data)
        
        logging.info(f"[FUND TRANSFER] Activation response: {response.status_code} - {response.text}")
        
        if response.status_code != 200:
            return create_error_response(response.status_code, "Activation failed")
        
        result = response.json()
        
        if result.get("status") == 0:
            return {
                "success": True,
                "message": "Fund Transfer service activated",
                "service_code": "45",
                "data": result.get("data", {})
            }
        else:
            return create_error_response(
                result.get("response_status_id", 500),
                result.get("message", "Activation failed")
            )
            
    except Exception as e:
        logging.error(f"[FUND TRANSFER] Activation error: {str(e)}")
        return create_error_response(500, str(e))


@router.post("/initiate")
async def initiate_fund_transfer(request: FundTransferRequest):
    """
    Initiate Fund Transfer to any bank account
    
    Supports: NEFT, IMPS, RTGS
    
    Reference: https://developers.eko.in/v1/reference/initiate-fund-transfer
    """
    if not validate_config():
        return create_error_response(500, "Service configuration error")
    
    try:
        url = f"{BASE_URL}/v1/agent/user_code:{USER_CODE}/settlement"
        timestamp = str(int(round(time.time() * 1000)))
        headers = generate_headers(timestamp)
        
        # Generate unique client_ref_id if not provided (max 20 chars)
        client_ref_id = request.client_ref_id or f"FT{uuid.uuid4().hex[:18].upper()}"
        
        # Get payment mode and account type
        payment_mode = PAYMENT_MODE.get(request.payment_mode.upper(), "5")  # Default IMPS
        account_type = ACCOUNT_TYPE.get(request.account_type.upper(), "1")  # Default Savings
        
        # Build request data
        data = {
            "initiator_id": INITIATOR_ID,
            "recipient_name": request.recipient_name,
            "account": request.account,
            "ifsc": request.ifsc,
            "amount": request.amount,
            "client_ref_id": client_ref_id,
            "payment_mode": payment_mode,
            "beneficiary_account_type": account_type,
            "sender_name": request.sender_name or "Paras Reward",
            "latlong": "19.9975,73.7898"
        }
        
        logging.info(f"[FUND TRANSFER] Initiating transfer: {client_ref_id}, Amount: {request.amount}")
        logging.info(f"[FUND TRANSFER] URL: {url}")
        logging.info(f"[FUND TRANSFER] Data: {data}")
        
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            response = await client.post(url, headers=headers, data=data)
        
        logging.error(f"[FUND TRANSFER] Response: {response.status_code} - {response.text}")
        
        if response.status_code == 403:
            return create_error_response(
                403, 
                "Service not activated or authentication failed",
                "Please activate Fund Transfer service (code 45) first"
            )
        
        if response.status_code not in [200, 201]:
            return create_error_response(
                response.status_code,
                "Transfer request failed",
                response.text[:200] if response.text else "Unknown error"
            )
        
        try:
            result = response.json()
        except:
            return create_error_response(500, "Invalid response from server")
        
        # Check response status
        tx_status = result.get("data", {}).get("tx_status", result.get("tx_status"))
        
        if result.get("status") == 0 or tx_status in [0, "0"]:
            tx_data = result.get("data", {})
            return {
                "success": True,
                "status": "SUCCESS",
                "message": "Transfer initiated successfully",
                "tid": str(tx_data.get("tid", result.get("tid", ""))),
                "client_ref_id": client_ref_id,
                "amount": request.amount,
                "recipient_name": request.recipient_name,
                "account": request.account,
                "ifsc": request.ifsc,
                "bank_ref_num": tx_data.get("bank_ref_num", ""),
                "payment_mode": request.payment_mode,
                "tx_status": tx_status,
                "tx_status_desc": tx_data.get("txstatus_desc", "Initiated"),
                "fee": tx_data.get("fee", "0"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": tx_data
            }
        elif tx_status in [1, "1", 2, "2"]:
            # Pending status
            tx_data = result.get("data", {})
            return {
                "success": True,
                "status": "PENDING",
                "message": result.get("message", "Transfer pending"),
                "tid": str(tx_data.get("tid", result.get("tid", ""))),
                "client_ref_id": client_ref_id,
                "tx_status": tx_status,
                "tx_status_desc": tx_data.get("txstatus_desc", "Pending"),
                "data": tx_data
            }
        else:
            return {
                "success": False,
                "status": "FAILED",
                "message": result.get("message", "Transfer failed"),
                "error_code": result.get("response_status_id", tx_status),
                "client_ref_id": client_ref_id,
                "data": result.get("data", {})
            }
            
    except Exception as e:
        logging.error(f"[FUND TRANSFER] Error: {str(e)}")
        return create_error_response(500, f"Transfer failed: {str(e)}")


@router.get("/status/{identifier}")
async def check_transfer_status(identifier: str, id_type: str = "tid"):
    """
    Check Fund Transfer status
    
    Args:
        identifier: Transaction ID (tid) or Client Reference ID
        id_type: "tid" or "client_ref_id"
    """
    if not validate_config():
        return create_error_response(500, "Service configuration error")
    
    try:
        # Build URL based on identifier type
        if id_type == "client_ref_id":
            url = f"{BASE_URL}/v1/transactions/client_ref_id:{identifier}"
        else:
            url = f"{BASE_URL}/v1/transactions/{identifier}"
        
        timestamp = str(int(round(time.time() * 1000)))
        headers = generate_headers(timestamp)
        
        params = {
            "initiator_id": INITIATOR_ID
        }
        
        logging.info(f"[FUND TRANSFER] Checking status: {identifier}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=headers, params=params)
        
        logging.info(f"[FUND TRANSFER] Status response: {response.status_code} - {response.text}")
        
        if response.status_code != 200:
            return create_error_response(response.status_code, "Status check failed")
        
        result = response.json()
        tx_data = result.get("data", {})
        
        return {
            "success": True,
            "tid": tx_data.get("tid", identifier),
            "client_ref_id": tx_data.get("client_ref_id", ""),
            "tx_status": tx_data.get("tx_status"),
            "tx_status_desc": tx_data.get("txstatus_desc", "Unknown"),
            "amount": tx_data.get("amount"),
            "bank_ref_num": tx_data.get("bank_ref_num", ""),
            "recipient_name": tx_data.get("recipient_name", ""),
            "account": tx_data.get("account", ""),
            "ifsc": tx_data.get("ifsc", ""),
            "timestamp": tx_data.get("timestamp", ""),
            "data": tx_data
        }
        
    except Exception as e:
        logging.error(f"[FUND TRANSFER] Status check error: {str(e)}")
        return create_error_response(500, f"Status check failed: {str(e)}")


@router.get("/balance")
async def check_balance():
    """
    Check available balance for fund transfer
    """
    if not validate_config():
        return create_error_response(500, "Service configuration error")
    
    try:
        url = f"{BASE_URL}/v1/customers/mobile_number:{INITIATOR_ID}/balance"
        timestamp = str(int(round(time.time() * 1000)))
        headers = generate_headers(timestamp)
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=headers)
        
        logging.info(f"[FUND TRANSFER] Balance response: {response.status_code} - {response.text}")
        
        if response.status_code != 200:
            return create_error_response(response.status_code, "Balance check failed")
        
        result = response.json()
        
        return {
            "success": True,
            "balance": result.get("data", {}).get("balance", "0"),
            "data": result.get("data", {})
        }
        
    except Exception as e:
        logging.error(f"[FUND TRANSFER] Balance check error: {str(e)}")
        return create_error_response(500, f"Balance check failed: {str(e)}")
