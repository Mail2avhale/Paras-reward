"""
PARAS REWARD - Admin Task Queue Routes
======================================
Admin endpoints for managing background tasks.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timezone

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
