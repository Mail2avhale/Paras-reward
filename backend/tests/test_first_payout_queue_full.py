"""
Comprehensive E2E test for First Payout Priority Queue feature (iter 267).

Covers:
  1. GET /api/bank-transfer/admin/first-payout-queue — shape, threshold_inr, total_in_queue, urgent_count, total_amount_inr, requests[]
  2. GET /api/bank-transfer/admin/first-payout-threshold — env/db source + fields
  3. POST /api/bank-transfer/admin/first-payout-threshold — persist, GET reflects, {value: null} restores env
  4. Users with lifetime_bank_paid_inr >= threshold are EXCLUDED
  5. Response items contain all fields FE consumes
  6. POST /api/bank-transfer/admin/mark-paid with {request_id, admin_id, remark, utr_number}

All test data cleaned up at end. Unique emails per run.
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
API_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

RUN_ID = uuid.uuid4().hex[:6].upper()
NEWBIE_UID = f"fpqfull-newbie-{RUN_ID}"
VETERAN_UID = f"fpqfull-veteran-{RUN_ID}"
MARKPAID_UID = f"fpqfull-markpaid-{RUN_ID}"

NEWBIE_REQ_ID = f"BTR-FPQFULL-NEWBIE-{RUN_ID}"
VETERAN_REQ_ID = f"BTR-FPQFULL-VETERAN-{RUN_ID}"
VETERAN_PAID_REQ_ID = f"BTR-FPQFULL-VETPAID-{RUN_ID}"
MARKPAID_REQ_ID = f"BTR-FPQFULL-MARKPAID-{RUN_ID}"

REQUIRED_ROW_KEYS = [
    "request_id", "user_name", "user_phone",
    "account_holder_name", "account_number", "ifsc_code", "bank_name",
    "withdrawal_amount",
    "lifetime_bank_paid_inr", "days_waiting", "is_urgent",
    "subscription_plan", "is_subscription_active",
]

TOP_LEVEL_KEYS = [
    "success", "threshold_inr", "total_in_queue",
    "urgent_count", "total_amount_inr", "requests",
]


@pytest.fixture(scope="module")
async def db_and_seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    now_iso = datetime.now(timezone.utc).isoformat()
    old_iso = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()

    # Clean pre-existing test data (idempotent)
    await db.users.delete_many({"uid": {"$in": [NEWBIE_UID, VETERAN_UID, MARKPAID_UID]}})
    await db.bank_transfer_requests.delete_many({
        "request_id": {"$in": [NEWBIE_REQ_ID, VETERAN_REQ_ID, VETERAN_PAID_REQ_ID, MARKPAID_REQ_ID]}
    })

    # Seed users with UNIQUE random emails (partial-filter unique index safe)
    await db.users.insert_many([
        {
            "uid": NEWBIE_UID,
            "name": "FPQ Full Newbie",
            "mobile": f"99911{RUN_ID[:5]}",
            "email": f"TEST_fpqfull_newbie_{RUN_ID}@test.local",
            "subscription_plan": "startup",
            "created_at": now_iso,
            "kyc_status": "verified",
        },
        {
            "uid": VETERAN_UID,
            "name": "FPQ Full Veteran",
            "mobile": f"99922{RUN_ID[:5]}",
            "email": f"TEST_fpqfull_veteran_{RUN_ID}@test.local",
            "subscription_plan": "elite",
            "created_at": old_iso,
            "kyc_status": "verified",
        },
        {
            "uid": MARKPAID_UID,
            "name": "FPQ Full MarkPaid",
            "mobile": f"99933{RUN_ID[:5]}",
            "email": f"TEST_fpqfull_markpaid_{RUN_ID}@test.local",
            "subscription_plan": "growth",
            "created_at": now_iso,
            "kyc_status": "verified",
        },
    ])

    await db.bank_transfer_requests.insert_many([
        # Newbie: pending, lifetime_bank_paid=0 → should be IN queue
        {
            "request_id": NEWBIE_REQ_ID,
            "user_id": NEWBIE_UID,
            "user_name": "FPQ Full Newbie",
            "user_phone": f"99911{RUN_ID[:5]}",
            "withdrawal_amount": 500,
            "account_holder_name": "Newbie Full",
            "account_number": "111199990001",
            "ifsc_code": "HDFC0009991",
            "bank_name": "HDFC Bank",
            "status": "pending",
            "prc_deducted": 6100,
            "created_at": old_iso,
            "updated_at": old_iso,
        },
        # Veteran: pending BUT lifetime paid = ₹2000 → EXCLUDED
        {
            "request_id": VETERAN_REQ_ID,
            "user_id": VETERAN_UID,
            "user_name": "FPQ Full Veteran",
            "user_phone": f"99922{RUN_ID[:5]}",
            "withdrawal_amount": 400,
            "account_holder_name": "Veteran Full",
            "account_number": "222299990002",
            "ifsc_code": "ICIC0009992",
            "bank_name": "ICICI Bank",
            "status": "pending",
            "prc_deducted": 4880,
            "created_at": now_iso,
            "updated_at": now_iso,
        },
        # Veteran's prior PAID request (₹2000) — over ₹1000 threshold
        {
            "request_id": VETERAN_PAID_REQ_ID,
            "user_id": VETERAN_UID,
            "withdrawal_amount": 2000,
            "status": "paid",
            "prc_deducted": 24400,
            "created_at": old_iso,
            "updated_at": old_iso,
            "processed_at": old_iso,
        },
        # MarkPaid target: pending → will be flipped to paid via API
        {
            "request_id": MARKPAID_REQ_ID,
            "user_id": MARKPAID_UID,
            "user_name": "FPQ Full MarkPaid",
            "user_phone": f"99933{RUN_ID[:5]}",
            "withdrawal_amount": 300,
            "account_holder_name": "MarkPaid Full",
            "account_number": "333399990003",
            "ifsc_code": "SBIN0009993",
            "bank_name": "State Bank of India",
            "status": "pending",
            "prc_deducted": 3760,
            "created_at": now_iso,
            "updated_at": now_iso,
        },
    ])

    # Reset threshold DB override to a known-good state before tests
    await db.app_settings.update_one(
        {"key": "first_payout_threshold_inr"},
        {"$set": {"key": "first_payout_threshold_inr", "value": None,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )

    yield db

    # Cleanup
    await db.users.delete_many({"uid": {"$in": [NEWBIE_UID, VETERAN_UID, MARKPAID_UID]}})
    await db.bank_transfer_requests.delete_many({
        "request_id": {"$in": [NEWBIE_REQ_ID, VETERAN_REQ_ID, VETERAN_PAID_REQ_ID, MARKPAID_REQ_ID]}
    })
    # Restore threshold to env default (null)
    await db.app_settings.update_one(
        {"key": "first_payout_threshold_inr"},
        {"$set": {"value": None}},
        upsert=True,
    )
    client.close()


# ==================== Test 1: Queue endpoint shape + inclusion ====================
@pytest.mark.asyncio
async def test_queue_shape_and_newbie_included(db_and_seed):
    async for _ in db_and_seed:
        break
    async with httpx.AsyncClient(timeout=30.0) as http:
        r = await http.get(f"{API_URL}/api/bank-transfer/admin/first-payout-queue", params={"limit": 200})
    assert r.status_code == 200, r.text
    data = r.json()
    for k in TOP_LEVEL_KEYS:
        assert k in data, f"top-level key '{k}' missing"
    assert data["success"] is True
    assert isinstance(data["threshold_inr"], (int, float))
    assert data["threshold_inr"] == 1000.0
    assert isinstance(data["requests"], list)
    assert isinstance(data["total_in_queue"], int)
    assert isinstance(data["urgent_count"], int)
    assert isinstance(data["total_amount_inr"], (int, float))

    matched = [x for x in data["requests"] if x["request_id"] == NEWBIE_REQ_ID]
    assert len(matched) == 1, "Newbie must appear in queue"
    row = matched[0]
    for k in REQUIRED_ROW_KEYS:
        assert k in row, f"row field '{k}' missing"
    assert row["lifetime_bank_paid_inr"] == 0
    assert row["is_urgent"] is True
    assert row["days_waiting"] >= 4
    assert row["subscription_plan"] == "startup"
    assert row["is_subscription_active"] is True


# ==================== Test 2: Veteran excluded (over threshold) ====================
@pytest.mark.asyncio
async def test_veteran_excluded(db_and_seed):
    async for _ in db_and_seed:
        break
    async with httpx.AsyncClient(timeout=30.0) as http:
        r = await http.get(f"{API_URL}/api/bank-transfer/admin/first-payout-queue", params={"limit": 500})
    assert r.status_code == 200
    data = r.json()
    vet = [x for x in data["requests"] if x["request_id"] == VETERAN_REQ_ID]
    assert vet == [], f"Veteran with ₹2000 lifetime must NOT be in queue, got: {vet}"


# ==================== Test 3: GET threshold (env source) ====================
@pytest.mark.asyncio
async def test_get_threshold_env_source(db_and_seed):
    async for _ in db_and_seed:
        break
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(f"{API_URL}/api/bank-transfer/admin/first-payout-threshold")
    assert r.status_code == 200
    data = r.json()
    for k in ("threshold_inr", "source", "db_value", "env_default"):
        assert k in data, f"'{k}' missing"
    assert data["source"] in ("env", "database")
    assert data["db_value"] is None  # We nulled it in fixture
    assert data["source"] == "env"
    assert data["threshold_inr"] == data["env_default"]


# ==================== Test 4: POST threshold persists + GET reflects + null restores ====================
@pytest.mark.asyncio
async def test_post_threshold_persist_and_null_restore(db_and_seed):
    async for _ in db_and_seed:
        break
    async with httpx.AsyncClient(timeout=15.0) as http:
        # POST value = 500
        r1 = await http.post(
            f"{API_URL}/api/bank-transfer/admin/first-payout-threshold",
            json={"value": 500},
        )
        assert r1.status_code == 200, r1.text
        assert r1.json().get("threshold_inr") == 500

        # GET → should reflect 500 from database
        r2 = await http.get(f"{API_URL}/api/bank-transfer/admin/first-payout-threshold")
        d2 = r2.json()
        assert d2["threshold_inr"] == 500.0
        assert d2["source"] == "database"
        assert d2["db_value"] == 500.0

        # Queue endpoint should now also honor 500
        r3 = await http.get(f"{API_URL}/api/bank-transfer/admin/first-payout-queue")
        assert r3.json()["threshold_inr"] == 500.0

        # POST null → clears override
        r4 = await http.post(
            f"{API_URL}/api/bank-transfer/admin/first-payout-threshold",
            json={"value": None},
        )
        assert r4.status_code == 200
        r5 = await http.get(f"{API_URL}/api/bank-transfer/admin/first-payout-threshold")
        d5 = r5.json()
        assert d5["source"] == "env"
        assert d5["db_value"] is None
        assert d5["threshold_inr"] == d5["env_default"]


# ==================== Test 5: mark-paid with FE payload shape ====================
@pytest.mark.asyncio
async def test_mark_paid_with_admin_id_and_remark(db_and_seed):
    async for _ in db_and_seed:
        break
    payload = {
        "request_id": MARKPAID_REQ_ID,
        "admin_id": "admin-test-123",
        "remark": "TEST_FPQFULL mark-paid via API",
        "utr_number": f"UTR-{RUN_ID}",
    }
    async with httpx.AsyncClient(timeout=30.0) as http:
        r = await http.post(f"{API_URL}/api/bank-transfer/admin/mark-paid", json=payload)
    assert r.status_code == 200, f"mark-paid failed: HTTP {r.status_code}: {r.text}"

    # Verify persisted state via GET request-details
    async with httpx.AsyncClient(timeout=15.0) as http:
        r2 = await http.get(f"{API_URL}/api/bank-transfer/admin/request/{MARKPAID_REQ_ID}")
    assert r2.status_code == 200
    body = r2.json()
    req = body.get("request", {})
    assert req.get("status") == "paid"
    assert req.get("utr_number") == payload["utr_number"]
    assert req.get("processed_by") == "admin-test-123"
    assert "TEST_FPQFULL" in (req.get("admin_remark") or "")


# ==================== Test 6: bad payload validation ====================
@pytest.mark.asyncio
async def test_post_threshold_bad_value(db_and_seed):
    async for _ in db_and_seed:
        break
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.post(
            f"{API_URL}/api/bank-transfer/admin/first-payout-threshold",
            json={"value": 999999},
        )
    assert r.status_code == 400
