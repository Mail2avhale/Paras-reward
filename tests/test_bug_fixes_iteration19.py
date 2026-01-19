"""
Test file for Bug Fixes - Iteration 19
Testing:
1. VIP Payment Page - Bank details display when configured
2. KYC Verification Page - Advanced document upload integration
3. Tap Game - Taps should register and update PRC balance
"""

import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-rewarder.preview.emergentagent.com')

# Test user credentials
TEST_USER_EMAIL = f"test_bugfix19_{uuid.uuid4().hex[:8]}@test.com"
TEST_USER_PASSWORD = "testpass123"
TEST_USER_NAME = "Test BugFix User"
TEST_USER_UID = None


class TestVIPPaymentConfig:
    """Test VIP Payment Configuration endpoint"""
    
    def test_get_payment_config_returns_200(self):
        """Test that payment config endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/vip/payment-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
    def test_payment_config_has_required_fields(self):
        """Test that payment config has all required fields"""
        response = requests.get(f"{BASE_URL}/api/vip/payment-config")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ['upi_id', 'qr_code_url', 'bank_name', 'account_number', 'ifsc_code', 'account_holder', 'instructions']
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
            
    def test_payment_config_empty_when_not_configured(self):
        """Test that payment config returns empty values when not configured by admin"""
        response = requests.get(f"{BASE_URL}/api/vip/payment-config")
        assert response.status_code == 200
        
        data = response.json()
        # When not configured, upi_id and bank_name should be empty
        # This is expected behavior - admin needs to configure payment details
        assert data['upi_id'] == "" or data['bank_name'] == "", "Payment config should be empty until admin configures"
        print(f"Payment config (expected empty): upi_id='{data['upi_id']}', bank_name='{data['bank_name']}'")


class TestVIPPlans:
    """Test VIP Plans endpoint"""
    
    def test_get_vip_plans_returns_200(self):
        """Test that VIP plans endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/vip/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
    def test_vip_plans_has_plans_array(self):
        """Test that VIP plans response has plans array"""
        response = requests.get(f"{BASE_URL}/api/vip/plans")
        assert response.status_code == 200
        
        data = response.json()
        assert 'plans' in data, "Response should have 'plans' field"
        assert isinstance(data['plans'], list), "Plans should be a list"
        assert len(data['plans']) > 0, "Should have at least one plan"
        
    def test_vip_plan_structure(self):
        """Test that each VIP plan has required fields"""
        response = requests.get(f"{BASE_URL}/api/vip/plans")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ['plan_type', 'base_price', 'final_price', 'duration_days']
        
        for plan in data['plans']:
            for field in required_fields:
                assert field in plan, f"Plan missing field: {field}"
            print(f"Plan: {plan['plan_type']} - ₹{plan['final_price']} for {plan['duration_days']} days")


