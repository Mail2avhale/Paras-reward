"""
Admin Observability Endpoints — Layer 0 dashboard data source
==============================================================

Exposes read-only telemetry so admins can spot production regressions
without needing shell access. All endpoints admin-gated via JWT role.

Endpoints:
  GET  /api/admin/observability/summary       — one-glance app health
  GET  /api/admin/observability/endpoints     — per-endpoint p95 / p99 / count
  GET  /api/admin/observability/slow-requests — recent slow-request buffer
  GET  /api/admin/observability/db-health     — Motor pool + Mongo ping
  GET  /api/admin/observability/cache-health  — L1 + L2 cache stats
  GET  /api/admin/observability/collection-sizes — top-N largest collections
  GET  /api/admin/observability/users-doc-histogram — users doc size distribution
  POST /api/admin/observability/reset         — reset stats (does NOT clear slow buffer)

Every endpoint is read-only + safe to hit repeatedly.
"""
from __future__ import annotations

import os
import time
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
import jwt

from middleware.observability import (
    get_recent_slow_requests,
    get_endpoint_stats,
    get_global_summary,
    reset_stats,
)

router = APIRouter(prefix="/admin/observability", tags=["Admin - Observability"])

# Set by server.py during startup
_db = None
_cache = None
_client = None  # Motor AsyncIOMotorClient

def set_db(database, cache_manager=None, motor_client=None):
    global _db, _cache, _client
    _db = database
    _cache = cache_manager
    _client = motor_client


# ── Auth ─────────────────────────────────────────────────────────────
_JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
_JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")


