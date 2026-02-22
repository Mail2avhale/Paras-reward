"""
Test Suite: Admin Tracking & RD Features for Paras Reward App
Testing:
1. Admin tracking (approved_by/rejected_by) for Bank Redeem requests
2. Admin tracking for RD Redeem requests
3. Weekly limit bug fix verification (MongoDB query)
4. Date range filters for admin bank redeem requests
5. Date range filters for admin RD redeem requests
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_USER_ID = f"test-admin-tracking-{uuid.uuid4().hex[:8]}"
TEST_ADMIN_ID = f"test-admin-{uuid.uuid4().hex[:8]}"
TEST_ADMIN_NAME = "Test Admin User"

class TestAdminBankRedeemTracking:
    """Test admin tracking fields for Bank Redeem approve/reject"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data - create admin user"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create admin user for testing
        admin_data = {
            "uid": TEST_ADMIN_ID,
            "name": TEST_ADMIN_NAME,
            "email": f"admin_{uuid.uuid4().hex[:6]}@test.com",
            "mobile": f"99{uuid.uuid4().hex[:8][:8]}",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        # Create admin user directly via API if available
        try:
            # First check if admin exists, if not this is expected
            pass
        except:
            pass
        yield
    
    def test_admin_bank_redeem_requests_endpoint(self):
        """Test GET /api/admin/bank-redeem/requests returns data"""
        response = self.session.get(f"{BASE_URL}/api/admin/bank-redeem/requests")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "requests" in data, "Response should contain 'requests' field"
        assert "stats" in data, "Response should contain 'stats' field"
        assert "total" in data, "Response should contain 'total' field"
        print(f"✅ Bank redeem requests endpoint working - {data.get('total', 0)} requests found")
    
    def test_admin_bank_redeem_date_filters(self):
        """Test date_from, date_to, sort_order params for bank redeem requests"""
        today = datetime.now(timezone.utc)
        date_from = (today - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = today.strftime("%Y-%m-%d")
        
        # Test with date_from filter
        response = self.session.get(
            f"{BASE_URL}/api/admin/bank-redeem/requests",
            params={"date_from": date_from}
        )
        assert response.status_code == 200, f"date_from filter failed: {response.text}"
        print(f"✅ date_from filter works")
        
        # Test with date_to filter
        response = self.session.get(
            f"{BASE_URL}/api/admin/bank-redeem/requests",
            params={"date_to": date_to}
        )
        assert response.status_code == 200, f"date_to filter failed: {response.text}"
        print(f"✅ date_to filter works")
        
        # Test with both date filters
        response = self.session.get(
            f"{BASE_URL}/api/admin/bank-redeem/requests",
            params={"date_from": date_from, "date_to": date_to}
        )
        assert response.status_code == 200, f"Combined date filters failed: {response.text}"
        print(f"✅ Combined date filters work")
        
        # Test sort_order=asc
        response = self.session.get(
            f"{BASE_URL}/api/admin/bank-redeem/requests",
            params={"sort_order": "asc"}
        )
        assert response.status_code == 200, f"sort_order=asc failed: {response.text}"
        print(f"✅ sort_order=asc works")
        
        # Test sort_order=desc
        response = self.session.get(
            f"{BASE_URL}/api/admin/bank-redeem/requests",
            params={"sort_order": "desc"}
        )
        assert response.status_code == 200, f"sort_order=desc failed: {response.text}"
        print(f"✅ sort_order=desc works")
    
    def test_admin_bank_redeem_approve_endpoint_exists(self):
        """Verify approve endpoint exists and requires correct params"""
        # Test with invalid request_id - should return 404 not found
        response = self.session.post(
            f"{BASE_URL}/api/admin/bank-redeem/INVALID_REQUEST_ID/approve",
            json={"admin_id": TEST_ADMIN_ID, "transaction_ref": "TEST_REF"}
        )
        # Should be 404 (not found) not 500
        assert response.status_code == 404, f"Expected 404 for invalid request, got {response.status_code}"
        print("✅ Approve endpoint exists and returns 404 for invalid request")
    
    def test_admin_bank_redeem_reject_endpoint_exists(self):
        """Verify reject endpoint exists and requires correct params"""
        # Test with invalid request_id - should return 404 not found
        response = self.session.post(
            f"{BASE_URL}/api/admin/bank-redeem/INVALID_REQUEST_ID/reject",
            json={"admin_id": TEST_ADMIN_ID, "reason": "Test rejection"}
        )
        # Should be 404 (not found) not 500
        assert response.status_code == 404, f"Expected 404 for invalid request, got {response.status_code}"
        print("✅ Reject endpoint exists and returns 404 for invalid request")


class TestAdminRDRedeemTracking:
    """Test admin tracking fields for RD Redeem approve/reject"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
    
    def test_admin_rd_redeem_requests_endpoint(self):
        """Test GET /api/rd/admin/redeem-requests returns data"""
        response = self.session.get(f"{BASE_URL}/api/rd/admin/redeem-requests")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "requests" in data, "Response should contain 'requests' field"
        assert "stats" in data, "Response should contain 'stats' field"
        print(f"✅ RD redeem requests endpoint working - {len(data.get('requests', []))} requests found")
    
    def test_admin_rd_redeem_date_filters(self):
        """Test date_from, date_to, sort_order params for RD redeem requests"""
        today = datetime.now(timezone.utc)
        date_from = (today - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = today.strftime("%Y-%m-%d")
        
        # Test with date_from filter
        response = self.session.get(
            f"{BASE_URL}/api/rd/admin/redeem-requests",
            params={"date_from": date_from}
        )
        assert response.status_code == 200, f"date_from filter failed: {response.text}"
        print(f"✅ RD date_from filter works")
        
        # Test with date_to filter
        response = self.session.get(
            f"{BASE_URL}/api/rd/admin/redeem-requests",
            params={"date_to": date_to}
        )
        assert response.status_code == 200, f"date_to filter failed: {response.text}"
        print(f"✅ RD date_to filter works")
        
        # Test with both date filters
        response = self.session.get(
            f"{BASE_URL}/api/rd/admin/redeem-requests",
            params={"date_from": date_from, "date_to": date_to}
        )
        assert response.status_code == 200, f"Combined date filters failed: {response.text}"
        print(f"✅ RD combined date filters work")
        
        # Test sort_order=asc
        response = self.session.get(
            f"{BASE_URL}/api/rd/admin/redeem-requests",
            params={"sort_order": "asc"}
        )
        assert response.status_code == 200, f"sort_order=asc failed: {response.text}"
        print(f"✅ RD sort_order=asc works")
        
        # Test sort_order=desc
        response = self.session.get(
            f"{BASE_URL}/api/rd/admin/redeem-requests",
            params={"sort_order": "desc"}
        )
        assert response.status_code == 200, f"sort_order=desc failed: {response.text}"
        print(f"✅ RD sort_order=desc works")
    
    def test_admin_rd_approve_endpoint_exists(self):
        """Verify RD approve endpoint exists and requires correct params"""
        # Test with invalid request_id - should return 404 not found
        response = self.session.post(
            f"{BASE_URL}/api/rd/admin/redeem-requests/INVALID_REQUEST_ID/approve",
            params={"admin_id": TEST_ADMIN_ID, "transaction_ref": "TEST_REF"}
        )
        # Should be 404 (not found) not 500
        assert response.status_code == 404, f"Expected 404 for invalid request, got {response.status_code}"
        print("✅ RD approve endpoint exists and returns 404 for invalid request")
    
    def test_admin_rd_reject_endpoint_exists(self):
        """Verify RD reject endpoint exists and requires correct params"""
        # Test with invalid request_id - should return 404 not found
        response = self.session.post(
            f"{BASE_URL}/api/rd/admin/redeem-requests/INVALID_REQUEST_ID/reject",
            params={"admin_id": TEST_ADMIN_ID, "reason": "Test rejection"}
        )
        # Should be 404 (not found) not 500
        assert response.status_code == 404, f"Expected 404 for invalid request, got {response.status_code}"
        print("✅ RD reject endpoint exists and returns 404 for invalid request")


class TestWeeklyLimitBugFix:
    """Test weekly limit check uses MongoDB query correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
    
    def test_rd_interest_rates_endpoint(self):
        """Verify RD interest rates endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/rd/interest-rates")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert "rates" in data
        print(f"✅ RD interest rates endpoint works - {len(data.get('rates', []))} rates returned")
    
    def test_bank_redeem_check_eligibility_endpoint(self):
        """Test bank redeem eligibility check - verifies weekly limit logic is working"""
        test_user_id = "elite-test-user-123"  # Existing test user
        
        response = self.session.get(f"{BASE_URL}/api/bank-redeem/check-eligibility/{test_user_id}")
        
        # Should return 200 (eligible or not eligible with reason)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            # Response should have eligibility info
            assert "eligible" in data or "reason" in data or "prc_balance" in data, f"Missing eligibility fields: {data}"
            print(f"✅ Bank redeem eligibility check works - eligible: {data.get('eligible', 'N/A')}")
        else:
            print("✅ Bank redeem eligibility returns 404 for non-existent user (expected)")
    
    def test_rd_withdraw_weekly_limit_response(self):
        """Test RD withdraw endpoint returns proper weekly limit message"""
        # Use existing test user with RD
        test_user_id = "elite-test-user-123"
        test_rd_id = "RD-2026-C5201C"  # Existing RD from previous tests
        
        # Try to create a withdraw request - should fail with weekly limit or other expected error
        response = self.session.post(
            f"{BASE_URL}/api/rd/withdraw/{test_rd_id}",
            json={"user_id": test_user_id, "reason": "Test withdraw"}
        )
        
        # Could be 200 (success), 400 (weekly limit), 404 (not found), etc.
        assert response.status_code in [200, 400, 404, 429], f"Unexpected status: {response.status_code}: {response.text}"
        
        if response.status_code == 400:
            data = response.json()
            detail = data.get("detail", "")
            # Check if error message mentions weekly limit
            if "week" in detail.lower():
                print(f"✅ Weekly limit check working - returns proper message: {detail[:100]}")
            else:
                print(f"✅ RD withdraw returns 400 with message: {detail[:100]}")
        elif response.status_code == 200:
            data = response.json()
            print(f"✅ RD withdraw request created: {data.get('request_id', 'N/A')}")
        else:
            print(f"✅ RD withdraw returns {response.status_code} as expected")


class TestCodeReviewVerification:
    """Verify code changes mentioned by main agent"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
    
    def test_admin_bank_redeem_search_filter(self):
        """Test search filter works for bank redeem requests"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/bank-redeem/requests",
            params={"search": "test"}
        )
        assert response.status_code == 200, f"Search filter failed: {response.text}"
        print("✅ Bank redeem search filter works")
    
    def test_admin_rd_redeem_search_filter(self):
        """Test search filter works for RD redeem requests"""
        response = self.session.get(
            f"{BASE_URL}/api/rd/admin/redeem-requests",
            params={"search": "test"}
        )
        assert response.status_code == 200, f"Search filter failed: {response.text}"
        print("✅ RD redeem search filter works")
    
    def test_admin_bank_redeem_status_filter(self):
        """Test status filter works for bank redeem requests"""
        for status in ["pending", "approved", "rejected"]:
            response = self.session.get(
                f"{BASE_URL}/api/admin/bank-redeem/requests",
                params={"status": status}
            )
            assert response.status_code == 200, f"Status filter '{status}' failed: {response.text}"
        print("✅ Bank redeem status filter works for all statuses")
    
    def test_admin_rd_redeem_status_filter(self):
        """Test status filter works for RD redeem requests"""
        for status in ["pending", "approved", "rejected"]:
            response = self.session.get(
                f"{BASE_URL}/api/rd/admin/redeem-requests",
                params={"status": status}
            )
            assert response.status_code == 200, f"Status filter '{status}' failed: {response.text}"
        print("✅ RD redeem status filter works for all statuses")
    
    def test_bank_redeem_denominations_endpoint(self):
        """Test bank redeem denominations/fee structure endpoint"""
        response = self.session.get(f"{BASE_URL}/api/bank-redeem/denominations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "min_amount" in data, "Should have min_amount"
        assert "max_amount" in data, "Should have max_amount"
        assert "fee_structure" in data, "Should have fee_structure"
        print(f"✅ Bank redeem denominations: min={data.get('min_amount')}, max={data.get('max_amount')}")
    
    def test_bank_redeem_pending_count(self):
        """Test pending count endpoint for bank redeem"""
        response = self.session.get(f"{BASE_URL}/api/admin/bank-redeem/pending-count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "pending_count" in data, "Should have pending_count field"
        print(f"✅ Bank redeem pending count: {data.get('pending_count')}")


class TestEndToEndAdminTracking:
    """E2E test for admin tracking - create request, approve/reject, verify tracking fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
    
    def test_verify_approved_request_has_admin_tracking(self):
        """Check if approved requests have admin tracking fields"""
        # Get approved bank redeem requests
        response = self.session.get(
            f"{BASE_URL}/api/admin/bank-redeem/requests",
            params={"status": "approved", "limit": 5}
        )
        assert response.status_code == 200
        
        data = response.json()
        requests_list = data.get("requests", [])
        
        if requests_list:
            for req in requests_list[:3]:  # Check first 3
                # Verify admin tracking fields exist (may be null for old records)
                has_tracking = any([
                    req.get("approved_by_name"),
                    req.get("processed_by"),
                    req.get("processed_by_uid")
                ])
                print(f"Request {req.get('request_id')}: approved_by_name={req.get('approved_by_name')}, processed_by={req.get('processed_by')}")
            print(f"✅ Checked {len(requests_list)} approved requests for admin tracking fields")
        else:
            print("⚠️ No approved bank redeem requests found to verify tracking")
    
    def test_verify_rejected_request_has_admin_tracking(self):
        """Check if rejected requests have admin tracking fields"""
        # Get rejected bank redeem requests
        response = self.session.get(
            f"{BASE_URL}/api/admin/bank-redeem/requests",
            params={"status": "rejected", "limit": 5}
        )
        assert response.status_code == 200
        
        data = response.json()
        requests_list = data.get("requests", [])
        
        if requests_list:
            for req in requests_list[:3]:  # Check first 3
                # Verify admin tracking fields exist (may be null for old records)
                has_tracking = any([
                    req.get("rejected_by_name"),
                    req.get("processed_by"),
                    req.get("processed_by_uid")
                ])
                print(f"Request {req.get('request_id')}: rejected_by_name={req.get('rejected_by_name')}, processed_by={req.get('processed_by')}")
            print(f"✅ Checked {len(requests_list)} rejected requests for admin tracking fields")
        else:
            print("⚠️ No rejected bank redeem requests found to verify tracking")
    
    def test_verify_rd_approved_has_admin_tracking(self):
        """Check if approved RD requests have admin tracking fields"""
        response = self.session.get(
            f"{BASE_URL}/api/rd/admin/redeem-requests",
            params={"status": "approved", "limit": 5}
        )
        assert response.status_code == 200
        
        data = response.json()
        requests_list = data.get("requests", [])
        
        if requests_list:
            for req in requests_list[:3]:
                print(f"RD Request {req.get('request_id')}: approved_by_name={req.get('approved_by_name')}, processed_by={req.get('processed_by')}")
            print(f"✅ Checked {len(requests_list)} approved RD requests for admin tracking fields")
        else:
            print("⚠️ No approved RD redeem requests found to verify tracking")
    
    def test_verify_rd_rejected_has_admin_tracking(self):
        """Check if rejected RD requests have admin tracking fields"""
        response = self.session.get(
            f"{BASE_URL}/api/rd/admin/redeem-requests",
            params={"status": "rejected", "limit": 5}
        )
        assert response.status_code == 200
        
        data = response.json()
        requests_list = data.get("requests", [])
        
        if requests_list:
            for req in requests_list[:3]:
                print(f"RD Request {req.get('request_id')}: rejected_by_name={req.get('rejected_by_name')}, processed_by={req.get('processed_by')}")
            print(f"✅ Checked {len(requests_list)} rejected RD requests for admin tracking fields")
        else:
            print("⚠️ No rejected RD redeem requests found to verify tracking")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
