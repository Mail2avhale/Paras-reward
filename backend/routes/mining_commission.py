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

logger = logging.getLogger(__name__)

# --------- MODULE STATE ----------
db = None  # Injected via set_db() from server.py at startup
cache = None  # Injected via set_cache() if available


def set_db(database) -> None:
    global db
    db = database


def set_cache(cache_manager) -> None:
    global cache
    cache = cache_manager


# --------- CONSTANTS ----------
ELITE_PLANS = {"elite", "vip", "startup", "growth", "pro"}
COMMISSION_PCT_PER_TIER = 0.01  # 1% per tier
MAX_TIERS = 3
MAX_CHAIN_WALK = 200  # safety cap so a mis-configured referral loop can't hang the collect


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
            "prc_balance": 1,
        },
    )


# --------- MAIN API ----------
async def distribute_mining_collect_commission(
    collector_uid: str,
    collected_prc: float,
    collect_timestamp: Optional[datetime] = None,
) -> dict:
    """
    Walk the referral chain from `collector_uid` upward, awarding
    COMMISSION_PCT_PER_TIER of `collected_prc` to the first MAX_TIERS Elite
    uplines encountered (with roll-up over non-Elite ancestors).

    Parameters
    ----------
    collector_uid   : uid of the user who just collected PRC
    collected_prc   : positive PRC amount that was collected
    collect_timestamp : timestamp of the collect event (used for idempotency)

    Returns
    -------
    {
        "distributed": [{uid, name, prc}, ...],   # actual credits (0-3 items)
        "skipped_tiers": int,                     # slots left empty (chain ended)
        "total_distributed": float,               # sum of amounts credited
        "per_tier_amount": float,
    }
    """
    if db is None:
        logger.error("[MINING-COMMISSION] db not injected — commission skipped")
        return {"distributed": [], "skipped_tiers": MAX_TIERS, "total_distributed": 0.0, "per_tier_amount": 0.0}

    if not collector_uid or not collected_prc or collected_prc <= 0:
        return {"distributed": [], "skipped_tiers": MAX_TIERS, "total_distributed": 0.0, "per_tier_amount": 0.0}

    per_tier = round(collected_prc * COMMISSION_PCT_PER_TIER, 6)
    if per_tier <= 0:
        return {"distributed": [], "skipped_tiers": MAX_TIERS, "total_distributed": 0.0, "per_tier_amount": 0.0}

    ts = collect_timestamp or datetime.now(timezone.utc)
    ts_iso = ts.isoformat()

    # Fetch collector name for the ledger description shown on recipient's statement.
    collector = await db.users.find_one(
        {"uid": collector_uid},
        {"_id": 0, "uid": 1, "name": 1, "first_name": 1, "last_name": 1, "referred_by": 1},
    )
    if not collector:
        return {"distributed": [], "skipped_tiers": MAX_TIERS, "total_distributed": 0.0, "per_tier_amount": per_tier}

    collector_name = _display_name(collector)

    # Idempotency key — one commission event per (collector, timestamp).
    source_ref = f"mining_collect:{collector_uid}:{ts_iso}"

    # Idempotency guard — if we've already distributed for this exact collect
    # event (e.g. transient retry after a partial success), bail out with the
    # already-persisted result. This must be at the TOP because roll-up may
    # advance to a different upline on a re-run and would otherwise double-pay.
    already_distributed = await db.prc_ledger.count_documents(
        {"source_ref": source_ref, "type": "mining_referral_reward"},
        limit=MAX_TIERS + 1,
    )
    if already_distributed > 0:
        logger.info(
            f"[MINING-COMMISSION] Idempotent skip — event {source_ref} already "
            f"distributed ({already_distributed} rows exist)"
        )
        return {
            "distributed": [],
            "skipped_tiers": MAX_TIERS - already_distributed,
            "total_distributed": round(per_tier * already_distributed, 6),
            "per_tier_amount": per_tier,
            "idempotent_skip": True,
        }

    distributed: list[dict] = []
    already_paid: set[str] = {collector_uid}  # never credit self even via a loop
    current_referred_by = collector.get("referred_by")
    hops = 0

    while len(distributed) < MAX_TIERS and hops < MAX_CHAIN_WALK:
        hops += 1
        if not current_referred_by:
            break

        upline = await _resolve_referrer(current_referred_by)
        if not upline:
            break

        upline_uid = upline.get("uid")
        if not upline_uid or upline_uid in already_paid:
            # Break early on loop — don't waste further walk.
            break

        if _is_elite_active(upline):
            recipient_name = _display_name(upline)
            credited = await _credit_commission(
                recipient_uid=upline_uid,
                amount=per_tier,
                collector_uid=collector_uid,
                collector_name=collector_name,
                collected_prc=collected_prc,
                tier_index=len(distributed) + 1,
                source_ref=source_ref,
                timestamp=ts,
            )
            if credited:
                distributed.append({"uid": upline_uid, "name": recipient_name, "prc": per_tier})
                already_paid.add(upline_uid)

        # Continue walking upward regardless of whether we credited.
        current_referred_by = upline.get("referred_by")

    total = round(per_tier * len(distributed), 6)
    if distributed:
        logger.info(
            f"[MINING-COMMISSION] collector={collector_uid} collected={collected_prc:.4f} → "
            f"credited {len(distributed)}/{MAX_TIERS} uplines × {per_tier:.4f} PRC (total {total:.4f})"
        )

    return {
        "distributed": distributed,
        "skipped_tiers": MAX_TIERS - len(distributed),
        "total_distributed": total,
        "per_tier_amount": per_tier,
    }


async def _credit_commission(
    *,
    recipient_uid: str,
    amount: float,
    collector_uid: str,
    collector_name: str,
    collected_prc: float,
    tier_index: int,
    source_ref: str,
    timestamp: datetime,
) -> bool:
    """
    Credit `amount` PRC to `recipient_uid`, insert an idempotent prc_ledger
    row, and invalidate their caches. Returns True on success.

    Idempotency: the ledger has an implicit uniqueness on
    (user_id, source_ref, tier_index) — if a matching row already exists
    (e.g. retry after a partial failure), we skip the credit.
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
        f"{collector_name} (Tier {tier_index}, 1% of {collected_prc:.4f} PRC collected)"
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
                "downline_uid": collector_uid,
                "downline_name": collector_name,
                "downline_collect_amount": collected_prc,
                "description": description,
                "timestamp": ts_iso,
                "created_at": ts_iso,
            }
        )
    except Exception as ledger_err:
        # Compensating rollback so we don't inflate balance without a ledger row.
        logger.error(
            f"[MINING-COMMISSION] Ledger insert failed — rolling back +{amount} PRC "
            f"on {recipient_uid}: {ledger_err}"
        )
        try:
            await db.users.update_one({"uid": recipient_uid}, {"$inc": {"prc_balance": -amount}})
        except Exception:
            pass
        return False

    # Legacy `transactions` collection kept in sync for older dashboards.
    try:
        await db.transactions.insert_one(
            {
                "transaction_id": str(uuid.uuid4()),
                "user_id": recipient_uid,
                "type": "credit",
                "amount": amount,
                "transaction_type": "mining_referral_reward",
                "description": description,
                "balance_after": new_balance,
                "timestamp": ts_iso,
                "source_ref": source_ref,
                "tier_index": tier_index,
                "downline_uid": collector_uid,
                "downline_name": collector_name,
            }
        )
    except Exception as legacy_err:
        logger.warning(f"[MINING-COMMISSION] Legacy transaction insert failed: {legacy_err}")

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
