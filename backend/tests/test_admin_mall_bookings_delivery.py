"""
Backend tests for Admin Paras Mall — verify GET /api/admin/mall/bookings
returns full delivery sub-object + user_name/user_mobile fields.

Related iteration: pagination + delivery-address column enhancement.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"

DELIVERY_KEYS = {"name", "mobile", "address_line", "landmark", "city", "state", "pin_code"}


@pytest.fixture(scope="module")
def admin_token():
    """Login as admin and return bearer token."""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    d = r.json()
    tok = d.get("token")
    assert tok, f"no token in login response: {d}"
    return tok


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ============ admin_list_bookings shape ============

class TestAdminMallBookings:
    def test_bookings_endpoint_ok(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/mall/bookings?limit=25", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert "bookings" in data
        assert isinstance(data["bookings"], list)

    def test_bookings_include_user_name_and_mobile(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/mall/bookings?limit=25", headers=headers, timeout=20)
        assert r.status_code == 200
        bookings = r.json().get("bookings", [])
        if not bookings:
            pytest.skip("No bookings on server to validate against")
        for b in bookings[:10]:
            assert "user_name" in b, f"user_name missing on booking {b.get('booking_id')}"
            assert "user_mobile" in b, f"user_mobile missing on booking {b.get('booking_id')}"

    def test_bookings_include_delivery_object(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/mall/bookings?limit=50", headers=headers, timeout=20)
        assert r.status_code == 200
        bookings = r.json().get("bookings", [])
        if not bookings:
            pytest.skip("No bookings on server to validate against")
        # At least one booking should carry a `delivery` sub-object.
        with_delivery = [b for b in bookings if isinstance(b.get("delivery"), dict)]
        assert with_delivery, "No booking carries a `delivery` sub-object — column will render empty for every row."
        # Sub-object should surface expected keys where present.
        for b in with_delivery[:5]:
            d = b["delivery"]
            keys = set(d.keys())
            # Not all bookings must have all keys, but at least a subset should be present.
            common = keys & DELIVERY_KEYS
            assert common, f"delivery on {b.get('booking_id')} has none of {DELIVERY_KEYS} — has {list(keys)}"

    def test_fulfilled_filter_returns_only_fulfilled(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/mall/bookings?status=fulfilled&limit=25", headers=headers, timeout=20)
        assert r.status_code == 200
        for b in r.json().get("bookings", []):
            assert b.get("status") == "fulfilled", f"filter leak: {b.get('status')} on {b.get('booking_id')}"

    def test_delivered_filter_returns_only_delivered(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/mall/bookings?status=delivered&limit=25", headers=headers, timeout=20)
        assert r.status_code == 200
        for b in r.json().get("bookings", []):
            assert b.get("status") == "delivered", f"filter leak: {b.get('status')} on {b.get('booking_id')}"

    def test_new_bookings_have_full_delivery_address(self, headers):
        """Newer bookings (post-address-mandatory rollout) should surface address_line."""
        r = requests.get(f"{BASE_URL}/api/admin/mall/bookings?limit=50", headers=headers, timeout=20)
        bookings = r.json().get("bookings", [])
        if not bookings:
            pytest.skip("no bookings")
        with_addr = [b for b in bookings if (b.get("delivery") or {}).get("address_line")]
        # It's OK if 0/50 have address for a very old dataset, but at least log/warn.
        # We assert that IF any bookings have a delivery.address_line then they also have pin_code + city
        for b in with_addr[:5]:
            d = b["delivery"]
            assert d.get("pin_code"), f"pin_code missing on {b.get('booking_id')} even though address_line exists"
            assert d.get("city"), f"city missing on {b.get('booking_id')} even though address_line exists"

    def test_response_no_mongo_id_leak(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/mall/bookings?limit=10", headers=headers, timeout=20)
        for b in r.json().get("bookings", []):
            assert "_id" not in b, "MongoDB _id leaked in response"


# ============ analytics + products (used on same page) ============

class TestAdminMallSupportingRoutes:
    def test_products_public_returns_list(self):
        r = requests.get(f"{BASE_URL}/api/mall/products?only_active=false", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "products" in data
        assert isinstance(data["products"], list)

    def test_admin_analytics_ok(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/mall/analytics", headers=headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "total_products" in data
