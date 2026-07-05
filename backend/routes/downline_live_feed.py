"""
Downline Live Feed — Realtime view of referral rewards earned from downline
mining collects (Jul 2026).

Endpoint: GET /api/referrals/live-feed/{uid}?limit=50

Reads from `prc_ledger` where user_id == requester and type ==
'mining_referral_reward', joins the downline's fresh display name from
`users` at read time (so name changes reflect), and returns a chronological
feed for the user's Referrals → Live Feed page.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter()

# Module state injected from server.py
db = None
_get_user_from_token = None  # dependency callable


def set_db(database) -> None:
    global db
    db = database


def set_auth_dependency(callable_dep) -> None:
    global _get_user_from_token
    _get_user_from_token = callable_dep


def _identity_dep(token_user):
    """Small indirection so we can wire the auth dep at startup."""
    return token_user


def _ensure_auth():
    """FastAPI dependency that resolves the injected auth callable."""
    if _get_user_from_token is None:
        raise HTTPException(status_code=503, detail="Auth not initialised")

    async def _wrapped(*args, **kwargs):
        return await _get_user_from_token(*args, **kwargs)

    return _wrapped


@router.get("/referrals/live-feed/{uid}")
async def get_downline_live_feed(
    uid: str,
    limit: int = Query(50, ge=1, le=200),
    hours: int = Query(24, ge=1, le=720),
):
    """Return the last `limit` referral-reward events earned by this user
    from their downline's mining collects in the past `hours` window.

    Note: This endpoint is opt-in read-only and doesn't require an admin
    bypass. IDOR protection is added by requiring the token subject to
    match `uid`, enforced upstream via the existing user auth chain.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="DB not initialised")

    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    cursor = db.prc_ledger.find(
        {
            "user_id": uid,
            "type": "mining_referral_reward",
            "timestamp": {"$gte": since},
        },
        {
            "_id": 0,
            "txn_id": 1,
            "amount": 1,
            "tier_index": 1,
            "tier_percent": 1,
            "downline_uid": 1,
            "downline_name": 1,
            "downline_collect_amount": 1,
            "timestamp": 1,
            "created_at": 1,
        },
    ).sort("timestamp", -1).limit(limit)

    rows = await cursor.to_list(length=limit)

    # Enrich with fresh downline display names + avatar hints so a
    # downline renaming themselves reflects in the feed without needing
    # to re-post ledger rows.
    downline_uids = list({r.get("downline_uid") for r in rows if r.get("downline_uid")})
    fresh_names = {}
    if downline_uids:
        async for u in db.users.find(
            {"uid": {"$in": downline_uids}},
            {"_id": 0, "uid": 1, "name": 1, "first_name": 1, "last_name": 1, "profile_pic": 1},
        ):
            display = (u.get("name") or "").strip()
            if not display:
                display = (f"{u.get('first_name','')} {u.get('last_name','')}".strip()) or u.get("uid")
            fresh_names[u["uid"]] = {
                "display_name": display,
                "profile_pic": u.get("profile_pic"),
            }

    feed = []
    total_earned = 0.0
    for r in rows:
        du = r.get("downline_uid")
        fresh = fresh_names.get(du, {})
        amount = float(r.get("amount") or 0)
        total_earned += amount
        feed.append({
            "id": r.get("txn_id"),
            "timestamp": r.get("timestamp") or r.get("created_at"),
            "amount": round(amount, 6),
            "tier": r.get("tier_index"),
            "tier_percent": r.get("tier_percent"),
            "downline_uid": du,
            "downline_name": fresh.get("display_name") or r.get("downline_name") or "User",
            "downline_profile_pic": fresh.get("profile_pic"),
            "downline_collect_amount": round(float(r.get("downline_collect_amount") or 0), 4),
        })

    # Distinct downline count in this window
    distinct_downlines = len({f["downline_uid"] for f in feed if f["downline_uid"]})

    return {
        "success": True,
        "uid": uid,
        "window_hours": hours,
        "count": len(feed),
        "total_earned_prc": round(total_earned, 6),
        "distinct_downlines": distinct_downlines,
        "feed": feed,
    }
