"""
Redemption Daily Limit Routes (Sep 1 2026)

Frontend consumes GET /redemption-limit/status/{user_id} to render the
Dashboard "Daily Redemption Limit" card + the guard errors on
recharge / bank-redeem flows.

Deduction happens INSIDE recharge_utility and bank_redeem success
paths — never via this route directly. Read-only surface here.
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from app.services.redemption_limit_service import get_status

router = APIRouter(tags=["Redemption Limit"])
db = None


def set_db(motor_db):
    global db
    db = motor_db


@router.get("/redemption-limit/status/{user_id}")
async def redemption_limit_status(user_id: str):
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    return await get_status(db, user_id)


@router.post("/admin/redemption-limit/reset-all-anchors")
async def admin_reset_all_anchors(request: Request):
    """One-time migration (Sep 16 2026) — reset every user's redemption-
    limit cycle to a common anchor date so all existing users start from
    Day 1 together. Admin-only, idempotent, callable multiple times.

    Body (JSON): {
      "anchor_date": "2026-09-10T00:00:00+00:00",  # optional, defaults to Sep 10 2026
      "admin_pin": "…"                              # required
    }

    Effect on every user document:
      • redemption_limit_start_date  ← anchor_date
      • redemption_limit_used_prc    ← 0.0
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    try:
        data = await request.json()
    except Exception:
        data = {}

    anchor = data.get("anchor_date") or "2026-09-10T00:00:00+00:00"
    admin_pin = data.get("admin_pin") or ""

    # Simple admin PIN gate (matches company-manager account PIN pattern used
    # elsewhere for one-shot migrations). Change here if pin rotates.
    if admin_pin != "969696":
        raise HTTPException(status_code=403, detail="Admin PIN required")

    # Validate anchor date format
    try:
        datetime.fromisoformat(anchor.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid anchor_date ISO format")

    result = await db.users.update_many(
        {},
        {"$set": {
            "redemption_limit_start_date": anchor,
            "redemption_limit_used_prc": 0.0,
        }},
    )

    # Audit trail so this migration is traceable
    try:
        await db.redemption_limit_audit.insert_one({
            "kind": "bulk_reset_anchor",
            "anchor_date": anchor,
            "matched": result.matched_count,
            "modified": result.modified_count,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    return {
        "success": True,
        "anchor_date": anchor,
        "matched": result.matched_count,
        "modified": result.modified_count,
        "message": f"Reset {result.modified_count} users to Day 1 anchor {anchor[:10]}",
    }


@router.post("/admin/redemption-service-charge/backfill-missing")
async def admin_backfill_missing_service_charges(request: Request):
    """Backfill 20% Redemption Service Charges for historical PRC-paid
    Elite subscriptions AND Sale-Elite sponsorships that were completed
    BEFORE the auto-create hook was rolled out (Feb 2026).

    Behavior:
      • Scans `subscription_payments` (payment_method='prc', status in
        [paid, upcoming, active]) and `sponsored_subscriptions` docs.
      • For each, checks whether a `redemption_service_charges` row already
        exists (unique on redemption_id). If missing, creates one via
        `create_service_charge_on_success` (idempotent).
      • Supports dry-run to preview counts before applying.

    Body (JSON): {
      "admin_pin": "969696",   # required
      "dry_run":  true         # default true — preview only, no writes
    }
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    try:
        data = await request.json()
    except Exception:
        data = {}

    if data.get("admin_pin") != "969696":
        raise HTTPException(status_code=403, detail="Admin PIN required")

    dry_run = bool(data.get("dry_run", True))
    only_upcoming = bool(data.get("only_upcoming", False))

    # Lazy import — avoids circular init since redemption_service_charge sets
    # its own db in main.py startup.
    from routes.redemption_service_charge import create_service_charge_on_success

    stats = {
        "elite_subscription": {"scanned": 0, "already_charged": 0, "missing": 0, "created": 0, "errors": 0},
        "sale_elite_subscription": {"scanned": 0, "already_charged": 0, "missing": 0, "created": 0, "errors": 0},
        "users_touched": set(),
        "sample_missing": [],  # first 10 missing for preview
        "filter": "only_upcoming" if only_upcoming else "all_prc_subscriptions",
    }

    # ---------- Elite subscriptions ----------
    query_sub = {"payment_method": "prc", "prc_amount": {"$gt": 0}}
    if only_upcoming:
        # ONLY queued/advance subscriptions that have not yet activated.
        # These are the ones users bought BEFORE the service-charge system
        # existed and stashed as future plans.
        query_sub["status"] = "upcoming"
    cursor = db.subscription_payments.find(
        query_sub,
        {"_id": 0, "payment_id": 1, "user_id": 1, "prc_amount": 1, "status": 1, "created_at": 1},
    )
    async for doc in cursor:
        stats["elite_subscription"]["scanned"] += 1
        pid = doc.get("payment_id")
        uid = doc.get("user_id")
        prc = float(doc.get("prc_amount") or 0)
        if not pid or not uid or prc <= 0:
            continue
        # Already charged?
        exists = await db.redemption_service_charges.find_one(
            {"redemption_id": pid}, {"_id": 1}
        )
        if exists:
            stats["elite_subscription"]["already_charged"] += 1
            continue
        stats["elite_subscription"]["missing"] += 1
        stats["users_touched"].add(uid)
        if len(stats["sample_missing"]) < 10:
            stats["sample_missing"].append({
                "type": "elite_subscription", "user_id": uid,
                "redemption_id": pid, "prc_amount": prc,
                "created_at": doc.get("created_at"), "status": doc.get("status"),
            })
        if not dry_run:
            try:
                await create_service_charge_on_success(
                    user_id=uid, redemption_id=pid,
                    prc_amount=prc, redemption_type="elite_subscription",
                )
                stats["elite_subscription"]["created"] += 1
            except Exception:
                stats["elite_subscription"]["errors"] += 1

    # ---------- Sale-Elite sponsorships ----------
    # Skip entirely when caller only wants upcoming PRC subscriptions.
    if not only_upcoming:
        sale_cursor = db.sponsored_subscriptions.find(
            {"prc_amount": {"$gt": 0}},
            {"_id": 0, "sale_id": 1, "sender_uid": 1, "user_id": 1, "prc_amount": 1, "created_at": 1, "status": 1},
        )
        async for doc in sale_cursor:
            stats["sale_elite_subscription"]["scanned"] += 1
            sid = doc.get("sale_id")
            # sender pays the service charge (the buyer of the sponsorship)
            uid = doc.get("sender_uid") or doc.get("user_id")
            prc = float(doc.get("prc_amount") or 0)
            if not sid or not uid or prc <= 0:
                continue
            exists = await db.redemption_service_charges.find_one(
                {"redemption_id": sid}, {"_id": 1}
            )
            if exists:
                stats["sale_elite_subscription"]["already_charged"] += 1
                continue
            stats["sale_elite_subscription"]["missing"] += 1
            stats["users_touched"].add(uid)
            if len(stats["sample_missing"]) < 10:
                stats["sample_missing"].append({
                    "type": "sale_elite_subscription", "user_id": uid,
                    "redemption_id": sid, "prc_amount": prc,
                    "created_at": doc.get("created_at"), "status": doc.get("status"),
                })
            if not dry_run:
                try:
                    await create_service_charge_on_success(
                        user_id=uid, redemption_id=sid,
                        prc_amount=prc, redemption_type="sale_elite_subscription",
                    )
                    stats["sale_elite_subscription"]["created"] += 1
                except Exception:
                    stats["sale_elite_subscription"]["errors"] += 1

    # Convert set to count for JSON output
    users_touched_count = len(stats["users_touched"])
    del stats["users_touched"]

    # Audit trail
    try:
        await db.redemption_limit_audit.insert_one({
            "kind": "backfill_missing_service_charges",
            "dry_run": dry_run,
            "stats": stats,
            "users_touched": users_touched_count,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    return {
        "success": True,
        "dry_run": dry_run,
        "stats": stats,
        "unique_users_impacted": users_touched_count,
        "message": (
            f"DRY-RUN: would create {stats['elite_subscription']['missing'] + stats['sale_elite_subscription']['missing']} charges across {users_touched_count} users"
            if dry_run else
            f"Created {stats['elite_subscription']['created'] + stats['sale_elite_subscription']['created']} charges across {users_touched_count} users"
        ),
    }
