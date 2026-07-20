"""
Feb 20 2026 — Redis-to-MongoDB fallback resilience tests.

Verifies that even when Redis is:
  (a) unavailable
  (b) timing out
  (c) throwing runtime errors
… the cache manager NEVER raises to the caller and the app keeps
serving from MongoDB.

Run:
    cd /app/backend && pytest tests/test_cache_fallback.py -v
"""
import asyncio
import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cache_manager import CacheManager, _RedisCircuitBreaker  # noqa: E402


# ────────────────────────────────────────────────────────────────
# Helpers — fake Redis clients that misbehave in specific ways.
# ────────────────────────────────────────────────────────────────
class _HangingRedis:
    """Every op sleeps forever — simulates a totally stuck upstream."""
    async def get(self, k):        await asyncio.sleep(10); return "should-never-arrive"
    async def setex(self, k, t, v): await asyncio.sleep(10)
    async def delete(self, *k):    await asyncio.sleep(10)
    async def incrby(self, k, a):  await asyncio.sleep(10)
    async def expire(self, k, t):  await asyncio.sleep(10)
    async def ping(self):          await asyncio.sleep(10)


class _CrashingRedis:
    """Every op raises immediately — simulates a broken upstream."""
    async def get(self, k):        raise ConnectionError("Upstash down")
    async def setex(self, k, t, v): raise ConnectionError("Upstash down")
    async def delete(self, *k):    raise ConnectionError("Upstash down")
    async def incrby(self, k, a):  raise ConnectionError("Upstash down")
    async def expire(self, k, t):  raise ConnectionError("Upstash down")


class _FakeGoodRedis:
    """Trivial in-memory dict wrapped in a Redis-like async facade."""
    def __init__(self):
        self.store = {}
    async def get(self, k):        return self.store.get(k)
    async def setex(self, k, t, v): self.store[k] = v
    async def delete(self, *keys):
        n = 0
        for k in keys:
            if k in self.store:
                del self.store[k]; n += 1
        return n
    async def incrby(self, k, a):
        cur = int(self.store.get(k) or 0)
        cur += a
        self.store[k] = str(cur)
        return cur
    async def expire(self, k, t): return 1
    async def flushdb(self): self.store.clear(); return True


# ────────────────────────────────────────────────────────────────
# 1) Circuit breaker unit
# ────────────────────────────────────────────────────────────────
def test_circuit_breaker_opens_after_threshold():
    cb = _RedisCircuitBreaker(threshold=3, recovery_sec=60, window_sec=30)
    for _ in range(2):
        cb.record_failure()
    assert cb.is_open() is False, "should stay closed below threshold"
    cb.record_failure()
    assert cb.is_open() is True, "should open at threshold"
    # snapshot has non-zero open counter
    snap = cb.snapshot()
    assert snap["state"] == "open"
    assert snap["total_opens"] == 1
    assert snap["reopens_in_sec"] > 0


def test_circuit_breaker_auto_recovers():
    cb = _RedisCircuitBreaker(threshold=2, recovery_sec=0, window_sec=30)
    cb.record_failure(); cb.record_failure()
    assert cb.is_open() is False  # recovery=0 → immediately half-open, allow probe
    # After a probe, breaker considers itself closed
    assert cb.snapshot()["state"] == "closed"


def test_circuit_breaker_success_resets():
    cb = _RedisCircuitBreaker(threshold=3, recovery_sec=60, window_sec=30)
    cb.record_failure(); cb.record_failure()
    cb.record_success()
    assert cb.snapshot()["failures_in_window"] == 0


# ────────────────────────────────────────────────────────────────
# 2) get() falls through to None when Redis hangs / crashes
# ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_get_returns_none_on_hang_and_never_blocks():
    mgr = CacheManager()
    mgr.redis_client = _HangingRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    mgr._op_timeout = 0.1   # tight timeout for the test

    # Should return quickly, never hang.
    t0 = asyncio.get_event_loop().time()
    result = await mgr.get("some-key")
    elapsed = asyncio.get_event_loop().time() - t0

    assert result is None
    assert elapsed < 1.0, f"took {elapsed:.2f}s — should be <1s (near op_timeout={mgr._op_timeout}s)"
    # Metrics reflect a timeout
    assert mgr._m_timeouts >= 1
    assert mgr._m_errors >= 1
    assert mgr._m_mongo_fallbacks >= 1


