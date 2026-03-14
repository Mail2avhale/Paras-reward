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
import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/eko/levin-dmt", tags=["Levin DMT"])

# ==================== CONFIGURATION ====================

EKO_BASE_URL_V3 = os.environ.get("EKO_BASE_URL_V3", "https://api.eko.in:25002/ekoicici/v3")
EKO_BASE_URL_V2 = os.environ.get("EKO_BASE_URL_V2", "https://api.eko.in:25002/ekoicici/v2")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "7c179a397b4710e71b2248d1f5892d19")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "7a2529f5-3587-4add-a2df-3d0606d62460")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "19560001")

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
    beneficiary_id: Optional[str] = None  # Not required for Levin DMT OTP
    amount: int

class TransferRequest(BaseModel):
    customer_mobile: str
    recipient_id: str
    beneficiary_id: Optional[str] = None  # May not be required
    amount: int
    otp: str
    otp_ref_id: str
    client_ref_id: Optional[str] = None
    user_id: Optional[str] = None  # For limit tracking

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
    Step 1: Check if sender exists
    GET /v3/customer/profile/{mobile}
    Without Aadhaar = ₹25,000 monthly limit
    """
    try:
        # CORRECT endpoint as per Eko docs
        url = f"{EKO_BASE_URL_V3}/customer/profile/{request.customer_mobile}"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[Levin DMT] Check sender: {request.customer_mobile}")
        logging.info(f"[Levin DMT] URL: {url}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(url, headers=get_headers(), params=params)
            
            logging.info(f"[Levin DMT] Sender check response: {response.status_code} - {response.text[:500] if response.text else 'empty'}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": True,
                    "sender_exists": False,
                    "needs_registration": True,
                    "message": "Sender not found. Please register."
                }
            
            try:
                result = response.json()
            except:
                return {
                    "success": True,
                    "sender_exists": False,
                    "needs_registration": True,
                    "message": "Sender not registered"
                }
            
            logging.info(f"[Levin DMT] Sender check result: {result}")
            
            # Check response
            data = result.get("data", {})
            response_type = result.get("response_type_id")
            response_status = result.get("response_status_id")
            
            # response_status_id = 0 or -1 with is_registered=1 means customer exists
            is_registered = data.get("is_registered") == 1
            customer_profile = data.get("customer_profile", {})
            
            if is_registered or response_status == 0 or (response_status == -1 and customer_profile):
                # Customer exists and is registered
                available_limit = data.get("next_allowed_limit") or customer_profile.get("next_allowed_limit") or 25000
                total_limit = customer_profile.get("total_monthly_limit") or 25000
                name = data.get("sender_name") or customer_profile.get("name") or "Customer"
                
                return {
                    "success": True,
                    "sender_exists": True,
                    "sender": {
                        "customer_id": request.customer_mobile,
                        "name": name,
                        "mobile": customer_profile.get("mobile", request.customer_mobile),
                        "available_limit": float(available_limit) if available_limit else 25000,
                        "used_limit": float(total_limit) - float(available_limit) if available_limit else 0,
                        "total_limit": float(total_limit) if total_limit else 25000,
                        "state": data.get("kyc_state") or customer_profile.get("kyc_state"),
                        "state_desc": "Minimum KYC Approved" if customer_profile.get("kyc_state") == 8 else "Verified"
                    },
                    "message": "Customer found! Ready for transfer."
                }
            # response_type_id = 2136 means Aadhaar Validation Pending
            elif response_type == 2136:
                return {
                    "success": True,
                    "sender_exists": True,
                    "needs_aadhaar": True,
                    "otp_ref_id": data.get("otp_ref_id"),
                    "sender": {
                        "customer_id": request.customer_mobile,
                        "state": "8",
                        "state_desc": "Aadhaar Validation Pending"
                    },
                    "message": "Aadhaar validation pending. कृपया आधार verify करा."
                }
            else:
                # Customer needs registration
                return {
                    "success": True,
                    "sender_exists": False,
                    "needs_registration": True,
                    "message": result.get("message", "Customer not registered. Please register first.")
                }
                
    except Exception as e:
        logging.error(f"[Levin DMT] Check sender error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# STEP 2: Register/Onboard Sender for DMT-Levin (service_code: 80)
@router.post("/sender/register")
async def register_sender(request: SenderRegisterRequest):
    """
    Step 2: Register new sender for DMT-Levin
    POST /v3/customer/account/{customer_id}
    Body: initiator_id, user_code, name, dob, residence_address, service_code=80
    
    IMPORTANT: service_code=80 is required for DMT-Levin!
    """
    try:
        # CORRECT endpoint: /v3/customer/account/{mobile} with service_code=80
        url = f"{EKO_BASE_URL_V3}/customer/account/{request.customer_mobile}"
        
        # residence_address as JSON string (required format)
        residence_address = json.dumps({
            "line": request.address or "India",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "district": "Mumbai",
            "area": "Mumbai"
        })
        
        # Form data with service_code for DMT-Levin
        # Try service_code=83 (Remittance Levin) or 84 (PPI Remittance Levin)
        form_data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "name": request.name,
            "dob": request.dob,
            "residence_address": residence_address,
            "service_code": "83"  # Remittance Levin service code
        }
        
        logging.info(f"[Levin DMT] Register sender: {request.customer_mobile}")
        logging.info(f"[Levin DMT] Register URL: {url}")
        logging.info(f"[Levin DMT] Register data: {form_data}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=form_data)
            
            logging.error(f"[Levin DMT] Register response: {response.status_code} - FULL: {response.text}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": False,
                    "message": "Registration service not available. Contact Eko support."
                }
            
            try:
                result = response.json()
            except Exception as json_err:
                logging.error(f"[Levin DMT] Register JSON error: {json_err}")
                return {
                    "success": False,
                    "message": f"Eko API error: {response.text[:200]}"
                }
            
            response_status = result.get("response_status_id")
            data = result.get("data", {})
            state = data.get("state")
            
            # Success or customer already exists
            if response_status == 0 or response_status == -1:
                # State 8 = Minimum KYC, ready for transfers up to ₹25,000/month
                if state == "8" or state == 8:
                    return {
                        "success": True,
                        "otp_sent": False,
                        "registered": True,
                        "message": "Customer registered for DMT-Levin! ₹25,000 monthly limit available.",
                        "data": data
                    }
                # State 1 = OTP verification pending
                elif state == "1" or state == 1:
                    return {
                        "success": True,
                        "otp_sent": True,
                        "otp_ref_id": data.get("otp_ref_id"),
                        "message": "OTP customer mobile वर पाठवला. कृपया verify करा.",
                        "data": data
                    }
                else:
                    return {
                        "success": True,
                        "otp_sent": bool(data.get("otp_ref_id")),
                        "otp_ref_id": data.get("otp_ref_id"),
                        "message": f"Registration state: {state}. Please verify if OTP sent.",
                        "data": data
                    }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Registration failed"),
                    "error_code": response_status
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[Levin DMT] Register sender error: {str(e)}")
        return {
            "success": False,
            "message": "Registration failed. Please try again."
        }


# STEP 3: Verify Sender OTP (V3 - may not work for all accounts)
@router.post("/sender/verify-otp")
async def verify_sender_otp(request: SenderOTPVerifyRequest):
    """
    Step 3: Verify sender OTP
    PUT /v3/customer/account/otp/verify
    Body: initiator_id, user_code, customer_id, otp
    """
    try:
        # CORRECT endpoint as per Eko docs
        url = f"{EKO_BASE_URL_V3}/customer/account/otp/verify"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": request.customer_mobile,
            "otp": request.otp
        }
        
        logging.info(f"[Levin DMT] Verify OTP for: {request.customer_mobile}")
        logging.info(f"[Levin DMT] URL: {url}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.put(url, headers=get_headers(), data=data)
            
            logging.info(f"[Levin DMT] OTP verify response: {response.status_code} - {response.text[:500] if response.text else 'empty'}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": False,
                    "message": "OTP verification service not available"
                }
            
            try:
                result = response.json()
            except:
                return {
                    "success": False,
                    "message": "Service error. Please try again."
                }
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "message": "Customer verified! आता तुम्ही transfer करू शकता.",
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
        return {
            "success": False,
            "message": "Verification failed. Please try again."
        }


# STEP 3-V2: Verify Sender OTP using V2 API (WORKING endpoint from handoff)
class SenderV2VerifyRequest(BaseModel):
    customer_mobile: str
    otp: str

@router.post("/sender/verify-otp-v2")
async def verify_sender_otp_v2(request: SenderV2VerifyRequest):
    """
    Verify sender OTP using V2 API - This endpoint WORKS!
    PUT /v2/customers/verification/otp:{OTP}
    """
    try:
        # V2 endpoint that was confirmed working in handoff
        url = f"{EKO_BASE_URL_V2}/customers/verification/otp:{request.otp}"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": request.customer_mobile
        }
        
        logging.info(f"[Levin DMT V2] Verify OTP for: {request.customer_mobile}")
        logging.info(f"[Levin DMT V2] URL: {url}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.put(url, headers=get_headers(), data=data)
            
            logging.error(f"[Levin DMT V2] OTP verify response: {response.status_code} - FULL: {response.text}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": False,
                    "message": "OTP verification service not available"
                }
            
            try:
                result = response.json()
            except:
                return {
                    "success": False,
                    "message": "Service error. Please try again."
                }
            
            # Check for success
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "message": "Customer verified! आता तुम्ही transfer करू शकता.",
                    "data": result.get("data", {})
                }
            # Also check if already verified (response may indicate this)
            elif "already verified" in str(result).lower():
                return {
                    "success": True,
                    "message": "Customer already verified! Ready for transfer.",
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "OTP verification failed"),
                    "error_code": result.get("response_status_id")
                }
                
    except Exception as e:
        logging.error(f"[Levin DMT V2] Verify OTP error: {str(e)}")
        return {
            "success": False,
            "message": "Verification failed. Please try again."
        }


# STEP 3-V2-OTP: Request OTP for V2 verification
@router.post("/sender/request-otp-v2")
async def request_sender_otp_v2(request: SenderCheckRequest):
    """
    Request OTP for sender verification using V2 API
    POST /v2/customers/otp
    """
    try:
        url = f"{EKO_BASE_URL_V2}/customers/otp"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": request.customer_mobile
        }
        
        logging.info(f"[Levin DMT V2] Request OTP for: {request.customer_mobile}")
        logging.info(f"[Levin DMT V2] URL: {url}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.error(f"[Levin DMT V2] Request OTP response: {response.status_code} - FULL: {response.text}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": False,
                    "message": "OTP service not available"
                }
            
            try:
                result = response.json()
            except:
                return {
                    "success": False,
                    "message": "Service error"
                }
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "otp_sent": True,
                    "message": "OTP customer mobile वर पाठवला",
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to send OTP"),
                    "error_code": result.get("response_status_id")
                }
                
    except Exception as e:
        logging.error(f"[Levin DMT V2] Request OTP error: {str(e)}")
        return {
            "success": False,
            "message": "Failed to send OTP"
        }


# STEP 3B: Generate Aadhaar OTP for Levin DMT
class AadhaarOTPRequest(BaseModel):
    customer_mobile: str
    aadhaar: str
    otp_ref_id: str  # From sender check response

@router.post("/sender/aadhaar/generate-otp")
async def generate_aadhaar_otp(request: AadhaarOTPRequest):
    """
    Generate Aadhaar OTP for sender verification
    Two possible endpoints to try:
    1. POST /v3/customer/verification/aadhaar/{customer_id} (as per Eko docs)
    2. POST /v3/customer/account/{customer_id}/dmt-levin/aadhaar (alternative)
    Content-Type: application/json
    """
    try:
        # Try the primary endpoint first
        url = f"{EKO_BASE_URL_V3}/customer/verification/aadhaar/{request.customer_mobile}"
        
        # JSON body as per documentation
        json_body = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "aadhar_no": request.aadhaar,  # Try aadhar_no instead of aadhar
            "otp_ref_id": request.otp_ref_id,
        }
        
        logging.info(f"[Levin DMT] Generate Aadhaar OTP for: {request.customer_mobile}")
        logging.info(f"[Levin DMT] Aadhaar URL: {url}")
        
        # Headers with Content-Type: application/json
        headers = get_headers()
        headers["Content-Type"] = "application/json"
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=headers, json=json_body)
            
            logging.error(f"[Levin DMT] Aadhaar OTP response (endpoint 1): {response.status_code} - FULL: {response.text}")
            
            # If first endpoint fails, try alternative endpoint
            if response.status_code != 200 or "failed" in response.text.lower() or "error" in response.text.lower():
                # Try alternative endpoint
                alt_url = f"{EKO_BASE_URL_V3}/customer/account/{request.customer_mobile}/dmt-levin/aadhaar"
                alt_body = {
                    "initiator_id": EKO_INITIATOR_ID,
                    "user_code": EKO_USER_CODE,
                    "aadhar": request.aadhaar,
                    "otp_ref_id": request.otp_ref_id,
                    "additional_info": "1"
                }
                
                logging.info(f"[Levin DMT] Trying alternative endpoint: {alt_url}")
                response = await client.post(alt_url, headers=headers, json=alt_body)
                logging.error(f"[Levin DMT] Aadhaar OTP response (endpoint 2): {response.status_code} - FULL: {response.text}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": False,
                    "message": "Aadhaar service not available. कृपया Eko support शी संपर्क साधा."
                }
            
            try:
                result = response.json()
            except:
                return {
                    "success": False,
                    "message": "Service error"
                }
            
            if result.get("response_status_id") == 0:
                data = result.get("data", {})
                return {
                    "success": True,
                    "otp_sent": True,
                    "message": "OTP sent to Aadhaar-registered mobile number",
                    "otp_ref_id": data.get("otp_ref_id") or request.otp_ref_id,
                    "intent_id": data.get("intent_id"),
                    "kyc_request_id": data.get("kyc_request_id"),
                    "data": data
                }
            else:
                error_msg = result.get("message", "Failed to send Aadhaar OTP")
                # Provide user-friendly message
                if "failed" in error_msg.lower() or result.get("response_status_id") == 2138:
                    error_msg = "आधार validation service अजून activate नाही. कृपया Eko support शी संपर्क साधा किंवा थोड्या वेळाने पुन्हा प्रयत्न करा."
                return {
                    "success": False,
                    "message": error_msg,
                    "error_code": result.get("response_status_id"),
                    "eko_message": result.get("message")
                }
                
    except Exception as e:
        logging.error(f"[Levin DMT] Aadhaar OTP error: {str(e)}")
        return {
            "success": False,
            "message": "Failed to send OTP"
        }


# STEP 3C: Validate Aadhaar OTP for Levin DMT
class AadhaarOTPVerifyRequest(BaseModel):
    customer_mobile: str
    otp: str
    otp_ref_id: str
    intent_id: str = "20"  # 19 for onboarding, 20 for aadhaar validation

@router.post("/sender/aadhaar/verify-otp")
async def verify_aadhaar_otp(request: AadhaarOTPVerifyRequest):
    """
    Verify Aadhaar OTP
    PUT /v3/customer/account/{customer_id}/dmt-levin/otp/verify
    Content-Type: application/json
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/account/{request.customer_mobile}/dmt-levin/otp/verify"
        
        # JSON body as per documentation
        json_body = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "otp": request.otp,
            "otp_ref_id": request.otp_ref_id,
            "intent_id": request.intent_id,
            "additional_info": "1"
        }
        
        logging.info(f"[Levin DMT] Verify Aadhaar OTP for: {request.customer_mobile}")
        logging.info(f"[Levin DMT] Verify URL: {url}")
        logging.info(f"[Levin DMT] Verify JSON body: {json_body}")
        
        # Headers with Content-Type: application/json
        headers = get_headers()
        headers["Content-Type"] = "application/json"
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.put(url, headers=headers, json=json_body)
            
            logging.error(f"[Levin DMT] Aadhaar verify response: {response.status_code} - FULL: {response.text}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": False,
                    "message": "Verification service not available"
                }
            
            try:
                result = response.json()
            except:
                return {
                    "success": False,
                    "message": "Service error"
                }
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "message": "Aadhaar verified successfully! Customer can now use Levin DMT.",
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Aadhaar verification failed"),
                    "error_code": result.get("response_status_id")
                }
                
    except Exception as e:
        logging.error(f"[Levin DMT] Aadhaar verify error: {str(e)}")
        return {
            "success": False,
            "message": "Verification failed"
        }


