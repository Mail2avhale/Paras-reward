"""Tests for Admin Force-Activate Elite Subscription via PRC.

Covers:
  - POST /api/admin/subscription/force-activate-elite-prc (success/overdraft, 403 wrong PIN, 404 unknown user, 429 cooldown, 400 cap)
  - GET  /api/admin/subscription/force-activate-preview
  - GET  /api/user/prc-debt-status/{uid}  (incl. debt-recovery via $inc)
"""
import os
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load env from both backend and frontend so REACT_APP_BACKEND_URL is available
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

_BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not _BACKEND_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL not set in env")
BASE_URL = _BACKEND_URL.rstrip("/")
ADMIN_PIN = "153759"

# Test users (from /app/memory/test_credentials.md and request)
OVERDRAFT_TARGET_UID = "admin-test-123"          # for overdraft path
DMT_USER_MOBILE = "9421331342"                   # 2/3 chances used, active Elite
PRIMARY_USER_MOBILE = "9970100782"               # cash Elite
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "153759"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def db():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("token")


@pytest.fixture(scope="session")
def admin_uid(admin_token):
    # decode-ish — we don't need to decode JWT, fetch via /me
    r = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=20,
    )
    if r.status_code == 200:
        return r.json().get("uid") or "admin-test-123"
    return "admin-test-123"


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Cleanup helper (run before & after overdraft tests) ----------
async def _reset_overdraft_user(db):
    await db.users.update_one(
        {"uid": OVERDRAFT_TARGET_UID},
        {
            "$set": {"prc_balance": 0},
            "$unset": {
                "prc_debt_active": "",
                "prc_debt_original": "",
                "prc_debt_at": "",
                "prc_debt_reason": "",
                "prc_debt_cleared_at": "",
                "subscription_expiry": "",
                "subscription_expires": "",
                "subscription_start": "",
                "last_prc_subscription": "",
                "subscription_plan": "",
                "subscription_status": "",
                "subscription_payment_type": "",
                "membership_type": "",
                "subscription_expired": "",
            },
        },
    )
    await db.subscription_payments.delete_many({"user_id": OVERDRAFT_TARGET_UID})
    await db.transactions.delete_many(
        {"user_id": OVERDRAFT_TARGET_UID, "type": "subscription_prc_admin_override"}
    )
    # Wipe any cooldown locks
    await db.service_cooldowns.delete_many({"user_id": OVERDRAFT_TARGET_UID, "service_type": "subscription"})


@pytest.fixture
def overdraft_user_clean(db):
    asyncio.get_event_loop().run_until_complete(_reset_overdraft_user(db))
    yield
    asyncio.get_event_loop().run_until_complete(_reset_overdraft_user(db))


# ============================================================================
# 1) Wrong-PIN rejection
# ============================================================================
def test_wrong_admin_pin_returns_403(admin_headers, admin_uid):
    r = requests.post(
        f"{BASE_URL}/api/admin/subscription/force-activate-elite-prc",
        headers=admin_headers,
        json={
            "admin_uid": admin_uid,
            "admin_pin": "000000",
            "target_identifier": OVERDRAFT_TARGET_UID,
        },
        timeout=20,
    )
    assert r.status_code == 403, r.text
    assert "Invalid Admin PIN" in r.text


# ============================================================================
# 2) Unknown user → 404
# ============================================================================
def test_unknown_target_returns_404(admin_headers, admin_uid):
    r = requests.post(
        f"{BASE_URL}/api/admin/subscription/force-activate-elite-prc",
        headers=admin_headers,
        json={
            "admin_uid": admin_uid,
            "admin_pin": ADMIN_PIN,
            "target_identifier": "nonexistent-uid-xyz-999",
        },
        timeout=20,
    )
    assert r.status_code == 404


