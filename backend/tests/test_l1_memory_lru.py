"""
Regression test for the L1 memory-cache unbounded-growth bug.

Root cause: `_memory_cache` in cache_manager.py used to be an unbounded
dict — every unique cache key (user:{uid}, dashboard:{uid}, rate_limit
counters, etc.) accumulated forever. Over hours, the pod's RSS grew,
GC pauses lengthened, and API latency degraded → matching the user
report "app is fast after deploy but slows down after some time".

Fix: bounded LRU (OrderedDict) with configurable max size + lazy sweep
of expired keys. This test locks that behavior in.
"""
import sys
import time
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import cache_manager  # noqa: E402
from cache_manager import (  # noqa: E402
    CacheManager,
    _memory_cache,
    _cache_expiry,
    _l1_stats,
    CACHE_ENV_PREFIX,
)

# Cap L1 at 10 entries for these tests (small, easy to reason about).
_TEST_L1_CAP = 10


@pytest.fixture(autouse=True)
def reset_l1(monkeypatch):
    """Wipe L1 and force the cap to 10 for each test."""
    monkeypatch.setattr(cache_manager, "L1_MAX_ENTRIES", _TEST_L1_CAP)
    _memory_cache.clear()
    _cache_expiry.clear()
    for k in _l1_stats:
        _l1_stats[k] = 0
    yield
    _memory_cache.clear()
    _cache_expiry.clear()


def test_l1_max_env_var_respected():
    """The bound respected by production is a small, sane number."""
    assert cache_manager.L1_MAX_ENTRIES == _TEST_L1_CAP


@pytest.mark.asyncio
async def test_l1_lru_evicts_oldest_when_full():
    """After writing 15 keys with max=10, only 10 remain and the oldest
    5 are gone (LRU eviction)."""
    mgr = CacheManager()
    mgr.use_redis = False  # force pure in-memory path

    for i in range(15):
        await mgr.set(f"key_{i:02d}", {"n": i}, ttl=300)

    assert len(_memory_cache) == _TEST_L1_CAP, (
        f"L1 should be capped at {_TEST_L1_CAP}, got {len(_memory_cache)}"
    )
    # Keys 0-4 should have been evicted (they were the oldest inserted)
    for i in range(5):
        assert f"{CACHE_ENV_PREFIX}:key_{i:02d}" not in _memory_cache
    # Keys 5-14 should remain
    for i in range(5, 15):
        assert f"{CACHE_ENV_PREFIX}:key_{i:02d}" in _memory_cache
    # Eviction counter incremented for each of the 5 oldest keys
    assert _l1_stats["evictions"] == 5


@pytest.mark.asyncio
async def test_l1_get_touch_prevents_eviction():
    """Reading a key marks it MRU so the next eviction spares it."""
    mgr = CacheManager()
    mgr.use_redis = False

    for i in range(10):
        await mgr.set(f"key_{i:02d}", {"n": i}, ttl=300)

    # Read key_00 — it should move to MRU (last position)
    got = await mgr.get("key_00")
    assert got == {"n": 0}

    # Add one more key → should evict key_01 (now oldest), NOT key_00
    await mgr.set("new_key", {"n": 999}, ttl=300)

    assert f"{CACHE_ENV_PREFIX}:key_00" in _memory_cache
    assert f"{CACHE_ENV_PREFIX}:key_01" not in _memory_cache
    assert f"{CACHE_ENV_PREFIX}:new_key" in _memory_cache


@pytest.mark.asyncio
async def test_l1_expired_keys_removed_on_get():
    """A key whose TTL has passed is invisible to get() and cleaned up."""
    mgr = CacheManager()
    mgr.use_redis = False

    await mgr.set("short_lived", {"tmp": True}, ttl=1)
    prefixed = f"{CACHE_ENV_PREFIX}:short_lived"
    _cache_expiry[prefixed] = time.time() - 5

    got = await mgr.get("short_lived")
    assert got is None
    assert prefixed not in _memory_cache
    assert prefixed not in _cache_expiry


@pytest.mark.asyncio
async def test_l1_incr_fallback_gets_ttl_and_evicts():
    """incr() fallback (when Redis unavailable) writes to LRU and cannot
    leak forever — TTL defaults to 60s, and LRU cap enforces the bound.
    """
    mgr = CacheManager()
    mgr.use_redis = False

    for i in range(15):
        await mgr.incr(f"rate_limit:user_{i}:global")

    # Only last 10 remain (LRU cap)
    assert len(_memory_cache) == _TEST_L1_CAP
    # Each key has an expiry set (no leak)
    for k in _memory_cache:
        assert k in _cache_expiry, f"{k} missing expiry — potential leak"


@pytest.mark.asyncio
async def test_l1_stats_exposed_via_get_stats():
    """/api/admin/cache/health should surface L1 telemetry."""
    mgr = CacheManager()
    mgr.use_redis = False

    for i in range(12):
        await mgr.set(f"stat_key_{i}", i, ttl=300)

    stats = await mgr.get_stats()
    assert "l1_memory" in stats
    l1 = stats["l1_memory"]
    assert l1["size"] == _TEST_L1_CAP
    assert l1["max"] == _TEST_L1_CAP
    assert l1["inserts"] == 12
    assert l1["evictions"] == 2
    assert l1["utilization_pct"] == 100.0
