"""
ads_rewarded.py — Rewarded video ad PRC crediting

User flow:
    1. POST /api/ads/rewarded/start   → returns {allowed, view_token, ad_unit_id, remaining}
       Server validates daily quota and mints a one-time view_token.
    2. Client plays the rewarded ad via AdMob.
    3. POST /api/ads/rewarded/credit  with the view_token
       → server marks token consumed, credits PRC to user, appends to prc_ledger.
    4. GET /api/ads/rewarded/quota    → {used, max, reward_per_ad}

Daily quota is a per-user counter stored in `ad_rewards_daily` keyed by
(uid, day_yyyymmdd). View tokens live in `ad_view_tokens` and self-clean
after 10 minutes via a TTL index.
"""
import os
import uuid
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

# Shared auth dep
from server import get_current_user

router = APIRouter(prefix="/ads/rewarded", tags=["ads"])

# Ad units (kept server-side too in case the client gets out of sync)
AD_UNIT_REWARDED = "ca-app-pub-3556805218952480/7314369451"
AD_UNIT_REWARDED_INTERSTITIAL = "ca-app-pub-3556805218952480/2377737544"
DAILY_MAX = 10
# Bonus PRC per ad — random 5..10 (inclusive) for variety. The expected
# average is 7.5 PRC × 10 ads/day = 75 PRC/day per user cap.
REWARD_MIN_PRC = 5
REWARD_MAX_PRC = 10
ALLOWED_PLACEMENTS = {"main_mining_collect", "mall_collect", "other"}

# ── DB handle (Jun 2026 fix) ─────────────────────────────────────────
# We used to create our OWN AsyncIOMotorClient at module-import time:
#     _client = AsyncIOMotorClient(_env["MONGO_URL"])
#     db = _client[_env["DB_NAME"]]
# That bound the connection pool to whatever event loop was active during
# import. In production (under uvicorn workers) the request handlers ran
# on a DIFFERENT loop, so every await on this client HUNG FOREVER —
# turning "Collect Rewards" into a no-op (the UI modal waits on /start,
# /start never returns).
# We now use the canonical set_db() pattern like every other route.
db = None
_indexes_created = False


def set_db(database):
    global db
    db = database


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


async def _ensure_indexes():
    """One-shot per-process index creation. The previous implementation
    ran on every request which added a needless round-trip and, with the
    stale client above, was a primary reason the endpoint hung."""
    global _indexes_created
    if _indexes_created:
        return
    try:
        await db.ad_view_tokens.create_index("expires_at", expireAfterSeconds=0)
        await db.ad_rewards_daily.create_index([("uid", 1), ("day", 1)], unique=True)
    except Exception:
        pass
    _indexes_created = True


@router.get("/quota")
async def get_quota(user: dict = Depends(get_current_user)):
    await _ensure_indexes()
    uid = user["uid"]
    day = _today_key()
    doc = await db.ad_rewards_daily.find_one({"uid": uid, "day": day}, {"_id": 0})
    used = int(doc.get("used", 0)) if doc else 0
    return {
        "used": used,
        "max": DAILY_MAX,
        "reward_min_prc": REWARD_MIN_PRC,
        "reward_max_prc": REWARD_MAX_PRC,
        "remaining": max(0, DAILY_MAX - used),
    }


class StartBody(BaseModel):
    placement: str | None = "other"  # main_mining_collect | mall_collect | other


@router.post("/start")
async def start_ad(body: StartBody | None = None, user: dict = Depends(get_current_user)):
    """Mint a one-time view token. Quota is also re-checked at /credit."""
    await _ensure_indexes()
    uid = user["uid"]
    day = _today_key()
    placement = (body.placement if body else None) or "other"
    if placement not in ALLOWED_PLACEMENTS:
        placement = "other"
    doc = await db.ad_rewards_daily.find_one({"uid": uid, "day": day}, {"_id": 0})
    used = int(doc.get("used", 0)) if doc else 0
    if used >= DAILY_MAX:
        return {"allowed": False, "reason": "Daily limit reached", "remaining": 0}

    view_token = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    # Pre-roll the bonus amount on START so the prompt can display an
    # exact preview ("Earn +N bonus PRC"). Stored on the token so the
    # /credit call cannot inflate the reward client-side.
    bonus = random.randint(REWARD_MIN_PRC, REWARD_MAX_PRC)
    await db.ad_view_tokens.insert_one({
        "view_token": view_token,
        "uid": uid,
        "ad_type": "rewarded",
        "ad_unit_id": AD_UNIT_REWARDED,
        "placement": placement,
        "preroll_bonus": bonus,
        "created_at": now,
        "expires_at": now + timedelta(minutes=10),
        "credited": False,
    })
    return {
        "allowed": True,
        "view_token": view_token,
        "ad_unit_id": AD_UNIT_REWARDED,
        "bonus_prc": bonus,
        "remaining": DAILY_MAX - used,
    }


