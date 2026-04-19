"""Backend tests for Admin Community Forum management endpoints."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback read from frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api/community"

ADMIN_ID = "admin-test-123"  # admin@test.com's uid
TEST_USER_ID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # from test_credentials.md


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ==================== STATS / LIST ENDPOINTS ====================

class TestCommunityListEndpoints:
    def test_posts_list(self, client):
        r = client.get(f"{API}/posts?limit=20")
        assert r.status_code == 200
        data = r.json()
        assert "posts" in data
        assert "total" in data
        assert isinstance(data["posts"], list)

    def test_posts_list_with_filters(self, client):
        r = client.get(f"{API}/posts?limit=5&sort=latest")
        assert r.status_code == 200
        assert "posts" in r.json()

    def test_posts_list_search(self, client):
        r = client.get(f"{API}/posts?limit=5&search=test")
        assert r.status_code == 200

    def test_categories(self, client):
        r = client.get(f"{API}/categories")
        assert r.status_code == 200
        assert "categories" in r.json()

    def test_mod_list(self, client):
        r = client.get(f"{API}/mod/list")
        assert r.status_code == 200
        assert "moderators" in r.json()
        assert isinstance(r.json()["moderators"], list)

    def test_mod_reports_pending(self, client):
        r = client.get(f"{API}/mod/reports?status=pending")
        assert r.status_code == 200
        assert "reports" in r.json()

    def test_mod_reports_resolved(self, client):
        r = client.get(f"{API}/mod/reports?status=resolved")
        assert r.status_code == 200
        assert "reports" in r.json()

    def test_mod_blocked_users(self, client):
        r = client.get(f"{API}/mod/blocked-users")
        assert r.status_code == 200
        assert "blocked_users" in r.json()


# ==================== MODERATOR ADD / REMOVE ====================

class TestModeratorFlow:
    def test_add_moderator_auth_required(self, client):
        """Unauthorized user cannot add moderator."""
        r = client.post(f"{API}/mod/add", json={"admin_id": "not-admin", "user_id": TEST_USER_ID})
        assert r.status_code == 403

    def test_add_moderator_success(self, client):
        r = client.post(f"{API}/mod/add", json={"admin_id": ADMIN_ID, "user_id": TEST_USER_ID})
        # Could be 200 OK on first add, or 400 if already mod
        assert r.status_code in [200, 400]
        if r.status_code == 200:
            assert r.json()["success"] is True

    def test_moderator_listed(self, client):
        r = client.get(f"{API}/mod/list")
        assert r.status_code == 200
        mod_ids = [m["user_id"] for m in r.json()["moderators"]]
        assert TEST_USER_ID in mod_ids

    def test_add_moderator_duplicate(self, client):
        r = client.post(f"{API}/mod/add", json={"admin_id": ADMIN_ID, "user_id": TEST_USER_ID})
        assert r.status_code == 400

    def test_remove_moderator(self, client):
        r = client.post(f"{API}/mod/remove", json={"admin_id": ADMIN_ID, "user_id": TEST_USER_ID})
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_moderator_removed_from_list(self, client):
        r = client.get(f"{API}/mod/list")
        mod_ids = [m["user_id"] for m in r.json()["moderators"]]
        assert TEST_USER_ID not in mod_ids


# ==================== BLOCK / UNBLOCK USER ====================

class TestBlockUserFlow:
    BLOCK_USER_ID = "TEST_block_" + uuid.uuid4().hex[:8]

    def test_block_unauth(self, client):
        r = client.post(f"{API}/mod/block-user",
                        json={"mod_id": "not-admin", "user_id": self.BLOCK_USER_ID, "reason": "test"})
        assert r.status_code == 403

    def test_block_user_success(self, client):
        r = client.post(f"{API}/mod/block-user",
                        json={"mod_id": ADMIN_ID, "user_id": self.BLOCK_USER_ID, "reason": "test-blocking"})
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_blocked_user_listed(self, client):
        r = client.get(f"{API}/mod/blocked-users")
        blocked_ids = [u["user_id"] for u in r.json()["blocked_users"]]
        assert self.BLOCK_USER_ID in blocked_ids

    def test_unblock_user(self, client):
        r = client.post(f"{API}/mod/unblock-user",
                        json={"mod_id": ADMIN_ID, "user_id": self.BLOCK_USER_ID})
        assert r.status_code == 200

    def test_unblocked_not_in_list(self, client):
        r = client.get(f"{API}/mod/blocked-users")
        blocked_ids = [u["user_id"] for u in r.json()["blocked_users"]]
        assert self.BLOCK_USER_ID not in blocked_ids


# ==================== PIN / DELETE POST ====================

class TestPostActions:
    """Requires an existing post. We create one using the community create endpoint."""

    @pytest.fixture(scope="class")
    def created_post_id(self, client):
        # Create a test post as admin
        payload = {
            "user_id": ADMIN_ID,
            "user_name": "Test Admin",
            "title": "TEST_AdminCommunity Post",
            "content": "Test post for admin community testing",
            "category": "General Discussion"
        }
        r = client.post(f"{API}/posts/create", json=payload)
        if r.status_code != 200:
            pytest.skip(f"Cannot create post: {r.status_code} {r.text}")
        post_id = r.json().get("post_id") or r.json().get("post", {}).get("post_id")
        assert post_id
        yield post_id
        # cleanup: delete the post
        try:
            client.delete(f"{API}/posts/{post_id}", json={"user_id": ADMIN_ID})
        except Exception:
            pass

    def test_pin_unauth(self, client, created_post_id):
        r = client.post(f"{API}/posts/{created_post_id}/pin", json={"user_id": "not-admin"})
        assert r.status_code == 403

    def test_pin_post(self, client, created_post_id):
        r = client.post(f"{API}/posts/{created_post_id}/pin", json={"user_id": ADMIN_ID})
        assert r.status_code == 200
        assert r.json()["is_pinned"] is True

    def test_unpin_post(self, client, created_post_id):
        r = client.post(f"{API}/posts/{created_post_id}/pin", json={"user_id": ADMIN_ID})
        assert r.status_code == 200
        assert r.json()["is_pinned"] is False

    def test_get_post_detail(self, client, created_post_id):
        r = client.get(f"{API}/posts/{created_post_id}")
        assert r.status_code == 200
        data = r.json()
        assert "comments" in data or "post" in data or "title" in data

    def test_delete_post(self, client, created_post_id):
        r = client.delete(f"{API}/posts/{created_post_id}", json={"user_id": ADMIN_ID})
        assert r.status_code == 200


# ==================== RESOLVE REPORT ====================

class TestResolveReport:
    def test_resolve_unauth(self, client):
        r = client.post(f"{API}/mod/resolve-report",
                        json={"mod_id": "not-admin", "post_id": "fake-post", "action": "dismiss"})
        assert r.status_code == 403

    def test_resolve_no_pending_returns_200(self, client):
        # Even with no matching pending report, API should not 500 – update_many is idempotent
        r = client.post(f"{API}/mod/resolve-report",
                        json={"mod_id": ADMIN_ID, "post_id": "nonexistent-post-id", "action": "dismiss"})
        assert r.status_code == 200
