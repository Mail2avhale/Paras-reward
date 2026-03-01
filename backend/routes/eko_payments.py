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

def generate_secret_key(timestamp: str):
    """
    Generate secret-key using HMAC-SHA256 as per Eko documentation
    
    Algorithm (from https://developers.eko.in/docs/authentication):
    1. Get current timestamp in milliseconds
    2. Use authenticator key directly (NOT base64 encoded)
    3. Compute HMAC-SHA256 of timestamp using authenticator key
    4. Base64 encode the signature
    """
    if not EKO_AUTHENTICATOR_KEY:
        return None
    
    # Key bytes - use authenticator key directly
    key_bytes = EKO_AUTHENTICATOR_KEY.encode('utf-8')
    
    # HMAC SHA256 of timestamp
    message = timestamp.encode('utf-8')
    signature = hmac.new(key_bytes, message, hashlib.sha256).digest()
    
    # Base64 encode the signature
    return base64.b64encode(signature).decode('utf-8')


def get_secret_key_timestamp():
    """Get current timestamp in milliseconds"""
    return str(int(time.time() * 1000))


def generate_request_hash(timestamp: str, utility_acc_no: str, amount: str, user_code: str):
    """Generate request_hash for BBPS Pay Bill API"""
    if not EKO_AUTHENTICATOR_KEY:
        return None
    # Step 1: Base64 encode the authenticator key
    encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode()).decode()
    # Step 2: Concatenate parameters in specific order
    concatenated_string = timestamp + utility_acc_no + amount + user_code
    # Step 3: HMAC-SHA256 with encoded key
    signature = hmac.new(encoded_key.encode(), concatenated_string.encode(), hashlib.sha256).digest()
    # Step 4: Base64 encode the result
    return base64.b64encode(signature).decode()


