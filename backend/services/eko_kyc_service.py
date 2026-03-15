"""
Eko KYC Verification Service
- PAN Lite: Instant PAN verification (no OTP)
- Aadhaar OTP: 3-step Aadhaar verification
"""
import os
import hashlib
import hmac
import time
import logging
import httpx
import base64
from datetime import datetime, timezone
from typing import Optional, Dict

# Eko API Configuration
# Production: https://api.eko.in:25002/ekoicici | Staging: https://staging.eko.in
# KYC API path: /ekoapi/v3
# Using staging for testing (port 443 works, port 25004 blocked)
EKO_KYC_BASE = os.environ.get("EKO_KYC_BASE_URL", "https://staging.eko.in")
EKO_KYC_URL = f"{EKO_KYC_BASE}/ekoapi/v3"
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "")


def generate_secret_key() -> tuple:
    """
    Generate secret key and timestamp for Eko API authentication
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
    
    url = f"{EKO_KYC_URL}/tools/kyc/pan-lite"
    
    # Request body as JSON
    payload = {
        "initiator_id": EKO_INITIATOR_ID,
        "user_code": EKO_USER_CODE,
        "pan_number": pan_number.upper(),
        "name": name.upper(),
        "dob": dob,
        "source": "API",
        "client_ref_id": client_ref_id
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
                # Check if API returned success
                if data.get("status") != 0 and data.get("response_status_id") != 0:
                    return {
                        "success": False,
                        "verified": False,
                        "message": data.get("message", "PAN verification failed"),
                        "raw_response": data
                    }
                
                pan_data = data.get("data", {})
                
                pan_status = pan_data.get("pan_status", "")
                status = pan_data.get("status", "INVALID")
                name_match = pan_data.get("name_match") == "Y"
                dob_match = pan_data.get("dob_match") == "Y"
                aadhaar_linked = pan_data.get("aadhaar_seeding_status") == "Y"
                
                # PAN is valid if status is VALID or pan_status starts with E
                pan_valid = status == "VALID" or (pan_status and pan_status.startswith("E"))
                
                # Verification successful if PAN is valid
                verified = pan_valid
                
                message = "PAN verified successfully" if verified else f"PAN verification failed: {get_pan_status_description(pan_status)}"
                
                return {
                    "success": True,
                    "verified": verified,
                    "pan_valid": pan_valid,
                    "name_match": name_match,
                    "dob_match": dob_match,
                    "pan_status": pan_status,
                    "pan_status_desc": get_pan_status_description(pan_status),
                    "aadhaar_linked": aadhaar_linked,
                    "aadhaar_status_desc": pan_data.get("aadhaar_seeding_status_desc", ""),
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
    
    Args:
        aadhaar_number: 12-digit Aadhaar number
        client_ref_id: Optional unique reference ID
    
    Returns:
        {
            "success": True/False,
            "otp_sent": True/False,
            "message": "...",
            "client_ref_id": "..." (needed for verification)
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
    
    # Eko Aadhaar OTP endpoint
    url = f"{EKO_KYC_URL}/aadhaar/otp"
    
    payload = {
        "initiator_id": EKO_INITIATOR_ID,
        "user_code": EKO_USER_CODE,
        "aadhaar_number": aadhaar_clean,
        "source": "API",
        "client_ref_id": client_ref_id
    }
    
    headers = get_auth_headers()
    
    logging.info(f"[EKO-AADHAAR-OTP] Calling {url} with Aadhaar: XXXX-XXXX-{aadhaar_clean[-4:]}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            logging.info(f"[EKO-AADHAAR-OTP] Response status: {response.status_code}")
            logging.info(f"[EKO-AADHAAR-OTP] Response: {response.text[:500]}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") == 0 or data.get("response_status_id") == 0:
                    otp_ref_id = data.get("data", {}).get("otp_ref_id", client_ref_id)
                    return {
                        "success": True,
                        "otp_sent": True,
                        "message": "OTP sent to your Aadhaar-linked mobile number",
                        "client_ref_id": client_ref_id,
                        "otp_ref_id": otp_ref_id,
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "otp_sent": False,
                        "message": data.get("message", "Failed to send OTP. Please check your Aadhaar number."),
                        "raw_response": data
                    }
            elif response.status_code == 400:
                error_data = response.json() if response.content else {}
                return {
                    "success": False,
                    "otp_sent": False,
                    "message": error_data.get("message", "Invalid Aadhaar number. Please check and try again."),
                    "raw_response": error_data
                }
            else:
                error_data = response.json() if response.content else {}
                return {
                    "success": False,
                    "otp_sent": False,
                    "message": "Unable to send OTP. Please try again.",
                    "raw_response": error_data
                }
                
    except httpx.TimeoutException:
        return {"success": False, "otp_sent": False, "message": "Service is busy. Please try again in a few seconds."}
    except Exception as e:
        logging.error(f"[EKO-AADHAAR-OTP] Error: {e}")
        return {"success": False, "otp_sent": False, "message": "Failed to send OTP. Please try again."}


async def verify_aadhaar_otp(aadhaar_number: str, otp: str, client_ref_id: str) -> Dict:
    """
    Step 2: Verify OTP and get Aadhaar details
    
    Args:
        aadhaar_number: 12-digit Aadhaar number
        otp: 6-digit OTP received on mobile
        client_ref_id: Reference ID from send_aadhaar_otp
    
    Returns:
        {
            "success": True/False,
            "verified": True/False,
            "aadhaar_data": {name, dob, gender, address, photo_base64, etc.},
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
    
    # Eko Aadhaar verify endpoint
    url = f"{EKO_KYC_URL}/aadhaar/verify"
    
    payload = {
        "initiator_id": EKO_INITIATOR_ID,
        "user_code": EKO_USER_CODE,
        "aadhaar_number": aadhaar_clean,
        "otp": otp,
        "otp_ref_id": client_ref_id,
        "source": "API",
        "client_ref_id": client_ref_id
    }
    
    headers = get_auth_headers()
    
    logging.info(f"[EKO-AADHAAR-VERIFY] Calling {url}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            logging.info(f"[EKO-AADHAAR-VERIFY] Response status: {response.status_code}")
            logging.info(f"[EKO-AADHAAR-VERIFY] Response: {response.text[:500]}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") == 0 or data.get("response_status_id") == 0:
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
                            "masked_aadhaar": aadhaar_data.get("masked_aadhaar")
                        },
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "verified": False,
                        "message": data.get("message", "OTP verification failed. Please try again."),
                        "raw_response": data
                    }
            elif response.status_code == 400:
                error_data = response.json() if response.content else {}
                msg = error_data.get("message", "Invalid OTP. Please check and try again.")
                # Check for expired OTP
                if "expired" in msg.lower():
                    msg = "OTP expired. Please request a new OTP."
                return {
                    "success": False,
                    "verified": False,
                    "message": msg,
                    "raw_response": error_data
                }
            else:
                error_data = response.json() if response.content else {}
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
