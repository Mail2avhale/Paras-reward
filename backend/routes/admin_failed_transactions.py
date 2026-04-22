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


class BulkSendRefundOTPRequest(BaseModel):
    admin_id: str
    # Either OR both — supply request_ids (lookup in redeem_requests) OR eko_tids (direct Eko call)
    request_ids: Optional[List[str]] = None
    eko_tids: Optional[List[str]] = None

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

    # Determine v3 base URL from v1.2 base
    if "staging" in BASE_URL.lower():
        V3_BASE = "https://staging.eko.in/ekoapi/v3"
    else:
        V3_BASE = "https://api.eko.in/ekoapi/v3"
    form_data = {"initiator_id": INITIATOR_ID, "developer_key": DEVELOPER_KEY}

    # Try v3 first (BBPS/Payment), fall back to v1 (DMT)
    attempts = [
        ("v3", f"{V3_BASE}/customer/payment/refund/{eko_tid}/otp"),
        ("v1", f"{BASE_URL}/transactions/{eko_tid}/refund/otp"),
    ]
    resp = None
    body = {}
    used_version = None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for api_ver, url in attempts:
                resp = await client.post(url, data=form_data, headers=headers)
                body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}
                used_version = api_ver
                if resp.status_code < 400 and body.get("status") in (0, "0", None):
                    break
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


# ========== BULK SEND REFUND OTP (Eko BBPS) ==========

