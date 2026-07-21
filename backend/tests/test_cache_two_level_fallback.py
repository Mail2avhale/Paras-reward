"""Feb 20 2026 (evening) — two-level fallback tests.

Verifies that after a successful cache.set(), a subsequent cache.get()
succeeds EVEN IF Redis is hanging/crashing on the read — the value is
served from the in-process memory mirror instead of forcing a Mongo
fallback.

Run:
    cd /app/backend && pytest tests/test_cache_two_level_fallback.py -v
"""
import asyncio
import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cache_manager import CacheManager  # noqa: E402


class _WriteOKReadFailRedis:
    """Redis where writes succeed but reads always crash. Simulates a
    partial degradation (uncommon but real — Upstash sometimes fails
    reads while queueing writes).
    """
    def __init__(self):
        self.store = {}

    async def get(self, k):
        raise ConnectionError("READ side is down")

    async def setex(self, k, ttl, v):
        self.store[k] = v

    async def delete(self, *keys):
        for k in keys: self.store.pop(k, None)


class _HangReadRedis:
    """Reads hang forever; writes work fine (simulates network path split)."""
    def __init__(self):
        self.store = {}
    async def get(self, k):
        await asyncio.sleep(10)
        return "should-never-arrive"
    async def setex(self, k, t, v):
        self.store[k] = v


@pytest.mark.asyncio
async def test_get_falls_through_to_memory_mirror_when_redis_read_fails():
    mgr = CacheManager()
    mgr.redis_client = _WriteOKReadFailRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    mgr._op_timeout = 0.1

    # SET populates both Redis (fake) AND in-process memory mirror.
    ok = await mgr.set("2level-k1", {"payload": 123}, ttl=60)
    assert ok is True

    # GET — Redis read crashes, but memory mirror should serve the value.
    result = await mgr.get("2level-k1")
    assert result == {"payload": 123}, "must fall through to memory mirror"
    # Metrics: recorded as a hit (via memory), NOT a miss/mongo-fallback.
    assert mgr._m_hits >= 1
    assert mgr._m_mongo_fallbacks == 0


@pytest.mark.asyncio
async def test_get_falls_through_to_memory_mirror_when_redis_read_hangs():
    mgr = CacheManager()
    mgr.redis_client = _HangReadRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    mgr._op_timeout = 0.1

    await mgr.set("2level-hot", "hello", ttl=60)

    t0 = asyncio.get_event_loop().time()
    result = await mgr.get("2level-hot")
    elapsed = asyncio.get_event_loop().time() - t0

    assert result == "hello"
    # Should complete well within one timeout unit (100ms) — proves we
    # returned via memory, not by waiting on Redis.
    assert elapsed < 1.0, f"took {elapsed:.2f}s"


@pytest.mark.asyncio
async def test_memory_mirror_expiry_respected():
    mgr = CacheManager()
    mgr.redis_client = _WriteOKReadFailRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    mgr._op_timeout = 0.1

    # 1s TTL — expires quickly for the test.
    await mgr.set("ttl-key", "val", ttl=1)
    # Immediately hits (from memory mirror since Redis read fails)
    assert await mgr.get("ttl-key") == "val"
    # After 1.1s the mirror expires → next get returns None
    await asyncio.sleep(1.1)
    assert await mgr.get("ttl-key") is None


@pytest.mark.asyncio
async def test_delete_clears_both_redis_and_memory():
    mgr = CacheManager()
    mgr.redis_client = _WriteOKReadFailRedis()
    mgr.use_redis = True
    mgr.use_upstash = True
    mgr._op_timeout = 0.1

    await mgr.set("del-key", "x", ttl=60)
    assert await mgr.get("del-key") == "x"
    await mgr.delete("del-key")
    # Redis read still crashes; memory mirror MUST also be cleared.
    assert await mgr.get("del-key") is None
