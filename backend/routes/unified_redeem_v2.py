"""
Unified Redeem System v2 - Complete Rewrite
=============================================
PhonePe-style unified interface for all Eko services:
- Mobile Recharge
- DTH Recharge
- Electricity Bill
- Gas Bill (PNG)
- EMI Payment
- DMT (Money Transfer to Bank)

Features:
- Admin approval workflow for all transactions
- New charging logic: Eko charge + ₹10 flat + 20% admin charge
- Advanced admin dashboard with filters & pagination
- Eko API integration for actual payments
- Error monitoring & payment event logging
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging
import uuid
import os
import httpx
import hashlib
import hmac
import base64

# Import error monitoring functions
try:
    from routes.error_monitor import log_error, log_payment_event
except ImportError:
    # Fallback if import fails
    async def log_error(*args, **kwargs): pass
    async def log_payment_event(*args, **kwargs): pass

# Import redeem limit check function
check_redeem_limit_func = None

def set_redeem_limit_check(func):
    """Set the redeem limit check function from server.py"""
    global check_redeem_limit_func
    check_redeem_limit_func = func
import time
import json

# Import WalletService for ledger-based PRC operations (Phase 2 Architecture)
# Using V2 with dual ledger support (ledger + prc_ledger)
from app.services.wallet_service_v2 import WalletServiceV2 as WalletService

# Import TaskQueue for auto-retry functionality (Phase 4 Architecture)
from app.services import TaskQueue

router = APIRouter(prefix="/redeem", tags=["Unified Redeem v2"])

# Database reference
db = None

def set_db(database):
    global db
    db = database

# ==================== EKO CONFIGURATION ====================

EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")

# ==================== AUTO-RETRY CONFIGURATION ====================

# Enable/disable auto-retry for failed transactions
BBPS_AUTO_RETRY_ENABLED = os.environ.get("BBPS_AUTO_RETRY_ENABLED", "true").lower() == "true"

# Maximum retry attempts before giving up
BBPS_MAX_RETRIES = int(os.environ.get("BBPS_MAX_RETRIES", "3"))

# Delay before first retry (in seconds)
BBPS_RETRY_DELAY = int(os.environ.get("BBPS_RETRY_DELAY", "60"))

# Service types eligible for auto-retry (empty = all)
BBPS_RETRY_ELIGIBLE_SERVICES = ["electricity", "mobile_postpaid", "dth", "fastag", "broadband"]

def generate_eko_secret_key(timestamp: str) -> str:
    """Generate secret key for Eko API authentication"""
    key = EKO_AUTHENTICATOR_KEY
    encoded_key = base64.b64encode(key.encode()).decode()
    signature = hmac.new(
        encoded_key.encode(),
        timestamp.encode(),
        hashlib.sha256
    ).digest()
    return base64.b64encode(signature).decode()

def generate_eko_request_hash(timestamp: str, utility_acc_no: str, amount: str, user_code: str) -> str:
    """Generate request hash for Eko API"""
    key = EKO_AUTHENTICATOR_KEY
    encoded_key = base64.b64encode(key.encode()).decode()
    data = f"{timestamp}{utility_acc_no}{amount}{user_code}"
    signature = hmac.new(
        encoded_key.encode(),
        data.encode(),
        hashlib.sha256
    ).digest()
    return base64.b64encode(signature).decode()

# ==================== CONSTANTS ====================

# Service Types - All BBPS Services
SERVICE_TYPES = {
    # Recharge Services
    "mobile_recharge": {"name": "Mobile Recharge", "icon": "smartphone", "category": 5},
    "mobile_postpaid": {"name": "Mobile Postpaid", "icon": "phone", "category": 6},
    "dth": {"name": "DTH Recharge", "icon": "tv", "category": 4},
    
    # Utility Bills
    "electricity": {"name": "Electricity Bill", "icon": "zap", "category": 8},
    "gas": {"name": "Gas Bill (PNG)", "icon": "flame", "category": 2},
    "water": {"name": "Water Bill", "icon": "droplet", "category": 7},
    
    # Telecom
    "broadband": {"name": "Broadband Bill", "icon": "wifi", "category": 9},
    "landline": {"name": "Landline Bill", "icon": "phone-call", "category": 10},
    
    # Financial Services
    "emi": {"name": "EMI Payment", "icon": "building", "category": 21},
    "credit_card": {"name": "Credit Card Bill", "icon": "credit-card", "category": 15},
    "insurance": {"name": "Insurance Premium", "icon": "shield", "category": 12},
    
    # Transport & Others
    "fastag": {"name": "FASTag Recharge", "icon": "car", "category": 11},
    "education": {"name": "Education Fees", "icon": "graduation-cap", "category": 18},
    "cable_tv": {"name": "Cable TV", "icon": "monitor", "category": 14},
    "municipal_tax": {"name": "Municipal Tax", "icon": "landmark", "category": 17},
    "housing_society": {"name": "Housing Society", "icon": "home", "category": 19},
    "lpg": {"name": "LPG Cylinder Booking", "icon": "cylinder", "category": 3},
    
    # Money Transfer
    "dmt": {"name": "Bank Transfer (DMT)", "icon": "banknote", "category": 0}
}

# Charging Logic
PLATFORM_FEE = 10  # ₹10 flat fee
ADMIN_CHARGE_PERCENT = 20  # 20% of transaction amount
PRC_RATE = 10  # 10 PRC = ₹1

# Status Flow
STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_REJECTED = "rejected"


# ==================== EKO API FUNCTIONS ====================

async def get_eko_balance() -> dict:
    """Get Eko wallet balance"""
    try:
        timestamp = str(int(datetime.now().timestamp() * 1000))
        secret_key = generate_eko_secret_key(timestamp)
        
        url = f"{EKO_BASE_URL}/v1/user/balance"
        params = {
            "initiator_id": EKO_INITIATOR_ID,
            "user_code": EKO_USER_CODE
        }
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params, headers=headers)
            data = response.json()
            
            if data.get("status") == 0 or data.get("response_status_id") == 0:
                return {
                    "success": True,
                    "balance": data.get("data", {}).get("balance", 0),
                    "locked_amount": data.get("data", {}).get("locked_amount", 0)
                }
            else:
                return {
                    "success": False,
                    "balance": 0,
                    "error": data.get("message", "Failed to get balance")
                }
    except Exception as e:
        logging.error(f"Eko balance error: {str(e)}")
        return {"success": False, "balance": 0, "error": str(e)}


async def execute_eko_recharge(request_doc: dict) -> dict:
    """
    Execute recharge/bill payment via Eko BBPS API
    
    UPDATED: Now uses the verified working bbps_services.py pay_bill function
    which was tested successfully in production.
    
    Reference: /api/bbps/pay endpoint
    """
    try:
        details = request_doc.get("details", {})
        service_type = request_doc.get("service_type", "mobile_recharge")
        amount = str(int(request_doc["amount_inr"]))
        sender_name = request_doc.get("user_name", "ParasReward")
        user_mobile = request_doc.get("user_mobile", "9999999999")
        
        # Get utility_acc_no based on service type
        if service_type == "emi":
            utility_acc_no = details.get("loan_account", "")
        elif service_type == "mobile_recharge":
            utility_acc_no = details.get("mobile_number", "")
        elif service_type == "mobile_postpaid":
            utility_acc_no = details.get("mobile_number", "")
        elif service_type == "credit_card":
            utility_acc_no = details.get("card_number", "") or details.get("consumer_number", "")
        elif service_type == "insurance":
            utility_acc_no = details.get("policy_number", "") or details.get("consumer_number", "")
        elif service_type == "fastag":
            utility_acc_no = details.get("vehicle_number", "") or details.get("fastag_id", "") or details.get("consumer_number", "")
        elif service_type == "education":
            utility_acc_no = details.get("student_id", "") or details.get("enrollment_number", "") or details.get("consumer_number", "")
        elif service_type == "lpg":
            utility_acc_no = details.get("lpg_id", "") or details.get("consumer_number", "")
        elif service_type in ["dth", "electricity", "gas", "water", "broadband", "landline", "cable_tv", "municipal_tax", "housing_society"]:
            utility_acc_no = details.get("consumer_number", "")
        else:
            utility_acc_no = details.get("mobile_number") or details.get("consumer_number") or details.get("loan_account") or ""
        
        # Get operator_id
        operator = str(details.get("operator_id") or details.get("operator", ""))
        
        if not utility_acc_no:
            return {
                "success": False,
                "status": "FAILED",
                "message": f"Missing account/consumer number for {service_type}"
            }
        
        if not operator:
            return {
                "success": False,
                "status": "FAILED",
                "message": f"Missing operator for {service_type}"
            }
        
        logging.info(f"[BBPS-INSTANT] Executing {service_type}: account={utility_acc_no[-4:] if utility_acc_no else 'NA'}, operator={operator}, amount={amount}")
        
        # Import the working BBPS pay function
        from routes.bbps_services import pay_bill, PayBillRequest
        
        # Create request object
        pay_request = PayBillRequest(
            operator_id=operator,
            account=utility_acc_no,
            amount=amount,
            mobile=user_mobile if len(user_mobile) == 10 else "9999999999",
            sender_name=sender_name or "Customer"
        )
        
        # Execute payment via verified BBPS API
        result = await pay_bill(pay_request)
        
        logging.info(f"[BBPS-INSTANT] Result: success={result.get('success')}, status={result.get('status')}, tid={result.get('tid')}")
        
        # Handle response
        if result.get("success"):
            return {
                "success": True,
                "status": result.get("status", "SUCCESS"),
                "eko_tid": result.get("tid"),
                "utr": result.get("bbps_ref", ""),
                "message": result.get("user_message") or result.get("message") or f"{service_type} payment successful"
            }
        else:
            # Check for pending/processing status
            if result.get("tx_status") == 2 or result.get("status") == "PENDING":
                return {
                    "success": True,
                    "status": "PROCESSING",
                    "eko_tid": result.get("tid"),
                    "message": "Payment is being processed. Please check status later."
                }
            
            return {
                "success": False,
                "status": "FAILED",
                "error_code": result.get("error_code"),
                "message": result.get("user_message") or result.get("message") or "Transaction failed"
            }
            
    except Exception as e:
        logging.error(f"[BBPS-INSTANT] Recharge error: {str(e)}")
        import traceback
        logging.error(f"[BBPS-INSTANT] Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e)
        }


async def execute_eko_bbps(request_doc: dict, service_type: str) -> dict:
    """
    Execute BBPS Bill Payment via Eko API
    Works for: Electricity, Gas, DTH, EMI, Postpaid
    
    Uses same auth as mobile recharge which is verified working.
    """
    import requests as req
    
    try:
        details = request_doc.get("details", {})
        amount = str(int(request_doc["amount_inr"]))
        
        # Get consumer/utility account number based on service type
        if service_type == "emi":
            utility_acc_no = details.get("loan_account", "")
        elif service_type == "mobile_recharge" and details.get("recharge_type") == "postpaid":
            utility_acc_no = details.get("mobile_number", "")
        else:
            utility_acc_no = details.get("consumer_number", "")
        
        operator_id = str(details.get("operator_id") or details.get("operator", ""))
        
        if not utility_acc_no or not operator_id:
            return {
                "success": False,
                "status": "FAILED",
                "message": f"Missing required details: utility_acc_no={utility_acc_no}, operator_id={operator_id}"
            }
        
        # Generate authentication (same as working mobile recharge)
        timestamp = str(int(time.time() * 1000))
        encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode()).decode()
        secret_key = base64.b64encode(
            hmac.new(encoded_key.encode(), timestamp.encode(), hashlib.sha256).digest()
        ).decode()
        
        # Generate request_hash
        user_code = EKO_USER_CODE
        concat_str = timestamp + utility_acc_no + amount + user_code
        request_hash = base64.b64encode(
            hmac.new(encoded_key.encode(), concat_str.encode(), hashlib.sha256).digest()
        ).decode()
        
        # Build request
        client_ref_id = f"{service_type.upper()[:3]}{int(time.time())}"
        
        url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"
        
        body = {
            "source_ip": "34.44.149.98",
            "user_code": user_code,
            "amount": amount,
            "client_ref_id": client_ref_id,
            "utility_acc_no": utility_acc_no,
            "confirmation_mobile_no": EKO_INITIATOR_ID,
            "sender_name": request_doc.get("user_name", "ParasReward"),
            "operator_id": operator_id,
            "latlong": "19.0760,72.8777"
        }
        
        # Add hc_channel for high commission (optional)
        body["hc_channel"] = "1"
        
        headers = {
            "developer_key": EKO_DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "request_hash": request_hash,
            "Content-Type": "application/json"
        }
        
        # Use json.dumps with separators (VERIFIED WORKING FORMAT)
        body_json = json.dumps(body, separators=(',', ':'))
        
        logging.info(f"[BBPS-{service_type}] URL: {url}")
        logging.info(f"[BBPS-{service_type}] Operator: {operator_id}, Account: {utility_acc_no[-4:] if utility_acc_no else 'NA'}, Amount: {amount}")
        
        # Make request (use data=body_json, NOT json=body)
        response = req.post(url, headers=headers, data=body_json, timeout=60)
        
        # Handle response
        if response.status_code == 403:
            logging.error(f"[BBPS-{service_type}] 403 Forbidden - IP may not be whitelisted")
            return {
                "success": False,
                "status": "FAILED",
                "error_code": "403",
                "message": "Access denied. Please ensure server IP is whitelisted with Eko."
            }
        
        try:
            result = response.json()
        except:
            logging.error(f"[BBPS-{service_type}] Non-JSON response: {response.text[:200]}")
            return {
                "success": False,
                "status": "FAILED",
                "error_code": str(response.status_code),
                "message": f"Invalid API response (HTTP {response.status_code})"
            }
        
        logging.info(f"[BBPS-{service_type}] Response: status={result.get('status')}, message={result.get('message')}")
        
        # Check success
        eko_status = result.get("status")
        tx_status = result.get("data", {}).get("tx_status")
        eko_tid = result.get("data", {}).get("tid")
        bbps_ref = result.get("data", {}).get("bbpstrxnrefid")
        
        # Status 0 = Success
        if eko_status == 0:
            return {
                "success": True,
                "status": "SUCCESS",
                "eko_tid": eko_tid,
                "utr": bbps_ref,
                "client_ref_id": client_ref_id,
                "message": result.get("message", f"{service_type} payment successful")
            }
        # tx_status 2 = Processing/Pending
        elif tx_status == 2:
            return {
                "success": True,
                "status": "PROCESSING",
                "eko_tid": eko_tid,
                "client_ref_id": client_ref_id,
                "message": "Payment initiated and processing"
            }
        else:
            # Get proper error message
            error_msg = result.get("message", "Transaction failed")
            return {
                "success": False,
                "status": "FAILED",
                "error_code": str(eko_status),
                "eko_tid": eko_tid,
                "message": error_msg
            }
            
    except Exception as e:
        logging.error(f"[BBPS-{service_type}] Error: {str(e)}")
        import traceback
        logging.error(f"[BBPS-{service_type}] Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "status": "FAILED",
            "message": f"Payment processing error: {str(e)}"
        }


async def execute_eko_dmt(request_doc: dict) -> dict:
    """
    Execute DMT (Bank Transfer) via Eko v3 API
    
    DMT v3 Flow:
    1. Check/Create Customer
    2. Add Recipient (if new)
    3. Execute Transfer via /ekoapi/v3/transactions
    
    request_hash formula: timestamp + customer_id + recipient_id + amount + client_ref_id
    """
    try:
        from routes.eko_payments import execute_dmt_transfer_v3
        
        details = request_doc.get("details", {})
        amount = int(request_doc["amount_inr"])
        
        # Extract DMT details from frontend
        account_number = details.get("account_number", "")
        ifsc_code = details.get("ifsc_code", "")
        account_holder = details.get("account_holder", "")
        mobile = details.get("mobile", "")
        bank_name = details.get("bank_name", "")
        
        logging.info(f"[DMT] Starting Transfer: ₹{amount} to {account_holder}")
        
        # For DMT v3:
        # customer_id = sender's mobile number
        # recipient_id = needs to be retrieved/created first via add recipient API
        
        # Since frontend doesn't have recipient_id yet,
        # we need to implement full DMT flow with:
        # 1. Customer verification
        # 2. Recipient add (get recipient_id)
        # 3. Then transfer
        
        # For now, return helpful message about DMT flow requirements
        return {
            "success": False,
            "status": "PENDING_SETUP",
            "message": "DMT requires customer verification and recipient setup. Please use the DMT flow: 1) Verify customer 2) Add recipient 3) Transfer",
            "details": {
                "account_number": account_number[-4:] if account_number else "",
                "ifsc": ifsc_code,
                "name": account_holder,
                "bank": bank_name,
                "amount": amount
            },
            "next_steps": [
                "POST /api/eko/dmt/v3/customer/{mobile} - Check customer",
                "POST /api/eko/dmt/v3/recipient/add - Add beneficiary",
                "POST /api/eko/dmt/v3/transfer - Execute transfer"
            ]
        }
        
    except Exception as e:
        logging.error(f"[DMT] Error: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        return {
            "success": False,
            "status": "FAILED",
            "message": str(e)
        }
        return {
            "success": False,
            "status": "FAILED",
            "message": f"DMT processing error: {str(e)}"
        }


# ==================== MODELS ====================

class RedeemRequestCreate(BaseModel):
    """Create a new redeem request"""
    user_id: str
    service_type: str  # mobile_recharge, dth, electricity, gas, emi, dmt
    amount: float = Field(..., gt=0, description="Transaction amount in INR")
    details: Dict[str, Any]  # Service-specific details
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "service_type": "mobile_recharge",
                "amount": 199,
                "details": {
                    "mobile_number": "9876543210",
                    "operator": "JIO",
                    "circle": "MH"
                }
            }
        }


class AdminApproveRequest(BaseModel):
    """Admin approval for redeem request"""
    request_id: str
    admin_id: str
    action: str = Field(..., pattern="^(approve|reject)$")
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class AdminCompleteRequest(BaseModel):
    """Admin marks transaction as completed (manual)"""
    request_id: str
    admin_id: str
    eko_tid: Optional[str] = None
    utr_number: Optional[str] = None
    completion_notes: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================

def calculate_charges(amount: float) -> dict:
    """
    Calculate all charges for a transaction
    
    Formula:
    - Platform Fee: ₹10 (flat)
    - Admin Charge: 20% of transaction amount
    - Total = Amount + Platform Fee + Admin Charge
    
    Note: Eko's service charge is included in the amount itself
    """
    amount_inr = float(amount)
    platform_fee = PLATFORM_FEE
    admin_charge = round(amount_inr * (ADMIN_CHARGE_PERCENT / 100))
    total_charges = platform_fee + admin_charge
    total_amount = amount_inr + total_charges
    
    return {
        "amount_inr": amount_inr,
        "platform_fee_inr": platform_fee,
        "admin_charge_inr": admin_charge,
        "admin_charge_percent": ADMIN_CHARGE_PERCENT,
        "total_charges_inr": total_charges,
        "total_amount_inr": total_amount,
        # PRC equivalents (10 PRC = ₹1)
        "amount_prc": int(amount_inr * PRC_RATE),
        "platform_fee_prc": platform_fee * PRC_RATE,
        "admin_charge_prc": admin_charge * PRC_RATE,
        "total_charges_prc": total_charges * PRC_RATE,
        "total_prc_required": int(total_amount * PRC_RATE)
    }


def generate_request_id() -> str:
    """Generate unique request ID"""
    return f"RDM{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def serialize_doc(doc: dict) -> dict:
    """Serialize MongoDB document for JSON response"""
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == "_id":
            result["id"] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value
    return result


# ==================== USER APIs ====================

@router.get("/services")
async def get_available_services():
    """Get all available redeem services"""
    services = []
    for service_id, info in SERVICE_TYPES.items():
        services.append({
            "id": service_id,
            "name": info["name"],
            "icon": info["icon"],
            "eko_category": info["category"]
        })
    return {
        "success": True,
        "services": services,
        "charges_info": {
            "platform_fee": f"₹{PLATFORM_FEE} (flat)",
            "admin_charge": f"{ADMIN_CHARGE_PERCENT}% of amount",
            "prc_rate": f"{PRC_RATE} PRC = ₹1"
        }
    }


@router.get("/calculate-charges")
async def calculate_charges_api(amount: float = Query(..., gt=0)):
    """
    Calculate charges for a given amount
    
    Returns breakdown of all charges including PRC equivalent
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    return {
        "success": True,
        "charges": calculate_charges(amount)
    }


