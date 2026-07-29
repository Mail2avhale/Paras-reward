"""
Cache Manager for Paras Rewards Platform
Implements Redis caching with Upstash Redis (HTTP-based) support
Includes fallback to local Redis and in-memory cache.

Feb 20 2026 — Hardened for Redis unavailability:
  • Per-op timeouts (asyncio.wait_for) so a hung Redis never blocks a request
  • Circuit breaker — after N consecutive failures, Redis is skipped for
    a cooling-off period; requests go straight to the caller's Mongo path.
  • Metrics counters (hits/misses/errors/timeouts/circuit-opens) exposed
    via get_stats() and a new /api/admin/cache/health endpoint (server.py).
  • MongoDB remains the source of truth — cache failures NEVER fail a
    request. All public methods return neutral values (None / False) on
    Redis error, so callers using the standard
    "cached = await cache.get(k); if not cached: fetch_from_mongo(); cache.set(k, v)"
    pattern automatically fall through to Mongo.
"""

import asyncio
import os
import json
import time as _time
from datetime import datetime, timezone
from typing import Optional, Any, Callable
from functools import wraps
from dotenv import load_dotenv

# Load environment variables (only if .env exists - production uses System Keys)
import pathlib
_cache_env = pathlib.Path(__file__).parent / '.env'
if _cache_env.exists():
    load_dotenv(_cache_env)

# Environment prefix for cache keys to prevent cross-environment pollution
CACHE_ENV_PREFIX = os.getenv('CACHE_ENV_PREFIX', 'preview')

# ── Redis resilience knobs (env-overridable, sensible defaults) ──────
# Per-op timeout — Upstash HTTP calls in a healthy state complete in ~30ms;
# 500ms is 15× that (very tolerant) yet still fast enough that a stuck
# call can never dominate a user's response time. Adjust via env if
# your latency profile is different.
REDIS_OP_TIMEOUT_MS = int(os.getenv('REDIS_OP_TIMEOUT_MS', '500'))
# Circuit breaker: open after N consecutive failures (any kind) inside
# a rolling window, stay open for RECOVERY_SEC before probing again.
REDIS_CB_FAILURE_THRESHOLD = int(os.getenv('REDIS_CB_FAILURE_THRESHOLD', '5'))
REDIS_CB_RECOVERY_SEC = int(os.getenv('REDIS_CB_RECOVERY_SEC', '60'))
# Time window (sec) inside which we count consecutive failures. Older
# failures decay so a slow-drip failure doesn't accidentally open us up.
REDIS_CB_FAILURE_WINDOW_SEC = int(os.getenv('REDIS_CB_FAILURE_WINDOW_SEC', '30'))

# Try to import upstash-redis first (HTTP-based, works everywhere)
UPSTASH_AVAILABLE = False
REDIS_AVAILABLE = False

try:
    from upstash_redis.asyncio import Redis as UpstashRedis
    UPSTASH_AVAILABLE = True
except ImportError:
    pass

# Also check if redis-py is available for local Redis fallback
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    pass

# ── L1 In-memory cache — bounded LRU (Feb 22 2026) ─────────────────
# CRITICAL FIX: previously `_memory_cache` was an unbounded dict which
# leaked forever. Every unique cache key (user:{uid}, dashboard:{uid},
# unread_notif_v1:{uid}, rate_limit:{uid}:{endpoint}, etc.) piled up in
# process RAM until the pod was restarted — matching the user's report
# that "app is fast after deploy but slows down after some time".
# We now use an OrderedDict with a hard cap; oldest entries are evicted
# on insert (LRU). Callers that miss L1 simply fall through to Redis /
# Mongo — no correctness impact, only a one-time re-fetch cost.
from collections import OrderedDict

# Configurable via env; default 5000 entries is plenty for our peak
# ~6k active users × ~7 key patterns while keeping RSS growth bounded.
L1_MAX_ENTRIES = int(os.getenv('CACHE_L1_MAX_ENTRIES', '5000'))

_memory_cache: "OrderedDict[str, Any]" = OrderedDict()
_cache_expiry: dict = {}
# Sweep frequency — every N sets we do a quick expired-key scan (lazy
# background cleanup so keys that are never GET'd again don't linger).
_L1_SWEEP_EVERY_N_SETS = 500
_l1_stats = {"inserts": 0, "evictions": 0, "sweeps": 0, "expired_swept": 0}


