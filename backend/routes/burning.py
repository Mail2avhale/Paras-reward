"""
Auto-Burning System for Expired Subscriptions
=============================================
- When Elite subscription expires, PRC balance burns at 3.33%/day
- Auto-activates on expiry, auto-disables on subscription renewal
- No stop button - only way to stop is renew subscription
- Burns from available balance, stops at 0 (no negative)
- Logs each burn in PRC statement
"""
import logging
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

router = APIRouter(prefix="/burning", tags=["Auto Burning"])

db = None

def set_db(database):
    global db
    db = database

DAILY_BURN_PERCENT = 3.33  # 3.33% of balance per day
BURN_PER_SECOND_FACTOR = DAILY_BURN_PERCENT / 100 / 86400  # per-second rate


def is_subscription_active(user: dict) -> bool:
    """
    BULLETPROOF check if user has active Elite subscription.
    Rules:
    1. If subscription_plan is "explorer" or empty → NOT active
    2. If subscription_status == "active" → ACTIVE
    3. If any expiry date is in the future → ACTIVE
    4. If plan is elite/vip/etc BUT no expiry AND no status → ASSUME ACTIVE (missing data shouldn't trigger burn)
    5. If plan is elite/vip AND expiry is in the past → EXPIRED (not active)
    """
    plan = user.get("subscription_plan", "explorer").lower()
    
    # Rule 1: Explorer = not active
    if plan in ["explorer", "free", "", "none"]:
        return False
    
    # Rule 2: Explicit active status
    if user.get("subscription_status") == "active":
        return True
    
    # Rule 3: Check expiry dates
    now = datetime.now(timezone.utc)
    has_expiry = False
    for field in ["subscription_expires", "subscription_expiry", "subscription_end_date"]:
        end_date = user.get(field)
        if not end_date:
            continue
        has_expiry = True
        if isinstance(end_date, str):
            try:
                end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except Exception:
                continue
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
        if end_date > now:
            return True
    
    # Rule 4: Paid plan but NO expiry data → assume active (defensive)
    if not has_expiry and plan in ["elite", "vip", "startup", "growth", "pro", "premium"]:
        return True
    
    # Rule 5: Paid plan with expiry in the past → expired
    # Also check subscription_expired flag
    if user.get("subscription_expired") == True:
        return False
    
    return False


async def process_burn(uid: str) -> dict:
    """
    Calculate and apply burn for a user with expired subscription.
    Returns burn status info.
    """
    if db is None:
        return {"burning_active": False, "error": "DB not available"}

    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        return {"burning_active": False, "error": "User not found"}

    # If subscription active, no burning
    if is_subscription_active(user):
        # Clear burn timestamp if exists
        if user.get("burn_last_checked"):
            await db.users.update_one({"uid": uid}, {"$unset": {"burn_last_checked": ""}})
        return {
            "burning_active": False,
            "reason": "subscription_active",
            "subscription_plan": user.get("subscription_plan", "explorer"),
        }

    balance = user.get("prc_balance", 0)

    # If balance is 0 or less, nothing to burn
    if balance <= 0:
        return {
            "burning_active": True,
            "balance": 0,
            "daily_burn_rate": 0,
            "per_second_rate": 0,
            "burned_now": 0,
            "message": "Balance is zero, no PRC to burn",
        }

    now = datetime.now(timezone.utc)
    last_checked = user.get("burn_last_checked")

    burned_amount = 0

    if last_checked:
        # Calculate time elapsed since last check
        if isinstance(last_checked, str):
            try:
                last_checked = datetime.fromisoformat(last_checked.replace("Z", "+00:00"))
            except Exception:
                last_checked = now

        if last_checked.tzinfo is None:
            last_checked = last_checked.replace(tzinfo=timezone.utc)

        elapsed_seconds = (now - last_checked).total_seconds()
        if elapsed_seconds > 0:
            # Calculate burn: balance × 3.33% / 86400 × seconds
            burned_amount = balance * BURN_PER_SECOND_FACTOR * elapsed_seconds
            burned_amount = min(burned_amount, balance)  # Don't go negative
            burned_amount = round(burned_amount, 6)

            if burned_amount > 0:
                new_balance = max(0, balance - burned_amount)
                # Deduct from balance
                await db.users.update_one(
                    {"uid": uid},
                    {
                        "$set": {
                            "prc_balance": round(new_balance, 6),
                            "burn_last_checked": now.isoformat(),
                        }
                    },
                )
                # Log in PRC statement
                await db.prc_transactions.insert_one({
                    "uid": uid,
                    "type": "auto_burn",
                    "amount": -burned_amount,
                    "balance_after": round(new_balance, 6),
                    "description": f"Auto-burn (No active subscription) - {DAILY_BURN_PERCENT}%/day",
                    "created_at": now.isoformat(),
                    "burn_rate_percent": DAILY_BURN_PERCENT,
                    "elapsed_seconds": elapsed_seconds,
                })
                balance = new_balance
    else:
        # First time - set burn start timestamp
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"burn_last_checked": now.isoformat()}}
        )

    # Current burn rates based on current balance
    daily_burn = balance * DAILY_BURN_PERCENT / 100
    per_second = balance * BURN_PER_SECOND_FACTOR

    return {
        "burning_active": True,
        "balance": round(balance, 2),
        "daily_burn_rate": round(daily_burn, 2),
        "daily_burn_percent": DAILY_BURN_PERCENT,
        "per_second_rate": round(per_second, 6),
        "burned_now": round(burned_amount, 6),
        "message": "Renew Elite subscription to stop burning!",
    }


