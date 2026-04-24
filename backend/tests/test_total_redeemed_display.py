"""
Regression test: Total Redeemed display = Redeem Breakdown sum (Feb 2026)
==========================================================================
User requirement:
  "Total Redeemed" on Redeem Used Details page
  "USED"           on Home Dashboard Redeem Limit card
  Both must equal the sum of the "Redeem Breakdown" categories
  (Bank Redeem + Subscription + Bill Pay + Mobile/DTH + Gift + ...).

Root cause of previous bug:
  `get_user_all_time_redeemed` was doing complex refund-netting across
  `transactions` + `prc_ledger` that double-counted refunds when the same
  refund event was recorded in both collections → debits − (refunds × 2) ≤ 0
  → clamped to 0 → "Total Redeemed" showed 0.00 PRC while the breakdown
  clearly listed tens of thousands of PRC spent.

Fix:
  Replaced the 3-layer aggregator with a direct sum of service
  collections — identical to the sum shown in "Redeem Breakdown".
  Uses minute-precision (amount, timestamp) fingerprint to dedup entries
  that appear in multiple service collections (e.g., same bank redeem
  in both `bank_transfer_requests` and `redeem_requests`).
"""
import asyncio
import sys

sys.path.insert(0, "/app/backend")


SERVICE_COLLECTIONS = [
    "recharge_requests", "bill_payment_requests", "bill_payments",
    "payment_requests", "gift_voucher_requests", "redeem_requests",
    "bank_withdrawal_requests", "bank_redeem_requests", "bank_transfers",
    "bank_transfer_requests", "subscription_payments", "vip_payments",
    "dmt_transactions", "dmt_logs", "orders", "unified_redemptions",
    "transactions", "prc_ledger",
]


async def _cleanup(db, uid):
    for coll in SERVICE_COLLECTIONS:
        await db[coll].delete_many({"user_id": uid})


async def test_total_equals_breakdown_sum():
    """The CORE guarantee — Total Redeemed equals sum of services."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_total_equals_breakdown__"
    await _cleanup(db, uid)
    try:
        await db.bank_transfer_requests.insert_one({
            "user_id": uid, "request_id": "BTR-1", "status": "paid",
            "total_prc_deducted": 18365.0,
            "created_at": "2026-01-10T10:00:00+00:00",
        })
        await db.subscription_payments.insert_one({
            "user_id": uid, "payment_id": "SUB-1", "status": "paid",
            "payment_method": "prc", "prc_amount": 16477.05,
            "created_at": "2026-01-12T10:00:00+00:00",
        })
        await db.bill_payment_requests.insert_one({
            "user_id": uid, "request_id": "BILL-1", "status": "completed",
            "total_prc_deducted": 7155.20,
            "created_at": "2026-01-15T10:00:00+00:00",
        })

        total = await get_user_all_time_redeemed(uid)
        expected = 18365.0 + 16477.05 + 7155.20
        assert abs(total - expected) < 0.1, (
            f"Total {total} must equal breakdown sum {expected}"
        )
    finally:
        await _cleanup(db, uid)


async def test_refunds_no_longer_wipe_total_to_zero():
    """Previous bug: partial refunds double-recorded dragged total to 0."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_refunds_dont_zero__"
    await _cleanup(db, uid)
    try:
        # Successful redeems
        await db.bank_transfer_requests.insert_one({
            "user_id": uid, "request_id": "BTR-1", "status": "paid",
            "total_prc_deducted": 25000.0,
            "created_at": "2026-01-10T10:00:00+00:00",
        })
        # Refunds in BOTH transactions and prc_ledger (the bug pattern)
        await db.transactions.insert_many([
            {"user_id": uid, "type": "bank_withdrawal_refund", "amount": 10000.0,
             "reference_id": "BTR-1-refund", "created_at": "2026-01-11T10:00:00+00:00"},
        ])
        await db.prc_ledger.insert_one({
            "user_id": uid, "type": "refund", "amount": 10000.0,
            "reference": "RDM-BTR-1", "created_at": "2026-01-11T10:05:00+00:00",
        })

        total = await get_user_all_time_redeemed(uid)
        # New semantics: refunds DON'T reduce "Total Redeemed" display.
        # Total should equal raw service spend = 25000 (not 0 or negative).
        assert total == 25000.0, (
            f"Total should be raw service spend 25000 (not refund-netted); got {total}"
        )
    finally:
        await _cleanup(db, uid)


