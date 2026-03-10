"""
MongoDB Connection Manager for Reliable & Fast Database Connections
====================================================================
Provides:
1. Connection pooling with health monitoring
2. Automatic reconnection on failure
3. Query timeout handling
4. Connection warmup on startup
5. Graceful degradation under load
"""

import os
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseConnectionManager:
    """
    Manages MongoDB connections with reliability features:
    - Connection pool management
    - Health monitoring
    - Auto-reconnection
    - Query timeout handling
    """
    
    def __init__(self):
        self._client: Optional[AsyncIOMotorClient] = None
        self._db: Optional[AsyncIOMotorDatabase] = None
        self._is_connected: bool = False
        self._connection_lock = asyncio.Lock()
        self._last_ping_time: Optional[float] = None
        self._ping_interval: int = 30  # Check connection every 30 seconds
        self._reconnect_attempts: int = 0
        self._max_reconnect_attempts: int = 10
        self._stats: Dict[str, Any] = {
            "total_queries": 0,
            "failed_queries": 0,
            "reconnections": 0,
            "last_error": None,
            "avg_query_time_ms": 0.0
        }
    
    def _get_connection_options(self, mongo_url: str) -> Dict[str, Any]:
        """Get optimized connection options based on environment"""
        is_atlas = 'mongodb+srv' in mongo_url or 'mongodb.net' in mongo_url
        
        # Base options for all environments
        options = {
            # Connection pool settings
            'maxPoolSize': 50,          # Increased for concurrent requests
            'minPoolSize': 5,           # Keep connections warm
            'maxIdleTimeMS': 120000,    # 2 min idle timeout
            'waitQueueTimeoutMS': 5000, # 5s wait for connection
            
            # Timeout settings
            'serverSelectionTimeoutMS': 5000,  # 5s to select server
            'connectTimeoutMS': 5000,          # 5s to connect
            'socketTimeoutMS': 30000,          # 30s socket timeout
            
            # Reliability settings
            'retryWrites': True,
            'retryReads': True,
            
            # Compression for network efficiency
            'compressors': ['zstd', 'snappy', 'zlib'],
            
            # Read preference
            'readPreference': 'primaryPreferred',
        }
        
        if is_atlas:
            # Atlas-specific options
            options.update({
                'w': 'majority',
                'tls': True,
                'tlsAllowInvalidCertificates': False,
                'appName': 'paras-reward-api',
                
                # Atlas optimizations
                'maxConnecting': 5,  # Parallel connection attempts
            })
            logger.info("🔒 MongoDB Atlas detected - TLS enabled")
        else:
            # Local MongoDB options
            options['directConnection'] = True
            logger.info("🏠 Local MongoDB detected")
        
        return options
    
    async def connect(self, mongo_url: str, db_name: str) -> AsyncIOMotorDatabase:
        """
        Establish database connection with warmup
        """
        async with self._connection_lock:
            if self._is_connected and self._client:
                return self._db
            
            try:
                logger.info("🔄 Connecting to MongoDB...")
                options = self._get_connection_options(mongo_url)
                
                self._client = AsyncIOMotorClient(mongo_url, **options)
                self._db = self._client[db_name]
                
                # Warmup: Ping to establish connection pool
                await self._warmup_connection()
                
                self._is_connected = True
                self._reconnect_attempts = 0
                logger.info("✅ MongoDB connection established and warmed up")
                
                # Start background health monitor
                asyncio.create_task(self._health_monitor())
                
                return self._db
                
            except Exception as e:
                logger.error(f"❌ MongoDB connection failed: {e}")
                self._stats["last_error"] = str(e)
                raise
    
    async def _warmup_connection(self):
        """
        Warm up the connection pool by executing initial queries
        """
        try:
            # Ping to establish first connection
            await self._client.admin.command('ping')
            
            # Execute a few parallel pings to warm up pool
            warmup_tasks = [
                self._client.admin.command('ping')
                for _ in range(3)
            ]
            await asyncio.gather(*warmup_tasks, return_exceptions=True)
            
            self._last_ping_time = time.time()
            logger.info("🔥 Connection pool warmed up")
            
        except Exception as e:
            logger.warning(f"⚠️ Warmup partial failure: {e}")
    
    async def _health_monitor(self):
        """
        Background task to monitor connection health
        """
        while True:
            try:
                await asyncio.sleep(self._ping_interval)
                
                if not self._is_connected:
                    continue
                
                # Check if connection is still alive
                start = time.time()
                await self._client.admin.command('ping')
                ping_ms = (time.time() - start) * 1000
                
                self._last_ping_time = time.time()
                
                if ping_ms > 1000:
                    logger.warning(f"⚠️ Slow DB ping: {ping_ms:.2f}ms")
                    
            except Exception as e:
                logger.error(f"❌ Health check failed: {e}")
                self._is_connected = False
                await self._try_reconnect()
    
    async def _try_reconnect(self):
        """
        Attempt to reconnect to database
        """
        async with self._connection_lock:
            if self._is_connected:
                return
            
            self._reconnect_attempts += 1
            self._stats["reconnections"] += 1
            
            if self._reconnect_attempts > self._max_reconnect_attempts:
                logger.error("❌ Max reconnection attempts reached")
                return
            
            try:
                backoff = min(30, 2 ** self._reconnect_attempts)
                logger.info(f"🔄 Reconnecting in {backoff}s (attempt {self._reconnect_attempts})")
                await asyncio.sleep(backoff)
                
                await self._client.admin.command('ping')
                self._is_connected = True
                self._reconnect_attempts = 0
                logger.info("✅ Reconnected to MongoDB")
                
            except Exception as e:
                logger.error(f"❌ Reconnection failed: {e}")
    
    @asynccontextmanager
    async def get_db(self):
        """
        Context manager for database access with automatic error handling
        """
        if not self._is_connected:
            raise Exception("Database not connected")
        
        start_time = time.time()
        try:
            yield self._db
            
            # Update stats
            query_time = (time.time() - start_time) * 1000
            self._stats["total_queries"] += 1
            self._stats["avg_query_time_ms"] = (
                (self._stats["avg_query_time_ms"] * (self._stats["total_queries"] - 1) + query_time)
                / self._stats["total_queries"]
            )
            
        except Exception as e:
            self._stats["failed_queries"] += 1
            self._stats["last_error"] = str(e)
            logger.error(f"❌ Query error: {e}")
            
            # Check if connection issue
            if "connection" in str(e).lower() or "timeout" in str(e).lower():
                self._is_connected = False
                asyncio.create_task(self._try_reconnect())
            
            raise
    
    @property
    def db(self) -> AsyncIOMotorDatabase:
        """Direct database access (for compatibility)"""
        if not self._db:
            raise Exception("Database not initialized. Call connect() first.")
        return self._db
    
    @property
    def is_connected(self) -> bool:
        return self._is_connected
    
    def get_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            **self._stats,
            "is_connected": self._is_connected,
            "last_ping": self._last_ping_time,
            "reconnect_attempts": self._reconnect_attempts
        }
    
    async def close(self):
        """Close database connection"""
        if self._client:
            self._client.close()
            self._is_connected = False
            self._client = None
            self._db = None
            logger.info("🔌 MongoDB connection closed")


# Global connection manager instance
db_manager = DatabaseConnectionManager()


async def init_database():
    """
    Initialize database connection - call this from app startup
    """
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if not mongo_url or not db_name:
        raise ValueError("MONGO_URL and DB_NAME environment variables required")
    
    return await db_manager.connect(mongo_url, db_name)


def get_database() -> AsyncIOMotorDatabase:
    """
    Get database instance - use this in route handlers
    """
    return db_manager.db


# Helper for async with pattern
@asynccontextmanager
async def db_session():
    """
    Context manager for database operations with error handling
    
    Usage:
        async with db_session() as db:
            await db.users.find_one(...)
    """
    async with db_manager.get_db() as db:
        yield db
