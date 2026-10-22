# Iter 311: Mobile/DTH recharge — PRC admin charge removed, 20% cash Redemption
# Service Charge raised ONLY on SUCCESS (initiate / admin enquiry / bulk enquiry).
# Eko HTTP is fully mocked; runs in-process against the preview Mongo DB.
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone

import pytest
from dotenv import load_dotenv

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
import routes.eko_recharge as er  # noqa: E402
import routes.redemption_service_charge as rsc  # noqa: E402
import app.services.redemption_limit_service as rls  # noqa: E402

TEST_UID = f"TEST_rch_{uuid.uuid4().hex[:8]}"


# Mirrors server.calculate_redemption_charges (20% admin, ₹10 fee, rate 10)
async def fake_calc(amount_inr, req_type, user_id):
    admin_inr = amount_inr * 20 / 100
    total_inr = amount_inr + 10 + admin_inr
    return {
        "amount_inr": amount_inr, "processing_fee_inr": 10.0,
        "admin_charge_inr": admin_inr, "admin_charge_percent": 20,
        "subtotal_inr": total_inr, "total_inr": total_inr,
        "amount_prc": amount_inr * 10, "processing_fee_prc": 100.0,
        "admin_charge_prc": admin_inr * 10, "total_prc": total_inr * 10,
    }


class FakeResp:
    def __init__(self, payload):
        self._p = payload
        self.status_code = 200

    def json(self):
        return self._p


def make_client(post_payload=None, get_fn=None):
    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, headers=None, json=None):
            return FakeResp(post_payload)

        async def get(self, url, headers=None, params=None):
            return FakeResp(get_fn(url))
    return FakeClient


def run(coro_fn):
    async def wrapper():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        er.set_db(db)
        rsc.set_db(db)
        try:
            return await coro_fn(db)
        finally:
            client.close()
    return asyncio.run(wrapper())


@pytest.fixture(autouse=True)
def patches(monkeypatch):
    monkeypatch.setattr(er, "_eko_configured", lambda: True)

    async def _act():
        return {"success": True}
    monkeypatch.setattr(er, "_ensure_service_activated", _act)

    async def _ok(db, uid, amt, *a):
        return True, {}, ""
    monkeypatch.setattr(rls, "ensure_can_spend", _ok)
    monkeypatch.setattr(rls, "reserve", _ok)

    async def _rel(*a, **k):
        return 0
    monkeypatch.setattr(rls, "release", _rel)
    er.set_recharge_calculate_charges(fake_calc)
    er.set_recharge_redeem_check(None)
    er.set_recharge_log_transaction(None)
    # neutralise side-effects on success
    import routes.community as comm
    import routes.sustainability_burn as sb

    async def _noop(*a, **k):
        return None
    monkeypatch.setattr(comm, "create_success_story_post", _noop, raising=False)
    monkeypatch.setattr(sb, "apply_sustainability_burn", _noop, raising=False)

    _real_sleep = asyncio.sleep

    async def _fast_sleep(*a, **k):
        await _real_sleep(0)
    monkeypatch.setattr(er.asyncio, "sleep", _fast_sleep)
    yield


@pytest.fixture(scope="module", autouse=True)
def test_user():
    async def setup(db):
        await db.users.insert_one({"uid": TEST_UID, "name": "TEST Recharge", "mobile": "9000000001",
                                   "subscription_plan": "vip", "prc_balance": 100000.0})
    run(setup)
    yield
    async def teardown(db):
        await db.users.delete_many({"uid": TEST_UID})
        await db.recharge_transactions.delete_many({"user_id": TEST_UID})
        await db.bill_payment_requests.delete_many({"user_id": TEST_UID})
        ids = [c["charge_id"] async for c in db.redemption_service_charges.find({"user_id": TEST_UID})]
        await db.redemption_service_charges.delete_many({"user_id": TEST_UID})
        await db.redemption_service_charge_audit.delete_many({"charge_id": {"$in": ids}})
        await db.notifications.delete_many({"user_id": TEST_UID})
    run(teardown)


async def _reset(db):
    await db.recharge_transactions.delete_many({"user_id": TEST_UID})
    await db.redemption_service_charges.delete_many({"user_id": TEST_UID})
    await db.users.update_one({"uid": TEST_UID}, {"$set": {"prc_balance": 100000.0}})


def _initiate(monkeypatch, payload, rtype="mobile", number="9876543210"):
    monkeypatch.setattr(er.httpx, "AsyncClient", make_client(post_payload=payload))

    async def go(db):
        await _reset(db)
        res = await er.initiate_recharge(er.RechargeRequest(
            user_id=TEST_UID, recharge_type=rtype, number=number, operator_id="1", amount=199))
        user = await db.users.find_one({"uid": TEST_UID})
        txn = await db.recharge_transactions.find_one({"user_id": TEST_UID}, {"_id": 0})
        charges = await db.redemption_service_charges.find({"user_id": TEST_UID}, {"_id": 0}).to_list(10)
        return res, user, txn, charges
    return run(go)


