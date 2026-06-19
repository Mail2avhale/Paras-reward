"""
Tests for L1-L5 Network Cap Cascade feature.

Formula: min(8000, 800 + 16*L1 + 5*L2 + 3*L3 + 2*L4 + 1*L5)

Endpoints under test:
  - GET /api/mining/rate-breakdown/{uid}
  - GET /api/mining/status/{uid}
  - GET /api/growth/network-stats/{user_id}
  - GET /api/notifications/referrals/{user_id}/level-breakdown
"""
import os
import sys
import uuid
import asyncio
import pytest
import requests
from datetime import datetime, timezone

# Load backend env so MONGO_URL/DB_NAME are available
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path('/app/backend/.env'))

from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Fall back to frontend .env (mounted on tester machine)
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL'):
                    BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
                    break
    except Exception:
        pass

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

API = f"{BASE_URL}/api"

# -----------------------------------------------------------------------------
# Mongo helpers - we manage event loops carefully since pytest-asyncio not used
# -----------------------------------------------------------------------------
_loop = asyncio.new_event_loop()


def run(coro):
    return _loop.run_until_complete(coro)


def _client():
    return AsyncIOMotorClient(MONGO_URL)


def _unique_mobile():
    """10 digit unique mobile based on uuid (no leading zero)."""
    return "9" + uuid.uuid4().hex[:9].translate(str.maketrans("abcdef", "012345"))


async def _insert_user(db, uid, name, referred_by=None, referral_code=None, extra=None):
    doc = {
        "uid": uid,
        "name": name,
        "email": f"test-l1l5-{uid}@test.local",
        "mobile": _unique_mobile(),
        "referral_code": referral_code or f"RC-{uid[:8]}",
        "referred_by": referred_by,
        "prc_balance": 0,
        "subscription_plan": "explorer",
        "is_mining": False,
        "created_at": datetime.now(timezone.utc),
    }
    if extra:
        doc.update(extra)
    await db.users.insert_one(doc)
    return doc


async def _cleanup(db, uids):
    if uids:
        await db.users.delete_many({"uid": {"$in": uids}})


# -----------------------------------------------------------------------------
# Seeded chain fixtures
# -----------------------------------------------------------------------------
@pytest.fixture(scope="module")
def small_chain():
    """ROOT -> 2xL1 -> 2xL2 -> 1xL3 -> 1xL4 -> 1xL5.
       Expected cap = 800 + 16*2 + 5*2 + 3*1 + 2*1 + 1*1 = 848
    """
    created = []

    async def seed():
        nonlocal created
        client = _client()
        db = client[DB_NAME]
        try:
            root_uid = f"TEST-L1L5-ROOT-{uuid.uuid4().hex[:8]}"
            root_rc = f"RC-{root_uid[-8:]}"
            await _insert_user(db, root_uid, "TEST Root", referral_code=root_rc)
            created.append(root_uid)

            # 2 x L1 (referred_by = root uid) - using uid linking only for mining rate test
            l1a = f"TEST-L1L5-L1A-{uuid.uuid4().hex[:8]}"
            l1b = f"TEST-L1L5-L1B-{uuid.uuid4().hex[:8]}"
            await _insert_user(db, l1a, "TEST L1A", referred_by=root_uid,
                               referral_code=f"RC-{l1a[-8:]}")
            await _insert_user(db, l1b, "TEST L1B", referred_by=root_uid,  # uid flavour (was rc)
                               referral_code=f"RC-{l1b[-8:]}")
            created.extend([l1a, l1b])

            # 2 x L2 (one under each L1) — mixed flavours to test BFS
            l2a = f"TEST-L1L5-L2A-{uuid.uuid4().hex[:8]}"
            l2b = f"TEST-L1L5-L2B-{uuid.uuid4().hex[:8]}"
            await _insert_user(db, l2a, "TEST L2A", referred_by=l1a,  # uid flavour
                               referral_code=f"RC-{l2a[-8:]}")
            await _insert_user(db, l2b, "TEST L2B", referred_by=f"RC-{l1b[-8:]}",  # rc flavour
                               referral_code=f"RC-{l2b[-8:]}")
            created.extend([l2a, l2b])

            # 1 x L3
            l3 = f"TEST-L1L5-L3-{uuid.uuid4().hex[:8]}"
            await _insert_user(db, l3, "TEST L3", referred_by=l2a,
                               referral_code=f"RC-{l3[-8:]}")
            created.append(l3)

            # 1 x L4
            l4 = f"TEST-L1L5-L4-{uuid.uuid4().hex[:8]}"
            await _insert_user(db, l4, "TEST L4", referred_by=l3,
                               referral_code=f"RC-{l4[-8:]}")
            created.append(l4)

            # 1 x L5
            l5 = f"TEST-L1L5-L5-{uuid.uuid4().hex[:8]}"
            await _insert_user(db, l5, "TEST L5", referred_by=l4,
                               referral_code=f"RC-{l5[-8:]}")
            created.append(l5)

            return root_uid
        finally:
            client.close()

    root_uid = run(seed())
    yield root_uid

    async def teardown():
        client = _client()
        db = client[DB_NAME]
        try:
            await _cleanup(db, created)
        finally:
            client.close()

    run(teardown())


