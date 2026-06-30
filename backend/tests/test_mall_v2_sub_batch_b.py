"""
PARAS MALL v2 - Sub-Batch B backend tests
Covers:
  * GET /api/mall/v2/featured
  * GET /api/mall/v2/mining-preview/{product_id}
  * POST /api/mall/v2/admin/ai-generate-product (admin)
  * POST /api/mall/v2/admin/ai-generate-image  (admin, Gemini Nano Banana)
  * GET /api/mall/v2/admin/pipeline (admin Kanban)
  * PATCH /api/mall/v2/admin/booking/{id}/status (move card)
  * Non-admin RBAC (403 on admin endpoints)
"""
import os
import time
import requests
import pytest

def _load_base_url() -> str:
    env_url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if env_url:
        return env_url.rstrip("/")
    # Fallback: read from /app/frontend/.env (this is the canonical source)
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


BASE_URL = _load_base_url()

USER_MOBILE = "9970100782"
USER_PIN = "997010"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


# ---------- helpers ----------
def _login(identifier: str, pin: str) -> dict:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": identifier, "password": pin},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed for {identifier}: {r.status_code} {r.text[:200]}"
    return r.json()


@pytest.fixture(scope="module")
def user_token():
    data = _login(USER_MOBILE, USER_PIN)
    tok = data.get("access_token") or data.get("token")
    assert tok, "no access_token in user login response"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    data = _login(ADMIN_EMAIL, ADMIN_PIN)
    tok = data.get("access_token") or data.get("token")
    assert tok, "no access_token in admin login response"
    assert (data.get("role") or "").lower() in {"admin", "super_admin", "manager"}, (
        f"expected admin role, got {data.get('role')}"
    )
    return tok


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- 1. Featured / Hero carousel ----------
class TestFeatured:
    def test_featured_returns_products(self):
        r = requests.get(f"{BASE_URL}/api/mall/v2/featured", params={"limit": 6}, timeout=15)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("success") is True
        assert "products" in data and isinstance(data["products"], list)
        # Each product should have product_id + active=True
        for p in data["products"]:
            assert "product_id" in p
            assert p.get("active") is True
        print(f"featured products: {len(data['products'])} source={data.get('source')}")


