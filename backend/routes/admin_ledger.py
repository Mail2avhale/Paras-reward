"""
Admin Ledger Routes
===================
Complete Ledger System (Audit-Ready)
Based on Master Ledger Document

Contains:
- Income Ledgers (Subscription, Commission, Penalty, Interest, Ad Revenue)
- Expense Ledgers (Redeem Payout, Operational)
- Cash & Bank Ledgers
- Deposit & Stockist Ledgers
- Utility Transaction Ledgers
- Summary & Reconciliation (P&L, Balance Sheet)
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
import uuid
import logging

router = APIRouter(prefix="/admin/ledger", tags=["Admin Ledger"])

# Database reference (will be set by server.py)
db = None

def set_db(database):
    global db
    db = database


# ==================== INCOME LEDGERS (₹ INFLOW) ====================

@router.get("/subscription-income")
async def get_subscription_income_ledger(page: int = 1, limit: int = 50, start_date: str = None, end_date: str = None):
    """Get VIP/Premium subscription income ledger"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        skip = (page - 1) * limit
        entries = await db.subscription_income_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.subscription_income_ledger.count_documents(query)
        
        totals_result = await db.subscription_income_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "total_amount": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_amount = totals_result[0].get("total_amount", 0) if totals_result else 0
        
        return {
            "entries": entries,
            "total": total,
            "total_amount": total_amount,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/subscription-income")
async def add_subscription_income(request: Request):
    """Add subscription income entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "plan_name": data.get("plan_name", "VIP"),
            "amount": float(data.get("amount", 0)),
            "payment_mode": data.get("payment_mode", "online"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "status": data.get("status", "completed"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscription_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/commission-income")
async def get_commission_income_ledger(page: int = 1, limit: int = 50, source_type: str = None):
    """Get commission income from recharges, bills, products"""
    try:
        query = {}
        if source_type:
            query["source_type"] = source_type
        
        skip = (page - 1) * limit
        entries = await db.commission_income_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.commission_income_ledger.count_documents(query)
        
        totals_result = await db.commission_income_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "gross": {"$sum": "$gross_commission"}, "tds": {"$sum": "$tds"}, "net": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"gross": 0, "tds": 0, "net": 0}
        
        return {
            "entries": entries,
            "total": total,
            "totals": totals,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/commission-income")
async def add_commission_income(request: Request):
    """Add commission income entry"""
    try:
        data = await request.json()
        gross = float(data.get("gross_commission", 0))
        tds = float(data.get("tds", 0))
        entry = {
            "id": str(uuid.uuid4()),
            "source_type": data.get("source_type", "recharge"),
            "partner_name": data.get("partner_name", ""),
            "transaction_id": data.get("transaction_id", ""),
            "gross_commission": gross,
            "tds": tds,
            "net_commission": gross - tds,
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.commission_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/penalty-income")
async def get_penalty_income_ledger(page: int = 1, limit: int = 50):
    """Get penalty/forfeit income from PRC expiry, fraud"""
    try:
        skip = (page - 1) * limit
        entries = await db.penalty_income_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.penalty_income_ledger.count_documents({})
        
        totals_result = await db.penalty_income_ledger.aggregate([
            {"$group": {"_id": None, "total_prc": {"$sum": "$prc_burned"}, "total_inr": {"$sum": "$equivalent_inr"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"total_prc": 0, "total_inr": 0}
        
        return {"entries": entries, "total": total, "totals": totals, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/penalty-income")
async def add_penalty_income(request: Request):
    """Add penalty income entry"""
    try:
        data = await request.json()
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        prc_burned = float(data.get("prc_burned", 0))
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "prc_burned": prc_burned,
            "equivalent_inr": prc_burned / prc_per_inr,
            "reason": data.get("reason", "expiry"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.penalty_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/interest-income")
async def get_interest_income_ledger(page: int = 1, limit: int = 50):
    """Get interest income from bank FD, savings, partners"""
    try:
        skip = (page - 1) * limit
        entries = await db.interest_income_ledger.find({}, {"_id": 0}).sort("date_received", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.interest_income_ledger.count_documents({})
        
        totals_result = await db.interest_income_ledger.aggregate([
            {"$group": {"_id": None, "total_interest": {"$sum": "$interest_amount"}}}
        ]).to_list(1)
        total_interest = totals_result[0].get("total_interest", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_interest": total_interest, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/interest-income")
async def add_interest_income(request: Request):
    """Add interest income entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "source": data.get("source", "bank"),
            "principal_amount": float(data.get("principal_amount", 0)),
            "interest_rate": float(data.get("interest_rate", 0)),
            "interest_amount": float(data.get("interest_amount", 0)),
            "period": data.get("period", ""),
            "date_received": data.get("date_received", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.interest_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/ad-revenue")
async def get_ad_revenue_ledger(page: int = 1, limit: int = 50, platform: str = None):
    """Get advertising revenue ledger"""
    try:
        query = {}
        if platform:
            query["platform"] = platform
        
        skip = (page - 1) * limit
        entries = await db.ad_revenue_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.ad_revenue_ledger.count_documents(query)
        
        totals_result = await db.ad_revenue_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "gross": {"$sum": "$gross_amount"}, "charges": {"$sum": "$platform_charges"}, "net": {"$sum": "$net_amount"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"gross": 0, "charges": 0, "net": 0}
        
        return {"entries": entries, "total": total, "totals": totals, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/ad-revenue")
async def add_ad_revenue(request: Request):
    """Add ad revenue entry"""
    try:
        data = await request.json()
        gross = float(data.get("gross_amount", 0))
        charges = float(data.get("platform_charges", 0))
        entry = {
            "id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "platform": data.get("platform", "admob"),
            "gross_amount": gross,
            "platform_charges": charges,
            "net_amount": gross - charges,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ad_revenue_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


# ==================== EXPENSE LEDGERS (₹ OUTFLOW) ====================

@router.get("/redeem-payout")
async def get_redeem_payout_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get redeem payout ledger - actual INR payouts"""
    from utils.prc_fields import PRC_AGGREGATION_FIELD
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.redeem_payout_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.redeem_payout_ledger.count_documents(query)
        
        totals_result = await db.redeem_payout_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": "$status", "total_prc": {"$sum": PRC_AGGREGATION_FIELD}, "total_inr": {"$sum": "$amount_inr"}}}
        ]).to_list(10)
        
        return {"entries": entries, "total": total, "totals_by_status": totals_result, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/redeem-payout")
async def add_redeem_payout(request: Request):
    """Add redeem payout entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "redeem_type": data.get("redeem_type", "voucher"),
            "prc_used": float(data.get("prc_used", 0)),
            "amount_inr": float(data.get("amount_inr", 0)),
            "payment_mode": data.get("payment_mode", "bank"),
            "status": data.get("status", "pending"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.redeem_payout_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.put("/redeem-payout/{entry_id}")
async def update_redeem_payout_status(entry_id: str, request: Request):
    """Update redeem payout status"""
    try:
        data = await request.json()
        result = await db.redeem_payout_ledger.update_one(
            {"id": entry_id},
            {"$set": {"status": data.get("status"), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": result.modified_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/expenses")
async def get_expense_ledger(page: int = 1, limit: int = 50, expense_type: str = None):
    """Get all expense entries"""
    try:
        query = {}
        if expense_type:
            query["expense_type"] = expense_type
        
        skip = (page - 1) * limit
        entries = await db.expense_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.expense_ledger.count_documents(query)
        
        totals_result = await db.expense_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": "$expense_type", "total": {"$sum": "$amount"}}}
        ]).to_list(20)
        
        return {"entries": entries, "total": total, "totals_by_type": totals_result, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/expenses")
async def add_expense(request: Request):
    """Add expense entry (server, sms, salary, marketing, legal, etc.)"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "expense_type": data.get("expense_type", "operational"),
            "category": data.get("category", ""),
            "provider": data.get("provider", ""),
            "description": data.get("description", ""),
            "amount": float(data.get("amount", 0)),
            "payment_mode": data.get("payment_mode", "bank"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.expense_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


# ==================== CASH & BANK LEDGERS ====================

@router.get("/cash")
async def get_cash_ledger(page: int = 1, limit: int = 50, start_date: str = None, end_date: str = None):
    """Get cash ledger entries"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        skip = (page - 1) * limit
        entries = await db.cash_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.cash_ledger.count_documents(query)
        
        latest = await db.cash_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        return {"entries": entries, "total": total, "current_balance": current_balance, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/cash")
async def add_cash_entry(request: Request):
    """Add cash ledger entry"""
    try:
        data = await request.json()
        
        latest = await db.cash_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        cash_in = float(data.get("cash_in", 0))
        cash_out = float(data.get("cash_out", 0))
        new_balance = current_balance + cash_in - cash_out
        
        entry = {
            "id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "source_type": data.get("source_type", "income"),
            "reference_id": data.get("reference_id", ""),
            "cash_in": cash_in,
            "cash_out": cash_out,
            "balance_after": new_balance,
            "remarks": data.get("remarks", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cash_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/bank")
async def get_bank_ledger(page: int = 1, limit: int = 50, bank_name: str = None):
    """Get bank ledger entries"""
    try:
        query = {}
        if bank_name:
            query["bank_name"] = bank_name
        
        skip = (page - 1) * limit
        entries = await db.bank_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.bank_ledger.count_documents(query)
        
        latest = await db.bank_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        return {"entries": entries, "total": total, "current_balance": current_balance, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/bank")
async def add_bank_entry(request: Request):
    """Add bank ledger entry"""
    try:
        data = await request.json()
        
        latest = await db.bank_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        amount = float(data.get("amount", 0))
        txn_type = data.get("transaction_type", "credit")
        
        if txn_type == "credit":
            new_balance = current_balance + amount
        else:
            new_balance = current_balance - amount
        
        entry = {
            "id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "bank_name": data.get("bank_name", ""),
            "account_last4": data.get("account_last4", ""),
            "transaction_type": txn_type,
            "source_type": data.get("source_type", ""),
            "reference_id": data.get("reference_id", ""),
            "amount": amount,
            "balance_after": new_balance,
            "remarks": data.get("remarks", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bank_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


# ==================== DEPOSIT & STOCKIST LEDGERS ====================

@router.get("/deposits")
async def get_deposit_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get stockist/partner deposit ledger"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.deposit_ledger.find(query, {"_id": 0}).sort("date_received", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.deposit_ledger.count_documents(query)
        
        totals_result = await db.deposit_ledger.aggregate([
            {"$group": {"_id": "$status", "total": {"$sum": "$deposit_amount"}}}
        ]).to_list(5)
        
        return {"entries": entries, "total": total, "totals_by_status": totals_result, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/deposits")
async def add_deposit(request: Request):
    """Add deposit entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "party_name": data.get("party_name"),
            "party_type": data.get("party_type", "stockist"),
            "deposit_amount": float(data.get("deposit_amount", 0)),
            "mode": data.get("mode", "bank"),
            "date_received": data.get("date_received", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.deposit_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/deposits/{deposit_id}/refund")
async def refund_deposit(deposit_id: str, request: Request):
    """Refund a deposit"""
    try:
        data = await request.json()
        
        await db.deposit_ledger.update_one(
            {"id": deposit_id},
            {"$set": {"status": "refunded", "refund_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}}
        )
        
        deposit = await db.deposit_ledger.find_one({"id": deposit_id}, {"_id": 0})
        if deposit:
            refund_entry = {
                "id": str(uuid.uuid4()),
                "party_name": deposit.get("party_name"),
                "deposit_reference_id": deposit_id,
                "amount_returned": deposit.get("deposit_amount"),
                "mode": data.get("mode", "bank"),
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "remarks": data.get("remarks", ""),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.deposit_refund_ledger.insert_one(refund_entry)
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/renewal-fees")
async def get_renewal_fees_ledger(page: int = 1, limit: int = 50):
    """Get renewal/activation fees ledger"""
    try:
        skip = (page - 1) * limit
        entries = await db.renewal_fees_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.renewal_fees_ledger.count_documents({})
        
        totals_result = await db.renewal_fees_ledger.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_amount = totals_result[0].get("total", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_amount": total_amount, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/renewal-fees")
async def add_renewal_fee(request: Request):
    """Add renewal fee entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "party_name": data.get("party_name"),
            "fee_type": data.get("fee_type", "renewal"),
            "amount": float(data.get("amount", 0)),
            "mode": data.get("mode", "bank"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.renewal_fees_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


# ==================== UTILITY TRANSACTION LEDGERS ====================

@router.get("/mobile-recharge")
async def get_mobile_recharge_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get mobile recharge ledger"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.mobile_recharge_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.mobile_recharge_ledger.count_documents(query)
        
        return {"entries": entries, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/product-purchase")
async def get_product_purchase_ledger(page: int = 1, limit: int = 50):
    """Get product purchase ledger"""
    try:
        skip = (page - 1) * limit
        entries = await db.product_purchase_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.product_purchase_ledger.count_documents({})
        
        totals_result = await db.product_purchase_ledger.aggregate([
            {"$group": {"_id": None, "total_profit": {"$sum": "$profit_margin"}}}
        ]).to_list(1)
        total_profit = totals_result[0].get("total_profit", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_profit": total_profit, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/product-purchase")
async def add_product_purchase(request: Request):
    """Add product purchase entry"""
    try:
        data = await request.json()
        purchase_cost = float(data.get("purchase_cost", 0))
        selling_price = float(data.get("selling_price", 0))
        
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "product_name": data.get("product_name"),
            "category": data.get("category", ""),
            "prc_used": float(data.get("prc_used", 0)),
            "cash_used": float(data.get("cash_used", 0)),
            "purchase_cost": purchase_cost,
            "selling_price": selling_price,
            "profit_margin": selling_price - purchase_cost,
            "status": data.get("status", "completed"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.product_purchase_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")


# ==================== SUMMARY & RECONCILIATION ====================

@router.get("/daily-cash-bank-summary")
async def get_daily_cash_bank_summary(start_date: str = None, end_date: str = None):
    """Get daily cash & bank summary"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        summaries = await db.daily_cash_bank_summary.find(query, {"_id": 0}).sort("date", -1).limit(30).to_list(30)
        return {"summaries": summaries}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/daily-cash-bank-summary/generate")
async def generate_daily_cash_bank_summary(request: Request):
    """Generate daily cash & bank summary for a date"""
    try:
        data = await request.json()
        date = data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        
        cash_in_result = await db.cash_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total_in": {"$sum": "$cash_in"}, "total_out": {"$sum": "$cash_out"}}}
        ]).to_list(1)
        
        bank_credit_result = await db.bank_ledger.aggregate([
            {"$match": {"date": date, "transaction_type": "credit"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        bank_debit_result = await db.bank_ledger.aggregate([
            {"$match": {"date": date, "transaction_type": "debit"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        prev_date = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        prev_summary = await db.daily_cash_bank_summary.find_one({"date": prev_date}, {"_id": 0})
        
        opening_cash = prev_summary.get("closing_cash", 0) if prev_summary else 0
        opening_bank = prev_summary.get("closing_bank", 0) if prev_summary else 0
        
        cash_in = cash_in_result[0].get("total_in", 0) if cash_in_result else 0
        cash_out = cash_in_result[0].get("total_out", 0) if cash_in_result else 0
        bank_credit = bank_credit_result[0].get("total", 0) if bank_credit_result else 0
        bank_debit = bank_debit_result[0].get("total", 0) if bank_debit_result else 0
        
        summary = {
            "date": date,
            "opening_cash": opening_cash,
            "cash_in": cash_in,
            "cash_out": cash_out,
            "closing_cash": opening_cash + cash_in - cash_out,
            "opening_bank": opening_bank,
            "bank_credit": bank_credit,
            "bank_debit": bank_debit,
            "closing_bank": opening_bank + bank_credit - bank_debit,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.daily_cash_bank_summary.update_one(
            {"date": date},
            {"$set": summary},
            upsert=True
        )
        
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/profit-loss-summary")
async def get_profit_loss_summary(start_date: str = None, end_date: str = None):
    """Get daily profit & loss summary"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        summaries = await db.daily_profit_loss_summary.find(query, {"_id": 0}).sort("date", -1).limit(30).to_list(30)
        return {"summaries": summaries}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.post("/profit-loss-summary/generate")
async def generate_profit_loss_summary(request: Request):
    """Generate daily P&L summary for a date"""
    try:
        data = await request.json()
        date = data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        
        ad_revenue = await db.ad_revenue_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$net_amount"}}}
        ]).to_list(1)
        
        subscription_income = await db.subscription_income_ledger.aggregate([
            {"$match": {"date": date, "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        commission_income = await db.commission_income_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        
        interest_income = await db.interest_income_ledger.aggregate([
            {"$match": {"date_received": date}},
            {"$group": {"_id": None, "total": {"$sum": "$interest_amount"}}}
        ]).to_list(1)
        
        penalty_income = await db.penalty_income_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$equivalent_inr"}}}
        ]).to_list(1)
        
        expenses = await db.expense_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        redeem_payouts = await db.redeem_payout_ledger.aggregate([
            {"$match": {"date": date, "status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
        ]).to_list(1)
        
        total_income = (
            (ad_revenue[0].get("total", 0) if ad_revenue else 0) +
            (subscription_income[0].get("total", 0) if subscription_income else 0) +
            (commission_income[0].get("total", 0) if commission_income else 0) +
            (interest_income[0].get("total", 0) if interest_income else 0) +
            (penalty_income[0].get("total", 0) if penalty_income else 0)
        )
        
        total_expense = (
            (expenses[0].get("total", 0) if expenses else 0) +
            (redeem_payouts[0].get("total", 0) if redeem_payouts else 0)
        )
        
        summary = {
            "date": date,
            "ad_revenue": ad_revenue[0].get("total", 0) if ad_revenue else 0,
            "subscription_income": subscription_income[0].get("total", 0) if subscription_income else 0,
            "commission_income": commission_income[0].get("total", 0) if commission_income else 0,
            "interest_income": interest_income[0].get("total", 0) if interest_income else 0,
            "penalty_income": penalty_income[0].get("total", 0) if penalty_income else 0,
            "total_income": total_income,
            "operational_expenses": expenses[0].get("total", 0) if expenses else 0,
            "redeem_payouts": redeem_payouts[0].get("total", 0) if redeem_payouts else 0,
            "total_expense": total_expense,
            "net_profit_loss": total_income - total_expense,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.daily_profit_loss_summary.update_one(
            {"date": date},
            {"$set": summary},
            upsert=True
        )
        
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/balance-sheet")
async def get_balance_sheet():
    """Get auto-generated balance sheet"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        cash_latest = await db.cash_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        cash_balance = cash_latest.get("balance_after", 0) if cash_latest else 0
        
        bank_latest = await db.bank_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        bank_balance = bank_latest.get("balance_after", 0) if bank_latest else 0
        
        receivable_comm = await db.commission_income_ledger.aggregate([
            {"$match": {"status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        receivable_commission = receivable_comm[0].get("total", 0) if receivable_comm else 0
        
        total_prc_result = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        total_prc = total_prc_result[0].get("total", 0) if total_prc_result else 0
        prc_liability_inr = total_prc / prc_per_inr
        
        deposit_payable_result = await db.deposit_ledger.aggregate([
            {"$match": {"status": "active"}},
            {"$group": {"_id": None, "total": {"$sum": "$deposit_amount"}}}
        ]).to_list(1)
        deposit_payable = deposit_payable_result[0].get("total", 0) if deposit_payable_result else 0
        
        pending_redeem_result = await db.redeem_payout_ledger.aggregate([
            {"$match": {"status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
        ]).to_list(1)
        pending_redeem = pending_redeem_result[0].get("total", 0) if pending_redeem_result else 0
        
        reserve_wallet = await db.company_wallets.find_one({"wallet_type": "reserve_fund"}, {"_id": 0})
        reserve_balance = reserve_wallet.get("balance", 0) if reserve_wallet else 0
        
        total_assets = cash_balance + bank_balance + receivable_commission
        total_liabilities = prc_liability_inr + deposit_payable + pending_redeem
        equity = total_assets - total_liabilities + reserve_balance
        
        balance_sheet = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "assets": {
                "cash_balance": round(cash_balance, 2),
                "bank_balance": round(bank_balance, 2),
                "receivable_commission": round(receivable_commission, 2),
                "total_assets": round(total_assets, 2)
            },
            "liabilities": {
                "prc_liability_inr": round(prc_liability_inr, 2),
                "prc_in_system": round(total_prc, 2),
                "deposit_payable": round(deposit_payable, 2),
                "pending_redeem": round(pending_redeem, 2),
                "total_liabilities": round(total_liabilities, 2)
            },
            "equity": {
                "reserve_fund": round(reserve_balance, 2),
                "retained_earnings": round(equity - reserve_balance, 2),
                "total_equity": round(equity, 2)
            },
            "balance_check": {
                "assets": round(total_assets, 2),
                "liabilities_plus_equity": round(total_liabilities + equity, 2),
                "balanced": abs(total_assets - (total_liabilities + equity)) < 0.01
            }
        }
        
        return balance_sheet
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

@router.get("/master-summary")
async def get_master_ledger_summary():
    """Get master summary of all ledgers for quick overview"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        ad_revenue_total = await db.ad_revenue_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$net_amount"}}}]).to_list(1)
        subscription_total = await db.subscription_income_ledger.aggregate([{"$match": {"status": "completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
        commission_total = await db.commission_income_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}]).to_list(1)
        interest_total = await db.interest_income_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$interest_amount"}}}]).to_list(1)
        penalty_total = await db.penalty_income_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$equivalent_inr"}}}]).to_list(1)
        
        expense_total = await db.expense_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
        redeem_total = await db.redeem_payout_ledger.aggregate([{"$match": {"status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}]).to_list(1)
        
        total_prc = await db.users.aggregate([{"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}]).to_list(1)
        
        total_income = (
            (ad_revenue_total[0].get("total", 0) if ad_revenue_total else 0) +
            (subscription_total[0].get("total", 0) if subscription_total else 0) +
            (commission_total[0].get("total", 0) if commission_total else 0) +
            (interest_total[0].get("total", 0) if interest_total else 0) +
            (penalty_total[0].get("total", 0) if penalty_total else 0)
        )
        
        total_expense = (
            (expense_total[0].get("total", 0) if expense_total else 0) +
            (redeem_total[0].get("total", 0) if redeem_total else 0)
        )
        
        prc_in_system = total_prc[0].get("total", 0) if total_prc else 0
        
        return {
            "income": {
                "ad_revenue": round(ad_revenue_total[0].get("total", 0) if ad_revenue_total else 0, 2),
                "subscription": round(subscription_total[0].get("total", 0) if subscription_total else 0, 2),
                "commission": round(commission_total[0].get("total", 0) if commission_total else 0, 2),
                "interest": round(interest_total[0].get("total", 0) if interest_total else 0, 2),
                "penalty_forfeit": round(penalty_total[0].get("total", 0) if penalty_total else 0, 2),
                "total": round(total_income, 2)
            },
            "expense": {
                "operational": round(expense_total[0].get("total", 0) if expense_total else 0, 2),
                "redeem_payouts": round(redeem_total[0].get("total", 0) if redeem_total else 0, 2),
                "total": round(total_expense, 2)
            },
            "net_profit_loss": round(total_income - total_expense, 2),
            "prc_stats": {
                "total_in_system": round(prc_in_system, 2),
                "inr_liability": round(prc_in_system / prc_per_inr, 2),
                "conversion_rate": prc_per_inr
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")
