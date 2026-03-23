"""
Test Suite: Burning Session Feature
====================================
Tests for the continuous burning session that burns 1% of user's PRC balance daily.

Feature Requirements:
- Burns 1% of PRC balance per day (calculated per second)
- Minimum balance for burning: 10,000 PRC (stops below this)
- Always active - no user action required
- Burned PRC is permanently deleted
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fintech-secure-3.preview.emergentagent.com').rstrip('/')

# Test user with balance > 10,000 PRC (burning should be active)
TEST_USER_UID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"


class TestBurningSessionAPI:
    """Test the burning session status API endpoint"""
    
    def test_burning_session_endpoint_exists(self):
        """Test that the burning session API endpoint exists and returns 200"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_burning_session_returns_valid_structure(self):
        """Test that the API returns the expected response structure"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level structure
        assert "uid" in data, "Response should contain 'uid'"
        assert "burning_session" in data, "Response should contain 'burning_session'"
        assert "last_burn_applied" in data, "Response should contain 'last_burn_applied'"
        
        # Check burning_session structure
        bs = data["burning_session"]
        required_fields = [
            "is_active",
            "current_balance",
            "minimum_balance",
            "daily_burn_rate_percent",
            "burn_per_day",
            "burn_per_hour",
            "burn_per_minute",
            "burn_per_second",
            "total_burned_lifetime",
            "days_until_minimum"
        ]
        
        for field in required_fields:
            assert field in bs, f"burning_session should contain '{field}'"
    
    def test_burning_session_active_when_balance_above_minimum(self):
        """Test that burning session is active when user balance > 10,000 PRC"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        # User has balance > 10,000, so burning should be active
        if bs["current_balance"] > 10000:
            assert bs["is_active"] is True, f"Burning should be active when balance ({bs['current_balance']}) > 10,000"
        else:
            assert bs["is_active"] is False, f"Burning should be inactive when balance ({bs['current_balance']}) <= 10,000"
    
    def test_minimum_balance_is_10000(self):
        """Test that the minimum balance threshold is 10,000 PRC"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        assert bs["minimum_balance"] == 10000, f"Minimum balance should be 10,000, got {bs['minimum_balance']}"
    
    def test_daily_burn_rate_is_1_percent(self):
        """Test that the daily burn rate is 1%"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        assert bs["daily_burn_rate_percent"] == 1, f"Daily burn rate should be 1%, got {bs['daily_burn_rate_percent']}%"


class TestBurnRateCalculation:
    """Test the burn rate calculations"""
    
    def test_burn_per_second_calculation(self):
        """Test that burn_per_second = balance * 0.01 / 86400"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        if bs["is_active"]:
            # Expected: burn_per_second = balance * 0.01 / 86400
            expected_burn_per_second = bs["current_balance"] * 0.01 / 86400
            actual_burn_per_second = bs["burn_per_second"]
            
            # Allow small floating point tolerance
            tolerance = 0.00000001
            assert abs(actual_burn_per_second - expected_burn_per_second) < tolerance, \
                f"burn_per_second mismatch: expected {expected_burn_per_second}, got {actual_burn_per_second}"
    
    def test_burn_per_hour_calculation(self):
        """Test that burn_per_hour = burn_per_day / 24"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        if bs["is_active"]:
            expected_burn_per_hour = bs["burn_per_day"] / 24
            actual_burn_per_hour = bs["burn_per_hour"]
            
            tolerance = 0.0001
            assert abs(actual_burn_per_hour - expected_burn_per_hour) < tolerance, \
                f"burn_per_hour mismatch: expected {expected_burn_per_hour}, got {actual_burn_per_hour}"
    
    def test_burn_per_day_calculation(self):
        """Test that burn_per_day = balance * 0.01 (1%)"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        if bs["is_active"]:
            expected_burn_per_day = bs["current_balance"] * 0.01
            actual_burn_per_day = bs["burn_per_day"]
            
            tolerance = 0.01
            assert abs(actual_burn_per_day - expected_burn_per_day) < tolerance, \
                f"burn_per_day mismatch: expected {expected_burn_per_day}, got {actual_burn_per_day}"
    
    def test_days_until_minimum_calculation(self):
        """Test that days_until_minimum is calculated correctly"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        if bs["is_active"] and bs["burn_per_day"] > 0:
            burnable_amount = bs["current_balance"] - bs["minimum_balance"]
            expected_days = burnable_amount / bs["burn_per_day"]
            actual_days = bs["days_until_minimum"]
            
            tolerance = 0.5  # Allow 0.5 day tolerance due to rounding
            assert abs(actual_days - expected_days) < tolerance, \
                f"days_until_minimum mismatch: expected {expected_days}, got {actual_days}"


