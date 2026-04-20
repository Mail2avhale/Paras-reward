"""Tests for /api/public/live-transactions endpoint."""
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
ENDPOINT = f"{BASE_URL}/api/public/live-transactions"

VALID_SERVICES = {"Mobile Recharge", "Mobile Postpaid", "DTH Recharge", "Bank Redeem"}
VALID_ICONS = {"mobile", "dth", "bank", "crown"}
MASK_RE = re.compile(r"^([0-9X]{2})\*{6}([0-9X]{2})$")


@pytest.fixture(scope="module")
def ticker_response():
    r = requests.get(ENDPOINT, timeout=10)
    assert r.status_code == 200, f"Status {r.status_code}: {r.text[:200]}"
    return r.json()


def test_response_structure(ticker_response):
    assert ticker_response.get("success") is True
    assert "count" in ticker_response
    assert "items" in ticker_response
    assert isinstance(ticker_response["items"], list)
    assert ticker_response["count"] == len(ticker_response["items"])


def test_items_max_50(ticker_response):
    assert len(ticker_response["items"]) <= 50


def test_each_item_has_required_fields(ticker_response):
    items = ticker_response["items"]
    if not items:
        pytest.skip("No items in DB to validate")
    required = {"mobile", "service", "icon", "amount", "created_at"}
    for it in items:
        missing = required - set(it.keys())
        assert not missing, f"Missing fields {missing} in {it}"


def test_no_pii_leak(ticker_response):
    """Privacy: uid, user_name, email, raw mobile must not appear in response."""
    forbidden = {"uid", "user_id", "user_name", "name", "email"}
    for it in ticker_response["items"]:
        leaked = forbidden & set(it.keys())
        assert not leaked, f"PII leak: {leaked} in {it}"


def test_mobile_masking_format(ticker_response):
    """Mask format: digits-only, first 2 + ****** + last 2 (or XX******XX)."""
    for it in ticker_response["items"]:
        m = it.get("mobile", "")
        assert MASK_RE.match(m), f"Invalid mask: '{m}' in {it}"


def test_service_values(ticker_response):
    for it in ticker_response["items"]:
        svc = it.get("service", "")
        # Allow Mobile Recharge/Postpaid/DTH/Bank Redeem/<Plan> Subscription
        ok = svc in VALID_SERVICES or svc.endswith("Subscription") or "Recharge" in svc
        assert ok, f"Unexpected service '{svc}'"


def test_icon_values(ticker_response):
    for it in ticker_response["items"]:
        assert it.get("icon") in VALID_ICONS, f"Bad icon: {it.get('icon')}"


def test_amount_is_number(ticker_response):
    for it in ticker_response["items"]:
        assert isinstance(it.get("amount"), (int, float)), f"amount not numeric: {it}"


def test_sorted_desc_by_created_at(ticker_response):
    items = ticker_response["items"]
    if len(items) < 2:
        pytest.skip("Not enough items to verify sorting")
    timestamps = [i.get("created_at", "") for i in items]
    assert timestamps == sorted(timestamps, reverse=True), "Items not sorted DESC"


def test_city_field_present(ticker_response):
    for it in ticker_response["items"]:
        assert "city" in it, f"Missing city field in {it}"
        assert isinstance(it["city"], str)


def test_cache_consistency_within_30s(ticker_response):
    """Two calls within 30s should return identical payload (cache TTL ~30s)."""
    r1 = requests.get(ENDPOINT, timeout=10).json()
    time.sleep(2)
    r2 = requests.get(ENDPOINT, timeout=10).json()
    assert r1 == r2, "Cache inconsistency within 30s window"


def test_no_mongo_objectid_leak(ticker_response):
    for it in ticker_response["items"]:
        assert "_id" not in it, f"MongoDB _id leaked: {it}"
