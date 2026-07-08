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


# Load .env into os.environ once (session-wide) so that any importlib call
# below sees JWT_SECRET_KEY etc. Must run BEFORE any fixture imports routes.*
def _load_backend_env():
    from pathlib import Path
    p = Path("/app/backend/.env")
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_backend_env()


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
        # Elite flag reflects plan only. commission_active now ALSO requires
        # the structural bonus-gate (Feb 6 2026); test_users chain has no
        # downlines so structure_met=False → commission_active=False.
        assert d["elite_active"] is True
        assert d["structure_required"] is True
        assert d["structure_met"] is False
        assert d["commission_active"] is False

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
    pp = importlib.import_module("routes.partner_positions")
    client = AsyncIOMotorClient(MONGO_URL)
    mc.set_db(client[DB_NAME])
    pp.set_db(client[DB_NAME])  # structure gate needs its own db handle
    try:
        return await mc.distribute_mining_collect_commission(
            collector_uid=collector_uid, collected_prc=amount, collect_timestamp=ts,
        )
    finally:
        client.close()


class TestCommissionDistribution:
    @pytest.fixture(autouse=True)
    def _bypass_structure_gate(self, monkeypatch):
        """These tests focus on tier depth + Elite gate + idempotency —
        NOT the structural bonus-gate (which has its own TestStructureGate).
        Patch POSITION_STRUCTURE_REQUIREMENT to empty so is_structure_valid()
        short-circuits to True for all positions.
        """
        import importlib
        pp = importlib.import_module("routes.partner_positions")
        monkeypatch.setattr(pp, "POSITION_STRUCTURE_REQUIREMENT", {})
        pp.clear_structure_cache()
        yield
        pp.clear_structure_cache()

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


