# Iteration 306: atomic reserve/release of unified progressive redeem limit
# Covers: service reserve/release (idempotent, floor 0, audit), concurrency,
# POST /api/bank-transfer/request reserve + admin mark-failed / bulk-mark-failed release.
import os
import asyncio
import uuid
import concurrent.futures
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "paras_reward_db"
for line in open("/app/backend/.env"):
    if line.startswith("MONGO_URL="):
        MONGO_URL = line.split("=", 1)[1].strip().strip('"')
    if line.startswith("DB_NAME="):
        DB_NAME = line.split("=", 1)[1].strip().strip('"')

UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
ADMIN_ID = "admin-test-123"
BANK = {"account_holder_name": "TEST User", "account_number": "123456789012", "ifsc_code": "SBIN0001234"}

sdb = MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="module", autouse=True)
def snapshot_restore():
    u = sdb.users.find_one({"uid": UID}, {"_id": 0, "redemption_limit_used_prc": 1, "prc_balance": 1})
    pre_ids = {r["request_id"] for r in sdb.bank_transfer_requests.find({"user_id": UID}, {"request_id": 1})}
    # temporarily hide pending 20% service charge (402 gate) for this user
    sdb.redemption_service_charges.update_many({"user_id": UID, "status": "PENDING"},
                                               {"$set": {"status": "TEST_HOLD_PENDING"}})
    yield
    sdb.redemption_service_charges.update_many({"user_id": UID, "status": "TEST_HOLD_PENDING"},
                                               {"$set": {"status": "PENDING"}})
    sdb.users.update_one({"uid": UID}, {"$set": {
        "redemption_limit_used_prc": u.get("redemption_limit_used_prc", 0),
        "prc_balance": u.get("prc_balance")}})
    new_ids = [r["request_id"] for r in sdb.bank_transfer_requests.find({"user_id": UID}, {"request_id": 1})
               if r["request_id"] not in pre_ids]
    sdb.bank_transfer_requests.delete_many({"request_id": {"$in": new_ids}})
    sdb.redemption_limit_audit.delete_many({"user_id": UID})
    sdb.idempotency_keys.delete_many({"scope": f"bank_transfer:{UID}"})


def _set_used(v):
    sdb.users.update_one({"uid": UID}, {"$set": {"redemption_limit_used_prc": float(v)}})


def _used():
    return float(sdb.users.find_one({"uid": UID})["redemption_limit_used_prc"] or 0)


def _run(coro_fn):
    async def wrapper():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            return await coro_fn(client[DB_NAME])
        finally:
            client.close()
    return asyncio.run(wrapper())


# ---------- Service level ----------
class TestService:
    def test_no_deduct_symbol(self):
        import importlib, sys
        sys.path.insert(0, "/app/backend")
        mod = importlib.import_module("app.services.redemption_limit_service")
        assert not hasattr(mod, "deduct")

    def test_reserve_release_idempotent(self):
        sys_path = __import__("sys").path
        sys_path.insert(0, "/app/backend")
        from app.services import redemption_limit_service as rls
        _set_used(0)

        async def flow(db):
            snap = await rls.get_status(db, UID)
            ok, s2, _ = await rls.reserve(db, UID, 100.0, "TEST_note_a")
            assert ok and s2["used_prc"] == 100.0
            a = await db.redemption_limit_audit.find_one({"note": "TEST_note_a"})
            assert a and a["prc_amount"] == 100.0 and a["released"] is False
            r1 = await rls.release(db, UID, "TEST_note_a")
            r2 = await rls.release(db, UID, "TEST_note_a")
            assert r1 == 100.0 and r2 == 0.0
            neg = await db.redemption_limit_audit.find_one({"note": "release:TEST_note_a"})
            assert neg and neg["prc_amount"] == -100.0
            # exceeding
            ok3, _, reason = await rls.reserve(db, UID, snap["cumulative_cap"] + 10, "TEST_note_big")
            assert not ok3 and "Available PRC LIMIT" in reason
            return snap
        _run(flow)
        assert _used() == 0.0

    def test_release_floor_zero(self):
        import sys; sys.path.insert(0, "/app/backend")
        from app.services import redemption_limit_service as rls
        _set_used(0)

        async def flow(db):
            ok, _, _ = await rls.reserve(db, UID, 50.0, "TEST_note_floor")
            assert ok
            await db.users.update_one({"uid": UID}, {"$set": {"redemption_limit_used_prc": 10.0}})
            return await rls.release(db, UID, "TEST_note_floor")
        assert _run(flow) == 50.0
        assert _used() == 0.0

    def test_concurrent_reserve_not_exceed_cap(self):
        import sys; sys.path.insert(0, "/app/backend")
        from app.services import redemption_limit_service as rls

        async def flow(db):
            snap = await rls.get_status(db, UID)
            cap = snap["cumulative_cap"]
            await db.users.update_one({"uid": UID}, {"$set": {"redemption_limit_used_prc": cap - 2500}})
            res = await asyncio.gather(*[rls.reserve(db, UID, 1000.0, f"TEST_conc_{i}") for i in range(8)])
            u = await db.users.find_one({"uid": UID})
            return cap, sum(1 for r in res if r[0]), float(u["redemption_limit_used_prc"])
        cap, succ, used = _run(flow)
        print(f"cap={cap} successes={succ} used={used}")
        assert succ == 2
        assert used <= cap
        _set_used(0)


