#!/usr/bin/env python3
"""
Quick script to make a user an admin
Usage: python make_admin.py
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def main():
    # Connect to MongoDB
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "paras_reward")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("PARAS REWARD - Admin Role Assignment Tool")
    print("=" * 60)
    
    # List all users
    users = await db.users.find().to_list(length=None)
    
    if not users:
        print("\n❌ No users found in database.")
        print("Please register a user first through the app.")
        return
    
    print(f"\n📋 Found {len(users)} user(s):\n")
    
    for idx, user in enumerate(users, 1):
        role_badge = "👑 ADMIN" if user.get("role") == "admin" else f"👤 {user.get('role', 'user').upper()}"
        print(f"{idx}. {role_badge}")
        print(f"   Name: {user.get('name', 'N/A')}")
        print(f"   Email: {user.get('email', 'N/A')}")
        print(f"   Mobile: {user.get('mobile', 'N/A')}")
        print(f"   UID: {user.get('uid')}")
        print(f"   Current Role: {user.get('role', 'user')}")
        print()
    
    # Get user choice
    print("=" * 60)
    choice = input("Enter user number to make ADMIN (or 'q' to quit): ").strip()
    
    if choice.lower() == 'q':
        print("Cancelled.")
        return
    
    try:
        idx = int(choice) - 1
        if idx < 0 or idx >= len(users):
            print("❌ Invalid choice.")
            return
        
        selected_user = users[idx]
        
        # Confirm
        print(f"\n⚠️  You are about to make this user an ADMIN:")
        print(f"   Name: {selected_user.get('name', 'N/A')}")
        print(f"   Email: {selected_user.get('email', 'N/A')}")
        print(f"   Current Role: {selected_user.get('role', 'user')}")
        
        confirm = input("\nType 'YES' to confirm: ").strip()
        
        if confirm == 'YES':
            # Update role to admin
            result = await db.users.update_one(
                {"uid": selected_user["uid"]},
                {"$set": {"role": "admin"}}
            )
            
            if result.modified_count > 0:
                print("\n✅ SUCCESS! User is now an ADMIN.")
                print(f"   They can now access: https://mining-platform-6.preview.emergentagent.com/admin")
                print("\n💡 Tip: User needs to logout and login again to see admin dashboard.")
            else:
                print("\n⚠️  User was already an admin or update failed.")
        else:
            print("Cancelled.")
    
    except ValueError:
        print("❌ Invalid input. Please enter a number.")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
