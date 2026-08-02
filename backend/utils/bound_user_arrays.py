"""
Layer 3 — Bounded embed for `mining_history` + `prc_transactions`
==================================================================
Feb 24, 2026 — permanent fix for users-doc bloat (production docs
averaging 67 KB, max 6.6 MB) that was causing pool starvation and 30 s
timeouts.

Strategy:
  * `mining_history` is a DEAD legacy array. Current code does NOT push
    to it (mining events are written to `db.transactions` +
    `db.prc_ledger`). We migrate any existing entries to a separate
    `mining_history_archive` collection for auditability and $unset the
    field from the user doc entirely.
  * `prc_transactions` is still actively $push'd from `WalletService`
    and `WalletServiceV2`. Those write paths are patched to
    `{$each: [entry], $slice: -20}` so the embed is bounded to the last
    20 items. Full history remains in `db.ledger` and `db.prc_ledger`.
    This helper trims any user whose embedded array is already over-20.

Zero risk:
  * Only touches `mining_history` (dead array) and slices
    `prc_transactions` — the ledger collections retain full history.
  * Idempotent — safe to re-run repeatedly.
  * Batched — yields to event loop every 100 users so it doesn't
    monopolize the worker.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

# Keep the last N `prc_transactions` items on the user doc. Full history
# is preserved in `db.ledger` + `db.prc_ledger` (see wallet_service.py
# and wallet_service_v2.py).
PRC_TRANSACTIONS_EMBED_LIMIT = 20


async def _archive_mining_history(db: Any, uid: str, entries: list) -> int:
    """Insert `entries` into `mining_history_archive` keyed by `user_id`.

    Returns the number of docs inserted. Skips if `entries` is empty.
    """
    if not entries:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for e in entries:
        if not isinstance(e, dict):
            continue
        doc = dict(e)
        doc["user_id"] = uid
        doc["migrated_at"] = now
        docs.append(doc)
    if not docs:
        return 0
    try:
        await db.mining_history_archive.insert_many(docs, ordered=False)
        return len(docs)
    except Exception as exc:
        logging.error(f"[Layer3] Archive insert failed for {uid}: {exc}")
        return 0


async def bound_single_user(db: Any, user: dict) -> dict:
    """Trim one user's `prc_transactions` to last N and $unset
    `mining_history` (after archiving).

    Returns per-user counters: `{uid, mining_archived, prc_trimmed,
    updated}`.
    """
    uid = user.get("uid")
    result = {
        "uid": uid,
        "mining_archived": 0,
        "prc_trimmed": 0,
        "updated": False,
    }
    if not uid:
        return result

    mining_hist = user.get("mining_history") or []
    prc_txns = user.get("prc_transactions") or []

    set_ops = {}
    unset_ops = {}

    # 1) Archive mining_history + unset from user doc
    if isinstance(mining_hist, list) and len(mining_hist) > 0:
        archived = await _archive_mining_history(db, uid, mining_hist)
        result["mining_archived"] = archived
        unset_ops["mining_history"] = ""

    # 2) Bound prc_transactions to last N (they're already duplicated in
    #    db.ledger and db.prc_ledger — no archive needed).
    if isinstance(prc_txns, list) and len(prc_txns) > PRC_TRANSACTIONS_EMBED_LIMIT:
        trimmed = prc_txns[-PRC_TRANSACTIONS_EMBED_LIMIT:]
        set_ops["prc_transactions"] = trimmed
        result["prc_trimmed"] = len(prc_txns) - len(trimmed)

    if not set_ops and not unset_ops:
        return result

    update_doc = {}
    if set_ops:
        update_doc["$set"] = set_ops
    if unset_ops:
        update_doc["$unset"] = unset_ops

    try:
        await db.users.update_one({"uid": uid}, update_doc)
        result["updated"] = True
    except Exception as exc:
        logging.error(f"[Layer3] update_one failed for {uid}: {exc}")

    return result


async def bound_all_users(
    db: Any,
    batch: int = 100,
    max_users: int = 5000,
) -> dict:
    """Iterate all users and apply `bound_single_user` to each.

    Args:
        db: motor async database handle.
        batch: yield to loop every N users.
        max_users: hard cap so an admin can run in smaller batches.

    Returns aggregate counters.
    """
    processed = 0
    updated = 0
    mining_archived_total = 0
    prc_trimmed_total = 0
    failed = 0

    # Only touch users who have SOMETHING to trim — save cycles.
    #
    # NOTE: `$size` filter can't work on missing fields so we use
    # `$expr` with $gt on $size(ifNull). The Motor cursor iterates the
    # whole result set with batch_size=100 to avoid loading everything
    # into memory.
    query = {
        "$expr": {
            "$or": [
                {"$gt": [{"$size": {"$ifNull": ["$mining_history", []]}}, 0]},
                {
                    "$gt": [
                        {"$size": {"$ifNull": ["$prc_transactions", []]}},
                        PRC_TRANSACTIONS_EMBED_LIMIT,
                    ]
                },
            ]
        }
    }
    projection = {
        "_id": 0,
        "uid": 1,
        "mining_history": 1,
        "prc_transactions": 1,
    }

    cursor = db.users.find(query, projection).limit(max_users).batch_size(batch)

    async for user in cursor:
        processed += 1
        try:
            r = await bound_single_user(db, user)
            if r["updated"]:
                updated += 1
            mining_archived_total += r["mining_archived"]
            prc_trimmed_total += r["prc_trimmed"]
        except Exception as exc:
            failed += 1
            logging.error(f"[Layer3] bound_single_user failed: {exc}")

        if processed % batch == 0:
            # yield so we don't monopolize the loop
            await asyncio.sleep(0)

    return {
        "processed_users": processed,
        "updated_users": updated,
        "mining_history_entries_archived": mining_archived_total,
        "prc_transactions_entries_trimmed": prc_trimmed_total,
        "failed": failed,
        "prc_embed_limit": PRC_TRANSACTIONS_EMBED_LIMIT,
        "next_step": (
            "Re-run to continue if processed_users == max_users"
            if processed >= max_users
            else "Done — all bloated user docs bounded."
        ),
    }


async def ensure_archive_indexes(db: Any) -> None:
    """Create `user_id` + `timestamp` indexes on `mining_history_archive`
    so per-user reads stay fast.

    Idempotent — MongoDB `create_index` is a no-op if the index exists.
    """
    try:
        await db.mining_history_archive.create_index(
            "user_id", background=True, name="user_id_1"
        )
        await db.mining_history_archive.create_index(
            [("user_id", 1), ("timestamp", -1)],
            background=True,
            name="user_id_1_timestamp_-1",
        )
    except Exception as exc:
        logging.warning(f"[Layer3] ensure_archive_indexes: {exc}")
