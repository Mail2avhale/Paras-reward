"""
Full regression sweep for Phase 0,1,2, Mall 2.0, Delete Account, Phase 3
Tests against AAB v1.0.8 (versionCode 9).
"""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")

USER_MOBILE = "9970100782"
USER_PIN = "997010"
USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


@pytest.fixture(scope="session")
def user_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"mobile": USER_MOBILE, "pin": USER_PIN}, timeout=20)
    assert r.status_code == 200, f"User login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/admin-login", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=20)
    if r.status_code != 200:
        # Try alternate route
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("role") in ("admin", "super_admin", "manager"), f"Admin role wrong: {data.get('role')}"
    return data["access_token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ==== Version info ====
class TestVersionInfo:
    def test_version_info(self):
        r = requests.get(f"{BASE_URL}/api/app/version-info", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["latest_version_name"] == "1.0.8"
        assert d["latest_version_code"] == 9
        assert "com.parasreward.prc" in d["play_store_url"]
        assert d["force_update"] is False


# ==== Auth ====
class TestAuth:
    def test_user_login(self, user_token):
        assert user_token

    def test_admin_login(self, admin_token):
        assert admin_token


# ==== Phase 2 — Rewarded Ads ====
class TestRewardedAds:
    def test_quota(self, user_token):
        r = requests.get(f"{BASE_URL}/api/ads/rewarded/quota", headers=h(user_token), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["max"] == 10
        assert d["reward_per_ad"] == 0.5
        assert "used" in d and "remaining" in d

    def test_start_and_credit(self, user_token):
        # Get current state
        rq = requests.get(f"{BASE_URL}/api/ads/rewarded/quota", headers=h(user_token), timeout=10).json()
        if rq.get("remaining", 0) <= 0:
            pytest.skip("Daily cap reached")

        rs = requests.post(f"{BASE_URL}/api/ads/rewarded/start", headers=h(user_token), timeout=10)
        assert rs.status_code == 200, rs.text
        token = rs.json().get("view_token")
        assert token

        rc = requests.post(f"{BASE_URL}/api/ads/rewarded/credit", headers=h(user_token),
                           json={"view_token": token}, timeout=15)
        assert rc.status_code == 200, rc.text

        # Replay
        rr = requests.post(f"{BASE_URL}/api/ads/rewarded/credit", headers=h(user_token),
                           json={"view_token": token}, timeout=15)
        assert rr.status_code == 409, f"expected 409 replay, got {rr.status_code} {rr.text}"


# ==== Mall 2.0 ====
class TestMallV2:
    def test_categories(self):
        r = requests.get(f"{BASE_URL}/api/mall/v2/categories", timeout=10)
        assert r.status_code == 200
        body = r.json()
        cats = body.get("categories", body) if isinstance(body, dict) else body
        assert isinstance(cats, list) and len(cats) >= 6
        # Idempotent
        r2 = requests.get(f"{BASE_URL}/api/mall/v2/categories", timeout=10)
        body2 = r2.json()
        cats2 = body2.get("categories", body2) if isinstance(body2, dict) else body2
        assert len(cats2) == len(cats)

    def test_saver_progress(self, user_token):
        r = requests.get(f"{BASE_URL}/api/mall/v2/saver-progress", headers=h(user_token), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "balance" in d
        assert "affordable_count" in d

    def test_wishlist_toggle(self, user_token):
        # find a product
        body = requests.get(f"{BASE_URL}/api/mall/products", timeout=10).json()
        prods = body.get("products", body) if isinstance(body, dict) else body
        assert len(prods) > 0
        pid = prods[0].get("product_id") or prods[0].get("id") or prods[0].get("_id")

        r1 = requests.post(f"{BASE_URL}/api/mall/v2/wishlist/{pid}/toggle", headers=h(user_token), timeout=10)
        assert r1.status_code == 200, r1.text
        wl_body = requests.get(f"{BASE_URL}/api/mall/v2/wishlist", headers=h(user_token), timeout=10).json()
        wl = wl_body.get("items", wl_body) if isinstance(wl_body, dict) else wl_body
        # Toggle off again to clean up
        requests.post(f"{BASE_URL}/api/mall/v2/wishlist/{pid}/toggle", headers=h(user_token), timeout=10)

    def test_recently_viewed(self, user_token):
        body = requests.get(f"{BASE_URL}/api/mall/products", timeout=10).json()
        prods = body.get("products", body) if isinstance(body, dict) else body
        pid = prods[0].get("product_id") or prods[0].get("id") or prods[0].get("_id")
        r = requests.post(f"{BASE_URL}/api/mall/v2/track-view/{pid}", headers=h(user_token), timeout=10)
        assert r.status_code in (200, 201), r.text
        r2 = requests.get(f"{BASE_URL}/api/mall/v2/recently-viewed", headers=h(user_token), timeout=10)
        assert r2.status_code == 200

    def test_reviews_not_booked_403(self, user_token):
        body = requests.get(f"{BASE_URL}/api/mall/products", timeout=10).json()
        prods = body.get("products", body) if isinstance(body, dict) else body
        # find a product user likely hasn't booked - use the last one
        pid = prods[-1].get("product_id") or prods[-1].get("id") or prods[-1].get("_id")
        r = requests.post(f"{BASE_URL}/api/mall/v2/reviews/{pid}", headers=h(user_token),
                          json={"rating": 5, "comment": "test"}, timeout=10)
        assert r.status_code in (403, 409), f"expected 403/409, got {r.status_code} {r.text}"

    def test_admin_analytics(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/mall/v2/admin/analytics?days=30", headers=h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("totals", "daily", "top_products", "by_category"):
            assert k in d, f"missing {k}"

    def test_admin_analytics_non_admin_forbidden(self, user_token):
        r = requests.get(f"{BASE_URL}/api/mall/v2/admin/analytics?days=30", headers=h(user_token), timeout=10)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"

    def test_sales_export_csv(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/mall/v2/admin/sales-export?days=30", headers=h(admin_token), timeout=20)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "csv" in ct.lower(), f"unexpected ct {ct}"
        assert len(r.text.splitlines()) >= 1

    def test_admin_ai_description(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/mall/v2/admin/ai-description",
                          headers=h(admin_token),
                          json={"product_name": "Smart Watch", "keywords": "fitness,health,bluetooth"},
                          timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        txt = d.get("description") or d.get("text") or ""
        assert len(txt) > 20, f"too short: {txt}"

    def test_admin_ai_description_non_admin_forbidden(self, user_token):
        r = requests.post(f"{BASE_URL}/api/mall/v2/admin/ai-description",
                          headers=h(user_token),
                          json={"product_name": "Phone", "keywords": "5g"}, timeout=10)
        assert r.status_code == 403

    def test_csv_bulk_import(self, admin_token):
        csv_data = "name,description,mrp_inr,category,stock_count\nTEST_Item_A,Desc A,1000,electronics,5\nTEST_Item_B,Desc B,2000,fashion,3\n"
        files = {"file": ("test.csv", io.BytesIO(csv_data.encode()), "text/csv")}
        r = requests.post(f"{BASE_URL}/api/mall/v2/admin/products/bulk-import",
                          headers=h(admin_token), files=files, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("created", 0) >= 2 or d.get("imported", 0) >= 2, f"created mismatch: {d}"

    def test_admin_badges_update(self, admin_token):
        body = requests.get(f"{BASE_URL}/api/mall/products", timeout=10).json()
        prods = body.get("products", body) if isinstance(body, dict) else body
        pid = prods[0].get("product_id") or prods[0].get("id") or prods[0].get("_id")
        r = requests.patch(f"{BASE_URL}/api/mall/v2/admin/product/{pid}/badges",
                           headers=h(admin_token),
                           json={"is_new": True, "is_trending": False, "is_hot": True,
                                 "stock_count": 50, "category": "electronics"},
                           timeout=10)
        assert r.status_code == 200, r.text

    def test_booking_timeline(self, user_token, admin_token):
        # find a booking for the test user
        # try via admin list
        r = requests.get(f"{BASE_URL}/api/mall/v2/admin/bookings?limit=5", headers=h(admin_token), timeout=10)
        if r.status_code != 200:
            pytest.skip("no admin bookings list")
        bookings = r.json() if isinstance(r.json(), list) else r.json().get("bookings", [])
        if not bookings:
            pytest.skip("no bookings to test timeline")
        bid = bookings[0].get("id") or bookings[0].get("booking_id") or bookings[0].get("_id")
        rt = requests.get(f"{BASE_URL}/api/mall/v2/booking/{bid}/timeline", headers=h(user_token), timeout=10)
        # User may not be owner; admin should pass
        if rt.status_code == 403:
            rt = requests.get(f"{BASE_URL}/api/mall/v2/booking/{bid}/timeline", headers=h(admin_token), timeout=10)
        assert rt.status_code == 200, rt.text
        d = rt.json()
        # 5-step funnel
        steps = d.get("steps") or d.get("timeline") or d
        assert steps


# ==== Delete Account ====
class TestDeleteAccount:
    def test_deletion_request_public(self):
        unique = str(int(time.time()))[-7:]
        mobile = "8" + unique[-9:].zfill(9)  # 10-digit starting with 8
        # Ensure exactly 10 digits
        mobile = ("8" + unique).ljust(10, "0")[:10]
        payload = {"mobile": mobile, "email": f"test_{unique}@example.com", "reason": "Testing delete account flow"}
        r = requests.post(f"{BASE_URL}/api/account/deletion-request", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "request_id" in d or "reference_id" in d or "id" in d, f"missing id in {d}"

        # Duplicate within session
        r2 = requests.post(f"{BASE_URL}/api/account/deletion-request", json=payload, timeout=10)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("already_open") in (True, None) or "request_id" in d2 or "id" in d2

    def test_deletion_invalid_mobile(self):
        r = requests.post(f"{BASE_URL}/api/account/deletion-request",
                          json={"mobile": "123", "email": "x@x.com", "reason": "test"}, timeout=10)
        assert r.status_code in (400, 422), f"expected 400/422, got {r.status_code}"

    def test_admin_list_deletion_requests(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/account/admin/deletion-requests?status=received",
                         headers=h(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), (list, dict))


# ==== Phase 3 - App badge ====
class TestNotifications:
    def test_unread_count(self):
        r = requests.get(f"{BASE_URL}/api/notifications/{USER_UID}/unread-count", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "unread_count" in d
        assert isinstance(d["unread_count"], int)
