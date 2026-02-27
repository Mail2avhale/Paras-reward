"""
Test Admin Bill Payment Approval Flow
Tests the approve → approved_manual flow when Eko API fails (403 - IP not whitelisted)

Features tested:
1. GET /api/admin/bill-payment/requests - List requests with approved_manual status
2. POST /api/admin/bill-payment/process - Approve action (should result in approved_manual when Eko fails)
3. POST /api/admin/bill-payment/complete - Manual completion for approved_manual requests
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
        
    def test_list_includes_approved_manual_status(self, api_client):
        """Test that approved_manual status requests are included in the list"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        data = response.json()
        
        # Find approved_manual requests
        approved_manual_requests = [r for r in data["requests"] if r.get("status") == "approved_manual"]
        
        # We expect some approved_manual requests based on existing data
        assert len(approved_manual_requests) > 0, "Expected at least one approved_manual request"
        
        # Verify structure of approved_manual request
        first_manual = approved_manual_requests[0]
        assert "request_id" in first_manual
        assert "status" in first_manual
        assert first_manual["status"] == "approved_manual"
        
    def test_approved_manual_has_eko_fail_reason(self, api_client):
        """Test that approved_manual requests have eko_fail_reason field"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        # Find approved_manual requests
        approved_manual_requests = [r for r in data["requests"] if r.get("status") == "approved_manual"]
        
        # At least one should have eko_fail_reason
        requests_with_reason = [r for r in approved_manual_requests if r.get("eko_fail_reason")]
        assert len(requests_with_reason) > 0, "Expected approved_manual request with eko_fail_reason"
        
        # Verify the reason contains expected error
        reasons = [r.get("eko_fail_reason", "") for r in requests_with_reason]
        has_ip_error = any("IP" in reason or "whitelist" in reason.lower() for reason in reasons)
        assert has_ip_error, f"Expected 'IP not whitelisted' error in reasons: {reasons}"


class TestAdminBillPaymentProcess:
    """Tests for POST /api/admin/bill-payment/process"""
    
    def test_approve_pending_request_returns_approved_manual(self, api_client):
        """Test that approving a pending request results in approved_manual when Eko fails"""
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
        
        # Since Eko API fails (IP not whitelisted), status should be approved_manual
        # OR completed if Eko happens to work
        assert result.get("status") in ["approved_manual", "completed"], \
            f"Expected status 'approved_manual' or 'completed', got: {result.get('status')}"
        
        # If approved_manual, should have eko_fail_reason
        if result.get("status") == "approved_manual":
            assert "eko_fail_reason" in result, "Expected eko_fail_reason in approved_manual response"
            print(f"✅ Request approved as 'approved_manual' - Eko fail reason: {result.get('eko_fail_reason')}")
        else:
            print(f"✅ Request completed successfully via Eko")
            
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


class TestAdminBillPaymentComplete:
    """Tests for POST /api/admin/bill-payment/complete"""
    
    def test_complete_approved_manual_request(self, api_client):
        """Test manual completion of approved_manual request"""
        # Get an approved_manual request
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        approved_manual = [r for r in data["requests"] if r.get("status") == "approved_manual"]
        
        if not approved_manual:
            pytest.skip("No approved_manual requests available for testing")
            
        request_id = approved_manual[0]["request_id"]
        
        # Complete the request
        complete_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/complete",
            json={
                "request_id": request_id,
                "admin_uid": ADMIN_UID
            }
        )
        
        assert complete_response.status_code == 200
        result = complete_response.json()
        
        assert result.get("status") == "completed"
        assert "txn_number" in result
        assert "message" in result
        
        print(f"✅ Request {request_id} manually completed. TXN: {result.get('txn_number')}")
        
    def test_complete_already_completed_request_fails(self, api_client):
        """Test that completing an already completed request fails"""
        # Get a completed request
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        completed = [r for r in data["requests"] if r.get("status") == "completed"]
        
        if not completed:
            pytest.skip("No completed requests available for testing")
            
        request_id = completed[0]["request_id"]
        
        # Try to complete again
        complete_response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/complete",
            json={
                "request_id": request_id,
                "admin_uid": ADMIN_UID
            }
        )
        
        assert complete_response.status_code == 400
        assert "cannot complete" in complete_response.json().get("detail", "").lower()
        
    def test_complete_non_existent_request_returns_404(self, api_client):
        """Test completing non-existent request returns 404"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/bill-payment/complete",
            json={
                "request_id": "non-existent-request-id",
                "admin_uid": ADMIN_UID
            }
        )
        assert response.status_code == 404


class TestApprovalFlowStatusTransitions:
    """Tests for status transitions in approval flow"""
    
    def test_status_values_are_valid(self, api_client):
        """Test that all status values are one of the expected values"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        valid_statuses = ["pending", "approved", "approved_manual", "completed", "rejected", "processing"]
        
        for request in data["requests"]:
            status = request.get("status")
            assert status in valid_statuses, f"Invalid status '{status}' found"
            
    def test_approved_manual_has_required_fields(self, api_client):
        """Test approved_manual requests have all required fields for admin UI"""
        response = api_client.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        data = response.json()
        
        approved_manual = [r for r in data["requests"] if r.get("status") == "approved_manual"]
        
        if not approved_manual:
            pytest.skip("No approved_manual requests available")
            
        request = approved_manual[0]
        
        # Required fields for admin UI (must exist in response)
        required_fields = ["request_id", "status", "amount_inr", "request_type"]
        for field in required_fields:
            assert field in request, f"Missing required field '{field}' in approved_manual request"
        
        # user_name may be None in some cases (user deleted), but field should exist
        assert "user_name" in request or request.get("user_email"), "Missing user identifier fields"
            
        # Optional but expected fields for approved_manual
        expected_fields = ["eko_fail_reason", "approved_at", "txn_number"]
        for field in expected_fields:
            if field in request:
                print(f"  ✓ Has {field}: {request.get(field)}")


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
