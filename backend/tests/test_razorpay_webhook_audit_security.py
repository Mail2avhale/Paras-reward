"""
Backend tests for CRITICAL security + data-integrity fixes (Feb 2026):
  1. Webhook signature enforcement (hard-fail on missing/wrong sig)
  2. /admin/fix-cancelled-subscriptions — `uid` vs `user_id` bug fix
  3. /admin/audit-cancelled-elite — `uid` vs `user_id` bug fix
  4. /admin/audit-paid-plans-without-payment — NEW comprehensive audit
  5. Admin PIN enforcement on all 3 admin audit/fix endpoints
  6. Non-regression: /api/razorpay/create-order still responds (no 5xx w/ empty)

Uses direct MongoDB inserts (MONGO_URL + DB_NAME) for isolated test data.
All fixture data is prefixed with `TEST_` (or unique test uids) and cleaned
up in fixture teardown.
"""
import os
import hmac
import hashlib
import json
import asyncio
from datetime import datetime, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

# ─── load backend env for MONGO / RZP secret ─────────────────────────────
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: try frontend/.env
    load_dotenv("/app/frontend/.env")
    BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
RZP_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET")

WEBHOOK_URL = f"{BASE_URL}/api/razorpay/webhook"
FIX_URL = f"{BASE_URL}/api/razorpay/admin/fix-cancelled-subscriptions"
AUDIT_ELITE_URL = f"{BASE_URL}/api/razorpay/admin/audit-cancelled-elite"
AUDIT_PAID_URL = f"{BASE_URL}/api/razorpay/admin/audit-paid-plans-without-payment"
CREATE_ORDER_URL = f"{BASE_URL}/api/razorpay/create-order"

# Test UIDs — will be cleaned up after
UID_AUDIT_1 = "TEST-audit-1-uid"
UID_COMP_1 = "TEST-comp-1-uid"
UID_COMP_2 = "TEST-comp-2-uid"

ORDER_COMP_2_PAID = "TEST_order_comp2_paid"
ORDER_AUDIT_1_CANC = "TEST_order_audit1_canc"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module", autouse=True)
def seed_and_cleanup(mongo_db):
    """Insert test users/orders before tests; remove after."""
    now = datetime.now(timezone.utc)

    # cleanup any stale rows from previous runs first
    mongo_db.users.delete_many({"uid": {"$in": [UID_AUDIT_1, UID_COMP_1, UID_COMP_2]}})
    mongo_db.razorpay_orders.delete_many({"user_id": {"$in": [UID_AUDIT_1, UID_COMP_1, UID_COMP_2]}})

    # TEST 4/5 user: elite plan + cancelled order, no paid orders
    mongo_db.users.insert_one({
        "uid": UID_AUDIT_1,
        "name": "TEST Audit User 1",
        "email": "test_audit_1@example.com",
        "mobile": "9990000001",
        "subscription_plan": "elite",
        "admin_upgraded": False,
        "admin_fixed": False,
        "created_at": now,
    })
    mongo_db.razorpay_orders.insert_one({
        "order_id": ORDER_AUDIT_1_CANC,
        "user_id": UID_AUDIT_1,
        "status": "cancelled",
        "amount": 300,
        "created_at": now,
    })

    # TEST 6/7/8 comp-1: growth plan, NO orders, NO subscription_payment
    mongo_db.users.insert_one({
        "uid": UID_COMP_1,
        "name": "TEST Comp User 1",
        "email": "test_comp_1@example.com",
        "mobile": "9990000002",
        "subscription_plan": "growth",
        "admin_upgraded": False,
        "admin_fixed": False,
        "created_at": now,
    })

    # TEST 6 comp-2: elite plan with legitimate paid razorpay order
    mongo_db.users.insert_one({
        "uid": UID_COMP_2,
        "name": "TEST Comp User 2",
        "email": "test_comp_2@example.com",
        "mobile": "9990000003",
        "subscription_plan": "elite",
        "admin_upgraded": False,
        "admin_fixed": False,
        "created_at": now,
    })
    mongo_db.razorpay_orders.insert_one({
        "order_id": ORDER_COMP_2_PAID,
        "user_id": UID_COMP_2,
        "status": "paid",
        "amount": 3000,
        "created_at": now,
    })

    yield

    # teardown
    mongo_db.users.delete_many({"uid": {"$in": [UID_AUDIT_1, UID_COMP_1, UID_COMP_2]}})
    mongo_db.razorpay_orders.delete_many({"user_id": {"$in": [UID_AUDIT_1, UID_COMP_1, UID_COMP_2]}})


