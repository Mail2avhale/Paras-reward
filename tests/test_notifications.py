"""
Test suite for In-App Push Notifications feature
Tests notification APIs for follow and message events

Endpoints tested:
- GET /api/notifications/{uid} - Get notifications list with pagination
- GET /api/notifications/{uid}/unread-count - Get unread count
- PUT /api/notifications/{notification_id}/read - Mark notification as read
- PUT /api/notifications/{uid}/read-all - Mark all notifications as read
- DELETE /api/notifications/{notification_id} - Delete a notification
- DELETE /api/notifications/{uid}/clear-all - Clear all notifications
- POST /api/users/{uid}/follow - Follow action creates notification
- POST /api/messages/send - Send message creates notification
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_UID = "900253b5-b917-4e6b-b26a-731b6fe112dd"
TEST_USER_EMAIL = "testuser@test.com"
ADMIN_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"
ADMIN_EMAIL = "admin@paras.com"


class TestNotificationAPIs:
    """Test notification CRUD operations"""
    
    def test_get_notifications_list(self):
        """Test GET /api/notifications/{uid} - Returns notifications list"""
        response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should contain 'notifications' key"
        assert "total" in data, "Response should contain 'total' key"
        assert "unread_count" in data, "Response should contain 'unread_count' key"
        assert "page" in data, "Response should contain 'page' key"
        assert "limit" in data, "Response should contain 'limit' key"
        
        # Verify notifications is a list
        assert isinstance(data["notifications"], list), "notifications should be a list"
        
        print(f"✅ GET notifications: {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_get_notifications_with_pagination(self):
        """Test GET /api/notifications/{uid} with pagination params"""
        response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}?page=1&limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 1, "Page should be 1"
        assert data["limit"] == 5, "Limit should be 5"
        assert len(data["notifications"]) <= 5, "Should return at most 5 notifications"
        
        print(f"✅ Pagination works: page={data['page']}, limit={data['limit']}")
    
    def test_get_notifications_unread_only(self):
        """Test GET /api/notifications/{uid} with unread_only filter"""
        response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}?unread_only=true")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned notifications should be unread
        for notification in data["notifications"]:
            assert notification.get("read") == False, "All notifications should be unread"
        
        print(f"✅ Unread filter works: {len(data['notifications'])} unread notifications")
    
    def test_get_unread_count(self):
        """Test GET /api/notifications/{uid}/unread-count"""
        response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}/unread-count")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "unread_count" in data, "Response should contain 'unread_count'"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        assert data["unread_count"] >= 0, "unread_count should be non-negative"
        
        print(f"✅ Unread count: {data['unread_count']}")
    
    def test_get_notifications_for_test_user(self):
        """Test GET /api/notifications/{uid} for test user"""
        response = requests.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "notifications" in data
        print(f"✅ Test user notifications: {len(data['notifications'])} total, {data['unread_count']} unread")


class TestFollowCreatesNotification:
    """Test that follow action creates notification for followed user"""
    
    def test_follow_creates_notification(self):
        """Test POST /api/users/{uid}/follow creates notification"""
        # First, get current notification count for admin
        before_response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        assert before_response.status_code == 200
        before_count = before_response.json()["total"]
        
        # Test user follows admin
        follow_response = requests.post(
            f"{BASE_URL}/api/users/{ADMIN_UID}/follow",
            json={"follower_uid": TEST_USER_UID}
        )
        
        assert follow_response.status_code == 200, f"Follow failed: {follow_response.text}"
        
        # Check if notification was created
        after_response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        assert after_response.status_code == 200
        after_data = after_response.json()
        
        # Look for the new follower notification
        notifications = after_data["notifications"]
        new_follower_notifications = [
            n for n in notifications 
            if n.get("type") == "new_follower" and n.get("from_uid") == TEST_USER_UID
        ]
        
        assert len(new_follower_notifications) > 0, "Should have created a new_follower notification"
        
        notification = new_follower_notifications[0]
        assert notification["title"] == "New Follower!", f"Title should be 'New Follower!', got {notification['title']}"
        assert "started following you" in notification["message"], "Message should mention 'started following you'"
        assert notification["icon"] == "👤", f"Icon should be '👤', got {notification['icon']}"
        assert notification["action_url"] == f"/profile/{TEST_USER_UID}", "Action URL should point to follower's profile"
        
        print(f"✅ Follow created notification: {notification['title']} - {notification['message']}")
        
        # Cleanup: unfollow
        requests.delete(
            f"{BASE_URL}/api/users/{ADMIN_UID}/unfollow",
            json={"follower_uid": TEST_USER_UID}
        )


class TestMessageCreatesNotification:
    """Test that sending a message creates notification for receiver"""
    
    def test_send_message_creates_notification(self):
        """Test POST /api/messages/send creates notification"""
        # Get current notification count for admin
        before_response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        assert before_response.status_code == 200
        
        # Test user sends message to admin
        test_message = f"Test notification message {uuid.uuid4().hex[:8]}"
        send_response = requests.post(
            f"{BASE_URL}/api/messages/send",
            json={
                "sender_uid": TEST_USER_UID,
                "receiver_uid": ADMIN_UID,
                "text": test_message
            }
        )
        
        assert send_response.status_code == 200, f"Send message failed: {send_response.text}"
        
        # Check if notification was created
        after_response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        assert after_response.status_code == 200
        after_data = after_response.json()
        
        # Look for the new message notification
        notifications = after_data["notifications"]
        new_message_notifications = [
            n for n in notifications 
            if n.get("type") == "new_message" and n.get("from_uid") == TEST_USER_UID
        ]
        
        assert len(new_message_notifications) > 0, "Should have created a new_message notification"
        
        notification = new_message_notifications[0]
        assert notification["title"] == "New Message", f"Title should be 'New Message', got {notification['title']}"
        assert notification["icon"] == "💬", f"Icon should be '💬', got {notification['icon']}"
        assert notification["action_url"] == f"/messages/{TEST_USER_UID}", "Action URL should point to sender's messages"
        
        print(f"✅ Message created notification: {notification['title']} - {notification['message']}")


class TestNotificationActions:
    """Test notification mark as read and delete operations"""
    
    @pytest.fixture(autouse=True)
    def setup_notification(self):
        """Create a test notification before each test"""
        # Send a message to create a notification
        test_message = f"Test for notification actions {uuid.uuid4().hex[:8]}"
        requests.post(
            f"{BASE_URL}/api/messages/send",
            json={
                "sender_uid": TEST_USER_UID,
                "receiver_uid": ADMIN_UID,
                "text": test_message
            }
        )
        yield
    
    def test_mark_notification_as_read(self):
        """Test PUT /api/notifications/{notification_id}/read"""
        # Get an unread notification
        response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}?unread_only=true")
        assert response.status_code == 200
        
        notifications = response.json()["notifications"]
        if not notifications:
            pytest.skip("No unread notifications to test")
        
        notification_id = notifications[0]["notification_id"]
        
        # Mark as read
        mark_response = requests.put(f"{BASE_URL}/api/notifications/{notification_id}/read")
        assert mark_response.status_code == 200, f"Mark as read failed: {mark_response.text}"
        
        data = mark_response.json()
        assert data["success"] == True, "Response should indicate success"
        
        # Verify it's marked as read
        verify_response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        verify_data = verify_response.json()
        
        marked_notification = next(
            (n for n in verify_data["notifications"] if n["notification_id"] == notification_id),
            None
        )
        
        if marked_notification:
            assert marked_notification["read"] == True, "Notification should be marked as read"
        
        print(f"✅ Marked notification {notification_id} as read")
    
    def test_mark_all_notifications_read(self):
        """Test PUT /api/notifications/{uid}/read-all"""
        # First ensure there are some unread notifications
        before_response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}/unread-count")
        before_count = before_response.json()["unread_count"]
        
        # Mark all as read
        mark_response = requests.put(f"{BASE_URL}/api/notifications/{ADMIN_UID}/read-all")
        assert mark_response.status_code == 200, f"Mark all as read failed: {mark_response.text}"
        
        data = mark_response.json()
        assert data["success"] == True, "Response should indicate success"
        assert "marked_count" in data, "Response should contain marked_count"
        
        # Verify all are read
        after_response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}/unread-count")
        after_count = after_response.json()["unread_count"]
        
        assert after_count == 0, f"All notifications should be read, but {after_count} are unread"
        
        print(f"✅ Marked all notifications as read (marked {data['marked_count']})")
    
    def test_delete_notification(self):
        """Test DELETE /api/notifications/{notification_id}"""
        # Get a notification to delete
        response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        assert response.status_code == 200
        
        notifications = response.json()["notifications"]
        if not notifications:
            pytest.skip("No notifications to delete")
        
        notification_id = notifications[0]["notification_id"]
        before_total = response.json()["total"]
        
        # Delete the notification
        delete_response = requests.delete(f"{BASE_URL}/api/notifications/{notification_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        data = delete_response.json()
        assert data["success"] == True, "Response should indicate success"
        
        # Verify it's deleted
        verify_response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        after_total = verify_response.json()["total"]
        
        assert after_total == before_total - 1, "Total should decrease by 1"
        
        deleted_notification = next(
            (n for n in verify_response.json()["notifications"] if n["notification_id"] == notification_id),
            None
        )
        assert deleted_notification is None, "Notification should be deleted"
        
        print(f"✅ Deleted notification {notification_id}")
    
    def test_delete_nonexistent_notification(self):
        """Test DELETE /api/notifications/{notification_id} with invalid ID"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/notifications/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404 for nonexistent notification, got {response.status_code}"
        print(f"✅ Correctly returns 404 for nonexistent notification")
    
    def test_clear_all_notifications(self):
        """Test DELETE /api/notifications/{uid}/clear-all"""
        # First create some notifications by sending messages
        for i in range(3):
            requests.post(
                f"{BASE_URL}/api/messages/send",
                json={
                    "sender_uid": TEST_USER_UID,
                    "receiver_uid": ADMIN_UID,
                    "text": f"Test clear all {i}"
                }
            )
        
        # Clear all notifications
        clear_response = requests.delete(f"{BASE_URL}/api/notifications/{ADMIN_UID}/clear-all")
        assert clear_response.status_code == 200, f"Clear all failed: {clear_response.text}"
        
        data = clear_response.json()
        assert data["success"] == True, "Response should indicate success"
        assert "deleted_count" in data, "Response should contain deleted_count"
        
        # Verify all are cleared
        verify_response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        verify_data = verify_response.json()
        
        assert verify_data["total"] == 0, f"All notifications should be cleared, but {verify_data['total']} remain"
        
        print(f"✅ Cleared all notifications (deleted {data['deleted_count']})")


