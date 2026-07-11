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

# server.get_current_user is the canonical JWT auth dependency used across
# this codebase (see mall_v2, ads_rewarded, admin_unified_spend, etc.).
from server import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# Module state injected from server.py
db = None


def set_db(database) -> None:
    global db
    db = database


def _assert_self_or_admin(current_user: dict, uid: str) -> None:
    """IDOR guard — only the owner (or an admin/sub_admin) may read this
    user's referral earnings / feed. Anything else is 403.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    caller_uid = current_user.get("uid")
    role = current_user.get("role")
    if caller_uid == uid:
        return
    if role in ("admin", "sub_admin"):
        return
    raise HTTPException(status_code=403, detail="Forbidden — cannot read another user's referral data")


@router.get("/referrals/live-feed/{uid}")
async def get_downline_live_feed(
    uid: str,
    limit: int = Query(50, ge=1, le=200),
    hours: int = Query(24, ge=1, le=720),
    current_user: dict = Depends(get_current_user),
):
    """Return the last `limit` referral-reward events earned by this user
    from their downline's mining collects in the past `hours` window.

    IDOR-protected: the JWT subject must equal `uid`, or the caller must
    be an admin/sub_admin.
    """
    _assert_self_or_admin(current_user, uid)
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
    for r in rows:
        du = r.get("downline_uid")
        fresh = fresh_names.get(du, {})
        amount = float(r.get("amount") or 0)
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

    # BUGFIX (Feb 11, 2026): Previously total_earned_prc & distinct_downlines
    # were computed from the truncated `feed` list, so heavy earners with
    # >`limit` events per window saw their totals silently capped at 100
    # rows. Now we run a separate $group aggregation across the FULL
    # window so the totals shown in the UI's "Total Earned" card are
    # always accurate regardless of display limit.
    agg_pipeline = [
        {"$match": {
            "user_id": uid,
            "type": "mining_referral_reward",
            "timestamp": {"$gte": since},
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
            "downlines": {"$addToSet": "$downline_uid"},
        }},
    ]
    total_earned = 0.0
    total_events = 0
    distinct_downlines = 0
    agg_result = await db.prc_ledger.aggregate(agg_pipeline).to_list(length=1)
    if agg_result:
        agg = agg_result[0]
        total_earned = float(agg.get("total") or 0)
        total_events = int(agg.get("count") or 0)
        distinct_downlines = len([d for d in (agg.get("downlines") or []) if d])

    return {
        "success": True,
        "uid": uid,
        "window_hours": hours,
        "count": len(feed),                    # displayed rows
        "total_events": total_events,          # true window-wide event count
        "total_earned_prc": round(total_earned, 6),
        "distinct_downlines": distinct_downlines,
        "feed": feed,
    }


# ────────────────────────────────────────────────────────────────────────
# EARNINGS SUMMARY — Today / Yesterday / This Week / This Month (Feb 8 2026)
# ────────────────────────────────────────────────────────────────────────
# Powers the four "earned PRC" tiles on the Live Feed page so users can
# see their referral income at a glance and feel the compounding effect.
@router.get("/referrals/earnings-summary/{uid}")
async def get_earnings_summary(uid: str, current_user: dict = Depends(get_current_user)):
    """Aggregate `mining_referral_reward` PRC earned by `uid` across four
    canonical buckets: today, yesterday, this_week (Mon-based ISO week),
    this_month. Buckets align to India Standard Time (IST, UTC+05:30)
    midnight so users see day rollovers at their local midnight — not
    05:30 AM IST like the previous UTC-only version.

    IDOR-protected: caller JWT.uid must equal `uid` (or be admin).
    """
    _assert_self_or_admin(current_user, uid)
    if db is None:
        raise HTTPException(status_code=503, detail="DB not initialised")

    IST = timezone(timedelta(hours=5, minutes=30))
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc.astimezone(IST)

    # IST midnight boundaries → convert back to UTC for Mongo comparisons.
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start_ist = today_start_ist - timedelta(days=1)
    # ISO week — Monday is 0; align to this week's Monday 00:00 IST.
    week_start_ist = today_start_ist - timedelta(days=today_start_ist.weekday())
    month_start_ist = today_start_ist.replace(day=1)

    today_start = today_start_ist.astimezone(timezone.utc)
    yesterday_start = yesterday_start_ist.astimezone(timezone.utc)
    week_start = week_start_ist.astimezone(timezone.utc)
    month_start = month_start_ist.astimezone(timezone.utc)
    now = now_utc

    # Fetch just what we need; sum aggregation via $group would work but
    # a single find→python-fold is simpler and still O(rows-in-month).
    cursor = db.prc_ledger.find(
        {
            "user_id": uid,
            "type": "mining_referral_reward",
            "timestamp": {"$gte": month_start.isoformat()},
        },
        {"_id": 0, "amount": 1, "timestamp": 1},
    )
    rows = await cursor.to_list(length=100000)

    totals = {"today": 0.0, "yesterday": 0.0, "this_week": 0.0, "this_month": 0.0}
    counts = {"today": 0, "yesterday": 0, "this_week": 0, "this_month": 0}

    for r in rows:
        amt = float(r.get("amount") or 0)
        ts_raw = r.get("timestamp")
        if not ts_raw:
            continue
        try:
            # Accept both "…Z" and "+00:00" ISO strings
            ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except Exception:
            continue

        # Every row is at least "this_month" since our query scoped to it.
        totals["this_month"] += amt
        counts["this_month"] += 1

        if ts >= week_start:
            totals["this_week"] += amt
            counts["this_week"] += 1
        if ts >= today_start:
            totals["today"] += amt
            counts["today"] += 1
        elif ts >= yesterday_start:
            totals["yesterday"] += amt
            counts["yesterday"] += 1

    return {
        "success": True,
        "uid": uid,
        "buckets": {
            k: {"earned_prc": round(v, 4), "events": counts[k]}
            for k, v in totals.items()
        },
        "generated_at": now.isoformat(),
    }