@router.get("/admin/eko-balance")
async def get_admin_eko_balance():
    """Get Eko wallet balance for admin dashboard - uses existing Eko balance endpoint"""
    try:
        # Use existing make_eko_request from eko_payments
        from routes.eko_payments import make_eko_request
        
        result = await make_eko_request(
            f"/v1/customers/mobile_number:{EKO_INITIATOR_ID}/balance",
            method="GET"
        )
        
        balance_str = result.get("data", {}).get("balance", "0")
        try:
            balance = float(balance_str)
        except (ValueError, TypeError):
            balance = 0
            
        return {
            "success": True,
            "balance": balance,
            "currency": result.get("data", {}).get("currency", "INR"),
            "locked_amount": 0,
            "message": result.get("message")
        }
    except Exception as e:
        logging.error(f"Eko balance error: {str(e)}")
        return {"success": False, "balance": 0, "error": str(e)}



@router.get("/services")
async def get_available_services():
    """
    Get all available BBPS services with their details
    Used by frontend to dynamically render service options
    """
    services = []
    
    # Define which services are instant vs admin approval
    instant_services = [
        "mobile_recharge", "mobile_postpaid",
        "dth", "cable_tv",
        "electricity", "gas", "water",
        "broadband", "landline",
        "emi", "credit_card", "insurance",
        "fastag", "education", "municipal_tax", "housing_society", "lpg"
    ]
    
    for service_id, details in SERVICE_TYPES.items():
        services.append({
            "id": service_id,
            "name": details["name"],
            "icon": details["icon"],
            "category": details["category"],
            "is_instant": service_id in instant_services,
            "requires_admin": service_id not in instant_services,
            "fields": get_service_fields(service_id)
        })
    
    return {
        "success": True,
        "services": services,
        "total": len(services)
    }

