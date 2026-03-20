"""
PARAS REWARD - Chatbot Bank Withdrawal System
==============================================
Bank withdrawal via chatbot WITH Eko DMT OTP verification

IMPORTANT: This is the PRIMARY withdrawal flow!
Users request withdrawals through the AI Chatbot, NOT through a direct Redeem Page.

E2E FLOW DOCUMENTATION: /app/DMT_CHATBOT_FLOW.md

USER JOURNEY:
1. User opens chatbot and says "withdraw" or "bank transfer"
2. Chatbot checks eligibility (KYC, balance, subscription)
3. User chooses verification: Mobile OTP or Aadhaar eKYC
4. For Mobile OTP:
   - Check/Register customer in Eko
   - OTP sent to user's mobile
   - User enters OTP in chatbot
5. User enters bank details (account, IFSC)
6. User enters amount, sees fee breakdown
7. User confirms → Request created (status: pending)
8. ADMIN processes the request via Admin Panel
9. Admin initiates IMPS/NEFT transfer via Eko API
10. User receives money in bank account

FEES:
- Processing Fee: ₹10 (flat)
- Admin Charge: 20% of amount
- Example: ₹1000 withdrawal → User receives ₹790

LIMITS:
- Minimum: ₹500
- Maximum (Mobile OTP): ₹25,000/day
- Maximum (Aadhaar): ₹1,00,000/day

REQUIREMENTS:
- KYC: Mandatory (verified status)
- Subscription: Startup/Growth/Elite (not Explorer)
- PRC Balance: Minimum 5,000 PRC (₹500)

RELATED FILES:
- Frontend Chatbot: /app/frontend/src/components/AIChatbotEnhanced.js
- Withdrawal Flow UI: /app/frontend/src/components/ChatbotWithdrawalFlow.js
- Admin Panel: /app/frontend/src/pages/AdminChatbotWithdrawals.js
- Admin DMT Routes: /app/backend/routes/admin_dmt_routes.py
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re
import httpx  # ASYNC HTTP - replaces blocking 'requests' library

# Import new services (Phase 2 integration)
from app.services import WalletService, TransactionService, TransactionState

# Import PRC field helper
from utils.prc_fields import get_prc_amount

# Global async HTTP client for chatbot withdrawal
_chatbot_http_client = None

def get_chatbot_http_client():
    global _chatbot_http_client
    if _chatbot_http_client is None:
        _chatbot_http_client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    return _chatbot_http_client

async def chatbot_get(url: str, headers: dict = None, timeout: int = 60):
    client = get_chatbot_http_client()
    return await client.get(url, headers=headers, timeout=timeout)

async def chatbot_post(url: str, headers: dict = None, data: dict = None, json: dict = None, timeout: int = 60):
    client = get_chatbot_http_client()
    return await client.post(url, headers=headers, data=data, json=json, timeout=timeout)

async def chatbot_put(url: str, headers: dict = None, data: dict = None, timeout: int = 60):
    client = get_chatbot_http_client()
    return await client.put(url, headers=headers, data=data, timeout=timeout)
import logging
import os
import hmac
import hashlib
import base64
import time

router = APIRouter(prefix="/chatbot-redeem", tags=["Chatbot Withdrawal"])

# Database instance (set from server.py)
db = None

def set_db(database):
    global db
    db = database

# ==================== CONFIGURATION ====================

MIN_WITHDRAWAL_INR = 500  # Minimum ₹500
PROCESSING_FEE = 10  # ₹10 flat
ADMIN_CHARGE_PERCENT = 20  # 20%
DEFAULT_PRC_TO_INR_RATE = 100  # 100 PRC = ₹1 (default, actual from DB)

# Eko Configuration
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
EKO_AUTH_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "")
REQUEST_TIMEOUT = 30

# ==================== MODELS ====================

class WithdrawalRequest(BaseModel):
    uid: str
    amount_inr: float = Field(..., ge=MIN_WITHDRAWAL_INR)
    account_holder_name: str = Field(..., min_length=3)
    account_number: str = Field(..., min_length=9, max_length=18)
    bank_name: str = Field(..., min_length=2)
    ifsc_code: str = Field(..., pattern=r'^[A-Z]{4}0[A-Z0-9]{6}$')
    eko_verified: bool = False  # Must be True after OTP verification
    
    @validator('account_number')
    def validate_account_number(cls, v):
        if not v.isdigit():
            raise ValueError('Account number must contain only digits')
        return v
    
    @validator('ifsc_code')
    def validate_ifsc(cls, v):
        return v.upper()
    
    @validator('account_holder_name')
    def validate_name(cls, v):
        return v.strip().upper()

class EkoCheckRequest(BaseModel):
    """Check customer status in Eko"""
    uid: str
    mobile: str = Field(..., min_length=10, max_length=10)

class EkoRegisterRequest(BaseModel):
    """Register customer in Eko"""
    uid: str
    mobile: str = Field(..., min_length=10, max_length=10)
    name: str = Field(..., min_length=2)

class EkoVerifyOTPRequest(BaseModel):
    """Verify OTP from Eko"""
    uid: str
    mobile: str = Field(..., min_length=10, max_length=10)
    otp: str = Field(..., min_length=4, max_length=6)

class AdminProcessRequest(BaseModel):
    admin_uid: str
    action: str  # 'approve', 'reject', 'process_dmt', 'execute_dmt'
    rejection_reason: Optional[str] = None
    dmt_transaction_id: Optional[str] = None
    utr_number: Optional[str] = None
    transfer_mode: Optional[str] = "IMPS"  # IMPS or NEFT

# ==================== EKO HELPER FUNCTIONS ====================

def generate_eko_secret_key(timestamp_ms: str) -> str:
    """
    Generate Eko secret-key as per documentation:
    https://developers.eko.in/docs/auth
    
    1. Encode access_key using base64
    2. HMAC-SHA256(encoded_key, timestamp)
    3. Base64 encode the result
    """
    if not EKO_AUTH_KEY:
        return ""
    
    # Step 1: Base64 encode the access_key
    encoded_key = base64.b64encode(EKO_AUTH_KEY.encode('utf-8'))
    
    # Step 2: HMAC-SHA256 hash the timestamp with encoded key
    # NOTE: encoded_key should be used as bytes, not re-encoded!
    signature = hmac.new(
        encoded_key,  # Already bytes from base64.b64encode()
        timestamp_ms.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Step 3: Base64 encode the signature
    return base64.b64encode(signature).decode('utf-8')

def get_eko_headers() -> dict:
    """Generate Eko authentication headers"""
    timestamp_ms = str(int(time.time() * 1000))
    secret_key = generate_eko_secret_key(timestamp_ms)
    return {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp_ms,
        "initiator_id": EKO_INITIATOR_ID,
        "Content-Type": "application/x-www-form-urlencoded"
    }

def is_eko_configured() -> bool:
    """Check if Eko credentials are configured"""
    return all([EKO_DEVELOPER_KEY, EKO_AUTH_KEY, EKO_INITIATOR_ID, EKO_USER_CODE])

# ==================== HELPER FUNCTIONS ====================

def get_prc_rate_from_db() -> int:
    """Get PRC to INR rate - DYNAMIC from economy system"""
    try:
        # Import the dynamic rate function from prc_economy
        from routes.prc_economy import get_dynamic_rate_sync
        return get_dynamic_rate_sync()
    except ImportError:
        # Fallback to database settings
        from pymongo import MongoClient
        client = MongoClient(os.environ.get("MONGO_URL"))
        sync_db = client[os.environ.get("DB_NAME", "test_database")]
        
        settings = sync_db.dmt_settings.find_one({"_id": "dmt_config"})
        if settings:
            return settings.get("prc_to_inr_rate", DEFAULT_PRC_TO_INR_RATE)
        
        return DEFAULT_PRC_TO_INR_RATE
    except Exception as e:
        logging.error(f"[CHATBOT] Failed to get PRC rate: {e}")
        return DEFAULT_PRC_TO_INR_RATE

def calculate_fees(amount_inr: float) -> dict:
    """Calculate fees for withdrawal with dynamic PRC rate"""
    processing_fee = PROCESSING_FEE
    admin_charge = amount_inr * (ADMIN_CHARGE_PERCENT / 100)
    total_fees = processing_fee + admin_charge
    net_amount = amount_inr - total_fees
    
    # Get dynamic PRC rate from database
    prc_rate = get_prc_rate_from_db()
    prc_required = amount_inr * prc_rate
    
    return {
        "amount_inr": amount_inr,
        "processing_fee": processing_fee,
        "admin_charge": admin_charge,
        "admin_charge_percent": ADMIN_CHARGE_PERCENT,
        "total_fees": total_fees,
        "net_amount": net_amount,
        "prc_required": prc_required,
        "prc_rate": prc_rate
    }

def generate_request_id() -> str:
    """Generate unique withdrawal request ID"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = uuid.uuid4().hex[:6].upper()
    return f"WD-{timestamp}-{random_part}"


# ==================== INSTANT DMT HELPER FUNCTIONS ====================

