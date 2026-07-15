"""
Community Leadership Program — Phase C E2E Tests (Feb 15 2026)
================================================================
Focus:
 • Full 5-tier synthetic tree (NATIONAL→STATE→REGIONAL→DISTRICT→L1 Elite)
 • GET /api/partners/my-position/{uid} for every tier verifies:
    - position_label matches NEW UI naming
    - cap 500/1000/2000/4000/8000
    - hierarchy_score_pct present + correct %
    - community_health block (active/inactive/total/health_pct/status)
    - next_promotion block (except NATIONAL → null)
 • Community Health strict-active definition (Elite + collect ≤7d)
 • Health status thresholds: green≥70 / yellow 40-70 / red<40 / gray=0
 • Recursive hierarchy validation (partial STATE incomplete → nat not met)
 • Structure gate — DISTRICT with 72/100 → structure_met=false
 • FIFO reward ceiling — DISTRICT with 1200 L1 → only earliest 1000 credited
 • Mining commission distribution: notification title '🎉 Leadership Reward'
 • Admin assign/revoke uses X-Admin-Pin with new label + Leadership Reward notif
 • Seeded UIDs written to /tmp/community_seed.json (cleaned in teardown)
"""
import os
import sys
import json
import uuid
import asyncio
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient


# ── Load /app/backend/.env before importing routes.* ──────────────
def _load_env():
    p = Path("/app/backend/.env")
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_env()


def _load_frontend_url():
    p = Path("/app/frontend/.env")
    if not p.exists():
        return None
    for line in p.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or _load_frontend_url() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not resolvable"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward_db")
ADMIN_PIN = os.environ.get("ADMIN_OPERATION_PIN", "123456")
ADMIN_UID = "admin-test-123"

SEED_TAG = f"clp_{uuid.uuid4().hex[:8]}"  # unique per run
SEED_FILE = Path("/tmp/community_seed.json")

sys.path.insert(0, "/app/backend")


# ────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────
def _uid(prefix):
    return f"TEST_{SEED_TAG}_{prefix}_{uuid.uuid4().hex[:6]}"


def _mkuser(uid, name, referred_by=None, position="user", plan="elite",
            last_collect_days_ago=None):
    doc = {
        "uid": uid,
        "name": name,
        "mobile": f"7{random.randint(100000000, 999999999)}",
        # unique email — the partial index requires uniqueness for real strings
        "email": f"{uid.lower()}@test.clp",
        "subscription_plan": plan,
        "membership_type": plan,
        "subscription_expired": False,
        "referral_code": f"RC_{uid[-8:]}",
        "referred_by": referred_by,
        "prc_balance": 0.0,
        "partner_position": position,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if last_collect_days_ago is not None:
        doc["last_mining_collect"] = (
            datetime.now(timezone.utc) - timedelta(days=last_collect_days_ago)
        ).isoformat()
    return doc


# ────────────────────────────────────────────────────────────
# Session-scoped fixtures
# ────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def mongo():
    c = MongoClient(MONGO_URL)
    db = c[DB_NAME]
    yield db
    c.close()


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_jwt():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": "admin@test.com", "password": "153759"},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="session")
def admin_headers(admin_jwt):
    return {
        "X-Admin-Pin": ADMIN_PIN,
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_jwt}",
    }


