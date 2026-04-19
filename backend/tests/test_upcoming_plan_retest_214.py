"""
Retest for iteration 214 - Upcoming Subscription UX fixes.

Focus on the 3 fixes from iteration 213:
1. create_notification now generates unique notification_id (uuid4) - no E11000 dupes.
2. notify_upcoming_subscription_starts only sets upcoming_notify_sent.d3/d1 after successful create_notification.
3. PRIMARY GET /api/admin/user-360?query={uid} now returns response.user.upcoming_plan.
Plus regression on FALLBACK /api/admin/user360/full/{uid}, user dashboard, community, login, public-profile.
"""

import os
import sys
import uuid
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

USER_MOBILE = "9970100782"
USER_PIN = "997010"
USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"

sys.path.insert(0, '/app/backend')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']


@pytest.fixture(scope="module")
def db():
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def user_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"mobile": USER_MOBILE, "pin": USER_PIN}, timeout=30)
    assert r.status_code == 200, f"User login failed: {r.status_code} {r.text}"
    data = r.json()
    return data.get("token") or data.get("access_token") or (data.get("user", {}) or {}).get("token")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def stub_upcoming(db, event_loop):
    payment_id = f"TEST-RETEST214-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    sched_start = (now + timedelta(days=3)).replace(microsecond=0)
    sched_end = sched_start + timedelta(days=28)

    doc = {
        "payment_id": payment_id,
        "user_id": USER_UID,
        "plan_name": "elite",
        "status": "upcoming",
        "payment_method": "prc",
        "prc_amount": 4321.0,
        "duration_days": 28,
        "scheduled_start": sched_start.isoformat(),
        "scheduled_end": sched_end.isoformat(),
        "created_at": now.isoformat(),
        "_test_seed": True,
    }

    async def setup():
        # Cleanup any pre-existing seed rows
        await db.subscription_payments.delete_many({"_test_seed": True, "user_id": USER_UID})
        await db.subscription_payments.insert_one(doc)

    async def teardown():
        await db.subscription_payments.delete_many({"_test_seed": True, "user_id": USER_UID})
        await db.notifications.delete_many({"user_id": USER_UID, "title": {"$regex": "plan starts|3 days|24 hours", "$options": "i"}})

    event_loop.run_until_complete(setup())
    yield {"payment_id": payment_id, "sched_start": sched_start, "sched_end": sched_end}
    event_loop.run_until_complete(teardown())


# ============ FIX 1: create_notification unique notification_id ============

class TestCreateNotificationUniqueId:
    def test_three_sequential_create_notifications(self, db, event_loop):
        """Call create_notification 3 times in a row; expect 3 docs with distinct notification_ids (no E11000)."""
        import routes.notifications as notif_module
        notif_module.set_db(db)  # Inject DB since we're calling outside app lifecycle
        from routes.notifications import create_notification

        tag = f"TEST_RETEST_{uuid.uuid4().hex[:6]}"

        async def run():
            ids = []
            for i in range(3):
                notif_id = await create_notification(
                    user_id=USER_UID,
                    notification_type="general",
                    title=f"{tag} iter {i}",
                    message=f"retest iteration 214 — {i}",
                )
                ids.append(notif_id)
            return ids

        ids = event_loop.run_until_complete(run())
        # All should be non-None and distinct
        assert all(ids), f"One or more create_notification calls returned falsy: {ids}"
        assert len(set(ids)) == 3, f"Expected 3 unique ids, got {ids}"

        # Verify in DB
        async def fetch():
            return await db.notifications.count_documents({"title": {"$regex": f"^{tag}"}})
        cnt = event_loop.run_until_complete(fetch())
        assert cnt == 3, f"Expected 3 notifications in DB, got {cnt}"

        # Verify each doc has notification_id set and unique
        async def fetch_docs():
            cursor = db.notifications.find({"title": {"$regex": f"^{tag}"}})
            return [d async for d in cursor]
        docs = event_loop.run_until_complete(fetch_docs())
        nids = [d.get("notification_id") for d in docs]
        assert all(nids), f"Some notification_id fields are null/missing: {nids}"
        assert len(set(nids)) == 3, f"notification_ids not unique: {nids}"

        # Cleanup
        async def cleanup():
            await db.notifications.delete_many({"title": {"$regex": f"^{tag}"}})
        event_loop.run_until_complete(cleanup())


# ============ FIX 2: notify_upcoming - flag guarded on successful send ============

