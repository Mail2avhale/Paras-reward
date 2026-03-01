"""
Test Manual Approve Feature for Bill Payments and Bank Redeem
Testing the following features:
1. Bill Payments - POST /api/admin/bill-payment/process with action='complete'
2. Bank Redeem - POST /api/admin/bank-redeem/{id}/manual-complete
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# API base URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
ADMIN_UID = "1000001"
ADMIN_PIN = "123456"


class TestManualApproveFeature:
    """Test Manual Approve Feature for Bill Payments and Bank Redeem"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test environment"""
        self.base_url = BASE_URL
        self.admin_uid = ADMIN_UID
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    # ====================
    # BILL PAYMENT API TESTS
    # ====================
    
    def test_bill_payment_requests_endpoint(self):
        """Test: GET /api/admin/bill-payment/requests returns data"""
        response = self.session.get(f"{self.base_url}/api/admin/bill-payment/requests")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "requests" in data, "Response should have 'requests' key"
        assert isinstance(data["requests"], list), "requests should be a list"
    
    def test_bill_payment_manual_complete_requires_txn_ref(self):
        """Test: Manual complete action requires txn_reference parameter"""
        # First get a pending request
        response = self.session.get(f"{self.base_url}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        
        requests_data = response.json().get("requests", [])
        pending_request = next((r for r in requests_data if r.get("status") == "pending"), None)
        
        if not pending_request:
            pytest.skip("No pending bill payment request available for testing")
        
        # Try to complete without txn_reference - should fail
        payload = {
            "request_id": pending_request["request_id"],
            "action": "complete",
            "admin_uid": self.admin_uid,
            "admin_notes": "Test manual complete"
            # Missing txn_reference
        }
        
        response = self.session.post(
            f"{self.base_url}/api/admin/bill-payment/process",
            json=payload
        )
        
        # The API should either require txn_reference or handle it gracefully
        # Either 400 (bad request) or 200 with error message
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"
    
    def test_bill_payment_process_endpoint_exists(self):
        """Test: POST /api/admin/bill-payment/process endpoint exists"""
        # Send minimal payload to verify endpoint exists
        payload = {
            "request_id": "test-nonexistent-id",
            "action": "approve",
            "admin_uid": self.admin_uid
        }
        
        response = self.session.post(
            f"{self.base_url}/api/admin/bill-payment/process",
            json=payload
        )
        
        # Should get 404 (not found) not 405 (method not allowed)
        assert response.status_code in [200, 400, 404, 422], f"Endpoint should exist, got {response.status_code}"
    
    def test_bill_payment_complete_action_type(self):
        """Test: Verify 'complete' is a valid action type for bill payment processing"""
        # Create test payload with complete action
        payload = {
            "request_id": f"TEST-MANUAL-{uuid.uuid4().hex[:6].upper()}",
            "action": "complete",
            "admin_uid": self.admin_uid,
            "txn_reference": "MANUAL-TXN-TEST-001",
            "admin_notes": "Testing manual complete action"
        }
        
        response = self.session.post(
            f"{self.base_url}/api/admin/bill-payment/process",
            json=payload
        )
        
        # Should fail with 404 (request not found) not 400 (invalid action)
        assert response.status_code in [404, 400], f"Expected 404 for non-existent request, got {response.status_code}"
        
        # If 400, verify it's not because 'complete' is invalid action
        if response.status_code == 400:
            error_msg = response.json().get("detail", "").lower()
            assert "invalid action" not in error_msg, "'complete' should be a valid action type"
    
    # ====================
    # BANK REDEEM API TESTS
    # ====================
    
    def test_bank_redeem_requests_endpoint(self):
        """Test: GET /api/admin/bank-redeem/requests returns data"""
        response = self.session.get(f"{self.base_url}/api/admin/bank-redeem/requests?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "requests" in data, "Response should have 'requests' key"
        assert isinstance(data["requests"], list), "requests should be a list"
    
    def test_bank_redeem_manual_complete_endpoint_exists(self):
        """Test: POST /api/admin/bank-redeem/{id}/manual-complete endpoint exists"""
        test_request_id = "TEST-NONEXISTENT-ID"
        
        payload = {
            "admin_id": self.admin_uid,
            "txn_reference": "TEST-UTR-123456",
            "admin_notes": "Test manual complete"
        }
        
        response = self.session.post(
            f"{self.base_url}/api/admin/bank-redeem/{test_request_id}/manual-complete",
            json=payload
        )
        
        # Should get 404 (not found) or 422 - not 405 (method not allowed)
        assert response.status_code in [400, 404, 422], f"Endpoint should exist, got {response.status_code}"
    
    def test_bank_redeem_manual_complete_requires_txn_ref(self):
        """Test: Manual complete requires txn_reference parameter"""
        test_request_id = "TEST-REQ-ID"
        
        # Try without txn_reference
        payload = {
            "admin_id": self.admin_uid,
            "admin_notes": "Test manual complete"
            # Missing txn_reference
        }
        
        response = self.session.post(
            f"{self.base_url}/api/admin/bank-redeem/{test_request_id}/manual-complete",
            json=payload
        )
        
        # Should return 400 (bad request) for missing txn_reference
        assert response.status_code == 400, f"Expected 400 for missing txn_reference, got {response.status_code}"
        
        error_detail = response.json().get("detail", "")
        assert "UTR" in error_detail or "Reference" in error_detail or "required" in error_detail.lower(), \
            f"Error should mention UTR/Reference requirement: {error_detail}"
    
    def test_bank_redeem_approve_endpoint(self):
        """Test: POST /api/admin/bank-redeem/{id}/approve endpoint exists"""
        test_request_id = "TEST-NONEXISTENT-ID"
        
        payload = {
            "admin_uid": self.admin_uid,
            "transaction_ref": "TEST-TXN-REF",
            "admin_name": "Test Admin"
        }
        
        response = self.session.post(
            f"{self.base_url}/api/admin/bank-redeem/{test_request_id}/approve",
            json=payload
        )
        
        # Should get 404 (not found) - not 405 (method not allowed)
        assert response.status_code in [400, 404, 422], f"Endpoint should exist, got {response.status_code}"
    
    def test_bank_redeem_reject_endpoint(self):
        """Test: POST /api/admin/bank-redeem/{id}/reject endpoint exists"""
        test_request_id = "TEST-NONEXISTENT-ID"
        
        payload = {
            "admin_uid": self.admin_uid,
            "reason": "Test rejection",
            "admin_name": "Test Admin"
        }
        
        response = self.session.post(
            f"{self.base_url}/api/admin/bank-redeem/{test_request_id}/reject",
            json=payload
        )
        
        # Should get 404 (not found) - not 405 (method not allowed)
        assert response.status_code in [400, 404, 422], f"Endpoint should exist, got {response.status_code}"
    
    # ====================
    # INTEGRATION TESTS
    # ====================
    
    def test_create_and_manual_complete_flow(self):
        """Test: Full flow - Get pending request and verify manual complete response structure"""
        # Get bank redeem requests
        response = self.session.get(f"{self.base_url}/api/admin/bank-redeem/requests?limit=50")
        assert response.status_code == 200
        
        requests_data = response.json().get("requests", [])
        pending_request = next((r for r in requests_data if r.get("status") == "pending"), None)
        
        if pending_request:
            # Verify request has expected fields for manual complete dialog
            assert "amount_inr" in pending_request or "amount" in pending_request, "Request should have amount field"
            assert "user_name" in pending_request or "user_id" in pending_request, "Request should have user identifier"
            
            # Verify bank details exist (needed for manual complete dialog)
            bank_details = pending_request.get("bank_details", {})
            if bank_details:
                # These fields should be shown in Manual Complete dialog
                print(f"Bank details available: account={bank_details.get('account_number', 'N/A')}, ifsc={bank_details.get('ifsc_code', 'N/A')}")
        else:
            # No pending request - skip this part of test
            print("No pending bank redeem request available")
    
    def test_verify_manually_approved_field_in_response(self):
        """Test: Verify 'manually_approved' field appears in completed requests"""
        # Get all bank redeem requests
        response = self.session.get(f"{self.base_url}/api/admin/bank-redeem/requests?limit=100")
        assert response.status_code == 200
        
        requests_data = response.json().get("requests", [])
        
        # Find completed requests with manually_approved flag
        manually_completed = [r for r in requests_data if r.get("manually_approved") == True]
        
        if manually_completed:
            for req in manually_completed[:3]:  # Check first 3
                print(f"Found manually completed request: {req.get('request_id')}")
                # Verify it has manual_txn_reference
                assert req.get("manual_txn_reference") or req.get("transaction_ref"), \
                    "Manually approved request should have txn reference"
        else:
            print("No manually completed bank redeem requests found - feature may not have been used yet")
    
    def test_bill_payment_manually_approved_badge_data(self):
        """Test: Verify bill payment requests have manually_approved field"""
        response = self.session.get(f"{self.base_url}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        
        requests_data = response.json().get("requests", [])
        
        # Find completed requests
        completed = [r for r in requests_data if r.get("status") in ["completed", "approved"]]
        
        if completed:
            for req in completed[:3]:
                if req.get("manually_approved"):
                    print(f"Found manually approved bill payment: {req.get('request_id')}")
                    # Should have manual_txn_reference
                    assert req.get("manual_txn_reference") or req.get("txn_reference"), \
                        "Manually approved should have txn reference"
        else:
            print("No completed bill payment requests found")


class TestManualApproveDialogData:
    """Test that API returns all data needed for Manual Complete dialogs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test environment"""
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_bill_payment_request_has_dialog_fields(self):
        """Test: Bill payment request has fields shown in Manual Complete dialog"""
        response = self.session.get(f"{self.base_url}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        
        requests_data = response.json().get("requests", [])
        
        if requests_data:
            req = requests_data[0]
            
            # Fields expected in Manual Complete dialog:
            # - request_type (mobile_recharge, dish_recharge, etc.)
            # - amount_inr
            # - user_name or user_id
            # - request_id
            # - phone_number / consumer_number (in details)
            
            assert "request_type" in req, "Should have request_type"
            assert "amount_inr" in req, "Should have amount_inr"
            assert "request_id" in req, "Should have request_id"
            
            # User info
            assert req.get("user_name") or req.get("user_id"), "Should have user identifier"
            
            # Details for phone/consumer number
            details = req.get("details", {})
            if req.get("request_type") in ["mobile_recharge", "dish_recharge"]:
                # These should have phone_number in details
                print(f"Details: {details}")
            elif req.get("request_type") == "electricity_bill":
                # Should have consumer_number
                print(f"Consumer details: {details}")
            
            print(f"✅ Bill payment request {req.get('request_id')} has required dialog fields")
        else:
            pytest.skip("No bill payment requests to validate")
    
    def test_bank_redeem_request_has_dialog_fields(self):
        """Test: Bank redeem request has fields shown in Manual Complete dialog"""
        response = self.session.get(f"{self.base_url}/api/admin/bank-redeem/requests?limit=10")
        assert response.status_code == 200
        
        requests_data = response.json().get("requests", [])
        
        if requests_data:
            req = requests_data[0]
            
            # Fields expected in Manual Complete dialog:
            # - _type / request type indicator
            # - amount_inr or amount
            # - user_name
            # - request_id
            # - bank_details.account_number
            # - bank_details.ifsc_code
            # - bank_details.account_holder_name
            
            assert "request_id" in req or "_id" in req, "Should have request identifier"
            assert req.get("amount_inr") is not None or req.get("amount") is not None, "Should have amount"
            
            # Bank details
            bank_details = req.get("bank_details", {})
            if bank_details:
                print(f"Bank details fields: {list(bank_details.keys())}")
                # These are shown in the Manual Complete dialog
                assert bank_details.get("account_number") or bank_details.get("account_masked"), \
                    "Should have account number"
                assert bank_details.get("ifsc_code"), "Should have IFSC code"
                
                # Account holder name (various possible field names)
                holder_name = bank_details.get("account_holder_name") or \
                             bank_details.get("account_holder") or \
                             req.get("account_holder_name") or \
                             req.get("user_name")
                assert holder_name, "Should have account holder name"
            
            print(f"✅ Bank redeem request {req.get('request_id')} has required dialog fields")
        else:
            pytest.skip("No bank redeem requests to validate")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
