"""E2E integration test — pending PRC service-charge blocks new bank-transfer request.

We seed a PENDING redemption_service_charges row for the primary test user
directly in Mongo, then hit POST /api/bank-transfer/request and expect 402.
After clearing/marking the row PAID, the request should not be blocked
by this rule (may fail for other reasons like KYC, but not with 402 svc-chg).
"""
import os
import pytest
import requests
import asyncio
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

# Load env
try:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip().strip('"')
except Exception:
    pass
try:
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("MONGO_URL="):
                os.environ["MONGO_URL"] = line.split("=", 1)[1].strip().strip('"')
            if line.startswith("DB_NAME="):
                os.environ["DB_NAME"] = line.split("=", 1)[1].strip().strip('"')
except Exception:
    pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # primary cash test user
TEST_MOBILE = "9970100782"
TEST_PIN = "997010"


@pytest.fixture(scope="module")
def user_token():
    r = requests.post(f"{API}/auth/login",
                      json={"mobile": TEST_MOBILE, "pin": TEST_PIN},
                      timeout=30)
    if r.status_code != 200:
        pytest.skip(f"user login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


def _mongo():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


def _seed_pending_charge():
    async def _run():
        client, db = _mongo()
        charge_id = f"SVC-TEST-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        await db.redemption_service_charges.insert_one({
            "charge_id": charge_id,
            "user_id": TEST_UID,
            "redemption_id": f"TEST-REDEEM-{uuid.uuid4().hex[:8]}",
            "prc_amount": 1000.0,
            "prc_rate": 10,
            "redemption_value_inr": 100.0,
            "service_charge_percentage": 20,
            "service_charge_amount": 20.0,
            "tax_amount": 0.0,
            "total_payable": 20.0,
            "currency": "INR",
            "status": "PENDING",
            "payment_order_id": None,
            "payment_id": None,
            "payment_gateway": "razorpay",
            "payment_attempts": 0,
            "created_at": now,
            "applicable_at": now,
            "paid_at": None,
            "updated_at": now,
            "_test_seed": True,
        })
        client.close()
        return charge_id
    return asyncio.run(_run())


def _cleanup_pending():
    async def _run():
        client, db = _mongo()
        await db.redemption_service_charges.delete_many(
            {"user_id": TEST_UID, "_test_seed": True}
        )
        client.close()
    asyncio.run(_run())


def test_pending_charge_blocks_bank_transfer_request(user_token):
    """When user has PENDING svc charge, POST /bank-transfer/request returns 402."""
    _cleanup_pending()
    _seed_pending_charge()
    try:
        r = requests.post(
            f"{API}/bank-transfer/request",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "user_id": TEST_UID,
                "amount": 500,
                "bank_details": {
                    "account_holder_name": "Test User",
                    "account_number": "12345678901",
                    "ifsc_code": "HDFC0001234",
                    "bank_name": "HDFC",
                },
            },
            timeout=30,
        )
        # Expect 402 with pending svc-charge detail
        assert r.status_code == 402, f"expected 402, got {r.status_code}: {r.text[:300]}"
        detail = r.json().get("detail", "")
        assert "Service Charge" in detail or "service charge" in detail.lower(), detail
    finally:
        _cleanup_pending()


def test_after_clearing_pending_not_blocked_by_svc_charge(user_token):
    """After removing the pending svc charge, request no longer blocked by 402."""
    _cleanup_pending()
    r = requests.post(
        f"{API}/bank-transfer/request",
        headers={"Authorization": f"Bearer {user_token}"},
        json={
            "user_id": TEST_UID,
            "amount": 500,
            "bank_details": {
                "account_holder_name": "Test User",
                "account_number": "12345678901",
                "ifsc_code": "HDFC0001234",
                "bank_name": "HDFC",
            },
        },
        timeout=30,
    )
    # Should NOT be 402 (may fail for other reasons like KYC, quota; that's fine)
    assert r.status_code != 402, (
        f"still 402 after clearing pending: {r.text[:300]}"
    )
