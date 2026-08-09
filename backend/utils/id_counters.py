"""
Atomic sequential ID counters for spec-compliant identifiers.

Spec requires IDs in the form:
    Application: PR-HR-YYYY-#####   (5-digit padded, year-scoped)
    Job Code:    PR-JOB-YYYY-####   (4-digit padded, year-scoped)
    Employee:    PR-EMP-#####       (5-digit padded, global)

Counters live in the ``id_counters`` collection:
    { _id: "hr_application_YYYY", seq: N }
    { _id: "job_code_YYYY",       seq: N }
    { _id: "employee",            seq: N }

``findAndModify`` with ``upsert=True`` + ``$inc`` gives us an atomic monotonic
counter without contention. Safe for concurrent apply spikes.
"""

from datetime import datetime, timezone


async def _next(db, key: str) -> int:
    """Atomically fetch-and-increment the counter under ``key`` and return the
    new sequence number."""
    doc = await db.id_counters.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,  # ReturnDocument.AFTER equivalent for motor
    )
    # find_one_and_update returns the DOC AFTER the update when
    # return_document=True on motor (aka pymongo.ReturnDocument.AFTER).
    # doc may be None on the very first upsert on some driver versions —
    # fall back to a fresh read in that case.
    if doc is None:
        doc = await db.id_counters.find_one({"_id": key})
    return int(doc.get("seq", 1))


async def next_application_id(db) -> str:
    year = datetime.now(timezone.utc).year
    seq = await _next(db, f"hr_application_{year}")
    return f"PR-HR-{year}-{seq:05d}"


async def next_job_code(db) -> str:
    year = datetime.now(timezone.utc).year
    seq = await _next(db, f"job_code_{year}")
    return f"PR-JOB-{year}-{seq:04d}"


async def next_employee_id(db) -> str:
    seq = await _next(db, "employee")
    return f"PR-EMP-{seq:05d}"


def slugify(text: str, max_len: int = 80) -> str:
    """Turn ``title`` into a URL-safe slug. Kept tiny — no external deps."""
    import re
    s = (text or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s[:max_len] or "job"


async def unique_slug(db, base: str) -> str:
    """Guarantee ``base`` slug is unique within ``job_postings`` by appending
    an incrementing suffix if needed."""
    slug = base
    suffix = 2
    while await db.job_postings.find_one({"slug": slug}):
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug
