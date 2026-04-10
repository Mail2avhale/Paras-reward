"""
Eko Prepaid Mobile & DTH Recharge Routes
=========================================
Standard Eko BBPS flow as per developer documentation:
  1. Activate BBPS service (code 53) — auto on first use, cached
  2. Get operators for category (mobile=5, dth=4)
  3. Get operator parameters (required fields)
  4. Pay bill (recharge)

Business Rules:
  - Max ₹500 combined daily limit
  - 1 recharge per day per user (Mobile OR DTH)
  - Only paid subscribers with redeem limit
  - On success: deduct PRC, record PRC statement + bill_payment_requests
  - On fail: refund PRC
  - All business/Eko-wallet errors → generic "Technical error" to user
"""

from fastapi import APIRouter
from pydantic import BaseModel
import os
import time
import logging
import uuid
import re
import base64
import hashlib
import hmac
from datetime import datetime, timezone
import httpx

router = APIRouter(prefix="/recharge", tags=["Recharge"])

# ===== Injected dependencies from server.py =====
db = None
check_redeem_limit_func = None
log_transaction_func = None
calculate_charges_func = None


def set_db(database):
    global db
    db = database


def set_recharge_redeem_check(func):
    global check_redeem_limit_func
    check_redeem_limit_func = func


def set_recharge_log_transaction(func):
    global log_transaction_func
    log_transaction_func = func


def set_recharge_calculate_charges(func):
    global calculate_charges_func
    calculate_charges_func = func


# ===== Eko Config from .env =====
BASE_URL = os.environ.get("EKO_BASE_URL", "")
DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
AUTH_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "")
INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "")
USER_CODE = os.environ.get("EKO_USER_CODE", "")
SOURCE_IP = os.environ.get("EKO_SOURCE_IP", "34.44.149.98")
DEFAULT_LATLONG = "19.9975,73.7898"

MAX_RECHARGE_AMOUNT = 500
MAX_DAILY_TOTAL = 500
MAX_MONTHLY_UTILITY = 1500
GENERIC_ERROR = "Technical error. Please try again later."

# All utility/recharge service types that count towards monthly ₹1500 limit
MONTHLY_LIMIT_SERVICES = [
    "mobile_recharge", "mobile_postpaid", "dish_recharge",
    "electricity", "gas", "water", "broadband", "landline",
    "dth", "cable_tv", "emi", "credit_card", "insurance",
    "fastag", "education", "municipal_tax", "housing_society", "lpg"
]

# Service activation cache
_service_activated = False


# ===== Eko Status Constants (as per developers.eko.in/docs/error-codes) =====
class EkoStatus:
    SUCCESS = 0
    ALREADY_ACTIVE = 24
    ERROR_FROM_NPCI = 55
    MONTHLY_LIMIT_EXCEEDED = 314
    INSUFFICIENT_BALANCE = 347
    USER_NOT_FOUND = 463
    BANK_NOT_AVAILABLE = 544


class TxStatus:
    """Eko tx_status values as per official documentation:
    https://developers.eko.in/docs/error-codes
    """
    SUCCESS = 0              # Success
    FAILED = 1               # Fail
    RESPONSE_AWAITED = 2     # Response Awaited / Initiated (NEFT)
    REFUND_PENDING = 3       # Refund Pending
    REFUNDED = 4             # Refunded
    ON_HOLD = 5              # On Hold — Transaction Inquiry Required


# ===== User-Friendly Error Message Mapping =====
# Only low Eko wallet balance (347) → "Technical error" (hide from user)
# All other errors → meaningful message to user
HIDDEN_STATUS_CODES = {347}  # Only hide insufficient Eko wallet balance

