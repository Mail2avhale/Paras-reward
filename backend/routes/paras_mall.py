"""
PARAS MALL — Reward Shopping Destination
==========================================
Users book products using PRC. Each booking enters a single-leg booking-order
tree. Daily mining accrues at 4 × (1 + bookings_below) PRC/day per booking.
Each booking runs its OWN 24-hour session that resets on collect (or laps
to 0 if user doesn't collect in time). When cumulative collected PRC reaches
the product's full price (MRP × 10), mining stops and the booking is queued
for delivery.

Conversion rate: FIXED 10 PRC = ₹1.
Upfront cost: max(10% MRP, ₹1000) — paid immediately in PRC at booking.
No cancellation, no refund. Delivery only at 100%.
"""

import logging
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/mall", tags=["Paras Mall"])
admin_router = APIRouter(prefix="/admin/mall", tags=["Paras Mall Admin"])

db = None  # injected by server

# ---------------- CONSTANTS ----------------
PRC_INR_RATE = 10  # 10 PRC = ₹1 (fixed, June 2026)
BASE_DAILY_RATE_PRC = 4  # Per booking, per day, base
UPFRONT_PERCENT = 0.10  # 10% of MRP
UPFRONT_MIN_INR = 1000  # Or ₹1000 minimum, whichever is higher
SESSION_DURATION_HOURS = 24  # Each booking session
SECONDS_PER_DAY = 86400


def set_db(database):
    global db
    db = database


# ---------------- MODELS ----------------
class BookProductRequest(BaseModel):
    user_id: str


class CollectBookingRequest(BaseModel):
    user_id: str


class CreateProductRequest(BaseModel):
    name: str
    mrp_inr: int
    category: str = "general"
    image_url: Optional[str] = None
    description: Optional[str] = None
    active: bool = True


class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    mrp_inr: Optional[int] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None


# ---------------- HELPERS ----------------
def now_utc():
    return datetime.now(timezone.utc)


def iso(dt):
    if not dt:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


def parse_iso(s):
    if not s:
        return None
    if isinstance(s, datetime):
        return s if s.tzinfo else s.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def compute_upfront_prc(mrp_inr: int) -> int:
    """Upfront = max(10% of MRP, ₹1000) — returned in PRC."""
    upfront_inr = max(int(round(mrp_inr * UPFRONT_PERCENT)), UPFRONT_MIN_INR)
    return upfront_inr * PRC_INR_RATE


def compute_total_prc(mrp_inr: int) -> int:
    """Total product cost in PRC."""
    return mrp_inr * PRC_INR_RATE


async def get_daily_rate_for_booking(booking_position: int) -> int:
    """Single-leg booking-order tree: rate = 4 × (1 + bookings_below).

    `bookings_below` = count of bookings with position > this booking's position
    that are still ACTIVE (mining). Fulfilled/lapsed bookings do NOT contribute
    so that retired positions don't keep boosting older bookings forever.
    """
    bookings_below = await db.mall_bookings.count_documents({
        "position": {"$gt": booking_position},
        "status": "mining"
    })
    return BASE_DAILY_RATE_PRC * (1 + bookings_below)


async def compute_session_accumulated(booking: dict) -> tuple[float, int]:
    """Return (accumulated_prc_this_session, seconds_elapsed).

    If session has expired (>24h), session_prc lapses to 0 and a new session
    auto-starts. The expired PRC is NOT credited toward the product.
    """
    if booking.get("status") != "mining":
        return (0.0, 0)
    session_start = parse_iso(booking.get("session_start"))
    if not session_start:
        return (0.0, 0)
    now = now_utc()
    elapsed = (now - session_start).total_seconds()
    if elapsed < 0:
        return (0.0, 0)
    rate_per_day = await get_daily_rate_for_booking(booking["position"])
    accumulated = (rate_per_day / SECONDS_PER_DAY) * min(elapsed, SECONDS_PER_DAY)
    return (round(accumulated, 6), int(elapsed))


