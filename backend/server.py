from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, Form, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import secrets
import string
import base64
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password"""
    return pwd_context.verify(plain_password, hashed_password)

def generate_reset_token() -> str:
    """Generate password reset token"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(32))

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ========== MODELS ==========
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    uid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: Optional[str] = None
    name: Optional[str] = None  # Made optional, will be constructed from first/last name
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    profile_picture: Optional[str] = None
    role: str = "user"  # user, admin, master_stockist, sub_stockist, outlet
    password_hash: Optional[str] = None
    reset_token: Optional[str] = None
    reset_token_expiry: Optional[datetime] = None
    
    # Address fields
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    pincode: Optional[str] = None
    
    # KYC fields
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    upi_id: Optional[str] = None
    
    # Membership
    membership_type: str = "free"  # free, vip
    membership_expiry: Optional[datetime] = None
    
    # Wallets
    prc_balance: float = 0.0
    cash_wallet_balance: float = 0.0
    wallet_status: str = "active"  # active, frozen
    last_wallet_maintenance: Optional[datetime] = None
    
    # KYC Status
    kyc_status: str = "pending"  # pending, verified, rejected
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    
    # Referral
    referral_code: str = Field(default_factory=lambda: ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8)))
    referred_by: Optional[str] = None
    
    # Mining
    mining_start_time: Optional[datetime] = None
    total_mined: float = 0.0
    taps_today: int = 0
    last_tap_date: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    google_id: Optional[str] = None
    name: str
    profile_picture: Optional[str] = None

class MiningStatus(BaseModel):
    current_balance: float
    mining_rate: float
    base_rate: float
    active_referrals: int
    total_mined: float

class TapGamePlay(BaseModel):
    taps: int

class ReferralInfo(BaseModel):
    referrer_uid: str
    referred_uid: str
    status: str = "active"
    date_joined: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VIPPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    date: str
    time: str
    utr_number: str
    screenshot_url: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VIPPaymentCreate(BaseModel):
    amount: float
    date: str
    time: str
    utr_number: str
    screenshot_base64: Optional[str] = None

class VIPPaymentAction(BaseModel):
    action: str  # approve, reject

class KYCDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    kyc_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    aadhaar_front: Optional[str] = None
    aadhaar_back: Optional[str] = None
    pan_front: Optional[str] = None
    status: str = "pending"  # pending, verified, rejected
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified_at: Optional[datetime] = None

class KYCSubmit(BaseModel):
    aadhaar_front_base64: str
    aadhaar_back_base64: str
    pan_front_base64: str

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    prc_price: float
    image_url: Optional[str] = None
    category: str
    stock_quantity: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    description: str
    prc_price: float
    image_base64: Optional[str] = None
    category: str
    stock_quantity: int = 0

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    order_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    product_id: str
    product_name: str
    prc_amount: float
    cashback_amount: float
    transaction_fee: float
    delivery_fee: float
    total_cash_fee: float
    secret_code: str = Field(default_factory=lambda: f"PRC-{''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))}")
    status: str = "pending"  # pending, verified, delivered, cancelled
    outlet_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    delivered_at: Optional[datetime] = None

class OrderCreate(BaseModel):
    product_id: str

class OrderVerify(BaseModel):
    secret_code: str

class Outlet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    outlet_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    owner_name: str
    email: Optional[str] = None
    phone: str
    state: str
    district: str
    taluka: str
    village: str
    pincode: str
    sub_stockist_id: Optional[str] = None
    is_active: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutletCreate(BaseModel):
    name: str
    owner_name: str
    email: Optional[str] = None
    phone: str
    state: str
    district: str
    taluka: str
    village: str
    pincode: str

class LeaderboardEntry(BaseModel):
    uid: str
    name: str
    profile_picture: Optional[str] = None
    total_prc: float
    rank: int
    is_vip: bool

class WalletWithdrawal(BaseModel):
    amount: float
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None

