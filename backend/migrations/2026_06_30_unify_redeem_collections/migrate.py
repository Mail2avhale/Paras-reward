"""migrate.py — Merge 5 legacy collections into canonical `redeem_requests`.

Idempotent: uses `_legacy_request_id` to skip already-migrated rows on re-run.

Dry run by default:   python migrate.py
Apply for real:       python migrate.py --apply
"""
import os
import sys
import argparse
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from pymongo import MongoClient  # noqa: E402

# ---- service_type normalization ----
BANK_TYPES = {"bank_transfer", "bank_withdrawal", "dmt", "emi"}
UTILITY_TYPES = {
    "mobile_recharge", "mobile_prepaid", "mobile_postpaid", "dth",
    "electricity", "gas", "water", "broadband", "landline", "lpg",
}


def status_norm(s: str) -> str:
    """Normalize status to the canonical set used in redeem_requests."""
    if not s:
        return "pending"
    s = str(s).strip().lower()
    return {
        "paid": "COMPLETED",
        "completed": "COMPLETED",
        "success": "COMPLETED",
        "failed": "failed",
        "rejected": "rejected",
        "refunded": "refunded",
        "refund_pending": "refund_pending",
        "retry_failed": "retry_failed",
        "cancelled_by_user": "cancelled",
        "cancelled": "cancelled",
        "pending": "pending",
    }.get(s, s)


def infer_bill_service_type(bill_type, operator_name):
    """Map legacy bill_type/operator_name → canonical service_type."""
    if not bill_type and not operator_name:
        return "electricity"  # most common in our data
    txt = f"{bill_type or ''} {operator_name or ''}".lower()
    if "electric" in txt or "ebill" in txt or "discom" in txt:
        return "electricity"
    if "gas" in txt or "lpg" in txt:
        return "gas"
    if "water" in txt:
        return "water"
    if "broadband" in txt or "internet" in txt:
        return "broadband"
    if "landline" in txt:
        return "landline"
    return (bill_type or "electricity").lower().replace(" ", "_")


# ---- Per-collection mappers ----
def map_bank_transfer(d):
    """bank_transfer_requests → redeem_requests"""
    return {
        "request_id": d.get("request_id") or f"BT-{d['_id']}",
        "user_id": d.get("user_id"),
        "service_type": "bank_transfer",
        "service_name": "Bank Transfer",
        "amount_inr": d.get("amount"),
        "amount": d.get("amount"),
        "total_prc_deducted": d.get("total_prc_deducted"),
        "status": status_norm(d.get("status")),
        "created_at": d.get("created_at"),
    }


def map_bank_withdrawal(d):
    """bank_withdrawal_requests → redeem_requests (richest legacy schema)"""
    bd = d.get("bank_details") or {}
    return {
        "request_id": d.get("request_id") or f"BW-{d['_id']}",
        "user_id": d.get("user_id"),
        "user_mobile": d.get("user_mobile"),
        "user_name": d.get("user_name"),
        "service_type": "bank_withdrawal",
        "service_name": "Bank Withdrawal",
        "amount_inr": d.get("amount_inr") or d.get("total_inr"),
        "amount": d.get("amount_inr") or d.get("total_inr"),
        "total_prc_deducted": d.get("total_prc_deducted"),
        "charges": {
            "admin_charge_inr": d.get("admin_charge_inr"),
            "processing_fee_inr": d.get("processing_fee_inr"),
            "burn_inr": d.get("burn_inr"),
            "burn_rate_percent": d.get("burn_rate_percent"),
        },
        "details": {
            "account_number": bd.get("account_number"),
            "ifsc": bd.get("ifsc"),
            "bank_name": bd.get("bank_name"),
            "holder_name": bd.get("holder_name") or bd.get("name"),
        },
        "status": status_norm(d.get("status")),
        "approved_at": d.get("processed_at"),
        "approved_by": d.get("processed_by"),
        "rejection_reason": d.get("rejection_reason"),
        "created_at": d.get("created_at"),
    }


