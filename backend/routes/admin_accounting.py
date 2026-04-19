from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging
import json
import re
import uuid

# Re-export error helper (defined in server.py)
try:
    from server import get_user_friendly_error
except Exception:
    def get_user_friendly_error(error):
        return str(error)

router = APIRouter(prefix="/admin/accounting", tags=["Admin Accounting"])

db = None

def set_db(database):
    global db
    db = database

@router.get("/prc-mint-ledger")
async def get_prc_mint_ledger(
    page: int = 1,
    limit: int = 50,
    source_type: str = None,
    user_id: str = None,
    start_date: str = None,
    end_date: str = None
):
    """Get PRC mint (inflow) ledger with filters"""
    try:
        query = {"type": {"$in": ["mining", "tap_game", "referral", "cashback", "admin_credit", "profit_share", "delivery_commission", "prc_rain_gain"]}}
        
        if source_type:
            query["type"] = source_type
        if user_id:
            query["user_id"] = user_id
        if start_date:
            query["created_at"] = {"$gte": start_date}
        if end_date:
            query.setdefault("created_at", {})["$lte"] = end_date
        
        skip = (page - 1) * limit
        total = await db.transactions.count_documents(query)
        
        entries = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Calculate summary
        summary_pipeline = [
            {"$match": query},
            {"$group": {
                "_id": "$type",
                "total_prc": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }}
        ]
        summary = await db.transactions.aggregate(summary_pipeline).to_list(20)
        
        total_minted = sum(s.get("total_prc", 0) for s in summary)
        
        return {
            "entries": entries,
            "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit},
            "summary": {
                "by_source": {s["_id"]: {"prc": round(s["total_prc"], 2), "count": s["count"]} for s in summary},
                "total_minted": round(total_minted, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== PRC BURN LEDGER (All PRC Outflows) ==========

@router.get("/prc-burn-ledger")
async def get_prc_burn_ledger(
    page: int = 1,
    limit: int = 50,
    use_type: str = None,
    user_id: str = None,
    start_date: str = None,
    end_date: str = None
):
    """Get PRC burn (outflow) ledger with filters"""
    try:
        query = {"type": {"$in": ["order", "withdrawal", "admin_debit", "delivery_charge", "prc_burn", "bill_payment_request", "gift_voucher_request", "prc_rain_loss"]}}
        
        if use_type:
            query["type"] = use_type
        if user_id:
            query["user_id"] = user_id
        if start_date:
            query["created_at"] = {"$gte": start_date}
        if end_date:
            query.setdefault("created_at", {})["$lte"] = end_date
        
        skip = (page - 1) * limit
        total = await db.transactions.count_documents(query)
        
        entries = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Calculate summary
        summary_pipeline = [
            {"$match": query},
            {"$group": {
                "_id": "$type",
                "total_prc": {"$sum": {"$abs": "$amount"}},
                "count": {"$sum": 1}
            }}
        ]
        summary = await db.transactions.aggregate(summary_pipeline).to_list(20)
        
        total_burned = sum(s.get("total_prc", 0) for s in summary)
        
        return {
            "entries": entries,
            "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit},
            "summary": {
                "by_use_type": {s["_id"]: {"prc": round(s["total_prc"], 2), "count": s["count"]} for s in summary},
                "total_burned": round(total_burned, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== LIABILITY LEDGER (INR Redemption Tracking) ==========

@router.get("/liability-ledger")
async def get_liability_ledger(page: int = 1, limit: int = 50):
    """Get liability ledger - tracks INR owed for PRC redemptions"""
    try:
        # Get all redemption-type transactions (bill payments, gift vouchers, orders)
        query = {"type": {"$in": ["bill_payment_request", "gift_voucher_request", "order"]}}
        
        skip = (page - 1) * limit
        total = await db.transactions.count_documents(query)
        
        entries = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Get conversion rate
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        # Calculate liability summary
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": None,
                "total_prc_redeemed": {"$sum": {"$abs": "$amount"}},
                "total_count": {"$sum": 1}
            }}
        ]
        summary = await db.transactions.aggregate(pipeline).to_list(1)
        
        total_prc_redeemed = summary[0].get("total_prc_redeemed", 0) if summary else 0
        total_inr_liability = total_prc_redeemed / prc_per_inr
        
        # Get paid liabilities from company wallets
        paid_pipeline = [
            {"$match": {"wallet_type": "redeem_reserve"}},
            {"$project": {"balance": 1}}
        ]
        redeem_wallet = await db.company_wallets.find_one({"wallet_type": "redeem_reserve"}, {"_id": 0, "balance": 1})
        inr_paid = redeem_wallet.get("balance", 0) if redeem_wallet else 0
        
        # Liability ageing
        now = datetime.now(timezone.utc)
        ageing = {"safe": 0, "warning": 0, "critical": 0}
        
        for entry in entries:
            created_at_str = entry.get("created_at", "")
            try:
                if isinstance(created_at_str, str):
                    created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                else:
                    created_at = created_at_str
                days_old = (now - created_at).days
                prc_amount = abs(entry.get("amount", 0))
                inr_value = prc_amount / prc_per_inr
                
                if days_old <= 7:
                    ageing["safe"] += inr_value
                elif days_old <= 30:
                    ageing["warning"] += inr_value
                else:
                    ageing["critical"] += inr_value
            except:
                pass
        
        return {
            "entries": entries,
            "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit},
            "summary": {
                "total_prc_redeemed": round(total_prc_redeemed, 2),
                "total_inr_liability": round(total_inr_liability, 2),
                "inr_paid": round(inr_paid, 2),
                "inr_pending": round(total_inr_liability - inr_paid, 2),
                "conversion_rate": prc_per_inr
            },
            "ageing": {
                "safe_0_7_days": round(ageing["safe"], 2),
                "warning_8_30_days": round(ageing["warning"], 2),
                "critical_31_plus_days": round(ageing["critical"], 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== CONVERSION RATE MANAGEMENT ==========

@router.get("/conversion-rate")
async def get_conversion_rate():
    """Get current conversion rate and history"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        current_rate = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        # Get rate history
        history = await db.conversion_rate_history.find({}, {"_id": 0}).sort("effective_from", -1).limit(20).to_list(20)
        
        return {
            "current_rate": current_rate,
            "description": f"1 INR = {current_rate} PRC",
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/conversion-rate")
async def update_conversion_rate(request: Request):
    """Update conversion rate (Admin only) - maintains history"""
    try:
        data = await request.json()
        new_rate = data.get("prc_per_inr")
        reason = data.get("reason", "Admin update")
        
        if not new_rate or new_rate <= 0:
            raise HTTPException(status_code=400, detail="Invalid conversion rate")
        
        # Get current rate
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        old_rate = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        now = datetime.now(timezone.utc)
        
        # Close previous rate's effective_to
        await db.conversion_rate_history.update_one(
            {"effective_to": None},
            {"$set": {"effective_to": now.isoformat()}}
        )
        
        # Insert new rate history
        await db.conversion_rate_history.insert_one({
            "rate_id": str(uuid.uuid4()),
            "prc_per_inr": new_rate,
            "old_rate": old_rate,
            "reason": reason,
            "effective_from": now.isoformat(),
            "effective_to": None,
            "created_by": data.get("admin_id", "system")
        })
        
        # Update settings
        await db.settings.update_one(
            {},
            {"$set": {"accounting_settings.prc_per_inr": new_rate}},
            upsert=True
        )
        
        return {
            "success": True,
            "message": f"Conversion rate updated from {old_rate} to {new_rate} PRC per INR",
            "new_rate": new_rate
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== RESERVE FUND MANAGEMENT ==========

@router.get("/reserve-fund")
async def get_reserve_fund():
    """Get reserve fund status and history"""
    try:
        # Get reserve fund settings
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        accounting = settings.get("accounting_settings", {}) if settings else {}
        
        reserve_percentage = accounting.get("reserve_fund_percentage", 10)  # Default 10%
        
        # Get reserve fund balance from company wallets
        reserve_wallet = await db.company_wallets.find_one({"wallet_type": "reserve_fund"}, {"_id": 0})
        
        if not reserve_wallet:
            # Create reserve fund wallet if not exists
            reserve_wallet = {
                "wallet_type": "reserve_fund",
                "name": "Reserve Fund",
                "balance": 0,
                "description": "Emergency reserve for liability protection",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.company_wallets.insert_one(reserve_wallet)
        
        # Get reserve fund history
        history = await db.reserve_fund_ledger.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
        
        # Calculate total liability for comparison
        prc_per_inr = accounting.get("prc_per_inr", 10)
        liability_pipeline = [
            {"$match": {"type": {"$in": ["bill_payment_request", "gift_voucher_request", "order"]}}},
            {"$group": {"_id": None, "total_prc": {"$sum": {"$abs": "$amount"}}}}
        ]
        liability_result = await db.transactions.aggregate(liability_pipeline).to_list(1)
        total_liability_prc = liability_result[0].get("total_prc", 0) if liability_result else 0
        total_liability_inr = total_liability_prc / prc_per_inr
        
        reserve_balance = reserve_wallet.get("balance", 0)
        backing_ratio = reserve_balance / total_liability_inr if total_liability_inr > 0 else float('inf')
        
        return {
            "balance": round(reserve_balance, 2),
            "percentage": reserve_percentage,
            "total_liability_inr": round(total_liability_inr, 2),
            "backing_ratio": round(backing_ratio, 4) if backing_ratio != float('inf') else "∞",
            "status": "SAFE" if backing_ratio >= 1 else "AT RISK",
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/reserve-fund/add")
async def add_to_reserve_fund(request: Request):
    """Add funds to reserve fund"""
    try:
        data = await request.json()
        amount = data.get("amount", 0)
        reason = data.get("reason", "Manual addition")
        
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        # Update reserve fund wallet
        await db.company_wallets.update_one(
            {"wallet_type": "reserve_fund"},
            {"$inc": {"balance": amount}},
            upsert=True
        )
        
        # Log to reserve fund ledger
        await db.reserve_fund_ledger.insert_one({
            "ledger_id": str(uuid.uuid4()),
            "type": "credit",
            "amount": amount,
            "reason": reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": data.get("admin_id", "system")
        })
        
        return {"success": True, "message": f"₹{amount} added to reserve fund"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/reserve-fund/settings")
async def update_reserve_fund_settings(request: Request):
    """Update reserve fund settings (percentage allocation from profit)"""
    try:
        data = await request.json()
        percentage = data.get("percentage", 10)
        
        if percentage < 0 or percentage > 100:
            raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
        
        await db.settings.update_one(
            {},
            {"$set": {"accounting_settings.reserve_fund_percentage": percentage}},
            upsert=True
        )
        
        return {"success": True, "message": f"Reserve fund percentage set to {percentage}%"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== DAILY SYSTEM SUMMARY (Auto-calculated) ==========

async def generate_daily_summary(target_date: str = None):
    """Generate daily system summary - can be called manually or by scheduler"""
    try:
        if target_date:
            date_obj = datetime.fromisoformat(target_date)
        else:
            date_obj = datetime.now(timezone.utc) - timedelta(days=1)
        
        date_str = date_obj.strftime("%Y-%m-%d")
        start_of_day = date_str + "T00:00:00"
        end_of_day = date_str + "T23:59:59"
        
        # Get accounting settings
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        reserve_percentage = settings.get("accounting_settings", {}).get("reserve_fund_percentage", 10) if settings else 10
        
        # Active users (logged in today)
        active_users = await db.users.count_documents({
            "last_login": {"$gte": start_of_day, "$lte": end_of_day}
        })
        
        # PRC Minted
        mint_types = ["mining", "tap_game", "referral", "cashback", "admin_credit", "profit_share", "delivery_commission", "prc_rain_gain"]
        mint_result = await db.transactions.aggregate([
            {"$match": {"type": {"$in": mint_types}, "created_at": {"$gte": start_of_day, "$lte": end_of_day}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        prc_minted = mint_result[0].get("total", 0) if mint_result else 0
        
        # PRC Burned
        burn_types = ["order", "withdrawal", "admin_debit", "delivery_charge", "prc_burn", "bill_payment_request", "gift_voucher_request", "prc_rain_loss"]
        burn_result = await db.transactions.aggregate([
            {"$match": {"type": {"$in": burn_types}, "created_at": {"$gte": start_of_day, "$lte": end_of_day}}},
            {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
        ]).to_list(1)
        prc_burned = burn_result[0].get("total", 0) if burn_result else 0
        
        # Net PRC in system (all time)
        all_mint = await db.transactions.aggregate([
            {"$match": {"type": {"$in": mint_types}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        all_burn = await db.transactions.aggregate([
            {"$match": {"type": {"$in": burn_types}}},
            {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
        ]).to_list(1)
        total_minted = all_mint[0].get("total", 0) if all_mint else 0
        total_burned = all_burn[0].get("total", 0) if all_burn else 0
        net_prc_in_system = total_minted - total_burned
        
        # Liability INR
        liability_types = ["bill_payment_request", "gift_voucher_request", "order"]
        liability_result = await db.transactions.aggregate([
            {"$match": {"type": {"$in": liability_types}}},
            {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
        ]).to_list(1)
        total_liability_prc = liability_result[0].get("total", 0) if liability_result else 0
        liability_inr = total_liability_prc / prc_per_inr
        
        # Revenue INR (ads + VIP subscriptions)
        ads_revenue = await db.ads_income.aggregate([
            {"$match": {"date": {"$gte": start_of_day[:10], "$lte": end_of_day[:10]}}},
            {"$group": {"_id": None, "total": {"$sum": "$revenue_amount"}}}
        ]).to_list(1)
        ads_inr = ads_revenue[0].get("total", 0) if ads_revenue else 0
        
        vip_revenue = await db.vip_payments.aggregate([
            {"$match": {"status": "approved", "created_at": {"$gte": start_of_day, "$lte": end_of_day}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        vip_inr = vip_revenue[0].get("total", 0) if vip_revenue else 0
        
        revenue_inr = ads_inr + vip_inr
        
        # Expenses INR
        month_str = date_obj.strftime("%Y-%m")
        expenses_result = await db.fixed_expenses.aggregate([
            {"$match": {"month": month_str}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        # Prorate daily
        days_in_month = 30
        expense_inr = (expenses_result[0].get("total", 0) / days_in_month) if expenses_result else 0
        
        # Reserve Fund
        reserve_wallet = await db.company_wallets.find_one({"wallet_type": "reserve_fund"}, {"_id": 0, "balance": 1})
        reserve_fund = reserve_wallet.get("balance", 0) if reserve_wallet else 0
        
        # Net Profit/Loss
        net_profit_loss = revenue_inr - expense_inr - (liability_inr * 0.1)  # Assume 10% of liability as daily cost
        
        # Risk Score (0-100)
        backing_ratio = reserve_fund / liability_inr if liability_inr > 0 else 10
        risk_score = min(100, max(0, int(
            (backing_ratio * 30) +  # Backing ratio weight
            ((revenue_inr / max(expense_inr, 1)) * 20) +  # Revenue vs expense ratio
            ((prc_burned / max(prc_minted, 1)) * 30) +  # Burn vs mint ratio
            (20 if net_profit_loss > 0 else 0)  # Profitability bonus
        )))
        
        # Create summary
        summary = {
            "date": date_str,
            "active_users": active_users,
            "prc_minted": round(prc_minted, 2),
            "prc_burned": round(prc_burned, 2),
            "net_prc_in_system": round(net_prc_in_system, 2),
            "liability_inr": round(liability_inr, 2),
            "revenue_inr": round(revenue_inr, 2),
            "expense_inr": round(expense_inr, 2),
            "reserve_fund": round(reserve_fund, 2),
            "net_profit_loss": round(net_profit_loss, 2),
            "risk_score": risk_score,
            "risk_status": "SAFE" if risk_score >= 70 else "WARNING" if risk_score >= 40 else "CRITICAL",
            "backing_ratio": round(backing_ratio, 4),
            "conversion_rate": prc_per_inr,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert daily summary
        await db.daily_system_summary.update_one(
            {"date": date_str},
            {"$set": summary},
            upsert=True
        )
        
        return summary
    except Exception as e:
        logging.error(f"Error generating daily summary: {e}")
        raise


@router.get("/daily-summary")
async def get_daily_summaries(days: int = 30):
    """Get daily system summaries for the past N days"""
    try:
        summaries = await db.daily_system_summary.find({}, {"_id": 0}).sort("date", -1).limit(days).to_list(days)
        
        # Calculate trends
        if len(summaries) >= 2:
            latest = summaries[0]
            previous = summaries[1]
            trends = {
                "prc_minted_change": round(latest.get("prc_minted", 0) - previous.get("prc_minted", 0), 2),
                "prc_burned_change": round(latest.get("prc_burned", 0) - previous.get("prc_burned", 0), 2),
                "revenue_change": round(latest.get("revenue_inr", 0) - previous.get("revenue_inr", 0), 2),
                "risk_score_change": latest.get("risk_score", 0) - previous.get("risk_score", 0)
            }
        else:
            trends = None
        
        return {
            "summaries": summaries,
            "trends": trends,
            "latest": summaries[0] if summaries else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/daily-summary/generate")
async def trigger_daily_summary(request: Request):
    """Manually trigger daily summary generation"""
    try:
        data = await request.json()
        target_date = data.get("date")  # Optional specific date
        
        summary = await generate_daily_summary(target_date)
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== USER COST ANALYSIS (Loss-making Users) ==========

@router.get("/user-cost-analysis")
async def get_user_cost_analysis(page: int = 1, limit: int = 50, filter_type: str = "loss"):
    """Analyze user cost vs revenue - identify loss-making users"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        # Get all users with their PRC stats
        pipeline = [
            {"$group": {
                "_id": "$user_id",
                "total_earned": {"$sum": {"$cond": [
                    {"$in": ["$type", ["mining", "tap_game", "referral", "cashback", "admin_credit", "prc_rain_gain"]]},
                    "$amount",
                    0
                ]}},
                "total_spent": {"$sum": {"$cond": [
                    {"$in": ["$type", ["order", "bill_payment_request", "gift_voucher_request"]]},
                    {"$abs": "$amount"},
                    0
                ]}}
            }},
            {"$addFields": {
                "earned_inr_value": {"$divide": ["$total_earned", prc_per_inr]},
                "spent_inr_value": {"$divide": ["$total_spent", prc_per_inr]},
                "net_cost": {"$subtract": [
                    {"$divide": ["$total_earned", prc_per_inr]},
                    {"$divide": ["$total_spent", prc_per_inr]}
                ]}
            }},
            {"$sort": {"net_cost": -1 if filter_type == "loss" else 1}},
            {"$skip": (page - 1) * limit},
            {"$limit": limit}
        ]
        
        user_analysis = await db.transactions.aggregate(pipeline).to_list(limit)
        
        # Enrich with user details
        for analysis in user_analysis:
            user = await db.users.find_one({"uid": analysis["_id"]}, {"_id": 0, "email": 1, "name": 1, "membership_type": 1})
            if user:
                analysis["email"] = user.get("email")
                analysis["name"] = user.get("name")
                analysis["membership_type"] = user.get("membership_type", "free")
            analysis["status"] = "LOSS" if analysis["net_cost"] > 0 else "PROFIT"
            analysis["net_cost"] = round(analysis["net_cost"], 2)
            analysis["earned_inr_value"] = round(analysis["earned_inr_value"], 2)
            analysis["spent_inr_value"] = round(analysis["spent_inr_value"], 2)
        
        # Summary stats
        total_pipeline = [
            {"$group": {
                "_id": None,
                "total_earned": {"$sum": {"$cond": [
                    {"$in": ["$type", ["mining", "tap_game", "referral", "cashback", "admin_credit", "prc_rain_gain"]]},
                    "$amount",
                    0
                ]}},
                "total_spent": {"$sum": {"$cond": [
                    {"$in": ["$type", ["order", "bill_payment_request", "gift_voucher_request"]]},
                    {"$abs": "$amount"},
                    0
                ]}}
            }}
        ]
        total_result = await db.transactions.aggregate(total_pipeline).to_list(1)
        
        if total_result:
            total_earned_inr = total_result[0].get("total_earned", 0) / prc_per_inr
            total_spent_inr = total_result[0].get("total_spent", 0) / prc_per_inr
        else:
            total_earned_inr = 0
            total_spent_inr = 0
        
        return {
            "users": user_analysis,
            "pagination": {"page": page, "limit": limit},
            "summary": {
                "total_prc_distributed_value_inr": round(total_earned_inr, 2),
                "total_prc_redeemed_value_inr": round(total_spent_inr, 2),
                "net_system_cost": round(total_earned_inr - total_spent_inr, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== 180-DAY PRC EXPIRY - DEPRECATED MARCH 2026 ==========

async def burn_inactive_user_prc():
    """DEPRECATED - Burn module removed March 2026"""
    logging.info("[180-DAY BURN] Feature disabled - burn module removed")
    return {"users_affected": 0, "total_burned": 0.0, "deprecated": True}


@router.post("/burn-inactive-prc")
async def trigger_inactive_prc_burn():
    """DEPRECATED - Manually trigger inactive user PRC burn (180 days)"""
    return {"success": True, "result": {"deprecated": True, "message": "Burn module removed March 2026"}}


# ========== ACCOUNT HARD DELETE SCHEDULED TASK ==========

async def hard_delete_expired_accounts():
    """
    Permanently delete accounts that have been soft-deleted for 30+ days.
    Runs daily at 3 AM.
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Find all accounts scheduled for hard deletion
        accounts_to_delete = db.users.find({
            "is_deleted": True,
            "deletion_scheduled_at": {"$lte": now.isoformat()}
        })
        
        delete_count = 0
        
        # FIX: Use to_list() instead of async for to prevent cursor leak
        accounts_list = await accounts_to_delete.to_list(length=1000)
        for user in accounts_list:
            uid = user.get("uid")
            email = user.get("email")
            
            try:
                # Archive user data before permanent deletion
                await db.deleted_users_archive.insert_one({
                    "uid": uid,
                    "email": email,
                    "name": user.get("name"),
                    "deleted_at": user.get("deleted_at"),
                    "hard_deleted_at": now.isoformat(),
                    "prc_forfeited": user.get("prc_balance_forfeited", 0),
                    "cashback_forfeited": user.get("cashback_forfeited", 0),
                    "deletion_reason": user.get("deletion_reason"),
                    "membership_type": user.get("membership_type"),
                    "created_at": user.get("created_at")
                })
                
                # Permanently delete user
                await db.users.delete_one({"uid": uid})
                
                # Update account_deletions log
                await db.account_deletions.update_one(
                    {"uid": uid, "status": "pending"},
                    {"$set": {
                        "status": "completed",
                        "hard_deleted_at": now.isoformat()
                    }}
                )
                
                delete_count += 1
                logging.info(f"Hard deleted account: {uid} ({email})")
                
            except Exception as e:
                logging.error(f"Error hard deleting user {uid}: {e}")
        
        logging.info(f"Account hard delete: {delete_count} accounts permanently deleted")
        return {"accounts_deleted": delete_count}
        
    except Exception as e:
        logging.error(f"Error in hard_delete_expired_accounts: {e}")
        return {"accounts_deleted": 0, "error": str(e)}


@router.post("/admin/accounts/hard-delete-expired")
async def trigger_hard_delete_expired():
    """Manually trigger hard deletion of expired accounts (admin only)"""
    try:
        result = await hard_delete_expired_accounts()
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.get("/admin/accounts/pending-deletions")
async def get_pending_deletions():
    """Get list of accounts pending deletion"""
    try:
        pending = await db.account_deletions.find(
            {"status": "pending"},
            {"_id": 0}
        ).to_list(100)
        
        return {
            "pending_count": len(pending),
            "accounts": pending
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== MASTER ACCOUNTING DASHBOARD ==========

@router.get("/master-dashboard")
async def get_master_accounting_dashboard():
    """Get comprehensive accounting dashboard data"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        
        # Get latest daily summary
        latest_summary = await db.daily_system_summary.find_one({"date": {"$lt": today_str}}, {"_id": 0}, sort=[("date", -1)])
        
        # Total users
        total_users = await db.users.count_documents({})
        vip_users = await db.users.count_documents({"membership_type": "vip"})
        
        # PRC Supply
        mint_types = ["mining", "tap_game", "referral", "cashback", "admin_credit", "profit_share", "delivery_commission", "prc_rain_gain"]
        burn_types = ["order", "withdrawal", "admin_debit", "delivery_charge", "prc_burn", "bill_payment_request", "gift_voucher_request", "prc_rain_loss"]
        
        total_minted_result = await db.transactions.aggregate([
            {"$match": {"type": {"$in": mint_types}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_minted = total_minted_result[0].get("total", 0) if total_minted_result else 0
        
        total_burned_result = await db.transactions.aggregate([
            {"$match": {"type": {"$in": burn_types}}},
            {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
        ]).to_list(1)
        total_burned = total_burned_result[0].get("total", 0) if total_burned_result else 0
        
        circulating_prc = total_minted - total_burned
        
        # Liability
        liability_types = ["bill_payment_request", "gift_voucher_request", "order"]
        liability_result = await db.transactions.aggregate([
            {"$match": {"type": {"$in": liability_types}}},
            {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
        ]).to_list(1)
        total_liability_prc = liability_result[0].get("total", 0) if liability_result else 0
        total_liability_inr = total_liability_prc / prc_per_inr
        
        # Reserve Fund & Backing Ratio
        reserve_wallet = await db.company_wallets.find_one({"wallet_type": "reserve_fund"}, {"_id": 0, "balance": 1})
        reserve_fund = reserve_wallet.get("balance", 0) if reserve_wallet else 0
        backing_ratio = reserve_fund / total_liability_inr if total_liability_inr > 0 else float('inf')
        
        # Company Wallets Summary
        wallets = await db.company_wallets.find({}, {"_id": 0}).to_list(10)
        total_cash = sum(w.get("balance", 0) for w in wallets)
        
        # Monthly Revenue & Expense
        month_str = now.strftime("%Y-%m")
        ads_revenue = await db.ads_income.aggregate([
            {"$match": {"date": {"$regex": f"^{month_str}"}}},
            {"$group": {"_id": None, "total": {"$sum": "$revenue_amount"}}}
        ]).to_list(1)
        monthly_ads = ads_revenue[0].get("total", 0) if ads_revenue else 0
        
        vip_revenue = await db.vip_payments.aggregate([
            {"$match": {"status": "approved", "created_at": {"$regex": f"^{month_str}"}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        monthly_vip = vip_revenue[0].get("total", 0) if vip_revenue else 0
        
        expenses = await db.fixed_expenses.aggregate([
            {"$match": {"month": month_str}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        monthly_expenses = expenses[0].get("total", 0) if expenses else 0
        
        monthly_revenue = monthly_ads + monthly_vip
        monthly_profit = monthly_revenue - monthly_expenses
        
        # Risk Assessment
        risk_score = latest_summary.get("risk_score", 50) if latest_summary else 50
        
        # Alerts
        alerts = []
        if backing_ratio < 1:
            alerts.append({"type": "CRITICAL", "message": "PRC Backing Ratio below 1.0 - Liability exceeds reserves"})
        if total_liability_inr > monthly_revenue * 3:
            alerts.append({"type": "WARNING", "message": "Liability exceeds 3x monthly revenue"})
        if monthly_profit < 0:
            alerts.append({"type": "WARNING", "message": f"Monthly loss: ₹{abs(monthly_profit):,.2f}"})
        
        return {
            "overview": {
                "total_users": total_users,
                "vip_users": vip_users,
                "conversion_rate": f"1 INR = {prc_per_inr} PRC"
            },
            "prc_supply": {
                "total_minted": round(total_minted, 2),
                "total_burned": round(total_burned, 2),
                "circulating": round(circulating_prc, 2),
                "circulating_inr_value": round(circulating_prc / prc_per_inr, 2)
            },
            "liability": {
                "total_prc_redeemed": round(total_liability_prc, 2),
                "total_inr_liability": round(total_liability_inr, 2),
                "reserve_fund": round(reserve_fund, 2),
                "backing_ratio": round(backing_ratio, 4) if backing_ratio != float('inf') else "∞",
                "backing_status": "SAFE" if backing_ratio >= 1 else "AT RISK"
            },
            "financials": {
                "total_cash_available": round(total_cash, 2),
                "monthly_revenue": round(monthly_revenue, 2),
                "monthly_expenses": round(monthly_expenses, 2),
                "monthly_profit_loss": round(monthly_profit, 2),
                "profit_status": "PROFIT" if monthly_profit >= 0 else "LOSS"
            },
            "risk": {
                "score": risk_score,
                "status": "SAFE" if risk_score >= 70 else "WARNING" if risk_score >= 40 else "CRITICAL"
            },
            "alerts": alerts,
            "wallets": wallets,
            "latest_summary": latest_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== ACCOUNTING SETTINGS ==========

@router.get("/settings")
async def get_accounting_settings():
    """Get all accounting settings"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        
        default_settings = {
            "prc_per_inr": 10,
            "reserve_fund_percentage": 10,
            "inactive_expiry_days": 180,
            "liability_warning_threshold": 0.8,
            "liability_critical_threshold": 1.0,
            "auto_daily_summary": True,
            "auto_reserve_allocation": True
        }
        
        if settings and settings.get("accounting_settings"):
            return {**default_settings, **settings["accounting_settings"]}
        return default_settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/settings")
async def update_accounting_settings(request: Request):
    """Update accounting settings"""
    try:
        data = await request.json()
        
        allowed_fields = [
            "prc_per_inr", "reserve_fund_percentage", "inactive_expiry_days",
            "liability_warning_threshold", "liability_critical_threshold",
            "auto_daily_summary", "auto_reserve_allocation"
        ]
        
        update_data = {f"accounting_settings.{k}": v for k, v in data.items() if k in allowed_fields}
        
        if update_data:
            await db.settings.update_one({}, {"$set": update_data}, upsert=True)
        
        return {"success": True, "message": "Accounting settings updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ==================== MANAGER ROLE ACCESS CONTROL ====================

# Default permissions for manager role
DEFAULT_MANAGER_PERMISSIONS = [
    "dashboard", "members", "users", "user360", "subscription_payment", "kyc", 
    "gift_vouchers",
    # Manager can access these payment pages
    "bank-transfers", "razorpay-subs", "bbps-dashboard", "eko-services"
]

# All available admin pages/permissions (Cleaned - March 2026)
ALL_ADMIN_PERMISSIONS = [
    # General
    {"id": "dashboard", "label": "Dashboard", "category": "General"},
    {"id": "members", "label": "Members Dashboard", "category": "General"},
    {"id": "user360", "label": "User 360° View", "category": "General"},
    {"id": "users", "label": "Users Management", "category": "General"},
    {"id": "analytics", "label": "Analytics", "category": "General"},
    {"id": "performance-report", "label": "Admin Performance", "category": "General"},
    
    # Operations
    {"id": "kyc", "label": "KYC Verification", "category": "Operations"},
    {"id": "support", "label": "Support Tickets", "category": "Operations"},
    {"id": "contact-submissions", "label": "Contact Inquiries", "category": "Operations"},
    {"id": "popup-messages", "label": "Popup Messages", "category": "Operations"},
    {"id": "error-monitor", "label": "System Monitor", "category": "Operations"},
    
    # Payments - Active
    {"id": "subscriptions", "label": "Subscription Payments", "category": "Payments"},
    {"id": "bank-transfers", "label": "Redeem to Bank", "category": "Payments"},
    {"id": "razorpay-subs", "label": "Razorpay Payments", "category": "Payments"},
    {"id": "bbps-dashboard", "label": "BBPS Instant", "category": "Payments"},
    {"id": "eko-services", "label": "Eko Direct Services", "category": "Payments"},
    {"id": "gift-vouchers", "label": "Gift Vouchers", "category": "Payments"},
    
    # Finance
    {"id": "accounting", "label": "Accounting Dashboard", "category": "Finance"},
    {"id": "company-wallets", "label": "Company Wallets", "category": "Finance"},
    {"id": "prc-analytics", "label": "PRC Analytics", "category": "Finance"},
    {"id": "prc-ledger", "label": "PRC Ledger", "category": "Finance"},
    {"id": "profit-loss", "label": "Profit & Loss", "category": "Finance"},
    {"id": "user-ledger", "label": "User Ledger", "category": "Finance"},
    {"id": "liquidity", "label": "Liquidity Status", "category": "Finance"},
    
    # Security
    {"id": "fraud-dashboard", "label": "Fraud Dashboard", "category": "Security"},
    {"id": "fraud-alerts", "label": "Fraud Alerts", "category": "Security"},
    {"id": "security", "label": "Security Dashboard", "category": "Security"},
    {"id": "prc-economy", "label": "PRC Token Economy", "category": "Security"},
    {"id": "data-backup", "label": "Data Backup & Archive", "category": "Security"},
    
    # Settings
    {"id": "settings-hub", "label": "All Settings", "category": "Settings"},
]

@router.get("/admin/permissions/list")
async def get_all_permissions():
    """Get list of all available permissions for manager role"""
    return {
        "permissions": ALL_ADMIN_PERMISSIONS,
        "default_manager": DEFAULT_MANAGER_PERMISSIONS
    }

@router.get("/admin/user/{uid}/permissions")
async def get_user_permissions(uid: str):
    """Get permissions for a specific user (manager)"""
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "role": 1, "allowed_pages": 1, "name": 1, "email": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Admin has all permissions
        if user.get("role") == "admin":
            return {
                "user": user,
                "permissions": [p["id"] for p in ALL_ADMIN_PERMISSIONS],
                "is_admin": True
            }
        
        # Manager has restricted permissions
        return {
            "user": user,
            "permissions": user.get("allowed_pages", DEFAULT_MANAGER_PERMISSIONS),
            "is_admin": False
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/admin/user/{uid}/permissions")
async def update_user_permissions(uid: str, request: Request):
    """Update permissions for a manager"""
    try:
        data = await request.json()
        permissions = data.get("permissions", [])
        
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.get("role") == "admin":
            raise HTTPException(status_code=400, detail="Cannot modify admin permissions")
        
        # Validate permissions
        valid_permissions = [p["id"] for p in ALL_ADMIN_PERMISSIONS]
        permissions = [p for p in permissions if p in valid_permissions]
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"allowed_pages": permissions, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"success": True, "permissions": permissions, "message": "Permissions updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/admin/managers/sync-permissions")
async def sync_manager_permissions():
    """
    Sync all managers to have the default permissions.
    This updates existing managers with new default permissions.
    """
    try:
        # Find all managers
        managers = await db.users.find({"role": "manager"}).to_list(1000)
        
        updated_count = 0
        for manager in managers:
            current_perms = set(manager.get("allowed_pages", []))
            default_perms = set(DEFAULT_MANAGER_PERMISSIONS)
            
            # Add any missing default permissions
            new_perms = list(current_perms | default_perms)
            
            if set(new_perms) != current_perms:
                await db.users.update_one(
                    {"uid": manager.get("uid")},
                    {"$set": {"allowed_pages": new_perms}}
                )
                updated_count += 1
        
        return {
            "success": True,
            "total_managers": len(managers),
            "updated": updated_count,
            "default_permissions": DEFAULT_MANAGER_PERMISSIONS,
            "message": f"Synced permissions for {updated_count} managers"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== VIDEO ADS ENDPOINTS ==========

class VideoAdRequest(BaseModel):
    """Video ad creation/update request"""
    title: str
    video_url: str
    video_type: str = "youtube"  # 'direct', 'youtube', 'vimeo'
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    placement: str = "homepage"  # 'homepage', 'marketplace', 'pre_game', 'dashboard'
    is_active: bool = True
    autoplay: bool = True
    skippable: bool = True
    skip_after: int = 5
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    target_roles: List[str] = ["user"]  # Can target specific user roles

async def create_video_ad(request: VideoAdRequest):
    """Admin: Create a new video advertisement"""
    try:
        video_ad_id = f"video_{uuid.uuid4()}"
        
        video_ad = {
            "video_ad_id": video_ad_id,
            "title": request.title,
            "video_url": request.video_url,
            "video_type": request.video_type,
            "thumbnail_url": request.thumbnail_url,
            "description": request.description,
            "placement": request.placement,
            "is_active": request.is_active,
            "autoplay": request.autoplay,
            "skippable": request.skippable,
            "skip_after": request.skip_after,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "target_roles": request.target_roles,
            "views": 0,
            "skips": 0,
            "completions": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.video_ads.insert_one(video_ad)
        
        return {
            "success": True,
            "video_ad_id": video_ad_id,
            "message": "Video ad created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/admin/video-ads")
async def get_all_video_ads(
    placement: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """Admin: Get all video advertisements"""
    try:
        query = {}
        if placement:
            query["placement"] = placement
        if is_active is not None:
            query["is_active"] = is_active
        
        video_ads = await db.video_ads.find(query).sort("created_at", -1).to_list(length=1000)
        
        return {
            "success": True,
            "video_ads": video_ads,
            "total": len(video_ads)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/video-ads/active")
async def get_active_video_ads(
    placement: str = "homepage",
    user_role: str = "user"
):
    """Get active video ads for specific placement and user role"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        
        query = {
            "is_active": True,
            "placement": placement,
            "target_roles": {"$in": [user_role, "all"]},
            "$or": [
                {"start_date": None},
                {"start_date": {"$lte": now}}
            ],
            "$or": [
                {"end_date": None},
                {"end_date": {"$gte": now}}
            ]
        }
        
        video_ads = await db.video_ads.find(query).sort("created_at", -1).limit(5).to_list(length=5)
        
        return {
            "success": True,
            "video_ads": video_ads
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/admin/video-ads/{video_ad_id}")
async def update_video_ad(video_ad_id: str, request: VideoAdRequest):
    """Admin: Update video advertisement"""
    try:
        update_data = request.dict()
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await db.video_ads.update_one(
            {"video_ad_id": video_ad_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Video ad not found")
        
        return {
            "success": True,
            "message": "Video ad updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.delete("/admin/video-ads/{video_ad_id}")
async def delete_video_ad(video_ad_id: str):
    """Admin: Delete video advertisement"""
    try:
        result = await db.video_ads.delete_one({"video_ad_id": video_ad_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Video ad not found")
        
        return {
            "success": True,
            "message": "Video ad deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/video-ads/{video_ad_id}/track")
async def track_video_ad_event(
    video_ad_id: str,
    event_type: str,  # 'view', 'skip', 'complete'
    watch_time: Optional[float] = 0
):
    """Track video ad engagement events"""
    try:
        update_field = {}
        if event_type == "view":
            update_field = {"$inc": {"views": 1}}
        elif event_type == "skip":
            update_field = {"$inc": {"skips": 1}}
        elif event_type == "complete":
            update_field = {"$inc": {"completions": 1}}
        
        if update_field:
            await db.video_ads.update_one(
                {"video_ad_id": video_ad_id},
                update_field
            )
        
        # Log individual event
        await db.video_ad_events.insert_one({
            "event_id": f"event_{uuid.uuid4()}",
            "video_ad_id": video_ad_id,
            "event_type": event_type,
            "watch_time": watch_time,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ============================================
# ADMIN POLICIES MANAGEMENT
# ============================================

@router.get("/admin/policies")
async def get_policies():
    """Get all policies (terms, privacy, refund)"""
    try:
        policies = await db.policies.find_one({"type": "app_policies"}, {"_id": 0})
        if not policies:
            return {
                "terms": "",
                "privacy": "",
                "refund": ""
            }
        return {
            "terms": policies.get("terms", ""),
            "privacy": policies.get("privacy", ""),
            "refund": policies.get("refund", "")
        }
    except Exception as e:
        print(f"Error fetching policies: {e}")
        return {"terms": "", "privacy": "", "refund": ""}

@router.post("/admin/policies")
async def update_policies(data: dict):
    """Update policies"""
    try:
        await db.policies.update_one(
            {"type": "app_policies"},
            {
                "$set": {
                    "terms": data.get("terms", ""),
                    "privacy": data.get("privacy", ""),
                    "refund": data.get("refund", ""),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        return {"message": "Policies updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/policies/{policy_type}")
async def get_public_policy(policy_type: str):
    """Get a specific policy for public display"""
    if policy_type not in ["terms", "privacy", "refund"]:
        raise HTTPException(status_code=400, detail="Invalid policy type")
    
    try:
        policies = await db.policies.find_one({"type": "app_policies"}, {"_id": 0})
        if not policies:
            return {"content": "", "policy_type": policy_type}
        return {
            "content": policies.get(policy_type, ""),
            "policy_type": policy_type
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ============================================
# VIP PAYMENT TRANSACTIONS FOR USER HISTORY
# ============================================

@router.get("/user/vip-transactions/{uid}")
async def get_user_vip_transactions(uid: str, page: int = 1, limit: int = 10):
    """Get VIP payment transactions for a user"""
    try:
        skip = (page - 1) * limit
        
        # Get VIP payments for user
        payments = await db.vip_payments.find(
            {"user_id": uid},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        total = await db.vip_payments.count_documents({"user_id": uid})
        
        return {
            "transactions": payments,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit,
                "has_next": skip + limit < total,
                "has_prev": page > 1
            }
        }
    except Exception as e:
        print(f"Error fetching VIP transactions: {e}")
        return {"transactions": [], "pagination": {}}

@router.get("/user/vip-invoice/{payment_id}")
async def get_vip_invoice(payment_id: str):
    """Get invoice details for a VIP payment"""
    try:
        payment = await db.vip_payments.find_one({"payment_id": payment_id}, {"_id": 0})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Get user details
        user = await db.users.find_one({"uid": payment["user_id"]}, {"_id": 0, "name": 1, "email": 1, "mobile": 1, "address_line1": 1, "city": 1, "state": 1, "pincode": 1})
        
        # Plan names
        plan_names = {
            "monthly": "Monthly VIP Plan",
            "quarterly": "Quarterly VIP Plan",
            "half_yearly": "Half-Yearly VIP Plan",
            "yearly": "Yearly VIP Plan"
        }
        
        invoice_data = {
            "invoice_number": payment.get("invoice_number", f"INV-{payment_id[:8].upper()}"),
            "payment_id": payment_id,
            "date": payment.get("approved_at") or payment.get("submitted_at"),
            "status": payment.get("status"),
            
            # Customer details
            "customer_name": user.get("name", "N/A") if user else "N/A",
            "customer_email": user.get("email", "N/A") if user else "N/A",
            "customer_mobile": user.get("mobile", "N/A") if user else "N/A",
            "customer_address": f"{user.get('address_line1', '')}, {user.get('city', '')}, {user.get('state', '')} - {user.get('pincode', '')}" if user else "N/A",
            
            # Plan details
            "plan_type": payment.get("plan_type", "monthly"),
            "plan_name": plan_names.get(payment.get("plan_type", "monthly"), "VIP Membership"),
            "duration_days": payment.get("duration_days", 30),
            
            # Payment details
            "amount": payment.get("amount", 0),
            "payment_method": payment.get("payment_method", "UPI"),
            "utr_number": payment.get("utr_number", "N/A"),
            
            # Validity
            "validity_start": payment.get("validity_start"),
            "validity_end": payment.get("validity_end"),
            
            # Company details
            "company_name": "PARAS REWARD",
            "company_address": "India",
            "company_email": "support@parasreward.com",
            "company_gstin": "N/A"
        }
        
        return invoice_data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating invoice: {e}")
        raise HTTPException(status_code=500, detail="Error generating invoice")

@router.post("/user/vip-auto-renew/{uid}")
async def toggle_auto_renew(uid: str, request: Request):
    """Toggle auto-renew setting for VIP membership"""
    try:
        data = await request.json()
        auto_renew = data.get("auto_renew", False)
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"auto_renew": auto_renew, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": f"Auto-renew {'enabled' if auto_renew else 'disabled'}", "auto_renew": auto_renew}
    except Exception as e:
        print(f"Error toggling auto-renew: {e}")
        raise HTTPException(status_code=500, detail="Error updating auto-renew setting")


# ========== LIVE PLATFORM STATS (PUBLIC - Google Policy Compliant) ==========

@router.get("/public/live-stats")
async def get_live_platform_stats():
    """
    Get live platform statistics for transparency panel
    Google Play Compliant - Shows activity stats, not revenue
    
    Returns:
    - Today PRC Earned (platform-wide)
    - Today PRC Burned (platform-wide)
    - Redeems Completed Today (count only)
    - Active Users (approximate)
    """
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        today_prc_earned = 0
        today_prc_burned = 0
        redeems_today = 0
        
        # Try transactions collection first
        earned_pipeline = [
            {
                "$match": {
                    "transaction_type": {"$in": ["mining", "tap_game", "referral_bonus", "cashback", "prc_rain", "signup_bonus"]},
                    "created_at": {"$gte": today_start.isoformat()}
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        earned_result = await db.transactions.aggregate(earned_pipeline).to_list(1)
        if earned_result:
            today_prc_earned = round(earned_result[0].get("total", 0), 2)
        
        # Also check wallet_transactions as fallback
        if today_prc_earned == 0:
            wallet_earned = await db.wallet_transactions.aggregate([
                {"$match": {"type": {"$in": ["credit", "mining", "tap", "referral", "bonus"]}, "created_at": {"$gte": today_start.isoformat()}}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1)
            if wallet_earned:
                today_prc_earned = round(wallet_earned[0].get("total", 0), 2)
        
        # Also aggregate from user mining_history for today
        if today_prc_earned == 0:
            mining_today = await db.users.aggregate([
                {"$unwind": {"path": "$mining_history", "preserveNullAndEmptyArrays": False}},
                {"$match": {"mining_history.timestamp": {"$gte": today_start.isoformat()}}},
                {"$group": {"_id": None, "total": {"$sum": "$mining_history.amount"}}}
            ]).to_list(1)
            if mining_today:
                today_prc_earned = round(mining_today[0].get("total", 0), 2)
        
        # PRC Burned from transactions
        burned_pipeline = [
            {
                "$match": {
                    "transaction_type": {"$in": ["order", "redeem", "gift_voucher", "bill_payment", "burn", "expired"]},
                    "created_at": {"$gte": today_start.isoformat()}
                }
            },
            {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
        ]
        burned_result = await db.transactions.aggregate(burned_pipeline).to_list(1)
        if burned_result:
            today_prc_burned = round(burned_result[0].get("total", 0), 2)
        
        # Fallback: check wallet_transactions for debits
        if today_prc_burned == 0:
            wallet_burned = await db.wallet_transactions.aggregate([
                {"$match": {"type": {"$in": ["debit", "order", "redeem", "burn"]}, "created_at": {"$gte": today_start.isoformat()}}},
                {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
            ]).to_list(1)
            if wallet_burned:
                today_prc_burned = round(wallet_burned[0].get("total", 0), 2)
        
        # Redeems completed today (count only - no amounts for compliance)
        redeems_today = await db.transactions.count_documents({
            "transaction_type": {"$in": ["redeem", "gift_voucher", "bill_payment"]},
            "created_at": {"$gte": today_start.isoformat()}
        })
        
        # Fallback: check redeem_requests
        if redeems_today == 0:
            redeems_today = await db.redeem_requests.count_documents({
                "status": "completed",
                "created_at": {"$gte": today_start.isoformat()}
            })
        
        # Active users - users who logged in within last 7 days
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        active_users = await db.users.count_documents({
            "last_login": {"$gte": seven_days_ago}
        })
        
        # Fallback: count all active users
        if active_users == 0:
            active_users = await db.users.count_documents({"is_active": True})
        
        # Get total PRC in system for reference
        total_prc_result = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        total_prc = round(total_prc_result[0].get("total", 0), 2) if total_prc_result else 0
        
        # Get total products count
        total_products = await db.products.count_documents({"is_active": True})
        if total_products == 0:
            total_products = await db.products.count_documents({})
        
        # Get total PRC distributed (sum of all credits)
        total_distributed_result = await db.transactions.aggregate([
            {"$match": {"amount": {"$gt": 0}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_prc_distributed = round(total_distributed_result[0].get("total", 0), 2) if total_distributed_result else 0
        
        # Fallback from user totals
        if total_prc_distributed == 0:
            user_totals = await db.users.aggregate([
                {"$group": {"_id": None, "total": {"$sum": "$total_mined"}}}
            ]).to_list(1)
            total_prc_distributed = round(user_totals[0].get("total", 0), 2) if user_totals else 0
        
        return {
            "today_prc_earned": today_prc_earned,
            "today_prc_burned": today_prc_burned,
            "redeems_today": redeems_today,
            "active_users": active_users,
            "total_prc_in_system": total_prc,
            "total_prc_distributed": total_prc_distributed,
            "total_products": total_products,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logging.error(f"Error fetching live stats: {e}")
        # Return safe fallback data
        return {
            "today_prc_earned": 0,
            "today_prc_burned": 0,
            "redeems_today": 0,
            "active_users": 0,
            "total_prc_in_system": 0,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


@router.post("/referrals/milestone-achievement")
async def record_milestone_achievement(request: Request):
    """Record a milestone achievement for global live activity"""
    try:
        data = await request.json()
        uid = data.get("uid")
        milestone_count = data.get("milestone_count")
        milestone_badge = data.get("milestone_badge")
        milestone_title = data.get("milestone_title")
        milestone_color = data.get("milestone_color", "amber")
        
        if not uid or not milestone_count:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Get user info
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "name": 1, "city": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Anonymize name
        name = user.get("name", "User")
        display_name = name.split()[0][:3] + "***" if name else "User"
        
        # Record achievement
        achievement = {
            "achievement_id": str(uuid.uuid4()),
            "uid": uid,
            "display_name": display_name,
            "city": user.get("city", "Mumbai"),
            "milestone_count": milestone_count,
            "milestone_badge": milestone_badge,
            "milestone_title": milestone_title,
            "milestone_color": milestone_color,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.milestone_achievements.insert_one(achievement)
        
        return {"success": True, "message": "Achievement recorded"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error recording milestone: {e}")
        raise HTTPException(status_code=500, detail="Failed to record achievement")


@router.get("/public/live-activity")
async def get_live_activity_feed():
    """
    Get live activity feed for social proof - ENHANCED VERSION
    Shows real-time user activities with engaging descriptions
    """
    try:
        activities = []
        
        # ========== 1. RECENT SUBSCRIPTIONS (Most Valuable) ==========
        recent_subs = await db.vip_payments.find(
            {"status": "approved"},
            {"_id": 0, "user_id": 1, "subscription_plan": 1, "approved_at": 1}
        ).sort("approved_at", -1).limit(10).to_list(10)
        
        for sub in recent_subs:
            user = await db.users.find_one({"uid": sub.get("user_id")}, {"_id": 0, "name": 1, "city": 1, "state": 1})
            if user:
                city = user.get("city") or user.get("state") or "India"
                name = (user.get("name", "User") or "User")[:3] + "***"
                plan = sub.get("subscription_plan", "VIP").capitalize()
                
                # Engaging subscription messages
                sub_messages = {
                    "startup": ["joined the Startup squad! 🚀", "unlocked Startup benefits! ⭐", "became a Startup member! 💪"],
                    "growth": ["leveled up to Growth! 📈", "unlocked Growth power! 🔥", "joined Growth elite! 🌟"],
                    "elite": ["achieved Elite status! 👑", "joined the Elite club! 💎", "unlocked Elite rewards! 🏆"]
                }
                import secrets as _secrets
                plan_lower = sub.get("subscription_plan", "startup").lower()
                _choices = sub_messages.get(plan_lower, ["upgraded their plan! ⭐"])
                message = _choices[_secrets.randbelow(len(_choices))]
                
                activities.append({
                    "city": city,
                    "name": name,
                    "action": "subscription",
                    "icon": "👑" if plan_lower == "elite" else "🚀" if plan_lower == "growth" else "⭐",
                    "text": message,
                    "highlight": True,
                    "plan": plan,
                    "time_ago": _get_time_ago(sub.get("approved_at")),
                    "color": "amber" if plan_lower == "elite" else "purple" if plan_lower == "growth" else "blue"
                })
        
        # ========== 2. NEW USER REGISTRATIONS ==========
        twenty_four_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        new_users = await db.users.find(
            {"created_at": {"$gte": twenty_four_hours_ago}},
            {"_id": 0, "name": 1, "city": 1, "state": 1, "created_at": 1, "referred_by": 1}
        ).sort("created_at", -1).limit(15).to_list(15)
        
        for user in new_users:
            city = user.get("city") or user.get("state") or "India"
            name = (user.get("name", "User") or "User")[:3] + "***"
            is_referral = bool(user.get("referred_by"))
            
            join_messages = [
                "joined the community! 🎉",
                "started their PRC journey! 🌟", 
                "became a member! 💫",
                "joined the reward family! 🎊"
            ]
            referral_messages = [
                "joined via referral! 🤝",
                "got invited & joined! 🔗",
                "came through a friend! 👥"
            ]
            
            import secrets as _secrets
            _msg_pool = referral_messages if is_referral else join_messages
            message = _msg_pool[_secrets.randbelow(len(_msg_pool))]
            
            activities.append({
                "city": city,
                "name": name,
                "action": "registration",
                "icon": "🤝" if is_referral else "👋",
                "text": message,
                "time_ago": _get_time_ago(user.get("created_at")),
                "color": "green" if is_referral else "blue"
            })
        
        # ========== 3. BILL PAYMENT REDEMPTIONS ==========
        recent_bills = await db.bill_payment_requests.find(
            {"status": {"$in": ["approved", "completed"]}},
            {"_id": 0, "user_id": 1, "bill_type": 1, "amount_inr": 1, "approved_at": 1, "created_at": 1}
        ).sort("approved_at", -1).limit(10).to_list(10)
        
        for bill in recent_bills:
            user = await db.users.find_one({"uid": bill.get("user_id")}, {"_id": 0, "name": 1, "city": 1, "state": 1})
            if user:
                city = user.get("city") or user.get("state") or "India"
                name = (user.get("name", "User") or "User")[:3] + "***"
                bill_type = bill.get("bill_type", "bill").replace("_", " ").title()
                
                bill_messages = [
                    f"paid their {bill_type}! 💸",
                    f"redeemed for {bill_type}! ✅",
                    f"cleared {bill_type} with PRC! 🎯"
                ]
                import secrets as _secrets
                
                activities.append({
                    "city": city,
                    "name": name,
                    "action": "redeem",
                    "icon": "💳",
                    "text": bill_messages[_secrets.randbelow(len(bill_messages))],
                    "time_ago": _get_time_ago(bill.get("approved_at") or bill.get("created_at")),
                    "color": "emerald"
                })
        
        # ========== 4. GIFT VOUCHER CLAIMS ==========
        recent_vouchers = await db.gift_voucher_requests.find(
            {"status": {"$in": ["approved", "completed"]}},
            {"_id": 0, "user_id": 1, "voucher_type": 1, "approved_at": 1, "created_at": 1}
        ).sort("approved_at", -1).limit(8).to_list(8)
        
        for voucher in recent_vouchers:
            user = await db.users.find_one({"uid": voucher.get("user_id")}, {"_id": 0, "name": 1, "city": 1, "state": 1})
            if user:
                city = user.get("city") or user.get("state") or "India"
                name = (user.get("name", "User") or "User")[:3] + "***"
                voucher_type = voucher.get("voucher_type", "gift").replace("_", " ").title()
                
                activities.append({
                    "city": city,
                    "name": name,
                    "action": "voucher",
                    "icon": "🎁",
                    "text": f"claimed {voucher_type} voucher! 🎁",
                    "time_ago": _get_time_ago(voucher.get("approved_at") or voucher.get("created_at")),
                    "color": "pink"
                })
        
        # ========== 5. MILESTONES & ACHIEVEMENTS ==========
        recent_milestones = await db.milestone_achievements.find(
            {},
            {"_id": 0, "user_id": 1, "milestone_title": 1, "milestone_badge": 1, "created_at": 1}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        for milestone in recent_milestones:
            user = await db.users.find_one({"uid": milestone.get("user_id")}, {"_id": 0, "name": 1, "city": 1, "state": 1})
            if user:
                city = user.get("city") or user.get("state") or "India"
                name = (user.get("name", "User") or "User")[:3] + "***"
                badge = milestone.get("milestone_badge", "🏆")
                title = milestone.get("milestone_title", "Achievement")
                
                activities.append({
                    "city": city,
                    "name": name,
                    "action": "milestone",
                    "icon": badge,
                    "text": f"unlocked '{title}'! {badge}",
                    "highlight": True,
                    "time_ago": _get_time_ago(milestone.get("created_at")),
                    "color": "amber"
                })
        
        # ========== 6. MINING EARNINGS (Recent) ==========
        six_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
        mining_txns = await db.transactions.find(
            {"type": "mining", "timestamp": {"$gte": six_hours_ago}},
            {"_id": 0, "user_id": 1, "amount": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(10).to_list(10)
        
        for txn in mining_txns:
            user = await db.users.find_one({"uid": txn.get("user_id")}, {"_id": 0, "name": 1, "city": 1, "state": 1})
            if user:
                city = user.get("city") or user.get("state") or "India"
                name = (user.get("name", "User") or "User")[:3] + "***"
                amount = txn.get("amount", 0)
                
                mining_messages = [
                    f"mined {amount:.1f} PRC! ⛏️",
                    f"earned {amount:.1f} PRC mining! 💰",
                    f"collected {amount:.1f} PRC! ✨"
                ]
                import secrets as _secrets
                
                activities.append({
                    "city": city,
                    "name": name,
                    "action": "mining",
                    "icon": "⛏️",
                    "text": mining_messages[_secrets.randbelow(len(mining_messages))],
                    "time_ago": _get_time_ago(txn.get("timestamp")),
                    "color": "yellow"
                })
        
        # ========== 7. TAP GAME PLAYS ==========
        tap_txns = await db.transactions.find(
            {"type": "tap_game", "timestamp": {"$gte": six_hours_ago}},
            {"_id": 0, "user_id": 1, "amount": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(8).to_list(8)
        
        for txn in tap_txns:
            user = await db.users.find_one({"uid": txn.get("user_id")}, {"_id": 0, "name": 1, "city": 1, "state": 1})
            if user:
                city = user.get("city") or user.get("state") or "India"
                name = (user.get("name", "User") or "User")[:3] + "***"
                
                activities.append({
                    "city": city,
                    "name": name,
                    "action": "tap_game",
                    "icon": "👆",
                    "text": "played Tap Game! 🎮",
                    "time_ago": _get_time_ago(txn.get("timestamp")),
                    "color": "cyan"
                })
        
        # ========== SHUFFLE & PRIORITIZE ==========
        import secrets as _secrets
        
        # Separate by priority
        high_priority = [a for a in activities if a.get("highlight")]
        normal_priority = [a for a in activities if not a.get("highlight")]
        
        # Shuffle within categories using secrets for unpredictability
        for i in range(len(high_priority) - 1, 0, -1):
            j = _secrets.randbelow(i + 1)
            high_priority[i], high_priority[j] = high_priority[j], high_priority[i]
        for i in range(len(normal_priority) - 1, 0, -1):
            j = _secrets.randbelow(i + 1)
            normal_priority[i], normal_priority[j] = normal_priority[j], normal_priority[i]
        
        # Interleave: 1 high priority every 3-4 normal
        final_activities = []
        high_idx = 0
        for i, activity in enumerate(normal_priority[:25]):
            if high_idx < len(high_priority) and i % 4 == 0:
                final_activities.append(high_priority[high_idx])
                high_idx += 1
            final_activities.append(activity)
        
        # Add remaining high priority
        while high_idx < len(high_priority) and len(final_activities) < 30:
            final_activities.append(high_priority[high_idx])
            high_idx += 1
        
        return {"activities": final_activities[:25]}
        
    except Exception as e:
        logging.error(f"Error getting live activity: {e}")
        # Return empty instead of mock data
        return {"activities": []}


def _get_time_ago(timestamp_str):
    """Helper to format time ago"""
    if not timestamp_str:
        return "just now"
    try:
        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        diff = now - timestamp
        
        if diff.total_seconds() < 60:
            return "just now"
        elif diff.total_seconds() < 3600:
            return f"{int(diff.total_seconds() / 60)}m ago"
        elif diff.total_seconds() < 86400:
            return f"{int(diff.total_seconds() / 3600)}h ago"
        else:
            return f"{int(diff.total_seconds() / 86400)}d ago"
    except:
        return "recently"


@router.get("/user/insights/{uid}")
async def get_user_insights(uid: str):
    """
    Get personalized smart insights for user
    Google Play Compliant - No income predictions or money advice
    
    Returns contextual insights like:
    - "आज तुम्ही कालपेक्षा जास्त PRC कमावले"
    - "Recharge goal साठी फक्त 120 PRC बाकी"
    """
    try:
        user = await db.users.find_one({"uid": uid})
        if not user:
            return {"insights": []}
        
        insights = []
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)
        
        prc_balance = user.get("prc_balance", 0)
        total_mined = user.get("total_mined", 0)
        is_vip = is_paid_subscriber(user)  # Use helper function
        mining_active = user.get("mining_active", False)
        
        # Calculate today's and yesterday's earnings from mining history
        mining_history = user.get("mining_history", [])
        today_earned = 0
        yesterday_earned = 0
        
        for entry in mining_history:
            try:
                entry_date = datetime.fromisoformat(entry.get("timestamp", "").replace('Z', '+00:00'))
                if entry_date >= today:
                    today_earned += entry.get("amount", 0)
                elif entry_date >= yesterday and entry_date < today:
                    yesterday_earned += entry.get("amount", 0)
            except:
                pass
        
        # Calculate mining streak
        mining_streak = 0
        if mining_history:
            sorted_history = sorted(mining_history, key=lambda x: x.get("timestamp", ""), reverse=True)
            current_date = today
            for entry in sorted_history:
                try:
                    entry_date = datetime.fromisoformat(entry.get("timestamp", "").replace('Z', '+00:00')).replace(hour=0, minute=0, second=0, microsecond=0)
                    if entry_date == current_date or entry_date == current_date - timedelta(days=1):
                        if entry_date != current_date:
                            current_date = entry_date
                        mining_streak += 1
                    else:
                        break
                except:
                    pass
        
        # Get referral count
        referral_count = await db.users.count_documents({"referred_by": user.get("referral_code")})
        
        # Generate insights based on user data
        
        # 1. Comparison insight (today vs yesterday)
        if today_earned > yesterday_earned and today_earned > 0:
            insights.append({
                "type": "positive",
                "icon": "trending",
                "message": "आज तुम्ही कालपेक्षा जास्त PRC कमावले! 🎉",
                "message_en": "You earned more PRC than yesterday! 🎉",
                "color": "green"
            })
        elif not mining_active and yesterday_earned > 0:
            insights.append({
                "type": "motivational",
                "icon": "zap",
                "message": "Mining सुरू करा, काल पेक्षा कमी PRC आहे! ⚡",
                "message_en": "Start mining, you have less PRC than yesterday! ⚡",
                "color": "orange"
            })
        
        # 2. Goal progress insight
        recharge_goal = 500  # PRC needed for basic recharge
        if prc_balance > 0 and prc_balance < recharge_goal:
            remaining = recharge_goal - prc_balance
            insights.append({
                "type": "goal",
                "icon": "target",
                "message": f"Recharge goal साठी फक्त {remaining:.0f} PRC बाकी! 🎯",
                "message_en": f"Only {remaining:.0f} PRC left for recharge goal! 🎯",
                "color": "blue"
            })
        
        # 3. Streak insight
        if mining_streak >= 3:
            insights.append({
                "type": "streak",
                "icon": "flame",
                "message": f"{mining_streak} दिवस सतत mining! Keep going! 🔥",
                "message_en": f"{mining_streak} day mining streak! Keep going! 🔥",
                "color": "orange"
            })
        
        # 4. VIP benefit insight
        if is_vip:
            insights.append({
                "type": "vip",
                "icon": "award",
                "message": "VIP म्हणून तुम्ही 2x PRC कमावत आहात! 👑",
                "message_en": "As VIP you are earning 2x PRC! 👑",
                "color": "yellow"
            })
        
        # 5. Referral tip
        if referral_count < 5:
            insights.append({
                "type": "tip",
                "icon": "sparkles",
                "message": "आणखी 1 referral = Mining speed boost! 👥",
                "message_en": "1 more referral = Mining speed boost! 👥",
                "color": "purple"
            })
        
        # 6. Close to voucher redemption
        voucher_threshold = 1000
        if prc_balance >= voucher_threshold - 200 and prc_balance < voucher_threshold:
            remaining = voucher_threshold - prc_balance
            insights.append({
                "type": "redeem",
                "icon": "gift",
                "message": f"अजून {remaining:.0f} PRC = ₹100 voucher! 💰",
                "message_en": f"{remaining:.0f} more PRC = ₹100 voucher! 💰",
                "color": "pink"
            })
        
        # 7. High performer insight
        if total_mined > 10000:
            insights.append({
                "type": "achievement",
                "icon": "award",
                "message": "तुम्ही top miners मध्ये आहात! ⭐",
                "message_en": "You are among top miners! ⭐",
                "color": "yellow"
            })
        
        # Default insight if none generated
        if not insights:
            insights.append({
                "type": "default",
                "icon": "zap",
                "message": "Mining सुरू करा आणि rewards मिळवा! ⚡",
                "message_en": "Start mining and earn rewards! ⚡",
                "color": "purple"
            })
        
        return {
            "insights": insights[:5],  # Return max 5 insights
            "stats": {
                "today_earned": round(today_earned, 2),
                "yesterday_earned": round(yesterday_earned, 2),
                "mining_streak": mining_streak,
                "referral_count": referral_count
            }
        }
    except Exception as e:
        logging.error(f"Error generating user insights: {e}")
        return {"insights": [], "stats": {}}


@router.get("/user/security/{uid}")
async def get_user_security_info(uid: str, request: Request):
    """
    Get user security and trust information
    SECURITY: IDOR Protection - Users can only view their own security info
    """
    verify_user_access_sync(request, uid)
    
    try:
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Calculate trust score
        trust_score = 50  # Base score
        if user.get("kyc_status") == "verified":
            trust_score += 20
        if user.get("email"):
            trust_score += 10
        if user.get("phone"):
            trust_score += 10
        if user.get("membership_type") == "vip":
            trust_score += 10
        
        return {
            "accountVerified": True,
            "prcProtected": True,
            "kycStatus": user.get("kyc_status", "pending"),
            "emailVerified": bool(user.get("email")),
            "phoneVerified": bool(user.get("phone")),
            "lastLogin": user.get("last_login"),
            "lastDevice": user.get("last_device", "Mobile Device"),
            "loginLocation": user.get("last_location", "India"),
            "trustScore": min(trust_score, 100)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching security info: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.put("/user/settings/{uid}")
async def update_user_settings(uid: str, request: Request):
    """
    Update user control settings
    SECURITY: IDOR Protection - Users can only update their own settings
    """
    verify_user_access_sync(request, uid)
    
    try:
        data = await request.json()
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        update_data = {}
        
        # Handle mining pause
        if "miningPaused" in data:
            update_data["mining_active"] = not data["miningPaused"]
        
        # Handle daily cap
        if "dailyPrcCap" in data:
            update_data["daily_prc_cap"] = data["dailyPrcCap"]
        
        # Handle utility only mode
        if "utilityOnlyMode" in data:
            update_data["utility_only_mode"] = data["utilityOnlyMode"]
        
        # Handle notifications
        if "notificationsEnabled" in data:
            update_data["notifications_enabled"] = data["notificationsEnabled"]
        
        if update_data:
            update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.users.update_one({"uid": uid}, {"$set": update_data})
        
        return {"success": True, "updated": list(update_data.keys())}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating user settings: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.get("/user/statement/{uid}")
async def get_user_statement(uid: str, request: Request, format: str = "csv", period: str = "month"):
    """
    Generate PRC statement for user
    Google Play Compliant - Header includes disclaimer
    SECURITY: IDOR Protection - Users can only access their own statements
    """
    verify_user_access_sync(request, uid)
    
    try:
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Calculate date range
        now = datetime.now(timezone.utc)
        if period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        elif period == "quarter":
            start_date = now - timedelta(days=90)
        else:  # year
            start_date = now - timedelta(days=365)
        
        # Get transactions
        transactions = await db.transactions.find({
            "user_id": uid,
            "created_at": {"$gte": start_date.isoformat()}
        }).sort("created_at", -1).to_list(1000)
        
        # Also check mining history
        mining_history = user.get("mining_history", [])
        
        if format == "csv":
            # Generate CSV
            lines = [
                "Reward Points Statement – Not a Financial Investment",
                "",
                f"User: {user.get('name', 'User')}",
                f"Email: {user.get('email', 'N/A')}",
                f"Period: {start_date.strftime('%Y-%m-%d')} to {now.strftime('%Y-%m-%d')}",
                f"Current Balance: {user.get('prc_balance', 0)} PRC",
                "",
                "Date,Type,Description,PRC Amount"
            ]
            
            for txn in transactions:
                date = txn.get("created_at", "")[:10]
                txn_type = txn.get("transaction_type", "unknown")
                desc = txn.get("description", txn_type)
                amount = txn.get("amount", 0)
                lines.append(f"{date},{txn_type},{desc},{amount}")
            
            for entry in mining_history:
                try:
                    entry_date = datetime.fromisoformat(entry.get("timestamp", "").replace('Z', '+00:00'))
                    if entry_date >= start_date:
                        date = entry_date.strftime("%Y-%m-%d")
                        amount = entry.get("amount", 0)
                        lines.append(f"{date},mining,Mining Reward,{amount}")
                except:
                    pass
            
            content = "\n".join(lines)
            
            from fastapi.responses import Response
            return Response(
                content=content,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=prc_statement_{period}.csv"}
            )
        else:
            # Return JSON for PDF generation on frontend
            return {
                "user_name": user.get("name", "User"),
                "email": user.get("email", "N/A"),
                "period_start": start_date.isoformat(),
                "period_end": now.isoformat(),
                "current_balance": user.get("prc_balance", 0),
                "transactions": [
                    {
                        "date": txn.get("created_at", "")[:10],
                        "type": txn.get("transaction_type", "unknown"),
                        "description": txn.get("description", ""),
                        "amount": txn.get("amount", 0)
                    }
                    for txn in transactions
                ],
                "disclaimer": "Reward Points Statement – Not a Financial Investment"
            }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating statement: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== PRC ECONOMY EMERGENCY CONTROLS ==========

@router.get("/admin/prc-economy/status")
async def get_prc_economy_status():
    """
    Get current PRC economy status for admin dashboard
    """
    try:
        # Get system settings
        settings = await db.system_settings.find_one({"type": "prc_economy"})
        global_mining_enabled = settings.get("global_mining_enabled", True) if settings else True
        circuit_breaker_active = settings.get("circuit_breaker_active", False) if settings else False
        
        # Get total PRC in system
        total_prc_result = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        total_prc = round(total_prc_result[0].get("total", 0), 2) if total_prc_result else 0
        
        # Get total users
        total_users = await db.users.count_documents({})
        
        # Get daily mint rate (from last 24 hours)
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        daily_mint_pipeline = [
            {"$match": {"created_at": {"$gte": yesterday.isoformat()}, "transaction_type": {"$in": ["mining", "tap_game", "referral_bonus"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        daily_mint_result = await db.transactions.aggregate(daily_mint_pipeline).to_list(1)
        daily_mint_rate = round(daily_mint_result[0].get("total", 0), 2) if daily_mint_result else 0
        
        return {
            "globalMiningEnabled": global_mining_enabled,
            "totalPrcInSystem": total_prc,
            "totalUsers": total_users,
            "dailyMintRate": daily_mint_rate,
            "circuitBreakerActive": circuit_breaker_active
        }
    except Exception as e:
        logging.error(f"Error fetching PRC economy status: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/admin/prc-economy/emergency-stop")
async def emergency_stop_mining(request: Request):
    """
    Emergency stop all mining across platform
    """
    try:
        data = await request.json()
        send_notification = data.get("sendNotification", True)
        
        # Update system settings
        await db.system_settings.update_one(
            {"type": "prc_economy"},
            {
                "$set": {
                    "global_mining_enabled": False,
                    "emergency_stop_at": datetime.now(timezone.utc).isoformat(),
                    "emergency_stop_reason": "Admin initiated emergency stop"
                }
            },
            upsert=True
        )
        
        # Stop mining for all users
        result = await db.users.update_many(
            {"mining_active": True},
            {"$set": {"mining_active": False, "mining_stopped_reason": "emergency_stop"}}
        )
        
        # Log the action
        await db.admin_actions.insert_one({
            "action": "emergency_mining_stop",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "users_affected": result.modified_count,
            "notification_sent": send_notification
        })
        
        # Send notification to users (if enabled)
        if send_notification:
            # FIX: Use to_list() instead of async for to prevent cursor leak
            users_to_notify = await db.users.find({"mining_active": False}, {"uid": 1}).limit(1000).to_list(length=1000)
            if users_to_notify:
                await db.notifications.insert_many([
                    {
                        "user_id": user["uid"],
                        "title": "Mining Paused",
                        "message": "Mining has been temporarily paused for maintenance. We'll notify you when it resumes.",
                        "type": "system",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "read": False
                    }
                    for user in users_to_notify
                ])
        
        return {
            "success": True,
            "usersAffected": result.modified_count,
            "message": "Mining stopped for all users"
        }
    except Exception as e:
        logging.error(f"Error in emergency stop: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/admin/prc-economy/resume-mining")
async def resume_mining(request: Request):
    """
    Resume mining for all users
    """
    try:
        data = await request.json()
        send_notification = data.get("sendNotification", True)
        
        # Update system settings
        await db.system_settings.update_one(
            {"type": "prc_economy"},
            {
                "$set": {
                    "global_mining_enabled": True,
                    "mining_resumed_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Resume mining for users who were stopped by emergency
        result = await db.users.update_many(
            {"mining_stopped_reason": "emergency_stop"},
            {
                "$set": {"mining_active": True},
                "$unset": {"mining_stopped_reason": ""}
            }
        )
        
        # Log the action
        await db.admin_actions.insert_one({
            "action": "mining_resumed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "users_affected": result.modified_count,
            "notification_sent": send_notification
        })
        
        return {
            "success": True,
            "usersAffected": result.modified_count,
            "message": "Mining resumed for all users"
        }
    except Exception as e:
        logging.error(f"Error resuming mining: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/admin/prc-economy/burn-preview")
async def preview_prc_burn(request: Request):
    """
    Preview the impact of a PRC burn without executing
    """
    try:
        data = await request.json()
        method = data.get("method", "progressive")
        flat_percentage = data.get("flatPercentage", 5)
        progressive_rates = data.get("progressiveRates", [
            {"minBalance": 50000, "percentage": 15},
            {"minBalance": 20000, "percentage": 10},
            {"minBalance": 10000, "percentage": 7},
            {"minBalance": 5000, "percentage": 5},
            {"minBalance": 0, "percentage": 2}
        ])
        min_protected_balance = data.get("minProtectedBalance", 5000)
        
        # Get all users with balance above minimum
        users = await db.users.find(
            {"prc_balance": {"$gt": min_protected_balance}},
            {"uid": 1, "prc_balance": 1}
        ).to_list(1000)
        
        total_burn = 0
        users_affected = 0
        
        for user in users:
            balance = user.get("prc_balance", 0)
            
            if method == "progressive":
                # Find applicable rate
                burn_percentage = 0
                for rate in sorted(progressive_rates, key=lambda x: x["minBalance"], reverse=True):
                    if balance >= rate["minBalance"]:
                        burn_percentage = rate["percentage"]
                        break
                burn_amount = balance * (burn_percentage / 100)
            elif method == "flat":
                burn_amount = balance * (flat_percentage / 100)
            else:  # cap method
                cap = data.get("cap", 50000)
                burn_amount = max(0, balance - cap)
            
            # Ensure user keeps minimum protected balance
            max_burn = balance - min_protected_balance
            burn_amount = min(burn_amount, max_burn)
            
            if burn_amount > 0:
                total_burn += burn_amount
                users_affected += 1
        
        # Get users who will be protected
        users_protected = await db.users.count_documents(
            {"prc_balance": {"$lte": min_protected_balance}}
        )
        
        # Get current total PRC
        total_prc_result = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        current_total = total_prc_result[0].get("total", 0) if total_prc_result else 0
        
        return {
            "usersAffected": users_affected,
            "totalBurn": round(total_burn, 2),
            "usersProtected": users_protected,
            "currentTotalPrc": round(current_total, 2),
            "newTotalPrc": round(current_total - total_burn, 2),
            "reductionPercentage": round((total_burn / current_total) * 100, 2) if current_total > 0 else 0
        }
    except Exception as e:
        logging.error(f"Error in burn preview: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/admin/prc-economy/execute-burn")
async def execute_prc_burn(request: Request):
    """
    Execute PRC burn across all eligible users
    """
    try:
        data = await request.json()
        method = data.get("method", "progressive")
        flat_percentage = data.get("flatPercentage", 5)
        progressive_rates = data.get("progressiveRates", [
            {"minBalance": 50000, "percentage": 15},
            {"minBalance": 20000, "percentage": 10},
            {"minBalance": 10000, "percentage": 7},
            {"minBalance": 5000, "percentage": 5},
            {"minBalance": 0, "percentage": 2}
        ])
        min_protected_balance = data.get("minProtectedBalance", 5000)
        send_notification = data.get("sendNotification", True)
        
        # Get all users with balance above minimum
        users = await db.users.find(
            {"prc_balance": {"$gt": min_protected_balance}},
            {"uid": 1, "prc_balance": 1, "email": 1}
        ).to_list(1000)
        
        total_burn = 0
        users_affected = 0
        burn_details = []
        
        for user in users:
            balance = user.get("prc_balance", 0)
            
            if method == "progressive":
                burn_percentage = 0
                for rate in sorted(progressive_rates, key=lambda x: x["minBalance"], reverse=True):
                    if balance >= rate["minBalance"]:
                        burn_percentage = rate["percentage"]
                        break
                burn_amount = balance * (burn_percentage / 100)
            elif method == "flat":
                burn_amount = balance * (flat_percentage / 100)
            else:
                cap = data.get("cap", 50000)
                burn_amount = max(0, balance - cap)
            
            max_burn = balance - min_protected_balance
            burn_amount = min(burn_amount, max_burn)
            
            if burn_amount > 0:
                new_balance = balance - burn_amount
                
                # Update user balance
                await db.users.update_one(
                    {"uid": user["uid"]},
                    {"$set": {"prc_balance": round(new_balance, 2)}}
                )
                
                # Record transaction
                await db.transactions.insert_one({
                    "user_id": user["uid"],
                    "transaction_type": "burn",
                    "amount": -burn_amount,
                    "balance_after": new_balance,
                    "description": f"Economy stabilization burn ({method} method)",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                total_burn += burn_amount
                users_affected += 1
                burn_details.append({
                    "uid": user["uid"],
                    "burned": burn_amount,
                    "new_balance": new_balance
                })
        
        # Log the burn action
        burn_log = {
            "action": "prc_burn",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "method": method,
            "total_burned": round(total_burn, 2),
            "users_affected": users_affected,
            "min_protected_balance": min_protected_balance,
            "notification_sent": send_notification
        }
        await db.admin_actions.insert_one(burn_log)
        
        # Send notifications if enabled
        if send_notification and users_affected > 0:
            notifications = []
            for detail in burn_details[:1000]:  # Limit notifications
                notifications.append({
                    "user_id": detail["uid"],
                    "title": "PRC Balance Adjustment",
                    "message": f"As part of economy maintenance, {detail['burned']:.2f} PRC has been adjusted. Your new balance is {detail['new_balance']:.2f} PRC.",
                    "type": "system",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "read": False
                })
            if notifications:
                await db.notifications.insert_many(notifications)
        
        return {
            "success": True,
            "totalBurned": round(total_burn, 2),
            "usersAffected": users_affected,
            "message": f"Successfully burned {round(total_burn, 2)} PRC from {users_affected} users"
        }
    except Exception as e:
        logging.error(f"Error executing burn: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/admin/prc-economy/circuit-breaker-settings")
async def update_circuit_breaker_settings(request: Request):
    """
    Update auto circuit breaker settings
    """
    try:
        data = await request.json()
        
        await db.system_settings.update_one(
            {"type": "circuit_breakers"},
            {
                "$set": {
                    "daily_mint_limit": data.get("dailyMintLimit", 100000),
                    "total_prc_cap": data.get("totalPrcCap", 10000000),
                    "per_user_daily_limit": data.get("perUserDailyLimit", 1000),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        return {"success": True, "message": "Circuit breaker settings updated"}
    except Exception as e:
        logging.error(f"Error updating circuit breaker settings: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# ========== USER DASHBOARD CARD PREFERENCES ==========

@router.get("/user/dashboard-layout/{uid}")
async def get_user_dashboard_layout(uid: str):
    """
    Get user's dashboard card layout preferences
    """
    try:
        user = await db.users.find_one({"uid": uid}, {"dashboard_layout": 1})
        
        # Default layout
        default_layout = [
            {"id": "prc_balance", "visible": True, "order": 0},
            {"id": "live_transparency", "visible": True, "order": 1},
            {"id": "smart_insights", "visible": True, "order": 2},
            {"id": "stats_cards", "visible": True, "order": 3},
            {"id": "quick_actions", "visible": True, "order": 4},
            {"id": "security_center", "visible": True, "order": 5},
            {"id": "user_controls", "visible": True, "order": 6},
            {"id": "statement_export", "visible": True, "order": 7},
            {"id": "live_activity", "visible": True, "order": 8}
        ]
        
        return {
            "layout": user.get("dashboard_layout", default_layout) if user else default_layout
        }
    except Exception as e:
        logging.error(f"Error fetching dashboard layout: {e}")
        return {"layout": []}


@router.put("/user/dashboard-layout/{uid}")
async def update_user_dashboard_layout(uid: str, request: Request):
    """
    Update user's dashboard card layout preferences
    """
    try:
        data = await request.json()
        layout = data.get("layout", [])
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"dashboard_layout": layout}}
        )
        
        return {"success": True, "message": "Dashboard layout saved"}
    except Exception as e:
        logging.error(f"Error updating dashboard layout: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


# =====================================================
# CASH BOOK & BANK BOOK ACCOUNTING SYSTEM
# =====================================================

# Pydantic models for Cash/Bank Book
class CashBankEntry(BaseModel):
    entry_type: str  # capital, income, expense, transfer_in, transfer_out
    amount: float
    description: str
    category: str = ""  # rent, salary, purchase, vip_fee, ads_income, etc.
    reference_no: str = ""
    date: str = ""  # If empty, use current date

class TransferEntry(BaseModel):
    from_account: str  # cash or bank
    to_account: str    # cash or bank
    amount: float
    description: str = ""
    reference_no: str = ""

@router.get("/cash-book")
async def get_cash_book(page: int = 1, limit: int = 50):
    """Get Cash Book with running balance"""
    try:
        # Get or create cash account
        cash_account = await db.company_accounts.find_one({"account_type": "cash"})
        if not cash_account:
            cash_account = {
                "account_type": "cash",
                "account_name": "Cash in Hand",
                "opening_balance": 0,
                "current_balance": 0,
                "created_at": datetime.utcnow().isoformat()
            }
            await db.company_accounts.insert_one(cash_account)
        
        # Get transactions
        skip = (page - 1) * limit
        cursor = db.cash_book.find().sort("created_at", -1).skip(skip).limit(limit)
        entries = await cursor.to_list(length=limit)
        
        # Calculate running balance for each entry
        all_entries = await db.cash_book.find().sort("created_at", 1).to_list(length=1000)
        running_balance = cash_account.get("opening_balance", 0)
        balance_map = {}
        for entry in all_entries:
            if entry.get("entry_type") in ["capital", "income", "transfer_in"]:
                running_balance += entry.get("amount", 0)
            else:
                running_balance -= entry.get("amount", 0)
            balance_map[str(entry.get("_id"))] = running_balance
        
        # Add running balance to entries
        for entry in entries:
            entry["_id"] = str(entry["_id"])
            entry["running_balance"] = balance_map.get(entry["_id"], 0)
        
        total = await db.cash_book.count_documents({})
        
        return {
            "account_name": "Cash in Hand",
            "opening_balance": cash_account.get("opening_balance", 0),
            "current_balance": running_balance,
            "entries": entries,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logging.error(f"Error getting cash book: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/bank-book")
async def get_bank_book(page: int = 1, limit: int = 50):
    """Get Bank Book with running balance"""
    try:
        # Get or create bank account
        bank_account = await db.company_accounts.find_one({"account_type": "bank"})
        if not bank_account:
            bank_account = {
                "account_type": "bank",
                "account_name": "Bank Account",
                "bank_name": "",
                "account_number": "",
                "opening_balance": 0,
                "current_balance": 0,
                "created_at": datetime.utcnow().isoformat()
            }
            await db.company_accounts.insert_one(bank_account)
        
        # Get transactions
        skip = (page - 1) * limit
        cursor = db.bank_book.find().sort("created_at", -1).skip(skip).limit(limit)
        entries = await cursor.to_list(length=limit)
        
        # Calculate running balance
        all_entries = await db.bank_book.find().sort("created_at", 1).to_list(length=1000)
        running_balance = bank_account.get("opening_balance", 0)
        balance_map = {}
        for entry in all_entries:
            if entry.get("entry_type") in ["capital", "income", "transfer_in", "deposit"]:
                running_balance += entry.get("amount", 0)
            else:
                running_balance -= entry.get("amount", 0)
            balance_map[str(entry.get("_id"))] = running_balance
        
        for entry in entries:
            entry["_id"] = str(entry["_id"])
            entry["running_balance"] = balance_map.get(entry["_id"], 0)
        
        total = await db.bank_book.count_documents({})
        
        return {
            "account_name": bank_account.get("account_name", "Bank Account"),
            "bank_name": bank_account.get("bank_name", ""),
            "account_number": bank_account.get("account_number", ""),
            "opening_balance": bank_account.get("opening_balance", 0),
            "current_balance": running_balance,
            "entries": entries,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logging.error(f"Error getting bank book: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/cash-book/entry")
async def add_cash_entry(entry: CashBankEntry, admin_id: str = ""):
    """Add entry to Cash Book"""
    try:
        entry_date = entry.date if entry.date else datetime.utcnow().isoformat()
        
        cash_entry = {
            "entry_id": str(uuid.uuid4()),
            "entry_type": entry.entry_type,
            "amount": abs(entry.amount),
            "description": entry.description,
            "category": entry.category,
            "reference_no": entry.reference_no,
            "date": entry_date,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": admin_id
        }
        
        await db.cash_book.insert_one(cash_entry)
        
        # Update current balance
        cash_account = await db.company_accounts.find_one({"account_type": "cash"})
        if cash_account:
            current = cash_account.get("current_balance", 0)
            if entry.entry_type in ["capital", "income", "transfer_in"]:
                new_balance = current + abs(entry.amount)
            else:
                new_balance = current - abs(entry.amount)
            await db.company_accounts.update_one(
                {"account_type": "cash"},
                {"$set": {"current_balance": new_balance}}
            )
        
        return {"success": True, "message": "Cash entry added", "entry_id": cash_entry["entry_id"]}
    except Exception as e:
        logging.error(f"Error adding cash entry: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/bank-book/entry")
async def add_bank_entry(entry: CashBankEntry, admin_id: str = ""):
    """Add entry to Bank Book"""
    try:
        entry_date = entry.date if entry.date else datetime.utcnow().isoformat()
        
        bank_entry = {
            "entry_id": str(uuid.uuid4()),
            "entry_type": entry.entry_type,
            "amount": abs(entry.amount),
            "description": entry.description,
            "category": entry.category,
            "reference_no": entry.reference_no,
            "date": entry_date,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": admin_id
        }
        
        await db.bank_book.insert_one(bank_entry)
        
        # Update current balance
        bank_account = await db.company_accounts.find_one({"account_type": "bank"})
        if bank_account:
            current = bank_account.get("current_balance", 0)
            if entry.entry_type in ["capital", "income", "transfer_in", "deposit"]:
                new_balance = current + abs(entry.amount)
            else:
                new_balance = current - abs(entry.amount)
            await db.company_accounts.update_one(
                {"account_type": "bank"},
                {"$set": {"current_balance": new_balance}}
            )
        
        return {"success": True, "message": "Bank entry added", "entry_id": bank_entry["entry_id"]}
    except Exception as e:
        logging.error(f"Error adding bank entry: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/transfer")
async def transfer_between_accounts(transfer: TransferEntry, admin_id: str = ""):
    """Transfer money between Cash and Bank accounts"""
    try:
        if transfer.from_account == transfer.to_account:
            raise HTTPException(status_code=400, detail="From and To accounts must be different")
        
        timestamp = datetime.utcnow().isoformat()
        transfer_ref = f"TRF-{str(uuid.uuid4())[:8].upper()}"
        
        # Debit from source account
        from_entry = {
            "entry_id": str(uuid.uuid4()),
            "entry_type": "transfer_out",
            "amount": abs(transfer.amount),
            "description": f"Transfer to {transfer.to_account.title()} - {transfer.description}",
            "category": "transfer",
            "reference_no": transfer_ref,
            "date": timestamp,
            "created_at": timestamp,
            "created_by": admin_id
        }
        
        # Credit to destination account
        to_entry = {
            "entry_id": str(uuid.uuid4()),
            "entry_type": "transfer_in",
            "amount": abs(transfer.amount),
            "description": f"Transfer from {transfer.from_account.title()} - {transfer.description}",
            "category": "transfer",
            "reference_no": transfer_ref,
            "date": timestamp,
            "created_at": timestamp,
            "created_by": admin_id
        }
        
        # Insert entries
        if transfer.from_account == "cash":
            await db.cash_book.insert_one(from_entry)
            await db.bank_book.insert_one(to_entry)
        else:
            await db.bank_book.insert_one(from_entry)
            await db.cash_book.insert_one(to_entry)
        
        # Update balances
        from_account = await db.company_accounts.find_one({"account_type": transfer.from_account})
        to_account = await db.company_accounts.find_one({"account_type": transfer.to_account})
        
        if from_account:
            await db.company_accounts.update_one(
                {"account_type": transfer.from_account},
                {"$inc": {"current_balance": -abs(transfer.amount)}}
            )
        if to_account:
            await db.company_accounts.update_one(
                {"account_type": transfer.to_account},
                {"$inc": {"current_balance": abs(transfer.amount)}}
            )
        
        return {"success": True, "message": "Transfer completed", "reference": transfer_ref}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in transfer: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/set-opening-balance")
async def set_opening_balance(account_type: str, amount: float, bank_name: str = "", account_number: str = ""):
    """Set opening balance for Cash or Bank account"""
    try:
        update_data = {
            "opening_balance": amount,
            "current_balance": amount,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if account_type == "bank":
            update_data["bank_name"] = bank_name
            update_data["account_number"] = account_number
        
        result = await db.company_accounts.update_one(
            {"account_type": account_type},
            {"$set": update_data},
            upsert=True
        )
        
        return {"success": True, "message": f"{account_type.title()} opening balance set to ₹{amount}"}
    except Exception as e:
        logging.error(f"Error setting opening balance: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

async def get_accounting_summary():
    """Get summary of all accounts"""
    try:
        cash_account = await db.company_accounts.find_one({"account_type": "cash"})
        bank_account = await db.company_accounts.find_one({"account_type": "bank"})
        
        # Get today's transactions
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_str = today.isoformat()
        
        cash_today = await db.cash_book.count_documents({"created_at": {"$gte": today_str}})
        bank_today = await db.bank_book.count_documents({"created_at": {"$gte": today_str}})
        
        # Calculate totals
        cash_entries = await db.cash_book.find().to_list(length=1000)
        bank_entries = await db.bank_book.find().to_list(length=1000)
        
        cash_credit = sum(e.get("amount", 0) for e in cash_entries if e.get("entry_type") in ["capital", "income", "transfer_in"])
        cash_debit = sum(e.get("amount", 0) for e in cash_entries if e.get("entry_type") in ["expense", "transfer_out"])
        
        bank_credit = sum(e.get("amount", 0) for e in bank_entries if e.get("entry_type") in ["capital", "income", "transfer_in", "deposit"])
        bank_debit = sum(e.get("amount", 0) for e in bank_entries if e.get("entry_type") in ["expense", "transfer_out", "withdrawal"])
        
        cash_balance = (cash_account.get("opening_balance", 0) if cash_account else 0) + cash_credit - cash_debit
        bank_balance = (bank_account.get("opening_balance", 0) if bank_account else 0) + bank_credit - bank_debit
        
        return {
            "cash": {
                "account_name": "Cash in Hand",
                "opening_balance": cash_account.get("opening_balance", 0) if cash_account else 0,
                "total_credit": cash_credit,
                "total_debit": cash_debit,
                "current_balance": cash_balance,
                "today_transactions": cash_today
            },
            "bank": {
                "account_name": bank_account.get("account_name", "Bank Account") if bank_account else "Bank Account",
                "bank_name": bank_account.get("bank_name", "") if bank_account else "",
                "account_number": bank_account.get("account_number", "") if bank_account else "",
                "opening_balance": bank_account.get("opening_balance", 0) if bank_account else 0,
                "total_credit": bank_credit,
                "total_debit": bank_debit,
                "current_balance": bank_balance,
                "today_transactions": bank_today
            },
            "total_balance": cash_balance + bank_balance
        }
    except Exception as e:
        logging.error(f"Error getting accounting summary: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== CHART OF ACCOUNTS ====================
# Standard accounting structure for the platform

CHART_OF_ACCOUNTS = {
    "assets": {
        "code": "1000",
        "name": "Assets",
        "accounts": [
            {"code": "1001", "name": "Cash in Hand", "type": "current", "normal_balance": "debit"},
            {"code": "1002", "name": "Bank Account", "type": "current", "normal_balance": "debit"},
            {"code": "1003", "name": "Accounts Receivable", "type": "current", "normal_balance": "debit"},
            {"code": "1004", "name": "Prepaid Expenses", "type": "current", "normal_balance": "debit"},
            {"code": "1010", "name": "Office Equipment", "type": "fixed", "normal_balance": "debit"},
            {"code": "1011", "name": "Computer & IT Equipment", "type": "fixed", "normal_balance": "debit"},
            {"code": "1012", "name": "Furniture & Fixtures", "type": "fixed", "normal_balance": "debit"},
            {"code": "1020", "name": "Accumulated Depreciation", "type": "contra", "normal_balance": "credit"}
        ]
    },
    "liabilities": {
        "code": "2000",
        "name": "Liabilities",
        "accounts": [
            {"code": "2001", "name": "Accounts Payable", "type": "current", "normal_balance": "credit"},
            {"code": "2002", "name": "PRC Redemption Liability", "type": "current", "normal_balance": "credit"},
            {"code": "2003", "name": "GST Payable", "type": "current", "normal_balance": "credit"},
            {"code": "2004", "name": "TDS Payable", "type": "current", "normal_balance": "credit"},
            {"code": "2005", "name": "Salary Payable", "type": "current", "normal_balance": "credit"},
            {"code": "2010", "name": "Long-term Loans", "type": "long_term", "normal_balance": "credit"}
        ]
    },
    "equity": {
        "code": "3000",
        "name": "Owner's Equity",
        "accounts": [
            {"code": "3001", "name": "Owner's Capital", "type": "equity", "normal_balance": "credit"},
            {"code": "3002", "name": "Additional Capital", "type": "equity", "normal_balance": "credit"},
            {"code": "3003", "name": "Owner's Drawings", "type": "contra_equity", "normal_balance": "debit"},
            {"code": "3004", "name": "Retained Earnings", "type": "equity", "normal_balance": "credit"}
        ]
    },
    "income": {
        "code": "4000",
        "name": "Income",
        "accounts": [
            {"code": "4001", "name": "VIP Membership Fees", "type": "operating", "normal_balance": "credit"},
            {"code": "4002", "name": "Ads Revenue", "type": "operating", "normal_balance": "credit"},
            {"code": "4003", "name": "Commission Income", "type": "operating", "normal_balance": "credit"},
            {"code": "4004", "name": "Service Charges", "type": "operating", "normal_balance": "credit"},
            {"code": "4005", "name": "PRC Redemption Income", "type": "operating", "normal_balance": "credit"},
            {"code": "4010", "name": "Interest Income", "type": "other", "normal_balance": "credit"},
            {"code": "4011", "name": "Other Income", "type": "other", "normal_balance": "credit"}
        ]
    },
    "expenses": {
        "code": "5000",
        "name": "Expenses",
        "accounts": [
            {"code": "5001", "name": "Rent Expense", "type": "operating", "normal_balance": "debit"},
            {"code": "5002", "name": "Salary & Wages", "type": "operating", "normal_balance": "debit"},
            {"code": "5003", "name": "Utilities", "type": "operating", "normal_balance": "debit"},
            {"code": "5004", "name": "Internet & Phone", "type": "operating", "normal_balance": "debit"},
            {"code": "5005", "name": "Marketing & Advertising", "type": "operating", "normal_balance": "debit"},
            {"code": "5006", "name": "Server & Hosting", "type": "operating", "normal_balance": "debit"},
            {"code": "5007", "name": "Office Supplies", "type": "operating", "normal_balance": "debit"},
            {"code": "5008", "name": "Professional Fees", "type": "operating", "normal_balance": "debit"},
            {"code": "5009", "name": "Bank Charges", "type": "operating", "normal_balance": "debit"},
            {"code": "5010", "name": "Depreciation Expense", "type": "non_cash", "normal_balance": "debit"},
            {"code": "5011", "name": "Maintenance & Repairs", "type": "operating", "normal_balance": "debit"},
            {"code": "5012", "name": "Travel & Conveyance", "type": "operating", "normal_balance": "debit"},
            {"code": "5020", "name": "GST Expense", "type": "tax", "normal_balance": "debit"},
            {"code": "5021", "name": "Other Expenses", "type": "other", "normal_balance": "debit"}
        ]
    }
}

@router.get("/chart-of-accounts")
async def get_chart_of_accounts():
    """Get the complete Chart of Accounts"""
    try:
        # Get account balances from database
        account_balances = {}
        
        # Cash balance
        cash_account = await db.company_accounts.find_one({"account_type": "cash"})
        account_balances["1001"] = cash_account.get("current_balance", 0) if cash_account else 0
        
        # Bank balance
        bank_account = await db.company_accounts.find_one({"account_type": "bank"})
        account_balances["1002"] = bank_account.get("current_balance", 0) if bank_account else 0
        
        # PRC Liability (users' PRC balance)
        total_prc = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(length=1)
        prc_rate = get_prc_ledger_rate()  # Dynamic rate
        prc_liability = (total_prc[0]["total"] if total_prc else 0) * prc_rate
        account_balances["2002"] = prc_liability
        
        # Capital from capital_entries collection
        capital_entries = await db.capital_entries.find({}).to_list(length=1000)
        owner_capital = sum(e.get("amount", 0) for e in capital_entries if e.get("entry_type") == "capital")
        additional_capital = sum(e.get("amount", 0) for e in capital_entries if e.get("entry_type") == "additional_capital")
        drawings = sum(e.get("amount", 0) for e in capital_entries if e.get("entry_type") == "drawings")
        
        account_balances["3001"] = owner_capital
        account_balances["3002"] = additional_capital
        account_balances["3003"] = drawings
        
        # Add balances to chart
        chart_with_balances = {}
        for category, data in CHART_OF_ACCOUNTS.items():
            chart_with_balances[category] = {
                "code": data["code"],
                "name": data["name"],
                "accounts": []
            }
            category_total = 0
            for account in data["accounts"]:
                balance = account_balances.get(account["code"], 0)
                chart_with_balances[category]["accounts"].append({
                    **account,
                    "balance": round(balance, 2)
                })
                if account["normal_balance"] == "debit":
                    category_total += balance
                else:
                    category_total -= balance
            chart_with_balances[category]["total"] = round(abs(category_total), 2)
        
        return {
            "chart_of_accounts": chart_with_balances,
            "total_accounts": sum(len(data["accounts"]) for data in CHART_OF_ACCOUNTS.values()),
            "last_updated": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logging.error(f"Error getting chart of accounts: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== CAPITAL & OWNER'S EQUITY MANAGEMENT ====================

@router.get("/capital")
async def get_capital_summary():
    """Get capital and owner's equity summary"""
    try:
        # Get all capital entries
        entries = await db.capital_entries.find({}).sort("date", -1).to_list(length=1000)
        
        # Calculate totals
        opening_capital = sum(e.get("amount", 0) for e in entries if e.get("entry_type") == "opening_capital")
        additional_capital = sum(e.get("amount", 0) for e in entries if e.get("entry_type") == "additional_capital")
        drawings = sum(e.get("amount", 0) for e in entries if e.get("entry_type") == "drawings")
        
        # Get retained earnings from P&L
        all_income = await db.cash_book.find({"entry_type": "income"}).to_list(length=1000)
        all_income += await db.bank_book.find({"entry_type": "income"}).to_list(length=1000)
        all_expenses = await db.cash_book.find({"entry_type": "expense"}).to_list(length=1000)
        all_expenses += await db.bank_book.find({"entry_type": "expense"}).to_list(length=1000)
        
        total_income = sum(e.get("amount", 0) for e in all_income)
        total_expense = sum(e.get("amount", 0) for e in all_expenses)
        retained_earnings = total_income - total_expense
        
        total_equity = opening_capital + additional_capital - drawings + retained_earnings
        
        return {
            "opening_capital": round(opening_capital, 2),
            "additional_capital": round(additional_capital, 2),
            "total_capital_invested": round(opening_capital + additional_capital, 2),
            "drawings": round(drawings, 2),
            "retained_earnings": round(retained_earnings, 2),
            "total_equity": round(total_equity, 2),
            "entries": [{
                "id": str(e.get("_id", "")),
                "entry_id": e.get("entry_id", ""),
                "date": e.get("date", ""),
                "entry_type": e.get("entry_type", ""),
                "amount": e.get("amount", 0),
                "description": e.get("description", ""),
                "reference_no": e.get("reference_no", ""),
                "created_by": e.get("created_by", "")
            } for e in entries[:50]],
            "entries_count": len(entries)
        }
    except Exception as e:
        logging.error(f"Error getting capital summary: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/capital/entry")
async def add_capital_entry(
    entry_type: str,  # opening_capital, additional_capital, drawings
    amount: float,
    description: str = "",
    reference_no: str = "",
    date: str = None,
    admin_id: str = ""
):
    """Add a capital entry (investment or drawings)"""
    try:
        if entry_type not in ["opening_capital", "additional_capital", "drawings"]:
            raise HTTPException(status_code=400, detail="Invalid entry type. Use: opening_capital, additional_capital, or drawings")
        
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        now = datetime.utcnow().isoformat()
        entry_date = date or now[:10]
        
        entry = {
            "entry_id": str(uuid.uuid4()),
            "entry_type": entry_type,
            "amount": amount,
            "description": description or f"{entry_type.replace('_', ' ').title()}",
            "reference_no": reference_no,
            "date": entry_date,
            "created_at": now,
            "created_by": admin_id
        }
        
        await db.capital_entries.insert_one(entry)
        
        # Also add to cash/bank book based on entry type
        if entry_type in ["opening_capital", "additional_capital"]:
            # Capital coming in - add to cash book as income (capital category)
            await db.cash_book.insert_one({
                "entry_id": str(uuid.uuid4()),
                "entry_type": "capital",
                "amount": amount,
                "description": description or f"Capital: {entry_type.replace('_', ' ').title()}",
                "category": "capital",
                "reference_no": reference_no,
                "date": entry_date,
                "created_at": now,
                "created_by": admin_id,
                "linked_capital_entry": entry["entry_id"]
            })
            
            # Update cash balance
            await db.company_accounts.update_one(
                {"account_type": "cash"},
                {"$inc": {"current_balance": amount}},
                upsert=True
            )
        elif entry_type == "drawings":
            # Drawings - money going out
            await db.cash_book.insert_one({
                "entry_id": str(uuid.uuid4()),
                "entry_type": "expense",
                "amount": amount,
                "description": description or "Owner's Drawings",
                "category": "drawings",
                "reference_no": reference_no,
                "date": entry_date,
                "created_at": now,
                "created_by": admin_id,
                "linked_capital_entry": entry["entry_id"]
            })
            
            # Update cash balance
            await db.company_accounts.update_one(
                {"account_type": "cash"},
                {"$inc": {"current_balance": -amount}},
                upsert=True
            )
        
        return {
            "success": True,
            "message": f"{entry_type.replace('_', ' ').title()} entry added successfully",
            "entry_id": entry["entry_id"],
            "amount": amount
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error adding capital entry: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== TRIAL BALANCE ====================

@router.get("/trial-balance")
async def get_trial_balance(as_of_date: str = None):
    """Generate Trial Balance - Sum of Debits should equal Sum of Credits"""
    try:
        # Get all account balances
        
        # DEBIT BALANCES (Assets + Expenses + Drawings)
        debit_accounts = []
        
        # Cash in Hand
        cash_account = await db.company_accounts.find_one({"account_type": "cash"})
        cash_balance = cash_account.get("current_balance", 0) if cash_account else 0
        if cash_balance != 0:
            debit_accounts.append({
                "code": "1001",
                "name": "Cash in Hand",
                "debit": max(cash_balance, 0),
                "credit": max(-cash_balance, 0) if cash_balance < 0 else 0
            })
        
        # Bank Balance
        bank_account = await db.company_accounts.find_one({"account_type": "bank"})
        bank_balance = bank_account.get("current_balance", 0) if bank_account else 0
        if bank_balance != 0:
            debit_accounts.append({
                "code": "1002",
                "name": "Bank Account",
                "debit": max(bank_balance, 0),
                "credit": max(-bank_balance, 0) if bank_balance < 0 else 0
            })
        
        # Expenses by category
        cash_expenses = await db.cash_book.find({"entry_type": "expense"}).to_list(length=1000)
        bank_expenses = await db.bank_book.find({"entry_type": "expense"}).to_list(length=1000)
        all_expenses = cash_expenses + bank_expenses
        
        expense_by_category = {}
        for exp in all_expenses:
            cat = exp.get("category", "other")
            if cat not in expense_by_category:
                expense_by_category[cat] = 0
            expense_by_category[cat] += exp.get("amount", 0)
        
        for cat, amount in expense_by_category.items():
            if amount != 0:
                debit_accounts.append({
                    "code": "5xxx",
                    "name": f"{cat.replace('_', ' ').title()} Expense",
                    "debit": round(amount, 2),
                    "credit": 0
                })
        
        # Drawings
        drawings = await db.capital_entries.find({"entry_type": "drawings"}).to_list(length=1000)
        total_drawings = sum(d.get("amount", 0) for d in drawings)
        if total_drawings > 0:
            debit_accounts.append({
                "code": "3003",
                "name": "Owner's Drawings",
                "debit": round(total_drawings, 2),
                "credit": 0
            })
        
        # CREDIT BALANCES (Liabilities + Equity + Income)
        credit_accounts = []
        
        # PRC Liability
        total_prc = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(length=1)
        prc_rate = get_prc_ledger_rate()  # Dynamic rate
        prc_liability = (total_prc[0]["total"] if total_prc else 0) * prc_rate
        if prc_liability > 0:
            credit_accounts.append({
                "code": "2002",
                "name": "PRC Redemption Liability",
                "debit": 0,
                "credit": round(prc_liability, 2)
            })
        
        # Capital
        capital_entries = await db.capital_entries.find({"entry_type": {"$in": ["opening_capital", "additional_capital"]}}).to_list(length=1000)
        total_capital = sum(c.get("amount", 0) for c in capital_entries)
        if total_capital > 0:
            credit_accounts.append({
                "code": "3001",
                "name": "Owner's Capital",
                "debit": 0,
                "credit": round(total_capital, 2)
            })
        
        # Income by category
        cash_income = await db.cash_book.find({"entry_type": {"$in": ["income", "capital"]}}).to_list(length=1000)
        bank_income = await db.bank_book.find({"entry_type": {"$in": ["income", "capital"]}}).to_list(length=1000)
        all_income = cash_income + bank_income
        
        # Exclude capital entries from income (they're in equity)
        income_by_category = {}
        for inc in all_income:
            cat = inc.get("category", "other")
            if cat == "capital" or cat == "drawings":
                continue  # Skip capital, it's in equity section
            if cat not in income_by_category:
                income_by_category[cat] = 0
            income_by_category[cat] += inc.get("amount", 0)
        
        for cat, amount in income_by_category.items():
            if amount != 0:
                credit_accounts.append({
                    "code": "4xxx",
                    "name": f"{cat.replace('_', ' ').title()} Income",
                    "debit": 0,
                    "credit": round(amount, 2)
                })
        
        # Calculate totals
        total_debit = sum(a["debit"] for a in debit_accounts + credit_accounts)
        total_credit = sum(a["credit"] for a in debit_accounts + credit_accounts)
        
        difference = round(total_debit - total_credit, 2)
        is_balanced = abs(difference) < 0.01
        
        return {
            "report_type": "Trial Balance",
            "as_of_date": as_of_date or datetime.utcnow().strftime("%Y-%m-%d"),
            "accounts": debit_accounts + credit_accounts,
            "totals": {
                "total_debit": round(total_debit, 2),
                "total_credit": round(total_credit, 2),
                "difference": difference,
                "is_balanced": is_balanced
            },
            "status": "✓ Balanced" if is_balanced else f"⚠ Difference of ₹{abs(difference)}",
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logging.error(f"Error generating trial balance: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== JOURNAL ENTRIES (Double Entry) ====================

@router.get("/journal-entries")
async def get_journal_entries(page: int = 1, limit: int = 50):
    """Get all journal entries with debit/credit details"""
    try:
        skip = (page - 1) * limit
        
        entries = await db.journal_entries.find({}).sort("date", -1).skip(skip).limit(limit).to_list(length=limit)
        total = await db.journal_entries.count_documents({})
        
        formatted_entries = []
        for entry in entries:
            formatted_entries.append({
                "id": str(entry.get("_id", "")),
                "entry_id": entry.get("entry_id", ""),
                "date": entry.get("date", ""),
                "narration": entry.get("narration", ""),
                "debit_account": entry.get("debit_account", ""),
                "debit_amount": entry.get("debit_amount", 0),
                "credit_account": entry.get("credit_account", ""),
                "credit_amount": entry.get("credit_amount", 0),
                "reference_no": entry.get("reference_no", ""),
                "created_by": entry.get("created_by", "")
            })
        
        return {
            "entries": formatted_entries,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logging.error(f"Error getting journal entries: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/journal-entry")
async def add_journal_entry(
    debit_account: str,
    credit_account: str,
    amount: float,
    narration: str,
    date: str = None,
    reference_no: str = "",
    admin_id: str = ""
):
    """Add a journal entry (double-entry bookkeeping)"""
    try:
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        if debit_account == credit_account:
            raise HTTPException(status_code=400, detail="Debit and Credit accounts cannot be the same")
        
        now = datetime.utcnow().isoformat()
        entry_date = date or now[:10]
        
        entry = {
            "entry_id": str(uuid.uuid4()),
            "date": entry_date,
            "debit_account": debit_account,
            "debit_amount": amount,
            "credit_account": credit_account,
            "credit_amount": amount,
            "narration": narration,
            "reference_no": reference_no,
            "created_at": now,
            "created_by": admin_id
        }
        
        await db.journal_entries.insert_one(entry)
        
        return {
            "success": True,
            "message": "Journal entry added successfully",
            "entry_id": entry["entry_id"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error adding journal entry: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== PRC LEDGER SYSTEM ====================
# PRC Rate - DYNAMIC from economy system
def get_prc_ledger_rate():
    """Get PRC to INR rate for ledger calculations - DYNAMIC"""
    try:
        from routes.prc_economy import get_dynamic_rate_sync
        rate = get_dynamic_rate_sync()  # e.g., 10 means 10 PRC = ₹1
        return 1 / rate  # Convert to INR per PRC (e.g., 1 PRC = ₹0.1)
    except (ImportError, Exception):
        return 0.01

PRC_TO_INR_RATE = 0.01  # Default, actual calculated dynamically

@router.get("/prc-ledger")
async def get_prc_ledger(page: int = 1, limit: int = 50, filter_type: str = "all"):
    """Get PRC Ledger with all mining and consumption transactions"""
    try:
        skip = (page - 1) * limit
        
        # Build query based on filter
        query = {}
        if filter_type == "credit":
            query["type"] = {"$in": ["mining", "tap_game", "referral", "admin_credit", "cashback", "prc_rain_gain"]}
        elif filter_type == "debit":
            query["type"] = {"$in": ["order", "prc_burn", "bill_payment_request", "gift_voucher_request", "prc_rain_loss"]}
        
        # Get transactions from the transactions collection
        cursor = db.transactions.find(query).sort("created_at", -1).skip(skip).limit(limit)
        transactions = await cursor.to_list(length=limit)
        
        # Format entries for ledger view
        entries = []
        for txn in transactions:
            entry_type = txn.get("type", "unknown")
            amount = txn.get("amount", 0)
            is_credit = entry_type in ["mining", "tap_game", "referral", "admin_credit", "cashback", "prc_rain_gain", "withdrawal_rejected"]
            
            prc_rate = get_prc_ledger_rate()  # Dynamic rate
            entries.append({
                "id": str(txn.get("_id", "")),
                "transaction_id": txn.get("transaction_id", ""),
                "date": txn.get("created_at", ""),
                "description": txn.get("description", f"{entry_type.replace('_', ' ').title()}"),
                "type": entry_type,
                "user_id": txn.get("user_id", ""),
                "prc_amount": amount,
                "inr_value": round(amount * prc_rate, 2),
                "dr_cr": "CR" if is_credit else "DR",
                "balance_after": txn.get("balance_after", 0)
            })
        
        # Get totals
        total_mined = await db.transactions.aggregate([
            {"$match": {"type": {"$in": ["mining", "tap_game", "referral"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(length=1)
        
        total_consumed = await db.transactions.aggregate([
            {"$match": {"type": {"$in": ["order", "bill_payment_request", "gift_voucher_request"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(length=1)
        
        total_burned = await db.transactions.aggregate([
            {"$match": {"type": "prc_burn"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(length=1)
        
        mined_prc = total_mined[0]["total"] if total_mined else 0
        consumed_prc = total_consumed[0]["total"] if total_consumed else 0
        burned_prc = total_burned[0]["total"] if total_burned else 0
        
        total = await db.transactions.count_documents(query)
        
        prc_rate = get_prc_ledger_rate()  # Dynamic rate
        prc_rate_display = int(1 / prc_rate) if prc_rate > 0 else 100
        
        return {
            "summary": {
                "total_mined_prc": round(mined_prc, 2),
                "total_mined_inr": round(mined_prc * prc_rate, 2),
                "total_consumed_prc": round(consumed_prc, 2),
                "total_consumed_inr": round(consumed_prc * prc_rate, 2),
                "total_burned_prc": round(burned_prc, 2),
                "total_burned_inr": round(burned_prc * prc_rate, 2),
                "net_circulation_prc": round(mined_prc - consumed_prc - burned_prc, 2),
                "conversion_rate": f"{prc_rate_display} PRC = ₹1"
            },
            "entries": entries,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logging.error(f"Error getting PRC ledger: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/sync-prc-to-books")
async def sync_prc_to_cash_book(admin_id: str = ""):
    """Sync PRC transactions to Cash/Bank Book with INR value conversion"""
    try:
        # Get last sync timestamp
        sync_record = await db.prc_sync_records.find_one({"type": "cash_book_sync"})
        last_sync = sync_record.get("last_sync") if sync_record else None
        
        # Build query for unsync'd transactions
        query = {"type": {"$in": ["mining", "tap_game", "referral", "order", "prc_burn"]}}
        if last_sync:
            query["created_at"] = {"$gt": last_sync}
        
        transactions = await db.transactions.find(query).to_list(length=1000)
        
        # Group and sum by type for bulk entries
        income_total = 0
        expense_total = 0
        burn_total = 0
        
        for txn in transactions:
            amount = txn.get("amount", 0)
            if txn.get("type") in ["mining", "tap_game", "referral"]:
                income_total += amount
            elif txn.get("type") in ["order"]:
                expense_total += amount
            elif txn.get("type") == "prc_burn":
                burn_total += amount
        
        now = datetime.utcnow().isoformat()
        entries_added = 0
        prc_rate = get_prc_ledger_rate()  # Dynamic rate
        prc_rate_display = int(1 / prc_rate) if prc_rate > 0 else 100
        
        # Add PRC Income entry to Cash Book (virtual asset)
        if income_total > 0:
            inr_value = round(income_total * prc_rate, 2)
            await db.cash_book.insert_one({
                "entry_id": str(uuid.uuid4()),
                "entry_type": "income",
                "amount": inr_value,
                "description": f"PRC Mined/Earned ({income_total:.2f} PRC @ {prc_rate_display} PRC = ₹1)",
                "category": "prc_income",
                "reference_no": f"PRC-SYNC-{now[:10]}",
                "date": now,
                "created_at": now,
                "created_by": admin_id,
                "is_prc_sync": True
            })
            entries_added += 1
        
        # Add PRC Consumption as liability reduction (income to company)
        if expense_total > 0:
            inr_value = round(expense_total * prc_rate, 2)
            await db.cash_book.insert_one({
                "entry_id": str(uuid.uuid4()),
                "entry_type": "income",
                "amount": inr_value,
                "description": f"PRC Redeemed/Consumed ({expense_total:.2f} PRC @ {prc_rate_display} PRC = ₹1)",
                "category": "prc_redemption",
                "reference_no": f"PRC-REDEEM-{now[:10]}",
                "date": now,
                "created_at": now,
                "created_by": admin_id,
                "is_prc_sync": True
            })
            entries_added += 1
        
        # Record sync timestamp
        await db.prc_sync_records.update_one(
            {"type": "cash_book_sync"},
            {"$set": {"last_sync": now, "transactions_processed": len(transactions)}},
            upsert=True
        )
        
        return {
            "success": True,
            "message": f"Synced {len(transactions)} PRC transactions",
            "entries_added": entries_added,
            "totals": {
                "prc_income": income_total,
                "prc_consumed": expense_total,
                "prc_burned": burn_total,
                "inr_income_value": round(income_total * prc_rate, 2),
                "inr_consumed_value": round(expense_total * prc_rate, 2)
            }
        }
    except Exception as e:
        logging.error(f"Error syncing PRC to books: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== MONTHLY FINANCIAL REPORTS ====================

@router.get("/admin/reports/profit-loss-statement")
async def get_profit_loss_statement(month: int = None, year: int = None):
    """Generate Profit & Loss Statement for a month"""
    try:
        now = datetime.utcnow()
        target_month = month or now.month
        target_year = year or now.year
        
        # Date range for the month
        start_date = datetime(target_year, target_month, 1)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1)
        else:
            end_date = datetime(target_year, target_month + 1, 1)
        
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        
        # Get Cash Book entries for the month
        cash_entries = await db.cash_book.find({
            "created_at": {"$gte": start_str, "$lt": end_str}
        }).to_list(length=1000)
        
        bank_entries = await db.bank_book.find({
            "created_at": {"$gte": start_str, "$lt": end_str}
        }).to_list(length=1000)
        
        # Categorize income and expenses
        income_categories = {}
        expense_categories = {}
        
        for entry in cash_entries + bank_entries:
            category = entry.get("category", "other")
            amount = entry.get("amount", 0)
            entry_type = entry.get("entry_type", "")
            
            if entry_type in ["capital", "income", "transfer_in"]:
                if category not in income_categories:
                    income_categories[category] = 0
                income_categories[category] += amount
            elif entry_type in ["expense", "transfer_out"]:
                if category not in expense_categories:
                    expense_categories[category] = 0
                expense_categories[category] += amount
        
        total_income = sum(income_categories.values())
        total_expenses = sum(expense_categories.values())
        net_profit = total_income - total_expenses
        
        # Get PRC metrics for the month
        prc_transactions = await db.transactions.find({
            "created_at": {"$gte": start_str, "$lt": end_str}
        }).to_list(length=1000)
        
        prc_mined = sum(t.get("amount", 0) for t in prc_transactions if t.get("type") in ["mining", "tap_game", "referral"])
        prc_consumed = sum(t.get("amount", 0) for t in prc_transactions if t.get("type") in ["order", "bill_payment_request", "gift_voucher_request"])
        prc_burned = sum(t.get("amount", 0) for t in prc_transactions if t.get("type") == "prc_burn")
        
        return {
            "report_type": "Profit & Loss Statement",
            "period": f"{start_date.strftime('%B %Y')}",
            "month": target_month,
            "year": target_year,
            "income": {
                "categories": income_categories,
                "total": round(total_income, 2)
            },
            "expenses": {
                "categories": expense_categories,
                "total": round(total_expenses, 2)
            },
            "net_profit": round(net_profit, 2),
            "profit_margin": round((net_profit / total_income * 100) if total_income > 0 else 0, 2),
            "prc_metrics": {
                "mined": round(prc_mined, 2),
                "consumed": round(prc_consumed, 2),
                "burned": round(prc_burned, 2),
                "net_liability": round((prc_mined - prc_consumed - prc_burned) * get_prc_ledger_rate(), 2)
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logging.error(f"Error generating P&L statement: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/admin/reports/balance-sheet")
async def get_balance_sheet():
    """Generate Balance Sheet"""
    try:
        # Get account balances
        cash_account = await db.company_accounts.find_one({"account_type": "cash"})
        bank_account = await db.company_accounts.find_one({"account_type": "bank"})
        
        cash_balance = cash_account.get("current_balance", 0) if cash_account else 0
        bank_balance = bank_account.get("current_balance", 0) if bank_account else 0
        
        # Get total PRC in circulation (liability)
        total_prc = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(length=1)
        prc_liability = total_prc[0]["total"] if total_prc else 0
        prc_liability_inr = round(prc_liability * get_prc_ledger_rate(), 2)
        
        # Get capital entries from dedicated collection
        opening_capital_entries = await db.capital_entries.find({"entry_type": "opening_capital"}).to_list(length=1000)
        additional_capital_entries = await db.capital_entries.find({"entry_type": "additional_capital"}).to_list(length=1000)
        drawings_entries = await db.capital_entries.find({"entry_type": "drawings"}).to_list(length=1000)
        
        opening_capital = sum(e.get("amount", 0) for e in opening_capital_entries)
        additional_capital = sum(e.get("amount", 0) for e in additional_capital_entries)
        total_capital = opening_capital + additional_capital
        total_drawings = sum(e.get("amount", 0) for e in drawings_entries)
        
        # Calculate retained earnings (income - expenses, excluding capital movements)
        all_income = await db.cash_book.find({"entry_type": "income", "category": {"$ne": "capital"}}).to_list(length=1000)
        all_income += await db.bank_book.find({"entry_type": "income", "category": {"$ne": "capital"}}).to_list(length=1000)
        all_expenses = await db.cash_book.find({"entry_type": "expense", "category": {"$ne": "drawings"}}).to_list(length=1000)
        all_expenses += await db.bank_book.find({"entry_type": "expense", "category": {"$ne": "drawings"}}).to_list(length=1000)
        
        total_income = sum(e.get("amount", 0) for e in all_income)
        total_expense = sum(e.get("amount", 0) for e in all_expenses)
        retained_earnings = total_income - total_expense
        
        total_assets = cash_balance + bank_balance
        total_liabilities = prc_liability_inr
        total_equity = total_capital - total_drawings + retained_earnings
        
        return {
            "report_type": "Balance Sheet",
            "as_of_date": datetime.utcnow().isoformat(),
            "assets": {
                "current_assets": {
                    "cash_in_hand": round(cash_balance, 2),
                    "bank_balance": round(bank_balance, 2)
                },
                "total_assets": round(total_assets, 2)
            },
            "liabilities": {
                "current_liabilities": {
                    "prc_redemption_liability": prc_liability_inr,
                    "prc_in_circulation": round(prc_liability, 2)
                },
                "total_liabilities": round(total_liabilities, 2)
            },
            "equity": {
                "opening_capital": round(opening_capital, 2),
                "additional_capital": round(additional_capital, 2),
                "total_capital": round(total_capital, 2),
                "less_drawings": round(total_drawings, 2),
                "retained_earnings": round(retained_earnings, 2),
                "total_equity": round(total_equity, 2)
            },
            "balance_check": {
                "assets": round(total_assets, 2),
                "liabilities_plus_equity": round(total_liabilities + total_equity, 2),
                "is_balanced": abs(total_assets - (total_liabilities + total_equity)) < 0.01
            },
            "note": "Add Opening Capital to balance the books" if total_capital == 0 and total_assets > 0 else None
        }
    except Exception as e:
        logging.error(f"Error generating balance sheet: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/admin/reports/prc-flow")
async def get_prc_flow_report(month: int = None, year: int = None):
    """Generate PRC Flow Report for a month"""
    try:
        now = datetime.utcnow()
        target_month = month or now.month
        target_year = year or now.year
        
        # Date range
        start_date = datetime(target_year, target_month, 1)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1)
        else:
            end_date = datetime(target_year, target_month + 1, 1)
        
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        
        # Get all PRC transactions for the month
        transactions = await db.transactions.find({
            "created_at": {"$gte": start_str, "$lt": end_str}
        }).to_list(length=1000)
        
        # Categorize by type
        inflow = {
            "mining": 0,
            "tap_game": 0,
            "referral": 0,
            "admin_credit": 0,
            "cashback": 0,
            "prc_rain_gain": 0
        }
        
        outflow = {
            "orders": 0,
            "bill_payments": 0,
            "gift_vouchers": 0,
            "prc_burn": 0,
            "prc_rain_loss": 0
        }
        
        for txn in transactions:
            amount = txn.get("amount", 0)
            txn_type = txn.get("type", "")
            
            if txn_type == "mining":
                inflow["mining"] += amount
            elif txn_type == "tap_game":
                inflow["tap_game"] += amount
            elif txn_type == "referral":
                inflow["referral"] += amount
            elif txn_type == "admin_credit":
                inflow["admin_credit"] += amount
            elif txn_type == "cashback":
                inflow["cashback"] += amount
            elif txn_type == "prc_rain_gain":
                inflow["prc_rain_gain"] += amount
            elif txn_type == "order":
                outflow["orders"] += amount
            elif txn_type == "bill_payment_request":
                outflow["bill_payments"] += amount
            elif txn_type == "gift_voucher_request":
                outflow["gift_vouchers"] += amount
            elif txn_type == "prc_burn":
                outflow["prc_burn"] += amount
            elif txn_type == "prc_rain_loss":
                outflow["prc_rain_loss"] += amount
        
        total_inflow = sum(inflow.values())
        total_outflow = sum(outflow.values())
        net_flow = total_inflow - total_outflow
        
        # Get daily breakdown
        daily_stats = {}
        for txn in transactions:
            date_str = txn.get("created_at", "")[:10]
            if date_str not in daily_stats:
                daily_stats[date_str] = {"inflow": 0, "outflow": 0}
            
            amount = txn.get("amount", 0)
            txn_type = txn.get("type", "")
            
            if txn_type in ["mining", "tap_game", "referral", "admin_credit", "cashback", "prc_rain_gain"]:
                daily_stats[date_str]["inflow"] += amount
            else:
                daily_stats[date_str]["outflow"] += amount
        
        prc_rate = get_prc_ledger_rate()  # Dynamic rate
        return {
            "report_type": "PRC Flow Report",
            "period": f"{start_date.strftime('%B %Y')}",
            "month": target_month,
            "year": target_year,
            "inflow": {
                "breakdown": {k: round(v, 2) for k, v in inflow.items()},
                "total": round(total_inflow, 2),
                "inr_value": round(total_inflow * prc_rate, 2)
            },
            "outflow": {
                "breakdown": {k: round(v, 2) for k, v in outflow.items()},
                "total": round(total_outflow, 2),
                "inr_value": round(total_outflow * prc_rate, 2)
            },
            "net_flow": {
                "prc": round(net_flow, 2),
                "inr_value": round(net_flow * prc_rate, 2)
            },
            "daily_breakdown": [{
                "date": date,
                "inflow": round(stats["inflow"], 2),
                "outflow": round(stats["outflow"], 2),
                "net": round(stats["inflow"] - stats["outflow"], 2)
            } for date, stats in sorted(daily_stats.items())],
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logging.error(f"Error generating PRC flow report: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== AUTO EXPENSE CATEGORIZATION ====================

# Keyword patterns for auto-categorization
CATEGORY_KEYWORDS = {
    "rent": ["rent", "lease", "property", "office space", "shop rent", "गाळा", "भाडे"],
    "salary": ["salary", "wages", "payroll", "staff", "employee", "पगार", "वेतन"],
    "utilities": ["electricity", "water", "gas", "internet", "phone", "mobile", "vij", "पाणी", "विज"],
    "maintenance": ["repair", "maintenance", "service", "fix", "दुरुस्ती"],
    "purchase": ["purchase", "buy", "stock", "inventory", "खरेदी", "माल"],
    "travel": ["travel", "transport", "petrol", "diesel", "fuel", "प्रवास", "पेट्रोल"],
    "marketing": ["marketing", "advertising", "promotion", "ads", "जाहिरात"],
    "capital": ["capital", "investment", "director", "partner", "भांडवल", "गुंतवणूक"],
    "vip_fee": ["vip", "membership", "subscription", "सदस्यता"],
    "ads_income": ["ads", "advertising", "admob", "unity", "जाहिरात उत्पन्न"],
    "prc_income": ["prc", "mining", "mined"],
    "prc_redemption": ["redeem", "redemption", "convert"]
}

# Amount patterns for recurring categorization
async def get_recurring_patterns(user_id: str = None):
    """Get recurring amount patterns for auto-categorization"""
    try:
        # Find amounts that appear multiple times with same description pattern
        pipeline = [
            {"$group": {
                "_id": {"amount": "$amount", "category": "$category"},
                "count": {"$sum": 1},
                "descriptions": {"$addToSet": "$description"}
            }},
            {"$match": {"count": {"$gte": 2}}},
            {"$sort": {"count": -1}},
            {"$limit": 50}
        ]
        
        cash_patterns = await db.cash_book.aggregate(pipeline).to_list(length=50)
        bank_patterns = await db.bank_book.aggregate(pipeline).to_list(length=50)
        
        return {
            "cash_patterns": cash_patterns,
            "bank_patterns": bank_patterns
        }
    except Exception as e:
        logging.error(f"Error getting recurring patterns: {e}")
        return {"cash_patterns": [], "bank_patterns": []}

@router.post("/auto-categorize")
async def auto_categorize_entry(description: str, amount: float = 0):
    """Auto-categorize an entry based on keywords and amount patterns"""
    try:
        description_lower = description.lower()
        suggested_category = "other"
        confidence = 0.0
        match_reason = ""
        
        # 1. Check keyword patterns first
        for category, keywords in CATEGORY_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in description_lower:
                    suggested_category = category
                    confidence = 0.9
                    match_reason = f"Keyword match: '{keyword}'"
                    break
            if confidence > 0:
                break
        
        # 2. Check amount patterns if no keyword match
        if confidence == 0 and amount > 0:
            # Check for recurring amounts in database
            cash_match = await db.cash_book.find_one({"amount": amount})
            bank_match = await db.bank_book.find_one({"amount": amount})
            
            if cash_match and cash_match.get("category"):
                suggested_category = cash_match["category"]
                confidence = 0.7
                match_reason = f"Amount pattern match: ₹{amount} previously categorized as {suggested_category}"
            elif bank_match and bank_match.get("category"):
                suggested_category = bank_match["category"]
                confidence = 0.7
                match_reason = f"Amount pattern match: ₹{amount} previously categorized as {suggested_category}"
        
        # 3. Suggest entry type based on category
        if suggested_category in ["capital", "vip_fee", "ads_income", "prc_income", "prc_redemption"]:
            suggested_type = "income"
        elif suggested_category in ["rent", "salary", "utilities", "maintenance", "purchase", "travel", "marketing"]:
            suggested_type = "expense"
        else:
            suggested_type = "expense"  # Default to expense for uncategorized
        
        return {
            "suggested_category": suggested_category,
            "suggested_type": suggested_type,
            "confidence": confidence,
            "match_reason": match_reason,
            "all_categories": list(CATEGORY_KEYWORDS.keys()) + ["other"]
        }
    except Exception as e:
        logging.error(f"Error auto-categorizing: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/category-suggestions")
async def get_category_suggestions():
    """Get all available categories with their keywords"""
    return {
        "categories": [
            {"id": "capital", "label": "Capital Investment", "keywords": CATEGORY_KEYWORDS["capital"], "type": "income"},
            {"id": "vip_fee", "label": "VIP Membership Fee", "keywords": CATEGORY_KEYWORDS["vip_fee"], "type": "income"},
            {"id": "ads_income", "label": "Ads Income", "keywords": CATEGORY_KEYWORDS["ads_income"], "type": "income"},
            {"id": "prc_income", "label": "PRC Mining Value", "keywords": CATEGORY_KEYWORDS["prc_income"], "type": "income"},
            {"id": "prc_redemption", "label": "PRC Redemption", "keywords": CATEGORY_KEYWORDS["prc_redemption"], "type": "income"},
            {"id": "rent", "label": "Rent", "keywords": CATEGORY_KEYWORDS["rent"], "type": "expense"},
            {"id": "salary", "label": "Salary & Wages", "keywords": CATEGORY_KEYWORDS["salary"], "type": "expense"},
            {"id": "utilities", "label": "Utilities", "keywords": CATEGORY_KEYWORDS["utilities"], "type": "expense"},
            {"id": "maintenance", "label": "Maintenance", "keywords": CATEGORY_KEYWORDS["maintenance"], "type": "expense"},
            {"id": "purchase", "label": "Purchase", "keywords": CATEGORY_KEYWORDS["purchase"], "type": "expense"},
            {"id": "travel", "label": "Travel & Transport", "keywords": CATEGORY_KEYWORDS["travel"], "type": "expense"},
            {"id": "marketing", "label": "Marketing", "keywords": CATEGORY_KEYWORDS["marketing"], "type": "expense"},
            {"id": "other", "label": "Other", "keywords": [], "type": "expense"}
        ]
    }

# ==================== PHASE 2: ACCOUNTS RECEIVABLE (AR) ====================

@router.get("/receivables")
async def get_accounts_receivable(status: str = "all", page: int = 1, limit: int = 50):
    """Get Accounts Receivable - Money owed TO the company"""
    try:
        skip = (page - 1) * limit
        
        # Build query based on status
        query = {}
        if status == "pending":
            query["status"] = "pending"
        elif status == "overdue":
            query["status"] = "overdue"
        elif status == "paid":
            query["status"] = "paid"
        
        receivables = await db.accounts_receivable.find(query).sort("due_date", 1).skip(skip).limit(limit).to_list(limit)
        total = await db.accounts_receivable.count_documents(query)
        
        # Calculate totals
        all_receivables = await db.accounts_receivable.find({}).to_list(length=1000)
        total_pending = sum(r.get("amount", 0) for r in all_receivables if r.get("status") == "pending")
        total_overdue = sum(r.get("amount", 0) for r in all_receivables if r.get("status") == "overdue")
        total_collected = sum(r.get("amount", 0) for r in all_receivables if r.get("status") == "paid")
        
        return {
            "summary": {
                "total_pending": round(total_pending, 2),
                "total_overdue": round(total_overdue, 2),
                "total_collected": round(total_collected, 2),
                "total_outstanding": round(total_pending + total_overdue, 2)
            },
            "receivables": [{
                "id": str(r.get("_id", "")),
                "invoice_id": r.get("invoice_id", ""),
                "customer_name": r.get("customer_name", ""),
                "customer_id": r.get("customer_id", ""),
                "description": r.get("description", ""),
                "amount": r.get("amount", 0),
                "due_date": r.get("due_date", ""),
                "status": r.get("status", "pending"),
                "days_overdue": r.get("days_overdue", 0),
                "category": r.get("category", ""),
                "created_at": r.get("created_at", "")
            } for r in receivables],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logging.error(f"Error getting accounts receivable: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/receivables")
async def create_receivable(
    customer_name: str,
    customer_id: str = "",
    description: str = "",
    amount: float = 0,
    due_date: str = None,
    category: str = "vip_fee",
    admin_id: str = ""
):
    """Create a new accounts receivable entry"""
    try:
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        now = datetime.utcnow()
        due = datetime.fromisoformat(due_date) if due_date else now + timedelta(days=30)
        
        receivable = {
            "invoice_id": f"INV-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
            "customer_name": customer_name,
            "customer_id": customer_id,
            "description": description,
            "amount": amount,
            "due_date": due.isoformat(),
            "status": "pending",
            "days_overdue": 0,
            "category": category,
            "created_at": now.isoformat(),
            "created_by": admin_id
        }
        
        await db.accounts_receivable.insert_one(receivable)
        
        return {
            "success": True,
            "message": "Receivable created successfully",
            "invoice_id": receivable["invoice_id"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating receivable: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/receivables/{invoice_id}/status")
async def update_receivable_status(invoice_id: str, status: str, admin_id: str = ""):
    """Update receivable status (pending, paid, overdue)"""
    try:
        if status not in ["pending", "paid", "overdue", "cancelled"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        result = await db.accounts_receivable.update_one(
            {"invoice_id": invoice_id},
            {"$set": {"status": status, "updated_at": datetime.utcnow().isoformat(), "updated_by": admin_id}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Receivable not found")
        
        # If marked as paid, add to cash book
        if status == "paid":
            receivable = await db.accounts_receivable.find_one({"invoice_id": invoice_id})
            if receivable:
                await db.cash_book.insert_one({
                    "entry_id": str(uuid.uuid4()),
                    "entry_type": "income",
                    "amount": receivable.get("amount", 0),
                    "description": f"AR Collection: {receivable.get('description', invoice_id)}",
                    "category": receivable.get("category", "ar_collection"),
                    "reference_no": invoice_id,
                    "date": datetime.utcnow().strftime("%Y-%m-%d"),
                    "created_at": datetime.utcnow().isoformat(),
                    "created_by": admin_id
                })
                
                await db.company_accounts.update_one(
                    {"account_type": "cash"},
                    {"$inc": {"current_balance": receivable.get("amount", 0)}},
                    upsert=True
                )
        
        return {"success": True, "message": f"Receivable marked as {status}"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating receivable: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== PHASE 2: ACCOUNTS PAYABLE (AP) ====================

@router.get("/payables")
async def get_accounts_payable(status: str = "all", page: int = 1, limit: int = 50):
    """Get Accounts Payable - Money owed BY the company"""
    try:
        skip = (page - 1) * limit
        
        query = {}
        if status == "pending":
            query["status"] = "pending"
        elif status == "overdue":
            query["status"] = "overdue"
        elif status == "paid":
            query["status"] = "paid"
        
        payables = await db.accounts_payable.find(query).sort("due_date", 1).skip(skip).limit(limit).to_list(limit)
        total = await db.accounts_payable.count_documents(query)
        
        # Calculate totals
        all_payables = await db.accounts_payable.find({}).to_list(length=1000)
        total_pending = sum(p.get("amount", 0) for p in all_payables if p.get("status") == "pending")
        total_overdue = sum(p.get("amount", 0) for p in all_payables if p.get("status") == "overdue")
        total_paid = sum(p.get("amount", 0) for p in all_payables if p.get("status") == "paid")
        
        # Add PRC redemption liability
        prc_liability = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(length=1)
        prc_redemption_liability = (prc_liability[0]["total"] if prc_liability else 0) * get_prc_ledger_rate()
        
        return {
            "summary": {
                "total_pending": round(total_pending, 2),
                "total_overdue": round(total_overdue, 2),
                "total_paid": round(total_paid, 2),
                "total_outstanding": round(total_pending + total_overdue, 2),
                "prc_redemption_liability": round(prc_redemption_liability, 2)
            },
            "payables": [{
                "id": str(p.get("_id", "")),
                "bill_id": p.get("bill_id", ""),
                "vendor_name": p.get("vendor_name", ""),
                "vendor_id": p.get("vendor_id", ""),
                "description": p.get("description", ""),
                "amount": p.get("amount", 0),
                "due_date": p.get("due_date", ""),
                "status": p.get("status", "pending"),
                "days_overdue": p.get("days_overdue", 0),
                "category": p.get("category", ""),
                "created_at": p.get("created_at", "")
            } for p in payables],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logging.error(f"Error getting accounts payable: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/payables")
async def create_payable(
    vendor_name: str,
    vendor_id: str = "",
    description: str = "",
    amount: float = 0,
    due_date: str = None,
    category: str = "vendor_payment",
    admin_id: str = ""
):
    """Create a new accounts payable entry"""
    try:
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        now = datetime.utcnow()
        due = datetime.fromisoformat(due_date) if due_date else now + timedelta(days=30)
        
        payable = {
            "bill_id": f"BILL-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
            "vendor_name": vendor_name,
            "vendor_id": vendor_id,
            "description": description,
            "amount": amount,
            "due_date": due.isoformat(),
            "status": "pending",
            "days_overdue": 0,
            "category": category,
            "created_at": now.isoformat(),
            "created_by": admin_id
        }
        
        await db.accounts_payable.insert_one(payable)
        
        return {
            "success": True,
            "message": "Payable created successfully",
            "bill_id": payable["bill_id"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating payable: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/payables/{bill_id}/status")
async def update_payable_status(bill_id: str, status: str, payment_method: str = "cash", admin_id: str = ""):
    """Update payable status (pending, paid, overdue)"""
    try:
        if status not in ["pending", "paid", "overdue", "cancelled"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        result = await db.accounts_payable.update_one(
            {"bill_id": bill_id},
            {"$set": {"status": status, "updated_at": datetime.utcnow().isoformat(), "updated_by": admin_id}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Payable not found")
        
        # If marked as paid, add to cash/bank book as expense
        if status == "paid":
            payable = await db.accounts_payable.find_one({"bill_id": bill_id})
            if payable:
                collection = db.cash_book if payment_method == "cash" else db.bank_book
                account_type = "cash" if payment_method == "cash" else "bank"
                
                await collection.insert_one({
                    "entry_id": str(uuid.uuid4()),
                    "entry_type": "expense",
                    "amount": payable.get("amount", 0),
                    "description": f"AP Payment: {payable.get('description', bill_id)}",
                    "category": payable.get("category", "ap_payment"),
                    "reference_no": bill_id,
                    "date": datetime.utcnow().strftime("%Y-%m-%d"),
                    "created_at": datetime.utcnow().isoformat(),
                    "created_by": admin_id
                })
                
                await db.company_accounts.update_one(
                    {"account_type": account_type},
                    {"$inc": {"current_balance": -payable.get("amount", 0)}},
                    upsert=True
                )
        
        return {"success": True, "message": f"Payable marked as {status}"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating payable: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== PHASE 2: BANK RECONCILIATION ====================

@router.get("/bank-reconciliation")
async def get_bank_reconciliation(month: int = None, year: int = None):
    """Get bank reconciliation data"""
    try:
        now = datetime.utcnow()
        target_month = month or now.month
        target_year = year or now.year
        
        start_date = datetime(target_year, target_month, 1)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1)
        else:
            end_date = datetime(target_year, target_month + 1, 1)
        
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        
        # Get bank book entries for the month
        bank_entries = await db.bank_book.find({
            "created_at": {"$gte": start_str, "$lt": end_str}
        }).sort("created_at", 1).to_list(length=1000)
        
        # Get bank statements (uploaded/imported)
        bank_statements = await db.bank_statements.find({
            "transaction_date": {"$gte": start_str, "$lt": end_str}
        }).sort("transaction_date", 1).to_list(length=1000)
        
        # Get bank account balance
        bank_account = await db.company_accounts.find_one({"account_type": "bank"})
        book_balance = bank_account.get("current_balance", 0) if bank_account else 0
        
        # Calculate totals from entries
        total_deposits = sum(e.get("amount", 0) for e in bank_entries if e.get("entry_type") in ["income", "capital", "transfer_in"])
        total_withdrawals = sum(e.get("amount", 0) for e in bank_entries if e.get("entry_type") in ["expense", "transfer_out"])
        
        # Unreconciled items
        reconciled_refs = set(s.get("reference_no") for s in bank_statements if s.get("reconciled"))
        unreconciled_entries = [e for e in bank_entries if e.get("reference_no") not in reconciled_refs]
        
        return {
            "period": f"{start_date.strftime('%B %Y')}",
            "month": target_month,
            "year": target_year,
            "book_balance": round(book_balance, 2),
            "bank_statement_balance": 0,  # Would come from imported statements
            "difference": round(book_balance, 2),
            "is_reconciled": len(unreconciled_entries) == 0,
            "summary": {
                "total_deposits": round(total_deposits, 2),
                "total_withdrawals": round(total_withdrawals, 2),
                "entries_count": len(bank_entries),
                "unreconciled_count": len(unreconciled_entries)
            },
            "entries": [{
                "id": str(e.get("_id", "")),
                "entry_id": e.get("entry_id", ""),
                "date": e.get("date", ""),
                "description": e.get("description", ""),
                "amount": e.get("amount", 0),
                "entry_type": e.get("entry_type", ""),
                "reference_no": e.get("reference_no", ""),
                "reconciled": e.get("reference_no") in reconciled_refs
            } for e in bank_entries[:50]]
        }
    except Exception as e:
        logging.error(f"Error getting bank reconciliation: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/bank-reconciliation/reconcile")
async def reconcile_entry(entry_id: str, bank_ref: str = "", admin_id: str = ""):
    """Mark a bank entry as reconciled"""
    try:
        result = await db.bank_book.update_one(
            {"entry_id": entry_id},
            {"$set": {"reconciled": True, "bank_reference": bank_ref, "reconciled_at": datetime.utcnow().isoformat(), "reconciled_by": admin_id}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        return {"success": True, "message": "Entry reconciled successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error reconciling entry: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== PHASE 2: GST/TAX TRACKING ====================

GST_RATES = {
    "0": 0,
    "5": 5,
    "12": 12,
    "18": 18,
    "28": 28
}

@router.get("/gst-summary")
async def get_gst_summary(month: int = None, year: int = None):
    """Get GST summary for a month"""
    try:
        now = datetime.utcnow()
        target_month = month or now.month
        target_year = year or now.year
        
        start_date = datetime(target_year, target_month, 1)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1)
        else:
            end_date = datetime(target_year, target_month + 1, 1)
        
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        
        # Get GST entries
        gst_entries = await db.gst_entries.find({
            "created_at": {"$gte": start_str, "$lt": end_str}
        }).to_list(length=1000)
        
        # Calculate input and output GST
        input_gst = sum(e.get("gst_amount", 0) for e in gst_entries if e.get("gst_type") == "input")
        output_gst = sum(e.get("gst_amount", 0) for e in gst_entries if e.get("gst_type") == "output")
        
        # GST by rate
        gst_by_rate = {"0": 0, "5": 0, "12": 0, "18": 0, "28": 0}
        for entry in gst_entries:
            rate = str(entry.get("gst_rate", "18"))
            if rate in gst_by_rate:
                gst_by_rate[rate] += entry.get("gst_amount", 0)
        
        net_gst = output_gst - input_gst
        
        return {
            "period": f"{start_date.strftime('%B %Y')}",
            "month": target_month,
            "year": target_year,
            "summary": {
                "input_gst": round(input_gst, 2),
                "output_gst": round(output_gst, 2),
                "net_gst_payable": round(max(net_gst, 0), 2),
                "net_gst_credit": round(max(-net_gst, 0), 2)
            },
            "gst_by_rate": {k: round(v, 2) for k, v in gst_by_rate.items()},
            "entries_count": len(gst_entries),
            "recent_entries": [{
                "id": str(e.get("_id", "")),
                "date": e.get("date", ""),
                "description": e.get("description", ""),
                "gst_type": e.get("gst_type", ""),
                "gst_rate": e.get("gst_rate", 0),
                "base_amount": e.get("base_amount", 0),
                "gst_amount": e.get("gst_amount", 0)
            } for e in gst_entries[-20:]]
        }
    except Exception as e:
        logging.error(f"Error getting GST summary: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/gst-entry")
async def add_gst_entry(
    gst_type: str,  # input or output
    base_amount: float,
    gst_rate: int = 18,
    description: str = "",
    invoice_no: str = "",
    party_name: str = "",
    date: str = None,
    admin_id: str = ""
):
    """Add a GST entry"""
    try:
        if gst_type not in ["input", "output"]:
            raise HTTPException(status_code=400, detail="GST type must be 'input' or 'output'")
        
        if gst_rate not in [0, 5, 12, 18, 28]:
            raise HTTPException(status_code=400, detail="Invalid GST rate. Use 0, 5, 12, 18, or 28")
        
        gst_amount = base_amount * (gst_rate / 100)
        now = datetime.utcnow()
        
        entry = {
            "entry_id": str(uuid.uuid4()),
            "gst_type": gst_type,
            "base_amount": base_amount,
            "gst_rate": gst_rate,
            "gst_amount": round(gst_amount, 2),
            "total_amount": round(base_amount + gst_amount, 2),
            "description": description,
            "invoice_no": invoice_no,
            "party_name": party_name,
            "date": date or now.strftime("%Y-%m-%d"),
            "created_at": now.isoformat(),
            "created_by": admin_id
        }
        
        await db.gst_entries.insert_one(entry)
        
        return {
            "success": True,
            "message": f"{gst_type.upper()} GST entry added",
            "entry_id": entry["entry_id"],
            "gst_amount": entry["gst_amount"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error adding GST entry: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== PHASE 2: BUDGET VS ACTUAL ====================

@router.get("/budget")
async def get_budget_vs_actual(month: int = None, year: int = None):
    """Get budget vs actual comparison"""
    try:
        now = datetime.utcnow()
        target_month = month or now.month
        target_year = year or now.year
        
        # Get budget for the month
        budget = await db.budgets.find_one({
            "month": target_month,
            "year": target_year
        })
        
        if not budget:
            budget = {"categories": {}}
        
        # Get actual expenses
        start_date = datetime(target_year, target_month, 1)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1)
        else:
            end_date = datetime(target_year, target_month + 1, 1)
        
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        
        cash_expenses = await db.cash_book.find({
            "entry_type": "expense",
            "created_at": {"$gte": start_str, "$lt": end_str}
        }).to_list(length=1000)
        
        bank_expenses = await db.bank_book.find({
            "entry_type": "expense",
            "created_at": {"$gte": start_str, "$lt": end_str}
        }).to_list(length=1000)
        
        all_expenses = cash_expenses + bank_expenses
        
        # Group by category
        actual_by_category = {}
        for exp in all_expenses:
            cat = exp.get("category", "other")
            if cat not in actual_by_category:
                actual_by_category[cat] = 0
            actual_by_category[cat] += exp.get("amount", 0)
        
        # Compare with budget
        budget_categories = budget.get("categories", {})
        comparison = []
        
        all_categories = set(list(budget_categories.keys()) + list(actual_by_category.keys()))
        
        for cat in all_categories:
            budgeted = budget_categories.get(cat, 0)
            actual = actual_by_category.get(cat, 0)
            variance = budgeted - actual
            variance_percent = (variance / budgeted * 100) if budgeted > 0 else 0
            
            comparison.append({
                "category": cat,
                "budgeted": round(budgeted, 2),
                "actual": round(actual, 2),
                "variance": round(variance, 2),
                "variance_percent": round(variance_percent, 2),
                "status": "under" if variance > 0 else "over" if variance < 0 else "on_track"
            })
        
        total_budgeted = sum(c["budgeted"] for c in comparison)
        total_actual = sum(c["actual"] for c in comparison)
        
        return {
            "period": f"{start_date.strftime('%B %Y')}",
            "month": target_month,
            "year": target_year,
            "summary": {
                "total_budgeted": round(total_budgeted, 2),
                "total_actual": round(total_actual, 2),
                "total_variance": round(total_budgeted - total_actual, 2),
                "budget_utilization": round((total_actual / total_budgeted * 100) if total_budgeted > 0 else 0, 2)
            },
            "comparison": sorted(comparison, key=lambda x: x["actual"], reverse=True)
        }
    except Exception as e:
        logging.error(f"Error getting budget vs actual: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.post("/budget")
async def set_budget(
    month: int,
    year: int,
    categories: dict,
    admin_id: str = ""
):
    """Set budget for a month"""
    try:
        now = datetime.utcnow()
        
        await db.budgets.update_one(
            {"month": month, "year": year},
            {"$set": {
                "categories": categories,
                "updated_at": now.isoformat(),
                "updated_by": admin_id
            }},
            upsert=True
        )
        
        return {
            "success": True,
            "message": f"Budget set for {month}/{year}",
            "categories_count": len(categories)
        }
    except Exception as e:
        logging.error(f"Error setting budget: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== PHASE 2: FINANCIAL RATIOS ====================

@router.get("/financial-ratios")
async def get_financial_ratios():
    """Get key financial ratios"""
    try:
        # Get balances
        cash_account = await db.company_accounts.find_one({"account_type": "cash"})
        bank_account = await db.company_accounts.find_one({"account_type": "bank"})
        
        cash_balance = cash_account.get("current_balance", 0) if cash_account else 0
        bank_balance = bank_account.get("current_balance", 0) if bank_account else 0
        total_cash = cash_balance + bank_balance
        
        # Current liabilities (PRC + AP)
        prc_total = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(length=1)
        prc_liability = (prc_total[0]["total"] if prc_total else 0) * get_prc_ledger_rate()
        
        ap_pending = await db.accounts_payable.find({"status": {"$in": ["pending", "overdue"]}}).to_list(length=1000)
        total_ap = sum(p.get("amount", 0) for p in ap_pending)
        
        total_current_liabilities = prc_liability + total_ap
        
        # Income and expenses (last 30 days for simplicity)
        thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        recent_income = await db.cash_book.find({
            "entry_type": "income",
            "created_at": {"$gte": thirty_days_ago}
        }).to_list(length=1000)
        recent_income += await db.bank_book.find({
            "entry_type": "income",
            "created_at": {"$gte": thirty_days_ago}
        }).to_list(length=1000)
        
        recent_expenses = await db.cash_book.find({
            "entry_type": "expense",
            "created_at": {"$gte": thirty_days_ago}
        }).to_list(length=1000)
        recent_expenses += await db.bank_book.find({
            "entry_type": "expense",
            "created_at": {"$gte": thirty_days_ago}
        }).to_list(length=1000)
        
        total_income = sum(i.get("amount", 0) for i in recent_income)
        total_expenses = sum(e.get("amount", 0) for e in recent_expenses)
        net_profit = total_income - total_expenses
        
        # Calculate ratios
        current_ratio = total_cash / total_current_liabilities if total_current_liabilities > 0 else float('inf')
        quick_ratio = total_cash / total_current_liabilities if total_current_liabilities > 0 else float('inf')
        profit_margin = (net_profit / total_income * 100) if total_income > 0 else 0
        expense_ratio = (total_expenses / total_income * 100) if total_income > 0 else 0
        
        # Health score (0-100)
        health_score = 50
        if current_ratio >= 2:
            health_score += 15
        elif current_ratio >= 1:
            health_score += 8
        if profit_margin >= 20:
            health_score += 20
        elif profit_margin >= 10:
            health_score += 10
        elif profit_margin >= 0:
            health_score += 5
        if expense_ratio <= 70:
            health_score += 15
        elif expense_ratio <= 85:
            health_score += 8
        
        return {
            "ratios": {
                "current_ratio": {
                    "value": round(min(current_ratio, 999), 2),
                    "benchmark": 2.0,
                    "status": "good" if current_ratio >= 2 else "fair" if current_ratio >= 1 else "poor",
                    "description": "Current Assets / Current Liabilities"
                },
                "quick_ratio": {
                    "value": round(min(quick_ratio, 999), 2),
                    "benchmark": 1.0,
                    "status": "good" if quick_ratio >= 1 else "poor",
                    "description": "Quick Assets / Current Liabilities"
                },
                "profit_margin": {
                    "value": round(profit_margin, 2),
                    "benchmark": 15.0,
                    "status": "good" if profit_margin >= 15 else "fair" if profit_margin >= 5 else "poor",
                    "description": "Net Profit / Revenue × 100"
                },
                "expense_ratio": {
                    "value": round(expense_ratio, 2),
                    "benchmark": 70.0,
                    "status": "good" if expense_ratio <= 70 else "fair" if expense_ratio <= 85 else "poor",
                    "description": "Total Expenses / Revenue × 100"
                }
            },
            "health_score": min(health_score, 100),
            "health_status": "excellent" if health_score >= 80 else "good" if health_score >= 60 else "fair" if health_score >= 40 else "needs_attention",
            "period": "Last 30 days",
            "underlying_data": {
                "total_cash": round(total_cash, 2),
                "total_current_liabilities": round(total_current_liabilities, 2),
                "total_income": round(total_income, 2),
                "total_expenses": round(total_expenses, 2),
                "net_profit": round(net_profit, 2)
            }
        }
    except Exception as e:
        logging.error(f"Error calculating financial ratios: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ==================== PHASE 2: AUDIT TRAIL ====================

@router.get("/audit-trail")
async def get_audit_trail(page: int = 1, limit: int = 50, action_type: str = "all"):
    """Get audit trail of all accounting actions"""
    try:
        skip = (page - 1) * limit
        
        query = {}
        if action_type != "all":
            query["action_type"] = action_type
        
        audit_logs = await db.audit_trail.find(query).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.audit_trail.count_documents(query)
        
        return {
            "audit_logs": [{
                "id": str(log.get("_id", "")),
                "timestamp": log.get("timestamp", ""),
                "user_id": log.get("user_id", ""),
                "user_email": log.get("user_email", ""),
                "action_type": log.get("action_type", ""),
                "entity_type": log.get("entity_type", ""),
                "entity_id": log.get("entity_id", ""),
                "description": log.get("description", ""),
                "old_value": log.get("old_value"),
                "new_value": log.get("new_value"),
                "ip_address": log.get("ip_address", "")
            } for log in audit_logs],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logging.error(f"Error getting audit trail: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

async def log_audit_event(
    user_id: str,
    user_email: str,
    action_type: str,
    entity_type: str,
    entity_id: str,
    description: str,
    old_value: dict = None,
    new_value: dict = None,
    ip_address: str = ""
):
    """Log an audit event"""
    try:
        await db.audit_trail.insert_one({
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "user_email": user_email,
            "action_type": action_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "description": description,
            "old_value": old_value,
            "new_value": new_value,
            "ip_address": ip_address
        })
    except Exception as e:
        logging.error(f"Error logging audit event: {e}")


# ============================================
# DATA BACKUP & ARCHIVE APIs
# ============================================