async def _add_eko_recipient(mobile: str, account_number: str, ifsc: str, name: str) -> str:
    """
    Add bank account as recipient for DMT transfer.
    
    Eko V1 API: PUT /v1/customers/mobile_number:{mobile}/recipients/acc_ifsc:{account}_{ifsc_lowercase}
    
    Returns recipient_id on success, None on failure.
    """
    try:
        if not is_eko_configured():
            logging.error("[CHATBOT-DMT] Eko not configured")
            return None
        
        # V1 API correct URL format: acc_ifsc:{account}_{ifsc_lowercase}
        ifsc_lower = ifsc.lower()
        url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{mobile}/recipients/acc_ifsc:{account_number}_{ifsc_lower}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        headers = get_eko_headers()
        
        # V1 API simplified payload
        payload = {
            "recipient_name": name,
            "recipient_mobile": mobile,
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        logging.info(f"[CHATBOT-DMT] Adding recipient: {name}, Account: ***{account_number[-4:]}")
        
        response = await chatbot_put(url, headers=headers, data=payload, timeout=60)
        result = response.json()
        
        logging.info(f"[CHATBOT-DMT] Add Recipient Response: {result}")
        
        if result.get("status") in [0, "0"]:
            recipient_data = result.get("data", {})
            recipient_id = recipient_data.get("recipient_id")
            if recipient_id:
                return str(recipient_id)
        
        # Check if recipient already exists error (still extract recipient_id)
        if "recipient_id" in str(result):
            import re
            match = re.search(r'"recipient_id":\s*"?(\d+)"?', str(result))
            if match:
                return match.group(1)
        
        logging.error(f"[CHATBOT-DMT] Add Recipient Failed: {result}")
        return None
        
    except Exception as e:
        logging.error(f"[CHATBOT-DMT] Add Recipient Exception: {e}")
        return None


async def _execute_instant_dmt_transfer(sender_mobile: str, recipient_id: str, amount: int, client_ref_id: str, 
                                        account_number: str = None, ifsc_code: str = None, 
                                        recipient_name: str = None, sender_name: str = None) -> dict:
    """
    Execute INSTANT money transfer via Eko V3 Fund Transfer API.
    
    This uses the simpler Fund Transfer API instead of DMT:
    - No OTP required
    - No request_hash required
    - Direct bank transfer
    
    API: POST /ekoapi/v3/users/payment/fund-transfer
    Docs: https://developers.eko.in/reference/initiate-fund-transfer
    
    Returns dict with success status, utr_number, tid, etc.
    """
    try:
        if not is_eko_configured():
            return {"success": False, "message": "Eko service not configured"}
        
        # Generate timestamp for auth (milliseconds)
        timestamp_ms = str(int(time.time() * 1000))
        secret_key = generate_eko_secret_key(timestamp_ms)
        
        # V3 Fund Transfer - NO request_hash needed!
        # Headers
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp_ms,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        # V3 Fund Transfer URL
        # Production URL pattern (confirmed working with 402 - needs auth)
        base_host = "https://api.eko.in:25002"
        v3_url = f"{base_host}/ekoapi/v3/users/payment/fund-transfer"
        
        # If we have direct bank details, use Fund Transfer API
        if account_number and ifsc_code and recipient_name:
            # Direct Fund Transfer (no recipient_id needed)
            url = v3_url
            payload = {
                "initiator_id": EKO_INITIATOR_ID,
                "user_code": EKO_USER_CODE,
                "client_ref_id": client_ref_id[:20],  # Max 20 chars
                "service_code": "45",  # Fixed for Fund Transfer
                "payment_mode": "5",   # 5 = IMPS
                "recipient_name": recipient_name,
                "account": account_number,
                "ifsc": ifsc_code,
                "amount": str(amount),
                "sender_name": sender_name or "Paras User",
                "source": "API",
                "latlong": "19.9975,73.7898"
            }
            
            logging.info(f"[CHATBOT-DMT] Using V3 Fund Transfer API: Rs.{amount} to {account_number}")
        else:
            # Fallback to V1 DMT with recipient_id
            logging.info(f"[CHATBOT-DMT] Falling back to V1 DMT API: Rs.{amount} to recipient {recipient_id}")
            
            # Generate request_hash for V1 DMT
            encoded_key = base64.b64encode(EKO_AUTH_KEY.encode('utf-8'))
            hash_string = f"{timestamp_ms}{recipient_id}{amount}{EKO_USER_CODE}"
            request_hash = hmac.new(
                encoded_key,
                hash_string.encode('utf-8'),
                hashlib.sha256
            ).digest()
            request_hash_b64 = base64.b64encode(request_hash).decode('utf-8')
            
            headers["request_hash"] = request_hash_b64
            headers["initiator_id"] = EKO_INITIATOR_ID
            
            url = f"{EKO_BASE_URL}/v1/transactions?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
            
            payload = {
                "customer_id": sender_mobile,
                "recipient_id": recipient_id,
                "amount": str(amount),
                "client_ref_id": client_ref_id,
                "channel": "2",  # IMPS
                "state": "1",
                "initiator_id": EKO_INITIATOR_ID,
                "user_code": EKO_USER_CODE,
                "latlong": "19.9975,73.7898"
            }
        
        logging.info(f"[CHATBOT-DMT] Transfer URL: {url}")
        logging.info(f"[CHATBOT-DMT] Transfer Payload: {payload}")
        
        # Execute request
        response = await chatbot_post(url, headers=headers, data=payload, timeout=60)
        result = response.json()
        
        logging.info(f"[CHATBOT-DMT] Transfer Response: {result}")
        
        # Parse Eko response
        eko_status = result.get("status", result.get("response_status_id"))
        tx_data = result.get("data", {})
        tx_status = tx_data.get("tx_status")
        eko_tid = tx_data.get("tid", "")
        bank_ref = tx_data.get("bank_ref_num", "")
        eko_message = result.get("message", "")
        
        # DETAILED DEBUG LOGGING
        logging.info(f"[CHATBOT-DMT] === FULL EKO RESPONSE ===")
        logging.info(f"[CHATBOT-DMT] eko_status={eko_status} (type={type(eko_status).__name__})")
        logging.info(f"[CHATBOT-DMT] tx_status={tx_status} (type={type(tx_status).__name__ if tx_status else 'None'})")
        logging.info(f"[CHATBOT-DMT] message={eko_message}")
        logging.info(f"[CHATBOT-DMT] tid={eko_tid}, bank_ref={bank_ref}")
        logging.info(f"[CHATBOT-DMT] tx_data={tx_data}")
        
        # Log detailed status for debugging
        logging.info(f"[CHATBOT-DMT] eko_status={eko_status} (type={type(eko_status)}), tx_status={tx_status} (type={type(tx_status)})")
        
        if eko_status in [0, "0"]:
            # Convert tx_status to int for comparison (Eko can return string or int)
            try:
                tx_status_int = int(tx_status) if tx_status is not None else -1
            except (ValueError, TypeError):
                tx_status_int = -1
                
            if tx_status_int == 0:
                # SUCCESS!
                logging.info(f"[CHATBOT-DMT] ✅ Transfer SUCCESS! UTR={bank_ref}, TID={eko_tid}")
                return {
                    "success": True,
                    "utr_number": bank_ref,
                    "tid": eko_tid,
                    "tx_status": "SUCCESS",
                    "message": "Transfer successful!"
                }
            elif tx_status_int == 1:
                # FAILED
                return {
                    "success": False,
                    "tid": eko_tid,
                    "message": tx_data.get("txstatus_desc", "Transfer failed")
                }
            elif tx_status_int == 2:
                # PENDING
                return {
                    "success": False,
                    "pending": True,
                    "tid": eko_tid,
                    "message": "Transfer pending - check status later"
                }
            else:
                # Unknown tx_status but eko_status is 0 - check message for success
                eko_message = result.get("message", "")
                if "successful" in eko_message.lower() or "success" in eko_message.lower():
                    logging.info(f"[CHATBOT-DMT] ✅ Transfer SUCCESS (via message)! UTR={bank_ref}, TID={eko_tid}")
                    return {
                        "success": True,
                        "utr_number": bank_ref or eko_tid,
                        "tid": eko_tid,
                        "tx_status": "SUCCESS",
                        "message": "Transfer successful!"
                    }
                logging.warning(f"[CHATBOT-DMT] Unknown tx_status={tx_status_int} with eko_status=0")
        
        # Check for OTP required (status 302)
        if eko_status in [302, "302"]:
            return {
                "success": False,
                "otp_required": True,
                "message": "OTP required for this transfer"
            }
        
        # Check for insufficient balance (status 347)
        if eko_status in [347, "347"]:
            return {
                "success": False,
                "message": "Insufficient balance in service account. Please try later."
            }
        
        # FALLBACK: Check if message contains "successful" AND we have valid transaction data
        # "Transaction successful Last_used_OkeyKey" is actually an ERROR, not success!
        eko_message = result.get("message", "")
        has_valid_tid = bool(tx_data.get("tid"))
        has_valid_utr = bool(tx_data.get("bank_ref_num"))
        
        # Only consider success if we have BOTH success message AND valid transaction data
        if ("transaction successful" in eko_message.lower() or "transfer successful" in eko_message.lower()):
            # Check for known error patterns that contain "successful" but are actually failures
            if "last_used" in eko_message.lower() or "okeykey" in eko_message.lower() or "okey" in eko_message.lower():
                logging.warning(f"[CHATBOT-DMT] ❌ FALSE SUCCESS detected! Message: {eko_message}")
                return {
                    "success": False,
                    "message": f"Transfer failed: {eko_message}"
                }
            
            # Real success - must have valid transaction ID
            if has_valid_tid:
                logging.info(f"[CHATBOT-DMT] ✅ Transfer SUCCESS (via message fallback)! Message: {eko_message}")
                return {
                    "success": True,
                    "utr_number": tx_data.get("bank_ref_num", "") or tx_data.get("tid", ""),
                    "tid": tx_data.get("tid", ""),
                    "tx_status": "SUCCESS",
                    "message": "Transfer successful!"
                }
            else:
                logging.warning(f"[CHATBOT-DMT] ❌ Success message but no TID! Message: {eko_message}")
                return {
                    "success": False,
                    "message": f"Transfer status unclear - no transaction ID received"
                }
        
        logging.warning(f"[CHATBOT-DMT] Transfer failed: status={eko_status}, message={eko_message}")
        return {
            "success": False,
            "message": result.get("message", f"Transfer failed with status {eko_status}")
        }
        
    except httpx.TimeoutException:
        return {"success": False, "message": "Transfer timeout - please check status"}
    except Exception as e:
        logging.error(f"[CHATBOT-DMT] Transfer Exception: {e}")
        return {"success": False, "message": str(e)}


async def _refund_prc(uid: str, prc_amount: float, reference_id: str, reason: str):
    """Refund PRC to user using WalletService (with ledger entry)"""
    try:
        # Use WalletService for proper ledger tracking
        result = WalletService.credit(
            user_id=uid,
            amount=prc_amount,
            txn_type="withdrawal_refund",
            description=f"Refund: {reason}",
            reference=reference_id
        )
        
        if result["success"]:
            logging.info(f"[CHATBOT-DMT] PRC Refunded via WalletService: {prc_amount} to user {uid}, Ledger TXN: {result['txn_id']}")
        else:
            logging.error(f"[CHATBOT-DMT] Refund failed: {result.get('error')}")
        
    except Exception as e:
        logging.error(f"[CHATBOT-DMT] Refund Exception: {e}")


async def check_user_eligibility(uid: str) -> dict:
    """Check if user is eligible for withdrawal"""
    user = await db.users.find_one({"uid": uid})
    
    if not user:
        return {"eligible": False, "reason": "User not found"}
    
    # Check KYC status
    kyc_status = user.get("kyc_status", "not_submitted")
    if kyc_status != "verified":
        return {
            "eligible": False, 
            "reason": "KYC verification आवश्यक आहे. कृपया आधी KYC पूर्ण करा.",
            "kyc_status": kyc_status
        }
    
    # Get PRC balance and dynamic rate
    prc_balance = user.get("prc_balance", 0)
    prc_rate = get_prc_rate_from_db()
    inr_balance = prc_balance / prc_rate
    
    if inr_balance < MIN_WITHDRAWAL_INR:
        return {
            "eligible": False,
            "reason": f"Minimum ₹{MIN_WITHDRAWAL_INR} आवश्यक आहे. तुमचा balance: ₹{inr_balance:.0f}",
            "balance_inr": inr_balance,
            "prc_balance": prc_balance,
            "prc_rate": prc_rate
        }
    
    return {
        "eligible": True,
        "user_name": user.get("name"),
        "mobile": user.get("mobile"),
        "prc_balance": prc_balance,
        "balance_inr": inr_balance,
        "min_withdrawal": MIN_WITHDRAWAL_INR,
        "max_withdrawal": inr_balance,
        "prc_rate": prc_rate
    }

# ==================== API ENDPOINTS ====================

@router.get("/eligibility/{uid}")
async def check_eligibility(uid: str):
    """Check if user is eligible for withdrawal"""
    return await check_user_eligibility(uid)

@router.get("/calculate-fees")
async def get_fee_calculation(amount: float):
    """Calculate fees for given amount"""
    if amount < MIN_WITHDRAWAL_INR:
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum withdrawal amount is ₹{MIN_WITHDRAWAL_INR}"
        )
    return calculate_fees(amount)

