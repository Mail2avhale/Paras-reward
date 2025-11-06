#!/usr/bin/env python3
"""
Script to fix parent assignments for existing stockists in the database.
This ensures all stockists have both parent_id and assigned_* fields set correctly.
"""

import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def fix_parent_assignments():
    # Get MongoDB connection
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'paras_reward')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 80)
    print("FIXING STOCKIST PARENT ASSIGNMENTS")
    print("=" * 80)
    
    # Get all stockists and outlets
    all_stockists = await db.users.find({
        "role": {"$in": ["master_stockist", "sub_stockist", "outlet"]}
    }).to_list(1000)
    
    print(f"\nFound {len(all_stockists)} stockists/outlets")
    
    fixed_count = 0
    
    for stockist in all_stockists:
        uid = stockist.get('uid')
        role = stockist.get('role')
        email = stockist.get('email')
        
        print(f"\n📋 Checking {role}: {email} (UID: {uid})")
        
        updates = {}
        
        # For outlets
        if role == 'outlet':
            parent_id = stockist.get('parent_id')
            assigned_sub = stockist.get('assigned_sub_stockist')
            
            if parent_id and not assigned_sub:
                # Has parent_id but missing assigned_sub_stockist
                updates['assigned_sub_stockist'] = parent_id
                print(f"  ✅ Will set assigned_sub_stockist = {parent_id}")
            elif assigned_sub and not parent_id:
                # Has assigned_sub_stockist but missing parent_id
                updates['parent_id'] = assigned_sub
                print(f"  ✅ Will set parent_id = {assigned_sub}")
            elif not parent_id and not assigned_sub:
                print(f"  ⚠️  No parent assignment found - needs manual assignment")
            else:
                print(f"  ✓ Already has both fields set correctly")
        
        # For sub stockists
        elif role == 'sub_stockist':
            parent_id = stockist.get('parent_id')
            assigned_master = stockist.get('assigned_master_stockist')
            
            if parent_id and not assigned_master:
                # Has parent_id but missing assigned_master_stockist
                updates['assigned_master_stockist'] = parent_id
                print(f"  ✅ Will set assigned_master_stockist = {parent_id}")
            elif assigned_master and not parent_id:
                # Has assigned_master_stockist but missing parent_id
                updates['parent_id'] = assigned_master
                print(f"  ✅ Will set parent_id = {assigned_master}")
            elif not parent_id and not assigned_master:
                print(f"  ⚠️  No parent assignment found - needs manual assignment")
            else:
                print(f"  ✓ Already has both fields set correctly")
        
        # Apply updates if any
        if updates:
            updates['updated_at'] = datetime.now(timezone.utc).isoformat()
            await db.users.update_one(
                {"uid": uid},
                {"$set": updates}
            )
            fixed_count += 1
            print(f"  ✅ Fixed!")
    
    print(f"\n{'=' * 80}")
    print(f"SUMMARY:")
    print(f"Total stockists checked: {len(all_stockists)}")
    print(f"Fixed: {fixed_count}")
    print(f"{'=' * 80}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_parent_assignments())