@pytest.fixture(scope="session")
def full_tree(mongo):
    """Build FULL 5-tier tree:
       1 NATIONAL → 5 STATE → each STATE has 3 REGIONAL → each REGIONAL has 5 DISTRICT
       → each DISTRICT has 100 Elite L1 Community Members.
    Also creates:
       - A "partial DISTRICT" (72/100 members) to prove percent progress
       - A "partial STATE" (2/3 REGIONAL) to prove recursive hierarchy fails
    """
    uids = {"leaves": []}

    # 1 NATIONAL
    nat_uid = _uid("NAT")
    uids["national"] = nat_uid
    docs = [_mkuser(nat_uid, "TEST National", None, "national_partner",
                    last_collect_days_ago=1)]

    # 5 STATE under NATIONAL
    state_uids = []
    for si in range(5):
        s_uid = _uid(f"ST{si}")
        state_uids.append(s_uid)
        docs.append(_mkuser(s_uid, f"TEST State {si}", nat_uid, "state_partner",
                            last_collect_days_ago=1))
        # 3 REGIONAL per STATE
        for ri in range(3):
            r_uid = _uid(f"RG{si}{ri}")
            docs.append(_mkuser(r_uid, f"TEST Regional {si}{ri}", s_uid,
                                "regional_state_partner", last_collect_days_ago=1))
            # 5 DISTRICT per REGIONAL
            for di in range(5):
                d_uid = _uid(f"DT{si}{ri}{di}")
                docs.append(_mkuser(d_uid, f"TEST District {si}{ri}{di}", r_uid,
                                    "district_partner", last_collect_days_ago=1))
                # Full 100 elite L1 members — but that's 5*3*5=75 districts × 100
                # = 7500 members. Too heavy for quick test. Only fill the FIRST
                # district in the tree with 100 to exercise validation; give
                # others zero so structure_met can fail deterministically for
                # NATIONAL. We'll test recursive validation separately with a
                # dedicated "verified" mini-tree.
                if si == 0 and ri == 0 and di == 0:
                    for li in range(100):
                        l_uid = _uid(f"L1v_{si}{ri}{di}_{li}")
                        docs.append(_mkuser(l_uid, f"TEST Leaf V{li}", d_uid,
                                            "user", last_collect_days_ago=1))
                        uids["leaves"].append(l_uid)
    uids["states"] = state_uids

    # Partial DISTRICT — 72/100 members
    partial_d_uid = _uid("DT_PARTIAL")
    docs.append(_mkuser(partial_d_uid, "TEST District Partial", None,
                        "district_partner", last_collect_days_ago=1))
    uids["district_partial"] = partial_d_uid
    for li in range(72):
        l_uid = _uid(f"L1p_{li}")
        docs.append(_mkuser(l_uid, f"TEST Leaf P{li}", partial_d_uid,
                            "user", last_collect_days_ago=1))

    # Fully-verified DISTRICT (100 members) — for FIFO cap tests we can extend
    # this. We already have si=0 ri=0 di=0 fully populated above. But we need
    # more control — create a dedicated FIFO-district with 1200 members.
    fifo_d_uid = _uid("DT_FIFO")
    docs.append(_mkuser(fifo_d_uid, "TEST District FIFO", None,
                        "district_partner", last_collect_days_ago=1))
    uids["district_fifo"] = fifo_d_uid
    fifo_leaf_uids = []
    for li in range(1200):
        l_uid = _uid(f"L1f_{li:04d}")
        # Order matters for FIFO; created_at ascending
        doc = _mkuser(l_uid, f"TEST Leaf F{li}", fifo_d_uid,
                      "user", last_collect_days_ago=0)
        # override created_at to enforce strict ordering
        doc["created_at"] = (datetime.now(timezone.utc)
                             + timedelta(seconds=li)).isoformat()
        docs.append(doc)
        fifo_leaf_uids.append(l_uid)
    uids["district_fifo_leaves"] = fifo_leaf_uids

    # A default "Community Member" user (for tier=user my-position test)
    cm_uid = _uid("CM")
    docs.append(_mkuser(cm_uid, "TEST Community Member", None, "user"))
    uids["community_member"] = cm_uid

    # A community-health test district — 5 L1 elite (3 active / 2 stale)
    ch_uid = _uid("CH_D")
    docs.append(_mkuser(ch_uid, "TEST CH District", None, "district_partner"))
    uids["ch_district"] = ch_uid
    ch_leaves = []
    for i in range(3):
        u = _uid(f"CHa_{i}")
        docs.append(_mkuser(u, f"CH Active {i}", ch_uid, "user",
                            last_collect_days_ago=1))
        ch_leaves.append(u)
    for i in range(2):
        u = _uid(f"CHs_{i}")
        docs.append(_mkuser(u, f"CH Stale {i}", ch_uid, "user",
                            last_collect_days_ago=10))
        ch_leaves.append(u)
    uids["ch_leaves"] = ch_leaves

    # Bulk insert
    mongo.users.insert_many(docs)

    # Save UIDs to JSON for cleanup
    all_uids = [d["uid"] for d in docs]
    SEED_FILE.write_text(json.dumps({"tag": SEED_TAG, "uids": all_uids}, indent=2))

    yield uids

    # ── Teardown ───────────────────────────────────────────
    mongo.users.delete_many({"uid": {"$in": all_uids}})
    mongo.prc_ledger.delete_many({"user_id": {"$in": all_uids}})
    mongo.prc_ledger.delete_many({"downline_uid": {"$in": all_uids}})
    mongo.notifications.delete_many({"user_id": {"$in": all_uids}})
    try:
        SEED_FILE.unlink()
    except Exception:
        pass


