"""
mall_v2.py — PARAS MALL 2.0 features

USER endpoints
    /mall/v2/wishlist                                 GET   list
    /mall/v2/wishlist/{product_id}/toggle             POST  add/remove
    /mall/v2/track-view/{product_id}                  POST  record recently-viewed
    /mall/v2/recently-viewed                          GET   last 10
    /mall/v2/reviews/{product_id}                     GET   reviews + summary
    /mall/v2/reviews/{product_id}                     POST  add review
    /mall/v2/categories                               GET   active categories
    /mall/v2/saver-progress                           GET   PRC savings progress
    /mall/v2/booking/{booking_id}/timeline            GET   tracking timeline
    /mall/v2/featured                                 GET   hero carousel + featured products
    /mall/v2/mining-preview/{product_id}              GET   estimate daily rate + days for current user

ADMIN endpoints
    /mall/v2/admin/analytics                          GET   dashboard stats
    /mall/v2/admin/categories                         GET / POST / DELETE
    /mall/v2/admin/product/{product_id}/badges        PATCH set is_new/is_trending/is_hot/stock
    /mall/v2/admin/ai-description                     POST  Gemini-generated description
    /mall/v2/admin/ai-generate-product                POST  Gemini full product (title/desc/category/keywords) from short prompt
    /mall/v2/admin/ai-generate-image                  POST  Gemini Nano Banana product image
    /mall/v2/admin/products/bulk-import               POST  CSV
    /mall/v2/admin/booking/{booking_id}/status        PATCH update status (timeline event)
    /mall/v2/admin/pipeline                           GET   Order Pipeline Kanban (bookings grouped by status)
    /mall/v2/admin/sales-export                       GET   CSV of all bookings
"""
import io
import os
import re
import csv
import json
import base64
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import dotenv_values

from server import get_current_user

router = APIRouter(prefix="/mall/v2", tags=["mall-v2"])

_env = dotenv_values("/app/backend/.env")
_client = AsyncIOMotorClient(_env["MONGO_URL"])
db = _client[_env["DB_NAME"]]


# ── HELPERS ─────────────────────────────────────────────────────────────────
def _utcnow():
    return datetime.now(timezone.utc)


def _iso(dt):
    if not dt:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


_indexes_ensured = False


async def _ensure_indexes():
    """Idempotent + memoized — runs ONCE per uvicorn worker.

    Feb 23 2026 — Was called on every mall_v2 endpoint hit → 6 round-trips
    to Atlas per request (300 ms+ overhead) and, worse, blocked the whole
    request for up to 30 s when Atlas was doing a background reindex.
    """
    global _indexes_ensured
    if _indexes_ensured:
        return
    try:
        await db.mall_wishlist.create_index([("uid", 1), ("product_id", 1)], unique=True)
        # Support the wishlist listing which sorts by added_at desc
        await db.mall_wishlist.create_index([("uid", 1), ("added_at", -1)])
        await db.mall_recently_viewed.create_index([("uid", 1), ("product_id", 1)], unique=True)
        await db.mall_recently_viewed.create_index([("uid", 1), ("viewed_at", -1)])
        await db.mall_product_reviews.create_index([("product_id", 1), ("created_at", -1)])
        await db.mall_product_reviews.create_index([("uid", 1), ("product_id", 1)], unique=True)
        await db.mall_categories.create_index("slug", unique=True)
        await db.mall_products.create_index("product_id", unique=True)
        _indexes_ensured = True
    except Exception:
        # First request after boot may race with another worker — that's fine,
        # we'll simply retry on the next call.
        pass


def _is_admin(user: dict) -> bool:
    role = (user.get("role") or "").lower()
    return role in {"admin", "super_admin", "manager"}


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  USER ENDPOINTS                                                          ║
# ╚══════════════════════════════════════════════════════════════════════════╝

# ── Wishlist ────────────────────────────────────────────────────────────────
@router.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    await _ensure_indexes()
    uid = user["uid"]
    items = await db.mall_wishlist.find({"uid": uid}, {"_id": 0}).sort("added_at", -1).to_list(200)
    pids = [w["product_id"] for w in items]
    products = {}
    if pids:
        async for p in db.mall_products.find({"product_id": {"$in": pids}}, {"_id": 0}):
            products[p["product_id"]] = p
    enriched = [
        {"added_at": _iso(w["added_at"]), "product": products[w["product_id"]]}
        for w in items if w["product_id"] in products
    ]
    return {"success": True, "count": len(enriched), "items": enriched}


