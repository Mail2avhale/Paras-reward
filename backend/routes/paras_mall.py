"""
PARAS MALL — Reward Shopping Destination
==========================================
Users book products using PRC. Each booking enters a single-leg booking-order
tree. Daily mining accrues using the SAME network-rate curve as main mining:

    N = active bookings positioned AFTER this one (status="mining")
    PRC_per_user(N) = max(2.5, 5 × (21 - log₂(N)) / 14)
    daily_rate      = max(50, N × PRC_per_user(N))   ← 50 PRC/day floor

Mining continues until cumulative collected PRC reaches the product's full
price (MRP × 10) — at which point status auto-flips to 'fulfilled' and the
booking is queued for delivery.

Conversion rate: FIXED 10 PRC = ₹1.
Upfront cost: max(10% MRP, ₹1000) — paid immediately in PRC at booking.
No cancellation, no refund. Delivery only at 100%.
"""

import logging
import asyncio
import math
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/mall", tags=["Paras Mall"])
admin_router = APIRouter(prefix="/admin/mall", tags=["Paras Mall Admin"])

db = None  # injected by server

# ---------------- CONSTANTS ----------------
PRC_INR_RATE = 10  # 10 PRC = ₹1 (fixed, June 2026)
BASE_DAILY_RATE_PRC = 4  # Legacy — kept for back-compat; new formula uses MIN_DAILY_RATE
MIN_DAILY_RATE_PRC = 50  # Floor: ≥ 50 PRC/day per booking (Feb 2026 formula)
UPFRONT_PERCENT = 0.10  # 10% of MRP
UPFRONT_MIN_INR = 1000  # Or ₹1000 minimum, whichever is higher
SESSION_DURATION_HOURS = 24  # Each booking session
SECONDS_PER_DAY = 86400
COLLECT_TO_START_COOLDOWN_SECONDS = 60  # Mirror of main mining: after a user
# collects their accumulated PRC for a product booking, they must wait 60
# seconds before manually starting a fresh mining session. This drives in-app
# retention + AdMob impressions (consistent with the main mining flow).


def set_db(database):
    global db
    db = database
    # Auto-seed mall products from bundle if collection is empty
    # Runs lazily on first event-loop tick so the routes are registered first.
    try:
        asyncio.create_task(_auto_seed_mall_products())
    except RuntimeError:
        # No running loop yet — schedule for later via FastAPI startup hook safety
        pass


async def _auto_seed_mall_products():
    """If mall_products is empty (fresh production DB), seed from bundle JSON."""
    try:
        if db is None:
            return
        count = await db.mall_products.count_documents({})
        if count > 0:
            return  # Already has products, no-op
        bundle_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mall_products_seed.json")
        if not os.path.exists(bundle_path):
            logging.info(f"[mall auto-seed] Bundle not found at {bundle_path}, skipping")
            return
        import json as _json
        with open(bundle_path) as f:
            products = _json.load(f)
        if not products:
            return
        await db.mall_products.insert_many(products)
        logging.info(f"[mall auto-seed] Successfully seeded {len(products)} mall products from bundle on empty DB")
    except Exception as e:
        logging.warning(f"[mall auto-seed] Failed: {e}")


# ---------------- MODELS ----------------
class DeliveryAddress(BaseModel):
    name: str
    mobile: str
    address_line: str
    city: Optional[str] = ""
    state: Optional[str] = ""
    pin_code: str
    landmark: Optional[str] = ""


class BookProductRequest(BaseModel):
    user_id: str
    delivery: Optional[DeliveryAddress] = None  # required for new bookings, optional for legacy


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


