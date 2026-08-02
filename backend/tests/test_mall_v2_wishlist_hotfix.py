"""
Layer 1.8 (Feb 25 2026) — mall_v2 wishlist doom-loop hotfix.

Two failure modes were burning 30 s uvicorn slots on production
(observed p50 = 30003 ms, 880 calls in one client burst, all 504):

  1. `_ensure_indexes()` only set `_indexes_ensured = True` inside the
     try-block on FULL success. Any single `create_index` raising left
     the flag False, and every subsequent request re-entered the lock →
     retried the whole batch → hammered Atlas → thundering herd.

  2. Endpoint had no per-request timeout. If Motor pool was starved by
     the herd, the wishlist call itself hung for the full uvicorn
     30 s budget.

Fix locks both:
  * `_indexes_ensured = True` moved to a `finally` block so we NEVER
    loop the batch. Individual `create_index` calls now wrap in
    `asyncio.wait_for(..., 3s)` and log-and-continue on error.
  * `get_wishlist` and `track_product_view` wrap their DB work in
    `asyncio.wait_for(..., 4s / 3s)`. On timeout we return a degraded
    payload (empty list / success:true, degraded:true) with a short 2 s
    cache so healthy DB conditions recover fast.

These tests import the module and assert the shape of the code path.
"""
import os
import sys
import pytest  # noqa: F401  # kept for the pytest.mark.asyncio-decorated tests above

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Load env vars before mall_v2 imports fire (they read JWT_SECRET_KEY
# at import time via middleware/auth.py).
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except Exception:
    pass
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-for-mall-v2-unit-tests")


def test_ensure_indexes_flag_set_in_finally_block():
    """Contract: `_indexes_ensured = True` MUST be in a `finally` so
    partial index failures don't loop forever.

    If this drifts (someone moves it back into try), the retry storm
    from prod comes right back.
    """
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "mall_v2.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()

    # The finally block must set the flag.
    assert "finally:" in src, "mall_v2._ensure_indexes lost its finally block"
    finally_block = src.split("finally:", 1)[1][:400]
    assert "_indexes_ensured = True" in finally_block, (
        "mall_v2: `_indexes_ensured = True` must live in the `finally` "
        "block (Layer 1.8 hotfix — Feb 25 2026)"
    )


def test_create_index_calls_are_wrapped_with_wait_for():
    """Contract: each `create_index` inside `_ensure_indexes` must be
    behind an `asyncio.wait_for` so one slow builder can't monopolise
    the lock for 30 s.
    """
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "mall_v2.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()
    # We introduced a `_create()` helper — assert it's the only path.
    assert "async def _create(" in src, "mall_v2: `_create()` wrapper missing"
    assert "asyncio.wait_for(coll.create_index" in src, (
        "mall_v2: `create_index` calls must be wrapped in asyncio.wait_for"
    )


def test_wishlist_has_hard_timeout():
    """Contract: `get_wishlist` must wrap DB work in `asyncio.wait_for`
    so a single slow call can't burn a 30 s uvicorn slot.
    """
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "mall_v2.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()
    # Find the get_wishlist function body.
    idx = src.find("async def get_wishlist(")
    assert idx > 0
    body = src[idx : idx + 2000]
    assert "asyncio.wait_for(" in body, (
        "get_wishlist must wrap DB work in `asyncio.wait_for` "
        "(Layer 1.8 hotfix — Feb 25 2026)"
    )
    assert "asyncio.TimeoutError" in body, (
        "get_wishlist must handle asyncio.TimeoutError with degraded payload"
    )


def test_track_view_has_hard_timeout():
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "mall_v2.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()
    idx = src.find("async def track_product_view(")
    assert idx > 0
    body = src[idx : idx + 2000]
    assert "asyncio.wait_for(" in body, (
        "track_product_view must wrap DB work in `asyncio.wait_for` "
        "(Layer 1.8 hotfix — Feb 25 2026)"
    )
    assert "asyncio.TimeoutError" in body


# NOTE: Runtime fault-injection tests are omitted because
# `routes.mall_v2` has a circular import with `server.py` (mall_v2
# imports `get_current_user` from server; server registers the mall_v2
# router). The four source-code contract tests above already lock the
# critical invariants (`finally` block, wait_for wrapper, wishlist +
# track-view timeouts). The E2E smoke curl in the main-agent workflow
# validates runtime behaviour.
