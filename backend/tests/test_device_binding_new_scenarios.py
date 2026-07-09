"""
Device Binding — additional E2E scenarios NOT already covered by
test_device_binding_e2e.py.

Focus:
  1. Self-service OTP unbind loop (request → verify).
  2. Login enforcement: user carrying device_binding_locked=True → 403.
  3. Signup enforcement: /api/auth/register/simple flag=ON with an
     already-bound native device_id → 403; flag=OFF → 200.
  4. Admin unbind by uid (not device_id).
  5. GET /my-bindings/{uid} after a real binding write.
  6. GET /admin/device-binding/collisions returns audit rows.

Namespaced with uid prefix "DBTEST-" and device_id prefix
"AND-DBTEST-" for safe cleanup.
"""

import os
import sys
import time
import uuid
import bcrypt
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient


_BACKEND_DIR = "/app/backend"
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


def _load_env():
    env = Path("/app/backend/.env")
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_env()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
def _load_frontend_env():
    env = Path("/app/frontend/.env")
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_frontend_env()
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_PIN = os.environ["ADMIN_OPERATION_PIN"]
ADMIN_UID = "admin-test-123"


# ── Fixtures ────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": "admin@test.com", "password": "153759"},
        timeout=30,
    )
    r.raise_for_status()
    d = r.json()
    tok = d.get("access_token") or d.get("token")
    assert tok, f"admin login returned no token: {d}"
    return tok


@pytest.fixture(scope="module")
def h(admin_token):
    return {
        "X-Admin-Pin": ADMIN_PIN,
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }


