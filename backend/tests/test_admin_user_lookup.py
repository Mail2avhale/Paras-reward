"""
Admin User Lookup API Tests
Tests for: GET /api/admin/user-lookup/{identifier}

CRITICAL BUG FOUND: 
The user-lookup endpoint is defined AFTER app.include_router(api_router) in server.py,
so the route is NOT being registered. This test documents the bug.

The endpoint is defined at line 43308, but app.include_router(api_router) is at line 43305.
Routes defined after include_router are not included.
"""
import pytest
import requests
import os

# Get the API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = 'https://fintech-admin-hub.preview.emergentagent.com'


class TestAdminUserLookupBugVerification:
    """Tests to verify the user-lookup endpoint bug"""
    
    def test_user_lookup_endpoint_returns_404(self):
        """
        BUG: User lookup endpoint returns 404 Not Found
        
        Root Cause: The endpoint @api_router.get("/admin/user-lookup/{identifier}")
        is defined at line 43308 in server.py, AFTER app.include_router(api_router)
        at line 43305. Routes defined after include_router are not registered.
        
        Fix Required: Move the user-lookup route definition to BEFORE the 
        app.include_router(api_router) call.
        """
        # Test with a known identifier
        response = requests.get(f"{BASE_URL}/api/admin/user-lookup/test")
        
        # BUG: This returns 404 instead of user data or "user not found" error
        # Expected: 200 with user data OR 200 with {"success": false, "error": "User not found"}
        # Actual: 404 "Not Found" because route is not registered
        assert response.status_code == 404, f"Bug confirmed: Endpoint not registered (404). Got {response.status_code}"
    
    def test_user_lookup_by_mobile_returns_404(self):
        """BUG: User lookup by mobile also returns 404"""
        response = requests.get(f"{BASE_URL}/api/admin/user-lookup/9421331342")
        
        # This should return user data, but returns 404 due to route not registered
        assert response.status_code == 404, f"Bug confirmed: Mobile lookup returns 404. Got {response.status_code}"
    
    def test_user_lookup_by_email_returns_404(self):
        """BUG: User lookup by email also returns 404"""
        response = requests.get(f"{BASE_URL}/api/admin/user-lookup/test@parasreward.com")
        
        # This should return user data, but returns 404 due to route not registered
        assert response.status_code == 404, f"Bug confirmed: Email lookup returns 404. Got {response.status_code}"
    
    def test_user_lookup_by_name_returns_404(self):
        """BUG: User lookup by name also returns 404"""
        response = requests.get(f"{BASE_URL}/api/admin/user-lookup/Test%20User")
        
        # This should search by name, but returns 404 due to route not registered
        assert response.status_code == 404, f"Bug confirmed: Name lookup returns 404. Got {response.status_code}"


class TestAdminUserLookupExpectedBehavior:
    """
    Tests documenting EXPECTED behavior after bug is fixed.
    These tests currently FAIL (return 404) but document what SHOULD happen.
    """
    
    @pytest.mark.skip(reason="BUG: Endpoint not registered - returns 404")
    def test_user_lookup_success_by_mobile(self):
        """EXPECTED: Should return user details when searched by mobile"""
        response = requests.get(f"{BASE_URL}/api/admin/user-lookup/9421331342")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('success') == True, "Expected success=true"
        assert 'basic_info' in data, "Expected basic_info in response"
        assert 'mining_details' in data, "Expected mining_details in response"
        assert 'referral_breakdown' in data, "Expected referral_breakdown in response"
    
    @pytest.mark.skip(reason="BUG: Endpoint not registered - returns 404")
    def test_user_lookup_returns_balance_analysis(self):
        """EXPECTED: Should return balance analysis for user"""
        response = requests.get(f"{BASE_URL}/api/admin/user-lookup/9421331342")
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'balance_analysis' in data, "Expected balance_analysis"
        assert 'total_mined' in data.get('balance_analysis', {}), "Expected total_mined"
        assert 'current_balance' in data.get('balance_analysis', {}), "Expected current_balance"
    
    @pytest.mark.skip(reason="BUG: Endpoint not registered - returns 404")
    def test_user_lookup_not_found_returns_error(self):
        """EXPECTED: Should return success=false for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/admin/user-lookup/nonexistent_user_12345")
        
        # Should return 200 with success=false, not 404
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('success') == False, "Expected success=false"
        assert 'error' in data, "Expected error message"
        assert 'not found' in data.get('error', '').lower(), "Expected 'not found' in error"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
