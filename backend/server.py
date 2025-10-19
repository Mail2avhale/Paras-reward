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

# ========== RBAC UTILITIES ==========
class RolePermissions:
    """Define role-based permissions"""
    ADMIN_ROLES = ["admin", "sub_admin"]
    MANAGEMENT_ROLES = ["admin", "sub_admin", "manager"]
    EMPLOYEE_ROLES = ["admin", "sub_admin", "manager", "employee"]
    STOCKIST_ROLES = ["master_stockist", "sub_stockist", "outlet"]
    ALL_ROLES = ["admin", "sub_admin", "manager", "employee", "master_stockist", "sub_stockist", "outlet", "user"]

async def get_user_from_uid(uid: str):
    """Get user from database by UID"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def verify_role(uid: str, allowed_roles: List[str]):
    """Verify user has one of the allowed roles"""
    user = await get_user_from_uid(uid)
    user_role = user.get("role", "user")
    
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=403, 
            detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
        )
    
    return user

async def verify_admin(uid: str):
    """Verify user is admin or sub_admin"""
    return await verify_role(uid, RolePermissions.ADMIN_ROLES)

async def verify_management(uid: str):
    """Verify user is admin, sub_admin, or manager"""
    return await verify_role(uid, RolePermissions.MANAGEMENT_ROLES)

async def verify_stockist(uid: str):
    """Verify user is master_stockist, sub_stockist, or outlet"""
    return await verify_role(uid, RolePermissions.STOCKIST_ROLES)

def check_region_access(user: dict, target_region: str = None) -> bool:
    """Check if user has access to target region (for sub_admin)"""
    if user.get("role") == "admin":
        return True  # Admin has access to all regions
    
    if user.get("role") == "sub_admin":
        assigned_regions = user.get("assigned_regions", [])
        if target_region and target_region not in assigned_regions:
            return False
    
    return True

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
    mining_session_end: Optional[datetime] = None
    mining_active: bool = False
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

class OrderSingleProduct(BaseModel):
    """Legacy model for single product orders (deprecated - use Order for multi-item carts)"""
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
    """Count active referrals (with active mining sessions in last 24 hours)"""
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(hours=24)
    
    # Find referrals who:
    # 1. Were referred by this user
    # 2. Have logged in within 24 hours
    # 3. Have an active mining session (mining_active = True and session not expired)
    
    referrals = await db.users.find({
        "referred_by": uid,
        "last_login": {"$gte": yesterday.isoformat()},
        "mining_active": True
    }).to_list(length=None)
    
    # Additional check: ensure their mining session hasn't expired
    active_count = 0
    for referral in referrals:
        if referral.get("mining_start_time"):
            start_time = datetime.fromisoformat(referral["mining_start_time"]) if isinstance(referral["mining_start_time"], str) else referral["mining_start_time"]
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
            
            # Check if session is still within 24 hours
            if now < start_time + timedelta(hours=24):
                active_count += 1
    
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
@api_router.post("/auth/register/simple")
async def simple_register(request: Request):
    """Simplified registration - only email, password, and role required"""
    data = await request.json()
    
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "user")  # user, master_stockist, sub_stockist, outlet
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    # Validate email format
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create minimal user
    user_data = {
        "uid": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(password),
        "role": role,
        "name": email.split("@")[0],  # Use email prefix as temporary name
        "profile_complete": False,
        "profile_picture": None,
        "prc_balance": 0,
        "total_mined": 0,
        "cashback_wallet_balance": 0,
        "profit_wallet_balance": 0,
        "membership_type": "free",
        "kyc_status": "not_submitted",
        "is_active": True,
        "is_banned": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Generate referral code
    user_data["referral_code"] = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    
    await db.users.insert_one(user_data)
    
    return {
        "message": "Registration successful! Please complete your profile.",
        "uid": user_data["uid"],
        "profile_complete": False
    }

@api_router.post("/auth/register")
async def register_user(request: Request):
    """Enhanced user registration with duplicate checks"""
    data = await request.json()
    
    # Construct full name from first, middle, last name if provided
    if data.get('first_name') or data.get('last_name'):
        name_parts = []
        if data.get('first_name'):
            name_parts.append(data['first_name'])
        if data.get('middle_name'):
            name_parts.append(data['middle_name'])
        if data.get('last_name'):
            name_parts.append(data['last_name'])
        data['name'] = ' '.join(name_parts)
    
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
        "message": "Reset token generated",
        "reset_token": reset_token  # Remove in production
    }

# ========== USER PROFILE ROUTES ==========

@api_router.put("/user/{uid}/profile")
async def update_profile(uid: str, request: Request):
    """Update user profile"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    
    # Fields that can be updated
    updatable_fields = [
        "first_name", "middle_name", "last_name", "mobile",
        "state", "district", "taluka", "village", "pincode",
        "aadhaar_number", "pan_number", "upi_id"
    ]
    
    update_data = {}
    for field in updatable_fields:
        if field in data:
            update_data[field] = data[field]
    
    # Update name if name components changed
    if any(f in data for f in ["first_name", "middle_name", "last_name"]):
        name_parts = []
        if data.get('first_name') or user.get('first_name'):
            name_parts.append(data.get('first_name', user.get('first_name', '')))
        if data.get('middle_name') or user.get('middle_name'):
            name_parts.append(data.get('middle_name', user.get('middle_name', '')))
        if data.get('last_name') or user.get('last_name'):
            name_parts.append(data.get('last_name', user.get('last_name', '')))
        update_data['name'] = ' '.join(name_parts)
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": update_data}
    )
    
    return {"message": "Profile updated successfully"}

@api_router.post("/user/{uid}/change-password")
async def change_password(uid: str, request: Request):
    """Change user password"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Both passwords are required")
    
    # Verify current password
    if not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Password not set for this account")
    
    if not verify_password(current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Validate new password
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    new_hash = hash_password(new_password)
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "password_hash": new_hash,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password changed successfully"}

# ========== PASSWORD RESET ROUTES ==========

@api_router.post("/auth/reset-password-request")
async def reset_password_request(email: str):
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
    """Start 24-hour mining session"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    session_end = now + timedelta(hours=24)
    
    # Check if there's an active session
    if user.get("mining_start_time"):
        start_time = datetime.fromisoformat(user["mining_start_time"]) if isinstance(user["mining_start_time"], str) else user["mining_start_time"]
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        
        # If session is still active (less than 24 hours)
        if now < start_time + timedelta(hours=24):
            remaining_hours = ((start_time + timedelta(hours=24)) - now).total_seconds() / 3600
            return {
                "message": "Mining session already active",
                "session_active": True,
                "session_start": start_time.isoformat(),
                "session_end": (start_time + timedelta(hours=24)).isoformat(),
                "remaining_hours": round(remaining_hours, 2)
            }
    
    # Start new 24-hour session
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "mining_start_time": now.isoformat(),
            "mining_session_end": session_end.isoformat(),
            "mining_active": True,
            "last_login": now.isoformat()
        }}
    )
    
    return {
        "message": "Mining started successfully",
        "session_active": True,
        "session_start": now.isoformat(),
        "session_end": session_end.isoformat(),
        "remaining_hours": 24
    }

@api_router.get("/mining/status/{uid}")
async def get_mining_status(uid: str):
    """Get current mining status with session info"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    session_active = False
    remaining_hours = 0
    session_start = None
    session_end = None
    mined_this_session = 0
    
    # Check if mining session is active
    # Handle backward compatibility: mining_active can be True or None (for old sessions)
    mining_active = user.get("mining_active")
    if user.get("mining_start_time") and (mining_active is True or mining_active is None):
        start_time = datetime.fromisoformat(user["mining_start_time"]) if isinstance(user["mining_start_time"], str) else user["mining_start_time"]
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        
        session_end_time = start_time + timedelta(hours=24)
        
        # Check if session is still within 24 hours
        if now < session_end_time:
            session_active = True
            remaining_hours = (session_end_time - now).total_seconds() / 3600
            session_start = start_time.isoformat()
            session_end = session_end_time.isoformat()
            
            # Calculate mined coins during this session
            elapsed_minutes = (now - start_time).total_seconds() / 60
            rate_per_minute, base_rate, active_referrals = await calculate_mining_rate(uid)
            mined_this_session = elapsed_minutes * rate_per_minute
        else:
            # Session expired, mark as inactive
            await db.users.update_one(
                {"uid": uid},
                {"$set": {"mining_active": False}}
            )
    
    # Always calculate mining rate (potential rate even if not actively mining)
    rate_per_minute, base_rate, active_referrals = await calculate_mining_rate(uid)
    mining_rate_per_hour = rate_per_minute * 60
    
    return {
        "current_balance": user.get("prc_balance", 0),
        "mining_rate": mining_rate_per_hour,  # New field name
        "mining_rate_per_hour": mining_rate_per_hour,  # Backward compatibility
        "base_rate": base_rate,
        "active_referrals": active_referrals,
        "total_mined": user.get("total_mined", 0),
        "session_active": session_active,
        "remaining_hours": round(remaining_hours, 2) if session_active else 0,
        "session_start": session_start,
        "session_end": session_end,
        "mined_this_session": round(mined_this_session, 2),
        "is_mining": session_active
    }

@api_router.post("/mining/claim/{uid}")
async def claim_mining(uid: str):
    """Claim mined coins from current session"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if mining is active
    if not user.get("mining_active") or not user.get("mining_start_time"):
        raise HTTPException(status_code=400, detail="No active mining session")
    
    now = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(user["mining_start_time"]) if isinstance(user["mining_start_time"], str) else user["mining_start_time"]
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    
    # Check if session is still active
    session_end_time = start_time + timedelta(hours=24)
    if now >= session_end_time:
        # Session expired
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"mining_active": False}}
        )
        raise HTTPException(status_code=400, detail="Mining session expired. Please start a new session.")
    
    # Calculate mined coins
    elapsed_minutes = (now - start_time).total_seconds() / 60
    rate_per_minute, _, _ = await calculate_mining_rate(uid)
    mined_amount = elapsed_minutes * rate_per_minute
    
    # Update user balance
    new_balance = user.get("prc_balance", 0) + mined_amount
    new_total_mined = user.get("total_mined", 0) + mined_amount
    
    # Check if user is VIP for coin validity
    membership_type = user.get("membership_type", "free")
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "prc_balance": new_balance,
            "total_mined": new_total_mined,
            "mining_start_time": now.isoformat(),  # Reset session start for continuous mining
            "mining_active": True
        }}
    )
    
    return {
        "message": "Coins claimed successfully",
        "amount": round(mined_amount, 2),
        "new_balance": round(new_balance, 2),
        "membership_type": membership_type,
        "note": "Free users: coins valid for 24 hours only" if membership_type == "free" else "VIP: unlimited validity"
    }

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
    """Get user's referral code - generates one if missing"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate referral code if missing
    if not user.get("referral_code"):
        import secrets
        import string
        referral_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
        
        # Update user with new referral code
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"referral_code": referral_code}}
        )
        
        return {"referral_code": referral_code}
    
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

# ========== ORDER/REDEEM ROUTES (Legacy Single Product) ==========
@api_router.post("/orders/legacy/{uid}", response_model=OrderSingleProduct)
async def create_order(uid: str, order_data: OrderCreate):
    """Create order (Redeem product) - Legacy single product endpoint"""
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
    
    # Create order (using legacy single product model)
    order = OrderSingleProduct(
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

@api_router.get("/orders/legacy/{uid}", response_model=List[OrderSingleProduct])
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
async def deliver_order(order_id: str, request: Request):
    """Mark order as delivered (Outlet)"""
    data = await request.json()
    outlet_id = data.get("outlet_id")
    
    # Update order status
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": "delivered",
            "delivery_status": "delivered",
            "delivered_at": datetime.now(timezone.utc).isoformat(),
            "assigned_outlet": outlet_id
        }}
    )
    
    # Trigger automatic delivery charge distribution
    distribution_result = await distribute_delivery_charge(order_id)
    
    return {
        "message": "Order delivered successfully",
        "distribution": distribution_result
    }

# ========== WALLET ROUTES ==========
@api_router.get("/wallet/{uid}")
async def get_wallet(uid: str):
    """Get wallet balance and status"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if maintenance is due (30 days after VIP activation)
    maintenance_due = False
    days_until_maintenance = None
    
    if user.get("vip_activation_date") and user.get("membership_type") == "vip":
        vip_activation = user["vip_activation_date"]
        if isinstance(vip_activation, str):
            vip_activation = datetime.fromisoformat(vip_activation)
        
        last_maintenance = user.get("last_wallet_maintenance")
        if last_maintenance:
            if isinstance(last_maintenance, str):
                last_maintenance = datetime.fromisoformat(last_maintenance)
            next_maintenance = last_maintenance + timedelta(days=30)
        else:
            next_maintenance = vip_activation + timedelta(days=30)
        
        now = datetime.now(timezone.utc)
        if now >= next_maintenance:
            maintenance_due = True
            days_until_maintenance = 0
        else:
            days_until_maintenance = (next_maintenance - now).days
    
    return {
        "cashback_balance": user.get("cashback_wallet_balance", 0),
        "profit_balance": user.get("profit_wallet_balance", 0),
        "prc_balance": user.get("prc_balance", 0),
        "wallet_status": user.get("wallet_status", "active"),
        "pending_lien": user.get("wallet_maintenance_due", 0),
        "last_maintenance": user.get("last_wallet_maintenance"),
        "maintenance_due": maintenance_due,
        "days_until_maintenance": days_until_maintenance,
        "maintenance_fee": 99.0
    }

