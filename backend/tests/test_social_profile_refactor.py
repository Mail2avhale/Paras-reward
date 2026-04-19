"""
Phase 1 refactor regression tests - routes/social_profile.py extraction from server.py
Tests all 9 extracted endpoints + unrelated endpoint regressions.
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")

# Primary test user
USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
USER_MOBILE = "9970100782"
USER_PIN = "997010"

# Secondary test user (PRC test user) - used as follower
FOLLOWER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ================ EXTRACTED SOCIAL PROFILE ENDPOINTS ================

class TestSocialProfileExtracted:
    """Tests for the 9 endpoints extracted to routes/social_profile.py"""

    def test_public_profile_returns_full_shape(self, api):
        r = api.get(f"{BASE_URL}/api/users/{USER_UID}/public-profile")
        assert r.status_code == 200, r.text
        data = r.json()
        # Validate shape from social_profile.py get_public_profile
        assert data["uid"] == USER_UID
        assert "name" in data
        assert "is_public" in data
        assert "followers_count" in data
        assert "following_count" in data
        assert "level" in data and isinstance(data["level"], int)
        assert "team_size" in data
        assert "earned_badges" in data
        assert "total_badges" in data

    def test_public_profile_404_for_unknown_user(self, api):
        r = api.get(f"{BASE_URL}/api/users/nonexistent-uid-xxx-0000/public-profile")
        assert r.status_code == 404

    def test_privacy_settings_update_public_true(self, api):
        r = api.put(
            f"{BASE_URL}/api/users/{USER_UID}/privacy-settings",
            json={"is_public": True},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True

        # Verify persistence: profile should report is_public True
        r2 = api.get(f"{BASE_URL}/api/users/{USER_UID}/public-profile")
        assert r2.status_code == 200
        assert r2.json().get("is_public") is True

    def test_privacy_settings_update_multiple_flags(self, api):
        r = api.put(
            f"{BASE_URL}/api/users/{USER_UID}/privacy-settings",
            json={"is_public": True, "show_team_size": True, "allow_messages": True},
        )
        assert r.status_code == 200
        assert r.json().get("success") is True

    def test_follow_self_returns_400(self, api):
        r = api.post(
            f"{BASE_URL}/api/users/{USER_UID}/follow",
            json={"follower_uid": USER_UID},
        )
        assert r.status_code == 400
        assert "yourself" in r.text.lower()

    def test_follow_missing_body_returns_400(self, api):
        r = api.post(
            f"{BASE_URL}/api/users/{USER_UID}/follow",
            json={},
        )
        assert r.status_code == 400

    def test_follow_unknown_target_returns_404(self, api):
        r = api.post(
            f"{BASE_URL}/api/users/nonexistent-uid-xxx-0000/follow",
            json={"follower_uid": USER_UID},
        )
        assert r.status_code == 404

    def test_follow_unfollow_check_lifecycle(self, api):
        # Clean up pre-existing follow to start from known state
        api.delete(
            f"{BASE_URL}/api/users/{USER_UID}/unfollow",
            json={"follower_uid": FOLLOWER_UID},
        )

        # POST follow: FOLLOWER_UID follows USER_UID
        r1 = api.post(
            f"{BASE_URL}/api/users/{USER_UID}/follow",
            json={"follower_uid": FOLLOWER_UID},
        )
        assert r1.status_code == 200, r1.text
        assert r1.json().get("is_following") is True

        # GET check-follow: should be True
        r2 = api.get(
            f"{BASE_URL}/api/users/{FOLLOWER_UID}/check-follow/{USER_UID}"
        )
        assert r2.status_code == 200
        assert r2.json().get("is_following") is True

        # POST follow again → should return already following (idempotent)
        r3 = api.post(
            f"{BASE_URL}/api/users/{USER_UID}/follow",
            json={"follower_uid": FOLLOWER_UID},
        )
        assert r3.status_code == 200
        assert r3.json().get("is_following") is True

        # GET followers list of USER_UID → FOLLOWER_UID should be present
        r4 = api.get(f"{BASE_URL}/api/users/{USER_UID}/followers?page=1&limit=50")
        assert r4.status_code == 200, r4.text
        body = r4.json()
        assert "followers" in body
        assert "total" in body
        assert body["total"] >= 1
        uids = [f["uid"] for f in body["followers"]]
        assert FOLLOWER_UID in uids
        # Check item shape
        item = next(f for f in body["followers"] if f["uid"] == FOLLOWER_UID)
        for key in ("uid", "name", "avatar", "badge"):
            assert key in item

        # GET following list of FOLLOWER_UID → USER_UID should be present
        r5 = api.get(f"{BASE_URL}/api/users/{FOLLOWER_UID}/following?page=1&limit=50")
        assert r5.status_code == 200
        body = r5.json()
        assert "following" in body
        uids = [f["uid"] for f in body["following"]]
        assert USER_UID in uids

        # DELETE unfollow
        r6 = api.delete(
            f"{BASE_URL}/api/users/{USER_UID}/unfollow",
            json={"follower_uid": FOLLOWER_UID},
        )
        assert r6.status_code == 200
        assert r6.json().get("is_following") is False

        # GET check-follow: should be False now
        r7 = api.get(
            f"{BASE_URL}/api/users/{FOLLOWER_UID}/check-follow/{USER_UID}"
        )
        assert r7.status_code == 200
        assert r7.json().get("is_following") is False

        # DELETE unfollow again (not following) — graceful
        r8 = api.delete(
            f"{BASE_URL}/api/users/{USER_UID}/unfollow",
            json={"follower_uid": FOLLOWER_UID},
        )
        assert r8.status_code == 200
        assert r8.json().get("is_following") is False

    def test_unfollow_missing_follower_returns_400(self, api):
        r = api.delete(
            f"{BASE_URL}/api/users/{USER_UID}/unfollow",
            json={},
        )
        assert r.status_code == 400

    def test_followers_pagination(self, api):
        r = api.get(f"{BASE_URL}/api/users/{USER_UID}/followers?page=1&limit=5")
        assert r.status_code == 200
        body = r.json()
        assert body["page"] == 1
        assert "total_pages" in body
        assert len(body["followers"]) <= 5

    def test_feed_global_returns_activities_array(self, api):
        r = api.get(f"{BASE_URL}/api/feed/global?page=1&limit=20")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "activities" in body
        assert isinstance(body["activities"], list)
        assert "page" in body
        # Type check items if present
        if body["activities"]:
            types_found = {a.get("type") for a in body["activities"]}
            allowed = {"milestone", "follow", "team_growth"}
            # At least all found types should be from allowed set
            assert types_found.issubset(allowed)

    def test_feed_network_with_uid(self, api):
        r = api.get(f"{BASE_URL}/api/feed/network/{USER_UID}?page=1&limit=20")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "activities" in body
        assert isinstance(body["activities"], list)
        assert "page" in body

    def test_feed_network_with_no_follows_returns_message(self, api):
        # Use a random UID that can't have any follows
        unknown = f"no-follows-{uuid.uuid4()}"
        r = api.get(f"{BASE_URL}/api/feed/network/{unknown}")
        assert r.status_code == 200
        body = r.json()
        assert body.get("activities") == []
        assert body.get("total") == 0


# ================ REGRESSION: UNRELATED ENDPOINTS ================

class TestRegressionUnrelated:
    """Verify unrelated endpoints still work after refactor."""

    def test_user_dashboard(self, api):
        r = api.get(f"{BASE_URL}/api/user/{USER_UID}/dashboard")
        assert r.status_code == 200, r.text
        data = r.json()
        # Has some shape
        assert isinstance(data, dict)

    def test_user_get(self, api):
        r = api.get(f"{BASE_URL}/api/user/{USER_UID}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("uid") == USER_UID

    def test_community_posts(self, api):
        r = api.get(f"{BASE_URL}/api/community/posts")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_user_recent_activity(self, api):
        r = api.get(f"{BASE_URL}/api/user/{USER_UID}/recent-activity")
        assert r.status_code == 200, r.text

    def test_auth_login(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"mobile": USER_MOBILE, "pin": USER_PIN},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # login response should contain some user info
        assert "uid" in data or "user" in data or "token" in data or "success" in data


# ================ REGRESSION: follows collection used by other endpoints ================

class TestFollowsCollectionCrossEndpoint:
    """Ensure other endpoints that use db.follows still function correctly."""

    def test_public_profile_followers_count_reflects_db_state(self, api):
        # Ensure consistent: create follow, then public-profile should report count
        api.delete(
            f"{BASE_URL}/api/users/{USER_UID}/unfollow",
            json={"follower_uid": FOLLOWER_UID},
        )

        r_before = api.get(f"{BASE_URL}/api/users/{USER_UID}/public-profile")
        before = r_before.json().get("followers_count", 0)

        rf = api.post(
            f"{BASE_URL}/api/users/{USER_UID}/follow",
            json={"follower_uid": FOLLOWER_UID},
        )
        assert rf.status_code == 200

        r_after = api.get(f"{BASE_URL}/api/users/{USER_UID}/public-profile")
        after = r_after.json().get("followers_count", 0)
        assert after == before + 1

        # cleanup
        api.delete(
            f"{BASE_URL}/api/users/{USER_UID}/unfollow",
            json={"follower_uid": FOLLOWER_UID},
        )
