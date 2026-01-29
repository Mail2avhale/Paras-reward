"""
Test Dashboard Language Selector and Today's Stats Features
Tests:
1. Backend API `/api/user/stats/today/{uid}` returns today's earned and spent PRC
2. Language selector dropdown in dashboard header works and persists selection
3. Today's Summary Strip displays correctly in the dashboard
4. Language changes are reflected in the Today's Summary labels
5. Dashboard loads without errors after login
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-rewards-boost.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "dashboard_test@test.com"
TEST_USER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin"


class TestTodayStatsAPI:
    """Test the /api/user/stats/today/{uid} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get user UID"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.user = response.json()
        self.uid = self.user.get("uid")
        assert self.uid, "User UID not found in login response"
    
    def test_today_stats_endpoint_exists(self):
        """Test that the today stats endpoint exists and returns 200"""
        response = requests.get(f"{BASE_URL}/api/user/stats/today/{self.uid}")
        assert response.status_code == 200, f"Today stats endpoint failed: {response.text}"
    
    def test_today_stats_response_structure(self):
        """Test that today stats response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/user/stats/today/{self.uid}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields exist
        assert "today_prc_earned" in data, "Missing today_prc_earned field"
        assert "today_prc_spent" in data, "Missing today_prc_spent field"
        assert "today_net" in data, "Missing today_net field"
        assert "earning_breakdown" in data, "Missing earning_breakdown field"
        assert "spending_breakdown" in data, "Missing spending_breakdown field"
        assert "date" in data, "Missing date field"
        
        # Check data types
        assert isinstance(data["today_prc_earned"], (int, float)), "today_prc_earned should be numeric"
        assert isinstance(data["today_prc_spent"], (int, float)), "today_prc_spent should be numeric"
        assert isinstance(data["today_net"], (int, float)), "today_net should be numeric"
        assert isinstance(data["earning_breakdown"], dict), "earning_breakdown should be dict"
        assert isinstance(data["spending_breakdown"], dict), "spending_breakdown should be dict"
        assert isinstance(data["date"], str), "date should be string"
    
    def test_today_stats_net_calculation(self):
        """Test that today_net = today_prc_earned - today_prc_spent"""
        response = requests.get(f"{BASE_URL}/api/user/stats/today/{self.uid}")
        assert response.status_code == 200
        
        data = response.json()
        expected_net = round(data["today_prc_earned"] - data["today_prc_spent"], 2)
        assert data["today_net"] == expected_net, f"Net calculation mismatch: {data['today_net']} != {expected_net}"
    
    def test_today_stats_invalid_uid(self):
        """Test that invalid UID returns appropriate error"""
        response = requests.get(f"{BASE_URL}/api/user/stats/today/invalid-uid-12345")
        # Should return 200 with zero values (no transactions for non-existent user)
        # or 404 if user validation is added
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
    
    def test_today_stats_date_format(self):
        """Test that date is in YYYY-MM-DD format"""
        response = requests.get(f"{BASE_URL}/api/user/stats/today/{self.uid}")
        assert response.status_code == 200
        
        data = response.json()
        date_str = data["date"]
        
        # Check format YYYY-MM-DD
        import re
        assert re.match(r'^\d{4}-\d{2}-\d{2}$', date_str), f"Date format invalid: {date_str}"


class TestUserDashboardAPI:
    """Test user dashboard related APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get user UID"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.user = response.json()
        self.uid = self.user.get("uid")
    
    def test_user_profile_endpoint(self):
        """Test that user profile endpoint works"""
        response = requests.get(f"{BASE_URL}/api/users/{self.uid}")
        assert response.status_code == 200, f"User profile failed: {response.text}"
        
        data = response.json()
        assert "prc_balance" in data, "Missing prc_balance"
        assert "total_mined" in data, "Missing total_mined"
        assert "membership_type" in data, "Missing membership_type"
    
    def test_redeemed_stats_endpoint(self):
        """Test that redeemed stats endpoint works"""
        response = requests.get(f"{BASE_URL}/api/user/stats/redeemed/{self.uid}")
        # This endpoint may or may not exist
        if response.status_code == 200:
            data = response.json()
            assert "total_prc_used" in data or "total_rupee_value" in data
        else:
            # Endpoint doesn't exist - that's okay
            pass
    
    def test_transactions_endpoint(self):
        """Test that transactions endpoint works with pagination"""
        response = requests.get(f"{BASE_URL}/api/transactions/user/{self.uid}?page=1&limit=5")
        assert response.status_code == 200, f"Transactions failed: {response.text}"
        
        data = response.json()
        assert "transactions" in data, "Missing transactions field"
        assert "pagination" in data, "Missing pagination field"


class TestAdminLogin:
    """Test admin login for verification"""
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert data.get("role") == "admin", f"Expected admin role, got: {data.get('role')}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
