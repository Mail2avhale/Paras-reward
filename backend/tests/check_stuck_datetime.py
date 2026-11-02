# Verifies the refund audit stuck query picks up a datetime-typed created_at (>24h) pending doc
import os, time
from datetime import datetime, timezone, timedelta
import requests
from dotenv import load_dotenv
from pymongo import MongoClient
load_dotenv('/app/backend/.env'); load_dotenv('/app/frontend/.env')
B = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
db = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
t = requests.post(f"{B}/api/auth/login", json={"identifier": "admin@test.com", "password": "153759"}).json()
H = {"Authorization": f"Bearer {t.get('token') or t.get('access_token')}"}


def go():
    rid = requests.post(f"{B}/api/admin/refund-audit/run", json={"apply": False}, headers=H).json()["run_id"]
    for _ in range(120):
        time.sleep(1)
        r = db.refund_audit_runs.find_one({"_id": rid})
        if r["status"] != "running":
            return r["summary"]["stuck_checked"]


base = go()
db.recharge_transactions.insert_one({"request_id": "TEST_STUCKDT", "user_id": "TEST_STUCKDT_U", "status": "pending",
                                     "total_prc_deducted": 5, "created_at": datetime.now(timezone.utc) - timedelta(days=3)})
try:
    after = go()
    print("base", base, "after", after, "PASS" if after == base + 1 else "FAIL")
finally:
    db.recharge_transactions.delete_many({"request_id": "TEST_STUCKDT"})
