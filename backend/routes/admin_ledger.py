"""
PARAS REWARD - Admin Ledger Routes
===================================
Complete Ledger System (Audit-Ready)
Based on Master Ledger Document
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/admin/ledger", tags=["Admin Ledger"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ========== INCOME LEDGERS (₹ INFLOW) ==========

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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/commission-income")
async def add_commission_income(request: Request):
    """Add commission income entry"""
    try:
        data = await request.json()
        gross = float(data.get("gross_commission", 0))
        tds_rate = float(data.get("tds_rate", 0.05))
        tds = gross * tds_rate
        net = gross - tds
        
        entry = {
            "id": str(uuid.uuid4()),
            "source_type": data.get("source_type", "recharge"),
            "transaction_id": data.get("transaction_id"),
            "gross_commission": gross,
            "tds_rate": tds_rate,
            "tds": round(tds, 2),
            "net_commission": round(net, 2),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.commission_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/penalty-income")
async def get_penalty_income_ledger(page: int = 1, limit: int = 50):
    """Get penalty/fee income ledger"""
    try:
        skip = (page - 1) * limit
        entries = await db.penalty_income_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.penalty_income_ledger.count_documents({})
        
        totals_result = await db.penalty_income_ledger.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_amount = totals_result[0].get("total", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_amount": total_amount, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/penalty-income")
async def add_penalty_income(request: Request):
    """Add penalty income entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "penalty_type": data.get("penalty_type", "withdrawal_fee"),
            "amount": float(data.get("amount", 0)),
            "description": data.get("description", ""),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.penalty_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interest-income")
