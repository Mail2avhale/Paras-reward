"""
Test suite for 5-Level Referral Mining Speed Calculation
Verifies: Base + L1 + L2 + L3 + L4 + L5 = TOTAL

Test user: root_cb83@test.com (uid: root_cb83, PIN: 123456)
Expected referrals:
  - L1: 3 users (2 paid, 1 free)
  - L2: 6 users (6 paid)
  - L3: 6 users (3 paid, 3 free)
  - L4: 6 users (6 paid)
  - L5: 6 users (4 paid, 2 free)
"""

import pytest
import requests
import os
import math

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMiningCalculation:
    """Test mining rate calculation accuracy"""
    
    TEST_USER_UID = "root_cb83"
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        if not BASE_URL:
            pytest.skip("REACT_APP_BACKEND_URL not set")
    
    def test_mining_status_api_returns_200(self):
        """Test that mining status API returns 200 for test user"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
    def test_mining_rate_calculation_formula(self):
        """
        Test that Base + L1 + L2 + L3 + L4 + L5 = TOTAL
        Formula: mining_rate_per_hour = base_rate + sum(level_bonuses)
        """
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # Extract values
        base_rate = data.get('base_rate', 0)
        mining_rate = data.get('mining_rate_per_hour', 0)
        referral_breakdown = data.get('referral_breakdown', {})
        
        # Sum all level bonuses
        total_bonus = 0
        for level in ['level_1', 'level_2', 'level_3', 'level_4', 'level_5']:
            level_data = referral_breakdown.get(level, {})
            bonus = level_data.get('bonus', 0)
            total_bonus += bonus
            print(f"{level}: bonus={bonus:.6f}")
        
        # Calculate expected total
        calculated_total = base_rate + total_bonus
        
        print(f"\nBase Rate: {base_rate:.6f}")
        print(f"Total Referral Bonus: {total_bonus:.6f}")
        print(f"Calculated Total: {calculated_total:.6f}")
        print(f"API Total (mining_rate_per_hour): {mining_rate:.6f}")
        print(f"Difference: {abs(calculated_total - mining_rate):.10f}")
        
        # Verify calculation matches (allow tiny floating point difference)
        assert abs(calculated_total - mining_rate) < 0.0001, \
            f"Calculation mismatch! Expected {calculated_total:.6f}, got {mining_rate:.6f}"
    
    def test_paid_referral_counts(self):
        """
        Test that paid referral counts match expected values
        Expected:
          - L1: 2 paid
          - L2: 6 paid
          - L3: 3 paid
          - L4: 6 paid
          - L5: 4 paid
        """
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        referral_breakdown = data.get('referral_breakdown', {})
        
        expected_counts = {
            'level_1': 2,
            'level_2': 6,
            'level_3': 3,
            'level_4': 6,
            'level_5': 4
        }
        
        for level, expected_count in expected_counts.items():
            actual_count = referral_breakdown.get(level, {}).get('count', 0)
            print(f"{level}: expected={expected_count}, actual={actual_count}")
            assert actual_count == expected_count, \
                f"{level} count mismatch! Expected {expected_count}, got {actual_count}"
    
    def test_api_returns_required_fields(self):
        """Test that API returns all required fields for frontend"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            'mining_rate_per_hour',
            'base_rate',
            'user_multiplier',
            'day_multiplier',
            'referral_breakdown',
            'active_referrals'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            print(f"✓ {field}: {data[field]}")
    
    def test_referral_breakdown_has_bonus_field(self):
        """Test that each level in referral_breakdown has bonus field"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        referral_breakdown = data.get('referral_breakdown', {})
        
        for level in ['level_1', 'level_2', 'level_3', 'level_4', 'level_5']:
            level_data = referral_breakdown.get(level, {})
            assert 'bonus' in level_data, f"{level} missing 'bonus' field"
            assert 'count' in level_data, f"{level} missing 'count' field"
            assert 'percentage' in level_data, f"{level} missing 'percentage' field"
            print(f"✓ {level}: count={level_data.get('count')}, bonus={level_data.get('bonus'):.4f}")
    
    def test_hourly_conversion_formula(self):
        """
        Test hourly conversion formula: value * day_multiplier / 24
        base_hourly should equal: base_rate_raw * user_multiplier * day / 24
        """
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        base_rate_raw = data.get('base_rate_raw', 0)
        user_multiplier = data.get('user_multiplier', 1)
        day_multiplier = data.get('day_multiplier', 1)
        base_rate = data.get('base_rate', 0)
        
        # Calculate expected base_hourly
        expected_base_hourly = (base_rate_raw * user_multiplier * day_multiplier) / 24
        
        print(f"base_rate_raw: {base_rate_raw}")
        print(f"user_multiplier: {user_multiplier}")
        print(f"day_multiplier: {day_multiplier}")
        print(f"Expected base_hourly: ({base_rate_raw} * {user_multiplier} * {day_multiplier}) / 24 = {expected_base_hourly:.6f}")
        print(f"Actual base_rate: {base_rate:.6f}")
        
        assert abs(expected_base_hourly - base_rate) < 0.001, \
            f"Base hourly calculation wrong! Expected {expected_base_hourly:.6f}, got {base_rate:.6f}"


class TestReferralLevelsAPI:
    """Test the referrals levels API for comparison"""
    
    TEST_USER_UID = "root_cb83"
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        if not BASE_URL:
            pytest.skip("REACT_APP_BACKEND_URL not set")
    
    def test_referrals_levels_api_returns_200(self):
        """Test that referrals levels API returns 200"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_referrals_levels_counts_match(self):
        """
        Test that referrals levels API returns correct total counts
        This is what the Invite/Network page displays
        """
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        assert response.status_code == 200
        data = response.json()
        
        levels = data.get('levels', [])
        
        # Expected total counts (paid + free)
        expected_totals = {
            1: 3,  # L1: 2 paid + 1 free
            2: 6,  # L2: 6 paid
            3: 6,  # L3: 3 paid + 3 free
            4: 6,  # L4: 6 paid
            5: 6,  # L5: 4 paid + 2 free
        }
        
        for level_data in levels:
            level = level_data.get('level')
            count = level_data.get('count', 0)
            expected = expected_totals.get(level, 0)
            
            print(f"L{level}: expected_total={expected}, actual_count={count}")
            assert count == expected, f"L{level} total count wrong! Expected {expected}, got {count}"
    
    def test_consistency_between_apis(self):
        """
        Test that mining API paid counts match referrals API paid counts
        This ensures Invite page and Mining page show consistent data
        """
        # Get mining status
        mining_response = requests.get(f"{BASE_URL}/api/mining/status/{self.TEST_USER_UID}")
        assert mining_response.status_code == 200
        mining_data = mining_response.json()
        
        # Get referrals levels
        referrals_response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        assert referrals_response.status_code == 200
        referrals_data = referrals_response.json()
        
        # Count paid users from referrals API
        paid_counts_from_referrals = {}
        for level_data in referrals_data.get('levels', []):
            level = level_data.get('level')
            users = level_data.get('users', [])
            paid_count = sum(1 for u in users if u.get('subscription_plan') not in ['explorer', 'free', '', None])
            paid_counts_from_referrals[level] = paid_count
        
        # Get paid counts from mining API
        referral_breakdown = mining_data.get('referral_breakdown', {})
        
        print("\nPaid count comparison (Referrals API vs Mining API):")
        for level in [1, 2, 3, 4, 5]:
            from_referrals = paid_counts_from_referrals.get(level, 0)
            from_mining = referral_breakdown.get(f'level_{level}', {}).get('count', 0)
            
            print(f"L{level}: referrals_api={from_referrals}, mining_api={from_mining}")
            assert from_referrals == from_mining, \
                f"L{level} paid count inconsistent! Referrals API says {from_referrals}, Mining API says {from_mining}"


