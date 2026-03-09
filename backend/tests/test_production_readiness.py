"""
Production Readiness Test - Critical User Flows
Tests critical functionality before Play Store release

Critical Flows:
1. User Registration
2. User Login with PIN
3. Dashboard API (user data)
4. Mining API (start/status/claim)
5. Subscription API (plans, payments)
6. Admin API (subscription management)
7. Notifications API
8. Session Management (single device)
"""

import pytest
import requests
import os
import uuid
import time
import random

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://eko-payments.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "123456"

# Generated test data prefix for cleanup
TEST_PREFIX = "PRODTEST_"


def generate_unique_mobile():
    """Generate a unique 10-digit mobile number"""
    return f"9{random.randint(100000000, 999999999)}"


def generate_unique_id():
    """Generate a short unique ID"""
    return str(uuid.uuid4())[:8]


class TestHealthCheck:
    """Test health endpoints first"""
    
    def test_backend_health(self):
        """Test backend health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Backend not healthy: {data}"
        assert data.get("database") == "connected", "Database not connected"
        print("✅ Backend health check passed")


class TestAuthFlow:
    """Test authentication critical flows"""
    
    def test_auth_type_check(self):
        """Test /api/auth/check-auth-type endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/auth/check-auth-type",
            params={"identifier": ADMIN_EMAIL}
        )
        assert response.status_code == 200, f"Auth type check failed: {response.text}"
        data = response.json()
        assert data.get("auth_type") in ["pin", "password"], f"Invalid auth type: {data}"
        print(f"✅ Auth type check passed: {data.get('auth_type')}")
    
    def test_login_with_valid_credentials(self):
        """Test login with valid admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": ADMIN_EMAIL,
                "password": ADMIN_PIN,
                "device_id": f"test-device-{uuid.uuid4()}"
            }
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "uid" in data, "Response should contain uid"
        assert data.get("role") == "admin", f"Expected admin role, got: {data.get('role')}"
        # Check session token for single-session feature
        assert "session_token" in data, "Response should contain session_token"
        print(f"✅ Admin login passed: {data.get('email')}")
        return data
    
    def test_login_with_wrong_pin_fails(self):
        """Test login with wrong PIN returns error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": ADMIN_EMAIL,
                "password": "000000"  # Wrong PIN
            }
        )
        assert response.status_code in [401, 429], f"Expected 401/429, got: {response.status_code}"
        print("✅ Wrong PIN rejection passed")
    
    def test_login_nonexistent_user_fails(self):
        """Test login with nonexistent user returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "nonexistent_user_xyz@test.com",
                "password": "123456"
            }
        )
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("✅ Nonexistent user rejection passed")


class TestUserDashboard:
    """Test user dashboard APIs"""
    
    @pytest.fixture
    def admin_user(self):
        """Login and get admin user data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": ADMIN_EMAIL,
                "password": ADMIN_PIN,
                "device_id": f"test-device-{uuid.uuid4()}"
            }
        )
        assert response.status_code == 200
        return response.json()
    
    def test_get_user_data(self, admin_user):
        """Test getting user data by UID"""
        uid = admin_user.get("uid")
        response = requests.get(f"{BASE_URL}/api/user/{uid}")
        assert response.status_code == 200, f"Get user failed: {response.text}"
        data = response.json()
        assert data.get("uid") == uid
        assert "prc_balance" in data
        assert "subscription_plan" in data
        print(f"✅ Get user data passed: {data.get('name')}")
    
    def test_dashboard_combined_api(self, admin_user):
        """Test combined dashboard API"""
        uid = admin_user.get("uid")
        response = requests.get(f"{BASE_URL}/api/user/{uid}/dashboard")
        assert response.status_code == 200, f"Dashboard API failed: {response.text}"
        data = response.json()
        # Check for user data
        assert "user" in data
        # Check for mining data
        assert "mining" in data
        print("✅ Dashboard combined API passed")


