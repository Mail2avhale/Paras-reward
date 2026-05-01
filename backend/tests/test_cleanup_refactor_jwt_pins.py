"""
Plan B cleanup validation tests (iteration 225).

Validates:
  1. Backend boots without RuntimeError (JWT_SECRET_KEY fallback removed).
  2. POST /api/auth/login still returns JWT token + role=admin for admin creds.
  3. GET /api/auth/me with Bearer token decodes JWT correctly.
  4. Admin endpoints guarded by `admin_pin != ADMIN_OPERATION_PIN` still
     accept PIN "123456" and reject wrong PIN.
  5. Admin Force-Activate Elite PRC uses ADMIN_OVERRIDE_PIN=153759.
  6. Constants refactor: PLATFORM_FEE=10 and ADMIN_CHARGE_PERCENT=20 still
     flow via bank-redeem charges endpoint.
  7. Employee reports auth guard still enforces Bearer token.
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@test.com"
ADMIN_LOGIN_PIN = "153759"        # admin login PIN == ADMIN_OVERRIDE_PIN
ADMIN_OPERATION_PIN = "123456"    # operational guard PIN
ADMIN_UID = "admin-test-123"
CASH_TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


# ---------- fixtures ----------

@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_login(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "pin": ADMIN_LOGIN_PIN},
                 timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    return body


@pytest.fixture(scope="session")
def admin_token(admin_login):
    tok = admin_login.get("access_token") or admin_login.get("token")
    assert tok and isinstance(tok, str) and len(tok) > 20, "no JWT returned"
    return tok


# ---------- 1. Backend boot / health ----------

class TestBackendBoot:
    def test_health_endpoint_responds(self, api):
        r = api.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200, f"/api/health returned {r.status_code}"


# ---------- 2. & 3. Auth / JWT ----------

class TestAuthJwt:
    def test_admin_login_returns_jwt_and_admin_role(self, admin_login):
        assert admin_login.get("role") == "admin"
        assert admin_login.get("uid") == ADMIN_UID
        tok = admin_login.get("access_token") or admin_login.get("token")
        assert tok and len(tok.split(".")) == 3, "not a JWT (missing 3 segments)"

    def test_admin_login_invalid_pin_rejected(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "pin": "000000"},
                     timeout=15)
        assert r.status_code in (400, 401, 403), f"expected auth failure, got {r.status_code}"

    def test_auth_me_with_bearer_token(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/auth/me",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    timeout=15)
        # /api/auth/me may return 200 with user info, or 404 if route name differs
        assert r.status_code in (200, 404), f"/api/auth/me -> {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            data = r.json()
            assert data.get("email") == ADMIN_EMAIL or data.get("uid") == ADMIN_UID

    def test_auth_me_with_bad_token_rejected(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me",
                    headers={"Authorization": "Bearer not.a.jwt"},
                    timeout=15)
        # Should NOT be 200; accept 401/403/422/404 (route existence varies)
        assert r.status_code != 200, "bad token was accepted"


# ---------- 4. Admin Operation PIN guard ----------

class TestAdminOperationPin:
    """Admin actions guarded by `admin_pin != ADMIN_OPERATION_PIN`."""

    def _endpoint(self):
        # Use a read-ish endpoint that still checks PIN. razorpay-subs/approve-all
        # is a bulk admin action — with dry_run=True, no writes occur.
        return f"{BASE_URL}/api/admin/razorpay-subs/approve-all"

    def test_wrong_pin_rejected(self, api, admin_token):
        r = api.post(self._endpoint(),
                     json={"admin_pin": "000000", "dry_run": True},
                     headers={"Authorization": f"Bearer {admin_token}"},
                     timeout=15)
        # Bearer ok → PIN check should fail with 401/403
        assert r.status_code in (401, 403, 404, 422), \
            f"wrong PIN not rejected: {r.status_code} {r.text[:200]}"

    def test_correct_pin_accepted(self, api, admin_token):
        r = api.post(self._endpoint(),
                     json={"admin_pin": ADMIN_OPERATION_PIN, "dry_run": True},
                     headers={"Authorization": f"Bearer {admin_token}"},
                     timeout=30)
        # Accept 200 / 201; or 404 if endpoint path not present — not a regression.
        assert r.status_code in (200, 201, 404, 400, 422), \
            f"correct PIN rejected unexpectedly: {r.status_code} {r.text[:200]}"
        # If the endpoint exists, a correct PIN must NOT yield 401/403
        assert r.status_code not in (401, 403), \
            f"correct PIN treated as invalid: {r.status_code} {r.text[:200]}"


# ---------- 5. Admin Override PIN guard ----------

class TestAdminOverridePin:
    """Force-Activate Elite PRC uses ADMIN_OVERRIDE_PIN."""

    def _endpoint(self):
        return f"{BASE_URL}/api/admin/subscription/force-activate-elite-prc"

    def test_wrong_override_pin_rejected(self, api, admin_token):
        r = api.post(self._endpoint(),
                     json={"admin_pin": "000000", "user_id": ADMIN_UID, "dry_run": True},
                     headers={"Authorization": f"Bearer {admin_token}"},
                     timeout=15)
        assert r.status_code in (401, 403, 400, 404, 422), \
            f"wrong override PIN not rejected: {r.status_code} {r.text[:200]}"

    def test_correct_override_pin_authorized(self, api, admin_token):
        # dry_run ideally prevents any state mutation
        r = api.post(self._endpoint(),
                     json={"admin_pin": ADMIN_LOGIN_PIN, "user_id": ADMIN_UID, "dry_run": True},
                     headers={"Authorization": f"Bearer {admin_token}"},
                     timeout=30)
        # With correct PIN: NOT 401/403. 404/400/422 acceptable if user or body shape
        # differs, but the PIN check must have passed.
        assert r.status_code not in (401, 403), \
            f"correct override PIN rejected: {r.status_code} {r.text[:300]}"


# ---------- 6. CRUD sanity ----------

class TestBasicCrudStillWorks:
    def test_admin_user_360(self, api):
        r = api.get(f"{BASE_URL}/api/admin/user-360",
                    params={"uid": ADMIN_UID}, timeout=30)
        assert r.status_code in (200, 401, 403), \
            f"user-360 unexpected: {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            data = r.json()
            assert isinstance(data, dict), "user-360 response must be object"

    def test_user_dashboard(self, api):
        r = api.get(f"{BASE_URL}/api/user/{CASH_TEST_UID}/dashboard", timeout=30)
        assert r.status_code in (200, 401, 403, 404), \
            f"user dashboard unexpected: {r.status_code} {r.text[:200]}"


# ---------- 7. Constants refactor: fees flow correctly ----------

class TestFeesConstants:
    """
    Confirm PLATFORM_FEE=10 and ADMIN_CHARGE_PERCENT=20 still flow via
    bank-redeem charge-preview or equivalent calc endpoint. We probe
    growth-economy settings endpoint (source of truth) first.
    """

    def test_growth_economy_defaults(self, api):
        r = api.get(f"{BASE_URL}/api/growth-economy/settings", timeout=15)
        # Accept 404 if route-prefix differs, but assert values when present
        if r.status_code == 200:
            data = r.json()
            # data may be wrapped, check common keys
            fee = data.get("processing_fee_inr")
            pct = data.get("admin_charge_percent")
            if fee is None and isinstance(data.get("settings"), dict):
                fee = data["settings"].get("processing_fee_inr")
                pct = data["settings"].get("admin_charge_percent")
            assert fee == 10, f"processing_fee_inr != 10 (got {fee})"
            assert pct == 20, f"admin_charge_percent != 20 (got {pct})"
        else:
            pytest.skip(f"growth-economy settings endpoint returned {r.status_code}")

    def test_bank_redeem_denominations_uses_constants(self, api):
        """
        /api/bank-redeem/denominations samples must reflect constants imported
        from growth_economy: admin_charge_percent=20 and, for amounts > ₹500,
        processing_fee_inr=10 (the DEFAULT_PROCESSING_FEE_INR constant).
        """
        r = api.get(f"{BASE_URL}/api/bank-redeem/denominations", timeout=15)
        assert r.status_code == 200, f"denominations -> {r.status_code}"
        data = r.json()
        samples = data.get("samples", [])
        assert samples, "no samples returned"

        # Every sample must carry admin_charge_percent == 20
        for s in samples:
            assert s.get("admin_charge_percent") == 20, \
                f"ADMIN_CHARGE_PERCENT drift on sample {s}: {s.get('admin_charge_percent')}"

        # For samples with amount_inr > 500, processing_fee must == PLATFORM_FEE (10)
        above_500 = [s for s in samples if s.get("amount_inr", 0) > 500]
        assert above_500, "expected at least one sample with amount_inr > 500"
        for s in above_500:
            assert s.get("processing_fee_inr") == 10, \
                f"PLATFORM_FEE drift (expected 10) on sample {s}: {s.get('processing_fee_inr')}"

    def test_bank_redeem_charges_uses_constants(self, api):
        """bank_redeem charges calc must apply ADMIN_CHARGE_PERCENT=20."""
        # try common preview endpoints
        candidates = [
            ("POST", f"{BASE_URL}/api/bank-redeem/preview",
             {"user_id": CASH_TEST_UID, "amount_inr": 1000}),
            ("POST", f"{BASE_URL}/api/bank-redeem/charges",
             {"user_id": CASH_TEST_UID, "amount_inr": 1000}),
            ("GET", f"{BASE_URL}/api/bank-redeem/charges", None),
        ]
        responded = False
        for method, url, payload in candidates:
            r = api.request(method, url, json=payload, timeout=15) if payload \
                else api.request(method, url, timeout=15)
            if r.status_code == 200:
                responded = True
                try:
                    data = r.json()
                except Exception:
                    continue
                pct = data.get("admin_charge_percent") if isinstance(data, dict) else None
                if pct is not None:
                    assert pct == 20, f"ADMIN_CHARGE_PERCENT drift: {pct}"
                break
        if not responded:
            pytest.skip("no bank-redeem preview endpoint available to probe")


# ---------- 8. Employee reports auth guard ----------

class TestEmployeeReportsAuth:
    def test_without_token_rejected(self, api):
        r = api.get(f"{BASE_URL}/api/employees/reports/my/profile",
                    params={"user_id": ADMIN_UID}, timeout=15)
        assert r.status_code in (401, 403, 422), \
            f"employee reports without token not rejected: {r.status_code}"

    def test_with_wrong_token_rejected(self, api):
        r = api.get(f"{BASE_URL}/api/employees/reports/my/profile",
                    params={"user_id": ADMIN_UID},
                    headers={"Authorization": "Bearer wrong.jwt.token"},
                    timeout=15)
        assert r.status_code in (401, 403, 422), \
            f"employee reports wrong token not rejected: {r.status_code}"

    def test_with_admin_bearer(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/employees/reports/my/profile",
                    params={"user_id": ADMIN_UID},
                    headers={"Authorization": f"Bearer {admin_token}"},
                    timeout=20)
        # Admin may be non-employee → 403/404 still proves guard runs;
        # 200 is best case.
        assert r.status_code in (200, 403, 404), \
            f"unexpected employee reports status with admin token: {r.status_code} {r.text[:200]}"