@router.get("/status/{uid}")
async def get_burning_status(uid: str):
    """Get burning status and process any pending burns"""
    result = await process_burn(uid)
    return result


@router.get("/history/{uid}")
async def get_burning_history(uid: str, limit: int = 20):
    """Get auto-burn history from PRC transactions"""
    if db is None:
        raise HTTPException(status_code=500, detail="DB not available")

    burns = await db.prc_transactions.find(
        {"uid": uid, "type": "auto_burn"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    total_burned = sum(abs(b.get("amount", 0)) for b in burns)

    return {
        "burns": burns,
        "total_burned": round(total_burned, 2),
        "count": len(burns),
    }


async def run_auto_burn_all_expired():
    """
    Background cron job: Burns PRC for ALL users with expired subscriptions.
    Runs every 12 hours via APScheduler.
    """
    if db is None:
        logging.warning("[AUTO-BURN-JOB] DB not available, skipping")
        return

    now = datetime.now(timezone.utc)
    logging.info(f"[AUTO-BURN-JOB] Starting auto-burn sweep at {now.isoformat()}")

    # Find all users with balance > 0 who are NOT on active subscription
    cursor = db.users.find(
        {"prc_balance": {"$gt": 0.01}},
        {"_id": 0, "uid": 1, "name": 1, "prc_balance": 1,
         "subscription_plan": 1, "subscription_status": 1,
         "subscription_expires": 1, "subscription_expiry": 1,
         "subscription_end_date": 1, "burn_last_checked": 1}
    )

    users_burned = 0
    total_prc_burned = 0.0
    users_skipped = 0
    errors = 0

    async for user in cursor:
        uid = user.get("uid")
        if not uid:
            continue

        try:
            # Check if subscription is active — skip active users
            if is_subscription_active(user):
                users_skipped += 1
                continue

            balance = user.get("prc_balance", 0)
            if balance <= 0.01:
                continue

            last_checked = user.get("burn_last_checked")
            burned_amount = 0.0

            if last_checked:
                if isinstance(last_checked, str):
                    try:
                        last_checked = datetime.fromisoformat(last_checked.replace("Z", "+00:00"))
                    except Exception:
                        last_checked = now

                if last_checked.tzinfo is None:
                    last_checked = last_checked.replace(tzinfo=timezone.utc)

                elapsed_seconds = (now - last_checked).total_seconds()
                if elapsed_seconds > 60:  # Only burn if >1 minute elapsed
                    burned_amount = balance * BURN_PER_SECOND_FACTOR * elapsed_seconds
                    burned_amount = min(burned_amount, balance)
                    burned_amount = round(burned_amount, 6)
            else:
                # First encounter — just set the timestamp, burn starts next run
                await db.users.update_one(
                    {"uid": uid},
                    {"$set": {"burn_last_checked": now.isoformat()}}
                )
                continue

            if burned_amount > 0.001:
                new_balance = max(0, round(balance - burned_amount, 6))
                await db.users.update_one(
                    {"uid": uid},
                    {"$set": {
                        "prc_balance": new_balance,
                        "burn_last_checked": now.isoformat(),
                    }}
                )
                await db.prc_transactions.insert_one({
                    "uid": uid,
                    "type": "auto_burn",
                    "amount": -burned_amount,
                    "balance_after": new_balance,
                    "description": f"Auto-burn (Expired subscription) - {DAILY_BURN_PERCENT}%/day [cron]",
                    "created_at": now.isoformat(),
                    "burn_rate_percent": DAILY_BURN_PERCENT,
                    "elapsed_seconds": (now - last_checked).total_seconds(),
                })
                users_burned += 1
                total_prc_burned += burned_amount
            else:
                # Update timestamp even if burn amount is negligible
                await db.users.update_one(
                    {"uid": uid},
                    {"$set": {"burn_last_checked": now.isoformat()}}
                )

        except Exception as e:
            errors += 1
            logging.error(f"[AUTO-BURN-JOB] Error burning uid={uid}: {e}")

    # Log summary
    summary = {
        "timestamp": now.isoformat(),
        "users_burned": users_burned,
        "total_prc_burned": round(total_prc_burned, 2),
        "users_skipped_active": users_skipped,
        "errors": errors,
        "job_type": "cron_auto_burn",
    }
    await db.burn_job_logs.insert_one(summary)
    logging.info(f"[AUTO-BURN-JOB] Complete: {users_burned} users burned, {total_prc_burned:.2f} PRC total, {users_skipped} active skipped, {errors} errors")