@api_router.post("/wallet/check-maintenance/{uid}")
async def check_and_apply_maintenance(uid: str):
    """Check and apply monthly maintenance fee (₹99) - called when adding cashback"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only for VIP users
    if user.get("membership_type") != "vip":
        return {"maintenance_applied": False, "message": "Not a VIP user"}
    
    vip_activation = user.get("vip_activation_date")
    if not vip_activation:
        return {"maintenance_applied": False, "message": "VIP activation date not set"}
    
    if isinstance(vip_activation, str):
        vip_activation = datetime.fromisoformat(vip_activation)
    
    last_maintenance = user.get("last_wallet_maintenance")
    if last_maintenance:
        if isinstance(last_maintenance, str):
            last_maintenance = datetime.fromisoformat(last_maintenance)
        next_maintenance_due = last_maintenance + timedelta(days=30)
    else:
        next_maintenance_due = vip_activation + timedelta(days=30)
    
    now = datetime.now(timezone.utc)
    
    # Check if 30 days have passed
    if now >= next_maintenance_due:
        pending_lien = user.get("wallet_maintenance_due", 0)
        new_lien = pending_lien + 99.0
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "wallet_maintenance_due": new_lien,
                "last_wallet_maintenance": now.isoformat(),
                "wallet_status": "lien_pending" if new_lien > 0 else "active"
            }}
        )
        
        return {
            "maintenance_applied": True,
            "amount": 99.0,
            "total_lien": new_lien,
            "message": f"₹99 maintenance fee applied. Total pending lien: ₹{new_lien}"
        }
    
    return {"maintenance_applied": False, "message": "Maintenance not yet due"}

@api_router.post("/wallet/credit-cashback/{uid}")
async def credit_cashback(uid: str, request: Request):
    """Credit cashback to wallet (clears lien first)"""
    data = await request.json()
    amount = data.get("amount", 0)
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_balance = user.get("cashback_wallet_balance", 0)
    pending_lien = user.get("wallet_maintenance_due", 0)
    
    # Clear lien first
    if pending_lien > 0:
        if amount >= pending_lien:
            # Clear all lien
            remaining_amount = amount - pending_lien
            new_balance = current_balance + remaining_amount
            new_lien = 0
            wallet_status = "active"
            message = f"₹{amount} credited. ₹{pending_lien} used to clear lien. ₹{remaining_amount} added to balance."
        else:
            # Partial lien clearing
            new_balance = current_balance
            new_lien = pending_lien - amount
            wallet_status = "lien_pending"
            message = f"₹{amount} used to partially clear lien. Remaining lien: ₹{new_lien}"
    else:
        # No lien, add directly to balance
        new_balance = current_balance + amount
        new_lien = 0
        wallet_status = "active"
        message = f"₹{amount} credited to cashback wallet"
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "cashback_wallet_balance": new_balance,
            "wallet_maintenance_due": new_lien,
            "wallet_status": wallet_status
        }}
    )
    
    return {
        "message": message,
        "credited_amount": amount,
        "lien_cleared": pending_lien - new_lien if pending_lien > 0 else 0,
        "new_balance": new_balance,
        "remaining_lien": new_lien
    }

@api_router.post("/wallet/cashback/withdraw")
async def request_cashback_withdrawal(request: Request):
    """Request cashback wallet withdrawal"""
    data = await request.json()
    user_id = data.get("user_id")
    amount = data.get("amount", 0)
    payment_mode = data.get("payment_mode", "upi")
    upi_id = data.get("upi_id")
    bank_account = data.get("bank_account")
    ifsc_code = data.get("ifsc_code")
    
    # Validate
    if amount < 10:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is ₹10")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check KYC
    if user.get("kyc_status") != "verified":
        raise HTTPException(status_code=403, detail="KYC verification required for withdrawals")
    
    # Check balance (amount + fee)
    cashback_balance = user.get("cashback_wallet_balance", 0)
    total_required = amount + 5  # ₹5 fee
    
    if cashback_balance < total_required:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Required: ₹{total_required} (including ₹5 fee)")
    
    # Check if there's pending lien
    pending_lien = user.get("wallet_maintenance_due", 0)
    if pending_lien > 0:
        raise HTTPException(status_code=400, detail=f"Cannot withdraw. Pending maintenance lien: ₹{pending_lien}")
    
    # Create withdrawal request
    withdrawal = {
        "withdrawal_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "wallet_type": "cashback",
        "amount": amount,
        "fee": 5.0,
        "net_amount": amount - 5,
        "payment_mode": payment_mode,
        "upi_id": upi_id,
        "bank_account": bank_account,
        "ifsc_code": ifsc_code,
        "status": "pending",
        "utr_number": None,
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None
    }
    
    # Deduct from balance immediately (hold)
    await db.users.update_one(
        {"uid": user_id},
        {"$inc": {"cashback_wallet_balance": -total_required}}
    )
    
    # Insert withdrawal request
    await db.cashback_withdrawals.insert_one(withdrawal)
    
    return {
        "message": "Withdrawal request submitted successfully",
        "withdrawal_id": withdrawal["withdrawal_id"],
        "amount": amount,
        "fee": 5.0,
        "net_amount": amount - 5,
        "status": "pending"
    }

@api_router.post("/wallet/profit/withdraw")
async def request_profit_withdrawal(request: Request):
    """Request profit wallet withdrawal (for stockists/outlets)"""
    data = await request.json()
    user_id = data.get("user_id")
    amount = data.get("amount", 0)
    payment_mode = data.get("payment_mode", "upi")
    upi_id = data.get("upi_id")
    bank_account = data.get("bank_account")
    ifsc_code = data.get("ifsc_code")
    
    # Validate
    if amount < 50:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is ₹50")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check role
    if user.get("role") not in ["master_stockist", "sub_stockist", "outlet"]:
        raise HTTPException(status_code=403, detail="Only stockists and outlets can withdraw from profit wallet")
    
    # Check balance (amount + fee)
    profit_balance = user.get("profit_wallet_balance", 0)
    total_required = amount + 5  # ₹5 fee
    
    if profit_balance < total_required:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Required: ₹{total_required} (including ₹5 fee)")
    
    # Create withdrawal request
    withdrawal = {
        "withdrawal_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "entity_type": user.get("role"),
        "wallet_type": "profit",
        "amount": amount,
        "fee": 5.0,
        "net_amount": amount - 5,
        "payment_mode": payment_mode,
        "upi_id": upi_id,
        "bank_account": bank_account,
        "ifsc_code": ifsc_code,
        "status": "pending",
        "utr_number": None,
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None
    }
    
    # Deduct from balance immediately (hold)
    await db.users.update_one(
        {"uid": user_id},
        {"$inc": {"profit_wallet_balance": -total_required}}
    )
    
    # Insert withdrawal request
    await db.profit_withdrawals.insert_one(withdrawal)
    
    return {
        "message": "Withdrawal request submitted successfully",
        "withdrawal_id": withdrawal["withdrawal_id"],
        "amount": amount,
        "fee": 5.0,
        "net_amount": amount - 5,
        "status": "pending"
    }

@api_router.get("/wallet/withdrawals/{uid}")
async def get_user_withdrawals(uid: str):
    """Get user's withdrawal history"""
    cashback_withdrawals = await db.cashback_withdrawals.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    profit_withdrawals = await db.profit_withdrawals.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "cashback_withdrawals": cashback_withdrawals,
        "profit_withdrawals": profit_withdrawals
    }

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