@router.post("/refund/bulk-send-otp")
async def bulk_send_refund_otp(request: BulkSendRefundOTPRequest):
    """
    Bulk trigger Eko refund-OTP send for many transactions at once.
    Accepts either `request_ids` (looked up in redeem_requests) OR `eko_tids` (pasted directly
    e.g. from Eko Connect portal / Excel export). Processes with concurrency=5 to avoid
    overwhelming Eko. Returns per-txn success/failure summary.
    """
    import httpx
    import asyncio as _asyncio
    import time as _time
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    admin = await db.users.find_one(
        {"uid": request.admin_id},
        {"_id": 0, "uid": 1, "role": 1, "name": 1},
    )
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Only admins/managers can initiate bulk refund OTP")

    # Build work list: each item = (label, eko_tid, request_id_or_None)
    work = []

    if request.request_ids:
        txns = await db.redeem_requests.find(
            {"request_id": {"$in": request.request_ids}},
            {"_id": 0, "request_id": 1, "eko_tid": 1, "tid": 1,
             "provider_response": 1, "details": 1, "prc_refunded": 1, "user_id": 1},
        ).to_list(len(request.request_ids))
        found_ids = set()
        for t in txns:
            found_ids.add(t.get("request_id"))
            if t.get("prc_refunded"):
                continue
            tid = (
                t.get("eko_tid") or t.get("tid")
                or (t.get("provider_response") or {}).get("tid")
                or (t.get("provider_response") or {}).get("data", {}).get("tid")
                or (t.get("details") or {}).get("tid")
                or (t.get("details") or {}).get("eko_tid")
            )
            if tid:
                work.append({
                    "label": t.get("request_id"),
                    "eko_tid": str(tid),
                    "request_id": t.get("request_id"),
                    "user_id": t.get("user_id"),
                })
            else:
                work.append({
                    "label": t.get("request_id"),
                    "eko_tid": None,
                    "error": "No Eko TID on transaction",
                })
        for rid in request.request_ids:
            if rid not in found_ids:
                work.append({"label": rid, "eko_tid": None, "error": "Transaction not found"})

    if request.eko_tids:
        for tid in request.eko_tids:
            tid_clean = str(tid).strip()
            if tid_clean:
                work.append({"label": tid_clean, "eko_tid": tid_clean, "request_id": None})

    if not work:
        raise HTTPException(status_code=400, detail="No request_ids or eko_tids provided")

    # Eko config
    try:
        from routes.bbps_services import BASE_URL, DEVELOPER_KEY, INITIATOR_ID, generate_headers_for_payment
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eko config not loaded: {e}")
    if not DEVELOPER_KEY or not INITIATOR_ID:
        raise HTTPException(status_code=500, detail="Eko credentials not configured")

    sem = _asyncio.Semaphore(5)  # cap concurrency

    async def _one(item):
        if not item.get("eko_tid"):
            return {**item, "success": False}
        async with sem:
            timestamp = str(round(_time.time() * 1000))
            headers = generate_headers_for_payment(timestamp)
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            # v1 URL (CONFIRMED working from existing eko_recharge.py)
            url = f"{BASE_URL}/v1/transactions/{item['eko_tid']}/refund/otp"
            form_data = {"initiator_id": INITIATOR_ID, "developer_key": DEVELOPER_KEY}
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(url, data=form_data, headers=headers)
                body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}
            except Exception as e:
                return {
                    "label": item["label"],
                    "eko_tid": item.get("eko_tid"),
                    "success": False,
                    "error": str(e)[:200],
                }

            # Eko success: status == 0. Response often contains the OTP directly in data.otp
            eko_data = body.get("data", {}) or {}
            otp_value = str(eko_data.get("otp") or eko_data.get("otp_ref_id") or "").strip()
            ok = resp.status_code < 400 and body.get("status") in (0, "0")

            # Persist audit trail + OTP (so admin can refund in one click from the same page)
            try:
                await db.refund_otps.update_one(
                    {"admin_id": request.admin_id, "eko_tid": item["eko_tid"]},
                    {"$set": {
                        "admin_id": request.admin_id,
                        "eko_tid": item["eko_tid"],
                        "request_id": item.get("request_id"),
                        "user_id": item.get("user_id"),
                        "otp": otp_value or None,
                        "eko_status": body.get("status"),
                        "eko_message": body.get("message"),
                        "eko_response": body,
                        "http_status": resp.status_code,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "bulk": True,
                    }},
                    upsert=True,
                )
            except Exception:
                pass

            return {
                "label": item["label"],
                "eko_tid": item["eko_tid"],
                "request_id": item.get("request_id"),
                "success": ok,
                "http_status": resp.status_code,
                "eko_status": body.get("status"),
                "otp": otp_value if ok else None,  # pass-through so admin can see it immediately
                "message": body.get("message") or ("OTP retrieved" if ok else "Eko rejected"),
            }

    results = await _asyncio.gather(*[_one(item) for item in work])

    sent = sum(1 for r in results if r.get("success"))
    failed = len(results) - sent

    # Log one summary audit row
    try:
        await db.admin_audit_logs.insert_one({
            "admin_id": request.admin_id,
            "action": "bulk_eko_refund_otp",
            "total": len(results),
            "sent": sent,
            "failed": failed,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    return {
        "success": True,
        "total": len(results),
        "sent": sent,
        "failed": failed,
        "results": results,
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

        # v3 base URL derivation
        if "staging" in BASE_URL.lower():
            V3_BASE = "https://staging.eko.in/ekoapi/v3"
        else:
            V3_BASE = "https://api.eko.in/ekoapi/v3"

        form_data = {
            "initiator_id": INITIATOR_ID,
            "otp": request.otp.strip(),
            "state": "1",
            "user_code": USER_CODE,
            "developer_key": DEVELOPER_KEY,
        }

        # Try v3 first (modern BBPS/Payment), fall back to v1
        attempts = [
            ("v3", f"{V3_BASE}/customer/payment/refund/{eko_tid}"),
            ("v1", f"{BASE_URL}/transactions/{eko_tid}/refund"),
        ]
        resp = None
        body = {}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                for _ver, url in attempts:
                    resp = await client.post(url, data=form_data, headers=headers)
                    body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}
                    if resp.status_code < 400 and body.get("status") in (0, "0"):
                        break
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

# ========================================================================
# PENDING REFUNDS RECONCILIATION (Eko stuck refunds → user self-service)
# ========================================================================
# Hardcoded list from Eko portal (Refund Pending status): 53 BBPS + 7 DMT
# Admin triggers once → records are marked status=refund_pending in our DB
# → users see RefundBlockerModal on login → complete via OTP.
# Idempotent (safe to re-run).

_BBPS_PENDING_REFUNDS = [
    # (eko_tid, client_ref_id, cell_number, amount_inr)
    ("3554878505", "PAY1775482475430", "9198297047", 1849),
    ("3554878178", "PAY1775482130303", "6393331527", 799),
    ("3554878012", "PAY1775481945055", "6393331527", 799),
    ("3554860600", "PAY1775467163388", "9322003822", 3599),
    ("3554860530", "PAY1775467098363", "9322003822", 3599),
    ("3554860154", "PAY1775466645138", "9936222482", 3599),
    ("3554859979", "PAY1775466414764", "9936222482", 3599),
    ("3554859939", "PAY1775466371055", "8692951107", 859),
    ("3554859834", "PAY1775466237770", "8692951107", 859),
    ("3554859724", "PAY1775466102916", "9936222482", 899),
    ("3554857368", "PAY1775465891150", "9936222482", 3599),
    ("3554856923", "PAY1775465810914", "8181812092", 3599),
    ("3554856915", "PAY1775465804388", "9936222482", 3599),
    ("3554856828", "PAY1775465722709", "9198297047", 859),
    ("3554856565", "PAY1775465462312", "9198297047", 859),
    ("3554856498", "PAY1775465360029", "8874137317", 868),
    ("3554856445", "PAY1775465324846", "8181812092", 3999),
    ("3554856393", "PAY1775465282839", "8874137317", 868),
    ("3554856270", "PAY1775465073662", "9451763818", 899),
    ("3554856224", "PAY1775465023292", "9872893817", 629),
    ("3554852928", "PAY1775463953829", "9026811652", 2249),
    ("3554852872", "PAY1775463884026", "9819646232", 899),
    ("3554852849", "PAY1775463841110", "7310437020", 859),
    ("3554852540", "PAY1775463492983", "8400132628", 859),
    ("3554852416", "PAY1775463322504", "9630092037", 3599),
    ("3554852371", "PAY1775463259069", "7310437020", 739),
    ("3554852309", "PAY1775463200496", "8400132628", 859),
    ("3554852267", "PAY1775463136054", "8400132628", 859),
    ("3554852230", "PAY1775463085600", "7310437020", 859),
    ("3554851948", "PAY1775462767698", "9651151524", 3599),
    ("3554851752", "PAY1775462599601", "9340997838", 599),
    ("3554851704", "PAY1775462517547", "6393331527", 899),
    ("3554851644", "PAY1775462424589", "6393331527", 999),
    ("3554851593", "PAY1775462368187", "8874137317", 868),
    ("3554851488", "PAY1775462349498", "8692951107", 859),
    ("3554848887", "PAY1775462163295", "8692951107", 859),
    ("3554848687", "PAY1775461945136", "9651151524", 3599),
    ("3554848505", "PAY1775461753913", "9309486358", 599),
    ("3554848222", "PAY1775461450514", "9651151524", 3599),
    ("3554847903", "PAY1775461093283", "7431928072", 859),
    ("3554847795", "PAY1775460955497", "7620548792", 599),
    ("3554847749", "PAY1775460890558", "7620548792", 899),
    ("3554847652", "PAY1775460813083", "9987046822", 1640),
    ("3554847505", "PAY1775460639686", "9152157173", 1800),
    ("3554846950", "PAY1775460601376", "9765290412", 579),
    ("3554846767", "PAY1775460596811", "9765290412", 579),
    ("3554844652", "PAY1775460300543", "9765290412", 899),
    ("3554785323", "PAY1775429914367", "9404776221", 1419),
    ("3554779182", "PAY1775426721174", "9404944504", 711),
    ("3554779049", "PAY1775426423214", "9423832894", 1098),
    ("3554769912", "PAY1775421948813", "8419975797", 3599),
    ("3554761303", "PAY1775417178524", "9987474443", 1199),
    ("3554757276", "PAY1775414982465", "6355517524", 1099),
]

_DMT_PENDING_REFUNDS = [
    # (eko_client_ref_id, amount_inr, phone, beneficiary_name, account_number, bank_name)
    ("DMT1E6F098CA229", 1000, "917385613884", "SIDDHALI MAHESH SAL", "51000000039879", "Saraswat Co-Op Bank"),
    ("DMT94C4A3C3CE21", 100, "919421331342", "Test User", "04588100009023", "Bank Of Baroda"),
    ("DMTEAFE9F326F00", 1000, "918001755185", "", "110401000020411", "Indian Overseas Bank"),
    ("DMTE3D21184173E", 100, "919421331342", "Test User", "8829010000024578", "DBS Bank"),
    ("DMT8C89EF7B6725", 100, "919970100782", "SANTOSH AVHALE", "04588100009023", "Bank Of Baroda"),
    ("DMTE250F395235F", 100, "919970100782", "SANTOSH AVHALE", "31277621502", "State Bank Of India"),
    ("TEST123456",     100, "919970100782", "SANTOSH AVHALE", "31277621502", "State Bank Of India"),
]

_REFUND_COLLECTIONS = [
    "recharge_transactions",
    "bill_payment_requests",
    "dmt_transactions",
    "bank_transfer_requests",
]


async def _mark_single_as_refund_pending(eko_tid: str, client_ref_id: str = None, enrichment: dict = None):
    """Find a txn across 4 collections by eko_tid or client_ref_id, mark status=refund_pending.
    If `enrichment` dict is provided, also populates missing metadata fields (beneficiary_name,
    account_number, bank_name, phone, customer_mobile, etc.) on the matched record.
    Idempotent: skips records that are already refunded."""
    ids_to_try = [v for v in [eko_tid, client_ref_id] if v]
    now_iso = datetime.now(timezone.utc).isoformat()

    for coll_name in _REFUND_COLLECTIONS:
        coll = db[coll_name]
        for ident in ids_to_try:
            q = {"$or": [
                {"eko_tid": ident},
                {"client_ref_id": ident},
                {"eko_client_ref_id": ident},
            ]}
            txn = await coll.find_one(q, {"_id": 0})
            if not txn:
                continue
            user_id = txn.get("user_id")
            user = await db.users.find_one({"uid": user_id}, {"_id": 0, "name": 1, "mobile": 1}) if user_id else None
            already_refunded = txn.get("status") == "refunded"
            if not already_refunded:
                update_doc = {
                    "status": "refund_pending",
                    "refund_pending_marked_at": now_iso,
                    "refund_pending_source": "eko_reconciliation",
                }
                # Enrichment: set fields only if currently missing/empty
                if enrichment:
                    for k, v in enrichment.items():
                        if not v:
                            continue
                        existing = txn.get(k)
                        is_empty = (existing is None) or (isinstance(existing, str) and not existing.strip())
                        if is_empty:
                            update_doc[k] = v
                await coll.update_one(q, {"$set": update_doc})
            return {
                "matched": True,
                "collection": coll_name,
                "user_id": user_id or "",
                "user_name": (user or {}).get("name", ""),
                "user_mobile": (user or {}).get("mobile", ""),
                "already_refunded": already_refunded,
            }
    return {"matched": False}


class ReconcilePendingRefundsRequest(BaseModel):
    admin_id: str
    dry_run: Optional[bool] = False
    create_missing: Optional[bool] = False
    owner_uid: Optional[str] = None  # UID to attribute newly-created records to (the retailer)


async def _create_bbps_record(eko_tid: str, client_ref_id: str, cell_number: str,
                               amount: int, owner_uid: str):
    """Create a bare BBPS recharge record so it appears in user's modal."""
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "eko_tid": eko_tid,
        "client_ref_id": client_ref_id,
        "user_id": owner_uid,
        "amount_inr": amount,
        "amount": amount,
        "phone": cell_number,
        "consumer_number": cell_number,
        "customer_mobile": cell_number,  # OTP goes here
        "operator_name": "Mobile Recharge",
        "operator": "Mobile Recharge",
        "status": "refund_pending",
        "created_at": now_iso,
        "refund_pending_marked_at": now_iso,
        "refund_pending_source": "eko_reconciliation_created",
        "source": "reconciliation_created",
    }
    await db.recharge_transactions.insert_one(doc)
    return doc


async def _create_dmt_record(client_ref_id: str, amount: int, phone: str,
                              beneficiary_name: str, account_number: str,
                              bank_name: str, owner_uid: str):
    """Create a bare DMT record so it appears in user's modal."""
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "eko_client_ref_id": client_ref_id,
        "client_ref_id": client_ref_id,
        "user_id": owner_uid,
        "amount_inr": amount,
        "amount": amount,
        "phone": phone,
        "beneficiary_mobile": phone,
        "customer_mobile": phone,  # OTP goes here (sender mobile in DMT)
        "beneficiary_name": beneficiary_name,
        "account_number": account_number,
        "bank_name": bank_name,
        "status": "refund_pending",
        "created_at": now_iso,
        "refund_pending_marked_at": now_iso,
        "refund_pending_source": "eko_reconciliation_created",
        "source": "reconciliation_created",
    }
    await db.dmt_transactions.insert_one(doc)
    return doc


