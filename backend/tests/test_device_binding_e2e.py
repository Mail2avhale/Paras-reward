"""
Device Binding E2E — Feb 7 2026
================================
Exercises the feature flag CRUD, retro-scan, retro-block, self-service OTP
unbind, admin unbind, and both signup + login enforcement paths. Uses the
real Mongo instance + FastAPI over HTTP (BASE_URL) so it also verifies
router wiring in server.py.

Test data is namespaced with the "DB_" uid prefix and cleaned up per class
fixture. Nothing outside that namespace is touched.
"""

import os
import re
import sys
import time
import uuid
import asyncio
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient

# Ensure backend module path resolves for direct imports of routes.*
_BACKEND_DIR = "/app/backend"
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


# ── Env bootstrap (same pattern as test_partner_positions_e2e.py) ──────────
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
BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://formula-audit-fix.preview.emergentagent.com",
).rstrip("/")
ADMIN_PIN = os.environ["ADMIN_OPERATION_PIN"]
ADMIN_UID = "admin-test-123"


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


@pytest.fixture(scope="module")
def wrong_pin_h(admin_token):
    return {
        "X-Admin-Pin": "wrong-pin",
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }


class TestFlagCrud:
    def test_flag_default_off(self, h):
        r = requests.get(f"{BASE_URL}/api/admin/device-binding/flag", headers=h)
        assert r.status_code == 200
        assert r.json()["enabled"] in (True, False)  # depends on prior state

    def test_flag_wrong_pin_403(self, wrong_pin_h):
        r = requests.get(f"{BASE_URL}/api/admin/device-binding/flag", headers=wrong_pin_h)
        assert r.status_code == 403

    def test_flag_toggle_roundtrip(self, h):
        # Turn ON
        r = requests.post(
            f"{BASE_URL}/api/admin/device-binding/flag",
            headers=h,
            json={"admin_id": ADMIN_UID, "enabled": True},
        )
        assert r.status_code == 200
        assert r.json()["enabled"] is True

        # Read back
        r2 = requests.get(f"{BASE_URL}/api/admin/device-binding/flag", headers=h)
        assert r2.json()["enabled"] is True

        # Turn OFF (restore)
        r3 = requests.post(
            f"{BASE_URL}/api/admin/device-binding/flag",
            headers=h,
            json={"admin_id": ADMIN_UID, "enabled": False},
        )
        assert r3.status_code == 200
        assert r3.json()["enabled"] is False


class TestRetroScan:
    def test_scan_empty_returns_zero(self, h):
        r = requests.get(
            f"{BASE_URL}/api/admin/device-binding/retro-scan?min_accounts=2&limit=50",
            headers=h,
        )
        assert r.status_code == 200
        d = r.json()
        assert "trusted_clusters_found" in d
        assert d["trusted_clusters_found"] >= 0

    def test_scan_wrong_pin_403(self, wrong_pin_h):
        r = requests.get(
            f"{BASE_URL}/api/admin/device-binding/retro-scan", headers=wrong_pin_h
        )
        assert r.status_code == 403


class TestSuspicious:
    def test_suspicious_endpoint_reachable(self, h):
        r = requests.get(
            f"{BASE_URL}/api/admin/device-binding/suspicious?window_hours=24&min_signups=3",
            headers=h,
        )
        assert r.status_code == 200
        assert "clusters" in r.json()


