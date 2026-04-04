"""
PRC Audit Module
Complete audit trail of all PRC credits and debits for a user
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
import logging

router = APIRouter(prefix="/admin/audit", tags=["PRC Audit"])

db = None

def set_db(database):
    global db
    db = database


@router.get("/prc/{uid}")
async def full_prc_audit(uid: str, limit: int = Query(default=500, le=2000)):
    """
    Complete PRC audit for a user - traces EVERY credit and debit from ALL collections
    """
    try:
        # Get user
        user = await db.users.find_one({"uid": uid}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        audit_entries = []
        
        # ═══════════════════════════════════════════════════════════
        # 1. CREDITS - PRC earned
        # ═══════════════════════════════════════════════════════════
        
        # 1a. Mining rewards (from transactions)
        mining_txns = await db.transactions.find(
            {"user_id": uid, "type": {"$in": ["mining", "daily_reward", "mining_reward"]}},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(limit)
        for t in mining_txns:
            amt = abs(t.get("amount", 0) or t.get("prc_amount", 0) or 0)
            if amt > 0:
                audit_entries.append({
                    "date": str(t.get("timestamp") or t.get("created_at", "")),
                    "type": "CREDIT",
                    "category": "Mining",
                    "amount": round(amt, 2),
                    "description": t.get("description", "Mining reward"),
                    "source": "transactions"
                })
        
        # 1b. Referral bonuses
        ref_txns = await db.transactions.find(
            {"user_id": uid, "type": {"$in": ["referral_bonus", "referral", "signup_bonus", "reward", "prc_credit"]}},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(limit)
        for t in ref_txns:
            amt = abs(t.get("amount", 0) or t.get("prc_amount", 0) or 0)
            if amt > 0:
                audit_entries.append({
                    "date": str(t.get("timestamp") or t.get("created_at", "")),
                    "type": "CREDIT",
                    "category": "Bonus/Referral",
                    "amount": round(amt, 2),
                    "description": t.get("description", t.get("type", "Bonus")),
                    "source": "transactions"
                })
        
        # 1c. Refunds
        refund_txns = await db.transactions.find(
            {"user_id": uid, "type": {"$in": ["refund", "prc_refund"]}},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(limit)
        for t in refund_txns:
            amt = abs(t.get("amount", 0) or t.get("prc_amount", 0) or 0)
            if amt > 0:
                audit_entries.append({
                    "date": str(t.get("timestamp") or t.get("created_at", "")),
                    "type": "CREDIT",
                    "category": "Refund",
                    "amount": round(amt, 2),
                    "description": t.get("description", "Refund"),
                    "source": "transactions"
                })
        
        # 1d. PRC Ledger credits
        ledger_credits = await db.prc_ledger.find(
            {"user_id": uid, "type": "credit"},
            {"_id": 0}
        ).sort("created_at", 1).to_list(limit)
        for l in ledger_credits:
            amt = abs(l.get("amount", 0))
            if amt > 0:
                audit_entries.append({
                    "date": str(l.get("created_at", "")),
                    "type": "CREDIT",
                    "category": l.get("category", "Ledger Credit"),
                    "amount": round(amt, 2),
                    "description": l.get("description", l.get("narration", "PRC Credit")),
                    "source": "prc_ledger"
                })
        
        # 1e. Admin credits
        admin_credits = await db.transactions.find(
            {"user_id": uid, "type": {"$in": ["admin_credit", "admin_add", "manual_credit"]}},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(limit)
        for t in admin_credits:
            amt = abs(t.get("amount", 0) or t.get("prc_amount", 0) or 0)
            if amt > 0:
                audit_entries.append({
                    "date": str(t.get("timestamp") or t.get("created_at", "")),
                    "type": "CREDIT",
                    "category": "Admin Credit",
                    "amount": round(amt, 2),
                    "description": t.get("description", "Admin credit"),
                    "source": "transactions"
                })
        
        # ═══════════════════════════════════════════════════════════
        # 2. DEBITS - PRC spent/burned
        # ═══════════════════════════════════════════════════════════
        
        # 2a. Bill Payments
        bills = await db.bill_payment_requests.find(
            {"user_id": uid, "status": {"$in": ["completed", "approved", "pending"]}},
            {"_id": 0}
        ).sort("created_at", 1).to_list(limit)
        for b in bills:
            amt = abs(b.get("total_prc_deducted", 0) or b.get("prc_amount", 0) or 0)
            if amt > 0:
                audit_entries.append({
                    "date": str(b.get("created_at", "")),
                    "type": "DEBIT",
                    "category": "Bill Payment",
                    "amount": round(amt, 2),
                    "description": f"{b.get('service_type', 'Bill')} - {b.get('operator', '')} {b.get('customer_number', '')}",
                    "status": b.get("status", ""),
                    "source": "bill_payment_requests"
                })
        
        # 2b. Bank Withdrawals
        bank_wd = await db.bank_transfer_requests.find(
            {"user_id": uid, "status": {"$in": ["completed", "COMPLETED", "Completed", "approved", "APPROVED", "Approved", "pending", "PENDING", "Pending", "paid", "PAID", "Paid", "processing", "PROCESSING", "success", "SUCCESS", "delivered", "DELIVERED"]}},
            {"_id": 0}
        ).sort("created_at", 1).to_list(limit)
        for b in bank_wd:
            amt = abs(b.get("prc_deducted", 0) or b.get("prc_amount", 0) or 0)
            if amt > 0:
                audit_entries.append({
                    "date": str(b.get("created_at", "")),
                    "type": "DEBIT",
                    "category": "Bank Withdrawal",
                    "amount": round(amt, 2),
                    "description": f"Bank transfer ₹{b.get('withdrawal_amount', 0)} to {b.get('account_number', 'N/A')[-4:] if b.get('account_number') else 'N/A'}",
                    "status": b.get("status", ""),
                    "source": "bank_transfer_requests"
                })
        
        # 2c. Gift Vouchers
        vouchers = await db.gift_voucher_requests.find(
            {"user_id": uid, "status": {"$in": ["completed", "approved", "pending"]}},
            {"_id": 0}
        ).sort("created_at", 1).to_list(limit)
        for v in vouchers:
            amt = abs(v.get("total_prc_deducted", 0) or v.get("prc_amount", 0) or 0)
            if amt > 0:
                audit_entries.append({
                    "date": str(v.get("created_at", "")),
                    "type": "DEBIT",
                    "category": "Gift Voucher",
                    "amount": round(amt, 2),
                    "description": f"Voucher ₹{v.get('voucher_amount', 0)}",
                    "status": v.get("status", ""),
                    "source": "gift_voucher_requests"
                })
        
        # 2d. PRC Subscriptions
        prc_subs = await db.subscription_payments.find(
            {"user_id": uid, "payment_method": "prc", "status": {"$in": ["paid", "PAID", "Paid", "completed", "COMPLETED", "Completed"]}},
            {"_id": 0}
        ).sort("created_at", 1).to_list(limit)
        for s in prc_subs:
            amt = abs(s.get("prc_amount", 0))
            if amt > 0:
                audit_entries.append({
                    "date": str(s.get("created_at", "")),
                    "type": "DEBIT",
                    "category": "PRC Subscription",
                    "amount": round(amt, 2),
                    "description": f"Elite Subscription ({s.get('plan_name', 'elite')})",
                    "status": s.get("status", ""),
                    "source": "subscription_payments"
                })
        
        # 2e. DMT Transactions
        dmt = await db.dmt_transactions.find(
            {"user_id": uid, "status": {"$in": ["completed", "COMPLETED", "Completed", "success", "SUCCESS", "approved", "APPROVED", "paid", "PAID", "Paid", "pending", "PENDING", "Pending", "processing", "PROCESSING", "delivered", "DELIVERED"]}},
            {"_id": 0}
        ).sort("created_at", 1).to_list(limit)
        for d in dmt:
            amt = abs(d.get("prc_deducted", 0) or d.get("prc_amount", 0) or 0)
            if amt > 0:
                audit_entries.append({
                    "date": str(d.get("created_at", "")),
                    "type": "DEBIT",
                    "category": "DMT Transfer",
                    "amount": round(amt, 2),
                    "description": f"DMT ₹{d.get('amount', 0)} to {d.get('beneficiary_name', 'N/A')}",
                    "status": d.get("status", ""),
                    "source": "dmt_transactions"
                })
        
        # 2f. Unified Redemptions
        unified = await db.unified_redemptions.find(
            {"user_id": uid, "status": {"$in": ["completed", "COMPLETED", "Completed", "approved", "APPROVED", "Approved", "pending", "PENDING", "Pending", "paid", "PAID", "Paid", "processing", "PROCESSING", "success", "SUCCESS", "delivered", "DELIVERED"]}},
            {"_id": 0}
        ).sort("created_at", 1).to_list(limit)
        for u in unified:
            amt = abs(u.get("prc_deducted", 0) or u.get("prc_amount", 0) or 0)
            if amt > 0:
                audit_entries.append({
                    "date": str(u.get("created_at", "")),
                    "type": "DEBIT",
                    "category": f"Redeem ({u.get('service_type', 'N/A')})",
                    "amount": round(amt, 2),
                    "description": u.get("description", f"{u.get('service_type', '')} redeem"),
                    "status": u.get("status", ""),
                    "source": "unified_redemptions"
                })
        
        # 2g. Burns
        burns = await db.burn_logs.find(
            {"user_id": uid},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(limit)
        for b in burns:
            amt = abs(b.get("amount", 0))
            if amt > 0:
                audit_entries.append({
                    "date": str(b.get("timestamp") or b.get("created_at", "")),
                    "type": "DEBIT",
                    "category": "Burn",
                    "amount": round(amt, 2),
                    "description": b.get("reason", f"Auto-burn {b.get('burn_percent', 3.33)}%"),
                    "source": "burn_logs"
                })
        
        # 2h. PRC Ledger debits
        ledger_debits = await db.prc_ledger.find(
            {"user_id": uid, "type": "debit"},
            {"_id": 0}
        ).sort("created_at", 1).to_list(limit)
        for l in ledger_debits:
            amt = abs(l.get("amount", 0))
            if amt > 0:
                audit_entries.append({
                    "date": str(l.get("created_at", "")),
                    "type": "DEBIT",
                    "category": l.get("category", "Ledger Debit"),
                    "amount": round(amt, 2),
                    "description": l.get("description", l.get("narration", "PRC Debit")),
                    "source": "prc_ledger"
                })
        
        # 2i. Debit transactions (catch-all for negative amounts)
        debit_txns = await db.transactions.find(
            {"user_id": uid, "amount": {"$lt": 0}, "type": {"$nin": ["mining", "referral_bonus", "referral", "signup_bonus", "reward", "prc_credit", "refund", "prc_refund", "admin_credit", "admin_add", "manual_credit"]}},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(limit)
        for t in debit_txns:
            amt = abs(t.get("amount", 0))
            if amt > 0:
                audit_entries.append({
                    "date": str(t.get("timestamp") or t.get("created_at", "")),
                    "type": "DEBIT",
                    "category": t.get("type", "Transaction Debit"),
                    "amount": round(amt, 2),
                    "description": t.get("description", t.get("type", "Debit")),
                    "source": "transactions"
                })
        
        # ═══════════════════════════════════════════════════════════
        # Sort all entries by date
        # ═══════════════════════════════════════════════════════════
        audit_entries.sort(key=lambda x: x.get("date", ""))
        
        # Calculate running balance
        total_credits = sum(e["amount"] for e in audit_entries if e["type"] == "CREDIT")
        total_debits = sum(e["amount"] for e in audit_entries if e["type"] == "DEBIT")
        calculated_balance = round(total_credits - total_debits, 2)
        actual_balance = round(user.get("prc_balance", 0), 2)
        discrepancy = round(actual_balance - calculated_balance, 2)
        
        # Add running balance to entries
        running_balance = 0
        for entry in audit_entries:
            if entry["type"] == "CREDIT":
                running_balance += entry["amount"]
            else:
                running_balance -= entry["amount"]
            entry["running_balance"] = round(running_balance, 2)
        
        # Summary by category
        category_summary = {}
        for entry in audit_entries:
            cat = entry["category"]
            if cat not in category_summary:
                category_summary[cat] = {"credit": 0, "debit": 0, "count": 0}
            category_summary[cat]["count"] += 1
            if entry["type"] == "CREDIT":
                category_summary[cat]["credit"] += entry["amount"]
            else:
                category_summary[cat]["debit"] += entry["amount"]
        
        # Round category summaries
        for cat in category_summary:
            category_summary[cat]["credit"] = round(category_summary[cat]["credit"], 2)
            category_summary[cat]["debit"] = round(category_summary[cat]["debit"], 2)
        
        return {
            "user": {
                "uid": uid,
                "name": user.get("name", ""),
                "mobile": user.get("mobile", ""),
                "email": user.get("email", ""),
                "joined": str(user.get("created_at", "")),
                "subscription_plan": user.get("subscription_plan", "explorer"),
                "subscription_payment_type": user.get("subscription_payment_type", ""),
                "total_mined": round(user.get("total_mined", 0), 2),
            },
            "summary": {
                "total_credits": round(total_credits, 2),
                "total_debits": round(total_debits, 2),
                "calculated_balance": calculated_balance,
                "actual_balance": actual_balance,
                "discrepancy": discrepancy,
                "discrepancy_note": "MATCH" if abs(discrepancy) < 1 else f"MISMATCH: {discrepancy} PRC difference",
                "total_entries": len(audit_entries),
            },
            "category_summary": category_summary,
            "entries": audit_entries,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[PRC AUDIT] Error for {uid}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
