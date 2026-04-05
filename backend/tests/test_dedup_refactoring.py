"""
Test Suite: Deduplication Refactoring Verification
Tests the centralized get_user_all_time_redeemed() function usage across 5 endpoints:
1. GET /api/user/{uid}/redemption-stats - server.py line 8093
2. GET /api/user/{uid}/dashboard - server.py line 7632
3. GET /api/user/{uid}/profile (users.py) - lines 648-649
4. GET /api/user/stats/redeemed/{uid} (users.py) - lines 648-649
5. GET /api/prc-statement/usage-history/{uid} - prc_statement.py

Key verification:
- No 500 errors on any endpoint
- total_redeemed is consistent across all endpoints for the same user
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test users from test_credentials.md
PRIMARY_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
PRIMARY_USER_MOBILE = "9970100782"
PRIMARY_USER_PIN = "997010"

PRC_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self):
        """Verify API is healthy before running other tests"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"API not healthy: {data}"
        print(f"✅ Health check passed: {data}")


class TestRedemptionStatsEndpoint:
    """Test GET /api/user/{uid}/redemption-stats - uses get_user_all_time_redeemed"""
    
    def test_redemption_stats_returns_200(self):
        """Verify redemption-stats endpoint returns 200 for valid user"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redemption-stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✅ redemption-stats returned 200: {data.get('total_prc_redeemed', 'N/A')} PRC redeemed")
    
    def test_redemption_stats_has_total_prc_redeemed(self):
        """Verify response contains total_prc_redeemed field"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redemption-stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_prc_redeemed" in data, f"Missing total_prc_redeemed field: {data.keys()}"
        assert isinstance(data["total_prc_redeemed"], (int, float)), f"total_prc_redeemed should be numeric"
        print(f"✅ total_prc_redeemed = {data['total_prc_redeemed']}")
    
    def test_redemption_stats_prc_user(self):
        """Test redemption-stats for PRC test user"""
        response = requests.get(f"{BASE_URL}/api/user/{PRC_USER_UID}/redemption-stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total_prc_redeemed" in data
        print(f"✅ PRC user redemption-stats: {data.get('total_prc_redeemed', 'N/A')} PRC")
    
    def test_redemption_stats_invalid_user_404(self):
        """Verify 404 for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/user/invalid-uid-12345/redemption-stats")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Invalid user returns 404 as expected")


class TestDashboardEndpoint:
    """Test GET /api/user/{uid}/dashboard - uses get_user_all_time_redeemed"""
    
    def test_dashboard_returns_200(self):
        """Verify dashboard endpoint returns 200 for valid user"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✅ dashboard returned 200")
    
    def test_dashboard_has_total_redeemed(self):
        """Verify dashboard response contains user.total_redeemed field"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "user" in data, f"Missing 'user' field: {data.keys()}"
        user_data = data["user"]
        assert "total_redeemed" in user_data, f"Missing total_redeemed in user: {user_data.keys()}"
        assert isinstance(user_data["total_redeemed"], (int, float)), "total_redeemed should be numeric"
        print(f"✅ dashboard user.total_redeemed = {user_data['total_redeemed']}")
    
    def test_dashboard_prc_user(self):
        """Test dashboard for PRC test user"""
        response = requests.get(f"{BASE_URL}/api/user/{PRC_USER_UID}/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user" in data
        assert "total_redeemed" in data["user"]
        print(f"✅ PRC user dashboard total_redeemed = {data['user']['total_redeemed']}")


class TestUserStatsRedeemedEndpoint:
    """Test GET /api/user/stats/redeemed/{uid} - uses get_user_all_time_redeemed"""
    
    def test_stats_redeemed_returns_200(self):
        """Verify user stats redeemed endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/user/stats/redeemed/{PRIMARY_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✅ stats/redeemed returned 200")
    
    def test_stats_redeemed_has_total_redeemed(self):
        """Verify response contains total_redeemed field"""
        response = requests.get(f"{BASE_URL}/api/user/stats/redeemed/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "total_redeemed" in data, f"Missing total_redeemed: {data.keys()}"
        assert isinstance(data["total_redeemed"], (int, float)), "total_redeemed should be numeric"
        print(f"✅ stats/redeemed total_redeemed = {data['total_redeemed']}")


class TestUsageHistoryEndpoint:
    """Test GET /api/prc-statement/usage-history/{uid} - uses dedup logic"""
    
    def test_usage_history_returns_200(self):
        """Verify usage-history endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRIMARY_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Expected success=True: {data}"
        print(f"✅ usage-history returned 200 with success=True")
    
    def test_usage_history_has_summary(self):
        """Verify response contains summary with total_used"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data, f"Missing summary: {data.keys()}"
        summary = data["summary"]
        assert "total_used" in summary, f"Missing total_used in summary: {summary.keys()}"
        print(f"✅ usage-history summary.total_used = {summary['total_used']}")
    
    def test_usage_history_no_burns(self):
        """Verify usage-history excludes burns (only service categories)"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        by_category = data.get("summary", {}).get("by_category", {})
        
        # Burns should NOT be in the categories
        excluded_categories = ["Burn", "Admin", "Admin Credit", "Admin Debit", "Other", "Reward", "Refund"]
        for cat in excluded_categories:
            assert cat not in by_category, f"Found excluded category '{cat}' in usage-history"
        
        print(f"✅ usage-history correctly excludes burns. Categories: {list(by_category.keys())}")


class TestConsistencyAcrossEndpoints:
    """
    CRITICAL: Verify total_redeemed is CONSISTENT across all endpoints.
    This is the main test for the deduplication refactoring.
    """
    
    def test_primary_user_consistency(self):
        """Verify total_redeemed is consistent across all endpoints for primary user"""
        # Get values from all endpoints
        redemption_stats = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redemption-stats").json()
        dashboard = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/dashboard").json()
        stats_redeemed = requests.get(f"{BASE_URL}/api/user/stats/redeemed/{PRIMARY_USER_UID}").json()
        usage_history = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRIMARY_USER_UID}").json()
        
        # Extract values
        val_redemption_stats = redemption_stats.get("total_prc_redeemed", 0)
        val_dashboard = dashboard.get("user", {}).get("total_redeemed", 0)
        val_stats_redeemed = stats_redeemed.get("total_redeemed", 0)
        val_usage_history = usage_history.get("summary", {}).get("total_used", 0)
        
        print(f"\n📊 PRIMARY USER ({PRIMARY_USER_UID}) total_redeemed values:")
        print(f"   redemption-stats: {val_redemption_stats}")
        print(f"   dashboard:        {val_dashboard}")
        print(f"   stats/redeemed:   {val_stats_redeemed}")
        print(f"   usage-history:    {val_usage_history}")
        
        # All values should be equal (within small tolerance for rounding)
        tolerance = 1.0  # Allow 1 PRC difference for rounding
        
        # Compare redemption-stats with dashboard
        diff1 = abs(val_redemption_stats - val_dashboard)
        assert diff1 <= tolerance, f"redemption-stats ({val_redemption_stats}) != dashboard ({val_dashboard}), diff={diff1}"
        
        # Compare dashboard with stats/redeemed
        diff2 = abs(val_dashboard - val_stats_redeemed)
        assert diff2 <= tolerance, f"dashboard ({val_dashboard}) != stats/redeemed ({val_stats_redeemed}), diff={diff2}"
        
        # Compare stats/redeemed with usage-history
        diff3 = abs(val_stats_redeemed - val_usage_history)
        assert diff3 <= tolerance, f"stats/redeemed ({val_stats_redeemed}) != usage-history ({val_usage_history}), diff={diff3}"
        
        print(f"✅ All endpoints return consistent total_redeemed values (within {tolerance} PRC tolerance)")
    
    def test_prc_user_consistency(self):
        """Verify total_redeemed is consistent across all endpoints for PRC user"""
        # Get values from all endpoints
        redemption_stats = requests.get(f"{BASE_URL}/api/user/{PRC_USER_UID}/redemption-stats").json()
        dashboard = requests.get(f"{BASE_URL}/api/user/{PRC_USER_UID}/dashboard").json()
        stats_redeemed = requests.get(f"{BASE_URL}/api/user/stats/redeemed/{PRC_USER_UID}").json()
        usage_history = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRC_USER_UID}").json()
        
        # Extract values
        val_redemption_stats = redemption_stats.get("total_prc_redeemed", 0)
        val_dashboard = dashboard.get("user", {}).get("total_redeemed", 0)
        val_stats_redeemed = stats_redeemed.get("total_redeemed", 0)
        val_usage_history = usage_history.get("summary", {}).get("total_used", 0)
        
        print(f"\n📊 PRC USER ({PRC_USER_UID}) total_redeemed values:")
        print(f"   redemption-stats: {val_redemption_stats}")
        print(f"   dashboard:        {val_dashboard}")
        print(f"   stats/redeemed:   {val_stats_redeemed}")
        print(f"   usage-history:    {val_usage_history}")
        
        # All values should be equal (within small tolerance for rounding)
        tolerance = 1.0
        
        diff1 = abs(val_redemption_stats - val_dashboard)
        assert diff1 <= tolerance, f"redemption-stats ({val_redemption_stats}) != dashboard ({val_dashboard})"
        
        diff2 = abs(val_dashboard - val_stats_redeemed)
        assert diff2 <= tolerance, f"dashboard ({val_dashboard}) != stats/redeemed ({val_stats_redeemed})"
        
        diff3 = abs(val_stats_redeemed - val_usage_history)
        assert diff3 <= tolerance, f"stats/redeemed ({val_stats_redeemed}) != usage-history ({val_usage_history})"
        
        print(f"✅ PRC user: All endpoints return consistent total_redeemed values")


class TestNoServerErrors:
    """Verify no 500 errors on any of the refactored endpoints"""
    
    def test_no_500_on_redemption_stats(self):
        """Ensure redemption-stats doesn't return 500"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redemption-stats")
        assert response.status_code != 500, f"Got 500 error: {response.text}"
        print("✅ redemption-stats: No 500 error")
    
    def test_no_500_on_dashboard(self):
        """Ensure dashboard doesn't return 500"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/dashboard")
        assert response.status_code != 500, f"Got 500 error: {response.text}"
        print("✅ dashboard: No 500 error")
    
    def test_no_500_on_stats_redeemed(self):
        """Ensure stats/redeemed doesn't return 500"""
        response = requests.get(f"{BASE_URL}/api/user/stats/redeemed/{PRIMARY_USER_UID}")
        assert response.status_code != 500, f"Got 500 error: {response.text}"
        print("✅ stats/redeemed: No 500 error")
    
    def test_no_500_on_usage_history(self):
        """Ensure usage-history doesn't return 500"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRIMARY_USER_UID}")
        assert response.status_code != 500, f"Got 500 error: {response.text}"
        print("✅ usage-history: No 500 error")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
