"""E2E test for the universal 20% service charge hook in WalletServiceV2.

Verifies that ANY user-initiated PRC debit through WalletServiceV2.debit()
auto-creates a service charge, and refunds auto-cancel linked charges.
"""
import pytest
import uuid


@pytest.fixture(scope="module")
def wsv2():
    from app.services.wallet_service_v2 import WalletServiceV2
    return WalletServiceV2


@pytest.fixture(scope="module")
def sdb():
    from app.core.database import get_sync_db
    return get_sync_db()


@pytest.fixture
def user(sdb):
    uid = f"svc-univ-test-{uuid.uuid4().hex[:8]}"
    sdb.users.update_one(
        {"uid": uid},
        {"$set": {"uid": uid, "name": "svc test", "prc_balance": 100000}},
        upsert=True,
    )
    yield uid
    sdb.users.delete_one({"uid": uid})
    sdb.redemption_service_charges.delete_many({"user_id": uid})


def _get_charges(sdb, uid):
    return list(sdb.redemption_service_charges.find({"user_id": uid}, {"_id": 0}))


def test_redeem_debit_creates_charge(wsv2, sdb, user):
    ref = f"BILL-{uuid.uuid4().hex[:8]}"
    r = wsv2.debit(user, 1000, "redeem", "bill payment test", reference=ref)
    assert r["success"]
    charges = _get_charges(sdb, user)
    assert len(charges) == 1
    assert charges[0]["status"] == "PENDING"
    assert charges[0]["total_payable"] == 20.0   # 20% of ₹100
    assert charges[0]["redemption_id"] == ref


def test_bank_transfer_debit_skips_hook(wsv2, sdb, user):
    """bank_transfer has its own hook on admin mark-paid — must skip here."""
    ref = f"BANK-{uuid.uuid4().hex[:8]}"
    r = wsv2.debit(user, 500, "bank_transfer", "bank redeem submit", reference=ref)
    assert r["success"]
    charges = _get_charges(sdb, user)
    assert len(charges) == 0


def test_admin_debit_skips_hook(wsv2, sdb, user):
    ref = f"ADMIN-{uuid.uuid4().hex[:8]}"
    r = wsv2.debit(user, 100, "admin_debit", "admin correction", reference=ref)
    assert r["success"]
    assert len(_get_charges(sdb, user)) == 0


def test_transfer_out_skips_hook(wsv2, sdb, user):
    """Peer-to-peer transfers must not charge fees."""
    ref = f"TXFR-{uuid.uuid4().hex[:8]}"
    r = wsv2.debit(user, 100, "transfer_out", "user-to-user", reference=ref)
    assert r["success"]
    assert len(_get_charges(sdb, user)) == 0


def test_monthly_fee_creates_charge(wsv2, sdb, user):
    ref = f"SUB-{uuid.uuid4().hex[:8]}"
    r = wsv2.debit(user, 500, "monthly_fee", "subscription", reference=ref)
    assert r["success"]
    charges = _get_charges(sdb, user)
    assert len(charges) == 1
    assert charges[0]["total_payable"] == 10.0  # 20% of ₹50


def test_skip_via_metadata_opt_out(wsv2, sdb, user):
    ref = f"OPT-{uuid.uuid4().hex[:8]}"
    r = wsv2.debit(user, 200, "redeem", "opt out", reference=ref,
                   metadata={"skip_service_charge": True})
    assert r["success"]
    assert len(_get_charges(sdb, user)) == 0


def test_refund_cancels_linked_charge(wsv2, sdb, user):
    ref = f"RCG-{uuid.uuid4().hex[:8]}"
    wsv2.debit(user, 800, "redeem", "recharge that will fail", reference=ref)
    charges = _get_charges(sdb, user)
    assert len(charges) == 1 and charges[0]["status"] == "PENDING"

    wsv2.credit(user, 800, "refund", "recharge failed - refund", reference=ref)
    charges2 = _get_charges(sdb, user)
    assert len(charges2) == 1 and charges2[0]["status"] == "CANCELLED"


def test_idempotent_on_same_reference(wsv2, sdb, user):
    """Two debits with the same reference create at most one charge."""
    ref = f"IDEM-{uuid.uuid4().hex[:8]}"
    wsv2.debit(user, 100, "redeem", "first", reference=ref)
    wsv2.debit(user, 100, "redeem", "duplicate", reference=ref)
    assert len(_get_charges(sdb, user)) == 1
