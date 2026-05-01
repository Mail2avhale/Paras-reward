"""
INTEGRATION test for Sustainability Auto-Burn (1% post-transaction).
Hits real HTTP endpoints (mark-paid, redeem-limit, usage-history,
admin/debug/total-redeemed) and inspects MongoDB to verify side-effects.

Run:
    pytest /app/backend/tests/test_sustainability_burn_integration.py -v --asyncio-mode=auto
"""
import os
import uuid
import time
import pytest
import requests
import pymongo
import jwt as pyjwt
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward_db")
JWT_SECRET = os.environ.get("JWT_SECRET_KEY")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET_KEY env var is required for tests")
JWT_ALGO = "HS256"

ADMIN_UID = "admin-test-123"
ADMIN_TOKEN = pyjwt.encode(
    {
        "user_id": ADMIN_UID,
        "uid": ADMIN_UID,
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
        "type": "access",
    },
    JWT_SECRET,
    algorithm=JWT_ALGO,
)

# Sync mongo client – the integration test uses HTTP endpoints, so the API
# server keeps its own motor loop; we only inspect/seed via pymongo.
client = pymongo.MongoClient(MONGO_URL)
db = client[DB_NAME]


def _seed_user(uid: str, prc_balance: float):
    db.users.delete_many({"uid": uid})
    db.users.insert_one({
        "uid": uid,
        "email": f"{uid}@test-burn.local",
        "mobile": f"99999{abs(hash(uid)) % 100000:05d}",
        "name": "TEST_burn_user",
        "prc_balance": prc_balance,
        "kyc_status": "verified",
        "role": "user",
    })


def _seed_pending_request(uid: str, request_id: str, withdrawal: int = 1000, prc_deducted: float = 5000.0):
    db.bank_transfer_requests.delete_many({"request_id": request_id})
    db.bank_transfer_requests.insert_one({
        "request_id": request_id,
        "user_id": uid,
        "status": "pending",
        "withdrawal_amount": withdrawal,
        "amount_inr": withdrawal,
        "prc_deducted": prc_deducted,
        "total_prc_deducted": prc_deducted,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "bank_details": {
            "account_number": "1234567890",
            "ifsc_code": "HDFC0000001",
            "account_holder_name": "TEST",
        },
    })


def _cleanup(uid: str):
    db.users.delete_many({"uid": uid})
    for c in [
        "prc_ledger", "transactions", "bank_transfer_requests",
        "subscription_payments", "recharge_requests", "community_posts",
    ]:
        db[c].delete_many({"user_id": uid})


def _mark_paid(request_id: str, admin_id: str = ADMIN_UID):
    return requests.post(
        f"{BASE_URL}/api/bank-transfer/admin/mark-paid",
        json={"request_id": request_id, "admin_id": admin_id, "utr_number": f"UTR{uuid.uuid4().hex[:8]}"},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )


# ---------- TEST 1: Burn applied when balance > 30k ----------
def test_burn_applied_above_threshold():
    uid = f"__TEST_burn_above_{uuid.uuid4().hex[:8]}__"
    req_id = f"BTR-{uuid.uuid4().hex[:8]}"
    _seed_user(uid, 50000.0)
    _seed_pending_request(uid, req_id, withdrawal=2000, prc_deducted=10000.0)
    try:
        r = _mark_paid(req_id)
        assert r.status_code == 200, f"mark-paid failed: {r.status_code} {r.text}"
        # post-deduction balance is 50000 (we did NOT redeem PRC, only flipped status)
        # so 1% of 50000 = 500
        time.sleep(1.0)
        u = db.users.find_one({"uid": uid})
        assert abs(u["prc_balance"] - 49500.0) < 0.01, f"balance after burn: {u['prc_balance']}"
        le = db.prc_ledger.find_one({"user_id": uid, "type": "auto_burn", "service_ref_id": req_id})
        assert le is not None, "ledger entry missing"
        assert le["description"] == "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY"
        assert le["amount"] == -500.0
        assert le["service_type"] == "bank_redeem"
        tx = db.transactions.find_one({"user_id": uid, "type": "prc_burn", "reference_id": req_id})
        assert tx is not None
    finally:
        _cleanup(uid)


