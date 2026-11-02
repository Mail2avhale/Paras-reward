# PRC Refund Audit regression tests: classification, report-only, apply idempotency,
# double-refund guards, cron auth/dedupe, admin list/detail refund_state, receipt refund fields.
import os
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
db = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
U = "TEST_RFAT_USER"
TS = "2026-01-01T10:00:00+00:00"
P = "TEST_RFAT-"
COLLS = ["redeem_requests", "recharge_transactions", "bill_payment_requests"]


def _cleanup():
    for c in COLLS:
        db[c].delete_many({"user_id": U})
    for c in ("ledger", "prc_ledger", "refund_events", "transactions"):
        db[c].delete_many({"user_id": U})
    db.users.delete_many({"uid": U})


def L(ref, t, et, a):
    db.ledger.insert_one({"txn_id": "TEST-" + uuid.uuid4().hex, "user_id": U, "reference": ref,
                          "txn_type": t, "entry_type": et, "amount": a, "created_at": TS})


def bal():
    return db.users.find_one({"uid": U})["prc_balance"]


@pytest.fixture(scope="module", autouse=True)
def seed():
    _cleanup()
    db.users.insert_one({"uid": U, "name": "TEST Refund", "mobile": "9000000777", "prc_balance": 100.0})
    # 1: failed redeem, debit no credit -> missing 1000
    db.redeem_requests.insert_one({"request_id": P + "1", "user_id": U, "status": "failed", "total_prc_deducted": 1000,
                                   "amount_inr": 100, "service_name": "Electricity Bill", "service_type": "electricity", "created_at": TS})
    L(P + "1", "redeem", "debit", 1000)
    # 2: retry_failed debit+refund+retry_debit -> missing 500
    db.redeem_requests.insert_one({"request_id": P + "2", "user_id": U, "status": "retry_failed", "prc_refunded": False,
                                   "total_prc_deducted": 500, "created_at": TS})
    L(P + "2", "redeem", "debit", 500); L(P + "2", "refund", "credit", 500); L(P + "2", "retry_debit", "debit", 500)
    # 3: recharge failed no flag + mirror -> missing 300, mirror skipped
    db.recharge_transactions.insert_one({"request_id": P + "3", "user_id": U, "status": "failed", "total_prc_deducted": 300,
                                         "recharge_type": "mobile", "amount_inr": 30, "created_at": TS})
    db.bill_payment_requests.insert_one({"request_id": P + "3", "user_id": U, "status": "failed", "total_prc_deducted": 300,
                                         "service_type": "mobile_recharge", "created_at": TS})
    # 4: already flagged -> not listed
    db.recharge_transactions.insert_one({"request_id": P + "4", "user_id": U, "status": "failed", "total_prc_deducted": 0,
                                         "prc_refunded": True, "created_at": TS})
    # 5: failed with 0 deducted -> not_deducted
    db.recharge_transactions.insert_one({"request_id": P + "5", "user_id": U, "status": "failed", "total_prc_deducted": 0,
                                         "recharge_type": "mobile", "created_at": TS})
    # 6: debit+credit equal -> refunded
    db.redeem_requests.insert_one({"request_id": P + "6", "user_id": U, "status": "failed", "total_prc_deducted": 700, "created_at": TS})
    L(P + "6", "redeem", "debit", 700); L(P + "6", "refund", "credit", 700)
    # 7: manual-refund target (failed redeem w/o ledger)
    db.redeem_requests.insert_one({"request_id": P + "7", "user_id": U, "status": "pending", "total_prc_deducted": 50, "created_at": "2099-01-01T00:00:00+00:00"})
    # 8: completed redeem -> not_applicable
    db.redeem_requests.insert_one({"request_id": P + "8", "user_id": U, "status": "completed", "total_prc_deducted": 80, "created_at": TS})
    # 11: refund_pending recharge -> eko_refund_pending
    db.recharge_transactions.insert_one({"request_id": P + "11", "user_id": U, "status": "refund_pending", "total_prc_deducted": 120,
                                         "recharge_type": "mobile", "amount_inr": 12, "created_at": TS})
    # 12: stuck pending with datetime created_at (>24h)
    from datetime import datetime, timezone, timedelta
    db.recharge_transactions.insert_one({"request_id": P + "12", "user_id": U, "status": "pending", "total_prc_deducted": 10,
                                         "recharge_type": "mobile", "created_at": datetime.now(timezone.utc) - timedelta(days=3)})
    yield
    _cleanup()


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": "admin@test.com", "password": "153759"})
    j = r.json()
    t = j.get('token') or j.get('access_token')
    if not t:
        pytest.skip(f"admin login failed {r.status_code}")
    return {"Authorization": f"Bearer {t}"}


