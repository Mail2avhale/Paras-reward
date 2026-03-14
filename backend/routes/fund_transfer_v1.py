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

# ==================== EKO ERROR CODES ====================
# Reference: https://developers.eko.in/docs/error-codes

EKO_ERROR_CODES = {
    0: {"message": "Success", "action": None},
    463: {"message": "User not found", "action": "Check user_code registration"},
    327: {"message": "Enrollment done. Verification pending", "action": "Complete verification"},
    17: {"message": "User wallet already exists", "action": None},
    31: {"message": "Agent cannot be registered", "action": "Contact Eko support"},
    132: {"message": "Sender name should only contain letters", "action": "Remove special characters from sender name"},
    302: {"message": "Wrong OTP", "action": "Enter correct OTP"},
    303: {"message": "OTP expired", "action": "Request new OTP"},
    342: {"message": "Recipient already registered", "action": "Use existing recipient"},
    145: {"message": "Recipient mobile number should be numeric", "action": "Enter valid mobile number"},
    140: {"message": "Recipient mobile number should be 10 digit", "action": "Enter 10 digit mobile"},
    131: {"message": "Recipient name should only contain letters", "action": "Remove special characters"},
    122: {"message": "Recipient name length should be 1-50 characters", "action": "Adjust name length"},
    39: {"message": "Maximum recipient limit reached", "action": "Delete unused recipients"},
    41: {"message": "Wrong IFSC code", "action": "Verify IFSC code"},
    536: {"message": "Invalid recipient type format", "action": "Check recipient type"},
    537: {"message": "Invalid recipient type length", "action": "Check recipient type length"},
    44: {"message": "Incomplete IFSC Code", "action": "Enter complete 11-character IFSC"},
    45: {"message": "Incomplete IFSC Code", "action": "Enter complete 11-character IFSC"},
    48: {"message": "Recipient bank not found", "action": "Verify bank IFSC"},
    102: {"message": "Invalid account number length", "action": "Check account number (9-18 digits)"},
    136: {"message": "Invalid IFSC format", "action": "Check IFSC format (e.g., HDFC0001234)"},
    508: {"message": "Invalid IFSC for selected bank", "action": "Verify IFSC belongs to the bank"},
    521: {"message": "IFSC not found in system", "action": "Verify IFSC code exists"},
    313: {"message": "Recipient registration not done", "action": "Register recipient first"},
    317: {"message": "NEFT not allowed", "action": "Use IMPS instead"},
    53: {"message": "IMPS transaction not allowed", "action": "Use NEFT instead or check limits"},
    55: {"message": "Error from NPCI", "action": "Retry after some time"},
    460: {"message": "Invalid channel", "action": "Contact Eko support"},
    319: {"message": "Invalid Sender/Initiator", "action": "Verify initiator_id"},
    314: {"message": "Monthly limit exceeded", "action": "Wait for next month or KYC upgrade"},
    350: {"message": "Verification failed - Recipient name not found", "action": "Check account holder name"},
    344: {"message": "IMPS not available for this bank", "action": "Use NEFT instead"},
    46: {"message": "Invalid account details", "action": "Verify account number and IFSC"},
    168: {"message": "Transaction ID does not exist", "action": "Check correct TID"},
    1237: {"message": "ID proof already exists", "action": "Use existing ID"},
    585: {"message": "Customer already KYC approved", "action": None},
    347: {"message": "Insufficient balance", "action": "Add balance to Eko wallet"},
    945: {"message": "Sender/Beneficiary limit exhausted for this month", "action": "Wait for next month"},
    544: {"message": "Bank not available now", "action": "Retry after some time"},
    97: {"message": "Missing required field", "action": "Check all required parameters"},
}

# Transaction status codes
TX_STATUS_CODES = {
    0: {"status": "SUCCESS", "description": "Transaction successful", "is_final": True, "refund": False},
    1: {"status": "FAILED", "description": "Transaction failed", "is_final": True, "refund": False},
    2: {"status": "PROCESSING", "description": "Response awaited / Initiated", "is_final": False, "refund": False},
    3: {"status": "REFUND_PENDING", "description": "Refund is pending", "is_final": False, "refund": True},
    4: {"status": "REFUNDED", "description": "Amount refunded to source", "is_final": True, "refund": True},
    5: {"status": "ON_HOLD", "description": "On hold - inquiry required", "is_final": False, "refund": False},
}

