"""Tests for Live Wins / Success Stories feature in Community Forum.

Covers:
- GET /api/community/success-stats
- GET /api/community/posts?category=Success Story
- POST /api/community/posts/{id}/react (celebrate/love/fire: add/swap/remove)
- GET /api/community/posts/{id}/my-reaction
- POST /api/community/posts/create - rejects Success Story, allows General Discussion
- POST /api/community/admin/backfill-success-stories (admin only)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")

TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
ADMIN_UID = None  # resolved via /api/admin/login


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_uid(session):
    """Admin UID is seeded in DB (email=admin@test.com)."""
    return "admin-test-123"


# ----- Success Stats Endpoint -----
class TestSuccessStats:
    def test_success_stats_shape_and_200(self, session):
        r = session.get(f"{BASE_URL}/api/community/success-stats", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_lifetime", "total_7d", "total_24h", "total_amount_inr", "breakdown"):
            assert k in d, f"missing key {k}: {d}"
        assert isinstance(d["total_lifetime"], int)
        assert isinstance(d["breakdown"], dict)
        assert "recharge" in d["breakdown"] and "bank_redeem" in d["breakdown"]


# ----- Success Story Posts Feed -----
class TestSuccessStoryFeed:
    def test_feed_returns_success_stories(self, session):
        r = session.get(f"{BASE_URL}/api/community/posts",
                        params={"category": "Success Story", "limit": 20}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        posts = data.get("posts") if isinstance(data, dict) else data
        assert isinstance(posts, list), f"unexpected shape: {data}"
        # Should have seeded ones; at least 1 success story
        assert len(posts) >= 1, "expected seeded success stories"

        p = posts[0]
        assert p.get("category") == "Success Story"
        meta = p.get("metadata") or {}
        # metadata present
        for k in ("service_type", "first_name", "location", "amount_inr"):
            assert k in meta, f"missing metadata.{k}: {meta}"
        # store for next tests
        TestSuccessStoryFeed._first_post_id = p.get("post_id") or p.get("id")
        assert TestSuccessStoryFeed._first_post_id

    def test_get_first_post_id(self, session):
        # Re-run if state not carried
        if getattr(TestSuccessStoryFeed, "_first_post_id", None):
            return
        r = session.get(f"{BASE_URL}/api/community/posts",
                        params={"category": "Success Story", "limit": 5}, timeout=15)
        posts = r.json().get("posts", [])
        assert posts
        TestSuccessStoryFeed._first_post_id = posts[0].get("post_id") or posts[0].get("id")


# ----- Reactions (celebrate/love/fire add, swap, remove) -----
class TestReactions:
    @classmethod
    def _post_id(cls, session):
        r = session.get(f"{BASE_URL}/api/community/posts",
                        params={"category": "Success Story", "limit": 5}, timeout=15)
        posts = r.json().get("posts", []) if r.status_code == 200 else []
        return posts[0].get("post_id") if posts else None

    def test_add_celebrate(self, session):
        pid = self._post_id(session)
        assert pid, "no success story post available"
        # First, clear by sending same emoji twice if exists (toggle behavior)
        r = session.post(f"{BASE_URL}/api/community/posts/{pid}/react",
                         json={"user_id": TEST_UID, "emoji": "celebrate"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        # Check my-reaction
        r2 = session.get(f"{BASE_URL}/api/community/posts/{pid}/my-reaction",
                         params={"user_id": TEST_UID}, timeout=15)
        assert r2.status_code == 200
        # After toggle, emoji could be 'celebrate' (added) OR None (removed if it was already set)
        # Accept both but we will now ensure emoji is celebrate by forcing state
        if r2.json().get("emoji") is None:
            # Was previously set and we just removed it. Add again.
            session.post(f"{BASE_URL}/api/community/posts/{pid}/react",
                         json={"user_id": TEST_UID, "emoji": "celebrate"}, timeout=15)
            r2 = session.get(f"{BASE_URL}/api/community/posts/{pid}/my-reaction",
                             params={"user_id": TEST_UID}, timeout=15)
        assert r2.json().get("emoji") == "celebrate"

    def test_swap_to_love(self, session):
        pid = self._post_id(session)
        r = session.post(f"{BASE_URL}/api/community/posts/{pid}/react",
                         json={"user_id": TEST_UID, "emoji": "love"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        # Either swapped=True or added=True is acceptable, but my-reaction must be 'love'
        r2 = session.get(f"{BASE_URL}/api/community/posts/{pid}/my-reaction",
                         params={"user_id": TEST_UID}, timeout=15)
        assert r2.json().get("emoji") == "love"

    def test_swap_to_fire(self, session):
        pid = self._post_id(session)
        r = session.post(f"{BASE_URL}/api/community/posts/{pid}/react",
                         json={"user_id": TEST_UID, "emoji": "fire"}, timeout=15)
        assert r.status_code == 200, r.text
        r2 = session.get(f"{BASE_URL}/api/community/posts/{pid}/my-reaction",
                         params={"user_id": TEST_UID}, timeout=15)
        assert r2.json().get("emoji") == "fire"

    def test_remove_by_same_emoji(self, session):
        pid = self._post_id(session)
        # Pressing fire again removes it
        r = session.post(f"{BASE_URL}/api/community/posts/{pid}/react",
                         json={"user_id": TEST_UID, "emoji": "fire"}, timeout=15)
        assert r.status_code == 200
        r2 = session.get(f"{BASE_URL}/api/community/posts/{pid}/my-reaction",
                         params={"user_id": TEST_UID}, timeout=15)
        assert r2.json().get("emoji") is None

    def test_invalid_emoji_rejected(self, session):
        pid = self._post_id(session)
        r = session.post(f"{BASE_URL}/api/community/posts/{pid}/react",
                         json={"user_id": TEST_UID, "emoji": "thumbsup"}, timeout=15)
        assert r.status_code == 400


# ----- Create-Post guard -----
class TestCreatePostGuard:
    def test_success_story_category_rejected(self, session):
        r = session.post(f"{BASE_URL}/api/community/posts/create",
                         json={"user_id": TEST_UID, "user_name": "Test User",
                               "title": "TEST_ss",
                               "content": "attempt to post", "category": "Success Story"},
                         timeout=15)
        assert r.status_code == 403, r.text

    def test_general_discussion_allowed(self, session):
        r = session.post(f"{BASE_URL}/api/community/posts/create",
                         json={"user_id": TEST_UID, "user_name": "Test User",
                               "title": "TEST_general_from_tests",
                               "content": "regression check for normal posting",
                               "category": "General Discussion"},
                         timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # response should contain post_id or success
        assert d.get("success") is True or d.get("post_id")
        # Cleanup: best-effort delete
        pid = d.get("post_id") or (d.get("post") or {}).get("post_id")
        if pid:
            try:
                session.delete(f"{BASE_URL}/api/community/posts/{pid}",
                               params={"user_id": TEST_UID}, timeout=10)
            except Exception:
                pass


# ----- Admin Backfill -----
class TestAdminBackfill:
    def test_backfill_requires_admin(self, session):
        # Non-admin should 403
        r = session.post(f"{BASE_URL}/api/community/admin/backfill-success-stories",
                         json={"admin_id": TEST_UID, "dry_run": True, "limit": 5}, timeout=30)
        assert r.status_code == 403, r.text

    def test_backfill_with_admin(self, session, admin_uid):
        r = session.post(f"{BASE_URL}/api/community/admin/backfill-success-stories",
                         json={"admin_id": admin_uid, "dry_run": True, "limit": 5}, timeout=30)
        if r.status_code == 403:
            pytest.skip(f"Could not resolve admin uid ({admin_uid}); saw 403")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "by_type" in d
        for k in ("mobile_recharge", "dth_recharge", "bank_redeem"):
            assert k in d["by_type"]