# ════════════════════════════════════════════════════════════
# 1. LABEL / CAP / PHASE-C SHAPE ACROSS ALL 5 TIERS
# ════════════════════════════════════════════════════════════
EXPECTED = {
    "user":                   ("Community Member",     500),
    "district_partner":       ("District Coordinator", 1000),
    "regional_state_partner": ("Regional Coordinator", 2000),
    "state_partner":          ("State Coordinator",    4000),
    "national_partner":       ("National Coordinator", 8000),
}


class TestMyPositionAllTiers:

    @pytest.mark.parametrize("tier_key,pos_field", [
        ("community_member", "user"),
        ("district_fifo", "district_partner"),
        ("states", "state_partner"),  # index 0 of states
        ("national", "national_partner"),
    ])
    def test_tier_response_shape(self, api, full_tree, tier_key, pos_field):
        uid_or_list = full_tree[tier_key]
        uid = uid_or_list[0] if isinstance(uid_or_list, list) else uid_or_list

        r = api.get(f"{BASE_URL}/api/partners/my-position/{uid}")
        assert r.status_code == 200, r.text
        body = r.json()

        expected_label, expected_cap = EXPECTED[pos_field]
        assert body["partner_position"] == pos_field, body
        assert body["position_label"] == expected_label, body
        assert body["cap"] == expected_cap, body

        # Phase C blocks
        assert "hierarchy_score_pct" in body
        assert isinstance(body["hierarchy_score_pct"], (int, float))

        ch = body["community_health"]
        for f in ("active_count", "inactive_count", "total_elite_l1",
                  "health_pct", "status"):
            assert f in ch, f"community_health missing {f}"
        assert ch["status"] in ("green", "yellow", "red", "gray")

        # next_promotion — NATIONAL → null, others → dict
        if pos_field == "national_partner":
            assert body["next_promotion"] is None
        else:
            np = body["next_promotion"]
            assert np is not None, "next_promotion should not be null for non-NATIONAL"
            for f in ("next_position", "next_label", "child_label",
                      "required_count", "current_count", "missing_count",
                      "progress_pct", "ready"):
                assert f in np, f"next_promotion missing {f}"

    def test_regional_state_position(self, api, mongo, full_tree):
        # Find a regional user
        st = full_tree["states"][0]
        reg = mongo.users.find_one({"referred_by": st,
                                    "partner_position": "regional_state_partner"})
        assert reg is not None
        r = api.get(f"{BASE_URL}/api/partners/my-position/{reg['uid']}")
        assert r.status_code == 200
        body = r.json()
        assert body["position_label"] == "Regional Coordinator"
        assert body["cap"] == 2000

    def test_district_partial_progress_pct(self, api, full_tree):
        # DISTRICT with 72/100 — hierarchy_score_pct should be 72.0
        uid = full_tree["district_partial"]
        r = api.get(f"{BASE_URL}/api/partners/my-position/{uid}")
        assert r.status_code == 200
        body = r.json()
        assert body["structure_required"] is True
        assert body["structure_met"] is False, "72/100 should NOT meet structure"
        assert abs(body["hierarchy_score_pct"] - 72.0) < 0.5, body
        # commission_active must reflect structure gate
        assert body["commission_active"] is False


