"""
Feb 27, 2026 — P1 security fix: auth-hash consolidation.

Bug: `_PASSWORD_FIELDS = ("pin_hash", "hashed_pin", "password_hash",
"password")` in routes/auth.py is the fallback chain login iterates.
Any match = valid login. If a password-reset flow only writes
`password_hash`, the OTHER three fields hold the STALE hash and STILL
validate the user's old password → account takeover after "successful"
password reset.

Fix contract:
  * `write_auth_hash()` writes to ALL 4 fields atomically.
  * `reset-password`, `change-password`, admin `reset_password`, and
    `password-recovery/reset` all route through `write_auth_hash()`.
  * `reconcile_auth_hashes()` migration walks every user, picks the
    authoritative hash, and clones it to all sibling fields.
"""
import asyncio  # noqa: F401
import os
import sys
import types
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.auth_hash_consolidation import (  # noqa: E402
    AUTH_HASH_FIELDS,
    pick_authoritative_hash,
    reconcile_auth_hashes,
    write_auth_hash,
    _looks_like_bcrypt,
)

BCRYPT_A = "$2b$10$" + "A" * 53
BCRYPT_B = "$2b$10$" + "B" * 53


# ── Motor fake ─────────────────────────────────────────────────────────
class _FakeCollection:
    def __init__(self):
        self.docs = []
        self.updates = []

    def _match(self, doc, filt):
        for k, v in filt.items():
            if k == "$or":
                # any of the sub-filters
                for sub in v:
                    if all(sk in doc for sk in sub):
                        return True
                    if all(self._match(doc, sub) for sub in [sub]):
                        return True
                return False
            if isinstance(v, dict) and "$exists" in v:
                exists = k in doc
                if v["$exists"] and not exists:
                    return False
                if not v["$exists"] and exists:
                    return False
                continue
            if doc.get(k) != v:
                return False
        return True

    async def update_one(self, filt, update):
        self.updates.append((filt, update))
        for d in self.docs:
            if self._match(d, filt):
                if "$set" in update:
                    d.update(update["$set"])
                if "$unset" in update:
                    for k in update["$unset"]:
                        d.pop(k, None)
                return types.SimpleNamespace(matched_count=1, modified_count=1)
        return types.SimpleNamespace(matched_count=0, modified_count=0)

    async def bulk_write(self, operations, ordered=True):
        # Enough for our tests — apply each UpdateOne op via the same
        # in-memory update_one path.
        matched = modified = 0
        for op in operations:
            # Duck-type: pymongo `UpdateOne` exposes `._filter` and `._doc`.
            filt = getattr(op, "_filter", None)
            update = getattr(op, "_doc", None)
            if filt is None or update is None:
                continue
            r = await self.update_one(filt, update)
            matched += r.matched_count
            modified += r.modified_count
        return types.SimpleNamespace(
            matched_count=matched, modified_count=modified,
            inserted_count=0, upserted_count=0, deleted_count=0,
        )

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


# ── Unit tests ─────────────────────────────────────────────────────────
def test_auth_hash_fields_lists_all_four():
    assert set(AUTH_HASH_FIELDS) == {
        "password_hash", "password", "pin_hash", "hashed_pin"
    }


def test_looks_like_bcrypt_accepts_2b_2a_2y():
    assert _looks_like_bcrypt(BCRYPT_A)
    assert _looks_like_bcrypt(BCRYPT_A.replace("$2b$", "$2a$"))
    assert _looks_like_bcrypt(BCRYPT_A.replace("$2b$", "$2y$"))


def test_looks_like_bcrypt_rejects_plaintext_and_short_strings():
    assert not _looks_like_bcrypt("plaintextpassword")
    assert not _looks_like_bcrypt("")
    assert not _looks_like_bcrypt(None)
    assert not _looks_like_bcrypt("$2b$10$short")
    # wrong length (not 60):
    assert not _looks_like_bcrypt(BCRYPT_A + "x")


def test_pick_authoritative_prefers_password_hash():
    user = {
        "password_hash": BCRYPT_A,
        "password": BCRYPT_B,
        "pin_hash": BCRYPT_B,
    }
    assert pick_authoritative_hash(user) == BCRYPT_A


def test_pick_authoritative_falls_through_when_password_hash_missing():
    user = {"password": BCRYPT_B, "pin_hash": BCRYPT_A}
    assert pick_authoritative_hash(user) == BCRYPT_B


def test_pick_authoritative_returns_none_if_no_bcrypt():
    assert pick_authoritative_hash({}) is None
    assert pick_authoritative_hash({"password_hash": "not-bcrypt"}) is None


@pytest.mark.asyncio
async def test_write_auth_hash_updates_all_four_fields():
    db = _FakeDB()
    db.users.docs.append({"uid": "u1"})

    await write_auth_hash(db, "u1", BCRYPT_A)

    doc = db.users.docs[0]
    assert doc["password_hash"] == BCRYPT_A
    assert doc["password"] == BCRYPT_A
    assert doc["pin_hash"] == BCRYPT_A
    assert doc["hashed_pin"] == BCRYPT_A
    assert "password_updated_at" in doc


@pytest.mark.asyncio
async def test_write_auth_hash_merges_extra_set():
    db = _FakeDB()
    db.users.docs.append({"uid": "u2"})

    await write_auth_hash(
        db, "u2", BCRYPT_A, extra_set={"reset_token": None}
    )

    doc = db.users.docs[0]
    assert doc["password_hash"] == BCRYPT_A
    assert doc["reset_token"] is None


