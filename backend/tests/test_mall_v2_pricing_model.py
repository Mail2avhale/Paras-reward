"""
PARAS MALL V2 PRICING MODEL regression (Jun 30 2026)
====================================================
Validates the V2 pricing migration where:
  • MRP is ALL-INCLUSIVE (no GST added).
  • Processing fee (10% of MRP) is a SEPARATE entry fee debited from main PRC wallet.
  • Mining target = MRP × 10 PRC (user mines the FULL MRP — no deposit reduction).
  • paid_prc starts at 0, remaining_prc == total_prc on a fresh booking.
  • Cancel: V2 bookings burn = paid_prc (mining accumulation only).
  • Legacy bookings (no pricing_model flag) still burn = paid_prc - upfront_prc.

Endpoints:
  - compute_pricing_breakdown via /api/mall/products/{id} (uses the helper)
  - GET /api/mall/products
  - GET /api/mall/v2/featured  (regression — must include enriched pricing fields)
  - GET /api/mall/v2/mining-preview/{id} (remaining_prc == total_prc)
  - POST /api/mall/book/{id}
  - POST /api/mall/cancel-booking/{id}
"""
import os
import requests
import pytest


def _load_base_url() -> str:
    env_url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if env_url:
        return env_url.rstrip("/")
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

PRC_INR_RATE = 10  # 1 INR = 10 PRC


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
def user_session():
    data = _login(USER_MOBILE, USER_PIN)
    tok = data.get("access_token") or data.get("token")
    uid = (data.get("user") or {}).get("uid") or data.get("uid")
    assert tok and uid, f"missing token/uid in login response: {data}"
    return {"token": tok, "uid": uid}


@pytest.fixture(scope="module")
def admin_token():
    data = _login(ADMIN_EMAIL, ADMIN_PIN)
    tok = data.get("access_token") or data.get("token")
    assert tok, "no token in admin login response"
    return tok


# ---------------------- V2 PRICING BREAKDOWN (via /products/{id}) ----------------------
class TestV2PricingFormula:
    """Validate the V2 compute_pricing_breakdown formula end-to-end via a real product."""

    def test_pricing_breakdown_15000(self, user_session):
        # Find a product (any) and check the formula renders correctly via /products.
        r = requests.get(f"{BASE_URL}/api/mall/products", timeout=20)
        assert r.status_code == 200, r.text[:300]
        products = r.json().get("products", [])
        assert products, "no products"

        for p in products:
            mrp = float(p["mrp_inr"])
            assert p["gst_inr"] == 0.0, f"V2: gst_inr must be 0, got {p['gst_inr']} for mrp={mrp}"
            assert p["gst_percent"] == 0.0
            assert abs(p["processing_inr"] - round(mrp * 0.10, 2)) < 0.01, \
                f"processing must be 10% of MRP for {p['product_id']}"
            assert p["total_inr"] == round(mrp, 2), \
                f"V2 total_inr must == MRP, got {p['total_inr']} != {mrp}"
            assert p["total_prc"] == round(mrp * PRC_INR_RATE), \
                f"total_prc must be MRP*10, got {p['total_prc']} for mrp={mrp}"
            # upfront_prc = processing_inr (in PRC)
            expected_upfront_prc = round(round(mrp * 0.10, 2) * PRC_INR_RATE)
            assert p["upfront_prc"] == expected_upfront_prc, \
                f"upfront_prc must be 10% of MRP in PRC, got {p['upfront_prc']} expected {expected_upfront_prc}"
            assert p.get("model") == "v2_separate_processing", f"model flag missing or wrong on {p['product_id']}"


