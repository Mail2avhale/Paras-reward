"""
Unified Redeem System - Backend Routes
Based on Eko Developer Documentation

Services:
1. Mobile Recharge (BBPS Category 5)
2. DTH (BBPS Category 4)
3. Electricity (BBPS Category 8)
4. Gas PNG (BBPS Category 2)
5. LPG (BBPS Category 18)
6. EMI/Loan (BBPS Category 21)
7. Credit Card (BBPS Category 7)
8. Bank Transfer (DMT)

Charges:
- Service Amount
- Eko Fee (from API)
- Flat Fee: ₹10
- Admin Charges: 20% of service amount
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import httpx
import hashlib
import hmac
import base64
import time
import uuid
import logging
import os

router = APIRouter(prefix="/redeem", tags=["Unified Redeem System"])

# ==================== EKO CONFIGURATION ====================
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "7c179a397b4710e71b2248d1f5892d19")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "7a2529f5-3587-4add-a2df-3d0606d62460")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")

# Fixed values
LATLONG = "19.0760,72.8777"  # Mumbai
SOURCE_IP = "34.44.149.98"

# Charge Configuration
FLAT_FEE = 10  # ₹10 flat
ADMIN_CHARGE_PERCENT = 20  # 20%

# Database reference
db = None

def set_db(database):
    global db
    db = database

# ==================== SERVICE CATEGORIES ====================
SERVICE_CATEGORIES = {
    "mobile_recharge": {"id": 5, "name": "Mobile Prepaid", "icon": "📱", "fetch_bill": False},
    "dth": {"id": 4, "name": "DTH Recharge", "icon": "📺", "fetch_bill": False},
    "electricity": {"id": 8, "name": "Electricity Bill", "icon": "⚡", "fetch_bill": True},
    "gas": {"id": 2, "name": "Gas Bill (PNG)", "icon": "🔥", "fetch_bill": True},
    "lpg": {"id": 18, "name": "LPG Cylinder", "icon": "🛢️", "fetch_bill": False},
    "emi": {"id": 21, "name": "Loan EMI", "icon": "🏦", "fetch_bill": True},
    "credit_card": {"id": 7, "name": "Credit Card", "icon": "💳", "fetch_bill": True},
    "dmt": {"id": None, "name": "Bank Transfer", "icon": "🏧", "fetch_bill": False}
}

# ==================== ERROR CODES (Eko Documentation) ====================
EKO_ERROR_CODES = {
    "0": "Success",
    "17": "User wallet already exists",
    "31": "Agent can not be registered",
    "39": "Max recipient limit reached",
    "41": "Wrong IFSC",
    "44": "Incomplete IFSC Code",
    "45": "Incomplete IFSC Code",
    "46": "Invalid account details",
    "48": "Recipient bank not found",
    "53": "IMPS transaction not allowed",
    "55": "Error from NPCI",
    "102": "Invalid Account number length",
    "122": "Recipient name length should be in between 1 and 50",
    "131": "Recipient name should only contain letters",
    "132": "Sender name should only contain letters",
    "136": "Please provide valid IFSC format",
    "140": "Recipient mobile number should be 10 digit",
    "145": "Recipient mobile number should be numeric",
    "168": "TID does not exist",
    "302": "Wrong OTP",
    "303": "OTP expired",
    "313": "Recipient registration not done",
    "314": "Monthly limit exceeded",
    "317": "NEFT not allowed",
    "319": "Invalid Sender/Initiator",
    "327": "Enrollment done. Verification pending",
    "342": "Recipient already registered",
    "344": "IMPS is not available in this bank",
    "347": "Insufficient balance",
    "350": "Verification failed. Recipient name not found",
    "460": "Invalid channel",
    "463": "User not found",
    "508": "Invalid IFSC for the selected bank",
    "521": "IFSC not found in the system",
    "536": "Invalid recipient type format",
    "537": "Invalid recipient type length",
    "544": "Transaction not processed. Bank is not available now",
    "585": "Customer already KYC Approved",
    "945": "Sender/Beneficiary limit has been exhausted for this month",
    "1237": "ID proof number already exists in the system"
}

TX_STATUS_CODES = {
    0: {"status": "Success", "final": True, "action": "Complete"},
    1: {"status": "Failed", "final": True, "action": "Refund PRC"},
    2: {"status": "Initiated", "final": False, "action": "Poll status"},
    3: {"status": "Refund Pending", "final": False, "action": "Wait"},
    4: {"status": "Refunded", "final": True, "action": "Update status"},
    5: {"status": "Hold", "final": False, "action": "Manual review"}
}


# ==================== AUTHENTICATION HELPERS ====================
def generate_eko_auth():
    """Generate Eko authentication headers"""
    timestamp = str(int(time.time() * 1000))
    
    # Step 1: Encode key with Base64
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode()).decode()
    
    # Step 2: Generate secret-key
    secret_key = base64.b64encode(
        hmac.new(encoded_key.encode(), timestamp.encode(), hashlib.sha256).digest()
    ).decode()
    
    return {
        "timestamp": timestamp,
        "secret_key": secret_key,
        "encoded_key": encoded_key
    }


def generate_request_hash(timestamp: str, utility_acc_no: str, amount: str, encoded_key: str):
    """Generate request_hash for paybill API"""
    # Sequence: timestamp + utility_acc_no + amount + user_code
    concat = timestamp + utility_acc_no + amount + EKO_USER_CODE
    return base64.b64encode(
        hmac.new(encoded_key.encode(), concat.encode(), hashlib.sha256).digest()
    ).decode()


async def make_eko_request(endpoint: str, method: str = "GET", data: dict = None, need_request_hash: bool = False, utility_acc_no: str = None, amount: str = None):
    """Make authenticated request to Eko API"""
    auth = generate_eko_auth()
    
    url = f"{EKO_BASE_URL}{endpoint}"
    if "initiator_id" not in endpoint and "?" not in endpoint:
        url += f"?initiator_id={EKO_INITIATOR_ID}"
    elif "initiator_id" not in endpoint:
        url += f"&initiator_id={EKO_INITIATOR_ID}"
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": auth["secret_key"],
        "secret-key-timestamp": auth["timestamp"],
        "Content-Type": "application/json"
    }
    
    # Add request_hash for paybill
    if need_request_hash and utility_acc_no and amount:
        headers["request_hash"] = generate_request_hash(
            auth["timestamp"], utility_acc_no, amount, auth["encoded_key"]
        )
    
    logging.info(f"Eko API Request: {method} {url}")
    
    try:
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            if method == "GET":
                response = await client.get(url, headers=headers)
            elif method == "POST":
                # Add required fields
                if data:
                    data["source_ip"] = SOURCE_IP
                    data["latlong"] = LATLONG
                    data["user_code"] = EKO_USER_CODE
                    data["initiator_id"] = EKO_INITIATOR_ID
                response = await client.post(url, headers=headers, json=data)
            elif method == "PUT":
                response = await client.put(url, headers=headers, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logging.info(f"Eko API Response: {response.status_code}")
            
            try:
                result = response.json()
                return {"success": True, "data": result, "status_code": response.status_code}
            except:
                return {"success": False, "error": response.text, "status_code": response.status_code}
                
    except Exception as e:
        logging.error(f"Eko API Error: {e}")
        return {"success": False, "error": str(e)}


# ==================== PYDANTIC MODELS ====================
class RedeemRequest(BaseModel):
    user_id: str
    service_type: str  # mobile_recharge, dth, electricity, gas, lpg, emi, credit_card, dmt
    operator_id: str
    utility_acc_no: str  # Mobile/Account/Consumer number
    amount: float
    # Optional fields for specific services
    beneficiary_name: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    sender_name: Optional[str] = "Customer"
    confirmation_mobile: Optional[str] = None
    extra_params: Optional[Dict[str, Any]] = None  # For operator-specific params


class ChargeCalculation(BaseModel):
    service_type: str
    amount: float


# ==================== USER ENDPOINTS ====================

@router.get("/services")
async def get_all_services():
    """Get list of all available redeem services"""
    services = []
    for key, info in SERVICE_CATEGORIES.items():
        services.append({
            "id": key,
            "name": info["name"],
            "icon": info["icon"],
            "category_id": info["id"],
            "fetch_bill_required": info["fetch_bill"]
        })
    return {"success": True, "services": services}


@router.get("/operators/{service_type}")
async def get_operators_for_service(service_type: str):
    """Get list of operators for a service type"""
    if service_type not in SERVICE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid service type: {service_type}")
    
    if service_type == "dmt":
        # DMT doesn't have operators, return banks
        return {"success": True, "service_type": "dmt", "operators": [], "note": "DMT uses bank IFSC lookup"}
    
    category_id = SERVICE_CATEGORIES[service_type]["id"]
    
    # Fetch from Eko API
    result = await make_eko_request("/v2/billpayments/operators")
    
    if not result["success"]:
        return {"success": False, "error": result.get("error")}
    
    all_operators = result["data"].get("data", [])
    
    # Filter by category
    filtered = [
        {
            "id": str(op.get("operator_id")),
            "name": op.get("name", ""),
            "category_id": op.get("operator_category"),
            "fetch_bill": op.get("billFetchResponse", 0) == 1
        }
        for op in all_operators
        if op.get("operator_category") == category_id
    ]
    
    # Sort by name
    filtered.sort(key=lambda x: x["name"])
    
    return {
        "success": True,
        "service_type": service_type,
        "category_id": category_id,
        "operators": filtered,
        "count": len(filtered)
    }


@router.get("/operator-params/{operator_id}")
async def get_operator_parameters(operator_id: int):
    """Get required parameters for an operator"""
    result = await make_eko_request(f"/v2/billpayments/operators/{operator_id}")
    
    if not result["success"]:
        return {"success": False, "error": result.get("error")}
    
    data = result["data"]
    return {
        "success": True,
        "operator_id": operator_id,
        "operator_name": data.get("operator_name", ""),
        "fetch_bill_required": data.get("fetchBill", 0) == 1,
        "is_bbps": data.get("BBPS", 0) == 1,
        "parameters": data.get("data", [])
    }


@router.post("/calculate-charges")
async def calculate_charges(request: ChargeCalculation):
    """Calculate total charges for a redeem request"""
    service_amount = request.amount
    
    # Estimate Eko fee (actual comes from API response)
    estimated_eko_fee = 5 if service_amount <= 500 else 10
    
    # Our charges
    flat_fee = FLAT_FEE  # ₹10
    admin_charges = (ADMIN_CHARGE_PERCENT / 100) * service_amount  # 20%
    
    total_prc = service_amount + estimated_eko_fee + flat_fee + admin_charges
    
    return {
        "success": True,
        "breakdown": {
            "service_amount": service_amount,
            "eko_fee_estimate": estimated_eko_fee,
            "flat_fee": flat_fee,
            "admin_charges": admin_charges,
            "admin_charge_percent": ADMIN_CHARGE_PERCENT
        },
        "total_prc_required": round(total_prc, 2),
        "note": "Actual Eko fee may vary slightly"
    }


@router.post("/request")
async def create_redeem_request(request: RedeemRequest):
    """Submit a new redeem request"""
    # Validate service type
    if request.service_type not in SERVICE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid service type: {request.service_type}")
    
    # Get user
    user = await db.users.find_one({"uid": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate charges
    service_amount = request.amount
    estimated_eko_fee = 5 if service_amount <= 500 else 10
    flat_fee = FLAT_FEE
    admin_charges = (ADMIN_CHARGE_PERCENT / 100) * service_amount
    total_prc = service_amount + estimated_eko_fee + flat_fee + admin_charges
    
    # Check balance
    user_balance = user.get("prc_balance", 0)
    if user_balance < total_prc:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient PRC balance. Required: {total_prc:.2f}, Available: {user_balance:.2f}"
        )
    
    # Get operator name
    operator_name = "Unknown"
    if request.service_type != "dmt":
        op_result = await make_eko_request(f"/v2/billpayments/operators/{request.operator_id}")
        if op_result["success"]:
            operator_name = op_result["data"].get("operator_name", "Unknown")
    
    # Generate request ID
    request_id = f"RDM{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    
    now = datetime.now(timezone.utc)
    
    # Create request document
    redeem_doc = {
        "request_id": request_id,
        "user_id": request.user_id,
        "user_name": user.get("name", "Unknown"),
        "user_mobile": user.get("mobile", ""),
        
        # Service Info
        "service_type": request.service_type,
        "service_name": SERVICE_CATEGORIES[request.service_type]["name"],
        "operator_id": request.operator_id,
        "operator_name": operator_name,
        "category_id": SERVICE_CATEGORIES[request.service_type]["id"],
        
        # Request Details
        "utility_acc_no": request.utility_acc_no,
        "beneficiary_name": request.beneficiary_name,
        "bank_account": request.bank_account,
        "ifsc_code": request.ifsc_code,
        "sender_name": request.sender_name or "Customer",
        "confirmation_mobile": request.confirmation_mobile or EKO_INITIATOR_ID,
        "extra_params": request.extra_params or {},
        
        # Amount Details
        "service_amount": service_amount,
        "eko_fee_estimate": estimated_eko_fee,
        "flat_fee": flat_fee,
        "admin_charges": admin_charges,
        "admin_charge_percent": ADMIN_CHARGE_PERCENT,
        "total_prc_deducted": total_prc,
        
        # Balance tracking
        "balance_before": user_balance,
        "balance_after": user_balance - total_prc,
        
        # Status
        "status": "pending",
        "eko_status": None,
        "eko_tid": None,
        "eko_response": None,
        
        # Admin
        "processed_by": None,
        "processed_by_uid": None,
        "processed_at": None,
        "reject_reason": None,
        "admin_notes": None,
        
        # Timestamps
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    # Deduct PRC from user
    await db.users.update_one(
        {"uid": request.user_id},
        {"$set": {"prc_balance": user_balance - total_prc}}
    )
    
    # Save request
    await db.redeem_requests.insert_one(redeem_doc)
    
    # Log transaction
    await db.transactions.insert_one({
        "transaction_id": f"TXN{uuid.uuid4().hex[:12].upper()}",
        "user_id": request.user_id,
        "wallet_type": "prc",
        "transaction_type": "redeem_request",
        "amount": -total_prc,
        "description": f"Redeem request: {SERVICE_CATEGORIES[request.service_type]['name']}",
        "metadata": {
            "request_id": request_id,
            "service_type": request.service_type,
            "service_amount": service_amount
        },
        "created_at": now.isoformat(),
        "status": "completed"
    })
    
    return {
        "success": True,
        "message": "Redeem request submitted successfully",
        "request_id": request_id,
        "total_prc_deducted": total_prc,
        "balance_after": user_balance - total_prc
    }


@router.get("/my-requests")
async def get_user_requests(user_id: str, page: int = 1, limit: int = 20):
    """Get user's redeem request history"""
    skip = (page - 1) * limit
    
    total = await db.redeem_requests.count_documents({"user_id": user_id})
    
    requests = await db.redeem_requests.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "success": True,
        "requests": requests,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/requests")
