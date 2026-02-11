"""
Notification System API Tests
Tests for notification CRUD operations, send, broadcast functionality

Endpoints tested:
- GET /api/notifications/{uid} - Get user notifications
- GET /api/notifications/{uid}/unread-count - Get unread count  
- PUT /api/notifications/{notification_id}/read - Mark notification as read
- PUT /api/notifications/{uid}/read-all - Mark all as read
- DELETE /api/notifications/{notification_id} - Delete notification
- POST /api/notifications/send - Send notification to user
- POST /api/notifications/broadcast - Broadcast to all users
"""

import pytest
import requests
import os
import uuid

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user UID provided by main agent
TEST_USER_UID = "USR90a2c37d"

class TestNotificationAPIs:
    """Test notification API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_notification_ids = []
    
    def teardown_method(self, method):
        """Cleanup created notifications after each test"""
        for notif_id in self.created_notification_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/notifications/{notif_id}")
            except:
                pass
    
    # ========== GET /api/notifications/{uid} ==========
    def test_get_user_notifications(self):
        """Test fetching user notifications"""
        response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should contain 'notifications' field"
        assert "unread_count" in data, "Response should contain 'unread_count' field"
        assert "total" in data, "Response should contain 'total' field"
        assert isinstance(data["notifications"], list), "notifications should be a list"
        
        print(f"✓ GET /api/notifications/{TEST_USER_UID} - Found {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_get_notifications_with_pagination(self):
        """Test notifications pagination"""
        response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}?page=1&limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "page" in data, "Response should contain 'page' field"
        assert "limit" in data, "Response should contain 'limit' field"
        assert data["page"] == 1, "Page should be 1"
        assert data["limit"] == 5, "Limit should be 5"
        
        print(f"✓ GET notifications with pagination - page={data['page']}, limit={data['limit']}")
    
    def test_get_notifications_unread_only(self):
        """Test fetching only unread notifications"""
        response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}?unread_only=true")
        
        assert response.status_code == 200
        data = response.json()
        
        # All notifications in list should be unread
        for notif in data.get("notifications", []):
            assert notif.get("read") == False, "Unread filter should only return unread notifications"
        
        print(f"✓ GET notifications with unread_only filter - {len(data['notifications'])} unread notifications")
    
    # ========== GET /api/notifications/{uid}/unread-count ==========
    def test_get_unread_count(self):
        """Test getting unread notification count"""
        response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}/unread-count")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "unread_count" in data, "Response should contain 'unread_count' field"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        assert data["unread_count"] >= 0, "unread_count should be non-negative"
        
        print(f"✓ GET /api/notifications/{TEST_USER_UID}/unread-count - {data['unread_count']} unread")
    
    def test_get_unread_count_nonexistent_user(self):
        """Test unread count for non-existent user - should return 0"""
        fake_uid = f"FAKE_{uuid.uuid4().hex[:8]}"
        response = self.session.get(f"{BASE_URL}/api/notifications/{fake_uid}/unread-count")
        
        assert response.status_code == 200, "Should return 200 even for non-existent user"
        data = response.json()
        assert data["unread_count"] == 0, "Non-existent user should have 0 unread notifications"
        
        print(f"✓ GET unread count for non-existent user - returns 0")
    
    # ========== POST /api/notifications/send ==========
    def test_send_notification_to_user(self):
        """Test sending a notification to a specific user"""
        payload = {
            "user_uid": TEST_USER_UID,
            "title": "TEST_Notification Title",
            "message": "This is a test notification message",
            "type": "system",
            "icon": "🔔"
        }
        
        response = self.session.post(f"{BASE_URL}/api/notifications/send", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "notification_id" in data, "Response should contain notification_id"
        
        # Store for cleanup
        self.created_notification_ids.append(data["notification_id"])
        
        print(f"✓ POST /api/notifications/send - Notification sent with ID: {data['notification_id']}")
        
        # Verify notification was created by fetching it
        verify_response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}?limit=50")
        assert verify_response.status_code == 200
        notifications = verify_response.json().get("notifications", [])
        
        found = False
        for notif in notifications:
            if notif.get("notification_id") == data["notification_id"]:
                found = True
                assert notif.get("title") == payload["title"], "Title should match"
                assert notif.get("message") == payload["message"], "Message should match"
                assert notif.get("read") == False, "New notification should be unread"
                break
        
        assert found, "Created notification should be retrievable"
        print(f"✓ Created notification verified in user's notifications list")
    
    def test_send_notification_without_user_uid(self):
        """Test sending notification without user_uid - should fail"""
        payload = {
            "title": "TEST_Notification Title",
            "message": "This is a test notification message"
        }
        
        response = self.session.post(f"{BASE_URL}/api/notifications/send", json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        print(f"✓ POST send without user_uid correctly returns 400")
    
    def test_send_notification_with_action_url(self):
        """Test sending notification with action_url"""
        payload = {
            "user_uid": TEST_USER_UID,
            "title": "TEST_Action Notification",
            "message": "Click to view order",
            "type": "order",
            "action_url": "/orders/123"
        }
        
        response = self.session.post(f"{BASE_URL}/api/notifications/send", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        self.created_notification_ids.append(data["notification_id"])
        
        # Verify action_url was saved
        verify_response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}?limit=50")
        notifications = verify_response.json().get("notifications", [])
        
        found_notif = None
        for notif in notifications:
            if notif.get("notification_id") == data["notification_id"]:
                found_notif = notif
                break
        
        assert found_notif is not None, "Notification should exist"
        assert found_notif.get("action_url") == "/orders/123", "action_url should be saved"
        
        print(f"✓ POST send with action_url - saved correctly")
    
    # ========== PUT /api/notifications/{notification_id}/read ==========
    def test_mark_notification_as_read(self):
        """Test marking a notification as read"""
        # First create a notification
        create_response = self.session.post(f"{BASE_URL}/api/notifications/send", json={
            "user_uid": TEST_USER_UID,
            "title": "TEST_Read Test",
            "message": "Testing mark as read"
        })
        assert create_response.status_code == 200
        notification_id = create_response.json()["notification_id"]
        self.created_notification_ids.append(notification_id)
        
        # Mark as read
        response = self.session.put(f"{BASE_URL}/api/notifications/{notification_id}/read")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        
        # Verify it was marked as read
        verify_response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}?limit=50")
        notifications = verify_response.json().get("notifications", [])
        
        found_notif = None
        for notif in notifications:
            if notif.get("notification_id") == notification_id:
                found_notif = notif
                break
        
        assert found_notif is not None, "Notification should exist"
        assert found_notif.get("read") == True, "Notification should be marked as read"
        
        print(f"✓ PUT /api/notifications/{notification_id}/read - marked as read successfully")
    
    def test_mark_nonexistent_notification_as_read(self):
        """Test marking non-existent notification as read - should return 404"""
        fake_id = f"fake_{uuid.uuid4().hex[:16]}"
        response = self.session.put(f"{BASE_URL}/api/notifications/{fake_id}/read")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"✓ PUT mark non-existent notification correctly returns 404")
    
    # ========== PUT /api/notifications/{uid}/read-all ==========
    def test_mark_all_notifications_as_read(self):
        """Test marking all notifications as read for a user"""
        # Create multiple notifications
        for i in range(3):
            create_response = self.session.post(f"{BASE_URL}/api/notifications/send", json={
                "user_uid": TEST_USER_UID,
                "title": f"TEST_Batch {i}",
                "message": f"Batch notification {i}"
            })
            if create_response.status_code == 200:
                self.created_notification_ids.append(create_response.json()["notification_id"])
        
        # Mark all as read
        response = self.session.put(f"{BASE_URL}/api/notifications/{TEST_USER_UID}/read-all")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "marked_count" in data, "Response should contain marked_count"
        
        # Verify unread count is now 0
        unread_response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}/unread-count")
        assert unread_response.json()["unread_count"] == 0, "All notifications should be read now"
        
        print(f"✓ PUT /api/notifications/{TEST_USER_UID}/read-all - marked {data.get('marked_count')} as read")
    
    # ========== DELETE /api/notifications/{notification_id} ==========
    def test_delete_notification(self):
        """Test deleting a notification"""
        # First create a notification
        create_response = self.session.post(f"{BASE_URL}/api/notifications/send", json={
            "user_uid": TEST_USER_UID,
            "title": "TEST_Delete Me",
            "message": "This notification will be deleted"
        })
        assert create_response.status_code == 200
        notification_id = create_response.json()["notification_id"]
        
        # Delete it
        response = self.session.delete(f"{BASE_URL}/api/notifications/{notification_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        
        # Verify it's deleted
        verify_response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}?limit=50")
        notifications = verify_response.json().get("notifications", [])
        
        for notif in notifications:
            assert notif.get("notification_id") != notification_id, "Deleted notification should not exist"
        
        print(f"✓ DELETE /api/notifications/{notification_id} - deleted successfully")
    
    def test_delete_nonexistent_notification(self):
        """Test deleting non-existent notification - should return 404"""
        fake_id = f"fake_{uuid.uuid4().hex[:16]}"
        response = self.session.delete(f"{BASE_URL}/api/notifications/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"✓ DELETE non-existent notification correctly returns 404")
    
    # ========== POST /api/notifications/broadcast ==========
    def test_broadcast_notification(self):
        """Test broadcasting notification to all users"""
        payload = {
            "title": "TEST_Broadcast Announcement",
            "message": "This is a test broadcast message",
            "type": "announcement",
            "icon": "📢"
        }
        
        response = self.session.post(f"{BASE_URL}/api/notifications/broadcast", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "sent_count" in data, "Response should contain sent_count"
        assert data["sent_count"] > 0, "Should have sent to at least one user"
        
        print(f"✓ POST /api/notifications/broadcast - sent to {data['sent_count']} users")
        
        # Verify test user received it
        verify_response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}?limit=5")
        notifications = verify_response.json().get("notifications", [])
        
        found = False
        for notif in notifications:
            if notif.get("title") == payload["title"] and notif.get("type") == "announcement":
                found = True
                self.created_notification_ids.append(notif.get("notification_id"))
                break
        
        assert found, "Test user should have received broadcast notification"
        print(f"✓ Broadcast notification verified in test user's notifications")
    
    def test_broadcast_to_specific_plan(self):
        """Test broadcasting to users of a specific subscription plan"""
        payload = {
            "title": "TEST_Elite Only Broadcast",
            "message": "This is for elite users only",
            "type": "announcement",
            "target_plan": "elite"
        }
        
        response = self.session.post(f"{BASE_URL}/api/notifications/broadcast", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        print(f"✓ POST broadcast to specific plan - sent to {data.get('sent_count', 0)} elite users")


class TestNotificationFields:
    """Test notification data structure and fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_notification_has_required_fields(self):
        """Test that notifications have all required fields"""
        # Create a notification
        create_response = self.session.post(f"{BASE_URL}/api/notifications/send", json={
            "user_uid": TEST_USER_UID,
            "title": "TEST_Field Check",
            "message": "Testing notification fields",
            "type": "system",
            "icon": "🔔"
        })
        assert create_response.status_code == 200
        notification_id = create_response.json()["notification_id"]
        
        # Fetch and check fields
        response = self.session.get(f"{BASE_URL}/api/notifications/{TEST_USER_UID}?limit=50")
        notifications = response.json().get("notifications", [])
        
        found_notif = None
        for notif in notifications:
            if notif.get("notification_id") == notification_id:
                found_notif = notif
                break
        
        assert found_notif is not None, "Created notification should exist"
        
        # Check required fields
        required_fields = ["notification_id", "title", "message", "type", "created_at", "read"]
        for field in required_fields:
            assert field in found_notif, f"Notification should have '{field}' field"
        
        # Check user_uid or user_id is present (for API compatibility)
        assert found_notif.get("user_uid") or found_notif.get("user_id"), "Should have user_uid or user_id"
        
        print(f"✓ Notification has all required fields: {required_fields}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/notifications/{notification_id}")


