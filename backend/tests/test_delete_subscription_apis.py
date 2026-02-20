"""
Test Delete Subscription APIs
Tests for:
- DELETE /api/admin/user/{uid}/subscription/{payment_id} - Delete single subscription
- DELETE /api/admin/user/{uid}/subscriptions/all - Delete all subscriptions and reset to Explorer
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDeleteSubscriptionAPIs:
    """Test the delete subscription endpoints for Admin User 360 page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data - create a test user with subscription records"""
        self.test_uid = f"TEST_USER_{uuid.uuid4().hex[:8]}"
        self.test_email = f"test_sub_delete_{uuid.uuid4().hex[:6]}@test.com"
        self.test_payment_ids = []
        
    def test_01_health_check(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health check passed: {data}")
        
    def test_02_create_test_user_for_delete(self):
        """Create a test user to test delete subscription APIs"""
        # First check if user exists by searching
        response = requests.get(f"{BASE_URL}/api/admin/users/all?search={self.test_email}&limit=1")
        
        # Create test user via admin endpoint if needed
        # We'll use the users collection directly via test data setup
        # For now, let's find an existing user to test with
        response = requests.get(f"{BASE_URL}/api/admin/users/all?limit=5")
        if response.status_code == 200:
            users = response.json().get("users", [])
            if users:
                # Use first user for testing (we'll add test subscription records)
                self.test_uid = users[0].get("uid")
                self.test_email = users[0].get("email")
                print(f"✅ Using existing user for testing: {self.test_email} ({self.test_uid})")
                return
        
        print("⚠️ No users found for testing - will test error cases")
        
    def test_03_delete_single_subscription_not_found(self):
        """Test deleting subscription with invalid payment_id returns 404"""
        fake_uid = "fake_user_12345"
        fake_payment_id = "fake_payment_12345"
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/user/{fake_uid}/subscription/{fake_payment_id}"
        )
        
        # Should return 404 - user not found
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"✅ Delete single subscription - user not found: {data}")
        
    def test_04_delete_all_subscriptions_user_not_found(self):
        """Test deleting all subscriptions with invalid uid returns 404"""
        fake_uid = "fake_user_12345"
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/user/{fake_uid}/subscriptions/all"
        )
        
        # Should return 404 - user not found
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"✅ Delete all subscriptions - user not found: {data}")


class TestDeleteSubscriptionWithRealUser:
    """Test delete subscription with actual users"""
    
    def test_05_find_user_with_subscriptions(self):
        """Find a user who has subscription records in vip_payments"""
        # Get list of users with subscription plans
        response = requests.get(f"{BASE_URL}/api/admin/users/all?membership=elite&limit=5")
        
        if response.status_code == 200:
            users = response.json().get("users", [])
            for user in users:
                uid = user.get("uid")
                # Check user 360 data to see subscription history
                user_360 = requests.get(f"{BASE_URL}/api/admin/user-360?query={uid}")
                if user_360.status_code == 200:
                    data = user_360.json()
                    subscriptions = data.get("transactions", {}).get("subscriptions", [])
                    if subscriptions:
                        self.__class__.test_user_uid = uid
                        self.__class__.test_user_email = user.get("email")
                        self.__class__.test_subscriptions = subscriptions
                        print(f"✅ Found user with {len(subscriptions)} subscriptions: {uid}")
                        return
        
        # Try growth and startup plans
        for plan in ["growth", "startup"]:
            response = requests.get(f"{BASE_URL}/api/admin/users/all?membership={plan}&limit=5")
            if response.status_code == 200:
                users = response.json().get("users", [])
                for user in users:
                    uid = user.get("uid")
                    user_360 = requests.get(f"{BASE_URL}/api/admin/user-360?query={uid}")
                    if user_360.status_code == 200:
                        data = user_360.json()
                        subscriptions = data.get("transactions", {}).get("subscriptions", [])
                        if subscriptions:
                            self.__class__.test_user_uid = uid
                            self.__class__.test_user_email = user.get("email")
                            self.__class__.test_subscriptions = subscriptions
                            print(f"✅ Found user with {len(subscriptions)} subscriptions: {uid}")
                            return
        
        print("⚠️ No users with subscription records found - testing with any user")
        # Get any user for the delete all test
        response = requests.get(f"{BASE_URL}/api/admin/users/all?limit=1")
        if response.status_code == 200:
            users = response.json().get("users", [])
            if users:
                self.__class__.test_user_uid = users[0].get("uid")
                self.__class__.test_user_email = users[0].get("email")
                self.__class__.test_subscriptions = []
                print(f"✅ Using user for testing: {self.__class__.test_user_uid}")
                
    def test_06_delete_single_subscription_valid_user_invalid_payment(self):
        """Test deleting subscription with valid user but invalid payment_id"""
        if not hasattr(self.__class__, 'test_user_uid'):
            pytest.skip("No test user found")
            
        uid = self.__class__.test_user_uid
        fake_payment_id = f"fake_payment_{uuid.uuid4().hex[:8]}"
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/user/{uid}/subscription/{fake_payment_id}"
        )
        
        # Should return 404 - subscription record not found
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"✅ Delete single subscription - payment not found for valid user: {data}")
        
    def test_07_delete_all_subscriptions_valid_user(self):
        """Test deleting all subscriptions for a valid user (resets to Explorer)"""
        if not hasattr(self.__class__, 'test_user_uid'):
            pytest.skip("No test user found")
            
        uid = self.__class__.test_user_uid
        
        # First, get user's current subscription status
        user_360_before = requests.get(f"{BASE_URL}/api/admin/user-360?query={uid}")
        if user_360_before.status_code == 200:
            data_before = user_360_before.json()
            user_before = data_before.get("user", {})
            print(f"📋 User before delete: plan={user_before.get('subscription_plan')}, expiry={user_before.get('subscription_expiry')}")
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/user/{uid}/subscriptions/all"
        )
        
        # Should return 200 - success
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "deleted" in data.get("message", "").lower()
        print(f"✅ Delete all subscriptions successful: {data}")
        
        # Verify user is now Explorer
        user_360_after = requests.get(f"{BASE_URL}/api/admin/user-360?query={uid}")
        if user_360_after.status_code == 200:
            data_after = user_360_after.json()
            user_after = data_after.get("user", {})
            assert user_after.get("subscription_plan") == "explorer"
            assert user_after.get("subscription_expiry") is None
            print(f"✅ User reset to Explorer: plan={user_after.get('subscription_plan')}, expiry={user_after.get('subscription_expiry')}")


class TestDeleteSingleSubscriptionWithData:
    """Test delete single subscription with actual subscription data"""
    
    def test_08_setup_and_find_subscription_record(self):
        """Find a user with actual subscription payment records to delete"""
        # Get vip_payments directly via admin dashboard or search
        # We need to find a payment_id in the vip_payments collection
        
        # Try to get subscription history from user 360
        response = requests.get(f"{BASE_URL}/api/admin/users/all?limit=20")
        if response.status_code != 200:
            pytest.skip("Cannot fetch users")
            
        users = response.json().get("users", [])
        
        for user in users:
            uid = user.get("uid")
            user_360 = requests.get(f"{BASE_URL}/api/admin/user-360?query={uid}")
            if user_360.status_code == 200:
                data = user_360.json()
                subscriptions = data.get("transactions", {}).get("subscriptions", [])
                if subscriptions:
                    # Found a user with subscription records
                    for sub in subscriptions:
                        payment_id = sub.get("payment_id")
                        if payment_id:
                            self.__class__.target_uid = uid
                            self.__class__.target_payment_id = payment_id
                            self.__class__.target_sub = sub
                            print(f"✅ Found subscription to delete: uid={uid}, payment_id={payment_id}")
                            return
        
        print("⚠️ No subscription payment records found for single delete test")
        self.__class__.target_uid = None
        
    def test_09_delete_single_subscription_success(self):
        """Test deleting a single subscription record successfully"""
        if not hasattr(self.__class__, 'target_uid') or not self.__class__.target_uid:
            pytest.skip("No subscription record found to delete")
            
        uid = self.__class__.target_uid
        payment_id = self.__class__.target_payment_id
        
        # Delete the subscription record
        response = requests.delete(
            f"{BASE_URL}/api/admin/user/{uid}/subscription/{payment_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert payment_id in data.get("payment_id", "")
        print(f"✅ Single subscription deleted: {data}")
        
        # Verify it's gone
        user_360_after = requests.get(f"{BASE_URL}/api/admin/user-360?query={uid}")
        if user_360_after.status_code == 200:
            data_after = user_360_after.json()
            subscriptions_after = data_after.get("transactions", {}).get("subscriptions", [])
            payment_ids_after = [s.get("payment_id") for s in subscriptions_after]
            assert payment_id not in payment_ids_after
            print(f"✅ Verified subscription record removed from history")


class TestAPIEndpointStructure:
    """Test API endpoint structure and response format"""
    
    def test_10_delete_single_endpoint_method_check(self):
        """Verify DELETE method is supported on single subscription endpoint"""
        # Try POST - should fail or be different
        fake_uid = "test_uid_123"
        fake_payment_id = "test_payment_123"
        
        # Test GET (should fail - method not allowed or 404)
        response = requests.get(f"{BASE_URL}/api/admin/user/{fake_uid}/subscription/{fake_payment_id}")
        # Should be 404 (user not found) or 405 (method not allowed)
        assert response.status_code in [404, 405, 422]
        print(f"✅ GET method returns appropriate response: {response.status_code}")
        
    def test_11_delete_all_endpoint_method_check(self):
        """Verify DELETE method is supported on delete all endpoint"""
        fake_uid = "test_uid_123"
        
        # Test GET (should fail - method not allowed or 404)
        response = requests.get(f"{BASE_URL}/api/admin/user/{fake_uid}/subscriptions/all")
        # Should be 404 (user not found) or 405 (method not allowed)
        assert response.status_code in [404, 405, 422]
        print(f"✅ GET method on delete-all returns appropriate response: {response.status_code}")


class TestResponseFormat:
    """Test response format compliance"""
    
    def test_12_error_response_format(self):
        """Verify error responses have proper format"""
        fake_uid = "fake_user_nonexistent"
        
        response = requests.delete(f"{BASE_URL}/api/admin/user/{fake_uid}/subscriptions/all")
        
        assert response.status_code == 404
        data = response.json()
        # Should have 'detail' field for FastAPI HTTPException
        assert "detail" in data
        print(f"✅ Error response format correct: {data}")
        
    def test_13_success_response_format_delete_all(self):
        """Verify success response has required fields"""
        # Get a real user first
        response = requests.get(f"{BASE_URL}/api/admin/users/all?limit=1")
        if response.status_code != 200:
            pytest.skip("Cannot fetch users")
            
        users = response.json().get("users", [])
        if not users:
            pytest.skip("No users in database")
            
        uid = users[0].get("uid")
        
        # Call delete all (even if no subscriptions, should succeed)
        response = requests.delete(f"{BASE_URL}/api/admin/user/{uid}/subscriptions/all")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "success" in data
        assert "message" in data
        assert "deleted_count" in data
        assert data.get("success") == True
        assert isinstance(data.get("deleted_count"), int)
        print(f"✅ Success response format correct: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