def run(H, apply):
    for _ in range(60):
        r = requests.post(f"{BASE_URL}/api/admin/refund-audit/run", json={"apply": apply}, headers=H)
        if r.status_code != 409:
            break
        time.sleep(2)
    assert r.status_code == 200, r.text
    rid = r.json()["run_id"]
    for _ in range(180):
        time.sleep(1)
        run_ = requests.get(f"{BASE_URL}/api/admin/refund-audit/latest", headers=H).json()["run"]
        if run_["run_id"] == rid and run_["status"] != "running":
            return rid, run_
    pytest.fail("audit timeout")


STATE = {}


# Admin auth on audit routes
def test_audit_requires_admin():
    r = requests.get(f"{BASE_URL}/api/admin/refund-audit/latest")
    assert r.status_code in (401, 403)


# Report-only scan + classification
def test_report_only_classification(H):
    rid, r = run(H, False)
    STATE["rid"] = rid
    assert r["status"] == "done", r
    for k in ("missing", "missing_prc", "already_refunded", "review", "refund_pending", "stuck_checked", "not_deducted"):
        assert k in r["summary"]
    items = requests.get(f"{BASE_URL}/api/admin/refund-audit/items", params={"run_id": rid, "category": "missing", "limit": 200}, headers=H).json()
    mine = sorted((i["request_id"], i["collection"], i["prc_amount"]) for i in items["items"] if i["user_id"] == U)
    assert mine == [(P + "1", "redeem_requests", 1000.0), (P + "2", "redeem_requests", 500.0),
                    (P + "3", "recharge_transactions", 300.0)], mine
    assert bal() == 100.0
    rv = requests.get(f"{BASE_URL}/api/admin/refund-audit/items", params={"run_id": rid, "category": "review"}, headers=H).json()
    assert not [i for i in rv["items"] if i["user_id"] == U]


# Admin list refund_state badges
def test_bbps_list_refund_state(H):
    r = requests.get(f"{BASE_URL}/api/redeem/admin/bbps-requests", params={"search": "TEST_RFAT", "limit": 50}, headers=H)
    assert r.status_code == 200
    rows = {x["request_id"]: x for x in r.json()["requests"]}
    print({k: (v.get("refund_state"), v.get("source_collection"), v.get("status")) for k, v in rows.items()})
    assert rows[P + "1"]["refund_state"] == "missing" and rows[P + "1"]["refund_state_prc"] == 1000
    assert rows[P + "6"]["refund_state"] == "refunded"
    assert rows[P + "3"]["refund_state"] == "missing"
    assert "source_collection" in rows[P + "1"]
    if P + "5" in rows:
        assert rows[P + "5"]["refund_state"] == "not_deducted"


# Detail refund_info
def test_bbps_detail_refund_info(H):
    d = requests.get(f"{BASE_URL}/api/redeem/admin/bbps-request/{P}1", headers=H).json()
    ri = d["refund_info"]
    assert ri["state"] == "missing" and ri["refunded"] is False and ri["ledger_debits"] == 1000
    d3 = requests.get(f"{BASE_URL}/api/redeem/admin/bbps-request/{P}3", headers=H).json()
    assert d3["refund_info"]["state"] == "missing"
    assert d3["refund_info"]["amount"] == 300
    d8 = requests.get(f"{BASE_URL}/api/redeem/admin/bbps-request/{P}8", headers=H).json()
    assert d8["refund_info"]["state"] == "not_applicable"


# Concurrent refund-one -> single success
def test_concurrent_refund_one(H):
    with ThreadPoolExecutor(5) as ex:
        rs = list(ex.map(lambda _: requests.post(f"{BASE_URL}/api/admin/refund-audit/refund-one",
                                                 json={"collection": "redeem_requests", "request_id": P + "1"}, headers=H), range(5)))
    codes = [r.status_code for r in rs]
    print(codes, [r.text[:80] for r in rs])
    assert codes.count(200) == 1 and codes.count(400) == 4
    assert bal() == 1100.0
    d = requests.get(f"{BASE_URL}/api/redeem/admin/bbps-request/{P}1", headers=H).json()
    assert d["refund_info"]["state"] == "refunded" and d["refund_info"]["refunded"] is True


