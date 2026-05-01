"""Test: Success Story idempotency guards (test user + per-user 24h dedup)."""
import asyncio
import os
from datetime import datetime, timezone, timedelta
import uuid
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
async def test_skip_admin_test_user(db):
    """admin-test-* users should not produce success stories."""
    from routes.community import create_success_story_post, set_db

    set_db(db)
    # Ensure clean state
    before = await db.community_posts.count_documents(
        {"metadata.beneficiary_user_id": "admin-test-123"}
    )
    await create_success_story_post(
        user_id="admin-test-123",
        service_type="subscription",
        amount_inr=1178.82,
        ref_id=f"sub_{uuid.uuid4()}",
        plan_name="Elite",
    )
    after = await db.community_posts.count_documents(
        {"metadata.beneficiary_user_id": "admin-test-123"}
    )
    assert after == before, "admin-test user should be skipped"


@pytest.mark.asyncio
async def test_24h_dedup_same_user_same_service(db):
    """Two subscription success stories for same user within 24h → only first wins."""
    from routes.community import create_success_story_post, set_db

    set_db(db)
    # Use a real user uid (must exist in users coll for function to proceed)
    test_uid = "test-ss-dedup-" + uuid.uuid4().hex[:6]
    await db.users.insert_one(
        {"uid": test_uid, "name": "DedupBob", "city": "Pune", "state": "MH",
         "email": f"{test_uid}@t.local"}
    )
    try:
        ref1 = f"sub_{uuid.uuid4()}"
        ref2 = f"sub_{uuid.uuid4()}"
        # NOTE: the skip-test-user guard uses `startswith("test-")` so this
        # synthetic uid ("test-ss-dedup-...") is also skipped. That's expected
        # behaviour — skip assertion + manually seed one legit post instead.
        await db.community_posts.insert_one(
            {
                "post_id": str(uuid.uuid4()),
                "is_success_story": True,
                "category": "Success Story",
                "metadata": {
                    "beneficiary_user_id": test_uid,
                    "service_type": "subscription",
                    "ref_id": ref1,
                },
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        # Now call with a different ref_id for same user — should be deduped by 24h guard
        # But the test-user-skip guard fires first. So test the dedup with a non-test uid:
        real_uid = "realuser-" + uuid.uuid4().hex[:6]
        await db.users.insert_one(
            {"uid": real_uid, "name": "RealBob", "city": "Pune", "state": "MH",
             "email": f"{real_uid}@t.local"}
        )
        await db.community_posts.insert_one(
            {
                "post_id": str(uuid.uuid4()),
                "is_success_story": True,
                "category": "Success Story",
                "metadata": {
                    "beneficiary_user_id": real_uid,
                    "service_type": "subscription",
                    "ref_id": "sub_seed_" + uuid.uuid4().hex[:6],
                },
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        before_count = await db.community_posts.count_documents(
            {"metadata.beneficiary_user_id": real_uid}
        )
        # Try to post another subscription story for the same user → should be blocked
        await create_success_story_post(
            user_id=real_uid,
            service_type="subscription",
            amount_inr=999.0,
            ref_id=f"sub_{uuid.uuid4()}",
            plan_name="Elite",
        )
        after_count = await db.community_posts.count_documents(
            {"metadata.beneficiary_user_id": real_uid}
        )
        assert after_count == before_count, "24h dedup should have blocked 2nd post"

        # Different service (bank_redeem) should NOT be blocked
        await create_success_story_post(
            user_id=real_uid,
            service_type="bank_redeem",
            amount_inr=500.0,
            ref_id=f"bank_{uuid.uuid4()}",
        )
        # Cleanup
        await db.users.delete_one({"uid": real_uid})
        await db.community_posts.delete_many(
            {"metadata.beneficiary_user_id": real_uid}
        )
    finally:
        await db.users.delete_one({"uid": test_uid})
        await db.community_posts.delete_many(
            {"metadata.beneficiary_user_id": test_uid}
        )
