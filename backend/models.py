from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid
import secrets
import string

# ========== USER MODELS ==========
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    uid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Basic Info
    email: Optional[str] = None
    mobile: Optional[str] = None
    first_name: str = ""
    middle_name: Optional[str] = None
    last_name: str = ""
    profile_picture: Optional[str] = None
    
    # Address
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    pincode: Optional[str] = None
    full_address: Optional[str] = None
    
    # KYC Documents
    aadhaar_number: Optional[str] = None
    aadhaar_front: Optional[str] = None
    aadhaar_back: Optional[str] = None
    pan_number: Optional[str] = None
    pan_front: Optional[str] = None
    
    # Bank Details
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None
    upi_id: Optional[str] = None
    
    # System Fields
    role: str = "user"  # user, admin, sub_admin, manager, employee, master_stockist, sub_stockist, outlet
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    
    # Membership
    membership_type: str = "free"  # free, vip
    membership_expiry: Optional[datetime] = None
    vip_activation_date: Optional[datetime] = None
    
    # Wallets
    prc_balance: float = 0.0
    cashback_wallet_balance: float = 0.0
    profit_wallet_balance: float = 0.0  # For stockists/outlets
    wallet_status: str = "active"  # active, lien_pending
    wallet_maintenance_due: float = 0.0
    last_wallet_maintenance: Optional[datetime] = None
    
    # Security Deposit (for stockists/outlets)
    security_deposit_amount: float = 0.0
    security_deposit_paid: bool = False
    security_deposit_date: Optional[datetime] = None
    monthly_return_rate: float = 0.03  # 3%
    last_return_credit: Optional[datetime] = None
    
    # Annual Renewal
    renewal_fee_amount: float = 0.0
    renewal_due_date: Optional[datetime] = None
    renewal_status: str = "active"  # active, pending, overdue
    
    # KYC Status
    kyc_status: str = "pending"  # pending, pending_manual, approved, rejected
    kyc_verified_at: Optional[datetime] = None
    profile_completion: float = 0.0
    
    # Mining
    mining_active: bool = False
    mining_start_time: Optional[datetime] = None
    mining_session_start: Optional[datetime] = None
    total_mined: float = 0.0
    
    # Tap Game
    taps_today: int = 0
    last_tap_date: Optional[str] = None
    
    # Referral
    referral_code: str = Field(default_factory=lambda: ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8)))
    referred_by: Optional[str] = None
    referrer_locked: bool = False
    
    # Security
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    last_login: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    login_count: int = 0
    
    # Status
    is_active: bool = True
    is_banned: bool = False
    suspension_reason: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    tahsil: Optional[str] = None  # Same as taluka, different regions use different terms
    village: Optional[str] = None
    pincode: Optional[str] = None
    full_address: Optional[str] = None
    profile_picture: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None
    upi_id: Optional[str] = None

# ========== STOCKIST/OUTLET MODELS ==========
class Stockist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    stockist_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Reference to user document
    
    # Business Info
    business_name: str
    owner_full_name: str
    business_type: str  # master, sub, outlet
    
    # Contact
    contact_number: str
    email: str
    
    # Address
    state: str
    district: str
    taluka: str
    village: str
    pincode: str
    full_address: str
    
    # Documents
    udyog_aadhaar: Optional[str] = None
    shop_act: Optional[str] = None
    gst_certificate: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: str
    aadhaar_number: str
    
    # Hierarchy
    master_stockist_id: Optional[str] = None
    sub_stockist_id: Optional[str] = None
    assigned_region: Optional[str] = None
    
    # Financial
    security_deposit: float = 0.0
    renewal_fee: float = 0.0
    profit_wallet: float = 0.0
    
    # Status
    approval_status: str = "pending"  # pending, approved, rejected
    is_active: bool = False
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None

# ========== PRODUCT & ORDER MODELS ==========
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    sku: str
    description: str
    prc_price: float
    cash_price: float = 0.0
    product_type: str = "physical"  # physical, digital
    category: str
    image_url: Optional[str] = None
    
    # Stock
    stock_quantity: int = 0
    stock_allocations: Dict[str, int] = {}  # {region_id: quantity}
    
    # Visibility
    is_visible: bool = True
    vip_only: bool = False
    regions: List[str] = []  # Empty means global
    visible_from: Optional[datetime] = None
    visible_till: Optional[datetime] = None
    
    # Meta
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CartItem(BaseModel):
    product_id: str
    quantity: int = 1

