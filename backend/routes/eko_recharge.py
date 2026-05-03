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
from typing import Optional
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
import asyncio

router = APIRouter(prefix="/recharge", tags=["Recharge"])

# ===== Injected dependencies from server.py =====
db = None
check_redeem_limit_func = None
log_transaction_func = None
calculate_charges_func = None
cache = None


def set_db(database):
    global db
    db = database


def set_cache(cache_instance):
    global cache
    cache = cache_instance


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
# Auto-correct if production .env accidentally has Eko docs sample value
if USER_CODE == "20810200":
    import logging
    logging.warning("[EKO] EKO_USER_CODE is docs sample '20810200' — auto-correcting to real PARAS '19560001'")
    USER_CODE = "19560001"
SOURCE_IP = os.environ.get("EKO_SOURCE_IP", "34.44.149.98")
DEFAULT_LATLONG = "19.9975,73.7898"

MAX_RECHARGE_AMOUNT = 500
MAX_DAILY_TOTAL = 500
MAX_MONTHLY_UTILITY = 1500
GENERIC_ERROR = "Service temporarily unavailable. Please try again later."

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
    LOW_BALANCE_208 = 208        # Undocumented: OkeyKey low balance
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
HIDDEN_STATUS_CODES = {347, 208}  # Hide Eko wallet balance issues from user

