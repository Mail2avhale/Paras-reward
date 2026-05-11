"""
KYC Routes - Extracted from server.py
Handles all KYC submission, verification, and admin management
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import asyncio
import logging
import uuid

# Initialize router
router = APIRouter(prefix="/kyc", tags=["KYC"])

# Import db from server (will be set during app initialization)
db = None

def set_db(database):
    """Set database instance from main server"""
    global db
    db = database

# ========== KYC MODELS ==========
class KYCDocument(BaseModel):
    kyc_id: str
    uid: str
    full_name: str
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    status: str = "pending"
    submitted_at: str
    verified_at: Optional[str] = None
    verified_by: Optional[str] = None
    rejection_reason: Optional[str] = None

class KYCSubmit(BaseModel):
    full_name: str
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_front_base64: Optional[str] = None
    aadhaar_back_base64: Optional[str] = None
    pan_front_base64: Optional[str] = None
    selfie_base64: Optional[str] = None

# ========== HELPER FUNCTIONS ==========
async def check_unique_fields(field_name: str, value: str, exclude_uid: Optional[str] = None):
    """Check if a field value is unique across users"""
    query = {field_name: value}
    if exclude_uid:
        query["uid"] = {"$ne": exclude_uid}
    existing = await db.users.find_one(query)
    return existing is None

async def get_duplicate_field_owner(field_name: str, value: str):
    """Get owner info of duplicate field"""
    user = await db.users.find_one({field_name: value}, {"email": 1, "mobile": 1, "uid": 1})
    return user

# ========== KYC ROUTES ==========
@router.post("/submit/{uid}", response_model=KYCDocument)
async def submit_kyc(uid: str, kyc_data: KYCSubmit):
    """Submit KYC documents with improved error handling"""
    
    try:
        # Check if Aadhaar number is unique
        if kyc_data.aadhaar_number:
            aadhaar_clean = kyc_data.aadhaar_number.replace(" ", "").strip()
            if len(aadhaar_clean) != 12 or not aadhaar_clean.isdigit():
                raise HTTPException(status_code=400, detail="Invalid Aadhaar number. Must be 12 digits.")
            
            try:
                is_unique = await asyncio.wait_for(
                    check_unique_fields("aadhaar_number", aadhaar_clean, exclude_uid=uid),
                    timeout=10.0
                )
                if not is_unique:
                    owner = await asyncio.wait_for(
                        get_duplicate_field_owner("aadhaar_number", aadhaar_clean),
                        timeout=5.0
                    )
                    owner_hint = ""
                    if owner:
                        masked_email = owner.get("email", "")[:3] + "***" if owner.get("email") else ""
                        owner_hint = f" (already registered with {masked_email})"
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Aadhaar number already registered{owner_hint}. Please use correct Aadhaar number."
                    )
            except asyncio.TimeoutError:
                raise HTTPException(status_code=504, detail="Database timeout. Please try again.")
            kyc_data.aadhaar_number = aadhaar_clean
        
        # Check if PAN number is unique
        if kyc_data.pan_number:
            pan_clean = kyc_data.pan_number.replace(" ", "").strip().upper()
            if len(pan_clean) != 10:
                raise HTTPException(status_code=400, detail="Invalid PAN number. Must be 10 characters.")
            
            try:
                is_unique = await asyncio.wait_for(
                    check_unique_fields("pan_number", pan_clean, exclude_uid=uid),
                    timeout=10.0
                )
                if not is_unique:
                    owner = await asyncio.wait_for(
                        get_duplicate_field_owner("pan_number", pan_clean),
                        timeout=5.0
                    )
                    owner_hint = ""
                    if owner:
                        masked_email = owner.get("email", "")[:3] + "***" if owner.get("email") else ""
                        owner_hint = f" (already registered with {masked_email})"
                    raise HTTPException(
                        status_code=400, 
                        detail=f"PAN number already registered{owner_hint}. Please use correct PAN number."
                    )
            except asyncio.TimeoutError:
                raise HTTPException(status_code=504, detail="Database timeout. Please try again.")
            kyc_data.pan_number = pan_clean
        
        # Validate base64 images
        if kyc_data.aadhaar_front_base64:
            if not kyc_data.aadhaar_front_base64.startswith('data:image'):
                raise HTTPException(status_code=400, detail="Invalid Aadhaar front image format")
        if kyc_data.aadhaar_back_base64:
            if not kyc_data.aadhaar_back_base64.startswith('data:image'):
                raise HTTPException(status_code=400, detail="Invalid Aadhaar back image format")
        if kyc_data.pan_front_base64:
            if not kyc_data.pan_front_base64.startswith('data:image'):
                raise HTTPException(status_code=400, detail="Invalid PAN image format")
        if kyc_data.selfie_base64:
            if not kyc_data.selfie_base64.startswith('data:image'):
                raise HTTPException(status_code=400, detail="Invalid selfie image format")
        
        kyc_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        kyc_doc = {
            "kyc_id": kyc_id,
            "uid": uid,
            "full_name": kyc_data.full_name,
            "aadhaar_number": kyc_data.aadhaar_number,
            "pan_number": kyc_data.pan_number,
            "aadhaar_front_base64": kyc_data.aadhaar_front_base64,
            "aadhaar_back_base64": kyc_data.aadhaar_back_base64,
            "pan_front_base64": kyc_data.pan_front_base64,
            "selfie_base64": kyc_data.selfie_base64,
            "status": "pending",
            "submitted_at": now,
            "verified_at": None,
            "verified_by": None,
            "rejection_reason": None
        }
        
        # Check for existing KYC
        existing = await db.kyc.find_one({"uid": uid})
        if existing:
            # Update existing KYC
            await db.kyc.update_one(
                {"uid": uid},
                {"$set": {
                    **kyc_doc,
                    "kyc_id": existing.get("kyc_id", kyc_id),
                    "resubmitted_at": now,
                    "resubmit_count": existing.get("resubmit_count", 0) + 1
                }}
            )
            kyc_doc["kyc_id"] = existing.get("kyc_id", kyc_id)
        else:
            await db.kyc.insert_one(kyc_doc)
        
        # Update user's KYC status
        # Use None instead of empty string to avoid duplicate key errors on sparse indexes
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "kyc_status": "pending",
                "kyc_submitted_at": now,
                "aadhaar_number": kyc_data.aadhaar_number if kyc_data.aadhaar_number else None,
                "pan_number": kyc_data.pan_number if kyc_data.pan_number else None
            }}
        )
        
        return KYCDocument(
            kyc_id=kyc_doc["kyc_id"],
            uid=uid,
            full_name=kyc_data.full_name,
            aadhaar_number=kyc_data.aadhaar_number,
            pan_number=kyc_data.pan_number,
            status="pending",
            submitted_at=now
        )
        
    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e)
        print(f"KYC Submit Error: {e}")
        
        # Handle MongoDB duplicate key errors with user-friendly messages
        if "E11000" in error_str or "duplicate key" in error_str.lower():
            # Parse which field caused the duplicate
            if "pan_number" in error_str:
                if "pan_number: \"\"" in error_str or "pan_number: ''" in error_str or "{ pan_number: \"\" }" in error_str:
                    # Empty pan_number duplicate - database index issue
                    raise HTTPException(
                        status_code=400,
                        detail="PAN number is required. Please enter your PAN number."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="This PAN number is already registered with another account. Please use the correct PAN."
                    )
            elif "aadhaar_number" in error_str:
                if "aadhaar_number: \"\"" in error_str or "{ aadhaar_number: \"\" }" in error_str:
                    raise HTTPException(
                        status_code=400,
                        detail="Aadhaar number is required. Please enter your Aadhaar number."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="This Aadhaar number is already registered with another account. Please use the correct Aadhaar."
                    )
            elif "mobile" in error_str:
                raise HTTPException(
                    status_code=400,
                    detail="This mobile number is already registered with another account."
                )
            elif "email" in error_str:
                raise HTTPException(
                    status_code=400,
                    detail="This email is already registered with another account."
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail="A document with these details already exists. Please check your information."
                )
        
        # Handle timeout errors
        if "timeout" in error_str.lower():
            raise HTTPException(
                status_code=504,
                detail="Server is busy. Please try again in a few seconds."
            )
        
        # Handle connection errors
        if "connection" in error_str.lower() or "network" in error_str.lower():
            raise HTTPException(
                status_code=503,
                detail="Network error. Please check your internet connection and try again."
            )
        
        # Generic error with cleaner message
        raise HTTPException(
            status_code=500, 
            detail="KYC submission failed. Please try again. If the problem persists, contact support."
        )

@router.get("/status/{uid}")
async def get_kyc_status(uid: str):
    """Get KYC status for a user"""
    try:
        kyc = await db.kyc.find_one({"uid": uid}, {"_id": 0, "aadhaar_front_base64": 0, "aadhaar_back_base64": 0, "pan_front_base64": 0, "selfie_base64": 0})
        user = await db.users.find_one({"uid": uid}, {"kyc_status": 1, "kyc_verified_at": 1})
        
        if not kyc:
            return {
                "status": user.get("kyc_status", "not_submitted") if user else "not_submitted",
                "submitted": False,
                "verified": False
            }
        
        return {
            "status": kyc.get("status", "pending"),
            "submitted": True,
            "verified": kyc.get("status") == "verified",
            "submitted_at": kyc.get("submitted_at"),
            "verified_at": kyc.get("verified_at"),
            "rejection_reason": kyc.get("rejection_reason"),
            "full_name": kyc.get("full_name"),
            "aadhaar_number": kyc.get("aadhaar_number", "")[-4:] if kyc.get("aadhaar_number") else None,
            "pan_number": kyc.get("pan_number", "")[:4] + "****" + kyc.get("pan_number", "")[-1:] if kyc.get("pan_number") else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_kyc(
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    skip: Optional[int] = None
):
    """List all KYC submissions (Admin) — optimized for production scale."""
    try:
        query = {}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"full_name": {"$regex": search, "$options": "i"}},
                {"uid": {"$regex": search, "$options": "i"}},
                {"aadhaar_number": {"$regex": search, "$options": "i"}},
                {"pan_number": {"$regex": search, "$options": "i"}}
            ]

        actual_skip = skip if skip is not None else (page - 1) * limit

        # Run list + count in PARALLEL to halve total wall-time.
        # `submitted_at` may not be indexed → fallback to `created_at` if sort fails.
        # Each fetch is bounded by an asyncio timeout so a slow Atlas response
        # never escalates into a 500 → "Database is busy" toast on the admin
        # page when the user already has prior data displayed.
        async def _fetch_list():
            try:
                return await asyncio.wait_for(
                    db.kyc.find(
                        query,
                        {"_id": 0, "aadhaar_front_base64": 0, "aadhaar_back_base64": 0,
                         "pan_front_base64": 0, "selfie_base64": 0}
                    ).sort("submitted_at", -1).skip(actual_skip).limit(limit).to_list(length=limit),
                    timeout=8.0,
                )
            except asyncio.TimeoutError:
                logging.warning("[KYC list] _fetch_list timed out on submitted_at sort; trying created_at")
                try:
                    return await asyncio.wait_for(
                        db.kyc.find(
                            query,
                            {"_id": 0, "aadhaar_front_base64": 0, "aadhaar_back_base64": 0,
                             "pan_front_base64": 0, "selfie_base64": 0}
                        ).sort("created_at", -1).skip(actual_skip).limit(limit).to_list(length=limit),
                        timeout=6.0,
                    )
                except Exception as e2:
                    logging.warning(f"[KYC list] both sort attempts failed: {e2}; returning empty")
                    return []
            except Exception as e:
                logging.warning(f"[KYC list] sort by submitted_at failed: {e}; trying created_at")
                try:
                    return await asyncio.wait_for(
                        db.kyc.find(
                            query,
                            {"_id": 0, "aadhaar_front_base64": 0, "aadhaar_back_base64": 0,
                             "pan_front_base64": 0, "selfie_base64": 0}
                        ).sort("created_at", -1).skip(actual_skip).limit(limit).to_list(length=limit),
                        timeout=6.0,
                    )
                except Exception as e2:
                    logging.warning(f"[KYC list] both sort attempts failed: {e2}; returning empty")
                    return []

        async def _count():
            try:
                # Bound count_documents with timeout — never block the page
                return await asyncio.wait_for(db.kyc.count_documents(query), timeout=5.0)
            except asyncio.TimeoutError:
                logging.warning("[KYC list] count_documents timed out; falling back to estimated count")
                # Fallback: estimated count is O(1) but doesn't honor query
                try:
                    return await db.kyc.estimated_document_count()
                except Exception:
                    return 0
            except Exception as ce:
                logging.warning(f"[KYC list] count error: {ce}")
                return 0

        kyc_list, total = await asyncio.gather(_fetch_list(), _count())

        # BATCH user enrichment — 1 query instead of N (was N+1 problem).
        if kyc_list:
            uids = [k["uid"] for k in kyc_list if k.get("uid")]
            users_by_uid = {}
            try:
                async for u in db.users.find(
                    {"uid": {"$in": uids}},
                    {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1},
                ):
                    users_by_uid[u["uid"]] = u
            except Exception as ue:
                logging.warning(f"[KYC list] batch user lookup failed: {ue}")
            for kyc in kyc_list:
                u = users_by_uid.get(kyc.get("uid"))
                if u:
                    kyc["user_name"] = u.get("name")
                    kyc["user_email"] = u.get("email")
                    kyc["user_mobile"] = u.get("mobile")

        return {
            "users": kyc_list,
            "total": total,
            "limit": limit,
            "skip": actual_skip,
            "page": page,
            "total_pages": (total + limit - 1) // limit if total else 1
        }
    except Exception as e:
        # Graceful degradation: never let the admin KYC page show a hard 500.
        # Log the underlying issue and return empty data so the UI keeps the
        # cards loaded (or simply shows "No KYC documents found" until the
        # next refresh tick succeeds).
        logging.error(f"[KYC list] hard error (graceful return): {e}")
        return {
            "users": [],
            "total": 0,
            "limit": limit,
            "skip": (page - 1) * limit if not skip else skip,
            "page": page,
            "total_pages": 1,
            "_degraded": True,
        }

@router.get("/details/{uid}")
async def get_kyc_details(uid: str):
    """Get full KYC details including images (Admin)"""
    try:
        kyc = await db.kyc.find_one({"uid": uid}, {"_id": 0})
        if not kyc:
            raise HTTPException(status_code=404, detail="KYC not found")
        
        user = await db.users.find_one({"uid": uid}, {"name": 1, "email": 1, "mobile": 1, "created_at": 1})
        if user:
            kyc["user_name"] = user.get("name")
            kyc["user_email"] = user.get("email")
            kyc["user_mobile"] = user.get("mobile")
            kyc["user_joined"] = user.get("created_at")
        
        # Map base64 fields to short names for frontend compatibility
        kyc["aadhaar_front"] = kyc.get("aadhaar_front_base64")
        kyc["aadhaar_back"] = kyc.get("aadhaar_back_base64")
        kyc["pan_front"] = kyc.get("pan_front_base64")
        kyc["selfie"] = kyc.get("selfie_base64")
        
        return kyc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# New endpoint to match frontend path: /kyc/{kyc_id}/verify
@router.post("/{kyc_id}/verify")
async def verify_kyc_by_id(kyc_id: str, request: Request):
    """Verify/Approve KYC by kyc_id (Admin) - matches frontend path.

    SUPER RESILIENT (May 11, 2026 fix):
    - The path param `kyc_id` may actually be kyc_id, uid, mobile, OR email.
    - Tries ALL four lookups in order; finds the right record no matter what.
    - If no KYC record exists but the user does → AUTO-CREATES a verified KYC
      record on the fly (admin force-approve semantics — Admin trust path).
    - All update queries use $or so we never miss an update on legacy data.
    """
    try:
        data = await request.json()
        admin_id = data.get("admin_id") or data.get("admin_uid") or "admin"
        action = data.get("action", "approve")

        identifier = (kyc_id or "").strip()
        if not identifier:
            raise HTTPException(status_code=400, detail="Missing identifier")

        # --- Robust multi-field lookup -------------------------------------
        kyc = None
        # 1. Try kyc_id (exact)
        kyc = await db.kyc.find_one({"kyc_id": identifier})
        # 2. Try uid (exact) — covers legacy records without kyc_id
        if not kyc:
            kyc = await db.kyc.find_one({"uid": identifier})
        # 3. Treat as mobile (last 10 digits)
        if not kyc and identifier.replace("+", "").replace("-", "").isdigit():
            digits = "".join(c for c in identifier if c.isdigit())[-10:]
            if digits:
                user_doc = await db.users.find_one(
                    {"$or": [{"mobile": digits}, {"mobile": f"+91{digits}"},
                             {"phone": digits}, {"phone": f"+91{digits}"}]},
                    {"_id": 0, "uid": 1}
                )
                if user_doc:
                    kyc = await db.kyc.find_one({"uid": user_doc["uid"]})
                    if not kyc:
                        # No KYC record at all → ghost record from a sync issue.
                        # We'll auto-create one below if action=approve.
                        kyc = {"uid": user_doc["uid"], "kyc_id": None, "_ghost": True}
        # 4. Treat as email
        if not kyc and "@" in identifier:
            user_doc = await db.users.find_one(
                {"email": identifier}, {"_id": 0, "uid": 1}
            )
            if user_doc:
                kyc = await db.kyc.find_one({"uid": user_doc["uid"]})
                if not kyc:
                    kyc = {"uid": user_doc["uid"], "kyc_id": None, "_ghost": True}

        if not kyc:
            raise HTTPException(status_code=404, detail="KYC / user not found for this identifier")

        uid = kyc.get("uid")
        if not uid:
            raise HTTPException(status_code=400, detail="KYC record has no associated user")

        now = datetime.now(timezone.utc).isoformat()

        # Build a $or-based filter so we update the right doc regardless of
        # which lookup matched.
        update_filter = {"$or": [{"kyc_id": identifier}, {"uid": uid}]}
        if kyc.get("kyc_id"):
            update_filter = {"$or": [{"kyc_id": kyc["kyc_id"]}, {"uid": uid}]}

        if action == "approve":
            # Auto-create kyc doc if it's a ghost (user exists but no kyc record)
            if kyc.get("_ghost"):
                await db.kyc.update_one(
                    {"uid": uid},
                    {
                        "$setOnInsert": {
                            "kyc_id": str(uuid.uuid4()),
                            "uid": uid,
                            "submitted_at": now,
                            "verification_method": "admin_force_approve",
                        },
                        "$set": {
                            "status": "verified",
                            "verified_at": now,
                            "verified_by": admin_id,
                        }
                    },
                    upsert=True
                )
            else:
                await db.kyc.update_one(
                    update_filter,
                    {"$set": {
                        "status": "verified",
                        "verified_at": now,
                        "verified_by": admin_id,
                    }}
                )

            await db.users.update_one(
                {"uid": uid},
                {"$set": {
                    "kyc_status": "verified",
                    "kyc_verified_at": now,
                    "kyc_verified_by": admin_id
                }}
            )

            logging.info(f"[KYC verify] approved uid={uid} via identifier={identifier} by admin={admin_id}")
            return {"message": "KYC verified successfully", "status": "verified", "uid": uid}
        else:
            reason = data.get("reason") or data.get("notes") or "Documents not clear or invalid"
            if not kyc.get("_ghost"):
                await db.kyc.update_one(
                    update_filter,
                    {"$set": {
                        "status": "rejected",
                        "rejection_reason": reason,
                        "rejected_at": now,
                        "rejected_by": admin_id
                    }}
                )
            await db.users.update_one(
                {"uid": uid},
                {"$set": {
                    "kyc_status": "rejected",
                    "kyc_rejection_reason": reason,
                    "kyc_rejected_at": now
                }}
            )
            logging.info(f"[KYC verify] rejected uid={uid} via identifier={identifier} by admin={admin_id}")
            return {"message": "KYC rejected", "status": "rejected", "uid": uid}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[KYC verify] error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# BULLETPROOF BULK VERIFY (May 11, 2026)
# ---------------------------------------------------------------------------
# Frontend AdminKYC.js calls POST /kyc/bulk-verify with {kyc_ids:[...], action,
# admin_id, reason}. Each entry in kyc_ids may be a kyc_id OR a uid (legacy
# records). We loop through each ID and call the same resilient logic as the
# single-verify endpoint so admin can mass-approve without any failures.
# ---------------------------------------------------------------------------
@router.post("/bulk-verify")
async def bulk_verify_kyc(request: Request):
    """Approve / reject multiple KYC records in one call (Admin)."""
    try:
        data = await request.json()
        ids = data.get("kyc_ids") or []
        action = data.get("action", "approve")
        admin_id = data.get("admin_id") or data.get("admin_uid") or "admin"
        reason = data.get("reason") or data.get("notes") or "Documents not clear or invalid"

        if not ids:
            raise HTTPException(status_code=400, detail="No KYC IDs provided")
        if action not in ("approve", "reject"):
            raise HTTPException(status_code=400, detail="Invalid action")

        now = datetime.now(timezone.utc).isoformat()
        modified = 0
        failures = []

        for ident in ids:
            try:
                # Find by kyc_id OR uid (legacy fallback)
                kyc = await db.kyc.find_one(
                    {"$or": [{"kyc_id": ident}, {"uid": ident}]}
                )
                if not kyc:
                    failures.append({"id": ident, "reason": "not_found"})
                    continue

                uid = kyc.get("uid")
                update_filter = {"$or": [
                    {"kyc_id": kyc.get("kyc_id")} if kyc.get("kyc_id") else {"uid": uid},
                    {"uid": uid}
                ]}

                if action == "approve":
                    await db.kyc.update_one(
                        update_filter,
                        {"$set": {
                            "status": "verified",
                            "verified_at": now,
                            "verified_by": admin_id
                        }}
                    )
                    await db.users.update_one(
                        {"uid": uid},
                        {"$set": {
                            "kyc_status": "verified",
                            "kyc_verified_at": now,
                            "kyc_verified_by": admin_id
                        }}
                    )
                else:
                    await db.kyc.update_one(
                        update_filter,
                        {"$set": {
                            "status": "rejected",
                            "rejection_reason": reason,
                            "rejected_at": now,
                            "rejected_by": admin_id
                        }}
                    )
                    await db.users.update_one(
                        {"uid": uid},
                        {"$set": {
                            "kyc_status": "rejected",
                            "kyc_rejection_reason": reason,
                            "kyc_rejected_at": now
                        }}
                    )
                modified += 1
            except Exception as inner_err:
                logging.warning(f"[KYC bulk-verify] {ident} failed: {inner_err}")
                failures.append({"id": ident, "reason": str(inner_err)})

        return {
            "success": True,
            "modified": modified,
            "total": len(ids),
            "failures": failures,
            "action": action,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[KYC bulk-verify] hard error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# FORCE APPROVE BY ANY IDENTIFIER (May 11, 2026)
# ---------------------------------------------------------------------------
# Admin escape-hatch: when a user comes to admin saying "approve my KYC" but
# their record can't be found in the UI, admin can paste ANY identifier here
# (kyc_id, uid, mobile, email, name partial) and get an instant verified
# status. Auto-creates a kyc doc if the user exists but no kyc record.
#
# This endpoint is intended to be hit from the new "Force Approve" modal in
# the Admin KYC page. It uses the same resilient logic as `/verify` but
# additionally supports name-partial search.
# ---------------------------------------------------------------------------
@router.post("/admin/force-approve")
async def admin_force_approve_kyc(request: Request):
    """Force-approve a KYC by ANY identifier. Auto-creates record if missing.

    Body: {identifier: str, admin_id: str, reason: str (optional)}
    `identifier` accepts: kyc_id, uid, mobile (10-digit), email, or name part.
    """
    try:
        data = await request.json()
        identifier = (data.get("identifier") or "").strip()
        admin_id = data.get("admin_id") or data.get("admin_uid") or "admin"

        if not identifier:
            raise HTTPException(status_code=400, detail="Identifier required")

        # --- Find user via any of the lookups -----------------------------
        user = None
        uid = None
        kyc = None

        # 1. KYC by kyc_id
        kyc = await db.kyc.find_one({"kyc_id": identifier})
        if kyc:
            uid = kyc.get("uid")

        # 2. KYC / users by uid
        if not kyc:
            kyc = await db.kyc.find_one({"uid": identifier})
            if kyc:
                uid = kyc.get("uid")
            else:
                user = await db.users.find_one({"uid": identifier})
                if user:
                    uid = user.get("uid")

        # 3. Mobile (10-digit anywhere in string)
        if not uid:
            digits = "".join(c for c in identifier if c.isdigit())
            if len(digits) >= 10:
                tail = digits[-10:]
                user = await db.users.find_one({
                    "$or": [
                        {"mobile": tail}, {"mobile": f"+91{tail}"},
                        {"phone": tail}, {"phone": f"+91{tail}"},
                        {"mobile": {"$regex": f"{tail}$"}}
                    ]
                })
                if user:
                    uid = user.get("uid")
                    kyc = await db.kyc.find_one({"uid": uid})

        # 4. Email
        if not uid and "@" in identifier:
            user = await db.users.find_one({"email": identifier.lower()})
            if user:
                uid = user.get("uid")
                kyc = await db.kyc.find_one({"uid": uid})

        # 5. Name partial (best-effort, case-insensitive)
        if not uid:
            user = await db.users.find_one({
                "$or": [
                    {"name": {"$regex": identifier, "$options": "i"}},
                    {"first_name": {"$regex": identifier, "$options": "i"}}
                ]
            })
            if user:
                uid = user.get("uid")
                kyc = await db.kyc.find_one({"uid": uid})

        if not uid:
            raise HTTPException(
                status_code=404,
                detail=f"No user found matching identifier '{identifier}'"
            )

        # Resolve user details for response
        if not user:
            user = await db.users.find_one(
                {"uid": uid}, {"_id": 0, "name": 1, "mobile": 1, "email": 1}
            ) or {}

        now = datetime.now(timezone.utc).isoformat()

        # AUTO-CREATE kyc doc if missing — admin trust path
        if not kyc:
            await db.kyc.insert_one({
                "kyc_id": str(uuid.uuid4()),
                "uid": uid,
                "submitted_at": now,
                "status": "verified",
                "verified_at": now,
                "verified_by": admin_id,
                "verification_method": "admin_force_approve",
            })
            created = True
        else:
            created = False
            await db.kyc.update_one(
                {"$or": [{"kyc_id": kyc.get("kyc_id")} if kyc.get("kyc_id") else {"uid": uid},
                         {"uid": uid}]},
                {"$set": {
                    "status": "verified",
                    "verified_at": now,
                    "verified_by": admin_id,
                    "force_approved_by_admin": True,
                }}
            )

        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "kyc_status": "verified",
                "kyc_verified_at": now,
                "kyc_verified_by": admin_id
            }}
        )

        logging.info(
            f"[KYC force-approve] uid={uid} via '{identifier}' by admin={admin_id} "
            f"(created={created})"
        )
        return {
            "success": True,
            "message": (
                "KYC force-approved successfully (auto-created record)" if created
                else "KYC force-approved successfully"
            ),
            "uid": uid,
            "user_name": user.get("name") if user else None,
            "user_mobile": user.get("mobile") if user else None,
            "auto_created": created,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[KYC force-approve] error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))




# New endpoint: /kyc/{kyc_id}/reject  
@router.post("/{kyc_id}/reject")
async def reject_kyc_by_id(kyc_id: str, request: Request):
    """Reject KYC by kyc_id (Admin) - matches frontend path"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id") or data.get("admin_uid")
        reason = data.get("reason", "Documents not clear or invalid")
        
        # Find KYC by kyc_id
        kyc = await db.kyc.find_one({"kyc_id": kyc_id})
        if not kyc:
            kyc = await db.kyc.find_one({"uid": kyc_id})
        
        if not kyc:
            raise HTTPException(status_code=404, detail="KYC not found")
        
        uid = kyc.get("uid")
        now = datetime.now(timezone.utc).isoformat()
        
        await db.kyc.update_one(
            {"kyc_id": kyc_id} if kyc.get("kyc_id") else {"uid": uid},
            {"$set": {
                "status": "rejected",
                "rejection_reason": reason,
                "rejected_at": now,
                "rejected_by": admin_id
            }}
        )
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "kyc_status": "rejected",
                "kyc_rejection_reason": reason,
                "kyc_rejected_at": now
            }}
        )
        
        return {"message": "KYC rejected", "status": "rejected", "reason": reason}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Backfill: ensure every KYC record has a kyc_id.
