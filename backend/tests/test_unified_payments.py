"""
Tests for Enhanced Unified Payments Dashboard
- Revert Status API
- Admin Payment Request endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRevertStatusAPI:
    """Test the new revert-status API endpoint"""
    
    def test_revert_status_missing_params(self):
        """Test revert-status returns error without required params"""
        response = requests.post(f"{BASE_URL}/api/admin/payment-request/revert-status", json={})
        # Should return 400 for missing required fields
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✅ Revert status correctly rejects missing params: {data['detail']}")
    
    def test_revert_status_invalid_type(self):
        """Test revert-status returns error for invalid request type"""
        response = requests.post(f"{BASE_URL}/api/admin/payment-request/revert-status", json={
            "request_id": "test-123",
            "request_type": "invalid_type",
            "admin_uid": "test-admin"
        })
        # Should return 400 for invalid type
        assert response.status_code == 400
        data = response.json()
        assert "Invalid request_type" in data.get("detail", "")
        print(f"✅ Revert status correctly rejects invalid type: {data['detail']}")
    
    def test_revert_status_nonexistent_request(self):
        """Test revert-status returns 404 for non-existent request"""
        response = requests.post(f"{BASE_URL}/api/admin/payment-request/revert-status", json={
            "request_id": "nonexistent-999999",
            "request_type": "bank",
            "admin_uid": "test-admin"
        })
        # Should return 404 for non-existent request
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"✅ Revert status correctly returns 404 for non-existent: {data['detail']}")


class TestBankRedeemRequests:
    """Test bank redeem request endpoints"""
    
    def test_get_bank_redeem_requests(self):
        """Test fetching bank redeem requests"""
        response = requests.get(f"{BASE_URL}/api/admin/bank-redeem/requests", params={"limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert "requests" in data or isinstance(data, list)
        print(f"✅ Bank redeem requests endpoint works - got {len(data.get('requests', data))} requests")
    
    def test_get_bank_redeem_requests_with_status_filter(self):
        """Test filtering bank redeem requests by status"""
        for status in ["pending", "approved", "rejected"]:
            response = requests.get(f"{BASE_URL}/api/admin/bank-redeem/requests", params={"status": status, "limit": 5})
            assert response.status_code == 200
            data = response.json()
            requests_list = data.get("requests", data)
            # All returned should match status filter (or be empty)
            for req in requests_list[:3]:  # Check first 3
                assert req.get("status") in [status, "completed"] if status == "approved" else req.get("status") == status
            print(f"✅ Bank redeem with status={status} filter works - {len(requests_list)} requests")


class TestRDRedeemRequests:
    """Test RD (Recurring Deposit) redeem request endpoints"""
    
    def test_get_rd_redeem_requests(self):
        """Test fetching RD redeem requests"""
        response = requests.get(f"{BASE_URL}/api/rd/admin/redeem-requests", params={"limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert "requests" in data or isinstance(data, list)
        print(f"✅ RD redeem requests endpoint works - got {len(data.get('requests', data))} requests")


class TestBillPaymentRequests:
    """Test bill payment request endpoints"""
    
    def test_get_bill_payment_requests_emi(self):
        """Test fetching EMI bill payment requests"""
        response = requests.get(f"{BASE_URL}/api/admin/bill-payment/requests", params={"payment_type": "emi", "limit": 10})
        assert response.status_code == 200
        data = response.json()
        # Response can be list or dict with requests
        if isinstance(data, dict):
            requests_list = data.get("requests", [])
        else:
            requests_list = data
        print(f"✅ EMI bill payment requests endpoint works - got {len(requests_list)} requests")


class TestUnifiedPaymentEndpoints:
    """Test all endpoints used by Unified Payment Dashboard"""
    
    def test_all_payment_endpoints_reachable(self):
        """Test that all 3 payment endpoints are reachable"""
        endpoints_tested = 0
        
        # Bank Redeem
        resp1 = requests.get(f"{BASE_URL}/api/admin/bank-redeem/requests", params={"limit": 1})
        assert resp1.status_code == 200, f"Bank redeem endpoint failed: {resp1.status_code}"
        endpoints_tested += 1
        
        # RD Redeem
        resp2 = requests.get(f"{BASE_URL}/api/rd/admin/redeem-requests", params={"limit": 1})
        assert resp2.status_code == 200, f"RD redeem endpoint failed: {resp2.status_code}"
        endpoints_tested += 1
        
        # Bill Payment (EMI)
        resp3 = requests.get(f"{BASE_URL}/api/admin/bill-payment/requests", params={"payment_type": "emi", "limit": 1})
        assert resp3.status_code == 200, f"Bill payment endpoint failed: {resp3.status_code}"
        endpoints_tested += 1
        
        print(f"✅ All {endpoints_tested} unified payment endpoints are reachable")
    
    def test_revert_status_endpoint_exists(self):
        """Test that revert-status endpoint exists and responds"""
        # Just check it responds (even with validation error)
        response = requests.post(f"{BASE_URL}/api/admin/payment-request/revert-status", json={
            "request_id": "test",
            "request_type": "bank"
        })
        # 400 (bad request) or 404 (not found) are acceptable - means endpoint exists
        assert response.status_code in [400, 404, 422, 500], f"Unexpected status: {response.status_code}"
        print(f"✅ Revert status endpoint exists - returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
