"""
DRY-RUN: Identify all "Over Limit" pending bank redeem requests.

Definition of Over Limit (matches admin UI badge):
    total_limit (redeemable based on network %) < total_redeemed
    i.e. user has already redeemed more than their cumulative cap.

Usage:
    cd /app/backend && python -m scripts.bulk_fail_overlimit_dryrun
"""
import asyncio
import os
import sys
from pathlib import Path

# Make backend root importable
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(BACKEND / ".env")


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Wire helpers from server.py (lazy import so we use the SAME logic)
    import server  # noqa: E402

    server.db = db
    # Ensure helpers see the live DB
    from routes import manual_bank_transfer
    manual_bank_transfer.db = db

    pending = await db.bank_transfer_requests.find(
        {"status": "pending"}, {"_id": 0}
    ).to_list(2000)

    print(f"Total pending requests: {len(pending)}\n")

    over_limit = []
    within_limit = []
    errors = []

    for idx, req in enumerate(pending, 1):
        uid = req.get("user_id")
        rid = req.get("request_id")
        amount = req.get("withdrawal_amount", 0)
        prc = req.get("prc_deducted", 0)
        try:
            info = await server.calculate_user_redeem_limit(uid)
            total_limit = info.get("total_limit", 0)
            total_redeemed = info.get("total_redeemed", 0)
            raw = round(total_limit - total_redeemed, 2)
            row = {
                "request_id": rid,
                "user_id": uid,
                "user_name": req.get("user_name", ""),
                "user_phone": req.get("user_phone", ""),
                "amount_inr": amount,
                "prc_deducted": prc,
                "total_limit": round(total_limit, 2),
                "total_redeemed": round(total_redeemed, 2),
                "raw_diff": raw,
                "network_size": info.get("network_size", 0),
                "unlock_percent": info.get("unlock_percent", 0),
            }
            if raw < 0:
                over_limit.append(row)
            else:
                within_limit.append(row)
        except Exception as e:
            errors.append({"request_id": rid, "user_id": uid, "error": str(e)})

        if idx % 25 == 0:
            print(f"  ...processed {idx}/{len(pending)}")

    print("\n" + "=" * 80)
    print(f"OVER LIMIT pending: {len(over_limit)}")
    print(f"Within limit pending: {len(within_limit)}")
    print(f"Errors: {len(errors)}")
    print("=" * 80)

    total_prc_to_refund = sum(r["prc_deducted"] for r in over_limit)
    total_inr_failed = sum(r["amount_inr"] for r in over_limit)
    print(f"\nIf executed: refund {total_prc_to_refund:,.2f} PRC across "
          f"{len(over_limit)} requests (₹{total_inr_failed:,} INR worth)")

    print("\n--- OVER LIMIT requests (top 30) ---")
    print(f"{'request_id':<28} {'user':<22} {'amt':>7} {'prc':>10} "
          f"{'limit':>10} {'used':>10} {'raw':>9} {'net':>4}")
    for r in over_limit[:30]:
        print(
            f"{r['request_id']:<28} "
            f"{(r['user_name'] or r['user_phone'] or r['user_id'])[:22]:<22} "
            f"{int(r['amount_inr']):>7} "
            f"{r['prc_deducted']:>10,.0f} "
            f"{r['total_limit']:>10,.0f} "
            f"{r['total_redeemed']:>10,.0f} "
            f"{r['raw_diff']:>9,.0f} "
            f"{r['network_size']:>4}"
        )

    if errors:
        print("\n--- ERRORS ---")
        for e in errors[:10]:
            print(f"  {e['request_id']} {e['user_id']}: {e['error']}")

    # Persist for next step (execute)
    import json
    out = BACKEND / "scripts" / "_overlimit_pending.json"
    with open(out, "w") as f:
        json.dump(
            {
                "over_limit": over_limit,
                "within_limit_count": len(within_limit),
                "errors": errors,
                "total_prc_to_refund": total_prc_to_refund,
                "total_inr": total_inr_failed,
            },
            f,
            indent=2,
            default=str,
        )
    print(f"\nSaved over-limit list to: {out}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
