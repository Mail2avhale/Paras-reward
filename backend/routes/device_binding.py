"""
Device Binding — 1-per-lifetime enforcement (Feb 7 2026)
=========================================================
User-specified spec (see conversation on Feb 7):
  Q1 = c  — Once a device is bound to a user, that binding is PERMANENT.
             Any other user attempting login/signup on that device is blocked.
             Only an admin (or the bound user themselves, via OTP) can unbind.
  Q2 = a  — Enforce on native Android app only. Web browser is a hostile
             environment for reliable fingerprinting; we skip enforcement
             (device_id from web falls back to a soft localStorage cookie).
  Q3 = c  — Retro-scan is offered but auto-block is opt-in via a separate
             admin endpoint (safer than aggressive default that could brick
             family-sharing accounts).
  Q4 = a  — Self-service unbind: user proves ownership via OTP to their
             registered mobile/email, admin PIN is NOT required.
  Q5 = c  — Full audit: device_model, os_version, ip, user_agent are stored;
             a background pass auto-flags suspicious patterns (same IP +
             model + rapid multi-signup).

Feature flag: `db.app_settings.device_binding.enabled` (default False).
Signup + login helpers below always run their diagnostics but only ENFORCE
when the flag is True. This is a safe rollout — you toggle it on from the
admin panel once retro-scan looks clean.

Native device_id source (recommended by @capacitor/device):
    Android → getId().identifier   (Android_ID, opaque + stable per install)
    iOS     → getId().identifier   (identifierForVendor)
Web fallback:
    A random UUID cached in localStorage; enforcement SKIPPED for these
    by policy Q2=a.

Bindings live in db.device_bindings with unique index on
    (device_id, active=True)
and are treated as append-only history when unbound (we set active=False +
unbound_at rather than deleting, so audit is preserved).
"""

from __future__ import annotations

import logging
import os
import re
import secrets
import string
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

db = None  # bound at startup by set_db()

router = APIRouter(prefix="/device-binding", tags=["Device Binding"])
admin_router = APIRouter(prefix="/admin/device-binding", tags=["Admin — Device Binding"])


def set_db(mongo_db):
    """Called from server.py startup."""
    global db
    db = mongo_db


# ────────────────────────────────────────────────────────────────────────
# FEATURE FLAG
# ────────────────────────────────────────────────────────────────────────
# 5-minute in-memory cache so we don't hammer app_settings on every login.
_FLAG_CACHE: dict = {"value": None, "expires_at": 0.0}
_FLAG_TTL = 300


async def is_enforcement_enabled() -> bool:
    """Read the master switch. Defaults to False when the doc doesn't
    exist (safe default — enforcement is off until an admin flips it on).
    """
    if _FLAG_CACHE["expires_at"] > time.time() and _FLAG_CACHE["value"] is not None:
        return bool(_FLAG_CACHE["value"])
    if db is None:
        return False
    try:
        doc = await db.app_settings.find_one(
            {"key": "device_binding"}, {"_id": 0, "enabled": 1}
        )
        enabled = bool(doc and doc.get("enabled") is True)
    except Exception as e:
        logger.warning(f"[DEVICE-BIND] flag lookup failed, defaulting OFF: {e}")
        enabled = False
    _FLAG_CACHE["value"] = enabled
    _FLAG_CACHE["expires_at"] = time.time() + _FLAG_TTL
    return enabled


DEFAULT_MAX_USERS_PER_DEVICE = 2

async def get_max_users_per_device() -> int:
    """Config: how many DISTINCT users are allowed to share one device.
    Default 2 — a device holding a 3rd user gets blocked.
    Admin can tune via /api/admin/device-binding/max-users."""
    if db is None:
        return DEFAULT_MAX_USERS_PER_DEVICE
    try:
        doc = await db.app_settings.find_one(
            {"key": "device_binding"}, {"_id": 0, "max_users_per_device": 1}
        )
        if doc and isinstance(doc.get("max_users_per_device"), int) and doc["max_users_per_device"] >= 1:
            return int(doc["max_users_per_device"])
    except Exception:
        pass
    return DEFAULT_MAX_USERS_PER_DEVICE


def _clear_flag_cache():
    _FLAG_CACHE["value"] = None
    _FLAG_CACHE["expires_at"] = 0.0


# ────────────────────────────────────────────────────────────────────────
# DEVICE_ID VALIDATION
# ────────────────────────────────────────────────────────────────────────
# We only enforce on TRUSTED device_ids. A trusted id is one produced by
# the native @capacitor/device plugin — it comes prefixed with "AND-" or
# "IOS-" from the frontend adapter. Anything else (browser fallback with
# "DEV-" prefix or empty / "unknown") is treated as an untrusted id and
# enforcement is skipped, per Q2=a.
# Native id format: `AND-` or `IOS-` prefix, then 6-128 alphanumeric/hyphen
# chars. Max bound guards against DB bloat if a hostile client sends a
# 500-char payload.
NATIVE_DEVICE_ID_PATTERN = re.compile(r"^(AND|IOS)-[A-Za-z0-9\-]{6,128}$")


def is_trusted_device_id(device_id: Optional[str]) -> bool:
    if not device_id:
        return False
    d = str(device_id).strip()
    if d in ("unknown", "", "null", "undefined"):
        return False
    return bool(NATIVE_DEVICE_ID_PATTERN.match(d))


# ────────────────────────────────────────────────────────────────────────
# CORE HELPERS — called from register / login
# ────────────────────────────────────────────────────────────────────────
class BindResult:
    """Simple result object so the caller can short-circuit cleanly."""
    __slots__ = ("allowed", "reason", "bound_to_uid", "was_new_binding")

    def __init__(self, allowed: bool, reason: str = "",
                 bound_to_uid: Optional[str] = None,
                 was_new_binding: bool = False):
        self.allowed = allowed
        self.reason = reason
        self.bound_to_uid = bound_to_uid
        self.was_new_binding = was_new_binding

    def to_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "reason": self.reason,
            "bound_to_uid": self.bound_to_uid,
            "was_new_binding": self.was_new_binding,
        }


