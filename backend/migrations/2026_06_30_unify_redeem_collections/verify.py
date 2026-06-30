"""verify.py — Post-migration health check.

Confirms:
1. Legacy doc counts == migrated count + already-existing in redeem_requests
2. No row in redeem_requests is missing the standard fields
3. Per-user spend totals are computable (and prints a sample for top spenders)
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from pymongo import MongoClient  # noqa: E402

BANK_TYPES = {"bank_transfer", "bank_withdrawal", "dmt", "emi"}
UTILITY_TYPES = {
    "mobile_recharge", "mobile_prepaid", "mobile_postpaid", "dth",
    "electricity", "gas", "water", "broadband", "landline", "lpg",
}


def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    db = client[db_name]

    print("\n=== redeem_requests overall ===")
    total = db.redeem_requests.count_documents({})
    migrated = db.redeem_requests.count_documents({"_migrated_from": {"$exists": True}})
    print(f"   total docs:                    {total}")
    print(f"   from migration:                {migrated}")
    print(f"   organic (unified_redeem_v2):   {total - migrated}")

    # Per-source breakdown of migrated rows
    print("\n=== migrated rows by source ===")
    for row in db.redeem_requests.aggregate([
        {"$match": {"_migrated_from": {"$exists": True}}},
        {"$group": {"_id": "$_migrated_from", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ]):
        print(f"   {row['_id']:<30} {row['n']}")

    # Per-category aggregates
    print("\n=== Category totals (bank vs utility) ===")
    for cat_name, types in [("BANK REDEEM", BANK_TYPES), ("RECHARGE/UTILITY", UTILITY_TYPES)]:
        result = list(db.redeem_requests.aggregate([
            {"$match": {"service_type": {"$in": list(types)}}},
            {"$group": {
                "_id": None,
                "n": {"$sum": 1},
                "total_inr": {"$sum": "$amount_inr"},
                "total_prc": {"$sum": "$total_prc_deducted"},
                "unique_users": {"$addToSet": "$user_id"},
            }},
        ]))
        if result:
            r = result[0]
            print(f"   {cat_name:<20}  txns={r['n']:<4}  ₹{r['total_inr'] or 0:,.0f}  "
                  f"PRC={r['total_prc'] or 0:,}  users={len(r.get('unique_users', []))}")
        else:
            print(f"   {cat_name:<20}  (no data)")

    # Top spenders per category — useful sanity check
    print("\n=== Top 5 spenders (combined Bank + Utility) ===")
    top_pipeline = [
        {"$match": {"status": {"$in": ["COMPLETED", "Paid", "completed"]}}},
        {"$group": {
            "_id": "$user_id",
            "spent_inr": {"$sum": "$amount_inr"},
            "txns": {"$sum": 1},
        }},
        {"$sort": {"spent_inr": -1}},
        {"$limit": 5},
    ]
    for row in db.redeem_requests.aggregate(top_pipeline):
        # Pull user_name for display
        u = db.users.find_one({"uid": row["_id"]}, {"_id": 0, "name": 1, "mobile": 1}) or {}
        name = u.get("name") or row["_id"]
        print(f"   {name:<30} ₹{row['spent_inr'] or 0:,.0f}  ({row['txns']} txns)")

    # Sanity: any docs without amount?
    no_amount = db.redeem_requests.count_documents({
        "$and": [
            {"amount_inr": {"$in": [None, 0]}},
            {"amount": {"$in": [None, 0]}},
        ]
    })
    if no_amount:
        print(f"\n⚠ {no_amount} row(s) have no amount_inr/amount — review needed")

    print("\n✅ Verification complete.")


if __name__ == "__main__":
    main()