def _set_flag(h, enabled: bool):
    """Toggle the enforcement flag via API and wait for cache clear."""
    r = requests.post(
        f"{BASE_URL}/api/admin/device-binding/flag",
        headers=h,
        json={"admin_id": ADMIN_UID, "enabled": enabled},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _cleanup(mongo):
    mongo.device_bindings.delete_many({"device_id": {"$regex": "^AND-DBTEST-"}})
    mongo.device_binding_collisions.delete_many({"device_id": {"$regex": "^AND-DBTEST-"}})
    mongo.device_unbind_otps.delete_many({"user_uid": {"$regex": "^DBTEST-"}})
    mongo.users.delete_many({"uid": {"$regex": "^DBTEST-"}})
    mongo.users.delete_many({"mobile": {"$regex": "^99998"}})
    mongo.users.delete_many({"email": {"$regex": "^dbtest_"}})


@pytest.fixture(scope="module", autouse=True)
def _global_cleanup(mongo, h):
    _cleanup(mongo)
    yield
    # Ensure flag OFF at end
    _set_flag(h, False)
    _cleanup(mongo)


# ── 1. OTP self-service unbind ─────────────────────────────────────────
class TestOtpUnbind:
    def test_full_otp_unbind_flow(self, mongo):
        uid = "DBTEST-otp-" + uuid.uuid4().hex[:8]
        did = "AND-DBTEST-otp-" + uuid.uuid4().hex[:8]
        mobile = "9999801" + str(int(time.time() * 1000))[-3:]
        email = f"dbtest_otp_{uuid.uuid4().hex[:6]}@t.local"

        # Seed user + active binding
        mongo.users.insert_one({
            "uid": uid, "mobile": mobile, "email": email,
            "name": "OTP User", "referral_code": "DBTOTP1",
            "is_active": True,
        })
        mongo.device_bindings.insert_one({
            "binding_id": str(uuid.uuid4()),
            "device_id": did, "user_uid": uid,
            "active": True,
            "bound_at": "2026-01-01T00:00:00Z",
        })

        # Request OTP
        r = requests.post(
            f"{BASE_URL}/api/device-binding/unbind/request-otp",
            json={"identifier": mobile, "device_id": did},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert "otp_hint" in d

        # OTP is stored in db.device_unbind_otps — read it
        otp_doc = mongo.device_unbind_otps.find_one({"user_uid": uid, "device_id": did})
        assert otp_doc is not None
        otp = otp_doc["otp"]
        assert len(otp) == 6

        # Wrong OTP → 400 + attempts increments
        r_wrong = requests.post(
            f"{BASE_URL}/api/device-binding/unbind/verify-otp",
            json={"identifier": mobile, "device_id": did, "otp": "000000"},
        )
        assert r_wrong.status_code == 400
        otp_doc2 = mongo.device_unbind_otps.find_one({"user_uid": uid, "device_id": did})
        assert otp_doc2["attempts"] == 1

        # Correct OTP → success
        r_ok = requests.post(
            f"{BASE_URL}/api/device-binding/unbind/verify-otp",
            json={"identifier": mobile, "device_id": did, "otp": otp},
        )
        assert r_ok.status_code == 200, r_ok.text
        assert r_ok.json()["success"] is True

        # Binding is now inactive
        row = mongo.device_bindings.find_one({"device_id": did, "user_uid": uid})
        assert row["active"] is False
        assert row.get("unbound_reason") == "self_service_otp"

        # OTP doc is gone
        assert mongo.device_unbind_otps.find_one({"user_uid": uid, "device_id": did}) is None

    def test_unknown_identifier_404(self):
        r = requests.post(
            f"{BASE_URL}/api/device-binding/unbind/request-otp",
            json={"identifier": "NO_SUCH_USER_9999", "device_id": "AND-DBTEST-x"},
        )
        assert r.status_code == 404

    def test_device_not_bound_to_user_403(self, mongo):
        # User A owns the binding, User B tries to unbind → 403
        did = "AND-DBTEST-forbid-" + uuid.uuid4().hex[:6]
        uidA = "DBTEST-A-" + uuid.uuid4().hex[:6]
        uidB = "DBTEST-B-" + uuid.uuid4().hex[:6]
        mobileB = "9999811" + str(int(time.time() * 1000))[-3:]
        mongo.users.insert_many([
            {"uid": uidA, "mobile": "9999811001",
             "email": f"dbtest_a_{uuid.uuid4().hex[:6]}@t.local",
             "referral_code": "DBTA1"},
            {"uid": uidB, "mobile": mobileB,
             "email": f"dbtest_b_{uuid.uuid4().hex[:6]}@t.local",
             "referral_code": "DBTB1"},
        ])
        mongo.device_bindings.insert_one({
            "binding_id": str(uuid.uuid4()),
            "device_id": did, "user_uid": uidA, "active": True,
            "bound_at": "2026-01-01T00:00:00Z",
        })
        r = requests.post(
            f"{BASE_URL}/api/device-binding/unbind/request-otp",
            json={"identifier": mobileB, "device_id": did},
        )
        assert r.status_code == 403


# ── 2. Login enforcement: device_binding_locked ────────────────────────
class TestLoginLockedUser:
    def test_locked_user_gets_403(self, mongo):
        # Seed a real user with a hashed PIN + device_binding_locked=True
        uid = "DBTEST-locked-" + uuid.uuid4().hex[:8]
        mobile = "9999820" + str(int(time.time() * 1000))[-3:]
        pin = "654321"
        pin_hash = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
        mongo.users.insert_one({
            "uid": uid,
            "mobile": mobile,
            "email": f"dbtest_locked_{uuid.uuid4().hex[:6]}@t.local",
            "name": "Locked User",
            "referral_code": "DBTLK1",
            "pin_hash": pin_hash,
            "password_hash": pin_hash,
            "pin_migrated": True,
            "is_active": True,
            "is_banned": False,
            "device_binding_locked": True,
        })

        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": mobile, "password": pin},
        )
        assert r.status_code == 403, r.text
        detail = r.json().get("detail", "")
        assert "locked" in detail.lower() or "another account" in detail.lower()


# ── 3. Signup enforcement (flag ON vs OFF) ─────────────────────────────
class TestSignupEnforcement:
    def _mk_payload(self, mobile, device_id, email=None):
        return {
            "full_name": "DB Test User",
            "mobile": mobile,
            "email": email or f"dbtest_signup_{uuid.uuid4().hex[:6]}@t.local",
            "password": "918273",
            "device_id": device_id,
            "device_model": "Pixel 7",
            "os_version": "Android 14",
        }

    def test_signup_blocked_when_flag_on_and_device_taken(self, mongo, h):
        did = "AND-DBTEST-signup-" + uuid.uuid4().hex[:8]
        # Seed an existing active binding on `did`
        existing_uid = "DBTEST-existing-" + uuid.uuid4().hex[:6]
        mongo.device_bindings.insert_one({
            "binding_id": str(uuid.uuid4()),
            "device_id": did, "user_uid": existing_uid, "active": True,
            "bound_at": "2026-01-01T00:00:00Z",
        })
        mongo.users.insert_one({
            "uid": existing_uid, "mobile": "9999830001",
            "email": f"dbtest_owner_{uuid.uuid4().hex[:6]}@t.local",
            "referral_code": "DBTOWN1",
        })

        _set_flag(h, True)
        try:
            mobile = "9999831" + str(int(time.time() * 1000))[-3:]
            r = requests.post(
                f"{BASE_URL}/api/auth/register/simple",
                json=self._mk_payload(mobile, did),
            )
            assert r.status_code == 403, r.text
            detail = r.json().get("detail", "")
            assert "already registered" in detail.lower() or "one account per device" in detail.lower()
        finally:
            _set_flag(h, False)

    def test_signup_allowed_when_flag_off_even_if_device_taken(self, mongo, h):
        did = "AND-DBTEST-soft-" + uuid.uuid4().hex[:8]
        existing_uid = "DBTEST-owner2-" + uuid.uuid4().hex[:6]
        mongo.device_bindings.insert_one({
            "binding_id": str(uuid.uuid4()),
            "device_id": did, "user_uid": existing_uid, "active": True,
            "bound_at": "2026-01-01T00:00:00Z",
        })
        mongo.users.insert_one({
            "uid": existing_uid, "mobile": "9999840001",
            "email": f"dbtest_owner2_{uuid.uuid4().hex[:6]}@t.local",
            "referral_code": "DBTOWN2",
        })

        _set_flag(h, False)
        mobile = "9999841" + str(int(time.time() * 1000))[-3:]
        r = requests.post(
            f"{BASE_URL}/api/auth/register/simple",
            json=self._mk_payload(mobile, did),
        )
        # Flag OFF → audit-only, signup should succeed
        assert r.status_code == 200, r.text
        # Cleanup created user
        mongo.users.delete_many({"mobile": mobile})


# ── 4. Admin unbind by UID ──────────────────────────────────────────────
class TestAdminUnbindByUid:
    def test_unbind_by_uid_marks_inactive(self, mongo, h):
        uid = "DBTEST-au-" + uuid.uuid4().hex[:8]
        did = "AND-DBTEST-au-" + uuid.uuid4().hex[:8]
        mongo.users.insert_one({
            "uid": uid, "mobile": "9999850001",
            "email": f"dbtest_au_{uuid.uuid4().hex[:6]}@t.local",
            "referral_code": "DBTAU1",
            "primary_device_id": did,
            "device_binding_locked": True,
        })
        mongo.device_bindings.insert_one({
            "binding_id": str(uuid.uuid4()),
            "device_id": did, "user_uid": uid, "active": True,
            "bound_at": "2026-01-01T00:00:00Z",
        })

        r = requests.post(
            f"{BASE_URL}/api/admin/device-binding/unbind",
            headers=h,
            json={"admin_id": ADMIN_UID, "uid": uid, "reason": "test_unbind_by_uid"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["unbound"]["user_uid"] == uid

        # Binding is inactive
        row = mongo.device_bindings.find_one({"device_id": did, "user_uid": uid})
        assert row["active"] is False
        # User flags cleared
        user = mongo.users.find_one({"uid": uid}, {"_id": 0})
        assert "device_binding_locked" not in user
        assert "primary_device_id" not in user


# ── 5. GET /my-bindings/{uid} after a real bind ────────────────────────
class TestMyBindingsWithData:
    def test_lists_active_binding(self, mongo):
        uid = "DBTEST-my-" + uuid.uuid4().hex[:8]
        did = "AND-DBTEST-my-" + uuid.uuid4().hex[:8]
        mongo.device_bindings.insert_one({
            "binding_id": str(uuid.uuid4()),
            "device_id": did, "user_uid": uid, "active": True,
            "device_model": "Pixel 8",
            "os_version": "Android 14",
            "bound_at": "2026-01-01T00:00:00Z",
            "last_seen_at": "2026-01-02T00:00:00Z",
            "login_count": 3,
        })

        r = requests.get(f"{BASE_URL}/api/device-binding/my-bindings/{uid}")
        assert r.status_code == 200
        d = r.json()
        assert d["has_active_binding"] is True
        assert len(d["active_bindings"]) == 1
        assert d["active_bindings"][0]["device_id"] == did
        assert d["active_bindings"][0]["device_model"] == "Pixel 8"


# ── 6. GET /admin/device-binding/collisions ─────────────────────────────
class TestCollisionsEndpoint:
    def test_collisions_lists_audit_rows(self, mongo, h):
        did = "AND-DBTEST-coll-" + uuid.uuid4().hex[:8]
        mongo.device_binding_collisions.insert_one({
            "collision_id": str(uuid.uuid4()),
            "device_id": did,
            "attempted_uid": "DBTEST-attempt",
            "bound_uid": "DBTEST-owner",
            "event": "login",
            "enforcement_on": False,
            "occurred_at": "2026-01-01T00:00:00Z",
        })
        r = requests.get(
            f"{BASE_URL}/api/admin/device-binding/collisions?limit=100",
            headers=h,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["count"] >= 1
        matches = [c for c in d["collisions"] if c.get("device_id") == did]
        assert len(matches) == 1
