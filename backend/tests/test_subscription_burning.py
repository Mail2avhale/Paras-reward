"""
Test Subscription Pricing with Burning Formula
===============================================
Tests for the new subscription pricing formula:
- ₹999 + 18% GST + Burning (as per plan) + ₹10 Processing + 20% Admin

PRC subscription: 5% burn, 70% speed
Cash subscription: 1% burn, 100% speed

Also tests burning on redeem requests (bank redeem + unified redeem)
"""

import pytest
import requests
import os
import math

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://burn-rates.preview.emergentagent.com').rstrip('/')

# Test user credentials
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_PHONE = "9970100782"

# Expected pricing constants
ELITE_BASE_PRICE = 999
GST_RATE = 0.18
PROCESSING_FEE_INR = 10
ADMIN_CHARGE_RATE = 0.20
PRC_BURN_RATE = 0.05  # 5% for PRC subscription
CASH_BURN_RATE = 0.01  # 1% for Cash subscription


class TestElitePricingAPI:
    """Test /api/subscription/elite-pricing endpoint"""
    
    def test_elite_pricing_endpoint_returns_success(self):
        """Test that elite-pricing endpoint returns success"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        print(f"✅ Elite pricing endpoint returns success")
    
    def test_elite_pricing_returns_both_prc_and_cash(self):
        """Test that endpoint returns both PRC and Cash pricing"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check both pricing objects exist
        assert "pricing_prc" in data, "Missing pricing_prc in response"
        assert "pricing_cash" in data, "Missing pricing_cash in response"
        
        pricing_prc = data["pricing_prc"]
        pricing_cash = data["pricing_cash"]
        
        # Verify payment_type is set correctly
        assert pricing_prc.get("payment_type") == "prc", f"Expected payment_type=prc, got {pricing_prc.get('payment_type')}"
        assert pricing_cash.get("payment_type") == "cash", f"Expected payment_type=cash, got {pricing_cash.get('payment_type')}"
        
        print(f"✅ Both PRC and Cash pricing returned")
        print(f"   PRC pricing: {pricing_prc.get('total_prc')} PRC")
        print(f"   Cash pricing: {pricing_cash.get('total_prc')} PRC")
    
    def test_prc_pricing_includes_5_percent_burning(self):
        """Test that PRC pricing includes 5% burning"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        pricing_prc = data["pricing_prc"]
        
        # Check burn rate is 5%
        assert pricing_prc.get("burn_rate") == 5, f"Expected burn_rate=5, got {pricing_prc.get('burn_rate')}"
        
        # Verify burn_prc is calculated
        assert "burn_prc" in pricing_prc, "Missing burn_prc in PRC pricing"
        assert pricing_prc["burn_prc"] > 0, f"Expected burn_prc > 0, got {pricing_prc['burn_prc']}"
        
        # Verify total includes burn
        total_before_burn = pricing_prc.get("total_before_burn_prc", 0)
        burn_prc = pricing_prc.get("burn_prc", 0)
        total_prc = pricing_prc.get("total_prc", 0)
        
        expected_total = total_before_burn + burn_prc
        assert abs(total_prc - expected_total) < 1, f"Total PRC mismatch: {total_prc} != {expected_total}"
        
        print(f"✅ PRC pricing includes 5% burning")
        print(f"   Total before burn: {total_before_burn}")
        print(f"   Burn (5%): {burn_prc}")
        print(f"   Total PRC: {total_prc}")
    
    def test_cash_pricing_includes_1_percent_burning(self):
        """Test that Cash pricing includes 1% burning"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        pricing_cash = data["pricing_cash"]
        
        # Check burn rate is 1%
        assert pricing_cash.get("burn_rate") == 1, f"Expected burn_rate=1, got {pricing_cash.get('burn_rate')}"
        
        # Verify burn_prc is calculated
        assert "burn_prc" in pricing_cash, "Missing burn_prc in Cash pricing"
        assert pricing_cash["burn_prc"] > 0, f"Expected burn_prc > 0, got {pricing_cash['burn_prc']}"
        
        print(f"✅ Cash pricing includes 1% burning")
        print(f"   Burn (1%): {pricing_cash.get('burn_prc')}")
    
    def test_admin_charge_calculated_on_base_plus_processing(self):
        """Test that admin charge is 20% of (base_prc + processing_prc)"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        pricing_prc = data["pricing_prc"]
        
        base_prc = pricing_prc.get("base_prc", 0)
        processing_fee_prc = pricing_prc.get("processing_fee_prc", 0)
        admin_charges_prc = pricing_prc.get("admin_charges_prc", 0)
        
        # Admin charge should be 20% of (base + processing)
        expected_admin = (base_prc + processing_fee_prc) * ADMIN_CHARGE_RATE
        
        # Allow small rounding difference
        assert abs(admin_charges_prc - expected_admin) < 1, f"Admin charge mismatch: {admin_charges_prc} != {expected_admin}"
        
        print(f"✅ Admin charge correctly calculated on (base + processing)")
        print(f"   Base PRC: {base_prc}")
        print(f"   Processing PRC: {processing_fee_prc}")
        print(f"   Admin (20%): {admin_charges_prc}")
    
    def test_pricing_breakdown_has_all_required_fields(self):
        """Test that pricing breakdown has all required fields"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        pricing_prc = data["pricing_prc"]
        
        required_fields = [
            "base_inr", "gst_inr", "gst_rate", "base_with_gst_inr",
            "processing_fee_inr", "admin_charge_rate", "burn_rate",
            "payment_type", "prc_rate", "base_prc", "processing_fee_prc",
            "admin_charges_prc", "burn_prc", "total_before_burn_prc", "total_prc"
        ]
        
        for field in required_fields:
            assert field in pricing_prc, f"Missing field: {field}"
        
        print(f"✅ All required fields present in pricing breakdown")
    
    def test_burn_rate_labels_in_response(self):
        """Test that burn rate labels are in the response"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        
        assert data.get("burn_rate_prc") == "5%", f"Expected burn_rate_prc='5%', got {data.get('burn_rate_prc')}"
        assert data.get("burn_rate_cash") == "1%", f"Expected burn_rate_cash='1%', got {data.get('burn_rate_cash')}"
        
        print(f"✅ Burn rate labels correct: PRC=5%, Cash=1%")


class TestRedeemChargesAPI:
    """Test /api/redeem/calculate-charges endpoint"""
    
    def test_redeem_charges_prc_payment_5_percent_burn(self):
        """Test that PRC payment type shows 5% burn rate"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=100&payment_type=prc")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        
        charges = data.get("charges", {})
        burn_rate = charges.get("burn_rate", 0)
        
        assert burn_rate == 5, f"Expected burn_rate=5 for PRC payment, got {burn_rate}"
        
        print(f"✅ Redeem charges for PRC payment shows 5% burn rate")
        print(f"   Charges: {charges}")
    
    def test_redeem_charges_cash_payment_1_percent_burn(self):
        """Test that Cash payment type shows 1% burn rate"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=100&payment_type=cash")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        
        charges = data.get("charges", {})
        burn_rate = charges.get("burn_rate", 0)
        
        assert burn_rate == 1, f"Expected burn_rate=1 for Cash payment, got {burn_rate}"
        
        print(f"✅ Redeem charges for Cash payment shows 1% burn rate")
        print(f"   Charges: {charges}")
    
    def test_redeem_charges_default_is_cash(self):
        """Test that default payment type is cash (1% burn)"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=100")
        assert response.status_code == 200
        
        data = response.json()
        charges = data.get("charges", {})
        burn_rate = charges.get("burn_rate", 0)
        
        # Default should be cash (1% burn)
        assert burn_rate == 1, f"Expected default burn_rate=1 (cash), got {burn_rate}"
        
        print(f"✅ Default payment type is cash (1% burn)")
    
    def test_redeem_charges_burn_prc_calculated(self):
        """Test that burn_prc is calculated correctly"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=100&payment_type=prc")
        assert response.status_code == 200
        
        data = response.json()
        charges = data.get("charges", {})
        
        total_before_burn = charges.get("total_before_burn_prc", 0)
        burn_prc = charges.get("burn_prc", 0)
        total_prc = charges.get("total_prc_required", 0)
        
        # Verify burn is 5% of total before burn
        expected_burn = total_before_burn * 0.05
        assert abs(burn_prc - expected_burn) < 1, f"Burn PRC mismatch: {burn_prc} != {expected_burn}"
        
        # Verify total includes burn
        expected_total = total_before_burn + burn_prc
        assert abs(total_prc - expected_total) < 1, f"Total PRC mismatch: {total_prc} != {expected_total}"
        
        print(f"✅ Burn PRC calculated correctly")
        print(f"   Total before burn: {total_before_burn}")
        print(f"   Burn (5%): {burn_prc}")
        print(f"   Total PRC: {total_prc}")


class TestMathVerification:
    """Verify the math calculations match expected values"""
    
    def test_prc_subscription_math_with_rate_10(self):
        """
        Verify PRC subscription math with PRC rate = 10
        
        Expected calculation:
        - Amount: ₹1178.82 (999 + 18% GST)
        - base_prc = 11788 (1178.82 × 10, rounded)
        - processing_prc = 100 (10 × 10)
        - admin = 2378 (20% × (11788 + 100))
        - burn = 713 (5% × (11788 + 100 + 2378))
        - total = 14979 PRC
        """
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        pricing_prc = data["pricing_prc"]
        prc_rate = pricing_prc.get("prc_rate", 10)
        
        # Calculate expected values
        base_with_gst = 999 * 1.18  # 1178.82
        expected_base_prc = round(base_with_gst * prc_rate)
        expected_processing_prc = round(10 * prc_rate)
        expected_admin_prc = round((expected_base_prc + expected_processing_prc) * 0.20)
        expected_total_before_burn = expected_base_prc + expected_processing_prc + expected_admin_prc
        expected_burn_prc = round(expected_total_before_burn * 0.05)
        expected_total_prc = expected_total_before_burn + expected_burn_prc
        
        actual_total_prc = pricing_prc.get("total_prc", 0)
        
        print(f"PRC Rate: {prc_rate}")
        print(f"Expected calculation:")
        print(f"  Base PRC: {expected_base_prc}")
        print(f"  Processing PRC: {expected_processing_prc}")
        print(f"  Admin PRC: {expected_admin_prc}")
        print(f"  Total before burn: {expected_total_before_burn}")
        print(f"  Burn (5%): {expected_burn_prc}")
        print(f"  Expected Total: {expected_total_prc}")
        print(f"  Actual Total: {actual_total_prc}")
        
        # Allow 1% tolerance for rounding differences
        tolerance = expected_total_prc * 0.01
        assert abs(actual_total_prc - expected_total_prc) < tolerance, \
            f"Total PRC mismatch: expected ~{expected_total_prc}, got {actual_total_prc}"
        
        print(f"✅ PRC subscription math verified")
    
    def test_cash_subscription_math_with_rate_10(self):
        """
        Verify Cash subscription math with PRC rate = 10
        
        Expected calculation (1% burn instead of 5%):
        - burn = 143 (1% × (11788 + 100 + 2378))
        - total = 14409 PRC
        """
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        pricing_cash = data["pricing_cash"]
        prc_rate = pricing_cash.get("prc_rate", 10)
        
        # Calculate expected values
        base_with_gst = 999 * 1.18  # 1178.82
        expected_base_prc = round(base_with_gst * prc_rate)
        expected_processing_prc = round(10 * prc_rate)
        expected_admin_prc = round((expected_base_prc + expected_processing_prc) * 0.20)
        expected_total_before_burn = expected_base_prc + expected_processing_prc + expected_admin_prc
        expected_burn_prc = round(expected_total_before_burn * 0.01)  # 1% for cash
        expected_total_prc = expected_total_before_burn + expected_burn_prc
        
        actual_total_prc = pricing_cash.get("total_prc", 0)
        
        print(f"PRC Rate: {prc_rate}")
        print(f"Expected calculation (Cash - 1% burn):")
        print(f"  Total before burn: {expected_total_before_burn}")
        print(f"  Burn (1%): {expected_burn_prc}")
        print(f"  Expected Total: {expected_total_prc}")
        print(f"  Actual Total: {actual_total_prc}")
        
        # Allow 1% tolerance for rounding differences
        tolerance = expected_total_prc * 0.01
        assert abs(actual_total_prc - expected_total_prc) < tolerance, \
            f"Total PRC mismatch: expected ~{expected_total_prc}, got {actual_total_prc}"
        
        print(f"✅ Cash subscription math verified")


class TestComparisonTable:
    """Test that comparison data is available for Cash vs PRC"""
    
    def test_burn_rate_difference(self):
        """Test that PRC has higher burn rate than Cash"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        pricing_prc = data["pricing_prc"]
        pricing_cash = data["pricing_cash"]
        
        prc_burn = pricing_prc.get("burn_rate", 0)
        cash_burn = pricing_cash.get("burn_rate", 0)
        
        assert prc_burn > cash_burn, f"PRC burn ({prc_burn}%) should be > Cash burn ({cash_burn}%)"
        assert prc_burn == 5, f"PRC burn should be 5%, got {prc_burn}%"
        assert cash_burn == 1, f"Cash burn should be 1%, got {cash_burn}%"
        
        print(f"✅ Burn rate comparison: PRC={prc_burn}% > Cash={cash_burn}%")
    
    def test_prc_total_higher_than_cash(self):
        """Test that PRC total is higher than Cash total (due to higher burn)"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        
        data = response.json()
        pricing_prc = data["pricing_prc"]
        pricing_cash = data["pricing_cash"]
        
        prc_total = pricing_prc.get("total_prc", 0)
        cash_total = pricing_cash.get("total_prc", 0)
        
        assert prc_total > cash_total, f"PRC total ({prc_total}) should be > Cash total ({cash_total})"
        
        difference = prc_total - cash_total
        print(f"✅ PRC total ({prc_total}) > Cash total ({cash_total})")
        print(f"   Difference: {difference} PRC (due to higher burn rate)")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
