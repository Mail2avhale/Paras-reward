"""
PARAS REWARD - Leaderboard Routes
==================================
All leaderboard related API endpoints

Feb 23 2026 — Production perf hardening:
  • Response caching (60s in-process TTL) on ALL leaderboard endpoints —
    baseline `/leaderboard?limit=50` was clocking 30 s on cold Atlas hits
    and 1.7-3 s on warm. Now: 1 Mongo hit / minute globally, everything
    else is served from RAM in < 5 ms.
  • Killed 4 x N+1 loops (`for row in results: db.users.find_one(...)`)
    that were doing up to 100 sequential round-trips (~20 s at prod
    latency). Replaced with a single `$in` batch fetch.
  • Removed remaining `profile_picture` (base64) leaks from projections.
"""

from fastapi import APIRouter
from datetime import datetime, timezone, timedelta
import time as _time

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

# Database reference - will be set by server.py
db = None

def set_db(database):
    global db
    db = database


# ── In-process response cache (per-uvicorn-worker) ──────────────────
# We deliberately DO NOT use Redis here — the payloads are small (< 20 KB
# each) and the endpoints are read-heavy / write-cold. A plain dict keyed
# by "endpoint:params" gives us 0 ms hits with no network round-trip.
# Cache is naturally self-limiting (< 20 entries total across all
# leaderboard endpoints), so no LRU needed.
_LB_CACHE: "dict[str, tuple[float, object]]" = {}
_LB_TTL_SECONDS = 60.0


def _lb_get(key: str):
    entry = _LB_CACHE.get(key)
    if not entry:
        return None
    ts, payload = entry
    if _time.time() - ts > _LB_TTL_SECONDS:
        _LB_CACHE.pop(key, None)
        return None
    return payload


def _lb_set(key: str, value):
    _LB_CACHE[key] = (_time.time(), value)


async def _hydrate_users(user_ids: list) -> dict:
    """Batch-fetch minimal user info for a list of UIDs.

    Replaces the N+1 `for row in results: db.users.find_one(...)` pattern.
    Returns {uid: {name, subscription_plan, has_avatar, ...}}.

    Guarded by the global `_UsersCollectionSizeGuard` in server.py — this
    projection is exclude-safe (no `profile_picture`, no `mining_history`).
    """
    if not user_ids:
        return {}
    docs = await db.users.find(
        {"uid": {"$in": user_ids}},
        {"_id": 0, "uid": 1, "name": 1, "first_name": 1,
         "subscription_plan": 1, "city": 1, "state": 1,
         "has_profile_picture": 1, "profile_picture_url": 1}
    ).to_list(len(user_ids))
    return {d["uid"]: d for d in docs}


@router.get("")
async def get_leaderboard(limit: int = 50):
    """Overall leaderboard by PRC balance.

    Cached 60s in-process; batch-hydrated (was 1 + N find_ones).
    """
    cache_key = f"overall:{limit}"
    cached = _lb_get(cache_key)
    if cached is not None:
        return cached

    users = await db.users.find(
        {"prc_balance": {"$gt": 0}},
        {"_id": 0, "uid": 1, "name": 1, "first_name": 1, "prc_balance": 1,
         "has_profile_picture": 1, "profile_picture_url": 1,
         "subscription_plan": 1}
    ).sort("prc_balance", -1).limit(limit).to_list(limit)

    leaderboard = []
    for idx, user in enumerate(users, 1):
        name = user.get("name") or user.get("first_name") or "User"
        leaderboard.append({
            "rank": idx,
            "user_id": user["uid"],
            "name": name,
            "prc_balance": round(user.get("prc_balance", 0), 2),
            # profile_picture kept as None for backwards-compat with existing
            # frontend renderers; has_avatar is the reliable indicator.
            "profile_picture": None,
            "has_avatar": bool(user.get("has_profile_picture") or user.get("profile_picture_url")),
            "profile_picture_url": user.get("profile_picture_url"),
            "subscription_plan": user.get("subscription_plan", "explorer")
        })

    payload = {"leaderboard": leaderboard}
    _lb_set(cache_key, payload)
    return payload