# refund-one validation
def test_refund_one_invalid(H):
    r = requests.post(f"{BASE_URL}/api/admin/refund-audit/refund-one", json={"collection": "users", "request_id": "x"}, headers=H)
    assert r.status_code == 400
    r = requests.post(f"{BASE_URL}/api/admin/refund-audit/refund-one", json={"collection": "redeem_requests", "request_id": "TEST_nope"}, headers=H)
    assert r.status_code == 404
    r = requests.post(f"{BASE_URL}/api/admin/refund-audit/refund-one", json={"collection": "redeem_requests", "request_id": P + "8"}, headers=H)
    assert r.status_code == 400
    r = requests.post(f"{BASE_URL}/api/admin/refund-audit/refund-one", json={"collection": "redeem_requests", "request_id": P + "6"}, headers=H)
    assert r.status_code == 400


# Apply refunds missing once; rerun idempotent; ledger rows
def test_apply_and_rerun(H):
    _, r2 = run(H, True)
    assert r2["status"] == "done"
    assert bal() == 1900.0, bal()
    _, r3 = run(H, True)
    assert bal() == 1900.0
    cr = list(db.prc_ledger.find({"user_id": U, "entry_type": "credit"}, {"_id": 0}))
    assert sorted(c["reference"] for c in cr) == [P + "1", P + "2", P + "3"], cr
    lc = list(db.ledger.find({"user_id": U, "entry_type": "credit", "reference": {"$in": [P + "1", P + "2", P + "3"]}}, {"_id": 0}))
    print([(c["reference"], c.get("txn_type"), c["amount"]) for c in lc])
    assert len(lc) >= 3
    assert all(c.get("txn_type") == "refund" for c in lc)
    assert db.bill_payment_requests.find_one({"request_id": P + "3"})["prc_refunded"] is True


# Receipt exposes refund fields
def test_receipt_refund_fields():
    r = requests.get(f"{BASE_URL}/api/recharge/receipt/{P}3", params={"user_id": U}).json()
    rc = r.get("receipt") or r.get("data") or r
    assert rc.get("prc_refund_amount") == 300
    assert rc.get("refund_at")


# Manual refund idempotent
def test_manual_refund_twice(H):
    db.redeem_requests.update_one({"request_id": P + "7"}, {"$set": {"status": "failed"}})
    u = f"{BASE_URL}/api/redeem/admin/manual-refund/{P}7?admin_id=admin&reason=x"
    a = requests.post(u, headers=H).json()
    b = requests.post(u, headers=H).json()
    print(a, b)
    assert a["success"] is True
    assert b["success"] is False and "already refunded" in b["message"].lower()
    assert bal() == 1950.0


# Recharge admin refund idempotent
def test_recharge_admin_refund_twice(H):
    db.recharge_transactions.insert_one({"request_id": P + "9", "user_id": U, "status": "failed", "total_prc_deducted": 40,
                                         "recharge_type": "mobile", "amount_inr": 4, "created_at": "2099-01-01T00:00:00+00:00"})
    a = requests.post(f"{BASE_URL}/api/recharge/admin/refund/{P}9", json={"admin_note": "t"}, headers=H).json()
    b = requests.post(f"{BASE_URL}/api/recharge/admin/refund/{P}9", json={"admin_note": "t"}, headers=H).json()
    print(a, b)
    assert a.get("success") is True
    assert b.get("success") is False
    assert bal() == 1990.0


