"""
Test Admin Bill Payment Approval Flow - UPDATED for Admin Control Flow
No auto-reject. When Eko fails, status becomes 'eko_failed'.
Admin gets 3 options: 1) Retry Eko, 2) Complete Manually, 3) Reject with PRC refund.
Only admin can reject - no auto-reject.

Features tested:
1. GET /api/admin/bill-payment/requests - List requests with all statuses including eko_failed
2. POST /api/admin/bill-payment/process - approve, reject, retry, complete actions
   - Approve (pending) → Eko with 3 retries → completed (success) OR eko_failed (fail - admin decides)
   - Retry (eko_failed) → Try Eko again → completed (success) OR stays eko_failed
   - Complete (eko_failed/pending) → Manually mark as completed
   - Reject (any except completed) → rejected with PRC refund
3. No auto-reject - admin makes all decisions on failed Eko requests
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://admin-payment-hub-5.preview.emergentagent.com')
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
        
    def test_list_includes_all_valid_statuses(self, api_client):
        """Test that requests have valid status values including eko_failed"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        data = response.json()
        
        # Valid statuses now include eko_failed
        valid_statuses = ["pending", "approved", "completed", "rejected", "processing", "approved_manual", "eko_failed"]
        
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
        
        # Find one with refund_details (rejected by admin)
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


class TestValidActions:
    """Test valid actions for bill payment processing"""
    
    def test_valid_actions_list(self, api_client):
        """Test that the valid actions include approve, reject, retry, complete"""
        # Get any request
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        if not data["requests"]:
            pytest.skip("No requests available")
            
        request_id = data["requests"][0]["request_id"]
        
        # Try invalid action
        invalid_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": request_id,
                "action": "invalid_action",
                "admin_uid": ADMIN_UID
            }
        )
        
        assert invalid_response.status_code == 400
        error_msg = invalid_response.json().get("detail", "").lower()
        # Check that valid actions are mentioned in error message
        assert "approve" in error_msg or "reject" in error_msg or "retry" in error_msg or "complete" in error_msg


class TestAdminBillPaymentProcess:
    """Tests for POST /api/admin/bill-payment/process"""
    
    def test_approve_pending_request_returns_completed_or_eko_failed(self, api_client):
        """Test that approving a pending request results in completed (Eko success) or eko_failed (Eko fail - admin decides)"""
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
        
        # Result should be either completed (Eko success) or eko_failed (Eko fail - NO auto-reject)
        assert result.get("status") in ["completed", "eko_failed"], \
            f"Expected status 'completed' or 'eko_failed', got: {result.get('status')}"
        
        if result.get("status") == "completed":
            # Success case - Eko worked
            assert "txn_number" in result
            print(f"✅ Request completed via Eko - TXN: {result.get('txn_number')}")
        else:
            # Fail case - Eko failed after retries, now eko_failed (admin decides)
            assert "eko_fail_reason" in result
            assert "admin_options" in result
            assert result["admin_options"] == ["retry", "complete", "reject"]
            print(f"✅ Request set to eko_failed - Reason: {result.get('eko_fail_reason')}")
            print(f"   Admin options: {result.get('admin_options')}")
            
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
        # Get a pending or eko_failed request
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        rejectable_requests = [r for r in data["requests"] if r.get("status") in ["pending", "eko_failed"]]
        
        if not rejectable_requests:
            pytest.skip("No pending/eko_failed requests available for testing")
            
        request_id = rejectable_requests[0]["request_id"]
        
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
        # Get a pending or eko_failed request
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        rejectable_requests = [r for r in data["requests"] if r.get("status") in ["pending", "eko_failed"]]
        
        if not rejectable_requests:
            pytest.skip("No pending/eko_failed requests available for testing")
            
        request = rejectable_requests[0]
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


