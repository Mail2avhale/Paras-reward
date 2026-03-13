"""
PARAS REWARD - Core Configuration
=================================
Centralized configuration for the entire application.
All environment variables and settings are managed here.

Usage:
    from app.core.config import settings
    print(settings.MONGO_URL)
"""

import os
from typing import Optional
from dataclasses import dataclass


@dataclass
class Settings:
    """
    Application settings loaded from environment variables.
    All sensitive data comes from .env file.
    """
    
    # ==================== DATABASE ====================
    MONGO_URL: str = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME: str = os.environ.get("DB_NAME", "paras_reward_db")
    
    # ==================== SECURITY ====================
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "change-this-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24 * 30  # 30 days
    
    # ==================== RAZORPAY ====================
    RAZORPAY_KEY_ID: str = os.environ.get("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.environ.get("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
    
    # ==================== CORS ====================
    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")
    
    # ==================== PRC ECONOMY ====================
    DEFAULT_PRC_RATE: int = 100  # 100 PRC = ₹1
    MIN_WITHDRAWAL_INR: int = 500
    
    # ==================== SUBSCRIPTION PLANS ====================
    SUBSCRIPTION_DURATION_DAYS: int = 28
    
    # ==================== CACHE ====================
    CACHE_ENV_PREFIX: str = os.environ.get("CACHE_ENV_PREFIX", "prod")


# Singleton instance
settings = Settings()


# ==================== SUBSCRIPTION PLAN CONFIG ====================
SUBSCRIPTION_PLANS = {
    "explorer": {
        "name": "Explorer",
        "price": 0,
        "duration_days": 0,
        "features": ["Basic access", "Limited mining"],
        "prc_multiplier": 1.0,
        "daily_mining_limit": 100
    },
    "starter": {
        "name": "Starter", 
        "price": 149,
        "duration_days": 28,
        "features": ["Full mining", "Basic rewards"],
        "prc_multiplier": 1.0,
        "daily_mining_limit": 500
    },
    "growth": {
        "name": "Growth",
        "price": 499,
        "duration_days": 28,
        "features": ["Enhanced mining", "Priority support"],
        "prc_multiplier": 1.5,
        "daily_mining_limit": 1000
    },
    "elite": {
        "name": "Elite",
        "price": 999,
        "duration_days": 28,
        "features": ["Maximum mining", "VIP support", "Exclusive rewards"],
        "prc_multiplier": 2.0,
        "daily_mining_limit": 2000
    }
}


# ==================== SERVICE LIMITS ====================
SERVICE_LIMITS = {
    "mobile_recharge": {"explorer": 0, "starter": 2, "growth": 5, "elite": 10},
    "dth_recharge": {"explorer": 0, "starter": 1, "growth": 3, "elite": 5},
    "electricity": {"explorer": 0, "starter": 1, "growth": 2, "elite": 5},
    "bank_withdrawal": {"explorer": 0, "starter": 1, "growth": 2, "elite": 3}
}
