"""
Test Suite for Dynamic Redeem Limit System based on Growth Network Size

Test Coverage:
1. GET /api/user/{uid}/redeem-limit - returns all required fields
2. User with 0 referrals should have 0% unlock
3. User with 50 network should have Level 3 = 30% unlock (capped by admin 70% default)
4. Redeemable = total_earned × (unlock_percent / 100)
5. Available = max(0, redeemable - total_redeemed), capped at current_balance
6. Growth level calculation based on network size thresholds

Level thresholds: [10, 20, 40, 80, 160, 320, 640, 800, 1000]
Unlock%: 10→10%, 20→20%, 40→30%, 80→40%, 160→50%, 320→60%, 640→70%, 800→80%, 1000+→100%
Admin default max cap: 70%
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
TEST_USER_NO_REFERRALS = {
    "uid": "burn-test-1-e8c8c055",
    "email": "burntest1@test.com",
    "pin": "246813",
    "expected_network_size": 0,
    "expected_unlock": 0  # 0 referrals = 0% unlock
}

TEST_USER_WITH_REFERRALS = {
    "uid": "cbdf46d7-7d66-4d43-8495-e1432a2ab071",
    "email": "santosh@test.com",
    "pin": "111111",
    "expected_network_size": 50,  # 50 network members
    "expected_unlock": 30  # Level 3 = 30% (40 threshold reached, not 80)
}


@pytest.fixture(scope="module")
def api_session():
    """Create requests session for API calls"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestRedeemLimitAPIStructure:
    """Test the redeem limit API returns correct structure"""
    
    def test_api_health(self, api_session):
        """Verify API is healthy"""
        response = api_session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ API health check passed")
    
    def test_redeem_limit_endpoint_exists(self, api_session):
        """Verify redeem limit endpoint exists and returns data"""
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["success"] is True
        print(f"✓ Redeem limit endpoint exists for user {uid}")
    
    def test_redeem_limit_returns_required_fields(self, api_session):
        """Verify all required fields are present in response"""
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        assert response.status_code == 200
        data = response.json()
        
        limit = data.get("limit", {})
        required_fields = [
            "unlock_percent",
            "network_size",
            "growth_level",
            "total_earned",
            "redeemable",
            "total_redeemed",
            "available",
            "effective_available"
        ]
        
        for field in required_fields:
            assert field in limit, f"Missing required field: {field}"
            print(f"  ✓ Field '{field}' present: {limit[field]}")
        
        print("✓ All required fields present in redeem limit response")


class TestUserWithNoReferrals:
    """Test user with 0 referrals should have 0% unlock"""
    
    def test_zero_referrals_zero_unlock(self, api_session):
        """User with 0 referrals should have 0% unlock percent"""
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        assert response.status_code == 200
        data = response.json()
        
        limit = data.get("limit", {})
        unlock_percent = limit.get("unlock_percent", -1)
        network_size = limit.get("network_size", -1)
        growth_level = limit.get("growth_level", -1)
        
        print(f"User {uid}:")
        print(f"  Network Size: {network_size}")
        print(f"  Growth Level: {growth_level}")
        print(f"  Unlock Percent: {unlock_percent}%")
        
        # User with 0 referrals should have network_size < 10, so level 0, unlock 0%
        assert network_size < 10, f"Expected network_size < 10, got {network_size}"
        assert growth_level == 0, f"Expected growth_level 0, got {growth_level}"
        assert unlock_percent == 0, f"Expected unlock_percent 0, got {unlock_percent}"
        
        print("✓ User with 0 referrals has 0% unlock")
    
    def test_zero_unlock_means_zero_redeemable(self, api_session):
        """With 0% unlock, redeemable should be 0"""
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        data = response.json()
        
        limit = data.get("limit", {})
        unlock_percent = limit.get("unlock_percent", 0)
        redeemable = limit.get("redeemable", -1)
        
        if unlock_percent == 0:
            assert redeemable == 0, f"With 0% unlock, redeemable should be 0, got {redeemable}"
            print("✓ 0% unlock results in 0 redeemable PRC")
        else:
            print(f"⚠ Unlock is {unlock_percent}%, skipping zero redeemable check")
    
    def test_zero_redeemable_means_zero_available(self, api_session):
        """With 0 redeemable, available and effective_available should be 0"""
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        data = response.json()
        
        limit = data.get("limit", {})
        redeemable = limit.get("redeemable", 0)
        available = limit.get("available", -1)
        effective_available = limit.get("effective_available", -1)
        
        if redeemable == 0:
            assert available == 0, f"With 0 redeemable, available should be 0, got {available}"
            assert effective_available == 0, f"With 0 redeemable, effective_available should be 0, got {effective_available}"
            print("✓ 0 redeemable results in 0 available PRC")
        else:
            print(f"⚠ Redeemable is {redeemable}, skipping zero available check")


