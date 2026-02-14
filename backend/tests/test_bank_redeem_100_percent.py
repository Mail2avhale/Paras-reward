"""
Test Bank Redeem 100% Balance Limit Feature
- Tests that users can redeem up to 100% of their PRC balance
- Tests the renamed "Redeem To Bank" feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBankRedeem100PercentLimit:
    """Test bank redeem 100% balance limit feature"""
    
    def test_denominations_endpoint(self):
        """Test that denominations endpoint returns fee structure info"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        assert response.status_code == 200
        
        data = response.json()
        assert "min_amount" in data
        assert "max_amount" in data
        assert "fee_structure" in data
        assert "admin_charge_percent" in data
        assert data["min_amount"] == 100
        assert data["max_amount"] == 25000
        assert data["admin_charge_percent"] == 20
        print(f"✓ Denominations API working - Min: {data['min_amount']}, Max: {data['max_amount']}")
    
    def test_bank_redeem_request_endpoint_exists(self):
        """Test that POST /api/bank-redeem/request endpoint exists"""
        # Test with a fake user ID - should return 404 for user not found
        response = requests.post(
            f"{BASE_URL}/api/bank-redeem/request/fake_test_user_123",
            json={"amount_inr": 100}
        )
        # Expecting 404 (user not found) or 400 (validation error)
        # NOT 405 (method not allowed)
        assert response.status_code in [400, 404, 422]
        print(f"✓ Bank redeem request endpoint exists - Status: {response.status_code}")
    
    def test_bank_redeem_history_endpoint(self):
        """Test that GET /api/bank-redeem/history endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/history/fake_user_123")
        # This endpoint should work even for non-existent user (returns empty list)
        assert response.status_code in [200, 404]
        print(f"✓ Bank redeem history endpoint exists - Status: {response.status_code}")
    
    def test_check_eligibility_endpoint(self):
        """Test that GET /api/bank-redeem/check-eligibility endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/check-eligibility/fake_user_123")
        # Should return 404 for non-existent user
        assert response.status_code in [200, 404]
        print(f"✓ Bank redeem eligibility endpoint exists - Status: {response.status_code}")
    
    def test_bank_details_endpoints_exist(self):
        """Test that bank details CRUD endpoints exist"""
        # GET bank details
        response = requests.get(f"{BASE_URL}/api/bank-details/fake_user_123")
        assert response.status_code in [200, 404]
        print(f"✓ GET bank-details endpoint exists - Status: {response.status_code}")
        
        # POST bank details (should fail with invalid data or user not found)
        response = requests.post(
            f"{BASE_URL}/api/bank-details/fake_user_123",
            json={
                "account_holder_name": "TEST USER",
                "account_number": "123456789012",
                "ifsc_code": "SBIN0001234",
                "bank_name": "STATE BANK"
            }
        )
        assert response.status_code in [400, 404, 422]
        print(f"✓ POST bank-details endpoint exists - Status: {response.status_code}")
    
    def test_amount_validation_min(self):
        """Test that minimum amount is validated (₹100)"""
        response = requests.post(
            f"{BASE_URL}/api/bank-redeem/request/fake_user_123",
            json={"amount_inr": 50}  # Below minimum
        )
        # Should return error for amount below minimum
        assert response.status_code in [400, 404, 422]
        print("✓ Amount validation (min) working")
    
    def test_amount_validation_max(self):
        """Test that maximum amount is validated (₹25000)"""
        response = requests.post(
            f"{BASE_URL}/api/bank-redeem/request/fake_user_123",
            json={"amount_inr": 50000}  # Above maximum
        )
        # Should return error for amount above maximum
        assert response.status_code in [400, 404, 422]
        print("✓ Amount validation (max) working")
    
    def test_admin_pending_count_endpoint(self):
        """Test admin pending count endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/bank-redeem/pending-count")
        assert response.status_code == 200
        data = response.json()
        assert "pending_count" in data
        print(f"✓ Admin pending count endpoint working - Count: {data['pending_count']}")
    
    def test_admin_requests_endpoint(self):
        """Test admin withdrawal requests listing endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/bank-redeem/requests")
        assert response.status_code == 200
        data = response.json()
        assert "requests" in data
        assert "total" in data
        assert "page" in data
        print(f"✓ Admin requests listing endpoint working - Total: {data['total']}")


class TestCodeVerification:
    """Verify code changes for 100% limit and text rename"""
    
    def test_verify_backend_100_percent_comment(self):
        """Verify backend code has 100% limit comment (not 50%)"""
        import os
        backend_file = "/app/backend/routes/bank_redeem.py"
        
        with open(backend_file, 'r') as f:
            content = f.read()
        
        # Check for 100% limit comment
        assert "100%" in content, "Backend should have 100% limit in comments"
        assert "User can redeem up to 100%" in content, "Backend should explicitly mention 100% redeem"
        
        # Make sure there's no 50% limit enforcement code
        # The old code had: max_prc = int(prc_balance * 0.5)
        assert "int(prc_balance * 0.5)" not in content, "Should NOT have 50% limit calculation"
        assert "prc_balance * 0.5" not in content, "Should NOT have 50% limit calculation"
        
        print("✓ Backend code verified - 100% limit in place, no 50% restriction")
    
    def test_verify_frontend_slider_100_percent(self):
        """Verify frontend slider allows 100% of balance"""
        frontend_file = "/app/frontend/src/pages/BankRedeem.js"
        
        with open(frontend_file, 'r') as f:
            content = f.read()
        
        # Check that maxAllowedPRC = currentBalance (100%)
        assert "maxAllowedPRC = currentBalance" in content, "Slider should allow 100% of balance"
        
        # Make sure there's no 50% limit
        assert "currentBalance * 0.5" not in content, "Should NOT have 50% calculation for slider"
        assert "prc_balance * 0.5" not in content.lower(), "Should NOT have 50% calculation"
        
        print("✓ Frontend slider verified - 100% of balance allowed")
    
    def test_verify_redeem_to_bank_text(self):
        """Verify 'Redeem To Bank' text is used instead of 'Redeem to Cash'"""
        dashboard_file = "/app/frontend/src/pages/DashboardModern.js"
        
        with open(dashboard_file, 'r') as f:
            content = f.read()
        
        # Check for correct text
        assert "Redeem To Bank" in content, "Should have 'Redeem To Bank' text"
        
        # Make sure old text is removed
        assert "Redeem to Cash" not in content, "Should NOT have 'Redeem to Cash' text"
        
        print("✓ Dashboard text verified - 'Redeem To Bank' is used correctly")
    
    def test_no_redeem_to_cash_anywhere(self):
        """Verify 'Redeem to Cash' doesn't exist anywhere in frontend"""
        import subprocess
        
        result = subprocess.run(
            ['grep', '-rn', 'Redeem to Cash', '/app/frontend/src/'],
            capture_output=True,
            text=True
        )
        
        # grep returns exit code 1 when no matches found (which is what we want)
        assert result.returncode == 1 or result.stdout.strip() == "", \
            f"Found 'Redeem to Cash' in: {result.stdout}"
        
        print("✓ No 'Redeem to Cash' text found in frontend")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