class TestNotifyUpcomingFlagGuard:
    def test_cron_sets_d3_flag_after_successful_send(self, db, event_loop, stub_upcoming):
        """With fixed create_notification, cron run should send d3 notification AND set flag."""
        from server import notify_upcoming_subscription_starts

        event_loop.run_until_complete(notify_upcoming_subscription_starts())

        async def fetch():
            return await db.subscription_payments.find_one({"payment_id": stub_upcoming["payment_id"]})
        p = event_loop.run_until_complete(fetch())
        sent = (p or {}).get("upcoming_notify_sent") or {}
        assert sent.get("d3"), f"Expected d3 flag set after successful send; got upcoming_notify_sent={sent}"

        async def check_notif():
            return await db.notifications.find_one(
                {"user_id": USER_UID, "title": {"$regex": "3 days", "$options": "i"}}
            )
        notif = event_loop.run_until_complete(check_notif())
        assert notif is not None, "Expected 3-day reminder notification to be created"
        assert notif.get("notification_id"), "Reminder notification should have non-null notification_id"

    def test_cron_idempotent_second_run(self, db, event_loop, stub_upcoming):
        """Second cron invocation should not create a duplicate d3 notification."""
        from server import notify_upcoming_subscription_starts
        event_loop.run_until_complete(notify_upcoming_subscription_starts())

        async def count():
            return await db.notifications.count_documents(
                {"user_id": USER_UID, "title": {"$regex": "3 days", "$options": "i"}}
            )
        cnt = event_loop.run_until_complete(count())
        assert cnt == 1, f"Expected 1 d3 notification after idempotent 2nd run, got {cnt}"


# ============ FIX 3: PRIMARY /api/admin/user-360 returns upcoming_plan ============

class TestAdminUser360PrimaryUpcoming:
    def test_primary_endpoint_returns_upcoming_plan(self, admin_token, stub_upcoming):
        headers = {"Authorization": f"Bearer {admin_token}"}
        # PRIMARY endpoint (hyphen, query-param)
        r = requests.get(f"{BASE_URL}/api/admin/user-360", params={"query": USER_UID},
                         headers=headers, timeout=30)
        assert r.status_code == 200, f"PRIMARY admin user-360 failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        user_obj = data.get("user") or {}
        upcoming = user_obj.get("upcoming_plan")
        assert upcoming is not None, (
            f"PRIMARY /api/admin/user-360 should inject user.upcoming_plan. "
            f"Got user keys={list(user_obj.keys())[:30]}"
        )
        assert upcoming.get("plan_name") == "elite"
        assert upcoming.get("prc_amount") == 4321.0
        assert "scheduled_start" in upcoming
        assert "scheduled_end" in upcoming


class TestAdminUser360FallbackUpcoming:
    def test_fallback_endpoint_still_returns_upcoming_plan(self, admin_token, stub_upcoming):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/user360/full/{USER_UID}", headers=headers, timeout=30)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        user_obj = data.get("user") or {}
        upcoming = user_obj.get("upcoming_plan")
        assert upcoming is not None
        assert upcoming.get("plan_name") == "elite"
        assert upcoming.get("prc_amount") == 4321.0


# ============ Dashboard + regression ============

class TestDashboardAndRegression:
    def test_dashboard_upcoming_plan(self, user_token, stub_upcoming):
        headers = {"Authorization": f"Bearer {user_token}"} if user_token else {}
        r = requests.get(f"{BASE_URL}/api/user/{USER_UID}/dashboard", headers=headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        upcoming = data.get("upcoming_plan") or (data.get("user") or {}).get("upcoming_plan")
        count = data.get("upcoming_plans_count") or (data.get("user") or {}).get("upcoming_plans_count") or 0
        assert count >= 1, f"Expected >=1 upcoming_plans_count, got {count}"
        assert upcoming is not None

    def test_user_endpoint(self, user_token):
        headers = {"Authorization": f"Bearer {user_token}"} if user_token else {}
        r = requests.get(f"{BASE_URL}/api/user/{USER_UID}", headers=headers, timeout=30)
        assert r.status_code == 200

    def test_community_posts(self):
        r = requests.get(f"{BASE_URL}/api/community/posts", timeout=30)
        assert r.status_code == 200

    def test_public_profile(self):
        r = requests.get(f"{BASE_URL}/api/users/{USER_UID}/public-profile", timeout=30)
        assert r.status_code == 200

    def test_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"mobile": USER_MOBILE, "pin": USER_PIN}, timeout=30)
        assert r.status_code == 200