class TestRetryAction:
    """Tests for retry action on eko_failed requests"""
    
    def test_retry_only_works_on_eko_failed_status(self, api_client):
        """Test that retry action only works on eko_failed requests"""
        # Get requests
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        # Find a non-eko_failed request
        non_eko_failed = [r for r in data["requests"] if r.get("status") not in ["eko_failed"]]
        
        if not non_eko_failed:
            pytest.skip("No non-eko_failed requests available")
            
        request_id = non_eko_failed[0]["request_id"]
        
        # Try retry on wrong status
        retry_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": request_id,
                "action": "retry",
                "admin_uid": ADMIN_UID
            }
        )
        
        assert retry_response.status_code == 400
        print(f"✅ Retry correctly rejected for status '{non_eko_failed[0]['status']}'")
        
    def test_retry_on_eko_failed_request(self, api_client):
        """Test that retry action works on eko_failed requests"""
        # Get eko_failed requests
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        eko_failed_requests = [r for r in data["requests"] if r.get("status") == "eko_failed"]
        
        if not eko_failed_requests:
            pytest.skip("No eko_failed requests available for retry test")
            
        request_id = eko_failed_requests[0]["request_id"]
        
        # Retry
        retry_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": request_id,
                "action": "retry",
                "admin_uid": ADMIN_UID
            }
        )
        
        assert retry_response.status_code == 200
        result = retry_response.json()
        
        # Result should be either completed (Eko success on retry) or stays eko_failed
        assert result.get("status") in ["completed", "eko_failed"], \
            f"Expected 'completed' or 'eko_failed', got: {result.get('status')}"
        
        if result.get("status") == "completed":
            print(f"✅ Retry succeeded - TXN: {result.get('txn_number')}")
        else:
            print(f"✅ Retry still failed - Reason: {result.get('eko_fail_reason')}")


class TestCompleteAction:
    """Tests for manual completion action"""
    
    def test_complete_action_works_on_pending_and_eko_failed(self, api_client):
        """Test that complete action works on pending and eko_failed requests"""
        # Get requests
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        # Find pending or eko_failed request
        completable_requests = [r for r in data["requests"] if r.get("status") in ["pending", "eko_failed"]]
        
        if not completable_requests:
            pytest.skip("No pending/eko_failed requests available for complete test")
            
        request_id = completable_requests[0]["request_id"]
        
        # Complete manually
        complete_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": request_id,
                "action": "complete",
                "admin_uid": ADMIN_UID,
                "admin_notes": "TEST: Manually completed via test",
                "txn_reference": f"TESTMANUAL{uuid.uuid4().hex[:8].upper()}"
            }
        )
        
        assert complete_response.status_code == 200
        result = complete_response.json()
        
        assert result.get("status") == "completed"
        assert "txn_number" in result
        print(f"✅ Request manually completed - TXN: {result.get('txn_number')}")
        
    def test_complete_action_fails_on_completed_request(self, api_client):
        """Test that complete action fails on already completed requests"""
        # Get completed requests
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        completed_requests = [r for r in data["requests"] if r.get("status") == "completed"]
        
        if not completed_requests:
            pytest.skip("No completed requests available")
            
        request_id = completed_requests[0]["request_id"]
        
        # Try to complete again
        complete_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/process",
            json={
                "request_id": request_id,
                "action": "complete",
                "admin_uid": ADMIN_UID
            }
        )
        
        assert complete_response.status_code == 400
        print("✅ Complete correctly rejected for already completed request")


class TestEkoFailedStatus:
    """Tests specific to eko_failed status handling"""
    
    def test_eko_failed_requests_have_fail_reason(self, api_client):
        """Test that eko_failed requests have eko_fail_reason field"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        eko_failed_requests = [r for r in data["requests"] if r.get("status") == "eko_failed"]
        
        if not eko_failed_requests:
            pytest.skip("No eko_failed requests available")
            
        req = eko_failed_requests[0]
        
        # Should have eko_fail_reason
        assert "eko_fail_reason" in req, "eko_failed request should have eko_fail_reason"
        print(f"✅ eko_failed request has fail reason: {req['eko_fail_reason']}")
        
    def test_eko_failed_requests_have_retry_attempts(self, api_client):
        """Test that eko_failed requests show retry_attempts field"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        eko_failed_requests = [r for r in data["requests"] if r.get("status") == "eko_failed"]
        
        if not eko_failed_requests:
            pytest.skip("No eko_failed requests available")
            
        req = eko_failed_requests[0]
        
        # Should have retry_attempts
        if "retry_attempts" in req:
            assert req["retry_attempts"] >= 1
            print(f"✅ eko_failed request has {req['retry_attempts']} retry attempts")


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
