"""
Backend regression — Explorer burn (v3.3.0), Ad reward ledger fix (v3.2.1),
Mall cancel (v3.2.0), Elite collect (regression).

Hits the preview API end-to-end and verifies prc_ledger rows in Mongo.

Run:
    pytest /app/backend/tests/test_explorer_burn_and_mall_cancel_v330.py -v \
        --junitxml=/app/test_reports/pytest/explorer_burn_v330_results.xml
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "paras_reward_db"

TEST_MOBILE = "9970100782"
TEST_PIN = "997010"
TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


# ── Fixtures ─────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def original_user_state(mongo):
    """Snapshot original elite user so we can restore at the end."""
    u = mongo.users.find_one({"uid": TEST_UID}, {"_id": 0})
    assert u, f"Test user {TEST_UID} must exist in preview DB"
    snapshot = {
        "subscription_plan": u.get("subscription_plan"),
        "membership_type": u.get("membership_type"),
        "prc_balance": u.get("prc_balance", 0),
        "mining_active": u.get("mining_active"),
        "mining_start_time": u.get("mining_start_time"),
        "mining_session_end": u.get("mining_session_end"),
        "last_mining_collect": u.get("last_mining_collect"),
        "next_session_available_at": u.get("next_session_available_at"),
    }
    yield snapshot
    # Restore — leave subscription_plan as elite (canonical)
    mongo.users.update_one(
        {"uid": TEST_UID},
        {"$set": {
            "subscription_plan": "elite",
            "membership_type": "elite",
            "mining_active": False,
            "mining_start_time": None,
            "mining_session_end": None,
        }}
    )


@pytest.fixture(scope="module")
def token():
    """Login → JWT for the test user."""
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": TEST_MOBILE, "password": TEST_PIN},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No access_token in login response: {data.keys()}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _arm_session(mongo, plan: str):
    """Set the test user to {plan} tier with an active 24h session that's
    been running for 1h, so collect produces a non-zero amount."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=1)
    end = now + timedelta(hours=23)
    mongo.users.update_one(
        {"uid": TEST_UID},
        {"$set": {
            "subscription_plan": plan,
            "membership_type": plan,
            "mining_active": True,
            "mining_start_time": start.isoformat(),
            "mining_session_end": end.isoformat(),
            "last_mining_collect": None,
            "next_session_available_at": None,
        }}
    )


# ── 1. EXPLORER COLLECT (BURN) ───────────────────────────────────────
def test_explorer_collect_burns_and_writes_ledger_debit(mongo, original_user_state):
    _arm_session(mongo, "explorer")
    pre = mongo.users.find_one({"uid": TEST_UID}, {"_id": 0, "prc_balance": 1})
    pre_balance = float(pre.get("prc_balance", 0) or 0)

    r = requests.post(f"{BASE_URL}/api/mining/collect/{TEST_UID}", timeout=30)
    assert r.status_code == 200, f"collect failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("success") is True
    assert body.get("burned") is True, f"explorer should burn, got {body}"
    assert body.get("tier") == "explorer"
    collected = float(body.get("collected_amount", 0))
    assert collected > 0, f"collected_amount must be > 0 for 1h session: {body}"
    assert float(body.get("new_balance", -1)) == pytest.approx(pre_balance, abs=0.01), \
        f"explorer new_balance must equal pre_balance: pre={pre_balance} new={body.get('new_balance')}"

    # DB: balance unchanged
    post = mongo.users.find_one({"uid": TEST_UID}, {"_id": 0, "prc_balance": 1})
    assert float(post.get("prc_balance", 0)) == pytest.approx(pre_balance, abs=0.01), \
        "DB prc_balance must be unchanged for Explorer collect"

    # DB: ledger row written
    row = mongo.prc_ledger.find_one(
        {"user_id": TEST_UID, "type": "mining_session_burn"},
        sort=[("created_at", -1)],
    )
    assert row, "prc_ledger row type=mining_session_burn must exist"
    assert row.get("entry_type") == "debit"
    assert float(row.get("amount", 0)) < 0, f"amount must be NEGATIVE: {row.get('amount')}"
    assert float(row.get("balance_before", -1)) == pytest.approx(float(row.get("balance_after", -2)), abs=0.01)
    assert row.get("service_label") == "Main Mining"
    desc = row.get("description") or ""
    assert desc.startswith("Explorer plan — session PRC burned"), f"bad description: {desc}"


