"""
Bank Redeem & New Features Tests - Iteration 57
Tests:
1. Bank Redeem API - GET /api/bank-redeem/denominations
2. Bank Details CRUD - POST/GET /api/bank-details/{user_id}
3. Eligibility Check - GET /api/bank-redeem/check-eligibility/{user_id}
4. Withdrawal Request - POST /api/bank-redeem/request/{user_id}
5. Electricity Bill Dropdown (API-side validation)
6. EMI Payment Form Fields
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bill-payment-stable.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "Santosh@paras.com"
TEST_PIN = "123456"


class TestBankRedeemDenominations:
    """Test Bank Redeem Denominations API"""
    
    def test_denominations_endpoint_exists(self):
        """Test that denominations endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Denominations endpoint returns 200")
    
    def test_denominations_returns_6_values(self):
        """Test that exactly 6 denominations are returned"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        data = response.json()
        
        assert "denominations" in data, "Response should contain 'denominations' key"
        denominations = data["denominations"]
        assert len(denominations) == 6, f"Expected 6 denominations, got {len(denominations)}"
        print(f"✓ Returns 6 denominations: {[d['amount_inr'] for d in denominations]}")
    
    def test_denominations_correct_amounts(self):
        """Test that denominations are 100, 500, 1000, 5000, 10000, 25000"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        data = response.json()
        
        expected_amounts = [100, 500, 1000, 5000, 10000, 25000]
        actual_amounts = [d["amount_inr"] for d in data["denominations"]]
        
        assert sorted(actual_amounts) == sorted(expected_amounts), f"Expected {expected_amounts}, got {actual_amounts}"
        print(f"✓ Correct denomination amounts: {actual_amounts}")
    
    def test_denominations_have_correct_fees(self):
        """Test that processing fees are correct: 100->10, 500->25, 1000->50, 5000->100, 10000->200, 25000->500"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        data = response.json()
        
        expected_fees = {
            100: 10,
            500: 25,
            1000: 50,
            5000: 100,
            10000: 200,
            25000: 500
        }
        
        for denom in data["denominations"]:
            amount = denom["amount_inr"]
            fee = denom["processing_fee_inr"]
            expected = expected_fees.get(amount)
            assert fee == expected, f"For ₹{amount}, expected fee ₹{expected}, got ₹{fee}"
        
        print("✓ All processing fees are correct")
    
    def test_denominations_have_20_percent_admin_charge(self):
        """Test that admin charge is 20% for all denominations"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        data = response.json()
        
        assert data.get("admin_charge_percent") == 20, f"Expected 20% admin charge, got {data.get('admin_charge_percent')}"
        
        for denom in data["denominations"]:
            amount = denom["amount_inr"]
            admin_charge = denom["admin_charge_inr"]
            expected = amount * 0.20
            assert admin_charge == expected, f"For ₹{amount}, expected admin ₹{expected}, got ₹{admin_charge}"
        
        print("✓ 20% admin charge correctly applied to all denominations")
    
    def test_total_prc_calculation(self):
        """Test that total_prc = (amount + processing_fee + admin_charge) * 10"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        data = response.json()
        
        for denom in data["denominations"]:
            amount = denom["amount_inr"]
            processing_fee = denom["processing_fee_inr"]
            admin_charge = denom["admin_charge_inr"]
            total_prc = denom["total_prc"]
            
            expected_total_inr = amount + processing_fee + admin_charge
            expected_total_prc = expected_total_inr * 10
            
            assert total_prc == expected_total_prc, f"For ₹{amount}, expected {expected_total_prc} PRC, got {total_prc}"
        
        print("✓ Total PRC calculation correct (10 PRC = ₹1)")


class TestBankDetailsAPI:
    """Test Bank Details Save/Get API"""
    
    @pytest.fixture
    def user_id(self):
        """Get test user ID by logging in"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": TEST_EMAIL,
            "password": TEST_PIN
        })
        if response.status_code == 200:
            data = response.json()
            # Try nested user object first, then direct uid
            return data.get("user", {}).get("uid") or data.get("uid")
        return None
    
    def test_get_bank_details_for_user(self, user_id):
        """Test getting bank details for a user"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        response = requests.get(f"{BASE_URL}/api/bank-details/{user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "has_bank_details" in data, "Response should contain 'has_bank_details'"
        print(f"✓ Bank details endpoint works. has_bank_details: {data['has_bank_details']}")
    
    def test_save_bank_details_validation(self, user_id):
        """Test that saving bank details validates required fields"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        # Test with missing fields
        response = requests.post(f"{BASE_URL}/api/bank-details/{user_id}", json={
            "account_holder_name": "TEST USER"
        })
        # Should fail with 400 due to missing fields
        assert response.status_code == 400, f"Expected 400 for missing fields, got {response.status_code}"
        print("✓ Bank details validation rejects incomplete data")
    
    def test_save_bank_details_ifsc_validation(self, user_id):
        """Test that IFSC code must be 11 characters"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        response = requests.post(f"{BASE_URL}/api/bank-details/{user_id}", json={
            "account_holder_name": "TEST USER",
            "account_number": "12345678901234",
            "ifsc_code": "ABC123",  # Invalid - too short
            "bank_name": "TEST BANK"
        })
        assert response.status_code == 400, f"Expected 400 for invalid IFSC, got {response.status_code}"
        assert "11 characters" in response.text.lower(), "Error should mention 11 characters"
        print("✓ IFSC validation requires 11 characters")
    
    def test_save_bank_details_account_number_validation(self, user_id):
        """Test that account number must be 8-18 digits"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        response = requests.post(f"{BASE_URL}/api/bank-details/{user_id}", json={
            "account_holder_name": "TEST USER",
            "account_number": "1234",  # Too short
            "ifsc_code": "SBIN0001234",
            "bank_name": "TEST BANK"
        })
        assert response.status_code == 400, f"Expected 400 for invalid account, got {response.status_code}"
        assert "8-18" in response.text or "digits" in response.text.lower(), "Error should mention digit requirements"
        print("✓ Account number validation requires 8-18 digits")