async def check_and_bind_device(
    *,
    uid: str,
    device_id: Optional[str],
    device_model: Optional[str] = None,
    os_version: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    event: str = "login",  # "login" | "register"
) -> BindResult:
    """The single choke point every signup + login must call.

    Behavior:
      1. Untrusted device_id (web / unknown) → ALLOW, no binding written.
      2. Trusted id + no existing binding → CREATE binding, ALLOW.
      3. Trusted id + existing binding to SAME uid → refresh last_seen, ALLOW.
      4. Trusted id + existing binding to DIFFERENT uid → ENFORCE per flag:
           enforcement ON  → BLOCK
           enforcement OFF → ALLOW but log audit warning

    Idempotent + safe to call multiple times per session.
    """
    if db is None:
        return BindResult(True, "db_not_initialised")

    # Rule 1 — never enforce on untrusted ids.
    if not is_trusted_device_id(device_id):
        return BindResult(True, "untrusted_device_id_skipped")

    now_iso = datetime.now(timezone.utc).isoformat()

    # Look up ALL active bindings for this device (0..N).
    # New rule (Aug 2026): up to `max_users_per_device` distinct users may
    # share the same device. Only when a NEW (N+1)th user tries to bind is
    # the login blocked.
    active_bindings = await db.device_bindings.find(
        {"device_id": device_id, "active": True},
        {"_id": 0, "user_uid": 1, "bound_at": 1},
    ).to_list(20)

    max_users = await get_max_users_per_device()

    # If THIS user is already one of the active bindings — just refresh.
    for b in active_bindings:
        if b.get("user_uid") == uid:
            await db.device_bindings.update_one(
                {"device_id": device_id, "user_uid": uid, "active": True},
                {"$set": {
                    "last_seen_at": now_iso,
                    "last_ip": ip_address,
                    "last_user_agent": (user_agent or "")[:200],
                }, "$inc": {"login_count": 1}}
            )
            return BindResult(True, "existing_owner", bound_to_uid=uid)

    # New user for this device — check if capacity allows.
    if len(active_bindings) < max_users:
        try:
            await db.device_bindings.insert_one({
                "binding_id": str(uuid.uuid4()),
                "device_id": device_id,
                "user_uid": uid,
                "device_model": device_model,
                "os_version": os_version,
                "bound_at": now_iso,
                "last_seen_at": now_iso,
                "bound_via_event": event,
                "bound_ip": ip_address,
                "bound_user_agent": (user_agent or "")[:200],
                "active": True,
            })
        except Exception as e:
            logger.warning(f"[DEVICE-BIND] insert race for {device_id}/{uid}: {e}")
            # Re-read — someone else may have claimed the slot in the same ms
            active_bindings = await db.device_bindings.find(
                {"device_id": device_id, "active": True},
                {"_id": 0, "user_uid": 1},
            ).to_list(20)
            for b in active_bindings:
                if b.get("user_uid") == uid:
                    return BindResult(True, "insert_race_resolved", bound_to_uid=uid)
            # Race lost + capacity now full — fall through to collision.
            if len(active_bindings) >= max_users:
                pass   # will hit collision block below
            else:
                return BindResult(True, "insert_race_resolved")
        else:
            # Stamp primary_device_id on user doc (first-ever device only)
            await db.users.update_one(
                {"uid": uid, "primary_device_id": {"$exists": False}},
                {"$set": {
                    "primary_device_id": device_id,
                    "primary_device_bound_at": now_iso,
                }}
            )
            return BindResult(True, "new_binding_created",
                              bound_to_uid=uid, was_new_binding=True)

    # Capacity FULL — this is a real collision (attempting a (N+1)th user).
    # Log audit + enforce per flag.
    bound_uid = active_bindings[0]["user_uid"] if active_bindings else "unknown"
    enforcement_on = await is_enforcement_enabled()
    try:
        await db.device_binding_collisions.insert_one({
            "collision_id": str(uuid.uuid4()),
            "device_id": device_id,
            "attempted_uid": uid,
            "bound_uid": bound_uid,
            "bound_uids": [b.get("user_uid") for b in active_bindings],
            "event": event,
            "enforcement_on": enforcement_on,
            "max_users_per_device": max_users,
            "ip_address": ip_address,
            "user_agent": (user_agent or "")[:200],
            "device_model": device_model,
            "os_version": os_version,
            "occurred_at": now_iso,
        })
    except Exception as e:
        logger.warning(f"[DEVICE-BIND] collision log failed: {e}")

    if enforcement_on:
        return BindResult(
            False,
            "device_already_bound_to_other_user",
            bound_to_uid=bound_uid,
        )
    # Soft mode — allow but audit.
    return BindResult(
        True,
        "collision_soft_allowed",
        bound_to_uid=bound_uid,
    )


# ────────────────────────────────────────────────────────────────────────
# SELF-SERVICE UNBIND (OTP-based, no admin required)
# ────────────────────────────────────────────────────────────────────────
# Reuse pattern of forgot-pin OTP: user provides their identifier +
# device_id-they-want-to-unbind, we send OTP to their registered mobile,
# they submit OTP → binding marked inactive → they can now bind a new
# device on next login.
class UnbindOtpRequest(BaseModel):
    identifier: str  # email OR mobile of the user who owns the binding
    device_id: str   # the OLD device_id they no longer have access to


class UnbindOtpVerify(BaseModel):
    identifier: str
    device_id: str
    otp: str


async def _find_user_by_identifier(identifier: str) -> Optional[dict]:
    idn = identifier.strip()
    q = {"$or": [
        {"uid": idn},
        {"mobile": idn},
        {"email": {"$regex": f"^{re.escape(idn)}$", "$options": "i"}},
    ]}
    return await db.users.find_one(q, {
        "_id": 0, "uid": 1, "mobile": 1, "email": 1, "name": 1,
    })


