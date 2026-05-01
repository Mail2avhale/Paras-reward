"""Integration tests for PRC Subscription double-charge race guard.

Covers:
  1. Atomic CAS: same filter passes for one request, fails for the
     concurrent second request within 7-day window (modified_count == 0).
  2. Idempotency key: duplicate client_request_id returns cached response,
     does not re-execute.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    yield database
    client.close()


@pytest.mark.asyncio
async def test_atomic_cas_rejects_second_concurrent_deduction(db):
    """The atomic CAS filter must allow exactly ONE of two concurrent deductions.

    Simulates the double-click race at the DB level: both requests see a
    user with sufficient balance and no recent subscription. Only one
    should succeed; the second must hit modified_count == 0.
    """
    uid = f"cas-test-{uuid.uuid4().hex[:8]}"
    # Seed user with plenty of balance and no prior PRC subscription
    await db.users.insert_one(
        {
            "uid": uid,
            "name": "CAS Race Test",
            "email": f"{uid}@t.local",
            "prc_balance": 100_000.0,
            "subscription_expired": True,
        }
    )
    try:
        prc_amount = 18_545.59
        now = datetime.now(timezone.utc)
        seven_days_ago = (now - timedelta(days=7)).isoformat()

        # Build the exact filter used in the production endpoint
        filter_q = {
            "uid": uid,
            "prc_balance": {"$gte": prc_amount},
            "$or": [
                {"last_prc_subscription": {"$exists": False}},
                {"last_prc_subscription": None},
                {"last_prc_subscription": {"$lt": seven_days_ago}},
            ],
        }
        update_q = {
            "$inc": {"prc_balance": -prc_amount},
            "$set": {"last_prc_subscription": now.isoformat()},
        }

        # Fire two concurrent updates (worst case for race)
        res_a, res_b = await asyncio.gather(
            db.users.update_one(filter_q, update_q),
            db.users.update_one(filter_q, update_q),
        )

        total_modified = res_a.modified_count + res_b.modified_count
        assert total_modified == 1, (
            f"Atomic CAS must allow exactly ONE of two concurrent requests; "
            f"got {total_modified}. This is the core double-charge bug."
        )

        # Verify balance deducted exactly once, not twice
        fresh = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1, "last_prc_subscription": 1})
        assert fresh["prc_balance"] == pytest.approx(
            100_000.0 - prc_amount, rel=1e-6
        ), "Balance must be deducted exactly once"
        assert fresh.get("last_prc_subscription") is not None, "Lock timestamp must be set"
    finally:
        await db.users.delete_one({"uid": uid})


@pytest.mark.asyncio
async def test_cas_blocks_second_attempt_within_7_days(db):
    """After first subscription, 2nd attempt within 7 days must fail."""
    uid = f"cas-cooldown-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    three_days_ago = (now - timedelta(days=3)).isoformat()
    await db.users.insert_one(
        {
            "uid": uid,
            "name": "Cooldown Test",
            "email": f"{uid}@t.local",
            "prc_balance": 100_000.0,
            "last_prc_subscription": three_days_ago,  # Active cooldown
        }
    )
    try:
        prc_amount = 18_545.59
        seven_days_ago = (now - timedelta(days=7)).isoformat()
        res = await db.users.update_one(
            {
                "uid": uid,
                "prc_balance": {"$gte": prc_amount},
                "$or": [
                    {"last_prc_subscription": {"$exists": False}},
                    {"last_prc_subscription": None},
                    {"last_prc_subscription": {"$lt": seven_days_ago}},
                ],
            },
            {
                "$inc": {"prc_balance": -prc_amount},
                "$set": {"last_prc_subscription": now.isoformat()},
            },
        )
        assert res.modified_count == 0, "CAS must block subscriptions within 7 days"
    finally:
        await db.users.delete_one({"uid": uid})


@pytest.mark.asyncio
async def test_cas_allows_after_7_days(db):
    """After 7+ days, next subscription must succeed."""
    uid = f"cas-expired-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    eight_days_ago = (now - timedelta(days=8)).isoformat()
    await db.users.insert_one(
        {
            "uid": uid,
            "name": "Expired Cooldown Test",
            "email": f"{uid}@t.local",
            "prc_balance": 100_000.0,
            "last_prc_subscription": eight_days_ago,
        }
    )
    try:
        prc_amount = 18_545.59
        seven_days_ago = (now - timedelta(days=7)).isoformat()
        res = await db.users.update_one(
            {
                "uid": uid,
                "prc_balance": {"$gte": prc_amount},
                "$or": [
                    {"last_prc_subscription": {"$exists": False}},
                    {"last_prc_subscription": None},
                    {"last_prc_subscription": {"$lt": seven_days_ago}},
                ],
            },
            {
                "$inc": {"prc_balance": -prc_amount},
                "$set": {"last_prc_subscription": now.isoformat()},
            },
        )
        assert res.modified_count == 1, "Fresh user after 7 days must be allowed"
    finally:
        await db.users.delete_one({"uid": uid})


@pytest.mark.asyncio
async def test_idempotency_helper_replay(db):
    """The idempotency helper stores response and replays on duplicate key."""
    from routes.idempotency import (
        set_db,
        check_and_claim_idempotency_key,
        store_idempotency_response,
    )

    set_db(db)
    scope = f"test_scope:{uuid.uuid4().hex[:6]}"
    key = f"idem-{uuid.uuid4()}"

    # First call: fresh, should return None
    first = await check_and_claim_idempotency_key(key, scope, ttl_seconds=30)
    assert first is None, "First call must be fresh"

    # While in-flight, duplicate call should get in-flight stub
    inflight = await check_and_claim_idempotency_key(key, scope, ttl_seconds=30)
    assert inflight is not None and inflight.get("_inflight") is True

    # Simulate handler completion
    response = {"success": True, "payment_id": "abc123", "prc_paid": 18_545.59}
    await store_idempotency_response(key, scope, response, ttl_seconds=30)

    # Replay: should return cached response with marker
    replay = await check_and_claim_idempotency_key(key, scope, ttl_seconds=30)
    assert replay is not None
    assert replay.get("success") is True
    assert replay.get("payment_id") == "abc123"
    assert replay.get("_idempotency_replay") is True

    # Cleanup
    await db.idempotency_keys.delete_many({"scope": scope})
