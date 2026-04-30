"""
Phase B Security Regression Tests — Apr 30 2026

Verifies:
 1. /users/{uid} requires auth (401 without token)
 2. /user/{uid}/profile cross-user access is blocked (403)
 3. /user/{uid}/profile self/admin access works (200)
 4. Reset-password-request does NOT leak reset_token in response
 5. Login works with JSON body (POST)
 6. Admin can access ANY user's data (verifies IDOR exception works)
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


@pytest_asyncio.fixture
async def regular_user(db):
    """Create a non-admin user with known PIN, return (uid, email, token)."""
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    uid = f"phaseb-test-{uuid.uuid4().hex[:8]}"
    email = f"{uid}@test.local"
    # Random unique mobile to avoid duplicate-key collisions across test runs.
    mobile = f"99{uuid.uuid4().hex[:8].upper()[:8]}"  # 10 chars total
    await db.users.insert_one({
        "uid": uid,
        "email": email,
        "name": "PhaseB User",
        "mobile": mobile,
        "password": pwd.hash("999999"),
        "pin_migrated": True,
        "role": "user",
        "is_active": True,
        "is_banned": False,
        "prc_balance": 0,
        "subscription_plan": "explorer",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        r = await ac.post("/api/auth/login", json={"identifier": email, "password": "999999"})
        r.raise_for_status()
        token = r.json().get("token") or r.json().get("access_token")
    yield uid, email, token
    # Cleanup
    await db.users.delete_one({"uid": uid})


@pytest.mark.asyncio
async def test_users_uid_requires_auth():
    """GET /users/{uid} without token → 401."""
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        r = await ac.get("/api/users/admin-test-123")
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text}"


@pytest.mark.asyncio
async def test_user_dashboard_requires_auth():
    """GET /user/{uid}/dashboard without token → 401."""
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        r = await ac.get("/api/user/admin-test-123/dashboard")
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


@pytest.mark.asyncio
async def test_cross_user_profile_blocked(regular_user, db):
    """User A cannot read User B's data — must get 403."""
    uid_a, _, token_a = regular_user
    # Create a second user
    uid_b = f"phaseb-victim-{uuid.uuid4().hex[:8]}"
    await db.users.insert_one({
        "uid": uid_b,
        "email": f"{uid_b}@test.local",
        "name": "Victim",
        "role": "user",
        "is_active": True,
        "prc_balance": 9999,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
            r = await ac.get(
                f"/api/users/{uid_b}",
                headers={"Authorization": f"Bearer {token_a}"},
            )
        assert r.status_code == 403, f"IDOR vulnerability! Got {r.status_code} instead of 403: {r.text[:200]}"
    finally:
        await db.users.delete_one({"uid": uid_b})


@pytest.mark.asyncio
async def test_self_profile_access_works(regular_user):
    """User can read their own data — 200."""
    uid, _, token = regular_user
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        r = await ac.get(
            f"/api/users/{uid}",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200, f"Self access broken: {r.status_code}: {r.text[:200]}"
    assert r.json().get("uid") == uid


@pytest.mark.asyncio
async def test_admin_can_read_any_user(admin_token, regular_user):
    """Admin can read any user — 200."""
    uid, _, _ = regular_user
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        r = await ac.get(
            f"/api/users/{uid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 200, f"Admin override broken: {r.status_code}: {r.text[:200]}"
    assert r.json().get("uid") == uid


@pytest.mark.asyncio
async def test_reset_password_request_does_not_leak_token():
    """POST /auth/reset-password-request must NOT return reset_token in response."""
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        # Even with a valid email, no reset_token should be in the response body
        r = await ac.post("/api/auth/reset-password-request?email=admin@test.com")
    assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
    body = r.json()
    assert "reset_token" not in body, f"SECURITY: reset_token leaked in response: {body}"
    assert body.get("message") == "If the email exists, a reset link has been sent"


@pytest.mark.asyncio
async def test_forgot_password_does_not_leak_token():
    """POST /auth/forgot-password must NOT return reset_token in response."""
    async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
        r = await ac.post("/api/auth/forgot-password?email=admin@test.com")
    assert r.status_code == 200
    body = r.json()
    assert "reset_token" not in body, f"SECURITY: reset_token leaked: {body}"


@pytest.mark.asyncio
async def test_cross_user_profile_update_blocked(regular_user, db):
    """User A cannot update User B's profile — 403."""
    uid_a, _, token_a = regular_user
    uid_b = f"phaseb-victim2-{uuid.uuid4().hex[:8]}"
    await db.users.insert_one({
        "uid": uid_b,
        "email": f"{uid_b}@test.local",
        "name": "Victim",
        "role": "user",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        async with AsyncClient(base_url=BASE_URL, timeout=30) as ac:
            r = await ac.put(
                f"/api/user/{uid_b}/profile",
                json={"name": "Hacker"},
                headers={"Authorization": f"Bearer {token_a}"},
            )
        assert r.status_code == 403, f"IDOR write vuln! {r.status_code}: {r.text[:200]}"
        # Also confirm the document was NOT modified
        victim = await db.users.find_one({"uid": uid_b}, {"_id": 0, "name": 1})
        assert victim and victim.get("name") == "Victim"
    finally:
        await db.users.delete_one({"uid": uid_b})
