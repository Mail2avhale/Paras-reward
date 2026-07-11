"""
IST timezone bucketing tests for /api/referrals/earnings-summary/{uid}.

Verifies that daily/weekly/monthly buckets align to India Standard Time
(UTC+05:30) midnight, not UTC midnight — so users see rollovers at their
local midnight and never experience the previous off-by-hours bug where
IST 00:00–05:29 rewards would land in "yesterday" instead of "today".
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get(
    "TEST_BASE_URL",
    "https://formula-audit-fix.preview.emergentagent.com",
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward_db")

IST = timezone(timedelta(hours=5, minutes=30))


@pytest.fixture
def db():
    client = AsyncIOMotorClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


async def _seed(db, uid: str, ts_utc: datetime, amount: float) -> None:
    await db.prc_ledger.insert_one({
        "txn_id": f"tst-{uuid.uuid4()}",
        "user_id": uid,
        "type": "mining_referral_reward",
        "amount": amount,
        "tier_index": 1,
        "tier_percent": 5.0,
        "downline_uid": "downline-1",
        "downline_name": "Test Downline",
        "downline_collect_amount": amount * 20,
        "timestamp": ts_utc.isoformat(),
        "created_at": ts_utc.isoformat(),
    })


async def _fetch(uid: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{BASE_URL}/api/referrals/earnings-summary/{uid}")
        r.raise_for_status()
        return r.json()


@pytest.mark.asyncio
async def test_ist_bucketing_boundary(db):
    """Rewards timestamped just past IST midnight must land in "today",
    not "yesterday" — which is exactly the bug we fixed.
    """
    uid = f"ist-test-{uuid.uuid4()}"

    # Compute "today at IST 00:15" and "yesterday at IST 23:45" boundaries.
    now_ist = datetime.now(timezone.utc).astimezone(IST)
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)

    # Skip test if we're near month rollover — the yesterday row would fall
    # into a different month and be excluded by the month-scoped query.
    if today_start_ist.day == 1:
        pytest.skip("Skip test near IST month boundary")

    just_after_ist_midnight = (today_start_ist + timedelta(minutes=15)).astimezone(timezone.utc)
    just_before_ist_midnight = (today_start_ist - timedelta(minutes=15)).astimezone(timezone.utc)

    await _seed(db, uid, just_after_ist_midnight, 1.0)   # should be TODAY
    await _seed(db, uid, just_before_ist_midnight, 2.0)  # should be YESTERDAY

    try:
        res = await _fetch(uid)
        assert res["success"] is True
        buckets = res["buckets"]

        assert buckets["today"]["events"] == 1, f"today should have 1 event, got {buckets['today']}"
        assert abs(buckets["today"]["earned_prc"] - 1.0) < 1e-6

        assert buckets["yesterday"]["events"] == 1, f"yesterday should have 1 event, got {buckets['yesterday']}"
        assert abs(buckets["yesterday"]["earned_prc"] - 2.0) < 1e-6

        # this_week should include today's row (and yesterday's if same ISO week)
        assert buckets["this_week"]["events"] >= 1
        assert buckets["this_month"]["events"] == 2
        assert abs(buckets["this_month"]["earned_prc"] - 3.0) < 1e-6
    finally:
        await db.prc_ledger.delete_many({"user_id": uid})


@pytest.mark.asyncio
async def test_utc_late_night_row_is_today_in_ist(db):
    """A row at UTC 22:00 (= IST 03:30 next day) must belong to IST "today".

    Under the old UTC-only logic this row would have been counted in
    "yesterday" incorrectly for any IST user checking after 05:30 IST.
    """
    uid = f"ist-latenight-{uuid.uuid4()}"

    now_ist = datetime.now(timezone.utc).astimezone(IST)
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)

    # Only meaningful when current IST time is already past 05:30 (else
    # the "previous UTC day" would be genuinely yesterday in IST too).
    if now_ist.hour < 6:
        pytest.skip("IST currently pre-06:00; boundary test not applicable")
    if today_start_ist.day == 1:
        pytest.skip("Skip test near IST month boundary")

    # 02:00 IST today  ==  20:30 UTC yesterday
    ist_early_morning = (today_start_ist + timedelta(hours=2)).astimezone(timezone.utc)
    await _seed(db, uid, ist_early_morning, 4.2)

    try:
        res = await _fetch(uid)
        buckets = res["buckets"]
        assert buckets["today"]["events"] == 1, (
            f"Late-night UTC / early-IST-morning row should be TODAY. Got: {buckets}"
        )
        assert abs(buckets["today"]["earned_prc"] - 4.2) < 1e-6
        assert buckets["yesterday"]["events"] == 0
    finally:
        await db.prc_ledger.delete_many({"user_id": uid})


if __name__ == "__main__":
    async def _run():
        client = AsyncIOMotorClient(MONGO_URL)
        d = client[DB_NAME]
        try:
            await test_ist_bucketing_boundary(d)
            print("PASS: test_ist_bucketing_boundary")
            await test_utc_late_night_row_is_today_in_ist(d)
            print("PASS: test_utc_late_night_row_is_today_in_ist")
        finally:
            client.close()
    asyncio.run(_run())
