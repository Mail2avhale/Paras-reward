"""
Backfill missing `user_uid` on notifications collection.

Problem
-------
`routes/notifications.py::create_notification()` historically wrote only
`user_id`, but the user-facing reader at
`routes/notifications_routes.py::GET /notifications/{uid}` queries
`{user_uid: uid}`.  Result: most user notifications never surfaced in the
notification page (~79% on preview as of Feb 2026).

What this script does
---------------------
1. For every doc where `user_uid` is missing but `user_id` is present
   → copy `user_id` into `user_uid`.
2. For every doc where `user_id` is missing but `user_uid` is present
   → copy `user_uid` into `user_id`.
3. Mirror `read`/`is_read` flags if only one exists.

Safe to re-run.  Idempotent.

Usage
-----
    cd /app/backend && python -m scripts.backfill_notification_user_uid
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    before_total = await db.notifications.count_documents({})
    before_unreachable = await db.notifications.count_documents({
        "user_id": {"$exists": True},
        "user_uid": {"$exists": False},
    })
    print(f"[backfill] total={before_total}  missing-user_uid={before_unreachable}")

    # Stage 1: copy user_id -> user_uid
    cursor = db.notifications.find(
        {"user_id": {"$exists": True}, "user_uid": {"$exists": False}},
        {"_id": 1, "user_id": 1},
    )
    count = 0
    async for doc in cursor:
        await db.notifications.update_one(
            {"_id": doc["_id"]},
            {"$set": {"user_uid": doc["user_id"]}},
        )
        count += 1
    print(f"[backfill] stage1 copied user_id -> user_uid: {count} docs")

    # Stage 2: copy user_uid -> user_id (reverse direction)
    cursor = db.notifications.find(
        {"user_uid": {"$exists": True}, "user_id": {"$exists": False}},
        {"_id": 1, "user_uid": 1},
    )
    count2 = 0
    async for doc in cursor:
        await db.notifications.update_one(
            {"_id": doc["_id"]},
            {"$set": {"user_id": doc["user_uid"]}},
        )
        count2 += 1
    print(f"[backfill] stage2 copied user_uid -> user_id: {count2} docs")

    # Stage 3: mirror read flags
    read_only = await db.notifications.update_many(
        {"read": {"$exists": True}, "is_read": {"$exists": False}},
        [{"$set": {"is_read": "$read"}}],  # aggregation-style update for Mongo >=4.2
    )
    isread_only = await db.notifications.update_many(
        {"is_read": {"$exists": True}, "read": {"$exists": False}},
        [{"$set": {"read": "$is_read"}}],
    )
    print(f"[backfill] stage3 mirrored read flags: read->is_read={read_only.modified_count} is_read->read={isread_only.modified_count}")

    # Stage 4: normalize `created_at` to ISO string.
    # MongoDB sorts each BSON type independently (BSON sort spec): all BSON-date
    # docs come before BSON-string docs regardless of the actual instant. If
    # writers mix `datetime.now(...)` and `.isoformat()`, sort("created_at", -1)
    # returns nondeterministic chronology. Convert every date-typed
    # `created_at` to ISO string so the canonical writer format wins.
    from datetime import timezone as _tz
    cursor = db.notifications.find(
        {"created_at": {"$type": "date"}},
        {"_id": 1, "created_at": 1},
    )
    s4 = 0
    async for d in cursor:
        ts = d["created_at"]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=_tz.utc)
        await db.notifications.update_one(
            {"_id": d["_id"]},
            {"$set": {"created_at": ts.isoformat()}},
        )
        s4 += 1
    print(f"[backfill] stage4 normalized BSON-date -> ISO string: {s4} docs")

    after_unreachable = await db.notifications.count_documents({
        "user_id": {"$exists": True},
        "user_uid": {"$exists": False},
    })
    print(f"[backfill] done. remaining-unreachable={after_unreachable}")


if __name__ == "__main__":
    asyncio.run(main())