async def get_daily_rate_for_booking(booking_position: int) -> float:
    """PARAS MALL Network Rate Formula (Feb 2026)
    ============================================
    Same shape as Main Mining: daily_rate = N × PRC_per_user(N)
    where:
      N = active bookings positioned AFTER this booking (status="mining")
      PRC_per_user(N) = max(2.5, 5 × (21 - log₂(N)) / 14)
      daily_rate = max(MIN_DAILY_RATE_PRC, N × PRC_per_user(N))

    Floor of 50 PRC/day so a booking with N=0 still earns something
    (otherwise newest bookings would stall until someone books below).
    """
    N = await db.mall_bookings.count_documents({
        "position": {"$gt": booking_position},
        "status": "mining",
    })
    if N <= 0:
        return float(MIN_DAILY_RATE_PRC)
    prc_per_user = max(2.5, 5.0 * (21.0 - math.log2(N)) / 14.0)
    raw_daily = N * prc_per_user
    return float(max(MIN_DAILY_RATE_PRC, raw_daily))


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
    """No-op (legacy). With manual Start Session flow, sessions never auto-renew.
    Accumulated PRC is naturally capped at 24h in compute_session_accumulated().
    Kept for compatibility with existing call-sites.
    """
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
    """Write DEBIT entry to prc_ledger (the canonical PRC passbook source).
    Best-effort: errors logged but do not block booking flow.
    """
    try:
        # Snapshot balance for proper running-balance display
        u = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1}) or {}
        balance_after = float(u.get("prc_balance", 0) or 0)
        balance_before = balance_after + amount  # we just debited `amount`
        await db.prc_ledger.insert_one({
            "txn_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "mall_booking",
            "entry_type": "debit",
            "amount": -abs(amount),  # negative for debit per ledger convention
            "balance_before": round(balance_before, 2),
            "balance_after": round(balance_after, 2),
            "reference": ref_id,
            "service_type": "paras_mall",
            "service_label": "Paras Mall",
            "service_ref_id": ref_id,
            "description": description,
            "timestamp": now_utc().isoformat(),
            "created_at": now_utc().isoformat(),
        })
    except Exception as e:
        logging.warning(f"[MALL] PRC ledger write failed: {e}")


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

    # Delivery address is mandatory for all new Mall bookings (physical product fulfillment)
    if not body.delivery:
        raise HTTPException(400, "Delivery address is required to book a product.")
    d = body.delivery
    if not d.name.strip() or not d.mobile.strip() or not d.address_line.strip() or not d.pin_code.strip():
        raise HTTPException(400, "Name, mobile, address and PIN code are all required.")
    if not d.pin_code.isdigit() or len(d.pin_code) != 6:
        raise HTTPException(400, "PIN code must be exactly 6 digits.")
    mobile_clean = "".join(c for c in d.mobile if c.isdigit())
    if len(mobile_clean) < 10:
        raise HTTPException(400, "Mobile must be at least 10 digits.")

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
        # `total_prc_deducted` mirrors upfront_prc so this booking is counted
        # by the centralized lifetime-redeemed scanner (`get_user_all_time_redeemed`).
        # Only the wallet-debit portion counts; mined PRC never left the wallet.
        "total_prc_deducted": upfront_prc,
        "paid_prc": upfront_prc,  # upfront credited immediately
        "remaining_prc": total_prc - upfront_prc,
        "position": position,
        "status": "mining",  # mining → fulfilled → delivered
        "session_start": now.isoformat(),
        "laps_count": 0,
        "created_at": now.isoformat(),
        "fulfilled_at": None,
        "delivered_at": None,
        # Delivery details captured at booking time
        "delivery": {
            "name": d.name.strip(),
            "mobile": mobile_clean,
            "address_line": d.address_line.strip(),
            "city": (d.city or "").strip(),
            "state": (d.state or "").strip(),
            "pin_code": d.pin_code.strip(),
            "landmark": (d.landmark or "").strip(),
        },
    }
    await db.mall_bookings.insert_one(booking_doc)

    # Persist this delivery address to user profile (best-effort, idempotent)
    # — so the user doesn't have to re-type next time.
    try:
        addr_update = {
            "address_line1": d.address_line.strip(),
            "city": (d.city or "").strip(),
            "state": (d.state or "").strip(),
            "pincode": d.pin_code.strip(),
        }
        # Only set fields that user hasn't already saved
        existing_keys = ["address_line1", "city", "state", "pincode"]
        existing = {k: user.get(k) for k in existing_keys}
        to_set = {k: v for k, v in addr_update.items() if v and not existing.get(k)}
        if to_set:
            await db.users.update_one({"uid": body.user_id}, {"$set": to_set})
    except Exception as _e:
        logging.warning(f"[MALL] profile address save failed (non-fatal): {_e}")

    # Debit user's PRC balance
    await db.users.update_one(
        {"uid": body.user_id},
        {"$inc": {"prc_balance": -upfront_prc, "total_spent_prc": upfront_prc}}
    )

    # Invalidate lifetime-redeemed cache so dashboards reflect this debit immediately
    try:
        from server import invalidate_lifetime_cache
        invalidate_lifetime_cache(body.user_id)
    except Exception:
        pass

    # PRC statement entry + community feed ticker (best-effort, parallel)
    await asyncio.gather(
        write_prc_statement(
            body.user_id, upfront_prc,
            f"Paras Mall Booking: {product['name']} (upfront)",
            booking_id
        ),
        post_community_event(body.user_id, "booked", product["name"], booking_id),
        return_exceptions=True
    )

    # Community Forum success-story post (visible at /community)
    try:
        from routes.community import create_success_story_post
        await create_success_story_post(
            user_id=body.user_id,
            service_type="paras_mall",
            amount_inr=float(product["mrp_inr"]),
            ref_id=booking_id,
            extra_title=product["name"],
        )
    except Exception as e:
        logging.warning(f"[MALL] community forum post failed (non-fatal): {e}")

    # Sustainability auto-burn (1% of post-deduction balance, threshold 30k)
    try:
        from routes.sustainability_burn import apply_sustainability_burn
        await apply_sustainability_burn(
            user_id=body.user_id,
            service_type="paras_mall",
            service_ref_id=booking_id,
            amount_inr=product["mrp_inr"] * 0.10,  # upfront INR equivalent
        )
    except Exception as e:
        logging.warning(f"[SUSTAIN-BURN] mall hook failed (non-fatal): {e}")

    booking_doc.pop("_id", None)
    return {"success": True, "message": "Product booked!", "booking": booking_doc}


