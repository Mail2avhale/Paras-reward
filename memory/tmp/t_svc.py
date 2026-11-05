import os,requests
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
from pymongo import MongoClient
db=MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
API=open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split()[0]
U="TEST_SVC_USER"
db.redemption_service_charges.delete_many({"user_id":U})
def mk(cid, att, last):
    db.redemption_service_charges.insert_one({"charge_id":cid,"user_id":U,"status":"PENDING","total_payable":235.76,"payment_attempts":att,"redemption_id":"R-"+cid,"created_at":"2026-09-15T00:00:00+00:00","updated_at":last,"last_order_at":last,"payment_order_id":"order_old_bulk","payment_order_type":"bulk","bulk_pay_receipt":"BULK-x"})
mk("TSVC-1",5,"2026-11-03T00:00:00+00:00"); mk("TSVC-2",5,"2026-11-03T00:00:00+00:00")
from datetime import datetime,timezone
P=lambda path,b: requests.post(f"{API}/api{path}",json=b)
r=P("/redemption-service-charge/bulk-pay-order",{"user_id":U}); print("bulk old-maxed:",r.status_code,str(r.json())[:200])
r2=P("/redemption-service-charge/bulk-pay-order",{"user_id":U}); print("bulk again (reuse):",r2.status_code,r2.json().get("reused"), r2.json().get("order_id")==r.json().get("order_id"))
r3=P("/redemption-service-charge/create-payment",{"charge_id":"TSVC-1"}); print("single after bulk:",r3.status_code,str(r3.json())[:160])
r4=P("/redemption-service-charge/create-payment",{"charge_id":"TSVC-1"}); print("single reuse:",r4.status_code,r4.json().get("reused"))
now=datetime.now(timezone.utc).isoformat()
db.redemption_service_charges.update_many({"user_id":U},{"$set":{"payment_attempts":5,"last_order_at":now,"payment_order_type":"single","payment_order_id":None}})
r5=P("/redemption-service-charge/bulk-pay-order",{"user_id":U}); print("bulk recent-maxed:",r5.status_code,r5.json())
print([ (c["charge_id"],c["payment_attempts"]) for c in db.redemption_service_charges.find({"user_id":U})])
db.redemption_service_charges.delete_many({"user_id":U})
