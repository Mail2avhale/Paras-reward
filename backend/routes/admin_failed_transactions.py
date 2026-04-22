"""
Admin Failed & Pending Transactions Management
Created: March 2026
"""

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
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
    otp: Optional[str] = None  # Eko-sent OTP (required for Eko/BBPS refunds)


class SendRefundOTPRequest(BaseModel):
    request_id: str
    user_id: str
    amount: float
    admin_id: str

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


# ========== SEND REFUND OTP (Eko BBPS) ==========

@router.post("/refund/send-otp")
async def send_refund_otp(request: SendRefundOTPRequest):
    """
    Trigger Eko to (re)send a refund OTP to the CUSTOMER's registered mobile.
    Eko API: POST /transactions/{tid}/refund/otp
      - Automatically fired when a transaction fails
      - This endpoint resends the OTP if admin needs a fresh one
    Customer shares the OTP with admin, who then calls /refund with it.
    """
    import httpx
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    # Auth: admin / manager only
    admin = await db.users.find_one(
        {"uid": request.admin_id},
        {"_id": 0, "uid": 1, "role": 1, "email": 1, "name": 1},
    )
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Only admins/managers can initiate refund")

    # Fetch transaction and resolve Eko TID
    txn = await db.redeem_requests.find_one(
        {"request_id": request.request_id},
        {"_id": 0, "user_id": 1, "eko_tid": 1, "tid": 1, "transaction_id": 1,
         "service_type": 1, "status": 1, "prc_refunded": 1, "prc_amount": 1,
         "provider_response": 1, "details": 1},
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.get("prc_refunded"):
        raise HTTPException(status_code=400, detail="Transaction already refunded")

    # Try multiple fields to find Eko TID
    eko_tid = (
        txn.get("eko_tid")
        or txn.get("tid")
        or (txn.get("provider_response") or {}).get("tid")
        or (txn.get("provider_response") or {}).get("data", {}).get("tid")
        or (txn.get("details") or {}).get("tid")
        or (txn.get("details") or {}).get("eko_tid")
    )
    if not eko_tid:
        raise HTTPException(
            status_code=400,
            detail="This transaction has no Eko TID — cannot request OTP. Use manual refund without OTP.",
        )

    # Import Eko BBPS config from bbps_services
    try:
        from routes.bbps_services import BASE_URL, DEVELOPER_KEY, INITIATOR_ID, generate_headers_for_payment
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eko config not loaded: {e}")
    if not DEVELOPER_KEY or not INITIATOR_ID:
        raise HTTPException(status_code=500, detail="Eko credentials not configured (EKO_DEVELOPER_KEY / EKO_INITIATOR_ID)")

    import time
    timestamp = str(round(time.time() * 1000))
    headers = generate_headers_for_payment(timestamp)
    headers["Content-Type"] = "application/x-www-form-urlencoded"

    url = f"{BASE_URL}/transactions/{eko_tid}/refund/otp"
    form_data = {"initiator_id": INITIATOR_ID, "developer_key": DEVELOPER_KEY}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, data=form_data, headers=headers)
        body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Eko API error: {e}")

    # Log audit trail regardless of outcome
    await db.refund_otps.update_one(
        {"admin_id": request.admin_id, "request_id": request.request_id},
        {"$set": {
            "admin_id": request.admin_id,
            "request_id": request.request_id,
            "user_id": request.user_id,
            "eko_tid": str(eko_tid),
            "amount": float(request.amount),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "eko_status": body.get("status"),
            "eko_message": body.get("message"),
            "eko_response": body,
            "verified": False,
            "used": False,
        }},
        upsert=True,
    )

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=body.get("message") or f"Eko rejected OTP request (HTTP {resp.status_code})",
        )
    if body.get("status") not in (0, "0", None):
        raise HTTPException(status_code=400, detail=body.get("message") or "Eko rejected OTP request")

    return {
        "success": True,
        "message": body.get("message") or "OTP sent to customer's registered mobile (via Eko)",
        "eko_tid": eko_tid,
        "eko_status": body.get("status"),
        "http_status": resp.status_code,
    }


# ========== MANUAL REFUND ==========

