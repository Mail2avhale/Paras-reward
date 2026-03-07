"""
Eko Aadhaar DMT v3 APIs
=======================
Higher limit DMT using Aadhaar eKYC verification.

Limits:
- DMT v1 (Mobile OTP): ₹25,000/month
- DMT v3 (Aadhaar): ₹2,00,000/month

Flow:
1. User enters Aadhaar number
2. OTP sent to Aadhaar-linked mobile
3. User verifies OTP
4. KYC data fetched (name, DOB, address)
5. User can now do higher limit transfers
"""

import os
import logging
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from .eko_common import (
    get_eko_headers, 
    EKO_BASE_URL, 
    EKO_INITIATOR_ID, 
    EKO_USER_CODE,
    EKO_DEVELOPER_KEY
)

# MongoDB connection
from motor.motor_asyncio import AsyncIOMotorClient
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "paras_reward")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

router = APIRouter(prefix="/aadhaar-dmt", tags=["Aadhaar DMT"])

# ==================== REQUEST MODELS ====================

class AadhaarOtpRequest(BaseModel):
    uid: str
    mobile: str
    aadhaar_number: str
    consent: bool = True  # User consent for Aadhaar verification

class AadhaarVerifyRequest(BaseModel):
    uid: str
    mobile: str
    aadhaar_number: str
    otp: str
    otp_ref_id: Optional[str] = None

class AadhaarStatusRequest(BaseModel):
    uid: str
    mobile: str


# ==================== HELPER FUNCTIONS ====================

def validate_aadhaar(aadhaar: str) -> str:
    """Validate and clean Aadhaar number"""
    clean = ''.join(c for c in aadhaar if c.isdigit())
    if len(clean) != 12:
        raise ValueError("Aadhaar number must be 12 digits")
    return clean

def mask_aadhaar(aadhaar: str) -> str:
    """Mask Aadhaar for display: XXXX XXXX 1234"""
    clean = validate_aadhaar(aadhaar)
    return f"XXXX XXXX {clean[-4:]}"


# ==================== API ENDPOINTS ====================

@router.post("/send-otp")
async def send_aadhaar_otp(request: AadhaarOtpRequest):
    """
    Step 1: Send OTP to Aadhaar-linked mobile number.
    
    This initiates Aadhaar eKYC process. OTP will be sent to the
    mobile number registered with UIDAI (Aadhaar authority).
    
    Note: User must have given consent for Aadhaar verification.
    """
    try:
        # Validate consent
        if not request.consent:
            return {
                "success": False,
                "message": "User consent required for Aadhaar verification",
                "error_type": "CONSENT_REQUIRED"
            }
        
        # Validate Aadhaar
        try:
            aadhaar = validate_aadhaar(request.aadhaar_number)
        except ValueError as e:
            return {
                "success": False,
                "message": str(e),
                "error_type": "INVALID_AADHAAR"
            }
        
        # Clean mobile
        mobile = ''.join(c for c in request.mobile if c.isdigit())[-10:]
        if len(mobile) != 10:
            return {
                "success": False,
                "message": "Invalid mobile number",
                "error_type": "INVALID_MOBILE"
            }
        
        logging.info(f"[AADHAAR-OTP] Sending OTP for {mask_aadhaar(aadhaar)}, user: {request.uid}")
        
        # Get Eko headers
        headers = get_eko_headers()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        
        # Eko API for Aadhaar OTP (DMT v3)
        # Using fino-dmt-customer-kyc endpoint
        otp_url = f"{EKO_BASE_URL}/v3/dmt/customers/mobile_number:{mobile}/aadhaar"
        
        otp_data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "aadhaar_number": aadhaar,
            "latlong": "28.6139,77.2090",  # Default Delhi coordinates
            "pipe": "9"
        }
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.put(
                otp_url,
                headers=headers,
                data=otp_data
            )
            
            result = response.json()
            logging.info(f"[AADHAAR-OTP] Response: {result}")
            
            response_code = result.get("response_status_id", -1)
            message = result.get("message", "")
            
            # Success responses
            if response_code == 0 or "otp" in message.lower() or "sent" in message.lower():
                otp_ref_id = result.get("data", {}).get("otp_ref_id", "")
                
                # Save OTP request to DB
                await db.aadhaar_verifications.update_one(
                    {"uid": request.uid, "mobile": mobile},
                    {"$set": {
                        "uid": request.uid,
                        "mobile": mobile,
                        "aadhaar_masked": mask_aadhaar(aadhaar),
                        "otp_ref_id": otp_ref_id,
                        "otp_sent_at": datetime.now(timezone.utc).isoformat(),
                        "status": "otp_sent",
                        "verified": False
                    }},
                    upsert=True
                )
                
                return {
                    "success": True,
                    "otp_sent": True,
                    "message": "OTP sent to Aadhaar-linked mobile number",
                    "otp_ref_id": otp_ref_id,
                    "aadhaar_masked": mask_aadhaar(aadhaar),
                    "next_step": "verify_otp"
                }
            
            # Already verified
            elif response_code == 464 or "already" in message.lower():
                return {
                    "success": True,
                    "already_verified": True,
                    "message": "Aadhaar already verified for this customer",
                    "next_step": "proceed_to_transfer"
                }
            
            # Error
            else:
                return {
                    "success": False,
                    "message": message or "Failed to send OTP",
                    "error_type": "OTP_SEND_FAILED",
                    "eko_response": result
                }
                
    except Exception as e:
        logging.error(f"[AADHAAR-OTP] Error: {e}")
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "error_type": "SYSTEM_ERROR"
        }


