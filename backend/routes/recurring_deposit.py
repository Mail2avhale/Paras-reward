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
async def request_rd_redeem(rd_id: str, request: WithdrawRDRequest):
    """
    Request RD Redeem - Creates a request for admin approval
    - Weekly limit: Only 1 request per week (shared with Bank Redeem & EMI)
    - Admin must approve before funds are released
    """
    try:
        rd = await db.recurring_deposits.find_one({"rd_id": rd_id})
        if not rd:
            raise HTTPException(status_code=404, detail="RD not found")
        
        if rd["status"] != "active":
            raise HTTPException(status_code=400, detail="RD is not active")
        
        if rd["user_id"] != request.user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        now = datetime.now(timezone.utc)
        
        # Check weekly limit - only 1 request per week (shared with bank redeem & EMI)
        days_since_monday = now.weekday()
        monday = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        monday_str = monday.isoformat()
        
        # Check for existing RD redeem request this week
        existing_rd_request = await db.bank_redeem_requests.find_one({
            "user_id": request.user_id,
            "request_type": "rd_redeem",
            "created_at": {"$gte": monday_str},
            "status": {"$nin": ["rejected", "cancelled"]}
        })
        
        if existing_rd_request:
            raise HTTPException(
                status_code=400, 
                detail="You have already submitted an RD redeem request this week. Only 1 request allowed per week."
            )
        
        # Check for existing bank redeem request this week
        existing_bank_request = await db.bank_redeem_requests.find_one({
            "user_id": request.user_id,
            "request_type": "bank_redeem",
            "created_at": {"$gte": monday_str},
            "status": {"$nin": ["rejected", "cancelled"]}
        })
        
        if existing_bank_request:
            raise HTTPException(
                status_code=400, 
                detail="You have already submitted a Bank Redeem request this week. Only 1 redemption request allowed per week."
            )
        
        # Check for existing EMI request this week
        existing_emi_request = await db.bill_payment_requests.find_one({
            "user_id": request.user_id,
            "request_type": "loan_emi",
            "created_at": {"$gte": monday_str},
            "status": {"$nin": ["rejected", "cancelled"]}
        })
        
        if existing_emi_request:
            raise HTTPException(
                status_code=400, 
                detail="You have already submitted a Loan EMI request this week. Only 1 redemption request allowed per week."
            )
        
        # Check if user already has pending RD request for this RD
        existing_pending = await db.bank_redeem_requests.find_one({
            "user_id": request.user_id,
            "rd_id": rd_id,
            "status": "pending"
        })
        
        if existing_pending:
            raise HTTPException(
                status_code=400, 
                detail="You already have a pending redeem request for this RD."
            )
        
        # Calculate redemption amount
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
            net_amount = current_value
            penalty_amount = 0
            redeem_type = "maturity"
        else:
            penalty_amount = current_value * (RD_PREMATURE_PENALTY / 100)
            net_amount = current_value - penalty_amount
            redeem_type = "early"
        
        # Get user info
        user = await db.users.find_one({"uid": request.user_id})
        
        # Create redeem request
        request_id = f"RD_REQ_{uuid.uuid4().hex[:8].upper()}"
        
        redeem_request = {
            "request_id": request_id,
            "user_id": request.user_id,
            "user_name": user.get("name", "Unknown"),
            "user_mobile": user.get("mobile", ""),
            "user_email": user.get("email", ""),
            
            # Request type
            "request_type": "rd_redeem",
            "redeem_type": redeem_type,  # "early" or "maturity"
            
            # RD Details
            "rd_id": rd_id,
            "rd_tenure": rd["tenure_months"],
            "rd_interest_rate": rd["interest_rate"],
            
            # Amount details
            "principal_amount": rd["total_deposited"],
            "interest_earned": current_interest,
            "penalty_amount": penalty_amount,
            "penalty_percent": RD_PREMATURE_PENALTY if not is_mature else 0,
            "net_amount": net_amount,
            "is_premature": not is_mature,
            
            # Bank details (from user profile)
            "bank_details": user.get("bank_details"),
            
            # Status
            "status": "pending",
            "admin_notes": None,
            "processed_by": None,
            "processed_at": None,
            "transaction_ref": None,
            
            # Timestamps
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.bank_redeem_requests.insert_one(redeem_request)
        
        # Update RD with pending request flag
        await db.recurring_deposits.update_one(
            {"rd_id": rd_id},
            {
                "$set": {
                    "has_pending_redeem": True,
                    "pending_redeem_request_id": request_id,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Create notification
        await db.notifications.insert_one({
            "user_id": request.user_id,
            "title": "RD Redeem Request Submitted",
            "message": f"Your RD redeem request for ₹{net_amount:,.0f} PRC has been submitted. Admin will review shortly.",
            "type": "rd_redeem_request",
            "related_id": request_id,
            "read": False,
            "created_at": now.isoformat()
        })
        
        return {
            "success": True,
            "message": "RD Redeem request submitted successfully! Admin will review your request.",
            "request_id": request_id,
            "request_details": {
                "principal": rd["total_deposited"],
                "interest_earned": current_interest,
                "penalty_amount": penalty_amount,
                "net_amount": net_amount,
                "is_premature": not is_mature,
                "status": "pending"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating RD redeem request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/redeem-requests/{user_id}")
async def get_user_rd_redeem_requests(user_id: str):
    """Get user's RD redeem request history"""
    try:
        requests = await db.bank_redeem_requests.find({
            "user_id": user_id,
            "request_type": "rd_redeem"
        }).sort("created_at", -1).to_list(50)
        
        # Remove MongoDB _id
        for req in requests:
            req.pop("_id", None)
        
        return {
            "success": True,
            "requests": requests
        }
    except Exception as e:
        logging.error(f"Error fetching RD redeem requests: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
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
        "compulsory_deduction_percent": RD_AUTO_DEDUCTION_PERCENT,  # COMPULSORY - no toggle
        "info": "20% deduction is compulsory for all earnings"
    }


# Toggle API removed - 20% deduction is now COMPULSORY


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



@router.post("/admin/bulk-migrate-luxury")
async def admin_bulk_migrate_luxury():
    """
    Admin: Bulk migrate ALL users' Luxury Life savings to RD
    This is a one-time operation to convert all existing Luxury savings
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Find all luxury savings records that haven't been migrated
        luxury_records = await db.luxury_savings.find({
            "$or": [
                {"migrated_to_rd": {"$exists": False}},
                {"migrated_to_rd": False}
            ],
            "total_savings": {"$gt": 100}  # Only migrate if > 100 PRC
        }).to_list(10000)
        
        migrated_count = 0
        skipped_count = 0
        errors = []
        total_migrated_amount = 0
        
        for luxury in luxury_records:
            try:
                user_id = luxury["user_id"]
                
                # Get user
                user = await db.users.find_one({"uid": user_id})
                if not user:
                    skipped_count += 1
                    continue
                
                # Check if user already has active RD from migration
                existing_rd = await db.recurring_deposits.find_one({
                    "user_id": user_id,
                    "migrated_from_luxury": True
                })
                if existing_rd:
                    skipped_count += 1
                    continue
                
                # Calculate total luxury savings
                mobile_savings = luxury.get("mobile_savings", 0) or 0
                bike_savings = luxury.get("bike_savings", 0) or 0
                car_savings = luxury.get("car_savings", 0) or 0
                total_luxury = mobile_savings + bike_savings + car_savings
                
                if total_luxury < 100:
                    skipped_count += 1
                    continue
                
                # Create RD
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
                    "monthly_deposit": 0,
                    "tenure_months": tenure_months,
                    "interest_rate": interest_rate,
                    "total_deposited": total_luxury,
                    "interest_earned": 0,
                    "expected_maturity_amount": maturity_calc["maturity_amount"],
                    "start_date": now.isoformat(),
                    "maturity_date": maturity_date.isoformat(),
                    "next_deposit_date": None,
                    "last_interest_calc_date": now.isoformat(),
                    "status": "active",
                    "deposits_made": 1,
                    "deposits_remaining": 0,
                    "migrated_from_luxury": True,
                    "luxury_migration_amount": total_luxury,
                    "luxury_migration_breakdown": {
                        "mobile_savings": mobile_savings,
                        "bike_savings": bike_savings,
                        "car_savings": car_savings
                    },
                    "auto_deduction_enabled": True,
                    "auto_deduction_percent": RD_AUTO_DEDUCTION_PERCENT,
                    "deposit_history": [{
                        "date": now.isoformat(),
                        "amount": total_luxury,
                        "source": "bulk_luxury_migration",
                        "balance_after": total_luxury
                    }],
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
                    "title": "Luxury Life Savings Converted to RD!",
                    "message": f"Your {total_luxury:,.0f} PRC Luxury savings have been converted to a 12-month RD at {interest_rate}% p.a. interest!",
                    "type": "rd_migration",
                    "related_id": rd_id,
                    "read": False,
                    "created_at": now.isoformat()
                })
                
                migrated_count += 1
                total_migrated_amount += total_luxury
                
            except Exception as e:
                errors.append({"user_id": luxury.get("user_id"), "error": str(e)})
        
        return {
            "success": True,
            "message": f"Bulk migration complete: {migrated_count} users migrated, {skipped_count} skipped",
            "migrated_count": migrated_count,
            "skipped_count": skipped_count,
            "total_migrated_amount": total_migrated_amount,
            "errors": errors[:10] if errors else []  # Return first 10 errors
        }
        
    except Exception as e:
        logging.error(f"Error in bulk luxury migration: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ==================== ADMIN RD REDEEM REQUEST MANAGEMENT ====================

@router.get("/admin/redeem-requests")
async def admin_get_rd_redeem_requests(
    status: str = None, 
    skip: int = 0, 
    limit: int = 50,
    search: str = None
):
    """Admin: Get all RD redeem requests"""
    try:
        query = {"request_type": "rd_redeem"}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"user_name": {"$regex": search, "$options": "i"}},
                {"user_mobile": {"$regex": search, "$options": "i"}},
                {"request_id": {"$regex": search, "$options": "i"}},
                {"rd_id": {"$regex": search, "$options": "i"}}
            ]
        
        requests = await db.bank_redeem_requests.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.bank_redeem_requests.count_documents(query)
        
        # Remove MongoDB _id
        for req in requests:
            req.pop("_id", None)
        
        # Stats
        pending = await db.bank_redeem_requests.count_documents({"request_type": "rd_redeem", "status": "pending"})
        approved = await db.bank_redeem_requests.count_documents({"request_type": "rd_redeem", "status": "approved"})
        rejected = await db.bank_redeem_requests.count_documents({"request_type": "rd_redeem", "status": "rejected"})
        
        return {
            "success": True,
            "requests": requests,
            "total": total,
            "stats": {
                "pending": pending,
                "approved": approved,
                "rejected": rejected
            }
        }
        
    except Exception as e:
        logging.error(f"Error fetching RD redeem requests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/redeem-requests/{request_id}/approve")
async def admin_approve_rd_redeem(request_id: str, admin_id: str, transaction_ref: str = None):
    """Admin: Approve RD redeem request and process payment"""
    try:
        # Find the request
        redeem_request = await db.bank_redeem_requests.find_one({
            "request_id": request_id,
            "request_type": "rd_redeem"
        })
        
        if not redeem_request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if redeem_request["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Request is already {redeem_request['status']}")
        
        now = datetime.now(timezone.utc)
        user_id = redeem_request["user_id"]
        rd_id = redeem_request["rd_id"]
        net_amount = redeem_request["net_amount"]
        
        # Get the RD
        rd = await db.recurring_deposits.find_one({"rd_id": rd_id})
        if not rd:
            raise HTTPException(status_code=404, detail="RD not found")
        
        # Update RD status
        await db.recurring_deposits.update_one(
            {"rd_id": rd_id},
            {
                "$set": {
                    "status": "redeemed",
                    "redemption_date": now.isoformat(),
                    "redemption_amount": net_amount,
                    "penalty_amount": redeem_request["penalty_amount"],
                    "final_interest_earned": redeem_request["interest_earned"],
                    "is_premature": redeem_request["is_premature"],
                    "redeemed_via_request": True,
                    "redeem_request_id": request_id,
                    "has_pending_redeem": False,
                    "pending_redeem_request_id": None,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Update request status
        await db.bank_redeem_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "approved",
                    "processed_by": admin_id,
                    "processed_at": now.isoformat(),
                    "transaction_ref": transaction_ref,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Create transaction record
        await db.transactions.insert_one({
            "transaction_id": f"RD_REDEEM_{uuid.uuid4().hex[:8].upper()}",
            "user_id": user_id,
            "type": "rd_redeem_approved",
            "amount": net_amount,
            "rd_id": rd_id,
            "request_id": request_id,
            "principal": redeem_request["principal_amount"],
            "interest": redeem_request["interest_earned"],
            "penalty": redeem_request["penalty_amount"],
            "is_premature": redeem_request["is_premature"],
            "transaction_ref": transaction_ref,
            "processed_by": admin_id,
            "created_at": now.isoformat()
        })
        
        # Update user's active RD count
        active_rds = await db.recurring_deposits.count_documents({
            "user_id": user_id,
            "status": "active"
        })
        
        await db.users.update_one(
            {"uid": user_id},
            {
                "$set": {"has_active_rd": active_rds > 0},
                "$inc": {"rd_redemptions": 1}
            }
        )
        
        # Create notification
        await db.notifications.insert_one({
            "user_id": user_id,
            "title": "RD Redeem Approved!",
            "message": f"Your RD redeem request for ₹{net_amount:,.0f} has been approved and will be credited to your bank account.",
            "type": "rd_redeem_approved",
            "related_id": request_id,
            "read": False,
            "created_at": now.isoformat()
        })
        
        return {
            "success": True,
            "message": f"RD redeem request approved. ₹{net_amount:,.0f} to be credited.",
            "request_id": request_id,
            "amount": net_amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error approving RD redeem: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/redeem-requests/{request_id}/reject")
async def admin_reject_rd_redeem(request_id: str, admin_id: str, reason: str = None):
    """Admin: Reject RD redeem request"""
    try:
        # Find the request
        redeem_request = await db.bank_redeem_requests.find_one({
            "request_id": request_id,
            "request_type": "rd_redeem"
        })
        
        if not redeem_request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if redeem_request["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Request is already {redeem_request['status']}")
        
        now = datetime.now(timezone.utc)
        user_id = redeem_request["user_id"]
        rd_id = redeem_request["rd_id"]
        
        # Update request status
        await db.bank_redeem_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "rejected",
                    "rejection_reason": reason,
                    "processed_by": admin_id,
                    "processed_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Clear pending flag on RD
        await db.recurring_deposits.update_one(
            {"rd_id": rd_id},
            {
                "$set": {
                    "has_pending_redeem": False,
                    "pending_redeem_request_id": None,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Create notification
        await db.notifications.insert_one({
            "user_id": user_id,
            "title": "RD Redeem Request Rejected",
            "message": f"Your RD redeem request has been rejected. Reason: {reason or 'Not specified'}",
            "type": "rd_redeem_rejected",
            "related_id": request_id,
            "read": False,
            "created_at": now.isoformat()
        })
        
        return {
            "success": True,
            "message": "RD redeem request rejected",
            "request_id": request_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error rejecting RD redeem: {e}")
        raise HTTPException(status_code=500, detail=str(e))
