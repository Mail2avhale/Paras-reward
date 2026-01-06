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
import asyncio
from fastapi import BackgroundTasks
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with Atlas-compatible settings
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=30000,  # 30 second timeout for Atlas
    connectTimeoutMS=20000,  # 20 second connection timeout
    socketTimeoutMS=20000,  # 20 second socket timeout
    maxPoolSize=50,  # Connection pool for production
    minPoolSize=10,
    retryWrites=True,  # Enable retryable writes for Atlas
    retryReads=True,  # Enable retryable reads for Atlas
    w='majority'  # Write concern for data durability
)
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

# Create scheduler for automated tasks
scheduler = AsyncIOScheduler()

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
    vip_expiry: Optional[str] = None  # VIP expiry date as ISO string
    vip_expired: Optional[bool] = None  # True if VIP membership is expired
    vip_days_expired: Optional[int] = None  # Days since VIP expired
    vip_expiry_message: Optional[str] = None  # Renewal message for expired VIP
    
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
    aadhaar_number: Optional[str] = None
    pan_front: Optional[str] = None
    pan_number: Optional[str] = None
    status: str = "pending"  # pending, verified, rejected
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified_at: Optional[datetime] = None

class KYCSubmit(BaseModel):
    aadhaar_front_base64: str = ""
    aadhaar_back_base64: str = ""
    aadhaar_number: str = ""
    pan_front_base64: str = ""
    pan_number: str = ""

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

# ========== NEW FEATURES MODELS ==========

class BillPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    request_type: str  # mobile_recharge, dish_recharge, electricity_bill, credit_card_payment, loan_emi
    amount_inr: float  # Amount in INR
    prc_required: float  # PRC required (amount * 10)
    service_charge_amount: float  # Service charge in PRC
    total_prc_deducted: float  # Total PRC deducted from user
    details: Dict  # phone_number, operator, account_number, etc.
    status: str = "pending"  # pending, approved, processing, completed, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None
    admin_notes: Optional[str] = None
    processed_by: Optional[str] = None

class BillPaymentRequestCreate(BaseModel):
    request_type: str
    amount_inr: float
    details: Dict

class BillPaymentProcess(BaseModel):
    request_id: str
    action: str  # approve, reject, complete
    admin_notes: Optional[str] = None

class GiftVoucherRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_role: str  # user, outlet, sub_stockist, master_stockist
    denomination: int  # 10, 50, 100, 500, 1000, 5000
    prc_required: float  # denomination * 10
    service_charge_amount: float  # Service charge in PRC
    total_prc_deducted: float  # Total PRC deducted
    status: str = "pending"  # pending, approved, rejected, completed
    voucher_code: Optional[str] = None
    voucher_details: Optional[Dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None
    admin_notes: Optional[str] = None
    processed_by: Optional[str] = None

class GiftVoucherRequestCreate(BaseModel):
    denomination: int

class GiftVoucherProcess(BaseModel):
    request_id: str
    action: str  # approve, reject, complete
    voucher_code: Optional[str] = None
    voucher_details: Optional[Dict] = None
    admin_notes: Optional[str] = None

# ========== HELPER FUNCTIONS ==========
async def get_base_rate():
    """Calculate mining base rate based on total users"""
    # Fetch total users
    total_users = await db.users.count_documents({})
    
    # Base rate starts at 50, decreases by 1 for every 200 users, min 20
    rate_decrease = total_users // 200
    current_base_rate = max(20, 50 - rate_decrease)
    
    return current_base_rate

async def get_multi_level_referrals(user_id: str, max_levels: int = 5):
    """
    Get multi-level referrals (up to 5 levels deep)
    Returns: {
        'level_1': [list of direct referrals],
        'level_2': [list of level 2 referrals],
        ...
        'level_5': [list of level 5 referrals]
    }
    """
    referrals_by_level = {}
    current_level_uids = [user_id]
    
    for level in range(1, max_levels + 1):
        # Get users referred by current level users
        next_level_uids = []
        
        # Find all users whose referred_by matches any UID in current level
        referred_users = []
        async for referred_user in db.users.find({"referred_by": {"$in": current_level_uids}}, {"_id": 0}):
            referred_users.append(referred_user)
            next_level_uids.append(referred_user.get("uid"))
        
        # Store this level's referrals
        if referred_users:
            referrals_by_level[f'level_{level}'] = referred_users
        
        # Move to next level
        current_level_uids = next_level_uids
        
        # Stop if no more referrals at this level
        if not current_level_uids:
            break
    
    return referrals_by_level

async def count_active_referrals_by_level(user_id: str):
    """
    Count active referrals at each level (up to 5 levels)
    Active = logged in within last 24 hours
    Returns: {
        'level_1': count,
        'level_2': count,
        'level_3': count,
        'level_4': count,
        'level_5': count
    }
    """
    referrals_by_level = await get_multi_level_referrals(user_id, max_levels=5)
    active_counts = {
        'level_1': 0,
        'level_2': 0,
        'level_3': 0,
        'level_4': 0,
        'level_5': 0
    }
    
    # Time threshold for active users (24 hours ago)
    now = datetime.now(timezone.utc)
    active_threshold = now - timedelta(hours=24)
    
    print(f"🔍 Checking active referrals for user {user_id}")
    
    for level, users in referrals_by_level.items():
        print(f"  Level {level}: {len(users)} total referrals")
        for user in users:
            last_login = user.get("last_login")
            if last_login:
                try:
                    if isinstance(last_login, str):
                        last_login = datetime.fromisoformat(last_login.replace('Z', '+00:00'))
                    elif isinstance(last_login, datetime):
                        pass  # Already a datetime object
                    else:
                        continue
                    
                    if last_login >= active_threshold:
                        active_counts[level] += 1
                        print(f"    ✅ Active referral: {user.get('email')} (last login: {last_login})")
                    else:
                        print(f"    ⏰ Inactive referral: {user.get('email')} (last login: {last_login})")
                except Exception as e:
                    print(f"    ❌ Error processing referral: {e}")
                    pass
            else:
                print(f"    ⚠️ No last_login for referral: {user.get('email')}")
    
    print(f"✅ Active referrals count: {active_counts}")
    return active_counts
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
    if transaction_type in ["mining", "tap_game", "referral", "cashback", "withdrawal_rejected", "admin_credit", "profit_share", "scratch_card_reward", "treasure_hunt_reward", "delivery_commission", "prc_rain_gain"]:
        # Credit transactions
        balance_after = balance_before + amount
    elif transaction_type in ["order", "withdrawal", "admin_debit", "delivery_charge", "scratch_card_purchase", "treasure_hunt_play", "prc_burn", "bill_payment_request", "gift_voucher_request", "prc_rain_loss"]:
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

# ==================== PRC BURN SYSTEM ====================

async def burn_expired_prc_for_free_users():
    """
    Burn PRC earned by free users after 48 hours (2 days)
    FIFO - First Earned First Burn
    """
    try:
        now = datetime.now(timezone.utc)
        burn_threshold = now - timedelta(days=2)
        
        # Find all free users
        free_users = db.users.find({
            "membership_type": {"$ne": "vip"},
            "mining_history": {"$exists": True, "$ne": []}
        })
        
        burn_count = 0
        total_burned = 0.0
        
        async for user in free_users:
            uid = user.get("uid")
            mining_history = user.get("mining_history", [])
            prc_balance = user.get("prc_balance", 0)
            
            if not mining_history or prc_balance <= 0:
                continue
            
            # Find expired PRC (older than 48 hours)
            burned_amount = 0.0
            updated_history = []
            
            for entry in mining_history:
                timestamp_str = entry.get("timestamp")
                amount = entry.get("amount", 0)
                is_burned = entry.get("burned", False)
                
                if is_burned:
                    updated_history.append(entry)
                    continue
                
                # Parse timestamp
                try:
                    if isinstance(timestamp_str, str):
                        mining_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        mining_time = timestamp_str
                except:
                    mining_time = now  # Skip if parse fails
                
                # Check if expired
                if mining_time < burn_threshold and not is_burned:
                    # Burn this PRC
                    burned_amount += amount
                    entry["burned"] = True
                    entry["burned_at"] = now.isoformat()
                
                updated_history.append(entry)
            
            if burned_amount > 0:
                # Update mining history only (log_transaction will update balance)
                logging.info(f"[FREE BURN DEBUG] User {uid}: burning {burned_amount}, old_balance={prc_balance}")
                
                # First update mining history
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "mining_history": updated_history
                        }
                    }
                )
                
                # Log burn transaction (this also updates balance)
                await log_transaction(
                    user_id=uid,
                    wallet_type="prc",
                    transaction_type="prc_burn",
                    amount=burned_amount,
                    description=f"Burned {burned_amount:.2f} PRC (expired after 48 hours - Free user FIFO)",
                    metadata={"burn_reason": "free_user_expiry", "burn_threshold_hours": 48}
                )
                
                burn_count += 1
                total_burned += burned_amount
        
        logging.info(f"Free user PRC burn: {burn_count} users, {total_burned:.2f} PRC burned")
        return {"users_affected": burn_count, "total_burned": total_burned}
        
    except Exception as e:
        logging.error(f"Error burning expired PRC for free users: {e}")
        return {"users_affected": 0, "total_burned": 0.0}

