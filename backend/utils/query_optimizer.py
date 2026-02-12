"""
Query Optimizer - Database query optimization utilities
Provides caching, projection defaults, and query helpers
"""

from functools import wraps
from datetime import datetime, timezone, timedelta
import asyncio
import logging

# In-memory cache for frequently accessed data
_cache = {}
_cache_expiry = {}

DEFAULT_PROJECTIONS = {
    "users": {
        "basic": {"_id": 0, "uid": 1, "name": 1, "email": 1, "subscription_plan": 1},
        "profile": {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "city": 1, "state": 1, "subscription_plan": 1, "prc_balance": 1, "kyc_status": 1},
        "admin_list": {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "subscription_plan": 1, "created_at": 1, "kyc_status": 1, "prc_balance": 1}
    },
    "vip_payments": {
        "list": {"_id": 0, "payment_id": 1, "user_id": 1, "amount": 1, "subscription_plan": 1, "plan_type": 1, "status": 1, "submitted_at": 1, "screenshot_url": 1, "utr_number": 1},
        "detail": {"_id": 0}
    },
    "notifications": {
        "list": {"_id": 0, "notification_id": 1, "title": 1, "message": 1, "type": 1, "icon": 1, "action_url": 1, "read": 1, "is_read": 1, "created_at": 1}
    },
    "transactions": {
        "list": {"_id": 0, "transaction_id": 1, "type": 1, "amount": 1, "description": 1, "created_at": 1}
    }
}


def get_projection(collection: str, projection_type: str = "basic"):
    """Get default projection for a collection"""
    return DEFAULT_PROJECTIONS.get(collection, {}).get(projection_type, {"_id": 0})


async def cached_count(db, collection: str, query: dict, ttl: int = 60):
    """Cached count_documents with TTL"""
    cache_key = f"count:{collection}:{str(query)}"
    now = datetime.now(timezone.utc)
    
    if cache_key in _cache and cache_key in _cache_expiry:
        if _cache_expiry[cache_key] > now:
            return _cache[cache_key]
    
    count = await db[collection].count_documents(query)
    _cache[cache_key] = count
    _cache_expiry[cache_key] = now + timedelta(seconds=ttl)
    return count


async def cached_aggregate(db, collection: str, pipeline: list, cache_key: str, ttl: int = 60):
    """Cached aggregation with TTL"""
    full_key = f"agg:{collection}:{cache_key}"
    now = datetime.now(timezone.utc)
    
    if full_key in _cache and full_key in _cache_expiry:
        if _cache_expiry[full_key] > now:
            return _cache[full_key]
    
    result = await db[collection].aggregate(pipeline).to_list(1000)
    _cache[full_key] = result
    _cache_expiry[full_key] = now + timedelta(seconds=ttl)
    return result


def clear_cache(pattern: str = None):
    """Clear cache entries matching pattern or all"""
    global _cache, _cache_expiry
    if pattern:
        keys_to_delete = [k for k in _cache.keys() if pattern in k]
        for key in keys_to_delete:
            _cache.pop(key, None)
            _cache_expiry.pop(key, None)
    else:
        _cache = {}
        _cache_expiry = {}


# Optimized query builders
def build_user_lookup_query(user_ids: list) -> dict:
    """Build optimized query for batch user lookup"""
    return {"uid": {"$in": user_ids}}


def build_date_range_query(field: str, start_date: datetime, end_date: datetime = None) -> dict:
    """Build optimized date range query"""
    if end_date:
        return {field: {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}
    return {field: {"$gte": start_date.isoformat()}}


# Batch operations for efficiency
async def batch_user_lookup(db, user_ids: list, projection: dict = None) -> dict:
    """Lookup multiple users in single query, return as dict keyed by uid"""
    if not user_ids:
        return {}
    
    if projection is None:
        projection = DEFAULT_PROJECTIONS["users"]["basic"]
    
    users = await db.users.find(
        {"uid": {"$in": list(set(user_ids))}},
        projection
    ).to_list(len(user_ids))
    
    return {u["uid"]: u for u in users}


async def get_user_with_cache(db, uid: str, projection: dict = None, ttl: int = 300):
    """Get user with caching"""
    cache_key = f"user:{uid}"
    now = datetime.now(timezone.utc)
    
    if cache_key in _cache and cache_key in _cache_expiry:
        if _cache_expiry[cache_key] > now:
            return _cache[cache_key]
    
    if projection is None:
        projection = DEFAULT_PROJECTIONS["users"]["profile"]
    
    user = await db.users.find_one({"uid": uid}, projection)
    if user:
        _cache[cache_key] = user
        _cache_expiry[cache_key] = now + timedelta(seconds=ttl)
    
    return user


def invalidate_user_cache(uid: str):
    """Invalidate user cache when user data changes"""
    cache_key = f"user:{uid}"
    _cache.pop(cache_key, None)
    _cache_expiry.pop(cache_key, None)