async def maybe_lapse_or_renew_session(booking: dict) -> dict:
    """If session > 24h old, lapse current session and start a new one."""
    if booking.get("status") != "mining":
        return booking
    session_start = parse_iso(booking.get("session_start"))
    if not session_start:
        return booking
    elapsed = (now_utc() - session_start).total_seconds()
    if elapsed >= SECONDS_PER_DAY:
        # Lapse: reset session_start to now, current session PRC discarded
        new_start = now_utc()
        await db.mall_bookings.update_one(
            {"booking_id": booking["booking_id"]},
            {"$set": {
                "session_start": new_start.isoformat(),
                "last_lapsed_at": now_utc().isoformat()
            },
                "$inc": {"laps_count": 1}}
        )
        booking["session_start"] = new_start.isoformat()
        booking["laps_count"] = booking.get("laps_count", 0) + 1
    return booking


async def post_community_event(user_id: str, event_type: str, product_name: str, booking_id: str):
    """Insert a community feed entry for booking/delivery events. Best-effort."""
    try:
        user = await db.users.find_one({"uid": user_id}, {"_id": 0, "name": 1})
        user_name = (user or {}).get("name", "User")
        # Anonymize partially: "SANTOSH A."
        display_name = user_name.split()[0][:8].upper() if user_name else "USER"
        if event_type == "booked":
            msg = f"🎉 {display_name} just booked {product_name} via Paras Mall!"
        elif event_type == "fulfilled":
            msg = f"💎 {display_name}'s {product_name} is fully paid! Awaiting delivery."
        elif event_type == "delivered":
            msg = f"🚚 {display_name}'s {product_name} has been delivered! Congratulations!"
        else:
            msg = f"{display_name} - {event_type} - {product_name}"
        await db.community_feed.insert_one({
            "feed_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": f"mall_{event_type}",
            "message": msg,
            "product_name": product_name,
            "booking_id": booking_id,
            "created_at": now_utc().isoformat()
        })
    except Exception as e:
        logging.warning(f"[MALL] community post failed: {e}")


async def write_prc_statement(user_id: str, amount: int, description: str, ref_id: str):
    """Write DEBIT entry to prc_statement (best-effort)."""
    try:
        await db.prc_statement.insert_one({
            "txn_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "mall_booking",
            "direction": "debit",
            "amount": amount,
            "description": description,
            "ref_id": ref_id,
            "created_at": now_utc().isoformat()
        })
    except Exception as e:
        logging.warning(f"[MALL] PRC statement write failed: {e}")


# ---------------- USER ENDPOINTS ----------------
@router.get("/products")
async def list_products(category: Optional[str] = None, only_active: bool = True):
    """List all products available in the mall."""
    query = {}
    if only_active:
        query["active"] = True
    if category:
        query["category"] = category
    products = await db.mall_products.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    for p in products:
        p["total_prc"] = compute_total_prc(p["mrp_inr"])
        p["upfront_prc"] = compute_upfront_prc(p["mrp_inr"])
        p["daily_rate_prc"] = BASE_DAILY_RATE_PRC  # base, downline boost calculated post-booking
    return {"success": True, "count": len(products), "products": products}


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.mall_products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    p["total_prc"] = compute_total_prc(p["mrp_inr"])
    p["upfront_prc"] = compute_upfront_prc(p["mrp_inr"])
    p["daily_rate_prc"] = BASE_DAILY_RATE_PRC
    return p


