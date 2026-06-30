"""
Mall Mining — Active Subscription Gate (Jun 30, 2026)
======================================================

Spec: To accrue/collect PRC on a Mall product booking, the user MUST have an
ACTIVE paid subscription (plan ∈ Startup/Growth/Elite AND not expired).

Tested:
1. helper `assert_active_subscription_for_mining` raises 403 for explorer / expired
2. paid+active user passes the gate (no 403 from the gate itself)
3. live HTTP test of /api/mall/start-session being gated
"""
import os
import asyncio
import pytest
from datetime import datetime, timezone, timedelta

# Bootstrap env for direct helper invocation
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path("/app/backend/.env"))

import sys
sys.path.insert(0, "/app/backend")

from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import HTTPException


@pytest.fixture(scope="module")
def async_db():
    """Module-scoped Motor async db, bound to a single event loop."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = AsyncIOMotorClient(os.environ["MONGO_URL"], io_loop=loop)
    yield loop, client[os.environ["DB_NAME"]]
    loop.close()


def _run(loop, coro):
    return loop.run_until_complete(coro)


def test_helper_blocks_explorer_user(async_db):
    """Plan ∈ free/explorer → 403."""
    loop, db = async_db
    import routes.paras_mall as pm
    pm.db = db

    async def run():
        uid = f"test-explorer-{int(datetime.now().timestamp() * 1000)}"
        await db.users.insert_one({
            "uid": uid, "subscription_plan": "explorer",
            "name": "Test Explorer", "mobile": "9999999998", "email": f"explorer-{uid}@test.com",
        })
        try:
            with pytest.raises(HTTPException) as exc:
                await pm.assert_active_subscription_for_mining(uid)
            assert exc.value.status_code == 403
            assert "subscription" in exc.value.detail.lower()
        finally:
            await db.users.delete_one({"uid": uid})

    _run(loop, run())


def test_helper_blocks_expired_user(async_db):
    """Paid plan but expiry < now → 403."""
    loop, db = async_db
    import routes.paras_mall as pm
    pm.db = db

    async def run():
        uid = f"test-expired-{int(datetime.now().timestamp() * 1000)}"
        past = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        await db.users.insert_one({
            "uid": uid, "subscription_plan": "startup",
            "subscription_expiry": past,
            "name": "Test Expired", "email": f"expired-{uid}@test.com",
        })
        try:
            with pytest.raises(HTTPException) as exc:
                await pm.assert_active_subscription_for_mining(uid)
            assert exc.value.status_code == 403
            assert "expired" in exc.value.detail.lower()
        finally:
            await db.users.delete_one({"uid": uid})

    _run(loop, run())


def test_helper_blocks_subscription_expired_flag(async_db):
    """`subscription_expired: True` hard-flag → 403."""
    loop, db = async_db
    import routes.paras_mall as pm
    pm.db = db

    async def run():
        uid = f"test-flagged-{int(datetime.now().timestamp() * 1000)}"
        await db.users.insert_one({
            "uid": uid, "subscription_plan": "growth",
            "subscription_expired": True,
            "name": "Test Flagged", "email": f"flagged-{uid}@test.com",
        })
        try:
            with pytest.raises(HTTPException) as exc:
                await pm.assert_active_subscription_for_mining(uid)
            assert exc.value.status_code == 403
        finally:
            await db.users.delete_one({"uid": uid})

    _run(loop, run())


def test_helper_allows_active_paid_user(async_db):
    """startup/growth/elite + future expiry → passes silently."""
    loop, db = async_db
    import routes.paras_mall as pm
    pm.db = db

    async def run():
        uid = f"test-active-{int(datetime.now().timestamp() * 1000)}"
        future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        await db.users.insert_one({
            "uid": uid, "subscription_plan": "startup",
            "subscription_expiry": future,
            "name": "Test Active", "email": f"active-{uid}@test.com",
        })
        try:
            # No exception expected
            await pm.assert_active_subscription_for_mining(uid)
        finally:
            await db.users.delete_one({"uid": uid})

    _run(loop, run())


def test_endpoint_gates_via_live_http(async_db):
    """Live test: hit /api/mall/start-session via HTTP for an explorer user."""
    loop, db = async_db
    import requests
    BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "")
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")

    async def setup():
        uid = f"test-mine-gate-{int(datetime.now().timestamp() * 1000)}"
        await db.users.insert_one({
            "uid": uid, "subscription_plan": "explorer",
            "name": "Mining Gate Test", "mobile": "9999999990", "email": f"mine-{uid}@test.com",
            "prc_balance": 100000,
        })
        bid = f"bk-mine-gate-{int(datetime.now().timestamp() * 1000)}"
        await db.mall_bookings.insert_one({
            "booking_id": bid, "user_id": uid,
            "product_name": "Test Item", "mrp_inr": 1000,
            "total_prc": 10000, "upfront_prc": 1000,
            "paid_prc": 0, "remaining_prc": 10000,
            "status": "mining",
            "created_at": datetime.now(timezone.utc),
        })
        return uid, bid

    uid, bid = _run(loop, setup())
    try:
        r = requests.post(
            f"{BASE_URL}/api/mall/start-session/{bid}",
            json={"user_id": uid},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        detail = (r.json().get("detail") or "").lower()
        assert "subscription" in detail or "activate" in detail
    finally:
        _run(loop, db.users.delete_one({"uid": uid}))
        _run(loop, db.mall_bookings.delete_one({"booking_id": bid}))

