import os,requests
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
from pymongo import MongoClient
from datetime import datetime, timezone
db=MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
API=open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split()[0]
U="TEST_MONTH_USER"; now=datetime.now(timezone.utc).isoformat()
db.recharge_transactions.delete_many({"user_id":U}); db.redeem_requests.delete_many({"user_id":U})
for rid,a in (("TM-1",349.0),("TM-2",153.0)):
    db.recharge_transactions.insert_one({"request_id":rid,"user_id":U,"amount_inr":a,"status":"success","created_at":now})
    for src in ("recharge_transactions","bill_payment_requests"):
        db.redeem_requests.insert_one({"request_id":rid,"user_id":U,"amount_inr":a,"service_type":"mobile_recharge","status":"success","created_at":now,"_migrated_from":src,"_legacy_request_id":rid})
db.redeem_requests.insert_one({"request_id":"TM-3","user_id":U,"amount_inr":200.0,"service_type":"electricity","status":"completed","created_at":now})
tok=requests.post(f"{API}/api/auth/login",json={"identifier":"admin@test.com","password":"153759"}).json()
H={"Authorization":f"Bearer {tok.get('token') or tok.get('access_token')}"}
r=requests.get(f"{API}/api/recharge/history/{U}",headers=H).json()
print({k:r.get(k) for k in ("monthly_used","monthly_remaining")})
import asyncio,sys
sys.path.insert(0,'/app/backend')
from motor.motor_asyncio import AsyncIOMotorClient
import routes.subscription_redeem_cap as c
c.set_db(AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']])
print("cap used", asyncio.run(c._sum_governed_used_inr(U)))
db.recharge_transactions.delete_many({"user_id":U}); db.redeem_requests.delete_many({"user_id":U})
