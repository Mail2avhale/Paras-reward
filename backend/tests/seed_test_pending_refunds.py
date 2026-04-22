"""
Seed test pending refund records for testing the refund blocker modal flow.
Inserts records across all 4 collections (recharge, bill_payment, dmt, bank_transfer)
for the test user. Run cleanup at end via _test_seed flag.
"""
import asyncio
import os
import sys
sys.path.insert(0, "/app/backend")

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

USER_ID = "76b75808-47fa-48dd-ad7c-8074678e3607"


async def cleanup():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for c in ["recharge_transactions", "bill_payment_requests", "dmt_transactions", "bank_transfer_requests"]:
        r = await db[c].delete_many({"_test_seed": True})
        print(f"Cleanup {c}: deleted {r.deleted_count}")
    client.close()


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # 1. Mobile Recharge (BBPS)
    await db.recharge_transactions.insert_one({
        "user_id": USER_ID,
        "_test_seed": True,
        "eko_tid": "9999990001",
        "client_ref_id": "PAYTEST001",
        "request_id": "RQTEST001",
        "amount_inr": 1849,
        "phone": "9198297047",
        "operator_name": "Airtel",
        "total_prc_deducted": 20.5,
        "status": "refund_pending",
        "created_at": "2026-01-20T10:00:00Z",
    })

    # 2. Bill Payment (BBPS)
    await db.bill_payment_requests.insert_one({
        "user_id": USER_ID,
        "_test_seed": True,
        "eko_tid": "9999990002",
        "client_ref_id": "PAYTEST002",
        "request_id": "RQTEST002",
        "amount_inr": 500,
        "consumer_number": "1234567890",
        "operator_name": "BSES Delhi",
        "service_type_name": "Electricity",
        "total_prc_deducted": 5.0,
        "status": "refund_pending",
        "created_at": "2026-01-20T11:00:00Z",
    })

    # 3. DMT
    await db.dmt_transactions.insert_one({
        "user_id": USER_ID,
        "_test_seed": True,
        "eko_tid": "9999990003",
        "eko_client_ref_id": "DMTTEST003",
        "request_id": "RQTEST003",
        "amount_inr": 2500,
        "beneficiary_mobile": "9876543210",
        "beneficiary_name": "Test Beneficiary",
        "account_number": "12345678901234",
        "ifsc": "HDFC0001234",
        "bank_name": "HDFC Bank",
        "total_prc_deducted": 25.0,
        "status": "refund_pending",
        "created_at": "2026-01-20T12:00:00Z",
    })

    # 4. Bank Transfer
    await db.bank_transfer_requests.insert_one({
        "user_id": USER_ID,
        "_test_seed": True,
        "eko_tid": "9999990004",
        "eko_client_ref_id": "BTTEST004",
        "request_id": "RQTEST004",
        "amount_inr": 10000,
        "account_number": "98765432109876",
        "ifsc": "ICIC0001234",
        "bank_name": "ICICI Bank",
        "beneficiary_name": "BT Test Beneficiary",
        "total_prc_deducted": 100.0,
        "status": "refund_pending",
        "created_at": "2026-01-20T13:00:00Z",
    })

    print("Seeded 4 pending refund records (1 per collection)")
    client.close()


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if action == "cleanup":
        asyncio.run(cleanup())
    else:
        asyncio.run(cleanup())  # clean first
        asyncio.run(seed())
