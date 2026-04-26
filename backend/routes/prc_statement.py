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
    "bill_payment_request": "Recharge",
    "bill_payment": "Bill Pay", "electricity": "Bill Pay", "bill_pay": "Bill Pay", "bbps": "Bill Pay",
    "voucher": "Voucher Redeem", "gift_voucher": "Voucher Redeem", "gift_card": "Voucher Redeem",
    "bank_transfer": "Bank Redeem", "bank_redeem": "Bank Redeem", "bank_withdrawal": "Bank Redeem", "prc_to_bank": "Bank Redeem",
    "refund": "Refund", "reversal": "Refund",
    "withdrawal_refund": "Refund", "withdrawal_cancelled_refund": "Refund",
    "withdrawal_bulk_cancel_refund": "Refund", "withdrawal_selected_cancel_refund": "Refund",
    "dmt_refund": "Refund", "admin_refund": "Refund", "order_refund": "Refund",
    "prc_burn": "Burn", "burn": "Burn", "hourly_burn": "Burn", "auto_burn": "Burn",
    "prc_burn_reversal": "Refund", "auto_burn_reversal": "Refund",
    "admin_credit": "Admin Credit", "admin_debit": "Admin Debit", "admin_adjustment": "Admin",
    "test_credit": "Admin Credit", "test_debit": "Admin Debit",
    "subscription": "Subscription", "subscription_payment": "Subscription", "elite_activation": "Subscription",
    "subscription_prc": "Subscription", "subscription_refund": "Subscription",
    "gift_subscription": "Subscription",
    "redeem": "Redeem", "retry_debit": "Redeem",
    "dmt_transfer": "Redeem",
    "core_team_bonus": "Core Team Bonus",
}

FILTER_CATEGORIES = ["All", "Reward", "Recharge", "Bill Pay", "Redeem", "Bank Redeem", "Voucher Redeem", "Subscription", "Refund", "Burn", "Admin", "Core Team Bonus"]


def classify_type(raw_type: str) -> str:
    if not raw_type:
        return "Other"
    return TYPE_MAP.get(raw_type.lower().strip(), "Other")


DEBIT_TYPES = {
    "bill_payment_request", "bill_payment", "order", "withdrawal",
    "admin_debit", "delivery_charge", "prc_burn", "gift_voucher_request",
    "prc_rain_loss", "recharge", "mobile_recharge", "dth_recharge",
    "bank_transfer", "bank_redeem", "bank_withdrawal", "prc_to_bank",
    "bank_withdrawal_request", "bank_redeem_request",
    "dmt_transfer", "redeem", "retry_debit", "burn", "hourly_burn",
    "auto_burn", "subscription", "subscription_payment", "subscription_prc",
    "elite_activation", "test_debit",
}


