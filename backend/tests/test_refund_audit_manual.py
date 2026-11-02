import asyncio, os, sys, time
sys.path.insert(0, '/app/backend')
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
import requests
from pymongo import MongoClient

API = open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split()[0]
db = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
U = "TEST_RFA_USER"
TS = "2026-10-01T10:00:00+00:00"

def seed():
    for c in ["redeem_requests", "recharge_transactions", "bill_payment_requests"]:
        db[c].delete_many({"user_id": U})
    db.ledger.delete_many({"user_id": U}); db.prc_ledger.delete_many({"user_id": U})
    db.refund_events.delete_many({"user_id": U})
    db.users.delete_one({"uid": U})
    db.users.insert_one({"uid": U, "name": "Refund Test", "mobile": "9000000001", "prc_balance": 100.0})
    import uuid
    L = lambda ref, t, et, a: db.ledger.insert_one({"txn_id": "TST-" + uuid.uuid4().hex, "user_id": U, "reference": ref, "txn_type": t, "entry_type": et, "amount": a, "created_at": TS})
    db.redeem_requests.insert_one({"request_id": "RFA-1", "user_id": U, "status": "failed", "total_prc_deducted": 1000, "amount_inr": 100, "service_name": "Electricity Bill", "created_at": TS})
    L("RFA-1", "redeem", "debit", 1000)
    db.redeem_requests.insert_one({"request_id": "RFA-2", "user_id": U, "status": "retry_failed", "prc_refunded": False, "total_prc_deducted": 500, "created_at": TS})
    L("RFA-2", "redeem", "debit", 500); L("RFA-2", "refund", "credit", 500); L("RFA-2", "retry_debit", "debit", 500)
    db.recharge_transactions.insert_one({"request_id": "RFA-3", "user_id": U, "status": "failed", "total_prc_deducted": 300, "recharge_type": "mobile", "amount_inr": 30, "created_at": TS})
    db.bill_payment_requests.insert_one({"request_id": "RFA-3", "user_id": U, "status": "failed", "total_prc_deducted": 300, "created_at": TS})
    db.recharge_transactions.insert_one({"request_id": "RFA-4", "user_id": U, "status": "failed", "total_prc_deducted": 0, "prc_refunded": True, "created_at": TS})
    db.recharge_transactions.insert_one({"request_id": "RFA-5", "user_id": U, "status": "failed", "total_prc_deducted": 0, "created_at": TS})
    db.redeem_requests.insert_one({"request_id": "RFA-6", "user_id": U, "status": "failed", "total_prc_deducted": 700, "created_at": TS})
    L("RFA-6", "redeem", "debit", 700); L("RFA-6", "refund", "credit", 700)
    db.redeem_requests.insert_one({"request_id": "BTR-RFA-7", "user_id": U, "status": "cancelled", "service_type": "bank_transfer", "total_prc_deducted": 900, "created_at": TS})
    L("BTR-RFA-7", "bank_transfer", "debit", 900)
    db.prc_ledger.insert_one({"uid": U, "user_id": U, "type": "bank_redeem_refund_cleanup", "amount": 900, "metadata": {"request_id": "BTR-RFA-7"}, "created_at": TS})
    db.redeem_requests.insert_one({"request_id": "BTR-RFA-8", "user_id": U, "status": "failed", "service_type": "bank_transfer", "total_prc_deducted": 800, "created_at": TS})
    L("BTR-RFA-8", "bank_transfer", "debit", 800)
    db.redeem_requests.insert_one({"request_id": "RFA-9", "user_id": U, "status": "failed", "total_prc_deducted": 600, "_migrated_from": "recharge_transactions", "_legacy_minimal": True, "created_at": TS})

tok = requests.post(f"{API}/api/auth/login", json={"identifier": "admin@test.com", "password": "153759"}).json()
H = {"Authorization": f"Bearer {tok.get('token') or tok.get('access_token')}"}

def run(apply):
    r = requests.post(f"{API}/api/admin/refund-audit/run", json={"apply": apply}, headers=H).json()
    rid = r["run_id"]
    for _ in range(120):
        time.sleep(1)
        run = requests.get(f"{API}/api/admin/refund-audit/latest", headers=H).json()["run"]
        if run["status"] != "running":
            return rid, run
    raise SystemExit("timeout")

seed()
rid, run1 = run(False)
print("REPORT", run1["status"], run1["summary"])
items = requests.get(f"{API}/api/admin/refund-audit/items", params={"run_id": rid, "category": "missing"}, headers=H).json()["items"]
mine = sorted((i["request_id"], i["collection"], i["prc_amount"]) for i in items if i["user_id"] == U)
print("MINE", mine)
assert mine == [("RFA-1", "redeem_requests", 1000.0), ("RFA-2", "redeem_requests", 500.0), ("RFA-3", "recharge_transactions", 300.0)], mine
rev = requests.get(f"{API}/api/admin/refund-audit/items", params={"run_id": rid, "category": "review"}, headers=H).json()["items"]
rev_mine = sorted(i["request_id"] for i in rev if i["user_id"] == U)
print("REVIEW", rev_mine)
assert rev_mine == ["BTR-RFA-8"], rev_mine
assert db.users.find_one({"uid": U})["prc_balance"] == 100.0

# concurrent single refunds on RFA-1 → only one succeeds
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(5) as ex:
    rs = list(ex.map(lambda _: requests.post(f"{API}/api/admin/refund-audit/refund-one", json={"collection": "redeem_requests", "request_id": "RFA-1"}, headers=H), range(5)))
codes = [r.status_code for r in rs]; print("CONCURRENT", codes)
assert codes.count(200) == 1
assert db.users.find_one({"uid": U})["prc_balance"] == 1100.0

rid2, run2 = run(True)
print("APPLY", run2["summary"])
bal = db.users.find_one({"uid": U})["prc_balance"]; print("BAL", bal)
assert bal == 1900.0, bal
rid3, run3 = run(True)
bal = db.users.find_one({"uid": U})["prc_balance"]; print("RE-RUN BAL", bal, run3["summary"].get("refunded_now"))
assert bal == 1900.0
cr = list(db.prc_ledger.find({"user_id": U, "entry_type": "credit"}, {"_id": 0, "reference": 1, "amount": 1, "description": 1}))
print("PRC_LEDGER CREDITS", cr)
assert len(cr) == 3
assert db.bill_payment_requests.find_one({"request_id": "RFA-3"})["prc_refunded"] is True
print("ALL PASS")
