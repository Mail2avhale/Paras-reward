from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext

# Import models
from models import (
    User, UserProfileUpdate, Stockist, Product, Cart, CartItem, Order, OrderItem,
    WithdrawalRequest, CommissionEntry, SupportTicket, TicketResponse, SystemSettings
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app
app = FastAPI(title="PARAS REWARD API V2", version="2.0.0")
api_router = APIRouter(prefix="/api/v2")

# ========== HELPER FUNCTIONS ==========
async def get_base_rate():
    """Calculate dynamic base rate"""
    settings = await db.settings.find_one({}) or {}
    base_rate_start = settings.get("mining_base_rate", 50)
    decrease_per = settings.get("mining_decrease_per_users", 100)
    min_rate = settings.get("mining_base_rate_min", 10)
    
    total_users = await db.users.count_documents({})
    base_rate = base_rate_start - (total_users // decrease_per)
    return max(base_rate, min_rate)

async def get_active_referrals(uid: str):
    """Count active referrals (logged in within 24 hours)"""
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    active_count = await db.users.count_documents({
        "referred_by": uid,
        "last_login": {"$gte": yesterday.isoformat()},
        "is_active": True
    })
    settings = await db.settings.find_one({}) or {}
    max_refs = settings.get("max_referrals", 200)
    return min(active_count, max_refs)

async def calculate_mining_rate(uid: str):
    """Calculate mining rate per minute with referral bonus"""
    base_rate = await get_base_rate()
    active_referrals = await get_active_referrals(uid)
    current_date = datetime.now(timezone.utc).day
    
    settings = await db.settings.find_one({}) or {}
    referral_bonus_pct = settings.get("referral_bonus_percentage", 0.10)
    
    # Referral contribution
    referral_bonus = active_referrals * referral_bonus_pct * base_rate * current_date
    
    # Total daily rate
    total_daily_rate = (current_date * base_rate) + referral_bonus
    
    # Per minute rate
    per_minute_rate = total_daily_rate / 1440
    return per_minute_rate, base_rate, active_referrals

async def check_unique_fields(field_name: str, value: str, exclude_uid: Optional[str] = None):
    """Check if field value is unique"""
    if not value:
        return True
    
    query = {field_name: value}
    if exclude_uid:
        query["uid"] = {"$ne": exclude_uid}
    
    existing = await db.users.find_one(query)
    return existing is None

async def calculate_profile_completion(user: Dict) -> float:
    """Calculate profile completion percentage"""
    required_fields = [
        "first_name", "last_name", "mobile", "email",
        "state", "district", "pincode",
        "aadhaar_number", "pan_number",
        "bank_account_number", "upi_id"
    ]
    
    completed = sum(1 for field in required_fields if user.get(field))
    return (completed / len(required_fields)) * 100

# ========== AUTH & USER MANAGEMENT ==========
@api_router.post("/auth/register")
async def register_user(request: Request):
    """Enhanced user registration with duplicate checks"""
    data = await request.json()
    
    # Check duplicates
    for field in ["email", "mobile", "aadhaar_number", "pan_number"]:
        if data.get(field):
            if not await check_unique_fields(field, data[field]):
                raise HTTPException(
                    status_code=400,
                    detail=f"{field.replace('_', ' ').title()} already registered"
                )
    
    # Create user
    user = User(**data)
    user_dict = user.model_dump()
    
    # Convert datetime fields
    for field in ["created_at", "updated_at", "last_login"]:
        if user_dict.get(field):
            user_dict[field] = user_dict[field].isoformat()
    
    await db.users.insert_one(user_dict)
    return {"message": "Registration successful", "uid": user.uid}

@api_router.post("/auth/login")
async def login(email: str, device_id: Optional[str] = None, ip_address: Optional[str] = None):
    """User login with device tracking"""
    user = await db.users.find_one({"email": email})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="Account suspended")
    
    # Update last login and device info
    update_data = {
        "last_login": datetime.now(timezone.utc).isoformat(),
        "$inc": {"login_count": 1}
    }
    
    if device_id:
        update_data["device_id"] = device_id
    if ip_address:
        update_data["ip_address"] = ip_address
    
    await db.users.update_one({"uid": user["uid"]}, {"$set": update_data})
    
    # Convert datetime strings
    for field in ["created_at", "updated_at", "last_login", "membership_expiry"]:
        if user.get(field) and isinstance(user[field], str):
            try:
                user[field] = datetime.fromisoformat(user[field])
            except:
                pass
    
    return User(**user)

@api_router.get("/user/{uid}")
async def get_user(uid: str):
    """Get user profile"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Convert datetime fields
    for field in ["created_at", "updated_at", "last_login", "membership_expiry"]:
        if user.get(field) and isinstance(user[field], str):
            try:
                user[field] = datetime.fromisoformat(user[field])
            except:
                pass
    
    return User(**user)

@api_router.patch("/user/{uid}/profile")
async def update_profile(uid: str, profile: UserProfileUpdate):
    """Update user profile"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if KYC approved - if yes, prevent aadhaar/pan changes
    if user.get("kyc_status") == "approved":
        if profile.dict(exclude_unset=True).get("aadhaar_number") or profile.dict(exclude_unset=True).get("pan_number"):
            raise HTTPException(status_code=400, detail="Cannot change Aadhaar/PAN after KYC approval")
    
    # Check unique fields
    update_data = profile.dict(exclude_unset=True)
    for field in ["mobile", "upi_id"]:
        if update_data.get(field):
            if not await check_unique_fields(field, update_data[field], uid):
                raise HTTPException(status_code=400, detail=f"{field.replace('_', ' ').title()} already in use")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one({"uid": uid}, {"$set": update_data})
    
    # Recalculate profile completion
    updated_user = await db.users.find_one({"uid": uid})
    completion = await calculate_profile_completion(updated_user)
    await db.users.update_one({"uid": uid}, {"$set": {"profile_completion": completion}})
    
    return {"message": "Profile updated successfully", "profile_completion": completion}

# ========== CART & CHECKOUT ==========
@api_router.post("/cart/{uid}/add")
async def add_to_cart(uid: str, item: CartItem):
    """Add item to cart"""
    # Get or create cart
    cart = await db.carts.find_one({"user_id": uid})
    
    if not cart:
        cart = Cart(user_id=uid, items=[item]).model_dump()
        cart["created_at"] = cart["created_at"].isoformat()
        cart["updated_at"] = cart["updated_at"].isoformat()
        await db.carts.insert_one(cart)
    else:
        # Check if product already in cart
        found = False
        for existing_item in cart.get("items", []):
            if existing_item["product_id"] == item.product_id:
                existing_item["quantity"] += item.quantity
                found = True
                break
        
        if not found:
            cart.setdefault("items", []).append(item.dict())
        
        cart["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.carts.update_one({"user_id": uid}, {"$set": cart})
    
    return {"message": "Item added to cart"}

@api_router.get("/cart/{uid}")
async def get_cart(uid: str):
    """Get user's cart with product details"""
    cart = await db.carts.find_one({"user_id": uid})
    if not cart:
        return {"items": [], "total_prc": 0, "total_items": 0}
    
    # Fetch product details for each item
    cart_items = []
    total_prc = 0
    
    for item in cart.get("items", []):
        product = await db.products.find_one({"product_id": item["product_id"]})
        if product:
            item_total = product["prc_price"] * item["quantity"]
            cart_items.append({
                "product_id": item["product_id"],
                "name": product["name"],
                "prc_price": product["prc_price"],
                "quantity": item["quantity"],
                "total": item_total,
                "image_url": product.get("image_url")
            })
            total_prc += item_total
    
    return {
        "items": cart_items,
        "total_prc": total_prc,
        "total_items": len(cart_items)
    }

@api_router.delete("/cart/{uid}/clear")
async def clear_cart(uid: str):
    """Clear user's cart"""
    await db.carts.delete_one({"user_id": uid})
    return {"message": "Cart cleared"}

@api_router.post("/cart/{uid}/checkout")
async def checkout(uid: str):
    """Checkout cart - create order with single secret code"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check VIP and KYC
    if user.get("membership_type") != "vip":
        raise HTTPException(status_code=403, detail="VIP membership required")
    
    if user.get("kyc_status") != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    # Get cart
    cart = await db.carts.find_one({"user_id": uid})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Calculate totals and prepare order items
    order_items = []
    total_prc = 0
    
    for cart_item in cart["items"]:
        product = await db.products.find_one({"product_id": cart_item["product_id"]})
        if not product:
            continue
        
        if not product.get("is_active") or product.get("stock_quantity", 0) < cart_item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Product {product['name']} is out of stock")
        
        item_total = product["prc_price"] * cart_item["quantity"]
        
        order_items.append(OrderItem(
            product_id=product["product_id"],
            product_name=product["name"],
            prc_price=product["prc_price"],
            quantity=cart_item["quantity"],
            total_prc=item_total
        ))
        
        total_prc += item_total
    
    # Check PRC balance
    if user.get("prc_balance", 0) < total_prc:
        raise HTTPException(status_code=400, detail="Insufficient PRC balance")
    
    # Get settings
    settings = await db.settings.find_one({}) or {}
    cashback_pct = settings.get("cashback_percentage", 0.25)
    delivery_rate = settings.get("delivery_charge_rate", 0.10)
    delivery_split = settings.get("delivery_split", {"master": 10, "sub": 20, "outlet": 60, "company": 10})
    
    # Calculate amounts
    cashback_prc = total_prc * cashback_pct
    cashback_inr = cashback_prc / 10  # 10 PRC = 1 INR
    delivery_charge_inr = (total_prc / 10) * delivery_rate
    
    # Create order with single secret code
    order = Order(
        user_id=uid,
        items=[item.dict() for item in order_items],
        total_prc=total_prc,
        cashback_amount_prc=cashback_prc,
        cashback_amount_inr=cashback_inr,
        delivery_charge_rate=delivery_rate,
        delivery_charge_inr=delivery_charge_inr,
        profit_distribution=delivery_split
    )
    
    # Atomic transaction: deduct PRC, add cashback, save order
    await db.users.update_one(
        {"uid": uid},
        {
            "$inc": {
                "prc_balance": -total_prc,
                "cashback_wallet_balance": cashback_inr
            }
        }
    )
    
    # Deduct stock
    for item in order_items:
        await db.products.update_one(
            {"product_id": item.product_id},
            {"$inc": {"stock_quantity": -item.quantity}}
        )
    
    # Save order
    order_dict = order.model_dump()
    order_dict["created_at"] = order_dict["created_at"].isoformat()
    await db.orders.insert_one(order_dict)
    
    # Clear cart
    await db.carts.delete_one({"user_id": uid})
    
    return {
        "message": "Order placed successfully",
        "order_id": order.order_id,
        "secret_code": order.secret_code,
        "total_prc": total_prc,
        "cashback_inr": cashback_inr
    }

# Continue with more endpoints...
# This file will be extended with remaining endpoints

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