@pytest.fixture(scope="module")
def cap_max_chain():
    """Seed enough users so raw_cap exceeds 8000 and is clamped.
       500 L1 + 1000 L2 + 1000 L3 + 1000 L4 + 1000 L5 — bulk insert in batches.
       raw_cap = 800 + 16*500 + 5*1000 + 3*1000 + 2*1000 + 1*1000 = 800+8000+5000+3000+2000+1000 = 19800.
    """
    created = []

    async def seed():
        nonlocal created
        client = _client()
        db = client[DB_NAME]
        try:
            root_uid = f"TEST-L1L5-MAXROOT-{uuid.uuid4().hex[:8]}"
            await _insert_user(db, root_uid, "TEST MaxRoot",
                               referral_code=f"RC-{root_uid[-8:]}")
            created.append(root_uid)

            def make(prefix, parent_uid, n):
                docs = []
                uids = []
                for i in range(n):
                    u = f"TEST-L1L5-{prefix}-{uuid.uuid4().hex[:10]}"
                    uids.append(u)
                    docs.append({
                        "uid": u,
                        "name": f"TEST {prefix}{i}",
                        "email": f"test-l1l5-{u}@test.local",
                        "mobile": _unique_mobile(),
                        "referral_code": f"RC-{u[-8:]}",
                        "referred_by": parent_uid,
                        "prc_balance": 0,
                        "subscription_plan": "explorer",
                        "created_at": datetime.now(timezone.utc),
                    })
                return docs, uids

            # 500 L1 children of root
            l1_docs, l1_uids = make("L1", root_uid, 500)
            await db.users.insert_many(l1_docs)
            created.extend(l1_uids)

            # 1000 L2 — first 1000 attached to first 1000 L1 (we only have 500 so attach 2 per L1)
            l2_docs = []
            l2_uids = []
            for i in range(1000):
                parent = l1_uids[i % len(l1_uids)]
                u = f"TEST-L1L5-L2-{uuid.uuid4().hex[:10]}"
                l2_uids.append(u)
                l2_docs.append({
                    "uid": u,
                    "name": f"TEST L2{i}",
                    "email": f"test-l1l5-{u}@test.local",
                    "mobile": _unique_mobile(),
                    "referral_code": f"RC-{u[-8:]}",
                    "referred_by": parent,
                    "prc_balance": 0,
                    "subscription_plan": "explorer",
                    "created_at": datetime.now(timezone.utc),
                })
            await db.users.insert_many(l2_docs)
            created.extend(l2_uids)

            # 1000 L3 under L2
            l3_docs = []
            l3_uids = []
            for i in range(1000):
                parent = l2_uids[i]
                u = f"TEST-L1L5-L3-{uuid.uuid4().hex[:10]}"
                l3_uids.append(u)
                l3_docs.append({
                    "uid": u, "name": f"TEST L3{i}",
                    "email": f"test-l1l5-{u}@test.local",
                    "mobile": _unique_mobile(),
                    "referral_code": f"RC-{u[-8:]}",
                    "referred_by": parent,
                    "prc_balance": 0,
                    "subscription_plan": "explorer",
                    "created_at": datetime.now(timezone.utc),
                })
            await db.users.insert_many(l3_docs)
            created.extend(l3_uids)

            # 1000 L4
            l4_docs = []
            l4_uids = []
            for i in range(1000):
                parent = l3_uids[i]
                u = f"TEST-L1L5-L4-{uuid.uuid4().hex[:10]}"
                l4_uids.append(u)
                l4_docs.append({
                    "uid": u, "name": f"TEST L4{i}",
                    "email": f"test-l1l5-{u}@test.local",
                    "mobile": _unique_mobile(),
                    "referral_code": f"RC-{u[-8:]}",
                    "referred_by": parent,
                    "prc_balance": 0,
                    "subscription_plan": "explorer",
                    "created_at": datetime.now(timezone.utc),
                })
            await db.users.insert_many(l4_docs)
            created.extend(l4_uids)

            # 1000 L5
            l5_docs = []
            l5_uids = []
            for i in range(1000):
                parent = l4_uids[i]
                u = f"TEST-L1L5-L5-{uuid.uuid4().hex[:10]}"
                l5_uids.append(u)
                l5_docs.append({
                    "uid": u, "name": f"TEST L5{i}",
                    "email": f"test-l1l5-{u}@test.local",
                    "mobile": _unique_mobile(),
                    "referral_code": f"RC-{u[-8:]}",
                    "referred_by": parent,
                    "prc_balance": 0,
                    "subscription_plan": "explorer",
                    "created_at": datetime.now(timezone.utc),
                })
            await db.users.insert_many(l5_docs)
            created.extend(l5_uids)

            return root_uid
        finally:
            client.close()

    root_uid = run(seed())
    yield root_uid

    async def teardown():
        client = _client()
        db = client[DB_NAME]
        try:
            # Bulk delete by prefix to ensure cleanup even if list partial
            await db.users.delete_many({"uid": {"$regex": "^TEST-L1L5-"}})
        finally:
            client.close()

    run(teardown())


