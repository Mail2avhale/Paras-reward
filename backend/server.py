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
import re
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
    secret_code: str = Field(default_factory=lambda: ''.join(secrets.choice(string.digits) for _ in range(6)))
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

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notification_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    message: str
    type: str  # order, withdrawal, mining, referral, system
    related_id: Optional[str] = None
    icon: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: str
    related_id: Optional[str] = None
    icon: Optional[str] = None

class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    action_type: str  # login, order_placed, withdrawal_requested, mining_started, etc.
    description: str
    metadata: Optional[Dict] = {}
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BiometricCredential(BaseModel):
    model_config = ConfigDict(extra="ignore")
    credential_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    device_name: str  # e.g., "iPhone 13", "Chrome on Windows"
    credential_public_key: str  # Base64 encoded public key
    credential_raw_id: str  # Base64 encoded credential ID from WebAuthn
    counter: int = 0  # Signature counter for security
    transports: Optional[List[str]] = []  # e.g., ["internal", "usb", "nfc", "ble"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: Optional[datetime] = None

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



# ========== TRANSACTION HELPERS ==========
async def log_transaction(
    user_id: str,
    wallet_type: str,
    transaction_type: str,
    amount: float,
    description: str,
    metadata: Dict = {},
    related_id: Optional[str] = None,
    related_type: Optional[str] = None
) -> str:
    """Log a transaction and update user balance"""
    
    # Get current user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Determine balance field
    balance_field = f"{wallet_type}_balance"
    balance_before = user.get(balance_field, 0.0)
    
    # Calculate new balance
    if transaction_type in ["mining", "tap_game", "referral", "cashback", "withdrawal_rejected", "admin_credit", "profit_share"]:
        # Credit transactions
        balance_after = balance_before + amount
    elif transaction_type in ["order", "withdrawal", "admin_debit", "delivery_charge"]:
        # Debit transactions
        balance_after = balance_before - amount
    else:
        balance_after = balance_before
    
    # Create transaction record
    transaction = {
        "transaction_id": f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
        "user_id": user_id,
        "wallet_type": wallet_type,
        "type": transaction_type,
        "amount": amount,
        "balance_before": balance_before,
        "balance_after": balance_after,
        "status": "completed",
        "description": description,
        "metadata": metadata,
        "related_id": related_id,
        "related_type": related_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert transaction
    await db.transactions.insert_one(transaction)
    
    # Update user balance
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {balance_field: balance_after}}
    )
    
    return transaction["transaction_id"]

async def log_activity(
    user_id: str,
    action_type: str,
    description: str,
    metadata: Dict = {},
    ip_address: Optional[str] = None
):
    """
    Log user activity
    
    Action types:
    - Authentication: login, logout, password_reset
    - Financial: order_placed, withdrawal_requested, withdrawal_approved, withdrawal_rejected
    - Mining: mining_started, mining_claimed
    - Wallet: cashback_credited, profit_wallet_credit, wallet_debit
    - Admin: user_role_changed, kyc_approved, kyc_rejected, product_created
    - Profile: profile_updated, kyc_submitted
    """
    try:
        # Get user details
        user = await db.users.find_one({"uid": user_id})
        user_name = user.get("name", "Unknown") if user else "Unknown"
        user_email = user.get("email", "Unknown") if user else "Unknown"
        
        activity_log = {
            "log_id": str(uuid.uuid4()),
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "action_type": action_type,
            "description": description,
            "metadata": metadata,
            "ip_address": ip_address,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.activity_logs.insert_one(activity_log)
        return activity_log["log_id"]
    except Exception as e:
        print(f"Error logging activity: {str(e)}")
        return None

async def get_user_lien_amount(user_id: str) -> float:
    """Calculate total lien (pending fees) for a user"""
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return 0.0
    
    role = user.get("role", "user")
    
    # Only stockists have lien
    if role not in ["master_stockist", "sub_stockist", "outlet"]:
        return 0.0
    
    # Get pending renewal fees
    pending_renewals = await db.renewal_fees.find({
        "user_id": user_id,
        "status": "pending"
    }).to_list(None)
    
    total_lien = sum(r.get("amount", 0.0) for r in pending_renewals)
    
    return total_lien

async def check_withdrawal_eligibility(user_id: str, amount: float, wallet_type: str) -> Dict:
    """
    Check if user can withdraw the requested amount
    Returns: {eligible: bool, reason: str, lien_amount: float}
    """
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return {"eligible": False, "reason": "User not found", "lien_amount": 0.0}
    
    # Check KYC
    if user.get("kyc_status") != "verified":
        return {"eligible": False, "reason": "KYC not verified", "lien_amount": 0.0}
    
    # Check wallet balance
    balance_field = f"{wallet_type}_balance"
    current_balance = user.get(balance_field, 0.0)
    
    if current_balance < amount:
        return {"eligible": False, "reason": f"Insufficient balance. Current: ₹{current_balance:.2f}", "lien_amount": 0.0}
    
    # Check lien
    lien_amount = await get_user_lien_amount(user_id)
    
    # For stockists, check if balance after withdrawal > lien
    if lien_amount > 0:
        balance_after_withdrawal = current_balance - amount
        if balance_after_withdrawal < lien_amount:
            return {
                "eligible": False, 
                "reason": f"Outstanding fees: ₹{lien_amount:.2f}. Balance after withdrawal must be ≥ lien amount.",
                "lien_amount": lien_amount
            }
    
    return {"eligible": True, "reason": "Eligible for withdrawal", "lien_amount": lien_amount}

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

async def get_valid_prc_balance(uid: str):
    """
    Calculate valid (non-expired) PRC balance for user
    Free users: PRC expires after 2 days
    VIP users: PRC never expires
    """
    user = await db.users.find_one({"uid": uid})
    if not user:
        return 0
    
    # VIP users have no expiry
    if user.get("membership_type") == "vip":
        return user.get("prc_balance", 0)
    
    # Free users: check transaction history for expiry
    total_valid_prc = 0
    now = datetime.now(timezone.utc)
    
    # Get all PRC earning transactions
    transactions = await db.transactions.find({
        "user_id": uid,
        "transaction_type": {"$in": ["mining", "referral", "tap_game", "admin_credit"]}
    }).sort("timestamp", -1).to_list(length=None)
    
    for txn in transactions:
        # Check if transaction is within 2 days
        txn_date = datetime.fromisoformat(txn.get("timestamp", now.isoformat()))
        if txn_date.tzinfo is None:
            txn_date = txn_date.replace(tzinfo=timezone.utc)
        
        days_old = (now - txn_date).days
        
        # If less than 2 days old, PRC is valid
        if days_old < 2:
            total_valid_prc += txn.get("prc_amount", 0)
    
    # Cap at actual balance (in case of spending)
    actual_balance = user.get("prc_balance", 0)
    return min(total_valid_prc, actual_balance)

async def get_cashback_rate(user_id: str, is_top_player: bool = False):
    """
    Get cashback rate based on user membership
    Free users: 10% regular, 20% top player
    VIP users: 50% regular, 100% top player
    """
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return 0.10  # Default to free user rate
    
    is_vip = user.get("membership_type") == "vip"
    
    if is_vip:
        return 1.0 if is_top_player else 0.50  # 100% or 50%
    else:
        return 0.20 if is_top_player else 0.10  # 20% or 10%

async def get_withdrawal_limit(user_id: str):
    """
    Get minimum withdrawal limit based on membership
    Free users: ₹1000
    VIP users: ₹100
    """
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return 1000
    
    is_vip = user.get("membership_type") == "vip"
    return 100 if is_vip else 1000

async def can_use_marketplace(user_id: str):
    """
    Check if user can use marketplace
    Free users: NO
    VIP users: YES
    """
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return False
    
    return user.get("membership_type") == "vip"

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
    referral_code = data.get("referral_code", "").strip()  # Optional referral code
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    # Validate email format
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate referral code if provided
    referrer = None
    if referral_code:
        referrer = await db.users.find_one({"referral_code": referral_code})
        if not referrer:
            raise HTTPException(status_code=400, detail="Invalid referral code")
    
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
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "referred_by": referrer["uid"] if referrer else None,
        "referral_count": 0
    }
    
    # Generate referral code
    user_data["referral_code"] = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    
    await db.users.insert_one(user_data)
    
    # If referred, update referrer's count
    if referrer:
        await db.users.update_one(
            {"uid": referrer["uid"]},
            {
                "$inc": {"referral_count": 1},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
    
    return {
        "message": "Registration successful! Please complete your profile.",
        "uid": user_data["uid"],
        "profile_complete": False,
        "referred_by": referrer["name"] if referrer else None
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
    # Normalize email to lowercase for case-insensitive matching
    normalized_identifier = identifier.lower() if '@' in identifier else identifier
    
    # Find user by email (case-insensitive), mobile, or UID
    user = await db.users.find_one({
        "$or": [
            {"email": {"$regex": f"^{normalized_identifier}$", "$options": "i"}},
            {"mobile": identifier},
            {"uid": identifier}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not registered. Please register to continue.")
    
    # Verify password
    if user.get("password_hash"):
        if not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid password")
    
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail=f"Account suspended: {user.get('suspension_reason', 'Contact support')}")
    
    # Enforce PRC = 0 for free users (only VIP can have PRC)
    if user.get("membership_type") != "vip" and user.get("prc_balance", 0) > 0:
        await db.users.update_one(
            {"uid": user["uid"]},
            {"$set": {"prc_balance": 0}}
        )
        user["prc_balance"] = 0
    
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
    
    # Log activity
    await log_activity(
        user_id=user["uid"],
        action_type="login",
        description=f"User logged in from {ip_address or 'unknown IP'}",
        metadata={"device_id": device_id, "identifier": identifier},
        ip_address=ip_address
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

# ========== BIOMETRIC AUTHENTICATION ROUTES ==========

@api_router.post("/auth/biometric/register-options")
async def get_biometric_register_options(user_id: str):
    """Get WebAuthn registration options for biometric setup"""
    from webauthn import generate_registration_options
    from webauthn.helpers.structs import (
        PublicKeyCredentialDescriptor,
        AuthenticatorSelectionCriteria,
        UserVerificationRequirement,
        AuthenticatorAttachment,
        ResidentKeyRequirement
    )
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get existing credentials to exclude
    existing_creds = await db.biometric_credentials.find({"user_id": user_id}).to_list(None)
    exclude_credentials = [
        PublicKeyCredentialDescriptor(id=bytes.fromhex(cred["credential_raw_id"]))
        for cred in existing_creds
    ]
    
    # Generate registration options
    webauthn_rp_id = os.environ.get('WEBAUTHN_RP_ID', 'localhost')
    options = generate_registration_options(
        rp_id=webauthn_rp_id,
        rp_name="PARAS REWARD",
        user_id=user_id.encode('utf-8'),
        user_name=user.get("email", "user"),
        user_display_name=user.get("name", "User"),
        exclude_credentials=exclude_credentials,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED
        ),
        timeout=60000  # 60 seconds
    )
    
    # Store challenge in session (in production, use Redis/session store)
    await db.webauthn_challenges.insert_one({
        "user_id": user_id,
        "challenge": options.challenge.hex(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    })
    
    return {
        "options": {
            "challenge": options.challenge.hex(),
            "rp": {"id": options.rp.id, "name": options.rp.name},
            "user": {
                "id": options.user.id.hex(),
                "name": options.user.name,
                "displayName": options.user.display_name
            },
            "pubKeyCredParams": [{"type": p.type, "alg": p.alg} for p in options.pub_key_cred_params],
            "timeout": options.timeout,
            "excludeCredentials": [{"id": c.id.hex(), "type": c.type} for c in options.exclude_credentials],
            "authenticatorSelection": {
                "authenticatorAttachment": options.authenticator_selection.authenticator_attachment,
                "residentKey": options.authenticator_selection.resident_key,
                "userVerification": options.authenticator_selection.user_verification
            },
            "attestation": options.attestation
        }
    }

@api_router.post("/auth/biometric/register")
async def register_biometric_credential(
    user_id: str,
    device_name: str,
    credential_data: Dict
):
    """Register a new biometric credential"""
    from webauthn import verify_registration_response
    from webauthn.helpers.structs import RegistrationCredential
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check device limit (max 5 devices)
    existing_count = await db.biometric_credentials.count_documents({"user_id": user_id})
    if existing_count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 devices allowed. Please remove an old device first.")
    
    # Get stored challenge
    challenge_doc = await db.webauthn_challenges.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)]
    )
    
    if not challenge_doc:
        raise HTTPException(status_code=400, detail="No registration challenge found. Please restart registration.")
    
    # Check if challenge expired
    expires_at = datetime.fromisoformat(challenge_doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Registration challenge expired. Please restart registration.")
    
    try:
        # Create RegistrationCredential object
        credential = RegistrationCredential(
            id=credential_data["id"],
            raw_id=bytes.fromhex(credential_data["rawId"]),
            response={
                "client_data_json": bytes.fromhex(credential_data["response"]["clientDataJSON"]),
                "attestation_object": bytes.fromhex(credential_data["response"]["attestationObject"]),
            },
            type=credential_data["type"]
        )
        
        # Verify registration
        webauthn_origin = os.environ.get('WEBAUTHN_ORIGIN', 'http://localhost:3000')
        webauthn_rp_id = os.environ.get('WEBAUTHN_RP_ID', 'localhost')
        
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=bytes.fromhex(challenge_doc["challenge"]),
            expected_origin=webauthn_origin,
            expected_rp_id=webauthn_rp_id
        )
        
        # Store credential
        biometric_cred = {
            "credential_id": str(uuid.uuid4()),
            "user_id": user_id,
            "device_name": device_name,
            "credential_public_key": verification.credential_public_key.hex(),
            "credential_raw_id": verification.credential_id.hex(),
            "counter": verification.sign_count,
            "transports": credential_data.get("transports", []),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used_at": None
        }
        
        await db.biometric_credentials.insert_one(biometric_cred)
        
        # Delete used challenge
        await db.webauthn_challenges.delete_one({"_id": challenge_doc["_id"]})
        
        # Log activity
        await log_activity(
            user_id=user_id,
            action_type="biometric_registered",
            description=f"Registered biometric credential on {device_name}",
            metadata={"device_name": device_name}
        )
        
        return {
            "message": "Biometric credential registered successfully",
            "credential_id": biometric_cred["credential_id"]
        }
        
    except Exception as e:
        print(f"Biometric registration error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to register biometric: {str(e)}")

@api_router.post("/auth/biometric/login-options")
async def get_biometric_login_options(email: str):
    """Get WebAuthn authentication options for biometric login"""
    from webauthn import generate_authentication_options
    from webauthn.helpers.structs import PublicKeyCredentialDescriptor
    
    # Find user by email
    user = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's credentials
    credentials = await db.biometric_credentials.find({"user_id": user["uid"]}).to_list(None)
    if not credentials:
        raise HTTPException(status_code=404, detail="No biometric credentials registered for this user")
    
    # Create credential descriptors
    allow_credentials = [
        PublicKeyCredentialDescriptor(id=bytes.fromhex(cred["credential_raw_id"]))
        for cred in credentials
    ]
    
    # Generate authentication options
    webauthn_rp_id = os.environ.get('WEBAUTHN_RP_ID', 'localhost')
    options = generate_authentication_options(
        rp_id=webauthn_rp_id,
        allow_credentials=allow_credentials,
        user_verification="preferred",
        timeout=60000
    )
    
    # Store challenge
    await db.webauthn_challenges.insert_one({
        "user_id": user["uid"],
        "challenge": options.challenge.hex(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    })
    
    return {
        "options": {
            "challenge": options.challenge.hex(),
            "timeout": options.timeout,
            "rpId": options.rp_id,
            "allowCredentials": [{"id": c.id.hex(), "type": c.type} for c in options.allow_credentials],
            "userVerification": options.user_verification
        }
    }

@api_router.post("/auth/biometric/login")
async def biometric_login(
    email: str,
    credential_data: Dict
):
    """Authenticate user with biometric"""
    from webauthn import verify_authentication_response
    from webauthn.helpers.structs import AuthenticationCredential
    
    # Find user
    user = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get stored challenge
    challenge_doc = await db.webauthn_challenges.find_one(
        {"user_id": user["uid"]},
        sort=[("created_at", -1)]
    )
    
    if not challenge_doc:
        raise HTTPException(status_code=400, detail="No authentication challenge found")
    
    # Get credential
    credential_raw_id = credential_data["rawId"]
    stored_credential = await db.biometric_credentials.find_one({
        "user_id": user["uid"],
        "credential_raw_id": credential_raw_id
    })
    
    if not stored_credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    try:
        # Create AuthenticationCredential object
        credential = AuthenticationCredential(
            id=credential_data["id"],
            raw_id=bytes.fromhex(credential_data["rawId"]),
            response={
                "client_data_json": bytes.fromhex(credential_data["response"]["clientDataJSON"]),
                "authenticator_data": bytes.fromhex(credential_data["response"]["authenticatorData"]),
                "signature": bytes.fromhex(credential_data["response"]["signature"]),
                "user_handle": bytes.fromhex(credential_data["response"].get("userHandle", "")) if credential_data["response"].get("userHandle") else None
            },
            type=credential_data["type"]
        )
        
        # Verify authentication
        webauthn_origin = os.environ.get('WEBAUTHN_ORIGIN', 'http://localhost:3000')
        webauthn_rp_id = os.environ.get('WEBAUTHN_RP_ID', 'localhost')
        
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=bytes.fromhex(challenge_doc["challenge"]),
            expected_origin=webauthn_origin,
            expected_rp_id=webauthn_rp_id,
            credential_public_key=bytes.fromhex(stored_credential["credential_public_key"]),
            credential_current_sign_count=stored_credential["counter"]
        )
        
        # Update credential counter and last used
        await db.biometric_credentials.update_one(
            {"credential_id": stored_credential["credential_id"]},
            {
                "$set": {
                    "counter": verification.new_sign_count,
                    "last_used_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Update user last login
        await db.users.update_one(
            {"uid": user["uid"]},
            {
                "$set": {"last_login": datetime.now(timezone.utc).isoformat()},
                "$inc": {"login_count": 1}
            }
        )
        
        # Delete used challenge
        await db.webauthn_challenges.delete_one({"_id": challenge_doc["_id"]})
        
        # Log activity
        await log_activity(
            user_id=user["uid"],
            action_type="biometric_login",
            description=f"Logged in with biometric on {stored_credential['device_name']}",
            metadata={"device_name": stored_credential["device_name"]}
        )
        
        # Return user data
        user.pop("password_hash", None)
        user.pop("reset_token", None)
        
        return User(**user)
        
    except Exception as e:
        print(f"Biometric authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail="Biometric authentication failed")

@api_router.get("/auth/biometric/credentials/{user_id}")
async def get_user_biometric_credentials(user_id: str):
    """Get list of registered biometric credentials for a user"""
    credentials = await db.biometric_credentials.find({"user_id": user_id}).to_list(None)
    
    # Remove sensitive data
    for cred in credentials:
        cred.pop("_id", None)
        cred.pop("credential_public_key", None)
    
    return {
        "credentials": credentials,
        "count": len(credentials),
        "max_devices": 5
    }

@api_router.delete("/auth/biometric/credentials/{credential_id}")
async def delete_biometric_credential(credential_id: str, user_id: str):
    """Delete a biometric credential"""
    result = await db.biometric_credentials.delete_one({
        "credential_id": credential_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Log activity
    await log_activity(
        user_id=user_id,
        action_type="biometric_removed",
        description="Removed biometric credential",
        metadata={"credential_id": credential_id}
    )
    
    return {"message": "Biometric credential deleted successfully"}

# ========== USER PROFILE ROUTES ==========


@api_router.get("/users/{uid}")
async def get_user(uid: str):
    """Get user data by UID"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove sensitive data
    user.pop("password_hash", None)
    user.pop("reset_token", None)
    user["_id"] = str(user["_id"])
    
    return user

@api_router.get("/users/children/{uid}")
async def get_user_children(uid: str):
    """Get children (subordinates) of a user"""
    try:
        # Find users where parent_id or assigned_* fields match this uid
        children = await db.users.find({
            "$or": [
                {"parent_id": uid},
                {"assigned_master_stockist": uid},
                {"assigned_sub_stockist": uid}
            ]
        }).to_list(None)
        
        # Remove sensitive data from each child
        for child in children:
            child.pop("password_hash", None)
            child.pop("reset_token", None)
            child.pop("_id", None)
        
        return {"children": children, "count": len(children)}
    except Exception as e:
        print(f"Error fetching children: {str(e)}")
        return {"children": [], "count": 0}

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
        "state", "district", "taluka", "tahsil", "village", "pincode",
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

@api_router.post("/user/{uid}/upload-profile-picture")
async def upload_profile_picture(uid: str, file: UploadFile = File(...)):
    """Upload profile picture (stores as base64)"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read file content
    content = await file.read()
    
    # Check file size (max 5MB)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size must be less than 5MB")
    
    # Convert to base64
    base64_image = base64.b64encode(content).decode('utf-8')
    image_data_url = f"data:{file.content_type};base64,{base64_image}"
    
    # Update user profile
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "profile_picture": image_data_url,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Profile picture uploaded successfully",
        "profile_picture": image_data_url[:100] + "..."  # Return truncated preview
    }

@api_router.delete("/user/{uid}/profile-picture")
async def delete_profile_picture(uid: str):
    """Delete profile picture"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "profile_picture": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Profile picture deleted successfully"}

@api_router.put("/user/{uid}/complete-profile")
async def complete_profile(uid: str, request: Request):
    """Complete user profile with all additional fields"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    
    # Check for duplicate fields
    for field in ["mobile", "aadhaar_number", "pan_number"]:
        if data.get(field):
            existing = await db.users.find_one({field: data[field], "uid": {"$ne": uid}})
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"{field.replace('_', ' ').title()} already in use"
                )
    
    # Build update data
    update_data = {
        "first_name": data.get("first_name"),
        "middle_name": data.get("middle_name"),
        "last_name": data.get("last_name"),
        "mobile": data.get("mobile"),
        "gender": data.get("gender"),
        "date_of_birth": data.get("date_of_birth"),
        "address_line1": data.get("address_line1"),
        "address_line2": data.get("address_line2"),
        "city": data.get("city"),
        "state": data.get("state"),
        "district": data.get("district"),
        "tahsil": data.get("tahsil"),
        "pincode": data.get("pincode"),
        "aadhaar_number": data.get("aadhaar_number"),
        "pan_number": data.get("pan_number"),
        "upi_id": data.get("upi_id"),
        "profile_complete": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    # Update name
    if any(f in data for f in ["first_name", "middle_name", "last_name"]):
        name_parts = []
        if data.get('first_name'):
            name_parts.append(data['first_name'])
        if data.get('middle_name'):
            name_parts.append(data['middle_name'])
        if data.get('last_name'):
            name_parts.append(data['last_name'])
        if name_parts:
            update_data['name'] = ' '.join(name_parts)
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": update_data}
    )
    
    return {"message": "Profile completed successfully", "profile_complete": True}

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
    
    # Both free and VIP users can mine now
    membership_type = user.get("membership_type", "free")
    is_vip = membership_type == "vip"
    
    # Check if mining session exists (backward compatible - treat None as True for old sessions)
    mining_active = user.get("mining_active")
    if mining_active is False or not user.get("mining_start_time"):
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
    
    # Update user balance (free and VIP users)
    new_balance = user.get("prc_balance", 0) + mined_amount
    new_total_mined = user.get("total_mined", 0) + mined_amount
    
    # Calculate expiry date (2 days for free users, never for VIP)
    expiry_date = None if is_vip else (now + timedelta(days=2)).isoformat()
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "prc_balance": new_balance,
            "total_mined": new_total_mined,
            "mining_start_time": now.isoformat(),  # Reset session start for continuous mining
            "mining_active": True
        }}
    )
    
    # Create transaction record with expiry tracking
    transaction_id = f"txn_{uuid.uuid4()}"
    await db.transactions.insert_one({
        "transaction_id": transaction_id,
        "user_id": uid,
        "transaction_type": "mining",
        "prc_amount": mined_amount,
        "inr_amount": 0,
        "description": "Mining rewards claimed",
        "timestamp": now.isoformat(),
        "expires_at": expiry_date,  # NEW: Track expiry
        "expired": False,
        "balance_after": new_balance,
        "metadata": {
            "membership_type": membership_type,
            "validity": "2 days" if not is_vip else "lifetime"
        }
    })
    
    # Create wallet transaction record
    await db.wallet_transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": uid,
        "type": "credit",
        "wallet_type": "prc",
        "amount": mined_amount,
        "description": "Mining rewards claimed",
        "balance_after": new_balance,
        "created_at": now.isoformat(),
        "expires_at": expiry_date
    })
    
    # Create notification for mining claim
    validity_msg = " (Valid for 2 days - Upgrade to VIP for lifetime validity)" if not is_vip else " (Lifetime validity)"
    await create_notification(
        user_id=uid,
        title="Mining Rewards Claimed! ⛏️",
        message=f"You've claimed {round(mined_amount, 2)} PRC from mining{validity_msg}. New balance: {round(new_balance, 2)} PRC",
        notification_type="mining",
        related_id=None,
        icon="⛏️"
    )
    
    return {
        "message": "Coins claimed successfully",
        "amount": round(mined_amount, 2),
        "new_balance": round(new_balance, 2),
        "valid_prc": round(await get_valid_prc_balance(uid), 2),
        "membership_type": membership_type,
        "expires_at": expiry_date,
        "note": "Lifetime validity" if is_vip else "Valid for 2 days - Upgrade to VIP for lifetime validity"
    }

# ========== TAP GAME ROUTES ==========
@api_router.post("/game/tap/{uid}")
async def play_tap_game(uid: str, tap_data: TapGamePlay):
    """Play tap game"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is VIP - only VIP users can earn PRC
    membership_type = user.get("membership_type", "free")
    if membership_type != "vip":
        raise HTTPException(status_code=403, detail="VIP membership required to earn PRC. Free users cannot accumulate PRC.")
    
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
    
    # Create wallet transaction record
    await db.wallet_transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": uid,
        "type": "credit",
        "wallet_type": "prc",
        "amount": taps_to_add,
        "description": f"Tap game rewards ({taps_to_add} taps)",
        "balance_after": user.get("prc_balance", 0) + taps_to_add,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
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

@api_router.get("/referral/stats/{uid}")
async def get_referral_stats(uid: str):
    """Get referral statistics for a user"""
    # Total referrals
    total_referrals = await db.users.count_documents({"referred_by": uid})
    
    # Active referrals (logged in within last 24 hours)
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    yesterday_iso = yesterday.isoformat()
    
    # Get all referrals to check activity
    all_referrals = await db.users.find(
        {"referred_by": uid}, 
        {"_id": 0, "uid": 1, "last_login": 1, "membership_type": 1, "is_active": 1}
    ).to_list(None)
    
    active_count = 0
    vip_count = 0
    
    for ref in all_referrals:
        # Check if VIP
        if ref.get("membership_type") == "vip":
            vip_count += 1
        
        # Check if active (logged in recently and account is active)
        if ref.get("is_active", True):
            last_login = ref.get("last_login")
            if last_login:
                try:
                    last_login_dt = datetime.fromisoformat(last_login) if isinstance(last_login, str) else last_login
                    if last_login_dt >= yesterday:
                        active_count += 1
                except:
                    pass
    
    return {
        "total_referrals": total_referrals,
        "active_referrals": active_count,
        "vip_referrals": vip_count
    }

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

@api_router.get("/products")
async def get_products(page: int = 1, limit: int = 20):
    """Get active products with pagination (public endpoint)"""
    # Calculate skip value for pagination
    skip = (page - 1) * limit
    
    # Get total count
    total = await db.products.count_documents({
        "is_active": True,
        "visible": True
    })
    
    # Get paginated products
    products = await db.products.find(
        {
            "is_active": True,
            "visible": True
        }, 
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Convert datetime fields to ISO format for JSON serialization
    for product in products:
        for field in ["created_at", "updated_at", "visible_from", "visible_till"]:
            if product.get(field):
                if isinstance(product[field], datetime):
                    product[field] = product[field].isoformat()
                elif isinstance(product[field], str):
                    try:
                        product[field] = datetime.fromisoformat(product[field]).isoformat()
                    except:
                        pass
    
    return {
        "products": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
        "has_more": skip + len(products) < total
    }

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    """Get single product"""
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return Product(**product)

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
    total_cash = sum(item.get("cash_price", 0) * item["quantity"] for item in cart["items"])
    
    # Get delivery charge configuration (10% of PRC value in cash as default)
    # PRC to cash conversion: 10 PRC = ₹1, so total_prc/10 = cash equivalent
    config = await db.system_config.find_one({"config_type": "delivery"})
    delivery_rate = config.get("delivery_charge_rate", 0.10) if config else 0.10
    prc_cash_value = total_prc / 10  # Convert PRC to ₹
    delivery_charge = round(prc_cash_value * delivery_rate, 2)
    
    # Calculate cashback (25% of PRC value converted to ₹, 10 PRC = ₹1)
    cashback_amount = (total_prc * 0.25) / 10
    
    # Check if user has enough PRC
    if user.get("prc_balance", 0) < total_prc:
        raise HTTPException(status_code=400, detail="Insufficient PRC balance")
    
    # Atomic PRC deduction
    new_prc_balance = user["prc_balance"] - total_prc
    
    # Get current cashback balance (try both field names for backward compatibility)
    current_cashback = user.get("cashback_balance", user.get("cash_wallet_balance", 0))
    
    # Check if user has enough balance for delivery charge, otherwise create lien
    if current_cashback >= delivery_charge:
        # Deduct delivery charge immediately
        new_cashback_balance = current_cashback + cashback_amount - delivery_charge
        pending_delivery_lien = 0
    else:
        # Create lien for delivery charge
        new_cashback_balance = current_cashback + cashback_amount
        pending_delivery_lien = delivery_charge
    
    # Find nearest outlet based on user location (state/district)
    # Try to find outlet in same district, then state, then any active outlet
    nearest_outlet = None
    user_district = user.get("district", "").strip()
    user_state = user.get("state", "").strip()
    
    logging.info(f"Checkout: Finding outlet for user district='{user_district}', state='{user_state}'")
    
    if user_district:
        # Escape special regex characters and use case-insensitive matching
        escaped_district = re.escape(user_district)
        logging.info(f"Checkout: Searching for outlet in district '{escaped_district}' (escaped)")
        nearest_outlet = await db.users.find_one({
            "role": "outlet",
            "district": {"$regex": f"^{escaped_district}$", "$options": "i"}
        })
        if nearest_outlet:
            logging.info(f"Checkout: Found outlet by district: {nearest_outlet.get('uid')}")
    
    if not nearest_outlet and user_state:
        # Escape special regex characters and use case-insensitive matching
        escaped_state = re.escape(user_state)
        logging.info(f"Checkout: Searching for outlet in state '{escaped_state}' (escaped)")
        nearest_outlet = await db.users.find_one({
            "role": "outlet",
            "state": {"$regex": f"^{escaped_state}$", "$options": "i"}
        })
        if nearest_outlet:
            logging.info(f"Checkout: Found outlet by state: {nearest_outlet.get('uid')}")
    
    if not nearest_outlet:
        # Fall back to any active outlet
        logging.info("Checkout: No outlet found by location, using fallback")
        nearest_outlet = await db.users.find_one({"role": "outlet"})
        if nearest_outlet:
            logging.info(f"Checkout: Found outlet via fallback: {nearest_outlet.get('uid')}")
        else:
            logging.warning("Checkout: No outlets found in database!")
    
    outlet_id = nearest_outlet.get("uid") if nearest_outlet else None
    logging.info(f"Checkout: Final outlet_id assigned: {outlet_id}")
    
    # Create order
    order = Order(
        user_id=user_id,
        items=cart["items"],
        total_prc=total_prc,
        total_cash=total_cash,
        delivery_charge=delivery_charge,
        cashback_amount=cashback_amount,
        delivery_address=delivery_address or "N/A"
    )
    
    order_dict = order.model_dump()
    order_dict["created_at"] = order_dict["created_at"].isoformat()
    order_dict["pending_delivery_lien"] = pending_delivery_lien
    order_dict["outlet_id"] = outlet_id
    order_dict["assigned_outlet"] = outlet_id  # For backward compatibility
    
    # Update user balances (use cashback_balance as primary field)
    update_fields = {
        "prc_balance": new_prc_balance,
        "cashback_balance": new_cashback_balance,
        "cash_wallet_balance": new_cashback_balance  # Keep both for compatibility
    }
    
    # Add lien if delivery charge couldn't be deducted
    if pending_delivery_lien > 0:
        current_lien = user.get("wallet_maintenance_due", 0)
        update_fields["wallet_maintenance_due"] = current_lien + pending_delivery_lien
    
    await db.users.update_one(
        {"uid": user_id},
        {"$set": update_fields}
    )
    
    # Create wallet transaction records
    transactions = []
    
    # PRC deduction transaction
    transactions.append({
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "debit",
        "wallet_type": "prc",
        "amount": total_prc,
        "description": f"Order #{order.order_id[:8]} - Product purchase",
        "balance_after": new_prc_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Cashback credit transaction
    transactions.append({
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "credit",
        "wallet_type": "cashback",
        "amount": cashback_amount,
        "description": f"Order #{order.order_id[:8]} - 25% cashback",
        "balance_after": new_cashback_balance if pending_delivery_lien == 0 else current_cashback + cashback_amount,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Delivery charge deduction transaction (if deducted)
    if pending_delivery_lien == 0 and delivery_charge > 0:
        transactions.append({
            "transaction_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "debit",
            "wallet_type": "cashback",
            "amount": delivery_charge,
            "description": f"Order #{order.order_id[:8]} - Delivery charge",
            "balance_after": new_cashback_balance,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Insert transactions to the correct collection (transactions, not wallet_transactions)
    if transactions:
        await db.transactions.insert_many(transactions)
    
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
    
    # Create notification for order placement
    await create_notification(
        user_id=user_id,
        title="Order Placed Successfully! 🎉",
        message=f"Your order #{order.order_id[:8]} has been placed. Secret code: {order.secret_code}. Cashback earned: ₹{cashback_amount:.2f}",
        notification_type="order",
        related_id=order.order_id,
        icon="🛒"
    )
    
    return {
        "message": "Order placed successfully",
        "order_id": order.order_id,
        "secret_code": order.secret_code,
        "total_prc": total_prc,
        "delivery_charge": delivery_charge,
        "delivery_charge_status": "deducted" if pending_delivery_lien == 0 else "pending_lien",
        "pending_lien": pending_delivery_lien,
        "cashback_earned": cashback_amount,
        "new_prc_balance": new_prc_balance,
        "new_cashback_balance": new_cashback_balance
    }

# ========== ORDER/REDEEM ROUTES (Legacy Single Product) ==========

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
    
    # Create notification for order verification
    await create_notification(
        user_id=order.get("user_id"),
        title="Order Verified! ✅",
        message=f"Your order #{order.get('order_id', 'N/A')[:8]} has been verified and is being processed.",
        notification_type="order",
        related_id=order.get("order_id"),
        icon="✅"
    )
    
    # Remove MongoDB _id for JSON serialization
    order["_id"] = str(order["_id"])
    
    return {"message": "Order verified", "order": order}

@api_router.post("/orders/{uid}", response_model=OrderSingleProduct)
async def create_order_alias(uid: str, order_data: OrderCreate):
    """Create order - Backward compatibility alias"""
    return await create_order_legacy(uid, order_data)

@api_router.post("/orders/legacy/{uid}", response_model=OrderSingleProduct)
async def create_order_legacy(uid: str, order_data: OrderCreate):
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

@api_router.post("/orders/{order_id}/deliver")
async def deliver_order(order_id: str, request: Request):
    """Mark order as delivered (Outlet)"""
    data = await request.json()
    outlet_id = data.get("outlet_id")
    
    # Get the order first to access items
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Deduct stock from outlet's inventory
    now = datetime.now(timezone.utc)
    for item in order.get("items", []):
        product_id = item.get("product_id")
        quantity = item.get("quantity", 0)
        
        if product_id and quantity > 0:
            # Check if outlet has stock
            outlet_stock = await db.stock_inventory.find_one({
                "user_id": outlet_id,
                "product_id": product_id
            })
            
            if outlet_stock and outlet_stock.get("quantity", 0) >= quantity:
                # Deduct stock
                await db.stock_inventory.update_one(
                    {"user_id": outlet_id, "product_id": product_id},
                    {
                        "$inc": {"quantity": -quantity},
                        "$set": {"updated_at": now.isoformat()}
                    }
                )
            else:
                # Log warning if insufficient stock
                print(f"Warning: Outlet {outlet_id} has insufficient stock for product {product_id}")
    
    # Update order status
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": "delivered",
            "delivery_status": "delivered",
            "delivered_at": now.isoformat(),
            "outlet_id": outlet_id,
            "assigned_outlet": outlet_id
        }}
    )
    
    # Trigger automatic commission distribution
    distribution_result = await distribute_delivery_charge(order_id)
    
    return {
        "message": "Order delivered successfully",
        "commission_distributed": distribution_result
    }


@api_router.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    """Cancel order and refund PRC (only pending/verified orders)"""
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only allow cancellation for pending or verified orders
    if order.get("status") not in ["pending", "verified"]:
        raise HTTPException(status_code=400, detail="Cannot cancel delivered or cancelled orders")
    
    # Get order details
    user_id = order.get("user_id")
    total_prc = order.get("total_prc", 0)
    cashback_amount = order.get("cashback_amount", 0)
    
    # Calculate cashback in ₹ (already calculated during checkout, but recalculate if missing)
    if cashback_amount == 0:
        cashback_amount = (total_prc * 0.25) / 10  # 25% of PRC, converted to ₹
    
    # Get user to check current balances
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current cashback balance (check all possible field names)
    current_cashback = user.get("cashback_balance", user.get("cash_wallet_balance", 0))
    
    # Calculate new balances
    new_prc_balance = user.get("prc_balance", 0) + total_prc
    new_cashback_balance = max(0, current_cashback - cashback_amount)  # Don't go negative
    
    # Update user balances (both PRC refund and cashback deduction)
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {
            "prc_balance": new_prc_balance,
            "cashback_balance": new_cashback_balance,
            "cash_wallet_balance": new_cashback_balance  # Keep both fields in sync
        }}
    )
    
    # Restore product stock
    if order.get("items"):
        for item in order["items"]:
            await db.products.update_one(
                {"product_id": item["product_id"]},
                {"$inc": {"available_stock": item["quantity"]}}
            )
    
    # Update order status
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Order cancelled successfully",
        "refunded_prc": total_prc,
        "deducted_cashback": round(cashback_amount, 2),
        "new_prc_balance": new_prc_balance,
        "new_cashback_balance": new_cashback_balance
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
        "cashback_balance": user.get("cashback_balance", user.get("cashback_wallet_balance", user.get("cash_wallet_balance", 0))),
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

@api_router.post("/admin/profit-wallet/credit")
async def admin_credit_profit_wallet(request: Request):
    """Admin: Credit amount to user's profit wallet"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    user_id = data.get("user_id")
    amount = data.get("amount", 0)
    description = data.get("description", "Admin credit to profit wallet")
    
    if not admin_uid or not user_id or amount <= 0:
        raise HTTPException(status_code=400, detail="Admin UID, user ID, and positive amount required")
    
    # Verify admin
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admin can credit profit wallet")
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current balance
    current_balance = user.get("profit_wallet_balance", 0)
    new_balance = current_balance + amount
    
    # Update balance
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"profit_wallet_balance": new_balance}}
    )
    
    # Create transaction log
    transaction = {
        "transaction_id": f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
        "user_id": user_id,
        "wallet_type": "profit",
        "type": "admin_credit",
        "amount": amount,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "description": description,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "credited_by": admin_uid,
            "admin_name": admin.get("name", "Admin")
        }
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Profit wallet credited successfully",
        "user_id": user_id,
        "amount": amount,
        "previous_balance": current_balance,
        "new_balance": new_balance
    }