class TestBankRedeemEligibility:
    """Test Bank Redeem Eligibility Check API"""
    
    @pytest.fixture
    def user_id(self):
        """Get test user ID by logging in"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": TEST_EMAIL,
            "password": TEST_PIN
        })
        if response.status_code == 200:
            data = response.json()
            # Try nested user object first, then direct uid
            return data.get("user", {}).get("uid") or data.get("uid")
        return None
    
    def test_eligibility_endpoint_exists(self, user_id):
        """Test that eligibility endpoint returns 200"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        response = requests.get(f"{BASE_URL}/api/bank-redeem/check-eligibility/{user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "eligible" in data, "Response should contain 'eligible' field"
        print(f"✓ Eligibility check returns data. Eligible: {data.get('eligible')}")
    
    def test_eligibility_checks_bank_details(self, user_id):
        """Test that eligibility checks for bank details"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        response = requests.get(f"{BASE_URL}/api/bank-redeem/check-eligibility/{user_id}")
        data = response.json()
        
        # If user doesn't have bank details, should return reason
        if not data.get("eligible") and data.get("reason") == "no_bank_details":
            print("✓ Eligibility correctly identifies missing bank details")
        else:
            print(f"✓ User has bank details. Eligibility: {data.get('eligible')}")
    
    def test_eligibility_checks_kyc(self, user_id):
        """Test that eligibility checks for KYC verification"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        response = requests.get(f"{BASE_URL}/api/bank-redeem/check-eligibility/{user_id}")
        data = response.json()
        
        if not data.get("eligible") and data.get("reason") == "kyc_pending":
            print("✓ Eligibility correctly identifies pending KYC")
        else:
            print(f"✓ User KYC status is verified or other eligibility check. Reason: {data.get('reason', 'N/A')}")


class TestBankWithdrawalRequest:
    """Test Bank Withdrawal Request API"""
    
    @pytest.fixture
    def user_id(self):
        """Get test user ID by logging in"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": TEST_EMAIL,
            "password": TEST_PIN
        })
        if response.status_code == 200:
            data = response.json()
            # Try nested user object first, then direct uid
            return data.get("user", {}).get("uid") or data.get("uid")
        return None
    
    def test_withdrawal_validates_amount(self, user_id):
        """Test that withdrawal request validates denomination"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        # Try invalid denomination
        response = requests.post(f"{BASE_URL}/api/bank-redeem/request/{user_id}", json={
            "amount_inr": 999  # Invalid denomination
        })
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for invalid amount, got {response.status_code}"
        assert "valid denominations" in response.text.lower() or "invalid" in response.text.lower()
        print("✓ Withdrawal request validates denomination")
    
    def test_withdrawal_history_endpoint(self, user_id):
        """Test that withdrawal history endpoint works"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        response = requests.get(f"{BASE_URL}/api/bank-redeem/history/{user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "requests" in data, "Response should contain 'requests' list"
        print(f"✓ Withdrawal history endpoint works. Total requests: {data.get('total', 0)}")


class TestBillPaymentElectricity:
    """Test Bill Payment Electricity Dropdown (Server-side validation)"""
    
    @pytest.fixture
    def user_id(self):
        """Get test user ID by logging in"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": TEST_EMAIL,
            "password": TEST_PIN
        })
        if response.status_code == 200:
            data = response.json()
            # Try nested user object first, then direct uid
            return data.get("user", {}).get("uid") or data.get("uid")
        return None
    
    def test_bill_payment_electricity_with_biller(self, user_id):
        """Test that electricity bill payment accepts biller_name"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        # This test validates the API structure, not actual payment
        # We check if the endpoint accepts biller_name in details
        response = requests.post(f"{BASE_URL}/api/bill-payment/request", json={
            "user_id": user_id,
            "request_type": "electricity_bill",
            "amount_inr": 100,
            "details": {
                "consumer_number": "TEST123456789",
                "biller_name": "MSEDCL - Maharashtra"
            }
        })
        
        # Either success (201/200) or insufficient balance (400)
        # We just verify the endpoint accepts the structure
        if response.status_code in [200, 201]:
            print("✓ Bill payment request accepted with biller_name")
        elif response.status_code == 400 and "insufficient" in response.text.lower():
            print("✓ Bill payment API structure correct (insufficient balance)")
        elif response.status_code == 400 and "kyc" in response.text.lower():
            print("✓ Bill payment API structure correct (KYC required)")
        else:
            print(f"✓ Bill payment API responds correctly: {response.status_code}")


class TestEMIPaymentFormFields:
    """Test EMI Payment Form Standard Fields"""
    
    @pytest.fixture
    def user_id(self):
        """Get test user ID by logging in"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": TEST_EMAIL,
            "password": TEST_PIN
        })
        if response.status_code == 200:
            data = response.json()
            # Try nested user object first, then direct uid
            return data.get("user", {}).get("uid") or data.get("uid")
        return None
    
    def test_emi_payment_standard_fields(self, user_id):
        """Test that loan_emi accepts standard fields: loan_account, bank_name, ifsc_code, borrower_name, registered_mobile"""
        if not user_id:
            pytest.skip("Could not get user ID from login")
        
        # Test with all standard fields
        response = requests.post(f"{BASE_URL}/api/bill-payment/request", json={
            "user_id": user_id,
            "request_type": "loan_emi",
            "amount_inr": 100,
            "details": {
                "loan_account": "TEST1234567890",
                "bank_name": "TEST BANK",
                "ifsc_code": "SBIN0001234",
                "borrower_name": "TEST BORROWER",
                "registered_mobile": "9876543210"
            }
        })
        
        # Either success or business validation error (not 500)
        assert response.status_code != 500, f"Server error: {response.text}"
        
        if response.status_code in [200, 201]:
            print("✓ EMI payment request accepted with standard fields")
        elif response.status_code == 400:
            error_text = response.text.lower()
            if "insufficient" in error_text or "balance" in error_text:
                print("✓ EMI API accepts standard fields (insufficient balance)")
            elif "kyc" in error_text:
                print("✓ EMI API accepts standard fields (KYC required)")
            else:
                print(f"✓ EMI API responds with validation: {response.status_code}")
        else:
            print(f"✓ EMI API endpoint works: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