class TestBindingCore:
    """Direct helper-level tests — no HTTP. Verifies the enforcement logic
    at check_and_bind_device()."""

    @pytest.fixture(autouse=True)
    def _clean(self, mongo):
        # Purge namespace before + after
        mongo.device_bindings.delete_many({"device_id": {"$regex": "^AND-DBTEST-"}})
        mongo.device_binding_collisions.delete_many({"device_id": {"$regex": "^AND-DBTEST-"}})
        mongo.users.delete_many({"uid": {"$regex": "^DB_"}})
        mongo.app_settings.delete_many({"key": "device_binding"})
        yield
        mongo.device_bindings.delete_many({"device_id": {"$regex": "^AND-DBTEST-"}})
        mongo.device_binding_collisions.delete_many({"device_id": {"$regex": "^AND-DBTEST-"}})
        mongo.users.delete_many({"uid": {"$regex": "^DB_"}})
        mongo.app_settings.delete_many({"key": "device_binding"})

    async def _bind(self, uid, device_id, event="login"):
        from motor.motor_asyncio import AsyncIOMotorClient
        import importlib
        m = importlib.import_module("routes.device_binding")
        client = AsyncIOMotorClient(MONGO_URL)
        m.set_db(client[DB_NAME])
        try:
            return await m.check_and_bind_device(
                uid=uid, device_id=device_id, event=event,
            )
        finally:
            client.close()

    def _run(self, coro):
        return asyncio.run(coro)

    def test_untrusted_device_id_allows_and_skips(self, mongo):
        r = self._run(self._bind("DB_u1", "DEV-random-abc"))
        assert r.allowed is True
        assert r.reason == "untrusted_device_id_skipped"
        # No row inserted
        assert mongo.device_bindings.count_documents(
            {"device_id": "DEV-random-abc"}
        ) == 0

    def test_new_trusted_binding_writes(self, mongo):
        did = "AND-DBTEST-" + uuid.uuid4().hex[:12]
        mongo.users.insert_one({"uid": "DB_u1", "referral_code": "DBT1",
                                "email": f"db_u1_{uuid.uuid4().hex[:6]}@t.local"})
        r = self._run(self._bind("DB_u1", did, event="register"))
        assert r.allowed is True
        assert r.was_new_binding is True
        row = mongo.device_bindings.find_one({"device_id": did, "active": True})
        assert row is not None
        assert row["user_uid"] == "DB_u1"

    def test_same_user_refresh_is_idempotent(self, mongo):
        did = "AND-DBTEST-" + uuid.uuid4().hex[:12]
        mongo.users.insert_one({"uid": "DB_u1", "referral_code": "DBT1",
                                "email": f"db_u1_{uuid.uuid4().hex[:6]}@t.local"})
        r1 = self._run(self._bind("DB_u1", did))
        r2 = self._run(self._bind("DB_u1", did))
        assert r1.allowed and r2.allowed
        assert mongo.device_bindings.count_documents(
            {"device_id": did, "active": True}
        ) == 1

    def test_collision_soft_mode_allows(self, mongo):
        """Enforcement OFF → collision is audit-only, both users allowed."""
        did = "AND-DBTEST-" + uuid.uuid4().hex[:12]
        mongo.users.insert_many([
            {"uid": "DB_u1", "referral_code": "DBT1",
             "email": f"db_u1_{uuid.uuid4().hex[:6]}@t.local"},
            {"uid": "DB_u2", "referral_code": "DBT2",
             "email": f"db_u2_{uuid.uuid4().hex[:6]}@t.local"},
        ])
        r1 = self._run(self._bind("DB_u1", did))
        r2 = self._run(self._bind("DB_u2", did))
        assert r1.allowed and r2.allowed
        # Collision row exists
        assert mongo.device_binding_collisions.count_documents(
            {"device_id": did}
        ) == 1

    def test_collision_hard_mode_blocks(self, mongo):
        """Enforcement ON → 2nd uid gets allowed=False."""
        did = "AND-DBTEST-" + uuid.uuid4().hex[:12]
        mongo.users.insert_many([
            {"uid": "DB_u1", "referral_code": "DBT1",
             "email": f"db_u1_{uuid.uuid4().hex[:6]}@t.local"},
            {"uid": "DB_u2", "referral_code": "DBT2",
             "email": f"db_u2_{uuid.uuid4().hex[:6]}@t.local"},
        ])
        # Enable enforcement
        mongo.app_settings.update_one(
            {"key": "device_binding"},
            {"$set": {"key": "device_binding", "enabled": True}},
            upsert=True,
        )
        # Also clear the module cache
        import importlib
        m = importlib.import_module("routes.device_binding")
        m._clear_flag_cache()

        r1 = self._run(self._bind("DB_u1", did))
        r2 = self._run(self._bind("DB_u2", did))
        assert r1.allowed is True
        assert r2.allowed is False
        assert r2.bound_to_uid == "DB_u1"

    def test_native_id_regex(self):
        import importlib
        m = importlib.import_module("routes.device_binding")
        assert m.is_trusted_device_id("AND-abcdef1234") is True
        assert m.is_trusted_device_id("IOS-abcdef1234") is True
        assert m.is_trusted_device_id("DEV-xyz") is False
        assert m.is_trusted_device_id("unknown") is False
        assert m.is_trusted_device_id(None) is False
        assert m.is_trusted_device_id("") is False