@api_router.post("/admin/profit-wallet/deduct")
async def admin_deduct_profit_wallet(request: Request):
    """Admin: Deduct amount from user's profit wallet (with lien if insufficient)"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    user_id = data.get("user_id")
    amount = data.get("amount", 0)
    description = data.get("description", "Admin deduction from profit wallet")
    
    if not admin_uid or not user_id or amount <= 0:
        raise HTTPException(status_code=400, detail="Admin UID, user ID, and positive amount required")
    
    # Verify admin
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admin can deduct from profit wallet")
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current balance
    current_balance = user.get("profit_wallet_balance", 0)
    current_lien = user.get("profit_wallet_lien", 0)
    
    # Check if sufficient balance
    if current_balance >= amount:
        # Full deduction from balance
        new_balance = current_balance - amount
        new_lien = current_lien
        lien_added = 0
        message = f"₹{amount} deducted from profit wallet"
    else:
        # Partial deduction, remaining as lien
        deducted_from_balance = current_balance
        lien_amount = amount - current_balance
        new_balance = 0
        new_lien = current_lien + lien_amount
        lien_added = lien_amount
        message = f"₹{deducted_from_balance} deducted, ₹{lien_amount} marked as lien"
    
    # Update balance and lien
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {
            "profit_wallet_balance": new_balance,
            "profit_wallet_lien": new_lien,
            "profit_wallet_status": "lien_pending" if new_lien > 0 else "active"
        }}
    )
    
    # Create transaction log
    transaction = {
        "transaction_id": f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
        "user_id": user_id,
        "wallet_type": "profit",
        "type": "admin_debit",
        "amount": -amount,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "description": description,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "deducted_by": admin_uid,
            "admin_name": admin.get("name", "Admin"),
            "lien_added": lien_added,
            "total_lien": new_lien
        }
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": message,
        "user_id": user_id,
        "amount_deducted": amount,
        "previous_balance": current_balance,
        "new_balance": new_balance,
        "lien_added": lien_added,
        "total_lien": new_lien
    }

@api_router.post("/admin/profit-wallet/adjust")
async def admin_adjust_profit_wallet(request: Request):
    """Admin: Set profit wallet to specific amount (adjustment)"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    user_id = data.get("user_id")
    new_amount = data.get("amount")
    description = data.get("description", "Admin balance adjustment")
    
    if not admin_uid or not user_id or new_amount is None or new_amount < 0:
        raise HTTPException(status_code=400, detail="Admin UID, user ID, and non-negative amount required")
    
    # Verify admin
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admin can adjust profit wallet")
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current balance
    current_balance = user.get("profit_wallet_balance", 0)
    difference = new_amount - current_balance
    
    # Update balance
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"profit_wallet_balance": new_amount}}
    )
    
    # Create transaction log
    transaction = {
        "transaction_id": f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
        "user_id": user_id,
        "wallet_type": "profit",
        "type": "admin_adjustment",
        "amount": difference,
        "balance_before": current_balance,
        "balance_after": new_amount,
        "description": description,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "adjusted_by": admin_uid,
            "admin_name": admin.get("name", "Admin")
        }
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Profit wallet adjusted successfully",
        "user_id": user_id,
        "previous_balance": current_balance,
        "new_balance": new_amount,
        "adjustment": difference
    }

@api_router.post("/admin/apply-monthly-fees")
async def apply_monthly_fees_to_all_users(request: Request):
    """Admin: Apply monthly maintenance fee to all VIP users' cashback AND profit wallets"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    
    if not admin_uid:
        raise HTTPException(status_code=400, detail="Admin UID required")
    
    # Verify admin
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admin can apply monthly fees")
    
    # Get all VIP users
    vip_users = await db.users.find({"membership_type": "vip"}).to_list(None)
    
    cashback_fee_applied = 0
    profit_fee_applied = 0
    total_users_processed = 0
    errors = []
    
    now = datetime.now(timezone.utc)
    
    for user in vip_users:
        try:
            uid = user["uid"]
            total_users_processed += 1
            
            # Check if 30 days passed since last maintenance
            last_maintenance = user.get("last_wallet_maintenance")
            vip_activation = user.get("vip_activation_date")
            
            if last_maintenance:
                if isinstance(last_maintenance, str):
                    last_maintenance = datetime.fromisoformat(last_maintenance)
                next_due = last_maintenance + timedelta(days=30)
            elif vip_activation:
                if isinstance(vip_activation, str):
                    vip_activation = datetime.fromisoformat(vip_activation)
                next_due = vip_activation + timedelta(days=30)
            else:
                continue  # Skip if no dates set
            
            if now < next_due:
                continue  # Not yet due
            
            # Apply ₹99 fee to CASHBACK wallet
            cashback_balance = user.get("cashback_wallet_balance", 0)
            cashback_lien = user.get("wallet_maintenance_due", 0)
            
            if cashback_balance >= 99:
                # Deduct from balance
                new_cashback_balance = cashback_balance - 99
                new_cashback_lien = cashback_lien
            else:
                # Mark as lien
                deducted = cashback_balance
                lien_to_add = 99 - deducted
                new_cashback_balance = 0
                new_cashback_lien = cashback_lien + lien_to_add
            
            # Apply ₹99 fee to PROFIT wallet
            profit_balance = user.get("profit_wallet_balance", 0)
            profit_lien = user.get("profit_wallet_lien", 0)
            
            if profit_balance >= 99:
                # Deduct from balance
                new_profit_balance = profit_balance - 99
                new_profit_lien = profit_lien
            else:
                # Mark as lien
                deducted = profit_balance
                lien_to_add = 99 - deducted
                new_profit_balance = 0
                new_profit_lien = profit_lien + lien_to_add
            
            # Update user
            await db.users.update_one(
                {"uid": uid},
                {"$set": {
                    "cashback_wallet_balance": new_cashback_balance,
                    "wallet_maintenance_due": new_cashback_lien,
                    "wallet_status": "lien_pending" if new_cashback_lien > 0 else "active",
                    "profit_wallet_balance": new_profit_balance,
                    "profit_wallet_lien": new_profit_lien,
                    "profit_wallet_status": "lien_pending" if new_profit_lien > 0 else "active",
                    "last_wallet_maintenance": now.isoformat()
                }}
            )
            
            # Create transaction logs
            # Cashback wallet transaction
            cashback_txn = {
                "transaction_id": f"TXN-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
                "user_id": uid,
                "wallet_type": "cashback",
                "type": "monthly_maintenance",
                "amount": -99,
                "balance_before": cashback_balance,
                "balance_after": new_cashback_balance,
                "description": "Monthly maintenance fee (₹99) for cashback wallet",
                "status": "completed",
                "created_at": now.isoformat(),
                "metadata": {
                    "fee_type": "monthly_maintenance",
                    "lien_added": new_cashback_lien - cashback_lien
                }
            }
            await db.transactions.insert_one(cashback_txn)
            cashback_fee_applied += 1
            
            # Profit wallet transaction
            profit_txn = {
                "transaction_id": f"TXN-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
                "user_id": uid,
                "wallet_type": "profit",
                "type": "monthly_maintenance",
                "amount": -99,
                "balance_before": profit_balance,
                "balance_after": new_profit_balance,
                "description": "Monthly maintenance fee (₹99) for profit wallet",
                "status": "completed",
                "created_at": now.isoformat(),
                "metadata": {
                    "fee_type": "monthly_maintenance",
                    "lien_added": new_profit_lien - profit_lien
                }
            }
            await db.transactions.insert_one(profit_txn)
            profit_fee_applied += 1
            
        except Exception as e:
            errors.append(f"User {user.get('uid')}: {str(e)}")
            continue
    
    return {
        "message": "Monthly fees applied",
        "total_users_processed": total_users_processed,
        "cashback_fees_applied": cashback_fee_applied,
        "profit_fees_applied": profit_fee_applied,
        "errors": errors if errors else None
    }

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
    
    # Create transaction log entry
    transaction = {
        "transaction_id": f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
        "user_id": uid,
        "wallet_type": "cashback",
        "type": "admin_credit",
        "amount": amount,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "description": f"Admin credited ₹{amount} to cashback wallet",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "lien_cleared": pending_lien - new_lien if pending_lien > 0 else 0,
            "credited_by": "admin"
        }
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": message,
        "credited_amount": amount,
        "lien_cleared": pending_lien - new_lien if pending_lien > 0 else 0,
        "new_balance": new_balance,
        "remaining_lien": new_lien
    }

@api_router.post("/wallet/cashback/withdraw")
async def request_cashback_withdrawal(request: Request):
    """Request cashback wallet withdrawal with enhanced fee logic and lien checking"""
    data = await request.json()
    user_id = data.get("user_id")
    amount = data.get("amount", 0)
    payment_mode = data.get("payment_mode", "upi")
    upi_id = data.get("upi_id")
    phone_number = data.get("phone_number")
    account_holder_name = data.get("account_holder_name")
    bank_name = data.get("bank_name")
    bank_account = data.get("bank_account")
    ifsc_code = data.get("ifsc_code")
    
    # Validate minimum withdrawal based on membership
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    min_withdrawal = await get_withdrawal_limit(user_id)
    if amount < min_withdrawal:
        membership_type = user.get("membership_type", "free")
        if membership_type == "free":
            raise HTTPException(
                status_code=400, 
                detail=f"Minimum withdrawal for free users is ₹{min_withdrawal}. Upgrade to VIP for ₹100 minimum."
            )
        else:
            raise HTTPException(status_code=400, detail=f"Minimum withdrawal amount is ₹{min_withdrawal}")
    
    # Check withdrawal eligibility (includes KYC, balance, and lien checks)
    eligibility = await check_withdrawal_eligibility(user_id, amount, "cashback")
    
    if not eligibility["eligible"]:
        raise HTTPException(
            status_code=400, 
            detail=eligibility["reason"]
        )
    
    cashback_balance = user.get("cashback_balance", 0)
    
    # NEW LOGIC: Fee deducted from withdrawal amount
    withdrawal_fee = 5.0
    amount_to_receive = amount - withdrawal_fee  # User receives less
    wallet_debit = amount  # Wallet debited only requested amount
    
    # Create withdrawal request
    withdrawal = {
        "withdrawal_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "wallet_type": "cashback",
        "amount_requested": amount,
        "fee": withdrawal_fee,
        "amount_to_receive": amount_to_receive,
        "payment_mode": payment_mode,
        "upi_id": upi_id,
        "phone_number": phone_number,
        "account_holder_name": account_holder_name,
        "bank_name": bank_name,
        "bank_account": bank_account,
        "ifsc_code": ifsc_code,
        "status": "pending",
        "utr_number": None,
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None
    }
    
    # Log transaction (debit wallet)
    transaction_id = await log_transaction(
        user_id=user_id,
        wallet_type="cashback",
        transaction_type="withdrawal",
        amount=wallet_debit,
        description=f"Withdrawal request - ₹{amount} (Fee: ₹{withdrawal_fee}, You receive: ₹{amount_to_receive})",
        metadata={
            "withdrawal_id": withdrawal["withdrawal_id"],
            "payment_mode": payment_mode,
            "amount_requested": amount,
            "fee": withdrawal_fee,
            "amount_to_receive": amount_to_receive
        },
        related_id=withdrawal["withdrawal_id"],
        related_type="withdrawal"
    )
    
    # Insert withdrawal request
    await db.cashback_withdrawals.insert_one(withdrawal)
    
    # Create notification for withdrawal request
    await create_notification(
        user_id=user_id,
        title="Withdrawal Requested 💰",
        message=f"Your withdrawal request of ₹{amount} has been submitted. You'll receive ₹{amount_to_receive} after ₹{withdrawal_fee} fee.",
        notification_type="withdrawal",
        related_id=withdrawal["withdrawal_id"],
        icon="💰"
    )
    
    return {
        "message": "Withdrawal request submitted successfully",
        "withdrawal_id": withdrawal["withdrawal_id"],
        "amount_requested": amount,
        "withdrawal_fee": withdrawal_fee,
        "amount_to_receive": amount_to_receive,
        "wallet_debited": wallet_debit,
        "lien_amount": eligibility["lien_amount"],
        "transaction_id": transaction_id,
        "status": "pending"
    }

@api_router.post("/wallet/profit/withdraw")
async def request_profit_withdrawal(request: Request):
    """Request profit wallet withdrawal (for stockists/outlets) with enhanced fee logic"""
    data = await request.json()
    user_id = data.get("user_id")
    amount = data.get("amount", 0)
    payment_mode = data.get("payment_mode", "upi")
    upi_id = data.get("upi_id")
    phone_number = data.get("phone_number")
    account_holder_name = data.get("account_holder_name")
    bank_name = data.get("bank_name")
    bank_account = data.get("bank_account")
    ifsc_code = data.get("ifsc_code")
    
    # Validate minimum withdrawal
    if amount < 50:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is ₹50")
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check role
    if user.get("role") not in ["master_stockist", "sub_stockist", "outlet"]:
        raise HTTPException(status_code=403, detail="Only stockists and outlets can withdraw from profit wallet")
    
    # Check withdrawal eligibility (includes balance and lien checks)
    eligibility = await check_withdrawal_eligibility(user_id, amount, "profit")
    
    if not eligibility["eligible"]:
        raise HTTPException(
            status_code=400, 
            detail=eligibility["reason"]
        )
    
    # NEW LOGIC: Fee deducted from withdrawal amount
    withdrawal_fee = 5.0
    amount_to_receive = amount - withdrawal_fee  # User receives less
    wallet_debit = amount  # Wallet debited only requested amount
    
    # Create withdrawal request
    withdrawal = {
        "withdrawal_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "entity_type": user.get("role"),
        "wallet_type": "profit",
        "amount_requested": amount,
        "fee": withdrawal_fee,
        "amount_to_receive": amount_to_receive,
        "payment_mode": payment_mode,
        "upi_id": upi_id,
        "phone_number": phone_number,
        "account_holder_name": account_holder_name,
        "bank_name": bank_name,
        "bank_account": bank_account,
        "ifsc_code": ifsc_code,
        "status": "pending",
        "utr_number": None,
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None
    }
    
    # Log transaction (debit wallet)
    transaction_id = await log_transaction(
        user_id=user_id,
        wallet_type="profit",
        transaction_type="withdrawal",
        amount=wallet_debit,
        description=f"Withdrawal request - ₹{amount} (Fee: ₹{withdrawal_fee}, You receive: ₹{amount_to_receive})",
        metadata={
            "withdrawal_id": withdrawal["withdrawal_id"],
            "payment_mode": payment_mode,
            "amount_requested": amount,
            "fee": withdrawal_fee,
            "amount_to_receive": amount_to_receive,
            "lien_amount": eligibility["lien_amount"]
        },
        related_id=withdrawal["withdrawal_id"],
        related_type="withdrawal"
    )
    
    # Insert withdrawal request
    await db.profit_withdrawals.insert_one(withdrawal)
    
    return {
        "message": "Withdrawal request submitted successfully",
        "withdrawal_id": withdrawal["withdrawal_id"],
        "amount_requested": amount,
        "withdrawal_fee": withdrawal_fee,
        "amount_to_receive": amount_to_receive,
        "wallet_debited": wallet_debit,
        "lien_amount": eligibility["lien_amount"],
        "transaction_id": transaction_id,
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


@api_router.get("/wallet/transactions/{uid}")
async def get_wallet_transactions(uid: str, wallet_type: str = None, page: int = 1, limit: int = 20):
    """Get user's comprehensive wallet transaction history with pagination"""
    query = {"user_id": uid}
    
    # Filter by wallet type if specified
    if wallet_type:
        query["wallet_type"] = wallet_type
    
    # Get total count
    total = await db.transactions.count_documents(query)
    total_pages = (total + limit - 1) // limit
    skip = (page - 1) * limit
    
    # Get from new transactions collection
    transactions = await db.transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calculate totals for current page
    total_credit = sum(t["amount"] for t in transactions if t["type"] in ["mining", "tap_game", "referral", "cashback", "withdrawal_rejected", "admin_credit", "profit_share"])
    total_debit = sum(t["amount"] for t in transactions if t["type"] in ["order", "withdrawal", "admin_debit", "delivery_charge"])
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "total_credit": total_credit,
        "total_debit": total_debit
    }

@api_router.get("/transactions/user/{uid}/detailed")
async def get_detailed_transaction_history(
    uid: str, 
    wallet_type: str = None,
    transaction_type: str = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = 100,
    skip: int = 0
):
    """Get detailed transaction history with advanced filtering"""
    query = {"user_id": uid}
    
    # Filters
    if wallet_type:
        query["wallet_type"] = wallet_type
    if transaction_type:
        query["type"] = transaction_type
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        query.setdefault("created_at", {})["$lte"] = end_date
    
    # Get transactions
    transactions = await db.transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count
    total_count = await db.transactions.count_documents(query)
    
    # Calculate summary
    all_transactions = await db.transactions.find(query).to_list(None)
    summary = {
        "total_transactions": total_count,
        "total_credit": sum(t["amount"] for t in all_transactions if t["type"] in ["mining", "tap_game", "referral", "cashback", "withdrawal_rejected", "admin_credit", "profit_share"]),
        "total_debit": sum(t["amount"] for t in all_transactions if t["type"] in ["order", "withdrawal", "admin_debit", "delivery_charge"]),
        "transactions_by_type": {}
    }
    
    # Count by type
    for t in all_transactions:
        t_type = t["type"]
        summary["transactions_by_type"][t_type] = summary["transactions_by_type"].get(t_type, 0) + 1
    
    return {
        "transactions": transactions,
        "summary": summary,
        "pagination": {
            "total": total_count,
            "limit": limit,
            "skip": skip,
            "has_more": (skip + limit) < total_count
        }
    }

