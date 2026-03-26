"""
Mining Routes - DEPRECATED
===========================
All mining features have been removed.
These endpoints return deprecation notices.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/mining", tags=["Mining - DEPRECATED"])

# Module-level variables (kept for compatibility)
db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

def set_helpers(helpers: dict):
    pass  # No longer needed

DEPRECATION_MESSAGE = "Mining feature has been removed. Please contact support for more information."

@router.get("/status/{uid}")
async def get_mining_status_deprecated(uid: str):
    """DEPRECATED: Mining feature removed"""
    return {
        "deprecated": True,
        "message": DEPRECATION_MESSAGE,
        "mining_active": False,
        "mined_coins": 0,
        "mining_rate": 0,
        "can_start": False,
        "feature_removed": True
    }

@router.post("/start/{uid}")
async def start_mining_deprecated(uid: str):
    """DEPRECATED: Mining feature removed"""
    raise HTTPException(
        status_code=410,
        detail=DEPRECATION_MESSAGE
    )

@router.post("/claim/{uid}")
async def claim_mining_deprecated(uid: str):
    """DEPRECATED: Mining feature removed"""
    raise HTTPException(
        status_code=410,
        detail=DEPRECATION_MESSAGE
    )

@router.post("/collect/{uid}")
async def collect_mining_deprecated(uid: str):
    """DEPRECATED: Mining feature removed"""
    raise HTTPException(
        status_code=410,
        detail=DEPRECATION_MESSAGE
    )

@router.get("/rate-breakdown/{uid}")
async def get_rate_breakdown_deprecated(uid: str):
    """DEPRECATED: Mining feature removed"""
    return {
        "deprecated": True,
        "message": DEPRECATION_MESSAGE,
        "base_rate": 0,
        "boost_multiplier": 1.0,
        "final_rate": 0,
        "feature_removed": True
    }

@router.get("/history/{uid}")
async def get_mining_history_deprecated(uid: str):
    """DEPRECATED: Mining feature removed"""
    return {
        "deprecated": True,
        "message": DEPRECATION_MESSAGE,
        "history": [],
        "feature_removed": True
    }
