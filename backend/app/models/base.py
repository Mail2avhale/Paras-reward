"""
PARAS REWARD - Base Models
==========================
Pydantic models for request/response validation.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ==================== ENUMS ====================

class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    MANAGER = "manager"
    SUPER_ADMIN = "super_admin"


class SubscriptionTier(str, Enum):
    EXPLORER = "explorer"
    STARTER = "starter"
    GROWTH = "growth"
    ELITE = "elite"


class TransactionStatus(str, Enum):
    INITIATED = "initiated"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    REFUND_PENDING = "refund_pending"
    REFUNDED = "refunded"
    HOLD = "hold"


class TransactionType(str, Enum):
    CREDIT = "credit"
    DEBIT = "debit"
    TRANSFER = "transfer"
    MINING = "mining"
    REFERRAL = "referral"
    WITHDRAWAL = "withdrawal"
    REFUND = "refund"


class KYCStatus(str, Enum):
    NOT_SUBMITTED = "not_submitted"
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


# ==================== BASE MODELS ====================

class BaseResponse(BaseModel):
    """Standard API response format."""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


class PaginatedResponse(BaseModel):
    """Paginated list response."""
    success: bool
    data: List[Any]
    total: int
    page: int
    limit: int
    has_more: bool


class ErrorResponse(BaseModel):
    """Error response format."""
    success: bool = False
    error: str
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


# ==================== USER MODELS ====================

class UserBase(BaseModel):
    """Base user model."""
    name: str = Field(..., min_length=2, max_length=100)
    mobile: str = Field(..., min_length=10, max_length=10)
    email: Optional[str] = None


class UserCreate(UserBase):
    """User registration model."""
    password: str = Field(..., min_length=6)
    pin: str = Field(..., min_length=4, max_length=6)
    referral_code: Optional[str] = None
    
    @validator('mobile')
    def validate_mobile(cls, v):
        if not v.isdigit():
            raise ValueError('Mobile must contain only digits')
        return v
    
    @validator('pin')
    def validate_pin(cls, v):
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        return v


class UserLogin(BaseModel):
    """User login model."""
    mobile: str
    password: str


class UserProfile(BaseModel):
    """User profile response."""
    uid: str
    name: str
    mobile: str
    email: Optional[str]
    role: UserRole
    subscription_tier: SubscriptionTier
    subscription_expires: Optional[datetime]
    prc_balance: float
    kyc_status: KYCStatus
    referral_code: str
    created_at: datetime


# ==================== WALLET MODELS ====================

class WalletBalance(BaseModel):
    """Wallet balance response."""
    prc_balance: float
    inr_equivalent: float
    prc_rate: int
    frozen_balance: float = 0
    available_balance: float


class WalletTransaction(BaseModel):
    """Single wallet transaction."""
    txn_id: str
    type: TransactionType
    amount: float
    balance_before: float
    balance_after: float
    description: str
    reference: Optional[str]
    created_at: datetime


# ==================== WITHDRAWAL MODELS ====================

class WithdrawalRequest(BaseModel):
    """Bank withdrawal request."""
    amount_inr: float = Field(..., ge=500)
    account_holder_name: str = Field(..., min_length=3)
    account_number: str = Field(..., min_length=9, max_length=18)
    ifsc_code: str = Field(..., pattern=r'^[A-Z]{4}0[A-Z0-9]{6}$')
    bank_name: str
    
    @validator('account_number')
    def validate_account(cls, v):
        if not v.isdigit():
            raise ValueError('Account number must contain only digits')
        return v
    
    @validator('ifsc_code')
    def validate_ifsc(cls, v):
        return v.upper()


class WithdrawalResponse(BaseModel):
    """Withdrawal response."""
    request_id: str
    status: TransactionStatus
    amount_inr: float
    prc_deducted: float
    fees: float
    net_amount: float
    message: str
