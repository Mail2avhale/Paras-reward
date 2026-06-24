#!/usr/bin/env python3
"""
cleanup_bank_redeem_quota.py
─────────────────────────────────────────────────────────────────────────────
One-time migration script for the Feb 2026 Bank-Redeem Lifetime Cap rollout.

For every user whose SUM(approved/paid/completed bank redeems) is already
≥ ₹2,500 (the new lifetime cap):

  1. Cancel all their PENDING bank_transfer_requests
  2. Refund the locked PRC back to the user's balance with a ledger entry
  3. Set users.bank_redeem_blocked = True so the runtime check disables the
     feature for them going forward
  4. Append an audit_log row

Usage
─────
  python3 backend/migrations/cleanup_bank_redeem_quota.py --dry-run   # safe preview
  python3 backend/migrations/cleanup_bank_redeem_quota.py --apply     # writes

The script is idempotent — re-running --apply is a no-op for users already
processed.
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Allow `from routes....` style imports if run from anywhere
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
LIFETIME_CAP = 2500
QUOTA_STATUSES = ["approved", "paid", "completed"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def main(dry_run: bool):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"\n{'='*72}")
    print(f"Bank-Redeem Lifetime Cap Cleanup  ({'DRY RUN' if dry_run else 'APPLY'})")
    print(f"Cap: ₹{LIFETIME_CAP:,}  •  Quota statuses: {QUOTA_STATUSES}")
    print(f"{'='*72}\n")

    # Step 1 — find candidates via aggregation
    pipeline = [
        {"$match": {"status": {"$in": QUOTA_STATUSES}}},
        {"$group": {
            "_id": "$user_id",
            "lifetime_redeemed": {"$sum": "$withdrawal_amount"},
            "redeem_count": {"$sum": 1},
        }},
        {"$match": {"lifetime_redeemed": {"$gte": LIFETIME_CAP}}},
        {"$sort": {"lifetime_redeemed": -1}},
    ]
    candidates = await db.bank_transfer_requests.aggregate(pipeline).to_list(50000)
    print(f"Step 1 → {len(candidates)} users have already redeemed ≥ ₹{LIFETIME_CAP:,}\n")

    total_pending_cancelled = 0
    total_prc_refunded = 0.0
    total_users_blocked = 0
    total_users_already_blocked = 0

    for idx, c in enumerate(candidates, 1):
        uid = c["_id"]
        lifetime = c["lifetime_redeemed"]
        count = c["redeem_count"]

        user = await db.users.find_one(
            {"uid": uid},
            {"_id": 0, "uid": 1, "mobile": 1, "name": 1,
             "bank_redeem_blocked": 1, "prc_balance": 1}
        )
        if not user:
            print(f"  [{idx:4d}] ⚠️  user_id={uid[:12]}…  NOT FOUND in users")
            continue

        already_blocked = bool(user.get("bank_redeem_blocked"))

        # Find this user's pending bank_transfer_requests
        pending = await db.bank_transfer_requests.find(
            {"user_id": uid, "status": "pending"},
            {"_id": 0, "request_id": 1, "withdrawal_amount": 1, "total_prc": 1},
        ).to_list(500)
        pending_prc_total = sum(float(p.get("total_prc", 0) or 0) for p in pending)

        label = "⏭️  already_blocked" if already_blocked else "🔒 BLOCKING"
        print(
            f"  [{idx:4d}] {label:18s} uid={uid[:12]}…  "
            f"name={(user.get('name') or '-')[:20]:20s}  "
            f"lifetime=₹{lifetime:,}  pending={len(pending)}  "
            f"prc_to_refund={pending_prc_total:,.2f}"
        )

        if dry_run:
            if not already_blocked:
                total_users_blocked += 1
                total_pending_cancelled += len(pending)
                total_prc_refunded += pending_prc_total
            else:
                total_users_already_blocked += 1
            continue

        if already_blocked:
            total_users_already_blocked += 1
            continue

        # APPLY MODE — actual writes
        # (a) Cancel pending requests + refund their PRC
        for p in pending:
            req_id = p["request_id"]
            prc_amt = float(p.get("total_prc", 0) or 0)
            await db.bank_transfer_requests.update_one(
                {"request_id": req_id},
                {"$set": {
                    "status": "cancelled",
                    "cancelled_at": now_iso(),
                    "cancel_reason": "Lifetime cap ₹2,500 reached — auto-cancelled by migration",
                }},
            )
            if prc_amt > 0:
                await db.users.update_one(
                    {"uid": uid},
                    {"$inc": {"prc_balance": prc_amt}},
                )
                await db.prc_ledger.insert_one({
                    "uid": uid,
                    "type": "bank_redeem_refund_migration",
                    "amount": prc_amt,
                    "category": "lifetime_cap_cleanup",
                    "description": f"Refund of pending bank-redeem #{req_id[:8]} (₹2,500 cap reached)",
                    "created_at": now_iso(),
                    "metadata": {"request_id": req_id, "migration": "cleanup_bank_redeem_quota"},
                })
                total_prc_refunded += prc_amt
            total_pending_cancelled += 1

        # (b) Block the user
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "bank_redeem_blocked": True,
                "bank_redeem_blocked_at": now_iso(),
                "bank_redeem_blocked_by": "system_migration",
                "bank_redeem_blocked_reason": (
                    f"Lifetime bank-redeem cap of ₹{LIFETIME_CAP:,} reached "
                    f"(redeemed ₹{lifetime:,} across {count} requests). "
                    "Contact support if you have queries."
                ),
            }},
        )
        await db.audit_log.insert_one({
            "type": "bank_redeem_block_migration",
            "user_id": uid,
            "admin_id": "system_migration",
            "reason": f"Lifetime ₹{lifetime:,} ≥ cap ₹{LIFETIME_CAP:,}",
            "lifetime_redeemed": lifetime,
            "pending_cancelled": len(pending),
            "prc_refunded": pending_prc_total,
            "created_at": now_iso(),
        })
        total_users_blocked += 1

    print(f"\n{'-'*72}")
    print(f"SUMMARY ({'DRY RUN preview' if dry_run else 'APPLIED'})")
    print(f"  Users newly blocked         : {total_users_blocked}")
    print(f"  Users already blocked       : {total_users_already_blocked}")
    print(f"  Pending requests cancelled  : {total_pending_cancelled}")
    print(f"  PRC refunded to balances    : {total_prc_refunded:,.2f}")
    print(f"{'='*72}\n")

    if dry_run:
        print("Dry run complete. Re-run with --apply to actually write.\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Preview only, no writes.")
    group.add_argument("--apply", action="store_true", help="Apply changes (writes to DB).")
    args = ap.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