def get_service_fields(service_type: str) -> list:
    """Get required input fields for each service type"""
    common_fields = [
        {"name": "amount", "label": "Amount (₹)", "type": "number", "required": True},
        {"name": "operator", "label": "Operator/Provider", "type": "select", "required": True}
    ]
    
    if service_type == "mobile_recharge":
        return [{"name": "mobile_number", "label": "Mobile Number", "type": "tel", "required": True}] + common_fields
    elif service_type == "mobile_postpaid":
        return [{"name": "mobile_number", "label": "Mobile Number", "type": "tel", "required": True}] + common_fields
    elif service_type in ["dth", "cable_tv"]:
        return [{"name": "consumer_number", "label": "Subscriber ID", "type": "text", "required": True}] + common_fields
    elif service_type in ["electricity", "water", "gas"]:
        return [{"name": "consumer_number", "label": "Consumer Number", "type": "text", "required": True}] + common_fields
    elif service_type in ["broadband", "landline"]:
        return [{"name": "consumer_number", "label": "Account Number", "type": "text", "required": True}] + common_fields
    elif service_type == "emi":
        return [{"name": "loan_account", "label": "Loan Account Number", "type": "text", "required": True}] + common_fields
    elif service_type == "credit_card":
        return [{"name": "card_number", "label": "Card Number (Last 4 digits)", "type": "text", "required": True}] + common_fields
    elif service_type == "insurance":
        return [{"name": "policy_number", "label": "Policy Number", "type": "text", "required": True}] + common_fields
    elif service_type == "fastag":
        return [{"name": "vehicle_number", "label": "Vehicle Number / FASTag ID", "type": "text", "required": True}] + common_fields
    elif service_type == "education":
        return [{"name": "student_id", "label": "Student ID / Enrollment No.", "type": "text", "required": True}] + common_fields
    elif service_type == "lpg":
        return [{"name": "lpg_id", "label": "LPG Consumer ID", "type": "text", "required": True}] + common_fields
    elif service_type in ["municipal_tax", "housing_society"]:
        return [{"name": "consumer_number", "label": "Property ID / Account No.", "type": "text", "required": True}] + common_fields
    else:
        return [{"name": "consumer_number", "label": "Account Number", "type": "text", "required": True}] + common_fields



