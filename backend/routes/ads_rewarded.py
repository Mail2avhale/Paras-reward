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
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import dotenv_values

# Shared auth dep
from server import get_current_user

router = APIRouter(prefix="/ads/rewarded", tags=["ads"])

# Ad units (kept server-side too in case the client gets out of sync)
AD_UNIT_REWARDED = "ca-app-pub-3556805218952480/7314369451"
DAILY_MAX = 10
REWARD_PER_AD = 0.5  # PRC

# DB handle — lazy
_env = dotenv_values("/app/backend/.env")
_client = AsyncIOMotorClient(_env["MONGO_URL"])
db = _client[_env["DB_NAME"]]


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


async def _ensure_indexes():
    try:
        await db.ad_view_tokens.create_index("expires_at", expireAfterSeconds=0)
        await db.ad_rewards_daily.create_index([("uid", 1), ("day", 1)], unique=True)
    except Exception:
        pass


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
        "reward_per_ad": REWARD_PER_AD,
        "remaining": max(0, DAILY_MAX - used),
    }


@router.post("/start")
async def start_ad(user: dict = Depends(get_current_user)):
    """Mint a one-time view token. Quota is also re-checked at /credit."""
    await _ensure_indexes()
    uid = user["uid"]
    day = _today_key()
    doc = await db.ad_rewards_daily.find_one({"uid": uid, "day": day}, {"_id": 0})
    used = int(doc.get("used", 0)) if doc else 0
    if used >= DAILY_MAX:
        return {"allowed": False, "reason": "Daily limit reached", "remaining": 0}

    view_token = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    await db.ad_view_tokens.insert_one({
        "view_token": view_token,
        "uid": uid,
        "ad_type": "rewarded",
        "ad_unit_id": AD_UNIT_REWARDED,
        "created_at": now,
        "expires_at": now + timedelta(minutes=10),
        "credited": False,
    })
    return {
        "allowed": True,
        "view_token": view_token,
        "ad_unit_id": AD_UNIT_REWARDED,
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

    # Atomically bump the daily counter (still bounded by DAILY_MAX)
    daily = await db.ad_rewards_daily.find_one_and_update(
        {"uid": uid, "day": day, "used": {"$lt": DAILY_MAX}},
        {
            "$inc": {"used": 1, "credited_prc": REWARD_PER_AD},
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
        {"$inc": {"prc_balance": REWARD_PER_AD}},
    )
    if upd.matched_count == 0:
        # roll back counter
        await db.ad_rewards_daily.update_one(
            {"uid": uid, "day": day},
            {"$inc": {"used": -1, "credited_prc": -REWARD_PER_AD}},
        )
        raise HTTPException(status_code=404, detail="User not found")

    # Append ledger entry for audit trail
    now = datetime.now(timezone.utc)
    await db.prc_ledger.insert_one({
        "uid": uid,
        "type": "ad_reward",
        "amount": REWARD_PER_AD,
        "category": "rewarded_ad",
        "description": f"Rewarded ad view ({body.view_token[:8]})",
        "created_at": now.isoformat(),
        "metadata": {
            "ad_unit_id": AD_UNIT_REWARDED,
            "view_token": body.view_token,
        },
    })

    # Mark token as consumed (prevents replay)
    await db.ad_view_tokens.update_one(
        {"view_token": body.view_token},
        {"$set": {"credited": True, "credited_at": now}},
    )

    return {
        "success": True,
        "credited": REWARD_PER_AD,
        "remaining_today": max(0, DAILY_MAX - int(daily.get("used", 0))),
    }
