import asyncio, os, sys, uuid
sys.path.insert(0, '/app/backend')
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import routes.eko_recharge as er
sdb = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
U, RID = "TEST_REV_USER", "TREV-1"
def seed():
    sdb.users.delete_one({"uid": U}); sdb.recharge_transactions.delete_many({"user_id": U}); sdb.ledger.delete_many({"user_id": U}); sdb.prc_ledger.delete_many({"user_id": U}); sdb.refund_events.delete_many({"user_id": U}); sdb.redemption_service_charges.delete_many({"user_id": U})
    sdb.users.insert_one({"uid": U, "name": "Rev", "prc_balance": 0.0})
    sdb.recharge_transactions.insert_one({"request_id": RID, "user_id": U, "status": "success", "eko_tid": "999", "total_prc_deducted": 3090, "recharge_type": "mobile", "amount_inr": 299, "created_at": "2026-11-06T07:14:00+00:00"})
    sdb.ledger.insert_one({"txn_id": "TST-" + uuid.uuid4().hex, "user_id": U, "reference": RID, "entry_type": "debit", "amount": 3090, "txn_type": "recharge"})
    sdb.redemption_service_charges.insert_one({"charge_id": "TREV-SC", "user_id": U, "redemption_id": RID, "status": "PENDING", "total_payable": 70})
class R:
    status_code = 200
    text = "{}"
    def json(self): return {"status": 0, "data": {"tx_status": "4", "tid": "999"}}
class C:
    def __init__(self, *a, **k): pass
    async def __aenter__(self): return self
    async def __aexit__(self, *a): pass
    async def get(self, *a, **k): return R()
async def main():
    seed()
    er.db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    er._eko_configured = lambda: True
    er._generate_headers = lambda ts: {}
    er.httpx.AsyncClient = C
    r1 = await er.admin_enquiry_status(RID); print(r1)
    r2 = await er.admin_enquiry_status(RID); print("second", r2.get("status_changed"), r2.get("prc_auto_refunded"))
    t = sdb.recharge_transactions.find_one({"request_id": RID})
    print("status", t["status"], "refunded", t.get("prc_refunded"), t.get("prc_refund_amount"), "reversed", t.get("reversed_after_success"))
    print("balance", sdb.users.find_one({"uid": U})["prc_balance"], "svc", sdb.redemption_service_charges.find_one({"charge_id": "TREV-SC"})["status"])
    seed(); sdb.users.delete_one({"uid": U}); sdb.recharge_transactions.delete_many({"user_id": U}); sdb.redemption_service_charges.delete_many({"user_id": U})
asyncio.run(main())