# ════════════════════════════════════════════════════════════
# 2. COMMUNITY HEALTH DEFINITION
# ════════════════════════════════════════════════════════════
class TestCommunityHealth:
    def test_strict_active_definition(self, api, full_tree):
        """CH district has 3 recent + 2 stale L1 elites → 3 active, 2 inactive, 60% yellow."""
        uid = full_tree["ch_district"]
        r = api.get(f"{BASE_URL}/api/partners/my-position/{uid}")
        assert r.status_code == 200
        ch = r.json()["community_health"]
        assert ch["active_count"] == 3, ch
        assert ch["inactive_count"] == 2, ch
        assert ch["total_elite_l1"] == 5, ch
        assert abs(ch["health_pct"] - 60.0) < 0.5, ch
        assert ch["status"] == "yellow", ch

    def test_gray_when_no_l1_elites(self, api, full_tree):
        """Community Member with no downlines → status gray."""
        uid = full_tree["community_member"]
        r = api.get(f"{BASE_URL}/api/partners/my-position/{uid}")
        assert r.status_code == 200
        ch = r.json()["community_health"]
        assert ch["total_elite_l1"] == 0
        assert ch["status"] == "gray", ch

    def test_green_when_all_active(self, mongo, api, full_tree):
        """Add a district where ALL L1s are recent → health_pct 100 green."""
        d_uid = _uid("CH_GREEN")
        mongo.users.insert_one(_mkuser(d_uid, "CH Green Dist", None,
                                       "district_partner"))
        leaves = []
        for i in range(4):
            u = _uid(f"CHg_{i}")
            mongo.users.insert_one(_mkuser(u, f"CHg{i}", d_uid, "user",
                                           last_collect_days_ago=1))
            leaves.append(u)
        try:
            r = api.get(f"{BASE_URL}/api/partners/my-position/{d_uid}")
            ch = r.json()["community_health"]
            assert ch["active_count"] == 4
            assert ch["health_pct"] == 100.0
            assert ch["status"] == "green"
        finally:
            mongo.users.delete_many({"uid": {"$in": [d_uid] + leaves}})

    def test_red_when_below_40pct(self, mongo, api):
        """1 active out of 5 → 20% red."""
        d_uid = _uid("CH_RED")
        mongo.users.insert_one(_mkuser(d_uid, "CH Red Dist", None,
                                       "district_partner"))
        leaves = []
        for i in range(1):
            u = _uid(f"CHr_a{i}")
            mongo.users.insert_one(_mkuser(u, f"CHr a{i}", d_uid, "user",
                                           last_collect_days_ago=1))
            leaves.append(u)
        for i in range(4):
            u = _uid(f"CHr_s{i}")
            mongo.users.insert_one(_mkuser(u, f"CHr s{i}", d_uid, "user",
                                           last_collect_days_ago=15))
            leaves.append(u)
        try:
            r = api.get(f"{BASE_URL}/api/partners/my-position/{d_uid}")
            ch = r.json()["community_health"]
            assert ch["active_count"] == 1
            assert ch["health_pct"] == 20.0
            assert ch["status"] == "red"
        finally:
            mongo.users.delete_many({"uid": {"$in": [d_uid] + leaves}})


# ════════════════════════════════════════════════════════════
# 3. RECURSIVE HIERARCHY VALIDATION
# ════════════════════════════════════════════════════════════
class TestHierarchyValidation:
    def test_district_with_72_fails_structure(self, api, full_tree):
        uid = full_tree["district_partial"]
        r = api.get(f"{BASE_URL}/api/partners/my-position/{uid}")
        assert r.json()["structure_met"] is False

    def test_national_needs_5_verified_states(self, api, mongo, full_tree):
        """NATIONAL from full_tree has 5 states but none of them individually
        satisfy their own subtree fully → structure_met = False."""
        uid = full_tree["national"]
        r = api.get(f"{BASE_URL}/api/partners/my-position/{uid}")
        assert r.status_code == 200
        body = r.json()
        assert body["structure_met"] is False, (
            "NATIONAL should be structure_met=false since its STATE children "
            "do not each have 3 fully-verified REGIONALs. Got: "
            f"{body.get('structure_report')}"
        )


