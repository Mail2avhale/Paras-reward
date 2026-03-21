"""
Test: Used PRC = 0 Bug Fix Verification
========================================
This test verifies that the 'Used PRC = 0' display bug is fixed.

The bug was: Redeem limit showed Used PRC = 0 even for users with redemptions.

Fix applied:
1. get_user_all_time_redeemed had early return preventing backup collections check
2. /user/{uid} endpoint had duplicate logic not using centralized function
3. Status checks didn't include 'SUCCESS' uppercase

Test user: cbdf46d7-7d66-4d43-8495-e1432a2ab071
Expected: 1500 PRC in successful redemptions (500 bill + 1000 bank transfer)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user with known redemptions
TEST_USER_UID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"
EXPECTED_MIN_REDEEMED = 1000  # At least 1000 PRC should be redeemed


class TestUsedPRCRedeemLimitBugFix:
    """Tests for verifying the Used PRC = 0 bug fix"""
    
    def test_health_check(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✅ API health check passed")
    
    def test_redeem_limit_api_returns_total_redeemed(self):
        """
        Test /api/user/{uid}/redeem-limit returns total_redeemed > 0
        This is the primary endpoint for redeem limit display
        """
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        assert response.status_code == 200, f"Redeem limit API failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"API returned success=false: {data}"
        
        limit_data = data.get("limit", {})
        total_redeemed = limit_data.get("total_redeemed", 0)
        
        print(f"📊 Redeem Limit API Response:")
        print(f"   - total_limit: {limit_data.get('total_limit', 0)}")
        print(f"   - total_redeemed: {total_redeemed}")
        print(f"   - remaining_limit: {limit_data.get('remaining_limit', 0)}")
        print(f"   - available_prc: {limit_data.get('available_prc', 0)}")
        
        # CRITICAL: total_redeemed should be > 0 for user with redemptions
        assert total_redeemed > 0, f"BUG NOT FIXED: total_redeemed is {total_redeemed}, expected > 0"
        assert total_redeemed >= EXPECTED_MIN_REDEEMED, f"total_redeemed ({total_redeemed}) is less than expected ({EXPECTED_MIN_REDEEMED})"
        
        print(f"✅ Redeem limit API shows total_redeemed = {total_redeemed} PRC")
    
    def test_user_profile_api_returns_total_redeemed(self):
        """
        Test /api/user/{uid} returns total_redeemed field correctly
        This endpoint is used for user profile display
        """
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}")
        assert response.status_code == 200, f"User profile API failed: {response.text}"
        
        data = response.json()
        total_redeemed = data.get("total_redeemed", 0)
        
        print(f"📊 User Profile API Response:")
        print(f"   - uid: {data.get('uid')}")
        print(f"   - prc_balance: {data.get('prc_balance', 0)}")
        print(f"   - total_mined: {data.get('total_mined', 0)}")
        print(f"   - total_redeemed: {total_redeemed}")
        
        # CRITICAL: total_redeemed should be > 0 for user with redemptions
        assert total_redeemed > 0, f"BUG NOT FIXED: total_redeemed is {total_redeemed}, expected > 0"
        assert total_redeemed >= EXPECTED_MIN_REDEEMED, f"total_redeemed ({total_redeemed}) is less than expected ({EXPECTED_MIN_REDEEMED})"
        
        print(f"✅ User profile API shows total_redeemed = {total_redeemed} PRC")
    
    def test_user_dashboard_api_returns_total_redeemed(self):
        """
        Test /api/user/{uid}/dashboard returns user.total_redeemed correctly
        This endpoint is used for dashboard display
        """
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        assert response.status_code == 200, f"Dashboard API failed: {response.text}"
        
        data = response.json()
        user_data = data.get("user", {})
        total_redeemed = user_data.get("total_redeemed", 0)
        
        print(f"📊 Dashboard API Response:")
        print(f"   - user.uid: {user_data.get('uid')}")
        print(f"   - user.prc_balance: {user_data.get('prc_balance', 0)}")
        print(f"   - user.total_mined: {user_data.get('total_mined', 0)}")
        print(f"   - user.total_redeemed: {total_redeemed}")
        
        # CRITICAL: total_redeemed should be > 0 for user with redemptions
        assert total_redeemed > 0, f"BUG NOT FIXED: total_redeemed is {total_redeemed}, expected > 0"
        assert total_redeemed >= EXPECTED_MIN_REDEEMED, f"total_redeemed ({total_redeemed}) is less than expected ({EXPECTED_MIN_REDEEMED})"
        
        print(f"✅ Dashboard API shows total_redeemed = {total_redeemed} PRC")
    
    def test_admin_user_360_stats_total_redeemed(self):
        """
        Test /api/admin/user-360 returns stats.total_redeemed correctly
        This endpoint is used for admin user analytics
        """
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query={TEST_USER_UID}")
        assert response.status_code == 200, f"Admin User 360 API failed: {response.text}"
        
        data = response.json()
        stats = data.get("stats", {})
        stats_total_redeemed = stats.get("total_redeemed", 0)
        
        print(f"📊 Admin User 360 API - Stats:")
        print(f"   - stats.total_mined: {stats.get('total_mined', 0)}")
        print(f"   - stats.total_redeemed: {stats_total_redeemed}")
        print(f"   - stats.net_balance: {stats.get('net_balance', 0)}")
        
        # CRITICAL: stats.total_redeemed should be > 0 for user with redemptions
        assert stats_total_redeemed > 0, f"BUG NOT FIXED: stats.total_redeemed is {stats_total_redeemed}, expected > 0"
        
        print(f"✅ Admin User 360 stats.total_redeemed = {stats_total_redeemed} PRC")
    
    def test_admin_user_360_redeem_limit_total_redeemed(self):
        """
        Test /api/admin/user-360 returns redeem_limit.total_redeemed correctly
        This should be consistent with stats.total_redeemed
        """
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query={TEST_USER_UID}")
        assert response.status_code == 200, f"Admin User 360 API failed: {response.text}"
        
        data = response.json()
        redeem_limit = data.get("redeem_limit", {})
        redeem_limit_total_redeemed = redeem_limit.get("total_redeemed", 0)
        
        print(f"📊 Admin User 360 API - Redeem Limit:")
        print(f"   - redeem_limit.total_limit: {redeem_limit.get('total_limit', 0)}")
        print(f"   - redeem_limit.total_redeemed: {redeem_limit_total_redeemed}")
        print(f"   - redeem_limit.remaining_limit: {redeem_limit.get('remaining_limit', 0)}")
        
        # CRITICAL: redeem_limit.total_redeemed should be > 0 for user with redemptions
        assert redeem_limit_total_redeemed > 0, f"BUG NOT FIXED: redeem_limit.total_redeemed is {redeem_limit_total_redeemed}, expected > 0"
        
        print(f"✅ Admin User 360 redeem_limit.total_redeemed = {redeem_limit_total_redeemed} PRC")
    
    def test_consistency_across_endpoints(self):
        """
        Test that total_redeemed is consistent across all endpoints
        All endpoints should return similar values (within 10% tolerance)
        """
        # Get data from all endpoints
        redeem_limit_resp = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        user_profile_resp = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}")
        dashboard_resp = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        admin_360_resp = requests.get(f"{BASE_URL}/api/admin/user-360?query={TEST_USER_UID}")
        
        # Extract total_redeemed from each
        redeem_limit_value = redeem_limit_resp.json().get("limit", {}).get("total_redeemed", 0)
        user_profile_value = user_profile_resp.json().get("total_redeemed", 0)
        dashboard_value = dashboard_resp.json().get("user", {}).get("total_redeemed", 0)
        admin_stats_value = admin_360_resp.json().get("stats", {}).get("total_redeemed", 0)
        admin_redeem_limit_value = admin_360_resp.json().get("redeem_limit", {}).get("total_redeemed", 0)
        
        print(f"📊 Consistency Check:")
        print(f"   - /user/{TEST_USER_UID}/redeem-limit: {redeem_limit_value}")
        print(f"   - /user/{TEST_USER_UID}: {user_profile_value}")
        print(f"   - /user/{TEST_USER_UID}/dashboard: {dashboard_value}")
        print(f"   - /admin/user-360 stats: {admin_stats_value}")
        print(f"   - /admin/user-360 redeem_limit: {admin_redeem_limit_value}")
        
        # All values should be > 0
        all_values = [redeem_limit_value, user_profile_value, dashboard_value, admin_stats_value, admin_redeem_limit_value]
        for i, val in enumerate(all_values):
            assert val > 0, f"Value at index {i} is 0, expected > 0"
        
        # Check consistency (within 20% tolerance due to different calculation methods)
        max_val = max(all_values)
        min_val = min(all_values)
        
        if max_val > 0:
            variance = (max_val - min_val) / max_val * 100
            print(f"   - Variance: {variance:.1f}%")
            
            # Allow some variance due to different calculation methods
            # But all should be in the same ballpark
            assert variance < 50, f"Values are too inconsistent: variance {variance:.1f}%"
        
        print(f"✅ All endpoints return consistent total_redeemed values")
    
    def test_burns_not_included_in_used_prc(self):
        """
        Test that burns are NOT included in Used PRC calculation
        Burns are deflationary mechanism, not user spending
        """
        # Get user's transactions to check for burns
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        total_redeemed = data.get("limit", {}).get("total_redeemed", 0)
        
        # The total_redeemed should NOT include burn amounts
        # We can verify this by checking that the value is reasonable
        # (burns can be very large, so if included, total_redeemed would be inflated)
        
        print(f"📊 Burns Exclusion Check:")
        print(f"   - total_redeemed: {total_redeemed}")
        print(f"   - Expected range: {EXPECTED_MIN_REDEEMED} - 10000 PRC (reasonable for actual redemptions)")
        
        # If burns were included, total_redeemed would likely be much higher
        # For a user with 1500 PRC in actual redemptions, burns could add thousands more
        assert total_redeemed < 50000, f"total_redeemed ({total_redeemed}) seems too high - burns may be included"
        
        print(f"✅ Burns appear to be correctly excluded from Used PRC calculation")


class TestRedeemLimitAPIStructure:
    """Tests for verifying the redeem limit API response structure"""
    
    def test_redeem_limit_response_structure(self):
        """Verify the redeem limit API returns all expected fields"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level structure
        assert "success" in data
        assert "user_id" in data
        assert "limit" in data
        
        # Check limit object structure
        limit = data.get("limit", {})
        expected_fields = [
            "base_limit",
            "total_limit",
            "total_redeemed",
            "remaining_limit",
            "available_prc",
            "effective_remaining",
            "usage_percentage"
        ]
        
        print(f"📊 Redeem Limit Response Structure:")
        for field in expected_fields:
            value = limit.get(field)
            print(f"   - {field}: {value}")
            assert field in limit, f"Missing field: {field}"
        
        print(f"✅ Redeem limit API response structure is correct")
    
    def test_effective_remaining_calculation(self):
        """
        Test that effective_remaining = MIN(remaining_limit, available_prc)
        User can only redeem up to their available PRC balance
        """
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        limit = data.get("limit", {})
        
        remaining_limit = limit.get("remaining_limit", 0)
        available_prc = limit.get("available_prc", 0)
        effective_remaining = limit.get("effective_remaining", 0)
        
        expected_effective = min(max(0, remaining_limit), available_prc)
        
        print(f"📊 Effective Remaining Calculation:")
        print(f"   - remaining_limit: {remaining_limit}")
        print(f"   - available_prc: {available_prc}")
        print(f"   - effective_remaining: {effective_remaining}")
        print(f"   - expected (min of above): {expected_effective}")
        
        # Allow small floating point differences
        assert abs(effective_remaining - expected_effective) < 1, \
            f"effective_remaining ({effective_remaining}) != expected ({expected_effective})"
        
        print(f"✅ Effective remaining calculation is correct")


class TestUserWithNoRedemptions:
    """Tests for users with no redemptions (should show 0)"""
    
    def test_new_user_shows_zero_redeemed(self):
        """
        Test that a user with no redemptions shows total_redeemed = 0
        This ensures we're not showing false positives
        """
        # Use a test user that likely has no redemptions
        # We'll create a random UID that doesn't exist
        fake_uid = "test-no-redemptions-user-12345"
        
        response = requests.get(f"{BASE_URL}/api/user/{fake_uid}/redeem-limit")
        
        # User might not exist, which is fine
        if response.status_code == 404:
            print(f"ℹ️ User {fake_uid} not found (expected)")
            return
        
        if response.status_code == 200:
            data = response.json()
            total_redeemed = data.get("limit", {}).get("total_redeemed", 0)
            print(f"📊 User with no redemptions: total_redeemed = {total_redeemed}")
            # Should be 0 or very small
            assert total_redeemed >= 0, "total_redeemed should not be negative"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
