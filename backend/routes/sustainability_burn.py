"""
Sustainability Auto-Burn (1% post-transaction)
================================================
After a user's PRC service transaction succeeds (Mobile Recharge, DTH,
Bank Redeem, PRC Subscription), 1% of their POST-TRANSACTION available
PRC balance is automatically burned to maintain platform sustainability.

Rules (per user spec, Feb 2026):
  • Burn = 1% × (balance AFTER service deduction)
  • Threshold: only if post-deduction balance > 30,000 PRC
  • Permanently destroyed (no wallet credit; PRC supply ↓)
  • Refund of source service → also reverses the burn
  • Statement label: "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY"

Idempotency: each burn is keyed by `(service_ref_id, service_type)` so
re-firing the same hook never double-burns.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

# db reference is injected by server.py at startup
db = None
BURN_THRESHOLD_PRC = 30000.0
BURN_RATE = 0.01  # 1%
SERVICE_LABELS = {
    "mobile_recharge": "Mobile Recharge",
    "dth_recharge": "DTH Recharge",
    "bank_redeem": "Bank Redeem",
    "subscription_prc": "PRC Subscription",
    "paras_mall": "Paras Mall",
}


def set_db(database):
    global db
    db = database


async def apply_sustainability_burn(
    user_id: str,
    service_type: str,
    service_ref_id: str,
    amount_inr: Optional[float] = None,
) -> dict:
    """
    Burn 1% of user's CURRENT PRC balance if balance > 30,000.

    Idempotent: skips if a burn entry for this `(service_type, service_ref_id)`
    already exists in `prc_ledger`.

    Returns dict with `burned`, `amount`, `new_balance`, `reason`.
    """
    if db is None:
        return {"burned": False, "reason": "db_not_initialized"}
    if not user_id or not service_ref_id:
        return {"burned": False, "reason": "missing_args"}

    # Idempotency check — never double-burn the same source event
    existing = await db.prc_ledger.find_one(
        {
            "user_id": user_id,
            "type": "auto_burn",
            "service_ref_id": service_ref_id,
            "service_type": service_type,
        },
        {"_id": 0, "amount": 1, "reversed": 1},
    )
    if existing:
        return {
            "burned": False,
            "reason": "already_applied",
            "previous_amount": abs(float(existing.get("amount") or 0)),
        }

    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1})
    if not user:
        return {"burned": False, "reason": "user_not_found"}

    balance = float(user.get("prc_balance", 0) or 0)
    if balance <= BURN_THRESHOLD_PRC:
        return {
            "burned": False,
            "reason": "below_threshold",
            "balance": round(balance, 2),
            "threshold": BURN_THRESHOLD_PRC,
        }

    burn_amt = round(balance * BURN_RATE, 2)
    if burn_amt <= 0:
        return {"burned": False, "reason": "zero_amount"}

    now_iso = datetime.now(timezone.utc).isoformat()
    burn_ref = f"BURN-{service_type.upper()[:3]}-{uuid.uuid4().hex[:10].upper()}"
    description = "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY"
    service_label = SERVICE_LABELS.get(service_type, service_type.replace("_", " ").title())

    # 1. Deduct from user balance (atomic)
    upd = await db.users.update_one(
        {"uid": user_id, "prc_balance": {"$gte": burn_amt}},
        {"$inc": {"prc_balance": -burn_amt}},
    )
    if upd.modified_count == 0:
        return {"burned": False, "reason": "balance_changed_concurrent"}

    new_balance = round(balance - burn_amt, 2)

    # 2. Record in prc_ledger (modern unified ledger) — visible in PRC Statement
    try:
        await db.prc_ledger.insert_one({
            "user_id": user_id,
            "type": "auto_burn",
            "entry_type": "debit",
            "amount": -burn_amt,
            "balance_before": round(balance, 2),
            "balance_after": new_balance,
            "reference": burn_ref,
            "service_type": service_type,
            "service_ref_id": service_ref_id,
            "service_label": service_label,
            "service_amount_inr": amount_inr,
            "description": description,
            "auto": True,
            "reversed": False,
            "created_at": now_iso,
        })
    except Exception as e:
        logging.error(f"[SUSTAIN-BURN] prc_ledger insert failed: {e}")

    # 3. Record in legacy `transactions` for backward-compat reports
    try:
        await db.transactions.insert_one({
            "transaction_id": burn_ref,
            "user_id": user_id,
            "type": "prc_burn",
            "amount": -burn_amt,
            "balance_before": round(balance, 2),
            "balance_after": new_balance,
            "description": f"{description} ({service_label})",
            "reference_id": service_ref_id,
            "service_type": service_type,
            "auto_burn": True,
            "created_at": now_iso,
            "timestamp": now_iso,
        })
    except Exception as e:
        logging.warning(f"[SUSTAIN-BURN] transactions insert failed (non-fatal): {e}")

    logging.info(
        f"[SUSTAIN-BURN] user={user_id} service={service_type} "
        f"ref={service_ref_id} burned={burn_amt} balance:{balance:.2f}->{new_balance:.2f}"
    )
    return {
        "burned": True,
        "amount": burn_amt,
        "new_balance": new_balance,
        "burn_ref": burn_ref,
        "service_label": service_label,
    }


async def reverse_sustainability_burn(
    user_id: str,
    service_type: str,
    service_ref_id: str,
) -> dict:
    """
    Reverse a previously applied auto-burn (when source service is refunded).
    Adds the burned amount back to the user's prc_balance and marks the
    ledger entry as reversed.
    """
    if db is None:
        return {"reversed": False, "reason": "db_not_initialized"}
    if not user_id or not service_ref_id:
        return {"reversed": False, "reason": "missing_args"}

    burn = await db.prc_ledger.find_one({
        "user_id": user_id,
        "type": "auto_burn",
        "service_ref_id": service_ref_id,
        "service_type": service_type,
        "reversed": {"$ne": True},
    })
    if not burn:
        return {"reversed": False, "reason": "no_burn_found"}

    amt = abs(float(burn.get("amount") or 0))
    if amt <= 0:
        return {"reversed": False, "reason": "zero_amount"}

    now_iso = datetime.now(timezone.utc).isoformat()
    rev_ref = f"BURNREV-{burn.get('reference', uuid.uuid4().hex[:10].upper())}"

    # 1. Refund balance
    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1})
    if not user:
        return {"reversed": False, "reason": "user_not_found"}
    bal_before = float(user.get("prc_balance", 0) or 0)
    await db.users.update_one(
        {"uid": user_id}, {"$inc": {"prc_balance": amt}}
    )
    bal_after = round(bal_before + amt, 2)

    # 2. Mark original burn as reversed
    await db.prc_ledger.update_one(
        {"_id": burn["_id"]},
        {"$set": {"reversed": True, "reversed_at": now_iso, "reversal_ref": rev_ref}},
    )

    # 3. Record reversal entry (credit) in prc_ledger
    service_label = burn.get("service_label") or SERVICE_LABELS.get(service_type, service_type)
    try:
        await db.prc_ledger.insert_one({
            "user_id": user_id,
            "type": "auto_burn_reversal",
            "entry_type": "credit",
            "amount": amt,
            "balance_before": round(bal_before, 2),
            "balance_after": bal_after,
            "reference": rev_ref,
            "service_type": service_type,
            "service_ref_id": service_ref_id,
            "service_label": service_label,
            "description": f"Reversal of sustainability burn ({service_label} refund)",
            "auto": True,
            "created_at": now_iso,
        })
    except Exception as e:
        logging.error(f"[SUSTAIN-BURN] reversal ledger insert failed: {e}")

    # 4. Record in legacy `transactions`
    try:
        await db.transactions.insert_one({
            "transaction_id": rev_ref,
            "user_id": user_id,
            "type": "prc_burn_reversal",
            "amount": amt,
            "balance_before": round(bal_before, 2),
            "balance_after": bal_after,
            "description": f"Reversal of sustainability burn ({service_label})",
            "reference_id": service_ref_id,
            "service_type": service_type,
            "created_at": now_iso,
            "timestamp": now_iso,
        })
    except Exception as e:
        logging.warning(f"[SUSTAIN-BURN] reversal txns insert failed (non-fatal): {e}")

    logging.info(
        f"[SUSTAIN-BURN-REV] user={user_id} service={service_type} "
        f"ref={service_ref_id} restored={amt} balance:{bal_before:.2f}->{bal_after:.2f}"
    )
    return {
        "reversed": True,
        "amount": amt,
        "new_balance": bal_after,
        "rev_ref": rev_ref,
    }
