"""
Focused unit tests for Razorpay state-guard fixes.

These tests are fully local (no network calls) and validate:
1. verify-payment rolls order state back from processing on activation failure
2. update-order-status does not downgrade paid/processing orders
"""
import asyncio
import hmac
import hashlib
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from routes import razorpay_payments as rp  # noqa: E402


class DummyRequest:
    def __init__(self, payload):
        self._payload = payload

    async def json(self):
        return self._payload


class DummyUpdateResult:
    def __init__(self, matched_count):
        self.matched_count = matched_count


class FakeVerifyAttemptsCollection:
    async def count_documents(self, _query):
        return 0

    async def insert_one(self, _doc):
        return None


class FakeSimpleCollection:
    async def insert_one(self, _doc):
        return None

    async def find_one(self, _query):
        return None


class FakeUsersForRollback:
    async def find_one(self, query):
        # Both duplicate-payment check and existing user lookup should return no user.
        if query.get("uid") == "test-user" and query.get("last_payment_id"):
            return None
        if query.get("uid") == "test-user":
            return None
        return None

    async def update_one(self, _query, _update):
        # Simulate user missing during activation to trigger rollback.
        return DummyUpdateResult(matched_count=0)


class FakeRazorpayOrdersForRollback:
    def __init__(self):
        self.update_calls = []

    async def find_one(self, query):
        if query.get("order_id") == "order_test_123":
            return {
                "order_id": "order_test_123",
                "user_id": "test-user",
                "plan_type": "monthly",
                "plan_name": "startup",
                "amount": 299,
                "status": "created",
            }
        if query.get("payment_id") == "pay_test_123" and query.get("status") == "paid":
            return None
        return None

    async def find_one_and_update(self, query, _update):
        if query.get("order_id") == "order_test_123":
            return {
                "order_id": "order_test_123",
                "user_id": "test-user",
                "plan_type": "monthly",
                "plan_name": "startup",
                "amount": 299,
                "status": "created",
            }
        return None

    async def update_one(self, query, update):
        self.update_calls.append({"query": query, "update": update})
        return DummyUpdateResult(matched_count=1)


class FakeDbForVerifyRollback:
    def __init__(self):
        self.razorpay_verify_attempts = FakeVerifyAttemptsCollection()
        self.razorpay_orders = FakeRazorpayOrdersForRollback()
        self.users = FakeUsersForRollback()
        self.blocked_payment_attempts = FakeSimpleCollection()
        self.transactions = FakeSimpleCollection()
        self.vip_payments = FakeSimpleCollection()
        self.invoices = FakeSimpleCollection()


class FakePaymentApi:
    def fetch(self, _payment_id):
        return {
            "status": "captured",
            "amount": 29900,
            "captured": True,
        }


class FakeRazorpayClient:
    def __init__(self):
        self.payment = FakePaymentApi()


class FakeRazorpayOrdersForStatusGuard:
    def __init__(self, current_status):
        self.current_status = current_status
        self.update_calls = []

    async def find_one(self, query):
        if query.get("order_id") == "order_guard_1":
            return {"order_id": "order_guard_1", "status": self.current_status}
        return None

    async def update_one(self, query, update):
        self.update_calls.append({"query": query, "update": update})
        return DummyUpdateResult(matched_count=1)


class FakeDbForUpdateStatusGuard:
    def __init__(self, current_status):
        self.razorpay_orders = FakeRazorpayOrdersForStatusGuard(current_status=current_status)


@pytest.fixture
def restore_razorpay_module_state():
    old_db = rp.db
    old_client = rp.razorpay_client
    old_secret = rp.RAZORPAY_KEY_SECRET
    yield
    rp.db = old_db
    rp.razorpay_client = old_client
    rp.RAZORPAY_KEY_SECRET = old_secret


def test_verify_payment_rolls_back_processing_claim_on_activation_failure(restore_razorpay_module_state):
    fake_db = FakeDbForVerifyRollback()
    rp.db = fake_db
    rp.razorpay_client = FakeRazorpayClient()
    rp.RAZORPAY_KEY_SECRET = "unit_test_secret"

    order_id = "order_test_123"
    payment_id = "pay_test_123"
    signature_payload = f"{order_id}|{payment_id}"
    signature = hmac.new(
        rp.RAZORPAY_KEY_SECRET.encode("utf-8"),
        signature_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    request = rp.VerifyPaymentRequest(
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
        razorpay_signature=signature,
        user_id="test-user",
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(rp.verify_razorpay_payment(request))

    assert exc.value.status_code == 404
    assert "User not found" in str(exc.value.detail)

    # Verify rollback was attempted for the claimed processing order.
    assert fake_db.razorpay_orders.update_calls, "Expected rollback update call was not made"
    rollback_call = fake_db.razorpay_orders.update_calls[-1]
    assert rollback_call["query"]["order_id"] == order_id
    assert rollback_call["query"]["status"] == "processing"
    assert rollback_call["query"]["claimed_by"] == "verify_payment"
    assert rollback_call["update"]["$set"]["status"] == "created"
    assert "verification_rollback_reason" in rollback_call["update"]["$set"]


def test_update_order_status_ignores_paid_order_downgrade(restore_razorpay_module_state):
    fake_db = FakeDbForUpdateStatusGuard(current_status="paid")
    rp.db = fake_db

    request = DummyRequest({
        "order_id": "order_guard_1",
        "status": "failed",
        "reason": "client callback",
    })

    result = asyncio.run(rp.update_order_status(request))

    assert result["success"] is True
    assert result["ignored"] is True
    assert result["current_status"] == "paid"
    assert fake_db.razorpay_orders.update_calls == []


def test_update_order_status_ignores_processing_order_downgrade(restore_razorpay_module_state):
    fake_db = FakeDbForUpdateStatusGuard(current_status="processing")
    rp.db = fake_db

    request = DummyRequest({
        "order_id": "order_guard_1",
        "status": "cancelled",
        "reason": "modal closed",
    })

    result = asyncio.run(rp.update_order_status(request))

    assert result["success"] is True
    assert result["ignored"] is True
    assert result["current_status"] == "processing"
    assert fake_db.razorpay_orders.update_calls == []

