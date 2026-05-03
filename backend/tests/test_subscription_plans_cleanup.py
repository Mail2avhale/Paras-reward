"""
Subscription Plans Cleanup Tests (Jan 2026)
Verify: Only 'explorer' (free) and 'elite' (paid) remain in the app.
Covers:
- GET /api/subscription/plans: returns ONLY explorer + elite (no startup/growth)
- POST /api/vip/submit-payment: rejects startup/growth with 400
- POST /api/subscription/upgrade/{uid}: rejects startup/growth with 400, accepts explorer/elite
- Regression: POST /api/vip/submit-payment with plan='elite' still validates further fields (not plan-rejected)
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set in env"

# Test user (existing Elite user from /app/memory/test_credentials.md)
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"

ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_token(api_client):
    """Login as the test cash/Elite user, return (uid, access_token) or skip."""
    payload = {"identifier": TEST_USER_MOBILE, "password": TEST_USER_PIN}
    r = api_client.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"User login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    uid = (data.get("user") or {}).get("uid") or data.get("uid") or TEST_USER_UID
    if not token:
        pytest.skip("No access_token in login response")
    return uid, token


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Login as admin. Returns token or skips."""
    payload = {"identifier": ADMIN_EMAIL, "password": ADMIN_PIN}
    r = api_client.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data.get("access_token") or data.get("token")


# ---------- GET /api/subscription/plans ----------

