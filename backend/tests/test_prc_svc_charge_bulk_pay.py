"""Bulk Pay endpoints for PRC Redemption Service Charges."""
import hashlib
import hmac
import os
import uuid
from unittest.mock import patch

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

API = "http://localhost:8001/api"


def _login_admin():
    r = requests.post(f"{API}/auth/login", json={"mobile": "9999999999", "pin": "153759"})
    return r.json().get("token")


@pytest.fixture(scope="module")
def sdb():
    from app.core.database import get_sync_db
    return get_sync_db()


@pytest.fixture
def user_with_two_pending(sdb):
    uid = f"bulk-test-{uuid.uuid4().hex[:8]}"
    sdb.users.update_one(
        {"uid": uid}, {"$set": {"uid": uid, "prc_balance": 100000}}, upsert=True,
    )
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    charges = []
    for i in range(3):
        cid = f"SVC-BULK-{uuid.uuid4().hex[:8].upper()}"
        sdb.redemption_service_charges.insert_one({
            "charge_id": cid, "user_id": uid,
            "redemption_id": f"REF-{i}-{uuid.uuid4().hex[:6]}",
            "redemption_type": "test",
            "prc_amount": (i + 1) * 100, "prc_rate": 10,
            "redemption_value_inr": (i + 1) * 10.0,
            "service_charge_percentage": 20,
            "service_charge_amount": (i + 1) * 2.0,
            "tax_amount": 0, "total_payable": (i + 1) * 2.0,
            "currency": "INR", "status": "PENDING",
            "payment_order_id": None, "payment_id": None,
            "payment_gateway": "razorpay", "payment_attempts": 0,
            "created_at": now, "applicable_at": now,
            "updated_at": now,
        })
        charges.append(cid)
    yield uid, charges
    sdb.users.delete_one({"uid": uid})
    sdb.redemption_service_charges.delete_many({"user_id": uid})
    sdb.service_charge_audit.delete_many({"user_id": uid})


def test_bulk_pay_order_404_when_no_pending():
    r = requests.post(f"{API}/redemption-service-charge/bulk-pay-order",
                       json={"user_id": f"nobody-{uuid.uuid4().hex[:6]}"})
    assert r.status_code == 404


def test_bulk_pay_order_creates_one_order(user_with_two_pending, sdb):
    uid, charge_ids = user_with_two_pending
    # Mock razorpay so we don't hit the network
    mock_order = {"id": "order_test_" + uuid.uuid4().hex[:8], "amount": 1200, "currency": "INR"}
    with patch("razorpay.Client") as MockClient:
        MockClient.return_value.order.create.return_value = mock_order
        r = requests.post(f"{API}/redemption-service-charge/bulk-pay-order",
                           json={"user_id": uid})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["charge_count"] == 3
    assert set(d["charge_ids"]) == set(charge_ids)
    assert d["amount"] == 1200   # ₹2 + ₹4 + ₹6 = ₹12 = 1200 paise
    # All charges should carry the same order_id
    rows = list(sdb.redemption_service_charges.find(
        {"charge_id": {"$in": charge_ids}}, {"payment_order_id": 1, "payment_attempts": 1, "_id": 0},
    ))
    assert all(r["payment_order_id"] == d["order_id"] for r in rows)
    assert all(r["payment_attempts"] == 1 for r in rows)


def test_bulk_verify_marks_all_paid(user_with_two_pending, sdb):
    uid, charge_ids = user_with_two_pending
    # Prime: run bulk-pay-order first
    mock_order = {"id": "order_verify_" + uuid.uuid4().hex[:8], "amount": 1200, "currency": "INR"}
    with patch("razorpay.Client") as MockClient:
        MockClient.return_value.order.create.return_value = mock_order
        r = requests.post(f"{API}/redemption-service-charge/bulk-pay-order",
                           json={"user_id": uid})
    d = r.json()
    order_id = d["order_id"]

    # Compute a valid signature
    secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    payment_id = "pay_" + uuid.uuid4().hex[:12]
    body = f"{order_id}|{payment_id}"
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()

    r2 = requests.post(f"{API}/redemption-service-charge/bulk-verify-payment", json={
        "user_id": uid, "charge_ids": charge_ids,
        "razorpay_order_id": order_id, "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
    })
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["paid_count"] == 3
    assert d2["skipped"] == []

    # Verify DB state
    paid_rows = list(sdb.redemption_service_charges.find(
        {"charge_id": {"$in": charge_ids}}, {"status": 1, "bulk_paid": 1, "_id": 0},
    ))
    assert all(r["status"] == "PAID" for r in paid_rows)
    assert all(r.get("bulk_paid") is True for r in paid_rows)


def test_bulk_verify_rejects_invalid_signature(user_with_two_pending):
    uid, charge_ids = user_with_two_pending
    r = requests.post(f"{API}/redemption-service-charge/bulk-verify-payment", json={
        "user_id": uid, "charge_ids": charge_ids,
        "razorpay_order_id": "order_fake", "razorpay_payment_id": "pay_fake",
        "razorpay_signature": "wrong",
    })
    assert r.status_code == 400
