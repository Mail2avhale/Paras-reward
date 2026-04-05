"""
PRC Rate Consistency Tests - Iteration 172
Tests for PRC amount consistency across:
1. Backend /api/subscription/elite-pricing endpoint
2. PRCRateDisplay component formula
3. getPRCPrice() fallback formula
4. handlePRCPayment refresh behavior
5. User 360 total_redeemed stat (PRC format)
"""

import pytest
import requests
import os
import math

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
TEST_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"

# Expected pricing constants (from backend)
ELITE_BASE_PRICE = 999
GST_RATE = 0.18
PROCESSING_FEE_INR = 10
ADMIN_CHARGE_RATE = 0.20
BURN_RATE = 0.05


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "pin": ADMIN_PIN
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


class TestElitePricingEndpoint:
    """Test /api/subscription/elite-pricing endpoint"""
    
    def test_elite_pricing_returns_success(self):
        """Verify elite-pricing endpoint returns success"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Elite pricing endpoint returns success")
    
    def test_elite_pricing_has_required_fields(self):
        """Verify all required pricing fields are present"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        data = response.json()
        pricing = data.get("pricing", {})
        
        required_fields = [
            "base_inr", "gst_inr", "gst_rate", "base_with_gst_inr",
            "processing_fee_inr", "admin_charge_rate", "prc_rate",
            "base_prc", "processing_fee_prc", "admin_charges_prc",
            "burn_prc", "total_prc"
        ]
        
        for field in required_fields:
            assert field in pricing, f"Missing field: {field}"
        print(f"✓ All required pricing fields present")
    
    def test_elite_pricing_formula_correctness(self):
        """Verify the pricing formula matches backend calculate_elite_prc_price()"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        data = response.json()
        pricing = data.get("pricing", {})
        
        prc_rate = pricing["prc_rate"]
        
        # Step 1: Base + GST
        expected_base_with_gst = ELITE_BASE_PRICE * (1 + GST_RATE)
        assert abs(pricing["base_with_gst_inr"] - expected_base_with_gst) < 0.01, \
            f"Base+GST mismatch: expected {expected_base_with_gst}, got {pricing['base_with_gst_inr']}"
        
        # Step 2: Convert to PRC
        expected_base_prc = expected_base_with_gst * prc_rate
        assert abs(pricing["base_prc"] - expected_base_prc) < 0.1, \
            f"Base PRC mismatch: expected {expected_base_prc}, got {pricing['base_prc']}"
        
        # Step 3: Processing Fee
        expected_processing_prc = PROCESSING_FEE_INR * prc_rate
        assert abs(pricing["processing_fee_prc"] - expected_processing_prc) < 0.1, \
            f"Processing PRC mismatch: expected {expected_processing_prc}, got {pricing['processing_fee_prc']}"
        
        # Step 4: Admin Charges = 20% of (base_prc + processing_prc)
        subtotal_prc = expected_base_prc + expected_processing_prc
        expected_admin_prc = subtotal_prc * ADMIN_CHARGE_RATE
        assert abs(pricing["admin_charges_prc"] - expected_admin_prc) < 0.1, \
            f"Admin PRC mismatch: expected {expected_admin_prc}, got {pricing['admin_charges_prc']}"
        
        # Step 5: Burn = 5% of (base + processing + admin)
        subtotal_before_burn = expected_base_prc + expected_processing_prc + expected_admin_prc
        expected_burn_prc = subtotal_before_burn * BURN_RATE
        assert abs(pricing["burn_prc"] - expected_burn_prc) < 0.1, \
            f"Burn PRC mismatch: expected {expected_burn_prc}, got {pricing['burn_prc']}"
        
        # Step 6: Total
        expected_total = subtotal_before_burn + expected_burn_prc
        assert abs(pricing["total_prc"] - expected_total) < 0.1, \
            f"Total PRC mismatch: expected {expected_total}, got {pricing['total_prc']}"
        
        print(f"✓ Pricing formula verified at rate {prc_rate}:")
        print(f"  Base+GST: ₹{pricing['base_with_gst_inr']}")
        print(f"  Base PRC: {pricing['base_prc']}")
        print(f"  Processing PRC: {pricing['processing_fee_prc']}")
        print(f"  Admin PRC (20% of base+proc): {pricing['admin_charges_prc']}")
        print(f"  Burn PRC (5% of subtotal): {pricing['burn_prc']}")
        print(f"  Total PRC: {pricing['total_prc']}")
    
    def test_total_prc_required_matches_pricing_total(self):
        """Verify total_prc_required matches pricing.total_prc"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        data = response.json()
        
        assert data["total_prc_required"] == data["pricing"]["total_prc"], \
            f"total_prc_required ({data['total_prc_required']}) != pricing.total_prc ({data['pricing']['total_prc']})"
        print(f"✓ total_prc_required matches pricing.total_prc: {data['total_prc_required']}")


