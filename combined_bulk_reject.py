#!/usr/bin/env python3
"""
🚀 COMBINED SCRIPT: BULK REJECT + DISABLE SERVICES

Run this on any server that can connect to MongoDB Atlas:
    pip install motor
    python3 combined_bulk_reject.py

This will:
1. Reject ALL pending bill payment requests (PRC returned)
2. Reject ALL pending bank transfer requests (PRC returned)
3. Disable all redeem services
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid

# Production MongoDB URL
MONGO_URL = "mongodb+srv://mining-boost-1:d46727klqs2c73fimmi0@customer-apps.hfzqpg.mongodb.net/?appName=admin-payment-hub-5&maxPoolSize=5&retryWrites=true&w=majority"
DB_NAME = "paras_reward"

REJECT_REASON = "BY ADMIN"
ADMIN_NAME = "Admin"
ADMIN_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"

async def log_transaction(db, user_id, wallet_type, transaction_type, amount, description, metadata=None):
    await db.transactions.insert_one({
        "transaction_id": f"TXN{uuid.uuid4().hex[:12].upper()}",
        "user_id": user_id,
        "wallet_type": wallet_type,
        "transaction_type": transaction_type,
        "amount": amount,
        "description": description,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "completed"
    })

async def main():
    print("=" * 70)
    print("🚀 PARAS REWARD - BULK REJECT + DISABLE SERVICES")
    print("=" * 70)
    
    print("\n🔗 Connecting to Production MongoDB Atlas...")
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=60000)
    db = client[DB_NAME]
    
    try:
        await client.admin.command('ping')
        print("✅ Connected!")
        
        now = datetime.now(timezone.utc)
        
        # ========== STEP 1: REJECT BILL PAYMENTS ==========
        print("\n" + "=" * 70)
        print("📋 STEP 1: Rejecting ALL Pending Bill Payments...")
        print("=" * 70)
        
        bill_rejected = 0
        bill_prc = 0
        
        pending_bills = await db.bill_payment_requests.find({
            "status": {"$in": ["pending", "eko_failed"]}
        }).to_list(length=None)
        
        print(f"📋 Found: {len(pending_bills)} pending")
        
        for bill in pending_bills:
            try:
                request_id = bill.get("request_id")
                user_id = bill.get("user_id")
                total_prc = bill.get("total_prc_deducted", 0)
                
                if not user_id or total_prc <= 0:
                    continue
                
                user = await db.users.find_one({"uid": user_id})
                if not user:
                    continue
                
                balance_before = user.get("prc_balance", 0)
                balance_after = balance_before + total_prc
                
                await db.users.update_one(
                    {"uid": user_id},
                    {"$set": {"prc_balance": balance_after}}
                )
                
                await db.bill_payment_requests.update_one(
                    {"request_id": request_id},
                    {"$set": {
                        "status": "rejected",
                        "reject_reason": REJECT_REASON,
                        "processed_at": now.isoformat(),
                        "admin_notes": REJECT_REASON,
                        "processed_by": ADMIN_NAME,
                        "processed_by_uid": ADMIN_UID,
                        "refund_details": {
                            "prc_refunded": total_prc,
                            "balance_before": balance_before,
                            "balance_after": balance_after
                        },
                        "bulk_rejected": True
                    }}
                )
                
                await log_transaction(db, user_id, "prc", "bill_payment_refund", total_prc,
                    f"Bill payment rejected - {REJECT_REASON}",
                    {"request_id": request_id, "bulk_reject": True})
                
                bill_rejected += 1
                bill_prc += total_prc
                
            except Exception as e:
                print(f"  ⚠️ Error: {e}")
        
        print(f"✅ Rejected: {bill_rejected} | PRC Refunded: {bill_prc:,.2f}")
        
        # ========== STEP 2: REJECT BANK TRANSFERS ==========
        print("\n" + "=" * 70)
        print("📋 STEP 2: Rejecting ALL Pending Bank Transfers...")
        print("=" * 70)
        
        bank_rejected = 0
        bank_prc = 0
        
        pending_bank = await db.bank_redeem_requests.find({
            "status": {"$in": ["pending", "eko_failed"]}
        }).to_list(length=None)
        
        print(f"📋 Found: {len(pending_bank)} pending")
        
        for i, bank_req in enumerate(pending_bank, 1):
            try:
                request_id = bank_req.get("request_id")
                user_id = bank_req.get("user_id")
                total_prc = bank_req.get("total_prc_deducted", 0)
                
                if not user_id or total_prc <= 0:
                    continue
                
                user = await db.users.find_one({"uid": user_id})
                if not user:
                    continue
                
                balance_before = user.get("prc_balance", 0)
                balance_after = balance_before + total_prc
                
                await db.users.update_one(
                    {"uid": user_id},
                    {"$set": {"prc_balance": balance_after}}
                )
                
                await db.bank_redeem_requests.update_one(
                    {"request_id": request_id},
                    {"$set": {
                        "status": "rejected",
                        "reject_reason": REJECT_REASON,
                        "processed_at": now.isoformat(),
                        "admin_notes": REJECT_REASON,
                        "processed_by": ADMIN_NAME,
                        "processed_by_uid": ADMIN_UID,
                        "refund_details": {
                            "prc_refunded": total_prc,
                            "balance_before": balance_before,
                            "balance_after": balance_after
                        },
                        "bulk_rejected": True
                    }}
                )
                
                await log_transaction(db, user_id, "prc", "bank_transfer_refund", total_prc,
                    f"Bank transfer rejected - {REJECT_REASON}",
                    {"request_id": request_id, "bulk_reject": True})
                
                bank_rejected += 1
                bank_prc += total_prc
                
                if i % 200 == 0:
                    print(f"  Progress: {i}/{len(pending_bank)}...")
                
            except Exception as e:
                print(f"  ⚠️ Error: {e}")
        
        print(f"✅ Rejected: {bank_rejected} | PRC Refunded: {bank_prc:,.2f}")
        
        # ========== STEP 3: DISABLE SERVICES ==========
        print("\n" + "=" * 70)
        print("🔒 STEP 3: Disabling All Redeem Services...")
        print("=" * 70)
        
        services = ["bank_transfer", "bill_payment", "gift_voucher", "mobile_recharge",
                    "dth_recharge", "electricity_bill", "gas_bill", "lpg_booking"]
        
        for svc in services:
            await db.service_settings.update_one(
                {"service_name": svc},
                {"$set": {"service_name": svc, "enabled": False, "disabled_at": now.isoformat()}},
                upsert=True
            )
        
        await db.app_settings.update_one(
            {"setting_type": "redeem_services"},
            {"$set": {
                "all_redeem_enabled": False,
                "bank_transfer_enabled": False,
                "bill_payment_enabled": False,
                "disabled_at": now.isoformat()
            }},
            upsert=True
        )
        
        print("✅ All redeem services DISABLED!")
        
        # ========== FINAL SUMMARY ==========
        print("\n" + "=" * 70)
        print("🎉 COMPLETE!")
        print("=" * 70)
        print(f"\n📊 SUMMARY:")
        print(f"   Bill Payments Rejected: {bill_rejected}")
        print(f"   Bill Payments PRC: {bill_prc:,.2f}")
        print(f"   Bank Transfers Rejected: {bank_rejected}")
        print(f"   Bank Transfers PRC: {bank_prc:,.2f}")
        print(f"\n   TOTAL REJECTED: {bill_rejected + bank_rejected}")
        print(f"   TOTAL PRC REFUNDED: {bill_prc + bank_prc:,.2f}")
        print(f"\n   ❌ All Redeem Services: DISABLED")
        print("=" * 70)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
