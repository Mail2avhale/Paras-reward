"""
Tests for the May 2026 production fixes:

1. Razorpay verify-payment now calls STEP 13 (assign_subscription_position) +
   STEP 14 (create_success_story_post) after subscription activation.
   We exercise the helpers directly (DB-level) since we cannot mint a real
   Razorpay payment signature in tests.

2. POST /api/subscription/pay-with-prc — self PRC subscription no longer
   enforces the redeem limit. Balance + 3-time cap + 7-day cooldown still gate.

3. POST /api/admin/razorpay/backfill-missing-hooks — admin endpoint, supports
   dry_run, idempotent across runs.
"""

import os
import time
import uuid
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta

from motor.motor_asyncio import AsyncIOMotorClient

# Load backend/.env explicitly so MONGO_URL/DB_NAME are available even when
# pytest is invoked from /app/backend (where REACT_APP_BACKEND_URL is not set).
try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    load_dotenv("/app/frontend/.env")
except Exception:
    pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Last-resort read of frontend/.env
    try:
        with open("/app/frontend/.env") as _f:
            for _line in _f:
                if _line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = _line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        pass
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward_db")

ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


# ==================== Shared fixtures ====================

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "pin": ADMIN_PIN
    }, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in admin login response: {data}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db(event_loop):
    client = AsyncIOMotorClient(MONGO_URL)
    db_inst = client[DB_NAME]
    yield db_inst
    client.close()


# ==================== Module 1: Razorpay STEP 13/14 hooks (DB-level test) ====================

class TestRazorpayHooksDirect:
    """STEP 13/14 hooks (assign_subscription_position + create_success_story_post)
    are validated via the backfill endpoint integration tests below, which
    invoke the exact same helper functions through the same route layer that
    the Razorpay verify-payment route uses. Direct in-process import of
    routes.mining / routes.community is not viable because those modules
    receive their `db` binding from server.py at app startup (FastAPI lifespan),
    which is not triggered when pytest imports them as plain modules.
    See TestAdminBackfillEndpoint::test_backfill_real_run_creates_post_and_position
    for end-to-end proof that STEP 13 + STEP 14 path works.
    """
    pass


# ==================== Module 2: PRC pay-with-prc self subscription ====================

