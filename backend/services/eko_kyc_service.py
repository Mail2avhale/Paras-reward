"""
Eko KYC Verification Service
- PAN Lite: Instant PAN verification (no OTP)
- Aadhaar OTP: 2-step Aadhaar verification
"""
import os
import hashlib
import hmac
import time
import logging
import httpx
import base64
import random
from datetime import datetime, timezone
from typing import Optional, Dict

# Eko API Configuration
# Production: https://api.eko.in:25002/ekoicici | Staging: https://staging.eko.in:25004/ekoapi
# KYC API path: /v3/tools/kyc/ for PAN, /v1/aadhaar/ for Aadhaar
# Using production URL on port 25002 (confirmed working)
EKO_KYC_BASE = os.environ.get("EKO_KYC_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_KYC_URL = f"{EKO_KYC_BASE}/v3"
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "")


def generate_secret_key() -> tuple:
    """
    Generate secret key and timestamp for Eko API authentication (for PAN/BBPS APIs)
    Based on Eko documentation: https://developers.eko.in/docs/auth
    
    Steps:
    1. Base64 encode the authenticator/access key
    2. Use the encoded key (as bytes) to create HMAC-SHA256 of timestamp
    3. Base64 encode the resulting signature
    """
    # Step 1: Get timestamp in milliseconds
    timestamp = str(int(round(time.time() * 1000)))
    
    # Step 2: Base64 encode the authenticator key
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode('utf-8'))
    
    # Step 3: Create HMAC-SHA256 signature using encoded_key as the key
    signature = hmac.new(
        encoded_key,  # Use base64-encoded key as HMAC key (as bytes)
        timestamp.encode('utf-8'),  # Message is the timestamp
        hashlib.sha256
    ).digest()
    
    # Step 4: Base64 encode the signature
    secret_key = base64.b64encode(signature).decode('utf-8')
    
    logging.debug(f"[EKO-AUTH] Generated secret_key for timestamp: {timestamp}")
    
    return secret_key, timestamp


def generate_aadhaar_auth_headers() -> dict:
    """
    Generate authentication headers for Aadhaar API
    Based on user-provided Eko API code
    
    Secret Key = SHA256(developer_key + initiator_id + timestamp + authenticator_key)
    """
    timestamp = str(int(time.time()))
    
    # Concatenate all credentials and hash with SHA256
    message = EKO_DEVELOPER_KEY + EKO_INITIATOR_ID + timestamp + EKO_AUTHENTICATOR_KEY
    secret_key = hashlib.sha256(message.encode()).hexdigest()
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/json"
    }
    
    return headers


def get_auth_headers() -> Dict[str, str]:
    """Get authentication headers for Eko API"""
    secret_key, timestamp = generate_secret_key()
    
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/json"
    }