@router.post("/reconcile-pending-refunds")
async def reconcile_pending_refunds(request: ReconcilePendingRefundsRequest):
    """One-click reconciliation: marks 53 BBPS + 7 DMT Eko refund-pending txns as
    status=refund_pending in our DB. Users see RefundBlockerModal on login.
    Idempotent. Safe to re-run."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    admin = await db.users.find_one(
        {"uid": request.admin_id},
        {"_id": 0, "role": 1, "name": 1, "email": 1},
    )
    if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Only admins can trigger reconciliation")

    matched = []
    unmatched = []
    created = []  # newly-created records (when create_missing=True)

    for eko_tid, client_ref_id, cell_number, amount in _BBPS_PENDING_REFUNDS:
        # BBPS enrichment data
        bbps_enrichment = {
            "amount_inr": amount,
            "phone": cell_number,
            "consumer_number": cell_number,
        }
        result = await _mark_single_as_refund_pending(eko_tid, client_ref_id, bbps_enrichment) if not request.dry_run else {"matched": False}
        if request.dry_run:
            found_doc = None
            for coll_name in _REFUND_COLLECTIONS:
                q = {"$or": [
                    {"eko_tid": eko_tid}, {"client_ref_id": eko_tid},
                    {"eko_tid": client_ref_id}, {"client_ref_id": client_ref_id},
                    {"eko_client_ref_id": client_ref_id},
                ]}
                doc = await db[coll_name].find_one(q, {"_id": 0, "user_id": 1})
                if doc:
                    found_doc = {"collection": coll_name, "user_id": doc.get("user_id", "")}
                    break
            if found_doc:
                matched.append({"type": "BBPS", "eko_tid": eko_tid,
                                "client_ref_id": client_ref_id, "amount": amount,
                                **found_doc})
            else:
                unmatched.append({"type": "BBPS", "eko_tid": eko_tid,
                                  "client_ref_id": client_ref_id,
                                  "cell_number": cell_number, "amount": amount})
        else:
            if result["matched"]:
                matched.append({"type": "BBPS", "eko_tid": eko_tid,
                                "client_ref_id": client_ref_id, "amount": amount,
                                **result})
            elif request.create_missing and request.owner_uid:
                # Create a new record attributed to owner_uid
                await _create_bbps_record(eko_tid, client_ref_id, cell_number, amount, request.owner_uid)
                owner = await db.users.find_one({"uid": request.owner_uid}, {"_id": 0, "name": 1, "mobile": 1})
                created.append({"type": "BBPS", "eko_tid": eko_tid,
                                "client_ref_id": client_ref_id,
                                "cell_number": cell_number, "amount": amount,
                                "collection": "recharge_transactions",
                                "user_id": request.owner_uid,
                                "user_name": (owner or {}).get("name", ""),
                                "user_mobile": (owner or {}).get("mobile", "")})
            else:
                unmatched.append({"type": "BBPS", "eko_tid": eko_tid,
                                  "client_ref_id": client_ref_id,
                                  "cell_number": cell_number, "amount": amount})

    for cl_id, amount, phone, bname, account, bank in _DMT_PENDING_REFUNDS:
        if request.dry_run:
            found_doc = None
            for coll_name in _REFUND_COLLECTIONS:
                q = {"$or": [
                    {"eko_tid": cl_id}, {"client_ref_id": cl_id},
                    {"eko_client_ref_id": cl_id},
                ]}
                doc = await db[coll_name].find_one(q, {"_id": 0, "user_id": 1})
                if doc:
                    found_doc = {"collection": coll_name, "user_id": doc.get("user_id", "")}
                    break
            if found_doc:
                matched.append({"type": "DMT", "client_ref_id": cl_id,
                                "amount": amount, **found_doc})
            else:
                unmatched.append({"type": "DMT", "client_ref_id": cl_id,
                                  "amount": amount, "phone": phone,
                                  "beneficiary_name": bname,
                                  "account_number": account, "bank_name": bank})
        else:
            # DMT enrichment data from Eko Connect authoritative source
            dmt_enrichment = {
                "amount_inr": amount,
                "phone": phone,
                "beneficiary_mobile": phone,
                "customer_mobile": phone,  # DMT OTP goes to this mobile
                "beneficiary_name": bname,
                "account_number": account,
                "bank_name": bank,
            }
            result = await _mark_single_as_refund_pending(cl_id, None, dmt_enrichment)
            if result["matched"]:
                matched.append({"type": "DMT", "client_ref_id": cl_id,
                                "amount": amount, "phone": phone,
                                "beneficiary_name": bname,
                                "account_number": account, "bank_name": bank,
                                **result})
            elif request.create_missing and request.owner_uid:
                await _create_dmt_record(cl_id, amount, phone, bname, account, bank, request.owner_uid)
                owner = await db.users.find_one({"uid": request.owner_uid}, {"_id": 0, "name": 1, "mobile": 1})
                created.append({"type": "DMT", "client_ref_id": cl_id,
                                "amount": amount, "phone": phone,
                                "beneficiary_name": bname,
                                "account_number": account, "bank_name": bank,
                                "collection": "dmt_transactions",
                                "user_id": request.owner_uid,
                                "user_name": (owner or {}).get("name", ""),
                                "user_mobile": (owner or {}).get("mobile", "")})
            else:
                unmatched.append({"type": "DMT", "client_ref_id": cl_id,
                                  "amount": amount, "phone": phone,
                                  "beneficiary_name": bname,
                                  "account_number": account, "bank_name": bank})

    user_impact = {}
    for m in matched + created:
        if not m.get("user_id"):
            continue
        k = m["user_id"]
        if k not in user_impact:
            user_impact[k] = {
                "user_id": m["user_id"],
                "user_name": m.get("user_name", ""),
                "user_mobile": m.get("user_mobile", ""),
                "bbps_count": 0, "dmt_count": 0, "total_amount": 0,
            }
        if m["type"] == "BBPS":
            user_impact[k]["bbps_count"] += 1
        else:
            user_impact[k]["dmt_count"] += 1
        user_impact[k]["total_amount"] += m.get("amount", 0)

    if not request.dry_run:
        await db.admin_audit_logs.insert_one({
            "admin_id": request.admin_id,
            "admin_name": admin.get("name"),
            "action": "reconcile_pending_refunds",
            "total_candidates": len(_BBPS_PENDING_REFUNDS) + len(_DMT_PENDING_REFUNDS),
            "matched": len(matched),
            "created": len(created),
            "unmatched": len(unmatched),
            "impacted_users": len(user_impact),
            "create_missing": request.create_missing,
            "owner_uid": request.owner_uid,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "success": True,
        "dry_run": request.dry_run,
        "create_missing": request.create_missing,
        "owner_uid": request.owner_uid,
        "total_candidates": len(_BBPS_PENDING_REFUNDS) + len(_DMT_PENDING_REFUNDS),
        "matched_count": len(matched),
        "created_count": len(created),
        "unmatched_count": len(unmatched),
        "impacted_users_count": len(user_impact),
        "impacted_users": list(user_impact.values()),
        "unmatched": unmatched,
    }

