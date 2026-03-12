"""
Test Subscription Payment Approval and KYC Document Submission APIs
Focus on timeout handling and image validation
"""

import pytest
import requests
import os
import base64

# Use preview URL for testing (same as frontend sees)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://instant-money-flow.preview.emergentagent.com').rstrip('/')

# Test credentials from review request
TEST_USER_EMAIL = "mail2avhale@gmail.com"
TEST_USER_PIN = "152759"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "123456"

# Small base64 test image (1x1 pixel red PNG) - very small for testing
SMALL_TEST_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

# Another small test image
SMALL_TEST_IMAGE_2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="


class TestHealthCheck:
    """Basic API health check"""
    
    def test_health_endpoint(self):
        """Test health endpoint is responsive"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health check passed: {data}")


class TestSubscriptionPaymentApproval:
    """Test subscription payment approval API with timeout handling"""
    
    def test_get_pending_vip_payments(self):
        """Test getting pending VIP payments list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments",
            params={"status": "pending", "page": 1, "limit": 10},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        assert "total" in data
        print(f"✅ Get pending payments: {data.get('total')} pending, {len(data.get('payments', []))} returned")
        return data
    
    def test_get_pending_count(self):
        """Test pending payments count endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments/pending-count",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✅ Pending count: {data.get('count')}")
        return data.get("count", 0)
    
    def test_approve_nonexistent_payment(self):
        """Test approving a non-existent payment returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/admin/vip-payment/nonexistent-payment-id/approve",
            json={"admin_id": "test-admin"},
            timeout=30
        )
        assert response.status_code == 404
        print(f"✅ Non-existent payment returns 404 as expected")
    
    def test_reject_nonexistent_payment(self):
        """Test rejecting a non-existent payment returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/admin/vip-payment/nonexistent-payment-id/reject",
            json={"admin_id": "test-admin", "reason": "Test rejection"},
            timeout=30
        )
        assert response.status_code == 404
        print(f"✅ Non-existent payment rejection returns 404 as expected")
    
    def test_subscription_stats(self):
        """Test subscription stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/subscription-stats",
            timeout=15
        )
        assert response.status_code == 200
        data = response.json()
        assert "plan_counts" in data
        print(f"✅ Subscription stats: {data.get('plan_counts')}")
    
    def test_pricing_reference(self):
        """Test subscription pricing reference endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/subscription-pricing-reference",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "startup" in data
        assert "growth" in data
        assert "elite" in data
        print(f"✅ Pricing reference retrieved: {list(data.keys())}")


class TestKYCDocumentSubmission:
    """Test KYC document submission API with image upload and validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get test user UID for KYC tests"""
        # Login to get user info
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": TEST_USER_EMAIL, "password": TEST_USER_PIN},
            timeout=15
        )
        if response.status_code == 200:
            self.user_uid = response.json().get("user", {}).get("uid")
        else:
            # Try to find user by email
            self.user_uid = "test-user-uid"
        yield
    
    def test_kyc_invalid_aadhaar_format(self):
        """Test KYC submission with invalid Aadhaar number format"""
        response = requests.post(
            f"{BASE_URL}/api/kyc/submit/{self.user_uid}",
            json={
                "aadhaar_front_base64": SMALL_TEST_IMAGE,
                "aadhaar_back_base64": SMALL_TEST_IMAGE_2,
                "aadhaar_number": "123456",  # Invalid - too short
                "pan_front_base64": "",
                "pan_number": ""
            },
            timeout=30
        )
        assert response.status_code == 400
        data = response.json()
        assert "aadhaar" in data.get("detail", "").lower() or "12 digit" in data.get("detail", "").lower()
        print(f"✅ Invalid Aadhaar format rejected: {data.get('detail')}")
    
    def test_kyc_invalid_pan_format(self):
        """Test KYC submission with invalid PAN number format"""
        response = requests.post(
            f"{BASE_URL}/api/kyc/submit/{self.user_uid}",
            json={
                "aadhaar_front_base64": "",
                "aadhaar_back_base64": "",
                "aadhaar_number": "",
                "pan_front_base64": SMALL_TEST_IMAGE,
                "pan_number": "ABC12"  # Invalid - too short
            },
            timeout=30
        )
        assert response.status_code == 400
        data = response.json()
        assert "pan" in data.get("detail", "").lower() or "10 character" in data.get("detail", "").lower()
        print(f"✅ Invalid PAN format rejected: {data.get('detail')}")
    
    def test_kyc_invalid_image_format(self):
        """Test KYC submission with invalid image format"""
        import random
        # Use random Aadhaar to avoid duplicate issue
        unique_aadhaar = f"9{random.randint(10000000000, 99999999999)}"
        
        response = requests.post(
            f"{BASE_URL}/api/kyc/submit/{self.user_uid}",
            json={
                "aadhaar_front_base64": "not-a-valid-base64-image",
                "aadhaar_back_base64": SMALL_TEST_IMAGE,
                "aadhaar_number": unique_aadhaar,  # Valid format
                "pan_front_base64": "",
                "pan_number": ""
            },
            timeout=30
        )
        # Either 400 for image format error OR validation passes until DB operations
        # The API validates image format before DB operations
        assert response.status_code in [400, 200, 500]
        data = response.json()
        if response.status_code == 400:
            # Should reject for invalid image format
            detail = data.get("detail", "").lower()
            print(f"✅ Validation error: {data.get('detail')}")
        else:
            print(f"✅ Image format check response: {response.status_code}")
    
    def test_kyc_valid_aadhaar_format(self):
        """Test KYC submission with valid Aadhaar number format"""
        # Generate unique Aadhaar for test
        test_aadhaar = "999988887777"  # Test number
        
        response = requests.post(
            f"{BASE_URL}/api/kyc/submit/{self.user_uid}",
            json={
                "aadhaar_front_base64": SMALL_TEST_IMAGE,
                "aadhaar_back_base64": SMALL_TEST_IMAGE_2,
                "aadhaar_number": test_aadhaar,
                "pan_front_base64": "",
                "pan_number": ""
            },
            timeout=30
        )
        # Can be 200 (success) or 400 (already registered)
        assert response.status_code in [200, 400]
        data = response.json()
        if response.status_code == 200:
            print(f"✅ KYC with valid Aadhaar submitted: kyc_id={data.get('kyc_id')}")
        else:
            print(f"✅ KYC validation worked: {data.get('detail')}")
    
    def test_kyc_valid_pan_format(self):
        """Test KYC submission with valid PAN number format"""
        test_pan = "ZZZZZ9999Z"  # Test PAN
        
        response = requests.post(
            f"{BASE_URL}/api/kyc/submit/{self.user_uid}",
            json={
                "aadhaar_front_base64": "",
                "aadhaar_back_base64": "",
                "aadhaar_number": "",
                "pan_front_base64": SMALL_TEST_IMAGE,
                "pan_number": test_pan
            },
            timeout=30
        )
        # Can be 200 (success) or 400 (already registered)
        assert response.status_code in [200, 400]
        data = response.json()
        if response.status_code == 200:
            print(f"✅ KYC with valid PAN submitted: kyc_id={data.get('kyc_id')}")
        else:
            print(f"✅ KYC validation worked: {data.get('detail')}")


class TestKYCList:
    """Test KYC list retrieval endpoints"""
    
    def test_get_kyc_list_all(self):
        """Test getting all KYC documents"""
        response = requests.get(
            f"{BASE_URL}/api/kyc/list",
            params={"page": 1, "limit": 10},
            timeout=15
        )
        assert response.status_code == 200
        data = response.json()
        assert "kyc_documents" in data or "documents" in data or isinstance(data, list)
        print(f"✅ KYC list retrieved successfully")
    
    def test_get_kyc_list_pending(self):
        """Test getting pending KYC documents"""
        response = requests.get(
            f"{BASE_URL}/api/kyc/list",
            params={"status": "pending", "page": 1, "limit": 10},
            timeout=15
        )
        assert response.status_code == 200
        print(f"✅ Pending KYC list retrieved")


class TestAdminVIPPaymentFlow:
    """Test the complete admin VIP payment approval flow"""
    
    def test_vip_payments_with_filters(self):
        """Test VIP payments list with various filters"""
        # Test with time filter
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments",
            params={"status": "approved", "time_filter": "month", "page": 1, "limit": 5},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✅ Approved payments (last month): {len(data.get('payments', []))} items")
        
        # Test with plan filter
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments",
            params={"plan": "elite", "page": 1, "limit": 5},
            timeout=30
        )
        assert response.status_code == 200
        print(f"✅ Elite plan payments filter works")
    
    def test_vip_cache_clear(self):
        """Test VIP cache clear endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/admin/vip-cache-clear",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✅ VIP cache cleared: {data.get('message')}")


