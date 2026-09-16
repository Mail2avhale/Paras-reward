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