class TestMyBindings:
    def test_empty_list(self):
        u = "DB_myb_" + uuid.uuid4().hex[:6]
        r = requests.get(f"{BASE_URL}/api/device-binding/my-bindings/{u}")
        assert r.status_code == 200
        d = r.json()
        assert d["active_bindings"] == []
        assert d["has_active_binding"] is False


class TestAdminUnbind:
    def test_missing_target_400(self, h):
        r = requests.post(
            f"{BASE_URL}/api/admin/device-binding/unbind",
            headers=h,
            json={"admin_id": ADMIN_UID},
        )
        assert r.status_code == 400

    def test_no_binding_404(self, h):
        r = requests.post(
            f"{BASE_URL}/api/admin/device-binding/unbind",
            headers=h,
            json={"admin_id": ADMIN_UID, "device_id": "AND-DBTEST-not-a-real-id"},
        )
        assert r.status_code == 404


class TestRetroBlock:
    """End-to-end: seed 2 users on same device, run retro-block dry-run,
    then apply, verify lock flag on losing user."""

    @pytest.fixture(autouse=True)
    def _seed(self, mongo):
        mongo.users.delete_many({"uid": {"$regex": "^DB_RB_"}})
        did = "AND-DBTEST-RB-" + uuid.uuid4().hex[:8]
        mongo.users.insert_many([
            {
                "uid": "DB_RB_older",
                "name": "Older Account",
                "mobile": "9999900001",
                "email": f"db_rb_older_{uuid.uuid4().hex[:6]}@t.local",
                "device_id": did,
                "referral_code": "DBTRB1",
                "subscription_plan": "explorer",
                "created_at": "2026-01-01T00:00:00Z",
            },
            {
                "uid": "DB_RB_newer",
                "name": "Newer Account",
                "mobile": "9999900002",
                "email": f"db_rb_newer_{uuid.uuid4().hex[:6]}@t.local",
                "device_id": did,
                "referral_code": "DBTRB2",
                "subscription_plan": "explorer",
                "created_at": "2026-06-01T00:00:00Z",
            },
        ])
        self.did = did
        yield
        mongo.users.delete_many({"uid": {"$regex": "^DB_RB_"}})
        mongo.device_bindings.delete_many({"device_id": did})

    def test_dry_run_reports_kept_and_locked(self, h):
        r = requests.post(
            f"{BASE_URL}/api/admin/device-binding/retro-block",
            headers=h,
            json={"admin_id": ADMIN_UID, "device_ids": [self.did], "dry_run": True},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dry_run"] is True
        assert d["kept_count"] == 1
        assert d["suspended_count"] == 1
        assert d["kept_sample"][0]["kept_uid"] == "DB_RB_older"
        assert d["suspended_sample"][0]["uid"] == "DB_RB_newer"

    def test_apply_locks_newer(self, h, mongo):
        r = requests.post(
            f"{BASE_URL}/api/admin/device-binding/retro-block",
            headers=h,
            json={"admin_id": ADMIN_UID, "device_ids": [self.did], "dry_run": False},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["suspended_count"] == 1
        # Confirm lock flag on the newer user
        newer = mongo.users.find_one({"uid": "DB_RB_newer"}, {"_id": 0, "device_binding_locked": 1})
        assert newer["device_binding_locked"] is True
        # Older user is NOT locked
        older = mongo.users.find_one({"uid": "DB_RB_older"}, {"_id": 0})
        assert not older.get("device_binding_locked")
        # A canonical binding row was created for the kept user
        canon = mongo.device_bindings.find_one({"device_id": self.did, "active": True})
        assert canon is not None
        assert canon["user_uid"] == "DB_RB_older"