# ========== ADMIN USER MANAGEMENT ROUTES ==========

@api_router.get("/admin/check-admin-exists")
async def check_admin_exists():
    """Check if any admin user exists in the system"""
    admin = await db.users.find_one({"role": "admin"})
    return {"admin_exists": admin is not None}

@api_router.post("/admin/create-first-admin")
async def create_first_admin(request: Request):
    """Create the first admin user - only works if no admin exists"""
    # Check if admin already exists
    existing_admin = await db.users.find_one({"role": "admin"})
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin user already exists")
    
    data = await request.json()
    
    # Validate required fields
    required_fields = ["email", "password", "first_name", "last_name", "mobile"]
    for field in required_fields:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"{field} is required")
    
    # Check if email or mobile already exists
    existing_user = await db.users.find_one({
        "$or": [
            {"email": data["email"]},
            {"mobile": data["mobile"]}
        ]
    })
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Email or mobile already registered")
    
    # Construct name
    name_parts = [data["first_name"]]
    if data.get("middle_name"):
        name_parts.append(data["middle_name"])
    name_parts.append(data["last_name"])
    data["name"] = " ".join(name_parts)
    
    # Hash password
    data["password_hash"] = hash_password(data["password"])
    del data["password"]
    
    # Set role to admin
    data["role"] = "admin"
    
    # Create admin user
    user = User(**data)
    user_dict = user.model_dump()
    
    # Convert datetime fields
    for field in ["created_at", "updated_at", "last_login"]:
        if user_dict.get(field):
            user_dict[field] = user_dict[field].isoformat()
    
    await db.users.insert_one(user_dict)
    
    return {
        "message": "Admin user created successfully",
        "uid": user.uid,
        "email": user.email
    }

@api_router.get("/admin/users")
async def get_all_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get all users with optional filtering (Admin only)"""
    query = {}
    
    # Filter by role
    if role:
        query["role"] = role
    
    # Search by name, email, or mobile
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db.users.count_documents(query)
    
    # Get users
    users = await db.users.find(query).skip(skip).limit(limit).to_list(length=limit)
    
    # Remove sensitive data
    for user in users:
        user.pop("password_hash", None)
        user.pop("reset_token", None)
        user["_id"] = str(user["_id"])
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "users": users
    }

@api_router.put("/admin/users/{uid}/role")
async def update_user_role(uid: str, request: Request):
    """Update user role (Admin only)"""
    data = await request.json()
    new_role = data.get("role")
    
    # Validate role
    valid_roles = ["user", "admin", "master_stockist", "sub_stockist", "outlet"]
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    # Find user
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update role
    result = await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "role": new_role,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count > 0:
        return {"message": f"User role updated to {new_role}", "uid": uid, "role": new_role}
    else:
        return {"message": "No changes made", "uid": uid, "role": new_role}

@api_router.put("/admin/users/{uid}/status")
async def update_user_status(uid: str, request: Request):
    """Activate or deactivate user account (Admin only)"""
    data = await request.json()
    is_active = data.get("is_active")
    
    if is_active is None:
        raise HTTPException(status_code=400, detail="is_active field is required")
    
    # Find user
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update status
    result = await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "is_active": is_active,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    status_text = "activated" if is_active else "deactivated"
    return {"message": f"User {status_text} successfully", "uid": uid, "is_active": is_active}

@api_router.delete("/admin/users/{uid}")
async def delete_user(uid: str):
    """Delete a user (Admin only) - Use with caution"""
    # Find user
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting the last admin
    if user.get("role") == "admin":
        admin_count = await db.users.count_documents({"role": "admin"})
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin user")
    
    # Delete user
    result = await db.users.delete_one({"uid": uid})
    
    return {"message": "User deleted successfully", "uid": uid}

@api_router.get("/admin/users/{uid}")
async def get_user_details(uid: str):
    """Get detailed user information (Admin only)"""
    user = await db.users.find_one({"uid": uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove sensitive data
    user.pop("password_hash", None)
    user.pop("reset_token", None)
    user["_id"] = str(user["_id"])
    
    return user

# ========== VIP MEMBERSHIP & PAYMENT CONFIGURATION ==========

@api_router.get("/admin/payment-config")
async def get_payment_config():
    """Get admin payment configuration"""
    config = await db.payment_config.find_one({})
    if not config:
        # Return default empty config
        return {
            "upi_id": "",
            "qr_code_url": "",
            "bank_name": "",
            "account_number": "",
            "ifsc_code": "",
            "account_holder": "",
            "instructions": "Please upload payment proof after making the payment."
        }
    config["_id"] = str(config["_id"])
    return config

@api_router.post("/admin/payment-config")
async def update_payment_config(request: Request):
    """Update admin payment configuration"""
    data = await request.json()
    
    # Check if config exists
    existing = await db.payment_config.find_one({})
    
    if existing:
        # Update existing
        await db.payment_config.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "upi_id": data.get("upi_id", ""),
                "qr_code_url": data.get("qr_code_url", ""),
                "bank_name": data.get("bank_name", ""),
                "account_number": data.get("account_number", ""),
                "ifsc_code": data.get("ifsc_code", ""),
                "account_holder": data.get("account_holder", ""),
                "instructions": data.get("instructions", ""),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Create new
        await db.payment_config.insert_one({
            "upi_id": data.get("upi_id", ""),
            "qr_code_url": data.get("qr_code_url", ""),
            "bank_name": data.get("bank_name", ""),
            "account_number": data.get("account_number", ""),
            "ifsc_code": data.get("ifsc_code", ""),
            "account_holder": data.get("account_holder", ""),
            "instructions": data.get("instructions", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Payment configuration updated successfully"}

@api_router.post("/membership/submit-payment")
async def submit_vip_payment(request: Request):
    """Submit VIP payment proof"""
    data = await request.json()
    
    # Validate required fields
    required_fields = ["user_id", "amount", "date", "time", "utr_number"]
    for field in required_fields:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"{field} is required")
    
    # Validate amount (should be ₹1000)
    if float(data["amount"]) != 1000:
        raise HTTPException(status_code=400, detail="VIP membership costs ₹1000")
    
    # Check if user already has pending payment
    existing = await db.vip_payments.find_one({
        "user_id": data["user_id"],
        "status": "pending"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending payment request")
    
    # Create payment record
    payment_id = str(uuid.uuid4())
    payment_record = {
        "payment_id": payment_id,
        "user_id": data["user_id"],
        "amount": float(data["amount"]),
        "date": data["date"],
        "time": data["time"],
        "utr_number": data["utr_number"],
        "screenshot_url": data.get("screenshot_url", ""),
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": None,
        "approved_by": None
    }
    
    await db.vip_payments.insert_one(payment_record)
    
    return {
        "message": "Payment submitted successfully. Please wait for admin approval.",
        "payment_id": payment_id,
        "status": "pending"
    }

@api_router.get("/membership/payments")
async def get_vip_payments(status: Optional[str] = None):
    """Get all VIP payment requests (Admin)"""
    query = {}
    if status:
        query["status"] = status
    
    payments = await db.vip_payments.find(query).sort("submitted_at", -1).to_list(length=None)
    
    for payment in payments:
        payment["_id"] = str(payment["_id"])
    
    return payments

@api_router.get("/membership/payment/{user_id}")
async def get_user_payment_status(user_id: str):
    """Get user's VIP payment status"""
    payment = await db.vip_payments.find_one(
        {"user_id": user_id},
        sort=[("submitted_at", -1)]
    )
    
    if payment:
        payment["_id"] = str(payment["_id"])
        return payment
    
    return {"status": "none", "message": "No payment submitted"}

@api_router.post("/membership/payment/{payment_id}/action")
async def handle_payment_action(payment_id: str, request: Request):
    """Approve or reject VIP payment (Admin)"""
    data = await request.json()
    action = data.get("action")  # "approve" or "reject"
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    # Find payment
    payment = await db.vip_payments.find_one({"payment_id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] != "pending":
        raise HTTPException(status_code=400, detail="Payment already processed")
    
    now = datetime.now(timezone.utc)
    
    if action == "approve":
        # Update payment status
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "approved",
                "approved_at": now.isoformat()
            }}
        )
        
        # Update user membership
        expiry_date = now + timedelta(days=365)  # 1 year
        await db.users.update_one(
            {"uid": payment["user_id"]},
            {"$set": {
                "membership_type": "vip",
                "membership_expiry": expiry_date.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        
        return {
            "message": "Payment approved. User upgraded to VIP.",
            "membership_expiry": expiry_date.isoformat()
        }
    else:
        # Reject payment
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "rejected",
                "rejected_at": now.isoformat()
            }}
        )
        
        return {"message": "Payment rejected"}

# ========== PRODUCT & MARKETPLACE MODELS ==========

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    sku: str
    description: Optional[str] = None
    prc_price: float  # Price in PRC coins
    cash_price: float  # Delivery/transaction fee in ₹
    type: str  # physical or digital
    category: Optional[str] = None
    image_url: Optional[str] = None
    
    # Stock & Allocation
    total_stock: int = 0
    available_stock: int = 0
    allocated_to: Optional[str] = None  # master/sub/outlet ID
    
    # Visibility
    visible: bool = True
    regions: Optional[list] = []  # List of states/regions
    vip_only: bool = False
    visible_from: Optional[datetime] = None
    visible_till: Optional[datetime] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class CartItem(BaseModel):
    product_id: str
    quantity: int
    prc_price: float
    cash_price: float

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    order_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: list  # List of cart items
    
    # Pricing
    total_prc: float
    total_cash: float
    delivery_charge: float
    cashback_amount: float  # 25% of PRC value in ₹
    
    # Secret Code
    secret_code: str = Field(default_factory=lambda: ''.join(secrets.choice(string.digits) for _ in range(6)))
    
    # Assignment
    assigned_outlet: Optional[str] = None
    
    # Status
    status: str = "pending"  # pending, confirmed, delivered, cancelled
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    
    # Delivery
    delivery_address: Optional[str] = None
    delivery_status: str = "pending"  # pending, assigned, in_transit, delivered

# ========== PRODUCT MANAGEMENT (ADMIN) ==========