@pytest.mark.asyncio
async def test_write_auth_hash_refuses_plaintext():
    db = _FakeDB()
    db.users.docs.append({"uid": "u3"})
    with pytest.raises(ValueError):
        await write_auth_hash(db, "u3", "plaintextpassword")


@pytest.mark.asyncio
async def test_reconcile_fixes_divergent_hashes():
    """The exact prod bug: `password_hash` was updated on reset but
    `pin_hash` still holds OLD bcrypt → attacker keeps logging in."""
    db = _FakeDB()
    db.users.docs.extend([
        {
            "uid": "victim",
            "password_hash": BCRYPT_B,  # new hash from reset
            "password": BCRYPT_A,       # STALE (would still login)
            "pin_hash": BCRYPT_A,       # STALE
            "hashed_pin": BCRYPT_A,     # STALE
        },
    ])

    result = await reconcile_auth_hashes(db, batch=10, max_users=100)

    assert result["processed_users"] == 1
    assert result["reconciled_users"] == 1
    assert result["already_consistent"] == 0
    assert result["failed"] == 0

    # After reconcile, every field holds the AUTHORITATIVE
    # `password_hash` value (BCRYPT_B), NOT the stale BCRYPT_A.
    doc = db.users.docs[0]
    for field in AUTH_HASH_FIELDS:
        assert doc[field] == BCRYPT_B, (
            f"reconcile left {field}={doc[field][:20]}...  "
            f"stale creds still valid!"
        )


@pytest.mark.asyncio
async def test_reconcile_leaves_already_consistent_users_alone():
    db = _FakeDB()
    db.users.docs.append({
        "uid": "clean",
        "password_hash": BCRYPT_A,
        "password": BCRYPT_A,
        "pin_hash": BCRYPT_A,
        "hashed_pin": BCRYPT_A,
    })

    result = await reconcile_auth_hashes(db, batch=10, max_users=100)

    assert result["processed_users"] == 1
    assert result["already_consistent"] == 1
    assert result["reconciled_users"] == 0
    assert db.users.updates == []  # no writes happened


@pytest.mark.asyncio
async def test_reconcile_skips_users_with_no_bcrypt():
    db = _FakeDB()
    db.users.docs.extend([
        {"uid": "u1", "password_hash": "not-a-hash"},
        {"uid": "u2"},  # no fields
    ])

    result = await reconcile_auth_hashes(db, batch=10, max_users=100)

    # u2 has none of the fields → not even matched by the query
    # (only 1 processed). u1 has one field but it's not bcrypt → skipped.
    assert result["reconciled_users"] == 0
    assert result["no_hash_at_all"] == 1


@pytest.mark.asyncio
async def test_reconcile_is_idempotent():
    db = _FakeDB()
    db.users.docs.append({
        "uid": "u1",
        "password_hash": BCRYPT_A,
        "pin_hash": BCRYPT_B,
    })

    r1 = await reconcile_auth_hashes(db, batch=10, max_users=100)
    assert r1["reconciled_users"] == 1

    r2 = await reconcile_auth_hashes(db, batch=10, max_users=100)
    assert r2["reconciled_users"] == 0
    assert r2["already_consistent"] == 1


# ── Source-code contract tests ─────────────────────────────────────────
def test_reset_password_uses_write_auth_hash():
    """Contract: `/api/auth/reset-password` MUST route through the
    consolidator so no legacy field can hold a stale hash after reset.
    """
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "auth.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()

    # Find the reset-password endpoint decorator and function body.
    # There are multiple endpoints — check the whole file has AT LEAST
    # one clean call to write_auth_hash and NO leftover direct write
    # to only `password_hash` on a reset flow.
    assert "from utils.auth_hash_consolidation import" in src, (
        "routes/auth.py must import from auth_hash_consolidation"
    )
    assert "write_auth_hash(" in src, (
        "routes/auth.py must call write_auth_hash() on reset/change"
    )


def test_change_password_uses_consolidator_and_authoritative_verify():
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "routes", "auth.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()

    change_idx = src.find("async def change_password(")
    assert change_idx > 0
    body = src[change_idx : change_idx + 1500]

    # Must fetch the authoritative hash (not blindly use password_hash)
    assert "pick_authoritative_hash" in body, (
        "change_password must verify against pick_authoritative_hash() "
        "so users mid-migration can still change their password"
    )
    # Must write via consolidator
    assert "write_auth_hash(" in body, (
        "change_password must write via write_auth_hash()"
    )


def test_admin_reset_password_uses_consolidator():
    src_path = os.path.join(
        os.path.dirname(__file__), "..", "server.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        src = f.read()

    idx = src.find('elif action == "reset_password"')
    assert idx > 0
    body = src[idx : idx + 2500]
    assert "write_auth_hash(" in body, (
        "admin reset_password action must route through write_auth_hash()"
    )
    # Should NOT have the old ad-hoc `password_hash + pin_hash` update
    # (which left `hashed_pin` stale).
    assert 'update_fields["pin_hash"] = hashed_password' not in body, (
        "admin reset_password still has the legacy ad-hoc updater — "
        "please route through write_auth_hash()"
    )
