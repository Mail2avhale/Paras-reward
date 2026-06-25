"""
backfill_ad_reward_ledger.py
─────────────────────────────────────────────────────────────────
One-shot migration script.

Run AFTER deploying the ads_rewarded.py canonical-ledger fix to clean
up historical "ad_reward" rows that were written with the wrong schema
(`uid` instead of `user_id`, missing `entry_type`, etc.) so they show
up properly on the user's PRC Statement page.

Idempotent — safe to run multiple times; only touches rows that still
have `uid` and no `user_id`.

Usage:
    cd /app/backend
    python -m scripts.backfill_ad_reward_ledger
"""
import asyncio
import os
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient


PLACEMENT_LABEL = {
    "main_mining_collect": "Main Mining",
    "mall_collect": "Paras Mall",
    "other": "Rewarded Ad",
}


async def main():
    env = dotenv_values("/app/backend/.env")
    mongo_url = env.get("MONGO_URL") or os.environ.get("MONGO_URL")
    db_name = env.get("DB_NAME") or os.environ.get("DB_NAME")
    if not (mongo_url and db_name):
        print("ERROR: MONGO_URL / DB_NAME not set")
        return

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    cursor = db.prc_ledger.find({
        "type": "ad_reward",
        "uid": {"$exists": True},
        "user_id": {"$exists": False},
    })
    broken = await cursor.to_list(100000)
    print(f"Found {len(broken)} broken ad_reward entries")

    fixed = 0
    for e in broken:
        uid = e.get("uid")
        amount = int(e.get("amount", 0) or 0)
        placement = (e.get("metadata") or {}).get("placement", "other")
        plabel = PLACEMENT_LABEL.get(placement, "Rewarded Ad")
        await db.prc_ledger.update_one(
            {"_id": e["_id"]},
            {
                "$set": {
                    "user_id": uid,
                    "entry_type": "credit",
                    "service_type": "rewarded_ad",
                    "service_label": plabel,
                    "description": f"Ad Bonus PRC ({plabel}) — +{amount} PRC",
                    "timestamp": e.get("created_at"),
                },
                "$unset": {"uid": "", "category": ""},
            },
        )
        fixed += 1

    print(f"Backfilled {fixed} entries.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