# ========== HELPER FUNCTIONS ==========
async def get_base_rate():
    """Calculate base rate based on total users"""
    total_users = await db.users.count_documents({})
    base_rate = 50 - (total_users // 100)
    return max(base_rate, 10)
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

async def check_unique_fields(field_name: str, value: str, exclude_uid: Optional[str] = None):
    """Check if field value is unique"""
    if not value:
        return True
    
    query = {field_name: value}
    if exclude_uid:
        query["uid"] = {"$ne": exclude_uid}
    
    existing = await db.users.find_one(query)
    return existing is None

async def get_active_referrals(uid: str):
    """Count active referrals (logged in within 24 hours)"""
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    active_count = await db.users.count_documents({
        "referred_by": uid,
        "last_login": {"$gte": yesterday.isoformat()}
    })
    return min(active_count, 200)  # Cap at 200

async def calculate_mining_rate(uid: str):
    """Calculate mining rate per minute"""
    base_rate = await get_base_rate()
    active_referrals = await get_active_referrals(uid)
    current_date = datetime.now(timezone.utc).day
    
    # Add referral bonus (10% per active referral)
    referral_bonus = active_referrals * 0.1 * base_rate
    total_rate = (current_date * base_rate) + referral_bonus
    
    # Per minute rate
    per_minute_rate = total_rate / 1440
    return per_minute_rate, base_rate, active_referrals

async def update_mined_coins(uid: str):
    """Update user's mined coins based on time elapsed"""
    user = await db.users.find_one({"uid": uid})
    if not user or not user.get("mining_start_time"):
        return 0
    
    mining_start = datetime.fromisoformat(user["mining_start_time"])
    current_time = datetime.now(timezone.utc)
    elapsed_minutes = (current_time - mining_start).total_seconds() / 60
    
    if elapsed_minutes > 0:
        rate_per_minute, _, _ = await calculate_mining_rate(uid)
        mined_amount = elapsed_minutes * rate_per_minute
        
        # Update user balance
        await db.users.update_one(
            {"uid": uid},
            {
                "$inc": {"prc_balance": mined_amount, "total_mined": mined_amount},
                "$set": {"mining_start_time": current_time.isoformat()}
            }
        )
        return mined_amount
    return 0

# ========== AUTH ROUTES ==========
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
    
    # Hash password if provided
    if data.get('password'):
        data['password_hash'] = hash_password(data['password'])
        del data['password']
    
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
async def login(
    identifier: str,
    password: str,
    device_id: Optional[str] = None,
    ip_address: Optional[str] = None
):
    """User login with email/mobile and password"""
    # Find user by email or mobile
    user = await db.users.find_one({
        "$or": [
            {"email": identifier},
            {"mobile": identifier},
            {"uid": identifier}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify password
    if user.get("password_hash"):
        if not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid password")
    
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail=f"Account suspended: {user.get('suspension_reason', 'Contact support')}")
    
    # Update last login and device info
    update_data = {
        "last_login": datetime.now(timezone.utc).isoformat(),
    }
    
    if device_id:
        update_data["device_id"] = device_id
    if ip_address:
        update_data["ip_address"] = ip_address
    
    await db.users.update_one(
        {"uid": user["uid"]},
        {
            "$set": update_data,
            "$inc": {"login_count": 1}
        }
    )
    
    # Convert datetime strings
    for field in ["created_at", "updated_at", "last_login", "membership_expiry"]:
        if user.get(field) and isinstance(user[field], str):
            try:
                user[field] = datetime.fromisoformat(user[field])
            except:
                pass
    
    # Remove password hash from response
    if "password_hash" in user:
        del user["password_hash"]
    
    return User(**user)

@api_router.post("/auth/forgot-password")
async def forgot_password(email: str):
    """Request password reset"""
    user = await db.users.find_one({"email": email})
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Generate reset token
    reset_token = generate_reset_token()
    reset_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "reset_token": reset_token,
                "reset_token_expiry": reset_expiry.isoformat()
            }
        }
    )
    
    # In production, send email here
    # For now, return token (remove in production)
    return {
        "message": "Password reset token generated",
        "reset_token": reset_token,
        "note": "In production, this would be sent via email"
    }

@api_router.post("/auth/reset-password")
async def reset_password(reset_token: str, new_password: str):
    """Reset password using token"""
    user = await db.users.find_one({"reset_token": reset_token})
    
    if not user:
        raise HTTPException(status_code=404, detail="Invalid reset token")
    
    # Check if token expired
    if user.get("reset_token_expiry"):
        expiry = datetime.fromisoformat(user["reset_token_expiry"])
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=400, detail="Reset token expired")
    
    # Update password
    await db.users.update_one(
        {"uid": user["uid"]},
        {
            "$set": {
                "password_hash": hash_password(new_password),
                "reset_token": None,
                "reset_token_expiry": None
            }
        }
    )
    
    return {"message": "Password reset successful"}

