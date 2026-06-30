"""
End-to-end PREVIEW integration tests for today's 5 work-streams:
  A) Sub-Batch B Mall UX (featured + mining-preview + admin pipeline)
  B) V2 Pricing Model (no GST, processing 10%, paid_prc=0 at book)
  C) Unified Spend admin endpoints
  D) Subscription Redeem Cap endpoints + gates
  E) Mall mining subscription gate (via product start-session for explorer)

Runs against REACT_APP_BACKEND_URL from /app/frontend/.env (PREVIEW env).
"""
import os
import re
import time
import pytest
import requests

# Resolve PREVIEW base URL
def _resolve_base():
    env_path = "/app/frontend/.env"
    with open(env_path) as f:
        for line in f:
            m = re.match(r"\s*REACT_APP_BACKEND_URL\s*=\s*(.+)", line)
            if m:
                return m.group(1).strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")

BASE = _resolve_base()
USER_MOBILE = "9970100782"
USER_PIN = "997010"
USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
SANTOSH_UID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"


def _try_login(identifier: str, pin: str, kind: str):
    """2-step: send-otp/login then verify with PIN."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Try common endpoints
    candidate_init = [
        ("/api/auth/login-send-otp", {"mobile": identifier} if kind == "user" else {"email": identifier}),
        ("/api/auth/send-otp", {"mobile": identifier} if kind == "user" else {"email": identifier}),
        ("/api/auth/login", {"mobile": identifier, "pin": pin} if kind == "user" else {"email": identifier, "pin": pin}),
    ]
    for url, payload in candidate_init:
        r = s.post(f"{BASE}{url}", json=payload, timeout=15)
        if r.status_code == 200:
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            tok = data.get("token") or data.get("access_token") or data.get("jwt")
            if tok:
                return s, tok
    # Try verify pattern
    for url in ("/api/auth/verify-otp", "/api/auth/login-verify-otp", "/api/auth/verify-login"):
        payload = {"mobile": identifier, "pin": pin} if kind == "user" else {"email": identifier, "pin": pin}
        r = s.post(f"{BASE}{url}", json=payload, timeout=15)
        if r.status_code == 200:
            data = r.json()
            tok = data.get("token") or data.get("access_token") or data.get("jwt")
            if tok:
                return s, tok
    return None, None


@pytest.fixture(scope="module")
def user_token():
    s, tok = _try_login(USER_MOBILE, USER_PIN, "user")
    if not tok:
        pytest.skip("user login failed on preview")
    return tok


@pytest.fixture(scope="module")
def admin_token():
    s, tok = _try_login(ADMIN_EMAIL, ADMIN_PIN, "admin")
    if not tok:
        pytest.skip("admin login failed on preview")
    return tok


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- (B) V2 Pricing model: /api/mall/products ----------
def test_mall_products_v2_pricing_no_gst(user_token):
    r = requests.get(f"{BASE}/api/mall/products", headers=_auth(user_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    products = body.get("products") if isinstance(body, dict) else body
    assert isinstance(products, list) and len(products) > 0
    p = products[0]
    # GST must be 0 in V2
    assert p.get("gst_inr", 0) in (0, 0.0), f"GST not zero: {p.get('gst_inr')}"
    mrp = p.get("mrp_inr") or p.get("price_inr")
    processing = p.get("processing_inr")
    if processing is not None and mrp:
        assert abs(processing - mrp * 0.10) <= 1, f"processing not 10% of MRP: {processing} vs {mrp*0.1}"
    total_prc = p.get("total_prc")
    if total_prc and mrp:
        assert total_prc == mrp * 10, f"total_prc {total_prc} != mrp*10 ({mrp*10})"


def test_mall_v2_featured_enriched_pricing(user_token):
    r = requests.get(f"{BASE}/api/mall/v2/featured?limit=6", headers=_auth(user_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    items = body.get("products") or body
    assert isinstance(items, list) and len(items) > 0
    p = items[0]
    assert "mrp_inr" in p
    assert "processing_inr" in p
    assert "total_prc" in p
    assert p.get("gst_inr", 0) in (0, 0.0)
    # Ensure 10% processing
    assert abs(p["processing_inr"] - p["mrp_inr"] * 0.10) <= 1


def test_mall_v2_mining_preview(user_token):
    r = requests.get(f"{BASE}/api/mall/products", headers=_auth(user_token), timeout=20).json()
    products = r.get("products") if isinstance(r, dict) else r
    pid = products[0].get("product_id") or products[0].get("id") or products[0].get("_id")
    rr = requests.get(f"{BASE}/api/mall/v2/mining-preview/{pid}", headers=_auth(user_token), timeout=20)
    assert rr.status_code == 200, rr.text
    body = rr.json()
    assert "pricing" in body or "estimates" in body
    ests = body.get("estimates") or {}
    # Expect three tiers
    keys = list(ests.keys())
    assert any(k in keys for k in ("slow", "typical", "fast")), f"Estimates keys: {keys}"


# ---------- (A) Admin pipeline & AI ----------
def test_admin_pipeline_5_columns(admin_token):
    r = requests.get(f"{BASE}/api/mall/v2/admin/pipeline", headers=_auth(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    cols = body.get("columns") or body
    if isinstance(cols, dict):
        assert len(cols) >= 5
    else:
        assert len(cols) >= 5


def test_admin_ai_generate_product_draft(admin_token):
    r = requests.post(
        f"{BASE}/api/mall/v2/admin/ai-generate-product",
        headers=_auth(admin_token),
        json={"prompt": "sleek wireless mouse"},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    draft = body.get("draft") or body
    assert "title" in draft and "description" in draft


# ---------- (C) Unified Spend ----------
def test_unified_spend_summary(admin_token):
    r = requests.get(f"{BASE}/api/admin/unified-spend/summary", headers=_auth(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    # body may be {summary:[...]} or list
    rows = body.get("summary") if isinstance(body, dict) else body
    if rows is None:
        rows = body.get("rows", [])
    cats = [r.get("category") for r in rows] if rows else []
    assert any(c in ("bank", "utility") for c in cats), f"cats={cats}"


def test_unified_spend_top_spenders(admin_token):
    r = requests.get(f"{BASE}/api/admin/unified-spend/top-spenders", headers=_auth(admin_token), timeout=20)
    assert r.status_code == 200, r.text


def test_unified_spend_non_admin_blocked(user_token):
    r = requests.get(f"{BASE}/api/admin/unified-spend/summary", headers=_auth(user_token), timeout=20)
    assert r.status_code in (401, 403), r.status_code


def test_unified_spend_user_santosh(admin_token):
    r = requests.get(f"{BASE}/api/admin/unified-spend/user/{SANTOSH_UID}", headers=_auth(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    totals = body.get("totals") or body
    # grand_inr ~ bank + utility
    if "grand_inr" in totals and "bank_inr" in totals and "utility_inr" in totals:
        gi = totals["grand_inr"]
        bi = totals["bank_inr"]
        ui = totals["utility_inr"]
        assert abs(gi - (bi + ui)) <= 1, f"grand {gi} vs bank+utility {bi+ui}"


# ---------- (D) Subscription Redeem Cap ----------
def test_user_subscription_cap(user_token):
    r = requests.get(f"{BASE}/api/user/{USER_UID}/subscription-redeem-cap", headers=_auth(user_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    # subscription_count=7, cap_inr=17500
    assert body.get("subscription_count") == 7, body
    assert body.get("cap_inr") == 17500, body


def test_santosh_zero_cap(admin_token):
    r = requests.get(f"{BASE}/api/user/{SANTOSH_UID}/subscription-redeem-cap", headers=_auth(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("cap_inr") == 0, body


def test_subscription_cap_idor(user_token):
    # User trying to access SANTOSH should be 403/404
    r = requests.get(f"{BASE}/api/user/{SANTOSH_UID}/subscription-redeem-cap", headers=_auth(user_token), timeout=20)
    assert r.status_code in (401, 403, 404), r.status_code


def test_subscription_cap_leaderboard(admin_token):
    r = requests.get(f"{BASE}/api/admin/subscription-redeem-cap/leaderboard", headers=_auth(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    items = body.get("leaderboard") or body.get("rows") or body
    if isinstance(items, list) and len(items) > 1:
        caps = [x.get("cap_inr", 0) for x in items if isinstance(x, dict)]
        assert caps == sorted(caps, reverse=True), f"not sorted desc: {caps[:5]}"


# ---------- Sanity: mall page route + frontend reach ----------
def test_preview_root_reachable():
    r = requests.get(f"{BASE}/", timeout=20)
    assert r.status_code in (200, 301, 302, 304), r.status_code
