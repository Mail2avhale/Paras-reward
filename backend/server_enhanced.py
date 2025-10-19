from fastapi import FastAPI, APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import json

# Import models
from models import (
    User, UserProfileUpdate, Stockist, Product, Cart, CartItem, Order, OrderItem,
    WithdrawalRequest, CommissionEntry, SupportTicket, TicketResponse, SystemSettings
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app
app = FastAPI(title="PARAS REWARD API V2", version="2.0.0")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========== HELPER FUNCTIONS ==========
async def get_settings():
    """Get system settings"""
    settings = await db.settings.find_one({})
    if not settings:
        # Create default settings
        default_settings = SystemSettings().model_dump()
        default_settings["updated_at"] = default_settings["updated_at"].isoformat()
        await db.settings.insert_one(default_settings)
        return default_settings
    return settings

async def get_base_rate():
    """Calculate dynamic base rate"""
    settings = await get_settings()
    base_rate_start = settings.get("mining_base_rate", 50)
    decrease_per = settings.get("mining_decrease_per_users", 100)
    min_rate = settings.get("mining_base_rate_min", 10)
    
    total_users = await db.users.count_documents({})
    base_rate = base_rate_start - (total_users // decrease_per)
    return max(base_rate, min_rate)

async def get_active_referrals(uid: str):
    """Count active referrals (logged in within 24 hours)"""
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    yesterday_iso = yesterday.isoformat()
    
    active_count = await db.users.count_documents({
        "referred_by": uid,
        "last_login": {"$gte": yesterday_iso},
        "is_active": True
    })
    
    settings = await get_settings()
    max_refs = settings.get("max_referrals", 200)
    return min(active_count, max_refs)

async def calculate_mining_rate(uid: str):
    """Calculate mining rate per minute with referral bonus"""
    base_rate = await get_base_rate()
    active_referrals = await get_active_referrals(uid)
    current_date = datetime.now(timezone.utc).day
    
    settings = await get_settings()
    referral_bonus_pct = settings.get("referral_bonus_percentage", 0.10)
    
    # Referral contribution
    referral_bonus = active_referrals * referral_bonus_pct * base_rate * current_date
    
    # Total daily rate
    total_daily_rate = (current_date * base_rate) + referral_bonus
    
    # Per minute rate
    per_minute_rate = total_daily_rate / 1440
    return per_minute_rate, base_rate, active_referrals

async def check_unique_fields(field_name: str, value: str, exclude_uid: Optional[str] = None):
    """Check if field value is unique"""
    if not value:
        return True
    
    query = {field_name: value}
    if exclude_uid:
        query["uid"] = {"$ne": exclude_uid}
    
    existing = await db.users.find_one(query)
    if existing:
        # Also check in stockists
        existing_stockist = await db.stockists.find_one({field_name: value})
        return existing_stockist is None
    return True

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

async def update_mined_coins(uid: str):
    """Update user's mined coins based on time elapsed"""
    user = await db.users.find_one({"uid": uid})
    if not user or not user.get("mining_active") or not user.get("mining_start_time"):
        return 0
    
    mining_start = datetime.fromisoformat(user["mining_start_time"])
    current_time = datetime.now(timezone.utc)
    elapsed_minutes = (current_time - mining_start).total_seconds() / 60
    
    # Check if 24 hour session expired
    session_start = datetime.fromisoformat(user.get("mining_session_start", user["mining_start_time"]))
    if (current_time - session_start).total_seconds() > 86400:  # 24 hours
        # Session expired, stop mining
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"mining_active": False}}
        )
        return 0
    
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

# Continue in next file due to size...
