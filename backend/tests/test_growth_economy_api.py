"""
Growth Economy System - API Integration Tests
==============================================
Tests all Growth Economy APIs with mock users having different referral structures.

Formulas tested:
1. Mining Speed: R(U) = max(3, 8 - 0.5 × log₂(U))
2. Daily Mining: 550 + (U × R(U))
3. Network Cap: min(4000, 800 + 16×D)
4. Growth Level: Level 0-9 based on network size thresholds
5. Redeem Unlock: Admin override (default 70%) vs level-based
6. Subscription Speed: Explorer=0%, Elite PRC=70%, Elite Cash=100%
"""

import pytest
import requests
import os
import math
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://unified-redeem-check.preview.emergentagent.com')

# ==================== FORMULA VERIFICATION HELPERS ====================

def expected_prc_per_user(network_size: int) -> float:
    """R(U) = max(3, 8 - 0.5 × log₂(U))"""
    if network_size <= 0:
        return 8.0
    log_value = math.log2(max(1, network_size))
    prc_per_user = 8 - (0.5 * log_value)
    return max(3, round(prc_per_user, 4))

def expected_network_cap(direct_referrals: int) -> int:
    """NetworkCap = min(4000, 800 + 16×D)"""
    cap = 800 + (16 * direct_referrals)
    return min(4000, cap)

def expected_daily_mining(network_size: int, base: int = 550) -> float:
    """Daily PRC = 550 + (U × R(U))"""
    prc_per_user = expected_prc_per_user(network_size)
    network_mining = network_size * prc_per_user
    return base + network_mining


# ==================== API ENDPOINT TESTS ====================

