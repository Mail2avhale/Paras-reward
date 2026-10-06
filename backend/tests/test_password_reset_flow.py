"""Backend tests for Emergent-managed password reset flow (Sep 17 2026).

Flow under test:
  POST /api/auth/forgot-password?email=        -> generic message, stores reset_token
  POST /api/auth/reset-password-request?email= -> duplicate email flow
  POST /api/auth/reset-password?reset_token=&new_password= -> consumes token

Uses admin@test.com and restores original PIN (153759) at teardown.
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def mongo_db():
    # Resolve DB name from backend env
    db_name = DB_NAME
    try:
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("DB_NAME"):
                    db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    except Exception:
        pass
    client = MongoClient(MONGO_URL)
    yield client[db_name]
    client.close()


@pytest.fixture(scope="module", autouse=True)
def restore_admin_pin(mongo_db):
    """After all tests run, force-restore admin PIN to 153759."""
    yield
    # Teardown: request a reset token, then set password back to 153759
    r = requests.post(f"{API}/auth/forgot-password", params={"email": ADMIN_EMAIL}, timeout=15)
    if r.status_code == 200:
        doc = mongo_db.users.find_one({"email": ADMIN_EMAIL})
        tok = doc.get("reset_token") if doc else None
        if tok:
            requests.post(f"{API}/auth/reset-password",
                          params={"reset_token": tok, "new_password": ADMIN_PIN},
                          timeout=15)


class TestForgotPassword:
    def test_unknown_email_returns_generic_message(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          params={"email": "nonexistent_TEST_xyz@example.com"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "message" in data
        assert "reset" in data["message"].lower()
        # anti-enumeration: no token exposed
        assert "reset_token" not in data

    def test_existing_user_stores_reset_token(self, mongo_db):
        # Clear any pre-existing token so we definitely see a fresh one
        mongo_db.users.update_one({"email": ADMIN_EMAIL},
                                  {"$unset": {"reset_token": "", "reset_token_expiry": ""}})
        r = requests.post(f"{API}/auth/forgot-password",
                          params={"email": ADMIN_EMAIL}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reset" in data["message"].lower()
        # DB side-effect: reset_token + expiry must be set
        doc = mongo_db.users.find_one({"email": ADMIN_EMAIL})
        assert doc is not None, "admin@test.com user missing"
        assert doc.get("reset_token"), "reset_token not stored in DB"
        assert doc.get("reset_token_expiry"), "reset_token_expiry not stored"
        assert len(doc["reset_token"]) >= 20

    def test_reset_password_request_duplicate_endpoint(self, mongo_db):
        r = requests.post(f"{API}/auth/reset-password-request",
                          params={"email": ADMIN_EMAIL}, timeout=30)
        assert r.status_code == 200, r.text
        doc = mongo_db.users.find_one({"email": ADMIN_EMAIL})
        assert doc.get("reset_token")


class TestResetPassword:
    def test_invalid_token_returns_404(self):
        r = requests.post(f"{API}/auth/reset-password",
                          params={"reset_token": "obviously_fake_token_xyz_123",
                                  "new_password": "SomePwd123"},
                          timeout=15)
        assert r.status_code == 404, r.text

    def test_valid_token_updates_password_and_clears_token(self, mongo_db):
        # Request fresh token
        r = requests.post(f"{API}/auth/forgot-password",
                          params={"email": ADMIN_EMAIL}, timeout=30)
        assert r.status_code == 200
        doc = mongo_db.users.find_one({"email": ADMIN_EMAIL})
        token = doc.get("reset_token")
        assert token

        new_pwd = "NewTEST_Pass_987654"
        r2 = requests.post(f"{API}/auth/reset-password",
                           params={"reset_token": token, "new_password": new_pwd},
                           timeout=20)
        assert r2.status_code == 200, r2.text
        assert "success" in r2.json()["message"].lower()

        # Token must be cleared
        doc2 = mongo_db.users.find_one({"email": ADMIN_EMAIL})
        assert not doc2.get("reset_token"), "reset_token not cleared after use"

        # Login with new password should work
        login = requests.post(f"{API}/auth/login",
                              json={"identifier": ADMIN_EMAIL, "password": new_pwd},
                              timeout=20)
        assert login.status_code == 200, f"Login with new password failed: {login.status_code} {login.text}"

    def test_token_cannot_be_reused(self, mongo_db):
        # Request fresh token
        requests.post(f"{API}/auth/forgot-password", params={"email": ADMIN_EMAIL}, timeout=30)
        doc = mongo_db.users.find_one({"email": ADMIN_EMAIL})
        token = doc.get("reset_token")
        assert token
        # Use token once
        requests.post(f"{API}/auth/reset-password",
                      params={"reset_token": token, "new_password": "Another_TEST_Pwd_111"},
                      timeout=20)
        # Reuse should fail (404 since token cleared)
        r = requests.post(f"{API}/auth/reset-password",
                          params={"reset_token": token, "new_password": "Yet_Another_222"},
                          timeout=20)
        assert r.status_code == 404