@router.post("/wishlist/{product_id}/toggle")
async def toggle_wishlist(product_id: str, user: dict = Depends(get_current_user)):
    await _ensure_indexes()
    uid = user["uid"]
    existing = await db.mall_wishlist.find_one({"uid": uid, "product_id": product_id})
    if existing:
        await db.mall_wishlist.delete_one({"_id": existing["_id"]})
        return {"success": True, "in_wishlist": False}
    # Ensure product exists & active
    p = await db.mall_products.find_one({"product_id": product_id})
    if not p:
        raise HTTPException(404, "Product not found")
    await db.mall_wishlist.insert_one({
        "uid": uid,
        "product_id": product_id,
        "added_at": _utcnow(),
    })
    return {"success": True, "in_wishlist": True}


# ── Recently Viewed ─────────────────────────────────────────────────────────
@router.post("/track-view/{product_id}")
async def track_product_view(product_id: str, user: dict = Depends(get_current_user)):
    await _ensure_indexes()
    uid = user["uid"]
    now = _utcnow()
    # Upsert so the same (uid, product) doesn't clutter — just bump viewed_at.
    await db.mall_recently_viewed.update_one(
        {"uid": uid, "product_id": product_id},
        {"$set": {"viewed_at": now}, "$setOnInsert": {"first_viewed_at": now}},
        upsert=True,
    )
    # Bump global view counter on the product
    await db.mall_products.update_one(
        {"product_id": product_id},
        {"$inc": {"view_count": 1}},
    )
    return {"success": True}


@router.get("/recently-viewed")
async def get_recently_viewed(limit: int = 10, user: dict = Depends(get_current_user)):
    await _ensure_indexes()
    uid = user["uid"]
    docs = await db.mall_recently_viewed.find({"uid": uid}, {"_id": 0}).sort("viewed_at", -1).limit(limit).to_list(limit)
    pids = [d["product_id"] for d in docs]
    products = {}
    if pids:
        async for p in db.mall_products.find({"product_id": {"$in": pids}}, {"_id": 0}):
            products[p["product_id"]] = p
    out = [products[d["product_id"]] for d in docs if d["product_id"] in products]
    return {"success": True, "products": out}


