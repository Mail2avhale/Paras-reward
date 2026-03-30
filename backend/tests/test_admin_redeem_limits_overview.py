"""
Test Admin Redeem Limits Overview API
Tests the GET /api/admin/redeem-limits-overview endpoint
Requires admin authentication
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminRedeemLimitsOverview:
    """Tests for admin redeem limits overview endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@test.com"
        self.admin_pin = "153759"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Get admin token
        self.token = self.get_admin_token()
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def get_admin_token(self):
        """Get admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": self.admin_email,
            "pin": self.admin_pin
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        return None
    
    def test_endpoint_requires_auth(self):
        """Test that the endpoint requires authentication"""
        # Make request without auth
        session_no_auth = requests.Session()
        response = session_no_auth.get(f"{BASE_URL}/api/admin/redeem-limits-overview")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print(f"✓ Endpoint correctly requires authentication (401)")
    
    def test_endpoint_exists(self):
        """Test that the endpoint exists and responds with auth"""
        if not self.token:
            pytest.skip("Could not get admin token")
        response = self.session.get(f"{BASE_URL}/api/admin/redeem-limits-overview")
        assert response.status_code == 200, f"Expected 200 with auth, got {response.status_code}"
        print(f"✓ Endpoint exists and responds with auth, status: {response.status_code}")
    
    def test_endpoint_returns_aggregate_and_users(self):
        """Test that endpoint returns aggregate and users array"""
        if not self.token:
            pytest.skip("Could not get admin token")
        response = self.session.get(f"{BASE_URL}/api/admin/redeem-limits-overview")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Check aggregate exists
        assert "aggregate" in data, "Response should contain 'aggregate' field"
        print(f"✓ Response contains 'aggregate' field")
        
        # Check users array exists
        assert "users" in data, "Response should contain 'users' field"
        assert isinstance(data["users"], list), "'users' should be a list"
        print(f"✓ Response contains 'users' array with {len(data['users'])} users")
    
    def test_aggregate_has_required_fields(self):
        """Test that aggregate has all required fields"""
        if not self.token:
            pytest.skip("Could not get admin token")
        response = self.session.get(f"{BASE_URL}/api/admin/redeem-limits-overview")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        aggregate = data.get("aggregate", {})
        
        required_fields = [
            "total_users",
            "total_balance",
            "total_earned",
            "total_redeemable",
            "total_redeemed",
            "total_available"
        ]
        
        for field in required_fields:
            assert field in aggregate, f"Aggregate should contain '{field}'"
            print(f"✓ Aggregate contains '{field}': {aggregate[field]}")
        
        # Verify types
        assert isinstance(aggregate["total_users"], int), "total_users should be int"
        assert isinstance(aggregate["total_balance"], (int, float)), "total_balance should be numeric"
        assert isinstance(aggregate["total_earned"], (int, float)), "total_earned should be numeric"
        assert isinstance(aggregate["total_redeemable"], (int, float)), "total_redeemable should be numeric"
        assert isinstance(aggregate["total_redeemed"], (int, float)), "total_redeemed should be numeric"
        assert isinstance(aggregate["total_available"], (int, float)), "total_available should be numeric"
        print("✓ All aggregate field types are correct")
    
    def test_user_data_has_required_fields(self):
        """Test that each user in users array has required fields"""
        if not self.token:
            pytest.skip("Could not get admin token")
        response = self.session.get(f"{BASE_URL}/api/admin/redeem-limits-overview")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        users = data.get("users", [])
        
        if len(users) == 0:
            pytest.skip("No users with balance > 0 found")
        
        required_fields = [
            "uid",
            "name",
            "balance",
            "unlock_percent",
            "redeemable",
            "total_redeemed",
            "available"
        ]
        
        # Check first user
        first_user = users[0]
        for field in required_fields:
            assert field in first_user, f"User should contain '{field}'"
            print(f"✓ User contains '{field}': {first_user[field]}")
        
        # Verify types
        assert isinstance(first_user["uid"], str), "uid should be string"
        assert isinstance(first_user["balance"], (int, float)), "balance should be numeric"
        assert isinstance(first_user["unlock_percent"], (int, float)), "unlock_percent should be numeric"
        assert isinstance(first_user["redeemable"], (int, float)), "redeemable should be numeric"
        assert isinstance(first_user["total_redeemed"], (int, float)), "total_redeemed should be numeric"
        assert isinstance(first_user["available"], (int, float)), "available should be numeric"
        print("✓ All user field types are correct")
    
    def test_users_sorted_by_balance_desc(self):
        """Test that users are sorted by balance in descending order"""
        if not self.token:
            pytest.skip("Could not get admin token")
        response = self.session.get(f"{BASE_URL}/api/admin/redeem-limits-overview")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        users = data.get("users", [])
        
        if len(users) < 2:
            pytest.skip("Need at least 2 users to test sorting")
        
        balances = [u["balance"] for u in users]
        assert balances == sorted(balances, reverse=True), "Users should be sorted by balance descending"
        print(f"✓ Users are sorted by balance descending: {balances[:5]}...")
    
    def test_aggregate_totals_match_user_sum(self):
        """Test that aggregate totals match sum of user values"""
        if not self.token:
            pytest.skip("Could not get admin token")
        response = self.session.get(f"{BASE_URL}/api/admin/redeem-limits-overview")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        aggregate = data.get("aggregate", {})
        users = data.get("users", [])
        
        if len(users) == 0:
            pytest.skip("No users to verify totals")
        
        # Calculate sums from users
        sum_balance = sum(u["balance"] for u in users)
        sum_redeemable = sum(u["redeemable"] for u in users)
        sum_redeemed = sum(u["total_redeemed"] for u in users)
        sum_available = sum(u["available"] for u in users)
        
        # Allow small floating point differences
        assert abs(aggregate["total_balance"] - sum_balance) < 0.1, "total_balance should match sum"
        assert abs(aggregate["total_redeemable"] - sum_redeemable) < 0.1, "total_redeemable should match sum"
        assert abs(aggregate["total_redeemed"] - sum_redeemed) < 0.1, "total_redeemed should match sum"
        assert abs(aggregate["total_available"] - sum_available) < 0.1, "total_available should match sum"
        
        print(f"✓ Aggregate totals match user sums")
        print(f"  - total_balance: {aggregate['total_balance']} ≈ {sum_balance}")
        print(f"  - total_redeemable: {aggregate['total_redeemable']} ≈ {sum_redeemable}")
        print(f"  - total_redeemed: {aggregate['total_redeemed']} ≈ {sum_redeemed}")
        print(f"  - total_available: {aggregate['total_available']} ≈ {sum_available}")
    
    def test_total_users_count_matches(self):
        """Test that total_users matches length of users array"""
        if not self.token:
            pytest.skip("Could not get admin token")
        response = self.session.get(f"{BASE_URL}/api/admin/redeem-limits-overview")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        aggregate = data.get("aggregate", {})
        users = data.get("users", [])
        
        assert aggregate["total_users"] == len(users), "total_users should match users array length"
        print(f"✓ total_users ({aggregate['total_users']}) matches users array length ({len(users)})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