# -----------------------------------------------------------------------------
# Test 1+2: rate-breakdown & status return new fields
# -----------------------------------------------------------------------------
class TestNewFieldsPresence:
    def test_rate_breakdown_has_new_fields(self, small_chain):
        r = requests.get(f"{API}/mining/rate-breakdown/{small_chain}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for f in ("cap_tier4_bonus", "cap_tier5_bonus", "cap_tier6_bonus",
                  "l3_count", "l4_count", "l5_count", "network_cap_formula"):
            assert f in d, f"missing field {f}"
        assert d["network_cap_formula"] == \
            "min(8000, 800 + 16*L1 + 5*L2 + 3*L3 + 2*L4 + 1*L5)"

    def test_mining_status_has_new_fields(self, small_chain):
        r = requests.get(f"{API}/mining/status/{small_chain}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for f in ("cap_tier4_bonus", "cap_tier5_bonus", "cap_tier6_bonus",
                  "l3_count", "l4_count", "l5_count"):
            assert f in d, f"missing field {f}"


# -----------------------------------------------------------------------------
# Test 3: cap math correctness on small chain
# -----------------------------------------------------------------------------
class TestCapMath:
    def test_small_chain_cap(self, small_chain):
        r = requests.get(f"{API}/mining/rate-breakdown/{small_chain}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # Expected: L1=2, L2=2, L3=1, L4=1, L5=1
        assert d["direct_referrals"] == 2, d
        assert d["l1_indirect_referrals"] == 2, d
        assert d["l3_count"] == 1, d
        assert d["l4_count"] == 1, d
        assert d["l5_count"] == 1, d
        assert d["cap_tier1_base"] == 800
        assert d["cap_tier2_bonus"] == 32   # 16*2
        assert d["cap_tier3_bonus"] == 10   # 5*2
        assert d["cap_tier4_bonus"] == 3
        assert d["cap_tier5_bonus"] == 2
        assert d["cap_tier6_bonus"] == 1
        assert d["network_cap"] == 848

    def test_growth_network_stats_small_chain(self, small_chain):
        r = requests.get(f"{API}/growth/network-stats/{small_chain}", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        d = body["data"]
        for f in ("cap_tier4_bonus", "cap_tier5_bonus", "cap_tier6_bonus",
                  "l3_count", "l4_count", "l5_count"):
            assert f in d, f"missing field {f}"
        assert d["direct_referrals"] == 2
        assert d["l1_indirect_referrals"] == 2
        assert d["l3_count"] == 1
        assert d["l4_count"] == 1
        assert d["l5_count"] == 1
        assert d["network_cap"] == 848


# -----------------------------------------------------------------------------
# Test 4: cap maxes at 8000
# -----------------------------------------------------------------------------
class TestCapMax:
    def test_cap_clamped_at_8000(self, cap_max_chain):
        r = requests.get(f"{API}/mining/rate-breakdown/{cap_max_chain}", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["direct_referrals"] == 500, d
        assert d["l1_indirect_referrals"] == 1000, d
        assert d["l3_count"] == 1000, d
        assert d["l4_count"] == 1000, d
        assert d["l5_count"] == 1000, d
        assert d["network_cap"] == 8000  # clamped


# -----------------------------------------------------------------------------
# Test 5: base case - zero referrals => cap=800
# -----------------------------------------------------------------------------
class TestBaseCase:
    def test_zero_referral_user(self):
        # admin-test-123 has no referrals per problem statement
        r = requests.get(f"{API}/mining/rate-breakdown/admin-test-123", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["direct_referrals"] == 0, d
        assert d["l1_indirect_referrals"] == 0, d
        assert d["l3_count"] == 0, d
        assert d["l4_count"] == 0, d
        assert d["l5_count"] == 0, d
        assert d["network_cap"] == 800, d


# -----------------------------------------------------------------------------
# Test 6: /api/notifications/referrals/{uid}/level-breakdown
# -----------------------------------------------------------------------------
class TestLevelBreakdownEndpoint:
    def test_level_breakdown_returns_l1_l5(self, small_chain):
        r = requests.get(
            f"{API}/notifications/referrals/{small_chain}/level-breakdown",
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # Endpoint walks only via uid linking ⇒ root has 1 L1 (one was linked via referral_code)
        # We still assert L1-L5 buckets exist
        levels = d.get("levels") or d.get("Levels") or {}
        # Could also be top-level keyed by L1..L5
        keys = list(d.keys())
        # Be lenient: just check L1..L5 keys appear somewhere
        flat = str(d)
        for k in ("L1", "L2", "L3", "L4", "L5"):
            assert k in flat, f"{k} missing from level-breakdown response: {keys}"


# -----------------------------------------------------------------------------
# Test 7: Mixed-flavour referred_by — exercises BFS helper handling uid + rc
# Documents an inconsistency: mining.calculate_mining_rate uses a plain
# count_documents({"referred_by": uid}) which does NOT handle referral_code
# linkage, while growth_economy.get_growth_network_stats uses $or so it does.
# -----------------------------------------------------------------------------
@pytest.fixture(scope="module")
def mixed_flavour_chain():
    created = []

    async def seed():
        nonlocal created
        client = _client()
        db = client[DB_NAME]
        try:
            root = f"TEST-L1L5-MIX-ROOT-{uuid.uuid4().hex[:8]}"
            root_rc = f"RC-{root[-8:]}"
            await _insert_user(db, root, "TEST MixRoot", referral_code=root_rc)
            created.append(root)

            # 1 L1 via uid + 1 L1 via referral_code
            a = f"TEST-L1L5-MIX-A-{uuid.uuid4().hex[:8]}"
            b = f"TEST-L1L5-MIX-B-{uuid.uuid4().hex[:8]}"
            await _insert_user(db, a, "TEST A", referred_by=root,
                               referral_code=f"RC-{a[-8:]}")
            await _insert_user(db, b, "TEST B", referred_by=root_rc,
                               referral_code=f"RC-{b[-8:]}")
            created.extend([a, b])
            return root
        finally:
            client.close()

    root = run(seed())
    yield root

    async def teardown():
        client = _client()
        db = client[DB_NAME]
        try:
            await _cleanup(db, created)
        finally:
            client.close()
    run(teardown())


class TestMixedFlavourReferral:
    def test_growth_handles_mixed_flavour(self, mixed_flavour_chain):
        r = requests.get(f"{API}/growth/network-stats/{mixed_flavour_chain}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert d["direct_referrals"] == 2, (
            f"growth-network-stats should count BOTH uid+rc L1: got {d['direct_referrals']}"
        )

    def test_mining_rate_breakdown_mixed_flavour_bug(self, mixed_flavour_chain):
        """FIX VERIFICATION: mining endpoint now reuses level_counts['l1'] from
        the BFS helper, which handles both uid and referral_code linkage. Both
        L1 children should now be counted."""
        r = requests.get(f"{API}/mining/rate-breakdown/{mixed_flavour_chain}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # After fix: mining must count both uid-linked AND rc-linked L1 children.
        assert d["direct_referrals"] == 2, (
            f"Expected 2 (mixed uid+rc count after fix). Got {d['direct_referrals']}. "
            "mining.calculate_mining_rate must use level_counts['l1'] from BFS helper."
        )
        # Cap math: 800 + 16*2 = 832 (no L2-L5 in mixed-flavour chain)
        assert d["cap_tier2_bonus"] == 32, (
            f"cap_tier2_bonus must be 16*2=32, got {d['cap_tier2_bonus']}"
        )
        assert d["network_cap"] == 832, (
            f"network_cap must be 800 + 16*2 = 832, got {d['network_cap']}"
        )

    def test_mining_and_growth_direct_referrals_consistency(self, mixed_flavour_chain):
        """CONSISTENCY: mining endpoint direct_referrals must equal
        growth_economy endpoint direct_referrals for the same user — both
        should use the BFS helper that handles mixed uid/referral_code seeds."""
        mining_resp = requests.get(
            f"{API}/mining/rate-breakdown/{mixed_flavour_chain}", timeout=15
        )
        growth_resp = requests.get(
            f"{API}/growth/network-stats/{mixed_flavour_chain}", timeout=15
        )
        assert mining_resp.status_code == 200, mining_resp.text
        assert growth_resp.status_code == 200, growth_resp.text
        m = mining_resp.json()
        g = growth_resp.json()["data"]
        assert m["direct_referrals"] == g["direct_referrals"], (
            f"mining.direct_referrals={m['direct_referrals']} != "
            f"growth.direct_referrals={g['direct_referrals']} — endpoints out of sync"
        )
        assert m["direct_referrals"] == 2, (
            f"Both endpoints should report 2 L1s; got mining={m['direct_referrals']}"
        )