@router.post("/request")
async def create_redeem_request(request: RedeemRequestCreate):
    """
    Create a new redeem request
    
    Flow:
    1. Check if emergency pause is active
    2. Check if within allowed time (8 AM to 8 PM IST)
    3. Validate user exists and has KYC verified
    4. Check PRC balance
    5. Deduct PRC from user wallet
    6. Create pending request for admin approval
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # EMERGENCY AUTO-PAUSE CHECK
    try:
        from routes.prc_economy import is_redeem_allowed
        allowed, reason = await is_redeem_allowed(db)
        if not allowed:
            raise HTTPException(
                status_code=503,
                detail=f"🚨 {reason}"
            )
    except ImportError:
        pass  # Module not available, continue
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logging.error(f"[REDEEM] Emergency check error: {e}")
        # On error, allow (fail-open)
    
    # GLOBAL REDEEM LIMIT CHECK (799*5*10 + 20% referral)
    if check_redeem_limit_func:
        try:
            limit_check = await check_redeem_limit_func(request.user_id, request.amount)
            if not limit_check.get("allowed"):
                limit_info = limit_check.get("limit_info", {})
                raise HTTPException(
                    status_code=403,
                    detail=f"Redeem limit exceeded. Your limit: ₹{limit_info.get('total_limit', 0):,.2f}, Used: ₹{limit_info.get('total_redeemed', 0):,.2f}, Remaining: ₹{limit_info.get('remaining_limit', 0):,.2f}"
                )
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"[REDEEM] Limit check error: {e}")
            # On error, allow (fail-open)
        # On error, allow (fail-open)
    
    # Check time restriction (8 AM to 8 PM IST) - TEMPORARILY DISABLED FOR TESTING
    # from datetime import timezone, timedelta
    # ist = timezone(timedelta(hours=5, minutes=30))
    # current_time = datetime.now(ist)
    # current_hour = current_time.hour
    # 
    # if current_hour < 8 or current_hour >= 20:
    #     raise HTTPException(
    #         status_code=503, 
    #         detail="Server Error. Please Try Again."
    #     )
    
    # Validate service type
    if request.service_type not in SERVICE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid service type. Must be one of: {list(SERVICE_TYPES.keys())}"
        )
    
    # Service-specific validation
    details = request.details or {}
    
    if request.service_type == "emi":
        if not details.get("loan_account"):
            raise HTTPException(status_code=400, detail="Loan account number is required for EMI payment")
        if not details.get("bank_name") and not details.get("operator"):
            raise HTTPException(status_code=400, detail="Bank/Lender selection is required for EMI payment")
    
    elif request.service_type == "mobile_recharge":
        if not details.get("mobile_number"):
            raise HTTPException(status_code=400, detail="Mobile number is required for recharge")
        if not details.get("operator"):
            raise HTTPException(status_code=400, detail="Operator selection is required for recharge")
    
    elif request.service_type == "dth":
        if not details.get("consumer_number"):
            raise HTTPException(status_code=400, detail="Customer/Subscriber ID is required for DTH")
        if not details.get("operator"):
            raise HTTPException(status_code=400, detail="DTH provider selection is required")
    
    elif request.service_type in ["electricity", "gas"]:
        if not details.get("consumer_number"):
            raise HTTPException(status_code=400, detail="Consumer number is required")
        if not details.get("operator"):
            raise HTTPException(status_code=400, detail="Provider selection is required")
    
    elif request.service_type == "dmt":
        if not details.get("account_number"):
            raise HTTPException(status_code=400, detail="Bank account number is required")
        if not details.get("ifsc_code"):
            raise HTTPException(status_code=400, detail="IFSC code is required")
        if not details.get("account_holder"):
            raise HTTPException(status_code=400, detail="Account holder name is required")
    
    # Get user
    user = await db.users.find_one({"uid": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check KYC status
    if user.get("kyc_status") != "verified":
        raise HTTPException(status_code=403, detail="KYC verification required for redeem")
    
    # Check subscription plan
    valid_plans = ["startup", "growth", "elite"]
    user_plan = (user.get("subscription_plan") or "").lower()
    if user_plan not in valid_plans:
        raise HTTPException(
            status_code=403, 
            detail="Paid subscription required. Please upgrade to Startup, Growth or Elite plan."
        )
    
    # Calculate charges
    charges = calculate_charges(request.amount)
    total_prc_required = charges["total_prc_required"]
    
    # Check PRC balance
    current_balance = user.get("prc_balance", 0)
    if current_balance < total_prc_required:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient PRC balance. Required: {total_prc_required} PRC, Available: {current_balance} PRC"
        )
    
    # Generate request ID
    request_id = generate_request_id()
    
    # Create request document
    now = datetime.now(timezone.utc)
    request_doc = {
        "request_id": request_id,
        "user_id": request.user_id,
        "user_name": user.get("name", ""),
        "user_mobile": user.get("mobile", ""),
        "service_type": request.service_type,
        "service_name": SERVICE_TYPES[request.service_type]["name"],
        "amount": request.amount,  # Store as 'amount' for dashboard compatibility
        "amount_inr": request.amount,
        "details": request.details,
        # Charges breakdown
        "charges": charges,
        "total_prc_deducted": total_prc_required,
        # Status
        "status": STATUS_PENDING,
        "status_history": [
            {"status": STATUS_PENDING, "timestamp": now.isoformat(), "note": "Request created"}
        ],
        # Timestamps
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        # Eko transaction details (filled after processing)
        "eko_tid": None,
        "eko_status": None,
        "utr_number": None,
        # Admin fields
        "approved_by": None,
        "approved_at": None,
        "rejection_reason": None,
        "admin_notes": None,
        "completed_at": None
    }
    
    # Deduct PRC from user using WalletService (with ledger entry)
    debit_result = WalletService.debit(
        user_id=request.user_id,
        amount=total_prc_required,
        txn_type="redeem",
        description=f"Redeem: {SERVICE_TYPES[request.service_type]['name']} - ₹{request.amount}",
        reference=request_id
    )
    
    if not debit_result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=debit_result.get("error", "Failed to deduct PRC")
        )
    
    new_balance = debit_result.get("balance_after", current_balance - total_prc_required)
    logging.info(f"[REDEEM] Deducted {total_prc_required} PRC via WalletService. Ledger TXN: {debit_result.get('txn_id')}")
    
    # Insert request
    await db.redeem_requests.insert_one(request_doc)
    
    # =====================================================
    # INSTANT RECHARGE - All BBPS Services (Auto-execute without admin)
    # Only DMT requires admin approval due to bank verification needs
    # =====================================================
    instant_services = [
        "mobile_recharge", "mobile_postpaid",
        "dth", "cable_tv",
        "electricity", "gas", "water",
        "broadband", "landline",
        "emi", "credit_card", "insurance",
        "fastag", "education", "municipal_tax", "housing_society", "lpg"
    ]
    
    if request.service_type in instant_services:
        logging.info(f"[INSTANT] Auto-executing {request.service_type} for request {request_id}")
        
        # Update status to processing
        await db.redeem_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {"status": STATUS_PROCESSING, "updated_at": datetime.now(timezone.utc).isoformat()},
                "$push": {
                    "status_history": {
                        "status": STATUS_PROCESSING,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "note": "Auto-processing instant recharge"
                    }
                }
            }
        )
        
        # Execute Eko API
        try:
            eko_result = await execute_eko_recharge(request_doc)
            
            if eko_result.get("success"):
                # SUCCESS
                final_status = STATUS_COMPLETED if eko_result.get("status") == "SUCCESS" else STATUS_PROCESSING
                
                await db.redeem_requests.update_one(
                    {"request_id": request_id},
                    {
                        "$set": {
                            "status": final_status,
                            "eko_tid": eko_result.get("eko_tid"),
                            "utr_number": eko_result.get("utr"),
                            "eko_status": eko_result.get("status"),
                            "eko_message": eko_result.get("message"),
                            "completed_at": datetime.now(timezone.utc).isoformat() if final_status == STATUS_COMPLETED else None,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        },
                        "$push": {
                            "status_history": {
                                "status": final_status,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "note": f"Instant: {eko_result.get('message')} | TID: {eko_result.get('eko_tid')}"
                            }
                        }
                    }
                )
                
                # Log successful payment event
                await log_payment_event(
                    event_type="success",
                    service_type=request.service_type,
                    user_id=request.user_id,
                    amount=request.amount,
                    operator=request.details.get("operator"),
                    consumer_number=request.details.get("consumer_number") or request.details.get("mobile_number"),
                    transaction_id=eko_result.get("eko_tid"),
                    eko_response=eko_result
                )
                
                return {
                    "success": True,
                    "message": f"✅ {SERVICE_TYPES[request.service_type]['name']} successful!",
                    "request_id": request_id,
                    "eko_tid": eko_result.get("eko_tid"),
                    "status": final_status,
                    "charges": charges,
                    "prc_deducted": total_prc_required,
                    "new_balance": new_balance
                }
            else:
                # FAILED - Refund PRC using WalletService
                refund_result = WalletService.credit(
                    user_id=request.user_id,
                    amount=total_prc_required,
                    txn_type="refund",
                    description=f"Refund: {SERVICE_TYPES[request.service_type]['name']} failed - {eko_result.get('message')}",
                    reference=request_id
                )
                refund_balance = refund_result.get("balance_after", new_balance + total_prc_required) if refund_result.get("success") else new_balance + total_prc_required
                logging.info(f"[REDEEM] Refunded {total_prc_required} PRC via WalletService. Ledger TXN: {refund_result.get('txn_id', 'N/A')}")
                
                await db.redeem_requests.update_one(
                    {"request_id": request_id},
                    {
                        "$set": {
                            "status": STATUS_FAILED,
                            "eko_status": "FAILED",
                            "eko_message": eko_result.get("message"),
                            "error_message": eko_result.get("message"),
                            "prc_refunded": True,
                            "refund_amount": total_prc_required,
                            "failed_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        },
                        "$push": {
                            "status_history": {
                                "status": STATUS_FAILED,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "note": f"Failed: {eko_result.get('message')} | Refunded {total_prc_required} PRC"
                            }
                        }
                    }
                )
                
                # Log failed payment event
                await log_payment_event(
                    event_type="failed",
                    service_type=request.service_type,
                    user_id=request.user_id,
                    amount=request.amount,
                    operator=request.details.get("operator"),
                    consumer_number=request.details.get("consumer_number") or request.details.get("mobile_number"),
                    eko_response=eko_result,
                    error_message=eko_result.get("message")
                )
                
                # Log error for monitoring
                await log_error(
                    error_type="payment_failed",
                    error_message=eko_result.get("message", "Unknown error"),
                    source="unified_redeem_v2",
                    user_id=request.user_id,
                    request_data={"operator": request.details.get("operator"), "consumer": request.details.get("consumer_number") or request.details.get("mobile_number"), "amount": request.amount},
                    severity="warning",
                    category="payment"
                )
                
                # === AUTO-RETRY ENQUEUE (Phase 4) ===
                # Check if this service type is eligible for auto-retry
                if BBPS_AUTO_RETRY_ENABLED and request.service_type in BBPS_RETRY_ELIGIBLE_SERVICES:
                    try:
                        # Check if error is retryable (not user input errors)
                        error_msg = (eko_result.get("message") or "").lower()
                        is_retryable = not any(x in error_msg for x in ["invalid", "incorrect", "wrong", "not found", "not registered"])
                        
                        if is_retryable:
                            task_id = await TaskQueue.enqueue(
                                task_name="retry_failed_transfer",
                                payload={
                                    "request_id": request_id,
                                    "retry_attempt": 1,
                                    "service_type": request.service_type,
                                    "user_id": request.user_id,
                                    "amount": request.amount
                                },
                                max_retries=BBPS_MAX_RETRIES,
                                delay_seconds=BBPS_RETRY_DELAY,
                                priority=3  # High priority for payment retries
                            )
                            logging.info(f"[BBPS] Auto-retry scheduled: {request_id} -> Task: {task_id}")
                            
                            # Update request with retry task info
                            await db.redeem_requests.update_one(
                                {"request_id": request_id},
                                {"$set": {"retry_task_id": task_id, "auto_retry_enabled": True}}
                            )
                    except Exception as retry_err:
                        logging.error(f"[BBPS] Failed to schedule auto-retry: {str(retry_err)}")
                
                return {
                    "success": False,
                    "message": f"❌ Payment failed: Invalid Account ID or Consumer Code. Please check the format and try again. {total_prc_required} PRC refunded.",
                    "request_id": request_id,
                    "status": STATUS_FAILED,
                    "error": eko_result.get("message"),
                    "error_detail": eko_result.get("message"),  # Keep original for debugging
                    "prc_refunded": total_prc_required,
                    "new_balance": refund_balance
                }
                
        except Exception as e:
            logging.error(f"[INSTANT] Error: {str(e)}")
            # Refund on error using WalletService
            refund_result = WalletService.credit(
                user_id=request.user_id,
                amount=total_prc_required,
                txn_type="refund",
                description=f"Refund: System error - {str(e)[:50]}",
                reference=request_id
            )
            refund_balance = refund_result.get("balance_after", new_balance + total_prc_required) if refund_result.get("success") else new_balance + total_prc_required
            logging.info(f"[REDEEM] Refunded {total_prc_required} PRC via WalletService (error). Ledger TXN: {refund_result.get('txn_id', 'N/A')}")
            
            await db.redeem_requests.update_one(
                {"request_id": request_id},
                {
                    "$set": {
                        "status": STATUS_FAILED,
                        "error_message": str(e),
                        "prc_refunded": True,
                        "refund_amount": total_prc_required,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            return {
                "success": False,
                "message": f"❌ System error. {total_prc_required} PRC refunded.",
                "request_id": request_id,
                "error": str(e),
                "prc_refunded": total_prc_required,
                "new_balance": refund_balance
            }
    
    # For other services (DMT, EMI, Gas) - require admin approval
    return {
        "success": True,
        "message": "Request submitted successfully! Admin will process within 24-48 hours.",
        "request_id": request_id,
        "charges": charges,
        "prc_deducted": total_prc_required,
        "new_balance": new_balance
    }


@router.get("/user/{user_id}/requests")
async def get_user_requests(
    user_id: str,
    status: Optional[str] = None,
    service_type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0)
):
    """Get all redeem requests for a user with optional filters"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Build query
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    if service_type:
        query["service_type"] = service_type
    
    # Get total count
    total = await db.redeem_requests.count_documents(query)
    
    # Get requests - FIX: Use to_list() instead of async for to prevent cursor leak
    requests = await db.redeem_requests.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    requests = [serialize_doc(doc) for doc in requests]
    
    return {
        "success": True,
        "requests": requests,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.get("/user/{user_id}/request/{request_id}")
async def get_request_details(user_id: str, request_id: str):
    """Get details of a specific request"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    request_doc = await db.redeem_requests.find_one({
        "request_id": request_id,
        "user_id": user_id
    })
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {
        "success": True,
        "request": serialize_doc(request_doc)
    }


# ==================== ADMIN APIs ====================

@router.get("/admin/requests")
async def get_admin_requests(
    status: Optional[str] = None,
    service_type: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    sort_by: str = Query("created_at", pattern="^(created_at|amount_inr|approved_at|completed_at)$"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),  # Default: oldest first
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """
    Admin: Get all redeem requests with advanced filtering and pagination
    
    Filters:
    - status: pending, approved, processing, completed, failed, rejected
    - service_type: mobile_recharge, dth, electricity, gas, emi, dmt
    - search: Search by request_id, user_name, user_mobile
    - date_from, date_to: Date range filter
    - min_amount, max_amount: Amount range filter
    
    Sorting:
    - sort_by: created_at, amount_inr, approved_at, completed_at
    - sort_order: asc, desc
    
    Pagination:
    - page: Page number (1-indexed)
    - per_page: Items per page (max 100)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Build query
    query = {}
    
    if status:
        # Support comma-separated statuses (e.g., "pending,approved,processing")
        if ',' in status:
            status_list = [s.strip() for s in status.split(',')]
            query["status"] = {"$in": status_list}
        else:
            query["status"] = status
    
    if service_type:
        query["service_type"] = service_type
    
    if search:
        query["$or"] = [
            {"request_id": {"$regex": search, "$options": "i"}},
            {"user_name": {"$regex": search, "$options": "i"}},
            {"user_mobile": {"$regex": search, "$options": "i"}}
        ]
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    if min_amount is not None:
        query["amount_inr"] = {"$gte": min_amount}
    
    if max_amount is not None:
        if "amount_inr" in query:
            query["amount_inr"]["$lte"] = max_amount
        else:
            query["amount_inr"] = {"$lte": max_amount}
    
    # Calculate skip
    skip = (page - 1) * per_page
    
    # Sort direction
    sort_direction = -1 if sort_order == "desc" else 1
    
    # Get total count
    total = await db.redeem_requests.count_documents(query)
    
    # Get requests - FIX: Use to_list() instead of async for to prevent cursor leak
    requests_raw = await db.redeem_requests.find(query).sort(sort_by, sort_direction).skip(skip).limit(per_page).to_list(length=per_page)
    requests = [serialize_doc(doc) for doc in requests_raw]
    
    # Calculate pagination info
    total_pages = (total + per_page - 1) // per_page
    
    return {
        "success": True,
        "requests": requests,
        "pagination": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        "filters_applied": {
            "status": status,
            "service_type": service_type,
            "search": search,
            "date_range": {"from": date_from, "to": date_to} if date_from or date_to else None,
            "amount_range": {"min": min_amount, "max": max_amount} if min_amount or max_amount else None
        }
    }


@router.get("/admin/stats")
async def get_admin_stats():
    """Get dashboard statistics for admin"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Count by status - FIX: Use to_list() instead of async for
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount_inr"}}}
    ]
    status_stats_raw = await db.redeem_requests.aggregate(pipeline).to_list(length=20)
    status_stats = {}
    for doc in status_stats_raw:
        status_stats[doc["_id"]] = {
            "count": doc["count"],
            "total_amount": doc["total_amount"]
        }
    
    # Count by service type - FIX: Use to_list() instead of async for
    pipeline = [
        {"$group": {"_id": "$service_type", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount_inr"}}}
    ]
    service_stats_raw = await db.redeem_requests.aggregate(pipeline).to_list(length=50)
    service_stats = {}
    for doc in service_stats_raw:
        service_stats[doc["_id"]] = {
            "count": doc["count"],
            "total_amount": doc["total_amount"]
        }
    
    # Today's stats - FIX: Use to_list() instead of async for
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "total_amount": {"$sum": "$amount_inr"}}}
    ]
    today_stats_raw = await db.redeem_requests.aggregate(today_pipeline).to_list(length=1)
    today_stats = {"count": 0, "total_amount": 0}
    if today_stats_raw:
        today_stats = {"count": today_stats_raw[0]["count"], "total_amount": today_stats_raw[0]["total_amount"]}
    
    return {
        "success": True,
        "by_status": status_stats,
        "by_service": service_stats,
        "today": today_stats,
        "pending_count": status_stats.get(STATUS_PENDING, {}).get("count", 0)
    }


@router.post("/admin/approve")
async def admin_approve_request(data: AdminApproveRequest):
    """
    Admin: Approve or reject a redeem request
    
    - approve: Moves to 'approved' status, ready for Eko processing
    - reject: Moves to 'rejected' status, refunds PRC to user
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Get request
    request_doc = await db.redeem_requests.find_one({"request_id": data.request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc["status"] != STATUS_PENDING:
        raise HTTPException(
            status_code=400, 
            detail=f"Request is not pending. Current status: {request_doc['status']}"
        )
    
    now = datetime.now(timezone.utc)
    
    if data.action == "approve":
        # Approve the request
        update_data = {
            "status": STATUS_APPROVED,
            "approved_by": data.admin_id,
            "approved_at": now.isoformat(),
            "admin_notes": data.notes,
            "updated_at": now.isoformat()
        }
        
        await db.redeem_requests.update_one(
            {"request_id": data.request_id},
            {
                "$set": update_data,
                "$push": {
                    "status_history": {
                        "status": STATUS_APPROVED,
                        "timestamp": now.isoformat(),
                        "by": data.admin_id,
                        "note": data.notes or "Approved by admin"
                    }
                }
            }
        )
        
        return {
            "success": True,
            "message": "Request approved successfully",
            "status": STATUS_APPROVED
        }
    
    else:  # reject
        if not data.rejection_reason:
            raise HTTPException(status_code=400, detail="Rejection reason is required")
        
        # Refund PRC to user using WalletService
        user_id = request_doc["user_id"]
        refund_amount = request_doc["total_prc_deducted"]
        
        refund_result = WalletService.credit(
            user_id=user_id,
            amount=refund_amount,
            txn_type="refund",
            description=f"Refund: {request_doc['service_name']} request rejected",
            reference=data.request_id
        )
        new_balance = refund_result.get("balance_after", 0) if refund_result.get("success") else 0
        logging.info(f"[REDEEM] Refunded {refund_amount} PRC via WalletService (rejection). Ledger TXN: {refund_result.get('txn_id', 'N/A')}")
        
        # Update request
        update_data = {
            "status": STATUS_REJECTED,
            "approved_by": data.admin_id,
            "approved_at": now.isoformat(),
            "rejection_reason": data.rejection_reason,
            "admin_notes": data.notes,
            "updated_at": now.isoformat(),
            "prc_refunded": True,
            "refund_amount": refund_amount
        }
        
        await db.redeem_requests.update_one(
            {"request_id": data.request_id},
            {
                "$set": update_data,
                "$push": {
                    "status_history": {
                        "status": STATUS_REJECTED,
                        "timestamp": now.isoformat(),
                        "by": data.admin_id,
                        "note": f"Rejected: {data.rejection_reason}"
                    }
                }
            }
        )
        
        return {
            "success": True,
            "message": f"Request rejected. {refund_amount} PRC refunded to user.",
            "status": STATUS_REJECTED,
            "refund_amount": refund_amount
        }


@router.post("/admin/complete")
async def admin_complete_request(data: AdminCompleteRequest):
    """
    Admin: Execute Eko payment and complete request
    This actually calls Eko API to do the recharge/payment
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Get request
    request_doc = await db.redeem_requests.find_one({"request_id": data.request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc["status"] not in [STATUS_APPROVED, STATUS_PROCESSING]:
        raise HTTPException(
            status_code=400,
            detail=f"Request cannot be completed. Current status: {request_doc['status']}"
        )
    
    now = datetime.now(timezone.utc)
    service_type = request_doc.get("service_type", "")
    
    # Update status to processing
    await db.redeem_requests.update_one(
        {"request_id": data.request_id},
        {
            "$set": {"status": STATUS_PROCESSING, "updated_at": now.isoformat()},
            "$push": {
                "status_history": {
                    "status": STATUS_PROCESSING,
                    "timestamp": now.isoformat(),
                    "by": data.admin_id,
                    "note": "Processing Eko transaction"
                }
            }
        }
    )
    
    # Execute Eko API based on service type
    # ALL services use same BBPS paybill API - just different operator_id
    if service_type == "dmt":
        eko_result = await execute_eko_dmt(request_doc)
    else:
        # Mobile, DTH, Electricity, Gas, EMI - ALL use same BBPS paybill
        # Use the VERIFIED WORKING function for all
        eko_result = await execute_eko_recharge(request_doc)
    
    if eko_result.get("success"):
        # SUCCESS or PROCESSING
        final_status = STATUS_COMPLETED if eko_result.get("status") == "SUCCESS" else STATUS_PROCESSING
        
        update_data = {
            "status": final_status,
            "eko_tid": eko_result.get("eko_tid") or data.eko_tid,
            "utr_number": eko_result.get("utr") or data.utr_number,
            "eko_status": eko_result.get("status"),
            "eko_message": eko_result.get("message"),
            "admin_notes": data.completion_notes,
            "completed_at": now.isoformat() if final_status == STATUS_COMPLETED else None,
            "completed_by": data.admin_id,
            "updated_at": now.isoformat()
        }
        
        await db.redeem_requests.update_one(
            {"request_id": data.request_id},
            {
                "$set": update_data,
                "$push": {
                    "status_history": {
                        "status": final_status,
                        "timestamp": now.isoformat(),
                        "by": data.admin_id,
                        "note": f"Eko: {eko_result.get('message')} | TID: {eko_result.get('eko_tid')}"
                    }
                }
            }
        )
        
        return {
            "success": True,
            "message": eko_result.get("message", "Transaction processed"),
            "status": final_status,
            "eko_tid": eko_result.get("eko_tid"),
            "utr": eko_result.get("utr")
        }
    else:
        # FAILED - Refund PRC to user using WalletService
        user_id = request_doc["user_id"]
        refund_amount = request_doc["total_prc_deducted"]
        
        refund_result = WalletService.credit(
            user_id=user_id,
            amount=refund_amount,
            txn_type="refund",
            description=f"Refund: Eko transaction failed - {eko_result.get('message')}",
            reference=data.request_id
        )
        new_balance = refund_result.get("balance_after", 0) if refund_result.get("success") else 0
        logging.info(f"[REDEEM] Refunded {refund_amount} PRC via WalletService (Eko failed). Ledger TXN: {refund_result.get('txn_id', 'N/A')}")
        
        update_data = {
            "status": STATUS_FAILED,
            "eko_status": "FAILED",
            "eko_error_code": eko_result.get("error_code"),
            "eko_message": eko_result.get("message"),
            "error_message": eko_result.get("message"),  # User-friendly error message
            "failure_reason": eko_result.get("message"),  # Alias for frontend
            "failed_at": now.isoformat(),
            "admin_notes": data.completion_notes,
            "prc_refunded": True,
            "refund_amount": refund_amount,
            "updated_at": now.isoformat()
        }
        
        await db.redeem_requests.update_one(
            {"request_id": data.request_id},
            {
                "$set": update_data,
                "$push": {
                    "status_history": {
                        "status": STATUS_FAILED,
                        "timestamp": now.isoformat(),
                        "by": data.admin_id,
                        "note": f"Eko Failed: {eko_result.get('message')} | Refunded {refund_amount} PRC"
                    }
                }
            }
        )
        
        return {
            "success": False,
            "message": f"Payment failed: Please verify the Account ID/Consumer Code format. {refund_amount} PRC refunded to user.",
            "status": STATUS_FAILED,
            "error": eko_result.get("message"),
            "error_detail": eko_result.get("message"),
            "refund_amount": refund_amount
        }


@router.get("/admin/request/{request_id}")
async def get_admin_request_details(request_id: str):
    """Admin: Get full details of a request"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    request_doc = await db.redeem_requests.find_one({"request_id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get user details
    user = await db.users.find_one({"uid": request_doc["user_id"]}, {"_id": 0, "password": 0, "pin": 0})
    
    return {
        "success": True,
        "request": serialize_doc(request_doc),
        "user": user
    }


@router.post("/admin/check-status/{request_id}")
async def check_eko_transaction_status(request_id: str, admin_id: str = "admin"):
    """
    Admin: Check status of pending Eko transaction
    Updates status based on Eko API response
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    request_doc = await db.redeem_requests.find_one({"request_id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc["status"] != STATUS_PROCESSING:
        return {
            "success": True,
            "message": f"Request is not in processing state. Current status: {request_doc['status']}",
            "status": request_doc["status"]
        }
    
    eko_tid = request_doc.get("eko_tid")
    if not eko_tid:
        return {
            "success": False,
            "message": "No Eko TID found for this request"
        }
    
    try:
        from routes.eko_payments import make_eko_request
        
        # Check transaction status from Eko
        result = await make_eko_request(
            f"/v1/transactions/{eko_tid}",
            method="GET"
        )
        
        now = datetime.now(timezone.utc)
        tx_status = str(result.get("data", {}).get("tx_status", result.get("status", -1)))
        
        status_map = {
            "0": STATUS_COMPLETED,
            "1": STATUS_FAILED,
            "2": STATUS_PROCESSING,
            "3": "refund_pending",
            "4": "refunded",
            "5": "hold"
        }
        
        new_status = status_map.get(tx_status, STATUS_PROCESSING)
        
        if new_status == STATUS_COMPLETED:
            # Success - Update status
            await db.redeem_requests.update_one(
                {"request_id": request_id},
                {
                    "$set": {
                        "status": STATUS_COMPLETED,
                        "eko_status": "SUCCESS",
                        "utr_number": result.get("data", {}).get("utr") or result.get("data", {}).get("bbpstrxnrefid"),
                        "completed_at": now.isoformat(),
                        "updated_at": now.isoformat()
                    },
                    "$push": {
                        "status_history": {
                            "status": STATUS_COMPLETED,
                            "timestamp": now.isoformat(),
                            "by": admin_id,
                            "note": "Status check: Transaction successful"
                        }
                    }
                }
            )
            return {
                "success": True,
                "message": "Transaction completed successfully!",
                "status": STATUS_COMPLETED,
                "utr": result.get("data", {}).get("utr")
            }
            
        elif new_status == STATUS_FAILED or new_status in ["refund_pending", "refunded"]:
            # Failed - Refund PRC using WalletService
            user_id = request_doc["user_id"]
            refund_amount = request_doc["total_prc_deducted"]
            
            refund_result = WalletService.credit(
                user_id=user_id,
                amount=refund_amount,
                txn_type="refund",
                description="Refund: Eko transaction failed on status check",
                reference=request_id
            )
            new_balance = refund_result.get("balance_after", 0) if refund_result.get("success") else 0
            logging.info(f"[REDEEM] Refunded {refund_amount} PRC via WalletService (status check). Ledger TXN: {refund_result.get('txn_id', 'N/A')}")
            
            await db.redeem_requests.update_one(
                {"request_id": request_id},
                {
                    "$set": {
                        "status": STATUS_FAILED,
                        "eko_status": "FAILED",
                        "prc_refunded": True,
                        "refund_amount": refund_amount,
                        "updated_at": now.isoformat()
                    },
                    "$push": {
                        "status_history": {
                            "status": STATUS_FAILED,
                            "timestamp": now.isoformat(),
                            "by": admin_id,
                            "note": f"Status check: Failed. {refund_amount} PRC refunded"
                        }
                    }
                }
            )
            
            return {
                "success": False,
                "message": f"Transaction failed. {refund_amount} PRC refunded to user.",
                "status": STATUS_FAILED,
                "refund_amount": refund_amount
            }
        else:
            # Still processing
            return {
                "success": True,
                "message": "Transaction still processing. Check again later.",
                "status": STATUS_PROCESSING,
                "eko_status": tx_status
            }
            
    except Exception as e:
        logging.error(f"Status check error: {str(e)}")
        return {
            "success": False,
            "message": f"Error checking status: {str(e)}"
        }


@router.post("/admin/manual-refund/{request_id}")
async def manual_refund_request(request_id: str, admin_id: str = "admin", reason: str = "Manual refund by admin"):
    """
    Admin: Manually refund PRC for any request
    Use when Eko transaction is stuck or needs manual intervention
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    request_doc = await db.redeem_requests.find_one({"request_id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc.get("prc_refunded"):
        return {
            "success": False,
            "message": "PRC already refunded for this request"
        }
    
    if request_doc["status"] == STATUS_COMPLETED:
        return {
            "success": False,
            "message": "Cannot refund completed request"
        }
    
    now = datetime.now(timezone.utc)
    user_id = request_doc["user_id"]
    refund_amount = request_doc["total_prc_deducted"]
    
    # Manual refund using WalletService
    refund_result = WalletService.credit(
        user_id=user_id,
        amount=refund_amount,
        txn_type="refund",
        description=f"Manual Refund: {reason}",
        reference=request_id
    )
    new_balance = refund_result.get("balance_after", 0) if refund_result.get("success") else 0
    logging.info(f"[REDEEM] Manual Refund {refund_amount} PRC via WalletService. Ledger TXN: {refund_result.get('txn_id', 'N/A')}")
    
    await db.redeem_requests.update_one(
        {"request_id": request_id},
        {
            "$set": {
                "status": STATUS_FAILED,
                "prc_refunded": True,
                "refund_amount": refund_amount,
                "refund_reason": reason,
                "updated_at": now.isoformat()
            },
            "$push": {
                "status_history": {
                    "status": STATUS_FAILED,
                    "timestamp": now.isoformat(),
                    "by": admin_id,
                    "note": f"Manual refund: {reason}. {refund_amount} PRC refunded"
                }
            }
        }
    )
    
    return {
        "success": True,
        "message": f"{refund_amount} PRC refunded successfully",
        "refund_amount": refund_amount
    }



# ==================== ADMIN BBPS DASHBOARD ====================
# View all instant BBPS requests with full details

@router.get("/admin/bbps-requests")
async def get_bbps_requests(
    status: str = None,
    service_type: str = None,
    user_id: str = None,
    from_date: str = None,
    to_date: str = None,
    page: int = 1,
    limit: int = 50
):
    """
    Admin: Get all BBPS instant requests with full details
    
    Query params:
    - status: pending, processing, completed, failed, rejected
    - service_type: mobile_recharge, dth, electricity, gas, emi, water, etc.
    - user_id: Filter by specific user
    - from_date, to_date: Date range filter (ISO format)
    - page, limit: Pagination
    
    Returns all request details including Eko response
    """
    # Build query
    query = {}
    
    # Filter by status
    if status:
        query["status"] = status
    
    # Filter by service type - exclude DMT (bank transfer)
    if service_type:
        query["service_type"] = service_type
    else:
        # Only show BBPS instant services (not DMT)
        query["service_type"] = {"$ne": "dmt"}
    
    # Filter by user
    if user_id:
        query["user_id"] = user_id
    
    # Date range filter
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" not in query:
            query["created_at"] = {}
        query["created_at"]["$lte"] = to_date
    
    # Get total count
    total = await db.redeem_requests.count_documents(query)
    
    # Pagination
    skip = (page - 1) * limit
    
    # Fetch requests with full details
    requests_raw = await db.redeem_requests.find(
        query,
        {"_id": 0}  # Exclude MongoDB _id
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich requests with user info
    requests = []
    for req in requests_raw:
        user_id = req.get("user_id")
        if user_id:
            user = await db.users.find_one(
                {"uid": user_id},
                {"_id": 0, "name": 1, "mobile": 1, "email": 1}
            )
            if user:
                req["user_name"] = user.get("name", "")
                req["user_mobile"] = user.get("mobile", "")
                if not req.get("user_email"):
                    req["user_email"] = user.get("email", "")
        
        # Ensure amount field exists (fallback to amount_inr for old records)
        if not req.get("amount") and req.get("amount_inr"):
            req["amount"] = req.get("amount_inr")
        elif not req.get("amount") and req.get("details", {}).get("amount"):
            req["amount"] = req.get("details", {}).get("amount")
        
        requests.append(req)
    
    # Calculate stats
    stats = {
        "total": total,
        "by_status": {},
        "by_service": {},
        "total_amount": 0,
        "total_prc_used": 0
    }
    
    # Get aggregated stats
    pipeline = [
        {"$match": {"service_type": {"$ne": "dmt"}}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": {"$ifNull": ["$amount", {"$ifNull": ["$amount_inr", 0]}]}},
            "total_prc": {"$sum": "$total_prc_deducted"}
        }}
    ]
    
    status_stats = await db.redeem_requests.aggregate(pipeline).to_list(10)
    for stat in status_stats:
        stats["by_status"][stat["_id"]] = {
            "count": stat["count"],
            "amount": stat["total_amount"],
            "prc": stat["total_prc"]
        }
        stats["total_amount"] += stat["total_amount"] or 0
        stats["total_prc_used"] += stat["total_prc"] or 0
    
    # Get service-wise stats
    service_pipeline = [
        {"$match": {"service_type": {"$ne": "dmt"}}},
        {"$group": {
            "_id": "$service_type",
            "count": {"$sum": 1},
            "success": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
            "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}}
        }}
    ]
    
    service_stats = await db.redeem_requests.aggregate(service_pipeline).to_list(20)
    for stat in service_stats:
        stats["by_service"][stat["_id"]] = {
            "total": stat["count"],
            "success": stat["success"],
            "failed": stat["failed"],
            "success_rate": round((stat["success"] / stat["count"]) * 100, 1) if stat["count"] > 0 else 0
        }
    
    return {
        "success": True,
        "requests": requests,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        },
        "stats": stats
    }


@router.get("/admin/bbps-request/{request_id}")
async def get_bbps_request_details(request_id: str):
    """
    Admin: Get single BBPS request with complete details
    Includes: User info, Eko response, status history, refund info
    """
    # Get request
    request_doc = await db.redeem_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get user info
    user = await db.users.find_one(
        {"uid": request_doc.get("user_id")},
        {"_id": 0, "uid": 1, "email": 1, "name": 1, "mobile": 1, "subscription_plan": 1}
    )
    
    return {
        "success": True,
        "request": request_doc,
        "user": user,
        "eko_details": {
            "tid": request_doc.get("eko_tid"),
            "utr": request_doc.get("utr_number"),
            "status": request_doc.get("eko_status"),
            "message": request_doc.get("eko_message"),
            "response": request_doc.get("eko_response")
        },
        "refund_info": {
            "refunded": request_doc.get("prc_refunded", False),
            "amount": request_doc.get("refund_amount", 0)
        }
    }




@router.post("/admin/force-prc-deduct")
async def force_prc_deduct(
    date: str = None,
    dry_run: bool = True,
    skip_ledger_check: bool = False
):
    """
    EMERGENCY: Force deduct PRC from users for successful BBPS transactions.
    This bypasses ledger check and directly updates user balance.
    
    Args:
        date: Date to process (YYYY-MM-DD format), defaults to today
        dry_run: If True, only show what would be deducted
        skip_ledger_check: If True, ignore existing ledger entries and deduct anyway
    """
    from datetime import datetime, timezone
    
    try:
        if not date:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Find all completed BBPS requests for the date with Eko TID
        requests = await db.redeem_requests.find({
            "created_at": {"$regex": f"^{date}"},
            "eko_tid": {"$exists": True, "$ne": None},
            "$or": [
                {"status": "completed"},
                {"eko_status": "SUCCESS"}
            ],
            "prc_balance_deducted": {"$ne": True}  # Not already balance deducted
        }).to_list(1000)
        
        results = []
        total_prc = 0
        success_count = 0
        failed_count = 0
        
        for req in requests:
            user_id = req.get("user_id")
            request_id = req.get("request_id")
            prc_to_deduct = req.get("total_prc_deducted") or req.get("charges", {}).get("total_prc_required", 0)
            
            if not prc_to_deduct or prc_to_deduct <= 0:
                continue
            
            # Get current user balance
            user = await db.users.find_one({"uid": user_id}, {"prc_balance": 1, "name": 1})
            if not user:
                results.append({
                    "user_id": user_id,
                    "user_name": req.get("user_name"),
                    "prc": prc_to_deduct,
                    "status": "USER_NOT_FOUND"
                })
                failed_count += 1
                continue
            
            current_balance = user.get("prc_balance", 0)
            new_balance = current_balance - prc_to_deduct
            
            total_prc += prc_to_deduct
            
            if dry_run:
                results.append({
                    "user_id": user_id,
                    "user_name": req.get("user_name"),
                    "prc": prc_to_deduct,
                    "current_balance": current_balance,
                    "new_balance": new_balance,
                    "request_id": request_id,
                    "eko_tid": req.get("eko_tid"),
                    "status": "WILL_DEDUCT"
                })
            else:
                # DIRECT balance update - bypass WalletService
                txn_id = f"FIX-{int(datetime.now(timezone.utc).timestamp())}-{request_id[-6:]}"
                
                update_result = await db.users.update_one(
                    {"uid": user_id},
                    {
                        "$set": {"prc_balance": new_balance},
                        "$push": {
                            "prc_transactions": {
                                "type": "bbps_fix",
                                "amount": -prc_to_deduct,
                                "txn_id": txn_id,
                                "description": f"BBPS Fix: {req.get('service_type')} ₹{req.get('amount_inr')} TID:{req.get('eko_tid')}",
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    }
                )
                
                if update_result.modified_count > 0:
                    success_count += 1
                    
                    # Mark request as balance deducted
                    await db.redeem_requests.update_one(
                        {"request_id": request_id},
                        {"$set": {
                            "prc_balance_deducted": True,
                            "prc_fix_txn": txn_id,
                            "prc_fix_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    # Add to prc_ledger for UI visibility
                    await db.prc_ledger.insert_one({
                        "user_id": user_id,
                        "type": "bbps_fix",
                        "entry_type": "debit",
                        "amount": -prc_to_deduct,
                        "balance_after": new_balance,
                        "description": f"BBPS Fix: {req.get('service_type')} ₹{req.get('amount_inr')} TID:{req.get('eko_tid')}",
                        "reference": request_id,
                        "txn_id": txn_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    # Add to main ledger
                    await db.ledger.insert_one({
                        "entry_id": f"LED-FIX-{txn_id[-8:]}",
                        "txn_id": txn_id,
                        "user_id": user_id,
                        "entry_type": "debit",
                        "txn_type": "bbps_fix",
                        "amount": prc_to_deduct,
                        "balance_before": current_balance,
                        "balance_after": new_balance,
                        "description": f"BBPS Fix: {req.get('service_type')} ₹{req.get('amount_inr')} TID:{req.get('eko_tid')}",
                        "reference": request_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    results.append({
                        "user_id": user_id,
                        "user_name": req.get("user_name"),
                        "prc": prc_to_deduct,
                        "old_balance": current_balance,
                        "new_balance": new_balance,
                        "txn_id": txn_id,
                        "status": "DEDUCTED"
                    })
                else:
                    failed_count += 1
                    results.append({
                        "user_id": user_id,
                        "user_name": req.get("user_name"),
                        "prc": prc_to_deduct,
                        "status": "UPDATE_FAILED"
                    })
        
        return {
            "success": True,
            "date": date,
            "dry_run": dry_run,
            "summary": {
                "total_requests": len(requests),
                "to_process": len([r for r in results if r.get("status") in ["WILL_DEDUCT", "DEDUCTED"]]),
                "success": success_count,
                "failed": failed_count,
                "total_prc": total_prc
            },
            "transactions": results
        }
        
    except Exception as e:
        logging.error(f"Force PRC deduct error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/bulk-prc-deduct")
async def bulk_prc_deduct(
    date: str = None,
    dry_run: bool = True
):
    """
    EMERGENCY: Deduct PRC from users for successful BBPS transactions where PRC was not deducted.
    
    Args:
        date: Date to process (YYYY-MM-DD format), defaults to today
        dry_run: If True, only show what would be deducted. If False, actually deduct.
    """
    from datetime import datetime, timezone
    
    try:
        if not date:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Find all completed BBPS requests for the date with Eko TID (successful)
        requests = await db.redeem_requests.find({
            "created_at": {"$regex": f"^{date}"},
            "eko_tid": {"$exists": True, "$ne": None},
            "$or": [
                {"status": "completed"},
                {"eko_status": "SUCCESS"}
            ]
        }).to_list(1000)
        
        results = []
        total_prc = 0
        success_count = 0
        already_deducted = 0
        failed_count = 0
        
        for req in requests:
            user_id = req.get("user_id")
            request_id = req.get("request_id")
            prc_to_deduct = req.get("total_prc_deducted") or req.get("charges", {}).get("total_prc_required", 0)
            
            if not prc_to_deduct or prc_to_deduct <= 0:
                continue
            
            # Check if already marked as PRC deducted in ledger
            existing_ledger = await db.ledger.find_one({
                "reference": request_id,
                "entry_type": "debit",
                "txn_type": "redeem"
            })
            
            if existing_ledger:
                already_deducted += 1
                results.append({
                    "user_id": user_id,
                    "user_name": req.get("user_name"),
                    "prc": prc_to_deduct,
                    "status": "ALREADY_DEDUCTED",
                    "ledger_txn": existing_ledger.get("txn_id")
                })
                continue
            
            total_prc += prc_to_deduct
            
            if dry_run:
                results.append({
                    "user_id": user_id,
                    "user_name": req.get("user_name"),
                    "prc": prc_to_deduct,
                    "request_id": request_id,
                    "eko_tid": req.get("eko_tid"),
                    "status": "WILL_DEDUCT"
                })
            else:
                # Actually deduct PRC
                debit_result = WalletService.debit(
                    user_id=user_id,
                    amount=prc_to_deduct,
                    txn_type="redeem",
                    description=f"BBPS Fix: {req.get('service_type')} - ₹{req.get('amount_inr', 0)} | TID: {req.get('eko_tid')}",
                    reference=request_id,
                    check_balance=False  # Don't check balance for historical fix
                )
                
                if debit_result.get("success"):
                    success_count += 1
                    results.append({
                        "user_id": user_id,
                        "user_name": req.get("user_name"),
                        "prc": prc_to_deduct,
                        "status": "DEDUCTED",
                        "txn_id": debit_result.get("txn_id"),
                        "new_balance": debit_result.get("balance_after")
                    })
                    
                    # Update request to mark PRC deducted
                    await db.redeem_requests.update_one(
                        {"request_id": request_id},
                        {"$set": {"prc_deducted_fixed": True, "prc_fix_txn": debit_result.get("txn_id")}}
                    )
                else:
                    failed_count += 1
                    results.append({
                        "user_id": user_id,
                        "user_name": req.get("user_name"),
                        "prc": prc_to_deduct,
                        "status": "FAILED",
                        "error": debit_result.get("error")
                    })
        
        return {
            "success": True,
            "date": date,
            "dry_run": dry_run,
            "summary": {
                "total_transactions": len(requests),
                "already_deducted": already_deducted,
                "to_deduct": len([r for r in results if r.get("status") in ["WILL_DEDUCT", "DEDUCTED"]]),
                "success": success_count,
                "failed": failed_count,
                "total_prc": total_prc
            },
            "transactions": results
        }
        
    except Exception as e:
        logging.error(f"Bulk PRC deduct error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/fix-amounts")
async def fix_missing_amounts():
    """
    Migration: Fix old records where 'amount' field is missing but 'amount_inr' exists
    """
    try:
        # Find records with amount_inr but no amount
        result = await db.redeem_requests.update_many(
            {
                "$or": [
                    {"amount": {"$exists": False}},
                    {"amount": None},
                    {"amount": 0}
                ],
                "amount_inr": {"$exists": True, "$gt": 0}
            },
            [
                {"$set": {"amount": "$amount_inr"}}
            ]
        )
        
        fixed_count = result.modified_count
        
        # Also fix records where amount_inr doesn't exist but details has amount
        result2 = await db.redeem_requests.update_many(
            {
                "$or": [
                    {"amount": {"$exists": False}},
                    {"amount": None},
                    {"amount": 0}
                ],
                "details.amount": {"$exists": True, "$gt": 0}
            },
            [
                {"$set": {"amount": "$details.amount"}}
            ]
        )
        
        fixed_count += result2.modified_count
        
        return {
            "success": True,
            "message": f"Fixed {fixed_count} records with missing amounts",
            "fixed_count": fixed_count
        }
    except Exception as e:
        logging.error(f"Fix amounts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
