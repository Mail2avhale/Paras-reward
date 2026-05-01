"""
One-time remediation script: find users who were double-charged for Elite
subscription within the 7-day cooldown window, and refund the extra PRC.

Detection criteria:
  - subscription_payments with payment_method='prc', status in ['paid','upcoming','active']
  - For each user, find ANY two payments whose created_at differ by < 7 days
  - First payment is considered legit; the second (and any extras) are refund targets

This script is DRY-RUN by default. Run with `--apply` to actually refund.

Usage:
    python -m scripts.audit_prc_sub_double_charge                  # dry-run
    python -m scripts.audit_prc_sub_double_charge --apply          # perform refunds
    python -m scripts.audit_prc_sub_double_charge --user <uid>     # target one user
"""
import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv


async def main(apply: bool = False, target_uid: str | None = None):
    load_dotenv("/app/backend/.env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    query = {
        "payment_method": "prc",
        "status": {"$in": ["paid", "upcoming", "active", "completed"]},
    }
    if target_uid:
        query["user_id"] = target_uid

    subs = (
        await db.subscription_payments.find(query, {"_id": 0})
        .sort("created_at", 1)
        .to_list(10_000)
    )

    by_user: dict[str, list[dict]] = defaultdict(list)
    for s in subs:
        by_user[s.get("user_id")].append(s)

    findings: list[dict] = []
    for uid, plist in by_user.items():
        plist.sort(key=lambda p: p.get("created_at") or "")
        for i in range(1, len(plist)):
            prev = plist[i - 1]
            curr = plist[i]
            try:
                t_prev = datetime.fromisoformat(prev["created_at"].replace("Z", "+00:00"))
                t_curr = datetime.fromisoformat(curr["created_at"].replace("Z", "+00:00"))
            except Exception:
                continue
            delta = t_curr - t_prev
            if delta < timedelta(days=7):
                # Double-charge within cooldown window
                findings.append(
                    {
                        "user_id": uid,
                        "first_payment_id": prev.get("payment_id"),
                        "first_created": prev.get("created_at"),
                        "extra_payment_id": curr.get("payment_id"),
                        "extra_created": curr.get("created_at"),
                        "delta_hours": round(delta.total_seconds() / 3600, 2),
                        "prc_amount": curr.get("prc_amount", 0),
                        "plan": curr.get("plan_name") or curr.get("plan_type"),
                    }
                )

    print(f"\n=== Double-charge findings: {len(findings)} ===\n")
    for f in findings:
        print(
            f"  uid={f['user_id']} delta={f['delta_hours']}h "
            f"first={f['first_payment_id']} extra={f['extra_payment_id']} "
            f"prc={f['prc_amount']} plan={f['plan']} extra_created={f['extra_created']}"
        )

    if not findings:
        print("No double-charges detected.")
        client.close()
        return

    if not apply:
        print("\n(DRY-RUN — pass --apply to refund. Total users affected: "
              f"{len(set(f['user_id'] for f in findings))}, "
              f"Total PRC to refund: {sum(f['prc_amount'] for f in findings):,.2f})")
        client.close()
        return

    # Apply refunds — IDEMPOTENT ORDER (mark FIRST, then refund balance).
    # Why this order matters: if the script crashes mid-way, re-running must
    # NOT re-refund. Marking the subscription as `status=refunded` first
    # makes the next dry-run skip it (because we filter on
    # status in [paid, upcoming, active, completed] — refunded is excluded).
    # Only after the mark succeeds do we credit the balance.
    refunded = 0
    for f in findings:
        uid = f["user_id"]
        amount = float(f["prc_amount"] or 0)
        extra_pid = f["extra_payment_id"] or f"legacy-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        if amount <= 0:
            continue

        # 1. ATOMIC mark-as-refunded (CAS): only succeeds if status was NOT
        # already 'refunded'. This is the idempotency gate — duplicate runs
        # of this script will see modified_count == 0 and skip the user.
        if f["extra_payment_id"]:
            mark_filter = {
                "payment_id": f["extra_payment_id"],
                "status": {"$ne": "refunded"},
            }
        else:
            # Legacy doc with no payment_id → match on user_id + created_at
            mark_filter = {
                "user_id": uid,
                "created_at": f["extra_created"],
                "status": {"$ne": "refunded"},
            }
        mark_res = await db.subscription_payments.update_one(
            mark_filter,
            {
                "$set": {
                    "status": "refunded",
                    "refunded_at": datetime.now(timezone.utc).isoformat(),
                    "refund_reason": "cooldown_race_auto_remediation",
                    "refund_amount_prc": amount,
                }
            },
        )
        if mark_res.modified_count == 0:
            # Already refunded in a prior run — skip silently.
            print(f"  SKIP: uid={uid} already refunded (idempotent)")
            continue

        # 2. Now safe to refund balance — exactly once per finding.
        upd = await db.users.update_one(
            {"uid": uid}, {"$inc": {"prc_balance": amount}}
        )
        if upd.modified_count != 1:
            # Ultra-rare: user was deleted between step 1 and step 2.
            # Roll back the mark so a future run can retry.
            await db.subscription_payments.update_one(
                mark_filter | {"status": "refunded"},
                {"$set": {"status": "paid"}, "$unset": {"refunded_at": "", "refund_reason": "", "refund_amount_prc": ""}},
            )
            print(f"  WARN: refund failed for {uid} (user missing) — mark rolled back")
            continue

        # 3. Log refund txn for user-facing PRC statement visibility.
        await db.transactions.insert_one(
            {
                "user_id": uid,
                "transaction_id": f"REFUND-PRC-SUB-{extra_pid[:24]}",
                "type": "subscription_refund",
                "amount": amount,
                "description": (
                    f"Refund — Duplicate Elite Subscription charged within "
                    f"cooldown window (original {extra_pid[:8]})"
                ),
                "reference_id": extra_pid,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "completed",
            }
        )
        refunded += 1
        print(f"  REFUNDED: uid={uid} +{amount:,.2f} PRC (sub {extra_pid[:8]})")

    print(f"\nTotal refunds applied: {refunded}")
    client.close()


if __name__ == "__main__":
    apply_flag = "--apply" in sys.argv
    target = None
    if "--user" in sys.argv:
        idx = sys.argv.index("--user")
        target = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None
    asyncio.run(main(apply=apply_flag, target_uid=target))
