"""
PRC Statement API - Bank Passbook Style Ledger
Clean Credit/Debit statement with running balance
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
import logging

router = APIRouter(prefix="/prc-statement", tags=["PRC Statement"])

db = None
cache = None

def set_db(database, cache_client=None):
    global db, cache
    db = database
    cache = cache_client


TYPE_MAP = {
    "mining": "Reward", "mining_started": "Reward", "mining_collect": "Reward",
    "mining_reward": "Reward", "growth_reward": "Reward", "daily_reward": "Reward", "reward": "Reward",
    "credit": "Reward", "daily_streak": "Reward", "achievement": "Reward",
    "recharge": "Recharge", "mobile_recharge": "Recharge", "dth_recharge": "Recharge",
    "bill_payment": "Bill Pay", "electricity": "Bill Pay", "bill_pay": "Bill Pay", "bbps": "Bill Pay",
    "voucher": "Voucher Redeem", "gift_voucher": "Voucher Redeem", "gift_card": "Voucher Redeem",
    "bank_transfer": "Bank Redeem", "bank_redeem": "Bank Redeem", "bank_withdrawal": "Bank Redeem", "prc_to_bank": "Bank Redeem",
    "refund": "Refund", "reversal": "Refund",
    "withdrawal_refund": "Refund", "withdrawal_cancelled_refund": "Refund",
    "withdrawal_bulk_cancel_refund": "Refund", "withdrawal_selected_cancel_refund": "Refund",
    "dmt_refund": "Refund", "admin_refund": "Refund", "order_refund": "Refund",
    "prc_burn": "Burn", "burn": "Burn", "hourly_burn": "Burn",
    "admin_credit": "Admin Credit", "admin_debit": "Admin Debit", "admin_adjustment": "Admin",
    "test_credit": "Admin Credit", "test_debit": "Admin Debit",
    "subscription": "Subscription", "subscription_payment": "Subscription", "elite_activation": "Subscription",
    "subscription_prc": "Subscription", "subscription_refund": "Subscription",
    "gift_subscription": "Subscription",
    "redeem": "Redeem", "retry_debit": "Redeem",
    "dmt_transfer": "Redeem",
}

FILTER_CATEGORIES = ["All", "Reward", "Recharge", "Bill Pay", "Redeem", "Bank Redeem", "Voucher Redeem", "Subscription", "Refund", "Burn", "Admin"]


def classify_type(raw_type: str) -> str:
    if not raw_type:
        return "Other"
    return TYPE_MAP.get(raw_type.lower().strip(), "Other")


def determine_credit(doc: dict) -> bool:
    """
    Determine if a transaction is credit or debit.
    Priority: entry_type field > amount sign.
    - If entry_type exists → use it (credit=True, debit=False)
    - If entry_type absent → positive amount = credit, negative = debit
    """
    entry_type = doc.get("entry_type")
    if entry_type:
        return entry_type == "credit"
    return doc.get("amount", 0) > 0


def parse_date(val) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
    if isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        except Exception:
            return None
    return None


def build_narration(description: str, display_type: str) -> str:
    if display_type == "Reward":
        return "Daily Reward Collected"
    if description:
        desc = description.replace("Mining reward", "Daily Reward Collected")
        desc = desc.replace("Mining rewards claimed", "Daily Reward Collected")
        desc = desc.replace("Mining session collection", "Daily Reward Collected")
        return desc
    return display_type


@router.get("/{uid}")
async def get_prc_statement(
    uid: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=10, le=200),
    filter_type: str = Query("All"),
    sort_order: str = Query("desc", regex="^(asc|desc)$")
):
    """Get PRC statement - bank passbook style ledger."""
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        all_entries = []
        seen_txn_ids = set()

        # 1. prc_ledger (primary)
        for doc in await db.prc_ledger.find({"user_id": uid, "deleted": {"$ne": True}}, {"_id": 0}).to_list(5000):
            dt = parse_date(doc.get("timestamp") or doc.get("created_at"))
            if not dt:
                continue
            txn_id = doc.get("txn_id", "")
            display_type = classify_type(doc.get("type", ""))
            amount = abs(doc.get("amount", 0))
            is_credit = determine_credit(doc)
            all_entries.append({
                "date": dt.isoformat(), "date_ts": dt.timestamp(),
                "type": display_type,
                "narration": build_narration(doc.get("description", ""), display_type),
                "credit": round(amount, 2) if is_credit else 0,
                "debit": round(amount, 2) if not is_credit else 0,
                "balance": round(doc.get("balance_after", 0), 2),
                "txn_id": txn_id
            })
            if txn_id:
                seen_txn_ids.add(txn_id)

        # 2. transactions (burn, etc.)
        for doc in await db.transactions.find({"user_id": uid, "deleted": {"$ne": True}}, {"_id": 0}).to_list(5000):
            txn_id = doc.get("transaction_id", "")
            if txn_id in seen_txn_ids:
                continue
            dt = parse_date(doc.get("created_at") or doc.get("timestamp"))
            if not dt:
                continue
            amount = abs(doc.get("amount", 0))
            if amount == 0:
                continue
            display_type = classify_type(doc.get("type", ""))
            is_credit = determine_credit(doc)
            all_entries.append({
                "date": dt.isoformat(), "date_ts": dt.timestamp(),
                "type": display_type,
                "narration": build_narration(doc.get("description", ""), display_type),
                "credit": round(amount, 2) if is_credit else 0,
                "debit": round(amount, 2) if not is_credit else 0,
                "balance": round(doc.get("balance_after", 0), 2),
                "txn_id": txn_id
            })
            seen_txn_ids.add(txn_id)

        # 3. prc_transactions (auto-burn, admin credits/debits)
        for doc in await db.prc_transactions.find({"user_id": uid, "deleted": {"$ne": True}}, {"_id": 0}).to_list(5000):
            txn_id = doc.get("transaction_id", "") or doc.get("txn_id", "")
            if txn_id in seen_txn_ids:
                continue
            dt = parse_date(doc.get("created_at") or doc.get("timestamp"))
            if not dt:
                continue
            amount = abs(doc.get("amount", 0))
            if amount == 0:
                continue
            raw_type = doc.get("type", "") or doc.get("transaction_type", "")
            display_type = classify_type(raw_type)
            is_credit = determine_credit(doc)
            all_entries.append({
                "date": dt.isoformat(), "date_ts": dt.timestamp(),
                "type": display_type,
                "narration": build_narration(doc.get("description", ""), display_type),
                "credit": round(amount, 2) if is_credit else 0,
                "debit": round(amount, 2) if not is_credit else 0,
                "balance": round(doc.get("balance_after", 0), 2),
                "txn_id": txn_id
            })
            if txn_id:
                seen_txn_ids.add(txn_id)

        # 4. ledger
        for doc in await db.ledger.find({"user_id": uid, "deleted": {"$ne": True}}, {"_id": 0}).to_list(5000):
            txn_id = doc.get("txn_id", "")
            if txn_id in seen_txn_ids:
                continue
            dt = parse_date(doc.get("created_at"))
            if not dt:
                continue
            amount = abs(doc.get("amount", 0))
            if amount == 0:
                continue
            raw_type = doc.get("txn_type", "") or doc.get("type", "")
            display_type = classify_type(raw_type)
            is_credit = determine_credit(doc)
            all_entries.append({
                "date": dt.isoformat(), "date_ts": dt.timestamp(),
                "type": display_type,
                "narration": build_narration(doc.get("description", ""), display_type),
                "credit": round(amount, 2) if is_credit else 0,
                "debit": round(amount, 2) if not is_credit else 0,
                "balance": round(doc.get("balance_after", 0), 2),
                "txn_id": txn_id
            })
            seen_txn_ids.add(txn_id)

        # Sort
        all_entries.sort(key=lambda x: x["date_ts"], reverse=(sort_order == "desc"))

        # Totals (before filter)
        total_credit = sum(e["credit"] for e in all_entries)
        total_debit = sum(e["debit"] for e in all_entries)

        # Filter
        if filter_type and filter_type != "All":
            all_entries = [e for e in all_entries if e["type"] == filter_type]

        # Paginate
        total_count = len(all_entries)
        total_pages = max(1, (total_count + limit - 1) // limit)
        start = (page - 1) * limit
        page_entries = all_entries[start:start + limit]

        for e in page_entries:
            e.pop("date_ts", None)

        return {
            "success": True,
            "user_id": uid,
            "summary": {
                "total_earned": round(total_credit, 2),
                "total_used": round(total_debit, 2),
                "current_balance": round(user.get("prc_balance", 0), 2)
            },
            "filters": FILTER_CATEGORIES,
            "active_filter": filter_type,
            "entries": page_entries,
            "pagination": {
                "page": page, "limit": limit,
                "total_entries": total_count, "total_pages": total_pages
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[PRC-STATEMENT] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage-history/{uid}")
async def get_prc_usage_history(uid: str):
    """
    Date-wise PRC REDEEM usage history (services only, NO burns).
    Returns ONLY actual service usage: Mobile Recharge, Bank Redeem, Gift Cards,
    Subscription, Bill Pay, etc. — matching the dashboard 'USED' total exactly.
    """
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "created_at": 1, "registered_at": 1, "createdAt": 1, "prc_balance": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        join_date = user.get("created_at") or user.get("registered_at") or user.get("createdAt")
        if isinstance(join_date, str):
            try:
                join_date = datetime.fromisoformat(join_date.replace("Z", "+00:00"))
            except Exception:
                join_date = datetime.now(timezone.utc)
        
        # Same statuses as calculate_total_redeemed() in server.py
        success_statuses = [
            "completed", "COMPLETED", "Completed",
            "success", "SUCCESS", "Success",
            "approved", "APPROVED", "Approved",
            "paid", "PAID", "Paid",
            "pending", "PENDING", "Pending",
            "processing", "PROCESSING", "Processing",
            "delivered", "DELIVERED", "Delivered"
        ]
        
        # Service collection definitions matching calculate_total_redeemed()
        # Format: (collection, category, match_extra, amount_fields, date_fields, desc_fields)
        service_sources = [
            ("recharge_requests", "Mobile Recharge", {}, ["prc_used", "prc_amount", "total_prc_deducted", "amount"], ["created_at", "timestamp"], ["operator_name", "description"]),
            ("bill_payment_requests", "Bill Pay", {}, ["prc_used", "total_prc_deducted", "prc_amount", "amount"], ["created_at", "timestamp"], ["operator_name", "description", "service_type"]),
            ("bill_payments", "Bill Pay", {}, ["prc_used", "total_prc_deducted", "prc_amount"], ["created_at", "timestamp"], ["operator_name", "description"]),
            ("payment_requests", "Bill Pay", {}, ["total_prc_deducted", "prc_amount", "prc_used"], ["created_at", "timestamp"], ["description"]),
            ("gift_voucher_requests", "Gift Cards", {}, ["total_prc_deducted", "prc_amount", "prc_used", "amount"], ["created_at", "timestamp"], ["denomination", "description"]),
            ("redeem_requests", "Bank Redeem", {}, ["total_prc_deducted", "prc_amount", "total_prc", "amount_inr", "amount"], ["created_at", "timestamp"], ["description", "bank_name"]),
            ("bank_withdrawal_requests", "Bank Redeem", {}, ["total_prc_deducted", "prc_amount", "total_prc", "amount"], ["created_at", "timestamp"], ["description", "bank_name"]),
            ("bank_redeem_requests", "Bank Redeem", {}, ["prc_amount", "total_prc_deducted", "amount"], ["created_at", "timestamp"], ["description", "bank_name"]),
            ("bank_transfers", "Bank Redeem", {}, ["prc_amount", "total_prc_deducted", "amount"], ["created_at", "timestamp"], ["description", "bank_name"]),
            ("bank_transfer_requests", "Bank Redeem", {}, ["total_prc_deducted", "prc_deducted", "total_prc", "prc_amount"], ["created_at", "timestamp"], ["description", "bank_name"]),
            ("subscription_payments", "Subscription", {"payment_method": "prc"}, ["prc_amount", "inr_equivalent", "amount"], ["created_at", "timestamp", "approved_at"], ["plan_name", "subscription_plan", "description"]),
            ("vip_payments", "Subscription", {"payment_method": "prc"}, ["prc_amount", "prc_used", "amount"], ["created_at", "timestamp", "approved_at"], ["plan_name", "description"]),
            ("dmt_transactions", "Bank Redeem", {}, ["prc_deducted", "prc_amount", "total_prc", "amount"], ["created_at", "timestamp"], ["description", "beneficiary_name"]),
            ("dmt_logs", "Bank Redeem", {}, ["prc_deducted", "prc_amount", "amount"], ["created_at", "timestamp"], ["description"]),
            ("orders", "Shopping", {}, ["total_prc", "prc_amount", "prc_used", "amount"], ["created_at", "timestamp"], ["description", "product_name"]),
            ("unified_redemptions", "Redeem", {}, ["prc_deducted", "prc_amount", "total_prc", "amount"], ["created_at", "timestamp"], ["description", "service_type"]),
            ("loan_payments", "Loan EMI", {}, ["prc_amount", "prc_used", "amount"], ["created_at", "timestamp"], ["description"]),
        ]
        
        all_entries = []
        
        for coll_name, category, extra_match, amt_fields, dt_fields, desc_fields in service_sources:
            try:
                query = {"user_id": uid, "status": {"$in": success_statuses}}
                query.update(extra_match)
                docs = await db[coll_name].find(query, {"_id": 0}).to_list(5000)
                
                for doc in docs:
                    # Extract amount
                    amount = 0
                    for af in amt_fields:
                        val = doc.get(af)
                        if val and float(val) > 0:
                            amount = float(val)
                            break
                    if amount <= 0:
                        continue
                    
                    # Extract date
                    dt = None
                    for df in dt_fields:
                        raw = doc.get(df)
                        if raw:
                            dt = parse_date(raw)
                            if dt:
                                break
                    if not dt:
                        continue
                    
                    # Build narration
                    narration = ""
                    for dfield in desc_fields:
                        val = doc.get(dfield)
                        if val and isinstance(val, str) and len(val) > 1:
                            narration = val
                            break
                    if not narration:
                        narration = f"{category}"
                    
                    all_entries.append({
                        "date": dt.isoformat(),
                        "date_ts": dt.timestamp(),
                        "month_key": dt.strftime("%Y-%m"),
                        "day_key": dt.strftime("%Y-%m-%d"),
                        "category": category,
                        "amount": round(amount, 2),
                        "narration": narration,
                        "status": doc.get("status", ""),
                        "source": coll_name
                    })
            except Exception as e:
                logging.debug(f"[USAGE-HISTORY] Error querying {coll_name}: {e}")
                continue
        
        # Sort newest first
        all_entries.sort(key=lambda x: x["date_ts"], reverse=True)
        
        # Aggregate by category
        category_totals = {}
        total_used = 0
        for entry in all_entries:
            cat = entry["category"]
            category_totals[cat] = category_totals.get(cat, 0) + entry["amount"]
            total_used += entry["amount"]
        
        # Monthly aggregation for graph
        monthly_data = {}
        for entry in all_entries:
            mk = entry["month_key"]
            if mk not in monthly_data:
                monthly_data[mk] = {"month": mk, "total": 0, "count": 0}
            monthly_data[mk]["total"] += entry["amount"]
            monthly_data[mk]["count"] += 1
        
        graph_data = sorted(
            [{"month": k, "total": round(v["total"], 2), "count": v["count"]}
             for k, v in monthly_data.items()],
            key=lambda x: x["month"]
        )
        
        # Daily grouping
        daily_groups = {}
        for entry in all_entries:
            dk = entry["day_key"]
            if dk not in daily_groups:
                daily_groups[dk] = {"date": dk, "total": 0, "entries": []}
            daily_groups[dk]["total"] += entry["amount"]
            daily_groups[dk]["entries"].append({
                "time": entry["date"],
                "amount": entry["amount"],
                "category": entry["category"],
                "narration": entry["narration"],
                "status": entry["status"]
            })
        
        daily_list = sorted(
            [{"date": k, "total": round(v["total"], 2), "entries": v["entries"]}
             for k, v in daily_groups.items()],
            key=lambda x: x["date"], reverse=True
        )
        
        return {
            "success": True,
            "user_id": uid,
            "join_date": join_date.isoformat() if join_date else None,
            "summary": {
                "total_used": round(total_used, 2),
                "total_transactions": len(all_entries),
                "by_category": {k: round(v, 2) for k, v in sorted(category_totals.items(), key=lambda x: -x[1])},
                "months_active": len(graph_data)
            },
            "graph_data": graph_data,
            "daily_breakdown": daily_list
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[PRC USAGE HISTORY] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
