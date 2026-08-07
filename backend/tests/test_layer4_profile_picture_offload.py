"""
Layer 4 (Feb 26 2026) — profile-picture off-load.

Contract:
  * `profile_picture` (base64 data URL) MUST live in the
    `user_profile_pictures` collection keyed by `uid`, NOT embedded on
    the user doc.
  * Legacy embed still supported READ-side for backward compat during
    migration.
  * Every write path (upload / delete) flips `has_profile_picture`
    boolean on the user doc so downstream feeds skip the round-trip
    when there's no picture.
  * `migrate_all` is idempotent + reports `total_bytes_reclaimed`.
"""
import asyncio
import os
import sys
import types
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.profile_picture_store import (  # noqa: E402
    delete_picture,
    ensure_indexes,
    get_picture,
    migrate_all,
    set_picture,
)


# ── Motor-compatible in-memory fake ────────────────────────────────────
class _FakeCollection:
    def __init__(self):
        self.docs = []
        self.updates = []
        self.upserts = []
        self.deletes = []
        self.indexes_created = []

    def _match(self, doc, filt):
        for k, v in filt.items():
            if isinstance(v, dict) and "$type" in v:
                # {"$type": "string"} matches non-null string values
                if v["$type"] == "string":
                    if not isinstance(doc.get(k), str):
                        return False
                continue
            if doc.get(k) != v:
                return False
        return True

    async def find_one(self, filt=None, projection=None):
        for d in self.docs:
            if self._match(d, filt or {}):
                return dict(d)
        return None

    async def update_one(self, filt, update, upsert=False):
        self.updates.append((filt, update, upsert))
        for d in self.docs:
            if self._match(d, filt):
                if "$set" in update:
                    d.update(update["$set"])
                if "$unset" in update:
                    for k in update["$unset"]:
                        d.pop(k, None)
                if "$setOnInsert" in update:
                    pass  # doc already exists
                return types.SimpleNamespace(matched_count=1, modified_count=1, upserted_id=None)
        # not found
        if upsert:
            new_doc = dict(filt)
            for k, v in filt.items():
                # strip $type filters
                if isinstance(v, dict):
                    new_doc.pop(k, None)
            if "$set" in update:
                new_doc.update(update["$set"])
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            self.docs.append(new_doc)
            self.upserts.append(new_doc)
            return types.SimpleNamespace(matched_count=0, modified_count=0, upserted_id="new")
        return types.SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

    async def delete_one(self, filt):
        self.deletes.append(filt)
        for i, d in enumerate(self.docs):
            if self._match(d, filt):
                self.docs.pop(i)
                return types.SimpleNamespace(deleted_count=1)
        return types.SimpleNamespace(deleted_count=0)

    async def create_index(self, keys, unique=False, background=True, name=None):
        self.indexes_created.append((keys, name, unique))

    def find(self, filt=None, projection=None):
        docs = list(self.docs) if not filt else [
            d for d in self.docs if self._match(d, filt)
        ]
        return _FakeCursor(docs)


class _FakeCursor:
    def __init__(self, docs):
        self._docs = docs
        self._limit = None
        self._i = 0

    def limit(self, n):
        self._limit = n
        return self

    def batch_size(self, _):
        return self

    def __aiter__(self):
        self._i = 0
        return self

    async def __anext__(self):
        limit = self._limit if self._limit is not None else len(self._docs)
        if self._i >= min(limit, len(self._docs)):
            raise StopAsyncIteration
        d = self._docs[self._i]
        self._i += 1
        return d


class _FakeDB:
    def __init__(self):
        self.users = _FakeCollection()
        self.user_profile_pictures = _FakeCollection()


# ── Tests ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_set_picture_writes_to_new_collection_and_flags_user():
    db = _FakeDB()
    db.users.docs.append({"uid": "u1", "profile_picture": "OLD_LEGACY_BASE64"})

    data_url = "data:image/png;base64,AAAA"
    await set_picture(db, "u1", data_url)

    # New collection has the picture
    pp = await db.user_profile_pictures.find_one({"uid": "u1"})
    assert pp["image_data"] == data_url
    assert "updated_at" in pp

    # user doc has has_profile_picture flag AND legacy embed removed
    user = await db.users.find_one({"uid": "u1"})
    assert user["has_profile_picture"] is True
    assert "profile_picture" not in user


@pytest.mark.asyncio
async def test_get_picture_prefers_new_collection():
    db = _FakeDB()
    db.user_profile_pictures.docs.append(
        {"uid": "u2", "image_data": "NEW_STORE_URL"}
    )
    db.users.docs.append(
        {"uid": "u2", "profile_picture": "STALE_LEGACY"}
    )
    got = await get_picture(db, "u2")
    assert got == "NEW_STORE_URL"


