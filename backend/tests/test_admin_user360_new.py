"""
Admin User 360 New API Tests
Tests for the restructured User 360 endpoints:
- /api/admin/user360/search
- /api/admin/user360/full/{uid}
- /api/admin/user360/action/{uid}
- /api/admin/user360/quick-stats/{uid}
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
TEST_USER_UID = "fcd8c6f8-9596-4f56-8556-568847d5ab86"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PIN}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code}")


@pytest.fixture
def auth_headers(admin_token):
    """Headers with admin token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestUser360Search:
    """Tests for /api/admin/user360/search endpoint"""
    
    def test_search_by_uid(self, auth_headers):
        """Search user by UID"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/search?q={TEST_USER_UID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "user" in data
        assert data["user"]["uid"] == TEST_USER_UID
        print(f"✓ Search by UID returned user: {data['user']['name']}")
    
    def test_search_by_email(self, auth_headers):
        """Search user by email"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/search?q={ADMIN_EMAIL}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Search by email returned user: {data['user']['name']}")
    
    def test_search_not_found(self, auth_headers):
        """Search for non-existent user returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/search?q=nonexistent@test.com",
            headers=auth_headers
        )
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
        print("✓ Non-existent user returns 404")
    
    def test_search_short_query(self, auth_headers):
        """Search with too short query returns 400"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/search?q=a",
            headers=auth_headers
        )
        assert response.status_code == 400
        print("✓ Short query returns 400")
    
    def test_search_requires_auth(self):
        """Search without auth returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/search?q={TEST_USER_UID}"
        )
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated request rejected")


class TestUser360FullData:
    """Tests for /api/admin/user360/full/{uid} endpoint"""
    
    def test_get_full_user_data(self, auth_headers):
        """Get complete 360 view of user"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/full/{TEST_USER_UID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["success"] is True
        assert "user" in data
        assert "stats" in data
        assert "referral" in data
        assert "transactions" in data
        assert "redeem_requests" in data
        
        # Verify user data
        assert data["user"]["uid"] == TEST_USER_UID
        
        # Verify stats structure
        assert "total_mined" in data["stats"]
        assert "total_redeemed" in data["stats"]
        assert "total_referral_bonus" in data["stats"]
        
        # Verify referral structure
        assert "l1_count" in data["referral"]
        assert "l2_count" in data["referral"]
        assert "total_network" in data["referral"]
        
        print(f"✓ Full data loaded for user: {data['user']['name']}")
        print(f"  - Stats: mined={data['stats']['total_mined']}, redeemed={data['stats']['total_redeemed']}")
        print(f"  - Referrals: L1={data['referral']['l1_count']}, L2={data['referral']['l2_count']}")
    
    def test_full_data_not_found(self, auth_headers):
        """Get full data for non-existent user returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/full/nonexistent-uid-12345",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("✓ Non-existent user returns 404")


class TestUser360QuickStats:
    """Tests for /api/admin/user360/quick-stats/{uid} endpoint"""
    
    def test_get_quick_stats(self, auth_headers):
        """Get quick stats for user"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/quick-stats/{TEST_USER_UID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "user" in data
        assert "counts" in data
        
        # Verify counts structure
        assert "transactions" in data["counts"]
        assert "redeems" in data["counts"]
        assert "referrals" in data["counts"]
        
        print(f"✓ Quick stats: txns={data['counts']['transactions']}, redeems={data['counts']['redeems']}, referrals={data['counts']['referrals']}")


class TestUser360Actions:
    """Tests for /api/admin/user360/action/{uid} endpoint"""
    
    def test_add_prc_action(self, auth_headers):
        """Test adding PRC to user"""
        # Get initial balance
        initial_response = requests.get(
            f"{BASE_URL}/api/admin/user360/quick-stats/{TEST_USER_UID}",
            headers=auth_headers
        )
        initial_balance = initial_response.json()["user"]["prc_balance"]
        
        # Add PRC
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "add_prc",
                "value": 5.0,
                "reason": "Test credit from pytest",
                "admin_id": "admin-test-123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "prc_balance" in data["updated_fields"]
        
        # Verify balance increased
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/user360/quick-stats/{TEST_USER_UID}",
            headers=auth_headers
        )
        new_balance = verify_response.json()["user"]["prc_balance"]
        assert new_balance == initial_balance + 5.0
        print(f"✓ PRC added: {initial_balance} -> {new_balance}")
    
    def test_deduct_prc_action(self, auth_headers):
        """Test deducting PRC from user"""
        # Get initial balance
        initial_response = requests.get(
            f"{BASE_URL}/api/admin/user360/quick-stats/{TEST_USER_UID}",
            headers=auth_headers
        )
        initial_balance = initial_response.json()["user"]["prc_balance"]
        
        # Deduct PRC
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "deduct_prc",
                "value": 5.0,
                "reason": "Test debit from pytest",
                "admin_id": "admin-test-123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Verify balance decreased
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/user360/quick-stats/{TEST_USER_UID}",
            headers=auth_headers
        )
        new_balance = verify_response.json()["user"]["prc_balance"]
        assert new_balance == initial_balance - 5.0
        print(f"✓ PRC deducted: {initial_balance} -> {new_balance}")
    
    def test_ban_unban_action(self, auth_headers):
        """Test ban and unban user"""
        # Ban user
        ban_response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "ban",
                "reason": "Test ban from pytest",
                "admin_id": "admin-test-123"
            }
        )
        assert ban_response.status_code == 200
        assert ban_response.json()["success"] is True
        
        # Verify banned
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/user360/quick-stats/{TEST_USER_UID}",
            headers=auth_headers
        )
        assert verify_response.json()["user"]["is_banned"] is True
        print("✓ User banned successfully")
        
        # Unban user
        unban_response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "unban",
                "admin_id": "admin-test-123"
            }
        )
        assert unban_response.status_code == 200
        assert unban_response.json()["success"] is True
        
        # Verify unbanned
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/user360/quick-stats/{TEST_USER_UID}",
            headers=auth_headers
        )
        assert verify_response.json()["user"]["is_banned"] is False
        print("✓ User unbanned successfully")
    
    def test_invalid_action(self, auth_headers):
        """Test invalid action returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "invalid_action",
                "admin_id": "admin-test-123"
            }
        )
        assert response.status_code == 400
        print("✓ Invalid action returns 400")
    
    def test_add_prc_negative_amount(self, auth_headers):
        """Test adding negative PRC returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "add_prc",
                "value": -10,
                "admin_id": "admin-test-123"
            }
        )
        assert response.status_code == 400
        print("✓ Negative amount returns 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
