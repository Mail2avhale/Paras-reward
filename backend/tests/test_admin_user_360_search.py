"""
Test Admin User 360 Search APIs
Tests for the bug fix: 'Failed to search user' error in AdminUser360 page
Features tested:
- Search by mobile number
- Search by email
- Search by UID
- Browse All users list
- Search suggestions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from the review request
TEST_USER_MOBILE = "9970100782"
TEST_USER_UID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"
TEST_ADMIN_EMAIL = "admin@test.com"


class TestUser360SearchAPI:
    """Test the /api/admin/user-360 endpoint with various search queries"""
    
    def test_search_by_mobile_number(self):
        """Test searching user by mobile number"""
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query={TEST_USER_MOBILE}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user' field"
        assert data["user"]["mobile"] == TEST_USER_MOBILE, f"Mobile should match {TEST_USER_MOBILE}"
        assert data["user"]["uid"] == TEST_USER_UID, "UID should match expected value"
        print(f"✅ Search by mobile: Found user {data['user']['name']}")
    
    def test_search_by_email(self):
        """Test searching user by email"""
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query={TEST_ADMIN_EMAIL}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user' field"
        assert data["user"]["email"].lower() == TEST_ADMIN_EMAIL.lower(), f"Email should match {TEST_ADMIN_EMAIL}"
        print(f"✅ Search by email: Found user {data['user']['name']}")
    
    def test_search_by_uid(self):
        """Test searching user by UID"""
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query={TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user' field"
        assert data["user"]["uid"] == TEST_USER_UID, f"UID should match {TEST_USER_UID}"
        print(f"✅ Search by UID: Found user {data['user']['name']}")
    
    def test_search_returns_complete_user_data(self):
        """Test that search returns all required user data fields"""
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query={TEST_USER_MOBILE}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required top-level fields
        required_fields = ["user", "stats", "referral", "transactions", "activity"]
        for field in required_fields:
            assert field in data, f"Response should contain '{field}' field"
        
        # Check user fields
        user = data["user"]
        user_fields = ["uid", "name", "email", "mobile", "prc_balance", "kyc_status"]
        for field in user_fields:
            assert field in user, f"User should contain '{field}' field"
        
        # Check stats fields
        stats = data["stats"]
        stats_fields = ["total_mined", "total_redeemed", "net_balance"]
        for field in stats_fields:
            assert field in stats, f"Stats should contain '{field}' field"
        
        print(f"✅ Complete user data returned with all required fields")
    
    def test_search_with_special_characters(self):
        """Test that search handles special characters properly (regex escape fix)"""
        # Test with email containing special regex characters like '.'
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query=admin@test.com")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user" in data, "Should find user even with special characters in query"
        print(f"✅ Special characters handled correctly")
    
    def test_search_user_not_found(self):
        """Test that search returns 404 for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query=nonexistent_user_12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✅ Non-existent user returns 404")
    
    def test_search_query_too_short(self):
        """Test that search rejects queries that are too short"""
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query=a")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✅ Short query rejected with 400")


