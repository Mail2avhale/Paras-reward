from fastapi import APIRouter, HTTPException
import logging

try:
    from server import get_user_friendly_error
except Exception:
    def get_user_friendly_error(error):
        return str(error)

router = APIRouter(prefix="/admin/prc-economy", tags=["Admin PRC Economy"])

db = None

def set_db(database):
    global db
    db = database

@router.get("/dashboard")
async def get_prc_economy_dashboard():
    """
    Get comprehensive PRC economy dashboard with all metrics.
    Implements PARAS REWARD TOKEN ECONOMY CONTROL SYSTEM.
    
    Includes:
    - Dynamic PRC rate (5 factors)
    - Redeem pressure monitoring
    - Whale wallet protection
    - Emergency status
    - System stability index
    """
    try:
        from routes.prc_economy import get_economy_dashboard
        return await get_economy_dashboard(db)
    except ImportError:
        return {"error": "PRC Economy module not found", "success": False}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Dashboard error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.get("/rate")
async def get_admin_prc_economy_rate():
    """
    Admin API: Get current dynamic PRC rate calculated using 5 ecosystem factors:
    - Supply Factor
    - Redeem Demand Factor  
    - Burn Factor
    - Active User Factor
    - Utility Usage Factor
    
    Rate is clamped between 6-20 PRC per ₹1 (safety limits).
    """
    try:
        from routes.prc_economy import calculate_dynamic_prc_rate
        return await calculate_dynamic_prc_rate(db)
    except ImportError:
        return {"error": "PRC Economy module not found", "final_rate": 10}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Rate calculation error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.get("/redeem-pressure")
async def get_prc_redeem_pressure():
    """
    Monitor redeem pressure.
    
    RedeemPressure = TotalPRCRedeemedToday / ActiveUsers
    Safe Threshold = 0.15 (15%)
    
    Returns status: normal, high, critical
    """
    try:
        from routes.prc_economy import get_redeem_pressure
        return await get_redeem_pressure(db)
    except ImportError:
        return {"error": "PRC Economy module not found", "status": "unknown"}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Redeem pressure error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.get("/stability")
async def get_prc_stability_index():
    """
    Calculate ecosystem stability score (0-100).
    
    Components:
    - Burn activity contribution
    - User activity contribution
    - Utility usage contribution
    - Redeem pressure penalty
    - Emergency penalty
    
    Score interpretation:
    - > 80: Excellent
    - 60-80: Good
    - 40-60: Moderate
    - < 40: Poor - action needed
    """
    try:
        from routes.prc_economy import calculate_stability_index
        return await calculate_stability_index(db)
    except ImportError:
        return {"error": "PRC Economy module not found", "stability_score": 50}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Stability index error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.get("/emergency-check")
async def check_prc_emergency():
    """
    Check if emergency protection mode should be activated.
    
    Trigger: Redeem requests spike > 200% compared to 30-day average
    
    If triggered:
    - Pause redeem for 24 hours
    - Notify admin
    - Investigate unusual activity
    """
    try:
        from routes.prc_economy import check_emergency_conditions
        return await check_emergency_conditions(db)
    except ImportError:
        return {"error": "PRC Economy module not found", "is_emergency": False}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Emergency check error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.get("/whale-wallets")
async def get_prc_whale_wallets():
    """
    Get whale wallets (balance > 500,000 PRC).
    
    Whale wallets have 2% burn rate (double the normal 1%).
    """
    try:
        from routes.prc_economy import get_whale_wallets, WHALE_THRESHOLD, WHALE_BURN_RATE
        whales = await get_whale_wallets(db, limit=100)
        return {
            "success": True,
            "whale_threshold": WHALE_THRESHOLD,
            "whale_burn_rate": WHALE_BURN_RATE,
            "total_whales": len(whales),
            "whales": whales
        }
    except ImportError:
        return {"error": "PRC Economy module not found", "whales": []}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Whale wallets error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))



@router.get("/pause-status")
async def get_emergency_pause_status_api():
    """
    Get current emergency pause status.
    
    Returns whether redeem is paused, when it was paused, and when it will auto-resume.
    """
    try:
        from routes.prc_economy import get_emergency_pause_status
        return await get_emergency_pause_status(db)
    except ImportError:
        return {"error": "PRC Economy module not found", "is_paused": False}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Pause status error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/pause")
async def activate_emergency_pause_api(reason: str = "Manual admin pause"):
    """
    Manually activate emergency redeem pause.
    
    Args:
        reason: Reason for pausing
    
    This will pause all redeem requests for 24 hours.
    """
    try:
        from routes.prc_economy import activate_emergency_pause
        return await activate_emergency_pause(db, reason=reason, triggered_by="admin")
    except ImportError:
        return {"error": "PRC Economy module not found", "success": False}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Manual pause error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/resume")
async def deactivate_emergency_pause_api():
    """
    Manually resume redeems (deactivate emergency pause).
    
    Admin can use this to resume redeems before the 24-hour auto-resume.
    """
    try:
        from routes.prc_economy import deactivate_emergency_pause
        return await deactivate_emergency_pause(db, deactivated_by="admin")
    except ImportError:
        return {"error": "PRC Economy module not found", "success": False}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Manual resume error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))


@router.post("/check-and-pause")
async def trigger_emergency_check_api():
    """
    Manually trigger emergency check (usually runs every 5 minutes automatically).
    
    This will check current redeem activity and auto-pause if spike > 200%.
    """
    try:
        from routes.prc_economy import check_and_auto_pause
        return await check_and_auto_pause(db)
    except ImportError:
        return {"error": "PRC Economy module not found", "action": "error"}
    except Exception as e:
        logging.error(f"[PRC ECONOMY] Manual check error: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))
