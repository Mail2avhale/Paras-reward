"""
Manual Bank Transfer API Tests - Iteration 121
Tests for the Manual Fintech Redeem System APIs
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fintech-secure-3.preview.emergentagent.com').rstrip('/')


class TestBankTransferConfig:
    """Test Bank Transfer Config API - GET /api/bank-transfer/config"""
    
    def test_config_endpoint_exists(self):
        """Test that config endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Config endpoint returns 200")
    
    def test_config_returns_correct_values(self):
        """Test that config returns correct values"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/config")
        data = response.json()
        
        assert data.get("prc_rate") == 10, "PRC rate should be 10"
        assert data.get("transaction_fee") == 10, "Transaction fee should be ₹10"
        assert data.get("admin_fee_percent") == 20, "Admin fee should be 20%"
        assert data.get("min_withdrawal") == 200, "Min withdrawal should be ₹200"
        assert data.get("max_withdrawal") == 10000, "Max withdrawal should be ₹10,000"
        print("✓ Config returns correct values")
    
    def test_config_has_note_field(self):
        """Test that config has note field with conversion info"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/config")
        data = response.json()
        
        assert "note" in data, "Config should have note field"
        assert "1 INR = 10 PRC" in data.get("note", ""), "Note should mention conversion rate"
        print("✓ Config has correct note field")


class TestFeeCalculation:
    """Test Fee Calculation API - GET /api/bank-transfer/calculate-fees"""
    
    def test_calculate_fees_min_amount(self):
        """Test fee calculation for minimum amount (₹200)"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/calculate-fees?amount=200")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        fees = data.get("fees", {})
        assert fees.get("withdrawal_amount") == 200
        assert fees.get("admin_fee") == 40  # 20% of 200
        assert fees.get("transaction_fee") == 10
        assert fees.get("total_inr") == 250  # 200 + 40 + 10
        assert fees.get("total_prc") == 2500  # 250 * 10
        assert fees.get("user_receives") == 200
        print("✓ Fee calculation correct for ₹200")
    
    def test_calculate_fees_max_amount(self):
        """Test fee calculation for maximum amount (₹10,000)"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/calculate-fees?amount=10000")
        assert response.status_code == 200
        data = response.json()
        
        fees = data.get("fees", {})
        assert fees.get("withdrawal_amount") == 10000
        assert fees.get("admin_fee") == 2000  # 20% of 10000
        assert fees.get("transaction_fee") == 10
        assert fees.get("total_inr") == 12010  # 10000 + 2000 + 10
        assert fees.get("total_prc") == 120100  # 12010 * 10
        assert fees.get("user_receives") == 10000
        print("✓ Fee calculation correct for ₹10,000")
    
    def test_calculate_fees_mid_amount(self):
        """Test fee calculation for mid amount (₹5000)"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/calculate-fees?amount=5000")
        assert response.status_code == 200
        data = response.json()
        
        fees = data.get("fees", {})
        assert fees.get("withdrawal_amount") == 5000
        assert fees.get("admin_fee") == 1000  # 20% of 5000
        assert fees.get("transaction_fee") == 10
        assert fees.get("total_inr") == 6010  # 5000 + 1000 + 10
        assert fees.get("total_prc") == 60100  # 6010 * 10
        print("✓ Fee calculation correct for ₹5,000")
    
    def test_calculate_fees_below_min_rejected(self):
        """Test that amount below minimum is rejected"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/calculate-fees?amount=100")
        assert response.status_code == 422, "Should reject amount below minimum"
        data = response.json()
        assert "greater_than_equal" in str(data) or "200" in str(data)
        print("✓ Amount below min (₹100) correctly rejected")
    
    def test_calculate_fees_above_max_rejected(self):
        """Test that amount above maximum is rejected"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/calculate-fees?amount=20000")
        assert response.status_code == 422, "Should reject amount above maximum"
        data = response.json()
        assert "less_than_equal" in str(data) or "10000" in str(data)
        print("✓ Amount above max (₹20,000) correctly rejected")


class TestIFSCVerification:
    """Test IFSC Verification API - POST /api/bank-transfer/verify-ifsc"""
    
    def test_verify_hdfc_ifsc(self):
        """Test IFSC verification for HDFC bank"""
        response = requests.post(f"{BASE_URL}/api/bank-transfer/verify-ifsc?ifsc=HDFC0001234")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("ifsc") == "HDFC0001234"
        bank = data.get("bank_details", {})
        assert bank.get("valid") == True
        assert "HDFC" in bank.get("bank_name", "")
        print("✓ HDFC IFSC verification works")
    
    def test_verify_icici_ifsc(self):
        """Test IFSC verification for ICICI bank"""
        response = requests.post(f"{BASE_URL}/api/bank-transfer/verify-ifsc?ifsc=ICIC0001234")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        bank = data.get("bank_details", {})
        assert bank.get("valid") == True
        assert "ICICI" in bank.get("bank_name", "")
        print("✓ ICICI IFSC verification works")
    
    def test_verify_sbi_ifsc(self):
        """Test IFSC verification for SBI bank"""
        response = requests.post(f"{BASE_URL}/api/bank-transfer/verify-ifsc?ifsc=SBIN0001234")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        bank = data.get("bank_details", {})
        assert bank.get("valid") == True
        assert "State Bank" in bank.get("bank_name", "") or "SBI" in bank.get("bank_name", "")
        print("✓ SBI IFSC verification works")
    
    def test_verify_axis_ifsc(self):
        """Test IFSC verification for Axis bank"""
        response = requests.post(f"{BASE_URL}/api/bank-transfer/verify-ifsc?ifsc=UTIB0001234")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        bank = data.get("bank_details", {})
        assert bank.get("valid") == True
        assert "Axis" in bank.get("bank_name", "")
        print("✓ Axis IFSC verification works")
    
    def test_invalid_ifsc_format_rejected(self):
        """Test that invalid IFSC format is rejected"""
        response = requests.post(f"{BASE_URL}/api/bank-transfer/verify-ifsc?ifsc=INVALID123")
        assert response.status_code == 400, "Should reject invalid IFSC format"
        data = response.json()
        assert "Invalid IFSC format" in str(data.get("detail", ""))
        print("✓ Invalid IFSC format correctly rejected")
    
    def test_ifsc_too_short_rejected(self):
        """Test that IFSC code too short is rejected"""
        response = requests.post(f"{BASE_URL}/api/bank-transfer/verify-ifsc?ifsc=HDFC001")
        assert response.status_code == 400
        print("✓ Short IFSC correctly rejected")
    
    def test_ifsc_lowercase_accepted(self):
        """Test that lowercase IFSC is converted and accepted"""
        response = requests.post(f"{BASE_URL}/api/bank-transfer/verify-ifsc?ifsc=hdfc0001234")
        assert response.status_code == 200
        data = response.json()
        # Should be converted to uppercase
        assert data.get("ifsc") == "HDFC0001234"
        print("✓ Lowercase IFSC converted to uppercase")


class TestAdminRequests:
    """Test Admin Requests API - GET /api/bank-transfer/admin/requests"""
    
    def test_admin_requests_endpoint_exists(self):
        """Test that admin requests endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests")
        assert response.status_code == 200
        print("✓ Admin requests endpoint returns 200")
    
    def test_admin_requests_returns_structure(self):
        """Test that admin requests returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests")
        data = response.json()
        
        assert data.get("success") == True
        assert "requests" in data
        assert "pagination" in data
        assert "stats" in data
        
        pagination = data.get("pagination", {})
        assert "total" in pagination
        assert "limit" in pagination
        assert "skip" in pagination
        assert "pages" in pagination
        
        stats = data.get("stats", {})
        assert "pending" in stats
        assert "paid" in stats
        assert "failed" in stats
        print("✓ Admin requests returns correct structure")
    
    def test_admin_requests_with_status_filter(self):
        """Test admin requests with status filter"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?status=pending")
        assert response.status_code == 200
        print("✓ Admin requests with pending filter works")
        
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?status=paid")
        assert response.status_code == 200
        print("✓ Admin requests with paid filter works")
        
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?status=failed")
        assert response.status_code == 200
        print("✓ Admin requests with failed filter works")
    
    def test_admin_requests_with_search(self):
        """Test admin requests with search parameter"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?search=test")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print("✓ Admin requests with search works")
    
    def test_admin_requests_pagination(self):
        """Test admin requests pagination parameters"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/requests?limit=10&skip=0")
        assert response.status_code == 200
        data = response.json()
        
        pagination = data.get("pagination", {})
        assert pagination.get("limit") == 10
        assert pagination.get("skip") == 0
        print("✓ Admin requests pagination works")