# ---------- TEST 2: NO burn when balance <= 30k ----------
def test_no_burn_below_threshold():
    uid = f"__TEST_burn_below_{uuid.uuid4().hex[:8]}__"
    req_id = f"BTR-{uuid.uuid4().hex[:8]}"
    _seed_user(uid, 28000.0)
    _seed_pending_request(uid, req_id)
    try:
        r = _mark_paid(req_id)
        assert r.status_code == 200, r.text
        time.sleep(0.5)
        u = db.users.find_one({"uid": uid})
        assert u["prc_balance"] == 28000.0
        le_count = db.prc_ledger.count_documents({"user_id": uid, "type": "auto_burn"})
        assert le_count == 0
        tx_count = db.transactions.count_documents({"user_id": uid, "type": "prc_burn"})
        assert tx_count == 0
    finally:
        _cleanup(uid)


# ---------- TEST 3: Idempotency via direct module call ----------
def test_idempotent_no_double_burn():
    """We simulate two mark-paid runs by calling apply_sustainability_burn
    directly on the same service_ref_id (mark-paid itself rejects 2nd call
    because status flips to 'paid')."""
    import asyncio
    import sys
    sys.path.insert(0, "/app/backend")
    from routes.sustainability_burn import apply_sustainability_burn, set_db
    from motor.motor_asyncio import AsyncIOMotorClient

    uid = f"__TEST_burn_idempotent_{uuid.uuid4().hex[:8]}__"
    req_id = f"BTR-{uuid.uuid4().hex[:8]}"

    async def _runner():
        async_client = AsyncIOMotorClient(MONGO_URL)
        async_db = async_client[DB_NAME]
        set_db(async_db)
        await async_db.users.delete_many({"uid": uid})
        await async_db.users.insert_one({
            "uid": uid, "email": f"{uid}@test.local",
            "mobile": f"99999{abs(hash(uid)) % 100000:05d}",
            "prc_balance": 100000.0,
        })
        try:
            r1 = await apply_sustainability_burn(uid, "bank_redeem", req_id)
            r2 = await apply_sustainability_burn(uid, "bank_redeem", req_id)
            assert r1["burned"] is True
            assert r2["burned"] is False
            assert r2["reason"] == "already_applied"
            cnt = await async_db.prc_ledger.count_documents(
                {"user_id": uid, "type": "auto_burn"}
            )
            assert cnt == 1
        finally:
            for c in ["users", "prc_ledger", "transactions"]:
                await async_db[c].delete_many({"user_id": uid})
            await async_db.users.delete_many({"uid": uid})
            async_client.close()

    asyncio.run(_runner())


# ---------- TEST 4: Reverse burn ----------
def test_reverse_sustainability_burn():
    import asyncio
    from routes.sustainability_burn import apply_sustainability_burn, reverse_sustainability_burn, set_db
    from motor.motor_asyncio import AsyncIOMotorClient

    uid = f"__TEST_burn_reverse_{uuid.uuid4().hex[:8]}__"
    req_id = f"BTR-{uuid.uuid4().hex[:8]}"

    async def _runner():
        async_client = AsyncIOMotorClient(MONGO_URL)
        async_db = async_client[DB_NAME]
        set_db(async_db)
        await async_db.users.delete_many({"uid": uid})
        await async_db.users.insert_one({
            "uid": uid, "email": f"{uid}@test.local",
            "mobile": f"99999{abs(hash(uid)) % 100000:05d}",
            "prc_balance": 80000.0,
        })
        try:
            r = await apply_sustainability_burn(uid, "mobile_recharge", req_id)
            assert r["burned"] is True
            burned_amt = r["amount"]
            rev = await reverse_sustainability_burn(uid, "mobile_recharge", req_id)
            assert rev["reversed"] is True
            assert rev["amount"] == burned_amt
            u = await async_db.users.find_one({"uid": uid})
            assert abs(u["prc_balance"] - 80000.0) < 0.01
            orig = await async_db.prc_ledger.find_one(
                {"user_id": uid, "type": "auto_burn"}
            )
            assert orig["reversed"] is True
            rev_le = await async_db.prc_ledger.find_one(
                {"user_id": uid, "type": "auto_burn_reversal"}
            )
            assert rev_le is not None
            assert rev_le["amount"] == burned_amt
        finally:
            for c in ["users", "prc_ledger", "transactions"]:
                await async_db[c].delete_many({"user_id": uid})
            await async_db.users.delete_many({"uid": uid})
            async_client.close()

    asyncio.run(_runner())


