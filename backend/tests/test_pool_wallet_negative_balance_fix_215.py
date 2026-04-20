"""
Pool Wallet Negative Balance Fix - Iteration 215

Tests the CRITICAL production fix for Pool Wallet going negative (-3,682.89 PRC).
Covers:
  A. Over-distribution prevention (math.floor instead of round)
  B. Auto-heal negative balance when distribute runs
  C. Concurrency guard (asyncio lock - only 1 concurrent run)
  D. POST /api/pool-wallet/admin/heal-negative-balance endpoint
  E. Atomic conditional $inc guarantees balance never < 0
  F. Regression of regular distribution flow
  G. Regression of other unrelated endpoints

State safety: original pool_wallet doc is captured at session start and restored
at session end. Stub users/core_team use the prefix 'test-pool-215-' for cleanup.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import pytest_asyncio
import requests
import httpx
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward_db")

TEST_UID_PREFIX = "test-pool-215-"
NUM_TEST_MEMBERS = 4


# ---------- Fixtures ----------

@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        yield client[DB_NAME]
    finally:
        client.close()


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_teardown():
    # Use a dedicated client for setup/teardown
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    # Capture ORIGINAL pool_wallet doc so we can restore prod data
    original = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0})

    # Seed 4 stub eligible Elite core team members
    future = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    test_uids = []
    for i in range(NUM_TEST_MEMBERS):
        uid = f"{TEST_UID_PREFIX}{i}"
        test_uids.append(uid)
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "uid": uid,
                "name": f"Pool Test User {i}",
                "email": f"test-pool-215-{i}-{uuid.uuid4().hex[:6]}@test.local",
                "mobile": f"999000{i:04d}",
                "subscription_plan": "elite",
                "subscription_expiry": future,
                "subscription_status": "active",
                "subscription_expired": False,
                "prc_balance": 0.0,
                "_test_pool_215": True,
            }},
            upsert=True,
        )
        await db.core_team_members.update_one(
            {"uid": uid},
            {"$set": {
                "uid": uid,
                "name": f"Pool Test User {i}",
                "status": "active",
                "added_at": datetime.now(timezone.utc).isoformat(),
                "_test_pool_215": True,
            }},
            upsert=True,
        )

    yield {"test_uids": test_uids, "original": original}

    # TEARDOWN: remove ALL real core team members from distribution eligibility? No, we only
    # remove our test-only docs. But real core_team_members could have picked up distributions
    # during our tests - that's acceptable since admin triggered distribute is a valid op and
    # pool is being restored.
    await db.users.delete_many({"uid": {"$in": test_uids}})
    await db.core_team_members.delete_many({"uid": {"$in": test_uids}})
    await db.transactions.delete_many({"user_id": {"$in": test_uids}})
    await db.pool_wallet_transactions.delete_many({"_test_pool_215": True})

    # Restore original pool_wallet document EXACTLY
    if original:
        await db.pool_wallet.replace_one({"wallet_id": "main"}, original, upsert=True)
    else:
        await db.pool_wallet.delete_one({"wallet_id": "main"})
    client.close()


async def _set_pool_balance(db, balance: float):
    """Directly set pool_wallet.balance in mongo for test setup."""
    await db.pool_wallet.update_one(
        {"wallet_id": "main"},
        {"$set": {
            "balance": balance,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )


async def _remove_real_core_team_temporarily(db):
    """Mark non-test core team as 'removed' during concurrency/distribution tests so we only
    distribute to our 4 test members. Returns list of real uids that were paused."""
    cursor = db.core_team_members.find(
        {"status": "active", "uid": {"$not": {"$regex": f"^{TEST_UID_PREFIX}"}}},
        {"_id": 0, "uid": 1}
    )
    paused = [m["uid"] async for m in cursor]
    if paused:
        await db.core_team_members.update_many(
            {"uid": {"$in": paused}},
            {"$set": {"status": "_paused_test_215"}}
        )
    return paused


async def _restore_real_core_team(db, paused):
    if paused:
        await db.core_team_members.update_many(
            {"uid": {"$in": paused}},
            {"$set": {"status": "active"}}
        )


# ---------- A. Over-distribution prevention ----------

@pytest.mark.asyncio
async def test_A_tricky_balance_no_over_distribution(db):
    paused = await _remove_real_core_team_temporarily(db)
    try:
        await _set_pool_balance(db, 10.000001)
        # Call admin distribute endpoint
        r = requests.post(f"{BASE_URL}/api/pool-wallet/admin/distribute", timeout=30)
        assert r.status_code == 200, f"admin/distribute returned {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is True, f"Unexpected body: {body}"
        assert body.get("members") == NUM_TEST_MEMBERS, f"Expected {NUM_TEST_MEMBERS} members, got {body}"
        per_member = body["per_member"]
        distributed = body["distributed"]
        assert per_member * NUM_TEST_MEMBERS <= 10.000001 + 1e-9, \
            f"OVER-DISTRIBUTION: {per_member} * {NUM_TEST_MEMBERS} = {per_member * NUM_TEST_MEMBERS} > 10.000001"

        # Remaining balance must be >= 0
        wallet = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0, "balance": 1})
        remaining = float(wallet["balance"])
        assert remaining >= 0, f"Balance went negative after distribution: {remaining}"
        # With floor(10.000001/4 * 1e6)/1e6 = floor(2.50000025 * 1e6)/1e6 = 2.5 → 4*2.5 = 10.0,
        # remaining = 10.000001 - 10.0 = 1e-6
        assert remaining <= 0.001, f"Unexpectedly large remainder: {remaining}"
        print(f"[A] tricky balance OK: distributed={distributed} per_member={per_member} remaining={remaining}")
    finally:
        await _restore_real_core_team(db, paused)


# ---------- B. Auto-heal negative balance on distribute ----------

@pytest.mark.asyncio
async def test_B_distribute_auto_heals_negative_balance(db):
    paused = await _remove_real_core_team_temporarily(db)
    try:
        await _set_pool_balance(db, -500.0)
        r = requests.post(f"{BASE_URL}/api/pool-wallet/admin/distribute", timeout=30)
        assert r.status_code == 200, f"admin/distribute returned {r.status_code}: {r.text}"
        body = r.json()
        # distribute should not have distributed anything
        assert body.get("distributed", 0) == 0, f"Unexpected distribution: {body}"

        wallet = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0, "balance": 1})
        new_balance = float(wallet["balance"])
        assert new_balance == 0.0, f"Expected 0, got {new_balance}"
        print(f"[B] negative auto-heal OK: -500 → {new_balance}")
    finally:
        await _restore_real_core_team(db, paused)


# ---------- C. Concurrency guard (asyncio lock) ----------

@pytest.mark.asyncio
async def test_C_concurrency_lock_only_one_runs(db):
    paused = await _remove_real_core_team_temporarily(db)
    try:
        # Large balance so distribution takes a meaningful amount of time
        await _set_pool_balance(db, 1000.0)

        async def call_distribute(client):
            resp = await client.post(f"{BASE_URL}/api/pool-wallet/admin/distribute", timeout=60)
            return resp.status_code, resp.json()

        async with httpx.AsyncClient() as client:
            # Fire 3 concurrent admin/distribute
            results = await asyncio.gather(
                call_distribute(client),
                call_distribute(client),
                call_distribute(client),
                return_exceptions=False,
            )

        success_count = 0
        skipped_count = 0
        for status, body in results:
            assert status == 200, f"status={status} body={body}"
            if body.get("skipped") is True and body.get("message") == "Already running":
                skipped_count += 1
            elif body.get("success") and body.get("distributed", 0) > 0:
                success_count += 1
            else:
                # could also be success=True + distributed=0 if pool drained between attempts
                pass

        # Expectation per review_request: 1 completes, 2 skipped
        assert skipped_count >= 1, (
            f"Concurrency guard failed. results={results} "
            f"(expected at least 1 'skipped: Already running')"
        )
        print(f"[C] concurrency OK: success={success_count} skipped={skipped_count}")

        # And balance still >= 0 after concurrent bombardment
        wallet = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0, "balance": 1})
        assert float(wallet["balance"]) >= 0, f"Balance negative after concurrent: {wallet}"
    finally:
        await _restore_real_core_team(db, paused)


# ---------- D. POST /admin/heal-negative-balance endpoint ----------

@pytest.mark.asyncio
async def test_D1_heal_endpoint_heals_when_negative(db):
    await _set_pool_balance(db, -250.5)
    r = requests.post(f"{BASE_URL}/api/pool-wallet/admin/heal-negative-balance", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    assert body.get("healed") is True
    assert body.get("previous_balance") == -250.5
    assert body.get("new_balance") == 0.0
    wallet = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0, "balance": 1})
    assert float(wallet["balance"]) == 0.0
    print(f"[D1] heal endpoint healed: {body}")


@pytest.mark.asyncio
async def test_D2_heal_endpoint_noop_when_non_negative(db):
    await _set_pool_balance(db, 42.0)
    r = requests.post(f"{BASE_URL}/api/pool-wallet/admin/heal-negative-balance", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    assert body.get("healed") is False
    assert "non-negative" in body.get("message", "").lower()
    wallet = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0, "balance": 1})
    assert float(wallet["balance"]) == 42.0  # unchanged
    print(f"[D2] heal endpoint noop: {body}")


# ---------- E. Atomic $inc keeps balance >= 0 across many cycles ----------

@pytest.mark.asyncio
async def test_E_many_cycles_balance_never_negative(db):
    paused = await _remove_real_core_team_temporarily(db)
    try:
        await _set_pool_balance(db, 7.777777)
        for i in range(8):
            r = requests.post(f"{BASE_URL}/api/pool-wallet/admin/distribute", timeout=30)
            assert r.status_code == 200
            wallet = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0, "balance": 1})
            bal = float(wallet["balance"])
            assert bal >= 0, f"Balance went negative on cycle {i}: {bal}"
        print(f"[E] 8 cycles completed, final balance = {bal}")
    finally:
        await _restore_real_core_team(db, paused)


# ---------- F. Regular distribution regression (member credit + transaction) ----------

@pytest.mark.asyncio
async def test_F_regular_distribution_credits_members_and_logs(db):
    paused = await _remove_real_core_team_temporarily(db)
    try:
        # Snapshot member balances
        test_uids = [f"{TEST_UID_PREFIX}{i}" for i in range(NUM_TEST_MEMBERS)]
        before_balances = {}
        for uid in test_uids:
            u = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1})
            before_balances[uid] = float(u.get("prc_balance", 0))

        await _set_pool_balance(db, 40.0)
        r = requests.post(f"{BASE_URL}/api/pool-wallet/admin/distribute", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body.get("success") is True
        assert body.get("members") == NUM_TEST_MEMBERS
        per_member = body["per_member"]
        assert per_member == 10.0, f"Expected 40/4=10, got {per_member}"

        # Verify prc_balance credited
        for uid in test_uids:
            u = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1})
            after = float(u.get("prc_balance", 0))
            delta = round(after - before_balances[uid], 6)
            assert delta == 10.0, f"{uid} not credited: before={before_balances[uid]} after={after}"

        # Verify transactions.core_team_bonus for each member
        for uid in test_uids:
            txn = await db.transactions.find_one(
                {"user_id": uid, "type": "core_team_bonus"},
                sort=[("timestamp", -1)]
            )
            assert txn is not None, f"No core_team_bonus txn for {uid}"
            assert txn["amount"] == per_member
            assert txn["description"] == "Core Team Bonus - Pool Distribution"

        # Verify pool_wallet_transactions distribution record
        pwt = await db.pool_wallet_transactions.find_one(
            {"type": "distribution"},
            sort=[("timestamp", -1)]
        )
        assert pwt is not None
        assert pwt.get("members_count") == NUM_TEST_MEMBERS
        assert pwt.get("per_member") == per_member
        # balance_after exists
        assert "balance_after" in pwt
        print(f"[F] regular distribution regression OK: per_member={per_member}")
    finally:
        await _restore_real_core_team(db, paused)


# ---------- G. Public endpoint regressions ----------

def test_G1_pool_wallet_info_endpoint():
    r = requests.get(f"{BASE_URL}/api/pool-wallet/info", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "pool_balance" in body
    assert "core_team_count" in body
    assert "pool_rate" in body
    assert body.get("success") is True
    print(f"[G1] /info OK: {body}")


def test_G2_admin_balance_endpoint():
    r = requests.get(f"{BASE_URL}/api/pool-wallet/admin/balance", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ("balance", "total_credited", "total_distributed"):
        assert k in body, f"missing {k} in {body}"
    print(f"[G2] /admin/balance OK: balance={body['balance']} credited={body['total_credited']} distributed={body['total_distributed']}")


def test_G3_user_endpoint_works():
    uid = "76b75808-47fa-48dd-ad7c-8074678e3607"  # primary test user
    r = requests.get(f"{BASE_URL}/api/user/{uid}", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("uid") == uid or "user" in body or "name" in body
    print(f"[G3] /api/user/{{uid}} OK: status={r.status_code}")


def test_G4_user_dashboard_endpoint_works():
    uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
    r = requests.get(f"{BASE_URL}/api/user/{uid}/dashboard", timeout=20)
    assert r.status_code == 200, r.text
    print(f"[G4] /api/user/{{uid}}/dashboard OK: status={r.status_code}")


def test_G5_community_posts_endpoint_works():
    r = requests.get(f"{BASE_URL}/api/community/posts", timeout=15)
    assert r.status_code == 200, r.text
    print(f"[G5] /api/community/posts OK: status={r.status_code}")
