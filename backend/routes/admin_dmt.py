"""
PARAS REWARD - Admin DMT Management APIs
========================================
- DMT Enable/Disable Control
- Transaction Management with Filters
- Statistics & Reports
- Settings Management

UPDATED: Using async Motor client for better performance
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging
import os
import csv
import io
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/admin/dmt", tags=["Admin - DMT Management"])

# Database reference - will be set from server.py
db = None

def set_db(database):
    """Set database reference from main server"""
    global db
    db = database


# ==================== REQUEST MODELS ====================

class DMTSettingsRequest(BaseModel):
    dmt_enabled: Optional[bool] = True
    min_transfer: Optional[int] = 100
    max_daily_limit: Optional[int] = 5000
    prc_rate: Optional[int] = 100
    imps_enabled: Optional[bool] = True
    neft_enabled: Optional[bool] = True


class DMTToggleRequest(BaseModel):
    enabled: bool


# ==================== HELPER FUNCTIONS ====================

def success_response(data, message="Success"):
    return {
        "success": True,
        "message": message,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


def error_response(code, message):
    return {
        "success": False,
        "error_code": code,
        "message": message
    }


# ==================== SETTINGS ====================

@router.get("/settings")
async def get_dmt_settings():
    """Get current DMT settings"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    settings = await db.dmt_settings.find_one({"_id": "global"}, {"_id": 0})
    
    if not settings:
        settings = {
            "dmt_enabled": True,
            "min_transfer": 100,
            "max_daily_limit": 5000,
            "prc_rate": 100,
            "imps_enabled": True,
            "neft_enabled": True
        }
        await db.dmt_settings.insert_one({"_id": "global", **settings})
    
    return success_response(settings)


