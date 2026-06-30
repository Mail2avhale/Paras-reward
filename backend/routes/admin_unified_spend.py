"""
admin_unified_spend.py
======================
Single source of truth for "how much PRC / INR has a user used?" across the
two unified categories (Bank Redeem + Recharge/Utility) after the
2026-06-30 unification migration.

All data lives in `redeem_requests`. Legacy collections have been archived
under `_archive_2026_06_30_*` and are NOT read here.

Routes
------
GET  /api/admin/unified-spend/summary           — global category totals
GET  /api/admin/unified-spend/user/{uid}        — per-user breakdown
GET  /api/admin/unified-spend/top-spenders      — top N spenders combined
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from server import get_current_user

router = APIRouter(prefix="/api/admin/unified-spend", tags=["admin-unified-spend"])

db = None


def set_db(database):
    global db
    db = database


# --- Service-type taxonomy ---
BANK_TYPES = ["bank_transfer", "bank_withdrawal", "dmt", "emi"]
UTILITY_TYPES = [
    "mobile_recharge", "mobile_prepaid", "mobile_postpaid", "dth",
    "electricity", "gas", "water", "broadband", "landline", "lpg",
]
SUCCESS_STATUSES = ["COMPLETED", "Paid", "completed", "SUCCESS", "success"]


def _admin_only(user: dict):
    if not user or user.get("role") not in ("admin", "ADMIN"):
        raise HTTPException(403, "Admin only")


def _category_match(category: Optional[str]):
    """Map URL filter ('bank' | 'utility' | None) → mongo $in list."""
    if category == "bank":
        return {"$in": BANK_TYPES}
    if category == "utility":
        return {"$in": UTILITY_TYPES}
    return {"$in": BANK_TYPES + UTILITY_TYPES}


@router.get("/summary")
async def global_summary(
    category: Optional[str] = Query(None, description="bank | utility | (omit for both)"),
    only_success: bool = Query(False),
    user: dict = Depends(get_current_user),
):
    """Global totals: how much has been spent across all users."""
    _admin_only(user)
    match = {"service_type": _category_match(category)}
    if only_success:
        match["status"] = {"$in": SUCCESS_STATUSES}

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$service_type",
            "txns": {"$sum": 1},
            "inr": {"$sum": "$amount_inr"},
            "prc": {"$sum": "$total_prc_deducted"},
            "users": {"$addToSet": "$user_id"},
        }},
        {"$project": {
            "service_type": "$_id", "_id": 0,
            "txns": 1, "inr": 1, "prc": 1,
            "unique_users": {"$size": "$users"},
            "category": {
                "$cond": [{"$in": ["$_id", BANK_TYPES]}, "bank", "utility"]
            },
        }},
        {"$sort": {"inr": -1}},
    ]
    rows = await db.redeem_requests.aggregate(pipeline).to_list(50)

    # Roll-up totals
    bank_total = sum(r["inr"] or 0 for r in rows if r["category"] == "bank")
    util_total = sum(r["inr"] or 0 for r in rows if r["category"] == "utility")
    return {
        "success": True,
        "category_filter": category,
        "only_success": only_success,
        "rows": rows,
        "totals": {
            "bank_inr": round(bank_total, 2),
            "utility_inr": round(util_total, 2),
            "grand_total_inr": round(bank_total + util_total, 2),
        },
    }


@router.get("/user/{uid}")
async def user_spend(
    uid: str,
    only_success: bool = Query(False),
    user: dict = Depends(get_current_user),
):
    """Exact amount this user has used across Bank Redeem + Recharge/Utility.
    Returns category breakdown, per-service_type breakdown, and a recent
    transaction list.
    """
    _admin_only(user)
    base = {"user_id": uid, "service_type": _category_match(None)}
    if only_success:
        base["status"] = {"$in": SUCCESS_STATUSES}

    # Category-level rollup
    pipeline = [
        {"$match": base},
        {"$group": {
            "_id": "$service_type",
            "txns": {"$sum": 1},
            "inr": {"$sum": "$amount_inr"},
            "prc": {"$sum": "$total_prc_deducted"},
            "completed": {"$sum": {"$cond": [{"$in": ["$status", SUCCESS_STATUSES]}, 1, 0]}},
            "failed": {"$sum": {"$cond": [{"$in": ["$status", ["failed", "rejected", "retry_failed"]]}, 1, 0]}},
        }},
        {"$project": {
            "service_type": "$_id", "_id": 0,
            "txns": 1, "completed": 1, "failed": 1, "inr": 1, "prc": 1,
            "category": {"$cond": [{"$in": ["$_id", BANK_TYPES]}, "bank", "utility"]},
        }},
        {"$sort": {"inr": -1}},
    ]
    by_service = await db.redeem_requests.aggregate(pipeline).to_list(50)
    bank_inr = sum(r["inr"] or 0 for r in by_service if r["category"] == "bank")
    util_inr = sum(r["inr"] or 0 for r in by_service if r["category"] == "utility")
    bank_prc = sum(r["prc"] or 0 for r in by_service if r["category"] == "bank")
    util_prc = sum(r["prc"] or 0 for r in by_service if r["category"] == "utility")

    # Recent transactions (top 20)
    recent_cursor = db.redeem_requests.find(
        base,
        {
            "_id": 0, "request_id": 1, "service_type": 1, "service_name": 1,
            "amount_inr": 1, "total_prc_deducted": 1, "status": 1,
            "created_at": 1, "_migrated_from": 1,
        },
    ).sort("created_at", -1).limit(20)
    recent = []
    async for d in recent_cursor:
        ca = d.get("created_at")
        if ca and hasattr(ca, "isoformat"):
            d["created_at"] = ca.isoformat()
        d["category"] = "bank" if d.get("service_type") in BANK_TYPES else "utility"
        recent.append(d)

    # Pull user profile snippet for display
    u = await db.users.find_one({"uid": uid}, {"_id": 0, "name": 1, "mobile": 1, "email": 1}) or {}

    return {
        "success": True,
        "uid": uid,
        "user": u,
        "totals": {
            "bank_inr": round(bank_inr, 2),
            "bank_prc": round(bank_prc, 2),
            "utility_inr": round(util_inr, 2),
            "utility_prc": round(util_prc, 2),
            "grand_inr": round(bank_inr + util_inr, 2),
            "grand_prc": round(bank_prc + util_prc, 2),
        },
        "by_service_type": by_service,
        "recent": recent,
    }


@router.get("/top-spenders")
async def top_spenders(
    limit: int = Query(20, ge=1, le=200),
    category: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """Leaderboard of biggest spenders. Useful for admin retention analysis."""
    _admin_only(user)
    match = {"service_type": _category_match(category), "status": {"$in": SUCCESS_STATUSES}}
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$user_id",
            "txns": {"$sum": 1},
            "inr": {"$sum": "$amount_inr"},
            "prc": {"$sum": "$total_prc_deducted"},
        }},
        {"$sort": {"inr": -1}},
        {"$limit": limit},
    ]
    rows = await db.redeem_requests.aggregate(pipeline).to_list(limit)

    # Hydrate users
    uids = [r["_id"] for r in rows if r.get("_id")]
    users = await db.users.find(
        {"uid": {"$in": uids}},
        {"_id": 0, "uid": 1, "name": 1, "mobile": 1}
    ).to_list(len(uids) or 1)
    umap = {u["uid"]: u for u in users}

    return {
        "success": True,
        "category": category,
        "rows": [
            {
                "uid": r["_id"],
                "name": (umap.get(r["_id"]) or {}).get("name", "Unknown"),
                "mobile": (umap.get(r["_id"]) or {}).get("mobile", ""),
                "txns": r["txns"],
                "inr": round(r["inr"] or 0, 2),
                "prc": round(r["prc"] or 0, 2),
            }
            for r in rows
        ],
    }


# =============================================================================
# Scheduled mirror — keeps redeem_requests in sync with legacy collections so
# the admin's unified-spend endpoints always reflect the latest activity. The
# main migrate.py script is the source of truth for mapping logic; this is a
# thin async wrapper that calls those same mappers.
# Runs every 15 minutes via APScheduler (see server.py).
# =============================================================================
LEGACY_COLLECTIONS = [
    "bank_transfer_requests",
    "bank_withdrawal_requests",
    "chatbot_withdrawal_requests",
    "recharge_transactions",
    "bill_payment_requests",
]


def _strip_none(d):
    if isinstance(d, dict):
        return {k: _strip_none(v) for k, v in d.items() if v is not None}
    if isinstance(d, list):
        return [_strip_none(x) for x in d]
    return d


async def sync_legacy_to_unified_redeem():
    """Idempotent: re-applies migrate.py mappers and inserts any rows that
    aren't yet in `redeem_requests` (keyed by _legacy_request_id)."""
    if db is None:
        return
    # Import the mappers from migrate.py to keep ONE source of truth
    import sys
    from pathlib import Path
    mig_dir = Path(__file__).resolve().parents[1] / "migrations" / "2026_06_30_unify_redeem_collections"
    if str(mig_dir) not in sys.path:
        sys.path.insert(0, str(mig_dir))
    from migrate import (  # type: ignore[import-not-found]
        map_bank_transfer, map_bank_withdrawal, map_chatbot_withdrawal,
        map_recharge_transaction, map_bill_payment,
    )
    from datetime import datetime, timezone

    mappers = {
        "bank_transfer_requests": map_bank_transfer,
        "bank_withdrawal_requests": map_bank_withdrawal,
        "chatbot_withdrawal_requests": map_chatbot_withdrawal,
        "recharge_transactions": map_recharge_transaction,
        "bill_payment_requests": map_bill_payment,
    }

    already = set()
    async for d in db.redeem_requests.find(
        {"_legacy_request_id": {"$exists": True}},
        {"_legacy_request_id": 1, "_id": 0},
    ):
        already.add(d["_legacy_request_id"])

    inserted = 0
    now = datetime.now(timezone.utc)
    for src, mapper in mappers.items():
        async for d in db[src].find({}):
            mapped = _strip_none(mapper(d))
            legacy_rid = mapped.get("request_id") or str(d.get("_id"))
            if legacy_rid in already:
                continue
            mapped["_migrated_from"] = src
            mapped["_migration_date"] = now
            mapped["_legacy_id"] = str(d.get("_id"))
            mapped["_legacy_request_id"] = legacy_rid
            mapped.setdefault("created_at", now)
            await db.redeem_requests.insert_one(mapped)
            already.add(legacy_rid)
            inserted += 1

    if inserted:
        import logging
        logging.info(f"[unified-spend-sync] mirrored {inserted} new legacy rows → redeem_requests")