# ---------------------- V2 FEATURED endpoint must include pricing ----------------------
class TestFeaturedEnrichment:
    def test_featured_includes_pricing_fields(self):
        r = requests.get(f"{BASE_URL}/api/mall/v2/featured?limit=6", timeout=20)
        assert r.status_code == 200, r.text[:300]
        products = r.json().get("products", [])
        assert products, "featured must return at least 1 product"
        assert len(products) <= 6
        for p in products:
            assert "mrp_inr" in p
            mrp = float(p["mrp_inr"])
            # All V2 pricing fields must be present (regression of ₹0 bug)
            for k in ("gst_inr", "processing_inr", "total_inr", "total_prc", "upfront_prc"):
                assert k in p, f"featured product missing {k}"
                assert p[k] is not None, f"featured product {k} is None"
            assert p["gst_inr"] == 0.0
            assert p["total_prc"] == round(mrp * PRC_INR_RATE)
            assert p["upfront_prc"] == round(round(mrp * 0.10, 2) * PRC_INR_RATE)
            assert p["upfront_prc"] > 0, "regression: upfront_prc must not be 0"


# ---------------------- V2 MINING PREVIEW remaining_prc == total_prc ----------------------
class TestMiningPreviewV2:
    def test_remaining_equals_total(self, user_session):
        r = requests.get(f"{BASE_URL}/api/mall/products", timeout=20)
        products = r.json().get("products", [])
        pid = products[0]["product_id"]

        r2 = requests.get(
            f"{BASE_URL}/api/mall/v2/mining-preview/{pid}",
            headers={"Authorization": f"Bearer {user_session['token']}"},
            timeout=20,
        )
        assert r2.status_code == 200, r2.text[:300]
        body = r2.json()
        pricing = body["pricing"]
        # V2: processing fee is separate → user mines full total_prc
        assert pricing["remaining_prc"] == pricing["total_prc"], \
            f"V2: remaining_prc must == total_prc, got remaining={pricing['remaining_prc']} total={pricing['total_prc']}"
        assert pricing["upfront_prc"] > 0


