"""
Regression test for AGGRESSIVE referral cleanup (iteration_235).
Verifies:
  1. Live referral endpoints still return 200
  2. Deleted referral endpoints return 404 (not 500, not 200)
  3. L1-L5 cascade sanity for Suresh (UID fcd8c6f8-..., no referrals)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
SURESH_UID = "fcd8c6f8-9596-4f56-8556-568847d5ab86"
SURESH_REFERRAL_CODE = "SURESHRD"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# -------- LIVE ENDPOINTS (must return 200) ----------

class TestLiveEndpoints:
    def test_mining_rate_breakdown(self, s):
        r = s.get(f"{BASE_URL}/api/mining/rate-breakdown/{SURESH_UID}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # canonical formula + zero-referral sanity
        assert data.get("network_cap") == 800, f"expected network_cap=800, got {data.get('network_cap')}"
        assert data.get("network_cap_formula") == "min(8000, 800 + 16*L1 + 5*L2 + 3*L3 + 2*L4 + 1*L5)"
        assert data.get("l3_count", -1) == 0
        assert data.get("l4_count", -1) == 0
        assert data.get("l5_count", -1) == 0
        assert data.get("cap_tier4_bonus", -1) == 0
        assert data.get("cap_tier5_bonus", -1) == 0
        assert data.get("cap_tier6_bonus", -1) == 0

    def test_mining_status(self, s):
        r = s.get(f"{BASE_URL}/api/mining/status/{SURESH_UID}", timeout=15)
        assert r.status_code == 200, r.text

    def test_notifications_direct_list(self, s):
        r = s.get(f"{BASE_URL}/api/notifications/referrals/{SURESH_UID}/direct-list", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("referrals", "referrer", "total", "page", "total_pages"):
            assert key in data, f"missing key '{key}' in response: {list(data.keys())}"

    def test_notifications_level_breakdown(self, s):
        r = s.get(f"{BASE_URL}/api/notifications/referrals/{SURESH_UID}/level-breakdown", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        # L1..L5 buckets should exist somewhere in payload
        body = data.get("data", data)
        levels = body.get("levels", body)
        keys_lower = {str(k).lower() for k in (levels.keys() if isinstance(levels, dict) else [])}
        # Accept either l1..l5 or level_1..level_5
        has_l1_l5 = all(any(k in keys_lower for k in (f"l{i}", f"level_{i}", f"level{i}")) for i in range(1, 6))
        assert has_l1_l5, f"L1-L5 buckets not found in level-breakdown response: {data}"

    def test_referral_lookup_valid(self, s):
        r = s.get(f"{BASE_URL}/api/referral/lookup/{SURESH_REFERRAL_CODE}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # should return referrer info (name/uid/etc)
        assert isinstance(data, dict) and len(data) > 0

    def test_referral_lookup_invalid(self, s):
        r = s.get(f"{BASE_URL}/api/referral/lookup/THIS_CODE_DOES_NOT_EXIST_XYZ123", timeout=15)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"


# -------- DELETED ENDPOINTS (must return 404) ----------

DELETED_ENDPOINTS = [
    f"/api/notifications/referrals/{SURESH_UID}/tree",
    f"/api/notifications/referrals/{SURESH_UID}/stats",
    f"/api/notifications/referrals/{SURESH_UID}/earnings",
    f"/api/notifications/referral-earnings/{SURESH_UID}",
    f"/api/notifications/referrals/{SURESH_UID}/levels",
    f"/api/notifications/referrals/{SURESH_UID}/debug-referred-by",
    f"/api/notifications/referrals/{SURESH_UID}/fraud-check",
    f"/api/notifications/referrals/{SURESH_UID}/bonus-breakdown",
    f"/api/notifications/referrals/{SURESH_UID}/network-analytics",
    "/api/notifications/ai/referral-suggestions",
    "/api/referrals/live-activity",
    f"/api/gift/eligible-referrals/{SURESH_UID}",
    f"/api/referral/stats/{SURESH_UID}",
    f"/api/referral/list/{SURESH_UID}",
    f"/api/referral/network/{SURESH_UID}",
    f"/api/referral/bonus/{SURESH_UID}",
    f"/api/referral/code/{SURESH_UID}",
]


@pytest.mark.parametrize("path", DELETED_ENDPOINTS)
def test_deleted_endpoint_returns_404(s, path):
    r = s.get(f"{BASE_URL}{path}", timeout=15)
    assert r.status_code == 404, (
        f"DELETED endpoint {path} should return 404, got {r.status_code}: {r.text[:200]}"
    )