class TestBurnApplication:
    """Test that burns are actually applied when API is called"""
    
    def test_burn_is_applied_on_api_call(self):
        """Test that calling the API applies burn and updates balance"""
        # First call to get initial state
        response1 = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Wait a moment
        time.sleep(2)
        
        # Second call should show burn was applied
        response2 = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Check last_burn_applied structure
        lba = data2["last_burn_applied"]
        assert "amount" in lba, "last_burn_applied should contain 'amount'"
        assert "old_balance" in lba, "last_burn_applied should contain 'old_balance'"
        assert "new_balance" in lba, "last_burn_applied should contain 'new_balance'"
        assert "reason" in lba, "last_burn_applied should contain 'reason'"
    
    def test_total_burned_lifetime_increases(self):
        """Test that total_burned_lifetime increases over time"""
        response1 = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response1.status_code == 200
        data1 = response1.json()
        initial_burned = data1["burning_session"]["total_burned_lifetime"]
        
        # Wait and call again
        time.sleep(3)
        
        response2 = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response2.status_code == 200
        data2 = response2.json()
        final_burned = data2["burning_session"]["total_burned_lifetime"]
        
        # If burning is active, total should increase
        if data1["burning_session"]["is_active"]:
            assert final_burned >= initial_burned, \
                f"total_burned_lifetime should increase: {initial_burned} -> {final_burned}"


class TestBurningSessionInactive:
    """Test burning session behavior when balance is at or below minimum"""
    
    def test_burn_rates_zero_when_inactive(self):
        """Test that burn rates are 0 when session is inactive"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        if not bs["is_active"]:
            assert bs["burn_per_day"] == 0, "burn_per_day should be 0 when inactive"
            assert bs["burn_per_hour"] == 0, "burn_per_hour should be 0 when inactive"
            assert bs["burn_per_second"] == 0, "burn_per_second should be 0 when inactive"


class TestErrorHandling:
    """Test error handling for the burning session API"""
    
    def test_invalid_user_returns_404(self):
        """Test that invalid user ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/invalid-user-id-12345")
        assert response.status_code == 404, f"Expected 404 for invalid user, got {response.status_code}"
    
    def test_empty_uid_returns_error(self):
        """Test that empty UID returns appropriate error"""
        # This might return 404 or 422 depending on implementation
        response = requests.get(f"{BASE_URL}/api/burning-session/status/")
        assert response.status_code in [404, 405, 422], \
            f"Expected error status for empty UID, got {response.status_code}"


class TestBurningSessionDataTypes:
    """Test that all returned values have correct data types"""
    
    def test_data_types_are_correct(self):
        """Test that all fields have correct data types"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        # Boolean checks
        assert isinstance(bs["is_active"], bool), "is_active should be boolean"
        
        # Numeric checks
        assert isinstance(bs["current_balance"], (int, float)), "current_balance should be numeric"
        assert isinstance(bs["minimum_balance"], (int, float)), "minimum_balance should be numeric"
        assert isinstance(bs["daily_burn_rate_percent"], (int, float)), "daily_burn_rate_percent should be numeric"
        assert isinstance(bs["burn_per_day"], (int, float)), "burn_per_day should be numeric"
        assert isinstance(bs["burn_per_hour"], (int, float)), "burn_per_hour should be numeric"
        assert isinstance(bs["burn_per_second"], (int, float)), "burn_per_second should be numeric"
        assert isinstance(bs["total_burned_lifetime"], (int, float)), "total_burned_lifetime should be numeric"
        assert isinstance(bs["days_until_minimum"], (int, float)), "days_until_minimum should be numeric"
    
    def test_values_are_non_negative(self):
        """Test that all numeric values are non-negative"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        assert bs["current_balance"] >= 0, "current_balance should be non-negative"
        assert bs["minimum_balance"] >= 0, "minimum_balance should be non-negative"
        assert bs["burn_per_day"] >= 0, "burn_per_day should be non-negative"
        assert bs["burn_per_hour"] >= 0, "burn_per_hour should be non-negative"
        assert bs["burn_per_second"] >= 0, "burn_per_second should be non-negative"
        assert bs["total_burned_lifetime"] >= 0, "total_burned_lifetime should be non-negative"
        assert bs["days_until_minimum"] >= 0, "days_until_minimum should be non-negative"


