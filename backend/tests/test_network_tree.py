"""
Network Tree API Tests
Tests for the /api/referrals/network-tree/{user_id} endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNetworkTreeAPI:
    """Test network tree API endpoint"""
    
    def test_network_tree_returns_valid_structure(self):
        """Test that network tree API returns expected structure for admin user"""
        response = requests.get(f"{BASE_URL}/api/referrals/network-tree/1000001")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "id" in data, "Response should have 'id' field"
        assert "name" in data, "Response should have 'name' field"
        assert "children" in data, "Response should have 'children' field"
        
        # Verify data types
        assert isinstance(data["children"], list), "children should be a list"
        
        print(f"Network tree response: id={data['id']}, name={data['name']}, children_count={len(data['children'])}")
    
    def test_network_tree_contains_user_details(self):
        """Test that network tree returns detailed user info"""
        response = requests.get(f"{BASE_URL}/api/referrals/network-tree/1000001")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Check for additional user details
        expected_fields = ["email", "mobile", "subscription_plan", "is_active", "referral_count", "prc_balance"]
        
        for field in expected_fields:
            assert field in data, f"Response should have '{field}' field"
        
        print(f"User details: email={data.get('email')}, plan={data.get('subscription_plan')}, active={data.get('is_active')}")
    
    def test_network_tree_nonexistent_user(self):
        """Test network tree for non-existent user returns empty structure"""
        response = requests.get(f"{BASE_URL}/api/referrals/network-tree/9999999")
        
        # Should return 200 with empty structure, not 404
        assert response.status_code == 200, f"Expected 200 for non-existent user, got {response.status_code}"
        
        data = response.json()
        assert "id" in data, "Response should have 'id' field even for non-existent user"
        assert "children" in data, "Response should have 'children' field"
        assert len(data["children"]) == 0, "Non-existent user should have no children"
        
        print(f"Non-existent user response: {data}")
    
    def test_network_tree_for_admin_user(self):
        """Test network tree specifically for admin user 1000001"""
        response = requests.get(f"{BASE_URL}/api/referrals/network-tree/1000001")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify it's the admin user
        assert data["id"] == "1000001", "Should return data for admin user"
        assert data["name"] == "Admin User", f"Expected 'Admin User', got '{data['name']}'"
        
        # Since admin has no referrals in test, children should be empty
        assert isinstance(data["children"], list)
        
        print(f"Admin user network tree: {data['name']} with {len(data['children'])} children")


class TestReferralsEnhancedAPI:
    """Test related referral APIs that support the network tree page"""
    
    def test_referral_levels_api(self):
        """Test /api/referrals/{user_id}/levels endpoint"""
        response = requests.get(f"{BASE_URL}/api/referrals/1000001/levels")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Should have levels array
        assert "levels" in data, "Response should have 'levels' field"
        assert isinstance(data["levels"], list), "levels should be a list"
        
        print(f"Referral levels: {len(data['levels'])} levels, total={data.get('total', 0)}")
    
    def test_referral_tree_api(self):
        """Test /api/referrals/{user_id}/tree endpoint"""
        response = requests.get(f"{BASE_URL}/api/referrals/1000001/tree")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Should have tree structure
        assert "tree" in data, "Response should have 'tree' field"
        
        print(f"Referral tree: {data.get('tree', {}).get('name', 'N/A')}")
    
    def test_network_analytics_api(self):
        """Test /api/referrals/{user_id}/network-analytics endpoint"""
        response = requests.get(f"{BASE_URL}/api/referrals/1000001/network-analytics")
        
        # This endpoint may or may not exist
        if response.status_code == 200:
            data = response.json()
            print(f"Network analytics available: {list(data.keys())}")
        else:
            print(f"Network analytics API returned {response.status_code} (may not be implemented)")


class TestUserAPI:
    """Test user API that provides data for network tree"""
    
    def test_get_user_by_uid(self):
        """Test /api/user/{uid} endpoint"""
        response = requests.get(f"{BASE_URL}/api/user/1000001")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify basic user fields
        assert "uid" in data, "Response should have 'uid' field"
        assert "name" in data, "Response should have 'name' field"
        assert "email" in data, "Response should have 'email' field"
        
        print(f"User data: uid={data['uid']}, name={data['name']}, email={data['email']}")


if __name__ == "__main__":
    # Run tests when executed directly
    pytest.main([__file__, "-v", "--tb=short"])
