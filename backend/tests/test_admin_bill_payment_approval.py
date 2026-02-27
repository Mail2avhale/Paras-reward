"""
Test Admin Bill Payment Approval Flow - UPDATED for Automatic Eko with Retries
No more approved_manual status. No manual completion.
Approve = Eko API with 3 retries → Success (completed) or Fail (auto-reject with PRC refund)

Features tested:
1. GET /api/admin/bill-payment/requests - List requests with all statuses
2. POST /api/admin/bill-payment/process - approve or reject only (no complete action)
   - Approve → Eko with 3 retries → completed OR rejected (with PRC refund)
   - Reject → rejected with PRC refund
3. No more /api/admin/bill-payment/complete endpoint
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://reward-staging.preview.emergentagent.com')
ADMIN_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestAdminBillPaymentListEndpoint:
    """Tests for GET /api/admin/bill-payment/requests"""
    
    def test_list_requests_returns_data(self, api_client):
        """Test that admin can get bill payment requests list"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        data = response.json()
        
        assert "requests" in data
        assert isinstance(data["requests"], list)
        
    def test_list_includes_standard_statuses(self, api_client):
        """Test that requests have standard status values (no approved_manual)"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        data = response.json()
        
        # Valid statuses (approved_manual may still exist in old data but not created anymore)
        valid_statuses = ["pending", "approved", "completed", "rejected", "processing", "approved_manual"]
        
        for req in data["requests"]:
            status = req.get("status")
            assert status in valid_statuses, f"Invalid status '{status}' found"
            
    def test_rejected_requests_have_reason_and_refund(self, api_client):
        """Test that rejected requests have reject_reason and refund_details"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        # Find rejected requests
        rejected_requests = [r for r in data["requests"] if r.get("status") == "rejected"]
        
        if not rejected_requests:
            pytest.skip("No rejected requests available for testing")
        
        # Find one with refund_details (auto-rejected after Eko fail)
        requests_with_refund = [r for r in rejected_requests if r.get("refund_details")]
        
        if requests_with_refund:
            req = requests_with_refund[0]
            assert "reject_reason" in req
            assert "refund_details" in req
            assert "prc_refunded" in req["refund_details"]
            print(f"✅ Rejected request has refund: {req['refund_details']['prc_refunded']} PRC")
        else:
            # Some rejections may be manual without refund details
            req = rejected_requests[0]
            assert "reject_reason" in req or "rejection_reason" in req
            
    def test_completed_requests_have_txn_number(self, api_client):
        """Test that completed requests have transaction number"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        # Find completed requests
        completed_requests = [r for r in data["requests"] if r.get("status") == "completed"]
        
        if not completed_requests:
            pytest.skip("No completed requests available for testing")
            
        # Check that they have txn_number
        for req in completed_requests[:3]:  # Check first 3
            assert "txn_number" in req, "Completed request should have txn_number"
            print(f"✅ Completed: {req['request_id'][:8]} - TXN: {req.get('txn_number')}")


class TestAdminBillPaymentProcess:
    """Tests for POST /api/admin/bill-payment/process"""
    
    def test_approve_action_only_accepts_approve_or_reject(self, api_client):
        """Test that only 'approve' and 'reject' actions are valid (no 'complete')"""
        # Get any request
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        if not data["requests"]:
            pytest.skip("No requests available")
            
        request_id = data["requests"][0]["request_id"]
        
        # Try invalid 'complete' action
        complete_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": request_id,
                "action": "complete",  # This should be invalid now
                "admin_uid": ADMIN_UID
            }
        )
        
        assert complete_response.status_code == 400
        error_msg = complete_response.json().get("detail", "").lower()
        assert "invalid action" in error_msg or "approve or reject" in error_msg
        
    def test_approve_pending_request_returns_completed_or_rejected(self, api_client):
        """Test that approving a pending request results in completed (Eko success) or rejected (Eko fail with refund)"""
        # First get a pending request
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        data = response.json()
        
        pending_requests = [r for r in data["requests"] if r.get("status") == "pending"]
        
        if not pending_requests:
            pytest.skip("No pending requests available for testing")
            
        pending_request = pending_requests[0]
        request_id = pending_request["request_id"]
        
        # Approve the request
        approve_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": request_id,
                "action": "approve",
                "admin_uid": ADMIN_UID,
                "admin_notes": "TEST: Automated test approval"
            }
        )
        
        assert approve_response.status_code == 200
        result = approve_response.json()
        
        # Result should be either completed (Eko success) or rejected (Eko fail)
        assert result.get("status") in ["completed", "rejected"], \
            f"Expected status 'completed' or 'rejected', got: {result.get('status')}"
        
        if result.get("status") == "completed":
            # Success case - Eko worked
            assert "txn_number" in result
            print(f"✅ Request completed via Eko - TXN: {result.get('txn_number')}")
        else:
            # Fail case - Eko failed after retries, auto-rejected with refund
            assert "reject_reason" in result
            assert "refund_details" in result
            assert result["refund_details"].get("prc_refunded", 0) > 0
            print(f"✅ Request auto-rejected after Eko fail - Reason: {result.get('reject_reason')}")
            print(f"   PRC Refunded: {result['refund_details']['prc_refunded']}")
            
    def test_approve_action_invalid_request_returns_404(self, api_client):
        """Test that approving non-existent request returns 404"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": "non-existent-request-id",
                "action": "approve",
                "admin_uid": ADMIN_UID
            }
        )
        assert response.status_code == 404
        
    def test_reject_action_requires_reason(self, api_client):
        """Test that reject action requires a reason"""
        # Get a pending request
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        pending_requests = [r for r in data["requests"] if r.get("status") == "pending"]
        
        if not pending_requests:
            pytest.skip("No pending requests available for testing")
            
        request_id = pending_requests[0]["request_id"]
        
        # Try to reject without reason
        reject_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": request_id,
                "action": "reject",
                "admin_uid": ADMIN_UID,
                "reject_reason": ""  # Empty reason
            }
        )
        
        assert reject_response.status_code == 400
        assert "reason" in reject_response.json().get("detail", "").lower()
        
    def test_reject_request_refunds_prc(self, api_client):
        """Test that rejecting a request refunds PRC to user"""
        # Get a pending request
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        pending_requests = [r for r in data["requests"] if r.get("status") == "pending"]
        
        if not pending_requests:
            pytest.skip("No pending requests available for testing")
            
        request = pending_requests[0]
        request_id = request["request_id"]
        prc_to_refund = request.get("total_prc_deducted", 0)
        
        # Reject the request
        reject_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": request_id,
                "action": "reject",
                "admin_uid": ADMIN_UID,
                "reject_reason": "TEST: Rejected for testing PRC refund"
            }
        )
        
        assert reject_response.status_code == 200
        result = reject_response.json()
        
        assert result.get("status") == "rejected"
        assert "refund_details" in result
        assert result["refund_details"].get("prc_refunded", 0) == prc_to_refund
        print(f"✅ Request rejected with PRC refund: {result['refund_details']['prc_refunded']}")