async def get_interest_income_ledger(page: int = 1, limit: int = 50):
    """Get interest income ledger (bank/FD interest)"""
    try:
        skip = (page - 1) * limit
        entries = await db.interest_income_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.interest_income_ledger.count_documents({})
        
        return {"entries": entries, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interest-income")
async def add_interest_income(request: Request):
    """Add interest income entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "source": data.get("source", "bank_fd"),
            "amount": float(data.get("amount", 0)),
            "tds": float(data.get("tds", 0)),
            "net_amount": float(data.get("amount", 0)) - float(data.get("tds", 0)),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.interest_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ad-revenue")
async def get_ad_revenue_ledger(page: int = 1, limit: int = 50, platform: str = None):
    """Get ad revenue ledger"""
    try:
        query = {}
        if platform:
            query["platform"] = platform
        
        skip = (page - 1) * limit
        entries = await db.ad_revenue_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.ad_revenue_ledger.count_documents(query)
        
        totals_result = await db.ad_revenue_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "gross": {"$sum": "$gross_revenue"}, "platform_fee": {"$sum": "$platform_fee"}, "net": {"$sum": "$net_revenue"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"gross": 0, "platform_fee": 0, "net": 0}
        
        return {"entries": entries, "total": total, "totals": totals, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ad-revenue")
async def add_ad_revenue(request: Request):
    """Add ad revenue entry"""
    try:
        data = await request.json()
        gross = float(data.get("gross_revenue", 0))
        platform_fee_rate = float(data.get("platform_fee_rate", 0.30))
        platform_fee = gross * platform_fee_rate
        net = gross - platform_fee
        
        entry = {
            "id": str(uuid.uuid4()),
            "platform": data.get("platform", "admob"),
            "ad_type": data.get("ad_type", "rewarded"),
            "impressions": int(data.get("impressions", 0)),
            "gross_revenue": gross,
            "platform_fee_rate": platform_fee_rate,
            "platform_fee": round(platform_fee, 2),
            "net_revenue": round(net, 2),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ad_revenue_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== EXPENSE LEDGERS (₹ OUTFLOW) ==========

@router.get("/user-payouts")
async def get_user_payouts_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get user payouts/withdrawals ledger"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.user_payouts_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.user_payouts_ledger.count_documents(query)
        
        totals_result = await db.user_payouts_ledger.aggregate([
            {"$match": {"status": "completed"}},
            {"$group": {"_id": None, "total_paid": {"$sum": "$net_amount"}}}
        ]).to_list(1)
        total_paid = totals_result[0].get("total_paid", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_paid": total_paid, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user-payouts")
async def add_user_payout(request: Request):
    """Record user payout"""
    try:
        data = await request.json()
        gross = float(data.get("gross_amount", 0))
        tds_rate = float(data.get("tds_rate", 0))
        tds = gross * tds_rate
        net = gross - tds
        
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "gross_amount": gross,
            "tds_rate": tds_rate,
            "tds_deducted": round(tds, 2),
            "net_amount": round(net, 2),
            "payment_mode": data.get("payment_mode", "upi"),
            "utr_number": data.get("utr_number"),
            "status": data.get("status", "completed"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_payouts_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/product-costs")
async def get_product_costs_ledger(page: int = 1, limit: int = 50):
    """Get product purchase costs ledger"""
    try:
        skip = (page - 1) * limit
        entries = await db.product_costs_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.product_costs_ledger.count_documents({})
        
        totals_result = await db.product_costs_ledger.aggregate([
            {"$group": {"_id": None, "total_cost": {"$sum": "$cost"}, "total_gst": {"$sum": "$gst"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"total_cost": 0, "total_gst": 0}
        
        return {"entries": entries, "total": total, "totals": totals, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/product-costs")
async def add_product_cost(request: Request):
    """Add product cost entry"""
    try:
        data = await request.json()
        cost = float(data.get("cost", 0))
        gst_rate = float(data.get("gst_rate", 0.18))
        gst = cost * gst_rate
        
        entry = {
            "id": str(uuid.uuid4()),
            "product_id": data.get("product_id"),
            "product_name": data.get("product_name"),
            "quantity": int(data.get("quantity", 1)),
            "cost": cost,
            "gst_rate": gst_rate,
            "gst": round(gst, 2),
            "total_cost": round(cost + gst, 2),
            "vendor": data.get("vendor", ""),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.product_costs_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/operational-expenses")
async def get_operational_expenses(page: int = 1, limit: int = 50, category: str = None):
    """Get operational expenses ledger"""
    try:
        query = {}
        if category:
            query["category"] = category
        
        skip = (page - 1) * limit
        entries = await db.operational_expenses_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.operational_expenses_ledger.count_documents(query)
        
        return {"entries": entries, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/operational-expenses")
async def add_operational_expense(request: Request):
    """Add operational expense entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "category": data.get("category", "general"),
            "description": data.get("description", ""),
            "amount": float(data.get("amount", 0)),
            "gst": float(data.get("gst", 0)),
            "vendor": data.get("vendor", ""),
            "payment_mode": data.get("payment_mode", "bank"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.operational_expenses_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== SUMMARY ENDPOINTS ==========

@router.get("/summary/income")
async def get_income_summary(start_date: str = None, end_date: str = None):
    """Get income summary across all ledgers"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        # Aggregate from all income ledgers
        subscription = await db.subscription_income_ledger.aggregate([
            {"$match": query}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        commission = await db.commission_income_ledger.aggregate([
            {"$match": query}, {"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        
        penalty = await db.penalty_income_ledger.aggregate([
            {"$match": query}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        interest = await db.interest_income_ledger.aggregate([
            {"$match": query}, {"$group": {"_id": None, "total": {"$sum": "$net_amount"}}}
        ]).to_list(1)
        
        ad_revenue = await db.ad_revenue_ledger.aggregate([
            {"$match": query}, {"$group": {"_id": None, "total": {"$sum": "$net_revenue"}}}
        ]).to_list(1)
        
        return {
            "subscription_income": subscription[0]["total"] if subscription else 0,
            "commission_income": commission[0]["total"] if commission else 0,
            "penalty_income": penalty[0]["total"] if penalty else 0,
            "interest_income": interest[0]["total"] if interest else 0,
            "ad_revenue": ad_revenue[0]["total"] if ad_revenue else 0,
            "total_income": sum([
                subscription[0]["total"] if subscription else 0,
                commission[0]["total"] if commission else 0,
                penalty[0]["total"] if penalty else 0,
                interest[0]["total"] if interest else 0,
                ad_revenue[0]["total"] if ad_revenue else 0
            ])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/expenses")
async def get_expense_summary(start_date: str = None, end_date: str = None):
    """Get expense summary across all ledgers"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        payouts = await db.user_payouts_ledger.aggregate([
            {"$match": {**query, "status": "completed"}}, 
            {"$group": {"_id": None, "total": {"$sum": "$net_amount"}}}
        ]).to_list(1)
        
        product_costs = await db.product_costs_ledger.aggregate([
            {"$match": query}, {"$group": {"_id": None, "total": {"$sum": "$total_cost"}}}
        ]).to_list(1)
        
        operational = await db.operational_expenses_ledger.aggregate([
            {"$match": query}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        return {
            "user_payouts": payouts[0]["total"] if payouts else 0,
            "product_costs": product_costs[0]["total"] if product_costs else 0,
            "operational_expenses": operational[0]["total"] if operational else 0,
            "total_expenses": sum([
                payouts[0]["total"] if payouts else 0,
                product_costs[0]["total"] if product_costs else 0,
                operational[0]["total"] if operational else 0
            ])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/profit-loss")
async def get_profit_loss(start_date: str = None, end_date: str = None):
    """Get profit/loss summary"""
    try:
        income = await get_income_summary(start_date, end_date)
        expenses = await get_expense_summary(start_date, end_date)
        
        total_income = income["total_income"]
        total_expenses = expenses["total_expenses"]
        profit_loss = total_income - total_expenses
        
        return {
            "income": income,
            "expenses": expenses,
            "profit_loss": profit_loss,
            "profit_margin": round((profit_loss / total_income * 100), 2) if total_income > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
