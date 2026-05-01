"""
Idempotency helper for preventing double-submit on financial endpoints.

How it works:
  - Client generates a UUID per user-intent (e.g., one subscription button click).
  - Client sends it as `client_request_id` in the request body.
  - Server stores {key, response_snapshot} in `idempotency_keys` collection with
    TTL index (auto-expire after N seconds).
  - If server sees the same key within the TTL window, it returns the cached
    response instead of executing the handler again.

Guarantees:
  - Safe for double-clicks, network retries, and accidental re-submits
    within the TTL window.
  - TTL index ensures no unbounded growth.

Usage:

    from routes.idempotency import check_and_claim_idempotency_key, store_idempotency_response

    @router.post("/some/endpoint")
    async def handler(request: Request):
        data = await request.json()
        key = data.get("client_request_id")
        scope = f"prc_sub:{user_id}"  # namespace to avoid collision across endpoints

        cached = await check_and_claim_idempotency_key(key, scope)
        if cached is not None:
            return cached  # replay

        # ... do the work ...
        result = {...}

        await store_idempotency_response(key, scope, result)
        return result
"""
import logging
from datetime import datetime, timezone, timedelta

_db = None


def set_db(database):
    global _db
    _db = database


async def ensure_indexes():
    """Create TTL index on idempotency_keys collection (idempotent)."""
    if _db is None:
        return
    try:
        # TTL: auto-delete 24h after expires_at
        await _db.idempotency_keys.create_index(
            "expires_at", expireAfterSeconds=0, name="expires_ttl"
        )
        await _db.idempotency_keys.create_index(
            [("scope", 1), ("key", 1)], unique=True, name="scope_key_unique"
        )
        logging.info("[IDEMPOTENCY] indexes ensured")
    except Exception as e:
        logging.warning(f"[IDEMPOTENCY] index create failed (non-fatal): {e}")


async def check_and_claim_idempotency_key(
    key: str, scope: str, ttl_seconds: int = 300
) -> dict | None:
    """
    Try to atomically claim an idempotency key.

    Returns:
      None  -> key is fresh, caller should proceed with the operation.
      dict  -> key already exists, returns the cached response (replay).

    Uses upsert with a sentinel `claimed_at` so that two concurrent callers
    race-free get exactly one "fresh" and one "existing" answer.
    """
    if not key or _db is None:
        return None

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)

    # Atomic: insert sentinel if absent; if present, get it.
    try:
        existing = await _db.idempotency_keys.find_one_and_update(
            {"scope": scope, "key": key},
            {
                "$setOnInsert": {
                    "scope": scope,
                    "key": key,
                    "claimed_at": now.isoformat(),
                    "expires_at": expires_at,
                    "response": None,
                    "status": "claimed",
                }
            },
            upsert=True,
            return_document=False,  # return doc BEFORE update; None if fresh insert
        )
    except Exception as e:
        # Most likely a duplicate-key error if TWO concurrent upserts both try
        # to insert at the same microsecond. Re-fetch the existing doc.
        logging.warning(f"[IDEMPOTENCY] upsert fell back on error: {e}")
        existing = await _db.idempotency_keys.find_one(
            {"scope": scope, "key": key}, {"_id": 0}
        )

    if existing is None:
        # Fresh claim — caller should proceed.
        return None

    # Existing claim found.
    status = existing.get("status")
    response = existing.get("response")

    if status == "claimed" and response is None:
        # Another request is still in-flight. Return a stub telling client to retry
        # (better than double-executing). Here we return a 202-like dict.
        return {
            "_idempotency_replay": True,
            "_inflight": True,
            "success": False,
            "error": "duplicate_request_in_flight",
            "message": "A previous identical request is still processing. Please wait a moment and check your status.",
        }

    # Completed response cached — return it verbatim.
    return {**response, "_idempotency_replay": True} if isinstance(response, dict) else response


async def store_idempotency_response(
    key: str, scope: str, response: dict, ttl_seconds: int = 300
):
    """Persist the handler's response under the claimed key so later replays
    return the same result."""
    if not key or _db is None:
        return
    try:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl_seconds)
        await _db.idempotency_keys.update_one(
            {"scope": scope, "key": key},
            {
                "$set": {
                    "response": response,
                    "status": "completed",
                    "completed_at": now.isoformat(),
                    "expires_at": expires_at,
                }
            },
        )
    except Exception as e:
        logging.warning(f"[IDEMPOTENCY] store response failed: {e}")


async def release_idempotency_key(key: str, scope: str):
    """Delete the sentinel if the handler errored mid-flight so the user can retry."""
    if not key or _db is None:
        return
    try:
        await _db.idempotency_keys.delete_one({"scope": scope, "key": key})
    except Exception as e:
        logging.warning(f"[IDEMPOTENCY] release failed: {e}")