@api_router.post("/admin/products")
async def create_product(request: Request):
    """Create new product (Admin)"""
    data = await request.json()
    
    # Validate required fields
    required = ["name", "sku", "prc_price", "cash_price", "type"]
    for field in required:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"{field} is required")
    
    # Check if SKU already exists
    existing = await db.products.find_one({"sku": data["sku"]})
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    product = Product(**data)
    product_dict = product.model_dump()
    
    # Convert datetime fields
    for field in ["created_at", "updated_at", "visible_from", "visible_till"]:
        if product_dict.get(field):
            product_dict[field] = product_dict[field].isoformat() if isinstance(product_dict[field], datetime) else product_dict[field]
    
    await db.products.insert_one(product_dict)
    
    return {"message": "Product created successfully", "product_id": product.product_id}

@api_router.get("/admin/products")
async def get_all_products_admin():
    """Get all products (Admin)"""
    products = await db.products.find().to_list(length=None)
    for product in products:
        product["_id"] = str(product["_id"])
    return products

@api_router.put("/admin/products/{product_id}")
async def update_product(product_id: str, request: Request):
    """Update product (Admin)"""
    data = await request.json()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.products.update_one(
        {"product_id": product_id},
        {"$set": data}
    )
    
    return {"message": "Product updated successfully"}

@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str):
    """Delete product (Admin)"""
    await db.products.delete_one({"product_id": product_id})
    return {"message": "Product deleted successfully"}

# ========== MARKETPLACE (USER) ==========

@api_router.get("/marketplace/products")
async def get_marketplace_products(user_id: str):
    """Get visible products for user based on visibility rules"""
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    is_vip = user.get("membership_type") == "vip"
    user_state = user.get("state")
    
    # Build query
    query = {"visible": True}
    
    # Check scheduled visibility
    query["$or"] = [
        {"visible_from": None},
        {"visible_from": {"$lte": now.isoformat()}}
    ]
    
    products = await db.products.find(query).to_list(length=None)
    
    # Filter products based on rules
    visible_products = []
    for product in products:
        # Check visibility till
        if product.get("visible_till"):
            if datetime.fromisoformat(product["visible_till"]) < now:
                continue
        
        # Check VIP only
        if product.get("vip_only") and not is_vip:
            continue
        
        # Check region
        if product.get("regions") and len(product["regions"]) > 0:
            if user_state not in product["regions"]:
                continue
        
        # Check stock
        if product.get("available_stock", 0) <= 0:
            continue
        
        product["_id"] = str(product["_id"])
        visible_products.append(product)
    
    return visible_products

# ========== CART MANAGEMENT ==========

@api_router.post("/cart/add")
async def add_to_cart(request: Request):
    """Add item to cart"""
    data = await request.json()
    user_id = data.get("user_id")
    product_id = data.get("product_id")
    quantity = data.get("quantity", 1)
    
    # Get product
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check stock
    if product.get("available_stock", 0) < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    # Get or create cart
    cart = await db.carts.find_one({"user_id": user_id})
    
    if not cart:
        # Create new cart
        cart = {
            "cart_id": str(uuid.uuid4()),
            "user_id": user_id,
            "items": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Check if product already in cart
    existing_item = None
    for item in cart.get("items", []):
        if item["product_id"] == product_id:
            existing_item = item
            break
    
    if existing_item:
        # Update quantity
        existing_item["quantity"] += quantity
    else:
        # Add new item
        cart["items"].append({
            "product_id": product_id,
            "product_name": product["name"],
            "quantity": quantity,
            "prc_price": product["prc_price"],
            "cash_price": product["cash_price"],
            "image_url": product.get("image_url")
        })
    
    # Save cart
    if "_id" in cart:
        await db.carts.update_one(
            {"user_id": user_id},
            {"$set": {"items": cart["items"], "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.carts.insert_one(cart)
    
    # Remove MongoDB ObjectId for JSON serialization
    if "_id" in cart:
        cart["_id"] = str(cart["_id"])
    
    return {"message": "Item added to cart", "cart": cart}

@api_router.get("/cart/{user_id}")
async def get_cart(user_id: str):
    """Get user's cart"""
    cart = await db.carts.find_one({"user_id": user_id})
    if cart:
        cart["_id"] = str(cart["_id"])
    return cart or {"items": []}

@api_router.delete("/cart/{user_id}/item/{product_id}")
async def remove_from_cart(user_id: str, product_id: str):
    """Remove item from cart"""
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart["items"] = [item for item in cart["items"] if item["product_id"] != product_id]
    
    await db.carts.update_one(
        {"user_id": user_id},
        {"$set": {"items": cart["items"]}}
    )
    
    return {"message": "Item removed from cart"}

@api_router.delete("/cart/{user_id}")
async def clear_cart(user_id: str):
    """Clear entire cart"""
    await db.carts.delete_one({"user_id": user_id})
    return {"message": "Cart cleared"}

# ========== ORDER & CHECKOUT ==========

@api_router.post("/orders/checkout")
async def checkout(request: Request):
    """Checkout cart and create order with single secret code"""
    data = await request.json()
    user_id = data.get("user_id")
    delivery_address = data.get("delivery_address")
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check VIP status
    if user.get("membership_type") != "vip":
        raise HTTPException(status_code=403, detail="VIP membership required for marketplace access")
    
    # Get cart
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart or len(cart.get("items", [])) == 0:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Calculate totals
    total_prc = sum(item["prc_price"] * item["quantity"] for item in cart["items"])
    total_cash = sum(item["cash_price"] * item["quantity"] for item in cart["items"])
    
    # Get delivery charge configuration (default 10%)
    delivery_config = await db.system_config.find_one({"config_type": "delivery"})
    delivery_percentage = delivery_config.get("delivery_charge_rate", 0.10) if delivery_config else 0.10
    delivery_charge = total_cash * delivery_percentage
    
    # Calculate cashback (25% of PRC value converted to ₹, 10 PRC = ₹1)
    cashback_amount = (total_prc * 0.25) / 10
    
    # Check if user has enough PRC
    if user.get("prc_balance", 0) < total_prc:
        raise HTTPException(status_code=400, detail="Insufficient PRC balance")
    
    # Atomic PRC deduction
    new_prc_balance = user["prc_balance"] - total_prc
    
    # Handle delivery charge from cashback wallet
    cashback_balance = user.get("cash_wallet_balance", 0)
    delivery_charge_paid = 0
    delivery_charge_lien = 0
    
    if cashback_balance >= delivery_charge:
        # Deduct from cashback wallet
        delivery_charge_paid = delivery_charge
        new_cashback_balance = cashback_balance - delivery_charge
    else:
        # Partial payment or lien
        delivery_charge_paid = cashback_balance
        delivery_charge_lien = delivery_charge - cashback_balance
        new_cashback_balance = 0
    
    # Add cashback from this order
    new_cashback_balance += cashback_amount
    
    # Create order
    order = Order(
        user_id=user_id,
        items=cart["items"],
        total_prc=total_prc,
        total_cash=total_cash,
        delivery_charge=delivery_charge,
        cashback_amount=cashback_amount,
        delivery_address=delivery_address
    )
    
    order_dict = order.model_dump()
    order_dict["created_at"] = order_dict["created_at"].isoformat()
    order_dict["delivery_charge_paid"] = delivery_charge_paid
    order_dict["delivery_charge_lien"] = delivery_charge_lien
    
    # Update user balances
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {
            "prc_balance": new_prc_balance,
            "cash_wallet_balance": new_cashback_balance
        }}
    )
    
    # Update product stock
    for item in cart["items"]:
        await db.products.update_one(
            {"product_id": item["product_id"]},
            {"$inc": {"available_stock": -item["quantity"]}}
        )
    
    # Save order
    await db.orders.insert_one(order_dict)
    
    # Clear cart
    await db.carts.delete_one({"user_id": user_id})
    
    return {
        "message": "Order placed successfully",
        "order_id": order.order_id,
        "secret_code": order.secret_code,
        "total_prc": total_prc,
        "cashback_earned": cashback_amount,
        "delivery_charge": delivery_charge,
        "delivery_charge_paid": delivery_charge_paid,
        "delivery_charge_lien": delivery_charge_lien
    }

@api_router.get("/orders/user/{user_id}")
async def get_user_orders(user_id: str):
    """Get all orders for user"""
    orders = await db.orders.find({"user_id": user_id}).sort("created_at", -1).to_list(length=None)
    for order in orders:
        order["_id"] = str(order["_id"])
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    """Get order details"""
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order["_id"] = str(order["_id"])
    return order

# ========== DELIVERY CHARGE CONFIGURATION & DISTRIBUTION ==========

@api_router.get("/admin/delivery-config")
async def get_delivery_config():
    """Get delivery charge configuration"""
    config = await db.system_config.find_one({"config_type": "delivery"})
    if not config:
        # Return default config
        return {
            "delivery_charge_rate": 0.10,  # 10%
            "distribution_split": {
                "master": 10,
                "sub": 20,
                "outlet": 60,
                "company": 10
            }
        }
    config["_id"] = str(config["_id"])
    return config

@api_router.post("/admin/delivery-config")
async def update_delivery_config(request: Request):
    """Update delivery charge configuration (Admin)"""
    data = await request.json()
    
    # Validate delivery charge rate
    rate = data.get("delivery_charge_rate")
    if rate is None or rate < 0 or rate > 1:
        raise HTTPException(status_code=400, detail="Delivery charge rate must be between 0 and 1")
    
    # Validate distribution split
    split = data.get("distribution_split", {})
    total = sum(split.values())
    if abs(total - 100) > 0.01:  # Allow small floating point errors
        raise HTTPException(status_code=400, detail=f"Distribution split must sum to 100%, got {total}%")
    
    # Check if config exists
    existing = await db.system_config.find_one({"config_type": "delivery"})
    
    config_data = {
        "config_type": "delivery",
        "delivery_charge_rate": rate,
        "distribution_split": split,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing:
        await db.system_config.update_one(
            {"config_type": "delivery"},
            {"$set": config_data}
        )
    else:
        config_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.system_config.insert_one(config_data)
    
    return {"message": "Delivery configuration updated successfully"}

@api_router.post("/orders/{order_id}/distribute-delivery-charge")
async def distribute_delivery_charge(order_id: str):
    """Distribute delivery charge to entities (Idempotent)"""
    # Find order
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if already distributed
    if order.get("delivery_charge_distributed"):
        return {
            "message": "Delivery charge already distributed",
            "order_id": order_id,
            "already_distributed": True
        }
    
    # Check if order is delivered
    if order.get("status") != "delivered":
        raise HTTPException(status_code=400, detail="Order must be delivered before distribution")
    
    # Get delivery charge
    delivery_charge = order.get("delivery_charge", 0)
    if delivery_charge <= 0:
        return {"message": "No delivery charge to distribute"}
    
    # Get distribution configuration
    config = await db.system_config.find_one({"config_type": "delivery"})
    if not config:
        # Use default split
        split = {"master": 10, "sub": 20, "outlet": 60, "company": 10}
    else:
        split = config.get("distribution_split", {})
    
    # Get order chain (outlet -> sub -> master)
    outlet_id = order.get("assigned_outlet")
    
    # For now, use placeholder IDs (in production, fetch actual entities)
    # TODO: Implement proper entity chain lookup
    
    # Calculate distribution amounts
    distributions = {}
    for entity, percentage in split.items():
        amount = (delivery_charge * percentage) / 100
        distributions[entity] = amount
    
    # Create commission entries and credit wallets
    commission_records = []
    now = datetime.now(timezone.utc).isoformat()
    
    for entity, amount in distributions.items():
        if amount > 0:
            # Create commission record
            commission_record = {
                "commission_id": str(uuid.uuid4()),
                "order_id": order_id,
                "entity_type": entity,
                "entity_id": outlet_id if entity == "outlet" else f"{entity}_placeholder",
                "amount": amount,
                "type": "delivery_charge",
                "status": "credited",
                "created_at": now
            }
            commission_records.append(commission_record)
            
            # Credit profit wallet automatically (if not company and wallet not frozen)
            if entity != "company":
                if entity == "outlet" and outlet_id:
                    # Check if outlet's profit wallet is frozen (overdue renewal)
                    outlet_user = await db.users.find_one({"uid": outlet_id})
                    if outlet_user and not outlet_user.get("profit_wallet_frozen", False):
                        # Credit outlet's profit wallet
                        await db.users.update_one(
                            {"uid": outlet_id, "role": "outlet"},
                            {"$inc": {"profit_wallet_balance": amount}}
                        )
                elif entity == "master":
                    # In production: Get order's master stockist and credit (check frozen status)
                    # For now, using placeholder - will be enhanced later
                    pass
                elif entity == "sub":
                    # In production: Get order's sub stockist and credit (check frozen status)
                    # For now, using placeholder - will be enhanced later
                    pass
    
    # Insert all commission records
    if commission_records:
        await db.commissions_earned.insert_many(commission_records)
    
    # Mark order as distributed
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "delivery_charge_distributed": True,
            "distribution_date": now,
            "distribution_amounts": distributions
        }}
    )
    
    return {
        "message": "Delivery charge distributed successfully",
        "order_id": order_id,
        "delivery_charge": delivery_charge,
        "distributions": distributions,
        "commission_records": len(commission_records)
    }

