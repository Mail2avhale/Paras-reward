from fastapi import APIRouter
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/admin/prc-balance", tags=["Admin PRC Balance"])

db = None

def set_db(database):
    global db
    db = database

@router.get("/audit")
async def audit_prc_balance(uid: str = None, limit: int = 100):
    """
    🔍 AUDIT: Check PRC balance vs actual transactions for users.
    
    This API calculates expected balance from all transactions and compares
    with stored prc_balance field.
    
    Query Params:
    - uid: Specific user UID to audit (optional)
    - limit: Max users to check if no UID specified
    """
    try:
        now = datetime.now(timezone.utc)
        
        if uid:
            users = [await db.users.find_one({"uid": uid})]
            if not users[0]:
                return {"success": False, "error": "User not found"}
        else:
            # Get users with highest balances
            users = await db.users.find(
                {"prc_balance": {"$gt": 1000}}
            ).sort("prc_balance", -1).limit(limit).to_list(limit)
        
        audit_results = []
        
        for user in users:
            if not user:
                continue
                
            user_id = user.get("uid")
            stored_balance = float(user.get("prc_balance", 0) or 0)
            stored_total_mined = float(user.get("total_mined", 0) or 0)
            
            # Calculate from transactions
            total_credits = 0
            total_debits = 0
            mining_total = 0
            referral_total = 0
            level_bonus_total = 0
            rain_total = 0
            other_credits = 0
            
            # 1. PRC Transactions/Ledger
            prc_txns = await db.prc_transactions.find({"user_id": user_id}).to_list(10000)
            for txn in prc_txns:
                amt = float(txn.get("amount", 0) or 0)
                desc = str(txn.get("description", "") or "").lower()
                typ = txn.get("type", "")
                
                if typ == "credit" or (typ not in ["debit"] and amt > 0):
                    total_credits += abs(amt)
                    if "mining" in desc or "mined" in desc:
                        mining_total += abs(amt)
                    elif "level" in desc and "bonus" in desc:
                        level_bonus_total += abs(amt)
                    elif "referral" in desc:
                        referral_total += abs(amt)
                    elif "rain" in desc:
                        rain_total += abs(amt)
                    else:
                        other_credits += abs(amt)
                elif typ == "debit" or amt < 0:
                    total_debits += abs(amt)
            
            # 2. Mining history (if separate collection)
            mining_records = await db.mining_history.find({"user_id": user_id}).to_list(10000)
            for m in mining_records:
                earned = float(m.get("prc_earned", 0) or m.get("amount", 0) or 0)
                if earned > 0:
                    mining_total += earned
                    total_credits += earned
            
            # 3. Bill payments (debits)
            bill_payments = await db.bill_payment_requests.find({
                "user_id": user_id,
                "status": {"$in": ["completed", "success", "approved"]}
            }).to_list(5000)
            for bp in bill_payments:
                prc = float(bp.get("total_prc_deducted", 0) or bp.get("prc_amount", 0) or 0)
                total_debits += prc
            
            # 4. Bank withdrawals (debits)
            bank_withdrawals = await db.bank_withdrawal_requests.find({
                "user_id": user_id,
                "status": {"$in": ["completed", "success", "approved"]}
            }).to_list(5000)
            for bw in bank_withdrawals:
                prc = float(bw.get("total_prc_deducted", 0) or bw.get("prc_amount", 0) or 0)
                total_debits += prc
            
            # 5. Bank transfers (debits)
            bank_transfers = await db.bank_transfer_requests.find({
                "user_id": user_id,
                "status": {"$in": ["completed", "success", "approved", "paid"]}
            }).to_list(5000)
            for bt in bank_transfers:
                prc = float(bt.get("prc_deducted", 0) or bt.get("total_prc_deducted", 0) or 0)
                total_debits += prc
            
            # Calculate expected balance
            expected_balance = total_credits - total_debits
            difference = stored_balance - expected_balance
            
            # Calculate expected total_mined (only mining, not referral/bonus)
            expected_total_mined = mining_total
            mined_difference = stored_total_mined - expected_total_mined
            
            audit_results.append({
                "uid": user_id,
                "name": user.get("name", "Unknown"),
                "stored_balance": round(stored_balance, 2),
                "expected_balance": round(expected_balance, 2),
                "balance_difference": round(difference, 2),
                "stored_total_mined": round(stored_total_mined, 2),
                "expected_total_mined": round(expected_total_mined, 2),
                "mined_difference": round(mined_difference, 2),
                "breakdown": {
                    "total_credits": round(total_credits, 2),
                    "mining": round(mining_total, 2),
                    "level_bonus": round(level_bonus_total, 2),
                    "referral_bonus": round(referral_total, 2),
                    "rain": round(rain_total, 2),
                    "other_credits": round(other_credits, 2),
                    "total_debits": round(total_debits, 2)
                },
                "needs_balance_fix": abs(difference) > 100,
                "needs_mined_fix": abs(mined_difference) > 100
            })
        
        # Summary
        needs_fix = [r for r in audit_results if r["needs_balance_fix"]]
        
        return {
            "success": True,
            "audit_time": now.isoformat(),
            "total_audited": len(audit_results),
            "needs_fix": len(needs_fix),
            "results": audit_results
        }
        
    except Exception as e:
        logging.error(f"[PRC AUDIT] Error: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/user-breakdown")