def determine_credit(doc: dict) -> bool:
    """
    Determine if a transaction is credit or debit.
    Priority: entry_type field > known debit types > amount sign.
    """
    entry_type = doc.get("entry_type")
    if entry_type:
        return entry_type == "credit"
    tx_type = (doc.get("type") or doc.get("transaction_type") or doc.get("txn_type") or "").lower().strip()
    if tx_type in DEBIT_TYPES:
        return False
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
            if txn_id and txn_id in seen_txn_ids:
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
            if txn_id:
                seen_txn_ids.add(txn_id)

        # 3. prc_transactions (auto-burn, admin credits/debits)
        for doc in await db.prc_transactions.find({"user_id": uid, "deleted": {"$ne": True}}, {"_id": 0}).to_list(5000):
            txn_id = doc.get("transaction_id", "") or doc.get("txn_id", "")
            if txn_id and txn_id in seen_txn_ids:
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
            if txn_id and txn_id in seen_txn_ids:
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
            if txn_id:
                seen_txn_ids.add(txn_id)

        # 5. subscription_payments (PRC method - debits not logged elsewhere)
        # Build set of existing subscription entries by date+amount for dedup
        existing_sub_keys = set()
        for e in all_entries:
            if e["type"] == "Subscription" and e["debit"] > 0:
                existing_sub_keys.add((round(e["date_ts"]), round(e["debit"])))
        
        for doc in await db.subscription_payments.find(
            {"user_id": uid, "payment_method": "prc"},
            {"_id": 0}
        ).to_list(500):
            payment_id = doc.get("payment_id", "")
            if payment_id and payment_id in seen_txn_ids:
                continue
            dt = parse_date(doc.get("created_at"))
            if not dt:
                continue
            amount = abs(doc.get("prc_amount", 0))
            if amount == 0:
                continue
            # Skip if same date+amount already exists (from transactions collection)
            key = (round(dt.timestamp()), round(amount))
            if key in existing_sub_keys:
                continue
            plan = doc.get("plan_name", "Elite")
            status = doc.get("status", "")
            suffix = "(Upcoming)" if status == "upcoming" else ""
            days = doc.get("duration_days", 28)
            all_entries.append({
                "date": dt.isoformat(), "date_ts": dt.timestamp(),
                "type": "Subscription",
                "narration": f"{plan.title()} Subscription ({days} days) {suffix}".strip(),
                "credit": 0,
                "debit": round(amount, 2),
                "balance": 0,
                "txn_id": payment_id or ""
            })
            if payment_id:
                seen_txn_ids.add(payment_id)

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

    Sources ALL entries directly from `get_user_all_time_redeemed(debug=True)`
    so the displayed TOTAL REDEEMED, by-category breakdown, daily entries,
    and the Home Dashboard "USED" card are ALWAYS in sync.

    Includes legacy orphan entries from `transactions` wallet log and
    `prc_ledger` (references not in service collections), shown under their
    detected category (or 'Admin Adjust' for admin_debit, 'Other' fallback).
    """
    try:
        user = await db.users.find_one(
            {"uid": uid},
            {"_id": 0, "created_at": 1, "registered_at": 1, "createdAt": 1, "prc_balance": 1},
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        join_date = user.get("created_at") or user.get("registered_at") or user.get("createdAt")
        if isinstance(join_date, str):
            try:
                join_date = datetime.fromisoformat(join_date.replace("Z", "+00:00"))
            except Exception:
                join_date = datetime.now(timezone.utc)

        # Pull every counted debit from the SAME canonical aggregator that
        # produces the Home Dashboard "USED" number. Guaranteed consistency.
        from server import get_user_all_time_redeemed
        total, info = await get_user_all_time_redeemed(uid, debug=True)

        # Keep only non-dedup entries (actual counted)
        counted_entries = [e for e in info.get("entries", []) if "dedup" not in str(e.get("type", ""))]

        all_entries = []
        for e in counted_entries:
            ts_raw = e.get("ts") or ""
            dt = parse_date(ts_raw) if ts_raw else None
            if not dt:
                dt = datetime.now(timezone.utc)
            all_entries.append({
                "date": dt.isoformat(),
                "date_ts": dt.timestamp(),
                "month_key": dt.strftime("%Y-%m"),
                "day_key": dt.strftime("%Y-%m-%d"),
                "category": e.get("category") or "Other",
                "amount": round(float(e.get("amount_prc") or 0), 2),
                "narration": (e.get("narration") or e.get("category") or "Redeem")[:120],
                "status": e.get("status") or "completed",
                "source": e.get("source") or "service",
                "ref": e.get("ref"),
            })

        # Sort newest first
        all_entries.sort(key=lambda x: x["date_ts"], reverse=True)

        # Aggregate by category (guaranteed to sum to `total`)
        category_totals = {}
        for entry in all_entries:
            cat = entry["category"]
            category_totals[cat] = category_totals.get(cat, 0) + entry["amount"]

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
            key=lambda x: x["month"],
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
                "status": entry["status"],
                "source": entry["source"],
                "ref": entry.get("ref"),
            })

        daily_list = sorted(
            [{"date": k, "total": round(v["total"], 2), "entries": v["entries"]}
             for k, v in daily_groups.items()],
            key=lambda x: x["date"], reverse=True,
        )

        return {
            "success": True,
            "user_id": uid,
            "join_date": join_date.isoformat() if join_date else None,
            "summary": {
                "total_used": round(total, 2),
                # Kept for backward compatibility; now identical to total_used
                "total_used_service_sum": round(total, 2),
                "total_transactions": len(all_entries),
                "by_category": {
                    k: round(v, 2)
                    for k, v in sorted(category_totals.items(), key=lambda x: -x[1])
                },
                "months_active": len(graph_data),
            },
            "graph_data": graph_data,
            "daily_breakdown": daily_list,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[PRC USAGE HISTORY] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