async def verify_pan_lite(pan_number: str, name: str, dob: str, client_ref_id: Optional[str] = None) -> Dict:
    """
    Verify PAN using Eko PAN Lite API
    
    Args:
        pan_number: 10-character PAN (e.g., ABCDE1234F)
        name: Name as per PAN
        dob: Date of birth (YYYY-MM-DD format)
        client_ref_id: Optional unique reference ID
    
    Returns:
        {
            "success": True/False,
            "verified": True/False,
            "pan_valid": True/False,
            "name_match": True/False,
            "dob_match": True/False,
            "pan_status": "E/N/X/F/D/etc",
            "aadhaar_linked": True/False,
            "message": "...",
            "raw_response": {...}
        }
    """
    if not EKO_DEVELOPER_KEY or not EKO_AUTHENTICATOR_KEY:
        logging.error("[EKO-PAN] Missing API credentials")
        return {"success": False, "message": "KYC service not configured. Please contact support.", "verified": False}
    
    # Validate PAN format
    import re
    pan_pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
    if not re.match(pan_pattern, pan_number.upper()):
        return {"success": False, "message": "Invalid PAN format. Must be like ABCDE1234F", "verified": False}
    
    # Generate reference ID if not provided
    if not client_ref_id:
        client_ref_id = f"PAN{int(time.time() * 1000)}"
    
    url = f"{EKO_KYC_URL}/tools/kyc/touras/pan-verification"
    
    # Request body as JSON - simplified for touras endpoint
    payload = {
        "initiator_id": EKO_INITIATOR_ID,
        "user_code": EKO_USER_CODE,
        "pan_number": pan_number.upper()
    }
    
    headers = get_auth_headers()
    
    logging.info(f"[EKO-PAN] Calling {url} with PAN: {pan_number[:5]}*****")
    
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            logging.info(f"[EKO-PAN] Response status: {response.status_code}")
            logging.info(f"[EKO-PAN] Response text: {response.text[:500] if response.text else 'EMPTY'}")
            
            # Handle empty response
            if not response.text or not response.text.strip():
                logging.error(f"[EKO-PAN] Empty response from Eko API")
                return {
                    "success": False,
                    "verified": False,
                    "message": "KYC service temporarily unavailable. Please try again later."
                }
            
            # Try to parse JSON
            try:
                data = response.json()
            except Exception as json_err:
                logging.error(f"[EKO-PAN] JSON parse error: {json_err}, Response: {response.text[:200]}")
                return {
                    "success": False,
                    "verified": False,
                    "message": "KYC service returned invalid response. Please try again."
                }
            
            if response.status_code == 200:
                # Check if API returned success (status=0 means success)
                if data.get("status") != 0:
                    error_msg = data.get("data", {}).get("message", "PAN verification failed")
                    return {
                        "success": False,
                        "verified": False,
                        "message": error_msg,
                        "raw_response": data
                    }
                
                pan_data = data.get("data", {})
                
                # For touras endpoint, response has: fullname, status, category, pan_no
                pan_status = pan_data.get("status", "INVALID")
                fullname = pan_data.get("fullname", "")
                category = pan_data.get("category", "")
                
                # PAN is valid if status is "success", "VALID", or similar success indicators
                pan_valid = pan_status.lower() in ["success", "valid", "e", "existing and valid"]
                
                # Verification successful if PAN is valid
                verified = pan_valid
                
                message = "PAN verified successfully" if verified else f"PAN verification failed: {pan_status}"
                
                return {
                    "success": True,
                    "verified": verified,
                    "pan_valid": pan_valid,
                    "pan_holder_name": fullname,
                    "pan_category": category,
                    "pan_status": pan_status,
                    "pan_status_desc": pan_status,
                    "name_match": False,  # Not available in touras endpoint
                    "dob_match": False,   # Not available in touras endpoint  
                    "aadhaar_linked": False,  # Not available in touras endpoint
                    "message": message,
                    "raw_response": data
                }
            elif response.status_code == 400:
                error_data = response.json() if response.content else {}
                return {
                    "success": False,
                    "verified": False,
                    "message": error_data.get("message", "Invalid PAN details provided"),
                    "raw_response": error_data
                }
            elif response.status_code == 401:
                return {
                    "success": False,
                    "verified": False,
                    "message": "KYC service authentication failed. Please contact support."
                }
            else:
                error_data = response.json() if response.content else {}
                return {
                    "success": False,
                    "verified": False,
                    "message": f"Verification service error. Please try again.",
                    "raw_response": error_data
                }
                
    except httpx.TimeoutException:
        return {"success": False, "verified": False, "message": "Service is busy. Please try again in a few seconds."}
    except Exception as e:
        logging.error(f"[EKO-PAN] Error: {e}")
        return {"success": False, "verified": False, "message": "Verification failed. Please try again."}


def get_pan_status_description(status: str) -> str:
    """Get human-readable PAN status description"""
    descriptions = {
        "E": "Valid PAN",
        "EC": "Valid (Acquisition)",
        "N": "PAN does not exist",
        "X": "PAN deactivated",
        "F": "Fake PAN",
        "D": "PAN deleted",
        "EA": "Valid (Amalgamation)",
        "ED": "Valid (Death recorded)",
        "EI": "Valid (Dissolution)",
        "EL": "Valid (Liquidated)",
        "EM": "Valid (Merger)",
        "EP": "Valid (Partition)",
        "ES": "Valid (Split)",
        "EU": "Valid (Under Liquidation)"
    }
    return descriptions.get(status, f"Unknown status: {status}")


# ==================== AADHAAR OTP VERIFICATION ====================