@router.post("/unbind/request-otp")
async def request_unbind_otp(body: UnbindOtpRequest):
    """User initiates an OTP flow to unbind their old device.
    OTP is stored in db.device_unbind_otps with 10-minute expiry.
    Actual OTP send goes through the existing SMS gateway — for now we
    reuse the same channel that forgot-pin uses (mobile SMS).
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    user = await _find_user_by_identifier(body.identifier)
    if not user:
        # Deliberately vague to avoid enumeration.
        raise HTTPException(status_code=404, detail="Account not found")

    binding = await db.device_bindings.find_one(
        {"device_id": body.device_id, "active": True},
        {"_id": 0, "user_uid": 1, "bound_at": 1},
    )
    if not binding:
        raise HTTPException(status_code=404, detail="No active binding for this device")
    if binding["user_uid"] != user["uid"]:
        # Only the owner can unbind through this flow.
        raise HTTPException(
            status_code=403,
            detail="This device is bound to a different account. Please contact support."
        )

    # Cryptographically-random 6-digit OTP using secrets (not uuid) — safe
    # against adversaries who might otherwise brute-force via retry.
    otp = "".join(secrets.choice(string.digits) for _ in range(6))
    now = datetime.now(timezone.utc)
    await db.device_unbind_otps.update_one(
        {"user_uid": user["uid"], "device_id": body.device_id},
        {"$set": {
            "user_uid": user["uid"],
            "device_id": body.device_id,
            "otp": otp,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(minutes=10)).isoformat(),
            "attempts": 0,
        }},
        upsert=True,
    )

    # Best-effort SMS through whichever gateway is wired; wrap so we don't
    # leak internals if the module is absent.
    try:
        from routes.otp_service import send_sms_otp
        await send_sms_otp(user.get("mobile"), otp,
                           purpose="device_unbind")
    except Exception as e:
        logger.info(f"[DEVICE-BIND] SMS send skipped/failed (OTP still valid via email/support): {e}")

    return {
        "success": True,
        "message": (
            "OTP sent to your registered mobile. Enter it within 10 minutes "
            "to release your old device."
        ),
        "otp_hint": f"...{user.get('mobile', '')[-4:]}" if user.get("mobile") else None,
    }


@router.post("/unbind/verify-otp")
async def verify_unbind_otp(body: UnbindOtpVerify):
    """Verify the OTP and, if valid, mark the binding inactive."""
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    user = await _find_user_by_identifier(body.identifier)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    otp_doc = await db.device_unbind_otps.find_one(
        {"user_uid": user["uid"], "device_id": body.device_id},
        {"_id": 0}
    )
    if not otp_doc:
        raise HTTPException(status_code=400, detail="No OTP request found — request a new OTP")

    # Rate-limit attempts
    attempts = int(otp_doc.get("attempts", 0))
    if attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a fresh OTP.")

    # Expiry
    try:
        exp = datetime.fromisoformat(otp_doc["expires_at"])
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="OTP expired — request a new one")
    except HTTPException:
        raise
    except Exception:
        pass

    if str(body.otp).strip() != str(otp_doc["otp"]):
        await db.device_unbind_otps.update_one(
            {"user_uid": user["uid"], "device_id": body.device_id},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    # Success — mark binding inactive + drop otp doc
    now_iso = datetime.now(timezone.utc).isoformat()
    result = await db.device_bindings.update_one(
        {"device_id": body.device_id, "active": True, "user_uid": user["uid"]},
        {"$set": {
            "active": False,
            "unbound_at": now_iso,
            "unbound_reason": "self_service_otp",
        }}
    )
    await db.device_unbind_otps.delete_one(
        {"user_uid": user["uid"], "device_id": body.device_id}
    )
    # Clear primary_device_id if it matched
    await db.users.update_one(
        {"uid": user["uid"], "primary_device_id": body.device_id},
        {"$unset": {"primary_device_id": "", "primary_device_bound_at": ""}}
    )

    return {
        "success": True,
        "unbound_count": result.modified_count,
        "message": (
            "Old device unbound successfully. Please log in on your new device "
            "now — it will be bound automatically."
        ),
    }


# ────────────────────────────────────────────────────────────────────────
# CURRENT USER — see their own bindings
# ────────────────────────────────────────────────────────────────────────
@router.get("/my-bindings/{uid}")
async def get_my_bindings(uid: str):
    """List active + inactive bindings for a user (self-service view)."""
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    rows = await db.device_bindings.find(
        {"user_uid": uid},
        {"_id": 0, "device_id": 1, "device_model": 1, "os_version": 1,
         "bound_at": 1, "last_seen_at": 1, "active": 1, "unbound_at": 1,
         "unbound_reason": 1, "login_count": 1}
    ).sort("bound_at", -1).to_list(50)
    active = [r for r in rows if r.get("active")]
    return {
        "success": True,
        "uid": uid,
        "active_bindings": active,
        "history": rows,
        "has_active_binding": len(active) > 0,
    }


# ────────────────────────────────────────────────────────────────────────
# ADMIN — feature-flag toggle, retro-scan, list, unbind
# ────────────────────────────────────────────────────────────────────────
class FlagToggle(BaseModel):
    admin_id: str
    enabled: bool


@admin_router.get("/flag")
async def admin_get_flag(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    _require_admin(x_admin_pin)
    enabled = await is_enforcement_enabled()
    doc = await db.app_settings.find_one(
        {"key": "device_binding"},
        {"_id": 0, "updated_at": 1, "updated_by": 1, "enabled": 1},
    )
    return {"success": True, "enabled": enabled, "stored_doc": doc}


@admin_router.post("/flag")
async def admin_set_flag(
    body: FlagToggle,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    _require_admin(x_admin_pin)
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one(
        {"key": "device_binding"},
        {"$set": {
            "key": "device_binding",
            "enabled": bool(body.enabled),
            "updated_at": now_iso,
            "updated_by": body.admin_id,
        }},
        upsert=True,
    )
    _clear_flag_cache()
    return {"success": True, "enabled": bool(body.enabled)}


@admin_router.get("/retro-scan")
async def admin_retro_scan(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
    min_accounts: int = 2,
    limit: int = 500,
):
    """READ-ONLY scan. Groups active users by device_id (from users.device_id)
    and returns clusters where the same device_id shows up on 2+ accounts.
    Pure diagnostic — no writes, no suspensions.
    """
    _require_admin(x_admin_pin)
    pipeline = [
        {"$match": {"device_id": {"$exists": True, "$nin": [None, "", "unknown"]}}},
        {"$group": {
            "_id": "$device_id",
            "count": {"$sum": 1},
            "users": {"$push": {
                "uid": "$uid", "name": "$name", "mobile": "$mobile",
                "email": "$email", "subscription_plan": "$subscription_plan",
                "created_at": "$created_at", "last_login": "$last_login",
            }},
        }},
        {"$match": {"count": {"$gte": min_accounts}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    clusters = await db.users.aggregate(pipeline).to_list(limit)

    # Only surface clusters where at least one uid uses a trusted (native)
    # device_id — random localStorage UUIDs are noise for this feature.
    surfaced = [c for c in clusters if is_trusted_device_id(c["_id"])]
    return {
        "success": True,
        "min_accounts_filter": min_accounts,
        "total_clusters_found": len(clusters),
        "trusted_clusters_found": len(surfaced),
        "clusters": [
            {
                "device_id": c["_id"],
                "account_count": c["count"],
                "users": c["users"],
            } for c in surfaced
        ],
        "note": (
            "This is DRY-RUN only. To enforce, either (a) toggle the master "
            "flag ON via /flag and let future logins collide, or (b) call "
            "/retro-block below to auto-suspend all but the earliest account "
            "per device."
        ),
    }


class RetroBlockRequest(BaseModel):
    admin_id: str
    device_ids: Optional[list] = None   # None = all trusted collisions
    dry_run: bool = True


@admin_router.post("/retro-block")
async def admin_retro_block(
    body: RetroBlockRequest,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """For each colliding device, KEEP the earliest-created account and
    mark the newer ones as `device_binding_locked=True` (a soft flag —
    login endpoint rejects users carrying it with a friendly message).

    Dry-run first, apply after review.
    """
    _require_admin(x_admin_pin)

    filter_ids = body.device_ids or None

    # Pull the clusters
    match = {"device_id": {"$exists": True, "$nin": [None, "", "unknown"]}}
    if filter_ids:
        match["device_id"] = {"$in": filter_ids}

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$device_id",
            "count": {"$sum": 1},
            "users": {"$push": {
                "uid": "$uid", "name": "$name", "mobile": "$mobile",
                "created_at": "$created_at",
            }},
        }},
        {"$match": {"count": {"$gte": 2}}},
    ]
    clusters = await db.users.aggregate(pipeline).to_list(1000)

    to_suspend = []
    to_keep = []
    for c in clusters:
        if not is_trusted_device_id(c["_id"]):
            continue
        # Earliest created wins
        sorted_users = sorted(
            c["users"],
            key=lambda u: str(u.get("created_at") or ""),
        )
        keeper = sorted_users[0]
        to_keep.append({"device_id": c["_id"], "kept_uid": keeper.get("uid")})
        for other in sorted_users[1:]:
            to_suspend.append({
                "device_id": c["_id"],
                "uid": other.get("uid"),
                "name": other.get("name"),
                "mobile": other.get("mobile"),
                "created_at": other.get("created_at"),
                "reason": "device_binding_retro_block",
            })

    if not body.dry_run and to_suspend:
        now_iso = datetime.now(timezone.utc).isoformat()
        uids = [x["uid"] for x in to_suspend if x.get("uid")]
        if uids:
            await db.users.update_many(
                {"uid": {"$in": uids}},
                {"$set": {
                    "device_binding_locked": True,
                    "device_binding_locked_at": now_iso,
                    "device_binding_locked_by": body.admin_id,
                    "device_binding_locked_reason": "retro_block_same_device",
                }}
            )
            # Also insert canonical bindings for the kept users so future
            # login lookups short-circuit correctly.
            for k in to_keep:
                await db.device_bindings.update_one(
                    {"device_id": k["device_id"], "active": True},
                    {"$setOnInsert": {
                        "binding_id": str(uuid.uuid4()),
                        "device_id": k["device_id"],
                        "user_uid": k["kept_uid"],
                        "bound_at": now_iso,
                        "last_seen_at": now_iso,
                        "bound_via_event": "retro_block",
                        "active": True,
                    }},
                    upsert=True,
                )

    return {
        "success": True,
        "dry_run": body.dry_run,
        "clusters_evaluated": len(clusters),
        "kept_count": len(to_keep),
        "suspended_count": len(to_suspend),
        "kept_sample": to_keep[:20],
        "suspended_sample": to_suspend[:20],
        "message": (
            "DRY-RUN — nothing changed. Pass dry_run=false to apply."
            if body.dry_run else
            f"Locked {len(to_suspend)} accounts, kept {len(to_keep)} bindings."
        ),
    }


class AdminUnbindRequest(BaseModel):
    admin_id: str
    device_id: Optional[str] = None
    uid: Optional[str] = None
    identifier: Optional[str] = None  # NEW (Feb 8 2026) — mobile / email / uid all accepted
    reason: Optional[str] = "admin_manual"


@admin_router.post("/unbind")
async def admin_unbind(
    body: AdminUnbindRequest,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Admin-force unbind. Accepts ANY of:
       • `device_id`  — a specific AND-/IOS- device id (exact match)
       • `uid`        — user uid (exact match)
       • `identifier` — flexible: mobile OR email OR uid (Feb 8 2026)

    At least one must be provided; when both device_id and a user-side
    field are given they must match the same binding. Clears
    device_binding_locked on the affected user.
    """
    _require_admin(x_admin_pin)
    if not body.device_id and not body.uid and not body.identifier:
        raise HTTPException(
            status_code=400,
            detail="device_id, uid, or identifier required",
        )

    # Resolve `identifier` → uid, if the caller used the flexible field.
    resolved_uid = body.uid
    if not resolved_uid and body.identifier:
        u = await _find_user_by_identifier(body.identifier)
        if not u:
            raise HTTPException(
                status_code=404,
                detail=f"No user found for identifier: {body.identifier}",
            )
        resolved_uid = u["uid"]

    now_iso = datetime.now(timezone.utc).isoformat()
    q = {"active": True}
    if body.device_id:
        q["device_id"] = body.device_id
    if resolved_uid:
        q["user_uid"] = resolved_uid

    binding = await db.device_bindings.find_one(q, {"_id": 0})
    if not binding:
        # Even without an active binding, we still clear the lock flag —
        # a user may be `device_binding_locked=True` from the retro-block
        # sweep without ever having an active binding row.
        target_uid = resolved_uid
        cleared = 0
        if target_uid:
            res = await db.users.update_one(
                {"uid": target_uid, "device_binding_locked": True},
                {"$unset": {
                    "primary_device_id": "",
                    "primary_device_bound_at": "",
                    "device_binding_locked": "",
                    "device_binding_locked_at": "",
                    "device_binding_locked_reason": "",
                }}
            )
            cleared = res.modified_count
        if cleared > 0:
            return {
                "success": True,
                "unbound": None,
                "lock_cleared_only": True,
                "message": "No active binding, but device_binding_locked flag cleared.",
            }
        raise HTTPException(status_code=404, detail="No active binding matches")

    await db.device_bindings.update_one(
        {"device_id": binding["device_id"], "user_uid": binding["user_uid"], "active": True},
        {"$set": {
            "active": False,
            "unbound_at": now_iso,
            "unbound_reason": body.reason or "admin_manual",
            "unbound_by_admin": body.admin_id,
        }}
    )
    await db.users.update_one(
        {"uid": binding["user_uid"]},
        {"$unset": {
            "primary_device_id": "",
            "primary_device_bound_at": "",
            "device_binding_locked": "",
            "device_binding_locked_at": "",
            "device_binding_locked_reason": "",
        }}
    )
    return {"success": True, "unbound": binding}


