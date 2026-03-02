#!/usr/bin/env python3
"""
BULK REJECT SCRIPT - सर्व Pending Requests Reject करून PRC Return करा

Run this on production server:
    python3 bulk_reject_script.py

This will:
1. Reject all pending bill payment requests
2. Reject all pending bank transfer requests  
3. Return PRC to all users
4. Log all transactions
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
    """Log a transaction"""
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

async def bulk_reject():
    print("=" * 60)
    print("🚀 BULK REJECT SCRIPT - Production Database")
    print("=" * 60)
    
    print("\n🔗 Connecting to Production MongoDB Atlas...")
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=30000)
    db = client[DB_NAME]
    
    try:
        # Test connection
        await client.admin.command('ping')
        print("✅ Connected to MongoDB Atlas!")
        
        results = {
            "bill_payments": {"rejected": 0, "prc_refunded": 0, "errors": []},
            "bank_transfers": {"rejected": 0, "prc_refunded": 0, "errors": []},
        }
        
        now = datetime.now(timezone.utc)
        
        # ========== 1. REJECT ALL PENDING BILL PAYMENTS ==========
        print("\n" + "=" * 50)
        print("📋 STEP 1: Rejecting Bill Payment Requests...")
        print("=" * 50)
        
        pending_bills = await db.bill_payment_requests.find({
            "status": {"$in": ["pending", "eko_failed"]}
        }).to_list(length=None)
        
        print(f"Found {len(pending_bills)} pending bill payment requests")
        
        for i, bill in enumerate(pending_bills, 1):
            try:
                request_id = bill.get("request_id")
                user_id = bill.get("user_id")
                total_prc = bill.get("total_prc_deducted", 0)
                
                if not user_id or total_prc <= 0:
                    results["bill_payments"]["errors"].append(f"Invalid data for {request_id}")
                    continue
                
                # Get user and refund PRC
                user = await db.users.find_one({"uid": user_id})
                if not user:
                    results["bill_payments"]["errors"].append(f"User not found: {user_id}")
                    continue
                
                balance_before = user.get("prc_balance", 0)
                balance_after = balance_before + total_prc
                
                # Update user balance
                await db.users.update_one(
                    {"uid": user_id},
                    {"$set": {"prc_balance": balance_after}}
                )
                
                # Update request status
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
                            "balance_after": balance_after,
                            "refunded_at": now.isoformat()
                        },
                        "bulk_rejected": True
                    }}
                )
                
                # Log refund transaction
                await log_transaction(
                    db=db,
                    user_id=user_id,
                    wallet_type="prc",
                    transaction_type="bill_payment_refund",
                    amount=total_prc,
                    description=f"Bill payment rejected - {REJECT_REASON}",
                    metadata={
                        "request_id": request_id,
                        "reason": REJECT_REASON,
                        "balance_before": balance_before,
                        "balance_after": balance_after,
                        "bulk_reject": True
                    }
                )
                
                results["bill_payments"]["rejected"] += 1
                results["bill_payments"]["prc_refunded"] += total_prc
                
                if i % 50 == 0:
                    print(f"  Processed {i}/{len(pending_bills)} bill payments...")
                
            except Exception as e:
                results["bill_payments"]["errors"].append(f"Error for {bill.get('request_id')}: {str(e)}")
        
        print(f"✅ Bill Payments: Rejected {results['bill_payments']['rejected']}, Refunded {results['bill_payments']['prc_refunded']:,.2f} PRC")
        
        # ========== 2. REJECT ALL PENDING BANK TRANSFERS ==========
        print("\n" + "=" * 50)
        print("📋 STEP 2: Rejecting Bank Transfer Requests...")
        print("=" * 50)
        
        pending_bank = await db.bank_redeem_requests.find({
            "status": {"$in": ["pending", "eko_failed"]}
        }).to_list(length=None)
        
        print(f"Found {len(pending_bank)} pending bank transfer requests")
        
        for i, bank_req in enumerate(pending_bank, 1):
            try:
                request_id = bank_req.get("request_id")
                user_id = bank_req.get("user_id")
                total_prc = bank_req.get("total_prc_deducted", 0)
                
                if not user_id or total_prc <= 0:
                    results["bank_transfers"]["errors"].append(f"Invalid data for {request_id}")
                    continue
                
                # Get user and refund PRC
                user = await db.users.find_one({"uid": user_id})
                if not user:
                    results["bank_transfers"]["errors"].append(f"User not found: {user_id}")
                    continue
                
                balance_before = user.get("prc_balance", 0)
                balance_after = balance_before + total_prc
                
                # Update user balance
                await db.users.update_one(
                    {"uid": user_id},
                    {"$set": {"prc_balance": balance_after}}
                )
                
                # Update request status
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
                            "balance_after": balance_after,
                            "refunded_at": now.isoformat()
                        },
                        "bulk_rejected": True
                    }}
                )
                
                # Log refund transaction
                await log_transaction(
                    db=db,
                    user_id=user_id,
                    wallet_type="prc",
                    transaction_type="bank_transfer_refund",
                    amount=total_prc,
                    description=f"Bank transfer rejected - {REJECT_REASON}",
                    metadata={
                        "request_id": request_id,
                        "reason": REJECT_REASON,
                        "balance_before": balance_before,
                        "balance_after": balance_after,
                        "bulk_reject": True
                    }
                )
                
                results["bank_transfers"]["rejected"] += 1
                results["bank_transfers"]["prc_refunded"] += total_prc
                
                if i % 100 == 0:
                    print(f"  Processed {i}/{len(pending_bank)} bank transfers...")
                
            except Exception as e:
                results["bank_transfers"]["errors"].append(f"Error for {bank_req.get('request_id')}: {str(e)}")
        
        print(f"✅ Bank Transfers: Rejected {results['bank_transfers']['rejected']}, Refunded {results['bank_transfers']['prc_refunded']:,.2f} PRC")
        
        # ========== FINAL SUMMARY ==========
        print("\n" + "=" * 60)
        print("🎉 BULK REJECT COMPLETE!")
        print("=" * 60)
        
        total_rejected = results["bill_payments"]["rejected"] + results["bank_transfers"]["rejected"]
        total_prc_refunded = results["bill_payments"]["prc_refunded"] + results["bank_transfers"]["prc_refunded"]
        
        print(f"\n📊 SUMMARY:")
        print(f"   Bill Payments Rejected: {results['bill_payments']['rejected']}")
        print(f"   Bill Payments PRC Refunded: {results['bill_payments']['prc_refunded']:,.2f}")
        print(f"   Bank Transfers Rejected: {results['bank_transfers']['rejected']}")
        print(f"   Bank Transfers PRC Refunded: {results['bank_transfers']['prc_refunded']:,.2f}")
        print(f"\n   TOTAL REJECTED: {total_rejected}")
        print(f"   TOTAL PRC REFUNDED: {total_prc_refunded:,.2f}")
        
        if results["bill_payments"]["errors"]:
            print(f"\n⚠️ Bill Payment Errors: {len(results['bill_payments']['errors'])}")
        if results["bank_transfers"]["errors"]:
            print(f"⚠️ Bank Transfer Errors: {len(results['bank_transfers']['errors'])}")
        
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()
        print("🔌 Disconnected from MongoDB")

if __name__ == "__main__":
    asyncio.run(bulk_reject())
