"""
3-Tier Network Cap Formula - Backend API Tests
================================================
Tests the new 3-tier network cap implementation:
- Tier 1 (Base): 800 cap (everyone)
- Tier 2 (Direct Referrals): +16 per direct referral, max 4000
- Tier 3 (L1 Indirect Referrals): +5 per L1 indirect referral, max 6000
- Formula: min(6000, 800 + 16×D + 5×L1)

Endpoints tested:
- GET /api/mining/rate-breakdown/{uid}
- GET /api/mining/status/{uid}
- GET /api/growth/network-stats/{uid}
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user with 7 direct referrals and 0 L1 indirects
PRIMARY_TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
# PRC test user
PRC_TEST_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


class TestMiningRateBreakdown:
    """Test GET /api/mining/rate-breakdown/{uid} endpoint"""
    
    def test_rate_breakdown_returns_200(self):
        """Endpoint should return 200 for valid user"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ rate-breakdown returns 200")
    
    def test_rate_breakdown_has_l1_indirect_referrals(self):
        """Response should include l1_indirect_referrals field"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "l1_indirect_referrals" in data, f"Missing l1_indirect_referrals in response: {data.keys()}"
        assert isinstance(data["l1_indirect_referrals"], int), f"l1_indirect_referrals should be int, got {type(data['l1_indirect_referrals'])}"
        print(f"✓ l1_indirect_referrals present: {data['l1_indirect_referrals']}")
    
    def test_rate_breakdown_has_cap_tier1_base(self):
        """Response should include cap_tier1_base field = 800"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "cap_tier1_base" in data, f"Missing cap_tier1_base in response: {data.keys()}"
        assert data["cap_tier1_base"] == 800, f"cap_tier1_base should be 800, got {data['cap_tier1_base']}"
        print(f"✓ cap_tier1_base = 800")
    
    def test_rate_breakdown_has_cap_tier2_bonus(self):
        """Response should include cap_tier2_bonus field"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "cap_tier2_bonus" in data, f"Missing cap_tier2_bonus in response: {data.keys()}"
        assert isinstance(data["cap_tier2_bonus"], (int, float)), f"cap_tier2_bonus should be numeric"
        print(f"✓ cap_tier2_bonus present: {data['cap_tier2_bonus']}")
    
    def test_rate_breakdown_has_cap_tier3_bonus(self):
        """Response should include cap_tier3_bonus field"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "cap_tier3_bonus" in data, f"Missing cap_tier3_bonus in response: {data.keys()}"
        assert isinstance(data["cap_tier3_bonus"], (int, float)), f"cap_tier3_bonus should be numeric"
        print(f"✓ cap_tier3_bonus present: {data['cap_tier3_bonus']}")
    
    def test_rate_breakdown_has_network_cap(self):
        """Response should include network_cap field"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "network_cap" in data, f"Missing network_cap in response: {data.keys()}"
        assert isinstance(data["network_cap"], (int, float)), f"network_cap should be numeric"
        print(f"✓ network_cap present: {data['network_cap']}")
    
    def test_rate_breakdown_network_cap_formula(self):
        """Verify network_cap = min(6000, 800 + 16*D + 5*L1)"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        data = response.json()
        
        direct_referrals = data.get("direct_referrals", 0)
        l1_indirect = data.get("l1_indirect_referrals", 0)
        network_cap = data.get("network_cap", 0)
        
        # Calculate expected cap
        expected_cap = min(6000, 800 + 16 * direct_referrals + 5 * l1_indirect)
        
        assert network_cap == expected_cap, f"network_cap mismatch: expected {expected_cap}, got {network_cap} (D={direct_referrals}, L1={l1_indirect})"
        print(f"✓ network_cap formula verified: {network_cap} = min(6000, 800 + 16×{direct_referrals} + 5×{l1_indirect})")