@router.get("/miners")
async def get_top_miners(period: str = "all_time", limit: int = 100):
    """Top miners leaderboard — cached + batch-hydrated."""
    cache_key = f"miners:{period}:{limit}"
    cached = _lb_get(cache_key)
    if cached is not None:
        return cached

    # Calculate time filter
    time_filter = {}
    if period == "weekly":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        time_filter = {"created_at": {"$gte": week_ago}}
    elif period == "monthly":
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        time_filter = {"created_at": {"$gte": month_ago}}

    # Aggregate mining totals (tap_game removed - feature deprecated)
    pipeline = [
        {"$match": {**{"type": {"$in": ["mining"]}}, **time_filter}},
        {"$group": {
            "_id": "$user_id",
            "total_mined": {"$sum": "$amount"}
        }},
        {"$sort": {"total_mined": -1}},
        {"$limit": limit}
    ]

    results = await db.transactions.aggregate(pipeline).to_list(limit)

    # BATCH hydrate — was N+1 (up to 100 sequential find_ones @ ~200 ms each on prod).
    user_ids = [r["_id"] for r in results]
    users_map = await _hydrate_users(user_ids)

    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = users_map.get(result["_id"])
        if not user:
            continue
        leaderboard.append({
            "rank": idx,
            "user_id": result["_id"],
            "name": user.get("name", "Unknown"),
            "total_mined": round(result["total_mined"], 2),
            "subscription_plan": user.get("subscription_plan", "explorer")
        })

    payload = {"leaderboard": leaderboard, "period": period}
    _lb_set(cache_key, payload)
    return payload


@router.get("/referrers")
async def get_top_referrers(limit: int = 100):
    """Top referrers leaderboard (by friends invited) — cached + batch-hydrated."""
    cache_key = f"referrers:{limit}"
    cached = _lb_get(cache_key)
    if cached is not None:
        return cached

    # Aggregate referral counts
    pipeline = [
        {"$match": {"referred_by": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$referred_by",
            "total_referrals": {"$sum": 1}
        }},
        {"$sort": {"total_referrals": -1}},
        {"$limit": limit}
    ]

    results = await db.users.aggregate(pipeline).to_list(limit)

    # BATCH hydrate — was N+1.
    user_ids = [r["_id"] for r in results]
    users_map = await _hydrate_users(user_ids)

    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = users_map.get(result["_id"])
        if not user:
            continue
        leaderboard.append({
            "rank": idx,
            "user_id": result["_id"],
            "name": user.get("name", "Unknown"),
            "friends_invited": result["total_referrals"],
            "subscription_plan": user.get("subscription_plan", "explorer")
        })

    payload = {"leaderboard": leaderboard}
    _lb_set(cache_key, payload)
    return payload


@router.get("/earners")
async def get_top_earners(limit: int = 100):
    """Top earners leaderboard by total earned — cached + batch-hydrated."""
    cache_key = f"earners:{limit}"
    cached = _lb_get(cache_key)
    if cached is not None:
        return cached

    pipeline = [
        {"$match": {"type": {"$in": ["mining", "referral_bonus", "daily_reward"]}}},
        {"$group": {
            "_id": "$user_id",
            "total_earned": {"$sum": "$amount"}
        }},
        {"$sort": {"total_earned": -1}},
        {"$limit": limit}
    ]

    results = await db.transactions.aggregate(pipeline).to_list(limit)

    user_ids = [r["_id"] for r in results]
    users_map = await _hydrate_users(user_ids)

    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = users_map.get(result["_id"])
        if not user:
            continue
        leaderboard.append({
            "rank": idx,
            "user_id": result["_id"],
            "name": user.get("name", "Unknown"),
            "total_earned": round(result["total_earned"], 2),
            "subscription_plan": user.get("subscription_plan", "explorer")
        })

    payload = {"leaderboard": leaderboard}
    _lb_set(cache_key, payload)
    return payload