# ---------- TEST 5: total_redeemed excludes burns ----------
def test_redeem_limit_excludes_burns():
    """User has 1 paid bank_redeem (5000 PRC) + 1 burn entry.
    /api/user/{uid}/redeem-limit `total_redeemed` must ONLY count the
    bank_redeem (5000), NOT the burn."""
    uid = f"__TEST_excl_burn_{uuid.uuid4().hex[:8]}__"
    _seed_user(uid, 60000.0)
    db.bank_transfer_requests.insert_one({
        "user_id": uid, "request_id": f"BTR-RR-{uid}",
        "status": "paid",
        "withdrawal_amount": 1000,
        "total_prc_deducted": 5000.0,
        "prc_deducted": 5000.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": datetime.now(timezone.utc).isoformat(),
    })
    # Inject a fake burn ledger entry
    db.prc_ledger.insert_one({
        "user_id": uid, "type": "auto_burn", "entry_type": "debit",
        "amount": -800.0, "service_ref_id": f"BURN-X-{uid}",
        "service_type": "bank_redeem",
        "description": "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.transactions.insert_one({
        "transaction_id": f"BURN-X-{uid}", "user_id": uid,
        "type": "prc_burn", "amount": -800.0,
        "reference_id": f"BURN-X-{uid}", "service_type": "bank_redeem",
        "description": "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        r = requests.get(f"{BASE_URL}/api/user/{uid}/redeem-limit", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # endpoint shape: { success, user_id, limit: { total_redeemed, ... } }
        limit_obj = data.get("limit") or data
        used = limit_obj.get("total_redeemed", limit_obj.get("used"))
        assert used == 5000.0, f"expected 5000 (burn excluded), got {used}; full={data}"
    finally:
        _cleanup(uid)


# ---------- TEST 6: usage-history excludes burns; total = sum(by_category) ----------
def test_usage_history_excludes_burns_and_sums_match():
    uid = f"__TEST_uh_burn_{uuid.uuid4().hex[:8]}__"
    _seed_user(uid, 60000.0)
    db.bank_transfer_requests.insert_one({
        "user_id": uid, "request_id": f"BTR-UH-{uid}", "status": "paid",
        "withdrawal_amount": 1000, "total_prc_deducted": 5000.0,
        "prc_deducted": 5000.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": datetime.now(timezone.utc).isoformat(),
    })
    db.prc_ledger.insert_one({
        "user_id": uid, "type": "auto_burn", "entry_type": "debit",
        "amount": -800.0, "service_ref_id": f"BURN-UH-{uid}",
        "service_type": "bank_redeem",
        "description": "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        r = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{uid}", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # endpoint shape: { success, user_id, summary: { total_used, by_category, ... } }
        summary = data.get("summary") or data
        total_used = summary.get("total_used", 0)
        by_cat = summary.get("by_category", {}) or {}
        # Sum of categories shown to user (frontend "Redeem Used Details")
        cat_sum = round(sum(float(v) for v in by_cat.values()), 2)
        assert abs(total_used - cat_sum) < 0.01, (
            f"total_used ({total_used}) != sum(by_category) ({cat_sum}); by_category={by_cat}"
        )
        # And no Burn category leaking the burn into used
        assert "Burn" not in by_cat or by_cat.get("Burn", 0) == 0, (
            f"Burn must not appear in by_category as a 'used' entry: {by_cat}"
        )
        # total_used must be 5000 (only the real redeem)
        assert total_used == 5000.0, f"total_used should be 5000, got {total_used}; data={data}"
    finally:
        _cleanup(uid)


# ---------- TEST 7: admin requests list loads under 5s ----------
def test_admin_bank_requests_loads_under_5s():
    t0 = time.time()
    r = requests.get(
        f"{BASE_URL}/api/bank-transfer/admin/requests?limit=50",
        timeout=10,
    )
    elapsed = time.time() - t0
    assert r.status_code == 200, r.text
    body = r.json()
    assert "requests" in body
    assert elapsed < 5.0, f"admin requests page took {elapsed:.2f}s (>5s budget)"


# ---------- TEST 8: over_limit_only filter ----------
def test_over_limit_only_filter():
    r = requests.get(
        f"{BASE_URL}/api/bank-transfer/admin/requests?over_limit_only=true&limit=50",
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    for req in body.get("requests", []):
        assert (req.get("status") or "").lower() == "pending"
        # Either explicitly negative redeem_limit_raw, OR enrichment failed
        # (None) which is also filtered out → list should not contain None.
        assert req.get("redeem_limit_raw") is not None
        assert req["redeem_limit_raw"] < 0


# ---------- TEST 9: admin/debug/total-redeemed requires admin Bearer ----------
def test_admin_debug_total_redeemed_admin_only():
    target_uid = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"
    # No token → 401
    r = requests.get(
        f"{BASE_URL}/api/admin/debug/total-redeemed/{target_uid}",
        timeout=20,
    )
    assert r.status_code == 401, f"expected 401 without token, got {r.status_code}"
    # Non-admin token → 403
    user_token = pyjwt.encode(
        {"user_id": "u1", "role": "user",
         "exp": datetime.now(timezone.utc) + timedelta(hours=1),
         "iat": datetime.now(timezone.utc), "type": "access"},
        JWT_SECRET, algorithm=JWT_ALGO,
    )
    r = requests.get(
        f"{BASE_URL}/api/admin/debug/total-redeemed/{target_uid}",
        headers={"Authorization": f"Bearer {user_token}"},
        timeout=20,
    )
    assert r.status_code == 403, f"expected 403 for non-admin, got {r.status_code}"
    # Admin token → 200 + breakdown
    r = requests.get(
        f"{BASE_URL}/api/admin/debug/total-redeemed/{target_uid}",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "user" in body or "uid" in body or "total" in body, f"unexpected shape: {body}"


# ---------- TEST 10: idempotency check uses correct query (regression) ----------
def test_idempotency_query_shape():
    """Regression: the `existing` lookup must filter on
    (user_id, type=auto_burn, service_ref_id, service_type) — not just ref_id.
    Two different services with the SAME ref_id should each burn once."""
    import asyncio
    from routes.sustainability_burn import apply_sustainability_burn, set_db
    from motor.motor_asyncio import AsyncIOMotorClient

    uid = f"__TEST_idem_query_{uuid.uuid4().hex[:8]}__"

    async def _runner():
        async_client = AsyncIOMotorClient(MONGO_URL)
        async_db = async_client[DB_NAME]
        set_db(async_db)
        await async_db.users.delete_many({"uid": uid})
        await async_db.users.insert_one({
            "uid": uid, "email": f"{uid}@test.local",
            "mobile": f"99999{abs(hash(uid)) % 100000:05d}",
            "prc_balance": 100000.0,
        })
        try:
            r1 = await apply_sustainability_burn(uid, "mobile_recharge", "SAME-REF-1")
            r2 = await apply_sustainability_burn(uid, "dth_recharge", "SAME-REF-1")
            assert r1["burned"] is True
            assert r2["burned"] is True, (
                "different service_type with same ref_id must burn independently; "
                f"got {r2}"
            )
            cnt = await async_db.prc_ledger.count_documents(
                {"user_id": uid, "type": "auto_burn"}
            )
            assert cnt == 2
        finally:
            for c in ["users", "prc_ledger", "transactions"]:
                await async_db[c].delete_many({"user_id": uid})
            await async_db.users.delete_many({"uid": uid})
            async_client.close()

    asyncio.run(_runner())
