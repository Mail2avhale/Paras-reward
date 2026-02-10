"""
Admin Settings Routes - System settings and configuration
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Settings"])

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


# ========== GENERAL SETTINGS ==========

@router.get("/settings")
async def get_all_settings():
    """Get all system settings"""
    settings = await db.settings.find({}, {"_id": 0}).to_list(100)
    return {"settings": {s.get("key"): s for s in settings}}


@router.get("/settings/{key}")
async def get_setting(key: str):
    """Get specific setting by key"""
    setting = await db.settings.find_one({"key": key}, {"_id": 0})
    if not setting:
        return {"key": key, "value": None, "exists": False}
    return setting


@router.post("/settings/{key}")
async def update_setting(key: str, request: Request):
    """Update or create a setting"""
    data = await request.json()
    admin_id = data.get("admin_id")
    value = data.get("value")
    
    now = datetime.now(timezone.utc)
    
    await db.settings.update_one(
        {"key": key},
        {"$set": {
            "key": key,
            "value": value,
            "updated_at": now.isoformat(),
            "updated_by": admin_id
        }},
        upsert=True
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="setting_updated",
            entity_type="settings",
            entity_id=key,
            details={"new_value": str(value)[:100]}
        )
    
    return {"success": True, "message": f"Setting '{key}' updated"}


@router.delete("/settings/{key}")
async def delete_setting(key: str, admin_id: str):
    """Delete a setting"""
    result = await db.settings.delete_one({"key": key})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    return {"success": True, "message": f"Setting '{key}' deleted"}


# ========== PRC ECONOMY SETTINGS ==========

@router.get("/prc-economy/settings")
async def get_prc_economy_settings():
    """Get PRC economy settings"""
    settings = await db.settings.find_one({"key": "prc_economy"}, {"_id": 0})
    
    if not settings:
        default_settings = {
            "key": "prc_economy",
            "mining_enabled": True,
            "base_mining_rate": 0.5,
            "vip_mining_rates": {
                "startup": 1.0,
                "growth": 2.0,
                "elite": 5.0
            },
            "daily_mining_cap": 100,
            "referral_bonus_percentage": 10,
            "prc_to_inr_rate": 1.0
        }
        await db.settings.insert_one(default_settings)
        return default_settings
    
    return settings


@router.post("/prc-economy/settings")
async def update_prc_economy_settings(request: Request):
    """Update PRC economy settings"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    settings_data = {k: v for k, v in data.items() if k != "admin_id"}
    settings_data["key"] = "prc_economy"
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    settings_data["updated_by"] = admin_id
    
    await db.settings.update_one(
        {"key": "prc_economy"},
        {"$set": settings_data},
        upsert=True
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="prc_economy_updated",
            entity_type="settings"
        )
    
    return {"success": True, "message": "PRC economy settings updated"}


@router.get("/prc-economy/stats")
async def get_prc_economy_stats():
    """Get PRC economy statistics"""
    try:
        # Total PRC in circulation
        total_prc = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$prc_balance"}}}
        ]).to_list(1)
        
        # Total mined
        total_mined = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$total_mined"}}}
        ]).to_list(1)
        
        # Active miners (mined in last 24h)
        yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        active_miners = await db.users.count_documents({"last_mining_claim": {"$gte": yesterday}})
        
        return {
            "total_prc_circulation": round(total_prc[0]["total"], 4) if total_prc else 0,
            "total_prc_mined": round(total_mined[0]["total"], 4) if total_mined else 0,
            "active_miners_24h": active_miners
        }
    except Exception as e:
        return {"error": str(e)}


# ========== VIDEO ADS SETTINGS ==========

@router.get("/video-ads/settings")
async def get_video_ads_settings():
    """Get video ads settings"""
    settings = await db.settings.find_one({"key": "video_ads"}, {"_id": 0})
    return settings or {"key": "video_ads", "enabled": False, "reward_per_view": 0.1}


@router.post("/video-ads/settings")
async def update_video_ads_settings(request: Request):
    """Update video ads settings"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    await db.settings.update_one(
        {"key": "video_ads"},
        {"$set": {
            "key": "video_ads",
            "enabled": data.get("enabled", False),
            "reward_per_view": data.get("reward_per_view", 0.1),
            "daily_limit": data.get("daily_limit", 10),
            "cooldown_minutes": data.get("cooldown_minutes", 5),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": admin_id
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Video ads settings updated"}


@router.get("/video-ads/list")
async def get_video_ads_list():
    """Get list of video ads"""
    ads = await db.video_ads.find({"is_active": True}, {"_id": 0}).to_list(100)
    return {"ads": ads, "count": len(ads)}


@router.post("/video-ads")
async def add_video_ad(request: Request):
    """Add a new video ad"""
    data = await request.json()
    
    ad = {
        "ad_id": str(uuid.uuid4()),
        "title": data.get("title"),
        "video_url": data.get("video_url"),
        "duration_seconds": data.get("duration_seconds", 30),
        "reward_amount": data.get("reward_amount", 0.1),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.video_ads.insert_one(ad)
    ad.pop("_id", None)
    
    return {"success": True, "ad": ad}


@router.delete("/video-ads/{ad_id}")
async def delete_video_ad(ad_id: str):
    """Delete a video ad"""
    result = await db.video_ads.update_one(
        {"ad_id": ad_id},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    return {"success": True, "message": "Ad deleted"}


# ========== REGISTRATION SETTINGS ==========

@router.get("/registration/settings")
async def get_registration_settings():
    """Get registration settings"""
    settings = await db.settings.find_one({"key": "registration"}, {"_id": 0})
    return settings or {
        "key": "registration",
        "enabled": True,
        "require_referral": False,
        "welcome_bonus": 0
    }


@router.post("/registration/settings")
async def update_registration_settings(request: Request):
    """Update registration settings"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    await db.settings.update_one(
        {"key": "registration"},
        {"$set": {
            "key": "registration",
            "enabled": data.get("enabled", True),
            "require_referral": data.get("require_referral", False),
            "welcome_bonus": data.get("welcome_bonus", 0),
            "registration_message": data.get("registration_message"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": admin_id
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Registration settings updated"}


# ========== CONTACT SUBMISSIONS ==========

@router.get("/contact-submissions")
async def get_contact_submissions(
    status: str = None,
    page: int = 1,
    limit: int = 50
):
    """Get contact form submissions"""
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    total = await db.contact_submissions.count_documents(query)
    
    submissions = await db.contact_submissions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"submissions": submissions, "total": total, "page": page}


@router.post("/contact-submissions/{submission_id}/respond")
async def respond_to_submission(submission_id: str, request: Request):
    """Respond to a contact submission"""
    data = await request.json()
    admin_id = data.get("admin_id")
    response = data.get("response")
    
    result = await db.contact_submissions.update_one(
        {"submission_id": submission_id},
        {"$set": {
            "status": "responded",
            "response": response,
            "responded_at": datetime.now(timezone.utc).isoformat(),
            "responded_by": admin_id
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    return {"success": True, "message": "Response saved"}


@router.delete("/contact-submissions/{submission_id}")
async def delete_submission(submission_id: str):
    """Delete a contact submission"""
    result = await db.contact_submissions.delete_one({"submission_id": submission_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    return {"success": True, "message": "Submission deleted"}


# Need to import these
from datetime import timedelta
import uuid