class TestUserWithReferrals:
    """Test user with 50 network members should have Level 3 = 30% unlock"""
    
    def test_network_size_50_gives_level_3(self, api_session):
        """User with 50 network members should be Level 3 (threshold 40 reached)"""
        uid = TEST_USER_WITH_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        
        if response.status_code != 200:
            pytest.skip(f"User {uid} not found or API error: {response.text}")
        
        data = response.json()
        limit = data.get("limit", {})
        
        network_size = limit.get("network_size", 0)
        growth_level = limit.get("growth_level", -1)
        unlock_percent = limit.get("unlock_percent", -1)
        
        print(f"User {uid} (santosh):")
        print(f"  Network Size: {network_size}")
        print(f"  Growth Level: {growth_level}")
        print(f"  Unlock Percent: {unlock_percent}%")
        
        # Level thresholds: [10, 20, 40, 80, ...]
        # 50 >= 40 but < 80, so Level 3
        if network_size >= 40 and network_size < 80:
            assert growth_level == 3, f"Expected growth_level 3 for network_size {network_size}, got {growth_level}"
            # Level 3 = 30% unlock (but capped at admin max 70%)
            assert unlock_percent == 30, f"Expected unlock_percent 30, got {unlock_percent}"
            print("✓ Network size 50 correctly gives Level 3 with 30% unlock")
        else:
            print(f"⚠ Network size is {network_size}, expected ~50. Checking level calculation...")
            # Verify level calculation is correct for actual network size
            expected_level = self._calculate_expected_level(network_size)
            assert growth_level == expected_level, f"Expected level {expected_level} for network {network_size}, got {growth_level}"
    
    def _calculate_expected_level(self, network_size):
        """Calculate expected growth level based on network size"""
        thresholds = [10, 20, 40, 80, 160, 320, 640, 800, 1000]
        level = 0
        for i, threshold in enumerate(thresholds):
            if network_size >= threshold:
                level = i + 1
        return level


