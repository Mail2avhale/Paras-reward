"""
Admin Failed & Pending Transactions Management
Created: March 2026
"""

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging
import uuid

router = APIRouter(prefix="/admin/failed-transactions", tags=["Admin Failed Transactions"])

# Database reference - set by server.py
db = None

def set_db(database):
    global db
    db = database

def sanitize_doc(doc):
    """Remove MongoDB _id from document"""
    if doc and "_id" in doc:
        del doc["_id"]
    return doc

class RefundRequest(BaseModel):
    request_id: str
    user_id: str
    amount: float
    reason: Optional[str] = "Admin manual refund"
    admin_id: Optional[str] = None

class BulkRefundRequest(BaseModel):
    request_ids: List[str]
    admin_id: Optional[str] = None


# ========== GET FAILED TRANSACTIONS ==========

@router.get("/list")
async def get_failed_transactions(
    status: str = Query(default="all", description="all, failed, pending, retry_failed"),
    service_type: str = Query(default="all", description="all, mobile, dth, electricity, etc."),
    days: int = Query(default=30, ge=1, le=90),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200)
):
    """Get list of failed and pending transactions"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Build query
    query = {}
    
    # Status filter
    if status == "failed":
        query["status"] = "failed"
    elif status == "pending":
        query["status"] = "pending"
    elif status == "retry_failed":
        query["status"] = {"$in": ["failed", "retry_failed"]}
    else:
        query["status"] = {"$in": ["failed", "pending", "retry_failed", "processing"]}
    
    # Service type filter
    if service_type != "all":
        query["service_type"] = service_type
    
    # Date filter
    date_limit = datetime.now(timezone.utc) - timedelta(days=days)
    query["created_at"] = {"$gte": date_limit.isoformat()}
    
    # Get count
    total = await db.redeem_requests.count_documents(query)
    
    # Get transactions
    skip = (page - 1) * limit
    cursor = db.redeem_requests.find(query).sort("created_at", -1).skip(skip).limit(limit)
    transactions = []
    
    async for txn in cursor:
        txn = sanitize_doc(txn)
        
        # Get user info
        user = await db.users.find_one(
            {"uid": txn.get("user_id")},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "prc_balance": 1}
        )
        txn["user"] = user
        
        transactions.append(txn)
    
    # Get summary stats
    stats = {
        "total_failed": await db.redeem_requests.count_documents({"status": "failed", "created_at": {"$gte": date_limit.isoformat()}}),
        "total_pending": await db.redeem_requests.count_documents({"status": "pending", "created_at": {"$gte": date_limit.isoformat()}}),
        "total_refunded": await db.redeem_requests.count_documents({"status": "failed", "prc_refunded": True, "created_at": {"$gte": date_limit.isoformat()}}),
        "total_not_refunded": await db.redeem_requests.count_documents({"status": "failed", "$or": [{"prc_refunded": False}, {"prc_refunded": {"$exists": False}}], "created_at": {"$gte": date_limit.isoformat()}})
    }
    
    return {
        "success": True,
        "transactions": transactions,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "stats": stats
    }


# ========== GET SINGLE TRANSACTION ==========

@router.get("/detail/{request_id}")
async def get_transaction_detail(request_id: str):
    """Get detailed info about a transaction"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    txn = await db.redeem_requests.find_one({"request_id": request_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    txn = sanitize_doc(txn)
    
    # Get user info
    user = await db.users.find_one(
        {"uid": txn.get("user_id")},
        {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "prc_balance": 1}
    )
    txn["user"] = user
    
    # Get related transactions (same user, same day)
    related = []
    try:
        created_at = datetime.fromisoformat(txn.get("created_at", "").replace("Z", "+00:00"))
        start_of_day = created_at.replace(hour=0, minute=0, second=0)
        end_of_day = created_at.replace(hour=23, minute=59, second=59)
        
        cursor = db.redeem_requests.find({
            "user_id": txn.get("user_id"),
            "created_at": {"$gte": start_of_day.isoformat(), "$lte": end_of_day.isoformat()},
            "request_id": {"$ne": request_id}
        }).limit(10)
        
        async for rel in cursor:
            related.append(sanitize_doc(rel))
    except:
        pass
    
    txn["related_transactions"] = related
    
    return {
        "success": True,
        "transaction": txn
    }


# ========== MANUAL REFUND ==========