@router.post("/verify-otp")
async def verify_aadhaar_otp(request: AadhaarVerifyRequest):
    """
    Step 2: Verify OTP and complete Aadhaar eKYC.
    
    On successful verification:
    - Customer becomes eligible for higher DMT limits (₹2,00,000/month)
    - KYC data (name, DOB, address) is fetched from UIDAI
    - Customer can now do Aadhaar-verified transfers
    """
    try:
        # Validate Aadhaar
        try:
            aadhaar = validate_aadhaar(request.aadhaar_number)
        except ValueError as e:
            return {
                "success": False,
                "message": str(e),
                "error_type": "INVALID_AADHAAR"
            }
        
        # Validate OTP
        otp = request.otp.strip()
        if not otp or len(otp) < 4 or len(otp) > 6:
            return {
                "success": False,
                "message": "Invalid OTP format (4-6 digits required)",
                "error_type": "INVALID_OTP_FORMAT"
            }
        
        mobile = ''.join(c for c in request.mobile if c.isdigit())[-10:]
        
        logging.info(f"[AADHAAR-VERIFY] Verifying OTP for {mask_aadhaar(aadhaar)}, user: {request.uid}")
        
        # Get stored OTP ref
        stored = await db.aadhaar_verifications.find_one({
            "uid": request.uid,
            "mobile": mobile
        })
        
        otp_ref_id = request.otp_ref_id or (stored.get("otp_ref_id") if stored else "")
        
        # Get Eko headers
        headers = get_eko_headers()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        
        # Eko API for Aadhaar OTP verification
        verify_url = f"{EKO_BASE_URL}/v3/dmt/customers/mobile_number:{mobile}/aadhaar/verify"
        
        verify_data = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "aadhaar_number": aadhaar,
            "otp": otp,
            "otp_ref_id": otp_ref_id,
            "latlong": "28.6139,77.2090"
        }
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                verify_url,
                headers=headers,
                data=verify_data
            )
            
            result = response.json()
            logging.info(f"[AADHAAR-VERIFY] Response: {result}")
            
            response_code = result.get("response_status_id", -1)
            message = result.get("message", "")
            data = result.get("data", {})
            
            # Success
            if response_code == 0 or "success" in message.lower() or "verified" in message.lower():
                # Extract KYC data
                kyc_data = {
                    "name": data.get("name", ""),
                    "dob": data.get("dob", ""),
                    "gender": data.get("gender", ""),
                    "address": data.get("address", ""),
                    "state": data.get("state", ""),
                    "district": data.get("district", ""),
                    "pincode": data.get("pincode", ""),
                    "photo": data.get("photo", "")[:100] + "..." if data.get("photo") else ""  # Truncate photo
                }
                
                customer_id = data.get("customer_id", "")
                
                # Update DB
                await db.aadhaar_verifications.update_one(
                    {"uid": request.uid, "mobile": mobile},
                    {"$set": {
                        "verified": True,
                        "verified_at": datetime.now(timezone.utc).isoformat(),
                        "status": "verified",
                        "customer_id": customer_id,
                        "kyc_name": kyc_data["name"],
                        "kyc_dob": kyc_data["dob"],
                        "kyc_address": kyc_data["address"],
                        "dmt_limit": 200000  # ₹2,00,000 limit
                    }}
                )
                
                # Also update user's eko_customer record
                await db.users.update_one(
                    {"uid": request.uid},
                    {"$set": {
                        "eko_aadhaar_verified": True,
                        "eko_aadhaar_verified_at": datetime.now(timezone.utc).isoformat(),
                        "eko_customer_id": customer_id,
                        "eko_dmt_limit": 200000
                    }}
                )
                
                return {
                    "success": True,
                    "verified": True,
                    "message": "Aadhaar verification successful! You can now transfer up to ₹2,00,000/month.",
                    "customer_id": customer_id,
                    "kyc_name": kyc_data["name"],
                    "dmt_limit": "₹2,00,000/month",
                    "next_step": "enter_bank_details"
                }
            
            # Invalid OTP
            elif response_code == 330 or "invalid" in message.lower() or "wrong" in message.lower():
                return {
                    "success": False,
                    "verified": False,
                    "message": "Invalid OTP. Please check and try again.",
                    "error_type": "INVALID_OTP"
                }
            
            # OTP Expired
            elif "expired" in message.lower():
                return {
                    "success": False,
                    "verified": False,
                    "message": "OTP expired. Please request a new OTP.",
                    "error_type": "OTP_EXPIRED"
                }
            
            # Other errors
            else:
                return {
                    "success": False,
                    "message": message or "Verification failed",
                    "error_type": "VERIFICATION_FAILED",
                    "eko_response": result
                }
                
    except Exception as e:
        logging.error(f"[AADHAAR-VERIFY] Error: {e}")
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "error_type": "SYSTEM_ERROR"
        }


