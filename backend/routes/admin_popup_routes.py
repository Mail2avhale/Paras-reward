"""
Admin Popup Message Routes
Allows admin to broadcast messages to all users
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import logging

router = APIRouter(prefix="/admin/popup", tags=["Admin - Popup Messages"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ========== REQUEST MODELS ==========

class PopupMessageCreate(BaseModel):
    title: str
    message: str
    button_text: Optional[str] = "Close"
    button_link: Optional[str] = None
    message_type: Optional[str] = "info"  # info, warning, success, error
    enabled: Optional[bool] = True


class PopupMessageUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    button_text: Optional[str] = None
    button_link: Optional[str] = None
    message_type: Optional[str] = None
    enabled: Optional[bool] = None


# ========== PUBLIC API (For Users) ==========

@router.get("/active")
async def get_active_popup():
    """Get currently active popup message for users"""
    try:
        popup = await db.popup_messages.find_one(
            {"enabled": True},
            {"_id": 0}
        )
        
        if not popup:
            return {"success": True, "data": None, "has_popup": False}
        
        return {
            "success": True,
            "has_popup": True,
            "data": {
                "id": popup.get("popup_id"),
                "title": popup.get("title"),
                "message": popup.get("message"),
                "button_text": popup.get("button_text", "Close"),
                "button_link": popup.get("button_link"),
                "message_type": popup.get("message_type", "info"),
                "updated_at": popup.get("updated_at")
            }
        }
    except Exception as e:
        logging.error(f"[POPUP] Get active error: {e}")
        return {"success": False, "message": str(e)}


# ========== ADMIN APIs ==========

@router.get("/all")
async def get_all_popups():
    """Get all popup messages (admin)"""
    try:
        popups = await db.popup_messages.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).to_list(50)
        
        return {
            "success": True,
            "data": popups,
            "total": len(popups)
        }
    except Exception as e:
        logging.error(f"[POPUP] Get all error: {e}")
        return {"success": False, "message": str(e)}


@router.post("/create")
async def create_popup(req: PopupMessageCreate, request: Request):
    """Create new popup message"""
    try:
        # Generate popup ID
        popup_id = f"popup_{int(datetime.now().timestamp())}"
        
        popup_data = {
            "popup_id": popup_id,
            "title": req.title,
            "message": req.message,
            "button_text": req.button_text or "Close",
            "button_link": req.button_link,
            "message_type": req.message_type or "info",
            "enabled": req.enabled if req.enabled is not None else True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # If enabling this popup, disable all others
        if popup_data["enabled"]:
            await db.popup_messages.update_many(
                {},
                {"$set": {"enabled": False}}
            )
        
        await db.popup_messages.insert_one(popup_data)
        
        # Remove _id for response
        popup_data.pop("_id", None)
        
        return {
            "success": True,
            "message": "Popup message created successfully",
            "data": popup_data
        }
    except Exception as e:
        logging.error(f"[POPUP] Create error: {e}")
        return {"success": False, "message": str(e)}


@router.put("/update/{popup_id}")
async def update_popup(popup_id: str, req: PopupMessageUpdate):
    """Update existing popup message"""
    try:
        # Build update data
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        
        if req.title is not None:
            update_data["title"] = req.title
        if req.message is not None:
            update_data["message"] = req.message
        if req.button_text is not None:
            update_data["button_text"] = req.button_text
        if req.button_link is not None:
            update_data["button_link"] = req.button_link
        if req.message_type is not None:
            update_data["message_type"] = req.message_type
        if req.enabled is not None:
            update_data["enabled"] = req.enabled
            # If enabling this popup, disable all others
            if req.enabled:
                await db.popup_messages.update_many(
                    {"popup_id": {"$ne": popup_id}},
                    {"$set": {"enabled": False}}
                )
        
        result = await db.popup_messages.update_one(
            {"popup_id": popup_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Popup not found")
        
        return {
            "success": True,
            "message": "Popup message updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[POPUP] Update error: {e}")
        return {"success": False, "message": str(e)}


@router.patch("/toggle/{popup_id}")
async def toggle_popup(popup_id: str):
    """Toggle popup enabled/disabled"""
    try:
        popup = await db.popup_messages.find_one({"popup_id": popup_id})
        if not popup:
            raise HTTPException(status_code=404, detail="Popup not found")
        
        new_status = not popup.get("enabled", False)
        
        # If enabling, disable all others
        if new_status:
            await db.popup_messages.update_many(
                {"popup_id": {"$ne": popup_id}},
                {"$set": {"enabled": False}}
            )
        
        await db.popup_messages.update_one(
            {"popup_id": popup_id},
            {"$set": {
                "enabled": new_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": f"Popup {'enabled' if new_status else 'disabled'}",
            "enabled": new_status
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[POPUP] Toggle error: {e}")
        return {"success": False, "message": str(e)}


@router.delete("/delete/{popup_id}")
async def delete_popup(popup_id: str):
    """Delete popup message"""
    try:
        result = await db.popup_messages.delete_one({"popup_id": popup_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Popup not found")
        
        return {
            "success": True,
            "message": "Popup message deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[POPUP] Delete error: {e}")
        return {"success": False, "message": str(e)}