ERROR_MESSAGE_MAP = {
    # === Most specific patterns FIRST ===
    # Low balance (hidden)
    "insufficient balance": "Service temporarily unavailable. Please try again later.",
    "low balance": "Service temporarily unavailable. Please try again later.",
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
    """Show real Eko error to user (as per Eko developer docs).
    Only hides: Eko wallet insufficient balance (347) → 'Technical error'.
    Everything else: clean Eko message shown directly."""
    if not eko_message:
        return GENERIC_ERROR

    # Hide only Eko wallet insufficient balance (347)
    if eko_status in HIDDEN_STATUS_CODES:
        return GENERIC_ERROR

    # Clean the ugly Eko prefix patterns:
    # "utility.payment.failed Last_used_OkeyKey: N <actual message>"
    # "utility.payment.failed <actual message>"
    import re
    clean = eko_message.strip()
    # Remove "utility.payment.failed" prefix
    clean = re.sub(r'^utility\.payment\.failed\s*', '', clean, flags=re.IGNORECASE)
    # Remove "Last_used_OkeyKey: N" prefix
    clean = re.sub(r'^Last_used_OkeyKey:\s*\d+\s*', '', clean, flags=re.IGNORECASE)
    # Remove leading dashes/colons
    clean = re.sub(r'^[-:.\s]+', '', clean).strip()

    if not clean:
        return eko_message.strip()[:150] if eko_message else GENERIC_ERROR

    # Capitalize first letter
    if clean[0].islower():
        clean = clean[0].upper() + clean[1:]

    # Truncate if too long
    if len(clean) > 200:
        clean = clean[:197] + "..."

    return clean



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


# ===== 3.5. FETCH BILL (for DTH/operators requiring fetchBill) =====

class FetchBillRequest(BaseModel):
    user_id: str
    number: str  # subscriber ID / utility_acc_no
    operator_id: str
    sender_name: str = ""
    confirmation_mobile: str = ""


@router.post("/fetch-bill")
async def fetch_bill(data: FetchBillRequest):
    """
    Fetch bill for operators that require fetchBill=1.
    As per: https://developers.eko.in/reference/bbps-fetch-bill
    Must be called BEFORE paybill for operators with fetchBill flag.
    """
    if db is None or not _eko_configured():
        return {"success": False, "error": "Service not configured"}

    await _ensure_service_activated()

    user = await db.users.find_one({"uid": data.user_id}, {"_id": 0, "name": 1, "mobile": 1})
    if not user:
        return {"success": False, "error": "User not found"}

    sender_name = _sanitize_name(data.sender_name or user.get("name", "User"))
    confirmation_mobile = data.confirmation_mobile or user.get("mobile") or INITIATOR_ID
    client_ref_id = f"FB{int(time.time() * 1000)}"

    try:
        timestamp = str(round(time.time() * 1000))
        headers = _generate_headers(timestamp)

        # Build query params for fetchBill GET request
        params = {
            "initiator_id": INITIATOR_ID,
            "user_code": USER_CODE,
            "client_ref_id": client_ref_id,
            "utility_acc_no": data.number,
            "confirmation_mobile_no": confirmation_mobile,
            "sender_name": sender_name,
            "operator_id": str(data.operator_id),
            "source_ip": SOURCE_IP,
            "latlong": DEFAULT_LATLONG
        }

        # Try v2 endpoint first (consistent with our paybill)
        url = f"{BASE_URL}/v2/billpayments/fetchbill"
        logging.info(f"[RECHARGE] FetchBill: operator={data.operator_id}, number={data.number}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers, params=params)

        result = response.json()
        eko_status = result.get("status")
        logging.info(f"[RECHARGE] FetchBill response: status={eko_status}, msg={result.get('message', '')[:100]}")

        if eko_status == 0:
            bill_data = result.get("data", {})
            return {
                "success": True,
                "bill": {
                    "customer_name": bill_data.get("utilitycustomername", ""),
                    "amount": bill_data.get("amount", ""),
                    "bill_date": bill_data.get("billdate", ""),
                    "bill_number": bill_data.get("billnumber", ""),
                    "billfetchresponse": bill_data.get("billfetchresponse", ""),
                    "customer_id": bill_data.get("customer_id", "")
                }
            }
        else:
            user_msg = _get_user_friendly_message(result.get("message", ""), eko_status)
            return {"success": False, "error": user_msg}

    except httpx.TimeoutException:
        return {"success": False, "error": "Network timeout. Please try again."}
    except Exception as e:
        logging.error(f"[RECHARGE] FetchBill error: {e}")
        return {"success": False, "error": GENERIC_ERROR}


# ===== 4. INITIATE RECHARGE =====

class RechargeRequest(BaseModel):
    user_id: str
    recharge_type: str
    number: str
    operator_id: str
    amount: float
    billfetchresponse: str = ""  # Required for operators with fetchBill=1


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
        return {"success": False, "message": "You've reached your daily recharge limit. No worries! Keep collecting reward points to continue tomorrow.", "error_ref": "R03"}

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
        return {"success": False, "message": "You've reached your monthly recharge limit. No worries! Keep collecting reward points to continue next month.", "error_ref": "R03M"}

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

    # Add billfetchresponse for DTH operators that require fetchBill
    if data.billfetchresponse:
        body["billfetchresponse"] = data.billfetchresponse

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
        elif eko_status == EkoStatus.LOW_BALANCE_208:
            logging.error(f"[RECHARGE] Eko OkeyKey low balance (208): {eko_message}")
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

    # Create community Success Story post (fire-and-forget)
    if status == "success":
        try:
            from routes.community import create_success_story_post
            service_key = "mobile_recharge" if data.recharge_type == "mobile" else "dth_recharge"
            await create_success_story_post(
                user_id=data.user_id,
                service_type=service_key,
                amount_inr=amount_inr,
                ref_id=f"recharge:{tid or request_id}",
            )
        except Exception as e:
            logging.warning(f"[SUCCESS STORY] recharge trigger failed (non-fatal): {e}")

        # Sustainability auto-burn (1% of post-deduction balance, threshold 30k)
        try:
            from routes.sustainability_burn import apply_sustainability_burn
            burn_service = "mobile_recharge" if data.recharge_type == "mobile" else "dth_recharge"
            await apply_sustainability_burn(
                user_id=data.user_id,
                service_type=burn_service,
                service_ref_id=request_id,
                amount_inr=amount_inr,
            )
        except Exception as e:
            logging.warning(f"[SUSTAIN-BURN] recharge hook failed (non-fatal): {e}")

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

    # Reverse any sustainability auto-burn applied for this transaction
    try:
        from routes.sustainability_burn import reverse_sustainability_burn
        burn_service = "mobile_recharge" if data.recharge_type == "mobile" else "dth_recharge"
        await reverse_sustainability_burn(
            user_id=data.user_id,
            service_type=burn_service,
            service_ref_id=request_id,
        )
    except Exception as e:
        logging.warning(f"[SUSTAIN-BURN] recharge refund reversal failed (non-fatal): {e}")

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



# ===== USER: Get Transaction Receipt =====

@router.get("/receipt/{request_id}")
async def get_transaction_receipt(request_id: str, user_id: str = ""):
    """Get detailed receipt for a recharge transaction (user-facing)"""
    if db is None:
        return {"success": False, "error": "Service not configured"}

    query = {"request_id": request_id}
    if user_id:
        query["user_id"] = user_id

    txn = await db.recharge_transactions.find_one(query, {"_id": 0})
    if not txn:
        return {"success": False, "error": "Transaction not found"}

    label = "Mobile Recharge" if txn.get("recharge_type") == "mobile" else "DTH Recharge"
    status_label = {
        "success": "Successful",
        "pending": "Processing",
        "failed": "Failed",
        "refunded": "Refunded",
        "refund_pending": "Refund Pending"
    }.get(txn.get("status", ""), txn.get("status", "Unknown"))

    return {
        "success": True,
        "receipt": {
            "request_id": txn.get("request_id"),
            "type": label,
            "recharge_type": txn.get("recharge_type"),
            "number": txn.get("number"),
            "operator_id": txn.get("operator_id"),
            "amount_inr": txn.get("amount_inr", 0),
            "total_prc_deducted": txn.get("total_prc_deducted", 0),
            "prc_required": txn.get("prc_required", 0),
            "processing_fee_prc": txn.get("processing_fee_prc", 0),
            "admin_charge_prc": txn.get("admin_charge_prc", 0),
            "status": txn.get("status"),
            "status_label": status_label,
            "eko_tid": txn.get("eko_tid"),
            "created_at": txn.get("created_at"),
            "updated_at": txn.get("updated_at"),
            "prc_refunded": txn.get("prc_refunded", False),
            "user_name": txn.get("user_name", ""),
            "user_mobile": txn.get("user_mobile", "")
        }
    }


# ===== USER: Retry Failed Recharge =====

class RetryRequest(BaseModel):
    user_id: str

@router.post("/retry/{request_id}")
async def retry_failed_recharge(request_id: str, data: RetryRequest):
    """Retry a failed recharge by creating a new recharge request with same params"""
    if db is None:
        return {"success": False, "error": "Service not configured"}

    txn = await db.recharge_transactions.find_one(
        {"request_id": request_id, "user_id": data.user_id},
        {"_id": 0}
    )
    if not txn:
        return {"success": False, "error": "Transaction not found"}

    if txn.get("status") not in ("failed", "refunded", "refund_pending"):
        return {"success": False, "error": "Only failed/refunded transactions can be retried"}

    # Build a new recharge request with same params
    return {
        "success": True,
        "retry_data": {
            "recharge_type": txn.get("recharge_type"),
            "number": txn.get("number"),
            "operator_id": txn.get("operator_id"),
            "amount": txn.get("amount_inr", 0)
        }
    }



# ===== ADMIN: Fetch Transaction Status from Eko =====

@router.get("/admin/enquiry/{request_id}")
async def admin_enquiry_status(request_id: str):
    """
    Admin: Check live transaction status from Eko using Transaction Enquiry API.
    As per: https://developers.eko.in — GET /v1/transactions/{id}
    """
    if db is None or not _eko_configured():
        return {"success": False, "error": "Service not configured"}

    # Find the transaction
    txn = await db.recharge_transactions.find_one(
        {"request_id": request_id},
        {"_id": 0, "eko_tid": 1, "client_ref_id": 1, "status": 1, "user_id": 1}
    )
    if not txn:
        return {"success": False, "error": "Transaction not found"}

    # Use eko_tid if available, else client_ref_id
    eko_tid = txn.get("eko_tid")
    client_ref = txn.get("client_ref_id")
    lookup_id = eko_tid if eko_tid else f"client_ref_id:{client_ref}"

    if not lookup_id:
        return {"success": False, "error": "No TID or reference ID available"}

    try:
        timestamp = str(round(time.time() * 1000))
        headers = _generate_headers(timestamp)

        url = f"{BASE_URL}/v1/transactions/{lookup_id}"
        logging.info(f"[RECHARGE] Admin enquiry: request={request_id}, lookup={lookup_id}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers, params={
                "initiator_id": INITIATOR_ID,
                "user_code": USER_CODE
            })

        result = response.json()
        eko_status = result.get("status")
        eko_data = result.get("data", {})
        tx_status = _parse_tx_status(eko_data.get("tx_status"))

        # Map tx_status to readable label
        status_labels = {
            TxStatus.SUCCESS: "Success",
            TxStatus.FAILED: "Failed",
            TxStatus.RESPONSE_AWAITED: "Response Awaited",
            TxStatus.REFUND_PENDING: "Refund Pending",
            TxStatus.REFUNDED: "Refunded",
            TxStatus.ON_HOLD: "On Hold"
        }
        readable_status = status_labels.get(tx_status, f"Unknown ({tx_status})")

        # Map tx_status to internal status
        new_status = None
        if tx_status == TxStatus.SUCCESS:
            new_status = "success"
        elif tx_status == TxStatus.FAILED:
            new_status = "failed"
        elif tx_status == TxStatus.REFUND_PENDING:
            new_status = "refund_pending"
        elif tx_status == TxStatus.REFUNDED:
            new_status = "refunded"
        elif tx_status in (TxStatus.RESPONSE_AWAITED, TxStatus.ON_HOLD):
            new_status = "pending"

        old_status = txn.get("status")
        now_iso = datetime.now(timezone.utc).isoformat()
        prc_auto_refunded = False

        if new_status and new_status != old_status:
            update_fields = {"status": new_status, "eko_enquiry_at": now_iso}
            if eko_data.get("tid"):
                update_fields["eko_tid"] = eko_data["tid"]
            await db.recharge_transactions.update_one(
                {"request_id": request_id},
                {"$set": update_fields}
            )
            # bill_payment_requests uses "paid" for success
            bp_status = "paid" if new_status == "success" else new_status
            await db.bill_payment_requests.update_one(
                {"request_id": request_id},
                {"$set": {"status": bp_status, "eko_tid": eko_data.get("tid"), "updated_at": now_iso}}
            )
            logging.info(f"[RECHARGE] Status updated: {old_status} → {new_status} for {request_id}")

            # Auto-refund PRC when transitioning to failed/refund_pending/refunded from pending
            if new_status in ("failed", "refund_pending", "refunded") and old_status in ("pending", "processing"):
                full_txn = await db.recharge_transactions.find_one(
                    {"request_id": request_id},
                    {"_id": 0, "user_id": 1, "total_prc_deducted": 1, "prc_refunded": 1}
                )
                if full_txn and not full_txn.get("prc_refunded") and full_txn.get("total_prc_deducted", 0) > 0:
                    prc_amt = full_txn["total_prc_deducted"]
                    await db.users.update_one(
                        {"uid": full_txn["user_id"]},
                        {"$inc": {"prc_balance": prc_amt}}
                    )
                    await db.recharge_transactions.update_one(
                        {"request_id": request_id},
                        {"$set": {"prc_refunded": True, "refund_at": now_iso, "total_prc_deducted": 0}}
                    )
                    await db.bill_payment_requests.update_one(
                        {"request_id": request_id},
                        {"$set": {"prc_refunded": True}}
                    )
                    prc_auto_refunded = True
                    logging.info(f"[RECHARGE] Auto PRC refund: {prc_amt} PRC → user {full_txn['user_id']} (enquiry status change)")

        return {
            "success": True,
            "eko_status": eko_status,
            "tx_status": tx_status,
            "tx_status_label": readable_status,
            "message": result.get("message", ""),
            "eko_tid": eko_data.get("tid", eko_tid),
            "amount": eko_data.get("amount", ""),
            "old_status": old_status,
            "new_status": new_status or old_status,
            "status_changed": new_status is not None and new_status != old_status,
            "prc_auto_refunded": prc_auto_refunded
        }

    except httpx.TimeoutException:
        return {"success": False, "error": "Eko API timeout. Please try again."}
    except Exception as e:
        logging.error(f"[RECHARGE] Admin enquiry error: {e}")
        return {"success": False, "error": str(e)}



# ===== ADMIN: Check ALL pending transactions via Eko enquiry =====

@router.post("/admin/check-all-pending")
async def admin_check_all_pending():
    """
    Admin: Bulk-check all pending recharge transactions via Eko Enquiry API.
    Updates status for each pending transaction found on Eko's side.
    """
    if db is None or not _eko_configured():
        return {"success": False, "error": "Service not configured"}

    pending_txns = await db.recharge_transactions.find(
        {"status": "pending"},
        {"_id": 0, "request_id": 1, "eko_tid": 1, "client_ref_id": 1, "created_at": 1, "user_id": 1}
    ).sort("created_at", -1).limit(50).to_list(50)

    if not pending_txns:
        return {"success": True, "message": "No pending transactions found", "results": []}

    results = []
    updated_count = 0
    failed_count = 0

    for txn in pending_txns:
        req_id = txn.get("request_id")
        eko_tid = txn.get("eko_tid")
        client_ref = txn.get("client_ref_id")
        lookup_id = eko_tid if eko_tid else (f"client_ref_id:{client_ref}" if client_ref else None)

        if not lookup_id:
            results.append({"request_id": req_id, "status": "skipped", "reason": "No TID or client_ref_id"})
            continue

        try:
            timestamp = str(round(time.time() * 1000))
            headers = _generate_headers(timestamp)
            url = f"{BASE_URL}/v1/transactions/{lookup_id}"

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers=headers, params={
                    "initiator_id": INITIATOR_ID,
                    "user_code": USER_CODE
                })

            result = response.json()
            eko_data = result.get("data", {})
            tx_status = _parse_tx_status(eko_data.get("tx_status"))
            now_iso = datetime.now(timezone.utc).isoformat()

            new_status = None
            if tx_status == TxStatus.SUCCESS:
                new_status = "success"
            elif tx_status == TxStatus.FAILED:
                new_status = "failed"
            elif tx_status == TxStatus.REFUND_PENDING:
                new_status = "refund_pending"
            elif tx_status == TxStatus.REFUNDED:
                new_status = "refunded"

            if new_status and new_status != "pending":
                update_fields = {"status": new_status, "eko_enquiry_at": now_iso}
                if eko_data.get("tid"):
                    update_fields["eko_tid"] = eko_data["tid"]
                await db.recharge_transactions.update_one(
                    {"request_id": req_id},
                    {"$set": update_fields}
                )
                bp_status = "paid" if new_status == "success" else new_status
                await db.bill_payment_requests.update_one(
                    {"request_id": req_id},
                    {"$set": {"status": bp_status, "eko_tid": eko_data.get("tid"), "updated_at": now_iso}}
                )

                # Auto-refund PRC if failed
                if new_status in ("failed", "refund_pending", "refunded"):
                    full_txn = await db.recharge_transactions.find_one(
                        {"request_id": req_id},
                        {"_id": 0, "user_id": 1, "total_prc_deducted": 1, "prc_refunded": 1}
                    )
                    if full_txn and not full_txn.get("prc_refunded") and full_txn.get("total_prc_deducted", 0) > 0:
                        prc_amt = full_txn["total_prc_deducted"]
                        await db.users.update_one(
                            {"uid": full_txn["user_id"]},
                            {"$inc": {"prc_balance": prc_amt}}
                        )
                        await db.recharge_transactions.update_one(
                            {"request_id": req_id},
                            {"$set": {"prc_refunded": True, "refund_at": now_iso, "total_prc_deducted": 0}}
                        )

                updated_count += 1
                results.append({"request_id": req_id, "old": "pending", "new": new_status, "eko_tid": eko_data.get("tid")})
                logging.info(f"[BULK ENQUIRY] {req_id}: pending → {new_status}")
            else:
                results.append({"request_id": req_id, "status": "still_pending", "tx_status": tx_status})

            # Small delay to avoid Eko rate limiting
            await asyncio.sleep(0.5)

        except Exception as e:
            failed_count += 1
            results.append({"request_id": req_id, "status": "error", "reason": str(e)[:100]})

    return {
        "success": True,
        "total_checked": len(pending_txns),
        "updated": updated_count,
        "errors": failed_count,
        "results": results
    }