@pytest.mark.asyncio
async def test_get_returns_none_on_crash():
    mgr = CacheManager()
    mgr.redis_client = _CrashingRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    result = await mgr.get("k")
    assert result is None
    assert mgr._m_errors >= 1
    assert mgr._m_mongo_fallbacks >= 1


# ────────────────────────────────────────────────────────────────
# 3) set() / delete() never raise on Redis failure
# ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_set_returns_false_on_crash_but_never_raises():
    mgr = CacheManager()
    mgr.redis_client = _CrashingRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    ok = await mgr.set("k", {"x": 1}, ttl=60)
    assert ok is False
    assert mgr._m_sets_fail >= 1


@pytest.mark.asyncio
async def test_delete_returns_false_on_crash_but_never_raises():
    mgr = CacheManager()
    mgr.redis_client = _CrashingRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    ok = await mgr.delete("k")
    assert ok is False
    assert mgr._m_deletes_fail >= 1


# ────────────────────────────────────────────────────────────────
# 4) Circuit trips after repeated failures → subsequent calls SKIP Redis
# ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_circuit_opens_and_further_calls_skip_redis():
    mgr = CacheManager()
    mgr.redis_client = _CrashingRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    # Trip the breaker (default threshold = 5)
    for _ in range(5):
        await mgr.get("boom")
    assert mgr._breaker.is_open() is True

    # Next call must NOT hit Redis — verify by using a hanging client;
    # if the breaker really skipped, the call returns instantly with None.
    mgr.redis_client = _HangingRedis()
    mgr._op_timeout = 5.0  # generous — proves we did NOT actually wait
    t0 = asyncio.get_event_loop().time()
    result = await mgr.get("skipped-key")
    elapsed = asyncio.get_event_loop().time() - t0
    assert result is None
    assert elapsed < 0.5, f"circuit did not skip: took {elapsed:.2f}s"
    assert mgr._m_circuit_skips >= 1


# ────────────────────────────────────────────────────────────────
# 5) Healthy Redis — hit/miss counters increment correctly
# ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_hit_and_miss_counters_are_accurate():
    mgr = CacheManager()
    mgr.redis_client = _FakeGoodRedis()
    mgr.use_redis = True
    mgr.use_upstash = True

    # 1 miss
    assert await mgr.get("k1") is None
    # 1 set
    assert await mgr.set("k1", {"v": 42}, ttl=60) is True
    # 1 hit (round-tripped through JSON)
    got = await mgr.get("k1")
    assert got == {"v": 42}

    stats = await mgr.get_stats()
    counters = stats["counters"]
    assert counters["hits"] == 1
    assert counters["misses"] == 1
    assert counters["sets_ok"] == 1
    assert stats["hit_rate_pct"] == 50.0


# ────────────────────────────────────────────────────────────────
# 6) reset_counters wipes metrics without touching data
# ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_reset_counters_clears_metrics():
    mgr = CacheManager()
    mgr.redis_client = _FakeGoodRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    await mgr.set("x", 1, ttl=60)
    await mgr.get("x")
    assert mgr._m_hits >= 1
    mgr.reset_counters()
    assert mgr._m_hits == 0
    assert mgr._m_misses == 0
    # Data still there
    assert await mgr.get("x") == 1


# ────────────────────────────────────────────────────────────────
# 7) In-memory mode always works (no Redis client at all)
# ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_in_memory_mode_never_hits_redis():
    mgr = CacheManager()
    mgr.use_redis = False
    mgr.use_upstash = False
    await mgr.set("mem-key", "hello", ttl=60)
    assert await mgr.get("mem-key") == "hello"
    assert await mgr.delete("mem-key") is True
    assert await mgr.get("mem-key") is None
