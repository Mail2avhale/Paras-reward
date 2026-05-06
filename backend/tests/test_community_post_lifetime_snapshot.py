"""Regression: every regular community post must carry a snapshot of the
author's lifetime-redeemed INR so the post card can display ₹X next to the
user_name (matches the same number admin Bank Redeem panel shows).

Bug history (May 6, 2026): originally only Success Story posts had this
metadata. User requested it on every post for social proof + scammer
detection. This test pins the contract.
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

SUFFIX_BASE = "postlifetime"


@pytest.fixture(scope="function")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db():
    test_uid = f"{SUFFIX_BASE}-{uuid.uuid4().hex[:8]}"
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    community.set_db(database)
    await database.users.replace_one(
        {"uid": test_uid},
        {"uid": test_uid, "name": "Tester",
         "subscription_plan": "elite",
         "email": f"{test_uid}@test.local",
         "mobile": f"7{int(uuid.uuid4().int % 1_000_000_000):09d}"[:10]},
        upsert=True,
    )
    yield {"db": database, "uid": test_uid}
    await database.users.delete_one({"uid": test_uid})
    await database.community_posts.delete_many({"user_id": test_uid})


@pytest.mark.asyncio
async def test_post_carries_lifetime_snapshot_when_helpers_wired(db):
    DB = db["db"]
    TEST_USER = db["uid"]

    async def fake_at(_): return 25789.0
    async def fake_rate(): return 13.0
    community.set_all_time_redeemed(fake_at)
    community.set_prc_rate_getter(fake_rate)

    res = await community.create_post(community.CreatePostRequest(
        user_id=TEST_USER,
        user_name="Tester",
        title="A perfectly nice and useful post about saving money and tips.",
        content="Hello friends, here is a useful tip about safe redeems and bank transfers.",
        category="General Discussion",
    ))
    assert res["success"] is True
    post = res["post"]
    assert "user_total_redeemed_inr" in post
    # 25789 / 13 = 1983.77 (matches admin Bank Redeem panel)
    assert post["user_total_redeemed_inr"] == pytest.approx(1983.77, abs=0.01)

    # Persisted on disk too
    saved = await DB.community_posts.find_one({"post_id": post["post_id"]}, {"_id": 0})
    assert saved["user_total_redeemed_inr"] == pytest.approx(1983.77, abs=0.01)


@pytest.mark.asyncio
async def test_post_lifetime_is_zero_for_brand_new_user(db):
    DB = db["db"]
    TEST_USER = db["uid"]

    async def fake_at(_): return 0.0
    async def fake_rate(): return 13.0
    community.set_all_time_redeemed(fake_at)
    community.set_prc_rate_getter(fake_rate)

    res = await community.create_post(community.CreatePostRequest(
        user_id=TEST_USER,
        user_name="NewUser",
        title="Greetings everyone, looking forward to learning new things here.",
        content="Just joined the platform, excited to start earning soon!",
        category="General Discussion",
    ))
    assert res["success"] is True
    assert res["post"]["user_total_redeemed_inr"] == 0


@pytest.mark.asyncio
async def test_post_creation_resilient_to_lifetime_calc_failure(db):
    """If the lifetime helper throws, the post must STILL be created.
    Failure mode = lifetime value of 0, NOT a 500."""
    DB = db["db"]
    TEST_USER = db["uid"]

    async def boom(_):
        raise RuntimeError("Mongo down")
    async def fake_rate():
        return 13.0
    community.set_all_time_redeemed(boom)
    community.set_prc_rate_getter(fake_rate)

    res = await community.create_post(community.CreatePostRequest(
        user_id=TEST_USER,
        user_name="Tester",
        title="A perfectly normal post during partial outage of analytics.",
        content="Should still get published even when lifetime helper crashes.",
        category="General Discussion",
    ))
    assert res["success"] is True
    assert res["post"]["user_total_redeemed_inr"] == 0