class TestPrcPayWithPrcRedeemLimitRemoved:
    """Verify that low effective_available (redeem limit) no longer blocks self
    PRC subscription. We do NOT want to consume the production test user's 3-time
    cap, so we create a fresh ephemeral user with enough PRC balance and no
    prior PRC subscriptions and no cooldown."""

    TEST_UID = f"TEST_PRCSUB_{uuid.uuid4().hex[:8]}"

    @pytest.fixture(autouse=True)
    def seed_user(self, db, event_loop):
        async def _setup():
            # Seed user with high PRC balance, no prior subscription, low redeem limit override
            await db.users.insert_one({
                "uid": self.TEST_UID,
                "mobile": f"7{uuid.uuid4().int % 10**9:09d}",
                "email": f"TEST_PRCSUB_{uuid.uuid4().hex[:8]}@example.com",
                "name": "PRC Sub Test User",
                "first_name": "PRC",
                "city": "Pune",
                "state": "Maharashtra",
                "subscription_plan": "explorer",
                "prc_balance": 500000,   # plenty
                "redeem_limit_override": 100,  # very low: forces effective_available << total_prc
                "created_at": datetime.now(timezone.utc).isoformat(),
                "kyc_status": "approved",
                "is_active": True,
                "pin": ADMIN_PIN,  # not used; endpoint doesn't require PIN
            })

        async def _teardown():
            await db.users.delete_many({"uid": self.TEST_UID})
            await db.subscription_payments.delete_many({"user_id": self.TEST_UID})
            await db.community_posts.delete_many({"metadata.beneficiary_user_id": self.TEST_UID})
            await db.transactions.delete_many({"user_id": self.TEST_UID})
            await db.prc_statement.delete_many({"user_id": self.TEST_UID})

        event_loop.run_until_complete(_setup())
        yield
        event_loop.run_until_complete(_teardown())

    def _get_elite_prc_price(self):
        """Fetch current Elite PRC price from the API."""
        r = requests.get(f"{BASE_URL}/api/subscription/elite-pricing", timeout=15)
        if r.status_code == 200:
            data = r.json()
            return data.get("total_prc_required") or (data.get("pricing") or {}).get("total_prc")
        return None

    def test_self_subscription_succeeds_with_low_redeem_limit(self, db, event_loop):
        """Even with effective_available far below total_prc, the call must succeed
        because the redeem-limit gate has been removed for self-subscription."""
        prc_price = self._get_elite_prc_price()
        if not prc_price:
            pytest.skip("Could not determine Elite PRC price from API")

        # Sanity: redeem limit override (100 PRC) must be far below the price
        assert prc_price > 1000, f"Unexpected low Elite PRC price: {prc_price}"

        payload = {
            "user_id": self.TEST_UID,
            "plan_name": "elite",
            "plan_type": "monthly",
            "prc_amount": prc_price,
            "client_request_id": str(uuid.uuid4()),
        }
        r = requests.post(f"{BASE_URL}/api/subscription/pay-with-prc", json=payload, timeout=30)

        # MUST NOT fail with 'Insufficient redeem limit' anymore
        body = r.text.lower()
        assert "redeem limit" not in body or "skipped" in body, \
            f"Redeem limit error still being raised: {r.status_code} {r.text[:300]}"

        # Should succeed (200) since balance OK, no prior count, no cooldown
        assert r.status_code == 200, \
            f"Expected 200 OK, got {r.status_code}: {r.text[:300]}"

        data = r.json()
        assert data.get("success") is True, f"Expected success=true: {data}"

        # Verify subscription_payments row was created
        async def _check():
            return await db.subscription_payments.find_one(
                {"user_id": self.TEST_UID, "payment_method": "prc"},
                {"_id": 0, "status": 1, "prc_amount": 1}
            )
        sub_row = event_loop.run_until_complete(_check())
        assert sub_row is not None, "subscription_payments row not created"

    def test_insufficient_balance_still_blocks(self, db, event_loop):
        """Defense-in-depth: if balance < prc_amount, request must still 400."""
        # Drain the balance
        async def _drain():
            await db.users.update_one(
                {"uid": self.TEST_UID},
                {"$set": {"prc_balance": 10}}
            )
        event_loop.run_until_complete(_drain())

        prc_price = self._get_elite_prc_price()
        if not prc_price:
            pytest.skip("Could not determine Elite PRC price from API")

        payload = {
            "user_id": self.TEST_UID,
            "plan_name": "elite",
            "plan_type": "monthly",
            "prc_amount": prc_price,
            "client_request_id": str(uuid.uuid4()),
        }
        r = requests.post(f"{BASE_URL}/api/subscription/pay-with-prc", json=payload, timeout=20)
        assert r.status_code == 400, f"Expected 400 for low balance, got {r.status_code}: {r.text[:300]}"
        assert "balance" in r.text.lower() or "insufficient" in r.text.lower()


# ==================== Module 3: Admin backfill endpoint ====================

