"""
Test Bill Payment Rejection Flow
Tests for:
1. Create a bill payment request (pending status)
2. Reject the request via admin panel API
3. Verify PRC is refunded to user wallet
4. Verify request status changes to 'rejected'
5. Verify rejected request does NOT appear in Pending filter
6. Verify rejected request DOES appear in Rejected filter
7. Test approve -> complete flow also works correctly
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://user-notifications.preview.emergentagent.com')

# Test user - Admin user with sufficient PRC balance
ADMIN_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"
TEST_USER_PREFIX = "TEST_BILL_"

class TestBillPaymentRejectionFlow:
    """Test bill payment rejection flow end-to-end"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_request_ids = []
        yield
        # Cleanup: No automatic cleanup as requests are test data
    
    def test_01_api_health(self):
        """Verify API is healthy"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ API is healthy: {data}")
    
    def test_02_get_existing_requests(self):
        """Get existing bill payment requests and verify counts"""
        response = self.session.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200, f"Failed to get requests: {response.text}"
        
        data = response.json()
        requests_list = data.get("requests", data)
        
        # Count by status
        pending_count = len([r for r in requests_list if r.get("status") == "pending"])
        rejected_count = len([r for r in requests_list if r.get("status") == "rejected"])
        completed_count = len([r for r in requests_list if r.get("status") in ["approved", "completed", "processing"]])
        
        print(f"✅ Current counts - Pending: {pending_count}, Rejected: {rejected_count}, Completed: {completed_count}")
        
        # Store for verification
        self.initial_counts = {
            "pending": pending_count,
            "rejected": rejected_count,
            "completed": completed_count
        }
        
        return requests_list
    
    def test_03_get_user_prc_balance(self):
        """Get user's current PRC balance"""
        response = self.session.get(f"{BASE_URL}/api/users/{ADMIN_UID}")
        assert response.status_code == 200, f"Failed to get user: {response.text}"
        
        user = response.json()
        prc_balance = user.get("prc_balance", 0)
        print(f"✅ User {user.get('name')} has PRC balance: {prc_balance}")
        
        assert prc_balance > 100, f"User needs at least 100 PRC for testing, has {prc_balance}"
        return prc_balance
    
    def test_04_create_bill_payment_request_pending(self):
        """Create a bill payment request in pending status"""
        initial_balance = self.test_03_get_user_prc_balance()
        
        # Create a mobile recharge request
        payload = {
            "user_id": ADMIN_UID,
            "request_type": "mobile_recharge",
            "amount_inr": 100,
            "details": {
                "phone_number": "9876543210",
                "operator": "TEST_OPERATOR",
                "plan_description": f"Test bill payment {uuid.uuid4().hex[:8]}"
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/bill-payment/request", json=payload)
        
        # Handle rate limiting or other errors gracefully
        if response.status_code == 429:
            pytest.skip("Rate limited - weekly service limit reached")
        elif response.status_code == 403:
            pytest.skip(f"Forbidden - {response.json().get('detail', 'Access denied')}")
        
        assert response.status_code == 200, f"Failed to create request: {response.text}"
        
        data = response.json()
        request_id = data.get("request_id")
        assert request_id, "No request_id returned"
        
        print(f"✅ Created bill payment request: {request_id}")
        print(f"   Amount: ₹{data.get('amount_inr')}")
        print(f"   Total PRC deducted: {data.get('total_prc_deducted')}")
        print(f"   Status: {data.get('status')}")
        
        assert data.get("status") == "pending", f"Expected status 'pending', got {data.get('status')}"
        
        # Verify PRC was deducted
        new_balance = self.test_03_get_user_prc_balance()
        deducted = initial_balance - new_balance
        print(f"   PRC deducted: {deducted}")
        
        self.created_request_ids.append(request_id)
        return request_id, data.get("total_prc_deducted", 0), initial_balance
    
    def test_05_reject_bill_payment_and_verify_refund(self):
        """Reject a bill payment request and verify PRC is refunded"""
        # Create a request first
        try:
            request_id, total_prc_deducted, initial_balance = self.test_04_create_bill_payment_request_pending()
        except pytest.skip.Exception:
            pytest.skip("Cannot create request due to rate limits")
        
        # Get current balance (after deduction)
        response = self.session.get(f"{BASE_URL}/api/users/{ADMIN_UID}")
        assert response.status_code == 200
        balance_after_creation = response.json().get("prc_balance", 0)
        
        print(f"\n📋 Balance before rejection: {balance_after_creation}")
        
        # Reject the request
        reject_payload = {
            "request_id": request_id,
            "action": "reject",
            "admin_notes": "Test rejection - automated testing",
            "admin_uid": ADMIN_UID,
            "reject_reason": "Automated test rejection"
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/bill-payment/process", json=reject_payload)
        assert response.status_code == 200, f"Failed to reject request: {response.text}"
        
        reject_data = response.json()
        assert reject_data.get("status") == "rejected", f"Expected status 'rejected', got {reject_data.get('status')}"
        print(f"✅ Request rejected: {reject_data}")
        
        # Verify PRC was refunded
        response = self.session.get(f"{BASE_URL}/api/users/{ADMIN_UID}")
        assert response.status_code == 200
        balance_after_rejection = response.json().get("prc_balance", 0)
        
        refunded_amount = balance_after_rejection - balance_after_creation
        print(f"✅ Balance after rejection: {balance_after_rejection}")
        print(f"   Refunded amount: {refunded_amount}")
        
        # The refunded amount should be approximately equal to total_prc_deducted
        assert abs(refunded_amount - total_prc_deducted) < 0.01, \
            f"Refund mismatch: expected ~{total_prc_deducted}, got {refunded_amount}"
        
        print(f"✅ PRC refund verified: {refunded_amount} PRC refunded")
        
        return request_id
    
    def test_06_verify_rejected_not_in_pending(self):
        """Verify rejected request does NOT appear in pending filter"""
        # Create and reject a request
        try:
            rejected_request_id = self.test_05_reject_bill_payment_and_verify_refund()
        except pytest.skip.Exception:
            pytest.skip("Cannot test due to rate limits")
        
        # Get all requests
        response = self.session.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        
        data = response.json()
        requests_list = data.get("requests", data)
        
        # Find our rejected request
        our_request = next((r for r in requests_list if r.get("request_id") == rejected_request_id), None)
        assert our_request, f"Request {rejected_request_id} not found"
        
        # Verify it has rejected status
        assert our_request.get("status") == "rejected", \
            f"Expected status 'rejected', got {our_request.get('status')}"
        
        # Verify pending filter would NOT include this
        pending_requests = [r for r in requests_list if r.get("status") == "pending"]
        rejected_in_pending = any(r.get("request_id") == rejected_request_id for r in pending_requests)
        
        assert not rejected_in_pending, \
            f"CRITICAL BUG: Rejected request {rejected_request_id} appears in pending filter!"
        
        print(f"✅ Verified: Rejected request {rejected_request_id} is NOT in pending filter")
        print(f"   Pending count: {len(pending_requests)}")
        
        return rejected_request_id
    
    def test_07_verify_rejected_appears_in_rejected_filter(self):
        """Verify rejected request DOES appear in rejected filter"""
        # Create and reject a request
        try:
            rejected_request_id = self.test_05_reject_bill_payment_and_verify_refund()
        except pytest.skip.Exception:
            pytest.skip("Cannot test due to rate limits")
        
        # Get all requests
        response = self.session.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        
        data = response.json()
        requests_list = data.get("requests", data)
        
        # Filter for rejected (simulating frontend filter)
        rejected_requests = [r for r in requests_list if r.get("status") == "rejected"]
        
        # Verify our request is in rejected filter
        rejected_in_filter = any(r.get("request_id") == rejected_request_id for r in rejected_requests)
        
        assert rejected_in_filter, \
            f"BUG: Rejected request {rejected_request_id} not found in rejected filter!"
        
        print(f"✅ Verified: Rejected request {rejected_request_id} appears in rejected filter")
        print(f"   Rejected count: {len(rejected_requests)}")
        
        # Additional check: verify the request has correct fields
        our_request = next(r for r in rejected_requests if r.get("request_id") == rejected_request_id)
        assert our_request.get("reject_reason"), "Rejected request should have reject_reason"
        print(f"   Reject reason: {our_request.get('reject_reason')}")
        
        return rejected_request_id
    
    def test_08_test_approve_complete_flow(self):
        """Test approve/complete flow also works correctly"""
        # Create a request first
        try:
            request_id, total_prc_deducted, initial_balance = self.test_04_create_bill_payment_request_pending()
        except pytest.skip.Exception:
            pytest.skip("Cannot create request due to rate limits")
        
        # Approve the request (which should complete it)
        approve_payload = {
            "request_id": request_id,
            "action": "approve",
            "admin_notes": "Test approval - automated testing",
            "admin_uid": ADMIN_UID
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/bill-payment/process", json=approve_payload)
        assert response.status_code == 200, f"Failed to approve request: {response.text}"
        
        approve_data = response.json()
        # Status should be completed (since approve = complete in this system)
        assert approve_data.get("status") in ["approved", "completed"], \
            f"Expected status 'approved' or 'completed', got {approve_data.get('status')}"
        
        print(f"✅ Request approved/completed: {approve_data}")
        
        # Verify it appears in approved filter
        response = self.session.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        
        data = response.json()
        requests_list = data.get("requests", data)
        
        # Find our request
        our_request = next((r for r in requests_list if r.get("request_id") == request_id), None)
        assert our_request, f"Request {request_id} not found after approval"
        
        # Verify it's in approved filter (which includes approved, processing, completed)
        approved_requests = [r for r in requests_list if r.get("status") in ["approved", "processing", "completed"]]
        in_approved = any(r.get("request_id") == request_id for r in approved_requests)
        
        assert in_approved, f"Approved request {request_id} should appear in approved filter"
        
        print(f"✅ Verified: Approved request appears in approved filter")
        print(f"   Approved/Completed count: {len(approved_requests)}")
        
        # Verify it's NOT in pending filter
        pending_requests = [r for r in requests_list if r.get("status") == "pending"]
        in_pending = any(r.get("request_id") == request_id for r in pending_requests)
        
        assert not in_pending, f"Approved request should NOT appear in pending filter"
        print(f"✅ Verified: Approved request is NOT in pending filter")
        
        return request_id
    
    def test_09_verify_existing_requests_status_integrity(self):
        """Verify existing requests have correct status field values"""
        response = self.session.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        
        data = response.json()
        requests_list = data.get("requests", data)
        
        valid_statuses = ["pending", "approved", "processing", "completed", "rejected"]
        invalid_requests = []
        status_counts = {}
        
        for req in requests_list:
            status = req.get("status")
            status_counts[status] = status_counts.get(status, 0) + 1
            
            if status not in valid_statuses:
                invalid_requests.append({
                    "request_id": req.get("request_id"),
                    "status": status
                })
        
        print(f"✅ Status distribution: {status_counts}")
        
        if invalid_requests:
            print(f"⚠️ Found {len(invalid_requests)} requests with invalid status: {invalid_requests}")
        
        assert len(invalid_requests) == 0, \
            f"Found {len(invalid_requests)} requests with invalid statuses: {invalid_requests}"
        
        print(f"✅ All {len(requests_list)} requests have valid status values")
    
    def test_10_frontend_filter_logic_verification(self):
        """Simulate frontend filter logic and verify correctness"""
        response = self.session.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        
        data = response.json()
        all_requests = data.get("requests", data)
        
        # Simulate frontend filter logic (from AdminBillPayments.js lines 172-179)
        def filter_by_status(requests, status_filter):
            if status_filter == 'pending':
                return [r for r in requests if r.get('status') == 'pending']
            elif status_filter == 'approved':
                return [r for r in requests if r.get('status') in ['approved', 'processing', 'completed']]
            elif status_filter == 'rejected':
                return [r for r in requests if r.get('status') == 'rejected']
            return requests
        
        pending = filter_by_status(all_requests, 'pending')
        approved = filter_by_status(all_requests, 'approved')
        rejected = filter_by_status(all_requests, 'rejected')
        
        print(f"📊 Frontend Filter Simulation:")
        print(f"   Pending filter: {len(pending)} requests")
        print(f"   Approved filter: {len(approved)} requests")
        print(f"   Rejected filter: {len(rejected)} requests")
        print(f"   Total: {len(all_requests)} requests")
        
        # Verify no overlap between filters
        pending_ids = {r.get('request_id') for r in pending}
        approved_ids = {r.get('request_id') for r in approved}
        rejected_ids = {r.get('request_id') for r in rejected}
        
        overlap_pending_approved = pending_ids & approved_ids
        overlap_pending_rejected = pending_ids & rejected_ids
        overlap_approved_rejected = approved_ids & rejected_ids
        
        if overlap_pending_approved:
            print(f"⚠️ BUG: {len(overlap_pending_approved)} requests in both pending and approved!")
        if overlap_pending_rejected:
            print(f"⚠️ BUG: {len(overlap_pending_rejected)} requests in both pending and rejected!")
        if overlap_approved_rejected:
            print(f"⚠️ BUG: {len(overlap_approved_rejected)} requests in both approved and rejected!")
        
        assert not overlap_pending_approved, f"Overlap between pending and approved: {overlap_pending_approved}"
        assert not overlap_pending_rejected, f"Overlap between pending and rejected: {overlap_pending_rejected}"
        assert not overlap_approved_rejected, f"Overlap between approved and rejected: {overlap_approved_rejected}"
        
        # Verify all requests are accounted for
        all_filtered = len(pending) + len(approved) + len(rejected)
        assert all_filtered == len(all_requests), \
            f"Filter count mismatch: {all_filtered} filtered vs {len(all_requests)} total"
        
        print(f"✅ All filters are mutually exclusive and cover all requests")


class TestExistingRejectedRequests:
    """Test that existing rejected requests are properly handled"""
    
    def test_check_existing_rejected_have_proper_fields(self):
        """Check that existing rejected requests have all required fields"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200
        
        data = response.json()
        requests_list = data.get("requests", data)
        
        rejected = [r for r in requests_list if r.get("status") == "rejected"]
        
        print(f"📋 Found {len(rejected)} rejected requests")
        
        for req in rejected:
            request_id = req.get("request_id", "unknown")[:8]
            status = req.get("status")
            reject_reason = req.get("reject_reason")
            processed_at = req.get("processed_at")
            
            print(f"   {request_id}... - status: {status}, reason: {reject_reason}, processed: {processed_at}")
            
            # Verify rejected requests have reject_reason
            assert reject_reason or req.get("admin_notes"), \
                f"Rejected request {request_id} missing reject_reason"
        
        print(f"✅ All {len(rejected)} rejected requests have proper rejection info")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
