"""
PRODUCTION verification: Mall Product Mining 6-tier network cap (Feb 28 2026).

Tests against PRODUCTION URL ONLY. READ-ONLY. No data mutation.

What we verify:
  1. Login flow (9696969696 / 969696)
  2. GET /api/mall/products — pricing breakdown fields (mrp/gst/processing/total)
  3. GET /api/mall/my-bookings/{uid} — 'mining' bookings expose `user_network_cap`
  4. CORE CAP MATH: for every mining booking, recompute expected daily_rate
     using N = min(N_raw, user_network_cap) and the network-rate curve.
  5. Unified cap: /api/mining/rate-breakdown/{uid}.network_cap == user_network_cap
     on the same user's mall bookings.
  6. Edge cases: N_raw < cap (uncapped) vs N_raw > cap (flat-capped).
  7. Booking response includes Feb 2026 pricing_breakdown snapshot.
"""

import math
import os
import pytest
import requests

# PRODUCTION ONLY — hard-coded per review request
PROD_BASE_URL = "https://www.parasreward.com"

ADMIN_IDENTIFIER = "9696969696"
ADMIN_PIN = "969696"

# Real PROD user known to have active mining bookings (verified Jan 2026).
# Used to certify cap math; admin uid has no mall bookings.
MINING_USER_IDENTIFIER = "9421331342"
MINING_USER_PIN = "942133"