ERROR_MESSAGE_MAP = {
    # === Most specific patterns FIRST ===
    # Low balance (hidden)
    "insufficient balance": "Technical error. Please try again later.",
    # Number / Subscriber errors (before "operator" pattern)
    "invalid subscriber": "Invalid mobile number. Please check and try again.",
    "subscriber not": "This number is not active. Please verify the number.",
    "invalid customer": "Invalid customer details. Please check and try again.",
    "customer not found": "Number not found with this operator. Please check operator selection.",
    "invalid mobile": "Invalid mobile number. Please enter a valid 10-digit number.",
    "not eligible": "This number is not eligible for recharge. Please contact your operator.",
    "number not": "Invalid number. Please check and try again.",
    # Plan / Amount errors
    "invalid amount": "Invalid recharge amount. Please check the plan.",
    "invalid plan": "This recharge plan is not available. Please select a valid plan.",
    "plan not": "This recharge plan is not available. Please try a different amount.",
    "amount not": "This amount is not accepted. Please enter a valid recharge amount.",
    "minimum amount": "Amount is below the minimum limit. Please increase the amount.",
    "maximum amount": "Amount exceeds the maximum limit. Please reduce the amount.",
    # Transaction errors
    "duplicate": "Duplicate recharge detected. Please check your recent transactions.",
    "already fulfilled": "This recharge was already done. Please check your history.",
    "monthly limit": "Transaction limit reached. Please try after some time.",
    "daily limit": "Daily transaction limit reached. Please try tomorrow.",
    "limit exceeded": "Transaction limit exceeded. Please try with a smaller amount.",
    "limit has been exhausted": "Transaction limit reached. Please try later.",
    # Auth / Service errors
    "agent not allowed": "Service is currently unavailable. Please try later.",
    "not allowed": "This transaction is not allowed. Please try later.",
    "no key for response": "Invalid request. Please check details and try again.",
    "service not activated": "Service is not activated. Please try later.",
    # Operator / Provider errors (generic - keep AFTER specific patterns)
    "operator": "Operator is temporarily unavailable. Please try after some time.",
    "biller": "Service provider is temporarily unavailable. Please try later.",
    "bank is not available": "Service provider is currently down. Please try after some time.",
    "service temporarily": "Service is temporarily unavailable. Please try after some time.",
    # Network errors
    "timeout": "Network timeout. Please check recharge status before retrying.",
    "connection": "Network connection issue. Please try again.",
    "npci": "Payment network error. Please try after some time.",
}


def _get_user_friendly_message(eko_message: str, eko_status: int = None) -> str:
    """Convert Eko error message to user-friendly message.
    Only hides: Eko wallet insufficient balance (347).
    Everything else: meaningful error shown to user."""
    if not eko_message:
        return GENERIC_ERROR

    # Check if this is a hidden status (only low Eko wallet balance)
    if eko_status in HIDDEN_STATUS_CODES:
        return GENERIC_ERROR

    # Search for known patterns in the Eko message (case-insensitive)
    msg_lower = eko_message.lower()
    for pattern, friendly_msg in ERROR_MESSAGE_MAP.items():
        if pattern in msg_lower:
            return friendly_msg

    # No known pattern — show actual Eko message directly
    # Clean up message if too long
    clean_msg = eko_message.strip()
    if len(clean_msg) > 150:
        clean_msg = clean_msg[:147] + "..."
    return clean_msg if clean_msg else GENERIC_ERROR



# ===== Auth Header Generation (matching bbps_services.py pattern) =====

def _eko_configured() -> bool:
    return all([BASE_URL, DEVELOPER_KEY, AUTH_KEY, INITIATOR_ID, USER_CODE])


def _generate_secret_key(timestamp: str) -> str:
    encoded_key = base64.b64encode(AUTH_KEY.encode())
    return base64.b64encode(
        hmac.new(encoded_key, timestamp.encode(), hashlib.sha256).digest()
    ).decode()


def _generate_headers(timestamp: str) -> dict:
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": _generate_secret_key(timestamp),
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/json",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
        "User-Agent": "okhttp/3.9.0"
    }


def _generate_form_headers(timestamp: str) -> dict:
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": _generate_secret_key(timestamp),
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/x-www-form-urlencoded"
    }


def _generate_request_hash(timestamp: str, account: str, amount: str) -> str:
    encoded_key = base64.b64encode(AUTH_KEY.encode())
    concatenated = f"{timestamp}{account}{amount}{USER_CODE}"
    return base64.b64encode(
        hmac.new(encoded_key, concatenated.encode(), hashlib.sha256).digest()
    ).decode()


def _sanitize_name(name: str) -> str:
    if not name:
        return "Customer"
    sanitized = re.sub(r'[^a-zA-Z]', '', name)
    return sanitized[:50] if sanitized else "Customer"


def _parse_tx_status(raw) -> int:
    if raw is None:
        return -1
    try:
        return int(raw)
    except (ValueError, TypeError):
        return -1


# ===== 1. SERVICE ACTIVATION (as per Eko docs, service_code=53) =====

