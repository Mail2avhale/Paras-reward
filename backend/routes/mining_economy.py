"""
Mining Economy - DEPRECATED
===========================
Mining economy calculations have been removed.
"""

from datetime import datetime, timezone

# DEPRECATED - All values set to 0
HOURLY_BASE_RATE = 0
DAILY_BASE_RATE = 0
MONTHLY_TARGET = 0

def calculate_mining_rate(*args, **kwargs):
    """DEPRECATED: Returns 0"""
    return 0

def get_boost_multiplier(*args, **kwargs):
    """DEPRECATED: Returns 1.0 (no boost)"""
    return 1.0

async def calculate_user_mining_rate(*args, **kwargs):
    """DEPRECATED: Returns empty breakdown"""
    return {
        "deprecated": True,
        "message": "Mining feature has been removed",
        "base_rate": 0,
        "boost_multiplier": 1.0,
        "final_rate": 0,
        "feature_removed": True
    }
