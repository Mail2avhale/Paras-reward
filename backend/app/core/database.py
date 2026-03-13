"""
PARAS REWARD - Database Connection Manager
==========================================
Manages MongoDB connections with auto-reconnect capability.

Usage:
    from app.core.database import get_db, get_sync_db
"""

import os
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import MongoClient
from pymongo.database import Database

from .config import settings


# Global database instances
_async_client: Optional[AsyncIOMotorClient] = None
_async_db: Optional[AsyncIOMotorDatabase] = None
_sync_client: Optional[MongoClient] = None
_sync_db: Optional[Database] = None


async def get_async_db() -> AsyncIOMotorDatabase:
    """
    Get async MongoDB database instance.
    Creates connection if not exists.
    """
    global _async_client, _async_db
    
    if _async_db is None:
        _async_client = AsyncIOMotorClient(settings.MONGO_URL)
        _async_db = _async_client[settings.DB_NAME]
        logging.info(f"[DB] Async connection established to {settings.DB_NAME}")
    
    return _async_db


def get_sync_db() -> Database:
    """
    Get sync MongoDB database instance.
    Used for operations that can't be async.
    """
    global _sync_client, _sync_db
    
    if _sync_db is None:
        _sync_client = MongoClient(settings.MONGO_URL)
        _sync_db = _sync_client[settings.DB_NAME]
        logging.info(f"[DB] Sync connection established to {settings.DB_NAME}")
    
    return _sync_db


async def check_db_health() -> bool:
    """Check if database connection is healthy."""
    try:
        db = await get_async_db()
        await db.command("ping")
        return True
    except Exception as e:
        logging.error(f"[DB] Health check failed: {e}")
        return False


async def close_connections():
    """Close all database connections."""
    global _async_client, _async_db, _sync_client, _sync_db
    
    if _async_client:
        _async_client.close()
        _async_client = None
        _async_db = None
        
    if _sync_client:
        _sync_client.close()
        _sync_client = None
        _sync_db = None
    
    logging.info("[DB] All connections closed")


# Alias for backward compatibility
def get_db():
    """Alias for get_sync_db() - backward compatibility."""
    return get_sync_db()
