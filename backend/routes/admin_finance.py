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
    """
    COMPREHENSIVE Profit & Loss Statement
    
    REVENUE SOURCES:
    ================
    1. VIP Memberships (Startup ₹299, Growth ₹549, Elite ₹799)
    2. Service Charges (Bill Payments 2%, Gift Vouchers 5%)
    3. Delivery Charges (from product orders)
    4. Ad Revenue (manually tracked)
    5. Other Income
    
    EXPENSE CATEGORIES:
    ===================
    1. Payment Gateway Fees (auto: 2% of payments)
    2. Server/Hosting (manual)
    3. SMS/Email Services (manual)
    4. Marketing (manual)
    5. Cashback/Referral (auto-calculated)
    6. PRC Rewards Given (auto-calculated liability)
    7. Staff Salaries (manual)
    8. Fixed Expenses (auto from fixed_expenses)
    
    STATUS: PROFIT / LOSS / BREAKEVEN
    """
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
        
        # ===== REVENUE CALCULATION =====
        revenue = {
            "vip_memberships": 0,
            "service_charges": 0,
            "processing_fees": 0,  # NEW: Fixed 10 Rs processing fee
            "admin_charges": 0,    # NEW: 20% admin charge
            "delivery_charges": 0,
            "ad_revenue": 0,
            "other_income": 0
        }
        revenue_details = {
            "vip_count": 0,
            "vip_plans": {},
            "bill_payments_count": 0,
            "bill_service_charges": 0,
            "bill_processing_fees": 0,
            "bill_admin_charges": 0,
            "gift_voucher_count": 0,
            "gift_service_charges": 0,
            "gift_processing_fees": 0,
            "gift_admin_charges": 0,
            "luxury_claims_count": 0,
            "luxury_processing_fees": 0,
            "luxury_admin_charges": 0,
            "withdrawal_count": 0,
            "withdrawal_processing_fees": 0,
            "withdrawal_admin_charges": 0,
            "orders_count": 0
        }
        
        # Fee settings (10 Rs fixed + 20% admin charge)
        PROCESSING_FEE_INR = 10
        ADMIN_CHARGE_PERCENT = 20
        
        # 1. VIP Membership Revenue
        vip_payments = await db.vip_payments.find({
            "status": "approved",
            "$or": [
                {"approved_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "amount": 1, "plan_type": 1, "plan_name": 1}).to_list(10000)
        
        for p in vip_payments:
            amount = p.get("amount", 0)
            revenue["vip_memberships"] += amount
            revenue_details["vip_count"] += 1
            plan = p.get("plan_type") or p.get("plan_name") or "unknown"
            revenue_details["vip_plans"][plan] = revenue_details["vip_plans"].get(plan, 0) + 1
        
        # 2. Bill Payment Fees (10 Rs processing + 20% admin charge)
        bill_payments = await db.bill_payment_requests.find({
            "status": "completed",
            "$or": [
                {"completed_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "service_charge": 1, "amount_inr": 1, "processing_fee": 1, "admin_charge": 1}).to_list(10000)
        
        bill_count = len(bill_payments)
        bill_processing_fees = bill_count * PROCESSING_FEE_INR
        bill_admin_charges = sum(bp.get("admin_charge", bp.get("amount_inr", 0) * ADMIN_CHARGE_PERCENT / 100) for bp in bill_payments)
        bill_service_charges = sum(bp.get("service_charge", 0) for bp in bill_payments)
        
        revenue["processing_fees"] += bill_processing_fees
        revenue["admin_charges"] += bill_admin_charges
        revenue["service_charges"] += bill_service_charges
        revenue_details["bill_payments_count"] = bill_count
        revenue_details["bill_processing_fees"] = round(bill_processing_fees, 2)
        revenue_details["bill_admin_charges"] = round(bill_admin_charges, 2)
        revenue_details["bill_service_charges"] = round(bill_service_charges, 2)
        
        # 3. Gift Voucher Fees (10 Rs processing + 20% admin charge)
        gift_vouchers = await db.gift_voucher_requests.find({
            "status": "completed",
            "$or": [
                {"completed_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "service_charge": 1, "denomination": 1, "processing_fee": 1, "admin_charge": 1}).to_list(10000)
        
        gift_count = len(gift_vouchers)
        gift_processing_fees = gift_count * PROCESSING_FEE_INR
        gift_admin_charges = sum(gv.get("admin_charge", gv.get("denomination", 0) * ADMIN_CHARGE_PERCENT / 100) for gv in gift_vouchers)
        gift_service_charges = sum(gv.get("service_charge", 0) for gv in gift_vouchers)
        
        revenue["processing_fees"] += gift_processing_fees
        revenue["admin_charges"] += gift_admin_charges
        revenue["service_charges"] += gift_service_charges
        revenue_details["gift_voucher_count"] = gift_count
        revenue_details["gift_processing_fees"] = round(gift_processing_fees, 2)
        revenue_details["gift_admin_charges"] = round(gift_admin_charges, 2)
        revenue_details["gift_service_charges"] = round(gift_service_charges, 2)
        
        # 4. Luxury Life Claims Fees (10 Rs processing + 20% admin charge)
        luxury_claims = await db.luxury_life_claims.find({
            "status": "completed",
            "$or": [
                {"completed_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "claim_amount": 1, "processing_fee": 1, "admin_charge": 1}).to_list(10000)
        
        luxury_count = len(luxury_claims)
        luxury_processing_fees = luxury_count * PROCESSING_FEE_INR
        luxury_admin_charges = sum(lc.get("admin_charge", lc.get("claim_amount", 0) * ADMIN_CHARGE_PERCENT / 100) for lc in luxury_claims)
        
        revenue["processing_fees"] += luxury_processing_fees
        revenue["admin_charges"] += luxury_admin_charges
        revenue_details["luxury_claims_count"] = luxury_count
        revenue_details["luxury_processing_fees"] = round(luxury_processing_fees, 2)
        revenue_details["luxury_admin_charges"] = round(luxury_admin_charges, 2)
        
        # 5. Withdrawal Fees (10 Rs processing + 20% admin charge)
        withdrawals = await db.cashback_withdrawals.find({
            "status": "completed",
            "$or": [
                {"completed_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "amount": 1, "processing_fee": 1, "admin_charge": 1}).to_list(10000)
        
        withdrawal_count = len(withdrawals)
        withdrawal_processing_fees = withdrawal_count * PROCESSING_FEE_INR
        withdrawal_admin_charges = sum(w.get("admin_charge", w.get("amount", 0) * ADMIN_CHARGE_PERCENT / 100) for w in withdrawals)
        
        revenue["processing_fees"] += withdrawal_processing_fees
        revenue["admin_charges"] += withdrawal_admin_charges
        revenue_details["withdrawal_count"] = withdrawal_count
        revenue_details["withdrawal_processing_fees"] = round(withdrawal_processing_fees, 2)
        revenue_details["withdrawal_admin_charges"] = round(withdrawal_admin_charges, 2)
        
        # 6. Delivery Charges from Orders
        orders = await db.orders.find({
            "status": "delivered",
            "$or": [
                {"delivered_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "delivery_charge": 1}).to_list(10000)
        
        revenue["delivery_charges"] = sum(o.get("delivery_charge", 0) for o in orders)
        revenue_details["orders_count"] = len(orders)
        
        # 7. Ad Revenue
        ads_income = await db.ads_income.find({
            "date": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "amount": 1}).to_list(1000)
        revenue["ad_revenue"] = sum(ai.get("amount", 0) for ai in ads_income)
        
        # 8. Other Income
        other_income = await db.other_income.find({
            "date": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "amount": 1}).to_list(1000)
        revenue["other_income"] = sum(oi.get("amount", 0) for oi in other_income)
        
        total_revenue = sum(revenue.values())
        
        # ===== EXPENSE CALCULATION =====
        expenses = {
            "payment_gateway_fees": 0,
            "bill_payment_payouts": 0,      # NEW: INR paid for user bill payments
            "gift_voucher_payouts": 0,      # NEW: INR paid for gift vouchers
            "withdrawal_payouts": 0,        # NEW: INR paid for user withdrawals
            "luxury_claim_payouts": 0,      # NEW: INR paid for luxury claims
            "server_hosting": 0,
            "sms_email_services": 0,
            "marketing": 0,
            "cashback_referral": 0,
            "prc_rewards": 0,
            "staff_salary": 0,
            "office_rent": 0,
            "fixed_expenses": 0,
            "miscellaneous": 0
        }
        
        expense_details = {
            "bill_payment_count": 0,
            "bill_payment_total_inr": 0,
            "gift_voucher_count": 0,
            "gift_voucher_total_inr": 0,
            "withdrawal_count": 0,
            "withdrawal_total_inr": 0,
            "luxury_claim_count": 0,
            "luxury_claim_total_inr": 0
        }
        
        # 1. User Payout Expenses - Bill Payments (actual INR paid out)
        bill_payout_data = await db.bill_payment_requests.find({
            "status": "completed",
            "$or": [
                {"completed_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "amount_inr": 1, "payout_amount": 1}).to_list(10000)
        
        bill_payout_total = sum(bp.get("payout_amount", bp.get("amount_inr", 0)) for bp in bill_payout_data)
        expenses["bill_payment_payouts"] = round(bill_payout_total, 2)
        expense_details["bill_payment_count"] = len(bill_payout_data)
        expense_details["bill_payment_total_inr"] = round(bill_payout_total, 2)
        
        # 2. User Payout Expenses - Gift Vouchers (actual INR paid out)
        gift_payout_data = await db.gift_voucher_requests.find({
            "status": "completed",
            "$or": [
                {"completed_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "denomination": 1, "payout_amount": 1}).to_list(10000)
        
        gift_payout_total = sum(gv.get("payout_amount", gv.get("denomination", 0)) for gv in gift_payout_data)
        expenses["gift_voucher_payouts"] = round(gift_payout_total, 2)
        expense_details["gift_voucher_count"] = len(gift_payout_data)
        expense_details["gift_voucher_total_inr"] = round(gift_payout_total, 2)
        
        # 3. User Payout Expenses - Withdrawals (actual INR paid out)
        withdrawal_payout_data = await db.cashback_withdrawals.find({
            "status": "completed",
            "$or": [
                {"completed_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "amount": 1, "payout_amount": 1, "net_amount": 1}).to_list(10000)
        
        withdrawal_payout_total = sum(w.get("payout_amount", w.get("net_amount", w.get("amount", 0))) for w in withdrawal_payout_data)
        expenses["withdrawal_payouts"] = round(withdrawal_payout_total, 2)
        expense_details["withdrawal_count"] = len(withdrawal_payout_data)
        expense_details["withdrawal_total_inr"] = round(withdrawal_payout_total, 2)
        
        # 4. User Payout Expenses - Luxury Life Claims (actual INR paid out)
        luxury_payout_data = await db.luxury_life_claims.find({
            "status": "completed",
            "$or": [
                {"completed_at": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "claim_amount": 1, "payout_amount": 1}).to_list(10000)
        
        luxury_payout_total = sum(lc.get("payout_amount", lc.get("claim_amount", 0)) for lc in luxury_payout_data)
        expenses["luxury_claim_payouts"] = round(luxury_payout_total, 2)
        expense_details["luxury_claim_count"] = len(luxury_payout_data)
        expense_details["luxury_claim_total_inr"] = round(luxury_payout_total, 2)
        
        # 5. Manual Expenses
        manual_expenses = await db.expenses.find({
            "date": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0}).to_list(10000)
        
        for exp in manual_expenses:
            category = exp.get("category", "miscellaneous")
            amount = exp.get("amount", 0)
            if category in expenses:
                expenses[category] += amount
            else:
                expenses["miscellaneous"] += amount
        
        # 6. Auto: Payment Gateway Fees (2% of VIP revenue)
        expenses["payment_gateway_fees"] = round(revenue["vip_memberships"] * 0.02, 2)
        
        # 7. Auto: Fixed Monthly Expenses (prorated if not full month)
        fixed_expenses = await db.fixed_expenses.find({"active": True}, {"_id": 0}).to_list(100)
        fixed_total = sum(fe.get("monthly_amount", 0) for fe in fixed_expenses)
        
        # Prorate for partial periods
        if period == "day":
            expenses["fixed_expenses"] = round(fixed_total / 30, 2)  # Daily portion
        elif period == "week":
            expenses["fixed_expenses"] = round(fixed_total / 4, 2)  # Weekly portion
        else:
            expenses["fixed_expenses"] = round(fixed_total, 2)  # Full month
        
        # 4. Auto: Cashback/Referral bonuses
        referral_txns = await db.transactions.find({
            "transaction_type": {"$in": ["referral_bonus", "cashback", "referral"]},
            "$or": [
                {"timestamp": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "amount": 1}).to_list(50000)
        expenses["cashback_referral"] = round(sum(abs(t.get("amount", 0)) for t in referral_txns) * 0.10, 2)  # PRC value
        
        # 5. Auto: PRC Mining rewards (liability at ₹0.10 per PRC)
        mining_txns = await db.transactions.find({
            "transaction_type": {"$in": ["mining", "tap_game", "prc_rain_gain"]},
            "$or": [
                {"timestamp": {"$gte": start_str, "$lte": end_str}},
                {"created_at": {"$gte": start_str, "$lte": end_str}}
            ]
        }, {"_id": 0, "amount": 1}).to_list(100000)
        prc_given = sum(abs(t.get("amount", 0)) for t in mining_txns)
        expenses["prc_rewards"] = round(prc_given * 0.10, 2)
        
        total_expenses = sum(expenses.values())
        
        # ===== PROFIT/LOSS =====
        net_profit = total_revenue - total_expenses
        profit_margin = round((net_profit / total_revenue * 100), 2) if total_revenue > 0 else 0
        
        # Status determination
        if net_profit > 100:
            status = "profit"
            status_emoji = "📈"
            status_color = "green"
            status_message_mr = f"Profit: ₹{net_profit:,.2f}"
        elif net_profit < -100:
            status = "loss"
            status_emoji = "📉"
            status_color = "red"
            status_message_mr = f"Loss: ₹{abs(net_profit):,.2f}"
        else:
            status = "breakeven"
            status_emoji = "➡️"
            status_color = "yellow"
            status_message_mr = "Breakeven"
        
        # Health Score (0-100)
        health_score = min(100, max(0, int(50 + profit_margin)))
        
        # ===== INSIGHTS =====
        insights = []
        
        # Fee-based revenue insights
        total_fee_revenue = revenue["processing_fees"] + revenue["admin_charges"]
        if total_fee_revenue > 0:
            insights.append(f"💰 Total Fee Revenue: ₹{total_fee_revenue:,.2f} (Processing: ₹{revenue['processing_fees']:,.2f} + Admin: ₹{revenue['admin_charges']:,.2f})")
        
        if revenue["vip_memberships"] > 0 and total_revenue > 0:
            vip_pct = round(revenue["vip_memberships"] / total_revenue * 100, 1)
            insights.append(f"VIP Memberships = {vip_pct}% of revenue ({revenue_details['vip_count']} members)")
        
        # Service-wise fee breakdown
        if revenue_details["bill_payments_count"] > 0:
            bill_fee_total = revenue_details["bill_processing_fees"] + revenue_details["bill_admin_charges"]
            insights.append(f"📄 Bill Payments: {revenue_details['bill_payments_count']} completed, Fees: ₹{bill_fee_total:,.2f}")
        
        if revenue_details["gift_voucher_count"] > 0:
            gift_fee_total = revenue_details["gift_processing_fees"] + revenue_details["gift_admin_charges"]
            insights.append(f"🎁 Gift Vouchers: {revenue_details['gift_voucher_count']} completed, Fees: ₹{gift_fee_total:,.2f}")
        
        if revenue_details["luxury_claims_count"] > 0:
            luxury_fee_total = revenue_details["luxury_processing_fees"] + revenue_details["luxury_admin_charges"]
            insights.append(f"✨ Luxury Claims: {revenue_details['luxury_claims_count']} completed, Fees: ₹{luxury_fee_total:,.2f}")
        
        if revenue_details["withdrawal_count"] > 0:
            withdrawal_fee_total = revenue_details["withdrawal_processing_fees"] + revenue_details["withdrawal_admin_charges"]
            insights.append(f"💸 Withdrawals: {revenue_details['withdrawal_count']} completed, Fees: ₹{withdrawal_fee_total:,.2f}")
        
        # User payout expenses insights
        total_user_payouts = expenses["bill_payment_payouts"] + expenses["gift_voucher_payouts"] + expenses["withdrawal_payouts"] + expenses["luxury_claim_payouts"]
        if total_user_payouts > 0:
            insights.append(f"💳 Total User Payouts (INR): ₹{total_user_payouts:,.2f}")
        
        if expenses["prc_rewards"] > total_revenue * 0.3:
            insights.append("⚠️ PRC rewards are too high (>30% of revenue)")
        
        if expenses["cashback_referral"] > total_revenue * 0.2:
            insights.append("⚠️ Referral bonus expenses are high")
        
        if profit_margin > 50:
            insights.append("✅ Excellent profit margin!")
        elif profit_margin < 10 and profit_margin > 0:
            insights.append("💡 Low profit margin - reduce expenses")
        
        return {
            "period": period,
            "period_label": period_label,
            "start_date": start_str,
            "end_date": end_str,
            
            # Easy-to-understand summary
            "summary": {
                "gross_revenue": round(total_revenue, 2),
                "total_expenses": round(total_expenses, 2),
                "net_profit": round(net_profit, 2),
                "profit_margin": profit_margin,
                "status": status,
                "status_emoji": status_emoji,
                "status_color": status_color,
                "status_message": status_message_mr,
                "health_score": health_score
            },
            
            # Revenue breakdown
            "revenue": {
                "total": round(total_revenue, 2),
                "breakdown": {k: round(v, 2) for k, v in revenue.items()},
                "details": revenue_details
            },
            
            # Expense breakdown  
            "expenses": {
                "total": round(total_expenses, 2),
                "breakdown": {k: round(v, 2) for k, v in expenses.items()},
                "details": expense_details  # NEW: User payout details
            },
            
            # Insights in Marathi
            "insights": insights,
            
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
