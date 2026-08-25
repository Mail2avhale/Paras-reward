"""
PRC Redemption Service Charge — 20% cash fee, charged AFTER successful redemption.

Spec: 41-point business requirements from user (Aug 2026).

Business rules
--------------
1. Cash fee = 20% of INR redemption value (config: `service_charge_percent`)
2. PRC rate = 10 PRC = ₹1 INR (config: `prc_inr_rate`)
3. Fee is created ONLY when redemption reaches SUCCESSFULLY_COMPLETED status
4. Failed/rejected/cancelled/expired redemptions → NO fee (Point 33)
5. Any PENDING fee blocks the user from creating a new redemption (Points 7, 18, 37)
6. PRC rate is SNAPSHOTTED on the fee row — future rate changes don't retroactively alter historical fees (Point 10)
7. Unique index on (redemption_id) — one successful redemption = exactly one fee (Point 17)
8. Payment verified server-side via Razorpay signature (Point 13)
9. Duplicate webhook cannot create duplicate paid state (Point 17)

Collections
-----------
redemption_service_charges — one row per successful redemption
service_charge_audit — every state transition
service_charge_config — singleton with rate config
"""
import os
import uuid
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

router = APIRouter(prefix="", tags=["Redemption Service Charge"])
db = None
logger = logging.getLogger(__name__)

DEFAULT_CONFIG = {
    "_id": "default",
    "service_charge_percent": 20,
    "prc_inr_rate": 10,        # 10 PRC = ₹1
    "min_service_charge_inr": 1,
    "max_payment_attempts": 5,
}


# Friendly labels for the Community Forum success-story post.
# `redemption_type` values in redemption_service_charges are set by
# create_service_charge_on_success() (line 96) — keep this map in sync
# if new redemption types are ever added upstream.
_REDEMPTION_TYPE_LABELS = {
    "mobile_recharge": "Mobile Recharge",
    "dth_recharge": "DTH Recharge",
    "bank_redeem": "Bank Redeem",
    "subscription": "Subscription",
    "gift_prc": "Gift PRC",
    "paras_mall": "Paras Mall booking",
    "generic": "redemption",
}


def _redemption_type_label(redemption_id: Optional[str]) -> str:
    """Best-effort human label for the Community Forum post body.

    We first check the ID prefix (fast + no extra DB call). If unknown, we
    fall back to "redemption" — the generic template still reads well.
    """
    if not redemption_id:
        return "redemption"
    rid = redemption_id.upper()
    if rid.startswith("MOB") or rid.startswith("RCH") or "MOBILE" in rid:
        return _REDEMPTION_TYPE_LABELS["mobile_recharge"]
    if rid.startswith("DTH"):
        return _REDEMPTION_TYPE_LABELS["dth_recharge"]
    if rid.startswith("BNK") or rid.startswith("BANK") or rid.startswith("MBT"):
        return _REDEMPTION_TYPE_LABELS["bank_redeem"]
    if rid.startswith("SUB") or rid.startswith("PLAN"):
        return _REDEMPTION_TYPE_LABELS["subscription"]
    if rid.startswith("GIFT"):
        return _REDEMPTION_TYPE_LABELS["gift_prc"]
    if rid.startswith("MALL") or rid.startswith("BOOK"):
        return _REDEMPTION_TYPE_LABELS["paras_mall"]
    return "redemption"


def set_db(database):
    global db
    db = database


async def get_config() -> dict:
    row = await db.service_charge_config.find_one({"_id": "default"})
    if not row:
        await db.service_charge_config.insert_one(dict(DEFAULT_CONFIG))
        return dict(DEFAULT_CONFIG)
    return {**DEFAULT_CONFIG, **row}


