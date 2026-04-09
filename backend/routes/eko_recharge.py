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
MAX_RECHARGES_PER_DAY = 1
GENERIC_ERROR = "Technical error. Please try again later."

# Service activation cache
_service_activated = False


# ===== Eko Status Constants =====
class EkoStatus:
    SUCCESS = 0
    ALREADY_ACTIVE = 24
    INSUFFICIENT_BALANCE = 347
    SERVICE_NOT_ENABLED = 463


class TxStatus:
    SUCCESS = 0
    FAILED = 1
    PENDING = 2
    REFUND_PENDING = 3
    REFUNDED = 4
    ON_HOLD = 5


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

    # ===== Step 3: Daily limit (1/day combined) =====
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_count = await db.recharge_transactions.count_documents({
        "user_id": data.user_id,
        "created_at": {"$gte": today_start},
        "status": {"$nin": ["failed", "refunded"]}
    })
    logging.info(f"[RECHARGE] Step 3: user={data.user_id}, today_count={today_count}")
    if today_count >= MAX_RECHARGES_PER_DAY:
        logging.info(f"[RECHARGE] Step 3: BLOCKED daily limit for user {data.user_id} (count={today_count})")
        return {"success": False, "message": GENERIC_ERROR, "error_ref": "R03"}

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

    # ===== Step 9: Call Eko paybill API =====
    request_id = str(uuid.uuid4())
    client_ref_id = f"RCH{int(time.time() * 1000)}"
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
            elif tx_status == TxStatus.PENDING:
                final_status = "pending"
            elif tx_status == TxStatus.ON_HOLD:
                final_status = "pending"
            else:
                final_status = "failed"
        elif eko_status == EkoStatus.INSUFFICIENT_BALANCE:
            logging.error("[RECHARGE] Eko wallet insufficient balance (347)")
            final_status = "failed"
        elif eko_status == EkoStatus.SERVICE_NOT_ENABLED:
            logging.error("[RECHARGE] Service not enabled for operator (463)")
            global _service_activated
            _service_activated = False
            final_status = "failed"
        else:
            final_status = "failed"

    except httpx.TimeoutException:
        logging.error(f"[RECHARGE] Eko API TIMEOUT for ref={client_ref_id}")
        eko_response = {"error": "timeout", "message": "Request timed out"}
        final_status = "pending"
    except httpx.ConnectError as ce:
        logging.error(f"[RECHARGE] Eko CONNECTION ERROR: {ce}")
        eko_response = {"error": "connection_error", "message": str(ce)}
        final_status = "failed"
    except Exception as e:
        logging.error(f"[RECHARGE] Eko UNEXPECTED ERROR: {e}")
        eko_response = {"error": "unexpected", "message": str(e)}
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
                user_name, user_mobile, now_iso, eko_message
            )
        except Exception as e:
            logging.error(f"[RECHARGE] Failure handler crashed: {e} | user={data.user_id}, ref={client_ref_id}")
            return {"success": False, "message": GENERIC_ERROR, "request_id": request_id}


async def _handle_success(data, request_id, client_ref_id, tid, status,
                           total_prc, charges, req_type, user_name, user_mobile,
                           now_iso):
    """Record successful/pending recharge — PRC stays deducted.
    Each DB operation is individually protected so partial failures don't crash the response."""
    amount_inr = float(int(data.amount))

    # 1. Record in recharge_transactions
    try:
        txn = {
            "request_id": request_id,
            "user_id": data.user_id,
            "user_name": user_name,
            "user_mobile": user_mobile,
            "recharge_type": data.recharge_type,
            "number": data.number,
            "operator_id": data.operator_id,
            "amount_inr": amount_inr,
            "total_prc_deducted": round(total_prc, 2),
            "prc_required": round(charges.get("amount_prc", 0), 2),
            "processing_fee_prc": round(charges.get("processing_fee_prc", 0), 2),
            "admin_charge_prc": round(charges.get("admin_charge_prc", 0), 2),
            "eko_tid": tid,
            "client_ref_id": client_ref_id,
            "status": status,
            "created_at": now_iso
        }
        await db.recharge_transactions.insert_one(txn)
    except Exception as e:
        logging.error(f"[RECHARGE] recharge_transactions insert failed (non-fatal): {e}")

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
                           now_iso, eko_message):
    """Refund PRC and record failed recharge"""
    # Refund PRC
    await db.users.update_one(
        {"uid": data.user_id},
        {"$inc": {"prc_balance": total_prc}}
    )
    logging.info(f"[RECHARGE] PRC refunded: {total_prc:.2f} to user {data.user_id}")

    # Record failed transaction
    try:
        txn = {
            "request_id": request_id,
            "user_id": data.user_id,
            "user_name": user_name,
            "user_mobile": user_mobile,
            "recharge_type": data.recharge_type,
            "number": data.number,
            "operator_id": data.operator_id,
            "amount_inr": float(int(data.amount)),
            "total_prc_deducted": 0,
            "eko_tid": tid,
            "client_ref_id": client_ref_id,
            "status": "failed",
            "prc_refunded": True,
            "eko_error": eko_message or "",
            "created_at": now_iso
        }
        await db.recharge_transactions.insert_one(txn)
    except Exception as e:
        logging.error(f"[RECHARGE] Failed txn recording error (non-fatal): {e}")

    logging.warning(f"[RECHARGE] FAILED: user={data.user_id}, ref={client_ref_id}, "
                    f"eko_msg={eko_message[:100] if eko_message else 'none'}")

    return {
        "success": False,
        "message": GENERIC_ERROR,
        "request_id": request_id
    }


# ===== 5. RECHARGE HISTORY =====

@router.get("/history/{user_id}")
async def get_recharge_history(user_id: str):
    """Get user's recharge transaction history"""
    if db is None:
        return {"success": False, "transactions": []}

    txns = await db.recharge_transactions.find(
        {"user_id": user_id},
        {"_id": 0, "eko_response": 0, "eko_error": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    return {"success": True, "transactions": txns, "count": len(txns)}
