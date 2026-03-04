"""
Error Monitoring & Log System
Tracks all API errors, payment failures, and system issues for debugging
"""

from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging
import traceback
import json

router = APIRouter(prefix="/monitor", tags=["Error Monitor"])

# Will be set from server.py
db = None

def set_db(database):
    global db
    db = database


# ==================== ERROR LOGGING FUNCTIONS ====================

async def log_error(
    error_type: str,
    error_message: str,
    source: str,
    user_id: str = None,
    request_data: dict = None,
    stack_trace: str = None,
    severity: str = "error",  # info, warning, error, critical
    category: str = "general"  # payment, auth, api, system, eko
):
    """Log error to database for monitoring"""
    if db is None:
        logging.error(f"[MONITOR] DB not available, error: {error_message}")
        return None
    
    try:
        error_doc = {
            "error_type": error_type,
            "error_message": error_message[:1000],  # Limit message length
            "source": source,
            "user_id": user_id,
            "request_data": json.dumps(request_data)[:2000] if request_data else None,
            "stack_trace": stack_trace[:3000] if stack_trace else None,
            "severity": severity,
            "category": category,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "resolved": False,
            "resolution_notes": None
        }
        
        result = await db.error_logs.insert_one(error_doc)
        logging.info(f"[MONITOR] Error logged: {error_type} - {error_message[:100]}")
        return str(result.inserted_id)
    except Exception as e:
        logging.error(f"[MONITOR] Failed to log error: {e}")
        return None


