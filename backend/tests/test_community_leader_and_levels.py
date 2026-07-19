"""
Feb 16 2026 — Community Level Progression + Community Leader Multiplier
========================================================================
E2E API-level tests for the two new features shipped this session.

Covers:
  • /api/community/level-table
  • /api/community/level-progression/{uid}
  • get_max_earnable_level boundary math
  • /api/community-leader/multiplier-table
  • /api/community-leader/status/{uid}
  • /api/community-leader/dashboard/{uid}
  • Admin partner assign/revoke flow with multiplier verification for
    all 4 leader roles
  • Admin multiplier config GET/POST/reset with 403 for wrong PIN
  • /api/community/dashboard/{uid} auth guard (401/403/200)

Uses the pre-seeded test user 9970100782 / uid 76b75808-... on
subscription_plan=elite.

Cleanup: any partner_position assignment made here is reverted to `user`
in the final teardown so downstream tests / manual QA stay clean.
"""
from __future__ import annotations

import os
import pathlib
import pytest
import requests

# Load backend/.env so `from routes.community_levels import ...` works
# (routes/__init__.py chain requires JWT_SECRET_KEY to be present).
try:
    from dotenv import load_dotenv  # type: ignore
    _ENV = pathlib.Path(__file__).resolve().parents[1] / ".env"
    if _ENV.exists():
        load_dotenv(_ENV)
except Exception:
    pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PIN = "123456"
ADMIN_ID = "admin-test-123"

TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_MOBILE = "9970100782"
TEST_PIN = "997010"

ADMIN_MOBILE = "9999999999"
ADMIN_LOGIN_PIN = "153759"


# ---------- Shared session + helpers ----------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def user_token(s):
    """Login as the test user; return bearer token."""
    for payload in (
        {"identifier": TEST_MOBILE, "password": TEST_PIN},
        {"mobile": TEST_MOBILE, "pin": TEST_PIN},
    ):
        r = s.post(f"{API}/auth/login", json=payload, timeout=15)
        if r.status_code == 200:
            data = r.json()
            tok = data.get("access_token") or data.get("token")
            if tok:
                return tok
    pytest.skip("User login failed — cannot fetch bearer token")


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/login",
               json={"identifier": "admin@test.com", "password": ADMIN_LOGIN_PIN},
               timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.text}"
    d = r.json()
    tok = d.get("access_token") or d.get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {
        "X-Admin-Pin": ADMIN_PIN,
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="module", autouse=True)
def cleanup_partner_position(s, admin_headers):
    """After ALL tests in this module, revoke the test user's partner
    position so the environment is left clean for downstream tests.
    """
    yield
    try:
        s.post(
            f"{API}/admin/partners/revoke",
            json={"admin_id": ADMIN_ID, "uid": TEST_UID},
            headers=admin_headers,
            timeout=10,
        )
    except Exception:
        pass


