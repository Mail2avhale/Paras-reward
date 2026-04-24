"""
Regression test: Refund double-counting bug in get_user_all_time_redeemed
=========================================================================
Bug: Production user's "Total Redeemed" showed 0 PRC on Home dashboard
and Redeem Used Details page, even though the per-category breakdown
clearly showed tens of thousands of PRC redeemed across Bank Redeem,
Subscription, and Bill Pay.

Root cause: When a refund is recorded in BOTH `transactions` collection
(type in REFUND_TYPES) AND `prc_ledger` (type: 'refund') for the same
logical refund event, the previous code only deduped by exact reference_id
match. But the two collections use DIFFERENT reference schemes
(`BWR-...` / `WD-...` vs `RDM-...`), so the dedup missed them and refunds
were counted TWICE. With enough partial refunds, debits - (refunds × 2)
dropped to 0 or negative, which was then clamped to 0 by `max(0, ...)`.

Fix: Added (rounded_amount_prc, YYYY-MM-DD) fallback dedup for refunds —
same approach already used for debits (Layer 3 wallet_day_amounts).
Now Layer 2 prc_ledger refund scan skips any refund whose
(amount, day) tuple already appears in Layer 1 transactions refunds.
Also supports historical `amount_prc` field (some legacy refund entries).
"""
import asyncio
import sys

sys.path.insert(0, "/app/backend")


async def _cleanup(db, uid):
    for coll in [
        "transactions", "prc_ledger", "bank_transfer_requests",
        "subscription_payments", "bill_payment_requests",
    ]:
        await db[coll].delete_many({"user_id": uid})


async def test_refund_double_count_via_ref_mismatch():
    """Refund in both collections with different ref schemes must be counted once."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_refund_ref_mismatch__"
    await _cleanup(db, uid)
    try:
        await db.transactions.insert_many([
            {"user_id": uid, "type": "bank_withdrawal", "amount": 10000.0,
             "reference_id": "BWR-001", "created_at": "2026-01-15T10:00:00+00:00"},
            {"user_id": uid, "type": "bank_withdrawal_refund", "amount": 10000.0,
             "reference_id": "BWR-001", "created_at": "2026-01-15T11:00:00+00:00"},
        ])
        # Same refund in prc_ledger but with a DIFFERENT reference scheme
        await db.prc_ledger.insert_one({
            "user_id": uid, "type": "refund", "amount": 10000.0,
            "reference": "RDM-XYZ-001", "created_at": "2026-01-15T11:05:00+00:00"
        })

        total, info = await get_user_all_time_redeemed(uid, debug=True)
        assert total == 0.0, f"Expected 0 (10000 debit - 10000 refund), got {total}"
        assert info["total_refunds_prc"] == 10000.0, (
            f"Refund should be 10000 (not doubled to 20000); got {info['total_refunds_prc']}"
        )
    finally:
        await _cleanup(db, uid)


async def test_partial_refund_preserves_debit_amount():
    """A partial refund recorded twice must not wipe the entire debit."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_partial_refund__"
    await _cleanup(db, uid)
    try:
        await db.transactions.insert_many([
            {"user_id": uid, "type": "bank_withdrawal", "amount": 18365.0,
             "reference_id": "BTR-A1", "created_at": "2026-01-10T10:00:00+00:00"},
            {"user_id": uid, "type": "subscription_prc", "amount": 16477.05,
             "reference_id": "SUB-A1", "created_at": "2026-01-12T10:00:00+00:00"},
            {"user_id": uid, "type": "bill_payment", "amount": 7155.20,
             "reference_id": "BILL-A1", "created_at": "2026-01-15T10:00:00+00:00"},
            {"user_id": uid, "type": "admin_refund", "amount": 5000.0,
             "reference_id": "REF-X1", "created_at": "2026-01-20T10:00:00+00:00"},
        ])
        await db.prc_ledger.insert_one({
            "user_id": uid, "type": "refund", "amount": 5000.0,
            "reference": "RDM-REF-X1", "created_at": "2026-01-20T10:05:00+00:00"
        })

        total = await get_user_all_time_redeemed(uid)
        expected = 18365.0 + 16477.05 + 7155.20 - 5000.0
        assert abs(total - expected) < 0.1, (
            f"Expected {expected:.2f} (3 debits - 1 refund), got {total}. "
            f"Previous bug double-counted refund → net dropped close to 0."
        )
    finally:
        await _cleanup(db, uid)


async def test_refund_legacy_amount_prc_field():
    """Historical `withdrawal_refund` entries store PRC in `amount_prc`, not `amount`."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_legacy_amount_prc__"
    await _cleanup(db, uid)
    try:
        await db.transactions.insert_many([
            {"user_id": uid, "type": "bank_withdrawal", "amount": 7000.0,
             "reference_id": "WD-001", "created_at": "2026-02-01T10:00:00+00:00"},
            {"user_id": uid, "type": "withdrawal_refund", "amount_prc": 5000.0,
             "reference_id": "WD-001", "created_at": "2026-02-02T10:00:00+00:00"},
        ])
        total = await get_user_all_time_redeemed(uid)
        assert total == 2000.0, (
            f"Expected 2000 (7000 debit - 5000 refund via amount_prc); got {total}"
        )
    finally:
        await _cleanup(db, uid)


async def test_no_refund_unchanged():
    """Users with no refunds should still get their full debits counted (no regression)."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_no_refund__"
    await _cleanup(db, uid)
    try:
        await db.transactions.insert_many([
            {"user_id": uid, "type": "bank_withdrawal", "amount": 15000.0,
             "reference_id": "CLEAN-1", "created_at": "2026-02-10T10:00:00+00:00"},
        ])
        total = await get_user_all_time_redeemed(uid)
        assert total == 15000.0, f"Clean user should have full debit; got {total}"
    finally:
        await _cleanup(db, uid)


async def _run_all():
    await test_refund_double_count_via_ref_mismatch()
    await test_partial_refund_preserves_debit_amount()
    await test_refund_legacy_amount_prc_field()
    await test_no_refund_unchanged()


if __name__ == "__main__":
    asyncio.run(_run_all())
    print("All refund-double-count regression tests PASSED")
