"""
Referral Routes
================
Only the referral-code LOOKUP endpoint remains. All other legacy referral
endpoints (stats, list, network, bonus, apply, code) were removed during the
June 2026 referral cleanup. The current canonical referral data sources are:
  - /api/notifications/referrals/{uid}/direct-list
  - /api/notifications/referrals/{uid}/level-breakdown (L1-L5 cascade)
  - /api/mining/rate-breakdown/{uid} (cap formula + tier breakdown)
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/referral", tags=["Referral"])

db = None
cache = None


def set_db(database):
    global db
    db = database


def set_cache(cache_instance):
    global cache
    cache = cache_instance


@router.get("/lookup/{code}")
async def lookup_referral_code(code: str):
    """Validate referral code and return referrer name for registration"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")

    code = code.strip().upper()
    if not code:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    referrer = await db.users.find_one(
        {"referral_code": code},
        {"_id": 0, "name": 1, "referral_code": 1}
    )
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    return {
        "valid": True,
        "referrer_name": referrer.get("name", ""),
        "referral_code": referrer.get("referral_code", code)
    }