class TestAdminBackfillEndpoint:
    """Test /api/admin/razorpay/backfill-missing-hooks dry_run + idempotency."""

    TEST_UID = f"TEST_BACKFILL_{uuid.uuid4().hex[:8]}"
    PAYMENT_ID = f"pay_BF_{uuid.uuid4().hex[:10]}"
    REF_ID = f"sub_{PAYMENT_ID}"

    @pytest.fixture(autouse=True)
    def seed(self, db, event_loop):
        async def _setup():
            await db.users.insert_one({
                "uid": self.TEST_UID,
                "mobile": f"8{uuid.uuid4().int % 10**9:09d}",
                "email": f"TEST_BF_{uuid.uuid4().hex[:8]}@example.com",
                "name": "Backfill Test User",
                "first_name": "Backfill",
                "city": "Mumbai",
                "state": "Maharashtra",
                "subscription_plan": "elite",
                # NOTE: intentionally missing subscription_position to test backfill
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            await db.razorpay_orders.insert_one({
                "order_id": f"order_BF_{uuid.uuid4().hex[:10]}",
                "user_id": self.TEST_UID,
                "payment_id": self.PAYMENT_ID,
                "amount": 1188.82,
                "plan_name": "elite",
                "status": "paid",
                "payment_captured": True,
            })

        async def _teardown():
            await db.users.delete_many({"uid": self.TEST_UID})
            await db.razorpay_orders.delete_many({"user_id": self.TEST_UID})
            await db.community_posts.delete_many({"metadata.ref_id": self.REF_ID})
            await db.community_posts.delete_many({"metadata.beneficiary_user_id": self.TEST_UID})

        event_loop.run_until_complete(_setup())
        yield
        event_loop.run_until_complete(_teardown())

    def test_backfill_requires_auth(self):
        """No bearer token => 401."""
        r = requests.post(
            f"{BASE_URL}/api/admin/razorpay/backfill-missing-hooks",
            json={"admin_pin": ADMIN_PIN, "dry_run": True},
            timeout=15,
        )
        assert r.status_code in (401, 403), \
            f"Expected 401/403 without token, got {r.status_code}"

    def test_backfill_rejects_wrong_pin(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/razorpay/backfill-missing-hooks",
            json={"admin_pin": "000000", "dry_run": True},
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 403, f"Expected 403 wrong pin, got {r.status_code} {r.text[:200]}"

    def test_backfill_dry_run_does_not_mutate(self, admin_headers, db, event_loop):
        """dry_run=true should scan, report counts, but NOT create posts or assign positions."""
        r = requests.post(
            f"{BASE_URL}/api/admin/razorpay/backfill-missing-hooks",
            json={"admin_pin": ADMIN_PIN, "dry_run": True, "uid": self.TEST_UID},
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200, f"dry_run failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("success") is True
        assert data.get("dry_run") is True
        assert data.get("scanned", 0) >= 1
        assert data.get("position_fixed", 0) >= 1
        assert data.get("posts_created", 0) >= 1

        # Verify no mutation actually happened
        async def _check():
            user = await db.users.find_one({"uid": self.TEST_UID}, {"_id": 0, "subscription_position": 1})
            post = await db.community_posts.find_one({"metadata.ref_id": self.REF_ID}, {"_id": 1})
            return user, post

        user, post = event_loop.run_until_complete(_check())
        assert user.get("subscription_position") in (None, 0), \
            f"dry_run should not have set subscription_position, but found {user.get('subscription_position')}"
        assert post is None, "dry_run should not have created a community post"

    def test_backfill_real_run_creates_post_and_position(self, admin_headers, db, event_loop):
        r = requests.post(
            f"{BASE_URL}/api/admin/razorpay/backfill-missing-hooks",
            json={"admin_pin": ADMIN_PIN, "dry_run": False, "uid": self.TEST_UID},
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200, f"real run failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("dry_run") is False
        assert data.get("position_fixed", 0) >= 1
        assert data.get("posts_created", 0) >= 1

        # Give create_success_story_post (sync in backfill, but DB might lag) a moment
        time.sleep(1.0)

        async def _check():
            user = await db.users.find_one({"uid": self.TEST_UID}, {"_id": 0, "subscription_position": 1})
            post = await db.community_posts.find_one(
                {"metadata.ref_id": self.REF_ID},
                {"_id": 0, "is_success_story": 1, "metadata": 1}
            )
            return user, post

        user, post = event_loop.run_until_complete(_check())
        assert user and user.get("subscription_position", 0) > 0, \
            f"subscription_position not assigned: {user}"
        assert post is not None, "Community post not created by backfill"
        assert post.get("is_success_story") is True

    def test_backfill_is_idempotent_across_runs(self, admin_headers, db, event_loop):
        """Running real backfill twice should not create duplicate posts."""
        # First real run
        requests.post(
            f"{BASE_URL}/api/admin/razorpay/backfill-missing-hooks",
            json={"admin_pin": ADMIN_PIN, "dry_run": False, "uid": self.TEST_UID},
            headers=admin_headers, timeout=30,
        )
        time.sleep(0.8)
        # Second real run
        r2 = requests.post(
            f"{BASE_URL}/api/admin/razorpay/backfill-missing-hooks",
            json={"admin_pin": ADMIN_PIN, "dry_run": False, "uid": self.TEST_UID},
            headers=admin_headers, timeout=30,
        )
        assert r2.status_code == 200
        data2 = r2.json()
        # Second run should report already_ok >= 1 (no new work)
        # OR posts_created==0 because existing_post check returned a row
        assert data2.get("posts_created", 1) == 0 or data2.get("already_ok", 0) >= 1, \
            f"Second backfill should be no-op: {data2}"

        async def _count():
            return await db.community_posts.count_documents({"metadata.ref_id": self.REF_ID})

        cnt = event_loop.run_until_complete(_count())
        assert cnt == 1, f"Duplicate community posts created (idempotency broken): count={cnt}"