async def get_user_prc_breakdown(uid: str):
    """
    📊 Get detailed PRC breakdown for a specific user.
    Shows all sources of credits and debits.
    """
    try:
        user = await db.users.find_one({"uid": uid})
        if not user:
            return {"success": False, "error": "User not found"}
        
        # Get all transactions
        prc_txns = await db.prc_transactions.find({"user_id": uid}).sort("created_at", -1).to_list(1000)
        mining_records = await db.mining_history.find({"user_id": uid}).sort("timestamp", -1).to_list(500)
        bill_payments = await db.bill_payment_requests.find({"user_id": uid}).to_list(500)
        bank_withdrawals = await db.bank_withdrawal_requests.find({"user_id": uid}).to_list(500)
        bank_transfers = await db.bank_transfer_requests.find({"user_id": uid}).to_list(500)
        
        # Remove _id from all
        for txn in prc_txns + mining_records + bill_payments + bank_withdrawals + bank_transfers:
            txn.pop("_id", None)
        
        return {
            "success": True,
            "user": {
                "uid": uid,
                "name": user.get("name"),
                "prc_balance": user.get("prc_balance"),
                "total_mined": user.get("total_mined")
            },
            "transactions": {
                "prc_ledger": prc_txns[:200],
                "mining_history": mining_records[:100],
                "bill_payments": len(bill_payments),
                "bank_withdrawals": len(bank_withdrawals),
                "bank_transfers": len(bank_transfers)
            }
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


# ==================== END PRC BALANCE AUDIT ====================


# ==================== PRC BALANCE FIX API ====================

@router.post("/fix-100x-refund-bug")
async def fix_100x_refund_bug(dry_run: bool = True, limit: int = 500):
    """
    🔧 FIX: Correct the 100x refund bug.
    
    Bug: When bank withdrawals were rejected, refund was INR × 100 instead of INR × ~12 (with fees).
    Example: ₹9,500 rejection gave 9,50,000 PRC instead of ~1,14,000 PRC.
    
    This API:
    1. Finds all users with refund transactions
    2. Calculates excess = refunded - expected (INR × 12)
    3. Deducts excess from prc_balance
    
    Query Params:
    - dry_run: If True, only preview (default: True)
    - limit: Max users to process (default: 500)
    
    ⚠️ SET dry_run=false TO ACTUALLY APPLY FIXES
    """
    try:
        now = datetime.now(timezone.utc)
        import re
        
        # Find users with prc_transactions containing refunds
        users_with_refunds = await db.users.find({
            "prc_transactions.type": "refund"
        }).limit(limit).to_list(limit)
        
        results = {
            "total_checked": len(users_with_refunds),
            "fixed": 0,
            "skipped": 0,
            "total_excess_removed": 0,
            "dry_run": dry_run,
            "fixes": []
        }
        
        for user in users_with_refunds:
            uid = user.get("uid")
            name = user.get("name", "Unknown")
            current_balance = float(user.get("prc_balance", 0) or 0)
            
            prc_txns = user.get("prc_transactions", [])
            total_excess = 0
            refund_details = []
            
            for txn in prc_txns:
                if txn.get("type") == "refund":
                    amount = float(txn.get("amount", 0) or 0)
                    desc = txn.get("description", "")
                    
                    # Extract INR from description "...rejected - ₹9500"
                    match = re.search(r'₹(\d+)', desc)
                    if match:
                        inr_amount = float(match.group(1))
                        
                        # Expected PRC: INR × 12 (rate ~10 + 20% fee)
                        expected_prc = inr_amount * 12
                        
                        # If refunded > 5x expected, it's the 100x bug
                        if amount > expected_prc * 5:
                            excess = amount - expected_prc
                            total_excess += excess
                            refund_details.append({
                                "inr": inr_amount,
                                "refunded": amount,
                                "expected": expected_prc,
                                "excess": excess
                            })
            
            if total_excess > 1000:  # More than 1k excess
                new_balance = max(0, current_balance - total_excess)
                
                fix_record = {
                    "uid": uid,
                    "name": name,
                    "current_balance": round(current_balance, 2),
                    "excess_refund": round(total_excess, 2),
                    "new_balance": round(new_balance, 2),
                    "refunds_fixed": len(refund_details)
                }
                
                if not dry_run:
                    # Apply fix
                    await db.users.update_one(
                        {"uid": uid},
                        {
                            "$set": {
                                "prc_balance": round(new_balance, 2),
                                "refund_bug_fixed_at": now.isoformat(),
                                "refund_excess_removed": round(total_excess, 2)
                            }
                        }
                    )
                    
                    # Log correction
                    await db.balance_corrections.insert_one({
                        "user_id": uid,
                        "user_name": name,
                        "correction_type": "100x_refund_bug",
                        "old_balance": current_balance,
                        "new_balance": new_balance,
                        "excess_removed": total_excess,
                        "refund_details": refund_details,
                        "corrected_at": now.isoformat()
                    })
                    
                    fix_record["status"] = "fixed"
                else:
                    fix_record["status"] = "would_fix"
                
                results["fixes"].append(fix_record)
                results["fixed"] += 1
                results["total_excess_removed"] += total_excess
            else:
                results["skipped"] += 1
        
        return {
            "success": True,
            "message": "DRY RUN - No changes made" if dry_run else f"Fixed {results['fixed']} users",
            "summary": {
                "users_checked": results["total_checked"],
                "users_fixed": results["fixed"],
                "users_skipped": results["skipped"],
                "total_excess_removed": round(results["total_excess_removed"], 2)
            },
            "fixes": results["fixes"][:100]
        }
        
    except Exception as e:
        logging.error(f"[100x REFUND FIX] Error: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
async def fix_excess_balance(dry_run: bool = True, threshold: float = 50000, limit: int = 500):
    """
    🔧 FIX: Correct PRC balances where balance > total_mined + threshold.
    
    This fixes users who got excess PRC due to:
    - Bulk refund bug (100x refund amounts)
    - Double crediting
    - System errors
    
    Logic: Set balance = total_mined (since balance cannot exceed total earned)
    
    Query Params:
    - dry_run: If True, only preview (default: True)
    - threshold: Min excess to consider (default: 50000)
    - limit: Max users to process (default: 500)
    
    ⚠️ SET dry_run=false TO ACTUALLY APPLY FIXES
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Find ALL users with prc_balance
        all_users = await db.users.find({
            "prc_balance": {"$gt": 10000}
        }).sort("prc_balance", -1).limit(limit).to_list(limit)
        
        results = {
            "total_checked": len(all_users),
            "affected": 0,
            "fixed": 0,
            "skipped": 0,
            "total_excess_found": 0,
            "total_excess_removed": 0,
            "dry_run": dry_run,
            "fixes": []
        }
        
        for user in all_users:
            uid = user.get("uid")
            name = user.get("name", "Unknown")
            current_balance = float(user.get("prc_balance", 0) or 0)
            total_mined = float(user.get("total_mined", 0) or 0)
            
            # Calculate excess
            excess = current_balance - total_mined
            
            if excess > threshold:
                results["affected"] += 1
                results["total_excess_found"] += excess
                
                # New balance should be total_mined (max they could have)
                # But we need to account for legitimate referral bonuses
                # Let's estimate: referral bonus can be up to 30% of mined
                max_legitimate_bonus = total_mined * 0.3
                new_balance = total_mined + max_legitimate_bonus
                
                # If current balance is way more than this, it's a bug
                if current_balance > new_balance * 1.5:  # 50% buffer
                    excess_to_remove = current_balance - new_balance
                    final_balance = new_balance
                else:
                    # Within reasonable range, skip
                    results["skipped"] += 1
                    continue
                
                fix_record = {
                    "uid": uid,
                    "name": name,
                    "current_balance": round(current_balance, 2),
                    "total_mined": round(total_mined, 2),
                    "excess": round(excess, 2),
                    "new_balance": round(final_balance, 2),
                    "removed": round(excess_to_remove, 2)
                }
                
                if not dry_run:
                    # Apply fix
                    await db.users.update_one(
                        {"uid": uid},
                        {
                            "$set": {
                                "prc_balance": round(final_balance, 2),
                                "balance_corrected_at": now.isoformat(),
                                "balance_correction_reason": "Excess balance bug fix",
                                "old_balance_before_fix": current_balance
                            }
                        }
                    )
                    
                    # Log correction
                    await db.balance_corrections.insert_one({
                        "user_id": uid,
                        "user_name": name,
                        "old_balance": current_balance,
                        "new_balance": final_balance,
                        "excess_removed": excess_to_remove,
                        "total_mined": total_mined,
                        "corrected_at": now.isoformat(),
                        "reason": "Excess balance bug fix (balance >> total_mined)"
                    })
                    
                    fix_record["status"] = "fixed"
                    results["total_excess_removed"] += excess_to_remove
                else:
                    fix_record["status"] = "would_fix"
                    results["total_excess_removed"] += excess_to_remove
                
                results["fixes"].append(fix_record)
                results["fixed"] += 1
        
        return {
            "success": True,
            "message": "DRY RUN - No changes made" if dry_run else f"Fixed {results['fixed']} users",
            "summary": {
                "total_checked": results["total_checked"],
                "affected_users": results["affected"],
                "users_to_fix": results["fixed"],
                "users_skipped": results["skipped"],
                "total_excess_prc": round(results["total_excess_found"], 2),
                "excess_to_remove": round(results["total_excess_removed"], 2)
            },
            "fixes": results["fixes"][:50],  # First 50 for preview
            "note": f"Showing first 50 of {len(results['fixes'])} fixes" if len(results['fixes']) > 50 else None
        }
        
    except Exception as e:
        logging.error(f"[PRC FIX] Error: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/restore-original")
async def restore_original_balance(dry_run: bool = True, limit: int = 1000):
    """
    🚨 EMERGENCY RESTORE: Restore original PRC balances from backup data.
    
    This uses:
    1. balance_corrections collection (has old_balance logged)
    2. users.old_balance_before_fix field (backup of original balance)
    
    Query Params:
    - dry_run: If True, only preview (default: True)
    - limit: Max users to process (default: 1000)
    
    ⚠️ SET dry_run=false TO ACTUALLY RESTORE
    """
    try:
        now = datetime.now(timezone.utc)
        
        results = {
            "total_found": 0,
            "restored": 0,
            "errors": [],
            "dry_run": dry_run,
            "restores": []
        }
        
        # METHOD 1: Find users with old_balance_before_fix field
        users_with_backup = await db.users.find({
            "old_balance_before_fix": {"$exists": True, "$gt": 0}
        }).limit(limit).to_list(limit)
        
        results["total_found"] = len(users_with_backup)
        
        for user in users_with_backup:
            uid = user.get("uid")
            name = user.get("name", "Unknown")
            current_balance = float(user.get("prc_balance", 0) or 0)
            original_balance = float(user.get("old_balance_before_fix", 0) or 0)
            total_mined = float(user.get("total_mined", 0) or 0)
            
            restore_record = {
                "uid": uid,
                "name": name,
                "current_balance": round(current_balance, 2),
                "original_balance": round(original_balance, 2),
                "total_mined": round(total_mined, 2)
            }
            
            if not dry_run:
                # Restore original balance
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "prc_balance": original_balance,
                            "balance_restored_at": now.isoformat(),
                            "balance_restore_reason": "Emergency restore after incorrect deduction"
                        },
                        "$unset": {
                            "old_balance_before_fix": "",
                            "balance_corrected_at": "",
                            "balance_correction_reason": ""
                        }
                    }
                )
                
                # Log restore action
                await db.balance_restores.insert_one({
                    "user_id": uid,
                    "user_name": name,
                    "current_balance": current_balance,
                    "restored_balance": original_balance,
                    "restored_at": now.isoformat(),
                    "reason": "Emergency restore - incorrect fix applied"
                })
                
                restore_record["status"] = "restored"
                results["restored"] += 1
            else:
                restore_record["status"] = "would_restore"
                results["restored"] += 1
            
            results["restores"].append(restore_record)
        
        # METHOD 2: Also check balance_corrections collection
        corrections = await db.balance_corrections.find({}).to_list(1000)
        results["corrections_found"] = len(corrections)
        
        return {
            "success": True,
            "message": "DRY RUN - No changes made" if dry_run else f"Restored {results['restored']} users",
            "summary": {
                "users_with_backup_field": results["total_found"],
                "corrections_logged": results["corrections_found"],
                "users_restored": results["restored"]
            },
            "restores": results["restores"][:100],
            "note": f"Showing first 100 of {len(results['restores'])} restores" if len(results['restores']) > 100 else None
        }
        
    except Exception as e:
        logging.error(f"[PRC RESTORE] Error: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.post("/admin/upgrade-to-elite")
async def upgrade_pro_growth_to_elite(dry_run: bool = True):
    """
    Upgrade all 'pro' and 'growth' subscription users to 'elite'.
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Find all pro and growth users
        pro_users = await db.users.find({"subscription_plan": {"$in": ["pro", "Pro", "PRO"]}}).to_list(5000)
        growth_users = await db.users.find({"subscription_plan": {"$in": ["growth", "Growth", "GROWTH"]}}).to_list(5000)
        
        all_users = pro_users + growth_users
        
        results = {
            "pro_count": len(pro_users),
            "growth_count": len(growth_users),
            "total": len(all_users),
            "upgraded": 0,
            "dry_run": dry_run,
            "users": []
        }
        
        for user in all_users:
            uid = user.get("uid")
            old_plan = user.get("subscription_plan")
            
            user_record = {
                "uid": uid,
                "name": user.get("name", "Unknown"),
                "old_plan": old_plan,
                "new_plan": "elite"
            }
            
            if not dry_run:
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "subscription_plan": "elite",
                            "upgraded_from": old_plan,
                            "upgrade_date": now.isoformat()
                        }
                    }
                )
                user_record["status"] = "upgraded"
            else:
                user_record["status"] = "would_upgrade"
            
            results["upgraded"] += 1
            results["users"].append(user_record)
        
        return {
            "success": True,
            "message": "DRY RUN" if dry_run else f"Upgraded {results['upgraded']} users to elite",
            "summary": {
                "pro_users": results["pro_count"],
                "growth_users": results["growth_count"],
                "total_upgraded": results["upgraded"]
            },
            "users": results["users"][:50]
        }
        
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/fix-all-missing")
async def fix_all_missing_balance(dry_run: bool = True, skip: int = 0, limit: int = 100):
    """
    🚨 FIX ALL MISSING: Find ALL users where balance < total_mined and restore.
    
    This does NOT depend on balance_corrections collection.
    Uses total_mined as the source of truth.
    
    Formula: correct_balance = total_mined - legitimate_redemptions + 20% bonus
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Find users where balance seems too low compared to mined
        # We'll check all users and calculate what they SHOULD have
        all_users = await db.users.find({
            "total_mined": {"$gt": 10000}
        }).skip(skip).limit(limit).to_list(limit)
        
        results = {
            "processed": 0,
            "fixed": 0,
            "already_ok": 0,
            "errors": [],
            "fixes": []
        }
        
        for user in all_users:
            uid = user.get("uid")
            name = user.get("name", "Unknown")
            current_balance = float(user.get("prc_balance", 0) or 0)
            total_mined = float(user.get("total_mined", 0) or 0)
            already_fixed = user.get("all_missing_fixed_march2026", False)
            
            if already_fixed:
                results["already_ok"] += 1
                continue
            
            results["processed"] += 1
            
            # Calculate legitimate redemptions
            total_redeemed = 0
            
            # Subscriptions (active ones)
            subs = await db.subscriptions.find({"user_id": uid, "status": "active"}).to_list(100)
            sub_total = sum([float(s.get("prc_amount", 0) or 0) for s in subs])
            
            # Product orders (completed/processing)
            orders = await db.product_orders.find({"user_id": uid, "status": {"$in": ["completed", "processing"]}}).to_list(100)
            order_total = sum([float(o.get("prc_amount", 0) or 0) for o in orders])
            
            # Bank withdrawals (completed only)
            withdrawals = await db.bank_withdrawal_requests.find({"user_id": uid, "status": "completed"}).to_list(100)
            withdrawal_total = sum([float(w.get("prc_amount", 0) or 0) for w in withdrawals])
            
            total_redeemed = sub_total + order_total + withdrawal_total
            
            # Correct balance = mined - redeemed
            correct_balance = max(0, total_mined - total_redeemed)
            
            # Add 20% compensation
            compensation = round(correct_balance * 0.20, 2)
            final_balance = round(correct_balance + compensation, 2)
            
            # Only fix if current balance is significantly less than it should be
            # (more than 10% difference)
            if current_balance >= final_balance * 0.9:
                results["already_ok"] += 1
                continue
            
            fix_record = {
                "uid": uid,
                "name": name,
                "current_balance": round(current_balance, 2),
                "total_mined": round(total_mined, 2),
                "total_redeemed": round(total_redeemed, 2),
                "correct_balance": round(correct_balance, 2),
                "compensation_20pct": compensation,
                "final_balance": final_balance,
                "increase": round(final_balance - current_balance, 2)
            }
            
            if not dry_run:
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "prc_balance": final_balance,
                            "all_missing_fixed_march2026": True,
                            "fix_date": now.isoformat(),
                            "balance_before_fix": current_balance
                        }
                    }
                )
                
                # Log transaction
                credit = final_balance - current_balance
                if credit > 0:
                    await db.prc_transactions.insert_one({
                        "user_id": uid,
                        "type": "missing_balance_fix",
                        "amount": credit,
                        "description": f"Fix missing balance: mined={total_mined:,.0f}, redeemed={total_redeemed:,.0f}, +20% bonus",
                        "created_at": now.isoformat(),
                        "balance_after": final_balance
                    })
                
                fix_record["status"] = "fixed"
                results["fixed"] += 1
            else:
                fix_record["status"] = "would_fix"
                results["fixed"] += 1
            
            results["fixes"].append(fix_record)
        
        has_more = len(all_users) == limit
        
        return {
            "success": True,
            "message": "DRY RUN" if dry_run else f"Fixed {results['fixed']} users",
            "summary": {
                "processed": results["processed"],
                "fixed": results["fixed"],
                "already_ok": results["already_ok"],
                "errors": len(results["errors"])
            },
            "pagination": {
                "skip": skip,
                "next_skip": skip + limit if has_more else None,
                "has_more": has_more
            },
            "fixes": results["fixes"][:30]
        }
        
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/check-user/{uid}")
async def check_user_balance_data(uid: str):
    """Check all balance data for a specific user from all sources"""
    
    # Get user current data
    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        return {"error": "User not found"}
    
    # Get balance_corrections entry
    correction = await db.balance_corrections.find_one({"user_id": uid}, {"_id": 0})
    
    # Get balance_restores entries
    restores = await db.balance_restores.find({"user_id": uid}, {"_id": 0}).to_list(10)
    
    # Get old_balance_before_fix from user
    old_balance_field = user.get("old_balance_before_fix")
    
    # Calculate what balance SHOULD be
    total_mined = float(user.get("total_mined", 0) or 0)
    
    # Get legitimate redemptions
    total_redeemed = 0
    
    # Subscriptions
    subs = await db.subscriptions.find({"user_id": uid}).to_list(100)
    sub_total = sum([float(s.get("prc_amount", 0) or 0) for s in subs])
    
    # Orders
    orders = await db.product_orders.find({"user_id": uid, "status": {"$in": ["completed", "processing"]}}).to_list(100)
    order_total = sum([float(o.get("prc_amount", 0) or 0) for o in orders])
    
    # Withdrawals completed
    withdrawals = await db.bank_withdrawal_requests.find({"user_id": uid, "status": "completed"}).to_list(100)
    withdrawal_total = sum([float(w.get("prc_amount", 0) or 0) for w in withdrawals])
    
    total_redeemed = sub_total + order_total + withdrawal_total
    correct_balance = max(0, total_mined - total_redeemed)
    
    return {
        "user": {
            "uid": uid,
            "name": user.get("name"),
            "current_balance": round(float(user.get("prc_balance", 0) or 0), 2),
            "total_mined": round(total_mined, 2),
            "old_balance_before_fix_field": round(float(old_balance_field or 0), 2)
        },
        "balance_correction_entry": correction,
        "balance_restores": restores,
        "redemptions": {
            "subscriptions": round(sub_total, 2),
            "orders": round(order_total, 2),
            "withdrawals": round(withdrawal_total, 2),
            "total": round(total_redeemed, 2)
        },
        "calculated_correct_balance": round(correct_balance, 2),
        "difference": round(correct_balance - float(user.get("prc_balance", 0) or 0), 2)
    }


@router.get("/proper-restore")
async def proper_restore_all(dry_run: bool = True, skip: int = 0, limit: int = 100):
    """
    🚨 PROPER RESTORE: Restore balance from balance_corrections collection.
    
    For each user in balance_corrections:
    1. Get their old_balance from correction entry
    2. Set their prc_balance = old_balance
    3. Then add 20% compensation
    
    This is the CORRECT way - uses the saved original balances.
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Get corrections with pagination
        corrections = await db.balance_corrections.find({}).skip(skip).limit(limit).to_list(limit)
        
        if not corrections:
            return {
                "success": True,
                "message": "No more corrections to process",
                "processed": 0,
                "skip": skip,
                "done": True
            }
        
        results = {
            "processed": 0,
            "restored": 0,
            "already_ok": 0,
            "errors": [],
            "restores": []
        }
        
        for correction in corrections:
            uid = correction.get("user_id")
            original_balance = float(correction.get("old_balance", 0) or 0)
            
            # Get current user
            user = await db.users.find_one({"uid": uid})
            if not user:
                results["errors"].append({"uid": uid, "error": "User not found"})
                continue
            
            current_balance = float(user.get("prc_balance", 0) or 0)
            already_properly_restored = user.get("properly_restored_march2026", False)
            
            # Skip if already properly restored
            if already_properly_restored:
                results["already_ok"] += 1
                continue
            
            results["processed"] += 1
            
            # Calculate 20% compensation on ORIGINAL balance
            compensation_20pct = round(original_balance * 0.20, 2)
            final_balance = round(original_balance + compensation_20pct, 2)
            
            restore_record = {
                "uid": uid,
                "name": user.get("name", "Unknown"),
                "current_balance": round(current_balance, 2),
                "original_balance": round(original_balance, 2),
                "compensation_20pct": compensation_20pct,
                "final_balance": final_balance
            }
            
            if not dry_run:
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "prc_balance": final_balance,
                            "properly_restored_march2026": True,
                            "proper_restore_date": now.isoformat(),
                            "original_balance_restored": original_balance,
                            "compensation_20pct_applied": compensation_20pct
                        }
                    }
                )
                
                # Log transaction
                credit_amount = final_balance - current_balance
                if credit_amount > 0:
                    await db.prc_transactions.insert_one({
                        "user_id": uid,
                        "type": "proper_restore",
                        "amount": credit_amount,
                        "description": f"Proper balance restore ({original_balance:,.0f}) + 20% compensation ({compensation_20pct:,.0f})",
                        "created_at": now.isoformat(),
                        "balance_after": final_balance
                    })
                
                restore_record["status"] = "restored"
                results["restored"] += 1
            else:
                restore_record["status"] = "would_restore"
                results["restored"] += 1
            
            results["restores"].append(restore_record)
        
        has_more = len(corrections) == limit
        
        return {
            "success": True,
            "message": "DRY RUN" if dry_run else f"Restored {results['restored']} users",
            "summary": {
                "processed": results["processed"],
                "restored": results["restored"],
                "already_ok": results["already_ok"],
                "errors": len(results["errors"])
            },
            "pagination": {
                "skip": skip,
                "next_skip": skip + limit if has_more else None,
                "has_more": has_more
            },
            "restores": results["restores"][:30],
            "errors": results["errors"][:10] if results["errors"] else None
        }
        
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/mega-compensation")
async def mega_compensation(dry_run: bool = True, skip: int = 0, limit: int = 200):
    """
    🚨 MEGA COMPENSATION API - One-time fix for ALL users
    
    This API does:
    1. ALL USERS: Give 20% extra on current balance as compensation
    2. Zero balance users: First restore correct balance, then +20%
    3. Burn refund: Return all PRC burned due to subscription expiry (for paid users)
    
    Use skip/limit for batching to avoid timeout.
    
    ⚠️ SET dry_run=false TO ACTUALLY APPLY
    """
    try:
        now = datetime.now(timezone.utc)
        
        results = {
            "compensations": [],
            "burn_refunds": [],
            "summary": {
                "users_processed": 0,
                "users_compensated": 0,
                "total_20pct_bonus": 0,
                "zero_balance_restored": 0,
                "total_burn_refunded": 0,
                "grand_total_credited": 0
            },
            "dry_run": dry_run,
            "skip": skip,
            "limit": limit
        }
        
        # ========== PART 1: 20% Compensation for ALL Users ==========
        all_users = await db.users.find({
            "prc_balance": {"$gte": 0}
        }).skip(skip).limit(limit).to_list(limit)
        
        for user in all_users:
            uid = user.get("uid")
            name = user.get("name", "Unknown")
            current_balance = float(user.get("prc_balance", 0) or 0)
            total_mined = float(user.get("total_mined", 0) or 0)
            already_compensated = user.get("compensation_applied_march2026", False)
            
            # Skip if already compensated
            if already_compensated:
                continue
            
            results["summary"]["users_processed"] += 1
            
            # For zero balance users, first calculate correct balance
            restore_amount = 0
            if current_balance <= 0 and total_mined > 5000:
                # Calculate legitimate redemptions
                total_redeemed = 0
                
                subs = await db.subscriptions.find({"user_id": uid, "status": "active"}).to_list(100)
                for s in subs:
                    total_redeemed += float(s.get("prc_amount", 0) or 0)
                
                orders = await db.product_orders.find({"user_id": uid, "status": {"$in": ["completed", "processing"]}}).to_list(100)
                for o in orders:
                    total_redeemed += float(o.get("prc_amount", 0) or 0)
                
                withdrawals = await db.bank_withdrawal_requests.find({"user_id": uid, "status": "completed"}).to_list(100)
                for w in withdrawals:
                    total_redeemed += float(w.get("prc_amount", 0) or 0)
                
                correct_balance = max(0, total_mined - total_redeemed)
                restore_amount = correct_balance
                current_balance = correct_balance  # Use restored balance for 20% calc
                results["summary"]["zero_balance_restored"] += restore_amount
            
            # Calculate 20% bonus on current/restored balance
            bonus_20pct = round(current_balance * 0.20, 2)
            final_balance = round(current_balance + bonus_20pct, 2)
            
            comp_record = {
                "uid": uid,
                "name": name,
                "original_balance": round(float(user.get("prc_balance", 0) or 0), 2),
                "restored_amount": round(restore_amount, 2),
                "base_for_bonus": round(current_balance, 2),
                "bonus_20pct": bonus_20pct,
                "final_balance": final_balance
            }
            
            if not dry_run and (bonus_20pct > 0 or restore_amount > 0):
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "prc_balance": final_balance,
                            "compensation_applied_march2026": True,
                            "compensation_amount": bonus_20pct,
                            "compensation_date": now.isoformat()
                        }
                    }
                )
                
                # Log transaction
                total_credit = restore_amount + bonus_20pct
                if total_credit > 0:
                    await db.prc_transactions.insert_one({
                        "user_id": uid,
                        "type": "compensation",
                        "amount": total_credit,
                        "description": f"20% compensation bonus" + (f" + balance restore" if restore_amount > 0 else ""),
                        "created_at": now.isoformat(),
                        "balance_after": final_balance
                    })
                
                comp_record["status"] = "applied"
                results["summary"]["users_compensated"] += 1
                results["summary"]["total_20pct_bonus"] += bonus_20pct
            elif bonus_20pct <= 0 and restore_amount <= 0:
                comp_record["status"] = "skipped_no_balance"
            else:
                comp_record["status"] = "would_apply"
                results["summary"]["users_compensated"] += 1
                results["summary"]["total_20pct_bonus"] += bonus_20pct
            
            results["compensations"].append(comp_record)
        
        # ========== PART 2: Refund Burned PRC (only in first batch) ==========
        if skip == 0:
            burn_pipeline = [
                {"$match": {"type": {"$in": ["prc_burn", "auto_burn", "burn", "expired"]}}},
                {"$group": {
                    "_id": "$user_id",
                    "total_burned": {"$sum": {"$abs": "$amount"}},
                    "burn_count": {"$sum": 1}
                }},
                {"$match": {"total_burned": {"$gt": 100}}}
            ]
            
            burn_aggregation = await db.prc_transactions.aggregate(burn_pipeline).to_list(2000)
            
            for burn_record in burn_aggregation:
                uid = burn_record.get("_id")
                if not uid:
                    continue
                    
                total_burned = float(burn_record.get("total_burned", 0))
                
                user = await db.users.find_one({"uid": uid})
                if not user:
                    continue
                
                # Only refund burns for paid subscribers
                subscription_plan = user.get("subscription_plan", "explorer")
                if subscription_plan in ["vip", "elite", "pro"]:
                    current_balance = float(user.get("prc_balance", 0) or 0)
                    already_refunded = user.get("burn_refunded_march2026", False)
                    
                    if already_refunded:
                        continue
                    
                    refund_record = {
                        "uid": uid,
                        "name": user.get("name", "Unknown"),
                        "subscription_plan": subscription_plan,
                        "total_burned": round(total_burned, 2),
                        "current_balance": round(current_balance, 2)
                    }
                    
                    if not dry_run:
                        new_balance = current_balance + total_burned
                        await db.users.update_one(
                            {"uid": uid},
                            {
                                "$set": {
                                    "prc_balance": round(new_balance, 2),
                                    "burn_refunded_march2026": True,
                                    "burn_refund_amount": total_burned
                                }
                            }
                        )
                        
                        await db.prc_transactions.insert_one({
                            "user_id": uid,
                            "type": "burn_refund",
                            "amount": total_burned,
                            "description": f"Refund of burned PRC for paid subscriber",
                            "created_at": now.isoformat(),
                            "balance_after": round(new_balance, 2)
                        })
                        
                        refund_record["status"] = "refunded"
                        refund_record["new_balance"] = round(new_balance, 2)
                    else:
                        refund_record["status"] = "would_refund"
                        refund_record["new_balance"] = round(current_balance + total_burned, 2)
                    
                    results["burn_refunds"].append(refund_record)
                    results["summary"]["total_burn_refunded"] += total_burned
        
        # Grand total
        results["summary"]["grand_total_credited"] = round(
            results["summary"]["total_20pct_bonus"] + 
            results["summary"]["zero_balance_restored"] +
            results["summary"]["total_burn_refunded"], 2
        )
        
        # Check if more batches needed
        has_more = len(all_users) == limit
        
        return {
            "success": True,
            "message": "DRY RUN - No changes made" if dry_run else f"Batch {skip//limit + 1} applied",
            "summary": results["summary"],
            "compensations": results["compensations"][:30],
            "burn_refunds": results["burn_refunds"][:30] if skip == 0 else [],
            "pagination": {
                "current_skip": skip,
                "next_skip": skip + limit if has_more else None,
                "has_more": has_more
            }
        }
        
    except Exception as e:
        logging.error(f"[MEGA COMPENSATION] Error: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/fix-zero-balance")
