"""E2E API test — Paras Mall Mining Session LAPSE/BURN (>=24h uncollected).

Verifies (Feb 2026 spec) end-to-end via HTTP against the live preview env:
  1. GET /api/mall/my-bookings/{uid} on an artificially aged (>24h) mining
     booking returns session_expired=True, session_accumulated_prc=0.0,
     can_start_session=True.
  2. POST /api/mall/collect/{booking_id} on the expired session returns HTTP
     400 with exact detail 'Session expired — points lapsed. Please start a
     new mining session.' AND clears session_start in the DB AND increments
     laps_count.
  3. POST /api/mall/start-session/{booking_id} on the (now-cleared) booking
     starts a fresh session (success=True, already_active=False, new
     session_start).
  4. Edge: booking aged to exactly 23h59m30s still mines (not expired,
     accumulated > 0).

Uses Mongo directly to age session_start deterministically. Test snapshots
the picked booking's mutable fields at start and restores them at teardown
so we don't corrupt live user data.
"""
import os
import sys
from datetime import datetime, timezone, timedelta

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

# Load backend .env for Mongo access
BACKEND_ENV = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(BACKEND_ENV)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback: read frontend/.env
    fe = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    if os.path.exists(fe):
        for ln in open(fe):
            if ln.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = ln.split("=", 1)[1].strip().strip('"')
                break
BASE_URL = BASE_URL.rstrip("/")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_MOBILE = "9970100782"
TEST_PIN = "997010"

LAPSED_DETAIL = "Session expired — points lapsed. Please start a new mining session."


# -------- fixtures --------
@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"mobile": TEST_MOBILE, "pin": TEST_PIN},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("token")
    assert tok, "login response missing token"
    return tok


@pytest.fixture(scope="module")
def api(auth_token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    })
    return s


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture()
def mining_booking(mongo):
    """Grab (or create by promoting) a mining booking, snapshot mutable fields,
    restore them at teardown so live data is untouched."""
    b = mongo.mall_bookings.find_one({"user_id": TEST_UID, "status": "mining"})
    assert b is not None, (
        "No mining booking available for TEST_UID — please seed one before running"
    )
    booking_id = b["booking_id"]
    snapshot = {
        "session_start": b.get("session_start"),
        "session_active": b.get("session_active"),
        "next_session_available_at": b.get("next_session_available_at"),
        "last_session_lapsed_at": b.get("last_session_lapsed_at"),
        "laps_count": b.get("laps_count", 0),
        "last_collected_at": b.get("last_collected_at"),
        "paid_prc": b.get("paid_prc", 0),
        "remaining_prc": b.get("remaining_prc"),
        "status": b.get("status"),
    }
    yield booking_id
    # Restore snapshot (best-effort)
    mongo.mall_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": snapshot},
    )


def _age_session(mongo, booking_id, hours=25, minutes=0, seconds=0):
    """Overwrite session_start to be `hours:minutes:seconds` ago and mark
    active. Returns the ISO timestamp written."""
    ts = (
        datetime.now(timezone.utc)
        - timedelta(hours=hours, minutes=minutes, seconds=seconds)
    ).isoformat()
    mongo.mall_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "session_start": ts,
            "session_active": True,
            "next_session_available_at": None,
            "status": "mining",
        }},
    )
    return ts


