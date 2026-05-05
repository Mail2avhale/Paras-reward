"""
End-to-end tests for the V1 Refund OTP user-facing flow.

Covers:
  POST /api/recharge/refund/process/{tid}      — Send OTP via Eko V1
  POST /api/recharge/refund/verify-otp/{tid}   — Verify OTP via Eko V2 refund

All Eko HTTP calls are mocked with `respx` so we can assert exact request bodies
and exercise every code path without hitting the real Eko network.

Why this exists: production users complained "OTP नाही येत mobile वर".
These tests pin down the surface so we can detect ANY contract regression.
"""
import os
import sys
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import pytest_asyncio
import respx
import httpx
from dotenv import load_dotenv

# Load env BEFORE importing routes (they read EKO_* vars at import time)
HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
load_dotenv(BACKEND / ".env")
sys.path.insert(0, str(BACKEND))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from routes import eko_recharge  # noqa: E402

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

# A unique test user id per pytest run avoids collisions on the shared dev DB.
TEST_USER = f"test-refund-user-{uuid.uuid4().hex[:8]}"

EKO_BASE = (os.environ.get("EKO_BASE_URL") or "").rstrip("/")
INITIATOR = os.environ.get("EKO_INITIATOR_ID") or ""
DEV_KEY = os.environ.get("EKO_DEVELOPER_KEY") or ""
USER_CODE = os.environ.get("EKO_USER_CODE") or ""


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db():
    """Real MongoDB connection (dev). Tests insert + clean up their own rows."""
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    database = client[db_name]
    # Inject into the route module so its `db is None` guard passes
    eko_recharge.set_db(database)
    # Cleanup any leftover from prior runs
    await database.recharge_transactions.delete_many({"user_id": TEST_USER})
    await database.bill_payment_requests.delete_many({"user_id": TEST_USER})
    await database.dmt_transactions.delete_many({"user_id": TEST_USER})
    await database.bank_transfer_requests.delete_many({"user_id": TEST_USER})
    await database.eko_refund_logs.delete_many({"user_id": TEST_USER})
    yield database
    # Cleanup (per-test)
    await database.recharge_transactions.delete_many({"user_id": TEST_USER})
    await database.bill_payment_requests.delete_many({"user_id": TEST_USER})
    await database.dmt_transactions.delete_many({"user_id": TEST_USER})
    await database.bank_transfer_requests.delete_many({"user_id": TEST_USER})
    await database.eko_refund_logs.delete_many({"user_id": TEST_USER})
    await database.users.delete_one({"uid": TEST_USER})


async def _seed_refund_pending_recharge(db, eko_tid: str, prc_amount: int = 200) -> dict:
    """Insert a refund_pending recharge row for our test user."""
    doc = {
        "user_id": TEST_USER,
        "eko_tid": eko_tid,
        "client_ref_id": f"PR-TEST-{eko_tid}",
        "status": "refund_pending",
        "total_prc_deducted": prc_amount,
        "amount": 100,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "request_id": f"req-{eko_tid}",
    }
    await db.recharge_transactions.insert_one(doc.copy())
    # Ensure user exists for the prc_balance update path
    await db.users.update_one(
        {"uid": TEST_USER},
        {"$setOnInsert": {
            "uid": TEST_USER,
            "name": "Refund Test User",
            "mobile": f"9{TEST_USER[-9:].zfill(9)}"[:10],
            "email": f"{TEST_USER}@test.local",
            "prc_balance": 1000,
        }},
        upsert=True,
    )
    return doc


