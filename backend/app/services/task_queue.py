"""
PARAS REWARD - Background Task Service
======================================
Simple database-backed task queue for background processing.
No external dependencies (Redis/Celery) required.

Features:
- Task scheduling with retry support
- Failed task tracking
- Automatic retry with exponential backoff
- Task status monitoring
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Callable, List
from enum import Enum
import traceback
import uuid

from app.core.database import get_sync_db


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRY_SCHEDULED = "retry_scheduled"
    MAX_RETRIES_EXCEEDED = "max_retries_exceeded"


class TaskQueue:
    """
    Simple in-memory + database backed task queue.
    Tasks are persisted to DB for recovery after restarts.
    """
    
    # Registered task handlers
    _handlers: Dict[str, Callable] = {}
    
    # Background worker running flag
    _running = False
    _worker_task = None
    
    # Retry configuration
    DEFAULT_MAX_RETRIES = 3
    RETRY_DELAYS = [60, 300, 1800]  # 1 min, 5 min, 30 min
    
    @classmethod
    def register(cls, task_name: str):
        """Decorator to register a task handler."""
        def decorator(func):
            cls._handlers[task_name] = func
            logging.info(f"[TaskQueue] Registered handler: {task_name}")
            return func
        return decorator
    
    @classmethod
    async def enqueue(
        cls,
        task_name: str,
        payload: Dict[str, Any],
        max_retries: int = None,
        delay_seconds: int = 0,
        priority: int = 5
    ) -> str:
        """
        Add a task to the queue.
        
        Args:
            task_name: Name of registered task handler
            payload: Data to pass to handler
            max_retries: Max retry attempts (default 3)
            delay_seconds: Delay before execution
            priority: 1-10, lower = higher priority
        
        Returns:
            Task ID
        """
        if task_name not in cls._handlers:
            raise ValueError(f"Unknown task: {task_name}")
        
        db = get_sync_db()
        
        task_id = f"TASK-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:8].upper()}"
        
        scheduled_at = datetime.now(timezone.utc)
        if delay_seconds > 0:
            scheduled_at += timedelta(seconds=delay_seconds)
        
        task_doc = {
            "task_id": task_id,
            "task_name": task_name,
            "payload": payload,
            "status": TaskStatus.PENDING.value,
            "priority": priority,
            "retry_count": 0,
            "max_retries": max_retries or cls.DEFAULT_MAX_RETRIES,
            "scheduled_at": scheduled_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "result": None,
            "error": None
        }
        
        db.task_queue.insert_one(task_doc)
        
        logging.info(f"[TaskQueue] Enqueued: {task_id} ({task_name})")
        
        return task_id
    
    @classmethod
    async def process_one(cls) -> bool:
        """
        Process one pending task.
        Returns True if a task was processed.
        """
        db = get_sync_db()
        now = datetime.now(timezone.utc).isoformat()
        
        # Find next pending task
        task = db.task_queue.find_one_and_update(
            {
                "status": {"$in": [TaskStatus.PENDING.value, TaskStatus.RETRY_SCHEDULED.value]},
                "scheduled_at": {"$lte": now}
            },
            {
                "$set": {
                    "status": TaskStatus.PROCESSING.value,
                    "started_at": now,
                    "updated_at": now
                }
            },
            sort=[("priority", 1), ("scheduled_at", 1)],
            return_document=True
        )
        
        if not task:
            return False
        
        task_id = task["task_id"]
        task_name = task["task_name"]
        
        logging.info(f"[TaskQueue] Processing: {task_id} ({task_name})")
        
        handler = cls._handlers.get(task_name)
        if not handler:
            cls._mark_failed(task_id, f"Handler not found: {task_name}")
            return True
        
        try:
            # Execute handler
            if asyncio.iscoroutinefunction(handler):
                result = await handler(task["payload"])
            else:
                result = handler(task["payload"])
            
            # Mark completed
            db.task_queue.update_one(
                {"task_id": task_id},
                {
                    "$set": {
                        "status": TaskStatus.COMPLETED.value,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "result": result
                    }
                }
            )
            
            logging.info(f"[TaskQueue] Completed: {task_id}")
            return True
            
        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            logging.error(f"[TaskQueue] Failed: {task_id} - {error_msg}")
            
            # Check if can retry
            retry_count = task.get("retry_count", 0) + 1
            max_retries = task.get("max_retries", cls.DEFAULT_MAX_RETRIES)
            
            if retry_count < max_retries:
                # Schedule retry with exponential backoff
                delay_index = min(retry_count - 1, len(cls.RETRY_DELAYS) - 1)
                delay = cls.RETRY_DELAYS[delay_index]
                next_run = datetime.now(timezone.utc) + timedelta(seconds=delay)
                
                db.task_queue.update_one(
                    {"task_id": task_id},
                    {
                        "$set": {
                            "status": TaskStatus.RETRY_SCHEDULED.value,
                            "retry_count": retry_count,
                            "scheduled_at": next_run.isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "last_error": error_msg
                        }
                    }
                )
                
                logging.info(f"[TaskQueue] Retry scheduled: {task_id} (attempt {retry_count}/{max_retries}) in {delay}s")
            else:
                cls._mark_failed(task_id, error_msg)
            
            return True
    
    @classmethod
    def _mark_failed(cls, task_id: str, error: str):
        """Mark task as permanently failed."""
        db = get_sync_db()
        db.task_queue.update_one(
            {"task_id": task_id},
            {
                "$set": {
                    "status": TaskStatus.MAX_RETRIES_EXCEEDED.value,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "error": error
                }
            }
        )
        logging.error(f"[TaskQueue] Max retries exceeded: {task_id}")
    
    @classmethod
    async def start_worker(cls, interval: float = 5.0):
        """Start background worker to process tasks."""
        if cls._running:
            return
        
        cls._running = True
        logging.info("[TaskQueue] Worker started")
        
        while cls._running:
            try:
                processed = await cls.process_one()
                if not processed:
                    await asyncio.sleep(interval)
            except Exception as e:
                logging.error(f"[TaskQueue] Worker error: {e}")
                await asyncio.sleep(interval)
    
    @classmethod
    def stop_worker(cls):
        """Stop background worker."""
        cls._running = False
        logging.info("[TaskQueue] Worker stopped")
    
    @classmethod
    def get_stats(cls) -> Dict[str, Any]:
        """Get task queue statistics."""
        db = get_sync_db()
        
        pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        
        results = list(db.task_queue.aggregate(pipeline))
        stats = {r["_id"]: r["count"] for r in results}
        
        return {
            "pending": stats.get(TaskStatus.PENDING.value, 0),
            "processing": stats.get(TaskStatus.PROCESSING.value, 0),
            "completed": stats.get(TaskStatus.COMPLETED.value, 0),
            "failed": stats.get(TaskStatus.MAX_RETRIES_EXCEEDED.value, 0),
            "retry_scheduled": stats.get(TaskStatus.RETRY_SCHEDULED.value, 0),
            "total": sum(stats.values())
        }
    
    @classmethod
    def get_failed_tasks(cls, limit: int = 50) -> List[Dict]:
        """Get list of failed tasks."""
        db = get_sync_db()
        
        return list(db.task_queue.find(
            {"status": TaskStatus.MAX_RETRIES_EXCEEDED.value},
            {"_id": 0}
        ).sort("updated_at", -1).limit(limit))
    
    @classmethod
    async def retry_failed(cls, task_id: str) -> bool:
        """Manually retry a failed task."""
        db = get_sync_db()
        
        result = db.task_queue.update_one(
            {"task_id": task_id, "status": TaskStatus.MAX_RETRIES_EXCEEDED.value},
            {
                "$set": {
                    "status": TaskStatus.PENDING.value,
                    "retry_count": 0,
                    "scheduled_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "error": None
                }
            }
        )
        
        return result.modified_count > 0


# ==================== BUILT-IN TASK HANDLERS ====================

@TaskQueue.register("send_notification")
async def handle_notification(payload: Dict):
    """Send notification to user."""
    # Import here to avoid circular imports
    from app.core.database import get_sync_db
    
    db = get_sync_db()
    user_id = payload.get("user_id")
    message = payload.get("message")
    notification_type = payload.get("type", "info")
    
    db.notifications.insert_one({
        "user_id": user_id,
        "message": message,
        "type": notification_type,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"sent": True}


@TaskQueue.register("process_referral_bonus")
async def handle_referral_bonus(payload: Dict):
    """Process referral bonus in background."""
    from app.services import WalletService
    
    user_id = payload.get("user_id")
    amount = payload.get("amount")
    referrer_id = payload.get("referrer_id")
    
    result = WalletService.credit(
        user_id=referrer_id,
        amount=amount,
        txn_type="referral_bonus",
        description=f"Referral bonus from {user_id}",
        reference=f"REF-{user_id[:8]}"
    )
    
    return result


@TaskQueue.register("retry_failed_transfer")
async def handle_retry_transfer(payload: Dict):
    """Retry a failed bank transfer."""
    # This would contain actual transfer retry logic
    request_id = payload.get("request_id")
    logging.info(f"[Task] Retrying transfer: {request_id}")
    
    # For now, just log - actual implementation would call bank API
    return {"retried": True, "request_id": request_id}
