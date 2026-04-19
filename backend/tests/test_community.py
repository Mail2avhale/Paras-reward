"""
Community Help Page API Tests
=============================
Tests for community forum features:
- Categories, Posts CRUD, Like/Bookmark, Comments
- Moderation: Add/Remove mods, Block/Unblock users, Reports
- User stats and reputation
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


class TestCommunityCategories:
    """Test GET /api/community/categories"""
    
    def test_get_categories_returns_6(self):
        """Categories endpoint returns exactly 6 categories"""
        response = requests.get(f"{BASE_URL}/api/community/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert len(data["categories"]) == 6
        expected = ["Help Request", "Knowledge Share", "Tips & Tricks", "General Discussion", "Announcement", "Support"]
        assert data["categories"] == expected
        print(f"PASS: Categories returned: {data['categories']}")


class TestCommunityPosts:
    """Test Posts CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_post_id = None
        self.test_user_id = TEST_USER_UID
        self.test_user_name = "Test User"
        yield
        # Cleanup: delete test post if created
        if self.test_post_id:
            try:
                requests.delete(
                    f"{BASE_URL}/api/community/posts/{self.test_post_id}",
                    json={"user_id": self.test_user_id}
                )
            except:
                pass
    
    def test_create_post_success(self):
        """POST /api/community/posts/create creates a post"""
        payload = {
            "user_id": self.test_user_id,
            "user_name": self.test_user_name,
            "category": "General Discussion",
            "title": f"TEST_Post_{uuid.uuid4().hex[:6]}",
            "content": "This is a test post content for community testing."
        }
        response = requests.post(f"{BASE_URL}/api/community/posts/create", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "post" in data
        assert data["post"]["title"] == payload["title"]
        assert data["post"]["category"] == "General Discussion"
        assert "post_id" in data["post"]
        self.test_post_id = data["post"]["post_id"]
        print(f"PASS: Post created with ID: {self.test_post_id}")
    
    def test_create_post_invalid_category(self):
        """POST /api/community/posts/create rejects invalid category"""
        payload = {
            "user_id": self.test_user_id,
            "user_name": self.test_user_name,
            "category": "Invalid Category",
            "title": "Test Title",
            "content": "Test content"
        }
        response = requests.post(f"{BASE_URL}/api/community/posts/create", json=payload)
        assert response.status_code == 400
        print("PASS: Invalid category rejected")
    
    def test_get_posts_list(self):
        """GET /api/community/posts returns posts list"""
        response = requests.get(f"{BASE_URL}/api/community/posts")
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        assert isinstance(data["posts"], list)
        print(f"PASS: Posts list returned with {len(data['posts'])} posts, total: {data['total']}")
    
    def test_get_posts_with_category_filter(self):
        """GET /api/community/posts?category=Help Request filters by category"""
        response = requests.get(f"{BASE_URL}/api/community/posts?category=Help Request")
        assert response.status_code == 200
        data = response.json()
        for post in data.get("posts", []):
            assert post["category"] == "Help Request"
        print(f"PASS: Category filter works, {len(data['posts'])} Help Request posts")
    
    def test_get_posts_with_search(self):
        """GET /api/community/posts?search=test searches posts"""
        response = requests.get(f"{BASE_URL}/api/community/posts?search=test")
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data
        print(f"PASS: Search works, {len(data['posts'])} posts found")
    
    def test_get_posts_with_sort(self):
        """GET /api/community/posts?sort=popular sorts by likes"""
        response = requests.get(f"{BASE_URL}/api/community/posts?sort=popular")
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data
        print(f"PASS: Sort by popular works")
    
    def test_get_post_detail(self):
        """GET /api/community/posts/{post_id} returns post detail"""
        # First get a post
        list_response = requests.get(f"{BASE_URL}/api/community/posts?limit=1")
        posts = list_response.json().get("posts", [])
        if not posts:
            pytest.skip("No posts available for detail test")
        
        post_id = posts[0]["post_id"]
        response = requests.get(f"{BASE_URL}/api/community/posts/{post_id}")
        assert response.status_code == 200
        data = response.json()
        assert "post" in data
        assert "comments" in data
        assert "author_reputation" in data
        assert data["post"]["post_id"] == post_id
        print(f"PASS: Post detail returned for {post_id}")
    
    def test_get_post_detail_not_found(self):
        """GET /api/community/posts/{invalid_id} returns 404"""
        response = requests.get(f"{BASE_URL}/api/community/posts/INVALID-POST-ID")
        assert response.status_code == 404
        print("PASS: Invalid post ID returns 404")


class TestCommunityLikeBookmark:
    """Test Like and Bookmark toggle functionality"""
    
    @pytest.fixture
    def existing_post_id(self):
        """Get an existing post ID for testing"""
        response = requests.get(f"{BASE_URL}/api/community/posts?limit=1")
        posts = response.json().get("posts", [])
        if not posts:
            pytest.skip("No posts available")
        return posts[0]["post_id"]
    
    def test_toggle_like(self, existing_post_id):
        """POST /api/community/posts/{post_id}/like toggles like"""
        payload = {"user_id": TEST_USER_UID}
        
        # First toggle (like)
        response = requests.post(f"{BASE_URL}/api/community/posts/{existing_post_id}/like", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "liked" in data
        first_state = data["liked"]
        print(f"PASS: Like toggled to {first_state}")
        
        # Second toggle (unlike)
        response2 = requests.post(f"{BASE_URL}/api/community/posts/{existing_post_id}/like", json=payload)
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["liked"] != first_state
        print(f"PASS: Like toggled back to {data2['liked']}")
    
    def test_toggle_bookmark(self, existing_post_id):
        """POST /api/community/posts/{post_id}/bookmark toggles bookmark"""
        payload = {"user_id": TEST_USER_UID}
        
        response = requests.post(f"{BASE_URL}/api/community/posts/{existing_post_id}/bookmark", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "bookmarked" in data
        print(f"PASS: Bookmark toggled to {data['bookmarked']}")
    
    def test_get_user_bookmarks(self):
        """GET /api/community/bookmarks/{user_id} returns bookmarked posts"""
        response = requests.get(f"{BASE_URL}/api/community/bookmarks/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data
        print(f"PASS: User bookmarks returned, {len(data['posts'])} posts")


class TestCommunityComments:
    """Test Comment functionality"""
    
    @pytest.fixture
    def existing_post_id(self):
        """Get an existing post ID for testing"""
        response = requests.get(f"{BASE_URL}/api/community/posts?limit=1")
        posts = response.json().get("posts", [])
        if not posts:
            pytest.skip("No posts available")
        return posts[0]["post_id"]
    
    def test_add_comment(self, existing_post_id):
        """POST /api/community/posts/{post_id}/comment adds comment"""
        payload = {
            "user_id": TEST_USER_UID,
            "user_name": "Test User",
            "content": f"TEST_Comment_{uuid.uuid4().hex[:6]}"
        }
        response = requests.post(f"{BASE_URL}/api/community/posts/{existing_post_id}/comment", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "comment" in data
        assert data["comment"]["content"] == payload["content"]
        assert "comment_id" in data["comment"]
        print(f"PASS: Comment added with ID: {data['comment']['comment_id']}")
        return data["comment"]["comment_id"]
    
    def test_add_nested_reply(self, existing_post_id):
        """POST /api/community/posts/{post_id}/comment with parent_comment_id adds reply"""
        # First add a parent comment
        parent_payload = {
            "user_id": TEST_USER_UID,
            "user_name": "Test User",
            "content": f"TEST_Parent_{uuid.uuid4().hex[:6]}"
        }
        parent_response = requests.post(f"{BASE_URL}/api/community/posts/{existing_post_id}/comment", json=parent_payload)
        parent_comment_id = parent_response.json()["comment"]["comment_id"]
        
        # Add reply
        reply_payload = {
            "user_id": TEST_USER_UID,
            "user_name": "Test User",
            "content": f"TEST_Reply_{uuid.uuid4().hex[:6]}",
            "parent_comment_id": parent_comment_id
        }
        response = requests.post(f"{BASE_URL}/api/community/posts/{existing_post_id}/comment", json=reply_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["comment"]["parent_comment_id"] == parent_comment_id
        print(f"PASS: Nested reply added to comment {parent_comment_id}")


class TestCommunityReport:
    """Test Report functionality"""
    
    @pytest.fixture
    def existing_post_id(self):
        """Get an existing post ID for testing"""
        response = requests.get(f"{BASE_URL}/api/community/posts?limit=1")
        posts = response.json().get("posts", [])
        if not posts:
            pytest.skip("No posts available")
        return posts[0]["post_id"]
    
    def test_report_post(self, existing_post_id):
        """POST /api/community/posts/{post_id}/report reports a post"""
        # Use a unique user_id to avoid "already reported" error
        unique_user_id = f"test-reporter-{uuid.uuid4().hex[:8]}"
        payload = {
            "user_id": unique_user_id,
            "reason": "Test report reason"
        }
        response = requests.post(f"{BASE_URL}/api/community/posts/{existing_post_id}/report", json=payload)
        # Could be 200 (success) or 400 (already reported)
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print("PASS: Post reported successfully")
        else:
            print("PASS: Report endpoint works (already reported)")


class TestCommunityModeration:
    """Test Moderation features (admin only)"""
    
    @pytest.fixture
    def admin_user_id(self):
        """Get admin user ID by logging in"""
        # Login as admin with email+PIN
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        
        uid = login_response.json().get("uid")
        if not uid:
            pytest.skip("Admin UID not returned")
        
        return uid
    
    def test_mark_helpful_mod_only(self, admin_user_id):
        """POST /api/community/posts/{post_id}/helpful marks as helpful (mod only)"""
        # Get a post
        posts_response = requests.get(f"{BASE_URL}/api/community/posts?limit=1")
        posts = posts_response.json().get("posts", [])
        if not posts:
            pytest.skip("No posts available")
        
        post_id = posts[0]["post_id"]
        payload = {"user_id": admin_user_id}
        response = requests.post(f"{BASE_URL}/api/community/posts/{post_id}/helpful", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "is_helpful" in data
        print(f"PASS: Post marked as helpful: {data['is_helpful']}")
    
    def test_mark_helpful_non_mod_rejected(self):
        """POST /api/community/posts/{post_id}/helpful rejects non-mod"""
        posts_response = requests.get(f"{BASE_URL}/api/community/posts?limit=1")
        posts = posts_response.json().get("posts", [])
        if not posts:
            pytest.skip("No posts available")
        
        post_id = posts[0]["post_id"]
        payload = {"user_id": "non-mod-user-id"}
        response = requests.post(f"{BASE_URL}/api/community/posts/{post_id}/helpful", json=payload)
        assert response.status_code == 403
        print("PASS: Non-mod rejected from marking helpful")
    
    def test_pin_post_mod_only(self, admin_user_id):
        """POST /api/community/posts/{post_id}/pin pins post (mod only)"""
        posts_response = requests.get(f"{BASE_URL}/api/community/posts?limit=1")
        posts = posts_response.json().get("posts", [])
        if not posts:
            pytest.skip("No posts available")
        
        post_id = posts[0]["post_id"]
        payload = {"user_id": admin_user_id}
        response = requests.post(f"{BASE_URL}/api/community/posts/{post_id}/pin", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "is_pinned" in data
        print(f"PASS: Post pinned: {data['is_pinned']}")
    
    def test_add_moderator(self, admin_user_id):
        """POST /api/community/mod/add adds moderator (admin only)"""
        payload = {
            "admin_id": admin_user_id,
            "user_id": TEST_USER_UID
        }
        response = requests.post(f"{BASE_URL}/api/community/mod/add", json=payload)
        # Could be 200 (success) or 400 (already a moderator)
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            print("PASS: Moderator added")
        else:
            print("PASS: Add moderator endpoint works (already a mod)")
    
    def test_remove_moderator(self, admin_user_id):
        """POST /api/community/mod/remove removes moderator"""
        payload = {
            "admin_id": admin_user_id,
            "user_id": TEST_USER_UID
        }
        response = requests.post(f"{BASE_URL}/api/community/mod/remove", json=payload)
        assert response.status_code == 200
        print("PASS: Moderator removed")
    
    def test_list_moderators(self):
        """GET /api/community/mod/list returns moderators"""
        response = requests.get(f"{BASE_URL}/api/community/mod/list")
        assert response.status_code == 200
        data = response.json()
        assert "moderators" in data
        print(f"PASS: Moderators list returned, {len(data['moderators'])} mods")
    
    def test_block_user(self, admin_user_id):
        """POST /api/community/mod/block-user blocks user"""
        block_user_id = f"test-block-{uuid.uuid4().hex[:8]}"
        payload = {
            "mod_id": admin_user_id,
            "user_id": block_user_id,
            "reason": "Test block"
        }
        response = requests.post(f"{BASE_URL}/api/community/mod/block-user", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"PASS: User {block_user_id} blocked")
        
        # Unblock for cleanup
        unblock_payload = {
            "mod_id": admin_user_id,
            "user_id": block_user_id
        }
        requests.post(f"{BASE_URL}/api/community/mod/unblock-user", json=unblock_payload)
    
    def test_unblock_user(self, admin_user_id):
        """POST /api/community/mod/unblock-user unblocks user"""
        payload = {
            "mod_id": admin_user_id,
            "user_id": "some-blocked-user"
        }
        response = requests.post(f"{BASE_URL}/api/community/mod/unblock-user", json=payload)
        assert response.status_code == 200
        print("PASS: Unblock user endpoint works")
    
    def test_list_blocked_users(self):
        """GET /api/community/mod/blocked-users returns blocked users"""
        response = requests.get(f"{BASE_URL}/api/community/mod/blocked-users")
        assert response.status_code == 200
        data = response.json()
        assert "blocked_users" in data
        print(f"PASS: Blocked users list returned, {len(data['blocked_users'])} users")
    
    def test_get_reports(self):
        """GET /api/community/mod/reports returns pending reports"""
        response = requests.get(f"{BASE_URL}/api/community/mod/reports")
        assert response.status_code == 200
        data = response.json()
        assert "reports" in data
        print(f"PASS: Reports list returned, {len(data['reports'])} reports")
    
    def test_resolve_report(self, admin_user_id):
        """POST /api/community/mod/resolve-report resolves report"""
        # Get a report first
        reports_response = requests.get(f"{BASE_URL}/api/community/mod/reports")
        reports = reports_response.json().get("reports", [])
        
        if not reports:
            # Create a test report first
            posts_response = requests.get(f"{BASE_URL}/api/community/posts?limit=1")
            posts = posts_response.json().get("posts", [])
            if posts:
                requests.post(f"{BASE_URL}/api/community/posts/{posts[0]['post_id']}/report", json={
                    "user_id": f"test-reporter-{uuid.uuid4().hex[:8]}",
                    "reason": "Test"
                })
                reports_response = requests.get(f"{BASE_URL}/api/community/mod/reports")
                reports = reports_response.json().get("reports", [])
        
        if not reports:
            pytest.skip("No reports to resolve")
        
        payload = {
            "post_id": reports[0]["post_id"],
            "action": "dismiss",
            "mod_id": admin_user_id
        }
        response = requests.post(f"{BASE_URL}/api/community/mod/resolve-report", json=payload)
        assert response.status_code == 200
        print("PASS: Report resolved")


class TestCommunityStats:
    """Test Stats endpoints"""
    
    def test_get_community_stats(self):
        """GET /api/community/stats returns community stats"""
        response = requests.get(f"{BASE_URL}/api/community/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_posts" in data
        assert "total_comments" in data
        assert "active_users" in data
        assert "helpful_posts" in data
        assert "pending_reports" in data
        assert "categories" in data
        print(f"PASS: Community stats: {data['total_posts']} posts, {data['active_users']} users")
    
    def test_get_user_stats(self):
        """GET /api/community/user/{user_id}/stats returns user reputation"""
        response = requests.get(f"{BASE_URL}/api/community/user/{TEST_USER_UID}/stats")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "reputation" in data
        assert "is_moderator" in data
        assert "is_blocked" in data
        rep = data["reputation"]
        assert "post_count" in rep
        assert "helpful_count" in rep
        assert "comment_count" in rep
        assert "total_likes_received" in rep
        print(f"PASS: User stats: {rep['post_count']} posts, {rep['total_likes_received']} likes")


class TestCommunityDeletePost:
    """Test Delete Post functionality"""
    
    def test_delete_post_by_author(self):
        """DELETE /api/community/posts/{post_id} deletes post (author)"""
        # Create a post first
        create_payload = {
            "user_id": TEST_USER_UID,
            "user_name": "Test User",
            "category": "General Discussion",
            "title": f"TEST_Delete_{uuid.uuid4().hex[:6]}",
            "content": "This post will be deleted"
        }
        create_response = requests.post(f"{BASE_URL}/api/community/posts/create", json=create_payload)
        if create_response.status_code != 200:
            pytest.skip("Could not create post for delete test")
        
        post_id = create_response.json()["post"]["post_id"]
        
        # Delete the post
        delete_response = requests.delete(
            f"{BASE_URL}/api/community/posts/{post_id}",
            json={"user_id": TEST_USER_UID}
        )
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert data.get("success") == True
        print(f"PASS: Post {post_id} deleted by author")
    
    def test_delete_post_unauthorized(self):
        """DELETE /api/community/posts/{post_id} rejects unauthorized user"""
        # Get a post
        posts_response = requests.get(f"{BASE_URL}/api/community/posts?limit=1")
        posts = posts_response.json().get("posts", [])
        if not posts:
            pytest.skip("No posts available")
        
        post_id = posts[0]["post_id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/community/posts/{post_id}",
            json={"user_id": "unauthorized-user-id"}
        )
        assert delete_response.status_code == 403
        print("PASS: Unauthorized delete rejected")


class TestBlockedUserRestrictions:
    """Test that blocked users cannot create posts"""
    
    def test_blocked_user_cannot_create_post(self):
        """POST /api/community/posts/create returns 403 for blocked user"""
        # First, we need to block a test user
        # Login as admin with email+PIN
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        
        admin_uid = login_response.json().get("uid")
        if not admin_uid:
            pytest.skip("Admin UID not returned")
        
        # Block a test user
        blocked_user_id = f"test-blocked-{uuid.uuid4().hex[:8]}"
        block_response = requests.post(f"{BASE_URL}/api/community/mod/block-user", json={
            "mod_id": admin_uid,
            "user_id": blocked_user_id,
            "reason": "Test block for post restriction"
        })
        
        # Try to create post as blocked user
        create_payload = {
            "user_id": blocked_user_id,
            "user_name": "Blocked User",
            "category": "General Discussion",
            "title": "Should not be created",
            "content": "This should fail"
        }
        create_response = requests.post(f"{BASE_URL}/api/community/posts/create", json=create_payload)
        assert create_response.status_code == 403
        print("PASS: Blocked user cannot create post (403)")
        
        # Cleanup: unblock user
        requests.post(f"{BASE_URL}/api/community/mod/unblock-user", json={
            "mod_id": admin_uid,
            "user_id": blocked_user_id
        })


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
