"""
Eko.in API Integration - LIVE
- BBPS Bill Payments (Electricity, Gas, Water, Mobile, DTH, etc.)
- DMT (Domestic Money Transfer)

Documentation: https://developers.eko.in
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
import hashlib
import hmac
import base64
import json
import time
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/eko", tags=["Eko Bill Payment & DMT"])

# Eko API Configuration - LIVE
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID")
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ==================== HELPER FUNCTIONS ====================

def generate_secret_key():
    """Generate secret-key from authenticator key (base64 encoded)"""
    if not EKO_AUTHENTICATOR_KEY:
        return None
    return base64.b64encode(EKO_AUTHENTICATOR_KEY.encode()).decode()


def get_secret_key_timestamp():
    """Get current timestamp in milliseconds"""
    return str(int(time.time() * 1000))


async def make_eko_request(endpoint: str, method: str = "GET", data: dict = None, form_data: bool = False):
    """Make authenticated request to Eko API"""
    if not EKO_DEVELOPER_KEY or not EKO_AUTHENTICATOR_KEY:
        raise HTTPException(status_code=500, detail="Eko API credentials not configured")
    
    url = f"{EKO_BASE_URL}{endpoint}"
    
    # Generate authentication headers
    secret_key = generate_secret_key()
    secret_key_timestamp = get_secret_key_timestamp()
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": secret_key_timestamp,
    }
    
    # Add initiator_id to data if not present
    if data is None:
        data = {}
    data["initiator_id"] = data.get("initiator_id", EKO_INITIATOR_ID)
    
    async with httpx.AsyncClient(timeout=60.0, verify=True) as client:
        try:
            logging.info(f"Eko API Request: {method} {url}")
            logging.info(f"Eko Data: {data}")
            
            if method == "GET":
                response = await client.get(url, headers=headers, params=data)
            elif method == "POST":
                # Eko uses form data for POST requests
                headers["Content-Type"] = "application/x-www-form-urlencoded"
                response = await client.post(url, headers=headers, data=data)
            elif method == "PUT":
                headers["Content-Type"] = "application/x-www-form-urlencoded"
                response = await client.put(url, headers=headers, data=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logging.info(f"Eko API Response: {response.status_code} - {response.text[:200]}")
            
            # Try to parse JSON response
            try:
                result = response.json()
            except:
                result = {"raw_response": response.text}
            
            # Check for Eko error responses
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=result.get("message", result.get("error", str(result)))
                )
            
            return result
            
        except httpx.HTTPStatusError as e:
            logging.error(f"Eko API HTTPStatusError: {e.response.text}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Eko API error: {e.response.text}"
            )
        except httpx.RequestError as e:
            logging.error(f"Eko API RequestError: {type(e).__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Connection error: {type(e).__name__}: {str(e)}")
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Eko request failed: {type(e).__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Request failed: {type(e).__name__}: {str(e)}")


# ==================== PYDANTIC MODELS ====================

class BillFetchRequest(BaseModel):
    category: str  # electricity, water, gas, mobile_postpaid, dth, broadband, etc.
    biller_id: str
    customer_params: dict  # {param_name: value} e.g., {"ca_number": "123456789"}


class BillPayRequest(BaseModel):
    user_id: str
    category: str
    biller_id: str
    customer_params: dict
    amount: float
    bill_fetch_ref: Optional[str] = None


class DMTRecipientRequest(BaseModel):
    customer_mobile: str
    recipient_name: str
    recipient_mobile: str
    bank_ifsc: str
    account_number: str


class DMTTransferRequest(BaseModel):
    user_id: str
    customer_mobile: str
    recipient_id: str
    amount: float
    otp: Optional[str] = None


# ==================== BBPS BILL PAYMENT APIs ====================

@router.get("/config")
async def get_eko_config():
    """Get Eko configuration status"""
    return {
        "configured": bool(EKO_DEVELOPER_KEY and EKO_AUTHENTICATOR_KEY),
        "base_url": EKO_BASE_URL,
        "initiator_id": EKO_INITIATOR_ID,
        "environment": "sandbox" if "staging" in EKO_BASE_URL else "production"
    }


@router.get("/balance")
async def get_eko_balance():
    """Get Eko settlement account balance"""
    try:
        result = await make_eko_request(
            f"/v1/customers/mobile_number:{EKO_INITIATOR_ID}/balance",
            method="GET"
        )
        return {
            "success": True,
            "balance": result.get("data", {}).get("balance", "0.0"),
            "currency": result.get("data", {}).get("currency", "INR"),
            "message": result.get("message")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/bbps/categories")
async def get_bill_categories():
    """Get available bill payment categories"""
    # Static list - can be fetched from Eko API
    categories = [
        {"id": "electricity", "name": "Electricity", "icon": "⚡"},
        {"id": "water", "name": "Water", "icon": "💧"},
        {"id": "gas", "name": "Gas/LPG", "icon": "🔥"},
        {"id": "mobile_postpaid", "name": "Mobile Postpaid", "icon": "📱"},
        {"id": "landline", "name": "Landline", "icon": "☎️"},
        {"id": "broadband", "name": "Broadband", "icon": "🌐"},
        {"id": "dth", "name": "DTH", "icon": "📺"},
        {"id": "fastag", "name": "FASTag", "icon": "🚗"},
        {"id": "insurance", "name": "Insurance", "icon": "🛡️"},
        {"id": "loan_emi", "name": "Loan EMI", "icon": "💰"},
        {"id": "credit_card", "name": "Credit Card", "icon": "💳"},
        {"id": "education", "name": "Education Fees", "icon": "🎓"},
        {"id": "municipal_tax", "name": "Municipal Tax", "icon": "🏛️"},
    ]
    return {"categories": categories}


@router.get("/bbps/billers/{category}")
async def get_billers_by_category(category: str):
    """Get list of billers for a category"""
    try:
        # Eko API endpoint for billers
        # Base URL already contains /ekoicici, so just add the remaining path
        result = await make_eko_request(
            "/v2/billpayments/operators",
            method="GET",
            data={"category": category}
        )
        return result
    except Exception as e:
        logging.warning(f"Eko billers API failed: {e}")
        # Return sample billers if API fails
        sample_billers = {
            "electricity": [
                {"id": "MSEB", "name": "Maharashtra State Electricity Board"},
                {"id": "TATA_POWER", "name": "Tata Power"},
                {"id": "ADANI", "name": "Adani Electricity"},
            ],
            "mobile_postpaid": [
                {"id": "JIO", "name": "Jio Postpaid"},
                {"id": "AIRTEL", "name": "Airtel Postpaid"},
                {"id": "VI", "name": "Vi Postpaid"},
            ]
        }
        return {"billers": sample_billers.get(category, []), "note": f"Sample data - {str(e)}"}


# ==================== MOBILE RECHARGE APIs ====================

@router.get("/recharge/operators")
async def get_mobile_operators():
    """Get list of mobile operators for prepaid recharge"""
    try:
        result = await make_eko_request(
            "/v1/operators",
            method="GET",
            data={"service_type": "1"}  # 1 = Mobile prepaid
        )
        
        # Parse Eko response format
        operators = []
        if result.get("data"):
            for op in result.get("data", []):
                operators.append({
                    "id": op.get("operator_id"),
                    "name": op.get("operator_name"),
                    "code": op.get("operator_code"),
                    "icon": "📱"
                })
        
        return {"success": True, "operators": operators}
        
    except Exception as e:
        logging.warning(f"Eko operators API failed: {e}")
        # Fallback static operators
        static_operators = [
            {"id": "JIO", "name": "Jio", "code": "JIO", "icon": "📱"},
            {"id": "AIRTEL", "name": "Airtel", "code": "AIRTEL", "icon": "📱"},
            {"id": "VI", "name": "Vi (Vodafone Idea)", "code": "VI", "icon": "📱"},
            {"id": "BSNL", "name": "BSNL", "code": "BSNL", "icon": "📱"}
        ]
        return {"success": True, "operators": static_operators, "source": "fallback"}


@router.get("/recharge/circles")
async def get_recharge_circles():
    """Get list of telecom circles"""
    try:
        result = await make_eko_request(
            "/v1/circles",
            method="GET"
        )
        
        circles = []
        if result.get("data"):
            for c in result.get("data", []):
                circles.append({
                    "id": c.get("circle_id"),
                    "name": c.get("circle_name")
                })
        
        return {"success": True, "circles": circles}
        
    except Exception as e:
        logging.warning(f"Eko circles API failed: {e}")
        # Fallback static circles
        static_circles = [
            {"id": "MH", "name": "Maharashtra"},
            {"id": "MUM", "name": "Mumbai"},
            {"id": "DL", "name": "Delhi"},
            {"id": "KA", "name": "Karnataka"},
            {"id": "TN", "name": "Tamil Nadu"},
            {"id": "UP_E", "name": "UP East"},
            {"id": "UP_W", "name": "UP West"},
            {"id": "GJ", "name": "Gujarat"},
            {"id": "RJ", "name": "Rajasthan"},
            {"id": "AP", "name": "Andhra Pradesh"},
            {"id": "WB", "name": "West Bengal"},
            {"id": "KL", "name": "Kerala"},
            {"id": "PB", "name": "Punjab"},
            {"id": "HR", "name": "Haryana"},
            {"id": "MP", "name": "Madhya Pradesh"},
            {"id": "BH", "name": "Bihar"},
            {"id": "OR", "name": "Orissa"},
            {"id": "AS", "name": "Assam"},
            {"id": "NE", "name": "North East"},
            {"id": "HP", "name": "Himachal Pradesh"},
            {"id": "JK", "name": "Jammu & Kashmir"},
            {"id": "CHN", "name": "Chennai"},
            {"id": "KOL", "name": "Kolkata"}
        ]
        return {"success": True, "circles": static_circles, "source": "fallback"}


@router.get("/recharge/plans/{operator}/{circle}")
async def get_recharge_plans(operator: str, circle: str):
    """Get available recharge plans for an operator and circle - from database or fallback"""
    try:
        # First try to get plans from database (admin managed)
        if db is not None:
            db_plans = await db.recharge_plans.find(
                {"operator": operator.upper(), "is_active": True},
                {"_id": 0}
            ).sort("amount", 1).to_list(100)
            
            if db_plans and len(db_plans) > 0:
                return {"success": True, "plans": db_plans, "source": "database"}
        
        # Fallback to Eko API
        result = await make_eko_request(
            "/v1/recharge/plans",
            method="GET",
            data={
                "operator_id": operator,
                "circle_id": circle
            }
        )
        
        plans = []
        if result.get("data"):
            for p in result.get("data", []):
                plans.append({
                    "id": p.get("plan_id"),
                    "amount": p.get("amount"),
                    "description": p.get("description", p.get("talktime", "")),
                    "validity": p.get("validity"),
                    "plan_type": p.get("plan_type", ""),
                    "data": p.get("data", ""),
                    "talktime": p.get("talktime", "")
                })
        
        return {"success": True, "plans": plans}
        
    except Exception as e:
        logging.warning(f"Eko plans API failed: {e}")
        # Return REAL operator plans from hardcoded fallback
        real_plans = get_real_operator_plans(operator)
        return {"success": True, "plans": real_plans, "source": "cached"}


# ==================== ADMIN PLAN MANAGEMENT APIs ====================

class RechargePlanModel(BaseModel):
    operator: str
    amount: int
    description: str
    validity: str
    plan_type: str = "Data"
    data: Optional[str] = ""
    talktime: Optional[str] = ""
    is_active: bool = True


@router.post("/admin/plans/add")
async def add_recharge_plan(plan: RechargePlanModel):
    """Admin: Add a new recharge plan"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    plan_doc = {
        "id": f"{plan.operator.lower()}_{plan.amount}",
        "operator": plan.operator.upper(),
        "amount": plan.amount,
        "description": plan.description,
        "validity": plan.validity,
        "plan_type": plan.plan_type,
        "data": plan.data,
        "talktime": plan.talktime,
        "is_active": plan.is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - update if exists, insert if new
    await db.recharge_plans.update_one(
        {"operator": plan.operator.upper(), "amount": plan.amount},
        {"$set": plan_doc},
        upsert=True
    )
    
    return {"success": True, "message": f"Plan ₹{plan.amount} added for {plan.operator}"}


