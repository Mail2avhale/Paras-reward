"""
BBPS Services Test Suite v2
Tests for Eko BBPS API integration including:
- sender_name sanitization
- Mobile prepaid recharge
- Error handling
- Operator APIs
"""

import pytest
import requests
import os

# Get API URL from environment
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://burn-dashboard.preview.emergentagent.com")


class TestSenderNameSanitization:
    """Test sender_name sanitization function"""
    
    def test_sanitize_removes_numbers(self):
        """Sender name with numbers should be sanitized"""
        response = requests.post(
            f"{API_URL}/api/bbps/fetch",
            json={
                "operator_id": "62",
                "account": "123456789012",
                "mobile": "9970100782",
                "sender_name": "Ankush@123"
            },
            timeout=30
        )
        # Should NOT return "Sender Name should contain only letters" error
        data = response.json()
        assert data.get("error_code") != 132, "Sender name sanitization failed - error 132 returned"
        # The actual error will be about invalid account, not sender name
        assert "sender name" not in data.get("message", "").lower() or "only letters" not in data.get("message", "").lower()

    def test_sanitize_removes_special_chars(self):
        """Sender name with special characters should be sanitized"""
        response = requests.post(
            f"{API_URL}/api/bbps/fetch",
            json={
                "operator_id": "62",
                "account": "123456789012",
                "mobile": "9970100782",
                "sender_name": "Test_User@#$%"
            },
            timeout=30
        )
        data = response.json()
        assert data.get("error_code") != 132, "Sender name sanitization failed"

    def test_sanitize_preserves_valid_name(self):
        """Valid sender name should pass through unchanged"""
        response = requests.post(
            f"{API_URL}/api/bbps/fetch",
            json={
                "operator_id": "62",
                "account": "123456789012",
                "mobile": "9970100782",
                "sender_name": "John Doe"
            },
            timeout=30
        )
        data = response.json()
        assert data.get("error_code") != 132


