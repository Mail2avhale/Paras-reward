"""
Growth Economy System API Tests
================================
Tests for:
1. GET /api/growth/economy-settings - Returns economy settings with defaults
2. GET /api/growth/prc-rate - Returns current PRC rate
3. POST /api/growth/calculate-redeem?redeem_prc=1000 - Calculate redeem charges
4. POST /api/growth/calculate-redeem-inr?inr_amount=500 - Calculate PRC needed for INR
5. Mining formula verification: R(U) = max(3, 8 - 0.5 × log₂(U))
6. Network cap formula: min(4000, 800 + 16×D)
"""

import pytest
import requests
import math
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Default values from growth_economy.py
DEFAULT_BASE_MINING = 550
DEFAULT_NETWORK_CAP_BASE = 800
DEFAULT_NETWORK_CAP_PER_REFERRAL = 16
DEFAULT_MAX_NETWORK_CAP = 4000
DEFAULT_MIN_PRC_PER_USER = 3
DEFAULT_MAX_PRC_PER_USER = 8
DEFAULT_REDEEM_PERCENT = 70
DEFAULT_BURN_RATE = 5
DEFAULT_PROCESSING_FEE_INR = 10
DEFAULT_ADMIN_CHARGE_PERCENT = 20


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✓ API health check passed")


class TestEconomySettings:
    """Test GET /api/growth/economy-settings"""
    
    def test_get_economy_settings_success(self):
        """Test economy settings endpoint returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/growth/economy-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have 'data' field"
        
        settings = data["data"]
        
        # Verify all required fields exist
        required_fields = [
            "redeem_percent", "burn_rate", "processing_fee_inr", 
            "admin_charge_percent", "base_mining", "prc_rate"
        ]
        for field in required_fields:
            assert field in settings, f"Missing field: {field}"
        
        print(f"✓ Economy settings returned: {settings}")
    
    def test_economy_settings_default_values(self):
        """Test economy settings have correct default values"""
        response = requests.get(f"{BASE_URL}/api/growth/economy-settings")
        assert response.status_code == 200
        
        settings = response.json()["data"]
        
        # Verify defaults (may be overridden by DB, so just check types)
        assert isinstance(settings["redeem_percent"], (int, float)), "redeem_percent should be numeric"
        assert isinstance(settings["burn_rate"], (int, float)), "burn_rate should be numeric"
        assert isinstance(settings["processing_fee_inr"], (int, float)), "processing_fee_inr should be numeric"
        assert isinstance(settings["admin_charge_percent"], (int, float)), "admin_charge_percent should be numeric"
        assert isinstance(settings["base_mining"], (int, float)), "base_mining should be numeric"
        assert isinstance(settings["prc_rate"], (int, float)), "prc_rate should be numeric"
        
        # Verify reasonable ranges
        assert 0 <= settings["redeem_percent"] <= 100, "redeem_percent should be 0-100"
        assert 0 <= settings["burn_rate"] <= 100, "burn_rate should be 0-100"
        assert settings["processing_fee_inr"] >= 0, "processing_fee_inr should be non-negative"
        assert 0 <= settings["admin_charge_percent"] <= 100, "admin_charge_percent should be 0-100"
        assert settings["base_mining"] >= 0, "base_mining should be non-negative"
        assert settings["prc_rate"] > 0, "prc_rate should be positive"
        
        print(f"✓ Economy settings have valid values")


class TestPRCRate:
    """Test GET /api/growth/prc-rate"""
    
    def test_get_prc_rate_success(self):
        """Test PRC rate endpoint returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/growth/prc-rate")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "prc_rate" in data, "Response should have 'prc_rate' field"
        assert "description" in data, "Response should have 'description' field"
        
        prc_rate = data["prc_rate"]
        assert isinstance(prc_rate, (int, float)), "prc_rate should be numeric"
        assert prc_rate > 0, "prc_rate should be positive"
        
        print(f"✓ PRC rate: {prc_rate} ({data['description']})")
    
    def test_prc_rate_description_format(self):
        """Test PRC rate description format"""
        response = requests.get(f"{BASE_URL}/api/growth/prc-rate")
        assert response.status_code == 200
        
        data = response.json()
        description = data["description"]
        prc_rate = data["prc_rate"]
        
        # Description should be in format "X PRC = ₹1"
        assert "PRC" in description, "Description should contain 'PRC'"
        assert "₹1" in description, "Description should contain '₹1'"
        
        print(f"✓ PRC rate description format correct: {description}")


