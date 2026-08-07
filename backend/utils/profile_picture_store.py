"""
Layer 4 — Profile-picture off-load helper
==========================================
Feb 26, 2026 — permanent fix for the last significant users-doc bloat
source. Prod audit revealed 790 users still sitting at 100 KB - 1 MB,
with `profile_picture` (base64 data URL) contributing 500-620 KB per
user. Moving this field to its own collection drops the users doc from
600 KB → <5 KB for those users AND simplifies future Phase C migration
to real object storage (only one place needs to change).

Schema
------
Collection: `user_profile_pictures`
Doc shape:  {uid, image_data, updated_at}
Index:      uid_1 (unique)

Guarantees
----------
* Idempotent — safe to re-run.
* Zero-downtime — old readers keep working via a fallback path in
  routes/users.py during the migration window.
* Users doc gets `has_profile_picture: True/False` flag so lists /
  leaderboards / feeds can skip the round-trip when there's no picture.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any


async def _upsert_picture(db: Any, uid: str, data_url: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await db.user_profile_pictures.update_one(
        {"uid": uid},
        {"$set": {"image_data": data_url, "updated_at": now}, "$setOnInsert": {"uid": uid}},
        upsert=True,
    )


async def set_picture(db: Any, uid: str, data_url: str) -> None:
    """Persist a new profile picture for `uid`.

    Writes the base64 data URL into `user_profile_pictures` (keyed by
    uid) and flips `has_profile_picture: True` on the user doc so
    downstream feeds know a picture exists without joining.
    """
    await _upsert_picture(db, uid, data_url)
    await db.users.update_one(
        {"uid": uid},
        {
            "$set": {
                "has_profile_picture": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            # $unset the legacy embedded field — if this user was migrated
            # earlier this is a no-op, otherwise it removes ~500 KB of
            # base64 from their user doc.
            "$unset": {"profile_picture": ""},
        },
    )


async def get_picture(db: Any, uid: str) -> str | None:
    """Read a user's profile picture data URL.

    Reads from `user_profile_pictures` first. Falls back to the legacy
    embedded `users.profile_picture` field for users not yet migrated so
    reads never break during the migration window.
    """
    doc = await db.user_profile_pictures.find_one(
        {"uid": uid}, {"_id": 0, "image_data": 1}
    )
    if doc and doc.get("image_data"):
        return doc["image_data"]

    # Fallback for un-migrated users. We use explicit include-mode
    # projection so the UsersCollectionGuard proxy returns the field
    # (default projection strips it).
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "profile_picture": 1})
    return user.get("profile_picture") if user else None


async def delete_picture(db: Any, uid: str) -> None:
    """Remove a user's profile picture from both stores."""
    await db.user_profile_pictures.delete_one({"uid": uid})
    await db.users.update_one(
        {"uid": uid},
        {
            "$set": {
                "has_profile_picture": False,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            "$unset": {"profile_picture": ""},
        },
    )


async def ensure_indexes(db: Any) -> None:
    """Idempotent — safe on repeat calls (Motor no-ops if index exists)."""
    try:
        await db.user_profile_pictures.create_index(
            "uid", unique=True, background=True, name="uid_1"
        )
    except Exception as exc:
        logging.warning(f"[Layer4] ensure_indexes: {exc}")


async def migrate_all(db: Any, batch: int = 50, max_users: int = 1000) -> dict:
    """Move all embedded `profile_picture` values into
    `user_profile_pictures` and $unset the embedded field.

    Args:
        db: motor async database.
        batch: yield to event loop every N users.
        max_users: hard cap so admin can run in smaller batches.

    Returns aggregate counters.
    """
    await ensure_indexes(db)

    processed = 0
    migrated = 0
    already_migrated = 0
    empty_skipped = 0
    total_bytes_reclaimed = 0
    failed = 0

    # Only touch users whose doc still embeds a non-null profile_picture.
    # We use include-mode projection so the guard proxy returns the field.
    #
    # NB: `$type: "string"` filters out null / missing / non-string.
    cursor = db.users.find(
        {"profile_picture": {"$type": "string"}},
        {"_id": 0, "uid": 1, "profile_picture": 1},
    ).limit(max_users).batch_size(batch)

    async for user in cursor:
        processed += 1
        uid = user.get("uid")
        pic = user.get("profile_picture")
        if not uid:
            continue
        if not pic or not isinstance(pic, str):
            empty_skipped += 1
            continue

        try:
            # If already in new store, skip the copy but still $unset
            # from the users doc (safety net against interrupted runs).
            existing = await db.user_profile_pictures.find_one(
                {"uid": uid}, {"_id": 0, "image_data": 1}
            )
            if existing and existing.get("image_data") == pic:
                already_migrated += 1
            else:
                await _upsert_picture(db, uid, pic)
                migrated += 1

            # Flip has_profile_picture flag + $unset the embed regardless
            # (so already-migrated docs also lose the bloated field).
            await db.users.update_one(
                {"uid": uid},
                {
                    "$set": {"has_profile_picture": True},
                    "$unset": {"profile_picture": ""},
                },
            )
            # Approximate BSON overhead: base64 length + ~20 bytes.
            total_bytes_reclaimed += len(pic)
        except Exception as exc:
            failed += 1
            logging.error(f"[Layer4] migrate_all failed for {uid}: {exc}")

        if processed % batch == 0:
            await asyncio.sleep(0)  # yield

    return {
        "processed_users": processed,
        "migrated_users": migrated,
        "already_migrated": already_migrated,
        "empty_skipped": empty_skipped,
        "total_bytes_reclaimed": total_bytes_reclaimed,
        "failed": failed,
        "next_step": (
            "Re-run to continue if processed_users == max_users"
            if processed >= max_users
            else "Done — all embedded profile_picture fields migrated."
        ),
    }