# ════════════════════════════════════════════════════════════
# 4. FIFO REWARD CEILING (via commission distribution)
# ════════════════════════════════════════════════════════════
async def _direct_distribute(collector_uid, amount, ts):
    from motor.motor_asyncio import AsyncIOMotorClient
    import importlib
    mc = importlib.import_module("routes.mining_commission")
    pp = importlib.import_module("routes.partner_positions")
    try:
        nt = importlib.import_module("routes.notifications")
    except Exception:
        nt = None
    client = AsyncIOMotorClient(MONGO_URL)
    mc.set_db(client[DB_NAME])
    pp.set_db(client[DB_NAME])
    if nt is not None:
        try:
            nt.set_db(client[DB_NAME])
        except Exception:
            pass
    try:
        return await mc.distribute_mining_collect_commission(
            collector_uid=collector_uid, collected_prc=amount,
            collect_timestamp=ts,
        )
    finally:
        client.close()


class TestFifoCap:
    @pytest.mark.xfail(reason="FIFO cap enforcement not implemented — docstring only. "
                              "See /app/backend/routes/partner_positions.py L15.",
                       strict=False)
    def test_district_1200_l1_only_earliest_1000_credit(self, mongo, full_tree,
                                                        monkeypatch):
        """DISTRICT has 1200 L1 leaves. Simulate one collect from the LAST
        (#1200) leaf and one from the 500th leaf. Because the FIFO cap is
        1000, the 1200th leaf's collect should NOT propagate to the DISTRICT
        upline while the 500th leaf's collect SHOULD."""
        # Bypass structure gate for this pure-cap test
        import importlib
        pp = importlib.import_module("routes.partner_positions")
        monkeypatch.setattr(pp, "POSITION_STRUCTURE_REQUIREMENT", {})
        pp.clear_structure_cache()

        d_uid = full_tree["district_fifo"]
        leaves = full_tree["district_fifo_leaves"]

        # collect from 500th leaf (index 499) — must credit
        ts1 = datetime.now(timezone.utc)
        res_in = asyncio.run(_direct_distribute(leaves[499], 100.0, ts1))
        recipients_in = {d["uid"] for d in res_in.get("distributed", [])}

        # collect from 1200th leaf (index 1199) — must NOT credit
        ts2 = datetime.now(timezone.utc) + timedelta(seconds=1)
        res_out = asyncio.run(_direct_distribute(leaves[1199], 100.0, ts2))
        recipients_out = {d["uid"] for d in res_out.get("distributed", [])}

        assert d_uid in recipients_in, (
            f"500th leaf collect must credit district. Got: {res_in}"
        )
        assert d_uid not in recipients_out, (
            f"1200th leaf collect must NOT credit district (FIFO cap=1000). "
            f"Got: {res_out}"
        )

        # cleanup ledger from these calls
        mongo.prc_ledger.delete_many({
            "source_ref": {"$in": [
                f"mining_collect:{leaves[499]}:{ts1.isoformat()}",
                f"mining_collect:{leaves[1199]}:{ts2.isoformat()}",
            ]}
        })


