"""
Test Mining Formula Math Consistency
=====================================
Tests for the bug fix where:
1. Cache read using `or` operator treated 0 as falsy - fixed with explicit None checks
2. New API fields: active_network, total_network_members, direct_referrals, network_cap
3. Math consistency: network_rate = network_size * prc_per_user

Test User: 76b75808-47fa-48dd-ad7c-8074678e3607 (elite, 5 active network members)
Explorer User: d99f75fc-a9f6-478d-901b-dfc7b06090bb (explorer plan)
"""

import pytest
import requests
import os
import math

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test users
ELITE_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
EXPLORER_USER_UID = "d99f75fc-a9f6-478d-901b-dfc7b06090bb"


class TestMiningStatusNewFields:
    """Test /api/mining/status/{uid} returns new fields"""
    
    def test_mining_status_returns_active_network(self):
        """Verify active_network field is present in response"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "active_network" in data, "active_network field missing from response"
        assert isinstance(data["active_network"], int), "active_network should be an integer"
        print(f"PASS: active_network = {data['active_network']}")
    
    def test_mining_status_returns_total_network_members(self):
        """Verify total_network_members field is present in response"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "total_network_members" in data, "total_network_members field missing from response"
        assert isinstance(data["total_network_members"], int), "total_network_members should be an integer"
        print(f"PASS: total_network_members = {data['total_network_members']}")
    
    def test_mining_status_returns_direct_referrals(self):
        """Verify direct_referrals field is present in response"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "direct_referrals" in data, "direct_referrals field missing from response"
        assert isinstance(data["direct_referrals"], int), "direct_referrals should be an integer"
        print(f"PASS: direct_referrals = {data['direct_referrals']}")
    
    def test_mining_status_returns_network_cap(self):
        """Verify network_cap field is present in response"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "network_cap" in data, "network_cap field missing from response"
        assert isinstance(data["network_cap"], int), "network_cap should be an integer"
        print(f"PASS: network_cap = {data['network_cap']}")


class TestMiningFormulaMathConsistency:
    """Test that network_rate = network_size * prc_per_user exactly"""
    
    def test_network_rate_calculation_elite_user(self):
        """Verify network_rate = network_size * prc_per_user for elite user"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        network_size = data["network_size"]
        prc_per_user = data["prc_per_user"]
        network_rate = data["network_rate"]
        
        # Calculate expected network_rate
        expected_network_rate = round(network_size * prc_per_user, 2)
        
        print(f"network_size = {network_size}")
        print(f"prc_per_user = {prc_per_user}")
        print(f"network_rate (API) = {network_rate}")
        print(f"expected (network_size * prc_per_user) = {expected_network_rate}")
        
        # Allow small floating point tolerance
        assert abs(network_rate - expected_network_rate) < 0.01, \
            f"Math inconsistency: {network_size} x {prc_per_user} = {expected_network_rate}, but API returned {network_rate}"
        print(f"PASS: {network_size} x {prc_per_user} = {network_rate} ✓")
    
    def test_network_rate_calculation_explorer_user(self):
        """Verify network_rate = 0 for explorer user with no network"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{EXPLORER_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        network_size = data["network_size"]
        prc_per_user = data["prc_per_user"]
        network_rate = data["network_rate"]
        
        print(f"Explorer user: network_size = {network_size}, prc_per_user = {prc_per_user}, network_rate = {network_rate}")
        
        # Explorer with 0 network should have 0 network_rate
        if network_size == 0:
            assert network_rate == 0, f"Expected network_rate=0 for network_size=0, got {network_rate}"
            print("PASS: network_rate = 0 for explorer with no network ✓")
        else:
            expected = round(network_size * prc_per_user, 2)
            assert abs(network_rate - expected) < 0.01
            print(f"PASS: {network_size} x {prc_per_user} = {network_rate} ✓")
    
    def test_total_daily_rate_formula(self):
        """Verify total_daily_rate = (base_rate + network_rate) * boost_multiplier"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        base_rate = data["base_rate"]
        network_rate = data["network_rate"]
        boost_multiplier = data["boost_multiplier"]
        total_daily_rate = data["total_daily_rate"]
        
        expected_total = round((base_rate + network_rate) * boost_multiplier, 2)
        
        print(f"base_rate = {base_rate}")
        print(f"network_rate = {network_rate}")
        print(f"boost_multiplier = {boost_multiplier}")
        print(f"total_daily_rate (API) = {total_daily_rate}")
        print(f"expected = ({base_rate} + {network_rate}) * {boost_multiplier} = {expected_total}")
        
        assert abs(total_daily_rate - expected_total) < 0.01, \
            f"Total daily rate mismatch: expected {expected_total}, got {total_daily_rate}"
        print(f"PASS: total_daily_rate formula verified ✓")


class TestRateBreakdownNewFields:
    """Test /api/mining/rate-breakdown/{uid} returns new fields"""
    
    def test_rate_breakdown_returns_active_network(self):
        """Verify active_network field in rate-breakdown response"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "active_network" in data, "active_network field missing from rate-breakdown"
        print(f"PASS: rate-breakdown active_network = {data['active_network']}")
    
    def test_rate_breakdown_returns_total_network_members(self):
        """Verify total_network_members field in rate-breakdown response"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "total_network_members" in data, "total_network_members field missing from rate-breakdown"
        print(f"PASS: rate-breakdown total_network_members = {data['total_network_members']}")
    
    def test_rate_breakdown_math_consistency(self):
        """Verify rate-breakdown has consistent math"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        network_size = data["network_size"]
        prc_per_user = data["prc_per_user"]
        network_rate = data["network_rate"]
        
        expected = round(network_size * prc_per_user, 2)
        assert abs(network_rate - expected) < 0.01, \
            f"rate-breakdown math inconsistency: {network_size} x {prc_per_user} != {network_rate}"
        print(f"PASS: rate-breakdown math consistent: {network_size} x {prc_per_user} = {network_rate} ✓")


