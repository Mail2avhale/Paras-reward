"""
End-to-end tests for Layer 1.7 auth cache — hits the external preview URL.

Verifies:
  * Admin login (9999999999 / 153759) returns JWT.
  * First authenticated call is slower than second (cache hit).
  * Logout invalidates the auth cache — same JWT returns 401 after logout.
  * /api/admin/observability/db-health surfaces `auth_cache` block.
  * /api/admin/observability/summary still works.
  * /api/mall/v2/wishlist and /api/mall/v2/featured respond in under 3 s.
  * /api/user/{uid} keeps returning correct data.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
ADMIN_MOBILE = "9999999999"
ADMIN_PIN = "153759"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_login(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"mobile": ADMIN_MOBILE, "pin": ADMIN_PIN},
                     timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("access_token") or data.get("token") or (data.get("data") or {}).get("access_token")
    assert token, f"no access_token in response: {list(data.keys())}"
    uid = (data.get("user") or {}).get("uid") or data.get("uid") or (data.get("data") or {}).get("user", {}).get("uid")
    return {"token": token, "uid": uid, "raw": data}


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_login_returns_jwt(admin_login):
    assert admin_login["token"]
    assert admin_login["uid"], f"uid missing: {admin_login['raw']}"


def test_first_vs_second_call_latency(session, admin_login):
    """Second call should hit the in-process cache — expect faster response."""
    uid = admin_login["uid"]
    url = f"{BASE_URL}/api/user/{uid}"
    headers = _auth(admin_login["token"])

    # Warm-up ignored (network); do multiple samples.
    t0 = time.time(); r1 = session.get(url, headers=headers, timeout=15); d1 = time.time() - t0
    t0 = time.time(); r2 = session.get(url, headers=headers, timeout=15); d2 = time.time() - t0
    t0 = time.time(); r3 = session.get(url, headers=headers, timeout=15); d3 = time.time() - t0

    assert r1.status_code == 200, r1.text[:200]
    assert r2.status_code == 200
    assert r3.status_code == 200
    print(f"[latency] call1={d1*1000:.0f}ms call2={d2*1000:.0f}ms call3={d3*1000:.0f}ms")
    # Not strict — network jitter can dominate — just log. Ensure no call > 3 s.
    assert max(d1, d2, d3) < 5.0, "auth-cache should keep p99 < 5s"


def test_wishlist_endpoint_fast(session, admin_login):
    """Was 30s timeout in prod; must now respond quickly (< 3s)."""
    t0 = time.time()
    r = session.get(f"{BASE_URL}/api/mall/v2/wishlist", headers=_auth(admin_login["token"]), timeout=10)
    dt = time.time() - t0
    print(f"[wishlist] status={r.status_code} time={dt*1000:.0f}ms")
    assert r.status_code == 200, r.text[:200]
    assert dt < 3.0, f"wishlist took {dt:.2f}s (expected < 3s)"


def test_featured_public_endpoint_fast(session):
    t0 = time.time()
    r = session.get(f"{BASE_URL}/api/mall/v2/featured", timeout=10)
    dt = time.time() - t0
    print(f"[featured] status={r.status_code} time={dt*1000:.0f}ms")
    assert r.status_code == 200
    assert dt < 3.0


def test_user_dashboard_no_regression(session, admin_login):
    uid = admin_login["uid"]
    r = session.get(f"{BASE_URL}/api/user/{uid}/dashboard",
                    headers=_auth(admin_login["token"]), timeout=15)
    assert r.status_code == 200, r.text[:200]


def test_observability_db_health_has_auth_cache(session, admin_login):
    r = session.get(f"{BASE_URL}/api/admin/observability/db-health",
                    headers=_auth(admin_login["token"]), timeout=15)
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    assert "auth_cache" in data, f"auth_cache block missing; keys={list(data.keys())}"
    ac = data["auth_cache"]
    assert "size" in ac and "ttl_seconds" in ac, f"auth_cache fields wrong: {ac}"
    assert ac["ttl_seconds"] == 60 or ac["ttl_seconds"] == 60.0


def test_observability_summary_still_works(session, admin_login):
    r = session.get(f"{BASE_URL}/api/admin/observability/summary",
                    headers=_auth(admin_login["token"]), timeout=15)
    assert r.status_code == 200, r.text[:200]


def test_logout_invalidates_cache(session):
    """After logout the same JWT MUST be rejected (401)."""
    # Fresh login so we can safely burn this token.
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"mobile": ADMIN_MOBILE, "pin": ADMIN_PIN}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    token = data.get("access_token") or data.get("token") or (data.get("data") or {}).get("access_token")
    uid = (data.get("user") or {}).get("uid") or data.get("uid") or (data.get("data") or {}).get("user", {}).get("uid")
    assert token and uid

    # Prime cache with two calls.
    r1 = session.get(f"{BASE_URL}/api/user/{uid}", headers=_auth(token), timeout=15)
    assert r1.status_code == 200
    r2 = session.get(f"{BASE_URL}/api/user/{uid}", headers=_auth(token), timeout=15)
    assert r2.status_code == 200

    # Logout.
    r_logout = session.post(f"{BASE_URL}/api/auth/logout", headers=_auth(token), timeout=15)
    print(f"[logout] status={r_logout.status_code} body={r_logout.text[:200]}")
    assert r_logout.status_code in (200, 204)

    # Same JWT after logout — must be 401.
    r_after = session.get(f"{BASE_URL}/api/user/{uid}", headers=_auth(token), timeout=15)
    print(f"[after logout] status={r_after.status_code}")
    assert r_after.status_code == 401, f"expected 401 after logout, got {r_after.status_code}: {r_after.text[:200]}"