# ---------------------- V2 BOOK + CANCEL roundtrip ----------------------
class TestV2BookAndCancel:
    """Full book → wallet debit → cancel → refund + burned_prc=0 roundtrip."""

    def _find_small_product(self):
        r = requests.get(f"{BASE_URL}/api/mall/products", timeout=20)
        products = r.json().get("products", [])
        # Pick smallest MRP to limit wallet drain
        products = [p for p in products if p.get("active", True)]
        assert products
        products.sort(key=lambda x: float(x["mrp_inr"]))
        return products[0]

    def test_book_then_cancel_v2(self, user_session):
        token = user_session["token"]
        uid = user_session["uid"]
        product = self._find_small_product()
        pid = product["product_id"]
        mrp = float(product["mrp_inr"])
        expected_upfront = round(round(mrp * 0.10, 2) * PRC_INR_RATE)
        expected_total_prc = round(mrp * PRC_INR_RATE)

        # Wallet before — use /users/{uid} (plural) which returns LIVE data
        u_before = requests.get(
            f"{BASE_URL}/api/users/{uid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        if u_before.status_code != 200:
            pytest.skip(f"user endpoint not available: {u_before.status_code}")
        balance_before = float(u_before.json().get("prc_balance", 0))
        if balance_before < expected_upfront:
            pytest.skip(f"insufficient PRC balance to test: have {balance_before}, need {expected_upfront}")

        # Book
        book_payload = {
            "user_id": uid,
            "delivery": {
                "name": "Test User",
                "mobile": "9970100782",
                "address_line": "123 Test Lane",
                "city": "Pune",
                "state": "MH",
                "pin_code": "411001",
                "landmark": "",
            },
        }
        r_book = requests.post(
            f"{BASE_URL}/api/mall/book/{pid}",
            json=book_payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r_book.status_code == 200, f"book failed: {r_book.status_code} {r_book.text[:300]}"
        b = r_book.json()
        booking_id = b.get("booking_id") or (b.get("booking") or {}).get("booking_id")
        assert booking_id, f"no booking_id in response: {b}"

        # Wallet after book — debited at LEAST upfront_prc (1% sustainability burn
        # also fires on user reads, so allow a small headroom on top of upfront).
        u_after_book = requests.get(
            f"{BASE_URL}/api/users/{uid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        ).json()
        balance_after_book = float(u_after_book.get("prc_balance", 0))
        debited = balance_before - balance_after_book
        # Sustainability burn is 1% of balance per read — allow ≤ 2% headroom
        max_extra = max(2000, balance_before * 0.02)
        assert expected_upfront <= debited <= (expected_upfront + max_extra), \
            f"wallet debit must be ≥ {expected_upfront} PRC (upfront) and ≤ {expected_upfront + max_extra} (incl burn), got {debited}"

        # Fetch the booking to verify V2 fields via /api/mall/my-bookings/{uid}
        r_list = requests.get(
            f"{BASE_URL}/api/mall/my-bookings/{uid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert r_list.status_code == 200, r_list.text[:300]
        bookings = r_list.json().get("bookings", [])
        target = next((bk for bk in bookings if bk.get("booking_id") == booking_id), None)
        assert target, "freshly booked booking not found in user's bookings list"
        assert target.get("pricing_model") == "v2_separate_processing", \
            f"V2: pricing_model must be set, got {target.get('pricing_model')}"
        assert int(target.get("paid_prc", -1)) == 0, \
            f"V2: paid_prc must start at 0, got {target.get('paid_prc')}"
        assert int(target.get("remaining_prc", 0)) == expected_total_prc, \
            f"V2: remaining_prc must == total_prc, got {target.get('remaining_prc')} vs {expected_total_prc}"
        assert int(target.get("total_prc", 0)) == expected_total_prc

        # Cancel — refund upfront, burned=0 since paid_prc=0
        r_cancel = requests.post(
            f"{BASE_URL}/api/mall/cancel-booking/{booking_id}",
            json={"user_id": uid},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r_cancel.status_code == 200, f"cancel failed: {r_cancel.status_code} {r_cancel.text[:300]}"
        cancel_body = r_cancel.json()
        # Wallet after cancel — fully refunded
        u_after_cancel = requests.get(
            f"{BASE_URL}/api/users/{uid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        ).json()
        balance_after_cancel = float(u_after_cancel.get("prc_balance", 0))
        # Refund must restore wallet to within burn-headroom of original
        # (we expect approximately balance_before, but 1% sustainability burns
        # during read calls reduce it further).
        deficit = balance_before - balance_after_cancel
        max_burn = max(2000, balance_before * 0.04)  # allow 2x reads with 2% headroom each
        assert -1 <= deficit <= max_burn, \
            f"wallet must be approximately restored: before={balance_before} after_cancel={balance_after_cancel} (deficit {deficit} > headroom {max_burn})"

        # Verify burned_prc=0 on the cancelled booking
        r_list2 = requests.get(
            f"{BASE_URL}/api/mall/my-bookings/{uid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        bookings2 = r_list2.json().get("bookings", [])
        cancelled = next((bk for bk in bookings2 if bk.get("booking_id") == booking_id), None)
        assert cancelled, "cancelled booking missing"
        assert cancelled.get("status") == "cancelled"
        burned = float(cancelled.get("burned_prc", -1))
        assert burned == 0, f"V2: burned_prc must be 0 (paid_prc was 0), got {burned}"
        assert int(cancelled.get("refunded_prc", 0)) == expected_upfront


# ---------------------- LEGACY back-compat: paid_prc - upfront formula ----------------------
class TestLegacyBackCompat:
    """Existing seeded bookings (no pricing_model flag) must still use legacy burn formula.

    This is verified indirectly by checking that the cancel-burn code path
    uses `is_v2 = booking.get("pricing_model") == PRICING_MODEL_VERSION` and
    the legacy formula `burned = max(0, paid_prc - upfront_prc)` otherwise.

    We do NOT cancel an existing seeded legacy booking (destructive), but
    we DO assert the code branches exist by verifying the source.
    """

    def test_legacy_burn_branch_exists_in_source(self):
        with open("/app/backend/routes/paras_mall.py") as fh:
            src = fh.read()
        # Both branches must exist
        assert 'pricing_model") == PRICING_MODEL_VERSION' in src, \
            "Legacy back-compat branch missing — cancel must check pricing_model flag"
        assert "paid_prc if is_v2 else (paid_prc - upfront_prc)" in src, \
            "Legacy burn formula missing — should be (paid_prc - upfront_prc) for legacy bookings"
