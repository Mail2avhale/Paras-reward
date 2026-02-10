"""
PARAS REWARD V2 - Enhanced Backend
Complete implementation with all new features
"""

from fastapi import FastAPI, APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
import uuid

# ========== ADDITIONAL MODELS FOR V2 ==========

class CartAddItem(BaseModel):
    product_id: str
    quantity: int = 1

class TicketCreate(BaseModel):
    subject: str
    category: str
    description: str
    priority: str = "medium"

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    admin_response: Optional[str] = None
    assigned_to: Optional[str] = None

class SettingsUpdate(BaseModel):
    mining_base_rate: Optional[float] = None
    delivery_charge_rate: Optional[float] = None
    delivery_split: Optional[Dict[str, float]] = None
    cashback_percentage: Optional[float] = None
    wallet_maintenance_fee: Optional[float] = None
    vip_membership_fee: Optional[float] = None

class WithdrawalCreate(BaseModel):
    wallet_type: str  # cashback, profit
    amount: float
    payment_mode: str  # upi, bank
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None

class WithdrawalAction(BaseModel):
    action: str  # approve, reject, complete
    utr_number: Optional[str] = None
    admin_notes: Optional[str] = None

# Export all models
__all__ = [
    'CartAddItem', 'TicketCreate', 'TicketUpdate',
    'SettingsUpdate', 'WithdrawalCreate', 'WithdrawalAction'
]
