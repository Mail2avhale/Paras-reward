"""
P0 review tests for /api/referrals/earnings-summary/{uid} and
/api/referrals/live-feed/{uid}. Verifies IST bucketing correctness
(the freshly applied bug fix) + defensive behaviour on unknown UIDs.

Follows the review_request from main agent for iter_261.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
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


async def _seed(db, uid: str, ts_utc: datetime, amount: float, downline_uid="dl-1"):
    await db.prc_ledger.insert_one({
        "txn_id": f"p0test-{uuid.uuid4()}",
        "user_id": uid,
        "type": "mining_referral_reward",
        "amount": amount,
        "tier_index": 1,
        "tier_percent": 5.0,
        "downline_uid": downline_uid,
        "downline_name": "Test Downline",
        "downline_collect_amount": amount * 20,
        "timestamp": ts_utc.isoformat(),
        "created_at": ts_utc.isoformat(),
    })


async def _get(path: str) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15) as client:
        return await client.get(f"{BASE_URL}{path}")


# ── IST bucketing correctness ────────────────────────────────────────────
@pytest.mark.asyncio
async def test_ist_boundary_today_vs_yesterday(db):
    """Case 1 from review: seed IST 00:15 today + IST 23:45 yesterday and
    verify today.events == 1 and yesterday.events == 1."""
    uid = f"p0-boundary-{uuid.uuid4()}"
    now_ist = datetime.now(timezone.utc).astimezone(IST)
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)

    if today_start_ist.day == 1:
        pytest.skip("Skip near IST month boundary")

    ist_00_15 = (today_start_ist + timedelta(minutes=15)).astimezone(timezone.utc)
    ist_23_45_yesterday = (today_start_ist - timedelta(minutes=15)).astimezone(timezone.utc)

    await _seed(db, uid, ist_00_15, 1.11)
    await _seed(db, uid, ist_23_45_yesterday, 2.22)

    try:
        r = await _get(f"/api/referrals/earnings-summary/{uid}")
        assert r.status_code == 200
        buckets = r.json()["buckets"]
        assert buckets["today"]["events"] == 1
        assert abs(buckets["today"]["earned_prc"] - 1.11) < 1e-4
        assert buckets["yesterday"]["events"] == 1
        assert abs(buckets["yesterday"]["earned_prc"] - 2.22) < 1e-4
        assert buckets["this_month"]["events"] == 2
    finally:
        await db.prc_ledger.delete_many({"user_id": uid})


@pytest.mark.asyncio
async def test_utc_late_night_is_today_in_ist(db):
    """Case 2 from review: row at UTC 22:00 yesterday (= IST 03:30 today)
    MUST count under today. Only meaningful when IST >= 06:00."""
    uid = f"p0-utc-late-{uuid.uuid4()}"
    now_ist = datetime.now(timezone.utc).astimezone(IST)
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)

    if now_ist.hour < 6:
        pytest.skip("IST pre-06:00 — boundary not testable")
    if today_start_ist.day == 1:
        pytest.skip("Skip near IST month boundary")

    ist_03_30_today = (today_start_ist + timedelta(hours=3, minutes=30)).astimezone(timezone.utc)
    # sanity: should equal UTC 22:00 yesterday
    assert ist_03_30_today.hour == 22

    await _seed(db, uid, ist_03_30_today, 4.20)

    try:
        r = await _get(f"/api/referrals/earnings-summary/{uid}")
        assert r.status_code == 200
        buckets = r.json()["buckets"]
        assert buckets["today"]["events"] == 1, f"expected today=1, got {buckets}"
        assert abs(buckets["today"]["earned_prc"] - 4.20) < 1e-4
        assert buckets["yesterday"]["events"] == 0
    finally:
        await db.prc_ledger.delete_many({"user_id": uid})


# ── Defensive behaviour ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_earnings_summary_unknown_uid_returns_zeros():
    uid = f"unknown-uid-{uuid.uuid4()}"
    r = await _get(f"/api/referrals/earnings-summary/{uid}")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["uid"] == uid
    for k in ["today", "yesterday", "this_week", "this_month"]:
        assert body["buckets"][k]["earned_prc"] == 0
        assert body["buckets"][k]["events"] == 0


@pytest.mark.asyncio
async def test_live_feed_unknown_uid_returns_empty_structure():
    uid = f"unknown-uid-{uuid.uuid4()}"
    r = await _get(f"/api/referrals/live-feed/{uid}?hours=24&limit=50")
    assert r.status_code == 200
    body = r.json()
    # Structure assertions from review request
    for key in ["success", "uid", "window_hours", "count", "total_earned_prc",
                "distinct_downlines", "feed"]:
        assert key in body, f"missing key {key}"
    assert body["success"] is True
    assert body["uid"] == uid
    assert body["window_hours"] == 24
    assert body["count"] == 0
    assert body["total_earned_prc"] == 0
    assert body["distinct_downlines"] == 0
    assert body["feed"] == []


@pytest.mark.asyncio
async def test_live_feed_with_seed_row(db):
    """Feed returns the seeded row within a 24h window."""
    uid = f"p0-feed-{uuid.uuid4()}"
    ts = datetime.now(timezone.utc) - timedelta(hours=1)
    await _seed(db, uid, ts, 0.5, downline_uid=f"dl-{uuid.uuid4()}")
    try:
        r = await _get(f"/api/referrals/live-feed/{uid}?hours=24&limit=50")
        assert r.status_code == 200
        body = r.json()
        assert body["count"] == 1
        assert body["distinct_downlines"] == 1
        assert abs(body["total_earned_prc"] - 0.5) < 1e-4
        assert body["feed"][0]["amount"] == 0.5
    finally:
        await db.prc_ledger.delete_many({"user_id": uid})