async def _audit(charge_id: str, action: str, old_status: str, new_status: str,
                 user_id: Optional[str], admin_id: Optional[str] = None,
                 reason: str = "", meta: Optional[dict] = None):
    try:
        await db.service_charge_audit.insert_one({
            "audit_id": str(uuid.uuid4()),
            "charge_id": charge_id,
            "action": action,
            "old_status": old_status,
            "new_status": new_status,
            "user_id": user_id,
            "admin_id": admin_id,
            "reason": reason,
            "meta": meta or {},
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"[SVC-CHG-AUDIT] failed (non-fatal): {e}")


# ============================================================================
# CORE HELPERS (called from redemption success paths)
# ============================================================================

async def has_pending_service_charge(user_id: str) -> Optional[dict]:
    """Returns the pending charge doc if user has one, else None."""
    return await db.redemption_service_charges.find_one(
        {"user_id": user_id, "status": "PENDING"},
        {"_id": 0},
    )


async def create_service_charge_on_success(
    user_id: str,
    redemption_id: str,
    prc_amount: float,
    redemption_type: str = "generic",
) -> Optional[dict]:
    """Called when a redemption reaches SUCCESSFULLY_COMPLETED status.

    Idempotent — unique index on redemption_id ensures at most one row.
    Returns the charge doc or None on failure.
    """
    if not redemption_id or prc_amount <= 0:
        return None
    cfg = await get_config()
    rate = float(cfg["prc_inr_rate"])
    pct = float(cfg["service_charge_percent"])

    inr_value = round(prc_amount / rate, 2)
    fee = round(inr_value * pct / 100, 2)
    fee = max(fee, float(cfg["min_service_charge_inr"]))

    now_iso = datetime.now(timezone.utc).isoformat()
    charge_id = f"SVC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

    doc = {
        "charge_id": charge_id,
        "user_id": user_id,
        "redemption_id": redemption_id,
        "redemption_type": redemption_type,
        "prc_amount": prc_amount,
        "prc_rate": rate,               # SNAPSHOT — never mutated (Point 10)
        "redemption_value_inr": inr_value,
        "service_charge_percentage": pct,
        "service_charge_amount": fee,
        "tax_amount": 0.0,              # separately handled per CA advice
        "total_payable": fee,
        "currency": "INR",
        "status": "PENDING",            # PENDING → PAID | EXPIRED | REFUNDED
        "payment_order_id": None,
        "payment_id": None,
        "payment_gateway": "razorpay",
        "payment_attempts": 0,
        "created_at": now_iso,
        "applicable_at": now_iso,
        "paid_at": None,
        "updated_at": now_iso,
    }

    try:
        await db.redemption_service_charges.insert_one(doc)
        await _audit(charge_id, "created", "-", "PENDING", user_id,
                     reason=f"Auto on redemption {redemption_id} success")
        # In-app notification (Feb 2026, Phase 3) — non-fatal
        try:
            await db.notifications.insert_one({
                "notification_id": str(uuid.uuid4()).replace("-", ""),
                "user_id": user_id,
                "user_uid": user_id,
                "type": "redemption_service_charge_created",
                "title": "💰 Redemption Service Charge Pending",
                "message": (
                    f"Your ₹{inr_value:.0f} redemption completed successfully. "
                    f"A 20% cash service charge of ₹{fee:.0f} is now due. "
                    f"Pay it to unlock your next redemption."
                ),
                "action_url": "/my-service-charges",
                "created_at": now_iso,
                "read": False,
                "is_read": False,
                "charge_id": charge_id,
                "redemption_id": redemption_id,
            })
        except Exception as _ne:
            logger.warning(f"[SVC-CHG] notification insert failed (non-fatal): {_ne}")
        return doc
    except Exception as e:
        # Unique index on redemption_id → duplicate = someone else already created
        existing = await db.redemption_service_charges.find_one(
            {"redemption_id": redemption_id}, {"_id": 0},
        )
        if existing:
            return existing
        logger.warning(f"[SVC-CHG] create failed: {e}")
        return None


# ============================================================================
# SYNC VERSIONS — for WalletServiceV2 (uses sync pymongo)
# ============================================================================
# Re-exports from the lightweight app/services/service_charge_sync module so
# WalletServiceV2 (sync path) can hook 20% service charge on every user PRC
# spend without importing FastAPI / auth here.
from app.services.service_charge_sync import (  # noqa: E402
    NON_CHARGEABLE_TXN_TYPES,
    create_service_charge_sync,
    cancel_service_charge_by_reference_sync,
)



# ============================================================================
# USER ENDPOINTS
# ============================================================================

@router.get("/redemption-service-charge/pending/{user_id}")
async def get_pending(user_id: str):
    row = await has_pending_service_charge(user_id)
    return {"has_pending": bool(row), "charge": row}


@router.get("/redemption-service-charge/{charge_id}")
async def get_charge(charge_id: str):
    row = await db.redemption_service_charges.find_one({"charge_id": charge_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Charge not found")
    return row


@router.get("/redemption-service-charge/history/{user_id}")
async def user_history(user_id: str, limit: int = 100):
    rows = await db.redemption_service_charges.find(
        {"user_id": user_id}, {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    totals = {"pending": 0.0, "paid": 0.0}
    for r in rows:
        if r["status"] == "PENDING":
            totals["pending"] += r["total_payable"]
        elif r["status"] == "PAID":
            totals["paid"] += r["total_payable"]
    return {"charges": rows, "totals": {k: round(v, 2) for k, v in totals.items()}}


class CreatePaymentRequest(BaseModel):
    charge_id: str


@router.post("/redemption-service-charge/create-payment")
async def create_payment_order(data: CreatePaymentRequest):
    """Create a Razorpay order for this pending service charge."""
    charge = await db.redemption_service_charges.find_one({"charge_id": data.charge_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")
    if charge["status"] != "PENDING":
        raise HTTPException(status_code=400, detail=f"Charge status is {charge['status']}, not PENDING")

    cfg = await get_config()
    if charge["payment_attempts"] >= cfg["max_payment_attempts"]:
        raise HTTPException(status_code=429, detail="Max payment attempts reached. Contact support.")

    # Sanity: Razorpay env vars must be present regardless of whether we
    # reuse an existing order or create a new one (bug testing agent flag).
    key_id = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    if not key_id or not key_secret:
        logger.error("[SVC-CHG] Razorpay env vars missing in this environment")
        raise HTTPException(
            status_code=503,
            detail="Payment service is temporarily unavailable. Admin: check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars.",
        )

    # Idempotent: reuse open order if it exists
    if charge.get("payment_order_id"):
        return {
            "order_id": charge["payment_order_id"],
            "amount": int(charge["total_payable"] * 100),
            "currency": "INR",
            "charge_id": charge["charge_id"],
            "razorpay_key": key_id,
            "reused": True,
        }

    # Create Razorpay order
    try:
        import razorpay
        client = razorpay.Client(auth=(key_id, key_secret))
        order = client.order.create({
            "amount": int(charge["total_payable"] * 100),   # paise
            "currency": "INR",
            "receipt": data.charge_id,
            "notes": {
                "charge_id": data.charge_id,
                "redemption_id": charge["redemption_id"],
                "type": "prc_redemption_service_charge",
            },
        })
        await db.redemption_service_charges.update_one(
            {"charge_id": data.charge_id},
            {"$set": {
                "payment_order_id": order["id"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }, "$inc": {"payment_attempts": 1}},
        )
        await _audit(data.charge_id, "payment_order_created", "PENDING", "PENDING",
                     charge["user_id"], meta={"order_id": order["id"]})
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "charge_id": data.charge_id,
            "razorpay_key": os.environ.get("RAZORPAY_KEY_ID", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SVC-CHG] razorpay order failed: {type(e).__name__}: {e}")
        # Return the underlying reason so admin can debug (never expose raw
        # keys — the string is razorpay SDK error text, not our secret).
        raise HTTPException(
            status_code=502,
            detail=f"Payment gateway error: {str(e)[:180]}",
        )


class VerifyPaymentRequest(BaseModel):
    charge_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/redemption-service-charge/verify-payment")
async def verify_payment(data: VerifyPaymentRequest):
    """Server-side signature verification (Point 13, 35)."""
    charge = await db.redemption_service_charges.find_one({"charge_id": data.charge_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")
    if charge["status"] == "PAID":
        return {"success": True, "already_paid": True, "charge_id": data.charge_id}

    # Verify signature server-side
    secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    body = f"{data.razorpay_order_id}|{data.razorpay_payment_id}"
    expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, data.razorpay_signature):
        await _audit(data.charge_id, "signature_verification_failed", "PENDING", "PENDING",
                     charge["user_id"], reason="Invalid Razorpay signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    if data.razorpay_order_id != charge.get("payment_order_id"):
        raise HTTPException(status_code=400, detail="Order ID mismatch")

    # Atomic transition to PAID — protects against double webhook
    now_iso = datetime.now(timezone.utc).isoformat()
    result = await db.redemption_service_charges.update_one(
        {"charge_id": data.charge_id, "status": "PENDING"},
        {"$set": {
            "status": "PAID",
            "payment_id": data.razorpay_payment_id,
            "paid_at": now_iso,
            "updated_at": now_iso,
        }},
    )
    if result.modified_count == 0:
        # Someone else already marked paid — idempotent success
        fresh = await db.redemption_service_charges.find_one({"charge_id": data.charge_id}, {"_id": 0})
        return {"success": True, "already_paid": True, "charge": fresh}

    await _audit(data.charge_id, "paid", "PENDING", "PAID", charge["user_id"],
                 meta={"payment_id": data.razorpay_payment_id})
    fresh = await db.redemption_service_charges.find_one({"charge_id": data.charge_id}, {"_id": 0})

    # Community Forum success-story post (Feb 27 2026) — celebrate that the
    # user cleared the 20% service charge and finished their redemption.
    # Idempotent via ref_id + 24 h dedup inside create_success_story_post.
    try:
        import asyncio as _asyncio
        from routes.community import create_success_story_post
        redemption_note = _redemption_type_label(fresh.get("redemption_id"))
        _asyncio.create_task(create_success_story_post(
            user_id=charge["user_id"],
            service_type="service_charge",
            amount_inr=float(fresh.get("total_payable") or 0),
            ref_id=f"svc-charge:{data.charge_id}",
            extra_title=redemption_note,
        ))
    except Exception as e:
        logger.warning(f"[SVC-CHARGE] community post failed (non-fatal): {e}")

    return {"success": True, "charge": fresh}


# ============================================================================
# BULK PAY (Feb 2026) — clear ALL pending charges in one Razorpay checkout
# ============================================================================

class BulkPayOrderRequest(BaseModel):
    user_id: str


@router.post("/redemption-service-charge/bulk-pay-order")
async def create_bulk_pay_order(data: BulkPayOrderRequest):
    """Create ONE Razorpay order for the sum of ALL pending charges of a user.

    Returns the order + the list of `charge_ids` included so the frontend can
    pass them back to `/bulk-verify-payment` after Razorpay success.
    """
    pending = await db.redemption_service_charges.find(
        {"user_id": data.user_id, "status": "PENDING"}, {"_id": 0},
    ).sort("created_at", 1).to_list(500)
    if not pending:
        raise HTTPException(status_code=404, detail="No pending charges to pay")

    cfg = await get_config()
    # Skip charges whose attempt counter is maxed out
    payable = [c for c in pending if c.get("payment_attempts", 0) < cfg["max_payment_attempts"]]
    if not payable:
        raise HTTPException(
            status_code=429,
            detail="All pending charges have exceeded max payment attempts. Contact support.",
        )

    total_paise = sum(int(round(c["total_payable"] * 100)) for c in payable)
    if total_paise <= 0:
        raise HTTPException(status_code=400, detail="Payable amount is zero")

    charge_ids = [c["charge_id"] for c in payable]
    bulk_receipt = f"BULK-{data.user_id[:8]}-{datetime.now(timezone.utc).strftime('%y%m%d%H%M%S')}"

    try:
        import razorpay
        key_id = os.environ.get("RAZORPAY_KEY_ID", "").strip()
        key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
        if not key_id or not key_secret:
            logger.error("[SVC-CHG] Razorpay env vars missing (bulk)")
            raise HTTPException(
                status_code=503,
                detail="Payment service is temporarily unavailable. Admin: check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars.",
            )
        client = razorpay.Client(auth=(key_id, key_secret))
        order = client.order.create({
            "amount": total_paise,
            "currency": "INR",
            "receipt": bulk_receipt,
            "notes": {
                "user_id": data.user_id,
                "type": "prc_redemption_service_charge_bulk",
                "charge_count": len(charge_ids),
                "charge_ids": ",".join(charge_ids[:20]),   # notes cap ~15 keys
            },
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SVC-CHG] bulk razorpay order failed: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Payment gateway error: {str(e)[:180]}",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    # Stamp the SAME order_id on every included charge + bump attempts
    await db.redemption_service_charges.update_many(
        {"charge_id": {"$in": charge_ids}, "status": "PENDING"},
        {"$set": {
            "payment_order_id": order["id"],
            "bulk_pay_receipt": bulk_receipt,
            "updated_at": now_iso,
        }, "$inc": {"payment_attempts": 1}},
    )
    for cid in charge_ids:
        await _audit(cid, "bulk_payment_order_created", "PENDING", "PENDING",
                     data.user_id, meta={"order_id": order["id"],
                                          "bulk_receipt": bulk_receipt,
                                          "charge_count": len(charge_ids)})

    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "charge_ids": charge_ids,
        "charge_count": len(charge_ids),
        "razorpay_key": os.environ.get("RAZORPAY_KEY_ID", ""),
        "bulk_receipt": bulk_receipt,
    }


class BulkVerifyRequest(BaseModel):
    user_id: str
    charge_ids: list
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/redemption-service-charge/bulk-verify-payment")
async def bulk_verify_payment(data: BulkVerifyRequest):
    """Verify a bulk-pay signature and mark ALL included charges PAID atomically."""
    if not data.charge_ids:
        raise HTTPException(status_code=400, detail="charge_ids is empty")

    # Signature check (once, on the aggregated order)
    secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    body = f"{data.razorpay_order_id}|{data.razorpay_payment_id}"
    expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, data.razorpay_signature):
        for cid in data.charge_ids:
            await _audit(cid, "bulk_signature_verification_failed", "PENDING", "PENDING",
                         data.user_id, reason="Invalid signature on bulk pay")
        raise HTTPException(status_code=400, detail="Invalid signature")

    now_iso = datetime.now(timezone.utc).isoformat()
    paid_count = 0
    already_paid = 0
    skipped = []
    for cid in data.charge_ids:
        charge = await db.redemption_service_charges.find_one({"charge_id": cid})
        if not charge:
            skipped.append({"charge_id": cid, "reason": "not_found"})
            continue
        if charge["status"] == "PAID":
            already_paid += 1
            continue
        if charge.get("payment_order_id") != data.razorpay_order_id:
            skipped.append({"charge_id": cid, "reason": "order_mismatch"})
            continue
        r = await db.redemption_service_charges.update_one(
            {"charge_id": cid, "status": "PENDING"},
            {"$set": {
                "status": "PAID",
                "payment_id": data.razorpay_payment_id,
                "paid_at": now_iso,
                "updated_at": now_iso,
                "bulk_paid": True,
            }},
        )
        if r.modified_count:
            paid_count += 1
            await _audit(cid, "bulk_paid", "PENDING", "PAID", data.user_id,
                         meta={"payment_id": data.razorpay_payment_id,
                               "bulk_batch_size": len(data.charge_ids)})
            # Community Forum success-story post per PAID charge — same
            # dedup rules as the single-pay path. Fire-and-forget so a
            # community failure never blocks the bulk-pay response.
            try:
                import asyncio as _asyncio
                from routes.community import create_success_story_post
                redemption_note = _redemption_type_label(charge.get("redemption_id"))
                _asyncio.create_task(create_success_story_post(
                    user_id=data.user_id,
                    service_type="service_charge",
                    amount_inr=float(charge.get("total_payable") or 0),
                    ref_id=f"svc-charge:{cid}",
                    extra_title=redemption_note,
                ))
            except Exception as _e:
                logger.warning(f"[SVC-CHARGE bulk] community post failed (non-fatal): {_e}")

    return {
        "success": True,
        "paid_count": paid_count,
        "already_paid": already_paid,
        "skipped": skipped,
        "total_requested": len(data.charge_ids),
    }


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@router.get("/admin/redemption-service-charge/summary")
async def admin_summary(days: int = 30):
    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {
            "_id": "$status", "count": {"$sum": 1},
            "amount": {"$sum": "$total_payable"},
        }},
    ]
    rows = await db.redemption_service_charges.aggregate(pipeline).to_list(20)
    by_status = {"PENDING": {"count": 0, "amount": 0.0}, "PAID": {"count": 0, "amount": 0.0}}
    for r in rows:
        by_status[r["_id"]] = {"count": r["count"], "amount": round(r["amount"], 2)}
    return {"by_status": by_status, "since": since, "days": days}


@router.get("/admin/redemption-service-charge/pending")
async def admin_pending_list(limit: int = 200):
    rows = await db.redemption_service_charges.find(
        {"status": "PENDING"}, {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    for r in rows:
        u = await db.users.find_one({"uid": r["user_id"]},
            {"_id": 0, "name": 1, "email": 1, "mobile": 1, "phone": 1})
        r["user"] = u
    return {"pending": rows, "total": len(rows)}


@router.get("/admin/redemption-service-charge/search")
async def admin_search(q: str):
    """Search by user_id / redemption_id / charge_id / payment_id / mobile."""
    or_query = [
        {"user_id": q}, {"redemption_id": q}, {"charge_id": q}, {"payment_id": q},
    ]
    # Also try mobile lookup → user_id
    user = await db.users.find_one({"$or": [{"mobile": q}, {"phone": q}, {"email": q}]},
                                    {"_id": 0, "uid": 1})
    if user:
        or_query.append({"user_id": user["uid"]})
    rows = await db.redemption_service_charges.find(
        {"$or": or_query}, {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    return {"results": rows, "total": len(rows)}


class ManualPaidRequest(BaseModel):
    charge_id: str
    reason: str = Field(min_length=5, max_length=500)
    admin_id: str
    external_reference: str = ""


@router.post("/admin/redemption-service-charge/manual-mark-paid")
async def admin_manual_paid(data: ManualPaidRequest,
                             x_finance_pin: str = Header(..., alias="X-Finance-Pin")):
    """Requires separate finance PIN to prevent casual admin misuse (Point 30)."""
    expected = os.environ.get("FINANCE_ADMIN_PIN", "")
    if not expected or x_finance_pin != expected:
        raise HTTPException(status_code=403, detail="Finance authorization required")

    charge = await db.redemption_service_charges.find_one({"charge_id": data.charge_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")
    if charge["status"] == "PAID":
        raise HTTPException(status_code=400, detail="Already paid")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.redemption_service_charges.update_one(
        {"charge_id": data.charge_id, "status": "PENDING"},
        {"$set": {
            "status": "PAID", "paid_at": now_iso, "updated_at": now_iso,
            "manual_marked_by": data.admin_id,
            "manual_reason": data.reason,
            "external_reference": data.external_reference,
        }},
    )
    await _audit(data.charge_id, "manual_marked_paid", "PENDING", "PAID",
                 charge["user_id"], admin_id=data.admin_id, reason=data.reason,
                 meta={"external_reference": data.external_reference})

    # Community Forum success-story post (parity with the Razorpay path).
    try:
        import asyncio as _asyncio
        from routes.community import create_success_story_post
        redemption_note = _redemption_type_label(charge.get("redemption_id"))
        _asyncio.create_task(create_success_story_post(
            user_id=charge["user_id"],
            service_type="service_charge",
            amount_inr=float(charge.get("total_payable") or 0),
            ref_id=f"svc-charge:{data.charge_id}",
            extra_title=redemption_note,
        ))
    except Exception as _e:
        logger.warning(f"[SVC-CHARGE manual] community post failed (non-fatal): {_e}")

    return {"success": True}


@router.get("/admin/redemption-service-charge/audit/{charge_id}")
async def admin_audit_log(charge_id: str):
    rows = await db.service_charge_audit.find(
        {"charge_id": charge_id}, {"_id": 0},
    ).sort("ts", 1).to_list(500)
    return {"charge_id": charge_id, "audit": rows}


class ReversalRequest(BaseModel):
    charge_id: str
    reason: str = Field(min_length=5, max_length=500)
    admin_id: str
    refund_reference: str = ""


@router.post("/admin/redemption-service-charge/reverse")
async def admin_reverse_charge(data: ReversalRequest,
                                x_finance_pin: str = Header(..., alias="X-Finance-Pin")):
    """Reverse/refund a PAID service charge — for admin corrections and
    disputes (Phase 3). Requires the finance PIN. Fully audit-logged.
    """
    expected = os.environ.get("FINANCE_ADMIN_PIN", "")
    if not expected or x_finance_pin != expected:
        raise HTTPException(status_code=403, detail="Finance authorization required")

    charge = await db.redemption_service_charges.find_one({"charge_id": data.charge_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")
    if charge["status"] not in ("PAID",):
        raise HTTPException(status_code=400, detail=f"Cannot reverse a {charge['status']} charge")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.redemption_service_charges.update_one(
        {"charge_id": data.charge_id},
        {"$set": {
            "status": "REFUNDED", "refunded_at": now_iso, "updated_at": now_iso,
            "reversed_by": data.admin_id, "reversal_reason": data.reason,
            "refund_reference": data.refund_reference,
        }},
    )
    await _audit(data.charge_id, "reversed", "PAID", "REFUNDED",
                 charge["user_id"], admin_id=data.admin_id, reason=data.reason,
                 meta={"refund_reference": data.refund_reference})
    # In-app notification to user
    try:
        await db.notifications.insert_one({
            "notification_id": str(uuid.uuid4()).replace("-", ""),
            "user_id": charge["user_id"], "user_uid": charge["user_id"],
            "type": "redemption_service_charge_reversed",
            "title": "↩ Service Charge Refunded",
            "message": (
                f"Your ₹{charge['total_payable']} redemption service charge "
                f"has been refunded. Ref: {data.refund_reference or 'N/A'}."
            ),
            "action_url": "/my-service-charges",
            "created_at": now_iso, "read": False, "is_read": False,
            "charge_id": data.charge_id,
        })
    except Exception:
        pass
    return {"success": True}


@router.post("/admin/redemption-service-charge/fix-community-tags")
async def admin_fix_community_tags(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """One-shot migration: force `metadata.service_type = "service_charge"`
    on every community post whose `metadata.ref_id` starts with
    `svc-charge:`. Fixes posts that were created before the frontend
    theme knew about the service_charge type, so they render with the
    proper 💎 Redemption Complete chip instead of the mobile_recharge
    fallback.
    """
    expected = os.environ.get("ADMIN_OPERATION_PIN", "")
    if not expected or x_admin_pin != expected:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    r = await db.community_posts.update_many(
        {"metadata.ref_id": {"$regex": "^svc-charge:"},
         "metadata.service_type": {"$ne": "service_charge"}},
        {"$set": {
            "metadata.service_type": "service_charge",
            "metadata.service_label": "Service Charge",
            "metadata.service_icon": "💎",
        }},
    )
    return {"success": True, "posts_migrated": r.modified_count}


@router.get("/admin/redemption-service-charge/revenue-report")
async def admin_revenue_report(days: int = 30):
    """Daily revenue timeseries for admin dashboard reporting (Phase 3)."""
    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"status": "PAID", "paid_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$substr": ["$paid_at", 0, 10]},
            "count": {"$sum": 1},
            "revenue": {"$sum": "$total_payable"},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.redemption_service_charges.aggregate(pipeline).to_list(days + 5)
    return {
        "since": since,
        "days": days,
        "series": [{"date": r["_id"], "count": r["count"],
                    "revenue": round(r["revenue"], 2)} for r in rows],
        "total_revenue": round(sum(r["revenue"] for r in rows), 2),
        "total_count": sum(r["count"] for r in rows),
    }


# ============================================================================
# INDEXES (called on startup)
# ============================================================================

async def ensure_indexes():
    if db is None:
        return
    try:
        await db.redemption_service_charges.create_index("charge_id", unique=True)
        await db.redemption_service_charges.create_index("redemption_id", unique=True)  # 1 charge per redemption
        await db.redemption_service_charges.create_index([("user_id", 1), ("status", 1)])
        await db.redemption_service_charges.create_index("created_at")
        await db.service_charge_audit.create_index([("charge_id", 1), ("ts", 1)])
        logger.info("[SVC-CHG] indexes ensured")
    except Exception as e:
        logger.warning(f"[SVC-CHG] index ensure failed: {e}")