def _l1_touch(key: str) -> None:
    """Move `key` to the MRU end (LRU bookkeeping)."""
    try:
        _memory_cache.move_to_end(key)
    except KeyError:
        pass


def _l1_put(key: str, value: Any, ttl_seconds: Optional[float] = None) -> None:
    """Insert or refresh a key, respecting the max size (evict oldest)."""
    if key in _memory_cache:
        _memory_cache[key] = value
        _memory_cache.move_to_end(key)
    else:
        _memory_cache[key] = value
        _l1_stats["inserts"] += 1
        # Evict oldest until we're under the cap
        while len(_memory_cache) > L1_MAX_ENTRIES:
            try:
                old_k, _old_v = _memory_cache.popitem(last=False)
                _cache_expiry.pop(old_k, None)
                _l1_stats["evictions"] += 1
            except KeyError:
                break
    if ttl_seconds is not None:
        _cache_expiry[key] = datetime.now(timezone.utc).timestamp() + ttl_seconds

    # Probabilistic lazy sweep of expired keys — cheap when list is
    # short, throttled so hot paths don't pay for it.
    if _l1_stats["inserts"] % _L1_SWEEP_EVERY_N_SETS == 0:
        _l1_sweep_expired()


def _l1_sweep_expired() -> None:
    """Prune keys whose expiry has already passed. Cheap O(N) but
    called only every _L1_SWEEP_EVERY_N_SETS inserts.
    """
    _l1_stats["sweeps"] += 1
    now_ts = datetime.now(timezone.utc).timestamp()
    to_drop = [k for k, exp in _cache_expiry.items() if exp and now_ts > exp]
    for k in to_drop:
        _memory_cache.pop(k, None)
        _cache_expiry.pop(k, None)
        _l1_stats["expired_swept"] += 1


# ─── Circuit Breaker (module-level, shared across CacheManager methods) ──
class _RedisCircuitBreaker:
    """Tiny circuit breaker for Redis operations.

    States: closed (normal) → open (skip Redis) → half-open (probe once).
    Trip criteria: >= threshold failures inside a rolling window.
    """
    def __init__(self, threshold: int, recovery_sec: int, window_sec: int):
        self.threshold = threshold
        self.recovery_sec = recovery_sec
        self.window_sec = window_sec
        self._failures = []           # list of epoch timestamps
        self._opened_at = 0.0         # 0 = closed
        # Metrics
        self.total_opens = 0
        self.total_probes = 0
        self.total_recoveries = 0

    def is_open(self) -> bool:
        """Return True when Redis should be SKIPPED. Auto-probes after
        recovery_sec elapses (half-open state).
        """
        if self._opened_at == 0:
            return False
        elapsed = _time.time() - self._opened_at
        if elapsed >= self.recovery_sec:
            # Half-open: allow ONE probe (return False just this time).
            self._opened_at = 0
            self._failures = []
            self.total_probes += 1
            return False
        return True

    def record_success(self) -> None:
        if self._failures or self._opened_at:
            self.total_recoveries += 1
        self._failures = []
        self._opened_at = 0

    def record_failure(self) -> None:
        now = _time.time()
        # Drop failures older than the rolling window
        self._failures = [t for t in self._failures if now - t <= self.window_sec]
        self._failures.append(now)
        if len(self._failures) >= self.threshold and self._opened_at == 0:
            self._opened_at = now
            self.total_opens += 1

    def snapshot(self) -> dict:
        state = "open" if self._opened_at else "closed"
        return {
            "state": state,
            "failures_in_window": len(self._failures),
            "threshold": self.threshold,
            "recovery_sec": self.recovery_sec,
            "reopens_in_sec": max(0, int(self.recovery_sec - (_time.time() - self._opened_at))) if self._opened_at else 0,
            "total_opens": self.total_opens,
            "total_probes": self.total_probes,
            "total_recoveries": self.total_recoveries,
        }


