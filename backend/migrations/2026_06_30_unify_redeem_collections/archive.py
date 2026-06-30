"""archive.py — Rename legacy collections to `_archive_2026_06_30_<name>`
so they remain available for rollback but no new code writes to them.

This step should ONLY be run after `migrate.py --apply` has succeeded and
the writer code (bank_redeem.py, manual_bank_transfer.py, bbps_services.py,
eko_recharge.py) has been switched to write to `redeem_requests` directly.

Dry run by default:   python archive.py
Apply for real:       python archive.py --apply
"""
import os
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from pymongo import MongoClient  # noqa: E402

LEGACY = [
    "bank_transfer_requests",
    "bank_withdrawal_requests",
    "chatbot_withdrawal_requests",
    "recharge_transactions",
    "bill_payment_requests",
    # Also archive the dead collections discovered during audit so they
    # don't accumulate fresh writes accidentally.
    "bank_redeem_requests",
    "rd_redeem_requests",
    "profit_withdrawals",
    "cashback_withdrawals",
    "bill_payments",
    "mobile_recharge_ledger",
    "bank_ledger",
    "bank_book",
    "redeem_payout_ledger",
]

ARCHIVE_PREFIX = "_archive_2026_06_30_"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true", help="Actually rename (default: dry-run)")
    args = p.parse_args()

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    db = client[db_name]

    existing = set(db.list_collection_names())

    for src in LEGACY:
        if src not in existing:
            print(f"   ⊝ {src} — not present, skipping")
            continue
        dst = f"{ARCHIVE_PREFIX}{src}"
        if dst in existing:
            print(f"   ⚠ {dst} already exists — skipping {src}")
            continue
        count = db[src].count_documents({})
        if args.apply:
            db[src].rename(dst)
            print(f"   ✓ Renamed {src} → {dst}  ({count} docs)")
        else:
            print(f"   🔎 Would rename {src} → {dst}  ({count} docs)")

    if args.apply:
        print("\n✅ Archive complete. Rollback by renaming back without the prefix.")
    else:
        print("\n🔎 Dry run. Re-run with --apply to commit.")


if __name__ == "__main__":
    main()
