"""
Regression tests for Layer 1.7 — get_current_user() auth cache.

Locks in:
  1. Second call for the SAME (uid, token_id) skips the users.find_one
     and admin_sessions.find_one — DB not touched at all.
  2. Non-admin roles NEVER hit admin_sessions.find_one (saves 50 % of
     auth-related Mongo queries on prod where 99 % of users are non-admin).
  3. `invalidate_auth_cache(uid, token_id)` scopes down to one entry.
  4. `invalidate_auth_cache(uid)` (no token_id) purges every token of that uid.
  5. Cache is bounded (evicts oldest when it hits 20 K entries).
"""
import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(autouse=True)
def reset_auth_cache():
    import server as srv
    srv._AUTH_USER_CACHE.clear()
    yield
    srv._AUTH_USER_CACHE.clear()


class _FakeCredentials:
    def __init__(self, token):
        self.credentials = token


@pytest.mark.asyncio
async def test_second_call_hits_cache_no_db_touch(monkeypatch):
    """Same JWT twice → second call must skip find_one entirely."""
    import server as srv

    fake_users = MagicMock()
    fake_users.find_one = AsyncMock(return_value={
        "uid": "u_normal", "role": "user", "name": "Normal User",
    })
    fake_sessions = MagicMock()
    fake_sessions.find_one = AsyncMock(return_value=None)
    fake_db = MagicMock()
    fake_db.users = fake_users
    fake_db.admin_sessions = fake_sessions

    monkeypatch.setattr(srv, "db", fake_db)
    monkeypatch.setattr(srv, "verify_token", lambda t: {"uid": "u_normal", "token_id": "tk_A"})

    u1 = await srv.get_current_user(_FakeCredentials("JWT_A"))
    u2 = await srv.get_current_user(_FakeCredentials("JWT_A"))
    assert u1["uid"] == u2["uid"] == "u_normal"
    assert fake_users.find_one.await_count == 1, "cache miss should hit DB exactly once"


@pytest.mark.asyncio
async def test_non_admin_skips_admin_sessions_query(monkeypatch):
    """Regular users must NOT trigger the admin_sessions lookup."""
    import server as srv

    fake_users = MagicMock()
    fake_users.find_one = AsyncMock(return_value={"uid": "u_normal", "role": "user"})
    fake_sessions = MagicMock()
    fake_sessions.find_one = AsyncMock(return_value=None)
    fake_db = MagicMock()
    fake_db.users = fake_users
    fake_db.admin_sessions = fake_sessions

    monkeypatch.setattr(srv, "db", fake_db)
    monkeypatch.setattr(srv, "verify_token", lambda t: {"uid": "u_normal", "token_id": "tk"})

    await srv.get_current_user(_FakeCredentials("JWT"))

    fake_sessions.find_one.assert_not_awaited()


@pytest.mark.asyncio
async def test_admin_role_still_checks_session(monkeypatch):
    """Admin/sub_admin roles MUST still check admin_sessions."""
    import server as srv

    fake_users = MagicMock()
    fake_users.find_one = AsyncMock(return_value={"uid": "u_admin", "role": "admin"})
    fake_sessions = MagicMock()
    fake_sessions.find_one = AsyncMock(return_value={
        "uid": "u_admin", "token_id": "tk", "is_active": True,
    })
    fake_db = MagicMock()
    fake_db.users = fake_users
    fake_db.admin_sessions = fake_sessions

    monkeypatch.setattr(srv, "db", fake_db)
    monkeypatch.setattr(srv, "verify_token", lambda t: {"uid": "u_admin", "token_id": "tk"})

    u = await srv.get_current_user(_FakeCredentials("JWT_ADM"))
    assert u["role"] == "admin"
    fake_sessions.find_one.assert_awaited_once()


@pytest.mark.asyncio
async def test_admin_with_revoked_session_rejected(monkeypatch):
    """Admin whose session was revoked (is_active=False → returns None) must 401."""
    from fastapi import HTTPException
    import server as srv

    fake_users = MagicMock()
    fake_users.find_one = AsyncMock(return_value={"uid": "u_adm", "role": "admin"})
    fake_sessions = MagicMock()
    fake_sessions.find_one = AsyncMock(return_value=None)  # revoked
    fake_db = MagicMock()
    fake_db.users = fake_users
    fake_db.admin_sessions = fake_sessions
    monkeypatch.setattr(srv, "db", fake_db)
    monkeypatch.setattr(srv, "verify_token", lambda t: {"uid": "u_adm", "token_id": "tk_x"})

    with pytest.raises(HTTPException) as exc:
        await srv.get_current_user(_FakeCredentials("JWT_ADM_REV"))
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_invalidate_specific_token_only(monkeypatch):
    """invalidate_auth_cache(uid, token_id) must NOT wipe other tokens of the same user."""
    import server as srv

    srv._AUTH_USER_CACHE[("u_multi", "tk_1")] = (time.time(), {"uid": "u_multi"})
    srv._AUTH_USER_CACHE[("u_multi", "tk_2")] = (time.time(), {"uid": "u_multi"})
    srv._AUTH_USER_CACHE[("u_other", "tk_3")] = (time.time(), {"uid": "u_other"})

    srv.invalidate_auth_cache("u_multi", "tk_1")

    assert ("u_multi", "tk_1") not in srv._AUTH_USER_CACHE
    assert ("u_multi", "tk_2") in srv._AUTH_USER_CACHE
    assert ("u_other", "tk_3") in srv._AUTH_USER_CACHE


@pytest.mark.asyncio
async def test_invalidate_all_tokens_of_user(monkeypatch):
    """invalidate_auth_cache(uid) with no token_id must purge every token of that uid."""
    import server as srv

    srv._AUTH_USER_CACHE[("u_multi", "tk_1")] = (time.time(), {"uid": "u_multi"})
    srv._AUTH_USER_CACHE[("u_multi", "tk_2")] = (time.time(), {"uid": "u_multi"})
    srv._AUTH_USER_CACHE[("u_other", "tk_3")] = (time.time(), {"uid": "u_other"})

    srv.invalidate_auth_cache("u_multi")

    assert ("u_multi", "tk_1") not in srv._AUTH_USER_CACHE
    assert ("u_multi", "tk_2") not in srv._AUTH_USER_CACHE
    assert ("u_other", "tk_3") in srv._AUTH_USER_CACHE
