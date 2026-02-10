"""
Admin Finance Routes - Financial management, P&L, expenses, company wallets
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

# Create router
router = APIRouter(prefix="/admin/finance", tags=["Admin Finance"])

# Database and cache references
db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager


# ========== PROFIT & LOSS ==========

@router.get("/profit-loss")
async def get_profit_loss_statement(period: str = "month", year: int = None, month: int = None):
    """Get comprehensive Profit & Loss statement"""
    try:
        now = datetime.now(timezone.utc)
        
        # Determine date range
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
            period_label = now.strftime("%d %B %Y")
        elif period == "week":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
            period_label = f"Week of {start_date.strftime('%d %B %Y')}"
        elif period == "year":
            target_year = year or now.year
            start_date = datetime(target_year, 1, 1, tzinfo=timezone.utc)
            end_date = datetime(target_year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
            period_label = str(target_year)
        else:  # month
            target_year = year or now.year
            target_month = month or now.month
            start_date = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
            if target_month == 12:
                end_date = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
            else:
                end_date = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
            period_label = start_date.strftime("%B %Y")
        
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        
        # Revenue calculation
        revenue = {"vip_memberships": 0, "service_charges": 0, "delivery_charges": 0, "other_income": 0}
        
        # VIP Membership Revenue
        vip_payments = await db.vip_payments.find({
            "status": "approved",
            "approved_at": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "amount": 1}).to_list(1000)
        revenue["vip_memberships"] = sum(p.get("amount", 0) for p in vip_payments)
        
        total_revenue = sum(revenue.values())
        
        # Expense calculation
        expenses = {"payment_gateway_fees": 0, "miscellaneous": 0}
        
        manual_expenses = await db.expenses.find({
            "date": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0}).to_list(1000)
        
        for exp in manual_expenses:
            category = exp.get("category", "miscellaneous")
            if category not in expenses:
                expenses[category] = 0
            expenses[category] += exp.get("amount", 0)
        
        expenses["payment_gateway_fees"] = revenue["vip_memberships"] * 0.02
        total_expenses = sum(expenses.values())
        
        net_profit = total_revenue - total_expenses
        profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        return {
            "period": period,
            "period_label": period_label,
            "start_date": start_str,
            "end_date": end_str,
            "revenue": revenue,
            "total_revenue": round(total_revenue, 2),
            "expenses": expenses,
            "total_expenses": round(total_expenses, 2),
            "net_profit": round(net_profit, 2),
            "profit_margin": round(profit_margin, 2),
            "generated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"P&L error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== EXPENSES ==========

@router.post("/expense")
async def add_expense(request: Request):
    """Add a new expense entry"""
    data = await request.json()
    
    expense = {
        "expense_id": str(uuid.uuid4()),
        "category": data.get("category", "miscellaneous"),
        "amount": float(data.get("amount", 0)),
        "description": data.get("description", ""),
        "date": data.get("date", datetime.now(timezone.utc).isoformat()),
        "added_by": data.get("admin_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.expenses.insert_one(expense)
    expense.pop("_id", None)
    
    return {"success": True, "expense": expense}


@router.get("/expenses")
async def get_expenses(
    category: str = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = 100,
    skip: int = 0
):
    """Get expense entries with filtering"""
    query = {}
    if category:
        query["category"] = category
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["date"] = date_query
    
    total = await db.expenses.count_documents(query)
    expenses = await db.expenses.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"expenses": expenses, "total": total, "skip": skip, "limit": limit}


@router.put("/expense/{expense_id}")
async def update_expense(expense_id: str, request: Request):
    """Update an expense entry"""
    data = await request.json()
    
    update_data = {}
    for field in ["category", "amount", "description", "date"]:
        if field in data:
            update_data[field] = data[field]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.expenses.update_one({"expense_id": expense_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    return {"success": True, "message": "Expense updated"}


@router.delete("/expense/{expense_id}")
async def delete_expense(expense_id: str):
    """Delete an expense entry"""
    result = await db.expenses.delete_one({"expense_id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    return {"success": True, "message": "Expense deleted"}


# ========== COMPANY WALLETS ==========

@router.get("/company-wallets")
async def get_company_wallets():
    """Get all company wallet balances"""
    wallets = await db.company_wallets.find({}, {"_id": 0}).to_list(20)
    
    if not wallets:
        default_wallets = [
            {"wallet_type": "subscription", "balance": 0, "total_credit": 0, "total_debit": 0},
            {"wallet_type": "service_charges", "balance": 0, "total_credit": 0, "total_debit": 0},
            {"wallet_type": "delivery", "balance": 0, "total_credit": 0, "total_debit": 0},
            {"wallet_type": "prc_reserve", "balance": 0, "total_credit": 0, "total_debit": 0}
        ]
        for w in default_wallets:
            await db.company_wallets.insert_one(w)
        wallets = default_wallets
    
    total_balance = sum(w.get("balance", 0) for w in wallets)
    
    return {"wallets": wallets, "total_balance": round(total_balance, 2)}


@router.post("/company-wallet/transfer")
async def transfer_between_wallets(request: Request):
    """Transfer funds between company wallets"""
    data = await request.json()
    
    from_wallet = data.get("from_wallet")
    to_wallet = data.get("to_wallet")
    amount = float(data.get("amount", 0))
    admin_id = data.get("admin_id")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    source = await db.company_wallets.find_one({"wallet_type": from_wallet})
    if not source or source.get("balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance in source wallet")
    
    now = datetime.now(timezone.utc)
    
    await db.company_wallets.update_one(
        {"wallet_type": from_wallet},
        {"$inc": {"balance": -amount, "total_debit": amount}, "$set": {"last_updated": now.isoformat()}}
    )
    
    await db.company_wallets.update_one(
        {"wallet_type": to_wallet},
        {"$inc": {"balance": amount, "total_credit": amount}, "$set": {"last_updated": now.isoformat()}},
        upsert=True
    )
    
    await db.wallet_transfers.insert_one({
        "transfer_id": str(uuid.uuid4()),
        "from_wallet": from_wallet,
        "to_wallet": to_wallet,
        "amount": amount,
        "admin_id": admin_id,
        "timestamp": now.isoformat()
    })
    
    return {"success": True, "message": f"Transferred {amount} from {from_wallet} to {to_wallet}"}


@router.post("/company-wallet/adjust")
async def adjust_wallet_balance(request: Request):
    """Adjust company wallet balance (admin only)"""
    data = await request.json()
    
    wallet_type = data.get("wallet_type")
    adjustment = float(data.get("adjustment", 0))
    reason = data.get("reason", "Manual adjustment")
    admin_id = data.get("admin_id")
    
    if not wallet_type:
        raise HTTPException(status_code=400, detail="Wallet type is required")
    
    now = datetime.now(timezone.utc)
    
    update_op = {
        "$inc": {"balance": adjustment},
        "$set": {"last_updated": now.isoformat()}
    }
    if adjustment > 0:
        update_op["$inc"]["total_credit"] = adjustment
    else:
        update_op["$inc"]["total_debit"] = abs(adjustment)
    
    await db.company_wallets.update_one({"wallet_type": wallet_type}, update_op, upsert=True)
    
    await db.wallet_adjustments.insert_one({
        "adjustment_id": str(uuid.uuid4()),
        "wallet_type": wallet_type,
        "adjustment": adjustment,
        "reason": reason,
        "admin_id": admin_id,
        "timestamp": now.isoformat()
    })
    
    return {"success": True, "message": f"Adjusted {wallet_type} by {adjustment}"}


# ========== ADS INCOME ==========

@router.get("/ads-income")
async def get_ads_income(start_date: str = None, end_date: str = None):
    """Get ads income entries"""
    query = {}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["date"] = date_query
    
    entries = await db.ads_income.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    total = sum(e.get("amount", 0) for e in entries)
    
    return {"entries": entries, "total": round(total, 2)}


@router.post("/ads-income")
async def add_ads_income(request: Request):
    """Add ads income entry"""
    data = await request.json()
    
    entry = {
        "entry_id": str(uuid.uuid4()),
        "platform": data.get("platform", "other"),
        "amount": float(data.get("amount", 0)),
        "description": data.get("description", ""),
        "date": data.get("date", datetime.now(timezone.utc).isoformat()),
        "added_by": data.get("admin_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ads_income.insert_one(entry)
    entry.pop("_id", None)
    
    return {"success": True, "entry": entry}


@router.delete("/ads-income/{entry_id}")
async def delete_ads_income(entry_id: str):
    """Delete ads income entry"""
    result = await db.ads_income.delete_one({"entry_id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"success": True, "message": "Entry deleted"}


# ========== FIXED EXPENSES ==========

@router.get("/fixed-expenses")
async def get_fixed_expenses():
    """Get recurring fixed expenses"""
    expenses = await db.fixed_expenses.find({}, {"_id": 0}).to_list(50)
    monthly_total = sum(e.get("monthly_amount", 0) for e in expenses)
    
    return {"expenses": expenses, "monthly_total": round(monthly_total, 2)}


@router.post("/fixed-expense")
async def add_fixed_expense(request: Request):
    """Add a fixed recurring expense"""
    data = await request.json()
    
    expense = {
        "expense_id": str(uuid.uuid4()),
        "name": data.get("name"),
        "category": data.get("category", "other"),
        "monthly_amount": float(data.get("monthly_amount", 0)),
        "description": data.get("description", ""),
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.fixed_expenses.insert_one(expense)
    expense.pop("_id", None)
    
    return {"success": True, "expense": expense}


@router.put("/fixed-expense/{expense_id}")
async def update_fixed_expense(expense_id: str, request: Request):
    """Update a fixed expense"""
    data = await request.json()
    
    update_data = {}
    for field in ["name", "category", "monthly_amount", "description", "active"]:
        if field in data:
            update_data[field] = data[field]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.fixed_expenses.update_one({"expense_id": expense_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fixed expense not found")
    
    return {"success": True, "message": "Fixed expense updated"}


# ========== EXPORT & SNAPSHOTS ==========

@router.get("/export/profit-loss")
async def export_profit_loss(period: str = "month", year: int = None, month: int = None):
    """Export P&L data for download"""
    pl_data = await get_profit_loss_statement(period, year, month)
    return {
        "export_type": "profit_loss",
        "data": pl_data,
        "exported_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/export/company-wallets")
async def export_company_wallets():
    """Export company wallet data"""
    wallets_data = await get_company_wallets()
    return {
        "export_type": "company_wallets",
        "data": wallets_data,
        "exported_at": datetime.now(timezone.utc).isoformat()
    }


@router.post("/snapshot/monthly")
async def create_monthly_snapshot(request: Request):
    """Create monthly financial snapshot"""
    data = await request.json()
    admin_id = data.get("admin_id")
    year = data.get("year", datetime.now(timezone.utc).year)
    month = data.get("month", datetime.now(timezone.utc).month)
    
    pl_data = await get_profit_loss_statement("month", year, month)
    wallets_data = await get_company_wallets()
    
    snapshot = {
        "snapshot_id": str(uuid.uuid4()),
        "year": year,
        "month": month,
        "profit_loss": pl_data,
        "wallets": wallets_data,
        "created_by": admin_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.finance_snapshots.insert_one(snapshot)
    snapshot.pop("_id", None)
    
    return {"success": True, "snapshot_id": snapshot["snapshot_id"]}


@router.get("/snapshots")
async def get_finance_snapshots(limit: int = 12):
    """Get recent financial snapshots"""
    snapshots = await db.finance_snapshots.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"snapshots": snapshots}


# ========== USER LEDGER ==========

@router.get("/user-ledger")
async def get_user_ledger_summary(page: int = 1, limit: int = 50):
    """Get summary of all user ledgers"""
    skip = (page - 1) * limit
    
    pipeline = [
        {"$group": {
            "_id": "$user_id",
            "total_credit": {"$sum": {"$cond": [{"$gt": ["$amount", 0]}, "$amount", 0]}},
            "total_debit": {"$sum": {"$cond": [{"$lt": ["$amount", 0]}, {"$abs": "$amount"}, 0]}},
            "transaction_count": {"$sum": 1}
        }},
        {"$sort": {"transaction_count": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    summaries = await db.transactions.aggregate(pipeline).to_list(limit)
    
    return {"ledgers": summaries, "page": page, "limit": limit}


@router.get("/user-ledger/{uid}")
async def get_user_ledger_detail(uid: str, limit: int = 100):
    """Get detailed ledger for a specific user"""
    transactions = await db.transactions.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    total_credit = sum(t.get("amount", 0) for t in transactions if t.get("amount", 0) > 0)
    total_debit = sum(abs(t.get("amount", 0)) for t in transactions if t.get("amount", 0) < 0)
    
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "name": 1, "email": 1, "prc_balance": 1})
    
    return {
        "user": user,
        "transactions": transactions,
        "summary": {
            "total_credit": round(total_credit, 4),
            "total_debit": round(total_debit, 4),
            "net": round(total_credit - total_debit, 4),
            "current_balance": user.get("prc_balance", 0) if user else 0
        }
    }


@router.get("/export/user-ledger/{uid}")
async def export_user_ledger(uid: str):
    """Export user ledger data"""
    ledger_data = await get_user_ledger_detail(uid)
    return {
        "export_type": "user_ledger",
        "uid": uid,
        "data": ledger_data,
        "exported_at": datetime.now(timezone.utc).isoformat()
    }


# ========== RECONCILIATION ==========

@router.get("/reconciliation/history")
async def get_reconciliation_history(limit: int = 20):
    """Get reconciliation history"""
    history = await db.reconciliation_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"history": history}


@router.post("/reconciliation/run")
async def run_reconciliation(request: Request):
    """Run balance reconciliation check"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    now = datetime.now(timezone.utc)
    
    # Get total user balances
    user_balance_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
    ]
    user_result = await db.users.aggregate(user_balance_pipeline).to_list(1)
    total_user_balance = user_result[0]["total"] if user_result else 0
    
    # Get company wallet balances
    wallets = await db.company_wallets.find({}, {"_id": 0, "wallet_type": 1, "balance": 1}).to_list(20)
    total_company_balance = sum(w.get("balance", 0) for w in wallets)
    
    log_entry = {
        "log_id": str(uuid.uuid4()),
        "total_user_balance": round(total_user_balance, 4),
        "total_company_balance": round(total_company_balance, 2),
        "run_by": admin_id,
        "timestamp": now.isoformat()
    }
    
    await db.reconciliation_logs.insert_one(log_entry)
    log_entry.pop("_id", None)
    
    return {"success": True, "result": log_entry}


@router.get("/reconciliation/status")
async def get_reconciliation_status():
    """Get current reconciliation status"""
    latest = await db.reconciliation_logs.find_one({}, {"_id": 0}, sort=[("timestamp", -1)])
    return {"latest_reconciliation": latest}


# ========== REDEEM SETTINGS ==========

@router.get("/redeem-settings")
async def get_redeem_settings():
    """Get redemption settings"""
    settings = await db.settings.find_one({"key": "redeem_settings"}, {"_id": 0})
    return settings or {"key": "redeem_settings", "enabled": True, "min_amount": 100}


@router.post("/redeem-settings")
async def update_redeem_settings(request: Request):
    """Update redemption settings"""
    data = await request.json()
    
    await db.settings.update_one(
        {"key": "redeem_settings"},
        {"$set": {
            "key": "redeem_settings",
            "enabled": data.get("enabled", True),
            "min_amount": data.get("min_amount", 100),
            "max_amount": data.get("max_amount", 10000),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Redeem settings updated"}
