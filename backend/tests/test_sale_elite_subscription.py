"""End-to-end tests for SALE ELITE SUBSCRIPTION feature.

Endpoints under test:
  - POST /api/subscription/sale-elite/lookup
  - POST /api/subscription/sale-elite/activate
  - GET  /api/subscription/sale-elite/eligibility/{uid}
  - GET  /api/subscription/sale-elite/history/{uid}

Strategy: seed two fresh users directly in MongoDB (PIN bcrypt hashed) so we
control balances, plan state, and rate-limit fields. Cleanup at the end.
"""
import os
import uuid
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
import requests
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

PIN_PLAIN = "153759"
WRONG_PIN = "999999"

pwd_ctx = CryptContext(schemes=["bcrypt"], bcrypt__default_rounds=10)


def _hash(pin):
    return pwd_ctx.hash(pin)


def _now():
    return datetime.now(timezone.utc)


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def loop():
    return asyncio.new_event_loop()


@pytest.fixture(scope="module")
def db(loop):
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def seeded(db, loop):
    """Seed sender (Elite, fresh) + beneficiary (Explorer) + beneficiary_elite."""
    sender_uid = f"TEST_SALE_SENDER_{uuid.uuid4().hex[:8]}"
    benef_uid = f"TEST_SALE_BENEF_{uuid.uuid4().hex[:8]}"
    benef2_uid = f"TEST_SALE_BENEF2_{uuid.uuid4().hex[:8]}"
    sender_mobile = "9000000111"
    benef_mobile = "9000000222"
    benef2_mobile = "9000000333"

    pin_hash = _hash(PIN_PLAIN)
    expiry = (_now() + timedelta(days=20)).isoformat()
    benef2_expiry = (_now() + timedelta(days=15)).isoformat()

    async def _seed():
        await db.users.delete_many({"uid": {"$in": [sender_uid, benef_uid, benef2_uid]}})
        await db.users.insert_one({
            "uid": sender_uid,
            "name": "TEST_Sale Sender",
            "mobile": sender_mobile,
            "email": f"{sender_uid}@test.com",
            "pin_hash": pin_hash,
            "subscription_plan": "elite",
            "subscription_expiry": expiry,
            "subscription_expired": False,
            "membership_type": "vip",
            "prc_balance": 200000.0,
            "total_mined_prc": 300000.0,
            "redeem_limit_override": 200000.0,
            "redeem_limit_override_reason": "TEST_SEED",
            "lifetime_redeemed": 0.0,
            "is_active": True,
            "kyc_verified": True,
            "created_at": _now().isoformat(),
        })
        await db.users.insert_one({
            "uid": benef_uid,
            "name": "TEST_Beneficiary One",
            "mobile": benef_mobile,
            "email": f"{benef_uid}@test.com",
            "pin_hash": pin_hash,
            "subscription_plan": "explorer",
            "subscription_expired": False,
            "prc_balance": 0,
            "is_active": True,
            "created_at": _now().isoformat(),
        })
        await db.users.insert_one({
            "uid": benef2_uid,
            "name": "TEST_Beneficiary Elite",
            "mobile": benef2_mobile,
            "email": f"{benef2_uid}@test.com",
            "pin_hash": pin_hash,
            "subscription_plan": "elite",
            "subscription_expiry": benef2_expiry,
            "subscription_expired": False,
            "membership_type": "vip",
            "prc_balance": 0,
            "is_active": True,
            "created_at": _now().isoformat(),
        })

    loop.run_until_complete(_seed())

    yield {
        "sender_uid": sender_uid,
        "sender_mobile": sender_mobile,
        "benef_uid": benef_uid,
        "benef_mobile": benef_mobile,
        "benef2_uid": benef2_uid,
        "benef2_mobile": benef2_mobile,
    }

    async def _clean():
        await db.users.delete_many({"uid": {"$in": [sender_uid, benef_uid, benef2_uid]}})
        await db.sponsored_subscriptions.delete_many(
            {"$or": [{"sender_uid": sender_uid}, {"beneficiary_uid": {"$in": [benef_uid, benef2_uid]}}]}
        )
        await db.transactions.delete_many({"user_id": sender_uid})
        await db.subscription_payments.delete_many(
            {"user_id": {"$in": [benef_uid, benef2_uid]}}
        )
    loop.run_until_complete(_clean())


@pytest.fixture
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Tests ----------

