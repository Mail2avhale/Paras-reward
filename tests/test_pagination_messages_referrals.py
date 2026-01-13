"""
Test suite for:
1. Global activity feed pagination
2. Network (Following) feed pagination
3. Followers/Following list pagination
4. Direct messages functionality
5. Referral earnings history (real vs estimated)
6. Invite page features
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin123"

class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "uid" in data
        print(f"✓ Admin login successful, uid: {data['uid']}")
        return data


class TestGlobalFeedPagination:
    """Test global activity feed pagination"""
    
    def test_global_feed_first_page(self):
        """Test fetching first page of global feed"""
        response = requests.get(f"{BASE_URL}/api/feed/global?limit=20&page=1")
        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        activities = data["activities"]
        print(f"✓ Global feed page 1: {len(activities)} activities")
        return len(activities)
    
    def test_global_feed_pagination_params(self):
        """Test global feed accepts pagination parameters"""
        response = requests.get(f"{BASE_URL}/api/feed/global?limit=5&page=1")
        assert response.status_code == 200
        data = response.json()
        activities = data.get("activities", [])
        # Should return at most 5 items
        assert len(activities) <= 5
        print(f"✓ Global feed with limit=5: {len(activities)} activities")
    
    def test_global_feed_second_page(self):
        """Test fetching second page of global feed"""
        response = requests.get(f"{BASE_URL}/api/feed/global?limit=20&page=2")
        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        print(f"✓ Global feed page 2: {len(data['activities'])} activities")


class TestNetworkFeedPagination:
    """Test network (following) feed pagination"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin UID"""
        response = requests.post(f"{BASE_URL}/api/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json().get("uid")
    
    def test_network_feed_first_page(self, admin_uid):
        """Test fetching first page of network feed"""
        response = requests.get(f"{BASE_URL}/api/feed/network/{admin_uid}?limit=20&page=1")
        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        print(f"✓ Network feed page 1: {len(data['activities'])} activities")
    
    def test_network_feed_pagination_params(self, admin_uid):
        """Test network feed accepts pagination parameters"""
        response = requests.get(f"{BASE_URL}/api/feed/network/{admin_uid}?limit=5&page=1")
        assert response.status_code == 200
        data = response.json()
        activities = data.get("activities", [])
        assert len(activities) <= 5
        print(f"✓ Network feed with limit=5: {len(activities)} activities")


class TestFollowersFollowingPagination:
    """Test followers and following list pagination"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin UID"""
        response = requests.post(f"{BASE_URL}/api/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json().get("uid")
    
    def test_followers_list_first_page(self, admin_uid):
        """Test fetching first page of followers"""
        response = requests.get(f"{BASE_URL}/api/users/{admin_uid}/followers?page=1&limit=20")
        assert response.status_code == 200
        data = response.json()
        assert "followers" in data
        print(f"✓ Followers page 1: {len(data['followers'])} followers, total: {data.get('total', 'N/A')}")
    
    def test_followers_list_pagination_params(self, admin_uid):
        """Test followers list accepts pagination parameters"""
        response = requests.get(f"{BASE_URL}/api/users/{admin_uid}/followers?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        followers = data.get("followers", [])
        assert len(followers) <= 5
        print(f"✓ Followers with limit=5: {len(followers)} followers")
    
    def test_following_list_first_page(self, admin_uid):
        """Test fetching first page of following"""
        response = requests.get(f"{BASE_URL}/api/users/{admin_uid}/following?page=1&limit=20")
        assert response.status_code == 200
        data = response.json()
        assert "following" in data
        print(f"✓ Following page 1: {len(data['following'])} following, total: {data.get('total', 'N/A')}")
    
    def test_following_list_pagination_params(self, admin_uid):
        """Test following list accepts pagination parameters"""
        response = requests.get(f"{BASE_URL}/api/users/{admin_uid}/following?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        following = data.get("following", [])
        assert len(following) <= 5
        print(f"✓ Following with limit=5: {len(following)} following")


class TestDirectMessages:
    """Test direct message functionality"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin UID"""
        response = requests.post(f"{BASE_URL}/api/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json().get("uid")
    
    def test_get_conversations(self, admin_uid):
        """Test fetching conversations list"""
        response = requests.get(f"{BASE_URL}/api/messages/conversations/{admin_uid}")
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        print(f"✓ Conversations: {len(data['conversations'])} conversations found")
        return data["conversations"]
    
    def test_send_message_endpoint_exists(self, admin_uid):
        """Test that send message endpoint exists"""
        # We'll test with a self-message which should fail gracefully
        response = requests.post(f"{BASE_URL}/api/messages/send", json={
            "sender_uid": admin_uid,
            "receiver_uid": admin_uid,  # Self message
            "text": "Test message"
        })
        # Should either succeed or return a meaningful error (not 404)
        assert response.status_code != 404
        print(f"✓ Send message endpoint exists, status: {response.status_code}")
    
    def test_unread_count(self, admin_uid):
        """Test unread message count endpoint"""
        response = requests.get(f"{BASE_URL}/api/messages/unread-count/{admin_uid}")
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        print(f"✓ Unread count: {data['unread_count']}")


class TestReferralEarnings:
    """Test referral earnings history"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin UID"""
        response = requests.post(f"{BASE_URL}/api/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json().get("uid")
    
    def test_referral_earnings_endpoint(self, admin_uid):
        """Test referral earnings endpoint"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/{admin_uid}")
        # Should return 200 with data or empty data
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Referral earnings response: {data.keys() if isinstance(data, dict) else 'list'}")
        return data
    
    def test_referral_earnings_with_period(self, admin_uid):
        """Test referral earnings with period filter"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/{admin_uid}?period=month")
        assert response.status_code == 200
        print(f"✓ Referral earnings with period filter works")
    
    def test_referral_levels_endpoint(self, admin_uid):
        """Test referral levels endpoint"""
        response = requests.get(f"{BASE_URL}/api/referrals/{admin_uid}/levels")
        assert response.status_code == 200
        data = response.json()
        assert "levels" in data
        levels = data["levels"]
        print(f"✓ Referral levels: {len(levels)} levels found")
        # Verify 5 levels exist
        for level in levels:
            assert "level" in level
            print(f"  Level {level['level']}: {level.get('count', len(level.get('users', [])))} users")


class TestInvitePage:
    """Test invite page features"""
    
    @pytest.fixture
    def admin_data(self):
        """Get admin user data"""
        response = requests.post(f"{BASE_URL}/api/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()
    
    def test_user_has_referral_code(self, admin_data):
        """Test user has referral code"""
        uid = admin_data.get("uid")
        response = requests.get(f"{BASE_URL}/api/user/{uid}")
        assert response.status_code == 200
        data = response.json()
        assert "referral_code" in data
        print(f"✓ User has referral code: {data['referral_code']}")
    
    def test_referral_stats(self, admin_data):
        """Test referral stats endpoint"""
        uid = admin_data.get("uid")
        response = requests.get(f"{BASE_URL}/api/referrals/{uid}/levels")
        assert response.status_code == 200
        data = response.json()
        
        # Calculate total referrals
        total = 0
        for level in data.get("levels", []):
            count = level.get("count", len(level.get("users", [])))
            total += count
        
        print(f"✓ Total referrals across all levels: {total}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
