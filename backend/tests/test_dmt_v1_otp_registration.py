"""
DMT V1 API Tests - User Registration and OTP Verification
==========================================================
Tests for Eko DMT V1 API endpoints:
1. Health Check - GET /api/eko/dmt/health
2. Customer Search (existing) - POST /api/eko/dmt/customer/search
3. Customer Search (new) - POST /api/eko/dmt/customer/search
4. Customer Registration - POST /api/eko/dmt/customer/register
5. Resend OTP - POST /api/eko/dmt/customer/resend-otp
6. Verify OTP - POST /api/eko/dmt/customer/verify-otp

Key Findings from Agent Context:
- V1 registration creates customers with state=2 (immediately verified) OR state=1 (OTP pending)
- V1 Resend OTP works correctly
- OTP verification via V1 re-registration with OTP parameter
- V3 Fino DMT endpoints NOT available for this Eko account
"""

import pytest
import requests
import os
import time
import random

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Known test data
EXISTING_CUSTOMER_MOBILE = "9970100782"
EXISTING_USER_ID = "73b95483-f36b-4637-a5ee-d447300c6835"

def generate_test_mobile():
    """Generate random 10-digit mobile starting with 555 (test prefix)"""
    return f"555{random.randint(1000000, 9999999)}"


class TestDMTHealthCheckAPI:
    """Test 1: DMT Health Check API - GET /api/eko/dmt/health"""

    def test_health_endpoint_returns_200(self):
        """Health endpoint should return HTTP 200"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
    def test_health_returns_running_status(self):
        """Health endpoint should indicate service is running"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        data = response.json()
        assert data["status"] == "DMT SERVICE RUNNING", f"Got: {data}"
        
    def test_health_returns_config_valid(self):
        """Health endpoint should indicate config is valid"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        data = response.json()
        assert data["config_valid"] == True, f"Config not valid: {data}"
        
    def test_health_contains_rate_info(self):
        """Health endpoint should show PRC conversion rate"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        data = response.json()
        assert "prc_rate" in data, "Missing prc_rate"
        assert "min_redeem" in data, "Missing min_redeem"
        assert "max_daily" in data, "Missing max_daily"
        # Verify expected values
        assert data["prc_rate"] == "100 PRC = ₹1"
        assert data["min_redeem"] == "₹100"
        assert data["max_daily"] == "₹5000"

    def test_health_contains_version(self):
        """Health endpoint should show API version"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        data = response.json()
        assert "version" in data, "Missing version"


class TestDMTCustomerSearchExisting:
    """Test 2: Customer Search API - Existing Customer"""

    def test_search_existing_customer_returns_200(self):
        """Search for existing customer should return HTTP 200"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": EXISTING_CUSTOMER_MOBILE, "user_id": EXISTING_USER_ID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_search_existing_customer_returns_success(self):
        """Search for existing customer should return success=true"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": EXISTING_CUSTOMER_MOBILE, "user_id": EXISTING_USER_ID}
        )
        data = response.json()
        assert data["success"] == True, f"Expected success=true, got: {data}"

    def test_search_existing_customer_exists_true(self):
        """Search for existing customer should return customer_exists=true"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": EXISTING_CUSTOMER_MOBILE, "user_id": EXISTING_USER_ID}
        )
        data = response.json()
        assert data["data"]["customer_exists"] == True, f"Expected customer_exists=true, got: {data}"

    def test_search_existing_customer_returns_name(self):
        """Search for existing customer should return customer name"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": EXISTING_CUSTOMER_MOBILE, "user_id": EXISTING_USER_ID}
        )
        data = response.json()
        assert "name" in data["data"], f"Missing name in response: {data}"
        assert data["data"]["name"] is not None, "Name should not be null"

    def test_search_existing_customer_returns_limits(self):
        """Search for existing customer should return transaction limits"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": EXISTING_CUSTOMER_MOBILE, "user_id": EXISTING_USER_ID}
        )
        data = response.json()
        customer = data["data"]
        assert "available_limit" in customer, "Missing available_limit"
        assert "total_limit" in customer, "Missing total_limit"

    def test_search_existing_customer_returns_state(self):
        """Search for existing customer should return state info"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": EXISTING_CUSTOMER_MOBILE, "user_id": EXISTING_USER_ID}
        )
        data = response.json()
        customer = data["data"]
        assert "state" in customer, "Missing state"
        assert "kyc_status" in customer, "Missing kyc_status"


class TestDMTCustomerSearchNew:
    """Test 3: Customer Search API - New Customer"""

    def test_search_new_customer_returns_200(self):
        """Search for new customer should return HTTP 200 (not 404)"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": new_mobile, "user_id": "test_user_search"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_search_new_customer_returns_success(self):
        """Search for new customer should return success=true"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": new_mobile, "user_id": "test_user_search"}
        )
        data = response.json()
        assert data["success"] == True, f"Expected success=true, got: {data}"

    def test_search_new_customer_exists_false(self):
        """Search for new customer should return customer_exists=false"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": new_mobile, "user_id": "test_user_search"}
        )
        data = response.json()
        assert data["data"]["customer_exists"] == False, f"Expected customer_exists=false, got: {data}"

    def test_search_new_customer_registration_message(self):
        """Search for new customer should indicate registration is required"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": new_mobile, "user_id": "test_user_search"}
        )
        data = response.json()
        # Should indicate registration is needed
        message = data.get("message", "").lower() + data["data"].get("message", "").lower()
        assert "regist" in message or "not found" in message, f"Missing registration message: {data}"

    def test_search_validates_mobile_length(self):
        """Search should reject mobile with wrong length"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": "12345", "user_id": "test_user"}
        )
        assert response.status_code == 422, f"Expected 422 for invalid mobile length, got {response.status_code}"

    def test_search_validates_mobile_numeric(self):
        """Search should reject non-numeric mobile"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": "abcdefghij", "user_id": "test_user"}
        )
        assert response.status_code == 422, f"Expected 422 for non-numeric mobile, got {response.status_code}"


class TestDMTCustomerRegistrationAPI:
    """Test 4: Customer Registration API - POST /api/eko/dmt/customer/register"""

    def test_register_new_customer_returns_200(self):
        """Registration should return HTTP 200"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Registration", "user_id": "test_register"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_register_new_customer_returns_success(self):
        """Registration should return success=true"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Success", "user_id": "test_register"}
        )
        data = response.json()
        assert data["success"] == True, f"Expected success=true, got: {data}"

    def test_register_returns_registered_true(self):
        """Registration should return registered=true"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Registered", "user_id": "test_register"}
        )
        data = response.json()
        assert data["data"]["registered"] == True, f"Expected registered=true, got: {data}"

    def test_register_returns_customer_id(self):
        """Registration should return customer_id"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Customer ID", "user_id": "test_register"}
        )
        data = response.json()
        assert "customer_id" in data["data"], f"Missing customer_id: {data}"
        assert data["data"]["customer_id"] == new_mobile, f"customer_id should match mobile"

    def test_register_returns_state_info(self):
        """Registration should return state (1=OTP pending or 2=verified)"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test State", "user_id": "test_register"}
        )
        data = response.json()
        assert "state" in data["data"], f"Missing state: {data}"
        # State 1 = OTP pending, State 2+ = verified
        state = str(data["data"]["state"])
        assert state in ["1", "2", "3", "4"], f"Unexpected state: {state}"

    def test_register_returns_otp_info(self):
        """Registration should indicate if OTP is needed"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test OTP Info", "user_id": "test_register"}
        )
        data = response.json()
        assert "otp_required" in data["data"], f"Missing otp_required: {data}"
        assert "otp_sent" in data["data"], f"Missing otp_sent: {data}"

    def test_register_validates_missing_name(self):
        """Registration should require name field"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "user_id": "test_register"}
        )
        assert response.status_code == 422, f"Expected 422 for missing name, got {response.status_code}"

    def test_register_validates_mobile_format(self):
        """Registration should validate mobile format"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": "123", "name": "Test", "user_id": "test_register"}
        )
        assert response.status_code == 422, f"Expected 422 for invalid mobile, got {response.status_code}"


class TestDMTResendOTPAPI:
    """Test 5: Resend OTP API - POST /api/eko/dmt/customer/resend-otp"""

    def test_resend_otp_for_pending_customer_returns_200(self):
        """Resend OTP for state=1 customer should return HTTP 200"""
        # First register a new customer (will be in state=1)
        new_mobile = generate_test_mobile()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Resend OTP", "user_id": "test_resend"}
        )
        
        # Now resend OTP
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={"mobile": new_mobile, "user_id": "test_resend"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_resend_otp_returns_success(self):
        """Resend OTP should return success=true"""
        new_mobile = generate_test_mobile()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Resend Success", "user_id": "test_resend"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={"mobile": new_mobile, "user_id": "test_resend"}
        )
        data = response.json()
        assert data["success"] == True, f"Expected success=true, got: {data}"

    def test_resend_otp_returns_otp_sent_true(self):
        """Resend OTP should return otp_sent=true"""
        new_mobile = generate_test_mobile()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test OTP Sent", "user_id": "test_resend"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={"mobile": new_mobile, "user_id": "test_resend"}
        )
        data = response.json()
        assert data["data"]["otp_sent"] == True, f"Expected otp_sent=true, got: {data}"

    def test_resend_otp_returns_mobile(self):
        """Resend OTP should echo back the mobile number"""
        new_mobile = generate_test_mobile()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Mobile Echo", "user_id": "test_resend"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={"mobile": new_mobile, "user_id": "test_resend"}
        )
        data = response.json()
        assert data["data"]["mobile"] == new_mobile, f"Mobile mismatch: {data}"

    def test_resend_otp_for_verified_customer_indicates_already_registered(self):
        """Resend OTP for already verified customer should indicate already registered"""
        # Use existing verified customer
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={"mobile": EXISTING_CUSTOMER_MOBILE, "user_id": EXISTING_USER_ID}
        )
        data = response.json()
        # Should indicate sender is already registered (no OTP needed)
        # Response could be success=false with "already registered" message
        assert response.status_code == 200, f"Should return 200, got {response.status_code}"
        message = data.get("message", "").lower()
        assert "already" in message or "registered" in message, f"Should indicate already registered: {data}"

    def test_resend_otp_validates_mobile_format(self):
        """Resend OTP should validate mobile format"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={"mobile": "invalid", "user_id": "test_resend"}
        )
        assert response.status_code == 422, f"Expected 422 for invalid mobile, got {response.status_code}"


