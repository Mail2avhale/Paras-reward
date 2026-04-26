"""
Regression test: Sustainability Auto-Burn (1% post-transaction)
================================================================
- Burn 1% of POST-deduction balance for Mobile/DTH/Bank/Subscription success
- Threshold: only if balance > 30,000 PRC after the service deduction
- Idempotent (same service_ref_id never double-burns)
- Refund of source service → reverses burn
- Statement description: "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY"
- get_user_all_time_redeemed must NOT count burns
"""
import asyncio
import sys

sys.path.insert(0, "/app/backend")


async def _create_user(db, uid: str, prc_balance: float):
    """Insert a test user with a unique fake email to avoid index collisions."""
    await db.users.insert_one({
        "uid": uid,
        "email": f"{uid}@test-burn.local",
        "mobile": f"99999{abs(hash(uid)) % 100000:05d}",
        "prc_balance": prc_balance,
    })


async def _cleanup(db, uid):
    for coll in ["prc_ledger", "transactions",
                 "bank_transfer_requests", "subscription_payments",
                 "recharge_requests"]:
        await db[coll].delete_many({"user_id": uid})
    await db.users.delete_many({"uid": uid})


async def test_burn_above_threshold():
    from routes.sustainability_burn import apply_sustainability_burn
    from server import db
    uid = "__test_burn_above_threshold__"
    await _cleanup(db, uid)
    try:
        await _create_user(db, uid, 50000.0)
        result = await apply_sustainability_burn(
            user_id=uid, service_type="mobile_recharge",
            service_ref_id="REQ-001", amount_inr=100,
        )
        assert result["burned"] is True, f"expected burned, got {result}"
        assert result["amount"] == 500.0, f"expected 1% of 50000 = 500, got {result['amount']}"
        assert result["new_balance"] == 49500.0
        # Verify ledger entry
        le = await db.prc_ledger.find_one({"user_id": uid, "type": "auto_burn"})
        assert le is not None, "ledger entry must exist"
        assert le["description"] == "PRC BURN BY APP TO MAINTAIN SUSTAINABILITY"
        assert le["amount"] == -500.0
        assert le["service_ref_id"] == "REQ-001"
        # Verify legacy txns entry
        tx = await db.transactions.find_one({"user_id": uid, "type": "prc_burn"})
        assert tx is not None
    finally:
        await _cleanup(db, uid)


async def test_skip_below_threshold():
    from routes.sustainability_burn import apply_sustainability_burn
    from server import db
    uid = "__test_burn_below_threshold__"
    await _cleanup(db, uid)
    try:
        await _create_user(db, uid, 25000.0)
        result = await apply_sustainability_burn(
            user_id=uid, service_type="dth_recharge",
            service_ref_id="DTH-001",
        )
        assert result["burned"] is False
        assert result["reason"] == "below_threshold"
        # Balance unchanged
        u = await db.users.find_one({"uid": uid})
        assert u["prc_balance"] == 25000.0
        # No ledger entry
        cnt = await db.prc_ledger.count_documents({"user_id": uid})
        assert cnt == 0, f"no burn entry expected, got {cnt}"
    finally:
        await _cleanup(db, uid)


async def test_idempotent_double_call():
    from routes.sustainability_burn import apply_sustainability_burn
    from server import db
    uid = "__test_burn_idempotent__"
    await _cleanup(db, uid)
    try:
        await _create_user(db, uid, 100000.0)
        r1 = await apply_sustainability_burn(uid, "bank_redeem", "BTR-X1")
        r2 = await apply_sustainability_burn(uid, "bank_redeem", "BTR-X1")
        assert r1["burned"] is True
        assert r2["burned"] is False
        assert r2["reason"] == "already_applied"
        cnt = await db.prc_ledger.count_documents({"user_id": uid, "type": "auto_burn"})
        assert cnt == 1, f"only 1 burn entry should exist, got {cnt}"
    finally:
        await _cleanup(db, uid)


async def test_refund_reverses_burn():
    from routes.sustainability_burn import apply_sustainability_burn, reverse_sustainability_burn
    from server import db
    uid = "__test_burn_refund__"
    await _cleanup(db, uid)
    try:
        await _create_user(db, uid, 80000.0)
        r1 = await apply_sustainability_burn(uid, "mobile_recharge", "MR-X1")
        assert r1["burned"] is True
        burned = r1["amount"]  # 800
        assert r1["new_balance"] == 79200.0
        # Refund
        rev = await reverse_sustainability_burn(uid, "mobile_recharge", "MR-X1")
        assert rev["reversed"] is True
        assert rev["amount"] == burned
        u = await db.users.find_one({"uid": uid})
        assert abs(u["prc_balance"] - 80000.0) < 0.01, f"balance restored, got {u['prc_balance']}"
        # Original burn marked reversed
        orig = await db.prc_ledger.find_one({"user_id": uid, "type": "auto_burn"})
        assert orig["reversed"] is True
        # Reversal entry exists
        rev_le = await db.prc_ledger.find_one({"user_id": uid, "type": "auto_burn_reversal"})
        assert rev_le is not None
        assert rev_le["amount"] == burned
    finally:
        await _cleanup(db, uid)


async def test_burn_not_counted_in_total_redeemed():
    from routes.sustainability_burn import apply_sustainability_burn
    from server import db, get_user_all_time_redeemed
    uid = "__test_burn_not_in_redeemed__"
    await _cleanup(db, uid)
    try:
        await _create_user(db, uid, 60000.0)
        # Real redeem
        await db.bank_transfer_requests.insert_one({
            "user_id": uid, "request_id": "BTR-RR1", "status": "paid",
            "total_prc_deducted": 5000.0,
            "created_at": "2026-02-15T10:00:00+00:00",
        })
        # Burn (should NOT count in total_redeemed)
        await apply_sustainability_burn(uid, "bank_redeem", "BTR-RR1-burn")
        total = await get_user_all_time_redeemed(uid)
        assert total == 5000.0, (
            f"Total redeemed should be 5000 (only the bank redeem, NOT burn); got {total}"
        )
    finally:
        await _cleanup(db, uid)


async def _run_all():
    await test_burn_above_threshold()
    await test_skip_below_threshold()
    await test_idempotent_double_call()
    await test_refund_reverses_burn()
    await test_burn_not_counted_in_total_redeemed()


if __name__ == "__main__":
    asyncio.run(_run_all())
    print("All sustainability auto-burn regression tests PASSED")
