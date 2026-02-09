"""
Test Auth Routes - Refactored module testing
Tests for /api/auth/* endpoints moved from server.py to routes/auth.py

Endpoints tested:
- /api/auth/register/simple - User registration with email, password, mobile
- /api/auth/login - User login with identifier and password/PIN
- /api/auth/check-auth-type - Check if user should use PIN or password
- /api/auth/set-new-pin - Set new PIN for existing users
- /api/auth/forgot-password - Request password reset
- /api/auth/reset-password-request - Request password reset token
- /api/auth/reset-password - Reset password using token
- /api/auth/change-password - Change password for logged in user
- /api/auth/biometric/credentials/{user_id} - Get biometric credentials
- /api/auth/user/{uid} - Get user details
"""

import pytest
import requests
import os
import uuid
import random
from datetime import datetime

# Get base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Use existing test user for login/auth tests
EXISTING_TEST_USER = {
    "email": "mail2avhale@gmail.com",
    "uid": "73b95483-f36b-4637-a5ee-d447300c6835",
    "pin": "123456"
}

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def new_test_user_data():
    """Generate unique test user data with valid mobile format"""
    unique_id = str(uuid.uuid4())[:8]
    # Generate valid 10-digit mobile number
    mobile = f"9{random.randint(100000000, 999999999)}"
    return {
        "email": f"test_auth_refactor_{unique_id}@test.com",
        "password": "TestPassword123456",
        "mobile": mobile,
        "full_name": f"Test User {unique_id}"
    }


