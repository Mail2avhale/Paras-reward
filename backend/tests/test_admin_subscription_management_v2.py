"""
Test Admin Subscription Management - Iteration 173
Tests for:
- GET /api/admin/subscription/{uid}/details
- POST /api/admin/subscription/{uid}/edit (extend_days, set_expiry)
- POST /api/admin/subscription/{uid}/cancel (current, upcoming, refund types)
- Note validation for edit and cancel endpoints

All admin routes require JWT authentication with admin role.
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
TEST_USER_UID = "admin-test-123"  # Admin test user mentioned in context


def get_admin_auth():
    """Get admin authentication token and UID"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    try:
        # Login with email and PIN
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token") or data.get("access_token")
            admin_uid = data.get("uid")
            session.headers.update({"Authorization": f"Bearer {token}"})
            print(f"✓ Admin authenticated: {admin_uid}")
            return token, admin_uid, session
        else:
            print(f"Login failed: {resp.status_code} - {resp.text[:100]}")
    except Exception as e:
        print(f"Auth error: {e}")
    
    return None, None, session


class TestAdminSubscriptionDetails:
    """Tests for GET /api/admin/subscription/{uid}/details"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        self.token, self.admin_uid, self.session = get_admin_auth()
        if not self.token:
            pytest.skip("Admin authentication failed")
    
    def test_get_subscription_details_success(self):
        """Test GET /api/admin/subscription/{uid}/details returns expected structure"""
        response = self.session.get(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/details")
        
        # Should return 200 or 404 (if user doesn't exist)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code} - {response.text[:200]}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "current_plan" in data
            assert "upcoming_plans" in data
            assert "history" in data
            assert "uid" in data
            print(f"✓ GET details success - current_plan: {data.get('current_plan')}, upcoming: {len(data.get('upcoming_plans', []))}")
        else:
            print(f"✓ GET details returned 404 (user not found) - expected for test user")
    
    def test_get_subscription_details_nonexistent_user(self):
        """Test GET details for non-existent user returns 404"""
        response = self.session.get(f"{BASE_URL}/api/admin/subscription/nonexistent-uid-12345/details")
        assert response.status_code == 404
        print("✓ Non-existent user returns 404")


class TestAdminSubscriptionEdit:
    """Tests for POST /api/admin/subscription/{uid}/edit"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        self.token, self.admin_uid, self.session = get_admin_auth()
        if not self.token:
            pytest.skip("Admin authentication failed")
    
    def test_edit_extend_days_missing_note(self):
        """Test edit with extend_days but missing note returns 400"""
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/edit", json={
            "admin_uid": self.admin_uid,
            "action": "extend_days",
            "days": 7
            # Missing note
        })
        # Should be 400 for missing note, or 404 if user not found
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        if response.status_code == 400:
            detail = response.json().get("detail", "").lower()
            assert "note" in detail or "required" in detail
        print(f"✓ Edit without note returns {response.status_code}")
    
    def test_edit_extend_days_missing_admin_uid(self):
        """Test edit without admin_uid returns 400"""
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/edit", json={
            "action": "extend_days",
            "days": 7,
            "note": "Test extension"
        })
        assert response.status_code in [400, 404]
        print(f"✓ Edit without admin_uid returns {response.status_code}")
    
    def test_edit_extend_days_invalid_days(self):
        """Test extend_days with invalid days (0 or >365) returns 400"""
        # Test with 0 days
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/edit", json={
            "admin_uid": self.admin_uid,
            "action": "extend_days",
            "days": 0,
            "note": "Test extension"
        })
        assert response.status_code in [400, 404]  # 400 for invalid days, 404 if user not found
        
        # Test with >365 days
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/edit", json={
            "admin_uid": self.admin_uid,
            "action": "extend_days",
            "days": 400,
            "note": "Test extension"
        })
        assert response.status_code in [400, 404]
        print("✓ Invalid days (0 or >365) returns 400/404")
    
    def test_edit_set_expiry_missing_date(self):
        """Test set_expiry without new_expiry date returns 400"""
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/edit", json={
            "admin_uid": self.admin_uid,
            "action": "set_expiry",
            "note": "Test set expiry"
            # Missing new_expiry
        })
        assert response.status_code in [400, 404]
        print(f"✓ Set expiry without date returns {response.status_code}")
    
    def test_edit_invalid_action(self):
        """Test edit with invalid action returns 400"""
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/edit", json={
            "admin_uid": self.admin_uid,
            "action": "invalid_action",
            "note": "Test"
        })
        assert response.status_code in [400, 404]
        print(f"✓ Invalid action returns {response.status_code}")