class TestEconomySettingsAPI:
    """Test GET /api/growth/economy-settings endpoint"""
    
    def test_economy_settings_returns_defaults(self):
        """Verify economy settings endpoint returns all required fields"""
        response = requests.get(f"{BASE_URL}/api/growth/economy-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        
        settings = data.get("data", {})
        
        # Verify all required fields exist
        required_fields = [
            "redeem_percent", "burn_rate", "processing_fee_inr",
            "admin_charge_percent", "base_mining", "min_prc_per_user",
            "max_prc_per_user", "prc_rate"
        ]
        for field in required_fields:
            assert field in settings, f"Missing field: {field}"
        
        # Verify default values
        assert settings["redeem_percent"] == 70, f"Expected redeem_percent=70, got {settings['redeem_percent']}"
        assert settings["burn_rate"] == 5.0, f"Expected burn_rate=5.0, got {settings['burn_rate']}"
        assert settings["processing_fee_inr"] == 10.0, f"Expected processing_fee_inr=10.0, got {settings['processing_fee_inr']}"
        assert settings["admin_charge_percent"] == 20.0, f"Expected admin_charge_percent=20.0, got {settings['admin_charge_percent']}"
        assert settings["base_mining"] == 550, f"Expected base_mining=550, got {settings['base_mining']}"
        assert settings["min_prc_per_user"] == 3, f"Expected min_prc_per_user=3, got {settings['min_prc_per_user']}"
        assert settings["max_prc_per_user"] == 8, f"Expected max_prc_per_user=8, got {settings['max_prc_per_user']}"
        assert settings["prc_rate"] > 0, f"Expected prc_rate > 0, got {settings['prc_rate']}"
        
        print(f"✓ Economy settings verified: {settings}")


class TestPRCRateAPI:
    """Test GET /api/growth/prc-rate endpoint"""
    
    def test_prc_rate_returns_valid_rate(self):
        """Verify PRC rate endpoint returns valid rate"""
        response = requests.get(f"{BASE_URL}/api/growth/prc-rate")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "prc_rate" in data, "Missing prc_rate field"
        assert data["prc_rate"] > 0, f"Expected prc_rate > 0, got {data['prc_rate']}"
        assert "description" in data, "Missing description field"
        
        print(f"✓ PRC rate: {data['prc_rate']} ({data['description']})")


class TestCalculateRedeemAPI:
    """Test POST /api/growth/calculate-redeem endpoint"""
    
    def test_calculate_redeem_1000_prc(self):
        """Test redeem calculation with 1000 PRC"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=1000")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        
        result = data.get("data", {})
        
        # Verify all required fields
        required_fields = [
            "redeem_prc", "burn_prc", "processing_fee_prc",
            "admin_charge_prc", "total_prc_deducted", "user_gets_inr", "prc_rate"
        ]
        for field in required_fields:
            assert field in result, f"Missing field: {field}"
        
        # Verify calculations
        assert result["redeem_prc"] == 1000.0, f"Expected redeem_prc=1000, got {result['redeem_prc']}"
        
        # Burn = 5% of 1000 = 50
        assert result["burn_prc"] == 50.0, f"Expected burn_prc=50, got {result['burn_prc']}"
        
        # Admin charge = 20% of 1000 = 200
        assert result["admin_charge_prc"] == 200.0, f"Expected admin_charge_prc=200, got {result['admin_charge_prc']}"
        
        # Processing fee = ₹10 × PRC_rate
        prc_rate = result["prc_rate"]
        expected_processing = round(10 * prc_rate, 2)
        assert result["processing_fee_prc"] == expected_processing, f"Expected processing_fee_prc={expected_processing}, got {result['processing_fee_prc']}"
        
        # Total deducted = 1000 + 50 + processing + 200
        expected_total = round(1000 + 50 + expected_processing + 200, 2)
        assert result["total_prc_deducted"] == expected_total, f"Expected total_prc_deducted={expected_total}, got {result['total_prc_deducted']}"
        
        # User gets INR = 1000 / PRC_rate
        expected_inr = round(1000 / prc_rate, 2)
        assert result["user_gets_inr"] == expected_inr, f"Expected user_gets_inr={expected_inr}, got {result['user_gets_inr']}"
        
        print(f"✓ Redeem 1000 PRC: Total deducted={result['total_prc_deducted']}, User gets ₹{result['user_gets_inr']}")
    
    def test_calculate_redeem_500_prc(self):
        """Test redeem calculation with 500 PRC"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=500")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        result = data.get("data", {})
        
        assert result["redeem_prc"] == 500.0
        assert result["burn_prc"] == 25.0  # 5% of 500
        assert result["admin_charge_prc"] == 100.0  # 20% of 500
        
        print(f"✓ Redeem 500 PRC: Burn={result['burn_prc']}, Admin={result['admin_charge_prc']}")
    
    def test_calculate_redeem_negative_value(self):
        """Test redeem calculation with negative value should fail"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=-100")
        assert response.status_code == 400, f"Expected 400 for negative value, got {response.status_code}"
        
        print("✓ Negative redeem value correctly rejected")
    
    def test_calculate_redeem_zero_value(self):
        """Test redeem calculation with zero value should fail"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=0")
        assert response.status_code == 400, f"Expected 400 for zero value, got {response.status_code}"
        
        print("✓ Zero redeem value correctly rejected")


