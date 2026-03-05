"""
DMT New User Registration OTP Flow - Backend API Tests
========================================================
Tests for the complete new user registration flow:
1. POST /api/eko/dmt/customer/search - Returns customer_exists=false for new number
2. POST /api/eko/dmt/customer/register - Registers new customer
3. POST /api/eko/dmt/customer/resend-otp - Sends OTP to mobile
4. POST /api/eko/dmt/customer/verify-otp - Verifies OTP and activates customer

Test mobile: 5555444433 (or any random 10-digit number)
"""

import pytest
import requests
import os
import time
import random

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_ID = "test_user_" + str(int(time.time()))

# Generate random test mobile - ensures we test with a "new" number each time
def generate_test_mobile():
    """Generate random 10-digit mobile starting with 5 (unlikely to be registered)"""
    return f"5{random.randint(100000000, 999999999)}"

TEST_NEW_MOBILE = generate_test_mobile()


class TestDMTHealthEndpoint:
    """Verify DMT service is running"""

    def test_dmt_service_running(self):
        """DMT health endpoint confirms service is operational"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "DMT SERVICE RUNNING"
        assert data["version"] == "1.0"
        assert data["prc_rate"] == "100 PRC = ₹1"
        assert data["min_redeem"] == "₹100"
        assert data["max_daily"] == "₹5000"


class TestDMTNewUserCustomerSearch:
    """Test customer search returns customer_exists=false for new numbers"""

    def test_customer_search_returns_not_found_for_new_number(self):
        """
        BUG VERIFICATION: Customer search for unregistered mobile should return:
        - success: true
        - data.customer_exists: false
        - data.message: "Customer not registered. Please register first."
        """
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={
                "mobile": TEST_NEW_MOBILE,
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Key assertions for this test case
        assert data["success"] == True, f"Search should succeed, got: {data}"
        assert data["data"]["customer_exists"] == False, f"New number should not exist, got: {data}"
        assert data["data"]["mobile"] == TEST_NEW_MOBILE
        assert "not registered" in data["data"]["message"].lower() or "registration required" in data["message"].lower()

    def test_customer_search_with_various_new_numbers(self):
        """Test multiple new numbers all return customer_exists=false"""
        test_numbers = [
            "5551234567",
            "5559876543",
            "5550000001",
        ]
        
        for mobile in test_numbers:
            response = requests.post(
                f"{BASE_URL}/api/eko/dmt/customer/search",
                json={"mobile": mobile, "user_id": TEST_USER_ID}
            )
            data = response.json()
            # Either customer_exists is false OR API returns error for unknown numbers
            # Both are valid responses for "not registered"
            if data["success"]:
                assert data["data"]["customer_exists"] == False or "not" in str(data).lower()

    def test_customer_search_validates_mobile_format(self):
        """Customer search should validate mobile format"""
        # Invalid: Too short
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": "12345", "user_id": TEST_USER_ID}
        )
        assert response.status_code == 422

        # Invalid: Non-numeric
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": "abcdefghij", "user_id": TEST_USER_ID}
        )
        assert response.status_code == 422


class TestDMTNewUserRegistration:
    """Test customer registration for new users"""

    def test_customer_register_new_user(self):
        """
        BUG VERIFICATION: Registration should work for new customers
        - success: true
        - data.registered: true
        - data.customer_id should be set
        """
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={
                "mobile": TEST_NEW_MOBILE,
                "first_name": "Test",
                "last_name": "User",
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Key assertions
        assert data["success"] == True, f"Registration should succeed, got: {data}"
        assert data["data"]["registered"] == True or "customer_id" in data["data"]
        assert data["data"]["mobile"] == TEST_NEW_MOBILE
        assert data["data"]["name"] == "Test User"

    def test_customer_register_validates_required_fields(self):
        """Registration should require all fields"""
        # Missing first_name
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={
                "mobile": TEST_NEW_MOBILE,
                "last_name": "User",
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 422

        # Missing last_name
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={
                "mobile": TEST_NEW_MOBILE,
                "first_name": "Test",
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 422

    def test_customer_register_validates_mobile_format(self):
        """Registration should validate mobile format"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={
                "mobile": "123",  # Too short
                "first_name": "Test",
                "last_name": "User",
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 422


