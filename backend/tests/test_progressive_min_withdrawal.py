"""Tests for the progressive minimum-withdrawal feature.

Rules (May 2026):
  • Base: ₹100
  • Going forward: next_min = max(BASE, ceil(last_amount × 1.5))
  • Legacy (no stored field but prior approved redeems): max(BASE, ceil(lifetime_total × 1.5))
"""
import asyncio
import math
import os
import pytest
import pytest_asyncio
import sys
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")

# Import after path mutation
import routes.manual_bank_transfer as mbt  # noqa: E402

MULT = mbt.PROGRESSIVE_MULTIPLIER
BASE = mbt.MIN_WITHDRAWAL_BASE


@pytest_asyncio.fixture
async def db():
    """Real Mongo connection (preview DB) — we use a sandboxed UID so we never collide with prod users."""
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    # Ensure helpers see the same DB
    mbt.db = database
    yield database
    # Cleanup test data
    await database.users.delete_many({"uid": {"$regex": "^prog_min_test_"}})
    await database.bank_transfer_requests.delete_many({"user_id": {"$regex": "^prog_min_test_"}})
    client.close()


@pytest.mark.asyncio
async def test_brand_new_user_returns_base(db):
    """A user with zero approved redeems should see min = base (₹100)."""
    uid = "prog_min_test_new"
    await db.users.insert_one({"uid": uid, "email": f"{uid}@test.local"})
    result = await mbt.compute_progressive_min_withdrawal(uid)
    assert result["minimum"] == BASE
    assert result["basis"] == "base"
    assert result["total_approved_count"] == 0


@pytest.mark.asyncio
async def test_legacy_user_uses_total_x_1_5(db):
    """A pre-feature user with prior approved redeems should bootstrap from lifetime total × 1.5."""
    uid = "prog_min_test_legacy"
    await db.users.insert_one({"uid": uid, "email": f"{uid}@test.local"})
    # Two old approved redeems: ₹1000 + ₹2000 = ₹3000 total → min should be 4500
    await db.bank_transfer_requests.insert_many([
        {"user_id": uid, "status": "paid", "withdrawal_amount": 1000, "request_id": "L1"},
        {"user_id": uid, "status": "approved", "withdrawal_amount": 2000, "request_id": "L2"},
    ])
    result = await mbt.compute_progressive_min_withdrawal(uid)
    expected = math.ceil(3000 * MULT)
    assert result["minimum"] == expected, f"got {result['minimum']} expected {expected}"
    assert result["basis"] == "legacy_total"
    assert result["total_approved_amount"] == 3000


@pytest.mark.asyncio
async def test_stored_field_takes_precedence(db):
    """If user.next_min_withdrawal_inr is set, that wins (going-forward behaviour)."""
    uid = "prog_min_test_stored"
    await db.users.insert_one({"uid": uid, "email": f"{uid}@test.local", "next_min_withdrawal_inr": 7500})
    await db.bank_transfer_requests.insert_one(
        {"user_id": uid, "status": "paid", "withdrawal_amount": 5000, "request_id": "S1"}
    )
    result = await mbt.compute_progressive_min_withdrawal(uid)
    assert result["minimum"] == 7500
    assert result["basis"] == "stored"


@pytest.mark.asyncio
async def test_base_floor_protects_tiny_amounts(db):
    """If total_redeemed × 1.5 < BASE, floor at BASE."""
    uid = "prog_min_test_tiny"
    await db.users.insert_one({"uid": uid, "email": f"{uid}@test.local"})
    await db.bank_transfer_requests.insert_one(
        {"user_id": uid, "status": "paid", "withdrawal_amount": 50, "request_id": "T1"}
    )
    result = await mbt.compute_progressive_min_withdrawal(uid)
    # 50 × 1.5 = 75 < BASE(100) — must floor to 100
    assert result["minimum"] == BASE


@pytest.mark.asyncio
async def test_next_minimum_preview_compounds(db):
    """next_minimum_preview should be current_min × 1.5."""
    uid = "prog_min_test_preview"
    await db.users.insert_one({"uid": uid, "email": f"{uid}@test.local", "next_min_withdrawal_inr": 1000})
    result = await mbt.compute_progressive_min_withdrawal(uid)
    assert result["minimum"] == 1000
    assert result["next_minimum_preview"] == math.ceil(1000 * MULT)  # 1500


@pytest.mark.asyncio
async def test_user_example_1000_then_1500(db):
    """User's literal example: redeem 1000 → next min = 1500."""
    uid = "prog_min_test_example"
    await db.users.insert_one({"uid": uid, "email": f"{uid}@test.local"})
    # Simulate first approved redeem of ₹1000 and the floor update that mark-paid would write
    new_floor = max(BASE, math.ceil(1000 * MULT))
    await db.users.update_one({"uid": uid}, {"$set": {"next_min_withdrawal_inr": new_floor}})
    result = await mbt.compute_progressive_min_withdrawal(uid)
    assert result["minimum"] == 1500
    assert result["next_minimum_preview"] == 2250  # 1500 × 1.5


@pytest.mark.asyncio
async def test_maximum_always_above_minimum(db):
    """Bug fix (June 2026): maximum must never be < minimum.

    Previously MAX_WITHDRAWAL was a static ₹10,000 cap, so legacy users with
    minimum=30,000 saw the impossible state "Min ₹30,000 – Max ₹10,000".
    """
    uid = "prog_min_test_maxfix"
    await db.users.insert_one({"uid": uid, "email": f"{uid}@test.local", "next_min_withdrawal_inr": 30000})
    result = await mbt.compute_progressive_min_withdrawal(uid)
    assert result["minimum"] == 30000
    assert result["maximum"] >= result["minimum"], "maximum must always be >= minimum"
    # With 2× headroom, max should be 60,000 (above legacy MAX 10,000)
    assert result["maximum"] == 60000


@pytest.mark.asyncio
async def test_maximum_is_legacy_cap_for_small_minimums(db):
    """When minimum is small, maximum stays at MAX_WITHDRAWAL (₹10,000)."""
    uid = "prog_min_test_small_max"
    await db.users.insert_one({"uid": uid, "email": f"{uid}@test.local"})
    result = await mbt.compute_progressive_min_withdrawal(uid)
    assert result["minimum"] == 100
    # 2 × 100 = 200, but MAX_WITHDRAWAL is 10000, so max = 10000
    assert result["maximum"] == mbt.MAX_WITHDRAWAL


if __name__ == "__main__":
    # Allow direct execution for fast local feedback
    pytest.main([__file__, "-v", "-s"])
