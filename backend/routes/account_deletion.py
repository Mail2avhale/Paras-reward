"""
account_deletion.py — Public account-deletion request endpoint.

Required by Google Play Store policy and Android Data Safety form.
The URL backing this is /delete-account on the frontend; it must be
reachable WITHOUT login (users may have lost their credentials).

Flow:
    1. User fills mobile + email + (optional) reason.
    2. POST /api/account/deletion-request  → stored in `account_deletion_requests`.
    3. Admin reviews via dashboard, manually deletes/anonymises user data
       and marks the request 'processed'. SLA: 30 days.

We deliberately do NOT delete immediately — most fintech / reward apps
need a verification step (matching the email/mobile to a real user) and
a cooling-off period for accidental requests.
"""
import re
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import dotenv_values

from server import get_current_user

router = APIRouter(prefix="/account", tags=["account-deletion"])

_env = dotenv_values("/app/backend/.env")
_client = AsyncIOMotorClient(_env["MONGO_URL"])
db = _client[_env["DB_NAME"]]

_MOBILE_RE = re.compile(r"^[6-9]\d{9}$")  # Indian 10-digit mobile


class DeletionRequestBody(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10)
    email: EmailStr
    reason: str = Field("", max_length=600)


@router.post("/deletion-request")
async def submit_deletion_request(body: DeletionRequestBody):
    # ── Validate
    mobile = body.mobile.strip()
    if not _MOBILE_RE.match(mobile):
        raise HTTPException(400, "Please enter a valid 10-digit Indian mobile number")
    email = body.email.lower().strip()

    # Soft rate-limit: only one open request per mobile/email
    existing = await db.account_deletion_requests.find_one({
        "$and": [
            {"$or": [{"mobile": mobile}, {"email": email}]},
            {"status": {"$in": ["received", "verifying"]}},
        ]
    })
    if existing:
        return {
            "success": True,
            "already_open": True,
            "message": "We've already received a deletion request for this account. Our team will process it within 30 days.",
            "request_id": existing.get("request_id"),
        }

    # Try to resolve the user (informational only — request stored either way)
    user = await db.users.find_one(
        {"$or": [{"mobile": mobile}, {"email": email}]},
        {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1},
    )

    request_id = str(uuid.uuid4())
    doc = {
        "request_id": request_id,
        "mobile": mobile,
        "email": email,
        "reason": body.reason.strip(),
        "matched_uid": (user or {}).get("uid"),
        "matched_name": (user or {}).get("name"),
        "status": "received",  # received → verifying → processed | rejected
        "created_at": datetime.now(timezone.utc),
        "processed_at": None,
        "admin_note": None,
    }
    await db.account_deletion_requests.insert_one(doc)
    return {
        "success": True,
        "request_id": request_id,
        "message": "Your deletion request has been submitted. We'll process it within 30 days and email you a confirmation.",
        "found_account": bool(user),
    }


# ── Admin endpoints (read + mark-processed) ────────────────────────────────
def _admin_only(user: dict):
    role = (user.get("role") or "").lower()
    if role not in {"admin", "super_admin", "manager"}:
        raise HTTPException(403, "Admin only")


@router.get("/admin/deletion-requests")
async def list_deletion_requests(status: str = "received", limit: int = 100, user: dict = Depends(get_current_user)):
    _admin_only(user)
    q = {} if status == "all" else {"status": status}
    docs = await db.account_deletion_requests.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    for d in docs:
        d["created_at"] = d["created_at"].isoformat() if hasattr(d.get("created_at"), "isoformat") else d.get("created_at")
        if d.get("processed_at"):
            d["processed_at"] = d["processed_at"].isoformat() if hasattr(d["processed_at"], "isoformat") else d["processed_at"]
    return {"success": True, "requests": docs, "count": len(docs)}


class ProcessBody(BaseModel):
    status: str  # processed | rejected
    admin_note: str = Field("", max_length=600)


@router.patch("/admin/deletion-requests/{request_id}")
async def mark_request_status(request_id: str, body: ProcessBody, user: dict = Depends(get_current_user)):
    _admin_only(user)
    if body.status not in {"processed", "rejected", "verifying"}:
        raise HTTPException(400, "Invalid status")
    res = await db.account_deletion_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": body.status,
            "admin_note": body.admin_note.strip(),
            "processed_at": datetime.now(timezone.utc),
            "processed_by_uid": user["uid"],
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Request not found")
    return {"success": True}