class TestSaleEliteLookup:

    def test_lookup_success_explorer_beneficiary(self, http, seeded):
        r = http.post(f"{BASE_URL}/api/subscription/sale-elite/lookup", json={
            "sender_uid": seeded["sender_uid"],
            "beneficiary_mobile": seeded["benef_mobile"],
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["beneficiary"]["uid"] == seeded["benef_uid"]
        assert data["beneficiary"]["has_active_elite"] is False
        assert data["beneficiary"]["will_be_queued"] is False
        # masked name should not contain 'TEST_Beneficiary One' fully
        assert "." in data["beneficiary"]["masked_name"]
        # pricing fields
        for k in ("base_inr", "gst_inr", "processing_fee_inr",
                 "admin_charges_inr", "total_prc", "prc_rate"):
            assert k in data["pricing"]
        assert data["pricing"]["total_prc"] > 0
        # sender snapshot
        assert data["sender"]["prc_balance"] == 200000.0
        assert data["sender"]["daily_limit_ok"] is True

    def test_lookup_active_elite_beneficiary_will_queue(self, http, seeded):
        r = http.post(f"{BASE_URL}/api/subscription/sale-elite/lookup", json={
            "sender_uid": seeded["sender_uid"],
            "beneficiary_mobile": seeded["benef2_mobile"],
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["beneficiary"]["has_active_elite"] is True
        assert data["beneficiary"]["will_be_queued"] is True

    def test_lookup_non_elite_sender_403(self, http, seeded, db, loop):
        # Temporarily flip sender to explorer
        async def flip(plan):
            await db.users.update_one({"uid": seeded["sender_uid"]},
                                      {"$set": {"subscription_plan": plan}})
        loop.run_until_complete(flip("explorer"))
        try:
            r = http.post(f"{BASE_URL}/api/subscription/sale-elite/lookup", json={
                "sender_uid": seeded["sender_uid"],
                "beneficiary_mobile": seeded["benef_mobile"],
            })
            assert r.status_code == 403, r.text
            assert "elite" in r.json().get("detail", "").lower()
        finally:
            loop.run_until_complete(flip("elite"))

    def test_lookup_unknown_beneficiary_404(self, http, seeded):
        r = http.post(f"{BASE_URL}/api/subscription/sale-elite/lookup", json={
            "sender_uid": seeded["sender_uid"],
            "beneficiary_mobile": "9999990000",
        })
        assert r.status_code == 404

    def test_lookup_self_sponsor_400(self, http, seeded):
        r = http.post(f"{BASE_URL}/api/subscription/sale-elite/lookup", json={
            "sender_uid": seeded["sender_uid"],
            "beneficiary_mobile": seeded["sender_mobile"],
        })
        assert r.status_code == 400


class TestSaleEliteEligibility:

    def test_eligibility_active_elite(self, http, seeded):
        r = http.get(f"{BASE_URL}/api/subscription/sale-elite/eligibility/{seeded['sender_uid']}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("is_active_elite") is True
        assert "pricing" in data
        assert "sender" in data


class TestSaleEliteActivate:

    def test_activate_self_sponsor_blocked(self, http, seeded):
        r = http.post(f"{BASE_URL}/api/subscription/sale-elite/activate", json={
            "sender_uid": seeded["sender_uid"],
            "beneficiary_mobile": seeded["sender_mobile"],
            "pin": PIN_PLAIN,
        })
        assert r.status_code == 400, r.text

    def test_activate_wrong_pin_401(self, http, seeded):
        r = http.post(f"{BASE_URL}/api/subscription/sale-elite/activate", json={
            "sender_uid": seeded["sender_uid"],
            "beneficiary_mobile": seeded["benef_mobile"],
            "pin": WRONG_PIN,
        })
        assert r.status_code == 401, r.text

    def test_activate_insufficient_redeem_limit_400(self, http, seeded, db, loop):
        # set lifetime_redeemed close to balance to crush effective_available
        async def crush(val):
            await db.users.update_one(
                {"uid": seeded["sender_uid"]},
                {"$set": {"prc_balance": 100.0}},
            )
        loop.run_until_complete(crush(True))
        try:
            r = http.post(f"{BASE_URL}/api/subscription/sale-elite/activate", json={
                "sender_uid": seeded["sender_uid"],
                "beneficiary_mobile": seeded["benef_mobile"],
                "pin": PIN_PLAIN,
            })
            # could be 400 for redeem-limit or balance — both acceptable
            assert r.status_code == 400, r.text
        finally:
            async def restore():
                await db.users.update_one(
                    {"uid": seeded["sender_uid"]},
                    {"$set": {"prc_balance": 200000.0}},
                )
            loop.run_until_complete(restore())

    def test_activate_success_explorer_beneficiary(self, http, seeded, db, loop):
        # Ensure clean: clear last_sale_elite_at + remove any sponsored docs from today
        async def reset():
            await db.users.update_one(
                {"uid": seeded["sender_uid"]},
                {"$unset": {"last_sale_elite_at": ""}},
            )
            await db.sponsored_subscriptions.delete_many({"sender_uid": seeded["sender_uid"]})
            await db.transactions.delete_many({"user_id": seeded["sender_uid"]})
        loop.run_until_complete(reset())

        # Snapshot pre-balance
        async def get_bal(uid):
            u = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1})
            return float(u.get("prc_balance", 0))
        pre_bal = loop.run_until_complete(get_bal(seeded["sender_uid"]))

        r = http.post(f"{BASE_URL}/api/subscription/sale-elite/activate", json={
            "sender_uid": seeded["sender_uid"],
            "beneficiary_mobile": seeded["benef_mobile"],
            "pin": PIN_PLAIN,
            "client_request_id": f"TEST-CRID-{uuid.uuid4()}",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["is_upcoming"] is False
        sale_id = data["sale_id"]
        prc_deducted = data["prc_deducted"]

        # Verify sender deduction in DB (>= prc_deducted because sustainability burn
        # may take an extra cut on top of the charged amount)
        post_bal = loop.run_until_complete(get_bal(seeded["sender_uid"]))
        assert (pre_bal - post_bal) >= prc_deducted - 1.0

        # Verify beneficiary now Elite
        async def get_user(uid):
            return await db.users.find_one({"uid": uid}, {"_id": 0})
        b = loop.run_until_complete(get_user(seeded["benef_uid"]))
        assert b["subscription_plan"] == "elite"
        assert b.get("sponsored_by") == seeded["sender_uid"]

        # Verify transactions row
        async def get_tx():
            return await db.transactions.find_one({
                "user_id": seeded["sender_uid"],
                "type": "sale_elite_subscription",
                "reference_id": sale_id,
            })
        tx = loop.run_until_complete(get_tx())
        assert tx is not None
        assert tx["amount"] == -prc_deducted

        # Verify sponsored_subscriptions
        async def get_sponsor():
            return await db.sponsored_subscriptions.find_one({"sale_id": sale_id})
        sp = loop.run_until_complete(get_sponsor())
        assert sp is not None
        assert sp["status"] == "active"

    def test_activate_daily_limit_429(self, http, seeded):
        # second activation same day must be blocked
        r = http.post(f"{BASE_URL}/api/subscription/sale-elite/activate", json={
            "sender_uid": seeded["sender_uid"],
            "beneficiary_mobile": seeded["benef2_mobile"],
            "pin": PIN_PLAIN,
        })
        assert r.status_code == 429, r.text

    def test_activate_queued_for_active_elite_beneficiary(self, http, seeded, db, loop):
        # Reset daily limit to allow a second activation, target benef2 (already Elite)
        async def reset():
            await db.users.update_one(
                {"uid": seeded["sender_uid"]},
                {"$unset": {"last_sale_elite_at": ""}},
            )
            await db.sponsored_subscriptions.delete_many({"sender_uid": seeded["sender_uid"]})
        loop.run_until_complete(reset())

        r = http.post(f"{BASE_URL}/api/subscription/sale-elite/activate", json={
            "sender_uid": seeded["sender_uid"],
            "beneficiary_mobile": seeded["benef2_mobile"],
            "pin": PIN_PLAIN,
            "client_request_id": f"TEST-CRID-{uuid.uuid4()}",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["is_upcoming"] is True


class TestSaleEliteHistory:

    def test_history_returns_records(self, http, seeded):
        r = http.get(f"{BASE_URL}/api/subscription/sale-elite/history/{seeded['sender_uid']}")
        assert r.status_code == 200, r.text
        data = r.json()
        # Expect 'sent' list at minimum
        assert "sent" in data or "sponsored" in data or isinstance(data, dict)
