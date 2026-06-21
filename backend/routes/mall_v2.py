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

ADMIN endpoints
    /mall/v2/admin/analytics                          GET   dashboard stats
    /mall/v2/admin/categories                         GET / POST / DELETE
    /mall/v2/admin/product/{product_id}/badges        PATCH set is_new/is_trending/is_hot/stock
    /mall/v2/admin/product/{product_id}/ai-description POST Gemini-generated description
    /mall/v2/admin/products/bulk-import               POST CSV
    /mall/v2/admin/booking/{booking_id}/status        PATCH update status (timeline event)
    /mall/v2/admin/sales-export                       GET   CSV of all bookings
"""
import io
import csv
import uuid
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


async def _ensure_indexes():
    try:
        await db.mall_wishlist.create_index([("uid", 1), ("product_id", 1)], unique=True)
        await db.mall_recently_viewed.create_index([("uid", 1), ("product_id", 1)], unique=True)
        await db.mall_recently_viewed.create_index([("uid", 1), ("viewed_at", -1)])
        await db.mall_product_reviews.create_index([("product_id", 1), ("created_at", -1)])
        await db.mall_product_reviews.create_index([("uid", 1), ("product_id", 1)], unique=True)
        await db.mall_categories.create_index("slug", unique=True)
    except Exception:
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
    except Exception as e:
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
