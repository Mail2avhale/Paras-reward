"""
PRC Integrity Audit Script
===========================
Checks if user's PRC balance matches their actual transactions.

Formula: 
    Expected Balance = Mined + Referral Rewards + Refunds + Admin Credits - Redeemed

Run: python scripts/prc_integrity_audit.py [--fix] [--user UID]
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')


async def get_user_prc_sources(db, uid: str) -> dict:
    """Calculate all PRC credits and debits for a user"""
    
    result = {
        "uid": uid,
        "credits": {
            "mining": 0,
            "referral_bonus": 0,
            "signup_bonus": 0,
            "refunds": 0,
            "admin_credit": 0,
            "other": 0
        },
        "debits": {
            "bill_payments": 0,
            "bank_withdrawals": 0,
            "gift_vouchers": 0,
            "orders": 0,
            "subscriptions": 0,
            "burns": 0,
            "other": 0
        },
        "transactions_checked": 0
    }
    
    # 1. Get mining total from user document
    user = await db.users.find_one({"uid": uid}, {"total_mined": 1, "total_prc_mined": 1, "prc_balance": 1})
    if not user:
        return None
    
    result["current_balance"] = user.get("prc_balance", 0)
    result["credits"]["mining"] = user.get("total_prc_mined", 0) or user.get("total_mined", 0) or 0
    
    # 2. Get all transactions for this user
    transactions = await db.transactions.find({
        "$or": [{"user_id": uid}, {"uid": uid}]
    }).to_list(10000)
    
    result["transactions_checked"] = len(transactions)
    
    for txn in transactions:
        txn_type = txn.get("type", "").lower()
        amount = abs(float(txn.get("amount", 0) or txn.get("prc_amount", 0) or txn.get("amount_prc", 0) or 0))
        
        # Credits
        if txn_type in ["mining", "mine", "daily_mining"]:
            # Already counted from user.total_mined
            pass
        elif txn_type in ["referral", "referral_bonus", "referral_reward"]:
            result["credits"]["referral_bonus"] += amount
        elif txn_type in ["signup", "signup_bonus", "welcome_bonus"]:
            result["credits"]["signup_bonus"] += amount
        elif txn_type in ["refund", "prc_refund"]:
            result["credits"]["refunds"] += amount
        elif txn_type in ["admin_credit", "manual_credit", "credit"]:
            result["credits"]["admin_credit"] += amount
        
        # Debits
        elif txn_type in ["redeem", "bill_payment", "bbps"]:
            result["debits"]["bill_payments"] += amount
        elif txn_type in ["bank_withdraw", "bank_transfer", "withdrawal"]:
            result["debits"]["bank_withdrawals"] += amount
        elif txn_type in ["gift_voucher", "voucher"]:
            result["debits"]["gift_vouchers"] += amount
        elif txn_type in ["order", "purchase", "shop"]:
            result["debits"]["orders"] += amount
        elif txn_type in ["subscription", "subscription_prc"]:
            result["debits"]["subscriptions"] += amount
        elif txn_type in ["burn", "prc_burn"]:
            result["debits"]["burns"] += amount
    
    # 3. Check redemption collections directly (may not all be in transactions)
    # Bill payments
    bp_docs = await db.bill_payment_requests.find({
        "user_id": uid,
        "status": {"$in": ["approved", "success", "completed"]}
    }).to_list(1000)
    
    for bp in bp_docs:
        prc = float(bp.get("prc_used", 0) or bp.get("total_prc_deducted", 0) or bp.get("prc_amount", 0) or 0)
        if prc > 0:
            result["debits"]["bill_payments"] = max(result["debits"]["bill_payments"], prc)
    
    # Calculate expected balance
    total_credits = sum(result["credits"].values())
    total_debits = sum(result["debits"].values())
    result["expected_balance"] = total_credits - total_debits
    result["discrepancy"] = result["current_balance"] - result["expected_balance"]
    
    return result


async def run_audit(specific_uid: str = None, fix: bool = False, limit: int = 100):
    """Run PRC audit for all users or specific user"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 80)
    print("PRC INTEGRITY AUDIT")
    print(f"Database: {DB_NAME}")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 80)
    
    if specific_uid:
        # Audit single user
        result = await get_user_prc_sources(db, specific_uid)
        if result:
            print_user_audit(result)
        else:
            print(f"User {specific_uid} not found")
    else:
        # Audit top users by balance
        users = await db.users.find(
            {"prc_balance": {"$gt": 1000}},
            {"uid": 1, "name": 1, "email": 1, "prc_balance": 1}
        ).sort("prc_balance", -1).limit(limit).to_list(limit)
        
        print(f"\nAuditing {len(users)} users with PRC > 1000...\n")
        
        suspicious = []
        
        for user in users:
            result = await get_user_prc_sources(db, user["uid"])
            if result:
                # Flag if discrepancy > 10% of balance and > 1000 PRC
                if abs(result["discrepancy"]) > max(result["current_balance"] * 0.1, 1000):
                    suspicious.append({
                        "name": user.get("name"),
                        "email": user.get("email"),
                        "uid": user["uid"],
                        **result
                    })
        
        print(f"\n{'='*80}")
        print(f"SUSPICIOUS ACCOUNTS: {len(suspicious)}")
        print(f"{'='*80}\n")
        
        for s in suspicious:
            print(f"\n{s['name']} ({s['email']})")
            print(f"  UID: {s['uid']}")
            print(f"  Current Balance: {s['current_balance']:,.2f} PRC")
            print(f"  Expected Balance: {s['expected_balance']:,.2f} PRC")
            print(f"  DISCREPANCY: {s['discrepancy']:+,.2f} PRC")
            print(f"  Credits: Mining={s['credits']['mining']:.2f}, Referral={s['credits']['referral_bonus']:.2f}, Refunds={s['credits']['refunds']:.2f}")
            print(f"  Debits: Bills={s['debits']['bill_payments']:.2f}, Bank={s['debits']['bank_withdrawals']:.2f}")
    
    client.close()


def print_user_audit(result: dict):
    """Print detailed audit for single user"""
    print(f"\nUser: {result['uid']}")
    print(f"Current Balance: {result['current_balance']:,.2f} PRC")
    print(f"Transactions Checked: {result['transactions_checked']}")
    
    print("\nCREDITS:")
    for k, v in result["credits"].items():
        if v > 0:
            print(f"  {k}: {v:,.2f}")
    
    print("\nDEBITS:")
    for k, v in result["debits"].items():
        if v > 0:
            print(f"  {k}: {v:,.2f}")
    
    total_credits = sum(result["credits"].values())
    total_debits = sum(result["debits"].values())
    
    print(f"\nTotal Credits: {total_credits:,.2f}")
    print(f"Total Debits: {total_debits:,.2f}")
    print(f"Expected Balance: {result['expected_balance']:,.2f}")
    print(f"Actual Balance: {result['current_balance']:,.2f}")
    print(f"\nDISCREPANCY: {result['discrepancy']:+,.2f} PRC")
    
    if abs(result['discrepancy']) > 100:
        print("\n⚠️  SIGNIFICANT DISCREPANCY DETECTED!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="PRC Integrity Audit")
    parser.add_argument("--user", "-u", help="Specific user UID to audit")
    parser.add_argument("--fix", action="store_true", help="Apply fixes (not implemented yet)")
    parser.add_argument("--limit", "-l", type=int, default=100, help="Number of users to audit")
    
    args = parser.parse_args()
    
    asyncio.run(run_audit(specific_uid=args.user, fix=args.fix, limit=args.limit))
