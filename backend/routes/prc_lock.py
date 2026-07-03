"""
PRC Lock-In Vault — 25k threshold lock (Jun 9, 2026)
=====================================================

Owner request:
  • Users with `prc_balance > 25,000` get the EXCESS over 25k locked for
    365 days. Existing pending bank-redeems for these users are
    cancelled + refunded BEFORE applying the lock (so the user's true
    equity is captured).
  • From today, any new PRC mined / earned is fully AVAILABLE.
  • One-time admin click triggers the lock — no recurring re-lock for
    future ₹25k+ holders.
  • After 365 days, a daily cron auto-unlocks (prc_locked → 0).
  • Admin can manually unlock X% of any user's locked PRC.

Schema additions on `users` documents:
  prc_locked          : float  (current locked amount, mutable)
  prc_locked_initial  : float  (snapshot at lock time, immutable)
  prc_locked_at       : ISO str
  prc_unlock_at       : ISO str (lock_at + 365 days)
  prc_locked_reason   : str    ("system_lock_25k_2026")

Available PRC = max(0, prc_balance - prc_locked)
"""
import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

router = APIRouter(prefix="/admin/prc-lock", tags=["PRC Lock"])
user_router = APIRouter(prefix="/prc-lock", tags=["PRC Lock — User"])

# --- IDOR-safe auth dependency (Jul 2026) ---
_security = HTTPBearer(auto_error=False)


async def _require_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    from server import get_current_user as _real_dep
    return await _real_dep(credentials)

_mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _mongo[os.environ["DB_NAME"]]

THRESHOLD = 25_000          # ₹25k PRC threshold
LOCK_DAYS = 365             # 1 year lock
REASON = "system_lock_25k_2026"

ADMIN_PIN_HASH = os.environ.get("ADMIN_FORCE_PIN_HASH", "")
ADMIN_PIN_PLAIN = "153759"  # fallback for owner-only ops


def _verify_admin_pin(pin: str) -> bool:
    if not pin:
        return False
    if ADMIN_PIN_HASH:
        try:
            return bcrypt.checkpw(pin.encode(), ADMIN_PIN_HASH.encode())
        except Exception:
            pass
    return pin == ADMIN_PIN_PLAIN


def get_available_prc(user: dict) -> float:
    """Available = balance − locked. Use everywhere instead of raw prc_balance."""
    balance = float(user.get("prc_balance", 0) or 0)
    locked = float(user.get("prc_locked", 0) or 0)
    return max(0.0, balance - locked)


# ============================================================================
# ADMIN — Execute the 25k Lock (one-time owner click)
# ============================================================================
class ExecuteLockRequest(BaseModel):
    pin: str
    admin_id: str = "admin"
    max_users: int = Field(default=500, description="Process chunk size per call")


