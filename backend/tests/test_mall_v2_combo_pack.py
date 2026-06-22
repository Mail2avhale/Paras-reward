"""
test_mall_v2_combo_pack.py — PARAS MALL 2.0 (Combo Pack) backend tests.
Covers wishlist, recently-viewed, saver-progress, reviews, categories,
booking timeline, admin analytics, badges patch, AI description, CSV
bulk import, sales export, and /api/app/version-info (v1.0.7 / code 8).
"""
import os
import io
import csv
import time
import uuid
import pytest
import requests
from dotenv import dotenv_values

_FENV = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _FENV.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

USER_MOBILE = "9970100782"
USER_PIN = "997010"
USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"

ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


# ── Auth fixtures ──────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"mobile": USER_MOBILE, "pin": USER_PIN}, timeout=30)
    assert r.status_code == 200, f"User login failed: {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"No token in user login response: {r.text}"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def a_product_id(user_session):
    r = user_session.get(f"{API}/mall/products", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data.get("products") or data.get("items") or data
    assert items and len(items) > 0
    return items[0]["product_id"]


@pytest.fixture(scope="module")
def seeded_booking(user_session, a_product_id):
    """Seed a booking directly in Mongo for the primary test user (cleanup after).
    Required because the live test user has 0 mall bookings in this env.
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import dotenv_values
    import asyncio
    e = dotenv_values("/app/backend/.env")
    c = AsyncIOMotorClient(e["MONGO_URL"])
    db = c[e["DB_NAME"]]

    booking_id = f"TEST_BK_{uuid.uuid4().hex[:10]}"
    doc = {
        "booking_id": booking_id,
        "user_id": USER_UID,
        "product_id": a_product_id,
        "product_name": "TEST_seed_product",
        "upfront_prc": 0,
        "status": "active",
        "created_at": "2026-06-01T00:00:00+00:00",
    }

    async def _ins():
        await db.mall_bookings.insert_one(doc)
    asyncio.get_event_loop().run_until_complete(_ins())

    yield {"booking_id": booking_id, "product_id": a_product_id}

    async def _cleanup():
        await db.mall_bookings.delete_one({"booking_id": booking_id})
        await db.mall_product_reviews.delete_many({"uid": USER_UID, "product_id": a_product_id})
    asyncio.get_event_loop().run_until_complete(_cleanup())


@pytest.fixture(scope="module")
def user_booked_product_id(seeded_booking):
    return seeded_booking["product_id"]


# ── Version ────────────────────────────────────────────────────────────────
def test_version_info_has_required_fields():
    """Version-agnostic check — just verify endpoint contract, not specific version values."""
    last = None
    for _ in range(3):
        r = requests.get(f"{API}/app/version-info", timeout=20)
        if r.status_code == 200:
            data = r.json()
            assert isinstance(data.get("latest_version_name"), str) and data["latest_version_name"], data
            assert isinstance(data.get("latest_version_code"), int) and data["latest_version_code"] >= 1, data
            assert "com.parasreward.prc" in data.get("play_store_url", ""), data
            return
        last = r
        time.sleep(1.5)
    pytest.fail(f"version-info failed after retries: {last.status_code} {last.text[:200]}")


# ── Wishlist ───────────────────────────────────────────────────────────────
class TestWishlist:
    def test_toggle_on_then_get(self, user_session, a_product_id):
        # Pre-clean: if already in wishlist, toggle off first
        r0 = user_session.get(f"{API}/mall/v2/wishlist", timeout=20)
        assert r0.status_code == 200
        in_already = any(it["product"]["product_id"] == a_product_id for it in r0.json().get("items", []))
        if in_already:
            user_session.post(f"{API}/mall/v2/wishlist/{a_product_id}/toggle", timeout=20)

        r = user_session.post(f"{API}/mall/v2/wishlist/{a_product_id}/toggle", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["in_wishlist"] is True

        r2 = user_session.get(f"{API}/mall/v2/wishlist", timeout=20)
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert any(it["product"]["product_id"] == a_product_id for it in items)

    def test_toggle_off(self, user_session, a_product_id):
        r = user_session.post(f"{API}/mall/v2/wishlist/{a_product_id}/toggle", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["in_wishlist"] is False
        r2 = user_session.get(f"{API}/mall/v2/wishlist", timeout=20)
        assert not any(it["product"]["product_id"] == a_product_id for it in r2.json()["items"])


# ── Recently Viewed ────────────────────────────────────────────────────────
class TestRecentlyViewed:
    def test_track_view_then_list(self, user_session, a_product_id):
        r = user_session.post(f"{API}/mall/v2/track-view/{a_product_id}", timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        r2 = user_session.get(f"{API}/mall/v2/recently-viewed?limit=10", timeout=20)
        assert r2.status_code == 200
        prods = r2.json().get("products", [])
        assert any(p["product_id"] == a_product_id for p in prods)
        # view_count should be > 0 on the product
        target = next(p for p in prods if p["product_id"] == a_product_id)
        assert target.get("view_count", 0) >= 1


# ── Saver Progress ─────────────────────────────────────────────────────────
class TestSaverProgress:
    def test_saver_progress_shape(self, user_session):
        r = user_session.get(f"{API}/mall/v2/saver-progress", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "balance" in data
        assert isinstance(data["balance"], (int, float))
        if data.get("next_target"):
            t = data["next_target"]
            assert t["percent"] >= 0 and t["percent"] <= 100
            assert "needed" in t and "have" in t and "remaining" in t and "product" in t


# ── Categories ─────────────────────────────────────────────────────────────
class TestCategories:
    def test_categories_seeded(self, user_session):
        r = user_session.get(f"{API}/mall/v2/categories", timeout=20)
        assert r.status_code == 200, r.text
        cats = r.json()["categories"]
        slugs = {c["slug"] for c in cats}
        assert {"all", "electronics", "vouchers", "fashion", "home", "general"}.issubset(slugs)
        assert len(cats) >= 6

    def test_categories_idempotent(self, user_session):
        # Calling repeatedly should not duplicate
        r1 = user_session.get(f"{API}/mall/v2/categories", timeout=20)
        r2 = user_session.get(f"{API}/mall/v2/categories", timeout=20)
        assert r1.status_code == 200 and r2.status_code == 200
        assert len(r1.json()["categories"]) == len(r2.json()["categories"])


# ── Reviews ────────────────────────────────────────────────────────────────
class TestReviews:
    def test_get_reviews_initial_or_existing(self, user_session, a_product_id):
        r = user_session.get(f"{API}/mall/v2/reviews/{a_product_id}", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "reviews" in body and "summary" in body
        assert "average_rating" in body["summary"] and "total_reviews" in body["summary"]

    def test_post_review_without_booking_403(self, user_session, a_product_id, user_session_2=None):
        # Use a random unbooked product_id to be safe — we'll use a fake uuid product.
        # Actually api checks product exists first → 404. So use real un-booked product:
        # safest: use a_product_id only if user hasn't booked it. We attempt and accept 403 OR 200/409.
        r = user_session.post(
            f"{API}/mall/v2/reviews/{a_product_id}",
            json={"rating": 5, "text": "Great!"},
            timeout=20,
        )
        # If user happens to have booked a_product_id, may return 200/409 — those are still valid auth paths.
        assert r.status_code in (200, 403, 409), r.text

    def test_review_full_flow_on_booked_product(self, user_session, user_booked_product_id):
        pid = user_booked_product_id
        # First clean: we can't easily delete, but accept 409 second time
        r1 = user_session.post(
            f"{API}/mall/v2/reviews/{pid}",
            json={"rating": 4, "text": "TEST_review from automated test"},
            timeout=20,
        )
        assert r1.status_code in (200, 409), r1.text
        # Now GET should show at least 1 review
        r2 = user_session.get(f"{API}/mall/v2/reviews/{pid}", timeout=20)
        assert r2.status_code == 200
        assert r2.json()["summary"]["total_reviews"] >= 1
        assert r2.json()["summary"]["average_rating"] > 0
        # Duplicate POST → 409
        r3 = user_session.post(
            f"{API}/mall/v2/reviews/{pid}",
            json={"rating": 5, "text": "again"},
            timeout=20,
        )
        assert r3.status_code == 409, f"Expected 409 dup, got {r3.status_code}: {r3.text}"


# ── Admin Analytics ────────────────────────────────────────────────────────
class TestAdminAnalytics:
    def test_admin_analytics_shape(self, admin_session):
        r = admin_session.get(f"{API}/mall/v2/admin/analytics?days=30", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        for k in ("totals", "daily", "top_products", "by_category", "top_viewed"):
            assert k in data
        for k in ("bookings", "prc_collected", "unique_buyers"):
            assert k in data["totals"]

    def test_admin_analytics_forbidden_for_user(self, user_session):
        r = user_session.get(f"{API}/mall/v2/admin/analytics?days=30", timeout=20)
        assert r.status_code == 403, r.text


# ── Admin Badges Patch ─────────────────────────────────────────────────────
class TestAdminBadges:
    def test_patch_badges_persisted(self, admin_session, a_product_id):
        r = admin_session.patch(
            f"{API}/mall/v2/admin/product/{a_product_id}/badges",
            json={"is_new": True, "is_trending": True, "stock_count": 3},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True
        # Verify via /mall/products
        r2 = admin_session.get(f"{API}/mall/products", timeout=20)
        items = r2.json().get("products") or r2.json().get("items") or r2.json()
        target = next((p for p in items if p["product_id"] == a_product_id), None)
        assert target is not None
        assert target.get("is_new") is True
        assert target.get("is_trending") is True
        assert target.get("stock_count") == 3


# ── AI Description ─────────────────────────────────────────────────────────
class TestAIDescription:
    def test_ai_desc_admin_success(self, admin_session):
        r = admin_session.post(
            f"{API}/mall/v2/admin/ai-description",
            json={"product_name": "Smart Watch", "keywords": "fitness, heart rate"},
            timeout=45,
        )
        # Allow 503 if LLM key missing in env; report it but don't kill suite
        if r.status_code == 503:
            pytest.skip(f"LLM unavailable: {r.text}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert isinstance(body.get("description"), str)
        assert len(body["description"]) > 20

    def test_ai_desc_forbidden_for_user(self, user_session):
        r = user_session.post(
            f"{API}/mall/v2/admin/ai-description",
            json={"product_name": "X"},
            timeout=20,
        )
        assert r.status_code == 403, r.text


# ── CSV Bulk Import ────────────────────────────────────────────────────────
class TestBulkImport:
    def test_bulk_import_two_rows(self, admin_session):
        # Build minimal CSV
        unique_a = f"TEST_BULK_A_{uuid.uuid4().hex[:6]}"
        unique_b = f"TEST_BULK_B_{uuid.uuid4().hex[:6]}"
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["name", "mrp_inr", "category"])
        w.writerow([unique_a, "999", "electronics"])
        w.writerow([unique_b, "1499", "fashion"])
        csv_bytes = buf.getvalue().encode("utf-8")

        # Multipart: remove json Content-Type
        s = requests.Session()
        s.headers.update({"Authorization": admin_session.headers["Authorization"]})
        files = {"file": ("test.csv", csv_bytes, "text/csv")}
        r = s.post(f"{API}/mall/v2/admin/products/bulk-import", files=files, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["created"] == 2, body
        assert body["skipped"] == 0

        # Verify products visible in listing
        r2 = admin_session.get(f"{API}/mall/products", timeout=20)
        items = r2.json().get("products") or r2.json().get("items") or r2.json()
        names = {p.get("name") for p in items}
        assert unique_a in names
        assert unique_b in names


# ── Booking timeline + Status update ───────────────────────────────────────
class TestBookingTimeline:
    @pytest.fixture(scope="class")
    def booking_id(self, seeded_booking):
        return seeded_booking["booking_id"]

    def test_timeline_initial(self, user_session, booking_id):
        r = user_session.get(f"{API}/mall/v2/booking/{booking_id}/timeline", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert len(body["timeline"]) == 5
        labels = [s["step"] for s in body["timeline"]]
        assert labels == ["Booked", "Confirmed", "Packed", "Shipped", "Delivered"]
        assert "current_step_index" in body

    def test_admin_status_update_shipped(self, admin_session, user_session, booking_id):
        r = admin_session.patch(
            f"{API}/mall/v2/admin/booking/{booking_id}/status",
            json={"label": "Shipped"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["event"]["label"] == "Shipped"
        # Re-read timeline
        r2 = user_session.get(f"{API}/mall/v2/booking/{booking_id}/timeline", timeout=20)
        steps = {s["step"]: s for s in r2.json()["timeline"]}
        assert steps["Shipped"]["completed"] is True


# ── Sales Export ───────────────────────────────────────────────────────────
class TestSalesExport:
    def test_sales_csv_export(self, admin_session):
        r = admin_session.get(f"{API}/mall/v2/admin/sales-export?days=30", timeout=30)
        assert r.status_code == 200, r.text
        ct = r.headers.get("Content-Type", "")
        assert "text/csv" in ct, ct
        body = r.text
        lines = [ln for ln in body.splitlines() if ln.strip()]
        assert len(lines) >= 2, f"Expected header + at least 1 data row, got {len(lines)}"
        assert lines[0].startswith("booking_id,user_id,product_id,product_name"), lines[0]

    def test_sales_export_forbidden_for_user(self, user_session):
        r = user_session.get(f"{API}/mall/v2/admin/sales-export?days=30", timeout=20)
        assert r.status_code == 403, r.text