class CacheManager:
    """
    Unified cache manager supporting:
    1. Upstash Redis (HTTP-based, cloud hosted) - PREFERRED
    2. Local Redis (TCP-based)
    3. In-memory fallback

    Feb 20 2026: every Redis op is wrapped with `asyncio.wait_for()` +
    a circuit breaker. If Redis is unavailable / slow / erroring, the
    method returns a NEUTRAL value (None for get, False for set/delete,
    0 for incr) and the caller falls through to MongoDB — cache failures
    NEVER surface as user-visible errors.
    """
    
    def __init__(self):
        self.redis_client = None
        self.use_redis = False
        self.use_upstash = False
        self.default_ttl = 300  # 5 minutes default
        self.connection_type = "none"
        # Resilience state
        self._op_timeout = REDIS_OP_TIMEOUT_MS / 1000.0
        self._breaker = _RedisCircuitBreaker(
            threshold=REDIS_CB_FAILURE_THRESHOLD,
            recovery_sec=REDIS_CB_RECOVERY_SEC,
            window_sec=REDIS_CB_FAILURE_WINDOW_SEC,
        )
        # Metrics counters — cheap enough to always keep on.
        self._m_hits = 0
        self._m_misses = 0
        self._m_errors = 0
        self._m_timeouts = 0
        self._m_circuit_skips = 0
        self._m_mongo_fallbacks = 0   # incremented by cache misses & errors
        self._m_sets_ok = 0
        self._m_sets_fail = 0
        self._m_deletes_ok = 0
        self._m_deletes_fail = 0

    # ─── internal helpers ────────────────────────────────────────────
    def _redis_ready(self) -> bool:
        """True iff Redis is configured, healthy, and circuit is closed."""
        if not (self.use_redis and self.redis_client):
            return False
        if self._breaker.is_open():
            self._m_circuit_skips += 1
            return False
        return True

    async def _redis_call(self, coro):
        """Run a Redis coroutine under timeout + circuit-breaker. Returns
        (True, result) on success or (False, None) on any failure. Never
        raises — Mongo fallback is the caller's responsibility.
        """
        try:
            result = await asyncio.wait_for(coro, timeout=self._op_timeout)
            self._breaker.record_success()
            return True, result
        except asyncio.TimeoutError:
            self._m_timeouts += 1
            self._m_errors += 1
            self._breaker.record_failure()
            # Best-effort log — never crash on logging.
            try:
                print(f"⚠️ Cache timeout after {self._op_timeout*1000:.0f}ms — falling back to Mongo")
            except Exception:
                pass
            return False, None
        except Exception as e:
            self._m_errors += 1
            self._breaker.record_failure()
            try:
                print(f"⚠️ Cache Redis error: {e} — falling back to Mongo")
            except Exception:
                pass
            return False, None
        
    async def initialize(self):
        """Initialize Redis connection - tries Upstash first, then local Redis, then in-memory"""
        
        # 1. Try Upstash Redis first (recommended for production)
        upstash_url = os.environ.get("UPSTASH_REDIS_REST_URL")
        upstash_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
        
        if UPSTASH_AVAILABLE and upstash_url and upstash_token:
            try:
                self.redis_client = UpstashRedis(url=upstash_url, token=upstash_token)
                # Test connection under a bounded timeout so a stuck ping
                # doesn't hold up server startup.
                await asyncio.wait_for(self.redis_client.ping(), timeout=max(self._op_timeout, 2.0))
                self.use_redis = True
                self.use_upstash = True
                self.connection_type = "upstash"
                print(f"✅ Upstash Redis connected successfully (op timeout={self._op_timeout*1000:.0f}ms)")
                return
            except Exception as e:
                print(f"⚠️ Upstash Redis connection failed: {e}")
        
        # 2. Try local Redis as fallback (only if Upstash not configured)
        if REDIS_AVAILABLE and not upstash_url:
            redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
            try:
                self.redis_client = redis.from_url(
                    redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_timeout=self._op_timeout,
                    socket_connect_timeout=self._op_timeout,
                )
                await asyncio.wait_for(self.redis_client.ping(), timeout=max(self._op_timeout, 2.0))
                self.use_redis = True
                self.use_upstash = False
                self.connection_type = "local_redis"
                print(f"✅ Local Redis connected: {redis_url} (op timeout={self._op_timeout*1000:.0f}ms)")
                return
            except Exception as e:
                print(f"⚠️ Redis connection failed: {e}")
        
        # 3. Fall back to in-memory cache
        print("📦 Falling back to in-memory cache (Redis unavailable)")
        self.use_redis = False
        self.use_upstash = False
        self.connection_type = "in_memory"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache with environment prefix.

        Returns None on:
          • cache miss  • Redis error / timeout  • circuit-open skip
          • malformed JSON
        The caller MUST treat None as "not cached — fetch from Mongo".

        Feb 21 2026 — L1-FIRST cache read.
        Upstash Redis is HTTP-based and adds ~217ms round-trip PER call
        (measured in preview against the shared Upstash endpoint). At that
        cost, Redis is SLOWER than a direct MongoDB read (1-3ms) — the
        cache was making the app slower, not faster.

        Fix: check the in-process memory mirror FIRST (0ms). Hit Redis
        (217ms) only on an L1 miss. Since `set()` populates BOTH tiers,
        every subsequent read within the TTL window is instant.

        Trade-off: cross-pod invalidation now takes up to `ttl` seconds
        to propagate. This is fine for our single-pod-per-env deployment
        and for our short (≤2 min) TTLs on user data.
        """
        prefixed_key = f"{CACHE_ENV_PREFIX}:{key}"

        def _read_memory_mirror():
            """L1 fallback — pull from the in-process dict (LRU-aware)."""
            if prefixed_key not in _memory_cache:
                return None
            expiry = _cache_expiry.get(prefixed_key)
            if expiry and datetime.now(timezone.utc).timestamp() > expiry:
                _memory_cache.pop(prefixed_key, None)
                _cache_expiry.pop(prefixed_key, None)
                return None
            # Touch — mark as recently used so it survives future evictions.
            _l1_touch(prefixed_key)
            return _memory_cache.get(prefixed_key)

        # ── L1: process-local memory mirror (0ms) ──
        mem = _read_memory_mirror()
        if mem is not None:
            self._m_hits += 1
            return mem

        # ── L2: Upstash / Redis (217ms round-trip) ──
        if self._redis_ready():
            ok, value = await self._redis_call(self.redis_client.get(prefixed_key))
            if not ok:
                # Redis errored/timed out AND L1 was empty — Mongo path.
                self._m_mongo_fallbacks += 1
                return None
            if value is None:
                # Genuine Redis miss AND L1 empty — Mongo path.
                self._m_misses += 1
                return None
            # Redis hit — decode and warm L1 for future 0ms hits.
            parsed = value
            if isinstance(value, str):
                try:
                    parsed = json.loads(value)
                except json.JSONDecodeError:
                    parsed = value
            # Warm L1 with a SHORT TTL — we don't know the caller's
            # original TTL (that lives on the Redis key itself), so use
            # a tight 60s ceiling to keep L1 fresh AND bounded. Falls
            # back to Redis / Mongo after 60s, which is negligible cost
            # for a caller that already accepted a Redis round-trip.
            _l1_put(prefixed_key, parsed, ttl_seconds=min(60.0, self.default_ttl))
            self._m_hits += 1
            return parsed

        # No Redis, no L1 → true miss.
        self._m_misses += 1
        if self.use_redis:
            # Redis was configured but currently unhealthy — count the
            # forced Mongo fallback.
            self._m_mongo_fallbacks += 1
        return None
    
    async def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache. Returns False on Redis failure but NEVER
        raises — the caller's user-facing operation succeeds regardless.

        Feb 20 2026 — ALWAYS mirror to in-process memory (not only on
        Redis failure) so a subsequent GET can fall back to memory if
        Redis times out. This is what makes the two-level cache
        actually effective under intermittent Upstash flakiness.

        Feb 21 2026 — Redis SET is now FIRE-AND-FORGET (scheduled as a
        background task with `asyncio.create_task`) so the caller's
        response is NOT blocked on a 217ms Upstash round-trip. L1 memory
        write is synchronous (0ms) so subsequent GETs in the same pod
        see the new value immediately.
        """
        prefixed_key = f"{CACHE_ENV_PREFIX}:{key}"
        ttl = ttl or self.default_ttl
        try:
            json_value = json.dumps(value, default=str)
        except Exception as e:
            self._m_sets_fail += 1
            try:
                print(f"⚠️ Cache set JSON encode error: {e}")
            except Exception:
                pass
            return False

        # ── L1 SYNC: always mirror to memory (0ms, LRU-bounded) ──
        _l1_put(prefixed_key, value, ttl_seconds=ttl)

        # ── L2 ASYNC: fire-and-forget Redis SET (don't block caller) ──
        if self._redis_ready():
            async def _bg_redis_set():
                ok, _ = await self._redis_call(
                    self.redis_client.setex(prefixed_key, ttl, json_value)
                )
                if ok:
                    self._m_sets_ok += 1
                else:
                    self._m_sets_fail += 1

            try:
                asyncio.create_task(_bg_redis_set())
            except RuntimeError:
                # No running loop (should never happen inside request path);
                # skip Redis write, L1 already updated.
                pass
            # Optimistically count the L1 write as a success; the async
            # task will correct _sets_fail if Redis rejects the write.
            self._m_sets_ok += 1
            return True
        self._m_sets_ok += 1
        return True
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache with environment prefix. Never raises.

        Feb 21 2026 — Redis DELETE is fire-and-forget (background task)
        so the caller isn't blocked on a 217ms Upstash round-trip. L1
        memory delete is synchronous.
        """
        prefixed_key = f"{CACHE_ENV_PREFIX}:{key}"
        _memory_cache.pop(prefixed_key, None)
        _cache_expiry.pop(prefixed_key, None)
        if self._redis_ready():
            async def _bg_redis_delete():
                ok, _ = await self._redis_call(self.redis_client.delete(prefixed_key))
                if ok:
                    self._m_deletes_ok += 1
                else:
                    self._m_deletes_fail += 1

            try:
                asyncio.create_task(_bg_redis_delete())
            except RuntimeError:
                pass
            self._m_deletes_ok += 1
            return True
        self._m_deletes_ok += 1
        return True
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern with environment prefix. Never raises."""
        prefixed_pattern = f"{CACHE_ENV_PREFIX}:{pattern}"
        # Always clean in-memory first
        try:
            import fnmatch
            mem_hits = [k for k in list(_memory_cache.keys()) if fnmatch.fnmatch(k, prefixed_pattern)]
            for k in mem_hits:
                _memory_cache.pop(k, None)
                _cache_expiry.pop(k, None)
        except Exception:
            mem_hits = []

        if self._redis_ready():
            if self.use_upstash:
                # Upstash doesn't support SCAN — fall back to exact-key delete
                ok, _ = await self._redis_call(self.redis_client.delete(prefixed_pattern))
                if ok:
                    self._m_deletes_ok += 1
                    return 1 + len(mem_hits)
                self._m_deletes_fail += 1
                return len(mem_hits)
            # Local redis — use scan_iter (also under timeout)
            try:
                keys = []
                async def _scan():
                    async for k in self.redis_client.scan_iter(match=prefixed_pattern):
                        keys.append(k)
                        if len(keys) >= 1000:  # cap defensive
                            break
                    return keys
                ok, collected = await self._redis_call(_scan())
                if ok and collected:
                    ok2, _ = await self._redis_call(self.redis_client.delete(*collected))
                    if ok2:
                        self._m_deletes_ok += 1
                        return len(collected) + len(mem_hits)
                self._m_deletes_fail += 1
                return len(mem_hits)
            except Exception:
                self._m_deletes_fail += 1
                return len(mem_hits)
        return len(mem_hits)
    
    async def flush_all(self) -> bool:
        """Clear all cache. Never raises."""
        _memory_cache.clear()
        _cache_expiry.clear()
        if self._redis_ready():
            ok, _ = await self._redis_call(self.redis_client.flushdb())
            return bool(ok)
        return True
    
    async def incr(self, key: str, amount: int = 1) -> int:
        """Increment a counter atomically. Never raises. Falls back to
        in-memory counter on Redis failure — NOTE: this fallback is NOT
        distributed-safe. Callers that require strict atomicity across
        workers (e.g. rate limiter) should treat 0 as "unknown".

        Feb 22 2026: in-memory fallback now uses the bounded LRU (with a
        60s default expiry so orphaned counters never leak).
        """
        if self._redis_ready():
            ok, val = await self._redis_call(self.redis_client.incrby(key, amount))
            if ok:
                try:
                    return int(val or 0)
                except (TypeError, ValueError):
                    return 0
            # fall through to in-memory
        current = _memory_cache.get(key, 0)
        try:
            new_value = int(current) + amount
        except (TypeError, ValueError):
            new_value = amount
        # Give orphaned rate-limit counters a default 60s TTL so they
        # don't accumulate forever when Redis is unavailable.
        existing_ttl = _cache_expiry.get(key)
        if existing_ttl:
            ttl_remaining = max(0.0, existing_ttl - datetime.now(timezone.utc).timestamp())
        else:
            ttl_remaining = 60.0
        _l1_put(key, new_value, ttl_seconds=ttl_remaining)
        return new_value
    
    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration on a key. Never raises."""
        if self._redis_ready():
            ok, _ = await self._redis_call(self.redis_client.expire(key, ttl))
            if ok:
                return True
        if key in _memory_cache:
            _cache_expiry[key] = datetime.now(timezone.utc).timestamp() + ttl
        return True
    
    async def get_stats(self) -> dict:
        """Return live cache stats + resilience telemetry.

        Includes hit/miss/error counters and circuit-breaker snapshot so
        the admin dashboard can spot Redis health issues at a glance.
        """
        base = {
            "connection_type": self.connection_type,
            "use_redis": self.use_redis,
            "use_upstash": self.use_upstash,
            "op_timeout_ms": int(self._op_timeout * 1000),
            "circuit_breaker": self._breaker.snapshot(),
            "l1_memory": {
                "size": len(_memory_cache),
                "max": L1_MAX_ENTRIES,
                "utilization_pct": round((len(_memory_cache) / L1_MAX_ENTRIES) * 100.0, 2) if L1_MAX_ENTRIES else 0.0,
                "inserts": _l1_stats["inserts"],
                "evictions": _l1_stats["evictions"],
                "sweeps": _l1_stats["sweeps"],
                "expired_swept": _l1_stats["expired_swept"],
            },
            "counters": {
                "hits": self._m_hits,
                "misses": self._m_misses,
                "errors": self._m_errors,
                "timeouts": self._m_timeouts,
                "circuit_skips": self._m_circuit_skips,
                "mongo_fallbacks": self._m_mongo_fallbacks,
                "sets_ok": self._m_sets_ok,
                "sets_fail": self._m_sets_fail,
                "deletes_ok": self._m_deletes_ok,
                "deletes_fail": self._m_deletes_fail,
            },
        }
        total_reads = self._m_hits + self._m_misses
        base["hit_rate_pct"] = round((self._m_hits / total_reads) * 100.0, 2) if total_reads else 0.0
        try:
            if self.use_redis and self.redis_client and not self._breaker.is_open():
                if self.use_upstash:
                    base["type"] = "upstash_redis"
                    base["connected"] = True
                    base["keys"] = "N/A (Upstash)"
                    base["memory_used"] = "N/A (Upstash managed)"
                else:
                    ok_info, info = await self._redis_call(self.redis_client.info("memory"))
                    ok_size, keys_count = await self._redis_call(self.redis_client.dbsize())
                    base["type"] = "local_redis"
                    base["connected"] = bool(ok_info)
                    base["keys"] = keys_count if ok_size else "unknown"
                    if ok_info and isinstance(info, dict):
                        base["memory_used"] = info.get("used_memory_human", "N/A")
                        base["memory_peak"] = info.get("used_memory_peak_human", "N/A")
            else:
                base["type"] = "in_memory"
                base["connected"] = True
                base["keys"] = len(_memory_cache)
                base["memory_used"] = "N/A"
        except Exception as e:
            base["type"] = "unknown"
            base["connected"] = False
            base["error"] = str(e)
        return base

    def reset_counters(self) -> None:
        """Zero out all metric counters (admin op). Leaves cache data
        intact. Useful for baselining after a deploy or incident.
        """
        self._m_hits = 0
        self._m_misses = 0
        self._m_errors = 0
        self._m_timeouts = 0
        self._m_circuit_skips = 0
        self._m_mongo_fallbacks = 0
        self._m_sets_ok = 0
        self._m_sets_fail = 0
        self._m_deletes_ok = 0
        self._m_deletes_fail = 0


# Global cache instance
cache = CacheManager()


# ============ RATE LIMITING ============

class RateLimiter:
    """
    Distributed rate limiter using Redis
    Implements sliding window counter algorithm
    """
    
    RATE_LIMIT_PREFIX = "rate_limit:"
    
    @staticmethod
    async def is_allowed(identifier: str, endpoint: str = "global", 
                        max_requests: int = 60, window_seconds: int = 60) -> tuple:
        """
        Check if request is allowed under rate limit
        Returns: (allowed: bool, remaining: int, reset_in: int)
        """
        try:
            key = f"{RateLimiter.RATE_LIMIT_PREFIX}{identifier}:{endpoint}"
            
            # Get current count
            current = await cache.get(key)
            current_count = int(current) if current else 0
            
            if current_count >= max_requests:
                # Rate limit exceeded
                return False, 0, window_seconds
            
            # Increment counter
            new_count = await cache.incr(key)
            
            # Set expiry on first request
            if new_count == 1:
                await cache.expire(key, window_seconds)
            
            remaining = max(0, max_requests - new_count)
            return True, remaining, window_seconds
            
        except Exception as e:
            print(f"Rate limiter error: {e}")
            # Fail open - allow request on error
            return True, max_requests, 0
    
    @staticmethod
    async def get_status(identifier: str, endpoint: str = "global", 
                        max_requests: int = 60) -> dict:
        """Get current rate limit status for identifier"""
        try:
            key = f"{RateLimiter.RATE_LIMIT_PREFIX}{identifier}:{endpoint}"
            current = await cache.get(key)
            current_count = int(current) if current else 0
            
            return {
                "identifier": identifier,
                "endpoint": endpoint,
                "current": current_count,
                "limit": max_requests,
                "remaining": max(0, max_requests - current_count)
            }
        except Exception as e:
            return {"error": str(e)}


# ============ CACHE KEY GENERATORS ============

def user_cache_key(uid: str) -> str:
    return f"user:{uid}"

def user_stats_key(uid: str) -> str:
    return f"user_stats:{uid}"

def user_balance_key(uid: str) -> str:
    return f"balance:{uid}"

def admin_stats_key() -> str:
    return "admin:stats"

def leaderboard_key(period: str = "all") -> str:
    return f"leaderboard:{period}"

def referral_tree_key(uid: str) -> str:
    return f"referral_tree:{uid}"

def global_stats_key() -> str:
    return "global:stats"

def product_list_key() -> str:
    return "products:list"

def notification_count_key(uid: str) -> str:
    return f"notification_count:{uid}"

def session_key(session_id: str) -> str:
    return f"session:{session_id}"


# ============ CACHE DECORATORS ============

def cached(ttl: int = 300, key_prefix: str = ""):
    """
    Decorator to cache function results
    
    Usage:
    @cached(ttl=600, key_prefix="user_data")
    async def get_user_data(uid: str):
        ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Try to get from cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            if result is not None:
                await cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