async def fix_zero_balance_users(dry_run: bool = True, limit: int = 500):
    """
    🔧 FIX: Restore balance for users who have 0 balance but high total_mined.
    
    Sets balance = total_mined for affected users.
    Also checks balance_corrections and balance_restores for correct value.
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Find users with 0 balance but significant total_mined
        affected_users = await db.users.find({
            "prc_balance": {"$lte": 0},
            "total_mined": {"$gt": 10000}
        }).limit(limit).to_list(limit)
        
        results = {
            "found": len(affected_users),
            "fixed": 0,
            "dry_run": dry_run,
            "fixes": []
        }
        
        for user in affected_users:
            uid = user.get("uid")
            name = user.get("name", "Unknown")
            total_mined = float(user.get("total_mined", 0) or 0)
            current_balance = float(user.get("prc_balance", 0) or 0)
            
            # Determine correct balance - use total_mined as baseline
            # Then subtract any legitimate redemptions
            total_redeemed = 0
            
            # Check subscriptions
            subs = await db.subscriptions.find({"user_id": uid, "status": "active"}).to_list(100)
            for s in subs:
                total_redeemed += float(s.get("prc_amount", 0) or 0)
            
            # Check product orders
            orders = await db.product_orders.find({"user_id": uid, "status": {"$in": ["completed", "processing"]}}).to_list(100)
            for o in orders:
                total_redeemed += float(o.get("prc_amount", 0) or 0)
            
            # Check bank withdrawals (only completed)
            withdrawals = await db.bank_withdrawal_requests.find({"user_id": uid, "status": "completed"}).to_list(100)
            for w in withdrawals:
                total_redeemed += float(w.get("prc_amount", 0) or 0)
            
            # Correct balance = total_mined - total_redeemed
            correct_balance = max(0, total_mined - total_redeemed)
            
            fix_record = {
                "uid": uid,
                "name": name,
                "current_balance": round(current_balance, 2),
                "total_mined": round(total_mined, 2),
                "total_redeemed": round(total_redeemed, 2),
                "correct_balance": round(correct_balance, 2)
            }
            
            if not dry_run and correct_balance > 0:
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "prc_balance": round(correct_balance, 2),
                            "balance_fixed_at": now.isoformat(),
                            "balance_fix_reason": "zero_balance_recovery"
                        }
                    }
                )
                fix_record["status"] = "fixed"
                results["fixed"] += 1
            elif correct_balance <= 0:
                fix_record["status"] = "skipped_no_balance"
            else:
                fix_record["status"] = "would_fix"
                results["fixed"] += 1
            
            results["fixes"].append(fix_record)
        
        total_to_restore = sum([f.get("correct_balance", 0) for f in results["fixes"]])
        
        return {
            "success": True,
            "message": "DRY RUN" if dry_run else f"Fixed {results['fixed']} users",
            "summary": {
                "users_found": results["found"],
                "users_to_fix": results["fixed"],
                "total_prc_to_restore": round(total_to_restore, 2)
            },
            "fixes": results["fixes"]
        }
        
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/restore-batch")
async def restore_batch(skip: int = 0, limit: int = 100):
    """
    🚨 FAST BATCH RESTORE: Restore PRC balances in batches to avoid timeout.
    
    Query Params:
    - skip: Number of corrections to skip (for pagination)
    - limit: Number of users to restore per batch (default: 100)
    
    Run multiple times with increasing skip values:
    - First: ?skip=0&limit=100
    - Then: ?skip=100&limit=100
    - Then: ?skip=200&limit=100
    - Continue until restored=0
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Get batch of corrections
        corrections = await db.balance_corrections.find({}).skip(skip).limit(limit).to_list(limit)
        
        if not corrections:
            return {
                "success": True,
                "message": "No more corrections to restore",
                "restored": 0,
                "skip": skip,
                "done": True
            }
        
        restored_count = 0
        restores = []
        
        for correction in corrections:
            uid = correction.get("user_id")
            old_balance = float(correction.get("old_balance", 0) or 0)
            
            # Check if already restored
            user = await db.users.find_one({"uid": uid})
            if not user:
                continue
            
            current_balance = float(user.get("prc_balance", 0) or 0)
            
            # Skip if balance already matches (already restored)
            if abs(current_balance - old_balance) < 1:
                continue
            
            # Restore balance
            await db.users.update_one(
                {"uid": uid},
                {
                    "$set": {
                        "prc_balance": old_balance,
                        "balance_restored_at": now.isoformat()
                    }
                }
            )
            
            restores.append({
                "uid": uid,
                "name": user.get("name", "Unknown"),
                "old": round(current_balance, 2),
                "restored": round(old_balance, 2)
            })
            restored_count += 1
        
        return {
            "success": True,
            "message": f"Restored {restored_count} users in this batch",
            "restored": restored_count,
            "skip": skip,
            "next_skip": skip + limit,
            "done": len(corrections) < limit,
            "restores": restores
        }
        
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/restore-from-corrections")
async def restore_from_corrections_collection(dry_run: bool = True):
    """
    🚨 EMERGENCY RESTORE: Restore PRC balances from balance_corrections collection.
    
    This is a backup method if old_balance_before_fix field is not available.
    
    ⚠️ SET dry_run=false TO ACTUALLY RESTORE
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Get all corrections
        corrections = await db.balance_corrections.find({}).to_list(2000)
        
        results = {
            "total_corrections": len(corrections),
            "restored": 0,
            "errors": [],
            "dry_run": dry_run,
            "restores": []
        }
        
        for correction in corrections:
            uid = correction.get("user_id")
            old_balance = float(correction.get("old_balance", 0) or 0)
            
            # Get current user
            user = await db.users.find_one({"uid": uid})
            if not user:
                results["errors"].append({"uid": uid, "error": "User not found"})
                continue
            
            current_balance = float(user.get("prc_balance", 0) or 0)
            
            restore_record = {
                "uid": uid,
                "name": user.get("name", "Unknown"),
                "current_balance": round(current_balance, 2),
                "original_balance": round(old_balance, 2),
                "correction_date": correction.get("corrected_at")
            }
            
            if not dry_run:
                # Restore original balance
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "prc_balance": old_balance,
                            "balance_restored_at": now.isoformat(),
                            "balance_restore_reason": "Emergency restore from corrections log"
                        }
                    }
                )
                
                # Log restore
                await db.balance_restores.insert_one({
                    "user_id": uid,
                    "user_name": user.get("name"),
                    "current_balance": current_balance,
                    "restored_balance": old_balance,
                    "restored_at": now.isoformat(),
                    "source": "balance_corrections collection"
                })
                
                restore_record["status"] = "restored"
            else:
                restore_record["status"] = "would_restore"
            
            results["restores"].append(restore_record)
            results["restored"] += 1
        
        total_old = sum([r.get("original_balance", 0) for r in results["restores"]])
        total_current = sum([r.get("current_balance", 0) for r in results["restores"]])
        
        return {
            "success": True,
            "message": "DRY RUN - No changes made" if dry_run else f"Restored {results['restored']} users",
            "summary": {
                "corrections_found": results["total_corrections"],
                "users_restored": results["restored"],
                "total_original_balance": round(total_old, 2),
                "total_current_balance": round(total_current, 2),
                "balance_difference": round(total_old - total_current, 2)
            },
            "restores": results["restores"][:100],
            "errors": results["errors"][:20] if results["errors"] else None
        }
        
    except Exception as e:
        logging.error(f"[PRC RESTORE CORRECTIONS] Error: {e}")
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/refund-audit")
async def audit_refund_transactions(limit: int = 50):
    """
    🔍 AUDIT: Find all suspicious refund transactions.
    """
    try:
        # Find users with prc_transactions containing refunds
        users_with_refunds = await db.users.find({
            "prc_transactions.type": "refund"
        }).limit(limit).to_list(limit)
        
        suspicious = []
        
        for user in users_with_refunds:
            uid = user.get("uid")
            name = user.get("name", "Unknown")
            
            prc_txns = user.get("prc_transactions", [])
            for txn in prc_txns:
                if txn.get("type") == "refund":
                    amount = float(txn.get("amount", 0) or 0)
                    desc = txn.get("description", "")
                    
                    # Extract INR
                    import re
                    match = re.search(r'₹(\d+)', desc)
                    if match:
                        inr_amount = float(match.group(1))
                        expected = inr_amount * 12  # ~12 PRC per INR with fees
                        
                        if amount > expected * 5:  # 5x or more = suspicious
                            suspicious.append({
                                "uid": uid,
                                "name": name,
                                "inr_amount": inr_amount,
                                "prc_refunded": amount,
                                "expected_prc": expected,
                                "excess": amount - expected,
                                "multiplier": round(amount / expected, 1),
                                "timestamp": txn.get("timestamp"),
                                "description": desc
                            })
        
        # Sort by excess
        suspicious.sort(key=lambda x: -x["excess"])
        
        total_excess = sum(s["excess"] for s in suspicious)
        
        return {
            "success": True,
            "total_suspicious": len(suspicious),
            "total_excess_prc": total_excess,
            "suspicious_refunds": suspicious
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


# ==================== END PRC BALANCE FIX ====================


# ==================== END WEBHOOK AUTO-BURN ====================