@router.post("/execute-25k-lock")
async def execute_25k_lock(body: ExecuteLockRequest):
    """Lock excess-over-25k PRC for all eligible users. Chunked + resumable.

    Idempotent — already-locked users are skipped. Returns more_to_do=True
    so the frontend can auto-loop until all eligible users are processed.
    """
    if not _verify_admin_pin(body.pin):
        raise HTTPException(status_code=401, detail="Invalid admin PIN")

    now = datetime.now(timezone.utc)
    unlock_at = (now + timedelta(days=LOCK_DAYS)).isoformat()
    now_iso = now.isoformat()

    # Find next batch of eligible users (balance > 25k AND not already locked)
    candidates = await db.users.find(
        {
            "prc_balance": {"$gt": THRESHOLD},
            "$or": [
                {"prc_locked": {"$exists": False}},
                {"prc_locked": None},
                {"prc_locked": 0},
            ],
            "role": {"$nin": ["admin", "staff", "manager"]},
        },
        {"_id": 0, "uid": 1, "prc_balance": 1, "name": 1}
    ).max_time_ms(45_000).batch_size(500).limit(body.max_users).to_list(length=body.max_users)

    if not candidates:
        return {
            "success": True,
            "processed_this_call": 0,
            "more_to_do": False,
            "remaining_estimate": 0,
            "users_locked": 0,
            "total_prc_locked": 0,
            "pending_redeems_refunded": 0,
        }

    users_locked = 0
    total_prc_locked = 0.0
    pending_redeems_refunded_count = 0
    pending_prc_refunded = 0.0
    errors = []

    for u in candidates:
        uid = u["uid"]
        try:
            # ===== STEP 1: Cancel + refund pending bank-redeems FIRST =====
            pendings = await db.bank_transfer_requests.find(
                {"user_id": uid, "status": "pending"},
                {"_id": 0, "request_id": 1, "prc_deducted": 1, "amount_inr": 1}
            ).to_list(50)

            refund_for_this_user = 0.0
            for pending in pendings:
                refund_prc = float(pending.get("prc_deducted", 0) or 0)
                if refund_prc > 0:
                    await db.users.update_one(
                        {"uid": uid},
                        {"$inc": {"prc_balance": refund_prc}}
                    )
                    refund_for_this_user += refund_prc
                await db.bank_transfer_requests.update_one(
                    {"request_id": pending["request_id"]},
                    {"$set": {
                        "status": "failed",
                        "admin_remark": "Auto-cancelled before 25k PRC lock-in",
                        "failed_at": now_iso,
                        "auto_cancelled_by_lock": True,
                    }}
                )
                pending_redeems_refunded_count += 1

            pending_prc_refunded += refund_for_this_user

            # ===== STEP 2: Re-read fresh balance after refunds & compute excess =====
            fresh = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1})
            fresh_balance = float(fresh.get("prc_balance", 0) or 0)
            if fresh_balance <= THRESHOLD:
                # After refund still <= 25k? skip locking (edge case)
                continue

            excess = fresh_balance - THRESHOLD

            # ===== STEP 3: Apply lock atomically =====
            result = await db.users.update_one(
                {
                    "uid": uid,
                    # double-check still no lock active (race guard)
                    "$or": [
                        {"prc_locked": {"$exists": False}},
                        {"prc_locked": None},
                        {"prc_locked": 0},
                    ],
                },
                {"$set": {
                    "prc_locked": excess,
                    "prc_locked_initial": excess,
                    "prc_locked_at": now_iso,
                    "prc_unlock_at": unlock_at,
                    "prc_locked_reason": REASON,
                }}
            )
            if result.modified_count > 0:
                users_locked += 1
                total_prc_locked += excess
        except Exception as e:
            err = f"uid={uid}: {str(e)[:120]}"
            logging.warning(f"[PRC-LOCK] {err}")
            errors.append(err)

    # Estimate remaining (cheap count_documents capped at 60s)
    try:
        remaining_estimate = await db.users.count_documents(
            {
                "prc_balance": {"$gt": THRESHOLD},
                "$or": [
                    {"prc_locked": {"$exists": False}},
                    {"prc_locked": None},
                    {"prc_locked": 0},
                ],
                "role": {"$nin": ["admin", "staff", "manager"]},
            },
            maxTimeMS=20_000,
        )
    except Exception:
        remaining_estimate = -1  # unknown

    # Audit
    try:
        await db.audit_logs.insert_one({
            "action": "prc_25k_lock_chunk",
            "performed_by": body.admin_id,
            "users_locked": users_locked,
            "total_prc_locked": total_prc_locked,
            "pending_redeems_refunded": pending_redeems_refunded_count,
            "pending_prc_refunded": pending_prc_refunded,
            "errors": errors[:20],
            "timestamp": now_iso,
        })
    except Exception:
        pass

    return {
        "success": True,
        "processed_this_call": len(candidates),
        "users_locked": users_locked,
        "total_prc_locked": total_prc_locked,
        "pending_redeems_refunded": pending_redeems_refunded_count,
        "pending_prc_refunded": pending_prc_refunded,
        "more_to_do": remaining_estimate > 0,
        "remaining_estimate": remaining_estimate,
        "errors": errors[:20],
        "error_count": len(errors),
    }