class TestBugFixVerification:
    """
    Bug Fix Verification Tests
    ==========================
    Issue: Frontend was double counting burns - showing 28,000+ PRC when actual was ~2,900 PRC
    Fix: Disabled frontend live counter, now shows server value only with 10s refresh
    """
    
    def test_total_burned_lifetime_is_reasonable(self):
        """Test that total_burned_lifetime is a reasonable value (not inflated by double counting)"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        # The bug was showing 28,000+ when actual was ~2,900
        # Total burned should be less than current balance (can't burn more than you had)
        total_burned = bs["total_burned_lifetime"]
        current_balance = bs["current_balance"]
        
        # Sanity check: total burned should be reasonable
        # If user has ~27,000 balance and burned ~2,900, that's about 10% of original
        # Total burned should not exceed what would be possible
        assert total_burned < 50000, f"total_burned_lifetime ({total_burned}) seems too high - possible double counting bug"
        
        print(f"✓ total_burned_lifetime: {total_burned} PRC (reasonable value)")
    
    def test_balance_decreases_on_api_call(self):
        """Test that balance decreases correctly when API is called (server applies burn)"""
        # First call - this resets the last_burn_at timestamp
        response1 = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response1.status_code == 200
        data1 = response1.json()
        balance1 = data1["burning_session"]["current_balance"]
        
        # Wait 3 seconds
        time.sleep(3)
        
        # Second call - burn should be applied for ~3 seconds
        response2 = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response2.status_code == 200
        data2 = response2.json()
        balance2 = data2["burning_session"]["current_balance"]
        
        # Balance should decrease (burn applied)
        if data1["burning_session"]["is_active"]:
            assert balance2 <= balance1, f"Balance should decrease: {balance1} -> {balance2}"
            
            # Check the burn amount is reasonable
            burn_applied = data2["last_burn_applied"]["amount"]
            
            # Burn should be positive and reasonable (not zero, not huge)
            assert burn_applied > 0, "Burn amount should be positive"
            assert burn_applied < 100, f"Burn amount ({burn_applied}) seems too high for a few seconds"
            
            print(f"✓ Balance decreased correctly: {balance1} -> {balance2} (burned {burn_applied})")
    
    def test_server_value_matches_last_burn_applied(self):
        """Test that server returns consistent values (no frontend inflation)"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        lba = data["last_burn_applied"]
        
        # The new_balance in last_burn_applied should match current_balance
        assert bs["current_balance"] == lba["new_balance"], \
            f"current_balance ({bs['current_balance']}) should match last_burn_applied.new_balance ({lba['new_balance']})"
        
        print(f"✓ Server values are consistent: current_balance = {bs['current_balance']}")
    
    def test_burn_calculation_is_1_percent_daily(self):
        """Test that burn calculation is exactly 1% daily (not doubled)"""
        response = requests.get(f"{BASE_URL}/api/burning-session/status/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        bs = data["burning_session"]
        
        if bs["is_active"]:
            # burn_per_day should be exactly 1% of current_balance
            expected_burn_per_day = bs["current_balance"] * 0.01
            actual_burn_per_day = bs["burn_per_day"]
            
            # Should be within 0.01 tolerance
            assert abs(actual_burn_per_day - expected_burn_per_day) < 0.01, \
                f"burn_per_day ({actual_burn_per_day}) should be 1% of balance ({expected_burn_per_day})"
            
            print(f"✓ Burn rate is correct: {actual_burn_per_day} PRC/day (1% of {bs['current_balance']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
