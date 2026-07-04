"""
Test suite for the new Global Redeem-Limit Formula Toggle feature (Jul 2026).

Covers:
  - Admin GET/POST /api/admin/settings/redeem-limit-global (auth + validation)
  - Cascade effect on /api/user/{uid}/redeem-limit (flat vs network formula)
  - Cache invalidation after POST
  - Per-user redeem_limit_override interaction
  - Regression: /api/admin/settings/redeem-limit still works

Cleanup: deletes db.app_settings doc {key: 'redeem_limit_global'} at end so
production defaults (enabled=true) are preserved.
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read frontend/.env manually
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"

PRIMARY_USER_MOBILE = "9970100782"
PRIMARY_USER_PIN = "997010"
PRIMARY_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PIN},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No admin token in login response: {list(data.keys())}"
    return tok


@pytest.fixture(scope="module")
def user_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"identifier": PRIMARY_USER_MOBILE, "password": PRIMARY_USER_PIN},
        timeout=30,
    )
    assert r.status_code == 200, f"User login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No user token in login response: {list(data.keys())}"
    return tok


@pytest.fixture(scope="module")
def mongo_db():
    # Read MONGO_URL + DB_NAME straight from backend/.env
    mongo_url = None
    db_name = None
    try:
        with open("/app/backend/.env") as f:
            for line in f:
                line = line.strip()
                if line.startswith("MONGO_URL="):
                    mongo_url = line.split("=", 1)[1].strip('"').strip("'")
                elif line.startswith("DB_NAME="):
                    db_name = line.split("=", 1)[1].strip('"').strip("'")
    except Exception:
        pass
    assert mongo_url and db_name, "MONGO_URL/DB_NAME missing"
    client = MongoClient(mongo_url)
    return client[db_name]


@pytest.fixture(scope="module", autouse=True)
def cleanup_global_toggle_after(mongo_db):
    """After all tests, delete the redeem_limit_global doc to preserve defaults."""
    yield
    try:
        mongo_db.app_settings.delete_one({"key": "redeem_limit_global"})
        # Also clear any override we might have set on the primary user
        mongo_db.users.update_one(
            {"uid": PRIMARY_USER_UID},
            {"$unset": {"redeem_limit_override": "", "redeem_limit_override_reason": ""}},
        )
    except Exception as e:
        print(f"cleanup failed: {e}")


# ---------- 1. Auth guards ----------

class TestAuthGuards:
    def test_get_without_auth_returns_401(self):
        r = requests.get(f"{API}/admin/settings/redeem-limit-global", timeout=15)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"

    def test_post_without_auth_returns_401(self):
        r = requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            json={"enabled": False, "flat_unlock_percent": 80},
            timeout=15,
        )
        assert r.status_code == 401


# ---------- 2. Admin GET returns defaults ----------

class TestAdminGet:
    def test_get_returns_defaults_when_no_doc(self, admin_token, mongo_db):
        # Ensure no doc exists first
        mongo_db.app_settings.delete_one({"key": "redeem_limit_global"})
        r = requests.get(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        d = r.json()
        assert d.get("enabled") is True
        assert float(d.get("flat_unlock_percent")) == 80.0


# ---------- 3. Admin POST validation ----------

class TestPostValidation:
    def test_post_missing_enabled_returns_400(self, admin_token):
        r = requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"flat_unlock_percent": 80},
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text[:200]}"

    def test_post_out_of_range_high_returns_400(self, admin_token):
        r = requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": False, "flat_unlock_percent": 150},
            timeout=15,
        )
        assert r.status_code == 400

    def test_post_out_of_range_negative_returns_400(self, admin_token):
        r = requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": False, "flat_unlock_percent": -10},
            timeout=15,
        )
        assert r.status_code == 400


# ---------- 4. Toggle round-trip: OFF + flat=85 ----------

class TestToggleRoundTrip:
    def test_disable_and_verify_persisted(self, admin_token):
        r = requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": False, "flat_unlock_percent": 85},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("success") is True
        assert d.get("enabled") is False
        assert float(d.get("flat_unlock_percent")) == 85.0

        # Verify GET returns the saved values
        r2 = requests.get(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("enabled") is False
        assert float(d2.get("flat_unlock_percent")) == 85.0


# ---------- 5. Cascade effect on user redeem-limit ----------

class TestUserRedeemLimitCascade:
    def _get_user_limit(self, user_token):
        r = requests.get(
            f"{API}/user/{PRIMARY_USER_UID}/redeem-limit",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=15,
        )
        return r

    def test_flat_active_when_disabled(self, admin_token, user_token, mongo_db):
        # Clear any override on user first
        mongo_db.users.update_one(
            {"uid": PRIMARY_USER_UID},
            {"$unset": {"redeem_limit_override": ""}},
        )
        # Set OFF, flat=85
        requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": False, "flat_unlock_percent": 85},
            timeout=15,
        )
        # Immediately hit user endpoint — cache should have been invalidated
        r = self._get_user_limit(user_token)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        limit = body.get("limit", {})
        assert float(limit.get("unlock_percent", 0)) == 85.0, (
            f"unlock_percent should be 85, got {limit.get('unlock_percent')}"
        )
        total_mined = float(limit.get("total_mined", 0))
        expected_redeemable = round(total_mined * 0.85, 2)
        assert abs(float(limit.get("redeemable", 0)) - expected_redeemable) < 0.02, (
            f"redeemable {limit.get('redeemable')} != total_mined*0.85 = {expected_redeemable}"
        )

    def test_global_formula_enabled_field_present_when_disabled(self, admin_token, user_token):
        """SPEC: response.limit must contain `global_formula_enabled: false`."""
        requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": False, "flat_unlock_percent": 85},
            timeout=15,
        )
        r = self._get_user_limit(user_token)
        assert r.status_code == 200
        body = r.json()
        limit = body.get("limit", {})
        # Field may be at top-level OR inside 'limit'.
        found = ("global_formula_enabled" in limit) or ("global_formula_enabled" in body)
        assert found, (
            f"Response missing 'global_formula_enabled' field. "
            f"limit keys={list(limit.keys())}, body keys={list(body.keys())}"
        )
        val = limit.get("global_formula_enabled", body.get("global_formula_enabled"))
        assert val is False, f"Expected global_formula_enabled=false, got {val}"

    def test_network_formula_restored_when_enabled(self, admin_token, user_token):
        # Turn ON
        r = requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": True, "flat_unlock_percent": 80},
            timeout=15,
        )
        assert r.status_code == 200
        # Cache should be invalidated
        r2 = self._get_user_limit(user_token)
        assert r2.status_code == 200
        limit = r2.json().get("limit", {})
        # Primary user has no active downline → network-based unlock% == 0
        assert float(limit.get("unlock_percent", -1)) == 0.0, (
            f"Expected 0% unlock (network formula, no downline), got {limit.get('unlock_percent')}"
        )

    def test_global_formula_enabled_field_true_when_enabled(self, admin_token, user_token):
        requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": True, "flat_unlock_percent": 80},
            timeout=15,
        )
        r = self._get_user_limit(user_token)
        assert r.status_code == 200
        body = r.json()
        limit = body.get("limit", {})
        found = ("global_formula_enabled" in limit) or ("global_formula_enabled" in body)
        assert found, (
            "Response missing 'global_formula_enabled' field when toggle is ON."
        )
        val = limit.get("global_formula_enabled", body.get("global_formula_enabled"))
        assert val is True


# ---------- 6. Cache invalidation timing ----------

class TestCacheInvalidation:
    def test_change_reflects_immediately_after_post(self, admin_token, user_token, mongo_db):
        # Warm cache with enabled=True
        requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": True, "flat_unlock_percent": 80},
            timeout=15,
        )
        # Warm cache
        r0 = requests.get(
            f"{API}/user/{PRIMARY_USER_UID}/redeem-limit",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=15,
        )
        assert r0.status_code == 200

        # Flip toggle
        requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": False, "flat_unlock_percent": 60},
            timeout=15,
        )
        # No wait — should reflect immediately
        r1 = requests.get(
            f"{API}/user/{PRIMARY_USER_UID}/redeem-limit",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=15,
        )
        assert r1.status_code == 200
        limit = r1.json().get("limit", {})
        assert float(limit.get("unlock_percent", 0)) == 60.0, (
            f"Cache not invalidated — expected 60%, got {limit.get('unlock_percent')}"
        )


# ---------- 7. Override interaction ----------

class TestOverrideInteraction:
    def test_override_respected_when_flat_active(self, admin_token, user_token, mongo_db):
        # Set override_value = 5000 PRC on primary user
        mongo_db.users.update_one(
            {"uid": PRIMARY_USER_UID},
            {"$set": {"redeem_limit_override": 5000, "redeem_limit_override_reason": "TEST_toggle"}},
        )
        # Global toggle OFF with flat=50%
        requests.post(
            f"{API}/admin/settings/redeem-limit-global",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": False, "flat_unlock_percent": 50},
            timeout=15,
        )
        r = requests.get(
            f"{API}/user/{PRIMARY_USER_UID}/redeem-limit",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        limit = body.get("limit", {})
        # override_active must be true
        assert limit.get("override_active") is True, (
            f"Expected override_active=True. limit={limit}"
        )
        total_mined = float(limit.get("total_mined", 0))
        total_redeemed = float(limit.get("total_redeemed", 0))
        expected = max(total_mined * 0.50, total_redeemed + 5000)
        actual = float(limit.get("redeemable", 0))
        assert abs(actual - expected) < 0.5, (
            f"Expected redeemable≈{expected} (max of flat×mined and redeemed+override), "
            f"got {actual}. total_mined={total_mined}, total_redeemed={total_redeemed}"
        )

        # Cleanup override
        mongo_db.users.update_one(
            {"uid": PRIMARY_USER_UID},
            {"$unset": {"redeem_limit_override": "", "redeem_limit_override_reason": ""}},
        )


# ---------- 8. Regression: legacy monthly redeem-limit unaffected ----------

class TestRegressionMonthlyRedeem:
    def test_monthly_redeem_settings_still_work(self, admin_token):
        # Save new multiplier settings
        payload = {"multiplier_1": 6, "multiplier_2": 11, "referral_bonus_percent": 25, "enabled": True}
        r = requests.post(
            f"{API}/admin/settings/redeem-limit",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("success") is True

        # Read back
        g = requests.get(
            f"{API}/admin/settings/redeem-limit",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert g.status_code == 200
        d = g.json()
        assert d.get("multiplier_1") == 6
        assert d.get("multiplier_2") == 11
        assert d.get("referral_bonus_percent") == 25

        # Restore defaults
        restore = {"multiplier_1": 5, "multiplier_2": 10, "referral_bonus_percent": 20, "enabled": True}
        requests.post(
            f"{API}/admin/settings/redeem-limit",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=restore,
            timeout=15,
        )