class CreditBody(BaseModel):
    view_token: str


@router.post("/credit")
async def credit_reward(body: CreditBody, user: dict = Depends(get_current_user)):
    """Mark the view token consumed, credit PRC, append ledger entry."""
    await _ensure_indexes()
    uid = user["uid"]
    day = _today_key()

    token_doc = await db.ad_view_tokens.find_one({
        "view_token": body.view_token,
        "uid": uid,
    })
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid or expired view token")
    if token_doc.get("credited"):
        raise HTTPException(status_code=409, detail="Already credited")

    # Use the bonus pre-rolled on /start (cannot be tampered client-side)
    bonus_prc = int(token_doc.get("preroll_bonus") or REWARD_MIN_PRC)

    # Atomically bump the daily counter (still bounded by DAILY_MAX)
    daily = await db.ad_rewards_daily.find_one_and_update(
        {"uid": uid, "day": day, "used": {"$lt": DAILY_MAX}},
        {
            "$inc": {"used": 1, "credited_prc": bonus_prc},
            "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
        },
        upsert=True,
        return_document=True,
    )
    if not daily or daily.get("used", 0) > DAILY_MAX:
        raise HTTPException(status_code=429, detail="Daily limit reached")

    # Credit PRC to user balance
    upd = await db.users.update_one(
        {"uid": uid},
        {"$inc": {"prc_balance": bonus_prc}},
    )
    if upd.matched_count == 0:
        # roll back counter
        await db.ad_rewards_daily.update_one(
            {"uid": uid, "day": day},
            {"$inc": {"used": -1, "credited_prc": -bonus_prc}},
        )
        raise HTTPException(status_code=404, detail="User not found")

    # ── PRC Statement entry (Jun 24, 2026 fix) ────────────────────────
    # Previous ledger insert used a non-canonical schema:
    #   • `uid` instead of `user_id` → user-facing PRC statement page
    #     (which queries by `user_id`) silently filtered these entries out,
    #     so users saw the PRC arrive in their balance but no statement row.
    #   • Missing `entry_type`, `balance_before/after`, `txn_id`, `reference`,
    #     `service_type`, `service_label`, `timestamp` → no running-balance
    #     column, no service grouping in admin reports.
    # Now we mirror the canonical pattern used by mall_booking /
    # mall_cancel_refund / manual_bank_transfer ledger writes.
    now = datetime.now(timezone.utc)
    placement = token_doc.get("placement", "other")
    placement_label = {
        "main_mining_collect": "Main Mining",
        "mall_collect": "Paras Mall",
        "other": "Rewarded Ad",
    }.get(placement, "Rewarded Ad")

    fresh_user = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1}) or {}
    balance_after = float(fresh_user.get("prc_balance", 0) or 0)
    balance_before = balance_after - bonus_prc

    await db.prc_ledger.insert_one({
        "txn_id": str(uuid.uuid4()),
        "user_id": uid,
        "type": "ad_reward",
        "entry_type": "credit",
        "amount": bonus_prc,  # positive for credit
        "balance_before": round(balance_before, 2),
        "balance_after": round(balance_after, 2),
        "reference": body.view_token,
        "service_type": "rewarded_ad",
        "service_label": placement_label,
        "service_ref_id": body.view_token,
        "description": f"Ad Bonus PRC ({placement_label}) — +{bonus_prc} PRC",
        "timestamp": now.isoformat(),
        "created_at": now.isoformat(),
        "metadata": {
            "ad_unit_id": AD_UNIT_REWARDED,
            "view_token": body.view_token,
            "placement": placement,
        },
    })

    # Mark token as consumed (prevents replay)
    await db.ad_view_tokens.update_one(
        {"view_token": body.view_token},
        {"$set": {"credited": True, "credited_at": now}},
    )

    return {
        "success": True,
        "credited": bonus_prc,
        "bonus_prc": bonus_prc,
        "placement": placement,
        "remaining_today": max(0, DAILY_MAX - int(daily.get("used", 0))),
    }