# Some legacy records (auto-verified via Eko PAN-lite that used `upsert=True`
# without `$setOnInsert`) lack `kyc_id`, which makes the admin Approve/Reject
# buttons appear inactive in the UI (the disabled check matches `undefined`
# on both sides). Run once after deploy to repair existing data.
# ---------------------------------------------------------------------------
@router.post("/admin/backfill-kyc-ids")
async def backfill_kyc_ids():
    """Assign a kyc_id to any kyc record missing one. Idempotent."""
    try:
        cursor = db.kyc.find(
            {"$or": [{"kyc_id": {"$exists": False}}, {"kyc_id": None}, {"kyc_id": ""}]},
            {"_id": 1, "uid": 1}
        )
        repaired = 0
        async for doc in cursor:
            await db.kyc.update_one(
                {"_id": doc["_id"]},
                {"$set": {"kyc_id": str(uuid.uuid4())}}
            )
            repaired += 1
        return {
            "success": True,
            "repaired": repaired,
            "message": f"Backfilled kyc_id for {repaired} legacy KYC record(s)."
        }
    except Exception as e:
        logging.error(f"[KYC backfill] error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/verify/{uid}")
async def verify_kyc(uid: str, request: Request):
    """Verify/Approve KYC (Admin)"""
    try:
        data = await request.json()
        admin_uid = data.get("admin_uid")
        
        kyc = await db.kyc.find_one({"uid": uid})
        if not kyc:
            raise HTTPException(status_code=404, detail="KYC not found")
        
        now = datetime.now(timezone.utc).isoformat()
        
        await db.kyc.update_one(
            {"uid": uid},
            {"$set": {
                "status": "verified",
                "verified_at": now,
                "verified_by": admin_uid
            }}
        )
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "kyc_status": "verified",
                "kyc_verified_at": now,
                "kyc_verified_by": admin_uid
            }}
        )
        
        return {"message": "KYC verified successfully", "status": "verified"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject/{uid}")
async def reject_kyc(uid: str, request: Request):
    """Reject KYC with reason (Admin)"""
    try:
        data = await request.json()
        admin_uid = data.get("admin_uid")
        reason = data.get("reason", "Documents not clear or invalid")
        
        kyc = await db.kyc.find_one({"uid": uid})
        if not kyc:
            raise HTTPException(status_code=404, detail="KYC not found")
        
        now = datetime.now(timezone.utc).isoformat()
        
        await db.kyc.update_one(
            {"uid": uid},
            {"$set": {
                "status": "rejected",
                "rejection_reason": reason,
                "rejected_at": now,
                "rejected_by": admin_uid
            }}
        )
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "kyc_status": "rejected",
                "kyc_rejection_reason": reason
            }}
        )
        
        return {"message": "KYC rejected", "reason": reason}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_kyc_stats():
    """Get KYC statistics (Admin) — counts run in parallel with timeout."""
    async def _count(coll, q):
        try:
            return await asyncio.wait_for(coll.count_documents(q), timeout=5.0)
        except Exception:
            return 0
    try:
        pending, verified, rejected, total, users_pending, users_verified = await asyncio.gather(
            _count(db.kyc, {"status": "pending"}),
            _count(db.kyc, {"status": "verified"}),
            _count(db.kyc, {"status": "rejected"}),
            _count(db.kyc, {}),
            _count(db.users, {"kyc_status": "pending"}),
            _count(db.users, {"kyc_status": {"$in": ["verified", "approved"]}}),
        )
        return {
            "pending": pending,
            "verified": verified,
            "rejected": rejected,
            "total": total,
            "users_kyc_pending": users_pending,
            "users_kyc_verified": users_verified,
        }
    except Exception as e:
        logging.error(f"[KYC stats] error: {e}")
        # Never crash the page — return zeros so UI keeps rendering
        return {
            "pending": 0, "verified": 0, "rejected": 0, "total": 0,
            "users_kyc_pending": 0, "users_kyc_verified": 0,
            "error": str(e)[:120],
        }


