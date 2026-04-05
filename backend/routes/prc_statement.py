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
