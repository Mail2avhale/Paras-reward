"""
Layer 3 (Feb 24 2026) — Bounded embed for `mining_history` +
`prc_transactions` in the users collection.

Tests:
  1. `bound_single_user` archives non-empty mining_history and unsets
     the field.
  2. `bound_single_user` slices `prc_transactions` to last N when the
     array is over the limit.
  3. `bound_single_user` is idempotent — running twice is a no-op.
  4. `bound_single_user` no-ops when both arrays are already OK.
  5. `bound_all_users` returns correct aggregate counters.
  6. `PRC_TRANSACTIONS_EMBED_LIMIT` is locked to 20 (contract with
     wallet_service.py + wallet_service_v2.py write paths).
"""
import asyncio
import os
import sys
import types
import pytest
import pytest_asyncio
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.bound_user_arrays import (  # noqa: E402
    PRC_TRANSACTIONS_EMBED_LIMIT,
    bound_all_users,
    bound_single_user,
    ensure_archive_indexes,
)


# ── Motor-compatible in-memory fake ────────────────────────────────────
class _FakeCollection:
    def __init__(self):
        self.docs = []  # list[dict]
        self.inserted = []
        self.updates = []
        self.indexes_created = []

    def _match(self, doc, filt):
        for k, v in filt.items():
            if k == "$expr":
                # naive: assume the caller intends "true"; return all docs
                continue
            if doc.get(k) != v:
                return False
        return True

    async def insert_many(self, docs, ordered=False):
        # emulate motor's insert_many
        self.inserted.extend(docs)
        self.docs.extend(docs)
        return types.SimpleNamespace(inserted_ids=list(range(len(docs))))

    async def update_one(self, filt, update):
        self.updates.append((filt, update))
        for d in self.docs:
            if self._match(d, filt):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        d[k] = v
                if "$unset" in update:
                    for k in update["$unset"].keys():
                        d.pop(k, None)
                return types.SimpleNamespace(matched_count=1, modified_count=1)
        return types.SimpleNamespace(matched_count=0, modified_count=0)

    async def create_index(self, keys, background=True, name=None):
        self.indexes_created.append((keys, name))

    def find(self, filt=None, projection=None):
        docs = list(self.docs) if filt is None else [d for d in self.docs if self._match(d, filt)]
        return _FakeCursor(docs)


class _FakeCursor:
    def __init__(self, docs):
        self._docs = docs
        self._limit = None
        self._batch_size = None

    def limit(self, n):
        self._limit = n
        return self

    def batch_size(self, n):
        self._batch_size = n
        return self

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, length=None):
        docs = self._docs[: (self._limit or length or len(self._docs))]
        return docs

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
        self.mining_history_archive = _FakeCollection()


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# ── Tests ──────────────────────────────────────────────────────────────
def test_prc_embed_limit_is_20():
    # Locks the contract with wallet_service.py + wallet_service_v2.py
    # `$slice: -20` write paths. Changing this without updating those
    # files would silently drift them apart.
    assert PRC_TRANSACTIONS_EMBED_LIMIT == 20


@pytest.mark.asyncio
async def test_bound_single_user_archives_mining_history_and_unsets():
    db = _FakeDB()
    user = {
        "uid": "u1",
        "mining_history": [
            {"amount": 1.0, "timestamp": _now_iso()},
            {"amount": 2.5, "timestamp": _now_iso()},
        ],
        "prc_transactions": [],
    }
    db.users.docs.append(user)

    r = await bound_single_user(db, user)

    assert r["uid"] == "u1"
    assert r["mining_archived"] == 2
    assert r["prc_trimmed"] == 0
    assert r["updated"] is True

    # archive has both entries with user_id + migrated_at annotation
    assert len(db.mining_history_archive.inserted) == 2
    for d in db.mining_history_archive.inserted:
        assert d["user_id"] == "u1"
        assert "migrated_at" in d

    # user doc no longer has mining_history
    assert "mining_history" not in user


@pytest.mark.asyncio
async def test_bound_single_user_slices_prc_transactions_to_last_20():
    db = _FakeDB()
    # 30 items — should be trimmed to last 20
    txns = [{"txn_id": f"T{i}", "amount": i} for i in range(30)]
    user = {"uid": "u2", "prc_transactions": txns}
    db.users.docs.append(user)

    r = await bound_single_user(db, user)

    assert r["prc_trimmed"] == 10  # 30 - 20
    assert r["updated"] is True

    # The update_one was called with $set of prc_transactions[10:]
    assert db.users.updates
    filt, update = db.users.updates[-1]
    assert filt == {"uid": "u2"}
    trimmed = update["$set"]["prc_transactions"]
    assert len(trimmed) == 20
    assert trimmed[0]["txn_id"] == "T10"
    assert trimmed[-1]["txn_id"] == "T29"


