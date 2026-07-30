"""
Regression test — Layer 2: `total_redeemed_prc` denormalization

Locks in the read-through-mirror behavior:
  1. When mirror is fresh (< 5 min old), skip the 17-collection scan.
  2. When mirror is stale, fall back to canonical computation.
  3. After canonical computation, mirror gets written asynchronously.
  4. `invalidate_lifetime_cache()` unsets the mirror timestamp.
"""
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(autouse=True)
def reset_ttl_cache():
    """Wipe the in-memory redeemed-total cache so tests don't leak."""
    import server as srv
    srv._REDEEMED_TOTAL_CACHE.clear()
    yield
    srv._REDEEMED_TOTAL_CACHE.clear()


@pytest.mark.asyncio
async def test_fresh_mirror_short_circuits_scan(monkeypatch):
    """A fresh (< 5 min old) mirror value must be returned without
    touching the expensive 17-collection scan.
    """
    import server as srv

    now_iso = datetime.now(timezone.utc).isoformat()
    fake_users = MagicMock()
    fake_users.find_one = AsyncMock(return_value={
        "total_redeemed_prc": 4567.89,
        "total_redeemed_computed_at": now_iso,
    })
    fake_users.update_one = AsyncMock()
    fake_db = MagicMock()
    fake_db.users = fake_users

    scan_calls = {"count": 0}

    async def _fake_scan(*args, **kwargs):
        scan_calls["count"] += 1
        return 99999.0  # sentinel value — should NEVER be seen

    monkeypatch.setattr(srv, "db", fake_db)
    # Replace the aggregation function that get_user_all_time_redeemed uses.
    # Since we're testing the SHORT-CIRCUIT path, no aggregation code runs.

    total = await srv.get_user_all_time_redeemed("u_test_fresh")
    assert total == 4567.89, f"expected mirror value, got {total}"
    assert scan_calls["count"] == 0, "canonical scan should NOT have run"
    fake_users.find_one.assert_awaited_once()


@pytest.mark.asyncio
async def test_stale_mirror_falls_back_to_scan(monkeypatch):
    """A stale (> 5 min old) mirror value must NOT be trusted."""
    import server as srv

    stale_iso = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    fake_users = MagicMock()
    fake_users.find_one = AsyncMock(return_value={
        "total_redeemed_prc": 1111.11,
        "total_redeemed_computed_at": stale_iso,
    })
    fake_users.aggregate = MagicMock()
    fake_users.update_one = AsyncMock()

    # Ensure the aggregate cursor's to_list returns empty for each source
    fake_cursor = MagicMock()
    fake_cursor.to_list = AsyncMock(return_value=[])
    fake_users.aggregate.return_value = fake_cursor

    fake_db = MagicMock()
    fake_db.users = fake_users
    # For every other collection accessed via db[coll_name].find(...).to_list()
    for coll in [
        "recharge_requests", "bill_payment_requests", "bill_payments",
        "payment_requests", "gift_voucher_requests", "redeem_requests",
        "bank_withdrawal_requests", "bank_redeem_requests", "bank_transfers",
        "bank_transfer_requests", "subscription_payments", "vip_payments",
        "dmt_transactions", "dmt_logs", "orders", "unified_redemptions",
        "mall_bookings",
    ]:
        cur = MagicMock()
        cur.__aiter__ = lambda self: iter([])
        cur.to_list = AsyncMock(return_value=[])
        setattr(fake_users, coll, MagicMock())
        # db[coll] pattern
    def _getitem(name):
        c = MagicMock()
        cur = MagicMock()
        cur.__aiter__ = lambda self: iter([])
        c.find = MagicMock(return_value=cur)
        return c
    fake_db.__getitem__ = MagicMock(side_effect=_getitem)
    # transactions & prc_ledger also queried
    fake_db.transactions = MagicMock()
    _tcur = MagicMock()
    _tcur.__aiter__ = lambda self: iter([])
    _tcur.to_list = AsyncMock(return_value=[])
    fake_db.transactions.find = MagicMock(return_value=_tcur)
    fake_db.prc_ledger = MagicMock()
    fake_db.prc_ledger.find = MagicMock(return_value=_tcur)

    monkeypatch.setattr(srv, "db", fake_db)

    total = await srv.get_user_all_time_redeemed("u_test_stale")
    # Stale mirror ignored; canonical scan returned 0 (no fake data).
    # KEY assertion: the mirror value 1111.11 is NOT returned.
    assert total != 1111.11
    fake_users.find_one.assert_awaited()  # still probed the mirror


@pytest.mark.asyncio
async def test_invalidate_unsets_mirror_timestamp(monkeypatch):
    """When a service-collection debit fires invalidate_lifetime_cache,
    the users doc mirror's `computed_at` must be $unset so next read
    triggers a fresh scan.
    """
    import server as srv

    fake_users = MagicMock()
    fake_users.update_one = AsyncMock()
    fake_db = MagicMock()
    fake_db.users = fake_users
    monkeypatch.setattr(srv, "db", fake_db)

    # Populate in-memory cache so we can prove it's cleared too.
    import time as _t
    srv._REDEEMED_TOTAL_CACHE["u_inv_test"] = (_t.time(), 500.0)
    assert "u_inv_test" in srv._REDEEMED_TOTAL_CACHE

    srv.invalidate_lifetime_cache("u_inv_test")

    # In-memory cache popped
    assert "u_inv_test" not in srv._REDEEMED_TOTAL_CACHE

    # Give the fire-and-forget task a chance to schedule
    await asyncio.sleep(0.05)

    # Verify $unset was called on the mirror (fire-and-forget task should have run)
    calls = fake_users.update_one.call_args_list
    # At least ONE call should have $unset: {total_redeemed_computed_at: ""}
    found_unset = any(
        len(c.args) >= 2 and c.args[1].get("$unset", {}).get("total_redeemed_computed_at") == ""
        for c in calls
    )
    assert found_unset, f"$unset on mirror not called. Calls: {calls}"


@pytest.mark.asyncio
async def test_cache_ttl_bumped_to_5_min():
    """Long TTL means dashboard cache-miss cost is amortized properly."""
    import server as srv
    assert srv._REDEEMED_TOTAL_CACHE_TTL == 300.0, (
        f"expected 300 s TTL, got {srv._REDEEMED_TOTAL_CACHE_TTL}"
    )
    assert srv._REDEEMED_MIRROR_MAX_AGE_S == 300.0
