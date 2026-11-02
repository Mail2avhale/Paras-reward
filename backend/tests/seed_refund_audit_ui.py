# Seed / cleanup TEST_ data for refund-audit UI testing. Usage: python seed_refund_audit_ui.py seed|cleanup
import os, sys, uuid, json
from dotenv import load_dotenv
from pymongo import MongoClient
load_dotenv('/app/backend/.env')
db = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
U = "TEST_RFAUI_USER"
TS = "2026-01-05T10:00:00+00:00"
STATE = "/tmp/rfa_ui_state.json"


def cleanup():
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    for c in ["redeem_requests", "recharge_transactions", "bill_payment_requests"]:
        db[c].delete_many({"request_id": {"$regex": "^TEST_UI"}})
    for c in ("ledger", "prc_ledger", "refund_events", "transactions"):
        db[c].delete_many({"$or": [{"user_id": U}, {"reference": {"$regex": "^TEST_UI"}}, {"request_id": {"$regex": "^TEST_UI"}}]})
    db.users.delete_many({"uid": U})
    if st.get("explorer_uid"):
        db.users.update_one({"uid": st["explorer_uid"]}, {"$set": {"prc_balance": st["explorer_bal"]}})
    print("cleaned", st)


def seed():
    cleanup()
    ex = db.users.find_one({"mobile": "9000006864"}, {"_id": 0, "uid": 1, "prc_balance": 1})
    json.dump({"explorer_uid": ex["uid"], "explorer_bal": ex.get("prc_balance", 0)}, open(STATE, "w"))
    db.users.insert_one({"uid": U, "name": "TEST UI Refund", "mobile": "9000000888", "prc_balance": 10.0})
    db.redeem_requests.insert_one({"request_id": "TEST_UI-1", "user_id": U, "user_name": "TEST UI Refund", "status": "failed",
                                   "total_prc_deducted": 1200, "amount_inr": 120, "amount": 120, "service_name": "Electricity Bill",
                                   "service_type": "electricity", "created_at": "2099-01-01T00:00:00+00:00"})
    db.ledger.insert_one({"txn_id": "TEST-" + uuid.uuid4().hex, "user_id": U, "reference": "TEST_UI-1", "txn_type": "redeem",
                          "entry_type": "debit", "amount": 1200, "created_at": TS})
    db.recharge_transactions.insert_one({"request_id": "TEST_UI-2", "user_id": U, "user_name": "TEST UI Refund", "status": "failed",
                                         "total_prc_deducted": 400, "recharge_type": "mobile", "amount_inr": 40, "number": "9000000888",
                                         "created_at": "2099-01-01T00:00:01+00:00"})
    db.recharge_transactions.insert_one({"request_id": "TEST_UI-3", "user_id": U, "user_name": "TEST UI Refund", "status": "refund_pending",
                                         "total_prc_deducted": 120, "recharge_type": "mobile", "amount_inr": 12, "number": "9000000888",
                                         "created_at": "2099-01-01T00:00:02+00:00"})
    # explorer user's recharge history
    now = "2026-01-10T10:00:00+00:00"
    db.recharge_transactions.insert_one({"request_id": "TEST_UIU-1", "user_id": ex["uid"], "status": "failed", "total_prc_deducted": 0,
                                         "prc_refunded": True, "prc_refund_amount": 250, "refund_at": now, "recharge_type": "mobile",
                                         "amount_inr": 25, "number": "9000006864", "operator_name": "Jio", "created_at": "2099-01-02T00:00:00+00:00"})
    db.recharge_transactions.insert_one({"request_id": "TEST_UIU-2", "user_id": ex["uid"], "status": "refund_pending", "total_prc_deducted": 150,
                                         "recharge_type": "mobile", "amount_inr": 15, "number": "9000006864", "operator_name": "Jio",
                                         "created_at": "2099-01-02T00:00:01+00:00"})
    print("seeded", ex["uid"])


if __name__ == "__main__":
    seed() if sys.argv[1] == "seed" else cleanup()
