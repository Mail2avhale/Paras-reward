"""
Referral Routes
================
- /referral/lookup/{code}    — validate a referral code (used by registration form)
- /referral/apply/{uid}      — POST: self-claim missed referral (users who signed
                               up without a code can attach a referrer within a
                               post-signup window; Feb 2026 restoration of the
                               legacy endpoint, now with safety guards).

Removed in the June 2026 cleanup (DO NOT bring back; canonical sources below):
  - /api/notifications/referrals/{uid}/direct-list
  - /api/notifications/referrals/{uid}/level-breakdown (L1-L5 cascade)
  - /api/mining/rate-breakdown/{uid} (cap formula + tier breakdown)
"""

import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/referral", tags=["Referral"])

db = None
cache = None

# How long after signup a user can attach a referrer via self-claim.
# Tight enough to prevent late-stage gaming; generous enough for users who
# only learn about the referral feature after exploring the app.
SELF_CLAIM_WINDOW_DAYS = 30


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


class ApplyReferralBody(BaseModel):
    referral_code: str = Field(..., min_length=1, max_length=32)


@router.post("/apply/{uid}")
async def apply_referral(uid: str, body: ApplyReferralBody):
    """Self-claim a missed referrer.

    Allows a user who registered WITHOUT a referral code (e.g., before the
    Feb 2026 attribution fixes shipped, or via a link that stripped the
    ?ref= param) to attach a referrer after the fact — within
    SELF_CLAIM_WINDOW_DAYS of their signup.

    Safety guards:
      - User must exist
      - User must not already have a referrer (no overwrite — one-shot only)
      - Signup must be within the self-claim window
      - Cannot self-refer
      - Cannot create a circular chain (your referrer cannot be a person who
        was referred by you, directly or transitively)
      - Referral code must be valid (case-insensitive lookup)

    On success:
      - Sets referred_by on the claiming user
      - Increments referrer's referral_count
      - Stamps `referred_at` + `referred_via = "self_claim"` for audit
      - Sends a notification to the referrer
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")

    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("referred_by"):
        raise HTTPException(status_code=400, detail="You already have a referrer attached. This action is one-shot.")

    # Window check (skip silently if signup timestamp is missing — legacy users)
    created_at_raw = user.get("created_at")
    if created_at_raw:
        try:
            created_at = datetime.fromisoformat(str(created_at_raw).replace("Z", "+00:00"))
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - created_at).days
            if age_days > SELF_CLAIM_WINDOW_DAYS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Referral claim window closed. You can attach a referrer only within {SELF_CLAIM_WINDOW_DAYS} days of signup (account is {age_days} days old).",
                )
        except ValueError:
            pass  # Malformed timestamp — let the user claim anyway

    code = body.referral_code.strip().upper()
    referrer = await db.users.find_one({"referral_code": code})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    if referrer["uid"] == uid:
        raise HTTPException(status_code=400, detail="You cannot refer yourself")

    # Cycle check: walk up the referrer's chain; if `uid` appears anywhere,
    # the claim would create a loop. Cap depth to prevent runaway queries.
    cursor_uid = referrer.get("referred_by")
    for _ in range(20):
        if not cursor_uid:
            break
        if cursor_uid == uid:
            raise HTTPException(status_code=400, detail="Circular referral chain detected. That user is downstream of you.")
        upstream = await db.users.find_one({"uid": cursor_uid}, {"_id": 0, "referred_by": 1})
        cursor_uid = upstream.get("referred_by") if upstream else None

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "referred_by": referrer["uid"],
            "referred_by_name": referrer.get("name", "A Friend"),
            "referred_at": now_iso,
            "referred_via": "self_claim",
        }},
    )
    await db.users.update_one(
        {"uid": referrer["uid"]},
        {"$inc": {"referral_count": 1}},
    )

    # Best-effort notification to the referrer — failure shouldn't break the
    # claim itself.
    try:
        await db.notifications.insert_one({
            "user_uid": referrer["uid"],
            "user_id": referrer["uid"],
            "type": "referral_joined",
            "title": "A friend joined your network",
            "message": f"{user.get('name', 'Someone')} attached you as their referrer via self-claim.",
            "created_at": now_iso,
            "read": False,
            "source": "self_claim",
        })
    except Exception as e:
        logging.warning(f"[referral.apply] notification failed: {e}")

    return {
        "success": True,
        "message": "Referrer attached successfully",
        "referrer_name": referrer.get("name", ""),
        "referrer_uid": referrer["uid"],
    }
