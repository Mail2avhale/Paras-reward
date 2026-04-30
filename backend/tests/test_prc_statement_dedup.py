"""
Regression: PRC Statement must not show duplicate entries for:
  1. Sustainability Burn (writes to BOTH prc_ledger and transactions with the
     same `reference == transaction_id` — must be deduped via reference fallback).
  2. Admin Force-Activate Elite Subscription via PRC (writes to BOTH
     `transactions` row with type=`subscription_prc_admin_override` AND a
     `subscription_payments` row with payment_method=`prc` — must be deduped
     via the date+amount key in step #5 once both classify as "Subscription").

Bug surfaced 30 Apr 2026 (user screenshot showing two Burn rows + two
Subscription rows for a single admin-override flow).
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from httpx import AsyncClient


MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward_db")
BASE_URL = "http://localhost:8001"

ADMIN_LOGIN = {"identifier": "admin@test.com", "password": "153759"}


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest_asyncio.fixture
async def admin_token():
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        r = await ac.post("/api/auth/login", json=ADMIN_LOGIN)
        r.raise_for_status()
        return r.json().get("token") or r.json().get("access_token")


async def _cleanup_user(db, uid):
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "prc_balance": 0,
            "prc_debt_active": False,
            "prc_debt_original": 0,
            "prc_debt_at": None,
            "prc_debt_reason": None,
            "prc_debt_cleared_at": None,
            "subscription_plan": "explorer",
            "subscription_expiry": None,
            "subscription_expires": None,
            "subscription_expired": True,
            "last_prc_subscription": None,
        }}
    )
    await db.subscription_payments.delete_many({"user_id": uid})
    await db.transactions.delete_many({
        "user_id": uid,
        "type": {"$in": ["subscription_prc_admin_override", "prc_burn"]}
    })
    await db.prc_ledger.delete_many({
        "user_id": uid,
        "type": "auto_burn"
    })
    await db.admin_audit_logs.delete_many({
        "action": "force_activate_elite_prc",
        "entity_id": uid
    })


@pytest.mark.asyncio
async def test_admin_force_activate_no_duplicate_in_prc_statement(db, admin_token):
    """After admin force-activates Elite via PRC, the user's PRC statement
    must show ONE Subscription debit row, NOT two (transactions + subscription_payments).
    """
    target_uid = "admin-test-123"
    await _cleanup_user(db, target_uid)
    # Give them a high balance so burn fires
    await db.users.update_one({"uid": target_uid}, {"$set": {"prc_balance": 50000.0}})

    headers = {"Authorization": f"Bearer {admin_token}"}
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        r = await ac.post(
            "/api/admin/subscription/force-activate-elite-prc",
            json={
                "admin_uid": "admin-test-123",
                "admin_pin": "153759",
                "target_identifier": target_uid,
                "admin_note": "regression dedup test",
            },
            headers=headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        prc_deducted = body["subscription"]["prc_deducted"]

        # Pull statement
        r2 = await ac.get(f"/api/prc-statement/{target_uid}?limit=200", headers=headers)
        assert r2.status_code == 200, r2.text
        statement = r2.json()
        entries = statement.get("entries") or statement.get("transactions") or []

    # Subscription debit rows for this exact amount
    sub_rows = [
        e for e in entries
        if e.get("type") == "Subscription"
        and round(float(e.get("debit") or 0), 2) == round(prc_deducted, 2)
    ]
    # MUST be exactly ONE Subscription debit (no duplicate)
    assert len(sub_rows) == 1, (
        f"Expected 1 Subscription debit row for {prc_deducted} PRC, "
        f"got {len(sub_rows)}: {sub_rows}"
    )
    # And no leaky "Other" tag for the same amount
    other_dupes = [
        e for e in entries
        if e.get("type") == "Other"
        and round(float(e.get("debit") or 0), 2) == round(prc_deducted, 2)
    ]
    assert len(other_dupes) == 0, f"Subscription leaked into Other: {other_dupes}"

    await _cleanup_user(db, target_uid)


@pytest.mark.asyncio
async def test_sustainability_burn_no_duplicate_in_prc_statement(db, admin_token):
    """Sustainability Burn writes to BOTH `prc_ledger` (reference field) and
    `transactions` (transaction_id field) with the SAME burn_ref. PRC statement
    must dedup these → exactly ONE Burn row per burn event.
    """
    target_uid = "admin-test-123"
    await _cleanup_user(db, target_uid)
    await db.users.update_one({"uid": target_uid}, {"$set": {"prc_balance": 50000.0}})

    # Manually call apply_sustainability_burn helper via a fake service hook
    # (we re-use the real helper via direct DB inserts mimicking its writes
    # to keep this test independent of Eko/recharge endpoints).
    burn_ref = f"BURN-TEST-{uuid.uuid4().hex[:10].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()
    burn_amt = 500.0
    await db.prc_ledger.insert_one({
        "user_id": target_uid,
        "type": "auto_burn",
        "entry_type": "debit",
        "amount": -burn_amt,
        "balance_before": 50000.0,
        "balance_after": 49500.0,
        "reference": burn_ref,
        "service_type": "subscription_prc",
        "service_ref_id": "test-svc-ref",
        "service_label": "PRC Subscription",
        "service_amount_inr": 1178.82,
        "description": "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY",
        "auto": True,
        "reversed": False,
        "created_at": now_iso,
    })
    await db.transactions.insert_one({
        "transaction_id": burn_ref,
        "user_id": target_uid,
        "type": "prc_burn",
        "amount": -burn_amt,
        "balance_before": 50000.0,
        "balance_after": 49500.0,
        "description": "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY (PRC Subscription)",
        "reference_id": "test-svc-ref",
        "service_type": "subscription_prc",
        "auto_burn": True,
        "created_at": now_iso,
        "timestamp": now_iso,
    })

    headers = {"Authorization": f"Bearer {admin_token}"}
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        r = await ac.get(f"/api/prc-statement/{target_uid}?limit=200", headers=headers)
        assert r.status_code == 200, r.text
        entries = (r.json().get("entries") or r.json().get("transactions") or [])

    burn_rows = [e for e in entries if e.get("type") == "Burn" and round(float(e.get("debit") or 0), 2) == burn_amt]
    assert len(burn_rows) == 1, (
        f"Expected 1 Burn debit row for {burn_amt}, got {len(burn_rows)}: {burn_rows}"
    )

    await _cleanup_user(db, target_uid)
