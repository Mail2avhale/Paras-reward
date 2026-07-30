"""
Subscription-status helpers — canonical truth resolver
======================================================

The `users` collection has TWO parallel signals for subscription state:
  1. **Canonical**: `subscription_plan` (paid?) + `subscription_expiry` (in the future?)
  2. **Mirror flag**: `subscription_expired: bool` — set by the daily cron
     sweeper when a plan's expiry passes.

The mirror flag is a *cache* of the canonical truth, but several write
paths forget to reset it on renewal (Razorpay auto-sync, admin manual
activate, upcoming-plan auto-activate, etc.) → stale-flag bugs where
the user has a valid paid plan but the flag is stuck at `True`.

**Rule**: canonical > mirror. Always compute canonical first; only fall
back to the mirror when the canonical signal is missing/ambiguous.

This helper centralises that logic. Every read path that checks
subscription state SHOULD use `is_active_subscription()` — not
`user.get("subscription_expired") is True` directly.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional

from utils.subscription_expiry import get_user_expiry


_FREE_PLAN_NAMES = {"", "explorer", "free", "none"}


def is_active_subscription(user: dict) -> bool:
    """Return True if the user has a currently-active paid subscription.

    Order of checks:
      1. `subscription_plan` must be paid (Startup / Growth / Elite / any non-free)
      2. `subscription_expiry` must be in the future
      3. Mirror flag `subscription_expired` is IGNORED when 1+2 pass —
         self-heal is left to the caller.
    """
    if not user:
        return False
    plan = (user.get("subscription_plan") or "").strip().lower()
    if plan in _FREE_PLAN_NAMES:
        return False
    expiry = get_user_expiry(user)
    if not expiry:
        # Paid plan with NO expiry → treat as active (legacy lifetime accounts)
        # unless the mirror flag hard-says expired.
        return user.get("subscription_expired") is not True
    try:
        now = datetime.now(timezone.utc)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        return expiry >= now
    except Exception:
        # If we can't parse expiry, err on the side of trusting the mirror.
        return user.get("subscription_expired") is not True


def is_stale_expired_flag(user: dict) -> bool:
    """Return True when the mirror flag is `True` but the canonical
    signal says the user IS active. Callers can use this to trigger
    a self-heal write.
    """
    if not user:
        return False
    if user.get("subscription_expired") is not True:
        return False
    return is_active_subscription(user)


async def self_heal_if_stale(db, user: dict) -> Optional[bool]:
    """If the user has `subscription_expired: True` but is actually
    active, correct the flag in Mongo. Fire-and-forget style — callers
    don't need to await if they can't afford the round-trip.

    Returns:
      • True  → we performed a heal
      • False → no heal needed
      • None  → heal failed (silent)
    """
    if not is_stale_expired_flag(user):
        return False
    try:
        uid = user.get("uid")
        if not uid:
            return None
        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "subscription_expired": False,
                "subscription_expired_at": None,
                "subscription_status": "active",
            }},
        )
        # Mutate the in-memory dict so subsequent reads in the same
        # request see the corrected state.
        user["subscription_expired"] = False
        user["subscription_expired_at"] = None
        user["subscription_status"] = "active"
        return True
    except Exception:
        return None
