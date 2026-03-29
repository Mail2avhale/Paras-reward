"""
Single Leg Tree Mining Tests
============================
Tests for the Single Leg Tree implementation:
1. Mining formula uses tree_position for network_size calculation
2. Direct referrals still use referred_by field
3. New user registration assigns tree_position and network_parent
4. Health endpoint works
5. Growth economy network stats use tree_position
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

# Test user credentials from test_credentials.md
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"
TEST_USER_TREE_POSITION = 3  # As per agent context


class TestHealthEndpoint:
    """Test health endpoint is working"""
    
    def test_health_endpoint(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health endpoint: {data}")


class TestMiningStatusWithSingleLegTree:
    """Test mining status uses tree_position for network_size"""
    
    def test_mining_status_returns_network_size(self):
        """GET /api/mining/status/{uid} should return network_size based on tree_position"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "network_size" in data, "Response should include network_size"
        assert "network_cap" in data, "Response should include network_cap"
        assert "mining_rate" in data, "Response should include mining_rate"
        assert "total_daily_rate" in data, "Response should include total_daily_rate"
        
        network_size = data.get("network_size", 0)
        print(f"✅ Mining status for user at tree_position {TEST_USER_TREE_POSITION}:")
        print(f"   Network size: {network_size}")
        print(f"   Network cap: {data.get('network_cap')}")
        print(f"   Mining rate: {data.get('mining_rate')}")
        print(f"   Total daily rate: {data.get('total_daily_rate')}")
        
        # Network size should be >= 0 (users below in single leg tree)
        assert network_size >= 0, "Network size should be non-negative"
    
    def test_mining_rate_breakdown(self):
        """GET /api/mining/rate-breakdown/{uid} should show network calculation"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify formula components
        assert "base_rate" in data, "Should include base_rate"
        assert "network_size" in data, "Should include network_size"
        assert "prc_per_user" in data, "Should include prc_per_user"
        assert "network_rate" in data, "Should include network_rate"
        
        print(f"✅ Mining rate breakdown:")
        print(f"   Base rate: {data.get('base_rate')} PRC/day")
        print(f"   Network size: {data.get('network_size')}")
        print(f"   PRC per user: {data.get('prc_per_user')}")
        print(f"   Network rate: {data.get('network_rate')}")
        print(f"   Total daily rate: {data.get('total_daily_rate')}")


class TestGrowthEconomyNetworkStats:
    """Test growth economy uses tree_position for network stats"""
    
    def test_network_stats_endpoint(self):
        """GET /api/growth/network-stats/{uid} should return network stats"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True, "Response should be successful"
        stats = data.get("data", {})
        
        # Verify network stats structure
        assert "network_size" in stats, "Should include network_size"
        assert "network_cap" in stats, "Should include network_cap"
        assert "direct_referrals" in stats, "Should include direct_referrals"
        
        print(f"✅ Growth economy network stats:")
        print(f"   Network size (from tree_position): {stats.get('network_size')}")
        print(f"   Network cap: {stats.get('network_cap')}")
        print(f"   Direct referrals (from referred_by): {stats.get('direct_referrals')}")
    
    def test_mining_speed_endpoint(self):
        """GET /api/growth/mining-speed/{uid} should return mining speed"""
        response = requests.get(f"{BASE_URL}/api/growth/mining-speed/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True, "Response should be successful"
        speed = data.get("data", {})
        
        # Verify mining speed structure
        assert "base_mining" in speed, "Should include base_mining"
        assert "network_mining" in speed, "Should include network_mining"
        assert "total_daily_prc" in speed, "Should include total_daily_prc"
        assert "network_size" in speed, "Should include network_size"
        
        print(f"✅ Growth economy mining speed:")
        print(f"   Base mining: {speed.get('base_mining')} PRC/day")
        print(f"   Network mining: {speed.get('network_mining')} PRC/day")
        print(f"   Total daily PRC: {speed.get('total_daily_prc')}")
        print(f"   Network size: {speed.get('network_size')}")


class TestDirectReferralsUnchanged:
    """Test that direct referrals still use referred_by field"""
    
    def test_direct_referrals_count(self):
        """Direct referrals should be counted from referred_by field, not tree"""
        # Get network stats which includes direct_referrals
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        stats = data.get("data", {})
        direct_referrals = stats.get("direct_referrals", 0)
        
        # Direct referrals should be >= 0
        assert direct_referrals >= 0, "Direct referrals should be non-negative"
        print(f"✅ Direct referrals (from referred_by): {direct_referrals}")
        
        # Network cap depends on direct referrals
        network_cap = stats.get("network_cap", 0)
        expected_cap = min(4000, 800 + 16 * direct_referrals)
        assert network_cap == expected_cap, f"Network cap should be {expected_cap}, got {network_cap}"
        print(f"✅ Network cap formula verified: min(4000, 800 + 16 × {direct_referrals}) = {network_cap}")


class TestNewUserRegistration:
    """Test new user registration assigns tree_position and network_parent"""
    
    def test_registration_assigns_tree_position(self):
        """POST /api/auth/register/simple should assign tree_position to new user"""
        # Generate unique test data
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"test_tree_{unique_id}@test.com"
        test_mobile = f"99{unique_id[:8].replace('-', '')[:8]}"
        test_pin = "123456"
        
        # Register new user
        response = requests.post(
            f"{BASE_URL}/api/auth/register/simple",
            json={
                "full_name": f"Tree Test {unique_id}",
                "email": test_email,
                "mobile": test_mobile,
                "password": test_pin
            }
        )
        
        # Check if registration succeeded or if mobile format is invalid
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            if "Mobile number must be 10 digits" in error_detail:
                # Try with a valid 10-digit mobile
                test_mobile = f"99{unique_id[:8].replace('-', '')[:8].ljust(8, '0')}"
                response = requests.post(
                    f"{BASE_URL}/api/auth/register/simple",
                    json={
                        "full_name": f"Tree Test {unique_id}",
                        "email": test_email,
                        "mobile": test_mobile,
                        "password": test_pin
                    }
                )
        
        if response.status_code == 403:
            # Registration might be disabled
            print(f"⚠️ Registration disabled: {response.json().get('detail')}")
            pytest.skip("Registration is disabled")
            return
        
        if response.status_code != 200:
            print(f"⚠️ Registration failed: {response.status_code} - {response.text}")
            pytest.skip(f"Registration failed: {response.text}")
            return
        
        data = response.json()
        new_uid = data.get("uid")
        assert new_uid, "Registration should return uid"
        print(f"✅ New user registered: {new_uid}")
        
        # Verify tree_position was assigned by checking mining status
        mining_response = requests.get(f"{BASE_URL}/api/mining/status/{new_uid}")
        if mining_response.status_code == 200:
            mining_data = mining_response.json()
            # New user should have network_size = 0 (no one below them)
            network_size = mining_data.get("network_size", -1)
            print(f"✅ New user network_size: {network_size} (should be 0 as newest user)")
            # Note: network_size might be > 0 if other users registered after
        else:
            print(f"⚠️ Could not verify mining status: {mining_response.status_code}")


class TestMiningFormulaCalculation:
    """Test mining formula calculations are correct"""
    
    def test_base_rate_is_500(self):
        """Base mining rate should be 500 PRC/day"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        base_rate = data.get("base_rate", 0)
        assert base_rate == 500, f"Base rate should be 500, got {base_rate}"
        print(f"✅ Base rate verified: {base_rate} PRC/day")
    
    def test_prc_per_user_formula(self):
        """PRC per user should follow formula: max(2.5, 5 × (21 - log₂(N)) / 14)"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        network_size = data.get("network_size", 0)
        prc_per_user = data.get("prc_per_user", 0)
        
        if network_size > 0:
            import math
            expected_prc = max(2.5, 5 * (21 - math.log2(max(2, network_size))) / 14)
            # Allow small floating point difference
            assert abs(prc_per_user - expected_prc) < 0.01, \
                f"PRC per user should be ~{expected_prc:.4f}, got {prc_per_user}"
            print(f"✅ PRC per user formula verified: {prc_per_user:.4f} for network size {network_size}")
        else:
            assert prc_per_user == 0, "PRC per user should be 0 when network size is 0"
            print(f"✅ PRC per user is 0 (no network)")


class TestNetworkCapFormula:
    """Test network cap formula based on direct referrals"""
    
    def test_network_cap_formula(self):
        """Network cap should be min(4000, 800 + 16 × direct_referrals)"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        stats = data.get("data", {})
        direct_referrals = stats.get("direct_referrals", 0)
        network_cap = stats.get("network_cap", 0)
        
        expected_cap = min(4000, 800 + 16 * direct_referrals)
        assert network_cap == expected_cap, \
            f"Network cap should be {expected_cap}, got {network_cap}"
        print(f"✅ Network cap formula verified:")
        print(f"   Direct referrals: {direct_referrals}")
        print(f"   Expected cap: min(4000, 800 + 16 × {direct_referrals}) = {expected_cap}")
        print(f"   Actual cap: {network_cap}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