@api_router.post("/auth/change-password")
async def change_password(uid: str, old_password: str, new_password: str):
    """Change password for logged in user"""
    user = await db.users.find_one({"uid": uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify old password
    if user.get("password_hash"):
        if not verify_password(old_password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Update password
    await db.users.update_one(
        {"uid": uid},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/user/{uid}", response_model=User)
async def get_user(uid: str):
    """Get user details"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    if isinstance(user.get('last_login'), str):
        user['last_login'] = datetime.fromisoformat(user['last_login'])
    if user.get('membership_expiry') and isinstance(user['membership_expiry'], str):
        user['membership_expiry'] = datetime.fromisoformat(user['membership_expiry'])
    
    return User(**user)

# ========== MINING ROUTES ==========
@api_router.post("/mining/start/{uid}")
async def start_mining(uid: str):
    """Start mining"""
    await db.users.update_one(
        {"uid": uid},
        {"$set": {"mining_start_time": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Mining started", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/mining/status/{uid}", response_model=MiningStatus)
async def get_mining_status(uid: str):
    """Get current mining status"""
    # Update mined coins first
    mined = await update_mined_coins(uid)
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    rate_per_minute, base_rate, active_referrals = await calculate_mining_rate(uid)
    
    return MiningStatus(
        current_balance=user.get("prc_balance", 0),
        mining_rate=rate_per_minute * 60,  # per hour
        base_rate=base_rate,
        active_referrals=active_referrals,
        total_mined=user.get("total_mined", 0)
    )

@api_router.post("/mining/claim/{uid}")
async def claim_mining(uid: str):
    """Claim mined coins"""
    mined = await update_mined_coins(uid)
    return {"message": "Coins claimed", "amount": mined}

# ========== TAP GAME ROUTES ==========
@api_router.post("/game/tap/{uid}")
async def play_tap_game(uid: str, tap_data: TapGamePlay):
    """Play tap game"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    current_taps = user.get("taps_today", 0) if user.get("last_tap_date") == today else 0
    
    # Check if user has taps left
    remaining_taps = 100 - current_taps
    if remaining_taps <= 0:
        raise HTTPException(status_code=400, detail="Daily tap limit reached")
    
    # Validate tap count
    taps_to_add = min(tap_data.taps, remaining_taps)
    
    # Update user
    await db.users.update_one(
        {"uid": uid},
        {
            "$inc": {"prc_balance": taps_to_add, "total_mined": taps_to_add},
            "$set": {"taps_today": current_taps + taps_to_add, "last_tap_date": today}
        }
    )
    
    return {"taps_added": taps_to_add, "remaining_taps": remaining_taps - taps_to_add, "prc_earned": taps_to_add}

# ========== REFERRAL ROUTES ==========
@api_router.get("/referral/code/{uid}")
async def get_referral_code(uid: str):
    """Get user's referral code"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"referral_code": user.get("referral_code")}

@api_router.post("/referral/apply/{uid}")
async def apply_referral(uid: str, referral_code: str):
    """Apply referral code"""
    # Check if user already has referrer
    user = await db.users.find_one({"uid": uid})
    if user.get("referred_by"):
        raise HTTPException(status_code=400, detail="Referral already applied")
    
    # Find referrer
    referrer = await db.users.find_one({"referral_code": referral_code})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referrer["uid"] == uid:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")
    
    # Update user
    await db.users.update_one(
        {"uid": uid},
        {"$set": {"referred_by": referrer["uid"]}}
    )
    
    return {"message": "Referral applied successfully"}

@api_router.get("/referral/list/{uid}")
async def get_referrals(uid: str):
    """Get list of referrals"""
    referrals = await db.users.find({"referred_by": uid}, {"_id": 0, "uid": 1, "name": 1, "profile_picture": 1, "last_login": 1}).to_list(200)
    
    # Check if active
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    for ref in referrals:
        last_login = datetime.fromisoformat(ref.get("last_login")) if isinstance(ref.get("last_login"), str) else ref.get("last_login")
        ref["is_active"] = last_login >= yesterday if last_login else False
    
    return {"referrals": referrals, "total": len(referrals)}

# ========== VIP MEMBERSHIP ROUTES ==========
@api_router.post("/membership/payment/{uid}", response_model=VIPPayment)
async def submit_vip_payment(uid: str, payment: VIPPaymentCreate):
    """Submit VIP payment for verification"""
    vip_payment = VIPPayment(
        user_id=uid,
        amount=payment.amount,
        date=payment.date,
        time=payment.time,
        utr_number=payment.utr_number,
        screenshot_url=payment.screenshot_base64
    )
    
    doc = vip_payment.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.vip_payments.insert_one(doc)
    
    return vip_payment

@api_router.get("/membership/payments", response_model=List[VIPPayment])
async def get_vip_payments():
    """Get all VIP payments (Admin)"""
    payments = await db.vip_payments.find({}, {"_id": 0}).to_list(1000)
    for payment in payments:
        if isinstance(payment.get('created_at'), str):
            payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    return payments

@api_router.post("/membership/payment/{payment_id}/action")
async def action_vip_payment(payment_id: str, action: VIPPaymentAction):
    """Approve or reject VIP payment (Admin)"""
    payment = await db.vip_payments.find_one({"payment_id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Update payment status
    await db.vip_payments.update_one(
        {"payment_id": payment_id},
        {"$set": {"status": "approved" if action.action == "approve" else "rejected"}}
    )
    
    # If approved, update user membership
    if action.action == "approve":
        expiry = datetime.now(timezone.utc) + timedelta(days=365)
        await db.users.update_one(
            {"uid": payment["user_id"]},
            {"$set": {"membership_type": "vip", "membership_expiry": expiry.isoformat()}}
        )
    
    return {"message": f"Payment {action.action}d successfully"}

# ========== KYC ROUTES ==========
@api_router.post("/kyc/submit/{uid}", response_model=KYCDocument)
async def submit_kyc(uid: str, kyc_data: KYCSubmit):
    """Submit KYC documents"""
    kyc_doc = KYCDocument(
        user_id=uid,
        aadhaar_front=kyc_data.aadhaar_front_base64,
        aadhaar_back=kyc_data.aadhaar_back_base64,
        pan_front=kyc_data.pan_front_base64
    )
    
    doc = kyc_doc.model_dump()
    doc['submitted_at'] = doc['submitted_at'].isoformat()
    await db.kyc_documents.insert_one(doc)
    
    # Update user KYC status
    await db.users.update_one(
        {"uid": uid},
        {"$set": {"kyc_status": "pending"}}
    )
    
    return kyc_doc

@api_router.get("/kyc/list", response_model=List[KYCDocument])
async def get_kyc_documents():
    """Get all KYC documents (Admin)"""
    docs = await db.kyc_documents.find({}, {"_id": 0}).to_list(1000)
    for doc in docs:
        if isinstance(doc.get('submitted_at'), str):
            doc['submitted_at'] = datetime.fromisoformat(doc['submitted_at'])
        if doc.get('verified_at') and isinstance(doc['verified_at'], str):
            doc['verified_at'] = datetime.fromisoformat(doc['verified_at'])
    return docs

@api_router.post("/kyc/{kyc_id}/verify")
async def verify_kyc(kyc_id: str, action: VIPPaymentAction):
    """Verify or reject KYC (Admin)"""
    kyc = await db.kyc_documents.find_one({"kyc_id": kyc_id})
    if not kyc:
        raise HTTPException(status_code=404, detail="KYC not found")
    
    status = "verified" if action.action == "approve" else "rejected"
    
    await db.kyc_documents.update_one(
        {"kyc_id": kyc_id},
        {"$set": {"status": status, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.users.update_one(
        {"uid": kyc["user_id"]},
        {"$set": {"kyc_status": status}}
    )
    
    return {"message": f"KYC {status} successfully"}

# ========== MARKETPLACE ROUTES ==========
@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate):
    """Create product (Admin)"""
    new_product = Product(
        name=product.name,
        description=product.description,
        prc_price=product.prc_price,
        image_url=product.image_base64,
        category=product.category,
        stock_quantity=product.stock_quantity
    )
    
    doc = new_product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.products.insert_one(doc)
    
    return new_product

@api_router.get("/products", response_model=List[Product])
async def get_products():
    """Get all products"""
    products = await db.products.find({"is_active": True}, {"_id": 0}).to_list(1000)
    for product in products:
        if isinstance(product.get('created_at'), str):
            product['created_at'] = datetime.fromisoformat(product['created_at'])
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    """Get single product"""
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return Product(**product)

# ========== ORDER/REDEEM ROUTES ==========
@api_router.post("/orders/{uid}", response_model=Order)
async def create_order(uid: str, order_data: OrderCreate):
    """Create order (Redeem product)"""
    # Check user eligibility
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("membership_type") != "vip":
        raise HTTPException(status_code=403, detail="VIP membership required")
    
    if user.get("kyc_status") != "verified":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    # Get product
    product = await db.products.find_one({"product_id": order_data.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    prc_price = product["prc_price"]
    
    # Check balance
    if user.get("prc_balance", 0) < prc_price:
        raise HTTPException(status_code=400, detail="Insufficient PRC balance")
    
    # Calculate fees
    cashback = prc_price * 0.25
    transaction_fee = prc_price * 0.05
    delivery_fee = prc_price * 0.10
    total_cash_fee = transaction_fee + delivery_fee
    
    # Create order
    order = Order(
        user_id=uid,
        product_id=product["product_id"],
        product_name=product["name"],
        prc_amount=prc_price,
        cashback_amount=cashback,
        transaction_fee=transaction_fee,
        delivery_fee=delivery_fee,
        total_cash_fee=total_cash_fee
    )
    
    # Deduct PRC and add cashback to wallet
    cashback_inr = cashback / 10  # 10 PRC = ₹1
    await db.users.update_one(
        {"uid": uid},
        {
            "$inc": {
                "prc_balance": -prc_price,
                "cash_wallet_balance": cashback_inr
            }
        }
    )
    
    # Save order
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.orders.insert_one(doc)
    
    return order

@api_router.get("/orders/{uid}", response_model=List[Order])
async def get_user_orders(uid: str):
    """Get user's orders"""
    orders = await db.orders.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if order.get('delivered_at') and isinstance(order['delivered_at'], str):
            order['delivered_at'] = datetime.fromisoformat(order['delivered_at'])
    return orders

@api_router.post("/orders/verify")
async def verify_order(verify_data: OrderVerify):
    """Verify order with secret code (Outlet)"""
    order = await db.orders.find_one({"secret_code": verify_data.secret_code})
    if not order:
        raise HTTPException(status_code=404, detail="Invalid secret code")
    
    if order.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Order already processed")
    
    # Update order status
    await db.orders.update_one(
        {"secret_code": verify_data.secret_code},
        {"$set": {"status": "verified"}}
    )
    
    return {"message": "Order verified", "order": order}

@api_router.post("/orders/{order_id}/deliver")
async def deliver_order(order_id: str):
    """Mark order as delivered (Outlet)"""
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "delivered", "delivered_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Order delivered successfully"}

# ========== WALLET ROUTES ==========
@api_router.get("/wallet/{uid}")
async def get_wallet(uid: str):
    """Get wallet balance"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "balance": user.get("cash_wallet_balance", 0),
        "status": user.get("wallet_status", "active"),
        "last_maintenance": user.get("last_wallet_maintenance")
    }

@api_router.post("/wallet/{uid}/withdraw")
async def withdraw_wallet(uid: str, withdrawal: WalletWithdrawal):
    """Withdraw from wallet"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("kyc_status") != "verified":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    if user.get("wallet_status") != "active":
        raise HTTPException(status_code=403, detail="Wallet is frozen")
    
    if withdrawal.amount < 100:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is ₹100")
    
    balance = user.get("cash_wallet_balance", 0)
    if balance < withdrawal.amount + 5:  # +5 for fee
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Deduct amount + fee
    await db.users.update_one(
        {"uid": uid},
        {"$inc": {"cash_wallet_balance": -(withdrawal.amount + 5)}}
    )
    
    return {"message": "Withdrawal processed", "amount": withdrawal.amount, "fee": 5}

# ========== LEADERBOARD ROUTES ==========
@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard():
    """Get leaderboard"""
    users = await db.users.find(
        {"is_active": True},
        {"_id": 0, "uid": 1, "name": 1, "profile_picture": 1, "total_mined": 1, "membership_type": 1}
    ).sort("total_mined", -1).limit(100).to_list(100)
    
    leaderboard = []
    for idx, user in enumerate(users, 1):
        leaderboard.append(LeaderboardEntry(
            uid=user["uid"],
            name=user["name"],
            profile_picture=user.get("profile_picture"),
            total_prc=user.get("total_mined", 0),
            rank=idx,
            is_vip=user.get("membership_type") == "vip"
        ))
    
    return leaderboard

# ========== OUTLET ROUTES ==========
@api_router.post("/outlets", response_model=Outlet)
async def create_outlet(outlet: OutletCreate):
    """Create outlet (Admin)"""
    new_outlet = Outlet(**outlet.model_dump())
    doc = new_outlet.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.outlets.insert_one(doc)
    return new_outlet

@api_router.get("/outlets", response_model=List[Outlet])
async def get_outlets():
    """Get all outlets"""
    outlets = await db.outlets.find({}, {"_id": 0}).to_list(1000)
    for outlet in outlets:
        if isinstance(outlet.get('created_at'), str):
            outlet['created_at'] = datetime.fromisoformat(outlet['created_at'])
    return outlets

@api_router.post("/outlets/{outlet_id}/activate")
async def activate_outlet(outlet_id: str):
    """Activate outlet (Admin)"""
    await db.outlets.update_one(
        {"outlet_id": outlet_id},
        {"$set": {"is_active": True}}
    )
    return {"message": "Outlet activated"}

# ========== ADMIN ROUTES ==========
@api_router.post("/admin/promote")
async def promote_user(email: str, role: str):
    """Promote user to admin or outlet role"""
    if role not in ["admin", "outlet", "user", "master_stockist", "sub_stockist"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"role": role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User promoted to {role} successfully"}

@api_router.get("/admin/stats")
async def get_admin_stats():
    """Get admin dashboard stats"""
    total_users = await db.users.count_documents({})
    vip_users = await db.users.count_documents({"membership_type": "vip"})
    total_orders = await db.orders.count_documents({})
    pending_kyc = await db.kyc_documents.count_documents({"status": "pending"})
    pending_payments = await db.vip_payments.count_documents({"status": "pending"})
    
    return {
        "total_users": total_users,
        "vip_users": vip_users,
        "total_orders": total_orders,
        "pending_kyc": pending_kyc,
        "pending_payments": pending_payments
    }

# Include router
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

# ========== V2 ENHANCED ENDPOINTS ==========

# Cart System
@api_router.post("/v2/cart/{uid}/add")
async def add_to_cart_v2(uid: str, product_id: str, quantity: int = 1):
    """Add item to cart - V2"""
    cart = await db.carts.find_one({"user_id": uid})
    
    if not cart:
        cart_data = {
            "cart_id": str(uuid.uuid4()),
            "user_id": uid,
            "items": [{"product_id": product_id, "quantity": quantity}],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.carts.insert_one(cart_data)
    else:
        # Check if product already in cart
        items = cart.get("items", [])
        found = False
        for item in items:
            if item["product_id"] == product_id:
                item["quantity"] += quantity
                found = True
                break
        
        if not found:
            items.append({"product_id": product_id, "quantity": quantity})
        
        await db.carts.update_one(
            {"user_id": uid},
            {"$set": {"items": items, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Item added to cart"}

@api_router.get("/v2/cart/{uid}")
async def get_cart_v2(uid: str):
    """Get cart with product details - V2"""
    cart = await db.carts.find_one({"user_id": uid})
    if not cart:
        return {"items": [], "total_prc": 0, "total_items": 0}
    
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
    
    return {"items": cart_items, "total_prc": total_prc, "total_items": len(cart_items)}

@api_router.delete("/v2/cart/{uid}/item/{product_id}")
async def remove_from_cart(uid: str, product_id: str):
    """Remove item from cart"""
    cart = await db.carts.find_one({"user_id": uid})
    if cart:
        items = [item for item in cart.get("items", []) if item["product_id"] != product_id]
        await db.carts.update_one({"user_id": uid}, {"$set": {"items": items}})
    return {"message": "Item removed"}

# Stockist Management
@api_router.post("/v2/stockist/register")
async def register_stockist(
    business_name: str,
    owner_full_name: str,
    business_type: str,
    contact_number: str,
    email: str,
    state: str,
    district: str,
    taluka: str,
    village: str,
    pincode: str,
    pan_number: str,
    aadhaar_number: str,
    user_id: str
):
    """Register new stockist/outlet"""
    # Check if user exists
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check duplicates
    existing = await db.stockists.find_one({"$or": [
        {"email": email},
        {"contact_number": contact_number},
        {"pan_number": pan_number},
        {"aadhaar_number": aadhaar_number}
    ]})
    
    if existing:
        raise HTTPException(status_code=400, detail="Stockist already registered with these details")
    
    stockist_data = {
        "stockist_id": str(uuid.uuid4()),
        "user_id": user_id,
        "business_name": business_name,
        "owner_full_name": owner_full_name,
        "business_type": business_type,
        "contact_number": contact_number,
        "email": email,
        "state": state,
        "district": district,
        "taluka": taluka,
        "village": village,
        "pincode": pincode,
        "pan_number": pan_number,
        "aadhaar_number": aadhaar_number,
        "approval_status": "pending",
        "is_active": False,
        "profit_wallet": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stockists.insert_one(stockist_data)
    return {"message": "Registration submitted for approval", "stockist_id": stockist_data["stockist_id"]}

@api_router.get("/v2/stockists/pending")
async def get_pending_stockists():
    """Get all pending stockist registrations (Admin)"""
    stockists = await db.stockists.find({"approval_status": "pending"}, {"_id": 0}).to_list(1000)
    return {"stockists": stockists}

@api_router.post("/v2/stockist/{stockist_id}/approve")
async def approve_stockist(stockist_id: str, approved: bool):
    """Approve or reject stockist (Admin)"""
    stockist = await db.stockists.find_one({"stockist_id": stockist_id})
    if not stockist:
        raise HTTPException(status_code=404, detail="Stockist not found")
    
    status = "approved" if approved else "rejected"
    update_data = {
        "approval_status": status,
        "is_active": approved,
        "approved_at": datetime.now(timezone.utc).isoformat() if approved else None
    }
    
    await db.stockists.update_one({"stockist_id": stockist_id}, {"$set": update_data})
    
    # Update user role
    if approved:
        role_map = {"master": "master_stockist", "sub": "sub_stockist", "outlet": "outlet"}
        new_role = role_map.get(stockist["business_type"], "user")
        await db.users.update_one(
            {"uid": stockist["user_id"]},
            {"$set": {"role": new_role}}
        )
    
    return {"message": f"Stockist {status}"}

# Support Ticket System
@api_router.post("/v2/support/ticket")
async def create_ticket(uid: str, subject: str, category: str, description: str, priority: str = "medium"):
    """Create support ticket"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    ticket_data = {
        "ticket_id": f"TKT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
        "user_id": uid,
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get('name', 'User'),
        "user_email": user.get("email", ""),
        "subject": subject,
        "category": category,
        "description": description,
        "priority": priority,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.insert_one(ticket_data)
    return {"message": "Ticket created", "ticket_id": ticket_data["ticket_id"]}

@api_router.get("/v2/support/tickets/{uid}")
async def get_user_tickets(uid: str):
    """Get user's support tickets"""
    tickets = await db.support_tickets.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"tickets": tickets}

@api_router.get("/v2/support/tickets")
async def get_all_tickets(status: Optional[str] = None):
    """Get all support tickets (Admin)"""
    query = {}
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"tickets": tickets}

@api_router.patch("/v2/support/ticket/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    status: Optional[str] = None,
    admin_response: Optional[str] = None,
    assigned_to: Optional[str] = None
):
    """Update support ticket (Admin)"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if status:
        update_data["status"] = status
        if status == "resolved":
            update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
    
    if admin_response:
        update_data["admin_response"] = admin_response
    
    if assigned_to:
        update_data["assigned_to"] = assigned_to
    
    await db.support_tickets.update_one({"ticket_id": ticket_id}, {"$set": update_data})
    return {"message": "Ticket updated"}

# Settings Management
@api_router.get("/v2/settings")
async def get_settings():
    """Get system settings"""
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        # Create default settings
        default_settings = {
            "mining_base_rate": 50.0,
            "mining_base_rate_min": 10.0,
            "mining_decrease_per_users": 100,
            "referral_bonus_percentage": 0.10,
            "max_referrals": 200,
            "delivery_charge_rate": 0.10,
            "delivery_split": {"master": 10, "sub": 20, "outlet": 60, "company": 10},
            "cashback_percentage": 0.25,
            "wallet_maintenance_fee": 99.0,
            "withdrawal_min_amount": 10.0,
            "withdrawal_fee": 5.0,
            "vip_membership_fee": 1000.0,
            "master_security_deposit": 500000.0,
            "sub_security_deposit": 300000.0,
            "outlet_security_deposit": 100000.0,
            "security_deposit_return_rate": 0.03,
            "master_renewal_fee": 50000.0,
            "sub_renewal_fee": 30000.0,
            "outlet_renewal_fee": 10000.0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.settings.insert_one(default_settings)
        return default_settings
    return settings

@api_router.patch("/v2/settings")
async def update_settings(
    mining_base_rate: Optional[float] = None,
    delivery_charge_rate: Optional[float] = None,
    cashback_percentage: Optional[float] = None,
    delivery_split: Optional[str] = None,
    wallet_maintenance_fee: Optional[float] = None,
    vip_membership_fee: Optional[float] = None
):
    """Update system settings (Admin)"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if mining_base_rate is not None:
        update_data["mining_base_rate"] = mining_base_rate
    if delivery_charge_rate is not None:
        update_data["delivery_charge_rate"] = delivery_charge_rate
    if cashback_percentage is not None:
        update_data["cashback_percentage"] = cashback_percentage
    if delivery_split:
        import json
        update_data["delivery_split"] = json.loads(delivery_split)
    if wallet_maintenance_fee is not None:
        update_data["wallet_maintenance_fee"] = wallet_maintenance_fee
    if vip_membership_fee is not None:
        update_data["vip_membership_fee"] = vip_membership_fee
    
    await db.settings.update_one({}, {"$set": update_data}, upsert=True)
    return {"message": "Settings updated"}

# Withdrawal Management V2
@api_router.post("/v2/withdrawal/request")
async def create_withdrawal_request(
    uid: str,
    wallet_type: str,
    amount: float,
    payment_mode: str,
    upi_id: Optional[str] = None,
    bank_account: Optional[str] = None,
    ifsc_code: Optional[str] = None
):
    """Create withdrawal request"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("kyc_status") != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    # Check balance
    balance_field = f"{wallet_type}_wallet_balance" if wallet_type == "profit" else "cashback_wallet_balance"
    balance = user.get(balance_field, 0)
    
    settings = await db.settings.find_one({})
    min_amount = settings.get("withdrawal_min_amount", 10.0)
    fee = settings.get("withdrawal_fee", 5.0)
    
    if amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal amount is ₹{min_amount}")
    
    if balance < amount + fee:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    withdrawal_data = {
        "withdrawal_id": str(uuid.uuid4()),
        "user_id": uid,
        "wallet_type": wallet_type,
        "amount": amount,
        "fee": fee,
        "net_amount": amount,
        "payment_mode": payment_mode,
        "upi_id": upi_id,
        "bank_account": bank_account,
        "ifsc_code": ifsc_code,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.withdrawals.insert_one(withdrawal_data)
    
    # Deduct from wallet
    await db.users.update_one(
        {"uid": uid},
        {"$inc": {balance_field: -(amount + fee)}}
    )
    
    return {"message": "Withdrawal request submitted", "withdrawal_id": withdrawal_data["withdrawal_id"]}

@api_router.get("/v2/withdrawals")
async def get_all_withdrawals(status: Optional[str] = None):
    """Get all withdrawal requests (Admin)"""
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"withdrawals": withdrawals}

@api_router.patch("/v2/withdrawal/{withdrawal_id}")
async def update_withdrawal(
    withdrawal_id: str,
    action: str,
    utr_number: Optional[str] = None,
    admin_notes: Optional[str] = None
):
    """Update withdrawal status (Admin)"""
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    update_data = {
        "status": action,
        "processed_at": datetime.now(timezone.utc).isoformat()
    }
    
    if utr_number:
        update_data["utr_number"] = utr_number
    if admin_notes:
        update_data["admin_notes"] = admin_notes
    
    # If rejected, refund to wallet
    if action == "rejected":
        balance_field = f"{withdrawal['wallet_type']}_wallet_balance" if withdrawal['wallet_type'] == "profit" else "cashback_wallet_balance"
        await db.users.update_one(
            {"uid": withdrawal["user_id"]},
            {"$inc": {balance_field: withdrawal["amount"] + withdrawal["fee"]}}
        )
    
    await db.withdrawals.update_one({"withdrawal_id": withdrawal_id}, {"$set": update_data})
    return {"message": f"Withdrawal {action}"}

# Profit Wallet Stats
@api_router.get("/v2/stockist/{stockist_id}/profit")
async def get_stockist_profit(stockist_id: str):
    """Get stockist profit wallet details"""
    stockist = await db.stockists.find_one({"stockist_id": stockist_id})
    if not stockist:
        raise HTTPException(status_code=404, detail="Stockist not found")
    
    # Get commission entries
    commissions = await db.commission_entries.find(
        {"entity_id": stockist["user_id"]},
        {"_id": 0}
    ).sort("credited_at", -1).to_list(100)
    
    total_earned = sum(c.get("amount", 0) for c in commissions)
    
    return {
        "stockist_id": stockist_id,
        "profit_wallet": stockist.get("profit_wallet", 0),
        "total_earned": total_earned,
        "commissions": commissions
    }

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()