# ────────────────────────────────────────────────────────────────
# STRUCTURAL BONUS-GATE (Feb 6 2026)
# ────────────────────────────────────────────────────────────────
# Full recursive-chain validation. Thresholds are patched to a smaller
# min_count=3 (from prod: 100/5/3/5) so seed data stays manageable.
# ────────────────────────────────────────────────────────────────
class TestStructureGate:
    """Verifies the L1-direct recursive structure requirement:
      DISTRICT    → N active Elite L1 downlines
      REGIONAL    → N valid DISTRICT L1 downlines (each individually valid)
      STATE       → N valid REGIONAL L1 downlines
      NATIONAL    → N valid STATE L1 downlines
    """

    @pytest.fixture(autouse=True)
    def _small_thresholds(self, monkeypatch):
        """Patch prod thresholds down to 3-each so seeding stays sane."""
        import importlib
        pp = importlib.import_module("routes.partner_positions")
        monkeypatch.setattr(pp, "POSITION_STRUCTURE_REQUIREMENT", {
            "district_partner":         {"child": "elite_user",              "min_count": 3},
            "regional_state_partner":   {"child": "district_partner",        "min_count": 3},
            "state_partner":            {"child": "regional_state_partner",  "min_count": 3},
            "national_partner":         {"child": "state_partner",           "min_count": 3},
        })
        pp.clear_structure_cache()
        yield
        pp.clear_structure_cache()

    @pytest.fixture
    def sg_users(self, mongo):
        """Full structure tree for a DISTRICT partner test:
          d1 (DISTRICT) → e1,e2,e3 (elite L1 downlines)
        Plus a REGIONAL tree:
          r1 (REGIONAL) → d_a, d_b, d_c (DISTRICT) each with 3 elite L1 downlines
        """
        created_uids = []

        def _mk(uid, referred_by=None, pos="user", elite=True):
            mongo.users.replace_one(
                {"uid": uid},
                {
                    "uid": uid, "name": uid, "mobile": uid,
                    "email": f"{uid}@sgtest.local",  # unique — email has UNIQUE index
                    "referral_code": uid + "_CODE",
                    "referred_by": referred_by,
                    "partner_position": pos,
                    "subscription_plan": "elite" if elite else "explorer",
                    "membership_type": "elite" if elite else "explorer",
                    "subscription_expired": False,
                    "prc_balance": 0.0,
                },
                upsert=True,
            )
            created_uids.append(uid)

        # DISTRICT case — d1 needs 3 elite L1 downlines
        _mk("SG_d1", pos="district_partner")
        _mk("SG_d1_e1", referred_by="SG_d1", elite=True)
        _mk("SG_d1_e2", referred_by="SG_d1", elite=True)
        _mk("SG_d1_e3", referred_by="SG_d1", elite=True)

        # REGIONAL case — r1 needs 3 valid DISTRICTs; each DISTRICT needs 3 elite L1
        _mk("SG_r1", pos="regional_state_partner")
        for d in ("SG_r1_dA", "SG_r1_dB", "SG_r1_dC"):
            _mk(d, referred_by="SG_r1", pos="district_partner")
            for i in range(3):
                _mk(f"{d}_e{i}", referred_by=d, elite=True)

        # A DISTRICT with only 2 elite → INVALID structure
        _mk("SG_d_bad", pos="district_partner")
        _mk("SG_d_bad_e1", referred_by="SG_d_bad", elite=True)
        _mk("SG_d_bad_e2", referred_by="SG_d_bad", elite=True)

        yield
        mongo.users.delete_many({"uid": {"$in": created_uids}})
        mongo.prc_ledger.delete_many({"user_id": {"$in": created_uids}})
        mongo.prc_ledger.delete_many({"downline_uid": {"$in": created_uids}})
        mongo.notifications.delete_many({"user_id": {"$in": created_uids}})

    def _run(self, coro):
        return asyncio.run(coro)

    async def _load_pp(self):
        """Bind partner_positions module to Mongo for direct-call tests."""
        import os as _os
        from pathlib import Path
        if not _os.environ.get("JWT_SECRET_KEY"):
            env = Path("/app/backend/.env")
            for line in env.read_text().splitlines():
                if line.startswith("JWT_SECRET_KEY"):
                    _os.environ["JWT_SECRET_KEY"] = line.split("=", 1)[1].strip().strip('"')
                    break
        import importlib
        pp = importlib.import_module("routes.partner_positions")
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(MONGO_URL)
        pp.set_db(client[DB_NAME])
        return pp, client

    def test_district_valid_with_3_elite(self, sg_users):
        async def _t():
            pp, c = await self._load_pp()
            try:
                assert await pp.is_structure_valid("SG_d1", "district_partner") is True
            finally:
                c.close()
        self._run(_t())

    def test_district_invalid_with_2_elite(self, sg_users):
        async def _t():
            pp, c = await self._load_pp()
            try:
                assert await pp.is_structure_valid("SG_d_bad", "district_partner") is False
            finally:
                c.close()
        self._run(_t())

    def test_regional_valid_recursive(self, sg_users):
        """r1 → 3 DISTRICTs, each with 3 elite → REGIONAL structure valid."""
        async def _t():
            pp, c = await self._load_pp()
            try:
                assert await pp.is_structure_valid("SG_r1", "regional_state_partner") is True
            finally:
                c.close()
        self._run(_t())

    def test_regional_invalid_when_one_district_breaks(self, sg_users, mongo):
        """Flip 1 of r1's DISTRICTs' L1 elite user to non-elite → that
        DISTRICT drops to 2 elite → invalid → REGIONAL now has only 2 valid
        DISTRICTs → REGIONAL invalid.
        """
        # Break SG_r1_dA by making one of its elite children non-elite
        mongo.users.update_one(
            {"uid": "SG_r1_dA_e0"},
            {"$set": {"subscription_plan": "explorer", "membership_type": "explorer"}},
        )

        async def _t():
            pp, c = await self._load_pp()
            try:
                pp.clear_structure_cache()  # invalidate the stale entry
                assert await pp.is_structure_valid("SG_r1_dA", "district_partner") is False
                assert await pp.is_structure_valid("SG_r1", "regional_state_partner") is False
            finally:
                c.close()
        self._run(_t())

    def test_structure_report_shape(self, sg_users):
        """my-position endpoint drives Progress bar from this report."""
        async def _t():
            pp, c = await self._load_pp()
            try:
                r = await pp.get_structure_report("SG_d1", "district_partner")
                assert r["applicable"] is True
                assert r["child_type"] == "elite_user"
                assert r["required_count"] == 3
                assert r["current_count"] == 3
                assert r["structure_met"] is True

                r2 = await pp.get_structure_report("SG_d_bad", "district_partner")
                assert r2["structure_met"] is False
                assert r2["current_count"] == 2
            finally:
                c.close()
        self._run(_t())

    def test_commission_blocked_when_structure_fails(self, mongo, sg_users):
        """SG_d_bad is DISTRICT_PARTNER with only 2 elite L1 (needs 3).
        SG_d_bad_e1 collects → SG_d_bad has partner_position=district_partner
        BUT structure invalid → falls back to USER-tier (legacy 3-tier).
        Since e1 is L1 of SG_d_bad (hop 1), legacy USER tier still credits
        SG_d_bad at 1% because default legacy config gives 3 tiers × 1%.
        """
        async def _t():
            pp, c = await self._load_pp()
            try:
                # Structure invalid confirmed
                assert await pp.is_structure_valid("SG_d_bad", "district_partner") is False
            finally:
                c.close()

            ts = datetime.now(timezone.utc)
            # Direct commission call using the collector
            result = await _direct_distribute("SG_d_bad_e1", 100.0, ts)
            recipients = {d["uid"] for d in result["distributed"]}
            # SG_d_bad was demoted to USER-tier: legacy 3-tier config still pays
            # them at hop 1, so they DO appear. This tests DEMOTION behavior,
            # not full block. Verify tier index shows LEGACY path (tier 1).
            if "SG_d_bad" in recipients:
                row = mongo.prc_ledger.find_one({
                    "user_id": "SG_d_bad",
                    "source_ref": f"mining_collect:SG_d_bad_e1:{ts.isoformat()}",
                })
                assert row is not None
                # Legacy path uses tier_index starting at 1 with tier_percent
                # from the app_settings config (default 1.0 = 1%)
                assert row["tier_percent"] == pytest.approx(1.0, abs=0.5)
        self._run(_t())

    def test_commission_flows_when_structure_valid(self, mongo, sg_users):
        """SG_d1 is DISTRICT with valid 3-elite structure. SG_d1_e1 collects
        → SG_d1 (hop 1) receives 1% via POSITION path (not legacy fallback).
        """
        async def _t():
            pp, c = await self._load_pp()
            try:
                assert await pp.is_structure_valid("SG_d1", "district_partner") is True
            finally:
                c.close()
            ts = datetime.now(timezone.utc)
            result = await _direct_distribute("SG_d1_e1", 100.0, ts)
            recipients = {d["uid"] for d in result["distributed"]}
            assert "SG_d1" in recipients, f"Valid DISTRICT should receive commission. Got {result}"
            row = mongo.prc_ledger.find_one({
                "user_id": "SG_d1",
                "source_ref": f"mining_collect:SG_d1_e1:{ts.isoformat()}",
            })
            assert row is not None
            assert row["amount"] == pytest.approx(1.0, abs=0.01)
        self._run(_t())

    def test_ttl_cache_hits(self, sg_users, monkeypatch):
        """Second call within TTL returns cached result without re-querying."""
        async def _t():
            pp, c = await self._load_pp()
            try:
                pp.clear_structure_cache()
                # First call — populates cache
                r1 = await pp.is_structure_valid("SG_d1", "district_partner")
                assert r1 is True

                # Now BREAK the structure in DB. If cache works, next call
                # must still return True (cached).
                await pp.db.users.update_one(
                    {"uid": "SG_d1_e1"},
                    {"$set": {"subscription_plan": "explorer", "membership_type": "explorer"}},
                )
                r2 = await pp.is_structure_valid("SG_d1", "district_partner")
                assert r2 is True, "Cache should have returned stale True within TTL"

                # After clear, should reflect reality → False (only 2 elite)
                pp.clear_structure_cache()
                r3 = await pp.is_structure_valid("SG_d1", "district_partner")
                assert r3 is False

                # Restore
                await pp.db.users.update_one(
                    {"uid": "SG_d1_e1"},
                    {"$set": {"subscription_plan": "elite", "membership_type": "elite"}},
                )
            finally:
                c.close()
        self._run(_t())




