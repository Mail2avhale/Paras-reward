"""
Migration Script: Convert all users to 2-plan system (Explorer + Elite)

This script migrates users from the old multi-plan system to the new 2-plan system:
- Explorer (free)
- Elite (paid)

Mapping:
- explorer, free, '' -> explorer
- startup, growth, elite, vip, pro -> elite (keeps their expiry)
- membership_type='vip' -> elite (copies vip_expiry to subscription_expiry)

Run this script ONCE on production database after deploying the code changes.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os

async def migrate_users_to_two_plans(dry_run=True):
    """
    Migrate all users to the 2-plan system.
    
    Args:
        dry_run: If True, only print what would be done without making changes
    """
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'paras_reward_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 70)
    print("MIGRATION: Converting to 2-Plan System (Explorer + Elite)")
    print("=" * 70)
    print(f"Dry Run: {dry_run}")
    print(f"Database: {db_name}")
    print()
    
    # Stats
    stats = {
        'total_users': 0,
        'already_explorer': 0,
        'already_elite': 0,
        'converted_to_elite': 0,
        'converted_to_explorer': 0,
        'vip_migrated': 0,
        'errors': 0
    }
    
    # Get all users
    cursor = db.users.find({})
    users = await cursor.to_list(length=None)
    stats['total_users'] = len(users)
    
    print(f"Total users to process: {stats['total_users']}")
    print()
    
    for user in users:
        uid = user.get('uid')
        current_plan = user.get('subscription_plan', '').lower()
        membership_type = user.get('membership_type', '').lower()
        vip_expiry = user.get('vip_expiry')
        subscription_expiry = user.get('subscription_expiry')
        
        update_fields = {}
        new_plan = None
        
        # Determine new plan
        if current_plan in ['elite']:
            stats['already_elite'] += 1
            continue  # No change needed
        
        if current_plan in ['explorer', ''] or membership_type == 'free':
            if membership_type == 'vip' or vip_expiry:
                # Legacy VIP user - convert to Elite
                new_plan = 'elite'
                stats['vip_migrated'] += 1
                
                # Copy vip_expiry to subscription_expiry if not set
                if vip_expiry and not subscription_expiry:
                    update_fields['subscription_expiry'] = vip_expiry
            else:
                stats['already_explorer'] += 1
                continue  # Already explorer, no change
        
        if current_plan in ['startup', 'growth', 'vip', 'pro']:
            # Convert to Elite
            new_plan = 'elite'
            stats['converted_to_elite'] += 1
        
        if membership_type == 'vip' and not new_plan:
            # Legacy VIP without subscription_plan
            new_plan = 'elite'
            stats['vip_migrated'] += 1
            
            # Copy vip_expiry to subscription_expiry if not set
            if vip_expiry and not subscription_expiry:
                update_fields['subscription_expiry'] = vip_expiry
        
        if new_plan:
            update_fields['subscription_plan'] = new_plan
            update_fields['migration_date'] = datetime.now(timezone.utc).isoformat()
            update_fields['migrated_from'] = current_plan or membership_type
            
            if not dry_run:
                try:
                    await db.users.update_one(
                        {'uid': uid},
                        {'$set': update_fields}
                    )
                except Exception as e:
                    print(f"  ERROR updating {uid}: {e}")
                    stats['errors'] += 1
            else:
                print(f"  Would update {uid}: {current_plan or membership_type} -> {new_plan}")
    
    # Print summary
    print()
    print("=" * 70)
    print("MIGRATION SUMMARY")
    print("=" * 70)
    print(f"Total users processed: {stats['total_users']}")
    print(f"Already Explorer: {stats['already_explorer']}")
    print(f"Already Elite: {stats['already_elite']}")
    print(f"Converted to Elite (from startup/growth/vip/pro): {stats['converted_to_elite']}")
    print(f"VIP users migrated: {stats['vip_migrated']}")
    print(f"Errors: {stats['errors']}")
    print()
    
    if dry_run:
        print("This was a DRY RUN. No changes were made.")
        print("To apply changes, run with dry_run=False")
    else:
        print("Migration completed!")
    
    return stats


async def verify_migration():
    """Verify the migration was successful"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'paras_reward_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print()
    print("=" * 70)
    print("VERIFICATION: Current User Distribution")
    print("=" * 70)
    
    # Count by subscription_plan
    pipeline = [
        {"$group": {"_id": "$subscription_plan", "count": {"$sum": 1}}}
    ]
    results = await db.users.aggregate(pipeline).to_list(length=100)
    
    print("\nBy subscription_plan:")
    for r in results:
        plan = r["_id"] or "None/Empty"
        print(f"  {plan}: {r['count']} users")
    
    # Count legacy
    vip_count = await db.users.count_documents({"membership_type": "vip"})
    print(f"\nLegacy membership_type='vip': {vip_count} users")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--apply":
        print("Running ACTUAL migration (not dry run)...")
        asyncio.run(migrate_users_to_two_plans(dry_run=False))
    else:
        print("Running DRY RUN (no changes will be made)...")
        print("To apply changes, run: python migrate_to_two_plans.py --apply")
        print()
        asyncio.run(migrate_users_to_two_plans(dry_run=True))
    
    asyncio.run(verify_migration())
