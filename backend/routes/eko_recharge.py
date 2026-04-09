"""
Eko Prepaid Mobile & DTH Recharge Routes
=========================================
Simplified recharge flow using Eko BBPS paybill API.

Rules:
- Max ₹500 per recharge (combined daily limit)
- 1 recharge per day per user (Mobile OR DTH)
- Only paid subscribers with redeem limit can recharge
- On success: deduct PRC, record in PRC statement + bill_payment_requests
- On fail: refund PRC, record failed transaction
- All business errors → generic "Technical error" to user
"""

from fastapi import APIRouter, HTTPException
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
from datetime import datetime, timezone, timedelta
import httpx

router = APIRouter(prefix="/recharge", tags=["Recharge"])

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


BASE_URL = os.environ.get("EKO_BASE_URL", "")
DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
AUTH_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "")
INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "")
USER_CODE = os.environ.get("EKO_USER_CODE", "")
SOURCE_IP = os.environ.get("EKO_SOURCE_IP", "34.44.149.98")

MAX_RECHARGE_AMOUNT = 500
MAX_RECHARGES_PER_DAY = 1
GENERIC_ERROR = "Technical error. Please try again later."


def _generate_headers(timestamp: str) -> dict:
    encoded_key = base64.b64encode(AUTH_KEY.encode())
    secret_key = base64.b64encode(
        hmac.new(encoded_key, timestamp.encode(), hashlib.sha256).digest()
    ).decode()
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/json",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
        "User-Agent": "okhttp/3.9.0"
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


def _eko_configured() -> bool:
    return all([BASE_URL, DEVELOPER_KEY, AUTH_KEY, INITIATOR_ID, USER_CODE])


# ==================== GET OPERATORS ====================

@router.get("/operators/{recharge_type}")
async def get_recharge_operators(recharge_type: str):
    """Get operators for mobile (cat 5) or dth (cat 4)"""
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
            logging.error(f"[RECHARGE] Operators fetch failed: HTTP {response.status_code}")
            return {"success": False, "operators": []}

        result = response.json()
        operators_raw = result.get("data", result) if isinstance(result, dict) else result

        if isinstance(operators_raw, list):
            operators = [
                {
                    "operator_id": str(op.get("operator_id", "")),
                    "name": op.get("name", "Unknown"),
                    "fetch_bill": op.get("billFetchResponse", 0) == 1
                }
                for op in operators_raw
            ]
            return {"success": True, "operators": operators}

        return {"success": True, "operators": []}

    except Exception as e:
        logging.error(f"[RECHARGE] Operators error: {e}")
        return {"success": False, "operators": []}


# ==================== INITIATE RECHARGE ====================

class RechargeRequest(BaseModel):
    user_id: str
    recharge_type: str
    number: str
    operator_id: str
    amount: float


