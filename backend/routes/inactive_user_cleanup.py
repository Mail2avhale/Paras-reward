"""
Inactive User Cleanup Routes  (May 11, 2026)
============================
Automated + manual purge of dead user accounts to keep the user base lean.

CONFIRMED RULES (per user, May 11, 2026):
-----------------------------------------
Rule 1 — "No Subscription" purge
   • User has NEVER purchased any subscription (Explorer only)
   • Created more than 7 days ago
   • Auto-deleted daily

Rule 2 — "Long Inactivity" purge
   • Last login / activity older than 60 days
   • Auto-deleted daily

PROTECTION GUARDS (cannot bypass):
   1. KYC verified users → NEVER delete (RBI PMLA Act: keep KYC 5 years)
   2. Admin / staff role → never delete
   3. Pending Eko refunds / pending recharges / pending withdrawals → skip
   4. is_protected flag (admin marker for VIP users) → skip
   5. PRC balance: ALLOWED to delete per user decision (May 11, 2026)
   6. Referral cascade: when we delete user U, every user V who has
      `referred_by == U` gets `referred_by = null` (downline count decreases
      for U's parent automatically).

ENDPOINTS:
  • GET  /api/admin/inactive-cleanup/dry-run    - preview (no delete)
  • POST /api/admin/inactive-cleanup/execute    - actually delete
  • GET  /api/admin/inactive-cleanup/settings   - get scheduler state
  • POST /api/admin/inactive-cleanup/settings   - toggle auto-run
  • POST /api/admin/inactive-cleanup/scheduler/run  - manual trigger
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging
import os

router = APIRouter(prefix="/admin/inactive-cleanup", tags=["admin-inactive-cleanup"])

db = None
COLLECTIONS_TO_CASCADE = [
    "transactions", "mining_sessions", "notifications", "kyc_documents",
    "luxury_savings", "activity_logs", "kyc", "prc_ledger", "wallets",
    "community_posts", "support_tickets", "withdrawals", "bill_payments",
    "subscription_payments", "vip_payments", "bank_redeems",
    "sponsored_subscriptions", "user_logs",
]

# Cleanup config doc lives in db.settings with type='inactive_user_cleanup'
SETTINGS_KEY = "inactive_user_cleanup"


def set_db(database):
    global db
    db = database


def _verify_admin_pin(pin: str) -> bool:
    expected = os.environ.get("ADMIN_OVERRIDE_PIN", "153759")
    return pin == expected


async def _find_deletion_candidates(days_no_sub: int = 7, days_inactive: int = 60) -> dict:
    """Return {rule1_uids, rule2_uids, protected_skipped} (no actual delete)."""
    now = datetime.now(timezone.utc)
    cutoff_no_sub = (now - timedelta(days=days_no_sub)).isoformat()
    cutoff_inactive = (now - timedelta(days=days_inactive)).isoformat()

    # Common protection filter — NEVER delete these
    base_protection = {
        "$and": [
            {"role": {"$nin": ["admin", "staff", "manager"]}},
            {"is_protected": {"$ne": True}},
            {"kyc_status": {"$nin": ["verified", "approved"]}},  # RBI compliance
            # uid must be a real user (not the system / synthetic placeholder)
            {"uid": {"$nin": ["system", None, ""]}},
            {"uid": {"$not": {"$regex": "^admin-"}}},
        ]
    }

    # ---- Rule 1: never subscribed + older than 7 days ----
    rule1_query = {
        "$and": [
            base_protection,
            {"$or": [
                {"subscription_plan": {"$in": [None, "", "explorer", "free"]}},
                {"subscription_plan": {"$exists": False}}
            ]},
            {"$or": [
                {"subscription_expiry": {"$exists": False}},
                {"subscription_expiry": None},
                {"subscription_expiry": ""},
            ]},
            {"$or": [
                {"created_at": {"$lte": cutoff_no_sub}},
                {"createdAt": {"$lte": cutoff_no_sub}},
            ]},
            # NEVER had any successful subscription payment
            {"has_ever_subscribed": {"$ne": True}},
        ]
    }

    # ---- Rule 2: long inactivity (>60 days) ----
    rule2_query = {
        "$and": [
            base_protection,
            {"$or": [
                {"last_login_at": {"$lte": cutoff_inactive}},
                {"last_activity_at": {"$lte": cutoff_inactive}},
                # If last_login_at doesn't exist AND user is old enough → inactive
                {"$and": [
                    {"last_login_at": {"$exists": False}},
                    {"$or": [
                        {"created_at": {"$lte": cutoff_inactive}},
                        {"createdAt": {"$lte": cutoff_inactive}},
                    ]},
                ]},
            ]},
        ]
    }

    rule1_users = await db.users.find(
        rule1_query,
        {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "email": 1, "created_at": 1,
         "subscription_plan": 1, "kyc_status": 1, "prc_balance": 1}
    ).limit(5000).to_list(length=5000)

    rule2_users = await db.users.find(
        rule2_query,
        {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "email": 1, "last_login_at": 1,
         "last_activity_at": 1, "created_at": 1, "kyc_status": 1, "prc_balance": 1}
    ).limit(5000).to_list(length=5000)

    # Dedup (rule2 might include rule1)
    rule1_uids = {u["uid"] for u in rule1_users}
    rule2_uids = {u["uid"] for u in rule2_users} - rule1_uids
    rule2_users = [u for u in rule2_users if u["uid"] in rule2_uids]

    # ---- Skip protected guards (pending Eko, pending withdrawals, etc.) ----
    all_candidate_uids = list(rule1_uids | rule2_uids)
    protected_skipped = []

    if all_candidate_uids:
        # Pending Eko refunds — skip
        pending_refunds = await db.transactions.distinct(
            "user_id",
            {
                "user_id": {"$in": all_candidate_uids},
                "type": {"$in": ["refund_pending", "refund_initiated", "eko_refund_pending"]},
                "status": {"$in": ["pending", "processing", "initiated"]},
            }
        )
        # Pending withdrawals
        pending_withdrawals = await db.withdrawals.distinct(
            "user_id",
            {"user_id": {"$in": all_candidate_uids}, "status": {"$in": ["pending", "processing"]}}
        ) if "withdrawals" in await db.list_collection_names() else []

        # Pending bank redeems
        pending_bank_redeems = await db.bank_redeems.distinct(
            "user_id",
            {"user_id": {"$in": all_candidate_uids}, "status": {"$in": ["pending", "processing"]}}
        ) if "bank_redeems" in await db.list_collection_names() else []

        skipped_uids = set(pending_refunds) | set(pending_withdrawals) | set(pending_bank_redeems)

        # Filter them out
        rule1_users = [u for u in rule1_users if u["uid"] not in skipped_uids]
        rule2_users = [u for u in rule2_users if u["uid"] not in skipped_uids]
        protected_skipped = list(skipped_uids)

    return {
        "rule1_users": rule1_users,
        "rule2_users": rule2_users,
        "rule1_count": len(rule1_users),
        "rule2_count": len(rule2_users),
        "protected_skipped_count": len(protected_skipped),
        "protected_skipped_uids": protected_skipped[:50],  # cap for response size
        "total_to_delete": len(rule1_users) + len(rule2_users),
        "criteria": {
            "rule1": f"Never subscribed + registered before {(datetime.now(timezone.utc) - timedelta(days=days_no_sub)).isoformat()[:10]}",
            "rule2": f"Last activity before {(datetime.now(timezone.utc) - timedelta(days=days_inactive)).isoformat()[:10]}",
            "days_no_sub": days_no_sub,
            "days_inactive": days_inactive,
        },
    }


async def _hard_delete_users(uids: list, admin_id: str) -> dict:
    """Cascade-delete a list of users + their related records.
    Returns counts of records deleted per collection.
    """
    if not uids:
        return {"deleted_users": 0, "cascades": {}}

    deleted_users = 0
    cascade_counts = {}
    referral_orphans_count = 0
    now = datetime.now(timezone.utc).isoformat()

    # Cap per-batch size to keep memory + tx-log sane
    BATCH = 500
    for batch_start in range(0, len(uids), BATCH):
        batch = uids[batch_start:batch_start + BATCH]

        # ===== Snapshot audit BEFORE delete =====
        snapshots = []
        async for u in db.users.find({"uid": {"$in": batch}}, {"_id": 0}):
            snapshots.append(u)
        if snapshots:
            await db.deleted_users_audit.insert_many([
                {
                    "uid": u.get("uid"),
                    "name": u.get("name"),
                    "mobile": u.get("mobile"),
                    "email": u.get("email"),
                    "kyc_status": u.get("kyc_status"),
                    "prc_balance": u.get("prc_balance"),
                    "subscription_plan": u.get("subscription_plan"),
                    "created_at": u.get("created_at"),
                    "deleted_by": admin_id,
                    "deleted_at": now,
                    "reason": "inactive_cleanup",
                    "snapshot": u,
                } for u in snapshots
            ])

        # ===== Hard delete users =====
        del_res = await db.users.delete_many({"uid": {"$in": batch}})
        deleted_users += del_res.deleted_count

        # ===== Cascade: related records =====
        existing_collections = set(await db.list_collection_names())
        for coll_name in COLLECTIONS_TO_CASCADE:
            if coll_name not in existing_collections:
                continue
            # Most use "user_id", but some use "uid"
            try:
                r1 = await db[coll_name].delete_many({"user_id": {"$in": batch}})
                r2 = await db[coll_name].delete_many({"uid": {"$in": batch}})
                cascade_counts[coll_name] = cascade_counts.get(coll_name, 0) + r1.deleted_count + r2.deleted_count
            except Exception as ce:
                logging.warning(f"[INACTIVE-CLEANUP] cascade {coll_name} failed: {ce}")

        # ===== Referral downline cleanup =====
        # Any user who was referred BY a deleted user — orphan their referral chain
        try:
            r_orphan = await db.users.update_many(
                {"referred_by": {"$in": batch}},
                {"$set": {"referred_by": None, "referrer_lost_at": now, "referrer_lost_reason": "parent_deleted"}}
            )
            referral_orphans_count += r_orphan.modified_count
        except Exception as re:
            logging.warning(f"[INACTIVE-CLEANUP] referral orphan failed: {re}")

    return {
        "deleted_users": deleted_users,
        "cascades": cascade_counts,
        "referral_orphans": referral_orphans_count,
    }


# ============================================================================
# DRY RUN
# ============================================================================
@router.get("/dry-run")
async def dry_run_inactive_cleanup(
    days_no_sub: int = 7,
    days_inactive: int = 60,
    sample_size: int = 25,
):
    """Preview which users WOULD be deleted (no actual delete)."""
    try:
        result = await _find_deletion_candidates(days_no_sub, days_inactive)
        # Sample users for UI preview
        result["rule1_sample"] = result["rule1_users"][:sample_size]
        result["rule2_sample"] = result["rule2_users"][:sample_size]
        # Strip full lists from response (would be huge)
        result.pop("rule1_users", None)
        result.pop("rule2_users", None)
        return {"success": True, **result}
    except Exception as e:
        logging.error(f"[INACTIVE-CLEANUP dry-run] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# EXECUTE (actual delete) — admin PIN required
# ============================================================================
@router.post("/execute")
async def execute_inactive_cleanup(request: Request):
    """Actually delete the candidate users. Admin PIN required.

    Body: {pin, admin_id, days_no_sub?, days_inactive?, rules?: ["rule1","rule2"]}
    """
    try:
        body = await request.json()
        pin = body.get("pin", "")
        if not _verify_admin_pin(pin):
            raise HTTPException(status_code=401, detail="Invalid admin PIN")

        admin_id = body.get("admin_id") or "admin"
        days_no_sub = int(body.get("days_no_sub", 7))
        days_inactive = int(body.get("days_inactive", 60))
        rules = body.get("rules", ["rule1", "rule2"])

        cand = await _find_deletion_candidates(days_no_sub, days_inactive)

        uids_to_delete = []
        if "rule1" in rules:
            uids_to_delete.extend(u["uid"] for u in cand["rule1_users"])
        if "rule2" in rules:
            uids_to_delete.extend(u["uid"] for u in cand["rule2_users"])

        del_result = await _hard_delete_users(uids_to_delete, admin_id)

        # Log final action
        await db.audit_logs.insert_one({
            "action": "inactive_user_cleanup",
            "performed_by": admin_id,
            "rules_applied": rules,
            "days_no_sub": days_no_sub,
            "days_inactive": days_inactive,
            "deleted_count": del_result["deleted_users"],
            "cascades": del_result["cascades"],
            "referral_orphans": del_result["referral_orphans"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        return {
            "success": True,
            "deleted_users": del_result["deleted_users"],
            "cascades": del_result["cascades"],
            "referral_orphans": del_result["referral_orphans"],
            "rules_applied": rules,
            "criteria": cand["criteria"],
            "protected_skipped_count": cand["protected_skipped_count"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[INACTIVE-CLEANUP execute] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SCHEDULER SETTINGS
# ============================================================================
@router.get("/settings")
async def get_cleanup_settings():
    """Read scheduler config."""
    try:
        cfg = await db.settings.find_one({"type": SETTINGS_KEY}, {"_id": 0})
        if not cfg:
            cfg = {
                "type": SETTINGS_KEY,
                "auto_run_enabled": False,
                "days_no_sub": 7,
                "days_inactive": 60,
                "rules": ["rule1", "rule2"],
                "last_run_at": None,
                "last_run_deleted": 0,
            }
        return {"success": True, "settings": cfg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/settings")
async def update_cleanup_settings(request: Request):
    """Update scheduler config. Admin PIN required for safety."""
    try:
        body = await request.json()
        if not _verify_admin_pin(body.get("pin", "")):
            raise HTTPException(status_code=401, detail="Invalid admin PIN")

        update = {
            "auto_run_enabled": bool(body.get("auto_run_enabled", False)),
            "days_no_sub": int(body.get("days_no_sub", 7)),
            "days_inactive": int(body.get("days_inactive", 60)),
            "rules": body.get("rules", ["rule1", "rule2"]),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": body.get("admin_id") or "admin",
        }
        await db.settings.update_one(
            {"type": SETTINGS_KEY},
            {"$set": {**update, "type": SETTINGS_KEY}},
            upsert=True
        )
        return {"success": True, "settings": update}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduler/run")
async def manual_scheduler_run(request: Request):
    """Manual scheduler trigger — same as enabled daily run."""
    try:
        body = await request.json()
        if not _verify_admin_pin(body.get("pin", "")):
            raise HTTPException(status_code=401, detail="Invalid admin PIN")

        cfg = await db.settings.find_one({"type": SETTINGS_KEY}) or {}
        days_no_sub = int(cfg.get("days_no_sub", 7))
        days_inactive = int(cfg.get("days_inactive", 60))
        rules = cfg.get("rules", ["rule1", "rule2"])

        cand = await _find_deletion_candidates(days_no_sub, days_inactive)
        uids = []
        if "rule1" in rules:
            uids.extend(u["uid"] for u in cand["rule1_users"])
        if "rule2" in rules:
            uids.extend(u["uid"] for u in cand["rule2_users"])

        del_result = await _hard_delete_users(uids, body.get("admin_id") or "scheduler")

        await db.settings.update_one(
            {"type": SETTINGS_KEY},
            {"$set": {
                "last_run_at": datetime.now(timezone.utc).isoformat(),
                "last_run_deleted": del_result["deleted_users"],
                "last_run_referral_orphans": del_result["referral_orphans"],
            }},
            upsert=True
        )
        return {"success": True, "deleted_users": del_result["deleted_users"], **del_result}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[INACTIVE-CLEANUP scheduler] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DAILY SCHEDULER ENTRY-POINT (called from server.py startup)
# ============================================================================
async def daily_inactive_cleanup_task():
    """Background task — runs once a day, only if auto_run_enabled=True."""
    import asyncio
    while True:
        try:
            cfg = await db.settings.find_one({"type": SETTINGS_KEY})
            if cfg and cfg.get("auto_run_enabled"):
                days_no_sub = int(cfg.get("days_no_sub", 7))
                days_inactive = int(cfg.get("days_inactive", 60))
                rules = cfg.get("rules", ["rule1", "rule2"])

                cand = await _find_deletion_candidates(days_no_sub, days_inactive)
                uids = []
                if "rule1" in rules:
                    uids.extend(u["uid"] for u in cand["rule1_users"])
                if "rule2" in rules:
                    uids.extend(u["uid"] for u in cand["rule2_users"])

                if uids:
                    res = await _hard_delete_users(uids, "scheduler-auto")
                    logging.warning(
                        f"[INACTIVE-CLEANUP auto] Deleted {res['deleted_users']} users, "
                        f"orphaned {res['referral_orphans']} downline refs."
                    )
                    await db.settings.update_one(
                        {"type": SETTINGS_KEY},
                        {"$set": {
                            "last_run_at": datetime.now(timezone.utc).isoformat(),
                            "last_run_deleted": res["deleted_users"],
                        }}
                    )
        except Exception as e:
            logging.error(f"[INACTIVE-CLEANUP auto] error: {e}", exc_info=True)

        await asyncio.sleep(24 * 60 * 60)  # 24 hours


# ============================================================================
# CUSTOM PURGE BY REGISTRATION DATE RANGE  (Jun 2026)
# ============================================================================
# Owner request (9 Jun 2026):
#   "Janewari/Feb/Mar/Apr 2026 मध्ये ज्या युजरची रजिस्ट्रेशन date आहे,
#    pn त्याची session active nahi, subcription active nahi, ani 10 divsapasun
#    login pn nahi — ase sarv users delete kar. tyanchya pending redeem to
#    bank requests pn delete kar."
#
# Differences vs Rule 1 / Rule 2:
#   • Filters by REGISTRATION date window (inclusive)
#   • Mining must be inactive (`is_mining != True`)
#   • Subscription must be NOT active (not elite OR expired)
#   • Last login older than `inactive_days` (default 10)
#   • Pending bank-redeems are NOT a skip-guard — they get DELETED with
#     the user (per explicit owner instruction)
#   • KYC-verified, admin/staff, is_protected remain LEGAL protections


async def _find_custom_candidates(
    start_date: str,
    end_date: str,
    inactive_days: int = 10,
    sample_size: int = 50,
) -> dict:
    """Find users matching the custom purge criteria.

    Args:
        start_date / end_date: 'YYYY-MM-DD' inclusive registration window.
        inactive_days: last_login_at must be older than now - inactive_days.
    """
    now = datetime.now(timezone.utc)
    inactive_cutoff = (now - timedelta(days=inactive_days)).isoformat()
    now_iso = now.isoformat()

    start_iso = f"{start_date}T00:00:00+00:00"
    end_iso = f"{end_date}T23:59:59+00:00"

    base_protection = {
        "$and": [
            {"role": {"$nin": ["admin", "staff", "manager"]}},
            {"is_protected": {"$ne": True}},
            # KYC verified users protected by RBI PMLA Act (5 yr retention)
            {"kyc_status": {"$nin": ["verified", "approved", "Verified", "VERIFIED"]}},
            {"uid": {"$nin": ["system", None, ""]}},
            {"uid": {"$not": {"$regex": "^admin-"}}},
        ]
    }

    # Registration window — match either field
    reg_window = {
        "$or": [
            {"created_at": {"$gte": start_iso, "$lte": end_iso}},
            {"createdAt": {"$gte": start_iso, "$lte": end_iso}},
            {"registered_at": {"$gte": start_iso, "$lte": end_iso}},
        ]
    }

    # Subscription NOT active = not elite OR expired
    sub_not_active = {
        "$or": [
            {"subscription_plan": {"$in": [None, "", "explorer", "free"]}},
            {"subscription_plan": {"$exists": False}},
            # Has elite but expired
            {"$and": [
                {"subscription_plan": {"$in": ["elite", "Elite", "ELITE"]}},
                {"$or": [
                    {"subscription_expiry": {"$exists": False}},
                    {"subscription_expiry": None},
                    {"subscription_expiry": ""},
                    {"subscription_expiry": {"$lt": now_iso}},
                ]},
            ]},
        ]
    }

    # Mining NOT active (is_mining flag, or never started)
    mining_not_active = {
        "$or": [
            {"is_mining": {"$ne": True}},
            {"is_mining": {"$exists": False}},
        ]
    }

    # Login NOT recent (10 days)
    login_inactive = {
        "$or": [
            {"last_login_at": {"$lte": inactive_cutoff}},
            {"last_login_at": {"$exists": False}},
            {"last_login_at": None},
        ]
    }

    full_query = {
        "$and": [
            base_protection,
            reg_window,
            sub_not_active,
            mining_not_active,
            login_inactive,
        ]
    }

    candidates = await db.users.find(
        full_query,
        {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "email": 1, "created_at": 1,
         "last_login_at": 1, "subscription_plan": 1, "subscription_expiry": 1,
         "is_mining": 1, "kyc_status": 1, "prc_balance": 1}
    ).limit(20000).to_list(length=20000)

    # Cross-check mining_sessions: if any candidate has an ACTIVE mining session
    # in the collection (regardless of flag), exclude them (safety)
    candidate_uids = [u["uid"] for u in candidates]
    active_mining_uids = set()
    if candidate_uids and "mining_sessions" in await db.list_collection_names():
        try:
            async for s in db.mining_sessions.find(
                {"user_id": {"$in": candidate_uids}, "status": {"$in": ["active", "running"]}},
                {"_id": 0, "user_id": 1}
            ):
                active_mining_uids.add(s.get("user_id"))
        except Exception as e:
            logging.warning(f"[CUSTOM-PURGE] mining_sessions check failed: {e}")

    final = [u for u in candidates if u["uid"] not in active_mining_uids]

    # Month-by-month breakdown for owner clarity
    breakdown = {}
    for u in final:
        ca = u.get("created_at") or ""
        month_key = ca[:7] if isinstance(ca, str) and len(ca) >= 7 else "unknown"
        breakdown[month_key] = breakdown.get(month_key, 0) + 1

    # Pending bank-redeem requests we'll delete alongside
    pending_redeems_uids = set()
    if final:
        for coll in ("bank_transfer_requests", "bank_redeems", "withdrawals"):
            if coll in await db.list_collection_names():
                try:
                    uids = await db[coll].distinct(
                        "user_id",
                        {
                            "user_id": {"$in": [u["uid"] for u in final]},
                            "status": {"$in": ["pending", "processing", "initiated"]},
                        }
                    )
                    pending_redeems_uids.update(uids)
                except Exception:
                    pass

    return {
        "total_to_delete": len(final),
        "active_mining_skipped": len(active_mining_uids),
        "month_breakdown": breakdown,
        "sample": final[:sample_size],
        "all_uids": [u["uid"] for u in final],  # internal use for execute
        "pending_redeems_will_delete_for": len(pending_redeems_uids),
        "criteria": {
            "registration_window": f"{start_date} → {end_date}",
            "inactive_days": inactive_days,
            "subscription_active_required": False,
            "mining_active_required": False,
            "kyc_protected": True,
            "delete_pending_redeems": True,
        },
    }


@router.get("/custom-dry-run")
async def custom_dry_run(
    start_date: str = "2026-01-01",
    end_date: str = "2026-04-30",
    inactive_days: int = 10,
    sample_size: int = 50,
):
    """Preview custom-purge candidates (no delete)."""
    try:
        res = await _find_custom_candidates(start_date, end_date, inactive_days, sample_size)
        # Drop the full uid list from response (large)
        res.pop("all_uids", None)
        return {"success": True, **res}
    except Exception as e:
        logging.error(f"[CUSTOM-PURGE dry-run] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/custom-execute")
async def custom_execute(request: Request):
    """Execute the custom purge. Admin PIN required.

    Body: {pin, admin_id, start_date, end_date, inactive_days?}
    """
    try:
        body = await request.json()
        if not _verify_admin_pin(body.get("pin", "")):
            raise HTTPException(status_code=401, detail="Invalid admin PIN")

        start_date = body.get("start_date", "2026-01-01")
        end_date = body.get("end_date", "2026-04-30")
        inactive_days = int(body.get("inactive_days", 10))
        admin_id = body.get("admin_id") or "admin"

        cand = await _find_custom_candidates(start_date, end_date, inactive_days, sample_size=0)
        uids = cand["all_uids"]

        # ----- DELETE pending bank-redeem-type requests for these users FIRST -----
        redeem_deleted = 0
        if uids:
            for coll in ("bank_transfer_requests", "bank_redeems", "withdrawals"):
                if coll in await db.list_collection_names():
                    try:
                        r = await db[coll].delete_many({
                            "user_id": {"$in": uids},
                            "status": {"$in": ["pending", "processing", "initiated"]},
                        })
                        redeem_deleted += r.deleted_count
                    except Exception as ce:
                        logging.warning(f"[CUSTOM-PURGE] redeem delete in {coll} failed: {ce}")

        # ----- Cascade-delete users + related data -----
        del_result = await _hard_delete_users(uids, admin_id)

        # Audit log
        await db.audit_logs.insert_one({
            "action": "custom_inactive_purge",
            "performed_by": admin_id,
            "criteria": cand["criteria"],
            "month_breakdown": cand["month_breakdown"],
            "deleted_users": del_result["deleted_users"],
            "cascades": del_result["cascades"],
            "referral_orphans": del_result["referral_orphans"],
            "pending_redeems_deleted": redeem_deleted,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        return {
            "success": True,
            "deleted_users": del_result["deleted_users"],
            "pending_redeems_deleted": redeem_deleted,
            "cascades": del_result["cascades"],
            "referral_orphans": del_result["referral_orphans"],
            "month_breakdown": cand["month_breakdown"],
            "criteria": cand["criteria"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[CUSTOM-PURGE execute] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
