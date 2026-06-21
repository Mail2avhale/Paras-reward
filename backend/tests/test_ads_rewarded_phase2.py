"""Backend tests for Phase 2: Rewarded Ad endpoints + app version-info.

Covers:
  - POST /api/ads/rewarded/start
  - POST /api/ads/rewarded/credit (success + replay/409 + invalid-token/404)
  - GET  /api/ads/rewarded/quota
  - prc_ledger entry + user prc_balance increment
  - Daily-limit boundary at exactly 10
  - GET /api/app/version-info → 1.0.5 / code 6
"""
import os
import uuid
from datetime import datetime, timezone
import pymongo
import pytest
import requests
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

USER_MOBILE = "9970100782"
USER_PIN = "997010"
USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"

_env = dotenv_values("/app/backend/.env")
_mc = pymongo.MongoClient(_env["MONGO_URL"])
db = _mc[_env["DB_NAME"]]


# ── Fixtures ──────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def auth_token():
    """Login the primary test user and return JWT."""
    r = requests.post(f"{API}/auth/login", json={"identifier": USER_MOBILE, "pin": USER_PIN}, timeout=20)
    if r.status_code != 200:
        # fallback alt payload shapes
        r = requests.post(f"{API}/auth/login", json={"mobile": USER_MOBILE, "pin": USER_PIN}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in response: {data}"
    return token


@pytest.fixture(scope="module")
def hdrs(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def reset_state():
    """Clean today's quota + leftover tokens before & after the module."""
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    db.ad_rewards_daily.delete_many({"uid": USER_UID, "day": day})
    db.ad_view_tokens.delete_many({"uid": USER_UID})
    # Snapshot starting balance so we can restore later
    u = db.users.find_one({"uid": USER_UID}, {"prc_balance": 1})
    start_balance = (u or {}).get("prc_balance", 0)
    yield
    # Restore balance & cleanup
    db.users.update_one({"uid": USER_UID}, {"$set": {"prc_balance": start_balance}})
    db.ad_rewards_daily.delete_many({"uid": USER_UID, "day": day})
    db.ad_view_tokens.delete_many({"uid": USER_UID})
    db.prc_ledger.delete_many({"uid": USER_UID, "type": "ad_reward", "category": "rewarded_ad"})


# ── 1. Version Info ──────────────────────────────────────────────────────
def test_version_info_is_1_0_5_code_6():
    r = requests.get(f"{API}/app/version-info", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["latest_version_name"] == "1.0.5", d
    assert int(d["latest_version_code"]) == 6, d
    assert "com.parasreward.prc" in d["play_store_url"], d


# ── 2. Quota baseline (after reset) ──────────────────────────────────────
def test_quota_baseline_zero(hdrs):
    r = requests.get(f"{API}/ads/rewarded/quota", headers=hdrs, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["used"] == 0
    assert d["max"] == 10
    assert d["reward_per_ad"] == 0.5
    assert d["remaining"] == 10


# ── 3. Start → Credit happy path ─────────────────────────────────────────
def test_start_returns_view_token_and_ad_unit(hdrs):
    r = requests.post(f"{API}/ads/rewarded/start", headers=hdrs, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["allowed"] is True
    # uuid sanity
    uuid.UUID(d["view_token"])
    assert d["ad_unit_id"].startswith("ca-app-pub-3556805218952480/7314369451")
    assert d["remaining"] == 10
    pytest.shared_token = d["view_token"]


def test_credit_success_and_ledger_and_balance(hdrs):
    token = pytest.shared_token
    # Snapshot balance pre-credit
    pre = (db.users.find_one({"uid": USER_UID}, {"prc_balance": 1}) or {}).get("prc_balance", 0)

    r = requests.post(f"{API}/ads/rewarded/credit", headers=hdrs,
                      json={"view_token": token}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["success"] is True
    assert d["credited"] == 0.5
    assert d["remaining_today"] == 9

    # Ledger entry
    led = db.prc_ledger.find_one({
        "uid": USER_UID, "type": "ad_reward", "category": "rewarded_ad",
        "metadata.view_token": token,
    })
    assert led is not None, "no ledger entry found"
    assert led["amount"] == 0.5

    # Balance incremented exactly by 0.5
    post = (db.users.find_one({"uid": USER_UID}, {"prc_balance": 1}) or {}).get("prc_balance", 0)
    assert round(post - pre, 4) == 0.5, f"balance diff = {post - pre}"


def test_quota_after_one_credit(hdrs):
    r = requests.get(f"{API}/ads/rewarded/quota", headers=hdrs, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["used"] == 1
    assert d["remaining"] == 9


# ── 4. Replay protection ─────────────────────────────────────────────────
def test_credit_replay_returns_409(hdrs):
    token = pytest.shared_token
    r = requests.post(f"{API}/ads/rewarded/credit", headers=hdrs,
                      json={"view_token": token}, timeout=15)
    assert r.status_code == 409, r.text


# ── 5. Invalid token ─────────────────────────────────────────────────────
def test_credit_invalid_token_returns_404(hdrs):
    r = requests.post(f"{API}/ads/rewarded/credit", headers=hdrs,
                      json={"view_token": str(uuid.uuid4())}, timeout=15)
    assert r.status_code == 404, r.text


# ── 6. Daily limit boundary ──────────────────────────────────────────────
def test_daily_limit_blocks_11th_start(hdrs):
    """Force-set used=10 for today and confirm /start returns allowed:false."""
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    db.ad_rewards_daily.update_one(
        {"uid": USER_UID, "day": day},
        {"$set": {"used": 10, "credited_prc": 5.0,
                  "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    # Quota first
    rq = requests.get(f"{API}/ads/rewarded/quota", headers=hdrs, timeout=15)
    assert rq.status_code == 200
    assert rq.json()["used"] == 10
    assert rq.json()["remaining"] == 0

    # Start should be blocked
    r = requests.post(f"{API}/ads/rewarded/start", headers=hdrs, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["allowed"] is False
    assert "Daily limit" in (d.get("reason") or "")
    assert d["remaining"] == 0


# ── 7. Auth gating ───────────────────────────────────────────────────────
def test_endpoints_require_auth():
    r1 = requests.get(f"{API}/ads/rewarded/quota", timeout=10)
    r2 = requests.post(f"{API}/ads/rewarded/start", timeout=10)
    r3 = requests.post(f"{API}/ads/rewarded/credit",
                       json={"view_token": str(uuid.uuid4())}, timeout=10)
    for r in (r1, r2, r3):
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"