async def burn_expired_vip_prc():
    """
    Burn PRC for expired VIP users - ONLY PRC mined AFTER expiry that is older than 5 days
    Logic: When VIP expires, user can still mine but that PRC will be burned after 5 days
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Find all expired VIP users (any expiry in the past)
        expired_vips = db.users.find({
            "membership_type": "vip",
            "vip_expiry": {"$lt": now.isoformat()},
            "mining_history": {"$exists": True, "$ne": []}
        })
        
        burn_count = 0
        total_burned = 0.0
        
        async for user in expired_vips:
            uid = user.get("uid")
            mining_history = user.get("mining_history", [])
            prc_balance = user.get("prc_balance", 0)
            vip_expiry_str = user.get("vip_expiry")
            
            logging.info(f"[VIP BURN DEBUG] Processing user {uid}: prc_balance={prc_balance}, mining_entries={len(mining_history)}")
            
            if not mining_history or prc_balance <= 0 or not vip_expiry_str:
                logging.info(f"[VIP BURN DEBUG] Skipping user {uid}: mining_history={bool(mining_history)}, prc_balance={prc_balance}, vip_expiry={bool(vip_expiry_str)}")
                continue
            
            try:
                vip_expiry = datetime.fromisoformat(vip_expiry_str.replace('Z', '+00:00'))
            except:
                continue
            
            # Burn ONLY PRC mined AFTER expiry AND older than 5 days
            burned_amount = 0.0
            updated_history = []
            
            for entry in mining_history:
                amount = entry.get("amount", 0)
                is_burned = entry.get("burned", False)
                timestamp_str = entry.get("timestamp") or entry.get("mined_at")
                
                if is_burned:
                    updated_history.append(entry)
                    continue
                
                # Parse mining timestamp
                try:
                    if isinstance(timestamp_str, str):
                        mining_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        updated_history.append(entry)
                        continue
                except:
                    updated_history.append(entry)
                    continue
                
                # Check if this PRC was mined AFTER VIP expiry
                if mining_time > vip_expiry:
                    # Check if 5 days have passed since mining
                    burn_threshold = mining_time + timedelta(days=5)
                    if now >= burn_threshold:
                        # Burn this PRC (mined after expiry, 5 days old)
                        burned_amount += amount
                        entry["burned"] = True
                        entry["burned_at"] = now.isoformat()
                        entry["burn_reason"] = "mined_after_vip_expiry_5days"
                
                updated_history.append(entry)
            
            if burned_amount > 0:
                # Update mining history only (log_transaction will update balance)
                logging.info(f"[VIP BURN DEBUG] User {uid}: burning {burned_amount}, old_balance={prc_balance}")
                
                # First update mining history
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "mining_history": updated_history
                        }
                    }
                )
                
                # Log burn transaction (this also updates balance)
                await log_transaction(
                    user_id=uid,
                    wallet_type="prc",
                    transaction_type="prc_burn",
                    amount=burned_amount,
                    description=f"Burned {burned_amount:.2f} PRC (mined after VIP expiry, 5 days old)",
                    metadata={"burn_reason": "mined_after_vip_expiry_5days", "vip_expiry": vip_expiry_str}
                )
                
                burn_count += 1
                total_burned += burned_amount
        
        logging.info(f"Expired VIP PRC burn: {burn_count} users, {total_burned:.2f} PRC burned")
        return {"users_affected": burn_count, "total_burned": total_burned}
        
    except Exception as e:
        logging.error(f"Error burning expired VIP PRC: {e}")
        return {"users_affected": 0, "total_burned": 0.0}

async def get_vip_plan_pricing(plan_type: str = "monthly"):
    """
    Get VIP plan pricing with discounts applied
    Returns: {
        "plan_type": "monthly",
        "base_price": 299.0,
        "discount_percentage": 10,
        "discount_amount": 29.9,
        "final_price": 269.1,
        "duration_days": 30,
        "label": "Monthly Plan"
    }
    """
    # Default pricing for each plan type
    default_prices = {
        "monthly": 299.0,
        "quarterly": 897.0,
        "half_yearly": 1794.0,
        "yearly": 3588.0
    }
    
    settings = await db.settings.find_one({})
    if not settings or "vip_plans" not in settings:
        # Return default plans if not in database
        default_plans = {
            "monthly": {"price": 299.0, "duration_days": 30, "discount_percentage": 0, "discount_fixed": 0, "label": "Monthly Plan"},
            "quarterly": {"price": 897.0, "duration_days": 90, "discount_percentage": 0, "discount_fixed": 0, "label": "Quarterly Plan"},
            "half_yearly": {"price": 1794.0, "duration_days": 180, "discount_percentage": 0, "discount_fixed": 0, "label": "Half-Yearly Plan"},
            "yearly": {"price": 3588.0, "duration_days": 365, "discount_percentage": 0, "discount_fixed": 0, "label": "Yearly Plan"}
        }
        plan = default_plans.get(plan_type, default_plans["monthly"])
    else:
        plan = settings["vip_plans"].get(plan_type, settings["vip_plans"]["monthly"])
    
    # Handle missing price field by using default
    base_price = plan.get("price", default_prices.get(plan_type, 299.0))
    discount_percentage = plan.get("discount_percentage", 0)
    discount_fixed = plan.get("discount_fixed", 0)
    
    # Calculate total discount (percentage + fixed)
    discount_from_percentage = (base_price * discount_percentage) / 100
    total_discount = discount_from_percentage + discount_fixed
    final_price = max(0, base_price - total_discount)
    
    return {
        "plan_type": plan_type,
        "base_price": base_price,
        "discount_percentage": discount_percentage,
        "discount_fixed": discount_fixed,
        "discount_amount": round(total_discount, 2),
        "final_price": round(final_price, 2),
        "duration_days": plan["duration_days"],
        "label": plan["label"],
        "savings": round(total_discount, 2) if total_discount > 0 else 0
    }

async def get_all_vip_plans():
    """Get all VIP plans with pricing"""
    plans = []
    for plan_type in ["monthly", "quarterly", "half_yearly", "yearly"]:
        plan_data = await get_vip_plan_pricing(plan_type)
        plans.append(plan_data)
    return plans

async def check_vip_service_access(uid: str, service_name: str = "service") -> Dict:
    """
    Check if user can access VIP services (marketplace, gift vouchers, bill payments)
    Requirements:
    1. User must be VIP member
    2. VIP membership must not be expired
    Expired VIP users are blocked until renewal
    """
    user = await db.users.find_one({"uid": uid})
    if not user:
        return {"allowed": False, "reason": "User not found", "requires_vip": True}
    
    membership_type = user.get("membership_type", "free")
    
    # Free users cannot access these services
    if membership_type != "vip":
        return {
            "allowed": False, 
            "reason": f"VIP membership required to use {service_name}. Please upgrade to VIP.",
            "requires_vip": True,
            "is_expired": False
        }
    
    # Check VIP expiry
    vip_expiry_str = user.get("vip_expiry")
    if not vip_expiry_str:
        # VIP without expiry date - allow (legacy users)
        return {"allowed": True, "reason": ""}
    
    try:
        vip_expiry = datetime.fromisoformat(vip_expiry_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        
        if vip_expiry < now:
            # VIP expired - block service
            days_expired = (now - vip_expiry).days
            return {
                "allowed": False,
                "reason": f"Your VIP membership expired {days_expired} days ago. Please renew to access {service_name}.",
                "days_expired": days_expired,
                "requires_renewal": True,
                "is_expired": True,
                "expiry_date": vip_expiry_str
            }
        
        return {"allowed": True, "reason": ""}
    except:
        return {"allowed": True, "reason": ""}

# Keep old function name for backward compatibility
async def check_vip_marketplace_access(uid: str) -> Dict:
    """Backward compatible wrapper"""
    return await check_vip_service_access(uid, "marketplace")

async def run_prc_burn_job():
    """
    Scheduled job to burn expired PRC
    Should be run periodically (every hour or daily)
    """
    logging.info("Starting PRC burn job...")
    
    # Burn free user PRC (48 hours expiry)
    free_result = await burn_expired_prc_for_free_users()
    
    # Burn expired VIP PRC (5 days after expiry)
    vip_result = await burn_expired_vip_prc()
    
    logging.info(f"PRC burn job complete: Free={free_result}, VIP={vip_result}")
    return {"free_users": free_result, "expired_vips": vip_result}

# ==================== END PRC BURN SYSTEM ====================

# ==================== BILL PAYMENT & RECHARGE SYSTEM ====================

async def calculate_bill_payment_prc(amount_inr: float):
    """
    Calculate PRC required for bill payment
    Conversion: 100 INR = 1000 PRC
    Formula: INR * 10 = PRC
    """
    return amount_inr * 10

async def get_bill_payment_service_charge(amount_inr: float, prc_required: float):
    """
    Calculate service charge for bill payments based on admin settings
    Returns service charge in PRC
    """
    settings = await db.settings.find_one({})
    if not settings:
        # Default: 2% service charge
        return prc_required * 0.02
    
    charge_type = settings.get("bill_payment_charge_type", "percentage")  # percentage or fixed
    
    if charge_type == "percentage":
        percentage = settings.get("bill_payment_charge_percentage", 2.0)  # Default 2%
        return (prc_required * percentage) / 100
    else:
        # Fixed charge in PRC
        return settings.get("bill_payment_charge_fixed", 20.0)  # Default 20 PRC

async def get_gift_voucher_service_charge(prc_required: float):
    """
    Calculate service charge for gift voucher redemption
    Returns service charge in PRC
    """
    settings = await db.settings.find_one({})
    if not settings:
        # Default: 5% service charge
        return prc_required * 0.05
    
    charge_type = settings.get("gift_voucher_charge_type", "percentage")
    
    if charge_type == "percentage":
        percentage = settings.get("gift_voucher_charge_percentage", 5.0)  # Default 5%
        return (prc_required * percentage) / 100
    else:
        return settings.get("gift_voucher_charge_fixed", 50.0)  # Default 50 PRC

# ==================== END BILL PAYMENT SYSTEM ====================

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

async def get_delivery_charge(user, total_prc: float):
    """
    Calculate delivery charge based on user membership and PRC value
    Free users: ₹100
    VIP users: ₹50
    """
    is_vip = user.get("membership_type") == "vip"
    if total_prc < 100:
        return 100
    # 10% of PRC value (or flat rate)
    return 50 if is_vip else 100

async def calculate_mining_rate(uid: str):
    """
    Calculate mining rate per minute with multi-level referral bonuses
    
    Formula:
    - Base Rate: 50 (decreases by 1 per 200 users, min 20)
    - Daily Multiplier: Current day of month
    - Referral Bonuses (5 levels):
      * Level 1: +10% per active referral
      * Level 2: +5% per active referral
      * Level 3: +2.5% per active referral
      * Level 4: +1.5% per active referral
      * Level 5: +1.0% per active referral
    """
    base_rate = await get_base_rate()
    current_date = datetime.now(timezone.utc).day
    
    # Get multi-level active referrals
    active_referrals_by_level = await count_active_referrals_by_level(uid)
    
    # Get referral bonus settings from database (or use defaults)
    settings = await db.settings.find_one({}, {"_id": 0, "referral_bonus_settings": 1})
    if settings and "referral_bonus_settings" in settings:
        referral_bonus_percentages = {
            'level_1': settings["referral_bonus_settings"].get("level_1", 10) / 100,
            'level_2': settings["referral_bonus_settings"].get("level_2", 5) / 100,
            'level_3': settings["referral_bonus_settings"].get("level_3", 2.5) / 100,
            'level_4': settings["referral_bonus_settings"].get("level_4", 1.5) / 100,
            'level_5': settings["referral_bonus_settings"].get("level_5", 1) / 100,
        }
    else:
        # Default referral bonuses
        referral_bonus_percentages = {
            'level_1': 0.10,  # 10%
            'level_2': 0.05,  # 5%
            'level_3': 0.025, # 2.5%
            'level_4': 0.015, # 1.5%
            'level_5': 0.01   # 1.0%
        }
    
    total_referral_bonus = 0
    referral_breakdown = {}
    
    for level, count in active_referrals_by_level.items():
        if count > 0:
            bonus_percentage = referral_bonus_percentages.get(level, 0)
            level_bonus = count * bonus_percentage * base_rate
            total_referral_bonus += level_bonus
            referral_breakdown[level] = {
                'count': count,
                'percentage': bonus_percentage * 100,
                'bonus': level_bonus
            }
    
    # Total daily rate = current_date × (base_rate + referral_bonus)
    # This ensures referral bonuses also benefit from the daily multiplier
    effective_base_rate = base_rate + total_referral_bonus
    total_rate = current_date * effective_base_rate
    
    # Per minute rate
    per_minute_rate = total_rate / 1440
    
    # Total active referrals across all levels
    total_active_referrals = sum(active_referrals_by_level.values())
    
    return per_minute_rate, base_rate, total_active_referrals, referral_breakdown

async def update_mined_coins(uid: str):
    """Update user's mined coins based on time elapsed"""
    user = await db.users.find_one({"uid": uid})
    if not user or not user.get("mining_start_time"):
        return 0
    
    mining_start = datetime.fromisoformat(user["mining_start_time"])
    current_time = datetime.now(timezone.utc)
    elapsed_minutes = (current_time - mining_start).total_seconds() / 60
    
    if elapsed_minutes > 0:
        rate_per_minute, _, _, _ = await calculate_mining_rate(uid)
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
    # Check if registration is enabled
    settings = await db.settings.find_one({}, {"_id": 0, "registration_enabled": 1, "registration_message": 1})
    if settings and not settings.get("registration_enabled", True):
        message = settings.get("registration_message", "New user registrations are currently closed. Please check back later.")
        raise HTTPException(status_code=403, detail=message)
    
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
    # Check if registration is enabled
    settings = await db.settings.find_one({}, {"_id": 0, "registration_enabled": 1, "registration_message": 1})
    if settings and not settings.get("registration_enabled", True):
        message = settings.get("registration_message", "New user registrations are currently closed. Please check back later.")
        raise HTTPException(status_code=403, detail=message)
    
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
    }, {"_id": 0})  # Exclude _id to avoid serialization issues
    
    if not user:
        raise HTTPException(status_code=404, detail="User not registered. Please register to continue.")
    
    # Verify password
    if user.get("password_hash"):
        if not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid password")
    
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail=f"Account suspended: {user.get('suspension_reason', 'Contact support')}")
    
    # Check VIP membership expiry and add renewal message
    vip_expiry_message = None
    if user.get("membership_type") == "vip":
        vip_expiry_str = user.get("vip_expiry")
        if vip_expiry_str:
            try:
                vip_expiry = datetime.fromisoformat(vip_expiry_str.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                if vip_expiry < now:
                    days_expired = (now - vip_expiry).days
                    vip_expiry_message = f"⚠️ Your VIP membership expired {days_expired} days ago! Please renew to continue using marketplace, gift vouchers, and bill payment services. PRC mined after expiry will be burned after 5 days."
                    user["vip_expired"] = True
                    user["vip_days_expired"] = days_expired
                    user["vip_expiry_message"] = vip_expiry_message
            except:
                pass
    
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
    
    # Fields that can be updated - comprehensive list
    updatable_fields = [
        # Personal Info
        "first_name", "middle_name", "last_name", "name",
        "gender", "date_of_birth", "bio",
        # Contact Info
        "mobile", "phone", "alternate_mobile", "email",
        "address_line1", "address_line2",
        "state", "district", "taluka", "tahsil", "city", "village", "pincode",
        # Emergency Contact
        "emergency_contact_name", "emergency_contact_number",
        # Documents
        "aadhaar_number", "pan_number", "upi_id",
        # Profile Picture
        "profile_picture",
        # Security Options
        "two_factor_enabled", "login_notifications", "transaction_alerts",
        "biometric_enabled", "session_timeout"
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
        update_data['name'] = ' '.join(filter(None, name_parts))
    
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
    
    # Log mining started activity
    await log_transaction(
        user_id=uid,
        wallet_type="prc",
        transaction_type="mining_started",
        amount=0,
        description="Started 24-hour mining session",
        metadata={
            "session_start": now.isoformat(),
            "session_end": session_end.isoformat()
        }
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
            rate_per_minute, base_rate, active_referrals, referral_breakdown = await calculate_mining_rate(uid)
            mined_this_session = elapsed_minutes * rate_per_minute
        else:
            # Session expired, mark as inactive
            await db.users.update_one(
                {"uid": uid},
                {"$set": {"mining_active": False}}
            )
    
    # Always calculate mining rate (potential rate even if not actively mining)
    rate_per_minute, base_rate, active_referrals, referral_breakdown = await calculate_mining_rate(uid)
    mining_rate_per_hour = rate_per_minute * 60
    
    return {
        "current_balance": user.get("prc_balance", 0),
        "mining_rate": mining_rate_per_hour,  # New field name
        "mining_rate_per_hour": mining_rate_per_hour,  # Backward compatibility
        "base_rate": base_rate,
        "active_referrals": active_referrals,
        "referral_breakdown": referral_breakdown,  # New: multi-level breakdown
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
    rate_per_minute, base_rate, total_active_referrals, referral_breakdown = await calculate_mining_rate(uid)
    mined_amount = elapsed_minutes * rate_per_minute
    
    # Update user balance (free and VIP users)
    new_balance = user.get("prc_balance", 0) + mined_amount
    new_total_mined = user.get("total_mined", 0) + mined_amount
    
    # Calculate expiry date (2 days for free users, never for VIP)
    expiry_date = None if is_vip else (now + timedelta(days=2)).isoformat()
    
    # Add to mining history for burn tracking
    mining_entry = {
        "amount": mined_amount,
        "timestamp": now.isoformat(),
        "burned": False,
        "expires_at": expiry_date,
        "membership_type": membership_type
    }
    
    await db.users.update_one(
        {"uid": uid},
        {
            "$set": {
                "prc_balance": new_balance,
                "total_mined": new_total_mined,
                "mining_start_time": now.isoformat(),  # Reset session start for continuous mining
                "mining_active": True
            },
            "$push": {"mining_history": mining_entry}
        }
    )
    
    # Create transaction record with expiry tracking
    transaction_id = f"txn_{uuid.uuid4()}"
    await db.transactions.insert_one({
        "transaction_id": transaction_id,
        "user_id": uid,
        "type": "mining",  # Changed from transaction_type to type for consistency
        "amount": mined_amount,  # Changed from prc_amount to amount for consistency
        "inr_amount": 0,
        "description": "Mining rewards claimed",
        "timestamp": now.isoformat(),
        "expires_at": expiry_date,  # Track expiry
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
    
    # Return success response
    return {
        "success": True,
        "amount": round(mined_amount, 4),  # Frontend expects 'amount'
        "claimed_amount": round(mined_amount, 4),
        "new_balance": round(new_balance, 4),
        "total_mined": round(new_total_mined, 4),
        "membership_type": membership_type,
        "validity": "2 days" if not is_vip else "lifetime",
        "expires_at": expiry_date,
        "message": f"Successfully claimed {round(mined_amount, 2)} PRC!"
    }

@api_router.get("/user/stats/today/{uid}")
async def get_user_today_stats(uid: str):
    """Get today's PRC earned and spent for a user"""
    try:
        from datetime import datetime, timezone, timedelta
        
        # Get start of today (UTC)
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_iso = today_start.isoformat()
        
        # Define earning transaction types
        earning_types = ["mining", "tap_game", "referral", "cashback", "admin_credit", 
                         "profit_share", "scratch_card_reward", "treasure_hunt_reward", 
                         "delivery_commission", "prc_rain_gain"]
        
        # Define spending transaction types
        spending_types = ["order", "withdrawal", "admin_debit", "delivery_charge", 
                          "scratch_card_purchase", "treasure_hunt_play", "prc_burn", 
                          "bill_payment_request", "gift_voucher_request", "prc_rain_loss"]
        
        # Get today's earning transactions
        earning_txns = await db.transactions.find({
            "user_id": uid,
            "type": {"$in": earning_types},
            "timestamp": {"$gte": today_start_iso}
        }, {"_id": 0, "amount": 1, "type": 1}).to_list(1000)
        
        # Get today's spending transactions
        spending_txns = await db.transactions.find({
            "user_id": uid,
            "type": {"$in": spending_types},
            "timestamp": {"$gte": today_start_iso}
        }, {"_id": 0, "amount": 1, "type": 1}).to_list(1000)
        
        # Calculate totals
        today_earned = sum(txn.get("amount", 0) for txn in earning_txns)
        today_spent = sum(abs(txn.get("amount", 0)) for txn in spending_txns)
        
        # Breakdown by type
        earning_breakdown = {}
        for txn in earning_txns:
            txn_type = txn.get("type", "other")
            earning_breakdown[txn_type] = earning_breakdown.get(txn_type, 0) + txn.get("amount", 0)
        
        spending_breakdown = {}
        for txn in spending_txns:
            txn_type = txn.get("type", "other")
            spending_breakdown[txn_type] = spending_breakdown.get(txn_type, 0) + abs(txn.get("amount", 0))
        
        return {
            "today_prc_earned": round(today_earned, 2),
            "today_prc_spent": round(today_spent, 2),
            "today_net": round(today_earned - today_spent, 2),
            "earning_breakdown": earning_breakdown,
            "spending_breakdown": spending_breakdown,
            "date": today_start.strftime("%Y-%m-%d")
        }
    except Exception as e:
        print(f"Error getting today stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/user/stats/redeemed/{uid}")
async def get_user_redeemed_stats(uid: str):
    """Get total PRC redeemed and its rupee value for a user"""
    try:
        # Get all completed orders for this user
        completed_orders = await db.orders.find(
            {"user_id": uid, "status": "completed"},
            {"_id": 0, "prc_amount": 1, "product_price": 1}
        ).to_list(1000)
        
        total_prc_redeemed = sum(order.get("prc_amount", 0) for order in completed_orders)
        total_value = sum(order.get("product_price", 0) for order in completed_orders)
        
        # Get completed bill payments
        completed_bills = await db.bill_payment_requests.find(
            {"user_id": uid, "status": "completed"},
            {"_id": 0, "total_prc_deducted": 1, "bill_amount": 1}
        ).to_list(1000)
        
        bill_prc = sum(bill.get("total_prc_deducted", 0) for bill in completed_bills)
        bill_value = sum(bill.get("bill_amount", 0) for bill in completed_bills)
        
        # Get completed gift vouchers
        completed_vouchers = await db.gift_voucher_requests.find(
            {"user_id": uid, "status": "completed"},
            {"_id": 0, "total_prc_deducted": 1, "denomination": 1}
        ).to_list(1000)
        
        voucher_prc = sum(voucher.get("total_prc_deducted", 0) for voucher in completed_vouchers)
        voucher_value = sum(voucher.get("denomination", 0) for voucher in completed_vouchers)
        
        # Total calculations
        total_prc_used = total_prc_redeemed + bill_prc + voucher_prc
        total_rupee_value = total_value + bill_value + voucher_value
        
        return {
            "total_prc_used": round(total_prc_used, 2),
            "total_rupee_value": round(total_rupee_value, 2),
            "breakdown": {
                "marketplace": {
                    "prc": round(total_prc_redeemed, 2),
                    "value": round(total_value, 2),
                    "count": len(completed_orders)
                },
                "bill_payments": {
                    "prc": round(bill_prc, 2),
                    "value": round(bill_value, 2),
                    "count": len(completed_bills)
                },
                "gift_vouchers": {
                    "prc": round(voucher_prc, 2),
                    "value": round(voucher_value, 2),
                    "count": len(completed_vouchers)
                }
            }
        }
    except Exception as e:
        print(f"Error getting redeemed stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


    
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
    
    now = datetime.now(timezone.utc)
    
    # Create wallet transaction record
    await db.wallet_transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": uid,
        "type": "credit",
        "wallet_type": "prc",
        "amount": taps_to_add,
        "description": f"Tap game rewards ({taps_to_add} taps)",
        "balance_after": user.get("prc_balance", 0) + taps_to_add,
        "created_at": now.isoformat()
    })
    
    # Also create a transaction record for today's stats tracking
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": uid,
        "type": "tap_game",
        "amount": taps_to_add,
        "description": f"Tap game rewards ({taps_to_add} taps)",
        "timestamp": now.isoformat(),
        "status": "completed"
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

@api_router.get("/referral/multi-level-stats/{uid}")
async def get_multi_level_referral_stats(uid: str):
    """
    Get detailed multi-level referral statistics for a user
    Shows: total, active, inactive count for each level + mining speed bonus
    """
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(hours=24)
    
    # Get multi-level referrals
    referrals_by_level = await get_multi_level_referrals(uid, max_levels=5)
    
    # Get referral bonus settings
    settings = await db.settings.find_one({}, {"_id": 0, "referral_bonus_settings": 1})
    if settings and "referral_bonus_settings" in settings:
        bonus_percentages = {
            'level_1': settings["referral_bonus_settings"].get("level_1", 10),
            'level_2': settings["referral_bonus_settings"].get("level_2", 5),
            'level_3': settings["referral_bonus_settings"].get("level_3", 2.5),
            'level_4': settings["referral_bonus_settings"].get("level_4", 1.5),
            'level_5': settings["referral_bonus_settings"].get("level_5", 1),
        }
    else:
        bonus_percentages = {
            'level_1': 10,
            'level_2': 5,
            'level_3': 2.5,
            'level_4': 1.5,
            'level_5': 1,
        }
    
    # Get base rate for calculating mining speed bonus
    base_rate = await get_base_rate()
    
    level_stats = []
    total_all_levels = 0
    total_active_all = 0
    total_inactive_all = 0
    total_mining_bonus = 0.0
    
    for level_num in range(1, 6):
        level_key = f"level_{level_num}"
        level_users = referrals_by_level.get(level_key, [])
        
        total_count = len(level_users)
        active_count = 0
        inactive_count = 0
        
        for user in level_users:
            last_login = user.get("last_login")
            is_active = False
            
            if last_login:
                try:
                    if isinstance(last_login, str):
                        last_login_dt = datetime.fromisoformat(last_login.replace('Z', '+00:00'))
                    else:
                        last_login_dt = last_login
                    is_active = last_login_dt >= yesterday
                except:
                    pass
            
            if is_active:
                active_count += 1
            else:
                inactive_count += 1
        
        # Calculate mining speed bonus for this level
        bonus_percentage = bonus_percentages.get(level_key, 0)
        level_mining_bonus = active_count * (bonus_percentage / 100) * base_rate
        
        level_stats.append({
            "level": level_num,
            "level_name": f"Level {level_num}",
            "total": total_count,
            "active": active_count,
            "inactive": inactive_count,
            "bonus_percentage": bonus_percentage,
            "mining_speed_bonus": round(level_mining_bonus, 4),
            "mining_speed_bonus_display": f"+{round(level_mining_bonus, 2)} PRC/day"
        })
        
        total_all_levels += total_count
        total_active_all += active_count
        total_inactive_all += inactive_count
        total_mining_bonus += level_mining_bonus
    
    return {
        "user_id": uid,
        "base_mining_rate": base_rate,
        "levels": level_stats,
        "summary": {
            "total_referrals": total_all_levels,
            "total_active": total_active_all,
            "total_inactive": total_inactive_all,
            "total_mining_bonus": round(total_mining_bonus, 4),
            "total_mining_bonus_display": f"+{round(total_mining_bonus, 2)} PRC/day",
            "effective_mining_rate": round(base_rate + total_mining_bonus, 4),
            "effective_mining_rate_display": f"{round(base_rate + total_mining_bonus, 2)} PRC/day"
        },
        "bonus_percentages": bonus_percentages,
        "generated_at": now.isoformat()
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

# ==================== ADMIN VIP PAYMENT VERIFICATION ====================

@api_router.get("/admin/vip-payments")
async def get_admin_vip_payments(status: str = None, page: int = 1, limit: int = 20):
    """Get VIP payments for admin verification"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        
        total = await db.vip_payments.count_documents(query)
        payments = await db.vip_payments.find(
            query, {"_id": 0}
        ).sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Enrich with user data
        for payment in payments:
            user = await db.users.find_one({"uid": payment.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
            if user:
                payment["user_name"] = user.get("name", "Unknown")
                payment["user_email"] = user.get("email", "")
        
        return {
            "payments": payments,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/vip-payment/{payment_id}/approve")
async def approve_vip_payment(payment_id: str, request: Request):
    """Approve VIP payment and activate membership"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        notes = data.get("notes", "")
        
        # Get payment
        payment = await db.vip_payments.find_one({"payment_id": payment_id})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Payment already processed")
        
        user_id = payment.get("user_id")
        plan_type = payment.get("plan_type")
        
        # Calculate VIP expiry
        now = datetime.now(timezone.utc)
        duration_days = {
            "monthly": 30,
            "quarterly": 90,
            "half_yearly": 180,
            "yearly": 365
        }.get(plan_type, 30)
        
        vip_expiry = (now + timedelta(days=duration_days)).isoformat()
        
        # Update user to VIP
        await db.users.update_one(
            {"uid": user_id},
            {
                "$set": {
                    "membership_type": "vip",
                    "vip_expiry": vip_expiry,
                    "vip_activated_at": now.isoformat()
                }
            }
        )
        
        # Update payment status
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {
                "$set": {
                    "status": "approved",
                    "approved_at": now.isoformat(),
                    "approved_by": admin_id,
                    "admin_notes": notes
                }
            }
        )
        
        # Credit to subscription wallet
        await db.company_wallets.update_one(
            {"wallet_type": "subscription"},
            {
                "$inc": {"balance": payment.get("amount", 0), "total_credit": payment.get("amount", 0)},
                "$set": {"last_updated": now.isoformat()}
            },
            upsert=True
        )
        
        # Log activity
        await db.activity_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "action": "vip_payment_approved",
            "user_id": user_id,
            "admin_id": admin_id,
            "payment_id": payment_id,
            "amount": payment.get("amount"),
            "plan_type": plan_type,
            "timestamp": now.isoformat()
        })
        
        return {"success": True, "message": "Payment approved, VIP membership activated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/vip-payment/{payment_id}/reject")
async def reject_vip_payment(payment_id: str, request: Request):
    """Reject VIP payment"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        reason = data.get("reason", "")
        
        # Get payment
        payment = await db.vip_payments.find_one({"payment_id": payment_id})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Payment already processed")
        
        now = datetime.now(timezone.utc)
        
        # Update payment status
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": now.isoformat(),
                    "rejected_by": admin_id,
                    "rejection_reason": reason
                }
            }
        )
        
        # Log activity
        await db.activity_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "action": "vip_payment_rejected",
            "user_id": payment.get("user_id"),
            "admin_id": admin_id,
            "payment_id": payment_id,
            "reason": reason,
            "timestamp": now.isoformat()
        })
        
        return {"success": True, "message": "Payment rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== KYC ROUTES ==========
@api_router.post("/kyc/submit/{uid}", response_model=KYCDocument)
async def submit_kyc(uid: str, kyc_data: KYCSubmit):
    """Submit KYC documents"""
    kyc_doc = KYCDocument(
        user_id=uid,
        aadhaar_front=kyc_data.aadhaar_front_base64,
        aadhaar_back=kyc_data.aadhaar_back_base64,
        aadhaar_number=kyc_data.aadhaar_number,
        pan_front=kyc_data.pan_front_base64,
        pan_number=kyc_data.pan_number
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
    
    # Check marketplace access (VIP required and not expired)
    marketplace_check = await check_vip_marketplace_access(user_id)
    if not marketplace_check["allowed"]:
        raise HTTPException(status_code=403, detail=marketplace_check["reason"])
    
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
    
    # Get cashback balance - prioritize cashback_wallet_balance as the primary field
    cashback_balance = user.get("cashback_wallet_balance", 0)
    if cashback_balance == 0:
        # Fall back to legacy field names if cashback_wallet_balance is not set
        cashback_balance = user.get("cashback_balance", user.get("cash_wallet_balance", 0))
    
    return {
        "cashback_balance": cashback_balance,
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
async def get_wallet_transactions(uid: str, wallet_type: str = None, page: int = 1, limit: int = 10):
    """Get user's comprehensive wallet transaction history with pagination (default 10 per page)"""
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
    total_credit = sum(t["amount"] for t in transactions if t["type"] in ["mining", "tap_game", "referral", "cashback", "withdrawal_rejected", "admin_credit", "profit_share", "scratch_card_reward", "treasure_hunt_reward"])
    total_debit = sum(t["amount"] for t in transactions if t["type"] in ["order", "withdrawal", "admin_debit", "delivery_charge", "scratch_card_purchase", "treasure_hunt_play"])
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "total_credit": total_credit,
        "total_debit": total_debit,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }

@api_router.get("/transactions/user/{uid}")
async def get_user_transactions_simple(uid: str, page: int = 1, limit: int = 5):
    """Get recent transactions for user dashboard with pagination - 5 records per page"""
    try:
        skip = (page - 1) * limit
        
        # Get total count
        total = await db.transactions.count_documents({"user_id": uid})
        total_pages = (total + limit - 1) // limit if total > 0 else 1
        
        # Get transactions for current page
        transactions = await db.transactions.find(
            {"user_id": uid},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Format for dashboard compatibility with detailed activity labels
        formatted = []
        for txn in transactions:
            txn_type = txn.get("type", "unknown")
            
            # Enhanced descriptions for different activity types
            if txn_type == "mining":
                description = "Claimed mining rewards"
            elif txn_type == "mining_started":
                description = "Started mining session"
            elif txn_type == "marketplace_purchase" or txn_type == "order":
                description = txn.get("description", "Marketplace purchase")
            elif txn_type == "bill_payment_request":
                description = txn.get("description", "Bill payment request submitted")
            elif txn_type == "gift_voucher_request":
                description = txn.get("description", "Gift voucher request submitted")
            elif txn_type == "referral_bonus" or txn_type == "referral":
                description = "Referral bonus earned"
            elif txn_type == "tap_game":
                description = "Tap game rewards"
            elif txn_type == "delivery_commission":
                description = "Delivery commission earned"
            elif txn_type == "delivery_charge":
                description = txn.get("description", "Delivery charge deducted")
            else:
                description = txn.get("description", txn_type.replace("_", " ").title())
            
            formatted.append({
                "type": txn_type,
                "amount": txn.get("amount", 0),
                "timestamp": txn.get("created_at"),
                "description": description
            })
        
        return {
            "transactions": formatted,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }
    except Exception as e:
        print(f"Error fetching transactions: {e}")
        return {
            "transactions": [],
            "pagination": {
                "page": 1,
                "limit": 5,
                "total": 0,
                "total_pages": 1,
                "has_next": False,
                "has_prev": False
            }
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
    
    # Calculate Total PRC in circulation (sum of all user balances)
    prc_pipeline = [
        {"$group": {"_id": None, "total_prc": {"$sum": "$prc_balance"}}}
    ]
    prc_result = await db.users.aggregate(prc_pipeline).to_list(1)
    total_prc_in_circulation = prc_result[0]["total_prc"] if prc_result else 0
    
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
        "total_prc": round(total_prc_in_circulation, 2),
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
    
    # Get plan type and validate amount
    plan_type = data.get("plan_type", "monthly")
    
    # Duration mapping based on plan type
    plan_details = {
        "monthly": {"days": 30, "price": 299},
        "quarterly": {"days": 90, "price": 897},
        "half_yearly": {"days": 180, "price": 1794},
        "yearly": {"days": 365, "price": 3588}
    }
    
    if plan_type not in plan_details:
        plan_type = "monthly"
    
    expected_price = plan_details[plan_type]["price"]
    duration_days = plan_details[plan_type]["days"]
    
    # Check if user already has pending payment
    existing = await db.vip_payments.find_one({
        "user_id": data["user_id"],
        "status": "pending"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending payment request")
    
    # Create payment record with plan details
    payment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Plan name mapping
    plan_names = {
        "monthly": "Monthly VIP Plan",
        "quarterly": "Quarterly VIP Plan", 
        "half_yearly": "Half-Yearly VIP Plan",
        "yearly": "Yearly VIP Plan"
    }
    
    payment_record = {
        "payment_id": payment_id,
        "user_id": data["user_id"],
        "amount": float(data["amount"]),
        "plan_type": plan_type,
        "plan_name": plan_names.get(plan_type, "VIP Membership"),
        "duration_days": duration_days,
        "date": data["date"],
        "time": data["time"],
        "utr_number": data["utr_number"],
        "screenshot_url": data.get("screenshot_url", ""),
        "payment_method": data.get("payment_method", "UPI"),
        "status": "pending",
        "submitted_at": now.isoformat(),
        "created_at": now.isoformat(),
        "approved_at": None,
        "approved_by": None,
        "admin_notes": None,
        "validity_start": None,
        "validity_end": None,
        "auto_renew": data.get("auto_renew", False),
        "next_renewal_date": None,
        "invoice_number": f"INV-{now.strftime('%Y%m%d')}-{payment_id[:8].upper()}"
    }
    
    await db.vip_payments.insert_one(payment_record)
    
    return {
        "message": f"Payment submitted successfully for {plan_type} plan ({duration_days} days). Please wait for admin approval.",
        "payment_id": payment_id,
        "status": "pending",
        "plan_type": plan_type,
        "duration_days": duration_days
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
    admin_notes = data.get("admin_notes", "")
    
    if action == "approve":
        # Get plan type from payment - IMPORTANT: default to "monthly" NOT "yearly"
        plan_type = payment.get("plan_type", "monthly")
        
        # Duration mapping based on plan type
        duration_mapping = {
            "monthly": 30,
            "quarterly": 90,
            "half_yearly": 180,
            "yearly": 365
        }
        
        # Get duration days from payment record first, then from mapping
        # CRITICAL: Always use the correct duration based on what user paid for
        duration_days = payment.get("duration_days")
        if duration_days is None:
            duration_days = duration_mapping.get(plan_type, 30)  # Default to 30 days (monthly)
        
        # Validate duration_days is a valid number
        try:
            duration_days = int(duration_days)
        except (TypeError, ValueError):
            duration_days = duration_mapping.get(plan_type, 30)
        
        # Calculate validity dates
        validity_start = now
        validity_end = now + timedelta(days=duration_days)
        
        # Calculate next renewal date (same as validity end for now)
        next_renewal = validity_end
        
        # Update payment status with all details
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "approved",
                "approved_at": now.isoformat(),
                "admin_notes": admin_notes or "Payment verified and approved",
                "validity_start": validity_start.isoformat(),
                "validity_end": validity_end.isoformat(),
                "next_renewal_date": next_renewal.isoformat()
            }}
        )
        
        # Update user membership
        await db.users.update_one(
            {"uid": payment["user_id"]},
            {"$set": {
                "membership_type": "vip",
                "membership_expiry": validity_end.isoformat(),
                "vip_plan_type": plan_type,
                "vip_start_date": validity_start.isoformat(),
                "auto_renew": payment.get("auto_renew", False),
                "updated_at": now.isoformat()
            }}
        )
        
        return {
            "message": f"Payment approved. User upgraded to VIP ({plan_type} plan - {duration_days} days).",
            "membership_expiry": validity_end.isoformat(),
            "validity_start": validity_start.isoformat(),
            "validity_end": validity_end.isoformat(),
            "plan_type": plan_type,
            "duration_days": duration_days
        }
    else:
        # Reject payment with admin notes
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "rejected",
                "rejected_at": now.isoformat(),
                "admin_notes": admin_notes or "Payment rejected"
            }}
        )
        
        return {"message": "Payment rejected", "admin_notes": admin_notes}

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
    
    # Check VIP membership and expiry for marketplace access
    access_check = await check_vip_service_access(user_id, "marketplace")
    if not access_check["allowed"]:
        raise HTTPException(status_code=403, detail=access_check["reason"])
    
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
    """
    Distribute 15% of order PRC value to stockist hierarchy
    UPDATED: Changed from 10% to 15%, and credits PRC instead of cash
    15% of order PRC is deducted from user and distributed as PRC to outlet, sub stockist, master stockist
    """
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
    
    # Calculate commission: 15% of order PRC value (UPDATED from 10% to 15%)
    # Support both legacy (prc_amount) and new (total_prc) order formats
    total_prc = order.get("total_prc", 0) or order.get("prc_amount", 0)
    if total_prc <= 0:
        return {"message": "No PRC value to distribute commission"}
    
    # UPDATED: 15% delivery charge in PRC (no conversion, stays as PRC)
    delivery_charge_prc = total_prc * 0.15  # 15% of order PRC
    
    # Get user who placed the order
    user_id = order.get("user_id")
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Deduct 15% PRC from user's balance
    user_prc_balance = user.get("prc_balance", 0)
    if user_prc_balance < delivery_charge_prc:
        # User doesn't have enough PRC for delivery charge - mark as pending
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": {"delivery_charge_pending": True, "delivery_charge_amount": delivery_charge_prc}}
        )
        return {
            "message": "Delivery charge pending - insufficient user PRC balance",
            "required": delivery_charge_prc,
            "available": user_prc_balance,
            "status": "pending"
        }
    
    # Deduct PRC from user
    new_user_balance = user_prc_balance - delivery_charge_prc
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"prc_balance": new_user_balance}}
    )
    
    # Log deduction transaction
    await log_transaction(
        user_id=user_id,
        wallet_type="prc",
        transaction_type="delivery_charge",
        amount=delivery_charge_prc,
        description=f"15% delivery charge for order #{order_id[:8]}",
        metadata={"order_id": order_id, "percentage": 15},
        related_id=order_id,
        related_type="order"
    )
    
    # Get distribution split (default: Master 20%, Sub 30%, Outlet 50%)
    # UPDATED: Removed company cut, split entire 15% among stockists
    config = await db.system_config.find_one({"config_type": "delivery"})
    if not config:
        split = {"master": 20, "sub": 30, "outlet": 50}  # Total = 100% of the 15% delivery charge
    else:
        split = config.get("distribution_split", {"master": 20, "sub": 30, "outlet": 50})
    
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
    
    # Calculate distribution amounts in PRC (not cash)
    distributions = {}
    for entity, percentage in split.items():
        amount_prc = (delivery_charge_prc * percentage) / 100
        distributions[entity] = amount_prc
    
    # Create commission entries and credit wallets
    commission_records = []
    now = datetime.now(timezone.utc).isoformat()
    credited_entities = []
    
    # UPDATED: Credit PRC to Outlet (not profit_wallet)
    if distributions.get("outlet", 0) > 0 and outlet_user:
        amount_prc = distributions["outlet"]
        
        # Log transaction (this also updates PRC balance)
        await log_transaction(
            user_id=outlet_id,
            wallet_type="prc",
            transaction_type="delivery_commission",
            amount=round(amount_prc, 2),
            description=f"15% delivery charge commission from order #{order_id[:8]}",
            metadata={
                "order_id": order_id,
                "entity_type": "outlet",
                "commission_percentage": split.get("outlet", 0),
                "total_delivery_charge": round(delivery_charge_prc, 2)
            },
            related_id=order_id,
            related_type="order"
        )
        
        credited_entities.append(f"Outlet ({outlet_user.get('name', 'Unknown')}): {round(amount_prc, 2)} PRC")
    
        commission_record = {
            "commission_id": str(uuid.uuid4()),
            "order_id": order_id,
            "entity_type": "outlet",
            "entity_id": outlet_id,
            "entity_name": outlet_user.get("name", "Unknown"),
            "amount_prc": round(amount_prc, 2),
            "type": "delivery_commission",
            "status": "credited",
            "created_at": now
        }
        commission_records.append(commission_record)
    
    # UPDATED: Credit PRC to Sub Stockist (not profit_wallet)
    if distributions.get("sub", 0) > 0 and sub_stockist_user:
        amount_prc = distributions["sub"]
        
        # Log transaction (this also updates PRC balance)
        await log_transaction(
            user_id=sub_stockist_id,
            wallet_type="prc",
            transaction_type="delivery_commission",
            amount=round(amount_prc, 2),
            description=f"15% delivery charge commission from order #{order_id[:8]}",
            metadata={
                "order_id": order_id,
                "entity_type": "sub_stockist",
                "commission_percentage": split.get("sub", 0),
                "total_delivery_charge": round(delivery_charge_prc, 2)
            },
            related_id=order_id,
            related_type="order"
        )
        
        credited_entities.append(f"Sub Stockist ({sub_stockist_user.get('name', 'Unknown')}): {round(amount_prc, 2)} PRC")
    
        commission_record = {
            "commission_id": str(uuid.uuid4()),
            "order_id": order_id,
            "entity_type": "sub_stockist",
            "entity_id": sub_stockist_id,
            "entity_name": sub_stockist_user.get("name", "Unknown"),
            "amount_prc": round(amount_prc, 2),
            "type": "delivery_commission",
            "status": "credited",
            "created_at": now
        }
        commission_records.append(commission_record)
    
    # UPDATED: Credit PRC to Master Stockist (not profit_wallet)
    if distributions.get("master", 0) > 0 and master_stockist_user:
        amount_prc = distributions["master"]
        
        # Log transaction (this also updates PRC balance)
        await log_transaction(
            user_id=master_stockist_id,
            wallet_type="prc",
            transaction_type="delivery_commission",
            amount=round(amount_prc, 2),
            description=f"15% delivery charge commission from order #{order_id[:8]}",
            metadata={
                "order_id": order_id,
                "entity_type": "master_stockist",
                "commission_percentage": split.get("master", 0),
                "total_delivery_charge": round(delivery_charge_prc, 2)
            },
            related_id=order_id,
            related_type="order"
        )
        
        credited_entities.append(f"Master Stockist ({master_stockist_user.get('name', 'Unknown')}): {round(amount_prc, 2)} PRC")
        
        commission_record = {
            "commission_id": str(uuid.uuid4()),
            "order_id": order_id,
            "entity_type": "master_stockist",
            "entity_id": master_stockist_id,
            "entity_name": master_stockist_user.get("name", "Unknown"),
            "amount_prc": round(amount_prc, 2),
            "type": "delivery_commission",
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
            "delivery_charge_prc": round(delivery_charge_prc, 2),
            "commission_distributed_at": now,
            "credited_entities": credited_entities
        }}
    )
    
    return {
        "message": "15% delivery charge distributed successfully as PRC to stockist hierarchy",
        "order_id": order_id,
        "delivery_charge_prc": round(delivery_charge_prc, 2),
        "user_prc_deducted": round(delivery_charge_prc, 2),
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
    membership_expiry: Optional[str] = None
    vip_plan_type: Optional[str] = None
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
    if request.membership_expiry:
        # Convert date string to ISO format datetime
        try:
            expiry_date = datetime.fromisoformat(request.membership_expiry.replace('Z', '+00:00'))
            update_data["membership_expiry"] = expiry_date.isoformat()
        except:
            # If it's a date-only string (YYYY-MM-DD), add time
            update_data["membership_expiry"] = f"{request.membership_expiry}T23:59:59+00:00"
    if request.vip_plan_type:
        update_data["vip_plan_type"] = request.vip_plan_type
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

# ========== SCRATCH CARD GAME ENDPOINTS ==========

import random

class ScratchCardPurchase(BaseModel):
    """Scratch Card Purchase Model"""
    card_type: int  # 10, 50, or 100 PRC

@api_router.get("/scratch-cards/available")
async def get_available_scratch_cards():
    """Get available scratch card types"""
    return {
        "cards": [
            {
                "id": 1,
                "cost": 10,
                "name": "Bronze Scratch Card",
                "description": "Win 0-10% cashback (Free) or 10-50% (VIP)",
                "min_cashback_free": 0,
                "max_cashback_free": 10,
                "min_cashback_vip": 10,
                "max_cashback_vip": 50
            },
            {
                "id": 2,
                "cost": 50,
                "name": "Silver Scratch Card",
                "description": "Win 0-10% cashback (Free) or 10-50% (VIP)",
                "min_cashback_free": 0,
                "max_cashback_free": 10,
                "min_cashback_vip": 10,
                "max_cashback_vip": 50
            },
            {
                "id": 3,
                "cost": 100,
                "name": "Gold Scratch Card",
                "description": "Win 0-10% cashback (Free) or 10-50% (VIP)",
                "min_cashback_free": 0,
                "max_cashback_free": 10,
                "min_cashback_vip": 10,
                "max_cashback_vip": 50
            }
        ]
    }

def generate_scratch_reward(is_vip: bool, card_cost: int):
    """Generate random scratch card reward"""
    if is_vip:
        # VIP users: 10%, 20%, 30%, 40%, 50%
        cashback_percentages = [10, 20, 30, 40, 50]
        # Weighted probabilities (50% gets lower rewards)
        weights = [40, 30, 20, 7, 3]  # 40% chance of 10%, 3% chance of 50%
        cashback_percentage = random.choices(cashback_percentages, weights=weights, k=1)[0]
    else:
        # Free users: 0% to 10%
        cashback_percentages = [0, 2, 5, 7, 10]
        weights = [40, 25, 20, 10, 5]  # 40% chance of 0%, 5% chance of 10%
        cashback_percentage = random.choices(cashback_percentages, weights=weights, k=1)[0]
    
    # Calculate cashback amount in INR (10 PRC = ₹1)
    prc_value_inr = card_cost / 10
    cashback_inr = (prc_value_inr * cashback_percentage) / 100
    
    return {
        "cashback_percentage": cashback_percentage,
        "cashback_inr": round(cashback_inr, 2),
        "card_cost_prc": card_cost,
        "card_value_inr": prc_value_inr
    }

@api_router.post("/scratch-cards/purchase")
async def purchase_scratch_card(purchase: ScratchCardPurchase, uid: str = None):
    """Purchase and scratch a card"""
    try:
        if not uid:
            raise HTTPException(status_code=400, detail="User ID required")
        
        # Validate card type
        if purchase.card_type not in [10, 50, 100]:
            raise HTTPException(status_code=400, detail="Invalid card type. Must be 10, 50, or 100 PRC")
        
        # Get user
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if VIP
        is_vip = user.get("membership_type") == "vip"
        
        # Check PRC balance
        current_balance = user.get("prc_balance", 0)
        if current_balance < purchase.card_type:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient PRC balance. You need {purchase.card_type} PRC but have {current_balance} PRC"
            )
        
        # Deduct PRC
        new_balance = current_balance - purchase.card_type
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"prc_balance": new_balance}}
        )
        
        # Generate reward
        reward = generate_scratch_reward(is_vip, purchase.card_type)
        
        # Get current cashback wallet balance (for response only)
        cashback_wallet_balance = user.get("cashback_wallet_balance", 0)
        
        # Log transaction in transactions collection - this function automatically updates the wallet balance
        # DO NOT manually update wallet here as log_transaction() handles it
        transaction_id = await log_transaction(
            user_id=uid,
            wallet_type="cashback_wallet",
            transaction_type="scratch_card_reward",
            amount=reward["cashback_inr"],
            description=f"Scratch Card ({purchase.card_type} PRC) - Won {reward['cashback_percentage']}% cashback",
            metadata={
                "card_type": purchase.card_type,
                "card_value_inr": reward["card_value_inr"],
                "cashback_percentage": reward["cashback_percentage"],
                "is_vip": is_vip,
                "prc_spent": purchase.card_type
            },
            related_type="scratch_card"
        )
        
        # Calculate new balance for response
        new_cashback_wallet_balance = cashback_wallet_balance + reward["cashback_inr"]
        
        # Record in scratch_cards collection for game history
        scratch_card_record = {
            "transaction_id": transaction_id,
            "uid": uid,
            "card_type": purchase.card_type,
            "is_vip": is_vip,
            "cashback_percentage": reward["cashback_percentage"],
            "cashback_inr": reward["cashback_inr"],
            "prc_spent": purchase.card_type,
            "prc_balance_before": current_balance,
            "prc_balance_after": new_balance,
            "cashback_wallet_before": cashback_wallet_balance,
            "cashback_wallet_after": new_cashback_wallet_balance,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "game_type": "scratch_card"
        }
        
        await db.scratch_cards.insert_one(scratch_card_record)
        
        # Log activity
        await db.activity_logs.insert_one({
            "uid": uid,
            "action": "scratch_card_played",
            "details": {
                "card_cost": purchase.card_type,
                "cashback_won": reward["cashback_inr"],
                "percentage": reward["cashback_percentage"]
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "message": f"🎉 You won {reward['cashback_percentage']}% cashback!",
            "transaction_id": transaction_id,
            "card_cost_prc": purchase.card_type,
            "card_value_inr": reward["card_value_inr"],
            "cashback_percentage": reward["cashback_percentage"],
            "cashback_won_inr": reward["cashback_inr"],
            "new_prc_balance": new_balance,
            "new_cashback_wallet": new_cashback_wallet_balance,
            "is_vip": is_vip
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/scratch-cards/history/{uid}")
async def get_scratch_card_history(uid: str, limit: int = 20):
    """Get user's scratch card history"""
    try:
        history = await db.scratch_cards.find(
            {"uid": uid},
            {"_id": 0}  # Exclude _id field to avoid ObjectId serialization issues
        ).sort("timestamp", -1).limit(limit).to_list(length=limit)
        
        # Calculate statistics
        total_spent = sum(card.get("prc_spent", 0) for card in history)
        total_won = sum(card.get("cashback_inr", 0) for card in history)
        
        return {
            "history": history,
            "stats": {
                "total_cards_played": len(history),
                "total_prc_spent": total_spent,
                "total_cashback_won": round(total_won, 2),
                "avg_cashback_per_card": round(total_won / len(history), 2) if history else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== END SCRATCH CARD GAME ENDPOINTS ==========

# ========== ADMIN PRC ANALYTICS ENDPOINTS ==========

@api_router.get("/admin/prc-analytics")
async def get_prc_analytics():
    """Get platform-wide PRC statistics for admin dashboard"""
    try:
        # Get all users
        users = await db.users.find().to_list(length=None)
        
        # Calculate total PRC mined (sum of all user balances + spent PRC)
        total_current_balance = sum(user.get("prc_balance", 0) for user in users)
        
        # Calculate PRC consumed from various sources
        # 1. Marketplace orders
        orders = await db.orders.find().to_list(length=None)
        prc_spent_marketplace = sum(order.get("prc_amount", 0) for order in orders)
        
        # 2. Treasure Hunt
        treasure_hunts = await db.treasure_hunt_progress.find().to_list(length=None)
        prc_spent_treasure_hunt = sum(th.get("total_prc_spent", 0) for th in treasure_hunts)
        
        # 3. Scratch Cards
        scratch_cards = await db.scratch_cards.find().to_list(length=None)
        prc_spent_scratch_cards = sum(sc.get("prc_spent", 0) for sc in scratch_cards)
        
        # 4. VIP memberships
        vip_users = [u for u in users if u.get("membership_type") == "vip"]
        prc_spent_vip = len(vip_users) * 1000  # Assuming 1000 PRC per VIP
        
        # Calculate total consumed
        total_prc_consumed = (
            prc_spent_marketplace + 
            prc_spent_treasure_hunt + 
            prc_spent_scratch_cards + 
            prc_spent_vip
        )
        
        # Calculate total mined (current balance + consumed)
        total_prc_mined = total_current_balance + total_prc_consumed
        
        # Get daily statistics for last 30 days
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        
        # Daily mining data
        daily_mining = {}
        mining_logs = await db.activity_logs.find({
            "action": "mining_completed",
            "timestamp": {"$gte": thirty_days_ago.isoformat()}
        }).to_list(length=None)
        
        for log in mining_logs:
            date = log.get("timestamp", "")[:10]  # Get YYYY-MM-DD
            prc_earned = log.get("details", {}).get("prc_earned", 0)
            if date in daily_mining:
                daily_mining[date] += prc_earned
            else:
                daily_mining[date] = prc_earned
        
        # Daily consumption data
        daily_consumption = {}
        
        # From orders
        for order in orders:
            if order.get("created_at"):
                date = order.get("created_at")[:10]
                if date >= thirty_days_ago.isoformat()[:10]:
                    prc = order.get("prc_amount", 0)
                    if date in daily_consumption:
                        daily_consumption[date] += prc
                    else:
                        daily_consumption[date] = prc
        
        # From treasure hunts
        for th in treasure_hunts:
            if th.get("started_at"):
                date = th.get("started_at")[:10]
                if date >= thirty_days_ago.isoformat()[:10]:
                    prc = th.get("total_prc_spent", 0)
                    if date in daily_consumption:
                        daily_consumption[date] += prc
                    else:
                        daily_consumption[date] = prc
        
        # From scratch cards
        for sc in scratch_cards:
            if sc.get("timestamp"):
                date = sc.get("timestamp")[:10]
                if date >= thirty_days_ago.isoformat()[:10]:
                    prc = sc.get("prc_spent", 0)
                    if date in daily_consumption:
                        daily_consumption[date] += prc
                    else:
                        daily_consumption[date] = prc
        
        # Create timeline data
        timeline_data = []
        current_date = thirty_days_ago.date()
        end_date = datetime.now(timezone.utc).date()
        
        while current_date <= end_date:
            date_str = current_date.isoformat()
            timeline_data.append({
                "date": date_str,
                "mined": daily_mining.get(date_str, 0),
                "consumed": daily_consumption.get(date_str, 0)
            })
            current_date += timedelta(days=1)
        
        # Breakdown of consumption
        consumption_breakdown = {
            "marketplace": prc_spent_marketplace,
            "treasure_hunt": prc_spent_treasure_hunt,
            "scratch_cards": prc_spent_scratch_cards,
            "vip_memberships": prc_spent_vip
        }
        
        return {
            "total_prc_mined": round(total_prc_mined, 2),
            "total_prc_consumed": round(total_prc_consumed, 2),
            "total_prc_in_circulation": round(total_current_balance, 2),
            "consumption_rate": round((total_prc_consumed / total_prc_mined * 100), 2) if total_prc_mined > 0 else 0,
            "consumption_breakdown": consumption_breakdown,
            "timeline_data": timeline_data[-30:],  # Last 30 days
            "total_users": len(users),
            "vip_users": len(vip_users),
            "avg_prc_per_user": round(total_current_balance / len(users), 2) if users else 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/prc-analytics/detailed")
async def get_detailed_prc_analytics(period: str = "month"):
    """Get detailed PRC analytics with burn data, profit/loss, and time-based breakdown"""
    try:
        now = datetime.now(timezone.utc)
        
        # Calculate date ranges based on period
        if period == "day":
            start_date = now - timedelta(days=1)
            prev_start = now - timedelta(days=2)
            prev_end = start_date
        elif period == "week":
            start_date = now - timedelta(weeks=1)
            prev_start = now - timedelta(weeks=2)
            prev_end = start_date
        elif period == "year":
            start_date = now - timedelta(days=365)
            prev_start = now - timedelta(days=730)
            prev_end = start_date
        else:  # month (default)
            start_date = now - timedelta(days=30)
            prev_start = now - timedelta(days=60)
            prev_end = start_date
        
        start_str = start_date.isoformat()
        prev_start_str = prev_start.isoformat()
        prev_end_str = prev_end.isoformat()
        
        # Get all transactions for current period (check both timestamp and created_at fields)
        current_transactions = await db.transactions.find({
            "$or": [
                {"timestamp": {"$gte": start_str}},
                {"created_at": {"$gte": start_str}}
            ]
        }, {"_id": 0}).to_list(length=None)
        
        # Get all transactions for previous period (for comparison)
        prev_transactions = await db.transactions.find({
            "$or": [
                {"timestamp": {"$gte": prev_start_str, "$lt": prev_end_str}},
                {"created_at": {"$gte": prev_start_str, "$lt": prev_end_str}}
            ]
        }, {"_id": 0}).to_list(length=None)
        
        # Calculate PRC Created (mining, referral bonuses, cashback, admin credits)
        credit_types = ["mining", "referral_bonus", "cashback", "admin_credit", "vip_bonus", "signup_bonus", "scratch_card_win", "treasure_hunt_win", "prc_rain_gain"]
        
        prc_created_current = sum(t.get("amount", 0) for t in current_transactions if t.get("type") in credit_types)
        prc_created_prev = sum(t.get("amount", 0) for t in prev_transactions if t.get("type") in credit_types)
        
        # Calculate PRC Used (orders, games, services)
        debit_types = ["order", "withdrawal", "scratch_card_purchase", "treasure_hunt_play", "bill_payment_request", "gift_voucher_request", "delivery_charge", "prc_rain_loss", "prc_burn"]
        
        prc_used_current = sum(abs(t.get("amount", 0)) for t in current_transactions if t.get("type") in debit_types)
        prc_used_prev = sum(abs(t.get("amount", 0)) for t in prev_transactions if t.get("type") in debit_types)
        
        # Calculate PRC Burned
        prc_burned_current = sum(abs(t.get("amount", 0)) for t in current_transactions if t.get("type") == "prc_burn")
        prc_burned_prev = sum(abs(t.get("amount", 0)) for t in prev_transactions if t.get("type") == "prc_burn")
        
        # Get all users for balance calculation
        users = await db.users.find({}, {"_id": 0, "prc_balance": 1, "membership_type": 1}).to_list(length=None)
        total_in_circulation = sum(u.get("prc_balance", 0) for u in users)
        vip_user_count = len([u for u in users if u.get("membership_type") == "vip"])
        
        # Calculate Profit/Loss (Platform perspective)
        # Profit = PRC Used + PRC Burned - PRC Created (ideally should be positive or balanced)
        profit_loss_current = (prc_used_current + prc_burned_current) - prc_created_current
        profit_loss_prev = (prc_used_prev + prc_burned_prev) - prc_created_prev
        
        # Get revenue from VIP memberships (actual money)
        # Check both approved_at and created_at fields for date filtering
        vip_payments = await db.vip_payments.find({
            "status": "approved",
            "$or": [
                {"approved_at": {"$gte": start_str}},
                {"created_at": {"$gte": start_str}},
                {"updated_at": {"$gte": start_str}}
            ]
        }, {"_id": 0, "amount": 1}).to_list(length=None)
        vip_revenue_current = sum(p.get("amount", 0) for p in vip_payments)
        
        vip_payments_prev = await db.vip_payments.find({
            "status": "approved",
            "$or": [
                {"approved_at": {"$gte": prev_start_str, "$lt": prev_end_str}},
                {"created_at": {"$gte": prev_start_str, "$lt": prev_end_str}},
                {"updated_at": {"$gte": prev_start_str, "$lt": prev_end_str}}
            ]
        }, {"_id": 0, "amount": 1}).to_list(length=None)
        vip_revenue_prev = sum(p.get("amount", 0) for p in vip_payments_prev)
        
        # Calculate percentage changes
        def calc_change(current, prev):
            if prev == 0:
                return 100 if current > 0 else 0
            return round(((current - prev) / prev) * 100, 1)
        
        # Build daily/weekly chart data based on period
        chart_data = []
        if period == "day":
            # Hourly data for last 24 hours
            for i in range(24):
                hour_start = now - timedelta(hours=24-i)
                hour_end = now - timedelta(hours=23-i)
                hour_str_start = hour_start.isoformat()
                hour_str_end = hour_end.isoformat()
                
                hour_created = sum(t.get("amount", 0) for t in current_transactions 
                    if t.get("type") in credit_types and 
                    hour_str_start <= t.get("timestamp", t.get("created_at", "")) < hour_str_end)
                hour_used = sum(abs(t.get("amount", 0)) for t in current_transactions 
                    if t.get("type") in debit_types and 
                    hour_str_start <= t.get("timestamp", t.get("created_at", "")) < hour_str_end)
                hour_burned = sum(abs(t.get("amount", 0)) for t in current_transactions 
                    if t.get("type") == "prc_burn" and 
                    hour_str_start <= t.get("timestamp", t.get("created_at", "")) < hour_str_end)
                
                chart_data.append({
                    "label": hour_start.strftime("%H:00"),
                    "created": round(hour_created, 2),
                    "used": round(hour_used, 2),
                    "burned": round(hour_burned, 2)
                })
        else:
            # Daily data
            days_count = 7 if period == "week" else (365 if period == "year" else 30)
            step = 1 if period in ["day", "week"] else (30 if period == "year" else 1)
            
            for i in range(0, days_count, step):
                day_start = now - timedelta(days=days_count-i)
                day_end = now - timedelta(days=days_count-i-step)
                day_str_start = day_start.isoformat()[:10]
                day_str_end = day_end.isoformat()[:10]
                
                day_created = sum(t.get("amount", 0) for t in current_transactions 
                    if t.get("type") in credit_types and 
                    t.get("timestamp", t.get("created_at", ""))[:10] >= day_str_start and t.get("timestamp", t.get("created_at", ""))[:10] < day_str_end)
                day_used = sum(abs(t.get("amount", 0)) for t in current_transactions 
                    if t.get("type") in debit_types and 
                    t.get("timestamp", t.get("created_at", ""))[:10] >= day_str_start and t.get("timestamp", t.get("created_at", ""))[:10] < day_str_end)
                day_burned = sum(abs(t.get("amount", 0)) for t in current_transactions 
                    if t.get("type") == "prc_burn" and 
                    t.get("timestamp", t.get("created_at", ""))[:10] >= day_str_start and t.get("timestamp", t.get("created_at", ""))[:10] < day_str_end)
                
                label = day_start.strftime("%d %b") if period != "year" else day_start.strftime("%b %Y")
                chart_data.append({
                    "label": label,
                    "created": round(day_created, 2),
                    "used": round(day_used, 2),
                    "burned": round(day_burned, 2)
                })
        
        # Usage breakdown by category
        usage_breakdown = []
        category_map = {
            "order": "Marketplace Orders",
            "scratch_card_purchase": "Scratch Cards",
            "treasure_hunt_play": "Treasure Hunt",
            "bill_payment_request": "Bill Payments",
            "gift_voucher_request": "Gift Vouchers",
            "withdrawal": "Withdrawals",
            "delivery_charge": "Delivery Charges",
            "prc_rain_loss": "PRC Rain Loss"
        }
        
        for txn_type, label in category_map.items():
            amount = sum(abs(t.get("amount", 0)) for t in current_transactions if t.get("type") == txn_type)
            if amount > 0:
                usage_breakdown.append({
                    "category": label,
                    "amount": round(amount, 2)
                })
        
        # Source breakdown (where PRC comes from)
        source_breakdown = []
        source_map = {
            "mining": "Mining",
            "referral_bonus": "Referral Bonus",
            "cashback": "Cashback",
            "admin_credit": "Admin Credit",
            "vip_bonus": "VIP Bonus",
            "signup_bonus": "Signup Bonus",
            "scratch_card_win": "Scratch Card Wins",
            "treasure_hunt_win": "Treasure Hunt Wins",
            "prc_rain_gain": "PRC Rain Gain"
        }
        
        for txn_type, label in source_map.items():
            amount = sum(t.get("amount", 0) for t in current_transactions if t.get("type") == txn_type)
            if amount > 0:
                source_breakdown.append({
                    "source": label,
                    "amount": round(amount, 2)
                })
        
        return {
            "period": period,
            "summary": {
                "prc_created": round(prc_created_current, 2),
                "prc_created_change": calc_change(prc_created_current, prc_created_prev),
                "prc_used": round(prc_used_current, 2),
                "prc_used_change": calc_change(prc_used_current, prc_used_prev),
                "prc_burned": round(prc_burned_current, 2),
                "prc_burned_change": calc_change(prc_burned_current, prc_burned_prev),
                "prc_in_circulation": round(total_in_circulation, 2),
                "net_prc_flow": round(prc_created_current - prc_used_current - prc_burned_current, 2),
                "profit_loss": round(profit_loss_current, 2),
                "profit_loss_change": calc_change(profit_loss_current, profit_loss_prev),
                "vip_revenue": round(vip_revenue_current, 2),
                "vip_revenue_change": calc_change(vip_revenue_current, vip_revenue_prev)
            },
            "users": {
                "total": len(users),
                "vip": vip_user_count,
                "free": len(users) - vip_user_count,
                "avg_balance": round(total_in_circulation / len(users), 2) if users else 0
            },
            "chart_data": chart_data,
            "usage_breakdown": sorted(usage_breakdown, key=lambda x: x["amount"], reverse=True),
            "source_breakdown": sorted(source_breakdown, key=lambda x: x["amount"], reverse=True),
            "health_score": min(100, max(0, int(50 + (prc_used_current / max(prc_created_current, 1)) * 30 + (prc_burned_current / max(prc_created_current, 1)) * 20)))
        }
        
    except Exception as e:
        logging.error(f"Error in detailed PRC analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========== END ADMIN PRC ANALYTICS ENDPOINTS ==========

# ========== ADVANCED ADMIN SYSTEMS ==========

# ==================== 1. AUDITING SERVICE ====================

@api_router.get("/admin/audit/comprehensive")
async def get_comprehensive_audit_logs(
    page: int = 1,
    limit: int = 50,
    action_type: str = None,
    user_id: str = None,
    admin_id: str = None,
    severity: str = None,
    start_date: str = None,
    end_date: str = None,
    search: str = None
):
    """Get comprehensive audit logs with advanced filtering"""
    try:
        query = {}
        
        if action_type:
            query["action_type"] = action_type
        if user_id:
            query["$or"] = [{"user_id": user_id}, {"target_user_id": user_id}]
        if admin_id:
            query["admin_id"] = admin_id
        if severity:
            query["severity"] = severity
        if start_date:
            query["timestamp"] = {"$gte": start_date}
        if end_date:
            if "timestamp" in query:
                query["timestamp"]["$lte"] = end_date
            else:
                query["timestamp"] = {"$lte": end_date}
        if search:
            query["$or"] = [
                {"action_type": {"$regex": search, "$options": "i"}},
                {"details": {"$regex": search, "$options": "i"}},
                {"user_email": {"$regex": search, "$options": "i"}}
            ]
        
        skip = (page - 1) * limit
        total = await db.audit_logs.count_documents(query)
        
        logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
        
        # Get action type stats
        action_stats = await db.audit_logs.aggregate([
            {"$group": {"_id": "$action_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]).to_list(100)
        
        # Get severity distribution
        severity_stats = await db.audit_logs.aggregate([
            {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
        ]).to_list(10)
        
        # Recent suspicious activities (high severity)
        suspicious = await db.audit_logs.find(
            {"severity": {"$in": ["high", "critical"]}},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10).to_list(10)
        
        return {
            "logs": logs,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
            "stats": {
                "action_types": [{"type": s["_id"], "count": s["count"]} for s in action_stats],
                "severity_distribution": [{"severity": s["_id"] or "normal", "count": s["count"]} for s in severity_stats]
            },
            "suspicious_activities": suspicious
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/audit/log-action")
async def log_admin_action(request: Request):
    """Log an admin action with full details"""
    try:
        data = await request.json()
        
        log_entry = {
            "log_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_type": data.get("action_type"),
            "admin_id": data.get("admin_id"),
            "admin_email": data.get("admin_email"),
            "target_user_id": data.get("target_user_id"),
            "target_user_email": data.get("target_user_email"),
            "entity_type": data.get("entity_type"),  # user, order, payment, etc.
            "entity_id": data.get("entity_id"),
            "old_value": data.get("old_value"),
            "new_value": data.get("new_value"),
            "details": data.get("details"),
            "ip_address": data.get("ip_address"),
            "user_agent": data.get("user_agent"),
            "severity": data.get("severity", "normal"),  # low, normal, high, critical
            "category": data.get("category", "admin_action")
        }
        
        await db.audit_logs.insert_one(log_entry)
        
        # If critical, send alert
        if log_entry["severity"] == "critical":
            await db.admin_alerts.insert_one({
                "alert_id": str(uuid.uuid4()),
                "type": "critical_action",
                "message": f"Critical action: {log_entry['action_type']} by {log_entry['admin_email']}",
                "log_id": log_entry["log_id"],
                "timestamp": log_entry["timestamp"],
                "read": False
            })
        
        return {"success": True, "log_id": log_entry["log_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/audit/user-timeline/{user_id}")
async def get_user_audit_timeline(user_id: str, limit: int = 100):
    """Get complete activity timeline for a specific user"""
    try:
        # Get all logs related to this user
        logs = await db.audit_logs.find(
            {"$or": [{"user_id": user_id}, {"target_user_id": user_id}]},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        # Get user's transactions
        transactions = await db.transactions.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(50).to_list(50)
        
        # Get user's login history
        login_history = await db.login_history.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(20).to_list(20)
        
        # Combine and sort by timestamp
        timeline = []
        
        for log in logs:
            timeline.append({
                "type": "audit",
                "timestamp": log.get("timestamp"),
                "action": log.get("action_type"),
                "details": log.get("details"),
                "severity": log.get("severity", "normal")
            })
        
        for txn in transactions:
            timeline.append({
                "type": "transaction",
                "timestamp": txn.get("timestamp"),
                "action": txn.get("transaction_type"),
                "details": f"Amount: {txn.get('amount')} PRC",
                "severity": "normal"
            })
        
        for login in login_history:
            timeline.append({
                "type": "login",
                "timestamp": login.get("timestamp"),
                "action": "login",
                "details": f"IP: {login.get('ip_address')}, Device: {login.get('device')}",
                "severity": "normal"
            })
        
        # Sort by timestamp
        timeline.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        return {
            "user_id": user_id,
            "timeline": timeline[:limit],
            "total_activities": len(timeline)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/audit/change-history/{entity_type}/{entity_id}")
async def get_entity_change_history(entity_type: str, entity_id: str):
    """Get change history for any entity (user, order, etc.)"""
    try:
        changes = await db.audit_logs.find(
            {
                "entity_type": entity_type,
                "entity_id": entity_id,
                "old_value": {"$exists": True}
            },
            {"_id": 0}
        ).sort("timestamp", -1).to_list(100)
        
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "changes": changes,
            "total_changes": len(changes)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/audit/alerts")
async def get_audit_alerts(unread_only: bool = True):
    """Get audit alerts for admin"""
    try:
        query = {"read": False} if unread_only else {}
        alerts = await db.admin_alerts.find(query, {"_id": 0}).sort("timestamp", -1).limit(50).to_list(50)
        unread_count = await db.admin_alerts.count_documents({"read": False})
        
        return {
            "alerts": alerts,
            "unread_count": unread_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/audit/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str):
    """Mark an alert as read"""
    try:
        await db.admin_alerts.update_one(
            {"alert_id": alert_id},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 2. PROFIT & LOSS + EXPENSE MANAGEMENT ====================

@api_router.get("/admin/finance/profit-loss")
async def get_profit_loss_statement(period: str = "month", year: int = None, month: int = None):
    """Get comprehensive Profit & Loss statement"""
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
            "delivery_charges": 0,
            "platform_fees": 0,
            "other_income": 0
        }
        
        # VIP Membership Revenue
        vip_payments = await db.vippayments.find({
            "status": "approved",
            "approved_at": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "amount": 1, "plan_type": 1}).to_list(1000)
        revenue["vip_memberships"] = sum(p.get("amount", 0) for p in vip_payments)
        
        # Service Charges from Bill Payments
        bill_payments = await db.bill_payment_requests.find({
            "status": "completed",
            "completed_at": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "service_charge": 1, "amount_inr": 1}).to_list(1000)
        revenue["service_charges"] += sum(bp.get("service_charge", bp.get("amount_inr", 0) * 0.02) for bp in bill_payments)
        
        # Service Charges from Gift Vouchers
        gift_vouchers = await db.gift_voucher_requests.find({
            "status": "completed",
            "completed_at": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "service_charge": 1, "denomination": 1}).to_list(1000)
        revenue["service_charges"] += sum(gv.get("service_charge", gv.get("denomination", 0) * 0.05) for gv in gift_vouchers)
        
        # Delivery Charges from Orders
        orders = await db.orders.find({
            "status": "delivered",
            "delivered_at": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "delivery_charge": 1}).to_list(1000)
        revenue["delivery_charges"] = sum(o.get("delivery_charge", 0) for o in orders)
        
        # Platform fees (if any)
        platform_fees = await db.platform_fees.find({
            "created_at": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "amount": 1}).to_list(1000)
        revenue["platform_fees"] = sum(pf.get("amount", 0) for pf in platform_fees)
        
        # Other income
        other_income = await db.other_income.find({
            "date": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "amount": 1}).to_list(1000)
        revenue["other_income"] = sum(oi.get("amount", 0) for oi in other_income)
        
        total_revenue = sum(revenue.values())
        
        # ===== EXPENSE CALCULATION =====
        expenses = {
            "server_hosting": 0,
            "payment_gateway_fees": 0,
            "sms_email_services": 0,
            "marketing": 0,
            "product_cost": 0,
            "gift_voucher_cost": 0,
            "cashback_referral": 0,
            "staff_salary": 0,
            "office_rent": 0,
            "utilities": 0,
            "miscellaneous": 0
        }
        
        # Get manual expenses
        manual_expenses = await db.expenses.find({
            "date": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0}).to_list(1000)
        
        for exp in manual_expenses:
            category = exp.get("category", "miscellaneous")
            if category in expenses:
                expenses[category] += exp.get("amount", 0)
            else:
                expenses["miscellaneous"] += exp.get("amount", 0)
        
        # Calculate payment gateway fees (2% of VIP revenue)
        expenses["payment_gateway_fees"] = revenue["vip_memberships"] * 0.02
        
        # Calculate cashback/referral from transactions
        referral_txns = await db.transactions.find({
            "transaction_type": {"$in": ["referral_bonus", "cashback"]},
            "timestamp": {"$gte": start_str, "$lte": end_str}
        }, {"_id": 0, "amount": 1}).to_list(10000)
        expenses["cashback_referral"] = sum(t.get("amount", 0) for t in referral_txns)
        
        total_expenses = sum(expenses.values())
        
        # ===== PROFIT/LOSS =====
        net_profit = total_revenue - total_expenses
        profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        # ===== COMPARISON WITH PREVIOUS PERIOD =====
        if period == "month":
            if target_month == 1:
                prev_start = datetime(target_year - 1, 12, 1, tzinfo=timezone.utc)
                prev_end = datetime(target_year, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
            else:
                prev_start = datetime(target_year, target_month - 1, 1, tzinfo=timezone.utc)
                prev_end = start_date - timedelta(seconds=1)
        else:
            duration = end_date - start_date
            prev_end = start_date - timedelta(seconds=1)
            prev_start = prev_end - duration
        
        prev_start_str = prev_start.isoformat()
        prev_end_str = prev_end.isoformat()
        
        # Previous period VIP revenue
        prev_vip = await db.vippayments.find({
            "status": "approved",
            "approved_at": {"$gte": prev_start_str, "$lte": prev_end_str}
        }, {"_id": 0, "amount": 1}).to_list(1000)
        prev_revenue = sum(p.get("amount", 0) for p in prev_vip)
        
        revenue_change = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        
        # ===== MONTHLY TREND (for charts) =====
        monthly_trend = []
        for i in range(6, 0, -1):
            trend_date = now - timedelta(days=30 * i)
            trend_start = datetime(trend_date.year, trend_date.month, 1, tzinfo=timezone.utc)
            if trend_date.month == 12:
                trend_end = datetime(trend_date.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
            else:
                trend_end = datetime(trend_date.year, trend_date.month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
            
            month_vip = await db.vippayments.find({
                "status": "approved",
                "approved_at": {"$gte": trend_start.isoformat(), "$lte": trend_end.isoformat()}
            }, {"_id": 0, "amount": 1}).to_list(1000)
            
            month_exp = await db.expenses.find({
                "date": {"$gte": trend_start.isoformat(), "$lte": trend_end.isoformat()}
            }, {"_id": 0, "amount": 1}).to_list(1000)
            
            month_revenue = sum(p.get("amount", 0) for p in month_vip)
            month_expenses = sum(e.get("amount", 0) for e in month_exp)
            
            monthly_trend.append({
                "month": trend_start.strftime("%b %Y"),
                "revenue": round(month_revenue, 2),
                "expenses": round(month_expenses, 2),
                "profit": round(month_revenue - month_expenses, 2)
            })
        
        return {
            "period": period,
            "period_label": period_label,
            "start_date": start_str,
            "end_date": end_str,
            "revenue": {
                "breakdown": revenue,
                "total": round(total_revenue, 2)
            },
            "expenses": {
                "breakdown": expenses,
                "total": round(total_expenses, 2)
            },
            "summary": {
                "gross_revenue": round(total_revenue, 2),
                "total_expenses": round(total_expenses, 2),
                "net_profit": round(net_profit, 2),
                "profit_margin": round(profit_margin, 2),
                "revenue_change": round(revenue_change, 2),
                "status": "profit" if net_profit > 0 else ("loss" if net_profit < 0 else "breakeven")
            },
            "monthly_trend": monthly_trend,
            "vip_breakdown": {
                "total_payments": len(vip_payments),
                "plans": {}  # Could add plan-wise breakdown
            }
        }
    except Exception as e:
        logging.error(f"Error in P&L statement: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/finance/expense")
async def add_expense(request: Request):
    """Add a new expense entry"""
    try:
        data = await request.json()
        
        expense = {
            "expense_id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).isoformat()),
            "category": data.get("category"),
            "sub_category": data.get("sub_category"),
            "amount": float(data.get("amount", 0)),
            "description": data.get("description"),
            "vendor": data.get("vendor"),
            "payment_method": data.get("payment_method"),
            "receipt_url": data.get("receipt_url"),
            "recurring": data.get("recurring", False),
            "recurring_frequency": data.get("recurring_frequency"),  # monthly, yearly
            "added_by": data.get("admin_id"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.expenses.insert_one(expense)
        
        # Log the action
        await db.audit_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_type": "expense_added",
            "admin_id": data.get("admin_id"),
            "entity_type": "expense",
            "entity_id": expense["expense_id"],
            "details": f"Added expense: {expense['category']} - ₹{expense['amount']}",
            "severity": "normal"
        })
        
        return {"success": True, "expense_id": expense["expense_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/finance/expenses")
async def get_expenses(
    page: int = 1,
    limit: int = 20,
    category: str = None,
    start_date: str = None,
    end_date: str = None
):
    """Get all expenses with filtering"""
    try:
        query = {}
        if category:
            query["category"] = category
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            if "date" in query:
                query["date"]["$lte"] = end_date
            else:
                query["date"] = {"$lte": end_date}
        
        skip = (page - 1) * limit
        total = await db.expenses.count_documents(query)
        expenses = await db.expenses.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        
        # Category-wise summary
        category_summary = await db.expenses.aggregate([
            {"$match": query},
            {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
            {"$sort": {"total": -1}}
        ]).to_list(20)
        
        return {
            "expenses": expenses,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
            "category_summary": [{"category": c["_id"], "total": c["total"], "count": c["count"]} for c in category_summary]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/admin/finance/expense/{expense_id}")
async def update_expense(expense_id: str, request: Request):
    """Update an expense entry"""
    try:
        data = await request.json()
        
        # Get old expense for audit log
        old_expense = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
        
        update_data = {k: v for k, v in data.items() if k not in ["expense_id", "created_at"]}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.expenses.update_one(
            {"expense_id": expense_id},
            {"$set": update_data}
        )
        
        # Log the change
        await db.audit_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_type": "expense_updated",
            "admin_id": data.get("admin_id"),
            "entity_type": "expense",
            "entity_id": expense_id,
            "old_value": old_expense,
            "new_value": update_data,
            "severity": "normal"
        })
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/finance/expense/{expense_id}")
async def delete_expense(expense_id: str, admin_id: str = None):
    """Delete an expense entry"""
    try:
        expense = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
        await db.expenses.delete_one({"expense_id": expense_id})
        
        # Log deletion
        await db.audit_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_type": "expense_deleted",
            "admin_id": admin_id,
            "entity_type": "expense",
            "entity_id": expense_id,
            "old_value": expense,
            "severity": "high"
        })
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/finance/other-income")
async def add_other_income(request: Request):
    """Add other income entry"""
    try:
        data = await request.json()
        
        income = {
            "income_id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).isoformat()),
            "source": data.get("source"),
            "amount": float(data.get("amount", 0)),
            "description": data.get("description"),
            "added_by": data.get("admin_id"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.other_income.insert_one(income)
        return {"success": True, "income_id": income["income_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== COMPANY MASTER WALLETS ====================

@api_router.get("/admin/finance/company-wallets")
async def get_company_wallets():
    """Get all company master wallets"""
    try:
        # Define wallet types
        wallet_types = [
            {"type": "ads_revenue", "name": "Ads Revenue Wallet", "description": "Income from AdMob & Unity Ads"},
            {"type": "subscription", "name": "Subscription Wallet", "description": "VIP Membership payments"},
            {"type": "redeem_reserve", "name": "Redeem Reserve Wallet", "description": "Reserved for user redemptions"},
            {"type": "charity", "name": "Charity Wallet", "description": "Social responsibility fund"},
            {"type": "profit", "name": "Profit Wallet", "description": "Net company profit"}
        ]
        
        wallets = []
        for wt in wallet_types:
            wallet = await db.company_wallets.find_one({"wallet_type": wt["type"]}, {"_id": 0})
            if not wallet:
                # Initialize wallet if not exists
                wallet = {
                    "wallet_id": str(uuid.uuid4()),
                    "wallet_type": wt["type"],
                    "wallet_name": wt["name"],
                    "description": wt["description"],
                    "balance": 0.0,
                    "total_credit": 0.0,
                    "total_debit": 0.0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_updated": datetime.now(timezone.utc).isoformat()
                }
                await db.company_wallets.insert_one(wallet)
            wallets.append(wallet)
        
        # Get recent transactions
        recent_txns = await db.company_wallet_transactions.find(
            {}, {"_id": 0}
        ).sort("timestamp", -1).limit(20).to_list(20)
        
        return {
            "wallets": wallets,
            "recent_transactions": recent_txns,
            "total_balance": sum(w.get("balance", 0) for w in wallets)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/finance/company-wallet/transfer")
async def transfer_company_wallet(request: Request):
    """Transfer amount between company wallets"""
    try:
        data = await request.json()
        from_wallet = data.get("from_wallet")
        to_wallet = data.get("to_wallet")
        amount = float(data.get("amount", 0))
        description = data.get("description", "Inter-wallet transfer")
        admin_id = data.get("admin_id")
        
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        # Get source wallet
        source = await db.company_wallets.find_one({"wallet_type": from_wallet})
        if not source or source.get("balance", 0) < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance in source wallet")
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Debit from source
        await db.company_wallets.update_one(
            {"wallet_type": from_wallet},
            {"$inc": {"balance": -amount, "total_debit": amount}, "$set": {"last_updated": now}}
        )
        
        # Credit to destination
        await db.company_wallets.update_one(
            {"wallet_type": to_wallet},
            {"$inc": {"balance": amount, "total_credit": amount}, "$set": {"last_updated": now}}
        )
        
        # Log transaction
        txn = {
            "txn_id": str(uuid.uuid4()),
            "from_wallet": from_wallet,
            "to_wallet": to_wallet,
            "amount": amount,
            "description": description,
            "admin_id": admin_id,
            "timestamp": now
        }
        await db.company_wallet_transactions.insert_one(txn)
        
        return {"success": True, "transaction_id": txn["txn_id"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/finance/company-wallet/adjust")
async def adjust_company_wallet(request: Request):
    """Manual credit/debit to company wallet"""
    try:
        data = await request.json()
        wallet_type = data.get("wallet_type")
        amount = float(data.get("amount", 0))
        txn_type = data.get("type")  # credit or debit
        description = data.get("description")
        admin_id = data.get("admin_id")
        
        if txn_type == "debit":
            wallet = await db.company_wallets.find_one({"wallet_type": wallet_type})
            if wallet.get("balance", 0) < amount:
                raise HTTPException(status_code=400, detail="Insufficient balance")
            amount = -amount
        
        now = datetime.now(timezone.utc).isoformat()
        
        update_field = "total_credit" if txn_type == "credit" else "total_debit"
        await db.company_wallets.update_one(
            {"wallet_type": wallet_type},
            {
                "$inc": {"balance": amount, update_field: abs(amount)},
                "$set": {"last_updated": now}
            }
        )
        
        # Log transaction
        txn = {
            "txn_id": str(uuid.uuid4()),
            "wallet_type": wallet_type,
            "amount": abs(amount),
            "type": txn_type,
            "description": description,
            "admin_id": admin_id,
            "timestamp": now
        }
        await db.company_wallet_transactions.insert_one(txn)
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADS INCOME MODULE ====================

@api_router.get("/admin/finance/ads-income")
async def get_ads_income(page: int = 1, limit: int = 20):
    """Get ads income entries"""
    try:
        skip = (page - 1) * limit
        
        total = await db.ads_income.count_documents({})
        entries = await db.ads_income.find(
            {}, {"_id": 0}
        ).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        
        # Get summary
        pipeline = [
            {"$group": {
                "_id": "$ad_network",
                "total_revenue": {"$sum": "$revenue_amount"},
                "total_impressions": {"$sum": "$impressions"},
                "total_clicks": {"$sum": "$clicks"},
                "avg_ecpm": {"$avg": "$ecpm"}
            }}
        ]
        summary = await db.ads_income.aggregate(pipeline).to_list(10)
        
        return {
            "entries": entries,
            "total": total,
            "page": page,
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/finance/ads-income")
async def add_ads_income(request: Request):
    """Add ads income entry (manual)"""
    try:
        data = await request.json()
        
        entry = {
            "entry_id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "ad_network": data.get("ad_network"),  # admob, unity
            "impressions": int(data.get("impressions", 0)),
            "clicks": int(data.get("clicks", 0)),
            "ecpm": float(data.get("ecpm", 0)),
            "revenue_amount": float(data.get("revenue_amount", 0)),
            "notes": data.get("notes", ""),
            "added_by": data.get("admin_id"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.ads_income.insert_one(entry)
        
        # Update ads revenue wallet
        await db.company_wallets.update_one(
            {"wallet_type": "ads_revenue"},
            {
                "$inc": {"balance": entry["revenue_amount"], "total_credit": entry["revenue_amount"]},
                "$set": {"last_updated": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )
        
        return {"success": True, "entry_id": entry["entry_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/finance/ads-income/{entry_id}")
async def delete_ads_income(entry_id: str):
    """Delete ads income entry"""
    try:
        entry = await db.ads_income.find_one({"entry_id": entry_id})
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Reverse wallet credit
        await db.company_wallets.update_one(
            {"wallet_type": "ads_revenue"},
            {"$inc": {"balance": -entry.get("revenue_amount", 0)}}
        )
        
        await db.ads_income.delete_one({"entry_id": entry_id})
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== FIXED EXPENSES MODULE ====================

@api_router.get("/admin/finance/fixed-expenses")
async def get_fixed_expenses(page: int = 1, limit: int = 20, month: str = None):
    """Get fixed monthly expenses"""
    try:
        skip = (page - 1) * limit
        query = {}
        if month:
            query["month"] = month
        
        total = await db.fixed_expenses.count_documents(query)
        expenses = await db.fixed_expenses.find(
            query, {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Get monthly totals
        pipeline = [
            {"$group": {
                "_id": {"month": "$month", "category": "$expense_category"},
                "total": {"$sum": "$amount"}
            }},
            {"$sort": {"_id.month": -1}}
        ]
        monthly_summary = await db.fixed_expenses.aggregate(pipeline).to_list(100)
        
        return {
            "expenses": expenses,
            "total": total,
            "page": page,
            "monthly_summary": monthly_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/finance/fixed-expense")
async def add_fixed_expense(request: Request):
    """Add fixed expense entry"""
    try:
        data = await request.json()
        now = datetime.now(timezone.utc)
        
        expense = {
            "expense_id": str(uuid.uuid4()),
            "expense_category": data.get("category"),  # server, salary, rent, legal, etc.
            "description": data.get("description"),
            "amount": float(data.get("amount", 0)),
            "month": data.get("month", now.strftime("%Y-%m")),
            "vendor": data.get("vendor", ""),
            "paid_status": data.get("paid_status", "pending"),  # pending, paid
            "payment_date": data.get("payment_date"),
            "recurring": data.get("recurring", True),
            "added_by": data.get("admin_id"),
            "created_at": now.isoformat()
        }
        
        await db.fixed_expenses.insert_one(expense)
        return {"success": True, "expense_id": expense["expense_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/admin/finance/fixed-expense/{expense_id}")
async def update_fixed_expense(expense_id: str, request: Request):
    """Update fixed expense"""
    try:
        data = await request.json()
        
        update_data = {
            "expense_category": data.get("category"),
            "description": data.get("description"),
            "amount": float(data.get("amount", 0)),
            "vendor": data.get("vendor"),
            "paid_status": data.get("paid_status"),
            "payment_date": data.get("payment_date"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.fixed_expenses.update_one(
            {"expense_id": expense_id},
            {"$set": {k: v for k, v in update_data.items() if v is not None}}
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== FRAUD DETECTION & RISK CONTROL ====================

@api_router.get("/admin/fraud/alerts")
async def get_fraud_alerts(page: int = 1, limit: int = 20, status: str = None):
    """Get fraud alerts"""
    try:
        skip = (page - 1) * limit
        query = {}
        if status:
            query["status"] = status
        
        total = await db.fraud_alerts.count_documents(query)
        alerts = await db.fraud_alerts.find(
            query, {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Get stats
        stats = {
            "total_alerts": total,
            "pending": await db.fraud_alerts.count_documents({"status": "pending"}),
            "investigating": await db.fraud_alerts.count_documents({"status": "investigating"}),
            "resolved": await db.fraud_alerts.count_documents({"status": "resolved"}),
            "false_positive": await db.fraud_alerts.count_documents({"status": "false_positive"})
        }
        
        return {
            "alerts": alerts,
            "total": total,
            "page": page,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/fraud/detect")
async def run_fraud_detection():
    """Run fraud detection algorithms"""
    try:
        now = datetime.now(timezone.utc)
        alerts_created = []
        
        # 1. Multiple accounts detection (same device/IP)
        pipeline = [
            {"$match": {"last_login_ip": {"$exists": True, "$ne": None}}},
            {"$group": {
                "_id": "$last_login_ip",
                "users": {"$push": {"uid": "$uid", "email": "$email", "name": "$name"}},
                "count": {"$sum": 1}
            }},
            {"$match": {"count": {"$gt": 2}}}  # More than 2 accounts from same IP
        ]
        same_ip_users = await db.users.aggregate(pipeline).to_list(100)
        
        for group in same_ip_users:
            existing = await db.fraud_alerts.find_one({
                "alert_type": "multiple_accounts_ip",
                "ip_address": group["_id"],
                "status": {"$in": ["pending", "investigating"]}
            })
            if not existing:
                alert = {
                    "alert_id": str(uuid.uuid4()),
                    "alert_type": "multiple_accounts_ip",
                    "severity": "high",
                    "ip_address": group["_id"],
                    "affected_users": group["users"][:10],  # Limit to 10
                    "user_count": group["count"],
                    "description": f"{group['count']} accounts detected from same IP: {group['_id']}",
                    "status": "pending",
                    "created_at": now.isoformat()
                }
                await db.fraud_alerts.insert_one(alert)
                alerts_created.append(alert["alert_id"])
        
        # 2. Abnormal earning speed detection
        yesterday = (now - timedelta(days=1)).isoformat()
        high_earners = await db.users.find({
            "prc_balance": {"$gt": 5000},  # High balance
            "created_at": {"$gte": yesterday}  # New account
        }, {"_id": 0, "uid": 1, "email": 1, "prc_balance": 1, "created_at": 1}).to_list(50)
        
        for user in high_earners:
            existing = await db.fraud_alerts.find_one({
                "alert_type": "abnormal_earning",
                "user_id": user["uid"],
                "status": {"$in": ["pending", "investigating"]}
            })
            if not existing:
                alert = {
                    "alert_id": str(uuid.uuid4()),
                    "alert_type": "abnormal_earning",
                    "severity": "high",
                    "user_id": user["uid"],
                    "user_email": user.get("email"),
                    "prc_balance": user.get("prc_balance"),
                    "description": f"New user with unusually high PRC balance: {user.get('prc_balance')} PRC",
                    "status": "pending",
                    "created_at": now.isoformat()
                }
                await db.fraud_alerts.insert_one(alert)
                alerts_created.append(alert["alert_id"])
        
        # 3. Same device ID detection
        pipeline = [
            {"$match": {"device_id": {"$exists": True, "$ne": None}}},
            {"$group": {
                "_id": "$device_id",
                "users": {"$push": {"uid": "$uid", "email": "$email"}},
                "count": {"$sum": 1}
            }},
            {"$match": {"count": {"$gt": 1}}}  # More than 1 account from same device
        ]
        same_device = await db.users.aggregate(pipeline).to_list(100)
        
        for group in same_device:
            existing = await db.fraud_alerts.find_one({
                "alert_type": "multiple_accounts_device",
                "device_id": group["_id"],
                "status": {"$in": ["pending", "investigating"]}
            })
            if not existing:
                alert = {
                    "alert_id": str(uuid.uuid4()),
                    "alert_type": "multiple_accounts_device",
                    "severity": "critical",
                    "device_id": group["_id"],
                    "affected_users": group["users"][:10],
                    "user_count": group["count"],
                    "description": f"{group['count']} accounts from same device",
                    "status": "pending",
                    "created_at": now.isoformat()
                }
                await db.fraud_alerts.insert_one(alert)
                alerts_created.append(alert["alert_id"])
        
        return {
            "success": True,
            "alerts_created": len(alerts_created),
            "alert_ids": alerts_created
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/admin/fraud/alert/{alert_id}")
async def update_fraud_alert(alert_id: str, request: Request):
    """Update fraud alert status"""
    try:
        data = await request.json()
        
        update_data = {
            "status": data.get("status"),  # pending, investigating, resolved, false_positive
            "admin_notes": data.get("notes"),
            "resolved_by": data.get("admin_id"),
            "resolved_at": datetime.now(timezone.utc).isoformat() if data.get("status") in ["resolved", "false_positive"] else None,
            "action_taken": data.get("action_taken")  # freeze_wallet, ban_user, warning, none
        }
        
        await db.fraud_alerts.update_one(
            {"alert_id": alert_id},
            {"$set": {k: v for k, v in update_data.items() if v is not None}}
        )
        
        # Take action if specified
        if data.get("action_taken") == "freeze_wallet":
            alert = await db.fraud_alerts.find_one({"alert_id": alert_id})
            if alert and alert.get("user_id"):
                await db.users.update_one(
                    {"uid": alert["user_id"]},
                    {"$set": {"wallet_status": "frozen", "frozen_reason": "Fraud investigation"}}
                )
            elif alert and alert.get("affected_users"):
                for user in alert["affected_users"]:
                    await db.users.update_one(
                        {"uid": user["uid"]},
                        {"$set": {"wallet_status": "frozen", "frozen_reason": "Fraud investigation"}}
                    )
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/fraud/freeze-wallet/{uid}")
async def freeze_user_wallet(uid: str, request: Request):
    """Freeze user wallet for fraud"""
    try:
        data = await request.json()
        reason = data.get("reason", "Suspected fraud")
        admin_id = data.get("admin_id")
        
        await db.users.update_one(
            {"uid": uid},
            {
                "$set": {
                    "wallet_status": "frozen",
                    "frozen_reason": reason,
                    "frozen_by": admin_id,
                    "frozen_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Log activity
        await db.activity_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "action": "wallet_frozen",
            "user_id": uid,
            "admin_id": admin_id,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/fraud/unfreeze-wallet/{uid}")
async def unfreeze_user_wallet(uid: str, request: Request):
    """Unfreeze user wallet"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        
        await db.users.update_one(
            {"uid": uid},
            {
                "$set": {"wallet_status": "active"},
                "$unset": {"frozen_reason": "", "frozen_by": "", "frozen_at": ""}
            }
        )
        
        # Log activity
        await db.activity_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "action": "wallet_unfrozen",
            "user_id": uid,
            "admin_id": admin_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== EXPORT & REPORTING ====================

@api_router.get("/admin/finance/export/profit-loss")
async def export_profit_loss(year: int = None, month: int = None, format: str = "csv"):
    """Export P&L statement as CSV"""
    try:
        now = datetime.now(timezone.utc)
        target_year = year or now.year
        target_month = month or now.month
        
        # Get P&L data
        start_date = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
        
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        
        # Income
        vip_total = await db.vippayments.count_documents({"status": "approved", "approved_at": {"$gte": start_str, "$lt": end_str}})
        vip_revenue = 0
        async for p in db.vippayments.find({"status": "approved", "approved_at": {"$gte": start_str, "$lt": end_str}}, {"amount": 1}):
            vip_revenue += p.get("amount", 0)
        
        ads_revenue = 0
        async for a in db.ads_income.find({"date": {"$gte": start_str[:10], "$lt": end_str[:10]}}, {"revenue_amount": 1}):
            ads_revenue += a.get("revenue_amount", 0)
        
        # Expenses
        fixed_expenses = 0
        async for e in db.fixed_expenses.find({"month": f"{target_year}-{target_month:02d}"}, {"amount": 1}):
            fixed_expenses += e.get("amount", 0)
        
        variable_expenses = 0
        async for e in db.expenses.find({"date": {"$gte": start_str, "$lt": end_str}}, {"amount": 1}):
            variable_expenses += e.get("amount", 0)
        
        # Build CSV
        import io
        output = io.StringIO()
        output.write("PROFIT & LOSS STATEMENT\n")
        output.write(f"Period: {start_date.strftime('%B %Y')}\n\n")
        
        output.write("INCOME\n")
        output.write(f"VIP Memberships,{vip_revenue}\n")
        output.write(f"Ads Revenue,{ads_revenue}\n")
        output.write(f"Total Income,{vip_revenue + ads_revenue}\n\n")
        
        output.write("EXPENSES\n")
        output.write(f"Fixed Expenses,{fixed_expenses}\n")
        output.write(f"Variable Expenses,{variable_expenses}\n")
        output.write(f"Total Expenses,{fixed_expenses + variable_expenses}\n\n")
        
        net = (vip_revenue + ads_revenue) - (fixed_expenses + variable_expenses)
        output.write(f"NET PROFIT/LOSS,{net}\n")
        
        from fastapi.responses import StreamingResponse
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=PL_{target_year}_{target_month:02d}.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/finance/export/user-ledger/{uid}")
async def export_user_ledger(uid: str, format: str = "csv"):
    """Export user transaction ledger as CSV"""
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "name": 1, "email": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        transactions = await db.transactions.find(
            {"user_id": uid}, {"_id": 0}
        ).sort("timestamp", -1).to_list(1000)
        
        import io
        output = io.StringIO()
        output.write(f"USER LEDGER - {user.get('name')} ({user.get('email')})\n")
        output.write(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        output.write("Date,Type,Amount,Wallet,Description,Balance After\n")
        for txn in transactions:
            date = txn.get("timestamp", "")[:19].replace("T", " ")
            output.write(f"{date},{txn.get('transaction_type')},{txn.get('amount')},{txn.get('wallet_type')},{txn.get('description', '')},{txn.get('balance_after', '')}\n")
        
        from fastapi.responses import StreamingResponse
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=ledger_{uid}.csv"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/finance/export/company-wallets")
async def export_company_wallets(format: str = "csv"):
    """Export company wallet statements as CSV"""
    try:
        wallets = await db.company_wallets.find({}, {"_id": 0}).to_list(10)
        transactions = await db.company_wallet_transactions.find(
            {}, {"_id": 0}
        ).sort("timestamp", -1).to_list(500)
        
        import io
        output = io.StringIO()
        output.write("COMPANY WALLET STATEMENTS\n")
        output.write(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        output.write("WALLET BALANCES\n")
        output.write("Wallet,Balance,Total Credit,Total Debit\n")
        for w in wallets:
            output.write(f"{w.get('wallet_name')},{w.get('balance')},{w.get('total_credit')},{w.get('total_debit')}\n")
        
        output.write("\nTRANSACTIONS\n")
        output.write("Date,From,To,Amount,Description\n")
        for txn in transactions:
            date = txn.get("timestamp", "")[:19].replace("T", " ")
            from_w = txn.get("from_wallet") or txn.get("wallet_type") or "-"
            to_w = txn.get("to_wallet") or "-"
            output.write(f"{date},{from_w},{to_w},{txn.get('amount')},{txn.get('description', '')}\n")
        
        from fastapi.responses import StreamingResponse
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=company_wallets.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== MONTHLY P&L SNAPSHOT ====================

@api_router.post("/admin/finance/snapshot/monthly")
async def create_monthly_pl_snapshot():
    """Create monthly P&L snapshot for historical records"""
    try:
        now = datetime.now(timezone.utc)
        # Create snapshot for previous month
        if now.month == 1:
            target_year = now.year - 1
            target_month = 12
        else:
            target_year = now.year
            target_month = now.month - 1
        
        month_key = f"{target_year}-{target_month:02d}"
        
        # Check if snapshot already exists
        existing = await db.pl_snapshots.find_one({"month": month_key})
        if existing:
            return {"success": False, "message": "Snapshot already exists for this month"}
        
        # Calculate totals
        start_date = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
        
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        
        # Income
        vip_income = 0
        async for p in db.vippayments.find({"status": "approved", "approved_at": {"$gte": start_str, "$lt": end_str}}, {"amount": 1}):
            vip_income += p.get("amount", 0)
        
        ads_income = 0
        async for a in db.ads_income.find({"date": {"$gte": start_str[:10], "$lt": end_str[:10]}}, {"revenue_amount": 1}):
            ads_income += a.get("revenue_amount", 0)
        
        other_income = 0
        async for o in db.other_income.find({"date": {"$gte": start_str, "$lt": end_str}}, {"amount": 1}):
            other_income += o.get("amount", 0)
        
        total_income = vip_income + ads_income + other_income
        
        # Expenses
        fixed_expenses = 0
        async for e in db.fixed_expenses.find({"month": month_key}, {"amount": 1}):
            fixed_expenses += e.get("amount", 0)
        
        variable_expenses = 0
        async for e in db.expenses.find({"date": {"$gte": start_str, "$lt": end_str}}, {"amount": 1}):
            variable_expenses += e.get("amount", 0)
        
        total_expenses = fixed_expenses + variable_expenses
        net_pl = total_income - total_expenses
        
        snapshot = {
            "snapshot_id": str(uuid.uuid4()),
            "month": month_key,
            "year": target_year,
            "month_num": target_month,
            "income": {
                "vip_memberships": vip_income,
                "ads_revenue": ads_income,
                "other": other_income,
                "total": total_income
            },
            "expenses": {
                "fixed": fixed_expenses,
                "variable": variable_expenses,
                "total": total_expenses
            },
            "net_profit_loss": net_pl,
            "created_at": now.isoformat()
        }
        
        await db.pl_snapshots.insert_one(snapshot)
        
        return {"success": True, "snapshot": snapshot}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/finance/snapshots")
async def get_pl_snapshots(limit: int = 12):
    """Get historical P&L snapshots"""
    try:
        snapshots = await db.pl_snapshots.find(
            {}, {"_id": 0}
        ).sort("month", -1).limit(limit).to_list(limit)
        
        return {"snapshots": snapshots}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 3. LIQUIDITY MANAGEMENT ====================

@api_router.get("/admin/liquidity/dashboard")
async def get_liquidity_dashboard():
    """Get comprehensive liquidity management dashboard"""
    try:
        now = datetime.now(timezone.utc)
        
        # ===== PRC IN SYSTEM =====
        users = await db.users.find({}, {"_id": 0, "prc_balance": 1, "membership_type": 1, "membership_expiry": 1}).to_list(None)
        total_prc = sum(u.get("prc_balance", 0) for u in users)
        
        # PRC Value (assuming 1 PRC = ₹1 for simplicity, can be configured)
        prc_inr_rate = 1.0  # This could come from settings
        total_prc_value = total_prc * prc_inr_rate
        
        # ===== CASH RESERVES =====
        # Get from settings or manual entry
        reserves = await db.liquidity_reserves.find_one({}, {"_id": 0})
        if not reserves:
            reserves = {
                "bank_balance": 0,
                "cash_in_hand": 0,
                "payment_gateway_balance": 0,
                "last_updated": None
            }
        
        total_cash = reserves.get("bank_balance", 0) + reserves.get("cash_in_hand", 0) + reserves.get("payment_gateway_balance", 0)
        
        # ===== PENDING LIABILITIES =====
        # Pending withdrawals
        pending_withdrawals = await db.withdrawals.find(
            {"status": "pending"},
            {"_id": 0, "amount": 1}
        ).to_list(1000)
        total_pending_withdrawals = sum(w.get("amount", 0) for w in pending_withdrawals)
        
        # Pending bill payments
        pending_bills = await db.bill_payment_requests.find(
            {"status": {"$in": ["pending", "processing"]}},
            {"_id": 0, "amount_inr": 1}
        ).to_list(1000)
        total_pending_bills = sum(b.get("amount_inr", 0) for b in pending_bills)
        
        # Pending gift vouchers
        pending_vouchers = await db.gift_voucher_requests.find(
            {"status": {"$in": ["pending", "processing"]}},
            {"_id": 0, "denomination": 1}
        ).to_list(1000)
        total_pending_vouchers = sum(v.get("denomination", 0) for v in pending_vouchers)
        
        total_liabilities = total_pending_withdrawals + total_pending_bills + total_pending_vouchers
        
        # ===== INCOMING REVENUE (Expected) =====
        # Pending VIP payments
        pending_vip = await db.vippayments.find(
            {"status": "pending"},
            {"_id": 0, "amount": 1}
        ).to_list(1000)
        expected_vip_revenue = sum(p.get("amount", 0) for p in pending_vip)
        
        # ===== RATIOS & HEALTH =====
        reserve_ratio = (total_cash / total_prc_value * 100) if total_prc_value > 0 else 100
        liquidity_ratio = (total_cash / total_liabilities) if total_liabilities > 0 else float('inf')
        available_liquidity = total_cash - total_liabilities
        
        # Health status
        if reserve_ratio >= 80:
            health_status = "excellent"
            health_message = "Excellent liquidity position"
        elif reserve_ratio >= 50:
            health_status = "good"
            health_message = "Good liquidity, monitor closely"
        elif reserve_ratio >= 30:
            health_status = "warning"
            health_message = "Low reserves, consider reducing PRC creation"
        else:
            health_status = "critical"
            health_message = "Critical! Immediate action required"
        
        # ===== DAILY FLOW (Last 30 days) =====
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        
        # Daily PRC creation
        daily_creation = await db.transactions.aggregate([
            {
                "$match": {
                    "transaction_type": {"$in": ["mining", "referral_bonus", "cashback", "signup_bonus"]},
                    "timestamp": {"$gte": thirty_days_ago}
                }
            },
            {
                "$group": {
                    "_id": {"$substr": ["$timestamp", 0, 10]},
                    "total": {"$sum": "$amount"}
                }
            },
            {"$sort": {"_id": 1}}
        ]).to_list(31)
        
        # Daily cash inflow (VIP payments)
        daily_inflow = await db.vippayments.aggregate([
            {
                "$match": {
                    "status": "approved",
                    "approved_at": {"$gte": thirty_days_ago}
                }
            },
            {
                "$group": {
                    "_id": {"$substr": ["$approved_at", 0, 10]},
                    "total": {"$sum": "$amount"}
                }
            },
            {"$sort": {"_id": 1}}
        ]).to_list(31)
        
        # Daily cash outflow (bill payments + vouchers completed)
        daily_outflow = await db.bill_payment_requests.aggregate([
            {
                "$match": {
                    "status": "completed",
                    "completed_at": {"$gte": thirty_days_ago}
                }
            },
            {
                "$group": {
                    "_id": {"$substr": ["$completed_at", 0, 10]},
                    "total": {"$sum": "$amount_inr"}
                }
            },
            {"$sort": {"_id": 1}}
        ]).to_list(31)
        
        # Combine flow data
        flow_data = []
        for i in range(30, -1, -1):
            date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            date_short = (now - timedelta(days=i)).strftime("%d %b")
            
            creation = next((d["total"] for d in daily_creation if d["_id"] == date), 0)
            inflow = next((d["total"] for d in daily_inflow if d["_id"] == date), 0)
            outflow = next((d["total"] for d in daily_outflow if d["_id"] == date), 0)
            
            flow_data.append({
                "date": date_short,
                "prc_created": round(creation, 2),
                "cash_inflow": round(inflow, 2),
                "cash_outflow": round(outflow, 2),
                "net_flow": round(inflow - outflow, 2)
            })
        
        # ===== ALERTS =====
        alerts = []
        
        if reserve_ratio < 50:
            alerts.append({
                "type": "warning",
                "message": f"Reserve ratio is low ({reserve_ratio:.1f}%). Consider increasing cash reserves.",
                "severity": "high"
            })
        
        if total_pending_withdrawals > total_cash * 0.3:
            alerts.append({
                "type": "warning",
                "message": f"Pending withdrawals (₹{total_pending_withdrawals:,.0f}) exceed 30% of cash reserves.",
                "severity": "medium"
            })
        
        # Large single pending withdrawal
        large_withdrawal = await db.withdrawals.find_one(
            {"status": "pending", "amount": {"$gte": total_cash * 0.1}},
            {"_id": 0}
        )
        if large_withdrawal:
            alerts.append({
                "type": "info",
                "message": f"Large withdrawal pending: ₹{large_withdrawal.get('amount', 0):,.0f}",
                "severity": "medium"
            })
        
        # Daily burn rate
        avg_daily_creation = sum(d["total"] for d in daily_creation) / max(len(daily_creation), 1)
        avg_daily_inflow = sum(d["total"] for d in daily_inflow) / max(len(daily_inflow), 1)
        avg_daily_outflow = sum(d["total"] for d in daily_outflow) / max(len(daily_outflow), 1)
        
        if avg_daily_creation > avg_daily_inflow * 10:
            alerts.append({
                "type": "warning",
                "message": "PRC creation rate is significantly higher than cash inflow. Review mining rates.",
                "severity": "medium"
            })
        
        # ===== RECOMMENDATIONS =====
        recommendations = []
        
        if reserve_ratio < 50:
            recommendations.append({
                "title": "Increase VIP Pricing",
                "description": "Consider increasing VIP membership prices by 10-20% to improve reserves.",
                "impact": "high"
            })
            recommendations.append({
                "title": "Reduce Mining Rewards",
                "description": "Temporarily reduce mining rewards to slow PRC creation.",
                "impact": "medium"
            })
        
        if liquidity_ratio < 2:
            recommendations.append({
                "title": "Process Liabilities",
                "description": "Prioritize processing pending withdrawals and payments.",
                "impact": "high"
            })
        
        return {
            "summary": {
                "total_prc_in_system": round(total_prc, 2),
                "prc_inr_value": round(total_prc_value, 2),
                "total_cash_reserves": round(total_cash, 2),
                "total_liabilities": round(total_liabilities, 2),
                "available_liquidity": round(available_liquidity, 2),
                "expected_revenue": round(expected_vip_revenue, 2)
            },
            "reserves": {
                "bank_balance": reserves.get("bank_balance", 0),
                "cash_in_hand": reserves.get("cash_in_hand", 0),
                "payment_gateway": reserves.get("payment_gateway_balance", 0),
                "last_updated": reserves.get("last_updated")
            },
            "liabilities": {
                "pending_withdrawals": round(total_pending_withdrawals, 2),
                "pending_bill_payments": round(total_pending_bills, 2),
                "pending_gift_vouchers": round(total_pending_vouchers, 2),
                "withdrawal_count": len(pending_withdrawals),
                "bill_count": len(pending_bills),
                "voucher_count": len(pending_vouchers)
            },
            "ratios": {
                "reserve_ratio": round(reserve_ratio, 2),
                "liquidity_ratio": round(min(liquidity_ratio, 999), 2),
                "prc_coverage": round((total_cash / total_prc_value * 100) if total_prc_value > 0 else 100, 2)
            },
            "health": {
                "status": health_status,
                "message": health_message,
                "score": min(100, max(0, int(reserve_ratio)))
            },
            "daily_averages": {
                "prc_creation": round(avg_daily_creation, 2),
                "cash_inflow": round(avg_daily_inflow, 2),
                "cash_outflow": round(avg_daily_outflow, 2),
                "runway_days": int(total_cash / max(avg_daily_outflow, 1)) if avg_daily_outflow > 0 else 999
            },
            "flow_data": flow_data,
            "alerts": alerts,
            "recommendations": recommendations
        }
    except Exception as e:
        logging.error(f"Error in liquidity dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/liquidity/update-reserves")
async def update_liquidity_reserves(request: Request):
    """Update cash reserves manually"""
    try:
        data = await request.json()
        
        # Get old values for audit
        old_reserves = await db.liquidity_reserves.find_one({}, {"_id": 0})
        
        reserves = {
            "bank_balance": float(data.get("bank_balance", 0)),
            "cash_in_hand": float(data.get("cash_in_hand", 0)),
            "payment_gateway_balance": float(data.get("payment_gateway_balance", 0)),
            "notes": data.get("notes"),
            "updated_by": data.get("admin_id"),
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        await db.liquidity_reserves.update_one(
            {},
            {"$set": reserves},
            upsert=True
        )
        
        # Log the change
        await db.audit_logs.insert_one({
            "log_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_type": "liquidity_reserves_updated",
            "admin_id": data.get("admin_id"),
            "entity_type": "liquidity",
            "old_value": old_reserves,
            "new_value": reserves,
            "details": f"Updated reserves: Bank ₹{reserves['bank_balance']}, Cash ₹{reserves['cash_in_hand']}, Gateway ₹{reserves['payment_gateway_balance']}",
            "severity": "high"
        })
        
        return {"success": True, "reserves": reserves}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/liquidity/alerts")
async def get_liquidity_alerts():
    """Get active liquidity alerts"""
    try:
        alerts = await db.liquidity_alerts.find(
            {"resolved": False},
            {"_id": 0}
        ).sort("created_at", -1).to_list(50)
        
        return {"alerts": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/liquidity/alert/resolve/{alert_id}")
async def resolve_liquidity_alert(alert_id: str, request: Request):
    """Resolve a liquidity alert"""
    try:
        data = await request.json()
        
        await db.liquidity_alerts.update_one(
            {"alert_id": alert_id},
            {"$set": {
                "resolved": True,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolved_by": data.get("admin_id"),
                "resolution_notes": data.get("notes")
            }}
        )
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== END ADVANCED ADMIN SYSTEMS ==========

# Registration Control Endpoints
@api_router.get("/admin/registration-status")
async def get_registration_status():
    """Get registration enabled status"""
    settings = await db.settings.find_one({}, {"_id": 0, "registration_enabled": 1, "registration_message": 1})
    if not settings:
        return {"registration_enabled": True, "registration_message": ""}
    return settings

@api_router.post("/admin/toggle-registration")
async def toggle_registration(request: Request):
    """Toggle registration enabled/disabled (Admin only)"""
    data = await request.json()
    enabled = data.get("enabled", True)
    message = data.get("message", "New user registrations are currently closed. Please check back later.")
    
    await db.settings.update_one(
        {},
        {"$set": {
            "registration_enabled": enabled,
            "registration_message": message,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    status = "enabled" if enabled else "disabled"
    return {"message": f"Registration {status} successfully", "registration_enabled": enabled}

# PRC Burn Admin Endpoints
@api_router.post("/admin/burn-prc-now")
async def trigger_prc_burn():
    """Manually trigger PRC burn job (Admin only)"""
    result = await run_prc_burn_job()
    return {
        "message": "PRC burn job completed",
        "results": result
    }

@api_router.get("/admin/burn-statistics")
async def get_burn_statistics():
    """Get PRC burn statistics (Admin only)"""
    # Get total burned from transactions
    burn_transactions = await db.transactions.find({
        "transaction_type": {"$in": ["prc_burn_free_user", "prc_burn_expired_vip"]}
    }).to_list(None)
    
    total_burned = sum(t.get("prc_amount", 0) for t in burn_transactions)
    free_user_burned = sum(t.get("prc_amount", 0) for t in burn_transactions if t.get("transaction_type") == "prc_burn_free_user")
    vip_burned = sum(t.get("prc_amount", 0) for t in burn_transactions if t.get("transaction_type") == "prc_burn_expired_vip")
    
    # Count users with burned PRC
    users_with_burned = await db.users.count_documents({
        "mining_history.burned": True
    })
    
    # Get recent burns
    recent_burns = sorted(burn_transactions, key=lambda x: x.get("timestamp", ""), reverse=True)[:10]
    
    return {
        "total_burned": total_burned,
        "free_user_burned": free_user_burned,
        "expired_vip_burned": vip_burned,
        "users_affected": users_with_burned,
        "recent_burns": recent_burns
    }

# VIP Plans Management Endpoints
@api_router.get("/vip/plans")
async def get_vip_plans_public():
    """Get all VIP plans with pricing (public endpoint)"""
    plans = await get_all_vip_plans()
    return {"plans": plans}

@api_router.post("/admin/vip/update-plan")
async def update_vip_plan(request: Request):
    """Update VIP plan pricing and discount (Admin only) - Supports both percentage and fixed discounts"""
    data = await request.json()
    plan_type = data.get("plan_type")  # monthly, quarterly, half_yearly, yearly
    price = data.get("price") or data.get("base_price")  # Accept both price and base_price
    discount_percentage = data.get("discount_percentage", 0)
    discount_fixed = data.get("discount_fixed", 0)
    
    if not plan_type or plan_type not in ["monthly", "quarterly", "half_yearly", "yearly"]:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    
    if price is not None and price < 0:
        raise HTTPException(status_code=400, detail="Price must be positive")
    
    if discount_percentage < 0 or discount_percentage > 100:
        raise HTTPException(status_code=400, detail="Discount percentage must be between 0-100%")
    
    if discount_fixed < 0:
        raise HTTPException(status_code=400, detail="Fixed discount must be positive")
    
    # Get or create settings
    settings = await db.settings.find_one({})
    if not settings:
        # Create initial settings with default VIP plans
        initial_settings = {
            "vip_plans": {
                "monthly": {"price": 299.0, "duration_days": 30, "discount_percentage": 0, "discount_fixed": 0, "label": "Monthly Plan"},
                "quarterly": {"price": 897.0, "duration_days": 90, "discount_percentage": 0, "discount_fixed": 0, "label": "Quarterly Plan"},
                "half_yearly": {"price": 1794.0, "duration_days": 180, "discount_percentage": 0, "discount_fixed": 0, "label": "Half-Yearly Plan"},
                "yearly": {"price": 3588.0, "duration_days": 365, "discount_percentage": 0, "discount_fixed": 0, "label": "Yearly Plan"}
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.settings.insert_one(initial_settings)
        settings = initial_settings
    
    vip_plans = settings.get("vip_plans", {})
    
    # Update plan
    if plan_type not in vip_plans:
        # Initialize with defaults
        default_labels = {
            "monthly": "Monthly Plan",
            "quarterly": "Quarterly Plan",
            "half_yearly": "Half-Yearly Plan",
            "yearly": "Yearly Plan"
        }
        default_durations = {
            "monthly": 30,
            "quarterly": 90,
            "half_yearly": 180,
            "yearly": 365
        }
        vip_plans[plan_type] = {
            "label": default_labels[plan_type],
            "duration_days": default_durations[plan_type]
        }
    
    if price is not None:
        vip_plans[plan_type]["price"] = float(price)
    
    vip_plans[plan_type]["discount_percentage"] = float(discount_percentage)
    vip_plans[plan_type]["discount_fixed"] = float(discount_fixed)
    
    # Save to database
    await db.settings.update_one(
        {},
        {"$set": {
            "vip_plans": vip_plans,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Return updated plan
    updated_plan = await get_vip_plan_pricing(plan_type)
    return {
        "message": f"VIP {plan_type} plan updated successfully",
        "plan": updated_plan
    }

@api_router.get("/admin/vip/plans")
async def get_vip_plans_admin():
    """Get all VIP plans for admin (includes edit capabilities)"""
    plans = await get_all_vip_plans()
    return {"plans": plans}

# ==================== BILL PAYMENT & RECHARGE ENDPOINTS ====================

@api_router.post("/bill-payment/request")
async def create_bill_payment_request(request: Request):
    """Create a bill payment or recharge request (User)"""
    data = await request.json()
    user_id = data.get("user_id")
    request_type = data.get("request_type")
    amount_inr = float(data.get("amount_inr"))
    details = data.get("details", {})
    
    # Validate request type
    valid_types = ["mobile_recharge", "dish_recharge", "electricity_bill", "credit_card_payment", "loan_emi"]
    if request_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid request type. Must be one of: {', '.join(valid_types)}")
    
    if amount_inr <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # VIP membership and expiry check
    access_check = await check_vip_service_access(user_id, "bill payment services")
    if not access_check["allowed"]:
        raise HTTPException(status_code=403, detail=access_check["reason"])
    
    # Calculate PRC required (100 INR = 1000 PRC)
    prc_required = await calculate_bill_payment_prc(amount_inr)
    
    # Calculate service charge
    service_charge = await get_bill_payment_service_charge(amount_inr, prc_required)
    
    # Total PRC to deduct
    total_prc = prc_required + service_charge
    
    # Check if user has enough PRC
    user_prc_balance = user.get("prc_balance", 0)
    if user_prc_balance < total_prc:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient PRC. Required: {total_prc:.2f} PRC (₹{amount_inr} + service charge), Available: {user_prc_balance:.2f} PRC"
        )
    
    # Create request
    bill_request = {
        "request_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user.get("name", "Unknown"),
        "user_email": user.get("email"),
        "user_mobile": user.get("mobile"),
        "request_type": request_type,
        "amount_inr": amount_inr,
        "prc_required": prc_required,
        "service_charge_amount": service_charge,
        "total_prc_deducted": total_prc,
        "details": details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "admin_notes": None,
        "processed_by": None
    }
    
    # Deduct PRC immediately when request is created
    new_balance = user_prc_balance - total_prc
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"prc_balance": new_balance}}
    )
    
    # Log transaction
    await log_transaction(
        user_id=user_id,
        wallet_type="prc",
        transaction_type="bill_payment_request",
        amount=total_prc,
        description=f"Bill payment request: {request_type} - ₹{amount_inr} (Request ID: {bill_request['request_id'][:8]})",
        metadata={
            "request_id": bill_request["request_id"],
            "request_type": request_type,
            "amount_inr": amount_inr,
            "prc_required": prc_required,
            "service_charge": service_charge
        }
    )
    
    # Save request
    await db.bill_payment_requests.insert_one(bill_request)
    
    return {
        "message": "Bill payment request created successfully",
        "request_id": bill_request["request_id"],
        "amount_inr": amount_inr,
        "prc_deducted": total_prc,
        "status": "pending",
        "note": "PRC has been deducted. Admin will process your request shortly."
    }

@api_router.get("/bill-payment/requests/{user_id}")
async def get_user_bill_payment_requests(user_id: str):
    """Get all bill payment requests for a user"""
    requests = await db.bill_payment_requests.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"requests": requests, "count": len(requests)}

@api_router.get("/admin/bill-payment/requests")
async def get_all_bill_payment_requests(
    status: Optional[str] = None,
    request_type: Optional[str] = None
):
    """Get all bill payment requests (Admin only)"""
    query = {}
    
    if status:
        query["status"] = status
    if request_type:
        query["request_type"] = request_type
    
    requests = await db.bill_payment_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get statistics
    total_pending = await db.bill_payment_requests.count_documents({"status": "pending"})
    total_completed = await db.bill_payment_requests.count_documents({"status": "completed"})
    total_rejected = await db.bill_payment_requests.count_documents({"status": "rejected"})
    
    return {
        "requests": requests,
        "count": len(requests),
        "stats": {
            "pending": total_pending,
            "completed": total_completed,
            "rejected": total_rejected
        }
    }

@api_router.post("/admin/bill-payment/process")
async def process_bill_payment_request(request: Request):
    """Process a bill payment request - approve, reject, or mark complete (Admin only)"""
    data = await request.json()
    request_id = data.get("request_id")
    action = data.get("action")  # approve, reject, complete
    admin_notes = data.get("admin_notes", "")
    admin_uid = data.get("admin_uid")
    
    if action not in ["approve", "reject", "complete"]:
        raise HTTPException(status_code=400, detail="Invalid action. Must be: approve, reject, or complete")
    
    # Get request
    bill_request = await db.bill_payment_requests.find_one({"request_id": request_id})
    if not bill_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    current_status = bill_request.get("status")
    user_id = bill_request.get("user_id")
    total_prc = bill_request.get("total_prc_deducted")
    
    # Handle actions
    if action == "reject":
        if current_status == "completed":
            raise HTTPException(status_code=400, detail="Cannot reject completed request")
        
        # Refund PRC to user
        user = await db.users.find_one({"uid": user_id}, {"_id": 0})
        if not user:
            print(f"⚠️ WARNING: User {user_id} not found for bill payment refund")
            raise HTTPException(status_code=404, detail="User not found for refund")
        
        new_balance = user.get("prc_balance", 0) + total_prc
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {"prc_balance": new_balance}}
        )
        
        print(f"✅ Refunded {total_prc} PRC to user {user_id}. New balance: {new_balance}")
        
        # Log refund transaction
        await log_transaction(
            user_id=user_id,
            wallet_type="prc",
            transaction_type="bill_payment_refund",
            amount=total_prc,
            description=f"Bill payment request rejected - Refund (Request ID: {request_id[:8]})",
            metadata={"request_id": request_id, "reason": "rejected"}
        )
        
        # Update request status
        await db.bill_payment_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "rejected",
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "admin_notes": admin_notes,
                "processed_by": admin_uid
            }}
        )
        
        return {"message": "Request rejected and PRC refunded", "status": "rejected"}
    
    elif action == "approve":
        if current_status != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot approve request with status: {current_status}")
        
        await db.bill_payment_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "processing",
                "admin_notes": admin_notes,
                "processed_by": admin_uid
            }}
        )
        
        return {"message": "Request approved and set to processing", "status": "processing"}
    
    elif action == "complete":
        if current_status not in ["pending", "processing"]:
            raise HTTPException(status_code=400, detail=f"Cannot complete request with status: {current_status}")
        
        await db.bill_payment_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "completed",
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "admin_notes": admin_notes,
                "processed_by": admin_uid
            }}
        )
        
        return {"message": "Request marked as completed", "status": "completed"}

# ==================== GIFT VOUCHER REDEMPTION ENDPOINTS ====================

@api_router.post("/gift-voucher/request")
async def create_gift_voucher_request(request: Request):
    """Create a PhonePe gift voucher redemption request (All user types)"""
    data = await request.json()
    user_id = data.get("user_id")
    denomination = int(data.get("denomination"))
    
    # Validate denomination
    valid_denominations = [10, 50, 100, 500, 1000, 5000]
    if denomination not in valid_denominations:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid denomination. Must be one of: {', '.join(map(str, valid_denominations))}"
        )
    
    # Get user
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # VIP membership and expiry check
    access_check = await check_vip_service_access(user_id, "gift voucher redemption")
    if not access_check["allowed"]:
        raise HTTPException(status_code=403, detail=access_check["reason"])
    
    user_role = user.get("role", "user")
    
    # Calculate PRC required (100 INR = 1000 PRC, so 10 INR = 100 PRC)
    prc_required = denomination * 10
    
    # Calculate service charge
    service_charge = await get_gift_voucher_service_charge(prc_required)
    
    # Total PRC to deduct
    total_prc = prc_required + service_charge
    
    # Check if user has enough PRC
    user_prc_balance = user.get("prc_balance", 0)
    if user_prc_balance < total_prc:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient PRC. Required: {total_prc:.2f} PRC (₹{denomination} voucher + service charge), Available: {user_prc_balance:.2f} PRC"
        )
    
    # Create request
    voucher_request = {
        "request_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user.get("name", "Unknown"),
        "user_email": user.get("email"),
        "user_mobile": user.get("mobile"),
        "user_role": user_role,
        "denomination": denomination,
        "prc_required": prc_required,
        "service_charge_amount": service_charge,
        "total_prc_deducted": total_prc,
        "status": "pending",
        "voucher_code": None,
        "voucher_details": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "admin_notes": None,
        "processed_by": None
    }
    
    # Deduct PRC immediately
    new_balance = user_prc_balance - total_prc
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"prc_balance": new_balance}}
    )
    
    # Log transaction
    await log_transaction(
        user_id=user_id,
        wallet_type="prc",
        transaction_type="gift_voucher_request",
        amount=total_prc,
        description=f"PhonePe gift voucher request: ₹{denomination} (Request ID: {voucher_request['request_id'][:8]})",
        metadata={
            "request_id": voucher_request["request_id"],
            "denomination": denomination,
            "prc_required": prc_required,
            "service_charge": service_charge
        }
    )
    
    # Save request
    await db.gift_voucher_requests.insert_one(voucher_request)
    
    return {
        "message": "Gift voucher request created successfully",
        "request_id": voucher_request["request_id"],
        "denomination": denomination,
        "prc_deducted": total_prc,
        "status": "pending",
        "note": "PRC has been deducted. Admin will process your voucher request shortly."
    }

@api_router.get("/gift-voucher/requests/{user_id}")
async def get_user_gift_voucher_requests(user_id: str):
    """Get all gift voucher requests for a user"""
    requests = await db.gift_voucher_requests.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"requests": requests, "count": len(requests)}

@api_router.get("/admin/gift-voucher/requests")
async def get_all_gift_voucher_requests(status: Optional[str] = None):
    """Get all gift voucher requests (Admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.gift_voucher_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get statistics
    total_pending = await db.gift_voucher_requests.count_documents({"status": "pending"})
    total_completed = await db.gift_voucher_requests.count_documents({"status": "completed"})
    total_rejected = await db.gift_voucher_requests.count_documents({"status": "rejected"})
    
    # Calculate total value
    total_value_pending = 0
    total_value_completed = 0
    
    async for req in db.gift_voucher_requests.find({"status": "pending"}):
        total_value_pending += req.get("denomination", 0)
    
    async for req in db.gift_voucher_requests.find({"status": "completed"}):
        total_value_completed += req.get("denomination", 0)
    
    return {
        "requests": requests,
        "count": len(requests),
        "stats": {
            "pending": total_pending,
            "completed": total_completed,
            "rejected": total_rejected,
            "total_value_pending": total_value_pending,
            "total_value_completed": total_value_completed
        }
    }

@api_router.post("/admin/gift-voucher/process")
async def process_gift_voucher_request(request: Request):
    """Process a gift voucher request - approve with voucher code or reject (Admin only)"""
    data = await request.json()
    request_id = data.get("request_id")
    action = data.get("action")  # approve, reject
    voucher_code = data.get("voucher_code")
    voucher_details = data.get("voucher_details", {})
    admin_notes = data.get("admin_notes", "")
    admin_uid = data.get("admin_uid")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action. Must be: approve or reject")
    
    # Get request
    voucher_request = await db.gift_voucher_requests.find_one({"request_id": request_id})
    if not voucher_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    current_status = voucher_request.get("status")
    user_id = voucher_request.get("user_id")
    total_prc = voucher_request.get("total_prc_deducted")
    
    if action == "reject":
        if current_status == "completed":
            raise HTTPException(status_code=400, detail="Cannot reject completed request")
        
        # Refund PRC to user
        user = await db.users.find_one({"uid": user_id}, {"_id": 0})
        if not user:
            print(f"⚠️ WARNING: User {user_id} not found for gift voucher refund")
            raise HTTPException(status_code=404, detail="User not found for refund")
        
        new_balance = user.get("prc_balance", 0) + total_prc
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {"prc_balance": new_balance}}
        )
        
        print(f"✅ Refunded {total_prc} PRC to user {user_id}. New balance: {new_balance}")
        
        # Log refund transaction
        await log_transaction(
            user_id=user_id,
            wallet_type="prc",
            transaction_type="gift_voucher_refund",
            amount=total_prc,
            description=f"Gift voucher request rejected - Refund (Request ID: {request_id[:8]})",
            metadata={"request_id": request_id, "reason": "rejected"}
        )
        
        # Update request status
        await db.gift_voucher_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "rejected",
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "admin_notes": admin_notes,
                "processed_by": admin_uid
            }}
        )
        
        return {"message": "Request rejected and PRC refunded", "status": "rejected"}
    
    elif action == "approve":
        if current_status != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot approve request with status: {current_status}")
        
        if not voucher_code:
            raise HTTPException(status_code=400, detail="Voucher code is required for approval")
        
        # Update request status
        await db.gift_voucher_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "completed",
                "voucher_code": voucher_code,
                "voucher_details": voucher_details,
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "admin_notes": admin_notes,
                "processed_by": admin_uid
            }}
        )
        
        return {
            "message": "Gift voucher approved and provided to user",
            "status": "completed",
            "voucher_code": voucher_code
        }

# ==================== ADMIN SERVICE CHARGE CONFIGURATION ====================

@api_router.get("/admin/service-charges")
async def get_service_charge_config():
    """Get service charge configuration (Admin only)"""
    settings = await db.settings.find_one({}, {"_id": 0})
    
    if not settings:
        # Return defaults
        return {
            "bill_payment": {
                "charge_type": "percentage",
                "charge_percentage": 2.0,
                "charge_fixed": 20.0
            },
            "gift_voucher": {
                "charge_type": "percentage",
                "charge_percentage": 5.0,
                "charge_fixed": 50.0
            }
        }
    
    return {
        "bill_payment": {
            "charge_type": settings.get("bill_payment_charge_type", "percentage"),
            "charge_percentage": settings.get("bill_payment_charge_percentage", 2.0),
            "charge_fixed": settings.get("bill_payment_charge_fixed", 20.0)
        },
        "gift_voucher": {
            "charge_type": settings.get("gift_voucher_charge_type", "percentage"),
            "charge_percentage": settings.get("gift_voucher_charge_percentage", 5.0),
            "charge_fixed": settings.get("gift_voucher_charge_fixed", 50.0)
        }
    }

@api_router.post("/admin/service-charges")
async def update_service_charge_config(request: Request):
    """Update service charge configuration (Admin only)"""
    data = await request.json()
    service_type = data.get("service_type")  # bill_payment or gift_voucher
    charge_type = data.get("charge_type")  # percentage or fixed
    charge_percentage = data.get("charge_percentage")
    charge_fixed = data.get("charge_fixed")
    
    if service_type not in ["bill_payment", "gift_voucher"]:
        raise HTTPException(status_code=400, detail="Invalid service type")
    
    if charge_type not in ["percentage", "fixed"]:
        raise HTTPException(status_code=400, detail="Invalid charge type. Must be 'percentage' or 'fixed'")
    
    update_data = {}
    
    if service_type == "bill_payment":
        update_data["bill_payment_charge_type"] = charge_type
        if charge_percentage is not None:
            update_data["bill_payment_charge_percentage"] = float(charge_percentage)
        if charge_fixed is not None:
            update_data["bill_payment_charge_fixed"] = float(charge_fixed)
    else:
        update_data["gift_voucher_charge_type"] = charge_type
        if charge_percentage is not None:
            update_data["gift_voucher_charge_percentage"] = float(charge_percentage)
        if charge_fixed is not None:
            update_data["gift_voucher_charge_fixed"] = float(charge_fixed)
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one({}, {"$set": update_data}, upsert=True)
    
    return {"message": "Service charge configuration updated successfully", "config": update_data}

# ==================== MINING SETTINGS ====================

@api_router.get("/admin/mining-settings")
async def get_mining_settings():
    """Get mining formula settings"""
    settings = await db.settings.find_one({}, {"_id": 0, "mining_settings": 1})
    
    default_settings = {
        "base_rate": 0.5,
        "vip_multiplier": 2,
        "max_daily_mining_hours": 24,
        "prc_to_inr_ratio": 10
    }
    
    if settings and settings.get("mining_settings"):
        return {**default_settings, **settings["mining_settings"]}
    return default_settings

@api_router.post("/admin/mining-settings")
async def update_mining_settings(request: Request):
    """Update mining formula settings"""
    data = await request.json()
    
    mining_settings = {
        "base_rate": float(data.get("base_rate", 0.5)),
        "vip_multiplier": float(data.get("vip_multiplier", 2)),
        "max_daily_mining_hours": int(data.get("max_daily_mining_hours", 24)),
        "prc_to_inr_ratio": int(data.get("prc_to_inr_ratio", 10)),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.settings.update_one(
        {},
        {"$set": {"mining_settings": mining_settings}},
        upsert=True
    )
    
    return {"success": True, "message": "Mining settings updated successfully", "settings": mining_settings}

# ==================== CONTACT & LOGO SETTINGS ====================

@api_router.get("/admin/contact-settings")
async def get_contact_settings():
    """Get contact information settings"""
    settings = await db.settings.find_one({}, {"_id": 0, "contact_settings": 1})
    
    default_settings = {
        "company_name": "PARAS REWARD",
        "address_line1": "",
        "address_line2": "",
        "city": "",
        "state": "",
        "pincode": "",
        "country": "India",
        "phone_primary": "",
        "phone_secondary": "",
        "email_support": "",
        "email_business": "",
        "working_hours": "9:00 AM - 6:00 PM (Mon-Sat)"
    }
    
    if settings and settings.get("contact_settings"):
        return {**default_settings, **settings["contact_settings"]}
    return default_settings

@api_router.post("/admin/contact-settings/update")
async def update_contact_settings(request: Request):
    """Update contact information settings"""
    data = await request.json()
    
    contact_settings = {
        "company_name": data.get("company_name", "PARAS REWARD"),
        "address_line1": data.get("address_line1", ""),
        "address_line2": data.get("address_line2", ""),
        "city": data.get("city", ""),
        "state": data.get("state", ""),
        "pincode": data.get("pincode", ""),
        "country": data.get("country", "India"),
        "phone_primary": data.get("phone_primary", ""),
        "phone_secondary": data.get("phone_secondary", ""),
        "email_support": data.get("email_support", ""),
        "email_business": data.get("email_business", ""),
        "working_hours": data.get("working_hours", "9:00 AM - 6:00 PM (Mon-Sat)"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.settings.update_one(
        {},
        {"$set": {"contact_settings": contact_settings}},
        upsert=True
    )
    
    return {"success": True, "message": "Contact settings updated successfully"}

@api_router.get("/admin/logo-settings")
async def get_logo_settings():
    """Get logo and branding settings"""
    settings = await db.settings.find_one({}, {"_id": 0, "logo_settings": 1})
    
    default_settings = {
        "logo_url": "",
        "footer_logo_url": "",
        "favicon_url": "",
        "app_name": "PARAS REWARD",
        "tagline": "Earn Rewards, Live Better"
    }
    
    if settings and settings.get("logo_settings"):
        return {**default_settings, **settings["logo_settings"]}
    return default_settings

@api_router.post("/admin/logo-settings/update")
async def update_logo_settings(request: Request):
    """Update logo and branding settings"""
    data = await request.json()
    
    logo_settings = {
        "logo_url": data.get("logo_url", ""),
        "footer_logo_url": data.get("footer_logo_url", ""),
        "favicon_url": data.get("favicon_url", ""),
        "app_name": data.get("app_name", "PARAS REWARD"),
        "tagline": data.get("tagline", "Earn Rewards, Live Better"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.settings.update_one(
        {},
        {"$set": {"logo_settings": logo_settings}},
        upsert=True
    )
    
    return {"success": True, "message": "Logo settings updated successfully"}

@api_router.post("/admin/logo-upload")
async def upload_logo(file: UploadFile = File(...), logo_type: str = Form("logo")):
    """Upload logo, footer logo, or favicon image with auto-resize"""
    import io
    from PIL import Image
    
    # Read file
    contents = await file.read()
    
    # Open and process image
    try:
        img = Image.open(io.BytesIO(contents))
        
        # Auto-resize based on type
        if logo_type == "favicon":
            img = img.resize((64, 64), Image.Resampling.LANCZOS)
        else:  # logo or footer_logo
            # Maintain aspect ratio, max width 400px
            max_width = 400
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Save to bytes
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG', optimize=True)
        img_byte_arr = img_byte_arr.getvalue()
        
        # Generate filename
        import uuid
        filename = f"{logo_type}_{uuid.uuid4().hex[:8]}.png"
        filepath = f"/app/frontend/public/uploads/{filename}"
        
        # Ensure directory exists
        import os
        os.makedirs("/app/frontend/public/uploads", exist_ok=True)
        
        # Save file
        with open(filepath, "wb") as f:
            f.write(img_byte_arr)
        
        # Return URL
        image_url = f"/uploads/{filename}"
        
        # Update settings based on logo type
        if logo_type == "favicon":
            await db.settings.update_one({}, {"$set": {"logo_settings.favicon_url": image_url}}, upsert=True)
        elif logo_type == "footer_logo":
            await db.settings.update_one({}, {"$set": {"logo_settings.footer_logo_url": image_url}}, upsert=True)
        else:
            await db.settings.update_one({}, {"$set": {"logo_settings.logo_url": image_url}}, upsert=True)
        
        return {"success": True, "url": image_url, "message": f"{logo_type.replace('_', ' ').capitalize()} uploaded successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

# ==================== REFERRAL BONUS SETTINGS ====================

@api_router.get("/admin/referral-bonus-settings")
async def get_referral_bonus_settings():
    """Get referral bonus settings for all 5 levels (Admin only)"""
    settings = await db.settings.find_one({}, {"_id": 0, "referral_bonus_settings": 1})
    
    # Default settings
    default_settings = {
        "level_1": 10,    # 10%
        "level_2": 5,     # 5%
        "level_3": 2.5,   # 2.5%
        "level_4": 1.5,   # 1.5%
        "level_5": 1      # 1%
    }
    
    if settings and "referral_bonus_settings" in settings:
        return {"referral_bonus_settings": settings["referral_bonus_settings"]}
    
    return {"referral_bonus_settings": default_settings}

@api_router.post("/admin/referral-bonus-settings")
async def update_referral_bonus_settings(request: Request):
    """Update referral bonus settings for all 5 levels (Admin only)"""
    data = await request.json()
    
    # Validate all levels are provided
    required_levels = ["level_1", "level_2", "level_3", "level_4", "level_5"]
    for level in required_levels:
        if level not in data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {level}")
        if not isinstance(data[level], (int, float)) or data[level] < 0 or data[level] > 100:
            raise HTTPException(status_code=400, detail=f"Invalid value for {level}. Must be between 0 and 100")
    
    referral_settings = {
        "level_1": float(data["level_1"]),
        "level_2": float(data["level_2"]),
        "level_3": float(data["level_3"]),
        "level_4": float(data["level_4"]),
        "level_5": float(data["level_5"]),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.settings.update_one(
        {},
        {"$set": {"referral_bonus_settings": referral_settings}},
        upsert=True
    )
    
    return {
        "message": "Referral bonus settings updated successfully",
        "referral_bonus_settings": referral_settings
    }

# ==================== PRC RAIN DROP SETTINGS ====================

@api_router.get("/admin/prc-rain/settings")
async def get_prc_rain_settings():
    """Get PRC Rain Drop configuration (Admin only)"""
    settings = await db.settings.find_one({}, {"_id": 0, "prc_rain_settings": 1})
    
    # Default settings
    default_settings = {
        "enabled": False,
        "max_rain_events_per_day": 5,
        "min_gap_between_rains_minutes": 60,
        "rain_duration_seconds": 30,
        "max_taps_per_rain": 15,
        "max_prc_gain_per_day": 50,
        "max_prc_loss_per_day": 20,
        "enable_negative_drops": True,
        "negative_drop_probability": 20,
        "emergency_stop": False,
        "prc_range": {
            "min": 1,
            "max": 25
        },
        "drop_colors": ["#22c55e", "#3b82f6", "#eab308", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"],
        "rain_schedule": []
    }
    
    if settings and "prc_rain_settings" in settings:
        return {"prc_rain_settings": settings["prc_rain_settings"]}
    
    return {"prc_rain_settings": default_settings}

@api_router.post("/admin/prc-rain/settings")
async def update_prc_rain_settings(request: Request):
    """Update PRC Rain Drop configuration (Admin only)"""
    data = await request.json()
    
    rain_settings = {
        "enabled": bool(data.get("enabled", False)),
        "max_rain_events_per_day": max(2, min(100, int(data.get("max_rain_events_per_day", 5)))),
        "min_gap_between_rains_minutes": max(1, int(data.get("min_gap_between_rains_minutes", 60))),
        "rain_duration_seconds": int(data.get("rain_duration_seconds", 30)),
        "max_taps_per_rain": max(1, min(50, int(data.get("max_taps_per_rain", 15)))),
        "max_prc_gain_per_day": float(data.get("max_prc_gain_per_day", 50)),
        "max_prc_loss_per_day": float(data.get("max_prc_loss_per_day", 20)),
        "enable_negative_drops": bool(data.get("enable_negative_drops", True)),
        "negative_drop_probability": max(0, min(100, int(data.get("negative_drop_probability", 20)))),
        "emergency_stop": bool(data.get("emergency_stop", False)),
        "prc_range": {
            "min": float(data.get("prc_range", {}).get("min", 1)),
            "max": float(data.get("prc_range", {}).get("max", 25))
        },
        "drop_colors": data.get("drop_colors", ["#22c55e", "#3b82f6", "#eab308", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.settings.update_one(
        {},
        {"$set": {"prc_rain_settings": rain_settings}},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "PRC Rain settings updated",
        "prc_rain_settings": rain_settings
    }

@api_router.post("/admin/prc-rain/emergency-stop")
async def emergency_stop_rain():
    """Emergency stop all PRC Rain events (Admin only)"""
    await db.settings.update_one(
        {},
        {"$set": {
            "prc_rain_settings.emergency_stop": True,
            "prc_rain_settings.enabled": False
        }},
        upsert=True
    )
    
    # Cancel any active rain sessions
    await db.prc_rain_sessions.update_many(
        {"status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Emergency stop activated. All rain events cancelled."}

@api_router.get("/admin/prc-rain/stats")
async def get_prc_rain_stats():
    """Get PRC Rain statistics (Admin only)"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = today_start.isoformat()
    
    # Today's rain events
    today_events = await db.prc_rain_sessions.count_documents({
        "created_at": {"$gte": today_iso}
    })
    
    # Total PRC distributed today
    pipeline = [
        {"$match": {"event_type": "PRC_RAIN", "created_at": {"$gte": today_iso}}},
        {"$group": {
            "_id": None,
            "total_positive": {"$sum": {"$cond": [{"$gt": ["$prc_change", 0]}, "$prc_change", 0]}},
            "total_negative": {"$sum": {"$cond": [{"$lt": ["$prc_change", 0]}, {"$abs": "$prc_change"}, 0]}},
            "total_taps": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"}
        }}
    ]
    
    stats_result = await db.prc_rain_ledger.aggregate(pipeline).to_list(1)
    stats = stats_result[0] if stats_result else {
        "total_positive": 0,
        "total_negative": 0,
        "total_taps": 0,
        "unique_users": []
    }
    
    return {
        "today": {
            "rain_events": today_events,
            "total_prc_given": stats.get("total_positive", 0),
            "total_prc_taken": stats.get("total_negative", 0),
            "net_prc": stats.get("total_positive", 0) - stats.get("total_negative", 0),
            "total_taps": stats.get("total_taps", 0),
            "unique_users": len(stats.get("unique_users", []))
        }
    }

# ==================== PRC RAIN USER ENDPOINTS ====================

@api_router.get("/prc-rain/check/{uid}")
async def check_rain_status(uid: str):
    """Check if rain should start for user (called every 2-3 minutes by client)"""
    settings = await db.settings.find_one({}, {"_id": 0, "prc_rain_settings": 1})
    rain_config = settings.get("prc_rain_settings", {}) if settings else {}
    
    # Check if rain is enabled and not emergency stopped
    if not rain_config.get("enabled", False) or rain_config.get("emergency_stop", False):
        return {"should_rain": False, "reason": "disabled"}
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = today_start.isoformat()
    
    # Check if user already had max rain events today
    user_rain_today = await db.prc_rain_sessions.count_documents({
        "user_id": uid,
        "created_at": {"$gte": today_iso}
    })
    
    max_events = rain_config.get("max_rain_events_per_day", 5)
    if user_rain_today >= max_events:
        return {"should_rain": False, "reason": "max_events_reached"}
    
    # Check minimum gap between rains (in MINUTES)
    min_gap_minutes = rain_config.get("min_gap_between_rains_minutes", 60)
    last_rain = await db.prc_rain_sessions.find_one(
        {"user_id": uid},
        sort=[("created_at", -1)]
    )
    
    if last_rain:
        last_rain_time = datetime.fromisoformat(last_rain["created_at"].replace('Z', '+00:00'))
        if (now - last_rain_time).total_seconds() < min_gap_minutes * 60:
            return {"should_rain": False, "reason": "too_soon"}
    
    # Random trigger logic - 30% chance on each check (increased for better engagement)
    import random
    if random.random() > 0.30:  # 70% chance of no rain, 30% chance to trigger
        return {"should_rain": False, "reason": "not_triggered"}
    
    # Create rain session
    session_id = str(uuid.uuid4())
    rain_session = {
        "session_id": session_id,
        "user_id": uid,
        "status": "active",
        "taps_count": 0,
        "prc_gained": 0,
        "prc_lost": 0,
        "drops_tapped": [],
        "created_at": now.isoformat(),
        "duration_seconds": rain_config.get("rain_duration_seconds", 30),
        "max_taps": rain_config.get("max_taps_per_rain", 15)
    }
    
    await db.prc_rain_sessions.insert_one(rain_session)
    
    # Send random config - USER SHOULD NOT KNOW WHICH DROP IS POSITIVE/NEGATIVE
    return {
        "should_rain": True,
        "session_id": session_id,
        "duration_seconds": rain_config.get("rain_duration_seconds", 30),
        "max_taps": rain_config.get("max_taps_per_rain", 15),
        "drop_colors": rain_config.get("drop_colors", ["#22c55e", "#3b82f6", "#eab308", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"])
    }

@api_router.post("/prc-rain/tap")
async def tap_rain_drop(request: Request):
    """Record a tap on a rain drop - RANDOM PRC, user doesn't know outcome"""
    data = await request.json()
    session_id = data.get("session_id")
    user_id = data.get("user_id")
    drop_color = data.get("drop_color")  # Just color, no type info
    
    if not all([session_id, user_id]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # Get session
    session = await db.prc_rain_sessions.find_one({"session_id": session_id, "user_id": user_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.get("status") != "active":
        raise HTTPException(status_code=400, detail="Session is not active")
    
    # Check tap limit
    if session.get("taps_count", 0) >= session.get("max_taps", 15):
        return {"success": False, "reason": "max_taps_reached", "prc_change": 0}
    
    # Get settings
    settings = await db.settings.find_one({}, {"_id": 0, "prc_rain_settings": 1})
    rain_config = settings.get("prc_rain_settings", {}) if settings else {}
    
    # RANDOM PRC calculation - user doesn't know which is positive/negative!
    import random
    prc_range = rain_config.get("prc_range", {"min": 1, "max": 25})
    prc_min = float(prc_range.get("min", 1) or 1)  # Handle empty/None values
    prc_max = float(prc_range.get("max", 25) or 25)
    
    # Ensure min <= max
    if prc_min > prc_max:
        prc_min, prc_max = prc_max, prc_min
    if prc_min <= 0:
        prc_min = 0.1
    
    prc_amount = round(random.uniform(prc_min, prc_max), 2)
    
    # Random positive/negative based on probability
    negative_prob = float(rain_config.get("negative_drop_probability", 20) or 20) / 100
    enable_negative = rain_config.get("enable_negative_drops", True)
    
    is_negative = enable_negative and random.random() < negative_prob
    prc_change = -prc_amount if is_negative else prc_amount
    original_prc_change = prc_change  # Store original for logging
    
    # Check daily limits
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    user_today_stats = await db.prc_rain_ledger.aggregate([
        {"$match": {"user_id": user_id, "created_at": {"$gte": today_start}}},
        {"$group": {
            "_id": None,
            "total_gain": {"$sum": {"$cond": [{"$gt": ["$prc_change", 0]}, "$prc_change", 0]}},
            "total_loss": {"$sum": {"$cond": [{"$lt": ["$prc_change", 0]}, {"$abs": "$prc_change"}, 0]}}
        }}
    ]).to_list(1)
    
    today_gain = user_today_stats[0]["total_gain"] if user_today_stats else 0
    today_loss = user_today_stats[0]["total_loss"] if user_today_stats else 0
    
    max_gain = float(rain_config.get("max_prc_gain_per_day", 50) or 50)
    max_loss = float(rain_config.get("max_prc_loss_per_day", 20) or 20)
    
    # Apply daily cap - but keep at least minimum amount
    if prc_change > 0 and today_gain + prc_change > max_gain:
        remaining_gain = max_gain - today_gain
        prc_change = max(0, remaining_gain)
    elif prc_change < 0 and today_loss + abs(prc_change) > max_loss:
        remaining_loss = max_loss - today_loss
        prc_change = -max(0, remaining_loss) if remaining_loss > 0 else 0
    
    # Check user's current balance for negative drops - allow small negatives
    if prc_change < 0:
        user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1})
        user_balance = user.get("prc_balance", 0) if user else 0
        if user_balance < abs(prc_change):
            # Reduce the loss to not exceed balance
            prc_change = -user_balance if user_balance > 0 else 0
    
    # Update user balance if there's a change
    if prc_change != 0:
        await log_transaction(
            user_id=user_id,
            transaction_type="prc_rain_gain" if prc_change > 0 else "prc_rain_loss",
            amount=abs(prc_change),
            description=f"PRC Rain Drop",
            wallet_type="prc"
        )
    
    # Create ledger entry
    ledger_entry = {
        "ledger_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_id": session_id,
        "event_type": "PRC_RAIN",
        "drop_color": drop_color,
        "prc_change": prc_change,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.prc_rain_ledger.insert_one(ledger_entry)
    
    # Update session
    update_data = {
        "$inc": {"taps_count": 1},
        "$push": {"drops_tapped": drop_color}
    }
    if prc_change > 0:
        update_data["$inc"]["prc_gained"] = prc_change
    else:
        update_data["$inc"]["prc_lost"] = abs(prc_change)
    
    await db.prc_rain_sessions.update_one(
        {"session_id": session_id},
        update_data
    )
    
    return {
        "success": True,
        "prc_change": prc_change,
        "is_negative": is_negative,
        "taps_remaining": session.get("max_taps", 15) - session.get("taps_count", 0) - 1
    }

@api_router.post("/prc-rain/end-session")
async def end_rain_session(request: Request):
    """End a rain session"""
    data = await request.json()
    session_id = data.get("session_id")
    user_id = data.get("user_id")
    
    result = await db.prc_rain_sessions.update_one(
        {"session_id": session_id, "user_id": user_id, "status": "active"},
        {"$set": {"status": "completed", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get session summary
    session = await db.prc_rain_sessions.find_one({"session_id": session_id})
    
    return {
        "success": True,
        "summary": {
            "taps": session.get("taps_count", 0) if session else 0,
            "prc_gained": session.get("prc_gained", 0) if session else 0,
            "prc_lost": session.get("prc_lost", 0) if session else 0,
            "net_prc": (session.get("prc_gained", 0) - session.get("prc_lost", 0)) if session else 0
        }
    }

@api_router.get("/admin/users-at-risk")
async def get_users_at_risk_of_burn():
    """Get users whose PRC is about to be burned (Admin only)"""
    now = datetime.now(timezone.utc)
    burn_threshold = now - timedelta(days=2)
    grace_period_end = now - timedelta(days=5)
    
    # Free users with PRC expiring soon (within 12 hours)
    warning_threshold = now - timedelta(hours=36)  # 36 hours old = 12 hours to burn
    
    free_users_at_risk = []
    async for user in db.users.find({
        "membership_type": {"$ne": "vip"},
        "mining_history": {"$exists": True}
    }).limit(50):
        at_risk_prc = 0
        for entry in user.get("mining_history", []):
            if not entry.get("burned", False):
                try:
                    mining_time = datetime.fromisoformat(entry.get("timestamp", "").replace('Z', '+00:00'))
                    if mining_time < warning_threshold:
                        at_risk_prc += entry.get("amount", 0)
                except:
                    pass
        
        if at_risk_prc > 0:
            free_users_at_risk.append({
                "uid": user.get("uid"),
                "name": user.get("name"),
                "email": user.get("email"),
                "at_risk_prc": at_risk_prc
            })
    
    # VIP users expired (in grace period)
    expired_vips_at_risk = []
    async for user in db.users.find({
        "membership_type": "vip",
        "vip_expiry": {"$exists": True}
    }).limit(50):
        try:
            expiry = datetime.fromisoformat(user.get("vip_expiry", "").replace('Z', '+00:00'))
            if expiry < now and expiry > grace_period_end:
                days_expired = (now - expiry).days
                expired_vips_at_risk.append({
                    "uid": user.get("uid"),
                    "name": user.get("name"),
                    "email": user.get("email"),
                    "prc_balance": user.get("prc_balance", 0),
                    "days_expired": days_expired,
                    "days_until_burn": 5 - days_expired
                })
        except:
            pass
    
    return {
        "free_users_at_risk": free_users_at_risk,
        "expired_vips_at_risk": expired_vips_at_risk
    }

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
            # VIP Membership Plans
            "vip_plans": {
                "monthly": {
                    "price": 299.0,
                    "duration_days": 30,
                    "discount_percentage": 0,
                    "label": "Monthly Plan"
                },
                "quarterly": {
                    "price": 799.0,
                    "duration_days": 90,
                    "discount_percentage": 10,
                    "label": "Quarterly Plan"
                },
                "half_yearly": {
                    "price": 1499.0,
                    "duration_days": 180,
                    "discount_percentage": 15,
                    "label": "Half-Yearly Plan"
                },
                "yearly": {
                    "price": 2799.0,
                    "duration_days": 365,
                    "discount_percentage": 20,
                    "label": "Yearly Plan"
                }
            },
            "master_security_deposit": 500000.0,
            "sub_security_deposit": 300000.0,
            "outlet_security_deposit": 100000.0,
            "security_deposit_return_rate": 0.03,
            "master_renewal_fee": 50000.0,
            "sub_renewal_fee": 30000.0,
            "outlet_renewal_fee": 10000.0,
            "registration_enabled": True,
            "registration_message": "New user registrations are currently closed. Please check back later.",
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
    vip_membership_fee: Optional[float] = None,
    registration_enabled: Optional[bool] = None,
    registration_message: Optional[str] = None
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
    if registration_enabled is not None:
        update_data["registration_enabled"] = registration_enabled
    if registration_message is not None:
        update_data["registration_message"] = registration_message
    
    await db.settings.update_one({}, {"$set": update_data}, upsert=True)
    return {"message": "Settings updated"}

# Note: app.include_router moved to after all route definitions

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
    try:
        query = {"user_id": user_id}
        if unread_only:
            query["is_read"] = False
        
        notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        
        return {
            "notifications": notifications,
            "count": len(notifications)
        }
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return {
            "notifications": [],
            "count": 0
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

# ==================== AUTOMATIC WALLET RECONCILIATION ====================

async def daily_wallet_reconciliation():
    """
    Daily automatic wallet reconciliation
    Runs at 3 AM to reconcile all company wallets based on transactions
    """
    try:
        now = datetime.now(timezone.utc)
        yesterday = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        yesterday_str = yesterday.isoformat()
        today_str = today.isoformat()
        
        reconciliation_report = {
            "reconciliation_id": str(uuid.uuid4()),
            "date": yesterday.strftime("%Y-%m-%d"),
            "created_at": now.isoformat(),
            "wallets": {}
        }
        
        # 1. SUBSCRIPTION WALLET - VIP Payments approved yesterday
        vip_payments = await db.vip_payments.find({
            "status": "approved",
            "approved_at": {"$gte": yesterday_str, "$lt": today_str}
        }).to_list(1000)
        
        vip_total = sum(p.get("amount", 0) for p in vip_payments)
        reconciliation_report["wallets"]["subscription"] = {
            "expected_credit": vip_total,
            "transactions": len(vip_payments),
            "source": "VIP Payments"
        }
        
        # 2. ADS REVENUE WALLET - Ads income added yesterday
        ads_income = await db.ads_income.find({
            "created_at": {"$gte": yesterday_str, "$lt": today_str}
        }).to_list(1000)
        
        ads_total = sum(a.get("revenue_amount", 0) for a in ads_income)
        reconciliation_report["wallets"]["ads_revenue"] = {
            "expected_credit": ads_total,
            "transactions": len(ads_income),
            "source": "Ads Income"
        }
        
        # 3. REDEEM RESERVE WALLET - Redemptions processed yesterday
        redemptions = await db.gift_voucher_requests.find({
            "status": "completed",
            "completed_at": {"$gte": yesterday_str, "$lt": today_str}
        }).to_list(1000)
        
        bill_payments = await db.bill_payment_requests.find({
            "status": "completed",
            "completed_at": {"$gte": yesterday_str, "$lt": today_str}
        }).to_list(1000)
        
        redeem_total = sum(r.get("amount_inr", 0) for r in redemptions) + sum(b.get("amount_inr", 0) for b in bill_payments)
        reconciliation_report["wallets"]["redeem_reserve"] = {
            "expected_debit": redeem_total,
            "transactions": len(redemptions) + len(bill_payments),
            "source": "Redemptions & Bill Payments"
        }
        
        # 4. Calculate net profit for the day
        total_income = vip_total + ads_total
        total_expense = redeem_total
        
        # Get fixed expenses for the month
        current_month = now.strftime("%Y-%m")
        fixed_expenses = await db.fixed_expenses.find({
            "month": current_month,
            "paid_status": "paid"
        }).to_list(100)
        monthly_fixed = sum(e.get("amount", 0) for e in fixed_expenses)
        daily_fixed_expense = monthly_fixed / 30  # Approximate daily
        
        net_profit = total_income - total_expense - daily_fixed_expense
        
        reconciliation_report["summary"] = {
            "total_income": total_income,
            "total_expense": total_expense + daily_fixed_expense,
            "net_profit_loss": net_profit,
            "daily_fixed_expense": daily_fixed_expense
        }
        
        # 5. Auto-transfer net profit to profit wallet if positive
        if net_profit > 0:
            await db.company_wallets.update_one(
                {"wallet_type": "profit"},
                {
                    "$inc": {"balance": net_profit, "total_credit": net_profit},
                    "$set": {"last_updated": now.isoformat()}
                },
                upsert=True
            )
            
            # Log the transfer
            await db.company_wallet_transactions.insert_one({
                "txn_id": str(uuid.uuid4()),
                "wallet_type": "profit",
                "amount": net_profit,
                "type": "credit",
                "description": f"Daily profit reconciliation for {yesterday.strftime('%Y-%m-%d')}",
                "timestamp": now.isoformat(),
                "auto_reconciliation": True
            })
            
            reconciliation_report["profit_transfer"] = net_profit
        
        # 6. Save reconciliation report (make a copy to avoid _id being added to response)
        report_to_save = {**reconciliation_report}
        await db.wallet_reconciliations.insert_one(report_to_save)
        
        logging.info(f"Wallet reconciliation complete for {yesterday.strftime('%Y-%m-%d')}: Income=₹{total_income}, Expense=₹{total_expense}, Net=₹{net_profit}")
        
        return reconciliation_report
        
    except Exception as e:
        logging.error(f"Error in daily wallet reconciliation: {e}")
        return {"error": str(e)}

@api_router.get("/admin/finance/reconciliation/history")
async def get_reconciliation_history(limit: int = 30):
    """Get wallet reconciliation history"""
    try:
        reports = await db.wallet_reconciliations.find(
            {}, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return {"reports": reports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/finance/reconciliation/run")
async def run_manual_reconciliation():
    """Manually trigger wallet reconciliation"""
    try:
        report = await daily_wallet_reconciliation()
        return {"success": True, "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/finance/reconciliation/status")
async def get_reconciliation_status():
    """Get current wallet status with expected vs actual balances"""
    try:
        now = datetime.now(timezone.utc)
        
        # Get all company wallets
        wallets = await db.company_wallets.find({}, {"_id": 0}).to_list(10)
        
        # Calculate expected balances based on all transactions
        status = []
        
        for wallet in wallets:
            wallet_type = wallet.get("wallet_type")
            actual_balance = wallet.get("balance", 0)
            
            # Calculate expected from transactions
            expected_credit = 0
            expected_debit = 0
            
            if wallet_type == "subscription":
                # Sum all approved VIP payments
                async for p in db.vip_payments.find({"status": "approved"}, {"amount": 1}):
                    expected_credit += p.get("amount", 0)
                    
            elif wallet_type == "ads_revenue":
                # Sum all ads income
                async for a in db.ads_income.find({}, {"revenue_amount": 1}):
                    expected_credit += a.get("revenue_amount", 0)
            
            # Get wallet transactions
            async for txn in db.company_wallet_transactions.find({"wallet_type": wallet_type}):
                if txn.get("type") == "credit":
                    expected_credit += txn.get("amount", 0)
                else:
                    expected_debit += txn.get("amount", 0)
            
            expected_balance = expected_credit - expected_debit
            discrepancy = actual_balance - expected_balance
            
            status.append({
                "wallet_name": wallet.get("wallet_name"),
                "wallet_type": wallet_type,
                "actual_balance": actual_balance,
                "expected_balance": expected_balance,
                "discrepancy": discrepancy,
                "is_reconciled": abs(discrepancy) < 0.01,  # Allow for floating point
                "total_credit": expected_credit,
                "total_debit": expected_debit
            })
        
        all_reconciled = all(s["is_reconciled"] for s in status)
        
        return {
            "status": status,
            "all_reconciled": all_reconciled,
            "checked_at": now.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== USER WALLET LEDGER (Admin Only) ====================

@api_router.get("/admin/finance/user-ledger")
async def get_all_user_ledger(
    page: int = 1, 
    limit: int = 50, 
    user_id: str = None,
    wallet_type: str = None,
    transaction_type: str = None,
    date_from: str = None,
    date_to: str = None
):
    """
    Get comprehensive user wallet ledger for all users (Admin only)
    This is an append-only, non-editable ledger showing all user transactions
    """
    try:
        query = {}
        
        if user_id:
            query["user_id"] = user_id
        if wallet_type:
            query["wallet_type"] = wallet_type
        if transaction_type:
            query["type"] = transaction_type
        if date_from:
            query["created_at"] = {"$gte": date_from}
        if date_to:
            if "created_at" in query:
                query["created_at"]["$lte"] = date_to
            else:
                query["created_at"] = {"$lte": date_to}
        
        total = await db.transactions.count_documents(query)
        skip = (page - 1) * limit
        
        transactions = await db.transactions.find(
            query, {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Enrich with user data
        enriched = []
        for txn in transactions:
            user = await db.users.find_one({"uid": txn.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
            txn["user_name"] = user.get("name", "Unknown") if user else "Unknown"
            txn["user_email"] = user.get("email", "N/A") if user else "N/A"
            enriched.append(txn)
        
        # Calculate summary stats
        summary_pipeline = [
            {"$match": query},
            {"$group": {
                "_id": "$type",
                "total_amount": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }}
        ]
        summary_data = await db.transactions.aggregate(summary_pipeline).to_list(50)
        summary = {item["_id"]: {"amount": item["total_amount"], "count": item["count"]} for item in summary_data}
        
        return {
            "transactions": enriched,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit,
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/finance/user-ledger/{uid}")
async def get_user_wallet_ledger(uid: str, page: int = 1, limit: int = 50):
    """Get complete wallet ledger for a specific user (Admin view)"""
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "name": 1, "email": 1, "prc_balance": 1, "cash_wallet_balance": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        total = await db.transactions.count_documents({"user_id": uid})
        skip = (page - 1) * limit
        
        transactions = await db.transactions.find(
            {"user_id": uid}, {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Calculate totals
        pipeline = [
            {"$match": {"user_id": uid}},
            {"$group": {
                "_id": "$wallet_type",
                "total_credit": {
                    "$sum": {
                        "$cond": [
                            {"$in": ["$type", ["mining", "tap_game", "referral", "cashback", "withdrawal_rejected", "admin_credit", "profit_share"]]},
                            "$amount", 0
                        ]
                    }
                },
                "total_debit": {
                    "$sum": {
                        "$cond": [
                            {"$in": ["$type", ["order", "withdrawal", "admin_debit", "prc_burn", "bill_payment_request", "gift_voucher_request"]]},
                            "$amount", 0
                        ]
                    }
                }
            }}
        ]
        wallet_stats = await db.transactions.aggregate(pipeline).to_list(10)
        
        return {
            "user": user,
            "transactions": transactions,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit,
            "wallet_stats": {s["_id"]: {"credit": s["total_credit"], "debit": s["total_debit"]} for s in wallet_stats}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== REDEEM SAFETY SETTINGS ====================

@api_router.get("/admin/finance/redeem-settings")
async def get_redeem_settings():
    """Get current redemption safety settings"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "redeem_settings": 1})
        
        # Default settings if not configured
        default_settings = {
            "daily_limit_per_user": 5000,  # Max INR per user per day
            "daily_limit_global": 100000,  # Max INR total per day
            "manual_approval_threshold": 1000,  # Auto-approve below this, manual above
            "cool_off_period_hours": 24,  # Hours between redemptions
            "min_kyc_status": "verified",  # KYC requirement
            "min_vip_days": 7,  # Minimum VIP tenure for redemptions
            "max_redemptions_per_day": 3,  # Max transactions per user per day
            "suspicious_amount_threshold": 2000,  # Flag for review above this
            "enabled": True
        }
        
        if settings and "redeem_settings" in settings:
            return {"settings": settings["redeem_settings"]}
        return {"settings": default_settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/admin/finance/redeem-settings")
async def update_redeem_settings(request: Request):
    """Update redemption safety settings (Admin only)"""
    try:
        data = await request.json()
        
        # Validate required fields
        required_fields = ["daily_limit_per_user", "manual_approval_threshold"]
        for field in required_fields:
            if field not in data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Update settings
        await db.settings.update_one(
            {},
            {
                "$set": {
                    "redeem_settings": {
                        "daily_limit_per_user": float(data.get("daily_limit_per_user", 5000)),
                        "daily_limit_global": float(data.get("daily_limit_global", 100000)),
                        "manual_approval_threshold": float(data.get("manual_approval_threshold", 1000)),
                        "cool_off_period_hours": int(data.get("cool_off_period_hours", 24)),
                        "min_kyc_status": data.get("min_kyc_status", "verified"),
                        "min_vip_days": int(data.get("min_vip_days", 7)),
                        "max_redemptions_per_day": int(data.get("max_redemptions_per_day", 3)),
                        "suspicious_amount_threshold": float(data.get("suspicious_amount_threshold", 2000)),
                        "enabled": bool(data.get("enabled", True)),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            },
            upsert=True
        )
        
        return {"success": True, "message": "Redeem settings updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def check_redeem_safety(user_id: str, amount_inr: float) -> Dict:
    """
    Check if a redemption request passes all safety rules
    Returns: {allowed: bool, reason: str, requires_manual_approval: bool}
    """
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "redeem_settings": 1})
        rs = settings.get("redeem_settings", {}) if settings else {}
        
        # Default values
        daily_limit_per_user = rs.get("daily_limit_per_user", 5000)
        daily_limit_global = rs.get("daily_limit_global", 100000)
        manual_threshold = rs.get("manual_approval_threshold", 1000)
        max_per_day = rs.get("max_redemptions_per_day", 3)
        min_vip_days = rs.get("min_vip_days", 7)
        suspicious_threshold = rs.get("suspicious_amount_threshold", 2000)
        
        user = await db.users.find_one({"uid": user_id})
        if not user:
            return {"allowed": False, "reason": "User not found", "requires_manual_approval": False}
        
        # Check KYC
        if user.get("kyc_status") != "verified":
            return {"allowed": False, "reason": "KYC not verified", "requires_manual_approval": False}
        
        # Check VIP tenure
        vip_expiry_str = user.get("vip_expiry")
        if vip_expiry_str:
            try:
                now = datetime.now(timezone.utc)
                # Calculate how long user has been VIP (rough estimate)
                vip_start = now - timedelta(days=30)  # Assume monthly plan minimum
                if user.get("membership_type") != "vip":
                    return {"allowed": False, "reason": "VIP membership required", "requires_manual_approval": False}
            except:
                pass
        
        # Check user's daily redemption total
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        user_today_redemptions = await db.gift_voucher_requests.find({
            "user_id": user_id,
            "created_at": {"$gte": today_start},
            "status": {"$ne": "rejected"}
        }).to_list(100)
        
        user_today_bills = await db.bill_payment_requests.find({
            "user_id": user_id,
            "created_at": {"$gte": today_start},
            "status": {"$ne": "rejected"}
        }).to_list(100)
        
        user_today_total = sum(r.get("denomination", 0) for r in user_today_redemptions) + \
                          sum(b.get("amount_inr", 0) for b in user_today_bills)
        user_today_count = len(user_today_redemptions) + len(user_today_bills)
        
        if user_today_count >= max_per_day:
            return {"allowed": False, "reason": f"Daily transaction limit ({max_per_day}) reached", "requires_manual_approval": False}
        
        if user_today_total + amount_inr > daily_limit_per_user:
            return {"allowed": False, "reason": f"Would exceed daily limit of ₹{daily_limit_per_user}", "requires_manual_approval": False}
        
        # Check global daily limit
        global_today_redemptions = await db.gift_voucher_requests.find({
            "created_at": {"$gte": today_start},
            "status": {"$ne": "rejected"}
        }).to_list(10000)
        
        global_today_bills = await db.bill_payment_requests.find({
            "created_at": {"$gte": today_start},
            "status": {"$ne": "rejected"}
        }).to_list(10000)
        
        global_today_total = sum(r.get("denomination", 0) for r in global_today_redemptions) + \
                            sum(b.get("amount_inr", 0) for b in global_today_bills)
        
        if global_today_total + amount_inr > daily_limit_global:
            return {"allowed": False, "reason": "Global daily redemption limit reached", "requires_manual_approval": False}
        
        # Determine if manual approval needed
        requires_manual = amount_inr >= manual_threshold or amount_inr >= suspicious_threshold
        
        return {
            "allowed": True, 
            "reason": "All safety checks passed",
            "requires_manual_approval": requires_manual,
            "auto_approve": not requires_manual
        }
        
    except Exception as e:
        logging.error(f"Error checking redeem safety: {e}")
        return {"allowed": False, "reason": "Error checking safety rules", "requires_manual_approval": True}

# ==================== P&L MONTHLY SNAPSHOTS ====================

@api_router.get("/admin/finance/profit-loss/monthly")
async def get_monthly_pl_report(year: int = None, month: int = None):
    """Get monthly P&L report with detailed breakdown"""
    try:
        now = datetime.now(timezone.utc)
        year = year or now.year
        month = month or now.month
        
        month_start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            month_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        month_start_str = month_start.isoformat()
        month_end_str = month_end.isoformat()
        
        # INCOME
        # 1. VIP Subscriptions
        vip_payments = await db.vip_payments.find({
            "status": "approved",
            "approved_at": {"$gte": month_start_str, "$lt": month_end_str}
        }).to_list(10000)
        vip_income = sum(p.get("amount", 0) for p in vip_payments)
        
        # 2. Ads Revenue
        ads_income_entries = await db.ads_income.find({
            "created_at": {"$gte": month_start_str, "$lt": month_end_str}
        }).to_list(1000)
        ads_income = sum(a.get("revenue_amount", 0) for a in ads_income_entries)
        
        # 3. Other Income (service charges from transactions)
        service_charges = await db.transactions.find({
            "type": {"$in": ["service_charge", "transaction_fee"]},
            "created_at": {"$gte": month_start_str, "$lt": month_end_str}
        }).to_list(10000)
        service_income = sum(s.get("amount", 0) for s in service_charges)
        
        total_income = vip_income + ads_income + service_income
        
        # EXPENSES
        # 1. Fixed Expenses
        month_key = f"{year}-{month:02d}"
        fixed_expenses = await db.fixed_expenses.find({
            "month": month_key,
            "paid_status": "paid"
        }).to_list(100)
        fixed_expense_total = sum(e.get("amount", 0) for e in fixed_expenses)
        
        # 2. Redemption Payouts (gift vouchers + bill payments)
        gift_vouchers = await db.gift_voucher_requests.find({
            "status": "completed",
            "completed_at": {"$gte": month_start_str, "$lt": month_end_str}
        }).to_list(10000)
        gift_voucher_cost = sum(g.get("denomination", 0) for g in gift_vouchers)
        
        bill_payments = await db.bill_payment_requests.find({
            "status": "completed",
            "completed_at": {"$gte": month_start_str, "$lt": month_end_str}
        }).to_list(10000)
        bill_payment_cost = sum(b.get("amount_inr", 0) for b in bill_payments)
        
        total_expenses = fixed_expense_total + gift_voucher_cost + bill_payment_cost
        
        # Calculate P&L
        gross_profit = total_income - gift_voucher_cost - bill_payment_cost
        net_profit = total_income - total_expenses
        profit_margin = (net_profit / total_income * 100) if total_income > 0 else 0
        
        report = {
            "period": {
                "year": year,
                "month": month,
                "month_name": month_start.strftime("%B"),
                "start_date": month_start_str,
                "end_date": month_end_str
            },
            "income": {
                "vip_subscriptions": vip_income,
                "vip_count": len(vip_payments),
                "ads_revenue": ads_income,
                "service_charges": service_income,
                "total": total_income
            },
            "expenses": {
                "fixed_expenses": fixed_expense_total,
                "gift_voucher_payouts": gift_voucher_cost,
                "gift_voucher_count": len(gift_vouchers),
                "bill_payment_payouts": bill_payment_cost,
                "bill_payment_count": len(bill_payments),
                "total": total_expenses
            },
            "summary": {
                "gross_profit": gross_profit,
                "net_profit": net_profit,
                "profit_margin_percent": round(profit_margin, 2)
            },
            "generated_at": now.isoformat()
        }
        
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/finance/profit-loss/snapshot")
async def save_monthly_pl_snapshot(year: int, month: int):
    """Save a monthly P&L snapshot for historical records"""
    try:
        # Get the report
        report = await get_monthly_pl_report(year, month)
        
        # Check if snapshot already exists
        existing = await db.pl_snapshots.find_one({
            "period.year": year,
            "period.month": month
        })
        
        if existing:
            # Update existing
            await db.pl_snapshots.update_one(
                {"period.year": year, "period.month": month},
                {"$set": {**report, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            return {"success": True, "message": "Snapshot updated", "report": report}
        else:
            # Create new
            report["snapshot_id"] = str(uuid.uuid4())
            report["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.pl_snapshots.insert_one(report)
            # Remove _id before returning
            report.pop("_id", None)
            return {"success": True, "message": "Snapshot created", "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/finance/profit-loss/snapshots")
async def get_pl_snapshots(limit: int = 12):
    """Get historical P&L snapshots"""
    try:
        snapshots = await db.pl_snapshots.find(
            {}, {"_id": 0}
        ).sort([("period.year", -1), ("period.month", -1)]).limit(limit).to_list(limit)
        
        return {"snapshots": snapshots}
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


# ==================== CAPITAL & LIABILITY MANAGEMENT ====================

class CapitalEntryRequest(BaseModel):
    """Capital/Liability entry request"""
    entry_type: str  # director_capital, partner_capital, personal_loan, bank_loan
    amount: float
    person_name: Optional[str] = None
    bank_name: Optional[str] = None
    interest_rate: Optional[float] = 0
    entry_date: str
    repayment_date: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"  # active, partially_paid, fully_paid

class RepaymentRequest(BaseModel):
    """Repayment entry request"""
    entry_id: str
    amount: float
    payment_date: str
    payment_method: Optional[str] = None
    description: Optional[str] = None

@api_router.get("/admin/capital/entries")
async def get_capital_entries(
    entry_type: str = None,
    status: str = None,
    page: int = 1,
    limit: int = 10
):
    """Get all capital/liability entries with filters"""
    try:
        query = {}
        if entry_type:
            query["entry_type"] = entry_type
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        total = await db.capital_entries.count_documents(query)
        
        entries = await db.capital_entries.find(query, {"_id": 0}).sort("entry_date", -1).skip(skip).limit(limit).to_list(None)
        
        # Calculate summary
        all_entries = await db.capital_entries.find({}, {"_id": 0}).to_list(None)
        
        total_capital = sum(e.get("amount", 0) for e in all_entries if e.get("entry_type") in ["director_capital", "partner_capital"])
        total_liabilities = sum(e.get("amount", 0) for e in all_entries if e.get("entry_type") in ["personal_loan", "bank_loan"])
        total_repaid = sum(e.get("total_repaid", 0) for e in all_entries)
        pending_liabilities = total_liabilities - total_repaid
        
        return {
            "entries": entries,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "current_page": page,
            "summary": {
                "total_capital": total_capital,
                "total_liabilities": total_liabilities,
                "total_repaid": total_repaid,
                "pending_liabilities": pending_liabilities,
                "net_position": total_capital - pending_liabilities
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/capital/entries")
async def create_capital_entry(entry: CapitalEntryRequest):
    """Create a new capital/liability entry"""
    try:
        entry_doc = {
            "entry_id": f"CAP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
            "entry_type": entry.entry_type,
            "amount": entry.amount,
            "person_name": entry.person_name,
            "bank_name": entry.bank_name,
            "interest_rate": entry.interest_rate or 0,
            "entry_date": entry.entry_date,
            "repayment_date": entry.repayment_date,
            "description": entry.description,
            "status": entry.status,
            "total_repaid": 0,
            "repayments": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.capital_entries.insert_one(entry_doc)
        
        return {"success": True, "entry_id": entry_doc["entry_id"], "message": "Entry created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/admin/capital/entries/{entry_id}")
async def update_capital_entry(entry_id: str, entry: CapitalEntryRequest):
    """Update a capital/liability entry"""
    try:
        existing = await db.capital_entries.find_one({"entry_id": entry_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        update_data = {
            "entry_type": entry.entry_type,
            "amount": entry.amount,
            "person_name": entry.person_name,
            "bank_name": entry.bank_name,
            "interest_rate": entry.interest_rate or 0,
            "entry_date": entry.entry_date,
            "repayment_date": entry.repayment_date,
            "description": entry.description,
            "status": entry.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.capital_entries.update_one({"entry_id": entry_id}, {"$set": update_data})
        
        return {"success": True, "message": "Entry updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/capital/entries/{entry_id}")
async def delete_capital_entry(entry_id: str):
    """Delete a capital/liability entry"""
    try:
        result = await db.capital_entries.delete_one({"entry_id": entry_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/capital/repayment")
async def record_repayment(repayment: RepaymentRequest):
    """Record a repayment against a loan/liability"""
    try:
        entry = await db.capital_entries.find_one({"entry_id": repayment.entry_id})
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        if entry.get("entry_type") not in ["personal_loan", "bank_loan"]:
            raise HTTPException(status_code=400, detail="Repayments can only be made against loans")
        
        repayment_doc = {
            "repayment_id": f"REP-{str(uuid.uuid4())[:8].upper()}",
            "amount": repayment.amount,
            "payment_date": repayment.payment_date,
            "payment_method": repayment.payment_method,
            "description": repayment.description,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        new_total_repaid = entry.get("total_repaid", 0) + repayment.amount
        new_status = "fully_paid" if new_total_repaid >= entry.get("amount", 0) else "partially_paid"
        
        await db.capital_entries.update_one(
            {"entry_id": repayment.entry_id},
            {
                "$push": {"repayments": repayment_doc},
                "$set": {
                    "total_repaid": new_total_repaid,
                    "status": new_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "repayment_id": repayment_doc["repayment_id"],
            "new_status": new_status,
            "total_repaid": new_total_repaid,
            "remaining": max(0, entry.get("amount", 0) - new_total_repaid)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/capital/summary")
async def get_capital_summary():
    """Get capital and liability summary for dashboard"""
    try:
        entries = await db.capital_entries.find({}, {"_id": 0}).to_list(None)
        
        # Group by type
        director_capital = sum(e.get("amount", 0) for e in entries if e.get("entry_type") == "director_capital")
        partner_capital = sum(e.get("amount", 0) for e in entries if e.get("entry_type") == "partner_capital")
        personal_loans = sum(e.get("amount", 0) for e in entries if e.get("entry_type") == "personal_loan")
        bank_loans = sum(e.get("amount", 0) for e in entries if e.get("entry_type") == "bank_loan")
        
        total_repaid = sum(e.get("total_repaid", 0) for e in entries if e.get("entry_type") in ["personal_loan", "bank_loan"])
        
        # Pending amounts by person/bank
        pending_by_source = []
        for entry in entries:
            if entry.get("entry_type") in ["personal_loan", "bank_loan"]:
                remaining = entry.get("amount", 0) - entry.get("total_repaid", 0)
                if remaining > 0:
                    pending_by_source.append({
                        "entry_id": entry.get("entry_id"),
                        "type": entry.get("entry_type"),
                        "source": entry.get("person_name") or entry.get("bank_name") or "Unknown",
                        "total_amount": entry.get("amount", 0),
                        "repaid": entry.get("total_repaid", 0),
                        "remaining": remaining,
                        "interest_rate": entry.get("interest_rate", 0),
                        "repayment_date": entry.get("repayment_date")
                    })
        
        return {
            "capital": {
                "director": director_capital,
                "partner": partner_capital,
                "total": director_capital + partner_capital
            },
            "liabilities": {
                "personal_loans": personal_loans,
                "bank_loans": bank_loans,
                "total": personal_loans + bank_loans,
                "repaid": total_repaid,
                "pending": (personal_loans + bank_loans) - total_repaid
            },
            "net_position": (director_capital + partner_capital) - ((personal_loans + bank_loans) - total_repaid),
            "pending_by_source": sorted(pending_by_source, key=lambda x: x["remaining"], reverse=True)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== FINTECH ACCOUNTING SYSTEM ====================

# ========== PRC MINT LEDGER (All PRC Inflows) ==========

@api_router.get("/admin/accounting/prc-mint-ledger")
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
        query = {"type": {"$in": ["mining", "tap_game", "referral", "cashback", "admin_credit", "profit_share", "scratch_card_reward", "treasure_hunt_reward", "delivery_commission", "prc_rain_gain"]}}
        
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
        raise HTTPException(status_code=500, detail=str(e))


# ========== PRC BURN LEDGER (All PRC Outflows) ==========

@api_router.get("/admin/accounting/prc-burn-ledger")
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
        query = {"type": {"$in": ["order", "withdrawal", "admin_debit", "delivery_charge", "scratch_card_purchase", "treasure_hunt_play", "prc_burn", "bill_payment_request", "gift_voucher_request", "prc_rain_loss"]}}
        
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
        raise HTTPException(status_code=500, detail=str(e))


# ========== LIABILITY LEDGER (INR Redemption Tracking) ==========

@api_router.get("/admin/accounting/liability-ledger")
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
        raise HTTPException(status_code=500, detail=str(e))


# ========== CONVERSION RATE MANAGEMENT ==========

@api_router.get("/admin/accounting/conversion-rate")
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
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/accounting/conversion-rate")
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
        raise HTTPException(status_code=500, detail=str(e))


# ========== RESERVE FUND MANAGEMENT ==========

@api_router.get("/admin/accounting/reserve-fund")
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
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/accounting/reserve-fund/add")
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
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/accounting/reserve-fund/settings")
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
        raise HTTPException(status_code=500, detail=str(e))


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
        mint_types = ["mining", "tap_game", "referral", "cashback", "admin_credit", "profit_share", "scratch_card_reward", "treasure_hunt_reward", "delivery_commission", "prc_rain_gain"]
        mint_result = await db.transactions.aggregate([
            {"$match": {"type": {"$in": mint_types}, "created_at": {"$gte": start_of_day, "$lte": end_of_day}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        prc_minted = mint_result[0].get("total", 0) if mint_result else 0
        
        # PRC Burned
        burn_types = ["order", "withdrawal", "admin_debit", "delivery_charge", "scratch_card_purchase", "treasure_hunt_play", "prc_burn", "bill_payment_request", "gift_voucher_request", "prc_rain_loss"]
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


@api_router.get("/admin/accounting/daily-summary")
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
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/accounting/daily-summary/generate")
async def trigger_daily_summary(request: Request):
    """Manually trigger daily summary generation"""
    try:
        data = await request.json()
        target_date = data.get("date")  # Optional specific date
        
        summary = await generate_daily_summary(target_date)
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== USER COST ANALYSIS (Loss-making Users) ==========

@api_router.get("/admin/accounting/user-cost-analysis")
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
        raise HTTPException(status_code=500, detail=str(e))


# ========== 180-DAY PRC EXPIRY FOR INACTIVE USERS ==========

async def burn_inactive_user_prc():
    """Burn PRC for users inactive for 180+ days"""
    try:
        now = datetime.now(timezone.utc)
        inactive_threshold = now - timedelta(days=180)
        
        # Find inactive users with positive PRC balance
        inactive_users = db.users.find({
            "last_login": {"$lt": inactive_threshold.isoformat()},
            "prc_balance": {"$gt": 0}
        })
        
        burn_count = 0
        total_burned = 0.0
        
        async for user in inactive_users:
            uid = user.get("uid")
            prc_balance = user.get("prc_balance", 0)
            
            if prc_balance > 0:
                # Burn all PRC
                await log_transaction(
                    user_id=uid,
                    wallet_type="prc",
                    transaction_type="prc_burn",
                    amount=prc_balance,
                    description=f"Burned {prc_balance:.2f} PRC (inactive for 180+ days)",
                    metadata={"burn_reason": "inactive_180_days", "last_login": user.get("last_login")}
                )
                
                burn_count += 1
                total_burned += prc_balance
        
        logging.info(f"Inactive user PRC burn: {burn_count} users, {total_burned:.2f} PRC burned")
        return {"users_affected": burn_count, "total_burned": total_burned}
    except Exception as e:
        logging.error(f"Error burning inactive user PRC: {e}")
        return {"users_affected": 0, "total_burned": 0.0}


@api_router.post("/admin/accounting/burn-inactive-prc")
async def trigger_inactive_prc_burn():
    """Manually trigger inactive user PRC burn (180 days)"""
    try:
        result = await burn_inactive_user_prc()
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== MASTER ACCOUNTING DASHBOARD ==========

@api_router.get("/admin/accounting/master-dashboard")
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
        mint_types = ["mining", "tap_game", "referral", "cashback", "admin_credit", "profit_share", "scratch_card_reward", "treasure_hunt_reward", "delivery_commission", "prc_rain_gain"]
        burn_types = ["order", "withdrawal", "admin_debit", "delivery_charge", "scratch_card_purchase", "treasure_hunt_play", "prc_burn", "bill_payment_request", "gift_voucher_request", "prc_rain_loss"]
        
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
        raise HTTPException(status_code=500, detail=str(e))


# ========== ACCOUNTING SETTINGS ==========

@api_router.get("/admin/accounting/settings")
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
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/accounting/settings")
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
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MANAGER ROLE ACCESS CONTROL ====================

# Default permissions for manager role
DEFAULT_MANAGER_PERMISSIONS = ["users", "vip_payment", "kyc"]

# All available admin pages/permissions
ALL_ADMIN_PERMISSIONS = [
    {"id": "dashboard", "label": "Dashboard", "category": "General"},
    {"id": "users", "label": "Users Management", "category": "General"},
    {"id": "analytics", "label": "Analytics", "category": "General"},
    {"id": "kyc", "label": "KYC Verification", "category": "General"},
    {"id": "orders", "label": "Orders", "category": "Operations"},
    {"id": "marketplace", "label": "Marketplace", "category": "Operations"},
    {"id": "video_ads", "label": "Video Ads", "category": "Operations"},
    {"id": "prc_rain", "label": "PRC Rain Drop", "category": "Operations"},
    {"id": "stockist", "label": "Stockist Management", "category": "Operations"},
    {"id": "support", "label": "Support Tickets", "category": "Operations"},
    {"id": "fraud", "label": "Fraud Alerts", "category": "Security"},
    {"id": "company_wallets", "label": "Company Wallets", "category": "Finance"},
    {"id": "ads_income", "label": "Ads Income", "category": "Finance"},
    {"id": "fixed_expenses", "label": "Fixed Expenses", "category": "Finance"},
    {"id": "user_ledger", "label": "User Ledger", "category": "Finance"},
    {"id": "redeem_settings", "label": "Redeem Settings", "category": "Finance"},
    {"id": "capital", "label": "Capital & Liabilities", "category": "Finance"},
    {"id": "accounting", "label": "Accounting Dashboard", "category": "Finance"},
    {"id": "vip_payment", "label": "VIP Payment Verification", "category": "Payments"},
    {"id": "withdrawals", "label": "Withdrawals", "category": "Payments"},
    {"id": "gift_voucher", "label": "Gift Voucher Requests", "category": "Payments"},
    {"id": "bill_payment", "label": "Bill Payment Requests", "category": "Payments"},
    {"id": "system_settings", "label": "System Settings", "category": "Settings"},
    {"id": "audit", "label": "Audit Service", "category": "Settings"},
    {"id": "prc_analytics", "label": "PRC Analytics", "category": "Analytics"},
    {"id": "profit_loss", "label": "Profit & Loss", "category": "Analytics"},
    {"id": "liquidity", "label": "Liquidity Status", "category": "Analytics"}
]

@api_router.get("/admin/permissions/list")
async def get_all_permissions():
    """Get list of all available permissions for manager role"""
    return {
        "permissions": ALL_ADMIN_PERMISSIONS,
        "default_manager": DEFAULT_MANAGER_PERMISSIONS
    }

@api_router.get("/admin/user/{uid}/permissions")
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
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/admin/user/{uid}/permissions")
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


# ============================================
# ADMIN POLICIES MANAGEMENT
# ============================================

@api_router.get("/admin/policies")
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

@api_router.post("/admin/policies")
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
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/policies/{policy_type}")
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
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# VIP PAYMENT TRANSACTIONS FOR USER HISTORY
# ============================================

@api_router.get("/user/vip-transactions/{uid}")
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

@api_router.get("/user/vip-invoice/{payment_id}")
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

@api_router.post("/user/vip-auto-renew/{uid}")
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


# ========== COMPLETE LEDGER SYSTEM (AUDIT-READY) ==========
# Based on Master Ledger Document

# ---------- INCOME LEDGERS (₹ INFLOW) ----------

@api_router.get("/admin/ledger/subscription-income")
async def get_subscription_income_ledger(page: int = 1, limit: int = 50, start_date: str = None, end_date: str = None):
    """Get VIP/Premium subscription income ledger"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        skip = (page - 1) * limit
        entries = await db.subscription_income_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.subscription_income_ledger.count_documents(query)
        
        totals_result = await db.subscription_income_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "total_amount": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_amount = totals_result[0].get("total_amount", 0) if totals_result else 0
        
        return {
            "entries": entries,
            "total": total,
            "total_amount": total_amount,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/subscription-income")
async def add_subscription_income(request: Request):
    """Add subscription income entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "plan_name": data.get("plan_name", "VIP"),
            "amount": float(data.get("amount", 0)),
            "payment_mode": data.get("payment_mode", "online"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "status": data.get("status", "completed"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscription_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/commission-income")
async def get_commission_income_ledger(page: int = 1, limit: int = 50, source_type: str = None):
    """Get commission income from recharges, bills, products"""
    try:
        query = {}
        if source_type:
            query["source_type"] = source_type
        
        skip = (page - 1) * limit
        entries = await db.commission_income_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.commission_income_ledger.count_documents(query)
        
        totals_result = await db.commission_income_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "gross": {"$sum": "$gross_commission"}, "tds": {"$sum": "$tds"}, "net": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"gross": 0, "tds": 0, "net": 0}
        
        return {
            "entries": entries,
            "total": total,
            "totals": totals,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/commission-income")
async def add_commission_income(request: Request):
    """Add commission income entry"""
    try:
        data = await request.json()
        gross = float(data.get("gross_commission", 0))
        tds = float(data.get("tds", 0))
        entry = {
            "id": str(uuid.uuid4()),
            "source_type": data.get("source_type", "recharge"),
            "partner_name": data.get("partner_name", ""),
            "transaction_id": data.get("transaction_id", ""),
            "gross_commission": gross,
            "tds": tds,
            "net_commission": gross - tds,
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.commission_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/penalty-income")
async def get_penalty_income_ledger(page: int = 1, limit: int = 50):
    """Get penalty/forfeit income from PRC expiry, fraud"""
    try:
        skip = (page - 1) * limit
        entries = await db.penalty_income_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.penalty_income_ledger.count_documents({})
        
        totals_result = await db.penalty_income_ledger.aggregate([
            {"$group": {"_id": None, "total_prc": {"$sum": "$prc_burned"}, "total_inr": {"$sum": "$equivalent_inr"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"total_prc": 0, "total_inr": 0}
        
        return {"entries": entries, "total": total, "totals": totals, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/penalty-income")
async def add_penalty_income(request: Request):
    """Add penalty income entry"""
    try:
        data = await request.json()
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        prc_burned = float(data.get("prc_burned", 0))
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "prc_burned": prc_burned,
            "equivalent_inr": prc_burned / prc_per_inr,
            "reason": data.get("reason", "expiry"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.penalty_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/interest-income")
async def get_interest_income_ledger(page: int = 1, limit: int = 50):
    """Get interest income from bank FD, savings, partners"""
    try:
        skip = (page - 1) * limit
        entries = await db.interest_income_ledger.find({}, {"_id": 0}).sort("date_received", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.interest_income_ledger.count_documents({})
        
        totals_result = await db.interest_income_ledger.aggregate([
            {"$group": {"_id": None, "total_interest": {"$sum": "$interest_amount"}}}
        ]).to_list(1)
        total_interest = totals_result[0].get("total_interest", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_interest": total_interest, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/interest-income")
async def add_interest_income(request: Request):
    """Add interest income entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "source": data.get("source", "bank"),
            "principal_amount": float(data.get("principal_amount", 0)),
            "interest_rate": float(data.get("interest_rate", 0)),
            "interest_amount": float(data.get("interest_amount", 0)),
            "period": data.get("period", ""),
            "date_received": data.get("date_received", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.interest_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/ad-revenue")
async def get_ad_revenue_ledger(page: int = 1, limit: int = 50, platform: str = None):
    """Get advertising revenue ledger"""
    try:
        query = {}
        if platform:
            query["platform"] = platform
        
        skip = (page - 1) * limit
        entries = await db.ad_revenue_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.ad_revenue_ledger.count_documents(query)
        
        totals_result = await db.ad_revenue_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "gross": {"$sum": "$gross_amount"}, "charges": {"$sum": "$platform_charges"}, "net": {"$sum": "$net_amount"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"gross": 0, "charges": 0, "net": 0}
        
        return {"entries": entries, "total": total, "totals": totals, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/ad-revenue")
async def add_ad_revenue(request: Request):
    """Add ad revenue entry"""
    try:
        data = await request.json()
        gross = float(data.get("gross_amount", 0))
        charges = float(data.get("platform_charges", 0))
        entry = {
            "id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "platform": data.get("platform", "admob"),
            "gross_amount": gross,
            "platform_charges": charges,
            "net_amount": gross - charges,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ad_revenue_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- EXPENSE LEDGERS (₹ OUTFLOW) ----------

@api_router.get("/admin/ledger/redeem-payout")
async def get_redeem_payout_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get redeem payout ledger - actual INR payouts"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.redeem_payout_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.redeem_payout_ledger.count_documents(query)
        
        totals_result = await db.redeem_payout_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": "$status", "total_prc": {"$sum": "$prc_used"}, "total_inr": {"$sum": "$amount_inr"}}}
        ]).to_list(10)
        
        return {"entries": entries, "total": total, "totals_by_status": totals_result, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/redeem-payout")
async def add_redeem_payout(request: Request):
    """Add redeem payout entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "redeem_type": data.get("redeem_type", "voucher"),
            "prc_used": float(data.get("prc_used", 0)),
            "amount_inr": float(data.get("amount_inr", 0)),
            "payment_mode": data.get("payment_mode", "bank"),
            "status": data.get("status", "pending"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.redeem_payout_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/admin/ledger/redeem-payout/{entry_id}")
async def update_redeem_payout_status(entry_id: str, request: Request):
    """Update redeem payout status"""
    try:
        data = await request.json()
        result = await db.redeem_payout_ledger.update_one(
            {"id": entry_id},
            {"$set": {"status": data.get("status"), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": result.modified_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/expenses")
async def get_expense_ledger(page: int = 1, limit: int = 50, expense_type: str = None):
    """Get all expense entries"""
    try:
        query = {}
        if expense_type:
            query["expense_type"] = expense_type
        
        skip = (page - 1) * limit
        entries = await db.expense_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.expense_ledger.count_documents(query)
        
        totals_result = await db.expense_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": "$expense_type", "total": {"$sum": "$amount"}}}
        ]).to_list(20)
        
        return {"entries": entries, "total": total, "totals_by_type": totals_result, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/expenses")
async def add_expense(request: Request):
    """Add expense entry (server, sms, salary, marketing, legal, etc.)"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "expense_type": data.get("expense_type", "operational"),
            "category": data.get("category", ""),
            "provider": data.get("provider", ""),
            "description": data.get("description", ""),
            "amount": float(data.get("amount", 0)),
            "payment_mode": data.get("payment_mode", "bank"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.expense_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- CASH & BANK LEDGERS ----------

@api_router.get("/admin/ledger/cash")
async def get_cash_ledger(page: int = 1, limit: int = 50, start_date: str = None, end_date: str = None):
    """Get cash ledger entries"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        skip = (page - 1) * limit
        entries = await db.cash_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.cash_ledger.count_documents(query)
        
        latest = await db.cash_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        return {"entries": entries, "total": total, "current_balance": current_balance, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/cash")
async def add_cash_entry(request: Request):
    """Add cash ledger entry"""
    try:
        data = await request.json()
        
        latest = await db.cash_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        cash_in = float(data.get("cash_in", 0))
        cash_out = float(data.get("cash_out", 0))
        new_balance = current_balance + cash_in - cash_out
        
        entry = {
            "id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "source_type": data.get("source_type", "income"),
            "reference_id": data.get("reference_id", ""),
            "cash_in": cash_in,
            "cash_out": cash_out,
            "balance_after": new_balance,
            "remarks": data.get("remarks", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cash_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/bank")
async def get_bank_ledger(page: int = 1, limit: int = 50, bank_name: str = None):
    """Get bank ledger entries"""
    try:
        query = {}
        if bank_name:
            query["bank_name"] = bank_name
        
        skip = (page - 1) * limit
        entries = await db.bank_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.bank_ledger.count_documents(query)
        
        latest = await db.bank_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        return {"entries": entries, "total": total, "current_balance": current_balance, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/bank")
async def add_bank_entry(request: Request):
    """Add bank ledger entry"""
    try:
        data = await request.json()
        
        latest = await db.bank_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        amount = float(data.get("amount", 0))
        txn_type = data.get("transaction_type", "credit")
        
        if txn_type == "credit":
            new_balance = current_balance + amount
        else:
            new_balance = current_balance - amount
        
        entry = {
            "id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "bank_name": data.get("bank_name", ""),
            "account_last4": data.get("account_last4", ""),
            "transaction_type": txn_type,
            "source_type": data.get("source_type", ""),
            "reference_id": data.get("reference_id", ""),
            "amount": amount,
            "balance_after": new_balance,
            "remarks": data.get("remarks", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bank_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- DEPOSIT & STOCKIST LEDGERS ----------

@api_router.get("/admin/ledger/deposits")
async def get_deposit_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get stockist/partner deposit ledger"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.deposit_ledger.find(query, {"_id": 0}).sort("date_received", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.deposit_ledger.count_documents(query)
        
        totals_result = await db.deposit_ledger.aggregate([
            {"$group": {"_id": "$status", "total": {"$sum": "$deposit_amount"}}}
        ]).to_list(5)
        
        return {"entries": entries, "total": total, "totals_by_status": totals_result, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/deposits")
async def add_deposit(request: Request):
    """Add deposit entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "party_name": data.get("party_name"),
            "party_type": data.get("party_type", "stockist"),
            "deposit_amount": float(data.get("deposit_amount", 0)),
            "mode": data.get("mode", "bank"),
            "date_received": data.get("date_received", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.deposit_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/deposits/{deposit_id}/refund")
async def refund_deposit(deposit_id: str, request: Request):
    """Refund a deposit"""
    try:
        data = await request.json()
        
        await db.deposit_ledger.update_one(
            {"id": deposit_id},
            {"$set": {"status": "refunded", "refund_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}}
        )
        
        deposit = await db.deposit_ledger.find_one({"id": deposit_id}, {"_id": 0})
        if deposit:
            refund_entry = {
                "id": str(uuid.uuid4()),
                "party_name": deposit.get("party_name"),
                "deposit_reference_id": deposit_id,
                "amount_returned": deposit.get("deposit_amount"),
                "mode": data.get("mode", "bank"),
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "remarks": data.get("remarks", ""),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.deposit_refund_ledger.insert_one(refund_entry)
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/renewal-fees")
async def get_renewal_fees_ledger(page: int = 1, limit: int = 50):
    """Get renewal/activation fees ledger"""
    try:
        skip = (page - 1) * limit
        entries = await db.renewal_fees_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.renewal_fees_ledger.count_documents({})
        
        totals_result = await db.renewal_fees_ledger.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_amount = totals_result[0].get("total", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_amount": total_amount, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/renewal-fees")
async def add_renewal_fee(request: Request):
    """Add renewal fee entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "party_name": data.get("party_name"),
            "fee_type": data.get("fee_type", "renewal"),
            "amount": float(data.get("amount", 0)),
            "mode": data.get("mode", "bank"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.renewal_fees_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- UTILITY TRANSACTION LEDGERS ----------

@api_router.get("/admin/ledger/mobile-recharge")
async def get_mobile_recharge_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get mobile recharge ledger"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.mobile_recharge_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.mobile_recharge_ledger.count_documents(query)
        
        return {"entries": entries, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/product-purchase")
async def get_product_purchase_ledger(page: int = 1, limit: int = 50):
    """Get product purchase ledger"""
    try:
        skip = (page - 1) * limit
        entries = await db.product_purchase_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.product_purchase_ledger.count_documents({})
        
        totals_result = await db.product_purchase_ledger.aggregate([
            {"$group": {"_id": None, "total_profit": {"$sum": "$profit_margin"}}}
        ]).to_list(1)
        total_profit = totals_result[0].get("total_profit", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_profit": total_profit, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/product-purchase")
async def add_product_purchase(request: Request):
    """Add product purchase entry"""
    try:
        data = await request.json()
        purchase_cost = float(data.get("purchase_cost", 0))
        selling_price = float(data.get("selling_price", 0))
        
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "product_name": data.get("product_name"),
            "category": data.get("category", ""),
            "prc_used": float(data.get("prc_used", 0)),
            "cash_used": float(data.get("cash_used", 0)),
            "purchase_cost": purchase_cost,
            "selling_price": selling_price,
            "profit_margin": selling_price - purchase_cost,
            "status": data.get("status", "completed"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.product_purchase_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- SUMMARY & RECONCILIATION LEDGERS ----------

@api_router.get("/admin/ledger/daily-cash-bank-summary")
async def get_daily_cash_bank_summary(start_date: str = None, end_date: str = None):
    """Get daily cash & bank summary"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        summaries = await db.daily_cash_bank_summary.find(query, {"_id": 0}).sort("date", -1).limit(30).to_list(30)
        return {"summaries": summaries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/daily-cash-bank-summary/generate")
async def generate_daily_cash_bank_summary(request: Request):
    """Generate daily cash & bank summary for a date"""
    try:
        data = await request.json()
        date = data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        
        cash_in_result = await db.cash_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total_in": {"$sum": "$cash_in"}, "total_out": {"$sum": "$cash_out"}}}
        ]).to_list(1)
        
        bank_credit_result = await db.bank_ledger.aggregate([
            {"$match": {"date": date, "transaction_type": "credit"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        bank_debit_result = await db.bank_ledger.aggregate([
            {"$match": {"date": date, "transaction_type": "debit"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        prev_date = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        prev_summary = await db.daily_cash_bank_summary.find_one({"date": prev_date}, {"_id": 0})
        
        opening_cash = prev_summary.get("closing_cash", 0) if prev_summary else 0
        opening_bank = prev_summary.get("closing_bank", 0) if prev_summary else 0
        
        cash_in = cash_in_result[0].get("total_in", 0) if cash_in_result else 0
        cash_out = cash_in_result[0].get("total_out", 0) if cash_in_result else 0
        bank_credit = bank_credit_result[0].get("total", 0) if bank_credit_result else 0
        bank_debit = bank_debit_result[0].get("total", 0) if bank_debit_result else 0
        
        summary = {
            "date": date,
            "opening_cash": opening_cash,
            "cash_in": cash_in,
            "cash_out": cash_out,
            "closing_cash": opening_cash + cash_in - cash_out,
            "opening_bank": opening_bank,
            "bank_credit": bank_credit,
            "bank_debit": bank_debit,
            "closing_bank": opening_bank + bank_credit - bank_debit,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.daily_cash_bank_summary.update_one(
            {"date": date},
            {"$set": summary},
            upsert=True
        )
        
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/profit-loss-summary")
async def get_profit_loss_summary(start_date: str = None, end_date: str = None):
    """Get daily profit & loss summary"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        summaries = await db.daily_profit_loss_summary.find(query, {"_id": 0}).sort("date", -1).limit(30).to_list(30)
        return {"summaries": summaries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/profit-loss-summary/generate")
async def generate_profit_loss_summary(request: Request):
    """Generate daily P&L summary for a date"""
    try:
        data = await request.json()
        date = data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        
        ad_revenue = await db.ad_revenue_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$net_amount"}}}
        ]).to_list(1)
        
        subscription_income = await db.subscription_income_ledger.aggregate([
            {"$match": {"date": date, "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        commission_income = await db.commission_income_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        
        interest_income = await db.interest_income_ledger.aggregate([
            {"$match": {"date_received": date}},
            {"$group": {"_id": None, "total": {"$sum": "$interest_amount"}}}
        ]).to_list(1)
        
        penalty_income = await db.penalty_income_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$equivalent_inr"}}}
        ]).to_list(1)
        
        expenses = await db.expense_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        redeem_payouts = await db.redeem_payout_ledger.aggregate([
            {"$match": {"date": date, "status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
        ]).to_list(1)
        
        total_income = (
            (ad_revenue[0].get("total", 0) if ad_revenue else 0) +
            (subscription_income[0].get("total", 0) if subscription_income else 0) +
            (commission_income[0].get("total", 0) if commission_income else 0) +
            (interest_income[0].get("total", 0) if interest_income else 0) +
            (penalty_income[0].get("total", 0) if penalty_income else 0)
        )
        
        total_expense = (
            (expenses[0].get("total", 0) if expenses else 0) +
            (redeem_payouts[0].get("total", 0) if redeem_payouts else 0)
        )
        
        summary = {
            "date": date,
            "ad_revenue": ad_revenue[0].get("total", 0) if ad_revenue else 0,
            "subscription_income": subscription_income[0].get("total", 0) if subscription_income else 0,
            "commission_income": commission_income[0].get("total", 0) if commission_income else 0,
            "interest_income": interest_income[0].get("total", 0) if interest_income else 0,
            "penalty_income": penalty_income[0].get("total", 0) if penalty_income else 0,
            "total_income": total_income,
            "operational_expenses": expenses[0].get("total", 0) if expenses else 0,
            "redeem_payouts": redeem_payouts[0].get("total", 0) if redeem_payouts else 0,
            "total_expense": total_expense,
            "net_profit_loss": total_income - total_expense,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.daily_profit_loss_summary.update_one(
            {"date": date},
            {"$set": summary},
            upsert=True
        )
        
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/balance-sheet")
async def get_balance_sheet():
    """Get auto-generated balance sheet"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        cash_latest = await db.cash_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        cash_balance = cash_latest.get("balance_after", 0) if cash_latest else 0
        
        bank_latest = await db.bank_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        bank_balance = bank_latest.get("balance_after", 0) if bank_latest else 0
        
        receivable_comm = await db.commission_income_ledger.aggregate([
            {"$match": {"status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        receivable_commission = receivable_comm[0].get("total", 0) if receivable_comm else 0
        
        total_prc_result = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        total_prc = total_prc_result[0].get("total", 0) if total_prc_result else 0
        prc_liability_inr = total_prc / prc_per_inr
        
        deposit_payable_result = await db.deposit_ledger.aggregate([
            {"$match": {"status": "active"}},
            {"$group": {"_id": None, "total": {"$sum": "$deposit_amount"}}}
        ]).to_list(1)
        deposit_payable = deposit_payable_result[0].get("total", 0) if deposit_payable_result else 0
        
        pending_redeem_result = await db.redeem_payout_ledger.aggregate([
            {"$match": {"status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
        ]).to_list(1)
        pending_redeem = pending_redeem_result[0].get("total", 0) if pending_redeem_result else 0
        
        reserve_wallet = await db.company_wallets.find_one({"wallet_type": "reserve_fund"}, {"_id": 0})
        reserve_balance = reserve_wallet.get("balance", 0) if reserve_wallet else 0
        
        total_assets = cash_balance + bank_balance + receivable_commission
        total_liabilities = prc_liability_inr + deposit_payable + pending_redeem
        equity = total_assets - total_liabilities + reserve_balance
        
        balance_sheet = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "assets": {
                "cash_balance": round(cash_balance, 2),
                "bank_balance": round(bank_balance, 2),
                "receivable_commission": round(receivable_commission, 2),
                "total_assets": round(total_assets, 2)
            },
            "liabilities": {
                "prc_liability_inr": round(prc_liability_inr, 2),
                "prc_in_system": round(total_prc, 2),
                "deposit_payable": round(deposit_payable, 2),
                "pending_redeem": round(pending_redeem, 2),
                "total_liabilities": round(total_liabilities, 2)
            },
            "equity": {
                "reserve_fund": round(reserve_balance, 2),
                "retained_earnings": round(equity - reserve_balance, 2),
                "total_equity": round(equity, 2)
            },
            "balance_check": {
                "assets": round(total_assets, 2),
                "liabilities_plus_equity": round(total_liabilities + equity, 2),
                "balanced": abs(total_assets - (total_liabilities + equity)) < 0.01
            }
        }
        
        return balance_sheet
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/master-summary")
async def get_master_ledger_summary():
    """Get master summary of all ledgers for quick overview"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        ad_revenue_total = await db.ad_revenue_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$net_amount"}}}]).to_list(1)
        subscription_total = await db.subscription_income_ledger.aggregate([{"$match": {"status": "completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
        commission_total = await db.commission_income_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}]).to_list(1)
        interest_total = await db.interest_income_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$interest_amount"}}}]).to_list(1)
        penalty_total = await db.penalty_income_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$equivalent_inr"}}}]).to_list(1)
        
        expense_total = await db.expense_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
        redeem_total = await db.redeem_payout_ledger.aggregate([{"$match": {"status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}]).to_list(1)
        
        total_prc = await db.users.aggregate([{"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}]).to_list(1)
        
        total_income = (
            (ad_revenue_total[0].get("total", 0) if ad_revenue_total else 0) +
            (subscription_total[0].get("total", 0) if subscription_total else 0) +
            (commission_total[0].get("total", 0) if commission_total else 0) +
            (interest_total[0].get("total", 0) if interest_total else 0) +
            (penalty_total[0].get("total", 0) if penalty_total else 0)
        )
        
        total_expense = (
            (expense_total[0].get("total", 0) if expense_total else 0) +
            (redeem_total[0].get("total", 0) if redeem_total else 0)
        )
        
        prc_in_system = total_prc[0].get("total", 0) if total_prc else 0
        
        return {
            "income": {
                "ad_revenue": round(ad_revenue_total[0].get("total", 0) if ad_revenue_total else 0, 2),
                "subscription": round(subscription_total[0].get("total", 0) if subscription_total else 0, 2),
                "commission": round(commission_total[0].get("total", 0) if commission_total else 0, 2),
                "interest": round(interest_total[0].get("total", 0) if interest_total else 0, 2),
                "penalty_forfeit": round(penalty_total[0].get("total", 0) if penalty_total else 0, 2),
                "total": round(total_income, 2)
            },
            "expense": {
                "operational": round(expense_total[0].get("total", 0) if expense_total else 0, 2),
                "redeem_payouts": round(redeem_total[0].get("total", 0) if redeem_total else 0, 2),
                "total": round(total_expense, 2)
            },
            "net_profit_loss": round(total_income - total_expense, 2),
            "prc_stats": {
                "total_in_system": round(prc_in_system, 2),
                "inr_liability": round(prc_in_system / prc_per_inr, 2),
                "conversion_rate": prc_per_inr
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Include all API routes (must be after all route definitions)
app.include_router(api_router)

# Health check endpoint for Kubernetes
@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes liveness and readiness probes"""
    try:
        # Check if database is accessible with timeout
        await asyncio.wait_for(
            client.admin.command('ping'),
            timeout=5.0  # 5 second timeout for health checks
        )
        return {
            "status": "healthy",
            "service": "paras-reward-backend",
            "database": "connected",
            "scheduler": "running" if scheduler.running else "stopped"
        }
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=503,
            detail="Database health check timeout"
        )
    except Exception as e:
        # Return 503 Service Unavailable if database is not accessible
        raise HTTPException(
            status_code=503,
            detail=f"Service unhealthy: {str(e)}"
        )


async def initialize_database_indexes():
    """Create database indexes for better performance"""
    # Users collection indexes
    try:
        await db.users.create_index("uid", unique=True)
    except Exception as e:
        print(f"⚠️  UID index: {e}")
    
    try:
        await db.users.create_index("email", unique=True)
    except Exception as e:
        print(f"⚠️  Email index: {e}")
    
    # Mobile index - sparse to allow multiple null values
    try:
        # Check existing indexes
        existing_indexes = await db.users.index_information()
        mobile_index = existing_indexes.get("mobile_1", {})
        
        # If mobile index exists but is not sparse, drop and recreate
        if "mobile_1" in existing_indexes and not mobile_index.get("sparse", False):
            try:
                await db.users.drop_index("mobile_1")
                print("✅ Dropped old non-sparse mobile index")
            except Exception as drop_error:
                print(f"⚠️  Could not drop mobile index: {drop_error}")
        
        # Create or ensure sparse unique index for mobile
        if "mobile_1" not in existing_indexes or not mobile_index.get("sparse", False):
            await db.users.create_index("mobile", unique=True, sparse=True)
            print("✅ Created sparse mobile index")
        else:
            print("✅ Mobile index already exists (sparse)")
    except Exception as e:
        print(f"⚠️  Mobile index setup: {e}")
    
    # Video ads indexes
    try:
        await db.video_ads.create_index("video_ad_id", unique=True)
        await db.video_ads.create_index("placement")
        await db.video_ads.create_index("is_active")
    except Exception as e:
        print(f"⚠️  Video ads indexes: {e}")
    
    # Treasure hunts indexes
    try:
        await db.treasure_hunts.create_index("hunt_id", unique=True)
        await db.treasure_progress.create_index("progress_id", unique=True)
        await db.treasure_progress.create_index("user_id")
    except Exception as e:
        print(f"⚠️  Treasure hunt indexes: {e}")
    
    # Orders indexes
    try:
        await db.orders.create_index("order_id", unique=True)
        await db.orders.create_index("user_id")
    except Exception as e:
        print(f"⚠️  Orders indexes: {e}")
    
    # Products indexes
    try:
        await db.products.create_index("product_id", unique=True)
    except Exception as e:
        print(f"⚠️  Products index: {e}")
    
    # Manager actions index (for audit logging)
    try:
        await db.manager_actions.create_index("manager_id")
        await db.manager_actions.create_index("timestamp")
    except Exception as e:
        print(f"⚠️  Manager actions indexes: {e}")
    
    print("✅ Database indexes initialization complete")


# ========== COMPLETE LEDGER SYSTEM (AUDIT-READY) ==========
# Based on Master Ledger Document

# ---------- INCOME LEDGERS (₹ INFLOW) ----------

@api_router.get("/admin/ledger/subscription-income")
async def get_subscription_income_ledger(page: int = 1, limit: int = 50, start_date: str = None, end_date: str = None):
    """Get VIP/Premium subscription income ledger"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        skip = (page - 1) * limit
        entries = await db.subscription_income_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.subscription_income_ledger.count_documents(query)
        
        # Calculate totals
        totals_result = await db.subscription_income_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "total_amount": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_amount = totals_result[0].get("total_amount", 0) if totals_result else 0
        
        return {
            "entries": entries,
            "total": total,
            "total_amount": total_amount,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/subscription-income")
async def add_subscription_income(request: Request):
    """Add subscription income entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "plan_name": data.get("plan_name", "VIP"),
            "amount": float(data.get("amount", 0)),
            "payment_mode": data.get("payment_mode", "online"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "status": data.get("status", "completed"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscription_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/commission-income")
async def get_commission_income_ledger(page: int = 1, limit: int = 50, source_type: str = None):
    """Get commission income from recharges, bills, products"""
    try:
        query = {}
        if source_type:
            query["source_type"] = source_type
        
        skip = (page - 1) * limit
        entries = await db.commission_income_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.commission_income_ledger.count_documents(query)
        
        totals_result = await db.commission_income_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "gross": {"$sum": "$gross_commission"}, "tds": {"$sum": "$tds"}, "net": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"gross": 0, "tds": 0, "net": 0}
        
        return {
            "entries": entries,
            "total": total,
            "totals": totals,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/commission-income")
async def add_commission_income(request: Request):
    """Add commission income entry"""
    try:
        data = await request.json()
        gross = float(data.get("gross_commission", 0))
        tds = float(data.get("tds", 0))
        entry = {
            "id": str(uuid.uuid4()),
            "source_type": data.get("source_type", "recharge"),
            "partner_name": data.get("partner_name", ""),
            "transaction_id": data.get("transaction_id", ""),
            "gross_commission": gross,
            "tds": tds,
            "net_commission": gross - tds,
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.commission_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/penalty-income")
async def get_penalty_income_ledger(page: int = 1, limit: int = 50):
    """Get penalty/forfeit income from PRC expiry, fraud"""
    try:
        skip = (page - 1) * limit
        entries = await db.penalty_income_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.penalty_income_ledger.count_documents({})
        
        totals_result = await db.penalty_income_ledger.aggregate([
            {"$group": {"_id": None, "total_prc": {"$sum": "$prc_burned"}, "total_inr": {"$sum": "$equivalent_inr"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"total_prc": 0, "total_inr": 0}
        
        return {"entries": entries, "total": total, "totals": totals, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/penalty-income")
async def add_penalty_income(request: Request):
    """Add penalty income entry"""
    try:
        data = await request.json()
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        prc_burned = float(data.get("prc_burned", 0))
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "prc_burned": prc_burned,
            "equivalent_inr": prc_burned / prc_per_inr,
            "reason": data.get("reason", "expiry"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.penalty_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/interest-income")
async def get_interest_income_ledger(page: int = 1, limit: int = 50):
    """Get interest income from bank FD, savings, partners"""
    try:
        skip = (page - 1) * limit
        entries = await db.interest_income_ledger.find({}, {"_id": 0}).sort("date_received", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.interest_income_ledger.count_documents({})
        
        totals_result = await db.interest_income_ledger.aggregate([
            {"$group": {"_id": None, "total_interest": {"$sum": "$interest_amount"}}}
        ]).to_list(1)
        total_interest = totals_result[0].get("total_interest", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_interest": total_interest, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/interest-income")
async def add_interest_income(request: Request):
    """Add interest income entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "source": data.get("source", "bank"),
            "principal_amount": float(data.get("principal_amount", 0)),
            "interest_rate": float(data.get("interest_rate", 0)),
            "interest_amount": float(data.get("interest_amount", 0)),
            "period": data.get("period", ""),
            "date_received": data.get("date_received", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.interest_income_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/ad-revenue")
async def get_ad_revenue_ledger(page: int = 1, limit: int = 50, platform: str = None):
    """Get advertising revenue ledger"""
    try:
        query = {}
        if platform:
            query["platform"] = platform
        
        skip = (page - 1) * limit
        entries = await db.ad_revenue_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.ad_revenue_ledger.count_documents(query)
        
        totals_result = await db.ad_revenue_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": None, "gross": {"$sum": "$gross_amount"}, "charges": {"$sum": "$platform_charges"}, "net": {"$sum": "$net_amount"}}}
        ]).to_list(1)
        totals = totals_result[0] if totals_result else {"gross": 0, "charges": 0, "net": 0}
        
        return {"entries": entries, "total": total, "totals": totals, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/ad-revenue")
async def add_ad_revenue(request: Request):
    """Add ad revenue entry"""
    try:
        data = await request.json()
        gross = float(data.get("gross_amount", 0))
        charges = float(data.get("platform_charges", 0))
        entry = {
            "id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "platform": data.get("platform", "admob"),
            "gross_amount": gross,
            "platform_charges": charges,
            "net_amount": gross - charges,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ad_revenue_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- EXPENSE LEDGERS (₹ OUTFLOW) ----------

@api_router.get("/admin/ledger/redeem-payout")
async def get_redeem_payout_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get redeem payout ledger - actual INR payouts"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.redeem_payout_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.redeem_payout_ledger.count_documents(query)
        
        totals_result = await db.redeem_payout_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": "$status", "total_prc": {"$sum": "$prc_used"}, "total_inr": {"$sum": "$amount_inr"}}}
        ]).to_list(10)
        
        return {"entries": entries, "total": total, "totals_by_status": totals_result, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/redeem-payout")
async def add_redeem_payout(request: Request):
    """Add redeem payout entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "redeem_type": data.get("redeem_type", "voucher"),
            "prc_used": float(data.get("prc_used", 0)),
            "amount_inr": float(data.get("amount_inr", 0)),
            "payment_mode": data.get("payment_mode", "bank"),
            "status": data.get("status", "pending"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.redeem_payout_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/admin/ledger/redeem-payout/{entry_id}")
async def update_redeem_payout_status(entry_id: str, request: Request):
    """Update redeem payout status"""
    try:
        data = await request.json()
        result = await db.redeem_payout_ledger.update_one(
            {"id": entry_id},
            {"$set": {"status": data.get("status"), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": result.modified_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/expenses")
async def get_expense_ledger(page: int = 1, limit: int = 50, expense_type: str = None):
    """Get all expense entries"""
    try:
        query = {}
        if expense_type:
            query["expense_type"] = expense_type
        
        skip = (page - 1) * limit
        entries = await db.expense_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.expense_ledger.count_documents(query)
        
        totals_result = await db.expense_ledger.aggregate([
            {"$match": query},
            {"$group": {"_id": "$expense_type", "total": {"$sum": "$amount"}}}
        ]).to_list(20)
        
        return {"entries": entries, "total": total, "totals_by_type": totals_result, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/expenses")
async def add_expense(request: Request):
    """Add expense entry (server, sms, salary, marketing, legal, etc.)"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "expense_type": data.get("expense_type", "operational"),
            "category": data.get("category", ""),
            "provider": data.get("provider", ""),
            "description": data.get("description", ""),
            "amount": float(data.get("amount", 0)),
            "payment_mode": data.get("payment_mode", "bank"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.expense_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- CASH & BANK LEDGERS ----------

@api_router.get("/admin/ledger/cash")
async def get_cash_ledger(page: int = 1, limit: int = 50, start_date: str = None, end_date: str = None):
    """Get cash ledger entries"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        skip = (page - 1) * limit
        entries = await db.cash_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.cash_ledger.count_documents(query)
        
        # Get current balance
        latest = await db.cash_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        return {"entries": entries, "total": total, "current_balance": current_balance, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/cash")
async def add_cash_entry(request: Request):
    """Add cash ledger entry"""
    try:
        data = await request.json()
        
        # Get current balance
        latest = await db.cash_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        cash_in = float(data.get("cash_in", 0))
        cash_out = float(data.get("cash_out", 0))
        new_balance = current_balance + cash_in - cash_out
        
        entry = {
            "id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "source_type": data.get("source_type", "income"),
            "reference_id": data.get("reference_id", ""),
            "cash_in": cash_in,
            "cash_out": cash_out,
            "balance_after": new_balance,
            "remarks": data.get("remarks", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cash_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/bank")
async def get_bank_ledger(page: int = 1, limit: int = 50, bank_name: str = None):
    """Get bank ledger entries"""
    try:
        query = {}
        if bank_name:
            query["bank_name"] = bank_name
        
        skip = (page - 1) * limit
        entries = await db.bank_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.bank_ledger.count_documents(query)
        
        # Get current balance
        latest = await db.bank_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        return {"entries": entries, "total": total, "current_balance": current_balance, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/bank")
async def add_bank_entry(request: Request):
    """Add bank ledger entry"""
    try:
        data = await request.json()
        
        # Get current balance
        latest = await db.bank_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        current_balance = latest.get("balance_after", 0) if latest else 0
        
        amount = float(data.get("amount", 0))
        txn_type = data.get("transaction_type", "credit")
        
        if txn_type == "credit":
            new_balance = current_balance + amount
        else:
            new_balance = current_balance - amount
        
        entry = {
            "id": str(uuid.uuid4()),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "bank_name": data.get("bank_name", ""),
            "account_last4": data.get("account_last4", ""),
            "transaction_type": txn_type,
            "source_type": data.get("source_type", ""),
            "reference_id": data.get("reference_id", ""),
            "amount": amount,
            "balance_after": new_balance,
            "remarks": data.get("remarks", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bank_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- DEPOSIT & STOCKIST LEDGERS ----------

@api_router.get("/admin/ledger/deposits")
async def get_deposit_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get stockist/partner deposit ledger"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.deposit_ledger.find(query, {"_id": 0}).sort("date_received", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.deposit_ledger.count_documents(query)
        
        totals_result = await db.deposit_ledger.aggregate([
            {"$group": {"_id": "$status", "total": {"$sum": "$deposit_amount"}}}
        ]).to_list(5)
        
        return {"entries": entries, "total": total, "totals_by_status": totals_result, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/deposits")
async def add_deposit(request: Request):
    """Add deposit entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "party_name": data.get("party_name"),
            "party_type": data.get("party_type", "stockist"),
            "deposit_amount": float(data.get("deposit_amount", 0)),
            "mode": data.get("mode", "bank"),
            "date_received": data.get("date_received", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.deposit_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/deposits/{deposit_id}/refund")
async def refund_deposit(deposit_id: str, request: Request):
    """Refund a deposit"""
    try:
        data = await request.json()
        
        # Update deposit status
        await db.deposit_ledger.update_one(
            {"id": deposit_id},
            {"$set": {"status": "refunded", "refund_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}}
        )
        
        # Create refund record
        deposit = await db.deposit_ledger.find_one({"id": deposit_id}, {"_id": 0})
        if deposit:
            refund_entry = {
                "id": str(uuid.uuid4()),
                "party_name": deposit.get("party_name"),
                "deposit_reference_id": deposit_id,
                "amount_returned": deposit.get("deposit_amount"),
                "mode": data.get("mode", "bank"),
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "remarks": data.get("remarks", ""),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.deposit_refund_ledger.insert_one(refund_entry)
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/renewal-fees")
async def get_renewal_fees_ledger(page: int = 1, limit: int = 50):
    """Get renewal/activation fees ledger"""
    try:
        skip = (page - 1) * limit
        entries = await db.renewal_fees_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.renewal_fees_ledger.count_documents({})
        
        totals_result = await db.renewal_fees_ledger.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_amount = totals_result[0].get("total", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_amount": total_amount, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/renewal-fees")
async def add_renewal_fee(request: Request):
    """Add renewal fee entry"""
    try:
        data = await request.json()
        entry = {
            "id": str(uuid.uuid4()),
            "party_name": data.get("party_name"),
            "fee_type": data.get("fee_type", "renewal"),
            "amount": float(data.get("amount", 0)),
            "mode": data.get("mode", "bank"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.renewal_fees_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- UTILITY TRANSACTION LEDGERS ----------

@api_router.get("/admin/ledger/mobile-recharge")
async def get_mobile_recharge_ledger(page: int = 1, limit: int = 50, status: str = None):
    """Get mobile recharge ledger"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        entries = await db.mobile_recharge_ledger.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.mobile_recharge_ledger.count_documents(query)
        
        return {"entries": entries, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/product-purchase")
async def get_product_purchase_ledger(page: int = 1, limit: int = 50):
    """Get product purchase ledger"""
    try:
        skip = (page - 1) * limit
        entries = await db.product_purchase_ledger.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.product_purchase_ledger.count_documents({})
        
        totals_result = await db.product_purchase_ledger.aggregate([
            {"$group": {"_id": None, "total_profit": {"$sum": "$profit_margin"}}}
        ]).to_list(1)
        total_profit = totals_result[0].get("total_profit", 0) if totals_result else 0
        
        return {"entries": entries, "total": total, "total_profit": total_profit, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/product-purchase")
async def add_product_purchase(request: Request):
    """Add product purchase entry"""
    try:
        data = await request.json()
        purchase_cost = float(data.get("purchase_cost", 0))
        selling_price = float(data.get("selling_price", 0))
        
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": data.get("user_id"),
            "product_name": data.get("product_name"),
            "category": data.get("category", ""),
            "prc_used": float(data.get("prc_used", 0)),
            "cash_used": float(data.get("cash_used", 0)),
            "purchase_cost": purchase_cost,
            "selling_price": selling_price,
            "profit_margin": selling_price - purchase_cost,
            "status": data.get("status", "completed"),
            "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.product_purchase_ledger.insert_one(entry)
        return {"success": True, "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- SUMMARY & RECONCILIATION LEDGERS ----------

@api_router.get("/admin/ledger/daily-cash-bank-summary")
async def get_daily_cash_bank_summary(start_date: str = None, end_date: str = None):
    """Get daily cash & bank summary"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        summaries = await db.daily_cash_bank_summary.find(query, {"_id": 0}).sort("date", -1).limit(30).to_list(30)
        return {"summaries": summaries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/daily-cash-bank-summary/generate")
async def generate_daily_cash_bank_summary(request: Request):
    """Generate daily cash & bank summary for a date"""
    try:
        data = await request.json()
        date = data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        
        # Get cash transactions for the date
        cash_in_result = await db.cash_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total_in": {"$sum": "$cash_in"}, "total_out": {"$sum": "$cash_out"}}}
        ]).to_list(1)
        
        # Get bank transactions for the date
        bank_credit_result = await db.bank_ledger.aggregate([
            {"$match": {"date": date, "transaction_type": "credit"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        bank_debit_result = await db.bank_ledger.aggregate([
            {"$match": {"date": date, "transaction_type": "debit"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        # Get previous day's closing balances
        prev_date = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        prev_summary = await db.daily_cash_bank_summary.find_one({"date": prev_date}, {"_id": 0})
        
        opening_cash = prev_summary.get("closing_cash", 0) if prev_summary else 0
        opening_bank = prev_summary.get("closing_bank", 0) if prev_summary else 0
        
        cash_in = cash_in_result[0].get("total_in", 0) if cash_in_result else 0
        cash_out = cash_in_result[0].get("total_out", 0) if cash_in_result else 0
        bank_credit = bank_credit_result[0].get("total", 0) if bank_credit_result else 0
        bank_debit = bank_debit_result[0].get("total", 0) if bank_debit_result else 0
        
        summary = {
            "date": date,
            "opening_cash": opening_cash,
            "cash_in": cash_in,
            "cash_out": cash_out,
            "closing_cash": opening_cash + cash_in - cash_out,
            "opening_bank": opening_bank,
            "bank_credit": bank_credit,
            "bank_debit": bank_debit,
            "closing_bank": opening_bank + bank_credit - bank_debit,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.daily_cash_bank_summary.update_one(
            {"date": date},
            {"$set": summary},
            upsert=True
        )
        
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/profit-loss-summary")
async def get_profit_loss_summary(start_date: str = None, end_date: str = None):
    """Get daily profit & loss summary"""
    try:
        query = {}
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            query.setdefault("date", {})["$lte"] = end_date
        
        summaries = await db.daily_profit_loss_summary.find(query, {"_id": 0}).sort("date", -1).limit(30).to_list(30)
        return {"summaries": summaries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/ledger/profit-loss-summary/generate")
async def generate_profit_loss_summary(request: Request):
    """Generate daily P&L summary for a date"""
    try:
        data = await request.json()
        date = data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        
        # Calculate income
        ad_revenue = await db.ad_revenue_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$net_amount"}}}
        ]).to_list(1)
        
        subscription_income = await db.subscription_income_ledger.aggregate([
            {"$match": {"date": date, "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        commission_income = await db.commission_income_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        
        interest_income = await db.interest_income_ledger.aggregate([
            {"$match": {"date_received": date}},
            {"$group": {"_id": None, "total": {"$sum": "$interest_amount"}}}
        ]).to_list(1)
        
        penalty_income = await db.penalty_income_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$equivalent_inr"}}}
        ]).to_list(1)
        
        # Calculate expenses
        expenses = await db.expense_ledger.aggregate([
            {"$match": {"date": date}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        redeem_payouts = await db.redeem_payout_ledger.aggregate([
            {"$match": {"date": date, "status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
        ]).to_list(1)
        
        total_income = (
            (ad_revenue[0].get("total", 0) if ad_revenue else 0) +
            (subscription_income[0].get("total", 0) if subscription_income else 0) +
            (commission_income[0].get("total", 0) if commission_income else 0) +
            (interest_income[0].get("total", 0) if interest_income else 0) +
            (penalty_income[0].get("total", 0) if penalty_income else 0)
        )
        
        total_expense = (
            (expenses[0].get("total", 0) if expenses else 0) +
            (redeem_payouts[0].get("total", 0) if redeem_payouts else 0)
        )
        
        summary = {
            "date": date,
            "ad_revenue": ad_revenue[0].get("total", 0) if ad_revenue else 0,
            "subscription_income": subscription_income[0].get("total", 0) if subscription_income else 0,
            "commission_income": commission_income[0].get("total", 0) if commission_income else 0,
            "interest_income": interest_income[0].get("total", 0) if interest_income else 0,
            "penalty_income": penalty_income[0].get("total", 0) if penalty_income else 0,
            "total_income": total_income,
            "operational_expenses": expenses[0].get("total", 0) if expenses else 0,
            "redeem_payouts": redeem_payouts[0].get("total", 0) if redeem_payouts else 0,
            "total_expense": total_expense,
            "net_profit_loss": total_income - total_expense,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.daily_profit_loss_summary.update_one(
            {"date": date},
            {"$set": summary},
            upsert=True
        )
        
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/balance-sheet")
async def get_balance_sheet():
    """Get auto-generated balance sheet"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        # ASSETS
        cash_latest = await db.cash_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        cash_balance = cash_latest.get("balance_after", 0) if cash_latest else 0
        
        bank_latest = await db.bank_ledger.find_one({}, {"_id": 0, "balance_after": 1}, sort=[("created_at", -1)])
        bank_balance = bank_latest.get("balance_after", 0) if bank_latest else 0
        
        # Receivable commission (pending commissions)
        receivable_comm = await db.commission_income_ledger.aggregate([
            {"$match": {"status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}
        ]).to_list(1)
        receivable_commission = receivable_comm[0].get("total", 0) if receivable_comm else 0
        
        # LIABILITIES
        # PRC Liability (all unredeemed PRC)
        total_prc_result = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        total_prc = total_prc_result[0].get("total", 0) if total_prc_result else 0
        prc_liability_inr = total_prc / prc_per_inr
        
        # Deposit payable (active deposits)
        deposit_payable_result = await db.deposit_ledger.aggregate([
            {"$match": {"status": "active"}},
            {"$group": {"_id": None, "total": {"$sum": "$deposit_amount"}}}
        ]).to_list(1)
        deposit_payable = deposit_payable_result[0].get("total", 0) if deposit_payable_result else 0
        
        # Pending redeem payouts
        pending_redeem_result = await db.redeem_payout_ledger.aggregate([
            {"$match": {"status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
        ]).to_list(1)
        pending_redeem = pending_redeem_result[0].get("total", 0) if pending_redeem_result else 0
        
        # Reserve fund
        reserve_wallet = await db.company_wallets.find_one({"wallet_type": "reserve_fund"}, {"_id": 0})
        reserve_balance = reserve_wallet.get("balance", 0) if reserve_wallet else 0
        
        # Calculate totals
        total_assets = cash_balance + bank_balance + receivable_commission
        total_liabilities = prc_liability_inr + deposit_payable + pending_redeem
        equity = total_assets - total_liabilities + reserve_balance
        
        balance_sheet = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "assets": {
                "cash_balance": round(cash_balance, 2),
                "bank_balance": round(bank_balance, 2),
                "receivable_commission": round(receivable_commission, 2),
                "total_assets": round(total_assets, 2)
            },
            "liabilities": {
                "prc_liability_inr": round(prc_liability_inr, 2),
                "prc_in_system": round(total_prc, 2),
                "deposit_payable": round(deposit_payable, 2),
                "pending_redeem": round(pending_redeem, 2),
                "total_liabilities": round(total_liabilities, 2)
            },
            "equity": {
                "reserve_fund": round(reserve_balance, 2),
                "retained_earnings": round(equity - reserve_balance, 2),
                "total_equity": round(equity, 2)
            },
            "balance_check": {
                "assets": round(total_assets, 2),
                "liabilities_plus_equity": round(total_liabilities + equity, 2),
                "balanced": abs(total_assets - (total_liabilities + equity)) < 0.01
            }
        }
        
        return balance_sheet
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/ledger/master-summary")
async def get_master_ledger_summary():
    """Get master summary of all ledgers for quick overview"""
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
        prc_per_inr = settings.get("accounting_settings", {}).get("prc_per_inr", 10) if settings else 10
        
        # Income totals
        ad_revenue_total = await db.ad_revenue_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$net_amount"}}}]).to_list(1)
        subscription_total = await db.subscription_income_ledger.aggregate([{"$match": {"status": "completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
        commission_total = await db.commission_income_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$net_commission"}}}]).to_list(1)
        interest_total = await db.interest_income_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$interest_amount"}}}]).to_list(1)
        penalty_total = await db.penalty_income_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$equivalent_inr"}}}]).to_list(1)
        
        # Expense totals
        expense_total = await db.expense_ledger.aggregate([{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
        redeem_total = await db.redeem_payout_ledger.aggregate([{"$match": {"status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}]).to_list(1)
        
        # PRC stats
        total_prc = await db.users.aggregate([{"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}]).to_list(1)
        
        total_income = (
            (ad_revenue_total[0].get("total", 0) if ad_revenue_total else 0) +
            (subscription_total[0].get("total", 0) if subscription_total else 0) +
            (commission_total[0].get("total", 0) if commission_total else 0) +
            (interest_total[0].get("total", 0) if interest_total else 0) +
            (penalty_total[0].get("total", 0) if penalty_total else 0)
        )
        
        total_expense = (
            (expense_total[0].get("total", 0) if expense_total else 0) +
            (redeem_total[0].get("total", 0) if redeem_total else 0)
        )
        
        prc_in_system = total_prc[0].get("total", 0) if total_prc else 0
        
        return {
            "income": {
                "ad_revenue": round(ad_revenue_total[0].get("total", 0) if ad_revenue_total else 0, 2),
                "subscription": round(subscription_total[0].get("total", 0) if subscription_total else 0, 2),
                "commission": round(commission_total[0].get("total", 0) if commission_total else 0, 2),
                "interest": round(interest_total[0].get("total", 0) if interest_total else 0, 2),
                "penalty_forfeit": round(penalty_total[0].get("total", 0) if penalty_total else 0, 2),
                "total": round(total_income, 2)
            },
            "expense": {
                "operational": round(expense_total[0].get("total", 0) if expense_total else 0, 2),
                "redeem_payouts": round(redeem_total[0].get("total", 0) if redeem_total else 0, 2),
                "total": round(total_expense, 2)
            },
            "net_profit_loss": round(total_income - total_expense, 2),
            "prc_stats": {
                "total_in_system": round(prc_in_system, 2),
                "inr_liability": round(prc_in_system / prc_per_inr, 2),
                "conversion_rate": prc_per_inr
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def startup_db():
    """Initialize database with default data and start scheduled tasks"""
    print("🚀 Starting database initialization...")
    
    # Verify MongoDB connection with retry logic for Atlas
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            # Ping database to verify connection
            await client.admin.command('ping')
            print(f"✅ MongoDB connection successful (attempt {attempt + 1}/{max_retries})")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"⚠️ MongoDB connection attempt {attempt + 1} failed: {e}")
                print(f"   Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
            else:
                print(f"❌ MongoDB connection failed after {max_retries} attempts: {e}")
                raise HTTPException(
                    status_code=503,
                    detail="Database connection failed. Please check MONGO_URL configuration."
                )
    
    try:
        # Create indexes with error handling
        await initialize_database_indexes()
        print("✅ Database indexes initialized")
    except Exception as e:
        print(f"⚠️ Error initializing indexes (non-critical): {e}")
    
    try:
        # Initialize treasure hunts (creates if not exists)
        await initialize_treasure_hunts()
        print("✅ Treasure hunts initialized")
    except Exception as e:
        print(f"⚠️ Error initializing treasure hunts (non-critical): {e}")
    
    try:
        # Check if video_ads collection exists, if not create sample
        video_ads_count = await db.video_ads.count_documents({})
        if video_ads_count == 0:
            print("📹 No video ads found, database ready for admin to create videos")
    except Exception as e:
        print(f"⚠️ Error checking video ads (non-critical): {e}")
    
    print("✅ Database initialization complete!")
    
    # Start scheduler for automated tasks
    print("⏰ Starting scheduled tasks...")
    
    try:
        # Schedule PRC burn for free users - runs every hour
        scheduler.add_job(
            burn_expired_prc_for_free_users,
            CronTrigger(hour='*'),  # Every hour
            id='burn_free_user_prc',
            name='Burn expired PRC for free users (48 hour expiry)',
            replace_existing=True
        )
        
        # Schedule PRC burn for expired VIP users - runs daily at 2 AM
        scheduler.add_job(
            burn_expired_vip_prc,
            CronTrigger(hour=2, minute=0),  # Daily at 2 AM
            id='burn_expired_vip_prc',
            name='Burn PRC for expired VIP users (5 day grace period)',
            replace_existing=True
        )
        
        # Schedule daily wallet reconciliation - runs at 3 AM
        scheduler.add_job(
            daily_wallet_reconciliation,
            CronTrigger(hour=3, minute=0),  # Daily at 3 AM
            id='daily_wallet_reconciliation',
            name='Daily wallet reconciliation and profit calculation',
            replace_existing=True
        )
        
        # Schedule daily system summary generation - runs at 12:05 AM
        scheduler.add_job(
            generate_daily_summary,
            CronTrigger(hour=0, minute=5),  # Daily at 12:05 AM
            id='daily_system_summary',
            name='Generate daily accounting summary',
            replace_existing=True
        )
        
        # Schedule inactive user PRC burn - runs weekly on Sunday at 4 AM
        scheduler.add_job(
            burn_inactive_user_prc,
            CronTrigger(day_of_week='sun', hour=4, minute=0),  # Weekly on Sunday at 4 AM
            id='inactive_user_prc_burn',
            name='Burn PRC for 180+ day inactive users',
            replace_existing=True
        )
        
        # Start the scheduler
        scheduler.start()
        print("✅ Scheduled tasks started:")
        print("   - Free user PRC burn: Every hour")
        print("   - Expired VIP PRC burn: Daily at 2 AM")
        print("   - Wallet reconciliation: Daily at 3 AM")
        print("   - Daily system summary: Daily at 12:05 AM")
        print("   - Inactive user PRC burn: Weekly Sunday at 4 AM")
    except Exception as e:
        print(f"⚠️ Error starting scheduler (non-critical): {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Shutdown database client and scheduler"""
    # Shutdown scheduler
    if scheduler.running:
        scheduler.shutdown()
        print("⏰ Scheduler shut down")
    
    # Close database client
    client.close()
    print("🔒 Database connection closed")