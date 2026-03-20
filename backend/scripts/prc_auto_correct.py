"""
PRC Auto-Correction Script
===========================
Automatically corrects PRC balance based on actual transactions.

Formula:
    Correct Balance = Mining + Referrals + Signup Bonus + Refunds - All Redemptions

Usage:
    # Dry run (preview changes):
    python prc_auto_correct.py --dry-run
    
    # Apply corrections:
    python prc_auto_correct.py --apply
    
    # Single user:
    python prc_auto_correct.py --user UID --apply

IMPORTANT: Creates backup before any changes!
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

# Import PRC helper
sys.path.insert(0, '/app/backend')
from utils.prc_fields import get_prc_amount


async def calculate_correct_balance(db, uid: str) -> dict:
    """
    Calculate the correct PRC balance for a user based on all transactions.
    
    Credits:
        - Mining (from user.total_mined or total_prc_mined)
        - Referral rewards (from transactions)
        - Signup bonus (from transactions)
        - Refunds (from rejected/failed redemptions)
        
    Debits:
        - Bill payments (BBPS)
        - Bank withdrawals
        - Gift vouchers
        - Product orders
        - PRC subscriptions
        - Burns
    """
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        return None
    
    result = {
        "uid": uid,
        "name": user.get("name", "Unknown"),
        "email": user.get("email", ""),
        "current_balance": float(user.get("prc_balance", 0)),
        "credits": {},
        "debits": {},
        "total_credits": 0,
        "total_debits": 0,
        "correct_balance": 0,
        "adjustment_needed": 0
    }
    
    # ============ CREDITS ============
    
    # 1. Mining - from user document
    mining = float(user.get("total_prc_mined", 0) or user.get("total_mined", 0) or 0)
    result["credits"]["mining"] = mining
    
    # 2. Referral rewards - from transactions
    referral_txns = await db.transactions.find({
        "$or": [{"user_id": uid}, {"uid": uid}],
        "type": {"$in": ["referral", "referral_bonus", "referral_reward", "referral_commission"]}
    }).to_list(5000)
    referral_total = sum(abs(float(t.get("amount", 0) or t.get("prc_amount", 0) or t.get("amount_prc", 0) or 0)) for t in referral_txns)
    result["credits"]["referral_rewards"] = referral_total
    
    # 3. Signup bonus - from transactions
    signup_txns = await db.transactions.find({
        "$or": [{"user_id": uid}, {"uid": uid}],
        "type": {"$in": ["signup", "signup_bonus", "welcome_bonus", "welcome"]}
    }).to_list(100)
    signup_total = sum(abs(float(t.get("amount", 0) or t.get("prc_amount", 0) or 0)) for t in signup_txns)
    result["credits"]["signup_bonus"] = signup_total
    
    # 4. Admin credits - from transactions
    admin_txns = await db.transactions.find({
        "$or": [{"user_id": uid}, {"uid": uid}],
        "type": {"$in": ["admin_credit", "manual_credit", "credit", "adjustment"]}
    }).to_list(1000)
    admin_total = sum(abs(float(t.get("amount", 0) or t.get("prc_amount", 0) or 0)) for t in admin_txns)
    result["credits"]["admin_credits"] = admin_total
    
    # 5. Refunds - from rejected/failed redemptions that were refunded
    # Check bill_payment_requests
    refunded_bills = await db.bill_payment_requests.find({
        "user_id": uid,
        "status": {"$in": ["rejected", "failed"]},
        "refunded": True
    }).to_list(1000)
    refund_bills_total = sum(get_prc_amount(b) for b in refunded_bills)
    
    # Check bank_withdrawal_requests
    refunded_bank = await db.bank_withdrawal_requests.find({
        "user_id": uid,
        "status": {"$in": ["rejected", "failed"]},
        "refunded": True
    }).to_list(1000)
    refund_bank_total = sum(get_prc_amount(b) for b in refunded_bank)
    
    # Check refund transactions
    refund_txns = await db.transactions.find({
        "$or": [{"user_id": uid}, {"uid": uid}],
        "type": {"$in": ["refund", "prc_refund"]}
    }).to_list(1000)
    refund_txn_total = sum(abs(float(t.get("amount", 0) or t.get("prc_amount", 0) or 0)) for t in refund_txns)
    
    result["credits"]["refunds"] = refund_bills_total + refund_bank_total + refund_txn_total
    
    # ============ DEBITS ============
    
    valid_statuses = ["approved", "success", "completed", "pending", "processing", "paid"]
    skip_statuses = ["refunded", "rejected", "failed", "cancelled"]
    
    # 1. Bill payments (BBPS)
    bills = await db.bill_payment_requests.find({
        "user_id": uid,
        "status": {"$in": valid_statuses}
    }).to_list(5000)
    bill_total = sum(get_prc_amount(b) for b in bills if b.get("status") not in skip_statuses)
    result["debits"]["bill_payments"] = bill_total
    
    # 2. Bank withdrawals
    bank_wd = await db.bank_withdrawal_requests.find({
        "user_id": uid,
        "status": {"$in": valid_statuses}
    }).to_list(5000)
    bank_wd_total = sum(get_prc_amount(b) for b in bank_wd if b.get("status") not in skip_statuses)
    result["debits"]["bank_withdrawals"] = bank_wd_total
    
    # 3. Bank transfer requests
    bank_tr = await db.bank_transfer_requests.find({
        "user_id": uid,
        "status": {"$in": valid_statuses}
    }).to_list(5000)
    bank_tr_total = sum(get_prc_amount(b) for b in bank_tr if b.get("status") not in skip_statuses)
    result["debits"]["bank_transfers"] = bank_tr_total
    
    # 4. Bank redeem requests
    bank_rd = await db.bank_redeem_requests.find({
        "user_id": uid,
        "status": {"$in": valid_statuses}
    }).to_list(5000)
    bank_rd_total = sum(get_prc_amount(b) for b in bank_rd if b.get("status") not in skip_statuses)
    result["debits"]["bank_redeems"] = bank_rd_total
    
    # 5. Redeem requests (generic)
    redeem_req = await db.redeem_requests.find({
        "user_id": uid,
        "status": {"$in": valid_statuses}
    }).to_list(5000)
    redeem_total = sum(get_prc_amount(r) for r in redeem_req if r.get("status") not in skip_statuses)
    result["debits"]["redeem_requests"] = redeem_total
    
    # 6. Gift vouchers
    gv_orders = await db.gift_voucher_orders.find({
        "user_id": uid,
        "status": {"$in": valid_statuses}
    }).to_list(5000)
    gv_total = sum(get_prc_amount(g) for g in gv_orders)
    
    gv_reqs = await db.gift_voucher_requests.find({
        "user_id": uid,
        "status": {"$in": valid_statuses}
    }).to_list(5000)
    gv_req_total = sum(get_prc_amount(g) for g in gv_reqs)
    result["debits"]["gift_vouchers"] = gv_total + gv_req_total
    
    # 7. DMT transactions
    dmt = await db.dmt_transactions.find({
        "user_id": uid,
        "status": {"$in": ["success", "pending", "processing"]}
    }).to_list(5000)
    dmt_total = sum(get_prc_amount(d) for d in dmt)
    result["debits"]["dmt"] = dmt_total
    
    # 8. Product orders
    orders = await db.orders.find({
        "user_id": uid,
        "status": {"$in": ["completed", "delivered", "paid", "pending", "processing"]}
    }).to_list(5000)
    orders_total = sum(get_prc_amount(o) for o in orders if o.get("status") not in ["cancelled", "refunded"])
    result["debits"]["orders"] = orders_total
    
    # 9. PRC Subscription payments
    subs = await db.subscription_payments.find({
        "user_id": uid,
        "payment_method": "prc",
        "status": {"$in": ["paid", "success", "completed"]}
    }).to_list(1000)
    subs_total = sum(get_prc_amount(s) for s in subs)
    result["debits"]["subscriptions"] = subs_total
    
    # 10. Burns
    burn_txns = await db.transactions.find({
        "$or": [{"user_id": uid}, {"uid": uid}],
        "type": {"$in": ["burn", "prc_burn"]}
    }).to_list(1000)
    burn_total = sum(abs(float(t.get("amount", 0) or t.get("prc_amount", 0) or 0)) for t in burn_txns)
    result["debits"]["burns"] = burn_total
    
    # ============ CALCULATE ============
    
    result["total_credits"] = sum(result["credits"].values())
    result["total_debits"] = sum(result["debits"].values())
    result["correct_balance"] = round(result["total_credits"] - result["total_debits"], 2)
    result["adjustment_needed"] = round(result["correct_balance"] - result["current_balance"], 2)
    
    return result


async def run_auto_correct(dry_run: bool = True, specific_uid: str = None, min_balance: float = 0):
    """Run auto-correction for all users or specific user"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    print("=" * 80)
    print("PRC AUTO-CORRECTION")
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else '⚠️  APPLYING CHANGES'}")
    print(f"Database: {DB_NAME}")
    print(f"Time: {timestamp}")
    print("=" * 80)
    
    # Build query
    if specific_uid:
        query = {"uid": specific_uid}
    else:
        query = {"prc_balance": {"$gt": min_balance}}
    
    # Get users
    users = await db.users.find(query, {"uid": 1, "name": 1, "email": 1, "prc_balance": 1}).to_list(10000)
    
    print(f"\nProcessing {len(users)} users...\n")
    
    corrections = []
    errors = []
    
    for i, user in enumerate(users):
        uid = user["uid"]
        
        try:
            result = await calculate_correct_balance(db, uid)
            
            if result and abs(result["adjustment_needed"]) > 1:  # More than 1 PRC difference
                corrections.append(result)
                
                if not dry_run:
                    # Apply correction
                    await db.users.update_one(
                        {"uid": uid},
                        {
                            "$set": {
                                "prc_balance": result["correct_balance"],
                                "prc_balance_corrected_at": timestamp,
                                "prc_balance_before_correction": result["current_balance"]
                            }
                        }
                    )
                    
                    # Log the correction
                    await db.prc_corrections_log.insert_one({
                        "uid": uid,
                        "name": result["name"],
                        "email": result["email"],
                        "before": result["current_balance"],
                        "after": result["correct_balance"],
                        "adjustment": result["adjustment_needed"],
                        "credits": result["credits"],
                        "debits": result["debits"],
                        "corrected_at": timestamp
                    })
        
        except Exception as e:
            errors.append({"uid": uid, "error": str(e)})
        
        # Progress
        if (i + 1) % 100 == 0:
            print(f"  Processed {i + 1}/{len(users)} users...")
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    print(f"\nTotal users processed: {len(users)}")
    print(f"Users needing correction: {len(corrections)}")
    print(f"Errors: {len(errors)}")
    
    if corrections:
        total_adjustment = sum(c["adjustment_needed"] for c in corrections)
        print(f"\nTotal PRC adjustment: {total_adjustment:+,.2f}")
        
        print(f"\n{'Name':<30} {'Current':>12} {'Correct':>12} {'Adjustment':>12}")
        print("-" * 70)
        
        # Sort by adjustment amount (largest first)
        corrections.sort(key=lambda x: abs(x["adjustment_needed"]), reverse=True)
        
        for c in corrections[:50]:  # Show top 50
            print(f"{c['name'][:29]:<30} {c['current_balance']:>12,.2f} {c['correct_balance']:>12,.2f} {c['adjustment_needed']:>+12,.2f}")
        
        if len(corrections) > 50:
            print(f"\n... and {len(corrections) - 50} more users")
    
    if errors:
        print(f"\nErrors:")
        for e in errors[:10]:
            print(f"  {e['uid']}: {e['error']}")
    
    if dry_run:
        print("\n⚠️  DRY RUN - No changes were made.")
        print("Run with --apply to apply corrections.")
    else:
        print(f"\n✅ {len(corrections)} corrections applied!")
        print("Corrections logged to 'prc_corrections_log' collection.")
    
    client.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="PRC Auto-Correction")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Preview changes only (default)")
    parser.add_argument("--apply", action="store_true", help="Actually apply corrections")
    parser.add_argument("--user", "-u", help="Specific user UID")
    parser.add_argument("--min-balance", type=float, default=0, help="Minimum balance to process")
    
    args = parser.parse_args()
    
    dry_run = not args.apply
    
    asyncio.run(run_auto_correct(dry_run=dry_run, specific_uid=args.user, min_balance=args.min_balance))
