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
# must verify OTP to complete the Eko wallet refund before accessing dashboard.
#
# Eko Refund Flow (as per docs):
#   1. Transaction fails → Eko auto-sends OTP to customer mobile
#   2. GET Refund OTP  → POST {BASE_URL}/v1/transactions/{tid}/refund/otp
#                         Returns: otp_ref_id (stored for verify step)
#   3. Initiate Refund → POST {BASE_URL}/v2/transactions/{tid}/refund
#                         Params: initiator_id, user_code, otp, state=1, otp_ref_id
#   Ref: https://developers.eko.in/reference/refund-otp
#   Ref: https://developers.eko.in/reference/refund


def _build_eko_headers():
    """Build Eko authentication headers (BBPS: millisecond timestamp)."""
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


async def _find_user_txn(tid: str, user_id: str, fields: dict = None):
    """Find a transaction by eko_tid + user_id across both collections."""
    projection = fields or {"_id": 0, "status": 1, "user_id": 1}
    txn = await db.recharge_transactions.find_one(
        {"eko_tid": tid, "user_id": user_id}, projection
    )
    if not txn:
        txn = await db.bill_payment_requests.find_one(
            {"eko_tid": tid, "user_id": user_id}, projection
        )
    return txn


@router.get("/pending-refunds/{user_id}")
async def get_user_pending_refunds(user_id: str):
    """Get all refund_pending transactions for a user (dashboard blocker)."""
    if db is None:
        return {"success": False, "pending_refunds": []}

    recharge_pending = await db.recharge_transactions.find(
        {"user_id": user_id, "status": "refund_pending"},
        {"_id": 0, "eko_response": 0, "eko_error": 0}
    ).sort("created_at", -1).to_list(100)

    bill_pending = await db.bill_payment_requests.find(
        {"user_id": user_id, "status": "refund_pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    all_pending = []
    seen_tids = set()

    for txn in recharge_pending:
        tid = txn.get("eko_tid")
        if tid and tid not in seen_tids:
            seen_tids.add(tid)
            all_pending.append({
                "eko_tid": tid,
                "request_id": txn.get("request_id", ""),
                "amount_inr": txn.get("amount_inr", txn.get("amount", 0)),
                "phone": txn.get("phone", txn.get("consumer_number", "")),
                "operator": txn.get("operator_name", txn.get("operator", "")),
                "created_at": txn.get("created_at", ""),
                "source": "recharge",
            })

    for txn in bill_pending:
        tid = txn.get("eko_tid")
        if tid and tid not in seen_tids:
            seen_tids.add(tid)
            all_pending.append({
                "eko_tid": tid,
                "request_id": txn.get("request_id", ""),
                "amount_inr": txn.get("amount_inr", txn.get("amount", 0)),
                "phone": txn.get("consumer_number", txn.get("phone", "")),
                "operator": txn.get("operator_name", txn.get("service_type", "")),
                "created_at": txn.get("created_at", ""),
                "source": "bill_payment",
            })

    return {
        "success": True,
        "pending_refunds": all_pending,
        "count": len(all_pending),
        "requires_action": len(all_pending) > 0,
    }


class UserRefundOTPRequest(BaseModel):
    user_id: str


@router.post("/refund/send-otp/{tid}")
async def user_send_refund_otp(tid: str, data: UserRefundOTPRequest):
    """
    Step 1 — Get Refund OTP (user-facing, ownership-validated).

    Calls Eko: POST {BASE_URL}/v1/transactions/{tid}/refund/otp
    Params: initiator_id
    Returns: otp_ref_id (stored in DB for verify step)
    Ref: https://developers.eko.in/reference/refund-otp
    """
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    if not _eko_credentials_valid():
        return {"success": False, "error": "Refund service is not configured"}

    # Ownership check
    txn = await _find_user_txn(tid, data.user_id)
    if not txn:
        return {"success": False, "error": "Transaction not found or does not belong to you"}
    if txn.get("status") != "refund_pending":
        return {"success": False, "error": "This transaction is not in refund pending status"}

    # Call Eko Get Refund OTP API (async)
    try:
        headers = _build_eko_headers()
        url = f"{BASE_URL}/v1/transactions/{tid}/refund/otp"
        body = {"initiator_id": INITIATOR_ID}

        logging.info(f"[USER REFUND] Get OTP → TID: {tid}, user: {data.user_id}, URL: {url}")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, data=body)

        logging.info(f"[USER REFUND] OTP HTTP {response.status_code} | {response.text[:500]}")

        if response.status_code == 404:
            return {"success": False, "error": "Transaction not found on Eko. Please contact support."}

        try:
            result = response.json()
        except Exception:
            return {"success": False, "error": f"Eko returned invalid response (HTTP {response.status_code})"}

        eko_success = result.get("status") == 0
        otp_ref_id = result.get("data", {}).get("otp_ref_id", "")

        # Store otp_ref_id in DB for the verify step
        if eko_success and otp_ref_id:
            await db.recharge_transactions.update_one(
                {"eko_tid": tid},
                {"$set": {"refund_otp_ref_id": otp_ref_id}}
            )
            await db.bill_payment_requests.update_one(
                {"eko_tid": tid},
                {"$set": {"refund_otp_ref_id": otp_ref_id}}
            )

        return {
            "success": eko_success,
            "tid": tid,
            "message": (
                "OTP sent to customer's registered mobile number"
                if eko_success
                else (result.get("message") or "Failed to send OTP")
            ),
            "otp_ref_id": otp_ref_id if eko_success else None,
        }

    except httpx.TimeoutException:
        logging.error(f"[USER REFUND] OTP timeout for TID {tid}")
        return {"success": False, "error": "Request timed out. Please try again."}
    except Exception as e:
        logging.error(f"[USER REFUND] OTP error for TID {tid}: {e}")
        return {"success": False, "error": "Failed to send OTP. Please try again later."}


class UserVerifyRefundOTPRequest(BaseModel):
    user_id: str
    otp: str


@router.post("/refund/verify-otp/{tid}")
async def user_verify_refund_otp(tid: str, data: UserVerifyRefundOTPRequest):
    """
    Step 2 — Initiate Refund (user-facing, ownership-validated).

    Calls Eko: POST {BASE_URL}/v2/transactions/{tid}/refund
    Params: initiator_id, user_code, otp, state=1, otp_ref_id (from step 1)
    On success: status → refunded, auto-refund PRC, invalidate cache.
    Ref: https://developers.eko.in/reference/refund
    """
    if db is None:
        return {"success": False, "error": "Service unavailable"}
    if not _eko_credentials_valid():
        return {"success": False, "error": "Refund service is not configured"}

    # Ownership check (fetch extra fields for PRC refund)
    fields = {
        "_id": 0, "status": 1, "user_id": 1, "total_prc_deducted": 1,
        "prc_refunded": 1, "request_id": 1, "refund_otp_ref_id": 1,
    }
    txn = await _find_user_txn(tid, data.user_id, fields)
    if not txn:
        return {"success": False, "error": "Transaction not found or does not belong to you"}
    if txn.get("status") != "refund_pending":
        return {"success": False, "error": "This transaction is not in refund pending status"}

    # Build Eko Initiate Refund request
    try:
        headers = _build_eko_headers()
        url = f"{BASE_URL}/v2/transactions/{tid}/refund"
        body = {
            "initiator_id": INITIATOR_ID,
            "user_code": USER_CODE,
            "otp": str(data.otp),
            "state": "1",
        }
        # Include otp_ref_id if available (from step 1)
        otp_ref_id = txn.get("refund_otp_ref_id")
        if otp_ref_id:
            body["otp_ref_id"] = otp_ref_id

        logging.info(f"[USER REFUND] Initiate Refund → TID: {tid}, user: {data.user_id}")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, data=body)

        logging.info(f"[USER REFUND] Verify HTTP {response.status_code} | {response.text[:500]}")

        if response.status_code == 404:
            return {"success": False, "error": "Transaction not found on Eko."}

        try:
            result = response.json()
        except Exception:
            return {"success": False, "error": f"Eko returned invalid response (HTTP {response.status_code})"}

        success = result.get("status") == 0
        refund_data = result.get("data", {})
        now_iso = datetime.now(timezone.utc).isoformat()

        if success:
            # --- Update recharge_transactions ---
            await db.recharge_transactions.update_one(
                {"eko_tid": tid},
                {"$set": {
                    "status": "refunded",
                    "eko_refund_tid": refund_data.get("refund_tid"),
                    "eko_refunded_amount": refund_data.get("refunded_amount"),
                    "eko_refunded_at": now_iso,
                    "refund_method": "user_otp",
                    "updated_at": now_iso,
                }}
            )
            # --- Update bill_payment_requests (by request_id + eko_tid) ---
            if txn.get("request_id"):
                await db.bill_payment_requests.update_one(
                    {"request_id": txn["request_id"]},
                    {"$set": {"status": "refunded", "updated_at": now_iso}}
                )
            await db.bill_payment_requests.update_one(
                {"eko_tid": tid},
                {"$set": {"status": "refunded", "updated_at": now_iso}}
            )

            # --- Auto-refund PRC if not already refunded ---
            prc_amt = txn.get("total_prc_deducted", 0)
            if not txn.get("prc_refunded") and prc_amt > 0:
                await db.users.update_one(
                    {"uid": data.user_id},
                    {"$inc": {"prc_balance": prc_amt}}
                )
                await db.recharge_transactions.update_one(
                    {"eko_tid": tid},
                    {"$set": {"prc_refunded": True, "refund_at": now_iso}}
                )
                logging.info(f"[USER REFUND] PRC refund: {prc_amt} → user {data.user_id}, tid={tid}")

            # --- Audit log ---
            await db.eko_refund_logs.insert_one({
                "tid": tid,
                "otp_verified": True,
                "refund_tid": refund_data.get("refund_tid"),
                "refunded_amount": refund_data.get("refunded_amount") or refund_data.get("amount"),
                "initiated_by": "user",
                "user_id": data.user_id,
                "timestamp": now_iso,
            })

            # --- Invalidate dashboard cache ---
            if cache:
                await cache.delete(f"user:dashboard:{data.user_id}")
                await cache.delete(f"user_data:{data.user_id}")

        return {
            "success": success,
            "tid": tid,
            "message": (
                "Refund completed successfully!"
                if success
                else (result.get("message") or "OTP verification failed. Please try again.")
            ),
            "refund_tid": refund_data.get("refund_tid") if success else None,
            "refunded_amount": (
                refund_data.get("refunded_amount") or refund_data.get("amount")
            ) if success else None,
        }

    except httpx.TimeoutException:
        logging.error(f"[USER REFUND] Verify timeout for TID {tid}")
        return {"success": False, "error": "Request timed out. Please try again."}
    except Exception as e:
        logging.error(f"[USER REFUND] Verify error for TID {tid}: {e}")
        return {"success": False, "error": "Refund verification failed. Please try again later."}