class TestMiningStatus:
    """Test GET /api/mining/status/{uid} endpoint"""
    
    def test_mining_status_returns_200(self):
        """Endpoint should return 200 for valid user"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRIMARY_TEST_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ mining/status returns 200")
    
    def test_mining_status_has_l1_indirect_referrals(self):
        """Response should include l1_indirect_referrals field"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "l1_indirect_referrals" in data, f"Missing l1_indirect_referrals in response: {data.keys()}"
        print(f"✓ l1_indirect_referrals in mining/status: {data['l1_indirect_referrals']}")
    
    def test_mining_status_has_cap_tier1_base(self):
        """Response should include cap_tier1_base field = 800"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "cap_tier1_base" in data, f"Missing cap_tier1_base in response: {data.keys()}"
        assert data["cap_tier1_base"] == 800, f"cap_tier1_base should be 800, got {data['cap_tier1_base']}"
        print(f"✓ cap_tier1_base = 800 in mining/status")
    
    def test_mining_status_has_cap_tier2_bonus(self):
        """Response should include cap_tier2_bonus field"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "cap_tier2_bonus" in data, f"Missing cap_tier2_bonus in response: {data.keys()}"
        print(f"✓ cap_tier2_bonus in mining/status: {data['cap_tier2_bonus']}")
    
    def test_mining_status_has_cap_tier3_bonus(self):
        """Response should include cap_tier3_bonus field"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "cap_tier3_bonus" in data, f"Missing cap_tier3_bonus in response: {data.keys()}"
        print(f"✓ cap_tier3_bonus in mining/status: {data['cap_tier3_bonus']}")
    
    def test_mining_status_has_mining_active(self):
        """Response should include mining_active field"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "mining_active" in data, f"Missing mining_active in response: {data.keys()}"
        print(f"✓ mining_active in mining/status: {data['mining_active']}")
    
    def test_mining_status_has_mined_coins(self):
        """Response should include mined_coins field"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRIMARY_TEST_UID}")
        data = response.json()
        assert "mined_coins" in data, f"Missing mined_coins in response: {data.keys()}"
        print(f"✓ mined_coins in mining/status: {data['mined_coins']}")
    
    def test_mining_status_has_session_info(self):
        """Response should include session info fields"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRIMARY_TEST_UID}")
        data = response.json()
        # Check for session-related fields
        assert "session_active" in data or "mining_active" in data, "Missing session status field"
        assert "time_remaining" in data, f"Missing time_remaining in response: {data.keys()}"
        print(f"✓ session info present in mining/status")


class TestGrowthNetworkStats:
    """Test GET /api/growth/network-stats/{uid} endpoint"""
    
    def test_network_stats_returns_200(self):
        """Endpoint should return 200 for valid user"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{PRIMARY_TEST_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ growth/network-stats returns 200")
    
    def test_network_stats_has_success_and_data(self):
        """Response should have success=True and data object"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{PRIMARY_TEST_UID}")
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data.get('success')}"
        assert "data" in data, f"Missing 'data' in response: {data.keys()}"
        print(f"✓ success=True and data present")
    
    def test_network_stats_has_l1_indirect_referrals(self):
        """Response data should include l1_indirect_referrals field"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{PRIMARY_TEST_UID}")
        data = response.json().get("data", {})
        assert "l1_indirect_referrals" in data, f"Missing l1_indirect_referrals in data: {data.keys()}"
        print(f"✓ l1_indirect_referrals in network-stats: {data['l1_indirect_referrals']}")
    
    def test_network_stats_has_cap_tier1_base(self):
        """Response data should include cap_tier1_base field = 800"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{PRIMARY_TEST_UID}")
        data = response.json().get("data", {})
        assert "cap_tier1_base" in data, f"Missing cap_tier1_base in data: {data.keys()}"
        assert data["cap_tier1_base"] == 800, f"cap_tier1_base should be 800, got {data['cap_tier1_base']}"
        print(f"✓ cap_tier1_base = 800 in network-stats")
    
    def test_network_stats_has_cap_tier2_bonus(self):
        """Response data should include cap_tier2_bonus field"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{PRIMARY_TEST_UID}")
        data = response.json().get("data", {})
        assert "cap_tier2_bonus" in data, f"Missing cap_tier2_bonus in data: {data.keys()}"
        print(f"✓ cap_tier2_bonus in network-stats: {data['cap_tier2_bonus']}")
    
    def test_network_stats_has_cap_tier3_bonus(self):
        """Response data should include cap_tier3_bonus field"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{PRIMARY_TEST_UID}")
        data = response.json().get("data", {})
        assert "cap_tier3_bonus" in data, f"Missing cap_tier3_bonus in data: {data.keys()}"
        print(f"✓ cap_tier3_bonus in network-stats: {data['cap_tier3_bonus']}")