async def admin_get_all_requests(
    status: Optional[str] = None,
    service_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """Get all redeem requests with filters (Admin)"""
    query = {}
    
    if status:
        query["status"] = status
    if service_type:
        query["service_type"] = service_type
    if min_amount:
        query["service_amount"] = {"$gte": min_amount}
    if max_amount:
        query.setdefault("service_amount", {})["$lte"] = max_amount
    if search:
        query["$or"] = [
            {"user_name": {"$regex": search, "$options": "i"}},
            {"user_mobile": {"$regex": search, "$options": "i"}},
            {"utility_acc_no": {"$regex": search, "$options": "i"}},
            {"request_id": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    total = await db.redeem_requests.count_documents(query)
    
    requests = await db.redeem_requests.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Get stats
    stats = {
        "total_pending": await db.redeem_requests.count_documents({"status": "pending"}),
        "total_completed": await db.redeem_requests.count_documents({"status": "completed"}),
        "total_failed": await db.redeem_requests.count_documents({"status": "failed"}),
        "total_rejected": await db.redeem_requests.count_documents({"status": "rejected"})
    }
    
    return {
        "success": True,
        "requests": requests,
        "stats": stats,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


@router.get("/admin/request/{request_id}")
async def admin_get_request_detail(request_id: str):
    """Get single request detail (Admin)"""
    request_doc = await db.redeem_requests.find_one(
        {"request_id": request_id}, {"_id": 0}
    )
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"success": True, "request": request_doc}


@router.post("/admin/process/{request_id}")
async def admin_process_request(request_id: str, admin_uid: str, admin_pin: str):
    """Process redeem request with Eko API (Admin)"""
    # Verify admin PIN
    if admin_pin != "123456":
        raise HTTPException(status_code=403, detail="Invalid admin PIN")
    
    # Get request
    request_doc = await db.redeem_requests.find_one({"request_id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc["status"] not in ["pending", "failed"]:
        raise HTTPException(status_code=400, detail=f"Cannot process request with status: {request_doc['status']}")
    
    # Get admin name
    admin = await db.users.find_one({"uid": admin_uid}, {"name": 1})
    admin_name = admin.get("name", "Admin") if admin else "Admin"
    
    now = datetime.now(timezone.utc)
    service_type = request_doc["service_type"]
    
    # Update status to processing
    await db.redeem_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "processing", "updated_at": now.isoformat()}}
    )
    
    try:
        if service_type == "dmt":
            # DMT Flow - Bank Transfer
            eko_result = await process_dmt_request(request_doc)
        else:
            # BBPS Flow - Bill Payment
            eko_result = await process_bbps_request(request_doc)
        
        # Check result
        if eko_result["success"]:
            eko_data = eko_result.get("data", {})
            tx_status = eko_data.get("data", {}).get("tx_status") or eko_data.get("tx_status")
            
            # Convert to int for comparison
            try:
                tx_status = int(tx_status) if tx_status is not None else None
            except:
                tx_status = None
            
            if tx_status == 0 or eko_data.get("status") == 0:
                # Success
                final_status = "completed"
                eko_tid = eko_data.get("data", {}).get("tid") or eko_data.get("tid")
            elif tx_status in [2, 3, 5]:
                # Pending/Processing
                final_status = "processing"
                eko_tid = eko_data.get("data", {}).get("tid") or eko_data.get("tid")
            else:
                # Failed
                final_status = "failed"
                eko_tid = None
        else:
            final_status = "failed"
            eko_data = {"error": eko_result.get("error")}
            eko_tid = None
            tx_status = None
        
        # Update request
        await db.redeem_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": final_status,
                "eko_status": tx_status,
                "eko_tid": eko_tid,
                "eko_response": eko_data,
                "processed_by": admin_name,
                "processed_by_uid": admin_uid,
                "processed_at": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        
        return {
            "success": final_status in ["completed", "processing"],
            "status": final_status,
            "eko_tid": eko_tid,
            "eko_response": eko_data
        }
        
    except Exception as e:
        logging.error(f"Error processing request {request_id}: {e}")
        
        await db.redeem_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "failed",
                "eko_response": {"error": str(e)},
                "updated_at": now.isoformat()
            }}
        )
        
        return {"success": False, "error": str(e)}


