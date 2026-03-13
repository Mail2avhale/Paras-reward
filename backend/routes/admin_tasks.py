"""
PARAS REWARD - Admin Task Queue Routes
======================================
Admin endpoints for managing background tasks.
"""

from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional
from datetime import datetime, timezone
import os

from app.services import TaskQueue, TaskStatus

router = APIRouter(prefix="/admin/tasks", tags=["Admin - Tasks"])


@router.get("/stats")
async def get_task_stats():
    """Get task queue statistics."""
    stats = TaskQueue.get_stats()
    
    return {
        "success": True,
        "stats": stats,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/failed")
async def get_failed_tasks(limit: int = Query(default=50, ge=1, le=200)):
    """Get list of failed tasks."""
    tasks = TaskQueue.get_failed_tasks(limit)
    
    return {
        "success": True,
        "tasks": tasks,
        "count": len(tasks)
    }


@router.post("/retry/{task_id}")
async def retry_task(task_id: str):
    """Manually retry a failed task."""
    success = await TaskQueue.retry_failed(task_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Task not found or not in failed state")
    
    return {
        "success": True,
        "message": f"Task {task_id} scheduled for retry"
    }


@router.post("/enqueue/test")
async def enqueue_test_task():
    """Enqueue a test notification task."""
    task_id = await TaskQueue.enqueue(
        task_name="send_notification",
        payload={
            "user_id": "test",
            "message": "Test notification from admin",
            "type": "info"
        }
    )
    
    return {
        "success": True,
        "task_id": task_id
    }


@router.get("/retry-settings")
async def get_retry_settings():
    """Get current BBPS auto-retry configuration."""
    return {
        "success": True,
        "settings": {
            "auto_retry_enabled": os.environ.get("BBPS_AUTO_RETRY_ENABLED", "true").lower() == "true",
            "max_retries": int(os.environ.get("BBPS_MAX_RETRIES", "3")),
            "retry_delay_seconds": int(os.environ.get("BBPS_RETRY_DELAY", "60")),
            "eligible_services": ["electricity", "mobile_postpaid", "dth", "fastag", "broadband"],
            "retry_delays": [60, 300, 1800]  # 1 min, 5 min, 30 min (exponential backoff)
        }
    }


@router.get("/pending-retries")
async def get_pending_retries():
    """Get all pending retry tasks for BBPS payments."""
    from app.core.database import get_sync_db
    
    db = get_sync_db()
    
    pending_tasks = list(db.task_queue.find(
        {
            "task_name": "retry_failed_transfer",
            "status": {"$in": ["pending", "retry_scheduled"]}
        },
        {"_id": 0}
    ).sort("scheduled_at", 1).limit(50))
    
    return {
        "success": True,
        "pending_retries": pending_tasks,
        "count": len(pending_tasks)
    }
