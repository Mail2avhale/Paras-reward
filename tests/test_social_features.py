"""
Test Social Networking Features for PARAS REWARD App
- Public Profile page
- Follow/Unfollow functionality
- Network Feed (Global and Following tabs)
- User search functionality
- Messaging system
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_UID = "900253b5-b917-4e6b-b26a-731b6fe112dd"
ADMIN_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"
TEST_USER_EMAIL = "testuser@test.com"
TEST_USER_PASSWORD = "Test123!"
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin123"


class TestPublicProfile:
    """Test Public Profile API endpoints"""
    
    def test_get_public_profile_success(self):
        """Test fetching a public profile"""
        response = requests.get(f"{BASE_URL}/api/users/{TEST_USER_UID}/public-profile")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "uid" in data
        assert "name" in data
        assert "followers_count" in data
        assert "following_count" in data
        assert "team_size" in data
        assert data["uid"] == TEST_USER_UID
        print(f"✓ Public profile fetched: {data.get('name')}, followers: {data.get('followers_count')}")
    
    def test_get_admin_public_profile(self):
        """Test fetching admin's public profile"""
        response = requests.get(f"{BASE_URL}/api/users/{ADMIN_UID}/public-profile")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["uid"] == ADMIN_UID
        assert "name" in data
        print(f"✓ Admin profile fetched: {data.get('name')}")
    
    def test_get_nonexistent_profile(self):
        """Test fetching a non-existent profile returns 404"""
        fake_uid = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/users/{fake_uid}/public-profile")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent profile returns 404")


