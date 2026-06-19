"""
PARAS MALL — Comprehensive backend regression tests
====================================================
Covers: product listing, upfront math, book flow (success + insufficient + locked),
collect, session lapse, cascading daily rate, fulfillment, admin delivery,
admin CRUD, admin analytics, community feed + PRC statement side-effects.

Test user: fcd8c6f8-9596-4f56-8556-568847d5ab86 (Suresh, Elite)
"""

import os
import time
import uuid
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
TEST_UID = "fcd8c6f8-9596-4f56-8556-568847d5ab86"
INITIAL_TOP_UP_BALANCE = 500_000  # PRC

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


# -------------- async DB helpers (run via asyncio.run) --------------
def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.new_event_loop().run_until_complete(coro)


async def _db():
    return AsyncIOMotorClient(MONGO_URL)[DB_NAME]


async def _set_user_balance(balance, locked=0):
    db = await _db()
    await db.users.update_one(
        {"uid": TEST_UID},
        {"$set": {"prc_balance": balance, "prc_locked": locked}},
    )


async def _get_user():
    db = await _db()
    return await db.users.find_one({"uid": TEST_UID}, {"_id": 0})


async def _insert_test_booking(position, status="mining", product_id=None, product_name="TESTBK", mrp=10000, paid=10000):
    db = await _db()
    bid = f"TEST_{uuid.uuid4()}"
    total_prc = mrp * 10
    doc = {
        "booking_id": bid,
        "user_id": TEST_UID,
        "product_id": product_id or "test-prod",
        "product_name": product_name,
        "mrp_inr": mrp,
        "total_prc": total_prc,
        "upfront_prc": 10000,
        "paid_prc": paid,
        "remaining_prc": max(0, total_prc - paid),
        "position": position,
        "status": status,
        "session_start": datetime.now(timezone.utc).isoformat(),
        "laps_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.mall_bookings.insert_one(doc)
    return bid


async def _backdate_session(bid, hours):
    db = await _db()
    new_start = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    await db.mall_bookings.update_one({"booking_id": bid}, {"$set": {"session_start": new_start}})


async def _set_booking(bid, fields):
    db = await _db()
    await db.mall_bookings.update_one({"booking_id": bid}, {"$set": fields})


async def _get_booking(bid):
    db = await _db()
    return await db.mall_bookings.find_one({"booking_id": bid}, {"_id": 0})


async def _cleanup():
    db = await _db()
    # Delete all bookings owned by test user
    bookings = await db.mall_bookings.find({"user_id": TEST_UID}, {"booking_id": 1, "_id": 0}).to_list(500)
    bids = [b["booking_id"] for b in bookings]
    if bids:
        await db.mall_bookings.delete_many({"booking_id": {"$in": bids}})
        await db.community_feed.delete_many({"booking_id": {"$in": bids}})
        await db.prc_statement.delete_many({"ref_id": {"$in": bids}})
    # Also delete TEST_ prefixed bookings (in case)
    await db.mall_bookings.delete_many({"booking_id": {"$regex": "^TEST_"}})
    # Delete TEST_ products
    await db.mall_products.delete_many({"name": {"$regex": "^TEST_"}})
    # Reset test user
    await db.users.update_one({"uid": TEST_UID}, {"$set": {"prc_balance": 485000, "prc_locked": 0}})


# -------------- pytest fixtures --------------
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": "admin@test.com", "pin": "153759"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    token = r.json().get("token")
    assert token, "No admin token returned"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def products(client):
    r = client.get(f"{API}/mall/products")
    assert r.status_code == 200, r.text
    data = r.json()
    return {p["name"]: p for p in data["products"]}


@pytest.fixture(scope="module", autouse=True)
def setup_and_teardown():
    asyncio.new_event_loop().run_until_complete(_set_user_balance(INITIAL_TOP_UP_BALANCE, 0))
    yield
    asyncio.new_event_loop().run_until_complete(_cleanup())


# ============== TESTS ==============

# -- Product listing --
class TestProductListing:
    def test_returns_43_products(self, client):
        r = client.get(f"{API}/mall/products")
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["count"] == 43, f"Expected 43, got {data['count']}"
        assert len(data["products"]) == 43

    def test_product_fields(self, products):
        sp = products.get("Smartphone")
        assert sp is not None
        assert sp["mrp_inr"] == 15000
        assert sp["total_prc"] == 150000
        assert sp["upfront_prc"] == 15000  # max(1500, 1000)*10
        assert sp["daily_rate_prc"] == 4
        assert "image_url" in sp
        assert sp["image_url"].startswith("/api/static/mall/")

    def test_static_image_serves(self, client):
        # Smartphone image
        r = client.get(f"{BASE_URL}/api/static/mall/smartphone.png")
        assert r.status_code == 200, f"image fetch failed: {r.status_code}"
        assert r.headers.get("content-type", "").startswith("image/")


# -- Upfront math --
class TestUpfrontMath:
    def test_smartphone(self, products):
        # MRP 15000 -> 10%=1500 > 1000 -> 1500*10 = 15000 PRC
        assert products["Smartphone"]["upfront_prc"] == 15000
        assert products["Smartphone"]["total_prc"] == 150000

    def test_gas_stove(self, products):
        # MRP 6000 -> 10%=600 < 1000 -> 1000*10 = 10000 PRC
        assert products["Gas Stove"]["upfront_prc"] == 10000
        assert products["Gas Stove"]["total_prc"] == 60000

    def test_iron_press(self, products):
        # MRP 2500 -> 10%=250 < 1000 -> 1000*10 = 10000 PRC
        assert products["Iron Press"]["upfront_prc"] == 10000
        assert products["Iron Press"]["total_prc"] == 25000


# -- Book flow happy path --
class TestBookFlow:
    booked_id = None

    def test_book_success(self, client, products):
        asyncio.new_event_loop().run_until_complete(_set_user_balance(500000, 0))
        pid = products["Smartphone"]["product_id"]
        r = client.post(f"{API}/mall/book/{pid}", json={"user_id": TEST_UID})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        b = data["booking"]
        assert b["status"] == "mining"
        assert b["paid_prc"] == 15000
        assert b["upfront_prc"] == 15000
        assert b["total_prc"] == 150000
        assert b["position"] >= 1
        assert b["session_start"] is not None
        TestBookFlow.booked_id = b["booking_id"]

        # Balance debited
        u = asyncio.new_event_loop().run_until_complete(_get_user())
        assert u["prc_balance"] == 500000 - 15000

    def test_prc_statement_debit_created(self, client):
        async def check():
            db = await _db()
            return await db.prc_statement.find_one({"ref_id": TestBookFlow.booked_id, "type": "mall_booking"})
        st = asyncio.new_event_loop().run_until_complete(check())
        assert st is not None
        assert st["direction"] == "debit"
        assert st["amount"] == 15000

    def test_community_feed_booked(self, client):
        async def check():
            db = await _db()
            return await db.community_feed.find_one({"booking_id": TestBookFlow.booked_id, "type": "mall_booked"})
        f = asyncio.new_event_loop().run_until_complete(check())
        assert f is not None
        assert "SURESH" in f["message"].upper() or "Suresh" in f["message"]
        assert "Smartphone" in f["message"]
        assert "booked" in f["message"].lower()


# -- Insufficient balance --
class TestInsufficientBalance:
    def test_insufficient(self, client, products):
        asyncio.new_event_loop().run_until_complete(_set_user_balance(100, 0))
        pid = products["Smartphone"]["product_id"]
        r = client.post(f"{API}/mall/book/{pid}", json={"user_id": TEST_UID})
        assert r.status_code == 400
        assert "Insufficient" in r.text


# -- Locked PRC respected --
class TestLockedRespected:
    def test_locked(self, client, products):
        asyncio.new_event_loop().run_until_complete(_set_user_balance(20000, 10000))
        pid = products["Smartphone"]["product_id"]  # needs 15000
        r = client.post(f"{API}/mall/book/{pid}", json={"user_id": TEST_UID})
        assert r.status_code == 400
        assert "Insufficient" in r.text


# -- Daily rate cascade --
class TestCascade:
    bids = []

    def test_insert_three_and_check_rates(self, client):
        async def setup_and_check():
            db = await _db()
            counter = await db.mall_counters.find_one({"_id": "booking_position"})
            base_pos = (counter or {}).get("value", 0) + 100  # safe high range
            b1 = await _insert_test_booking(base_pos + 1, status="mining")
            b2 = await _insert_test_booking(base_pos + 2, status="mining")
            b3 = await _insert_test_booking(base_pos + 3, status="mining")
            return [b1, b2, b3], base_pos

        bids, base = asyncio.new_event_loop().run_until_complete(setup_and_check())
        TestCascade.bids = bids

        # Position base+1 has 2 below (b2, b3), so rate = 4*(1+2)=12
        r1 = client.get(f"{API}/mall/booking/{bids[0]}").json()
        r2 = client.get(f"{API}/mall/booking/{bids[1]}").json()
        r3 = client.get(f"{API}/mall/booking/{bids[2]}").json()
        assert r1["daily_rate_prc"] == 12, f"pos1 expected 12, got {r1['daily_rate_prc']}"
        assert r2["daily_rate_prc"] == 8, f"pos2 expected 8, got {r2['daily_rate_prc']}"
        assert r3["daily_rate_prc"] == 4, f"pos3 expected 4, got {r3['daily_rate_prc']}"

    def test_fulfilled_does_not_boost(self, client):
        # Mark b3 as fulfilled -> b1 rate should drop to 4*(1+1)=8
        async def fulfill():
            await _set_booking(TestCascade.bids[2], {"status": "fulfilled", "paid_prc": 100000})
        asyncio.new_event_loop().run_until_complete(fulfill())
        r1 = client.get(f"{API}/mall/booking/{TestCascade.bids[0]}").json()
        assert r1["daily_rate_prc"] == 8, f"after fulfill, pos1 expected 8, got {r1['daily_rate_prc']}"


# -- Collect flow --
class TestCollect:
    bid = None

    def test_collect_success(self, client):
        async def setup():
            bid = await _insert_test_booking(99999, status="mining", paid=10000)
            await _backdate_session(bid, hours=1)  # 1 hour elapsed
            return bid
        TestCollect.bid = asyncio.new_event_loop().run_until_complete(setup())
        r = client.post(f"{API}/mall/collect/{TestCollect.bid}", json={"user_id": TEST_UID})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["collected_prc"] > 0
        assert data["new_paid_prc"] > 10000

    def test_collect_nothing_right_after(self, client):
        # Session was just reset on previous collect
        r = client.post(f"{API}/mall/collect/{TestCollect.bid}", json={"user_id": TEST_UID})
        assert r.status_code == 400
        assert "Nothing to collect" in r.text

    def test_prc_statement_for_collect(self):
        async def check():
            db = await _db()
            stmts = await db.prc_statement.find({"ref_id": TestCollect.bid, "type": "mall_booking"}).to_list(10)
            return stmts
        stmts = asyncio.new_event_loop().run_until_complete(check())
        # At least one debit for the collect
        assert len(stmts) >= 1
        assert any("Mining" in s.get("description", "") for s in stmts)


# -- Session lapse --
class TestSessionLapse:
    def test_lapse_25h(self, client):
        async def setup():
            bid = await _insert_test_booking(99998, status="mining", paid=10000)
            await _backdate_session(bid, hours=25)
            return bid
        bid = asyncio.new_event_loop().run_until_complete(setup())
        # Calling my-bookings should lapse + renew
        r = client.get(f"{API}/mall/my-bookings/{TEST_UID}")
        assert r.status_code == 200
        # Verify db updated
        async def check():
            return await _get_booking(bid)
        b = asyncio.new_event_loop().run_until_complete(check())
        assert b["laps_count"] >= 1
        # session restarted: parsed session_start should be recent
        ss = datetime.fromisoformat(b["session_start"].replace("Z", "+00:00"))
        assert (datetime.now(timezone.utc) - ss).total_seconds() < 60


# -- Fulfillment --
class TestFulfillment:
    bid = None

    def test_collect_fulfills(self, client):
        async def setup():
            # paid_prc = 99996, total = 100000, near complete
            bid = await _insert_test_booking(99997, status="mining", mrp=10000, paid=99996)
            await _backdate_session(bid, hours=23)  # accumulate full session
            return bid
        TestFulfillment.bid = asyncio.new_event_loop().run_until_complete(setup())
        r = client.post(f"{API}/mall/collect/{TestFulfillment.bid}", json={"user_id": TEST_UID})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["fulfilled"] is True
        # Verify DB
        b = asyncio.new_event_loop().run_until_complete(_get_booking(TestFulfillment.bid))
        assert b["status"] == "fulfilled"
        assert b["fulfilled_at"] is not None

    def test_community_fulfilled_post(self):
        async def check():
            db = await _db()
            return await db.community_feed.find_one({"booking_id": TestFulfillment.bid, "type": "mall_fulfilled"})
        f = asyncio.new_event_loop().run_until_complete(check())
        assert f is not None


# -- Admin delivery --
class TestAdminDelivery:
    def test_mark_mining_delivered_fails(self, admin_client):
        async def setup():
            return await _insert_test_booking(99995, status="mining")
        bid = asyncio.new_event_loop().run_until_complete(setup())
        r = admin_client.post(f"{API}/admin/mall/bookings/{bid}/mark-delivered")
        assert r.status_code == 400

    def test_mark_fulfilled_delivered(self, admin_client):
        # Use the fulfilled booking from prior test
        bid = TestFulfillment.bid
        r = admin_client.post(f"{API}/admin/mall/bookings/{bid}/mark-delivered")
        assert r.status_code == 200, r.text
        b = asyncio.new_event_loop().run_until_complete(_get_booking(bid))
        assert b["status"] == "delivered"
        assert b["delivered_at"] is not None

        # Community feed
        async def check():
            db = await _db()
            return await db.community_feed.find_one({"booking_id": bid, "type": "mall_delivered"})
        f = asyncio.new_event_loop().run_until_complete(check())
        assert f is not None
        assert "delivered" in f["message"].lower()


# -- Admin CRUD --
class TestAdminCRUD:
    pid = None

    def test_create(self, admin_client):
        r = admin_client.post(f"{API}/admin/mall/products", json={
            "name": "TEST_DummyProduct",
            "mrp_inr": 5000,
            "category": "test"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        TestAdminCRUD.pid = data["product"]["product_id"]

    def test_update(self, admin_client):
        r = admin_client.patch(f"{API}/admin/mall/products/{TestAdminCRUD.pid}", json={"mrp_inr": 7500})
        assert r.status_code == 200
        assert r.json()["product"]["mrp_inr"] == 7500

    def test_delete_blocked_when_active_booking(self, admin_client):
        async def setup():
            return await _insert_test_booking(99994, status="mining", product_id=TestAdminCRUD.pid)
        asyncio.new_event_loop().run_until_complete(setup())
        r = admin_client.delete(f"{API}/admin/mall/products/{TestAdminCRUD.pid}")
        assert r.status_code == 400
        assert "active booking" in r.text.lower()

    def test_delete_success_no_bookings(self, admin_client):
        # cleanup test bookings for this product first
        async def cleanup():
            db = await _db()
            await db.mall_bookings.delete_many({"product_id": TestAdminCRUD.pid})
        asyncio.new_event_loop().run_until_complete(cleanup())
        r = admin_client.delete(f"{API}/admin/mall/products/{TestAdminCRUD.pid}")
        assert r.status_code == 200


# -- Admin listing & analytics --
class TestAdminListAnalytics:
    def test_list_bookings(self, admin_client):
        r = admin_client.get(f"{API}/admin/mall/bookings")
        assert r.status_code == 200
        data = r.json()
        assert "bookings" in data
        for b in data["bookings"][:5]:
            assert "progress_percent" in b

    def test_analytics(self, admin_client):
        r = admin_client.get(f"{API}/admin/mall/analytics")
        assert r.status_code == 200
        data = r.json()
        assert "total_products" in data
        assert "active_products" in data
        assert "status_breakdown" in data

    def test_admin_endpoints_require_auth(self, client):
        # Without bearer token, should be 401
        r = client.get(f"{API}/admin/mall/analytics")
        assert r.status_code == 401
        r = client.get(f"{API}/admin/mall/bookings")
        assert r.status_code == 401