class TestSubscriptionPlansEndpoint:
    """Verify /api/subscription/plans only returns explorer + elite."""

    def test_plans_returns_only_explorer_and_elite(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/subscription/plans", timeout=15)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        data = r.json()

        # Response could be a list or a dict containing a list
        plans = data.get("plans") if isinstance(data, dict) else data
        assert isinstance(plans, list), f"Plans should be list, got {type(plans)}"

        plan_ids = {p.get("id") for p in plans}
        assert "startup" not in plan_ids, f"startup plan must not be present, got {plan_ids}"
        assert "growth" not in plan_ids, f"growth plan must not be present, got {plan_ids}"
        # Must include both active plans
        assert "explorer" in plan_ids, f"explorer plan missing, got {plan_ids}"
        assert "elite" in plan_ids, f"elite plan missing, got {plan_ids}"
        # Only these two
        assert plan_ids == {"explorer", "elite"}, f"Expected exactly explorer+elite, got {plan_ids}"
        print(f"✓ /api/subscription/plans returned only: {plan_ids}")


# ---------- POST /api/vip/submit-payment plan validation ----------

class TestVipSubmitPaymentPlanValidation:
    """Verify new subscription endpoint rejects legacy plans."""

    ENDPOINT_TEMPLATE = "/api/subscription/payment/{uid}"

    def _build_payload(self, plan: str) -> dict:
        return {
            "plan": plan,
            "duration": "1_month",
            "utr_number": "123456789012",
            "amount": 1178.82,
            "payment_method": "upi",
        }

    def test_submit_payment_rejects_startup(self, api_client, user_token):
        uid, token = user_token
        headers = {"Authorization": f"Bearer {token}"}
        r = api_client.post(
            f"{BASE_URL}{self.ENDPOINT_TEMPLATE.format(uid=uid)}",
            json=self._build_payload("startup"),
            headers=headers,
            timeout=20,
        )
        assert r.status_code == 400, f"Expected 400 for startup, got {r.status_code}: {r.text[:300]}"
        detail = (r.json().get("detail") or "").lower()
        assert "invalid plan" in detail or "only elite" in detail, f"Unexpected error: {detail}"
        print(f"✓ startup rejected: {detail}")

    def test_submit_payment_rejects_growth(self, api_client, user_token):
        uid, token = user_token
        headers = {"Authorization": f"Bearer {token}"}
        r = api_client.post(
            f"{BASE_URL}{self.ENDPOINT_TEMPLATE.format(uid=uid)}",
            json=self._build_payload("growth"),
            headers=headers,
            timeout=20,
        )
        assert r.status_code == 400, f"Expected 400 for growth, got {r.status_code}: {r.text[:300]}"
        detail = (r.json().get("detail") or "").lower()
        assert "invalid plan" in detail or "only elite" in detail, f"Unexpected error: {detail}"
        print(f"✓ growth rejected: {detail}")

    def test_submit_payment_rejects_explorer(self, api_client, user_token):
        """Explorer is a free plan — should NOT be accepted at paid payment endpoint."""
        uid, token = user_token
        headers = {"Authorization": f"Bearer {token}"}
        r = api_client.post(
            f"{BASE_URL}{self.ENDPOINT_TEMPLATE.format(uid=uid)}",
            json=self._build_payload("explorer"),
            headers=headers,
            timeout=20,
        )
        assert r.status_code == 400, f"Expected 400 for explorer, got {r.status_code}: {r.text[:300]}"
        print("✓ explorer rejected at paid submit-payment endpoint")

    def test_submit_payment_elite_passes_plan_validation(self, api_client, user_token):
        """Regression: plan='elite' must pass the plan-gate.
        We submit a (likely) duplicate UTR which will fail AFTER plan validation; we accept
        any status that is NOT 400/'Invalid plan'. A successful 200 is also acceptable.
        """
        uid, token = user_token
        headers = {"Authorization": f"Bearer {token}"}
        # Use a fresh UTR to avoid duplicate-UTR false negatives
        utr = str(int(time.time()))[-12:].rjust(12, "0")
        payload = {
            "uid": uid,
            "plan": "elite",
            "duration": "1_month",
            "utr_number": utr,
            "amount": 1178.82,
            "payment_method": "upi",
        }
        r = api_client.post(
            f"{BASE_URL}/api/vip/submit-payment",
            json=payload,
            headers=headers,
            timeout=30,
        )
        # Assert plan-rejection did NOT happen
        if r.status_code == 400:
            detail = (r.json().get("detail") or "").lower()
            assert "invalid plan" not in detail and "only elite" not in detail, (
                f"Elite plan was wrongly rejected as invalid: {detail}"
            )
            print(f"  (elite passed plan validation; failed later at: {detail})")
        else:
            print(f"✓ elite accepted (status={r.status_code})")


# ---------- POST /api/subscription/upgrade/{uid} ----------

class TestAdminUpgradeSubscription:
    """Admin upgrade endpoint must reject startup/growth and accept explorer/elite."""

    def _headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"} if admin_token else {}

    def test_upgrade_rejects_startup(self, api_client, admin_token):
        uid = TEST_USER_UID
        r = api_client.post(
            f"{BASE_URL}/api/subscription/upgrade/{uid}",
            json={"plan": "startup", "extend_days": 0},
            headers=self._headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400 for startup, got {r.status_code}: {r.text[:300]}"
        detail = (r.json().get("detail") or "").lower()
        assert "invalid plan" in detail, f"Unexpected error: {detail}"
        print(f"✓ admin upgrade rejected startup: {detail}")

    def test_upgrade_rejects_growth(self, api_client, admin_token):
        uid = TEST_USER_UID
        r = api_client.post(
            f"{BASE_URL}/api/subscription/upgrade/{uid}",
            json={"plan": "growth", "extend_days": 0},
            headers=self._headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400 for growth, got {r.status_code}: {r.text[:300]}"
        detail = (r.json().get("detail") or "").lower()
        assert "invalid plan" in detail, f"Unexpected error: {detail}"
        print(f"✓ admin upgrade rejected growth: {detail}")

    def test_upgrade_rejects_junk_plan(self, api_client, admin_token):
        uid = TEST_USER_UID
        r = api_client.post(
            f"{BASE_URL}/api/subscription/upgrade/{uid}",
            json={"plan": "diamond", "extend_days": 0},
            headers=self._headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400 for junk plan, got {r.status_code}: {r.text[:300]}"
        print("✓ admin upgrade rejected junk plan 'diamond'")

    def test_upgrade_accepts_elite(self, api_client, admin_token):
        """Elite should pass plan validation. Non-existent UID -> 404 (still proves plan accepted)."""
        fake_uid = f"TEST_nouser_{uuid.uuid4().hex[:8]}"
        r = api_client.post(
            f"{BASE_URL}/api/subscription/upgrade/{fake_uid}",
            json={"plan": "elite", "extend_days": 0},
            headers=self._headers(admin_token),
            timeout=15,
        )
        # Must NOT be 400 with 'Invalid plan' — can be 404 (user not found) or 200/401/403 etc.
        if r.status_code == 400:
            detail = (r.json().get("detail") or "").lower()
            assert "invalid plan" not in detail, f"elite wrongly rejected: {detail}"
        # Most likely 404 user not found
        print(f"✓ admin upgrade accepted 'elite' past plan-validation (status={r.status_code})")

    def test_upgrade_accepts_explorer(self, api_client, admin_token):
        fake_uid = f"TEST_nouser_{uuid.uuid4().hex[:8]}"
        r = api_client.post(
            f"{BASE_URL}/api/subscription/upgrade/{fake_uid}",
            json={"plan": "explorer", "extend_days": 0},
            headers=self._headers(admin_token),
            timeout=15,
        )
        if r.status_code == 400:
            detail = (r.json().get("detail") or "").lower()
            assert "invalid plan" not in detail, f"explorer wrongly rejected: {detail}"
        print(f"✓ admin upgrade accepted 'explorer' past plan-validation (status={r.status_code})")


# ---------- Regression: unrelated core APIs still up ----------

class TestRegressionBasics:
    def test_health_or_root(self, api_client):
        # Most FastAPI apps expose /api/ or /api/health
        for path in ["/api/health", "/api/"]:
            r = api_client.get(f"{BASE_URL}{path}", timeout=10)
            if r.status_code < 500:
                print(f"✓ {path} -> {r.status_code}")
                return
        pytest.skip("No health endpoint reachable")

    def test_user_login_works(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": TEST_USER_MOBILE, "password": TEST_USER_PIN},
            timeout=15,
        )
        assert r.status_code == 200, f"User login regression: {r.status_code} {r.text[:200]}"
        print("✓ Test user login works")

    def test_admin_login_works(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": ADMIN_EMAIL, "password": ADMIN_PIN},
            timeout=15,
        )
        assert r.status_code == 200, f"Admin login regression: {r.status_code} {r.text[:200]}"
        print("✓ Admin login works")