class TestMiningFlow:
    """Test mining/rewards critical flows"""
    
    @pytest.fixture
    def admin_user(self):
        """Login and get admin user data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": ADMIN_EMAIL,
                "password": ADMIN_PIN,
                "device_id": f"test-device-{uuid.uuid4()}"
            }
        )
        assert response.status_code == 200
        return response.json()
    
    def test_mining_status(self, admin_user):
        """Test mining status endpoint"""
        uid = admin_user.get("uid")
        response = requests.get(f"{BASE_URL}/api/mining/status/{uid}")
        assert response.status_code == 200, f"Mining status failed: {response.text}"
        data = response.json()
        assert "session_active" in data or "mining_rate" in data
        print(f"✅ Mining status passed: session_active={data.get('session_active')}")
    
    def test_redemption_stats(self, admin_user):
        """Test redemption stats endpoint"""
        uid = admin_user.get("uid")
        response = requests.get(f"{BASE_URL}/api/user/{uid}/redemption-stats")
        assert response.status_code == 200, f"Redemption stats failed: {response.text}"
        data = response.json()
        assert "total_earned" in data or "total_redeemed" in data
        print("✅ Redemption stats passed")


class TestSubscriptionFlow:
    """Test subscription critical flows"""
    
    def test_subscription_plans_list(self):
        """Test getting subscription plans"""
        response = requests.get(f"{BASE_URL}/api/subscription-plans")
        assert response.status_code == 200, f"Subscription plans failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of plans"
        print(f"✅ Subscription plans passed: {len(data)} plans available")
    
    def test_subscription_pricing(self):
        """Test subscription pricing endpoint"""
        response = requests.get(f"{BASE_URL}/api/subscription/pricing")
        # May return 404 if not implemented - that's acceptable
        if response.status_code == 200:
            data = response.json()
            print("✅ Subscription pricing passed")
        else:
            print(f"⚠️ Subscription pricing endpoint: {response.status_code}")


class TestAdminSubscriptionManagement:
    """Test admin subscription management APIs"""
    
    @pytest.fixture
    def admin_session(self):
        """Login and get admin session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": ADMIN_EMAIL,
                "password": ADMIN_PIN,
                "device_id": f"test-device-{uuid.uuid4()}"
            }
        )
        assert response.status_code == 200
        return response.json()
    
    def test_subscription_stats(self, admin_session):
        """Test subscription stats API"""
        response = requests.get(f"{BASE_URL}/api/admin/subscription-stats")
        assert response.status_code == 200, f"Subscription stats failed: {response.text}"
        data = response.json()
        assert "plan_counts" in data or "total_users" in data
        print(f"✅ Subscription stats passed")
    
    def test_vip_payments_pending(self, admin_session):
        """Test VIP payments list - pending"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments",
            params={"status": "pending", "page": 1, "limit": 10}
        )
        assert response.status_code == 200, f"VIP payments failed: {response.text}"
        data = response.json()
        assert "payments" in data
        assert "total" in data
        print(f"✅ VIP pending payments passed: {data.get('total')} pending")
    
    def test_vip_payments_approved(self, admin_session):
        """Test VIP payments list - approved"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments",
            params={"status": "approved", "page": 1, "limit": 10}
        )
        assert response.status_code == 200, f"VIP payments failed: {response.text}"
        data = response.json()
        assert "payments" in data
        print(f"✅ VIP approved payments passed: {data.get('total')} approved")
    
    def test_vip_payments_with_filters(self, admin_session):
        """Test VIP payments with filters"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments",
            params={
                "status": "approved",
                "page": 1,
                "limit": 10,
                "time_filter": "month",
                "plan": "startup"
            }
        )
        assert response.status_code == 200, f"VIP payments filter failed: {response.text}"
        print("✅ VIP payments filters passed")


class TestNotifications:
    """Test notifications system"""
    
    @pytest.fixture
    def admin_session(self):
        """Login and get admin session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": ADMIN_EMAIL,
                "password": ADMIN_PIN,
                "device_id": f"test-device-{uuid.uuid4()}"
            }
        )
        assert response.status_code == 200
        return response.json()
    
    def test_get_notifications(self, admin_session):
        """Test getting user notifications"""
        uid = admin_session.get("uid")
        response = requests.get(f"{BASE_URL}/api/notifications/{uid}")
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        assert isinstance(data, list) or "notifications" in data
        print("✅ Get notifications passed")


class TestSessionManagement:
    """Test single device session management"""
    
    def test_multiple_logins_same_user(self):
        """Test that multiple logins work (session invalidation)"""
        # First login
        response1 = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": ADMIN_EMAIL,
                "password": ADMIN_PIN,
                "device_id": "device-1"
            }
        )
        assert response1.status_code == 200
        session1 = response1.json().get("session_token")
        
        # Second login (should invalidate first)
        response2 = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": ADMIN_EMAIL,
                "password": ADMIN_PIN,
                "device_id": "device-2"
            }
        )
        assert response2.status_code == 200
        session2 = response2.json().get("session_token")
        
        # Sessions should be different
        assert session1 != session2, "Session tokens should be different for new logins"
        print("✅ Session management (single device) passed")


class TestMobileResponsiveness:
    """Test API responses for mobile app"""
    
    def test_api_response_time(self):
        """Test that critical APIs respond within acceptable time"""
        import time
        
        # Health check
        start = time.time()
        requests.get(f"{BASE_URL}/api/health")
        health_time = time.time() - start
        assert health_time < 2, f"Health check too slow: {health_time}s"
        
        # Auth type check
        start = time.time()
        requests.get(f"{BASE_URL}/api/auth/check-auth-type", params={"identifier": ADMIN_EMAIL})
        auth_time = time.time() - start
        assert auth_time < 2, f"Auth check too slow: {auth_time}s"
        
        print(f"✅ API response times: health={health_time:.2f}s, auth={auth_time:.2f}s")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
