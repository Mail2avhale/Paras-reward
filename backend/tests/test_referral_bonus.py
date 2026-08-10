"""Tests for referral bonus campaign — helper logic + API surface.
Focus on the pure helper `credit_referral_bonus` since API is admin-JWT-guarded.
"""
import os
import uuid
import pytest
import asyncio
import importlib.util
from datetime import datetime, timezone


BASE = os.environ.get("REACT_APP_BACKEND_URL") or "https://formula-audit-fix.preview.emergentagent.com"


@pytest.fixture(scope="module")
def mod():
    spec = importlib.util.spec_from_file_location(
        "referral_bonus_test", "/app/backend/routes/referral_bonus.py"
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class FakeCursor:
    def __init__(self, rows):
        self.rows = list(rows)
    def sort(self, *args, **kwargs): return self
    async def to_list(self, n): return self.rows[:n]


class FakeCollection:
    def __init__(self):
        self.docs = []
    async def find_one(self, q, proj=None):
        for d in self.docs:
            if self._match(d, q):
                return dict(d)
        return None
    def find(self, q, proj=None):
        return FakeCursor([d for d in self.docs if self._match(d, q)])
    async def insert_one(self, d):
        self.docs.append(dict(d))
    async def update_one(self, q, upd, upsert=False):
        for i, d in enumerate(self.docs):
            if self._match(d, q):
                if "$set" in upd:
                    d.update(upd["$set"])
                self.docs[i] = d
                return type("R", (), {"modified_count": 1})()
        if upsert:
            n = {}
            for k, v in q.items():
                if not isinstance(v, dict):
                    n[k] = v
            if "$set" in upd: n.update(upd["$set"])
            if "$setOnInsert" in upd: n.update(upd["$setOnInsert"])
            self.docs.append(n)
            return type("R", (), {"modified_count": 0})()
        return type("R", (), {"modified_count": 0})()
    async def update_many(self, q, upd):
        n = 0
        for d in self.docs:
            if self._match(d, q):
                if "$set" in upd: d.update(upd["$set"])
                n += 1
        return type("R", (), {"modified_count": n})()
    async def count_documents(self, q):
        return sum(1 for d in self.docs if self._match(d, q))
    def _match(self, d, q):
        for k, v in q.items():
            if isinstance(v, dict):
                # {"$in": [...]} / {"$ne": ...}
                if "$in" in v and d.get(k) not in v["$in"]: return False
                if "$ne" in v and d.get(k) == v["$ne"]: return False
                if "$gte" in v and d.get(k, "") < v["$gte"]: return False
                if "$lte" in v and d.get(k, "") > v["$lte"]: return False
            elif d.get(k) != v:
                return False
        return True


class FakeDB:
    def __init__(self):
        self.referral_bonus_campaigns = FakeCollection()
        self.referral_bonuses = FakeCollection()
        self.users = FakeCollection()
        self.vip_payments = FakeCollection()


@pytest.fixture
def db_():
    d = FakeDB()
    return d


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def _today():
    return datetime.now(timezone.utc).date().isoformat()


def _setup_campaign(db_, mod, enabled=True, amount=200, delta_days=(-1, 30)):
    from datetime import date, timedelta
    today = date.fromisoformat(_today())
    start = (today + timedelta(days=delta_days[0])).isoformat()
    end = (today + timedelta(days=delta_days[1])).isoformat()
    _run(db_.referral_bonus_campaigns.insert_one({
        "_id": mod.DEFAULT_CAMPAIGN_ID,
        "enabled": enabled, "bonus_amount": amount,
        "start_date": start, "end_date": end,
    }))
    return start, end


def _setup_users(db_, referrer_plan="elite"):
    referrer_uid = f"ref-{uuid.uuid4().hex[:6]}"
    new_user_uid = f"new-{uuid.uuid4().hex[:6]}"
    _run(db_.users.insert_one({
        "uid": referrer_uid, "name": "Referrer A", "email": "ref@x.com",
        "mobile": "9111111111", "subscription_plan": referrer_plan,
        "bank_account": "123456789", "bank_ifsc": "HDFC0001234", "bank_name": "HDFC Bank",
    }))
    _run(db_.users.insert_one({
        "uid": new_user_uid, "name": "New B", "referred_by": referrer_uid,
    }))
    # Simulate that the "vip_payment" just got inserted (count=1)
    _run(db_.vip_payments.insert_one({
        "user_id": new_user_uid, "status": "approved", "payment_method": "razorpay",
    }))
    return referrer_uid, new_user_uid


def test_happy_path_bonus_credited(db_, mod):
    _setup_campaign(db_, mod)
    referrer, newu = _setup_users(db_)
    out = _run(mod.credit_referral_bonus(db_, newu, "razorpay", 999, "elite"))
    assert out is not None
    assert out["referrer_uid"] == referrer
    assert out["bonus_amount"] == 200
    assert out["status"] == "pending"
    assert out["referrer_bank_account"] == "123456789"


def test_prc_payment_no_bonus(db_, mod):
    _setup_campaign(db_, mod)
    _, newu = _setup_users(db_)
    out = _run(mod.credit_referral_bonus(db_, newu, "prc", 0, "elite"))
    assert out is None


def test_renewal_no_bonus(db_, mod):
    _setup_campaign(db_, mod)
    _, newu = _setup_users(db_)
    # Insert an EXTRA vip_payment before the current one → renewal
    _run(db_.vip_payments.insert_one({
        "user_id": newu, "status": "approved", "payment_method": "razorpay",
    }))
    out = _run(mod.credit_referral_bonus(db_, newu, "razorpay", 999, "elite"))
    assert out is None


def test_no_referrer_no_bonus(db_, mod):
    _setup_campaign(db_, mod)
    orphan = "orphan-" + uuid.uuid4().hex[:6]
    _run(db_.users.insert_one({"uid": orphan, "name": "Solo"}))
    _run(db_.vip_payments.insert_one({"user_id": orphan, "status": "approved", "payment_method": "razorpay"}))
    out = _run(mod.credit_referral_bonus(db_, orphan, "razorpay", 999, "elite"))
    assert out is None


def test_self_referral_blocked(db_, mod):
    _setup_campaign(db_, mod)
    u = "self-" + uuid.uuid4().hex[:6]
    _run(db_.users.insert_one({"uid": u, "name": "Self", "referred_by": u, "subscription_plan": "elite"}))
    _run(db_.vip_payments.insert_one({"user_id": u, "status": "approved", "payment_method": "razorpay"}))
    out = _run(mod.credit_referral_bonus(db_, u, "razorpay", 999, "elite"))
    assert out is None


def test_idempotent(db_, mod):
    _setup_campaign(db_, mod)
    _, newu = _setup_users(db_)
    out1 = _run(mod.credit_referral_bonus(db_, newu, "razorpay", 999, "elite"))
    out2 = _run(mod.credit_referral_bonus(db_, newu, "razorpay", 999, "elite"))
    assert out1 is not None
    assert out2 is None   # duplicate blocked


def test_unpaid_referrer_no_bonus(db_, mod):
    _setup_campaign(db_, mod)
    _, newu = _setup_users(db_, referrer_plan="explorer")
    out = _run(mod.credit_referral_bonus(db_, newu, "razorpay", 999, "elite"))
    assert out is None


def test_campaign_disabled_no_bonus(db_, mod):
    _setup_campaign(db_, mod, enabled=False)
    _, newu = _setup_users(db_)
    out = _run(mod.credit_referral_bonus(db_, newu, "razorpay", 999, "elite"))
    assert out is None


def test_campaign_expired_no_bonus(db_, mod):
    _setup_campaign(db_, mod, delta_days=(-30, -10))   # ended 10 days ago
    _, newu = _setup_users(db_)
    out = _run(mod.credit_referral_bonus(db_, newu, "razorpay", 999, "elite"))
    assert out is None


def test_manual_activation_works(db_, mod):
    _setup_campaign(db_, mod)
    _, newu = _setup_users(db_)
    # override the payment method on the vip_payment
    db_.vip_payments.docs[-1]["payment_method"] = "manual_activation"
    out = _run(mod.credit_referral_bonus(db_, newu, "manual_activation", 0, "elite"))
    assert out is not None
    assert out["payment_method"] == "manual_activation"