async def make_eko_request(endpoint: str, method: str = "GET", data: dict = None, form_data: bool = False):
    """Make authenticated request to Eko API"""
    if not EKO_DEVELOPER_KEY or not EKO_AUTHENTICATOR_KEY:
        raise HTTPException(status_code=500, detail="Eko API credentials not configured")
    
    url = f"{EKO_BASE_URL}{endpoint}"
    
    # Generate authentication headers
    secret_key_timestamp = get_secret_key_timestamp()
    secret_key = generate_secret_key(secret_key_timestamp)
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": secret_key_timestamp,
    }
    
    # Add initiator_id to data if not present
    if data is None:
        data = {}
    data["initiator_id"] = data.get("initiator_id", EKO_INITIATOR_ID)
    
    # Generate request_hash for BBPS Pay Bill API
    if "billpayments/paybill" in endpoint and method == "POST":
        utility_acc_no = data.get("utility_acc_no", "")
        amount = str(data.get("amount", ""))
        user_code = data.get("user_code", EKO_INITIATOR_ID)
        request_hash = generate_request_hash(secret_key_timestamp, utility_acc_no, amount, user_code)
        if request_hash:
            headers["request_hash"] = request_hash
    
    async with httpx.AsyncClient(timeout=60.0, verify=True) as client:
        try:
            logging.info(f"Eko API Request: {method} {url}")
            logging.info(f"Eko Data: {data}")
            
            if method == "GET":
                response = await client.get(url, headers=headers, params=data)
            elif method == "POST":
                # Check if it's DMT endpoint (requires form-urlencoded)
                if "/v1/transactions" in url or "/v1/customers" in url:
                    headers["Content-Type"] = "application/x-www-form-urlencoded"
                    response = await client.post(url, headers=headers, data=data)
                else:
                    # BBPS uses JSON for POST requests
                    headers["Content-Type"] = "application/json"
                    response = await client.post(url, headers=headers, json=data)
            elif method == "PUT":
                headers["Content-Type"] = "application/x-www-form-urlencoded"
                response = await client.put(url, headers=headers, data=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logging.info(f"Eko API Response: {response.status_code} - {response.text[:200]}")
            
            # Try to parse JSON response
            try:
                result = response.json()
            except (ValueError, json.JSONDecodeError):
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


# ==================== DTH PLANS MANAGEMENT ====================

@router.get("/dth/plans/{operator}")
async def get_dth_plans(operator: str):
    """Get DTH plans for an operator - from database or fallback"""
    try:
        # First try database
        if db is not None:
            db_plans = await db.dth_plans.find(
                {"operator": operator.upper(), "is_active": True},
                {"_id": 0}
            ).sort("amount", 1).to_list(100)
            
            if db_plans and len(db_plans) > 0:
                return {"success": True, "plans": db_plans, "source": "database"}
        
        # Fallback to hardcoded DTH plans
        dth_plans = get_real_dth_plans(operator)
        return {"success": True, "plans": dth_plans, "source": "cached"}
        
    except Exception as e:
        logging.warning(f"DTH plans fetch failed: {e}")
        dth_plans = get_real_dth_plans(operator)
        return {"success": True, "plans": dth_plans, "source": "cached"}


def get_real_dth_plans(operator: str):
    """Get real DTH plans - updated periodically"""
    operator_upper = operator.upper()
    
    # Tata Play (Tata Sky) Plans
    tatasky_plans = [
        {"id": "tata_220", "amount": 220, "description": "Hindi Lite HD", "validity": "1 Month", "channels": "200+"},
        {"id": "tata_289", "amount": 289, "description": "Hindi Smart HD", "validity": "1 Month", "channels": "280+"},
        {"id": "tata_349", "amount": 349, "description": "Hindi Value HD", "validity": "1 Month", "channels": "320+"},
        {"id": "tata_449", "amount": 449, "description": "Hindi Premium HD", "validity": "1 Month", "channels": "400+"},
        {"id": "tata_499", "amount": 499, "description": "Super Value Pack", "validity": "1 Month", "channels": "450+"},
        {"id": "tata_599", "amount": 599, "description": "Ultra HD Pack", "validity": "1 Month", "channels": "500+"},
    ]
    
    # Airtel Digital TV Plans
    airtel_dth_plans = [
        {"id": "airdth_195", "amount": 195, "description": "Value Lite HD", "validity": "1 Month", "channels": "180+"},
        {"id": "airdth_260", "amount": 260, "description": "Value Sports HD", "validity": "1 Month", "channels": "220+"},
        {"id": "airdth_325", "amount": 325, "description": "Value Prime HD", "validity": "1 Month", "channels": "280+"},
        {"id": "airdth_410", "amount": 410, "description": "Premium HD", "validity": "1 Month", "channels": "350+"},
        {"id": "airdth_499", "amount": 499, "description": "All Sports HD", "validity": "1 Month", "channels": "400+"},
    ]
    
    # Dish TV Plans
    dishtv_plans = [
        {"id": "dish_216", "amount": 216, "description": "Super Family HD", "validity": "1 Month", "channels": "190+"},
        {"id": "dish_296", "amount": 296, "description": "Diamond HD", "validity": "1 Month", "channels": "270+"},
        {"id": "dish_350", "amount": 350, "description": "Diamond Sports HD", "validity": "1 Month", "channels": "300+"},
        {"id": "dish_449", "amount": 449, "description": "Platinum HD", "validity": "1 Month", "channels": "380+"},
        {"id": "dish_549", "amount": 549, "description": "Titanium HD", "validity": "1 Month", "channels": "450+"},
    ]
    
    # D2H Plans
    d2h_plans = [
        {"id": "d2h_220", "amount": 220, "description": "Gold HD", "validity": "1 Month", "channels": "200+"},
        {"id": "d2h_280", "amount": 280, "description": "Gold Sports HD", "validity": "1 Month", "channels": "250+"},
        {"id": "d2h_350", "amount": 350, "description": "Diamond HD", "validity": "1 Month", "channels": "300+"},
        {"id": "d2h_450", "amount": 450, "description": "Diamond Sports HD", "validity": "1 Month", "channels": "380+"},
        {"id": "d2h_550", "amount": 550, "description": "Platinum HD", "validity": "1 Month", "channels": "450+"},
    ]
    
    # Sun Direct Plans
    sundirect_plans = [
        {"id": "sun_199", "amount": 199, "description": "Bronze HD", "validity": "1 Month", "channels": "150+"},
        {"id": "sun_299", "amount": 299, "description": "Silver HD", "validity": "1 Month", "channels": "220+"},
        {"id": "sun_399", "amount": 399, "description": "Gold HD", "validity": "1 Month", "channels": "300+"},
        {"id": "sun_499", "amount": 499, "description": "Platinum HD", "validity": "1 Month", "channels": "380+"},
    ]
    
    if "TATA" in operator_upper or "SKY" in operator_upper:
        return tatasky_plans
    elif "AIRTEL" in operator_upper:
        return airtel_dth_plans
    elif "DISH" in operator_upper:
        return dishtv_plans
    elif "D2H" in operator_upper or "VIDEOCON" in operator_upper:
        return d2h_plans
    elif "SUN" in operator_upper:
        return sundirect_plans
    else:
        return tatasky_plans  # Default


@router.post("/admin/dth/plans/seed")
async def seed_dth_plans():
    """Admin: Seed database with DTH plans"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    operators = ["TATA_SKY", "AIRTEL_DTH", "DISH_TV", "D2H", "SUN_DIRECT"]
    total_added = 0
    
    for operator in operators:
        plans = get_real_dth_plans(operator)
        for plan in plans:
            plan_doc = {
                "id": plan.get("id"),
                "operator": operator,
                "amount": plan["amount"],
                "description": plan["description"],
                "validity": plan["validity"],
                "channels": plan.get("channels", ""),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.dth_plans.update_one(
                {"operator": operator, "amount": plan["amount"]},
                {"$set": plan_doc},
                upsert=True
            )
            total_added += 1
    
    return {"success": True, "message": f"Seeded {total_added} DTH plans for {len(operators)} operators"}


@router.get("/admin/dth/plans/{operator}")
async def get_admin_dth_plans(operator: str):
    """Admin: Get all DTH plans for an operator"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    plans = await db.dth_plans.find(
        {"operator": operator.upper()},
        {"_id": 0}
    ).sort("amount", 1).to_list(100)
    
    return {"success": True, "operator": operator.upper(), "plans": plans, "count": len(plans)}

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
            "/v2/billpayments/status",
            method="GET",
            data={"client_ref_id": txn_ref}
        )
        return result
    except Exception:
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
    except Exception:
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



# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/status")
async def get_eko_integration_status():
    """Get Eko integration status and configuration"""
    try:
        from services.eko_service import EkoConfig
        
        config_status = EkoConfig.get_config_status()
        
        # Try to get balance if configured
        balance_info = {"balance": 0, "error": None}
        if config_status["configured"]:
            try:
                from services.eko_service import EkoService
                service = EkoService(db)
                balance_response = await service.check_wallet_balance()
                if balance_response.success:
                    balance_info = {
                        "balance": balance_response.data.get("balance", 0),
                        "currency": "INR"
                    }
                else:
                    balance_info["error"] = balance_response.message
            except Exception as e:
                balance_info["error"] = str(e)
        
        return {
            "success": True,
            "configuration": config_status,
            "wallet": balance_info,
            "status": "operational" if config_status["configured"] else "not_configured"
        }
    except ImportError:
        return {
            "success": False,
            "configuration": {"configured": False},
            "wallet": {"balance": 0},
            "status": "service_unavailable"
        }


@router.get("/admin/transaction/{transaction_id}")
async def get_transaction_status_admin(transaction_id: str, use_client_ref: bool = False):
    """
    Admin endpoint to check transaction status from Eko
    
    Args:
        transaction_id: Eko TID or client reference ID
        use_client_ref: If true, treat transaction_id as client reference
    """
    try:
        from services.eko_service import EkoService
        
        service = EkoService(db)
        response = await service.check_transaction_status(transaction_id, use_client_ref)
        
        return {
            "success": response.success,
            "transaction_id": transaction_id,
            "eko_tid": response.eko_tid,
            "tx_status": response.tx_status.value if response.tx_status else None,
            "tx_status_desc": response.tx_status.description if response.tx_status else None,
            "utr_number": response.utr_number,
            "message": response.message,
            "data": response.data
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="Eko service not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/sync-pending")
async def sync_pending_eko_transactions():
    """
    Manually trigger sync of all pending Eko transactions
    Updates status from Eko API for transactions in pending/processing state
    """
    try:
        from services.eko_service import EkoService, EkoStatusUpdater
        
        service = EkoService(db)
        updater = EkoStatusUpdater(db, service)
        
        # Sync bank withdrawal requests
        bank_result = await updater.update_pending_transactions("bank_withdrawal_requests")
        
        # Sync bill payment requests
        bill_result = await updater.update_pending_transactions("bill_payment_requests")
        
        return {
            "success": True,
            "results": {
                "bank_withdrawals": bank_result,
                "bill_payments": bill_result
            },
            "total_updated": bank_result.get("updated", 0) + bill_result.get("updated", 0),
            "total_checked": bank_result.get("checked", 0) + bill_result.get("checked", 0)
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="Eko service not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/verify-account")
async def verify_bank_account_admin(request: Request):
    """
    Admin endpoint to verify bank account details
    
    Request body:
    {
        "ifsc": "HDFC0001234",
        "account_number": "1234567890"
    }
    """
    try:
        from services.eko_service import EkoService
        
        data = await request.json()
        ifsc = data.get("ifsc")
        account_number = data.get("account_number")
        
        if not ifsc or not account_number:
            raise HTTPException(status_code=400, detail="IFSC and account number required")
        
        service = EkoService(db)
        response = await service.verify_bank_account(ifsc, account_number)
        
        return {
            "success": response.success,
            "verified": response.success,
            "account_holder": response.data.get("account_holder") if response.data else None,
            "message": response.message
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="Eko service not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/logs")
async def get_eko_transaction_logs(
    page: int = 1,
    limit: int = 50,
    status: str = None
):
    """
    Get Eko transaction logs for admin monitoring
    """
    try:
        query = {}
        if status:
            query["success"] = status.lower() == "success"
        
        skip = (page - 1) * limit
        
        logs = await db.eko_transaction_logs.find(
            query, {"_id": 0}
        ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
        
        total = await db.eko_transaction_logs.count_documents(query)
        
        return {
            "success": True,
            "logs": logs,
            "total": total,
            "page": page,
            "total_pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STATUS CODES REFERENCE ====================
@router.get("/status-codes")
async def get_eko_status_codes():
    """Get reference for Eko transaction status codes"""
    return {
        "transaction_status": {
            "0": "Success - Transaction completed successfully",
            "1": "Failed - Transaction failed",
            "2": "Initiated/Response Awaited - NEFT pending or awaiting bank response",
            "3": "Refund Pending - Transaction failed, refund in process",
            "4": "Refunded - Amount has been refunded",
            "5": "Hold - Transaction on hold, inquiry required"
        },
        "error_codes": {
            "44": "Customer not found",
            "45": "Recipient not found",
            "131": "Invalid OTP",
            "302": "Insufficient balance",
            "303": "Daily limit exceeded",
            "304": "Monthly limit exceeded",
            "305": "Invalid amount",
            "306": "Invalid IFSC",
            "307": "Invalid account number",
            "308": "Account verification failed",
            "309": "Transfer failed - bank error",
            "310": "Transfer timeout",
            "311": "Duplicate transaction",
            "312": "Invalid recipient",
            "403": "Access denied - IP not whitelisted",
            "500": "Internal server error",
            "503": "Service temporarily unavailable"
        },
        "channels": {
            "1": "NEFT - National Electronic Funds Transfer (batch, slower)",
            "2": "IMPS - Immediate Payment Service (instant)"
        }
    }