@router.get("/debug")
async def debug_kyc():
    """Debug KYC data issues"""
    try:
        # Count from db.kyc
        kyc_pending = await db.kyc.count_documents({"status": "pending"})
        kyc_total = await db.kyc.count_documents({})
        
        # Get sample pending records
        sample_pending = await db.kyc.find(
            {"status": "pending"},
            {"_id": 0, "uid": 1, "status": 1, "full_name": 1, "submitted_at": 1}
        ).limit(5).to_list(length=5)
        
        # Get all unique statuses
        statuses = await db.kyc.distinct("status")
        
        # Check if there are records without status field
        no_status = await db.kyc.count_documents({"status": {"$exists": False}})
        null_status = await db.kyc.count_documents({"status": None})
        empty_status = await db.kyc.count_documents({"status": ""})
        
        return {
            "kyc_collection": {
                "pending": kyc_pending,
                "total": kyc_total,
                "unique_statuses": statuses,
                "no_status_field": no_status,
                "null_status": null_status,
                "empty_status": empty_status,
                "sample_pending": sample_pending
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== USER-FACING KYC DOCUMENT VIEW & UPDATE ====================

@router.get("/my-documents/{uid}")
async def get_my_kyc_documents(uid: str):
    """Get user's own KYC documents with masked numbers and images"""
    try:
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        kyc = await db.kyc.find_one({"uid": uid}, {"_id": 0})
        
        # Build response with masked numbers
        aadhaar_raw = (kyc or {}).get("aadhaar_number") or user.get("aadhaar_number") or user.get("aadhaar") or ""
        pan_raw = (kyc or {}).get("pan_number") or user.get("pan_number") or user.get("pan") or ""
        
        # Mask: Aadhaar XXXX XXXX 1234, PAN ABCD****F
        masked_aadhaar = None
        if aadhaar_raw and len(aadhaar_raw) >= 4:
            clean = aadhaar_raw.replace(" ", "")
            masked_aadhaar = "XXXX XXXX " + clean[-4:]
        
        masked_pan = None
        if pan_raw and len(pan_raw) >= 5:
            masked_pan = pan_raw[:4] + "****" + pan_raw[-1:]
        
        result = {
            "has_documents": bool(kyc),
            "kyc_status": (kyc or {}).get("status") or user.get("kyc_status", "not_submitted"),
            "full_name": (kyc or {}).get("full_name") or user.get("name", ""),
            "aadhaar_masked": masked_aadhaar,
            "pan_masked": masked_pan,
            "submitted_at": (kyc or {}).get("submitted_at"),
            "verified_at": (kyc or {}).get("verified_at"),
            "rejection_reason": (kyc or {}).get("rejection_reason"),
            # Images (base64) - only return if they exist
            "aadhaar_front": (kyc or {}).get("aadhaar_front_base64") or None,
            "aadhaar_back": (kyc or {}).get("aadhaar_back_base64") or None,
            "pan_front": (kyc or {}).get("pan_front_base64") or None,
            "selfie": (kyc or {}).get("selfie_base64") or None
        }
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update/{uid}")
async def update_kyc(uid: str, kyc_data: KYCSubmit):
    """Update KYC documents - resets status to pending for re-verification"""
    try:
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Build update data
        update_data = {
            "full_name": kyc_data.full_name,
            "status": "pending",
            "updated_at": now,
            "previous_status": "updated_by_user"
        }
        
        # Update document fields based on what's provided
        if kyc_data.aadhaar_number:
            aadhaar_clean = kyc_data.aadhaar_number.replace(" ", "").strip()
            if len(aadhaar_clean) != 12 or not aadhaar_clean.isdigit():
                raise HTTPException(status_code=400, detail="Invalid Aadhaar number. Must be 12 digits.")
            
            # Check uniqueness
            is_unique = await check_unique_fields("aadhaar_number", aadhaar_clean, exclude_uid=uid)
            if not is_unique:
                raise HTTPException(status_code=400, detail="This Aadhaar number is already registered with another account.")
            
            update_data["aadhaar_number"] = aadhaar_clean
            await db.users.update_one({"uid": uid}, {"$set": {"aadhaar_number": aadhaar_clean}})
        
        if kyc_data.pan_number:
            pan_clean = kyc_data.pan_number.replace(" ", "").strip().upper()
            if len(pan_clean) != 10:
                raise HTTPException(status_code=400, detail="Invalid PAN number. Must be 10 characters.")
            
            is_unique = await check_unique_fields("pan_number", pan_clean, exclude_uid=uid)
            if not is_unique:
                raise HTTPException(status_code=400, detail="This PAN number is already registered with another account.")
            
            update_data["pan_number"] = pan_clean
            await db.users.update_one({"uid": uid}, {"$set": {"pan_number": pan_clean}})
        
        if kyc_data.aadhaar_front_base64:
            update_data["aadhaar_front_base64"] = kyc_data.aadhaar_front_base64
        if kyc_data.aadhaar_back_base64:
            update_data["aadhaar_back_base64"] = kyc_data.aadhaar_back_base64
        if kyc_data.pan_front_base64:
            update_data["pan_front_base64"] = kyc_data.pan_front_base64
        if kyc_data.selfie_base64:
            update_data["selfie_base64"] = kyc_data.selfie_base64
        
        # Update or insert KYC document
        existing = await db.kyc.find_one({"uid": uid})
        if existing:
            await db.kyc.update_one({"uid": uid}, {"$set": update_data})
        else:
            update_data["uid"] = uid
            update_data["kyc_id"] = str(uuid.uuid4())
            update_data["submitted_at"] = now
            await db.kyc.insert_one(update_data)
        
        # Reset user kyc_status to pending
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "kyc_status": "pending",
                "kyc_updated_at": now
            }}
        )
        
        return {
            "success": True,
            "message": "KYC documents updated successfully. Your documents will be re-verified within 1-3 business days."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ==================== AUTO KYC VERIFICATION (EKO API) ====================
from services.eko_kyc_service import verify_pan_lite, send_aadhaar_otp, verify_aadhaar_otp

class PANVerifyRequest(BaseModel):
    pan_number: str = Field(..., description="10-character PAN number")
    name: str = Field(..., description="Name as per PAN")
    dob: str = Field(..., description="Date of birth (YYYY-MM-DD)")

class AadhaarOTPRequest(BaseModel):
    aadhaar_number: str = Field(..., description="12-digit Aadhaar number")

class AadhaarVerifyRequest(BaseModel):
    aadhaar_number: str = Field(..., description="12-digit Aadhaar number")
    otp: str = Field(..., description="6-digit OTP")
    client_ref_id: str = Field(..., description="Reference ID from OTP request")


@router.post("/auto-verify/pan/{uid}")
async def auto_verify_pan(uid: str, data: PANVerifyRequest):
    """
    Auto-verify PAN using Eko PAN Verification API
    - No OTP required
    - Instant verification
    - Auto KYC approval on success
    - Duplicate PAN detection
    """
    # Check if user exists
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check for duplicate PAN - another user already has this PAN
    pan_upper = data.pan_number.upper().strip()
    existing_pan_user = await db.users.find_one({
        "pan_number": pan_upper,
        "uid": {"$ne": uid}  # Exclude current user
    })
    
    if existing_pan_user:
        raise HTTPException(
            status_code=400, 
            detail=f"This PAN is already registered with another account. Please use a different PAN or contact support."
        )
    
    # Verify PAN via Eko API
    result = await verify_pan_lite(
        pan_number=data.pan_number,
        name=data.name,
        dob=data.dob,
        client_ref_id=f"PAN_{uid}_{int(datetime.now().timestamp())}"
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    # If verified, update user's KYC status to VERIFIED (auto-approve)
    if result["verified"]:
        now = datetime.now(timezone.utc).isoformat()
        
        # Get holder name from response
        pan_holder_name = result.get("pan_holder_name", "")
        
        # Update user - KYC is now VERIFIED (auto-approved)
        await db.users.update_one(
            {"uid": uid},
            {
                "$set": {
                    "pan_number": pan_upper,
                    "pan_verified": True,
                    "pan_verified_at": now,
                    "pan_holder_name": pan_holder_name,
                    "pan_category": result.get("pan_category", ""),
                    "kyc_status": "verified",  # Auto-approve KYC
                    "kyc_verified_at": now,
                    "kyc_method": "auto_pan_verification"
                }
            }
        )
        
        # Also update KYC collection if record exists
        await db.kyc.update_one(
            {"uid": uid},
            {
                "$set": {
                    "status": "verified",
                    "pan_number": pan_upper,
                    "pan_verified": True,
                    "pan_holder_name": pan_holder_name,
                    "verified_at": now,
                    "verification_method": "auto_pan"
                },
                "$setOnInsert": {
                    # Ensure new auto-verified PAN-only KYC records always get a
                    # kyc_id so admin Approve/Reject buttons work later if a user
                    # later submits documents and the status flips back to pending.
                    "kyc_id": str(uuid.uuid4()),
                    "uid": uid,
                    "submitted_at": now
                }
            },
            upsert=True
        )
        
        # Log verification
        await db.kyc_verifications.insert_one({
            "uid": uid,
            "type": "pan",
            "pan_number": pan_upper,
            "name": data.name,
            "verified": True,
            "pan_status": result["pan_status"],
            "pan_holder_name": pan_holder_name,
            "verified_at": now,
            "method": "eko_pan_touras",
            "kyc_auto_approved": True
        })
        
        return {
            "success": True,
            "verified": True,
            "kyc_approved": True,
            "message": "PAN verified successfully! KYC is now approved.",
            "details": {
                "pan_valid": result["pan_valid"],
                "pan_holder_name": pan_holder_name,
                "pan_status": result["pan_status_desc"],
                "pan_category": result.get("pan_category", ""),
                "kyc_status": "verified"
            }
        }
    else:
        return {
            "success": True,
            "verified": False,
            "kyc_approved": False,
            "message": result["message"],
            "details": {
                "pan_status": result.get("pan_status_desc", "Unknown"),
                "reason": result.get("pan_status", "Verification failed")
            }
        }


@router.post("/auto-verify/aadhaar/send-otp/{uid}")
async def auto_verify_aadhaar_send_otp(uid: str, data: AadhaarOTPRequest):
    """
    Step 1: Send OTP to Aadhaar-linked mobile number
    """
    # Check if user exists
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    client_ref_id = f"AADHAAR_{uid}_{int(datetime.now().timestamp())}"
    
    result = await send_aadhaar_otp(
        aadhaar_number=data.aadhaar_number,
        client_ref_id=client_ref_id
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    # Store access_key for verification step (critical for Eko API)
    await db.aadhaar_otp_sessions.update_one(
        {"uid": uid},
        {
            "$set": {
                "uid": uid,
                "aadhaar_number": data.aadhaar_number,
                "access_key": result.get("access_key", ""),
                "client_ref_id": client_ref_id,
                "otp_sent_at": datetime.now(timezone.utc).isoformat(),
                "verified": False
            }
        },
        upsert=True
    )
    
    return {
        "success": True,
        "otp_sent": True,
        "message": "OTP sent to your Aadhaar-linked mobile number",
        "client_ref_id": client_ref_id
    }


@router.post("/auto-verify/aadhaar/verify-otp/{uid}")
async def auto_verify_aadhaar_verify_otp(uid: str, data: AadhaarVerifyRequest):
    """
    Step 2: Verify OTP and complete Aadhaar verification
    """
    # Check if user exists
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get OTP session - need access_key from previous step
    session = await db.aadhaar_otp_sessions.find_one({"uid": uid, "client_ref_id": data.client_ref_id})
    if not session:
        raise HTTPException(status_code=400, detail="OTP session not found. Please request OTP again.")
    
    access_key = session.get("access_key", "")
    if not access_key:
        raise HTTPException(status_code=400, detail="Session expired. Please request OTP again.")
    
    result = await verify_aadhaar_otp(
        aadhaar_number=data.aadhaar_number,
        otp=data.otp,
        access_key=access_key
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    if result["verified"]:
        now = datetime.now(timezone.utc).isoformat()
        aadhaar_data = result.get("aadhaar_data", {})
        
        # Update user
        update_data = {
            "aadhaar_number": data.aadhaar_number[-4:].rjust(12, 'X'),  # Masked
            "aadhaar_verified": True,
            "aadhaar_verified_at": now,
            "aadhaar_name": aadhaar_data.get("name"),
            "aadhaar_dob": aadhaar_data.get("dob"),
            "aadhaar_gender": aadhaar_data.get("gender"),
            "aadhaar_address": aadhaar_data.get("address"),
            "aadhaar_state": aadhaar_data.get("state"),
            "aadhaar_pincode": aadhaar_data.get("pincode"),
            "kyc_status": "verified" if user.get("pan_verified") else "aadhaar_verified"
        }
        
        await db.users.update_one({"uid": uid}, {"$set": update_data})
        
        # Mark session as verified
        await db.aadhaar_otp_sessions.update_one(
            {"uid": uid, "client_ref_id": data.client_ref_id},
            {"$set": {"verified": True, "verified_at": now}}
        )
        
        # Log verification
        await db.kyc_verifications.insert_one({
            "uid": uid,
            "type": "aadhaar",
            "masked_aadhaar": data.aadhaar_number[-4:].rjust(12, 'X'),
            "verified": True,
            "verified_at": now,
            "method": "eko_aadhaar_otp",
            "aadhaar_name": aadhaar_data.get("name"),
            "aadhaar_state": aadhaar_data.get("state")
        })
        
        return {
            "success": True,
            "verified": True,
            "message": "Aadhaar verified successfully!",
            "details": {
                "name": aadhaar_data.get("name"),
                "dob": aadhaar_data.get("dob"),
                "gender": aadhaar_data.get("gender"),
                "state": aadhaar_data.get("state"),
                "pincode": aadhaar_data.get("pincode")
            }
        }
    else:
        return {
            "success": True,
            "verified": False,
            "message": result["message"]
        }


@router.get("/verification-status/{uid}")
async def get_verification_status(uid: str):
    """
    Get user's KYC verification status
    """
    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    pan_verified = user.get("pan_verified", False)
    aadhaar_verified = user.get("aadhaar_verified", False)
    kyc_status = user.get("kyc_status", "not_submitted")
    
    return {
        "success": True,
        "uid": uid,
        "kyc_status": kyc_status,
        "pan": {
            "verified": pan_verified,
            "verified_at": user.get("pan_verified_at"),
            "name_match": user.get("pan_name_match"),
            "number": user.get("pan_number")
        },
        "aadhaar": {
            "verified": aadhaar_verified,
            "verified_at": user.get("aadhaar_verified_at"),
            "name": user.get("aadhaar_name"),
            "masked_number": user.get("aadhaar_number")
        },
        "fully_verified": pan_verified or aadhaar_verified,
        "options": {
            "can_verify_pan": not pan_verified,
            "can_verify_aadhaar": not aadhaar_verified
        }
    }
