"""
PARAS RECURRING DEPOSIT (RD) SYSTEM
=====================================
Bank-like RD system with interest on user deposits
- Auto-deduction of 20% from mining earnings
- Interest rates: 6M-7.5%, 1Y-8.5%, 2Y-9%, 3Y-9.25%
- Premature withdrawal: 3% penalty
- Migration from Luxury Life savings
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
import uuid
import logging

router = APIRouter(prefix="/rd", tags=["Recurring Deposit"])

# Module-level variables
db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

# ==================== CONSTANTS ====================
RD_INTEREST_RATES = {
    6: 7.5,    # 6 months: 7.5% p.a.
    12: 8.5,   # 1 year: 8.5% p.a.
    24: 9.0,   # 2 years: 9.0% p.a.
    36: 9.25   # 3 years: 9.25% p.a.
}

RD_MIN_DEPOSIT = 100  # Minimum PRC per deposit
RD_PREMATURE_PENALTY = 3.0  # 3% penalty for early withdrawal
RD_AUTO_DEDUCTION_PERCENT = 20  # 20% from earnings

# ==================== MODELS ====================
class CreateRDRequest(BaseModel):
    user_id: str
    monthly_deposit: float
    tenure_months: int  # 6, 12, 24, or 36
    initial_deposit: Optional[float] = 0

class DepositToRDRequest(BaseModel):
    user_id: str
    amount: float
    source: str = "manual"  # manual, auto_deduction, migration

class WithdrawRDRequest(BaseModel):
    user_id: str
    reason: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================
def calculate_maturity_amount(principal: float, rate: float, tenure_months: int) -> dict:
    """
    Calculate maturity amount with compound interest (quarterly compounding)
    """
    # Convert annual rate to quarterly
    quarterly_rate = rate / 100 / 4
    quarters = tenure_months / 3
    
    # Compound interest formula: A = P(1 + r/n)^(nt)
    maturity = principal * ((1 + quarterly_rate) ** quarters)
    interest = maturity - principal
    
    return {
        "principal": round(principal, 2),
        "interest_earned": round(interest, 2),
        "maturity_amount": round(maturity, 2),
        "effective_rate": round((interest / principal) * 100, 2) if principal > 0 else 0
    }

def calculate_current_interest(principal: float, rate: float, days_elapsed: int) -> float:
    """
    Calculate interest earned till date (daily compounding simplified)
    """
    if principal <= 0 or days_elapsed <= 0:
        return 0
    
    # Simple interest for current calculation: I = P * R * T / 365
    daily_rate = rate / 100 / 365
    interest = principal * daily_rate * days_elapsed
    return round(interest, 2)

def generate_rd_id() -> str:
    """Generate unique RD ID"""
    year = datetime.now(timezone.utc).year
    unique = uuid.uuid4().hex[:6].upper()
    return f"RD-{year}-{unique}"

# ==================== API ENDPOINTS ====================

@router.post("/create")
async def create_rd(request: CreateRDRequest):
    """Create a new Recurring Deposit"""
    try:
        # Validate tenure
        if request.tenure_months not in RD_INTEREST_RATES:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid tenure. Choose from: {list(RD_INTEREST_RATES.keys())} months"
            )
        
        # Validate minimum deposit
        if request.monthly_deposit < RD_MIN_DEPOSIT:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum monthly deposit is {RD_MIN_DEPOSIT} PRC"
            )
        
        # Check user exists
        user = await db.users.find_one({"uid": request.user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get interest rate
        interest_rate = RD_INTEREST_RATES[request.tenure_months]
        
        # Calculate dates
        now = datetime.now(timezone.utc)
        maturity_date = now + timedelta(days=request.tenure_months * 30)
        next_deposit_date = now + timedelta(days=30)
        
        # Initial deposit amount
        initial_amount = request.initial_deposit if request.initial_deposit > 0 else request.monthly_deposit
        
        # Calculate expected maturity (based on full deposits)
        total_deposits = request.monthly_deposit * request.tenure_months
        if request.initial_deposit > 0:
            total_deposits = request.initial_deposit + (request.monthly_deposit * (request.tenure_months - 1))
        
        maturity_calc = calculate_maturity_amount(total_deposits, interest_rate, request.tenure_months)
        
        # Create RD record
        rd_id = generate_rd_id()
        rd_record = {
            "rd_id": rd_id,
            "user_id": request.user_id,
            "user_name": user.get("name", "Unknown"),
            
            # RD Details
            "monthly_deposit": request.monthly_deposit,
            "tenure_months": request.tenure_months,
            "interest_rate": interest_rate,
            
            # Amounts
            "total_deposited": initial_amount,
            "interest_earned": 0,
            "expected_maturity_amount": maturity_calc["maturity_amount"],
            
            # Dates
            "start_date": now.isoformat(),
            "maturity_date": maturity_date.isoformat(),
            "next_deposit_date": next_deposit_date.isoformat(),
            "last_interest_calc_date": now.isoformat(),
            
            # Status
            "status": "active",  # active, matured, withdrawn, closed
            "deposits_made": 1,
            "deposits_remaining": request.tenure_months - 1,
            
            # Migration flags
            "migrated_from_luxury": False,
            "luxury_migration_amount": 0,
            
            # Auto-deduction settings
            "auto_deduction_enabled": True,
            "auto_deduction_percent": RD_AUTO_DEDUCTION_PERCENT,
            
            # History
            "deposit_history": [{
                "date": now.isoformat(),
                "amount": initial_amount,
                "source": "initial_deposit",
                "balance_after": initial_amount
            }],
            
            # Timestamps
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.recurring_deposits.insert_one(rd_record)
        
        # Update user's RD count
        await db.users.update_one(
            {"uid": request.user_id},
            {
                "$inc": {"rd_count": 1},
                "$set": {"has_active_rd": True, "updated_at": now.isoformat()}
            }
        )
        
        # Create notification
        await db.notifications.insert_one({
            "user_id": request.user_id,
            "title": "🏦 RD Account Created!",
            "message": f"Your {request.tenure_months}-month RD is now active at {interest_rate}% p.a. Expected maturity: ₹{maturity_calc['maturity_amount']:,.0f} PRC",
            "type": "rd_created",
            "related_id": rd_id,
            "read": False,
            "created_at": now.isoformat()
        })
        
        return {
            "success": True,
            "rd_id": rd_id,
            "message": f"RD created successfully! {request.tenure_months} months at {interest_rate}% p.a.",
            "details": {
                "rd_id": rd_id,
                "tenure": f"{request.tenure_months} months",
                "interest_rate": f"{interest_rate}% p.a.",
                "monthly_deposit": request.monthly_deposit,
                "initial_deposit": initial_amount,
                "expected_maturity": maturity_calc["maturity_amount"],
                "maturity_date": maturity_date.strftime("%d %b %Y")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating RD: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list/{user_id}")
async def get_user_rds(user_id: str):
    """Get all RDs for a user"""
    try:
        rds = await db.recurring_deposits.find(
            {"user_id": user_id}
        ).sort("created_at", -1).to_list(100)
        
        result = []
        now = datetime.now(timezone.utc)
        
        for rd in rds:
            # Calculate current interest
            start_date = datetime.fromisoformat(rd["start_date"].replace("Z", "+00:00")) if isinstance(rd["start_date"], str) else rd["start_date"]
            days_elapsed = (now - start_date).days
            
            current_interest = calculate_current_interest(
                rd["total_deposited"],
                rd["interest_rate"],
                days_elapsed
            )
            
            # Calculate progress
            progress_percent = (rd["deposits_made"] / rd["tenure_months"]) * 100
            
            # Time remaining
            maturity_date = datetime.fromisoformat(rd["maturity_date"].replace("Z", "+00:00")) if isinstance(rd["maturity_date"], str) else rd["maturity_date"]
            days_remaining = max(0, (maturity_date - now).days)
            
            result.append({
                "rd_id": rd["rd_id"],
                "tenure_months": rd["tenure_months"],
                "interest_rate": rd["interest_rate"],
                "monthly_deposit": rd["monthly_deposit"],
                "total_deposited": rd["total_deposited"],
                "interest_earned": current_interest,
                "current_value": round(rd["total_deposited"] + current_interest, 2),
                "expected_maturity": rd["expected_maturity_amount"],
                "progress_percent": round(progress_percent, 1),
                "deposits_made": rd["deposits_made"],
                "deposits_remaining": rd["deposits_remaining"],
                "status": rd["status"],
                "start_date": rd["start_date"],
                "maturity_date": rd["maturity_date"],
                "days_remaining": days_remaining,
                "migrated_from_luxury": rd.get("migrated_from_luxury", False),
                "auto_deduction_enabled": rd.get("auto_deduction_enabled", True)
            })
        
        # Calculate totals
        total_deposited = sum(r["total_deposited"] for r in result if r["status"] == "active")
        total_interest = sum(r["interest_earned"] for r in result if r["status"] == "active")
        total_value = total_deposited + total_interest
        
        return {
            "success": True,
            "rds": result,
            "summary": {
                "total_rds": len(result),
                "active_rds": len([r for r in result if r["status"] == "active"]),
                "total_deposited": round(total_deposited, 2),
                "total_interest_earned": round(total_interest, 2),
                "total_current_value": round(total_value, 2)
            }
        }
        
    except Exception as e:
        logging.error(f"Error fetching RDs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/details/{rd_id}")
async def get_rd_details(rd_id: str):
    """Get detailed information about a specific RD"""
    try:
        rd = await db.recurring_deposits.find_one({"rd_id": rd_id})
        if not rd:
            raise HTTPException(status_code=404, detail="RD not found")
        
        now = datetime.now(timezone.utc)
        start_date = datetime.fromisoformat(rd["start_date"].replace("Z", "+00:00")) if isinstance(rd["start_date"], str) else rd["start_date"]
        maturity_date = datetime.fromisoformat(rd["maturity_date"].replace("Z", "+00:00")) if isinstance(rd["maturity_date"], str) else rd["maturity_date"]
        
        days_elapsed = (now - start_date).days
        days_remaining = max(0, (maturity_date - now).days)
        
        # Calculate current interest
        current_interest = calculate_current_interest(
            rd["total_deposited"],
            rd["interest_rate"],
            days_elapsed
        )
        
        # Calculate premature withdrawal amount
        current_value = rd["total_deposited"] + current_interest
        penalty_amount = current_value * (RD_PREMATURE_PENALTY / 100)
        premature_withdrawal_amount = current_value - penalty_amount
        
        # Remove MongoDB _id
        rd.pop("_id", None)
        
        return {
            "success": True,
            "rd": {
                **rd,
                "interest_earned": current_interest,
                "current_value": round(current_value, 2),
                "days_elapsed": days_elapsed,
                "days_remaining": days_remaining,
                "premature_withdrawal": {
                    "amount": round(premature_withdrawal_amount, 2),
                    "penalty_percent": RD_PREMATURE_PENALTY,
                    "penalty_amount": round(penalty_amount, 2)
                },
                "is_mature": days_remaining <= 0 and rd["status"] == "active"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching RD details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deposit/{rd_id}")
async def deposit_to_rd(rd_id: str, request: DepositToRDRequest):
    """Add deposit to an existing RD"""
    try:
        rd = await db.recurring_deposits.find_one({"rd_id": rd_id})
        if not rd:
            raise HTTPException(status_code=404, detail="RD not found")
        
        if rd["status"] != "active":
            raise HTTPException(status_code=400, detail="RD is not active")
        
        if rd["user_id"] != request.user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        if request.amount < 1:
            raise HTTPException(status_code=400, detail="Invalid deposit amount")
        
        now = datetime.now(timezone.utc)
        new_total = rd["total_deposited"] + request.amount
        
        # Update RD
        await db.recurring_deposits.update_one(
            {"rd_id": rd_id},
            {
                "$set": {
                    "total_deposited": new_total,
                    "updated_at": now.isoformat()
                },
                "$inc": {"deposits_made": 1 if request.source != "auto_deduction" else 0},
                "$push": {
                    "deposit_history": {
                        "date": now.isoformat(),
                        "amount": request.amount,
                        "source": request.source,
                        "balance_after": new_total
                    }
                }
            }
        )
        
        # Recalculate expected maturity
        maturity_calc = calculate_maturity_amount(
            new_total, 
            rd["interest_rate"], 
            rd["tenure_months"]
        )
        
        await db.recurring_deposits.update_one(
            {"rd_id": rd_id},
            {"$set": {"expected_maturity_amount": maturity_calc["maturity_amount"]}}
        )
        
        return {
            "success": True,
            "message": f"₹{request.amount:,.0f} PRC deposited successfully!",
            "new_balance": new_total,
            "expected_maturity": maturity_calc["maturity_amount"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error depositing to RD: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/withdraw/{rd_id}")
async def withdraw_rd(rd_id: str, request: WithdrawRDRequest):
    """Premature withdrawal from RD (3% penalty)"""
    try:
        rd = await db.recurring_deposits.find_one({"rd_id": rd_id})
        if not rd:
            raise HTTPException(status_code=404, detail="RD not found")
        
        if rd["status"] != "active":
            raise HTTPException(status_code=400, detail="RD is not active")
        
        if rd["user_id"] != request.user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        now = datetime.now(timezone.utc)
        start_date = datetime.fromisoformat(rd["start_date"].replace("Z", "+00:00")) if isinstance(rd["start_date"], str) else rd["start_date"]
        maturity_date = datetime.fromisoformat(rd["maturity_date"].replace("Z", "+00:00")) if isinstance(rd["maturity_date"], str) else rd["maturity_date"]
        
        days_elapsed = (now - start_date).days
        is_mature = now >= maturity_date
        
        # Calculate current interest
        current_interest = calculate_current_interest(
            rd["total_deposited"],
            rd["interest_rate"],
            days_elapsed
        )
        
        current_value = rd["total_deposited"] + current_interest
        
        # Apply penalty if premature
        if is_mature:
            withdrawal_amount = current_value
            penalty_amount = 0
            status = "matured"
            message = f"🎉 RD matured! ₹{withdrawal_amount:,.0f} PRC credited to wallet"
        else:
            penalty_amount = current_value * (RD_PREMATURE_PENALTY / 100)
            withdrawal_amount = current_value - penalty_amount
            status = "withdrawn"
            message = f"⚠️ Premature withdrawal: ₹{withdrawal_amount:,.0f} PRC credited (₹{penalty_amount:,.0f} penalty deducted)"
        
        # Update RD status
        await db.recurring_deposits.update_one(
            {"rd_id": rd_id},
            {
                "$set": {
                    "status": status,
                    "withdrawal_date": now.isoformat(),
                    "withdrawal_amount": withdrawal_amount,
                    "penalty_amount": penalty_amount,
                    "final_interest_earned": current_interest,
                    "is_premature": not is_mature,
                    "withdrawal_reason": request.reason,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Credit to user wallet
        user = await db.users.find_one({"uid": request.user_id})
        current_balance = user.get("prc_balance", 0) or 0
        new_balance = current_balance + withdrawal_amount
        
        await db.users.update_one(
            {"uid": request.user_id},
            {
                "$set": {
                    "prc_balance": new_balance,
                    "updated_at": now.isoformat()
                },
                "$inc": {"rd_withdrawals": 1}
            }
        )
        
        # Create transaction record
        await db.transactions.insert_one({
            "transaction_id": f"RD_WD_{uuid.uuid4().hex[:8].upper()}",
            "user_id": request.user_id,
            "type": "rd_withdrawal",
            "amount": withdrawal_amount,
            "rd_id": rd_id,
            "principal": rd["total_deposited"],
            "interest": current_interest,
            "penalty": penalty_amount,
            "is_premature": not is_mature,
            "balance_after": new_balance,
            "created_at": now.isoformat()
        })
        
        # Update user's active RD flag
        active_rds = await db.recurring_deposits.count_documents({
            "user_id": request.user_id,
            "status": "active"
        })
        
        await db.users.update_one(
            {"uid": request.user_id},
            {"$set": {"has_active_rd": active_rds > 0}}
        )
        
        # Create notification
        await db.notifications.insert_one({
            "user_id": request.user_id,
            "title": "💰 RD Withdrawal Complete",
            "message": message,
            "type": "rd_withdrawal",
            "related_id": rd_id,
            "read": False,
            "created_at": now.isoformat()
        })
        
        return {
            "success": True,
            "message": message,
            "withdrawal_details": {
                "principal": rd["total_deposited"],
                "interest_earned": current_interest,
                "penalty_amount": penalty_amount,
                "net_amount": withdrawal_amount,
                "new_wallet_balance": new_balance,
                "is_premature": not is_mature
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error withdrawing RD: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/migrate-from-luxury/{user_id}")
async def migrate_luxury_to_rd(user_id: str):
    """
    Migrate all Luxury Life savings to a new RD account
    - Default tenure: 12 months at 8.5% p.a.
    """
    try:
        # Get luxury savings
        luxury = await db.luxury_savings.find_one({"user_id": user_id})
        if not luxury:
            raise HTTPException(status_code=404, detail="No Luxury Life savings found")
        
        # Calculate total luxury savings
        mobile_savings = luxury.get("mobile_savings", 0) or 0
        bike_savings = luxury.get("bike_savings", 0) or 0
        car_savings = luxury.get("car_savings", 0) or 0
        total_luxury = mobile_savings + bike_savings + car_savings
        
        if total_luxury < RD_MIN_DEPOSIT:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient Luxury savings ({total_luxury:.0f} PRC). Minimum {RD_MIN_DEPOSIT} PRC required."
            )
        
        # Check if user exists
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create RD with migrated amount (12 months default)
        now = datetime.now(timezone.utc)
        tenure_months = 12
        interest_rate = RD_INTEREST_RATES[tenure_months]
        maturity_date = now + timedelta(days=tenure_months * 30)
        
        # Calculate expected maturity
        maturity_calc = calculate_maturity_amount(total_luxury, interest_rate, tenure_months)
        
        rd_id = generate_rd_id()
        rd_record = {
            "rd_id": rd_id,
            "user_id": user_id,
            "user_name": user.get("name", "Unknown"),
            
            # RD Details
            "monthly_deposit": 0,  # No monthly commitment for migration
            "tenure_months": tenure_months,
            "interest_rate": interest_rate,
            
            # Amounts
            "total_deposited": total_luxury,
            "interest_earned": 0,
            "expected_maturity_amount": maturity_calc["maturity_amount"],
            
            # Dates
            "start_date": now.isoformat(),
            "maturity_date": maturity_date.isoformat(),
            "next_deposit_date": None,  # No scheduled deposits
            "last_interest_calc_date": now.isoformat(),
            
            # Status
            "status": "active",
            "deposits_made": 1,
            "deposits_remaining": 0,
            
            # Migration flags
            "migrated_from_luxury": True,
            "luxury_migration_amount": total_luxury,
            "luxury_migration_breakdown": {
                "mobile_savings": mobile_savings,
                "bike_savings": bike_savings,
                "car_savings": car_savings
            },
            
            # Auto-deduction settings (enabled by default)
            "auto_deduction_enabled": True,
            "auto_deduction_percent": RD_AUTO_DEDUCTION_PERCENT,
            
            # History
            "deposit_history": [{
                "date": now.isoformat(),
                "amount": total_luxury,
                "source": "luxury_migration",
                "balance_after": total_luxury,
                "breakdown": {
                    "mobile": mobile_savings,
                    "bike": bike_savings,
                    "car": car_savings
                }
            }],
            
            # Timestamps
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.recurring_deposits.insert_one(rd_record)
        
        # Mark luxury savings as migrated
        await db.luxury_savings.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "migrated_to_rd": True,
                    "rd_migration_id": rd_id,
                    "migration_date": now.isoformat(),
                    "mobile_savings": 0,
                    "bike_savings": 0,
                    "car_savings": 0,
                    "total_savings": 0,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Update user
        await db.users.update_one(
            {"uid": user_id},
            {
                "$set": {
                    "has_active_rd": True,
                    "luxury_migrated_to_rd": True,
                    "luxury_savings": 0,
                    "updated_at": now.isoformat()
                },
                "$inc": {"rd_count": 1}
            }
        )
        
        # Create notification
        await db.notifications.insert_one({
            "user_id": user_id,
            "title": "🎉 Luxury Life → RD Migration Complete!",
            "message": f"Your ₹{total_luxury:,.0f} PRC Luxury savings have been converted to a 12-month RD at {interest_rate}% p.a. Expected maturity: ₹{maturity_calc['maturity_amount']:,.0f} PRC",
            "type": "rd_migration",
            "related_id": rd_id,
            "read": False,
            "created_at": now.isoformat()
        })
        
        return {
            "success": True,
            "message": "Luxury Life savings successfully migrated to RD!",
            "rd_id": rd_id,
            "migration_details": {
                "total_migrated": total_luxury,
                "breakdown": {
                    "mobile_savings": mobile_savings,
                    "bike_savings": bike_savings,
                    "car_savings": car_savings
                },
                "rd_tenure": f"{tenure_months} months",
                "interest_rate": f"{interest_rate}% p.a.",
                "expected_maturity": maturity_calc["maturity_amount"],
                "maturity_date": maturity_date.strftime("%d %b %Y")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error migrating luxury to RD: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interest-rates")
async def get_interest_rates():
    """Get current RD interest rates"""
    return {
        "success": True,
        "rates": [
            {"tenure_months": 6, "tenure_label": "6 Months", "rate": 7.5},
            {"tenure_months": 12, "tenure_label": "1 Year", "rate": 8.5},
            {"tenure_months": 24, "tenure_label": "2 Years", "rate": 9.0},
            {"tenure_months": 36, "tenure_label": "3 Years", "rate": 9.25}
        ],
        "min_deposit": RD_MIN_DEPOSIT,
        "premature_penalty": RD_PREMATURE_PENALTY,
        "auto_deduction_percent": RD_AUTO_DEDUCTION_PERCENT
    }


@router.post("/toggle-auto-deduction/{rd_id}")
async def toggle_auto_deduction(rd_id: str, user_id: str, enabled: bool):
    """Enable/disable auto-deduction for an RD"""
    try:
        rd = await db.recurring_deposits.find_one({"rd_id": rd_id})
        if not rd:
            raise HTTPException(status_code=404, detail="RD not found")
        
        if rd["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        await db.recurring_deposits.update_one(
            {"rd_id": rd_id},
            {
                "$set": {
                    "auto_deduction_enabled": enabled,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": f"Auto-deduction {'enabled' if enabled else 'disabled'} for RD",
            "auto_deduction_enabled": enabled
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error toggling auto-deduction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/all")
async def admin_get_all_rds(skip: int = 0, limit: int = 50, status: str = None):
    """Admin: Get all RDs with pagination"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        rds = await db.recurring_deposits.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.recurring_deposits.count_documents(query)
        
        # Remove MongoDB _id and add calculated fields
        now = datetime.now(timezone.utc)
        result = []
        for rd in rds:
            rd.pop("_id", None)
            
            # Calculate current interest
            start_date = datetime.fromisoformat(rd["start_date"].replace("Z", "+00:00")) if isinstance(rd["start_date"], str) else rd["start_date"]
            days_elapsed = (now - start_date).days
            current_interest = calculate_current_interest(rd["total_deposited"], rd["interest_rate"], days_elapsed)
            
            rd["interest_earned"] = current_interest
            rd["current_value"] = round(rd["total_deposited"] + current_interest, 2)
            result.append(rd)
        
        # Stats
        total_deposited = await db.recurring_deposits.aggregate([
            {"$match": {"status": "active"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_deposited"}}}
        ]).to_list(1)
        
        total_active = await db.recurring_deposits.count_documents({"status": "active"})
        total_matured = await db.recurring_deposits.count_documents({"status": "matured"})
        total_withdrawn = await db.recurring_deposits.count_documents({"status": "withdrawn"})
        
        return {
            "success": True,
            "rds": result,
            "pagination": {
                "total": total,
                "skip": skip,
                "limit": limit
            },
            "stats": {
                "total_active": total_active,
                "total_matured": total_matured,
                "total_withdrawn": total_withdrawn,
                "total_deposited": total_deposited[0]["total"] if total_deposited else 0
            }
        }
        
    except Exception as e:
        logging.error(f"Error fetching admin RDs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/process-daily-interest")
async def admin_process_daily_interest():
    """
    Admin: Process daily interest calculation for all active RDs
    Should be run daily via cron job
    """
    try:
        now = datetime.now(timezone.utc)
        active_rds = await db.recurring_deposits.find({"status": "active"}).to_list(10000)
        
        processed = 0
        errors = 0
        
        for rd in active_rds:
            try:
                # Calculate interest since last calculation
                last_calc = datetime.fromisoformat(rd.get("last_interest_calc_date", rd["start_date"]).replace("Z", "+00:00"))
                days_since_calc = (now - last_calc).days
                
                if days_since_calc >= 1:
                    daily_interest = calculate_current_interest(
                        rd["total_deposited"],
                        rd["interest_rate"],
                        days_since_calc
                    )
                    
                    new_interest = (rd.get("interest_earned", 0) or 0) + daily_interest
                    
                    await db.recurring_deposits.update_one(
                        {"rd_id": rd["rd_id"]},
                        {
                            "$set": {
                                "interest_earned": new_interest,
                                "last_interest_calc_date": now.isoformat(),
                                "updated_at": now.isoformat()
                            }
                        }
                    )
                    processed += 1
                    
            except Exception as e:
                logging.error(f"Error processing interest for RD {rd['rd_id']}: {e}")
                errors += 1
        
        return {
            "success": True,
            "message": f"Processed {processed} RDs, {errors} errors",
            "processed": processed,
            "errors": errors
        }
        
    except Exception as e:
        logging.error(f"Error in daily interest processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/check-matured")
async def admin_check_matured_rds():
    """
    Admin: Check and notify users about matured RDs
    Should be run daily via cron job
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Find RDs that have matured but not yet marked
        active_rds = await db.recurring_deposits.find({"status": "active"}).to_list(10000)
        
        matured_count = 0
        
        for rd in active_rds:
            maturity_date = datetime.fromisoformat(rd["maturity_date"].replace("Z", "+00:00")) if isinstance(rd["maturity_date"], str) else rd["maturity_date"]
            
            if now >= maturity_date:
                # Calculate final interest
                start_date = datetime.fromisoformat(rd["start_date"].replace("Z", "+00:00")) if isinstance(rd["start_date"], str) else rd["start_date"]
                days_elapsed = (maturity_date - start_date).days
                
                final_interest = calculate_current_interest(
                    rd["total_deposited"],
                    rd["interest_rate"],
                    days_elapsed
                )
                
                maturity_amount = rd["total_deposited"] + final_interest
                
                # Update RD status
                await db.recurring_deposits.update_one(
                    {"rd_id": rd["rd_id"]},
                    {
                        "$set": {
                            "status": "matured",
                            "matured_at": now.isoformat(),
                            "final_interest_earned": final_interest,
                            "final_maturity_amount": maturity_amount,
                            "updated_at": now.isoformat()
                        }
                    }
                )
                
                # Notify user
                await db.notifications.insert_one({
                    "user_id": rd["user_id"],
                    "title": "🎉 Your RD Has Matured!",
                    "message": f"Congratulations! Your {rd['tenure_months']}-month RD has matured. You earned ₹{final_interest:,.0f} PRC interest! Total: ₹{maturity_amount:,.0f} PRC. Withdraw now!",
                    "type": "rd_matured",
                    "related_id": rd["rd_id"],
                    "read": False,
                    "created_at": now.isoformat()
                })
                
                matured_count += 1
        
        return {
            "success": True,
            "message": f"Found {matured_count} matured RDs and notified users",
            "matured_count": matured_count
        }
        
    except Exception as e:
        logging.error(f"Error checking matured RDs: {e}")
        raise HTTPException(status_code=500, detail=str(e))