class TestDMTVerifyOTPAPI:
    """Test 6: Verify OTP API - POST /api/eko/dmt/customer/verify-otp"""

    def test_verify_otp_endpoint_exists(self):
        """Verify OTP endpoint should exist and return 200"""
        new_mobile = generate_test_mobile()
        # Register first
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Verify", "user_id": "test_verify"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/verify-otp",
            json={"mobile": new_mobile, "user_id": "test_verify", "otp": "123456"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_verify_otp_with_invalid_otp_returns_failure(self):
        """Verify OTP with invalid OTP should return success=false"""
        new_mobile = generate_test_mobile()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Invalid OTP", "user_id": "test_verify"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/verify-otp",
            json={"mobile": new_mobile, "user_id": "test_verify", "otp": "999999"}
        )
        data = response.json()
        # Invalid OTP should fail - either success=false or verified=false
        assert data["success"] == False or data["data"].get("verified") == False, f"Invalid OTP should fail: {data}"

    def test_verify_otp_requires_otp_field(self):
        """Verify OTP should require OTP field"""
        new_mobile = generate_test_mobile()
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/verify-otp",
            json={"mobile": new_mobile, "user_id": "test_verify"}
            # Missing OTP
        )
        data = response.json()
        # Should either return 400/422 or success=false
        if response.status_code == 200:
            assert data["success"] == False, f"Missing OTP should fail: {data}"
        else:
            assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"

    def test_verify_otp_validates_mobile_format(self):
        """Verify OTP should validate mobile format"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/verify-otp",
            json={"mobile": "123", "user_id": "test_verify", "otp": "123456"}
        )
        assert response.status_code == 422, f"Expected 422 for invalid mobile, got {response.status_code}"

    def test_verify_otp_response_structure(self):
        """Verify OTP should return proper response structure"""
        new_mobile = generate_test_mobile()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Test Structure", "user_id": "test_verify"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/verify-otp",
            json={"mobile": new_mobile, "user_id": "test_verify", "otp": "123456"}
        )
        data = response.json()
        # Should have standard response fields
        assert "success" in data, f"Missing success field: {data}"
        assert "status" in data, f"Missing status field: {data}"
        assert "message" in data or "user_message" in data, f"Missing message: {data}"


class TestDMTCompleteFlow:
    """End-to-end flow tests for DMT registration and OTP"""

    def test_complete_new_user_registration_flow(self):
        """
        Complete flow:
        1. Search -> customer_exists=false
        2. Register -> success, state=1 (OTP pending)
        3. Resend OTP -> otp_sent=true
        4. Verify OTP (wrong OTP) -> failure
        """
        new_mobile = generate_test_mobile()
        user_id = f"test_flow_{int(time.time())}"
        
        # Step 1: Search - should not exist
        search_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": new_mobile, "user_id": user_id}
        )
        assert search_resp.status_code == 200, f"Search failed: {search_resp.text}"
        search_data = search_resp.json()
        assert search_data["success"] == True
        assert search_data["data"]["customer_exists"] == False
        
        # Step 2: Register
        register_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Flow Test User", "user_id": user_id}
        )
        assert register_resp.status_code == 200, f"Register failed: {register_resp.text}"
        register_data = register_resp.json()
        assert register_data["success"] == True
        assert register_data["data"]["registered"] == True
        
        # Step 3: Resend OTP
        otp_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={"mobile": new_mobile, "user_id": user_id}
        )
        assert otp_resp.status_code == 200, f"Resend OTP failed: {otp_resp.text}"
        otp_data = otp_resp.json()
        assert otp_data["success"] == True
        assert otp_data["data"]["otp_sent"] == True
        
        # Step 4: Verify with wrong OTP (should fail gracefully)
        verify_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/verify-otp",
            json={"mobile": new_mobile, "user_id": user_id, "otp": "000000"}
        )
        assert verify_resp.status_code == 200, f"Verify endpoint failed: {verify_resp.text}"
        verify_data = verify_resp.json()
        # Wrong OTP should fail but API should work
        assert verify_data["success"] == False, f"Wrong OTP should fail: {verify_data}"

    def test_existing_customer_search_flow(self):
        """
        Flow for existing customer:
        1. Search -> customer_exists=true
        2. Check response has proper details
        """
        search_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": EXISTING_CUSTOMER_MOBILE, "user_id": EXISTING_USER_ID}
        )
        assert search_resp.status_code == 200
        data = search_resp.json()
        
        assert data["success"] == True
        assert data["data"]["customer_exists"] == True
        assert data["data"]["mobile"] == EXISTING_CUSTOMER_MOBILE
        assert "name" in data["data"]
        assert "available_limit" in data["data"]
        assert "state" in data["data"]

    def test_api_response_times_are_acceptable(self):
        """All APIs should respond within 15 seconds"""
        new_mobile = generate_test_mobile()
        
        # Health check should be fast
        start = time.time()
        requests.get(f"{BASE_URL}/api/eko/dmt/health")
        health_time = time.time() - start
        assert health_time < 5, f"Health check too slow: {health_time}s"
        
        # Search should respond within 10s
        start = time.time()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": new_mobile, "user_id": "test_timing"}
        )
        search_time = time.time() - start
        assert search_time < 10, f"Search too slow: {search_time}s"
        
        # Register can take longer due to Eko call
        start = time.time()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={"mobile": new_mobile, "name": "Timing Test", "user_id": "test_timing"}
        )
        register_time = time.time() - start
        assert register_time < 15, f"Register too slow: {register_time}s"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