@api_router.get("/admin/transactions/all")
async def get_all_transactions_admin(
    wallet_type: str = None,
    transaction_type: str = None,
    start_date: str = None,
    limit: int = 100,
    skip: int = 0
):
    """Admin: Get all transactions across all users"""
    query = {}
    
    if wallet_type:
        query["wallet_type"] = wallet_type
    if transaction_type:
        query["type"] = transaction_type
    if start_date:
        query["created_at"] = {"$gte": start_date}
    
    # Get transactions
    transactions = await db.transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count
    total_count = await db.transactions.count_documents(query)
    
    # Get user details for each transaction
    for t in transactions:
        user = await db.users.find_one({"uid": t["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
        if user:
            t["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            t["user_email"] = user.get("email", "")
    
    return {
        "transactions": transactions,
        "total": total_count,
        "pagination": {
            "limit": limit,
            "skip": skip,
            "has_more": (skip + limit) < total_count
        }
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
    """Get comprehensive admin dashboard KPIs"""
    # User Statistics
    total_users = await db.users.count_documents({})
    vip_users = await db.users.count_documents({"membership_type": "vip"})
    free_users = await db.users.count_documents({"membership_type": {"$ne": "vip"}})
    
    # Staff & Stockist Statistics
    managers = await db.users.count_documents({"role": "manager"})
    master_stockists = await db.users.count_documents({"role": "master_stockist"})
    sub_stockists = await db.users.count_documents({"role": "sub_stockist"})
    outlets = await db.users.count_documents({"role": "outlet"})
    
    # Orders Statistics
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    delivered_orders = await db.orders.count_documents({"status": "delivered"})
    
    # KYC Statistics
    total_kyc = await db.kyc_documents.count_documents({})
    pending_kyc = await db.kyc_documents.count_documents({"status": "pending"})
    verified_kyc = await db.kyc_documents.count_documents({"status": "verified"})
    rejected_kyc = await db.kyc_documents.count_documents({"status": "rejected"})
    
    # VIP Payments Statistics with Total Amount
    total_vip_requests = await db.vip_payments.count_documents({})
    pending_vip_approvals = await db.vip_payments.count_documents({"status": "pending"})
    approved_vip = await db.vip_payments.count_documents({"status": "approved"})
    
    # Calculate total VIP membership fees collected
    vip_fees_pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    vip_fees_result = await db.vip_payments.aggregate(vip_fees_pipeline).to_list(1)
    total_vip_fees = vip_fees_result[0]["total"] if vip_fees_result else 0
    
    # Withdrawal Statistics
    pending_cashback_withdrawals = await db.cashback_withdrawals.count_documents({"status": "pending"})
    pending_profit_withdrawals = await db.profit_withdrawals.count_documents({"status": "pending"})
    total_pending_withdrawals = pending_cashback_withdrawals + pending_profit_withdrawals
    
    # Calculate total withdrawal amounts (pending and processed)
    cashback_pending_pipeline = [
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    cashback_processed_pipeline = [
        {"$match": {"status": {"$in": ["approved", "completed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    profit_pending_pipeline = [
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    profit_processed_pipeline = [
        {"$match": {"status": {"$in": ["approved", "completed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    cashback_pending_result = await db.cashback_withdrawals.aggregate(cashback_pending_pipeline).to_list(1)
    cashback_processed_result = await db.cashback_withdrawals.aggregate(cashback_processed_pipeline).to_list(1)
    profit_pending_result = await db.profit_withdrawals.aggregate(profit_pending_pipeline).to_list(1)
    profit_processed_result = await db.profit_withdrawals.aggregate(profit_processed_pipeline).to_list(1)
    
    pending_cashback_amount = cashback_pending_result[0]["total"] if cashback_pending_result else 0
    processed_cashback_amount = cashback_processed_result[0]["total"] if cashback_processed_result else 0
    pending_profit_amount = profit_pending_result[0]["total"] if profit_pending_result else 0
    processed_profit_amount = profit_processed_result[0]["total"] if profit_processed_result else 0
    
    total_pending_withdrawal_amount = pending_cashback_amount + pending_profit_amount
    total_processed_withdrawal_amount = processed_cashback_amount + processed_profit_amount
    
    # Product Statistics
    total_products = await db.products.count_documents({})
    active_products = await db.products.count_documents({"is_active": True, "visible": True})
    
    # Financial Overview - Calculate total revenue from delivered orders
    revenue_pipeline = [
        {"$match": {"status": "delivered"}},
        {"$group": {"_id": None, "total_cash": {"$sum": "$total_cash_price"}, "total_prc": {"$sum": "$total_prc_price"}}}
    ]
    revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
    total_revenue_inr = revenue_result[0]["total_cash"] if revenue_result else 0
    total_revenue_prc = revenue_result[0]["total_prc"] if revenue_result else 0
    
    # Calculate PRC to INR conversion (10 PRC = 1 INR)
    total_prc_value_in_inr = total_revenue_prc / 10 if total_revenue_prc else 0
    
    # Stock Movement Statistics
    pending_stock_movements = await db.stock_movements.count_documents({"status": "pending_admin"})
    approved_stock_movements = await db.stock_movements.count_documents({"status": "approved"})
    completed_stock_movements = await db.stock_movements.count_documents({"status": "completed"})
    
    # Security Deposit Statistics
    pending_deposits = await db.security_deposits.count_documents({"status": "pending"})
    approved_deposits = await db.security_deposits.count_documents({"status": "approved"})
    
    # Calculate total security deposit amount
    deposit_pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    deposit_result = await db.security_deposits.aggregate(deposit_pipeline).to_list(1)
    total_security_deposits = deposit_result[0]["total"] if deposit_result else 0
    
    # Annual Renewal Statistics with Total Fees
    pending_renewals = await db.annual_renewals.count_documents({"status": "pending"})
    active_renewals = await db.annual_renewals.count_documents({"status": "approved"})
    overdue_entities = await db.users.count_documents({"renewal_status": "overdue"})
    
    # Calculate total renewal fees collected
    renewal_fees_pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    renewal_fees_result = await db.annual_renewals.aggregate(renewal_fees_pipeline).to_list(1)
    total_renewal_fees = renewal_fees_result[0]["total"] if renewal_fees_result else 0
    
    # Calculate total lien (pending maintenance fees)
    lien_pipeline = [
        {"$match": {"pending_lien": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$pending_lien"}}}
    ]
    lien_result = await db.users.aggregate(lien_pipeline).to_list(1)
    total_lien = lien_result[0]["total"] if lien_result else 0
    
    # Calculate wallet maintenance fees collected
    wallet_fees_pipeline = [
        {"$match": {"transaction_type": "fee", "description": {"$regex": "maintenance fee", "$options": "i"}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    wallet_fees_result = await db.wallet_transactions.aggregate(wallet_fees_pipeline).to_list(1)
    total_wallet_fees = abs(wallet_fees_result[0]["total"]) if wallet_fees_result else 0
    
    # Calculate marketplace/delivery charges collected
    marketplace_charges_pipeline = [
        {"$match": {"status": "delivered"}},
        {"$group": {"_id": None, "total": {"$sum": "$delivery_charge"}}}
    ]
    marketplace_charges_result = await db.orders.aggregate(marketplace_charges_pipeline).to_list(1)
    total_marketplace_charges = marketplace_charges_result[0]["total"] if marketplace_charges_result else 0
    
    # Get recent VIP payments (last 5)
    recent_vip_payments = await db.vip_payments.find(
        {"status": "approved"},
        {"_id": 0, "user_id": 1, "amount": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Enrich with user names
    for payment in recent_vip_payments:
        user = await db.users.find_one({"uid": payment["user_id"]}, {"name": 1})
        payment["user_name"] = user.get("name", "Unknown") if user else "Unknown"
    
    # Recent Activity - Get last 5 activities (orders, withdrawals, KYC)
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_withdrawals = await db.cashback_withdrawals.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "users": {
            "total": total_users,
            "vip": vip_users,
            "free": free_users,
            "managers": managers,
            "master_stockists": master_stockists,
            "sub_stockists": sub_stockists,
            "outlets": outlets
        },
        "orders": {
            "total": total_orders,
            "pending": pending_orders,
            "delivered": delivered_orders
        },
        "kyc": {
            "total": total_kyc,
            "pending": pending_kyc,
            "verified": verified_kyc,
            "rejected": rejected_kyc
        },
        "vip_payments": {
            "total": total_vip_requests,
            "pending": pending_vip_approvals,
            "approved": approved_vip
        },
        "withdrawals": {
            "pending_count": total_pending_withdrawals,
            "pending_cashback": pending_cashback_withdrawals,
            "pending_profit": pending_profit_withdrawals,
            "pending_amount": total_pending_withdrawal_amount,
            "pending_cashback_amount": pending_cashback_amount,
            "pending_profit_amount": pending_profit_amount,
            "processed_amount": total_processed_withdrawal_amount,
            "processed_cashback_amount": processed_cashback_amount,
            "processed_profit_amount": processed_profit_amount
        },
        "products": {
            "total": total_products,
            "active": active_products
        },
        "financial": {
            "total_revenue_inr": total_revenue_inr,
            "total_revenue_prc": total_revenue_prc,
            "total_prc_value_in_inr": total_prc_value_in_inr,
            "total_security_deposits": total_security_deposits,
            "total_renewal_fees": total_renewal_fees,
            "total_vip_membership_fees": total_vip_fees,
            "total_wallet_fees": total_wallet_fees,
            "total_marketplace_charges": total_marketplace_charges,
            "total_lien": total_lien,
            "total_withdrawal_processed": total_processed_withdrawal_amount
        },
        "stock_movements": {
            "pending": pending_stock_movements,
            "approved": approved_stock_movements,
            "completed": completed_stock_movements
        },
        "security_deposits": {
            "pending": pending_deposits,
            "approved": approved_deposits,
            "total_amount": total_security_deposits
        },
        "renewals": {
            "pending": pending_renewals,
            "active": active_renewals,
            "overdue": overdue_entities,
            "total_fees": total_renewal_fees
        },
        "recent_activity": {
            "orders": recent_orders,
            "withdrawals": recent_withdrawals,
            "vip_payments": recent_vip_payments
        }
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
    page: int = 1,
    limit: int = 20,
    membership_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    kyc_status: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "asc"
):
    """Get all users with advanced filtering and pagination (Admin only)"""
    query = {}
    
    # Filter by role
    if role:
        query["role"] = role
    
    # Filter by membership type
    if membership_type:
        query["membership_type"] = membership_type
    
    # Filter by KYC status
    if kyc_status:
        query["kyc_status"] = kyc_status
    
    # Search by name, email, or mobile
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
            {"uid": {"$regex": search, "$options": "i"}}
        ]
    
    # Filter by registration date range
    if start_date or end_date:
        query["created_at"] = {}
        if start_date:
            query["created_at"]["$gte"] = start_date
        if end_date:
            query["created_at"]["$lte"] = end_date
    
    # Get total count
    total = await db.users.count_documents(query)
    total_pages = (total + limit - 1) // limit
    
    # Calculate skip
    skip = (page - 1) * limit
    
    # Determine sort field
    sort_field = "created_at"
    if sort_by == "name":
        sort_field = "name"
    elif sort_by == "balance":
        sort_field = "cashback_balance"
    elif sort_by == "prc":
        sort_field = "prc_balance"
    
    sort_direction = 1 if sort_order == "asc" else -1
    
    # Get users with sorting
    users = await db.users.find(query).sort(sort_field, sort_direction).skip(skip).limit(limit).to_list(length=limit)
    
    # Remove sensitive data
    for user in users:
        user.pop("password_hash", None)
        user.pop("reset_token", None)
        user["_id"] = str(user["_id"])
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "users": users
    }

@api_router.put("/admin/users/{uid}/role")
async def update_user_role(uid: str, request: Request):
    """Update user role (Admin only)"""
    data = await request.json()
    new_role = data.get("role")
    
    # Validate role
    valid_roles = ["user", "admin", "manager", "sub_admin", "employee", "master_stockist", "sub_stockist", "outlet"]
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

@api_router.get("/admin/users/all")
async def get_all_users_admin(
    page: int = 1, 
    limit: int = 50, 
    search: Optional[str] = None,
    role: Optional[str] = None,
    membership: Optional[str] = None,
    kyc_status: Optional[str] = None,
    show_deleted: Optional[bool] = False
):
    """Admin endpoint to get all users with filters and pagination"""
    query = {}
    
    # By default, hide deactivated/deleted users unless show_deleted is True
    if not show_deleted:
        query["is_active"] = {"$ne": False}
    
    # Search filter
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
            {"uid": {"$regex": search, "$options": "i"}}
        ]
    
    # Role filter
    if role:
        query["role"] = role
    
    # Membership filter
    if membership:
        query["membership_type"] = membership
    
    # KYC filter
    if kyc_status:
        query["kyc_status"] = kyc_status
    
    skip = (page - 1) * limit
    users = await db.users.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
    total = await db.users.count_documents(query)
    
    # Remove sensitive data
    for user in users:
        user.pop("password_hash", None)
        user.pop("_id", None)
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

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
    is_active: bool = True  # Added for product lifecycle management
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
async def get_all_products_admin(
    page: int = 1, 
    limit: int = 20, 
    search: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    stock_status: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "asc"
):
    """Get all products with advanced filtering and pagination (Admin)"""
    query = {}
    
    # Search by name, SKU, or description
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    # Filter by category
    if category:
        query["category"] = category
    
    # Filter by price range (cash_price)
    if min_price is not None or max_price is not None:
        query["cash_price"] = {}
        if min_price is not None:
            query["cash_price"]["$gte"] = min_price
        if max_price is not None:
            query["cash_price"]["$lte"] = max_price
    
    # Filter by stock status
    if stock_status == "in_stock":
        query["stock"] = {"$gt": 0}
    elif stock_status == "out_of_stock":
        query["stock"] = 0
    elif stock_status == "low_stock":
        query["stock"] = {"$gt": 0, "$lte": 10}
    
    # Filter by active/inactive status
    if status:
        query["status"] = status
    
    # Get total count
    total = await db.products.count_documents(query)
    total_pages = (total + limit - 1) // limit
    
    # Calculate skip
    skip = (page - 1) * limit
    
    # Determine sort field and order
    sort_field = "created_at"
    if sort_by == "name":
        sort_field = "name"
    elif sort_by == "price":
        sort_field = "cash_price"
    elif sort_by == "stock":
        sort_field = "stock"
    
    sort_direction = 1 if sort_order == "asc" else -1
    
    # Get products with sorting
    products = await db.products.find(query, {"_id": 0}).sort(sort_field, sort_direction).skip(skip).limit(limit).to_list(length=limit)
    
    # Convert datetime fields to ISO format
    for product in products:
        for field in ["created_at", "updated_at", "visible_from", "visible_till"]:
            if product.get(field) and isinstance(product[field], str):
                try:
                    product[field] = datetime.fromisoformat(product[field]).isoformat()
                except:
                    pass
    
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "products": products
    }

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
        # Add new item with cash_price for delivery charge calculation
        cart["items"].append({
            "product_id": product_id,
            "product_name": product["name"],
            "quantity": quantity,
            "prc_price": product["prc_price"],
            "cash_price": product.get("cash_price", 0),
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

@api_router.post("/cart/update")
async def update_cart_quantity(request: Request):
    """Update item quantity in cart"""
    data = await request.json()
    user_id = data.get("user_id")
    product_id = data.get("product_id")
    quantity = data.get("quantity", 1)
    
    # Get cart
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    # Find item in cart
    item_found = False
    for item in cart.get("items", []):
        if item["product_id"] == product_id:
            # Get product to check stock
            product = await db.products.find_one({"product_id": product_id})
            if product and product.get("available_stock", 0) < quantity:
                raise HTTPException(status_code=400, detail="Insufficient stock")
            
            item["quantity"] = quantity
            item_found = True
            break
    
    if not item_found:
        raise HTTPException(status_code=404, detail="Item not found in cart")
    
    # Update cart
    await db.carts.update_one(
        {"user_id": user_id},
        {"$set": {"items": cart["items"], "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Cart updated successfully"}

@api_router.post("/cart/remove")
async def remove_from_cart_post(request: Request):
    """Remove item from cart (POST method)"""
    data = await request.json()
    user_id = data.get("user_id")
    product_id = data.get("product_id")
    
    # Get cart
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    # Remove item
    original_length = len(cart.get("items", []))
    cart["items"] = [item for item in cart.get("items", []) if item["product_id"] != product_id]
    
    if len(cart["items"]) == original_length:
        raise HTTPException(status_code=404, detail="Item not found in cart")
    
    # Update cart
    await db.carts.update_one(
        {"user_id": user_id},
        {"$set": {"items": cart["items"], "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Item removed from cart"}


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


@api_router.get("/contact-details")
async def get_contact_details():
    """Get public contact details"""
    config = await db.system_config.find_one({"config_type": "contact"})
    
    if not config:
        # Return default contact details
        return {
            "address": "PARAS REWARD\nMaharashtra, India",
            "phone": "+91-XXXXXXXXXX",
            "email": "support@parasreward.com",
            "website": "www.parasreward.com"
        }
    
    return {
        "address": config.get("address", "PARAS REWARD\nMaharashtra, India"),
        "phone": config.get("phone", "+91-XXXXXXXXXX"),
        "email": config.get("email", "support@parasreward.com"),
        "website": config.get("website", "www.parasreward.com")
    }

@api_router.post("/admin/contact-details")
async def update_contact_details(request: Request):
    """Update contact details (Admin only)"""
    data = await request.json()
    
    address = data.get("address")
    phone = data.get("phone")
    email = data.get("email")
    website = data.get("website")
    
    # Validate required fields
    if not all([address, phone, email, website]):
        raise HTTPException(status_code=400, detail="All contact fields are required")
    
    config_data = {
        "config_type": "contact",
        "address": address,
        "phone": phone,
        "email": email,
        "website": website,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update or insert
    existing = await db.system_config.find_one({"config_type": "contact"})
    
    if existing:
        await db.system_config.update_one(
            {"config_type": "contact"},
            {"$set": config_data}
        )
    else:
        await db.system_config.insert_one(config_data)
    
    return {"message": "Contact details updated successfully"}

@api_router.post("/orders/{order_id}/distribute-delivery-charge")
async def distribute_delivery_charge(order_id: str):
    """Distribute commission based on order PRC value (10% of total PRC converted to ₹)"""
    # Find order
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if already distributed
    if order.get("commission_distributed"):
        return {
            "message": "Commission already distributed",
            "order_id": order_id,
            "already_distributed": True
        }
    
    # Check if order is delivered
    if order.get("status") != "delivered":
        raise HTTPException(status_code=400, detail="Order must be delivered before distribution")
    
    # Calculate commission: 10% of order PRC value, converted to ₹ (10 PRC = ₹1)
    # Support both legacy (prc_amount) and new (total_prc) order formats
    total_prc = order.get("total_prc", 0) or order.get("prc_amount", 0)
    if total_prc <= 0:
        return {"message": "No PRC value to distribute commission"}
    
    # Commission = 10% of PRC value in ₹
    total_commission = (total_prc * 0.10) / 10  # 10 PRC = ₹1
    
    # Get distribution split (default: Master 10%, Sub 20%, Outlet 60%, Company 10%)
    config = await db.system_config.find_one({"config_type": "delivery"})
    if not config:
        split = {"master": 10, "sub": 20, "outlet": 60, "company": 10}
    else:
        split = config.get("distribution_split", {"master": 10, "sub": 20, "outlet": 60, "company": 10})
    
    # Get outlet_id from delivery
    outlet_id = order.get("outlet_id") or order.get("assigned_outlet")
    
    if not outlet_id:
        raise HTTPException(status_code=400, detail="No outlet assigned to this order")
    
    # Get outlet user to find parent hierarchy
    outlet_user = await db.users.find_one({"uid": outlet_id, "role": "outlet"})
    if not outlet_user:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    # Find Sub Stockist (parent of outlet)
    sub_stockist_id = outlet_user.get("parent_id") or outlet_user.get("assigned_sub_stockist")
    sub_stockist_user = None
    if sub_stockist_id:
        sub_stockist_user = await db.users.find_one({"uid": sub_stockist_id, "role": "sub_stockist"})
    
    # Find Master Stockist (parent of sub stockist)
    master_stockist_id = None
    master_stockist_user = None
    if sub_stockist_user:
        master_stockist_id = sub_stockist_user.get("parent_id") or sub_stockist_user.get("assigned_master_stockist")
        if master_stockist_id:
            master_stockist_user = await db.users.find_one({"uid": master_stockist_id, "role": "master_stockist"})
    
    # Calculate distribution amounts
    distributions = {}
    for entity, percentage in split.items():
        amount = (total_commission * percentage) / 100
        distributions[entity] = amount
    
    # Create commission entries and credit wallets
    commission_records = []
    now = datetime.now(timezone.utc).isoformat()
    credited_entities = []
    
    # Credit Outlet
    if distributions.get("outlet", 0) > 0 and outlet_user:
        amount = distributions["outlet"]
        if not outlet_user.get("profit_wallet_frozen", False):
            # Update balance
            await db.users.update_one(
                {"uid": outlet_id},
                {"$inc": {"profit_wallet_balance": round(amount, 2)}}
            )
            
            # Log transaction
            await log_transaction(
                user_id=outlet_id,
                wallet_type="profit_wallet",
                transaction_type="profit_share",
                amount=round(amount, 2),
                description=f"Delivery charge commission from order {order_id}",
                metadata={
                    "order_id": order_id,
                    "entity_type": "outlet",
                    "commission_percentage": split.get("outlet", 0),
                    "total_commission": round(total_commission, 2)
                },
                related_id=order_id,
                related_type="order"
            )
            
            credited_entities.append(f"Outlet ({outlet_user.get('name', 'Unknown')}): ₹{round(amount, 2)}")
        
        commission_record = {
            "commission_id": str(uuid.uuid4()),
            "order_id": order_id,
            "entity_type": "outlet",
            "entity_id": outlet_id,
            "entity_name": outlet_user.get("name", "Unknown"),
            "amount": round(amount, 2),
            "type": "order_commission",
            "status": "credited" if not outlet_user.get("profit_wallet_frozen", False) else "frozen",
            "created_at": now
        }
        commission_records.append(commission_record)
    
    # Credit Sub Stockist
    if distributions.get("sub", 0) > 0 and sub_stockist_user:
        amount = distributions["sub"]
        if not sub_stockist_user.get("profit_wallet_frozen", False):
            # Update balance
            await db.users.update_one(
                {"uid": sub_stockist_id},
                {"$inc": {"profit_wallet_balance": round(amount, 2)}}
            )
            
            # Log transaction
            await log_transaction(
                user_id=sub_stockist_id,
                wallet_type="profit_wallet",
                transaction_type="profit_share",
                amount=round(amount, 2),
                description=f"Delivery charge commission from order {order_id}",
                metadata={
                    "order_id": order_id,
                    "entity_type": "sub_stockist",
                    "commission_percentage": split.get("sub", 0),
                    "total_commission": round(total_commission, 2)
                },
                related_id=order_id,
                related_type="order"
            )
            
            credited_entities.append(f"Sub Stockist ({sub_stockist_user.get('name', 'Unknown')}): ₹{round(amount, 2)}")
        
        commission_record = {
            "commission_id": str(uuid.uuid4()),
            "order_id": order_id,
            "entity_type": "sub_stockist",
            "entity_id": sub_stockist_id,
            "entity_name": sub_stockist_user.get("name", "Unknown"),
            "amount": round(amount, 2),
            "type": "order_commission",
            "status": "credited" if not sub_stockist_user.get("profit_wallet_frozen", False) else "frozen",
            "created_at": now
        }
        commission_records.append(commission_record)
    
    # Credit Master Stockist
    if distributions.get("master", 0) > 0 and master_stockist_user:
        amount = distributions["master"]
        if not master_stockist_user.get("profit_wallet_frozen", False):
            # Update balance
            await db.users.update_one(
                {"uid": master_stockist_id},
                {"$inc": {"profit_wallet_balance": round(amount, 2)}}
            )
            
            # Log transaction
            await log_transaction(
                user_id=master_stockist_id,
                wallet_type="profit_wallet",
                transaction_type="profit_share",
                amount=round(amount, 2),
                description=f"Delivery charge commission from order {order_id}",
                metadata={
                    "order_id": order_id,
                    "entity_type": "master_stockist",
                    "commission_percentage": split.get("master", 0),
                    "total_commission": round(total_commission, 2)
                },
                related_id=order_id,
                related_type="order"
            )
            
            credited_entities.append(f"Master Stockist ({master_stockist_user.get('name', 'Unknown')}): ₹{round(amount, 2)}")
        
        commission_record = {
            "commission_id": str(uuid.uuid4()),
            "order_id": order_id,
            "entity_type": "master_stockist",
            "entity_id": master_stockist_id,
            "entity_name": master_stockist_user.get("name", "Unknown"),
            "amount": round(amount, 2),
            "type": "order_commission",
            "status": "credited" if not master_stockist_user.get("profit_wallet_frozen", False) else "frozen",
            "created_at": now
        }
        commission_records.append(commission_record)
    
    # Company share (stays with system)
    if distributions.get("company", 0) > 0:
        amount = distributions["company"]
        commission_record = {
            "commission_id": str(uuid.uuid4()),
            "order_id": order_id,
            "entity_type": "company",
            "entity_id": "company_system",
            "entity_name": "PARAS REWARD Company",
            "amount": round(amount, 2),
            "type": "order_commission",
            "status": "credited",
            "created_at": now
        }
        commission_records.append(commission_record)
    
    # Save commission records
    if commission_records:
        await db.commissions_earned.insert_many(commission_records)
    
    # Mark order as commission distributed
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "commission_distributed": True,
            "commission_amount": round(total_commission, 2),
            "commission_distributed_at": now,
            "credited_entities": credited_entities
        }}
    )
    
    return {
        "message": "Commission distributed successfully across hierarchy",
        "order_id": order_id,
        "total_commission": round(total_commission, 2),
        "distributions": {k: round(v, 2) for k, v in distributions.items()},
        "credited_to": credited_entities,
        "hierarchy": {
            "outlet": outlet_user.get("name") if outlet_user else "Not Found",
            "sub_stockist": sub_stockist_user.get("name") if sub_stockist_user else "Not Assigned",
            "master_stockist": master_stockist_user.get("name") if master_stockist_user else "Not Assigned"
        },
        "commission_records": len(commission_records)
    }

# ========== WALLET ROUTES ==========

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
    
    # Deduct stock from outlet's inventory
    for item in order.get("items", []):
        product_id = item.get("product_id")
        quantity = item.get("quantity", 0)
        
        if product_id and quantity > 0:
            # Check if outlet has stock
            outlet_stock = await db.stock_inventory.find_one({
                "user_id": outlet_id,
                "product_id": product_id
            })
            
            if outlet_stock and outlet_stock.get("quantity", 0) >= quantity:
                # Deduct stock
                await db.stock_inventory.update_one(
                    {"user_id": outlet_id, "product_id": product_id},
                    {
                        "$inc": {"quantity": -quantity},
                        "$set": {"updated_at": now.isoformat()}
                    }
                )
            else:
                # Log warning if insufficient stock (shouldn't happen but handle gracefully)
                print(f"Warning: Outlet {outlet_id} has insufficient stock for product {product_id}")
    
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
async def get_cashback_withdrawals(status: str = None, page: int = 1, limit: int = 20):
    """Get all cashback withdrawal requests with pagination (optionally filtered by status)"""
    query = {}
    if status:
        query["status"] = status
    
    total = await db.cashback_withdrawals.count_documents(query)
    total_pages = (total + limit - 1) // limit
    skip = (page - 1) * limit
    
    withdrawals = await db.cashback_withdrawals.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "withdrawals": withdrawals,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@api_router.get("/admin/withdrawals/profit")
async def get_profit_withdrawals(status: str = None, page: int = 1, limit: int = 20):
    """Get all profit withdrawal requests with pagination (optionally filtered by status)"""
    query = {}
    if status:
        query["status"] = status
    
    total = await db.profit_withdrawals.count_documents(query)
    total_pages = (total + limit - 1) // limit
    skip = (page - 1) * limit
    
    withdrawals = await db.profit_withdrawals.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "withdrawals": withdrawals,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

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
    
    # Create notification for withdrawal approval
    await create_notification(
        user_id=withdrawal["user_id"],
        title="Withdrawal Approved! ✅",
        message=f"Your withdrawal of ₹{withdrawal.get('amount_requested', 0)} has been approved and is being processed.",
        notification_type="withdrawal",
        related_id=withdrawal_id,
        icon="✅"
    )
    
    return {"message": "Withdrawal approved", "withdrawal_id": withdrawal_id}

@api_router.post("/admin/withdrawals/cashback/{withdrawal_id}/reject")
async def reject_cashback_withdrawal(withdrawal_id: str, request: Request):
    """Reject cashback withdrawal request and refund to wallet using new transaction system"""
    data = await request.json()
    admin_notes = data.get("admin_notes", "Rejected by admin")
    
    withdrawal = await db.cashback_withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {withdrawal['status']}")
    
    # NEW LOGIC: Refund only the requested amount (since only that was debited)
    refund_amount = withdrawal.get("amount_requested", withdrawal.get("amount", 0))
    
    # Log refund transaction
    await log_transaction(
        user_id=withdrawal["user_id"],
        wallet_type="cashback",
        transaction_type="withdrawal_rejected",
        amount=refund_amount,
        description=f"Withdrawal refund - Request rejected by admin. Reason: {admin_notes}",
        metadata={
            "withdrawal_id": withdrawal_id,
            "original_amount": refund_amount,
            "admin_notes": admin_notes
        },
        related_id=withdrawal_id,
        related_type="withdrawal_rejection"
    )
    
    await db.cashback_withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create notification for withdrawal rejection
    await create_notification(
        user_id=withdrawal["user_id"],
        title="Withdrawal Rejected ❌",
        message=f"Your withdrawal of ₹{refund_amount} was rejected. Amount refunded to wallet. Reason: {admin_notes}",
        notification_type="withdrawal",
        related_id=withdrawal_id,
        icon="❌"
    )
    
    return {
        "message": "Withdrawal rejected and refunded",
        "withdrawal_id": withdrawal_id,
        "refunded_amount": refund_amount
    }

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
    
    # Create notification for withdrawal completion
    await create_notification(
        user_id=withdrawal["user_id"],
        title="Withdrawal Completed! 🎉",
        message=f"Your withdrawal of ₹{withdrawal.get('amount_to_receive', 0)} has been completed. UTR: {utr_number}",
        notification_type="withdrawal",
        related_id=withdrawal_id,
        icon="🎉"
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
    
    # NEW LOGIC: Refund only the requested amount (since only that was debited)
    refund_amount = withdrawal.get("amount_requested", withdrawal.get("amount", 0))
    
    # Log refund transaction
    await log_transaction(
        user_id=withdrawal["user_id"],
        wallet_type="profit",
        transaction_type="withdrawal_rejected",
        amount=refund_amount,
        description=f"Withdrawal refund - Request rejected by admin. Reason: {admin_notes}",
        metadata={
            "withdrawal_id": withdrawal_id,
            "original_amount": refund_amount,
            "admin_notes": admin_notes
        },
        related_id=withdrawal_id,
        related_type="withdrawal_rejection"
    )
    
    await db.profit_withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Withdrawal rejected and refunded",
        "withdrawal_id": withdrawal_id,
        "refunded_amount": refund_amount
    }

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

# ========== STOCK REQUEST SYSTEM ==========

class StockRequest(BaseModel):
    product_id: str
    quantity: int
    notes: Optional[str] = ""

@api_router.post("/stock/request/create")
async def create_stock_request(request_data: StockRequest, request: Request):
    """Create a stock request - requester requests from their immediate parent in hierarchy"""
    # Get user from request body or headers (for now we'll use a simpler approach)
    data = await request.json()
    user_uid = data.get("user_uid")
    
    if not user_uid:
        raise HTTPException(status_code=401, detail="User UID is required")
    
    user = await db.users.find_one({"uid": user_uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request_data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
    
    requester_id = user.get("uid")
    requester_role = user.get("role")
    requester_name = user.get("name", "Unknown")
    
    # Determine parent based on role hierarchy
    parent_role_map = {
        "outlet": "sub_stockist",
        "sub_stockist": "master_stockist",
        "master_stockist": "admin"
    }
    
    if requester_role not in parent_role_map:
        raise HTTPException(status_code=403, detail=f"Role {requester_role} cannot create stock requests")
    
    parent_role = parent_role_map[requester_role]
    
    # Find parent entity (for outlet/sub, find their assigned parent)
    parent = None
    if requester_role == "outlet":
        # Find assigned sub stockist
        parent_id = user.get("assigned_sub_stockist")
        if parent_id:
            parent = await db.users.find_one({"uid": parent_id})
    elif requester_role == "sub_stockist":
        # Find assigned master stockist
        parent_id = user.get("assigned_master_stockist")
        if parent_id:
            parent = await db.users.find_one({"uid": parent_id})
    elif requester_role == "master_stockist":
        # Request to company (admin)
        parent = await db.users.find_one({"role": "admin"})
    
    if not parent:
        raise HTTPException(status_code=404, detail=f"Parent {parent_role} not found or not assigned")
    
    parent_id = parent.get("uid")
    parent_name = parent.get("name", "Unknown")
    
    # Get product details
    product = await db.products.find_one({"product_id": request_data.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if parent has sufficient stock
    parent_stock = await db.stock_inventory.find_one({
        "user_id": parent_id,
        "product_id": request_data.product_id
    })
    
    available_stock = parent_stock.get("quantity", 0) if parent_stock else 0
    
    # Create stock request
    stock_request = {
        "request_id": str(uuid.uuid4()),
        "requester_id": requester_id,
        "requester_name": requester_name,
        "requester_role": requester_role,
        "parent_id": parent_id,
        "parent_name": parent_name,
        "parent_role": parent_role,
        "product_id": request_data.product_id,
        "product_name": product.get("name"),
        "quantity": request_data.quantity,
        "notes": request_data.notes,
        "status": "pending",
        "available_stock": available_stock,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock_requests.insert_one(stock_request)
    
    return {
        "message": "Stock request created successfully",
        "request_id": stock_request["request_id"],
        "status": "pending",
        "available_stock": available_stock
    }

@api_router.get("/stock/request/my-requests/{uid}")
async def get_my_stock_requests(uid: str, status: Optional[str] = None):
    """Get all stock requests created by the user"""
    query = {"requester_id": uid}
    if status:
        query["status"] = status
    
    requests = await db.stock_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    return {"requests": requests}

@api_router.get("/stock/request/pending-for-me/{uid}")
async def get_pending_stock_requests_for_me(uid: str):
    """Get all pending stock requests where user is the parent (approver) with available stock"""
    requests = await db.stock_requests.find({
        "parent_id": uid,
        "status": "pending"
    }, {"_id": 0}).sort("created_at", -1).to_list(None)
    
    # Enrich each request with available stock
    for req in requests:
        product_id = req.get("product_id")
        
        if product_id:
            # Get parent's stock for this product
            parent_stock = await db.stock_inventory.find_one({
                "user_id": uid,
                "product_id": product_id
            })
            req["available_stock"] = parent_stock["quantity"] if parent_stock else 0
        else:
            req["available_stock"] = 0
    
    return {"requests": requests}

@api_router.get("/admin/stock/requests")
async def get_all_stock_requests(status: Optional[str] = None):
    """Admin: Get all stock requests with available stock info"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.stock_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    
    # Enrich each request with available stock from parent
    for req in requests:
        parent_id = req.get("parent_id")
        product_id = req.get("product_id")
        
        if parent_id and product_id:
            # Get parent's stock for this product
            parent_stock = await db.stock_inventory.find_one({
                "user_id": parent_id,
                "product_id": product_id
            })
            req["available_stock"] = parent_stock["quantity"] if parent_stock else 0
        else:
            req["available_stock"] = 0
    
    return {"requests": requests}

@api_router.post("/stock/request/{request_id}/approve")
async def approve_stock_request(request_id: str, request: Request):
    """Approve a stock request and initiate stock transfer"""
    data = await request.json()
    approver_uid = data.get("approver_uid")
    
    if not approver_uid:
        raise HTTPException(status_code=401, detail="Approver UID is required")
    
    user = await db.users.find_one({"uid": approver_uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    approver_id = user.get("uid")
    approver_name = user.get("name", "Unknown")
    
    # Get the request
    stock_request = await db.stock_requests.find_one({"request_id": request_id})
    if not stock_request:
        raise HTTPException(status_code=404, detail="Stock request not found")
    
    # Verify approver is the parent OR is admin
    approver_role = user.get("role")
    if approver_role != "admin" and stock_request["parent_id"] != approver_id:
        raise HTTPException(status_code=403, detail="You are not authorized to approve this request")
    
    if stock_request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {stock_request['status']}")
    
    # Check stock availability
    parent_stock = await db.stock_inventory.find_one({
        "user_id": approver_id,
        "product_id": stock_request["product_id"]
    })
    
    available_qty = parent_stock.get("quantity", 0) if parent_stock else 0
    requested_qty = stock_request["quantity"]
    
    if available_qty < requested_qty:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient stock. Available: {available_qty}, Requested: {requested_qty}"
        )
    
    # Update request status
    await db.stock_requests.update_one(
        {"request_id": request_id},
        {
            "$set": {
                "status": "approved",
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "approved_by": approver_id,
                "approver_name": approver_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Create stock movement (auto-approved since parent approved the request)
    batch_number = generate_batch_number()
    qr_code = generate_qr_code()
    
    movement = {
        "movement_id": str(uuid.uuid4()),
        "request_id": request_id,
        "sender_id": approver_id,
        "sender_name": approver_name,
        "sender_role": stock_request["parent_role"],
        "receiver_id": stock_request["requester_id"],
        "receiver_name": stock_request["requester_name"],
        "receiver_role": stock_request["requester_role"],
        "product_id": stock_request["product_id"],
        "product_name": stock_request["product_name"],
        "quantity": requested_qty,
        "batch_number": batch_number,
        "qr_code": qr_code,
        "status": "completed",  # Auto-complete since request was approved
        "notes": f"Auto-generated from stock request: {stock_request.get('notes', '')}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock_movements.insert_one(movement)
    
    # Update stock inventory - Deduct from parent
    if parent_stock:
        await db.stock_inventory.update_one(
            {"user_id": approver_id, "product_id": stock_request["product_id"]},
            {"$inc": {"quantity": -requested_qty}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Update stock inventory - Add to requester
    requester_stock = await db.stock_inventory.find_one({
        "user_id": stock_request["requester_id"],
        "product_id": stock_request["product_id"]
    })
    
    if requester_stock:
        await db.stock_inventory.update_one(
            {"user_id": stock_request["requester_id"], "product_id": stock_request["product_id"]},
            {"$inc": {"quantity": requested_qty}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.stock_inventory.insert_one({
            "inventory_id": str(uuid.uuid4()),
            "user_id": stock_request["requester_id"],
            "product_id": stock_request["product_id"],
            "product_name": stock_request["product_name"],
            "quantity": requested_qty,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Get updated balances
    updated_parent_stock = await db.stock_inventory.find_one({
        "user_id": approver_id,
        "product_id": stock_request["product_id"]
    })
    updated_requester_stock = await db.stock_inventory.find_one({
        "user_id": stock_request["requester_id"],
        "product_id": stock_request["product_id"]
    })
    
    parent_balance = updated_parent_stock.get("quantity", 0) if updated_parent_stock else 0
    requester_balance = updated_requester_stock.get("quantity", 0) if updated_requester_stock else 0
    
    return {
        "message": "Stock request approved and stock transferred",
        "movement_id": movement["movement_id"],
        "parent_balance": parent_balance,
        "requester_balance": requester_balance
    }

@api_router.post("/stock/request/{request_id}/reject")
async def reject_stock_request(request_id: str, request: Request):
    """Reject a stock request"""
    data = await request.json()
    rejection_reason = data.get("rejection_reason", "")
    approver_uid = data.get("approver_uid")
    
    if not approver_uid:
        raise HTTPException(status_code=401, detail="Approver UID is required")
    
    user = await db.users.find_one({"uid": approver_uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    approver_id = user.get("uid")
    approver_name = user.get("name", "Unknown")
    
    # Get the request
    stock_request = await db.stock_requests.find_one({"request_id": request_id})
    if not stock_request:
        raise HTTPException(status_code=404, detail="Stock request not found")
    
    # Verify approver is the parent OR is admin
    approver_role = user.get("role")
    if approver_role != "admin" and stock_request["parent_id"] != approver_id:
        raise HTTPException(status_code=403, detail="You are not authorized to reject this request")
    
    if stock_request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {stock_request['status']}")
    
    # Update request status
    await db.stock_requests.update_one(
        {"request_id": request_id},
        {
            "$set": {
                "status": "rejected",
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "rejected_by": approver_id,
                "rejector_name": approver_name,
                "rejection_reason": rejection_reason,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Stock request rejected", "status": "rejected"}

@api_router.get("/stock/inventory/my-stock/{uid}")
async def get_my_stock_inventory(uid: str):
    """Get user's stock inventory"""
    inventory = await db.stock_inventory.find({"user_id": uid}, {"_id": 0}).to_list(None)
    return {"inventory": inventory}

@api_router.get("/admin/stock/inventory/{user_id}")
async def get_user_stock_inventory(user_id: str):
    """Admin: Get stock inventory for any user"""
    inventory = await db.stock_inventory.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    return {"inventory": inventory}

@api_router.get("/stock/inventory/all-stock")
async def get_all_stock_aggregated():
    """Get aggregated stock across all users for marketplace display"""
    try:
        # Aggregate stock by product_id
        pipeline = [
            {
                "$group": {
                    "_id": "$product_id",
                    "total_quantity": {"$sum": "$quantity"},
                    "product_name": {"$first": "$product_name"}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "product_id": "$_id",
                    "quantity": "$total_quantity",
                    "product_name": 1
                }
            }
        ]
        
        inventory = await db.stock_inventory.aggregate(pipeline).to_list(None)
        return {"inventory": inventory}
    except Exception as e:
        print(f"Error aggregating stock: {str(e)}")
        return {"inventory": []}

@api_router.post("/admin/stock/add")
async def admin_add_stock(request: Request):
    """Admin: Add stock to company inventory"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    product_id = data.get("product_id")
    quantity = data.get("quantity")
    
    if not admin_uid or not product_id or not quantity:
        raise HTTPException(status_code=400, detail="Admin UID, product ID, and quantity are required")
    
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
    
    # Verify admin role
    admin_user = await db.users.find_one({"uid": admin_uid})
    if not admin_user or admin_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admin can add stock")
    
    # Verify product exists
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if admin already has this product in inventory
    existing_stock = await db.stock_inventory.find_one({
        "user_id": admin_uid,
        "product_id": product_id
    })
    
    if existing_stock:
        # Update existing stock
        new_quantity = existing_stock["quantity"] + quantity
        await db.stock_inventory.update_one(
            {"inventory_id": existing_stock["inventory_id"]},
            {
                "$set": {
                    "quantity": new_quantity,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {
            "message": "Stock updated successfully",
            "inventory_id": existing_stock["inventory_id"],
            "previous_quantity": existing_stock["quantity"],
            "added_quantity": quantity,
            "new_quantity": new_quantity,
            "product_name": product["name"]
        }
    else:
        # Create new inventory entry
        inventory_id = str(uuid.uuid4())
        inventory_entry = {
            "inventory_id": inventory_id,
            "user_id": admin_uid,
            "user_name": admin_user.get("name", "Admin"),
            "user_role": "admin",
            "product_id": product_id,
            "product_name": product["name"],
            "quantity": quantity,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.stock_inventory.insert_one(inventory_entry)
        
        return {
            "message": "Stock added successfully",
            "inventory_id": inventory_id,
            "quantity": quantity,
            "product_name": product["name"]
        }

@api_router.post("/admin/stock/update")
async def admin_update_stock(request: Request):
    """Admin: Update stock quantity directly (set to specific amount)"""
    data = await request.json()
    admin_uid = data.get("admin_uid")
    product_id = data.get("product_id")
    quantity = data.get("quantity")
    
    if not admin_uid or not product_id or quantity is None:
        raise HTTPException(status_code=400, detail="Admin UID, product ID, and quantity are required")
    
    if quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    
    # Verify admin role
    admin_user = await db.users.find_one({"uid": admin_uid})
    if not admin_user or admin_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update stock")
    
    # Verify product exists
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if admin has this product in inventory
    existing_stock = await db.stock_inventory.find_one({
        "user_id": admin_uid,
        "product_id": product_id
    })
    
    if existing_stock:
        # Update to new quantity
        previous_quantity = existing_stock["quantity"]
        await db.stock_inventory.update_one(
            {"inventory_id": existing_stock["inventory_id"]},
            {
                "$set": {
                    "quantity": quantity,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {
            "message": "Stock updated successfully",
            "inventory_id": existing_stock["inventory_id"],
            "previous_quantity": previous_quantity,
            "new_quantity": quantity,
            "product_name": product["name"]
        }
    else:
        # Create new inventory entry
        inventory_id = str(uuid.uuid4())
        inventory_entry = {
            "inventory_id": inventory_id,
            "user_id": admin_uid,
            "user_name": admin_user.get("name", "Admin"),
            "user_role": "admin",
            "product_id": product_id,
            "product_name": product["name"],
            "quantity": quantity,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.stock_inventory.insert_one(inventory_entry)
        
        return {
            "message": "Stock created successfully",
            "inventory_id": inventory_id,
            "quantity": quantity,
            "product_name": product["name"]
        }

@api_router.put("/stock/request/{request_id}/edit")
async def edit_stock_request(request_id: str, request: Request):
    """Edit a pending stock request (only requester can edit)"""
    data = await request.json()
    new_quantity = data.get("quantity")
    new_notes = data.get("notes", "")
    user_uid = data.get("user_uid")
    
    if not user_uid:
        raise HTTPException(status_code=401, detail="User UID is required")
    
    if not new_quantity or new_quantity <= 0:
        raise HTTPException(status_code=400, detail="Valid quantity is required")
    
    user = await db.users.find_one({"uid": user_uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = user.get("uid")
    
    # Get the request
    stock_request = await db.stock_requests.find_one({"request_id": request_id})
    if not stock_request:
        raise HTTPException(status_code=404, detail="Stock request not found")
    
    # Verify user is the requester
    if stock_request["requester_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own requests")
    
    # Can only edit pending requests
    if stock_request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot edit {stock_request['status']} requests")
    
    # Check parent's available stock for new quantity
    parent_stock = await db.stock_inventory.find_one({
        "user_id": stock_request["parent_id"],
        "product_id": stock_request["product_id"]
    })
    
    available_stock = parent_stock.get("quantity", 0) if parent_stock else 0
    
    # Update request
    await db.stock_requests.update_one(
        {"request_id": request_id},
        {
            "$set": {
                "quantity": new_quantity,
                "notes": new_notes,
                "available_stock": available_stock,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "message": "Stock request updated successfully",
        "request_id": request_id,
        "new_quantity": new_quantity,
        "available_stock": available_stock
    }

@api_router.delete("/stock/request/{request_id}/delete")
async def delete_stock_request(request_id: str, request: Request):
    """Delete a pending stock request (only requester can delete)"""
    data = await request.json()
    user_uid = data.get("user_uid")
    
    if not user_uid:
        raise HTTPException(status_code=401, detail="User UID is required")
    
    user = await db.users.find_one({"uid": user_uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = user.get("uid")
    
    # Get the request
    stock_request = await db.stock_requests.find_one({"request_id": request_id})
    if not stock_request:
        raise HTTPException(status_code=404, detail="Stock request not found")
    
    # Verify user is the requester
    if stock_request["requester_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own requests")
    
    # Can only delete pending requests
    if stock_request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot delete {stock_request['status']} requests")
    
    # Delete the request
    await db.stock_requests.delete_one({"request_id": request_id})
    
    return {"message": "Stock request deleted successfully", "request_id": request_id}

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



@api_router.get("/admin/stock/movements")
async def get_all_stock_movements():
    """Get all stock movements (admin view)"""
    movements = await db.stock_movements.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return movements

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
    
    # Determine field to update (correct field names)
    field_map = {
        "cashback": "cashback_balance",
        "profit": "profit_balance",
        "prc": "prc_balance"
    }
    
    field = field_map.get(wallet_type)
    if not field:
        raise HTTPException(status_code=400, detail="Invalid wallet type")
    
    # Get current balance
    current_balance = user.get(field, 0)
    new_balance = current_balance + adjustment_amount
    
    # Update wallet
    await db.users.update_one(
        {"uid": uid},
        {"$inc": {field: adjustment_amount}}
    )
    
    # Log to wallet_transactions (so it shows in transaction history)
    if wallet_type in ["cashback", "profit"]:
        transaction_id = str(uuid.uuid4())
        await db.wallet_transactions.insert_one({
            "transaction_id": transaction_id,
            "user_id": uid,
            "wallet_type": wallet_type,
            "transaction_type": "credit" if adjustment_amount > 0 else "debit",
            "amount": abs(adjustment_amount),
            "balance_before": current_balance,
            "balance_after": new_balance,
            "description": reason,
            "created_by": "admin",
            "admin_id": admin_uid,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Also log adjustment for admin audit
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
        "adjustment": adjustment_amount,
        "new_balance": new_balance
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

# ========== ENHANCED ADMIN ORDER MANAGEMENT ==========

@api_router.get("/admin/orders/all")
async def get_all_orders_admin(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc"
):
    """Get all orders with advanced filtering and pagination (Admin)"""
    query = {}
    
    # Filter by status
    if status:
        query["status"] = status
    
    # Search by order_id or secret_code
    if search:
        query["$or"] = [
            {"order_id": {"$regex": search, "$options": "i"}},
            {"secret_code": {"$regex": search, "$options": "i"}},
            {"user_name": {"$regex": search, "$options": "i"}}
        ]
    
    # Filter by user_id
    if user_id:
        query["user_id"] = user_id
    
    # Filter by date range
    if start_date or end_date:
        query["created_at"] = {}
        if start_date:
            query["created_at"]["$gte"] = start_date
        if end_date:
            query["created_at"]["$lte"] = end_date
    
    # Filter by amount range (total_cash)
    if min_amount is not None or max_amount is not None:
        query["total_cash"] = {}
        if min_amount is not None:
            query["total_cash"]["$gte"] = min_amount
        if max_amount is not None:
            query["total_cash"]["$lte"] = max_amount
    
    total = await db.orders.count_documents(query)
    total_pages = (total + limit - 1) // limit
    skip = (page - 1) * limit
    
    # Determine sort field
    sort_field = "created_at"
    if sort_by == "amount":
        sort_field = "total_cash"
    elif sort_by == "prc":
        sort_field = "total_prc"
    
    sort_direction = -1 if sort_order == "desc" else 1
    
    orders = await db.orders.find(query).sort(sort_field, sort_direction).skip(skip).limit(limit).to_list(length=limit)
    
    # Remove MongoDB _id and format dates
    for order in orders:
        order["_id"] = str(order["_id"])
        if order.get("created_at"):
            if isinstance(order["created_at"], str):
                order["created_at"] = order["created_at"]
            else:
                order["created_at"] = order["created_at"].isoformat()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "orders": orders
    }

@api_router.get("/admin/orders/{order_id}")
async def get_order_details_admin(order_id: str):
    """Get detailed order information (Admin)"""
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get user details
    user = await db.users.find_one({"uid": order.get("uid")})
    
    # Get commission details if distributed
    commissions = await db.commissions_earned.find({"order_id": order_id}).to_list(length=10)
    
    # Convert ObjectIds to strings
    order["_id"] = str(order["_id"])
    if order.get("created_at"):
        if isinstance(order["created_at"], str):
            order["created_at"] = order["created_at"]
        else:
            order["created_at"] = order["created_at"].isoformat()
    
    # Convert ObjectIds in commissions
    for commission in commissions:
        if "_id" in commission:
            commission["_id"] = str(commission["_id"])
    
    return {
        "order": order,
        "user_details": {
            "uid": user.get("uid") if user else None,
            "name": user.get("name") if user else None,
            "email": user.get("email") if user else None,
            "mobile": user.get("mobile") if user else None
        },
        "items": order.get("items", []),
        "commission_breakdown": commissions
    }

@api_router.post("/admin/orders/{order_id}/assign")
async def assign_order_to_outlet(order_id: str, request: Request):
    """Assign order to outlet (Admin)"""
    data = await request.json()
    outlet_id = data.get("outlet_id")
    
    if not outlet_id:
        raise HTTPException(status_code=400, detail="outlet_id is required")
    
    # Verify outlet exists
    outlet = await db.users.find_one({"uid": outlet_id, "role": "outlet"})
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    # Update order with consistent field names
    result = await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "outlet_id": outlet_id,
            "assigned_outlet": outlet_id,  # For backward compatibility
            "assigned_outlet_id": outlet_id,  # Legacy field
            "assigned_at": datetime.now(timezone.utc).isoformat(),
            "status": "assigned"
        }}
    )
    
    if result.modified_count > 0:
        return {"message": "Order assigned to outlet", "outlet_id": outlet_id}
    else:
        raise HTTPException(status_code=404, detail="Order not found")

# ========== FINANCIAL REPORTS & ANALYTICS ==========

@api_router.get("/admin/reports/revenue")
async def get_revenue_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get revenue report with date filtering (Admin)"""
    query = {"status": "delivered"}
    
    if start_date:
        query["delivered_at"] = {"$gte": start_date}
    if end_date:
        if "delivered_at" not in query:
            query["delivered_at"] = {}
        query["delivered_at"]["$lte"] = end_date
    
    # Total revenue
    revenue_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$total_cash"},
            "prc_spent": {"$sum": "$total_prc"},
            "delivery_charges": {"$sum": "$delivery_charge"},
            "total_orders": {"$sum": 1}
        }}
    ]
    
    revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
    revenue_data = revenue_result[0] if revenue_result else {
        "total_revenue": 0,
        "prc_spent": 0,
        "delivery_charges": 0,
        "total_orders": 0
    }
    
    # Top products by revenue
    product_pipeline = [
        {"$match": query},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "product_name": {"$first": "$items.product_name"},
            "total_quantity": {"$sum": "$items.quantity"},
            "total_revenue": {"$sum": {"$multiply": ["$items.quantity", "$items.cash_price"]}}
        }},
        {"$sort": {"total_revenue": -1}},
        {"$limit": 10}
    ]
    
    top_products = await db.orders.aggregate(product_pipeline).to_list(10)
    
    return {
        "total_revenue": revenue_data.get("total_revenue", 0),
        "prc_spent": revenue_data.get("prc_spent", 0),
        "delivery_charges": revenue_data.get("delivery_charges", 0),
        "total_orders": revenue_data.get("total_orders", 0),
        "top_products": top_products
    }

@api_router.get("/admin/reports/commissions")
async def get_commission_report():
    """Get commission distribution report (Admin)"""
    # Total commissions by entity type
    pipeline = [
        {"$group": {
            "_id": "$entity_type",
            "total_amount": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    
    commissions_by_type = await db.commissions_earned.aggregate(pipeline).to_list(10)
    
    # Top earners
    top_earners_pipeline = [
        {"$group": {
            "_id": "$entity_id",
            "entity_type": {"$first": "$entity_type"},
            "total_earned": {"$sum": "$amount"}
        }},
        {"$sort": {"total_earned": -1}},
        {"$limit": 10}
    ]
    
    top_earners = await db.commissions_earned.aggregate(top_earners_pipeline).to_list(10)
    
    # Get entity names
    for earner in top_earners:
        user = await db.users.find_one({"uid": earner["_id"]})
        if user:
            earner["name"] = user.get("name")
            earner["email"] = user.get("email")
    
    return {
        "commission_distribution": commissions_by_type,
        "top_earners": top_earners
    }

@api_router.get("/admin/reports/withdrawals")
async def get_withdrawal_report(status: Optional[str] = None):
    """Get withdrawal statistics report (Admin)"""
    query = {}
    if status:
        query["status"] = status
    

# ========== ANALYTICS ENDPOINTS ==========

@api_router.get("/admin/analytics/revenue-trends")
async def get_revenue_trends(period: str = "daily", days: int = 30):
    """Get revenue trends over time with daily/weekly/monthly aggregation"""
    from datetime import timedelta
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Determine grouping format
    if period == "daily":
        date_format = "%Y-%m-%d"
    elif period == "weekly":
        date_format = "%Y-W%U"
    elif period == "monthly":
        date_format = "%Y-%m"
    else:
        date_format = "%Y-%m-%d"
    
    # Revenue pipeline
    pipeline = [
        {"$match": {
            "status": "delivered",
            "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        }},
        {"$addFields": {
            "date_parsed": {"$dateFromString": {"dateString": "$created_at"}}
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": date_format, "date": "$date_parsed"}},
            "revenue": {"$sum": "$total_cash"},
            "prc_value": {"$sum": "$total_prc"},
            "orders": {"$sum": 1},
            "delivery_charges": {"$sum": "$delivery_charge"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    trends = await db.orders.aggregate(pipeline).to_list(length=None)
    
    return {
        "period": period,
        "days": days,
        "data": [
            {
                "date": item["_id"],
                "revenue": round(item["revenue"], 2),
                "prc_value": round(item["prc_value"], 2),
                "orders": item["orders"],
                "delivery_charges": round(item["delivery_charges"], 2)
            }
            for item in trends
        ]
    }

@api_router.get("/admin/analytics/user-growth")
async def get_user_growth(days: int = 30):
    """Get user registration trends"""
    from datetime import timedelta
    
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    pipeline = [
        {"$match": {
            "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        }},
        {"$addFields": {
            "date_parsed": {"$dateFromString": {"dateString": "$created_at"}}
        }},
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date_parsed"}},
                "membership_type": "$membership_type"
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.date": 1}}
    ]
    
    growth_data = await db.users.aggregate(pipeline).to_list(length=None)
    
    # Transform data
    date_map = {}
    for item in growth_data:
        date = item["_id"]["date"]
        membership = item["_id"]["membership_type"] or "free"
        
        if date not in date_map:
            date_map[date] = {"date": date, "free": 0, "vip": 0, "total": 0}
        
        date_map[date][membership] = item["count"]
        date_map[date]["total"] += item["count"]
    
    return {
        "days": days,
        "data": list(date_map.values())
    }

@api_router.get("/admin/analytics/product-performance")
async def get_product_performance(limit: int = 10):
    """Get top performing products by orders and revenue"""
    
    # Top products by quantity
    quantity_pipeline = [
        {"$match": {"status": {"$in": ["pending", "verified", "delivered"]}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "product_name": {"$first": "$items.product_name"},
            "total_quantity": {"$sum": "$items.quantity"},
            "total_revenue": {"$sum": {"$multiply": ["$items.quantity", "$items.cash_price"]}},
            "orders": {"$sum": 1}
        }},
        {"$sort": {"total_quantity": -1}},
        {"$limit": limit}
    ]
    
    top_products = await db.orders.aggregate(quantity_pipeline).to_list(limit)
    
    return {
        "top_products": [
            {
                "product_id": p["_id"],
                "name": p["product_name"],
                "quantity_sold": p["total_quantity"],
                "revenue": round(p["total_revenue"], 2),
                "orders": p["orders"]
            }
            for p in top_products
        ]
    }

@api_router.get("/admin/analytics/withdrawal-patterns")
async def get_withdrawal_patterns(days: int = 30):
    """Get withdrawal request patterns over time"""
    from datetime import timedelta
    
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Cashback withdrawals
    cashback_pipeline = [
        {"$match": {
            "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        }},
        {"$addFields": {
            "date_parsed": {"$dateFromString": {"dateString": "$created_at"}}
        }},
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date_parsed"}},
                "status": "$status"
            },
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount_requested"}
        }},
        {"$sort": {"_id.date": 1}}
    ]
    
    cashback_data = await db.cashback_withdrawals.aggregate(cashback_pipeline).to_list(length=None)
    
    # Transform data
    date_map = {}
    for item in cashback_data:
        date = item["_id"]["date"]
        status = item["_id"]["status"]
        
        if date not in date_map:
            date_map[date] = {
                "date": date,
                "pending": 0,
                "approved": 0,
                "completed": 0,
                "rejected": 0,
                "total_amount": 0
            }
        
        date_map[date][status] = item["count"]
        date_map[date]["total_amount"] += item["total_amount"]
    
    return {
        "days": days,
        "data": list(date_map.values())
    }

@api_router.get("/admin/analytics/overview")
async def get_analytics_overview():
    """Get comprehensive analytics overview"""
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)
    
    # Total users
    total_users = await db.users.count_documents({})
    vip_users = await db.users.count_documents({"membership_type": "vip"})
    free_users = total_users - vip_users
    
    # New users (last 30 days)
    new_users_30d = await db.users.count_documents({
        "created_at": {"$gte": thirty_days_ago.isoformat()}
    })
    
    # Revenue stats
    revenue_pipeline = [
        {"$match": {"status": "delivered"}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$total_cash"},
            "total_orders": {"$sum": 1}
        }}
    ]
    revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
    revenue_data = revenue_result[0] if revenue_result else {"total_revenue": 0, "total_orders": 0}
    
    # Recent revenue (last 30 days)
    recent_revenue_pipeline = [
        {"$match": {
            "status": "delivered",
            "created_at": {"$gte": thirty_days_ago.isoformat()}
        }},
        {"$group": {
            "_id": None,
            "revenue_30d": {"$sum": "$total_cash"},
            "orders_30d": {"$sum": 1}
        }}
    ]
    recent_revenue_result = await db.orders.aggregate(recent_revenue_pipeline).to_list(1)
    recent_revenue_data = recent_revenue_result[0] if recent_revenue_result else {"revenue_30d": 0, "orders_30d": 0}
    
    # Pending withdrawals
    pending_cashback = await db.cashback_withdrawals.count_documents({"status": "pending"})
    pending_profit = await db.profit_withdrawals.count_documents({"status": "pending"})
    
    # Total withdrawal amount pending
    cashback_amount_pipeline = [
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_requested"}}}
    ]
    cashback_amount_result = await db.cashback_withdrawals.aggregate(cashback_amount_pipeline).to_list(1)
    pending_cashback_amount = cashback_amount_result[0]["total"] if cashback_amount_result else 0
    
    profit_amount_result = await db.profit_withdrawals.aggregate(cashback_amount_pipeline).to_list(1)
    pending_profit_amount = profit_amount_result[0]["total"] if profit_amount_result else 0
    
    return {
        "users": {
            "total": total_users,
            "vip": vip_users,
            "free": free_users,
            "new_30d": new_users_30d
        },
        "revenue": {
            "total": round(revenue_data["total_revenue"], 2),
            "last_30d": round(recent_revenue_data["revenue_30d"], 2)
        },
        "orders": {
            "total": revenue_data["total_orders"],
            "last_30d": recent_revenue_data["orders_30d"]
        },
        "withdrawals": {
            "pending_count": pending_cashback + pending_profit,
            "pending_amount": round(pending_cashback_amount + pending_profit_amount, 2),
            "cashback_pending": pending_cashback,
            "profit_pending": pending_profit
        }
    }


@api_router.get("/admin/reports/withdrawals")
async def get_withdrawal_report_old(status: Optional[str] = None):
    """Get withdrawal statistics report (Admin)"""
    query = {}
    if status:
        query["status"] = status
    
    # Cashback withdrawals
    cashback_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$status",
            "total_amount": {"$sum": "$amount"},
            "total_fee": {"$sum": "$fee"},
            "count": {"$sum": 1}
        }}
    ]
    
    cashback_stats = await db.cashback_withdrawals.aggregate(cashback_pipeline).to_list(10)
    
    # Profit withdrawals
    profit_stats = await db.profit_withdrawals.aggregate(cashback_pipeline).to_list(10)
    
    return {
        "cashback_withdrawals": cashback_stats,
        "profit_withdrawals": profit_stats
    }


# ========== AUDIT LOGGING SYSTEM ==========

@api_router.post("/admin/audit/log")
async def create_audit_log(request: Request):
    """Create audit log entry (Internal use)"""
    data = await request.json()
    
    log_entry = {
        "log_id": str(uuid.uuid4()),
        "action": data.get("action"),
        "entity_type": data.get("entity_type"),
        "entity_id": data.get("entity_id"),
        "performed_by": data.get("performed_by"),
        "changes": data.get("changes", {}),
        "ip_address": data.get("ip_address"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.audit_logs.insert_one(log_entry)
    return {"message": "Audit log created", "log_id": log_entry["log_id"]}

@api_router.get("/admin/audit/logs")
async def get_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    performed_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """Get audit logs with filtering (Admin)"""
    query = {}
    
    if action:
        query["action"] = action
    if entity_type:
        query["entity_type"] = entity_type
    if performed_by:
        query["performed_by"] = performed_by
    
    total = await db.audit_logs.count_documents(query)
    logs = await db.audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Remove MongoDB _id
    for log in logs:
        log["_id"] = str(log["_id"])
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "logs": logs
    }

# ========== EMPLOYEE MANAGEMENT ==========

@api_router.post("/admin/employees/create")
async def create_employee(request: Request):
    """Create sub-admin, manager, or employee (Admin only)"""
    data = await request.json()
    
    # Validate role
    valid_roles = ["sub_admin", "manager", "employee"]
    if data.get("role") not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    # Required fields
    required_fields = ["email", "password", "first_name", "last_name", "mobile", "role"]
    for field in required_fields:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"{field} is required")
    
    # Check duplicates
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
    
    # Add employee-specific fields
    if data["role"] == "sub_admin":
        data["assigned_regions"] = data.get("assigned_regions", [])
    
    data["permissions"] = data.get("permissions", [])
    
    # Create user
    user = User(**data)
    user_dict = user.model_dump()
    
    # Convert datetime fields
    for field in ["created_at", "updated_at", "last_login"]:
        if user_dict.get(field):
            user_dict[field] = user_dict[field].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "employee_created",
        "entity_type": "user",
        "entity_id": user.uid,
        "performed_by": data.get("created_by", "admin"),
        "changes": {"role": data["role"], "name": data["name"]},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"{data['role']} created successfully",
        "uid": user.uid,
        "email": user.email,
        "role": data["role"]
    }

@api_router.get("/admin/employees")
async def get_employees(role: Optional[str] = None):
    """Get all employees (sub-admins, managers, employees) (Admin only)"""
    query = {"role": {"$in": ["sub_admin", "manager", "employee"]}}
    
    if role:
        query["role"] = role
    
    employees = await db.users.find(query).to_list(length=1000)
    
    # Remove sensitive data
    for emp in employees:
        emp.pop("password_hash", None)
        emp.pop("reset_token", None)
        emp["_id"] = str(emp["_id"])
    
    return {
        "total": len(employees),
        "employees": employees
    }

@api_router.put("/admin/employees/{uid}/permissions")
async def update_employee_permissions(uid: str, request: Request):
    """Update employee permissions (Admin only)"""
    data = await request.json()
    permissions = data.get("permissions", [])
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") not in ["sub_admin", "manager", "employee"]:
        raise HTTPException(status_code=400, detail="User is not an employee")
    
    result = await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "permissions": permissions,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create audit log
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "permissions_updated",
        "entity_type": "user",
        "entity_id": uid,
        "performed_by": data.get("updated_by", "admin"),
        "changes": {"permissions": permissions},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    if result.modified_count > 0:
        return {"message": "Permissions updated", "uid": uid, "permissions": permissions}
    else:
        return {"message": "No changes made", "uid": uid}


# ========== PROFILE-BASED PASSWORD RECOVERY ROUTES ==========

class PasswordRecoveryVerifyRequest(BaseModel):
    email: str
    verification_fields: Dict[str, str]  # {field_name: value}

class PasswordRecoveryResetRequest(BaseModel):
    email: str
    verification_fields: Dict[str, str]
    new_password: str

@api_router.post("/auth/password-recovery/verify")
async def verify_recovery_fields(request: PasswordRecoveryVerifyRequest):
    """Verify user identity using profile fields (2-field verification)"""
    email = request.email.lower()
    verification_fields = request.verification_fields
    
    # Must provide exactly 2 fields
    if len(verification_fields) != 2:
        raise HTTPException(status_code=400, detail="Exactly 2 verification fields required")
    
    # Find user by email
    user = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify each field
    for field_name, field_value in verification_fields.items():
        if field_name not in ["pan_number", "aadhaar_number", "mobile", "name"]:
            raise HTTPException(status_code=400, detail=f"Invalid verification field: {field_name}")
        
        user_value = user.get(field_name, "")
        
        # Case-insensitive comparison for string fields
        if isinstance(user_value, str) and isinstance(field_value, str):
            if user_value.lower() != field_value.lower():
                raise HTTPException(status_code=401, detail="Verification failed")
        else:
            if str(user_value) != str(field_value):
                raise HTTPException(status_code=401, detail="Verification failed")
    
    return {
        "message": "Verification successful",
        "email": email,
        "name": user.get("name", ""),
        "uid": user.get("uid", "")
    }

@api_router.post("/auth/password-recovery/reset")
async def reset_password_with_verification(request: PasswordRecoveryResetRequest):
    """Reset password after successful verification"""
    email = request.email.lower()
    verification_fields = request.verification_fields
    new_password = request.new_password
    
    # Must provide exactly 2 fields
    if len(verification_fields) != 2:
        raise HTTPException(status_code=400, detail="Exactly 2 verification fields required")
    
    # Validate password
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Find user by email
    user = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Re-verify fields for security
    for field_name, field_value in verification_fields.items():
        if field_name not in ["pan_number", "aadhaar_number", "mobile", "name"]:
            raise HTTPException(status_code=400, detail=f"Invalid verification field: {field_name}")
        
        user_value = user.get(field_name, "")
        
        if isinstance(user_value, str) and isinstance(field_value, str):
            if user_value.lower() != field_value.lower():
                raise HTTPException(status_code=401, detail="Verification failed")
        else:
            if str(user_value) != str(field_value):
                raise HTTPException(status_code=401, detail="Verification failed")
    
    # Update password
    new_hash = hash_password(new_password)
    await db.users.update_one(
        {"uid": user["uid"]},
        {"$set": {
            "password_hash": new_hash,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password reset successful"}


# ========== SUPPORT TICKET SYSTEM ROUTES ==========

class SupportTicket(BaseModel):
    ticket_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    user_email: str
    category: str  # Account, Mining, Marketplace, Wallet, KYC/VIP, Orders, Technical, Other
    subject: str
    description: str
    status: str = "open"  # open, in_progress, resolved, closed
    priority: str = "medium"  # low, medium, high
    attachments: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None

class SupportTicketReply(BaseModel):
    reply_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str
    user_id: str
    user_name: str
    user_role: str  # admin, user
    message: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TicketCreateRequest(BaseModel):
    user_id: str
    category: str
    subject: str
    description: str
    attachments: List[str] = []

class TicketReplyRequest(BaseModel):
    ticket_id: str
    user_id: str
    message: str

class TicketUpdateRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None

@api_router.post("/support/tickets/create")
async def create_support_ticket(request: TicketCreateRequest):
    """Create a new support ticket"""
    # Get user details
    user = await db.users.find_one({"uid": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    ticket = SupportTicket(
        user_id=request.user_id,
        user_name=user.get("name", "Unknown"),
        user_email=user.get("email", ""),
        category=request.category,
        subject=request.subject,
        description=request.description,
        attachments=request.attachments
    )
    
    await db.support_tickets.insert_one(ticket.model_dump())
    
    return {
        "message": "Support ticket created successfully",
        "ticket_id": ticket.ticket_id,
        "ticket": ticket.model_dump()
    }

@api_router.get("/support/tickets/user/{user_id}")
async def get_user_tickets(user_id: str, status: Optional[str] = None):
    """Get all tickets for a specific user"""
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(query).sort("created_at", -1).to_list(length=None)
    
    # Remove _id field
    for ticket in tickets:
        ticket.pop("_id", None)
    
    return {"tickets": tickets, "count": len(tickets)}

@api_router.get("/support/tickets/{ticket_id}")
async def get_ticket_details(ticket_id: str):
    """Get ticket details with all replies"""
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket.pop("_id", None)
    
    # Get all replies for this ticket
    replies = await db.support_ticket_replies.find({"ticket_id": ticket_id}).sort("created_at", 1).to_list(length=None)
    for reply in replies:
        reply.pop("_id", None)
    
    ticket["replies"] = replies
    
    return ticket

@api_router.post("/support/tickets/{ticket_id}/reply")
async def add_ticket_reply(ticket_id: str, request: TicketReplyRequest):
    """Add a reply to a ticket"""
    # Verify ticket exists
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get user details
    user = await db.users.find_one({"uid": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    reply = SupportTicketReply(
        ticket_id=ticket_id,
        user_id=request.user_id,
        user_name=user.get("name", "Unknown"),
        user_role=user.get("role", "user"),
        message=request.message
    )
    
    await db.support_ticket_replies.insert_one(reply.model_dump())
    
    # Update ticket's updated_at timestamp
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "message": "Reply added successfully",
        "reply": reply.model_dump()
    }

@api_router.get("/admin/support/tickets")
async def get_all_tickets(status: Optional[str] = None, category: Optional[str] = None, page: int = 1, limit: int = 20):
    """Admin endpoint to get all support tickets with pagination"""
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    
    skip = (page - 1) * limit
    total = await db.support_tickets.count_documents(query)
    total_pages = (total + limit - 1) // limit
    
    tickets = await db.support_tickets.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    for ticket in tickets:
        ticket.pop("_id", None)
    
    return {
        "tickets": tickets,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@api_router.put("/admin/support/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, request: TicketUpdateRequest):
    """Admin endpoint to update ticket status/priority/assignment"""
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if request.status:
        update_data["status"] = request.status
    if request.priority:
        update_data["priority"] = request.priority
    if request.assigned_to is not None:
        update_data["assigned_to"] = request.assigned_to
    if request.resolution_notes is not None:
        update_data["resolution_notes"] = request.resolution_notes
    
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": update_data}
    )
    
    return {"message": "Ticket updated successfully", "updates": update_data}


# ========== ADMIN STOCKIST MANAGEMENT ROUTES ==========

class StockistCreateRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str  # master_stockist, sub_stockist, outlet
    mobile: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    parent_id: Optional[str] = None  # For assignment (sub -> master, outlet -> sub)

class StockistEditRequest(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: Optional[bool] = None

class StockistAssignRequest(BaseModel):
    stockist_id: str
    parent_id: str

@api_router.post("/admin/stockists/create")
async def create_stockist(request: StockistCreateRequest):
    """Admin creates a new stockist (Master/Sub/Outlet)"""
    # Validate role
    if request.role not in ["master_stockist", "sub_stockist", "outlet"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be master_stockist, sub_stockist, or outlet")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": request.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Validate parent assignment
    if request.parent_id:
        parent = await db.users.find_one({"uid": request.parent_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent not found")
        
        # Validate hierarchy: sub must have master parent, outlet must have sub parent
        if request.role == "sub_stockist" and parent.get("role") != "master_stockist":
            raise HTTPException(status_code=400, detail="Sub Stockist must be assigned to a Master Stockist")
        if request.role == "outlet" and parent.get("role") != "sub_stockist":
            raise HTTPException(status_code=400, detail="Outlet must be assigned to a Sub Stockist")
    
    # Create user
    user_data = {
        "uid": str(uuid.uuid4()),
        "email": request.email.lower(),
        "password_hash": hash_password(request.password),
        "name": request.name,
        "role": request.role,
        "mobile": request.mobile,
        "state": request.state,
        "district": request.district,
        "pincode": request.pincode,
        "parent_id": request.parent_id,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "membership_type": "free",
        "kyc_status": "pending",
        "prc_balance": 0,
        "cashback_wallet_balance": 0,
        "profit_wallet_balance": 0,
        "security_deposit_paid": False,
        "renewal_status": "pending"
    }
    
    # Add role-specific parent assignment fields
    if request.role == "outlet":
        user_data["assigned_sub_stockist"] = request.parent_id
    elif request.role == "sub_stockist":
        user_data["assigned_master_stockist"] = request.parent_id
    
    await db.users.insert_one(user_data)
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "create_stockist",
        "entity_type": "user",
        "entity_id": user_data["uid"],
        "performed_by": "admin",
        "changes": {"role": request.role, "email": request.email},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"{request.role.replace('_', ' ').title()} created successfully",
        "uid": user_data["uid"],
        "email": user_data["email"],
        "role": user_data["role"]
    }

@api_router.put("/admin/stockists/{uid}/edit")
async def edit_stockist(uid: str, request: StockistEditRequest):
    """Admin edits stockist details"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="Stockist not found")
    
    if user.get("role") not in ["master_stockist", "sub_stockist", "outlet"]:
        raise HTTPException(status_code=400, detail="User is not a stockist")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if request.name:
        update_data["name"] = request.name
    if request.mobile:
        update_data["mobile"] = request.mobile
    if request.state:
        update_data["state"] = request.state
    if request.district:
        update_data["district"] = request.district
    if request.pincode:
        update_data["pincode"] = request.pincode
    if request.parent_id is not None:
        # Validate parent
        parent = await db.users.find_one({"uid": request.parent_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent not found")
        update_data["parent_id"] = request.parent_id
    if request.is_active is not None:
        update_data["is_active"] = request.is_active
    
    await db.users.update_one({"uid": uid}, {"$set": update_data})
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "edit_stockist",
        "entity_type": "user",
        "entity_id": uid,
        "performed_by": "admin",
        "changes": update_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Stockist updated successfully", "updates": update_data}

@api_router.delete("/admin/stockists/{uid}")
async def delete_stockist(uid: str):
    """Admin deletes/deactivates a stockist"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="Stockist not found")
    
    if user.get("role") not in ["master_stockist", "sub_stockist", "outlet"]:
        raise HTTPException(status_code=400, detail="User is not a stockist")
    
    # Soft delete - deactivate instead of removing
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "is_active": False,
            "deactivated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "delete_stockist",
        "entity_type": "user",
        "entity_id": uid,
        "performed_by": "admin",
        "changes": {"is_active": False},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Stockist deactivated successfully"}

@api_router.post("/admin/stockists/assign")
async def assign_stockist(request: StockistAssignRequest):
    """Admin assigns a stockist to a parent"""
    stockist = await db.users.find_one({"uid": request.stockist_id})
    if not stockist:
        raise HTTPException(status_code=404, detail="Stockist not found")
    
    parent = await db.users.find_one({"uid": request.parent_id})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    
    # Validate hierarchy
    stockist_role = stockist.get("role")
    parent_role = parent.get("role")
    
    if stockist_role == "sub_stockist" and parent_role != "master_stockist":
        raise HTTPException(status_code=400, detail="Sub Stockist must be assigned to a Master Stockist")
    if stockist_role == "outlet" and parent_role != "sub_stockist":
        raise HTTPException(status_code=400, detail="Outlet must be assigned to a Sub Stockist")
    if stockist_role == "master_stockist":
        raise HTTPException(status_code=400, detail="Master Stockist cannot be assigned to anyone")
    
    # Update assignment with role-specific fields
    update_fields = {
        "parent_id": request.parent_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Also set role-specific assignment fields for compatibility
    if stockist_role == "outlet":
        update_fields["assigned_sub_stockist"] = request.parent_id
    elif stockist_role == "sub_stockist":
        update_fields["assigned_master_stockist"] = request.parent_id
    
    await db.users.update_one(
        {"uid": request.stockist_id},
        {"$set": update_fields}
    )
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "assign_stockist",
        "entity_type": "user",
        "entity_id": request.stockist_id,
        "performed_by": "admin",
        "changes": {"parent_id": request.parent_id},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"{stockist_role.replace('_', ' ').title()} assigned successfully",
        "stockist_name": stockist.get("name"),
        "parent_name": parent.get("name")
    }

@api_router.get("/admin/stockists")
async def get_all_stockists(role: Optional[str] = None, status: Optional[str] = None):
    """Admin gets all stockists with optional filters"""
    query = {"role": {"$in": ["master_stockist", "sub_stockist", "outlet"]}}
    
    if role:
        query["role"] = role
    if status == "active":
        query["is_active"] = True
    elif status == "inactive":
        query["is_active"] = False
    
    stockists = await db.users.find(query).to_list(length=None)
    
    # Remove sensitive data
    for stockist in stockists:
        stockist.pop("password_hash", None)
        stockist.pop("_id", None)
    
    return {"stockists": stockists, "count": len(stockists)}


# ========== ADMIN SECURITY DEPOSIT MANUAL ENTRY ROUTES ==========

class SecurityDepositManualEntry(BaseModel):
    user_id: str
    amount: float
    monthly_return_rate: float = 0.03  # 3% default
    notes: Optional[str] = None

@api_router.post("/admin/security-deposit/manual-entry")
async def create_security_deposit_manual(request: SecurityDepositManualEntry):
    """Admin manually creates a security deposit entry"""
    # Verify user exists and is a stockist
    user = await db.users.find_one({"uid": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") not in ["master_stockist", "sub_stockist", "outlet"]:
        raise HTTPException(status_code=400, detail="User must be a stockist")
    
    # Check if already has a deposit
    existing = await db.security_deposits.find_one({"user_id": request.user_id, "status": {"$in": ["pending", "approved"]}})
    if existing:
        raise HTTPException(status_code=400, detail="User already has an active security deposit")
    
    # Calculate monthly return
    monthly_return = request.amount * request.monthly_return_rate
    
    # Create deposit entry
    deposit = {
        "deposit_id": str(uuid.uuid4()),
        "user_id": request.user_id,
        "user_name": user.get("name", ""),
        "user_role": user.get("role", ""),
        "amount": request.amount,
        "monthly_return_rate": request.monthly_return_rate,
        "monthly_return_amount": monthly_return,
        "balance_pending": request.amount,  # Full amount pending initially
        "total_returned": 0,
        "status": "approved",  # Auto-approved since admin is creating
        "payment_method": "admin_entry",
        "notes": request.notes or f"Manual entry by admin on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": "admin",
        "next_return_due": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "return_history": []
    }
    
    await db.security_deposits.insert_one(deposit)
    
    # Update user record
    await db.users.update_one(
        {"uid": request.user_id},
        {"$set": {
            "security_deposit_paid": True,
            "security_deposit_amount": request.amount,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "create_security_deposit_manual",
        "entity_type": "security_deposit",
        "entity_id": deposit["deposit_id"],
        "performed_by": "admin",
        "changes": {"amount": request.amount, "user_id": request.user_id},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Security deposit entry created successfully",
        "deposit_id": deposit["deposit_id"],
        "amount": request.amount,
        "monthly_return": monthly_return,
        "balance_pending": request.amount
    }

@api_router.put("/admin/security-deposit/{deposit_id}/edit")
async def edit_security_deposit(deposit_id: str, request: Request):
    """Admin edits security deposit details"""
    deposit = await db.security_deposits.find_one({"deposit_id": deposit_id})
    if not deposit:
        raise HTTPException(status_code=404, detail="Security deposit not found")
    
    data = await request.json()
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if "amount" in data:
        new_amount = float(data["amount"])
        monthly_return = new_amount * deposit.get("monthly_return_rate", 0.03)
        update_data["amount"] = new_amount
        update_data["monthly_return_amount"] = monthly_return
        
        # Recalculate balance pending
        total_returned = deposit.get("total_returned", 0)
        update_data["balance_pending"] = new_amount - total_returned
    
    if "monthly_return_rate" in data:
        rate = float(data["monthly_return_rate"])
        amount = data.get("amount", deposit.get("amount", 0))
        update_data["monthly_return_rate"] = rate
        update_data["monthly_return_amount"] = amount * rate
    
    if "notes" in data:
        update_data["notes"] = data["notes"]
    
    if "balance_pending" in data:
        update_data["balance_pending"] = float(data["balance_pending"])
    
    await db.security_deposits.update_one({"deposit_id": deposit_id}, {"$set": update_data})
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "edit_security_deposit",
        "entity_type": "security_deposit",
        "entity_id": deposit_id,
        "performed_by": "admin",
        "changes": update_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Security deposit updated successfully", "updates": update_data}


# ========== ADMIN RENEWAL MANUAL ENTRY ROUTES ==========

class RenewalManualEntry(BaseModel):
    user_id: str
    amount: float
    gst_rate: float = 0.18  # 18% GST
    notes: Optional[str] = None

@api_router.post("/admin/renewal/manual-entry")
async def create_renewal_manual(request: RenewalManualEntry):
    """Admin manually creates a renewal entry"""
    # Verify user exists and is a stockist
    user = await db.users.find_one({"uid": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") not in ["master_stockist", "sub_stockist", "outlet"]:
        raise HTTPException(status_code=400, detail="User must be a stockist")
    
    # Calculate total with GST
    gst_amount = request.amount * request.gst_rate
    total_amount = request.amount + gst_amount
    
    # Create renewal entry
    renewal = {
        "renewal_id": str(uuid.uuid4()),
        "user_id": request.user_id,
        "user_name": user.get("name", ""),
        "user_role": user.get("role", ""),
        "base_amount": request.amount,
        "gst_rate": request.gst_rate,
        "gst_amount": gst_amount,
        "total_amount": total_amount,
        "status": "approved",  # Auto-approved since admin is creating
        "payment_method": "admin_entry",
        "notes": request.notes or f"Manual entry by admin on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": "admin",
        "renewal_start_date": datetime.now(timezone.utc).isoformat(),
        "renewal_end_date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    }
    
    await db.annual_renewals.insert_one(renewal)
    
    # Update user record
    await db.users.update_one(
        {"uid": request.user_id},
        {"$set": {
            "renewal_status": "active",
            "renewal_due_date": renewal["renewal_end_date"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "create_renewal_manual",
        "entity_type": "annual_renewal",
        "entity_id": renewal["renewal_id"],
        "performed_by": "admin",
        "changes": {"amount": request.amount, "user_id": request.user_id},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Renewal entry created successfully",
        "renewal_id": renewal["renewal_id"],
        "base_amount": request.amount,
        "gst_amount": gst_amount,
        "total_amount": total_amount,
        "valid_until": renewal["renewal_end_date"]
    }

@api_router.put("/admin/renewal/{renewal_id}/edit")
async def edit_renewal(renewal_id: str, request: Request):
    """Admin edits renewal details"""
    renewal = await db.annual_renewals.find_one({"renewal_id": renewal_id})
    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal not found")
    
    data = await request.json()
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if "base_amount" in data:
        base_amount = float(data["base_amount"])
        gst_rate = data.get("gst_rate", renewal.get("gst_rate", 0.18))
        gst_amount = base_amount * gst_rate
        total_amount = base_amount + gst_amount
        
        update_data["base_amount"] = base_amount
        update_data["gst_amount"] = gst_amount
        update_data["total_amount"] = total_amount
    
    if "notes" in data:
        update_data["notes"] = data["notes"]
    
    await db.annual_renewals.update_one({"renewal_id": renewal_id}, {"$set": update_data})
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "edit_renewal",
        "entity_type": "annual_renewal",
        "entity_id": renewal_id,
        "performed_by": "admin",
        "changes": update_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Renewal updated successfully", "updates": update_data}


# ========== STOCKIST FINANCIAL INFO ROUTES ==========

@api_router.get("/stockist/{uid}/financial-info")
async def get_stockist_financial_info(uid: str):
    """Get security deposit and renewal info for a stockist"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get security deposit
    deposit = await db.security_deposits.find_one({"user_id": uid, "status": "approved"})
    if deposit:
        deposit.pop("_id", None)
    
    # Get renewal
    renewal = await db.annual_renewals.find_one({"user_id": uid, "status": "approved"}, sort=[("created_at", -1)])
    if renewal:
        renewal.pop("_id", None)
    
    return {
        "security_deposit": deposit,
        "renewal": renewal,
        "user_info": {
            "security_deposit_paid": user.get("security_deposit_paid", False),
            "renewal_status": user.get("renewal_status", "pending")
        }
    }


# ========== ADMIN USER MANAGEMENT ROUTES ==========

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    role: Optional[str] = None
    membership_type: Optional[str] = None
    kyc_status: Optional[str] = None
    is_active: Optional[bool] = None

class BalanceAdjustRequest(BaseModel):
    balance_type: str  # prc_balance, cashback_wallet_balance, profit_wallet_balance
    amount: float
    operation: str  # add, deduct, set
    notes: Optional[str] = None

@api_router.put("/admin/users/{uid}/update")
async def update_user_admin(uid: str, request: UserUpdateRequest):
    """Admin updates user details"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if request.name:
        update_data["name"] = request.name
    if request.email:
        # Check if email already exists
        existing = await db.users.find_one({"email": request.email.lower(), "uid": {"$ne": uid}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
        update_data["email"] = request.email.lower()
    if request.mobile:
        update_data["mobile"] = request.mobile
    if request.role:
        update_data["role"] = request.role
    if request.membership_type:
        update_data["membership_type"] = request.membership_type
    if request.kyc_status:
        update_data["kyc_status"] = request.kyc_status
    if request.is_active is not None:
        update_data["is_active"] = request.is_active
    
    await db.users.update_one({"uid": uid}, {"$set": update_data})
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "update_user",
        "entity_type": "user",
        "entity_id": uid,
        "performed_by": "admin",
        "changes": update_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "User updated successfully", "updates": update_data}

@api_router.post("/admin/users/{uid}/adjust-balance")
async def adjust_user_balance(uid: str, request: BalanceAdjustRequest):
    """Admin adjusts user balance (PRC, cashback, profit)"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request.balance_type not in ["prc_balance", "cashback_wallet_balance", "profit_wallet_balance"]:
        raise HTTPException(status_code=400, detail="Invalid balance type")
    
    current_balance = user.get(request.balance_type, 0)
    
    if request.operation == "add":
        new_balance = current_balance + request.amount
    elif request.operation == "deduct":
        new_balance = current_balance - request.amount
        if new_balance < 0:
            raise HTTPException(status_code=400, detail="Insufficient balance")
    elif request.operation == "set":
        new_balance = request.amount
    else:
        raise HTTPException(status_code=400, detail="Invalid operation")
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            request.balance_type: new_balance,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create wallet transaction record
    wallet_type_map = {
        "prc_balance": "prc",
        "cashback_wallet_balance": "cashback",
        "profit_wallet_balance": "profit"
    }
    
    transaction_type = "credit" if request.operation == "add" or (request.operation == "set" and new_balance > current_balance) else "debit"
    actual_amount = abs(new_balance - current_balance)
    
    await db.wallet_transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": uid,
        "type": transaction_type,
        "wallet_type": wallet_type_map.get(request.balance_type, "unknown"),
        "amount": actual_amount,
        "description": f"Admin adjustment: {request.operation} - {request.notes or 'Manual adjustment'}",
        "reference_id": "admin_adjustment",
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "adjust_balance",
        "entity_type": "user",
        "entity_id": uid,
        "performed_by": "admin",
        "changes": {
            "balance_type": request.balance_type,
            "operation": request.operation,
            "amount": request.amount,
            "old_balance": current_balance,
            "new_balance": new_balance,
            "notes": request.notes
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Balance adjusted successfully",
        "balance_type": request.balance_type,
        "old_balance": current_balance,
        "new_balance": new_balance
    }

@api_router.delete("/admin/users/{uid}/delete")
async def delete_user_admin(uid: str):
    """Admin deactivates/deletes a user"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Soft delete - deactivate
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "is_active": False,
            "deactivated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "delete_user",
        "entity_type": "user",
        "entity_id": uid,
        "performed_by": "admin",
        "changes": {"is_active": False},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "User deleted successfully"}


# ========== ADMIN ORDER MANAGEMENT ROUTES ==========

@api_router.get("/admin/orders/all")
async def get_all_orders_admin(
    page: int = 1,
    limit: int = 50,
    status: Optional[str] = None,
    search: Optional[str] = None
):
    """Admin endpoint to get all orders with filters"""
    query = {}
    
    if status:
        query["status"] = status
    
    if search:
        query["$or"] = [
            {"order_id": {"$regex": search, "$options": "i"}},
            {"user_id": {"$regex": search, "$options": "i"}},
            {"secret_code": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
    total = await db.orders.count_documents(query)
    
    # Enrich with user data
    for order in orders:
        order.pop("_id", None)
        user = await db.users.find_one({"uid": order.get("user_id")})
        if user:
            order["user_name"] = user.get("name", "Unknown")
            order["user_email"] = user.get("email", "")
    
    return {
        "orders": orders,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/admin/orders/{order_id}/details")
async def get_order_details_admin(order_id: str):
    """Admin gets detailed order information"""
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.pop("_id", None)
    
    # Get user details
    user = await db.users.find_one({"uid": order.get("user_id")})
    if user:
        order["user_details"] = {
            "name": user.get("name"),
            "email": user.get("email"),
            "mobile": user.get("mobile"),
            "membership_type": user.get("membership_type")
        }
    
    return order

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status_admin(order_id: str, status: str, notes: Optional[str] = None):
    """Admin updates order status"""
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    valid_statuses = ["pending", "verified", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if status == "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "cancelled":
        update_data["cancelled_at"] = datetime.now(timezone.utc).isoformat()
        # Refund PRC to user
        user = await db.users.find_one({"uid": order.get("user_id")})
        if user:
            total_prc = order.get("total_prc", 0)
            await db.users.update_one(
                {"uid": user["uid"]},
                {"$inc": {"prc_balance": total_prc}}
            )
            # Deduct cashback if already credited
            cashback = order.get("cashback_amount", 0)
            if cashback > 0:
                await db.users.update_one(
                    {"uid": user["uid"]},
                    {"$inc": {"cashback_wallet_balance": -cashback}}
                )
    
    if notes:
        update_data["admin_notes"] = notes
    
    await db.orders.update_one({"order_id": order_id}, {"$set": update_data})
    
    # Log action
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "update_order_status",
        "entity_type": "order",
        "entity_id": order_id,
        "performed_by": "admin",
        "changes": {"status": status, "notes": notes},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Order status updated to {status}", "order_id": order_id}


# Include router
# ========== MANAGER DASHBOARD ENDPOINTS ==========

@api_router.get("/manager/dashboard")
async def get_manager_dashboard(uid: str):
    """Get manager dashboard overview metrics"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Get current date range
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        # Total active users
        total_users = await db.users.count_documents({"active": True, "role": "user"})
        
        # Users registered this week
        new_users_week = await db.users.count_documents({
            "role": "user",
            "created_at": {"$gte": week_ago.isoformat()}
        })
        
        # Total orders
        total_orders = await db.orders.count_documents({})
        
        # Orders today
        orders_today = await db.orders.count_documents({
            "created_at": {"$gte": today.isoformat()}
        })
        
        # Pending KYC approvals
        pending_kyc = await db.users.count_documents({
            "kyc_status": "pending",
            "role": "user"
        })
        
        # Pending withdrawals
        pending_withdrawals = await db.cashback_withdrawals.count_documents({
            "status": "pending"
        })
        
        # Calculate revenue (sum of completed orders)
        completed_orders = db.orders.find({"status": "delivered"})
        total_revenue = 0
        async for order in completed_orders:
            total_revenue += order.get("total_amount", 0)
        
        # Sales trend (last 7 days)
        sales_trend = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_end = day + timedelta(days=1)
            day_orders = await db.orders.count_documents({
                "created_at": {"$gte": day.isoformat(), "$lt": day_end.isoformat()}
            })
            sales_trend.append({
                "date": day.strftime("%Y-%m-%d"),
                "orders": day_orders
            })
        
        # Recent activities (last 10)
        recent_orders = await db.orders.find().sort("created_at", -1).limit(5).to_list(length=5)
        recent_users = await db.users.find({"role": "user"}).sort("created_at", -1).limit(5).to_list(length=5)
        
        activities = []
        for order in recent_orders:
            activities.append({
                "type": "order",
                "message": f"New order #{order.get('order_id')} - ₹{order.get('total_amount', 0)}",
                "time": order.get("created_at"),
                "status": order.get("status")
            })
        
        for user in recent_users:
            activities.append({
                "type": "user",
                "message": f"New user registered: {user.get('name', 'Unknown')}",
                "time": user.get("created_at"),
                "status": "active"
            })
        
        # Sort activities by time
        activities.sort(key=lambda x: x.get("time", ""), reverse=True)
        activities = activities[:10]
        
        return {
            "metrics": {
                "total_users": total_users,
                "new_users_week": new_users_week,
                "total_orders": total_orders,
                "orders_today": orders_today,
                "pending_kyc": pending_kyc,
                "pending_withdrawals": pending_withdrawals,
                "total_revenue": round(total_revenue, 2)
            },
            "sales_trend": sales_trend,
            "recent_activities": activities
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/manager/users")
async def get_manager_users(
    uid: str,
    search: Optional[str] = None,
    kyc_status: Optional[str] = None,
    membership_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get users list with filters for manager"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Build query
        query = {"role": "user"}
        
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"mobile": {"$regex": search, "$options": "i"}},
                {"uid": {"$regex": search, "$options": "i"}}
            ]
        
        if kyc_status:
            query["kyc_status"] = kyc_status
        
        if membership_type:
            query["membership_type"] = membership_type
        
        # Get total count
        total = await db.users.count_documents(query)
        
        # Get users
        users = await db.users.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        # Remove sensitive data
        for user in users:
            user.pop("password", None)
            user.pop("_id", None)
        
        return {
            "users": users,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/manager/kyc/approve")
async def approve_kyc(uid: str, user_id: str):
    """Approve user KYC (Manager access)"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.get("kyc_status") != "pending":
            raise HTTPException(status_code=400, detail="KYC is not pending")
        
        # Update KYC status
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "kyc_status": "verified",
                "kyc_verified_at": datetime.now(timezone.utc).isoformat(),
                "kyc_verified_by": uid
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "kyc_approve",
            "target_user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"user_email": user.get("email")}
        })
        
        return {"message": "KYC approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/manager/kyc/reject")
async def reject_kyc(request: Request, uid: str, user_id: str):
    """Reject user KYC with reason (Manager access)"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        reason = data.get("reason", "Documents not clear or incorrect")
        
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.get("kyc_status") != "pending":
            raise HTTPException(status_code=400, detail="KYC is not pending")
        
        # Update KYC status
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "kyc_status": "rejected",
                "kyc_rejection_reason": reason,
                "kyc_rejected_at": datetime.now(timezone.utc).isoformat(),
                "kyc_rejected_by": uid
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "kyc_reject",
            "target_user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"user_email": user.get("email"), "reason": reason}
        })
        
        return {"message": "KYC rejected", "reason": reason}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/manager/orders")
async def get_manager_orders(
    uid: str,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get orders list with filters for manager"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Build query
        query = {}
        
        if status:
            query["status"] = status
        
        if search:
            query["$or"] = [
                {"order_id": {"$regex": search, "$options": "i"}},
                {"user_id": {"$regex": search, "$options": "i"}}
            ]
        
        # Get total count
        total = await db.orders.count_documents(query)
        
        # Get orders
        orders = await db.orders.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        # Enrich orders with user info
        for order in orders:
            order.pop("_id", None)
            user = await db.users.find_one({"uid": order.get("user_id")})
            if user:
                order["user_name"] = user.get("name")
                order["user_email"] = user.get("email")
        
        return {
            "orders": orders,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/manager/orders/{order_id}/status")
async def update_order_status(order_id: str, request: Request, uid: str):
    """Update order status (Manager access)"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        new_status = data.get("status")
        notes = data.get("notes", "")
        
        valid_statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
        if new_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        order = await db.orders.find_one({"order_id": order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Update order status
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": uid
        }
        
        if notes:
            update_data["manager_notes"] = notes
        
        if new_status == "delivered":
            update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
        elif new_status == "shipped":
            update_data["shipped_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": update_data}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "order_status_update",
            "target_order_id": order_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {
                "old_status": order.get("status"),
                "new_status": new_status,
                "notes": notes
            }
        })
        
        return {"message": f"Order status updated to {new_status}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/manager/reports/sales")
async def get_sales_report(
    uid: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get sales report (Manager access)"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Default to last 30 days
        if not end_date:
            end_date = datetime.now(timezone.utc).isoformat()
        if not start_date:
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        
        # Build query
        query = {
            "created_at": {"$gte": start_date, "$lte": end_date}
        }
        
        # Get orders
        orders = await db.orders.find(query).to_list(length=None)
        
        # Calculate metrics
        total_orders = len(orders)
        total_revenue = sum(order.get("total_amount", 0) for order in orders)
        
        # Orders by status
        status_breakdown = {}
        for order in orders:
            status = order.get("status", "unknown")
            status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        # Daily breakdown
        daily_sales = {}
        for order in orders:
            date = order.get("created_at", "")[:10]  # Get YYYY-MM-DD
            if date not in daily_sales:
                daily_sales[date] = {"orders": 0, "revenue": 0}
            daily_sales[date]["orders"] += 1
            daily_sales[date]["revenue"] += order.get("total_amount", 0)
        
        # Convert to list
        daily_sales_list = [
            {"date": date, **metrics}
            for date, metrics in sorted(daily_sales.items())
        ]
        
        return {
            "period": {"start": start_date, "end": end_date},
            "summary": {
                "total_orders": total_orders,
                "total_revenue": round(total_revenue, 2),
                "average_order_value": round(total_revenue / total_orders if total_orders > 0 else 0, 2)
            },
            "status_breakdown": status_breakdown,
            "daily_sales": daily_sales_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/manager/reports/users")
async def get_users_report(
    uid: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get users report (Manager access)"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Default to last 30 days
        if not end_date:
            end_date = datetime.now(timezone.utc).isoformat()
        if not start_date:
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        
        # Total users
        total_users = await db.users.count_documents({"role": "user"})
        
        # New users in period
        new_users = await db.users.count_documents({
            "role": "user",
            "created_at": {"$gte": start_date, "$lte": end_date}
        })
        
        # VIP vs Free
        vip_users = await db.users.count_documents({"role": "user", "membership_type": "vip"})
        free_users = total_users - vip_users
        
        # KYC status breakdown
        kyc_verified = await db.users.count_documents({"role": "user", "kyc_status": "verified"})
        kyc_pending = await db.users.count_documents({"role": "user", "kyc_status": "pending"})
        kyc_rejected = await db.users.count_documents({"role": "user", "kyc_status": "rejected"})
        kyc_not_submitted = total_users - (kyc_verified + kyc_pending + kyc_rejected)
        
        # Daily user growth
        users_list = await db.users.find({
            "role": "user",
            "created_at": {"$gte": start_date, "$lte": end_date}
        }).to_list(length=None)
        
        daily_growth = {}
        for user in users_list:
            date = user.get("created_at", "")[:10]
            daily_growth[date] = daily_growth.get(date, 0) + 1
        
        daily_growth_list = [
            {"date": date, "new_users": count}
            for date, count in sorted(daily_growth.items())
        ]
        
        return {
            "period": {"start": start_date, "end": end_date},
            "summary": {
                "total_users": total_users,
                "new_users": new_users,
                "vip_users": vip_users,
                "free_users": free_users
            },
            "kyc_breakdown": {
                "verified": kyc_verified,
                "pending": kyc_pending,
                "rejected": kyc_rejected,
                "not_submitted": kyc_not_submitted
            },
            "daily_growth": daily_growth_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== PHASE 2: PRODUCT MANAGEMENT ==========

@api_router.get("/manager/products")
async def get_manager_products(
    uid: str,
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get products list with filters (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        query = {}
        
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"product_id": {"$regex": search, "$options": "i"}},
                {"category": {"$regex": search, "$options": "i"}}
            ]
        
        if category:
            query["category"] = category
        
        if status:
            query["active"] = (status == "active")
        
        total = await db.products.count_documents(query)
        products = await db.products.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        for product in products:
            product.pop("_id", None)
        
        return {
            "products": products,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/manager/products")
async def add_product(request: Request, uid: str):
    """Add new product (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        
        product_id = str(uuid.uuid4())
        product = {
            "product_id": product_id,
            "name": data.get("name"),
            "description": data.get("description", ""),
            "category": data.get("category", ""),
            "price": float(data.get("price", 0)),
            "prc_cost": float(data.get("prc_cost", 0)),
            "stock": int(data.get("stock", 0)),
            "image_url": data.get("image_url", ""),
            "active": data.get("active", True),
            "created_by": uid,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.products.insert_one(product)
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "product_add",
            "target_product_id": product_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"product_name": product["name"]}
        })
        
        return {"message": "Product added successfully", "product_id": product_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/manager/products/{product_id}")
async def update_product(product_id: str, request: Request, uid: str):
    """Update product (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        
        update_data = {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": uid
        }
        
        if "name" in data:
            update_data["name"] = data["name"]
        if "description" in data:
            update_data["description"] = data["description"]
        if "category" in data:
            update_data["category"] = data["category"]
        if "price" in data:
            update_data["price"] = float(data["price"])
        if "prc_cost" in data:
            update_data["prc_cost"] = float(data["prc_cost"])
        if "stock" in data:
            update_data["stock"] = int(data["stock"])
        if "image_url" in data:
            update_data["image_url"] = data["image_url"]
        if "active" in data:
            update_data["active"] = data["active"]
        
        result = await db.products.update_one(
            {"product_id": product_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "product_update",
            "target_product_id": product_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"updates": list(update_data.keys())}
        })
        
        return {"message": "Product updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/manager/stock-movements")
async def get_stock_movements(
    uid: str,
    product_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get stock movement history (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        query = {}
        if product_id:
            query["product_id"] = product_id
        
        total = await db.stock_movements.count_documents(query)
        movements = await db.stock_movements.find(query).skip(skip).limit(limit).sort("timestamp", -1).to_list(length=limit)
        
        for movement in movements:
            movement.pop("_id", None)
        
        return {
            "movements": movements,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== PHASE 2: FINANCIAL MANAGEMENT ==========

@api_router.get("/manager/withdrawals")
async def get_manager_withdrawals(
    uid: str,
    status: Optional[str] = None,
    wallet_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get withdrawal requests (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Query both cashback and profit withdrawals
        cashback_query = {}
        profit_query = {}
        
        if status:
            cashback_query["status"] = status
            profit_query["status"] = status
        
        cashback_withdrawals = []
        profit_withdrawals = []
        
        if not wallet_type or wallet_type == "cashback":
            cashback_withdrawals = await db.cashback_withdrawals.find(cashback_query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
            for w in cashback_withdrawals:
                w.pop("_id", None)
                w["wallet_type"] = "cashback"
                # Get user info
                user = await db.users.find_one({"uid": w.get("user_id")})
                if user:
                    w["user_name"] = user.get("name")
                    w["user_email"] = user.get("email")
        
        if not wallet_type or wallet_type == "profit":
            profit_withdrawals = await db.profit_withdrawals.find(profit_query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
            for w in profit_withdrawals:
                w.pop("_id", None)
                w["wallet_type"] = "profit"
                # Get user info
                user = await db.users.find_one({"uid": w.get("user_id")})
                if user:
                    w["user_name"] = user.get("name")
                    w["user_email"] = user.get("email")
        
        all_withdrawals = cashback_withdrawals + profit_withdrawals
        all_withdrawals.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {
            "withdrawals": all_withdrawals[:limit],
            "total": len(all_withdrawals)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/manager/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(withdrawal_id: str, request: Request, uid: str):
    """Approve withdrawal request (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        wallet_type = data.get("wallet_type", "cashback")
        transaction_id = data.get("transaction_id", "")
        notes = data.get("notes", "")
        
        collection = db.cashback_withdrawals if wallet_type == "cashback" else db.profit_withdrawals
        
        withdrawal = await collection.find_one({"withdrawal_id": withdrawal_id})
        if not withdrawal:
            raise HTTPException(status_code=404, detail="Withdrawal not found")
        
        if withdrawal.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Withdrawal is not pending")
        
        # Update withdrawal status
        await collection.update_one(
            {"withdrawal_id": withdrawal_id},
            {"$set": {
                "status": "approved",
                "approved_by": uid,
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "transaction_id": transaction_id,
                "admin_notes": notes
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "withdrawal_approve",
            "target_withdrawal_id": withdrawal_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {
                "wallet_type": wallet_type,
                "amount": withdrawal.get("amount"),
                "user_id": withdrawal.get("user_id")
            }
        })
        
        return {"message": "Withdrawal approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/manager/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(withdrawal_id: str, request: Request, uid: str):
    """Reject withdrawal request (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        wallet_type = data.get("wallet_type", "cashback")
        reason = data.get("reason", "")
        
        collection = db.cashback_withdrawals if wallet_type == "cashback" else db.profit_withdrawals
        
        withdrawal = await collection.find_one({"withdrawal_id": withdrawal_id})
        if not withdrawal:
            raise HTTPException(status_code=404, detail="Withdrawal not found")
        
        if withdrawal.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Withdrawal is not pending")
        
        # Update withdrawal status
        await collection.update_one(
            {"withdrawal_id": withdrawal_id},
            {"$set": {
                "status": "rejected",
                "rejected_by": uid,
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "rejection_reason": reason
            }}
        )
        
        # Refund amount back to user's wallet
        user_id = withdrawal.get("user_id")
        amount = withdrawal.get("amount", 0)
        
        if wallet_type == "cashback":
            await db.users.update_one(
                {"uid": user_id},
                {"$inc": {"cashback_wallet": amount}}
            )
        else:
            await db.users.update_one(
                {"uid": user_id},
                {"$inc": {"profit_wallet": amount}}
            )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "withdrawal_reject",
            "target_withdrawal_id": withdrawal_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {
                "wallet_type": wallet_type,
                "amount": amount,
                "user_id": user_id,
                "reason": reason
            }
        })
        
        return {"message": "Withdrawal rejected and amount refunded"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/manager/transactions")
async def get_manager_transactions(
    uid: str,
    transaction_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """Get transaction history (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        query = {}
        if transaction_type:
            query["transaction_type"] = transaction_type
        
        total = await db.transactions.count_documents(query)
        transactions = await db.transactions.find(query).skip(skip).limit(limit).sort("timestamp", -1).to_list(length=limit)
        
        for txn in transactions:
            txn.pop("_id", None)
            # Get user info
            user = await db.users.find_one({"uid": txn.get("user_id")})
            if user:
                txn["user_name"] = user.get("name")
        
        return {
            "transactions": transactions,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== PHASE 2: COMMUNICATION TOOLS ==========

@api_router.post("/manager/announcements")
async def create_announcement(request: Request, uid: str):
    """Create announcement for users (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        
        announcement_id = str(uuid.uuid4())
        announcement = {
            "announcement_id": announcement_id,
            "title": data.get("title"),
            "message": data.get("message"),
            "target_audience": data.get("target_audience", "all"),  # all, vip, free, stockists
            "priority": data.get("priority", "normal"),  # low, normal, high
            "created_by": uid,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": data.get("expires_at"),
            "active": True
        }
        
        await db.announcements.insert_one(announcement)
        
        # Create notifications for targeted users
        query = {"role": "user"}
        if data.get("target_audience") == "vip":
            query["membership_type"] = "vip"
        elif data.get("target_audience") == "free":
            query["$or"] = [{"membership_type": "free"}, {"membership_type": {"$exists": False}}]
        elif data.get("target_audience") == "stockists":
            query["role"] = {"$in": ["master_stockist", "sub_stockist", "outlet"]}
        
        target_users = await db.users.find(query).to_list(length=None)
        
        notifications = []
        for user in target_users:
            notifications.append({
                "notification_id": str(uuid.uuid4()),
                "user_id": user.get("uid"),
                "title": data.get("title"),
                "message": data.get("message"),
                "type": "announcement",
                "priority": data.get("priority", "normal"),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        if notifications:
            await db.notifications.insert_many(notifications)
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "announcement_create",
            "target_announcement_id": announcement_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {
                "title": data.get("title"),
                "target_audience": data.get("target_audience"),
                "recipients_count": len(notifications)
            }
        })
        
        return {
            "message": "Announcement created successfully",
            "announcement_id": announcement_id,
            "recipients": len(notifications)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/manager/announcements")
async def get_announcements(uid: str, skip: int = 0, limit: int = 50):
    """Get all announcements (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        total = await db.announcements.count_documents({})
        announcements = await db.announcements.find().skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        for announcement in announcements:
            announcement.pop("_id", None)
        
        return {
            "announcements": announcements,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== PHASE 3: SUPPORT TICKETS ==========

@api_router.get("/manager/tickets")
async def get_manager_tickets(
    uid: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get support tickets (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        query = {}
        if status:
            query["status"] = status
        if priority:
            query["priority"] = priority
        
        total = await db.support_tickets.count_documents(query)
        tickets = await db.support_tickets.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        for ticket in tickets:
            ticket.pop("_id", None)
            # Get user info
            user = await db.users.find_one({"uid": ticket.get("user_id")})
            if user:
                ticket["user_name"] = user.get("name")
                ticket["user_email"] = user.get("email")
        
        return {
            "tickets": tickets,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/manager/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, request: Request, uid: str):
    """Update support ticket (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        
        update_data = {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": uid
        }
        
        if "status" in data:
            update_data["status"] = data["status"]
            if data["status"] == "resolved":
                update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
                update_data["resolved_by"] = uid
        
        if "priority" in data:
            update_data["priority"] = data["priority"]
        
        if "response" in data:
            update_data["response"] = data["response"]
            update_data["responded_at"] = datetime.now(timezone.utc).isoformat()
            update_data["responded_by"] = uid
        
        if "assigned_to" in data:
            update_data["assigned_to"] = data["assigned_to"]
        
        result = await db.support_tickets.update_one(
            {"ticket_id": ticket_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "ticket_update",
            "target_ticket_id": ticket_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"updates": list(update_data.keys())}
        })
        
        return {"message": "Ticket updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== PHASE 3: STOCKIST MANAGEMENT ==========

@api_router.get("/manager/stockists")
async def get_manager_stockists(
    uid: str,
    role: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get stockists list (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        query = {"role": {"$in": ["master_stockist", "sub_stockist", "outlet"]}}
        
        if role:
            query["role"] = role
        
        total = await db.users.count_documents(query)
        stockists = await db.users.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        for stockist in stockists:
            stockist.pop("_id", None)
            stockist.pop("password", None)
            
            # Get performance metrics
            orders_count = await db.orders.count_documents({"assigned_stockist": stockist.get("uid")})
            delivered_count = await db.orders.count_documents({
                "assigned_stockist": stockist.get("uid"),
                "status": "delivered"
            })
            
            stockist["orders_count"] = orders_count
            stockist["delivered_count"] = delivered_count
            stockist["fulfillment_rate"] = round((delivered_count / orders_count * 100) if orders_count > 0 else 0, 2)
        
        return {
            "stockists": stockists,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== VIP MEMBERSHIP APPROVAL ==========

@api_router.get("/manager/vip-requests")
async def get_vip_requests(
    uid: str,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get VIP membership payment requests (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        total = await db.vip_payments.count_documents(query)
        payments = await db.vip_payments.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        for payment in payments:
            payment.pop("_id", None)
            # Get user info
            user = await db.users.find_one({"uid": payment.get("user_id")})
            if user:
                payment["user_name"] = user.get("name")
                payment["user_email"] = user.get("email")
                payment["current_membership"] = user.get("membership_type", "free")
        
        return {
            "payments": payments,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/manager/vip-requests/{payment_id}/approve")
async def approve_vip_payment(payment_id: str, uid: str):
    """Approve VIP membership payment (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        payment = await db.vip_payments.find_one({"payment_id": payment_id})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Payment is not pending")
        
        user_id = payment.get("user_id")
        
        # Update payment status
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "approved",
                "approved_by": uid,
                "approved_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update user to VIP
        expiry_date = datetime.now(timezone.utc) + timedelta(days=365)
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "membership_type": "vip",
                "vip_activated_at": datetime.now(timezone.utc).isoformat(),
                "vip_expires_at": expiry_date.isoformat()
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "vip_approve",
            "target_payment_id": payment_id,
            "target_user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"amount": payment.get("amount")}
        })
        
        return {"message": "VIP membership approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/manager/vip-requests/{payment_id}/reject")
async def reject_vip_payment(payment_id: str, request: Request, uid: str):
    """Reject VIP membership payment (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        reason = data.get("reason", "")
        
        payment = await db.vip_payments.find_one({"payment_id": payment_id})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Payment is not pending")
        
        # Update payment status
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "rejected",
                "rejected_by": uid,
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "rejection_reason": reason
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "vip_reject",
            "target_payment_id": payment_id,
            "target_user_id": payment.get("user_id"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"reason": reason}
        })
        
        return {"message": "VIP payment rejected", "reason": reason}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== END MANAGER DASHBOARD ENDPOINTS ==========

# ========== ADMIN SETTINGS ENDPOINTS ==========

class SocialMediaSettings(BaseModel):
    """Social Media Settings Model"""
    facebook: Optional[str] = ""
    twitter: Optional[str] = ""
    instagram: Optional[str] = ""
    linkedin: Optional[str] = ""
    youtube: Optional[str] = ""
    telegram: Optional[str] = ""
    whatsapp: Optional[str] = ""

@api_router.get("/admin/social-media-settings")
async def get_social_media_settings():
    """Get social media settings"""
    try:
        settings = await db.settings.find_one({"type": "social_media"})
        if not settings:
            # Return default empty settings
            return {
                "facebook": "",
                "twitter": "",
                "instagram": "",
                "linkedin": "",
                "youtube": "",
                "telegram": "",
                "whatsapp": ""
            }
        return {
            "facebook": settings.get("facebook", ""),
            "twitter": settings.get("twitter", ""),
            "instagram": settings.get("instagram", ""),
            "linkedin": settings.get("linkedin", ""),
            "youtube": settings.get("youtube", ""),
            "telegram": settings.get("telegram", ""),
            "whatsapp": settings.get("whatsapp", "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/social-media-settings")
async def update_social_media_settings(settings: SocialMediaSettings):
    """Update social media settings (Admin only)"""
    try:
        # Upsert settings
        await db.settings.update_one(
            {"type": "social_media"},
            {
                "$set": {
                    "type": "social_media",
                    "facebook": settings.facebook,
                    "twitter": settings.twitter,
                    "instagram": settings.instagram,
                    "linkedin": settings.linkedin,
                    "youtube": settings.youtube,
                    "telegram": settings.telegram,
                    "whatsapp": settings.whatsapp,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        return {
            "message": "Social media settings updated successfully",
            "settings": settings.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== END ADMIN SETTINGS ENDPOINTS ==========

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


# ========== REFERRAL PROGRAM ==========

@api_router.get("/referrals/{user_id}/tree")
async def get_referral_tree(user_id: str):
    """Get referral tree structure for visualization"""
    
    async def build_tree(uid, level=1, max_level=5):
        if level > max_level:
            return None
        
        # Get user info
        user = await db.users.find_one({"uid": uid})
        if not user:
            return None
        
        # Get direct referrals
        referrals = await db.users.find({"referred_by": uid}).to_list(length=None)
        
        node = {
            "id": uid,
            "name": user.get("name", "Unknown"),
            "email": user.get("email", ""),
            "level": level,
            "total_referrals": len(referrals),
            "prc_balance": user.get("prc_balance", 0),
            "membership_type": user.get("membership_type", "free"),
            "children": []
        }
        
        # Recursively build children (limit depth to avoid huge trees)
        for referral in referrals[:10]:  # Limit to 10 per level for performance
            child_tree = await build_tree(referral["uid"], level + 1, max_level)
            if child_tree:
                node["children"].append(child_tree)
        
        return node
    
    tree = await build_tree(user_id)
    return {"tree": tree}

@api_router.get("/referrals/{user_id}/stats")
async def get_referral_stats(user_id: str):
    """Get comprehensive referral statistics"""
    
    # Get direct referrals
    direct_referrals = await db.users.find({"referred_by": user_id}).to_list(length=None)
    
    # Count active referrals (users with orders)
    active_count = 0
    total_orders_from_referrals = 0
    
    for referral in direct_referrals:
        orders = await db.orders.count_documents({"user_id": referral["uid"]})
        if orders > 0:
            active_count += 1
            total_orders_from_referrals += orders
    
    # Get referral earnings from transactions
    referral_earnings = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "type": "referral"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    total_earned = referral_earnings[0]["total"] if referral_earnings else 0
    
    # Calculate conversion rate
    conversion_rate = (active_count / len(direct_referrals) * 100) if direct_referrals else 0
    
    # Get recent referrals (last 10)
    recent_referrals = sorted(direct_referrals, key=lambda x: x.get("created_at", ""), reverse=True)[:10]
    
    return {
        "total_referrals": len(direct_referrals),
        "active_referrals": active_count,
        "conversion_rate": round(conversion_rate, 2),
        "total_earned": round(total_earned, 2),
        "total_orders_from_referrals": total_orders_from_referrals,
        "recent_referrals": [
            {
                "uid": r["uid"],
                "name": r.get("name", "Unknown"),
                "email": r.get("email", ""),
                "joined_at": r.get("created_at", ""),
                "membership_type": r.get("membership_type", "free")
            }
            for r in recent_referrals
        ]
    }

@api_router.get("/referrals/{user_id}/earnings")
async def get_referral_earnings(user_id: str):
    """Get detailed referral earnings breakdown"""
    
    # Get all referral transactions
    transactions = await db.transactions.find({
        "user_id": user_id,
        "type": "referral"
    }).sort("created_at", -1).to_list(length=100)
    
    # Calculate by month
    from collections import defaultdict
    monthly_earnings = defaultdict(float)
    
    for txn in transactions:
        if txn.get("created_at"):
            try:
                month = txn["created_at"][:7]  # YYYY-MM
                monthly_earnings[month] += txn.get("amount", 0)
            except:
                pass
    
    # Total earnings
    total = sum(txn.get("amount", 0) for txn in transactions)
    
    # Pending earnings (from users who haven't made orders yet)
    direct_referrals = await db.users.find({"referred_by": user_id}).to_list(length=None)
    potential_earnings = len([r for r in direct_referrals if await db.orders.count_documents({"user_id": r["uid"]}) == 0]) * 10  # Assume 10 PRC potential per referral
    
    return {
        "total_earned": round(total, 2),
        "transaction_count": len(transactions),
        "monthly_breakdown": dict(sorted(monthly_earnings.items())),
        "potential_earnings": potential_earnings,
        "recent_transactions": [
            {
                "amount": t.get("amount", 0),
                "description": t.get("description", ""),
                "created_at": t.get("created_at", "")
            }
            for t in transactions[:20]
        ]
    }


# ========== NOTIFICATION SYSTEM ==========
async def create_notification(
    user_id: str,
    title: str,
    message: str,
    notification_type: str,
    related_id: Optional[str] = None,
    icon: Optional[str] = None
):
    """Helper function to create notifications"""
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "related_id": related_id,
        "icon": icon or "🔔",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification


# ========== GAMIFICATION SYSTEM ==========

# Achievement definitions
ACHIEVEMENTS = {
    "first_order": {
        "id": "first_order",
        "name": "First Step",
        "description": "Place your first order",
        "icon": "🛒",
        "reward_prc": 50,
        "condition": lambda user_data: user_data["total_orders"] >= 1
    },
    "prc_100": {
        "id": "prc_100",
        "name": "Miner Apprentice",
        "description": "Mine 100 PRC",
        "icon": "⛏️",
        "reward_prc": 20,
        "condition": lambda user_data: user_data["total_mined"] >= 100
    },
    "prc_500": {
        "id": "prc_500",
        "name": "Miner Expert",
        "description": "Mine 500 PRC",
        "icon": "💎",
        "reward_prc": 100,
        "condition": lambda user_data: user_data["total_mined"] >= 500
    },
    "prc_1000": {
        "id": "prc_1000",
        "name": "Mining Master",
        "description": "Mine 1000 PRC",
        "icon": "👑",
        "reward_prc": 200,
        "condition": lambda user_data: user_data["total_mined"] >= 1000
    },
    "referrals_10": {
        "id": "referrals_10",
        "name": "Social Butterfly",
        "description": "Refer 10 friends",
        "icon": "🦋",
        "reward_prc": 100,
        "condition": lambda user_data: user_data["total_referrals"] >= 10
    },
    "referrals_50": {
        "id": "referrals_50",
        "name": "Influencer",
        "description": "Refer 50 friends",
        "icon": "📢",
        "reward_prc": 500,
        "condition": lambda user_data: user_data["total_referrals"] >= 50
    },
    "referrals_100": {
        "id": "referrals_100",
        "name": "Network Legend",
        "description": "Refer 100 friends",
        "icon": "🌟",
        "reward_prc": 1000,
        "condition": lambda user_data: user_data["total_referrals"] >= 100
    },
    "vip_member": {
        "id": "vip_member",
        "name": "VIP Elite",
        "description": "Become a VIP member",
        "icon": "💎",
        "reward_prc": 50,
        "condition": lambda user_data: user_data["is_vip"]
    },
    "kyc_verified": {
        "id": "kyc_verified",
        "name": "Verified User",
        "description": "Complete KYC verification",
        "icon": "✅",
        "reward_prc": 30,
        "condition": lambda user_data: user_data["kyc_verified"]
    },
    "streak_7": {
        "id": "streak_7",
        "name": "Consistent",
        "description": "7-day login streak",
        "icon": "🔥",
        "reward_prc": 50,
        "condition": lambda user_data: user_data["current_streak"] >= 7
    },
    "streak_30": {
        "id": "streak_30",
        "name": "Dedicated",
        "description": "30-day login streak",
        "icon": "💪",
        "reward_prc": 200,
        "condition": lambda user_data: user_data["current_streak"] >= 30
    }
}

async def check_and_award_achievements(user_id: str):
    """Check and award new achievements to user"""
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return []
    
    # Get user's existing achievements
    user_achievements = await db.user_achievements.find({"user_id": user_id}).to_list(None)
    unlocked_ids = [a["achievement_id"] for a in user_achievements]
    
    # Gather user data for condition checks
    total_orders = await db.orders.count_documents({"user_id": user_id})
    total_referrals = await db.users.count_documents({"referred_by": user_id})
    
    # Calculate total mined (from transactions)
    mining_txns = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "type": {"$in": ["mining", "tap_game"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    total_mined = mining_txns[0]["total"] if mining_txns else 0
    
    # Get current streak
    streak_data = await db.user_streaks.find_one({"user_id": user_id})
    current_streak = streak_data.get("current_streak", 0) if streak_data else 0
    
    user_data = {
        "total_orders": total_orders,
        "total_mined": total_mined,
        "total_referrals": total_referrals,
        "is_vip": user.get("membership_type") == "vip",
        "kyc_verified": user.get("kyc_verified", False),
        "current_streak": current_streak
    }
    
    # Check each achievement
    newly_unlocked = []
    for achievement_id, achievement in ACHIEVEMENTS.items():
        if achievement_id not in unlocked_ids:
            if achievement["condition"](user_data):
                # Award achievement
                achievement_record = {
                    "user_id": user_id,
                    "achievement_id": achievement_id,
                    "unlocked_at": datetime.now(timezone.utc).isoformat()
                }
                await db.user_achievements.insert_one(achievement_record)
                
                # Award PRC reward
                reward_prc = achievement["reward_prc"]
                await db.users.update_one(
                    {"uid": user_id},
                    {"$inc": {"prc_balance": reward_prc}}
                )
                
                # Create transaction
                await db.transactions.insert_one({
                    "transaction_id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "type": "achievement",
                    "wallet_type": "prc",
                    "amount": reward_prc,
                    "description": f"Achievement unlocked: {achievement['name']}",
                    "balance_after": user.get("prc_balance", 0) + reward_prc,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                # Create notification
                await create_notification(
                    user_id=user_id,
                    title=f"Achievement Unlocked! {achievement['icon']}",
                    message=f"You've earned '{achievement['name']}' and received {reward_prc} PRC!",
                    notification_type="achievement",
                    related_id=achievement_id,
                    icon=achievement['icon']
                )
                
                newly_unlocked.append(achievement)
    
    return newly_unlocked

@api_router.get("/achievements/{user_id}")
async def get_user_achievements(user_id: str):
    """Get user's unlocked achievements and progress"""
    user_achievements = await db.user_achievements.find({"user_id": user_id}).to_list(None)
    unlocked_ids = [a["achievement_id"] for a in user_achievements]
    
    # Build response with all achievements
    achievements_list = []
    for achievement_id, achievement in ACHIEVEMENTS.items():
        is_unlocked = achievement_id in unlocked_ids
        unlocked_at = None
        
        if is_unlocked:
            record = next((a for a in user_achievements if a["achievement_id"] == achievement_id), None)
            unlocked_at = record.get("unlocked_at") if record else None
        
        achievements_list.append({
            "id": achievement["id"],
            "name": achievement["name"],
            "description": achievement["description"],
            "icon": achievement["icon"],
            "reward_prc": achievement["reward_prc"],
            "unlocked": is_unlocked,
            "unlocked_at": unlocked_at
        })
    
    return {
        "achievements": achievements_list,
        "total_unlocked": len(unlocked_ids),
        "total_available": len(ACHIEVEMENTS)
    }

@api_router.post("/achievements/{user_id}/check")
async def check_achievements(user_id: str):
    """Manually trigger achievement check"""
    newly_unlocked = await check_and_award_achievements(user_id)
    return {
        "newly_unlocked": newly_unlocked,
        "count": len(newly_unlocked)
    }

# Daily Login Streaks
@api_router.post("/streaks/{user_id}/checkin")
async def daily_checkin(user_id: str):
    """Record daily login and update streak"""
    today = datetime.now(timezone.utc).date().isoformat()
    
    streak_data = await db.user_streaks.find_one({"user_id": user_id})
    
    if not streak_data:
        # First time login
        streak_data = {
            "user_id": user_id,
            "current_streak": 1,
            "longest_streak": 1,
            "last_checkin": today,
            "total_checkins": 1,
            "checkin_dates": [today]
        }
        await db.user_streaks.insert_one(streak_data)
        
        # Award 5 PRC for first login
        await db.users.update_one({"uid": user_id}, {"$inc": {"prc_balance": 5}})
        
        return {
            "current_streak": 1,
            "reward_prc": 5,
            "message": "Welcome! First login bonus!"
        }
    
    last_checkin = streak_data.get("last_checkin")
    
    # Check if already checked in today
    if last_checkin == today:
        return {
            "current_streak": streak_data["current_streak"],
            "reward_prc": 0,
            "message": "Already checked in today!",
            "already_checked_in": True
        }
    
    # Check if consecutive day
    from datetime import timedelta
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    
    if last_checkin == yesterday:
        # Consecutive day
        new_streak = streak_data["current_streak"] + 1
    else:
        # Streak broken
        new_streak = 1
    
    # Calculate reward (increases with streak)
    base_reward = 5
    streak_bonus = min(new_streak - 1, 10)  # Max 10 bonus
    reward_prc = base_reward + streak_bonus
    
    # Update streak
    await db.user_streaks.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "current_streak": new_streak,
                "longest_streak": max(new_streak, streak_data.get("longest_streak", 0)),
                "last_checkin": today
            },
            "$inc": {"total_checkins": 1},
            "$push": {"checkin_dates": today}
        }
    )
    
    # Award PRC
    await db.users.update_one({"uid": user_id}, {"$inc": {"prc_balance": reward_prc}})
    
    # Create transaction
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "daily_streak",
        "wallet_type": "prc",
        "amount": reward_prc,
        "description": f"Daily login streak: Day {new_streak}",
        "balance_after": 0,  # Will be updated
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Check for streak achievements
    await check_and_award_achievements(user_id)
    
    return {
        "current_streak": new_streak,
        "reward_prc": reward_prc,
        "message": f"Day {new_streak} streak! Keep it up!",
        "milestone_reached": new_streak in [7, 30, 100]
    }

@api_router.get("/streaks/{user_id}")
async def get_user_streak(user_id: str):
    """Get user's streak information"""
    streak_data = await db.user_streaks.find_one({"user_id": user_id})
    
    if not streak_data:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "total_checkins": 0,
            "last_checkin": None,
            "checkin_dates": []
        }
    
    streak_data.pop("_id", None)
    return streak_data

# Leaderboard
@api_router.get("/leaderboard/miners")
async def get_top_miners(period: str = "all_time", limit: int = 100):
    """Get top miners leaderboard"""
    
    # Calculate time filter
    time_filter = {}
    if period == "weekly":
        from datetime import timedelta
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        time_filter = {"created_at": {"$gte": week_ago}}
    elif period == "monthly":
        from datetime import timedelta
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        time_filter = {"created_at": {"$gte": month_ago}}
    
    # Aggregate mining totals
    pipeline = [
        {"$match": {**{"type": {"$in": ["mining", "tap_game"]}}, **time_filter}},
        {"$group": {
            "_id": "$user_id",
            "total_mined": {"$sum": "$amount"}
        }},
        {"$sort": {"total_mined": -1}},
        {"$limit": limit}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(limit)
    
    # Get user details
    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = await db.users.find_one({"uid": result["_id"]})
        if user:
            leaderboard.append({
                "rank": idx,
                "user_id": result["_id"],
                "name": user.get("name", "Unknown"),
                "total_mined": round(result["total_mined"], 2),
                "membership_type": user.get("membership_type", "free")
            })
    
    return {"leaderboard": leaderboard, "period": period}

@api_router.get("/leaderboard/referrers")
async def get_top_referrers(limit: int = 100):
    """Get top referrers leaderboard"""
    
    # Aggregate referral counts
    pipeline = [
        {"$match": {"referred_by": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$referred_by",
            "total_referrals": {"$sum": 1}
        }},
        {"$sort": {"total_referrals": -1}},
        {"$limit": limit}
    ]
    
    results = await db.users.aggregate(pipeline).to_list(limit)
    
    # Get user details
    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = await db.users.find_one({"uid": result["_id"]})
        if user:
            leaderboard.append({
                "rank": idx,
                "user_id": result["_id"],
                "name": user.get("name", "Unknown"),
                "total_referrals": result["total_referrals"],
                "membership_type": user.get("membership_type", "free")
            })
    
    return {"leaderboard": leaderboard}

@api_router.get("/leaderboard/earners")
async def get_top_earners(limit: int = 100):
    """Get top earners leaderboard by cashback balance"""
    
    users = await db.users.find({}).sort("cashback_balance", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for idx, user in enumerate(users, 1):
        leaderboard.append({
            "rank": idx,
            "user_id": user["uid"],
            "name": user.get("name", "Unknown"),
            "cashback_balance": round(user.get("cashback_balance", 0), 2),
            "membership_type": user.get("membership_type", "free")
        })
    
    return {"leaderboard": leaderboard}


# ========== FLASH SALES ==========

@api_router.post("/admin/flash-sales")
async def create_flash_sale(sale_data: dict):
    """Create a new flash sale (Admin)"""
    flash_sale = {
        "sale_id": str(uuid.uuid4()),
        "product_id": sale_data["product_id"],
        "discount_percentage": sale_data["discount_percentage"],
        "discounted_prc_price": sale_data.get("discounted_prc_price"),
        "start_time": sale_data["start_time"],
        "end_time": sale_data["end_time"],
        "stock_limit": sale_data.get("stock_limit"),
        "sold_count": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.flash_sales.insert_one(flash_sale)
    flash_sale.pop("_id", None)
    
    return {"message": "Flash sale created", "sale": flash_sale}

@api_router.get("/flash-sales/active")
async def get_active_flash_sales():
    """Get all active flash sales"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Find active sales within time range
    flash_sales = await db.flash_sales.find({
        "is_active": True,
        "start_time": {"$lte": now},
        "end_time": {"$gte": now}
    }).to_list(100)
    
    # Enrich with product details
    enriched_sales = []
    for sale in flash_sales:
        product = await db.products.find_one({"product_id": sale["product_id"]})
        if product:
            # Calculate if still in stock
            remaining_stock = None
            if sale.get("stock_limit"):
                remaining_stock = sale["stock_limit"] - sale.get("sold_count", 0)
                if remaining_stock <= 0:
                    continue  # Skip out of stock
            
            enriched_sales.append({
                "sale_id": sale["sale_id"],
                "product_id": sale["product_id"],
                "product_name": product.get("name"),
                "product_image": product.get("image_url"),
                "original_prc_price": product.get("prc_price"),
                "discounted_prc_price": sale.get("discounted_prc_price"),
                "discount_percentage": sale.get("discount_percentage"),
                "start_time": sale["start_time"],
                "end_time": sale["end_time"],
                "remaining_stock": remaining_stock,
                "sold_count": sale.get("sold_count", 0)
            })
    
    return {"flash_sales": enriched_sales}

@api_router.get("/admin/flash-sales")
async def get_all_flash_sales(status: str = "all"):
    """Get all flash sales (Admin)"""
    query = {}
    
    if status == "active":
        now = datetime.now(timezone.utc).isoformat()
        query = {
            "is_active": True,
            "start_time": {"$lte": now},
            "end_time": {"$gte": now}
        }
    elif status == "expired":
        now = datetime.now(timezone.utc).isoformat()
        query = {"end_time": {"$lt": now}}
    elif status == "upcoming":
        now = datetime.now(timezone.utc).isoformat()
        query = {"start_time": {"$gt": now}}
    
    flash_sales = await db.flash_sales.find(query).sort("created_at", -1).to_list(100)
    
    # Enrich with product details
    for sale in flash_sales:
        product = await db.products.find_one({"product_id": sale["product_id"]})
        if product:
            sale["product_name"] = product.get("name")
            sale["product_image"] = product.get("image_url")
        sale.pop("_id", None)
    
    return {"flash_sales": flash_sales}

@api_router.put("/admin/flash-sales/{sale_id}")
async def update_flash_sale(sale_id: str, update_data: dict):
    """Update a flash sale (Admin)"""
    result = await db.flash_sales.update_one(
        {"sale_id": sale_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    
    return {"message": "Flash sale updated"}

@api_router.delete("/admin/flash-sales/{sale_id}")
async def delete_flash_sale(sale_id: str):
    """Delete a flash sale (Admin)"""
    result = await db.flash_sales.delete_one({"sale_id": sale_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    
    return {"message": "Flash sale deleted"}

@api_router.post("/flash-sales/{sale_id}/purchase")
async def purchase_flash_sale(sale_id: str, user_id: str, quantity: int = 1):
    """Purchase item from flash sale"""
    # Get flash sale
    sale = await db.flash_sales.find_one({"sale_id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    
    # Check if still active
    now = datetime.now(timezone.utc).isoformat()
    if now < sale["start_time"] or now > sale["end_time"]:
        raise HTTPException(status_code=400, detail="Flash sale is not active")
    
    # Check stock limit
    if sale.get("stock_limit"):
        remaining = sale["stock_limit"] - sale.get("sold_count", 0)
        if remaining < quantity:
            raise HTTPException(status_code=400, detail="Not enough stock available")
    
    # Increment sold count
    await db.flash_sales.update_one(
        {"sale_id": sale_id},
        {"$inc": {"sold_count": quantity}}
    )
    
    return {
        "message": "Purchase recorded",
        "sale_id": sale_id,
        "quantity": quantity
    }


@api_router.get("/notifications/{user_id}")
async def get_user_notifications(user_id: str, limit: int = 50, unread_only: bool = False):
    """Get user notifications with optional filtering"""
    query = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Remove MongoDB _id
    for notif in notifications:
        notif.pop("_id", None)
    
    return {
        "notifications": notifications,
        "count": len(notifications)
    }

@api_router.get("/notifications/{user_id}/count")
async def get_unread_count(user_id: str):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({"user_id": user_id, "is_read": False})
    return {"unread_count": count}

@api_router.post("/notifications/{notification_id}/mark-read")
async def mark_notification_read(notification_id: str):
    """Mark a single notification as read"""
    result = await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/{user_id}/mark-all-read")
async def mark_all_notifications_read(user_id: str):
    """Mark all user notifications as read"""
    result = await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {
        "message": "All notifications marked as read",
        "count": result.modified_count
    }

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str):
    """Delete a notification"""
    result = await db.notifications.delete_one({"notification_id": notification_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}


# ========== ACTIVITY LOGS ROUTES ==========

@api_router.get("/activity-logs")
async def get_all_activity_logs(
    user_id: Optional[str] = None,
    action_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """
    Get all activity logs (Admin only)
    Supports filtering by user_id, action_type, and date range
    """
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    
    if action_type:
        query["action_type"] = action_type
    
    # Date range filter
    if start_date or end_date:
        query["created_at"] = {}
        if start_date:
            query["created_at"]["$gte"] = start_date
        if end_date:
            query["created_at"]["$lte"] = end_date
    
    # Get total count
    total = await db.activity_logs.count_documents(query)
    
    # Get paginated logs
    skip = (page - 1) * limit
    logs = await db.activity_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Remove _id field
    for log in logs:
        log.pop("_id", None)
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit
    }

@api_router.get("/activity-logs/user/{uid}")
async def get_user_activity_logs(
    uid: str,
    action_type: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """
    Get activity logs for a specific user
    Users can only see their own logs
    """
    query = {"user_id": uid}
    
    if action_type:
        query["action_type"] = action_type
    
    # Get total count
    total = await db.activity_logs.count_documents(query)
    
    # Get paginated logs
    skip = (page - 1) * limit
    logs = await db.activity_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Remove _id field
    for log in logs:
        log.pop("_id", None)
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit
    }

@api_router.get("/activity-logs/stats")
async def get_activity_stats():
    """Get activity statistics (Admin only)"""
    try:
        # Get total logs
        total_logs = await db.activity_logs.count_documents({})
        
        # Get logs by action type
        pipeline = [
            {"$group": {"_id": "$action_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        action_stats = await db.activity_logs.aggregate(pipeline).to_list(length=None)
        
        # Get recent activity count (last 24 hours)
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        recent_count = await db.activity_logs.count_documents({
            "created_at": {"$gte": yesterday}
        })
        
        # Get most active users (top 10)
        user_pipeline = [
            {"$group": {"_id": "$user_id", "user_name": {"$first": "$user_name"}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        active_users = await db.activity_logs.aggregate(user_pipeline).to_list(length=10)
        
        return {
            "total_logs": total_logs,
            "recent_logs_24h": recent_count,
            "action_type_stats": action_stats,
            "most_active_users": active_users
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ========================================
# TREASURE HUNT GAME SYSTEM
# ========================================

class TreasureHuntModel(BaseModel):
    hunt_id: str
    title: str
    description: str
    difficulty: str  # easy, medium, hard
    prc_cost: int
    reward_prc: int
    cashback_percentage: int = 50
    total_clues: int
    clue_cost: int = 5
    treasure_locations: List[Dict]
    time_limit_minutes: int
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserTreasureProgress(BaseModel):
    progress_id: str
    user_id: str
    hunt_id: str
    started_at: str
    clues_revealed: List[int] = []
    attempts: int = 0
    found: bool = False
    found_at: Optional[str] = None
    prc_spent: int = 0
    cashback_earned: int = 0
    completed: bool = False

class StartHuntRequest(BaseModel):
    hunt_id: str

class BuyClueRequest(BaseModel):
    progress_id: str
    clue_number: int

class FindTreasureRequest(BaseModel):
    progress_id: str
    location_id: int

# Initialize default treasure hunts
async def initialize_treasure_hunts():
    """Create default treasure hunts if they don't exist"""
    existing = await db.treasure_hunts.find_one({"hunt_id": "hunt_001"})
    if existing:
        return
    
    default_hunts = [
        {
            "hunt_id": "hunt_001",
            "title": "Beginner's Fortune",
            "description": "Find the hidden treasure in the ancient garden. Perfect for new treasure hunters!",
            "difficulty": "easy",
            "prc_cost": 10,
            "reward_prc": 50,
            "cashback_percentage": 50,
            "total_clues": 3,
            "clue_cost": 5,
            "treasure_locations": [
                {"id": 1, "x": 20, "y": 30, "is_treasure": True, "message": "🎉 Congratulations! You found the treasure!"},
                {"id": 2, "x": 45, "y": 60, "is_treasure": True, "message": "🎉 Congratulations! You found the treasure!"},
                {"id": 3, "x": 70, "y": 40, "is_treasure": True, "message": "🎉 Congratulations! You found the treasure!"},
                {"id": 4, "x": 35, "y": 75, "is_treasure": False, "message": "Try another location!"},
                {"id": 5, "x": 60, "y": 20, "is_treasure": False, "message": "Not here either!"},
                {"id": 6, "x": 15, "y": 55, "is_treasure": False, "message": "Nothing here..."},
                {"id": 7, "x": 80, "y": 25, "is_treasure": False, "message": "Keep searching!"},
                {"id": 8, "x": 50, "y": 85, "is_treasure": False, "message": "Empty spot!"},
                {"id": 9, "x": 25, "y": 45, "is_treasure": False, "message": "Try again!"},
                {"id": 10, "x": 65, "y": 70, "is_treasure": False, "message": "Not the right place!"}
            ],
            "clues": [
                "The treasure lies where flowers bloom the brightest.",
                "Look near the center of the map, slightly to the right.",
                "The X and Y coordinates are both between 40 and 60."
            ],
            "time_limit_minutes": 30,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "hunt_id": "hunt_002",
            "title": "Mystic Cave Challenge",
            "description": "Venture deep into the mysterious caves. Are you brave enough?",
            "difficulty": "medium",
            "prc_cost": 25,
            "reward_prc": 120,
            "cashback_percentage": 50,
            "total_clues": 4,
            "clue_cost": 5,
            "treasure_locations": [
                {"id": 1, "x": 15, "y": 85, "is_treasure": True, "message": "💎 Amazing! You discovered the mystic gem!"},
                {"id": 2, "x": 80, "y": 65, "is_treasure": True, "message": "💎 Amazing! You discovered the mystic gem!"},
                {"id": 3, "x": 50, "y": 50, "is_treasure": True, "message": "💎 Amazing! You discovered the mystic gem!"},
                {"id": 4, "x": 30, "y": 20, "is_treasure": True, "message": "💎 Amazing! You discovered the mystic gem!"},
                {"id": 5, "x": 65, "y": 40, "is_treasure": False, "message": "Just rocks here..."},
                {"id": 6, "x": 40, "y": 70, "is_treasure": False, "message": "Nothing of value..."},
                {"id": 7, "x": 25, "y": 55, "is_treasure": False, "message": "Keep looking!"},
                {"id": 8, "x": 75, "y": 30, "is_treasure": False, "message": "Try elsewhere!"},
                {"id": 9, "x": 55, "y": 80, "is_treasure": False, "message": "Empty cave chamber..."},
                {"id": 10, "x": 20, "y": 45, "is_treasure": False, "message": "Dark corner..."},
                {"id": 11, "x": 85, "y": 50, "is_treasure": False, "message": "No treasure here!"},
                {"id": 12, "x": 45, "y": 25, "is_treasure": False, "message": "Wrong spot!"}
            ],
            "clues": [
                "The treasure is hidden in the eastern section of the cave.",
                "It's positioned high up, near the top of the map.",
                "Look for coordinates above 60 on both axes.",
                "The treasure X coordinate is greater than 75."
            ],
            "time_limit_minutes": 45,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "hunt_id": "hunt_003",
            "title": "Dragon's Lair Expedition",
            "description": "Only the bravest can find the dragon's hidden treasure hoard!",
            "difficulty": "hard",
            "prc_cost": 50,
            "reward_prc": 300,
            "cashback_percentage": 50,
            "total_clues": 5,
            "clue_cost": 5,
            "treasure_locations": [
                {"id": 1, "x": 10, "y": 10, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 2, "x": 90, "y": 90, "is_treasure": False, "message": "Wrong corner!"},
                {"id": 3, "x": 55, "y": 45, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 4, "x": 30, "y": 80, "is_treasure": False, "message": "Just dragon scales..."},
                {"id": 5, "x": 75, "y": 25, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 6, "x": 20, "y": 60, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 7, "x": 85, "y": 50, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 8, "x": 40, "y": 35, "is_treasure": False, "message": "Not quite..."},
                {"id": 9, "x": 65, "y": 70, "is_treasure": False, "message": "Try again!"},
                {"id": 10, "x": 50, "y": 15, "is_treasure": False, "message": "Almost there..."},
                {"id": 11, "x": 15, "y": 75, "is_treasure": False, "message": "The dragon isn't here..."},
                {"id": 12, "x": 80, "y": 35, "is_treasure": False, "message": "Empty chamber..."},
                {"id": 13, "x": 35, "y": 50, "is_treasure": False, "message": "Nothing but bones..."},
                {"id": 14, "x": 60, "y": 80, "is_treasure": False, "message": "Keep searching!"},
                {"id": 15, "x": 25, "y": 25, "is_treasure": False, "message": "Wrong path!"}
            ],
            "clues": [
                "The dragon guards its treasure in the heart of the lair.",
                "Look near the center, but not exactly at 50,50.",
                "Both coordinates are between 40 and 60.",
                "The Y coordinate is less than the X coordinate.",
                "The treasure is within 10 units of coordinates 55,45."
            ],
            "time_limit_minutes": 60,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.treasure_hunts.insert_many(default_hunts)

# Get all available treasure hunts
@app.get("/api/treasure-hunts")
async def get_treasure_hunts(uid: str):
    """Get all available treasure hunts"""
    try:
        hunts = await db.treasure_hunts.find({"active": True}).to_list(length=100)
        
        # Remove treasure locations and clues from response (prevent cheating)
        safe_hunts = []
        for hunt in hunts:
            safe_hunt = {
                "hunt_id": hunt["hunt_id"],
                "title": hunt["title"],
                "description": hunt["description"],
                "difficulty": hunt["difficulty"],
                "prc_cost": hunt["prc_cost"],
                "reward_prc": hunt["reward_prc"],
                "cashback_percentage": hunt.get("cashback_percentage", 25),
                "total_clues": hunt["total_clues"],
                "clue_cost": hunt["clue_cost"],
                "time_limit_minutes": hunt["time_limit_minutes"]
            }
            safe_hunts.append(safe_hunt)
        
        return {"hunts": safe_hunts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Start a treasure hunt
@app.post("/api/treasure-hunts/start")
async def start_treasure_hunt(request: StartHuntRequest, uid: str):
    """Start a new treasure hunt - deducts PRC"""
    try:
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        hunt = await db.treasure_hunts.find_one({"hunt_id": request.hunt_id, "active": True})
        if not hunt:
            raise HTTPException(status_code=404, detail="Treasure hunt not found")
        
        # Check if user has enough VALID PRC (non-expired for free users)
        is_free_user = user.get("membership_type", "free") != "vip"
        
        if is_free_user:
            # Free users: check valid (non-expired) PRC
            valid_prc = await get_valid_prc_balance(uid)
            if valid_prc < hunt["prc_cost"]:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient valid PRC. You need {hunt['prc_cost']} PRC but only have {round(valid_prc, 2)} valid PRC. Your expired PRC cannot be used. Mine more PRC or upgrade to VIP for lifetime validity!"
                )
            user_prc = user.get("prc_balance", 0)
        else:
            # VIP users: all PRC is valid
            user_prc = user.get("prc_balance", 0)
            if user_prc < hunt["prc_cost"]:
                raise HTTPException(status_code=400, detail="Insufficient PRC balance")
        
        # Check if user already has an active hunt for this
        existing = await db.treasure_progress.find_one({
            "user_id": uid,
            "hunt_id": request.hunt_id,
            "completed": False
        })
        if existing:
            raise HTTPException(status_code=400, detail="You already have an active hunt for this treasure")
        
        # Deduct PRC
        new_prc_balance = user_prc - hunt["prc_cost"]
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"prc_balance": new_prc_balance}}
        )
        
        # Log transaction
        await log_transaction(
            user_id=uid,
            wallet_type="prc",
            transaction_type="order",
            amount=hunt["prc_cost"],
            description=f"Started treasure hunt: {hunt['title']}",
            metadata={"hunt_id": request.hunt_id, "hunt_title": hunt["title"]},
            related_id=request.hunt_id,
            related_type="treasure_hunt"
        )
        
        # Randomly select treasure location from available locations
        import random
        treasure_locations = [loc for loc in hunt["treasure_locations"] if loc.get("is_treasure", False)]
        if treasure_locations:
            selected_treasure = random.choice(treasure_locations)
            treasure_location_id = selected_treasure["id"]
        else:
            # Fallback if no treasure marked
            treasure_location_id = hunt["treasure_locations"][0]["id"]
        
        # Create progress entry
        progress_id = f"progress_{uuid.uuid4()}"
        progress = {
            "progress_id": progress_id,
            "user_id": uid,
            "hunt_id": request.hunt_id,
            "treasure_location_id": treasure_location_id,  # Store randomized treasure location
            "started_at": datetime.now(timezone.utc).isoformat(),
            "clues_revealed": [],
            "attempts": 0,
            "found": False,
            "found_at": None,
            "prc_spent": hunt["prc_cost"],
            "cashback_earned": 0,
            "completed": False,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=hunt["time_limit_minutes"])).isoformat()
        }
        
        await db.treasure_progress.insert_one(progress)
        
        return {
            "success": True,
            "progress_id": progress_id,
            "hunt_title": hunt["title"],
            "prc_spent": hunt["prc_cost"],
            "new_prc_balance": new_prc_balance,
            "expires_at": progress["expires_at"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get user's active treasure hunts
@app.get("/api/treasure-hunts/my-progress")
async def get_my_treasure_progress(uid: str):
    """Get user's active and completed treasure hunts"""
    try:
        progress_list = await db.treasure_progress.find({"user_id": uid}).to_list(length=100)
        
        enriched_progress = []
        for progress in progress_list:
            hunt = await db.treasure_hunts.find_one({"hunt_id": progress["hunt_id"]})
            if hunt:
                progress_data = {
                    "progress_id": progress["progress_id"],
                    "hunt_id": progress["hunt_id"],
                    "hunt_title": hunt["title"],
                    "difficulty": hunt["difficulty"],
                    "started_at": progress["started_at"],
                    "clues_revealed": progress.get("clues_revealed", []),
                    "total_clues": hunt["total_clues"],
                    "clue_cost": hunt["clue_cost"],
                    "attempts": progress.get("attempts", 0),
                    "found": progress.get("found", False),
                    "found_at": progress.get("found_at"),
                    "prc_spent": progress.get("prc_spent", 0),
                    "cashback_earned": progress.get("cashback_earned", 0),
                    "completed": progress.get("completed", False),
                    "expires_at": progress.get("expires_at"),
                    "reward_prc": hunt["reward_prc"]
                }
                enriched_progress.append(progress_data)
        
        return {"progress": enriched_progress}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Buy a clue
@app.post("/api/treasure-hunts/buy-clue")
async def buy_treasure_clue(request: BuyClueRequest, uid: str):
    """Buy a clue for a treasure hunt - deducts PRC"""
    try:
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        progress = await db.treasure_progress.find_one({
            "progress_id": request.progress_id,
            "user_id": uid
        })
        if not progress:
            raise HTTPException(status_code=404, detail="Progress not found")
        
        if progress.get("completed", False):
            raise HTTPException(status_code=400, detail="This hunt is already completed")
        
        hunt = await db.treasure_hunts.find_one({"hunt_id": progress["hunt_id"]})
        if not hunt:
            raise HTTPException(status_code=404, detail="Hunt not found")
        
        # Check if clue number is valid
        if request.clue_number < 0 or request.clue_number >= hunt["total_clues"]:
            raise HTTPException(status_code=400, detail="Invalid clue number")
        
        # Check if clue already revealed
        clues_revealed = progress.get("clues_revealed", [])
        if request.clue_number in clues_revealed:
            raise HTTPException(status_code=400, detail="Clue already revealed")
        
        # Check PRC balance
        user_prc = user.get("prc_balance", 0)
        clue_cost = hunt["clue_cost"]
        if user_prc < clue_cost:
            raise HTTPException(status_code=400, detail="Insufficient PRC balance")
        
        # Deduct PRC
        new_prc_balance = user_prc - clue_cost
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"prc_balance": new_prc_balance}}
        )
        
        # Log transaction
        await log_transaction(
            user_id=uid,
            wallet_type="prc",
            transaction_type="order",
            amount=clue_cost,
            description=f"Bought clue #{request.clue_number + 1} for {hunt['title']}",
            metadata={"progress_id": request.progress_id, "clue_number": request.clue_number, "hunt_title": hunt['title']},
            related_id=request.progress_id,
            related_type="treasure_clue"
        )
        
        # Update progress
        clues_revealed.append(request.clue_number)
        prc_spent = progress.get("prc_spent", 0) + clue_cost
        
        await db.treasure_progress.update_one(
            {"progress_id": request.progress_id},
            {
                "$set": {
                    "clues_revealed": clues_revealed,
                    "prc_spent": prc_spent
                }
            }
        )
        
        # Get the clue text
        clue_text = hunt.get("clues", [])[request.clue_number] if request.clue_number < len(hunt.get("clues", [])) else "No clue available"
        
        return {
            "success": True,
            "clue_number": request.clue_number,
            "clue_text": clue_text,
            "prc_spent": clue_cost,
            "new_prc_balance": new_prc_balance,
            "total_clues_revealed": len(clues_revealed)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Find treasure attempt
@app.post("/api/treasure-hunts/find-treasure")
async def find_treasure(request: FindTreasureRequest, uid: str):
    """Attempt to find treasure at a location"""
    try:
        progress = await db.treasure_progress.find_one({
            "progress_id": request.progress_id,
            "user_id": uid
        })
        if not progress:
            raise HTTPException(status_code=404, detail="Progress not found")
        
        if progress.get("completed", False):
            raise HTTPException(status_code=400, detail="This hunt is already completed")
        
        hunt = await db.treasure_hunts.find_one({"hunt_id": progress["hunt_id"]})
        if not hunt:
            raise HTTPException(status_code=404, detail="Hunt not found")
        
        # Find the location
        location = None
        for loc in hunt["treasure_locations"]:
            if loc["id"] == request.location_id:
                location = loc
                break
        
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")
        
        # Increment attempts
        attempts = progress.get("attempts", 0) + 1
        
        # Check if treasure found - use randomized location from progress
        treasure_location_id = progress.get("treasure_location_id")
        is_treasure = (request.location_id == treasure_location_id)
        result = {
            "found": is_treasure,
            "message": location.get("message", ""),
            "attempts": attempts
        }
        
        if is_treasure:
            # Calculate cashback based on membership type
            # Free users: 10%, VIP users: 50%
            prc_spent = progress.get("prc_spent", 0)
            inr_value = prc_spent / 10  # Convert PRC to INR (10 PRC = 1 INR)
            cashback_rate = await get_cashback_rate(uid, is_top_player=False)
            cashback = round(inr_value * cashback_rate, 2)
            cashback_percentage = int(cashback_rate * 100)
            # Example for FREE: 100 PRC → 10 INR → 10 * 0.10 = 1.0 INR cashback
            # Example for VIP: 100 PRC → 10 INR → 10 * 0.50 = 5.0 INR cashback
            
            # Award cashback to cashback wallet
            user = await db.users.find_one({"uid": uid})
            current_cashback = user.get("cashback_wallet_balance", 0)
            new_cashback = current_cashback + cashback
            
            await db.users.update_one(
                {"uid": uid},
                {"$set": {"cashback_wallet_balance": new_cashback}}
            )
            
            # Log cashback transaction (POSITIVE amount)
            user = await db.users.find_one({"uid": uid})
            membership_type = user.get("membership_type", "free")
            
            await log_transaction(
                user_id=uid,
                wallet_type="cashback",
                transaction_type="cashback",
                amount=cashback,
                description=f"{cashback_percentage}% cashback for treasure hunt: {hunt['title']}",
                metadata={
                    "progress_id": request.progress_id, 
                    "hunt_id": hunt["hunt_id"], 
                    "prc_spent": prc_spent, 
                    "cashback_percentage": cashback_percentage,
                    "membership_type": membership_type,
                    "hunt_title": hunt["title"],
                    "attempts": attempts
                },
                related_id=request.progress_id,
                related_type="treasure_cashback"
            )
            
            # Update progress
            await db.treasure_progress.update_one(
                {"progress_id": request.progress_id},
                {
                    "$set": {
                        "found": True,
                        "found_at": datetime.now(timezone.utc).isoformat(),
                        "attempts": attempts,
                        "cashback_earned": cashback,
                        "completed": True
                    }
                }
            )
            
            result.update({
                "cashback_earned": cashback,
                "new_cashback_balance": new_cashback,
                "prc_spent_total": prc_spent
            })
        else:
            # Update attempts only
            await db.treasure_progress.update_one(
                {"progress_id": request.progress_id},
                {"$set": {"attempts": attempts}}
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get treasure hunt leaderboard
@app.get("/api/treasure-hunts/leaderboard")
async def get_treasure_leaderboard(uid: str):
    """Get treasure hunt leaderboard - top hunters by treasures found"""
    try:
        # Aggregate user treasure hunt stats
        pipeline = [
            {"$match": {"found": True, "completed": True}},
            {"$group": {
                "_id": "$user_id",
                "treasures_found": {"$sum": 1},
                "total_reward": {"$sum": "$cashback_earned"},
                "total_prc_spent": {"$sum": "$prc_spent"}
            }},
            {"$sort": {"treasures_found": -1, "total_reward": -1}},
            {"$limit": 10}
        ]
        
        leaderboard_data = await db.treasure_progress.aggregate(pipeline).to_list(length=10)
        
        # Enrich with user data
        leaderboard = []
        for entry in leaderboard_data:
            user = await db.users.find_one({"uid": entry["_id"]})
            if user:
                leaderboard.append({
                    "user_id": entry["_id"],
                    "name": user.get("name", "Anonymous"),
                    "email": user.get("email", ""),
                    "treasures_found": entry["treasures_found"],
                    "total_cashback_earned": entry["total_reward"],
                    "total_prc_spent": entry["total_prc_spent"]
                })
        
        return {"leaderboard": leaderboard}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get game map data for active hunt
@app.get("/api/treasure-hunts/game-map/{progress_id}")
async def get_game_map(progress_id: str, uid: str):
    """Get game map data for active hunt (without revealing treasure location)"""
    try:
        progress = await db.treasure_progress.find_one({
            "progress_id": progress_id,
            "user_id": uid
        })
        if not progress:
            raise HTTPException(status_code=404, detail="Progress not found")
        
        hunt = await db.treasure_hunts.find_one({"hunt_id": progress["hunt_id"]})
        if not hunt:
            raise HTTPException(status_code=404, detail="Hunt not found")
        
        # Return locations without revealing which is treasure (unless already found)
        safe_locations = []
        for loc in hunt["treasure_locations"]:
            safe_loc = {
                "id": loc["id"],
                "x": loc["x"],
                "y": loc["y"]
            }
            # If treasure already found, reveal it
            if progress.get("found", False):
                treasure_location_id = progress.get("treasure_location_id")
                safe_loc["is_treasure"] = (loc["id"] == treasure_location_id)
                if safe_loc["is_treasure"]:
                    safe_loc["message"] = loc.get("message", "")
            safe_locations.append(safe_loc)
        
        # Get revealed clues
        revealed_clues = []
        clues_revealed = progress.get("clues_revealed", [])
        all_clues = hunt.get("clues", [])
        for clue_idx in clues_revealed:
            if clue_idx < len(all_clues):
                revealed_clues.append({
                    "number": clue_idx + 1,
                    "text": all_clues[clue_idx]
                })
        
        return {
            "hunt_id": hunt["hunt_id"],
            "title": hunt["title"],
            "description": hunt["description"],
            "difficulty": hunt["difficulty"],
            "locations": safe_locations,
            "revealed_clues": revealed_clues,
            "total_clues": hunt["total_clues"],
            "clue_cost": hunt["clue_cost"],
            "attempts": progress.get("attempts", 0),
            "found": progress.get("found", False),
            "expires_at": progress.get("expires_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Daily Top Hunter - 100% Cashback Reward
@app.get("/api/treasure-hunts/daily-top-hunter")
async def get_daily_top_hunter(uid: str):
    """Get today's top treasure hunter and check if current user qualifies"""
    try:
        # Get today's date range
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        # Find all treasures found today
        pipeline = [
            {
                "$match": {
                    "found": True,
                    "found_at": {
                        "$gte": today_start.isoformat(),
                        "$lt": today_end.isoformat()
                    }
                }
            },
            {
                "$group": {
                    "_id": "$user_id",
                    "treasures_found_today": {"$sum": 1},
                    "total_prc_spent_today": {"$sum": "$prc_spent"},
                    "total_cashback_earned": {"$sum": "$cashback_earned"}
                }
            },
            {
                "$sort": {"treasures_found_today": -1, "total_prc_spent_today": -1}
            },
            {
                "$limit": 1
            }
        ]
        
        top_hunter_data = await db.treasure_progress.aggregate(pipeline).to_list(length=1)
        
        if not top_hunter_data:
            return {
                "has_top_hunter": False,
                "is_current_user": False,
                "message": "No treasures found today yet!"
            }
        
        top_hunter = top_hunter_data[0]
        top_user = await db.users.find_one({"uid": top_hunter["_id"]})
        
        # Check if bonus already awarded today
        bonus_awarded = await db.daily_top_hunter_rewards.find_one({
            "date": today_start.isoformat()[:10],
            "user_id": top_hunter["_id"]
        })
        
        is_current_user = (uid == top_hunter["_id"])
        
        return {
            "has_top_hunter": True,
            "top_hunter": {
                "user_id": top_hunter["_id"],
                "name": top_user.get("name", "Anonymous") if top_user else "Anonymous",
                "treasures_found": top_hunter["treasures_found_today"],
                "prc_spent": top_hunter["total_prc_spent_today"],
                "cashback_earned": top_hunter["total_cashback_earned"]
            },
            "is_current_user": is_current_user,
            "bonus_awarded": bonus_awarded is not None,
            "message": "🏆 Daily Top Hunter!" if is_current_user else "Keep hunting to become today's top hunter!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Award Daily Top Hunter Bonus (Admin/System call or automated)
@app.post("/api/treasure-hunts/award-daily-bonus")
async def award_daily_top_hunter_bonus(uid: str):
    """Award 100% cashback bonus to today's top hunter (called at day end)"""
    try:
        # Get today's date range
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        # Find today's top hunter
        pipeline = [
            {
                "$match": {
                    "found": True,
                    "found_at": {
                        "$gte": today_start.isoformat(),
                        "$lt": today_end.isoformat()
                    }
                }
            },
            {
                "$group": {
                    "_id": "$user_id",
                    "treasures_found_today": {"$sum": 1},
                    "total_prc_spent_today": {"$sum": "$prc_spent"},
                    "total_cashback_earned": {"$sum": "$cashback_earned"}
                }
            },
            {
                "$sort": {"treasures_found_today": -1, "total_prc_spent_today": -1}
            },
            {
                "$limit": 1
            }
        ]
        
        top_hunter_data = await db.treasure_progress.aggregate(pipeline).to_list(length=1)
        
        if not top_hunter_data:
            return {"success": False, "message": "No top hunter found for today"}
        
        top_hunter = top_hunter_data[0]
        winner_uid = top_hunter["_id"]
        
        # Check if already awarded
        existing_reward = await db.daily_top_hunter_rewards.find_one({
            "date": today_start.isoformat()[:10],
            "user_id": winner_uid
        })
        
        if existing_reward:
            return {"success": False, "message": "Bonus already awarded for today"}
        
        # Calculate bonus based on membership
        # Free users: Total 20% (10% already given, give another 10%)
        # VIP users: Total 100% (50% already given, give another 50%)
        prc_spent = top_hunter["total_prc_spent_today"]
        inr_value = prc_spent / 10
        already_earned = top_hunter["total_cashback_earned"]
        
        # Get user membership type
        user = await db.users.find_one({"uid": winner_uid})
        membership_type = user.get("membership_type", "free")
        is_vip = membership_type == "vip"
        
        # Calculate bonus: Additional amount to reach top player rate
        # Free: Give another 10% to reach 20% total
        # VIP: Give another 50% to reach 100% total
        bonus_rate = 0.50 if is_vip else 0.10
        bonus_cashback = round(inr_value * bonus_rate, 2)
        
        # Award bonus to cashback wallet
        current_cashback = user.get("cashback_wallet_balance", 0)
        new_cashback = current_cashback + bonus_cashback
        
        await db.users.update_one(
            {"uid": winner_uid},
            {"$set": {"cashback_wallet_balance": new_cashback}}
        )
        
        # Log bonus transaction
        total_percentage = "100%" if is_vip else "20%"
        bonus_percentage = "50%" if is_vip else "10%"
        
        await log_transaction(
            user_id=winner_uid,
            wallet_type="cashback",
            transaction_type="cashback",
            amount=bonus_cashback,
            description=f"🏆 Daily Top Hunter Bonus! {total_percentage} total cashback ({bonus_percentage} bonus)",
            metadata={
                "treasures_found": top_hunter["treasures_found_today"],
                "prc_spent": prc_spent,
                "date": today_start.isoformat()[:10],
                "bonus_type": "daily_top_hunter",
                "membership_type": membership_type,
                "total_percentage": total_percentage
            },
            related_id=f"daily_top_{today_start.isoformat()[:10]}",
            related_type="daily_top_hunter_bonus"
        )
        
        # Record reward
        await db.daily_top_hunter_rewards.insert_one({
            "reward_id": f"reward_{uuid.uuid4()}",
            "date": today_start.isoformat()[:10],
            "user_id": winner_uid,
            "treasures_found": top_hunter["treasures_found_today"],
            "prc_spent": prc_spent,
            "base_cashback": already_earned,
            "bonus_cashback": bonus_cashback,
            "total_cashback": already_earned + bonus_cashback,
            "awarded_at": datetime.now(timezone.utc).isoformat()
        })
        
        winner_user = await db.users.find_one({"uid": winner_uid})
        
        return {
            "success": True,
            "winner": {
                "user_id": winner_uid,
                "name": winner_user.get("name", "Anonymous"),
                "treasures_found": top_hunter["treasures_found_today"],
                "prc_spent": prc_spent,
                "base_cashback": already_earned,
                "bonus_cashback": bonus_cashback,
                "total_cashback": already_earned + bonus_cashback
            },
            "message": f"🏆 {winner_user.get('name', 'User')} awarded 100% total cashback as Daily Top Hunter!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


    try:
        progress = await db.treasure_progress.find_one({
            "progress_id": progress_id,
            "user_id": uid
        })
        if not progress:
            raise HTTPException(status_code=404, detail="Progress not found")
        
        hunt = await db.treasure_hunts.find_one({"hunt_id": progress["hunt_id"]})
        if not hunt:
            raise HTTPException(status_code=404, detail="Hunt not found")
        
        # Return locations without revealing which is treasure (unless already found)
        safe_locations = []
        for loc in hunt["treasure_locations"]:
            safe_loc = {
                "id": loc["id"],
                "x": loc["x"],
                "y": loc["y"]
            }
            # If treasure already found, reveal it
            if progress.get("found", False):
                safe_loc["is_treasure"] = loc.get("is_treasure", False)
                safe_loc["message"] = loc.get("message", "")
            safe_locations.append(safe_loc)
        
        # Get revealed clues
        revealed_clues = []
        clues_revealed = progress.get("clues_revealed", [])
        all_clues = hunt.get("clues", [])
        for clue_idx in clues_revealed:
            if clue_idx < len(all_clues):
                revealed_clues.append({
                    "number": clue_idx + 1,
                    "text": all_clues[clue_idx]
                })
        
        return {
            "hunt_id": hunt["hunt_id"],
            "title": hunt["title"],
            "description": hunt["description"],
            "difficulty": hunt["difficulty"],
            "locations": safe_locations,
            "revealed_clues": revealed_clues,
            "total_clues": hunt["total_clues"],
            "clue_cost": hunt["clue_cost"],
            "attempts": progress.get("attempts", 0),
            "found": progress.get("found", False),
            "expires_at": progress.get("expires_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



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

@api_router.post("/admin/video-ads")
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
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/video-ads")
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
        
        video_ads = await db.video_ads.find(query).sort("created_at", -1).to_list(length=None)
        
        return {
            "success": True,
            "video_ads": video_ads,
            "total": len(video_ads)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/video-ads/active")
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
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/admin/video-ads/{video_ad_id}")
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
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/video-ads/{video_ad_id}")
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
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/video-ads/{video_ad_id}/track")
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
        raise HTTPException(status_code=500, detail=str(e))



async def initialize_database_indexes():
    """Create database indexes for better performance"""
    try:
        # Users collection indexes
        await db.users.create_index("uid", unique=True)
        await db.users.create_index("email", unique=True)
        await db.users.create_index("mobile", unique=True)
        
        # Video ads indexes
        await db.video_ads.create_index("video_ad_id", unique=True)
        await db.video_ads.create_index("placement")
        await db.video_ads.create_index("is_active")
        
        # Treasure hunts indexes
        await db.treasure_hunts.create_index("hunt_id", unique=True)
        await db.treasure_progress.create_index("progress_id", unique=True)
        await db.treasure_progress.create_index("user_id")
        
        # Orders indexes
        await db.orders.create_index("order_id", unique=True)
        await db.orders.create_index("user_id")
        
        # Products indexes
        await db.products.create_index("product_id", unique=True)
        
        # Manager actions index (for audit logging)
        await db.manager_actions.create_index("manager_id")
        await db.manager_actions.create_index("timestamp")
        
        print("✅ Database indexes created successfully")
    except Exception as e:
        print(f"⚠️ Index creation warning: {e}")
        # Don't fail if indexes already exist

@app.on_event("startup")
async def startup_db():
    """Initialize database with default data"""
    print("🚀 Starting database initialization...")
    
    # Create indexes
    await initialize_database_indexes()
    
    # Initialize treasure hunts (creates if not exists)
    await initialize_treasure_hunts()
    
    # Check if video_ads collection exists, if not create sample
    video_ads_count = await db.video_ads.count_documents({})
    if video_ads_count == 0:
        print("📹 No video ads found, database ready for admin to create videos")
    
    print("✅ Database initialization complete!")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()