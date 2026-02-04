#!/usr/bin/env python3
"""
Script to create a Manager user for PARAS REWARD application.

Manager Role Permissions:
- KYC verification (approve/reject)
- VIP payment verification (approve/reject)
- Stock movement approval (approve/reject)
- Support tickets (view-only)

Restrictions:
- Cannot delete users
- Cannot modify product catalog
- Cannot access financial management  
- Cannot change system settings
- Cannot assign roles to other users

Usage:
    python create_manager.py
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from passlib.context import CryptContext
import uuid
from datetime import datetime, timezone

# Load environment variables
load_dotenv()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ.get('DB_NAME', 'test_database')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

async def create_manager():
    """Create a manager user"""
    print("=" * 50)
    print("PARAS REWARD - Manager User Creation")
    print("=" * 50)
    print()
    
    # Get user input
    email = input("Enter manager email: ").strip()
    if not email:
        print("Error: Email is required")
        return
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"Error: User with email '{email}' already exists")
        return
    
    name = input("Enter manager full name: ").strip()
    if not name:
        print("Error: Name is required")
        return
    
    mobile = input("Enter manager mobile number (with +91): ").strip()
    if not mobile:
        mobile = f"+91{input('Enter 10-digit mobile: ').strip()}"
    
    # Check if mobile already exists
    existing_mobile = await db.users.find_one({"mobile": mobile})
    if existing_mobile:
        print(f"Error: User with mobile '{mobile}' already exists")
        return
    
    password = input("Enter password for manager: ").strip()
    if not password or len(password) < 6:
        print("Error: Password must be at least 6 characters")
        return
    
    # Create manager user
    manager = {
        "uid": str(uuid.uuid4()),
        "email": email,
        "name": name,
        "mobile": mobile,
        "password": hash_password(password),
        "role": "manager",
        "membership_type": "free",
        "prc_balance": 0,
        "cashback_balance": 0.0,
        "profit_balance": 0.0,
        "is_active": True,
        "kyc_status": "not_submitted",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert into database
    result = await db.users.insert_one(manager)
    
    if result.inserted_id:
        print()
        print("✅ Manager user created successfully!")
        print()
        print("Manager Details:")
        print(f"  UID: {manager['uid']}")
        print(f"  Email: {manager['email']}")
        print(f"  Name: {manager['name']}")
        print(f"  Mobile: {manager['mobile']}")
        print(f"  Role: manager")
        print()
        print("Manager Permissions:")
        print("  ✅ KYC Verification")
        print("  ✅ VIP Payment Approval")
        print("  ✅ Stock Movement Approval")
        print("  ✅ Support Tickets (View-Only)")
        print()
        print("Access URL: /manager (after login)")
        print()
    else:
        print("❌ Error: Failed to create manager user")

async def main():
    """Main function"""
    try:
        await create_manager()
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