# Security probe: refund endpoints outside /api/admin without auth
def test_unauth_refund_endpoints_probe():
    db.recharge_transactions.insert_one({"request_id": P + "10", "user_id": U, "status": "failed", "total_prc_deducted": 5,
                                         "recharge_type": "mobile", "created_at": "2099-01-01T00:00:00+00:00"})
    r = requests.post(f"{BASE_URL}/api/recharge/admin/refund/{P}10", json={})
    r2 = requests.get(f"{BASE_URL}/api/redeem/admin/bbps-requests", params={"limit": 1})
    print("unauth recharge refund:", r.status_code, r.text[:120], "| unauth list:", r2.status_code)
    STATE["unauth"] = (r.status_code, r.text[:120], r2.status_code)
    assert r.status_code in (401, 403), f"UNAUTH refund allowed: {r.status_code} {r.text[:120]}"
    assert r2.status_code == 401
    for path in ("/api/redeem/admin/bbps-request/" + P + "1", "/api/bbps/admin/anything"):
        assert requests.get(f"{BASE_URL}{path}").status_code == 401, path
    assert requests.post(f"{BASE_URL}/api/redeem/admin/manual-refund/{P}10?admin_id=x&reason=y").status_code == 401
    assert db.recharge_transactions.find_one({"request_id": P + "10"}).get("prc_refunded") is not True


# Fix 2: refund_pending -> eko_refund_pending in list + detail
def test_refund_pending_state(H):
    rows = {x["request_id"]: x for x in requests.get(f"{BASE_URL}/api/redeem/admin/bbps-requests",
            params={"search": "TEST_RFAT", "limit": 50}, headers=H).json()["requests"]}
    print("P11 row:", {k: rows.get(P + "11", {}).get(k) for k in ("refund_state", "refund_state_prc", "status")})
    assert rows[P + "11"]["refund_state"] == "eko_refund_pending"
    d = requests.get(f"{BASE_URL}/api/redeem/admin/bbps-request/{P}11", headers=H).json()
    assert d["refund_info"]["state"] == "eko_refund_pending", d["refund_info"]


# Fix 4: stuck query handles datetime created_at
def test_stuck_datetime_checked():
    d = db.recharge_transactions.find_one({"request_id": P + "12"})
    assert d["status"] == "pending"  # Eko not configured -> unknown, stays pending
    run_ = db.refund_audit_runs.find_one({"_id": STATE["rid"]})
    assert run_["summary"]["stuck_checked"] >= 1, run_["summary"]


# Fix 3: atomic start_run
def test_concurrent_start_run(H):
    for _ in range(120):
        if not db.refund_audit_runs.find_one({"status": "running"}):
            break
        time.sleep(1)
    with ThreadPoolExecutor(5) as ex:
        rs = list(ex.map(lambda _: requests.post(f"{BASE_URL}/api/admin/refund-audit/run", json={"apply": False}, headers=H), range(5)))
    codes = [r.status_code for r in rs]
    print("concurrent run codes", codes)
    assert codes.count(200) == 1 and codes.count(409) == 4, codes
    for _ in range(180):
        time.sleep(1)
        if not db.refund_audit_runs.find_one({"status": "running"}):
            break
    rid, r = run(H, False)
    assert r["status"] == "done"


# Fix 5: receipt total_prc_deducted fallback after recharge admin refund
def test_receipt_deducted_fallback():
    r = requests.get(f"{BASE_URL}/api/recharge/receipt/{P}9", params={"user_id": U}).json()
    rc = r.get("receipt") or r.get("data") or r
    print("receipt P9:", rc.get("total_prc_deducted"), rc.get("prc_refund_amount"))
    assert rc.get("total_prc_deducted") == 40 and rc.get("prc_refund_amount") == 40


# Cron auth + dedupe
def test_cron():
    r = requests.post(f"{BASE_URL}/api/cron/refund-audit", json={})
    assert r.status_code == 401
    r = requests.post(f"{BASE_URL}/api/cron/refund-audit", json={}, headers={"Authorization": "Bearer wrong"})
    assert r.status_code == 401
    sec = os.environ["WEBHOOK_CRON_SECRET"]
    wid = "TEST-" + uuid.uuid4().hex
    h = {"Authorization": f"Bearer {sec}", "X-Webhook-Id": wid}
    a = requests.post(f"{BASE_URL}/api/cron/refund-audit", json={}, headers=h)
    assert a.status_code == 200 and a.json()["accepted"] is True
    b = requests.post(f"{BASE_URL}/api/cron/refund-audit", json={}, headers=h)
    assert b.status_code == 200 and b.json().get("duplicate") is True
    db.cron_runs.delete_one({"_id": f"refund-audit:{wid}"})
    # wait for cron run to finish so other tests/runs aren't blocked
    for _ in range(120):
        if not db.refund_audit_runs.find_one({"status": "running"}):
            break
        time.sleep(1)
