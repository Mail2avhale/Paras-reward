"""
Admin User 360 Actions API Tests - New Features
Tests for the new admin actions added to User 360:
- block_user / unblock_user (aliases for ban/unban)
- reset_pin (returns new_pin)
- change_role
- change_referral (supports 'remove' keyword)
- add_prc / deduct_prc
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
TEST_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"
TEST_USER_EMAIL = "test@parasreward.com"
ADMIN_UID = "admin-test-123"


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


class TestSearchEndpoints:
    """Tests for search endpoints"""
    
    def test_search_by_email(self, auth_headers):
        """Search user by email (test@parasreward.com)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user360/search?q={TEST_USER_EMAIL}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
        print(f"✓ Search by email returned user: {data['user']['name']}")
    
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


class TestFullViewEndpoint:
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
        
        print(f"✓ Full data loaded for user: {data['user']['name']}")
        print(f"  - PRC Balance: {data['user'].get('prc_balance', 0)}")
        print(f"  - Stats: mined={data['stats']['total_mined']}, redeemed={data['stats']['total_redeemed']}")


class TestBlockUnblockActions:
    """Tests for block_user and unblock_user actions"""
    
    def test_block_user_action(self, auth_headers):
        """Test blocking a user"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "block_user",
                "reason": "Test block from pytest",
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "is_banned" in data["updated_fields"]
        assert "ban_reason" in data["updated_fields"]
        print("✓ block_user action completed successfully")
        
        # Verify user is blocked
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/user360/quick-stats/{TEST_USER_UID}",
            headers=auth_headers
        )
        assert verify_response.json()["user"]["is_banned"] is True
        print("✓ User is_banned = True verified")
    
    def test_unblock_user_action(self, auth_headers):
        """Test unblocking a user"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "unblock_user",
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "is_banned" in data["updated_fields"]
        print("✓ unblock_user action completed successfully")
        
        # Verify user is unblocked
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/user360/quick-stats/{TEST_USER_UID}",
            headers=auth_headers
        )
        assert verify_response.json()["user"]["is_banned"] is False
        print("✓ User is_banned = False verified")


class TestResetPinAction:
    """Tests for reset_pin action"""
    
    def test_reset_pin_returns_new_pin(self, auth_headers):
        """Test PIN reset returns new 6-digit PIN"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "reset_pin",
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "new_pin" in data
        assert len(data["new_pin"]) == 6
        assert data["new_pin"].isdigit()
        assert "hashed_pin" in data["updated_fields"]
        print(f"✓ reset_pin returned new PIN: {data['new_pin']}")


class TestChangeRoleAction:
    """Tests for change_role action"""
    
    def test_change_role_to_sub_admin(self, auth_headers):
        """Test changing user role to sub_admin"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "change_role",
                "new_role": "sub_admin",
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "role" in data["updated_fields"]
        print("✓ change_role to sub_admin completed")
    
    def test_change_role_back_to_user(self, auth_headers):
        """Test changing user role back to user"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "change_role",
                "new_role": "user",
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        print("✓ change_role back to user completed")
    
    def test_change_role_invalid_role(self, auth_headers):
        """Test invalid role returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "change_role",
                "new_role": "invalid_role",
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 400
        print("✓ Invalid role returns 400")


class TestChangeReferralAction:
    """Tests for change_referral action"""
    
    def test_change_referral_to_valid_uid(self, auth_headers):
        """Test changing referral to valid UID"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "change_referral",
                "new_referrer": ADMIN_UID,
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "referred_by" in data["updated_fields"]
        print(f"✓ change_referral to {ADMIN_UID} completed")
    
    def test_remove_referral(self, auth_headers):
        """Test removing referral with 'remove' keyword"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "change_referral",
                "new_referrer": "remove",
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "referred_by" in data["updated_fields"]
        assert "referral_removed_at" in data["updated_fields"]
        print("✓ Referral removed successfully")
    
    def test_change_referral_invalid_uid(self, auth_headers):
        """Test invalid referrer UID returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "change_referral",
                "new_referrer": "invalid-uid-12345",
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
        print("✓ Invalid referrer UID returns 404")
    
    def test_change_referral_self_reference(self, auth_headers):
        """Test user cannot be their own referrer"""
        response = requests.post(
            f"{BASE_URL}/api/admin/user360/action/{TEST_USER_UID}",
            headers=auth_headers,
            json={
                "action": "change_referral",
                "new_referrer": TEST_USER_UID,
                "admin_id": ADMIN_UID
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "own referrer" in data["detail"].lower()
        print("✓ Self-reference returns 400")


class TestPRCBalanceActions:
    """Tests for add_prc and deduct_prc actions"""
    
    def test_add_prc_balance(self, auth_headers):
        """Test adding PRC balance"""
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
                "value": 100,
                "reason": "Test credit from pytest",
                "admin_id": ADMIN_UID
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
        assert new_balance == initial_balance + 100
        print(f"✓ PRC added: {initial_balance} -> {new_balance}")
    
    def test_deduct_prc_balance(self, auth_headers):
        """Test deducting PRC balance"""
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
                "value": 50,
                "reason": "Test debit from pytest",
                "admin_id": ADMIN_UID
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
        assert new_balance == initial_balance - 50
        print(f"✓ PRC deducted: {initial_balance} -> {new_balance}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
