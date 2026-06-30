"""Sanity tests for the unified-spend endpoints (post-2026-06-30 migration).

Tests assume:
  • The migration has already been applied (51+ docs in `redeem_requests`)
  • Admin auth available: admin@test.com / 153759
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com")
ADMIN_CREDS = {"email": "admin@test.com", "pin": "153759"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_summary_returns_categories(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/admin/unified-spend/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"]
    assert "rows" in body and isinstance(body["rows"], list)
    assert "totals" in body
    # Every row carries a service_type + category
    for row in body["rows"]:
        assert row.get("service_type")
        assert row.get("category") in {"bank", "utility"}
        assert isinstance(row.get("txns"), int)


def test_summary_filter_by_category(admin_token):
    for cat in ["bank", "utility"]:
        r = requests.get(
            f"{BASE_URL}/api/admin/unified-spend/summary?category={cat}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 200
        for row in r.json()["rows"]:
            assert row["category"] == cat


def test_top_spenders(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/admin/unified-spend/top-spenders?limit=5",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert isinstance(rows, list)
    # Sorted descending by inr
    inrs = [r["inr"] for r in rows]
    assert inrs == sorted(inrs, reverse=True)


def test_per_user_breakdown(admin_token):
    # Use top spender from leaderboard
    leaderboard = requests.get(
        f"{BASE_URL}/api/admin/unified-spend/top-spenders?limit=1",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    ).json()
    if not leaderboard["rows"]:
        pytest.skip("No spend data yet")
    uid = leaderboard["rows"][0]["uid"]

    r = requests.get(
        f"{BASE_URL}/api/admin/unified-spend/user/{uid}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["uid"] == uid
    assert "totals" in body
    assert "by_service_type" in body
    assert "recent" in body
    # Totals: grand = bank + utility
    t = body["totals"]
    assert abs((t["bank_inr"] + t["utility_inr"]) - t["grand_inr"]) < 1, \
        f"grand_inr should equal bank + utility: {t}"


def test_non_admin_blocked():
    # Login as regular user
    r_user = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"mobile": "9970100782", "pin": "997010"},
        timeout=20,
    )
    if r_user.status_code != 200:
        pytest.skip("Regular user creds not available")
    user_token = r_user.json()["token"]
    r = requests.get(
        f"{BASE_URL}/api/admin/unified-spend/summary",
        headers={"Authorization": f"Bearer {user_token}"},
        timeout=20,
    )
    assert r.status_code == 403, f"Non-admin should be blocked, got {r.status_code}"


def test_migration_traceability():
    """Each migrated row in redeem_requests must carry traceability fields.
    Read directly from MongoDB via an admin endpoint that returns a sample."""
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@test.com", "pin": "153759"},
        timeout=20,
    )
    token = r.json()["token"]

    r = requests.get(
        f"{BASE_URL}/api/admin/unified-spend/user/cbdf46d7-7d66-4d43-8495-e1432a2ab071",  # SANTOSH
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip("Test user not present")
    recent = r.json().get("recent", [])
    migrated_rows = [r for r in recent if r.get("_migrated_from")]
    # At least one row should be migrated for this top-spender
    assert migrated_rows, "Expected at least one migrated row for SANTOSH"
    for row in migrated_rows:
        assert row.get("_migrated_from") in {
            "bank_transfer_requests", "bank_withdrawal_requests",
            "chatbot_withdrawal_requests", "recharge_transactions",
            "bill_payment_requests",
        }
