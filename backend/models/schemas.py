"""
PARAS REWARD - Pydantic Schemas/Models
======================================
All request/response models for API endpoints
"""

from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid
import secrets
import string


# ==================== USER MODELS ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    uid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: Optional[str] = None
    name: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    profile_picture: Optional[str] = None
    role: str = "user"
    password_hash: Optional[str] = None
    reset_token: Optional[str] = None
    reset_token_expiry: Optional[datetime] = None
    
    # Address fields
    address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    tahsil: Optional[str] = None
    village: Optional[str] = None
    pincode: Optional[str] = None
    
    # Personal info
    birthday: Optional[str] = None
    
    # KYC fields
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    upi_id: Optional[str] = None
    
    # Subscription
    membership_type: str = "free"
    subscription_plan: str = "explorer"
    subscription_expiry: Optional[str] = None
    subscription_expired: Optional[bool] = None
    subscription_days_expired: Optional[int] = None
    subscription_expiry_message: Optional[str] = None
    membership_expiry: Optional[datetime] = None
    vip_expiry: Optional[str] = None
    vip_expired: Optional[bool] = None
    vip_days_expired: Optional[int] = None
    vip_expiry_message: Optional[str] = None
    
    # Wallets
    prc_balance: float = 0.0
    wallet_status: str = "active"
    
    # KYC Status
    kyc_status: str = "pending"
    
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


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    pincode: Optional[str] = None
    birthday: Optional[str] = None


class BalanceAdjustRequest(BaseModel):
    amount: float
    reason: str
    wallet_type: str = "prc"


# ==================== MINING MODELS ====================

class MiningStatus(BaseModel):
    current_balance: float
    mining_rate: float
    base_rate: float
    active_referrals: int
    total_mined: float


class MiningCollectRequest(BaseModel):
    amount: Optional[float] = None


class TapGamePlay(BaseModel):
    taps: int


# ==================== REFERRAL MODELS ====================

class ReferralInfo(BaseModel):
    referrer_uid: str
    referred_uid: str
    status: str = "active"
    date_joined: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== PAYMENT MODELS ====================

class VIPPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    date: str
    time: str
    utr_number: str
    screenshot_url: Optional[str] = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VIPPaymentCreate(BaseModel):
    amount: float
    date: str
    time: str
    utr_number: str
    screenshot_base64: Optional[str] = None


class VIPPaymentAction(BaseModel):
    action: str  # approve, reject


# ==================== KYC MODELS ====================

class KYCDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    kyc_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    aadhaar_front: Optional[str] = None
    aadhaar_back: Optional[str] = None
    pan_card: Optional[str] = None
    photo: Optional[str] = None
    status: str = "pending"
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None


class KYCSubmit(BaseModel):
    aadhaar_front_base64: Optional[str] = None
    aadhaar_back_base64: Optional[str] = None
    pan_card_base64: Optional[str] = None
    photo_base64: Optional[str] = None


# ==================== PRODUCT/ORDER MODELS ====================

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    prc_price: float
    actual_value: float
    image_url: Optional[str] = None
    category: str = "general"
    stock: int = 100
    is_active: bool = True
    min_vip_level: str = "free"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductCreate(BaseModel):
    name: str
    description: str
    prc_price: float
    actual_value: float
    image_base64: Optional[str] = None
    category: str = "general"
    stock: int = 100
    min_vip_level: str = "free"


class OrderSingleProduct(BaseModel):
    model_config = ConfigDict(extra="ignore")
    order_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    product_id: str
    product_name: str
    prc_price: float
    actual_value: float
    quantity: int = 1
    delivery_address: Optional[str] = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderCreate(BaseModel):
    product_id: str


class OrderVerify(BaseModel):
    otp: str


# ==================== DELIVERY MODELS ====================

class DeliveryPartner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    partner_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact: str
    email: str
    vehicle_type: str
    vehicle_number: str
    service_area: List[str]
    is_active: bool = True
    rating: float = 5.0
    total_deliveries: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DeliveryPartnerCreate(BaseModel):
    name: str
    contact: str
    email: str
    vehicle_type: str
    vehicle_number: str
    service_area: List[str]


# ==================== WALLET MODELS ====================

class WalletWithdrawal(BaseModel):
    withdrawal_id: str
    amount: float
    status: str
    created_at: datetime


# ==================== NOTIFICATION MODELS ====================

class Notification(BaseModel):
    notification_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    message: str
    type: str = "info"
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "info"
    user_ids: Optional[List[str]] = None


# ==================== ACTIVITY MODELS ====================

class ActivityLog(BaseModel):
    log_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    action: str
    details: Optional[Dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== BILL PAYMENT MODELS ====================

class BillPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    service_type: str
    provider: str
    consumer_number: str
    amount: float
    prc_amount: float
    status: str = "pending"
    transaction_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None


class BillPaymentRequestCreate(BaseModel):
    service_type: str
    provider: str
    consumer_number: str


class BillPaymentProcess(BaseModel):
    amount: float
    prc_amount: float


class GiftVoucherRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    voucher_type: str
    denomination: float
    prc_amount: float
    email: str
    mobile: Optional[str] = None
    status: str = "pending"
    voucher_code: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None


class GiftVoucherRequestCreate(BaseModel):
    voucher_type: str
    denomination: float
    email: str
    mobile: Optional[str] = None


class GiftVoucherProcess(BaseModel):
    voucher_code: str


# ==================== AUTH MODELS ====================

class ForgotPinRequest(BaseModel):
    identifier: str


class VerifyOTPRequest(BaseModel):
    identifier: str
    otp: str


class ResetPinRequest(BaseModel):
    identifier: str
    new_pin: str


class PasswordRecoveryVerifyRequest(BaseModel):
    identifier: str
    security_answer: str


class PasswordRecoveryResetRequest(BaseModel):
    identifier: str
    new_pin: str
    verification_token: str


# ==================== SUPPORT MODELS ====================

class SupportTicket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject: str
    description: str
    category: str = "general"
    priority: str = "medium"
    status: str = "open"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SupportTicketReply(BaseModel):
    reply_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str
    user_id: str
    message: str
    is_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TicketCreateRequest(BaseModel):
    subject: str
    description: str
    category: str = "general"
    priority: str = "medium"


class TicketReplyRequest(BaseModel):
    message: str


class TicketUpdateRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None


# ==================== LEADERBOARD MODELS ====================

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    name: str
    prc_balance: float
    profile_picture: Optional[str] = None


# ==================== SOCIAL MODELS ====================

class FollowRequest(BaseModel):
    target_user_id: str


class MessageRequest(BaseModel):
    recipient_id: str
    content: str


class ConversationMessage(BaseModel):
    sender_id: str
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== SETTINGS MODELS ====================

class SocialMediaSettings(BaseModel):
    whatsapp: Optional[str] = None
    telegram: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    twitter: Optional[str] = None
    youtube: Optional[str] = None


class ContactSubmission(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    subject: str
    message: str