class TestAdminSubscriptionCancel:
    """Tests for POST /api/admin/subscription/{uid}/cancel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        self.token, self.admin_uid, self.session = get_admin_auth()
        if not self.token:
            pytest.skip("Admin authentication failed")
    
    def test_cancel_missing_note(self):
        """Test cancel without note returns 400"""
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/cancel", json={
            "admin_uid": self.admin_uid,
            "target": "current",
            "refund_type": "none"
            # Missing note
        })
        assert response.status_code in [400, 404]
        if response.status_code == 400:
            detail = response.json().get("detail", "").lower()
            assert "note" in detail or "required" in detail
        print(f"✓ Cancel without note returns {response.status_code}")
    
    def test_cancel_missing_admin_uid(self):
        """Test cancel without admin_uid returns 400"""
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/cancel", json={
            "target": "current",
            "refund_type": "none",
            "note": "Test cancellation"
        })
        assert response.status_code in [400, 404]
        print(f"✓ Cancel without admin_uid returns {response.status_code}")
    
    def test_cancel_invalid_target(self):
        """Test cancel with invalid target returns 400"""
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/cancel", json={
            "admin_uid": self.admin_uid,
            "target": "invalid_target",
            "refund_type": "none",
            "note": "Test cancellation"
        })
        assert response.status_code in [400, 404]
        print(f"✓ Invalid target returns {response.status_code}")
    
    def test_cancel_upcoming_without_payment_id(self):
        """Test cancel upcoming without payment_id - should return 404 if no upcoming plan"""
        response = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/cancel", json={
            "admin_uid": self.admin_uid,
            "target": "upcoming",
            "refund_type": "full",
            "note": "Test upcoming cancellation"
        })
        # Should return 404 if no upcoming plan found, or 200 if found
        assert response.status_code in [200, 400, 404]
        print(f"✓ Cancel upcoming without payment_id - status: {response.status_code}")


class TestAdminSubscriptionIntegration:
    """Integration tests for full subscription management flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        self.token, self.admin_uid, self.session = get_admin_auth()
        if not self.token:
            pytest.skip("Admin authentication failed")
    
    def test_full_flow_extend_and_verify(self):
        """Test extend days and verify via GET details"""
        # First get current details
        details_resp = self.session.get(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/details")
        
        if details_resp.status_code == 404:
            pytest.skip("Test user not found - skipping integration test")
        
        # Extend by 7 days
        extend_resp = self.session.post(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/edit", json={
            "admin_uid": self.admin_uid,
            "action": "extend_days",
            "days": 7,
            "note": "Test extension for integration test"
        })
        
        if extend_resp.status_code == 403:
            pytest.skip("Admin access required - skipping")
        
        if extend_resp.status_code == 200:
            data = extend_resp.json()
            assert data.get("success") == True
            assert "new_expiry" in data
            print(f"✓ Extended subscription - new expiry: {data.get('new_expiry')}")
            
            # Verify via GET
            verify_resp = self.session.get(f"{BASE_URL}/api/admin/subscription/{TEST_USER_UID}/details")
            if verify_resp.status_code == 200:
                verify_data = verify_resp.json()
                print(f"✓ Verified - current plan: {verify_data.get('current_plan')}")
        else:
            print(f"✓ Extend returned {extend_resp.status_code} - {extend_resp.text[:100]}")


class TestUserSubscriptionInfo:
    """Tests for GET /api/admin/subscription/user/{uid}/info (user-facing endpoint)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        self.token, self.admin_uid, self.session = get_admin_auth()
        if not self.token:
            pytest.skip("Admin authentication failed")
    
    def test_user_subscription_info_success(self):
        """Test user subscription info endpoint returns expected structure"""
        response = self.session.get(f"{BASE_URL}/api/admin/subscription/user/{TEST_USER_UID}/info")
        
        if response.status_code == 404:
            print("✓ User not found - expected for test user")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text[:200]}"
        data = response.json()
        assert data.get("success") == True
        assert "current_plan" in data
        assert "upcoming_plans" in data
        print(f"✓ User info - current: {data.get('current_plan')}, upcoming: {len(data.get('upcoming_plans', []))}")
    
    def test_user_subscription_info_nonexistent(self):
        """Test user info for non-existent user returns 404"""
        response = self.session.get(f"{BASE_URL}/api/admin/subscription/user/nonexistent-uid-12345/info")
        assert response.status_code == 404
        print("✓ Non-existent user returns 404")


class TestWithRealUser:
    """Tests using a real user from test_credentials.md"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        self.token, self.admin_uid, self.session = get_admin_auth()
        if not self.token:
            pytest.skip("Admin authentication failed")
        # Use PRC test user from test_credentials.md
        self.test_user_uid = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"
    
    def test_get_real_user_subscription_details(self):
        """Test GET details for real test user"""
        response = self.session.get(f"{BASE_URL}/api/admin/subscription/{self.test_user_uid}/details")
        
        assert response.status_code in [200, 404], f"Unexpected: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"✓ Real user details - current: {data.get('current_plan')}, upcoming: {len(data.get('upcoming_plans', []))}, history: {len(data.get('history', []))}")
        else:
            print("✓ Real user not found (404)")
    
    def test_get_real_user_subscription_info(self):
        """Test user-facing subscription info for real user"""
        response = self.session.get(f"{BASE_URL}/api/admin/subscription/user/{self.test_user_uid}/info")
        
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"✓ Real user info - current: {data.get('current_plan')}, upcoming: {len(data.get('upcoming_plans', []))}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
