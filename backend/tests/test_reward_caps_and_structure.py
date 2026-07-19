"""
Community Reward Caps (FIFO monthly ceiling) + same-or-higher partner
structure validation — E2E API tests (Feb 20, 2026).

Run:
    cd /app/backend && pytest tests/test_reward_caps_and_structure.py -v
"""
from __future__ import annotations

import os
import pathlib
import pytest
import requests

try:
    from dotenv import load_dotenv  # type: ignore
    _ENV = pathlib.Path(__file__).resolve().parents[1] / ".env"
    if _ENV.exists():
        load_dotenv(_ENV)
except Exception:
    pass

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://formula-audit-fix.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PIN = "123456"
ADMIN_ID = "admin-test-123"
ADMIN_EMAIL = "admin@test.com"
ADMIN_LOGIN_PIN = "153759"
TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


# ────────────────────────────────────────────────────────────────
# helpers
# ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_bearer():
    r = requests.post(
        f"{API}/auth/login",
        json={"identifier": ADMIN_EMAIL, "pin": ADMIN_LOGIN_PIN},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in response: {r.text[:200]}"
    return tok


def _admin_headers(bearer: str) -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {bearer}",
        "X-Admin-Pin": ADMIN_PIN,
    }


# ────────────────────────────────────────────────────────────────
# 1) PUBLIC cap table endpoint
# ────────────────────────────────────────────────────────────────
def test_public_cap_config_returns_5_roles():
    r = requests.get(f"{API}/community/monthly-cap-config", timeout=10)
    assert r.status_code == 200, r.text[:200]
    body = r.json()
    assert body.get("success") is True
    assert body.get("prc_per_inr") == 10
    caps = body["caps"]
    assert len(caps) == 5
    lookup = {c["role"]: c for c in caps}
    # Defaults per spec (INR)
    assert lookup["user"]["cap_inr"] == 100_000
    assert lookup["district_partner"]["cap_inr"] == 300_000
    assert lookup["regional_state_partner"]["cap_inr"] == 400_000
    assert lookup["state_partner"]["cap_inr"] == 500_000
    assert lookup["national_partner"]["cap_inr"] == 1_000_000
    # PRC = INR × 10
    for c in caps:
        assert c["cap_prc"] == c["cap_inr"] * 10


# ────────────────────────────────────────────────────────────────
# 2) USER monthly cap status for a known test user
# ────────────────────────────────────────────────────────────────
def test_user_monthly_cap_status_shape():
    r = requests.get(f"{API}/community/monthly-cap-status/{TEST_UID}", timeout=10)
    assert r.status_code == 200, r.text[:200]
    body = r.json()
    for k in (
        "success", "uid", "role", "role_label",
        "cap_prc", "cap_inr", "used_prc", "used_inr",
        "remaining_prc", "remaining_inr", "used_pct",
        "capped", "reset_at_utc", "seconds_to_reset",
    ):
        assert k in body, f"missing key: {k}"
    assert body["uid"] == TEST_UID
    assert body["cap_prc"] == body["cap_inr"] * 10
    # remaining = cap - used (never negative)
    assert body["remaining_prc"] >= 0
    assert body["used_pct"] >= 0


def test_user_monthly_cap_status_unknown_uid_returns_404():
    r = requests.get(f"{API}/community/monthly-cap-status/nonexistent-uid-xxx", timeout=10)
    assert r.status_code == 404


# ────────────────────────────────────────────────────────────────
# 3) ADMIN GET / POST / RESET config
# ────────────────────────────────────────────────────────────────
def test_admin_get_config_requires_bearer():
    r = requests.get(f"{API}/admin/community-caps/config", headers={"X-Admin-Pin": ADMIN_PIN}, timeout=10)
    assert r.status_code == 401, "must require bearer token"


def test_admin_get_config_returns_effective_table(admin_bearer):
    r = requests.get(
        f"{API}/admin/community-caps/config",
        headers=_admin_headers(admin_bearer),
        timeout=10,
    )
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    assert body["prc_per_inr"] == 10
    assert body["effective_inr"]["user"] == 100_000
    assert body["defaults_inr"]["national_partner"] == 1_000_000


def test_admin_update_and_reset(admin_bearer):
    # bump state cap to ₹6L
    r = requests.post(
        f"{API}/admin/community-caps/config",
        headers=_admin_headers(admin_bearer),
        json={"admin_id": ADMIN_ID, "caps_inr": {"state_partner": 600_000}},
        timeout=10,
    )
    assert r.status_code == 200, r.text[:300]
    updated = r.json()["caps_inr"]
    assert updated["state_partner"] == 600_000
    # other roles preserved
    assert updated["user"] == 100_000

    # verify via public config
    pub = requests.get(f"{API}/community/monthly-cap-config", timeout=10).json()
    state_row = next(c for c in pub["caps"] if c["role"] == "state_partner")
    assert state_row["cap_inr"] == 600_000

    # reset
    r2 = requests.post(
        f"{API}/admin/community-caps/config/reset",
        headers=_admin_headers(admin_bearer),
        timeout=10,
    )
    assert r2.status_code == 200
    # after reset, effective should return to default
    r3 = requests.get(
        f"{API}/admin/community-caps/config",
        headers=_admin_headers(admin_bearer),
        timeout=10,
    )
    assert r3.json()["effective_inr"]["state_partner"] == 500_000


def test_admin_wrong_pin_rejected(admin_bearer):
    r = requests.get(
        f"{API}/admin/community-caps/config",
        headers={
            "Authorization": f"Bearer {admin_bearer}",
            "X-Admin-Pin": "000000",
        },
        timeout=10,
    )
    assert r.status_code == 403, r.text[:200]


def test_admin_audit_endpoint(admin_bearer):
    r = requests.get(
        f"{API}/admin/community-caps/audit?limit=20",
        headers=_admin_headers(admin_bearer),
        timeout=15,
    )
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    assert body["success"] is True
    assert "users" in body
    # Each entry has the expected fields
    for row in body["users"]:
        for k in ("uid", "role", "earned_prc", "cap_prc", "used_pct", "capped"):
            assert k in row


# ────────────────────────────────────────────────────────────────
# 4) STRUCTURE VALIDATION — same-or-higher-position rule
#    We only test the pure helper _positions_ge here (E2E structure
#    test would need a whole downline seeded — covered by unit tests
#    inside the repo, plus the mining_commission E2E suite).
# ────────────────────────────────────────────────────────────────
def test_positions_ge_hierarchy():
    """Unit-level test for the hierarchy helper — imported directly."""
    from routes.partner_positions import _positions_ge

    assert _positions_ge("national_partner") == ["national_partner"]
    assert _positions_ge("state_partner") == ["state_partner", "national_partner"]
    assert _positions_ge("regional_state_partner") == [
        "regional_state_partner", "state_partner", "national_partner",
    ]
    assert _positions_ge("district_partner") == [
        "district_partner", "regional_state_partner", "state_partner", "national_partner",
    ]
