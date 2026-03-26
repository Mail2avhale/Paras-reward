"""
Redeem Category System - DEPRECATED
===================================
Category-wise redeem limits have been removed.
All redemption is now unlimited (subject to PRC balance).
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

router = APIRouter(prefix="", tags=["redeem-categories - DEPRECATED"])

DEPRECATION_MESSAGE = "Category-wise redeem limits have been removed. Redemption is now unlimited."

@router.get("/redeem/categories/{uid}")
async def get_user_categories_deprecated(uid: str):
    """DEPRECATED: Category limits removed"""
    return {
        "deprecated": True,
        "message": DEPRECATION_MESSAGE,
        "categories": {},
        "total_limit": 999999999,  # Unlimited
        "feature_removed": True,
        "unlimited": True
    }

@router.get("/redeem/category-usage/{uid}")
async def get_category_usage_deprecated(uid: str):
    """DEPRECATED: Category usage tracking removed"""
    return {
        "deprecated": True,
        "message": DEPRECATION_MESSAGE,
        "usage": {},
        "feature_removed": True
    }

@router.get("/redeem/limits/{uid}")
async def get_redeem_limits_deprecated(uid: str):
    """DEPRECATED: Redeem limits removed"""
    return {
        "deprecated": True,
        "message": DEPRECATION_MESSAGE,
        "total_limit": 999999999,
        "used": 0,
        "remaining": 999999999,
        "unlimited": True,
        "feature_removed": True
    }

@router.post("/admin/user-category-override")
async def set_category_override_deprecated():
    """DEPRECATED: Category override removed"""
    raise HTTPException(
        status_code=410,
        detail=DEPRECATION_MESSAGE
    )

# Keep basic functions for compatibility
async def get_category_settings():
    return {}

async def get_user_category_override(uid: str):
    return None

async def get_user_total_limit(user: dict) -> dict:
    return {
        "total_limit": 999999999,
        "unlimited": True,
        "deprecated": True
    }

async def check_category_limit(uid: str, category: str, amount: float) -> dict:
    """Always allow - limits removed"""
    return {
        "allowed": True,
        "unlimited": True,
        "deprecated": True
    }

async def record_category_usage(uid: str, category: str, amount: float, txn_id: str):
    """No-op - limits removed"""
    return True