async def process_bbps_request(request_doc: dict):
    """Process BBPS bill payment request"""
    auth = generate_eko_auth()
    
    amount = str(int(request_doc["service_amount"]))
    utility_acc_no = request_doc["utility_acc_no"]
    
    # Generate request_hash
    request_hash = generate_request_hash(
        auth["timestamp"], utility_acc_no, amount, auth["encoded_key"]
    )
    
    # Prepare body
    body = {
        "initiator_id": EKO_INITIATOR_ID,
        "utility_acc_no": utility_acc_no,
        "confirmation_mobile_no": request_doc.get("confirmation_mobile") or EKO_INITIATOR_ID,
        "sender_name": request_doc.get("sender_name", "Customer"),
        "operator_id": request_doc["operator_id"],
        "amount": amount,
        "client_ref_id": request_doc["request_id"],
        "source_ip": SOURCE_IP,
        "latlong": LATLONG,
        "user_code": EKO_USER_CODE
    }
    
    # Add extra params if any
    if request_doc.get("extra_params"):
        body.update(request_doc["extra_params"])
    
    url = f"{EKO_BASE_URL}/v2/billpayments/paybill?initiator_id={EKO_INITIATOR_ID}"
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": auth["secret_key"],
        "secret-key-timestamp": auth["timestamp"],
        "request_hash": request_hash,
        "Content-Type": "application/json"
    }
    
    logging.info(f"BBPS PayBill Request: {url}")
    logging.info(f"Body: {body}")
    
    async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
        response = await client.post(url, headers=headers, json=body)
        
        logging.info(f"BBPS Response: {response.status_code} - {response.text[:500]}")
        
        try:
            result = response.json()
            return {"success": True, "data": result}
        except:
            return {"success": False, "error": response.text}