class TestNotificationStructure:
    """Test notification data structure and fields"""
    
    def test_notification_has_required_fields(self):
        """Test that notifications have all required fields"""
        # Create a notification by following
        requests.post(
            f"{BASE_URL}/api/users/{ADMIN_UID}/follow",
            json={"follower_uid": TEST_USER_UID}
        )
        
        # Get notifications
        response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        assert response.status_code == 200
        
        notifications = response.json()["notifications"]
        if not notifications:
            pytest.skip("No notifications to verify structure")
        
        notification = notifications[0]
        
        # Check required fields
        required_fields = [
            "notification_id", "user_uid", "type", "title", 
            "message", "read", "created_at"
        ]
        
        for field in required_fields:
            assert field in notification, f"Notification should have '{field}' field"
        
        # Check optional fields for social notifications
        if notification["type"] in ["new_follower", "new_message"]:
            assert "from_uid" in notification, "Social notification should have 'from_uid'"
            assert "icon" in notification, "Social notification should have 'icon'"
            assert "action_url" in notification, "Social notification should have 'action_url'"
        
        print(f"✅ Notification has all required fields: {list(notification.keys())}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{ADMIN_UID}/unfollow",
            json={"follower_uid": TEST_USER_UID}
        )


class TestNotificationTypes:
    """Test different notification types"""
    
    def test_new_follower_notification_type(self):
        """Test new_follower notification type"""
        # Follow to create notification
        requests.post(
            f"{BASE_URL}/api/users/{ADMIN_UID}/follow",
            json={"follower_uid": TEST_USER_UID}
        )
        
        response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        notifications = response.json()["notifications"]
        
        follower_notifications = [n for n in notifications if n["type"] == "new_follower"]
        assert len(follower_notifications) > 0, "Should have new_follower notifications"
        
        notification = follower_notifications[0]
        assert notification["type"] == "new_follower"
        assert notification["icon"] == "👤"
        
        print(f"✅ new_follower notification type verified")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{ADMIN_UID}/unfollow",
            json={"follower_uid": TEST_USER_UID}
        )
    
    def test_new_message_notification_type(self):
        """Test new_message notification type"""
        # Send message to create notification
        requests.post(
            f"{BASE_URL}/api/messages/send",
            json={
                "sender_uid": TEST_USER_UID,
                "receiver_uid": ADMIN_UID,
                "text": "Test message notification type"
            }
        )
        
        response = requests.get(f"{BASE_URL}/api/notifications/{ADMIN_UID}")
        notifications = response.json()["notifications"]
        
        message_notifications = [n for n in notifications if n["type"] == "new_message"]
        assert len(message_notifications) > 0, "Should have new_message notifications"
        
        notification = message_notifications[0]
        assert notification["type"] == "new_message"
        assert notification["icon"] == "💬"
        
        print(f"✅ new_message notification type verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