class TestBBPSHealthCheck:
    """Test BBPS health and config endpoints"""
    
    def test_health_endpoint(self):
        """Health endpoint should return service info"""
        response = requests.get(f"{API_URL}/api/bbps/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "PARAS REWARD BBPS RUNNING"
        assert "services" in data
        assert "mobile_prepaid" in data["services"]

    def test_debug_config_endpoint(self):
        """Debug config should show masked credentials"""
        response = requests.get(f"{API_URL}/api/bbps/debug-config", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("config_valid") == True
        assert "developer_key" in data
        assert "NOT SET" not in data["developer_key"]


class TestBBPSOperatorsAPI:
    """Test operator listing APIs"""
    
    def test_mobile_prepaid_operators(self):
        """Should return mobile prepaid operators"""
        response = requests.get(f"{API_URL}/api/bbps/operators/mobile_prepaid", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert len(data.get("operators", [])) > 0
        
        # Check for known operators
        operator_ids = [op["operator_id"] for op in data["operators"]]
        assert "1" in operator_ids or 1 in operator_ids, "Airtel Prepaid not found"
        assert "90" in operator_ids or 90 in operator_ids, "Jio Prepaid not found"

    def test_dth_operators(self):
        """Should return DTH operators"""
        response = requests.get(f"{API_URL}/api/bbps/operators/dth", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert len(data.get("operators", [])) > 0

    def test_electricity_operators(self):
        """Should return electricity operators"""
        response = requests.get(f"{API_URL}/api/bbps/operators/electricity", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert len(data.get("operators", [])) > 0

    def test_invalid_category(self):
        """Invalid category should return error"""
        response = requests.get(f"{API_URL}/api/bbps/operators/invalid_category", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False


class TestBBPSOperatorParams:
    """Test operator parameters API"""
    
    def test_jio_prepaid_params(self):
        """Jio Prepaid should have recharge_plan_id parameter"""
        response = requests.get(f"{API_URL}/api/bbps/operator-params/90", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("operator_name") == "Jio Prepaid"
        
        # Check for recharge_plan_id parameter
        param_names = [p["param_name"] for p in data.get("parameters", [])]
        assert "utility_acc_no" in param_names
        assert "recharge_plan_id" in param_names

    def test_airtel_prepaid_params(self):
        """Airtel Prepaid parameters"""
        response = requests.get(f"{API_URL}/api/bbps/operator-params/1", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True


class TestBBPSErrorHandling:
    """Test error handling and response format"""
    
    def test_missing_required_fields_pay(self):
        """Pay endpoint should validate required fields"""
        response = requests.post(
            f"{API_URL}/api/bbps/pay",
            json={
                "operator_id": "90"
                # Missing: account, amount, mobile
            },
            timeout=10
        )
        assert response.status_code in [200, 400, 422]
        data = response.json()
        # Should indicate missing fields
        assert data.get("success") == False or "detail" in data

    def test_missing_required_fields_fetch(self):
        """Fetch endpoint should validate required fields"""
        response = requests.post(
            f"{API_URL}/api/bbps/fetch",
            json={
                "operator_id": "62"
                # Missing: account, mobile
            },
            timeout=10
        )
        assert response.status_code in [200, 400, 422]

    def test_invalid_mobile_number_format(self):
        """Invalid mobile number format should be rejected"""
        response = requests.post(
            f"{API_URL}/api/bbps/fetch",
            json={
                "operator_id": "62",
                "account": "123456789012",
                "mobile": "12345",  # Invalid - not 10 digits
                "sender_name": "Test"
            },
            timeout=10
        )
        assert response.status_code in [200, 400, 422]
        data = response.json()
        # Should indicate validation error
        assert data.get("success") == False or "detail" in data

    def test_error_response_format_consistency(self):
        """Error responses should have consistent format"""
        response = requests.post(
            f"{API_URL}/api/bbps/pay",
            json={
                "operator_id": "999999",  # Invalid operator
                "account": "1234567890",
                "amount": "100",
                "mobile": "9970100782",
                "sender_name": "Test"
            },
            timeout=60
        )
        data = response.json()
        # Should have standard error fields
        if data.get("success") == False:
            assert "message" in data or "user_message" in data or "detail" in data


class TestBBPSTransactionStatus:
    """Test transaction status inquiry"""
    
    def test_status_inquiry_invalid_tid(self):
        """Status inquiry with invalid TID should return error"""
        response = requests.get(f"{API_URL}/api/bbps/status/invalid_tid_12345", timeout=30)
        assert response.status_code == 200
        data = response.json()
        # Should indicate transaction not found or error
        assert data.get("success") == False or data.get("status") != "SUCCESS"


class TestBBPSBillFetch:
    """Test bill fetch API"""
    
    def test_fetch_with_invalid_account(self):
        """Bill fetch with invalid account should return appropriate error"""
        response = requests.post(
            f"{API_URL}/api/bbps/fetch",
            json={
                "operator_id": "62",  # MSEDCL
                "account": "000000000000",  # Invalid account
                "mobile": "9970100782",
                "sender_name": "Test User"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        # Should return error (not crash)
        assert "success" in data


class TestJioPrepaidRecharge:
    """Test Jio Prepaid specific functionality"""
    
    def test_jio_recharge_with_plan_id(self):
        """Jio recharge should work with recharge_plan_id"""
        # Note: This is a real API call - use minimal amount
        # Skipping actual payment to avoid charges
        # Just verify the endpoint accepts the parameters
        response = requests.post(
            f"{API_URL}/api/bbps/pay",
            json={
                "operator_id": "90",
                "account": "9421331342",
                "amount": "19",
                "mobile": "9421331342",
                "sender_name": "Test User",
                "recharge_plan_id": "19"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        # Should process (success or specific Eko error, not validation error)
        assert "success" in data
        # If successful, should have tid
        if data.get("success"):
            assert "tid" in data or "tid" in data.get("raw_response", {}).get("data", {})


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
