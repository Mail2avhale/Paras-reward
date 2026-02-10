"""
Admin Withdrawals Routes - Withdrawal management
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Withdrawals"])

# Database reference
db = None

# Helpers
log_admin_action = None

def set_db(database):
    global db
    db = database

def set_helpers(helpers: dict):
    global log_admin_action
    log_admin_action = helpers.get('log_admin_action')


# ========== WITHDRAWAL LISTING ==========

@router.get("/withdrawals")
async def get_withdrawals(
    status: str = None,
    wallet_type: str = None,
    page: int = 1,
    limit: int = 50
):
    """Get withdrawal requests with filtering"""
    # Query both withdrawal collections
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    
    # Get cashback withdrawals
    cashback_withdrawals = await db.cashback_withdrawals.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for w in cashback_withdrawals:
        w["wallet_type"] = "cashback"
    
    # Get profit withdrawals
    profit_withdrawals = await db.profit_withdrawals.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for w in profit_withdrawals:
        w["wallet_type"] = "profit"
    
    # Combine and sort
    all_withdrawals = cashback_withdrawals + profit_withdrawals
    all_withdrawals.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Filter by wallet type if specified
    if wallet_type:
        all_withdrawals = [w for w in all_withdrawals if w.get("wallet_type") == wallet_type]
    
    total_cashback = await db.cashback_withdrawals.count_documents(query)
    total_profit = await db.profit_withdrawals.count_documents(query)
    
    return {
        "withdrawals": all_withdrawals[:limit],
        "total": total_cashback + total_profit,
        "page": page
    }


@router.get("/withdrawals/pending-count")
async def get_pending_withdrawals_count():
    """Get count of pending withdrawals"""
    cashback_pending = await db.cashback_withdrawals.count_documents({"status": "pending"})
    profit_pending = await db.profit_withdrawals.count_documents({"status": "pending"})
    
    return {
        "cashback_pending": cashback_pending,
        "profit_pending": profit_pending,
        "total_pending": cashback_pending + profit_pending
    }


@router.get("/withdrawals/stats")
async def get_withdrawal_stats():
    """Get withdrawal statistics"""
    try:
        # Pending amounts
        cashback_pending = await db.cashback_withdrawals.aggregate([
            {"$match": {"status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        
        profit_pending = await db.profit_withdrawals.aggregate([
            {"$match": {"status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        
        # Approved amounts (this month)
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        cashback_approved = await db.cashback_withdrawals.aggregate([
            {"$match": {"status": "approved", "approved_at": {"$gte": month_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        
        profit_approved = await db.profit_withdrawals.aggregate([
            {"$match": {"status": "approved", "approved_at": {"$gte": month_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        
        return {
            "pending": {
                "cashback": {
                    "count": cashback_pending[0]["count"] if cashback_pending else 0,
                    "amount": round(cashback_pending[0]["total"], 2) if cashback_pending else 0
                },
                "profit": {
                    "count": profit_pending[0]["count"] if profit_pending else 0,
                    "amount": round(profit_pending[0]["total"], 2) if profit_pending else 0
                }
            },
            "approved_this_month": {
                "cashback": {
                    "count": cashback_approved[0]["count"] if cashback_approved else 0,
                    "amount": round(cashback_approved[0]["total"], 2) if cashback_approved else 0
                },
                "profit": {
                    "count": profit_approved[0]["count"] if profit_approved else 0,
                    "amount": round(profit_approved[0]["total"], 2) if profit_approved else 0
                }
            }
        }
    except Exception as e:
        return {"error": str(e)}


# ========== WITHDRAWAL ACTIONS ==========

@router.post("/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(withdrawal_id: str, request: Request):
    """Approve a withdrawal request"""
    data = await request.json()
    admin_id = data.get("admin_id")
    wallet_type = data.get("wallet_type", "cashback")
    transaction_ref = data.get("transaction_ref", "")
    
    collection = db.cashback_withdrawals if wallet_type == "cashback" else db.profit_withdrawals
    
    withdrawal = await collection.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal already {withdrawal.get('status')}")
    
    now = datetime.now(timezone.utc)
    
    await collection.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": admin_id,
            "transaction_ref": transaction_ref
        }}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="withdrawal_approved",
            entity_type="withdrawal",
            entity_id=withdrawal_id,
            details={"wallet_type": wallet_type, "amount": withdrawal.get("amount")}
        )
    
    return {"success": True, "message": "Withdrawal approved"}


@router.post("/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(withdrawal_id: str, request: Request):
    """Reject a withdrawal request and refund"""
    data = await request.json()
    admin_id = data.get("admin_id")
    wallet_type = data.get("wallet_type", "cashback")
    reason = data.get("reason", "Rejected by admin")
    
    collection = db.cashback_withdrawals if wallet_type == "cashback" else db.profit_withdrawals
    balance_field = "cashback_wallet_balance" if wallet_type == "cashback" else "profit_wallet_balance"
    
    withdrawal = await collection.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal already {withdrawal.get('status')}")
    
    now = datetime.now(timezone.utc)
    
    # Refund the amount
    user_id = withdrawal.get("user_id")
    amount = withdrawal.get("amount", 0)
    
    await db.users.update_one(
        {"uid": user_id},
        {"$inc": {balance_field: amount}}
    )
    
    # Log refund transaction
    await db.transactions.insert_one({
        "transaction_id": f"REF{now.strftime('%Y%m%d%H%M%S')}",
        "user_id": user_id,
        "type": "withdrawal_rejected",
        "amount": amount,
        "description": f"Withdrawal rejected: {reason}",
        "reference_id": withdrawal_id,
        "created_at": now.isoformat()
    })
    
    await collection.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": now.isoformat(),
            "rejected_by": admin_id,
            "rejection_reason": reason
        }}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="withdrawal_rejected",
            entity_type="withdrawal",
            entity_id=withdrawal_id,
            details={"wallet_type": wallet_type, "amount": amount, "reason": reason}
        )
    
    return {"success": True, "message": "Withdrawal rejected and refunded"}


# ========== BULK OPERATIONS ==========

@router.post("/withdrawals/bulk-approve")
async def bulk_approve_withdrawals(request: Request):
    """Approve multiple withdrawals"""
    data = await request.json()
    admin_id = data.get("admin_id")
    withdrawal_ids = data.get("withdrawal_ids", [])
    wallet_type = data.get("wallet_type", "cashback")
    
    if not withdrawal_ids:
        raise HTTPException(status_code=400, detail="No withdrawal IDs provided")
    
    collection = db.cashback_withdrawals if wallet_type == "cashback" else db.profit_withdrawals
    now = datetime.now(timezone.utc)
    
    result = await collection.update_many(
        {"withdrawal_id": {"$in": withdrawal_ids}, "status": "pending"},
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": admin_id
        }}
    )
    
    return {"success": True, "approved_count": result.modified_count}


# ========== WITHDRAWAL REPORTS ==========

@router.get("/withdrawals/report")
async def get_withdrawal_report(start_date: str = None, end_date: str = None):
    """Get withdrawal report"""
    query = {}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["created_at"] = date_query
    
    # Aggregate by status
    cashback_stats = await db.cashback_withdrawals.aggregate([
        {"$match": query},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total": {"$sum": "$amount"}
        }}
    ]).to_list(10)
    
    profit_stats = await db.profit_withdrawals.aggregate([
        {"$match": query},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total": {"$sum": "$amount"}
        }}
    ]).to_list(10)
    
    return {
        "cashback": {s["_id"]: {"count": s["count"], "total": round(s["total"], 2)} for s in cashback_stats},
        "profit": {s["_id"]: {"count": s["count"], "total": round(s["total"], 2)} for s in profit_stats},
        "period": {"start": start_date, "end": end_date}
    }
