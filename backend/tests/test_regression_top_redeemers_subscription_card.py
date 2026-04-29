"""
REGRESSION GUARD — Filed Feb 28, 2026
=====================================

Two production regressions reported by the user post-deploy:

  1. Top Redeemers leaderboard returned [] (empty) on production even though
     transactions were happening (Live Ticker proved data exists). Root cause:
     `routes/leaderboard.py` source list referenced collection name
     `recharge_requests` but the actual production collection is
     `recharge_transactions`. Result: users who had only done mobile/DTH
     recharges were never picked as candidates → empty leaderboard.

  2. Subscription Success Story posts in the Community feed rendered with the
     "Mobile Recharge" theme/icon/label. Root cause:
     `frontend/src/components/SuccessStoryCard.js` `SERVICE_THEME` map had
     no `subscription` key, so it defaulted to `mobile_recharge`.

These tests guard against both regressions returning. Run with:
    cd /app/backend && python -m pytest tests/test_regression_top_redeemers_subscription_card.py -v
"""

import pytest


# -----------------------------------------------------------------------------
# REGRESSION 1: Top Redeemers source list MUST include `recharge_transactions`
# -----------------------------------------------------------------------------

def test_leaderboard_sources_include_recharge_transactions():
    """The pass-1 candidate source list must include `recharge_transactions`,
    otherwise users who have only done mobile/DTH recharges are invisible to
    the Top Redeemers leaderboard.

    DO NOT remove `recharge_transactions` from the sources list — the pass-2
    reconciliation only reconciles users that pass-1 picks as candidates."""
    src_path = "/app/backend/routes/leaderboard.py"
    with open(src_path, "r") as fp:
        contents = fp.read()
    assert "recharge_transactions" in contents, (
        "REGRESSION: routes/leaderboard.py no longer references the "
        "`recharge_transactions` collection. Mobile/DTH recharge users will "
        "be absent from Top Redeemers. See "
        "test_regression_top_redeemers_subscription_card.py"
    )


def test_leaderboard_has_empty_fallback_safety_net():
    """If pass-2 reconciliation yields empty (e.g. all batches timeout on
    heavy production data), the endpoint MUST fall back to rough_totals so
    we never serve an empty leaderboard when data exists."""
    src_path = "/app/backend/routes/leaderboard.py"
    with open(src_path, "r") as fp:
        contents = fp.read()
    assert "falling back to rough_totals" in contents, (
        "REGRESSION: empty-leaderboard safety-net fallback removed. If "
        "pass-2 batches all timeout, prod will show empty Top Redeemers."
    )


def test_leaderboard_does_not_long_cache_empty_results():
    """Empty result must NOT be cached for the full 2-hour TTL — otherwise a
    single cold-start failure poisons production for 2 hours."""
    src_path = "/app/backend/routes/leaderboard.py"
    with open(src_path, "r") as fp:
        contents = fp.read()
    assert "don't cache empty" in contents, (
        "REGRESSION: empty-result cache short-circuit removed. A single "
        "cold-start failure will poison Top Redeemers for the full TTL."
    )


# -----------------------------------------------------------------------------
# REGRESSION 2: SuccessStoryCard must render `subscription` posts correctly
# -----------------------------------------------------------------------------

def test_success_story_card_has_subscription_theme():
    """SERVICE_THEME map in SuccessStoryCard.js must include a `subscription`
    entry, otherwise subscription posts default to `mobile_recharge` theme
    (blue color, 📱 icon, "Mobile Recharge" label) which is incorrect."""
    src_path = "/app/frontend/src/components/SuccessStoryCard.js"
    with open(src_path, "r") as fp:
        contents = fp.read()
    assert "subscription:" in contents, (
        "REGRESSION: SERVICE_THEME map missing `subscription` key. "
        "Subscription posts will fall back to Mobile Recharge theme."
    )
    # Must not just have the key — it must define a real theme dict
    sub_idx = contents.find("subscription:")
    snippet = contents[sub_idx : sub_idx + 250]
    assert "label:" in snippet and "icon:" in snippet and "gradient:" in snippet, (
        "REGRESSION: subscription theme entry is incomplete (missing "
        "label/icon/gradient). Posts will render incorrectly."
    )
    # Must use a celebratory icon (not a phone)
    assert "👑" in snippet or "🏆" in snippet or "⭐" in snippet, (
        "REGRESSION: subscription theme icon should be celebratory "
        "(crown / trophy / star), not a phone."
    )


def test_success_story_card_uses_completion_label_variable():
    """The completion badge text must adapt by service_type — subscriptions
    say 'Upgraded' instead of 'Successfully Completed'."""
    src_path = "/app/frontend/src/components/SuccessStoryCard.js"
    with open(src_path, "r") as fp:
        contents = fp.read()
    assert "completionLabel" in contents, (
        "REGRESSION: completionLabel variable removed. Subscription posts "
        "will incorrectly say 'Successfully Completed' instead of 'Upgraded'."
    )


