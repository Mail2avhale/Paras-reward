"""
Cache Health Endpoints (Feb 20, 2026)
=====================================
Expose real-time Redis cache health, hit-rate metrics, and circuit
breaker state so admins can spot outages without SSH'ing into logs.

The endpoints live at /api/admin/cache/* — protected by the existing
admin-only middleware in server.py + the X-Admin-Pin header used by
other sensitive admin ops.
"""
from __future__ import annotations

import os
from fastapi import APIRouter, Header, HTTPException

from cache_manager import cache


router = APIRouter(prefix="/admin/cache", tags=["Admin — Cache Health"])


def _require_admin_pin(x_admin_pin: str) -> None:
    expected = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected or x_admin_pin != expected:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")


@router.get("/health")
async def cache_health(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    """Full cache health snapshot — connection type, hit rate, circuit
    breaker state, error/timeout counters, Mongo-fallback counter.

    This is the primary endpoint for the admin cache monitoring page.
    """
    _require_admin_pin(x_admin_pin)
    stats = await cache.get_stats()
    counters = stats.get("counters", {})
    total_reads = counters.get("hits", 0) + counters.get("misses", 0)
    total_errors = counters.get("errors", 0)
    error_rate = round((total_errors / total_reads) * 100.0, 2) if total_reads else 0.0
    # Derive a simple health verdict.
    breaker = stats.get("circuit_breaker", {})
    if breaker.get("state") == "open":
        health = "degraded"
    elif error_rate > 5.0:
        health = "warning"
    elif total_reads == 0:
        health = "idle"
    else:
        health = "healthy"
    stats["derived"] = {
        "health": health,
        "error_rate_pct": error_rate,
        "total_reads": total_reads,
    }
    return {"success": True, **stats}


@router.post("/reset-counters")
async def cache_reset_counters(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    """Zero out all counters (hits/misses/errors/etc). Data untouched.
    Useful after an incident to establish a clean baseline.
    """
    _require_admin_pin(x_admin_pin)
    cache.reset_counters()
    return {"success": True, "message": "Cache counters reset."}


@router.post("/flush")
async def cache_flush(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    """Danger-zone: flush ALL cached data. Redis and in-memory both.
    Next request rebuilds from Mongo. Use during incident recovery when
    you suspect stale cache is masking a fix.
    """
    _require_admin_pin(x_admin_pin)
    ok = await cache.flush_all()
    return {"success": bool(ok), "message": "Cache flushed."}