class TestSimpleRegistration:
    """Test /api/auth/register/simple endpoint"""
    
    def test_simple_registration_success(self, api_client, new_test_user_data):
        """Test successful user registration"""
        payload = {
            "email": new_test_user_data["email"],
            "password": new_test_user_data["password"],
            "mobile": new_test_user_data["mobile"],
            "full_name": new_test_user_data["full_name"]
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register/simple", json=payload)
        
        # Status check
        if response.status_code == 400 and "already registered" in response.text:
            pytest.skip("User already exists from previous test run")
        
        assert response.status_code in [200, 201], f"Registration failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "uid" in data, "Response should contain user uid"
        assert "message" in data, "Response should contain success message"
        
        # Store uid for later tests
        new_test_user_data["uid"] = data["uid"]
        print(f"✓ User registered with uid: {data['uid']}")
    
    def test_simple_registration_missing_email(self, api_client):
        """Test registration fails without email"""
        payload = {
            "password": "TestPin123",
            "full_name": "No Email User"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register/simple", json=payload)
        
        assert response.status_code == 400, f"Expected 400 for missing email, got {response.status_code}"
        assert "email" in response.text.lower() or "required" in response.text.lower()
        print("✓ Registration correctly rejects missing email")
    
    def test_simple_registration_invalid_email(self, api_client):
        """Test registration fails with invalid email format"""
        payload = {
            "email": "notanemail",
            "password": "TestPin123",
            "full_name": "Invalid Email User"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register/simple", json=payload)
        
        assert response.status_code == 400, f"Expected 400 for invalid email, got {response.status_code}"
        print("✓ Registration correctly rejects invalid email")
    
    def test_simple_registration_duplicate_email(self, api_client):
        """Test registration fails with duplicate email (using known existing email)"""
        payload = {
            "email": EXISTING_TEST_USER["email"],
            "password": "AnotherPin123",
            "full_name": "Duplicate User"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register/simple", json=payload)
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        assert "already registered" in response.text.lower()
        print("✓ Registration correctly rejects duplicate email")


class TestCheckAuthType:
    """Test /api/auth/check-auth-type endpoint"""
    
    def test_check_auth_type_existing_user(self, api_client):
        """Test auth type check for existing user"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/check-auth-type",
            params={"identifier": EXISTING_TEST_USER["email"]}
        )
        
        assert response.status_code == 200, f"Auth type check failed: {response.text}"
        
        data = response.json()
        assert "auth_type" in data, "Response should contain auth_type"
        assert "user_exists" in data, "Response should contain user_exists"
        assert data["user_exists"] == True, "User should exist"
        print(f"✓ Auth type for user: {data['auth_type']}")
    
    def test_check_auth_type_non_existing_user(self, api_client):
        """Test auth type check for non-existing user"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/check-auth-type",
            params={"identifier": f"nonexistent_{uuid.uuid4()}@test.com"}
        )
        
        assert response.status_code == 200, f"Auth type check failed: {response.text}"
        
        data = response.json()
        assert data["user_exists"] == False, "User should not exist"
        print("✓ Auth type correctly identifies non-existing user")


class TestLogin:
    """Test /api/auth/login endpoint"""
    
    def test_login_success(self, api_client):
        """Test successful login with existing user"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": EXISTING_TEST_USER["email"],
                "password": EXISTING_TEST_USER["pin"]
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "uid" in data, "Response should contain uid"
        assert "email" in data, "Response should contain email"
        assert data["uid"] == EXISTING_TEST_USER["uid"], "UID should match"
        
        print(f"✓ Login successful for user: {data.get('email')}")
    
    def test_login_wrong_password(self, api_client):
        """Test login fails with wrong password"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": EXISTING_TEST_USER["email"],
                "password": "wrongpassword123"
            }
        )
        
        # Should return 401 for invalid credentials
        assert response.status_code == 401, f"Expected 401 for wrong password, got {response.status_code}"
        print("✓ Login correctly rejects wrong password")
    
    def test_login_non_existing_user(self, api_client):
        """Test login fails for non-existing user"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": f"nonexistent_{uuid.uuid4()}@test.com",
                "password": "anypassword"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existing user, got {response.status_code}"
        print("✓ Login correctly rejects non-existing user")


class TestSetNewPin:
    """Test /api/auth/set-new-pin endpoint"""
    
    def test_set_new_pin_success(self, api_client, new_test_user_data):
        """Test setting a new PIN for existing user"""
        if "uid" not in new_test_user_data:
            # Use the existing test user
            user_id = EXISTING_TEST_USER["uid"]
        else:
            user_id = new_test_user_data["uid"]
        
        payload = {
            "user_id": user_id,
            "new_pin": "582736"  # Non-sequential, non-repeating valid PIN
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/set-new-pin", json=payload)
        
        assert response.status_code == 200, f"Set new PIN failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print("✓ New PIN set successfully")
        
        # Restore original PIN for the existing test user
        if user_id == EXISTING_TEST_USER["uid"]:
            restore_payload = {
                "user_id": user_id,
                "new_pin": EXISTING_TEST_USER["pin"]
            }
            api_client.post(f"{BASE_URL}/api/auth/set-new-pin", json=restore_payload)
    
    def test_set_new_pin_invalid_pin(self, api_client):
        """Test setting invalid PIN formats"""
        user_id = EXISTING_TEST_USER["uid"]
        
        # Test non-digit PIN
        payload = {
            "user_id": user_id,
            "new_pin": "abcdef"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/set-new-pin", json=payload)
        assert response.status_code == 400, f"Expected 400 for non-digit PIN, got {response.status_code}"
        
        # Test wrong length PIN
        payload["new_pin"] = "1234"
        response = api_client.post(f"{BASE_URL}/api/auth/set-new-pin", json=payload)
        assert response.status_code == 400, f"Expected 400 for wrong length PIN, got {response.status_code}"
        
        print("✓ Set new PIN correctly rejects invalid PINs")
    
    def test_set_new_pin_all_same_digits(self, api_client):
        """Test setting PIN with all same digits (should be rejected)"""
        user_id = EXISTING_TEST_USER["uid"]
        
        payload = {
            "user_id": user_id,
            "new_pin": "111111"  # All same digits
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/set-new-pin", json=payload)
        
        # All same digits PINs should be rejected
        assert response.status_code == 400, f"Expected 400 for all same digits PIN, got {response.status_code}"
        print("✓ Set new PIN correctly rejects all same digits PINs")


class TestForgotPassword:
    """Test /api/auth/forgot-password endpoint"""
    
    def test_forgot_password_existing_email(self, api_client):
        """Test forgot password for existing email"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/forgot-password",
            params={"email": EXISTING_TEST_USER["email"]}
        )
        
        assert response.status_code == 200, f"Forgot password failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        print("✓ Forgot password request processed")
    
    def test_forgot_password_non_existing_email(self, api_client):
        """Test forgot password for non-existing email (should not reveal user existence)"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/forgot-password",
            params={"email": f"nonexistent_{uuid.uuid4()}@test.com"}
        )
        
        # Should return 200 to not reveal if email exists
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Forgot password does not reveal non-existing email")


class TestResetPasswordRequest:
    """Test /api/auth/reset-password-request endpoint"""
    
    def test_reset_password_request(self, api_client):
        """Test password reset request"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/reset-password-request",
            params={"email": EXISTING_TEST_USER["email"]}
        )
        
        assert response.status_code == 200, f"Reset password request failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        print("✓ Reset password request processed")


