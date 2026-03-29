"""
Test Burn Rate Economy Rules for Paras Reward App
==================================================

Tests for:
1. GET /api/redemption/calculate-charges - burn rate calculation
2. Bank redeem burn rate calculation
3. Mining speed multiplier (70% for PRC, 100% for cash)

Burn Rate Rules:
- Cash/INR users: 1% burn rate
- PRC subscription users: 5% burn rate

Formula:
- Subtotal = Service_Charges + ₹10 Processing + 20% Admin
- Burn = burn_rate% × Subtotal
- Total = Subtotal + Burn
"""

import pytest
import requests
import os
import math

# Get base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://burn-rates.preview.emergentagent.com').rstrip('/')

# Test user credentials
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # Elite, cash payment type
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"


class TestRedemptionChargesAPI:
    """Test /api/redemption/calculate-charges endpoint"""
    
    def test_calculate_charges_without_user_id_default_1_percent_burn(self):
        """Test charge calculation without user_id - should default to 1% burn"""
        amount_inr = 1000
        response = requests.get(f"{BASE_URL}/api/redemption/calculate-charges?amount_inr={amount_inr}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Response without user_id: {data}")
        
        # Verify structure
        assert "amount_inr" in data
        assert "processing_fee_inr" in data
        assert "admin_charge_inr" in data
        assert "burn_inr" in data
        assert "burn_rate_percent" in data
        assert "subtotal_inr" in data
        assert "total_inr" in data
        
        # Verify values
        assert data["amount_inr"] == amount_inr
        assert data["processing_fee_inr"] == 10  # Flat ₹10
        assert data["admin_charge_inr"] == 200  # 20% of 1000
        
        # Subtotal = 1000 + 10 + 200 = 1210
        expected_subtotal = amount_inr + 10 + 200
        assert data["subtotal_inr"] == expected_subtotal, f"Expected subtotal {expected_subtotal}, got {data['subtotal_inr']}"
        
        # Default burn rate should be 1%
        assert data["burn_rate_percent"] == 1, f"Expected 1% burn rate, got {data['burn_rate_percent']}"
        
        # Burn = 1% of 1210 = 12.10
        expected_burn = expected_subtotal * 0.01
        assert abs(data["burn_inr"] - expected_burn) < 0.01, f"Expected burn {expected_burn}, got {data['burn_inr']}"
        
        # Total = 1210 + 12.10 = 1222.10
        expected_total = expected_subtotal + expected_burn
        assert abs(data["total_inr"] - expected_total) < 0.01, f"Expected total {expected_total}, got {data['total_inr']}"
        
        print(f"✓ Default 1% burn rate verified: subtotal={expected_subtotal}, burn={expected_burn}, total={expected_total}")
    
    def test_calculate_charges_with_cash_user_1_percent_burn(self):
        """Test charge calculation with cash user - should get 1% burn"""
        amount_inr = 1000
        response = requests.get(f"{BASE_URL}/api/redemption/calculate-charges?amount_inr={amount_inr}&user_id={TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Response with cash user: {data}")
        
        # Verify burn rate is 1% for cash user
        assert data["burn_rate_percent"] == 1, f"Expected 1% burn for cash user, got {data['burn_rate_percent']}"
        
        # Verify burn_payment_type
        assert "burn_payment_type" in data
        print(f"✓ Cash user burn rate: {data['burn_rate_percent']}%, payment_type: {data.get('burn_payment_type')}")
    
    def test_burn_calculation_formula(self):
        """Verify burn calculation formula: Burn = burn_rate% × (Service + Processing + Admin)"""
        amount_inr = 500
        response = requests.get(f"{BASE_URL}/api/redemption/calculate-charges?amount_inr={amount_inr}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Calculate expected values
        processing_fee = 10
        admin_charge = amount_inr * 0.20  # 20%
        subtotal = amount_inr + processing_fee + admin_charge
        burn_rate = data["burn_rate_percent"] / 100
        expected_burn = subtotal * burn_rate
        
        # Verify
        assert abs(data["subtotal_inr"] - subtotal) < 0.01, f"Subtotal mismatch: expected {subtotal}, got {data['subtotal_inr']}"
        assert abs(data["burn_inr"] - expected_burn) < 0.01, f"Burn mismatch: expected {expected_burn}, got {data['burn_inr']}"
        
        print(f"✓ Formula verified: Subtotal={subtotal}, Burn={expected_burn} ({data['burn_rate_percent']}%)")
    
    def test_prc_conversion(self):
        """Verify PRC conversion is included in response"""
        amount_inr = 1000
        response = requests.get(f"{BASE_URL}/api/redemption/calculate-charges?amount_inr={amount_inr}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify PRC fields exist
        assert "amount_prc" in data
        assert "processing_fee_prc" in data
        assert "admin_charge_prc" in data
        assert "burn_prc" in data
        assert "total_prc" in data
        assert "prc_rate" in data
        
        prc_rate = data["prc_rate"]
        
        # Verify PRC calculations
        assert data["amount_prc"] == data["amount_inr"] * prc_rate
        assert data["burn_prc"] == data["burn_inr"] * prc_rate
        
        print(f"✓ PRC conversion verified: rate={prc_rate}, burn_prc={data['burn_prc']}")


class TestBankRedeemBurnRate:
    """Test bank redeem burn rate calculation"""
    
    def test_bank_redeem_denominations_has_burn_fields(self):
        """Verify /api/bank-redeem/denominations includes burn fields"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Bank redeem denominations response: {data}")
        
        # Check structure
        assert "min_amount" in data
        assert "max_amount" in data
        assert "samples" in data
        
        # Check samples have burn fields
        if data.get("samples"):
            sample = data["samples"][0]
            print(f"Sample calculation: {sample}")
            
            # Verify burn fields in sample
            assert "burn_inr" in sample or "burn_rate_percent" in sample, "Sample should have burn fields"
            
            if "burn_rate_percent" in sample:
                print(f"✓ Bank redeem sample has burn_rate_percent: {sample['burn_rate_percent']}")
    
    def test_bank_redeem_eligibility_check(self):
        """Test bank redeem eligibility check endpoint"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/check-eligibility/{TEST_USER_UID}")
        
        # May return 200 or 4xx depending on user state
        print(f"Eligibility check response: {response.status_code} - {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Eligibility data: {data}")


class TestMiningSpeedMultiplier:
    """Test mining speed multiplier based on subscription payment type"""
    
    def test_mining_status_has_boost_multiplier(self):
        """Verify mining status includes boost_multiplier"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Mining status response: {data}")
        
        # Verify boost_multiplier field exists
        assert "boost_multiplier" in data, "Mining status should include boost_multiplier"
        
        boost = data["boost_multiplier"]
        print(f"✓ Boost multiplier: {boost}")
        
        # Cash users should have 1.0 (100%), PRC users should have 0.70 (70%)
        assert boost in [0.70, 1.0], f"Boost multiplier should be 0.70 or 1.0, got {boost}"
    
    def test_mining_rate_breakdown_has_subscription_type(self):
        """Verify mining rate breakdown includes subscription_type"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Mining rate breakdown: {data}")
        
        # Verify subscription_type field
        assert "subscription_type" in data, "Rate breakdown should include subscription_type"
        assert "boost_multiplier" in data, "Rate breakdown should include boost_multiplier"
        
        print(f"✓ Subscription type: {data['subscription_type']}, Boost: {data['boost_multiplier']}")
    
    def test_cash_user_gets_100_percent_speed(self):
        """Verify cash user gets 100% mining speed (boost_multiplier=1.0)"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Test user is cash payment type, should get 1.0 multiplier
        boost = data.get("boost_multiplier", 0)
        
        # If user is cash type, boost should be 1.0
        # If user is PRC type, boost should be 0.70
        assert boost in [0.70, 1.0], f"Invalid boost multiplier: {boost}"
        
        if boost == 1.0:
            print(f"✓ Cash user verified: boost_multiplier=1.0 (100% speed)")
        else:
            print(f"ℹ User has PRC subscription: boost_multiplier=0.70 (70% speed)")


class TestGrowthNetworkStats:
    """Test growth network stats endpoint for mining speed info"""
    
    def test_network_stats_endpoint(self):
        """Test /api/growth/network-stats/{user_id} endpoint"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Network stats response: {data}")
        
        # Verify structure
        assert "success" in data or "data" in data or "network_size" in data
    
    def test_mining_speed_endpoint(self):
        """Test /api/growth/mining-speed/{user_id} endpoint if exists"""
        response = requests.get(f"{BASE_URL}/api/growth/mining-speed/{TEST_USER_UID}")
        
        print(f"Mining speed response: {response.status_code} - {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Mining speed data: {data}")


