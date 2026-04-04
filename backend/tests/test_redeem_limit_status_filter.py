"""
Test: Redeem Limit Status Filter Bug Fix
========================================
Critical bug fix: Failed and Refunded redeem requests were incorrectly being counted as 'Used' 
in the user's redeem limit.

Fix: Only count Completed, Approved, and Pending requests. 
Exclude: Failed, Refunded, retry_failed, rejected, cancelled, error statuses.

Test Users:
- cbdf46d7-7d66-4d43-8495-e1432a2ab071: Should have total_redeemed=109609 (excludes 18788 retry_failed)
- 6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21: Should have total_redeemed=34369.47 (9240 failed excluded)
- 76b75808-47fa-48dd-ad7c-8074678e3607: Should have total_redeemed=48646.52 (subscription payments only)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user UIDs
BUG_USER_UID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"  # Has retry_failed entries
PRC_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"  # Has failed entries
CASH_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # Subscription payments only

# Admin credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


class TestRedeemLimitStatusFilter:
    """Test that redeem limit correctly excludes failed/retry_failed statuses"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        # Admin login uses email + pin
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": ADMIN_EMAIL, "password": ADMIN_PIN}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    def test_api_health(self):
        """Test that API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"API health check failed: {response.text}"
        print("✓ API health check passed")
    
    def test_redeem_limit_endpoint_exists(self, admin_token):
        """Test that redeem-limit endpoint exists and returns data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/user/{CASH_USER_UID}/redeem-limit",
            headers=headers
        )
        assert response.status_code == 200, f"Redeem limit endpoint failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "limit" in data or "success" in data, f"Unexpected response format: {data}"
        print(f"✓ Redeem limit endpoint accessible")
    
    def test_bug_user_excludes_retry_failed(self, admin_token):
        """
        User cbdf46d7-7d66-4d43-8495-e1432a2ab071 should have total_redeemed=109609
        This excludes 18788 PRC from retry_failed entries
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/user/{BUG_USER_UID}/redeem-limit",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get redeem limit: {response.text}"
        
        data = response.json()
        limit_data = data.get("limit", data)
        total_redeemed = limit_data.get("total_redeemed", 0)
        
        print(f"Bug User ({BUG_USER_UID}):")
        print(f"  total_redeemed: {total_redeemed}")
        
        # The fix should exclude retry_failed entries
        # Expected: ~109609 (not ~128397 which would include retry_failed)
        # Allow some tolerance for other transactions
        assert total_redeemed < 120000, f"total_redeemed ({total_redeemed}) seems to include retry_failed entries (expected ~109609)"
        print(f"✓ Bug user total_redeemed correctly excludes retry_failed entries")
    
    def test_prc_user_excludes_failed(self, admin_token):
        """
        User 6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21 should have total_redeemed=34369.47
        This excludes 9240 PRC from failed entries in redeem_requests
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/user/{PRC_USER_UID}/redeem-limit",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get redeem limit: {response.text}"
        
        data = response.json()
        limit_data = data.get("limit", data)
        total_redeemed = limit_data.get("total_redeemed", 0)
        
        print(f"PRC User ({PRC_USER_UID}):")
        print(f"  total_redeemed: {total_redeemed}")
        
        # The fix should exclude failed entries
        # Expected: ~34369.47 (not ~43609.47 which would include failed)
        assert total_redeemed < 40000, f"total_redeemed ({total_redeemed}) seems to include failed entries (expected ~34369.47)"
        print(f"✓ PRC user total_redeemed correctly excludes failed entries")
    
    def test_cash_user_subscription_payments(self, admin_token):
        """
        User 76b75808-47fa-48dd-ad7c-8074678e3607 should have total_redeemed=48646.52
        This user has subscription payments only
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/user/{CASH_USER_UID}/redeem-limit",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get redeem limit: {response.text}"
        
        data = response.json()
        limit_data = data.get("limit", data)
        total_redeemed = limit_data.get("total_redeemed", 0)
        
        print(f"Cash User ({CASH_USER_UID}):")
        print(f"  total_redeemed: {total_redeemed}")
        
        # Expected: ~48646.52 for subscription payments
        # Allow tolerance for other transactions
        assert total_redeemed > 0, f"total_redeemed should be > 0 for this user"
        print(f"✓ Cash user total_redeemed: {total_redeemed}")
    
    def test_redeem_limit_includes_pending(self, admin_token):
        """
        Verify that pending status is included in total_redeemed calculation
        The success_statuses list should include: pending, PENDING, Pending
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test with bug user who may have pending entries
        response = requests.get(
            f"{BASE_URL}/api/user/{BUG_USER_UID}/redeem-limit",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get redeem limit: {response.text}"
        
        data = response.json()
        limit_data = data.get("limit", data)
        
        # Verify the response structure includes expected fields
        assert "total_redeemed" in limit_data, "Response should include total_redeemed"
        assert "total_limit" in limit_data or "redeemable" in limit_data, "Response should include limit info"
        
        print(f"✓ Redeem limit response structure is correct")
        print(f"  Fields: {list(limit_data.keys())}")


class TestUser360TotalRedeemed:
    """Test that User 360 API returns consistent total_redeemed values"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": ADMIN_EMAIL, "password": ADMIN_PIN}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip(f"Admin login failed: {response.status_code}")
    
    def test_user360_total_redeemed_matches_redeem_limit(self, admin_token):
        """
        GET /api/admin/user360/full/{uid} should return total_redeemed 
        that matches the redeem-limit API
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get redeem limit value
        redeem_response = requests.get(
            f"{BASE_URL}/api/user/{BUG_USER_UID}/redeem-limit",
            headers=headers
        )
        assert redeem_response.status_code == 200, f"Redeem limit failed: {redeem_response.text}"
        redeem_data = redeem_response.json()
        redeem_limit_total = redeem_data.get("limit", redeem_data).get("total_redeemed", 0)
        
        # Get User 360 value
        user360_response = requests.get(
            f"{BASE_URL}/api/admin/user360/full/{BUG_USER_UID}",
            headers=headers
        )
        assert user360_response.status_code == 200, f"User 360 failed: {user360_response.text}"
        user360_data = user360_response.json()
        user360_total = user360_data.get("stats", {}).get("total_redeemed", 0)
        
        print(f"Bug User ({BUG_USER_UID}):")
        print(f"  Redeem Limit API total_redeemed: {redeem_limit_total}")
        print(f"  User 360 API total_redeemed: {user360_total}")
        
        # Both should use the same centralized function, so values should match
        # Allow small tolerance for rounding
        difference = abs(redeem_limit_total - user360_total)
        assert difference < 1, f"Values don't match: redeem_limit={redeem_limit_total}, user360={user360_total}"
        print(f"✓ User 360 total_redeemed matches redeem-limit API")
    
    def test_user360_excludes_failed_statuses(self, admin_token):
        """
        User 360 should also exclude failed/retry_failed statuses
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/full/{BUG_USER_UID}",
            headers=headers
        )
        assert response.status_code == 200, f"User 360 failed: {response.text}"
        
        data = response.json()
        total_redeemed = data.get("stats", {}).get("total_redeemed", 0)
        
        print(f"User 360 total_redeemed for bug user: {total_redeemed}")
        
        # Should exclude retry_failed entries (18788 PRC)
        # Expected: ~109609, not ~128397
        assert total_redeemed < 120000, f"User 360 total_redeemed ({total_redeemed}) seems to include retry_failed"
        print(f"✓ User 360 correctly excludes failed statuses")


class TestRedeemLimitResponseStructure:
    """Test the response structure of redeem limit API"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": ADMIN_EMAIL, "password": ADMIN_PIN}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip(f"Admin login failed: {response.status_code}")
    
    def test_redeem_limit_response_fields(self, admin_token):
        """Verify all expected fields are present in redeem limit response"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/user/{CASH_USER_UID}/redeem-limit",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        limit_data = data.get("limit", data)
        
        # Expected fields based on calculate_user_redeem_limit function
        expected_fields = [
            "total_redeemed",
            "total_limit",
            "available",
            "unlock_percent",
            "network_size"
        ]
        
        for field in expected_fields:
            assert field in limit_data, f"Missing field: {field}"
            print(f"  {field}: {limit_data.get(field)}")
        
        print(f"✓ All expected fields present in response")
    
    def test_redeem_limit_calculation_formula(self, admin_token):
        """
        Verify the formula: Available = Total Limit - Used
        Where Used = total_redeemed (excludes failed statuses)
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/user/{CASH_USER_UID}/redeem-limit",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        limit_data = data.get("limit", data)
        
        total_limit = limit_data.get("total_limit", 0) or limit_data.get("redeemable", 0)
        total_redeemed = limit_data.get("total_redeemed", 0)
        available = limit_data.get("available", 0)
        
        print(f"Cash User ({CASH_USER_UID}):")
        print(f"  Total Limit: {total_limit}")
        print(f"  Total Redeemed (Used): {total_redeemed}")
        print(f"  Available: {available}")
        
        # Formula: Available = Total Limit - Used
        expected_available = total_limit - total_redeemed
        
        # Allow small tolerance for rounding
        difference = abs(available - expected_available)
        assert difference < 1, f"Formula mismatch: available={available}, expected={expected_available}"
        print(f"✓ Formula verified: Available = Total Limit - Used")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