# ────────────────────────────────────────────────────────────────────────
# USER-INITIATED BOOKING CANCELLATION
# ────────────────────────────────────────────────────────────────────────
# A user can cancel a product booking themselves while it is still in the
# "mining" stage (i.e. the product has NOT been fulfilled yet — meaning
# the full target PRC has not been reached). On cancel:
#
#   • The upfront PRC the user paid at booking time is REFUNDED to their
#     wallet (`prc_balance += upfront_prc`).
#   • All mined PRC they accumulated against this product (the portion
#     above `upfront_prc`) is BURNED — it was never actually in the
#     wallet, it lived only on the booking doc. Marking the booking
#     "cancelled" effectively burns it.
#   • A CREDIT entry is written to `prc_ledger` so the refund appears on
#     the user's PRC statement.
#   • `total_prc_deducted` is zeroed so the lifetime-redeemed scanner no
#     longer counts this booking toward the 2,500 INR benefits cap.
#
# Cancellation is NOT allowed once the booking reaches "fulfilled" or
# "delivered" — at that point the product is being shipped / has been
# received and the order is non-reversible.

class CancelBookingRequest(BaseModel):
    user_id: str


@router.post("/cancel-booking/{booking_id}")
async def cancel_booking(booking_id: str, body: CancelBookingRequest):
    """User-initiated cancellation of a Paras Mall booking.
    Refunds upfront PRC, burns accumulated mined PRC, writes a CREDIT
    entry to prc_ledger, and marks the booking as 'cancelled'.
    """
    booking = await db.mall_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")

    # Ownership check — only the booking owner can cancel
    if booking.get("user_id") != body.user_id:
        raise HTTPException(403, "You can only cancel your own bookings")

    status = booking.get("status", "mining")
    if status != "mining":
        # Fulfilled/delivered/cancelled bookings are non-reversible
        raise HTTPException(
            400,
            f"Cannot cancel a booking that is already {status}. Only 'mining' bookings can be cancelled."
        )

    upfront_prc = int(booking.get("upfront_prc", 0))
    paid_prc = float(booking.get("paid_prc", upfront_prc))
    burned_prc = max(0.0, paid_prc - upfront_prc)  # mined PRC that gets burned

    user = await db.users.find_one({"uid": body.user_id})
    if not user:
        raise HTTPException(404, "User not found")

    now = now_utc()

    # 1. Refund the upfront PRC to wallet, and zero out total_spent_prc contribution
    await db.users.update_one(
        {"uid": body.user_id},
        {"$inc": {"prc_balance": upfront_prc, "total_spent_prc": -upfront_prc}}
    )

    # 2. Mark booking cancelled — and zero `total_prc_deducted` so the
    #    lifetime-redeemed scanner stops counting this booking toward
    #    the 2,500 INR benefits cap.
    await db.mall_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
            "refunded_prc": upfront_prc,
            "burned_prc": round(burned_prc, 2),
            "total_prc_deducted": 0,
        }}
    )

    # 3. Write CREDIT entry to prc_ledger so the refund shows on PRC statement.
    try:
        fresh_user = await db.users.find_one({"uid": body.user_id}, {"_id": 0, "prc_balance": 1}) or {}
        balance_after = float(fresh_user.get("prc_balance", 0) or 0)
        balance_before = balance_after - upfront_prc
        await db.prc_ledger.insert_one({
            "txn_id": str(uuid.uuid4()),
            "user_id": body.user_id,
            "type": "mall_cancel_refund",
            "entry_type": "credit",
            "amount": upfront_prc,  # positive — this is a refund credit
            "balance_before": round(balance_before, 2),
            "balance_after": round(balance_after, 2),
            "reference": booking_id,
            "service_type": "paras_mall",
            "service_label": "Paras Mall",
            "service_ref_id": booking_id,
            "description": (
                f"Paras Mall Booking Cancelled: {booking.get('product_name', 'product')} "
                f"(upfront refund; {int(round(burned_prc))} mined PRC burned)"
            ),
            "timestamp": now.isoformat(),
            "created_at": now.isoformat(),
        })
    except Exception as e:
        logging.warning(f"[MALL CANCEL] PRC ledger write failed: {e}")

    # 4. Invalidate lifetime-redeemed cache so dashboards reflect this credit immediately
    try:
        from server import invalidate_lifetime_cache
        invalidate_lifetime_cache(body.user_id)
    except Exception:
        pass

    return {
        "success": True,
        "message": "Booking cancelled. Upfront PRC refunded to your wallet.",
        "refunded_prc": upfront_prc,
        "burned_prc": round(burned_prc, 2),
        "booking_id": booking_id,
    }