class Cart(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cart_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[CartItem] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderItem(BaseModel):
    product_id: str
    product_name: str
    prc_price: float
    quantity: int
    total_prc: float

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    order_id: str = Field(default_factory=lambda: f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}")
    user_id: str
    
    # Items
    items: List[OrderItem]
    
    # Amounts
    total_prc: float
    cashback_amount_prc: float  # 25% of total_prc
    cashback_amount_inr: float  # Converted to INR
    delivery_charge_rate: float = 0.10  # 10%
    delivery_charge_inr: float
    
    # Distribution
    profit_distribution: Dict[str, float] = {}  # {master:%, sub:%, outlet:%, company:%}
    delivery_charge_distributed: bool = False
    
    # Outlet Assignment
    outlet_id: Optional[str] = None
    master_id: Optional[str] = None
    sub_id: Optional[str] = None
    
    # Secret Code
    secret_code: str = Field(default_factory=lambda: f"PRC-{''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))}")
    
    # Status
    status: str = "pending"  # pending, verified, delivered, cancelled
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

# ========== WITHDRAWAL MODELS ==========
class WithdrawalRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    withdrawal_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    wallet_type: str  # cashback, profit
    amount: float
    fee: float = 5.0
    net_amount: float
    
    # Payment Details
    payment_mode: str  # upi, bank
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    
    # Status
    status: str = "pending"  # pending, approved, rejected, completed
    utr_number: Optional[str] = None
    admin_notes: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None

# ========== COMMISSION & PROFIT MODELS ==========
class CommissionEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    commission_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    entity_id: str  # user_id of master/sub/outlet
    entity_type: str  # master, sub, outlet, company
    amount: float
    percentage: float
    credited_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ========== SUPPORT TICKET MODELS ==========
class SupportTicket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str = Field(default_factory=lambda: f"TKT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}")
    user_id: str
    user_name: str
    user_email: str
    
    # Ticket Info
    subject: str
    category: str  # kyc, withdrawal, mining, order, technical, other
    description: str
    priority: str = "medium"  # low, medium, high, urgent
    
    # Status
    status: str = "open"  # open, in_progress, resolved, closed
    assigned_to: Optional[str] = None
    
    # Response
    admin_response: Optional[str] = None
    resolution_notes: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None

class TicketResponse(BaseModel):
    message: str
    is_admin: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ========== SETTINGS MODELS ==========
class SystemSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    # Mining Formula
    mining_base_rate: float = 50.0
    mining_base_rate_min: float = 10.0
    mining_decrease_per_users: int = 100
    referral_bonus_percentage: float = 0.10  # 10% per referral
    max_referrals: int = 200
    
    # Delivery & Commission
    delivery_charge_rate: float = 0.10  # 10%
    delivery_split: Dict[str, float] = {"master": 10, "sub": 20, "outlet": 60, "company": 10}
    
    # Cashback
    cashback_percentage: float = 0.25  # 25%
    
    # Wallet
    wallet_maintenance_fee: float = 99.0
    wallet_maintenance_period_days: int = 365
    withdrawal_min_amount: float = 10.0
    withdrawal_fee: float = 5.0
    
    # Security Deposits
    master_security_deposit: float = 500000.0
    sub_security_deposit: float = 300000.0
    outlet_security_deposit: float = 100000.0
    security_deposit_return_rate: float = 0.03  # 3% monthly
    
    # Annual Renewal
    master_renewal_fee: float = 50000.0
    sub_renewal_fee: float = 30000.0
    outlet_renewal_fee: float = 10000.0
    
    # VIP
    vip_membership_fee: float = 1000.0
    vip_validity_days: int = 365
    
    # Updated
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None


# ========== TRANSACTION MODELS ==========
class Transaction(BaseModel):
    """Comprehensive transaction model for wallet operations"""
    model_config = ConfigDict(extra="ignore")
    transaction_id: str = Field(default_factory=lambda: f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}")
    user_id: str
    
    # Wallet info
    wallet_type: str  # cashback, profit
    
    # Transaction details
    type: str  # mining, tap_game, referral, order, cashback, withdrawal, withdrawal_rejected, admin_adjustment, delivery_charge, profit_share
    amount: float
    
    # Balance tracking
    balance_before: float
    balance_after: float
    
    # Status
    status: str = "completed"  # completed, pending, failed, reversed
    
    # Description and metadata
    description: str
    metadata: Dict = {}  # Additional info like order_id, product_name, etc.
    
    # Related entities
    related_id: Optional[str] = None  # order_id, withdrawal_id, etc.
    related_type: Optional[str] = None  # order, withdrawal, etc.
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    """Model for creating a transaction"""
    user_id: str
    wallet_type: str
    type: str
    amount: float
    description: str
    metadata: Dict = {}
    related_id: Optional[str] = None
    related_type: Optional[str] = None

class WithdrawalRequest(BaseModel):
    """Enhanced withdrawal request model"""
    amount: float
    wallet_type: str  # cashback, profit
    payment_method: str  # phonepe, googlepay, paytm, bank
    
    # Payment details
    upi_id: Optional[str] = None
    phone_number: Optional[str] = None
    
    # Bank details
    account_holder_name: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None

class WithdrawalResponse(BaseModel):
    """Response model for withdrawal request"""
    withdrawal_id: str
    amount_requested: float
    withdrawal_fee: float
    amount_to_receive: float
    wallet_debited: float
    lien_amount: float
    message: str
