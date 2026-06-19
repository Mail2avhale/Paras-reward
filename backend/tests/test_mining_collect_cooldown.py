"""
Tests for Mining Collect→Start 60-Second Cooldown (AdMob retention feature).

Behavior under test:
  - After collect_mining(), session does NOT auto-restart.
  - User receives a 60-second cooldown before they can /start a new session.
  - /mining/status reflects start_cooldown_seconds + next_session_available_at.
  - /mining/start before cooldown elapses returns HTTP 429.
  - Explorer plan blocked from collect (403); no-session collect returns 400.

Regressions:
  - /api/mining/rate-breakdown/{uid} still returns 6-tier breakdown.
  - /api/growth/prc-rate still returns 10 PRC = ₹1.
"""
import os
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

# Load backend env so MONGO_URL/DB_NAME are available
load_dotenv(Path('/app/backend/.env'))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL'):
                BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
                break

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

ELITE_UID = "fcd8c6f8-9596-4f56-8556-568847d5ab86"  # Suresh, Elite
EXPLORER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"  # Test User DMT, explorer


# --------------------------- Fixtures ---------------------------

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo():
    return AsyncIOMotorClient(MONGO_URL)[DB_NAME]


async def _seed_active_session(db, uid: str, hours_ago: float = 2.0):
    """Set the user to have an active mining session that started X hours ago."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours_ago)
    end = start + timedelta(hours=24)
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "mining_active": True,
            "mining_start_time": start.isoformat(),
            "mining_session_end": end.isoformat(),
            "next_session_available_at": None,
            "last_mining_action": start.isoformat(),
        }}
    )


async def _reset_user(db, uid: str):
    """Reset user back to a clean, no-session state."""
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "mining_active": False,
            "mining_start_time": None,
            "mining_session_end": None,
            "next_session_available_at": None,
        }}
    )


@pytest.fixture(scope="module", autouse=True)
def cleanup_around_module(mongo):
    """Reset the elite test user before and after the full module run."""
    asyncio.get_event_loop().run_until_complete(_reset_user(mongo, ELITE_UID))
    yield
    asyncio.get_event_loop().run_until_complete(_reset_user(mongo, ELITE_UID))


# --------------------------- Cooldown happy path ---------------------------

class TestCollectCooldownFlow:
    """Full collect→cooldown→start happy-path on Suresh (Elite)."""

    def test_01_seed_active_session_and_status(self, api, mongo):
        # Seed: 2 hours into an active session
        asyncio.get_event_loop().run_until_complete(_seed_active_session(mongo, ELITE_UID, hours_ago=2.0))

        r = api.get(f"{BASE_URL}/api/mining/status/{ELITE_UID}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mining_active"] is True
        assert data["session_active"] is True
        assert data["can_collect"] is True
        assert data["can_start"] is False
        assert data["mined_coins"] > 0
        assert data["start_cooldown_seconds"] == 0
        assert data.get("next_session_available_at") in (None, "")

    def test_02_collect_returns_cooldown_and_no_autostart(self, api):
        r = api.post(f"{BASE_URL}/api/mining/collect/{ELITE_UID}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        # KEY assertion: no auto-start, 60s cooldown
        assert data["auto_started"] is False
        assert data["cooldown_seconds"] == 60
        assert data["next_session_available_at"], "next_session_available_at must be populated"
        # Parse and assert it's ~60s in the future
        nxt = datetime.fromisoformat(data["next_session_available_at"].replace('Z', '+00:00'))
        delta = (nxt - datetime.now(timezone.utc)).total_seconds()
        assert 55 <= delta <= 61, f"cooldown delta out of band: {delta}s"
        assert data["collected_amount"] > 0
        assert data["new_balance"] > 0

    def test_03_status_after_collect_shows_cooldown(self, api):
        r = api.get(f"{BASE_URL}/api/mining/status/{ELITE_UID}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mining_active"] is False
        assert data["session_active"] is False
        assert data["can_start"] is False, "can_start must be False during cooldown"
        # Should be between 55-60 (allowing for the latency between tests)
        assert 50 <= data["start_cooldown_seconds"] <= 60, (
            f"start_cooldown_seconds out of band: {data['start_cooldown_seconds']}"
        )
        assert data["next_session_available_at"] is not None

    def test_04_start_during_cooldown_returns_429(self, api):
        r = api.post(f"{BASE_URL}/api/mining/start/{ELITE_UID}")
        assert r.status_code == 429, f"Expected 429 during cooldown, got {r.status_code}: {r.text}"
        body = r.json()
        detail = body.get("detail", "")
        assert "wait" in detail.lower() and "before starting the next session" in detail.lower(), (
            f"Unexpected 429 detail: {detail}"
        )

    def test_05_db_persistence_after_collect(self, mongo):
        async def _check():
            u = await mongo.users.find_one({"uid": ELITE_UID})
            assert u is not None
            assert u.get("mining_active") is False
            assert u.get("mining_start_time") is None
            assert u.get("mining_session_end") is None
            nxt = u.get("next_session_available_at")
            assert nxt, "next_session_available_at not persisted"
            # It must be an ISO string and roughly in the future (or just past — within ~60s window)
            nxt_dt = datetime.fromisoformat(nxt.replace('Z', '+00:00'))
            delta = (nxt_dt - datetime.now(timezone.utc)).total_seconds()
            assert -10 <= delta <= 65, f"next_session_available_at delta out of band: {delta}"
        asyncio.get_event_loop().run_until_complete(_check())

    def test_06_backdate_cooldown_then_start_succeeds(self, api, mongo):
        # Backdate next_session_available_at to the past
        async def _backdate():
            past = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
            await mongo.users.update_one(
                {"uid": ELITE_UID},
                {"$set": {"next_session_available_at": past}}
            )
        asyncio.get_event_loop().run_until_complete(_backdate())

        r = api.post(f"{BASE_URL}/api/mining/start/{ELITE_UID}")
        assert r.status_code == 200, f"Expected 200 after cooldown cleared, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is True
        assert data["session_start"]
        assert data["session_end"]

        # DB: mining_active=True, next_session_available_at cleared
        async def _verify():
            u = await mongo.users.find_one({"uid": ELITE_UID})
            assert u.get("mining_active") is True
            assert u.get("next_session_available_at") in (None, "")
            assert u.get("mining_start_time") is not None
            assert u.get("mining_session_end") is not None
        asyncio.get_event_loop().run_until_complete(_verify())

    def test_07_shared_state_post_manual_start(self, api):
        r = api.get(f"{BASE_URL}/api/mining/status/{ELITE_UID}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mining_active"] is True
        assert data["session_active"] is True
        assert data["can_start"] is False
        assert data["start_cooldown_seconds"] == 0


# --------------------------- Edge cases ---------------------------

class TestCollectEdgeCases:
    """Negative paths around collect endpoint."""

    def test_explorer_collect_returns_403(self, api, mongo):
        # Make sure no session is active on explorer (no auto-create needed; collect should hit 403 first)
        async def _reset():
            await mongo.users.update_one(
                {"uid": EXPLORER_UID},
                {"$set": {"mining_active": False, "mining_start_time": None, "mining_session_end": None}}
            )
        asyncio.get_event_loop().run_until_complete(_reset())

        r = api.post(f"{BASE_URL}/api/mining/collect/{EXPLORER_UID}")
        assert r.status_code == 403, f"Expected 403 for explorer collect, got {r.status_code}: {r.text}"
        assert "elite" in r.json().get("detail", "").lower()

    def test_elite_no_session_collect_returns_400(self, api, mongo):
        # Reset Suresh to no-session state explicitly
        asyncio.get_event_loop().run_until_complete(_reset_user(mongo, ELITE_UID))

        r = api.post(f"{BASE_URL}/api/mining/collect/{ELITE_UID}")
        assert r.status_code == 400, f"Expected 400 for no active session, got {r.status_code}: {r.text}"
        assert "no active mining session" in r.json().get("detail", "").lower()


# --------------------------- Regressions ---------------------------

class TestRegressions:
    """Ensure unrelated endpoints didn't regress with the cooldown change."""

    def test_rate_breakdown_returns_six_tiers(self, api):
        r = api.get(f"{BASE_URL}/api/mining/rate-breakdown/{ELITE_UID}")
        assert r.status_code == 200, r.text
        data = r.json()
        # Look for the 6 tier fields (presence-only)
        for k in (
            "cap_tier1_base",
            "cap_tier2_bonus",
            "cap_tier3_bonus",
            "cap_tier4_bonus",
            "cap_tier5_bonus",
            "cap_tier6_bonus",
        ):
            assert k in data, f"Missing cap field {k} in rate-breakdown response: {list(data.keys())}"
        # Sanity: tier1 is 800
        assert data["cap_tier1_base"] == 800

    def test_prc_fixed_rate_unchanged(self, api):
        r = api.get(f"{BASE_URL}/api/growth/prc-rate")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("prc_rate") == 10
