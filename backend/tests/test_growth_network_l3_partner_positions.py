"""
Backend tests for Growth Network page (Feb 2026):
- GET /api/notifications/referrals/{uid}/level-breakdown
  - max_depth=3 -> levels keys L1..L3 only, response includes partner_counts + top_branches
  - no max_depth -> legacy L1..L5 (backward compat)
- Seeded L1-L2 tree with partner_position assignments to verify counts + top_branches
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward_db")

ROOT_UID = f"TEST-ROOT-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module")
def seeded_tree(mongo_db):
    """Seed 1 synthetic root + 3 L1 + 2 L2 per L1 (=9 rows walked from ROOT)."""
    # ROOT (no need to link to real user)
    root_doc = {
        "uid": ROOT_UID,
        "name": "TEST_Growth_Root",
        "email": f"testroot_{uuid.uuid4().hex[:6]}@test.local",
        "subscription_plan": "elite",
        "referral_code": ROOT_UID[-8:],
    }
    mongo_db.users.insert_one(root_doc)

    l1_ids = []
    l2_ids = []
    partner_positions_l1 = [
        "district_partner",
        "regional_state_partner",
        "state_partner",
    ]
    for i in range(3):
        l1_uid = f"TEST-L1-{i}-{uuid.uuid4().hex[:8]}"
        mongo_db.users.insert_one({
            "uid": l1_uid,
            "name": f"TEST_L1_User_{i}",
            "email": f"testl1_{i}_{uuid.uuid4().hex[:6]}@test.local",
            "subscription_plan": "elite",  # active
            "referred_by": ROOT_UID,
            "partner_position": partner_positions_l1[i],
            "prc_balance": 100.0 + i * 10,
        })
        l1_ids.append(l1_uid)

        # 2 L2 children each
        for j in range(2):
            l2_uid = f"TEST-L2-{i}{j}-{uuid.uuid4().hex[:8]}"
            # Assign national_partner to ONE L2 (the very first L2 child)
            ppos = "national_partner" if (i == 0 and j == 0) else None
            doc = {
                "uid": l2_uid,
                "name": f"TEST_L2_User_{i}_{j}",
                "email": f"testl2_{i}_{j}_{uuid.uuid4().hex[:6]}@test.local",
                "subscription_plan": "startup",  # active
                "referred_by": l1_uid,
                "prc_balance": 20.0,
            }
            if ppos:
                doc["partner_position"] = ppos
            mongo_db.users.insert_one(doc)
            l2_ids.append(l2_uid)

    yield {"root": ROOT_UID, "l1": l1_ids, "l2": l2_ids}

    # Cleanup
    mongo_db.users.delete_many({"uid": {"$in": [ROOT_UID] + l1_ids + l2_ids}})


class TestLevelBreakdownMaxDepth3:
    """max_depth=3 must cap levels at L1..L3 and include partner_counts + top_branches"""

    def test_response_shape_and_level_cap(self, seeded_tree):
        r = requests.get(
            f"{BASE_URL}/api/notifications/referrals/{seeded_tree['root']}/level-breakdown",
            params={"max_depth": 3},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True

        # Levels dict must have exactly L1, L2, L3
        assert set(data["levels"].keys()) == {"L1", "L2", "L3"}, \
            f"Expected only L1..L3, got {list(data['levels'].keys())}"

        # New keys must be present
        assert "partner_counts" in data, "partner_counts key missing"
        assert "top_branches" in data, "top_branches key missing"
        assert isinstance(data["top_branches"], list)

        # partner_counts must have all 4 tier keys as ints
        pc = data["partner_counts"]
        for k in ("district_partner", "regional_state_partner",
                  "state_partner", "national_partner"):
            assert k in pc, f"partner_counts missing key {k}"
            assert isinstance(pc[k], int), f"{k} must be int, got {type(pc[k])}"

    def test_grand_total_and_partner_counts(self, seeded_tree):
        r = requests.get(
            f"{BASE_URL}/api/notifications/referrals/{seeded_tree['root']}/level-breakdown",
            params={"max_depth": 3},
            timeout=20,
        )
        data = r.json()

        # 3 L1 + 6 L2 = 9 walked users
        assert data["grand_total"]["users"] == 9, \
            f"expected 9 users walked, got {data['grand_total']['users']}"
        # All 9 are elite/startup => active
        assert data["grand_total"]["active"] == 9

        # Level counts
        assert data["levels"]["L1"]["total"] == 3
        assert data["levels"]["L2"]["total"] == 6
        assert data["levels"]["L3"]["total"] == 0

        # Partner counts
        pc = data["partner_counts"]
        assert pc["district_partner"] == 1, f"district_partner: {pc}"
        assert pc["regional_state_partner"] == 1, f"regional_state_partner: {pc}"
        assert pc["state_partner"] == 1, f"state_partner: {pc}"
        assert pc["national_partner"] == 1, f"national_partner: {pc}"

    def test_top_branches_structure(self, seeded_tree):
        r = requests.get(
            f"{BASE_URL}/api/notifications/referrals/{seeded_tree['root']}/level-breakdown",
            params={"max_depth": 3},
            timeout=20,
        )
        data = r.json()
        branches = data["top_branches"]
        # We seeded 3 L1s -> up to 5 branches, so should be exactly 3
        assert len(branches) == 3, f"Expected 3 top_branches, got {len(branches)}"

        # Each branch must have required fields
        required_keys = {"uid", "name", "plan", "is_active", "l2_count", "l3_count"}
        for b in branches:
            assert required_keys.issubset(b.keys()), \
                f"branch missing keys: {required_keys - set(b.keys())}"
            # Each L1 has 2 L2 children in our seed
            assert b["l2_count"] == 2, \
                f"branch {b['name']} l2_count expected 2, got {b['l2_count']}"
            assert b["l3_count"] == 0
            assert b["is_active"] is True


class TestLevelBreakdownLegacyBackwardCompat:
    """Without max_depth, endpoint must preserve L1..L5 shape"""

    def test_no_max_depth_returns_l1_to_l5(self, seeded_tree):
        r = requests.get(
            f"{BASE_URL}/api/notifications/referrals/{seeded_tree['root']}/level-breakdown",
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        assert set(data["levels"].keys()) == {"L1", "L2", "L3", "L4", "L5"}, \
            f"Legacy shape must have L1..L5, got {list(data['levels'].keys())}"
        # Still returns new keys (they are always added)
        assert "partner_counts" in data
        assert "top_branches" in data

    def test_max_depth_zero_falls_back_to_legacy(self, seeded_tree):
        """max_depth=0 is falsy in the `or 5` guard, so falls back to L1..L5.

        Documented behaviour, not necessarily desired — see code review note.
        """
        r = requests.get(
            f"{BASE_URL}/api/notifications/referrals/{seeded_tree['root']}/level-breakdown",
            params={"max_depth": 0},
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        # Falsy-guard `int(max_depth or 5)` makes 0 -> 5
        assert set(data["levels"].keys()) == {"L1", "L2", "L3", "L4", "L5"}

    def test_max_depth_clamped_above_5(self, seeded_tree):
        """Defensive: max_depth=99 should be clamped to 5"""
        r = requests.get(
            f"{BASE_URL}/api/notifications/referrals/{seeded_tree['root']}/level-breakdown",
            params={"max_depth": 99},
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        assert set(data["levels"].keys()) == {"L1", "L2", "L3", "L4", "L5"}


class TestEmptyDownline:
    """Fresh user with no downline: endpoint should not crash and return zeros."""

    def test_empty_user_returns_zeros(self):
        fake_uid = f"TEST-EMPTY-{uuid.uuid4().hex[:8]}"
        r = requests.get(
            f"{BASE_URL}/api/notifications/referrals/{fake_uid}/level-breakdown",
            params={"max_depth": 3},
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["grand_total"]["users"] == 0
        assert data["partner_counts"] == {
            "district_partner": 0,
            "regional_state_partner": 0,
            "state_partner": 0,
            "national_partner": 0,
        }
        assert data["top_branches"] == []
