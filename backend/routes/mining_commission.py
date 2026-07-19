"""
PARAS REWARD — Mining Collect Commission (3-Tier Elite Referral Reward)
========================================================================
Feature: Jul 2026

When any user collects PRC from their main mining session, distribute
1% of the collected amount to each of their FIRST 3 ELITE UPLINES along
the referral chain (skipping non-Elite ancestors — roll-up semantics).

Rules
-----
1. Percentage: 1% per tier, up to 3 tiers. Max total distribution = 3%.
2. Funding: SYSTEM-FUNDED. The collector's PRC is NOT reduced; commission
   PRC is minted on top by incrementing the recipient's balance directly.
3. Elite eligibility (upline): user.subscription_plan OR user.membership_type
   in ELITE_PLANS, AND user.subscription_expired is not True. Roll-up walks
   the referral chain until 3 eligible Elite uplines are found (or the
   chain ends / safety cap of 200 hops).
4. Ledger: Each commission credit produces one row in `prc_ledger` with
   type='mining_referral_reward' and a human-readable description that
   includes the downline user's display name — this is what the PRC
   Statement UI renders on the recipient's screen.
5. Cache invalidation: recipient's dashboard/redeem-limit/perf caches are
   dropped so the incremented balance shows up immediately.
6. Idempotency: driven by a unique `source_ref` composed of collector_uid +
   collect timestamp — the ledger enforces one row per recipient per event
   to prevent double-crediting on retries.

The collect endpoint in routes/mining.py invokes this AFTER the collector's
own credit + ledger insert, wrapped in a try/except so a commission failure
never breaks the collect flow itself.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter

# 10-level Community Bonus table (Feb 16 2026) — used for non-partner-position
# uplines. Import at module level so it's available to the idempotency
# count-limit check as well as the main distribution loop.
from routes.community_levels import (
    get_max_earnable_level_for_uid,
    get_level_percent as _cl_level_percent,
    MAX_LEVEL as _CL_MAX_LEVEL,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# --------- MODULE STATE ----------
db = None  # Injected via set_db() from server.py at startup
cache = None  # Injected via set_cache() if available


def set_db(database) -> None:
    global db
    db = database


def set_cache(cache_manager) -> None:
    global cache
    cache = cache_manager


# --------- PUBLIC READ ENDPOINT ----------
@router.get("/mining/commission-config")
async def public_commission_config():
    """
    Public read-only view of the current mining commission tier config so
    the user-facing Referrals / Growth Network UI can display the live
    earn-potential (tier count, per-tier %, roll-up rules) without needing
    admin auth.

    Returns just the fields the frontend needs — no admin metadata.
    """
    cfg = await _load_commission_config()
    total_pct = round(sum(float(t.get("percent", 0)) for t in cfg["tiers"]), 4)
    return {
        "enabled": cfg["enabled"],
        "tiers": cfg["tiers"],
        "elite_only": cfg["elite_only"],
        "roll_up": cfg["roll_up"],
        "total_percent": total_pct,
        "max_tiers": len(cfg["tiers"]),
    }


# --------- CONSTANTS ----------
ELITE_PLANS = {"elite", "vip", "startup", "growth", "pro"}
DEFAULT_COMMISSION_PCT_PER_TIER = 0.01  # 1% per tier — used as fallback if no admin config
DEFAULT_MAX_TIERS = 3
MAX_CHAIN_WALK = 200  # safety cap so a mis-configured referral loop can't hang the collect

# Admin-controlled config cache — refreshed each collect (Mongo find is
# ~1ms). This lets an admin edit the tier structure from the panel and see
# the change take effect on the very next mining collect without any code
# deploy or backend restart.


async def _load_commission_config() -> dict:
    """
    Read the live commission config from db.app_settings. Falls back to the
    documented default (3 tiers × 1%, Elite-only, roll-up ON) if the doc is
    missing or malformed. Never raises — a bad config must not break the
    collect flow.
    """
    fallback = {
        "enabled": True,
        "tiers": [{"tier": i, "percent": DEFAULT_COMMISSION_PCT_PER_TIER * 100} for i in range(1, DEFAULT_MAX_TIERS + 1)],
        "elite_only": True,
        "roll_up": True,
    }
    if db is None:
        return fallback
    try:
        doc = await db.app_settings.find_one(
            {"key": "mining_commission_tiers"},
            {"_id": 0, "enabled": 1, "tiers": 1, "elite_only": 1, "roll_up": 1},
        )
    except Exception as e:
        logger.warning(f"[MINING-COMMISSION] Config load failed, using default: {e}")
        return fallback
    if not doc:
        return fallback
    tiers = doc.get("tiers") or fallback["tiers"]
    # Coerce any bad rows to safe values
    safe_tiers = []
    for idx, row in enumerate(tiers, start=1):
        try:
            pct = float(row.get("percent", 0)) if isinstance(row, dict) else float(row)
            if pct < 0 or pct > 100:
                pct = 0
            safe_tiers.append({"tier": idx, "percent": pct})
        except Exception:
            safe_tiers.append({"tier": idx, "percent": 0})
    return {
        "enabled": bool(doc.get("enabled", True)),
        "tiers": safe_tiers,
        "elite_only": bool(doc.get("elite_only", True)),
        "roll_up": bool(doc.get("roll_up", True)),
    }


# --------- HELPERS ----------
def _is_elite_active(user_doc: dict) -> bool:
    """
    An upline is eligible to receive commission iff:
      • plan or membership signals Elite, AND
      • subscription_expired is not explicitly True.
    """
    if not user_doc:
        return False
    plan = (user_doc.get("subscription_plan") or "").lower()
    membership = (user_doc.get("membership_type") or "").lower()
    if plan not in ELITE_PLANS and membership not in ELITE_PLANS:
        return False
    if user_doc.get("subscription_expired") is True:
        return False
    return True


def _display_name(user_doc: dict) -> str:
    name = (user_doc.get("name") or "").strip()
    if name:
        return name
    fn = (user_doc.get("first_name") or "").strip()
    ln = (user_doc.get("last_name") or "").strip()
    combined = f"{fn} {ln}".strip()
    return combined or user_doc.get("uid") or "User"


async def _resolve_referrer(referred_by: str) -> Optional[dict]:
    """
    referred_by may be stored as either a uid or a referral_code.
    Return the referrer user document (or None).
    """
    if not referred_by:
        return None
    return await db.users.find_one(
        {"$or": [{"uid": referred_by}, {"referral_code": referred_by}]},
        {
            "_id": 0,
            "uid": 1,
            "name": 1,
            "first_name": 1,
            "last_name": 1,
            "subscription_plan": 1,
            "membership_type": 1,
            "subscription_expired": 1,
            "referred_by": 1,
            "referral_code": 1,
            "prc_balance": 1,
            "partner_position": 1,
        },
    )


# --------- MAIN API ----------
async def distribute_mining_collect_commission(
    collector_uid: str,
    collected_prc: float,
    collect_timestamp: Optional[datetime] = None,
) -> dict:
    """
    Walk the referral chain from `collector_uid` upward, awarding tier-N% of
    `collected_prc` to the first N Elite uplines encountered (per admin
    config). Non-Elite ancestors are skipped when roll_up is ON.

    Reads live tier config from db.app_settings on every call so admin edits
    take effect immediately.
    """
    if db is None:
        logger.error("[MINING-COMMISSION] db not injected — commission skipped")
        return {"distributed": [], "skipped_tiers": 0, "total_distributed": 0.0}

    if not collector_uid or not collected_prc or collected_prc <= 0:
        return {"distributed": [], "skipped_tiers": 0, "total_distributed": 0.0}

    config = await _load_commission_config()
    if not config["enabled"]:
        logger.info("[MINING-COMMISSION] Feature disabled by admin — skipping")
        return {"distributed": [], "skipped_tiers": 0, "total_distributed": 0.0, "disabled": True}

    tiers = config["tiers"]
    elite_only = config["elite_only"]
    roll_up = config["roll_up"]
    max_tiers = len(tiers)
    if max_tiers == 0:
        return {"distributed": [], "skipped_tiers": 0, "total_distributed": 0.0}

    ts = collect_timestamp or datetime.now(timezone.utc)
    ts_iso = ts.isoformat()

    # Fetch collector name for the ledger description shown on recipient's statement.
    collector = await db.users.find_one(
        {"uid": collector_uid},
        {"_id": 0, "uid": 1, "name": 1, "first_name": 1, "last_name": 1, "referred_by": 1},
    )
    if not collector:
        return {"distributed": [], "skipped_tiers": max_tiers, "total_distributed": 0.0}

    collector_name = _display_name(collector)

    # Idempotency key — one commission event per (collector, timestamp).
    source_ref = f"mining_collect:{collector_uid}:{ts_iso}"

    already_distributed = await db.prc_ledger.count_documents(
        {"source_ref": source_ref, "type": "mining_referral_reward"},
        limit=max(max_tiers, _CL_MAX_LEVEL) + 1,
    )
    if already_distributed > 0:
        logger.info(
            f"[MINING-COMMISSION] Idempotent skip — event {source_ref} already "
            f"distributed ({already_distributed} rows exist)"
        )
        return {
            "distributed": [],
            "skipped_tiers": max_tiers - already_distributed,
            "total_distributed": 0.0,
            "idempotent_skip": True,
        }

    distributed: list[dict] = []
    already_paid: set[str] = {collector_uid}
    current_referred_by = collector.get("referred_by")
    hops = 0
    tier_idx = 0  # index into config["tiers"] (only used for legacy USER-position fallback)
    # Feb 16 2026 — walk up to the deepest possible tier depth. USER position
    # now uses the 10-level Community Bonus table (up to L10), NATIONAL still
    # tops out at L7. Take the max of all + legacy config length.
    max_walk = max(max_tiers, 7, _CL_MAX_LEVEL)

    while hops < max_walk and hops < MAX_CHAIN_WALK:
        hops += 1
        if not current_referred_by:
            break

        upline = await _resolve_referrer(current_referred_by)
        if not upline:
            break

        upline_uid = upline.get("uid")
        if not upline_uid or upline_uid in already_paid:
            break

        upline_is_elite = _is_elite_active(upline)
        eligible = upline_is_elite if elite_only else True

        # ── COMMUNITY LEADER overlay (Feb 16 2026) ─────────────────────
        # If this upline has a non-USER partner_position AND their downline
        # structure is valid, apply the Role Multiplier to their base
        # 10-level Community Bonus. Otherwise fall through to plain 10-level.
        # Elite-plan gate applies to BOTH paths.
        upline_position = (upline.get("partner_position") or "user").lower().strip()
        use_position_path = upline_position != "user"
        leader_multiplier = 1.0
        if use_position_path:
            try:
                from routes.partner_positions import is_structure_valid
                from routes.community_leader import get_role_multiplier as _cldr_get_mult
                structure_ok = await is_structure_valid(upline_uid, upline_position)
                if not structure_ok:
                    use_position_path = False
                else:
                    leader_multiplier = await _cldr_get_mult(upline_position)
            except Exception:
                use_position_path = False

        if not eligible:
            if roll_up:
                current_referred_by = upline.get("referred_by")
                continue
            else:
                tier_idx += 1
                current_referred_by = upline.get("referred_by")
                continue

        # Compute this tier's PRC amount.
        # Both paths derive BASE % from the 10-level table; leader path
        # multiplies by the role multiplier.
        try:
            max_earnable = await get_max_earnable_level_for_uid(
                upline_uid, upline.get("referral_code")
            )
        except Exception as _lvl_err:
            logger.warning(f"[MINING-COMMISSION] level lookup failed for {upline_uid}: {_lvl_err}")
            max_earnable = 3  # safe fallback

        if hops > max_earnable:
            tier_idx += 1
            current_referred_by = upline.get("referred_by")
            continue

        base_pct = _cl_level_percent(hops)
        tier_percent = round(base_pct * leader_multiplier, 4)
        effective_tier_index = hops
        per_tier_amount = round(collected_prc * (tier_percent / 100.0), 6)
        if per_tier_amount <= 0:
            tier_idx += 1
            current_referred_by = upline.get("referred_by")
            continue

        recipient_name = _display_name(upline)

        # ── MONTHLY REWARD CEILING (Feb 20 2026 — Q2=a silent skip) ─────
        # Enforce role-based monthly cap. If crediting this commission
        # would push the recipient over their calendar-month cap, SKIP
        # silently — no ledger row, no balance change, no roll-up.
        try:
            from routes.community_reward_caps import can_credit as _cap_can_credit
            allowed, cap_prc, used_prc = await _cap_can_credit(
                upline_uid, upline_position, per_tier_amount
            )
        except Exception as _cap_err:
            logger.warning(f"[MINING-COMMISSION] cap check failed for {upline_uid}: {_cap_err}")
            allowed, cap_prc, used_prc = True, 0.0, 0.0

        if not allowed:
            logger.info(
                f"[MINING-COMMISSION] Skipped {per_tier_amount:.4f} PRC to "
                f"{upline_uid} (role={upline_position}) — monthly cap reached "
                f"({used_prc:.2f} / {cap_prc:.2f} PRC used)"
            )
            already_paid.add(upline_uid)
            tier_idx += 1
            current_referred_by = upline.get("referred_by")
            continue

        credited = await _credit_commission(
            recipient_uid=upline_uid,
            amount=per_tier_amount,
            collector_uid=collector_uid,
            collector_name=collector_name,
            collected_prc=collected_prc,
            tier_index=effective_tier_index,
            tier_percent=tier_percent,
            source_ref=source_ref,
            timestamp=ts,
        )
        if credited:
            distributed.append({
                "uid": upline_uid,
                "name": recipient_name,
                "prc": per_tier_amount,
                "tier": effective_tier_index,
                "percent": tier_percent,
            })
            already_paid.add(upline_uid)

        tier_idx += 1
        current_referred_by = upline.get("referred_by")

    total = round(sum(d["prc"] for d in distributed), 6)
    if distributed:
        logger.info(
            f"[MINING-COMMISSION] collector={collector_uid} collected={collected_prc:.4f} → "
            f"credited {len(distributed)}/{max_tiers} uplines (total {total:.4f} PRC)"
        )

    return {
        "distributed": distributed,
        "skipped_tiers": max_tiers - len(distributed),
        "total_distributed": total,
        "config_tier_count": max_tiers,
    }


async def _credit_commission(
    *,
    recipient_uid: str,
    amount: float,
    collector_uid: str,
    collector_name: str,
    collected_prc: float,
    tier_index: int,
    tier_percent: float,
    source_ref: str,
    timestamp: datetime,
) -> bool:
    """
    Credit `amount` PRC to `recipient_uid`, insert an idempotent prc_ledger
    row, dispatch a "Live Referral Ping" notification, and invalidate their
    caches. Returns True on success.
    """
    ts_iso = timestamp.isoformat()

    # Idempotency check — has this exact commission already been posted?
    existing = await db.prc_ledger.find_one(
        {
            "user_id": recipient_uid,
            "source_ref": source_ref,
            "tier_index": tier_index,
        },
        {"_id": 1},
    )
    if existing:
        logger.info(
            f"[MINING-COMMISSION] Idempotent skip — commission already credited "
            f"(recipient={recipient_uid}, source={source_ref}, tier={tier_index})"
        )
        return False

    # Atomic wallet increment + fetch new balance.
    updated = await db.users.find_one_and_update(
        {"uid": recipient_uid},
        {"$inc": {"prc_balance": amount}},
        return_document=True,
        projection={"_id": 0, "prc_balance": 1},
    )
    if not updated:
        logger.warning(
            f"[MINING-COMMISSION] Recipient {recipient_uid} not found — commission not credited"
        )
        return False

    new_balance = round(float(updated.get("prc_balance", 0)), 6)
    balance_before = round(new_balance - amount, 6)

    description = (
        f"Mining Referral Reward — you received {amount:.4f} PRC from "
        f"{collector_name} (Tier {tier_index}, {tier_percent:.2f}% of {collected_prc:.4f} PRC collected)"
    )

    try:
        await db.prc_ledger.insert_one(
            {
                "txn_id": str(uuid.uuid4()),
                "user_id": recipient_uid,
                "type": "mining_referral_reward",
                "entry_type": "credit",
                "amount": amount,
                "balance_before": balance_before,
                "balance_after": new_balance,
                "reference": ts_iso,
                "service_type": "mining_referral",
                "service_label": "Mining Referral",
                "service_ref_id": source_ref,
                "source_ref": source_ref,
                "tier_index": tier_index,
                "tier_percent": tier_percent,
                "downline_uid": collector_uid,
                "downline_name": collector_name,
                "downline_collect_amount": collected_prc,
                "description": description,
                "timestamp": ts_iso,
                "created_at": ts_iso,
            }
        )
    except Exception as ledger_err:
        logger.error(
            f"[MINING-COMMISSION] Ledger insert failed — rolling back +{amount} PRC "
            f"on {recipient_uid}: {ledger_err}"
        )
        try:
            await db.users.update_one({"uid": recipient_uid}, {"$inc": {"prc_balance": -amount}})
        except Exception:
            pass
        return False

    # NOTE (Feb 2026 duplicate-fix): We NO LONGER dual-write to the legacy
    # `transactions` collection. That was surfacing duplicate rows in the
    # PRC Statement (once as "Referral Reward" from prc_ledger, once as
    # "Daily Reward Collected" from transactions) because the two writes
    # use independent UUIDs and prc_statement.py dedupes only on `txn_id`.
    # `prc_ledger` is the canonical passbook source — all consumers should
    # read from it. Existing legacy rows are filtered out defensively in
    # prc_statement.py.

    # ── LIVE REFERRAL PING ────────────────────────────────────────────
    # Insert a notification row so the recipient's in-app notification
    # bell pings within the next poll (~30s), and any active mobile push
    # / websocket listener can react in real time. Best-effort — a failure
    # here MUST NOT roll back the credit.
    try:
        await _send_referral_ping(
            recipient_uid=recipient_uid,
            amount=amount,
            collector_name=collector_name,
            collector_uid=collector_uid,
            tier_index=tier_index,
            tier_percent=tier_percent,
            collected_prc=collected_prc,
        )
    except Exception as ping_err:
        logger.warning(f"[MINING-COMMISSION] Ping delivery failed: {ping_err}")

    # Best-effort cache invalidation so the recipient's screens refresh.
    if cache is not None:
        try:
            await cache.delete(f"user_data:{recipient_uid}")
            await cache.delete(f"user:dashboard:{recipient_uid}")
            await cache.delete(f"user:perf_summary:{recipient_uid}")
            await cache.delete(f"user:redeem_limit:{recipient_uid}")
        except Exception as cache_err:
            logger.debug(f"[MINING-COMMISSION] Cache invalidation skipped: {cache_err}")

    return True


async def _send_referral_ping(
    *,
    recipient_uid: str,
    amount: float,
    collector_name: str,
    collector_uid: str,
    tier_index: int,
    tier_percent: float,
    collected_prc: float,
) -> None:
    """Insert a `mining_referral_reward` notification row for the recipient.

    Uses the shared `create_notification` helper so the record is properly
    typed (icon + color etc.). Falls back to a plain insert if the helper
    isn't importable.
    """
    title = "🎉 Leadership Reward Received!"
    message = (
        f"{collector_name} just collected mining PRC — you earned "
        f"{amount:.4f} PRC as Tier {tier_index} Leadership Reward ({tier_percent:.1f}%)."
    )
    data = {
        "amount": round(amount, 6),
        "collector_uid": collector_uid,
        "collector_name": collector_name,
        "tier_index": tier_index,
        "tier_percent": tier_percent,
        "collected_prc": round(collected_prc, 6),
        "event": "mining_referral_reward",
    }
    try:
        from routes.notifications import create_notification as _create_notif
        await _create_notif(
            user_id=recipient_uid,
            notification_type="mining_referral_reward",
            title=title,
            message=message,
            data=data,
        )
        return
    except Exception as helper_err:
        logger.debug(f"[MINING-COMMISSION] notifications.create_notification unavailable: {helper_err}")

    # Fallback direct insert — mirrors the shared helper's shape so the
    # frontend NotificationContext consumes it identically.
    try:
        await db.notifications.insert_one({
            "notification_id": str(uuid.uuid4()),
            "user_id": recipient_uid,
            "user_uid": recipient_uid,
            "type": "mining_referral_reward",
            "title": title,
            "message": message,
            "icon": "gift",
            "color": "purple",
            "data": data,
            "read": False,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"[MINING-COMMISSION] Fallback notification insert failed: {e}")



# ---------------------------------------------------------------------------
# ADMIN ONE-TIME CLEANUP — legacy duplicate mining_referral_reward rows
# ---------------------------------------------------------------------------
# Before Feb 2026 the commission credit was dual-written to both `prc_ledger`
# AND legacy `transactions`. The two writes used independent UUIDs so the
# PRC Statement dedup (txn_id-based) missed them → users saw every commission
# twice ("Referral Reward" + "Reward / Daily Reward Collected").
#
# The dual-write has been removed. This endpoint removes the historical
# leftovers from `transactions` in a single admin-triggered pass. It only
# targets rows where `transaction_type` = 'mining_referral_reward' — no
# other transaction category is touched. Safe + idempotent.
from fastapi import HTTPException, Header


@router.post("/admin/mining-commission/cleanup-legacy-duplicates")
async def admin_cleanup_legacy_commission_duplicates(
    x_admin_pin: str = Header(..., alias="X-Admin-Pin"),
):
    """Delete legacy `transactions` rows that duplicate prc_ledger
    mining_referral_reward entries. Requires ADMIN_OPERATION_PIN header.
    Returns the delete count.
    """
    import os
    expected_pin = os.environ.get("ADMIN_OPERATION_PIN")
    if not expected_pin or x_admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid admin operation PIN")

    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")

    result = await db.transactions.delete_many(
        {"transaction_type": "mining_referral_reward"}
    )
    logger.info(
        f"[MINING-COMMISSION CLEANUP] Removed {result.deleted_count} legacy "
        f"duplicate mining_referral_reward rows from `transactions`."
    )
    return {
        "success": True,
        "deleted_legacy_rows": result.deleted_count,
        "message": (
            f"Removed {result.deleted_count} legacy duplicate rows. "
            "PRC Statement will now show each commission exactly once."
        ),
    }