# ═════════════════════ WEBHOOK TESTS (1–3) ═══════════════════════════════
class TestWebhookSignatureEnforcement:
    """Verify webhook rejects unsigned/wrong-signed payloads.
    Historical bug: activation accepted with missing signature."""

    _payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {
            "order_id": "order_test_fake",
            "id": "pay_test_fake",
            "amount": 30000
        }}}
    }

    def test_1_webhook_missing_signature_returns_401(self):
        body = json.dumps(self._payload).encode()
        r = requests.post(
            WEBHOOK_URL,
            data=body,
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"
        assert "Missing webhook signature" in r.text, f"Unexpected body: {r.text[:200]}"

    def test_2_webhook_wrong_signature_returns_401(self):
        body = json.dumps(self._payload).encode()
        r = requests.post(
            WEBHOOK_URL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": "0" * 64,
            },
            timeout=15,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"
        assert "Invalid webhook signature" in r.text, f"Unexpected body: {r.text[:200]}"

    def test_3_webhook_correct_signature_returns_200(self):
        assert RZP_WEBHOOK_SECRET, "RAZORPAY_WEBHOOK_SECRET not loaded from .env"
        body = json.dumps(self._payload).encode()
        sig = hmac.new(
            RZP_WEBHOOK_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        r = requests.post(
            WEBHOOK_URL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": sig,
            },
            timeout=20,
        )
        # Sig accepted; internal processing may return 200 (fake order not found
        # but processing exits gracefully). Anything != 401 confirms sig passed.
        assert r.status_code != 401, (
            f"Correct signature rejected: {r.status_code} {r.text[:200]}"
        )
        assert r.status_code == 200, (
            f"Expected 200 after valid sig, got {r.status_code}: {r.text[:200]}"
        )


# ═════════════════════ FIX-CANCELLED TESTS (4) ═══════════════════════════
class TestFixCancelledSubscriptions:

    def test_4_uid_vs_user_id_fix_detects_affected(self, mongo_db):
        r = requests.post(
            FIX_URL,
            json={"admin_pin": "123456", "dry_run": True},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("success") is True
        assert data["summary"]["affected_users_count"] >= 1, (
            f"affected_users_count should be >=1 (uid-fix), got: {data['summary']}"
        )
        uids = [u.get("user_id") for u in data.get("affected_users", [])]
        assert UID_AUDIT_1 in uids, (
            f"Test uid {UID_AUDIT_1} missing from affected_users. Got: {uids[:10]}"
        )
        # Verify current_plan populated
        matching = [u for u in data["affected_users"] if u.get("user_id") == UID_AUDIT_1]
        assert matching and matching[0].get("current_plan") == "elite"


# ═════════════════════ AUDIT-CANCELLED-ELITE (5) ═════════════════════════
class TestAuditCancelledElite:

    def test_5_uid_vs_user_id_fix_lists_suspicious(self):
        r = requests.post(
            AUDIT_ELITE_URL,
            json={"admin_pin": "123456"},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("success") is True
        total = data["summary"].get("total_elite_users_with_cancelled_orders", 0)
        assert total >= 1, f"Expected >=1 total_elite_users, got {total}"
        suspicious_uids = [u.get("user_id") for u in data.get("suspicious_users", [])]
        assert UID_AUDIT_1 in suspicious_uids, (
            f"Test uid {UID_AUDIT_1} not in suspicious. Got: {suspicious_uids[:10]}"
        )


# ═════════════════════ COMPREHENSIVE AUDIT (6, 7, 8) ═════════════════════
class TestAuditPaidPlansWithoutPayment:

    def test_6_dry_run_identifies_comp1_excludes_comp2(self):
        r = requests.post(
            AUDIT_PAID_URL,
            json={"admin_pin": "123456", "dry_run": True},
            timeout=60,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("success") is True
        susp_uids = [u.get("uid") for u in data.get("suspicious_users", [])]
        assert UID_COMP_1 in susp_uids, (
            f"comp-1 (no paid orders) missing from suspicious. Got sample: {susp_uids[:20]}"
        )
        assert UID_COMP_2 not in susp_uids, (
            f"comp-2 (has legit paid order) INCORRECTLY flagged suspicious!"
        )
        # Reason check for comp-1
        c1 = next((u for u in data["suspicious_users"] if u.get("uid") == UID_COMP_1), None)
        assert c1 is not None
        assert c1.get("reason") == "on_paid_plan_no_paid_orders_no_prc_payment", (
            f"Unexpected reason: {c1.get('reason')}"
        )

    def test_7_dry_run_does_not_write(self, mongo_db):
        # comp-1 should STILL be on 'growth' after dry_run in test_6
        user = mongo_db.users.find_one({"uid": UID_COMP_1})
        assert user is not None
        assert user.get("subscription_plan") == "growth", (
            f"dry_run=true modified data! plan is now {user.get('subscription_plan')}"
        )
        assert user.get("admin_fixed") is not True

    def test_8_actual_fix_downgrades_comp1_only(self, mongo_db):
        r = requests.post(
            AUDIT_PAID_URL,
            json={"admin_pin": "123456", "dry_run": False},
            timeout=60,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("success") is True
        assert data.get("dry_run") is False

        # comp-1 must now be explorer with admin_fixed=True
        c1 = mongo_db.users.find_one({"uid": UID_COMP_1})
        assert c1 is not None
        assert c1.get("subscription_plan") == "explorer", (
            f"comp-1 NOT downgraded: plan={c1.get('subscription_plan')}"
        )
        assert c1.get("admin_fixed") is True
        assert c1.get("previous_plan_at_downgrade") == "growth"

        # comp-2 must remain elite (legitimate paid)
        c2 = mongo_db.users.find_one({"uid": UID_COMP_2})
        assert c2 is not None
        assert c2.get("subscription_plan") == "elite", (
            f"comp-2 (legit paid) was INCORRECTLY downgraded to {c2.get('subscription_plan')}!"
        )


# ═════════════════════ ADMIN PIN ENFORCEMENT (9) ═════════════════════════
class TestAdminPinEnforcement:

    @pytest.mark.parametrize("url", [FIX_URL, AUDIT_ELITE_URL, AUDIT_PAID_URL])
    def test_9a_wrong_pin_returns_403(self, url):
        r = requests.post(url, json={"admin_pin": "wrong"}, timeout=15)
        assert r.status_code == 403, f"{url} wrong pin -> {r.status_code}: {r.text[:200]}"

    @pytest.mark.parametrize("url", [FIX_URL, AUDIT_ELITE_URL, AUDIT_PAID_URL])
    def test_9b_missing_pin_returns_403(self, url):
        r = requests.post(url, json={}, timeout=15)
        assert r.status_code == 403, f"{url} missing pin -> {r.status_code}: {r.text[:200]}"


# ═════════════════════ NON-REGRESSION (10) ═══════════════════════════════
class TestCreateOrderNoRegression:

    def test_10_create_order_endpoint_healthy(self):
        # Deliberately send invalid body → expect 422 (validation), NOT 5xx.
        # This confirms endpoint is mounted, dependencies wired, no crash.
        r = requests.post(CREATE_ORDER_URL, json={}, timeout=15)
        assert r.status_code < 500, (
            f"create-order returned server error {r.status_code}: {r.text[:200]}"
        )
        # 422 is FastAPI Pydantic validation for missing fields — healthy path
        assert r.status_code in (400, 422, 403), (
            f"Unexpected status for empty body: {r.status_code}: {r.text[:200]}"
        )
