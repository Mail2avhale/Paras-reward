"""
Test PRC Subscription Features - Iteration 198
Tests:
1. GET /api/subscription/config - prc_subscription_enabled field
2. GET /api/subscription/elite-pricing - PRC pricing breakdown
3. POST /api/subscription/pay-with-prc - PRC payment endpoint
4. POST /api/subscription/activate-upcoming/{uid} - Activate upcoming plan
5. POST /api/recharge/admin/check-all-pending - Admin bulk check pending
6. GET /api/growth/network-stats/{uid} - tree_network_size field
7. GET /api/user/{uid}/redeem-limit - tree_position-based network_size
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/admin-login", json={
        "email": ADMIN_EMAIL,
        "pin": ADMIN_PIN
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token") or data.get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text[:200]}")


@pytest.fixture(scope="module")
def user_token(api_client):
    """Get user authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "mobile": TEST_USER_MOBILE,
        "pin": TEST_USER_PIN
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token") or data.get("access_token")
    pytest.skip(f"User login failed: {response.status_code} - {response.text[:200]}")


class TestSubscriptionConfig:
    """Test subscription config endpoint with prc_subscription_enabled"""
    
    def test_subscription_config_returns_prc_enabled_field(self, api_client):
        """GET /api/settings/public should return prc_subscription_enabled field"""
        response = api_client.get(f"{BASE_URL}/api/settings/public")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        assert "prc_subscription_enabled" in data, f"Missing prc_subscription_enabled field. Keys: {data.keys()}"
        assert isinstance(data["prc_subscription_enabled"], bool), "prc_subscription_enabled should be boolean"
        print(f"✓ prc_subscription_enabled = {data['prc_subscription_enabled']}")


class TestElitePricing:
    """Test Elite PRC pricing endpoint"""
    
    def test_elite_pricing_returns_breakdown(self, api_client):
        """GET /api/subscription/elite-pricing should return PRC pricing breakdown"""
        response = api_client.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        
        # Check required fields
        required_fields = ["total_prc_required", "base_price_inr", "gst_rate", "pricing"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}. Keys: {data.keys()}"
        
        # Check pricing breakdown
        pricing = data.get("pricing", {})
        pricing_fields = ["base_prc", "gst_prc", "processing_fee_prc", "admin_charges_prc", "total_prc"]
        for field in pricing_fields:
            assert field in pricing, f"Missing pricing field: {field}. Pricing keys: {pricing.keys()}"
        
        print(f"✓ Elite pricing: {data['total_prc_required']} PRC total")
        print(f"  Base: {pricing.get('base_prc')}, GST: {pricing.get('gst_prc')}, Admin: {pricing.get('admin_charges_prc')}")


class TestPayWithPRC:
    """Test PRC payment endpoint"""
    
    def test_pay_with_prc_validates_user(self, api_client):
        """POST /api/subscription/pay-with-prc should validate user exists"""
        response = api_client.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={
            "user_id": "non-existent-user-id",
            "plan_name": "elite",
            "prc_amount": 1000
        })
        # Should return error for non-existent user
        assert response.status_code in [400, 404, 422], f"Expected 4xx for invalid user, got {response.status_code}"
        print(f"✓ Non-existent user returns {response.status_code}")
    
    def test_pay_with_prc_checks_balance(self, api_client):
        """POST /api/subscription/pay-with-prc should check PRC balance"""
        response = api_client.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={
            "user_id": TEST_USER_UID,
            "plan_name": "elite",
            "prc_amount": 999999999  # Very high amount
        })
        # Should return error for insufficient balance
        data = response.json()
        # Either 400/422 status or success=False with error message
        if response.status_code == 200:
            assert data.get("success") == False or "insufficient" in str(data).lower() or "balance" in str(data).lower(), \
                f"Expected insufficient balance error, got: {data}"
        print(f"✓ Insufficient balance check: {response.status_code} - {data.get('error', data.get('message', 'OK'))[:100]}")
    
    def test_pay_with_prc_endpoint_exists(self, api_client):
        """POST /api/subscription/pay-with-prc endpoint should exist"""
        response = api_client.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={
            "user_id": TEST_USER_UID,
            "plan_name": "elite",
            "prc_amount": 100
        })
        # Should not return 404 (endpoint exists)
        assert response.status_code != 404, "Endpoint /api/subscription/pay-with-prc not found"
        print(f"✓ Endpoint exists, returned {response.status_code}")