@router.get("/weekly")
async def get_weekly_leaderboard(limit: int = 50):
    """Weekly leaderboard — cached + batch-hydrated (was pulling
    base64 profile_picture per user which could balloon this response
    to tens of MB)."""
    cache_key = f"weekly:{limit}"
    cached = _lb_get(cache_key)
    if cached is not None:
        return cached

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}, "type": {"$in": ["mining", "referral_bonus"]}}},
        {"$group": {
            "_id": "$user_id",
            "weekly_earnings": {"$sum": "$amount"}
        }},
        {"$sort": {"weekly_earnings": -1}},
        {"$limit": limit}
    ]

    results = await db.transactions.aggregate(pipeline).to_list(limit)

    user_ids = [r["_id"] for r in results]
    users_map = await _hydrate_users(user_ids)

    leaderboard = []
    for idx, result in enumerate(results, 1):
        user = users_map.get(result["_id"])
        if not user:
            continue
        leaderboard.append({
            "rank": idx,
            "user_id": result["_id"],
            "name": user.get("name", "Unknown"),
            "weekly_earnings": round(result["weekly_earnings"], 2),
            "profile_picture": None,
            "has_avatar": bool(user.get("has_profile_picture") or user.get("profile_picture_url")),
        })

    payload = {"leaderboard": leaderboard, "period": "weekly"}
    _lb_set(cache_key, payload)
    return payload


# ============================================================================
# TOP REDEEMERS — Lifetime across ALL services (for Community + Live Strip)
# ============================================================================
_TOP_REDEEMERS_CACHE: dict = {"ts": 0, "data": None}
# Cache TTL chosen to match the rough "freshness" users expect after a redeem.
# Pre-May-11: 2 hours — caused Top 10 to lag behind the Community feed badge by
# multiple redeems for the same user. New: 5 minutes — short enough that the
# leaderboard tracks Community Feed within one auto-refresh tick, long enough
# to absorb crawler spikes without overloading the dedup-heavy 2-pass aggregation.
_TOP_REDEEMERS_TTL = 5 * 60  # 5 minutes


def _mask_name(full_name: str, first_name: str = "") -> str:
    """'Vishal Rohitkumar Rundhiya' → 'Vishal R.' ; fallback to 'User' ."""
    first = (first_name or "").strip()
    full = (full_name or "").strip()
    if not first:
        first = full.split()[0] if full else ""
    if not first:
        return "User"
    # Last initial from full name (if more than one word)
    parts = full.split()
    last_initial = ""
    if len(parts) >= 2 and parts[-1] and parts[-1][0].isalpha():
        last_initial = f" {parts[-1][0].upper()}."
    return f"{first}{last_initial}"


def _city_for(user: dict) -> str:
    return (
        user.get("city")
        or user.get("district")
        or user.get("state")
        or ""
    )


async def _sum_prc_by_user(pipeline_match: dict, pipeline_group_field: str,
                           coll_name: str) -> dict:
    """Return {user_id: sum_prc} for given collection + numeric field.
    `pipeline_group_field` may be a single field name OR a list of fallback
    field names (first non-null wins via $ifNull chain). This handles schema
    drift across collections (e.g., recharge_transactions has only amount_inr,
    bill_payment_requests uses prc_used, etc.)."""
    if isinstance(pipeline_group_field, str):
        sum_expr = {"$ifNull": [f"${pipeline_group_field}", 0]}
    else:
        # Build nested $ifNull chain across multiple field candidates
        sum_expr = 0
        for fname in reversed(pipeline_group_field):
            sum_expr = {"$ifNull": [f"${fname}", sum_expr]}
    pipeline = [
        {"$match": pipeline_match},
        {"$group": {
            "_id": "$user_id",
            "total": {"$sum": sum_expr},
        }},
    ]
    result = {}
    try:
        async for row in db[coll_name].aggregate(pipeline, allowDiskUse=True):
            uid = row.get("_id")
            if uid:
                result[uid] = result.get(uid, 0) + float(row.get("total") or 0)
    except Exception as e:
        import logging
        logging.warning(f"[top-redeemers] agg on {coll_name} failed: {e}")
    return result


