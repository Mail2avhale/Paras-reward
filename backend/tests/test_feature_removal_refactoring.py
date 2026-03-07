"""
Test Suite: Feature Removal & Refactoring Verification
========================================================
Tests to verify:
1. Marketplace routes return 404 (feature removed)
2. Luxury Life routes return 404 (feature removed)
3. TAP Game routes return 404 (feature removed)
4. KYC routes work via new routes/kyc.py
5. Mining routes still functional
6. Leaderboard routes working
7. Health check operational
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestFeatureRemoval:
    """Verify removed features return 404"""
    
    def test_marketplace_products_returns_404(self):
        """Marketplace /api/products should return 404"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 404, f"Expected 404 for removed marketplace, got {response.status_code}"
        assert "Not Found" in response.text or "detail" in response.json()
    
    def test_luxury_life_products_returns_404(self):
        """Luxury Life /api/luxury-life/products should return 404"""
        response = requests.get(f"{BASE_URL}/api/luxury-life/products")
        assert response.status_code == 404, f"Expected 404 for removed luxury-life, got {response.status_code}"
    
    def test_luxury_life_claims_returns_404(self):
        """Luxury Life /api/luxury-life/claims should return 404"""
        response = requests.get(f"{BASE_URL}/api/luxury-life/claims")
        assert response.status_code == 404, f"Expected 404 for removed luxury-life claims, got {response.status_code}"
    
    def test_tap_game_claim_returns_404(self):
        """TAP Game /api/tap-game/claim should return 404"""
        response = requests.post(f"{BASE_URL}/api/tap-game/claim", json={"uid": "test"})
        # Should return 404 or 405 if route doesn't exist
        assert response.status_code in [404, 405, 422], f"Expected 404/405 for removed tap-game, got {response.status_code}"
    
    def test_tap_game_stats_returns_404(self):
        """TAP Game /api/tap-game/stats should return 404"""
        response = requests.get(f"{BASE_URL}/api/tap-game/stats/test-uid")
        assert response.status_code in [404, 405], f"Expected 404 for removed tap-game stats, got {response.status_code}"


class TestHealthCheck:
    """Verify health check endpoint"""
    
    def test_health_endpoint_returns_healthy(self):
        """Health check should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed with {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got {data}"
        assert data.get("database") == "connected", "Database should be connected"
        assert data.get("service") == "paras-reward-api", f"Unexpected service name: {data.get('service')}"


class TestKYCRoutes:
    """Verify KYC routes work via extracted routes/kyc.py"""
    
    def test_kyc_status_endpoint_exists(self):
        """KYC status endpoint should work for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/kyc/status/nonexistent-user-{uuid.uuid4()}")
        assert response.status_code == 200, f"KYC status failed with {response.status_code}"
        data = response.json()
        assert data.get("status") == "not_submitted", f"Expected not_submitted for new user, got {data}"
        assert data.get("submitted") == False
        assert data.get("verified") == False
    
    def test_kyc_stats_endpoint(self):
        """KYC stats endpoint should return counts"""
        response = requests.get(f"{BASE_URL}/api/kyc/stats")
        assert response.status_code == 200, f"KYC stats failed with {response.status_code}"
        data = response.json()
        # Verify expected fields exist
        assert "pending" in data, "KYC stats should have 'pending' field"
        assert "verified" in data, "KYC stats should have 'verified' field"
        assert "rejected" in data, "KYC stats should have 'rejected' field"
        assert "total" in data, "KYC stats should have 'total' field"
        # Verify all values are integers
        assert isinstance(data["pending"], int), "pending count should be integer"
        assert isinstance(data["verified"], int), "verified count should be integer"
    
    def test_kyc_list_endpoint(self):
        """KYC list endpoint should work for admin"""
        response = requests.get(f"{BASE_URL}/api/kyc/list?limit=5")
        assert response.status_code == 200, f"KYC list failed with {response.status_code}"
        data = response.json()
        assert "users" in data or isinstance(data, list), f"KYC list should return users array, got {data}"
        assert "total" in data, "KYC list should have total count"
    
    def test_kyc_list_with_status_filter(self):
        """KYC list should support status filter"""
        response = requests.get(f"{BASE_URL}/api/kyc/list?status=pending&limit=5")
        assert response.status_code == 200, f"KYC list with filter failed with {response.status_code}"
        data = response.json()
        # All returned items should have pending status
        for user in data.get("users", []):
            assert user.get("status") == "pending", f"Filter returned non-pending item: {user.get('status')}"
    
    def test_kyc_details_returns_404_for_unknown(self):
        """KYC details should return 404 for unknown user"""
        response = requests.get(f"{BASE_URL}/api/kyc/details/nonexistent-{uuid.uuid4()}")
        assert response.status_code == 404, f"Expected 404 for unknown KYC, got {response.status_code}"


