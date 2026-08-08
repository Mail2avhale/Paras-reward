"""
Feb 27, 2026 — Mall mining formula: 24h → 8h session + global N cap = 500.

Design rationale in PRD:
  * Session LAPSE window: 86 400 s → 28 800 s (24h → 8h). Per-second
    rate stays the same (`daily_rate / 86400`) so a diligent user's
    total daily earnings are unchanged; they just collect 3× more often
    (higher engagement + AdMob impressions).
  * N (downstream bookings after this one) is capped at a GLOBAL 500 for
    every user regardless of tier — replaces the tier-based user_cap
    (800-8000) that let VIP users mine 12-16× faster than Explorer.
    Everyone hits the same 500-user ceiling.

Contract tests:
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except Exception:
    pass
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-mall-formula")


def test_session_duration_is_8_hours():
    from routes import paras_mall
    assert paras_mall.SESSION_DURATION_HOURS == 8
    assert paras_mall.SESSION_LAPSE_SECONDS == 8 * 3600
    assert paras_mall.SESSION_LAPSE_SECONDS == 28_800


def test_seconds_per_day_still_24h_for_rate_denominator():
    """Per-second rate MUST stay at daily_rate / 86400 so a full 8h
    session gives 1/3rd of daily_rate (Option A — engagement, not
    inflation)."""
    from routes import paras_mall
    assert paras_mall.SECONDS_PER_DAY == 86_400


def test_global_mall_n_cap_is_500():
    from routes import paras_mall
    assert paras_mall.GLOBAL_MALL_N_CAP == 500


def test_lapse_window_is_less_than_full_day():
    """Sanity: the new LAPSE ceiling must be a subset of the daily
    denominator so max session ~= 1/3 of daily_rate."""
    from routes import paras_mall
    ratio = paras_mall.SESSION_LAPSE_SECONDS / paras_mall.SECONDS_PER_DAY
    # 8/24 ≈ 0.3333
    assert abs(ratio - (1 / 3)) < 0.01, (
        f"session/day ratio drifted to {ratio:.4f} — Option A expects "
        f"~1/3 so a diligent user needs 3 sessions/day for the same "
        f"total earnings as the old 24h flow"
    )


def test_daily_rate_formula_uses_global_cap_not_user_cap():
    """Source-code contract: `get_daily_rate_for_booking` must apply
    `GLOBAL_MALL_N_CAP` FIRST, then optionally clamp by user_cap. If
    someone re-orders these or removes the global cap, this test
    blocks the merge.
    """
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "paras_mall.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()

    idx = src.find("async def get_daily_rate_for_booking(")
    assert idx > 0
    body = src[idx : idx + 3000]
    assert "N = min(N_raw, GLOBAL_MALL_N_CAP)" in body, (
        "get_daily_rate_for_booking must clamp N by GLOBAL_MALL_N_CAP"
    )


def test_prc_per_user_unchanged_for_now():
    """The PRC-per-user formula `max(2.5, 5 × (21 - log₂N)/14)` is
    unchanged in this pass (Feb 27 2026 request was only N cap + 8h).
    """
    import math
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "paras_mall.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()
    idx = src.find("async def get_daily_rate_for_booking(")
    body = src[idx : idx + 3000]
    # Both constants must survive as literals so future edits show up
    # cleanly in diff review.
    assert "max(2.5, 5.0 * (21.0 - math.log2(N)) / 14.0)" in body
    # sanity of the math itself for N=100
    prc = max(2.5, 5.0 * (21.0 - math.log2(100)) / 14.0)
    assert 5.0 < prc < 5.3
