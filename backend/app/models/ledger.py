"""
PARAS REWARD - Ledger Models
============================
Double-entry accounting ledger models.
Every financial transaction MUST have a ledger entry.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class LedgerAccountType(str, Enum):
    """Types of ledger accounts."""
    USER_WALLET = "user_wallet"           # User's PRC wallet
    PLATFORM_POOL = "platform_pool"       # Platform's main pool
    WITHDRAWAL_POOL = "withdrawal_pool"   # Pending withdrawals
    MINING_POOL = "mining_pool"           # Mining rewards pool
    REFERRAL_POOL = "referral_pool"       # Referral rewards pool
    SUBSCRIPTION_REVENUE = "subscription_revenue"  # Subscription income
    FEE_REVENUE = "fee_revenue"           # Transaction fees
    SETTLEMENT_ACCOUNT = "settlement_account"  # Bank settlements


class LedgerEntryType(str, Enum):
    """Types of ledger entries."""
    DEBIT = "debit"
    CREDIT = "credit"


class LedgerEntry(BaseModel):
    """
    Single ledger entry.
    Every transaction creates 2 entries (double-entry accounting):
    - One DEBIT entry
    - One CREDIT entry
    Total DEBITs must always equal total CREDITs.
    """
    entry_id: str = Field(default_factory=lambda: f"LED-{uuid.uuid4().hex[:12].upper()}")
    
    # Transaction reference
    txn_id: str                          # Parent transaction ID
    txn_type: str                        # withdrawal, mining, referral, etc.
    
    # Account details
    account_type: LedgerAccountType
    account_id: str                      # User ID or pool name
    
    # Entry details
    entry_type: LedgerEntryType          # debit or credit
    amount: float = Field(..., gt=0)
    
    # Balance tracking
    balance_before: float
    balance_after: float
    
    # Metadata
    description: str
    reference: Optional[str] = None      # UTR, bank ref, etc.
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    
    class Config:
        use_enum_values = True


class LedgerTransaction(BaseModel):
    """
    Complete ledger transaction with both entries.
    Ensures double-entry accounting rules are followed.
    """
    txn_id: str = Field(default_factory=lambda: f"TXN-{uuid.uuid4().hex[:12].upper()}")
    txn_type: str
    
    # The two entries
    debit_entry: LedgerEntry
    credit_entry: LedgerEntry
    
    # Verification
    amount: float
    is_balanced: bool = True  # debit amount == credit amount
    
    # Metadata
    description: str
    initiated_by: str        # user_id or "system"
    
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    
    def validate_balance(self) -> bool:
        """Ensure debit equals credit."""
        return self.debit_entry.amount == self.credit_entry.amount


class LedgerSummary(BaseModel):
    """Summary of an account's ledger."""
    account_type: LedgerAccountType
    account_id: str
    
    total_debits: float
    total_credits: float
    current_balance: float
    
    transaction_count: int
    last_transaction_at: Optional[datetime]


# ==================== HELPER FUNCTIONS ====================

def create_withdrawal_ledger_entries(
    user_id: str,
    txn_id: str,
    amount: float,
    user_balance_before: float,
    description: str = "PRC Withdrawal"
) -> tuple:
    """
    Create ledger entries for withdrawal.
    
    User Wallet: DEBIT (decrease)
    Withdrawal Pool: CREDIT (increase)
    """
    debit_entry = LedgerEntry(
        txn_id=txn_id,
        txn_type="withdrawal",
        account_type=LedgerAccountType.USER_WALLET,
        account_id=user_id,
        entry_type=LedgerEntryType.DEBIT,
        amount=amount,
        balance_before=user_balance_before,
        balance_after=user_balance_before - amount,
        description=f"{description} - Debit"
    )
    
    credit_entry = LedgerEntry(
        txn_id=txn_id,
        txn_type="withdrawal",
        account_type=LedgerAccountType.WITHDRAWAL_POOL,
        account_id="withdrawal_pool",
        entry_type=LedgerEntryType.CREDIT,
        amount=amount,
        balance_before=0,  # Pool balance tracked separately
        balance_after=amount,
        description=f"{description} - Credit"
    )
    
    return debit_entry, credit_entry


def create_mining_ledger_entries(
    user_id: str,
    txn_id: str,
    amount: float,
    user_balance_before: float,
    description: str = "Mining Reward"
) -> tuple:
    """
    Create ledger entries for mining reward.
    
    Mining Pool: DEBIT (decrease)
    User Wallet: CREDIT (increase)
    """
    debit_entry = LedgerEntry(
        txn_id=txn_id,
        txn_type="mining",
        account_type=LedgerAccountType.MINING_POOL,
        account_id="mining_pool",
        entry_type=LedgerEntryType.DEBIT,
        amount=amount,
        balance_before=0,
        balance_after=0,
        description=f"{description} - Pool Debit"
    )
    
    credit_entry = LedgerEntry(
        txn_id=txn_id,
        txn_type="mining",
        account_type=LedgerAccountType.USER_WALLET,
        account_id=user_id,
        entry_type=LedgerEntryType.CREDIT,
        amount=amount,
        balance_before=user_balance_before,
        balance_after=user_balance_before + amount,
        description=f"{description} - User Credit"
    )
    
    return debit_entry, credit_entry