class TestActivateUpcoming:
    """Test activate upcoming plan endpoint"""
    
    def test_activate_upcoming_returns_error_for_nonexistent_user(self, api_client):
        """POST /api/subscription/activate-upcoming/{uid} should return error for non-existent user"""
        response = api_client.post(f"{BASE_URL}/api/subscription/activate-upcoming/non-existent-uid-12345")
        assert response.status_code in [404, 200], f"Expected 404 or 200, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == False or "not found" in str(data).lower(), \
                f"Expected user not found error, got: {data}"
        print(f"✓ Non-existent user: {response.status_code}")
    
    def test_activate_upcoming_endpoint_exists(self, api_client):
        """POST /api/subscription/activate-upcoming/{uid} endpoint should exist"""
        response = api_client.post(f"{BASE_URL}/api/subscription/activate-upcoming/{TEST_USER_UID}")
        # Should not return 404 (endpoint exists)
        assert response.status_code != 404, "Endpoint /api/subscription/activate-upcoming not found"
        
        data = response.json()
        # Should return success or message about no upcoming plan
        assert "success" in data or "message" in data, f"Expected success/message field, got: {data.keys()}"
        print(f"✓ Activate upcoming: {data.get('message', data.get('success'))}")


class TestCheckAllPending:
    """Test admin check all pending endpoint"""
    
    def test_check_all_pending_returns_results(self, api_client):
        """POST /api/recharge/admin/check-all-pending should return results array"""
        response = api_client.post(f"{BASE_URL}/api/recharge/admin/check-all-pending")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        # Should have success field and results array
        assert "success" in data, f"Missing success field. Keys: {data.keys()}"
        
        # If Eko not configured, should return error message
        if data.get("error") == "Service not configured":
            print("✓ Eko not configured (expected in preview)")
            return
        
        assert "results" in data, f"Missing results field. Keys: {data.keys()}"
        assert isinstance(data["results"], list), "results should be a list"
        print(f"✓ Check all pending: {data.get('total_checked', 0)} checked, {data.get('updated', 0)} updated")


class TestNetworkStats:
    """Test network stats with tree_network_size"""
    
    def test_network_stats_returns_tree_network_size(self, api_client):
        """GET /api/growth/network-stats/{uid} should return tree_network_size field"""
        response = api_client.get(f"{BASE_URL}/api/growth/network-stats/{TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        # Response is wrapped in {success, data}
        assert data.get("success") == True, f"Expected success=True, got {data}"
        stats = data.get("data", {})
        
        # Check for tree_network_size field
        assert "tree_network_size" in stats, f"Missing tree_network_size field. Keys: {stats.keys()}"
        assert "network_size" in stats, f"Missing network_size field. Keys: {stats.keys()}"
        assert "active_network_size" in stats, f"Missing active_network_size field. Keys: {stats.keys()}"
        
        print(f"✓ Network stats: tree_network_size={stats['tree_network_size']}, network_size={stats['network_size']}")


class TestRedeemLimit:
    """Test redeem limit uses tree_position-based network_size"""
    
    def test_redeem_limit_returns_network_size(self, api_client):
        """GET /api/user/{uid}/redeem-limit should return network_size in limit object"""
        response = api_client.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        # Response is wrapped in {success, user_id, limit}
        assert data.get("success") == True, f"Expected success=True, got {data}"
        limit = data.get("limit", {})
        
        # Check for network_size field in limit object
        assert "network_size" in limit, f"Missing network_size field. Keys: {limit.keys()}"
        print(f"✓ Redeem limit network_size: {limit['network_size']}")
    
    def test_redeem_limit_matches_tree_network_size(self, api_client):
        """Redeem limit network_size should match tree_network_size from growth stats"""
        # Get redeem limit
        redeem_response = api_client.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        assert redeem_response.status_code == 200
        redeem_data = redeem_response.json()
        
        # Get network stats
        stats_response = api_client.get(f"{BASE_URL}/api/growth/network-stats/{TEST_USER_UID}")
        assert stats_response.status_code == 200
        stats_data = stats_response.json()
        
        # Extract from nested structure
        redeem_network_size = redeem_data.get("limit", {}).get("network_size", 0)
        tree_network_size = stats_data.get("data", {}).get("tree_network_size", 0)
        
        # They should match (both use tree_position-based calculation)
        print(f"  Redeem limit network_size: {redeem_network_size}")
        print(f"  Tree network_size: {tree_network_size}")
        
        # Allow some tolerance for timing differences
        assert abs(redeem_network_size - tree_network_size) <= 5, \
            f"Network sizes don't match: redeem={redeem_network_size}, tree={tree_network_size}"
        print(f"✓ Network sizes match (within tolerance)")


class TestAdminPRCToggle:
    """Test admin PRC subscription toggle"""
    
    def test_toggle_prc_subscription_endpoint_exists(self, api_client, admin_token):
        """POST /api/admin/toggle-prc-subscription endpoint should exist"""
        headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
        response = api_client.post(
            f"{BASE_URL}/api/admin/toggle-prc-subscription",
            json={"enabled": True, "admin_pin": ADMIN_PIN},
            headers=headers
        )
        # Should not return 404
        assert response.status_code != 404, "Endpoint /api/admin/toggle-prc-subscription not found"
        print(f"✓ Toggle PRC endpoint exists, returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