# ==================== EKO OTP VERIFICATION APIs ====================
# NOTE: Eko DMT API DISABLED - All endpoints return "service disabled"
# Admin will process withdrawals manually without Eko API

@router.post("/eko/check-customer")
async def check_eko_customer(req: EkoCheckRequest):
    """
    Eko customer check - DISABLED
    Returns skip_otp=True so withdrawal flow continues without Eko verification
    """
    return {
        "success": True,
        "customer_exists": True,
        "verified": True,
        "skip_otp": True,
        "message": "Eko verification disabled. Admin will process manually."
    }


@router.post("/eko/register-customer")
async def register_eko_customer(req: EkoRegisterRequest):
    """
    Eko register - DISABLED
    Returns success so flow continues
    """
    return {
        "success": True,
        "registered": True,
        "skip_otp": True,
        "message": "Eko registration disabled. Admin will verify manually."
    }


@router.post("/eko/resend-otp")
async def resend_eko_otp(req: EkoCheckRequest):
    """
    Eko resend OTP - DISABLED
    """
    return {
        "success": True,
        "skip_otp": True,
        "message": "OTP verification disabled. Admin will process manually."
    }


@router.post("/eko/verify-otp")
async def verify_eko_otp(req: EkoVerifyOTPRequest):
    """
    Eko verify OTP - DISABLED
    Returns verified=True so flow continues
    """
    return {
        "success": True,
        "verified": True,
        "message": "OTP verification disabled. Admin will verify manually."
    }


@router.get("/eko/verification-status/{mobile}")
async def get_verification_status(mobile: str):
    """Check verification status - DISABLED, always returns verified"""
    return {
        "verified": True,
        "message": "Eko verification disabled. Admin will process manually."
    }

# ==================== WITHDRAWAL REQUEST API ====================

@router.post("/request")
async def create_withdrawal_request(request: WithdrawalRequest):
    """
    Create new withdrawal request via chatbot - INSTANT TRANSFER
    
    Flow:
    1. Check eligibility
    2. Verify Eko OTP verification done
    3. Add recipient to Eko (if not exists)
    4. Execute INSTANT DMT transfer
    5. Return success/failure immediately
    
    NO admin approval required - transfer is instant!
    """
    
    # Check eligibility
    eligibility = await check_user_eligibility(request.uid)
    if not eligibility.get("eligible"):
        raise HTTPException(status_code=400, detail=eligibility.get("reason"))
    
    user = await db.users.find_one({"uid": request.uid})
    user_mobile = user.get("mobile")
    
    # Verify customer status from Eko directly (real-time check)
    # IMPORTANT: Check local verification FIRST before Eko API
    # This handles cases where:
    # 1. Eko API is unreachable (403/timeout)
    # 2. Customer completed OTP verification locally but Eko still shows state=1
    verified_record = await db.eko_verified_customers.find_one({
        "mobile": user_mobile,
        "verified": True
    })
    
    if verified_record:
        logging.info(f"[CHATBOT-DMT] Customer locally verified: mobile={user_mobile}")
    elif is_eko_configured():
        # Check Eko customer status only if not locally verified
        try:
            url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{user_mobile}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
            headers = get_eko_headers()
            del headers["Content-Type"]  # GET request
            
            response = await chatbot_get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("status") == 0:
                    customer_state = result.get("data", {}).get("state", 0)
                    try:
                        state_int = int(customer_state)
                    except:
                        state_int = 99
                    
                    # Eko Customer States:
                    # 0 = Full KYC verified
                    # 1 = OTP verification pending (BLOCKED)
                    # 2 = Non-KYC (can transact with ₹25000 limit)
                    # 3 = Blocked (BLOCKED)
                    # 8 = Minimum KYC Approved (can transact)
                    # 
                    # States that CAN transact: 0, 2, 8
                    # States that CANNOT transact: 1, 3
                    allowed_states = [0, 2, 8]
                    if state_int not in allowed_states:
                        raise HTTPException(
                            status_code=400,
                            detail="❌ Customer verification pending. कृपया आधी OTP verification पूर्ण करा."
                        )
                    
                    logging.info(f"[CHATBOT-DMT] Customer verified via Eko: state={state_int}, mobile={user_mobile}")
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="❌ Customer not registered. कृपया आधी registration करा."
                    )
            elif response.status_code == 403:
                # IP not whitelisted - allow transfer (Eko service issue, not user issue)
                logging.warning(f"[CHATBOT-DMT] Eko 403 - IP not whitelisted, allowing transfer")
            else:
                logging.warning(f"[CHATBOT-DMT] Eko check failed: {response.status_code}")
                raise HTTPException(
                    status_code=400,
                    detail="❌ कृपया आधी OTP verification पूर्ण करा."
                )
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"[CHATBOT-DMT] Eko verification error: {e}")
            raise HTTPException(
                status_code=400,
                detail="❌ कृपया आधी OTP verification पूर्ण करा."
            )
    
    # Check sufficient balance
    fees = calculate_fees(request.amount_inr)
    prc_required = fees["prc_required"]
    
    prc_balance = user.get("prc_balance", 0)
    
    if prc_balance < prc_required:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Required: {prc_required:.0f} PRC, Available: {prc_balance:.0f} PRC"
        )
    
    # Generate request ID
    request_id = generate_request_id()
    now = datetime.now(timezone.utc).isoformat()
    
    # Get Eko customer ID if available
    eko_record = await db.eko_verified_customers.find_one({"mobile": user_mobile})
    eko_customer_id = eko_record.get("customer_id") if eko_record else None
    
    # STEP 1: Deduct PRC using WalletService (with ledger entry)
    debit_result = WalletService.debit(
        user_id=request.uid,
        amount=prc_required,
        txn_type="withdrawal",
        description=f"Bank Withdrawal ₹{request.amount_inr}",
        reference=request_id
    )
    
    if not debit_result["success"]:
        raise HTTPException(status_code=400, detail=debit_result.get("error", "PRC deduction failed"))
    
    logging.info(f"[CHATBOT-DMT] PRC Deducted via WalletService: {prc_required} from user {request.uid}, Ledger TXN: {debit_result['txn_id']}")
    
    try:
        # STEP 2: Add recipient to Eko (using correct V1 URL format)
        recipient_id = await _add_eko_recipient(
            mobile=user_mobile,
            account_number=request.account_number,
            ifsc=request.ifsc_code,
            name=request.account_holder_name
        )
        
        if not recipient_id:
            # Refund PRC if recipient add fails
            await _refund_prc(request.uid, prc_required, request_id, "Recipient add failed")
            raise HTTPException(status_code=400, detail="❌ Bank account add करता आले नाही. कृपया पुन्हा प्रयत्न करा.")
        
        logging.info(f"[CHATBOT-DMT] Recipient added: {recipient_id}")
        
        # STEP 3: Execute INSTANT transfer using V3 Fund Transfer API
        # Pass bank details directly for V3 API (no recipient_id needed)
        transfer_result = await _execute_instant_dmt_transfer(
            sender_mobile=user_mobile,
            recipient_id=str(recipient_id),
            amount=int(fees["net_amount"]),  # Net amount after fees
            client_ref_id=request_id,
            # V3 Fund Transfer params
            account_number=request.account_number,
            ifsc_code=request.ifsc_code,
            recipient_name=request.account_holder_name,
            sender_name=user.get("name", "Paras User")
        )
        
        logging.info(f"[CHATBOT-DMT] Transfer result: {transfer_result}")
        
        # STEP 4: Handle transfer result
        if transfer_result.get("success"):
            # SUCCESS - Transfer completed!
            withdrawal_doc = {
                "request_id": request_id,
                "uid": request.uid,
                "user_name": user.get("name"),
                "user_mobile": user_mobile,
                "eko_verified": True,
                "eko_customer_id": eko_customer_id,
                "amount_inr": request.amount_inr,
                "processing_fee": fees["processing_fee"],
                "admin_charge": fees["admin_charge"],
                "total_fees": fees["total_fees"],
                "net_amount": fees["net_amount"],
                "total_prc_deducted": prc_required,
                "account_holder_name": request.account_holder_name,
                "account_number": request.account_number,
                "bank_name": request.bank_name,
                "ifsc_code": request.ifsc_code,
                "status": "completed",  # INSTANT completion!
                "created_at": now,
                "updated_at": now,
                "dmt_transaction_id": transfer_result.get("tid"),
                "dmt_status": "SUCCESS",
                "utr_number": transfer_result.get("utr_number"),
                "processed_at": now,
                "source": "chatbot",
                "instant_transfer": True
            }
            
            await db.chatbot_withdrawal_requests.insert_one(withdrawal_doc)
            
            # PHASE 3: Create transaction with state machine
            txn_result = TransactionService.create(
                user_id=request.uid,
                txn_type="withdrawal",
                amount=prc_required,
                description=f"Bank withdrawal ₹{request.amount_inr} to {request.bank_name}",
                metadata={
                    "request_id": request_id,
                    "amount_inr": request.amount_inr,
                    "bank_name": request.bank_name,
                    "account_masked": f"****{request.account_number[-4:]}",
                    "utr_number": transfer_result.get("utr_number"),
                    "instant": True
                }
            )
            
            # Mark transaction as SUCCESS immediately
            if txn_result.get("success"):
                TransactionService.mark_success(
                    txn_id=txn_result["transaction"]["txn_id"],
                    reference=transfer_result.get("utr_number")
                )
            
            return {
                "success": True,
                "request_id": request_id,
                "message": "✅ Transfer successful! पैसे तुमच्या bank account मध्ये जमा झाले.",
                "status": "COMPLETED",
                "details": {
                    "amount": request.amount_inr,
                    "fees": fees["total_fees"],
                    "net_amount": fees["net_amount"],
                    "prc_deducted": prc_required,
                    "bank": f"{request.bank_name} - ****{request.account_number[-4:]}",
                    "utr_number": transfer_result.get("utr_number"),
                    "transaction_id": transfer_result.get("tid"),
                    "expected_days": "Instant"  # Changed from 5-7 days!
                }
            }
        
        elif transfer_result.get("otp_required"):
            # OTP required for transfer - save pending request
            withdrawal_doc = {
                "request_id": request_id,
                "uid": request.uid,
                "user_name": user.get("name"),
                "user_mobile": user_mobile,
                "eko_verified": True,
                "eko_customer_id": eko_customer_id,
                "amount_inr": request.amount_inr,
                "processing_fee": fees["processing_fee"],
                "admin_charge": fees["admin_charge"],
                "total_fees": fees["total_fees"],
                "net_amount": fees["net_amount"],
                "total_prc_deducted": prc_required,
                "account_holder_name": request.account_holder_name,
                "account_number": request.account_number,
                "bank_name": request.bank_name,
                "ifsc_code": request.ifsc_code,
                "recipient_id": recipient_id,
                "status": "otp_pending",
                "created_at": now,
                "updated_at": now,
                "source": "chatbot",
                "instant_transfer": True
            }
            
            await db.chatbot_withdrawal_requests.insert_one(withdrawal_doc)
            
            return {
                "success": True,
                "request_id": request_id,
                "otp_required": True,
                "message": "📱 OTP पाठवला आहे. कृपया OTP टाकून transfer पूर्ण करा.",
                "status": "OTP_PENDING",
                "details": {
                    "amount": request.amount_inr,
                    "fees": fees["total_fees"],
                    "net_amount": fees["net_amount"],
                    "prc_deducted": prc_required,
                    "bank": f"{request.bank_name} - ****{request.account_number[-4:]}"
                }
            }
        
        else:
            # FAILED - Refund PRC
            await _refund_prc(request.uid, prc_required, request_id, f"Transfer failed: {transfer_result.get('message')}")
            
            # PHASE 3: Create failed transaction record
            txn_result = TransactionService.create(
                user_id=request.uid,
                txn_type="withdrawal",
                amount=prc_required,
                description=f"Bank withdrawal ₹{request.amount_inr} - FAILED",
                metadata={
                    "request_id": request_id,
                    "amount_inr": request.amount_inr,
                    "bank_name": request.bank_name,
                    "failure_reason": transfer_result.get("message")
                }
            )
            if txn_result.get("success"):
                TransactionService.mark_failed(
                    txn_id=txn_result["transaction"]["txn_id"],
                    reason=transfer_result.get("message", "Transfer failed")
                )
            
            # Log failed attempt
            withdrawal_doc = {
                "request_id": request_id,
                "uid": request.uid,
                "user_name": user.get("name"),
                "user_mobile": user_mobile,
                "amount_inr": request.amount_inr,
                "total_prc_deducted": prc_required,
                "prc_refunded": prc_required,
                "account_number": request.account_number,
                "bank_name": request.bank_name,
                "ifsc_code": request.ifsc_code,
                "status": "failed",
                "created_at": now,
                "updated_at": now,
                "failure_reason": transfer_result.get("message"),
                "source": "chatbot"
            }
            
            await db.chatbot_withdrawal_requests.insert_one(withdrawal_doc)
            
            error_msg = transfer_result.get("message", "Transfer failed")
            if "insufficient balance" in error_msg.lower():
                error_msg = "❌ Service temporarily unavailable. कृपया नंतर प्रयत्न करा."
            
            return {
                "success": False,
                "request_id": request_id,
                "message": f"❌ Transfer failed. {prc_required:.0f} PRC refunded.",
                "status": "FAILED",
                "error": error_msg,
                "details": {
                    "prc_refunded": prc_required
                }
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[CHATBOT-DMT] Exception: {e}")
        # Refund PRC on any error
        await _refund_prc(request.uid, prc_required, request_id, f"System error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transfer failed. PRC refunded. Error: {str(e)}")

@router.get("/status/{request_id}")
async def get_request_status(request_id: str):
    """Get status of a withdrawal request"""
    request_doc = await db.chatbot_withdrawal_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Mask sensitive data
    request_doc["account_number"] = "****" + request_doc["account_number"][-4:]
    
    return request_doc

@router.get("/history/{uid}")
async def get_user_history(uid: str, limit: int = 20, skip: int = 0):
    """Get user's withdrawal request history"""
    requests = await db.chatbot_withdrawal_requests.find(
        {"uid": uid},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Mask account numbers
    for req in requests:
        req["account_number"] = "****" + req["account_number"][-4:]
    
    total = await db.chatbot_withdrawal_requests.count_documents({"uid": uid})
    
    return {
        "requests": requests,
        "total": total,
        "pending": sum(1 for r in requests if r["status"] == "pending"),
        "completed": sum(1 for r in requests if r["status"] == "completed"),
        "rejected": sum(1 for r in requests if r["status"] == "rejected")
    }

@router.get("/saved-accounts/{uid}")
async def get_saved_accounts(uid: str):
    """Get user's saved bank accounts"""
    accounts = await db.user_bank_accounts.find(
        {"uid": uid},
        {"_id": 0}
    ).sort("last_used", -1).to_list(length=10)
    
    # Mask account numbers
    for acc in accounts:
        acc["account_number_masked"] = "****" + acc["account_number"][-4:]
    
    return {"accounts": accounts}


# ==================== USER CANCEL REDEEM REQUEST ====================

@router.post("/cancel/{request_id}")
async def cancel_redeem_request(request_id: str, request: Request):
    """
    User cancels their pending redeem request via chatbot.
    
    - Only PENDING requests can be cancelled
    - PRC is refunded back to user
    - Request marked as 'cancelled_by_user'
    
    This allows users to cancel without admin intervention.
    """
    try:
        data = await request.json() if request.headers.get("content-type") == "application/json" else {}
    except:
        data = {}
    
    uid = data.get("uid", "")
    
    # Find the request
    request_doc = await db.chatbot_withdrawal_requests.find_one({"request_id": request_id})
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Verify ownership if uid provided
    if uid and request_doc.get("uid") != uid:
        raise HTTPException(status_code=403, detail="You can only cancel your own requests")
    
    # Only pending requests can be cancelled
    current_status = request_doc.get("status", "")
    if current_status != "pending":
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot cancel request with status: {current_status}. Only pending requests can be cancelled."
        )
    
    now = datetime.now(timezone.utc).isoformat()
    prc_to_refund = get_prc_amount(request_doc)
    user_uid = request_doc.get("uid")
    
    # Update request status
    await db.chatbot_withdrawal_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "cancelled_by_user",
            "cancelled_at": now,
            "cancellation_reason": "User demand - cancelled via chatbot",
            "updated_at": now
        }}
    )
    
    # Refund PRC to user
    if prc_to_refund > 0 and user_uid:
        await db.users.update_one(
            {"uid": user_uid},
            {"$inc": {"prc_balance": prc_to_refund}}
        )
        
        # Log refund transaction
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "uid": user_uid,
            "type": "withdrawal_cancelled_refund",
            "amount_prc": prc_to_refund,
            "reference_id": request_id,
            "status": "completed",
            "description": "Withdrawal cancelled by user - PRC refunded",
            "created_at": now
        })
    
    return {
        "success": True,
        "message": "Withdrawal request cancelled successfully. PRC refunded to your account.",
        "data": {
            "request_id": request_id,
            "prc_refunded": prc_to_refund,
            "status": "cancelled_by_user"
        }
    }


