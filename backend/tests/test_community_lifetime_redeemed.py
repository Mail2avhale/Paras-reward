"""Regression test: community Success Story `lifetime_redeemed_inr` must equal
the same value the admin Bank Redeem panel shows for that user (PRC redeemed /
PRC-to-INR rate).

Bug history (May 6, 2026): community page had its own narrower aggregation
(only `recharge_transactions` + `bank_transfer_requests`), so a user's
"Redeemed till ₹X" tile under-reported by ~25-30% versus admin's "Lifetime: ₹Y".
After wiring `get_user_all_time_redeemed` + `get_dynamic_prc_rate` into
`routes/community.py`, the two surfaces must always agree.
"""
import os
import sys
import uuid
import asyncio
from pathlib import Path

import pytest
import pytest_asyncio
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
load_dotenv(BACKEND / ".env")
sys.path.insert(0, str(BACKEND))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from routes import community  # noqa: E402

SUFFIX_BASE = "liferedeem-real"


@pytest.fixture(scope="function")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db():
    # Fresh UID per test → no 24h-dedup collisions across tests
    test_uid = f"{SUFFIX_BASE}-{uuid.uuid4().hex[:8]}"
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    community.set_db(database)
    await database.users.replace_one(
        {"uid": test_uid},
        {"uid": test_uid, "name": "Lifetime Test",
         "first_name": "Lifetime", "city": "Pune", "state": "MH",
         "subscription_plan": "elite",
         "email": f"{test_uid}@test.local", "mobile": "7888888888"},
        upsert=True,
    )
    yield {"db": database, "uid": test_uid}
    await database.users.delete_one({"uid": test_uid})
    await database.community_posts.delete_many({"metadata.beneficiary_user_id": test_uid})
    await database.recharge_transactions.delete_many({"user_id": test_uid})


@pytest.mark.asyncio
async def test_lifetime_redeemed_uses_admin_calc_when_helpers_wired(db):
    DB = db["db"]
    TEST_USER = db["uid"]
    """When the all-time-redeemed + PRC-rate helpers are injected, community
    posts use the admin formula and surface the SAME ₹ figure."""

    async def fake_all_time(user_id):
        # Admin sees: 25,789 PRC ever redeemed (Kashiram-style)
        return 25789.0

    async def fake_rate():
        return 13.0  # ₹1 = 13 PRC

    community.set_all_time_redeemed(fake_all_time)
    community.set_prc_rate_getter(fake_rate)

    await community.create_success_story_post(
        user_id=TEST_USER,
        service_type="bank_redeem",
        amount_inr=1000.0,
        plan_name=None,
    )

    post = await DB.community_posts.find_one(
        {"metadata.beneficiary_user_id": TEST_USER, "category": "Success Story"},
        {"_id": 0},
    )
    assert post is not None, "Success Story post not created"

    md = post.get("metadata") or {}
    assert "user_total_redeemed_inr" in md
    # 25789 / 13 = 1983.77 — must match what AdminBankTransfers.js renders.
    assert md["user_total_redeemed_inr"] == pytest.approx(1983.77, abs=0.01), (
        f"Expected admin-equivalent ₹1983.77, got ₹{md['user_total_redeemed_inr']}"
    )


@pytest.mark.asyncio
async def test_lifetime_redeemed_falls_back_when_helpers_missing(db):
    DB = db["db"]
    TEST_USER = db["uid"]
    """If server.py forgets to inject the helpers, the legacy narrow
    aggregation kicks in so the post still has SOME number rather than 0.
    Guards against a future deploy regression."""
    # Reset the helpers
    community.set_all_time_redeemed(None)
    community.set_prc_rate_getter(None)

    # Seed one successful recharge worth ₹500
    await DB.recharge_transactions.insert_one({
        "user_id": TEST_USER,
        "status": "success",
        "amount_inr": 500.0,
        "amount": 500.0,
    })
    try:
        await community.create_success_story_post(
            user_id=TEST_USER,
            service_type="mobile_recharge",
            amount_inr=500.0,
        )
        post = await DB.community_posts.find_one(
            {"metadata.beneficiary_user_id": TEST_USER, "category": "Success Story"},
            {"_id": 0},
        )
        assert post is not None
        md = post.get("metadata") or {}
        # Fallback aggregation should pick up the seeded ₹500
        assert md.get("user_total_redeemed_inr", 0) >= 500.0
    finally:
        await DB.recharge_transactions.delete_many({"user_id": TEST_USER})


@pytest.mark.asyncio
async def test_subscription_post_skips_lifetime_calc(db):
    DB = db["db"]
    TEST_USER = db["uid"]
    """Subscription posts shouldn't bother computing lifetime — the metric
    isn't relevant in a 'I just upgraded to Elite' celebration post."""
    async def fake_all_time(user_id):
        return 99999.0  # would be huge if used

    async def fake_rate():
        return 13.0

    community.set_all_time_redeemed(fake_all_time)
    community.set_prc_rate_getter(fake_rate)

    await community.create_success_story_post(
        user_id=TEST_USER,
        service_type="subscription",
        amount_inr=999.0,
        plan_name="Elite",
    )
    post = await DB.community_posts.find_one(
        {"metadata.beneficiary_user_id": TEST_USER, "category": "Success Story"},
        {"_id": 0},
    )
    assert post is not None
    md = post.get("metadata") or {}
    # Subscription path returns db_total=0, max(0, 0) for amount_inr branch → 0
    assert md.get("user_total_redeemed_inr", 99999.0) == 0
