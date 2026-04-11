"""
Test Eko Auto-Refund, Receipt, and Retry Features
=================================================
Tests for:
1. GET /api/recharge/receipt/{request_id}?user_id={uid} - returns receipt data or 'Transaction not found'
2. POST /api/recharge/retry/{request_id} with body {user_id: x} - returns retry_data or 'Transaction not found'
3. GET /api/recharge/admin/enquiry/{request_id} - handles refund_pending as distinct status
4. Admin BBPS Dashboard endpoints for refund_pending status
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_MOBILE = "9970100782"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


class TestReceiptEndpoint:
    """Tests for GET /api/recharge/receipt/{request_id}"""
    
    def test_receipt_nonexistent_request(self):
        """Receipt endpoint returns 'Transaction not found' for non-existent request"""
        fake_request_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/recharge/receipt/{fake_request_id}",
            params={"user_id": TEST_USER_UID}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        assert "not found" in data.get("error", "").lower()
    
    def test_receipt_endpoint_exists(self):
        """Receipt endpoint exists and responds"""
        response = requests.get(
            f"{BASE_URL}/api/recharge/receipt/test-request-id",
            params={"user_id": TEST_USER_UID}
        )
        # Should return 200 with error message, not 404
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
    
    def test_receipt_without_user_id(self):
        """Receipt endpoint works without user_id (less restrictive query)"""
        fake_request_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/recharge/receipt/{fake_request_id}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        assert "not found" in data.get("error", "").lower()


class TestRetryEndpoint:
    """Tests for POST /api/recharge/retry/{request_id}"""
    
    def test_retry_nonexistent_request(self):
        """Retry endpoint returns 'Transaction not found' for non-existent request"""
        fake_request_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/recharge/retry/{fake_request_id}",
            json={"user_id": TEST_USER_UID}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        assert "not found" in data.get("error", "").lower()
    
    def test_retry_endpoint_exists(self):
        """Retry endpoint exists and responds"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/retry/test-request-id",
            json={"user_id": TEST_USER_UID}
        )
        # Should return 200 with error message, not 404
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
    
    def test_retry_requires_user_id(self):
        """Retry endpoint requires user_id in body"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/retry/test-request-id",
            json={}
        )
        # Should return 422 validation error or 200 with error
        assert response.status_code in [200, 422]


class TestAdminEnquiryEndpoint:
    """Tests for GET /api/recharge/admin/enquiry/{request_id}"""
    
    def test_enquiry_nonexistent_request(self):
        """Enquiry endpoint returns 'Transaction not found' for non-existent request"""
        fake_request_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/recharge/admin/enquiry/{fake_request_id}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        assert "not found" in data.get("error", "").lower()
    
    def test_enquiry_endpoint_exists(self):
        """Enquiry endpoint exists and responds"""
        response = requests.get(f"{BASE_URL}/api/recharge/admin/enquiry/test-request-id")
        # Should return 200 with error message, not 404
        assert response.status_code == 200
        data = response.json()
        assert "success" in data


class TestAdminRefundEndpoint:
    """Tests for POST /api/recharge/admin/refund/{request_id}"""
    
    def test_refund_nonexistent_request(self):
        """Refund endpoint returns 'Transaction not found' for non-existent request"""
        fake_request_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/recharge/admin/refund/{fake_request_id}",
            json={"admin_note": "Test refund"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        assert "not found" in data.get("error", "").lower()
    
    def test_refund_endpoint_exists(self):
        """Refund endpoint exists and responds"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/admin/refund/test-request-id",
            json={"admin_note": "Test"}
        )
        # Should return 200 with error message, not 404
        assert response.status_code == 200
        data = response.json()
        assert "success" in data


class TestBBPSAdminDashboardEndpoints:
    """Tests for Admin BBPS Dashboard endpoints"""
    
    def test_bbps_requests_endpoint(self):
        """Admin BBPS requests endpoint exists and returns data"""
        response = requests.get(
            f"{BASE_URL}/api/redeem/admin/bbps-requests",
            params={"page": 1, "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        if data.get("success"):
            assert "requests" in data
            assert "stats" in data
    
    def test_bbps_requests_with_status_filter(self):
        """Admin BBPS requests endpoint supports status filter"""
        # Test with refund_pending status filter
        response = requests.get(
            f"{BASE_URL}/api/redeem/admin/bbps-requests",
            params={"page": 1, "limit": 10, "status": "refund_pending"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
    
    def test_bbps_requests_with_pending_filter(self):
        """Admin BBPS requests endpoint supports pending status filter"""
        response = requests.get(
            f"{BASE_URL}/api/redeem/admin/bbps-requests",
            params={"page": 1, "limit": 10, "status": "pending"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
    
    def test_bbps_wallet_balance_endpoint(self):
        """EKO wallet balance endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/bbps/wallet-balance")
        assert response.status_code == 200
        data = response.json()
        # May fail if Eko not configured, but endpoint should exist
        assert "success" in data or "balance" in data or "error" in data


class TestRechargeHistoryEndpoint:
    """Tests for GET /api/recharge/history/{user_id}"""
    
    def test_history_returns_transactions(self):
        """History endpoint returns transactions list"""
        response = requests.get(f"{BASE_URL}/api/recharge/history/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "transactions" in data
        assert isinstance(data["transactions"], list)
    
    def test_history_returns_limits(self):
        """History endpoint returns daily and monthly limits"""
        response = requests.get(f"{BASE_URL}/api/recharge/history/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "daily_limit" in data
        assert "daily_remaining" in data
        assert "monthly_limit" in data
        assert "monthly_remaining" in data
    
    def test_history_nonexistent_user(self):
        """History endpoint handles non-existent user gracefully"""
        fake_uid = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/recharge/history/{fake_uid}")
        assert response.status_code == 200
        data = response.json()
        # Should return empty transactions, not error
        assert data.get("success") == True
        assert data.get("transactions") == []


class TestBBPSRefundOTPEndpoints:
    """Tests for BBPS OTP-based refund endpoints"""
    
    def test_resend_refund_otp_endpoint_exists(self):
        """Resend refund OTP endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/bbps/refund/resend-otp/test-tid")
        # Should return 200 with error (not 404)
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
    
    def test_verify_refund_otp_endpoint_exists(self):
        """Verify refund OTP endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/bbps/refund/verify/test-tid",
            params={"otp": "123456", "state": "1"}
        )
        # Should return 200 with error (not 404)
        assert response.status_code == 200
        data = response.json()
        assert "success" in data


class TestEkoCheckRefundEndpoint:
    """Tests for GET /api/bbps/admin/check-eko-refund/{request_id}"""
    
    def test_check_eko_refund_nonexistent(self):
        """Check EKO refund endpoint handles non-existent request"""
        fake_request_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/bbps/admin/check-eko-refund/{fake_request_id}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        assert "not found" in data.get("error", "").lower()
    
    def test_check_eko_refund_endpoint_exists(self):
        """Check EKO refund endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/bbps/admin/check-eko-refund/test-request-id")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data


class TestStatusConfigMapping:
    """Tests to verify status configurations are correct"""
    
    def test_recharge_operators_mobile(self):
        """Mobile operators endpoint returns operators"""
        response = requests.get(f"{BASE_URL}/api/recharge/operators/mobile")
        assert response.status_code == 200
        data = response.json()
        # May fail if Eko not configured, but structure should be correct
        assert "success" in data
        assert "operators" in data
    
    def test_recharge_operators_dth(self):
        """DTH operators endpoint returns operators"""
        response = requests.get(f"{BASE_URL}/api/recharge/operators/dth")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "operators" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