class TestBrowseAllUsersAPI:
    """Test the /api/admin/users/all endpoint"""
    
    def test_browse_all_users_default(self):
        """Test browsing all users with default pagination"""
        response = requests.get(f"{BASE_URL}/api/admin/users/all")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "users" in data, "Response should contain 'users' field"
        assert "total" in data, "Response should contain 'total' field"
        assert "page" in data, "Response should contain 'page' field"
        assert "pages" in data, "Response should contain 'pages' field"
        
        assert isinstance(data["users"], list), "Users should be a list"
        assert data["total"] > 0, "Should have at least one user"
        print(f"✅ Browse all users: Found {data['total']} total users, {len(data['users'])} on page 1")
    
    def test_browse_all_users_with_pagination(self):
        """Test browsing users with custom pagination"""
        response = requests.get(f"{BASE_URL}/api/admin/users/all?page=1&limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["users"]) <= 5, "Should return at most 5 users"
        assert data["page"] == 1, "Page should be 1"
        print(f"✅ Pagination works: {len(data['users'])} users returned with limit=5")
    
    def test_browse_all_users_with_search(self):
        """Test browsing users with search filter"""
        response = requests.get(f"{BASE_URL}/api/admin/users/all?search=santosh")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should find at least one user matching 'santosh'
        if data["total"] > 0:
            # Check that returned users match the search
            for user in data["users"]:
                name = user.get("name", "").lower()
                email = user.get("email", "").lower()
                assert "santosh" in name or "santosh" in email, "Search results should match query"
        print(f"✅ Search filter works: Found {data['total']} users matching 'santosh'")
    
    def test_browse_all_users_with_role_filter(self):
        """Test browsing users with role filter"""
        response = requests.get(f"{BASE_URL}/api/admin/users/all?role=admin")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned users should have admin role
        for user in data["users"]:
            assert user.get("role") == "admin", f"User {user.get('uid')} should have admin role"
        print(f"✅ Role filter works: Found {data['total']} admin users")


class TestSearchSuggestionsAPI:
    """Test the /api/admin/users/search-suggestions endpoint"""
    
    def test_search_suggestions_basic(self):
        """Test basic search suggestions"""
        response = requests.get(f"{BASE_URL}/api/admin/users/search-suggestions?q=San&limit=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "suggestions" in data, "Response should contain 'suggestions' field"
        assert "query" in data, "Response should contain 'query' field"
        assert "count" in data, "Response should contain 'count' field"
        
        assert data["query"] == "San", "Query should be echoed back"
        print(f"✅ Search suggestions: Found {data['count']} suggestions for 'San'")
    
    def test_search_suggestions_returns_user_details(self):
        """Test that suggestions include required user details"""
        response = requests.get(f"{BASE_URL}/api/admin/users/search-suggestions?q=santosh&limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["count"] > 0:
            suggestion = data["suggestions"][0]
            required_fields = ["uid", "name", "email"]
            for field in required_fields:
                assert field in suggestion, f"Suggestion should contain '{field}' field"
        print(f"✅ Suggestions include user details")
    
    def test_search_suggestions_short_query(self):
        """Test that suggestions require minimum query length"""
        response = requests.get(f"{BASE_URL}/api/admin/users/search-suggestions?q=a")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return empty suggestions for short query
        assert data["suggestions"] == [], "Short query should return empty suggestions"
        print(f"✅ Short query returns empty suggestions")
    
    def test_search_suggestions_empty_query(self):
        """Test suggestions with empty query"""
        response = requests.get(f"{BASE_URL}/api/admin/users/search-suggestions?q=")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["suggestions"] == [], "Empty query should return empty suggestions"
        print(f"✅ Empty query returns empty suggestions")


class TestRedeemLimitConsistency:
    """Test that redeem limit calculations are consistent"""
    
    def test_redeem_limit_in_user_360(self):
        """Test that redeem_limit is included in user 360 response"""
        response = requests.get(f"{BASE_URL}/api/admin/user-360?query={TEST_USER_UID}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "redeem_limit" in data, "Response should contain 'redeem_limit' field"
        
        redeem_limit = data["redeem_limit"]
        required_fields = ["total_limit", "total_redeemed", "remaining_limit"]
        for field in required_fields:
            assert field in redeem_limit, f"Redeem limit should contain '{field}' field"
        
        # Verify calculation: remaining = total - redeemed
        expected_remaining = redeem_limit["total_limit"] - redeem_limit["total_redeemed"]
        assert abs(redeem_limit["remaining_limit"] - expected_remaining) < 0.01, \
            f"Remaining limit calculation should be correct: {redeem_limit['remaining_limit']} vs {expected_remaining}"
        
        print(f"✅ Redeem limit included: {redeem_limit['total_limit']} total, {redeem_limit['remaining_limit']} remaining")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
