"""
Cache Manager for Paras Rewards Platform
Implements Redis caching for high-performance data access
"""

import os
import json
import hashlib
from datetime import datetime, timezone
from typing import Optional, Any, Callable
from functools import wraps

# Try to import redis, fallback to in-memory cache if not available
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("⚠️ Redis not available, using in-memory cache")

# In-memory cache fallback
_memory_cache = {}
_cache_expiry = {}


class CacheManager:
    """
    Unified cache manager supporting Redis and in-memory fallback
    """
    
    def __init__(self):
        self.redis_client = None
        self.use_redis = False
        self.default_ttl = 300  # 5 minutes default
        
    async def initialize(self):
        """Initialize Redis connection"""
        if not REDIS_AVAILABLE:
            print("📦 Using in-memory cache (Redis not installed)")
            return
            
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        
        try:
            self.redis_client = redis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await self.redis_client.ping()
            self.use_redis = True
            print(f"✅ Redis connected: {redis_url}")
        except Exception as e:
            print(f"⚠️ Redis connection failed: {e}")
            print("📦 Falling back to in-memory cache")
            self.use_redis = False
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            if self.use_redis and self.redis_client:
                value = await self.redis_client.get(key)
                if value:
                    return json.loads(value)
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
                await self.redis_client.flushdb()
            else:
                _memory_cache.clear()
                _cache_expiry.clear()
            return True
        except Exception as e:
            print(f"Cache flush error: {e}")
            return False
    
    async def get_stats(self) -> dict:
        """Get cache statistics"""
        try:
            if self.use_redis and self.redis_client:
                info = await self.redis_client.info("memory")
                keys_count = await self.redis_client.dbsize()
                return {
                    "type": "redis",
                    "connected": True,
                    "keys": keys_count,
                    "memory_used": info.get("used_memory_human", "N/A"),
                    "memory_peak": info.get("used_memory_peak_human", "N/A")
                }
            else:
                return {
                    "type": "in-memory",
                    "connected": True,
                    "keys": len(_memory_cache),
                    "memory_used": "N/A"
                }
        except Exception as e:
            return {"type": "unknown", "connected": False, "error": str(e)}


# Global cache instance
cache = CacheManager()


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
