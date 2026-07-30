"""
Regression test — Mall subscription gate self-heals stale
`subscription_expired: True` flag when canonical plan+expiry says active.

Root cause (Feb 23 2026): Razorpay auto-sync path activated the sub
but forgot to reset the mirror flag. User ashataipawar6@gmail.com had
Elite active on home page but Mall said "expired".
"""
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils.subscription_status import (  # noqa: E402
    is_active_subscription,
    is_stale_expired_flag,
    self_heal_if_stale,
)


def _mk_user(**overrides):
    base = {
        "uid": "u_test_1",
        "subscription_plan": "elite",
        "subscription_expiry": (datetime.now(timezone.utc) + timedelta(days=26)).isoformat(),
        "subscription_expired": False,
    }
    base.update(overrides)
    return base


def test_active_paid_plan_with_future_expiry_is_active():
    assert is_active_subscription(_mk_user()) is True


def test_expired_plan_is_inactive():
    user = _mk_user(
        subscription_expiry=(datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    )
    assert is_active_subscription(user) is False


def test_free_plan_is_inactive_regardless_of_flag():
    for plan in ["explorer", "free", "", "none"]:
        user = _mk_user(subscription_plan=plan)
        assert is_active_subscription(user) is False, f"{plan} should be inactive"


def test_canonical_beats_stale_expired_flag():
    """This is THE bug we're fixing — Elite user with future expiry
    should be ACTIVE even when the mirror flag is stuck at True."""
    user = _mk_user(subscription_expired=True)  # stale flag
    assert is_active_subscription(user) is True
    assert is_stale_expired_flag(user) is True


def test_no_stale_flag_when_flag_is_false():
    """Regular case: healthy state, no heal needed."""
    user = _mk_user(subscription_expired=False)
    assert is_stale_expired_flag(user) is False


def test_no_stale_flag_when_actually_expired():
    """Genuinely expired user with True flag: not stale, don't heal."""
    user = _mk_user(
        subscription_expiry=(datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
        subscription_expired=True,
    )
    assert is_stale_expired_flag(user) is False


@pytest.mark.asyncio
async def test_self_heal_writes_correction():
    """When called with a stale-flag user, must run a users.update_one."""
    user = _mk_user(subscription_expired=True)
    fake_db = MagicMock()
    fake_db.users.update_one = AsyncMock()
    healed = await self_heal_if_stale(fake_db, user)
    assert healed is True
    fake_db.users.update_one.assert_awaited_once()
    call = fake_db.users.update_one.call_args
    assert call.args[0] == {"uid": "u_test_1"}
    set_op = call.args[1]["$set"]
    assert set_op["subscription_expired"] is False
    assert set_op["subscription_expired_at"] is None
    assert set_op["subscription_status"] == "active"
    # In-memory dict mutated so downstream reads see the fix.
    assert user["subscription_expired"] is False


@pytest.mark.asyncio
async def test_self_heal_skips_healthy_user():
    """Non-stale user must NOT trigger a write."""
    user = _mk_user(subscription_expired=False)
    fake_db = MagicMock()
    fake_db.users.update_one = AsyncMock()
    healed = await self_heal_if_stale(fake_db, user)
    assert healed is False
    fake_db.users.update_one.assert_not_awaited()


@pytest.mark.asyncio
async def test_self_heal_skips_expired_user():
    """Genuinely expired user with True flag — do NOT re-activate."""
    user = _mk_user(
        subscription_expiry=(datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
        subscription_expired=True,
    )
    fake_db = MagicMock()
    fake_db.users.update_one = AsyncMock()
    healed = await self_heal_if_stale(fake_db, user)
    assert healed is False
    fake_db.users.update_one.assert_not_awaited()
