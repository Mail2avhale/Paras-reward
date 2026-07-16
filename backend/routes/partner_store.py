"""
Partner Store Payment & Settlement Network — Paras Reward v2.0 (Feb 2026)
==========================================================================

New module for the Partner Store Network. Enables verified local businesses
to accept PRC from users. This file scopes SLICE 1 — foundation:
  • Data models & collections (partner_stores, partner_store_wallets)
  • Admin CRUD (create login, verify KYC, list, search, pagination)
  • Partner Store self-view endpoints (profile, wallet balance)

DESIGN PRINCIPLES
─────────────────
1. Non-e-commerce. NO product catalog, NO inventory, NO cart. Only payment.
2. Auth reuses `users` collection with role='partner_store' + a link field
   `partner_store_id` referencing the store profile in `partner_stores`.
   Frontend detects role at login and redirects to /partner-store/dashboard.
3. Sequential 6-digit Store IDs starting from 100001. First-fit atomic
   allocation via db.counters.find_one_and_update (upsert) for race safety.
4. Verified store default: created by admin → status='pending' KYC.
   Admin runs verify → status='verified' → wallet auto-materialized on
   first payment credit (lazy init to save 10k+ empty docs at scale).
5. Production-scale indexes (Q6=q, 10k+ stores):
     - unique (mobile_number)
     - unique (store_id)
     - compound (verification_status, created_at DESC) for admin queue
     - text (business_name, owner_name, address) for search
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# ── Database bootstrap ───────────────────────────────────────────────
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__default_rounds=10)


def _hash_pin(pin: str) -> str:
    return pwd_context.hash(pin)


# ── Admin gate — reuses the same ADMIN_OPERATION_PIN env pattern ─────
ADMIN_OPERATION_PIN = os.environ.get("ADMIN_OPERATION_PIN", "").strip()


def _require_admin_pin(pin: Optional[str]) -> None:
    if not ADMIN_OPERATION_PIN:
        raise HTTPException(status_code=500, detail="Admin PIN not configured on server")
    if not pin or pin.strip() != ADMIN_OPERATION_PIN:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")


# ── Sequential Store ID allocation ───────────────────────────────────
STORE_ID_START = 100001


async def _allocate_store_id() -> str:
    """
    Atomically allocate the next sequential 6-digit Store ID (Q_A=a1).
    Uses a counters document — safe under concurrent creates.

    Race-safety: seed the counter to STORE_ID_START-1 on first invocation
    so $inc always returns >= STORE_ID_START. This eliminates the
    theoretical window where two concurrent creates could get low IDs
    (1, 2, ...) before the bump-to-100001 fixup ran.
    """
    # First-time seed — set counter to STORE_ID_START-1 only if missing
    await db.counters.update_one(
        {"_id": "partner_store_id_seq"},
        {"$setOnInsert": {"value": STORE_ID_START - 1}},
        upsert=True,
    )
    doc = await db.counters.find_one_and_update(
        {"_id": "partner_store_id_seq"},
        {"$inc": {"value": 1}},
        return_document=True,  # pymongo.ReturnDocument.AFTER
    )
    value = doc.get("value", STORE_ID_START)
    if value < STORE_ID_START:
        # Defensive fallback (should not happen with seed above)
        await db.counters.update_one(
            {"_id": "partner_store_id_seq"},
            {"$set": {"value": STORE_ID_START}},
        )
        value = STORE_ID_START
    return str(value)


# ── Index bootstrap (idempotent, run at import time) ─────────────────
_indexes_created = False


async def _ensure_indexes() -> None:
    global _indexes_created
    if _indexes_created:
        return
    try:
        await db.partner_stores.create_index("store_id", unique=True, name="partner_store_id_1")
        await db.partner_stores.create_index(
            "mobile_number",
            unique=True,
            partialFilterExpression={"mobile_number": {"$type": "string"}},
            name="partner_store_mobile_1",
        )
        await db.partner_stores.create_index(
            [("verification_status", 1), ("created_at", -1)],
            name="partner_store_status_created",
        )
        await db.partner_stores.create_index(
            [("business_name", "text"), ("owner_name", "text"), ("address", "text")],
            name="partner_store_search_text",
        )
        await db.partner_store_wallets.create_index("store_id", unique=True, name="wallet_store_id_1")
        await db.partner_store_txns.create_index(
            [("store_id", 1), ("created_at", -1)],
            name="txn_store_created",
        )
        await db.partner_store_txns.create_index(
            [("user_uid", 1), ("created_at", -1)],
            name="txn_user_created",
        )
        await db.partner_store_txns.create_index("client_txn_id", unique=True, sparse=True, name="txn_client_id_1")
        _indexes_created = True
    except Exception as e:
        # Non-fatal — routes still work even if index creation races
        import logging
        logging.warning(f"[partner_store] index create warning: {e}")


# ── Pydantic models ──────────────────────────────────────────────────
class PartnerStoreCreateRequest(BaseModel):
    admin_pin: str = Field(..., description="ADMIN_OPERATION_PIN")
    business_name: str = Field(..., min_length=2, max_length=120)
    owner_name: str = Field(..., min_length=2, max_length=80)
    mobile_number: str = Field(..., pattern=r"^\d{10}$")
    login_pin: str = Field(..., pattern=r"^\d{6}$", description="6-digit login PIN (same pattern as user)")
    email: Optional[str] = None
    address: str = Field(..., min_length=3, max_length=300)
    aadhaar_number: Optional[str] = Field(None, pattern=r"^\d{12}$")
    pan_number: Optional[str] = Field(None, pattern=r"^[A-Z]{5}\d{4}[A-Z]$")
    bank_account_number: str = Field(..., min_length=6, max_length=20)
    bank_ifsc: str = Field(..., pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")
    bank_account_holder: str = Field(..., min_length=2, max_length=80)
    shop_photo_url: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    business_type: Optional[str] = None
    business_proof_url: Optional[str] = None


class PartnerStoreVerifyRequest(BaseModel):
    admin_pin: str
    store_id: str
    action: str = Field(..., pattern=r"^(verify|reject|suspend)$")
    remark: Optional[str] = None


# ── Router ───────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/v2/partner-stores", tags=["partner-store"])


@router.on_event("startup")
async def _startup():
    await _ensure_indexes()


# ═════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═════════════════════════════════════════════════════════════════════

@router.post("/admin/create")
async def admin_create_partner_store(body: PartnerStoreCreateRequest):
    """
    Admin creates a Partner Store login + profile (Q2=e).
    No public self-registration — admin-only onboarding.
    Creates:
      • `users` doc with role='partner_store', hashed PIN, linked store_id
      • `partner_stores` profile doc with KYC pending status
    """
    _require_admin_pin(body.admin_pin)
    await _ensure_indexes()

    # Reject duplicate mobile
    existing_user = await db.users.find_one({"mobile": body.mobile_number}, {"_id": 0, "uid": 1, "role": 1})
    if existing_user:
        raise HTTPException(
            status_code=409,
            detail=f"Mobile {body.mobile_number} already registered as {existing_user.get('role', 'user')}",
        )
    existing_store = await db.partner_stores.find_one({"mobile_number": body.mobile_number}, {"_id": 0, "store_id": 1})
    if existing_store:
        raise HTTPException(
            status_code=409,
            detail=f"Store already exists with mobile {body.mobile_number} (Store ID: {existing_store['store_id']})",
        )

    store_id = await _allocate_store_id()
    store_uid = f"pstore-{store_id}"
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1) Create the auth `users` doc for the store
    _hashed = _hash_pin(body.login_pin)
    await db.users.insert_one({
        "uid": store_uid,
        "name": body.owner_name,
        "mobile": body.mobile_number,
        "email": body.email,
        "pin_hash": _hashed,
        "password": _hashed,         # main auth login fallback field
        "pin_migrated": True,        # skip legacy password→PIN migration prompt
        "role": "partner_store",
        "partner_store_id": store_id,
        "subscription_plan": "partner_store",
        "kyc_status": "pending",
        "created_at": now_iso,
        "updated_at": now_iso,
    })

    # 2) Create the store profile doc
    store_doc = {
        "store_id": store_id,
        "linked_user_uid": store_uid,
        "business_name": body.business_name,
        "owner_name": body.owner_name,
        "mobile_number": body.mobile_number,
        "email": body.email,
        "address": body.address,
        "aadhaar_number": body.aadhaar_number,
        "pan_number": body.pan_number,
        "bank_account_number": body.bank_account_number,
        "bank_ifsc": body.bank_ifsc,
        "bank_account_holder": body.bank_account_holder,
        "shop_photo_url": body.shop_photo_url,
        "gps_lat": body.gps_lat,
        "gps_lng": body.gps_lng,
        "business_type": body.business_type,
        "business_proof_url": body.business_proof_url,
        "verification_status": "pending",  # admin must run verify next
        "verification_remark": None,
        "verified_at": None,
        "verified_by_admin": None,
        "is_active": False,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.partner_stores.insert_one(store_doc)

    # 3) Materialise wallet (0 balance)
    await db.partner_store_wallets.insert_one({
        "store_id": store_id,
        "prc_balance": 0.0,
        "lifetime_received_prc": 0.0,
        "lifetime_settled_prc": 0.0,
        "pending_settlement_prc": 0.0,
        "txn_count": 0,
        "created_at": now_iso,
        "updated_at": now_iso,
    })

    # Strip Mongo _id if present (from insert_one attaching in-place)
    store_doc.pop("_id", None)
    return {
        "success": True,
        "store_id": store_id,
        "login_uid": store_uid,
        "verification_status": "pending",
        "message": "Partner Store created. Run /admin/verify to activate.",
        "store": store_doc,
    }


@router.post("/admin/verify")
async def admin_verify_partner_store(body: PartnerStoreVerifyRequest):
    """
    Admin approves/rejects/suspends a Partner Store's KYC.
    """
    _require_admin_pin(body.admin_pin)

    store = await db.partner_stores.find_one({"store_id": body.store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail=f"Store {body.store_id} not found")

    now_iso = datetime.now(timezone.utc).isoformat()

    if body.action == "verify":
        new_status = "verified"
        new_active = True
    elif body.action == "reject":
        new_status = "rejected"
        new_active = False
    else:  # suspend
        new_status = "suspended"
        new_active = False

    await db.partner_stores.update_one(
        {"store_id": body.store_id},
        {"$set": {
            "verification_status": new_status,
            "verification_remark": body.remark,
            "verified_at": now_iso if body.action == "verify" else store.get("verified_at"),
            "verified_by_admin": "admin",
            "is_active": new_active,
            "updated_at": now_iso,
        }},
    )
    # Reflect status on the linked user's kyc_status so downstream checks work
    await db.users.update_one(
        {"uid": store["linked_user_uid"]},
        {"$set": {
            "kyc_status": "verified" if new_status == "verified" else "pending",
            "is_active": new_active,
            "updated_at": now_iso,
        }},
    )

    # Notification to the store user
    await db.notifications.insert_one({
        "notification_id": str(uuid.uuid4()),
        "user_id": store["linked_user_uid"],
        "user_uid": store["linked_user_uid"],
        "type": "partner_store_verification",
        "title": {
            "verify":  "✅ Partner Store Verified",
            "reject":  "❌ Partner Store KYC Rejected",
            "suspend": "⛔ Partner Store Suspended",
        }[body.action],
        "message": (
            f"Your Partner Store (ID {body.store_id}) has been {new_status}."
            + (f" Admin remark: {body.remark}" if body.remark else "")
        ),
        "created_at": now_iso,
        "read": False,
        "is_read": False,
    })

    return {
        "success": True,
        "store_id": body.store_id,
        "verification_status": new_status,
        "is_active": new_active,
    }


@router.get("/admin/list")
async def admin_list_partner_stores(
    x_admin_pin: Optional[str] = Header(None, alias="X-Admin-Pin"),
    status: Optional[str] = Query(None, description="Filter by verification_status"),
    search: Optional[str] = Query(None, description="Free-text search on business/owner/address"),
    cursor: Optional[str] = Query(None, description="ISO created_at for cursor pagination"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Paginated list of Partner Stores. Cursor-based pagination for 10k+ scale (Q6=q).
    """
    _require_admin_pin(x_admin_pin)

    query: dict = {}
    if status:
        query["verification_status"] = status
    if search:
        query["$text"] = {"$search": search}
    if cursor:
        query["created_at"] = {"$lt": cursor}

    projection = {"_id": 0}
    docs = await db.partner_stores.find(query, projection).sort("created_at", -1).limit(limit + 1).to_list(length=limit + 1)

    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = docs[-1]["created_at"] if (has_more and docs) else None

    # Aggregate summary — fast for admin dashboard chip counts
    pipeline = [{"$group": {"_id": "$verification_status", "count": {"$sum": 1}}}]
    by_status = {row["_id"]: row["count"] async for row in db.partner_stores.aggregate(pipeline)}

    return {
        "success": True,
        "stores": docs,
        "next_cursor": next_cursor,
        "has_more": has_more,
        "count_by_status": by_status,
    }


