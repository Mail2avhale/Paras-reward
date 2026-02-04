#!/usr/bin/env python3
"""
MongoDB Index Creation Script for Production
Run this script once after deploying to create all necessary indexes.

Usage:
    python create_indexes.py

This will significantly improve query performance for:
- User lookups
- Transaction history
- Notifications
- Orders
- Payment requests
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def create_all_indexes():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'prc_rewards')
    
    if not mongo_url:
        print("❌ ERROR: MONGO_URL not found in environment")
        return
    
    print(f"Connecting to database: {db_name}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("\n" + "="*50)
    print("   Creating MongoDB Indexes for Performance")
    print("="*50 + "\n")
    
    try:
        # ============ USERS COLLECTION ============
        print("📁 users collection:")
        await db.users.create_index("uid", unique=True, background=True)
        await db.users.create_index("email", unique=True, background=True)
        await db.users.create_index("referral_code", background=True)
        await db.users.create_index("referred_by", background=True)
        await db.users.create_index("subscription_plan", background=True)
        await db.users.create_index("mining_active", background=True)
        await db.users.create_index("role", background=True)
        await db.users.create_index("created_at", background=True)
        await db.users.create_index([("subscription_plan", 1), ("mining_active", 1)], background=True)
        print("   ✅ 9 indexes created")
        
        # ============ TRANSACTIONS COLLECTION ============
        print("📁 transactions collection:")
        await db.transactions.create_index("user_id", background=True)
        await db.transactions.create_index("type", background=True)
        await db.transactions.create_index("created_at", background=True)
        await db.transactions.create_index([("user_id", 1), ("type", 1)], background=True)
        await db.transactions.create_index([("user_id", 1), ("created_at", -1)], background=True)
        print("   ✅ 5 indexes created")
        
        # ============ VIP PAYMENTS COLLECTION ============
        print("📁 vip_payments collection:")
        await db.vip_payments.create_index("user_id", background=True)
        await db.vip_payments.create_index("payment_id", unique=True, background=True)
        await db.vip_payments.create_index("status", background=True)
        await db.vip_payments.create_index("created_at", background=True)
        await db.vip_payments.create_index([("user_id", 1), ("status", 1)], background=True)
        print("   ✅ 5 indexes created")
        
        # ============ ORDERS COLLECTION ============
        print("📁 orders collection:")
        await db.orders.create_index("user_id", background=True)
        await db.orders.create_index("order_id", unique=True, background=True)
        await db.orders.create_index("status", background=True)
        await db.orders.create_index("created_at", background=True)
        await db.orders.create_index([("user_id", 1), ("status", 1)], background=True)
        print("   ✅ 5 indexes created")
        
        # ============ NOTIFICATIONS COLLECTION ============
        print("📁 notifications collection:")
        await db.notifications.create_index("user_id", background=True)
        await db.notifications.create_index("notification_id", unique=True, background=True)
        await db.notifications.create_index("is_read", background=True)
        await db.notifications.create_index([("user_id", 1), ("is_read", 1)], background=True)
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)], background=True)
        print("   ✅ 5 indexes created")
        
        # ============ BILL PAYMENT REQUESTS ============
        print("📁 bill_payment_requests collection:")
        await db.bill_payment_requests.create_index("user_id", background=True)
        await db.bill_payment_requests.create_index("request_id", unique=True, background=True)
        await db.bill_payment_requests.create_index("status", background=True)
        await db.bill_payment_requests.create_index([("user_id", 1), ("status", 1)], background=True)
        print("   ✅ 4 indexes created")
        
        # ============ GIFT VOUCHER REQUESTS ============
        print("📁 gift_voucher_requests collection:")
        await db.gift_voucher_requests.create_index("user_id", background=True)
        await db.gift_voucher_requests.create_index("request_id", unique=True, background=True)
        await db.gift_voucher_requests.create_index("status", background=True)
        await db.gift_voucher_requests.create_index([("user_id", 1), ("status", 1)], background=True)
        print("   ✅ 4 indexes created")
        
        # ============ KYC DOCUMENTS ============
        print("📁 kyc_documents collection:")
        await db.kyc_documents.create_index("user_id", background=True)
        await db.kyc_documents.create_index("status", background=True)
        await db.kyc_documents.create_index([("user_id", 1), ("status", 1)], background=True)
        print("   ✅ 3 indexes created")
        
        # ============ REFERRALS ============
        print("📁 referrals collection:")
        await db.referrals.create_index("referrer_id", background=True)
        await db.referrals.create_index("referred_id", background=True)
        await db.referrals.create_index([("referrer_id", 1), ("level", 1)], background=True)
        print("   ✅ 3 indexes created")
        
        print("\n" + "="*50)
        print("   🎉 ALL INDEXES CREATED SUCCESSFULLY!")
        print("="*50)
        print("\nTotal: 43 indexes across 9 collections")
        print("Your database queries should be much faster now!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(create_all_indexes())