# STEP 3D: Resend OTP for Levin DMT registration
class ResendOTPRequest(BaseModel):
    customer_mobile: str

@router.post("/sender/resend-otp")
async def resend_sender_otp(request: ResendOTPRequest):
    """
    Resend OTP for Levin DMT sender registration
    POST /v3/customer/payment/dmt-levin/sender/{customer_id}/otp
    """
    try:
        # Levin DMT resend OTP
        url = f"{EKO_BASE_URL_V3}/customer/payment/dmt-levin/sender/{request.customer_mobile}/otp"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[Levin DMT] Resend OTP for: {request.customer_mobile}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.error(f"[Levin DMT] Resend OTP response: {response.status_code} - FULL: {response.text}")
            
            if response.status_code != 200 or not response.text or "error" in response.text.lower():
                # Fallback
                fallback_url = f"{EKO_BASE_URL_V3}/customer/account/otp/resend"
                data["customer_id"] = request.customer_mobile
                response = await client.post(fallback_url, headers=get_headers(), data=data)
                logging.error(f"[Levin DMT] Fallback resend OTP: {response.status_code} - {response.text}")
            
            if response.status_code == 204 or not response.text:
                return {
                    "success": False,
                    "message": "OTP service not available"
                }
            
            try:
                result = response.json()
            except:
                return {
                    "success": False,
                    "message": "Service error"
                }
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "otp_sent": True,
                    "message": "OTP sent to customer mobile",
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to send OTP"),
                    "error_code": result.get("response_status_id")
                }
                
    except Exception as e:
        logging.error(f"[Levin DMT] Resend OTP error: {str(e)}")
        return {
            "success": False,
            "message": "Failed to send OTP"
        }


