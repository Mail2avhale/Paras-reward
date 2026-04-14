"""
Test Suite: Refund Blocker Modal Feature
=========================================
Tests for dashboard-blocking OTP refund modal for users with refund_pending transactions.

Features tested:
1. GET /api/recharge/pending-refunds/{user_id} - returns pending refund list
2. POST /api/recharge/refund/send-otp/{tid} - validates user ownership, sends OTP
3. POST /api/recharge/refund/verify-otp/{tid} - validates user ownership, processes refund
4. GET /api/user/{uid}/dashboard - returns requires_refund_action flag
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

# Test user credentials from test_credentials.md
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"

# Test TIDs seeded for refund_pending transactions
TEST_TID_1 = "9999990001"
TEST_TID_2 = "9999990002"


class TestPendingRefundsAPI:
    """Tests for GET /api/recharge/pending-refunds/{user_id}"""
    
    def test_pending_refunds_returns_success(self):
        """Test that pending-refunds endpoint returns success response"""
        response = requests.get(f"{BASE_URL}/api/recharge/pending-refunds/{TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should have 'success' field"
        assert data["success"] == True, f"Expected success=True, got {data}"
        assert "pending_refunds" in data, "Response should have 'pending_refunds' field"
        assert "count" in data, "Response should have 'count' field"
        print(f"✓ Pending refunds API returned: count={data.get('count')}, requires_action={data.get('requires_action')}")
    
    def test_pending_refunds_returns_list(self):
        """Test that pending_refunds is a list"""
        response = requests.get(f"{BASE_URL}/api/recharge/pending-refunds/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data.get("pending_refunds"), list), "pending_refunds should be a list"
        print(f"✓ Pending refunds list has {len(data['pending_refunds'])} items")
    
    def test_pending_refunds_invalid_user(self):
        """Test pending-refunds with non-existent user returns empty list"""
        response = requests.get(f"{BASE_URL}/api/recharge/pending-refunds/invalid-user-id-12345")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("count", 0) == 0 or len(data.get("pending_refunds", [])) == 0
        print("✓ Invalid user returns empty pending refunds list")


class TestSendOTPAPI:
    """Tests for POST /api/recharge/refund/send-otp/{tid}"""
    
    def test_send_otp_requires_user_id(self):
        """Test that send-otp requires user_id in body"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/send-otp/{TEST_TID_1}",
            json={}
        )
        # Should fail validation without user_id
        assert response.status_code in [400, 422], f"Expected 400/422 without user_id, got {response.status_code}"
        print("✓ Send OTP requires user_id in request body")
    
    def test_send_otp_validates_ownership(self):
        """Test that send-otp validates user owns the transaction"""
        # Try with wrong user_id
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/send-otp/{TEST_TID_1}",
            json={"user_id": "wrong-user-id-12345"}
        )
        assert response.status_code == 200  # API returns 200 with error in body
        
        data = response.json()
        assert data.get("success") == False, "Should fail for wrong user"
        assert "not found" in data.get("error", "").lower() or "does not belong" in data.get("error", "").lower()
        print("✓ Send OTP validates user ownership of transaction")
    
    def test_send_otp_with_valid_user(self):
        """Test send-otp with valid user (may succeed or fail based on transaction status)"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/send-otp/{TEST_TID_1}",
            json={"user_id": TEST_USER_UID}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Either success (OTP sent) or error (transaction not in refund_pending status)
        assert "success" in data
        print(f"✓ Send OTP response: success={data.get('success')}, message={data.get('message', data.get('error', ''))[:100]}")


class TestVerifyOTPAPI:
    """Tests for POST /api/recharge/refund/verify-otp/{tid}"""
    
    def test_verify_otp_requires_user_id_and_otp(self):
        """Test that verify-otp requires user_id and otp in body"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/verify-otp/{TEST_TID_1}",
            json={}
        )
        # Should fail validation without required fields
        assert response.status_code in [400, 422], f"Expected 400/422 without required fields, got {response.status_code}"
        print("✓ Verify OTP requires user_id and otp in request body")
    
    def test_verify_otp_validates_ownership(self):
        """Test that verify-otp validates user owns the transaction"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/verify-otp/{TEST_TID_1}",
            json={"user_id": "wrong-user-id-12345", "otp": "123456"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == False, "Should fail for wrong user"
        assert "not found" in data.get("error", "").lower() or "does not belong" in data.get("error", "").lower()
        print("✓ Verify OTP validates user ownership of transaction")
    
    def test_verify_otp_with_invalid_otp(self):
        """Test verify-otp with invalid OTP (may fail based on transaction status)"""
        response = requests.post(
            f"{BASE_URL}/api/recharge/refund/verify-otp/{TEST_TID_1}",
            json={"user_id": TEST_USER_UID, "otp": "000000"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Either fails with OTP error or transaction not in refund_pending status
        assert "success" in data
        print(f"✓ Verify OTP response: success={data.get('success')}, message={data.get('message', data.get('error', ''))[:100]}")


class TestDashboardRefundFlag:
    """Tests for GET /api/user/{uid}/dashboard - requires_refund_action flag"""
    
    def test_dashboard_returns_requires_refund_action_flag(self):
        """Test that dashboard API returns requires_refund_action flag"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "requires_refund_action" in data, "Dashboard should return requires_refund_action flag"
        assert isinstance(data["requires_refund_action"], bool), "requires_refund_action should be boolean"
        print(f"✓ Dashboard returns requires_refund_action={data['requires_refund_action']}")
    
    def test_dashboard_returns_pending_refund_count(self):
        """Test that dashboard API returns pending_refund_count"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "pending_refund_count" in data, "Dashboard should return pending_refund_count"
        assert isinstance(data["pending_refund_count"], int), "pending_refund_count should be integer"
        print(f"✓ Dashboard returns pending_refund_count={data['pending_refund_count']}")
    
    def test_dashboard_user_data_structure(self):
        """Test that dashboard returns proper user data structure"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "user" in data, "Dashboard should return user object"
        
        user = data["user"]
        assert "uid" in user, "User should have uid"
        assert "prc_balance" in user, "User should have prc_balance"
        assert "subscription_plan" in user, "User should have subscription_plan"
        print(f"✓ Dashboard user data: uid={user.get('uid')[:8]}..., plan={user.get('subscription_plan')}")


class TestRefundFlowIntegration:
    """Integration tests for the complete refund flow"""
    
    def test_pending_refunds_matches_dashboard_flag(self):
        """Test that pending-refunds count matches dashboard requires_refund_action"""
        # Get pending refunds
        refunds_response = requests.get(f"{BASE_URL}/api/recharge/pending-refunds/{TEST_USER_UID}")
        assert refunds_response.status_code == 200
        refunds_data = refunds_response.json()
        
        # Get dashboard
        dashboard_response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.json()
        
        # Compare
        pending_count = refunds_data.get("count", 0)
        requires_action = dashboard_data.get("requires_refund_action", False)
        dashboard_count = dashboard_data.get("pending_refund_count", 0)
        
        # If there are pending refunds, requires_refund_action should be True
        if pending_count > 0:
            assert requires_action == True, f"requires_refund_action should be True when count={pending_count}"
        else:
            assert requires_action == False, f"requires_refund_action should be False when count={pending_count}"
        
        print(f"✓ Pending refunds count ({pending_count}) matches dashboard flag (requires_action={requires_action}, dashboard_count={dashboard_count})")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
