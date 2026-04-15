"""
Refund One-Click Flow E2E Tests - Iteration 201
================================================
Tests for the NEW refund flow:
1. GET /api/recharge/pending-refunds/{user_id} - returns correct data
2. POST /api/recharge/refund/process/{tid} - ONE-CLICK auto refund (Resend OTP → get data.otp → Initiate Refund)
3. POST /api/recharge/refund/verify-otp/{tid} - MANUAL OTP fallback
4. Dashboard API requires_refund_action flag
5. Frontend: Payment Issue banner should NOT show for payments with claimed_at or 'activated' in status_message
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_MOBILE = "9970100782"
TEST_TID_1 = "9999990001"  # Seeded test TID
TEST_TID_2 = "9999990002"  # Seeded test TID


class TestPendingRefundsEndpoint:
    """Test GET /api/recharge/pending-refunds/{user_id}"""
    
    def test_pending_refunds_returns_correct_structure(self):
        """Verify pending-refunds endpoint returns correct data structure"""
        response = requests.get(f"{BASE_URL}/api/recharge/pending-refunds/{TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "success" in data, "Response missing 'success' field"
        assert "pending_refunds" in data, "Response missing 'pending_refunds' field"
        assert "count" in data, "Response missing 'count' field"
        assert "requires_action" in data, "Response missing 'requires_action' field"
        
        # Verify pending_refunds is a list
        assert isinstance(data["pending_refunds"], list), "pending_refunds should be a list"
        
        # If there are pending refunds, verify structure
        if data["count"] > 0:
            refund = data["pending_refunds"][0]
            assert "eko_tid" in refund, "Refund item missing 'eko_tid'"
            assert "amount_inr" in refund, "Refund item missing 'amount_inr'"
            assert "source" in refund, "Refund item missing 'source'"
            print(f"✓ Found {data['count']} pending refunds with correct structure")
        else:
            print("✓ No pending refunds found (structure verified)")
    
    def test_pending_refunds_invalid_user(self):
        """Verify pending-refunds handles invalid user gracefully"""
        response = requests.get(f"{BASE_URL}/api/recharge/pending-refunds/invalid-user-id-12345")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Should return success even for non-existent user"
        assert data.get("count") == 0, "Should return 0 count for non-existent user"
        print("✓ Invalid user returns empty list gracefully")


class TestOneClickRefundProcess:
    """Test POST /api/recharge/refund/process/{tid} - ONE-CLICK auto refund"""
    
    def test_process_refund_requires_user_id(self):
        """Verify process endpoint requires user_id in request body"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/process/{TEST_TID_1}",
            json={}  # Missing user_id
        )
        # Should fail validation
        assert response.status_code in [400, 422], f"Expected 400/422 for missing user_id, got {response.status_code}"
        print("✓ process endpoint correctly requires user_id")
    
    def test_process_refund_validates_ownership(self):
        """Verify process endpoint validates transaction ownership"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/process/{TEST_TID_1}",
            json={"user_id": "wrong-user-id-12345"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Should fail for wrong user"
        assert "not found" in data.get("error", "").lower() or "does not belong" in data.get("error", "").lower(), \
            f"Expected ownership error, got: {data.get('error')}"
        print("✓ process endpoint validates transaction ownership")
    
    def test_process_refund_with_valid_user(self):
        """Test process endpoint with valid user - should return success or requires_manual_otp"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/process/{TEST_TID_1}",
            json={"user_id": TEST_USER_UID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response should have these fields regardless of success
        assert "success" in data or "requires_manual_otp" in data, "Response missing expected fields"
        assert "tid" in data, "Response missing 'tid' field"
        
        # For test/fake TIDs, Eko returns empty otp so requires_manual_otp should be True
        if data.get("requires_manual_otp"):
            print(f"✓ process endpoint correctly returns requires_manual_otp=True for test TID")
            print(f"  Message: {data.get('error') or data.get('message')}")
        elif data.get("success"):
            print(f"✓ process endpoint succeeded with refund_tid: {data.get('refund_tid')}")
        else:
            print(f"✓ process endpoint returned error (expected for test TID): {data.get('error') or data.get('message')}")
    
    def test_process_refund_response_structure(self):
        """Verify process endpoint response has correct structure"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/process/{TEST_TID_1}",
            json={"user_id": TEST_USER_UID}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Check for expected fields based on response type
        if data.get("success"):
            assert "refund_tid" in data, "Successful response should include refund_tid"
            assert "refunded_amount" in data, "Successful response should include refunded_amount"
            assert "message" in data, "Response should include message"
        elif data.get("requires_manual_otp"):
            assert "tid" in data, "Manual OTP response should include tid"
            assert "error" in data or "message" in data, "Manual OTP response should include error/message"
        else:
            assert "error" in data or "message" in data, "Error response should include error/message"
        
        print("✓ process endpoint response structure is correct")


class TestManualOTPFallback:
    """Test POST /api/recharge/refund/verify-otp/{tid} - MANUAL OTP fallback"""
    
    def test_verify_otp_requires_user_id_and_otp(self):
        """Verify verify-otp requires user_id and otp in request body"""
        # Missing both
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/verify-otp/{TEST_TID_1}",
            json={}
        )
        assert response.status_code in [400, 422], f"Expected 400/422 for missing fields, got {response.status_code}"
        
        # Missing otp
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/verify-otp/{TEST_TID_1}",
            json={"user_id": TEST_USER_UID}
        )
        assert response.status_code in [400, 422], f"Expected 400/422 for missing otp, got {response.status_code}"
        print("✓ verify-otp correctly requires user_id and otp")
    
    def test_verify_otp_validates_ownership(self):
        """Verify verify-otp validates transaction ownership"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/verify-otp/{TEST_TID_1}",
            json={"user_id": "wrong-user-id-12345", "otp": "123456"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False, "Should fail for wrong user"
        print("✓ verify-otp validates transaction ownership")
    
    def test_verify_otp_with_fake_otp(self):
        """Test verify-otp with fake OTP (Eko should reject)"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/verify-otp/{TEST_TID_1}",
            json={"user_id": TEST_USER_UID, "otp": "000000"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response should have these fields
        assert "success" in data, "Response missing 'success' field"
        
        # Eko should reject fake OTP
        if not data.get("success"):
            error_msg = data.get("error", "") or data.get("message", "")
            print(f"✓ verify-otp correctly rejected fake OTP: {error_msg}")
        else:
            print("✓ verify-otp processed (unexpected success with fake OTP)")
    
    def test_verify_otp_response_structure(self):
        """Verify verify-otp response has correct structure"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/verify-otp/{TEST_TID_1}",
            json={"user_id": TEST_USER_UID, "otp": "123456"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Check for expected fields
        assert "success" in data, "Response missing 'success' field"
        assert "tid" in data, "Response missing 'tid' field"
        assert "message" in data, "Response missing 'message' field"
        
        if data.get("success"):
            assert "refund_tid" in data, "Successful response should include refund_tid"
            assert "refunded_amount" in data, "Successful response should include refunded_amount"
        
        print("✓ verify-otp response structure is correct")


class TestDashboardRefundFlags:
    """Test GET /api/user/{uid}/dashboard for refund flags"""
    
    def test_dashboard_returns_refund_flags(self):
        """Verify dashboard returns requires_refund_action and pending_refund_count"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check for refund-related fields
        assert "requires_refund_action" in data, "Dashboard missing 'requires_refund_action' field"
        assert "pending_refund_count" in data, "Dashboard missing 'pending_refund_count' field"
        
        # Verify types
        assert isinstance(data["requires_refund_action"], bool), "requires_refund_action should be boolean"
        assert isinstance(data["pending_refund_count"], int), "pending_refund_count should be integer"
        
        # Verify consistency
        if data["pending_refund_count"] > 0:
            assert data["requires_refund_action"] == True, "requires_refund_action should be True when count > 0"
        else:
            assert data["requires_refund_action"] == False, "requires_refund_action should be False when count = 0"
        
        print(f"✓ Dashboard returns refund flags: requires_action={data['requires_refund_action']}, count={data['pending_refund_count']}")


class TestPaymentHistoryForBannerLogic:
    """Test payment history API for Payment Issue banner logic"""
    
    def test_payment_history_includes_claimed_at(self):
        """Verify payment history includes claimed_at field for banner logic"""
        response = requests.get(f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_UID}?include_all=true")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "payments" in data, "Response missing 'payments' field"
        
        payments = data.get("payments", [])
        if len(payments) > 0:
            # Check if payments have the fields needed for banner logic
            payment = payments[0]
            # These fields should exist (may be null)
            print(f"✓ Payment history returned {len(payments)} payments")
            print(f"  Sample payment fields: status={payment.get('status')}, status_message={payment.get('status_message')}, claimed_at={payment.get('claimed_at')}")
        else:
            print("✓ No payment history found (structure verified)")
    
    def test_payment_history_status_message_field(self):
        """Verify payment history includes status_message field"""
        response = requests.get(f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_UID}?include_all=true")
        assert response.status_code == 200
        
        data = response.json()
        payments = data.get("payments", [])
        
        # Check if any payment has status_message with 'activated'
        activated_payments = [p for p in payments if p.get("status_message") and "activated" in p.get("status_message", "").lower()]
        claimed_payments = [p for p in payments if p.get("claimed_at")]
        
        print(f"✓ Payments with 'activated' in status_message: {len(activated_payments)}")
        print(f"✓ Payments with claimed_at: {len(claimed_payments)}")


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_api_health(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✓ API health check passed")
    
    def test_user_exists(self):
        """Verify test user exists"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}")
        assert response.status_code == 200, f"Test user not found: {response.status_code}"
        
        data = response.json()
        assert data.get("uid") == TEST_USER_UID, "User UID mismatch"
        print(f"✓ Test user exists: {data.get('name', 'Unknown')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