@router.post("/resend-otp")
async def resend_aadhaar_otp(request: AadhaarOtpRequest):
    """Resend Aadhaar OTP - same as send-otp"""
    return await send_aadhaar_otp(request)


@router.get("/status/{uid}")
async def get_aadhaar_status(uid: str):
    """
    Check if user has completed Aadhaar verification.
    
    Returns verification status and DMT limit.
    """
    try:
        # Check user record
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "eko_aadhaar_verified": 1, "eko_dmt_limit": 1})
        
        if user and user.get("eko_aadhaar_verified"):
            return {
                "success": True,
                "aadhaar_verified": True,
                "dmt_limit": user.get("eko_dmt_limit", 200000),
                "dmt_limit_display": "₹2,00,000/month",
                "message": "Aadhaar verification complete"
            }
        
        # Check verification record
        verification = await db.aadhaar_verifications.find_one(
            {"uid": uid},
            {"_id": 0, "verified": 1, "status": 1, "kyc_name": 1}
        )
        
        if verification and verification.get("verified"):
            return {
                "success": True,
                "aadhaar_verified": True,
                "dmt_limit": 200000,
                "dmt_limit_display": "₹2,00,000/month",
                "kyc_name": verification.get("kyc_name", ""),
                "message": "Aadhaar verification complete"
            }
        
        return {
            "success": True,
            "aadhaar_verified": False,
            "dmt_limit": 25000,
            "dmt_limit_display": "₹25,000/month",
            "message": "Aadhaar not verified. Verify to increase limit to ₹2,00,000/month"
        }
        
    except Exception as e:
        logging.error(f"[AADHAAR-STATUS] Error: {e}")
        return {
            "success": False,
            "aadhaar_verified": False,
            "message": str(e)
        }


@router.get("/limits-info")
async def get_dmt_limits_info():
    """
    Get DMT limit information for user education.
    """
    return {
        "success": True,
        "limits": {
            "mobile_otp": {
                "limit": 25000,
                "display": "₹25,000/month",
                "verification": "Mobile OTP",
                "description": "Basic verification with mobile OTP"
            },
            "aadhaar_otp": {
                "limit": 200000,
                "display": "₹2,00,000/month",
                "verification": "Aadhaar OTP",
                "description": "Higher limit with Aadhaar eKYC verification"
            }
        },
        "message": "Verify Aadhaar to unlock 8x higher transfer limits!"
    }