# ─────────────────────────────────────────────────────────────────────────────
# OTP SEND tests — POST /refund/process/{tid}
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@respx.mock
async def test_otp_send_happy_path_production_sms(db):
    """Production case: Eko returns status:0 + populated data.otp_ref_id → SMS confirmed."""
    tid = "11111111111"
    await _seed_refund_pending_recharge(db, tid)

    respx.post(f"{EKO_BASE}/v1/transactions/{tid}/refund/otp").mock(
        return_value=httpx.Response(200, json={
            "response_status_id": -1,
            "status": 0,
            "invalid_params": None,
            "message": "OTP for failed transaction has been sent to customers mobile {2} {3}",
            "data": {"tid": "TID-OK", "otp_ref_id": "REF-XYZ"},
        })
    )

    res = await eko_recharge.user_process_refund(
        tid, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    assert res["success"] is True, res
    assert res.get("otp_sent") is True
    assert res.get("delivery_confirmed") is True
    # Template-token message normalised away
    assert "{" not in res["message"], res
    # Audit log written with confirmed kind
    log = await db.eko_refund_logs.find_one(
        {"tid": tid, "user_id": TEST_USER, "action": "otp_send", "result": "success"}
    )
    assert log is not None
    assert log.get("send_kind") == "confirmed"


@pytest.mark.asyncio
@respx.mock
async def test_otp_send_ambiguous_silent_failure_returns_warning(db):
    """Critical regression test for production bug:

    Eko returns status:0 + invalid_params:null BUT data.tid="" (e.g. user_code
    mismatch causes Eko to no-op the SMS dispatch). Older code reported plain
    success; users complained "OTP not received". The fixed code MUST mark the
    response as ambiguous so the UI can show a softer 'try resend' message and
    the audit log records the full Eko payload for ops triage.
    """
    tid = "11111111112"
    await _seed_refund_pending_recharge(db, tid)

    respx.post(f"{EKO_BASE}/v1/transactions/{tid}/refund/otp").mock(
        return_value=httpx.Response(200, json={
            "response_status_id": -1,
            "status": 0,
            "invalid_params": None,
            "message": "OTP for failed transaction has been sent to customers mobile {2} {3}",
            "data": {"tid": "", "otp_ref_id": ""},
        })
    )

    res = await eko_recharge.user_process_refund(
        tid, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    # Surface as success=True so the OTP entry input still appears on UI…
    assert res["success"] is True, res
    # …but delivery_confirmed=False so the UI knows to soften the messaging.
    assert res.get("delivery_confirmed") is False, res
    # User-visible message must hint at retry / contact support.
    msg = res["message"].lower()
    assert ("60 seconds" in msg) or ("resend" in msg) or ("contact support" in msg), res

    # Audit log must capture the ambiguous send + full Eko response for triage.
    log = await db.eko_refund_logs.find_one(
        {"tid": tid, "user_id": TEST_USER, "action": "otp_send"}
    )
    assert log is not None, "Audit row missing for ambiguous OTP send"
    assert log.get("result") == "ambiguous"
    assert log.get("send_kind") == "ambiguous"
    assert "eko_full_response" in log


@pytest.mark.asyncio
@respx.mock
async def test_otp_send_no_data_no_msg_treated_as_failure(db):
    """If Eko returns no data AND the message doesn't say 'OTP sent', we should
    NOT report success — that's pure silent failure (no signal of any send)."""
    tid = "11111111113"
    await _seed_refund_pending_recharge(db, tid)

    respx.post(f"{EKO_BASE}/v1/transactions/{tid}/refund/otp").mock(
        return_value=httpx.Response(200, json={
            "response_status_id": -1,
            "status": 0,
            "invalid_params": None,
            "message": "Operation completed",  # ← no 'OTP' / 'sent' wording
            "data": {"tid": "", "otp_ref_id": ""},
        })
    )

    res = await eko_recharge.user_process_refund(
        tid, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    assert res["success"] is False, res
    log = await db.eko_refund_logs.find_one(
        {"tid": tid, "user_id": TEST_USER, "action": "otp_send", "result": "failed"}
    )
    assert log is not None


@pytest.mark.asyncio
@respx.mock
async def test_otp_send_inline_otp_auto_completes_refund(db):
    """Staging case: Eko returns OTP inline → server auto-calls /v2/refund and finishes."""
    tid = "22222222222"
    await _seed_refund_pending_recharge(db, tid, prc_amount=300)

    respx.post(f"{EKO_BASE}/v1/transactions/{tid}/refund/otp").mock(
        return_value=httpx.Response(200, json={
            "response_status_id": -1,
            "status": 0,
            "invalid_params": None,
            "message": "OTP sent",
            "data": {"tid": "", "otp_ref_id": "REF1", "otp": "123456"},
        })
    )
    respx.post(f"{EKO_BASE}/v2/transactions/{tid}/refund").mock(
        return_value=httpx.Response(200, json={
            "response_status_id": 0,
            "status": 0,
            "invalid_params": None,
            "message": "Refund successful",
            "data": {"refund_tid": "RFND-99", "refunded_amount": "100"},
        })
    )

    res = await eko_recharge.user_process_refund(
        tid, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    assert res["success"] is True, res
    assert res.get("auto_completed") is True
    assert res.get("refund_tid") == "RFND-99"
    # DB row should be marked refunded
    row = await db.recharge_transactions.find_one({"eko_tid": tid}, {"_id": 0})
    assert row["status"] == "refunded", row
    assert row.get("prc_refunded") is True
    # User balance bumped by prc_amount (300)
    user = await db.users.find_one({"uid": TEST_USER}, {"_id": 0, "prc_balance": 1})
    assert user["prc_balance"] >= 1300


@pytest.mark.asyncio
@respx.mock
async def test_otp_send_invalid_tid_returns_friendly_message(db):
    """Eko rejects with invalid_params on bad TID."""
    tid = "33333333333"
    await _seed_refund_pending_recharge(db, tid)

    respx.post(f"{EKO_BASE}/v1/transactions/{tid}/refund/otp").mock(
        return_value=httpx.Response(200, json={
            "response_status_id": -1,
            "status": 0,
            "invalid_params": {"tid": "Invalid_tid_Format {2} {3}"},
            "message": "Invalid_tid_Format {2} {3}",
            "data": {"tid": "", "otp_ref_id": ""},
        })
    )

    res = await eko_recharge.user_process_refund(
        tid, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    assert res["success"] is False
    # Message must NOT contain raw template tokens
    assert "{2}" not in res["message"]
    assert "{3}" not in res["message"]
    # Failed audit log written (counts toward rate limit)
    log = await db.eko_refund_logs.find_one(
        {"tid": tid, "user_id": TEST_USER, "action": "otp_send", "result": "failed"}
    )
    assert log is not None


@pytest.mark.asyncio
@respx.mock
async def test_otp_send_rejects_when_txn_not_refund_pending(db):
    """Refund flow must not run for a txn that is not currently refund_pending."""
    tid = "44444444444"
    await db.recharge_transactions.insert_one({
        "user_id": TEST_USER,
        "eko_tid": tid,
        "status": "success",  # ← not refund_pending
        "total_prc_deducted": 100,
    })

    res = await eko_recharge.user_process_refund(
        tid, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    assert res["success"] is False
    assert "refund pending" in res["message"].lower()


@pytest.mark.asyncio
@respx.mock
async def test_otp_send_rejects_when_txn_belongs_to_other_user(db):
    """A user must not be able to trigger refund on a stranger's transaction."""
    tid = "55555555555"
    await db.recharge_transactions.insert_one({
        "user_id": "some-other-user",
        "eko_tid": tid,
        "status": "refund_pending",
        "total_prc_deducted": 100,
    })

    res = await eko_recharge.user_process_refund(
        tid, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    assert res["success"] is False
    assert "not found" in res["message"].lower() or "does not belong" in res["message"].lower()


@pytest.mark.asyncio
@respx.mock
async def test_otp_send_rejects_when_no_numeric_eko_tid(db):
    """Excel-imported rows that only have client_ref_id (PAY-prefixed) must surface a clear error."""
    cref = "PAY-ABCDEF123"
    await db.recharge_transactions.insert_one({
        "user_id": TEST_USER,
        "client_ref_id": cref,
        "status": "refund_pending",
        "total_prc_deducted": 100,
    })

    res = await eko_recharge.user_process_refund(
        cref, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    assert res["success"] is False
    assert "Eko Transaction ID missing" in res["message"], res


@pytest.mark.asyncio
@respx.mock
async def test_otp_send_rate_limited_after_5_attempts(db):
    """Rate-limit kicks in at 5 OTP-send attempts inside a 1-hour window."""
    tid = "66666666666"
    await _seed_refund_pending_recharge(db, tid)

    now_epoch = datetime.now(timezone.utc).timestamp()
    for _ in range(5):
        await db.eko_refund_logs.insert_one({
            "tid": tid,
            "user_id": TEST_USER,
            "action": "otp_send",
            "result": "success",
            "ts_epoch": now_epoch - 60,
            "ts": datetime.now(timezone.utc).isoformat(),
        })

    res = await eko_recharge.user_process_refund(
        tid, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    assert res["success"] is False
    assert "Too many OTP requests" in res["message"]


@pytest.mark.asyncio
@respx.mock
async def test_otp_send_includes_required_eko_v1_body_params(db):
    """Pin the V1 request shape: initiator_id + developer_key in form body, headers added by helper."""
    tid = "77777777777"
    await _seed_refund_pending_recharge(db, tid)

    captured = {}

    def _capture(request: httpx.Request):
        captured["url"] = str(request.url)
        captured["body"] = request.read().decode()
        captured["headers"] = dict(request.headers)
        return httpx.Response(200, json={
            "response_status_id": -1, "status": 0, "invalid_params": None,
            "message": "OTP sent", "data": {"tid": "", "otp_ref_id": ""},
        })

    respx.post(f"{EKO_BASE}/v1/transactions/{tid}/refund/otp").mock(side_effect=_capture)

    await eko_recharge.user_process_refund(
        tid, eko_recharge.UserRefundRequest(user_id=TEST_USER)
    )
    assert f"initiator_id={INITIATOR}" in captured["body"], captured
    assert f"developer_key={DEV_KEY}" in captured["body"], captured
    # Auth headers must be present
    assert "developer_key" in captured["headers"]
    assert "secret-key" in captured["headers"]
    assert "secret-key-timestamp" in captured["headers"]
    assert captured["headers"].get("content-type", "").startswith("application/x-www-form-urlencoded")


# ─────────────────────────────────────────────────────────────────────────────
# OTP VERIFY tests — POST /refund/verify-otp/{tid}
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@respx.mock
async def test_verify_otp_happy_path_marks_refunded_and_credits_prc(db):
    """Correct OTP → Eko returns refund_tid → row marked refunded, PRC restored."""
    tid = "88888888888"
    await _seed_refund_pending_recharge(db, tid, prc_amount=250)

    respx.post(f"{EKO_BASE}/v2/transactions/{tid}/refund").mock(
        return_value=httpx.Response(200, json={
            "response_status_id": 0, "status": 0, "invalid_params": None,
            "message": "Refund successful",
            "data": {"refund_tid": "RFND-88", "refunded_amount": "100"},
        })
    )

    pre_user = await db.users.find_one({"uid": TEST_USER}, {"_id": 0, "prc_balance": 1})
    pre_balance = pre_user["prc_balance"]

    res = await eko_recharge.user_verify_refund_otp(
        tid, eko_recharge.UserManualRefundOTPRequest(user_id=TEST_USER, otp="123456")
    )
    assert res["success"] is True, res
    assert res["refund_tid"] == "RFND-88"

    row = await db.recharge_transactions.find_one({"eko_tid": tid}, {"_id": 0})
    assert row["status"] == "refunded"
    assert row.get("prc_refunded") is True

    post_user = await db.users.find_one({"uid": TEST_USER}, {"_id": 0, "prc_balance": 1})
    assert post_user["prc_balance"] == pre_balance + 250


@pytest.mark.asyncio
@respx.mock
async def test_verify_otp_wrong_otp_returns_friendly_error(db):
    """Wrong OTP → invalid_params set → user sees a clean error message."""
    tid = "99999999999"
    await _seed_refund_pending_recharge(db, tid)

    respx.post(f"{EKO_BASE}/v2/transactions/{tid}/refund").mock(
        return_value=httpx.Response(200, json={
            "response_status_id": 1, "status": 0,
            "invalid_params": {"otp": "Please enter a valid OTP"},
            "message": "Wrong TID or OTP {2} {3}",
            "data": {"tid": ""},
        })
    )

    res = await eko_recharge.user_verify_refund_otp(
        tid, eko_recharge.UserManualRefundOTPRequest(user_id=TEST_USER, otp="999999")
    )
    assert res["success"] is False
    assert "{" not in res["message"]
    # DB still refund_pending
    row = await db.recharge_transactions.find_one({"eko_tid": tid}, {"_id": 0})
    assert row["status"] == "refund_pending"
    # Failed verify audit
    log = await db.eko_refund_logs.find_one(
        {"tid": tid, "user_id": TEST_USER, "action": "refund_verify", "result": "failed"}
    )
    assert log is not None


@pytest.mark.asyncio
@respx.mock
async def test_verify_otp_rejects_when_no_numeric_eko_tid(db):
    """Same client_ref_id-only edge case as the send path."""
    cref = "PAY-NOEKO123"
    await db.recharge_transactions.insert_one({
        "user_id": TEST_USER,
        "client_ref_id": cref,
        "status": "refund_pending",
        "total_prc_deducted": 100,
    })

    res = await eko_recharge.user_verify_refund_otp(
        cref, eko_recharge.UserManualRefundOTPRequest(user_id=TEST_USER, otp="123456")
    )
    assert res["success"] is False
    assert "Eko Transaction ID missing" in res["message"]


# ─────────────────────────────────────────────────────────────────────────────
# Pending refunds GET — /pending-refunds/{user_id}
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pending_refunds_respects_kill_switch(db):
    """When refund_blocker_modal_enabled=False, endpoint returns empty even if rows exist."""
    tid = "10101010101"
    await _seed_refund_pending_recharge(db, tid)
    await db.system_config.update_one(
        {"key": "refund_blocker_modal_enabled"},
        {"$set": {"key": "refund_blocker_modal_enabled", "value": False}},
        upsert=True,
    )

    res = await eko_recharge.get_user_pending_refunds(TEST_USER)
    assert res["success"] is True
    assert res["count"] == 0
    assert res.get("modal_disabled") is True


@pytest.mark.asyncio
async def test_pending_refunds_returns_rows_when_enabled(db):
    """When kill switch is on, endpoint surfaces the refund_pending rows."""
    tid = "12121212121"
    await _seed_refund_pending_recharge(db, tid)
    await db.system_config.update_one(
        {"key": "refund_blocker_modal_enabled"},
        {"$set": {"key": "refund_blocker_modal_enabled", "value": True}},
        upsert=True,
    )

    res = await eko_recharge.get_user_pending_refunds(TEST_USER)
    assert res["success"] is True
    assert res["count"] >= 1
    found = next((r for r in res["pending_refunds"] if r["eko_tid"] == tid), None)
    assert found is not None
    assert found["service_type"] == "Mobile Recharge"

    # Reset kill switch off so other tests/users aren't blocked
    await db.system_config.update_one(
        {"key": "refund_blocker_modal_enabled"},
        {"$set": {"value": False}},
    )