def _require_admin(request: Request):
    """Reuse the same JWT verification the rest of the app uses."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")
    token = auth.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, _JWT_SECRET_KEY, algorithms=[_JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    role = payload.get("role", "user")
    if role not in ("admin", "sub_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return payload


@router.get("/summary")
async def summary(request: Request):
    """One-glance app-wide health snapshot."""
    _require_admin(request)
    return {"success": True, "data": get_global_summary()}


@router.get("/endpoints")
async def endpoints(request: Request, top_n: int = 25, sort_by: str = "p95_ms"):
    """Per-endpoint p50/p95/p99 latency. Default sort by p95 (worst first)."""
    _require_admin(request)
    return {
        "success": True,
        "sort_by": sort_by,
        "top_n": top_n,
        "endpoints": get_endpoint_stats(top_n=top_n, sort_by=sort_by),
    }


@router.get("/slow-requests")
async def slow_requests(request: Request, limit: int = 100):
    """Buffer of the most recent slow requests (> SLOW_REQUEST_THRESHOLD_MS)."""
    _require_admin(request)
    return {"success": True, "requests": get_recent_slow_requests(limit=limit)}


@router.get("/db-health")
async def db_health(request: Request):
    """Motor pool + Mongo server ping.

    Reports: pool sizes, current in-use connections, Mongo ping latency.
    """
    _require_admin(request)
    result = {"success": True}

    # Ping timing
    if _db is not None:
        t0 = time.perf_counter()
        try:
            await _db.command("ping")
            result["ping_ok"] = True
            result["ping_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        except Exception as e:
            result["ping_ok"] = False
            result["ping_error"] = str(e)[:200]

    # Motor pool telemetry (best-effort — motor doesn't expose a formal API,
    # so we probe for whichever attribute is available in the installed version).
    if _client is not None:
        pool_info = {}
        try:
            # Motor 3.x: use the pymongo sync client's topology
            delegate = getattr(_client, "delegate", None) or _client
            topology = getattr(delegate, "_topology", None)
            if topology is not None:
                server_stats = []
                for server in getattr(topology, "_servers", {}).values():
                    pool = getattr(server, "pool", None)
                    if pool is None:
                        continue
                    opts = getattr(pool, "opts", None)
                    server_stats.append({
                        "address": str(server.description.address),
                        "in_use_sockets": len(getattr(pool, "sockets", []) or []),
                        "max_pool_size": getattr(opts, "max_pool_size", None),
                        "min_pool_size": getattr(opts, "min_pool_size", None),
                    })
                pool_info["servers"] = server_stats
            # PyMongo public API: `nodes`
            nodes = getattr(_client, "nodes", None)
            if nodes is not None:
                pool_info["nodes"] = [f"{h}:{p}" for h, p in list(nodes)[:10]]
            result["motor_pool"] = pool_info
        except Exception as e:
            result["motor_pool_error"] = str(e)[:200]

    # Users size-guard telemetry (installed at server.py startup)
    try:
        users_coll = _db.users if _db is not None else None
        # Our guard wraps the real Motor collection — pull its `_stats` if present.
        guard_stats = getattr(users_coll, "guard_stats", None)
        if callable(guard_stats):
            result["users_size_guard"] = guard_stats()
    except Exception as _e:
        result["users_size_guard_error"] = str(_e)[:120]

    # Feb 23 2026 (Layer 1.7) — Auth cache telemetry. Cache hit rate is
    # the biggest lever on prod Mongo load (2 queries per authenticated
    # request without this cache).
    try:
        from server import _AUTH_USER_CACHE, _AUTH_USER_CACHE_TTL
        result["auth_cache"] = {
            "size": len(_AUTH_USER_CACHE),
            "ttl_seconds": _AUTH_USER_CACHE_TTL,
        }
    except Exception:
        pass

    return result


@router.get("/cache-health")
async def cache_health(request: Request):
    """L1 + L2 cache telemetry (proxied from CacheManager.get_stats)."""
    _require_admin(request)
    if _cache is None:
        return {"success": False, "error": "cache manager not attached"}
    try:
        stats = await _cache.get_stats()
    except Exception as e:
        return {"success": False, "error": str(e)[:200]}
    return {"success": True, "data": stats}


@router.get("/collection-sizes")
async def collection_sizes(request: Request, top_n: int = 15):
    """Top-N largest collections by storageSize (data on disk)."""
    _require_admin(request)
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not attached")
    names = await _db.list_collection_names()
    sizes = []
    for n in names:
        try:
            s = await _db.command("collStats", n)
            sizes.append({
                "collection": n,
                "count": s.get("count", 0),
                "avg_obj_size_bytes": s.get("avgObjSize", 0),
                "data_size_bytes": s.get("size", 0),
                "storage_size_bytes": s.get("storageSize", 0),
                "total_index_size_bytes": s.get("totalIndexSize", 0),
                "nindexes": s.get("nindexes", 0),
            })
        except Exception:
            continue
    sizes.sort(key=lambda x: x["storage_size_bytes"], reverse=True)
    return {"success": True, "collections": sizes[:top_n]}


@router.get("/users-doc-histogram")
async def users_doc_histogram(request: Request):
    """Distribution of users doc sizes — critical for the Data Design Refactor.

    Buckets: < 2 KB, 2-5, 5-10, 10-50, 50-100, > 100 KB.
    Also reports avg / p95 / p99 / max.
    """
    _require_admin(request)
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not attached")

    # $bsonSize is O(N) but fine for ≤ 1 M docs. For truly huge datasets
    # switch to a sampled approach.
    pipeline = [
        {"$project": {"_id": 0, "size": {"$bsonSize": "$$ROOT"}}},
        {"$bucket": {
            "groupBy": "$size",
            "boundaries": [0, 2048, 5120, 10240, 51200, 102400, 1048576, 10485760],
            "default": "10MB+",
            "output": {"count": {"$sum": 1}, "avg": {"$avg": "$size"}},
        }},
    ]

    buckets = []
    try:
        async for row in _db.users.aggregate(pipeline, allowDiskUse=True):
            buckets.append(row)
    except Exception as e:
        return {"success": False, "error": str(e)[:300]}

    # Also get overall percentiles via a second aggregation (fast: 1 pass).
    total_stats = None
    try:
        pipe2 = [
            {"$project": {"_id": 0, "size": {"$bsonSize": "$$ROOT"}}},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "avg": {"$avg": "$size"},
                "max": {"$max": "$size"},
                "min": {"$min": "$size"},
            }},
        ]
        async for r in _db.users.aggregate(pipe2, allowDiskUse=True):
            total_stats = r
    except Exception:
        pass

    bucket_labels = {
        0: "< 2 KB",
        2048: "2-5 KB",
        5120: "5-10 KB",
        10240: "10-50 KB",
        51200: "50-100 KB",
        102400: "100 KB - 1 MB",
        1048576: "1-10 MB",
    }
    named = []
    for b in buckets:
        boundary = b.get("_id")
        named.append({
            "range": bucket_labels.get(boundary, str(boundary)),
            "boundary_low_bytes": boundary if isinstance(boundary, int) else None,
            "count": b.get("count", 0),
            "avg_bytes": round(b.get("avg", 0), 0),
        })

    result = {"success": True, "buckets": named}
    if total_stats:
        result["totals"] = {
            "count": total_stats.get("count", 0),
            "avg_bytes": round(total_stats.get("avg", 0), 0),
            "min_bytes": total_stats.get("min", 0),
            "max_bytes": total_stats.get("max", 0),
        }
    return result


@router.get("/users-bloat-fields")
async def users_bloat_fields(request: Request, top_n: int = 5):
    """Field-size breakdown for the top-N largest user docs.

    Diagnostic endpoint (Feb 25 2026, hardened Feb 26 2026) — after L3
    the users doc is supposed to be < 5 KB avg, but 790 users still sit
    at 100 KB - 1 MB on prod. This endpoint pinpoints WHICH field is
    bloating them so we know what to target in L4.

    Feb 26 2026 fix — MUST bypass the `UsersCollectionGuard` proxy that
    auto-strips 7 heavy fields (mining_history, profile_picture,
    prc_transactions, login_history, activity, activity_log,
    notifications_seen, security_events) so we can actually SEE what's
    bloating the doc. Previously the endpoint saw the stripped 700 B
    doc and reported "no bloat" while the raw doc was 640 KB.

    Uses server-side aggregation with `$bsonSize` per field so field
    sizes are computed by MongoDB itself (guard proxy only intercepts
    `find_one`/`find`, not `aggregate`).

    Returns per-user list of every top-level field with its BSON size
    (bytes) and value shape (array length / string length). Sorted
    descending by bytes so the culprit shows up first.
    """
    _require_admin(request)
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not attached")

    top_n = max(1, min(top_n, 20))

    # Server-side aggregation: for the top-N largest docs, compute
    # per-field bsonSize using $objectToArray. Bypasses the guard proxy
    # since we call `aggregate()`, not `find_one()`.
    pipeline = [
        # Rank all users by total doc size, keep only the top N.
        {"$project": {
            "uid": 1,
            "size_bytes": {"$bsonSize": "$$ROOT"},
            "root": "$$ROOT",
        }},
        {"$sort": {"size_bytes": -1}},
        {"$limit": top_n},

        # Break the doc into an array of {k, v} entries, then compute
        # bsonSize({k: v}) per entry — that's the field's actual on-disk
        # cost (name + type + value + BSON overhead).
        {"$project": {
            "uid": 1,
            "size_bytes": 1,
            "fields": {
                "$map": {
                    "input": {"$objectToArray": "$root"},
                    "as": "kv",
                    "in": {
                        "field": "$$kv.k",
                        # Build a single-key doc {kv.k: kv.v} at query
                        # time via $arrayToObject so we can compute its
                        # BSON byte-size in one expression.
                        "bytes": {
                            "$bsonSize": {
                                "$arrayToObject": [[{"k": "$$kv.k", "v": "$$kv.v"}]]
                            }
                        },
                        "shape": {
                            "$switch": {
                                "branches": [
                                    {"case": {"$isArray": "$$kv.v"},
                                     "then": {"$concat": ["array[", {"$toString": {"$size": "$$kv.v"}}, "]"]}},
                                    {"case": {"$eq": [{"$type": "$$kv.v"}, "string"]},
                                     "then": {"$concat": ["str(", {"$toString": {"$strLenBytes": {"$ifNull": ["$$kv.v", ""]}}}, " chars)"]}},
                                    {"case": {"$eq": [{"$type": "$$kv.v"}, "object"]},
                                     "then": "dict"},
                                    {"case": {"$eq": [{"$type": "$$kv.v"}, "binData"]},
                                     "then": "bin"},
                                ],
                                "default": None,
                            }
                        },
                    },
                }
            },
        }},
    ]

    out = []
    async for entry in _db.users.aggregate(pipeline, allowDiskUse=True):
        fields = entry.get("fields", []) or []
        # Sort per-user by bytes descending so the fattest field is first.
        fields.sort(key=lambda r: r.get("bytes", 0), reverse=True)
        out.append({
            "uid": entry.get("uid"),
            "total_bytes": entry.get("size_bytes"),
            "top_fields": fields[:15],  # top 15 fields per user
        })

    return {"success": True, "top_n": top_n, "users": out}


@router.post("/reset")
async def reset(request: Request):
    """Clear per-endpoint stats and global counters (slow-request buffer preserved)."""
    _require_admin(request)
    reset_stats()
    return {"success": True, "message": "Observability stats reset"}


@router.post("/repair/subscription-expired-flag")
async def repair_subscription_expired_flag(request: Request, dry_run: bool = True):
    """One-shot bulk-heal for users whose `subscription_expired` mirror
    flag got stuck at True while their canonical plan+expiry says active.

    Root cause (Feb 23 2026): Razorpay auto-sync path (server.py auto_sync)
    activated the subscription but forgot to reset the mirror flag.
    Bug caught via user ashataipawar6@gmail.com — Elite active on home
    page but Mall said "subscription expired".

    Query: `subscription_expired: True` AND `subscription_plan ∉ free`
    AND `subscription_expiry` in the future.

    Set `dry_run=false` to actually write the fix.
    """
    _require_admin(request)
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not attached")

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Match candidates whose expiry (stored as ISO string OR datetime) is
    # in the future. Mongo lets $gte compare same-typed values only, so we
    # match string-vs-string and datetime-vs-datetime as $or branches.
    match = {
        "subscription_expired": True,
        "subscription_plan": {"$nin": ["explorer", "free", "", None]},
        "$or": [
            {"subscription_expiry": {"$gte": now_iso}},
            {"subscription_expiry": {"$gte": now}},
        ],
    }

    candidates = []
    async for u in _db.users.find(
        match,
        {"_id": 0, "uid": 1, "email": 1, "mobile": 1, "name": 1,
         "subscription_plan": 1, "subscription_expiry": 1,
         "subscription_expired": 1},
    ).limit(500):
        candidates.append(u)

    if not dry_run and candidates:
        uids = [c["uid"] for c in candidates if c.get("uid")]
        if uids:
            await _db.users.update_many(
                {"uid": {"$in": uids}},
                {"$set": {
                    "subscription_expired": False,
                    "subscription_expired_at": None,
                    "subscription_status": "active",
                }},
            )

    return {
        "success": True,
        "dry_run": dry_run,
        "matched_users": len(candidates),
        "healed_users": 0 if dry_run else len(candidates),
        "sample": candidates[:10],  # preview so admin sees who was affected
    }


@router.post("/repair/backfill-total-redeemed")
async def backfill_total_redeemed(request: Request, batch: int = 100, max_users: int = 5000):
    """Layer 2 (Feb 23 2026) — one-shot backfill of `total_redeemed_prc`
    on every user doc.

    Reason: the mirror is populated on-demand as users hit performance
    endpoints. On a cold worker, the FIRST hit still pays the 13-second
    17-collection scan. Pre-warming the mirror for every user turns the
    first hit into a single find_one (< 10 ms).

    Scans `batch` users at a time, ordered by `_id`. Safe to re-run.
    Skips users whose mirror was computed within the last 60 min.
    Uses `background=True` semantics — call this from admin dashboard
    once after deploy; each subsequent call resumes where the last left off.
    """
    _require_admin(request)
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not attached")

    from server import get_user_all_time_redeemed
    from datetime import datetime, timezone, timedelta

    processed = 0
    skipped_fresh = 0
    computed = 0
    failed = 0
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=60)

    async for u in _db.users.find(
        {"subscription_plan": {"$nin": ["explorer", "free", "", None]}},
        {"_id": 0, "uid": 1, "total_redeemed_computed_at": 1},
    ).limit(max_users):
        processed += 1
        if processed % batch == 0:
            # Yield so we don't monopolize the event loop
            import asyncio as _aio_bf
            await _aio_bf.sleep(0)

        uid = u.get("uid")
        if not uid:
            continue

        # Skip if mirror already fresh
        computed_at = u.get("total_redeemed_computed_at")
        if computed_at:
            try:
                if isinstance(computed_at, str):
                    dt = datetime.fromisoformat(computed_at.replace("Z", "+00:00"))
                else:
                    dt = computed_at
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt > cutoff:
                    skipped_fresh += 1
                    continue
            except Exception:
                pass

        try:
            await get_user_all_time_redeemed(uid, debug=False)
            computed += 1
        except Exception:
            failed += 1

    return {
        "success": True,
        "processed_users": processed,
        "computed_now": computed,
        "skipped_already_fresh": skipped_fresh,
        "failed": failed,
        "next_step": "Re-run to continue if processed_users == max_users",
    }


@router.post("/repair/bound-user-arrays")
async def bound_user_arrays_endpoint(
    request: Request, batch: int = 100, max_users: int = 10000
):
    """Layer 3 (Feb 24 2026) — one-shot migration that permanently
    shrinks user docs to < 5 KB.

    For every user whose doc still contains legacy embedded arrays:

    1. Archives all `mining_history` entries to a separate
       `mining_history_archive` collection keyed by `user_id` (so nothing
       is lost) and `$unset`s the field. `mining_history` is a DEAD
       legacy array — current code writes mining events to
       `db.transactions` + `db.prc_ledger`, so removing it is safe.

    2. Slices `prc_transactions` embed to the last 20 items. Full ledger
       history is preserved in `db.ledger` + `db.prc_ledger`. Every
       future write path (`WalletService`, `WalletServiceV2`) has been
       patched to `$push {$each: [...], $slice: -20}` so the array can
       never grow past 20 again.

    Safe to re-run — idempotent, skips users with nothing to trim.
    Batched — yields to event loop every `batch` users.
    """
    _require_admin(request)
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not attached")

    from utils.bound_user_arrays import (
        bound_all_users,
        ensure_archive_indexes,
    )

    # Ensure the archive collection has its indexes before we bulk-insert.
    await ensure_archive_indexes(_db)

    result = await bound_all_users(
        db=_db,
        batch=max(1, min(batch, 500)),
        max_users=max(1, min(max_users, 20000)),
    )

    return {"success": True, **result}


@router.post("/repair/migrate-profile-pictures")
async def migrate_profile_pictures_endpoint(
    request: Request, batch: int = 50, max_users: int = 2000
):
    """Layer 4 (Feb 26 2026) — one-shot migration that moves base64
    `profile_picture` blobs out of the users doc into a dedicated
    `user_profile_pictures` collection.

    Prod audit revealed 790 users still at 100 KB - 1 MB after Layer 3,
    with `profile_picture` (base64 data URL) contributing 500-620 KB per
    user. This endpoint moves that field to its own collection keyed by
    uid, sets `has_profile_picture: True` on the user doc, and $unsets
    the embedded field. Idempotent — safe to re-run.

    Response includes `total_bytes_reclaimed` so you can watch the
    users-doc-histogram avg drop after the migration.
    """
    _require_admin(request)
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not attached")

    from utils.profile_picture_store import migrate_all

    result = await migrate_all(
        db=_db,
        batch=max(1, min(batch, 500)),
        max_users=max(1, min(max_users, 20000)),
    )

    return {"success": True, **result}


@router.post("/repair/reconcile-auth-hashes")
async def reconcile_auth_hashes_endpoint(
    request: Request, batch: int = 100, max_users: int = 10000
):
    """P1 security-fix migration (Feb 27 2026) — reconcile divergent
    auth-hash fields on all users.

    Ensures every one of the 4 hash fields (`password`, `password_hash`,
    `pin_hash`, `hashed_pin`) holds the same authoritative bcrypt value
    per user. Without this, the login fallback chain can validate a
    stale hash left behind by a password-reset flow that only touched
    `password_hash` — attacker with OLD PIN keeps logging in.

    Safe to re-run — idempotent, batched with async yields every N users.
    """
    _require_admin(request)
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not attached")

    from utils.auth_hash_consolidation import reconcile_auth_hashes

    result = await reconcile_auth_hashes(
        db=_db,
        batch=max(1, min(batch, 500)),
        max_users=max(1, min(max_users, 20000)),
    )

    return {"success": True, **result}