# ===== ADMIN: Refund PRC for failed/pending transactions =====

class RefundRequest(BaseModel):
    admin_note: str = ""


@router.post("/admin/refund/{request_id}")
async def admin_refund_prc(request_id: str, data: RefundRequest = RefundRequest()):
    """
    Admin: Refund PRC for a failed/pending transaction.
    Only allowed if PRC was not already refunded.
    """
    if db is None:
        return {"success": False, "error": "Service not configured"}

    # Find the transaction
    txn = await db.recharge_transactions.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    if not txn:
        return {"success": False, "error": "Transaction not found"}

    # Check if already refunded
    if txn.get("prc_refunded"):
        return {"success": False, "error": "PRC already refunded for this transaction"}

    # Check if status allows refund (failed, pending — not success)
    if txn.get("status") in ("success", "paid"):
        return {"success": False, "error": "Cannot refund a successful transaction"}

    prc_amount = txn.get("total_prc_deducted", 0)
    if prc_amount <= 0:
        return {"success": False, "error": "No PRC to refund (amount is 0)"}

    user_id = txn.get("user_id")

    # Refund PRC to user
    refund_result = await db.users.update_one(
        {"uid": user_id},
        {"$inc": {"prc_balance": prc_amount}}
    )
    if refund_result.modified_count == 0:
        return {"success": False, "error": "User not found or PRC update failed"}

    # Mark transaction as refunded
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.recharge_transactions.update_one(
        {"request_id": request_id},
        {"$set": {
            "prc_refunded": True,
            "status": "refunded",
            "refund_at": now_iso,
            "admin_refund_note": data.admin_note
        }}
    )
    # Also update bill_payment_requests if exists
    await db.bill_payment_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "refunded", "prc_refunded": True}}
    )

    logging.info(f"[RECHARGE] Admin PRC refund: {prc_amount:.2f} PRC → user {user_id}, request={request_id}")

    return {
        "success": True,
        "message": f"₹{prc_amount:.2f} PRC refunded successfully",
        "prc_refunded": prc_amount,
        "user_id": user_id
    }



# ==================== USER-FACING REFUND OTP FLOW ====================
# Dashboard-blocking refund modal: users with refund_pending (tx_status=3)
# must process refund before accessing dashboard.
#
# Eko Refund Flow (v1 docs — https://developers.eko.in/v1/reference/refund):
#   1. Resend Refund OTP → POST /v1/transactions/{tid}/refund/otp
#      Response includes data.otp (the actual OTP value)
#   2. Initiate Refund    → POST /v2/transactions/{tid}/refund
#      Pass the OTP from step 1 + initiator_id, user_code, state=1
#   Both steps are done server-side in a SINGLE call from the user's perspective.
#
#   Ref: https://developers.eko.in/v1/reference/resend-refund-otp-1
#   Ref: https://developers.eko.in/v1/reference/refund


def _build_eko_headers():
    """Build Eko authentication headers (millisecond timestamp)."""
    timestamp = str(round(time.time() * 1000))
    encoded_key = base64.b64encode(AUTH_KEY.encode())
    secret_key = base64.b64encode(
        hmac.new(encoded_key, timestamp.encode(), hashlib.sha256).digest()
    ).decode()
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/x-www-form-urlencoded",
    }


def _eko_credentials_valid():
    """Check all required Eko credentials are set."""
    return all([BASE_URL, DEVELOPER_KEY, AUTH_KEY, INITIATOR_ID, USER_CODE])


REFUND_COLLECTIONS = [
    ("recharge_transactions", "recharge"),
    ("bill_payment_requests", "bill_payment"),
    ("dmt_transactions", "dmt"),
    ("bank_transfer_requests", "bank_transfer"),
]


async def _find_user_txn(tid: str, user_id: str, fields: dict = None):
    """Find a transaction by eko_tid + user_id across all 4 collections.
    Also tries matching by client_ref_id fallback (used for DMT/BBPS PAY-prefixed IDs).
    """
    projection = fields or {"_id": 0, "status": 1, "user_id": 1}

    for coll_name, _source in REFUND_COLLECTIONS:
        coll = db[coll_name]
        # Try eko_tid first (primary key)
        txn = await coll.find_one(
            {"eko_tid": tid, "user_id": user_id}, projection
        )
        if txn:
            txn["_source_collection"] = coll_name
            return txn
        # Try client_ref_id / eko_client_ref_id fallback
        txn = await coll.find_one(
            {"$or": [
                {"client_ref_id": tid, "user_id": user_id},
                {"eko_client_ref_id": tid, "user_id": user_id},
            ]},
            projection
        )
        if txn:
            txn["_source_collection"] = coll_name
            return txn
    return None


async def _mark_refunded(tid: str, user_id: str, refund_data: dict, txn: dict):
    """Update DB status to refunded across all collections, auto-refund PRC, log, invalidate cache."""
    now_iso = datetime.now(timezone.utc).isoformat()

    refund_patch = {
        "status": "refunded",
        "eko_refund_tid": refund_data.get("refund_tid"),
        "eko_refunded_amount": refund_data.get("refunded_amount"),
        "eko_refunded_at": now_iso,
        "refund_method": "user_otp",
        "updated_at": now_iso,
    }

    # Update all 4 collections (match eko_tid OR client_ref_id)
    match_q = {"$or": [
        {"eko_tid": tid},
        {"client_ref_id": tid},
        {"eko_client_ref_id": tid},
    ]}
    for coll_name, _src in REFUND_COLLECTIONS:
        await db[coll_name].update_many(match_q, {"$set": refund_patch})

    # Auto-refund PRC
    prc_amt = (
        txn.get("total_prc_deducted")
        or txn.get("prc_deducted")
        or txn.get("prc_amount")
        or txn.get("total_prc")
        or 0
    )
    if not txn.get("prc_refunded") and prc_amt > 0:
        await db.users.update_one(
            {"uid": user_id},
            {"$inc": {"prc_balance": prc_amt}}
        )
        for coll_name, _src in REFUND_COLLECTIONS:
            await db[coll_name].update_many(
                match_q,
                {"$set": {"prc_refunded": True, "refund_at": now_iso}}
            )
        logging.info(f"[USER REFUND] PRC refund: {prc_amt} → user {user_id}, tid={tid}")

    # Audit log
    await db.eko_refund_logs.insert_one({
        "tid": tid,
        "otp_verified": True,
        "refund_tid": refund_data.get("refund_tid"),
        "refunded_amount": refund_data.get("refunded_amount") or refund_data.get("amount"),
        "initiated_by": "user",
        "user_id": user_id,
        "source_collection": txn.get("_source_collection"),
        "timestamp": now_iso,
    })

    # Invalidate cache
    if cache:
        try:
            await cache.delete(f"user:dashboard:{user_id}")
            await cache.delete(f"user_data:{user_id}")
        except Exception:
            pass