@router.post("/refund")
async def manual_refund(request: RefundRequest):
    """
    Manual refund a failed/pending transaction.

    Flow for Eko BBPS/recharge transactions:
      1. Call `/refund/send-otp` → Eko sends OTP to customer's mobile
      2. Customer shares OTP with admin
      3. Admin calls this endpoint with the OTP
      4. We hit Eko `POST /transactions/{tid}/refund` with the OTP
      5. On success: Eko refunds eValue to partner wallet AND we credit PRC back to user

    For non-Eko transactions (legacy/manual), OTP is optional — admin can refund directly.
    """
    import httpx
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    if not request.admin_id:
        raise HTTPException(status_code=400, detail="admin_id is required")

    # Get transaction
    txn = await db.redeem_requests.find_one({"request_id": request.request_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.get("prc_refunded") == True:
        raise HTTPException(status_code=400, detail="Transaction already refunded")
    if txn.get("user_id") != request.user_id:
        raise HTTPException(status_code=400, detail="User ID mismatch for this transaction")

    # Try to resolve Eko TID
    eko_tid = (
        txn.get("eko_tid")
        or txn.get("tid")
        or (txn.get("provider_response") or {}).get("tid")
        or (txn.get("provider_response") or {}).get("data", {}).get("tid")
        or (txn.get("details") or {}).get("tid")
        or (txn.get("details") or {}).get("eko_tid")
    )

    eko_api_called = False
    eko_api_response = None

    # ---- ATTEMPT EKO REFUND API CALL (only for Eko-backed txns with TID) ----
    if eko_tid:
        if not request.otp:
            raise HTTPException(
                status_code=400,
                detail="OTP required for Eko refund. Call /refund/send-otp first to get OTP on customer's mobile.",
            )

        try:
            from routes.bbps_services import (
                BASE_URL, DEVELOPER_KEY, INITIATOR_ID, USER_CODE, generate_headers_for_payment,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Eko config not loaded: {e}")
        if not all([DEVELOPER_KEY, INITIATOR_ID, USER_CODE]):
            raise HTTPException(status_code=500, detail="Eko credentials not configured")

        import time
        timestamp = str(round(time.time() * 1000))
        headers = generate_headers_for_payment(timestamp)
        headers["Content-Type"] = "application/x-www-form-urlencoded"

        url = f"{BASE_URL}/transactions/{eko_tid}/refund"
        form_data = {
            "initiator_id": INITIATOR_ID,
            "otp": request.otp.strip(),
            "state": "1",
            "user_code": USER_CODE,
            "developer_key": DEVELOPER_KEY,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, data=form_data, headers=headers)
            body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Eko refund API error: {e}")

        eko_api_called = True
        eko_api_response = body

        # Eko success: status == 0
        if body.get("status") not in (0, "0"):
            # Bump attempts on refund_otps for audit
            await db.refund_otps.update_one(
                {"admin_id": request.admin_id, "request_id": request.request_id},
                {"$set": {"last_eko_response": body, "last_attempt_at": datetime.now(timezone.utc).isoformat()},
                 "$inc": {"attempts": 1}},
                upsert=True,
            )
            raise HTTPException(
                status_code=400,
                detail=body.get("message") or f"Eko refund failed (status={body.get('status')})",
            )

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
            "eko_refund_response": eko_api_response,
            "eko_refund_tid": (eko_api_response or {}).get("data", {}).get("refund_tid") if eko_api_response else None,
            "status": "refunded"
        }}
    )

    # Mark OTP record as used (audit trail)
    if eko_api_called:
        await db.refund_otps.update_one(
            {"admin_id": request.admin_id, "request_id": request.request_id},
            {"$set": {
                "used": True,
                "verified": True,
                "verified_at": timestamp,
                "last_eko_response": eko_api_response,
            }},
            upsert=True,
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
        "action": "eko_refund" if eko_api_called else "manual_refund",
        "target_user": request.user_id,
        "request_id": request.request_id,
        "amount": refund_amount,
        "reason": request.reason,
        "eko_api_called": eko_api_called,
        "eko_response": eko_api_response,
        "timestamp": timestamp
    })

    return {
        "success": True,
        "message": f"Refunded {refund_amount} PRC to user" + (" (Eko verified)" if eko_api_called else ""),
        "refund_amount": refund_amount,
        "new_balance": new_balance,
        "eko_api_called": eko_api_called,
        "eko_response": eko_api_response,
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