async def test_dedup_across_collections():
    """Same bank redeem in both bank_transfer_requests and redeem_requests → counted once."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_dedup_across_collections__"
    await _cleanup(db, uid)
    try:
        # Same redeem, same time, same amount — recorded in two collections
        await db.bank_transfer_requests.insert_one({
            "user_id": uid, "request_id": "BTR-5", "status": "paid",
            "total_prc_deducted": 5000.0,
            "created_at": "2026-02-01T14:30:00+00:00",
        })
        await db.redeem_requests.insert_one({
            "user_id": uid, "redeem_id": "BTR-5", "status": "paid",
            "total_prc_deducted": 5000.0,
            "created_at": "2026-02-01T14:30:00+00:00",
        })

        total = await get_user_all_time_redeemed(uid)
        assert total == 5000.0, (
            f"Same redeem in two collections should count once; got {total}"
        )
    finally:
        await _cleanup(db, uid)


async def test_inr_field_not_used_as_amount():
    """INR fields must NEVER be used as PRC amount (prevents ×rate inflation)."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_no_inr_leak__"
    await _cleanup(db, uid)
    try:
        # A malformed record with only INR-like field
        await db.bank_transfer_requests.insert_one({
            "user_id": uid, "request_id": "BTR-INR", "status": "paid",
            "amount_inr": 5000,  # INR, NOT PRC
            "created_at": "2026-02-05T10:00:00+00:00",
        })
        total = await get_user_all_time_redeemed(uid)
        assert total == 0.0, (
            f"Record with only INR field must not be counted as PRC; got {total}"
        )
    finally:
        await _cleanup(db, uid)


async def test_pending_redeem_counted():
    """Pending redeems ALREADY deducted PRC from wallet — must still count."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_pending_counted__"
    await _cleanup(db, uid)
    try:
        await db.bank_transfer_requests.insert_one({
            "user_id": uid, "request_id": "BTR-P", "status": "pending",
            "total_prc_deducted": 3000.0,
            "created_at": "2026-02-10T10:00:00+00:00",
        })
        total = await get_user_all_time_redeemed(uid)
        assert total == 3000.0, f"Pending redeem must count; got {total}"
    finally:
        await _cleanup(db, uid)


async def test_legacy_admin_debit_counted():
    """Admin-debited PRC (in `transactions`) with no service-collection entry must count."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_admin_debit__"
    await _cleanup(db, uid)
    try:
        await db.transactions.insert_one({
            "user_id": uid, "type": "admin_debit", "amount": 350.0,
            "reference_id": "ADMIN-PENALTY-01",
            "created_at": "2026-01-05T10:00:00+00:00",
            "description": "Manual penalty deduction",
        })
        total = await get_user_all_time_redeemed(uid)
        assert total == 350.0, f"Admin debit must count; got {total}"
    finally:
        await _cleanup(db, uid)


async def test_prc_burn_NOT_counted():
    """Voluntary PRC burns must NOT be counted (per user decision Feb 2026)."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_burn_excluded__"
    await _cleanup(db, uid)
    try:
        await db.transactions.insert_one({
            "user_id": uid, "type": "prc_burn", "amount": 5000.0,
            "reference_id": "BURN-001",
            "created_at": "2026-01-05T10:00:00+00:00",
        })
        await db.bank_transfer_requests.insert_one({
            "user_id": uid, "request_id": "BTR-1", "status": "paid",
            "total_prc_deducted": 2000.0,
            "created_at": "2026-01-10T10:00:00+00:00",
        })
        total = await get_user_all_time_redeemed(uid)
        assert total == 2000.0, (
            f"Burns must NOT count (only the 2000 bank redeem); got {total}"
        )
    finally:
        await _cleanup(db, uid)


async def test_retry_debit_deduped_with_redeem():
    """prc_ledger redeem + retry_debit sharing same reference → counted once."""
    from server import get_user_all_time_redeemed, db
    uid = "__test_retry_debit_dedup__"
    await _cleanup(db, uid)
    try:
        # Same event RDM-XYZ recorded as redeem, refund, AND retry_debit
        await db.prc_ledger.insert_many([
            {"user_id": uid, "type": "redeem", "amount": -1500.0,
             "reference": "RDM-XYZ", "created_at": "2026-02-10T05:00:00+00:00"},
            {"user_id": uid, "type": "refund", "amount": 1500.0,
             "reference": "RDM-XYZ", "created_at": "2026-02-10T05:00:05+00:00"},
            {"user_id": uid, "type": "retry_debit", "amount": -1500.0,
             "reference": "RDM-XYZ", "created_at": "2026-02-10T05:02:00+00:00"},
        ])
        # Also write to service collection (so we know ref is tracked there)
        await db.redeem_requests.insert_one({
            "user_id": uid, "request_id": "RDM-XYZ", "status": "pending",
            "total_prc_deducted": 1500.0,
            "created_at": "2026-02-10T05:00:00+00:00",
        })
        total = await get_user_all_time_redeemed(uid)
        # Only counted ONCE from redeem_requests (1500), not 1500 × 3
        assert total == 1500.0, (
            f"Same-ref retry_debit must dedup vs service entry; got {total}"
        )
    finally:
        await _cleanup(db, uid)


async def _run_all():
    await test_total_equals_breakdown_sum()
    await test_refunds_no_longer_wipe_total_to_zero()
    await test_dedup_across_collections()
    await test_inr_field_not_used_as_amount()
    await test_pending_redeem_counted()
    await test_legacy_admin_debit_counted()
    await test_prc_burn_NOT_counted()
    await test_retry_debit_deduped_with_redeem()


if __name__ == "__main__":
    asyncio.run(_run_all())
    print("All Total Redeemed regression tests PASSED")