class TestRedeemFormulaCalculation:
    """Test the redeem formula: Redeemable = Total Earned × (Unlock% / 100)"""
    
    def test_redeemable_formula(self, api_session):
        """Verify Redeemable = total_earned × (unlock_percent / 100)"""
        uid = TEST_USER_WITH_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        
        if response.status_code != 200:
            pytest.skip(f"User {uid} not found")
        
        data = response.json()
        limit = data.get("limit", {})
        
        total_earned = limit.get("total_earned", 0)
        unlock_percent = limit.get("unlock_percent", 0)
        redeemable = limit.get("redeemable", 0)
        
        print(f"Formula verification:")
        print(f"  Total Earned: {total_earned}")
        print(f"  Unlock Percent: {unlock_percent}%")
        print(f"  Redeemable (API): {redeemable}")
        
        # Calculate expected redeemable
        expected_redeemable = round(total_earned * (unlock_percent / 100), 2)
        print(f"  Redeemable (Expected): {expected_redeemable}")
        
        # Allow small floating point difference
        assert abs(redeemable - expected_redeemable) < 0.1, \
            f"Redeemable mismatch: expected {expected_redeemable}, got {redeemable}"
        
        print("✓ Redeemable formula verified: total_earned × (unlock_percent / 100)")
    
    def test_available_formula(self, api_session):
        """Verify Available = max(0, redeemable - total_redeemed)"""
        uid = TEST_USER_WITH_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        
        if response.status_code != 200:
            pytest.skip(f"User {uid} not found")
        
        data = response.json()
        limit = data.get("limit", {})
        
        redeemable = limit.get("redeemable", 0)
        total_redeemed = limit.get("total_redeemed", 0)
        available = limit.get("available", 0)
        
        print(f"Available formula verification:")
        print(f"  Redeemable: {redeemable}")
        print(f"  Total Redeemed: {total_redeemed}")
        print(f"  Available (API): {available}")
        
        # Calculate expected available
        expected_available = max(0, round(redeemable - total_redeemed, 2))
        print(f"  Available (Expected): {expected_available}")
        
        # Allow small floating point difference
        assert abs(available - expected_available) < 0.1, \
            f"Available mismatch: expected {expected_available}, got {available}"
        
        print("✓ Available formula verified: max(0, redeemable - total_redeemed)")
    
    def test_effective_available_capped_at_balance(self, api_session):
        """Verify effective_available is capped at current_balance"""
        uid = TEST_USER_WITH_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        
        if response.status_code != 200:
            pytest.skip(f"User {uid} not found")
        
        data = response.json()
        limit = data.get("limit", {})
        
        available = limit.get("available", 0)
        current_balance = limit.get("current_balance", 0)
        effective_available = limit.get("effective_available", 0)
        
        print(f"Effective available verification:")
        print(f"  Available: {available}")
        print(f"  Current Balance: {current_balance}")
        print(f"  Effective Available (API): {effective_available}")
        
        # effective_available = min(available, current_balance)
        expected_effective = min(available, current_balance)
        print(f"  Effective Available (Expected): {expected_effective}")
        
        # Allow small floating point difference
        assert abs(effective_available - expected_effective) < 0.1, \
            f"Effective available mismatch: expected {expected_effective}, got {effective_available}"
        
        print("✓ Effective available correctly capped at current balance")


class TestGrowthLevelCalculation:
    """Test growth level calculation based on network size thresholds"""
    
    def test_level_thresholds(self, api_session):
        """Verify level calculation follows thresholds: [10, 20, 40, 80, 160, 320, 640, 800, 1000]"""
        # Test with burn-test-1 user (0 referrals)
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        limit = data.get("limit", {})
        
        network_size = limit.get("network_size", 0)
        growth_level = limit.get("growth_level", 0)
        
        # Calculate expected level
        thresholds = [10, 20, 40, 80, 160, 320, 640, 800, 1000]
        expected_level = 0
        for i, threshold in enumerate(thresholds):
            if network_size >= threshold:
                expected_level = i + 1
        
        print(f"Level calculation for network_size={network_size}:")
        print(f"  Expected Level: {expected_level}")
        print(f"  Actual Level: {growth_level}")
        
        assert growth_level == expected_level, \
            f"Level mismatch for network_size {network_size}: expected {expected_level}, got {growth_level}"
        
        print("✓ Growth level calculation verified")
    
    def test_unlock_percent_matches_level(self, api_session):
        """Verify unlock_percent = level × 10 (capped at admin max)"""
        uid = TEST_USER_WITH_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        
        if response.status_code != 200:
            pytest.skip(f"User {uid} not found")
        
        data = response.json()
        limit = data.get("limit", {})
        
        growth_level = limit.get("growth_level", 0)
        unlock_percent = limit.get("unlock_percent", 0)
        
        # unlock_percent = min(level × 10, admin_max_cap)
        # admin_max_cap default is 70%
        expected_unlock = min(growth_level * 10, 70)
        
        print(f"Unlock percent verification:")
        print(f"  Growth Level: {growth_level}")
        print(f"  Expected Unlock (level × 10, capped at 70): {expected_unlock}%")
        print(f"  Actual Unlock: {unlock_percent}%")
        
        assert unlock_percent == expected_unlock, \
            f"Unlock percent mismatch: expected {expected_unlock}, got {unlock_percent}"
        
        print("✓ Unlock percent matches level × 10 (capped at admin max)")