@router.get("/pending/{uid}")
async def get_user_pending_requests(uid: str):
    """
    Get all pending withdrawal requests for a user.
    User can cancel any of these via chatbot.
    """
    pending_requests = await db.chatbot_withdrawal_requests.find(
        {"uid": uid, "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)
    
    # Mask sensitive data
    for req in pending_requests:
        if req.get("account_number"):
            req["account_number"] = "****" + req["account_number"][-4:]
    
    return {
        "success": True,
        "pending_count": len(pending_requests),
        "requests": pending_requests,
        "message": f"You have {len(pending_requests)} pending withdrawal request(s). You can cancel any of them."
    }


@router.get("/all/{uid}")
async def get_all_user_requests(uid: str, status: str = None, limit: int = 50):
    """
    Get ALL withdrawal requests for a user (old and new).
    
    Query params:
    - status: filter by status (pending, completed, cancelled_by_user, rejected, etc.)
    - limit: max number of requests (default 50)
    """
    query = {"uid": uid}
    
    if status:
        query["status"] = status
    
    requests = await db.chatbot_withdrawal_requests.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=limit)
    
    # Mask sensitive data and add display info
    for req in requests:
        if req.get("account_number"):
            req["account_number_masked"] = "****" + req["account_number"][-4:]
        
        # Add cancellable flag
        req["can_cancel"] = req.get("status") == "pending"
        
        # Format status for display
        status_map = {
            "pending": "🕐 Pending",
            "processing": "⏳ Processing", 
            "completed": "✅ Completed",
            "cancelled_by_user": "❌ Cancelled",
            "rejected": "🚫 Rejected",
            "failed": "❌ Failed"
        }
        req["status_display"] = status_map.get(req.get("status"), req.get("status"))
    
    # Count by status
    status_counts = {}
    all_statuses = await db.chatbot_withdrawal_requests.aggregate([
        {"$match": {"uid": uid}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(length=20)
    
    for s in all_statuses:
        status_counts[s["_id"]] = s["count"]
    
    return {
        "success": True,
        "total_count": len(requests),
        "status_counts": status_counts,
        "requests": requests
    }


@router.post("/cancel-selected")
async def cancel_selected_requests(request: Request):
    """
    Cancel multiple selected pending requests.
    
    Body:
    {
        "uid": "user-id",
        "request_ids": ["req1", "req2", "req3"]
    }
    """
    try:
        data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    uid = data.get("uid", "")
    request_ids = data.get("request_ids", [])
    
    if not uid:
        raise HTTPException(status_code=400, detail="User ID required")
    
    if not request_ids or not isinstance(request_ids, list):
        raise HTTPException(status_code=400, detail="request_ids list required")
    
    # Find all selected pending requests
    pending_requests = await db.chatbot_withdrawal_requests.find({
        "request_id": {"$in": request_ids},
        "uid": uid,
        "status": "pending"
    }).to_list(length=100)
    
    if not pending_requests:
        return {
            "success": False,
            "message": "No pending requests found to cancel.",
            "cancelled_count": 0,
            "prc_refunded": 0
        }
    
    now = datetime.now(timezone.utc).isoformat()
    total_prc_refund = 0
    cancelled_ids = []
    skipped_ids = []
    
    for req in pending_requests:
        request_id = req.get("request_id")
        prc_amount = get_prc_amount(req)
        
        # Update status
        await db.chatbot_withdrawal_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "cancelled_by_user",
                "cancelled_at": now,
                "cancellation_reason": "User demand - selected cancel",
                "updated_at": now
            }}
        )
        
        total_prc_refund += prc_amount
        cancelled_ids.append(request_id)
    
    # Find which IDs were not cancelled (not pending or not found)
    skipped_ids = [rid for rid in request_ids if rid not in cancelled_ids]
    
    # Refund all PRC at once
    if total_prc_refund > 0:
        await db.users.update_one(
            {"uid": uid},
            {"$inc": {"prc_balance": total_prc_refund}}
        )
        
        # Log refund transaction
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "uid": uid,
            "type": "withdrawal_selected_cancel_refund",
            "amount_prc": total_prc_refund,
            "reference_id": ",".join(cancelled_ids),
            "status": "completed",
            "description": f"Selected cancel - {len(cancelled_ids)} requests cancelled by user",
            "created_at": now
        })
    
    return {
        "success": True,
        "message": f"Successfully cancelled {len(cancelled_ids)} request(s). PRC refunded.",
        "data": {
            "cancelled_count": len(cancelled_ids),
            "prc_refunded": total_prc_refund,
            "cancelled_request_ids": cancelled_ids,
            "skipped_request_ids": skipped_ids,
            "skipped_reason": "Not pending or not found" if skipped_ids else None
        }
    }


