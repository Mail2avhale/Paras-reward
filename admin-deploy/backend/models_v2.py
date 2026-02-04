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

class StockistCreate(BaseModel):\n    business_name: str\n    owner_full_name: str\n    business_type: str  # master, sub, outlet\n    contact_number: str\n    email: str\n    state: str\n    district: str\n    taluka: str\n    village: str\n    pincode: str\n    full_address: str\n    gst_number: Optional[str] = None\n    pan_number: str\n    aadhaar_number: str\n    udyog_aadhaar_base64: Optional[str] = None\n    gst_certificate_base64: Optional[str] = None\n\nclass CartAddItem(BaseModel):\n    product_id: str\n    quantity: int = 1\n\nclass TicketCreate(BaseModel):\n    subject: str\n    category: str\n    description: str\n    priority: str = \"medium\"\n\nclass TicketUpdate(BaseModel):\n    status: Optional[str] = None\n    admin_response: Optional[str] = None\n    assigned_to: Optional[str] = None\n\nclass SettingsUpdate(BaseModel):\n    mining_base_rate: Optional[float] = None\n    delivery_charge_rate: Optional[float] = None\n    delivery_split: Optional[Dict[str, float]] = None\n    cashback_percentage: Optional[float] = None\n    wallet_maintenance_fee: Optional[float] = None\n    vip_membership_fee: Optional[float] = None\n\nclass WithdrawalCreate(BaseModel):\n    wallet_type: str  # cashback, profit\n    amount: float\n    payment_mode: str  # upi, bank\n    upi_id: Optional[str] = None\n    bank_account: Optional[str] = None\n    ifsc_code: Optional[str] = None\n\nclass WithdrawalAction(BaseModel):\n    action: str  # approve, reject, complete\n    utr_number: Optional[str] = None\n    admin_notes: Optional[str] = None\n\n# Export all models\n__all__ = [\n    'StockistCreate', 'CartAddItem', 'TicketCreate', 'TicketUpdate',\n    'SettingsUpdate', 'WithdrawalCreate', 'WithdrawalAction'\n]\n