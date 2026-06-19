"""
Regression test for the FIXED PRC RATE cleanup (June 2026).

Verifies:
- get_prc_rate() / get_prc_rate_sync() return fixed 10
- All wrapper helpers (bank_redeem, unified_redeem_v2, growth_economy) return 10
- admin_accounting.get_prc_ledger_rate() returns 0.10
- GET /api/growth/prc-rate returns {success:true, prc_rate:10, description:'10 PRC = ₹1'}
- Bank redeem denominations samples carry prc_rate==10
- All deleted dynamic-rate endpoints return 404 (or 401 for admin-gated)
- Surviving endpoints still respond 200 (mining/rate-breakdown, notifications/referrals/.../level-breakdown)
- Deleted backend/frontend files no longer exist
- Backend supervisor log shows clean startup (no ImportError / ModuleNotFoundError)
"""
import os
import sys
import re
import asyncio
import pytest
import requests
from dotenv import load_dotenv

# Load backend .env so direct imports (which need JWT_SECRET_KEY etc.) succeed
load_dotenv("/app/backend/.env")

# Ensure backend modules importable
sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TEST_UID = "fcd8c6f8-9596-4f56-8556-568847d5ab86"


# ==================== 1. Direct-import: rate helpers ====================
class TestRateHelpersDirectImport:
    def test_helpers_get_prc_rate_sync_returns_10(self):
        from utils.helpers import get_prc_rate_sync, PRC_INR_RATE
        assert PRC_INR_RATE == 10
        assert get_prc_rate_sync() == 10
        assert isinstance(get_prc_rate_sync(), int)

    def test_helpers_get_prc_rate_async_returns_10(self):
        from utils.helpers import get_prc_rate
        rate = asyncio.get_event_loop().run_until_complete(get_prc_rate())
        assert rate == 10

    def test_bank_redeem_get_dynamic_prc_rate_returns_10(self):
        from routes.bank_redeem import get_dynamic_prc_rate
        assert get_dynamic_prc_rate() == 10

    def test_unified_redeem_v2_get_dynamic_prc_rate_returns_10(self):
        from routes.unified_redeem_v2 import get_dynamic_prc_rate
        rate = asyncio.get_event_loop().run_until_complete(get_dynamic_prc_rate())
        assert rate == 10

    def test_growth_economy_get_dynamic_prc_rate_returns_10(self):
        from routes.growth_economy import get_dynamic_prc_rate
        rate = asyncio.get_event_loop().run_until_complete(get_dynamic_prc_rate())
        assert float(rate) == 10.0

    def test_admin_accounting_get_prc_ledger_rate_returns_0_10(self):
        from routes.admin_accounting import get_prc_ledger_rate, PRC_TO_INR_RATE
        assert get_prc_ledger_rate() == 0.10
        assert PRC_TO_INR_RATE == 0.10


