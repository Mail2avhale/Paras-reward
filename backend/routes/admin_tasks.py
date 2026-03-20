"""
PARAS REWARD - Admin Task Queue Routes
======================================
Admin endpoints for managing background tasks.
NOTE: Auto-retry functionality has been REMOVED. Failed transactions are refunded immediately.
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


@router.get("/retry-settings")
async def get_retry_settings():
    """
    Get current BBPS auto-retry configuration.
    NOTE: Auto-retry is DISABLED. This endpoint returns disabled status.
    """
    return {
        "success": True,
        "settings": {
            "auto_retry_enabled": False,
            "max_retries": 0,
            "retry_delay_seconds": 0,
            "eligible_services": [],
            "message": "Auto-retry disabled. Failed transactions are refunded immediately."
        }
    }
