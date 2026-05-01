"""
Creator Promotion monetization module.

Admin can manage paid creator campaigns while public/user surfaces can fetch
approved active campaigns and record lightweight engagement metrics.
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator


router = APIRouter(prefix="/creator-promotions", tags=["Creator Promotions"])
security = HTTPBearer(auto_error=False)

db = None

CAMPAIGN_STATUSES = ["draft", "pending_payment", "active", "paused", "completed", "cancelled"]
PAYMENT_STATUSES = ["unpaid", "partial", "paid", "refunded"]
PLATFORMS = ["youtube", "instagram", "facebook", "other"]
PLACEMENTS = ["dashboard", "rewards", "community", "notification", "featured"]

DEFAULT_PACKAGES = [
    {
        "package_id": "starter",
        "name": "Starter Boost",
        "price": 999,
        "currency": "INR",
        "duration_days": 3,
        "estimated_impressions": 1000,
        "placements": ["dashboard"],
        "features": ["Creator card in app", "Basic click tracking"],
    },
    {
        "package_id": "growth",
        "name": "Growth Campaign",
        "price": 2999,
        "currency": "INR",
        "duration_days": 7,
        "estimated_impressions": 5000,
        "placements": ["dashboard", "rewards"],
        "features": ["Featured creator card", "Audience targeting notes", "Performance report"],
    },
    {
        "package_id": "premium",
        "name": "Premium Creator Boost",
        "price": 9999,
        "currency": "INR",
        "duration_days": 14,
        "estimated_impressions": 20000,
        "placements": ["dashboard", "rewards", "notification", "featured"],
        "features": ["Priority featured slot", "Notification campaign", "Detailed analytics"],
    },
]


def set_db(database):
    global db
    db = database


async def require_admin_or_manager(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")

    secret = os.environ.get("JWT_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret is not configured")

    try:
        payload = jwt.decode(credentials.credentials, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = payload.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"uid": uid}, {"_id": 0, "uid": 1, "role": 1, "allowed_pages": 1, "name": 1})
    if not user or user.get("role") not in ["admin", "sub_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    if user.get("role") == "manager":
        allowed = user.get("allowed_pages", [])
        if "creator-promotions" not in allowed and "all" not in allowed:
            raise HTTPException(status_code=403, detail="Creator promotions permission required")

    return user


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize_campaign(campaign: dict) -> dict:
    if not campaign:
        return campaign
    campaign.pop("_id", None)
    return campaign


def clamp_non_negative(value: Optional[int]) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


class CreatorPromotionBase(BaseModel):
    creator_name: str = Field(..., min_length=2, max_length=120)
    contact_name: Optional[str] = Field(default="", max_length=120)
    contact_phone: Optional[str] = Field(default="", max_length=30)
    contact_email: Optional[str] = Field(default="", max_length=120)
    platform: str = Field(default="youtube")
    content_url: str = Field(..., min_length=8, max_length=600)
    title: str = Field(..., min_length=3, max_length=160)
    description: Optional[str] = Field(default="", max_length=1000)
    thumbnail_url: Optional[str] = Field(default="", max_length=600)
    package_id: str = Field(default="starter", max_length=60)
    package_name: str = Field(default="Starter Boost", max_length=120)
    price: float = Field(default=999, ge=0)
    gst_rate: float = Field(default=18, ge=0, le=28)
    duration_days: int = Field(default=7, ge=1, le=365)
    target_audience: Optional[str] = Field(default="", max_length=300)
    target_regions: List[str] = Field(default_factory=list)
    placements: List[str] = Field(default_factory=lambda: ["dashboard"])
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    status: str = "draft"
    payment_status: str = "unpaid"
    payment_reference: Optional[str] = Field(default="", max_length=160)
    notes: Optional[str] = Field(default="", max_length=1000)
    is_featured: bool = False

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, value):
        normalized = (value or "other").lower()
        if normalized not in PLATFORMS:
            raise ValueError(f"platform must be one of {PLATFORMS}")
        return normalized

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        normalized = (value or "draft").lower()
        if normalized not in CAMPAIGN_STATUSES:
            raise ValueError(f"status must be one of {CAMPAIGN_STATUSES}")
        return normalized

    @field_validator("payment_status")
    @classmethod
    def validate_payment_status(cls, value):
        normalized = (value or "unpaid").lower()
        if normalized not in PAYMENT_STATUSES:
            raise ValueError(f"payment_status must be one of {PAYMENT_STATUSES}")
        return normalized

    @field_validator("placements")
    @classmethod
    def validate_placements(cls, value):
        cleaned = []
        for placement in value or ["dashboard"]:
            normalized = str(placement).lower()
            if normalized not in PLACEMENTS:
                raise ValueError(f"placements must use values from {PLACEMENTS}")
            if normalized not in cleaned:
                cleaned.append(normalized)
        return cleaned or ["dashboard"]


class CreatorPromotionCreate(CreatorPromotionBase):
    pass


class CreatorPromotionUpdate(BaseModel):
    creator_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    contact_name: Optional[str] = Field(default=None, max_length=120)
    contact_phone: Optional[str] = Field(default=None, max_length=30)
    contact_email: Optional[str] = Field(default=None, max_length=120)
    platform: Optional[str] = None
    content_url: Optional[str] = Field(default=None, min_length=8, max_length=600)
    title: Optional[str] = Field(default=None, min_length=3, max_length=160)
    description: Optional[str] = Field(default=None, max_length=1000)
    thumbnail_url: Optional[str] = Field(default=None, max_length=600)
    package_id: Optional[str] = Field(default=None, max_length=60)
    package_name: Optional[str] = Field(default=None, max_length=120)
    price: Optional[float] = Field(default=None, ge=0)
    gst_rate: Optional[float] = Field(default=None, ge=0, le=28)
    duration_days: Optional[int] = Field(default=None, ge=1, le=365)
    target_audience: Optional[str] = Field(default=None, max_length=300)
    target_regions: Optional[List[str]] = None
    placements: Optional[List[str]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    payment_status: Optional[str] = None
    payment_reference: Optional[str] = Field(default=None, max_length=160)
    notes: Optional[str] = Field(default=None, max_length=1000)
    is_featured: Optional[bool] = None

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, value):
        if value is None:
            return value
        normalized = value.lower()
        if normalized not in PLATFORMS:
            raise ValueError(f"platform must be one of {PLATFORMS}")
        return normalized

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is None:
            return value
        normalized = value.lower()
        if normalized not in CAMPAIGN_STATUSES:
            raise ValueError(f"status must be one of {CAMPAIGN_STATUSES}")
        return normalized

    @field_validator("payment_status")
    @classmethod
    def validate_payment_status(cls, value):
        if value is None:
            return value
        normalized = value.lower()
        if normalized not in PAYMENT_STATUSES:
            raise ValueError(f"payment_status must be one of {PAYMENT_STATUSES}")
        return normalized

    @field_validator("placements")
    @classmethod
    def validate_placements(cls, value):
        if value is None:
            return value
        cleaned = []
        for placement in value:
            normalized = str(placement).lower()
            if normalized not in PLACEMENTS:
                raise ValueError(f"placements must use values from {PLACEMENTS}")
            if normalized not in cleaned:
                cleaned.append(normalized)
        return cleaned or ["dashboard"]


class CampaignStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = Field(default="", max_length=500)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        normalized = (value or "").lower()
        if normalized not in CAMPAIGN_STATUSES:
            raise ValueError(f"status must be one of {CAMPAIGN_STATUSES}")
        return normalized


class MetricEvent(BaseModel):
    event_type: str = Field(..., pattern="^(impression|click)$")
    placement: str = "dashboard"


@router.get("/packages")
async def get_creator_promotion_packages():
    return {"success": True, "packages": DEFAULT_PACKAGES}


@router.get("/admin")
async def list_creator_promotions(
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    platform: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_admin: dict = Depends(require_admin_or_manager),
):
    try:
        query = {}
        if status and status != "all":
            query["status"] = status
        if payment_status and payment_status != "all":
            query["payment_status"] = payment_status
        if platform and platform != "all":
            query["platform"] = platform
        if search:
            query["$or"] = [
                {"creator_name": {"$regex": search, "$options": "i"}},
                {"title": {"$regex": search, "$options": "i"}},
                {"contact_phone": {"$regex": search, "$options": "i"}},
                {"contact_email": {"$regex": search, "$options": "i"}},
            ]

        safe_limit = min(max(limit, 1), 100)
        safe_page = max(page, 1)
        skip = (safe_page - 1) * safe_limit

        total = await db.creator_promotions.count_documents(query)
        campaigns = await db.creator_promotions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(safe_limit).to_list(safe_limit)

        summary_pipeline = [
            {"$group": {
                "_id": None,
                "total_revenue": {"$sum": "$price"},
                "paid_revenue": {"$sum": {"$cond": [{"$eq": ["$payment_status", "paid"]}, "$price", 0]}},
                "active": {"$sum": {"$cond": [{"$eq": ["$status", "active"]}, 1, 0]}},
                "pending_payment": {"$sum": {"$cond": [{"$eq": ["$payment_status", "unpaid"]}, 1, 0]}},
                "impressions": {"$sum": "$metrics.impressions"},
                "clicks": {"$sum": "$metrics.clicks"},
            }}
        ]
        summary_docs = await db.creator_promotions.aggregate(summary_pipeline).to_list(1)
        summary = summary_docs[0] if summary_docs else {}
        summary.pop("_id", None)

        return {
            "success": True,
            "campaigns": campaigns,
            "pagination": {
                "page": safe_page,
                "limit": safe_limit,
                "total": total,
                "pages": (total + safe_limit - 1) // safe_limit,
            },
            "summary": {
                "total_revenue": round(summary.get("total_revenue", 0) or 0, 2),
                "paid_revenue": round(summary.get("paid_revenue", 0) or 0, 2),
                "active": summary.get("active", 0) or 0,
                "pending_payment": summary.get("pending_payment", 0) or 0,
                "impressions": summary.get("impressions", 0) or 0,
                "clicks": summary.get("clicks", 0) or 0,
            },
        }
    except Exception as e:
        logging.error(f"[CREATOR_PROMOTION] List error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load creator promotions")


@router.post("/admin")
async def create_creator_promotion(data: CreatorPromotionCreate, current_admin: dict = Depends(require_admin_or_manager)):
    try:
        now = now_iso()
        admin_uid = current_admin.get("uid")
        campaign_id = f"CP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

        campaign = data.model_dump()
        campaign.update({
            "campaign_id": campaign_id,
            "price": round(float(campaign.get("price", 0)), 2),
            "gst_amount": round(float(campaign.get("price", 0)) * float(campaign.get("gst_rate", 0)) / 100, 2),
            "total_amount": round(float(campaign.get("price", 0)) * (1 + float(campaign.get("gst_rate", 0)) / 100), 2),
            "metrics": {"impressions": 0, "clicks": 0},
            "created_by": admin_uid,
            "created_at": now,
            "updated_at": now,
        })

        await db.creator_promotions.insert_one(campaign)
        return {"success": True, "message": "Creator promotion campaign created", "campaign": serialize_campaign(campaign)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"[CREATOR_PROMOTION] Create error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create creator promotion")


@router.get("/admin/{campaign_id}")
async def get_creator_promotion(campaign_id: str, current_admin: dict = Depends(require_admin_or_manager)):
    campaign = await db.creator_promotions.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Creator promotion not found")
    return {"success": True, "campaign": campaign}


@router.put("/admin/{campaign_id}")
async def update_creator_promotion(
    campaign_id: str,
    data: CreatorPromotionUpdate,
    current_admin: dict = Depends(require_admin_or_manager),
):
    try:
        campaign = await db.creator_promotions.find_one({"campaign_id": campaign_id})
        if not campaign:
            raise HTTPException(status_code=404, detail="Creator promotion not found")

        update = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        if not update:
            return {"success": True, "message": "No changes supplied"}

        if "price" in update or "gst_rate" in update:
            price = float(update.get("price", campaign.get("price", 0)) or 0)
            gst_rate = float(update.get("gst_rate", campaign.get("gst_rate", 0)) or 0)
            update["price"] = round(price, 2)
            update["gst_amount"] = round(price * gst_rate / 100, 2)
            update["total_amount"] = round(price * (1 + gst_rate / 100), 2)

        admin_uid = current_admin.get("uid")
        update["updated_by"] = admin_uid
        update["updated_at"] = now_iso()

        await db.creator_promotions.update_one({"campaign_id": campaign_id}, {"$set": update})
        updated = await db.creator_promotions.find_one({"campaign_id": campaign_id}, {"_id": 0})
        return {"success": True, "message": "Creator promotion updated", "campaign": updated}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"[CREATOR_PROMOTION] Update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update creator promotion")


@router.patch("/admin/{campaign_id}/status")
async def update_creator_promotion_status(
    campaign_id: str,
    data: CampaignStatusUpdate,
    current_admin: dict = Depends(require_admin_or_manager),
):
    campaign = await db.creator_promotions.find_one({"campaign_id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Creator promotion not found")

    admin_uid = current_admin.get("uid")
    now = now_iso()
    history_entry = {
        "status": data.status,
        "note": data.note,
        "admin_uid": admin_uid,
        "created_at": now,
    }
    await db.creator_promotions.update_one(
        {"campaign_id": campaign_id},
        {
            "$set": {"status": data.status, "updated_at": now, "updated_by": admin_uid},
            "$push": {"status_history": history_entry},
        },
    )
    return {"success": True, "message": f"Campaign marked {data.status}", "status": data.status}


@router.delete("/admin/{campaign_id}")
async def delete_creator_promotion(campaign_id: str, current_admin: dict = Depends(require_admin_or_manager)):
    result = await db.creator_promotions.delete_one({"campaign_id": campaign_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Creator promotion not found")
    return {"success": True, "message": "Creator promotion deleted"}


@router.get("/active")
async def list_active_creator_promotions(placement: Optional[str] = None, limit: int = 10):
    query = {"status": "active"}
    if placement:
        query["placements"] = placement

    safe_limit = min(max(limit, 1), 30)
    campaigns = await db.creator_promotions.find(
        query,
        {
            "_id": 0,
            "campaign_id": 1,
            "creator_name": 1,
            "platform": 1,
            "content_url": 1,
            "title": 1,
            "description": 1,
            "thumbnail_url": 1,
            "target_audience": 1,
            "placements": 1,
            "is_featured": 1,
        },
    ).sort([("is_featured", -1), ("created_at", -1)]).limit(safe_limit).to_list(safe_limit)

    return {"success": True, "campaigns": campaigns}


@router.post("/{campaign_id}/metrics")
async def record_creator_promotion_metric(campaign_id: str, event: MetricEvent):
    metric_field = "metrics.impressions" if event.event_type == "impression" else "metrics.clicks"
    result = await db.creator_promotions.update_one(
        {"campaign_id": campaign_id, "status": "active"},
        {
            "$inc": {metric_field: 1},
            "$set": {"last_metric_at": now_iso()},
            "$push": {
                "metric_events": {
                    "$each": [{
                        "event_type": event.event_type,
                        "placement": event.placement,
                        "created_at": now_iso(),
                    }],
                    "$slice": -100,
                }
            },
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Active creator promotion not found")
    return {"success": True}