@admin_router.get("/collisions")
async def admin_list_collisions(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
    limit: int = 100,
):
    _require_admin(x_admin_pin)
    rows = await db.device_binding_collisions.find(
        {}, {"_id": 0}
    ).sort("occurred_at", -1).to_list(limit)
    return {"success": True, "count": len(rows), "collisions": rows}


@admin_router.get("/suspicious")
async def admin_suspicious(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
    window_hours: int = 24,
    min_signups: int = 3,
):
    """Q5=c — Auto-flag: users signed up from same IP + same device_model
    within `window_hours`, count >= min_signups. Pure read, dry-run.
    """
    _require_admin(x_admin_pin)
    since = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()
    pipeline = [
        {"$match": {
            "created_at": {"$gte": since},
            "registration_ip": {"$exists": True, "$ne": None},
        }},
        {"$group": {
            "_id": {"ip": "$registration_ip"},
            "signup_count": {"$sum": 1},
            "users": {"$push": {
                "uid": "$uid", "name": "$name", "mobile": "$mobile",
                "created_at": "$created_at", "device_fingerprint": "$device_fingerprint",
            }},
        }},
        {"$match": {"signup_count": {"$gte": min_signups}}},
        {"$sort": {"signup_count": -1}},
        {"$limit": 100},
    ]
    clusters = await db.users.aggregate(pipeline).to_list(100)
    return {
        "success": True,
        "window_hours": window_hours,
        "min_signups": min_signups,
        "flagged_clusters": len(clusters),
        "clusters": clusters,
    }


