"""
Test Live Platform Features - Google Play Compliant
Tests for:
1. Live Mining Indicator
2. Live Transparency Panel
3. /api/public/live-stats endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestLiveStatsAPI:
    """Test /api/public/live-stats endpoint"""
    
    def test_live_stats_endpoint_exists(self):
        """Test that live-stats endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/public/live-stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_live_stats_response_structure(self):
        """Test that response has all required fields"""
        response = requests.get(f"{BASE_URL}/api/public/live-stats")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check all required fields exist
        required_fields = ['today_prc_earned', 'today_prc_burned', 'redeems_today', 'active_users', 'timestamp']
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
    
    def test_live_stats_data_types(self):
        """Test that response fields have correct data types"""
        response = requests.get(f"{BASE_URL}/api/public/live-stats")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check data types
        assert isinstance(data['today_prc_earned'], (int, float)), "today_prc_earned should be numeric"
        assert isinstance(data['today_prc_burned'], (int, float)), "today_prc_burned should be numeric"
        assert isinstance(data['redeems_today'], int), "redeems_today should be integer"
        assert isinstance(data['active_users'], int), "active_users should be integer"
        assert isinstance(data['timestamp'], str), "timestamp should be string"
    
    def test_live_stats_values_non_negative(self):
        """Test that all numeric values are non-negative"""
        response = requests.get(f"{BASE_URL}/api/public/live-stats")
        assert response.status_code == 200
        
        data = response.json()
        
        assert data['today_prc_earned'] >= 0, "today_prc_earned should be non-negative"
        assert data['today_prc_burned'] >= 0, "today_prc_burned should be non-negative"
        assert data['redeems_today'] >= 0, "redeems_today should be non-negative"
        assert data['active_users'] >= 0, "active_users should be non-negative"
    
    def test_live_stats_no_auth_required(self):
        """Test that endpoint is public (no auth required)"""
        # Make request without any auth headers
        response = requests.get(f"{BASE_URL}/api/public/live-stats", headers={})
        assert response.status_code == 200, "Public endpoint should not require authentication"


class TestUserDashboardAPIs:
    """Test user dashboard related APIs"""
    
    def test_user_login(self):
        """Test user login with VIP credentials (query params)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": "final_test_vip@test.com", "password": "testpass123"}
        )
        # Login may return 200 or 404 depending on user existence
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
    
    def test_admin_login(self):
        """Test admin login (query params)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": "admin@paras.com", "password": "admin"}
        )
        assert response.status_code == 200, f"Admin login failed: {response.status_code}"
        
        data = response.json()
        assert 'uid' in data, "Login response should contain uid"
        assert data.get('role') == 'admin', "User should be admin"


class TestMasterSummaryAPI:
    """Test master summary API for Quick View mode"""
    
    def test_master_summary_endpoint(self):
        """Test master summary endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_master_summary_structure(self):
        """Test master summary has correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check main sections
        assert 'income' in data, "Missing income section"
        assert 'expense' in data, "Missing expense section"
        assert 'net_profit_loss' in data, "Missing net_profit_loss"
        assert 'prc_stats' in data, "Missing prc_stats section"
    
    def test_master_summary_income_breakdown(self):
        """Test income breakdown has all categories"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        assert response.status_code == 200
        
        data = response.json()
        income = data.get('income', {})
        
        # Check income categories
        expected_categories = ['ad_revenue', 'subscription', 'commission', 'interest', 'penalty_forfeit', 'total']
        for cat in expected_categories:
            assert cat in income, f"Missing income category: {cat}"
    
    def test_master_summary_expense_breakdown(self):
        """Test expense breakdown has all categories"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        assert response.status_code == 200
        
        data = response.json()
        expense = data.get('expense', {})
        
        # Check expense categories
        expected_categories = ['operational', 'redeem_payouts', 'total']
        for cat in expected_categories:
            assert cat in expense, f"Missing expense category: {cat}"
    
    def test_master_summary_prc_stats(self):
        """Test PRC stats has all metrics"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        assert response.status_code == 200
        
        data = response.json()
        prc_stats = data.get('prc_stats', {})
        
        # Check PRC stats
        expected_metrics = ['total_in_system', 'inr_liability', 'conversion_rate']
        for metric in expected_metrics:
            assert metric in prc_stats, f"Missing PRC stat: {metric}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
