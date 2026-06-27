"""
subscription_expiry.py
─────────────────────────────────────────────────────────────────
The ONLY way to read a user's subscription expiry timestamp.

Background:
    Historically there were 3 fields for the same thing:
      • `subscription_expiry`  (new canonical, 262 usages)
      • `subscription_expires` (legacy, 133 usages)
      • `vip_expiry`           (oldest legacy, 64 usages)

    A one-shot migration script in
    `scripts/migrate_subscription_expiry_fields.py` consolidates
    all three into `subscription_expiry` and unsets the other two.

    Going forward NEW code must:
      • Read via `get_user_expiry(user)` only.
      • Write to `subscription_expiry` only.
      • NEVER reference `subscription_expires` or `vip_expiry`.

    Old fallback-chain code is being migrated incrementally — until
    that is finished this helper still tolerates the legacy fields
    (read-only) so unmigrated rows continue to work in production.
"""
from datetime import datetime, timezone
from typing import Optional


def get_user_expiry(user: dict) -> Optional[datetime]:
    """Return the canonical subscription expiry as a timezone-aware
    datetime, or None if the user has never had a paid plan.

    Falls back to the legacy fields ONLY if the canonical one is
    missing — this protects rows that haven't been migrated yet.
    """
    if not isinstance(user, dict):
        return None
    raw = (
        user.get("subscription_expiry")
        or user.get("subscription_expires")
        or user.get("vip_expiry")
    )
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def is_subscription_active(user: dict, now: Optional[datetime] = None) -> bool:
    """True if the user has a paid subscription whose expiry is in
    the future. Centralised so every call site agrees.
    """
    expiry = get_user_expiry(user)
    if not expiry:
        return False
    ref = now or datetime.now(timezone.utc)
    return expiry > ref