@api_router.get("/commissions/entity/{entity_id}")
async def get_entity_commissions(entity_id: str):
    """Get commission history for an entity"""
    commissions = await db.commissions_earned.find(
        {"entity_id": entity_id}
    ).sort("created_at", -1).to_list(length=None)
    
    for commission in commissions:
        commission["_id"] = str(commission["_id"])
    
    # Calculate totals
    total_earned = sum(c["amount"] for c in commissions)
    
    return {
        "entity_id": entity_id,
        "total_commissions": len(commissions),
        "total_earned": total_earned,
        "commissions": commissions
    }

# Update outlet verification to trigger distribution
@api_router.post("/outlet/verify-code")
async def verify_secret_code(request: Request):
    """Verify secret code and mark order as delivered"""
    data = await request.json()
    secret_code = data.get("secret_code")
    outlet_id = data.get("outlet_id")
    
    # Find order by secret code
    order = await db.orders.find_one({"secret_code": secret_code, "status": "pending"})
    
    if not order:
        raise HTTPException(status_code=404, detail="Invalid or already used secret code")
    
    # Mark as delivered
    now = datetime.now(timezone.utc)
    await db.orders.update_one(
        {"order_id": order["order_id"]},
        {"$set": {
            "status": "delivered",
            "delivery_status": "delivered",
            "delivered_at": now.isoformat(),
            "assigned_outlet": outlet_id
        }}
    )
    
    # Trigger delivery charge distribution
    distribution_result = await distribute_delivery_charge(order["order_id"])
    
    return {
        "message": "Order verified and marked as delivered",
        "order_id": order["order_id"],
        "items": order["items"],
        "total_prc": order["total_prc"],
        "distribution": distribution_result
    }

# ========== ADMIN WITHDRAWAL MANAGEMENT ==========
@api_router.get("/admin/withdrawals/cashback")
async def get_cashback_withdrawals(status: str = None):
    """Get all cashback withdrawal requests (optionally filtered by status)"""
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.cashback_withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"withdrawals": withdrawals, "count": len(withdrawals)}

@api_router.get("/admin/withdrawals/profit")
async def get_profit_withdrawals(status: str = None):
    """Get all profit withdrawal requests (optionally filtered by status)"""
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.profit_withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"withdrawals": withdrawals, "count": len(withdrawals)}

@api_router.post("/admin/withdrawals/cashback/{withdrawal_id}/approve")
async def approve_cashback_withdrawal(withdrawal_id: str, request: Request):
    """Approve cashback withdrawal request"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "")
    
    withdrawal = await db.cashback_withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {withdrawal['status']}")
    
    await db.cashback_withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "approved",
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Withdrawal approved", "withdrawal_id": withdrawal_id}

@api_router.post("/admin/withdrawals/cashback/{withdrawal_id}/reject")
async def reject_cashback_withdrawal(withdrawal_id: str, request: Request):
    """Reject cashback withdrawal request and refund to wallet"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "Rejected by admin")
    
    withdrawal = await db.cashback_withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {withdrawal['status']}")
    
    # Refund amount + fee back to user's cashback wallet
    total_refund = withdrawal["amount"] + withdrawal["fee"]
    await db.users.update_one(
        {"uid": withdrawal["user_id"]},
        {"$inc": {"cashback_wallet_balance": total_refund}}
    )
    
    await db.cashback_withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Withdrawal rejected and refunded", "withdrawal_id": withdrawal_id, "refunded_amount": total_refund}

@api_router.post("/admin/withdrawals/cashback/{withdrawal_id}/complete")
async def complete_cashback_withdrawal(withdrawal_id: str, request: Request):
    """Mark cashback withdrawal as completed with UTR"""
    data = await request.json()
    utr_number = data.get("utr_number", "")
    admin_notes = data.get("admin_notes", "")
    
    if not utr_number:
        raise HTTPException(status_code=400, detail="UTR number is required")
    
    withdrawal = await db.cashback_withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail=f"Cannot complete withdrawal with status {withdrawal['status']}")
    
    await db.cashback_withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "completed",
            "utr_number": utr_number,
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Withdrawal completed", "withdrawal_id": withdrawal_id, "utr_number": utr_number}

@api_router.post("/admin/withdrawals/profit/{withdrawal_id}/approve")
async def approve_profit_withdrawal(withdrawal_id: str, request: Request):
    """Approve profit withdrawal request"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "")
    
    withdrawal = await db.profit_withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {withdrawal['status']}")
    
    await db.profit_withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "approved",
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Withdrawal approved", "withdrawal_id": withdrawal_id}

@api_router.post("/admin/withdrawals/profit/{withdrawal_id}/reject")
async def reject_profit_withdrawal(withdrawal_id: str, request: Request):
    """Reject profit withdrawal request and refund to wallet"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "Rejected by admin")
    
    withdrawal = await db.profit_withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {withdrawal['status']}")
    
    # Refund amount + fee back to user's profit wallet
    total_refund = withdrawal["amount"] + withdrawal["fee"]
    await db.users.update_one(
        {"uid": withdrawal["user_id"]},
        {"$inc": {"profit_wallet_balance": total_refund}}
    )
    
    await db.profit_withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Withdrawal rejected and refunded", "withdrawal_id": withdrawal_id, "refunded_amount": total_refund}

@api_router.post("/admin/withdrawals/profit/{withdrawal_id}/complete")
async def complete_profit_withdrawal(withdrawal_id: str, request: Request):
    """Mark profit withdrawal as completed with UTR"""
    data = await request.json()
    utr_number = data.get("utr_number", "")
    admin_notes = data.get("admin_notes", "")
    
    if not utr_number:
        raise HTTPException(status_code=400, detail="UTR number is required")
    
    withdrawal = await db.profit_withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail=f"Cannot complete withdrawal with status {withdrawal['status']}")
    
    await db.profit_withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "completed",
            "utr_number": utr_number,
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Withdrawal completed", "withdrawal_id": withdrawal_id, "utr_number": utr_number}

# ========== STOCK MOVEMENT SYSTEM ==========
def generate_batch_number():
    """Generate unique batch number: BATCH-YYYYMMDD-XXXXX"""
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d')
    random_suffix = ''.join(secrets.choice(string.digits) for _ in range(5))
    return f"BATCH-{timestamp}-{random_suffix}"

def generate_qr_code():
    """Generate unique QR code: QR-XXXXXXXXXXXXX"""
    random_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(13))
    return f"QR-{random_code}"

@api_router.post("/stock/transfer/initiate")
async def initiate_stock_transfer(request: Request):
    """Initiate stock transfer (sender creates request)"""
    data = await request.json()
    sender_id = data.get("sender_id")
    receiver_id = data.get("receiver_id")
    product_id = data.get("product_id")
    quantity = data.get("quantity", 0)
    notes = data.get("notes", "")
    
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
    
    # Verify sender and receiver exist
    sender = await db.users.find_one({"uid": sender_id})
    receiver = await db.users.find_one({"uid": receiver_id})
    
    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="Sender or receiver not found")
    
    # Verify stock flow hierarchy: Company → Master → Sub → Outlet
    sender_role = sender.get("role")
    receiver_role = receiver.get("role")
    
    valid_flows = [
        ("admin", "master_stockist"),
        ("master_stockist", "sub_stockist"),
        ("sub_stockist", "outlet"),
        ("outlet", "user")
    ]
    
    if (sender_role, receiver_role) not in valid_flows:
        raise HTTPException(status_code=400, detail=f"Invalid stock flow: {sender_role} → {receiver_role}")
    
    # Get product details
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Create stock movement record
    movement = {
        "movement_id": str(uuid.uuid4()),
        "batch_number": generate_batch_number(),
        "qr_code": generate_qr_code(),
        "product_id": product_id,
        "product_name": product.get("name"),
        "quantity": quantity,
        "sender_id": sender_id,
        "sender_name": f"{sender.get('first_name', '')} {sender.get('last_name', '')}".strip(),
        "sender_role": sender_role,
        "receiver_id": receiver_id,
        "receiver_name": f"{receiver.get('first_name', '')} {receiver.get('last_name', '')}".strip(),
        "receiver_role": receiver_role,
        "status": "pending_admin",  # pending_admin, approved, rejected, completed
        "notes": notes,
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": None,
        "completed_at": None
    }
    
    await db.stock_movements.insert_one(movement)
    
    return {
        "message": "Stock transfer initiated. Awaiting admin approval.",
        "movement_id": movement["movement_id"],
        "batch_number": movement["batch_number"],
        "qr_code": movement["qr_code"]
    }