@router.get("/my-bookings/{user_id}")
async def my_bookings(user_id: str):
    """Return user's bookings with live session info per booking."""
    bookings = await db.mall_bookings.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    now = now_utc()
    enriched = []
    for b in bookings:
        if b.get("status") == "mining":
            b = await maybe_lapse_or_renew_session(b)
            session_start = parse_iso(b.get("session_start"))
            session_active = bool(session_start)
            accumulated, elapsed = await compute_session_accumulated(b)
            rate_per_day = await get_daily_rate_for_booking(b["position"])
            # Cooldown countdown — only when session is paused after a collect
            next_avail = parse_iso(b.get("next_session_available_at"))
            cooldown_remaining = 0
            can_start_session = True
            if not session_active and next_avail:
                cooldown_remaining = max(0, int((next_avail - now).total_seconds()))
                can_start_session = cooldown_remaining == 0
            b["session_active"] = session_active
            b["session_accumulated_prc"] = accumulated
            b["session_elapsed_seconds"] = elapsed
            b["session_remaining_seconds"] = max(0, SECONDS_PER_DAY - elapsed) if session_active else 0
            b["daily_rate_prc"] = rate_per_day
            b["per_second_prc"] = round(rate_per_day / SECONDS_PER_DAY, 6) if session_active else 0
            b["per_hour_prc"] = round(rate_per_day / 24, 4)
            b["cooldown_remaining_seconds"] = cooldown_remaining
            b["can_start_session"] = can_start_session and not session_active
        else:
            b["session_active"] = False
            b["session_accumulated_prc"] = 0
            b["session_elapsed_seconds"] = 0
            b["session_remaining_seconds"] = 0
            b["daily_rate_prc"] = 0
            b["per_second_prc"] = 0
            b["per_hour_prc"] = 0
            b["cooldown_remaining_seconds"] = 0
            b["can_start_session"] = False
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
        session_start = parse_iso(b.get("session_start"))
        session_active = bool(session_start)
        accumulated, elapsed = await compute_session_accumulated(b)
        rate_per_day = await get_daily_rate_for_booking(b["position"])
        now = now_utc()
        next_avail = parse_iso(b.get("next_session_available_at"))
        cooldown_remaining = 0
        if not session_active and next_avail:
            cooldown_remaining = max(0, int((next_avail - now).total_seconds()))
        b["session_active"] = session_active
        b["session_accumulated_prc"] = accumulated
        b["session_elapsed_seconds"] = elapsed
        b["session_remaining_seconds"] = max(0, SECONDS_PER_DAY - elapsed) if session_active else 0
        b["daily_rate_prc"] = rate_per_day
        b["per_second_prc"] = round(rate_per_day / SECONDS_PER_DAY, 6) if session_active else 0
        b["per_hour_prc"] = round(rate_per_day / 24, 4)
        b["cooldown_remaining_seconds"] = cooldown_remaining
        b["can_start_session"] = cooldown_remaining == 0 and not session_active
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
        # CHANGED: Do NOT auto-start a new 24h cycle. Match main mining flow —
        # user must manually click "Start Session" after a 60-second cooldown.
        "session_start": None,
        "session_active": False,
        "last_collected_at": now_utc().isoformat(),
        "next_session_available_at": (now_utc() + timedelta(seconds=COLLECT_TO_START_COOLDOWN_SECONDS)).isoformat(),
    }
    if fulfilled:
        update["status"] = "fulfilled"
        update["fulfilled_at"] = now_utc().isoformat()
        update["paid_prc"] = total_prc  # exact match
        update["remaining_prc"] = 0
        # Once fulfilled, no further sessions needed
        update.pop("next_session_available_at", None)
    await db.mall_bookings.update_one({"booking_id": booking_id}, {"$set": update})

    # NOTE: We intentionally do NOT write a PRC ledger entry for mining
    # collects — mined PRC never entered the user's wallet, so showing a
    # "debit" would be misleading. Only the upfront wallet-debit appears
    # in the PRC Statement.

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
        "cooldown_seconds": 0 if fulfilled else COLLECT_TO_START_COOLDOWN_SECONDS,
        "next_session_available_at": None if fulfilled else update.get("next_session_available_at"),
        "session_active": False,
    }


