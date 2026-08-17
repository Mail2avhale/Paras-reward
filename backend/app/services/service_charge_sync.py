"""
Lightweight sync helpers for creating/cancelling PRC service charges.

Kept separate from routes/redemption_service_charge.py so it can be imported
from WalletServiceV2 (sync PyMongo path) WITHOUT dragging in FastAPI, auth,
JWT config, or the rest of the server import graph.

Single source of truth for the async (motor) helpers still lives in
routes/redemption_service_charge.py. This file is for the SYNC path only.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = {
    "_id": "default",
    "service_charge_percent": 20,
    "prc_inr_rate": 10,        # 10 PRC = ₹1
    "min_service_charge_inr": 1,
    "max_payment_attempts": 5,
}

# Skip these txn_types in the universal interceptor. Everything else that
# calls WalletServiceV2.debit() will auto-generate a 20% service charge.
NON_CHARGEABLE_TXN_TYPES = {
    # Credits (should never hit debit anyway, but defensive)
    "refund", "prc_refund", "mining", "reward", "referral_bonus",
    "signup_bonus", "admin_credit", "manual_credit", "prc_credit",
    # Admin corrections & system moves
    "admin_debit", "manual_debit", "double_credit_fix",
    "retry_debit", "retry_refund",
    # Peer transfers — user-to-user, no revenue realization
    "transfer_in", "transfer_out", "transfer_rollback",
    # Auto-burns (system, not user-initiated spend)
    "burn", "sustainability_burn",
    # Bank Redeem has its own hook on admin mark-paid — skip here to avoid
    # double-charging (charge fires only when payout actually completes).
    "bank_transfer",
}


def _get_sync_db():
    """Local import to prevent import-time side effects."""
    from app.core.database import get_sync_db
    return get_sync_db()


def create_service_charge_sync(
    user_id: str,
    redemption_id: str,
    prc_amount: float,
    redemption_type: str = "generic",
) -> Optional[dict]:
    """Sync version — for WalletServiceV2 universal interceptor.

    Idempotent via unique index on redemption_id.
    """
    if not redemption_id or prc_amount <= 0:
        return None

    try:
        sdb = _get_sync_db()
    except Exception as e:
        logger.warning(f"[SVC-CHG-SYNC] db unavailable: {e}")
        return None

    # Config
    try:
        row = sdb.service_charge_config.find_one({"_id": "default"})
    except Exception:
        row = None
    if not row:
        try:
            sdb.service_charge_config.insert_one(dict(DEFAULT_CONFIG))
        except Exception:
            pass
        cfg = dict(DEFAULT_CONFIG)
    else:
        cfg = {**DEFAULT_CONFIG, **row}

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
        "prc_rate": rate,
        "redemption_value_inr": inr_value,
        "service_charge_percentage": pct,
        "service_charge_amount": fee,
        "tax_amount": 0.0,
        "total_payable": fee,
        "currency": "INR",
        "status": "PENDING",
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
        sdb.redemption_service_charges.insert_one(doc)
        try:
            sdb.service_charge_audit.insert_one({
                "audit_id": str(uuid.uuid4()),
                "charge_id": charge_id,
                "action": "created", "old_status": "-", "new_status": "PENDING",
                "user_id": user_id, "admin_id": None,
                "reason": f"Auto on {redemption_type} success · ref={redemption_id}",
                "meta": {"txn_type": redemption_type}, "ts": now_iso,
            })
        except Exception:
            pass
        try:
            sdb.notifications.insert_one({
                "notification_id": str(uuid.uuid4()).replace("-", ""),
                "user_id": user_id, "user_uid": user_id,
                "type": "redemption_service_charge_created",
                "title": "Service Charge Pending",
                "message": (
                    f"Your {redemption_type} of ₹{inr_value:.0f} was successful. "
                    f"A 20% service charge of ₹{fee:.0f} is now due. "
                    f"Pay it to unlock your next PRC spend."
                ),
                "action_url": "/my-service-charges",
                "created_at": now_iso, "read": False, "is_read": False,
                "charge_id": charge_id, "redemption_id": redemption_id,
            })
        except Exception:
            pass
        return doc
    except Exception as e:
        # Unique index race — someone already created it
        try:
            existing = sdb.redemption_service_charges.find_one(
                {"redemption_id": redemption_id}, {"_id": 0},
            )
            if existing:
                return existing
        except Exception:
            pass
        logger.warning(f"[SVC-CHG-SYNC] insert failed: {e}")
        return None


def cancel_service_charge_by_reference_sync(reference: str,
                                             reason: str = "Auto-cancel on refund") -> int:
    """When a service is refunded (credit with same reference), auto-cancel
    the linked PENDING charge or mark PAID → REFUNDED.
    """
    if not reference:
        return 0
    try:
        sdb = _get_sync_db()
    except Exception:
        return 0

    now_iso = datetime.now(timezone.utc).isoformat()
    transitioned = 0

    # PENDING → CANCELLED
    try:
        rows = list(sdb.redemption_service_charges.find(
            {"redemption_id": reference, "status": "PENDING"},
            {"charge_id": 1, "user_id": 1},
        ))
    except Exception:
        rows = []
    for row in rows:
        try:
            r = sdb.redemption_service_charges.update_one(
                {"charge_id": row["charge_id"], "status": "PENDING"},
                {"$set": {"status": "CANCELLED", "updated_at": now_iso,
                          "cancel_reason": reason, "cancelled_at": now_iso}},
            )
            if r.modified_count:
                transitioned += 1
                try:
                    sdb.service_charge_audit.insert_one({
                        "audit_id": str(uuid.uuid4()),
                        "charge_id": row["charge_id"],
                        "action": "auto_cancelled_on_refund",
                        "old_status": "PENDING", "new_status": "CANCELLED",
                        "user_id": row.get("user_id"), "admin_id": None,
                        "reason": reason, "meta": {"reference": reference},
                        "ts": now_iso,
                    })
                except Exception:
                    pass
        except Exception:
            pass

    # PAID → REFUNDED
    try:
        rows = list(sdb.redemption_service_charges.find(
            {"redemption_id": reference, "status": "PAID"},
            {"charge_id": 1, "user_id": 1},
        ))
    except Exception:
        rows = []
    for row in rows:
        try:
            r = sdb.redemption_service_charges.update_one(
                {"charge_id": row["charge_id"], "status": "PAID"},
                {"$set": {"status": "REFUNDED", "updated_at": now_iso,
                          "refunded_at": now_iso, "reversal_reason": reason}},
            )
            if r.modified_count:
                transitioned += 1
                try:
                    sdb.service_charge_audit.insert_one({
                        "audit_id": str(uuid.uuid4()),
                        "charge_id": row["charge_id"],
                        "action": "auto_refunded_on_service_refund",
                        "old_status": "PAID", "new_status": "REFUNDED",
                        "user_id": row.get("user_id"), "admin_id": None,
                        "reason": reason, "meta": {"reference": reference},
                        "ts": now_iso,
                    })
                except Exception:
                    pass
        except Exception:
            pass

    return transitioned