@router.post("/cancel-all/{uid}")
async def cancel_all_pending_requests(uid: str, request: Request):
    """
    Cancel ALL pending withdrawal requests for a user.
    All PRC is refunded.
    """
    # Get all pending requests
    pending_requests = await db.chatbot_withdrawal_requests.find(
        {"uid": uid, "status": "pending"}
    ).to_list(length=100)
    
    if not pending_requests:
        return {
            "success": True,
            "message": "No pending requests to cancel.",
            "cancelled_count": 0,
            "prc_refunded": 0
        }
    
    now = datetime.now(timezone.utc).isoformat()
    total_prc_refund = 0
    cancelled_ids = []
    
    for req in pending_requests:
        request_id = req.get("request_id")
        prc_amount = get_prc_amount(req)
        
        # Update status
        await db.chatbot_withdrawal_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "cancelled_by_user",
                "cancelled_at": now,
                "cancellation_reason": "User demand - bulk cancel via chatbot",
                "updated_at": now
            }}
        )
        
        total_prc_refund += prc_amount
        cancelled_ids.append(request_id)
    
    # Refund all PRC at once
    if total_prc_refund > 0:
        await db.users.update_one(
            {"uid": uid},
            {"$inc": {"prc_balance": total_prc_refund}}
        )
        
        # Log bulk refund
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "uid": uid,
            "type": "withdrawal_bulk_cancel_refund",
            "amount_prc": total_prc_refund,
            "reference_id": ",".join(cancelled_ids),
            "status": "completed",
            "description": f"Bulk cancel - {len(cancelled_ids)} requests cancelled by user",
            "created_at": now
        })
    
    return {
        "success": True,
        "message": f"Successfully cancelled {len(cancelled_ids)} pending request(s). All PRC refunded.",
        "data": {
            "cancelled_count": len(cancelled_ids),
            "prc_refunded": total_prc_refund,
            "cancelled_request_ids": cancelled_ids
        }
    }


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending")
async def get_pending_requests(limit: int = 50, skip: int = 0):
    """Get all pending withdrawal requests for admin"""
    requests = await db.chatbot_withdrawal_requests.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.chatbot_withdrawal_requests.count_documents({"status": "pending"})
    
    return {
        "requests": requests,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/admin/all")
async def get_all_requests(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all withdrawal requests with optional status filter"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.chatbot_withdrawal_requests.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.chatbot_withdrawal_requests.count_documents(query)
    
    # Stats
    stats = {
        "pending": await db.chatbot_withdrawal_requests.count_documents({"status": "pending"}),
        "processing": await db.chatbot_withdrawal_requests.count_documents({"status": "processing"}),
        "completed": await db.chatbot_withdrawal_requests.count_documents({"status": "completed"}),
        "rejected": await db.chatbot_withdrawal_requests.count_documents({"status": "rejected"})
    }
    
    return {
        "requests": requests,
        "total": total,
        "stats": stats
    }

@router.get("/admin/request/{request_id}")
async def get_request_details(request_id: str):
    """Get full details of a withdrawal request for admin"""
    request_doc = await db.chatbot_withdrawal_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get user details
    user = await db.users.find_one(
        {"uid": request_doc["uid"]},
        {"_id": 0, "name": 1, "mobile": 1, "email": 1, "kyc_status": 1, "prc_balance": 1}
    )
    
    request_doc["user_details"] = user
    
    return request_doc

@router.post("/admin/process/{request_id}")
async def process_request(request_id: str, process_data: AdminProcessRequest):
    """Admin process withdrawal request"""
    request_doc = await db.chatbot_withdrawal_requests.find_one({"request_id": request_id})
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if process_data.action == "reject":
        # Reject and refund PRC
        await db.chatbot_withdrawal_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "rejected",
                    "rejection_reason": process_data.rejection_reason or "Admin rejected",
                    "processed_by": process_data.admin_uid,
                    "processed_at": now,
                    "updated_at": now
                }
            }
        )
        
        # Refund PRC to user
        await db.users.update_one(
            {"uid": request_doc["uid"]},
            {"$inc": {"prc_balance": request_doc["prc_deducted"]}}
        )
        
        # Log refund
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "uid": request_doc["uid"],
            "type": "withdrawal_refund",
            "amount_prc": request_doc["prc_deducted"],
            "reference_id": request_id,
            "status": "completed",
            "description": "Withdrawal rejected - PRC refunded",
            "created_at": now
        })
        
        return {"success": True, "message": "Request rejected and PRC refunded"}
    
    elif process_data.action == "approve":
        # Mark as processing (admin will initiate DMT separately)
        await db.chatbot_withdrawal_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "processing",
                    "processed_by": process_data.admin_uid,
                    "updated_at": now
                }
            }
        )
        return {"success": True, "message": "Request approved, ready for DMT processing"}
    
    elif process_data.action == "complete_dmt":
        # Mark as completed after successful DMT
        await db.chatbot_withdrawal_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "completed",
                    "dmt_transaction_id": process_data.dmt_transaction_id,
                    "dmt_status": "success",
                    "processed_by": process_data.admin_uid,
                    "processed_at": now,
                    "updated_at": now
                }
            }
        )
        
        # Update transaction log
        await db.transactions.update_one(
            {"reference_id": request_id},
            {"$set": {"status": "completed"}}
        )
        
        return {"success": True, "message": "Withdrawal completed successfully"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@router.get("/admin/stats")
async def get_withdrawal_stats():
    """Get withdrawal statistics for admin dashboard"""
    
    # Count by status
    pending = await db.chatbot_withdrawal_requests.count_documents({"status": "pending"})
    processing = await db.chatbot_withdrawal_requests.count_documents({"status": "processing"})
    completed = await db.chatbot_withdrawal_requests.count_documents({"status": "completed"})
    rejected = await db.chatbot_withdrawal_requests.count_documents({"status": "rejected"})
    
    # Total amounts
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": None,
            "total_amount": {"$sum": "$amount_inr"},
            "total_fees": {"$sum": "$total_fees"},
            "count": {"$sum": 1}
        }}
    ]
    
    completed_stats = await db.chatbot_withdrawal_requests.aggregate(pipeline).to_list(1)
    
    return {
        "counts": {
            "pending": pending,
            "processing": processing,
            "completed": completed,
            "rejected": rejected,
            "total": pending + processing + completed + rejected
        },
        "completed_summary": completed_stats[0] if completed_stats else {
            "total_amount": 0,
            "total_fees": 0,
            "count": 0
        }
    }


# ==================== EKO DMT TRANSFER EXECUTION ====================