@pytest.mark.asyncio
async def test_get_picture_falls_back_to_legacy_embed():
    db = _FakeDB()
    # No entry in new collection; only legacy embed on user doc
    db.users.docs.append({"uid": "u3", "profile_picture": "LEGACY_ONLY"})
    got = await get_picture(db, "u3")
    assert got == "LEGACY_ONLY"


@pytest.mark.asyncio
async def test_get_picture_returns_none_when_no_picture():
    db = _FakeDB()
    db.users.docs.append({"uid": "u4"})
    assert await get_picture(db, "u4") is None
    assert await get_picture(db, "does-not-exist") is None


@pytest.mark.asyncio
async def test_delete_picture_removes_from_both_stores():
    db = _FakeDB()
    db.user_profile_pictures.docs.append({"uid": "u5", "image_data": "X"})
    db.users.docs.append(
        {"uid": "u5", "profile_picture": "LEGACY_TOO", "has_profile_picture": True}
    )

    await delete_picture(db, "u5")

    assert await db.user_profile_pictures.find_one({"uid": "u5"}) is None
    user = await db.users.find_one({"uid": "u5"})
    assert user["has_profile_picture"] is False
    assert "profile_picture" not in user


@pytest.mark.asyncio
async def test_ensure_indexes_creates_unique_uid_index():
    db = _FakeDB()
    await ensure_indexes(db)
    idx = db.user_profile_pictures.indexes_created
    assert idx == [("uid", "uid_1", True)]


@pytest.mark.asyncio
async def test_migrate_all_moves_embed_to_collection_and_reports_bytes():
    db = _FakeDB()
    # User A: has embedded pic. User B: no pic. User C: already migrated
    # (new store has entry AND legacy embed still present as a
    # migration remnant).
    db.users.docs.extend([
        {"uid": "A", "profile_picture": "a" * 500_000},   # 500 KB base64
        {"uid": "B"},                                     # no pic
        {"uid": "C", "profile_picture": "SAMESAME"},
    ])
    db.user_profile_pictures.docs.append(
        {"uid": "C", "image_data": "SAMESAME"}
    )

    result = await migrate_all(db, batch=10, max_users=100)

    assert result["processed_users"] == 2  # A and C (B has no string embed)
    assert result["migrated_users"] == 1   # only A copied
    assert result["already_migrated"] == 1  # C already had same data
    assert result["failed"] == 0
    assert result["total_bytes_reclaimed"] >= 500_000

    # A moved to new store
    a_pic = await db.user_profile_pictures.find_one({"uid": "A"})
    assert a_pic["image_data"] == "a" * 500_000

    # A's user doc lost the legacy field
    a_user = await db.users.find_one({"uid": "A"})
    assert "profile_picture" not in a_user
    assert a_user["has_profile_picture"] is True

    # C's user doc also lost the legacy field (safety net)
    c_user = await db.users.find_one({"uid": "C"})
    assert "profile_picture" not in c_user


@pytest.mark.asyncio
async def test_migrate_all_is_idempotent():
    db = _FakeDB()
    db.users.docs.append({"uid": "X", "profile_picture": "PIC_DATA"})

    r1 = await migrate_all(db, batch=10, max_users=100)
    assert r1["migrated_users"] == 1

    r2 = await migrate_all(db, batch=10, max_users=100)
    # No embedded profile_picture left → nothing to process
    assert r2["processed_users"] == 0
    assert r2["migrated_users"] == 0


# ── Source-code contract tests (write / read path invariants) ─────────
def test_users_upload_endpoint_uses_new_store():
    """Contract: `upload_profile_picture` MUST route through
    `utils.profile_picture_store.set_picture`, NOT $set the field
    inline on the users doc.
    """
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "users.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()

    upload_start = src.find("async def upload_profile_picture(")
    assert upload_start > 0
    body = src[upload_start : upload_start + 2500]
    assert "from utils.profile_picture_store import set_picture" in body, (
        "upload_profile_picture must import & call set_picture from the "
        "L4 store — Layer 4 hotfix"
    )
    assert "await set_picture(db, uid, image_data_url)" in body


def test_users_delete_endpoint_uses_new_store():
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "users.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()
    del_start = src.find("async def delete_profile_picture(")
    body = src[del_start : del_start + 1500]
    assert "from utils.profile_picture_store import delete_picture" in body
    assert "await delete_picture(db, uid)" in body


def test_users_get_endpoint_uses_new_store():
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "users.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()
    get_start = src.find("async def get_user_profile_picture(")
    body = src[get_start : get_start + 1500]
    assert "from utils.profile_picture_store import get_picture" in body