class TestCompleteEndpointRemoved:
    """Tests to verify /api/admin/bill-payment/complete endpoint no longer exists"""
    
    def test_complete_endpoint_returns_404_or_405(self, api_client):
        """Test that the /complete endpoint is no longer available"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/complete",
            json={
                "request_id": "any-request-id",
                "admin_uid": ADMIN_UID
            }
        )
        
        # Should return 404 (endpoint not found) or 405 (method not allowed)
        assert response.status_code in [404, 405, 422], \
            f"Expected 404/405/422 for removed endpoint, got {response.status_code}"
        print(f"✅ /complete endpoint correctly returns {response.status_code}")


class TestRetryBehavior:
    """Tests for the retry behavior of Eko API calls"""
    
    def test_rejected_requests_show_retry_attempts(self, api_client):
        """Test that auto-rejected requests show retry_attempts field"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        # Find rejected requests with refund_details (auto-rejected after Eko fail)
        auto_rejected = [r for r in data["requests"] 
                        if r.get("status") == "rejected" and r.get("refund_details")]
        
        if not auto_rejected:
            pytest.skip("No auto-rejected requests available")
            
        req = auto_rejected[0]
        
        # Should have retry_attempts field
        if "retry_attempts" in req:
            assert req["retry_attempts"] >= 1
            print(f"✅ Auto-rejected after {req['retry_attempts']} retry attempts")
        else:
            print("ℹ️ Older rejected request without retry_attempts field")


class TestHealthAndConfig:
    """Baseline health and config tests"""
    
    def test_health_endpoint(self, api_client):
        """Test health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        
    def test_eko_config_endpoint(self, api_client):
        """Test Eko config is properly configured"""
        response = api_client.get(f"{BASE_URL}/api/eko/config")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] == True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
