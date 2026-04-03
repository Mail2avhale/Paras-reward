"""
Test Burn Rate in Unified Redeem and Redemption APIs
=====================================================
Tests burn rate calculation for:
- /api/redeem/calculate-charges (unified_redeem_v2.py)
- /api/redemption/calculate-charges (server.py)

Burn Formula:
- Subtotal = Amount + ₹10 Processing + 20% Admin
- Burn = burn_rate% × Subtotal
- Total = Subtotal + Burn

Burn Rates:
- Cash users: 1% burn
- PRC users: 5% burn
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://prc-economy-fix.preview.emergentagent.com')

# Test Users from credentials
CASH_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # Cash payment type, 1% burn
PRC_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"   # PRC payment type, 5% burn


class TestUnifiedRedeemBurnRate:
    """Test /api/redeem/calculate-charges endpoint burn rate"""
    
    def test_cash_user_burn_rate_1_percent(self):
        """Cash user should get 1% burn rate"""
        url = f"{BASE_URL}/api/redeem/calculate-charges"
        params = {"amount": 1000, "user_id": CASH_USER_UID}
        
        response = requests.get(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        
        charges = data.get("charges", {})
        
        # Verify burn rate fields exist
        assert "burn_inr" in charges, f"Missing burn_inr in charges: {charges}"
        assert "burn_rate_percent" in charges, f"Missing burn_rate_percent in charges: {charges}"
        assert "burn_payment_type" in charges, f"Missing burn_payment_type in charges: {charges}"
        
        # Verify cash user gets 1% burn
        assert charges["burn_rate_percent"] == 1, f"Expected burn_rate_percent=1 for cash user, got {charges['burn_rate_percent']}"
        assert charges["burn_payment_type"] == "cash", f"Expected burn_payment_type=cash, got {charges['burn_payment_type']}"
        
        # Verify burn calculation: Subtotal = 1000 + 10 + 200 = 1210, Burn = 1% × 1210 = 12.10
        expected_subtotal = 1000 + 10 + 200  # amount + processing + admin
        expected_burn = expected_subtotal * 0.01  # 1%
        
        assert charges["subtotal_inr"] == expected_subtotal, f"Expected subtotal_inr={expected_subtotal}, got {charges['subtotal_inr']}"
        assert abs(charges["burn_inr"] - expected_burn) < 0.01, f"Expected burn_inr≈{expected_burn}, got {charges['burn_inr']}"
        
        print(f"✅ Cash user burn rate: {charges['burn_rate_percent']}%, burn_inr: {charges['burn_inr']}, payment_type: {charges['burn_payment_type']}")
    
    def test_prc_user_burn_rate_5_percent(self):
        """PRC user should get 5% burn rate"""
        url = f"{BASE_URL}/api/redeem/calculate-charges"
        params = {"amount": 1000, "user_id": PRC_USER_UID}
        
        response = requests.get(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        
        charges = data.get("charges", {})
        
        # Verify burn rate fields exist
        assert "burn_inr" in charges, f"Missing burn_inr in charges: {charges}"
        assert "burn_rate_percent" in charges, f"Missing burn_rate_percent in charges: {charges}"
        assert "burn_payment_type" in charges, f"Missing burn_payment_type in charges: {charges}"
        
        # Verify PRC user gets 5% burn
        assert charges["burn_rate_percent"] == 5, f"Expected burn_rate_percent=5 for PRC user, got {charges['burn_rate_percent']}"
        assert charges["burn_payment_type"] == "prc", f"Expected burn_payment_type=prc, got {charges['burn_payment_type']}"
        
        # Verify burn calculation: Subtotal = 1000 + 10 + 200 = 1210, Burn = 5% × 1210 = 60.50
        expected_subtotal = 1000 + 10 + 200  # amount + processing + admin
        expected_burn = expected_subtotal * 0.05  # 5%
        
        assert charges["subtotal_inr"] == expected_subtotal, f"Expected subtotal_inr={expected_subtotal}, got {charges['subtotal_inr']}"
        assert abs(charges["burn_inr"] - expected_burn) < 0.01, f"Expected burn_inr≈{expected_burn}, got {charges['burn_inr']}"
        
        print(f"✅ PRC user burn rate: {charges['burn_rate_percent']}%, burn_inr: {charges['burn_inr']}, payment_type: {charges['burn_payment_type']}")
    
    def test_burn_prc_field_exists(self):
        """Verify burn_prc field is included in response"""
        url = f"{BASE_URL}/api/redeem/calculate-charges"
        params = {"amount": 1000, "user_id": CASH_USER_UID}
        
        response = requests.get(url, params=params)
        assert response.status_code == 200
        
        data = response.json()
        charges = data.get("charges", {})
        
        assert "burn_prc" in charges, f"Missing burn_prc in charges: {charges}"
        assert charges["burn_prc"] > 0, f"Expected burn_prc > 0, got {charges['burn_prc']}"
        
        print(f"✅ burn_prc field present: {charges['burn_prc']}")


class TestRedemptionBurnRate:
    """Test /api/redemption/calculate-charges endpoint burn rate"""
    
    def test_cash_user_redemption_burn_rate(self):
        """Cash user should get 1% burn rate in redemption API"""
        url = f"{BASE_URL}/api/redemption/calculate-charges"
        params = {"amount_inr": 1000, "user_id": CASH_USER_UID}
        
        response = requests.get(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify burn rate fields
        assert "burn_rate_percent" in data, f"Missing burn_rate_percent: {data}"
        assert "burn_inr" in data, f"Missing burn_inr: {data}"
        assert "burn_payment_type" in data, f"Missing burn_payment_type: {data}"
        
        # Verify 1% burn for cash user
        assert data["burn_rate_percent"] == 1, f"Expected burn_rate_percent=1, got {data['burn_rate_percent']}"
        
        print(f"✅ Redemption API cash user: burn_rate={data['burn_rate_percent']}%, burn_inr={data['burn_inr']}")
    
    def test_prc_user_redemption_burn_rate(self):
        """PRC user should get 5% burn rate in redemption API"""
        url = f"{BASE_URL}/api/redemption/calculate-charges"
        params = {"amount_inr": 1000, "user_id": PRC_USER_UID}
        
        response = requests.get(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify burn rate fields
        assert "burn_rate_percent" in data, f"Missing burn_rate_percent: {data}"
        assert "burn_inr" in data, f"Missing burn_inr: {data}"
        assert "burn_payment_type" in data, f"Missing burn_payment_type: {data}"
        
        # Verify 5% burn for PRC user
        assert data["burn_rate_percent"] == 5, f"Expected burn_rate_percent=5, got {data['burn_rate_percent']}"
        assert data["burn_payment_type"] == "prc", f"Expected burn_payment_type=prc, got {data['burn_payment_type']}"
        
        print(f"✅ Redemption API PRC user: burn_rate={data['burn_rate_percent']}%, burn_inr={data['burn_inr']}")
    
    def test_default_burn_rate_no_user(self):
        """Without user_id, should default to 1% burn"""
        url = f"{BASE_URL}/api/redemption/calculate-charges"
        params = {"amount_inr": 1000}
        
        response = requests.get(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Default should be 1% burn
        assert data["burn_rate_percent"] == 1, f"Expected default burn_rate_percent=1, got {data['burn_rate_percent']}"
        
        print(f"✅ Default burn rate (no user): {data['burn_rate_percent']}%")


class TestBurnRateMathVerification:
    """Verify burn rate calculation math is correct"""
    
    def test_burn_formula_cash_user(self):
        """Verify: Subtotal = Amount + ₹10 + 20%, Burn = 1% × Subtotal"""
        url = f"{BASE_URL}/api/redeem/calculate-charges"
        params = {"amount": 1000, "user_id": CASH_USER_UID}
        
        response = requests.get(url, params=params)
        data = response.json()
        charges = data.get("charges", {})
        
        # Manual calculation
        amount = 1000
        processing_fee = 10
        admin_charge = amount * 0.20  # 200
        subtotal = amount + processing_fee + admin_charge  # 1210
        burn = subtotal * 0.01  # 12.10
        total = subtotal + burn  # 1222.10
        
        assert charges["amount_inr"] == amount
        assert charges["platform_fee_inr"] == processing_fee
        assert charges["admin_charge_inr"] == admin_charge
        assert charges["subtotal_inr"] == subtotal
        assert abs(charges["burn_inr"] - burn) < 0.01
        assert abs(charges["total_amount_inr"] - total) < 0.01
        
        print(f"✅ Cash user math verified: Subtotal={subtotal}, Burn={burn}, Total={total}")
    
    def test_burn_formula_prc_user(self):
        """Verify: Subtotal = Amount + ₹10 + 20%, Burn = 5% × Subtotal"""
        url = f"{BASE_URL}/api/redeem/calculate-charges"
        params = {"amount": 1000, "user_id": PRC_USER_UID}
        
        response = requests.get(url, params=params)
        data = response.json()
        charges = data.get("charges", {})
        
        # Manual calculation
        amount = 1000
        processing_fee = 10
        admin_charge = amount * 0.20  # 200
        subtotal = amount + processing_fee + admin_charge  # 1210
        burn = subtotal * 0.05  # 60.50
        total = subtotal + burn  # 1270.50
        
        assert charges["amount_inr"] == amount
        assert charges["platform_fee_inr"] == processing_fee
        assert charges["admin_charge_inr"] == admin_charge
        assert charges["subtotal_inr"] == subtotal
        assert abs(charges["burn_inr"] - burn) < 0.01
        assert abs(charges["total_amount_inr"] - total) < 0.01
        
        print(f"✅ PRC user math verified: Subtotal={subtotal}, Burn={burn}, Total={total}")


class TestUserSubscriptionPaymentType:
    """Verify user subscription_payment_type is correctly set"""
    
    def test_verify_prc_user_has_prc_payment_type(self):
        """Verify PRC user (6c96a6cc) has subscription_payment_type=prc"""
        url = f"{BASE_URL}/api/users/{PRC_USER_UID}"
        
        response = requests.get(url)
        
        # If user endpoint requires auth, try the burn rate API instead
        if response.status_code != 200:
            # Use burn rate API to verify
            url = f"{BASE_URL}/api/redeem/calculate-charges"
            params = {"amount": 100, "user_id": PRC_USER_UID}
            response = requests.get(url, params=params)
            
            assert response.status_code == 200
            data = response.json()
            charges = data.get("charges", {})
            
            # If burn_payment_type is "prc", user has subscription_payment_type=prc
            assert charges["burn_payment_type"] == "prc", f"Expected PRC user to have burn_payment_type=prc, got {charges['burn_payment_type']}"
            print(f"✅ PRC user verified via burn rate API: payment_type={charges['burn_payment_type']}")
        else:
            data = response.json()
            payment_type = data.get("subscription_payment_type", "unknown")
            assert payment_type == "prc", f"Expected subscription_payment_type=prc, got {payment_type}"
            print(f"✅ PRC user subscription_payment_type: {payment_type}")
    
    def test_verify_cash_user_has_cash_payment_type(self):
        """Verify Cash user (76b75808) has subscription_payment_type=cash"""
        url = f"{BASE_URL}/api/redeem/calculate-charges"
        params = {"amount": 100, "user_id": CASH_USER_UID}
        
        response = requests.get(url, params=params)
        assert response.status_code == 200
        
        data = response.json()
        charges = data.get("charges", {})
        
        assert charges["burn_payment_type"] == "cash", f"Expected cash user to have burn_payment_type=cash, got {charges['burn_payment_type']}"
        print(f"✅ Cash user verified: payment_type={charges['burn_payment_type']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
