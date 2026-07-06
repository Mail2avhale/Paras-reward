"""
Admin — Bank Redeem Limits Config (Feb 2026)
============================================
Stores the platform-wide bank redeem limits in `admin_settings` doc
`_id="bank_redeem_limits"`. Admin can adjust these via the AdminSystemSettings
UI without a code deploy.

Fields:
  • min_withdrawal_inr      — per-transaction minimum (default ₹100)
  • max_withdrawal_inr      — per-transaction maximum (default ₹10,000)
  • monthly_user_cap_inr    — max redeem per user per calendar month (default ₹25,000; 0 = disabled)

Rest of the redeem stack (`manual_bank_transfer.py`) reads via
`get_bank_redeem_config()` — falls back to the hardcoded constants if
DB read fails.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/bank-redeem-limits", tags=["Admin Bank Redeem Limits"])

db = None

# Hard defaults — used when admin_settings doc is missing / DB read fails.
DEFAULT_MIN_INR = 100
DEFAULT_MAX_INR = 10000
DEFAULT_MONTHLY_CAP_INR = 25000  # 0 = disabled

CONFIG_DOC_ID = "bank_redeem_limits"


def set_db(database) -> None:
    global db
    db = database


async def get_bank_redeem_config() -> dict:
    """Read the current bank redeem limits config from admin_settings.
    Returns hardcoded defaults on missing doc / any error.
    """
    if db is None:
        return {
            "min_withdrawal_inr": DEFAULT_MIN_INR,
            "max_withdrawal_inr": DEFAULT_MAX_INR,
            "monthly_user_cap_inr": DEFAULT_MONTHLY_CAP_INR,
            "source": "hardcoded_default",
        }
    try:
        doc = await db.admin_settings.find_one({"_id": CONFIG_DOC_ID}, {"_id": 0})
        if not doc:
            return {
                "min_withdrawal_inr": DEFAULT_MIN_INR,
                "max_withdrawal_inr": DEFAULT_MAX_INR,
                "monthly_user_cap_inr": DEFAULT_MONTHLY_CAP_INR,
                "source": "hardcoded_default",
            }
        return {
            "min_withdrawal_inr": int(doc.get("min_withdrawal_inr", DEFAULT_MIN_INR)),
            "max_withdrawal_inr": int(doc.get("max_withdrawal_inr", DEFAULT_MAX_INR)),
            "monthly_user_cap_inr": int(doc.get("monthly_user_cap_inr", DEFAULT_MONTHLY_CAP_INR)),
            "updated_at": doc.get("updated_at"),
            "updated_by": doc.get("updated_by"),
            "source": "admin_settings",
        }
    except Exception as e:
        logger.warning(f"[BANK-REDEEM-CFG] Read failed, using defaults: {e}")
        return {
            "min_withdrawal_inr": DEFAULT_MIN_INR,
            "max_withdrawal_inr": DEFAULT_MAX_INR,
            "monthly_user_cap_inr": DEFAULT_MONTHLY_CAP_INR,
            "source": "hardcoded_default",
        }


async def get_user_monthly_bank_redeem_total(user_id: str) -> int:
    """Sum of user's approved/paid bank redeems in the current calendar month
    (UTC). Used to enforce the monthly_user_cap_inr limit. Fees are excluded —
    only the `withdrawal_amount` (INR credited to the user) counts.
    """
    if db is None:
        return 0
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    try:
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "status": {"$in": ["approved", "paid", "completed"]},
                "$or": [
                    {"created_at": {"$gte": month_start}},
                    {"approved_at": {"$gte": month_start}},
                    {"paid_at": {"$gte": month_start}},
                ],
            }},
            {"$group": {"_id": None, "total": {"$sum": "$withdrawal_amount"}}},
        ]
        rows = await db.bank_transfer_requests.aggregate(pipeline).to_list(1)
        return int(rows[0]["total"]) if rows else 0
    except Exception as e:
        logger.warning(f"[BANK-REDEEM-CFG] monthly-total query failed for {user_id}: {e}")
        return 0


# ==================== PYDANTIC MODELS ====================
class UpdateConfigRequest(BaseModel):
    min_withdrawal_inr: Optional[int] = Field(None, ge=1, le=1_000_000)
    max_withdrawal_inr: Optional[int] = Field(None, ge=1, le=10_000_000)
    monthly_user_cap_inr: Optional[int] = Field(None, ge=0, le=100_000_000)
    admin_id: str


# ==================== ENDPOINTS ====================
@router.get("/config")
async def get_config():
    """Read current bank redeem limits config. Any authenticated admin can call.
    Actual auth is enforced by upstream middleware — we don't add another PIN
    gate here so the AdminSystemSettings UI can render without extra prompts.
    """
    cfg = await get_bank_redeem_config()
    return {"success": True, **cfg}


@router.patch("/config")
async def update_config(body: UpdateConfigRequest, x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    """Update bank redeem limits config. Requires ADMIN_OPERATION_PIN header.

    Any subset of fields can be updated in one call. Validates ordering:
    min ≤ max, and monthly_cap ≥ min (else the cap would block all requests).
    """
    import os
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")

    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    current = await get_bank_redeem_config()
    new_min = body.min_withdrawal_inr if body.min_withdrawal_inr is not None else current["min_withdrawal_inr"]
    new_max = body.max_withdrawal_inr if body.max_withdrawal_inr is not None else current["max_withdrawal_inr"]
    new_monthly = body.monthly_user_cap_inr if body.monthly_user_cap_inr is not None else current["monthly_user_cap_inr"]

    if new_min > new_max:
        raise HTTPException(
            status_code=400,
            detail=f"min_withdrawal_inr (₹{new_min:,}) must be ≤ max_withdrawal_inr (₹{new_max:,})."
        )
    if new_monthly and new_monthly < new_min:
        raise HTTPException(
            status_code=400,
            detail=(
                f"monthly_user_cap_inr (₹{new_monthly:,}) must be ≥ "
                f"min_withdrawal_inr (₹{new_min:,}), else all requests are blocked. "
                "Set to 0 to disable monthly cap."
            )
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.admin_settings.update_one(
        {"_id": CONFIG_DOC_ID},
        {"$set": {
            "min_withdrawal_inr": new_min,
            "max_withdrawal_inr": new_max,
            "monthly_user_cap_inr": new_monthly,
            "updated_at": now_iso,
            "updated_by": body.admin_id,
        }},
        upsert=True,
    )
    return {
        "success": True,
        "min_withdrawal_inr": new_min,
        "max_withdrawal_inr": new_max,
        "monthly_user_cap_inr": new_monthly,
        "updated_at": now_iso,
        "updated_by": body.admin_id,
        "message": "Bank redeem limits updated.",
    }