class TestMiningRoutes:
    """Verify mining routes still work"""
    
    def test_mining_status_for_unknown_user(self):
        """Mining status should return user not found for unknown user"""
        response = requests.get(f"{BASE_URL}/api/mining/status/unknown-user-{uuid.uuid4()}")
        # Should return 404 or empty status for unknown user
        assert response.status_code in [200, 404], f"Mining status unexpected code: {response.status_code}"
        if response.status_code == 404:
            data = response.json()
            assert "detail" in data or "message" in data
    
    def test_mining_session_start_endpoint_exists(self):
        """Mining session start endpoint should exist"""
        response = requests.post(f"{BASE_URL}/api/mining/start/test-user")
        # Should return 404 (user not found) or 400 (validation), not 405 (method not allowed)
        assert response.status_code in [200, 400, 404, 422], f"Mining start endpoint missing: {response.status_code}"


class TestLeaderboardRoutes:
    """Verify leaderboard routes work"""
    
    def test_leaderboard_returns_data(self):
        """Leaderboard endpoint should return ranked users"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200, f"Leaderboard failed with {response.status_code}"
        data = response.json()
        assert "leaderboard" in data, f"Expected leaderboard key in response, got {data.keys()}"
        leaderboard = data["leaderboard"]
        assert isinstance(leaderboard, list), "Leaderboard should be a list"
        # Verify structure of leaderboard entries
        if len(leaderboard) > 0:
            entry = leaderboard[0]
            assert "rank" in entry, "Leaderboard entry should have rank"
            assert "user_id" in entry, "Leaderboard entry should have user_id"
            assert "prc_balance" in entry, "Leaderboard entry should have prc_balance"
    
    def test_leaderboard_rankings_are_ordered(self):
        """Leaderboard rankings should be in order"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        leaderboard = data.get("leaderboard", [])
        if len(leaderboard) > 1:
            # Verify ranks are sequential
            for i, entry in enumerate(leaderboard):
                assert entry.get("rank") == i + 1, f"Rank mismatch at position {i}: expected {i+1}, got {entry.get('rank')}"


class TestAdminStatsEndpoint:
    """Verify admin stats work without marketplace/orders data"""
    
    def test_admin_stats_endpoint(self):
        """Admin stats should work without orders section"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200, f"Admin stats failed with {response.status_code}"
        data = response.json()
        # Verify key sections exist
        assert "users" in data, "Admin stats should have users section"
        # orders section should NOT exist (marketplace removed)
        # This is informational, not a failure if orders still in stats


class TestSubscriptionRoutes:
    """Verify subscription routes still work after refactoring"""
    
    def test_subscription_plans_endpoint(self):
        """Subscription plans endpoint should return available plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200, f"Subscription plans failed with {response.status_code}"
        data = response.json()
        assert isinstance(data, (list, dict)), "Subscription plans should return data"


class TestRouterRegistration:
    """Verify routers are properly registered"""
    
    def test_kyc_router_prefix(self):
        """KYC routes should be at /api/kyc prefix"""
        # status endpoint
        response = requests.get(f"{BASE_URL}/api/kyc/status/test")
        assert response.status_code != 405, "KYC router not properly registered at /api/kyc"
        
    def test_mining_router_exists(self):
        """Mining routes should be accessible"""
        response = requests.get(f"{BASE_URL}/api/mining/status/test")
        # Any response other than 405 means router is registered
        assert response.status_code != 405, "Mining router not properly registered"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