@router.post("/initiate")
async def initiate_recharge(data: RechargeRequest):
    """Initiate mobile/DTH recharge via Eko BBPS paybill"""
    if db is None:
        return {"success": False, "message": GENERIC_ERROR}

    if not _eko_configured():
        logging.error("[RECHARGE] Eko credentials not configured")
        return {"success": False, "message": GENERIC_ERROR}

    # ===== VALIDATIONS (all failures → generic error) =====

    # 1. Amount check
    if data.amount <= 0 or data.amount > MAX_RECHARGE_AMOUNT:
        logging.warning(f"[RECHARGE] Amount {data.amount} exceeds limit for user {data.user_id}")
        return {"success": False, "message": GENERIC_ERROR}

    # 2. Number validation
    if data.recharge_type == "mobile":
        if not data.number or not data.number.isdigit() or len(data.number) != 10:
            return {"success": False, "message": "Please enter a valid 10-digit mobile number."}
    else:
        if not data.number or len(data.number.strip()) < 3:
            return {"success": False, "message": "Please enter a valid subscriber ID."}

    # 3. Daily limit check (1/day combined for mobile + dth)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_count = await db.recharge_transactions.count_documents({
        "user_id": data.user_id,
        "created_at": {"$gte": today_start},
        "status": {"$nin": ["failed", "refunded"]}
    })
    if today_count >= MAX_RECHARGES_PER_DAY:
        logging.info(f"[RECHARGE] Daily limit reached for user {data.user_id}")
        return {"success": False, "message": GENERIC_ERROR}

    # 4. User + subscription check
    user = await db.users.find_one({"uid": data.user_id})
    if not user:
        return {"success": False, "message": GENERIC_ERROR}

    plan = (user.get("subscription_plan") or "explorer").lower()
    if plan in ["explorer", "free", ""]:
        return {"success": False, "message": "Active subscription required for recharge services."}

    # 5. Calculate charges
    if not calculate_charges_func:
        logging.error("[RECHARGE] calculate_charges_func not set")
        return {"success": False, "message": GENERIC_ERROR}

    req_type = "mobile_recharge" if data.recharge_type == "mobile" else "dish_recharge"
    charges = await calculate_charges_func(data.amount, req_type, data.user_id)
    total_prc = charges["total_prc"]

    # 6. Redeem limit check
    if check_redeem_limit_func:
        try:
            limit_check = await check_redeem_limit_func(data.user_id, data.amount)
            if not limit_check.get("allowed"):
                logging.info(f"[RECHARGE] Redeem limit exceeded for user {data.user_id}")
                return {"success": False, "message": GENERIC_ERROR}
        except Exception as e:
            logging.error(f"[RECHARGE] Redeem limit check error: {e}")

    # 7. PRC balance check
    if user.get("prc_balance", 0) < total_prc:
        return {"success": False, "message": f"Insufficient PRC balance. Required: {total_prc:.0f} PRC"}

    # ===== DEDUCT PRC ATOMICALLY =====
    deduct_result = await db.users.update_one(
        {"uid": data.user_id, "prc_balance": {"$gte": total_prc}},
        {"$inc": {"prc_balance": -total_prc}}
    )
    if deduct_result.modified_count == 0:
        return {"success": False, "message": GENERIC_ERROR}

    # ===== CALL EKO PAYBILL API =====
    request_id = str(uuid.uuid4())
    client_ref_id = f"RCH{int(time.time() * 1000)}"
    timestamp = str(round(time.time() * 1000))
    amount_str = str(int(data.amount))

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
        "latlong": "19.9975,73.7898"
    }

    url = f"{BASE_URL}/v2/billpayments/paybill?initiator_id={INITIATOR_ID}"

    logging.info(f"[RECHARGE] User={data.user_id}, Type={data.recharge_type}, Number={data.number}, Amount=₹{data.amount}, PRC={total_prc:.2f}")
    logging.info(f"[RECHARGE] Eko URL={url}, client_ref={client_ref_id}")

    eko_success = False
    eko_pending = False
    eko_response = {}
    tid = None
    tx_status = None

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=body)

        logging.info(f"[RECHARGE] Eko HTTP={response.status_code}, Body={response.text[:500]}")
        eko_response = response.json()

        eko_status = eko_response.get("status")
        eko_data = eko_response.get("data", {}) if isinstance(eko_response.get("data"), dict) else {}
        tid = eko_data.get("tid")
        tx_status_raw = eko_data.get("tx_status")

        if tx_status_raw is not None:
            try:
                tx_status = int(tx_status_raw)
            except (ValueError, TypeError):
                tx_status = None

        if eko_status == 0:
            if tx_status == 0:
                eko_success = True
            elif tx_status == 2:
                eko_pending = True
            # tx_status 1,3,4,5 = failure variants
        # eko_status != 0 = request-level error

    except httpx.TimeoutException:
        logging.error(f"[RECHARGE] Eko timeout for user {data.user_id}, ref={client_ref_id}")
        eko_pending = True
        eko_response = {"error": "timeout"}
    except httpx.ConnectError:
        logging.error(f"[RECHARGE] Eko connection error for user {data.user_id}")
        eko_response = {"error": "connection_error"}
    except Exception as e:
        logging.error(f"[RECHARGE] Eko error: {e}")
        eko_response = {"error": str(e)}

    # ===== HANDLE RESULT =====
    now_iso = datetime.now(timezone.utc).isoformat()
    user_name = user.get("name", "")
    user_mobile = user.get("mobile", "")

    if eko_success or eko_pending:
        status = "success" if eko_success else "pending"

        # Record in recharge_transactions
        txn = {
            "request_id": request_id,
            "user_id": data.user_id,
            "user_name": user_name,
            "user_mobile": user_mobile,
            "recharge_type": data.recharge_type,
            "number": data.number,
            "operator_id": data.operator_id,
            "amount_inr": data.amount,
            "total_prc_deducted": round(total_prc, 2),
            "prc_required": round(charges["amount_prc"], 2),
            "processing_fee_prc": round(charges["processing_fee_prc"], 2),
            "admin_charge_prc": round(charges["admin_charge_prc"], 2),
            "charge_breakdown": {k: round(v, 2) if isinstance(v, float) else v for k, v in charges.items()},
            "eko_tid": tid,
            "client_ref_id": client_ref_id,
            "status": status,
            "created_at": now_iso
        }
        await db.recharge_transactions.insert_one(txn)

        # Record in bill_payment_requests for Admin BBPS page
        bill_record = {
            "request_id": request_id,
            "user_id": data.user_id,
            "user_name": user_name,
            "user_mobile": user_mobile,
            "request_type": req_type,
            "service_type": req_type,
            "amount_inr": data.amount,
            "amount": data.amount,
            "prc_required": round(charges["amount_prc"], 2),
            "processing_fee_inr": round(charges["processing_fee_inr"], 2),
            "processing_fee_prc": round(charges["processing_fee_prc"], 2),
            "admin_charge_inr": round(charges["admin_charge_inr"], 2),
            "admin_charge_prc": round(charges["admin_charge_prc"], 2),
            "admin_charge_percent": charges.get("admin_charge_percent", 20),
            "total_inr": round(charges["total_inr"], 2),
            "total_prc_deducted": round(total_prc, 2),
            "service_charge_amount": round(charges["processing_fee_prc"] + charges["admin_charge_prc"], 2),
            "charge_breakdown": {k: round(v, 2) if isinstance(v, float) else v for k, v in charges.items()},
            "details": {
                "number": data.number,
                "operator_id": data.operator_id,
                "recharge_type": data.recharge_type
            },
            "status": "paid" if eko_success else "pending",
            "eko_tid": tid,
            "client_ref_id": client_ref_id,
            "created_at": now_iso,
            "processed_at": now_iso if eko_success else None
        }
        await db.bill_payment_requests.insert_one(bill_record)

        # Log PRC transaction
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
                        "amount_inr": data.amount,
                        "operator_id": data.operator_id
                    },
                    skip_balance_update=True
                )
            except Exception as e:
                logging.error(f"[RECHARGE] Log transaction error: {e}")

        msg = "Recharge successful!" if eko_success else "Recharge is being processed. Please check status shortly."
        logging.info(f"[RECHARGE] {status.upper()} for user {data.user_id}, tid={tid}, ref={client_ref_id}")

        return {
            "success": True,
            "message": msg,
            "request_id": request_id,
            "amount": data.amount,
            "prc_deducted": round(total_prc, 2),
            "status": status,
            "tid": tid
        }

    else:
        # FAILED → Refund PRC
        await db.users.update_one(
            {"uid": data.user_id},
            {"$inc": {"prc_balance": total_prc}}
        )

        txn = {
            "request_id": request_id,
            "user_id": data.user_id,
            "user_name": user_name,
            "user_mobile": user_mobile,
            "recharge_type": data.recharge_type,
            "number": data.number,
            "operator_id": data.operator_id,
            "amount_inr": data.amount,
            "total_prc_deducted": 0,
            "eko_tid": tid,
            "client_ref_id": client_ref_id,
            "status": "failed",
            "prc_refunded": True,
            "eko_error": eko_response.get("message", str(eko_response.get("error", ""))),
            "created_at": now_iso
        }
        await db.recharge_transactions.insert_one(txn)

        logging.warning(f"[RECHARGE] FAILED for user {data.user_id}: {eko_response.get('message', 'unknown')}")

        return {
            "success": False,
            "message": GENERIC_ERROR,
            "request_id": request_id
        }


# ==================== RECHARGE HISTORY ====================

@router.get("/history/{user_id}")
async def get_recharge_history(user_id: str):
    """Get user's recharge history"""
    if db is None:
        return {"success": False, "transactions": []}

    txns = await db.recharge_transactions.find(
        {"user_id": user_id},
        {"_id": 0, "eko_response": 0, "charge_breakdown": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    return {"success": True, "transactions": txns, "count": len(txns)}
