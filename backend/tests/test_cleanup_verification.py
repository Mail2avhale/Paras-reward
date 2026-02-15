"""
Test suite to verify app functionality after codebase cleanup.
Tests: health check, admin stats, mining status, user dashboard APIs.
"""
import pytest
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data - existing user from database
TEST_USER_UID = "900253b5-b917-4e6b-b26a-731b6fe112dd"
ADMIN_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"

class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "database" in data
        assert data["service"] == "paras-reward-api"
        print(f"✓ Health check passed: {data}")

    def test_root_endpoint(self):
        """Test root / endpoint returns ok"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print(f"✓ Root endpoint passed: {data}")


class TestAdminStats:
    """Admin stats API tests"""
    
    def test_admin_stats_endpoint(self):
        """Test /api/admin/stats returns valid statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "users" in data
        assert "total" in data["users"]
        assert data["users"]["total"] > 0
        
        # Check subscription stats
        assert "subscription_stats" in data
        assert "explorer" in data["subscription_stats"]
        assert "startup" in data["subscription_stats"]
        assert "growth" in data["subscription_stats"]
        assert "elite" in data["subscription_stats"]
        
        # Check PRC circulation
        assert "prc" in data or "total_prc" in data
        
        print(f"✓ Admin stats: {data['users']['total']} total users, {data['subscription_stats']}")


class TestMiningStatus:
    """Mining status API tests"""
    
    def test_mining_status_valid_user(self):
        """Test /api/mining/status/{uid} for existing user"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "current_balance" in data
        assert "mining_rate" in data
        assert "base_rate" in data
        assert "total_mined" in data
        assert "session_active" in data or "is_mining" in data
        
        print(f"✓ Mining status: balance={data['current_balance']}, rate={data['mining_rate']}")
    
    def test_mining_status_invalid_user(self):
        """Test /api/mining/status/{uid} for non-existent user returns 404"""
        response = requests.get(f"{BASE_URL}/api/mining/status/invalid-user-id-12345")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print(f"✓ Mining status correctly returns 404 for invalid user")


class TestUserDashboard:
    """User dashboard API tests"""
    
    def test_user_dashboard_valid_user(self):
        """Test /api/user/{uid}/dashboard for existing user"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "user" in data
        assert "uid" in data["user"]
        assert "prc_balance" in data["user"]
        assert "subscription_plan" in data["user"]
        
        # Check mining info
        assert "mining" in data
        
        # Check recent activity
        assert "recent_activity" in data
        
        print(f"✓ Dashboard: user={data['user']['name']}, plan={data['user']['subscription_plan']}, balance={data['user']['prc_balance']}")
    
    def test_user_dashboard_invalid_user(self):
        """Test /api/user/{uid}/dashboard for non-existent user returns 404"""
        response = requests.get(f"{BASE_URL}/api/user/invalid-user-id-12345/dashboard")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print(f"✓ Dashboard correctly returns 404 for invalid user")


class TestCacheStats:
    """Cache system stats tests"""
    
    def test_cache_stats_endpoint(self):
        """Test /api/cache/stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/cache/stats")
        assert response.status_code == 200
        data = response.json()
        assert "cache" in data or "status" in data
        print(f"✓ Cache stats: {data}")


class TestUserEndpoint:
    """User profile endpoint tests"""
    
    def test_user_profile_valid(self):
        """Test /api/user/{uid} for existing user"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "uid" in data
        assert data["uid"] == TEST_USER_UID
        print(f"✓ User profile: {data.get('name', 'N/A')}, email={data.get('email', 'N/A')}")
    
    def test_user_profile_invalid(self):
        """Test /api/user/{uid} for non-existent user returns 404"""
        response = requests.get(f"{BASE_URL}/api/user/invalid-user-12345")
        assert response.status_code == 404
        print(f"✓ User profile correctly returns 404 for invalid user")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