@router.post("/refund")
async def manual_refund(request: RefundRequest):
    """Manually refund a failed/pending transaction"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Get transaction
    txn = await db.redeem_requests.find_one({"request_id": request.request_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Check if already refunded
    if txn.get("prc_refunded") == True:
        raise HTTPException(status_code=400, detail="Transaction already refunded")
    
    # Get user
    user = await db.users.find_one({"uid": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate refund amount (use transaction's prc_amount or provided amount)
    refund_amount = request.amount or txn.get("prc_amount", 0) or txn.get("total_prc", 0)
    if refund_amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid refund amount")
    
    current_balance = float(user.get("prc_balance", 0))
    new_balance = current_balance + refund_amount
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Update user balance
    await db.users.update_one(
        {"uid": request.user_id},
        {"$set": {"prc_balance": new_balance, "updated_at": timestamp}}
    )
    
    # Update transaction
    await db.redeem_requests.update_one(
        {"request_id": request.request_id},
        {"$set": {
            "prc_refunded": True,
            "refund_amount": refund_amount,
            "refund_reason": request.reason,
            "refunded_by": request.admin_id,
            "refunded_at": timestamp,
            "status": "refunded"
        }}
    )
    
    # Log transaction
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": request.user_id,
        "type": "admin_refund",
        "amount": refund_amount,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "description": f"Admin refund: {request.reason}",
        "reference_id": request.request_id,
        "admin_id": request.admin_id,
        "created_at": timestamp
    })
    
    # Log admin action
    await db.admin_audit_logs.insert_one({
        "admin_id": request.admin_id,
        "action": "manual_refund",
        "target_user": request.user_id,
        "request_id": request.request_id,
        "amount": refund_amount,
        "reason": request.reason,
        "timestamp": timestamp
    })
    
    return {
        "success": True,
        "message": f"Refunded {refund_amount} PRC to user",
        "refund_amount": refund_amount,
        "new_balance": new_balance
    }


# ========== BULK REFUND ==========

@router.post("/bulk-refund")
async def bulk_refund(request: BulkRefundRequest):
    """Bulk refund multiple transactions"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    if not request.request_ids:
        raise HTTPException(status_code=400, detail="No request IDs provided")
    
    results = []
    total_refunded = 0
    errors = 0
    timestamp = datetime.now(timezone.utc).isoformat()
    
    for req_id in request.request_ids:
        try:
            txn = await db.redeem_requests.find_one({"request_id": req_id})
            if not txn:
                results.append({"request_id": req_id, "success": False, "error": "Not found"})
                errors += 1
                continue
            
            if txn.get("prc_refunded") == True:
                results.append({"request_id": req_id, "success": False, "error": "Already refunded"})
                errors += 1
                continue
            
            user_id = txn.get("user_id")
            refund_amount = txn.get("prc_amount", 0) or txn.get("total_prc", 0)
            
            if refund_amount <= 0:
                results.append({"request_id": req_id, "success": False, "error": "Invalid amount"})
                errors += 1
                continue
            
            # Update user balance
            user = await db.users.find_one({"uid": user_id})
            if not user:
                results.append({"request_id": req_id, "success": False, "error": "User not found"})
                errors += 1
                continue
            
            current_balance = float(user.get("prc_balance", 0))
            new_balance = current_balance + refund_amount
            
            await db.users.update_one(
                {"uid": user_id},
                {"$set": {"prc_balance": new_balance, "updated_at": timestamp}}
            )
            
            # Update transaction
            await db.redeem_requests.update_one(
                {"request_id": req_id},
                {"$set": {
                    "prc_refunded": True,
                    "refund_amount": refund_amount,
                    "refund_reason": "Bulk admin refund",
                    "refunded_by": request.admin_id,
                    "refunded_at": timestamp,
                    "status": "refunded"
                }}
            )
            
            # Log transaction
            await db.transactions.insert_one({
                "transaction_id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": "admin_refund",
                "amount": refund_amount,
                "balance_before": current_balance,
                "balance_after": new_balance,
                "description": "Bulk admin refund",
                "reference_id": req_id,
                "admin_id": request.admin_id,
                "created_at": timestamp
            })
            
            total_refunded += refund_amount
            results.append({"request_id": req_id, "success": True, "amount": refund_amount})
            
        except Exception as e:
            results.append({"request_id": req_id, "success": False, "error": str(e)})
            errors += 1
    
    return {
        "success": True,
        "message": f"Processed {len(request.request_ids)} transactions. {len(request.request_ids) - errors} refunded, {errors} errors.",
        "total_refunded": total_refunded,
        "results": results
    }


# ========== MARK AS RESOLVED ==========

@router.post("/mark-resolved/{request_id}")
async def mark_as_resolved(request_id: str, request: Request):
    """Mark a transaction as resolved without refund"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    body = await request.json()
    resolution_note = body.get("note", "Marked as resolved by admin")
    admin_id = body.get("admin_id")
    
    txn = await db.redeem_requests.find_one({"request_id": request_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    await db.redeem_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "resolved",
            "resolution_note": resolution_note,
            "resolved_by": admin_id,
            "resolved_at": timestamp
        }}
    )
    
    return {
        "success": True,
        "message": "Transaction marked as resolved"
    }


# ========== RETRY TRANSACTION ==========

@router.post("/retry/{request_id}")
async def retry_transaction(request_id: str, request: Request):
    """Retry a failed transaction (Re-queue for processing)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    body = await request.json()
    admin_id = body.get("admin_id")
    
    txn = await db.redeem_requests.find_one({"request_id": request_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if txn.get("status") not in ["failed", "retry_failed"]:
        raise HTTPException(status_code=400, detail="Only failed transactions can be retried")
    
    if txn.get("prc_refunded") == True:
        raise HTTPException(status_code=400, detail="Cannot retry - already refunded")
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    await db.redeem_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "pending",
            "retry_count": (txn.get("retry_count", 0) or 0) + 1,
            "retry_requested_by": admin_id,
            "retry_requested_at": timestamp,
            "error_message": None
        }}
    )
    
    return {
        "success": True,
        "message": "Transaction queued for retry"
    }


# ========== SERVICE TYPES ==========

@router.get("/service-types")
async def get_service_types():
    """Get list of service types with transaction counts"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    pipeline = [
        {"$match": {"status": {"$in": ["failed", "pending", "retry_failed"]}}},
        {"$group": {"_id": "$service_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    results = []
    async for doc in db.redeem_requests.aggregate(pipeline):
        results.append({
            "service_type": doc["_id"],
            "count": doc["count"]
        })
    
    return {
        "success": True,
        "service_types": results
    }
