"""
Live API tests for the Structural Bonus-Gate on top of Partner Positions.
Tests the actual test user (uid=76b75808-47fa-48dd-ad7c-8074678e3607) and the
new /admin/partners/audit-structure endpoint.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://formula-audit-fix.preview.emergentagent.com",
).rstrip("/")
ADMIN_PIN = "123456"
ELITE_TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


@pytest.fixture(scope="module")
def admin_jwt():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"identifier": "admin@test.com", "password": "153759"},
                      timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_jwt):
    return {
        "X-Admin-Pin": ADMIN_PIN,
        "Authorization": f"Bearer {admin_jwt}",
        "Content-Type": "application/json",
    }


def _revoke(admin_headers, uid):
    requests.post(f"{BASE_URL}/api/admin/partners/revoke",
                  json={"admin_id": "admin-test-123", "uid": uid},
                  headers=admin_headers, timeout=15)


# ─── 1. Default USER position → structure NOT required, structure_met=True ──
def test_default_user_bypasses_structure(admin_headers):
    # Ensure test user is USER position
    _revoke(admin_headers, ELITE_TEST_UID)

    r = requests.get(f"{BASE_URL}/api/partners/my-position/{ELITE_TEST_UID}", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["partner_position"] == "user", d
    assert d["structure_required"] is False, d
    # bypass: for USER, structure_met MUST be True
    assert d["structure_met"] is True, d
    print(f"[USER default] cap={d['cap']} structure_required={d['structure_required']} structure_met={d['structure_met']}")


# ─── 2. DISTRICT — structure required, elite_active True, commission_active False ──
def test_district_gate_active(admin_headers):
    try:
        r = requests.post(f"{BASE_URL}/api/admin/partners/assign",
                          json={"admin_id": "admin-test-123",
                                "query": ELITE_TEST_UID, "position": "district_partner"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text

        r2 = requests.get(f"{BASE_URL}/api/partners/my-position/{ELITE_TEST_UID}", timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["partner_position"] == "district_partner"
        assert d["structure_required"] is True
        sr = d["structure_report"]
        assert sr["child_type"] == "elite_user"
        assert sr["required_count"] == 100
        assert d["structure_met"] is False  # test user won't have 100 elite L1
        assert d["elite_active"] is True
        assert d["commission_active"] is False  # structure fails → blocked
        print(f"[DISTRICT] required={sr['required_count']} current={sr['current_count']} met={d['structure_met']}")
    finally:
        _revoke(admin_headers, ELITE_TEST_UID)


# ─── 3. NATIONAL — child_type=state_partner, required_count=5 ──
def test_national_gate_structure(admin_headers):
    try:
        r = requests.post(f"{BASE_URL}/api/admin/partners/assign",
                          json={"admin_id": "admin-test-123",
                                "query": ELITE_TEST_UID, "position": "national_partner"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200

        r2 = requests.get(f"{BASE_URL}/api/partners/my-position/{ELITE_TEST_UID}", timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["partner_position"] == "national_partner"
        sr = d["structure_report"]
        assert sr["child_type"] == "state_partner"
        assert sr["required_count"] == 5
        assert sr["current_count"] == 0
        assert d["structure_met"] is False
        print(f"[NATIONAL] child_type={sr['child_type']} required={sr['required_count']} current={sr['current_count']}")
    finally:
        _revoke(admin_headers, ELITE_TEST_UID)


# ─── 4. audit-structure endpoint — 200 with correct fields, 403 wrong pin ──
def test_audit_structure_endpoint(admin_headers):
    try:
        # assign STATE to make it interesting
        r = requests.post(f"{BASE_URL}/api/admin/partners/assign",
                          json={"admin_id": "admin-test-123",
                                "query": ELITE_TEST_UID, "position": "state_partner"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200

        r2 = requests.get(f"{BASE_URL}/api/admin/partners/audit-structure/{ELITE_TEST_UID}",
                          headers=admin_headers, timeout=15)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert "elite_active" in body
        assert "structure_report" in body
        assert "commission_active" in body
        assert body["structure_report"]["child_type"] == "regional_state_partner"
        assert body["structure_report"]["required_count"] == 3
        print(f"[audit] elite_active={body['elite_active']} commission_active={body['commission_active']}")

        # wrong PIN → 403
        bad = {**admin_headers, "X-Admin-Pin": "000000"}
        r3 = requests.get(f"{BASE_URL}/api/admin/partners/audit-structure/{ELITE_TEST_UID}",
                          headers=bad, timeout=15)
        assert r3.status_code == 403, r3.text
    finally:
        _revoke(admin_headers, ELITE_TEST_UID)