async def log_api_call(
    endpoint: str,
    method: str,
    status_code: int,
    response_time_ms: float,
    user_id: str = None,
    request_body: dict = None,
    response_body: dict = None,
    error: str = None
):
    """Log API call for analytics"""
    if db is None:
        return
    
    try:
        log_doc = {
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "response_time_ms": response_time_ms,
            "user_id": user_id,
            "request_summary": json.dumps(request_body)[:500] if request_body else None,
            "response_summary": json.dumps(response_body)[:500] if response_body else None,
            "error": error[:500] if error else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
        
        await db.api_logs.insert_one(log_doc)
    except Exception as e:
        logging.error(f"[MONITOR] Failed to log API call: {e}")


async def log_payment_event(
    event_type: str,  # initiated, success, failed, refunded
    service_type: str,
    user_id: str,
    amount: float,
    operator: str = None,
    consumer_number: str = None,
    transaction_id: str = None,
    eko_response: dict = None,
    error_message: str = None
):
    """Log payment events for tracking"""
    if db is None:
        return
    
    try:
        event_doc = {
            "event_type": event_type,
            "service_type": service_type,
            "user_id": user_id,
            "amount": amount,
            "operator": operator,
            "consumer_number": consumer_number[:20] if consumer_number else None,  # Mask for privacy
            "transaction_id": transaction_id,
            "eko_response_code": eko_response.get("status") if eko_response else None,
            "eko_message": eko_response.get("message", "")[:200] if eko_response else None,
            "error_message": error_message[:500] if error_message else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
        
        await db.payment_events.insert_one(event_doc)
        logging.info(f"[MONITOR] Payment event: {event_type} - {service_type} - ₹{amount}")
    except Exception as e:
        logging.error(f"[MONITOR] Failed to log payment event: {e}")


# ==================== ADMIN API ENDPOINTS ====================

@router.get("/errors")
async def get_errors(
    severity: Optional[str] = None,
    category: Optional[str] = None,
    resolved: Optional[bool] = None,
    hours: int = 24,
    limit: int = 100
):
    """Get recent errors for monitoring"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        # Build query
        query = {
            "timestamp": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()}
        }
        
        if severity:
            query["severity"] = severity
        if category:
            query["category"] = category
        if resolved is not None:
            query["resolved"] = resolved
        
        errors = await db.error_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
        
        # Convert ObjectId to string
        for error in errors:
            error["_id"] = str(error["_id"])
        
        # Get summary stats
        total = await db.error_logs.count_documents(query)
        critical_count = await db.error_logs.count_documents({**query, "severity": "critical"})
        unresolved_count = await db.error_logs.count_documents({**query, "resolved": False})
        
        return {
            "success": True,
            "errors": errors,
            "total": total,
            "critical_count": critical_count,
            "unresolved_count": unresolved_count,
            "time_range_hours": hours
        }
    except Exception as e:
        logging.error(f"Error fetching errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/errors/summary")
async def get_error_summary(hours: int = 24):
    """Get error summary by category and severity"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        # Aggregate by category
        category_pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        category_stats = await db.error_logs.aggregate(category_pipeline).to_list(20)
        
        # Aggregate by severity
        severity_pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        severity_stats = await db.error_logs.aggregate(severity_pipeline).to_list(10)
        
        # Top error types
        error_type_pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {"_id": "$error_type", "count": {"$sum": 1}, "last_occurrence": {"$max": "$timestamp"}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_errors = await db.error_logs.aggregate(error_type_pipeline).to_list(10)
        
        return {
            "success": True,
            "time_range_hours": hours,
            "by_category": {item["_id"]: item["count"] for item in category_stats if item["_id"]},
            "by_severity": {item["_id"]: item["count"] for item in severity_stats if item["_id"]},
            "top_errors": top_errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payments/events")
async def get_payment_events(
    event_type: Optional[str] = None,
    service_type: Optional[str] = None,
    hours: int = 24,
    limit: int = 100
):
    """Get payment events for monitoring"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        query = {
            "timestamp": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()}
        }
        
        if event_type:
            query["event_type"] = event_type
        if service_type:
            query["service_type"] = service_type
        
        events = await db.payment_events.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
        
        for event in events:
            event["_id"] = str(event["_id"])
        
        # Get stats
        total = await db.payment_events.count_documents(query)
        success_count = await db.payment_events.count_documents({**query, "event_type": "success"})
        failed_count = await db.payment_events.count_documents({**query, "event_type": "failed"})
        
        return {
            "success": True,
            "events": events,
            "total": total,
            "success_count": success_count,
            "failed_count": failed_count,
            "success_rate": round(success_count / total * 100, 2) if total > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payments/summary")
async def get_payment_summary(hours: int = 24):
    """Get payment summary stats"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        # By service type
        service_pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {
                "_id": {"service": "$service_type", "event": "$event_type"},
                "count": {"$sum": 1},
                "total_amount": {"$sum": "$amount"}
            }},
            {"$sort": {"count": -1}}
        ]
        service_stats = await db.payment_events.aggregate(service_pipeline).to_list(50)
        
        # Format results
        by_service = {}
        for stat in service_stats:
            service = stat["_id"]["service"]
            event = stat["_id"]["event"]
            if service not in by_service:
                by_service[service] = {"initiated": 0, "success": 0, "failed": 0, "refunded": 0, "total_amount": 0}
            by_service[service][event] = stat["count"]
            if event == "success":
                by_service[service]["total_amount"] = stat["total_amount"]
        
        # Calculate success rates
        for service, data in by_service.items():
            initiated = data.get("initiated", 0) or data.get("success", 0) + data.get("failed", 0)
            if initiated > 0:
                data["success_rate"] = round(data["success"] / initiated * 100, 2)
            else:
                data["success_rate"] = 0
        
        # Top failing operators
        failing_pipeline = [
            {"$match": {"timestamp": {"$gte": since}, "event_type": "failed"}},
            {"$group": {
                "_id": {"service": "$service_type", "operator": "$operator"},
                "count": {"$sum": 1},
                "last_error": {"$last": "$error_message"}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_failures = await db.payment_events.aggregate(failing_pipeline).to_list(10)
        
        return {
            "success": True,
            "time_range_hours": hours,
            "by_service": by_service,
            "top_failures": top_failures
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/stats")
async def get_api_stats(hours: int = 24):
    """Get API performance stats"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        # Slowest endpoints
        slow_pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {
                "_id": "$endpoint",
                "avg_time": {"$avg": "$response_time_ms"},
                "max_time": {"$max": "$response_time_ms"},
                "count": {"$sum": 1},
                "error_count": {"$sum": {"$cond": [{"$ne": ["$error", None]}, 1, 0]}}
            }},
            {"$sort": {"avg_time": -1}},
            {"$limit": 20}
        ]
        slow_endpoints = await db.api_logs.aggregate(slow_pipeline).to_list(20)
        
        # Error rate by endpoint
        error_pipeline = [
            {"$match": {"timestamp": {"$gte": since}, "error": {"$ne": None}}},
            {"$group": {
                "_id": "$endpoint",
                "error_count": {"$sum": 1},
                "last_error": {"$last": "$error"}
            }},
            {"$sort": {"error_count": -1}},
            {"$limit": 10}
        ]
        error_endpoints = await db.api_logs.aggregate(error_pipeline).to_list(10)
        
        # Overall stats
        total_calls = await db.api_logs.count_documents({"timestamp": {"$gte": since}})
        error_calls = await db.api_logs.count_documents({"timestamp": {"$gte": since}, "error": {"$ne": None}})
        
        return {
            "success": True,
            "time_range_hours": hours,
            "total_api_calls": total_calls,
            "error_calls": error_calls,
            "error_rate": round(error_calls / total_calls * 100, 2) if total_calls > 0 else 0,
            "slow_endpoints": slow_endpoints,
            "error_endpoints": error_endpoints
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/errors/{error_id}/resolve")
async def resolve_error(error_id: str, notes: str = None):
    """Mark an error as resolved"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        from bson import ObjectId
        
        result = await db.error_logs.update_one(
            {"_id": ObjectId(error_id)},
            {"$set": {
                "resolved": True,
                "resolution_notes": notes,
                "resolved_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Error not found")
        
        return {"success": True, "message": "Error marked as resolved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard")
async def get_monitoring_dashboard():
    """Get complete monitoring dashboard data"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        now = datetime.now(timezone.utc)
        last_24h = (now - timedelta(hours=24)).isoformat()
        last_1h = (now - timedelta(hours=1)).isoformat()
        
        # Error counts
        errors_24h = await db.error_logs.count_documents({"timestamp": {"$gte": last_24h}})
        errors_1h = await db.error_logs.count_documents({"timestamp": {"$gte": last_1h}})
        critical_errors = await db.error_logs.count_documents({
            "timestamp": {"$gte": last_24h},
            "severity": "critical",
            "resolved": False
        })
        
        # Payment stats
        payments_24h = await db.payment_events.count_documents({"timestamp": {"$gte": last_24h}})
        failed_payments = await db.payment_events.count_documents({
            "timestamp": {"$gte": last_24h},
            "event_type": "failed"
        })
        
        # API stats
        api_calls_24h = await db.api_logs.count_documents({"timestamp": {"$gte": last_24h}})
        api_errors = await db.api_logs.count_documents({
            "timestamp": {"$gte": last_24h},
            "error": {"$ne": None}
        })
        
        # Recent critical errors
        recent_critical = await db.error_logs.find({
            "severity": "critical",
            "resolved": False
        }).sort("timestamp", -1).limit(5).to_list(5)
        
        for err in recent_critical:
            err["_id"] = str(err["_id"])
        
        # System health score (0-100)
        health_score = 100
        if critical_errors > 0:
            health_score -= min(30, critical_errors * 10)
        if errors_1h > 10:
            health_score -= min(20, errors_1h - 10)
        if payments_24h > 0:
            failure_rate = failed_payments / payments_24h
            health_score -= min(30, int(failure_rate * 100))
        
        return {
            "success": True,
            "timestamp": now.isoformat(),
            "health_score": max(0, health_score),
            "health_status": "critical" if health_score < 50 else "warning" if health_score < 80 else "healthy",
            "errors": {
                "last_24h": errors_24h,
                "last_1h": errors_1h,
                "critical_unresolved": critical_errors
            },
            "payments": {
                "total_24h": payments_24h,
                "failed_24h": failed_payments,
                "success_rate": round((payments_24h - failed_payments) / payments_24h * 100, 2) if payments_24h > 0 else 100
            },
            "api": {
                "calls_24h": api_calls_24h,
                "errors_24h": api_errors,
                "error_rate": round(api_errors / api_calls_24h * 100, 2) if api_calls_24h > 0 else 0
            },
            "recent_critical_errors": recent_critical
        }
    except Exception as e:
        logging.error(f"Dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