def get_error_message(status_code: int) -> dict:
    """Get user-friendly error message for Eko status code"""
    return EKO_ERROR_CODES.get(status_code, {
        "message": f"Unknown error (code: {status_code})",
        "action": "Contact support with error code"
    })

def get_tx_status_info(tx_status: int) -> dict:
    """Get transaction status information"""
    return TX_STATUS_CODES.get(tx_status, {
        "status": "UNKNOWN",
        "description": f"Unknown status (code: {tx_status})",
        "is_final": False,
        "refund": False
    })

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
        
        logging.info("[FUND TRANSFER] Activating service 45")
        
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
            "service_code": "45",  # Fund Transfer service code
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
        except Exception:
            return create_error_response(500, "Invalid response from server")
        
        # Check response status code from Eko
        eko_status = result.get("status")
        tx_status = result.get("data", {}).get("tx_status", result.get("tx_status"))
        tx_data = result.get("data", {})
        
        # Convert tx_status to int if string
        if isinstance(tx_status, str) and tx_status.isdigit():
            tx_status = int(tx_status)
        
        # Get error info if status is not 0 (success)
        if eko_status != 0 and eko_status is not None:
            error_info = get_error_message(eko_status)
            logging.warning(f"[FUND TRANSFER] Eko error: {eko_status} - {error_info['message']}")
            return {
                "success": False,
                "status": "FAILED",
                "error_code": eko_status,
                "message": error_info["message"],
                "user_message": f"{error_info['message']}. {error_info.get('action', '')}".strip(),
                "client_ref_id": client_ref_id,
                "action_required": error_info.get("action"),
                "data": tx_data
            }
        
        # Get transaction status info
        tx_info = get_tx_status_info(tx_status) if tx_status is not None else get_tx_status_info(0)
        
        # Build response based on tx_status
        response_data = {
            "tid": str(tx_data.get("tid", result.get("tid", ""))),
            "client_ref_id": client_ref_id,
            "amount": request.amount,
            "recipient_name": request.recipient_name,
            "account": request.account,
            "ifsc": request.ifsc,
            "bank_ref_num": tx_data.get("bank_ref_num", ""),
            "payment_mode": request.payment_mode,
            "tx_status": str(tx_status) if tx_status is not None else "0",
            "tx_status_desc": tx_data.get("txstatus_desc", tx_info["description"]),
            "fee": tx_data.get("fee", "0"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": tx_data
        }
        
        # SUCCESS: tx_status = 0
        if tx_status == 0:
            return {
                "success": True,
                "status": "SUCCESS",
                "message": "Transfer initiated successfully",
                "user_message": f"₹{request.amount} transfer initiated to account ending ****{request.account[-4:]}",
                **response_data
            }
        
        # PROCESSING: tx_status = 2
        elif tx_status == 2:
            return {
                "success": True,
                "status": "PROCESSING",
                "message": "Transfer is being processed",
                "user_message": "Your transfer is in progress. Please check status after few minutes.",
                "requires_status_check": True,
                **response_data
            }
        
        # ON_HOLD: tx_status = 5
        elif tx_status == 5:
            return {
                "success": True,
                "status": "ON_HOLD",
                "message": "Transfer on hold - status check required",
                "user_message": "Transfer is on hold. Please check status or contact support.",
                "requires_status_check": True,
                **response_data
            }
        
        # FAILED: tx_status = 1
        elif tx_status == 1:
            return {
                "success": False,
                "status": "FAILED",
                "message": result.get("message", "Transfer failed"),
                "user_message": "Transfer failed. Amount will be refunded if deducted.",
                **response_data
            }
        
        # REFUND states: tx_status = 3 or 4
        elif tx_status in [3, 4]:
            refund_status = "REFUNDED" if tx_status == 4 else "REFUND_PENDING"
            return {
                "success": False,
                "status": refund_status,
                "message": tx_info["description"],
                "user_message": "Transfer was reversed. Amount will be refunded." if tx_status == 3 else "Transfer reversed. Amount has been refunded.",
                "is_refunded": tx_status == 4,
                **response_data
            }
        
        # Default: treat as success if status=0 from Eko
        else:
            return {
                "success": True,
                "status": "SUCCESS",
                "message": "Transfer initiated successfully",
                **response_data
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
        
        # Get tx_status
        tx_status = tx_data.get("tx_status")
        if isinstance(tx_status, str) and tx_status.isdigit():
            tx_status = int(tx_status)
        
        # Get status info
        tx_info = get_tx_status_info(tx_status) if tx_status is not None else {"status": "UNKNOWN", "description": "Unknown"}
        
        # Build detailed response
        response_data = {
            "success": True,
            "tid": tx_data.get("tid", identifier),
            "client_ref_id": tx_data.get("client_ref_id", ""),
            "tx_status": str(tx_status) if tx_status is not None else None,
            "tx_status_desc": tx_data.get("txstatus_desc", tx_info["description"]),
            "status": tx_info["status"],
            "amount": tx_data.get("amount"),
            "bank_ref_num": tx_data.get("bank_ref_num", ""),
            "recipient_name": tx_data.get("recipient_name", ""),
            "account": tx_data.get("account", ""),
            "ifsc": tx_data.get("ifsc", ""),
            "fee": tx_data.get("fee", "0"),
            "payment_mode": tx_data.get("payment_mode"),
            "timestamp": tx_data.get("timestamp", ""),
            "is_final": tx_info.get("is_final", False),
            "is_refunded": tx_info.get("refund", False),
            "data": tx_data
        }
        
        # Add user-friendly message based on status
        status_messages = {
            0: "Transfer completed successfully.",
            1: "Transfer failed. Please try again or contact support.",
            2: "Transfer is being processed. Please check again in few minutes.",
            3: "Transfer reversed. Refund is being processed.",
            4: "Transfer reversed. Amount has been refunded to your account.",
            5: "Transfer is on hold. Please contact support."
        }
        response_data["user_message"] = status_messages.get(tx_status, "Please contact support for status.")
        
        return response_data
        
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



# ==================== PRC REFUND MODULE ====================

# Database reference for PRC operations
db = None

def set_db(database):
    """Set database reference for PRC operations"""
    global db
    db = database


async def refund_prc_on_failure(user_id: str, prc_amount: int, transaction_id: str, reason: str) -> dict:
    """
    Refund PRC to user when transaction fails or is reversed.
    
    Args:
        user_id: User's unique ID
        prc_amount: Amount of PRC to refund
        transaction_id: Transaction ID for reference
        reason: Reason for refund
    
    Returns:
        dict with success status and details
    """
    if db is None:
        logging.error("[PRC-REFUND] Database not available")
        return {"success": False, "error": "Database not available"}
    
    if not user_id or not prc_amount:
        return {"success": False, "error": "Missing user_id or prc_amount"}
    
    try:
        # Get current user balance
        user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1, "name": 1})
        if not user:
            logging.error(f"[PRC-REFUND] User not found: {user_id}")
            return {"success": False, "error": "User not found"}
        
        current_balance = user.get("prc_balance", 0)
        new_balance = current_balance + prc_amount
        
        # Update user balance
        update_result = await db.users.update_one(
            {"uid": user_id},
            {
                "$inc": {"prc_balance": prc_amount},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        if update_result.modified_count == 0:
            logging.error(f"[PRC-REFUND] Failed to update balance for user: {user_id}")
            return {"success": False, "error": "Failed to update balance"}
        
        # Log the refund transaction
        refund_record = {
            "user_id": user_id,
            "type": "refund",
            "amount": prc_amount,
            "transaction_id": transaction_id,
            "reason": reason,
            "balance_before": current_balance,
            "balance_after": new_balance,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.prc_transactions.insert_one(refund_record)
        
        logging.info(f"[PRC-REFUND] Refunded {prc_amount} PRC to user {user_id}. Reason: {reason}")
        
        return {
            "success": True,
            "refunded_amount": prc_amount,
            "new_balance": new_balance,
            "transaction_id": transaction_id
        }
        
    except Exception as e:
        logging.error(f"[PRC-REFUND] Error: {str(e)}")
        return {"success": False, "error": str(e)}


async def deduct_prc_for_transfer(user_id: str, prc_amount: int, transaction_id: str, description: str) -> dict:
    """
    Deduct PRC from user balance for fund transfer.
    
    Args:
        user_id: User's unique ID
        prc_amount: Amount of PRC to deduct
        transaction_id: Transaction ID for reference
        description: Description of the transaction
    
    Returns:
        dict with success status and details
    """
    if db is None:
        logging.error("[PRC-DEDUCT] Database not available")
        return {"success": False, "error": "Database not available"}
    
    if not user_id or not prc_amount:
        return {"success": False, "error": "Missing user_id or prc_amount"}
    
    try:
        # Get current user balance
        user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1, "name": 1})
        if not user:
            return {"success": False, "error": "User not found"}
        
        current_balance = user.get("prc_balance", 0)
        
        # Check if sufficient balance
        if current_balance < prc_amount:
            return {
                "success": False, 
                "error": "Insufficient PRC balance",
                "required": prc_amount,
                "available": current_balance
            }
        
        new_balance = current_balance - prc_amount
        
        # Deduct balance
        update_result = await db.users.update_one(
            {"uid": user_id, "prc_balance": {"$gte": prc_amount}},  # Atomic check
            {
                "$inc": {"prc_balance": -prc_amount},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        if update_result.modified_count == 0:
            return {"success": False, "error": "Insufficient balance or concurrent modification"}
        
        # Log the deduction
        deduct_record = {
            "user_id": user_id,
            "type": "debit",
            "amount": prc_amount,
            "transaction_id": transaction_id,
            "description": description,
            "balance_before": current_balance,
            "balance_after": new_balance,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.prc_transactions.insert_one(deduct_record)
        
        logging.info(f"[PRC-DEDUCT] Deducted {prc_amount} PRC from user {user_id}")
        
        return {
            "success": True,
            "deducted_amount": prc_amount,
            "new_balance": new_balance,
            "transaction_id": transaction_id
        }
        
    except Exception as e:
        logging.error(f"[PRC-DEDUCT] Error: {str(e)}")
        return {"success": False, "error": str(e)}


# ==================== TRANSACTION CALLBACK ====================

class TransactionCallback(BaseModel):
    """Eko Transaction Status Callback payload"""
    tx_status: int
    amount: float
    payment_mode: str
    txstatus_desc: str
    fee: Optional[float] = 0
    gst: Optional[float] = 0
    sender_name: Optional[str] = None
    tid: str
    beneficiary_account_type: Optional[int] = None
    client_ref_id: str
    old_tx_status: Optional[int] = None
    old_tx_status_desc: Optional[str] = None
    bank_ref_num: Optional[str] = None
    ifsc: Optional[str] = None
    recipient_name: Optional[str] = None
    account: Optional[str] = None
    timestamp: Optional[str] = None


@router.post("/callback")
async def transaction_status_callback(callback: TransactionCallback):
    """
    Eko Transaction Status Callback Endpoint
    
    Eko will call this endpoint to update transaction status.
    Reference: https://developers.eko.in/v1/docs/fund-transfer#setup-transaction-status-callback
    
    Flow:
    1. Receive callback from Eko
    2. Update transaction status in database
    3. If status changed to FAILED/REVERSED, refund PRC to user
    4. Return 200 to acknowledge
    """
    logging.info(f"[CALLBACK] Received: TID={callback.tid}, status={callback.tx_status}, old_status={callback.old_tx_status}")
    
    try:
        if db is None:
            logging.warning("[CALLBACK] Database not available")
            return {"status": "acknowledged", "warning": "Database not available"}
        
        # Find the transaction in our records
        transaction = await db.fund_transfers.find_one(
            {"$or": [
                {"tid": callback.tid},
                {"tid": str(callback.tid)},
                {"client_ref_id": callback.client_ref_id}
            ]},
            {"_id": 0}
        )
        
        # Get tx_status info
        tx_info = get_tx_status_info(callback.tx_status)
        old_status = callback.old_tx_status
        
        # Update transaction record
        update_data = {
            "tx_status": callback.tx_status,
            "tx_status_desc": callback.txstatus_desc,
            "status": tx_info["status"],
            "bank_ref_num": callback.bank_ref_num or "",
            "fee": callback.fee,
            "gst": callback.gst,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "callback_received_at": datetime.now(timezone.utc).isoformat(),
            "old_tx_status": old_status,
            "is_final": tx_info["is_final"]
        }
        
        await db.fund_transfers.update_one(
            {"$or": [
                {"tid": callback.tid},
                {"tid": str(callback.tid)},
                {"client_ref_id": callback.client_ref_id}
            ]},
            {"$set": update_data}
        )
        
        # Check if we need to refund PRC
        # Refund if: status changed to FAILED (1), REFUND_PENDING (3), or REFUNDED (4)
        should_refund = callback.tx_status in [1, 3, 4]
        was_success_before = old_status in [0, 2, None]  # Was success or processing before
        
        if should_refund and was_success_before and transaction:
            user_id = transaction.get("user_id")
            prc_amount = transaction.get("prc_deducted", 0)
            
            if user_id and prc_amount and not transaction.get("prc_refunded"):
                # Refund PRC
                refund_result = await refund_prc_on_failure(
                    user_id=user_id,
                    prc_amount=prc_amount,
                    transaction_id=str(callback.tid),
                    reason=f"Transaction {tx_info['status']}: {callback.txstatus_desc}"
                )
                
                if refund_result.get("success"):
                    # Mark as refunded
                    await db.fund_transfers.update_one(
                        {"tid": str(callback.tid)},
                        {"$set": {"prc_refunded": True, "prc_refund_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    logging.info(f"[CALLBACK] PRC refunded for TID {callback.tid}")
                else:
                    logging.error(f"[CALLBACK] PRC refund failed: {refund_result.get('error')}")
        
        logging.info(f"[CALLBACK] Processed TID={callback.tid}, new_status={tx_info['status']}")
        
        return {
            "status": "acknowledged",
            "tid": callback.tid,
            "tx_status": callback.tx_status,
            "processed": True
        }
        
    except Exception as e:
        logging.error(f"[CALLBACK] Error processing callback: {str(e)}")
        # Still return 200 to acknowledge receipt
        return {"status": "acknowledged", "error": str(e)}


# ==================== MANUAL STATUS CHECK WITH AUTO-REFUND ====================

@router.post("/check-and-refund/{tid}")
async def check_status_and_refund(tid: str, user_id: Optional[str] = None):
    """
    Check transaction status and auto-refund PRC if failed/reversed.
    
    Use this for manual reconciliation when callback is missed.
    """
    if not validate_config():
        return create_error_response(500, "Service configuration error")
    
    try:
        # First check status from Eko
        url = f"{BASE_URL}/v1/transactions/{tid}"
        timestamp = str(int(round(time.time() * 1000)))
        headers = generate_headers(timestamp)
        
        params = {"initiator_id": INITIATOR_ID}
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=headers, params=params)
        
        if response.status_code != 200:
            return create_error_response(response.status_code, "Status check failed")
        
        result = response.json()
        tx_data = result.get("data", {})
        tx_status = tx_data.get("tx_status")
        
        if isinstance(tx_status, str) and tx_status.isdigit():
            tx_status = int(tx_status)
        
        tx_info = get_tx_status_info(tx_status) if tx_status is not None else {"status": "UNKNOWN"}
        
        # Check if refund needed
        refund_result = None
        if tx_status in [1, 3, 4]:  # FAILED, REFUND_PENDING, REFUNDED
            # Try to get transaction from DB
            if db is not None:
                transaction = await db.fund_transfers.find_one(
                    {"$or": [{"tid": tid}, {"tid": str(tid)}]},
                    {"_id": 0}
                )
                
                if transaction:
                    stored_user_id = transaction.get("user_id") or user_id
                    prc_amount = transaction.get("prc_deducted", 0)
                    already_refunded = transaction.get("prc_refunded", False)
                    
                    if stored_user_id and prc_amount and not already_refunded:
                        refund_result = await refund_prc_on_failure(
                            user_id=stored_user_id,
                            prc_amount=prc_amount,
                            transaction_id=str(tid),
                            reason=f"Manual check: Transaction {tx_info['status']}"
                        )
                        
                        if refund_result.get("success"):
                            await db.fund_transfers.update_one(
                                {"$or": [{"tid": tid}, {"tid": str(tid)}]},
                                {"$set": {
                                    "prc_refunded": True,
                                    "prc_refund_at": datetime.now(timezone.utc).isoformat(),
                                    "tx_status": tx_status,
                                    "status": tx_info["status"]
                                }}
                            )
        
        return {
            "success": True,
            "tid": tid,
            "tx_status": str(tx_status) if tx_status is not None else None,
            "status": tx_info["status"],
            "tx_status_desc": tx_data.get("txstatus_desc", tx_info.get("description", "")),
            "amount": tx_data.get("amount"),
            "bank_ref_num": tx_data.get("bank_ref_num", ""),
            "is_refundable": tx_status in [1, 3, 4],
            "refund_processed": refund_result.get("success") if refund_result else None,
            "refund_details": refund_result,
            "data": tx_data
        }
        
    except Exception as e:
        logging.error(f"[CHECK-REFUND] Error: {str(e)}")
        return create_error_response(500, f"Check failed: {str(e)}")
