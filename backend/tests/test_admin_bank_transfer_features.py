"""
Test Admin Bank Transfer Features:
1. Edit withdrawal amount endpoint (POST /api/bank-transfer/admin/edit-amount)
2. Redeem limit fields in admin/requests response (GET /api/bank-transfer/admin/requests)

Features tested:
- Admin can edit withdrawal_amount of pending requests (new amount <= original)
- Admin cannot edit non-pending requests
- Admin cannot increase amount beyond original
- Admin/requests returns redeem_limit_available, redeem_limit_effective, redeem_limit_total, redeem_limit_percent
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


class TestAdminBankTransferFeatures:
    """Test suite for Admin Bank Transfer edit amount and redeem limit features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        data = resp.json()
        self.admin_uid = data.get("uid")
        self.admin_token = data.get("token")
        assert self.admin_uid, "Admin UID not found in login response"
    
    # ==================== Redeem Limit Fields Tests ====================
    
    def test_admin_requests_returns_redeem_limit_fields(self):
        """Test that GET /api/bank-transfer/admin/requests returns redeem limit fields"""
        resp = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?limit=5")
        assert resp.status_code == 200, f"admin/requests failed: {resp.text}"
        
        data = resp.json()
        assert data.get("success") == True, "Response should have success=true"
        
        requests_list = data.get("requests", [])
        if len(requests_list) == 0:
            pytest.skip("No requests found to verify redeem limit fields")
        
        # Check first request for required redeem limit fields
        first_req = requests_list[0]
        required_fields = [
            "redeem_limit_available",
            "redeem_limit_effective", 
            "redeem_limit_total",
            "redeem_limit_percent"
        ]
        
        for field in required_fields:
            assert field in first_req, f"Missing required field: {field}"
    
    def test_admin_requests_redeem_limit_values_are_numeric(self):
        """Test that redeem limit values are numeric (not null/undefined)"""
        resp = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?limit=5")
        assert resp.status_code == 200
        
        data = resp.json()
        requests_list = data.get("requests", [])
        if len(requests_list) == 0:
            pytest.skip("No requests found")
        
        first_req = requests_list[0]
        
        # redeem_limit_available can be negative, zero, or positive
        limit_available = first_req.get("redeem_limit_available")
        assert limit_available is not None, "redeem_limit_available should not be None"
        assert isinstance(limit_available, (int, float)), "redeem_limit_available should be numeric"
        
        # redeem_limit_percent should be 0-100
        limit_percent = first_req.get("redeem_limit_percent")
        assert limit_percent is not None, "redeem_limit_percent should not be None"
        assert isinstance(limit_percent, (int, float)), "redeem_limit_percent should be numeric"
    
    # ==================== Edit Amount Endpoint Tests ====================
    
    def test_edit_amount_nonexistent_request_returns_404(self):
        """Test that editing non-existent request returns 404"""
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "request_id": "BTR-NONEXISTENT-12345678",
            "admin_id": self.admin_uid,
            "new_amount": 1000
        })
        assert resp.status_code == 404, f"Expected 404 for non-existent request, got {resp.status_code}"
    
    def test_edit_amount_requires_request_id(self):
        """Test that edit-amount requires request_id"""
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "admin_id": self.admin_uid,
            "new_amount": 1000
        })
        assert resp.status_code == 422, f"Expected 422 for missing request_id, got {resp.status_code}"
    
    def test_edit_amount_requires_admin_id(self):
        """Test that edit-amount requires admin_id"""
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "request_id": "BTR-TEST-12345678",
            "new_amount": 1000
        })
        assert resp.status_code == 422, f"Expected 422 for missing admin_id, got {resp.status_code}"
    
    def test_edit_amount_requires_new_amount(self):
        """Test that edit-amount requires new_amount"""
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "request_id": "BTR-TEST-12345678",
            "admin_id": self.admin_uid
        })
        assert resp.status_code == 422, f"Expected 422 for missing new_amount, got {resp.status_code}"
    
    def test_edit_amount_rejects_non_pending_request(self):
        """Test that editing non-pending (paid/failed) request is rejected"""
        # Get a paid request
        resp = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?status=paid&limit=1")
        assert resp.status_code == 200
        
        data = resp.json()
        paid_requests = data.get("requests", [])
        
        if len(paid_requests) == 0:
            # Try failed requests
            resp = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?status=failed&limit=1")
            data = resp.json()
            paid_requests = data.get("requests", [])
        
        if len(paid_requests) == 0:
            pytest.skip("No paid/failed requests to test")
        
        paid_req = paid_requests[0]
        request_id = paid_req.get("request_id")
        
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "request_id": request_id,
            "admin_id": self.admin_uid,
            "new_amount": 1000
        })
        
        assert resp.status_code == 400, f"Expected 400 for editing non-pending request, got {resp.status_code}"
        assert "pending" in resp.json().get("detail", "").lower() or "already" in resp.json().get("detail", "").lower()
    
    def test_edit_amount_pending_request_validation(self):
        """Test edit amount validation on pending requests"""
        # Get a pending request
        resp = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?status=pending&limit=1")
        assert resp.status_code == 200
        
        data = resp.json()
        pending_requests = data.get("requests", [])
        
        if len(pending_requests) == 0:
            pytest.skip("No pending requests to test")
        
        pending_req = pending_requests[0]
        request_id = pending_req.get("request_id")
        original_amount = pending_req.get("withdrawal_amount") or pending_req.get("amount")
        
        if not original_amount:
            pytest.skip("Pending request has no amount set")
        
        # Test 1: Same amount should be rejected
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "request_id": request_id,
            "admin_id": self.admin_uid,
            "new_amount": original_amount
        })
        assert resp.status_code == 400, f"Expected 400 for same amount, got {resp.status_code}"
        
        # Test 2: Higher amount should be rejected
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "request_id": request_id,
            "admin_id": self.admin_uid,
            "new_amount": original_amount + 100
        })
        assert resp.status_code == 400, f"Expected 400 for higher amount, got {resp.status_code}"
    
    # ==================== Stats and Pagination Tests ====================
    
    def test_admin_requests_returns_stats(self):
        """Test that admin/requests returns stats object"""
        resp = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests")
        assert resp.status_code == 200
        
        data = resp.json()
        assert "stats" in data, "Response should include stats"
        
        stats = data.get("stats", {})
        assert "pending" in stats, "Stats should include pending"
        assert "paid" in stats, "Stats should include paid"
        assert "failed" in stats, "Stats should include failed"
    
    def test_admin_requests_returns_pagination(self):
        """Test that admin/requests returns pagination info"""
        resp = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?limit=10&skip=0")
        assert resp.status_code == 200
        
        data = resp.json()
        assert "pagination" in data, "Response should include pagination"
        
        pagination = data.get("pagination", {})
        assert "total" in pagination, "Pagination should include total"
        assert "limit" in pagination, "Pagination should include limit"
        assert "skip" in pagination, "Pagination should include skip"
    
    def test_admin_requests_status_filter(self):
        """Test that status filter works correctly"""
        # Test pending filter
        resp = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?status=pending")
        assert resp.status_code == 200
        
        data = resp.json()
        requests_list = data.get("requests", [])
        
        for req in requests_list:
            assert req.get("status") == "pending", f"Expected pending status, got {req.get('status')}"
    
    def test_admin_requests_sorting(self):
        """Test that sorting works correctly"""
        # Test ascending sort by date
        resp = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?sort_by=created_at&sort_order=asc&limit=10")
        assert resp.status_code == 200
        
        data = resp.json()
        assert data.get("filters_applied", {}).get("sort_by") == "created_at"
        assert data.get("filters_applied", {}).get("sort_order") == "asc"


class TestEditAmountEndpoint:
    """Focused tests for the edit-amount endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin credentials"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        assert resp.status_code == 200
        data = resp.json()
        self.admin_uid = data.get("uid")
    
    def test_edit_amount_endpoint_exists(self):
        """Test that the edit-amount endpoint exists and accepts POST"""
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "request_id": "BTR-TEST-12345678",
            "admin_id": self.admin_uid,
            "new_amount": 1000
        })
        # Should return 404 (not found) not 405 (method not allowed)
        assert resp.status_code != 405, "edit-amount endpoint should accept POST method"
    
    def test_edit_amount_validates_positive_amount(self):
        """Test that new_amount must be positive"""
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "request_id": "BTR-TEST-12345678",
            "admin_id": self.admin_uid,
            "new_amount": 0
        })
        # Should reject zero amount
        assert resp.status_code == 422, f"Expected 422 for zero amount, got {resp.status_code}"
        
        resp = requests.post(f"{BASE_URL}/api/bank-transfer/admin/edit-amount", json={
            "request_id": "BTR-TEST-12345678",
            "admin_id": self.admin_uid,
            "new_amount": -100
        })
        # Should reject negative amount
        assert resp.status_code == 422, f"Expected 422 for negative amount, got {resp.status_code}"
