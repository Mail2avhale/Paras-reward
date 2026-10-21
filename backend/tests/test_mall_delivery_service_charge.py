# Paras Mall delivery-time 20% MRP redemption service charge (iteration 310)
import os
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
load_dotenv('/app/backend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
USER_ID = "76b75808-47fa-48dd-ad7c-8074678e3607"
BOOKING_ID = "2f15a109-39b5-4b82-89bb-8198f684eed5"  # Iron Press, MRP 2500, status mining
RID = f"MALLDLV-{BOOKING_ID}"


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _db():
    return AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]


async def _snapshot():
    db = _db()
    b = await db.mall_bookings.find_one({"booking_id": BOOKING_ID}, {"_id": 0})
    feed = [d["_id"] async for d in db.community_feed.find({}, {"_id": 1})]
    posts = [d["_id"] async for d in db.community_posts.find({}, {"_id": 1})]
    return b, set(feed), set(posts)


async def _restore(b, feed, posts):
    db = _db()
    await db.mall_bookings.update_one({"booking_id": BOOKING_ID},
                                      {"$set": {"status": b["status"], "delivered_at": b.get("delivered_at")}})
    ch = await db.redemption_service_charges.find_one({"redemption_id": RID})
    if ch:
        await db.notifications.delete_many({"charge_id": ch["charge_id"]})
        await db.service_charge_audit.delete_many({"charge_id": ch["charge_id"]})
    await db.redemption_service_charges.delete_many({"redemption_id": RID})
    await db.community_feed.delete_many({"_id": {"$nin": list(feed)}})
    await db.community_posts.delete_many({"_id": {"$nin": list(posts)}})


async def _set_fulfilled():
    await _db().mall_bookings.update_one({"booking_id": BOOKING_ID}, {"$set": {"status": "fulfilled"}})


async def _get_charge():
    return await _db().redemption_service_charges.find_one({"redemption_id": RID}, {"_id": 0})


async def _count(rid):
    return await _db().redemption_service_charges.count_documents({"redemption_id": rid})


async def _notif(cid):
    return await _db().notifications.find_one({"charge_id": cid}, {"_id": 0})


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": "admin@test.com", "password": "153759"}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def delivered(admin_headers):
    snap = run(_snapshot())
    assert snap[0] and snap[0]["status"] == "mining"
    assert run(_count(RID)) == 0
    run(_set_fulfilled())
    r = requests.post(f"{BASE_URL}/api/admin/mall/bookings/{BOOKING_ID}/mark-delivered", headers=admin_headers, timeout=30)
    yield r
    run(_restore(*snap))
    assert run(_count(RID)) == 0


class TestMallDeliveryCharge:
    def test_unauth_rejected(self):
        r = requests.post(f"{BASE_URL}/api/admin/mall/bookings/{BOOKING_ID}/mark-delivered", timeout=15)
        assert r.status_code in (401, 403)

    def test_non_fulfilled_rejected(self, admin_headers):
        # booking currently mining -> 400 (run before 'delivered' fixture)
        r = requests.post(f"{BASE_URL}/api/admin/mall/bookings/{BOOKING_ID}/mark-delivered", headers=admin_headers, timeout=15)
        assert r.status_code == 400
        assert run(_count(RID)) == 0

    def test_mark_delivered_response(self, delivered):
        assert delivered.status_code == 200, delivered.text
        d = delivered.json()
        assert d["success"] is True
        sc = d["service_charge"]
        assert sc and sc["charge_id"].startswith("SVC-")
        assert sc["service_charge_amount"] == 500.0
        assert sc["status"] == "PENDING"

    def test_charge_row_persisted(self, delivered):
        c = run(_get_charge())
        assert c["user_id"] == USER_ID
        assert c["redemption_type"] == "paras_mall_delivery"
        assert c["charge_basis"] == "mrp"
        assert c["prc_amount"] == 0
        assert c["redemption_value_inr"] == 2500
        assert c["service_charge_percentage"] == 20
        assert c["service_charge_amount"] == 500.0
        assert c["total_payable"] == 500.0
        assert c["status"] == "PENDING"
        assert c["details"] == {"product_name": "Iron Press", "mrp_inr": 2500.0, "booking_id": BOOKING_ID, "stage": "delivery"}

    def test_notification_created(self, delivered):
        c = run(_get_charge())
        n = run(_notif(c["charge_id"]))
        assert n and n["action_url"] == "/my-service-charges"
        assert "MRP" in n["message"] and "2500" in n["message"] and "500" in n["message"]

    def test_second_call_400_no_dup(self, delivered, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/mall/bookings/{BOOKING_ID}/mark-delivered", headers=admin_headers, timeout=15)
        assert r.status_code == 400
        assert run(_count(RID)) == 1

    def test_pending_blocks(self, delivered):
        r = requests.get(f"{BASE_URL}/api/redemption-service-charge/pending/{USER_ID}", timeout=15)
        assert r.status_code == 200 and r.json()["has_pending"] is True

    def test_history_has_details(self, delivered):
        r = requests.get(f"{BASE_URL}/api/redemption-service-charge/history/{USER_ID}", timeout=15)
        assert r.status_code == 200
        rows = [x for x in r.json()["charges"] if x["redemption_id"] == RID]
        assert len(rows) == 1
        assert rows[0]["details"]["product_name"] == "Iron Press"
        assert "_id" not in rows[0]
        assert r.json()["totals"]["pending"] >= 500