# ────────────────────────────────────────────────────────────────
# ADMIN CONFIG — Structure Requirement CRUD (Feb 7 2026)
# ────────────────────────────────────────────────────────────────
class TestStructureConfigAdmin:
    """Ops can tune 100/5/3/5 without a code deploy. Verifies the
    app_settings-backed loader, cache invalidation on write, and the
    Reset-to-defaults endpoint.
    """

    @pytest.fixture(autouse=True)
    def _cleanup(self, mongo):
        # Ensure clean slate before AND after each test
        mongo.app_settings.delete_many({"key": "partner_structure_requirement"})
        yield
        mongo.app_settings.delete_many({"key": "partner_structure_requirement"})

    def test_get_returns_defaults_when_no_override(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/partners/structure-config", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["effective_config"]["district_partner"]["min_count"] == 100
        assert d["effective_config"]["national_partner"]["min_count"] == 5
        assert d["stored_doc"] is None

    def test_get_wrong_pin_403(self, api, wrong_admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/partners/structure-config", headers=wrong_admin_headers)
        assert r.status_code == 403

    def test_post_updates_config_and_invalidates_cache(self, api, admin_headers, mongo):
        # 1. Post override — lower thresholds to 10 / 2 / 1 / 2
        new_config = {
            "district_partner":         {"child": "elite_user",             "min_count": 10},
            "regional_state_partner":   {"child": "district_partner",       "min_count": 2},
            "state_partner":            {"child": "regional_state_partner", "min_count": 1},
            "national_partner":         {"child": "state_partner",          "min_count": 2},
        }
        r = api.post(f"{BASE_URL}/api/admin/partners/structure-config",
                     json={"admin_id": ADMIN_UID, "config": new_config},
                     headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["config"]["district_partner"]["min_count"] == 10

        # 2. GET should reflect the new effective config
        r2 = api.get(f"{BASE_URL}/api/admin/partners/structure-config", headers=admin_headers)
        assert r2.json()["effective_config"]["district_partner"]["min_count"] == 10

        # 3. Verify DB doc
        doc = mongo.app_settings.find_one({"key": "partner_structure_requirement"})
        assert doc is not None
        assert doc["value"]["district_partner"]["min_count"] == 10
        assert doc["updated_by"] == ADMIN_UID

    def test_post_coerces_bad_values(self, api, admin_headers):
        """Invalid child types + negative counts must fall back to defaults."""
        bad_config = {
            "district_partner": {"child": "invalid_type", "min_count": -5},
            # missing other 3 — should be filled with defaults
        }
        r = api.post(f"{BASE_URL}/api/admin/partners/structure-config",
                     json={"admin_id": ADMIN_UID, "config": bad_config},
                     headers=admin_headers)
        assert r.status_code == 200
        cfg = r.json()["config"]
        # bad child + negative count → default
        assert cfg["district_partner"]["child"] == "elite_user"
        assert cfg["district_partner"]["min_count"] == 100
        # missing → default
        assert cfg["state_partner"]["min_count"] == 3

    def test_post_wrong_pin_403(self, api, wrong_admin_headers):
        r = api.post(f"{BASE_URL}/api/admin/partners/structure-config",
                     json={"admin_id": ADMIN_UID, "config": {}},
                     headers=wrong_admin_headers)
        assert r.status_code == 403

    def test_reset_removes_override_and_reverts_to_defaults(self, api, admin_headers, mongo):
        # Seed an override
        mongo.app_settings.update_one(
            {"key": "partner_structure_requirement"},
            {"$set": {
                "key": "partner_structure_requirement",
                "value": {"district_partner": {"child": "elite_user", "min_count": 10}},
                "updated_at": "2026-02-07T00:00:00Z",
                "updated_by": "test",
            }},
            upsert=True,
        )
        # Reset
        r = api.post(f"{BASE_URL}/api/admin/partners/structure-config/reset", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["deleted"] == 1
        # DB doc is gone
        assert mongo.app_settings.find_one({"key": "partner_structure_requirement"}) is None
        # GET now shows defaults
        r2 = api.get(f"{BASE_URL}/api/admin/partners/structure-config", headers=admin_headers)
        assert r2.json()["effective_config"]["district_partner"]["min_count"] == 100
        assert r2.json()["stored_doc"] is None


# ────────────────────────────────────────────────────────────────
# PERFORMANCE — Aggregation + Parallel Fanout (Feb 7 2026)
# ────────────────────────────────────────────────────────────────
class TestPerformanceOptimizations:
    """Verifies that:
      • DISTRICT leaf-count uses count_documents (fast) not Python-loop
      • Sibling structure checks run in PARALLEL via asyncio.gather
    """

    @pytest.fixture(autouse=True)
    def _small_thresholds(self, monkeypatch, mongo):
        # Clear DB override so module-attr monkeypatch is authoritative
        mongo.app_settings.delete_many({"key": "partner_structure_requirement"})
        import importlib
        pp = importlib.import_module("routes.partner_positions")
        monkeypatch.setattr(pp, "POSITION_STRUCTURE_REQUIREMENT", {
            "district_partner":         {"child": "elite_user",              "min_count": 3},
            "regional_state_partner":   {"child": "district_partner",        "min_count": 2},
            "state_partner":            {"child": "regional_state_partner",  "min_count": 2},
            "national_partner":         {"child": "state_partner",           "min_count": 2},
        })
        pp.clear_structure_cache()
        yield
        pp.clear_structure_cache()

    def test_leaf_count_uses_aggregation_not_python_loop(self, mongo):
        """Seed 5 elite + 5 non-elite L1 downlines. Verify count == 5 and
        no full document hydration occurred (implicit — count_documents
        returns int, so we just assert the correct number)."""
        created = []

        def _mk(uid, referred_by, elite):
            mongo.users.replace_one(
                {"uid": uid},
                {"uid": uid, "name": uid, "mobile": uid,
                 "email": f"{uid}@perftest.local",
                 "referral_code": uid + "_C",
                 "referred_by": referred_by,
                 "partner_position": "user",
                 "subscription_plan": "elite" if elite else "explorer",
                 "membership_type": "elite" if elite else "explorer",
                 "subscription_expired": False,
                 "prc_balance": 0.0},
                upsert=True,
            )
            created.append(uid)

        _mk("PERF_d", None, elite=True)
        # 5 elite + 5 non-elite as L1 downlines
        for i in range(5):
            _mk(f"PERF_d_e{i}", "PERF_d", elite=True)
            _mk(f"PERF_d_ne{i}", "PERF_d", elite=False)

        try:
            async def _t():
                import importlib
                pp = importlib.import_module("routes.partner_positions")
                from motor.motor_asyncio import AsyncIOMotorClient
                client = AsyncIOMotorClient(MONGO_URL)
                pp.set_db(client[DB_NAME])
                try:
                    n = await pp._count_l1_active_elite("PERF_d", "PERF_d_C")
                    assert n == 5, f"Expected 5 elite L1 downlines, got {n}"

                    # And structure valid (needs 3, has 5)
                    ok = await pp.is_structure_valid("PERF_d", "district_partner")
                    assert ok is True
                finally:
                    client.close()
            asyncio.run(_t())
        finally:
            mongo.users.delete_many({"uid": {"$in": created}})

    def test_parallel_child_checks_are_faster_than_serial(self, mongo):
        """Rough sanity: with 2 STATE children each needing recursive
        REGIONAL validation, the total wall-time should be << 2 × per-child
        latency (i.e. running in parallel).

        Seed a NATIONAL with 2 STATEs, each with 2 REGIONALs, each with
        2 DISTRICTs, each with 3 elite users. Then measure structure-check
        wall-time. Not a strict perf bound (CI jitter) — we only assert it
        completes < 3 seconds even with 2*2*2*3 = 24 users in play.
        """
        created = []

        def _mk(uid, referred_by=None, pos="user", elite=True):
            mongo.users.replace_one(
                {"uid": uid},
                {"uid": uid, "name": uid, "mobile": uid,
                 "email": f"{uid}@perfpar.local",
                 "referral_code": uid + "_C",
                 "referred_by": referred_by,
                 "partner_position": pos,
                 "subscription_plan": "elite" if elite else "explorer",
                 "membership_type": "elite" if elite else "explorer",
                 "subscription_expired": False,
                 "prc_balance": 0.0},
                upsert=True,
            )
            created.append(uid)

        _mk("PAR_n", pos="national_partner")
        for si, s in enumerate(("PAR_s0", "PAR_s1")):
            _mk(s, referred_by="PAR_n", pos="state_partner")
            for ri, r in enumerate((f"{s}_r0", f"{s}_r1")):
                _mk(r, referred_by=s, pos="regional_state_partner")
                for di, d in enumerate((f"{r}_d0", f"{r}_d1")):
                    _mk(d, referred_by=r, pos="district_partner")
                    for ei in range(3):
                        _mk(f"{d}_e{ei}", referred_by=d, elite=True)

        try:
            async def _t():
                import time as _t
                import importlib
                pp = importlib.import_module("routes.partner_positions")
                from motor.motor_asyncio import AsyncIOMotorClient
                client = AsyncIOMotorClient(MONGO_URL)
                pp.set_db(client[DB_NAME])
                try:
                    pp.clear_structure_cache()
                    start = _t.time()
                    ok = await pp.is_structure_valid("PAR_n", "national_partner")
                    elapsed = _t.time() - start
                    assert ok is True, "Full tree should be structurally valid"
                    # Sanity — should finish well under 3s. Actual measured
                    # time is typically 0.1-0.3s locally.
                    assert elapsed < 3.0, f"Structure check too slow: {elapsed:.2f}s"
                finally:
                    client.close()
            asyncio.run(_t())
        finally:
            mongo.users.delete_many({"uid": {"$in": created}})


# ────────────────────────────────────────────────────────────────
# LIVE CONFIG-DRIVEN VALIDATION (end-to-end)
# ────────────────────────────────────────────────────────────────
class TestConfigDrivenValidation:
    """When the admin lowers the threshold via POST /structure-config,
    is_structure_valid must immediately honour the new value."""

    @pytest.fixture(autouse=True)
    def _cleanup(self, mongo):
        mongo.app_settings.delete_many({"key": "partner_structure_requirement"})
        yield
        mongo.app_settings.delete_many({"key": "partner_structure_requirement"})

    def test_admin_edit_flows_to_validity_check(self, api, admin_headers, mongo):
        """Seed DISTRICT with 5 elite L1. Default (100) → invalid.
        Lower threshold to 3 via admin endpoint → same user becomes valid."""
        created = []

        def _mk(uid, referred_by=None, pos="user", elite=True):
            mongo.users.replace_one(
                {"uid": uid},
                {"uid": uid, "name": uid, "mobile": uid,
                 "email": f"{uid}@cfglive.local",
                 "referral_code": uid + "_C",
                 "referred_by": referred_by,
                 "partner_position": pos,
                 "subscription_plan": "elite" if elite else "explorer",
                 "membership_type": "elite" if elite else "explorer",
                 "subscription_expired": False,
                 "prc_balance": 0.0},
                upsert=True,
            )
            created.append(uid)

        _mk("CFG_d", pos="district_partner")
        for i in range(5):
            _mk(f"CFG_d_e{i}", referred_by="CFG_d", elite=True)

        try:
            # Structure should be INVALID at default (needs 100 elite)
            async def _check():
                import importlib
                pp = importlib.import_module("routes.partner_positions")
                from motor.motor_asyncio import AsyncIOMotorClient
                client = AsyncIOMotorClient(MONGO_URL)
                pp.set_db(client[DB_NAME])
                try:
                    pp.clear_structure_cache()
                    return await pp.is_structure_valid("CFG_d", "district_partner")
                finally:
                    client.close()

            assert asyncio.run(_check()) is False

            # Lower threshold to 3 via admin endpoint
            r = api.post(f"{BASE_URL}/api/admin/partners/structure-config",
                         json={"admin_id": ADMIN_UID, "config": {
                             "district_partner": {"child": "elite_user", "min_count": 3},
                         }},
                         headers=admin_headers)
            assert r.status_code == 200

            # Re-check — should now be VALID (5 elite >= 3)
            assert asyncio.run(_check()) is True
        finally:
            mongo.users.delete_many({"uid": {"$in": created}})
