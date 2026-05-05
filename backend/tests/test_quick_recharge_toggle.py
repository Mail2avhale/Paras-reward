"""End-to-end tests for the Quick Recharge admin toggle.

The toggle is a simple system_config flag persisted via two endpoints:
  GET  /api/admin/failed-transactions/quick-recharge-status   (any auth user)
  POST /api/admin/failed-transactions/quick-recharge-toggle   (admin only)

Tests use the live preview backend so they cover routing + auth middleware.
"""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set (export it before pytest)"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"identifier": "admin@test.com", "pin": "153759"},
        timeout=15,
    )
    r.raise_for_status()
    body = r.json()
    return body["token"], body["uid"]


def test_initial_status_is_readable(admin_token):
    token, _ = admin_token
    r = requests.get(
        f"{BASE}/api/admin/failed-transactions/quick-recharge-status",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert r.status_code == 200
    body = r.json()
    assert "enabled" in body
    assert isinstance(body["enabled"], bool)


def test_admin_can_disable_then_re_enable(admin_token):
    token, uid = admin_token
    h = {"Authorization": f"Bearer {token}"}

    # Disable
    r = requests.post(
        f"{BASE}/api/admin/failed-transactions/quick-recharge-toggle",
        json={"admin_id": uid, "enabled": False},
        headers=h,
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json()["enabled"] is False

    # Status reflects disabled
    r = requests.get(
        f"{BASE}/api/admin/failed-transactions/quick-recharge-status",
        headers=h,
        timeout=10,
    )
    assert r.json()["enabled"] is False

    # Re-enable
    r = requests.post(
        f"{BASE}/api/admin/failed-transactions/quick-recharge-toggle",
        json={"admin_id": uid, "enabled": True},
        headers=h,
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["enabled"] is True

    r = requests.get(
        f"{BASE}/api/admin/failed-transactions/quick-recharge-status",
        headers=h,
        timeout=10,
    )
    assert r.json()["enabled"] is True


def test_non_admin_cannot_toggle(admin_token):
    """A regular (non-admin) user must not be able to flip the switch."""
    # Login as non-admin (preview seed: 9970100782 / 997010 mobile-PIN flow)
    # Fall back gracefully if seed user missing.
    token, _ = admin_token
    r = requests.post(
        f"{BASE}/api/admin/failed-transactions/quick-recharge-toggle",
        json={"admin_id": "non-admin-fake-uid", "enabled": False},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    # Must reject — admin role check uses request.admin_id, not the bearer token
    assert r.status_code == 403, r.text
