"""
EKO LEVIN DMT SERVICE - OTP Based Fund Transfer
Base URL: https://api.eko.in:25002/ekoicici/v3
"""

import os
import logging
import httpx
import hmac
import hashlib
import base64
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/eko/levin-dmt", tags=["Levin DMT"])

# ==================== CONFIGURATION ====================

EKO_BASE_URL_V3 = os.environ.get("EKO_BASE_URL_V3", "https://api.eko.in:25002/ekoicici/v3")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "7c179a397b4710e71b2248d1f5892d19")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "7a2529f5-3587-4add-a2df-3d0606d62460")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")

# ==================== MODELS ====================

class SenderCheckRequest(BaseModel):
    customer_mobile: str

class SenderRegisterRequest(BaseModel):
    customer_mobile: str
    name: str
    dob: Optional[str] = "1990-01-01"
    address: Optional[str] = "India"

class SenderOTPVerifyRequest(BaseModel):
    customer_mobile: str
    otp: str

class RecipientAddRequest(BaseModel):
    customer_mobile: str
    recipient_name: str
    recipient_mobile: str
    account_number: str
    ifsc_code: str

class RecipientActivateRequest(BaseModel):
    customer_mobile: str
    recipient_id: str

class TransactionOTPRequest(BaseModel):
    customer_mobile: str
    recipient_id: str
    beneficiary_id: str
    amount: int

class TransferRequest(BaseModel):
    customer_mobile: str
    recipient_id: str
    beneficiary_id: str
    amount: int
    otp: str
    otp_ref_id: str
    client_ref_id: Optional[str] = None

class TransactionStatusRequest(BaseModel):
    transaction_id: str

# ==================== HELPERS ====================

def generate_secret_key(timestamp: str) -> str:
    """Generate HMAC-SHA256 secret key for Eko API authentication"""
    encoder_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode()).decode()
    sig = hmac.new(encoder_key.encode(), timestamp.encode(), hashlib.sha256).digest()
    return base64.b64encode(sig).decode()

def get_headers() -> dict:
    """Get common headers for Eko API requests"""
    timestamp = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": generate_secret_key(timestamp),
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/x-www-form-urlencoded"
    }

# ==================== API ENDPOINTS ====================

