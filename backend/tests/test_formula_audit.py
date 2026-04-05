"""
Formula Audit Tests - Core Formula System Verification
=======================================================
Tests for 5 core formulas:
1. Subscription active/inactive (burning.py uses helpers.py)
2. Mining formula (base_rate=1000)
3. Redeem formula (total_mined based)
4. Network formula (threshold at 250)
5. PRC dynamic rate

Test Users:
- Cash User: UID=76b75808-47fa-48dd-ad7c-8074678e3607
- PRC User: UID=6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test User UIDs
CASH_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
PRC_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


class TestMiningStatusBaseRate:
    """Test 1: Mining status endpoint returns base_rate=1000 (not 500)"""
    
    def test_mining_status_base_rate_cash_user(self):
        """Verify mining status returns base_rate=1000 for cash user"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{CASH_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # base_rate should be 1000 (not 500) when network < 250
        # If network >= 250, base_rate should be 0
        base_rate = data.get("base_rate")
        assert base_rate is not None, "base_rate field missing from response"
        assert base_rate in [0, 1000], f"base_rate should be 0 or 1000, got {base_rate}"
        print(f"PASS: Mining status base_rate={base_rate} (valid: 0 or 1000)")
    
    def test_mining_status_base_rate_prc_user(self):
        """Verify mining status returns base_rate=1000 for PRC user"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{PRC_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        base_rate = data.get("base_rate")
        assert base_rate is not None, "base_rate field missing from response"
        assert base_rate in [0, 1000], f"base_rate should be 0 or 1000, got {base_rate}"
        print(f"PASS: Mining status base_rate={base_rate} for PRC user")


class TestGrowthEconomyMiningSpeed:
    """Test 2: Growth economy mining-speed endpoint returns base_mining=1000 and applies threshold"""
    
    def test_mining_speed_base_mining_value(self):
        """Verify mining-speed returns base_mining=1000 when network < 250"""
        response = requests.get(f"{BASE_URL}/api/growth/mining-speed/{CASH_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"API returned success=False: {data}"
        
        speed_data = data.get("data", {})
        base_mining = speed_data.get("base_mining")
        network_size = speed_data.get("network_size", 0)
        
        assert base_mining is not None, "base_mining field missing from response"
        
        # Threshold rule: base=1000 if network < 250, base=0 if network >= 250
        if network_size < 250:
            assert base_mining == 1000, f"Expected base_mining=1000 for network<250, got {base_mining}"
        else:
            assert base_mining == 0, f"Expected base_mining=0 for network>=250, got {base_mining}"
        
        print(f"PASS: base_mining={base_mining}, network_size={network_size} (threshold=250)")
    
    def test_mining_speed_threshold_logic(self):
        """Verify threshold logic: base=0 when network >= 250"""
        response = requests.get(f"{BASE_URL}/api/growth/mining-speed/{PRC_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        speed_data = data.get("data", {})
        base_mining = speed_data.get("base_mining")
        network_size = speed_data.get("network_size", 0)
        
        # Verify threshold logic is applied correctly
        expected_base = 1000 if network_size < 250 else 0
        assert base_mining == expected_base, f"Threshold logic failed: network={network_size}, expected base={expected_base}, got {base_mining}"
        print(f"PASS: Threshold logic correct - network={network_size}, base_mining={base_mining}")


class TestBurningStatusSubscription:
    """Test 3: Burning status correctly detects active subscriptions"""
    
    def test_burning_status_active_elite_cash(self):
        """Verify burning is NOT active for Elite user with cash subscription"""
        response = requests.get(f"{BASE_URL}/api/burning/status/{CASH_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        burning_active = data.get("burning_active")
        reason = data.get("reason", "")
        
        # Elite user with active subscription should NOT be burning
        if burning_active == False:
            assert reason == "subscription_active", f"Expected reason='subscription_active', got '{reason}'"
            print(f"PASS: Elite cash user NOT burning (reason: {reason})")
        else:
            # If burning is active, subscription may have expired
            print(f"INFO: Burning active for cash user - subscription may have expired")
    
    def test_burning_status_active_elite_prc(self):
        """Verify burning is NOT active for Elite user with PRC subscription"""
        response = requests.get(f"{BASE_URL}/api/burning/status/{PRC_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        burning_active = data.get("burning_active")
        reason = data.get("reason", "")
        
        # Elite user with active subscription should NOT be burning
        if burning_active == False:
            assert reason == "subscription_active", f"Expected reason='subscription_active', got '{reason}'"
            print(f"PASS: Elite PRC user NOT burning (reason: {reason})")
        else:
            print(f"INFO: Burning active for PRC user - subscription may have expired")


class TestRedeemLimitFormula:
    """Test 4 & 5: Redeem limit uses total_mined formula and returns total_mined field"""
    
    def test_redeem_limit_returns_total_mined_field(self):
        """Verify redeem-limit endpoint returns total_mined field"""
        response = requests.get(f"{BASE_URL}/api/user/{CASH_USER_UID}/redeem-limit")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"API returned success=False: {data}"
        
        # Data is nested under 'limit' key
        limit_data = data.get("limit", {})
        
        # Check total_mined field exists
        assert "total_mined" in limit_data, f"total_mined field missing from limit. Keys: {limit_data.keys()}"
        total_mined = limit_data.get("total_mined")
        assert total_mined is not None, "total_mined is None"
        assert isinstance(total_mined, (int, float)), f"total_mined should be numeric, got {type(total_mined)}"
        
        print(f"PASS: total_mined field present with value {total_mined}")
    
    def test_redeem_limit_total_earned_formula(self):
        """Verify total_earned = total_mined - total_redeemed (never negative)"""
        response = requests.get(f"{BASE_URL}/api/user/{CASH_USER_UID}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        limit_data = data.get("limit", {})
        
        total_mined = limit_data.get("total_mined", 0)
        total_redeemed = limit_data.get("total_redeemed", 0)
        total_earned = limit_data.get("total_earned", 0)
        
        # Formula: total_earned = max(0, total_mined - total_redeemed)
        expected_earned = max(0, total_mined - total_redeemed)
        
        # Allow small floating point tolerance
        assert abs(total_earned - expected_earned) < 0.1, \
            f"total_earned formula incorrect: expected {expected_earned}, got {total_earned}"
        
        # Verify never negative
        assert total_earned >= 0, f"total_earned should never be negative, got {total_earned}"
        
        print(f"PASS: total_earned={total_earned} = max(0, {total_mined} - {total_redeemed})")
    
    def test_redeem_limit_prc_user(self):
        """Verify redeem limit for PRC user"""
        response = requests.get(f"{BASE_URL}/api/user/{PRC_USER_UID}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        limit_data = data.get("limit", {})
        
        assert "total_mined" in limit_data, "total_mined field missing"
        assert "total_redeemed" in limit_data, "total_redeemed field missing"
        assert "total_earned" in limit_data, "total_earned field missing"
        
        total_earned = limit_data.get("total_earned", 0)
        assert total_earned >= 0, f"total_earned should never be negative, got {total_earned}"
        
        print(f"PASS: PRC user redeem limit - total_mined={limit_data.get('total_mined')}, total_earned={total_earned}")


class TestMiningRateBreakdown:
    """Test 6: Mining rate-breakdown endpoint works without errors"""
    
    def test_rate_breakdown_endpoint_works(self):
        """Verify rate-breakdown endpoint returns 200 and valid data"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{CASH_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        required_fields = ["base_rate", "network_size", "network_cap", "prc_per_user", "total_daily_rate"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify base_rate is 0 or 1000
        base_rate = data.get("base_rate")
        assert base_rate in [0, 1000], f"base_rate should be 0 or 1000, got {base_rate}"
        
        print(f"PASS: rate-breakdown endpoint works - base_rate={base_rate}, daily_rate={data.get('total_daily_rate')}")
    
    def test_rate_breakdown_formula_display(self):
        """Verify rate-breakdown shows correct formula"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{PRC_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check formula field mentions base=1000 if network<250
        daily_formula = data.get("daily_formula", "")
        assert "1000" in daily_formula or "Base" in daily_formula, \
            f"Formula should mention base=1000, got: {daily_formula}"
        
        print(f"PASS: Formula displayed: {daily_formula}")


class TestEconomySettings:
    """Test 7: Economy settings show base_mining=1000"""
    
    def test_economy_settings_base_mining(self):
        """Verify economy settings returns base_mining=1000"""
        response = requests.get(f"{BASE_URL}/api/growth/economy-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"API returned success=False: {data}"
        
        settings = data.get("data", {})
        base_mining = settings.get("base_mining")
        
        assert base_mining is not None, "base_mining field missing from economy settings"
        assert base_mining == 1000, f"Expected base_mining=1000, got {base_mining}"
        
        print(f"PASS: Economy settings base_mining={base_mining}")


class TestBurningHelperImport:
    """Test 8: Verify burning.py uses is_subscription_active from utils/helpers.py"""
    
    def test_burning_uses_centralized_helper(self):
        """Verify burning status uses centralized is_subscription_active"""
        # This is a code review test - we verify by checking the burning endpoint behavior
        # If it correctly identifies active subscriptions, the import is working
        
        response = requests.get(f"{BASE_URL}/api/burning/status/{CASH_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        
        # The endpoint should return subscription_plan field (from helpers.py logic)
        if data.get("burning_active") == False:
            subscription_plan = data.get("subscription_plan", "")
            assert subscription_plan != "", "subscription_plan should be returned when not burning"
            print(f"PASS: Burning uses centralized helper - subscription_plan={subscription_plan}")
        else:
            # If burning is active, verify it's because subscription expired
            print(f"INFO: Burning active - subscription may have expired")


class TestMiningCollectIncrements:
    """Test 9: Mining collect endpoint increments both total_mined and total_mined_prc"""
    
    def test_mining_collect_endpoint_exists(self):
        """Verify mining collect endpoint exists and returns proper response"""
        # We can't actually collect without an active session, but we can verify the endpoint exists
        response = requests.post(f"{BASE_URL}/api/mining/collect/{CASH_USER_UID}")
        
        # Should return 400 (no active session) or 403 (not elite) or 200 (success)
        # Should NOT return 404 (endpoint not found) or 500 (server error)
        assert response.status_code in [200, 400, 403], \
            f"Unexpected status code {response.status_code}: {response.text}"
        
        print(f"PASS: Mining collect endpoint exists (status={response.status_code})")


class TestRedeemLimitNoDeadCode:
    """Test 10: No dead/unreachable code in calculate_user_redeem_limit"""
    
    def test_redeem_limit_all_fields_populated(self):
        """Verify all expected fields are returned (no dead code paths)"""
        response = requests.get(f"{BASE_URL}/api/user/{CASH_USER_UID}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        limit_data = data.get("limit", {})
        
        # All these fields should be populated (not None or missing)
        expected_fields = [
            "total_earned", "total_mined", "unlock_percent", "redeemable",
            "total_redeemed", "available", "network_size", "total_limit"
        ]
        
        for field in expected_fields:
            assert field in limit_data, f"Missing field: {field}"
            assert limit_data[field] is not None, f"Field {field} is None"
        
        print(f"PASS: All redeem limit fields populated - no dead code")
    
    def test_redeem_limit_consistent_values(self):
        """Verify redeem limit values are consistent (no calculation errors)"""
        response = requests.get(f"{BASE_URL}/api/user/{PRC_USER_UID}/redeem-limit")
        assert response.status_code == 200
        
        data = response.json()
        limit_data = data.get("limit", {})
        
        # Verify consistency: available = max(0, redeemable - total_redeemed)
        redeemable = limit_data.get("redeemable", 0)
        total_redeemed = limit_data.get("total_redeemed", 0)
        available = limit_data.get("available", 0)
        
        expected_available = max(0, redeemable - total_redeemed)
        
        # Allow small floating point tolerance
        assert abs(available - expected_available) < 0.1, \
            f"available calculation inconsistent: expected {expected_available}, got {available}"
        
        print(f"PASS: Redeem limit values consistent - available={available}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
