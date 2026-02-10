"""
Admin Accounting Routes - Accounting and ledger management
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Accounting"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ========== ACCOUNTING DASHBOARD ==========

@router.get("/accounting/dashboard")
async def get_accounting_dashboard():
    """Get accounting dashboard summary"""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        # Today's transactions
        today_txns = await db.transactions.count_documents({"created_at": {"$gte": today_start}})
        
        # Monthly revenue
        revenue_pipeline = [
            {"$match": {"status": "approved", "approved_at": {"$gte": month_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        revenue_result = await db.vip_payments.aggregate(revenue_pipeline).to_list(1)
        monthly_revenue = revenue_result[0]["total"] if revenue_result else 0
        
        # Total PRC in circulation
        prc_pipeline = [
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]
        prc_result = await db.users.aggregate(prc_pipeline).to_list(1)
        total_prc = prc_result[0]["total"] if prc_result else 0
        
        return {
            "today_transactions": today_txns,
            "monthly_revenue": round(monthly_revenue, 2),
            "total_prc_circulation": round(total_prc, 4),
            "generated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"Accounting dashboard error: {e}")
        return {"error": str(e)}


@router.get("/accounting/summary")
async def get_accounting_summary(period: str = "month"):
    """Get accounting summary for period"""
    try:
        now = datetime.now(timezone.utc)
        
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = now - timedelta(days=7)
        elif period == "year":
            start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # month
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        start_str = start_date.isoformat()
        
        # Revenue
        revenue = await db.vip_payments.aggregate([
            {"$match": {"status": "approved", "approved_at": {"$gte": start_str}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        
        # Transactions
        txn_stats = await db.transactions.aggregate([
            {"$match": {"created_at": {"$gte": start_str}}},
            {"$group": {
                "_id": "$type",
                "count": {"$sum": 1},
                "total": {"$sum": {"$abs": "$amount"}}
            }}
        ]).to_list(20)
        
        return {
            "period": period,
            "start_date": start_str,
            "revenue": {
                "total": round(revenue[0]["total"], 2) if revenue else 0,
                "count": revenue[0]["count"] if revenue else 0
            },
            "transactions_by_type": {t["_id"]: {"count": t["count"], "total": round(t["total"], 4)} for t in txn_stats},
            "generated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"Accounting summary error: {e}")
        return {"error": str(e)}


# ========== LEDGER ==========

@router.get("/ledger/overview")
async def get_ledger_overview():
    """Get ledger overview"""
    try:
        # Total users with balance
        users_with_balance = await db.users.count_documents({"prc_balance": {"$gt": 0}})
        
        # Total PRC
        total_prc = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        
        # Recent transactions count
        recent_count = await db.transactions.count_documents({})
        
        return {
            "users_with_balance": users_with_balance,
            "total_prc": round(total_prc[0]["total"], 4) if total_prc else 0,
            "total_transactions": recent_count
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/ledger/transactions")
async def get_ledger_transactions(
    transaction_type: str = None,
    user_id: str = None,
    start_date: str = None,
    end_date: str = None,
    page: int = 1,
    limit: int = 50
):
    """Get ledger transactions with filtering"""
    query = {}
    
    if transaction_type:
        query["type"] = transaction_type
    if user_id:
        query["user_id"] = user_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["created_at"] = date_query
    
    skip = (page - 1) * limit
    total = await db.transactions.count_documents(query)
    
    transactions = await db.transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/ledger/user/{uid}")
async def get_user_ledger(uid: str, limit: int = 100):
    """Get detailed ledger for a user"""
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "name": 1, "email": 1, "prc_balance": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    transactions = await db.transactions.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate totals
    credits = sum(t.get("amount", 0) for t in transactions if t.get("amount", 0) > 0)
    debits = sum(abs(t.get("amount", 0)) for t in transactions if t.get("amount", 0) < 0)
    
    return {
        "user": user,
        "transactions": transactions,
        "summary": {
            "total_credits": round(credits, 4),
            "total_debits": round(debits, 4),
            "net": round(credits - debits, 4),
            "current_balance": user.get("prc_balance", 0)
        }
    }


@router.get("/ledger/export")
async def export_ledger(start_date: str = None, end_date: str = None, format: str = "json"):
    """Export ledger data"""
    query = {}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["created_at"] = date_query
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(10000).to_list(10000)
    
    return {
        "export_type": "ledger",
        "format": format,
        "count": len(transactions),
        "data": transactions,
        "exported_at": datetime.now(timezone.utc).isoformat()
    }


# ========== ACCOUNTING ENTRIES ==========

@router.get("/accounting/entries")
async def get_accounting_entries(
    entry_type: str = None,
    page: int = 1,
    limit: int = 50
):
    """Get accounting entries"""
    query = {}
    if entry_type:
        query["entry_type"] = entry_type
    
    skip = (page - 1) * limit
    total = await db.accounting_entries.count_documents(query)
    
    entries = await db.accounting_entries.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"entries": entries, "total": total, "page": page}


@router.post("/accounting/entry")
async def create_accounting_entry(request: Request):
    """Create accounting entry"""
    data = await request.json()
    
    entry = {
        "entry_id": str(uuid.uuid4()),
        "entry_type": data.get("entry_type", "general"),
        "debit_account": data.get("debit_account"),
        "credit_account": data.get("credit_account"),
        "amount": float(data.get("amount", 0)),
        "description": data.get("description", ""),
        "reference": data.get("reference"),
        "date": data.get("date", datetime.now(timezone.utc).isoformat()),
        "created_by": data.get("admin_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.accounting_entries.insert_one(entry)
    entry.pop("_id", None)
    
    return {"success": True, "entry": entry}


@router.put("/accounting/entry/{entry_id}")
async def update_accounting_entry(entry_id: str, request: Request):
    """Update accounting entry"""
    data = await request.json()
    
    update_data = {}
    for field in ["entry_type", "debit_account", "credit_account", "amount", "description", "reference", "date"]:
        if field in data:
            update_data[field] = data[field]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.accounting_entries.update_one({"entry_id": entry_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"success": True, "message": "Entry updated"}


@router.delete("/accounting/entry/{entry_id}")
async def delete_accounting_entry(entry_id: str):
    """Delete accounting entry"""
    result = await db.accounting_entries.delete_one({"entry_id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"success": True, "message": "Entry deleted"}


# ========== CAPITAL & LIQUIDITY ==========

@router.get("/capital/overview")
async def get_capital_overview():
    """Get capital overview"""
    try:
        # Company wallets
        wallets = await db.company_wallets.find({}, {"_id": 0}).to_list(20)
        total_capital = sum(w.get("balance", 0) for w in wallets)
        
        # User balances (liability)
        user_balance = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        total_liability = user_balance[0]["total"] if user_balance else 0
        
        return {
            "total_capital": round(total_capital, 2),
            "total_user_liability": round(total_liability, 4),
            "net_position": round(total_capital - total_liability, 2),
            "wallets": wallets
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/capital/history")
async def get_capital_history(limit: int = 30):
    """Get capital change history"""
    history = await db.capital_history.find({}, {"_id": 0}).sort("date", -1).limit(limit).to_list(limit)
    return {"history": history}


@router.post("/capital/record")
async def record_capital_change(request: Request):
    """Record capital change"""
    data = await request.json()
    
    record = {
        "record_id": str(uuid.uuid4()),
        "change_type": data.get("change_type", "adjustment"),
        "amount": float(data.get("amount", 0)),
        "wallet": data.get("wallet"),
        "description": data.get("description", ""),
        "date": datetime.now(timezone.utc).isoformat(),
        "recorded_by": data.get("admin_id")
    }
    
    await db.capital_history.insert_one(record)
    record.pop("_id", None)
    
    return {"success": True, "record": record}


@router.get("/liquidity/status")
async def get_liquidity_status():
    """Get liquidity status"""
    try:
        # Available cash
        wallets = await db.company_wallets.find({"wallet_type": {"$in": ["subscription", "cash"]}}, {"_id": 0}).to_list(10)
        available_cash = sum(w.get("balance", 0) for w in wallets)
        
        # Pending withdrawals
        pending_withdrawals = await db.cashback_withdrawals.aggregate([
            {"$match": {"status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        pending_amount = pending_withdrawals[0]["total"] if pending_withdrawals else 0
        
        return {
            "available_cash": round(available_cash, 2),
            "pending_withdrawals": round(pending_amount, 2),
            "net_liquidity": round(available_cash - pending_amount, 2),
            "status": "healthy" if available_cash > pending_amount else "low"
        }
    except Exception as e:
        return {"error": str(e)}


# ========== AUDIT TRAIL ==========

@router.get("/audit/trail")
async def get_audit_trail(
    entity_type: str = None,
    action: str = None,
    admin_uid: str = None,
    start_date: str = None,
    end_date: str = None,
    page: int = 1,
    limit: int = 50
):
    """Get audit trail with filtering"""
    query = {}
    
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = action
    if admin_uid:
        query["admin_uid"] = admin_uid
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["timestamp"] = date_query
    
    skip = (page - 1) * limit
    total = await db.admin_audit_logs.count_documents(query)
    
    logs = await db.admin_audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"logs": logs, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/audit/export")
async def export_audit_trail(start_date: str = None, end_date: str = None):
    """Export audit trail"""
    query = {}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["timestamp"] = date_query
    
    logs = await db.admin_audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(10000).to_list(10000)
    
    return {
        "export_type": "audit_trail",
        "count": len(logs),
        "data": logs,
        "exported_at": datetime.now(timezone.utc).isoformat()
    }