def map_chatbot_withdrawal(d):
    """chatbot_withdrawal_requests → redeem_requests"""
    return {
        "request_id": d.get("request_id") or f"CW-{d['_id']}",
        "user_id": d.get("uid"),  # `uid` → `user_id`
        "user_mobile": d.get("mobile"),
        "user_name": d.get("user_name"),
        "service_type": "bank_transfer",
        "service_name": "Bank Transfer (Chatbot)",
        "amount_inr": d.get("inr_amount"),
        "amount": d.get("inr_amount"),
        "total_prc_deducted": d.get("prc_deducted"),
        "details": {
            "account_number": d.get("account_number"),
            "ifsc": d.get("ifsc"),
            "bank_name": d.get("bank_name"),
        },
        "status": status_norm(d.get("status")),
        "rejection_reason": d.get("cancellation_reason"),
        "completed_at": d.get("cancelled_at"),
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


def map_recharge_transaction(d):
    """recharge_transactions → redeem_requests (minimal-fields legacy)"""
    return {
        "request_id": d.get("request_id") or f"RT-{d['_id']}",
        "user_id": d.get("user_id"),
        "service_type": "mobile_recharge",  # best-guess; details lost in legacy
        "service_name": "Recharge (legacy)",
        "amount_inr": d.get("amount_inr"),
        "amount": d.get("amount_inr"),
        "status": status_norm(d.get("status")),
        "created_at": d.get("created_at"),
        "_legacy_minimal": True,
    }


def map_bill_payment(d):
    """bill_payment_requests → redeem_requests"""
    stype = infer_bill_service_type(d.get("bill_type"), d.get("operator_name"))
    return {
        "request_id": d.get("request_id") or f"BP-{d['_id']}",
        "user_id": d.get("user_id"),
        "service_type": stype,
        "service_name": (d.get("bill_type") or stype).title() + " Bill",
        "amount_inr": d.get("amount_inr"),
        "amount": d.get("amount_inr"),
        "total_prc_deducted": d.get("prc_used"),
        "eko_tid": d.get("eko_tid"),
        "details": {
            "bill_type": d.get("bill_type"),
            "consumer_number": d.get("consumer_number"),
            "operator_name": d.get("operator_name"),
        },
        "status": status_norm(d.get("status")),
        "status_history": d.get("status_history"),
        "approved_at": d.get("approved_at"),
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


def map_unified_redemption(d):
    """unified_redemptions → redeem_requests (very early-era pilot collection)"""
    stype = d.get("service_type") or "mobile_recharge"
    return {
        "request_id": d.get("request_id") or d.get("redeem_id") or f"UR-{d['_id']}",
        "user_id": d.get("user_id"),
        "service_type": stype,
        "service_name": d.get("service_name") or stype.replace("_", " ").title(),
        "amount_inr": d.get("amount_inr") or d.get("amount") or (
            (d.get("prc_deducted") or 0) / 10 if d.get("prc_deducted") else None
        ),
        "amount": d.get("amount_inr") or d.get("amount"),
        "total_prc_deducted": d.get("prc_deducted") or d.get("total_prc_deducted") or d.get("prc_used"),
        "status": status_norm(d.get("status")),
        "created_at": d.get("created_at"),
    }


MAPPERS = [
    ("bank_transfer_requests", map_bank_transfer),
    ("bank_withdrawal_requests", map_bank_withdrawal),
    ("chatbot_withdrawal_requests", map_chatbot_withdrawal),
    ("recharge_transactions", map_recharge_transaction),
    ("bill_payment_requests", map_bill_payment),
    ("unified_redemptions", map_unified_redemption),
]


def _strip_none(d):
    """Drop keys with `None` values so we don't pollute redeem_requests."""
    if isinstance(d, dict):
        return {k: _strip_none(v) for k, v in d.items() if v is not None}
    if isinstance(d, list):
        return [_strip_none(x) for x in d]
    return d


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true", help="Actually insert (default: dry-run)")
    args = p.parse_args()

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    db = client[db_name]

    # Index legacy_request_id values already present (idempotency)
    already_migrated = {
        d["_legacy_request_id"]
        for d in db.redeem_requests.find({"_legacy_request_id": {"$exists": True}}, {"_legacy_request_id": 1})
    }
    print(f"Already-migrated rows in redeem_requests: {len(already_migrated)}\n")

    now = datetime.now(timezone.utc)
    total_in, total_inserted, total_skipped = 0, 0, 0

    for source, mapper in MAPPERS:
        docs = list(db[source].find({}))
        print(f"-- {source}: {len(docs)} docs --")
        inserted = 0
        skipped = 0
        for d in docs:
            mapped = _strip_none(mapper(d))
            legacy_rid = mapped.get("request_id") or str(d.get("_id"))
            if legacy_rid in already_migrated:
                skipped += 1
                continue
            mapped["_migrated_from"] = source
            mapped["_migration_date"] = now
            mapped["_legacy_id"] = str(d.get("_id"))
            mapped["_legacy_request_id"] = legacy_rid
            mapped.setdefault("created_at", now)
            if args.apply:
                db.redeem_requests.insert_one(mapped)
            inserted += 1
        print(f"   → {inserted} inserted, {skipped} skipped (already migrated)")
        total_in += len(docs)
        total_inserted += inserted
        total_skipped += skipped

    print()
    if args.apply:
        print(f"✅ APPLIED: {total_inserted} new rows merged into redeem_requests "
              f"({total_skipped} idempotent skips, {total_in} legacy total).")
    else:
        print(f"🔎 DRY RUN: would insert {total_inserted} rows "
              f"({total_skipped} already migrated, {total_in} legacy total). "
              f"Re-run with --apply to commit.")

    # Stats
    cat_pipeline = [
        {"$group": {"_id": "$service_type", "n": {"$sum": 1}, "inr": {"$sum": "$amount_inr"}}},
        {"$sort": {"n": -1}},
    ]
    print("\n=== redeem_requests AFTER migration (preview) — service_type breakdown ===")
    for row in db.redeem_requests.aggregate(cat_pipeline):
        category = "bank" if row["_id"] in BANK_TYPES else ("utility" if row["_id"] in UTILITY_TYPES else "other")
        print(f"   {row['_id']:<22} [{category}]  count={row['n']:<4}  ₹{row.get('inr') or 0:,.0f}")


if __name__ == "__main__":
    main()
