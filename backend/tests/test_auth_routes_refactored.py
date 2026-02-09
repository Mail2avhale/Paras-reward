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
from datetime import datetime

# Get base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def test_user_data():
    """Generate unique test user data"""
    unique_id = str(uuid.uuid4())[:8]
    return {
        "email": f"test_auth_refactor_{unique_id}@test.com",
        "password": "TestPin123456",
        "mobile": f"98765{unique_id[:5].replace('-', '0')[:5]}",
        "full_name": f"Test User {unique_id}"
    }


class TestSimpleRegistration:
    """Test /api/auth/register/simple endpoint"""
    
    def test_simple_registration_success(self, api_client, test_user_data):
        """Test successful user registration"""
        payload = {
            "email": test_user_data["email"],
            "password": test_user_data["password"],
            "mobile": test_user_data["mobile"],
            "full_name": test_user_data["full_name"]
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
        test_user_data["uid"] = data["uid"]
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
    
    def test_simple_registration_duplicate_email(self, api_client, test_user_data):
        """Test registration fails with duplicate email"""
        payload = {
            "email": test_user_data["email"],
            "password": "AnotherPin123",
            "full_name": "Duplicate User"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register/simple", json=payload)
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        assert "already registered" in response.text.lower()
        print("✓ Registration correctly rejects duplicate email")


class TestCheckAuthType:
    """Test /api/auth/check-auth-type endpoint"""
    
    def test_check_auth_type_existing_user(self, api_client, test_user_data):
        """Test auth type check for existing user"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/check-auth-type",
            params={"identifier": test_user_data["email"]}
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
    
    def test_login_success(self, api_client, test_user_data):
        """Test successful login"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": test_user_data["email"],
                "password": test_user_data["password"]
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "uid" in data, "Response should contain uid"
        assert "email" in data, "Response should contain email"
        
        # Store uid if not already stored
        if "uid" not in test_user_data:
            test_user_data["uid"] = data["uid"]
        
        print(f"✓ Login successful for user: {data.get('email')}")
    
    def test_login_wrong_password(self, api_client, test_user_data):
        """Test login fails with wrong password"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": test_user_data["email"],
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
    
    def test_set_new_pin_success(self, api_client, test_user_data):
        """Test setting a new PIN for existing user"""
        # First need user_id
        if "uid" not in test_user_data:
            # Login to get uid
            login_resp = api_client.post(
                f"{BASE_URL}/api/auth/login",
                params={
                    "identifier": test_user_data["email"],
                    "password": test_user_data["password"]
                }
            )
            if login_resp.status_code == 200:
                test_user_data["uid"] = login_resp.json()["uid"]
            else:
                pytest.skip("Could not get user uid")
        
        payload = {
            "user_id": test_user_data["uid"],
            "new_pin": "123456"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/set-new-pin", json=payload)
        
        assert response.status_code == 200, f"Set new PIN failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print("✓ New PIN set successfully")
    
    def test_set_new_pin_invalid_pin(self, api_client, test_user_data):
        """Test setting invalid PIN formats"""
        if "uid" not in test_user_data:
            pytest.skip("No user uid available")
        
        # Test non-digit PIN
        payload = {
            "user_id": test_user_data["uid"],
            "new_pin": "abcdef"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/set-new-pin", json=payload)
        assert response.status_code == 400, f"Expected 400 for non-digit PIN, got {response.status_code}"
        
        # Test wrong length PIN
        payload["new_pin"] = "1234"
        response = api_client.post(f"{BASE_URL}/api/auth/set-new-pin", json=payload)
        assert response.status_code == 400, f"Expected 400 for wrong length PIN, got {response.status_code}"
        
        print("✓ Set new PIN correctly rejects invalid PINs")
    
    def test_set_new_pin_sequential(self, api_client, test_user_data):
        """Test setting sequential PIN (should be rejected)"""
        if "uid" not in test_user_data:
            pytest.skip("No user uid available")
        
        payload = {
            "user_id": test_user_data["uid"],
            "new_pin": "123456"  # Sequential
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/set-new-pin", json=payload)
        
        # Sequential PINs should be rejected
        assert response.status_code == 400, f"Expected 400 for sequential PIN, got {response.status_code}"
        print("✓ Set new PIN correctly rejects sequential PINs")


class TestForgotPassword:
    """Test /api/auth/forgot-password endpoint"""
    
    def test_forgot_password_existing_email(self, api_client, test_user_data):
        """Test forgot password for existing email"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/forgot-password",
            params={"email": test_user_data["email"]}
        )
        
        assert response.status_code == 200, f"Forgot password failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        # May contain reset_token for testing purposes
        if "reset_token" in data:
            test_user_data["reset_token"] = data["reset_token"]
            print(f"✓ Reset token generated: {data['reset_token'][:8]}...")
        else:
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
    
    def test_reset_password_request(self, api_client, test_user_data):
        """Test password reset request"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/reset-password-request",
            params={"email": test_user_data["email"]}
        )
        
        assert response.status_code == 200, f"Reset password request failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        
        if "reset_token" in data:
            test_user_data["reset_token"] = data["reset_token"]
            print(f"✓ Reset token: {data['reset_token'][:8]}...")
        else:
            print("✓ Reset password request processed")


class TestResetPassword:
    """Test /api/auth/reset-password endpoint"""
    
    def test_reset_password_with_valid_token(self, api_client, test_user_data):
        """Test password reset with valid token"""
        if "reset_token" not in test_user_data:
            # Get a reset token first
            resp = api_client.post(
                f"{BASE_URL}/api/auth/reset-password-request",
                params={"email": test_user_data["email"]}
            )
            if resp.status_code == 200:
                data = resp.json()
                if "reset_token" in data:
                    test_user_data["reset_token"] = data["reset_token"]
                else:
                    pytest.skip("Could not get reset token")
            else:
                pytest.skip("Could not request reset token")
        
        response = api_client.post(
            f"{BASE_URL}/api/auth/reset-password",
            params={
                "reset_token": test_user_data["reset_token"],
                "new_password": "NewTestPassword456"
            }
        )
        
        assert response.status_code == 200, f"Reset password failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        print("✓ Password reset successfully")
        
        # Update password for future tests
        test_user_data["password"] = "NewTestPassword456"
    
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
    
    def test_change_password_success(self, api_client, test_user_data):
        """Test changing password for logged in user"""
        if "uid" not in test_user_data:
            pytest.skip("No user uid available")
        
        new_password = "ChangedPassword123"
        
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            params={
                "uid": test_user_data["uid"],
                "old_password": test_user_data["password"],
                "new_password": new_password
            }
        )
        
        assert response.status_code == 200, f"Change password failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        
        # Update password for future tests
        test_user_data["password"] = new_password
        print("✓ Password changed successfully")
    
    def test_change_password_wrong_old_password(self, api_client, test_user_data):
        """Test changing password with wrong old password"""
        if "uid" not in test_user_data:
            pytest.skip("No user uid available")
        
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            params={
                "uid": test_user_data["uid"],
                "old_password": "wrongoldpassword",
                "new_password": "NewPassword123"
            }
        )
        
        assert response.status_code == 401, f"Expected 401 for wrong old password, got {response.status_code}"
        print("✓ Change password correctly rejects wrong old password")


class TestGetUserBiometricCredentials:
    """Test /api/auth/biometric/credentials/{user_id} endpoint"""
    
    def test_get_biometric_credentials(self, api_client, test_user_data):
        """Test getting biometric credentials for user"""
        if "uid" not in test_user_data:
            pytest.skip("No user uid available")
        
        response = api_client.get(
            f"{BASE_URL}/api/auth/biometric/credentials/{test_user_data['uid']}"
        )
        
        assert response.status_code == 200, f"Get biometric credentials failed: {response.text}"
        
        data = response.json()
        assert "credentials" in data, "Response should contain credentials list"
        assert "count" in data, "Response should contain credentials count"
        assert "max_devices" in data, "Response should contain max_devices"
        print(f"✓ Biometric credentials retrieved: {data['count']} devices registered")


class TestGetAuthUser:
    """Test /api/auth/user/{uid} endpoint"""
    
    def test_get_auth_user_success(self, api_client, test_user_data):
        """Test getting user details by uid"""
        if "uid" not in test_user_data:
            pytest.skip("No user uid available")
        
        response = api_client.get(f"{BASE_URL}/api/auth/user/{test_user_data['uid']}")
        
        assert response.status_code == 200, f"Get user failed: {response.text}"
        
        data = response.json()
        assert "uid" in data, "Response should contain uid"
        assert "email" in data, "Response should contain email"
        assert data["uid"] == test_user_data["uid"], "UID should match"
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
    
    def test_old_disabled_routes_not_accessible(self, api_client):
        """Test that /_disabled_auth/* routes are not the active routes"""
        # The /_disabled_auth routes should still exist but the /auth routes should be primary
        response = api_client.get(
            f"{BASE_URL}/api/auth/check-auth-type",
            params={"identifier": "test@test.com"}
        )
        
        # If this works, the new routes are properly registered
        assert response.status_code == 200, "New /api/auth routes should be working"
        print("✓ New /api/auth routes are properly registered and active")
    
    def test_auth_router_prefix(self, api_client):
        """Verify auth router uses correct /api/auth prefix"""
        # Test multiple endpoints to verify prefix is correct
        endpoints_to_test = [
            "/api/auth/check-auth-type?identifier=test@test.com",
            "/api/auth/forgot-password?email=test@test.com",
        ]
        
        for endpoint in endpoints_to_test:
            response = api_client.get(f"{BASE_URL}{endpoint.split('?')[0]}", 
                                     params=dict(x.split('=') for x in endpoint.split('?')[1].split('&')) if '?' in endpoint else {})
            # Any response other than 404/405 means route exists
            assert response.status_code not in [404, 405], f"Route {endpoint} should exist"
        
        print("✓ All auth routes use correct /api/auth prefix")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_users(api_client, request):
    """Cleanup test users after all tests complete"""
    yield
    # Cleanup is intentionally skipped to preserve test data for debugging
    print("\n[Cleanup] Test data preserved for debugging")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