class TestMiningSessionEliteUser:
    """Test mining session start/collect for elite users"""
    
    def test_elite_user_can_collect(self):
        """Verify elite user has can_collect=True when session active with mined coins"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # Elite user should be able to collect if they have mined coins
        if data["session_active"] and data["mined_coins"] > 0:
            assert data["can_collect"] == True, "Elite user should be able to collect"
            print(f"PASS: Elite user can_collect = True (mined {data['mined_coins']} PRC)")
        else:
            print(f"INFO: Session not active or no mined coins yet")
    
    def test_elite_user_is_not_explorer(self):
        """Verify elite user has is_explorer=False"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert data["is_explorer"] == False, "Elite user should have is_explorer=False"
        print("PASS: Elite user is_explorer = False ✓")


class TestMiningSessionExplorerUser:
    """Test mining session for explorer users"""
    
    def test_explorer_user_cannot_collect(self):
        """Verify explorer user has can_collect=False"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{EXPLORER_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert data["can_collect"] == False, "Explorer user should not be able to collect"
        print("PASS: Explorer user can_collect = False ✓")
    
    def test_explorer_user_is_explorer(self):
        """Verify explorer user has is_explorer=True"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{EXPLORER_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert data["is_explorer"] == True, "Explorer user should have is_explorer=True"
        print("PASS: Explorer user is_explorer = True ✓")
    
    def test_explorer_user_can_start_mining(self):
        """Verify explorer user can start mining (can_start when no active session)"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{EXPLORER_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # If session is not active, can_start should be True
        if not data["session_active"]:
            assert data["can_start"] == True, "Explorer should be able to start mining"
            print("PASS: Explorer user can_start = True (no active session)")
        else:
            # If session is active, can_start should be False
            assert data["can_start"] == False, "Explorer should not start new session while one is active"
            print("PASS: Explorer user can_start = False (session already active)")


class TestNetworkCapFormula:
    """Test network cap calculation based on direct referrals"""
    
    def test_network_cap_with_referrals(self):
        """Verify network_cap = min(4000, 800 + 16 * direct_referrals)"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        direct_referrals = data["direct_referrals"]
        network_cap = data["network_cap"]
        
        expected_cap = min(4000, 800 + 16 * direct_referrals)
        
        print(f"direct_referrals = {direct_referrals}")
        print(f"network_cap (API) = {network_cap}")
        print(f"expected = min(4000, 800 + 16 * {direct_referrals}) = {expected_cap}")
        
        assert network_cap == expected_cap, \
            f"Network cap mismatch: expected {expected_cap}, got {network_cap}"
        print(f"PASS: network_cap formula verified ✓")
    
    def test_network_cap_no_referrals(self):
        """Verify network_cap = 800 when direct_referrals = 0"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{EXPLORER_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        direct_referrals = data["direct_referrals"]
        network_cap = data["network_cap"]
        
        if direct_referrals == 0:
            assert network_cap == 800, f"Expected network_cap=800 for 0 referrals, got {network_cap}"
            print("PASS: network_cap = 800 for 0 direct referrals ✓")
        else:
            expected_cap = min(4000, 800 + 16 * direct_referrals)
            assert network_cap == expected_cap
            print(f"PASS: network_cap = {network_cap} for {direct_referrals} referrals ✓")


class TestPrcPerUserFormula:
    """Test PRC per user calculation formula"""
    
    def test_prc_per_user_formula(self):
        """Verify prc_per_user = max(2.5, 5 × (21 - log₂(N)) / 14)"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        network_size = data["network_size"]
        prc_per_user = data["prc_per_user"]
        
        if network_size <= 0:
            assert prc_per_user == 0, "prc_per_user should be 0 for network_size <= 0"
            print("PASS: prc_per_user = 0 for no network ✓")
        else:
            # Formula: max(2.5, 5 × (21 - log₂(N)) / 14)
            if network_size == 1:
                expected = 5 * (21 - math.log2(2)) / 14  # Treat 1 as 2
            else:
                expected = 5 * (21 - math.log2(max(2, network_size))) / 14
            expected = round(max(2.5, expected), 6)
            
            print(f"network_size = {network_size}")
            print(f"prc_per_user (API) = {prc_per_user}")
            print(f"expected = max(2.5, 5 × (21 - log₂({network_size})) / 14) = {expected}")
            
            # Allow small tolerance for floating point
            assert abs(prc_per_user - expected) < 0.001, \
                f"prc_per_user mismatch: expected {expected}, got {prc_per_user}"
            print(f"PASS: prc_per_user formula verified ✓")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
