"""
Admin DMT Routes - DMT Management and Control APIs
Features:
1. DMT Enable/Disable toggle
2. Transaction viewer with filters
3. Per-user daily/monthly limits
4. Transaction count limits
5. Stats and analytics
"""

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field
import logging
import io
import csv

# Create router
router = APIRouter(prefix="/admin/dmt", tags=["Admin - DMT Management"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ========== REQUEST MODELS ==========

class DMTSettingsUpdate(BaseModel):
    dmt_enabled: Optional[bool] = None
    min_transfer: Optional[int] = None
    max_daily_limit: Optional[int] = None
    max_monthly_limit: Optional[int] = None
    max_daily_transactions: Optional[int] = None
    max_monthly_transactions: Optional[int] = None
    prc_rate: Optional[int] = None
    imps_enabled: Optional[bool] = None
    neft_enabled: Optional[bool] = None


class UserLimitUpdate(BaseModel):
    user_id: str
    daily_limit: Optional[int] = None
    monthly_limit: Optional[int] = None
    daily_transaction_limit: Optional[int] = None
    monthly_transaction_limit: Optional[int] = None
    custom_limit_enabled: bool = True


# ========== DEFAULT SETTINGS ==========

DEFAULT_DMT_SETTINGS = {
    "key": "dmt_settings",
    "dmt_enabled": True,
    "min_transfer": 100,
    "max_daily_limit": 5000,
    "max_monthly_limit": 50000,
    "max_daily_transactions": 10,
    "max_monthly_transactions": 100,
    "prc_rate": 100,  # 100 PRC = 1 INR
    "imps_enabled": True,
    "neft_enabled": True,
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat()
}


# ========== SETTINGS APIs ==========

@router.get("/settings")
async def get_dmt_settings():
    """Get current DMT settings"""
    try:
        settings = await db.settings.find_one({"key": "dmt_settings"}, {"_id": 0})
        if not settings:
            # Create default settings
            await db.settings.insert_one(DEFAULT_DMT_SETTINGS.copy())
            settings = DEFAULT_DMT_SETTINGS.copy()
        
        return {"success": True, "data": settings}
    except Exception as e:
        logging.error(f"[ADMIN-DMT] Settings fetch error: {e}")
        return {"success": False, "message": str(e)}


@router.post("/settings")
async def update_dmt_settings(request: Request):
    """Update DMT settings"""
    try:
        data = await request.json()
        admin_id = data.pop("admin_id", None)
        
        # Prepare update
        update_data = {k: v for k, v in data.items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["updated_by"] = admin_id
        
        await db.settings.update_one(
            {"key": "dmt_settings"},
            {"$set": update_data},
            upsert=True
        )
        
        # Log admin action
        await db.admin_audit_logs.insert_one({
            "admin_uid": admin_id,
            "action": "dmt_settings_updated",
            "entity_type": "dmt_settings",
            "details": update_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {"success": True, "message": "DMT settings updated successfully"}
    except Exception as e:
        logging.error(f"[ADMIN-DMT] Settings update error: {e}")
        return {"success": False, "message": str(e)}


@router.post("/toggle")
async def toggle_dmt_service(request: Request):
    """Toggle DMT service on/off"""
    try:
        data = await request.json()
        enabled = data.get("enabled", True)
        admin_id = data.get("admin_id")
        
        await db.settings.update_one(
            {"key": "dmt_settings"},
            {
                "$set": {
                    "dmt_enabled": enabled,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "updated_by": admin_id
                }
            },
            upsert=True
        )
        
        # Log action
        await db.admin_audit_logs.insert_one({
            "admin_uid": admin_id,
            "action": "dmt_service_toggled",
            "entity_type": "dmt_settings",
            "details": {"enabled": enabled},
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "message": f"DMT service {'enabled' if enabled else 'disabled'}"
        }
    except Exception as e:
        logging.error(f"[ADMIN-DMT] Toggle error: {e}")
        return {"success": False, "message": str(e)}


# ========== USER LIMITS APIs ==========

@router.get("/user-limits")
async def get_all_user_limits(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Get all custom user limits"""
    try:
        skip = (page - 1) * limit
        
        # Get users with custom limits
        pipeline = [
            {"$match": {"custom_dmt_limits": {"$exists": True}}},
            {"$project": {
                "_id": 0,
                "uid": 1,
                "name": 1,
                "email": 1,
                "mobile": 1,
                "custom_dmt_limits": 1
            }},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        users = await db.users.aggregate(pipeline).to_list(limit)
        total = await db.users.count_documents({"custom_dmt_limits": {"$exists": True}})
        
        return {
            "success": True,
            "data": {
                "users": users,
                "total": total,
                "page": page,
                "limit": limit
            }
        }
    except Exception as e:
        logging.error(f"[ADMIN-DMT] User limits fetch error: {e}")
        return {"success": False, "message": str(e)}


@router.get("/user-limits/{user_id}")
async def get_user_limit(user_id: str):
    """Get specific user's DMT limits"""
    try:
        user = await db.users.find_one(
            {"uid": user_id},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "custom_dmt_limits": 1}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get global settings for comparison
        global_settings = await db.settings.find_one({"key": "dmt_settings"}, {"_id": 0})
        
        return {
            "success": True,
            "data": {
                "user": user,
                "global_settings": global_settings,
                "has_custom_limits": bool(user.get("custom_dmt_limits"))
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ADMIN-DMT] User limit fetch error: {e}")
        return {"success": False, "message": str(e)}


@router.post("/user-limits")
async def set_user_limit(request: Request):
    """Set custom DMT limits for a specific user"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        admin_id = data.get("admin_id")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        # Verify user exists
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Build custom limits
        custom_limits = {
            "enabled": data.get("custom_limit_enabled", True),
            "daily_limit": data.get("daily_limit"),
            "monthly_limit": data.get("monthly_limit"),
            "daily_transaction_limit": data.get("daily_transaction_limit"),
            "monthly_transaction_limit": data.get("monthly_transaction_limit"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": admin_id
        }
        
        # Remove None values
        custom_limits = {k: v for k, v in custom_limits.items() if v is not None}
        
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {"custom_dmt_limits": custom_limits}}
        )
        
        # Log action
        await db.admin_audit_logs.insert_one({
            "admin_uid": admin_id,
            "action": "user_dmt_limits_updated",
            "entity_type": "user",
            "entity_id": user_id,
            "details": custom_limits,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "message": f"Custom DMT limits set for user {user_id}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ADMIN-DMT] Set user limit error: {e}")
        return {"success": False, "message": str(e)}


@router.delete("/user-limits/{user_id}")
async def remove_user_limit(user_id: str, admin_id: str = None):
    """Remove custom limits for a user (revert to global settings)"""
    try:
        result = await db.users.update_one(
            {"uid": user_id},
            {"$unset": {"custom_dmt_limits": ""}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Log action
        if admin_id:
            await db.admin_audit_logs.insert_one({
                "admin_uid": admin_id,
                "action": "user_dmt_limits_removed",
                "entity_type": "user",
                "entity_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        return {
            "success": True,
            "message": f"Custom DMT limits removed for user {user_id}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ADMIN-DMT] Remove user limit error: {e}")
        return {"success": False, "message": str(e)}


# ========== STATS API ==========

@router.get("/stats")
async def get_dmt_stats():
    """Get DMT statistics and analytics"""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Total stats
        total_pipeline = [
            {"$group": {
                "_id": None,
                "total_transactions": {"$sum": 1},
                "total_amount": {"$sum": "$amount_inr"},
                "total_prc_used": {"$sum": "$prc_amount"},
                "total_refunded": {"$sum": {"$ifNull": ["$prc_refunded", 0]}}
            }}
        ]
        total_result = await db.dmt_transactions.aggregate(total_pipeline).to_list(1)
        
        # Status breakdown
        status_pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "amount": {"$sum": "$amount_inr"}
            }}
        ]
        status_result = await db.dmt_transactions.aggregate(status_pipeline).to_list(10)
        
        # Today's stats
        today_pipeline = [
            {"$match": {"created_at": {"$gte": today_start}}},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "amount": {"$sum": "$amount_inr"}
            }}
        ]
        today_result = await db.dmt_transactions.aggregate(today_pipeline).to_list(1)
        
        # This month stats
        month_pipeline = [
            {"$match": {"created_at": {"$gte": month_start}}},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "amount": {"$sum": "$amount_inr"}
            }}
        ]
        month_result = await db.dmt_transactions.aggregate(month_pipeline).to_list(1)
        
        # Process results
        total = total_result[0] if total_result else {}
        status_counts = {s["_id"]: s["count"] for s in status_result}
        today = today_result[0] if today_result else {}
        month = month_result[0] if month_result else {}
        
        return {
            "success": True,
            "data": {
                "total_transactions": total.get("total_transactions", 0),
                "total_amount": round(total.get("total_amount", 0), 2),
                "total_prc_used": total.get("total_prc_used", 0),
                "total_refunded": total.get("total_refunded", 0),
                "successful": status_counts.get("completed", 0),
                "failed": status_counts.get("failed", 0),
                "pending": status_counts.get("pending", 0) + status_counts.get("processing", 0),
                "refunded": status_counts.get("refunded", 0) + status_counts.get("refund_pending", 0),
                "today_transactions": today.get("count", 0),
                "today_amount": round(today.get("amount", 0), 2),
                "month_transactions": month.get("count", 0),
                "month_amount": round(month.get("amount", 0), 2)
            }
        }
    except Exception as e:
        logging.error(f"[ADMIN-DMT] Stats error: {e}")
        return {"success": False, "message": str(e)}


# ========== TRANSACTIONS API ==========

@router.get("/transactions")
async def get_dmt_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    dateFrom: str = Query(None),
    dateTo: str = Query(None),
    search: str = Query(None),
    minAmount: float = Query(None),
    maxAmount: float = Query(None),
    user_id: str = Query(None)
):
    """Get all DMT transactions with filters"""
    try:
        skip = (page - 1) * limit
        
        # Build query
        query = {}
        
        if status and status != 'all':
            query["status"] = status
        
        if dateFrom:
            try:
                from_date = datetime.fromisoformat(dateFrom.replace('Z', '+00:00'))
                query["created_at"] = {"$gte": from_date}
            except:
                pass
        
        if dateTo:
            try:
                to_date = datetime.fromisoformat(dateTo.replace('Z', '+00:00'))
                if "created_at" in query:
                    query["created_at"]["$lte"] = to_date
                else:
                    query["created_at"] = {"$lte": to_date}
            except:
                pass
        
        if search:
            query["$or"] = [
                {"transaction_id": {"$regex": search, "$options": "i"}},
                {"mobile": {"$regex": search, "$options": "i"}},
                {"user_id": {"$regex": search, "$options": "i"}},
                {"eko_tid": {"$regex": search, "$options": "i"}}
            ]
        
        if minAmount:
            query["amount_inr"] = {"$gte": minAmount}
        
        if maxAmount:
            if "amount_inr" in query:
                query["amount_inr"]["$lte"] = maxAmount
            else:
                query["amount_inr"] = {"$lte": maxAmount}
        
        if user_id:
            query["user_id"] = user_id
        
        # Execute query
        total = await db.dmt_transactions.count_documents(query)
        transactions = await db.dmt_transactions.find(
            query,
            {"_id": 0, "eko_response": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Format dates
        for txn in transactions:
            if txn.get("created_at"):
                if isinstance(txn["created_at"], datetime):
                    txn["created_at"] = txn["created_at"].isoformat()
        
        return {
            "success": True,
            "data": {
                "transactions": transactions,
                "total": total,
                "page": page,
                "limit": limit,
                "total_pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logging.error(f"[ADMIN-DMT] Transactions fetch error: {e}")
        return {"success": False, "message": str(e)}


@router.get("/transactions/{transaction_id}")
async def get_transaction_detail(transaction_id: str):
    """Get detailed info for a specific transaction"""
    try:
        txn = await db.dmt_transactions.find_one(
            {"transaction_id": transaction_id},
            {"_id": 0}
        )
        
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Get user info
        user = await db.users.find_one(
            {"uid": txn.get("user_id")},
            {"_id": 0, "name": 1, "email": 1, "mobile": 1}
        )
        
        # Get logs for this transaction
        logs = await db.dmt_logs.find(
            {"client_ref_id": transaction_id},
            {"_id": 0}
        ).sort("timestamp", -1).to_list(10)
        
        return {
            "success": True,
            "data": {
                "transaction": txn,
                "user": user,
                "logs": logs
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ADMIN-DMT] Transaction detail error: {e}")
        return {"success": False, "message": str(e)}


# ========== EXPORT API ==========

@router.get("/export")
async def export_transactions(
    status: str = Query(None),
    dateFrom: str = Query(None),
    dateTo: str = Query(None),
    search: str = Query(None)
):
    """Export DMT transactions to CSV"""
    try:
        # Build query (same as transactions endpoint)
        query = {}
        
        if status and status != 'all':
            query["status"] = status
        
        if dateFrom:
            try:
                from_date = datetime.fromisoformat(dateFrom.replace('Z', '+00:00'))
                query["created_at"] = {"$gte": from_date}
            except:
                pass
        
        if dateTo:
            try:
                to_date = datetime.fromisoformat(dateTo.replace('Z', '+00:00'))
                if "created_at" in query:
                    query["created_at"]["$lte"] = to_date
                else:
                    query["created_at"] = {"$lte": to_date}
            except:
                pass
        
        if search:
            query["$or"] = [
                {"transaction_id": {"$regex": search, "$options": "i"}},
                {"mobile": {"$regex": search, "$options": "i"}}
            ]
        
        # Fetch all matching transactions (max 10000)
        transactions = await db.dmt_transactions.find(
            query,
            {"_id": 0, "eko_response": 0}
        ).sort("created_at", -1).limit(10000).to_list(10000)
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Transaction ID", "EKO TID", "User ID", "Mobile", 
            "Amount (INR)", "PRC Used", "PRC Refunded",
            "Status", "Created At", "Message"
        ])
        
        # Data rows
        for txn in transactions:
            created_at = txn.get("created_at")
            if isinstance(created_at, datetime):
                created_at = created_at.isoformat()
            
            writer.writerow([
                txn.get("transaction_id", ""),
                txn.get("eko_tid", ""),
                txn.get("user_id", ""),
                txn.get("mobile", ""),
                txn.get("amount_inr", 0),
                txn.get("prc_amount", 0),
                txn.get("prc_refunded", 0),
                txn.get("status", ""),
                created_at,
                txn.get("eko_message", "")
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=dmt_transactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    except Exception as e:
        logging.error(f"[ADMIN-DMT] Export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== USER TRANSACTION HISTORY ==========

@router.get("/user-transactions/{user_id}")
async def get_user_transactions(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Get all DMT transactions for a specific user"""
    try:
        skip = (page - 1) * limit
        
        # User info
        user = await db.users.find_one(
            {"uid": user_id},
            {"_id": 0, "name": 1, "email": 1, "mobile": 1, "prc_balance": 1, "custom_dmt_limits": 1}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Transactions
        total = await db.dmt_transactions.count_documents({"user_id": user_id})
        transactions = await db.dmt_transactions.find(
            {"user_id": user_id},
            {"_id": 0, "eko_response": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Calculate user's usage
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        today_usage = await db.dmt_transactions.aggregate([
            {"$match": {
                "user_id": user_id,
                "status": {"$in": ["completed", "pending", "processing"]},
                "created_at": {"$gte": today_start}
            }},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "amount": {"$sum": "$amount_inr"}
            }}
        ]).to_list(1)
        
        month_usage = await db.dmt_transactions.aggregate([
            {"$match": {
                "user_id": user_id,
                "status": {"$in": ["completed", "pending", "processing"]},
                "created_at": {"$gte": month_start}
            }},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "amount": {"$sum": "$amount_inr"}
            }}
        ]).to_list(1)
        
        return {
            "success": True,
            "data": {
                "user": user,
                "transactions": transactions,
                "total": total,
                "page": page,
                "usage": {
                    "today_count": today_usage[0]["count"] if today_usage else 0,
                    "today_amount": today_usage[0]["amount"] if today_usage else 0,
                    "month_count": month_usage[0]["count"] if month_usage else 0,
                    "month_amount": month_usage[0]["amount"] if month_usage else 0
                }
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ADMIN-DMT] User transactions error: {e}")
        return {"success": False, "message": str(e)}