# -------- tests --------
class TestMallMiningBurnE2E:
    """End-to-end HTTP tests for the 24h lapse/burn behaviour."""

    def test_my_bookings_reports_expired_for_25h_session(
        self, api, mongo, mining_booking
    ):
        """GET /my-bookings/{uid} on a 25h-old session ⇒ session_expired=True,
        session_accumulated_prc=0.0, can_start_session=True."""
        _age_session(mongo, mining_booking, hours=25)

        r = api.get(f"{BASE_URL}/api/mall/my-bookings/{TEST_UID}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        target = next(
            (b for b in data["bookings"] if b["booking_id"] == mining_booking), None
        )
        assert target is not None, "aged booking not present in response"

        # Core assertions — data values, not just field existence
        assert target["session_expired"] is True, (
            f"expected session_expired=True, got {target.get('session_expired')}"
        )
        assert target["session_accumulated_prc"] == 0.0, (
            f"expected accumulated=0.0, got {target.get('session_accumulated_prc')}"
        )
        assert target["session_active"] is False, "session_active must be False"
        assert target["can_start_session"] is True, (
            "user must be able to start a fresh session on lapsed booking"
        )
        assert target["session_remaining_seconds"] == 0
        assert target["per_second_prc"] == 0
        # Elapsed should be well beyond 24h
        assert target["session_elapsed_seconds"] >= 24 * 3600

    def test_collect_on_expired_returns_400_with_lapsed_message(
        self, api, mongo, mining_booking
    ):
        """POST /collect on a 25h-old session ⇒ HTTP 400, exact lapsed detail,
        session_start cleared, laps_count incremented."""
        before = mongo.mall_bookings.find_one({"booking_id": mining_booking})
        laps_before = before.get("laps_count", 0)

        _age_session(mongo, mining_booking, hours=25)

        r = api.post(
            f"{BASE_URL}/api/mall/collect/{mining_booking}",
            json={"user_id": TEST_UID},
            timeout=15,
        )
        assert r.status_code == 400, (
            f"expected 400 lapse, got {r.status_code} body={r.text[:200]}"
        )
        detail = r.json().get("detail", "")
        assert detail == LAPSED_DETAIL, f"unexpected detail: {detail!r}"

        after = mongo.mall_bookings.find_one({"booking_id": mining_booking})
        assert after.get("session_start") is None, (
            "session_start must be cleared after lapse"
        )
        assert after.get("session_active") is False
        assert after.get("last_session_lapsed_at"), (
            "last_session_lapsed_at must be recorded"
        )
        assert after.get("laps_count", 0) == laps_before + 1, (
            "laps_count must increment by 1"
        )
        assert after.get("next_session_available_at") is None, (
            "no cooldown after a lapse"
        )

    def test_start_session_after_lapse_starts_fresh(
        self, api, mongo, mining_booking
    ):
        """POST /start-session on a lapsed booking ⇒ success=True,
        already_active=False, new session_start written."""
        _age_session(mongo, mining_booking, hours=25)

        r = api.post(
            f"{BASE_URL}/api/mall/start-session/{mining_booking}",
            json={"user_id": TEST_UID},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        # already_active should be False — endpoint auto-cleared the stale
        # session and started a new one.
        assert data.get("already_active", False) is False, (
            "should NOT return already_active=True for lapsed session"
        )
        new_start = data.get("session_start")
        assert new_start, "session_start missing in response"

        # Verify DB: session_start is now very recent (< 5 min old)
        after = mongo.mall_bookings.find_one({"booking_id": mining_booking})
        ts = datetime.fromisoformat(after["session_start"].replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - ts).total_seconds()
        assert 0 <= age < 300, f"new session_start should be fresh, age={age}s"
        assert after.get("session_active") is True

    def test_edge_23h59m30s_still_mines(self, api, mongo, mining_booking):
        """Session just under the 24h boundary must still be active with
        accumulated PRC > 0."""
        _age_session(mongo, mining_booking, hours=23, minutes=59, seconds=30)

        r = api.get(f"{BASE_URL}/api/mall/my-bookings/{TEST_UID}", timeout=15)
        assert r.status_code == 200, r.text
        target = next(
            (b for b in r.json()["bookings"] if b["booking_id"] == mining_booking),
            None,
        )
        assert target is not None
        assert target["session_expired"] is False, (
            "23h59m30s session must NOT be expired"
        )
        assert target["session_active"] is True
        assert target["session_accumulated_prc"] > 0, (
            f"expected accumulated>0 near boundary, got "
            f"{target.get('session_accumulated_prc')}"
        )
        assert target["session_elapsed_seconds"] < 24 * 3600

    def test_collect_on_fresh_session_ok(self, api, mongo, mining_booking):
        """Sanity: collect on a fresh (30s) session must NOT return the lapse
        error. It may return 'nothing to collect' or a success — but never the
        lapse detail."""
        _age_session(mongo, mining_booking, hours=0, minutes=0, seconds=30)
        r = api.post(
            f"{BASE_URL}/api/mall/collect/{mining_booking}",
            json={"user_id": TEST_UID},
            timeout=15,
        )
        # 200 or 400('Nothing to collect yet') are both acceptable — NOT the
        # lapsed message.
        if r.status_code == 400:
            detail = r.json().get("detail", "")
            assert detail != LAPSED_DETAIL, (
                "fresh session must not report lapsed"
            )
        else:
            assert r.status_code == 200, r.text


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v", "-s"]))
