#!/usr/bin/env python3
"""
Script to set default PIN (102938) for old users who haven't set PIN yet.
Run this once to migrate all users to PIN-based login.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def set_default_pins():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'paras_reward')]
    
    default_pin = "102938"
    hashed_pin = pwd_context.hash(default_pin)
    
    # Find users without pin_migrated flag
    users_without_pin = await db.users.find({
        "$or": [
            {"pin_migrated": {"$exists": False}},
            {"pin_migrated": False}
        ]
    }, {"uid": 1, "email": 1, "name": 1}).to_list(10000)
    
    print(f"Found {len(users_without_pin)} users without PIN")
    
    if len(users_without_pin) == 0:
        print("All users already have PIN set!")
        return
    
    # Update all users
    result = await db.users.update_many(
        {
            "$or": [
                {"pin_migrated": {"$exists": False}},
                {"pin_migrated": False}
            ]
        },
        {
            "$set": {
                "password": hashed_pin,
                "pin_migrated": True,
                "default_pin_set": True
            }
        }
    )
    
    print(f"Updated {result.modified_count} users with default PIN: {default_pin}")
    print("Users should change their PIN after first login!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(set_default_pins())
