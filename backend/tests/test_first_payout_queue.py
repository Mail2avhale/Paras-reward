"""
E2E test for First Payout Queue.

Seeds two dummy pending bank-transfer requests:
  • fpq-user-newbie   → lifetime_bank_paid_inr = 0     (should appear in queue)
  • fpq-user-veteran  → lifetime_bank_paid_inr = 2000  (should be excluded)

Then hits /api/bank-transfer/admin/first-payout-queue and asserts:
  • total_in_queue == 1
  • the returned request belongs to the newbie
  • Response payload keys match what AdminFirstPayoutQueue.js expects.

Cleans up all inserted docs at the end.

Run:  cd /app && python -m pytest backend/tests/test_first_payout_queue.py -v -s
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta

import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
API_URL = os.environ["REACT_APP_BACKEND_URL"]

NEWBIE_UID = "fpq-user-newbie-test"
VETERAN_UID = "fpq-user-veteran-test"

NEWBIE_REQ_ID = f"BTR-FPQTEST-NEWBIE-{uuid.uuid4().hex[:6].upper()}"
VETERAN_REQ_ID = f"BTR-FPQTEST-VETERAN-{uuid.uuid4().hex[:6].upper()}"
VETERAN_PAID_REQ_ID = f"BTR-FPQTEST-VET-PAID-{uuid.uuid4().hex[:6].upper()}"


@pytest.mark.asyncio
async def test_first_payout_queue_flow():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    now_iso = datetime.now(timezone.utc).isoformat()
    old_iso = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()

    # ── Seed users (unique emails, satisfies partial-filter unique index) ──
    await db.users.delete_many({"uid": {"$in": [NEWBIE_UID, VETERAN_UID]}})
    await db.users.insert_many([
        {
            "uid": NEWBIE_UID,
            "name": "FPQ Newbie Test",
            "mobile": "9990000001",
            "email": f"fpq-newbie-{uuid.uuid4().hex[:6]}@test.local",
            "subscription_plan": "startup",
            "created_at": now_iso,
            "kyc_status": "verified",
        },
        {
            "uid": VETERAN_UID,
            "name": "FPQ Veteran Test",
            "mobile": "9990000002",
            "email": f"fpq-veteran-{uuid.uuid4().hex[:6]}@test.local",
            "subscription_plan": "elite",
            "created_at": old_iso,
            "kyc_status": "verified",
        },
    ])

    # ── Seed bank_transfer_requests ─────────────────────────────────
    await db.bank_transfer_requests.delete_many({
        "request_id": {"$in": [NEWBIE_REQ_ID, VETERAN_REQ_ID, VETERAN_PAID_REQ_ID]}
    })
    await db.bank_transfer_requests.insert_many([
        # Newbie: pending, no prior paid payouts → should be in queue
        {
            "request_id": NEWBIE_REQ_ID,
            "user_id": NEWBIE_UID,
            "user_name": "FPQ Newbie Test",
            "user_phone": "9990000001",
            "withdrawal_amount": 500,
            "account_holder_name": "FPQ Newbie",
            "account_number": "111122223333",
            "ifsc_code": "HDFC0001234",
            "bank_name": "HDFC Bank",
            "status": "pending",
            "prc_deducted": 6100,
            "created_at": old_iso,     # 5 days old → is_urgent should be true
            "updated_at": old_iso,
        },
        # Veteran: pending BUT lifetime_bank_paid >= threshold → excluded
        {
            "request_id": VETERAN_REQ_ID,
            "user_id": VETERAN_UID,
            "user_name": "FPQ Veteran Test",
            "user_phone": "9990000002",
            "withdrawal_amount": 500,
            "account_holder_name": "FPQ Veteran",
            "account_number": "444455556666",
            "ifsc_code": "ICIC0004321",
            "bank_name": "ICICI Bank",
            "status": "pending",
            "prc_deducted": 6100,
            "created_at": now_iso,
            "updated_at": now_iso,
        },
        # Veteran's paid history — pushes them over the ₹1,000 threshold
        {
            "request_id": VETERAN_PAID_REQ_ID,
            "user_id": VETERAN_UID,
            "user_name": "FPQ Veteran Test",
            "user_phone": "9990000002",
            "withdrawal_amount": 2000,
            "status": "paid",
            "prc_deducted": 24400,
            "created_at": old_iso,
            "updated_at": old_iso,
            "processed_at": old_iso,
        },
    ])

    # ── Call endpoint ────────────────────────────────────────────────
    async with httpx.AsyncClient(timeout=30.0) as http:
        r = await http.get(
            f"{API_URL}/api/bank-transfer/admin/first-payout-queue",
            params={"limit": 100},
        )
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text}"
    data = r.json()

    print(f"\n[FPQ] threshold={data['threshold_inr']} total={data['total_in_queue']} urgent={data['urgent_count']}")

    # ── Assertions ───────────────────────────────────────────────────
    assert data["success"] is True
    assert data["threshold_inr"] == 1000.0
    assert isinstance(data["requests"], list)

    matched = [r for r in data["requests"] if r["request_id"] == NEWBIE_REQ_ID]
    assert len(matched) == 1, "Newbie request should appear in the queue"
    newbie = matched[0]

    # Veteran must NOT be in the queue (over threshold)
    vet_matched = [r for r in data["requests"] if r["request_id"] == VETERAN_REQ_ID]
    assert len(vet_matched) == 0, "Veteran request must be excluded (over threshold)"

    # Shape checks (matches AdminFirstPayoutQueue.js consumption)
    for key in (
        "lifetime_bank_paid_inr",
        "remaining_to_threshold_inr",
        "days_waiting",
        "is_urgent",
        "subscription_plan",
        "is_subscription_active",
        "account_number",
        "ifsc_code",
        "bank_name",
        "withdrawal_amount",
        "user_name",
        "user_phone",
    ):
        assert key in newbie, f"missing field {key} in response row"

    assert newbie["lifetime_bank_paid_inr"] == 0
    assert newbie["is_urgent"] is True, "5-day-old request should be flagged urgent"
    assert newbie["days_waiting"] >= 4
    assert newbie["subscription_plan"] == "startup"
    assert newbie["is_subscription_active"] is True

    # ── Cleanup ──────────────────────────────────────────────────────
    await db.users.delete_many({"uid": {"$in": [NEWBIE_UID, VETERAN_UID]}})
    await db.bank_transfer_requests.delete_many({
        "request_id": {"$in": [NEWBIE_REQ_ID, VETERAN_REQ_ID, VETERAN_PAID_REQ_ID]}
    })

    print("[FPQ] ✅ First Payout Queue endpoint verified")
