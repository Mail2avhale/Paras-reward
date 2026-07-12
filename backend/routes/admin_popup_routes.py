"""
Admin Popup Message Routes — v2 with Rich Text, Image, YouTube, and
multiple CTA buttons.

Backward-compatible: legacy popups with only `title` + `message` (plain
text) continue to render normally on the client. New popups can now
additionally carry `message_html` (sanitized rich text), `image_url`
(uploaded image), `youtube_url` (external video embed), and
`cta_buttons` (array of {text, link, style}).
"""

from datetime import datetime, timezone
from typing import List, Optional
import base64
import io
import logging
import re
import uuid

import bleach
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/admin/popup", tags=["Admin - Popup Messages"])

# Public router — served under /api (no /admin prefix) so browser <img>
# tags can render popup banners without needing auth headers. Mounted
# alongside `router` from server.py.
public_router = APIRouter(tags=["Popup - Public"])

# Database reference — injected from server.py at startup.
db = None


def set_db(database):
    global db
    db = database


# ================== HTML SANITIZATION ==================

# Strict allowlist. Anything outside this set is stripped by bleach. This
# is the *only* thing standing between admin HTML and end-user XSS, so it
# is intentionally minimal.
ALLOWED_TAGS = [
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li",
    "h2", "h3", "h4",
    "blockquote", "code",
    "a", "span",
]
ALLOWED_ATTRS = {
    "a": ["href", "target", "rel"],
    "span": ["style"],
}
# Only allow safe URL schemes; javascript: and data: are blocked.
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_html(raw: Optional[str]) -> str:
    """Sanitize admin-authored HTML using a strict allowlist. Returns
    empty string for None. Adds `rel="noopener noreferrer"` and forces
    `target="_blank"` on all anchor tags so admin links can never
    hijack the parent window.
    """
    if not raw:
        return ""
    # Pre-strip content of tags that bleach's `strip=True` would leave
    # behind as visible text (e.g. <script>alert(1)</script> becomes the
    # literal string "alert(1)"). Not a security issue — bleach still
    # removes the executable tag — but ugly UX when an admin fat-fingers
    # a payload. Strip script/style tag *contents* entirely first.
    raw = re.sub(
        r'<(script|style|iframe)\b[^>]*>.*?</\1>',
        '',
        raw,
        flags=re.IGNORECASE | re.DOTALL,
    )
    cleaned = bleach.clean(
        raw,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,  # strip disallowed tags, don't escape
    )
    # Force safe link attributes on every <a>.
    cleaned = re.sub(
        r'<a\s+([^>]*?)>',
        lambda m: (
            '<a ' + re.sub(r'\s*(target|rel)="[^"]*"', '', m.group(1)).strip()
            + ' target="_blank" rel="noopener noreferrer">'
        ),
        cleaned,
    )
    return cleaned


def html_to_plain(html: str) -> str:
    """Fallback plain-text extraction so legacy `message` field stays
    populated for old clients that don't render HTML.
    """
    return bleach.clean(html or "", tags=[], strip=True).strip()


# ================== YOUTUBE URL PARSING ==================

_YT_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})"),
]


