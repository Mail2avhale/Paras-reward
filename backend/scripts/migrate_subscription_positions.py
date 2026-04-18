"""
Migration Script: Assign subscription_position to all current active subscribers.
Option B: Preserve current order by sorting by subscription_expiry (ascending).
This ensures existing users' mining rates stay stable initially.
"""
import asyncio
import motor.motor_asyncio
import os
from datetime import datetime, timezone

async def migrate():
    client = motor.motor_asyncio.AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db_name = os.environ.get("DB_NAME", "paras_reward_db")
    db = client[db_name]
    
    now = datetime.now(timezone.utc)
    now_str = now.isoformat()
    
    print("=" * 60)
    print("MIGRATION: Assign subscription_position to active subscribers")
    print("=" * 60)
    
    # Find all users with active subscription (elite/vip/startup/growth/pro + expiry > now)
    active_filter = {
        "subscription_plan": {"$in": ["elite", "vip", "startup", "growth", "pro", "Elite", "VIP", "Startup", "Growth", "Pro"]},
        "$or": [
            {"subscription_expiry": {"$gt": now_str}},
            {"subscription_expiry": {"$gt": now}},
            {"subscription_expires": {"$gt": now_str}},
            {"subscription_expires": {"$gt": now}}
        ]
    }
    
    # Sort by tree_position (existing order) to preserve current hierarchy
    active_users = await db.users.find(
        active_filter,
        {"_id": 0, "uid": 1, "name": 1, "tree_position": 1, "subscription_expiry": 1}
    ).sort("tree_position", 1).to_list(100000)
    
    print(f"Found {len(active_users)} active subscribers")
    
    if not active_users:
        print("No active subscribers found. Nothing to migrate.")
        return
    
    # Assign positions in tree_position order (preserves existing hierarchy)
    position = 0
    for user in active_users:
        position += 1
        uid = user["uid"]
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "subscription_position": position,
                "subscription_position_at": now_str
            }}
        )
        if position % 100 == 0:
            print(f"  Assigned {position} positions...")
    
    # Set the counter for future assignments
    await db.app_settings.update_one(
        {"_id": "subscription_position_counter"},
        {"$set": {"counter": position}},
        upsert=True
    )
    
    print(f"\nMigration complete!")
    print(f"  Total positions assigned: {position}")
    print(f"  Counter set to: {position}")
    print(f"  Next new subscriber will get position: {position + 1}")

if __name__ == "__main__":
    asyncio.run(migrate())