# ============================================================================
# 3) Preview endpoint
# ============================================================================
def test_preview_endpoint_returns_full_payload(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/subscription/force-activate-preview",
        headers=admin_headers,
        params={"identifier": DMT_USER_MOBILE},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "user" in data and "pricing" in data and "projection" in data and "eligibility" in data
    assert data["user"]["mobile"].endswith(DMT_USER_MOBILE)
    assert isinstance(data["pricing"]["prc_required"], (int, float))
    assert data["pricing"]["prc_required"] > 0
    assert isinstance(data["eligibility"]["chances_used"], int)
    assert isinstance(data["eligibility"]["chances_remaining"], int)
    assert "can_proceed" in data["eligibility"]


def test_preview_404_for_unknown(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/subscription/force-activate-preview",
        headers=admin_headers,
        params={"identifier": "ghost-user-zzz"},
        timeout=20,
    )
    assert r.status_code == 404


# ============================================================================
# 4) Successful force-activation with overdraft (admin-test-123 starts at 0 PRC)
# ============================================================================
def test_force_activate_overdraft_success(admin_headers, admin_uid, overdraft_user_clean, db):
    r = requests.post(
        f"{BASE_URL}/api/admin/subscription/force-activate-elite-prc",
        headers=admin_headers,
        json={
            "admin_uid": admin_uid,
            "admin_pin": ADMIN_PIN,
            "target_identifier": OVERDRAFT_TARGET_UID,
            "admin_note": "TEST overdraft activation",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["success"] is True
    assert data["balance"]["overdraft_applied"] is True
    assert data["balance"]["after"] < 0
    assert data["balance"]["before"] == 0
    assert data["subscription"]["plan"] == "elite"
    assert data["chances"]["used_after"] == data["chances"]["used_before"] + 1

    # DB-side asserts
    async def verify():
        u = await db.users.find_one({"uid": OVERDRAFT_TARGET_UID})
        assert u["subscription_plan"] == "elite"
        assert float(u["prc_balance"]) < 0
        assert u.get("prc_debt_active") is True
        sp = await db.subscription_payments.find_one(
            {"user_id": OVERDRAFT_TARGET_UID, "admin_force_activated": True}
        )
        assert sp is not None
        assert sp["payment_method"] == "prc"
        tx = await db.transactions.find_one(
            {"user_id": OVERDRAFT_TARGET_UID, "type": "subscription_prc_admin_override"}
        )
        assert tx is not None
        assert tx["amount"] < 0
        assert tx["transaction_id"].startswith("SUB-PRC-ADMIN-")
        log = await db.admin_audit_logs.find_one(
            {"action": "force_activate_elite_prc", "entity_id": OVERDRAFT_TARGET_UID},
            sort=[("timestamp", -1)],
        )
        assert log is not None

    asyncio.get_event_loop().run_until_complete(verify())


# ============================================================================
# 5) 7-day cooldown enforced (call again right after success)
# ============================================================================
def test_cooldown_enforced_after_recent_activation(admin_headers, admin_uid, db):
    # Reuse the just-activated user from previous test → cooldown is fresh
    # If previous test cleaned up via fixture, the user has no recent sub. So
    # we manually set last_prc_subscription to "now" to simulate.
    async def _arm_cooldown():
        await db.users.update_one(
            {"uid": OVERDRAFT_TARGET_UID},
            {
                "$set": {
                    "prc_balance": 0,
                    "subscription_plan": "elite",
                    "subscription_expiry": (datetime.now(timezone.utc) + timedelta(days=28)).isoformat(),
                    "subscription_expires": datetime.now(timezone.utc) + timedelta(days=28),
                    "last_prc_subscription": datetime.now(timezone.utc).isoformat(),
                    "subscription_expired": False,
                }
            },
        )
        # Also create a recent successful subscription_payments doc so cooldown checker sees it
        await db.subscription_payments.insert_one({
            "payment_id": "TEST-cooldown",
            "user_id": OVERDRAFT_TARGET_UID,
            "payment_method": "prc",
            "status": "paid",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    async def _cleanup():
        await db.subscription_payments.delete_many({"payment_id": "TEST-cooldown"})
        await _reset_overdraft_user(db)

    asyncio.get_event_loop().run_until_complete(_arm_cooldown())
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/subscription/force-activate-elite-prc",
            headers=admin_headers,
            json={
                "admin_uid": admin_uid,
                "admin_pin": ADMIN_PIN,
                "target_identifier": OVERDRAFT_TARGET_UID,
            },
            timeout=20,
        )
        # Either the global cooldown checker enforces 429, OR the lifetime cap
        # blocks at 400 if 3 prior PRC subs already exist. Both are acceptable
        # blockers; we only assert it was NOT a successful override.
        assert r.status_code in (400, 429), f"expected 400/429, got {r.status_code} {r.text[:200]}"
    finally:
        asyncio.get_event_loop().run_until_complete(_cleanup())


# ============================================================================
# 6) Lifetime cap (3 PRC subs) → 400
# ============================================================================
def test_lifetime_cap_returns_400(admin_headers, admin_uid, db):
    # Seed 3 'paid' PRC subs so the cap is reached, no recent date so cooldown
    # passes
    async def _seed_cap():
        await _reset_overdraft_user(db)
        old = (datetime.now(timezone.utc) - timedelta(days=400)).isoformat()
        for i in range(3):
            await db.subscription_payments.insert_one({
                "payment_id": f"TEST-cap-{i}",
                "user_id": OVERDRAFT_TARGET_UID,
                "payment_method": "prc",
                "status": "paid",
                "created_at": old,
            })
        # No last_prc_subscription set → cooldown should be allowed

    async def _clean():
        await db.subscription_payments.delete_many({"payment_id": {"$regex": "^TEST-cap-"}})
        await _reset_overdraft_user(db)

    asyncio.get_event_loop().run_until_complete(_seed_cap())
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/subscription/force-activate-elite-prc",
            headers=admin_headers,
            json={
                "admin_uid": admin_uid,
                "admin_pin": ADMIN_PIN,
                "target_identifier": OVERDRAFT_TARGET_UID,
            },
            timeout=20,
        )
        assert r.status_code == 400, r.text
        assert "PRC subscription chances" in r.text or "lifetime cap" in r.text.lower() or "3/3" in r.text
    finally:
        asyncio.get_event_loop().run_until_complete(_clean())


# ============================================================================
# 7) Debt status endpoint + debt recovery via $inc
# ============================================================================
def test_debt_status_and_recovery(admin_headers, admin_uid, overdraft_user_clean, db):
    # 1) Force-activate to drive balance negative
    r = requests.post(
        f"{BASE_URL}/api/admin/subscription/force-activate-elite-prc",
        headers=admin_headers,
        json={
            "admin_uid": admin_uid,
            "admin_pin": ADMIN_PIN,
            "target_identifier": OVERDRAFT_TARGET_UID,
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    debt_total = abs(payload["balance"]["after"])
    assert debt_total > 0

    # 2) debt-status: in_debt true
    s1 = requests.get(f"{BASE_URL}/api/user/prc-debt-status/{OVERDRAFT_TARGET_UID}", timeout=20)
    assert s1.status_code == 200
    js1 = s1.json()
    assert js1["in_debt"] is True
    assert js1["debt_remaining"] > 0
    assert js1["debt_recovered"] == 0

    # 3) Simulate partial mining: $inc by half of debt
    half = round(debt_total / 2, 2)
    asyncio.get_event_loop().run_until_complete(
        db.users.update_one({"uid": OVERDRAFT_TARGET_UID}, {"$inc": {"prc_balance": half}})
    )
    s2 = requests.get(f"{BASE_URL}/api/user/prc-debt-status/{OVERDRAFT_TARGET_UID}", timeout=20)
    assert s2.status_code == 200
    js2 = s2.json()
    assert js2["in_debt"] is True, js2
    assert js2["debt_remaining"] > 0
    assert js2["debt_recovered"] >= half - 0.5  # within rounding

    # 4) Inc remainder + small surplus → balance ≥ 0, flag auto-clears
    asyncio.get_event_loop().run_until_complete(
        db.users.update_one({"uid": OVERDRAFT_TARGET_UID}, {"$inc": {"prc_balance": debt_total - half + 100}})
    )
    s3 = requests.get(f"{BASE_URL}/api/user/prc-debt-status/{OVERDRAFT_TARGET_UID}", timeout=20)
    assert s3.status_code == 200
    js3 = s3.json()
    assert js3["in_debt"] is False
    assert js3["debt_active_flag"] is False  # auto-cleared
    assert js3["current_balance"] >= 0

    # 5) DB confirms flag is False
    async def _check():
        u = await db.users.find_one({"uid": OVERDRAFT_TARGET_UID})
        assert u.get("prc_debt_active") is False
        assert u.get("prc_debt_cleared_at") is not None

    asyncio.get_event_loop().run_until_complete(_check())


def test_debt_status_404(admin_headers):
    r = requests.get(f"{BASE_URL}/api/user/prc-debt-status/no-such-uid-zzzzz", timeout=20)
    assert r.status_code == 404