async def send_aadhaar_otp(aadhaar_number: str, client_ref_id: Optional[str] = None) -> Dict:
    """
    Step 1: Send OTP to Aadhaar-linked mobile number
    
    Endpoint: POST /v1/aadhaar/otp
    
    Args:
        aadhaar_number: 12-digit Aadhaar number
        client_ref_id: Optional unique reference ID
    
    Returns:
        {
            "success": True/False,
            "otp_sent": True/False,
            "message": "..."
        }
    """
    if not EKO_DEVELOPER_KEY or not EKO_AUTHENTICATOR_KEY:
        logging.error("[EKO-AADHAAR] Missing API credentials")
        return {"success": False, "otp_sent": False, "message": "KYC service not configured. Please contact support."}
    
    # Validate Aadhaar format (12 digits)
    aadhaar_clean = aadhaar_number.replace(" ", "").replace("-", "")
    if not aadhaar_clean.isdigit() or len(aadhaar_clean) != 12:
        return {"success": False, "otp_sent": False, "message": "Invalid Aadhaar. Must be 12 digits."}
    
    if not client_ref_id:
        client_ref_id = f"AADHAR{int(time.time() * 1000)}"
    
    # Aadhaar OTP endpoint - POST request
    url = f"{EKO_KYC_BASE}/v1/aadhaar/otp"
    
    payload = {
        "aadhaar": aadhaar_clean,
        "initiator_id": EKO_INITIATOR_ID
    }
    
    headers = generate_aadhaar_auth_headers()
    
    logging.info(f"[EKO-AADHAAR-OTP] Sending OTP for: XXXX-XXXX-{aadhaar_clean[-4:]}")
    logging.info(f"[EKO-AADHAAR-OTP] URL: {url}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            logging.info(f"[EKO-AADHAAR-OTP] Response status: {response.status_code}")
            logging.info(f"[EKO-AADHAAR-OTP] Response: {response.text[:500]}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") == 0:
                    return {
                        "success": True,
                        "otp_sent": True,
                        "message": "OTP sent to your Aadhaar-linked mobile number",
                        "client_ref_id": client_ref_id,
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "otp_sent": False,
                        "message": data.get("message", "Failed to send OTP. Please check your Aadhaar number."),
                        "raw_response": data
                    }
            else:
                error_data = {}
                try:
                    error_data = response.json()
                except:
                    pass
                return {
                    "success": False,
                    "otp_sent": False,
                    "message": error_data.get("message", "Failed to send OTP. Please try again."),
                    "raw_response": error_data
                }
                
    except httpx.TimeoutException:
        return {"success": False, "otp_sent": False, "message": "Service is busy. Please try again in a few seconds."}
    except Exception as e:
        logging.error(f"[EKO-AADHAAR-OTP] Error: {e}")
        return {"success": False, "otp_sent": False, "message": "Failed to send OTP. Please try again."}


async def verify_aadhaar_otp(aadhaar_number: str, otp: str, access_key: str = None) -> Dict:
    """
    Step 2: Verify OTP and get Aadhaar details
    
    Endpoint: POST /v1/aadhaar/verify
    
    Args:
        aadhaar_number: 12-digit Aadhaar number
        otp: 6-digit OTP received on mobile
        access_key: Not needed for this endpoint (kept for compatibility)
    
    Returns:
        {
            "success": True/False,
            "verified": True/False,
            "aadhaar_data": {name, dob, gender, address, etc.},
            "message": "..."
        }
    """
    if not EKO_DEVELOPER_KEY or not EKO_AUTHENTICATOR_KEY:
        logging.error("[EKO-AADHAAR-VERIFY] Missing API credentials")
        return {"success": False, "verified": False, "message": "KYC service not configured. Please contact support."}
    
    aadhaar_clean = aadhaar_number.replace(" ", "").replace("-", "")
    
    # Validate OTP format
    if not otp.isdigit() or len(otp) != 6:
        return {"success": False, "verified": False, "message": "Invalid OTP. Must be 6 digits."}
    
    # Aadhaar Verify endpoint - POST request
    url = f"{EKO_KYC_BASE}/v1/aadhaar/verify"
    
    payload = {
        "aadhaar": aadhaar_clean,
        "otp": otp,
        "initiator_id": EKO_INITIATOR_ID
    }
    
    headers = generate_aadhaar_auth_headers()
    
    logging.info(f"[EKO-AADHAAR-VERIFY] Verifying OTP for: XXXX-XXXX-{aadhaar_clean[-4:]}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            logging.info(f"[EKO-AADHAAR-VERIFY] Response status: {response.status_code}")
            logging.info(f"[EKO-AADHAAR-VERIFY] Response: {response.text[:500]}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") == 0:
                    aadhaar_data = data.get("data", {})
                    
                    return {
                        "success": True,
                        "verified": True,
                        "message": "Aadhaar verified successfully",
                        "aadhaar_data": {
                            "name": aadhaar_data.get("name"),
                            "dob": aadhaar_data.get("dob"),
                            "gender": aadhaar_data.get("gender"),
                            "address": aadhaar_data.get("address"),
                            "district": aadhaar_data.get("district"),
                            "state": aadhaar_data.get("state"),
                            "pincode": aadhaar_data.get("pincode"),
                            "photo_base64": aadhaar_data.get("photo"),
                            "masked_aadhaar": f"XXXX-XXXX-{aadhaar_clean[-4:]}"
                        },
                        "raw_response": data
                    }
                else:
                    msg = data.get("message", "OTP verification failed. Please try again.")
                    if "expired" in msg.lower():
                        msg = "OTP expired. Please request a new OTP."
                    elif "wrong" in msg.lower() or "invalid" in msg.lower():
                        msg = "Invalid OTP. Please check and try again."
                    return {
                        "success": False,
                        "verified": False,
                        "message": msg,
                        "raw_response": data
                    }
            elif response.status_code == 400:
                error_data = {}
                try:
                    error_data = response.json()
                except:
                    pass
                msg = error_data.get("message", "Invalid OTP. Please check and try again.")
                if "expired" in msg.lower():
                    msg = "OTP expired. Please request a new OTP."
                return {
                    "success": False,
                    "verified": False,
                    "message": msg,
                    "raw_response": error_data
                }
            else:
                error_data = {}
                try:
                    error_data = response.json()
                except:
                    pass
                return {
                    "success": False,
                    "verified": False,
                    "message": "Verification failed. Please try again.",
                    "raw_response": error_data
                }
                
    except httpx.TimeoutException:
        return {"success": False, "verified": False, "message": "Service is busy. Please try again in a few seconds."}
    except Exception as e:
        logging.error(f"[EKO-AADHAAR-VERIFY] Error: {e}")
        return {"success": False, "verified": False, "message": "Verification failed. Please try again."}
