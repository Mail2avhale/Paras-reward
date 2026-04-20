"""
POOL WALLET & CORE TEAM SYSTEM
================================
1. Mining collect → 20% extra PRC credited to Pool Wallet
2. Daily midnight → Pool balance distributed equally to Core Team
3. Admin: Add/Remove core team members, change pool rate, manual distribute
4. User: See pool balance + core team count on dashboard
5. PRC Statement: "Core Team Bonus - Pool Distribution"
"""

import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/pool-wallet", tags=["Pool Wallet"])

db = None
cache = None

# Concurrency guard: prevents multiple concurrent distribution runs
# (e.g., startup catch-up firing simultaneously with the regular cron)
_distribution_lock = None  # Lazy-init in distribute_pool_to_core_team


def set_db(database):
    global db
    db = database


def set_cache(cache_instance):
    global cache
    cache = cache_instance


# ==================== SETTINGS ====================

DEFAULT_POOL_RATE = 20  # 20% of mining collect goes to pool


async def get_pool_settings() -> dict:
    """Get pool wallet settings from DB or defaults."""
    settings = await db.pool_wallet_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "pool_rate": DEFAULT_POOL_RATE,
            "auto_distribute": True,
            "distribute_hour": 0,
            "distribute_minute": 0,
            "enabled": True,
        }
        await db.pool_wallet_settings.update_one(
            {}, {"$set": settings}, upsert=True
        )
    return settings


async def get_pool_balance() -> float:
    """Get current pool wallet balance."""
    wallet = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0, "balance": 1})
    return float(wallet.get("balance", 0)) if wallet else 0.0


# ==================== POOL CREDIT (called from mining collect) ====================