# STEP 4: Get Recipients List
@router.get("/recipients/{customer_mobile}")
async def get_recipients(customer_mobile: str):
    """
    Step 4: Get list of recipients for a sender
    GET /v3/customer/payment/dmt-levin/sender/{mobile}/recipients
    """
    try:
        # DMT-Levin endpoint for recipients
        url = f"{EKO_BASE_URL_V3}/customer/payment/dmt-levin/sender/{customer_mobile}/recipients"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[Levin DMT] Get recipients for: {customer_mobile}")
        logging.info(f"[Levin DMT] URL: {url}")
        
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
                logging.error(f"[Levin DMT] JSON parse error: {json_err}")
                return {
                    "success": False,
                    "recipients": [],
                    "message": f"API error"
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
    POST /v3/customer/payment/dmt-levin/sender/{mobile}/recipient
    """
    try:
        # DMT-Levin endpoint for adding recipient
        url = f"{EKO_BASE_URL_V3}/customer/payment/dmt-levin/sender/{request.customer_mobile}/recipient"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "recipient_name": request.recipient_name,
            "recipient_mobile": request.recipient_mobile,
            "account": request.account_number,
            "ifsc": request.ifsc_code,
            "recipient_type": "3"  # Bank account
        }
        
        logging.info(f"[Levin DMT] Add recipient for: {request.customer_mobile}")
        logging.info(f"[Levin DMT] URL: {url}")
        
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
    Step 6: Register recipient with bank
    POST /v3/customer/payment/dmt-levin/sender/{mobile}/bank/recipient
    """
    try:
        # DMT-Levin endpoint for activating recipient
        url = f"{EKO_BASE_URL_V3}/customer/payment/dmt-levin/sender/{request.customer_mobile}/bank/recipient"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "recipient_id": request.recipient_id
        }
        
        logging.info(f"[Levin DMT] Activate recipient: {request.recipient_id}")
        logging.info(f"[Levin DMT] URL: {url}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.info(f"[Levin DMT] Activate response: {response.status_code} - {response.text[:300] if response.text else 'empty'}")
            
            # Handle empty response
            if response.status_code == 204 or not response.text.strip():
                return {
                    "success": False,
                    "message": "Activation service temporarily unavailable. Recipient added but not activated."
                }
            
            try:
                result = response.json()
            except:
                return {
                    "success": False,
                    "message": "Service temporarily unavailable"
                }
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "message": "Recipient activated! Beneficiary ID generated.",
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
        return {
            "success": False,
            "message": "Activation failed. Please try again."
        }


# STEP 6B: Delete Recipient
class RecipientDeleteRequest(BaseModel):
    customer_mobile: str
    recipient_id: str

@router.delete("/recipient/delete")
async def delete_recipient(request: RecipientDeleteRequest):
    """
    Delete a recipient/beneficiary
    DELETE /v3/customer/payment/dmt-levin/sender/{mobile}/recipient/{recipient_id}
    """
    try:
        url = f"{EKO_BASE_URL_V3}/customer/payment/dmt-levin/sender/{request.customer_mobile}/recipient/{request.recipient_id}"
        
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[Levin DMT] Delete recipient: {request.recipient_id} for {request.customer_mobile}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.delete(url, headers=get_headers(), params=params)
            
            logging.info(f"[Levin DMT] Delete recipient response: {response.status_code} - {response.text[:200] if response.text else 'empty'}")
            
            # Handle empty response (success for DELETE)
            if response.status_code in [200, 204] or not response.text.strip():
                return {
                    "success": True,
                    "message": "Recipient deleted successfully"
                }
            
            try:
                result = response.json()
            except:
                # JSON parse error - treat as success if status code is OK
                if response.status_code < 400:
                    return {
                        "success": True,
                        "message": "Recipient deleted successfully"
                    }
                return {
                    "success": False,
                    "message": "Service temporarily unavailable"
                }
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "message": "Recipient deleted successfully"
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to delete recipient"),
                    "error_code": result.get("response_status_id")
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[Levin DMT] Delete recipient error: {str(e)}")
        return {
            "success": False,
            "message": "Failed to delete recipient. Please try again."
        }


# STEP 7: Send Transaction OTP
@router.post("/transfer/send-otp")
async def send_transaction_otp(request: TransactionOTPRequest):
    """
    Step 7: Send OTP for transaction
    POST /v3/customer/payment/dmt-levin/otp
    """
    try:
        # DMT-Levin endpoint for OTP
        url = f"{EKO_BASE_URL_V3}/customer/payment/dmt-levin/otp"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": request.customer_mobile,
            "recipient_id": request.recipient_id,
            "amount": str(request.amount)
        }
        
        logging.info(f"[Levin DMT] Send transaction OTP: {request.customer_mobile}, amount={request.amount}")
        logging.info(f"[Levin DMT] URL: {url}")
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.info(f"[Levin DMT] OTP send response: {response.status_code} - {response.text[:500] if response.text else 'empty'}")
            
            if response.status_code == 204 or not response.text:
                raise HTTPException(status_code=500, detail="Service not activated")
            
            result = response.json()
            
            if result.get("response_status_id") == 0:
                return {
                    "success": True,
                    "otp_sent": True,
                    "message": "OTP customer mobile वर पाठवला",
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
    POST /v3/customer/payment/dmt-levin
    """
    try:
        # Import check_dmt_limits from server
        from server import check_dmt_limits, check_service_enabled, db, check_redeem_limit
        
        # Check if DMT service is enabled
        dmt_enabled = await check_service_enabled("dmt")
        if not dmt_enabled:
            return {
                "success": False,
                "message": "DMT service is currently disabled by admin",
                "error_code": "SERVICE_DISABLED"
            }
        
        # Check Global Redeem Limit (799*5*10 + 20% referral)
        if request.user_id:
            try:
                redeem_check = await check_redeem_limit(request.user_id, request.amount)
                if not redeem_check.get("allowed"):
                    limit_info = redeem_check.get("limit_info", {})
                    return {
                        "success": False,
                        "message": f"Redeem limit exceeded. Remaining: ₹{limit_info.get('remaining_limit', 0):,.2f}",
                        "error_code": "REDEEM_LIMIT_EXCEEDED",
                        "limit_info": limit_info
                    }
            except Exception as e:
                logging.error(f"Redeem limit check error: {e}")
        
        # Check DMT limits if user_id is provided
        if request.user_id:
            limit_check = await check_dmt_limits(request.user_id, request.amount)
            if not limit_check.get("allowed"):
                return {
                    "success": False,
                    "message": limit_check.get("reason", "Transfer limit exceeded"),
                    "error_code": "LIMIT_EXCEEDED",
                    "usage": limit_check.get("usage")
                }
        
        # DMT-Levin endpoint for transfer
        url = f"{EKO_BASE_URL_V3}/customer/payment/dmt-levin"
        
        # Generate unique client_ref_id if not provided
        client_ref_id = request.client_ref_id or f"LEVIN{uuid.uuid4().hex[:12].upper()}"
        
        data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "customer_id": request.customer_mobile,
            "recipient_id": request.recipient_id,
            "amount": str(request.amount),
            "currency": "INR",
            "channel": "2",  # IMPS
            "state": "1",  # Required field for transfer
            "pipe": "14",  # DMT-Levin pipe
            "client_ref_id": client_ref_id,
            "otp": request.otp,
            "otp_ref_id": request.otp_ref_id
        }
        
        logging.info(f"[Levin DMT] Transfer: customer={request.customer_mobile}, amount={request.amount}, ref={client_ref_id}")
        logging.info(f"[Levin DMT] Transfer data: {data}")
        
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            response = await client.post(url, headers=get_headers(), data=data)
            
            logging.error(f"[Levin DMT] Transfer response: {response.status_code} - FULL: {response.text}")
            
            if response.status_code == 204 or not response.text:
                raise HTTPException(status_code=500, detail="Service not activated. Contact Eko support.")
            
            result = response.json()
            
            # Check transaction status
            tx_status = result.get("data", {}).get("tx_status")
            tx_desc = result.get("data", {}).get("txstatus_desc", "")
            
            if result.get("response_status_id") == 0:
                # Save transaction record for limit tracking
                if request.user_id:
                    tx_record = {
                        "txn_id": str(uuid.uuid4()),
                        "user_id": request.user_id,
                        "customer_mobile": request.customer_mobile,
                        "recipient_id": request.recipient_id,
                        "amount": request.amount,
                        "eko_tid": result.get("data", {}).get("tid"),
                        "bank_ref_num": result.get("data", {}).get("bank_ref_num"),
                        "client_ref_id": client_ref_id,
                        "tx_status": tx_status,
                        "tx_status_desc": tx_desc,
                        "status": "success" if tx_status == "0" else "pending",
                        "service_type": "levin_dmt",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.dmt_transactions.insert_one(tx_record)
                
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
                # Save failed transaction too
                if request.user_id:
                    tx_record = {
                        "txn_id": str(uuid.uuid4()),
                        "user_id": request.user_id,
                        "customer_mobile": request.customer_mobile,
                        "recipient_id": request.recipient_id,
                        "amount": request.amount,
                        "client_ref_id": client_ref_id,
                        "status": "failed",
                        "error_message": result.get("message", "Transfer failed"),
                        "service_type": "levin_dmt",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.dmt_transactions.insert_one(tx_record)
                
                # Parse error message for user-friendly display
                error_msg = result.get("message", "Transfer failed")
                error_code = result.get("response_status_id")
                
                # Map common Eko error codes to user-friendly messages
                user_messages = {
                    1: "Invalid request. Please check beneficiary details.",
                    2: "Transaction limit exceeded for today.",
                    3: "Insufficient balance in Eko wallet.",
                    5: "Beneficiary bank is temporarily unavailable.",
                    6: "Invalid OTP. Please request a new OTP.",
                    43: "Transaction declined by bank. Please try later.",
                    45: "Service temporarily unavailable.",
                    51: "Insufficient balance in merchant wallet.",
                    150: "Transfer limit exceeded. Try smaller amount.",
                    302: "Account not verified. Please verify beneficiary."
                }
                
                friendly_msg = user_messages.get(error_code, error_msg)
                
                return {
                    "success": False,
                    "message": friendly_msg,
                    "error_code": error_code,
                    "eko_message": error_msg,
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