# ==================== 2. Public API: rate endpoint ====================
class TestPrcRateAPI:
    def test_growth_prc_rate_endpoint(self):
        r = requests.get(f"{API}/growth/prc-rate", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("prc_rate") == 10
        assert data.get("description") == "10 PRC = ₹1"


# ==================== 3. Surviving endpoints (regression) ====================
class TestSurvivingEndpoints:
    def test_mining_rate_breakdown_200(self):
        r = requests.get(f"{API}/mining/rate-breakdown/{TEST_UID}", timeout=20)
        assert r.status_code == 200, r.text

    def test_notifications_level_breakdown_200(self):
        r = requests.get(f"{API}/notifications/referrals/{TEST_UID}/level-breakdown", timeout=20)
        assert r.status_code == 200, r.text

    def test_bank_redeem_denominations_uses_fixed_rate(self):
        """Bank redeem samples should reflect fixed prc_rate == 10."""
        r = requests.get(f"{API}/bank-redeem/denominations", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        samples = data.get("samples") or []
        assert samples, "Expected sample calculations in denominations response"
        for s in samples:
            assert s.get("prc_rate") == 10, f"Sample {s} prc_rate must be 10"
        # Verify the ₹100 sample math: amount_prc = 100 * 10 = 1000
        sample_100 = next((s for s in samples if s.get("amount_inr") == 100), None)
        assert sample_100, "Expected sample for amount_inr=100"
        assert sample_100["amount_prc"] == 1000
        # total_prc must equal total_inr * 10
        assert sample_100["total_prc"] == int(sample_100["total_inr"] * 10)


# ==================== 4. Deleted endpoints ====================
DELETED_ENDPOINTS = [
    "/growth/admin/set-prc-rate",
    "/growth/admin/prc-rate-override",
    "/admin/settings/prc-rate",
    "/admin/prc-economy/dashboard",
    "/admin/prc-economy/rate",
    "/admin/prc-economy/redeem-pressure",
    "/admin/prc-economy/stability",
    "/admin/prc-economy/emergency-check",
    "/admin/prc-economy/whale-wallets",
    "/admin/prc-economy/pause-status",
    "/admin/prc-economy/pause",
    "/admin/prc-economy/resume",
    "/admin/prc-economy/check-and-pause",
    "/prc-economy/current-rate",
]


@pytest.mark.parametrize("path", DELETED_ENDPOINTS)
def test_deleted_endpoint_unreachable(path):
    """All deleted endpoints must NOT return 2xx. 404 (gone) or 401/403 (auth gate
    fires before missing route) are both acceptable for cleanup verification."""
    # Try both GET and POST; either should not be 2xx.
    url = f"{API}{path}"
    statuses = []
    for method in ("get", "post"):
        try:
            resp = requests.request(method, url, timeout=10, json={})
            statuses.append(resp.status_code)
        except requests.RequestException:
            statuses.append(None)
    # No method should return success
    assert all(
        (s is None) or (s >= 400) for s in statuses
    ), f"{path} should be deleted/blocked, got statuses {statuses}"
    # And at least one of the calls should clearly indicate gone/blocked
    assert any(
        s in (401, 403, 404, 405) for s in statuses if s is not None
    ), f"{path} got unexpected statuses {statuses}"


# ==================== 5. Deleted files no longer exist ====================
DELETED_FILES = [
    "/app/backend/routes/prc_economy.py",
    "/app/backend/routes/admin_prc_economy.py",
    "/app/frontend/src/components/PRCRateDisplay.js",
    "/app/frontend/src/pages/AdminPRCRateControl.js",
    "/app/frontend/src/pages/AdminPRCEconomyDashboard.js",
]


@pytest.mark.parametrize("path", DELETED_FILES)
def test_deleted_files_removed(path):
    assert not os.path.exists(path), f"{path} should be deleted but still exists"


# ==================== 6. Backend startup cleanliness ====================
class TestBackendStartup:
    def test_no_import_errors_in_backend_err_log(self):
        log_path = "/var/log/supervisor/backend.err.log"
        assert os.path.exists(log_path), "backend.err.log missing"
        with open(log_path, "r", errors="ignore") as f:
            content = f.read()[-20000:]  # tail
        forbidden = [
            "ModuleNotFoundError: No module named 'routes.prc_economy'",
            "ModuleNotFoundError: No module named 'routes.admin_prc_economy'",
            "ImportError: cannot import name 'register_rate_calculator'",
            "ImportError: cannot import name 'set_referral_helpers'",
            "ImportError: cannot import name 'get_multi_level_referrals'",
        ]
        for needle in forbidden:
            assert needle not in content, f"Forbidden startup error found: {needle}"

    def test_server_imports_admin_prc_economy_removed(self):
        with open("/app/backend/server.py", "r") as f:
            lines = f.readlines()
        # Strip out comment lines so we only inspect live code
        code_lines = [ln for ln in lines if not ln.lstrip().startswith("#")]
        code = "".join(code_lines)
        # No live imports / router includes of removed modules
        assert "from routes.admin_prc_economy" not in code
        assert "from routes.prc_economy" not in code
        assert "admin_prc_economy_router" not in code
        # No live route handler for removed endpoint
        assert '"/prc-economy/current-rate"' not in code
        assert "'/prc-economy/current-rate'" not in code
        # No live scheduler hook for removed job
        assert re.search(r"^\s*check_emergency_auto_pause_job\s*\(", code, re.MULTILINE) is None
