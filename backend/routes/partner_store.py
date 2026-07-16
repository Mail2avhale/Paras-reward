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
    """
    doc = await db.counters.find_one_and_update(
        {"_id": "partner_store_id_seq"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,  # pymongo.ReturnDocument.AFTER
    )
    value = doc.get("value", 0)
    if value < STORE_ID_START:
        # First allocation — bump to start value.
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
    await db.users.insert_one({
        "uid": store_uid,
        "name": body.owner_name,
        "mobile": body.mobile_number,
        "email": body.email,
        "pin_hash": _hash_pin(body.login_pin),
        "role": "partner_store",
        "partner_store_id": store_id,
        "subscription_plan": "partner_store",
        "kyc_status": "verified" if False else "pending",
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
