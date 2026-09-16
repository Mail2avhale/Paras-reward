"""
Redemption Daily Limit Routes (Sep 1 2026)

Frontend consumes GET /redemption-limit/status/{user_id} to render the
Dashboard "Daily Redemption Limit" card + the guard errors on
recharge / bank-redeem flows.

Deduction happens INSIDE recharge_utility and bank_redeem success
paths — never via this route directly. Read-only surface here.
"""

from fastapi import APIRouter, HTTPException
from app.services.redemption_limit_service import get_status

router = APIRouter(tags=["Redemption Limit"])
db = None


def set_db(motor_db):
    global db
    db = motor_db


@router.get("/redemption-limit/status/{user_id}")
async def redemption_limit_status(user_id: str):
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    return await get_status(db, user_id)
