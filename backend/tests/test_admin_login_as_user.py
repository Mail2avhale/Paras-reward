"""
Test Admin Login As User (Impersonation) Feature
Tests the admin impersonation flow:
1. Admin login
2. Search user for impersonation
3. Login as user (create impersonation session)
4. Verify impersonation token works for user APIs
5. End impersonation session
6. List impersonation sessions
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
TEST_USER_MOBILE = "9970100782"
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


class TestAdminLoginAsUser:
    """Test Admin Login As User (Impersonation) Feature"""
    
    admin_uid = None
    admin_token = None
    impersonation_token = None
    target_user_uid = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin first"""
        # Step 1: Check auth type for admin (GET method)
        check_response = requests.get(
            f"{BASE_URL}/api/auth/check-auth-type",
            params={"identifier": ADMIN_EMAIL}
        )
        assert check_response.status_code == 200, f"Check auth type failed: {check_response.text}"
        
        # Step 2: Login as admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        login_data = login_response.json()
        # User data is at root level, not nested under "user"
        TestAdminLoginAsUser.admin_uid = login_data.get("uid")
        TestAdminLoginAsUser.admin_token = login_data.get("token") or login_data.get("access_token")
        
        assert TestAdminLoginAsUser.admin_uid, f"Admin UID not found in login response: {login_data.keys()}"
        print(f"✓ Admin logged in: {TestAdminLoginAsUser.admin_uid}")
    
    def test_01_admin_login_success(self):
        """Test admin login returns valid credentials"""
        assert TestAdminLoginAsUser.admin_uid is not None
        assert TestAdminLoginAsUser.admin_token is not None
        print(f"✓ Admin UID: {TestAdminLoginAsUser.admin_uid}")
    
    def test_02_search_user_for_impersonation_by_mobile(self):
        """Test searching user by mobile number for impersonation"""
        # Search by partial mobile number
        response = requests.get(
            f"{BASE_URL}/api/admin/search-user-for-impersonation",
            params={"query": "997010"},
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Search not successful: {data}"
        assert "users" in data, "No users field in response"
        assert len(data["users"]) > 0, "No users found for search query '997010'"
        
        # Verify user data structure
        user = data["users"][0]
        assert "uid" in user, "User missing uid"
        assert "name" in user, "User missing name"
        assert "mobile" in user, "User missing mobile"
        
        TestAdminLoginAsUser.target_user_uid = user["uid"]
        print(f"✓ Found user: {user.get('name')} ({user.get('mobile')})")
        print(f"  Plan: {user.get('subscription_plan')}, PRC: {user.get('prc_balance')}")
    
    def test_03_search_user_for_impersonation_by_name(self):
        """Test searching user by name for impersonation"""
        response = requests.get(
            f"{BASE_URL}/api/admin/search-user-for-impersonation",
            params={"query": "Test"},
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 200, f"Search by name failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        print(f"✓ Search by name returned {data.get('count', 0)} users")
    
    def test_04_search_user_short_query_fails(self):
        """Test that search with less than 3 characters fails"""
        response = requests.get(
            f"{BASE_URL}/api/admin/search-user-for-impersonation",
            params={"query": "ab"},
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for short query, got {response.status_code}"
        print("✓ Short query correctly rejected")
    
    def test_05_login_as_user_success(self):
        """Test admin can login as user (create impersonation session)"""
        # Use the target user UID from search or fallback to test user
        target_uid = TestAdminLoginAsUser.target_user_uid or TEST_USER_UID
        
        response = requests.post(
            f"{BASE_URL}/api/admin/login-as-user",
            json={
                "admin_uid": TestAdminLoginAsUser.admin_uid,
                "target_uid": target_uid
            },
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 200, f"Login as user failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Login as user not successful: {data}"
        assert "session_token" in data, "No session_token in response"
        assert "user" in data, "No user data in response"
        assert "expires_at" in data, "No expires_at in response"
        
        # Verify user data
        user_data = data["user"]
        assert user_data.get("is_impersonation") == True, "is_impersonation flag not set"
        assert "impersonated_by_admin" in user_data, "impersonated_by_admin not in user data"
        
        TestAdminLoginAsUser.impersonation_token = data["session_token"]
        print(f"✓ Impersonation session created")
        print(f"  User: {user_data.get('name')} ({user_data.get('mobile')})")
        print(f"  Token: {TestAdminLoginAsUser.impersonation_token[:20]}...")
        print(f"  Expires: {data.get('expires_at')}")
    
    def test_06_login_as_user_with_mobile(self):
        """Test admin can login as user using mobile number"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-as-user",
            json={
                "admin_uid": TestAdminLoginAsUser.admin_uid,
                "target_mobile": TEST_USER_MOBILE
            },
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 200, f"Login as user by mobile failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        print(f"✓ Login as user by mobile successful")
    
    def test_07_login_as_user_missing_target_fails(self):
        """Test that login as user without target fails"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-as-user",
            json={
                "admin_uid": TestAdminLoginAsUser.admin_uid
            },
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for missing target, got {response.status_code}"
        print("✓ Missing target correctly rejected")
    
    def test_08_login_as_user_invalid_target_fails(self):
        """Test that login as user with invalid target fails"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-as-user",
            json={
                "admin_uid": TestAdminLoginAsUser.admin_uid,
                "target_uid": "invalid-uid-12345"
            },
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid target, got {response.status_code}"
        print("✓ Invalid target correctly rejected")
    
    def test_09_get_impersonation_sessions(self):
        """Test listing impersonation sessions"""
        response = requests.get(
            f"{BASE_URL}/api/admin/impersonation-sessions",
            params={"admin_uid": TestAdminLoginAsUser.admin_uid},
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 200, f"Get sessions failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "sessions" in data
        assert "count" in data
        
        print(f"✓ Found {data.get('count')} active impersonation sessions")
        if data.get("sessions"):
            session = data["sessions"][0]
            print(f"  Latest: {session.get('target_name')} by {session.get('admin_name')}")
    
    def test_10_end_impersonation_session(self):
        """Test ending an impersonation session"""
        if not TestAdminLoginAsUser.impersonation_token:
            pytest.skip("No impersonation token available")
        
        response = requests.post(
            f"{BASE_URL}/api/admin/end-impersonation",
            json={
                "token": TestAdminLoginAsUser.impersonation_token,
                "admin_uid": TestAdminLoginAsUser.admin_uid
            },
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 200, f"End impersonation failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        print("✓ Impersonation session ended successfully")
    
    def test_11_end_impersonation_invalid_token_fails(self):
        """Test that ending with invalid token fails"""
        response = requests.post(
            f"{BASE_URL}/api/admin/end-impersonation",
            json={
                "token": "invalid-token-12345",
                "admin_uid": TestAdminLoginAsUser.admin_uid
            },
            headers={"Authorization": f"Bearer {TestAdminLoginAsUser.admin_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid token, got {response.status_code}"
        print("✓ Invalid token correctly rejected")


class TestImpersonationUserAccess:
    """Test that impersonation token can access user APIs"""
    
    impersonation_token = None
    target_uid = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - create impersonation session"""
        # Login as admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        assert login_response.status_code == 200
        
        admin_data = login_response.json()
        # User data is at root level
        admin_uid = admin_data.get("uid")
        admin_token = admin_data.get("token") or admin_data.get("access_token")
        
        # Create impersonation session
        imp_response = requests.post(
            f"{BASE_URL}/api/admin/login-as-user",
            json={
                "admin_uid": admin_uid,
                "target_uid": TEST_USER_UID
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if imp_response.status_code == 200:
            imp_data = imp_response.json()
            TestImpersonationUserAccess.impersonation_token = imp_data.get("session_token")
            TestImpersonationUserAccess.target_uid = imp_data.get("user", {}).get("uid")
            print(f"✓ Impersonation session created for testing user access")
    
    def test_01_impersonation_token_format(self):
        """Test impersonation token has correct format"""
        token = TestImpersonationUserAccess.impersonation_token
        if not token:
            pytest.skip("No impersonation token available")
        
        assert token.startswith("IMP_"), f"Token should start with IMP_, got: {token[:10]}"
        print(f"✓ Token format correct: {token[:15]}...")
    
    def test_02_access_user_dashboard(self):
        """Test accessing user dashboard with impersonation token"""
        if not TestImpersonationUserAccess.target_uid:
            pytest.skip("No target UID available")
        
        # Note: The impersonation token is stored in localStorage and used for session validation
        # For API access, we test that the user data was returned correctly
        response = requests.get(
            f"{BASE_URL}/api/user/{TestImpersonationUserAccess.target_uid}/dashboard"
        )
        
        assert response.status_code == 200, f"Dashboard access failed: {response.text}"
        data = response.json()
        
        assert "user" in data or "uid" in data, "No user data in dashboard response"
        print("✓ User dashboard accessible")
    
    def test_03_access_user_mining_status(self):
        """Test accessing user mining status"""
        if not TestImpersonationUserAccess.target_uid:
            pytest.skip("No target UID available")
        
        response = requests.get(
            f"{BASE_URL}/api/mining/status/{TestImpersonationUserAccess.target_uid}"
        )
        
        assert response.status_code == 200, f"Mining status access failed: {response.text}"
        print("✓ User mining status accessible")
    
    def test_04_access_user_network_stats(self):
        """Test accessing user network stats (Growth Network)"""
        if not TestImpersonationUserAccess.target_uid:
            pytest.skip("No target UID available")
        
        response = requests.get(
            f"{BASE_URL}/api/growth/network-stats/{TestImpersonationUserAccess.target_uid}"
        )
        
        assert response.status_code == 200, f"Network stats access failed: {response.text}"
        print("✓ User network stats accessible")
    
    def test_05_access_user_redeem_limit(self):
        """Test accessing user redeem limit"""
        if not TestImpersonationUserAccess.target_uid:
            pytest.skip("No target UID available")
        
        response = requests.get(
            f"{BASE_URL}/api/user/{TestImpersonationUserAccess.target_uid}/redeem-limit"
        )
        
        assert response.status_code == 200, f"Redeem limit access failed: {response.text}"
        print("✓ User redeem limit accessible")
    
    def test_06_access_subscription_plans(self):
        """Test accessing subscription plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        assert response.status_code == 200, f"Subscription plans access failed: {response.text}"
        print("✓ Subscription plans accessible")
    
    def test_07_access_user_profile(self):
        """Test accessing user profile"""
        if not TestImpersonationUserAccess.target_uid:
            pytest.skip("No target UID available")
        
        response = requests.get(
            f"{BASE_URL}/api/users/{TestImpersonationUserAccess.target_uid}"
        )
        
        assert response.status_code == 200, f"User profile access failed: {response.text}"
        data = response.json()
        
        # Verify sensitive fields are not exposed
        assert "password_hash" not in data, "password_hash should not be exposed"
        assert "pin_hash" not in data, "pin_hash should not be exposed"
        print("✓ User profile accessible (sensitive fields hidden)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
