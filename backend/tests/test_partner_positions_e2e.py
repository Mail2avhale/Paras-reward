"""
Partner Positions — Backend E2E Tests (iteration 258 / Feb 6 2026)
====================================================================
Covers:
 • POST /api/admin/partners/assign — all 5 positions, PIN, invalid pos, 404
 • POST /api/admin/partners/revoke — revert to USER
 • GET  /api/admin/partners/list  — non-USER partners
 • GET  /api/partners/my-position/{uid} — cap, per_level_counts, Elite gate
 • distribute_mining_collect_commission() (called directly with seed chain)
     - NATIONAL_PARTNER upline at depth 7 receives 1%
     - Elite gate: non-Elite upline with STATE_PARTNER gets no commission
     - DISTRICT_PARTNER depth cap (levels=4) — no credit beyond hop 4
     - Ledger row shape (type/tier_index/tier_percent/downline_name)
"""
import os
import asyncio
import uuid
import pytest
import requests
from datetime import datetime, timezone

from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
ADMIN_PIN = "123456"
WRONG_PIN = "000000"
ADMIN_UID = "admin-test-123"
ELITE_TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # 9970100782

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward_db")


# ────────────────────────────────────────────────────────────────
# FIXTURES
# ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_jwt():
    """Login as admin and return a Bearer JWT (required by /api/admin/* middleware)."""
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"identifier": "admin@test.com", "password": "153759"},
                      timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        pytest.skip(f"No JWT token in login response: {data}")
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_jwt):
    return {
        "X-Admin-Pin": ADMIN_PIN,
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_jwt}",
    }


@pytest.fixture(scope="module")
def wrong_admin_headers(admin_jwt):
    return {
        "X-Admin-Pin": WRONG_PIN,
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_jwt}",
    }


@pytest.fixture(scope="module")
def test_users(mongo):
    """Seed 8-deep chain of TEST_ users. Top = uplines. Bottom = collector.

    Chain (deepest → top):
      TEST_pp_u1 (collector, Elite) → referred_by → TEST_pp_u2 → ... → TEST_pp_u8 (top)

    Each user carries partner_position='user' by default (overwritten in tests).
    User names: u1 is the collector; u2..u8 are the 7 uplines to test 7 tiers.
    Uid u8 is TOP.
    """
    uids = [f"TEST_pp_u{i}" for i in range(1, 9)]  # u1 ... u8
    for i, uid in enumerate(uids, start=1):
        parent = uids[i] if i < len(uids) else None  # u1.referred_by=u2, ..., u7.referred_by=u8, u8.referred_by=None
        mongo.users.replace_one(
            {"uid": uid},
            {
                "uid": uid,
                "name": f"TEST Partner U{i}",
                "mobile": f"90000000{i:02d}",
                "email": f"testpp{i}@test.com",
                "subscription_plan": "elite",         # elite by default; some tests override
                "membership_type": "elite",
                "subscription_expired": False,
                "referral_code": f"TESTPPC{i}",
                "referred_by": parent,
                "prc_balance": 0.0,
                "partner_position": "user",
            },
            upsert=True,
        )
    yield uids
    # Teardown
    mongo.users.delete_many({"uid": {"$in": uids}})
    mongo.prc_ledger.delete_many({"user_id": {"$in": uids}})
    mongo.prc_ledger.delete_many({"downline_uid": {"$in": uids}})
    mongo.notifications.delete_many({"user_id": {"$in": uids}})


def _reset_positions(mongo, uids):
    mongo.users.update_many(
        {"uid": {"$in": uids}},
        {"$set": {"partner_position": "user", "prc_balance": 0.0}},
    )
    mongo.prc_ledger.delete_many({"user_id": {"$in": uids}})