@router.post("/settings")
async def update_dmt_settings(req: DMTSettingsRequest):
    """Update DMT settings"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    update_data = req.dict(exclude_none=True)
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.dmt_settings.update_one(
        {"_id": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    logging.info(f"[ADMIN-DMT] Settings updated: {update_data}")
    
    return success_response(update_data, "Settings updated successfully")


@router.post("/toggle")
async def toggle_dmt_service(req: DMTToggleRequest):
    """Enable or disable DMT service"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    await db.dmt_settings.update_one(
        {"_id": "global"},
        {
            "$set": {
                "dmt_enabled": req.enabled,
                "updated_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    logging.info(f"[ADMIN-DMT] Service {'ENABLED' if req.enabled else 'DISABLED'}")
    
    return success_response(
        {"dmt_enabled": req.enabled},
        f"DMT Service {'enabled' if req.enabled else 'disabled'}"
    )


# ==================== STATISTICS ====================

@router.get("/stats")
async def get_dmt_stats():
    """Get DMT statistics"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
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
    total_stats = total_result[0] if total_result else {
        "total_transactions": 0,
        "total_amount": 0,
        "total_prc_used": 0,
        "total_refunded": 0
    }
    
    # Status counts - run in parallel for better performance
    status_counts = {}
    for status in ["completed", "failed", "pending", "processing", "refunded"]:
        status_counts[status] = await db.dmt_transactions.count_documents({"status": status})
    
    # Today's stats
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today}}},
        {"$group": {
            "_id": None,
            "today_transactions": {"$sum": 1},
            "today_amount": {"$sum": "$amount_inr"}
        }}
    ]
    
    today_result = await db.dmt_transactions.aggregate(today_pipeline).to_list(1)
    today_stats = today_result[0] if today_result else {
        "today_transactions": 0,
        "today_amount": 0
    }
    
    return success_response({
        "total_transactions": total_stats.get("total_transactions", 0),
        "total_amount": total_stats.get("total_amount", 0),
        "total_prc_used": total_stats.get("total_prc_used", 0),
        "total_refunded": total_stats.get("total_refunded", 0),
        "successful": status_counts.get("completed", 0),
        "failed": status_counts.get("failed", 0),
        "pending": status_counts.get("pending", 0) + status_counts.get("processing", 0),
        "refunded": status_counts.get("refunded", 0),
        "today_transactions": today_stats.get("today_transactions", 0),
        "today_amount": today_stats.get("today_amount", 0)
    })


# ==================== TRANSACTIONS ====================

@router.get("/transactions")
async def get_dmt_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    dateFrom: Optional[str] = None,
    dateTo: Optional[str] = None,
    search: Optional[str] = None,
    minAmount: Optional[float] = None,
    maxAmount: Optional[float] = None,
    provider: Optional[str] = None
):
    """Get DMT transactions with filters"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
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
            {"mobile": {"$regex": search, "$options": "i"}},
            {"transaction_id": {"$regex": search, "$options": "i"}},
            {"eko_tid": {"$regex": search, "$options": "i"}},
            {"user_id": {"$regex": search, "$options": "i"}}
        ]
    
    if minAmount:
        query["amount_inr"] = {"$gte": minAmount}
    
    if maxAmount:
        if "amount_inr" in query:
            query["amount_inr"]["$lte"] = maxAmount
        else:
            query["amount_inr"] = {"$lte": maxAmount}
    
    if provider and provider != 'all':
        query["provider"] = provider
    
    # Get total count
    total = await db.dmt_transactions.count_documents(query)
    
    # Get transactions
    skip = (page - 1) * limit
    transactions = await db.dmt_transactions.find(
        query,
        {"_id": 0, "eko_response": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Convert datetime to string
    for txn in transactions:
        if "created_at" in txn and txn["created_at"]:
            txn["created_at"] = txn["created_at"].isoformat()
        if "updated_at" in txn and txn["updated_at"]:
            txn["updated_at"] = txn["updated_at"].isoformat()
    
    return success_response({
        "total": total,
        "page": page,
        "limit": limit,
        "transactions": transactions
    })


# ==================== EXPORT ====================

@router.get("/export")
async def export_dmt_transactions(
    status: Optional[str] = None,
    dateFrom: Optional[str] = None,
    dateTo: Optional[str] = None,
    search: Optional[str] = None
):
    """Export DMT transactions as CSV"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Build query (same as above)
    query = {}
    if status and status != 'all':
        query["status"] = status
    if dateFrom:
        try:
            query["created_at"] = {"$gte": datetime.fromisoformat(dateFrom)}
        except:
            pass
    if dateTo:
        try:
            if "created_at" in query:
                query["created_at"]["$lte"] = datetime.fromisoformat(dateTo)
            else:
                query["created_at"] = {"$lte": datetime.fromisoformat(dateTo)}
        except:
            pass
    
    # Get all matching transactions
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
        "Amount (INR)", "PRC Used", "PRC Refunded", "Status",
        "Recipient ID", "Created At"
    ])
    
    # Data
    for txn in transactions:
        writer.writerow([
            txn.get("transaction_id", ""),
            txn.get("eko_tid", ""),
            txn.get("user_id", ""),
            txn.get("mobile", ""),
            txn.get("amount_inr", 0),
            txn.get("prc_amount", 0),
            txn.get("prc_refunded", 0),
            txn.get("status", ""),
            txn.get("recipient_id", ""),
            str(txn.get("created_at", ""))
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=dmt_transactions_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


# ==================== TRANSACTION DETAIL ====================

@router.get("/transaction/{transaction_id}")
async def get_transaction_detail(transaction_id: str):
    """Get detailed transaction info"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
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
    
    txn["user_info"] = user
    
    # Convert datetime
    if txn.get("created_at"):
        txn["created_at"] = txn["created_at"].isoformat()
    
    return success_response(txn)


# ==================== MANUAL ACTIONS ====================

@router.post("/transaction/{transaction_id}/refund")
async def manual_refund_transaction(transaction_id: str):
    """Manually refund PRC for a transaction"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    txn = await db.dmt_transactions.find_one({"transaction_id": transaction_id})
    
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if txn.get("prc_refunded"):
        return error_response(400, "Already refunded")
    
    prc_amount = txn.get("prc_amount", 0)
    user_id = txn.get("user_id")
    
    if prc_amount <= 0:
        return error_response(400, "No PRC to refund")
    
    # Refund PRC
    await db.users.update_one(
        {"uid": user_id},
        {
            "$inc": {"prc_balance": prc_amount},
            "$push": {
                "prc_transactions": {
                    "type": "admin_refund",
                    "amount": prc_amount,
                    "reference": transaction_id,
                    "reason": "Manual admin refund",
                    "timestamp": datetime.now(timezone.utc)
                }
            }
        }
    )
    
    # Update transaction
    await db.dmt_transactions.update_one(
        {"transaction_id": transaction_id},
        {
            "$set": {
                "prc_refunded": prc_amount,
                "status": "refunded",
                "admin_action": "manual_refund",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    logging.info(f"[ADMIN-DMT] Manual refund: {transaction_id}, PRC: {prc_amount}")
    
    return success_response({
        "transaction_id": transaction_id,
        "prc_refunded": prc_amount
    }, "Refund processed successfully")
