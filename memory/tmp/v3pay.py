import asyncio, sys, os, json, time, httpx
sys.path.insert(0,'/app/backend')
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
import routes.eko_recharge as er
async def main():
    ref = "TST" + str(int(time.time()))
    body = {"initiator_id": er.INITIATOR_ID, "phone_operator_code": "90", "utility_acc_no": "9936606966",
            "confirmation_mobile_no": "9936606966", "sender_name": "Paras Test", "category": 5, "amount": int(sys.argv[1]),
            "client_ref_id": ref, "source_ip": er.SOURCE_IP}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{er._v3_base()}/customer/payment/bbps", headers=er._v3_headers(), json=body)
    print(r.status_code, r.text[:900])
asyncio.run(main())
