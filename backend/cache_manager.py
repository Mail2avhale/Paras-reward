"""
Cache Manager for Paras Rewards Platform
Implements Redis caching with Upstash Redis (HTTP-based) support
Includes fallback to local Redis and in-memory cache
"""

import os
import json
import hashlib
from datetime import datetime, timezone
from typing import Optional, Any, Callable
from functools import wraps
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

# In-memory cache fallback
_memory_cache = {}
_cache_expiry = {}


class CacheManager:
    """
    Unified cache manager supporting:
    1. Upstash Redis (HTTP-based, cloud hosted) - PREFERRED
    2. Local Redis (TCP-based)
    3. In-memory fallback
    """
    
    def __init__(self):
        self.redis_client = None
        self.use_redis = False
        self.use_upstash = False
        self.default_ttl = 300  # 5 minutes default
        self.connection_type = "none"
        
    async def initialize(self):
        """Initialize Redis connection - tries Upstash first, then local Redis, then in-memory"""
        
        # 1. Try Upstash Redis first (recommended for production)
        upstash_url = os.environ.get("UPSTASH_REDIS_REST_URL")
        upstash_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
        
        if UPSTASH_AVAILABLE and upstash_url and upstash_token:
            try:
                self.redis_client = UpstashRedis(url=upstash_url, token=upstash_token)
                # Test connection
                await self.redis_client.ping()
                self.use_redis = True
                self.use_upstash = True
                self.connection_type = "upstash"
                print(f"✅ Upstash Redis connected successfully")
                return
            except Exception as e:
                print(f"⚠️ Upstash Redis connection failed: {e}")
        
        # 2. Try local Redis as fallback
        if REDIS_AVAILABLE:
            redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
            try:
                self.redis_client = redis.from_url(
                    redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
                await self.redis_client.ping()
                self.use_redis = True
                self.use_upstash = False
                self.connection_type = "local_redis"
                print(f"✅ Local Redis connected: {redis_url}")
                return
            except Exception as e:
                print(f"⚠️ Redis connection failed: {e}")
        
        # 3. Fall back to in-memory cache
        print("📦 Falling back to in-memory cache")
        self.use_redis = False
        self.use_upstash = False
        self.connection_type = "in_memory"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            if self.use_redis and self.redis_client:
                value = await self.redis_client.get(key)
                if value:
                    # Upstash returns string, local redis with decode_responses also returns string
                    if isinstance(value, str):
                        try:
                            return json.loads(value)
                        except json.JSONDecodeError:
                            return value
                    return value
            else:
                # In-memory fallback
                if key in _memory_cache:
                    expiry = _cache_expiry.get(key)
                    if expiry and datetime.now(timezone.utc).timestamp() > expiry:
                        del _memory_cache[key]
                        del _cache_expiry[key]
                        return None
                    return _memory_cache.get(key)
        except Exception as e:
            print(f"Cache get error: {e}")
        return None
    
    async def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache with optional TTL (seconds)"""
        ttl = ttl or self.default_ttl
        try:
            json_value = json.dumps(value, default=str)
            
            if self.use_redis and self.redis_client:
                if self.use_upstash:
                    # Upstash uses setex method
                    await self.redis_client.setex(key, ttl, json_value)
                else:
                    # Local redis
                    await self.redis_client.setex(key, ttl, json_value)
            else:
                # In-memory fallback
                _memory_cache[key] = value
                _cache_expiry[key] = datetime.now(timezone.utc).timestamp() + ttl
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            if self.use_redis and self.redis_client:
                await self.redis_client.delete(key)
            else:
                _memory_cache.pop(key, None)
                _cache_expiry.pop(key, None)
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        try:
            if self.use_redis and self.redis_client:
                if self.use_upstash:
                    # Upstash doesn't support SCAN, so we need to track keys differently
                    # For now, just delete the exact pattern key
                    await self.redis_client.delete(pattern)
                    return 1
                else:
                    # Local redis supports scan_iter
                    keys = []
                    async for key in self.redis_client.scan_iter(match=pattern):
                        keys.append(key)
                    if keys:
                        await self.redis_client.delete(*keys)
                    return len(keys)
            else:
                # In-memory fallback
                import fnmatch
                keys_to_delete = [k for k in _memory_cache.keys() if fnmatch.fnmatch(k, pattern)]
                for k in keys_to_delete:
                    _memory_cache.pop(k, None)
                    _cache_expiry.pop(k, None)
                return len(keys_to_delete)
        except Exception as e:
            print(f"Cache delete pattern error: {e}")
            return 0
    
    async def flush_all(self) -> bool:
        """Clear all cache"""
        try:
            if self.use_redis and self.redis_client:
                if self.use_upstash:
                    # Upstash: Use FLUSHDB command
                    await self.redis_client.flushdb()
                else:
                    await self.redis_client.flushdb()
            else:
                _memory_cache.clear()
                _cache_expiry.clear()
            return True
        except Exception as e:
            print(f"Cache flush error: {e}")
            return False
    
    async def incr(self, key: str, amount: int = 1) -> int:
        """Increment a counter atomically"""
        try:
            if self.use_redis and self.redis_client:
                if self.use_upstash:
                    return await self.redis_client.incrby(key, amount)
                else:
                    return await self.redis_client.incrby(key, amount)
            else:
                # In-memory fallback
                current = _memory_cache.get(key, 0)
                new_value = int(current) + amount
                _memory_cache[key] = new_value
                return new_value
        except Exception as e:
            print(f"Cache incr error: {e}")
            return 0
    
    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration on a key"""
        try:
            if self.use_redis and self.redis_client:
                await self.redis_client.expire(key, ttl)
            else:
                # In-memory fallback
                if key in _memory_cache:
                    _cache_expiry[key] = datetime.now(timezone.utc).timestamp() + ttl
            return True
        except Exception as e:
            print(f"Cache expire error: {e}")
            return False
    
    async def get_stats(self) -> dict:
        """Get cache statistics"""
        try:
            if self.use_redis and self.redis_client:
                if self.use_upstash:
                    # Upstash provides limited info
                    return {
                        "type": "upstash_redis",
                        "connected": True,
                        "connection_type": self.connection_type,
                        "keys": "N/A (Upstash)",
                        "memory_used": "N/A (Upstash managed)"
                    }
                else:
                    info = await self.redis_client.info("memory")
                    keys_count = await self.redis_client.dbsize()
                    return {
                        "type": "local_redis",
                        "connected": True,
                        "connection_type": self.connection_type,
                        "keys": keys_count,
                        "memory_used": info.get("used_memory_human", "N/A"),
                        "memory_peak": info.get("used_memory_peak_human", "N/A")
                    }
            else:
                return {
                    "type": "in_memory",
                    "connected": True,
                    "connection_type": self.connection_type,
                    "keys": len(_memory_cache),
                    "memory_used": "N/A"
                }
        except Exception as e:
            return {"type": "unknown", "connected": False, "error": str(e)}


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