# ── 2. AD REWARD AFTER EXPLORER COLLECT ──────────────────────────────
def test_ad_reward_credits_user_for_explorer(mongo, auth_headers):
    """Explorer is still mid-cooldown after the burn test above — that's fine,
    the ads endpoints don't check mining cooldown."""
    pre = mongo.users.find_one({"uid": TEST_UID}, {"_id": 0, "prc_balance": 1})
    pre_balance = float(pre.get("prc_balance", 0) or 0)

    r1 = requests.post(
        f"{BASE_URL}/api/ads/rewarded/start",
        json={"placement": "main_mining_collect"},
        headers=auth_headers, timeout=30,
    )
    assert r1.status_code == 200, f"/start failed: {r1.status_code} {r1.text}"
    s = r1.json()
    if not s.get("allowed"):
        pytest.skip(f"Ad daily quota exhausted: {s}")
    view_token = s["view_token"]
    bonus = int(s["bonus_prc"])
    assert 5 <= bonus <= 10

    r2 = requests.post(
        f"{BASE_URL}/api/ads/rewarded/credit",
        json={"view_token": view_token},
        headers=auth_headers, timeout=30,
    )
    assert r2.status_code == 200, f"/credit failed: {r2.status_code} {r2.text}"
    body = r2.json()
    assert body.get("success") is True
    credited = int(body.get("credited", 0))
    assert credited == bonus

    # DB: balance went UP by exactly `bonus`
    post = mongo.users.find_one({"uid": TEST_UID}, {"_id": 0, "prc_balance": 1})
    assert float(post["prc_balance"]) == pytest.approx(pre_balance + bonus, abs=0.01), \
        f"ad bonus must credit: pre={pre_balance} bonus={bonus} post={post['prc_balance']}"

    # DB: ledger row uses user_id (not uid) and canonical schema
    row = mongo.prc_ledger.find_one(
        {"user_id": TEST_UID, "type": "ad_reward", "reference": view_token},
    )
    assert row, "ad_reward ledger row with user_id (not uid) must exist"
    assert row.get("entry_type") == "credit"
    assert int(row.get("amount", 0)) == bonus
    assert row.get("service_label") == "Main Mining"
    assert "Ad Bonus PRC (Main Mining)" in (row.get("description") or "")
    assert f"+{bonus} PRC" in (row.get("description") or "")


# ── 3. ELITE COLLECT (REGRESSION) ────────────────────────────────────
def test_elite_collect_credits_wallet(mongo):
    _arm_session(mongo, "elite")
    pre = mongo.users.find_one({"uid": TEST_UID}, {"_id": 0, "prc_balance": 1})
    pre_balance = float(pre.get("prc_balance", 0) or 0)

    r = requests.post(f"{BASE_URL}/api/mining/collect/{TEST_UID}", timeout=30)
    assert r.status_code == 200, f"collect failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("success") is True
    assert body.get("burned") is False
    assert body.get("tier") == "elite"
    collected = float(body.get("collected_amount", 0))
    assert collected > 0
    assert float(body.get("new_balance")) == pytest.approx(pre_balance + collected, abs=0.01)

    post = mongo.users.find_one({"uid": TEST_UID}, {"_id": 0, "prc_balance": 1})
    assert float(post["prc_balance"]) == pytest.approx(pre_balance + collected, abs=0.01)

    row = mongo.prc_ledger.find_one(
        {"user_id": TEST_UID, "type": "mining_collect"}, sort=[("created_at", -1)],
    )
    assert row, "mining_collect ledger row must exist"
    assert row.get("entry_type") == "credit"
    assert float(row.get("amount", 0)) > 0
    bb, ba = float(row.get("balance_before", 0)), float(row.get("balance_after", 0))
    assert ba == pytest.approx(bb + float(row.get("amount", 0)), abs=0.01)