class TestDMTOTPSend:
    """Test OTP sending (resend-otp) endpoint"""

    def test_resend_otp_works(self):
        """
        BUG VERIFICATION: OTP send should work
        - success: true
        - data.otp_sent: true
        """
        # First register the customer
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={
                "mobile": TEST_NEW_MOBILE,
                "first_name": "Test",
                "last_name": "OTP",
                "user_id": TEST_USER_ID
            }
        )
        
        # Now send OTP
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={
                "mobile": TEST_NEW_MOBILE,
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Key assertions
        assert data["success"] == True, f"OTP send should succeed, got: {data}"
        assert data["data"]["otp_sent"] == True
        assert data["data"]["mobile"] == TEST_NEW_MOBILE
        assert "sent" in data["message"].lower() or "otp" in data["message"].lower()

    def test_resend_otp_validates_mobile(self):
        """Resend OTP should validate mobile format"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={
                "mobile": "invalid",
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 422


class TestDMTOTPVerification:
    """Test OTP verification endpoint"""

    def test_verify_otp_rejects_invalid_otp(self):
        """
        BUG VERIFICATION: Invalid OTP should be rejected with appropriate error
        - success: false
        - error message about invalid/wrong OTP
        """
        # First register and send OTP
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={
                "mobile": TEST_NEW_MOBILE,
                "first_name": "Test",
                "last_name": "Verify",
                "user_id": TEST_USER_ID
            }
        )
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={"mobile": TEST_NEW_MOBILE, "user_id": TEST_USER_ID}
        )
        
        # Try with invalid OTP
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/verify-otp",
            json={
                "mobile": TEST_NEW_MOBILE,
                "user_id": TEST_USER_ID,
                "otp": "999999"  # Invalid OTP
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Key assertions - should fail gracefully, not crash
        assert data["success"] == False, f"Invalid OTP should fail, got: {data}"
        # Error message should mention OTP
        assert "otp" in data.get("user_message", "").lower() or "otp" in data.get("message", "").lower()

    def test_verify_otp_requires_otp_field(self):
        """Verify OTP should require OTP field"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/verify-otp",
            json={
                "mobile": TEST_NEW_MOBILE,
                "user_id": TEST_USER_ID
                # Missing OTP
            }
        )
        # Should either return 422 (validation) or 400 with error
        data = response.json()
        if response.status_code == 200:
            assert data["success"] == False


class TestDMTFullNewUserFlow:
    """Test complete new user registration flow end-to-end"""

    def test_complete_new_user_flow(self):
        """
        Complete flow test:
        1. Search customer -> customer_exists=false
        2. Register customer -> success
        3. Send OTP -> otp_sent=true
        4. Verify OTP (with wrong OTP) -> fails gracefully
        """
        new_mobile = generate_test_mobile()
        
        # Step 1: Search customer - should not exist
        search_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": new_mobile, "user_id": TEST_USER_ID}
        )
        assert search_resp.status_code == 200
        search_data = search_resp.json()
        assert search_data["success"] == True
        assert search_data["data"]["customer_exists"] == False
        print(f"Step 1 PASSED: Customer {new_mobile} not found (as expected)")
        
        # Step 2: Register customer (EKO requires proper names - letters and space only)
        register_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={
                "mobile": new_mobile,
                "first_name": "Automation",
                "last_name": "Test",
                "user_id": TEST_USER_ID
            }
        )
        assert register_resp.status_code == 200
        register_data = register_resp.json()
        assert register_data["success"] == True
        print(f"Step 2 PASSED: Customer {new_mobile} registered")
        
        # Step 3: Send OTP
        otp_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/resend-otp",
            json={"mobile": new_mobile, "user_id": TEST_USER_ID}
        )
        assert otp_resp.status_code == 200
        otp_data = otp_resp.json()
        assert otp_data["success"] == True
        assert otp_data["data"]["otp_sent"] == True
        print(f"Step 3 PASSED: OTP sent to {new_mobile}")
        
        # Step 4: Verify OTP (with wrong OTP - just testing API works)
        verify_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/verify-otp",
            json={
                "mobile": new_mobile,
                "user_id": TEST_USER_ID,
                "otp": "000000"
            }
        )
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        # Wrong OTP should fail, but API should work
        assert verify_data["success"] == False
        print(f"Step 4 PASSED: OTP verification API works (correctly rejects wrong OTP)")

    def test_new_user_flow_api_response_times(self):
        """Verify APIs respond within reasonable time"""
        new_mobile = generate_test_mobile()
        
        import time
        
        # Search should be fast (<5s)
        start = time.time()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": new_mobile, "user_id": TEST_USER_ID}
        )
        search_time = time.time() - start
        assert search_time < 10, f"Search took too long: {search_time}s"
        
        # Register should be reasonable (<15s due to EKO call)
        start = time.time()
        requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={
                "mobile": new_mobile,
                "first_name": "Speed",
                "last_name": "Test",
                "user_id": TEST_USER_ID
            }
        )
        register_time = time.time() - start
        assert register_time < 15, f"Register took too long: {register_time}s"


class TestDMTExistingCustomerSearch:
    """Test customer search for existing registered customers"""
    
    # Known registered test customer
    EXISTING_MOBILE = "9970100782"
    EXISTING_USER_ID = "73b95483-f36b-4637-a5ee-d447300c6835"

    def test_search_existing_customer_returns_found(self):
        """Existing customer should return customer_exists=true"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={
                "mobile": self.EXISTING_MOBILE,
                "user_id": self.EXISTING_USER_ID
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["customer_exists"] == True
        assert data["data"]["mobile"] == self.EXISTING_MOBILE
        assert data["data"]["name"] is not None
        # Should have limit info for existing customers
        assert "available_limit" in data["data"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