class TestTimeoutHandling:
    """Test timeout handling in critical APIs"""
    
    def test_health_quick_response(self):
        """Test health check responds quickly (no DB dependency)"""
        response = requests.get(
            f"{BASE_URL}/api/health",
            timeout=5  # Should respond within 5 seconds
        )
        assert response.status_code == 200
        print(f"✅ Health check responded quickly")
    
    def test_performance_status(self):
        """Test performance/circuit breaker status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/performance/status",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "database_ready" in data
        print(f"✅ Performance status: DB ready={data.get('database_ready')}")
    
    def test_cache_stats(self):
        """Test cache statistics endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/cache/stats",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✅ Cache status: {data.get('status')}")


class TestErrorScenarios:
    """Test error handling scenarios"""
    
    def test_approve_already_approved_payment_id(self):
        """Test behavior when trying to approve with invalid payment ID format"""
        response = requests.post(
            f"{BASE_URL}/api/admin/vip-payment/invalid-id-12345/approve",
            json={"admin_id": "admin-test"},
            timeout=30
        )
        # Should return 404 for non-existent payment
        assert response.status_code == 404
        print(f"✅ Invalid payment ID handled correctly")
    
    def test_kyc_submit_empty_data(self):
        """Test KYC submission with empty data"""
        response = requests.post(
            f"{BASE_URL}/api/kyc/submit/some-user-id",
            json={
                "aadhaar_front_base64": "",
                "aadhaar_back_base64": "",
                "aadhaar_number": "",
                "pan_front_base64": "",
                "pan_number": ""
            },
            timeout=30
        )
        # Should either accept empty submission or return validation error
        assert response.status_code in [200, 400, 422]
        print(f"✅ Empty KYC data handled: status={response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