@router.get("/top-redeemers")
async def get_top_redeemers(limit: int = 50):
    """Top N users by LIFETIME PRC redeemed/spent across all services.
    Two-pass:
      1. Fast aggregation → identify top candidates (2x buffer).
      2. Accurate per-user reconciliation via get_user_all_time_redeemed()
         (which includes dedup and all 16 collections).
    30-min in-memory cache.
    """
    import time
    import logging
    import asyncio

    now = time.time()
    if (_TOP_REDEEMERS_CACHE["data"] is not None
            and now - _TOP_REDEEMERS_CACHE["ts"] < _TOP_REDEEMERS_TTL
            and len(_TOP_REDEEMERS_CACHE["data"]) >= limit):
        return {
            "leaderboard": _TOP_REDEEMERS_CACHE["data"][:limit],
            "cached": True,
            "refreshed_at": _TOP_REDEEMERS_CACHE["ts"],
        }

    STATUS_OK = {"$in": ["paid", "approved", "completed", "success",
                          "pending", "processing", "Paid", "Approved",
                          "Completed", "Success", "Pending", "Processing"]}

    rough_totals: dict = {}

    # Broader source list matching get_user_all_time_redeemed.
    # NOTE: pass-1 here just picks candidate user IDs; pass-2 below reconciles
    # the accurate PRC value via the canonical get_user_all_time_redeemed().
    # So per-collection field accuracy doesn't have to be perfect — it just
    # needs to not miss any user who has *some* PRC spend.
    # Field tuples support fallback chains for schema drift.
    sources = [
        # Mobile/DTH recharges (Eko) — schema: amount_inr (proxy for PRC via rate)
        ("recharge_transactions", ["amount_inr", "amount", "prc_amount", "total_prc_deducted"]),
        ("recharge_requests", ["total_prc_deducted", "amount_inr"]),
        ("bill_payment_requests", ["total_prc_deducted", "prc_used", "amount_inr"]),
        ("bill_payments", ["total_prc_deducted", "prc_used", "amount_inr"]),
        ("payment_requests", ["total_prc_deducted", "prc_used", "amount_inr"]),
        ("gift_voucher_requests", ["total_prc_deducted", "prc_used", "amount_inr"]),
        ("redeem_requests", ["total_prc_deducted", "prc_amount", "amount_inr"]),
        ("bank_withdrawal_requests", ["total_prc_deducted", "prc_amount", "amount_inr"]),
        ("bank_redeem_requests", ["total_prc_deducted", "prc_amount", "amount_inr"]),
        ("bank_transfers", ["total_prc_deducted", "prc_amount", "amount_inr"]),
        ("bank_transfer_requests", ["total_prc_deducted", "prc_deducted", "prc_amount", "amount_inr"]),
        ("subscription_payments", ["prc_amount", "inr_equivalent", "amount"]),
        ("vip_payments", ["prc_amount", "amount"]),
        ("dmt_transactions", ["total_prc_deducted", "prc_amount", "amount"]),
        ("dmt_logs", ["total_prc_deducted", "prc_amount", "amount"]),
        ("orders", ["prc_amount", "total_prc"]),
        ("unified_redemptions", ["total_prc_deducted", "prc_amount", "amount_inr"]),
    ]
    # Feb 23 2026 — Run the 17 per-collection aggregations in PARALLEL
    # (they used to be sequential → up to ~17s on cold Atlas). Motor's
    # connection pool handles the concurrency fine; each aggregation
    # still has allowDiskUse=True so no memory spike.
    import asyncio as _aio_local
    async def _one(coll_name, fields_local):
        try:
            return await _sum_prc_by_user({"status": STATUS_OK}, fields_local, coll_name)
        except Exception as _e:
            logging.warning(f"[top-redeemers] parallel agg on {coll_name} failed: {_e}")
            return {}
    partials = await _aio_local.gather(*[_one(c, f) for c, f in sources])
    for partial in partials:
        for uid, prc in partial.items():
            rough_totals[uid] = rough_totals.get(uid, 0) + prc

    if not rough_totals:
        logging.warning("[top-redeemers] no data across any service")
        return {"leaderboard": [], "cached": False, "refreshed_at": int(now)}

    # Top 1.5x buffer (smaller = faster reconciliation)
    candidates = sorted(rough_totals.items(), key=lambda x: -x[1])[:int(limit * 1.5) + 10]
    user_ids = [t[0] for t in candidates]

    # Pass 2: reconcile each with canonical get_user_all_time_redeemed (dedup-aware)
    try:
        from server import get_user_all_time_redeemed
    except Exception as e:
        logging.error(f"[top-redeemers] cannot import canonical fn: {e}")
        get_user_all_time_redeemed = None

    accurate: dict = {}
    if get_user_all_time_redeemed:
        # Process in batches of 15 to avoid DB overload; 30s timeout per batch
        BATCH = 15
        for i in range(0, len(user_ids), BATCH):
            batch = user_ids[i:i + BATCH]

            async def _resolve(uid: str):
                try:
                    v = await asyncio.wait_for(
                        get_user_all_time_redeemed(uid), timeout=25.0
                    )
                    return uid, float(v or 0), True
                except Exception as e:
                    logging.warning(f"[top-redeemers] reconcile {uid} failed: {e}")
                    return uid, 0.0, False  # skip on failure — do NOT use rough

            try:
                results = await asyncio.wait_for(
                    asyncio.gather(*[_resolve(u) for u in batch]),
                    timeout=40.0,
                )
                for uid, prc, ok in results:
                    if ok and prc > 0:
                        accurate[uid] = prc
            except asyncio.TimeoutError:
                logging.warning(f"[top-redeemers] batch {i} timeout — skipping")
                continue
    else:
        # Canonical unavailable — use rough as last resort
        accurate = dict(candidates)

    # SAFETY NET: if pass-2 reconciliation yielded empty (e.g. all batches timed out
    # on heavy production data), do NOT serve an empty leaderboard. Fall back to
    # rough pass-1 candidates so users still see real data.
    if not accurate and rough_totals:
        import logging
        logging.warning("[top-redeemers] pass-2 yielded empty — falling back to rough_totals")
        accurate = dict(candidates)

    # Hydrate user info — DO NOT pull `profile_picture` (base64 blob up to
    # ~500KB per user). We only need a boolean `has_avatar` in the payload
    # which we can derive from a lightweight "does_field_exist" projection.
    # Feb 22 2026: previously this pulled profile_picture: 1 for ~75
    # candidates → up to 37MB per cache-miss request. Now bounded to a
    # few KB.
    user_docs = {u["uid"]: u for u in await db.users.find(
        {"uid": {"$in": user_ids}},
        {"_id": 0, "uid": 1, "name": 1, "first_name": 1, "last_name": 1,
         "city": 1, "district": 1, "state": 1, "role": 1,
         "subscription_plan": 1,
         # `profile_picture_present` is a boolean maintained on the doc
         # (see Task 2 / migration). Fallback: MongoDB `$type` projection
         # is not supported via Motor's find(); we simply check truthiness
         # against a "profile_picture_url" or "has_profile_picture" field
         # if present. Otherwise `has_avatar` will be False — acceptable
         # UX regression (avatar dot not shown) vs. multi-MB payload.
         "has_profile_picture": 1,
         "profile_picture_url": 1}
    ).to_list(len(user_ids))}

    # PRC rate
    try:
        from utils.helpers import get_prc_rate
        prc_rate = float(await get_prc_rate(db)) or 13.0
    except Exception:
        prc_rate = 13.0

    # Sort by accurate totals
    sorted_accurate = sorted(accurate.items(), key=lambda x: -x[1])

    leaderboard = []
    rank = 0
    for uid, prc in sorted_accurate:
        if len(leaderboard) >= limit:
            break
        user = user_docs.get(uid)
        if not user:
            continue
        if user.get("role") == "admin":
            continue
        if prc <= 0:
            continue
        rank += 1
        leaderboard.append({
            "rank": rank,
            "user_id": uid,
            "name_masked": _mask_name(user.get("name"), user.get("first_name")),
            "city": _city_for(user),
            "total_redeemed_prc": round(prc, 2),
            "total_redeemed_inr": round(prc / prc_rate, 2) if prc_rate else 0,
            "subscription_plan": user.get("subscription_plan", "explorer"),
            "has_avatar": bool(user.get("has_profile_picture") or user.get("profile_picture_url")),
        })

    _TOP_REDEEMERS_CACHE["ts"] = int(now) if leaderboard else int(now) - _TOP_REDEEMERS_TTL + 60  # don't cache empty for >60s
    _TOP_REDEEMERS_CACHE["data"] = leaderboard
    return {
        "leaderboard": leaderboard,
        "cached": False,
        "refreshed_at": int(now),
        "prc_rate": prc_rate,
    }