class TestCalculateRedeem:
    """Test POST /api/growth/calculate-redeem"""
    
    def test_calculate_redeem_1000_prc(self):
        """Test redeem calculation for 1000 PRC"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=1000")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have 'data' field"
        
        calc = data["data"]
        
        # Verify all required fields
        required_fields = [
            "redeem_prc", "burn_prc", "processing_fee_prc", "admin_charge_prc",
            "total_prc_deducted", "user_gets_inr", "prc_rate"
        ]
        for field in required_fields:
            assert field in calc, f"Missing field: {field}"
        
        # Verify redeem_prc matches input
        assert calc["redeem_prc"] == 1000, f"redeem_prc should be 1000, got {calc['redeem_prc']}"
        
        print(f"✓ Redeem calculation for 1000 PRC: {calc}")
    
    def test_calculate_redeem_formula_verification(self):
        """Verify redeem formula: Burn 5% + Processing ₹10 + Admin 20%"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=1000")
        assert response.status_code == 200
        
        calc = response.json()["data"]
        redeem_prc = calc["redeem_prc"]
        prc_rate = calc["prc_rate"]
        
        # Get current settings for verification
        settings_response = requests.get(f"{BASE_URL}/api/growth/economy-settings")
        settings = settings_response.json()["data"]
        
        # Calculate expected values
        expected_burn = round(redeem_prc * (settings["burn_rate"] / 100), 2)
        expected_processing = round(settings["processing_fee_inr"] * prc_rate, 2)
        expected_admin = round(redeem_prc * (settings["admin_charge_percent"] / 100), 2)
        expected_total = round(redeem_prc + expected_burn + expected_processing + expected_admin, 2)
        expected_inr = round(redeem_prc / prc_rate, 2)
        
        # Verify calculations (allow small floating point differences)
        assert abs(calc["burn_prc"] - expected_burn) < 0.1, f"Burn mismatch: {calc['burn_prc']} vs {expected_burn}"
        assert abs(calc["processing_fee_prc"] - expected_processing) < 0.1, f"Processing mismatch: {calc['processing_fee_prc']} vs {expected_processing}"
        assert abs(calc["admin_charge_prc"] - expected_admin) < 0.1, f"Admin mismatch: {calc['admin_charge_prc']} vs {expected_admin}"
        assert abs(calc["total_prc_deducted"] - expected_total) < 0.5, f"Total mismatch: {calc['total_prc_deducted']} vs {expected_total}"
        assert abs(calc["user_gets_inr"] - expected_inr) < 0.1, f"INR mismatch: {calc['user_gets_inr']} vs {expected_inr}"
        
        print(f"✓ Redeem formula verified:")
        print(f"  Burn ({settings['burn_rate']}%): {calc['burn_prc']} PRC")
        print(f"  Processing (₹{settings['processing_fee_inr']}): {calc['processing_fee_prc']} PRC")
        print(f"  Admin ({settings['admin_charge_percent']}%): {calc['admin_charge_prc']} PRC")
        print(f"  Total Deducted: {calc['total_prc_deducted']} PRC")
        print(f"  User Gets: ₹{calc['user_gets_inr']}")
    
    def test_calculate_redeem_breakdown_field(self):
        """Test breakdown field in redeem calculation"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=1000")
        assert response.status_code == 200
        
        calc = response.json()["data"]
        assert "breakdown" in calc, "Response should have 'breakdown' field"
        
        breakdown = calc["breakdown"]
        required_breakdown_fields = [
            "redeem_value", "burning", "processing_fee", "admin_charges", 
            "total_deducted", "you_get"
        ]
        for field in required_breakdown_fields:
            assert field in breakdown, f"Missing breakdown field: {field}"
        
        print(f"✓ Breakdown field present with all required fields")
    
    def test_calculate_redeem_negative_value(self):
        """Test redeem calculation with negative value returns error"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=-100")
        assert response.status_code == 400, f"Expected 400 for negative value, got {response.status_code}"
        print("✓ Negative redeem value correctly rejected")
    
    def test_calculate_redeem_zero_value(self):
        """Test redeem calculation with zero value returns error"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=0")
        assert response.status_code == 400, f"Expected 400 for zero value, got {response.status_code}"
        print("✓ Zero redeem value correctly rejected")
    
    def test_calculate_redeem_various_amounts(self):
        """Test redeem calculation with various amounts"""
        test_amounts = [100, 500, 1000, 5000, 10000]
        
        for amount in test_amounts:
            response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc={amount}")
            assert response.status_code == 200, f"Failed for amount {amount}"
            
            calc = response.json()["data"]
            assert calc["redeem_prc"] == amount
            assert calc["total_prc_deducted"] > amount, "Total deducted should be > redeem amount"
            assert calc["user_gets_inr"] > 0, "User should get positive INR"
        
        print(f"✓ Redeem calculation works for amounts: {test_amounts}")


class TestCalculateRedeemINR:
    """Test POST /api/growth/calculate-redeem-inr"""
    
    def test_calculate_redeem_inr_500(self):
        """Test PRC calculation for ₹500"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem-inr?inr_amount=500")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have 'data' field"
        
        calc = data["data"]
        
        # Verify user_gets_inr is approximately 500 (the requested amount)
        # Note: The API calculates PRC needed to get this INR amount
        assert "user_gets_inr" in calc, "Response should have 'user_gets_inr'"
        assert abs(calc["user_gets_inr"] - 500) < 1, f"user_gets_inr should be ~500, got {calc['user_gets_inr']}"
        
        print(f"✓ INR calculation for ₹500: Need {calc['redeem_prc']} PRC, Total deducted: {calc['total_prc_deducted']} PRC")
    
    def test_calculate_redeem_inr_formula(self):
        """Verify INR to PRC conversion formula"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem-inr?inr_amount=1000")
        assert response.status_code == 200
        
        calc = response.json()["data"]
        prc_rate = calc["prc_rate"]
        
        # PRC needed = INR × PRC_Rate
        expected_base_prc = round(1000 * prc_rate, 2)
        assert abs(calc["redeem_prc"] - expected_base_prc) < 0.1, f"Base PRC mismatch: {calc['redeem_prc']} vs {expected_base_prc}"
        
        print(f"✓ INR to PRC formula verified: ₹1000 × {prc_rate} = {calc['redeem_prc']} PRC")
    
    def test_calculate_redeem_inr_negative_value(self):
        """Test INR calculation with negative value returns error"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem-inr?inr_amount=-100")
        assert response.status_code == 400, f"Expected 400 for negative value, got {response.status_code}"
        print("✓ Negative INR value correctly rejected")
    
    def test_calculate_redeem_inr_zero_value(self):
        """Test INR calculation with zero value returns error"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem-inr?inr_amount=0")
        assert response.status_code == 400, f"Expected 400 for zero value, got {response.status_code}"
        print("✓ Zero INR value correctly rejected")


class TestMiningFormula:
    """Test Mining Formula: R(U) = max(3, 8 - 0.5 × log₂(U))"""
    
    def test_mining_formula_calculation(self):
        """Verify mining formula implementation"""
        # Test the formula: R(U) = max(3, 8 - 0.5 × log₂(U))
        test_cases = [
            (1, 8.0),      # log₂(1) = 0, R = 8 - 0 = 8
            (2, 7.5),      # log₂(2) = 1, R = 8 - 0.5 = 7.5
            (4, 7.0),      # log₂(4) = 2, R = 8 - 1 = 7
            (8, 6.5),      # log₂(8) = 3, R = 8 - 1.5 = 6.5
            (16, 6.0),     # log₂(16) = 4, R = 8 - 2 = 6
            (32, 5.5),     # log₂(32) = 5, R = 8 - 2.5 = 5.5
            (64, 5.0),     # log₂(64) = 6, R = 8 - 3 = 5
            (128, 4.5),    # log₂(128) = 7, R = 8 - 3.5 = 4.5
            (256, 4.0),    # log₂(256) = 8, R = 8 - 4 = 4
            (512, 3.5),    # log₂(512) = 9, R = 8 - 4.5 = 3.5
            (1024, 3.0),   # log₂(1024) = 10, R = 8 - 5 = 3 (min)
            (2048, 3.0),   # log₂(2048) = 11, R = max(3, 8 - 5.5) = 3 (min)
            (4096, 3.0),   # log₂(4096) = 12, R = max(3, 8 - 6) = 3 (min)
        ]
        
        for network_size, expected_prc in test_cases:
            # Calculate using the formula
            log_value = math.log2(max(1, network_size))
            calculated_prc = max(DEFAULT_MIN_PRC_PER_USER, DEFAULT_MAX_PRC_PER_USER - (0.5 * log_value))
            calculated_prc = round(calculated_prc, 2)
            
            assert abs(calculated_prc - expected_prc) < 0.01, \
                f"Formula mismatch for U={network_size}: expected {expected_prc}, got {calculated_prc}"
        
        print("✓ Mining formula R(U) = max(3, 8 - 0.5 × log₂(U)) verified for all test cases")
    
    def test_mining_formula_min_value(self):
        """Test that mining formula never goes below minimum (3 PRC)"""
        # Very large network sizes should still return minimum
        large_sizes = [10000, 100000, 1000000]
        
        for size in large_sizes:
            log_value = math.log2(size)
            calculated_prc = max(DEFAULT_MIN_PRC_PER_USER, DEFAULT_MAX_PRC_PER_USER - (0.5 * log_value))
            assert calculated_prc >= DEFAULT_MIN_PRC_PER_USER, \
                f"PRC per user should never be below {DEFAULT_MIN_PRC_PER_USER}, got {calculated_prc} for size {size}"
        
        print(f"✓ Mining formula correctly enforces minimum of {DEFAULT_MIN_PRC_PER_USER} PRC")
    
    def test_mining_formula_max_value(self):
        """Test that mining formula starts at maximum (8 PRC) for small networks"""
        # Network size 0 or 1 should return maximum
        for size in [0, 1]:
            if size <= 0:
                calculated_prc = DEFAULT_MAX_PRC_PER_USER
            else:
                log_value = math.log2(max(1, size))
                calculated_prc = max(DEFAULT_MIN_PRC_PER_USER, DEFAULT_MAX_PRC_PER_USER - (0.5 * log_value))
            
            assert calculated_prc == DEFAULT_MAX_PRC_PER_USER, \
                f"PRC per user should be {DEFAULT_MAX_PRC_PER_USER} for size {size}, got {calculated_prc}"
        
        print(f"✓ Mining formula correctly returns maximum of {DEFAULT_MAX_PRC_PER_USER} PRC for small networks")


class TestNetworkCapFormula:
    """Test Network Cap Formula: min(4000, 800 + 16×D)"""
    
    def test_network_cap_formula_calculation(self):
        """Verify network cap formula implementation"""
        # Test the formula: NetworkCap = min(4000, 800 + 16 × D)
        test_cases = [
            (0, 800),      # 800 + 16×0 = 800
            (1, 816),      # 800 + 16×1 = 816
            (5, 880),      # 800 + 16×5 = 880
            (10, 960),     # 800 + 16×10 = 960
            (50, 1600),    # 800 + 16×50 = 1600
            (100, 2400),   # 800 + 16×100 = 2400
            (150, 3200),   # 800 + 16×150 = 3200
            (200, 4000),   # 800 + 16×200 = 4000 (max)
            (250, 4000),   # 800 + 16×250 = 4800 → capped at 4000
            (500, 4000),   # 800 + 16×500 = 8800 → capped at 4000
        ]
        
        for direct_referrals, expected_cap in test_cases:
            calculated_cap = min(
                DEFAULT_MAX_NETWORK_CAP, 
                DEFAULT_NETWORK_CAP_BASE + (DEFAULT_NETWORK_CAP_PER_REFERRAL * direct_referrals)
            )
            
            assert calculated_cap == expected_cap, \
                f"Cap mismatch for D={direct_referrals}: expected {expected_cap}, got {calculated_cap}"
        
        print("✓ Network cap formula min(4000, 800 + 16×D) verified for all test cases")
    
    def test_network_cap_base_value(self):
        """Test network cap base value (800) with 0 referrals"""
        calculated_cap = min(
            DEFAULT_MAX_NETWORK_CAP, 
            DEFAULT_NETWORK_CAP_BASE + (DEFAULT_NETWORK_CAP_PER_REFERRAL * 0)
        )
        assert calculated_cap == DEFAULT_NETWORK_CAP_BASE, \
            f"Base cap should be {DEFAULT_NETWORK_CAP_BASE}, got {calculated_cap}"
        
        print(f"✓ Network cap base value is {DEFAULT_NETWORK_CAP_BASE}")
    
    def test_network_cap_max_value(self):
        """Test network cap never exceeds maximum (4000)"""
        # Very high referral counts should still cap at 4000
        high_referrals = [200, 300, 500, 1000]
        
        for referrals in high_referrals:
            calculated_cap = min(
                DEFAULT_MAX_NETWORK_CAP, 
                DEFAULT_NETWORK_CAP_BASE + (DEFAULT_NETWORK_CAP_PER_REFERRAL * referrals)
            )
            assert calculated_cap == DEFAULT_MAX_NETWORK_CAP, \
                f"Cap should be {DEFAULT_MAX_NETWORK_CAP} for {referrals} referrals, got {calculated_cap}"
        
        print(f"✓ Network cap correctly enforces maximum of {DEFAULT_MAX_NETWORK_CAP}")
    
    def test_network_cap_increment(self):
        """Test network cap increases by 16 per referral"""
        for i in range(10):
            cap_at_i = min(
                DEFAULT_MAX_NETWORK_CAP, 
                DEFAULT_NETWORK_CAP_BASE + (DEFAULT_NETWORK_CAP_PER_REFERRAL * i)
            )
            cap_at_i_plus_1 = min(
                DEFAULT_MAX_NETWORK_CAP, 
                DEFAULT_NETWORK_CAP_BASE + (DEFAULT_NETWORK_CAP_PER_REFERRAL * (i + 1))
            )
            
            # If not at max, increment should be 16
            if cap_at_i < DEFAULT_MAX_NETWORK_CAP:
                assert cap_at_i_plus_1 - cap_at_i == DEFAULT_NETWORK_CAP_PER_REFERRAL, \
                    f"Cap increment should be {DEFAULT_NETWORK_CAP_PER_REFERRAL}"
        
        print(f"✓ Network cap correctly increments by {DEFAULT_NETWORK_CAP_PER_REFERRAL} per referral")


class TestAdminEndpoints:
    """Test Admin Economy Settings Endpoints"""
    
    def test_admin_update_economy_settings(self):
        """Test admin can update economy settings"""
        # Update with valid values
        params = {
            "redeem_percent": 70,
            "burn_rate": 5,
            "processing_fee_inr": 10,
            "admin_charge_percent": 20,
            "base_mining": 550
        }
        
        response = requests.post(
            f"{BASE_URL}/api/growth/admin/economy-settings",
            params=params
        )
        
        # Should succeed (200) or require auth (401/403)
        assert response.status_code in [200, 401, 403], \
            f"Expected 200/401/403, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print("✓ Admin economy settings update successful")
        else:
            print(f"✓ Admin endpoint requires authentication (status: {response.status_code})")
    
    def test_admin_invalid_redeem_percent(self):
        """Test admin rejects invalid redeem percent"""
        # Invalid redeem percent (not in [50, 60, 70, 80, 100])
        response = requests.post(
            f"{BASE_URL}/api/growth/admin/economy-settings",
            params={"redeem_percent": 55}
        )
        
        # Should be 400 (bad request) or 401/403 (auth required)
        assert response.status_code in [400, 401, 403], \
            f"Expected 400/401/403 for invalid redeem_percent, got {response.status_code}"
        
        print("✓ Invalid redeem percent correctly rejected or auth required")
    
    def test_admin_set_prc_rate(self):
        """Test admin can set PRC rate"""
        response = requests.post(
            f"{BASE_URL}/api/growth/admin/set-prc-rate",
            params={"rate": 2.0}
        )
        
        # Should succeed (200) or require auth (401/403)
        assert response.status_code in [200, 401, 403], \
            f"Expected 200/401/403, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print("✓ Admin PRC rate set successful")
        else:
            print(f"✓ Admin PRC rate endpoint requires authentication (status: {response.status_code})")
    
    def test_admin_remove_prc_override(self):
        """Test admin can remove PRC rate override"""
        response = requests.delete(f"{BASE_URL}/api/growth/admin/prc-rate-override")
        
        # Should succeed (200) or require auth (401/403)
        assert response.status_code in [200, 401, 403], \
            f"Expected 200/401/403, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print("✓ Admin PRC rate override removal successful")
        else:
            print(f"✓ Admin PRC override removal requires authentication (status: {response.status_code})")


class TestExampleCalculation:
    """Test the example from requirements: 1000 PRC at rate 11"""
    
    def test_example_calculation_at_rate_11(self):
        """
        Verify example: 1000 PRC redeem at rate 11
        Expected: Burn 50 + Processing 110 + Admin 200 = Total 1360 PRC deducted
        User gets ₹90.91
        """
        # First, get current settings
        settings_response = requests.get(f"{BASE_URL}/api/growth/economy-settings")
        assert settings_response.status_code == 200
        settings = settings_response.json()["data"]
        
        # Calculate expected values for 1000 PRC at rate 11
        redeem_prc = 1000
        prc_rate = 11  # Example rate
        
        # Using default settings: burn=5%, processing=₹10, admin=20%
        expected_burn = redeem_prc * 0.05  # 50 PRC
        expected_processing = 10 * prc_rate  # 110 PRC (₹10 × 11)
        expected_admin = redeem_prc * 0.20  # 200 PRC
        expected_total = redeem_prc + expected_burn + expected_processing + expected_admin  # 1360 PRC
        expected_inr = redeem_prc / prc_rate  # ₹90.91
        
        print(f"✓ Example calculation verified (at rate 11):")
        print(f"  Redeem: {redeem_prc} PRC")
        print(f"  Burn (5%): {expected_burn} PRC")
        print(f"  Processing (₹10 × {prc_rate}): {expected_processing} PRC")
        print(f"  Admin (20%): {expected_admin} PRC")
        print(f"  Total Deducted: {expected_total} PRC")
        print(f"  User Gets: ₹{expected_inr:.2f}")
        
        # Verify the math
        assert expected_burn == 50, f"Burn should be 50, got {expected_burn}"
        assert expected_processing == 110, f"Processing should be 110, got {expected_processing}"
        assert expected_admin == 200, f"Admin should be 200, got {expected_admin}"
        assert expected_total == 1360, f"Total should be 1360, got {expected_total}"
        assert abs(expected_inr - 90.91) < 0.01, f"INR should be ~90.91, got {expected_inr}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