# --- initiate: success raises exactly one charge; PRC = amount*10 + fee*10 ---
def test_initiate_success_no_admin_prc_and_charge_raised(monkeypatch):
    res, user, txn, charges = _initiate(monkeypatch, {"status": 0, "message": "ok",
                                                       "data": {"tid": "T1", "tx_status": 0}})
    assert res["success"] is True and res["status"] == "success"
    assert res["prc_deducted"] == 2090.0
    assert round(100000.0 - user["prc_balance"], 2) == 2090.0
    assert txn["admin_charge_prc"] == 0 and txn["total_prc_deducted"] == 2090.0
    assert len(charges) == 1
    c = charges[0]
    assert c["redemption_id"] == txn["request_id"]
    assert c["redemption_type"] == "mobile_recharge"
    assert c["prc_amount"] == 1990.0
    assert c["redemption_value_inr"] == 199.0
    assert c["service_charge_amount"] == 39.8 and c["status"] == "PENDING"
    assert c["details"]["number"] == "XXXXXX3210"
    assert c["details"]["recharge_amount_inr"] == 199.0
    print("details:", c["details"])


def test_initiate_dth_success_type(monkeypatch):
    res, _, _, charges = _initiate(monkeypatch, {"status": 0, "data": {"tid": "T2", "tx_status": 0}},
                                   rtype="dth", number="1234567890")
    assert res["status"] == "success"
    assert len(charges) == 1 and charges[0]["redemption_type"] == "dth_recharge"


# --- initiate: pending / failed → NO charge ---
@pytest.mark.parametrize("payload", [
    {"status": 0, "data": {"tid": "T3", "tx_status": 2}},   # response awaited
    {"status": 0, "data": {"tid": "T4", "tx_status": 1}},   # failed
    {"status": 347, "message": "insufficient"},
])
def test_initiate_non_success_no_charge(monkeypatch, payload):
    res, _, _, charges = _initiate(monkeypatch, payload)
    assert res.get("status") != "success"
    assert charges == []


# --- idempotency ---
def test_raise_idempotent():
    async def go(db):
        await _reset(db)
        txn = {"request_id": f"TEST-{uuid.uuid4()}", "user_id": TEST_UID, "recharge_type": "mobile",
               "number": "9876543210", "amount_inr": 199.0, "prc_required": 1990.0, "operator_name": "Jio"}
        await er._raise_recharge_service_charge(txn)
        await er._raise_recharge_service_charge(txn)
        return await db.redemption_service_charges.find({"user_id": TEST_UID}, {"_id": 0}).to_list(10)
    rows = run(go)
    assert len(rows) == 1
    assert rows[0]["details"]["operator"] == "Jio"


async def _insert_pending(db, status="pending"):
    await _reset(db)
    rid = str(uuid.uuid4())
    await db.recharge_transactions.insert_one({
        "request_id": rid, "user_id": TEST_UID, "recharge_type": "mobile", "number": "9876543210",
        "operator_id": "1", "amount_inr": 199.0, "total_prc_deducted": 2090.0, "prc_required": 1990.0,
        "admin_charge_prc": 0, "eko_tid": f"TID{rid[:6]}", "client_ref_id": f"RCHTEST{rid[:6]}",
        "status": status, "created_at": datetime.now(timezone.utc).isoformat()})
    return rid


# --- admin enquiry status-check path ---
@pytest.mark.parametrize("tx,expect", [(0, 1), (1, 0), (2, 0), (4, 0)])
def test_admin_enquiry_path(monkeypatch, tx, expect):
    monkeypatch.setattr(er.httpx, "AsyncClient", make_client(
        get_fn=lambda url: {"status": 0, "data": {"tid": "X", "tx_status": tx}}))

    async def go(db):
        rid = await _insert_pending(db)
        r1 = await er.admin_enquiry_status(rid)
        r2 = await er.admin_enquiry_status(rid)  # repeat — must not duplicate
        rows = await db.redemption_service_charges.find({"user_id": TEST_UID}, {"_id": 0}).to_list(10)
        return r1, r2, rows, rid
    r1, r2, rows, rid = run(go)
    assert r1["success"] is True
    assert len(rows) == expect
    if expect:
        assert rows[0]["redemption_id"] == rid and rows[0]["redemption_type"] == "mobile_recharge"


# --- bulk enquiry path (only our txn reported success; others still pending) ---
@pytest.mark.parametrize("tx,expect", [(0, 1), (1, 0), (3, 0)])
def test_bulk_enquiry_path(monkeypatch, tx, expect):
    holder = {}

    def get_fn(url):
        if holder.get("tid") and holder["tid"] in url:
            return {"status": 0, "data": {"tid": holder["tid"], "tx_status": tx}}
        return {"status": 0, "data": {"tx_status": 2}}
    monkeypatch.setattr(er.httpx, "AsyncClient", make_client(get_fn=get_fn))

    async def go(db):
        rid = await _insert_pending(db)
        holder["tid"] = f"TID{rid[:6]}"
        res = await er.admin_check_all_pending()
        rows = await db.redemption_service_charges.find({"user_id": TEST_UID}, {"_id": 0}).to_list(10)
        return res, rows
    res, rows = run(go)
    assert res["success"] is True
    assert len(rows) == expect