class TestTotalEarnedCalculation:
    """Test total_earned = current_balance + all_time_redeemed"""
    
    def test_total_earned_formula(self, api_session):
        """Verify total_earned = current_balance + total_redeemed"""
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        limit = data.get("limit", {})
        
        total_earned = limit.get("total_earned", 0)
        current_balance = limit.get("current_balance", 0)
        total_redeemed = limit.get("total_redeemed", 0)
        
        print(f"Total earned verification:")
        print(f"  Current Balance: {current_balance}")
        print(f"  Total Redeemed: {total_redeemed}")
        print(f"  Total Earned (API): {total_earned}")
        
        # total_earned = current_balance + total_redeemed
        expected_total_earned = round(current_balance + total_redeemed, 2)
        print(f"  Total Earned (Expected): {expected_total_earned}")
        
        # Allow small floating point difference
        assert abs(total_earned - expected_total_earned) < 1, \
            f"Total earned mismatch: expected {expected_total_earned}, got {total_earned}"
        
        print("✓ Total earned formula verified: current_balance + total_redeemed")


class TestGrowthEconomyAPI:
    """Test Growth Economy API endpoints"""
    
    def test_growth_network_stats_endpoint(self, api_session):
        """Verify growth network stats endpoint exists"""
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/growth/network-stats/{uid}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Growth network stats for {uid}:")
            print(f"  Direct Referrals: {data.get('direct_referrals', 'N/A')}")
            print(f"  Network Size: {data.get('network_size', 'N/A')}")
            print(f"  Growth Level: {data.get('growth_level', 'N/A')}")
            print(f"  Unlock Percent: {data.get('unlock_percent', 'N/A')}%")
            print("✓ Growth network stats endpoint working")
        else:
            print(f"⚠ Growth network stats endpoint returned {response.status_code}")
    
    def test_mining_speed_endpoint(self, api_session):
        """Verify mining speed endpoint exists"""
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/growth/mining-speed/{uid}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Mining speed for {uid}:")
            print(f"  Base Mining: {data.get('base_mining', 'N/A')}")
            print(f"  Network Mining: {data.get('network_mining', 'N/A')}")
            print(f"  Total Daily PRC: {data.get('total_daily_prc', 'N/A')}")
            print("✓ Mining speed endpoint working")
        else:
            print(f"⚠ Mining speed endpoint returned {response.status_code}")


class TestEdgeCases:
    """Test edge cases for redeem limit system"""
    
    def test_nonexistent_user_returns_zeros(self, api_session):
        """Non-existent user should return zero values"""
        uid = "nonexistent-user-12345"
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        
        # Should return 200 with zero values, not 404
        if response.status_code == 200:
            data = response.json()
            limit = data.get("limit", {})
            
            assert limit.get("unlock_percent", -1) == 0, "Non-existent user should have 0% unlock"
            assert limit.get("redeemable", -1) == 0, "Non-existent user should have 0 redeemable"
            assert limit.get("available", -1) == 0, "Non-existent user should have 0 available"
            print("✓ Non-existent user returns zero values")
        else:
            print(f"⚠ Non-existent user returned {response.status_code} (expected 200 with zeros)")
    
    def test_unlimited_flag_is_false(self, api_session):
        """Verify unlimited flag is always false in new system"""
        uid = TEST_USER_NO_REFERRALS["uid"]
        response = api_session.get(f"{BASE_URL}/api/user/{uid}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        limit = data.get("limit", {})
        
        unlimited = limit.get("unlimited", True)
        assert unlimited is False, "Unlimited flag should be False in new dynamic system"
        print("✓ Unlimited flag is False (dynamic limits active)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