async def process_dmt_request(request_doc: dict):
    """Process DMT bank transfer request"""
    # DMT flow is more complex - needs customer registration, recipient, etc.
    # For now, use settlement API if available
    
    auth = generate_eko_auth()
    
    amount = str(int(request_doc["service_amount"]))
    
    body = {
        "initiator_id": EKO_INITIATOR_ID,
        "amount": amount,
        "payment_mode": "5",  # IMPS
        "recipient_name": request_doc.get("beneficiary_name", "Beneficiary"),
        "account": request_doc.get("bank_account"),
        "ifsc": request_doc.get("ifsc_code"),
        "client_ref_id": request_doc["request_id"],
        "source_ip": SOURCE_IP,
        "latlong": LATLONG
    }
    
    url = f"{EKO_BASE_URL}/agent/user_code:{EKO_USER_CODE}/settlement"
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": auth["secret_key"],
        "secret-key-timestamp": auth["timestamp"],
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    logging.info(f"DMT Settlement Request: {url}")
    
    async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
        response = await client.post(url, headers=headers, data=body)
        
        logging.info(f"DMT Response: {response.status_code} - {response.text[:500]}")
        
        try:
            result = response.json()
            return {"success": True, "data": result}
        except:
            return {"success": False, "error": response.text}


@router.post("/admin/reject/{request_id}")
async def admin_reject_request(request_id: str, admin_uid: str, admin_pin: str, reason: str = "BY ADMIN"):
    """Reject redeem request and refund PRC (Admin)"""
    if admin_pin != "123456":
        raise HTTPException(status_code=403, detail="Invalid admin PIN")
    
    request_doc = await db.redeem_requests.find_one({"request_id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc["status"] == "rejected":
        raise HTTPException(status_code=400, detail="Request already rejected")
    
    if request_doc["status"] == "completed":
        raise HTTPException(status_code=400, detail="Cannot reject completed request")
    
    # Get admin name
    admin = await db.users.find_one({"uid": admin_uid}, {"name": 1})
    admin_name = admin.get("name", "Admin") if admin else "Admin"
    
    now = datetime.now(timezone.utc)
    
    # Refund PRC
    user_id = request_doc["user_id"]
    total_prc = request_doc["total_prc_deducted"]
    
    user = await db.users.find_one({"uid": user_id})
    if user:
        balance_before = user.get("prc_balance", 0)
        balance_after = balance_before + total_prc
        
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {"prc_balance": balance_after}}
        )
        
        # Log refund
        await db.transactions.insert_one({
            "transaction_id": f"TXN{uuid.uuid4().hex[:12].upper()}",
            "user_id": user_id,
            "wallet_type": "prc",
            "transaction_type": "redeem_refund",
            "amount": total_prc,
            "description": f"Redeem rejected - {reason}",
            "metadata": {
                "request_id": request_id,
                "reason": reason
            },
            "created_at": now.isoformat(),
            "status": "completed"
        })
    
    # Update request
    await db.redeem_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "rejected",
            "reject_reason": reason,
            "processed_by": admin_name,
            "processed_by_uid": admin_uid,
            "processed_at": now.isoformat(),
            "refund_details": {
                "prc_refunded": total_prc,
                "refunded_at": now.isoformat()
            },
            "updated_at": now.isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "Request rejected and PRC refunded",
        "prc_refunded": total_prc
    }


@router.get("/admin/stats")
async def admin_get_stats():
    """Get dashboard statistics (Admin)"""
    stats = {
        "by_status": {
            "pending": await db.redeem_requests.count_documents({"status": "pending"}),
            "processing": await db.redeem_requests.count_documents({"status": "processing"}),
            "completed": await db.redeem_requests.count_documents({"status": "completed"}),
            "failed": await db.redeem_requests.count_documents({"status": "failed"}),
            "rejected": await db.redeem_requests.count_documents({"status": "rejected"})
        },
        "by_service": {}
    }
    
    for service_type in SERVICE_CATEGORIES.keys():
        stats["by_service"][service_type] = {
            "pending": await db.redeem_requests.count_documents({
                "service_type": service_type, "status": "pending"
            }),
            "completed": await db.redeem_requests.count_documents({
                "service_type": service_type, "status": "completed"
            })
        }
    
    return {"success": True, "stats": stats}
