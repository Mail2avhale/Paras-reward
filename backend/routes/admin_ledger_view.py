"""
PARAS REWARD - Admin Ledger Routes
==================================
Admin endpoints for viewing and managing ledger entries.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/admin/ledger", tags=["Admin - Ledger"])

# Database (set from server.py)
db = None

def set_db(database):
    global db
    db = database


@router.get("/entries")
async def get_ledger_entries(
    user_id: Optional[str] = None,
    txn_type: Optional[str] = None,
    entry_type: Optional[str] = None,
    days: int = Query(default=7, ge=1, le=90),
    limit: int = Query(default=100, ge=1, le=1000),
    skip: int = Query(default=0, ge=0)
):
    """
    Get ledger entries with filters.
    
    - user_id: Filter by specific user
    - txn_type: Filter by transaction type (mining, withdrawal, referral, etc.)
    - entry_type: Filter by credit or debit
    - days: Number of days to look back (default 7)
    - limit: Max results (default 100)
    - skip: Pagination offset
    """
    # Build query
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    
    if txn_type:
        query["txn_type"] = txn_type
    
    if entry_type:
        query["entry_type"] = entry_type
    
    # Date filter
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    query["created_at"] = {"$gte": cutoff}
    
    # Execute query
    entries = await db.ledger.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.ledger.count_documents(query)
    
    return {
        "success": True,
        "entries": entries,
        "total": total,
        "has_more": total > skip + limit,
        "filters": {
            "user_id": user_id,
            "txn_type": txn_type,
            "entry_type": entry_type,
            "days": days
        }
    }


@router.get("/summary")
async def get_ledger_summary(days: int = Query(default=7, ge=1, le=90)):
    """
    Get ledger summary statistics.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Aggregation pipeline
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": {
                "txn_type": "$txn_type",
                "entry_type": "$entry_type"
            },
            "total_amount": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total_amount": -1}}
    ]
    
    results = await db.ledger.aggregate(pipeline).to_list(100)
    
    # Calculate totals
    total_credits = sum(r["total_amount"] for r in results if r["_id"]["entry_type"] == "credit")
    total_debits = sum(r["total_amount"] for r in results if r["_id"]["entry_type"] == "debit")
    total_entries = sum(r["count"] for r in results)
    
    # Format results
    by_type = {}
    for r in results:
        txn_type = r["_id"]["txn_type"]
        entry_type = r["_id"]["entry_type"]
        
        if txn_type not in by_type:
            by_type[txn_type] = {"credits": 0, "debits": 0, "count": 0}
        
        if entry_type == "credit":
            by_type[txn_type]["credits"] = r["total_amount"]
        else:
            by_type[txn_type]["debits"] = r["total_amount"]
        by_type[txn_type]["count"] += r["count"]
    
    return {
        "success": True,
        "summary": {
            "total_credits": round(total_credits, 2),
            "total_debits": round(total_debits, 2),
            "net_flow": round(total_credits - total_debits, 2),
            "total_entries": total_entries,
            "days": days
        },
        "by_type": by_type
    }


@router.get("/user/{user_id}")
async def get_user_ledger(
    user_id: str,
    limit: int = Query(default=50, ge=1, le=500)
):
    """
    Get complete ledger history for a specific user.
    """
    # Get user info
    user = await db.users.find_one(
        {"uid": user_id},
        {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "prc_balance": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get ledger entries
    entries = await db.ledger.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate stats
    total_credits = sum(e["amount"] for e in entries if e["entry_type"] == "credit")
    total_debits = sum(e["amount"] for e in entries if e["entry_type"] == "debit")
    
    return {
        "success": True,
        "user": user,
        "ledger": {
            "entries": entries,
            "count": len(entries),
            "total_credits": round(total_credits, 2),
            "total_debits": round(total_debits, 2),
            "current_balance": user.get("prc_balance", 0)
        }
    }


@router.get("/recent")
async def get_recent_activity(limit: int = Query(default=20, ge=1, le=100)):
    """
    Get most recent ledger activity across all users.
    """
    entries = await db.ledger.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with user names
    user_ids = list(set(e.get("user_id") for e in entries if e.get("user_id")))
    users = {}
    if user_ids:
        user_docs = await db.users.find(
            {"uid": {"$in": user_ids}},
            {"_id": 0, "uid": 1, "name": 1}
        ).to_list(len(user_ids))
        users = {u["uid"]: u.get("name", "Unknown") for u in user_docs}
    
    # Add user names to entries
    for entry in entries:
        entry["user_name"] = users.get(entry.get("user_id"), "Unknown")
    
    return {
        "success": True,
        "entries": entries
    }
