"""
KYC Routes - Extracted from server.py
Handles all KYC submission, verification, and admin management
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import asyncio
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
    """List all KYC submissions (Admin)"""
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
        
        # Calculate skip from page if skip not provided
        actual_skip = skip if skip is not None else (page - 1) * limit
        
        kyc_list = await db.kyc.find(
            query,
            {"_id": 0, "aadhaar_front_base64": 0, "aadhaar_back_base64": 0, "pan_front_base64": 0, "selfie_base64": 0}
        ).sort("submitted_at", -1).skip(actual_skip).limit(limit).to_list(length=limit)
        
        total = await db.kyc.count_documents(query)
        
        # Enrich with user info
        for kyc in kyc_list:
            user = await db.users.find_one({"uid": kyc["uid"]}, {"name": 1, "email": 1, "mobile": 1})
            if user:
                kyc["user_name"] = user.get("name")
                kyc["user_email"] = user.get("email")
                kyc["user_mobile"] = user.get("mobile")
        
        return {
            "users": kyc_list,
            "total": total,
            "limit": limit,
            "skip": actual_skip,
            "page": page,
            "total_pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        
        return kyc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# New endpoint to match frontend path: /kyc/{kyc_id}/verify
@router.post("/{kyc_id}/verify")
async def verify_kyc_by_id(kyc_id: str, request: Request):
    """Verify/Approve KYC by kyc_id (Admin) - matches frontend path"""
    try:
        data = await request.json()
        admin_id = data.get("admin_id") or data.get("admin_uid")
        action = data.get("action", "approve")
        
        # Find KYC by kyc_id
        kyc = await db.kyc.find_one({"kyc_id": kyc_id})
        if not kyc:
            # Try finding by uid as fallback
            kyc = await db.kyc.find_one({"uid": kyc_id})
        
        if not kyc:
            raise HTTPException(status_code=404, detail="KYC not found")
        
        uid = kyc.get("uid")
        now = datetime.now(timezone.utc).isoformat()
        
        if action == "approve":
            await db.kyc.update_one(
                {"kyc_id": kyc_id} if kyc.get("kyc_id") else {"uid": uid},
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
            
            return {"message": "KYC verified successfully", "status": "verified"}
        else:
            reason = data.get("reason", "Documents not clear or invalid")
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
            
            return {"message": "KYC rejected", "status": "rejected"}
    except HTTPException:
        raise
    except Exception as e:
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
    """Get KYC statistics (Admin)"""
    try:
        pending = await db.kyc.count_documents({"status": "pending"})
        verified = await db.kyc.count_documents({"status": "verified"})
        rejected = await db.kyc.count_documents({"status": "rejected"})
        total = await db.kyc.count_documents({})
        
        # Also check users collection for comparison
        users_pending = await db.users.count_documents({"kyc_status": "pending"})
        users_verified = await db.users.count_documents({"kyc_status": {"$in": ["verified", "approved"]}})
        
        return {
            "pending": pending,
            "verified": verified,
            "rejected": rejected,
            "total": total,
            "users_kyc_pending": users_pending,
            "users_kyc_verified": users_verified
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    - Checks: PAN validity and holder name
    """
    # Check if user exists
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify PAN
    result = await verify_pan_lite(
        pan_number=data.pan_number,
        name=data.name,
        dob=data.dob,
        client_ref_id=f"PAN_{uid}_{int(datetime.now().timestamp())}"
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    # If verified, update user's KYC status
    if result["verified"]:
        now = datetime.now(timezone.utc).isoformat()
        
        # Get holder name from response
        pan_holder_name = result.get("pan_holder_name", "")
        
        # Update user
        await db.users.update_one(
            {"uid": uid},
            {
                "$set": {
                    "pan_number": data.pan_number.upper(),
                    "pan_verified": True,
                    "pan_verified_at": now,
                    "pan_holder_name": pan_holder_name,
                    "pan_category": result.get("pan_category", ""),
                    "kyc_status": "pan_verified" if not user.get("aadhaar_verified") else "verified"
                }
            }
        )
        
        # Log verification
        await db.kyc_verifications.insert_one({
            "uid": uid,
            "type": "pan",
            "pan_number": data.pan_number.upper(),
            "name": data.name,
            "verified": True,
            "pan_status": result["pan_status"],
            "pan_holder_name": pan_holder_name,
            "verified_at": now,
            "method": "eko_pan_touras"
        })
        
        return {
            "success": True,
            "verified": True,
            "message": "PAN verified successfully!",
            "details": {
                "pan_valid": result["pan_valid"],
                "pan_holder_name": pan_holder_name,
                "pan_status": result["pan_status_desc"],
                "pan_category": result.get("pan_category", "")
            }
        }
    else:
        return {
            "success": True,
            "verified": False,
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