# ── 4. MALL CANCEL FLOW ──────────────────────────────────────────────
@pytest.fixture
def seeded_mall_booking(mongo):
    """Top up balance, insert a Smartphone booking with paid_prc=20000."""
    mongo.users.update_one({"uid": TEST_UID}, {"$set": {"prc_balance": 100000}})
    booking_id = f"TEST_BK_{uuid.uuid4().hex[:8]}"
    mongo.mall_bookings.insert_one({
        "booking_id": booking_id,
        "user_id": TEST_UID,
        "product_id": "TEST_PROD_SMARTPHONE",
        "product_name": "Test Smartphone",
        "status": "mining",
        "upfront_prc": 15000,
        "paid_prc": 20000,  # simulating 5000 mined PRC accumulated
        "total_prc_deducted": 15000,
        "total_prc": 50000,
        "remaining_prc": 35000,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield booking_id
    mongo.mall_bookings.delete_one({"booking_id": booking_id})


def test_mall_cancel_refunds_upfront_and_burns_mined(mongo, seeded_mall_booking):
    booking_id = seeded_mall_booking
    pre = mongo.users.find_one({"uid": TEST_UID}, {"_id": 0, "prc_balance": 1})
    pre_balance = float(pre["prc_balance"])

    r = requests.post(
        f"{BASE_URL}/api/mall/cancel-booking/{booking_id}",
        json={"user_id": TEST_UID}, timeout=30,
    )
    assert r.status_code == 200, f"cancel failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("success") is True
    assert int(body.get("refunded_prc", 0)) == 15000
    assert int(body.get("burned_prc", 0)) == 5000

    # DB user: balance up by 15000
    post = mongo.users.find_one({"uid": TEST_UID}, {"_id": 0, "prc_balance": 1})
    assert float(post["prc_balance"]) == pytest.approx(pre_balance + 15000, abs=0.01)

    # DB booking: cancelled
    bk = mongo.mall_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    assert bk["status"] == "cancelled"
    assert int(bk["refunded_prc"]) == 15000
    assert int(bk["burned_prc"]) == 5000
    assert int(bk["total_prc_deducted"]) == 0

    # DB ledger: credit row
    row = mongo.prc_ledger.find_one(
        {"user_id": TEST_UID, "type": "mall_cancel_refund", "reference": booking_id}
    )
    assert row, "mall_cancel_refund ledger row must exist"
    assert row.get("entry_type") == "credit"
    assert int(row.get("amount", 0)) == 15000
    bb, ba = float(row["balance_before"]), float(row["balance_after"])
    assert ba == pytest.approx(bb + 15000, abs=0.01)
    assert row.get("service_label") == "Paras Mall"
    desc = row.get("description") or ""
    assert "upfront refund" in desc
    assert "5000 mined PRC burned" in desc


# ── 5. OWNERSHIP GUARD ───────────────────────────────────────────────
def test_cancel_ownership_guard_403(mongo, seeded_mall_booking):
    booking_id = seeded_mall_booking
    other_uid = "OTHER_USER_NOT_OWNER"
    r = requests.post(
        f"{BASE_URL}/api/mall/cancel-booking/{booking_id}",
        json={"user_id": other_uid}, timeout=30,
    )
    assert r.status_code == 403, f"Expected 403, got {r.status_code} {r.text}"
    detail = (r.json() or {}).get("detail", "")
    assert "only cancel your own" in detail.lower()


# ── 6. STATUS GUARD ──────────────────────────────────────────────────
def test_cancel_status_guard_400(mongo, seeded_mall_booking):
    booking_id = seeded_mall_booking
    # Force status=fulfilled
    mongo.mall_bookings.update_one(
        {"booking_id": booking_id}, {"$set": {"status": "fulfilled"}}
    )
    r = requests.post(
        f"{BASE_URL}/api/mall/cancel-booking/{booking_id}",
        json={"user_id": TEST_UID}, timeout=30,
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code} {r.text}"
    detail = (r.json() or {}).get("detail", "").lower()
    assert "already fulfilled" in detail or "fulfilled" in detail


# ── 7. PRC STATEMENT VISIBILITY (single query surfaces all 4) ────────
def test_prc_statement_query_surfaces_all_four_entries(mongo):
    """db.prc_ledger.find({user_id: <uid>}) must return mining_session_burn,
    ad_reward, mining_collect, mall_cancel_refund — all written above."""
    rows = list(
        mongo.prc_ledger.find({"user_id": TEST_UID}, {"_id": 0})
        .sort("created_at", -1)
        .limit(50)
    )
    types_found = {r.get("type") for r in rows}
    required = {"mining_session_burn", "ad_reward", "mining_collect", "mall_cancel_refund"}
    missing = required - types_found
    assert not missing, f"PRC statement query missing types: {missing}. Found: {types_found}"
