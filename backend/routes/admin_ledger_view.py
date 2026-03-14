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


@router.get("/diagnose-prc-double/{user_id}")
async def diagnose_prc_double(user_id: str):
    """
    DIAGNOSTIC: Investigate PRC double credit issue for a specific user.
    
    This endpoint analyzes:
    1. User's embedded prc_transactions for duplicates
    2. prc_ledger entries
    3. Main ledger entries
    4. Recent redeem/withdrawal requests
    5. Mining sessions
    6. Transactions collection
    
    Use this to find the root cause of PRC double credit issues.
    """
    import logging
    
    result = {
        "user_id": user_id,
        "diagnosis": {},
        "issues_found": [],
        "recommendations": []
    }
    
    # 1. Get user details
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result["user_info"] = {
        "name": user.get("name"),
        "mobile": user.get("mobile"),
        "prc_balance": user.get("prc_balance", 0),
        "subscription_plan": user.get("subscription_plan")
    }
    
    # 2. Analyze embedded prc_transactions for duplicates
    txns = user.get("prc_transactions", [])
    ref_counts = {}
    for t in txns:
        ref = t.get("reference", t.get("txn_id", 'NO_REF'))
        if ref not in ref_counts:
            ref_counts[ref] = []
        ref_counts[ref].append(t)
    
    duplicates = {k: v for k, v in ref_counts.items() if len(v) > 1}
    
    result["diagnosis"]["prc_transactions"] = {
        "total_count": len(txns),
        "duplicate_references": len(duplicates),
        "duplicates_detail": []
    }
    
    total_extra_credit = 0
    for ref, items in duplicates.items():
        total_amt = sum(i.get("amount", 0) for i in items)
        expected = items[0].get("amount", 0)
        extra = total_amt - expected if total_amt > expected else 0
        total_extra_credit += extra
        
        result["diagnosis"]["prc_transactions"]["duplicates_detail"].append({
            "reference": ref,
            "count": len(items),
            "total_amount": total_amt,
            "expected": expected,
            "extra_credit": extra,
            "entries": [{"type": i.get("type"), "amount": i.get("amount"), "timestamp": i.get("timestamp")} for i in items]
        })
    
    if total_extra_credit > 0:
        result["issues_found"].append(f"DUPLICATE PRC TRANSACTIONS: Extra {total_extra_credit:,.2f} PRC credited due to duplicate entries")
    
    # 3. Check prc_ledger
    prc_ledger = await db.prc_ledger.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    prc_ledger_refs = {}
    for e in prc_ledger:
        ref = e.get("reference", "NO_REF")
        if ref not in prc_ledger_refs:
            prc_ledger_refs[ref] = []
        prc_ledger_refs[ref].append(e)
    
    prc_ledger_dupes = {k: v for k, v in prc_ledger_refs.items() if len(v) > 1}
    
    result["diagnosis"]["prc_ledger"] = {
        "total_entries": len(prc_ledger),
        "duplicate_references": len(prc_ledger_dupes)
    }
    
    if prc_ledger_dupes:
        result["issues_found"].append(f"PRC_LEDGER has {len(prc_ledger_dupes)} duplicate references")
    
    # 4. Check main ledger
    main_ledger = await db.ledger.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    ledger_credits = sum(e.get("amount", 0) for e in main_ledger if e.get("entry_type") == "credit")
    ledger_debits = sum(e.get("amount", 0) for e in main_ledger if e.get("entry_type") == "debit")
    ledger_balance = ledger_credits - ledger_debits
    
    result["diagnosis"]["main_ledger"] = {
        "total_entries": len(main_ledger),
        "total_credits": ledger_credits,
        "total_debits": ledger_debits,
        "calculated_balance": ledger_balance,
        "stored_balance": user.get("prc_balance", 0),
        "discrepancy": user.get("prc_balance", 0) - ledger_balance
    }
    
    discrepancy = abs(user.get("prc_balance", 0) - ledger_balance)
    if discrepancy > 1:
        result["issues_found"].append(f"BALANCE MISMATCH: Stored={user.get('prc_balance', 0):,.2f}, Ledger={ledger_balance:,.2f}, Diff={discrepancy:,.2f}")
    
    # 5. Check today's activity
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Redeem requests
    today_redeems = await db.redeem_requests.find(
        {"user_id": user_id, "created_at": {"$regex": f"^{today}"}},
        {"_id": 0, "request_id": 1, "service_type": 1, "amount": 1, "status": 1, "prc_refunded": 1, "eko_tid": 1}
    ).to_list(20)
    
    result["diagnosis"]["today_redeems"] = {
        "count": len(today_redeems),
        "requests": today_redeems
    }
    
    # Check for refund issues
    for r in today_redeems:
        if r.get("status") == "completed" and r.get("prc_refunded"):
            result["issues_found"].append(f"REQUEST {r.get('request_id')}: Status=completed BUT prc_refunded=True (DOUBLE CREDIT)")
    
    # Mining sessions
    today_mining = await db.mining_sessions.find(
        {"user_id": user_id, "created_at": {"$regex": f"^{today}"}},
        {"_id": 0}
    ).to_list(10)
    
    result["diagnosis"]["today_mining"] = {
        "sessions": len(today_mining)
    }
    
    # Transactions collection
    today_txns = await db.transactions.find(
        {"$or": [{"user_id": user_id}, {"uid": user_id}], "timestamp": {"$regex": f"^{today}"}},
        {"_id": 0, "type": 1, "amount": 1, "description": 1, "timestamp": 1}
    ).to_list(30)
    
    result["diagnosis"]["today_transactions"] = {
        "count": len(today_txns),
        "transactions": today_txns[:15]
    }
    
    # Bank withdrawal requests
    bank_requests = await db.bank_withdrawal_requests.find(
        {"user_id": user_id, "created_at": {"$regex": f"^{today}"}},
        {"_id": 0, "request_id": 1, "status": 1, "prc_deducted": 1}
    ).to_list(10)
    
    result["diagnosis"]["today_bank_withdrawals"] = {
        "count": len(bank_requests),
        "requests": bank_requests
    }
    
    # Chatbot withdrawals
    chatbot_requests = await db.chatbot_withdrawal_requests.find(
        {"uid": user_id},
        {"_id": 0, "request_id": 1, "status": 1, "prc_deducted": 1, "prc_refunded": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    result["diagnosis"]["chatbot_withdrawals"] = {
        "recent_count": len(chatbot_requests),
        "requests": chatbot_requests
    }
    
    # 6. Generate recommendations
    if result["issues_found"]:
        result["recommendations"].append("PRC balance needs correction based on issues found")
        if total_extra_credit > 0:
            result["recommendations"].append(f"Consider deducting {total_extra_credit:,.2f} PRC to correct the extra credit")
    else:
        result["recommendations"].append("No obvious double credit issues found. Check if issue is from a source not tracked in ledger.")
    
    # 7. Last 10 prc_transactions
    result["diagnosis"]["last_10_prc_transactions"] = [
        {
            "type": t.get("type"),
            "amount": t.get("amount"),
            "reference": t.get("reference"),
            "timestamp": t.get("timestamp")
        }
        for t in txns[-10:]
    ]
    
    return result


@router.post("/fix-prc-double/{user_id}")
async def fix_prc_double(user_id: str, deduct_amount: float, admin_reason: str = "PRC double credit correction"):
    """
    FIX: Deduct extra PRC that was credited due to double credit bug.
    
    This is a manual correction endpoint. Use after diagnosing with /diagnose-prc-double
    """
    from app.services.wallet_service_v2 import WalletServiceV2
    
    if deduct_amount <= 0:
        raise HTTPException(status_code=400, detail="Deduct amount must be positive")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_balance = user.get("prc_balance", 0)
    if current_balance < deduct_amount:
        raise HTTPException(status_code=400, detail=f"User balance ({current_balance}) is less than deduct amount ({deduct_amount})")
    
    # Use WalletServiceV2 for proper ledger tracking
    result = WalletServiceV2.debit(
        user_id=user_id,
        amount=deduct_amount,
        txn_type="double_credit_fix",
        description=admin_reason,
        reference=f"FIX-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        check_balance=True
    )
    
    if result.get("success"):
        return {
            "success": True,
            "message": f"Deducted {deduct_amount:,.2f} PRC from user {user_id}",
            "balance_before": result.get("balance_before"),
            "balance_after": result.get("balance_after"),
            "txn_id": result.get("txn_id")
        }
    else:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to deduct PRC"))