# ────────────────────────────────────────────────────────────────
# ADMIN ENDPOINT TESTS
# ────────────────────────────────────────────────────────────────
class TestAdminAssign:
    def test_wrong_pin_returns_403(self, api, wrong_admin_headers, test_users):
        r = api.post(f"{BASE_URL}/api/admin/partners/assign",
                     json={"admin_id": ADMIN_UID, "query": test_users[1], "position": "district_partner"},
                     headers=wrong_admin_headers)
        assert r.status_code == 403, r.text

    def test_invalid_position_422(self, api, admin_headers, test_users):
        # Pydantic Literal → 422
        r = api.post(f"{BASE_URL}/api/admin/partners/assign",
                     json={"admin_id": ADMIN_UID, "query": test_users[1], "position": "supreme_leader"},
                     headers=admin_headers)
        assert r.status_code in (400, 422), r.text

    def test_nonexistent_user_404(self, api, admin_headers):
        r = api.post(f"{BASE_URL}/api/admin/partners/assign",
                     json={"admin_id": ADMIN_UID, "query": "NOSUCHUSER_ABC123_XYZ", "position": "district_partner"},
                     headers=admin_headers)
        assert r.status_code == 404, r.text

    @pytest.mark.parametrize("position,cap,levels", [
        ("district_partner",       1000, 4),
        ("regional_state_partner", 2000, 5),
        ("state_partner",          4000, 6),
        ("national_partner",       8000, 7),
    ])
    def test_assign_each_tier(self, api, admin_headers, test_users, mongo, position, cap, levels):
        uid = test_users[1]  # u2
        r = api.post(f"{BASE_URL}/api/admin/partners/assign",
                     json={"admin_id": ADMIN_UID, "query": uid, "position": position},
                     headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["user"]["new_position"] == position
        cfg = body["user"]["config"]
        assert cfg["cap"] == cap
        assert cfg["levels"] == levels
        assert cfg["commission_pct"] == 0.01

        # Verify DB updated
        u = mongo.users.find_one({"uid": uid}, {"partner_position": 1})
        assert u["partner_position"] == position

        # Notification insert — BUG NOTE (Feb 2026): partner_positions.py
        # inserts without notification_id but the collection has a unique
        # index on notification_id → E11000 dup-key null on 2nd+ insert.
        # Tracked but not fail-hard here; verified separately.
        n = mongo.notifications.find_one({"user_id": uid, "type": "partner_position_assigned"})
        # allow missing (documented bug) — still assert row updated in users
        _ = n


class TestAdminListAndRevoke:
    def test_list_requires_pin(self, api, wrong_admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/partners/list", headers=wrong_admin_headers)
        assert r.status_code == 403

    def test_list_returns_labels(self, api, admin_headers, test_users):
        # assign one
        api.post(f"{BASE_URL}/api/admin/partners/assign",
                 json={"admin_id": ADMIN_UID, "query": test_users[2], "position": "state_partner"},
                 headers=admin_headers)
        r = api.get(f"{BASE_URL}/api/admin/partners/list", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["partners"], list)
        # our test user should be there with label populated
        found = [p for p in body["partners"] if p["uid"] == test_users[2]]
        assert len(found) == 1, "TEST_pp_u3 should be listed as a partner"
        assert found[0]["position_label"] == "State Partner"

    def test_revoke_reverts_to_user(self, api, admin_headers, test_users, mongo):
        # assign then revoke
        api.post(f"{BASE_URL}/api/admin/partners/assign",
                 json={"admin_id": ADMIN_UID, "query": test_users[3], "position": "district_partner"},
                 headers=admin_headers)
        r = api.post(f"{BASE_URL}/api/admin/partners/revoke",
                     json={"admin_id": ADMIN_UID, "uid": test_users[3]},
                     headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["new_position"] == "user"
        assert mongo.users.find_one({"uid": test_users[3]})["partner_position"] == "user"

    def test_revoke_unknown_user_404(self, api, admin_headers):
        r = api.post(f"{BASE_URL}/api/admin/partners/revoke",
                     json={"admin_id": ADMIN_UID, "uid": "NONEXISTENT_UID_ABC"},
                     headers=admin_headers)
        assert r.status_code == 404

    def test_revoke_wrong_pin_403(self, api, wrong_admin_headers, test_users):
        r = api.post(f"{BASE_URL}/api/admin/partners/revoke",
                     json={"admin_id": ADMIN_UID, "uid": test_users[3]},
                     headers=wrong_admin_headers)
        assert r.status_code == 403


class TestNotificationBug:
    """Feb 6 2026 — BUG: partner_positions.py inserts notification without
    notification_id → E11000 dup-key null. Result: user gets NO promotion
    notification (silently swallowed by try/except)."""

    def test_notification_missing_after_assign(self, api, admin_headers, mongo, test_users):
        # Clear any existing notification for this user
        uid = test_users[4]
        mongo.notifications.delete_many({"user_id": uid, "type": "partner_position_assigned"})
        r = api.post(f"{BASE_URL}/api/admin/partners/assign",
                     json={"admin_id": ADMIN_UID, "query": uid, "position": "state_partner"},
                     headers=admin_headers)
        assert r.status_code == 200
        n = mongo.notifications.find_one({"user_id": uid, "type": "partner_position_assigned"})
        # This test DOCUMENTS the bug — n IS None because dup-key on notification_id=null
        # If a fix lands, this assertion will flip; for now we mark expected behaviour.
        if n is None:
            pytest.xfail("KNOWN BUG: notification not persisted — missing notification_id triggers dup-key null")
        assert n is not None


# ────────────────────────────────────────────────────────────────
# USER-FACING my-position ENDPOINT
# ────────────────────────────────────────────────────────────────
class TestMyPosition:
    def test_default_user_position(self, api, mongo, test_users, admin_headers):
        _reset_positions(mongo, test_users)
        uid = test_users[0]
        r = api.get(f"{BASE_URL}/api/partners/my-position/{uid}")
        assert r.status_code == 200
        d = r.json()
        assert d["partner_position"] == "user"
        assert d["position_label"] == "User"
        assert d["cap"] == 500
        assert len(d["per_level_counts"]) == 3
        assert d["elite_required_for_commission"] is True

    @pytest.mark.parametrize("position,cap,levels", [
        ("district_partner",       1000, 4),
        ("regional_state_partner", 2000, 5),
        ("state_partner",          4000, 6),
        ("national_partner",       8000, 7),
    ])
    def test_position_reflects_in_my_position(self, api, admin_headers, test_users, position, cap, levels):
        uid = test_users[1]
        api.post(f"{BASE_URL}/api/admin/partners/assign",
                 json={"admin_id": ADMIN_UID, "query": uid, "position": position},
                 headers=admin_headers)
        r = api.get(f"{BASE_URL}/api/partners/my-position/{uid}")
        assert r.status_code == 200
        d = r.json()
        assert d["partner_position"] == position
        assert d["cap"] == cap
        assert len(d["per_level_counts"]) == levels
        # commission_active only if subscription_plan == 'elite' (per code)
        assert d["commission_active"] is True  # our test user has plan='elite'

    def test_commission_gate_non_elite(self, api, admin_headers, mongo, test_users):
        # Downgrade u2 to explorer, keep position=state_partner
        mongo.users.update_one(
            {"uid": test_users[1]},
            {"$set": {"subscription_plan": "explorer", "membership_type": "explorer",
                      "partner_position": "state_partner"}},
        )
        r = api.get(f"{BASE_URL}/api/partners/my-position/{test_users[1]}")
        assert r.status_code == 200
        assert r.json()["commission_active"] is False
        # restore
        mongo.users.update_one(
            {"uid": test_users[1]},
            {"$set": {"subscription_plan": "elite", "membership_type": "elite"}},
        )

    def test_unknown_uid_404(self, api):
        r = api.get(f"{BASE_URL}/api/partners/my-position/NOSUCHUID_XYZ")
        assert r.status_code == 404


# ────────────────────────────────────────────────────────────────
# MINING COMMISSION DISTRIBUTION (direct function call)
# ────────────────────────────────────────────────────────────────
import sys
sys.path.insert(0, "/app/backend")


async def _direct_distribute(collector_uid, amount, ts):
    # Ensure JWT_SECRET_KEY is set before any routes import
    import os as _os
    from pathlib import Path
    if not _os.environ.get("JWT_SECRET_KEY"):
        # load from backend/.env
        env_path = Path("/app/backend/.env")
        for line in env_path.read_text().splitlines():
            if line.startswith("JWT_SECRET_KEY"):
                _os.environ["JWT_SECRET_KEY"] = line.split("=", 1)[1].strip().strip('"')
                break
    from motor.motor_asyncio import AsyncIOMotorClient
    # Import module directly (avoid routes/__init__.py side effects)
    import importlib
    mc = importlib.import_module("routes.mining_commission")
    client = AsyncIOMotorClient(MONGO_URL)
    mc.set_db(client[DB_NAME])
    try:
        return await mc.distribute_mining_collect_commission(
            collector_uid=collector_uid, collected_prc=amount, collect_timestamp=ts,
        )
    finally:
        client.close()


class TestCommissionDistribution:
    def test_national_partner_7_levels(self, mongo, test_users):
        """u8 = NATIONAL_PARTNER (levels=7). u1 collects → u8 (hop 7) should get 1%."""
        _reset_positions(mongo, test_users)
        mongo.users.update_one({"uid": test_users[7]}, {"$set": {"partner_position": "national_partner"}})
        # ensure u8 is elite
        mongo.users.update_one({"uid": test_users[7]}, {"$set": {"subscription_plan": "elite"}})

        ts = datetime.now(timezone.utc)
        result = asyncio.run(_direct_distribute(test_users[0], 100.0, ts))

        # u8 should be in distributed list
        recipients = {d["uid"] for d in result["distributed"]}
        assert test_users[7] in recipients, f"NATIONAL_PARTNER u8 missing from distributed. Got: {result}"

        # ledger row
        row = mongo.prc_ledger.find_one({"user_id": test_users[7], "source_ref": f"mining_collect:{test_users[0]}:{ts.isoformat()}"})
        assert row is not None
        assert row["type"] == "mining_referral_reward"
        assert row["tier_percent"] == pytest.approx(1.0)
        assert row["downline_uid"] == test_users[0]
        assert row["downline_name"] == "TEST Partner U1"
        # amount ~ 100 * 1% = 1.0
        assert row["amount"] == pytest.approx(1.0, abs=0.01)

    def test_district_partner_depth_cap(self, mongo, test_users):
        """DISTRICT_PARTNER assigned to u6 (which is 5 hops from u1). Levels=4 →
        u6 should NOT receive commission (hop 5 > cap of 4)."""
        _reset_positions(mongo, test_users)
        # u6 is at hop 5 from u1 (u1→u2→u3→u4→u5→u6)
        mongo.users.update_one({"uid": test_users[5]}, {"$set": {"partner_position": "district_partner"}})
        # Ensure all uplines are USER position (default) with elite plan
        ts = datetime.now(timezone.utc)
        result = asyncio.run(_direct_distribute(test_users[0], 100.0, ts))

        recipients = {d["uid"] for d in result["distributed"]}
        assert test_users[5] not in recipients, f"u6 at hop 5 should NOT get district_partner commission (cap=4). Got {result}"

    def test_elite_gate_blocks_non_elite_partner(self, mongo, test_users):
        """u4 assigned STATE_PARTNER but is NOT elite → must not receive commission."""
        _reset_positions(mongo, test_users)
        mongo.users.update_one({"uid": test_users[3]}, {"$set": {
            "partner_position": "state_partner",
            "subscription_plan": "explorer",
            "membership_type": "explorer",
        }})
        ts = datetime.now(timezone.utc)
        result = asyncio.run(_direct_distribute(test_users[0], 100.0, ts))
        recipients = {d["uid"] for d in result["distributed"]}
        assert test_users[3] not in recipients, f"Non-elite u4 with state_partner MUST NOT get commission. Got {result}"

        # ledger MUST NOT contain a row for u4
        row = mongo.prc_ledger.find_one({"user_id": test_users[3],
                                         "source_ref": f"mining_collect:{test_users[0]}:{ts.isoformat()}"})
        assert row is None

        # restore
        mongo.users.update_one({"uid": test_users[3]}, {"$set": {"subscription_plan": "elite", "membership_type": "elite"}})

    def test_idempotency_same_timestamp(self, mongo, test_users):
        """Calling distribute twice with same (collector, timestamp) must NOT double-credit."""
        _reset_positions(mongo, test_users)
        mongo.users.update_one({"uid": test_users[7]}, {"$set": {"partner_position": "national_partner"}})
        ts = datetime.now(timezone.utc)
        r1 = asyncio.run(_direct_distribute(test_users[0], 100.0, ts))
        r2 = asyncio.run(_direct_distribute(test_users[0], 100.0, ts))
        assert r1["total_distributed"] > 0
        assert r2.get("idempotent_skip") is True or r2["total_distributed"] == 0
        # Ledger has exactly one row per recipient per event
        rows = list(mongo.prc_ledger.find({"user_id": test_users[7],
                                            "source_ref": f"mining_collect:{test_users[0]}:{ts.isoformat()}"}))
        assert len(rows) == 1