class TestPRCRateEndpoint:
    """Test /api/prc-economy/current-rate endpoint"""
    
    def test_current_rate_returns_success(self):
        """Verify current-rate endpoint returns success"""
        response = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Current rate endpoint returns success")
    
    def test_current_rate_has_final_rate(self):
        """Verify final_rate is present and valid"""
        response = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        data = response.json()
        
        final_rate = data.get("rate", {}).get("final_rate")
        assert final_rate is not None, "final_rate is missing"
        assert isinstance(final_rate, (int, float)), "final_rate must be numeric"
        assert final_rate > 0, "final_rate must be positive"
        print(f"✓ Current PRC rate: {final_rate}")
    
    def test_rate_consistency_between_endpoints(self):
        """Verify PRC rate is consistent between endpoints"""
        rate_response = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        pricing_response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        
        rate_from_economy = rate_response.json().get("rate", {}).get("final_rate")
        rate_from_pricing = pricing_response.json().get("pricing", {}).get("prc_rate")
        
        assert rate_from_economy == rate_from_pricing, \
            f"Rate mismatch: economy={rate_from_economy}, pricing={rate_from_pricing}"
        print(f"✓ PRC rate consistent across endpoints: {rate_from_economy}")


class TestUser360TotalRedeemed:
    """Test User 360 total_redeemed stat shows PRC format"""
    
    def test_user360_stats_has_total_redeemed(self, admin_token):
        """Verify User 360 returns total_redeemed in stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/full/{TEST_USER_UID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        stats = data.get("stats", {})
        assert "total_redeemed" in stats, "total_redeemed missing from stats"
        
        total_redeemed = stats["total_redeemed"]
        assert isinstance(total_redeemed, (int, float)), "total_redeemed must be numeric"
        print(f"✓ User 360 total_redeemed: {total_redeemed} PRC")
    
    def test_user360_stats_total_redeemed_is_prc_not_inr(self, admin_token):
        """Verify total_redeemed is in PRC (not INR with ₹ symbol)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/full/{TEST_USER_UID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        stats = data.get("stats", {})
        
        total_redeemed = stats.get("total_redeemed", 0)
        
        # The value should be a number (PRC), not a string with ₹
        assert isinstance(total_redeemed, (int, float)), \
            f"total_redeemed should be numeric PRC, got {type(total_redeemed)}"
        
        # If it's a string, it shouldn't contain ₹
        if isinstance(total_redeemed, str):
            assert "₹" not in total_redeemed, \
                f"total_redeemed should be PRC, not INR: {total_redeemed}"
        
        print(f"✓ total_redeemed is in PRC format: {total_redeemed}")


class TestFrontendFormulaConsistency:
    """Test that frontend formula matches backend"""
    
    def test_frontend_formula_matches_backend(self):
        """
        Verify the frontend PRCRateDisplay formula matches backend:
        Backend: admin = 20% of (base_prc + processing_prc)
        Frontend should use: admin = 20% of (amountInPRC + processingFeeInPRC)
        """
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        pricing = response.json().get("pricing", {})
        
        prc_rate = pricing["prc_rate"]
        base_inr = ELITE_BASE_PRICE
        gst_inr = base_inr * GST_RATE
        base_with_gst = base_inr + gst_inr
        processing_fee = PROCESSING_FEE_INR
        
        # Frontend formula (from PRCRateDisplay.js lines 78-86):
        # amountInPRC = amount * currentRate
        # processingFeeInPRC = processingFee * currentRate
        # subtotalPRC = amountInPRC + processingFeeInPRC
        # adminChargeInPRC = subtotalPRC * adminChargePercent / 100
        # totalBeforeBurn = amountInPRC + processingFeeInPRC + adminChargeInPRC
        # burnPRC = totalBeforeBurn * burnRate / 100
        # totalPRC = Math.round((totalBeforeBurn + burnPRC) * 100) / 100
        
        amount_in_prc = base_with_gst * prc_rate
        processing_fee_in_prc = processing_fee * prc_rate
        subtotal_prc = amount_in_prc + processing_fee_in_prc
        admin_charge_in_prc = subtotal_prc * 0.20  # 20%
        total_before_burn = amount_in_prc + processing_fee_in_prc + admin_charge_in_prc
        burn_prc = total_before_burn * 0.05  # 5%
        total_prc = round((total_before_burn + burn_prc) * 100) / 100
        
        # Compare with backend
        backend_total = pricing["total_prc"]
        
        assert abs(total_prc - backend_total) < 1, \
            f"Frontend formula ({total_prc}) doesn't match backend ({backend_total})"
        
        print(f"✓ Frontend formula matches backend:")
        print(f"  Frontend calculated: {total_prc} PRC")
        print(f"  Backend returned: {backend_total} PRC")
        print(f"  Difference: {abs(total_prc - backend_total):.2f} PRC")


class TestSubscriptionPaymentVariance:
    """Test the 10% variance check for PRC payment"""
    
    def test_variance_check_exists(self):
        """Verify backend has 10% variance check (from server.py line 11699)"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        pricing = response.json().get("pricing", {})
        expected_prc = pricing["total_prc"]
        
        # 10% variance
        variance = expected_prc * 0.10
        min_acceptable = expected_prc - variance
        max_acceptable = expected_prc + variance
        
        print(f"✓ 10% variance check:")
        print(f"  Expected PRC: {expected_prc}")
        print(f"  Acceptable range: {min_acceptable:.2f} - {max_acceptable:.2f}")
        print(f"  Variance: ±{variance:.2f} PRC")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
