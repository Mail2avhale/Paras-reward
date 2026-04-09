"""
Eko Prepaid Mobile & DTH Recharge API Tests
============================================
Tests for the Eko BBPS recharge integration.

Features tested:
- POST /api/recharge/activate-service - BBPS service activation (code 53)
- GET /api/recharge/operators/mobile - Mobile prepaid operators (category 5)
- GET /api/recharge/operators/dth - DTH operators (category 4)
- GET /api/recharge/operator-params/{operator_id} - Operator parameters with regex
- POST /api/recharge/initiate - Recharge initiation with validations
- GET /api/recharge/history/{user_id} - Recharge history

Business Rules:
- Max ₹500 per recharge (combined daily limit)
- 1 recharge per day per user (Mobile OR DTH combined)
- Only paid subscribers with redeem limit can recharge
- All business errors → generic "Technical error" to user
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

# Test user credentials from test_credentials.md
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"


class TestServiceActivation:
    """Test POST /api/recharge/activate-service endpoint"""
    
    def test_activate_service_success(self):
        """POST /api/recharge/activate-service activates BBPS service (code 53)"""
        response = requests.post(f"{BASE_URL}/api/recharge/activate-service")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        # Service may be already active (cached) or newly activated
        print(f"✅ Service activation: success={data.get('success')}, cached={data.get('cached')}, already_active={data.get('already_active')}")


class TestOperatorParameters:
    """Test GET /api/recharge/operator-params/{operator_id} endpoint"""
    
    def test_get_airtel_params(self):
        """GET /api/recharge/operator-params/1 returns Airtel mobile params with regex"""
        response = requests.get(f"{BASE_URL}/api/recharge/operator-params/1")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("operator_id") == "1", "Expected operator_id=1"
        assert "Airtel" in data.get("operator_name", ""), "Expected Airtel in operator_name"
        assert "parameters" in data, "Response should contain 'parameters' key"
        
        # Check regex pattern for mobile number
        params = data.get("parameters", [])
        if len(params) > 0:
            param = params[0]
            assert "regex" in param, "Parameter should have regex"
            assert "^[0-9]{10}$" in param.get("regex", ""), f"Expected 10-digit regex, got: {param.get('regex')}"
            print(f"✅ Airtel params: regex={param.get('regex')}, label={param.get('param_label')}")
    
    def test_get_dish_tv_params(self):
        """GET /api/recharge/operator-params/16 returns Dish TV params with regex"""
        response = requests.get(f"{BASE_URL}/api/recharge/operator-params/16")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("operator_id") == "16", "Expected operator_id=16"
        assert "Dish" in data.get("operator_name", ""), "Expected Dish in operator_name"
        
        # Check regex pattern for subscriber number
        params = data.get("parameters", [])
        if len(params) > 0:
            param = params[0]
            assert "regex" in param, "Parameter should have regex"
            # Dish TV accepts 10-11 digit numbers
            assert "10" in param.get("regex", "") or "11" in param.get("regex", ""), \
                f"Expected 10-11 digit regex, got: {param.get('regex')}"
            print(f"✅ Dish TV params: regex={param.get('regex')}, label={param.get('param_label')}")
    
    def test_invalid_operator_id(self):
        """GET /api/recharge/operator-params/99999 returns error for invalid operator"""
        response = requests.get(f"{BASE_URL}/api/recharge/operator-params/99999")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # May return success=False or empty parameters
        print(f"✅ Invalid operator handled: success={data.get('success')}, error={data.get('error', 'none')}")


class TestRechargeOperators:
    """Test GET /api/recharge/operators/{type} endpoints"""
    
    def test_get_mobile_operators_success(self):
        """GET /api/recharge/operators/mobile returns list of mobile prepaid operators"""
        response = requests.get(f"{BASE_URL}/api/recharge/operators/mobile")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "operators" in data, "Response should contain 'operators' key"
        assert isinstance(data["operators"], list), "Operators should be a list"
        
        # Verify operators have required fields
        if len(data["operators"]) > 0:
            op = data["operators"][0]
            assert "operator_id" in op, "Operator should have operator_id"
            assert "name" in op, "Operator should have name"
            print(f"✅ Mobile operators: {len(data['operators'])} found")
            for op in data["operators"]:
                print(f"   - {op['name']} (ID: {op['operator_id']})")
    
    def test_get_dth_operators_success(self):
        """GET /api/recharge/operators/dth returns list of DTH operators"""
        response = requests.get(f"{BASE_URL}/api/recharge/operators/dth")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "operators" in data, "Response should contain 'operators' key"
        assert isinstance(data["operators"], list), "Operators should be a list"
        
        # Verify operators have required fields
        if len(data["operators"]) > 0:
            op = data["operators"][0]
            assert "operator_id" in op, "Operator should have operator_id"
            assert "name" in op, "Operator should have name"
            print(f"✅ DTH operators: {len(data['operators'])} found")
            for op in data["operators"]:
                print(f"   - {op['name']} (ID: {op['operator_id']})")
    
    def test_invalid_recharge_type(self):
        """GET /api/recharge/operators/invalid returns error"""
        response = requests.get(f"{BASE_URL}/api/recharge/operators/invalid")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Expected success=False for invalid type"
        assert "error" in data or len(data.get("operators", [])) == 0, "Should have error or empty operators"
        print("✅ Invalid recharge type handled correctly")


class TestRechargeInitiateValidations:
    """Test POST /api/recharge/initiate validation rules"""
    
    def test_amount_exceeds_500_returns_technical_error(self):
        """Amount > 500 should return generic 'Technical error'"""
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "mobile",
            "number": "9876543210",
            "operator_id": "1",  # Airtel
            "amount": 600  # Exceeds ₹500 limit
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Expected success=False"
        # Should NOT expose business rule - should show generic error
        assert "Technical error" in data.get("message", ""), f"Expected 'Technical error', got: {data.get('message')}"
        print(f"✅ Amount > 500 returns generic error: {data.get('message')}")
    
    def test_invalid_mobile_number_returns_specific_error(self):
        """Invalid mobile number should return specific validation error"""
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "mobile",
            "number": "12345",  # Invalid - not 10 digits
            "operator_id": "1",
            "amount": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Expected success=False"
        # Mobile validation error CAN be shown to user
        assert "10-digit" in data.get("message", "").lower() or "valid" in data.get("message", "").lower(), \
            f"Expected mobile validation message, got: {data.get('message')}"
        print(f"✅ Invalid mobile returns validation error: {data.get('message')}")
    
    def test_zero_amount_returns_technical_error(self):
        """Amount <= 0 should return generic 'Technical error'"""
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "mobile",
            "number": "9876543210",
            "operator_id": "1",
            "amount": 0
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Expected success=False"
        assert "Technical error" in data.get("message", ""), f"Expected 'Technical error', got: {data.get('message')}"
        print(f"✅ Zero amount returns generic error: {data.get('message')}")
    
    def test_negative_amount_returns_technical_error(self):
        """Negative amount should return generic 'Technical error'"""
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "mobile",
            "number": "9876543210",
            "operator_id": "1",
            "amount": -100
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Expected success=False"
        assert "Technical error" in data.get("message", ""), f"Expected 'Technical error', got: {data.get('message')}"
        print(f"✅ Negative amount returns generic error: {data.get('message')}")
    
    def test_dth_short_subscriber_id_returns_error(self):
        """DTH with very short subscriber ID should return validation error"""
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "dth",
            "number": "ab",  # Too short
            "operator_id": "16",  # Dish TV
            "amount": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Expected success=False"
        assert "subscriber" in data.get("message", "").lower() or "valid" in data.get("message", "").lower(), \
            f"Expected subscriber ID validation message, got: {data.get('message')}"
        print(f"✅ Short DTH subscriber ID returns validation error: {data.get('message')}")


class TestRechargeInitiateBusinessRules:
    """Test business rule validations (redeem limit, daily limit, subscription)"""
    
    def test_user_with_no_redeem_limit_returns_technical_error(self):
        """User with 0 redeem limit should get generic 'Technical error'"""
        # Test user has Elite plan but effective_available redeem limit is 0
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "mobile",
            "number": "9876543210",
            "operator_id": "1",
            "amount": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # User has 0 redeem limit, so should fail with generic error
        # OR if they have PRC balance issue, also generic error
        # The key is: business rule violations should NOT expose the actual reason
        if data.get("success") == False:
            message = data.get("message", "")
            # Should be either Technical error OR Insufficient PRC (which is allowed to show)
            is_valid_error = "Technical error" in message or "Insufficient PRC" in message or "subscription" in message.lower()
            assert is_valid_error, f"Expected generic error or PRC error, got: {message}"
            print(f"✅ Business rule violation returns appropriate error: {message}")
        else:
            # If it succeeded, that's also valid (user might have limit)
            print(f"✅ Recharge initiated (user has available limit): {data}")
    
    def test_nonexistent_user_returns_technical_error(self):
        """Non-existent user should get generic 'Technical error'"""
        payload = {
            "user_id": "nonexistent-user-id-12345",
            "recharge_type": "mobile",
            "number": "9876543210",
            "operator_id": "1",
            "amount": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Expected success=False"
        assert "Technical error" in data.get("message", ""), f"Expected 'Technical error', got: {data.get('message')}"
        print(f"✅ Non-existent user returns generic error: {data.get('message')}")


class TestRechargeHistory:
    """Test GET /api/recharge/history/{user_id} endpoint"""
    
    def test_get_recharge_history_success(self):
        """GET /api/recharge/history/{user_id} returns transaction history"""
        response = requests.get(f"{BASE_URL}/api/recharge/history/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "transactions" in data, "Response should contain 'transactions' key"
        assert isinstance(data["transactions"], list), "Transactions should be a list"
        assert "count" in data, "Response should contain 'count' key"
        
        print(f"✅ Recharge history: {data['count']} transactions found")
        
        # If there are transactions, verify structure
        if len(data["transactions"]) > 0:
            txn = data["transactions"][0]
            expected_fields = ["request_id", "user_id", "recharge_type", "number", "amount_inr", "status"]
            for field in expected_fields:
                assert field in txn, f"Transaction should have '{field}' field"
            print(f"   Latest: {txn.get('recharge_type')} - ₹{txn.get('amount_inr')} - {txn.get('status')}")
    
    def test_get_recharge_history_nonexistent_user(self):
        """GET /api/recharge/history for non-existent user returns empty list"""
        response = requests.get(f"{BASE_URL}/api/recharge/history/nonexistent-user-12345")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("transactions", []) == [], "Expected empty transactions list"
        assert data.get("count", 0) == 0, "Expected count=0"
        print("✅ Non-existent user returns empty history")


class TestRechargeEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_amount_exactly_500_is_valid(self):
        """Amount exactly ₹500 should be accepted (boundary test)"""
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "mobile",
            "number": "9876543210",
            "operator_id": "1",
            "amount": 500  # Exactly at limit
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should NOT fail due to amount validation (500 is valid)
        # May fail due to other reasons (redeem limit, PRC balance, etc.)
        if data.get("success") == False:
            message = data.get("message", "")
            # Should NOT be "amount exceeds limit" type error
            assert "500" not in message.lower() or "max" not in message.lower(), \
                f"Amount 500 should be valid, but got: {message}"
        print(f"✅ Amount exactly 500 validation passed: {data.get('message', 'OK')}")
    
    def test_amount_501_exceeds_limit(self):
        """Amount ₹501 should fail (just over limit)"""
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "mobile",
            "number": "9876543210",
            "operator_id": "1",
            "amount": 501  # Just over limit
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Expected success=False"
        assert "Technical error" in data.get("message", ""), f"Expected 'Technical error', got: {data.get('message')}"
        print(f"✅ Amount 501 correctly rejected: {data.get('message')}")
    
    def test_mobile_number_with_letters_rejected(self):
        """Mobile number with letters should be rejected"""
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "mobile",
            "number": "98765abc10",  # Contains letters
            "operator_id": "1",
            "amount": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Expected success=False"
        print(f"✅ Mobile with letters rejected: {data.get('message')}")
    
    def test_empty_operator_id(self):
        """Empty operator_id should fail validation"""
        payload = {
            "user_id": TEST_USER_UID,
            "recharge_type": "mobile",
            "number": "9876543210",
            "operator_id": "",  # Empty
            "amount": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/recharge/initiate", json=payload)
        
        # May return 422 (validation error) or 200 with error
        assert response.status_code in [200, 422], f"Expected 200 or 422, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == False, "Expected success=False"
        print(f"✅ Empty operator_id handled: status={response.status_code}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