# ---------- API level ----------
def _create(amount=100, cid=None):
    return requests.post(f"{BASE_URL}/api/bank-transfer/request", json={
        "user_id": UID, "amount": amount, "bank_details": BANK,
        "client_request_id": cid or str(uuid.uuid4())}, timeout=60)


class TestBankTransferAPI:
    def test_limit_insufficient_400(self):
        status = requests.get(f"{BASE_URL}/api/redemption-limit/status/{UID}", timeout=30)
        cap = sdb.users.find_one({"uid": UID})
        import sys; sys.path.insert(0, "/app/backend")
        from app.services.redemption_limit_service import _cumulative_cap, _days_since
        c = _cumulative_cap(_days_since(cap["redemption_limit_start_date"]))
        _set_used(c - 500)
        r = _create(100)
        print(r.status_code, r.text[:200])
        assert r.status_code == 400
        assert "Available PRC LIMIT = 500 PRC" in r.json().get("detail", "")
        _set_used(0)

    def test_create_then_mark_failed_releases(self):
        _set_used(0)
        r = _create(100)
        print("create", r.status_code, r.text[:300])
        assert r.status_code == 200, r.text
        rid = r.json().get("request_id") or (r.json().get("data") or {}).get("request_id")
        if not rid:
            doc = sdb.bank_transfer_requests.find_one({"user_id": UID, "status": "pending"})
            rid = doc["request_id"]
        assert _used() == 1000.0
        assert sdb.redemption_limit_audit.find_one({"note": f"bank_transfer:{rid}", "released": False})
        f = requests.post(f"{BASE_URL}/api/bank-transfer/admin/mark-failed",
                          json={"request_id": rid, "admin_id": ADMIN_ID, "remark": "TEST reject"}, timeout=30)
        print("fail", f.status_code, f.text[:200])
        assert f.status_code == 200
        assert _used() == 0.0
        assert sdb.redemption_limit_audit.find_one({"note": f"bank_transfer:{rid}"})["released"] is True

    def test_create_then_bulk_fail_releases(self):
        _set_used(0)
        r = _create(200)
        print("create", r.status_code, r.text[:300])
        assert r.status_code == 200, r.text
        doc = sdb.bank_transfer_requests.find_one({"user_id": UID, "status": "pending"})
        rid = doc["request_id"]
        assert _used() == 2000.0
        f = requests.post(f"{BASE_URL}/api/bank-transfer/admin/bulk-mark-failed",
                          json={"request_ids": [rid], "admin_id": ADMIN_ID, "remark": "TEST bulk"}, timeout=30)
        print("bulk", f.status_code, f.text[:200])
        assert f.status_code == 200 and f.json().get("failed_count") == 1
        assert _used() == 0.0

    def test_parallel_api_requests_respect_cap(self):
        import sys; sys.path.insert(0, "/app/backend")
        from app.services.redemption_limit_service import _cumulative_cap, _days_since
        u = sdb.users.find_one({"uid": UID})
        cap = _cumulative_cap(_days_since(u["redemption_limit_start_date"]))
        _set_used(cap - 1500)  # room for only one ₹100 request
        with concurrent.futures.ThreadPoolExecutor(5) as ex:
            results = list(ex.map(lambda _: _create(100), range(5)))
        codes = [x.status_code for x in results]
        print("codes", codes, [x.text[:120] for x in results])
        used = _used()
        print("used", used, "cap", cap)
        assert used <= cap
        assert codes.count(200) <= 1
        # cleanup any created pending
        for d in sdb.bank_transfer_requests.find({"user_id": UID, "status": "pending"}):
            requests.post(f"{BASE_URL}/api/bank-transfer/admin/mark-failed",
                          json={"request_id": d["request_id"], "admin_id": ADMIN_ID, "remark": "TEST cleanup"}, timeout=30)
        assert _used() == cap - 1500
        _set_used(0)