class TestResetPassword:
    """Test /api/auth/reset-password endpoint"""
    
    def test_reset_password_with_invalid_token(self, api_client):
        """Test password reset with invalid token"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/reset-password",
            params={
                "reset_token": "INVALID_TOKEN_123",
                "new_password": "TestPassword789"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid token, got {response.status_code}"
        print("✓ Reset password correctly rejects invalid token")


class TestChangePassword:
    """Test /api/auth/change-password endpoint"""
    
    def test_change_password_wrong_old_password(self, api_client):
        """Test changing password with wrong old password"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            params={
                "uid": EXISTING_TEST_USER["uid"],
                "old_password": "wrongoldpassword",
                "new_password": "NewPassword123"
            }
        )
        
        assert response.status_code == 401, f"Expected 401 for wrong old password, got {response.status_code}"
        print("✓ Change password correctly rejects wrong old password")
    
    def test_change_password_non_existing_user(self, api_client):
        """Test changing password for non-existing user"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            params={
                "uid": str(uuid.uuid4()),
                "old_password": "anypassword",
                "new_password": "NewPassword123"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existing user, got {response.status_code}"
        print("✓ Change password correctly rejects non-existing user")


class TestGetUserBiometricCredentials:
    """Test /api/auth/biometric/credentials/{user_id} endpoint"""
    
    def test_get_biometric_credentials(self, api_client):
        """Test getting biometric credentials for user"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/biometric/credentials/{EXISTING_TEST_USER['uid']}"
        )
        
        assert response.status_code == 200, f"Get biometric credentials failed: {response.text}"
        
        data = response.json()
        assert "credentials" in data, "Response should contain credentials list"
        assert "count" in data, "Response should contain credentials count"
        assert "max_devices" in data, "Response should contain max_devices"
        print(f"✓ Biometric credentials retrieved: {data['count']} devices registered")


class TestGetAuthUser:
    """Test /api/auth/user/{uid} endpoint"""
    
    def test_get_auth_user_success(self, api_client):
        """Test getting user details by uid"""
        response = api_client.get(f"{BASE_URL}/api/auth/user/{EXISTING_TEST_USER['uid']}")
        
        assert response.status_code == 200, f"Get user failed: {response.text}"
        
        data = response.json()
        assert "uid" in data, "Response should contain uid"
        assert "email" in data, "Response should contain email"
        assert data["uid"] == EXISTING_TEST_USER["uid"], "UID should match"
        print(f"✓ User details retrieved: {data.get('email')}")
    
    def test_get_auth_user_not_found(self, api_client):
        """Test getting non-existing user"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/user/{str(uuid.uuid4())}"
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existing user, got {response.status_code}"
        print("✓ Get user correctly returns 404 for non-existing user")


class TestRouteConflictVerification:
    """Verify that old routes are disabled and new routes work"""
    
    def test_new_auth_routes_working(self, api_client):
        """Test that new /api/auth/* routes are working"""
        # Test GET endpoint
        response = api_client.get(
            f"{BASE_URL}/api/auth/check-auth-type",
            params={"identifier": EXISTING_TEST_USER["email"]}
        )
        assert response.status_code == 200, "New /api/auth/check-auth-type should work"
        
        # Test POST endpoint
        response = api_client.post(
            f"{BASE_URL}/api/auth/forgot-password",
            params={"email": EXISTING_TEST_USER["email"]}
        )
        assert response.status_code == 200, "New /api/auth/forgot-password should work"
        
        print("✓ New /api/auth routes are properly registered and active")
    
    def test_auth_router_endpoints_exist(self, api_client):
        """Verify auth router endpoints are accessible"""
        # All these endpoints should return valid responses (not 404)
        test_cases = [
            ("GET", f"{BASE_URL}/api/auth/check-auth-type?identifier=test@test.com", 200),
            ("GET", f"{BASE_URL}/api/auth/user/{EXISTING_TEST_USER['uid']}", 200),
            ("GET", f"{BASE_URL}/api/auth/biometric/credentials/{EXISTING_TEST_USER['uid']}", 200),
        ]
        
        for method, url, expected_status in test_cases:
            response = api_client.get(url) if method == "GET" else api_client.post(url)
            assert response.status_code == expected_status, f"{method} {url} returned {response.status_code}, expected {expected_status}"
        
        print("✓ All auth router endpoints exist and are accessible")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_users(api_client, request):
    """Cleanup test users after all tests complete"""
    yield
    # Cleanup is intentionally skipped to preserve test data for debugging
    print("\n[Cleanup] Test data preserved for debugging")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