@router.post("/book/{product_id}")
async def book_product(product_id: str, body: BookProductRequest):
    """Book a product. Debits upfront PRC, creates booking + session."""
    product = await db.mall_products.find_one({"product_id": product_id, "active": True})
    if not product:
        raise HTTPException(404, "Product not found or inactive")

    user = await db.users.find_one({"uid": body.user_id})
    if not user:
        raise HTTPException(404, "User not found")

    upfront_prc = compute_upfront_prc(product["mrp_inr"])
    total_prc = compute_total_prc(product["mrp_inr"])

    # Check available PRC balance (respect locked PRC vault)
    balance = float(user.get("prc_balance", 0))
    locked = float(user.get("prc_locked", 0))
    available = balance - locked
    if available < upfront_prc:
        raise HTTPException(
            400,
            f"Insufficient PRC. Need {upfront_prc:,} PRC upfront, have {available:,.0f} available."
        )

    # Assign next position (global monotonic counter)
    counter = await db.mall_counters.find_one_and_update(
        {"_id": "booking_position"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True
    )
    position = (counter or {}).get("value", 1)
    if position is None:
        position = 1

    booking_id = str(uuid.uuid4())
    now = now_utc()
    booking_doc = {
        "booking_id": booking_id,
        "user_id": body.user_id,
        "product_id": product_id,
        "product_name": product["name"],
        "mrp_inr": product["mrp_inr"],
        "total_prc": total_prc,
        "upfront_prc": upfront_prc,
        "paid_prc": upfront_prc,  # upfront credited immediately
        "remaining_prc": total_prc - upfront_prc,
        "position": position,
        "status": "mining",  # mining → fulfilled → delivered
        "session_start": now.isoformat(),
        "laps_count": 0,
        "created_at": now.isoformat(),
        "fulfilled_at": None,
        "delivered_at": None,
    }
    await db.mall_bookings.insert_one(booking_doc)

    # Debit user's PRC balance
    await db.users.update_one(
        {"uid": body.user_id},
        {"$inc": {"prc_balance": -upfront_prc, "total_spent_prc": upfront_prc}}
    )

    # PRC statement entry + community post (best-effort, parallel)
    await asyncio.gather(
        write_prc_statement(
            body.user_id, upfront_prc,
            f"Paras Mall Booking: {product['name']} (upfront)",
            booking_id
        ),
        post_community_event(body.user_id, "booked", product["name"], booking_id),
        return_exceptions=True
    )

    booking_doc.pop("_id", None)
    return {"success": True, "message": "Product booked!", "booking": booking_doc}


@router.get("/my-bookings/{user_id}")
async def my_bookings(user_id: str):
    """Return user's bookings with live session info per booking."""
    bookings = await db.mall_bookings.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    enriched = []
    for b in bookings:
        if b.get("status") == "mining":
            b = await maybe_lapse_or_renew_session(b)
            accumulated, elapsed = await compute_session_accumulated(b)
            rate_per_day = await get_daily_rate_for_booking(b["position"])
            b["session_accumulated_prc"] = accumulated
            b["session_elapsed_seconds"] = elapsed
            b["session_remaining_seconds"] = max(0, SECONDS_PER_DAY - elapsed)
            b["daily_rate_prc"] = rate_per_day
            b["per_second_prc"] = round(rate_per_day / SECONDS_PER_DAY, 6)
            b["per_hour_prc"] = round(rate_per_day / 24, 4)
        else:
            b["session_accumulated_prc"] = 0
            b["session_elapsed_seconds"] = 0
            b["session_remaining_seconds"] = 0
            b["daily_rate_prc"] = 0
            b["per_second_prc"] = 0
            b["per_hour_prc"] = 0
        b["progress_percent"] = round((b.get("paid_prc", 0) / b.get("total_prc", 1)) * 100, 2)
        enriched.append(b)
    return {"success": True, "count": len(enriched), "bookings": enriched}


@router.get("/booking/{booking_id}")
async def get_booking(booking_id: str):
    b = await db.mall_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.get("status") == "mining":
        b = await maybe_lapse_or_renew_session(b)
        accumulated, elapsed = await compute_session_accumulated(b)
        rate_per_day = await get_daily_rate_for_booking(b["position"])
        b["session_accumulated_prc"] = accumulated
        b["session_elapsed_seconds"] = elapsed
        b["session_remaining_seconds"] = max(0, SECONDS_PER_DAY - elapsed)
        b["daily_rate_prc"] = rate_per_day
        b["per_second_prc"] = round(rate_per_day / SECONDS_PER_DAY, 6)
        b["per_hour_prc"] = round(rate_per_day / 24, 4)
    b["progress_percent"] = round((b.get("paid_prc", 0) / b.get("total_prc", 1)) * 100, 2)
    return b


@router.post("/collect/{booking_id}")
async def collect_booking(booking_id: str, body: CollectBookingRequest):
    """Collect current session PRC for this booking. Credits toward product cost."""
    b = await db.mall_bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.get("user_id") != body.user_id:
        raise HTTPException(403, "Not your booking")
    if b.get("status") != "mining":
        raise HTTPException(400, "Booking is not in mining state")

    # Lapse-check first; if just lapsed, accumulated will be ~0 and we tell user
    b = await maybe_lapse_or_renew_session(b)
    accumulated, elapsed = await compute_session_accumulated(b)
    if accumulated < 0.0001:
        raise HTTPException(400, "Nothing to collect yet")

    # Cap collection so we don't overpay product
    paid_prc = float(b.get("paid_prc", 0))
    total_prc = float(b.get("total_prc", 0))
    remaining = max(0.0, total_prc - paid_prc)
    actual_credit = min(accumulated, remaining)
    new_paid = paid_prc + actual_credit
    fulfilled = new_paid >= total_prc - 0.5  # tolerate rounding

    update = {
        "paid_prc": round(new_paid, 4),
        "remaining_prc": round(max(0.0, total_prc - new_paid), 4),
        "session_start": now_utc().isoformat(),  # new 24h cycle
        "last_collected_at": now_utc().isoformat(),
    }
    if fulfilled:
        update["status"] = "fulfilled"
        update["fulfilled_at"] = now_utc().isoformat()
        update["paid_prc"] = total_prc  # exact match
        update["remaining_prc"] = 0
    await db.mall_bookings.update_one({"booking_id": booking_id}, {"$set": update})

    # PRC statement entry — debit (mining→product, never returns to balance)
    await write_prc_statement(
        body.user_id, int(round(actual_credit)),
        f"Paras Mall Mining: {b['product_name']}",
        booking_id
    )

    if fulfilled:
        # Community post for fulfillment milestone (separate from delivery)
        await post_community_event(body.user_id, "fulfilled", b["product_name"], booking_id)

    return {
        "success": True,
        "collected_prc": round(actual_credit, 4),
        "new_paid_prc": update["paid_prc"],
        "remaining_prc": update["remaining_prc"],
        "fulfilled": fulfilled,
        "progress_percent": round((update["paid_prc"] / total_prc) * 100, 2),
    }


@router.get("/leaderboard/recent-bookings")
async def recent_bookings(limit: int = 20):
    """Live ticker: recent bookings + deliveries."""
    feed = await db.community_feed.find(
        {"type": {"$in": ["mall_booked", "mall_delivered", "mall_fulfilled"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return {"success": True, "feed": feed}


# ---------------- ADMIN ENDPOINTS ----------------
@admin_router.post("/products")
async def admin_create_product(body: CreateProductRequest):
    product_id = str(uuid.uuid4())
    doc = body.dict()
    doc["product_id"] = product_id
    doc["created_at"] = now_utc().isoformat()
    await db.mall_products.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "product": doc}


@admin_router.patch("/products/{product_id}")
async def admin_update_product(product_id: str, body: UpdateProductRequest):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        return {"success": True, "message": "No changes"}
    updates["updated_at"] = now_utc().isoformat()
    result = await db.mall_products.update_one({"product_id": product_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Product not found")
    p = await db.mall_products.find_one({"product_id": product_id}, {"_id": 0})
    return {"success": True, "product": p}


@admin_router.delete("/products/{product_id}")
async def admin_delete_product(product_id: str):
    active_bookings = await db.mall_bookings.count_documents({
        "product_id": product_id, "status": {"$in": ["mining", "fulfilled"]}
    })
    if active_bookings > 0:
        raise HTTPException(400, f"Cannot delete: {active_bookings} active bookings exist")
    result = await db.mall_products.delete_one({"product_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"success": True}


@admin_router.get("/bookings")
async def admin_list_bookings(status: Optional[str] = None, limit: int = 200):
    q = {}
    if status:
        q["status"] = status
    bookings = await db.mall_bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for b in bookings:
        b["progress_percent"] = round((b.get("paid_prc", 0) / b.get("total_prc", 1)) * 100, 2)
    return {"success": True, "count": len(bookings), "bookings": bookings}


@admin_router.post("/bookings/{booking_id}/mark-delivered")
async def admin_mark_delivered(booking_id: str):
    b = await db.mall_bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.get("status") != "fulfilled":
        raise HTTPException(400, f"Booking status is '{b.get('status')}', must be 'fulfilled' to deliver")
    await db.mall_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "delivered", "delivered_at": now_utc().isoformat()}}
    )
    await post_community_event(b["user_id"], "delivered", b["product_name"], booking_id)
    return {"success": True, "message": "Marked delivered"}


@admin_router.get("/analytics")
async def admin_analytics():
    """Aggregate stats for admin dashboard."""
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total_prc": {"$sum": "$paid_prc"}}}
    ]
    status_breakdown = await db.mall_bookings.aggregate(pipeline).to_list(10)
    total_products = await db.mall_products.count_documents({})
    active_products = await db.mall_products.count_documents({"active": True})
    return {
        "success": True,
        "total_products": total_products,
        "active_products": active_products,
        "status_breakdown": {row["_id"]: {"count": row["count"], "total_prc": row["total_prc"]} for row in status_breakdown},
    }