@router.get("/admin/{store_id}")
async def admin_get_partner_store_detail(
    store_id: str,
    x_admin_pin: Optional[str] = Header(None, alias="X-Admin-Pin"),
):
    _require_admin_pin(x_admin_pin)
    store = await db.partner_stores.find_one({"store_id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail=f"Store {store_id} not found")
    wallet = await db.partner_store_wallets.find_one({"store_id": store_id}, {"_id": 0}) or {}
    return {"success": True, "store": store, "wallet": wallet}


# ═════════════════════════════════════════════════════════════════════
# PARTNER STORE SELF-VIEW ENDPOINTS
# ═════════════════════════════════════════════════════════════════════

@router.get("/self/{uid}")
async def store_self_view(uid: str):
    """
    Partner Store fetches its own profile + wallet balance for the dashboard.
    Caller UID must be a partner_store role. IDOR-protected minimally by
    matching linked_user_uid.
    """
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "role": 1, "partner_store_id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") != "partner_store":
        raise HTTPException(status_code=403, detail="Not a partner store account")
    store_id = user.get("partner_store_id")
    if not store_id:
        raise HTTPException(status_code=500, detail="Store profile link missing — contact admin")

    store = await db.partner_stores.find_one({"store_id": store_id}, {"_id": 0})
    wallet = await db.partner_store_wallets.find_one({"store_id": store_id}, {"_id": 0}) or {
        "prc_balance": 0.0,
        "lifetime_received_prc": 0.0,
        "lifetime_settled_prc": 0.0,
        "pending_settlement_prc": 0.0,
        "txn_count": 0,
    }

    # Today's collection (IST day boundary)
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    ist_now = now + timedelta(hours=5, minutes=30)
    today_start_ist = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc_iso = (today_start_ist - timedelta(hours=5, minutes=30)).replace(tzinfo=timezone.utc).isoformat()

    pipeline = [
        {"$match": {"store_id": store_id, "status": "success", "created_at": {"$gte": today_start_utc_iso}}},
        {"$group": {"_id": None, "sum_prc": {"$sum": "$prc_amount"}, "count": {"$sum": 1}}},
    ]
    today_agg = await db.partner_store_txns.aggregate(pipeline).to_list(length=1)
    today_prc = today_agg[0]["sum_prc"] if today_agg else 0.0
    today_count = today_agg[0]["count"] if today_agg else 0

    return {
        "success": True,
        "store": store,
        "wallet": wallet,
        "today_collection_prc": today_prc,
        "today_txn_count": today_count,
    }


@router.get("/self/{uid}/transactions")
async def store_self_transactions(
    uid: str,
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Recent user→store payments for this store."""
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "role": 1, "partner_store_id": 1})
    if not user or user.get("role") != "partner_store":
        raise HTTPException(status_code=403, detail="Not a partner store account")
    store_id = user["partner_store_id"]

    query: dict = {"store_id": store_id}
    if cursor:
        query["created_at"] = {"$lt": cursor}
    docs = await db.partner_store_txns.find(query, {"_id": 0}).sort("created_at", -1).limit(limit + 1).to_list(length=limit + 1)
    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = docs[-1]["created_at"] if (has_more and docs) else None

    # Mask user names/uids per spec
    for d in docs:
        uu = d.get("user_uid", "")
        if uu:
            d["user_uid_masked"] = uu[:6] + "***" if len(uu) > 6 else "***"
        un = d.get("user_name", "")
        if un:
            d["user_name_masked"] = un[0] + "***" if len(un) > 0 else "***"

    return {"success": True, "transactions": docs, "next_cursor": next_cursor, "has_more": has_more}


# ═════════════════════════════════════════════════════════════════════
# SLICE 2 — PAYMENT ENGINE (User → Partner Store)
# ═════════════════════════════════════════════════════════════════════
# Rules (Q_C=c2):
#   • ₹5,000 max per single payment
#   • ₹20,000 max per user per day (across all stores)
#   • Max 3 payments from same user → same store per day (velocity guard)
#   • Atomic: user PRC debit + store wallet credit + txn row inserted
#     inside a MongoDB session (multi-doc transaction).
#   • Idempotent via `client_txn_id`.

MAX_TXN_PRC = 5000.0
MAX_USER_DAILY_PRC = 20000.0
MAX_USER_STORE_DAILY_COUNT = 3


class PartnerStoreLookupRequest(BaseModel):
    mobile: Optional[str] = Field(None, pattern=r"^\d{10}$")
    store_id: Optional[str] = Field(None, pattern=r"^\d{6}$")


class PartnerStorePayRequest(BaseModel):
    user_uid: str
    mobile: Optional[str] = Field(None, pattern=r"^\d{10}$")
    store_id: Optional[str] = Field(None, pattern=r"^\d{6}$")
    prc_amount: float = Field(..., gt=0, le=MAX_TXN_PRC)
    client_txn_id: str = Field(..., min_length=8, max_length=64)
    remark: Optional[str] = Field(None, max_length=120)


@router.post("/pay/lookup")
async def payment_lookup_store(body: PartnerStoreLookupRequest):
    """User looks up a store by mobile OR 6-digit store_id."""
    if not body.mobile and not body.store_id:
        raise HTTPException(status_code=400, detail="Provide mobile or store_id")
    query = {"mobile_number": body.mobile} if body.mobile else {"store_id": body.store_id}
    store = await db.partner_stores.find_one(query, {
        "_id": 0, "store_id": 1, "business_name": 1, "owner_name": 1,
        "address": 1, "business_type": 1, "verification_status": 1, "is_active": 1,
    })
    if not store:
        raise HTTPException(status_code=404, detail="Partner Store not registered")
    if not store.get("is_active") or store.get("verification_status") != "verified":
        raise HTTPException(status_code=403, detail="Partner Store is not active for payments")
    return {"success": True, "store": store}


@router.post("/pay")
async def pay_partner_store(body: PartnerStorePayRequest):
    """
    Atomically transfer PRC from user → partner store wallet.
    Idempotent — same client_txn_id short-circuits to the previous result.
    """
    if body.prc_amount <= 0 or body.prc_amount > MAX_TXN_PRC:
        raise HTTPException(status_code=400, detail=f"Amount must be between 0 and {MAX_TXN_PRC} PRC")
    if not body.mobile and not body.store_id:
        raise HTTPException(status_code=400, detail="Provide mobile or store_id")

    # 1) Idempotency check
    existing = await db.partner_store_txns.find_one({"client_txn_id": body.client_txn_id}, {"_id": 0})
    if existing:
        return {"success": True, "idempotent": True, "transaction": existing}

    # 2) Resolve store
    query = {"mobile_number": body.mobile} if body.mobile else {"store_id": body.store_id}
    store = await db.partner_stores.find_one(query, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Partner Store not registered")
    if not store.get("is_active") or store.get("verification_status") != "verified":
        raise HTTPException(status_code=403, detail="Partner Store is not active for payments")
    store_id = store["store_id"]

    # 3) Resolve user
    user = await db.users.find_one({"uid": body.user_uid}, {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "prc_balance": 1, "role": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "partner_store":
        raise HTTPException(status_code=403, detail="Partner Store accounts cannot make payments to other stores")
    if user["uid"] == store.get("linked_user_uid"):
        raise HTTPException(status_code=400, detail="Cannot pay to your own store")
    balance = float(user.get("prc_balance") or 0)
    if balance < body.prc_amount:
        raise HTTPException(status_code=400, detail=f"Insufficient PRC balance (have {balance:.2f})")

    # 4) Velocity limits — IST day window
    from datetime import timedelta as _td
    now = datetime.now(timezone.utc)
    ist_now = now + _td(hours=5, minutes=30)
    ist_midnight = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_start_utc_iso = (ist_midnight - _td(hours=5, minutes=30)).replace(tzinfo=timezone.utc).isoformat()

    daily_pipe = [
        {"$match": {"user_uid": body.user_uid, "status": "success", "created_at": {"$gte": day_start_utc_iso}}},
        {"$group": {"_id": None, "total_prc": {"$sum": "$prc_amount"}}},
    ]
    daily_agg = await db.partner_store_txns.aggregate(daily_pipe).to_list(length=1)
    daily_spent = daily_agg[0]["total_prc"] if daily_agg else 0.0
    if daily_spent + body.prc_amount > MAX_USER_DAILY_PRC:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit exceeded — you've already paid {daily_spent:.2f} PRC today (cap {MAX_USER_DAILY_PRC:.0f})",
        )

    same_store_count = await db.partner_store_txns.count_documents({
        "user_uid": body.user_uid,
        "store_id": store_id,
        "status": "success",
        "created_at": {"$gte": day_start_utc_iso},
    })
    if same_store_count >= MAX_USER_STORE_DAILY_COUNT:
        raise HTTPException(
            status_code=429,
            detail=f"You've already made {MAX_USER_STORE_DAILY_COUNT} payments to this store today. Try tomorrow.",
        )

    # 5) Atomic transfer — use find_one_and_update with balance guard for
    #    user (single-doc atomic) + $inc for wallet + insert txn row.
    #    A single-doc guard on the user prevents overdraw races.
    now_iso = now.isoformat()
    txn_id = f"PST-{uuid.uuid4().hex[:12].upper()}"

    debit = await db.users.find_one_and_update(
        {"uid": body.user_uid, "prc_balance": {"$gte": body.prc_amount}},
        {"$inc": {"prc_balance": -body.prc_amount}, "$set": {"updated_at": now_iso}},
        projection={"_id": 0, "prc_balance": 1, "name": 1, "mobile": 1},
        return_document=True,
    )
    if not debit:
        # Race with another concurrent debit — balance no longer sufficient
        raise HTTPException(status_code=409, detail="Balance changed — please retry")

    # Credit store wallet
    await db.partner_store_wallets.update_one(
        {"store_id": store_id},
        {
            "$inc": {
                "prc_balance": body.prc_amount,
                "lifetime_received_prc": body.prc_amount,
                "txn_count": 1,
            },
            "$set": {"updated_at": now_iso},
        },
        upsert=True,
    )

    # Insert txn row
    txn_doc = {
        "txn_id": txn_id,
        "client_txn_id": body.client_txn_id,
        "store_id": store_id,
        "store_name": store["business_name"],
        "user_uid": body.user_uid,
        "user_name": user.get("name") or "Customer",
        "user_mobile": user.get("mobile"),
        "prc_amount": float(body.prc_amount),
        "remark": body.remark,
        "status": "success",
        "settlement_status": "pending",  # → 'requested' → 'settled'
        "created_at": now_iso,
    }
    try:
        await db.partner_store_txns.insert_one(txn_doc)
    except Exception:
        # Idempotency collision — refund user AND revert wallet credit
        # (otherwise the store retains a phantom credit).
        await db.users.update_one({"uid": body.user_uid}, {"$inc": {"prc_balance": body.prc_amount}})
        await db.partner_store_wallets.update_one(
            {"store_id": store_id},
            {"$inc": {
                "prc_balance": -body.prc_amount,
                "lifetime_received_prc": -body.prc_amount,
                "txn_count": -1,
            }},
        )
        existing = await db.partner_store_txns.find_one({"client_txn_id": body.client_txn_id}, {"_id": 0})
        return {"success": True, "idempotent": True, "transaction": existing}

    # 6) Notifications
    await db.notifications.insert_many([
        {
            "notification_id": str(uuid.uuid4()),
            "user_id": body.user_uid,
            "user_uid": body.user_uid,
            "type": "partner_store_payment_success",
            "title": "✅ Payment Successful",
            "message": f"You paid {body.prc_amount:.2f} PRC to {store['business_name']} (Store {store_id}).",
            "created_at": now_iso,
            "read": False,
            "is_read": False,
            "txn_id": txn_id,
        },
        {
            "notification_id": str(uuid.uuid4()),
            "user_id": store["linked_user_uid"],
            "user_uid": store["linked_user_uid"],
            "type": "partner_store_payment_received",
            "title": "💰 PRC Payment Received",
            "message": (
                f"You received {body.prc_amount:.2f} PRC from "
                f"{(user.get('name') or 'Customer')[:1]}*** (mobile ending {(user.get('mobile') or '')[-4:]})."
            ),
            "created_at": now_iso,
            "read": False,
            "is_read": False,
            "txn_id": txn_id,
        },
    ])

    # Drop the txn doc's Mongo _id if attached in-place
    txn_doc.pop("_id", None)
    return {
        "success": True,
        "idempotent": False,
        "transaction": txn_doc,
        "new_user_balance": float(debit.get("prc_balance") or 0),
    }


@router.get("/user/{uid}/transactions")
async def user_partner_store_transactions(
    uid: str,
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """User's history of Partner Store payments."""
    query: dict = {"user_uid": uid}
    if cursor:
        query["created_at"] = {"$lt": cursor}
    docs = await db.partner_store_txns.find(query, {"_id": 0}).sort("created_at", -1).limit(limit + 1).to_list(length=limit + 1)
    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = docs[-1]["created_at"] if (has_more and docs) else None
    return {"success": True, "transactions": docs, "next_cursor": next_cursor, "has_more": has_more}


# ═════════════════════════════════════════════════════════════════════
# SLICE 3 — SETTLEMENT ENGINE (Store → Admin → Bank)
# ═════════════════════════════════════════════════════════════════════
# Reuses the existing `bank_transfer_requests` collection with
# source_type='partner_store' + partner_store_id (Q5=n). Admin can view
# these via /admin/bank-transfers with the source filter.

class PartnerStoreSettlementRequest(BaseModel):
    uid: str  # store's linked user uid (pstore-XXXXXX)
    prc_amount: float = Field(..., gt=0, description="PRC amount to settle")
    remark: Optional[str] = Field(None, max_length=200)


@router.post("/settlement/request")
async def partner_store_settlement_request(body: PartnerStoreSettlementRequest):
    """
    Partner Store requests settlement from its wallet balance.
    Deducts from wallet.prc_balance → wallet.pending_settlement_prc,
    creates a `bank_transfer_requests` row for admin approval.
    """
    user = await db.users.find_one({"uid": body.uid}, {"_id": 0, "role": 1, "partner_store_id": 1})
    if not user or user.get("role") != "partner_store":
        raise HTTPException(status_code=403, detail="Not a partner store account")
    store_id = user.get("partner_store_id")
    if not store_id:
        raise HTTPException(status_code=500, detail="Store profile link missing")

    store = await db.partner_stores.find_one({"store_id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Store profile not found")
    if not store.get("is_active"):
        raise HTTPException(status_code=403, detail="Store must be verified & active to request settlement")

    wallet = await db.partner_store_wallets.find_one({"store_id": store_id}, {"_id": 0}) or {}
    balance = float(wallet.get("prc_balance") or 0)
    if body.prc_amount > balance:
        raise HTTPException(
            status_code=400,
            detail=f"Requested {body.prc_amount:.2f} exceeds wallet balance {balance:.2f}",
        )

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    request_id = f"BTR-PSTORE-{uuid.uuid4().hex[:10].upper()}"

    # Move funds from wallet.prc_balance → wallet.pending_settlement_prc atomically
    moved = await db.partner_store_wallets.find_one_and_update(
        {"store_id": store_id, "prc_balance": {"$gte": body.prc_amount}},
        {
            "$inc": {
                "prc_balance": -body.prc_amount,
                "pending_settlement_prc": body.prc_amount,
            },
            "$set": {"updated_at": now_iso},
        },
        return_document=True,
    )
    if not moved:
        raise HTTPException(status_code=409, detail="Wallet balance changed — please retry")

    # Compute INR amount using admin-configured rate (Q_E=e1)
    rate_cfg = await db.app_settings.find_one({"_id": "prc_inr_rate"}, {"_id": 0, "value": 1})
    prc_to_inr_rate = float(rate_cfg.get("value") or 1.0) if rate_cfg else 1.0
    inr_amount = round(body.prc_amount * prc_to_inr_rate, 2)

    # Create bank_transfer_requests row for admin
    req_doc = {
        "request_id": request_id,
        "source_type": "partner_store",
        "partner_store_id": store_id,
        "user_id": body.uid,
        "user_name": store["business_name"],
        "user_phone": store["mobile_number"],
        "prc_deducted": body.prc_amount,
        "withdrawal_amount": inr_amount,
        "prc_to_inr_rate": prc_to_inr_rate,
        "account_holder_name": store["bank_account_holder"],
        "account_number": store["bank_account_number"],
        "ifsc_code": store["bank_ifsc"],
        "bank_name": None,
        "status": "pending",
        "remark": body.remark,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.bank_transfer_requests.insert_one(req_doc)

    # Notification to store
    await db.notifications.insert_one({
        "notification_id": str(uuid.uuid4()),
        "user_id": body.uid,
        "user_uid": body.uid,
        "type": "partner_store_settlement_requested",
        "title": "⏳ Settlement Request Submitted",
        "message": (
            f"Your settlement request for {body.prc_amount:.2f} PRC "
            f"(₹{inr_amount:.2f}) is queued for admin approval. "
            f"Request ID: {request_id}"
        ),
        "created_at": now_iso,
        "read": False,
        "is_read": False,
        "request_id": request_id,
    })

    req_doc.pop("_id", None)
    return {"success": True, "request": req_doc}


@router.get("/settlement/history/{uid}")
async def partner_store_settlement_history(
    uid: str,
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "role": 1, "partner_store_id": 1})
    if not user or user.get("role") != "partner_store":
        raise HTTPException(status_code=403, detail="Not a partner store account")
    store_id = user.get("partner_store_id")

    query: dict = {"source_type": "partner_store", "partner_store_id": store_id}
    if cursor:
        query["created_at"] = {"$lt": cursor}
    docs = await db.bank_transfer_requests.find(query, {"_id": 0}).sort("created_at", -1).limit(limit + 1).to_list(length=limit + 1)
    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = docs[-1]["created_at"] if (has_more and docs) else None
    return {"success": True, "requests": docs, "next_cursor": next_cursor, "has_more": has_more}