@router.get("/pending-refunds/{user_id}")
async def get_user_pending_refunds(user_id: str):
    """Get all refund_pending transactions for a user (dashboard blocker).
    Scans all 4 collections: recharge, bill_payment, DMT, bank_transfer.
    Returns rich data: amount, account, bank, beneficiary, service type.

    Controlled by system_config.refund_blocker_modal_enabled flag (default: False/disabled).
    When disabled, returns empty list so no modal blocks the dashboard.
    """
    if db is None:
        return {"success": False, "pending_refunds": []}

    # Global kill switch — admin-controlled
    cfg = await db.system_config.find_one(
        {"key": "refund_blocker_modal_enabled"},
        {"_id": 0, "value": 1}
    )
    enabled = bool(cfg and cfg.get("value"))
    if not enabled:
        return {
            "success": True,
            "pending_refunds": [],
            "count": 0,
            "requires_action": False,
            "modal_disabled": True,
        }

    all_pending = []
    seen_keys = set()

    # 1. Recharge transactions (BBPS Mobile/DTH)
    recharge_pending = await db.recharge_transactions.find(
        {"user_id": user_id, "status": "refund_pending"},
        {"_id": 0, "eko_response": 0, "eko_error": 0}
    ).sort("created_at", -1).to_list(100)
    for txn in recharge_pending:
        key = txn.get("eko_tid") or txn.get("client_ref_id")
        if key and key not in seen_keys:
            seen_keys.add(key)
            all_pending.append({
                "eko_tid": txn.get("eko_tid") or txn.get("client_ref_id") or "",
                "client_ref_id": txn.get("client_ref_id", ""),
                "request_id": txn.get("request_id", ""),
                "amount_inr": txn.get("amount_inr", txn.get("amount", 0)),
                "phone": txn.get("phone", txn.get("consumer_number", "")),
                "customer_mobile": txn.get("customer_mobile", txn.get("phone", txn.get("consumer_number", ""))),
                "operator": txn.get("operator_name", txn.get("operator", "")),
                "created_at": txn.get("created_at", ""),
                "service_type": "Mobile Recharge",
                "source": "recharge",
            })

    # 2. Bill Payment (BBPS Electricity/Gas/Water etc.)
    bill_pending = await db.bill_payment_requests.find(
        {"user_id": user_id, "status": "refund_pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for txn in bill_pending:
        key = txn.get("eko_tid") or txn.get("client_ref_id")
        if key and key not in seen_keys:
            seen_keys.add(key)
            all_pending.append({
                "eko_tid": txn.get("eko_tid") or txn.get("client_ref_id") or "",
                "client_ref_id": txn.get("client_ref_id", ""),
                "request_id": txn.get("request_id", ""),
                "amount_inr": txn.get("amount_inr", txn.get("amount", 0)),
                "phone": txn.get("consumer_number", txn.get("phone", "")),
                "customer_mobile": txn.get("customer_mobile", txn.get("consumer_number", txn.get("phone", ""))),
                "operator": txn.get("operator_name", txn.get("service_type", "")),
                "created_at": txn.get("created_at", ""),
                "service_type": "Bill Payment",
                "source": "bill_payment",
            })

    # 3. DMT transactions (Eko Money Remittance)
    dmt_pending = await db.dmt_transactions.find(
        {"user_id": user_id, "status": "refund_pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for txn in dmt_pending:
        key = txn.get("eko_tid") or txn.get("eko_client_ref_id") or txn.get("client_ref_id")
        if key and key not in seen_keys:
            seen_keys.add(key)
            all_pending.append({
                "eko_tid": txn.get("eko_tid") or txn.get("eko_client_ref_id") or txn.get("client_ref_id") or "",
                "client_ref_id": txn.get("eko_client_ref_id", txn.get("client_ref_id", "")),
                "request_id": txn.get("request_id", ""),
                "amount_inr": txn.get("amount_inr", txn.get("amount", 0)),
                "phone": txn.get("beneficiary_mobile", txn.get("recipient_mobile", "")),
                "customer_mobile": txn.get("customer_mobile", txn.get("sender_mobile", "")),
                "account_number": txn.get("account_number", txn.get("beneficiary_account", "")),
                "ifsc": txn.get("ifsc", txn.get("beneficiary_ifsc", "")),
                "bank_name": txn.get("bank_name", txn.get("beneficiary_bank", "")),
                "beneficiary_name": txn.get("beneficiary_name", txn.get("recipient_name", "")),
                "created_at": txn.get("created_at", ""),
                "service_type": "Money Remittance (DMT)",
                "source": "dmt",
            })

    # 4. Bank transfer requests (Manual bank transfer, may also have Eko linked)
    bt_pending = await db.bank_transfer_requests.find(
        {"user_id": user_id, "status": "refund_pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for txn in bt_pending:
        key = txn.get("eko_tid") or txn.get("eko_client_ref_id") or txn.get("client_ref_id") or txn.get("request_id")
        if key and key not in seen_keys:
            seen_keys.add(key)
            bd = txn.get("bank_details", {}) or {}
            all_pending.append({
                "eko_tid": txn.get("eko_tid") or txn.get("eko_client_ref_id") or txn.get("client_ref_id") or "",
                "client_ref_id": txn.get("eko_client_ref_id", txn.get("client_ref_id", "")),
                "request_id": txn.get("request_id", ""),
                "amount_inr": txn.get("amount_inr", txn.get("amount", 0)),
                "account_number": txn.get("account_number") or bd.get("account_number", ""),
                "ifsc": txn.get("ifsc") or bd.get("ifsc", ""),
                "bank_name": txn.get("bank_name") or bd.get("bank_name", ""),
                "beneficiary_name": txn.get("beneficiary_name") or bd.get("account_holder_name", ""),
                "created_at": txn.get("created_at", ""),
                "service_type": "Bank Transfer",
                "source": "bank_transfer",
            })

    return {
        "success": True,
        "pending_refunds": all_pending,
        "count": len(all_pending),
        "requires_action": len(all_pending) > 0,
    }


class UserRefundRequest(BaseModel):
    user_id: str


@router.post("/refund/process/{tid}")
async def user_process_refund(tid: str, data: UserRefundRequest):
    """
    SEND OTP: Call Eko Resend-Refund-OTP → Eko sends SMS with OTP to customer's registered mobile.
    User then enters OTP manually and calls /refund/verify-otp/{tid} to complete refund.

    In staging/sandbox, Eko sometimes returns OTP inline in data.otp — we still auto-complete
    refund in that case. In production, OTP is SMS-only, so user enters it manually.

    Ref: https://developers.eko.in/v1/reference/resend-refund-otp-1
    """
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    if not _eko_credentials_valid():
        return {"success": False, "error": "Refund service is not configured"}

    # Ownership check — accepts eko_tid OR client_ref_id
    fields = {
        "_id": 0, "status": 1, "user_id": 1, "total_prc_deducted": 1,
        "prc_deducted": 1, "prc_amount": 1, "total_prc": 1,
        "prc_refunded": 1, "request_id": 1, "eko_tid": 1, "client_ref_id": 1,
        "eko_client_ref_id": 1,
    }
    txn = await _find_user_txn(tid, data.user_id, fields)
    if not txn:
        return {"success": False, "tid": tid, "error": "Transaction not found or does not belong to you", "message": "Transaction not found or does not belong to you"}
    if txn.get("status") != "refund_pending":
        return {"success": False, "tid": tid, "error": "This transaction is not in refund pending status", "message": "This transaction is not in refund pending status"}

    # Rate limit: max 5 OTP send attempts per TID per hour (per user)
    # Prevents accidental spam clicks; Eko also rate-limits but we should reject early.
    one_hour_ago = datetime.now(timezone.utc).replace(microsecond=0).timestamp() - 3600
    try:
        recent_otp_count = await db.eko_refund_logs.count_documents({
            "tid": str(tid),
            "user_id": data.user_id,
            "action": "otp_send",
            "ts_epoch": {"$gte": one_hour_ago},
        })
        if recent_otp_count >= 5:
            logging.warning(f"[USER REFUND] Rate limit hit: user={data.user_id} tid={tid} ({recent_otp_count} attempts in last hour)")
            return {
                "success": False,
                "tid": tid,
                "error": "Too many OTP requests. Please wait an hour before trying again.",
                "message": "Too many OTP requests. Please wait an hour before trying again.",
            }
    except Exception as _e:
        logging.warning(f"[USER REFUND] Rate-limit check failed (proceeding): {_e}")

    # Resolve the actual Eko TID to use — Eko V1 API requires the numeric Eko TID.
    # If only client_ref_id is stored (e.g. row created from Excel sync), reject early
    # with a clear message rather than calling Eko with a non-numeric value.
    eko_api_tid = txn.get("eko_tid") or (tid if str(tid).isdigit() else None)
    if not eko_api_tid or not str(eko_api_tid).isdigit():
        logging.warning(f"[USER REFUND] No numeric eko_tid for txn {tid} (user={data.user_id})")
        return {
            "success": False,
            "tid": tid,
            "error": "Eko Transaction ID missing — please contact support to reconcile this entry.",
            "message": "Eko Transaction ID missing — please contact support to reconcile this entry.",
        }

    try:
        headers_otp = _build_eko_headers()
        otp_url = f"{BASE_URL}/v1/transactions/{eko_api_tid}/refund/otp"
        otp_body = {"initiator_id": INITIATOR_ID, "developer_key": DEVELOPER_KEY}

        logging.info(f"[USER REFUND] SendOTP → TID: {eko_api_tid}, user: {data.user_id}")

        async with httpx.AsyncClient(timeout=30) as client:
            otp_response = await client.post(otp_url, headers=headers_otp, data=otp_body)

        logging.info(f"[USER REFUND] OTP HTTP {otp_response.status_code} | {otp_response.text[:300]}")

        try:
            otp_result = otp_response.json()
        except Exception:
            return {"success": False, "error": f"Eko OTP API returned invalid response (HTTP {otp_response.status_code})"}

        # Eko OTP-send quirk (verified in production):
        # When OTP is successfully sent, Eko returns:
        #   status: 0, response_status_id: -1, invalid_params: null,
        #   message: "OTP for failed transaction has been sent to customers mobile..."
        #   data: {tid: "", otp_ref_id: ""}  (empty — refund_tid is generated only on verify)
        #
        # When OTP rejected (e.g. invalid TID), Eko returns:
        #   status: 0, response_status_id: -1, invalid_params: {"tid": "invalid tid"},
        #   data: {tid: "", otp_ref_id: ""}
        #
        # So real success = status:0 AND invalid_params is null/empty.
        # Don't rely on response_status_id (always -1 for OTP send) or data.tid (always empty).
        invalid = otp_result.get("invalid_params")
        is_eko_success = (
            otp_result.get("status") == 0
            and not invalid  # null, {}, or [] — all falsy
        )

        if not is_eko_success:
            err_msg = (
                otp_result.get("message")
                or (f"Invalid TID — Eko rejected the request. {invalid}" if invalid else None)
                or "Failed to send refund OTP"
            )
            # Strip unfilled template tokens like {2} {3} that Eko sometimes returns
            if "{" in err_msg and "}" in err_msg:
                err_msg = "Refund OTP could not be sent. The transaction may be too old, already refunded, or unavailable for refund."
            # Audit failed attempt — counts toward rate limit
            try:
                await db.eko_refund_logs.insert_one({
                    "tid": str(tid),
                    "eko_api_tid": str(eko_api_tid),
                    "user_id": data.user_id,
                    "action": "otp_send",
                    "result": "failed",
                    "eko_response_status_id": otp_result.get("response_status_id"),
                    "eko_invalid_params": otp_result.get("invalid_params"),
                    "eko_message": otp_result.get("message"),
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "ts_epoch": datetime.now(timezone.utc).timestamp(),
                })
            except Exception:
                pass
            return {
                "success": False,
                "error": err_msg,
                "message": err_msg,
                "tid": tid,
                # Diagnostic context (helpful for admin/support; user UI shows just `message`)
                "eko_response_status_id": otp_result.get("response_status_id"),
                "eko_invalid_params": otp_result.get("invalid_params"),
                "eko_raw_message": otp_result.get("message"),
            }

        # Audit successful OTP send
        try:
            await db.eko_refund_logs.insert_one({
                "tid": str(tid),
                "eko_api_tid": str(eko_api_tid),
                "user_id": data.user_id,
                "action": "otp_send",
                "result": "success",
                "ts": datetime.now(timezone.utc).isoformat(),
                "ts_epoch": datetime.now(timezone.utc).timestamp(),
            })
        except Exception:
            pass

        # In staging, Eko sometimes returns OTP inline. In production, it's SMS-only.
        eko_data = otp_result.get("data", {}) or {}
        inline_otp = str(eko_data.get("otp") or "").strip()

        if inline_otp and len(inline_otp) >= 4:
            # Staging: auto-complete refund since we have OTP
            headers_refund = _build_eko_headers()
            refund_url = f"{BASE_URL}/v2/transactions/{eko_api_tid}/refund"
            refund_body = {
                "initiator_id": INITIATOR_ID,
                "user_code": USER_CODE,
                "otp": inline_otp,
                "state": "1",
            }
            async with httpx.AsyncClient(timeout=30) as client:
                refund_response = await client.post(refund_url, headers=headers_refund, data=refund_body)
            try:
                refund_result = refund_response.json()
            except Exception:
                refund_result = {}
            # Real success requires: status==0, data.refund_tid populated, no invalid_params.
            _rd = refund_result.get("data") or {}
            _is_success = (
                refund_result.get("status") == 0
                and (_rd.get("refund_tid") or _rd.get("tid"))
                and not refund_result.get("invalid_params")
            )
            if _is_success:
                refund_data = _rd
                await _mark_refunded(eko_api_tid, data.user_id, refund_data, txn)
                return {
                    "success": True,
                    "tid": tid,
                    "message": "Refund completed successfully!",
                    "refund_tid": refund_data.get("refund_tid"),
                    "refunded_amount": refund_data.get("refunded_amount") or refund_data.get("amount"),
                    "auto_completed": True,
                }

        # Production flow: OTP sent via SMS, user must enter it
        # Eko's raw message sometimes contains unfilled template tokens like '{2} {3}';
        # normalize to a clean user-facing message.
        raw_msg = otp_result.get("message") or ""
        if "{" in raw_msg and "}" in raw_msg:
            friendly_msg = "OTP sent to your registered mobile. Please enter it below."
        else:
            friendly_msg = raw_msg or "OTP sent to your registered mobile. Please enter it below."

        return {
            "success": True,
            "tid": tid,
            "otp_sent": True,
            "message": friendly_msg,
            "mobile_hint": eko_data.get("mobile") or eko_data.get("customer_mobile") or "",
        }

    except httpx.TimeoutException:
        logging.error(f"[USER REFUND] Timeout for TID {tid}")
        return {"success": False, "error": "Request timed out. Please try again."}
    except Exception as e:
        logging.error(f"[USER REFUND] Error for TID {tid}: {e}")
        return {"success": False, "error": "OTP send failed. Please try again later."}


class UserManualRefundOTPRequest(BaseModel):
    user_id: str
    otp: str


@router.post("/refund/verify-otp/{tid}")
async def user_verify_refund_otp(tid: str, data: UserManualRefundOTPRequest):
    """
    MANUAL OTP FALLBACK: If auto-process couldn't get OTP from API response,
    user enters OTP received via SMS and we call Initiate Refund.
    
    Ref: https://developers.eko.in/v1/reference/refund
    """
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    if not _eko_credentials_valid():
        return {"success": False, "error": "Refund service is not configured"}

    fields = {
        "_id": 0, "status": 1, "user_id": 1, "total_prc_deducted": 1,
        "prc_deducted": 1, "prc_amount": 1, "total_prc": 1,
        "prc_refunded": 1, "request_id": 1, "eko_tid": 1, "client_ref_id": 1,
        "eko_client_ref_id": 1,
    }
    txn = await _find_user_txn(tid, data.user_id, fields)
    if not txn:
        return {"success": False, "tid": tid, "error": "Transaction not found or does not belong to you", "message": "Transaction not found or does not belong to you"}
    if txn.get("status") != "refund_pending":
        return {"success": False, "tid": tid, "error": "This transaction is not in refund pending status", "message": "This transaction is not in refund pending status"}

    # Resolve real Eko TID for API call — must be numeric
    eko_api_tid = txn.get("eko_tid") or (tid if str(tid).isdigit() else None)
    if not eko_api_tid or not str(eko_api_tid).isdigit():
        logging.warning(f"[USER REFUND] Verify: No numeric eko_tid for txn {tid} (user={data.user_id})")
        return {
            "success": False,
            "tid": tid,
            "error": "Eko Transaction ID missing — please contact support.",
            "message": "Eko Transaction ID missing — please contact support.",
        }

    try:
        headers = _build_eko_headers()
        url = f"{BASE_URL}/v2/transactions/{eko_api_tid}/refund"
        body = {
            "initiator_id": INITIATOR_ID,
            "user_code": USER_CODE,
            "otp": str(data.otp),
            "state": "1",
        }

        logging.info(f"[USER REFUND] Manual OTP Refund → TID: {eko_api_tid}, user: {data.user_id}")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, data=body)

        logging.info(f"[USER REFUND] Refund HTTP {response.status_code} | {response.text[:500]}")

        try:
            result = response.json()
        except Exception:
            return {"success": False, "error": f"Eko returned invalid response (HTTP {response.status_code})"}

        # Eko refund-verify success criteria:
        # On successful refund Eko returns: status=0, data.refund_tid populated, no invalid_params.
        # On wrong OTP / failure: invalid_params set OR data.refund_tid empty.
        # Don't rely on response_status_id (Eko sometimes returns -1 even on success here too).
        refund_data = result.get("data") or {}
        success = bool(
            result.get("status") == 0
            and (refund_data.get("refund_tid") or refund_data.get("tid"))
            and not result.get("invalid_params")
        )

        if success:
            # Audit successful refund
            try:
                await db.eko_refund_logs.insert_one({
                    "tid": str(tid),
                    "eko_api_tid": str(eko_api_tid),
                    "user_id": data.user_id,
                    "action": "refund_verify",
                    "result": "success",
                    "refund_tid": refund_data.get("refund_tid"),
                    "refunded_amount": refund_data.get("refunded_amount") or refund_data.get("amount"),
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "ts_epoch": datetime.now(timezone.utc).timestamp(),
                })
            except Exception:
                pass
            await _mark_refunded(eko_api_tid, data.user_id, refund_data, txn)
        else:
            # Audit failed verify (likely wrong OTP)
            try:
                await db.eko_refund_logs.insert_one({
                    "tid": str(tid),
                    "eko_api_tid": str(eko_api_tid),
                    "user_id": data.user_id,
                    "action": "refund_verify",
                    "result": "failed",
                    "eko_response_status_id": result.get("response_status_id"),
                    "eko_invalid_params": result.get("invalid_params"),
                    "eko_message": result.get("message"),
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "ts_epoch": datetime.now(timezone.utc).timestamp(),
                })
            except Exception:
                pass

        # Build user-facing message — strip unfilled template tokens
        err_msg = result.get("message") or "OTP verification failed. Please try again."
        if "{" in err_msg and "}" in err_msg:
            err_msg = "Refund could not be completed. The OTP may be incorrect or expired. Please try again."

        return {
            "success": success,
            "tid": tid,
            "message": (
                "Refund completed successfully!"
                if success
                else err_msg
            ),
            "refund_tid": refund_data.get("refund_tid") if success else None,
            "refunded_amount": (
                refund_data.get("refunded_amount") or refund_data.get("amount")
            ) if success else None,
        }

    except httpx.TimeoutException:
        logging.error(f"[USER REFUND] Manual verify timeout for TID {tid}")
        return {"success": False, "error": "Request timed out. Please try again."}
    except Exception as e:
        logging.error(f"[USER REFUND] Manual verify error for TID {tid}: {e}")
        return {"success": False, "error": "Refund verification failed. Please try again later."}



# ========================================================================
# Transaction Inquiry — Admin diagnostic for stuck refunds
# Ref: https://developers.eko.in/reference/transaction-inquiry
# ========================================================================

class AdminTransactionInquiryRequest(BaseModel):
    admin_id: str
    tid: str  # can be numeric eko_tid OR client_ref_id (will be prefixed)


@router.post("/admin/transaction-inquiry")
async def admin_transaction_inquiry(data: AdminTransactionInquiryRequest):
    """Admin-only: Query Eko's authoritative tx_status for a transaction.
    tx_status codes: 0=Success, 1=Fail, 2=Awaited, 3=Refund Pending, 4=Refunded, 5=Hold.
    If money already refunded (tx_status=4), no refund OTP needed — just sync our DB."""
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    admin = await db.users.find_one({"uid": data.admin_id}, {"_id": 0, "role": 1})
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        return {"success": False, "error": "Admin only"}
    if not _eko_credentials_valid():
        return {"success": False, "error": "Eko not configured"}

    tid = str(data.tid).strip()
    # If non-numeric, use client_ref_id prefix form
    if not tid.isdigit():
        query_param = f"client_ref_id:{tid}"
    else:
        query_param = tid

    try:
        headers = _build_eko_headers()
        url = f"{BASE_URL}/v2/transactions/{query_param}?initiator_id={INITIATOR_ID}"
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, headers=headers)
        try:
            raw = resp.json()
        except Exception:
            raw = {"raw_text": resp.text[:800]}
        return {
            "success": True,
            "requested": tid,
            "query_param": query_param,
            "http_status": resp.status_code,
            "eko_response": raw,
        }
    except httpx.TimeoutException:
        return {"success": False, "error": "Eko inquiry timeout"}
    except Exception as e:
        return {"success": False, "error": f"Eko error: {e}"}



# ========================================================================
# Multi-path Refund OTP Experiment — Admin diagnostic to compare v1/v2/v3
# ========================================================================

class AdminTryAllRefundOTPRequest(BaseModel):
    admin_id: str
    tid: str  # numeric Eko TID


@router.post("/admin/try-all-refund-otp-paths")
async def admin_try_all_refund_otp_paths(data: AdminTryAllRefundOTPRequest):
    """Admin-only: Try ALL possible Eko refund-OTP endpoint variants and return
    raw responses for comparison. Helps identify which path Eko accepts for
    actual SMS delivery on this specific account."""
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    admin = await db.users.find_one({"uid": data.admin_id}, {"_id": 0, "role": 1})
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        return {"success": False, "error": "Admin only"}
    if not _eko_credentials_valid():
        return {"success": False, "error": "Eko not configured"}

    tid = str(data.tid).strip()
    results = {}
    headers = _build_eko_headers()

    # Compute alternate base URLs (Eko has /ekoicici and /ekoapi namespaces)
    alt_base = BASE_URL.replace("/ekoicici", "/ekoapi") if "/ekoicici" in BASE_URL else BASE_URL

    # Variant 1: v1 POST transactions path (current implementation)
    v1_url = f"{BASE_URL}/v1/transactions/{tid}/refund/otp"
    v1_body = {"initiator_id": INITIATOR_ID, "developer_key": DEVELOPER_KEY}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(v1_url, headers=headers, data=v1_body)
        results["v1_POST_transactions"] = {
            "url": v1_url, "body": v1_body, "http": r.status_code,
            "response": r.json() if r.text else None,
        }
    except Exception as e:
        results["v1_POST_transactions"] = {"url": v1_url, "error": str(e)}

    # Variant 2: v3 GET ekoapi/customer/payment/refund path (per latest docs)
    v3_url = f"{alt_base}/v3/customer/payment/refund/{tid}?initiator_id={INITIATOR_ID}&user_code={USER_CODE}"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(v3_url, headers=headers)
        try:
            resp_body = r.json()
        except Exception:
            resp_body = {"raw_text": r.text[:500]}
        results["v3_GET_ekoapi_customer_payment"] = {
            "url": v3_url, "http": r.status_code, "response": resp_body,
        }
    except Exception as e:
        results["v3_GET_ekoapi_customer_payment"] = {"url": v3_url, "error": str(e)}

    # Variant 3: v3 POST ekoapi refund
    v3p_url = f"{alt_base}/v3/customer/payment/refund/{tid}"
    v3p_body = {"initiator_id": INITIATOR_ID, "user_code": USER_CODE, "developer_key": DEVELOPER_KEY}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(v3p_url, headers=headers, data=v3p_body)
        try:
            resp_body = r.json()
        except Exception:
            resp_body = {"raw_text": r.text[:500]}
        results["v3_POST_ekoapi_customer_payment"] = {
            "url": v3p_url, "body": v3p_body, "http": r.status_code, "response": resp_body,
        }
    except Exception as e:
        results["v3_POST_ekoapi_customer_payment"] = {"url": v3p_url, "error": str(e)}

    # Variant 4: v1 POST with full body (initiator_id + user_code + developer_key)
    v1f_url = f"{BASE_URL}/v1/transactions/{tid}/refund/otp"
    v1f_body = {"initiator_id": INITIATOR_ID, "user_code": USER_CODE, "developer_key": DEVELOPER_KEY}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(v1f_url, headers=headers, data=v1f_body)
        results["v1_POST_with_user_code"] = {
            "url": v1f_url, "body": v1f_body, "http": r.status_code,
            "response": r.json() if r.text else None,
        }
    except Exception as e:
        results["v1_POST_with_user_code"] = {"url": v1f_url, "error": str(e)}

    return {"success": True, "tid": tid, "base_url_used": BASE_URL, "alt_base": alt_base, "results": results}



# ========================================================================
# Admin: Sync Eko Excel "Refund pending" → DB rows for user OTP flow
# Mirrors logic from scripts/sync_eko_refund_pending.py but runs via API
# so admins can trigger it from the browser without SSH access.
# ========================================================================

REFUND_PENDING_STATUSES_UI = {"refund pending", "refund_pending", "refundpending"}


def _normalize_status(raw: str) -> str:
    return str(raw or "").strip().lower().replace("-", " ")


def _parse_eko_excel(file_bytes: bytes):
    """Parse Eko Excel (xlsx) bytes → list of dicts. Same column rules as the CLI script."""
    import openpyxl
    from io import BytesIO
    try:
        wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)
    except Exception as e:
        raise ValueError(f"Could not open Excel file: {e}")
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    headers = [str(c or "").strip().lower() for c in rows[0]]
    col_map = {}
    for idx, h in enumerate(headers):
        if "transaction date" in h or h == "date":
            col_map["date"] = idx
        elif "eko transaction id" in h or "eko tid" in h:
            col_map["eko_tid"] = idx
        elif "client reference" in h:
            col_map["client_ref_id"] = idx
        elif "cellnumber" in h or "cell number" in h:
            col_map["mobile"] = idx
        elif h.startswith("amount"):
            col_map["amount"] = idx
        elif h == "status":
            col_map["status"] = idx

    required = {"eko_tid", "client_ref_id", "mobile", "status"}
    if not required.issubset(col_map.keys()):
        raise ValueError(f"Excel missing required columns. Found: {headers}")

    entries = []
    for row in rows[1:]:
        if not row or all(c is None for c in row):
            continue
        try:
            entries.append({
                "date": str(row[col_map["date"]] or "") if "date" in col_map else "",
                "eko_tid": str(row[col_map["eko_tid"]] or "").strip(),
                "client_ref_id": str(row[col_map["client_ref_id"]] or "").strip(),
                "mobile": str(row[col_map["mobile"]] or "").strip(),
                "amount": float(str(row[col_map["amount"]] or "0").replace(",", "") or 0) if "amount" in col_map else 0,
                "status": str(row[col_map["status"]] or "").strip(),
            })
        except (ValueError, IndexError):
            continue
    return entries


from fastapi import UploadFile, File, Form


@router.post("/admin/sync-eko-refund-pending")
async def admin_sync_eko_refund_pending(
    admin_id: str = Form(...),
    dry_run: bool = Form(True),
    mobiles: Optional[str] = Form(None),  # comma-separated
    file: UploadFile = File(...),
):
    """
    Admin: Upload Eko Excel → sync 'Refund pending' rows to DB so users see the
    refund modal on their dashboard and can complete via OTP flow.

    Logic mirrors `scripts/sync_eko_refund_pending.py`:
      • Match each Excel row to existing DB row by client_ref_id (across all 4 collections)
      • Update status: failed → refund_pending, ensure eko_tid + client_ref_id populated
      • Fallback to mobile lookup if no DB row exists (creates new row in recharge_transactions)
      • Idempotent: rows already in refund_pending state are skipped

    By default `dry_run=True` — no DB writes, just preview.
    Pass `dry_run=False` to apply changes.
    """
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    admin = await db.users.find_one({"uid": admin_id}, {"_id": 0, "role": 1})
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        return {"success": False, "error": "Admin only"}

    try:
        file_bytes = await file.read()
        entries = _parse_eko_excel(file_bytes)
    except ValueError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        logging.error(f"[ADMIN SYNC] Excel parse error: {e}")
        return {"success": False, "error": f"Excel parse error: {e}"}

    refund_pending_entries = [
        e for e in entries if _normalize_status(e["status"]) in REFUND_PENDING_STATUSES_UI
    ]

    mobile_filter = None
    if mobiles:
        mobile_filter = {m.strip() for m in mobiles.split(",") if m.strip()}
        refund_pending_entries = [e for e in refund_pending_entries if e["mobile"] in mobile_filter]

    if not refund_pending_entries:
        return {
            "success": True,
            "dry_run": dry_run,
            "message": "No 'Refund pending' entries found in Excel after filters.",
            "total_excel_rows": len(entries),
            "summary": {},
            "preview": [],
        }

    cref_ids = list({e["client_ref_id"] for e in refund_pending_entries if e["client_ref_id"]})
    eko_tids = list({e["eko_tid"] for e in refund_pending_entries if e["eko_tid"]})

    REFUND_COLLECTIONS = ["recharge_transactions", "bill_payment_requests", "dmt_transactions", "bank_transfer_requests"]
    db_rows_by_cref = {}
    db_rows_by_tid = {}

    for coll_name in REFUND_COLLECTIONS:
        async for doc in db[coll_name].find(
            {"$or": [
                {"client_ref_id": {"$in": cref_ids}},
                {"eko_client_ref_id": {"$in": cref_ids}},
            ]},
            {"_id": 0, "request_id": 1, "user_id": 1, "status": 1, "client_ref_id": 1,
             "eko_client_ref_id": 1, "eko_tid": 1}
        ):
            cref = doc.get("client_ref_id") or doc.get("eko_client_ref_id")
            if cref:
                db_rows_by_cref[cref] = (doc, coll_name)
        async for doc in db[coll_name].find(
            {"eko_tid": {"$in": eko_tids}},
            {"_id": 0, "request_id": 1, "user_id": 1, "status": 1, "client_ref_id": 1,
             "eko_tid": 1}
        ):
            tid = doc.get("eko_tid")
            if tid:
                db_rows_by_tid[str(tid)] = (doc, coll_name)

    mobiles_in = list({e["mobile"] for e in refund_pending_entries if e["mobile"]})
    user_by_mobile = {
        u["mobile"]: u
        async for u in db.users.find({"mobile": {"$in": mobiles_in}}, {"_id": 0, "uid": 1, "mobile": 1, "name": 1})
    }

    now_iso = datetime.now(timezone.utc).isoformat()
    summary = {"matched_updated": 0, "created_new": 0, "skipped_no_user": 0, "already_synced": 0}
    preview = []

    for entry in refund_pending_entries:
        eko_tid = entry["eko_tid"]
        client_ref_id = entry["client_ref_id"]
        mobile = entry["mobile"]

        match = db_rows_by_cref.get(client_ref_id) or db_rows_by_tid.get(eko_tid)

        if match:
            doc, coll_name = match
            uid = doc.get("user_id")
            if not uid or uid == "UNKNOWN":
                summary["skipped_no_user"] += 1
                preview.append({"action": "skip_no_user", "tid": eko_tid, "client_ref_id": client_ref_id, "reason": "Match found but user_id missing"})
                continue
            if doc.get("status") == "refund_pending" and doc.get("eko_tid") == eko_tid:
                summary["already_synced"] += 1
                preview.append({"action": "already_synced", "tid": eko_tid, "user_id": uid, "collection": coll_name})
                continue
            preview.append({
                "action": "update", "collection": coll_name,
                "request_id": doc.get("request_id"), "tid": eko_tid,
                "client_ref_id": client_ref_id, "user_id": uid,
                "old_status": doc.get("status"), "new_status": "refund_pending",
            })
            if not dry_run:
                await db[coll_name].update_one(
                    {"$or": [
                        {"request_id": doc.get("request_id")},
                        {"client_ref_id": client_ref_id},
                        {"eko_tid": eko_tid},
                    ]},
                    {"$set": {
                        "status": "refund_pending",
                        "eko_tid": eko_tid,
                        "client_ref_id": client_ref_id,
                        "updated_at": now_iso,
                        "refund_pending_synced_at": now_iso,
                        "refund_pending_source": "admin_excel_sync",
                    }}
                )
            summary["matched_updated"] += 1
            continue

        user = user_by_mobile.get(mobile)
        if not user:
            summary["skipped_no_user"] += 1
            preview.append({"action": "skip_no_user", "tid": eko_tid, "client_ref_id": client_ref_id, "mobile": mobile, "reason": "No DB row + no user matched by mobile"})
            continue

        uid = user["uid"]
        preview.append({
            "action": "create", "tid": eko_tid, "client_ref_id": client_ref_id,
            "user_id": uid, "mobile": mobile, "amount": entry["amount"],
        })
        if not dry_run:
            await db.recharge_transactions.insert_one({
                "request_id": f"RECON-{eko_tid}",
                "user_id": uid,
                "user_name": user.get("name", ""),
                "service_type": "mobile_recharge",
                "amount": entry["amount"],
                "amount_inr": entry["amount"],
                "phone": mobile,
                "customer_mobile": mobile,
                "eko_tid": eko_tid,
                "client_ref_id": client_ref_id,
                "status": "refund_pending",
                "prc_refunded": False,
                "total_prc_deducted": 0,
                "created_at": entry.get("date") or now_iso,
                "updated_at": now_iso,
                "refund_pending_synced_at": now_iso,
                "refund_pending_source": "admin_excel_sync_fallback_mobile",
                "reconcile_note": "Created via admin Excel sync — no existing DB row, matched by mobile",
            })
        summary["created_new"] += 1

    return {
        "success": True,
        "dry_run": dry_run,
        "total_excel_rows": len(entries),
        "refund_pending_in_excel": len(refund_pending_entries),
        "filtered_by_mobiles": list(mobile_filter) if mobile_filter else None,
        "total_amount_inr": sum(e.get("amount", 0) for e in refund_pending_entries),
        "summary": summary,
        "preview": preview,  # full list — admin can see every action
    }


@router.post("/admin/reconcile-eko-refund-pending")
async def admin_reconcile_eko_refund_pending(
    admin_id: str = Form(...),
    dry_run: bool = Form(True),
    file: UploadFile = File(...),
):
    """
    Admin: Upload the **latest** Eko Excel → reconcile DB so that
    self-service refund modal stays open ONLY for transactions that are
    STILL "Refund pending" in Eko.

    Logic:
      • Parse the Excel and collect the set of eko_tid + client_ref_id whose
        Status is "Refund pending" right now.
      • Walk every DB row currently in `status: "refund_pending"` across
        all 4 refund-eligible collections.
      • If that row's eko_tid OR client_ref_id is in the Excel's pending
        set → keep it as `refund_pending` (modal stays).
      • If NOT → mark it `refund_completed` with `reconcile_note` so the
        self-service modal stops showing for that user.

    By default `dry_run=True` — preview only. Pass `dry_run=False` to apply.
    """
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    admin = await db.users.find_one({"uid": admin_id}, {"_id": 0, "role": 1})
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        return {"success": False, "error": "Admin only"}

    try:
        file_bytes = await file.read()
        entries = _parse_eko_excel(file_bytes)
    except ValueError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        logging.error(f"[ADMIN RECONCILE] Excel parse error: {e}")
        return {"success": False, "error": f"Excel parse error: {e}"}

    # Build TWO sets from Excel:
    # 1. still_pending: TIDs whose status IS "Refund pending" right now in Eko
    # 2. all_in_excel: ALL TIDs that appear in Excel regardless of status
    #
    # This distinction is CRITICAL: if the admin uploads a filtered Excel
    # (e.g. only Mobile/DTH recharge transactions, no DMT), we must NOT touch
    # DB rows whose TIDs aren't in the Excel at all — those are out of scope.
    still_pending_tids = set()
    still_pending_crefs = set()
    all_tids_in_excel = set()
    all_crefs_in_excel = set()
    for e in entries:
        if e["eko_tid"]:
            all_tids_in_excel.add(str(e["eko_tid"]))
        if e["client_ref_id"]:
            all_crefs_in_excel.add(str(e["client_ref_id"]))
        if _normalize_status(e["status"]) in REFUND_PENDING_STATUSES_UI:
            if e["eko_tid"]:
                still_pending_tids.add(str(e["eko_tid"]))
            if e["client_ref_id"]:
                still_pending_crefs.add(str(e["client_ref_id"]))

    REFUND_COLLECTIONS = ["recharge_transactions", "bill_payment_requests", "dmt_transactions", "bank_transfer_requests"]
    now_iso = datetime.now(timezone.utc).isoformat()

    summary = {
        "kept_pending": 0,
        "marked_completed": 0,
        "skipped_out_of_excel_scope": 0,
        "skipped_no_eko_tid": 0,
        "by_collection": {},
    }
    preview = []

    for coll_name in REFUND_COLLECTIONS:
        async for doc in db[coll_name].find(
            {"status": "refund_pending"},
            {"_id": 1, "request_id": 1, "user_id": 1, "eko_tid": 1,
             "client_ref_id": 1, "eko_client_ref_id": 1, "phone": 1,
             "customer_mobile": 1, "amount": 1, "amount_inr": 1, "service_type": 1}
        ):
            tid = str(doc.get("eko_tid") or "")
            cref = str(doc.get("client_ref_id") or doc.get("eko_client_ref_id") or "")

            if not tid and not cref:
                summary["skipped_no_eko_tid"] += 1
                preview.append({
                    "action": "skip_no_identifier",
                    "collection": coll_name,
                    "request_id": doc.get("request_id"),
                    "reason": "No eko_tid or client_ref_id to match against Excel",
                })
                continue

            # CRITICAL safety: only act on rows whose TID/cref appears in the
            # Excel at all. If the row is not in the Excel, it's out of scope
            # (e.g. admin uploaded filtered Excel that only has Mobile/DTH).
            in_excel = (tid and tid in all_tids_in_excel) or (cref and cref in all_crefs_in_excel)
            is_still_pending = (tid and tid in still_pending_tids) or (cref and cref in still_pending_crefs)

            summary["by_collection"].setdefault(coll_name, {"kept": 0, "completed": 0, "out_of_scope": 0})

            if not in_excel:
                # Out of Excel scope — DO NOT touch this row
                summary["skipped_out_of_excel_scope"] += 1
                summary["by_collection"][coll_name]["out_of_scope"] += 1
                preview.append({
                    "action": "skip_out_of_excel_scope",
                    "collection": coll_name,
                    "request_id": doc.get("request_id"),
                    "user_id": doc.get("user_id"),
                    "eko_tid": tid,
                    "amount": doc.get("amount") or doc.get("amount_inr"),
                    "reason": "TID not present in uploaded Excel — leaving untouched",
                })
                continue

            if is_still_pending:
                summary["kept_pending"] += 1
                summary["by_collection"][coll_name]["kept"] += 1
                preview.append({
                    "action": "keep_pending",
                    "collection": coll_name,
                    "request_id": doc.get("request_id"),
                    "user_id": doc.get("user_id"),
                    "eko_tid": tid,
                    "amount": doc.get("amount") or doc.get("amount_inr"),
                })
            else:
                summary["marked_completed"] += 1
                summary["by_collection"][coll_name]["completed"] += 1
                preview.append({
                    "action": "mark_completed",
                    "collection": coll_name,
                    "request_id": doc.get("request_id"),
                    "user_id": doc.get("user_id"),
                    "eko_tid": tid,
                    "amount": doc.get("amount") or doc.get("amount_inr"),
                })
                if not dry_run:
                    # Use _id when available (most precise), else fall back to a
                    # composite eko_tid + user_id match. NEVER match on
                    # request_id alone — many old prod rows have request_id=None
                    # which would lead to mass-updating the wrong documents.
                    doc_id = doc.get("_id")
                    if doc_id:
                        match_q = {"_id": doc_id}
                    elif tid and doc.get("user_id"):
                        match_q = {"eko_tid": tid, "user_id": doc.get("user_id"), "status": "refund_pending"}
                    elif cref and doc.get("user_id"):
                        match_q = {"$or": [{"client_ref_id": cref}, {"eko_client_ref_id": cref}], "user_id": doc.get("user_id"), "status": "refund_pending"}
                    elif doc.get("request_id"):
                        match_q = {"request_id": doc.get("request_id")}
                    else:
                        # No safe unique identifier — skip rather than risk wrong update
                        preview[-1]["action"] = "skip_no_safe_match"
                        summary["skipped_no_eko_tid"] += 1
                        summary["marked_completed"] -= 1
                        summary["by_collection"][coll_name]["completed"] -= 1
                        continue
                    await db[coll_name].update_one(
                        match_q,
                        {"$set": {
                            "status": "refund_completed",
                            "refund_completed_at": now_iso,
                            "updated_at": now_iso,
                            "reconcile_note": "Eko Excel reconcile: this TID is no longer in 'Refund pending' state on Eko side — refund completed externally",
                            "reconcile_source": "admin_excel_reconcile",
                        }}
                    )

    return {
        "success": True,
        "dry_run": dry_run,
        "total_excel_rows": len(entries),
        "total_unique_tids_in_excel": len(all_tids_in_excel),
        "still_pending_in_excel": len({*still_pending_tids, *still_pending_crefs}),  # unique identifiers
        "still_pending_tids": len(still_pending_tids),
        "summary": summary,
        "preview": preview[:500],  # cap preview to avoid huge payload
        "preview_truncated": len(preview) > 500,
    }


@router.post("/admin/manual-mark-refund-completed")
async def admin_manual_mark_refund_completed(
    admin_id: str = Form(...),
    user_id: str = Form(...),
    eko_tids: str = Form(...),
    note: Optional[str] = Form("Admin manual cleanup — refund settled externally"),
    dry_run: bool = Form(True),
):
    """
    Manually mark specific (user_id, eko_tid) pairs as `refund_completed`.
    Use for legacy/ghost DB rows that Eko has settled long ago but our DB
    still says `refund_pending`. Strictly scoped — only matches rows belonging
    to the given user_id, never cross-user updates.

    Args (multipart form):
      admin_id: caller admin uid
      user_id: target user uid (only this user's rows will be touched)
      eko_tids: comma-separated TIDs to mark completed
      note: reason text saved as `reconcile_note`
      dry_run: True → preview only; False → write
    """
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    admin = await db.users.find_one({"uid": admin_id}, {"_id": 0, "role": 1})
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        return {"success": False, "error": "Admin only"}

    tids = [t.strip() for t in (eko_tids or "").split(",") if t.strip()]
    if not tids:
        return {"success": False, "error": "Provide at least one TID via eko_tids"}
    if len(tids) > 50:
        return {"success": False, "error": "Cannot mark more than 50 TIDs at once"}

    REFUND_COLLECTIONS = ["recharge_transactions", "bill_payment_requests", "dmt_transactions", "bank_transfer_requests"]
    now_iso = datetime.now(timezone.utc).isoformat()

    summary = {"matched": 0, "marked_completed": 0, "by_collection": {}, "not_found": []}
    preview = []

    for tid in tids:
        # Match by (user_id, eko_tid_or_cref, status=refund_pending) across all 4 collections.
        found_any = False
        for coll in REFUND_COLLECTIONS:
            async for doc in db[coll].find(
                {
                    "user_id": user_id,
                    "status": "refund_pending",
                    "$or": [
                        {"eko_tid": tid},
                        {"client_ref_id": tid},
                        {"eko_client_ref_id": tid},
                    ],
                },
                {"_id": 1, "request_id": 1, "eko_tid": 1, "amount": 1, "amount_inr": 1}
            ):
                summary["matched"] += 1
                found_any = True
                summary["by_collection"].setdefault(coll, 0)
                summary["by_collection"][coll] += 1
                preview.append({
                    "collection": coll,
                    "request_id": doc.get("request_id"),
                    "eko_tid": doc.get("eko_tid"),
                    "amount": doc.get("amount") or doc.get("amount_inr"),
                    "user_id": user_id,
                    "tid_used": tid,
                })
                if not dry_run:
                    await db[coll].update_one(
                        {"_id": doc["_id"]},
                        {"$set": {
                            "status": "refund_completed",
                            "refund_completed_at": now_iso,
                            "updated_at": now_iso,
                            "reconcile_note": note,
                            "reconcile_source": "admin_manual_mark",
                        }}
                    )
                    summary["marked_completed"] += 1
        if not found_any:
            summary["not_found"].append(tid)

    return {
        "success": True,
        "dry_run": dry_run,
        "user_id": user_id,
        "tids_requested": tids,
        "summary": summary,
        "preview": preview,
    }


@router.post("/admin/revert-eko-reconcile")
async def admin_revert_eko_reconcile(
    admin_id: str = Form(...),
    dry_run: bool = Form(True),
):
    """
    EMERGENCY ROLLBACK: Revert ALL rows that were marked `refund_completed` by
    a previous Excel reconcile run (identified by `reconcile_source:
    "admin_excel_reconcile"`) back to `refund_pending` status.

    Use this when the previous reconcile incorrectly closed transactions
    that Eko hasn't actually refunded. After reverting, the admin can
    re-upload the correct Excel and re-run reconcile.
    """
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    admin = await db.users.find_one({"uid": admin_id}, {"_id": 0, "role": 1})
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        return {"success": False, "error": "Admin only"}

    REFUND_COLLECTIONS = ["recharge_transactions", "bill_payment_requests", "dmt_transactions", "bank_transfer_requests"]
    now_iso = datetime.now(timezone.utc).isoformat()

    summary = {"reverted_total": 0, "by_collection": {}}
    preview = []

    for coll_name in REFUND_COLLECTIONS:
        match = {
            "reconcile_source": "admin_excel_reconcile",
            "status": "refund_completed",
        }
        cnt = await db[coll_name].count_documents(match)
        summary["by_collection"][coll_name] = cnt
        summary["reverted_total"] += cnt

        async for doc in db[coll_name].find(match, {"_id": 1, "user_id": 1, "eko_tid": 1, "amount": 1, "amount_inr": 1, "request_id": 1}).limit(50):
            preview.append({
                "collection": coll_name,
                "request_id": doc.get("request_id"),
                "user_id": doc.get("user_id"),
                "eko_tid": doc.get("eko_tid"),
                "amount": doc.get("amount") or doc.get("amount_inr"),
            })

        if not dry_run and cnt > 0:
            await db[coll_name].update_many(
                match,
                {"$set": {
                    "status": "refund_pending",
                    "updated_at": now_iso,
                    "revert_note": "Reverted from buggy admin_excel_reconcile run — re-reconcile required",
                },
                "$unset": {
                    "refund_completed_at": "",
                    "reconcile_note": "",
                    "reconcile_source": "",
                }}
            )

    return {
        "success": True,
        "dry_run": dry_run,
        "summary": summary,
        "preview": preview,
    }



# ========================================================================
# Admin diagnostic: list pending BBPS refunds + trigger OTP on user's behalf
# ========================================================================


@router.get("/admin/list-pending-bbps-refunds")
async def admin_list_pending_bbps_refunds(admin_id: str, limit: int = 50, service_filter: Optional[str] = None):
    """Admin: list refund_pending entries from recharge_transactions / bill_payment_requests
    so admin can pick ones to trigger OTP for. Excludes DMT (separate flow).
    """
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    admin = await db.users.find_one({"uid": admin_id}, {"_id": 0, "role": 1})
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        return {"success": False, "error": "Admin only"}

    rows = []
    for coll in ["recharge_transactions", "bill_payment_requests"]:
        query = {
            "status": "refund_pending",
            "eko_tid": {"$exists": True, "$nin": [None, ""]},
        }
        if service_filter:
            query["service_type"] = {"$regex": service_filter, "$options": "i"}
        cursor = db[coll].find(
            query,
            {"_id": 0, "request_id": 1, "user_id": 1, "eko_tid": 1, "client_ref_id": 1,
             "amount": 1, "amount_inr": 1, "phone": 1, "customer_mobile": 1,
             "service_type": 1, "operator": 1, "status": 1, "created_at": 1,
             "total_prc_deducted": 1, "prc_refunded": 1}
        ).sort("created_at", -1).limit(limit)
        async for doc in cursor:
            tid = str(doc.get("eko_tid", "") or "")
            if tid.isdigit():
                doc["collection"] = coll
                rows.append(doc)

    user_ids = list({r.get("user_id") for r in rows if r.get("user_id")})
    user_map = {}
    async for u in db.users.find({"uid": {"$in": user_ids}}, {"_id": 0, "uid": 1, "name": 1, "mobile": 1}):
        user_map[u["uid"]] = u

    for r in rows:
        u = user_map.get(r.get("user_id"))
        if u:
            r["app_user_name"] = u.get("name")
            r["app_user_mobile"] = u.get("mobile")

    return {
        "success": True,
        "count": len(rows),
        "rows": rows,
    }


class AdminTriggerOTPRequest(BaseModel):
    admin_id: str
    tid: str


@router.post("/admin/trigger-refund-otp")
async def admin_trigger_refund_otp(request: AdminTriggerOTPRequest):
    """Admin override: trigger refund OTP for any user's pending recharge."""
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    admin = await db.users.find_one({"uid": request.admin_id}, {"_id": 0, "role": 1, "name": 1})
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        return {"success": False, "error": "Admin only"}

    txn = None
    for coll in ["recharge_transactions", "bill_payment_requests", "dmt_transactions", "bank_transfer_requests"]:
        txn = await db[coll].find_one(
            {"$or": [
                {"eko_tid": request.tid},
                {"client_ref_id": request.tid},
                {"request_id": request.tid},
            ], "status": "refund_pending"},
            {"_id": 0}
        )
        if txn:
            break
    if not txn:
        return {"success": False, "error": f"No refund_pending txn found for TID {request.tid}"}

    target_user_id = txn.get("user_id")
    if not target_user_id:
        return {"success": False, "error": "Txn missing user_id"}

    class _Body:
        def __init__(self, uid):
            self.user_id = uid
    result = await user_process_refund(request.tid, _Body(target_user_id))

    try:
        await db.admin_audit_logs.insert_one({
            "admin_id": request.admin_id,
            "admin_name": admin.get("name"),
            "action": "trigger_refund_otp",
            "tid": request.tid,
            "target_user_id": target_user_id,
            "result_success": bool(result.get("success") or result.get("otp_sent")),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    target_user = await db.users.find_one({"uid": target_user_id}, {"_id": 0, "name": 1, "mobile": 1})
    return {
        **result,
        "admin_triggered_for_user": {
            "user_id": target_user_id,
            "name": (target_user or {}).get("name"),
            "mobile": (target_user or {}).get("mobile"),
        },
    }
