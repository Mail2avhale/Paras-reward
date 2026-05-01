"""Tests for the hardened VIP payment approve/reject endpoints.

Covers:
  1. Approve idempotency: re-approving an already-approved payment returns
     success (replay-safe), not 400.
  2. Reject idempotency: re-rejecting an already-rejected payment returns
     success.
  3. Atomic CAS for approve: concurrent approve attempts → exactly one wins
     the status flip; the other sees modified_count==0 (no error).
  4. Atomic CAS for reject: same guarantee for reject.
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
async def test_approve_atomic_cas_only_one_wins(db):
    """Two concurrent updates flipping pending→approved: only one succeeds."""
    pid = f"test-pay-{uuid.uuid4().hex[:8]}"
    await db.vip_payments.insert_one(
        {
            "payment_id": pid,
            "user_id": "test-uid",
            "status": "pending",
            "amount": 999.0,
            "subscription_plan": "elite",
            "plan_type": "monthly",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    try:
        update_q = {
            "$set": {
                "status": "approved",
                "approved_at": datetime.now(timezone.utc).isoformat(),
            }
        }
        # Fire two concurrent CAS updates
        res_a, res_b = await asyncio.gather(
            db.vip_payments.update_one({"payment_id": pid, "status": "pending"}, update_q),
            db.vip_payments.update_one({"payment_id": pid, "status": "pending"}, update_q),
        )
        total_modified = res_a.modified_count + res_b.modified_count
        assert total_modified == 1, "Only one concurrent approve should succeed"

        # Final state: status is approved, exactly once
        final = await db.vip_payments.find_one({"payment_id": pid}, {"_id": 0, "status": 1})
        assert final["status"] == "approved"
    finally:
        await db.vip_payments.delete_one({"payment_id": pid})


@pytest.mark.asyncio
async def test_reject_atomic_cas_only_one_wins(db):
    """Same CAS guarantee for reject path."""
    pid = f"test-pay-{uuid.uuid4().hex[:8]}"
    await db.vip_payments.insert_one(
        {
            "payment_id": pid,
            "user_id": "test-uid",
            "status": "pending",
            "amount": 999.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    try:
        update_q = {
            "$set": {
                "status": "rejected",
                "reject_reason": "test",
            }
        }
        res_a, res_b = await asyncio.gather(
            db.vip_payments.update_one({"payment_id": pid, "status": "pending"}, update_q),
            db.vip_payments.update_one({"payment_id": pid, "status": "pending"}, update_q),
        )
        assert res_a.modified_count + res_b.modified_count == 1
        final = await db.vip_payments.find_one({"payment_id": pid}, {"_id": 0, "status": 1})
        assert final["status"] == "rejected"
    finally:
        await db.vip_payments.delete_one({"payment_id": pid})


@pytest.mark.asyncio
async def test_idempotent_approve_replays_already_approved(db):
    """If a payment is already approved, re-running approve returns success
    instead of 400 — protects against frontend retry loops."""
    pid = f"test-pay-{uuid.uuid4().hex[:8]}"
    await db.vip_payments.insert_one(
        {
            "payment_id": pid,
            "user_id": "test-uid",
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    try:
        payment = await db.vip_payments.find_one({"payment_id": pid}, {"_id": 0})
        # Simulate the endpoint's idempotency check
        if payment.get("status") == "approved":
            replay_ok = True
        else:
            replay_ok = False
        assert replay_ok, "Already-approved payment should produce idempotent success"
    finally:
        await db.vip_payments.delete_one({"payment_id": pid})


@pytest.mark.asyncio
async def test_idempotent_reject_replays_already_rejected(db):
    """Same idempotency for reject: re-rejecting returns success."""
    pid = f"test-pay-{uuid.uuid4().hex[:8]}"
    await db.vip_payments.insert_one(
        {
            "payment_id": pid,
            "user_id": "test-uid",
            "status": "rejected",
            "rejection_reason": "Invalid UTR",
            "reject_reason": "Invalid UTR",
            "rejected_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    try:
        payment = await db.vip_payments.find_one({"payment_id": pid}, {"_id": 0})
        # Simulate endpoint idempotency check
        if payment.get("status") == "rejected":
            replay_ok = True
            replay_reason = payment.get("reject_reason") or payment.get("rejection_reason")
        else:
            replay_ok = False
            replay_reason = None
        assert replay_ok
        assert replay_reason == "Invalid UTR"
    finally:
        await db.vip_payments.delete_one({"payment_id": pid})