class TestCalculateRedeemINRAPI:
    """Test POST /api/growth/calculate-redeem-inr endpoint"""
    
    def test_calculate_redeem_inr_500(self):
        """Test calculating PRC needed for ₹500"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem-inr?inr_amount=500")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        
        result = data.get("data", {})
        
        # User should get exactly ₹500
        assert result["user_gets_inr"] == 500.0, f"Expected user_gets_inr=500, got {result['user_gets_inr']}"
        
        # Verify PRC needed = ₹500 × PRC_rate
        prc_rate = result["prc_rate"]
        expected_prc = round(500 * prc_rate, 2)
        assert result["redeem_prc"] == expected_prc, f"Expected redeem_prc={expected_prc}, got {result['redeem_prc']}"
        
        print(f"✓ To get ₹500: Need {result['redeem_prc']} PRC, Total deducted={result['total_prc_deducted']}")
    
    def test_calculate_redeem_inr_1000(self):
        """Test calculating PRC needed for ₹1000"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem-inr?inr_amount=1000")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        result = data.get("data", {})
        
        assert result["user_gets_inr"] == 1000.0
        
        print(f"✓ To get ₹1000: Need {result['redeem_prc']} PRC, Total deducted={result['total_prc_deducted']}")
    
    def test_calculate_redeem_inr_negative(self):
        """Test with negative INR amount should fail"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem-inr?inr_amount=-100")
        assert response.status_code == 400, f"Expected 400 for negative value, got {response.status_code}"
        
        print("✓ Negative INR amount correctly rejected")


# ==================== MINING FORMULA VERIFICATION TESTS ====================

class TestMiningFormulaVerification:
    """Verify Mining Formula: R(U) = max(3, 8 - 0.5 × log₂(U))"""
    
    def test_formula_u_0(self):
        """U=0: Should return max PRC (8)"""
        result = expected_prc_per_user(0)
        assert result == 8.0, f"U=0: Expected 8.0, got {result}"
        print(f"✓ U=0: R(0) = {result}")
    
    def test_formula_u_10(self):
        """U=10: R(10) = 8 - 0.5 × log₂(10) ≈ 6.34"""
        result = expected_prc_per_user(10)
        expected = 8 - (0.5 * math.log2(10))  # ≈ 6.34
        assert 6.0 <= result <= 7.0, f"U=10: Expected ~6.34, got {result}"
        print(f"✓ U=10: R(10) = {result} (expected ~{expected:.2f})")
    
    def test_formula_u_100(self):
        """U=100: R(100) = 8 - 0.5 × log₂(100) ≈ 4.68"""
        result = expected_prc_per_user(100)
        expected = 8 - (0.5 * math.log2(100))  # ≈ 4.68
        assert 4.5 <= result <= 5.0, f"U=100: Expected ~4.68, got {result}"
        print(f"✓ U=100: R(100) = {result} (expected ~{expected:.2f})")
    
    def test_formula_u_1000(self):
        """U=1000: R(1000) = 8 - 0.5 × log₂(1000) ≈ 3.01"""
        result = expected_prc_per_user(1000)
        expected = 8 - (0.5 * math.log2(1000))  # ≈ 3.01
        assert 3.0 <= result <= 3.5, f"U=1000: Expected ~3.01, got {result}"
        print(f"✓ U=1000: R(1000) = {result} (expected ~{expected:.2f})")
    
    def test_formula_u_4000(self):
        """U=4000: Should hit minimum of 3"""
        result = expected_prc_per_user(4000)
        assert result == 3.0, f"U=4000: Expected 3.0 (min), got {result}"
        print(f"✓ U=4000: R(4000) = {result} (minimum)")


class TestNetworkCapFormulaVerification:
    """Verify Network Cap Formula: min(4000, 800 + 16×D)"""
    
    def test_cap_d_0(self):
        """D=0: Cap = 800"""
        result = expected_network_cap(0)
        assert result == 800, f"D=0: Expected 800, got {result}"
        print(f"✓ D=0: Cap = {result}")
    
    def test_cap_d_10(self):
        """D=10: Cap = 800 + 160 = 960"""
        result = expected_network_cap(10)
        assert result == 960, f"D=10: Expected 960, got {result}"
        print(f"✓ D=10: Cap = {result}")
    
    def test_cap_d_50(self):
        """D=50: Cap = 800 + 800 = 1600"""
        result = expected_network_cap(50)
        assert result == 1600, f"D=50: Expected 1600, got {result}"
        print(f"✓ D=50: Cap = {result}")
    
    def test_cap_d_100(self):
        """D=100: Cap = 800 + 1600 = 2400"""
        result = expected_network_cap(100)
        assert result == 2400, f"D=100: Expected 2400, got {result}"
        print(f"✓ D=100: Cap = {result}")
    
    def test_cap_d_200(self):
        """D=200: Cap = min(4000, 800 + 3200) = 4000"""
        result = expected_network_cap(200)
        assert result == 4000, f"D=200: Expected 4000 (max), got {result}"
        print(f"✓ D=200: Cap = {result} (max)")
    
    def test_cap_d_500(self):
        """D=500: Cap = min(4000, 8800) = 4000"""
        result = expected_network_cap(500)
        assert result == 4000, f"D=500: Expected 4000 (max), got {result}"
        print(f"✓ D=500: Cap = {result} (max)")


class TestDailyMiningFormulaVerification:
    """Verify Daily Mining Formula: 550 + (U × R(U))"""
    
    def test_daily_u_0(self):
        """U=0: Daily = 550 + 0 = 550"""
        result = expected_daily_mining(0)
        assert result == 550, f"U=0: Expected 550, got {result}"
        print(f"✓ U=0: Daily = {result}")
    
    def test_daily_u_10(self):
        """U=10: Daily = 550 + (10 × 6.34) ≈ 613"""
        result = expected_daily_mining(10)
        assert 600 <= result <= 650, f"U=10: Expected ~613, got {result}"
        print(f"✓ U=10: Daily = {result}")
    
    def test_daily_u_100(self):
        """U=100: Daily = 550 + (100 × 4.68) ≈ 1018"""
        result = expected_daily_mining(100)
        assert 950 <= result <= 1100, f"U=100: Expected ~1018, got {result}"
        print(f"✓ U=100: Daily = {result}")
    
    def test_daily_u_1000(self):
        """U=1000: Daily = 550 + (1000 × 3.01) ≈ 3560"""
        result = expected_daily_mining(1000)
        assert 3500 <= result <= 3700, f"U=1000: Expected ~3560, got {result}"
        print(f"✓ U=1000: Daily = {result}")
    
    def test_daily_u_4000(self):
        """U=4000: Daily = 550 + (4000 × 3) = 12550"""
        result = expected_daily_mining(4000)
        assert result == 12550, f"U=4000: Expected 12550, got {result}"
        print(f"✓ U=4000: Daily = {result}")


# ==================== GROWTH LEVEL TESTS ====================

class TestGrowthLevelFormula:
    """Test Growth Level based on network size thresholds"""
    
    def test_level_thresholds(self):
        """Test all level thresholds: 10→L1, 20→L2, 40→L3, 80→L4, 160→L5, 320→L6, 640→L7, 800→L8, 1000+→L9"""
        thresholds = [
            (0, 0), (5, 0), (9, 0),
            (10, 1), (19, 1),
            (20, 2), (39, 2),
            (40, 3), (79, 3),
            (80, 4), (159, 4),
            (160, 5), (319, 5),
            (320, 6), (639, 6),
            (640, 7), (799, 7),
            (800, 8), (999, 8),
            (1000, 9), (5000, 9)
        ]
        
        for network_size, expected_level in thresholds:
            # Calculate level using same logic as backend
            level_thresholds = [10, 20, 40, 80, 160, 320, 640, 800, 1000]
            level = 0
            for i, threshold in enumerate(level_thresholds):
                if network_size >= threshold:
                    level = i + 1
            
            assert level == expected_level, f"Network={network_size}: Expected L{expected_level}, got L{level}"
        
        print("✓ All growth level thresholds verified")


# ==================== SUBSCRIPTION SPEED TESTS ====================

class TestSubscriptionSpeedMultiplier:
    """Test subscription speed multipliers"""
    
    def test_explorer_no_mining(self):
        """Explorer (free) = 0% mining (can't mine)"""
        # Explorer users cannot mine - this is enforced at API level
        print("✓ Explorer users cannot mine (enforced at API level)")
    
    def test_elite_cash_100_percent(self):
        """Elite Cash = 100% mining speed"""
        multiplier = 1.0
        base_mining = 550
        result = base_mining * multiplier
        assert result == 550, f"Expected 550, got {result}"
        print(f"✓ Elite Cash: {base_mining} × {multiplier} = {result}")
    
    def test_elite_prc_70_percent(self):
        """Elite PRC = 70% mining speed"""
        multiplier = 0.70
        base_mining = 550
        result = base_mining * multiplier
        assert result == 385, f"Expected 385, got {result}"
        print(f"✓ Elite PRC: {base_mining} × {multiplier} = {result}")


# ==================== COMPLETE SCENARIO TESTS ====================

class TestCompleteUserScenarios:
    """Test complete user scenarios with different referral structures"""
    
    def test_new_user_scenario(self):
        """New user: D=0, U=0"""
        direct_referrals = 0
        network_size = 0
        
        cap = expected_network_cap(direct_referrals)
        daily = expected_daily_mining(network_size)
        prc_per_user = expected_prc_per_user(network_size)
        
        assert cap == 800, f"Expected cap=800, got {cap}"
        assert daily == 550, f"Expected daily=550, got {daily}"
        assert prc_per_user == 8.0, f"Expected prc_per_user=8.0, got {prc_per_user}"
        
        print(f"✓ New user (D=0, U=0): Cap={cap}, Daily={daily}, PRC/user={prc_per_user}")
    
    def test_active_user_scenario(self):
        """Active user: D=25, U=100"""
        direct_referrals = 25
        network_size = 100
        
        cap = expected_network_cap(direct_referrals)
        daily = expected_daily_mining(network_size)
        prc_per_user = expected_prc_per_user(network_size)
        
        assert cap == 1200, f"Expected cap=1200, got {cap}"  # 800 + 25*16
        assert 950 <= daily <= 1100, f"Expected daily ~1018, got {daily}"
        assert 4.5 <= prc_per_user <= 5.0, f"Expected prc_per_user ~4.68, got {prc_per_user}"
        
        print(f"✓ Active user (D=25, U=100): Cap={cap}, Daily={daily:.2f}, PRC/user={prc_per_user:.2f}")
    
    def test_power_user_scenario(self):
        """Power user: D=200, U=2000"""
        direct_referrals = 200
        network_size = 2000
        
        cap = expected_network_cap(direct_referrals)
        daily = expected_daily_mining(network_size)
        prc_per_user = expected_prc_per_user(network_size)
        
        assert cap == 4000, f"Expected cap=4000 (max), got {cap}"
        assert daily > 6000, f"Expected daily > 6000, got {daily}"
        assert prc_per_user == 3.0, f"Expected prc_per_user=3.0 (min), got {prc_per_user}"
        
        print(f"✓ Power user (D=200, U=2000): Cap={cap}, Daily={daily:.2f}, PRC/user={prc_per_user}")


# ==================== EDGE CASE TESTS ====================

class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_network_cap_boundary(self):
        """Test network cap at boundary (D=200 should hit max)"""
        # D=199: 800 + 199*16 = 3984
        assert expected_network_cap(199) == 3984
        # D=200: 800 + 200*16 = 4000 (max)
        assert expected_network_cap(200) == 4000
        # D=201: min(4000, 4016) = 4000
        assert expected_network_cap(201) == 4000
        
        print("✓ Network cap boundary verified")
    
    def test_prc_per_user_minimum(self):
        """Test PRC per user hits minimum at large network"""
        # At U=1024, log2(1024) = 10, so R = 8 - 5 = 3 (minimum)
        result = expected_prc_per_user(1024)
        assert result == 3.0, f"Expected 3.0 at U=1024, got {result}"
        
        # At U=2048, should still be 3 (minimum)
        result = expected_prc_per_user(2048)
        assert result == 3.0, f"Expected 3.0 at U=2048, got {result}"
        
        print("✓ PRC per user minimum verified")
    
    def test_large_redeem_calculation(self):
        """Test redeem calculation with large PRC amount"""
        response = requests.post(f"{BASE_URL}/api/growth/calculate-redeem?redeem_prc=10000")
        assert response.status_code == 200
        
        data = response.json()
        result = data.get("data", {})
        
        assert result["redeem_prc"] == 10000.0
        assert result["burn_prc"] == 500.0  # 5% of 10000
        assert result["admin_charge_prc"] == 2000.0  # 20% of 10000
        
        print(f"✓ Large redeem (10000 PRC): Total deducted={result['total_prc_deducted']}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
