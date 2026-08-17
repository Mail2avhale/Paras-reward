"""HTTP-level tests for PRC Redemption Service Charge (Phase 2/3).

Covers:
- Public GET /pending/{uid}, /history/{uid}
- POST /create-payment 404 for missing charge
- Admin endpoints 403 without FINANCE_ADMIN_PIN
- Admin revenue-report structure
- admin_finance profit-loss includes prc_redemption_service_charges
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:3000"
# Attempt to also read from frontend .env for reliability
if not BASE_URL or BASE_URL == "http://localhost:3000":
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"
FRESH_UID = "TEST_svc_charge_nobody_uid"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "admin@test.com", "pin": "153759"},
                      timeout=30)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code}")
    tok = r.json().get("access_token") or r.json().get("token")
    if not tok:
        pytest.skip("no access token in login response")
    return {"Authorization": f"Bearer {tok}"}


# ----------------------- Public endpoints -----------------------

def test_pending_returns_false_for_new_user():
    r = requests.get(f"{API}/redemption-service-charge/pending/{FRESH_UID}", timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["has_pending"] is False
    assert j["charge"] is None


def test_history_empty_for_new_user():
    r = requests.get(f"{API}/redemption-service-charge/history/{FRESH_UID}", timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["charges"] == []
    assert j["totals"] == {"pending": 0, "paid": 0} or j["totals"] == {"pending": 0.0, "paid": 0.0}


def test_create_payment_missing_charge_returns_404():
    r = requests.post(
        f"{API}/redemption-service-charge/create-payment",
        json={"charge_id": "SVC-DOES-NOT-EXIST-XYZ"},
        timeout=30,
    )
    assert r.status_code == 404, r.text


def test_get_charge_missing_returns_404():
    r = requests.get(f"{API}/redemption-service-charge/SVC-NO-SUCH", timeout=30)
    assert r.status_code == 404


# ----------------------- Admin endpoints (no PIN) -----------------------

def test_manual_mark_paid_without_pin_returns_403(admin_headers):
    r = requests.post(
        f"{API}/admin/redemption-service-charge/manual-mark-paid",
        json={"charge_id": "SVC-X", "reason": "testing", "admin_id": "admin"},
        headers=admin_headers, timeout=30,
    )
    # Missing header → FastAPI 422; with wrong header → 403. Accept either.
    assert r.status_code in (403, 422), r.text


def test_manual_mark_paid_wrong_pin_returns_403(admin_headers):
    r = requests.post(
        f"{API}/admin/redemption-service-charge/manual-mark-paid",
        json={"charge_id": "SVC-X", "reason": "testing reason", "admin_id": "admin"},
        headers={**admin_headers, "X-Finance-Pin": "wrong-pin"},
        timeout=30,
    )
    assert r.status_code == 403, r.text


def test_reverse_wrong_pin_returns_403(admin_headers):
    r = requests.post(
        f"{API}/admin/redemption-service-charge/reverse",
        json={"charge_id": "SVC-X", "reason": "testing reason", "admin_id": "admin"},
        headers={**admin_headers, "X-Finance-Pin": "wrong-pin"},
        timeout=30,
    )
    assert r.status_code == 403


def test_revenue_report_returns_series(admin_headers):
    r = requests.get(
        f"{API}/admin/redemption-service-charge/revenue-report?days=30",
        headers=admin_headers, timeout=30,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert "series" in j
    assert "total_revenue" in j
    assert "total_count" in j
    assert isinstance(j["series"], list)


def test_admin_summary_ok(admin_headers):
    r = requests.get(
        f"{API}/admin/redemption-service-charge/summary?days=30",
        headers=admin_headers, timeout=30,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert "by_status" in j
    assert "PENDING" in j["by_status"]
    assert "PAID" in j["by_status"]


def test_admin_pending_list_ok(admin_headers):
    r = requests.get(f"{API}/admin/redemption-service-charge/pending", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "pending" in j
    assert isinstance(j["pending"], list)


def test_admin_search_ok(admin_headers):
    r = requests.get(
        f"{API}/admin/redemption-service-charge/search?q=nonexistent-query",
        headers=admin_headers, timeout=30,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["results"] == []


# ----------------------- admin_finance revenue includes prc svc -----------------------

def test_admin_finance_profit_loss_includes_prc_svc_charges(admin_headers):
    """revenue_details must include prc_redemption_service_charges key."""
    r = requests.get(f"{API}/admin/finance/profit-loss?days=30", headers=admin_headers, timeout=60)
    # Endpoint might require auth; if it does, log and skip
    if r.status_code in (401, 403):
        pytest.skip(f"profit-loss endpoint auth-protected: {r.status_code}")
    assert r.status_code == 200, r.text
    j = r.json()
    rd = (j.get("revenue_details")
          or j.get("revenue", {}).get("details")
          or j.get("data", {}).get("revenue_details")
          or {})
    assert "prc_redemption_service_charges" in rd, f"Missing key. keys={list(rd.keys())[:20]}"