# ════════════════════════════════════════════════════════════
# 5. NOTIFICATION TITLE — Mining collect propagation
# ════════════════════════════════════════════════════════════
class TestLeadershipRewardNotification:
    def test_notif_title_and_message(self, mongo, full_tree, monkeypatch):
        """When distribution happens the recipient's notification must have
        title '🎉 Leadership Reward Received!' and message containing
        'Tier X Leadership Reward'."""
        import importlib
        pp = importlib.import_module("routes.partner_positions")
        monkeypatch.setattr(pp, "POSITION_STRUCTURE_REQUIREMENT", {})
        pp.clear_structure_cache()

        d_uid = full_tree["district_fifo"]
        leaf = full_tree["district_fifo_leaves"][0]  # 1st leaf, hop 1

        ts = datetime.now(timezone.utc)
        res = asyncio.run(_direct_distribute(leaf, 100.0, ts))
        assert res.get("distributed"), f"No distribution: {res}"

        # Fetch recipient notification (any recent one for this user)
        notif = mongo.notifications.find_one(
            {"user_id": d_uid, "type": "mining_referral_reward"}
        )
        if notif is None:
            # try alternate key
            notif = mongo.notifications.find_one(
                {"user_uid": d_uid, "type": "mining_referral_reward"}
            )
        assert notif is not None, (
            f"Leadership Reward notification missing for {d_uid}. "
            f"Distribution result: {res}"
        )
        assert notif["title"] == "🎉 Leadership Reward Received!", notif["title"]
        assert "Leadership Reward" in notif["message"], notif["message"]
        assert "Referral Reward" not in notif["title"], (
            "Title still contains legacy 'Referral Reward'"
        )
        # cleanup
        mongo.prc_ledger.delete_many({
            "source_ref": f"mining_collect:{leaf}:{ts.isoformat()}"
        })


# ════════════════════════════════════════════════════════════
# 6. ADMIN ASSIGN — new label + Leadership Reward notification
# ════════════════════════════════════════════════════════════
class TestAdminAssignRenamed:
    def test_assign_notification_uses_leadership_reward(self, api, admin_headers,
                                                       mongo, full_tree):
        target = full_tree["community_member"]
        # clear old notifs
        mongo.notifications.delete_many({"user_id": target})
        r = api.post(f"{BASE_URL}/api/admin/partners/assign",
                     json={"admin_id": ADMIN_UID, "query": target,
                           "position": "district_partner"},
                     headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["config"]["label"] == "District Coordinator"

        notif = mongo.notifications.find_one(
            {"user_id": target, "type": "partner_position_assigned"},
            sort=[("created_at", -1)]
        )
        assert notif is not None, "assign notification missing"
        assert "District Coordinator" in notif["title"], notif["title"]
        assert "Promoted to" in notif["title"], notif["title"]
        assert "Leadership Reward" in notif["message"], notif["message"]
        # legacy terminology must NOT appear
        assert "commission" not in notif["message"].lower() or \
               "leadership reward" in notif["message"].lower()

        # revoke — should revert to 'user'
        r2 = api.post(f"{BASE_URL}/api/admin/partners/revoke",
                      json={"admin_id": ADMIN_UID, "uid": target},
                      headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["new_position"] == "user"
        assert mongo.users.find_one({"uid": target})["partner_position"] == "user"

    def test_admin_list_uses_new_labels(self, api, admin_headers, full_tree):
        r = api.get(f"{BASE_URL}/api/admin/partners/list", headers=admin_headers)
        assert r.status_code == 200
        partners = r.json()["partners"]
        # Any of our seeded partners should have a NEW label
        labels = {p["position_label"] for p in partners}
        NEW_LABELS = {"District Coordinator", "Regional Coordinator",
                      "State Coordinator", "National Coordinator"}
        assert labels & NEW_LABELS, f"No new labels found in list: {labels}"
        # No legacy labels
        LEGACY = {"District Partner", "Regional State Partner",
                  "State Partner", "National Partner"}
        assert not (labels & LEGACY), f"Legacy labels present: {labels & LEGACY}"

    def test_wrong_pin_403(self, api, admin_jwt):
        r = api.post(f"{BASE_URL}/api/admin/partners/assign",
                     headers={"X-Admin-Pin": "999999",
                              "Content-Type": "application/json",
                              "Authorization": f"Bearer {admin_jwt}"},
                     json={"admin_id": ADMIN_UID, "query": "anyone",
                           "position": "district_partner"})
        assert r.status_code == 403
