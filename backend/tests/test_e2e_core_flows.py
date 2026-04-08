"""
E2E Backend Tests for PARAS REWARD App
Tests core flows: Login, Dashboard, Growth Network, Subscription, Redeem Limit
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PRIMARY_USER_MOBILE = "9970100782"
PRIMARY_USER_PIN = "997010"
PRIMARY_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"

PRC_USER_MOBILE = "9421331342"
PRC_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✅ Health check passed: {data}")


class TestAuthentication:
    """Authentication flow tests"""
    
    def test_login_with_mobile_and_pin(self):
        """Test login with mobile number and PIN"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": PRIMARY_USER_MOBILE,
            "pin": PRIMARY_USER_PIN
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "uid" in data
        assert "token" in data or "access_token" in data
        assert data["uid"] == PRIMARY_USER_UID
        print(f"✅ Login successful for user: {data.get('name', 'Unknown')}")
    
    def test_login_with_identifier_and_password(self):
        """Test login with identifier (mobile) and password (PIN)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": PRIMARY_USER_MOBILE,
            "password": PRIMARY_USER_PIN
        })
        assert response.status_code == 200
        data = response.json()
        assert "uid" in data
        print(f"✅ Login with identifier/password successful")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns error"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": PRIMARY_USER_MOBILE,
            "pin": "000000"
        })
        assert response.status_code in [401, 400, 429]
        print(f"✅ Invalid credentials rejected with status {response.status_code}")
    
    def test_check_auth_type(self):
        """Test check-auth-type endpoint for existing user"""
        response = requests.get(f"{BASE_URL}/api/auth/check-auth-type", params={
            "identifier": PRIMARY_USER_MOBILE
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("user_exists") == True
        print(f"✅ Auth type check passed: user_exists={data.get('user_exists')}")


class TestDashboard:
    """Dashboard API tests"""
    
    def test_user_dashboard(self):
        """Test user dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Verify dashboard structure
        assert "user" in data
        assert "mining" in data
        
        user = data["user"]
        assert user["uid"] == PRIMARY_USER_UID
        assert "prc_balance" in user
        assert "subscription_plan" in user
        assert "referral_code" in user
        
        print(f"✅ Dashboard loaded: PRC Balance={user.get('prc_balance')}, Plan={user.get('subscription_plan')}")
    
    def test_performance_summary(self):
        """Test performance summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/performance-summary")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        
        summary = data["data"]
        assert "total_subscription_paid_inr" in summary
        assert "total_rewards_redeemed_inr" in summary
        assert "available_prc_balance" in summary
        
        print(f"✅ Performance summary: Paid={summary.get('total_subscription_paid_inr')}, Redeemed={summary.get('total_rewards_redeemed_inr')}")


class TestMining:
    """Mining API tests"""
    
    def test_mining_status(self):
        """Test mining status endpoint"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify mining status structure
        assert "mining_active" in data
        assert "mined_coins" in data
        assert "mining_rate" in data
        assert "network_size" in data
        assert "direct_referrals" in data
        
        print(f"✅ Mining status: Active={data.get('mining_active')}, Mined={data.get('mined_coins')}, Rate={data.get('mining_rate_per_hour')}/hr")


class TestGrowthNetwork:
    """Growth Network API tests"""
    
    def test_network_stats(self):
        """Test growth network stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        
        stats = data["data"]
        assert "direct_referrals" in stats
        assert "network_size" in stats
        assert "network_cap" in stats
        assert "redeem_limit_percent" in stats
        
        print(f"✅ Network stats: Direct={stats.get('direct_referrals')}, Size={stats.get('network_size')}, Cap={stats.get('network_cap')}")
    
    def test_referral_list(self):
        """Test referral list endpoint - uses user children endpoint"""
        # The referral list is fetched via /api/users/children/{uid} endpoint
        response = requests.get(f"{BASE_URL}/api/users/children/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # Should return children and count
        assert "children" in data
        assert "count" in data
        
        print(f"✅ Referral list: {data.get('count', 0)} referrals found")


class TestRedeemLimit:
    """Redeem Limit API tests"""
    
    def test_redeem_limit(self):
        """Test redeem limit endpoint"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redeem-limit")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "limit" in data
        
        limit = data["limit"]
        assert "unlock_percent" in limit
        assert "total_limit" in limit
        assert "total_redeemed" in limit
        assert "available" in limit
        
        print(f"✅ Redeem limit: Unlock={limit.get('unlock_percent')}%, Total={limit.get('total_limit')}, Available={limit.get('available')}")


class TestSubscription:
    """Subscription API tests"""
    
    def test_subscription_plans(self):
        """Test subscription plans endpoint"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of plans
        assert isinstance(data, list) or "plans" in data
        print(f"✅ Subscription plans endpoint working")
    
    def test_user_subscription_history(self):
        """Test user subscription history"""
        response = requests.get(f"{BASE_URL}/api/subscription/history/{PRIMARY_USER_UID}")
        # May return 200 or 404 if no history
        assert response.status_code in [200, 404]
        print(f"✅ Subscription history endpoint working (status: {response.status_code})")


class TestUserProfile:
    """User Profile API tests"""
    
    def test_get_user_profile(self):
        """Test get user profile endpoint"""
        response = requests.get(f"{BASE_URL}/api/users/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify user data
        assert data.get("uid") == PRIMARY_USER_UID
        assert "name" in data or "first_name" in data
        
        # Security check: sensitive fields should NOT be exposed
        assert "password_hash" not in data
        assert "security_pin_hash" not in data
        
        print(f"✅ User profile loaded: {data.get('name', 'Unknown')}")
    
    def test_user_profile_excludes_sensitive_data(self):
        """Verify sensitive data is not exposed in user profile"""
        response = requests.get(f"{BASE_URL}/api/users/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        sensitive_fields = ["password_hash", "security_pin_hash", "pin_reset_token", "pin_reset_expiry"]
        for field in sensitive_fields:
            assert field not in data, f"Sensitive field '{field}' should not be in response"
        
        print(f"✅ Sensitive data properly excluded from user profile")


class TestSecondaryUser:
    """Tests with secondary (PRC) user"""
    
    def test_prc_user_network_stats(self):
        """Test network stats for PRC user"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{PRC_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✅ PRC user network stats loaded")
    
    def test_prc_user_redeem_limit(self):
        """Test redeem limit for PRC user"""
        response = requests.get(f"{BASE_URL}/api/user/{PRC_USER_UID}/redeem-limit")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✅ PRC user redeem limit loaded")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