class TestFreeCountBug:
    """Test for the free_count field bug in mining API"""
    
    TEST_USER_UID = "root_cb83"
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        if not BASE_URL:
            pytest.skip("REACT_APP_BACKEND_URL not set")
    
    def test_free_count_is_returned(self):
        """
        BUG TEST: Verify free_count is properly returned in referral_breakdown
        Expected:
          - L1: 1 free
          - L2: 0 free
          - L3: 3 free
          - L4: 0 free
          - L5: 2 free
        
        NOTE: This test documents a KNOWN BUG - free_count is always 0
        """
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        referral_breakdown = data.get('referral_breakdown', {})
        
        expected_free = {
            'level_1': 1,
            'level_2': 0,
            'level_3': 3,
            'level_4': 0,
            'level_5': 2
        }
        
        all_correct = True
        for level, expected in expected_free.items():
            actual = referral_breakdown.get(level, {}).get('free_count', 0)
            status = "✓" if actual == expected else "✗ BUG"
            print(f"{level}: expected_free={expected}, actual_free_count={actual} {status}")
            if actual != expected:
                all_correct = False
        
        # This test documents the bug - it may fail if bug is present
        # Comment out assertion if you want test to pass but document the bug
        if not all_correct:
            pytest.xfail("KNOWN BUG: free_count is not being passed through calculate_mining_rate to referral_breakdown")