class TestFollowSystem:
    """Test Follow/Unfollow functionality"""
    
    def test_follow_user(self):
        """Test following a user"""
        response = requests.post(
            f"{BASE_URL}/api/users/{ADMIN_UID}/follow",
            json={"follower_uid": TEST_USER_UID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "is_following" in data
        print(f"✓ Follow user: {data.get('message')}")
    
    def test_check_follow_status(self):
        """Test checking follow status"""
        response = requests.get(f"{BASE_URL}/api/users/{TEST_USER_UID}/check-follow/{ADMIN_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "is_following" in data
        print(f"✓ Check follow status: is_following={data.get('is_following')}")
    
    def test_cannot_follow_self(self):
        """Test that user cannot follow themselves"""
        response = requests.post(
            f"{BASE_URL}/api/users/{TEST_USER_UID}/follow",
            json={"follower_uid": TEST_USER_UID}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Cannot follow self - returns 400")
    
    def test_follow_without_follower_uid(self):
        """Test follow without follower_uid returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/users/{ADMIN_UID}/follow",
            json={}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Follow without follower_uid returns 400")
    
    def test_unfollow_user(self):
        """Test unfollowing a user"""
        # First follow
        requests.post(
            f"{BASE_URL}/api/users/{ADMIN_UID}/follow",
            json={"follower_uid": TEST_USER_UID}
        )
        
        # Then unfollow
        response = requests.delete(
            f"{BASE_URL}/api/users/{ADMIN_UID}/unfollow",
            json={"follower_uid": TEST_USER_UID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Unfollow user: {data.get('message')}")
    
    def test_get_followers_list(self):
        """Test getting followers list"""
        response = requests.get(f"{BASE_URL}/api/users/{ADMIN_UID}/followers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "followers" in data
        assert "total" in data
        assert isinstance(data["followers"], list)
        print(f"✓ Get followers: {data.get('total')} followers")
    
    def test_get_following_list(self):
        """Test getting following list"""
        response = requests.get(f"{BASE_URL}/api/users/{TEST_USER_UID}/following")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "following" in data
        assert "total" in data
        assert isinstance(data["following"], list)
        print(f"✓ Get following: {data.get('total')} following")


class TestNetworkFeed:
    """Test Network Feed API endpoints"""
    
    def test_get_global_feed(self):
        """Test fetching global activity feed"""
        response = requests.get(f"{BASE_URL}/api/feed/global?limit=20")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "activities" in data
        assert isinstance(data["activities"], list)
        print(f"✓ Global feed: {len(data.get('activities', []))} activities")
    
    def test_get_network_feed(self):
        """Test fetching network feed for a user"""
        response = requests.get(f"{BASE_URL}/api/feed/network/{TEST_USER_UID}?limit=20")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "activities" in data
        assert isinstance(data["activities"], list)
        print(f"✓ Network feed: {len(data.get('activities', []))} activities")
    
    def test_global_feed_pagination(self):
        """Test global feed pagination"""
        response = requests.get(f"{BASE_URL}/api/feed/global?page=1&limit=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "page" in data
        assert data["page"] == 1
        print("✓ Global feed pagination works")


class TestUserSearch:
    """Test User Search functionality"""
    
    def test_search_users_by_name(self):
        """Test searching users by name"""
        response = requests.get(f"{BASE_URL}/api/social/search-users?q=test&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "users" in data
        assert isinstance(data["users"], list)
        print(f"✓ Search users: {len(data.get('users', []))} results for 'test'")
    
    def test_search_users_short_query(self):
        """Test search with short query returns empty"""
        response = requests.get(f"{BASE_URL}/api/social/search-users?q=a&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("users") == []
        print("✓ Short query returns empty results")
    
    def test_get_suggested_users(self):
        """Test getting suggested users"""
        response = requests.get(f"{BASE_URL}/api/social/suggested-users/{TEST_USER_UID}?limit=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "suggested_users" in data
        assert isinstance(data["suggested_users"], list)
        print(f"✓ Suggested users: {len(data.get('suggested_users', []))} suggestions")


class TestMessaging:
    """Test Messaging System"""
    
    def test_get_conversations(self):
        """Test getting user's conversations"""
        response = requests.get(f"{BASE_URL}/api/messages/conversations/{TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "conversations" in data
        assert isinstance(data["conversations"], list)
        print(f"✓ Get conversations: {len(data.get('conversations', []))} conversations")
    
    def test_send_message(self):
        """Test sending a message"""
        test_message = f"Test message {uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/messages/send",
            json={
                "sender_uid": TEST_USER_UID,
                "receiver_uid": ADMIN_UID,
                "text": test_message
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "message_id" in data
        assert "conversation_id" in data
        print(f"✓ Send message: message_id={data.get('message_id')[:8]}...")
        
        return data.get("conversation_id")
    
    def test_send_message_without_required_fields(self):
        """Test sending message without required fields returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/messages/send",
            json={"sender_uid": TEST_USER_UID}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Send message without required fields returns 400")
    
    def test_cannot_message_self(self):
        """Test that user cannot message themselves"""
        response = requests.post(
            f"{BASE_URL}/api/messages/send",
            json={
                "sender_uid": TEST_USER_UID,
                "receiver_uid": TEST_USER_UID,
                "text": "Test"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Cannot message self - returns 400")
    
    def test_get_conversation_messages(self):
        """Test getting messages in a conversation"""
        # First send a message to create/update conversation
        send_response = requests.post(
            f"{BASE_URL}/api/messages/send",
            json={
                "sender_uid": TEST_USER_UID,
                "receiver_uid": ADMIN_UID,
                "text": "Test message for conversation"
            }
        )
        assert send_response.status_code == 200
        conversation_id = send_response.json().get("conversation_id")
        
        # Get messages
        response = requests.get(
            f"{BASE_URL}/api/messages/conversation/{conversation_id}?uid={TEST_USER_UID}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)
        assert len(data["messages"]) > 0
        print(f"✓ Get conversation messages: {len(data.get('messages', []))} messages")
    
    def test_get_unread_count(self):
        """Test getting unread message count"""
        response = requests.get(f"{BASE_URL}/api/messages/unread-count/{TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        print(f"✓ Unread count: {data.get('unread_count')}")


class TestPrivacySettings:
    """Test Privacy Settings"""
    
    def test_update_privacy_settings(self):
        """Test updating privacy settings"""
        response = requests.put(
            f"{BASE_URL}/api/users/{TEST_USER_UID}/privacy-settings",
            json={
                "is_public": True,
                "allow_messages": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print("✓ Privacy settings updated")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