@router.get("/admin/plans/{operator}")
async def get_admin_plans(operator: str):
    """Admin: Get all plans for an operator"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    plans = await db.recharge_plans.find(
        {"operator": operator.upper()},
        {"_id": 0}
    ).sort("amount", 1).to_list(100)
    
    return {"success": True, "operator": operator.upper(), "plans": plans, "count": len(plans)}


@router.delete("/admin/plans/{operator}/{amount}")
async def delete_recharge_plan(operator: str, amount: int):
    """Admin: Delete a recharge plan"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    result = await db.recharge_plans.delete_one(
        {"operator": operator.upper(), "amount": amount}
    )
    
    if result.deleted_count > 0:
        return {"success": True, "message": f"Plan ₹{amount} deleted for {operator}"}
    else:
        raise HTTPException(status_code=404, detail="Plan not found")


@router.post("/admin/plans/seed")
async def seed_default_plans():
    """Admin: Seed database with default plans for all operators"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    operators = ["JIO", "AIRTEL", "VI", "BSNL"]
    total_added = 0
    
    for operator in operators:
        plans = get_real_operator_plans(operator)
        for plan in plans:
            plan_doc = {
                "id": plan.get("id", f"{operator.lower()}_{plan['amount']}"),
                "operator": operator,
                "amount": plan["amount"],
                "description": plan["description"],
                "validity": plan["validity"],
                "plan_type": plan.get("plan_type", "Data"),
                "data": plan.get("data", ""),
                "talktime": plan.get("talktime", ""),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.recharge_plans.update_one(
                {"operator": operator, "amount": plan["amount"]},
                {"$set": plan_doc},
                upsert=True
            )
            total_added += 1
    
    return {"success": True, "message": f"Seeded {total_added} plans for {len(operators)} operators"}


@router.put("/admin/plans/toggle/{operator}/{amount}")
async def toggle_plan_status(operator: str, amount: int):
    """Admin: Toggle plan active/inactive status"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    plan = await db.recharge_plans.find_one(
        {"operator": operator.upper(), "amount": amount}
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    new_status = not plan.get("is_active", True)
    
    await db.recharge_plans.update_one(
        {"operator": operator.upper(), "amount": amount},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": f"Plan ₹{amount} is now {'active' if new_status else 'inactive'}"}

# ==================== END ADMIN PLAN MANAGEMENT ====================


def get_real_operator_plans(operator: str):
    """Get real operator plans - updated periodically"""
    operator_upper = operator.upper()
    
    # JIO Plans (Updated Dec 2025)
    jio_plans = [
        {"id": "jio_149", "amount": 149, "description": "Unlimited calls + 1GB/day + 100 SMS/day", "validity": "14 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "jio_199", "amount": 199, "description": "Unlimited calls + 1.5GB/day + 100 SMS/day", "validity": "14 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "jio_249", "amount": 249, "description": "Unlimited calls + 1.5GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "jio_299", "amount": 299, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_349", "amount": 349, "description": "Unlimited calls + 2GB/day + 100 SMS/day + JioTV", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_449", "amount": 449, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "56 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_479", "amount": 479, "description": "Unlimited calls + 1.5GB/day + Disney+ Hotstar", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "jio_599", "amount": 599, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "84 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_666", "amount": 666, "description": "Unlimited calls + 1.5GB/day", "validity": "84 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "jio_899", "amount": 899, "description": "Unlimited calls + 2GB/day + Netflix", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "jio_2999", "amount": 2999, "description": "Unlimited calls + 2.5GB/day", "validity": "365 days", "plan_type": "Data", "data": "2.5GB/day"},
        {"id": "jio_19", "amount": 19, "description": "Data Pack - 1GB", "validity": "1 day", "plan_type": "Data Add-on", "data": "1GB"},
        {"id": "jio_51", "amount": 51, "description": "Data Pack - 6GB", "validity": "28 days", "plan_type": "Data Add-on", "data": "6GB"},
    ]
    
    # AIRTEL Plans (Updated Dec 2025)
    airtel_plans = [
        {"id": "air_179", "amount": 179, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_265", "amount": 265, "description": "Unlimited calls + 1GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "air_299", "amount": 299, "description": "Unlimited calls + 1.5GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "air_349", "amount": 349, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_455", "amount": 455, "description": "Unlimited calls + 1GB/day", "validity": "84 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "air_479", "amount": 479, "description": "Unlimited calls + 1.5GB/day + Disney+ Hotstar", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "air_549", "amount": 549, "description": "Unlimited calls + 2GB/day", "validity": "56 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_666", "amount": 666, "description": "Unlimited calls + 1.5GB/day", "validity": "77 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "air_719", "amount": 719, "description": "Unlimited calls + 1.5GB/day", "validity": "84 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "air_839", "amount": 839, "description": "Unlimited calls + 2GB/day", "validity": "84 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_2999", "amount": 2999, "description": "Unlimited calls + 2GB/day", "validity": "365 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "air_19", "amount": 19, "description": "Talktime ₹14.95", "validity": "NA", "plan_type": "Talktime", "talktime": "₹14.95"},
    ]
    
    # VI (Vodafone Idea) Plans (Updated Dec 2025)
    vi_plans = [
        {"id": "vi_179", "amount": 179, "description": "Unlimited calls + 2GB total", "validity": "28 days", "plan_type": "Data", "data": "2GB total"},
        {"id": "vi_269", "amount": 269, "description": "Unlimited calls + 1GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "vi_299", "amount": 299, "description": "Unlimited calls + 1.5GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "vi_349", "amount": 349, "description": "Unlimited calls + 2GB/day + 100 SMS/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "vi_479", "amount": 479, "description": "Unlimited calls + 1.5GB/day + Disney+ Hotstar", "validity": "28 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "vi_539", "amount": 539, "description": "Unlimited calls + 1GB/day", "validity": "84 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "vi_719", "amount": 719, "description": "Unlimited calls + 1.5GB/day", "validity": "84 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "vi_839", "amount": 839, "description": "Unlimited calls + 2GB/day", "validity": "84 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "vi_2899", "amount": 2899, "description": "Unlimited calls + 1.5GB/day", "validity": "365 days", "plan_type": "Data", "data": "1.5GB/day"},
    ]
    
    # BSNL Plans (Updated Dec 2025)
    bsnl_plans = [
        {"id": "bsnl_107", "amount": 107, "description": "Unlimited calls + 1GB/day", "validity": "21 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "bsnl_187", "amount": 187, "description": "Unlimited calls + 2GB/day", "validity": "28 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "bsnl_247", "amount": 247, "description": "Unlimited calls + 1GB/day", "validity": "30 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "bsnl_397", "amount": 397, "description": "Unlimited calls + 2GB/day", "validity": "60 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "bsnl_447", "amount": 447, "description": "Unlimited calls + 1GB/day", "validity": "60 days", "plan_type": "Data", "data": "1GB/day"},
        {"id": "bsnl_485", "amount": 485, "description": "Unlimited calls + 1.5GB/day", "validity": "90 days", "plan_type": "Data", "data": "1.5GB/day"},
        {"id": "bsnl_997", "amount": 997, "description": "Unlimited calls + 2GB/day", "validity": "180 days", "plan_type": "Data", "data": "2GB/day"},
        {"id": "bsnl_1999", "amount": 1999, "description": "Unlimited calls + 2GB/day", "validity": "365 days", "plan_type": "Data", "data": "2GB/day"},
    ]
    
    # Return based on operator
    if "JIO" in operator_upper:
        return jio_plans
    elif "AIRTEL" in operator_upper:
        return airtel_plans
    elif "VI" in operator_upper or "VODAFONE" in operator_upper or "IDEA" in operator_upper:
        return vi_plans
    elif "BSNL" in operator_upper:
        return bsnl_plans
    else:
        # Generic fallback
        return jio_plans  # Default to Jio plans


@router.post("/recharge/process")
async def process_mobile_recharge(
    mobile_number: str,
    operator_id: str,
    amount: float,
    circle_id: str = None,
    user_id: str = None
):
    """Process mobile prepaid recharge via Eko"""
    try:
        txn_ref = f"RCH{datetime.now().strftime('%Y%m%d%H%M%S')}{mobile_number[-4:]}"
        
        result = await make_eko_request(
            "/v1/recharge",
            method="POST",
            data={
                "mobile_number": mobile_number,
                "operator_id": operator_id,
                "amount": str(int(amount)),
                "circle_id": circle_id or "",
                "client_ref_id": txn_ref,
                "confirmation_mobile_no": EKO_INITIATOR_ID
            }
        )
        
        # Log transaction
        if db is not None:
            await db.eko_transactions.insert_one({
                "type": "mobile_recharge",
                "user_id": user_id,
                "mobile_number": mobile_number,
                "operator_id": operator_id,
                "amount": amount,
                "circle_id": circle_id,
                "txn_ref": txn_ref,
                "eko_response": result,
                "status": result.get("status", "pending"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        return {
            "success": True,
            "txn_ref": txn_ref,
            "eko_txn_id": result.get("tid"),
            "status": result.get("status"),
            "message": result.get("message", "Recharge initiated")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Mobile recharge failed: {e}")
        raise HTTPException(status_code=500, detail=f"Recharge failed: {str(e)}")


@router.get("/dth/operators")
async def get_dth_operators():
    """Get list of DTH operators"""
    try:
        result = await make_eko_request(
            "/v1/operators",
            method="GET",
            data={"service_type": "2"}  # 2 = DTH
        )
        
        operators = []
        if result.get("data"):
            for op in result.get("data", []):
                operators.append({
                    "id": op.get("operator_id"),
                    "name": op.get("operator_name"),
                    "code": op.get("operator_code"),
                    "icon": "📺"
                })
        
        return {"success": True, "operators": operators}
        
    except Exception as e:
        logging.warning(f"Eko DTH operators API failed: {e}")
        static_operators = [
            {"id": "TATA_SKY", "name": "Tata Play (Tata Sky)", "code": "TATASKY", "icon": "📺"},
            {"id": "AIRTEL_DTH", "name": "Airtel Digital TV", "code": "AIRTEL", "icon": "📺"},
            {"id": "DISH_TV", "name": "Dish TV", "code": "DISHTV", "icon": "📺"},
            {"id": "D2H", "name": "D2H Videocon", "code": "D2H", "icon": "📺"},
            {"id": "SUN_DIRECT", "name": "Sun Direct", "code": "SUNDIRECT", "icon": "📺"}
        ]
        return {"success": True, "operators": static_operators, "source": "fallback"}


@router.post("/bbps/fetch-bill")
async def fetch_bill(request: BillFetchRequest):
    """Fetch bill details before payment"""
    try:
        # Eko API call to fetch bill
        result = await make_eko_request(
            "/v2/billpayments/fetchbill",
            method="POST",
            data={
                "utility_acc_no": list(request.customer_params.values())[0],
                "operator_id": request.biller_id,
                "confirmation_mobile_no": EKO_INITIATOR_ID
            }
        )
        
        # Log the fetch
        if db is not None:
            await db.bill_fetch_logs.insert_one({
                "category": request.category,
                "biller_id": request.biller_id,
                "customer_params": request.customer_params,
                "response": result,
                "timestamp": datetime.now(timezone.utc)
            })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Bill fetch failed: {e}")
        raise HTTPException(status_code=500, detail=f"Bill fetch failed: {str(e)}")


@router.post("/bbps/pay-bill")
async def pay_bill(request: BillPayRequest):
    """Pay a bill through BBPS"""
    try:
        # Create unique transaction reference
        txn_ref = f"PARAS{datetime.now().strftime('%Y%m%d%H%M%S')}{request.user_id[-6:]}"
        
        # Eko API call to pay bill
        result = await make_eko_request(
            "/v2/billpayments/paybill",
            method="POST",
            data={
                "utility_acc_no": list(request.customer_params.values())[0],
                "operator_id": request.biller_id,
                "amount": str(int(request.amount)),
                "confirmation_mobile_no": EKO_INITIATOR_ID,
                "client_ref_id": txn_ref,
                "latlong": "19.0760,72.8777",  # Mumbai coordinates
                "source_ip": "34.170.12.145"  # Will be updated
            }
        )
        
        # Log transaction
        if db is not None:
            await db.eko_transactions.insert_one({
                "type": "bill_payment",
                "user_id": request.user_id,
                "category": request.category,
                "biller_id": request.biller_id,
                "customer_params": request.customer_params,
                "amount": request.amount,
                "txn_ref": txn_ref,
                "eko_response": result,
                "status": result.get("status", "pending"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        return {
            "success": True,
            "txn_ref": txn_ref,
            "eko_txn_id": result.get("tid"),
            "status": result.get("status"),
            "message": result.get("message", "Bill payment initiated")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Bill payment failed: {e}")
        raise HTTPException(status_code=500, detail=f"Bill payment failed: {str(e)}")


@router.get("/bbps/transaction-status/{txn_ref}")
async def get_bill_transaction_status(txn_ref: str):
    """Get status of a bill payment transaction"""
    try:
        result = await make_eko_request(
            f"/v2/billpayments/status",
            method="GET",
            data={"client_ref_id": txn_ref}
        )
        return result
    except Exception as e:
        # Check local database
        if db is not None:
            txn = await db.eko_transactions.find_one(
                {"txn_ref": txn_ref},
                {"_id": 0}
            )
            if txn:
                return {"transaction": txn, "source": "local_db"}
        raise HTTPException(status_code=404, detail="Transaction not found")


# ==================== DMT (Money Transfer) APIs ====================

@router.post("/dmt/register-sender")
async def register_dmt_sender(mobile: str, name: str):
    """Register a sender for DMT"""
    try:
        result = await make_eko_request(
            "/v2/customers",
            method="POST",
            data={
                "mobile": mobile,
                "name": name
            }
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sender registration failed: {str(e)}")


@router.get("/dmt/sender/{mobile}")
async def get_sender_details(mobile: str):
    """Get sender details and KYC status"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{mobile}",
            method="GET"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Sender not found: {str(e)}")


@router.post("/dmt/add-recipient")
async def add_dmt_recipient(request: DMTRecipientRequest):
    """Add a bank account recipient for DMT"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{request.customer_mobile}/recipients",
            method="POST",
            data={
                "recipient_name": request.recipient_name,
                "recipient_mobile": request.recipient_mobile,
                "bank_ifsc": request.bank_ifsc,
                "account": request.account_number
            }
        )
        
        # Log recipient addition
        if db is not None:
            await db.dmt_recipients.insert_one({
                "customer_mobile": request.customer_mobile,
                "recipient_name": request.recipient_name,
                "bank_ifsc": request.bank_ifsc,
                "account_last4": request.account_number[-4:],
                "eko_recipient_id": result.get("recipient_id"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recipient addition failed: {str(e)}")


@router.get("/dmt/recipients/{mobile}")
async def get_dmt_recipients(mobile: str):
    """Get list of recipients for a sender"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{mobile}/recipients",
            method="GET"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Recipients not found: {str(e)}")


@router.post("/dmt/verify-account")
async def verify_bank_account(ifsc: str, account_number: str):
    """Verify bank account before transfer"""
    try:
        result = await make_eko_request(
            "/v2/banks/ifsc/accounts/verify",
            method="POST",
            data={
                "ifsc": ifsc,
                "account": account_number
            }
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Account verification failed: {str(e)}")


@router.post("/dmt/send-otp")
async def send_dmt_otp(mobile: str, amount: float):
    """Send OTP for DMT transaction"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{mobile}/otp",
            method="POST",
            data={"amount": str(int(amount))}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OTP sending failed: {str(e)}")


@router.post("/dmt/transfer")
async def initiate_dmt_transfer(request: DMTTransferRequest):
    """Initiate money transfer to bank account"""
    try:
        # Create unique transaction reference
        txn_ref = f"DMT{datetime.now().strftime('%Y%m%d%H%M%S')}{request.user_id[-6:]}"
        
        result = await make_eko_request(
            f"/v2/customers/{request.customer_mobile}/transfer",
            method="POST",
            data={
                "recipient_id": request.recipient_id,
                "amount": str(int(request.amount)),
                "otp": request.otp,
                "client_ref_id": txn_ref,
                "latlong": "19.0760,72.8777",
                "source_ip": "34.170.12.145"
            }
        )
        
        # Log transaction
        if db is not None:
            await db.eko_transactions.insert_one({
                "type": "dmt_transfer",
                "user_id": request.user_id,
                "customer_mobile": request.customer_mobile,
                "recipient_id": request.recipient_id,
                "amount": request.amount,
                "txn_ref": txn_ref,
                "eko_response": result,
                "status": result.get("status", "pending"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        return {
            "success": True,
            "txn_ref": txn_ref,
            "eko_txn_id": result.get("tid"),
            "status": result.get("status"),
            "message": result.get("message", "Transfer initiated")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"DMT transfer failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")


@router.get("/dmt/transaction-status/{txn_ref}")
async def get_dmt_transaction_status(txn_ref: str):
    """Get status of a DMT transaction"""
    try:
        result = await make_eko_request(
            "/v2/transactions/status",
            method="GET",
            data={"client_ref_id": txn_ref}
        )
        return result
    except Exception as e:
        # Check local database
        if db is not None:
            txn = await db.eko_transactions.find_one(
                {"txn_ref": txn_ref},
                {"_id": 0}
            )
            if txn:
                return {"transaction": txn, "source": "local_db"}
        raise HTTPException(status_code=404, detail="Transaction not found")


# ==================== TRANSACTION HISTORY ====================

@router.get("/transactions/{user_id}")
async def get_user_eko_transactions(user_id: str, limit: int = 50):
    """Get user's Eko transaction history"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    transactions = await db.eko_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(None)
    
    return {"transactions": transactions}


# ==================== WEBHOOK ====================

@router.post("/webhook")
async def eko_webhook(request: Request):
    """Handle Eko transaction status callbacks"""
    try:
        payload = await request.json()
        
        txn_ref = payload.get("client_ref_id")
        status = payload.get("status")
        eko_txn_id = payload.get("tid")
        
        logging.info(f"Eko webhook: {txn_ref} - {status}")
        
        # Update transaction status
        if db is not None and txn_ref:
            await db.eko_transactions.update_one(
                {"txn_ref": txn_ref},
                {
                    "$set": {
                        "status": status,
                        "eko_txn_id": eko_txn_id,
                        "webhook_data": payload,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
        
        return {"status": "ok"}
        
    except Exception as e:
        logging.error(f"Eko webhook error: {e}")
        return {"status": "error", "message": str(e)}