# ============================================================
#  A. Level Table  (public, static content)
# ============================================================
class TestLevelTable:
    def test_level_table_shape(self, s):
        r = s.get(f"{API}/community/level-table", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["max_level"] == 10
        assert isinstance(data["levels"], list)
        assert len(data["levels"]) == 10
        assert isinstance(data["notes"], list) and len(data["notes"]) >= 1

    def test_level_table_values(self, s):
        r = s.get(f"{API}/community/level-table", timeout=10)
        assert r.status_code == 200
        expected = [
            (1, 1.0, 0),
            (2, 1.0, 0),
            (3, 1.0, 0),
            (4, 1.5, 10),
            (5, 2.0, 20),
            (6, 2.5, 30),
            (7, 3.0, 40),
            (8, 3.5, 50),
            (9, 4.0, 60),
            (10, 4.5, 70),
        ]
        levels = r.json()["levels"]
        for (lvl, pct, req), row in zip(expected, levels):
            assert row["level"] == lvl
            assert row["percent"] == pct
            assert row["required_l1_active_elite"] == req


# ============================================================
#  B. Level Progression  (per-user)
# ============================================================
class TestLevelProgression:
    def test_progression_shape(self, s):
        r = s.get(f"{API}/community/level-progression/{TEST_UID}", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        for k in ("current_level", "current_percent", "l1_active_elite_count",
                  "next_level", "levels", "max_level", "elite_active",
                  "partner_position_overrides_levels"):
            assert k in data, f"missing key: {k}"
        assert data["max_level"] == 10
        assert len(data["levels"]) == 10
        # Each level entry annotated
        for lvl in data["levels"]:
            assert set(("level", "percent", "required_l1_active_elite",
                        "unlocked", "is_current")).issubset(lvl.keys())

    def test_test_user_at_L3_with_1pct(self, s):
        """Per spec: test user has 0 active-elite direct downlines → L3, 1%."""
        r = s.get(f"{API}/community/level-progression/{TEST_UID}", timeout=10)
        assert r.status_code == 200
        data = r.json()
        # If seeded fixture holds (0 active elite downlines) the assertion
        # holds; else skip so we don't blow up on an unrelated data drift.
        cnt = data["l1_active_elite_count"]
        if cnt >= 10:
            pytest.skip(f"Test user has {cnt} active elite downlines — data drift, cannot check L3 boundary")
        assert data["current_level"] == 3
        assert data["current_percent"] == 1.0

    def test_boundary_math_via_get_max_earnable_level(self):
        """Directly exercise the pure boundary function — no HTTP."""
        from routes.community_levels import get_max_earnable_level as g
        table = {
            0: 3, 9: 3, 10: 4, 19: 4, 20: 5, 29: 5, 30: 6,
            39: 6, 40: 7, 49: 7, 50: 8, 59: 8, 60: 9, 69: 9,
            70: 10, 150: 10,
        }
        for n, expected in table.items():
            assert g(n) == expected, f"count={n} → expected L{expected}, got L{g(n)}"


# ============================================================
#  C. Community Leader — public tables + status for regular user
# ============================================================
class TestLeaderPublic:
    def test_multiplier_table(self, s):
        r = s.get(f"{API}/community-leader/multiplier-table", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        m = data["multipliers"]
        assert m["user"] == 1.0
        assert m["district_partner"] == 1.25
        assert m["regional_state_partner"] == 1.5
        assert m["state_partner"] == 1.75
        assert m["national_partner"] == 2.0
        labels = data["labels"]
        for k in ("user", "district_partner", "regional_state_partner",
                  "state_partner", "national_partner"):
            assert k in labels
        assert "formula" in data

    def test_status_default_user(self, s, admin_headers):
        # ensure clean state first
        s.post(f"{API}/admin/partners/revoke",
               json={"admin_id": ADMIN_ID, "uid": TEST_UID},
               headers=admin_headers, timeout=10)
        r = s.get(f"{API}/community-leader/status/{TEST_UID}", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_leader"] is False
        assert d["bonus_multiplier"] == 1.0
        assert d["leader_status"] == "not_applicable"
        assert d["effective_community_bonus_pct"] == d["base_community_bonus_pct"]


# ============================================================
#  D. Assign → Status → Revoke for all 4 leader roles
# ============================================================
@pytest.mark.parametrize("role,mul,label", [
    ("district_partner", 1.25, "District Community Leader"),
    ("regional_state_partner", 1.5, "Regional Community Leader"),
    ("state_partner", 1.75, "State Community Leader"),
    ("national_partner", 2.0, "National Community Leader"),
])
def test_assign_flow_all_roles(s, admin_headers, role, mul, label):
    # Assign
    r = s.post(
        f"{API}/admin/partners/assign",
        json={"admin_id": ADMIN_ID, "query": TEST_UID, "position": role},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert body["user"]["new_position"] == role

    # Status
    r2 = s.get(f"{API}/community-leader/status/{TEST_UID}", timeout=10)
    assert r2.status_code == 200
    d = r2.json()
    assert d["is_leader"] is True
    assert d["role"] == role
    assert d["role_label"] == label
    assert d["bonus_multiplier"] == mul
    expected_effective = round(d["base_community_bonus_pct"] * mul, 4)
    assert d["effective_community_bonus_pct"] == expected_effective

    # Revoke
    r3 = s.post(
        f"{API}/admin/partners/revoke",
        json={"admin_id": ADMIN_ID, "uid": TEST_UID},
        headers=admin_headers, timeout=10,
    )
    assert r3.status_code == 200

    # Confirm flipped back
    r4 = s.get(f"{API}/community-leader/status/{TEST_UID}", timeout=10)
    assert r4.status_code == 200
    d2 = r4.json()
    assert d2["role"] == "user"
    assert d2["bonus_multiplier"] == 1.0


# ============================================================
#  E. Leader dashboard structural payload
# ============================================================
class TestLeaderDashboard:
    def test_dashboard_shape(self, s):
        r = s.get(f"{API}/community-leader/dashboard/{TEST_UID}", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("role", "bonus_multiplier", "effective_community_bonus_pct",
                  "structure_toward_next", "direct_leader_counts",
                  "multiplier_ladder"):
            assert k in d, f"missing {k}"
        # ladder is 5 rows with is_current
        assert isinstance(d["multiplier_ladder"], list)
        assert len(d["multiplier_ladder"]) == 5
        assert any(row["is_current"] for row in d["multiplier_ladder"])
        # direct_leader_counts has the 3 child roles
        for k in ("district_partner", "regional_state_partner", "state_partner"):
            assert k in d["direct_leader_counts"]


# ============================================================
#  F. Composite community dashboard — auth guard + payload keys
# ============================================================
class TestComposite:
    def test_no_token_401(self, s):
        r = s.get(f"{API}/community/dashboard/{TEST_UID}", timeout=10)
        assert r.status_code in (401, 403)

    def test_wrong_owner_403(self, s, user_token):
        # Use owner's token but query somebody else's uid → expect 403
        other_uid = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"  # PRC user
        r = s.get(
            f"{API}/community/dashboard/{other_uid}",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=10,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text[:200]}"

    def test_owner_200_has_new_nodes(self, s, user_token):
        r = s.get(
            f"{API}/community/dashboard/{TEST_UID}",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "level_progression" in d
        assert "leader_status" in d
        # sanity of nested shape
        assert d["level_progression"]["max_level"] == 10
        assert d["leader_status"]["bonus_multiplier"] in (1.0, 1.25, 1.5, 1.75, 2.0)


# ============================================================
#  G. Admin multiplier config endpoints
# ============================================================
class TestAdminMultipliers:
    def test_get_wrong_pin_403(self, s, admin_token):
        r = s.get(
            f"{API}/admin/community-leader/multipliers",
            headers={"X-Admin-Pin": "wrong-pin",
                     "Authorization": f"Bearer {admin_token}"},
            timeout=10,
        )
        assert r.status_code == 403, r.text
        # Must surface the specific message (drives the frontend axios regression fix)
        detail = r.json().get("detail", "")
        assert "Invalid admin operation PIN" in detail

    def test_get_correct_pin(self, s, admin_headers):
        r = s.get(
            f"{API}/admin/community-leader/multipliers",
            headers=admin_headers, timeout=10,
        )
        assert r.status_code == 200
        d = r.json()
        assert "effective" in d
        assert "defaults" in d
        assert "stored_doc" in d  # may be null / dict
        assert d["defaults"]["district_partner"] == 1.25

    def test_partial_update_and_reset(self, s, admin_headers):
        # 1) Update district_partner → 1.30
        r = s.post(
            f"{API}/admin/community-leader/multipliers",
            json={"admin_id": ADMIN_ID, "multipliers": {"district_partner": 1.30}},
            headers=admin_headers, timeout=10,
        )
        assert r.status_code == 200
        r2 = s.get(
            f"{API}/admin/community-leader/multipliers",
            headers=admin_headers, timeout=10,
        )
        assert r2.json()["effective"]["district_partner"] == 1.30

        # 2) Value out-of-range (0.1) → silently rejected; stays at 1.30
        r3 = s.post(
            f"{API}/admin/community-leader/multipliers",
            json={"admin_id": ADMIN_ID, "multipliers": {"district_partner": 0.1}},
            headers=admin_headers, timeout=10,
        )
        assert r3.status_code == 200
        # Old value preserved
        r4 = s.get(
            f"{API}/admin/community-leader/multipliers",
            headers=admin_headers, timeout=10,
        )
        assert r4.json()["effective"]["district_partner"] == 1.30

        # 3) Reset → defaults
        r5 = s.post(
            f"{API}/admin/community-leader/multipliers/reset",
            headers=admin_headers, timeout=10,
        )
        assert r5.status_code == 200
        r6 = s.get(
            f"{API}/admin/community-leader/multipliers",
            headers=admin_headers, timeout=10,
        )
        assert r6.json()["effective"]["district_partner"] == 1.25