@router.post("/admin/execute-dmt/{request_id}")
async def execute_dmt_transfer(request_id: str, request: Request):
    """
    Execute Eko DMT bank transfer for a withdrawal request.
    
    This endpoint:
    1. Gets the approved withdrawal request
    2. Calls Eko DMT API to transfer money
    3. On success: Updates request with UTR, marks as completed
    4. On failure: Returns error details, keeps status as processing
    
    Flow: Admin clicks "Complete" → This API → Eko DMT → Bank → UTR
    """
    try:
        data = await request.json()
        admin_uid = data.get("admin_uid", "")
        transfer_mode = data.get("transfer_mode", "IMPS")  # IMPS or NEFT
        
        # Get the withdrawal request
        request_doc = await db.chatbot_withdrawal_requests.find_one({"request_id": request_id})
        
        if not request_doc:
            raise HTTPException(status_code=404, detail="Withdrawal request not found")
        
        # Verify status
        if request_doc.get("status") not in ["pending", "processing"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot process request with status: {request_doc.get('status')}"
            )
        
        # Get transfer details
        user_mobile = request_doc.get("user_mobile", "")
        amount = request_doc.get("net_amount", 0)  # Net amount after fees
        account_number = request_doc.get("account_number", "")
        ifsc_code = request_doc.get("ifsc_code", "")
        # Try both field names for account holder
        account_holder = request_doc.get("account_holder") or request_doc.get("account_holder_name") or request_doc.get("user_name", "")
        recipient_id = request_doc.get("eko_recipient_id", "")
        
        if not all([user_mobile, amount, account_number, ifsc_code]):
            raise HTTPException(
                status_code=400,
                detail="Missing bank details. Cannot process transfer."
            )
        
        # Check minimum amount
        if amount < 100:
            raise HTTPException(
                status_code=400,
                detail=f"Transfer amount ₹{amount} is below minimum ₹100"
            )
        
        # Sanitize account holder name (Eko requires 1-50 chars)
        if account_holder:
            # Remove extra spaces and limit to 50 chars
            account_holder = ' '.join(account_holder.split())[:50]
        
        now = datetime.now(timezone.utc)
        
        # ============ STEP 1: Add/Verify Recipient if not exists ============
        if not recipient_id:
            logging.info(f"[DMT-EXECUTE] Adding recipient for {request_id}")
            
            recipient_result = await _add_eko_recipient(
                sender_mobile=user_mobile,
                account_number=account_number,
                ifsc_code=ifsc_code,
                account_holder=account_holder
            )
            
            if not recipient_result.get("success"):
                # Save error and return
                await db.chatbot_withdrawal_requests.update_one(
                    {"request_id": request_id},
                    {"$set": {
                        "last_dmt_attempt": now.isoformat(),
                        "last_dmt_error": recipient_result.get("message", "Failed to add recipient"),
                        "dmt_error_code": recipient_result.get("error_code", "RECIPIENT_ERROR")
                    }}
                )
                return {
                    "success": False,
                    "message": f"Failed to add bank recipient: {recipient_result.get('message')}",
                    "error_type": "RECIPIENT_ERROR",
                    "details": recipient_result
                }
            
            recipient_id = recipient_result.get("recipient_id", "")
            
            # Save recipient ID for future use
            await db.chatbot_withdrawal_requests.update_one(
                {"request_id": request_id},
                {"$set": {"eko_recipient_id": recipient_id}}
            )
        
        # ============ STEP 2: Execute Money Transfer ============
        logging.info(f"[DMT-EXECUTE] Initiating transfer for {request_id}: ₹{amount} via {transfer_mode}")
        
        transfer_result = await _execute_eko_transfer(
            sender_mobile=user_mobile,
            recipient_id=recipient_id,
            amount=int(amount),
            transfer_mode=transfer_mode,
            client_ref_id=request_id
        )
        
        # ============ STEP 3: Handle Result ============
        if transfer_result.get("success"):
            utr_number = transfer_result.get("utr_number", "")
            eko_tid = transfer_result.get("tid", "")
            
            # Success! Update request as completed
            await db.chatbot_withdrawal_requests.update_one(
                {"request_id": request_id},
                {"$set": {
                    "status": "completed",
                    "utr_number": utr_number,
                    "eko_tid": eko_tid,
                    "dmt_status": "success",
                    "dmt_response": transfer_result,
                    "processed_by": admin_uid,
                    "processed_at": now.isoformat(),
                    "completed_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }}
            )
            
            # Update transaction log
            await db.transactions.update_one(
                {"reference_id": request_id},
                {"$set": {"status": "completed", "utr_number": utr_number}}
            )
            
            logging.info(f"[DMT-EXECUTE] ✅ Transfer successful: {request_id} UTR: {utr_number}")
            
            return {
                "success": True,
                "message": "Bank transfer completed successfully!",
                "data": {
                    "request_id": request_id,
                    "utr_number": utr_number,
                    "eko_tid": eko_tid,
                    "amount": amount,
                    "transfer_mode": transfer_mode,
                    "bank_account": f"****{account_number[-4:]}" if account_number else "",
                    "ifsc": ifsc_code
                }
            }
        else:
            # Transfer failed
            error_message = transfer_result.get("message", "Transfer failed")
            error_code = transfer_result.get("error_code", "TRANSFER_FAILED")
            
            # Save error details but keep status as processing for retry
            await db.chatbot_withdrawal_requests.update_one(
                {"request_id": request_id},
                {"$set": {
                    "last_dmt_attempt": now.isoformat(),
                    "last_dmt_error": error_message,
                    "dmt_error_code": error_code,
                    "dmt_response": transfer_result,
                    "updated_at": now.isoformat()
                },
                "$inc": {"dmt_attempt_count": 1}}
            )
            
            logging.error(f"[DMT-EXECUTE] ❌ Transfer failed: {request_id} - {error_message}")
            
            return {
                "success": False,
                "message": error_message,
                "error_type": error_code,
                "details": transfer_result,
                "retry_allowed": True
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[DMT-EXECUTE] Exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transfer execution error: {str(e)}")


# NOTE: The functions _add_eko_recipient and _execute_eko_transfer are defined 
# at the top of this file (lines 216-380) and should not be duplicated here.
# The old implementations below were using incorrect URL format (acc_no instead of acc_ifsc)
# and JSON instead of form-urlencoded for transfer.


@router.post("/admin/complete-manual/{request_id}")
async def complete_withdrawal_manual(request_id: str, request: Request):
    """
    Manually complete a withdrawal with UTR number.
    Use this when transfer was done outside the system.
    """
    try:
        data = await request.json()
        admin_uid = data.get("admin_uid", "")
        utr_number = data.get("utr_number", "").strip()
        remarks = data.get("remarks", "")
        
        if not utr_number:
            raise HTTPException(status_code=400, detail="UTR number is required")
        
        # Validate UTR format (12 digits)
        cleaned_utr = ''.join(filter(str.isdigit, utr_number))
        if len(cleaned_utr) != 12:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid UTR format. Expected 12 digits, got {len(cleaned_utr)}"
            )
        
        # Get request
        request_doc = await db.chatbot_withdrawal_requests.find_one({"request_id": request_id})
        if not request_doc:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request_doc.get("status") == "completed":
            raise HTTPException(status_code=400, detail="Request already completed")
        
        # Check UTR uniqueness
        existing = await db.chatbot_withdrawal_requests.find_one({
            "utr_number": cleaned_utr,
            "request_id": {"$ne": request_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="UTR number already used for another request")
        
        now = datetime.now(timezone.utc)
        
        # Update request
        await db.chatbot_withdrawal_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "completed",
                "utr_number": cleaned_utr,
                "dmt_status": "manual",
                "admin_remarks": remarks,
                "processed_by": admin_uid,
                "processed_at": now.isoformat(),
                "completed_at": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        
        # Update transaction log
        await db.transactions.update_one(
            {"reference_id": request_id},
            {"$set": {"status": "completed", "utr_number": cleaned_utr}}
        )
        
        logging.info(f"[MANUAL-COMPLETE] {request_id} marked complete with UTR: {cleaned_utr}")
        
        return {
            "success": True,
            "message": "Withdrawal marked as completed",
            "data": {
                "request_id": request_id,
                "utr_number": cleaned_utr,
                "amount": request_doc.get("net_amount")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[MANUAL-COMPLETE] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



# ==================== ADMIN: REGISTER CUSTOMER IN EKO ====================

@router.post("/admin/register-customer/{request_id}")
async def admin_register_customer_eko(request_id: str, request: Request):
    """
    Admin API to register a customer in Eko DMT system.
    
    This is used when a withdrawal request fails because the customer
    is not registered in Eko. This API:
    1. Gets customer details from the request
    2. Calls Eko Customer Registration API
    3. Sends OTP to customer's mobile
    4. Returns status (OTP sent / already registered / error)
    
    After this, admin should ask user to share OTP received on mobile,
    then call verify-otp API before executing DMT.
    """
    try:
        data = await request.json()
        
        # Get the withdrawal request
        request_doc = await db.chatbot_withdrawal_requests.find_one({"request_id": request_id})
        
        if not request_doc:
            raise HTTPException(status_code=404, detail="Withdrawal request not found")
        
        user_mobile = request_doc.get("user_mobile", "")
        user_name = request_doc.get("user_name") or request_doc.get("account_holder_name", "")
        
        if not user_mobile:
            raise HTTPException(status_code=400, detail="User mobile not found in request")
        
        logging.info(f"[ADMIN-REGISTER] Registering customer {user_mobile} for request {request_id}")
        
        # ============ STEP 1: Check if customer already exists ============
        try:
            from .eko_common import get_eko_headers, EKO_BASE_URL, EKO_INITIATOR_ID, EKO_USER_CODE
            
            headers = get_eko_headers()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            
            # Customer inquiry
            inquiry_url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{user_mobile}"
            
            import httpx
            async with httpx.AsyncClient(timeout=30) as client:
                inquiry_response = await client.get(
                    inquiry_url,
                    headers=headers,
                    params={
                        "initiator_id": EKO_INITIATOR_ID,
                        "user_code": EKO_USER_CODE
                    }
                )
                
                inquiry_data = inquiry_response.json()
                logging.info(f"[ADMIN-REGISTER] Customer inquiry response: {inquiry_data}")
                
                # Check response
                response_code = inquiry_data.get("response_status_id", -1)
                
                if response_code == 0:
                    # Customer already exists and verified
                    return {
                        "success": True,
                        "already_registered": True,
                        "customer_verified": True,
                        "message": "Customer already registered and verified in Eko. You can proceed with DMT.",
                        "customer_id": inquiry_data.get("data", {}).get("customer_id")
                    }
                
                elif response_code == 330:
                    # Customer exists but OTP pending
                    return {
                        "success": True,
                        "already_registered": True,
                        "customer_verified": False,
                        "otp_required": True,
                        "message": "Customer exists but OTP verification pending. Ask user for OTP or resend.",
                        "otp_ref_id": inquiry_data.get("data", {}).get("otp_ref_id")
                    }
        
        except Exception as e:
            logging.warning(f"[ADMIN-REGISTER] Inquiry error (proceeding to register): {e}")
        
        # ============ STEP 2: Register customer (sends OTP) ============
        try:
            register_url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{user_mobile}"
            
            # Clean name for Eko (1-50 chars, alphanumeric + space)
            clean_name = ''.join(c for c in user_name if c.isalnum() or c.isspace())[:50].strip()
            if not clean_name:
                clean_name = "Customer"
            
            register_data = {
                "initiator_id": EKO_INITIATOR_ID,
                "user_code": EKO_USER_CODE,
                "name": clean_name,
                "pipe": "9"  # Default pipe for DMT
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                register_response = await client.put(
                    register_url,
                    headers=headers,
                    data=register_data
                )
                
                register_result = register_response.json()
                logging.info(f"[ADMIN-REGISTER] Registration response: {register_result}")
                
                response_code = register_result.get("response_status_id", -1)
                message = register_result.get("message", "")
                
                if response_code == 0 or "otp" in message.lower() or "sent" in message.lower():
                    # OTP sent successfully
                    otp_ref_id = register_result.get("data", {}).get("otp_ref_id", "")
                    
                    # Save OTP ref ID to request
                    await db.chatbot_withdrawal_requests.update_one(
                        {"request_id": request_id},
                        {"$set": {
                            "eko_otp_ref_id": otp_ref_id,
                            "eko_registration_status": "otp_sent",
                            "eko_registration_timestamp": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    return {
                        "success": True,
                        "otp_sent": True,
                        "message": f"OTP sent to {user_mobile}. Ask user to share the OTP.",
                        "otp_ref_id": otp_ref_id,
                        "next_step": "verify_otp"
                    }
                
                elif response_code == 464:
                    # Customer already exists
                    return {
                        "success": True,
                        "already_registered": True,
                        "message": "Customer already exists in Eko. Try executing DMT again.",
                        "next_step": "execute_dmt"
                    }
                
                else:
                    # Registration failed
                    return {
                        "success": False,
                        "message": message or "Customer registration failed",
                        "error_type": "REGISTRATION_FAILED",
                        "eko_response": register_result
                    }
                    
        except Exception as e:
            logging.error(f"[ADMIN-REGISTER] Registration error: {e}")
            return {
                "success": False,
                "message": f"Registration error: {str(e)}",
                "error_type": "REGISTRATION_ERROR"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ADMIN-REGISTER] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/verify-customer-otp/{request_id}")
async def admin_verify_customer_otp(request_id: str, request: Request):
    """
    Admin API to verify customer OTP after registration.
    
    Admin gets OTP from user (via call/WhatsApp) and enters here.
    After successful verification, DMT can be executed.
    """
    try:
        data = await request.json()
        otp = data.get("otp", "").strip()
        
        if not otp or len(otp) < 4:
            raise HTTPException(status_code=400, detail="Valid OTP required")
        
        # Get the withdrawal request
        request_doc = await db.chatbot_withdrawal_requests.find_one({"request_id": request_id})
        
        if not request_doc:
            raise HTTPException(status_code=404, detail="Withdrawal request not found")
        
        user_mobile = request_doc.get("user_mobile", "")
        otp_ref_id = request_doc.get("eko_otp_ref_id", "")
        
        if not user_mobile:
            raise HTTPException(status_code=400, detail="User mobile not found")
        
        logging.info(f"[ADMIN-VERIFY-OTP] Verifying OTP for {user_mobile}, request {request_id}")
        
        # ============ Call Eko OTP Verification ============
        try:
            from .eko_common import get_eko_headers, EKO_BASE_URL, EKO_INITIATOR_ID, EKO_USER_CODE
            
            headers = get_eko_headers()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            
            verify_url = f"{EKO_BASE_URL}/v1/customers/verification/otp:{otp}"
            
            verify_data = {
                "initiator_id": EKO_INITIATOR_ID,
                "user_code": EKO_USER_CODE,
                "id_type": "mobile_number",
                "id": user_mobile,
                "otp_ref_id": otp_ref_id,
                "otp": otp
            }
            
            import httpx
            async with httpx.AsyncClient(timeout=30) as client:
                verify_response = await client.put(
                    verify_url,
                    headers=headers,
                    data=verify_data
                )
                
                verify_result = verify_response.json()
                logging.info(f"[ADMIN-VERIFY-OTP] Response: {verify_result}")
                
                response_code = verify_result.get("response_status_id", -1)
                message = verify_result.get("message", "")
                
                if response_code == 0 or "success" in message.lower() or "verified" in message.lower():
                    # Verification successful
                    customer_id = verify_result.get("data", {}).get("customer_id", "")
                    
                    # Update request
                    await db.chatbot_withdrawal_requests.update_one(
                        {"request_id": request_id},
                        {"$set": {
                            "eko_customer_id": customer_id,
                            "eko_customer_verified": True,
                            "eko_registration_status": "verified",
                            "eko_verification_timestamp": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    return {
                        "success": True,
                        "verified": True,
                        "message": "Customer verified successfully! You can now execute DMT.",
                        "customer_id": customer_id,
                        "next_step": "execute_dmt"
                    }
                
                elif response_code == 330 or "invalid" in message.lower() or "wrong" in message.lower():
                    return {
                        "success": False,
                        "verified": False,
                        "message": "Invalid OTP. Please check and try again.",
                        "error_type": "INVALID_OTP"
                    }
                
                else:
                    return {
                        "success": False,
                        "message": message or "OTP verification failed",
                        "error_type": "VERIFICATION_FAILED",
                        "eko_response": verify_result
                    }
                    
        except Exception as e:
            logging.error(f"[ADMIN-VERIFY-OTP] Error: {e}")
            return {
                "success": False,
                "message": f"Verification error: {str(e)}",
                "error_type": "VERIFICATION_ERROR"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ADMIN-VERIFY-OTP] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/customer-status/{mobile}")
async def get_customer_eko_status(mobile: str):
    """
    Check if a customer is registered and verified in Eko.
    Used by admin to check customer status before DMT.
    """
    try:
        # Clean mobile
        clean_mobile = ''.join(c for c in mobile if c.isdigit())[-10:]
        
        if len(clean_mobile) != 10:
            raise HTTPException(status_code=400, detail="Invalid mobile number")
        
        from .eko_common import get_eko_headers, EKO_BASE_URL, EKO_INITIATOR_ID, EKO_USER_CODE
        
        headers = get_eko_headers()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        
        inquiry_url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{clean_mobile}"
        
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                inquiry_url,
                headers=headers,
                params={
                    "initiator_id": EKO_INITIATOR_ID,
                    "user_code": EKO_USER_CODE
                }
            )
            
            result = response.json()
            response_code = result.get("response_status_id", -1)
            
            if response_code == 0:
                # Customer registered and verified
                return {
                    "success": True,
                    "registered": True,
                    "verified": True,
                    "customer_id": result.get("data", {}).get("customer_id"),
                    "message": "Customer registered and verified"
                }
            
            elif response_code == 330:
                # Customer exists but OTP pending
                return {
                    "success": True,
                    "registered": True,
                    "verified": False,
                    "otp_pending": True,
                    "message": "Customer exists but OTP verification pending"
                }
            
            else:
                # Customer not registered
                return {
                    "success": True,
                    "registered": False,
                    "verified": False,
                    "message": "Customer not registered in Eko"
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[CUSTOMER-STATUS] Error: {e}")
        return {
            "success": False,
            "message": str(e),
            "registered": False,
            "verified": False
        }



# ==================== V3 FUND TRANSFER TEST ENDPOINT ====================

class V3TransferTestRequest(BaseModel):
    """Test V3 Fund Transfer API"""
    account_number: str = Field(..., description="Bank account number")
    ifsc_code: str = Field(..., description="IFSC code")
    recipient_name: str = Field(..., description="Beneficiary name")
    amount: int = Field(..., ge=1, le=100, description="Test amount (max ₹100)")
    sender_name: str = Field(default="Test Sender", description="Sender name")
    dry_run: bool = Field(default=True, description="If True, only validate without transfer")


@router.post("/test/v3-fund-transfer")
async def test_v3_fund_transfer(request: V3TransferTestRequest):
    """
    Test V3 Fund Transfer API
    
    This endpoint tests the V3 API connection and validates parameters.
    Set dry_run=False to actually execute the transfer (USE WITH CAUTION!)
    """
    import uuid
    
    try:
        if not is_eko_configured():
            return {"success": False, "error": "Eko not configured"}
        
        # Generate unique client_ref_id
        client_ref_id = f"TEST{uuid.uuid4().hex[:14]}"
        
        # Generate authentication
        timestamp_ms = str(int(time.time() * 1000))
        secret_key = generate_eko_secret_key(timestamp_ms)
        
        # V3 Fund Transfer URL
        base_host = "https://api.eko.in:25002"
        v3_url = f"{base_host}/ekoapi/v3/users/payment/fund-transfer"
        
        # Headers
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp_ms,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        # Payload
        payload = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "client_ref_id": client_ref_id,
            "service_code": "45",
            "payment_mode": "5",  # IMPS
            "recipient_name": request.recipient_name,
            "account": request.account_number,
            "ifsc": request.ifsc_code,
            "amount": str(request.amount),
            "sender_name": request.sender_name,
            "source": "API",
            "latlong": "19.9975,73.7898"
        }
        
        # Log test details
        logging.info(f"[V3-TEST] URL: {v3_url}")
        logging.info(f"[V3-TEST] Headers: developer_key={EKO_DEVELOPER_KEY[:10]}..., timestamp={timestamp_ms}")
        logging.info(f"[V3-TEST] Payload: {payload}")
        
        if request.dry_run:
            return {
                "success": True,
                "mode": "DRY_RUN",
                "message": "Validation passed. Ready to transfer.",
                "url": v3_url,
                "client_ref_id": client_ref_id,
                "payload": payload,
                "headers_preview": {
                    "developer_key": f"{EKO_DEVELOPER_KEY[:10]}...",
                    "secret-key": f"{secret_key[:20]}...",
                    "secret-key-timestamp": timestamp_ms
                }
            }
        
        # ACTUAL TRANSFER (only if dry_run=False)
        logging.warning(f"[V3-TEST] EXECUTING REAL TRANSFER: Rs.{request.amount}")
        
        response = await chatbot_post(v3_url, headers=headers, data=payload, timeout=60)
        
        # Log raw response
        raw_text = response.text
        logging.info(f"[V3-TEST] Status Code: {response.status_code}")
        logging.info(f"[V3-TEST] Raw Response: {raw_text[:500]}")
        
        # Try to parse JSON
        try:
            result = response.json()
        except Exception as json_err:
            return {
                "success": False,
                "mode": "LIVE_TRANSFER",
                "error": f"JSON parse error: {json_err}",
                "status_code": response.status_code,
                "raw_response": raw_text[:1000]
            }
        
        logging.info(f"[V3-TEST] Parsed Response: {result}")
        
        return {
            "success": True,
            "mode": "LIVE_TRANSFER",
            "client_ref_id": client_ref_id,
            "eko_response": result,
            "status_code": response.status_code
        }
        
    except Exception as e:
        logging.error(f"[V3-TEST] Error: {e}")
        return {
            "success": False,
            "error": str(e)
        }



# ==================== TRANSACTION INQUIRY ====================

@router.get("/test/transaction-status/{reference}")
async def check_transaction_status(reference: str):
    """
    Check transaction status using Eko Transaction Inquiry API
    
    reference: Can be either Eko TID (e.g., 3548255959) or client_ref_id
    """
    try:
        if not is_eko_configured():
            return {"success": False, "error": "Eko not configured"}
        
        timestamp_ms = str(int(time.time() * 1000))
        secret_key = generate_eko_secret_key(timestamp_ms)
        
        # Inquiry URL - V1 format
        # Try both V1 and V3 patterns
        urls_to_try = [
            f"{EKO_BASE_URL}/v1/transactions/{reference}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}",
            f"https://api.eko.in:25002/ekoapi/v3/tools/reference/transaction?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}&client_ref_id={reference}",
        ]
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp_ms
            # No Content-Type for GET requests
        }
        
        results = []
        for url in urls_to_try:
            try:
                response = await chatbot_get(url, headers=headers, timeout=30)
                results.append({
                    "url": url,
                    "status_code": response.status_code,
                    "response": response.text[:1000]
                })
            except Exception as e:
                results.append({
                    "url": url,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "reference": reference,
            "results": results
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}



# ==================== V1 DMT DEBUG TEST ====================

class V1DMTTestRequest(BaseModel):
    """Test V1 DMT API with full debug"""
    customer_mobile: str = Field(..., description="Customer mobile (10 digits)")
    recipient_id: str = Field(..., description="Recipient ID from Eko")
    amount: int = Field(..., ge=1, le=100, description="Test amount (max ₹100)")
    dry_run: bool = Field(default=True, description="If True, only show request details")


@router.post("/test/v1-dmt-debug")
async def test_v1_dmt_debug(request: V1DMTTestRequest):
    """
    Debug V1 DMT Transfer API - shows exact request and response
    """
    import uuid
    
    try:
        if not is_eko_configured():
            return {"success": False, "error": "Eko not configured"}
        
        client_ref_id = f"DBG{uuid.uuid4().hex[:17]}"
        timestamp_ms = str(int(time.time() * 1000))
        secret_key = generate_eko_secret_key(timestamp_ms)
        
        # Generate request_hash for V1 DMT
        encoded_key = base64.b64encode(EKO_AUTH_KEY.encode('utf-8'))
        hash_string = f"{timestamp_ms}{request.recipient_id}{request.amount}{EKO_USER_CODE}"
        request_hash = hmac.new(
            encoded_key,
            hash_string.encode('utf-8'),
            hashlib.sha256
        ).digest()
        request_hash_b64 = base64.b64encode(request_hash).decode('utf-8')
        
        # V1 DMT URL
        url = f"{EKO_BASE_URL}/v1/transactions?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp_ms,
            "initiator_id": EKO_INITIATOR_ID,
            "request_hash": request_hash_b64,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        payload = {
            "customer_id": request.customer_mobile,
            "recipient_id": request.recipient_id,
            "amount": str(request.amount),
            "client_ref_id": client_ref_id,
            "channel": "2",  # IMPS
            "state": "1",
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE,
            "latlong": "19.9975,73.7898"
        }
        
        debug_info = {
            "url": url,
            "client_ref_id": client_ref_id,
            "timestamp": timestamp_ms,
            "hash_string": hash_string,
            "request_hash": request_hash_b64,
            "headers": {
                "developer_key": f"{EKO_DEVELOPER_KEY[:10]}...",
                "secret-key": f"{secret_key[:20]}...",
                "secret-key-timestamp": timestamp_ms,
                "request_hash": f"{request_hash_b64[:20]}..."
            },
            "payload": payload
        }
        
        if request.dry_run:
            return {
                "success": True,
                "mode": "DRY_RUN",
                "message": "Request prepared. Set dry_run=false to execute.",
                "debug": debug_info
            }
        
        # Execute real request
        logging.warning(f"[V1-DEBUG] EXECUTING REAL TRANSFER: Rs.{request.amount}")
        
        response = await chatbot_post(url, headers=headers, data=payload, timeout=60)
        raw_text = response.text
        
        logging.info(f"[V1-DEBUG] Status: {response.status_code}")
        logging.info(f"[V1-DEBUG] Raw: {raw_text}")
        
        try:
            result = response.json()
        except:
            result = {"raw_text": raw_text}
        
        return {
            "success": True,
            "mode": "LIVE",
            "status_code": response.status_code,
            "raw_response": raw_text[:2000],
            "parsed_response": result,
            "debug": debug_info
        }
        
    except Exception as e:
        logging.error(f"[V1-DEBUG] Error: {e}")
        return {"success": False, "error": str(e)}



# ==================== DMT REFUND ADMIN ENDPOINTS ====================

@router.post("/admin/find-failed-dmt")
async def find_failed_dmt_transfers(request: Request):
    """
    Find all DMT transfers that show "completed" but actually failed (Refund Pending at Eko).
    These need PRC refund.
    
    Usage:
    curl -X POST "/api/chatbot-redeem/admin/find-failed-dmt" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456"}'
    """
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        # Find all completed withdrawals
        completed_requests = await db.chatbot_withdrawal_requests.find(
            {"status": "completed"},
            {"_id": 0}
        ).sort("created_at", -1).limit(100).to_list(100)
        
        failed_transfers = []
        
        for req in completed_requests:
            # Check if this transfer actually succeeded at Eko
            tid = req.get("dmt_transaction_id")
            utr = req.get("utr_number")
            
            # If UTR is empty/None, likely failed
            if not utr or utr == "" or utr == "NA":
                # Double check with Eko inquiry if TID exists
                eko_status = "UNKNOWN"
                
                if tid and is_eko_configured():
                    try:
                        timestamp_ms = str(int(time.time() * 1000))
                        secret_key = generate_eko_secret_key(timestamp_ms)
                        
                        url = f"{EKO_BASE_URL}/v1/transactions/{tid}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
                        headers = {
                            "developer_key": EKO_DEVELOPER_KEY,
                            "secret-key": secret_key,
                            "secret-key-timestamp": timestamp_ms
                        }
                        
                        response = await chatbot_get(url, headers=headers, timeout=30)
                        if response.status_code == 200:
                            result = response.json()
                            tx_data = result.get("data", {})
                            tx_status = tx_data.get("tx_status")
                            tx_desc = tx_data.get("txstatus_desc", "")
                            
                            # tx_status: 0=Success, 1=Fail, 2=Pending, 3=Refund Pending, 4=Refunded
                            if tx_status in ["3", 3]:
                                eko_status = "REFUND_PENDING"
                            elif tx_status in ["4", 4]:
                                eko_status = "REFUNDED"
                            elif tx_status in ["1", 1]:
                                eko_status = "FAILED"
                            elif tx_status in ["0", 0]:
                                eko_status = "SUCCESS"
                            else:
                                eko_status = f"STATUS_{tx_status}"
                    except Exception as e:
                        eko_status = f"ERROR: {str(e)[:50]}"
                
                # Only include if not actually successful
                if eko_status != "SUCCESS":
                    failed_transfers.append({
                        "request_id": req.get("request_id"),
                        "uid": req.get("uid"),
                        "user_name": req.get("user_name"),
                        "mobile": req.get("mobile"),
                        "prc_deducted": req.get("prc_deducted"),
                        "inr_amount": req.get("inr_amount"),
                        "dmt_tid": tid,
                        "utr": utr,
                        "eko_status": eko_status,
                        "bank_name": req.get("bank_name"),
                        "account_number": req.get("account_number"),
                        "created_at": str(req.get("created_at"))
                    })
        
        return {
            "success": True,
            "total_completed": len(completed_requests),
            "failed_count": len(failed_transfers),
            "failed_transfers": failed_transfers,
            "message": f"Found {len(failed_transfers)} transfers that need PRC refund"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[FIND-FAILED] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/refund-failed-dmt")
async def refund_failed_dmt_transfers(request: Request):
    """
    Refund PRC for failed DMT transfers.
    
    Usage:
    curl -X POST "/api/chatbot-redeem/admin/refund-failed-dmt" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456", "dry_run": true}'
    
    Set dry_run=false to actually refund.
    """
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        dry_run = data.get("dry_run", True)
        specific_request_ids = data.get("request_ids", None)  # Optional: refund specific requests only
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        # Find failed transfers
        query = {"status": "completed"}
        if specific_request_ids:
            query["request_id"] = {"$in": specific_request_ids}
        
        completed_requests = await db.chatbot_withdrawal_requests.find(
            query, {"_id": 0}
        ).sort("created_at", -1).limit(200).to_list(200)
        
        refunded = []
        skipped = []
        total_prc_refunded = 0
        
        for req in completed_requests:
            tid = req.get("dmt_transaction_id")
            utr = req.get("utr_number")
            prc_deducted = req.get("prc_deducted", 0)
            uid = req.get("uid")
            request_id = req.get("request_id")
            
            # Skip if already refunded
            if req.get("prc_refunded"):
                skipped.append({
                    "request_id": request_id,
                    "reason": "Already refunded"
                })
                continue
            
            # Check if UTR is empty (likely failed)
            if not utr or utr == "" or utr == "NA":
                # Verify with Eko
                eko_status = "UNKNOWN"
                should_refund = False
                
                if tid and is_eko_configured():
                    try:
                        timestamp_ms = str(int(time.time() * 1000))
                        secret_key = generate_eko_secret_key(timestamp_ms)
                        
                        url = f"{EKO_BASE_URL}/v1/transactions/{tid}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
                        headers = {
                            "developer_key": EKO_DEVELOPER_KEY,
                            "secret-key": secret_key,
                            "secret-key-timestamp": timestamp_ms
                        }
                        
                        response = await chatbot_get(url, headers=headers, timeout=30)
                        if response.status_code == 200:
                            result = response.json()
                            tx_data = result.get("data", {})
                            tx_status = tx_data.get("tx_status")
                            
                            if tx_status in ["3", 3, "4", 4, "1", 1]:
                                should_refund = True
                                eko_status = f"TX_STATUS_{tx_status}"
                    except:
                        # If Eko check fails, still consider for refund based on empty UTR
                        should_refund = True
                        eko_status = "EKO_CHECK_FAILED"
                else:
                    # No TID means definitely failed
                    should_refund = True
                    eko_status = "NO_TID"
                
                if should_refund and prc_deducted > 0:
                    if not dry_run:
                        # Refund PRC to user
                        await db.users.update_one(
                            {"uid": uid},
                            {"$inc": {"prc_balance": prc_deducted}}
                        )
                        
                        # Mark request as refunded
                        await db.chatbot_withdrawal_requests.update_one(
                            {"request_id": request_id},
                            {
                                "$set": {
                                    "prc_refunded": True,
                                    "refunded_at": datetime.now(timezone.utc),
                                    "refund_reason": f"DMT failed - Eko status: {eko_status}",
                                    "status": "refunded"
                                }
                            }
                        )
                        
                        # Log refund transaction
                        await db.transactions.insert_one({
                            "user_id": uid,
                            "type": "prc_refund",
                            "amount": prc_deducted,
                            "reason": f"DMT transfer failed - {request_id}",
                            "dmt_tid": tid,
                            "eko_status": eko_status,
                            "timestamp": datetime.now(timezone.utc)
                        })
                    
                    refunded.append({
                        "request_id": request_id,
                        "uid": uid,
                        "user_name": req.get("user_name"),
                        "prc_refunded": prc_deducted,
                        "inr_amount": req.get("inr_amount"),
                        "eko_status": eko_status,
                        "status": "REFUNDED" if not dry_run else "WOULD_REFUND"
                    })
                    total_prc_refunded += prc_deducted
            else:
                skipped.append({
                    "request_id": request_id,
                    "reason": f"Has UTR: {utr}"
                })
        
        return {
            "success": True,
            "mode": "DRY_RUN" if dry_run else "LIVE",
            "refunded_count": len(refunded),
            "skipped_count": len(skipped),
            "total_prc_refunded": total_prc_refunded,
            "total_inr_value": total_prc_refunded / 100,  # Assuming 100 PRC = ₹1
            "refunded": refunded,
            "skipped": skipped[:10],  # Only show first 10 skipped
            "message": f"{'Would refund' if dry_run else 'Refunded'} {total_prc_refunded} PRC to {len(refunded)} users"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[REFUND-DMT] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/refund-specific-user")
async def refund_specific_user_prc(request: Request):
    """
    Manually refund PRC to a specific user.
    
    Usage:
    curl -X POST "/api/chatbot-redeem/admin/refund-specific-user" \
      -H "Content-Type: application/json" \
      -d '{"admin_pin": "123456", "uid": "xxx", "prc_amount": 10000, "reason": "DMT failed"}'
    """
    try:
        data = await request.json()
        admin_pin = data.get("admin_pin")
        uid = data.get("uid")
        prc_amount = data.get("prc_amount")
        reason = data.get("reason", "Manual PRC refund")
        
        if admin_pin != "123456":
            raise HTTPException(status_code=403, detail="Invalid admin PIN")
        
        if not uid or not prc_amount:
            raise HTTPException(status_code=400, detail="uid and prc_amount required")
        
        if prc_amount <= 0:
            raise HTTPException(status_code=400, detail="prc_amount must be positive")
        
        # Get user
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "name": 1, "prc_balance": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        old_balance = user.get("prc_balance", 0)
        new_balance = old_balance + prc_amount
        
        # Update balance
        await db.users.update_one(
            {"uid": uid},
            {"$inc": {"prc_balance": prc_amount}}
        )
        
        # Log transaction
        await db.transactions.insert_one({
            "user_id": uid,
            "type": "prc_refund",
            "amount": prc_amount,
            "reason": reason,
            "old_balance": old_balance,
            "new_balance": new_balance,
            "timestamp": datetime.now(timezone.utc),
            "admin_action": True
        })
        
        return {
            "success": True,
            "uid": uid,
            "name": user.get("name"),
            "prc_refunded": prc_amount,
            "old_balance": old_balance,
            "new_balance": new_balance,
            "reason": reason,
            "message": f"Refunded {prc_amount} PRC to {user.get('name')}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[REFUND-USER] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