@router.get("/health")
async def health_check():
    """Check Levin DMT service health"""
    return {
        "status": "healthy",
        "service": "Levin DMT V3",
        "base_url": EKO_BASE_URL_V3,
        "user_code": EKO_USER_CODE,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# STEP 1: Check Sender Profile
@router.post("/sender/check")
async def check_sender(request: SenderCheckRequest):
    """
    Step 1: Check if sender exists and get their profile
    GET /v3/customer/profile/{customer_id}
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/profile/{request.customer_mobile}"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[Levin DMT] Check sender: {request.customer_mobile}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=get_headers(), params=params)
            
            logging.info(f"[Levin DMT] Sender check response: {response.status_code}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": True,
                    "sender_exists": False,
                    "message": "Sender not found. Please register."
                }
            
            result = response.json()
            
            logging.info(f"[Levin DMT] Sender check result: {result}")
            
            # Check if sender exists - look for is_registered in data
            data = result.get("data", {})
            is_registered = data.get("is_registered", 0)
            customer_profile = data.get("customer_profile", {})
            
            if is_registered == 1 or result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "sender_exists": True,
                    "sender": {
                        "customer_id": request.customer_mobile,
                        "name": customer_profile.get("name", data.get("name")),
                        "mobile": customer_profile.get("mobile"),
                        "available_limit": customer_profile.get("next_allowed_limit", data.get("available_limit")),
                        "used_limit": customer_profile.get("chart", [{}])[0].get("data", {}).get("used", 0) if customer_profile.get("chart") else 0,
                        "total_limit": customer_profile.get("total_monthly_limit", data.get("total_limit"))
                    }
                }
            else:
                return {
                    "success": True,
                    "sender_exists": False,
                    "message": result.get("message", "Sender not registered")
                }
                
    except Exception as e:
        logging.error(f"[Levin DMT] Check sender error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# STEP 2: Register Sender
@router.post("/sender/register")
async def register_sender(request: SenderRegisterRequest):
    """
    Step 2: Register new sender
    POST /v3/customer/account
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/account"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": request.customer_mobile,
            "name": request.name,
            "dob": request.dob,
            "residence_address": f'["{request.address}","India"]'
        }
        
        logging.info(f"[Levin DMT] Register sender: {request.customer_mobile}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.info(f"[Levin DMT] Register response: {response.status_code} - {response.text[:500] if response.text else 'EMPTY'}")
            
            if response.status_code == 204 or not response.text:
                raise HTTPException(status_code=500, detail="Service not activated. Contact Eko support.")
            
            try:
                result = response.json()
            except Exception as json_err:
                logging.error(f"[Levin DMT] Register JSON error: {json_err}, raw: {response.text[:300]}")
                return {
                    "success": False,
                    "message": f"Eko API error: {response.text[:200]}"
                }
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "otp_sent": True,
                    "message": "OTP sent to customer mobile. Please verify.",
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Registration failed"),
                    "error_code": result.get("response_status_id")
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[Levin DMT] Register sender error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# STEP 3: Verify Sender OTP
@router.post("/sender/verify-otp")
async def verify_sender_otp(request: SenderOTPVerifyRequest):
    """
    Step 3: Verify sender OTP
    PUT /v3/customer/account/otp/verify
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/account/otp/verify"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": request.customer_mobile,
            "otp": request.otp
        }
        
        logging.info(f"[Levin DMT] Verify OTP for: {request.customer_mobile}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.put(url, headers=get_headers(), data=data)
            
            logging.info(f"[Levin DMT] OTP verify response: {response.status_code}")
            
            if response.status_code == 204 or not response.text:
                raise HTTPException(status_code=500, detail="Service not activated")
            
            result = response.json()
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "message": "Sender verified successfully",
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "OTP verification failed"),
                    "error_code": result.get("response_status_id")
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[Levin DMT] Verify OTP error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# STEP 4: Get Recipients List
@router.get("/recipients/{customer_mobile}")
async def get_recipients(customer_mobile: str):
    """
    Step 4: Get list of recipients for a sender
    GET /v3/customer/payment/ppi/sender/{customer_id}/recipients
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/payment/ppi/sender/{customer_mobile}/recipients"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[Levin DMT] Get recipients for: {customer_mobile}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=get_headers(), params=params)
            
            logging.info(f"[Levin DMT] Recipients response: {response.status_code} - {response.text[:500] if response.text else 'EMPTY'}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": True,
                    "recipients": [],
                    "message": "No recipients found"
                }
            
            try:
                result = response.json()
            except Exception as json_err:
                logging.error(f"[Levin DMT] JSON parse error: {json_err}, raw: {response.text[:200]}")
                return {
                    "success": False,
                    "recipients": [],
                    "message": f"API error: {response.text[:200]}"
                }
            
            if result.get("response_status_id") == 0:
                recipients = result.get("data", {}).get("recipient_list", [])
                return {
                    "success": True,
                    "recipients": recipients,
                    "count": len(recipients)
                }
            else:
                return {
                    "success": True,
                    "recipients": [],
                    "message": result.get("message", "No recipients")
                }
                
    except Exception as e:
        logging.error(f"[Levin DMT] Get recipients error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# STEP 5: Add Recipient
@router.post("/recipient/add")
async def add_recipient(request: RecipientAddRequest):
    """
    Step 5: Add a new recipient
    POST /v3/customer/payment/ppi/sender/{customer_id}/recipient
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/payment/ppi/sender/{request.customer_mobile}/recipient"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "recipient_name": request.recipient_name,
            "recipient_mobile": request.recipient_mobile,
            "account": request.account_number,
            "bank_code": request.ifsc_code,
            "recipient_type": "3"  # Bank account
        }
        
        logging.info(f"[Levin DMT] Add recipient for: {request.customer_mobile}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.info(f"[Levin DMT] Add recipient response: {response.status_code} - {response.text[:300]}")
            
            if response.status_code == 204 or not response.text:
                raise HTTPException(status_code=500, detail="Service not activated")
            
            result = response.json()
            
            if result.get("response_status_id") == 0:
                recipient_data = result.get("data", {})
                return {
                    "success": True,
                    "message": "Recipient added successfully",
                    "recipient_id": recipient_data.get("recipient_id"),
                    "data": recipient_data
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to add recipient"),
                    "error_code": result.get("response_status_id")
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[Levin DMT] Add recipient error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# STEP 6: Activate Recipient (Register with Bank)
@router.post("/recipient/activate")
async def activate_recipient(request: RecipientActivateRequest):
    """
    Step 6: Activate recipient for transfers
    POST /v3/customer/payment/ppi/sender/{customer_id}/bank/recipient
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/payment/ppi/sender/{request.customer_mobile}/bank/recipient"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "recipient_id": request.recipient_id
        }
        
        logging.info(f"[Levin DMT] Activate recipient: {request.recipient_id}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.info(f"[Levin DMT] Activate response: {response.status_code}")
            
            if response.status_code == 204 or not response.text:
                raise HTTPException(status_code=500, detail="Service not activated")
            
            result = response.json()
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "message": "Recipient activated successfully",
                    "beneficiary_id": result.get("data", {}).get("beneficiary_id"),
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Activation failed"),
                    "error_code": result.get("response_status_id")
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[Levin DMT] Activate recipient error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# STEP 7: Send Transaction OTP
@router.post("/transfer/send-otp")
async def send_transaction_otp(request: TransactionOTPRequest):
    """
    Step 7: Send OTP for transaction
    POST /v3/customer/payment/ppi/otp
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/payment/ppi/otp"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": request.customer_mobile,
            "recipient_id": request.recipient_id,
            "beneficiary_id": request.beneficiary_id,
            "amount": str(request.amount),
            "service_code": "80"  # Levin DMT service code
        }
        
        logging.info(f"[Levin DMT] Send transaction OTP: {request.customer_mobile}, amount={request.amount}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.info(f"[Levin DMT] OTP send response: {response.status_code}")
            
            if response.status_code == 204 or not response.text:
                raise HTTPException(status_code=500, detail="Service not activated")
            
            result = response.json()
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "otp_sent": True,
                    "message": "OTP sent to customer mobile",
                    "otp_ref_id": result.get("data", {}).get("otp_ref_id"),
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to send OTP"),
                    "error_code": result.get("response_status_id")
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[Levin DMT] Send OTP error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# STEP 8: Initiate Transfer
@router.post("/transfer")
async def initiate_transfer(request: TransferRequest):
    """
    Step 8: Initiate fund transfer
    POST /v3/customer/payment/ppi
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/payment/ppi"
        
        # Generate unique client_ref_id if not provided
        client_ref_id = request.client_ref_id or f"LEVIN{uuid.uuid4().hex[:12].upper()}"
        
        # Current timestamp
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": request.customer_mobile,
            "recipient_id": request.recipient_id,
            "beneficiary_id": request.beneficiary_id,
            "amount": str(request.amount),
            "currency": "INR",
            "channel": "2",  # IMPS
            "state": "1",
            "timestamp": timestamp,
            "latlong": "28.6139,77.2090",
            "client_ref_id": client_ref_id,
            "otp": request.otp,
            "otp_ref_id": request.otp_ref_id,
            "recipient_id_type": "1"
        }
        
        logging.info(f"[Levin DMT] Transfer: customer={request.customer_mobile}, amount={request.amount}, ref={client_ref_id}")
        
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.info(f"[Levin DMT] Transfer response: {response.status_code} - {response.text[:500]}")
            
            if response.status_code == 204 or not response.text:
                raise HTTPException(status_code=500, detail="Service not activated. Contact Eko support.")
            
            result = response.json()
            
            # Check transaction status
            tx_status = result.get("data", {}).get("tx_status")
            tx_desc = result.get("data", {}).get("txstatus_desc", "")
            
            if result.get("response_status_id") == 0:
                return {
                    "success": tx_status == "0",
                    "transaction_id": result.get("data", {}).get("tid"),
                    "bank_ref_num": result.get("data", {}).get("bank_ref_num"),
                    "tx_status": tx_status,
                    "tx_status_desc": tx_desc,
                    "amount": request.amount,
                    "client_ref_id": client_ref_id,
                    "message": "Transfer successful" if tx_status == "0" else f"Transfer status: {tx_desc}",
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Transfer failed"),
                    "error_code": result.get("response_status_id"),
                    "client_ref_id": client_ref_id
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[Levin DMT] Transfer error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# STEP 9: Check Transaction Status
@router.get("/transaction/{transaction_id}")
async def get_transaction_status(transaction_id: str):
    """
    Step 9: Check transaction status
    GET /tools/reference/transaction/{tid}
    """
    try:
        # Use v1 base URL for transaction inquiry
        base_url = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
        url = f"{base_url}/tools/reference/transaction/{transaction_id}"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[Levin DMT] Check transaction: {transaction_id}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=get_headers(), params=params)
            
            logging.info(f"[Levin DMT] Transaction status response: {response.status_code}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": False,
                    "message": "Transaction not found"
                }
            
            result = response.json()
            
            if result.get("response_status_id") == 0:
                data = result.get("data", {})
                return {
                    "success": True,
                    "transaction_id": transaction_id,
                    "tx_status": data.get("tx_status"),
                    "tx_status_desc": data.get("txstatus_desc"),
                    "amount": data.get("amount"),
                    "bank_ref_num": data.get("bank_ref_num"),
                    "data": data
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to get status")
                }
                
    except Exception as e:
        logging.error(f"[Levin DMT] Transaction status error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