# ---------- 2. Mining Preview ----------
class TestMiningPreview:
    def test_mining_preview_returns_estimates(self, user_token):
        # pick a real product id from featured
        f = requests.get(f"{BASE_URL}/api/mall/v2/featured", params={"limit": 6}, timeout=10).json()
        if not f.get("products"):
            pytest.skip("no products in DB to preview")
        pid = f["products"][0]["product_id"]

        r = requests.get(
            f"{BASE_URL}/api/mall/v2/mining-preview/{pid}",
            headers=_h(user_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["success"] is True
        assert data["product_id"] == pid
        assert "user_network_cap" in data and isinstance(data["user_network_cap"], int)
        assert "pricing" in data
        for k in ("mrp_inr", "total_inr", "upfront_prc", "total_prc", "remaining_prc"):
            assert k in data["pricing"]
        est = data["estimates"]
        for tier in ("slow", "typical", "fast"):
            assert tier in est
            assert "daily_prc" in est[tier]
            assert "days_to_complete" in est[tier]

    def test_mining_preview_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/mall/v2/mining-preview/nonexistent", timeout=10)
        assert r.status_code in (401, 403), f"expected auth required, got {r.status_code}"


# ---------- 3. Admin AI Generate Product (text) ----------
class TestAdminAIProduct:
    def test_admin_ai_generate_product(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/mall/v2/admin/ai-generate-product",
            json={"prompt": "65 inch 4K Smart TV", "category_hint": "electronics"},
            headers=_h(admin_token),
            timeout=60,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()
        assert data["success"] is True
        draft = data["draft"]
        assert draft["title"]
        assert draft["description"]
        assert draft["category"]
        assert isinstance(draft["keywords"], list)
        print(f"AI draft category={draft['category']} title={draft['title'][:60]}")

    def test_non_admin_blocked_on_ai_product(self, user_token):
        r = requests.post(
            f"{BASE_URL}/api/mall/v2/admin/ai-generate-product",
            json={"prompt": "headphones"},
            headers=_h(user_token),
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text[:200]}"


# ---------- 4. Admin AI Generate Image (Nano Banana) ----------
class TestAdminAIImage:
    def test_admin_ai_generate_image(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/mall/v2/admin/ai-generate-image",
            json={"prompt": "wireless earbuds black"},
            headers=_h(admin_token),
            timeout=90,  # generous - Nano Banana is slow
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        data = r.json()
        assert data["success"] is True
        assert data["image_url"].startswith("/api/static/mall/")
        assert data["size_bytes"] > 1000
        # confirm file written
        fname = data["image_url"].rsplit("/", 1)[-1]
        path = f"/app/backend/static/mall/{fname}"
        assert os.path.exists(path), f"image file not found on disk: {path}"
        # ensure it's also served (HEAD request to URL)
        full = f"{BASE_URL}{data['image_url']}"
        head = requests.get(full, timeout=15)
        assert head.status_code == 200, f"image not served via URL {full} -> {head.status_code}"
        assert head.headers.get("content-type", "").startswith("image/")
        print(f"AI image saved {fname} ({data['size_bytes']} bytes)")

    def test_non_admin_blocked_on_ai_image(self, user_token):
        r = requests.post(
            f"{BASE_URL}/api/mall/v2/admin/ai-generate-image",
            json={"prompt": "smartwatch"},
            headers=_h(user_token),
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text[:200]}"


# ---------- 5. Admin Order Pipeline ----------
class TestAdminPipeline:
    EXPECTED_LABELS = ["Booked", "Confirmed", "Packed", "Shipped", "Delivered"]

    def test_pipeline_structure(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/mall/v2/admin/pipeline",
            headers=_h(admin_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["success"] is True
        assert data["labels"] == self.EXPECTED_LABELS
        # All columns must be present and lists
        for label in self.EXPECTED_LABELS:
            assert label in data["columns"], f"missing column {label}"
            assert isinstance(data["columns"][label], list)
            assert label in data["totals"]
        # totals == lengths
        for label in self.EXPECTED_LABELS:
            assert data["totals"][label] == len(data["columns"][label])
        print(f"pipeline totals: {data['totals']}")

    def test_non_admin_blocked_on_pipeline(self, user_token):
        r = requests.get(
            f"{BASE_URL}/api/mall/v2/admin/pipeline",
            headers=_h(user_token),
            timeout=10,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}"

    def test_advance_booking_status(self, admin_token):
        # find any booking from pipeline
        r = requests.get(
            f"{BASE_URL}/api/mall/v2/admin/pipeline",
            headers=_h(admin_token),
            timeout=20,
        )
        data = r.json()
        # pick a card NOT already in "Packed" so we can advance to Packed
        candidate = None
        source_label = None
        for label in ["Booked", "Confirmed"]:
            if data["columns"][label]:
                candidate = data["columns"][label][0]
                source_label = label
                break
        if not candidate:
            pytest.skip("no bookings available in Booked/Confirmed to advance")

        bid = candidate["booking_id"]
        original_status = candidate.get("latest_status")
        print(f"advancing booking {bid} from {source_label} -> Packed")

        patch = requests.patch(
            f"{BASE_URL}/api/mall/v2/admin/booking/{bid}/status",
            json={"label": "Packed", "note": "sealed (automated test)"},
            headers=_h(admin_token),
            timeout=20,
        )
        assert patch.status_code == 200, f"{patch.status_code} {patch.text[:300]}"
        pdata = patch.json()
        assert pdata["success"] is True
        assert pdata["event"]["label"] == "Packed"

        # re-fetch pipeline and confirm booking now in "Packed"
        time.sleep(0.5)
        r2 = requests.get(
            f"{BASE_URL}/api/mall/v2/admin/pipeline",
            headers=_h(admin_token),
            timeout=20,
        )
        data2 = r2.json()
        ids_in_packed = {c["booking_id"] for c in data2["columns"]["Packed"]}
        assert bid in ids_in_packed, (
            f"booking {bid} not in Packed after PATCH. Packed ids={list(ids_in_packed)[:5]}"
        )

        # Revert (best-effort) so we don't pollute pipeline for follow-up runs
        revert_label = original_status if original_status in self.EXPECTED_LABELS else "Booked"
        requests.patch(
            f"{BASE_URL}/api/mall/v2/admin/booking/{bid}/status",
            json={"label": revert_label, "note": "revert (automated test)"},
            headers=_h(admin_token),
            timeout=20,
        )
