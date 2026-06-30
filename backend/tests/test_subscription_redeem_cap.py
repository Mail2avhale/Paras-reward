"""
Subscription-Stake Redeem Cap — pytest sanity (Jun 2026 spec)
==============================================================

Rule: Each successful subscription payment unlocks ₹2,500 lifetime headroom
for Bank/Recharge/Utility/EMI redemptions combined.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com")

# Known users (live data; counts may grow over time so we verify via the API)
ADMIN = {"email": "admin@test.com", "pin": "153759"}
USER_999 = {"mobile": "9970100782", "pin": "997010"}     # 7 subs at audit time
USER_SANTOSH_UID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"  # 0 subs


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def user_999_session():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=USER_999, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"token": body["token"], "uid": body["uid"]}


def test_user_with_subs_has_positive_cap(user_999_session):
    """A user with subscriptions sees cap_inr = subscription_count × ₹2,500."""
    s = user_999_session
    r = requests.get(
        f"{BASE_URL}/api/user/{s['uid']}/subscription-redeem-cap",
        headers={"Authorization": f"Bearer {s['token']}"},
        timeout=15,
    )
    assert r.status_code == 200
    b = r.json()
    assert b["success"]
    assert b["per_subscription_inr"] == 2500
    assert b["subscription_count"] >= 1
    expected_cap = b["subscription_count"] * 2500
    assert b["cap_inr"] == expected_cap
    assert b["available_inr"] == max(0, expected_cap - b["used_inr"])


def test_user_without_subs_has_zero_cap(admin_token):
    """A user with 0 subscriptions has ₹0 cap (cannot redeem)."""
    r = requests.get(
        f"{BASE_URL}/api/user/{USER_SANTOSH_UID}/subscription-redeem-cap",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200
    b = r.json()
    assert b["subscription_count"] == 0
    assert b["cap_inr"] == 0
    assert b["available_inr"] == 0


def test_idor_protection(user_999_session):
    """A non-admin user CANNOT see another user's cap."""
    s = user_999_session
    r = requests.get(
        f"{BASE_URL}/api/user/{USER_SANTOSH_UID}/subscription-redeem-cap",
        headers={"Authorization": f"Bearer {s['token']}"},
        timeout=15,
    )
    assert r.status_code == 403


def test_leaderboard_returns_sorted(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/admin/subscription-redeem-cap/leaderboard?limit=10",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200
    rows = r.json()["rows"]
    counts = [row["subscription_count"] for row in rows]
    assert counts == sorted(counts, reverse=True), "Leaderboard must be sorted desc"
    for row in rows:
        assert row["cap_inr"] == row["subscription_count"] * 2500


def test_cap_blocks_zero_sub_user_for_bbps(admin_token):
    """A zero-subscription user MUST be blocked by SOME gate at BBPS — could
    be: my new INR cap (403/cap message), or the pre-existing `requires
    subscription` check, or a pydantic validator. The test only asserts that
    a zero-sub user does NOT successfully process a payment."""
    r = requests.post(
        f"{BASE_URL}/api/bbps/pay",
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
        json={
            "user_id": USER_SANTOSH_UID,
            "operator_id": "100",
            "account": "9999999999",
            "amount": "50",
            "mobile": "9999999999",
        },
        timeout=20,
    )
    # We accept ANY non-success — what matters is the user CANNOT redeem.
    success_flag = False
    if r.status_code == 200:
        body = r.json()
        success_flag = body.get("success") is True and body.get("status") not in (403, 429)
    assert not success_flag, f"Zero-sub user must be blocked. Got: {r.status_code} {r.text[:200]}"


def test_per_subscription_constant():
    """Sanity: constant exposed in API is ₹2,500."""
    # Hit admin leaderboard which echoes the constant
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    token = r.json()["token"]
    r = requests.get(
        f"{BASE_URL}/api/admin/subscription-redeem-cap/leaderboard?limit=1",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert r.json()["per_subscription_inr"] == 2500
