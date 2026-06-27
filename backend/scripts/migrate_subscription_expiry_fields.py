"""
migrate_subscription_expiry_fields.py
─────────────────────────────────────────────────────────────────
ONE-SHOT, IDEMPOTENT migration to consolidate 3 legacy expiry
fields (`subscription_expiry` / `subscription_expires` / `vip_expiry`)
into the single canonical `subscription_expiry`.

For each user we:
  1. Read all 3 fields.
  2. Parse each one as a datetime (skip invalid / null).
  3. Pick the LATEST date (most generous — never accidentally
     downgrade an active user).
  4. Write it back to `subscription_expiry`.
  5. UNSET the legacy `subscription_expires` and `vip_expiry`.

Also creates a `subscription_expiry_migration_audit` collection row
per user so we can roll back if needed.

Run:
    cd /app/backend && python -m scripts.migrate_subscription_expiry_fields
"""
import asyncio
import os
from datetime import datetime, timezone
from typing import Optional
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient


def parse_dt(v) -> Optional[datetime]:
    """Always returns a timezone-aware UTC datetime (or None)."""
    if not v:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


async def main():
    env = dotenv_values("/app/backend/.env")
    mongo_url = env.get("MONGO_URL") or os.environ.get("MONGO_URL")
    db_name = env.get("DB_NAME") or os.environ.get("DB_NAME")
    if not (mongo_url and db_name):
        print("ERROR: MONGO_URL / DB_NAME not set"); return

    db = AsyncIOMotorClient(mongo_url)[db_name]

    cursor = db.users.find(
        {
            "$or": [
                {"subscription_expires": {"$exists": True}},
                {"vip_expiry": {"$exists": True}},
            ]
        },
        {"_id": 0, "uid": 1, "subscription_expiry": 1,
         "subscription_expires": 1, "vip_expiry": 1, "subscription_plan": 1},
    )

    touched = 0
    chosen_latest = 0
    cleared_only = 0
    audit_rows = []
    async for u in cursor:
        uid = u.get("uid")
        if not uid:
            continue

        dates = {
            "subscription_expiry": parse_dt(u.get("subscription_expiry")),
            "subscription_expires": parse_dt(u.get("subscription_expires")),
            "vip_expiry": parse_dt(u.get("vip_expiry")),
        }
        valid = {k: v for k, v in dates.items() if v}
        canonical = max(valid.values()) if valid else None

        audit_rows.append({
            "uid": uid,
            "subscription_plan": u.get("subscription_plan"),
            "before": {k: (v.isoformat() if v else None) for k, v in dates.items()},
            "chosen": canonical.isoformat() if canonical else None,
            "migrated_at": datetime.now(timezone.utc).isoformat(),
        })

        set_ops = {}
        unset_ops = {"subscription_expires": "", "vip_expiry": ""}
        if canonical:
            set_ops["subscription_expiry"] = canonical.isoformat()
            chosen_latest += 1
        else:
            cleared_only += 1

        update = {"$unset": unset_ops}
        if set_ops:
            update["$set"] = set_ops
        await db.users.update_one({"uid": uid}, update)
        touched += 1

    if audit_rows:
        await db.subscription_expiry_migration_audit.insert_many(audit_rows)

    print(f"Total users touched: {touched}")
    print(f"  picked latest of multiple dates: {chosen_latest}")
    print(f"  no valid dates anywhere (cleared only): {cleared_only}")
    print(f"  audit rows written: {len(audit_rows)}")


if __name__ == "__main__":
    asyncio.run(main())