@pytest.mark.asyncio
async def test_bound_single_user_noop_when_arrays_are_fine():
    db = _FakeDB()
    user = {
        "uid": "u3",
        "mining_history": [],
        "prc_transactions": [{"txn_id": f"T{i}"} for i in range(5)],
    }
    db.users.docs.append(user)

    r = await bound_single_user(db, user)

    assert r["updated"] is False
    assert r["mining_archived"] == 0
    assert r["prc_trimmed"] == 0
    assert db.users.updates == []


@pytest.mark.asyncio
async def test_bound_single_user_is_idempotent():
    db = _FakeDB()
    user = {
        "uid": "u4",
        "mining_history": [{"amount": 1.0, "timestamp": _now_iso()}],
        "prc_transactions": [],
    }
    db.users.docs.append(user)

    r1 = await bound_single_user(db, user)
    assert r1["updated"] is True

    r2 = await bound_single_user(db, user)
    assert r2["updated"] is False  # already unset — nothing to do
    assert r2["mining_archived"] == 0


@pytest.mark.asyncio
async def test_bound_all_users_aggregates_counters():
    db = _FakeDB()
    # user A: 5 mining_history + 25 prc_transactions
    db.users.docs.append({
        "uid": "A",
        "mining_history": [{"amount": i, "timestamp": _now_iso()} for i in range(5)],
        "prc_transactions": [{"txn_id": f"A{i}"} for i in range(25)],
    })
    # user B: 3 mining_history, 0 prc_transactions
    db.users.docs.append({
        "uid": "B",
        "mining_history": [{"amount": i, "timestamp": _now_iso()} for i in range(3)],
        "prc_transactions": [],
    })
    # user C: 0 mining_history, 30 prc_transactions
    db.users.docs.append({
        "uid": "C",
        "mining_history": [],
        "prc_transactions": [{"txn_id": f"C{i}"} for i in range(30)],
    })
    # user D: nothing to do
    db.users.docs.append({
        "uid": "D",
        "mining_history": [],
        "prc_transactions": [],
    })

    result = await bound_all_users(db, batch=2, max_users=100)

    # A, B, C get updated; D does not (but is still iterated).
    # NOTE: fake cursor's $expr filter is a naive "match all" so D is
    # visited but bound_single_user() returns updated=False for it.
    assert result["processed_users"] >= 3
    assert result["updated_users"] == 3
    assert result["mining_history_entries_archived"] == 8  # 5 + 3
    assert result["prc_transactions_entries_trimmed"] == 15  # (25-20) + (30-20)
    assert result["failed"] == 0
    assert result["prc_embed_limit"] == 20


@pytest.mark.asyncio
async def test_ensure_archive_indexes_creates_expected_indexes():
    db = _FakeDB()
    await ensure_archive_indexes(db)

    created = db.mining_history_archive.indexes_created
    # 2 indexes: (user_id,) and (user_id, timestamp)
    assert len(created) == 2
    names = [c[1] for c in created]
    assert "user_id_1" in names
    assert "user_id_1_timestamp_-1" in names


@pytest.mark.asyncio
async def test_bound_single_user_no_uid_returns_early():
    db = _FakeDB()
    user = {"mining_history": [{"a": 1}]}  # no uid
    r = await bound_single_user(db, user)
    assert r["updated"] is False
    assert r["uid"] is None
    assert db.mining_history_archive.inserted == []


# ── Contract tests: wallet_service.py + wallet_service_v2.py $slice ────
def test_wallet_service_uses_slice_20():
    """Assert the write path in `wallet_service.py` uses $slice: -20 on
    prc_transactions push.

    This is a source-code contract test — if the wallet write path drifts
    away from the $slice bound, this test blocks the merge.
    """
    ws_path = os.path.join(
        os.path.dirname(__file__), "..", "app", "services", "wallet_service.py"
    )
    with open(ws_path, "r", encoding="utf-8") as f:
        src = f.read()
    # Both credit (line ~103) and debit (line ~210) $push blocks should
    # have `"$slice": -20`.
    assert src.count('"$slice": -20') >= 2, (
        "wallet_service.py: expected at least 2 `$slice: -20` blocks "
        "(one for credit, one for debit) — Layer 3 bound is missing"
    )


def test_wallet_service_v2_uses_slice_20():
    ws2_path = os.path.join(
        os.path.dirname(__file__), "..", "app", "services", "wallet_service_v2.py"
    )
    with open(ws2_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert src.count('"$slice": -20') >= 2, (
        "wallet_service_v2.py: expected at least 2 `$slice: -20` blocks "
        "(one for credit, one for debit) — Layer 3 bound is missing"
    )