class TestNetworkCapMath:
    """Test the 3-tier network cap formula math"""
    
    def test_primary_user_cap_calculation(self):
        """Test user with 7 directs and 0 L1: cap should be 912 (800 + 112)"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        data = response.json()
        
        direct_referrals = data.get("direct_referrals", 0)
        l1_indirect = data.get("l1_indirect_referrals", 0)
        network_cap = data.get("network_cap", 0)
        
        # Expected: 800 + 16*7 + 5*0 = 800 + 112 = 912
        expected_cap = 800 + 16 * direct_referrals + 5 * l1_indirect
        
        print(f"Direct referrals: {direct_referrals}")
        print(f"L1 indirect referrals: {l1_indirect}")
        print(f"Network cap: {network_cap}")
        print(f"Expected cap: {expected_cap}")
        
        # If user has 7 directs and 0 L1, cap should be 912
        if direct_referrals == 7 and l1_indirect == 0:
            assert network_cap == 912, f"Expected 912 for 7 directs, 0 L1, got {network_cap}"
            print(f"✓ Cap correctly calculated as 912 for 7 directs, 0 L1")
        else:
            # Verify formula regardless of actual referral counts
            assert network_cap == min(6000, expected_cap), f"Cap formula mismatch: expected {min(6000, expected_cap)}, got {network_cap}"
            print(f"✓ Cap formula verified: {network_cap}")
    
    def test_tier2_bonus_calculation(self):
        """cap_tier2_bonus = min(16*directs, 3200)"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        data = response.json()
        
        direct_referrals = data.get("direct_referrals", 0)
        tier2_bonus = data.get("cap_tier2_bonus", 0)
        
        # Tier 2 bonus = min(16 * D, 3200)
        expected_tier2 = min(16 * direct_referrals, 3200)
        
        assert tier2_bonus == expected_tier2, f"tier2_bonus mismatch: expected {expected_tier2}, got {tier2_bonus}"
        print(f"✓ cap_tier2_bonus = {tier2_bonus} (16 × {direct_referrals}, max 3200)")
    
    def test_tier3_bonus_calculation(self):
        """cap_tier3_bonus = min(5*l1_indirects, 2000)"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRIMARY_TEST_UID}")
        data = response.json()
        
        l1_indirect = data.get("l1_indirect_referrals", 0)
        tier3_bonus = data.get("cap_tier3_bonus", 0)
        
        # Tier 3 bonus = min(5 * L1, 2000)
        expected_tier3 = min(5 * l1_indirect, 2000)
        
        assert tier3_bonus == expected_tier3, f"tier3_bonus mismatch: expected {expected_tier3}, got {tier3_bonus}"
        print(f"✓ cap_tier3_bonus = {tier3_bonus} (5 × {l1_indirect}, max 2000)")


class TestPRCUserEndpoints:
    """Test endpoints with PRC test user"""
    
    def test_prc_user_rate_breakdown(self):
        """PRC user should also have 3-tier cap fields"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRC_TEST_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        required_fields = ["l1_indirect_referrals", "cap_tier1_base", "cap_tier2_bonus", "cap_tier3_bonus", "network_cap"]
        
        for field in required_fields:
            assert field in data, f"Missing {field} for PRC user"
        
        assert data["cap_tier1_base"] == 800, f"cap_tier1_base should be 800 for PRC user"
        print(f"✓ PRC user has all 3-tier cap fields")
    
    def test_prc_user_mining_status(self):
        """PRC user mining status should have 3-tier cap fields"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRC_TEST_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        required_fields = ["l1_indirect_referrals", "cap_tier1_base", "cap_tier2_bonus", "cap_tier3_bonus"]
        
        for field in required_fields:
            assert field in data, f"Missing {field} in PRC user mining status"
        
        print(f"✓ PRC user mining status has all 3-tier cap fields")


class TestEdgeCases:
    """Test edge cases for 3-tier cap"""
    
    def test_invalid_user_rate_breakdown(self):
        """Invalid user should return 404"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/invalid-uid-12345")
        assert response.status_code == 404, f"Expected 404 for invalid user, got {response.status_code}"
        print(f"✓ Invalid user returns 404 for rate-breakdown")
    
    def test_invalid_user_mining_status(self):
        """Invalid user should return 404"""
        response = requests.get(f"{BASE_URL}/api/mining/status/invalid-uid-12345")
        assert response.status_code == 404, f"Expected 404 for invalid user, got {response.status_code}"
        print(f"✓ Invalid user returns 404 for mining/status")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