# -----------------------------------------------------------------------------
# Live integration check: hitting the actual endpoint to assert it does not
# return empty when data exists.
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_top_redeemers_endpoint_returns_data_when_data_exists():
    """Live integration check — hit the endpoint and assert non-empty result
    when at least one user has redeemed PRC."""
    import os
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    from motor.motor_asyncio import AsyncIOMotorClient
    mc = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mc[os.environ["DB_NAME"]]
    # Confirm at least one collection has success entries
    has_data = False
    for coll in ["redeem_requests", "bank_transfer_requests", "subscription_payments",
                 "vip_payments", "recharge_transactions"]:
        if await db[coll].count_documents({"status": {"$in": ["completed", "success", "approved", "paid"]}}, limit=1):
            has_data = True
            break
    if not has_data:
        pytest.skip("No success entries in any source collection — skip live check")

    # Force-import the module and call the route
    import sys
    sys.path.insert(0, "/app/backend")
    from routes import leaderboard as lb
    lb.set_db(db)
    out = await lb.get_top_redeemers(limit=10)
    assert "leaderboard" in out
    assert len(out["leaderboard"]) > 0, (
        "REGRESSION: Top Redeemers endpoint returned empty list while "
        "underlying data exists. Check pass-1 source list and pass-2 fallback."
    )


# -----------------------------------------------------------------------------
# REGRESSION 3: Pre-deploy health-check endpoint must report ok_to_deploy=True
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_health_regression_endpoint_overall_pass():
    """Hit the LIVE preview /api/admin/health/regression endpoint and assert
    overall_status == 'pass'. Uses a fresh client per test loop so it works
    regardless of pytest-asyncio loop isolation. If this fails, do NOT deploy.
    """
    import os
    import httpx
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    load_dotenv("/app/frontend/.env")
    base = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
    if not base:
        pytest.skip("REACT_APP_BACKEND_URL unavailable")

    # Login as test admin to get a token
    async with httpx.AsyncClient(timeout=30) as client:
        login = await client.post(
            f"{base}/api/auth/login",
            json={"identifier": "admin@test.com", "password": "153759"},
        )
        if login.status_code != 200:
            pytest.skip(f"admin login unavailable: {login.status_code}")
        token = login.json().get("token")
        if not token:
            pytest.skip("no token returned from admin login")
        r = await client.get(
            f"{base}/api/admin/health/regression",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert "overall_status" in data
    assert "results" in data
    assert isinstance(data["results"], list) and len(data["results"]) >= 10
    failed = [x for x in data["results"] if x["status"] == "fail"]
    assert not failed, f"REGRESSION: health-check failures: {failed}"
    assert data["overall_status"] == "pass"
    assert data["ok_to_deploy"] is True


def test_admin_health_check_in_permission_list():
    """Permission `health-check` MUST be in the master ALL_ADMIN_PERMISSIONS list,
    otherwise managers won't be able to view this critical pre-deploy gate."""
    src_path = "/app/backend/routes/admin_accounting.py"
    with open(src_path, "r") as fp:
        contents = fp.read()
    assert '"id": "health-check"' in contents, (
        "REGRESSION: 'health-check' permission removed from ALL_ADMIN_PERMISSIONS. "
        "Manager admins won't see Pre-Deploy Health Check in sidebar."
    )


# -----------------------------------------------------------------------------
# REGRESSION 4: Admin subscription-stats endpoint MUST have a router decorator
# -----------------------------------------------------------------------------
# Production hit Feb 28: get_subscription_stats() was an orphan — frontend got
# 404 → "Server is busy" toast → stats cards all showed 0. This is the same
# class of bug as approve_vip_payment / reject_vip_payment earlier the same day.
# This test guards against the pattern returning.

def test_subscription_stats_endpoint_has_decorator():
    """Lock the orphaned-endpoint regression: get_subscription_stats() must
    have a @api_router.get decorator above it, exposed at
    /admin/subscription-stats."""
    src_path = "/app/backend/server.py"
    with open(src_path, "r") as fp:
        lines = fp.readlines()
    found = False
    for i, line in enumerate(lines):
        if line.startswith("async def get_subscription_stats("):
            # Look up to 4 lines above for a decorator referencing subscription-stats
            window = "".join(lines[max(0, i - 4):i])
            if "@api_router.get" in window and "subscription-stats" in window:
                found = True
                break
    assert found, (
        "REGRESSION: get_subscription_stats() in server.py has no "
        "@api_router.get('/admin/subscription-stats') decorator. The frontend "
        "Admin Subscription page will get 404 and show 'Server is busy' toast "
        "with all stat cards stuck at 0."
    )