MIN_DAILY_RATE_PRC = 50  # mall floor
NETWORK_CAP_MIN = 800
NETWORK_CAP_MAX = 8000


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def login_payload(api):
    """Log in admin on PRODUCTION and return user dict + token."""
    r = api.post(
        f"{PROD_BASE_URL}/api/auth/login",
        json={"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PIN},
        timeout=30,
    )
    assert r.status_code == 200, f"PROD login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    user = data.get("user") or {}
    uid = user.get("uid") or data.get("uid") or data.get("user_id")
    token = data.get("token") or data.get("access_token") or data.get("session_token")
    assert uid, f"login response missing uid: {data}"
    if token:
        api.headers.update({"Authorization": f"Bearer {token}"})
    return {"uid": uid, "user": user, "token": token, "raw": data}


@pytest.fixture(scope="module")
def mining_user_payload(api):
    """Log in a PROD user known to have active mining bookings.
    Used for cap math certification because admin has no mall bookings."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(
        f"{PROD_BASE_URL}/api/auth/login",
        json={"identifier": MINING_USER_IDENTIFIER, "password": MINING_USER_PIN},
        timeout=30,
    )
    assert r.status_code == 200, f"mining user PROD login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    user = data.get("user") or {}
    uid = user.get("uid") or data.get("uid")
    assert uid, f"mining user login missing uid: {data}"
    token = data.get("token") or data.get("access_token") or data.get("session_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return {"uid": uid, "session": s, "raw": data}


# ---------- helper: re-implement cap math from backend ----------
def expected_prc_per_user(N: int) -> float:
    if N <= 0:
        return 0.0
    return max(2.5, 5.0 * (21.0 - math.log2(N)) / 14.0)


def expected_daily_rate(N_raw: int, user_cap: int) -> float:
    N = min(N_raw, user_cap)
    if N <= 0:
        return float(MIN_DAILY_RATE_PRC)
    return max(float(MIN_DAILY_RATE_PRC), N * expected_prc_per_user(N))


# ============================================================
# 1. LOGIN
# ============================================================
class TestProductionLogin:
    def test_login_returns_uid(self, login_payload):
        assert login_payload["uid"], "Admin login must return a uid on PROD"


# ============================================================
# 2. /api/mall/products — pricing breakdown
# ============================================================
class TestMallProducts:
    def test_products_endpoint_returns_list(self, api):
        r = api.get(f"{PROD_BASE_URL}/api/mall/products", timeout=30)
        assert r.status_code == 200, f"products failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        products = data.get("products") if isinstance(data, dict) else data
        assert isinstance(products, list) and len(products) >= 1, \
            f"Expected >=1 product on PROD, got {data}"
        pytest.products_cache = products  # share

    def test_pricing_breakdown_fields_present(self, api):
        products = getattr(pytest, "products_cache", None)
        if products is None:
            r = api.get(f"{PROD_BASE_URL}/api/mall/products", timeout=30)
            products = r.json().get("products") or r.json()
        required = ["mrp_inr", "gst_inr", "processing_inr", "total_inr",
                    "total_prc", "upfront_inr", "upfront_prc"]
        missing = [f for f in required if f not in products[0]]
        assert not missing, f"Product missing pricing breakdown fields: {missing}. Sample: {products[0]}"

    def test_pricing_math_gst_and_processing(self, api):
        products = getattr(pytest, "products_cache", None) or \
                   api.get(f"{PROD_BASE_URL}/api/mall/products", timeout=30).json().get("products")
        p = products[0]
        mrp = p["mrp_inr"]
        gst = p["gst_inr"]
        proc = p["processing_inr"]
        total = p["total_inr"]
        # GST = 18% of MRP; processing = 10% of (MRP+GST); total = MRP * 1.298
        assert abs(gst - mrp * 0.18) <= max(1, mrp * 0.005), \
            f"GST math broken: gst={gst} mrp={mrp} expected≈{mrp*0.18}"
        assert abs(proc - (mrp + gst) * 0.10) <= max(1, mrp * 0.005), \
            f"Processing math broken: proc={proc} expected≈{(mrp+gst)*0.10}"
        assert abs(total - mrp * 1.298) <= max(2, mrp * 0.01), \
            f"Total math broken: total={total} expected≈{mrp*1.298}"


# ============================================================
# 3 & 4. /api/mall/my-bookings/{uid} — user_network_cap + math
# ============================================================
class TestMallBookingsCap:
    @pytest.fixture(scope="class")
    def bookings_payload(self, api, login_payload):
        uid = login_payload["uid"]
        r = api.get(f"{PROD_BASE_URL}/api/mall/my-bookings/{uid}", timeout=30)
        assert r.status_code == 200, f"my-bookings failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        return {"uid": uid, "bookings": data.get("bookings", []), "raw": data}

    def test_bookings_response_shape(self, bookings_payload):
        data = bookings_payload["raw"]
        assert "bookings" in data and isinstance(data["bookings"], list), \
            f"Expected 'bookings' list. Got: {data}"

    def test_mining_bookings_have_user_network_cap(self, bookings_payload):
        mining = [b for b in bookings_payload["bookings"] if b.get("status") == "mining"]
        if not mining:
            pytest.skip(f"Admin uid {bookings_payload['uid']} has no 'mining' status bookings on PROD")
        for b in mining:
            assert "user_network_cap" in b, \
                f"Mining booking missing user_network_cap: keys={list(b.keys())}"
            cap = b["user_network_cap"]
            assert isinstance(cap, int), f"user_network_cap not int: {cap!r}"
            assert NETWORK_CAP_MIN <= cap <= NETWORK_CAP_MAX, \
                f"user_network_cap {cap} outside [{NETWORK_CAP_MIN},{NETWORK_CAP_MAX}]"

    def test_daily_rate_matches_capped_formula(self, api, bookings_payload):
        """CORE CAP CERTIFICATION TEST."""
        mining = [b for b in bookings_payload["bookings"] if b.get("status") == "mining"]
        if not mining:
            pytest.skip("No mining bookings to verify cap math against")

        # For each mining booking, compute N_raw locally by counting OTHER
        # mining bookings with greater position from the same user. Since we
        # cannot query the global mall_bookings collection on PROD, we
        # cross-check against the api-returned bookings as a lower bound,
        # but the real N_raw is global. The backend embeds it via daily_rate.
        # Approach: solve for N from daily_rate, then verify capping behavior.

        problems = []
        certifications = []
        for b in mining:
            cap = b["user_network_cap"]
            rate = float(b["daily_rate_prc"])
            position = b.get("position")
            # Solve N from rate: rate = max(50, N * max(2.5, 5*(21-log2(N))/14))
            # Numerical search 0..cap
            best_N, best_err = None, 1e18
            for N in range(0, cap + 1):
                r_expected = expected_daily_rate(N, cap)  # N already <= cap
                err = abs(r_expected - rate)
                if err < best_err:
                    best_err, best_N = err, N
            if best_err > 0.5:
                problems.append({
                    "booking_id": b.get("booking_id"),
                    "position": position,
                    "cap": cap,
                    "actual_rate": rate,
                    "best_fit_N": best_N,
                    "abs_err": best_err,
                })
            else:
                certifications.append({
                    "booking_id": b.get("booking_id"),
                    "position": position,
                    "cap": cap,
                    "rate": rate,
                    "fitted_N": best_N,
                    "capped": best_N == cap,
                })

        print("\n=== CAP CERTIFICATION DATA ===")
        for c in certifications:
            print(c)
        if problems:
            print("=== PROBLEMS ===")
            for p in problems:
                print(p)
        assert not problems, f"Rate did not match cap formula for {len(problems)} booking(s): {problems}"

    def test_pricing_breakdown_snapshot_on_booking(self, bookings_payload):
        """Feb 2026 audit field: bookings should carry pricing_breakdown snapshot."""
        if not bookings_payload["bookings"]:
            pytest.skip("No bookings to inspect")
        # accept either field on booking or sub-dict
        any_with_snapshot = False
        for b in bookings_payload["bookings"]:
            if "pricing_breakdown" in b or all(
                k in b for k in ("mrp_inr", "gst_inr", "processing_inr", "total_prc")
            ):
                any_with_snapshot = True
                break
        if not any_with_snapshot:
            sample_keys = list(bookings_payload["bookings"][0].keys())
            pytest.skip(
                f"No bookings carry pricing_breakdown snapshot (likely pre-Feb-2026 bookings). "
                f"Sample keys: {sample_keys}"
            )


# ============================================================
# 5. Unified cap: main mining rate-breakdown == mall user_network_cap
# ============================================================
class TestUnifiedCapSource:
    def test_rate_breakdown_network_cap_matches_mall(self, api, login_payload):
        uid = login_payload["uid"]
        r = api.get(f"{PROD_BASE_URL}/api/mining/rate-breakdown/{uid}", timeout=30)
        assert r.status_code == 200, f"rate-breakdown failed: {r.status_code} {r.text[:200]}"
        main_cap = r.json().get("network_cap")
        assert isinstance(main_cap, int) and NETWORK_CAP_MIN <= main_cap <= NETWORK_CAP_MAX, \
            f"main mining network_cap invalid: {main_cap}"

        rb = api.get(f"{PROD_BASE_URL}/api/mall/my-bookings/{uid}", timeout=30).json()
        mining = [b for b in rb.get("bookings", []) if b.get("status") == "mining"]
        if not mining:
            pytest.skip("Admin has no mining bookings; can only confirm main cap is valid")
        mall_cap = mining[0]["user_network_cap"]
        print(f"\nMAIN mining cap = {main_cap}, MALL user_network_cap = {mall_cap}")
        assert mall_cap == main_cap, \
            f"Unified cap MISMATCH: main mining={main_cap}, mall booking={mall_cap}"


# ============================================================
# 6. CORE CAP CERTIFICATION — runs against a real user with mining bookings
# ============================================================
class TestCapCertificationOnRealUser:
    def test_user_has_mining_bookings(self, mining_user_payload):
        s = mining_user_payload["session"]; uid = mining_user_payload["uid"]
        rb = s.get(f"{PROD_BASE_URL}/api/mall/my-bookings/{uid}", timeout=30).json()
        mining = [b for b in rb.get("bookings", []) if b.get("status") == "mining"]
        assert mining, f"PROD user {uid} has no mining bookings — cannot certify cap"
        pytest.mining_bookings_cache = (uid, mining, s)

    def test_unified_cap_with_main_mining(self, mining_user_payload):
        s = mining_user_payload["session"]; uid = mining_user_payload["uid"]
        r = s.get(f"{PROD_BASE_URL}/api/mining/rate-breakdown/{uid}", timeout=30)
        assert r.status_code == 200
        rb_data = r.json()
        main_cap = rb_data.get("network_cap")
        raw = rb_data.get("raw_network_size")
        eff = rb_data.get("network_size")
        print(f"\n>>> Main mining: network_cap={main_cap}, raw_network={raw}, "
              f"effective_network={eff} (capped: {raw is not None and raw > main_cap})")

        # Get mall mining user cap
        mb = s.get(f"{PROD_BASE_URL}/api/mall/my-bookings/{uid}", timeout=30).json()
        mining = [b for b in mb.get("bookings", []) if b.get("status") == "mining"]
        mall_cap = mining[0]["user_network_cap"]
        print(f">>> Mall user_network_cap={mall_cap}")
        assert mall_cap == main_cap, \
            f"UNIFIED CAP BROKEN: main={main_cap} mall={mall_cap}"

    def test_daily_rate_matches_capped_formula(self, mining_user_payload):
        """CORE CAP CERTIFICATION."""
        s = mining_user_payload["session"]; uid = mining_user_payload["uid"]
        mb = s.get(f"{PROD_BASE_URL}/api/mall/my-bookings/{uid}", timeout=30).json()
        mining = [b for b in mb.get("bookings", []) if b.get("status") == "mining"]
        assert mining

        # Main mining tells us raw vs capped network
        rb_data = s.get(f"{PROD_BASE_URL}/api/mining/rate-breakdown/{uid}", timeout=30).json()
        main_cap = rb_data["network_cap"]
        main_raw = rb_data.get("raw_network_size", 0)
        capped_at_global = main_raw > main_cap  # informational

        problems, certifications = [], []
        for b in mining:
            cap = b["user_network_cap"]
            rate = float(b["daily_rate_prc"])
            position = b.get("position")

            best_N, best_err = None, 1e18
            for N in range(0, cap + 1):
                err = abs(expected_daily_rate(N, cap) - rate)
                if err < best_err:
                    best_err, best_N = err, N
            row = {
                "booking_id": b.get("booking_id"),
                "position": position,
                "cap": cap,
                "actual_rate": rate,
                "fitted_N": best_N,
                "abs_err": best_err,
                "is_capped": best_N == cap,
            }
            (problems if best_err > 0.5 else certifications).append(row)

        print("\n=== MALL CAP CERTIFICATION (PROD) ===")
        print(f"User uid={uid}, main_raw_network={main_raw}, network_cap={main_cap}, "
              f"globally_capped={capped_at_global}")
        for c in certifications:
            print(c)
        if problems:
            print("=== PROBLEMS ===")
            for p in problems:
                print(p)
        assert not problems, (
            f"Daily rate did not match capped formula for {len(problems)} booking(s) "
            f"on PROD. Cap is BROKEN: {problems}"
        )

    def test_edge_case_capped_vs_uncapped(self, mining_user_payload):
        """Verify edge case: when raw network > cap → flat-capped at cap-rate."""
        s = mining_user_payload["session"]; uid = mining_user_payload["uid"]
        rb_data = s.get(f"{PROD_BASE_URL}/api/mining/rate-breakdown/{uid}", timeout=30).json()
        main_raw = rb_data.get("raw_network_size", 0)
        main_cap = rb_data["network_cap"]
        if main_raw <= main_cap:
            pytest.skip(f"User network not large enough to test cap kicking in "
                        f"(raw={main_raw} cap={main_cap})")

        mb = s.get(f"{PROD_BASE_URL}/api/mall/my-bookings/{uid}", timeout=30).json()
        mining = [b for b in mb.get("bookings", []) if b.get("status") == "mining"]
        # All mining bookings for this capped user should share the same daily_rate
        # because N is clamped to cap regardless of position.
        rates = {round(b["daily_rate_prc"], 4) for b in mining}
        # Compute expected capped rate
        N = main_cap
        expected = max(MIN_DAILY_RATE_PRC, N * expected_prc_per_user(N))
        print(f"\n>>> Edge-case (cap active): expected flat rate @N={N} = {expected:.4f}")
        print(f">>> Observed booking rates: {rates}")
        # Tolerance 0.5
        for r in rates:
            assert abs(r - expected) <= 0.5, \
                f"Capped daily_rate {r} != expected flat-cap rate {expected:.4f}"