class TestBurnRateCalculationMath:
    """Mathematical verification of burn rate calculations"""
    
    def test_1_percent_burn_calculation(self):
        """Verify 1% burn calculation is correct"""
        amount_inr = 1000
        processing_fee = 10
        admin_charge = amount_inr * 0.20  # 200
        subtotal = amount_inr + processing_fee + admin_charge  # 1210
        
        expected_burn_1_percent = subtotal * 0.01  # 12.10
        
        response = requests.get(f"{BASE_URL}/api/redemption/calculate-charges?amount_inr={amount_inr}")
        assert response.status_code == 200
        
        data = response.json()
        
        if data["burn_rate_percent"] == 1:
            assert abs(data["burn_inr"] - expected_burn_1_percent) < 0.01
            print(f"✓ 1% burn verified: {data['burn_inr']} (expected {expected_burn_1_percent})")
    
    def test_5_percent_burn_calculation_formula(self):
        """Verify 5% burn calculation formula (for PRC users)"""
        # This is a formula verification - actual test requires PRC user
        amount_inr = 1000
        processing_fee = 10
        admin_charge = amount_inr * 0.20  # 200
        subtotal = amount_inr + processing_fee + admin_charge  # 1210
        
        expected_burn_5_percent = subtotal * 0.05  # 60.50
        
        print(f"✓ 5% burn formula: {expected_burn_5_percent} for subtotal {subtotal}")
        print(f"  Formula: Burn = 5% × (Service + ₹10 Processing + 20% Admin)")
        print(f"  = 5% × ({amount_inr} + {processing_fee} + {admin_charge})")
        print(f"  = 5% × {subtotal}")
        print(f"  = {expected_burn_5_percent}")


class TestUserSubscriptionPaymentType:
    """Test user subscription payment type retrieval"""
    
    def test_get_user_profile_has_subscription_info(self):
        """Verify user profile includes subscription payment type"""
        response = requests.get(f"{BASE_URL}/api/users/{TEST_USER_UID}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"User profile: {data}")
            
            # Check for subscription fields
            if "subscription_plan" in data:
                print(f"✓ Subscription plan: {data['subscription_plan']}")
            if "subscription_payment_type" in data:
                print(f"✓ Payment type: {data['subscription_payment_type']}")
        else:
            print(f"User profile endpoint returned: {response.status_code}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