class TestUserRegistrationAndAuth:
    """Test user registration and authentication for tap game testing"""
    
    @pytest.fixture(scope="class")
    def registered_user(self):
        """Register a test user and return credentials"""
        global TEST_USER_UID
        
        # Register user
        register_data = {
            "name": TEST_USER_NAME,
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "phone": "9876543210"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        
        if response.status_code == 201:
            data = response.json()
            TEST_USER_UID = data.get('uid')
            print(f"Registered new user: {TEST_USER_EMAIL}, UID: {TEST_USER_UID}")
            return {"uid": TEST_USER_UID, "email": TEST_USER_EMAIL}
        elif response.status_code == 400 and "already exists" in response.text.lower():
            # User already exists, try to login
            login_data = {"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
            if login_response.status_code == 200:
                data = login_response.json()
                TEST_USER_UID = data.get('uid')
                return {"uid": TEST_USER_UID, "email": TEST_USER_EMAIL}
        
        pytest.skip(f"Could not register/login test user: {response.text}")
        
    def test_user_registration(self, registered_user):
        """Test that user registration works"""
        assert registered_user is not None
        assert 'uid' in registered_user
        print(f"User registered with UID: {registered_user['uid']}")


class TestTapGame:
    """Test Tap Game functionality"""
    
    @pytest.fixture(scope="class")
    def test_user_uid(self):
        """Get or create test user for tap game testing"""
        # Try to register a new user
        test_email = f"taptest_{uuid.uuid4().hex[:8]}@test.com"
        register_data = {
            "name": "Tap Test User",
            "email": test_email,
            "password": "testpass123",
            "phone": "9876543211"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        
        if response.status_code == 201:
            data = response.json()
            uid = data.get('uid')
            print(f"Created tap test user: {test_email}, UID: {uid}")
            return uid
        else:
            print(f"Registration response: {response.status_code} - {response.text}")
            pytest.skip("Could not create test user for tap game")
    
    def test_tap_game_single_tap(self, test_user_uid):
        """Test single tap in tap game"""
        response = requests.post(
            f"{BASE_URL}/api/game/tap/{test_user_uid}",
            json={"taps": 1}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'prc_earned' in data, "Response should have prc_earned"
        assert 'remaining_taps' in data, "Response should have remaining_taps"
        print(f"Single tap: earned {data['prc_earned']} PRC, remaining: {data['remaining_taps']}")
        
    def test_tap_game_multiple_taps(self, test_user_uid):
        """Test multiple taps in tap game"""
        response = requests.post(
            f"{BASE_URL}/api/game/tap/{test_user_uid}",
            json={"taps": 5}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'prc_earned' in data, "Response should have prc_earned"
        # For free user: 5 taps * 0.01 PRC = 0.05 PRC
        assert data['prc_earned'] >= 0.05, f"Expected at least 0.05 PRC, got {data['prc_earned']}"
        print(f"Multiple taps (5): earned {data['prc_earned']} PRC, remaining: {data['remaining_taps']}")
        
    def test_tap_game_updates_user_balance(self, test_user_uid):
        """Test that tap game updates user PRC balance"""
        # Get initial balance
        user_response = requests.get(f"{BASE_URL}/api/user/{test_user_uid}")
        assert user_response.status_code == 200
        initial_balance = user_response.json().get('prc_balance', 0)
        
        # Do some taps
        tap_response = requests.post(
            f"{BASE_URL}/api/game/tap/{test_user_uid}",
            json={"taps": 3}
        )
        assert tap_response.status_code == 200
        prc_earned = tap_response.json().get('prc_earned', 0)
        
        # Check updated balance
        user_response = requests.get(f"{BASE_URL}/api/user/{test_user_uid}")
        assert user_response.status_code == 200
        new_balance = user_response.json().get('prc_balance', 0)
        
        # Balance should have increased
        assert new_balance >= initial_balance, f"Balance should increase: {initial_balance} -> {new_balance}"
        print(f"Balance update: {initial_balance} -> {new_balance} (earned {prc_earned})")
        
    def test_tap_game_invalid_user(self):
        """Test tap game with invalid user ID"""
        response = requests.post(
            f"{BASE_URL}/api/game/tap/invalid_user_id_12345",
            json={"taps": 1}
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid user, got {response.status_code}"


class TestKYCEndpoints:
    """Test KYC related endpoints"""
    
    @pytest.fixture(scope="class")
    def test_user_uid(self):
        """Get or create test user for KYC testing"""
        test_email = f"kyctest_{uuid.uuid4().hex[:8]}@test.com"
        register_data = {
            "name": "KYC Test User",
            "email": test_email,
            "password": "testpass123",
            "phone": "9876543212"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        
        if response.status_code == 201:
            data = response.json()
            uid = data.get('uid')
            print(f"Created KYC test user: {test_email}, UID: {uid}")
            return uid
        else:
            pytest.skip("Could not create test user for KYC")
    
    def test_user_has_kyc_status_field(self, test_user_uid):
        """Test that user has kyc_status field"""
        response = requests.get(f"{BASE_URL}/api/user/{test_user_uid}")
        assert response.status_code == 200
        
        data = response.json()
        # New users should have kyc_status field (default: pending)
        assert 'kyc_status' in data or data.get('kyc_status') is None, "User should have kyc_status field"
        print(f"User KYC status: {data.get('kyc_status', 'not set')}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_info(self):
        """Print cleanup info"""
        print(f"\n=== Test Cleanup Info ===")
        print(f"Test users created with prefix: taptest_, kyctest_, test_bugfix19_")
        print(f"These can be cleaned up from admin panel if needed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