async def _ensure_service_activated() -> dict:
    """
    Activate BBPS service (code 53) for the agent/user_code.
    Cached after first successful activation.
    As per: https://developers.eko.in/docs/bbps
    """
    global _service_activated
    if _service_activated:
        return {"success": True, "cached": True}

    if not _eko_configured():
        return {"success": False, "error": "Eko credentials not configured"}

    try:
        timestamp = str(round(time.time() * 1000))
        headers = _generate_form_headers(timestamp)
        url = f"{BASE_URL}/v1/user/service/activate"

        data = {
            "service_code": "53",
            "initiator_id": INITIATOR_ID,
            "user_code": USER_CODE,
            "latlong": DEFAULT_LATLONG
        }

        logging.info(f"[RECHARGE] Activating BBPS service (code=53) for user_code={USER_CODE}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(url, headers=headers, data=data)

        result = response.json()
        eko_status = result.get("status")
        logging.info(f"[RECHARGE] Activation response: status={eko_status}, msg={result.get('message', '')}")

        # 0 = newly activated, 24 = already active, 1295 = service already exists for user
        if eko_status in [EkoStatus.SUCCESS, EkoStatus.ALREADY_ACTIVE, 1295]:
            _service_activated = True
            return {"success": True, "already_active": eko_status != EkoStatus.SUCCESS}

        return {"success": False, "error": result.get("message", "Activation failed"), "eko_status": eko_status}

    except Exception as e:
        logging.error(f"[RECHARGE] Service activation error: {e}")
        return {"success": False, "error": str(e)}


@router.post("/activate-service")
async def activate_service_endpoint():
    """Manually trigger BBPS service activation (admin utility)"""
    result = await _ensure_service_activated()
    return result


# ===== 2. GET OPERATORS =====

@router.get("/operators/{recharge_type}")
async def get_recharge_operators(recharge_type: str):
    """
    Get operators for mobile (category 5) or dth (category 4).
    As per: https://developers.eko.in/reference/bbps-operators
    """
    cat_map = {"mobile": 5, "dth": 4}
    cat_id = cat_map.get(recharge_type.lower())
    if not cat_id:
        return {"success": False, "operators": [], "error": "Invalid type. Use 'mobile' or 'dth'"}

    if not _eko_configured():
        return {"success": False, "operators": [], "error": "Service not configured"}

    try:
        timestamp = str(round(time.time() * 1000))
        headers = _generate_headers(timestamp)
        url = f"{BASE_URL}/v2/billpayments/operators?initiator_id={INITIATOR_ID}&category={cat_id}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)

        if response.status_code != 200:
            logging.error(f"[RECHARGE] Operators HTTP {response.status_code}: {response.text[:200]}")
            return {"success": False, "operators": []}

        result = response.json()
        operators_raw = result.get("data", [])
        if isinstance(result.get("data"), dict):
            operators_raw = result["data"].get("operators", [])

        if not isinstance(operators_raw, list):
            operators_raw = []

        operators = [
            {
                "operator_id": str(op.get("operator_id", "")),
                "name": op.get("name", "Unknown"),
                "fetch_bill": op.get("billFetchResponse", 0) == 1
            }
            for op in operators_raw
        ]
        return {"success": True, "operators": operators}

    except httpx.TimeoutException:
        logging.error("[RECHARGE] Operators request timeout")
        return {"success": False, "operators": [], "error": "Request timeout"}
    except Exception as e:
        logging.error(f"[RECHARGE] Operators error: {e}")
        return {"success": False, "operators": []}


# ===== 3. GET OPERATOR PARAMETERS =====

@router.get("/operator-params/{operator_id}")
async def get_operator_params(operator_id: str):
    """
    Get required parameters for a specific operator.
    As per: https://developers.eko.in/reference/bbps-operator-parameters

    Returns param_name, param_label, param_type, regex, error_message, fetchBill
    """
    if not _eko_configured():
        return {"success": False, "error": "Service not configured"}

    try:
        timestamp = str(round(time.time() * 1000))
        headers = _generate_headers(timestamp)
        url = f"{BASE_URL}/v2/billpayments/operators/{operator_id}?initiator_id={INITIATOR_ID}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)

        if response.status_code != 200:
            logging.error(f"[RECHARGE] Operator params HTTP {response.status_code}")
            return {"success": False, "parameters": []}

        result = response.json()
        eko_status = result.get("status")

        if eko_status == 0 or result.get("operator_name"):
            return {
                "success": True,
                "operator_id": operator_id,
                "operator_name": result.get("operator_name", ""),
                "parameters": result.get("data", []),
                "fetch_bill_required": result.get("fetchBill", 0) == 1,
                "is_bbps": result.get("BBPS", 0) == 1
            }

        return {
            "success": False,
            "operator_id": operator_id,
            "error": result.get("message", "Unknown error"),
            "eko_status": eko_status
        }

    except Exception as e:
        logging.error(f"[RECHARGE] Operator params error: {e}")
        return {"success": False, "parameters": []}


# ===== 4. INITIATE RECHARGE =====

class RechargeRequest(BaseModel):
    user_id: str
    recharge_type: str
    number: str
    operator_id: str
    amount: float


@router.post("/initiate")
async def initiate_recharge(data: RechargeRequest):
    """
    Initiate mobile/DTH recharge via Eko BBPS paybill.
    Standard flow as per: https://developers.eko.in/reference/bbps-pay
    """
    if db is None:
        logging.error("[RECHARGE] Step 0a: Database not initialized")
        return {"success": False, "message": GENERIC_ERROR, "error_ref": "R0A"}

    if not _eko_configured():
        logging.error("[RECHARGE] Step 0b: Eko credentials not configured")
        return {"success": False, "message": GENERIC_ERROR, "error_ref": "R0B"}

    # ===== Step 0: Ensure BBPS service is activated =====
    activation = await _ensure_service_activated()
    if not activation.get("success"):
        logging.error(f"[RECHARGE] Step 0c: Service activation failed: {activation.get('error')}")
        return {"success": False, "message": GENERIC_ERROR, "error_ref": "R0C"}

    # ===== Step 1: Validate amount =====
    int_amount = int(data.amount)
    if int_amount <= 0 or int_amount > MAX_RECHARGE_AMOUNT:
        logging.warning(f"[RECHARGE] Step 1: Invalid amount {int_amount} from user {data.user_id}")
        return {"success": False, "message": GENERIC_ERROR, "error_ref": "R01"}

    # ===== Step 2: Validate number =====
    if data.recharge_type == "mobile":
        if not data.number or not re.match(r'^\d{10}$', data.number):
            return {"success": False, "message": "Please enter a valid 10-digit mobile number.", "error_ref": "R02"}
    else:
        if not data.number or len(data.number.strip()) < 3:
            return {"success": False, "message": "Please enter a valid subscriber ID.", "error_ref": "R02"}

    # ===== Step 3: Daily total limit (₹500/day combined) =====
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    pipeline = [
        {"$match": {
            "user_id": data.user_id,
            "created_at": {"$gte": today_start},
            "status": {"$nin": ["failed", "refunded"]}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
    ]
    agg_result = await db.recharge_transactions.aggregate(pipeline).to_list(1)
    today_total = agg_result[0]["total"] if agg_result else 0
    remaining_daily = MAX_DAILY_TOTAL - today_total
    logging.info(f"[RECHARGE] Step 3: user={data.user_id}, today_total=₹{today_total}, remaining=₹{remaining_daily}")
    if int_amount > remaining_daily:
        logging.info(f"[RECHARGE] Step 3: BLOCKED daily limit ₹{int_amount} > remaining ₹{remaining_daily}")
        return {"success": False, "message": GENERIC_ERROR, "error_ref": "R03"}

    # ===== Step 3.1: 10-minute cooldown between recharges =====
    from datetime import timedelta
    ten_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    recent_txn = await db.recharge_transactions.find_one({
        "user_id": data.user_id,
        "created_at": {"$gte": ten_min_ago},
        "status": {"$nin": ["failed", "refunded"]}
    })
    if recent_txn:
        logging.info(f"[RECHARGE] Step 3.1: BLOCKED 10-min cooldown for user {data.user_id}, last req={recent_txn.get('request_id','?')[:12]}")
        return {"success": False, "message": "Please wait 10 minutes between recharges.", "error_ref": "R03C"}

    # ===== Step 3.5: Monthly utility limit (₹1500/month combined across all utility+recharge) =====
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Sum from recharge_transactions (Eko mobile/DTH)
    eko_month_pipe = [
        {"$match": {
            "user_id": data.user_id,
            "created_at": {"$gte": month_start},
            "status": {"$nin": ["failed", "refunded"]}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
    ]
    eko_month_res = await db.recharge_transactions.aggregate(eko_month_pipe).to_list(1)
    eko_month_total = eko_month_res[0]["total"] if eko_month_res else 0

    # Sum from redeem_requests (BBPS utility services)
    bbps_month_pipe = [
        {"$match": {
            "user_id": data.user_id,
            "created_at": {"$gte": month_start},
            "service_type": {"$in": MONTHLY_LIMIT_SERVICES},
            "status": {"$in": [
                "completed", "COMPLETED", "Completed",
                "approved", "APPROVED", "Approved",
                "success", "SUCCESS", "Success",
                "paid", "PAID", "Paid",
                "processing", "PROCESSING", "Processing"
            ]}
        }},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$amount_inr", "$amount"]}}}}
    ]
    bbps_month_res = await db.redeem_requests.aggregate(bbps_month_pipe).to_list(1)
    bbps_month_total = bbps_month_res[0]["total"] if bbps_month_res else 0

    monthly_used = eko_month_total + bbps_month_total
    monthly_remaining = MAX_MONTHLY_UTILITY - monthly_used
    logging.info(f"[RECHARGE] Step 3.5: user={data.user_id}, monthly_used=₹{monthly_used} (eko=₹{eko_month_total}, bbps=₹{bbps_month_total}), remaining=₹{monthly_remaining}")

    if int_amount > monthly_remaining:
        logging.info(f"[RECHARGE] Step 3.5: BLOCKED monthly limit ₹{int_amount} > remaining ₹{monthly_remaining}")
        return {"success": False, "message": "Monthly recharge limit reached", "error_ref": "R03M"}

    # ===== Step 4: User + subscription check =====
    user = await db.users.find_one({"uid": data.user_id})
    if not user:
        logging.warning(f"[RECHARGE] Step 4a: User not found: {data.user_id}")
        return {"success": False, "message": GENERIC_ERROR, "error_ref": "R04A"}

    plan = (user.get("subscription_plan") or "explorer").lower()
    if plan in ["explorer", "free", ""]:
        logging.info(f"[RECHARGE] Step 4b: User {data.user_id} plan={plan} blocked")
        return {"success": False, "message": "Active subscription required for recharge services.", "error_ref": "R04B"}

    # ===== Step 5: Calculate PRC charges =====
    if not calculate_charges_func:
        logging.error("[RECHARGE] Step 5a: calculate_charges_func not set")
        return {"success": False, "message": GENERIC_ERROR, "error_ref": "R05A"}

    req_type = "mobile_recharge" if data.recharge_type == "mobile" else "dish_recharge"
    try:
        charges = await calculate_charges_func(float(int_amount), req_type, data.user_id)
        logging.info(f"[RECHARGE] Step 5: charges={charges.get('total_prc', 0):.2f} PRC for ₹{int_amount}")
    except Exception as e:
        logging.error(f"[RECHARGE] Step 5b: Charges calculation error: {e}")
        return {"success": False, "message": GENERIC_ERROR, "error_ref": "R05B"}

    total_prc = charges["total_prc"]

    # ===== Step 6: Redeem limit check =====
    if check_redeem_limit_func:
        try:
            limit_check = await check_redeem_limit_func(data.user_id, float(int_amount))
            logging.info(f"[RECHARGE] Step 6: limit_check={limit_check}")
            if not limit_check.get("allowed"):
                logging.info(f"[RECHARGE] Step 6: BLOCKED redeem limit for user {data.user_id}")
                return {"success": False, "message": GENERIC_ERROR, "error_ref": "R06"}
        except Exception as e:
            logging.error(f"[RECHARGE] Step 6 exception: {e}")
            return {"success": False, "message": GENERIC_ERROR, "error_ref": "R06E"}

    # ===== Step 7: PRC balance check =====
    user_prc = user.get("prc_balance", 0)
    logging.info(f"[RECHARGE] Step 7: user_prc={user_prc}, required={total_prc}")
    if user_prc < total_prc:
        return {"success": False, "message": f"Insufficient PRC balance. Required: {total_prc:.0f} PRC", "error_ref": "R07"}

    # ===== Step 8: Atomic PRC deduction =====
    deduct_result = await db.users.update_one(
        {"uid": data.user_id, "prc_balance": {"$gte": total_prc}},
        {"$inc": {"prc_balance": -total_prc}}
    )
    if deduct_result.modified_count == 0:
        logging.warning(f"[RECHARGE] Atomic PRC deduction failed for {data.user_id}")
        return {"success": False, "message": GENERIC_ERROR}

    # ===== Step 8.5: Pre-insert "pending" record for concurrency guard =====
    # This ensures concurrent requests see the pending amount in daily/monthly limit checks
    request_id = str(uuid.uuid4())
    client_ref_id = f"RCH{int(time.time() * 1000)}"
    pre_now = datetime.now(timezone.utc).isoformat()
    pending_txn = {
        "request_id": request_id,
        "user_id": data.user_id,
        "user_name": user.get("name", ""),
        "user_mobile": user.get("mobile", ""),
        "recharge_type": data.recharge_type,
        "number": data.number,
        "operator_id": data.operator_id,
        "amount_inr": float(int_amount),
        "total_prc_deducted": round(total_prc, 2),
        "prc_required": round(charges.get("amount_prc", 0), 2),
        "processing_fee_prc": round(charges.get("processing_fee_prc", 0), 2),
        "admin_charge_prc": round(charges.get("admin_charge_prc", 0), 2),
        "eko_tid": None,
        "client_ref_id": client_ref_id,
        "status": "pending",
        "created_at": pre_now
    }
    try:
        await db.recharge_transactions.insert_one(pending_txn)
        logging.info(f"[RECHARGE] Step 8.5: Pre-inserted pending record req={request_id}, amount=₹{int_amount}")
    except Exception as e:
        logging.error(f"[RECHARGE] Step 8.5: Pending record insert failed: {e}")
        # Refund PRC and abort
        await db.users.update_one({"uid": data.user_id}, {"$inc": {"prc_balance": total_prc}})
        return {"success": False, "message": GENERIC_ERROR}

    # ===== Step 9: Call Eko paybill API =====
    timestamp = str(round(time.time() * 1000))
    amount_str = str(int_amount)

    headers = _generate_headers(timestamp)
    headers["request_hash"] = _generate_request_hash(timestamp, data.number, amount_str)

    sender_name = _sanitize_name(user.get("name"))
    confirmation_mobile = data.number if data.recharge_type == "mobile" else (user.get("mobile") or INITIATOR_ID)

    body = {
        "initiator_id": INITIATOR_ID,
        "source_ip": SOURCE_IP,
        "user_code": USER_CODE,
        "amount": amount_str,
        "client_ref_id": client_ref_id,
        "utility_acc_no": data.number,
        "confirmation_mobile_no": confirmation_mobile,
        "sender_name": sender_name,
        "operator_id": str(data.operator_id),
        "latlong": DEFAULT_LATLONG
    }

    eko_url = f"{BASE_URL}/v2/billpayments/paybill?initiator_id={INITIATOR_ID}"
    logging.info(f"[RECHARGE] Calling Eko: user={data.user_id}, type={data.recharge_type}, "
                 f"number={data.number}, amount=₹{int_amount}, prc={total_prc:.2f}, ref={client_ref_id}")

    eko_response = {}
    tid = None
    tx_status = -1
    eko_message = ""
    final_status = "failed"

    eko_status = None
    eko_message = ""
    eko_response = {}
    tid = None

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(eko_url, headers=headers, json=body)

        eko_response = response.json()
        eko_status = eko_response.get("status")
        eko_message = eko_response.get("message", "")
        eko_data = eko_response.get("data", {}) if isinstance(eko_response.get("data"), dict) else {}
        tid = eko_data.get("tid")
        tx_status = _parse_tx_status(eko_data.get("tx_status"))

        logging.info(f"[RECHARGE] Eko response: http={response.status_code}, status={eko_status}, "
                     f"tx_status={tx_status}, tid={tid}, msg={eko_message[:100]}")

        if eko_status == EkoStatus.SUCCESS:
            if tx_status == TxStatus.SUCCESS:
                final_status = "success"
            elif tx_status == TxStatus.RESPONSE_AWAITED:
                final_status = "pending"
            elif tx_status == TxStatus.ON_HOLD:
                final_status = "pending"
            elif tx_status == TxStatus.FAILED:
                final_status = "failed"
            elif tx_status == TxStatus.REFUND_PENDING:
                final_status = "failed"
            elif tx_status == TxStatus.REFUNDED:
                final_status = "failed"
            else:
                # Unknown tx_status — treat as pending, check via enquiry API
                logging.warning(f"[RECHARGE] Unknown tx_status={tx_status}, treating as pending")
                final_status = "pending"
        elif eko_status == EkoStatus.INSUFFICIENT_BALANCE:
            logging.error("[RECHARGE] Eko wallet insufficient balance (347)")
            final_status = "failed"
        elif eko_status == EkoStatus.USER_NOT_FOUND:
            logging.error(f"[RECHARGE] Eko user not found (463): {eko_message}")
            final_status = "failed"
        elif eko_status == EkoStatus.BANK_NOT_AVAILABLE:
            logging.error(f"[RECHARGE] Operator/bank not available (544): {eko_message}")
            final_status = "failed"
        elif eko_status == EkoStatus.ERROR_FROM_NPCI:
            logging.error(f"[RECHARGE] NPCI error (55): {eko_message}")
            final_status = "failed"
        elif eko_status == EkoStatus.MONTHLY_LIMIT_EXCEEDED:
            logging.error(f"[RECHARGE] Eko monthly limit exceeded (314): {eko_message}")
            final_status = "failed"
        else:
            logging.error(f"[RECHARGE] Eko status={eko_status}, msg={eko_message[:100]}")
            final_status = "failed"

    except httpx.TimeoutException:
        logging.error(f"[RECHARGE] Eko API TIMEOUT for ref={client_ref_id}")
        eko_message = "timeout"
        eko_response = {"error": "timeout", "message": eko_message}
        final_status = "pending"
    except httpx.ConnectError as ce:
        logging.error(f"[RECHARGE] Eko CONNECTION ERROR: {ce}")
        eko_message = "connection error"
        eko_response = {"error": "connection_error", "message": str(ce)}
        final_status = "failed"
    except Exception as e:
        logging.error(f"[RECHARGE] Eko UNEXPECTED ERROR: {e}")
        eko_message = str(e)
        eko_response = {"error": "unexpected", "message": eko_message}
        final_status = "failed"

    # ===== Step 10: Handle result =====
    now_iso = datetime.now(timezone.utc).isoformat()
    user_name = user.get("name", "")
    user_mobile = user.get("mobile", "")

    if final_status in ("success", "pending"):
        # CRITICAL: Once Eko confirms success, ALWAYS return success to user.
        # Even if our DB recording fails, the recharge already went through.
        try:
            return await _handle_success(
                data, request_id, client_ref_id, tid, final_status, total_prc,
                charges, req_type, user_name, user_mobile, now_iso
            )
        except Exception as e:
            logging.critical(f"[RECHARGE] !! Eko SUCCESS but recording FAILED: {e} | "
                             f"user={data.user_id}, tid={tid}, ref={client_ref_id}, amount=₹{int_amount}")
            return {
                "success": True,
                "message": "Recharge successful!" if final_status == "success" else "Recharge is being processed.",
                "request_id": request_id,
                "amount": float(int_amount),
                "prc_deducted": round(total_prc, 2),
                "status": final_status,
                "tid": tid
            }
    else:
        try:
            return await _handle_failure(
                data, request_id, client_ref_id, tid, total_prc,
                user_name, user_mobile, now_iso, eko_message, eko_status
            )
        except Exception as e:
            logging.error(f"[RECHARGE] Failure handler crashed: {e} | user={data.user_id}, ref={client_ref_id}")
            return {"success": False, "message": GENERIC_ERROR, "request_id": request_id}


async def _handle_success(data, request_id, client_ref_id, tid, status,
                           total_prc, charges, req_type, user_name, user_mobile,
                           now_iso):
    """Record successful/pending recharge — PRC stays deducted.
    Updates the pre-inserted pending record and adds bill_payment_requests + PRC statement."""
    amount_inr = float(int(data.amount))

    # 1. UPDATE the pre-inserted pending record in recharge_transactions
    try:
        await db.recharge_transactions.update_one(
            {"request_id": request_id},
            {"$set": {
                "eko_tid": tid,
                "status": status,
                "updated_at": now_iso
            }}
        )
    except Exception as e:
        logging.error(f"[RECHARGE] recharge_transactions update failed (non-fatal): {e}")

    # 2. Record in bill_payment_requests for Admin BBPS dashboard
    try:
        bill_record = {
            "request_id": request_id,
            "user_id": data.user_id,
            "user_name": user_name,
            "user_mobile": user_mobile,
            "request_type": req_type,
            "service_type": req_type,
            "amount_inr": amount_inr,
            "amount": amount_inr,
            "prc_required": round(charges.get("amount_prc", 0), 2),
            "processing_fee_inr": round(charges.get("processing_fee_inr", 0), 2),
            "processing_fee_prc": round(charges.get("processing_fee_prc", 0), 2),
            "admin_charge_inr": round(charges.get("admin_charge_inr", 0), 2),
            "admin_charge_prc": round(charges.get("admin_charge_prc", 0), 2),
            "admin_charge_percent": charges.get("admin_charge_percent", 20),
            "total_inr": round(charges.get("total_inr", 0), 2),
            "total_prc_deducted": round(total_prc, 2),
            "details": {
                "number": data.number,
                "operator_id": data.operator_id,
                "recharge_type": data.recharge_type
            },
            "status": "paid" if status == "success" else "pending",
            "eko_tid": tid,
            "client_ref_id": client_ref_id,
            "created_at": now_iso,
            "processed_at": now_iso if status == "success" else None
        }
        await db.bill_payment_requests.insert_one(bill_record)
    except Exception as e:
        logging.error(f"[RECHARGE] bill_payment_requests insert failed (non-fatal): {e}")

    # 3. PRC statement log
    if log_transaction_func:
        try:
            label = "Mobile" if data.recharge_type == "mobile" else "DTH"
            await log_transaction_func(
                user_id=data.user_id,
                wallet_type="prc",
                transaction_type="bill_payment_request",
                amount=total_prc,
                description=f"{label} Recharge: {data.number} - ₹{int(data.amount)} (Ref: {request_id[:8]})",
                metadata={
                    "request_id": request_id,
                    "recharge_type": data.recharge_type,
                    "amount_inr": amount_inr,
                    "operator_id": data.operator_id
                },
                skip_balance_update=True
            )
        except Exception as e:
            logging.error(f"[RECHARGE] PRC statement log failed (non-fatal): {e}")

    msg = "Recharge successful!" if status == "success" else "Recharge is being processed. Please check status shortly."
    logging.info(f"[RECHARGE] {status.upper()}: user={data.user_id}, tid={tid}, ref={client_ref_id}")

    return {
        "success": True,
        "message": msg,
        "request_id": request_id,
        "amount": amount_inr,
        "prc_deducted": round(total_prc, 2),
        "status": status,
        "tid": tid
    }


async def _handle_failure(data, request_id, client_ref_id, tid,
                           total_prc, user_name, user_mobile,
                           now_iso, eko_message, eko_status=None):
    """Refund PRC and update pre-inserted pending record to failed.
    Error message logic (as per user requirement):
    - Low balance (347) / Service not enabled (463) / Internal errors (None) → Generic "Technical error"
    - All other Eko failures → Show actual Eko error message to user
    """
    # Refund PRC
    await db.users.update_one(
        {"uid": data.user_id},
        {"$inc": {"prc_balance": total_prc}}
    )
    logging.info(f"[RECHARGE] PRC refunded: {total_prc:.2f} to user {data.user_id}")

    # UPDATE the pre-inserted pending record to failed
    try:
        await db.recharge_transactions.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "failed",
                "total_prc_deducted": 0,
                "prc_refunded": True,
                "eko_tid": tid,
                "eko_error": eko_message or "",
                "eko_status": eko_status,
                "updated_at": now_iso
            }}
        )
    except Exception as e:
        logging.error(f"[RECHARGE] Failed txn update error (non-fatal): {e}")

    logging.warning(f"[RECHARGE] FAILED: user={data.user_id}, ref={client_ref_id}, "
                    f"eko_status={eko_status}, eko_msg={eko_message[:100] if eko_message else 'none'}")

    # Decide user-facing message using smart mapping
    user_message = _get_user_friendly_message(eko_message, eko_status)

    return {
        "success": False,
        "message": user_message,
        "request_id": request_id
    }


# ===== 5. RECHARGE HISTORY =====

@router.get("/history/{user_id}")
async def get_recharge_history(user_id: str):
    """Get user's recharge transaction history + daily & monthly remaining limits"""
    if db is None:
        return {"success": False, "transactions": []}

    txns = await db.recharge_transactions.find(
        {"user_id": user_id},
        {"_id": 0, "eko_response": 0, "eko_error": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    # Calculate today's remaining
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": today_start}, "status": {"$nin": ["failed", "refunded"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
    ]
    agg = await db.recharge_transactions.aggregate(pipeline).to_list(1)
    today_used = agg[0]["total"] if agg else 0

    # Calculate monthly remaining (Eko + BBPS utility)
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    eko_m_pipe = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": month_start}, "status": {"$nin": ["failed", "refunded"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
    ]
    eko_m = await db.recharge_transactions.aggregate(eko_m_pipe).to_list(1)
    eko_month = eko_m[0]["total"] if eko_m else 0

    bbps_m_pipe = [
        {"$match": {
            "user_id": user_id,
            "created_at": {"$gte": month_start},
            "service_type": {"$in": MONTHLY_LIMIT_SERVICES},
            "status": {"$in": ["completed", "COMPLETED", "Completed", "approved", "APPROVED", "success", "SUCCESS", "paid", "PAID", "Paid", "processing", "PROCESSING"]}
        }},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$amount_inr", "$amount"]}}}}
    ]
    bbps_m = await db.redeem_requests.aggregate(bbps_m_pipe).to_list(1)
    bbps_month = bbps_m[0]["total"] if bbps_m else 0

    monthly_used = eko_month + bbps_month

    return {
        "success": True,
        "transactions": txns,
        "count": len(txns),
        "daily_limit": MAX_DAILY_TOTAL,
        "daily_used": today_used,
        "daily_remaining": max(0, MAX_DAILY_TOTAL - today_used),
        "monthly_limit": MAX_MONTHLY_UTILITY,
        "monthly_used": monthly_used,
        "monthly_remaining": max(0, MAX_MONTHLY_UTILITY - monthly_used)
    }

    return {"success": True, "transactions": txns, "count": len(txns)}