async def credit_pool_wallet(user_id: str, mined_amount: float, user_name: str = ""):
    """
    Credit pool wallet with % of mining collect.
    Called from mining.py collect_mining() after user PRC is credited.
    """
    try:
        settings = await get_pool_settings()
        if not settings.get("enabled"):
            return 0

        pool_rate = settings.get("pool_rate", DEFAULT_POOL_RATE)
        pool_amount = round(mined_amount * pool_rate / 100, 6)

        if pool_amount <= 0:
            return 0

        # Atomic increment pool balance
        result = await db.pool_wallet.find_one_and_update(
            {"wallet_id": "main"},
            {
                "$inc": {"balance": pool_amount, "total_credited": pool_amount},
                "$set": {"last_updated": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True,
            return_document=True,
            projection={"_id": 0, "balance": 1}
        )

        new_balance = float(result.get("balance", pool_amount)) if result else pool_amount

        # Log transaction
        await db.pool_wallet_transactions.insert_one({
            "txn_id": str(uuid.uuid4()),
            "type": "credit",
            "amount": pool_amount,
            "balance_after": round(new_balance, 6),
            "source_user_id": user_id,
            "source_user_name": user_name,
            "description": f"Mining collect: {pool_rate}% of {mined_amount:.4f} PRC",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        return pool_amount

    except Exception as e:
        logging.error(f"[POOL WALLET] Credit error: {e}")
        return 0


# ==================== DISTRIBUTION ====================

async def distribute_pool_to_core_team(triggered_by: str = "auto"):
    """
    Distribute pool wallet balance equally to all active core team members.
    Only Elite subscription members receive distribution.
    
    Concurrency-safe:
    - Uses asyncio lock to prevent concurrent runs (startup catch-up + cron collision).
    - Uses math.floor + conditional atomic $inc to guarantee balance never goes negative.
    """
    global _distribution_lock
    if _distribution_lock is None:
        import asyncio
        _distribution_lock = asyncio.Lock()
    
    # Try to acquire lock; if already running, skip this invocation
    if _distribution_lock.locked():
        logging.warning("[POOL WALLET] Distribution already in progress - skipping concurrent run")
        return {"success": False, "skipped": True, "message": "Already running"}
    
    async with _distribution_lock:
        return await _distribute_pool_to_core_team_inner(triggered_by)


async def _distribute_pool_to_core_team_inner(triggered_by: str = "auto"):
    try:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        pool_balance = await get_pool_balance()
        if pool_balance <= 0:
            logging.info("[POOL WALLET] No balance to distribute")
            # Defensive heal: if balance is negative, reset to 0 (data integrity)
            if pool_balance < 0:
                await db.pool_wallet.update_one(
                    {"wallet_id": "main"},
                    {"$set": {"balance": 0.0, "last_updated": now_iso}}
                )
                logging.warning(f"[POOL WALLET] Negative balance {pool_balance} auto-healed to 0")
            return {"success": True, "distributed": 0, "members": 0, "message": "No balance to distribute"}

        # Get active core team members with active Elite subscription
        active_members = await db.core_team_members.find(
            {"status": "active"},
            {"_id": 0, "uid": 1}
        ).to_list(1000)

        if not active_members:
            logging.info("[POOL WALLET] No active core team members")
            return {"success": True, "distributed": 0, "members": 0, "message": "No active core team members"}

        # Filter: only Elite subscription active
        # Check actual expiry date + status (not just stale subscription_expired flag)
        eligible_uids = []
        for m in active_members:
            uid = m.get("uid")
            user = await db.users.find_one(
                {"uid": uid, "subscription_plan": {"$in": ["elite", "vip", "startup", "growth", "pro"]}},
                {"_id": 0, "uid": 1, "name": 1, "subscription_expired": 1, "subscription_expiry": 1, "subscription_expires": 1, "subscription_status": 1}
            )
            if not user:
                continue

            # Check real subscription validity using expiry date
            expiry = user.get("subscription_expiry") or user.get("subscription_expires")
            expiry_dt = None
            if expiry:
                try:
                    if isinstance(expiry, str):
                        expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00').replace(' ', 'T'))
                    else:
                        expiry_dt = expiry
                    if expiry_dt.tzinfo is None:
                        expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
                except Exception:
                    expiry_dt = None

            is_really_active = (
                expiry_dt is not None and expiry_dt > now
                and user.get("subscription_status") != "expired"
                and user.get("subscription_status") != "cancelled"
            )

            if is_really_active:
                eligible_uids.append({"uid": uid, "name": user.get("name", "")})
                # Auto-heal stale subscription_expired flag if plan is actually active
                if user.get("subscription_expired"):
                    await db.users.update_one(
                        {"uid": uid},
                        {"$set": {"subscription_expired": False, "subscription_status": "active"}}
                    )
                    logging.info(f"[POOL WALLET] Cleared stale subscription_expired flag for {uid}")

        if not eligible_uids:
            logging.info("[POOL WALLET] No eligible core team members (need active Elite)")
            return {"success": True, "distributed": 0, "members": 0, "message": "No eligible members with active Elite subscription"}

        # CRITICAL: Use math.floor (NOT round) to prevent over-distribution
        # Example: pool=10.000001 / 3 members:
        #   round(3.333333667, 6) = 3.333334  → 3.333334 * 3 = 10.000002 (OVER!)
        #   floor(3.333333667 * 1e6)/1e6 = 3.333333 → 3.333333 * 3 = 9.999999 (SAFE)
        member_count = len(eligible_uids)
        raw_share = pool_balance / member_count
        per_member = math.floor(raw_share * 1_000_000) / 1_000_000  # 6-decimal floor
        if per_member <= 0:
            return {"success": True, "distributed": 0, "members": member_count, "message": "Amount too small to distribute"}

        # Compute total_distributed UP-FRONT (never exceeds pool_balance due to floor)
        total_distributed = round(per_member * member_count, 6)
        if total_distributed > pool_balance:
            # Should never happen with floor, but defensive clamp
            per_member = math.floor(pool_balance / member_count * 1_000_000) / 1_000_000
            total_distributed = round(per_member * member_count, 6)

        # ATOMIC CONDITIONAL DEDUCT: only succeeds if current balance >= total_distributed
        deduct_result = await db.pool_wallet.update_one(
            {"wallet_id": "main", "balance": {"$gte": total_distributed}},
            {
                "$inc": {"balance": -total_distributed, "total_distributed": total_distributed},
                "$set": {"last_distributed": now_iso, "last_updated": now_iso}
            }
        )
        if deduct_result.modified_count == 0:
            logging.error(f"[POOL WALLET] Atomic deduct failed - balance changed during run (expected>={total_distributed}). Aborting.")
            return {"success": False, "distributed": 0, "members": member_count, "message": "Balance changed - aborted to prevent negative"}

        # Distribute to each member (credits happen AFTER successful deduct)
        distributed_count = 0
        for member in eligible_uids:
            uid = member["uid"]
            try:
                # Credit PRC to user
                await db.users.update_one(
                    {"uid": uid},
                    {"$inc": {"prc_balance": per_member}}
                )

                # Log in transactions (for PRC statement)
                await db.transactions.insert_one({
                    "transaction_id": f"POOL-{str(uuid.uuid4())[:8]}",
                    "user_id": uid,
                    "type": "core_team_bonus",
                    "amount": per_member,
                    "description": "Core Team Bonus - Pool Distribution",
                    "balance_after": 0,
                    "timestamp": now_iso,
                    "created_at": now_iso,
                })

                distributed_count += 1

                # Clear cache
                if cache:
                    await cache.delete(f"user_data:{uid}")
                    await cache.delete(f"user:dashboard:{uid}")

            except Exception as e:
                logging.error(f"[POOL WALLET] Distribution error for {uid}: {e}")

        # Log distribution transaction
        await db.pool_wallet_transactions.insert_one({
            "txn_id": str(uuid.uuid4()),
            "type": "distribution",
            "amount": total_distributed,
            "balance_after": round(pool_balance - total_distributed, 6),
            "members_count": distributed_count,
            "per_member": per_member,
            "triggered_by": triggered_by,
            "description": f"Distributed {total_distributed:.4f} PRC to {distributed_count} core team members ({per_member:.4f} each)",
            "timestamp": now_iso,
        })

        logging.info(f"[POOL WALLET] Distributed {total_distributed:.4f} PRC to {distributed_count} members ({per_member:.4f} each)")

        return {
            "success": True,
            "distributed": round(total_distributed, 4),
            "per_member": round(per_member, 4),
            "members": distributed_count,
            "eligible_members": len(eligible_uids),
            "message": f"Distributed {total_distributed:.4f} PRC to {distributed_count} members"
        }

    except Exception as e:
        logging.error(f"[POOL WALLET] Distribution error: {e}")
        return {"success": False, "error": str(e)}


# ==================== API ENDPOINTS ====================

# --- Public (User-facing) ---

@router.get("/info")
async def get_pool_wallet_info():
    """Public: Get pool wallet balance + core team count (shown on dashboard)."""
    balance = await get_pool_balance()
    team_count = await db.core_team_members.count_documents({"status": "active"})
    settings = await get_pool_settings()

    return {
        "success": True,
        "pool_balance": round(balance, 4),
        "core_team_count": team_count,
        "pool_rate": settings.get("pool_rate", DEFAULT_POOL_RATE),
    }


@router.get("/is-member/{uid}")
async def check_core_team_membership(uid: str):
    """Check if user is a core team member."""
    member = await db.core_team_members.find_one(
        {"uid": uid, "status": "active"}, {"_id": 0, "uid": 1, "added_at": 1}
    )
    return {"is_member": member is not None}


# --- Admin ---

class AddMemberRequest(BaseModel):
    uid: str


@router.post("/admin/add-member")
async def admin_add_core_team_member(data: AddMemberRequest):
    """Admin: Add a user to core team."""
    user = await db.users.find_one({"uid": data.uid}, {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "subscription_plan": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.core_team_members.find_one({"uid": data.uid})
    if existing and existing.get("status") == "active":
        raise HTTPException(status_code=400, detail="User is already a core team member")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.core_team_members.update_one(
        {"uid": data.uid},
        {"$set": {
            "uid": data.uid,
            "name": user.get("name", ""),
            "mobile": user.get("mobile", ""),
            "status": "active",
            "added_at": now_iso,
            "updated_at": now_iso,
        }},
        upsert=True
    )

    # Invalidate user's dashboard cache so pool_wallet.is_core_member updates immediately
    if cache:
        await cache.delete(f"user:dashboard:{data.uid}")

    return {"success": True, "message": f"Added {user.get('name', data.uid)} to core team"}


@router.delete("/admin/remove-member/{uid}")
async def admin_remove_core_team_member(uid: str):
    """Admin: Remove a user from core team."""
    result = await db.core_team_members.update_one(
        {"uid": uid, "status": "active"},
        {"$set": {"status": "removed", "removed_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Member not found or already removed")
    
    # Invalidate user's dashboard cache so pool_wallet.is_core_member updates immediately
    if cache:
        await cache.delete(f"user:dashboard:{uid}")
    
    return {"success": True, "message": "Member removed from core team"}


@router.get("/admin/members")
async def admin_list_core_team():
    """Admin: List all core team members."""
    members = await db.core_team_members.find(
        {"status": "active"}, {"_id": 0}
    ).sort("added_at", -1).to_list(500)
    return {"success": True, "members": members, "count": len(members)}


@router.get("/admin/balance")
async def admin_get_pool_balance():
    """Admin: Get detailed pool wallet info."""
    wallet = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0})
    settings = await get_pool_settings()
    team_count = await db.core_team_members.count_documents({"status": "active"})

    recent_txns = await db.pool_wallet_transactions.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)

    return {
        "success": True,
        "balance": round(float(wallet.get("balance", 0)) if wallet else 0, 4),
        "total_credited": round(float(wallet.get("total_credited", 0)) if wallet else 0, 4),
        "total_distributed": round(float(wallet.get("total_distributed", 0)) if wallet else 0, 4),
        "last_distributed": wallet.get("last_distributed") if wallet else None,
        "settings": settings,
        "core_team_count": team_count,
        "recent_transactions": recent_txns,
    }


class UpdateSettingsRequest(BaseModel):
    pool_rate: Optional[float] = None
    enabled: Optional[bool] = None


@router.put("/admin/settings")
async def admin_update_pool_settings(data: UpdateSettingsRequest):
    """Admin: Update pool wallet settings (rate, enabled)."""
    update_fields = {}
    if data.pool_rate is not None:
        if data.pool_rate < 0 or data.pool_rate > 100:
            raise HTTPException(status_code=400, detail="Pool rate must be 0-100%")
        update_fields["pool_rate"] = data.pool_rate
    if data.enabled is not None:
        update_fields["enabled"] = data.enabled

    if not update_fields:
        raise HTTPException(status_code=400, detail="No settings to update")

    await db.pool_wallet_settings.update_one({}, {"$set": update_fields}, upsert=True)
    return {"success": True, "message": "Settings updated", "updated": update_fields}


@router.post("/admin/distribute")
async def admin_trigger_distribution():
    """Admin: Manually trigger pool distribution."""
    result = await distribute_pool_to_core_team(triggered_by="admin_manual")
    return result


@router.post("/admin/heal-negative-balance")
async def admin_heal_negative_balance():
    """Admin: Reset pool wallet balance to 0 if it has gone negative (data integrity fix)."""
    now = datetime.now(timezone.utc).isoformat()
    wallet = await db.pool_wallet.find_one({"wallet_id": "main"}, {"_id": 0})
    if not wallet:
        return {"success": False, "message": "Pool wallet not initialized"}
    current = float(wallet.get("balance", 0))
    if current >= 0:
        return {"success": True, "healed": False, "balance": current, "message": "Balance is non-negative, no healing needed"}
    await db.pool_wallet.update_one(
        {"wallet_id": "main"},
        {"$set": {"balance": 0.0, "last_updated": now}}
    )
    # Log the heal event for audit
    await db.pool_wallet_transactions.insert_one({
        "txn_id": str(uuid.uuid4()),
        "type": "balance_heal",
        "amount": -current,  # Positive amount "added" to bring negative back to 0
        "balance_before": current,
        "balance_after": 0.0,
        "description": f"Admin healed negative balance {current} → 0 (floating-point rounding fix)",
        "triggered_by": "admin_heal",
        "timestamp": now,
    })
    logging.warning(f"[POOL WALLET] Admin healed negative balance: {current} → 0")
    return {"success": True, "healed": True, "previous_balance": current, "new_balance": 0.0, "message": "Balance healed from {:.4f} to 0".format(current)}
