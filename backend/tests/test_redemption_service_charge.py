"""Tests for PRC Redemption Service Charge module (Spec Point 40 acceptance criteria)."""
import pytest
import asyncio
import importlib.util
import uuid


@pytest.fixture(scope="module")
def mod():
    spec = importlib.util.spec_from_file_location(
        "rsc_test", "/app/backend/routes/redemption_service_charge.py"
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class FakeCursor:
    def __init__(self, rows): self.rows = list(rows)
    def sort(self, *a, **k): return self
    async def to_list(self, n): return self.rows[:n]


class FakeCollection:
    def __init__(self): self.docs = []
    async def find_one(self, q, proj=None):
        for d in self.docs:
            if self._match(d, q): return dict(d)
        return None
    def find(self, q=None, proj=None):
        rows = [d for d in self.docs if self._match(d, q or {})]
        return FakeCursor(rows)
    async def insert_one(self, d):
        # Simulate unique index on redemption_id
        if 'redemption_id' in d:
            for x in self.docs:
                if x.get('redemption_id') == d['redemption_id']:
                    raise Exception("duplicate key redemption_id")
        self.docs.append(dict(d))
    async def update_one(self, q, upd, upsert=False):
        for i, d in enumerate(self.docs):
            if self._match(d, q):
                if "$set" in upd: d.update(upd["$set"])
                if "$inc" in upd:
                    for k, v in upd["$inc"].items(): d[k] = d.get(k, 0) + v
                return type("R", (), {"modified_count": 1})()
        return type("R", (), {"modified_count": 0})()
    def aggregate(self, pipeline):
        return FakeCursor([])
    def _match(self, d, q):
        for k, v in q.items():
            if isinstance(v, dict):
                if "$in" in v and d.get(k) not in v["$in"]: return False
                if "$ne" in v and d.get(k) == v["$ne"]: return False
                if "$gte" in v and d.get(k, "") < v["$gte"]: return False
            elif d.get(k) != v:
                return False
        return True


class FakeDB:
    def __init__(self):
        self.redemption_service_charges = FakeCollection()
        self.service_charge_config = FakeCollection()
        self.service_charge_audit = FakeCollection()


def _run(coro): return asyncio.run(coro)


def test_successful_redemption_creates_one_charge(mod):
    db = FakeDB(); mod.set_db(db)
    uid = "u1"; rid = f"RED-{uuid.uuid4().hex[:6]}"
    out = _run(mod.create_service_charge_on_success(uid, rid, 1000.0, "bank"))
    assert out is not None
    assert out["prc_amount"] == 1000.0
    assert out["prc_rate"] == 10          # Point 10: rate snapshotted
    assert out["redemption_value_inr"] == 100.0
    assert out["service_charge_amount"] == 20.0   # 20% of 100
    assert out["status"] == "PENDING"


def test_idempotent_no_duplicate_on_double_call(mod):
    """Point 17: unique redemption_id → double call returns existing charge."""
    db = FakeDB(); mod.set_db(db)
    uid = "u2"; rid = "RED-XYZ"
    a = _run(mod.create_service_charge_on_success(uid, rid, 1000.0, "bank"))
    b = _run(mod.create_service_charge_on_success(uid, rid, 1000.0, "bank"))
    assert a["charge_id"] == b["charge_id"]
    assert len(db.redemption_service_charges.docs) == 1


def test_has_pending_returns_none_when_no_charge(mod):
    db = FakeDB(); mod.set_db(db)
    out = _run(mod.has_pending_service_charge("nobody"))
    assert out is None


def test_has_pending_returns_charge_when_exists(mod):
    """Point 7/18: pending charge is discoverable so redemption endpoint can block."""
    db = FakeDB(); mod.set_db(db)
    _run(mod.create_service_charge_on_success("u3", "RED-1", 1000.0, "bank"))
    p = _run(mod.has_pending_service_charge("u3"))
    assert p is not None
    assert p["status"] == "PENDING"
    assert p["service_charge_amount"] == 20.0


def test_zero_prc_amount_skipped(mod):
    db = FakeDB(); mod.set_db(db)
    out = _run(mod.create_service_charge_on_success("u4", "RED-Z", 0, "bank"))
    assert out is None
    assert len(db.redemption_service_charges.docs) == 0


def test_min_service_charge_enforced(mod):
    """Very tiny redemption still gets minimum ₹1 fee."""
    db = FakeDB(); mod.set_db(db)
    # 5 PRC = ₹0.50 → 20% = ₹0.10 → floor to min ₹1
    out = _run(mod.create_service_charge_on_success("u5", "RED-tiny", 5.0, "bank"))
    assert out["service_charge_amount"] >= 1.0


def test_10000_prc_calculation(mod):
    """Point 11: 10000 PRC / 10 = ₹1000, 20% = ₹200."""
    db = FakeDB(); mod.set_db(db)
    out = _run(mod.create_service_charge_on_success("u6", "RED-10k", 10000.0, "bank"))
    assert out["redemption_value_inr"] == 1000.0
    assert out["service_charge_amount"] == 200.0


def test_charge_has_all_required_fields(mod):
    """Point 9: spec field list."""
    db = FakeDB(); mod.set_db(db)
    out = _run(mod.create_service_charge_on_success("u7", "RED-full", 1000.0, "bank"))
    required = ["charge_id", "user_id", "redemption_id", "prc_amount", "prc_rate",
                "redemption_value_inr", "service_charge_percentage", "service_charge_amount",
                "tax_amount", "total_payable", "currency", "status",
                "payment_order_id", "payment_id", "payment_gateway", "payment_attempts",
                "created_at", "applicable_at", "paid_at", "updated_at"]
    for k in required:
        assert k in out, f"Missing field: {k}"
    assert out["currency"] == "INR"
    assert out["payment_gateway"] == "razorpay"
    assert out["payment_attempts"] == 0


def test_audit_row_created_on_charge_creation(mod):
    """Point 31: state transitions logged."""
    db = FakeDB(); mod.set_db(db)
    _run(mod.create_service_charge_on_success("u8", "RED-audit", 1000.0, "bank"))
    assert len(db.service_charge_audit.docs) == 1
    a = db.service_charge_audit.docs[0]
    assert a["action"] == "created"
    assert a["new_status"] == "PENDING"


def test_config_defaults_persist(mod):
    """Point 12: config values readable."""
    db = FakeDB(); mod.set_db(db)
    cfg = _run(mod.get_config())
    assert cfg["service_charge_percent"] == 20
    assert cfg["prc_inr_rate"] == 10