class StartSessionRequest(BaseModel):
    user_id: str


@router.post("/start-session/{booking_id}")
async def start_booking_session(booking_id: str, body: StartSessionRequest):
    """Manually start a new mining session for a product booking.

    Called after the 60-second cooldown finishes. Mirrors the main mining
    "Start Session" flow.
    """
    b = await db.mall_bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.get("user_id") != body.user_id:
        raise HTTPException(403, "Not your booking")
    if b.get("status") != "mining":
        raise HTTPException(400, "Booking is not in mining state")
    if b.get("session_start"):
        # Session already running — idempotent: return current state
        return {
            "success": True,
            "already_active": True,
            "session_start": b["session_start"],
        }

    # Enforce cooldown
    next_avail = parse_iso(b.get("next_session_available_at"))
    now = now_utc()
    if next_avail and now < next_avail:
        remaining = int((next_avail - now).total_seconds())
        raise HTTPException(
            400,
            f"Please wait {remaining}s before starting a new session"
        )

    await db.mall_bookings.update_one(
        {"booking_id": booking_id},
        {
            "$set": {
                "session_start": now.isoformat(),
                "session_active": True,
                "next_session_available_at": None,
                "last_session_started_at": now.isoformat(),
            }
        }
    )
    return {
        "success": True,
        "already_active": False,
        "session_start": now.isoformat(),
        "session_duration_seconds": SECONDS_PER_DAY,
    }


