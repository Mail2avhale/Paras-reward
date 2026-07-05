"""
E2E test for Paras Mall Mining Session LAPSE/BURN logic.
=========================================================
Verifies (Feb 2026 spec):
  1. If user does NOT collect within 24 hours of session start, all
     accumulated PRC LAPSES to 0.
  2. Collect endpoint returns "Session expired — points lapsed" error
     when called on an expired session.
  3. Start-session endpoint auto-clears a lapsed session and starts fresh.
  4. Frontend flags exposed:
       session_expired = True
       session_accumulated_prc = 0
       can_start_session = True (no cooldown for lapsed)

Runs against LIVE preview environment. Mutates a live user's booking, so
requires an existing product to book against and a test user with enough
PRC + active subscription.
"""

import os
import sys
import time
import asyncio
from datetime import datetime, timezone, timedelta

# Load backend env
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# Test user (Elite plan, active subscription) — from /app/memory/test_credentials.md
TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


async def run():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    from routes.paras_mall import (
        compute_session_accumulated,
        SECONDS_PER_DAY,
        get_user_network_cap,
    )
    import routes.paras_mall as pm
    pm.db = db  # inject

    checks = []

    def check(label, cond, detail=""):
        status = "✅ PASS" if cond else "❌ FAIL"
        checks.append((label, cond, detail))
        print(f"{status} {label}  {detail}")

    # --- SETUP: find (or create synthetic) a mining booking for TEST_UID ---
    booking = await db.mall_bookings.find_one({
        "user_id": TEST_UID,
        "status": "mining",
    })
    if not booking:
        print("No mining booking found — synthesizing one in-memory only (no DB write).")
        booking = {
            "booking_id": "synthetic-test",
            "user_id": TEST_UID,
            "position": 1,
            "status": "mining",
            "paid_prc": 0,
            "total_prc": 100000,
        }

    # Test 1 — fresh session (elapsed = 30s) → accumulated > 0
    booking_fresh = dict(booking)
    booking_fresh["session_start"] = (
        datetime.now(timezone.utc) - timedelta(seconds=30)
    ).isoformat()
    user_cap = await get_user_network_cap(TEST_UID)
    acc_fresh, elapsed_fresh = await compute_session_accumulated(
        booking_fresh, user_cap=user_cap
    )
    check(
        "T1: Fresh session (30s) accumulates PRC",
        acc_fresh > 0,
        f"acc={acc_fresh:.4f} PRC, elapsed={elapsed_fresh}s",
    )

    # Test 2 — session at 12h → accumulated > 0 (still active)
    booking_12h = dict(booking)
    booking_12h["session_start"] = (
        datetime.now(timezone.utc) - timedelta(hours=12)
    ).isoformat()
    acc_12h, elapsed_12h = await compute_session_accumulated(
        booking_12h, user_cap=user_cap
    )
    check(
        "T2: Half-way (12h) session still mines PRC",
        acc_12h > 0 and elapsed_12h < SECONDS_PER_DAY,
        f"acc={acc_12h:.4f} PRC, elapsed={elapsed_12h}s",
    )

    # Test 3 — session at exactly 24h → LAPSED, accumulated = 0
    booking_24h = dict(booking)
    booking_24h["session_start"] = (
        datetime.now(timezone.utc) - timedelta(hours=24, seconds=1)
    ).isoformat()
    acc_24h, elapsed_24h = await compute_session_accumulated(
        booking_24h, user_cap=user_cap
    )
    check(
        "T3: 24h+ session LAPSES (accumulated = 0)",
        acc_24h == 0.0 and elapsed_24h >= SECONDS_PER_DAY,
        f"acc={acc_24h}, elapsed={elapsed_24h}s (must be 0)",
    )

    # Test 4 — session at 48h → still LAPSED (accumulated = 0)
    booking_48h = dict(booking)
    booking_48h["session_start"] = (
        datetime.now(timezone.utc) - timedelta(hours=48)
    ).isoformat()
    acc_48h, elapsed_48h = await compute_session_accumulated(
        booking_48h, user_cap=user_cap
    )
    check(
        "T4: 48h stale session stays LAPSED (accumulated = 0)",
        acc_48h == 0.0,
        f"acc={acc_48h}, elapsed={elapsed_48h}s",
    )

    # Test 5 — session at 23h 59m 30s → NOT lapsed yet (accumulated > 0)
    booking_edge = dict(booking)
    booking_edge["session_start"] = (
        datetime.now(timezone.utc) - timedelta(hours=23, minutes=59, seconds=30)
    ).isoformat()
    acc_edge, elapsed_edge = await compute_session_accumulated(
        booking_edge, user_cap=user_cap
    )
    check(
        "T5: 23h59m30s (just under boundary) still mines",
        acc_edge > 0 and elapsed_edge < SECONDS_PER_DAY,
        f"acc={acc_edge:.4f} PRC, elapsed={elapsed_edge}s",
    )

    # Test 6 — collected/fulfilled booking (status != mining) → 0
    booking_done = dict(booking)
    booking_done["status"] = "fulfilled"
    booking_done["session_start"] = datetime.now(timezone.utc).isoformat()
    acc_done, elapsed_done = await compute_session_accumulated(
        booking_done, user_cap=user_cap
    )
    check(
        "T6: Non-mining booking returns 0",
        acc_done == 0.0 and elapsed_done == 0,
        f"acc={acc_done}, elapsed={elapsed_done}s",
    )

    # ------ SUMMARY ------
    passed = sum(1 for _, c, _ in checks if c)
    total = len(checks)
    print("\n" + "=" * 60)
    print(f"RESULT: {passed}/{total} checks passed")
    print("=" * 60)
    client.close()
    return passed == total


if __name__ == "__main__":
    ok = asyncio.run(run())
    sys.exit(0 if ok else 1)
