#!/usr/bin/env python3
"""
Fix parent assignments for existing outlets and sub stockists
Adds assigned_sub_stockist and assigned_master_stockist fields
"""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_parent_assignments():
    # MongoDB connection
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("FIXING PARENT ASSIGNMENTS")
    print("=" * 60)
    
    # Fix outlets - add assigned_sub_stockist field
    print("\n1. Fixing Outlets...")
    outlets = await db.users.find({"role": "outlet"}).to_list(None)
    print(f"   Found {len(outlets)} outlets")
    
    fixed_outlets = 0
    for outlet in outlets:
        parent_id = outlet.get("parent_id")
        if parent_id and not outlet.get("assigned_sub_stockist"):
            # Verify parent is a sub stockist
            parent = await db.users.find_one({"uid": parent_id, "role": "sub_stockist"})
            if parent:
                await db.users.update_one(
                    {"uid": outlet["uid"]},
                    {"$set": {"assigned_sub_stockist": parent_id}}
                )
                print(f"   ✓ Fixed outlet: {outlet.get('email')} → Sub Stockist: {parent.get('email')}")
                fixed_outlets += 1
            else:
                print(f"   ✗ Outlet {outlet.get('email')} has invalid parent_id")
        elif not parent_id:
            print(f"   ⚠ Outlet {outlet.get('email')} has no parent_id assigned")
    
    print(f"\n   Fixed {fixed_outlets} outlets")
    
    # Fix sub stockists - add assigned_master_stockist field
    print("\n2. Fixing Sub Stockists...")
    sub_stockists = await db.users.find({"role": "sub_stockist"}).to_list(None)
    print(f"   Found {len(sub_stockists)} sub stockists")
    
    fixed_subs = 0
    for sub in sub_stockists:
        parent_id = sub.get("parent_id")
        if parent_id and not sub.get("assigned_master_stockist"):
            # Verify parent is a master stockist
            parent = await db.users.find_one({"uid": parent_id, "role": "master_stockist"})
            if parent:
                await db.users.update_one(
                    {"uid": sub["uid"]},
                    {"$set": {"assigned_master_stockist": parent_id}}
                )
                print(f"   ✓ Fixed sub stockist: {sub.get('email')} → Master Stockist: {parent.get('email')}")
                fixed_subs += 1
            else:
                print(f"   ✗ Sub Stockist {sub.get('email')} has invalid parent_id")
        elif not parent_id:
            print(f"   ⚠ Sub Stockist {sub.get('email')} has no parent_id assigned")
    
    print(f"\n   Fixed {fixed_subs} sub stockists")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Outlets fixed: {fixed_outlets}/{len(outlets)}")
    print(f"Sub Stockists fixed: {fixed_subs}/{len(sub_stockists)}")
    print(f"Total fixed: {fixed_outlets + fixed_subs}")
    print("\n✅ Parent assignments updated successfully!")
    print("\nNOTE: If any users show warnings (⚠), they need to be")
    print("      assigned to a parent via Admin Dashboard.")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_parent_assignments())
