"""
Immutable HR audit log helper.

Every meaningful admin/HR action calls ``log_action(...)`` to append a row to
the ``hr_audit_log`` collection. The collection is append-only from the app's
point of view — there is no update or delete endpoint.

Payload shape
-------------
{
  "log_id": "LOG-...",
  "actor":  "admin_id / email / 'system'",
  "action": "domain.verb" (e.g. "appraisal.finalize", "rbac.bind"),
  "entity_type": "performance_appraisal" | "employee" | ...,
  "entity_id":   "<the id>",
  "before":  {...} | None,
  "after":   {...} | None,
  "diff":    [{field, before, after}],
  "ts":      ISO8601 UTC
}
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Any


def _diff(before: Optional[dict], after: Optional[dict]) -> list:
    """Return a compact list of changed fields — best-effort, only checks
    top-level keys. Deep-diffs are intentionally out of scope."""
    if not isinstance(before, dict) or not isinstance(after, dict):
        return []
    changed = []
    for k in set(list(before.keys()) + list(after.keys())):
        b = before.get(k)
        a = after.get(k)
        if b != a:
            changed.append({"field": k, "before": b, "after": a})
    return changed


def _strip_bson(doc: Optional[dict]) -> Optional[dict]:
    if not isinstance(doc, dict):
        return doc
    return {k: v for k, v in doc.items() if k != "_id"}


async def log_action(
    db,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: str,
    before: Optional[Any] = None,
    after: Optional[Any] = None,
    *,
    meta: Optional[dict] = None,
):
    """Fire-and-forget append to ``hr_audit_log``. Never raises."""
    try:
        b = _strip_bson(before) if isinstance(before, dict) else before
        a = _strip_bson(after) if isinstance(after, dict) else after
        row = {
            "log_id": f"LOG-{str(uuid.uuid4())[:12].upper()}",
            "actor": actor or "system",
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "before": b,
            "after": a,
            "diff": _diff(b if isinstance(b, dict) else None, a if isinstance(a, dict) else None),
            "meta": meta or {},
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        await db.hr_audit_log.insert_one(row)
    except Exception as e:
        # NEVER let audit failure break the parent request
        logging.warning(f"[AUDIT] insert failed for {action}: {e}")