# ────────────────────────────────────────────────────────────────────────
# INTERNAL — admin PIN guard


# ────────────────────────────────────────────────────────────────────────
# CHANGE-DEVICE REQUEST (Admin-approval flow — Feb 8 2026)
# ────────────────────────────────────────────────────────────────────────
# User has no SMS gateway configured, so instead of the OTP flow above,
# a support-desk-style request queue is used:
#
#   1. User submits `/change-device/request` from the "Change Device"
#      self-service page with their old device details + reason.
#   2. Row lands in db.device_change_requests with status=pending.
#   3. Admin sees pending queue in AdminDeviceBinding.js panel.
#   4. Admin clicks Approve → server unbinds the device + clears
#      device_binding_locked on the user, updates the request row.
#   5. Admin clicks Reject → row marked rejected with an optional reason.
#
# Rate limit: 3 open requests per user (prevents spam).
class ChangeDeviceRequest(BaseModel):
    identifier: str            # mobile OR email OR uid of the user
    old_device_model: Optional[str] = None
    reason: Optional[str] = None
    contact_notes: Optional[str] = None   # e.g. "call me on 987654..." for admin


@router.post("/change-device/request")
async def submit_change_device(body: ChangeDeviceRequest, request: Request):
    """Public — a user (potentially locked out) submits their case. No auth
    required because the whole point of this flow is that they cannot log
    in on their new device yet.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    user = await _find_user_by_identifier(body.identifier)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found for that identifier")

    # Anti-spam: max 3 open (pending) requests per user
    open_count = await db.device_change_requests.count_documents({
        "user_uid": user["uid"], "status": "pending",
    })
    if open_count >= 3:
        raise HTTPException(
            status_code=429,
            detail="You already have pending requests. Please wait for admin review.",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    req_id = str(uuid.uuid4())
    row = {
        "request_id": req_id,
        "user_uid": user["uid"],
        "user_name": user.get("name"),
        "user_mobile": user.get("mobile"),
        "user_email": user.get("email"),
        "old_device_model": body.old_device_model,
        "reason": body.reason,
        "contact_notes": body.contact_notes,
        "status": "pending",
        "requested_at": now_iso,
        "requester_ip": request.client.host if request.client else None,
        "requester_ua": (request.headers.get("user-agent") or "")[:200],
    }
    await db.device_change_requests.insert_one(row)
    logger.info(f"[DEVICE-BIND] change-request submitted for {user['uid']}: id={req_id}")

    return {
        "success": True,
        "request_id": req_id,
        "message": (
            "Your request has been submitted. Our team will review and "
            "approve it within 24 hours. You will receive a notification "
            "in the app once approved."
        ),
    }


@admin_router.get("/change-requests")
async def admin_list_change_requests(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
    status: str = "pending",
    limit: int = 50,
):
    _require_admin(x_admin_pin)
    q = {} if status == "all" else {"status": status}
    rows = await db.device_change_requests.find(q, {"_id": 0}) \
        .sort("requested_at", -1).to_list(limit)
    return {"success": True, "count": len(rows), "requests": rows}


class ChangeRequestDecision(BaseModel):
    admin_id: str
    reject_reason: Optional[str] = None


@admin_router.post("/change-requests/{request_id}/approve")
async def admin_approve_change_request(
    request_id: str,
    body: ChangeRequestDecision,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Approve = unbind the user's currently-bound device (if any) + clear
    device_binding_locked so they can log in on a fresh device. Atomic on
    the request row so double-clicks are idempotent.
    """
    _require_admin(x_admin_pin)
    req = await db.device_change_requests.find_one(
        {"request_id": request_id, "status": "pending"},
        {"_id": 0},
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found or already resolved")

    now_iso = datetime.now(timezone.utc).isoformat()
    uid = req["user_uid"]

    # Deactivate any active binding + clear lock
    unbind_res = await db.device_bindings.update_many(
        {"user_uid": uid, "active": True},
        {"$set": {
            "active": False,
            "unbound_at": now_iso,
            "unbound_reason": "admin_approved_change_request",
            "unbound_by_admin": body.admin_id,
            "unbound_via_request": request_id,
        }},
    )
    await db.users.update_one(
        {"uid": uid},
        {"$unset": {
            "primary_device_id": "",
            "primary_device_bound_at": "",
            "device_binding_locked": "",
            "device_binding_locked_at": "",
            "device_binding_locked_reason": "",
        }},
    )
    # Mark the request row approved (idempotent — pending → approved)
    await db.device_change_requests.update_one(
        {"request_id": request_id, "status": "pending"},
        {"$set": {
            "status": "approved",
            "reviewed_at": now_iso,
            "reviewed_by": body.admin_id,
            "unbindings_count": unbind_res.modified_count,
        }},
    )

    # Best-effort notification for when the user next opens the app
    try:
        await db.notifications.insert_one({
            "notification_id": str(uuid.uuid4()),
            "user_id": uid,
            "user_uid": uid,
            "type": "device_change_approved",
            "title": "✅ Device Change Approved",
            "message": (
                "Your device change request has been approved. You can now "
                "log in on your new device — it will be bound automatically."
            ),
            "created_at": now_iso,
            "read": False,
            "is_read": False,
        })
    except Exception as e:
        logger.warning(f"[DEVICE-BIND] change-approve notif failed: {e}")

    return {
        "success": True,
        "request_id": request_id,
        "unbindings_deactivated": unbind_res.modified_count,
        "message": "Approved — user can now log in on a new device.",
    }


@admin_router.post("/change-requests/{request_id}/reject")
async def admin_reject_change_request(
    request_id: str,
    body: ChangeRequestDecision,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    _require_admin(x_admin_pin)
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.device_change_requests.update_one(
        {"request_id": request_id, "status": "pending"},
        {"$set": {
            "status": "rejected",
            "reviewed_at": now_iso,
            "reviewed_by": body.admin_id,
            "reject_reason": body.reject_reason or "not_specified",
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found or already resolved")
    return {"success": True, "request_id": request_id}



# ────────────────────────────────────────────────────────────────────────
def _require_admin(pin: str):
    expected = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected or pin != expected:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")


# ────────────────────────────────────────────────────────────────────────
# NEW ADMIN ENDPOINTS (Aug 2026)
# — List devices with # of bound users, drill down to users, unblock,
# — Configure max_users_per_device
# ────────────────────────────────────────────────────────────────────────

@admin_router.get("/max-users")
async def get_max_users(x_admin_pin: str = Header(..., alias="X-Admin-Pin")):
    _require_admin(x_admin_pin)
    n = await get_max_users_per_device()
    return {"max_users_per_device": n, "default": DEFAULT_MAX_USERS_PER_DEVICE}


class SetMaxUsersRequest(BaseModel):
    max_users_per_device: int = Field(ge=1, le=10)


@admin_router.post("/max-users")
async def set_max_users(
    data: SetMaxUsersRequest,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    _require_admin(x_admin_pin)
    await db.app_settings.update_one(
        {"key": "device_binding"},
        {"$set": {"max_users_per_device": int(data.max_users_per_device)}},
        upsert=True,
    )
    return {"success": True, "max_users_per_device": int(data.max_users_per_device)}


@admin_router.get("/devices")
async def list_devices(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
    only_over_limit: bool = False,
    limit: int = 500,
):
    """List every active device with # of distinct users bound + latest activity.
    Set `only_over_limit=true` to show devices with users_count >= max (helpful
    for admin review).
    """
    _require_admin(x_admin_pin)
    max_users = await get_max_users_per_device()

    pipeline = [
        {"$match": {"active": True}},
        {"$group": {
            "_id": "$device_id",
            "users_count": {"$sum": 1},
            "user_uids": {"$push": "$user_uid"},
            "device_models": {"$addToSet": "$device_model"},
            "last_seen_at": {"$max": "$last_seen_at"},
            "first_bound_at": {"$min": "$bound_at"},
        }},
        {"$sort": {"users_count": -1, "last_seen_at": -1}},
        {"$limit": int(limit)},
    ]
    rows = await db.device_bindings.aggregate(pipeline).to_list(limit)

    output = []
    for r in rows:
        cnt = r["users_count"]
        if only_over_limit and cnt < max_users:
            continue
        output.append({
            "device_id": r["_id"],
            "users_count": cnt,
            "user_uids": r["user_uids"],
            "device_models": [m for m in r["device_models"] if m],
            "last_seen_at": r["last_seen_at"],
            "first_bound_at": r["first_bound_at"],
            "at_capacity": cnt >= max_users,
        })
    return {
        "devices": output,
        "total": len(output),
        "max_users_per_device": max_users,
    }


@admin_router.get("/devices/{device_id}/users")
async def device_users(
    device_id: str,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Details of users bound to a specific device (includes user names for admin)."""
    _require_admin(x_admin_pin)
    bindings = await db.device_bindings.find(
        {"device_id": device_id, "active": True},
        {"_id": 0},
    ).sort("bound_at", 1).to_list(50)
    for b in bindings:
        u = await db.users.find_one(
            {"uid": b["user_uid"]},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "subscription_plan": 1, "status": 1},
        )
        b["user"] = u
    return {"device_id": device_id, "bindings": bindings, "total": len(bindings)}


@admin_router.get("/blocked-users")
async def blocked_users(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
    hours: int = 168,   # last 7 days by default
    limit: int = 500,
):
    """List users whose login/register was recently BLOCKED due to a
    device collision. Groups by attempted_uid so admin sees each unique
    blocked user once with the latest event and device involved.
    """
    _require_admin(x_admin_pin)
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    pipeline = [
        {"$match": {"occurred_at": {"$gte": since}, "enforcement_on": True}},
        {"$sort": {"occurred_at": -1}},
        {"$group": {
            "_id": "$attempted_uid",
            "device_id": {"$first": "$device_id"},
            "bound_uid": {"$first": "$bound_uid"},
            "bound_uids": {"$first": "$bound_uids"},
            "device_model": {"$first": "$device_model"},
            "ip_address": {"$first": "$ip_address"},
            "occurred_at": {"$first": "$occurred_at"},
            "attempts": {"$sum": 1},
            "event": {"$first": "$event"},
        }},
        {"$sort": {"occurred_at": -1}},
        {"$limit": int(limit)},
    ]
    rows = await db.device_binding_collisions.aggregate(pipeline).to_list(limit)

    output = []
    for r in rows:
        attempted_uid = r.pop("_id")
        u = await db.users.find_one(
            {"uid": attempted_uid},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "subscription_plan": 1, "created_at": 1},
        )
        output.append({
            "attempted_uid": attempted_uid,
            "attempted_user": u,
            **r,
        })
    return {"blocked": output, "total": len(output), "window_hours": hours}


class UnblockUserRequest(BaseModel):
    attempted_uid: str
    device_id: str
    admin_id: str = "admin"
    action: str = "bind_to_device"   # "bind_to_device" | "clear_only"


@admin_router.post("/unblock-user")
async def unblock_user(
    data: UnblockUserRequest,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Unblock a specific user for a specific device.

    Actions:
      - `bind_to_device`: force-add this user as a binding on the device
        (bypasses the max_users cap for this one-time override).
      - `clear_only`: just wipe the collision audit log so future retries
        aren't rejected on quota — the next login will bind naturally IF
        the device isn't already at cap.

    Both actions also mark related collision rows as `resolved` so they
    drop off the Blocked Users list.
    """
    _require_admin(x_admin_pin)
    now_iso = datetime.now(timezone.utc).isoformat()

    if data.action not in ("bind_to_device", "clear_only"):
        raise HTTPException(status_code=400, detail="action must be bind_to_device or clear_only")

    if data.action == "bind_to_device":
        # Idempotent: skip if already actively bound
        existing = await db.device_bindings.find_one({
            "device_id": data.device_id, "user_uid": data.attempted_uid, "active": True,
        })
        if not existing:
            await db.device_bindings.insert_one({
                "binding_id": str(uuid.uuid4()),
                "device_id": data.device_id,
                "user_uid": data.attempted_uid,
                "bound_at": now_iso,
                "last_seen_at": now_iso,
                "bound_via_event": "admin_unblock",
                "admin_unblock_by": data.admin_id,
                "active": True,
                "override_max_users": True,
            })

    # Mark collision rows resolved
    r = await db.device_binding_collisions.update_many(
        {"attempted_uid": data.attempted_uid, "device_id": data.device_id,
         "resolved": {"$exists": False}},
        {"$set": {
            "resolved": True, "resolved_by": data.admin_id, "resolved_at": now_iso,
            "resolve_action": data.action,
        }},
    )

    return {
        "success": True,
        "action": data.action,
        "resolved_collisions": r.modified_count,
    }


class RemoveBindingRequest(BaseModel):
    device_id: str
    user_uid: str
    admin_id: str = "admin"
    reason: str = ""


@admin_router.post("/remove-binding")
async def remove_binding(
    data: RemoveBindingRequest,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Deactivate a user⇄device binding so the slot is freed up.
    (Used by admin to free space when a device is at capacity and
    someone genuine needs to be added.)"""
    _require_admin(x_admin_pin)
    now_iso = datetime.now(timezone.utc).isoformat()
    r = await db.device_bindings.update_one(
        {"device_id": data.device_id, "user_uid": data.user_uid, "active": True},
        {"$set": {
            "active": False,
            "deactivated_at": now_iso,
            "deactivated_by": data.admin_id,
            "deactivation_reason": data.reason or "admin_removed",
        }},
    )
    if r.modified_count == 0:
        raise HTTPException(status_code=404, detail="Active binding not found")
    return {"success": True, "removed": True}


# ────────────────────────────────────────────────────────────────────────
# NUCLEAR RESET (Feb 2026) — one-click unbind ALL devices + unblock ALL users
# ────────────────────────────────────────────────────────────────────────
class ResetAllRequest(BaseModel):
    admin_id: str = "admin"
    reason: str = "admin_global_reset"
    confirmation: str = Field(
        ...,
        description="Must be exactly 'CONFIRM RESET ALL' to prevent accidents",
    )


@admin_router.post("/reset-all")
async def admin_reset_all_bindings(
    data: ResetAllRequest,
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """One-click NUCLEAR RESET.

    - Deactivates every active device⇄user binding.
    - Marks every unresolved collision row as resolved.
    - Cancels every pending device-change request.

    Effect: every user can log in fresh on any device on next attempt.

    Requires the admin operation PIN + an explicit confirmation string
    to prevent accidental invocation.
    """
    _require_admin(x_admin_pin)
    if data.confirmation.strip().upper() != "CONFIRM RESET ALL":
        raise HTTPException(
            status_code=400,
            detail="confirmation must be exactly 'CONFIRM RESET ALL'",
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    # 1) Deactivate every active binding
    r1 = await db.device_bindings.update_many(
        {"active": True},
        {"$set": {
            "active": False,
            "deactivated_at": now_iso,
            "deactivated_by": data.admin_id,
            "deactivation_reason": data.reason,
        }},
    )

    # 1.5) Clear `device_binding_locked` on every user carrying it.
    # Retro-block flags this on user docs (line ~649); without clearing
    # it here, users stay 403-locked at login even after nuclear reset.
    r_unlock = await db.users.update_many(
        {"device_binding_locked": True},
        {"$unset": {
            "device_binding_locked": "",
            "device_binding_locked_at": "",
            "device_binding_locked_by": "",
            "device_binding_locked_reason": "",
        }},
    )

    # 2) Resolve every unresolved collision row (clears Blocked Users list)
    r2 = await db.device_binding_collisions.update_many(
        {"resolved": {"$exists": False}},
        {"$set": {
            "resolved": True,
            "resolved_by": data.admin_id,
            "resolved_at": now_iso,
            "resolve_action": "global_reset",
        }},
    )

    # 3) Cancel any pending device-change requests
    r3 = await db.device_change_requests.update_many(
        {"status": "pending"},
        {"$set": {
            "status": "cancelled",
            "reviewed_by": data.admin_id,
            "reviewed_at": now_iso,
            "review_reason": "global_reset",
        }},
    )

    # 4) Audit log so the reset is traceable
    try:
        await db.device_binding_audit.insert_one({
            "audit_id": str(uuid.uuid4()),
            "action": "global_reset_all",
            "admin_id": data.admin_id,
            "reason": data.reason,
            "bindings_deactivated": r1.modified_count,
            "users_unlocked": r_unlock.modified_count,
            "collisions_resolved": r2.modified_count,
            "change_requests_cancelled": r3.modified_count,
            "ts": now_iso,
        })
    except Exception as _e:
        logger.warning(f"[DEVICE-BIND] audit insert failed (non-fatal): {_e}")

    logger.info(
        f"[DEVICE-BIND] GLOBAL RESET by {data.admin_id}: "
        f"bindings={r1.modified_count}, users_unlocked={r_unlock.modified_count}, "
        f"collisions={r2.modified_count}, change_reqs={r3.modified_count}"
    )

    return {
        "success": True,
        "bindings_deactivated": r1.modified_count,
        "users_unlocked": r_unlock.modified_count,
        "collisions_resolved": r2.modified_count,
        "change_requests_cancelled": r3.modified_count,
        "ts": now_iso,
    }


# ────────────────────────────────────────────────────────────────────────
# INDEX HELPER — call once at startup
# ────────────────────────────────────────────────────────────────────────
async def ensure_indexes():
    """Idempotent — safe to call on every boot.

    Aug 2026 update: the OLD (device_id, active=True) unique index has been
    replaced with (device_id, user_uid, active=True) unique because a device
    can now be bound to multiple distinct users (up to
    `max_users_per_device`, default 2).
    """
    if db is None:
        return
    try:
        # Drop the legacy 1-per-device unique index if present.
        try:
            await db.device_bindings.drop_index("device_bindings_active_unique")
            logger.info("[DEVICE-BIND] dropped legacy device_bindings_active_unique")
        except Exception:
            pass  # not present — first-time upgrade or fresh DB

        # New composite unique — prevents the SAME user re-binding twice on the
        # same device, but allows different users to share the device.
        await db.device_bindings.create_index(
            [("device_id", 1), ("user_uid", 1), ("active", 1)],
            partialFilterExpression={"active": True},
            unique=True,
            name="device_bindings_active_user_unique",
        )
        await db.device_bindings.create_index([("device_id", 1)])   # non-unique lookup
        await db.device_bindings.create_index([("user_uid", 1)])
        await db.device_binding_collisions.create_index([("occurred_at", -1)])
        await db.device_binding_collisions.create_index([("device_id", 1)])
        await db.device_unbind_otps.create_index(
            [("user_uid", 1), ("device_id", 1)], unique=True
        )
        await db.device_change_requests.create_index(
            [("status", 1), ("requested_at", -1)]
        )
        await db.device_change_requests.create_index([("user_uid", 1)])
        logger.info("[DEVICE-BIND] indexes ensured (multi-user-per-device mode)")
    except Exception as e:
        logger.warning(f"[DEVICE-BIND] index ensure failed (non-fatal): {e}")
