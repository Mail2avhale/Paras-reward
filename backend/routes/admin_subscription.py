"""
Admin Subscription Management Routes
- View subscription details (current, upcoming, history)
- Edit subscription (extend/change expiry)
- Cancel + Refund (full/prorated/none)
- Activate upcoming plans
"""

import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/admin/subscription", tags=["Admin Subscription"])


def get_db():
    from server import db
    return db


async def verify_admin(uid: str):
    db = get_db()
    admin = await db.users.find_one({"uid": uid})
    if not admin or admin.get("role") not in ["admin", "super_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return admin


def parse_expiry(val):
    """Parse expiry value to datetime with timezone."""
    if not val:
        return None
    try:
        if isinstance(val, datetime):
            dt = val
        elif isinstance(val, str):
            dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
        else:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


# ==============================
# GET: Full Subscription Details
# ==============================
@router.get("/{uid}/details")
async def get_subscription_details(uid: str, request: Request):
    db = get_db()

    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)

    # --- Current Plan ---
    current_plan = None
    plan_name = user.get("subscription_plan")
    expiry_dt = parse_expiry(user.get("subscription_expiry") or user.get("subscription_expires"))
    start_dt = parse_expiry(user.get("subscription_start"))

    if plan_name and plan_name not in ["explorer", "free", None] and expiry_dt and expiry_dt > now:
        remaining_days = max(0, (expiry_dt - now).days)
        current_plan = {
            "plan_name": plan_name,
            "status": "active",
            "start_date": start_dt.isoformat() if start_dt else None,
            "end_date": expiry_dt.isoformat(),
            "remaining_days": remaining_days,
            "payment_method": user.get("subscription_payment_type", "unknown"),
        }

    # --- Upcoming Plans ---
    upcoming_plans = []
    upcoming_cursor = db.subscription_payments.find(
        {"user_id": uid, "status": "upcoming"},
        {"_id": 0}
    ).sort("scheduled_start", 1)
    async for doc in upcoming_cursor:
        upcoming_plans.append({
            "payment_id": doc.get("payment_id"),
            "plan_name": doc.get("plan_name", "elite"),
            "status": "upcoming",
            "scheduled_start": doc.get("scheduled_start"),
            "scheduled_end": doc.get("scheduled_end"),
            "duration_days": doc.get("duration_days", 28),
            "payment_method": doc.get("payment_method", "prc"),
            "prc_amount": doc.get("prc_amount", 0),
            "inr_equivalent": doc.get("inr_equivalent", 0),
            "created_at": doc.get("created_at"),
        })

    # --- Payment History (past subscriptions) ---
    history = []
    history_cursor = db.subscription_payments.find(
        {"user_id": uid, "status": {"$nin": ["upcoming"]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(20)
    async for doc in history_cursor:
        # Determine if expired
        sub_expiry = parse_expiry(doc.get("subscription_expiry") or doc.get("scheduled_end"))
        status = doc.get("status", "paid")
        if status == "paid" and sub_expiry and sub_expiry < now:
            status = "expired"

        history.append({
            "payment_id": doc.get("payment_id"),
            "plan_name": doc.get("plan_name", "elite"),
            "status": status,
            "start_date": doc.get("subscription_start") or doc.get("scheduled_start") or doc.get("created_at"),
            "end_date": doc.get("subscription_expiry") or doc.get("scheduled_end"),
            "duration_days": doc.get("duration_days") or doc.get("total_days", 28),
            "payment_method": doc.get("payment_method", "unknown"),
            "prc_amount": doc.get("prc_amount", 0),
            "prc_rate_used": doc.get("prc_rate_used"),
            "inr_equivalent": doc.get("inr_equivalent", 0),
            "created_at": doc.get("created_at"),
            "activated_by_admin": doc.get("activated_by_admin"),
            "cancelled_by_admin": doc.get("cancelled_by_admin"),
            "refund_type": doc.get("refund_type"),
            "refund_amount": doc.get("refund_amount"),
        })

    return {
        "success": True,
        "user_name": user.get("name", "User"),
        "uid": uid,
        "current_plan": current_plan,
        "upcoming_plans": upcoming_plans,
        "history": history,
    }


# ==============================
# POST: Edit Subscription
# ==============================
@router.post("/{uid}/edit")
async def edit_subscription(uid: str, request: Request):
    db = get_db()
    data = await request.json()

    admin_uid = data.get("admin_uid")
    action = data.get("action")  # "extend_days" | "set_expiry"
    note = data.get("note", "").strip()

    if not admin_uid or not action:
        raise HTTPException(status_code=400, detail="admin_uid and action are required")
    if not note:
        raise HTTPException(status_code=400, detail="Note/reason is required for audit trail")

    admin = await verify_admin(admin_uid)
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    current_expiry = parse_expiry(user.get("subscription_expiry") or user.get("subscription_expires"))

    if action == "extend_days":
        days = int(data.get("days", 0))
        if days <= 0 or days > 365:
            raise HTTPException(status_code=400, detail="Days must be between 1 and 365")

        base = current_expiry if current_expiry and current_expiry > now else now
        new_expiry = base + timedelta(days=days)

        await db.users.update_one({"uid": uid}, {"$set": {
            "subscription_expiry": new_expiry.isoformat(),
            "subscription_expires": new_expiry,
            "subscription_status": "active",
            "subscription_plan": user.get("subscription_plan") or "elite",
        }})

        # Audit log
        await db.admin_actions.insert_one({
            "admin_uid": admin_uid,
            "admin_name": admin.get("name", "Admin"),
            "action": "subscription_extend",
            "target_uid": uid,
            "target_name": user.get("name", "User"),
            "details": {
                "days_added": days,
                "old_expiry": current_expiry.isoformat() if current_expiry else None,
                "new_expiry": new_expiry.isoformat(),
                "note": note,
            },
            "timestamp": now.isoformat(),
        })

        return {
            "success": True,
            "message": f"Extended subscription by {days} days",
            "new_expiry": new_expiry.isoformat()[:10],
        }

    elif action == "set_expiry":
        new_expiry_str = data.get("new_expiry")
        if not new_expiry_str:
            raise HTTPException(status_code=400, detail="new_expiry date is required")

        new_expiry = parse_expiry(new_expiry_str)
        if not new_expiry:
            raise HTTPException(status_code=400, detail="Invalid date format")

        status = "active" if new_expiry > now else "expired"
        update_fields = {
            "subscription_expiry": new_expiry.isoformat(),
            "subscription_expires": new_expiry,
            "subscription_status": status,
        }
        if status == "active" and not user.get("subscription_plan"):
            update_fields["subscription_plan"] = "elite"

        await db.users.update_one({"uid": uid}, {"$set": update_fields})

        await db.admin_actions.insert_one({
            "admin_uid": admin_uid,
            "admin_name": admin.get("name", "Admin"),
            "action": "subscription_set_expiry",
            "target_uid": uid,
            "target_name": user.get("name", "User"),
            "details": {
                "old_expiry": current_expiry.isoformat() if current_expiry else None,
                "new_expiry": new_expiry.isoformat(),
                "note": note,
            },
            "timestamp": now.isoformat(),
        })

        return {
            "success": True,
            "message": f"Expiry set to {new_expiry.isoformat()[:10]}",
            "new_expiry": new_expiry.isoformat()[:10],
        }

    raise HTTPException(status_code=400, detail="Invalid action. Use 'extend_days' or 'set_expiry'")


# ==============================
# POST: Cancel Subscription + Refund
# ==============================
@router.post("/{uid}/cancel")
async def cancel_subscription(uid: str, request: Request):
    db = get_db()
    data = await request.json()

    admin_uid = data.get("admin_uid")
    target = data.get("target", "current")  # "current" | "upcoming"
    payment_id = data.get("payment_id")  # for upcoming plans
    refund_type = data.get("refund_type", "none")  # "full" | "prorated" | "none"
    note = data.get("note", "").strip()

    if not admin_uid:
        raise HTTPException(status_code=400, detail="admin_uid is required")
    if not note:
        raise HTTPException(status_code=400, detail="Note/reason is required for audit trail")

    admin = await verify_admin(admin_uid)
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    refund_amount = 0

    if target == "upcoming" and payment_id:
        # Cancel upcoming plan
        upcoming = await db.subscription_payments.find_one(
            {"user_id": uid, "payment_id": payment_id, "status": "upcoming"},
            {"_id": 0}
        )
        if not upcoming:
            raise HTTPException(status_code=404, detail="Upcoming plan not found")

        prc_paid = float(upcoming.get("prc_amount", 0))
        refund_amount = prc_paid  # Full refund for upcoming (not started yet)

        # Update payment record
        await db.subscription_payments.update_one(
            {"user_id": uid, "payment_id": payment_id},
            {"$set": {
                "status": "cancelled",
                "cancelled_at": now.isoformat(),
                "cancelled_by_admin": admin_uid,
                "cancel_reason": note,
                "refund_type": "full",
                "refund_amount": round(refund_amount, 2),
            }}
        )

        # Refund PRC
        if refund_amount > 0:
            await db.users.update_one({"uid": uid}, {"$inc": {"prc_balance": refund_amount}})
            await db.transactions.insert_one({
                "user_id": uid,
                "type": "subscription_refund",
                "amount": refund_amount,
                "description": "Upcoming subscription cancelled & refunded by Admin",
                "timestamp": now,
                "created_at": now.isoformat(),
                "status": "completed",
                "admin_action": True,
                "admin_uid": admin_uid,
            })

    elif target == "current":
        # Cancel current plan
        current_expiry = parse_expiry(user.get("subscription_expiry") or user.get("subscription_expires"))

        # Find latest payment for this subscription
        latest_payment = await db.subscription_payments.find_one(
            {"user_id": uid, "status": {"$in": ["paid", "active"]}},
            {"_id": 0},
            sort=[("created_at", -1)]
        )

        prc_paid = float(latest_payment.get("prc_amount", 0)) if latest_payment else 0
        total_days = int(latest_payment.get("total_days") or latest_payment.get("duration_days", 28)) if latest_payment else 28

        if refund_type == "full":
            refund_amount = prc_paid
        elif refund_type == "prorated" and current_expiry and current_expiry > now:
            remaining_days = max(0, (current_expiry - now).days)
            refund_amount = round(prc_paid * remaining_days / total_days, 2) if total_days > 0 else 0
        # else: no refund

        # Reset user subscription to explorer
        await db.users.update_one({"uid": uid}, {"$set": {
            "subscription_plan": "explorer",
            "subscription_status": "cancelled",
            "subscription_expiry": now.isoformat(),
            "subscription_expires": now,
        }})

        # Update payment record
        if latest_payment:
            await db.subscription_payments.update_one(
                {"user_id": uid, "created_at": latest_payment.get("created_at")},
                {"$set": {
                    "status": "cancelled",
                    "cancelled_at": now.isoformat(),
                    "cancelled_by_admin": admin_uid,
                    "cancel_reason": note,
                    "refund_type": refund_type,
                    "refund_amount": round(refund_amount, 2),
                }}
            )

        # Refund PRC
        if refund_amount > 0:
            await db.users.update_one({"uid": uid}, {"$inc": {"prc_balance": refund_amount}})
            await db.transactions.insert_one({
                "user_id": uid,
                "type": "subscription_refund",
                "amount": refund_amount,
                "description": f"Subscription cancelled & {refund_type} refund by Admin ({round(refund_amount, 2)} PRC)",
                "timestamp": now,
                "created_at": now.isoformat(),
                "status": "completed",
                "admin_action": True,
                "admin_uid": admin_uid,
            })
    else:
        raise HTTPException(status_code=400, detail="Invalid target. Use 'current' or 'upcoming'")

    # Audit log
    await db.admin_actions.insert_one({
        "admin_uid": admin_uid,
        "admin_name": admin.get("name", "Admin"),
        "action": "subscription_cancel",
        "target_uid": uid,
        "target_name": user.get("name", "User"),
        "details": {
            "target": target,
            "refund_type": refund_type,
            "refund_amount": round(refund_amount, 2),
            "note": note,
        },
        "timestamp": now.isoformat(),
    })

    return {
        "success": True,
        "message": f"Subscription cancelled. Refund: {round(refund_amount, 2)} PRC ({refund_type})",
        "refund_amount": round(refund_amount, 2),
        "refund_type": refund_type,
    }


# ==============================
# Utility: Check & Activate Upcoming Plans
# ==============================
async def check_and_activate_upcoming(uid: str):
    """
    Called on dashboard load / login.
    If current plan expired and there's an upcoming plan, activate it.
    """
    db = get_db()
    user = await db.users.find_one({"uid": uid})
    if not user:
        return None

    now = datetime.now(timezone.utc)
    current_expiry = parse_expiry(user.get("subscription_expiry") or user.get("subscription_expires"))
    plan = user.get("subscription_plan", "explorer")

    # Only proceed if current plan is expired or user is on explorer
    has_active = plan not in ["explorer", "free", None] and current_expiry and current_expiry > now
    if has_active:
        return None

    # Find earliest upcoming plan
    upcoming = await db.subscription_payments.find_one(
        {"user_id": uid, "status": "upcoming"},
        {"_id": 0},
        sort=[("scheduled_start", 1)]
    )

    if not upcoming:
        return None

    # Activate the upcoming plan
    duration_days = int(upcoming.get("duration_days", 28))
    start = now
    end = start + timedelta(days=duration_days)

    await db.users.update_one({"uid": uid}, {"$set": {
        "subscription_plan": upcoming.get("plan_name", "elite"),
        "subscription_status": "active",
        "subscription_start": start.isoformat(),
        "subscription_expiry": end.isoformat(),
        "subscription_expires": end,
        "subscription_payment_type": upcoming.get("payment_method", "prc"),
        "membership_type": "vip",
    }})

    # Update payment record
    await db.subscription_payments.update_one(
        {"user_id": uid, "payment_id": upcoming.get("payment_id"), "status": "upcoming"},
        {"$set": {
            "status": "paid",
            "subscription_start": start.isoformat(),
            "subscription_expiry": end.isoformat(),
            "activated_at": now.isoformat(),
        }}
    )

    logging.info(f"[UPCOMING-SUB] Activated upcoming plan for {uid}: {upcoming.get('plan_name')} until {end.isoformat()[:10]}")

    return {
        "activated": True,
        "plan_name": upcoming.get("plan_name", "elite"),
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "duration_days": duration_days,
    }


# ==============================
# GET: User-facing subscription info (for dashboard)
# ==============================
@router.get("/user/{uid}/info")
async def get_user_subscription_info(uid: str):
    """Public endpoint for user dashboard — shows current + upcoming plan."""
    db = get_db()

    # First, check and activate any pending upcoming plans
    activation_result = await check_and_activate_upcoming(uid)

    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)

    # Current plan
    current_plan = None
    plan_name = user.get("subscription_plan")
    expiry_dt = parse_expiry(user.get("subscription_expiry") or user.get("subscription_expires"))
    start_dt = parse_expiry(user.get("subscription_start"))

    if plan_name and plan_name not in ["explorer", "free", None] and expiry_dt and expiry_dt > now:
        current_plan = {
            "plan_name": plan_name,
            "status": "active",
            "start_date": start_dt.isoformat() if start_dt else None,
            "end_date": expiry_dt.isoformat(),
            "remaining_days": max(0, (expiry_dt - now).days),
        }

    # Upcoming plans
    upcoming = []
    cursor = db.subscription_payments.find(
        {"user_id": uid, "status": "upcoming"},
        {"_id": 0, "plan_name": 1, "scheduled_start": 1, "scheduled_end": 1, "duration_days": 1, "created_at": 1}
    ).sort("scheduled_start", 1)
    async for doc in cursor:
        upcoming.append({
            "plan_name": doc.get("plan_name", "elite"),
            "scheduled_start": doc.get("scheduled_start"),
            "scheduled_end": doc.get("scheduled_end"),
            "duration_days": doc.get("duration_days", 28),
        })

    return {
        "success": True,
        "current_plan": current_plan,
        "upcoming_plans": upcoming,
        "just_activated": activation_result,
    }