@api_router.get("/stock/movements/{user_id}")
async def get_user_stock_movements(user_id: str):
    """Get stock movements for a user (as sender or receiver)"""
    movements_as_sender = await db.stock_movements.find(
        {"sender_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    movements_as_receiver = await db.stock_movements.find(
        {"receiver_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "sent": movements_as_sender,
        "received": movements_as_receiver
    }

@api_router.get("/admin/stock/movements/pending")
async def get_pending_stock_movements():
    """Get all pending stock movements for admin approval"""
    movements = await db.stock_movements.find(
        {"status": "pending_admin"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return {"movements": movements, "count": len(movements)}

@api_router.post("/admin/stock/movements/{movement_id}/approve")
async def approve_stock_movement(movement_id: str, request: Request):
    """Admin approves stock movement"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "")
    
    movement = await db.stock_movements.find_one({"movement_id": movement_id})
    if not movement:
        raise HTTPException(status_code=404, detail="Movement not found")
    
    if movement["status"] != "pending_admin":
        raise HTTPException(status_code=400, detail=f"Movement is already {movement['status']}")
    
    await db.stock_movements.update_one(
        {"movement_id": movement_id},
        {"$set": {
            "status": "approved",
            "admin_notes": admin_notes,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Stock movement approved", "movement_id": movement_id}

@api_router.post("/admin/stock/movements/{movement_id}/reject")
async def reject_stock_movement(movement_id: str, request: Request):
    """Admin rejects stock movement"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "Rejected by admin")
    
    movement = await db.stock_movements.find_one({"movement_id": movement_id})
    if not movement:
        raise HTTPException(status_code=404, detail="Movement not found")
    
    if movement["status"] != "pending_admin":
        raise HTTPException(status_code=400, detail=f"Movement is already {movement['status']}")
    
    await db.stock_movements.update_one(
        {"movement_id": movement_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": admin_notes,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Stock movement rejected", "movement_id": movement_id}

@api_router.post("/stock/movements/{movement_id}/complete")
async def complete_stock_movement(movement_id: str, request: Request):
    """Receiver confirms stock received"""
    data = await request.json()
    receiver_id = data.get("receiver_id")
    
    movement = await db.stock_movements.find_one({"movement_id": movement_id})
    if not movement:
        raise HTTPException(status_code=404, detail="Movement not found")
    
    if movement["receiver_id"] != receiver_id:
        raise HTTPException(status_code=403, detail="Only receiver can complete this movement")
    
    if movement["status"] != "approved":
        raise HTTPException(status_code=400, detail=f"Movement must be approved first. Current status: {movement['status']}")
    
    await db.stock_movements.update_one(
        {"movement_id": movement_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Stock received and movement completed", "movement_id": movement_id}

# ========== SECURITY DEPOSIT SYSTEM ==========
@api_router.post("/security-deposit/submit")
async def submit_security_deposit(request: Request):
    """Entity submits security deposit payment proof"""
    data = await request.json()
    user_id = data.get("user_id")
    amount = data.get("amount")
    payment_proof = data.get("payment_proof")  # Image URL or base64
    notes = data.get("notes", "")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify role
    if user.get("role") not in ["master_stockist", "sub_stockist", "outlet"]:
        raise HTTPException(status_code=403, detail="Only stockists and outlets can submit security deposits")
    
    # Get default amounts
    default_amounts = {
        "master_stockist": 500000,
        "sub_stockist": 300000,
        "outlet": 100000
    }
    
    expected_amount = default_amounts.get(user.get("role"))
    
    # Create deposit record
    deposit = {
        "deposit_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "role": user.get("role"),
        "amount": amount,
        "expected_amount": expected_amount,
        "payment_proof": payment_proof,
        "notes": notes,
        "status": "pending",  # pending, approved, rejected
        "admin_notes": None,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": None,
        "last_return_credit": None,
        "next_return_due": None,
        "total_returns_paid": 0.0,
        "monthly_return_rate": 0.03  # 3%
    }
    
    await db.security_deposits.insert_one(deposit)
    
    return {
        "message": "Security deposit submitted successfully",
        "deposit_id": deposit["deposit_id"],
        "expected_amount": expected_amount
    }

@api_router.get("/security-deposit/{user_id}")
async def get_user_security_deposit(user_id: str):
    """Get user's security deposit details"""
    deposit = await db.security_deposits.find_one(
        {"user_id": user_id, "status": "approved"},
        {"_id": 0}
    )
    
    if not deposit:
        return {"deposit": None, "message": "No approved security deposit found"}
    
    # Calculate days until next return
    next_due = deposit.get("next_return_due")
    days_until_return = None
    
    if next_due:
        if isinstance(next_due, str):
            next_due = datetime.fromisoformat(next_due)
        days_until_return = (next_due - datetime.now(timezone.utc)).days
    
    return {
        "deposit": deposit,
        "monthly_return_amount": deposit["amount"] * deposit["monthly_return_rate"],
        "days_until_next_return": days_until_return
    }

@api_router.get("/admin/security-deposits")
async def get_all_security_deposits(status: str = None):
    """Get all security deposits (optionally filtered by status)"""
    query = {}
    if status:
        query["status"] = status
    
    deposits = await db.security_deposits.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    return {"deposits": deposits, "count": len(deposits)}

@api_router.post("/admin/security-deposits/{deposit_id}/approve")
async def approve_security_deposit(deposit_id: str, request: Request):
    """Admin approves security deposit"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "")
    adjusted_amount = data.get("adjusted_amount")  # Optional: admin can adjust amount
    
    deposit = await db.security_deposits.find_one({"deposit_id": deposit_id})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    
    if deposit["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Deposit is already {deposit['status']}")
    
    final_amount = adjusted_amount if adjusted_amount else deposit["amount"]
    approved_at = datetime.now(timezone.utc)
    next_return_due = approved_at + timedelta(days=30)
    
    # Update deposit
    await db.security_deposits.update_one(
        {"deposit_id": deposit_id},
        {"$set": {
            "status": "approved",
            "amount": final_amount,
            "admin_notes": admin_notes,
            "approved_at": approved_at.isoformat(),
            "next_return_due": next_return_due.isoformat()
        }}
    )
    
    # Update user record
    await db.users.update_one(
        {"uid": deposit["user_id"]},
        {"$set": {
            "security_deposit_amount": final_amount,
            "security_deposit_paid": True,
            "security_deposit_date": approved_at.isoformat()
        }}
    )
    
    return {
        "message": "Security deposit approved",
        "deposit_id": deposit_id,
        "amount": final_amount,
        "next_return_due": next_return_due.isoformat()
    }

@api_router.post("/admin/security-deposits/{deposit_id}/reject")
async def reject_security_deposit(deposit_id: str, request: Request):
    """Admin rejects security deposit"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "Rejected by admin")
    
    deposit = await db.security_deposits.find_one({"deposit_id": deposit_id})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    
    if deposit["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Deposit is already {deposit['status']}")
    
    await db.security_deposits.update_one(
        {"deposit_id": deposit_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": admin_notes,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Security deposit rejected", "deposit_id": deposit_id}

@api_router.post("/admin/security-deposits/{deposit_id}/adjust")
async def adjust_security_deposit(deposit_id: str, request: Request):
    """Admin adjusts security deposit amount (recalculates returns from new date)"""
    data = await request.json()
    new_amount = data.get("new_amount")
    admin_notes = data.get("admin_notes", "")
    
    if not new_amount or new_amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid new amount")
    
    deposit = await db.security_deposits.find_one({"deposit_id": deposit_id})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    
    if deposit["status"] != "approved":
        raise HTTPException(status_code=400, detail="Can only adjust approved deposits")
    
    # Reset return cycle from today
    adjusted_at = datetime.now(timezone.utc)
    next_return_due = adjusted_at + timedelta(days=30)
    
    await db.security_deposits.update_one(
        {"deposit_id": deposit_id},
        {"$set": {
            "amount": new_amount,
            "admin_notes": admin_notes,
            "last_return_credit": adjusted_at.isoformat(),
            "next_return_due": next_return_due.isoformat()
        }}
    )
    
    # Update user record
    await db.users.update_one(
        {"uid": deposit["user_id"]},
        {"$set": {"security_deposit_amount": new_amount}}
    )
    
    return {
        "message": "Security deposit adjusted",
        "deposit_id": deposit_id,
        "new_amount": new_amount,
        "next_return_due": next_return_due.isoformat()
    }

@api_router.post("/admin/security-deposits/process-returns")
async def process_monthly_returns():
    """Admin triggers monthly return processing (auto-credit 3% to profit wallets)"""
    now = datetime.now(timezone.utc)
    
    # Find all approved deposits where next_return_due has passed
    deposits = await db.security_deposits.find({
        "status": "approved",
        "next_return_due": {"$lte": now.isoformat()}
    }).to_list(1000)
    
    processed_count = 0
    total_credited = 0.0
    
    for deposit in deposits:
        return_amount = deposit["amount"] * deposit.get("monthly_return_rate", 0.03)
        
        # Credit to user's profit wallet
        await db.users.update_one(
            {"uid": deposit["user_id"]},
            {"$inc": {"profit_wallet_balance": return_amount}}
        )
        
        # Update deposit record
        next_return_due = now + timedelta(days=30)
        await db.security_deposits.update_one(
            {"deposit_id": deposit["deposit_id"]},
            {"$set": {
                "last_return_credit": now.isoformat(),
                "next_return_due": next_return_due.isoformat()
            },
            "$inc": {"total_returns_paid": return_amount}}
        )
        
        processed_count += 1
        total_credited += return_amount
    
    return {
        "message": f"Processed {processed_count} monthly returns",
        "processed_count": processed_count,
        "total_credited": total_credited
    }

# ========== ANNUAL RENEWAL SYSTEM ==========
@api_router.post("/renewal/submit")
async def submit_renewal_payment(request: Request):
    """Entity submits annual renewal payment proof"""
    data = await request.json()
    user_id = data.get("user_id")
    amount = data.get("amount")
    payment_proof = data.get("payment_proof")
    notes = data.get("notes", "")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify role
    if user.get("role") not in ["master_stockist", "sub_stockist", "outlet"]:
        raise HTTPException(status_code=403, detail="Only stockists and outlets need renewal")
    
    # Get default renewal amounts (base + 18% GST)
    base_amounts = {
        "master_stockist": 50000,
        "sub_stockist": 30000,
        "outlet": 10000
    }
    
    base_amount = base_amounts.get(user.get("role"))
    expected_amount = base_amount * 1.18  # Including 18% GST
    
    # Create renewal record
    renewal = {
        "renewal_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "role": user.get("role"),
        "amount": amount,
        "base_amount": base_amount,
        "expected_amount": expected_amount,
        "payment_proof": payment_proof,
        "notes": notes,
        "status": "pending",  # pending, approved, rejected
        "admin_notes": None,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": None,
        "renewal_period_start": None,
        "renewal_period_end": None
    }
    
    await db.annual_renewals.insert_one(renewal)
    
    return {
        "message": "Renewal payment submitted successfully",
        "renewal_id": renewal["renewal_id"],
        "expected_amount": expected_amount
    }

@api_router.get("/renewal/{user_id}")
async def get_user_renewal_status(user_id: str):
    """Get user's renewal status"""
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get latest renewal
    renewal = await db.annual_renewals.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("submitted_at", -1).limit(1).to_list(1)
    renewal = renewal[0] if renewal else None
    
    renewal_due_date = user.get("renewal_due_date")
    is_overdue = False
    days_until_due = None
    
    if renewal_due_date:
        if isinstance(renewal_due_date, str):
            renewal_due_date = datetime.fromisoformat(renewal_due_date)
        days_until_due = (renewal_due_date - datetime.now(timezone.utc)).days
        is_overdue = days_until_due < 0
    
    return {
        "renewal_status": user.get("renewal_status", "active"),
        "renewal_due_date": user.get("renewal_due_date"),
        "is_overdue": is_overdue,
        "days_until_due": days_until_due,
        "latest_renewal": renewal,
        "suspended": user.get("renewal_status") == "overdue"
    }

@api_router.get("/admin/renewals")
async def get_all_renewals(status: str = None):
    """Get all renewal submissions (optionally filtered by status)"""
    query = {}
    if status:
        query["status"] = status
    
    renewals = await db.annual_renewals.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    return {"renewals": renewals, "count": len(renewals)}

@api_router.post("/admin/renewals/{renewal_id}/approve")
async def approve_renewal(renewal_id: str, request: Request):
    """Admin approves renewal payment"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "")
    
    renewal = await db.annual_renewals.find_one({"renewal_id": renewal_id})
    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal not found")
    
    if renewal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Renewal is already {renewal['status']}")
    
    approved_at = datetime.now(timezone.utc)
    renewal_period_start = approved_at
    renewal_period_end = approved_at + timedelta(days=365)
    
    # Update renewal record
    await db.annual_renewals.update_one(
        {"renewal_id": renewal_id},
        {"$set": {
            "status": "approved",
            "admin_notes": admin_notes,
            "approved_at": approved_at.isoformat(),
            "renewal_period_start": renewal_period_start.isoformat(),
            "renewal_period_end": renewal_period_end.isoformat()
        }}
    )
    
    # Update user record - clear suspension and set next renewal date
    await db.users.update_one(
        {"uid": renewal["user_id"]},
        {"$set": {
            "renewal_status": "active",
            "renewal_due_date": renewal_period_end.isoformat(),
            "last_renewal_date": approved_at.isoformat()
        }}
    )
    
    return {
        "message": "Renewal approved",
        "renewal_id": renewal_id,
        "next_renewal_due": renewal_period_end.isoformat()
    }

@api_router.post("/admin/renewals/{renewal_id}/reject")
async def reject_renewal(renewal_id: str, request: Request):
    """Admin rejects renewal payment"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "Rejected by admin")
    
    renewal = await db.annual_renewals.find_one({"renewal_id": renewal_id})
    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal not found")
    
    if renewal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Renewal is already {renewal['status']}")
    
    await db.annual_renewals.update_one(
        {"renewal_id": renewal_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": admin_notes,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Renewal rejected", "renewal_id": renewal_id}

@api_router.post("/admin/renewals/check-overdue")
async def check_overdue_renewals():
    """Check and suspend entities with overdue renewals"""
    now = datetime.now(timezone.utc)
    
    # Find users with overdue renewals
    users = await db.users.find({
        "role": {"$in": ["master_stockist", "sub_stockist", "outlet"]},
        "renewal_due_date": {"$lte": now.isoformat()},
        "renewal_status": {"$ne": "overdue"}
    }).to_list(1000)
    
    suspended_count = 0
    
    for user in users:
        user_id = user["uid"]
        
        # 1. Cancel and refund all pending withdrawals
        pending_cashback = await db.cashback_withdrawals.find(
            {"user_id": user_id, "status": "pending"}
        ).to_list(100)
        
        pending_profit = await db.profit_withdrawals.find(
            {"user_id": user_id, "status": "pending"}
        ).to_list(100)
        
        # Refund cashback withdrawals
        for withdrawal in pending_cashback:
            refund_amount = withdrawal["amount"] + withdrawal["fee"]
            await db.users.update_one(
                {"uid": user_id},
                {"$inc": {"cashback_wallet_balance": refund_amount}}
            )
            await db.cashback_withdrawals.update_one(
                {"withdrawal_id": withdrawal["withdrawal_id"]},
                {"$set": {
                    "status": "cancelled",
                    "admin_notes": "Cancelled due to renewal non-payment",
                    "processed_at": now.isoformat()
                }}
            )
        
        # Refund profit withdrawals
        for withdrawal in pending_profit:
            refund_amount = withdrawal["amount"] + withdrawal["fee"]
            await db.users.update_one(
                {"uid": user_id},
                {"$inc": {"profit_wallet_balance": refund_amount}}
            )
            await db.profit_withdrawals.update_one(
                {"withdrawal_id": withdrawal["withdrawal_id"]},
                {"$set": {
                    "status": "cancelled",
                    "admin_notes": "Cancelled due to renewal non-payment",
                    "processed_at": now.isoformat()
                }}
            )
        
        # 2. Update user status to suspend commission/withdrawal rights
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "renewal_status": "overdue",
                "profit_wallet_frozen": True  # Freeze profit wallet (no new credits)
            }}
        )
        
        suspended_count += 1
    
    return {
        "message": f"Suspended {suspended_count} entities for overdue renewals",
        "suspended_count": suspended_count
    }

# ========== COMPREHENSIVE ADMIN DASHBOARD APIS ==========

@api_router.get("/admin/dashboard/kpis")
async def get_admin_kpis(request: Request):
    """Get comprehensive KPIs for admin dashboard"""
    # Verify admin access
    admin_uid = request.headers.get("X-User-ID")
    if admin_uid:
        await verify_admin(admin_uid)
    
    # Total users
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    
    # VIP count
    vip_count = await db.users.count_documents({"membership_type": "vip"})
    
    # Active miners (users with active mining sessions)
    active_miners = await db.users.count_documents({"mining_active": True})
    
    # PRC stats
    all_users = await db.users.find({}, {"prc_balance": 1, "total_mined": 1}).to_list(10000)
    total_prc_issued = sum(user.get("total_mined", 0) for user in all_users)
    total_prc_balance = sum(user.get("prc_balance", 0) for user in all_users)
    total_prc_redeemed = total_prc_issued - total_prc_balance
    
    # Cashback stats
    all_cashback = await db.users.find({}, {"cashback_wallet_balance": 1}).to_list(10000)
    total_cashback = sum(user.get("cashback_wallet_balance", 0) for user in all_cashback)
    
    # Pending withdrawals
    pending_cashback_withdrawals = await db.cashback_withdrawals.count_documents({"status": "pending"})
    pending_profit_withdrawals = await db.profit_withdrawals.count_documents({"status": "pending"})
    
    # Pending orders
    pending_orders = await db.orders.count_documents({"status": "pending"})
    
    # Total membership fees collected
    total_vip_payments = await db.vip_payments.count_documents({"status": "approved"})
    total_membership_fees = total_vip_payments * 1000  # ₹1000 per VIP
    
    # Security deposits
    approved_deposits = await db.security_deposits.find({"status": "approved"}).to_list(1000)
    total_security_deposits = sum(d.get("amount", 0) for d in approved_deposits)
    
    # Annual renewals
    approved_renewals = await db.annual_renewals.count_documents({"status": "approved"})
    
    # Stockist counts
    master_count = await db.users.count_documents({"role": "master_stockist"})
    sub_count = await db.users.count_documents({"role": "sub_stockist"})
    outlet_count = await db.users.count_documents({"role": "outlet"})
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "vip": vip_count,
            "master_stockists": master_count,
            "sub_stockists": sub_count,
            "outlets": outlet_count
        },
        "mining": {
            "active_miners": active_miners,
            "total_prc_issued": round(total_prc_issued, 2),
            "total_prc_redeemed": round(total_prc_redeemed, 2),
            "total_prc_balance": round(total_prc_balance, 2)
        },
        "financial": {
            "total_cashback": round(total_cashback, 2),
            "pending_cashback_withdrawals": pending_cashback_withdrawals,
            "pending_profit_withdrawals": pending_profit_withdrawals,
            "total_membership_fees": total_membership_fees,
            "total_security_deposits": total_security_deposits,
            "approved_renewals": approved_renewals
        },
        "orders": {
            "pending": pending_orders,
            "total": await db.orders.count_documents({})
        }
    }

@api_router.get("/admin/dashboard/growth")
async def get_growth_metrics(period: str = "daily"):
    """Get growth metrics (daily/monthly)"""
    now = datetime.now(timezone.utc)
    
    if period == "daily":
        # Last 30 days
        days = 30
        date_format = "%Y-%m-%d"
    else:
        # Last 12 months
        days = 365
        date_format = "%Y-%m"
    
    start_date = now - timedelta(days=days)
    
    # Get user registrations by date
    users = await db.users.find(
        {"created_at": {"$gte": start_date.isoformat()}},
        {"created_at": 1}
    ).to_list(10000)
    
    # Group by date
    registration_data = {}
    for user in users:
        created_at = user.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        date_key = created_at.strftime(date_format)
        registration_data[date_key] = registration_data.get(date_key, 0) + 1
    
    # Get orders by date
    orders = await db.orders.find(
        {"created_at": {"$gte": start_date.isoformat()}},
        {"created_at": 1, "total_cash": 1}
    ).to_list(10000)
    
    order_data = {}
    revenue_data = {}
    for order in orders:
        created_at = order.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        date_key = created_at.strftime(date_format)
        order_data[date_key] = order_data.get(date_key, 0) + 1
        revenue_data[date_key] = revenue_data.get(date_key, 0) + order.get("total_cash", 0)
    
    return {
        "period": period,
        "registrations": registration_data,
        "orders": order_data,
        "revenue": revenue_data
    }

@api_router.post("/admin/users/{uid}/freeze")
async def freeze_user_account(uid: str, request: Request):
    """Freeze user account (admin only)"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    reason = data.get("reason", "Frozen by admin")
    
    await verify_admin(admin_uid)
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "is_active": False,
            "freeze_reason": reason,
            "frozen_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "User account frozen", "uid": uid}

@api_router.post("/admin/users/{uid}/unfreeze")
async def unfreeze_user_account(uid: str, request: Request):
    """Unfreeze user account (admin only)"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    
    await verify_admin(admin_uid)
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "is_active": True,
            "freeze_reason": None,
            "unfrozen_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "User account unfrozen", "uid": uid}

@api_router.post("/admin/users/{uid}/adjust-wallet")
async def adjust_user_wallet(uid: str, request: Request):
    """Manually adjust user wallet balance (admin only)"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    wallet_type = data.get("wallet_type")  # cashback, profit, prc
    adjustment_amount = data.get("amount", 0)
    reason = data.get("reason", "Manual adjustment by admin")
    
    await verify_admin(admin_uid)
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Determine field to update
    field_map = {
        "cashback": "cashback_wallet_balance",
        "profit": "profit_wallet_balance",
        "prc": "prc_balance"
    }
    
    field = field_map.get(wallet_type)
    if not field:
        raise HTTPException(status_code=400, detail="Invalid wallet type")
    
    # Update wallet
    await db.users.update_one(
        {"uid": uid},
        {"$inc": {field: adjustment_amount}}
    )
    
    # Log adjustment
    await db.wallet_adjustments.insert_one({
        "adjustment_id": str(uuid.uuid4()),
        "user_id": uid,
        "admin_id": admin_uid,
        "wallet_type": wallet_type,
        "amount": adjustment_amount,
        "reason": reason,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Wallet adjusted successfully",
        "wallet_type": wallet_type,
        "adjustment": adjustment_amount
    }

@api_router.get("/admin/audit-logs")
async def get_audit_logs(limit: int = 100, action_type: str = None):
    """Get system audit logs (admin only)"""
    query = {}
    if action_type:
        query["action_type"] = action_type
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"logs": logs, "count": len(logs)}

@api_router.post("/admin/audit-log")
async def create_audit_log(request: Request):
    """Create audit log entry"""
    data = await request.json()
    
    log_entry = {
        "log_id": str(uuid.uuid4()),
        "user_id": data.get("user_id"),
        "admin_id": data.get("admin_id"),
        "action_type": data.get("action_type"),  # user_freeze, wallet_adjust, kyc_approve, etc.
        "details": data.get("details", {}),
        "ip_address": data.get("ip_address"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.audit_logs.insert_one(log_entry)
    return {"message": "Audit log created", "log_id": log_entry["log_id"]}

@api_router.get("/admin/reports/financial")
async def get_financial_report(start_date: str = None, end_date: str = None):
    """Get financial report with profit & loss summary"""
    
    # If dates not provided, use last 30 days
    if not end_date:
        end_date = datetime.now(timezone.utc).isoformat()
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    # INFLOWS
    # 1. VIP Membership fees
    vip_payments = await db.vip_payments.find({
        "status": "approved",
        "submitted_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(1000)
    vip_income = len(vip_payments) * 1000
    
    # 2. Annual Renewals
    renewals = await db.annual_renewals.find({
        "status": "approved",
        "approved_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(1000)
    renewal_income = sum(r.get("base_amount", 0) * 1.18 for r in renewals)
    
    # 3. Security Deposits (one-time, returnable)
    deposits = await db.security_deposits.find({
        "status": "approved",
        "approved_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(1000)
    deposit_income = sum(d.get("amount", 0) for d in deposits)
    
    # 4. Order revenues (cash collected)
    orders = await db.orders.find({
        "status": "delivered",
        "delivered_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(1000)
    order_revenue = sum(o.get("total_cash", 0) for o in orders)
    
    # OUTFLOWS
    # 1. Cashback to users
    cashback_given = sum(o.get("cashback_amount", 0) for o in orders)
    
    # 2. Delivery charge distribution (to stockists)
    delivery_distribution = sum(o.get("delivery_charge", 0) for o in orders)
    
    # 3. Security deposit returns (3% monthly)
    deposit_returns_paid = sum(d.get("total_returns_paid", 0) for d in deposits if d.get("total_returns_paid"))
    
    # 4. Withdrawals paid out
    cashback_withdrawals = await db.cashback_withdrawals.find({
        "status": "completed",
        "processed_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(1000)
    profit_withdrawals = await db.profit_withdrawals.find({
        "status": "completed",
        "processed_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(1000)
    
    withdrawal_payouts = sum(w.get("amount", 0) for w in cashback_withdrawals + profit_withdrawals)
    
    # SUMMARY
    total_inflow = vip_income + renewal_income + deposit_income + order_revenue
    total_outflow = cashback_given + delivery_distribution + deposit_returns_paid + withdrawal_payouts
    net_profit = total_inflow - total_outflow
    
    return {
        "period": {"start": start_date, "end": end_date},
        "inflows": {
            "vip_memberships": vip_income,
            "annual_renewals": renewal_income,
            "security_deposits": deposit_income,
            "order_revenue": order_revenue,
            "total": total_inflow
        },
        "outflows": {
            "cashback_given": cashback_given,
            "delivery_distribution": delivery_distribution,
            "deposit_returns": deposit_returns_paid,
            "withdrawal_payouts": withdrawal_payouts,
            "total": total_outflow
        },
        "net_profit": net_profit,
        "profit_margin": (net_profit / total_inflow * 100) if total_inflow > 0 else 0
    }

@api_router.get("/admin/reports/gst")
async def get_gst_report(start_date: str = None, end_date: str = None):
    """Get GST report for annual renewals"""
    
    if not end_date:
        end_date = datetime.now(timezone.utc).isoformat()
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    renewals = await db.annual_renewals.find({
        "status": "approved",
        "approved_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(1000)
    
    gst_data = []
    total_base = 0
    total_gst = 0
    
    for renewal in renewals:
        base = renewal.get("base_amount", 0)
        gst = base * 0.18
        total_base += base
        total_gst += gst
        
        gst_data.append({
            "renewal_id": renewal.get("renewal_id"),
            "user_id": renewal.get("user_id"),
            "user_name": renewal.get("user_name"),
            "role": renewal.get("role"),
            "base_amount": base,
            "gst_amount": gst,
            "total_amount": base + gst,
            "approved_at": renewal.get("approved_at")
        })
    
    return {
        "period": {"start": start_date, "end": end_date},
        "summary": {
            "total_base": total_base,
            "total_gst": total_gst,
            "total_with_gst": total_base + total_gst,
            "count": len(renewals)
        },
        "details": gst_data
    }

@api_router.get("/admin/formula/mining")
async def get_mining_formula():
    """Get current mining formula configuration"""
    formula = await db.formulas.find_one({"formula_type": "mining"})
    
    if not formula:
        # Return default formula
        return {
            "formula_type": "mining",
            "base_rate": 50,
            "referral_bonus_percentage": 10,
            "max_referrals": 200,
            "daily_decay_enabled": True,
            "decay_per_100_users": 1,
            "minimum_rate": 10
        }
    
    formula["_id"] = str(formula["_id"])
    return formula

@api_router.post("/admin/formula/mining")
async def update_mining_formula(request: Request):
    """Update mining formula (admin only)"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    
    await verify_admin(admin_uid)
    
    formula_data = {
        "formula_type": "mining",
        "base_rate": data.get("base_rate", 50),
        "referral_bonus_percentage": data.get("referral_bonus_percentage", 10),
        "max_referrals": data.get("max_referrals", 200),
        "daily_decay_enabled": data.get("daily_decay_enabled", True),
        "decay_per_100_users": data.get("decay_per_100_users", 1),
        "minimum_rate": data.get("minimum_rate", 10),
        "updated_by": admin_uid,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.formulas.update_one(
        {"formula_type": "mining"},
        {"$set": formula_data},
        upsert=True
    )
    
    return {"message": "Mining formula updated successfully"}

@api_router.get("/admin/employees")
async def get_all_employees():
    """Get all employees (admin, sub_admin, manager, employee)"""
    employees = await db.users.find(
        {"role": {"$in": ["admin", "sub_admin", "manager", "employee"]}},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    
    return {"employees": employees, "count": len(employees)}

@api_router.post("/admin/employees/create")
async def create_employee(request: Request):
    """Create new employee (admin only)"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    
    await verify_admin(admin_uid)
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data.get("email")})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    employee = {
        "uid": str(uuid.uuid4()),
        "email": data.get("email"),
        "password": hash_password(data.get("password")),
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
        "role": data.get("role"),  # sub_admin, manager, employee
        "employee_id": data.get("employee_id"),
        "designation": data.get("designation"),
        "assigned_regions": data.get("assigned_regions", []),  # For sub_admin
        "permissions": data.get("permissions", []),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin_uid
    }
    
    await db.users.insert_one(employee)
    
    return {"message": "Employee created successfully", "uid": employee["uid"]}

@api_router.put("/admin/employees/{uid}")
async def update_employee(uid: str, request: Request):
    """Update employee details (admin only)"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    
    await verify_admin(admin_uid)
    
    update_data = {
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
        "designation": data.get("designation"),
        "assigned_regions": data.get("assigned_regions", []),
        "permissions": data.get("permissions", []),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    await db.users.update_one({"uid": uid}, {"$set": update_data})
    
    return {"message": "Employee updated successfully"}

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
    
    if user.get("kyc_status") != "verified":
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