# ============================================================================
# ADMIN — Stats
# ============================================================================
@router.get("/stats")
async def lock_stats():
    """Total locked PRC + count of locked users."""
    try:
        pipeline = [
            {"$match": {"prc_locked": {"$gt": 0}}},
            {"$group": {
                "_id": None,
                "user_count": {"$sum": 1},
                "total_locked": {"$sum": "$prc_locked"},
                "total_initial": {"$sum": "$prc_locked_initial"},
            }},
        ]
        cursor = db.users.aggregate(pipeline, maxTimeMS=20_000)
        result = await cursor.to_list(1)
        if result:
            r = result[0]
            return {
                "success": True,
                "user_count": r.get("user_count", 0),
                "total_locked": r.get("total_locked", 0),
                "total_initial": r.get("total_initial", 0),
                "total_unlocked_so_far": r.get("total_initial", 0) - r.get("total_locked", 0),
            }
        return {
            "success": True, "user_count": 0, "total_locked": 0,
            "total_initial": 0, "total_unlocked_so_far": 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN — Manual percentage unlock for a specific user
# ============================================================================
class UnlockPercentRequest(BaseModel):
    pin: str
    admin_id: str = "admin"
    uid: str
    percent: float = Field(..., ge=1, le=100, description="Percent of locked PRC to release (1-100)")
    reason: Optional[str] = "admin_manual_unlock"


@router.post("/unlock-percent")
async def unlock_percent(body: UnlockPercentRequest):
    """Reduce a specific user's prc_locked by `percent`% of CURRENT locked.

    Example: locked=10000, percent=30 → 3000 PRC released → locked=7000.
    """
    if not _verify_admin_pin(body.pin):
        raise HTTPException(status_code=401, detail="Invalid admin PIN")

    user = await db.users.find_one(
        {"uid": body.uid},
        {"_id": 0, "uid": 1, "name": 1, "prc_balance": 1, "prc_locked": 1, "prc_locked_initial": 1}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_locked = float(user.get("prc_locked", 0) or 0)
    if current_locked <= 0:
        raise HTTPException(status_code=400, detail="User has no locked PRC")

    amount_to_unlock = round(current_locked * (body.percent / 100.0), 2)
    new_locked = max(0.0, current_locked - amount_to_unlock)

    update_set = {"prc_locked": new_locked}
    if new_locked <= 0:
        # Fully unlocked — clear all lock metadata
        update_set.update({
            "prc_locked": 0,
            "prc_unlock_at": None,
            "prc_locked_reason": None,
        })

    await db.users.update_one({"uid": body.uid}, {"$set": update_set})

    # Audit
    try:
        await db.audit_logs.insert_one({
            "action": "prc_manual_unlock_percent",
            "performed_by": body.admin_id,
            "uid": body.uid,
            "user_name": user.get("name"),
            "percent": body.percent,
            "amount_unlocked": amount_to_unlock,
            "locked_before": current_locked,
            "locked_after": new_locked,
            "reason": body.reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    return {
        "success": True,
        "uid": body.uid,
        "user_name": user.get("name"),
        "percent": body.percent,
        "amount_unlocked": amount_to_unlock,
        "locked_before": current_locked,
        "locked_after": new_locked,
        "fully_unlocked": new_locked <= 0,
    }


# ============================================================================
# USER — Get current lock status (for Dashboard card)
# ============================================================================
@user_router.get("/status/{uid}")
async def user_lock_status(
    uid: str,
    current_user: dict = Depends(_require_authenticated_user),
):
    """Return locked PRC + days remaining for the user's dashboard card.
    IDOR-safe (Jul 2026): path `uid` must match caller (admin bypass)."""
    caller_uid = current_user.get("uid")
    caller_role = current_user.get("role", "user")
    if caller_role not in ("admin", "sub_admin") and caller_uid != uid:
        raise HTTPException(status_code=403, detail="Access denied.")
    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "prc_balance": 1, "prc_locked": 1, "prc_locked_initial": 1,
         "prc_locked_at": 1, "prc_unlock_at": 1}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    balance = float(user.get("prc_balance", 0) or 0)
    locked = float(user.get("prc_locked", 0) or 0)
    available = max(0.0, balance - locked)

    if locked <= 0:
        return {
            "is_locked": False,
            "prc_balance": balance,
            "prc_locked": 0,
            "available_prc": balance,
        }

    unlock_at_str = user.get("prc_unlock_at")
    days_remaining = 0
    if unlock_at_str:
        try:
            unlock_at = datetime.fromisoformat(unlock_at_str.replace("Z", "+00:00"))
            days_remaining = max(0, (unlock_at - datetime.now(timezone.utc)).days)
        except Exception:
            pass

    return {
        "is_locked": True,
        "prc_balance": balance,
        "prc_locked": locked,
        "prc_locked_initial": float(user.get("prc_locked_initial", locked) or locked),
        "available_prc": available,
        "locked_at": user.get("prc_locked_at"),
        "unlock_at": unlock_at_str,
        "days_remaining": days_remaining,
    }


# ============================================================================
# BACKGROUND — Daily auto-unlock check
# ============================================================================
async def prc_auto_unlock_task():
    """Once a day: unlock all users whose prc_unlock_at <= now."""
    while True:
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            result = await db.users.update_many(
                {"prc_locked": {"$gt": 0}, "prc_unlock_at": {"$lte": now_iso}},
                {"$set": {
                    "prc_locked": 0,
                    "prc_unlock_at": None,
                    "prc_locked_reason": None,
                    "prc_unlocked_at": now_iso,
                }}
            )
            if result.modified_count > 0:
                logging.warning(f"[PRC-AUTO-UNLOCK] Released lock on {result.modified_count} users")
                await db.audit_logs.insert_one({
                    "action": "prc_auto_unlock_daily",
                    "users_unlocked": result.modified_count,
                    "timestamp": now_iso,
                })
        except Exception as e:
            logging.error(f"[PRC-AUTO-UNLOCK] error: {e}")
        await asyncio.sleep(24 * 60 * 60)