@router.get("/leaderboard/recent-bookings")
async def recent_bookings(limit: int = 20):
    """Live ticker: recent bookings + deliveries."""
    feed = await db.community_feed.find(
        {"type": {"$in": ["mall_booked", "mall_delivered", "mall_fulfilled"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return {"success": True, "feed": feed}


@router.get("/stats/booking-counts")
async def booking_counts_per_product():
    """Return ALL-TIME booking counts per product (used for social-proof "X booked" badge).
    Aggregates `mall_bookings` collection so the count is monotonic — never decreases.
    """
    pipeline = [
        {"$group": {
            "_id": "$product_id",
            "count": {"$sum": 1},
            "product_name": {"$first": "$product_name"},
        }},
    ]
    rows = await db.mall_bookings.aggregate(pipeline).to_list(1000)
    by_product_id = {r["_id"]: r["count"] for r in rows}
    by_product_name = {r["product_name"]: r["count"] for r in rows if r.get("product_name")}
    return {
        "success": True,
        "by_product_id": by_product_id,
        "by_product_name": by_product_name,
    }


# ---------------- ADMIN ENDPOINTS ----------------
@admin_router.post("/upload-image")
async def admin_upload_product_image(file: UploadFile = File(...)):
    """Upload + AUTO-NORMALIZE a product image.
    - Validates type / size
    - Center-crops to 1:1 square (preserves the most important visual area)
    - Resizes to 1024×1024 max
    - Re-encodes as JPEG (quality=88) for ~70% smaller files than originals
    - Returns the public URL for use on `image_url`
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

    # ---------- AUTO-NORMALIZE (center-crop square + resize + re-encode) ----------
    from PIL import Image, ImageOps
    import io
    try:
        img = Image.open(io.BytesIO(blob))
        # Honour EXIF rotation (phone camera uploads frequently rotate)
        img = ImageOps.exif_transpose(img)
        # Flatten alpha onto a white canvas so JPEG output is clean
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.convert("RGBA").split()[-1])
            img = bg
        else:
            img = img.convert("RGB")
        # Center-crop to square
        w, h = img.size
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
        # Resize to 1024×1024 max (preserves quality for product cards)
        if img.size[0] > 1024:
            img = img.resize((1024, 1024), Image.LANCZOS)
        # Re-encode as JPEG
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=88, optimize=True, progressive=True)
        out.seek(0)
        normalized = out.read()
        final_dim = img.size[0]
    except Exception as e:
        raise HTTPException(400, f"Invalid image: {e}")

    # ---------- Save to disk ----------
    base = file.filename.rsplit(".", 1)[0]
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", base).strip("_").lower() or "product"
    ts = int(datetime.now(timezone.utc).timestamp())
    fname = f"{slug}_{ts}.jpg"  # always .jpg after normalize
    target_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "mall")
    os.makedirs(target_dir, exist_ok=True)
    path = os.path.join(target_dir, fname)
    with open(path, "wb") as f:
        f.write(normalized)
    return {
        "success": True,
        "image_url": f"/api/static/mall/{fname}",
        "filename": fname,
        "size_bytes": len(normalized),
        "original_size_bytes": len(blob),
        "compression_ratio": f"{(1 - len(normalized) / len(blob)) * 100:.0f}%",
        "dimensions": f"{final_dim}x{final_dim}",
    }


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
    # Lookup user names + mobile in a single batch for the bookings page
    user_ids = list({b.get("user_id") for b in bookings if b.get("user_id")})
    users = await db.users.find(
        {"uid": {"$in": user_ids}},
        {"_id": 0, "uid": 1, "name": 1, "first_name": 1, "last_name": 1, "mobile": 1, "phone": 1}
    ).to_list(len(user_ids) or 1)
    user_map = {}
    for u in users:
        full = u.get("name") or " ".join(filter(None, [u.get("first_name"), u.get("last_name")])).strip()
        user_map[u["uid"]] = {
            "name": full or "Unknown",
            "mobile": u.get("mobile") or u.get("phone") or "",
        }
    for b in bookings:
        b["progress_percent"] = round((b.get("paid_prc", 0) / b.get("total_prc", 1)) * 100, 2)
        u = user_map.get(b.get("user_id"), {})
        b["user_name"] = u.get("name", "Unknown")
        b["user_mobile"] = u.get("mobile", "")
    return {"success": True, "count": len(bookings), "bookings": bookings}


@admin_router.post("/bookings/{booking_id}/mark-delivered")
async def admin_mark_delivered(booking_id: str):
    b = await db.mall_bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.get("status") != "fulfilled":
        raise HTTPException(400, f"Booking status is '{b.get('status')}', must be 'fulfilled' to deliver")
    if not (b.get("delivery") or {}).get("address_line"):
        raise HTTPException(400, "Cannot mark delivered — delivery address is missing on this booking.")
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


@admin_router.post("/seed-from-bundle")
async def admin_seed_from_bundle():
    """Idempotent bulk import: reads /app/backend/data/mall_products_seed.json
    and UPSERTS every product by `product_id`. Safe to re-run.

    Used to migrate the 43 preview-seeded mall products into a fresh
    production database after deploy. Returns counts.
    """
    import json as _json
    bundle_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mall_products_seed.json")
    if not os.path.exists(bundle_path):
        raise HTTPException(500, f"Bundle not found at {bundle_path}")
    with open(bundle_path) as f:
        products = _json.load(f)
    inserted = 0
    updated = 0
    for p in products:
        pid = p.get("product_id")
        if not pid:
            continue
        existing = await db.mall_products.find_one({"product_id": pid})
        if existing:
            await db.mall_products.update_one({"product_id": pid}, {"$set": p})
            updated += 1
        else:
            await db.mall_products.insert_one(p)
            inserted += 1
    total = await db.mall_products.count_documents({})
    return {
        "success": True,
        "inserted": inserted,
        "updated": updated,
        "total_in_db": total,
        "bundle_size": len(products),
    }