# ── Reviews ─────────────────────────────────────────────────────────────────
class ReviewCreateBody(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    text: Optional[str] = Field(None, max_length=600)


@router.get("/reviews/{product_id}")
async def list_reviews(product_id: str, limit: int = 20):
    docs = await db.mall_product_reviews.find(
        {"product_id": product_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    # Sanitize PII — never return uid; expose only first name.
    safe = []
    for r in docs:
        author = r.get("author_name") or "User"
        safe.append({
            "rating": r["rating"],
            "text": r.get("text", ""),
            "author": author,
            "created_at": _iso(r["created_at"]),
        })
    # Aggregate summary
    pipeline = [
        {"$match": {"product_id": product_id}},
        {"$group": {
            "_id": "$product_id",
            "avg": {"$avg": "$rating"},
            "count": {"$sum": 1},
        }},
    ]
    agg = await db.mall_product_reviews.aggregate(pipeline).to_list(1)
    summary = {"average_rating": 0, "total_reviews": 0}
    if agg:
        summary = {
            "average_rating": round(agg[0]["avg"], 2),
            "total_reviews": agg[0]["count"],
        }
    return {"success": True, "reviews": safe, "summary": summary}


@router.post("/reviews/{product_id}")
async def add_review(product_id: str, body: ReviewCreateBody, user: dict = Depends(get_current_user)):
    await _ensure_indexes()
    uid = user["uid"]
    # Confirm product exists
    p = await db.mall_products.find_one({"product_id": product_id})
    if not p:
        raise HTTPException(404, "Product not found")
    # Confirm user actually booked this product before reviewing
    booked = await db.mall_bookings.find_one({"user_id": uid, "product_id": product_id})
    if not booked:
        raise HTTPException(403, "You can only review products you've booked")

    full_name = user.get("name") or "User"
    first_name = full_name.split(" ")[0] if full_name else "User"

    try:
        await db.mall_product_reviews.insert_one({
            "review_id": str(uuid.uuid4()),
            "product_id": product_id,
            "uid": uid,
            "author_name": first_name,
            "rating": body.rating,
            "text": (body.text or "").strip(),
            "created_at": _utcnow(),
        })
    except Exception as e:
        # pymongo's DuplicateKeyError carries 11000 in details
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            raise HTTPException(409, "You've already reviewed this product")
        raise HTTPException(500, "Could not save review")

    # Refresh aggregated rating + review_count on the product doc for fast list reads
    agg = await db.mall_product_reviews.aggregate([
        {"$match": {"product_id": product_id}},
        {"$group": {"_id": "$product_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    if agg:
        await db.mall_products.update_one(
            {"product_id": product_id},
            {"$set": {
                "avg_rating": round(agg[0]["avg"], 2),
                "review_count": agg[0]["count"],
            }},
        )

    return {"success": True}


# ── Categories ──────────────────────────────────────────────────────────────
@router.get("/categories")
async def list_categories():
    await _ensure_indexes()
    cats = await db.mall_categories.find({"active": {"$ne": False}}, {"_id": 0}).sort("sort_order", 1).to_list(50)
    # If empty, seed with sensible defaults so the UI has something to show
    if not cats:
        defaults = [
            {"slug": "all", "name": "All", "icon": "Sparkles", "sort_order": 0, "active": True},
            {"slug": "electronics", "name": "Electronics", "icon": "Smartphone", "sort_order": 1, "active": True},
            {"slug": "vouchers", "name": "Vouchers", "icon": "Ticket", "sort_order": 2, "active": True},
            {"slug": "fashion", "name": "Fashion", "icon": "Shirt", "sort_order": 3, "active": True},
            {"slug": "home", "name": "Home", "icon": "Home", "sort_order": 4, "active": True},
            {"slug": "general", "name": "Other", "icon": "Tag", "sort_order": 99, "active": True},
        ]
        await db.mall_categories.insert_many([dict(d) for d in defaults])
        cats = defaults  # already plain dicts without _id
    return {"success": True, "categories": cats}


# ── PRC Saver Progress ─────────────────────────────────────────────────────
@router.get("/saver-progress")
async def saver_progress(user: dict = Depends(get_current_user)):
    """Return cheapest-affordable + next-target product for a motivating saver widget."""
    uid = user["uid"]
    u = await db.users.find_one({"uid": uid}, {"_id": 0, "prc_balance": 1})
    balance = float(u.get("prc_balance", 0) or 0) if u else 0.0
    # Lazy import to avoid circular: get upfront_prc compute
    from routes.paras_mall import compute_upfront_prc
    # Pull active products sorted by upfront PRC ASC
    products = await db.mall_products.find({"active": True}, {"_id": 0}).to_list(500)
    if not products:
        return {"success": True, "balance": balance, "next_product": None, "affordable_count": 0}
    enriched = sorted(
        [{**p, "upfront_prc": compute_upfront_prc(p["mrp_inr"])} for p in products],
        key=lambda x: x["upfront_prc"],
    )
    affordable = [p for p in enriched if p["upfront_prc"] <= balance]
    unaffordable = [p for p in enriched if p["upfront_prc"] > balance]
    next_product = unaffordable[0] if unaffordable else None
    progress = None
    if next_product:
        needed = next_product["upfront_prc"]
        progress = {
            "product": next_product,
            "needed": needed,
            "have": balance,
            "remaining": max(0, round(needed - balance, 2)),
            "percent": min(100, round((balance / needed) * 100, 1)) if needed > 0 else 0,
        }
    return {
        "success": True,
        "balance": balance,
        "affordable_count": len(affordable),
        "next_target": progress,
    }


# ── Booking Tracking Timeline ──────────────────────────────────────────────
@router.get("/booking/{booking_id}/timeline")
async def booking_timeline(booking_id: str, user: dict = Depends(get_current_user)):
    booking = await db.mall_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["user_id"] != user["uid"] and not _is_admin(user):
        raise HTTPException(403, "Forbidden")

    # Synthesize timeline from existing fields + status_history (if any)
    history = booking.get("status_history") or []
    if not history:
        history = [{
            "status": booking.get("status", "active"),
            "label": "Booked",
            "at": _iso(booking.get("created_at")),
        }]
    # Standard funnel steps the UI knows how to render
    funnel = ["Booked", "Confirmed", "Packed", "Shipped", "Delivered"]
    by_label = {h.get("label"): h for h in history}
    timeline = []
    current_idx = 0
    for i, step in enumerate(funnel):
        h = by_label.get(step)
        timeline.append({
            "step": step,
            "completed": bool(h),
            "at": _iso(h["at"]) if h else None,
        })
        if h:
            current_idx = i
    return {
        "success": True,
        "booking_id": booking_id,
        "current_step_index": current_idx,
        "timeline": timeline,
    }


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  ADMIN ENDPOINTS                                                         ║
# ╚══════════════════════════════════════════════════════════════════════════╝

def _admin_only(user: dict):
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")


# ── Mall Analytics Dashboard ───────────────────────────────────────────────
@router.get("/admin/analytics")
async def mall_analytics(days: int = 30, user: dict = Depends(get_current_user)):
    _admin_only(user)
    now = _utcnow()
    since = now - timedelta(days=days)
    since_iso = since.isoformat()

    # Bookings per day
    pipeline = [
        {"$match": {"created_at": {"$gte": since_iso}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "count": {"$sum": 1},
            "prc": {"$sum": "$upfront_prc"},
        }},
        {"$sort": {"_id": 1}},
    ]
    daily = await db.mall_bookings.aggregate(pipeline).to_list(days + 5)

    # Top products
    top_pipeline = [
        {"$match": {"created_at": {"$gte": since_iso}}},
        {"$group": {
            "_id": "$product_id",
            "name": {"$first": "$product_name"},
            "bookings": {"$sum": 1},
            "prc": {"$sum": "$upfront_prc"},
        }},
        {"$sort": {"bookings": -1}},
        {"$limit": 10},
    ]
    top_products = await db.mall_bookings.aggregate(top_pipeline).to_list(10)

    # Bookings by category — denormalize via products lookup
    cat_pipeline = [
        {"$match": {"created_at": {"$gte": since_iso}}},
        {"$lookup": {
            "from": "mall_products",
            "localField": "product_id",
            "foreignField": "product_id",
            "as": "p",
        }},
        {"$unwind": "$p"},
        {"$group": {
            "_id": "$p.category",
            "bookings": {"$sum": 1},
            "prc": {"$sum": "$upfront_prc"},
        }},
        {"$sort": {"bookings": -1}},
    ]
    by_category = await db.mall_bookings.aggregate(cat_pipeline).to_list(20)

    # Totals
    total_bookings = await db.mall_bookings.count_documents({"created_at": {"$gte": since_iso}})
    total_prc = sum(d.get("prc", 0) for d in daily)
    distinct_users = await db.mall_bookings.distinct("user_id", {"created_at": {"$gte": since_iso}})

    # Most-viewed (not yet booked → potential conversion target)
    top_viewed = await db.mall_products.find(
        {"view_count": {"$gt": 0}}, {"_id": 0, "product_id": 1, "name": 1, "view_count": 1}
    ).sort("view_count", -1).limit(10).to_list(10)

    return {
        "success": True,
        "range_days": days,
        "totals": {
            "bookings": total_bookings,
            "prc_collected": round(float(total_prc), 2),
            "unique_buyers": len(distinct_users),
        },
        "daily": daily,
        "top_products": top_products,
        "by_category": by_category,
        "top_viewed": top_viewed,
    }


# ── Categories CRUD ────────────────────────────────────────────────────────
class CategoryBody(BaseModel):
    slug: str
    name: str
    icon: Optional[str] = "Tag"
    sort_order: int = 99
    active: bool = True


@router.post("/admin/categories")
async def upsert_category(body: CategoryBody, user: dict = Depends(get_current_user)):
    _admin_only(user)
    await _ensure_indexes()
    await db.mall_categories.update_one(
        {"slug": body.slug},
        {"$set": body.dict()},
        upsert=True,
    )
    return {"success": True}


@router.delete("/admin/categories/{slug}")
async def delete_category(slug: str, user: dict = Depends(get_current_user)):
    _admin_only(user)
    await db.mall_categories.delete_one({"slug": slug})
    return {"success": True}


# ── Product Badges + Stock Update ──────────────────────────────────────────
class ProductBadgesBody(BaseModel):
    is_new: Optional[bool] = None
    is_trending: Optional[bool] = None
    is_hot: Optional[bool] = None
    stock_count: Optional[int] = Field(None, ge=0, le=99999)
    category: Optional[str] = None
    featured: Optional[bool] = None
    featured_sort: Optional[int] = Field(None, ge=0, le=999)


@router.patch("/admin/product/{product_id}/badges")
async def patch_product_badges(product_id: str, body: ProductBadgesBody, user: dict = Depends(get_current_user)):
    _admin_only(user)
    p = await db.mall_products.find_one({"product_id": product_id})
    if not p:
        raise HTTPException(404, "Product not found")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.mall_products.update_one({"product_id": product_id}, {"$set": update})
    return {"success": True, "updated": list(update.keys())}


# ── AI Description (Gemini Nano Banana for image, here just text) ─────────
class AIDescBody(BaseModel):
    product_name: str
    keywords: Optional[str] = None


@router.post("/admin/ai-description")
async def ai_generate_description(body: AIDescBody, user: dict = Depends(get_current_user)):
    """Generate a polished marketing description using Emergent LLM key (Gemini text)."""
    _admin_only(user)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        raise HTTPException(503, "LLM library not installed")
    import os
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(503, "EMERGENT_LLM_KEY not configured")

    session_id = f"mall-desc-{uuid.uuid4()}"
    prompt = (
        f"Write a punchy 60-word marketing description for a reward-redeemable product called "
        f"'{body.product_name}'. Highlight key benefits, who it's for, and end with a soft urgency line. "
        f"Plain text, no markdown. Keywords to consider: {body.keywords or 'premium quality, fast shipping, limited stock'}."
    )
    try:
        chat = (
            LlmChat(api_key=key, session_id=session_id, system_message="You are a concise e-commerce copywriter.")
            .with_model("gemini", "gemini-2.5-flash")
        )
        msg = UserMessage(text=prompt)
        text = await chat.send_message(msg)
        return {"success": True, "description": (text or "").strip()}
    except Exception:
        # Don't leak library internals — just log
        import logging
        logging.exception("AI description failed")
        raise HTTPException(502, "AI generation failed. Please try again.")


# ── CSV Bulk Import ────────────────────────────────────────────────────────
@router.post("/admin/products/bulk-import")
async def bulk_import_products(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """CSV columns: name, mrp_inr, category, image_url, description, stock_count, active.

    Header is required. `name` and `mrp_inr` are mandatory per row."""
    _admin_only(user)
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files are supported")
    raw = (await file.read()).decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(raw))
    created, skipped, errors = 0, 0, []
    for i, row in enumerate(reader, start=2):  # row 1 = header
        name = (row.get("name") or "").strip()
        mrp_raw = (row.get("mrp_inr") or "").strip()
        if not name or not mrp_raw:
            skipped += 1
            errors.append({"row": i, "reason": "missing name or mrp_inr"})
            continue
        try:
            mrp = int(float(mrp_raw))
        except Exception:
            skipped += 1
            errors.append({"row": i, "reason": "mrp_inr must be a number"})
            continue
        stock = row.get("stock_count")
        try:
            stock = int(stock) if stock not in (None, "") else None
        except Exception:
            stock = None
        doc = {
            "product_id": str(uuid.uuid4()),
            "name": name,
            "mrp_inr": mrp,
            "category": (row.get("category") or "general").strip().lower() or "general",
            "image_url": (row.get("image_url") or "").strip() or None,
            "description": (row.get("description") or "").strip() or None,
            "active": (row.get("active") or "true").strip().lower() not in {"false", "0", "no"},
            "stock_count": stock,
            "created_at": _utcnow().isoformat(),
            "view_count": 0,
            "avg_rating": 0,
            "review_count": 0,
        }
        await db.mall_products.insert_one(doc)
        created += 1
    return {"success": True, "created": created, "skipped": skipped, "errors": errors[:50]}


# ── Booking Status Update (timeline event) ─────────────────────────────────
class BookingStatusBody(BaseModel):
    label: str  # Booked / Confirmed / Packed / Shipped / Delivered
    note: Optional[str] = None


_ALLOWED_STATUS = {"Booked", "Confirmed", "Packed", "Shipped", "Delivered"}


@router.patch("/admin/booking/{booking_id}/status")
async def update_booking_status(booking_id: str, body: BookingStatusBody, user: dict = Depends(get_current_user)):
    _admin_only(user)
    if body.label not in _ALLOWED_STATUS:
        raise HTTPException(400, f"Invalid status. Must be one of: {sorted(_ALLOWED_STATUS)}")
    booking = await db.mall_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")
    event = {
        "label": body.label,
        "note": body.note,
        "at": _utcnow().isoformat(),
        "by_uid": user["uid"],
    }
    await db.mall_bookings.update_one(
        {"booking_id": booking_id},
        {
            "$push": {"status_history": event},
            "$set": {"latest_status": body.label, "latest_status_at": event["at"]},
        },
    )
    return {"success": True, "event": event}


# ── Order Pipeline Kanban (Bookings grouped by status) ────────────────────
_PIPELINE_LABELS = ["Booked", "Confirmed", "Packed", "Shipped", "Delivered"]


@router.get("/admin/pipeline")
async def order_pipeline(limit: int = 200, user: dict = Depends(get_current_user)):
    """Return active bookings (status in mining|fulfilled) grouped by their
    latest pipeline label so the admin can render a Kanban board.

    Rules:
      - "Delivered" column also includes bookings with `status=='delivered'`.
      - A booking with no `latest_status` defaults to the "Booked" column.
      - Only the booking's most recent label is used (status_history is rich,
        but the board only cares about current state).

    IMPORTANT FIX (Jun 30 2026): Previously this fetched ALL three statuses
    in a single sort-by-created_at query with limit=200/300. Production
    has 1,400+ active `mining` bookings — they buried the (much smaller)
    fulfilled + delivered rows past the cutoff, so admins never saw orders
    that completed mining and were ready to action. We now fan out into
    three targeted queries with separate caps so the actionable buckets
    (fulfilled + delivered) are ALWAYS fully loaded, while the mining
    bucket stays bounded to the most-recent `limit` rows.
    """
    _admin_only(user)
    fulfilled_bookings, delivered_bookings, mining_bookings = await asyncio.gather(
        db.mall_bookings.find({"status": "fulfilled"}, {"_id": 0}).sort("created_at", -1).to_list(500),
        db.mall_bookings.find({"status": "delivered"}, {"_id": 0}).sort("created_at", -1).to_list(500),
        db.mall_bookings.find({"status": "mining"}, {"_id": 0}).sort("created_at", -1).to_list(limit),
    )
    bookings = fulfilled_bookings + delivered_bookings + mining_bookings

    # Hydrate user info in one batch
    user_ids = list({b.get("user_id") for b in bookings if b.get("user_id")})
    users = await db.users.find(
        {"uid": {"$in": user_ids}},
        {"_id": 0, "uid": 1, "name": 1, "first_name": 1, "last_name": 1, "mobile": 1}
    ).to_list(len(user_ids) or 1)
    user_map = {
        u["uid"]: {
            "name": u.get("name") or " ".join(filter(None, [u.get("first_name"), u.get("last_name")])).strip() or "Unknown",
            "mobile": u.get("mobile") or "",
        }
        for u in users
    }

    columns = {label: [] for label in _PIPELINE_LABELS}
    for b in bookings:
        latest = b.get("latest_status")
        if not latest:
            # Implicit defaults based on booking lifecycle status
            if b.get("status") == "delivered":
                latest = "Delivered"
            elif b.get("status") == "fulfilled":
                latest = "Confirmed"  # Awaiting admin action — sits in Confirmed lane
            else:
                latest = "Booked"
        if latest not in columns:
            latest = "Booked"
        u = user_map.get(b.get("user_id"), {})
        columns[latest].append({
            "booking_id": b.get("booking_id"),
            "product_id": b.get("product_id"),
            "product_name": b.get("product_name"),
            "user_id": b.get("user_id"),
            "user_name": u.get("name"),
            "user_mobile": u.get("mobile"),
            "upfront_prc": b.get("upfront_prc"),
            "total_prc": b.get("total_prc"),
            "paid_prc": b.get("paid_prc"),
            "progress_percent": round((b.get("paid_prc", 0) / max(b.get("total_prc", 1), 1)) * 100, 1),
            "status": b.get("status"),
            "latest_status": latest,
            "latest_status_at": _iso(b.get("latest_status_at")),
            "created_at": _iso(b.get("created_at")),
            "delivery": b.get("delivery") or {},
        })

    return {
        "success": True,
        "labels": _PIPELINE_LABELS,
        "columns": columns,
        "totals": {label: len(items) for label, items in columns.items()},
    }


# ── Featured Products (Hero Carousel) ──────────────────────────────────────
@router.get("/featured")
async def featured_products(limit: int = 6):
    """Top hero carousel feed. Sources:
      1. Active products flagged `featured: true` (admin curated)
      2. Fallback: top-viewed + most-booked active products
    Limited to `limit` items.
    """
    curated = await db.mall_products.find(
        {"active": True, "featured": True}, {"_id": 0}
    ).sort("featured_sort", 1).limit(limit).to_list(limit)

    if len(curated) >= limit:
        enriched = [_enrich_product_pricing(p) for p in curated]
        return {"success": True, "products": enriched, "source": "curated"}

    # Need to top up — pull most-viewed actives, excluding curated ids
    used = {p["product_id"] for p in curated}
    fill_needed = limit - len(curated)
    auto = await db.mall_products.find(
        {"active": True, "product_id": {"$nin": list(used)}}, {"_id": 0}
    ).sort([("view_count", -1), ("avg_rating", -1)]).limit(fill_needed).to_list(fill_needed)

    products = [_enrich_product_pricing(p) for p in (curated + auto)]
    return {
        "success": True,
        "products": products,
        "source": "curated+auto" if curated else "auto",
    }


def _enrich_product_pricing(p: dict) -> dict:
    """Mirror the enrichment that /mall/products applies, so any consumer of
    the product dict (e.g. ProductDetailSheet) gets full pricing fields."""
    from routes.paras_mall import compute_pricing_breakdown
    mrp = p.get("mrp_inr", 0)
    breakdown = compute_pricing_breakdown(mrp)
    # Don't override fields the admin may have manually set
    for k, v in breakdown.items():
        p.setdefault(k, v)
    return p


# ── Mining Preview (for product detail "live mining preview" UX) ──────────
@router.get("/mining-preview/{product_id}")
async def mining_preview(product_id: str, user: dict = Depends(get_current_user)):
    """Live estimate of daily mining + days-to-complete for THIS user on
    THIS product, BEFORE they book. Helps decide whether to book + sets
    realistic expectations.

    Uses the SAME formula as live bookings:
      - PRC_per_user(N) = max(2.5, 5 × (21 - log₂(N)) / 14)
      - daily_rate     = max(50, N × PRC_per_user(N))
      - N (cap)        = user's 6-tier referral network cap
    """
    p = await db.mall_products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")

    # Pricing breakdown (mirrors paras_mall.compute_pricing_breakdown)
    from routes.paras_mall import compute_pricing_breakdown, get_user_network_cap, MIN_DAILY_RATE_PRC
    import math

    breakdown = compute_pricing_breakdown(p.get("mrp_inr", 0))
    total_prc = breakdown["total_prc"]
    upfront_prc = breakdown["upfront_prc"]
    # V2 pricing: processing fee is a SEPARATE entry charge — the user mines
    # the FULL total_prc, not (total_prc - upfront_prc).
    remaining_prc = total_prc

    user_cap = await get_user_network_cap(user["uid"])

    # Estimate using N = min(active_after_position, user_cap). Since we haven't
    # booked yet, assume the user lands AT the latest position → N ≈ 0
    # initially, but as more bookings come in BEHIND them they earn more.
    # For a realistic preview we project N at three tiers (low/mid/high) so
    # the user understands the range.
    def daily_rate(N: int) -> float:
        if N <= 0:
            return float(MIN_DAILY_RATE_PRC)
        prc_per = max(2.5, 5.0 * (21.0 - math.log2(N)) / 14.0)
        return max(float(MIN_DAILY_RATE_PRC), N * prc_per)

    low_N = max(0, min(50, user_cap))
    mid_N = max(0, min(user_cap // 3, user_cap))
    high_N = user_cap

    low_rate = daily_rate(low_N)
    mid_rate = daily_rate(mid_N)
    high_rate = daily_rate(high_N)

    def days_for(rate):
        if rate <= 0 or remaining_prc <= 0:
            return 0
        return int((remaining_prc + rate - 1) / rate)

    return {
        "success": True,
        "product_id": product_id,
        "user_network_cap": user_cap,
        "pricing": {
            "mrp_inr": breakdown["mrp_inr"],
            "total_inr": breakdown["total_inr"],
            "upfront_prc": upfront_prc,
            "total_prc": total_prc,
            "remaining_prc": remaining_prc,
        },
        "estimates": {
            "slow":  {"daily_prc": round(low_rate, 0),  "days_to_complete": days_for(low_rate)},
            "typical": {"daily_prc": round(mid_rate, 0), "days_to_complete": days_for(mid_rate)},
            "fast":  {"daily_prc": round(high_rate, 0), "days_to_complete": days_for(high_rate)},
        },
        "hint": (
            "Live estimate based on your referral tier. Daily rate goes UP as "
            "more users book products positioned after yours."
        ),
    }


# ── AI Generate Full Product (Nano Banana Text via Gemini) ─────────────────
class AIGenProductBody(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=200)
    category_hint: Optional[str] = None


@router.post("/admin/ai-generate-product")
async def ai_generate_full_product(body: AIGenProductBody, user: dict = Depends(get_current_user)):
    """Generate a complete product draft (title, description, category, keywords)
    from a short admin prompt using Gemini.
    Returns strict JSON so the frontend can autofill the product form.
    """
    _admin_only(user)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        raise HTTPException(503, "LLM library not installed")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(503, "EMERGENT_LLM_KEY not configured")

    valid_categories = [
        "electronics", "appliances", "kitchen", "furniture",
        "vouchers", "jewelry", "vehicles", "home", "fashion", "general",
    ]
    cat_hint_clause = (
        f" Strongly prefer the category '{body.category_hint}' if appropriate."
        if body.category_hint else ""
    )

    sys_msg = (
        "You are an e-commerce copywriter for an Indian reward-points shopping "
        "platform called PARAS MALL. You ALWAYS reply with ONLY valid JSON — "
        "no markdown, no preface, no code fences. Keys: title (string, ≤60 chars), "
        "description (string, 40-80 words, plain text, no emojis), category (one of "
        f"{valid_categories}), keywords (array of 4-6 short tag strings)."
    )
    user_msg = (
        f"Product prompt: '{body.prompt}'. Write the product draft.{cat_hint_clause}"
    )

    session_id = f"ai-genprod-{uuid.uuid4()}"
    try:
        chat = (
            LlmChat(api_key=api_key, session_id=session_id, system_message=sys_msg)
            .with_model("gemini", "gemini-2.5-flash")
        )
        text = await chat.send_message(UserMessage(text=user_msg))
    except Exception:
        import logging
        logging.exception("AI gen-product failed")
        raise HTTPException(502, "AI generation failed. Please try again.")

    raw = (text or "").strip()
    # Strip code-fence if model decides to ignore the system instruction
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(502, "AI returned invalid JSON. Please retry.")

    # Validate + sanitize
    title = (data.get("title") or "").strip()[:80]
    description = (data.get("description") or "").strip()[:600]
    category = (data.get("category") or "general").strip().lower()
    if category not in valid_categories:
        category = "general"
    keywords = data.get("keywords") or []
    if not isinstance(keywords, list):
        keywords = []
    keywords = [str(k).strip()[:30] for k in keywords if str(k).strip()][:8]

    if not title or not description:
        raise HTTPException(502, "AI response was incomplete. Please retry.")

    return {
        "success": True,
        "draft": {
            "title": title,
            "description": description,
            "category": category,
            "keywords": keywords,
        },
    }


# ── AI Generate Product Image (Gemini Nano Banana) ─────────────────────────
class AIGenImageBody(BaseModel):
    prompt: str = Field(..., min_length=4, max_length=400)


@router.post("/admin/ai-generate-image")
async def ai_generate_product_image(body: AIGenImageBody, user: dict = Depends(get_current_user)):
    """Generate a product image with Gemini Nano Banana
    (gemini-3.1-flash-image-preview), normalize to 1024x1024 JPEG, persist
    under /api/static/mall/, return the URL — ready to paste into product
    create/update.
    """
    _admin_only(user)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        raise HTTPException(503, "LLM library not installed")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(503, "EMERGENT_LLM_KEY not configured")

    enriched_prompt = (
        f"High-end e-commerce product photograph: {body.prompt}. "
        "Centered subject on a clean, soft-gradient studio background, "
        "professional lighting, ultra sharp focus, no text or watermarks. "
        "Square 1:1 framing."
    )

    session_id = f"ai-genimg-{uuid.uuid4()}"
    try:
        chat = (
            LlmChat(api_key=api_key, session_id=session_id, system_message="You are a product photography AI.")
            .with_model("gemini", "gemini-3.1-flash-image-preview")
            .with_params(modalities=["image", "text"])
        )
        text, images = await chat.send_message_multimodal_response(
            UserMessage(text=enriched_prompt)
        )
    except Exception:
        import logging
        logging.exception("AI gen-image failed")
        raise HTTPException(502, "AI image generation failed. Please try again.")

    if not images:
        raise HTTPException(502, "No image returned. Please rephrase the prompt and retry.")

    # Use the first image; save to disk after PIL normalize.
    raw_b64 = images[0].get("data")
    if not raw_b64:
        raise HTTPException(502, "Empty image payload")
    try:
        img_bytes = base64.b64decode(raw_b64)
    except Exception:
        raise HTTPException(502, "Could not decode AI image")

    # Normalize to 1024x1024 JPEG using the same convention as the manual upload path
    from PIL import Image, ImageOps
    try:
        im = Image.open(io.BytesIO(img_bytes))
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        im = im.crop((left, top, left + side, top + side))
        if im.size[0] > 1024:
            im = im.resize((1024, 1024), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=88, optimize=True, progressive=True)
        buf.seek(0)
        normalized = buf.read()
    except Exception as e:
        raise HTTPException(500, f"Could not process AI image: {e}")

    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", body.prompt[:40]).strip("_").lower() or "ai-product"
    ts = int(datetime.now(timezone.utc).timestamp())
    fname = f"{slug}_{ts}_ai.jpg"
    target_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "mall")
    os.makedirs(target_dir, exist_ok=True)
    with open(os.path.join(target_dir, fname), "wb") as f:
        f.write(normalized)

    return {
        "success": True,
        "image_url": f"/api/static/mall/{fname}",
        "size_bytes": len(normalized),
    }


# ── Sales CSV Export ───────────────────────────────────────────────────────
@router.get("/admin/sales-export")
async def export_sales(days: int = 30, user: dict = Depends(get_current_user)):
    _admin_only(user)
    since_iso = (_utcnow() - timedelta(days=days)).isoformat()
    bookings = await db.mall_bookings.find(
        {"created_at": {"$gte": since_iso}}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "booking_id", "user_id", "product_id", "product_name",
        "upfront_prc", "status", "latest_status", "created_at",
        "delivery_name", "delivery_mobile", "delivery_pincode",
    ])
    for b in bookings:
        d = b.get("delivery") or {}
        writer.writerow([
            b.get("booking_id", ""), b.get("user_id", ""), b.get("product_id", ""),
            b.get("product_name", ""), b.get("upfront_prc", ""),
            b.get("status", ""), b.get("latest_status", ""),
            b.get("created_at", ""),
            d.get("name", ""), d.get("mobile", ""), d.get("pincode", ""),
        ])
    buf.seek(0)
    filename = f"paras-mall-sales-{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