class TestAdminStats:
    """Test Admin Stats API - GET /api/bank-transfer/admin/stats"""
    
    def test_admin_stats_endpoint_exists(self):
        """Test that admin stats endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/stats")
        assert response.status_code == 200
        print("✓ Admin stats endpoint returns 200")
    
    def test_admin_stats_returns_structure(self):
        """Test that admin stats returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/stats")
        data = response.json()
        
        assert data.get("success") == True
        stats = data.get("stats", {})
        
        assert "total_pending" in stats
        assert "total_paid" in stats
        assert "total_failed" in stats
        assert "total_prc_burned" in stats
        assert "pending_amount" in stats
        assert "paid_amount" in stats
        assert "today" in stats
        
        today = stats.get("today", {})
        assert "new_requests" in today
        assert "processed" in today
        print("✓ Admin stats returns correct structure")
    
    def test_admin_stats_values_are_numbers(self):
        """Test that all stats values are numbers"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/admin/stats")
        data = response.json()
        
        stats = data.get("stats", {})
        assert isinstance(stats.get("total_pending"), int)
        assert isinstance(stats.get("total_paid"), int)
        assert isinstance(stats.get("total_failed"), int)
        assert isinstance(stats.get("total_prc_burned"), int)
        print("✓ Admin stats values are correct type")


class TestUserRequests:
    """Test User Requests API - GET /api/bank-transfer/my-requests/{user_id}"""
    
    def test_user_requests_with_nonexistent_user(self):
        """Test that user requests for non-existent user returns empty array"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/my-requests/nonexistent-user-id")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "requests" in data
        assert isinstance(data.get("requests"), list)
        print("✓ User requests endpoint works for non-existent user")
    
    def test_user_requests_with_status_filter(self):
        """Test user requests with status filter"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/my-requests/test-user?status=pending")
        assert response.status_code == 200
        print("✓ User requests with status filter works")
    
    def test_user_requests_pagination(self):
        """Test user requests pagination"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/my-requests/test-user?limit=10&skip=0")
        assert response.status_code == 200
        data = response.json()
        
        assert "total" in data
        assert "limit" in data
        assert "skip" in data
        print("✓ User requests pagination works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
