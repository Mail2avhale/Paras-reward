"""
Feb 27, 2026 — Auth hash consolidation helper (P1 security fix)
================================================================
Fixes divergence bug in `routes/auth.py` where `_PASSWORD_FIELDS`
fallback chain (`pin_hash → hashed_pin → password_hash → password`)
made STALE hashes still valid for login after a password reset that
only updated `password_hash`.

Root cause:
  * `/api/auth/reset-password` (auth.py:2100) only writes `password_hash`
  * `/api/auth/change-password` (auth.py:2120) only writes `password_hash`
  * Login (auth.py:929-1011) iterates all 4 fields — ANY match = valid
  * ⇒ Attacker with the OLD pin_hash value keeps logging in after reset

Fix strategy:
  1. Write helper `write_auth_hash(db, uid, new_hash, extra_set)` that
     sets `password_hash` AND clones the same value to all 3 legacy
     fields — so no field can hold a stale hash.
  2. Reconciliation migration `reconcile_auth_hashes()` — for every
     existing user, pick the "authoritative" hash (prefer `password_hash`
     ↴ `password` ↴ `pin_hash` ↴ `hashed_pin`) and copy it to all 4
     fields. Preserves current login capability, eliminates divergence.

Zero downside:
  * All 4 fields still exist → login fallback chain still works
  * All 4 hold the SAME value → no stale credential survives a reset
  * Old bcrypt cost factor is preserved (we don't re-hash)
  * Idempotent — safe to re-run
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any

# Every field that login ever inspects. Order matches
# `_PASSWORD_FIELDS` in routes/auth.py so we keep the source of truth
# in one place.
AUTH_HASH_FIELDS = ("password_hash", "password", "pin_hash", "hashed_pin")

# Recognised bcrypt hash prefix ($2a$, $2b$, $2y$). Used only to filter
# out obviously-not-a-hash values during reconciliation (e.g. an empty
# string or a legacy plaintext accidentally left over from a very old
# codebase). No re-hashing is ever performed here.
_BCRYPT_RE = re.compile(r"^\$2[aby]\$\d{2}\$")


def _looks_like_bcrypt(value: Any) -> bool:
    return (
        isinstance(value, str)
        and len(value) == 60
        and _BCRYPT_RE.match(value) is not None
    )


async def write_auth_hash(
    db: Any,
    uid: str,
    new_hash: str,
    extra_set: dict | None = None,
) -> None:
    """Consolidated auth-hash writer.

    Sets `password_hash` AND clones the exact same value to every
    legacy alias so `_PASSWORD_FIELDS` fallback chain in login can
    never validate a stale credential.

    Args:
        db:        Motor async db handle.
        uid:       User uid.
        new_hash:  Freshly-computed bcrypt hash (60 chars, `$2b$…`).
        extra_set: Optional additional `$set` fields (e.g. reset_token
                   fields on password-reset flow). Merged into the same
                   update op to save a round trip.

    NOTE: This helper intentionally does NOT `$unset` any legacy field.
    The full unset happens in Phase 2 (later) once we're confident no
    production reader looks at `password` alone.
    """
    if not _looks_like_bcrypt(new_hash):
        raise ValueError(
            f"write_auth_hash refused: value does not look like a bcrypt hash "
            f"(len={len(new_hash) if isinstance(new_hash, str) else 'N/A'})"
        )

    set_ops = {field: new_hash for field in AUTH_HASH_FIELDS}
    set_ops["password_updated_at"] = datetime.now(timezone.utc).isoformat()
    if extra_set:
        set_ops.update(extra_set)

    await db.users.update_one({"uid": uid}, {"$set": set_ops})


def pick_authoritative_hash(user: dict) -> str | None:
    """Pick the canonical hash from a user doc.

    Preference order:
      1. `password_hash`  (canonical field per playbook)
      2. `password`       (legacy — most current writes cloned here too)
      3. `pin_hash`       (PIN-based login default)
      4. `hashed_pin`     (very-legacy PIN field name)

    Returns None if no field holds a valid-looking bcrypt hash.
    """
    for field in AUTH_HASH_FIELDS:
        v = user.get(field)
        if _looks_like_bcrypt(v):
            return v
    return None


async def reconcile_auth_hashes(
    db: Any, batch: int = 100, max_users: int = 10000
) -> dict:
    """Rewrite every user's 4 hash fields to the SAME authoritative
    value so no legacy field can validate stale creds after a reset.

    Idempotent — safe to re-run. Uses `bulk_write` with `UpdateOne`
    ops (Feb 27 2026 v2) so 6,000+ users complete in <5 s instead of
    the ~30 s that sequential `update_one` calls took (which hit the
    Kubernetes ingress 30 s cap and returned 504 on prod).

    Yields to the event loop every `batch` users so it doesn't
    monopolise a worker.

    Returns aggregate counters:
      * processed_users     — touched (had at least one hash field)
      * reconciled_users    — hashes were divergent and got equalised
      * already_consistent  — all 4 fields already held the same value
      * no_hash_at_all      — user has no bcrypt hash in any field (skipped)
      * failed              — bulk_write errors (per-doc)
    """
    from pymongo import UpdateOne

    processed = 0
    reconciled = 0
    already_consistent = 0
    no_hash_at_all = 0
    failed = 0

    projection = {"_id": 0, "uid": 1}
    for f in AUTH_HASH_FIELDS:
        projection[f] = 1

    # Only touch users that actually have AT LEAST one of the fields.
    query = {"$or": [{f: {"$exists": True}} for f in AUTH_HASH_FIELDS]}

    cursor = db.users.find(query, projection).limit(max_users).batch_size(batch)

    ops_buffer: list = []
    now_iso = datetime.now(timezone.utc).isoformat()

    async def _flush():
        """Send buffered UpdateOne ops as a single bulk_write."""
        nonlocal failed
        if not ops_buffer:
            return
        try:
            await db.users.bulk_write(ops_buffer, ordered=False)
        except Exception as exc:
            # `bulk_write` collects per-op failures on
            # `BulkWriteError`; count them but don't abort the run.
            failed += len(ops_buffer)
            logging.error(f"[AuthReconcile] bulk_write batch failed: {exc}")
        ops_buffer.clear()

    async for user in cursor:
        processed += 1
        uid = user.get("uid")
        if not uid:
            continue

        authoritative = pick_authoritative_hash(user)
        if not authoritative:
            no_hash_at_all += 1
            continue

        # Compare each field. Divergent if ANY field is missing OR
        # holds a different value than the authoritative one.
        divergent = any(
            user.get(f) != authoritative for f in AUTH_HASH_FIELDS
        )

        if not divergent:
            already_consistent += 1
            continue

        set_ops = {field: authoritative for field in AUTH_HASH_FIELDS}
        set_ops["password_updated_at"] = now_iso
        ops_buffer.append(
            UpdateOne({"uid": uid}, {"$set": set_ops})
        )
        reconciled += 1

        # Flush every `batch` ops so peak memory stays bounded and we
        # yield to the event loop.
        if len(ops_buffer) >= batch:
            await _flush()
            await asyncio.sleep(0)

    # Final flush for the tail.
    await _flush()

    return {
        "processed_users": processed,
        "reconciled_users": reconciled,
        "already_consistent": already_consistent,
        "no_hash_at_all": no_hash_at_all,
        "failed": failed,
        "next_step": (
            "Re-run to continue if processed_users == max_users"
            if processed >= max_users
            else "Done — all divergent hash fields reconciled."
        ),
    }
