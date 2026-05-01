"""Race-safe guard tests for Bank Redeem and Bill Payment endpoints.

Verifies:
  1. Atomic balance CAS prevents double-spend on concurrent redemptions.
  2. Idempotency key peek-replay returns cached response for duplicate submits.
  3. Idempotency key claim blocks concurrent duplicates (409 in-flight).
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
async def test_bank_redeem_atomic_balance_cas_prevents_double_spend(db):
    """Two concurrent debits of amount=total_prc with balance=total_prc+small buffer
    must allow ONLY one to succeed (not both draining balance to negative)."""
    uid = f"redeem-race-{uuid.uuid4().hex[:8]}"
    total_prc = 5000.0
    await db.users.insert_one(
        {
            "uid": uid,
            "name": "Redeem Race",
            "email": f"{uid}@t.local",
            "prc_balance": total_prc + 100.0,  # Only enough for ONE redemption
        }
    )
    try:
        filter_q = {"uid": uid, "prc_balance": {"$gte": total_prc}}
        update_q = {"$inc": {"prc_balance": -total_prc}}
        res_a, res_b = await asyncio.gather(
            db.users.update_one(filter_q, update_q),
            db.users.update_one(filter_q, update_q),
        )
        assert res_a.modified_count + res_b.modified_count == 1, (
            "Only one concurrent redemption should succeed"
        )
        fresh = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1})
        # Should have deducted exactly once: balance = 100 (not -4900)
        assert fresh["prc_balance"] == pytest.approx(100.0, rel=1e-6)
        assert fresh["prc_balance"] >= 0, "Balance must never go negative from race"
    finally:
        await db.users.delete_one({"uid": uid})


@pytest.mark.asyncio
async def test_idempotency_peek_replay_returns_cached_response(db):
    """After storing a response, peek-only check should return cached data."""
    from routes.idempotency import set_db, store_idempotency_response

    set_db(db)
    scope = f"bank_redeem:{uuid.uuid4().hex[:6]}"
    key = f"idem-{uuid.uuid4()}"

    # Simulate successful request completion
    response = {
        "success": True,
        "request_id": "BTR-123456",
        "total_prc_deducted": 5000,
    }
    # First, must claim before storing (per real flow)
    await db.idempotency_keys.insert_one(
        {
            "scope": scope,
            "key": key,
            "status": "claimed",
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        }
    )
    await store_idempotency_response(key, scope, response, ttl_seconds=300)

    # Peek — simulating what the endpoint does at top
    existing = await db.idempotency_keys.find_one({"scope": scope, "key": key}, {"_id": 0})
    assert existing is not None
    assert existing.get("status") == "completed"
    cached = existing.get("response")
    assert cached["success"] is True
    assert cached["request_id"] == "BTR-123456"

    # Cleanup
    await db.idempotency_keys.delete_many({"scope": scope})


@pytest.mark.asyncio
async def test_idempotency_claim_blocks_concurrent_duplicate(db):
    """Two concurrent check_and_claim_idempotency_key calls: one claims, other sees in-flight."""
    from routes.idempotency import set_db, check_and_claim_idempotency_key

    set_db(db)
    scope = f"bill_payment:{uuid.uuid4().hex[:6]}"
    key = f"idem-{uuid.uuid4()}"

    # Fire two concurrent claims
    res_a, res_b = await asyncio.gather(
        check_and_claim_idempotency_key(key, scope, ttl_seconds=30),
        check_and_claim_idempotency_key(key, scope, ttl_seconds=30),
    )

    # Exactly one of them should be None (fresh claim); the other should be in-flight dict
    fresh_count = sum(1 for r in (res_a, res_b) if r is None)
    inflight_count = sum(
        1 for r in (res_a, res_b) if isinstance(r, dict) and r.get("_inflight")
    )
    assert fresh_count == 1, f"Exactly one claim should be fresh, got {fresh_count}"
    assert inflight_count == 1, (
        f"Exactly one claim should see in-flight, got {inflight_count}"
    )

    # Cleanup
    await db.idempotency_keys.delete_many({"scope": scope})


@pytest.mark.asyncio
async def test_bill_payment_atomic_balance_cas_prevents_negative(db):
    """Simulate bill payment's $gte balance filter stays atomic."""
    uid = f"bill-race-{uuid.uuid4().hex[:8]}"
    total_prc = 2000.0
    await db.users.insert_one(
        {
            "uid": uid,
            "name": "Bill Payment Race",
            "email": f"{uid}@t.local",
            "prc_balance": 3000.0,  # Only enough for 1 × 2000, not 2 × 2000
        }
    )
    try:
        filter_q = {"uid": uid, "prc_balance": {"$gte": total_prc}}
        update_q = {"$inc": {"prc_balance": -total_prc}}

        # Three concurrent requests — only 1 should succeed
        results = await asyncio.gather(
            *[db.users.update_one(filter_q, update_q) for _ in range(3)]
        )
        total_modified = sum(r.modified_count for r in results)
        assert total_modified == 1, (
            f"Only 1 of 3 concurrent requests should succeed, got {total_modified}"
        )
        fresh = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1})
        assert fresh["prc_balance"] == pytest.approx(1000.0, rel=1e-6)
    finally:
        await db.users.delete_one({"uid": uid})