def parse_youtube_id(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    for pat in _YT_PATTERNS:
        m = pat.search(url)
        if m:
            return m.group(1)
    return None


# ================== REQUEST MODELS ==================

class CTAButton(BaseModel):
    text: str = Field(..., min_length=1, max_length=40)
    link: Optional[str] = None
    # style: primary | secondary | ghost — client renders accordingly.
    style: Optional[str] = "primary"


class PopupMessageCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    message: Optional[str] = ""          # legacy plain text
    message_html: Optional[str] = None   # NEW — sanitized rich text
    image_url: Optional[str] = None      # NEW — from upload endpoint
    youtube_url: Optional[str] = None    # NEW — external video
    cta_buttons: Optional[List[CTAButton]] = None  # NEW — multi CTA
    # Legacy single CTA fields (still supported).
    button_text: Optional[str] = "Close"
    button_link: Optional[str] = None
    message_type: Optional[str] = "info"
    enabled: Optional[bool] = True


class PopupMessageUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    message_html: Optional[str] = None
    image_url: Optional[str] = None
    youtube_url: Optional[str] = None
    cta_buttons: Optional[List[CTAButton]] = None
    button_text: Optional[str] = None
    button_link: Optional[str] = None
    message_type: Optional[str] = None
    enabled: Optional[bool] = None


def _shape_popup(popup: dict) -> dict:
    """Shape the DB document into the API response — same keys used by
    both `/active` (public) and `/all` (admin).
    """
    return {
        "id": popup.get("popup_id"),
        "popup_id": popup.get("popup_id"),
        "title": popup.get("title"),
        "message": popup.get("message", ""),
        "message_html": popup.get("message_html", ""),
        "image_url": popup.get("image_url"),
        "youtube_url": popup.get("youtube_url"),
        "youtube_id": parse_youtube_id(popup.get("youtube_url")),
        "cta_buttons": popup.get("cta_buttons", []),
        "button_text": popup.get("button_text", "Close"),
        "button_link": popup.get("button_link"),
        "message_type": popup.get("message_type", "info"),
        "enabled": popup.get("enabled", False),
        "created_at": popup.get("created_at"),
        "updated_at": popup.get("updated_at"),
    }


# ================== PUBLIC API (For Users) ==================

@router.get("/active")
async def get_active_popup():
    """Return the currently enabled popup for end-users, or `has_popup:
    False` if no popup is active.
    """
    try:
        popup = await db.popup_messages.find_one({"enabled": True}, {"_id": 0})
        if not popup:
            return {"success": True, "data": None, "has_popup": False}
        return {"success": True, "has_popup": True, "data": _shape_popup(popup)}
    except Exception as e:
        logging.error(f"[POPUP] Get active error: {e}")
        return {"success": False, "message": str(e)}


# ================== ADMIN APIs ==================

@router.get("/all")
async def get_all_popups():
    """List all popups (admin dashboard)."""
    try:
        docs = await db.popup_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
        return {"success": True, "data": [_shape_popup(d) for d in docs], "total": len(docs)}
    except Exception as e:
        logging.error(f"[POPUP] Get all error: {e}")
        return {"success": False, "message": str(e)}


def _apply_create_defaults(req: PopupMessageCreate) -> dict:
    """Normalize the incoming payload into the shape we persist."""
    now_iso = datetime.now(timezone.utc).isoformat()
    popup_id = f"popup_{int(datetime.now(timezone.utc).timestamp() * 1000)}"

    safe_html = sanitize_html(req.message_html) if req.message_html else ""
    # Keep plain `message` populated for old clients / previews.
    plain = (req.message or "").strip() or html_to_plain(safe_html)

    ctas = [b.dict() for b in (req.cta_buttons or [])] if req.cta_buttons else []

    return {
        "popup_id": popup_id,
        "title": req.title.strip(),
        "message": plain,
        "message_html": safe_html,
        "image_url": req.image_url or None,
        "youtube_url": req.youtube_url or None,
        "cta_buttons": ctas,
        "button_text": (req.button_text or "Close").strip(),
        "button_link": req.button_link or None,
        "message_type": req.message_type or "info",
        "enabled": bool(req.enabled) if req.enabled is not None else True,
        "created_at": now_iso,
        "updated_at": now_iso,
    }


@router.post("/create")
async def create_popup(req: PopupMessageCreate, request: Request):
    """Create a new popup. If `enabled=True` (default), all other popups
    are disabled first so only one is active at a time.
    """
    try:
        popup_data = _apply_create_defaults(req)
        if popup_data["enabled"]:
            await db.popup_messages.update_many({}, {"$set": {"enabled": False}})
        await db.popup_messages.insert_one(popup_data)
        popup_data.pop("_id", None)
        return {"success": True, "message": "Popup created", "data": _shape_popup(popup_data)}
    except Exception as e:
        logging.error(f"[POPUP] Create error: {e}")
        return {"success": False, "message": str(e)}


@router.put("/update/{popup_id}")
async def update_popup(popup_id: str, req: PopupMessageUpdate):
    """Patch an existing popup. Fields omitted from the request are left
    untouched.
    """
    try:
        upd: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}

        if req.title is not None:
            upd["title"] = req.title.strip()
        if req.message is not None:
            upd["message"] = req.message
        if req.message_html is not None:
            safe = sanitize_html(req.message_html)
            upd["message_html"] = safe
            # Refresh plain if no explicit message override sent.
            if req.message is None:
                upd["message"] = html_to_plain(safe)
        if req.image_url is not None:
            upd["image_url"] = req.image_url or None
        if req.youtube_url is not None:
            upd["youtube_url"] = req.youtube_url or None
        if req.cta_buttons is not None:
            upd["cta_buttons"] = [b.dict() for b in req.cta_buttons]
        if req.button_text is not None:
            upd["button_text"] = req.button_text
        if req.button_link is not None:
            upd["button_link"] = req.button_link
        if req.message_type is not None:
            upd["message_type"] = req.message_type
        if req.enabled is not None:
            upd["enabled"] = req.enabled
            if req.enabled:
                await db.popup_messages.update_many(
                    {"popup_id": {"$ne": popup_id}},
                    {"$set": {"enabled": False}},
                )

        result = await db.popup_messages.update_one({"popup_id": popup_id}, {"$set": upd})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Popup not found")
        return {"success": True, "message": "Popup updated"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[POPUP] Update error: {e}")
        return {"success": False, "message": str(e)}


@router.patch("/toggle/{popup_id}")
async def toggle_popup(popup_id: str):
    """Flip the `enabled` flag. If flipping ON, all others get disabled."""
    try:
        popup = await db.popup_messages.find_one({"popup_id": popup_id})
        if not popup:
            raise HTTPException(status_code=404, detail="Popup not found")

        new_status = not popup.get("enabled", False)
        if new_status:
            await db.popup_messages.update_many(
                {"popup_id": {"$ne": popup_id}},
                {"$set": {"enabled": False}},
            )
        await db.popup_messages.update_one(
            {"popup_id": popup_id},
            {"$set": {
                "enabled": new_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {"success": True, "message": f"Popup {'enabled' if new_status else 'disabled'}", "enabled": new_status}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[POPUP] Toggle error: {e}")
        return {"success": False, "message": str(e)}


@router.delete("/delete/{popup_id}")
async def delete_popup(popup_id: str):
    """Permanently remove the popup document."""
    try:
        result = await db.popup_messages.delete_one({"popup_id": popup_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Popup not found")
        return {"success": True, "message": "Popup deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[POPUP] Delete error: {e}")
        return {"success": False, "message": str(e)}


# ================== IMAGE UPLOAD ==================
#
# Design note (Feb 12, 2026 — production hotfix):
#
# Popup images are stored in MongoDB (base64 in the `popup_images`
# collection) rather than on local disk. Emergent production containers
# have ephemeral storage, so files under `backend/static/popups/` are
# wiped on container restart / redeploy — causing broken <img> tags on
# the end-user popup even though the admin's live-preview (rendered
# from memory in the same session) still shows the image.
#
# MongoDB persists across pod restarts AND is shared across pods, so
# the same image is now guaranteed to render for every user.

@router.post("/upload-image")
async def upload_popup_image(file: UploadFile = File(...)):
    """Upload + normalize an image used in a popup body. Produces a
    16:9 (800x450) JPEG saved to MongoDB. Response `image_url` is the
    dedicated fetch endpoint below.
    """
    if not file.filename:
        raise HTTPException(400, "Missing filename")
    ext = (file.filename.rsplit(".", 1)[-1] or "").lower()
    if ext not in ("png", "jpg", "jpeg", "webp"):
        raise HTTPException(400, f"Unsupported format: .{ext}. Use png/jpg/jpeg/webp")

    blob = await file.read()
    if len(blob) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 5 MB)")
    if len(blob) < 32:
        raise HTTPException(400, "File too small / empty")

    from PIL import Image, ImageOps
    try:
        img = Image.open(io.BytesIO(blob))
        img = ImageOps.exif_transpose(img)
        # Flatten transparency onto white so JPEG is clean.
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.convert("RGBA").split()[-1])
            img = bg
        else:
            img = img.convert("RGB")

        # Center-crop to 16:9 aspect ratio.
        w, h = img.size
        target_ratio = 16 / 9
        current_ratio = w / h
        if current_ratio > target_ratio:
            new_w = int(h * target_ratio)
            left = (w - new_w) // 2
            img = img.crop((left, 0, left + new_w, h))
        else:
            new_h = int(w / target_ratio)
            top = (h - new_h) // 2
            img = img.crop((0, top, w, top + new_h))

        # Resize to exact 800x450 — always. Small inputs get upscaled so
        # every popup banner is served at a consistent hero-image size.
        if img.size != (800, 450):
            img = img.resize((800, 450), Image.LANCZOS)

        out = io.BytesIO()
        img.save(out, format="JPEG", quality=88, optimize=True, progressive=True)
        out.seek(0)
        normalized = out.read()
        final_w, final_h = img.size
    except Exception as e:
        raise HTTPException(400, f"Invalid image: {e}")

    # Persist to MongoDB — b64-encoded so the document round-trips cleanly
    # through any driver. ~112 KB doc for a 84 KB JPEG (33% b64 overhead).
    image_id = uuid.uuid4().hex
    doc = {
        "image_id": image_id,
        "content_type": "image/jpeg",
        "data_b64": base64.b64encode(normalized).decode("ascii"),
        "size_bytes": len(normalized),
        "width": final_w,
        "height": final_h,
        "original_filename": file.filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.popup_images.insert_one(doc)

    return {
        "success": True,
        "image_url": f"/api/popup-image/{image_id}",
        "image_id": image_id,
        "size_bytes": len(normalized),
        "original_size_bytes": len(blob),
        "compression_ratio": f"{(1 - len(normalized) / len(blob)) * 100:.0f}%",
        "dimensions": f"{final_w}x{final_h}",
    }


@public_router.get("/popup-image/{image_id}")
async def get_popup_image(image_id: str):
    """Serve a popup image from MongoDB. **Public** (no auth) so browser
    <img> tags can render the popup banner without an Authorization
    header. Aggressive cache headers because these images are immutable
    — once uploaded, `image_id` never gets reused.
    """
    doc = await db.popup_images.find_one(
        {"image_id": image_id},
        {"_id": 0, "data_b64": 1, "content_type": 1},
    )
    if not doc:
        raise HTTPException(404, "Image not found")
    try:
        blob = base64.b64decode(doc["data_b64"])
    except Exception:
        raise HTTPException(500, "Corrupted image data")
    return Response(
        content=blob,
        media_type=doc.get("content_type", "image/jpeg"),
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Length": str(len(blob)),
        },
    )