class TestNotificationEdgeCases:
    """Test edge cases for notification API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_empty_notification_list(self):
        """Test getting notifications for user with no notifications"""
        # Use a unique fake uid
        fake_uid = f"TEST_EMPTY_{uuid.uuid4().hex[:8]}"
        response = self.session.get(f"{BASE_URL}/api/notifications/{fake_uid}")
        
        assert response.status_code == 200, f"Should return 200 even with no notifications"
        data = response.json()
        
        assert data.get("notifications") == [], "Should return empty list"
        assert data.get("unread_count") == 0, "unread_count should be 0"
        assert data.get("total") == 0, "total should be 0"
        
        print(f"✓ Empty notification list handled correctly")
    
    def test_notification_types(self):
        """Test various notification types"""
        notification_types = ["system", "order", "mining", "referral", "withdrawal", "announcement"]
        created_ids = []
        
        for ntype in notification_types:
            response = self.session.post(f"{BASE_URL}/api/notifications/send", json={
                "user_uid": TEST_USER_UID,
                "title": f"TEST_{ntype} notification",
                "message": f"Testing {ntype} type",
                "type": ntype
            })
            
            assert response.status_code == 200, f"Should accept type: {ntype}"
            created_ids.append(response.json()["notification_id"])
            print(f"  ✓ Type '{ntype}' accepted")
        
        print(f"✓ All notification types work correctly")
        
        # Cleanup
        for nid in created_ids:
            self.session.delete(f"{BASE_URL}/api/notifications/{nid}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