def invalidate_cache(*keys):
    """
    Decorator to invalidate cache keys after function execution
    
    Usage:
    @invalidate_cache("user:{uid}", "user_stats:{uid}")
    async def update_user(uid: str, data: dict):
        ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # Invalidate specified cache keys
            for key_template in keys:
                # Replace placeholders with actual values
                key = key_template
                if "{uid}" in key and args:
                    key = key.replace("{uid}", str(args[0]))
                for k, v in kwargs.items():
                    key = key.replace(f"{{{k}}}", str(v))
                
                await cache.delete(key)
            
            return result
        return wrapper
    return decorator


# ============ CACHE TTL CONSTANTS ============

class CacheTTL:
    """Cache TTL values in seconds"""
    
    # Short-lived (real-time data)
    VERY_SHORT = 30        # 30 seconds
    SHORT = 60             # 1 minute
    
    # Medium-lived (frequently changing)
    MEDIUM = 300           # 5 minutes
    MEDIUM_LONG = 600      # 10 minutes
    
    # Long-lived (rarely changing)
    LONG = 1800            # 30 minutes
    VERY_LONG = 3600       # 1 hour
    
    # Static data
    STATIC = 86400         # 24 hours
    
    # Specific use cases
    USER_BALANCE = 60      # Balance changes frequently
    USER_PROFILE = 300     # Profile changes less often
    LEADERBOARD = 300      # Update every 5 mins
    ADMIN_STATS = 120      # Admin dashboard stats
    PRODUCTS = 1800        # Product list
    GLOBAL_STATS = 180     # Public stats
    RATE_LIMIT = 60        # Rate limit window
    SESSION = 86400        # Session TTL (24 hours)
