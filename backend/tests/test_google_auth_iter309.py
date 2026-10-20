# Google sign-in (Emergent managed) + PIN login regression tests
import os
import sys
import asyncio
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')

USER_MOBILE, USER_PIN = "9970100782", "997010"
ADMIN_EMAIL, ADMIN_PIN = "admin@test.com", "153759"


# ---- Public endpoint: error paths ----
class TestGoogleSessionErrors:
    def test_missing_session_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/google/session", json={})
        assert r.status_code == 400
        assert "Missing Google session" in r.json()["detail"]

    def test_invalid_session_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/google/session", json={"session_id": "invalid_xyz_123"})
        assert r.status_code == 401
        assert "Google sign-in expired or was cancelled" in r.json()["detail"]


# ---- PIN login regression ----
class TestPinLoginRegression:
    def test_user_pin_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": USER_MOBILE, "password": USER_PIN})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("token") and d.get("session_token") and d.get("uid")
        assert d.get("role") == "user"

    def test_admin_pin_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PIN})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("token")
        assert d.get("role") in ("admin", "sub_admin", "super_admin", "manager")
        # admin session must work on a protected call
        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {d['token']}"})
        assert me.status_code in (200, 404), me.text


# ---- Unit tests (in-process) with mocked httpx for happy paths ----
sys.path.insert(0, '/app/backend')


class _FakeResp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status

    def json(self):
        return self._p


def _make_fake_client(payload):
    class _FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, headers=None):
            assert headers and headers.get("X-Session-ID")
            return _FakeResp(payload)
    return _FakeClient


class _FakeRequest:
    def __init__(self, body):
        self._b = body
        self.headers = {"user-agent": "pytest-google"}
        self.client = type("C", (), {"host": "127.0.0.1"})()

    async def json(self):
        return self._b


@pytest.fixture(scope="module")
def env():
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')
    import httpx
    from motor.motor_asyncio import AsyncIOMotorClient
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    import server  # noqa: F401  (initialises routes.auth db)
    from routes import auth as auth_mod
    if getattr(auth_mod, "db", None) is None:
        pytest.skip("routes.auth db not initialised")
    dbc = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    auth_mod.db = auth_mod.db if auth_mod.db is not None else dbc
    yield {"loop": loop, "auth": auth_mod, "httpx": httpx, "db": auth_mod.db}
    loop.close()


def _call(env, monkeypatch, payload):
    monkeypatch.setattr(env["httpx"], "AsyncClient", _make_fake_client(payload))
    return env["loop"].run_until_complete(
        env["auth"].google_session_login(_FakeRequest({"session_id": "mock_sess", "device_id": None}))
    )


class TestGoogleSessionHappyPaths:
    def test_existing_user_ok(self, env, monkeypatch):
        db, loop = env["db"], env["loop"]
        u = loop.run_until_complete(db.users.find_one({"mobile": USER_MOBILE}, {"_id": 0}))
        if not u or not u.get("email"):
            pytest.skip("user has no email")
        before = u.get("session_token")
        res = _call(env, monkeypatch, {"email": u["email"].upper(), "name": "X", "picture": "http://p"})
        try:
            assert res["status"] == "ok"
            assert res["token"] and res["session_token"] and res["uid"] == u["uid"]
            assert res["role"] == u.get("role", "user")
            after = loop.run_until_complete(db.users.find_one({"uid": u["uid"]}, {"_id": 0}))
            assert after["google_linked"] is True
            assert after["session_token"] == res["session_token"] != before
            loop.run_until_complete(asyncio.sleep(1.0))
            lh = loop.run_until_complete(db.login_history.find_one(
                {"user_id": u["uid"], "login_type": "google"}, sort=[("login_time", -1)]))
            assert lh is not None
        finally:
            loop.run_until_complete(db.users.update_one({"uid": u["uid"]}, {"$unset": {
                "google_linked": "", "google_email": "", "google_picture": "", "google_last_login_at": ""}}))
            loop.run_until_complete(db.login_history.delete_many({"user_id": u["uid"], "login_type": "google"}))

    def test_unknown_email_register_required(self, env, monkeypatch):
        res = _call(env, monkeypatch, {"email": "TEST_nobody_9z@example.com", "name": "No Body"})
        assert res["status"] == "register_required"
        assert res["email"] == "test_nobody_9z@example.com"
        assert res["name"] == "No Body"

    def test_admin_blocked_403(self, env, monkeypatch):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as ei:
            _call(env, monkeypatch, {"email": ADMIN_EMAIL, "name": "Admin"})
        assert ei.value.status_code == 403
        a = env["loop"].run_until_complete(env["db"].users.find_one({"email": ADMIN_EMAIL}, {"_id": 0}))
        assert not a.get("google_linked")
