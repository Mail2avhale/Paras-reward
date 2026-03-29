"""
Single Leg Tree Migration Script
=================================
Assigns tree_position and network_parent to ALL existing users
based on their created_at (joining date/time).

Single Leg Chain:
  User1 (earliest) → User2 → User3 → ... → UserN (latest)
  
  tree_position: 1, 2, 3, ..., N
  network_parent: None, User1.uid, User2.uid, ..., User(N-1).uid

Usage:
  python3 migrate_single_leg.py          # Dry run (preview only)
  python3 migrate_single_leg.py --apply  # Actually apply changes
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone

# Load env
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    load_dotenv(env_file)

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'paras_reward_db')

def run_migration(apply=False):
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get all users sorted by created_at ascending
    users = list(db.users.find(
        {},
        {"_id": 0, "uid": 1, "name": 1, "created_at": 1, "referred_by": 1}
    ).sort("created_at", 1))
    
    total = len(users)
    print(f"Total users: {total}")
    
    # Handle users without created_at - put them at the end
    users_with_date = [u for u in users if u.get("created_at")]
    users_without_date = [u for u in users if not u.get("created_at")]
    
    if users_without_date:
        print(f"  Users without created_at: {len(users_without_date)} (placed at end)")
    
    sorted_users = users_with_date + users_without_date
    
    print(f"\n{'='*60}")
    print(f"Single Leg Tree Assignment (by joining date/time)")
    print(f"{'='*60}")
    
    prev_uid = None
    updates = []
    
    for position, user in enumerate(sorted_users, start=1):
        uid = user["uid"]
        name = user.get("name", "Unknown")
        created = user.get("created_at", "No date")
        referred_by = user.get("referred_by", None)
        
        update = {
            "tree_position": position,
            "network_parent": prev_uid  # None for first user
        }
        updates.append((uid, update))
        prev_uid = uid  # Set parent for next user
        
        if position <= 10 or position > total - 3:
            parent_name = "ROOT" if update["network_parent"] is None else f"pos {position-1}"
            print(f"  [{position:5d}] {name[:25]:25s} | parent: {parent_name:10s} | referred_by: {str(referred_by)[:15]:15s} | {created}")
        elif position == 11:
            print(f"  ... ({total - 13} more users) ...")
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Total users to update: {len(updates)}")
    print(f"  First user (position 1): {sorted_users[0].get('name')} ({sorted_users[0].get('uid')[:8]}...)")
    print(f"  Last user (position {total}): {sorted_users[-1].get('name')} ({sorted_users[-1].get('uid')[:8]}...)")
    
    if apply:
        print(f"\n🔄 Applying changes...")
        from pymongo import UpdateOne
        
        bulk_ops = []
        for uid, update_data in updates:
            bulk_ops.append(UpdateOne(
                {"uid": uid},
                {"$set": update_data}
            ))
        
        if bulk_ops:
            result = db.users.bulk_write(bulk_ops)
            print(f"✅ Updated {result.modified_count} users")
            
            # Create index on tree_position for efficient queries
            db.users.create_index("tree_position")
            db.users.create_index("network_parent")
            print(f"✅ Indexes created on tree_position and network_parent")
        
        # Verify
        verified = db.users.count_documents({"tree_position": {"$exists": True}})
        print(f"✅ Verification: {verified}/{total} users have tree_position")
    else:
        print(f"\n⚠️  DRY RUN - No changes applied. Use --apply to apply.")
    
    client.close()

if __name__ == "__main__":
    apply = "--apply" in sys.argv
    run_migration(apply=apply)
