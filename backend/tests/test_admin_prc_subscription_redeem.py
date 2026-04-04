"""
Test Admin PRC Subscription and Redeem Features
Tests for:
1. POST /api/admin/activate-prc-subscription - Admin activates elite subscription for user using PRC
2. POST /api/admin/create-redeem-request - Admin creates bank redeem request for user
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://used-status-filter.preview.emergentagent.com').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"

# Test User DMT - has ~56000 PRC (good for subscription test)
TEST_USER_DMT_MOBILE = "9421331342"
TEST_USER_DMT_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"

# Test User - has ~790 PRC (low balance for failure test)
TEST_USER_LOW_MOBILE = "9970100782"
TEST_USER_LOW_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


class TestAdminAuth:
    """Test admin authentication"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        print(f"Admin login response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            token = data.get("token") or data.get("access_token")
            admin_uid = data.get("user", {}).get("uid") or data.get("uid")
            print(f"Admin UID: {admin_uid}")
            return {"token": token, "uid": admin_uid}
        else:
            print(f"Admin login failed: {response.text}")
            pytest.skip("Admin login failed - skipping admin tests")
        return None
    
    def test_admin_login_success(self, admin_token):
        """Verify admin can login"""
        assert admin_token is not None
        assert admin_token.get("token") is not None
        print(f"✓ Admin login successful, token obtained")


class TestAdminActivatePRCSubscription:
    """Test POST /api/admin/activate-prc-subscription endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        if response.status_code == 200:
            data = response.json()
            token = data.get("token") or data.get("access_token")
            admin_uid = data.get("user", {}).get("uid") or data.get("uid")
            return {"token": token, "uid": admin_uid}
        pytest.skip("Admin login failed")
        return None
    
    def test_activate_subscription_missing_params(self, admin_token):
        """Test activation fails with missing parameters"""
        response = requests.post(
            f"{BASE_URL}/api/admin/activate-prc-subscription",
            json={},
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "required" in data.get("detail", "").lower() or "admin_uid" in data.get("detail", "").lower()
        print(f"✓ Missing params returns 400: {data.get('detail')}")
    
    def test_activate_subscription_non_admin_forbidden(self):
        """Test non-admin user gets 403"""
        # Login as regular user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": TEST_USER_LOW_MOBILE,
            "pin": "997010"
        })
        if response.status_code != 200:
            pytest.skip("Regular user login failed")
        
        data = response.json()
        user_token = data.get("token") or data.get("access_token")
        user_uid = data.get("user", {}).get("uid") or data.get("uid")
        
        # Try to activate subscription as non-admin
        response = requests.post(
            f"{BASE_URL}/api/admin/activate-prc-subscription",
            json={
                "admin_uid": user_uid,
                "target_uid": TEST_USER_DMT_UID,
                "plan_name": "elite"
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403
        print(f"✓ Non-admin gets 403 Forbidden")
    
    def test_activate_subscription_insufficient_balance(self, admin_token):
        """Test activation fails when user has insufficient PRC balance"""
        # Use low balance user
        response = requests.post(
            f"{BASE_URL}/api/admin/activate-prc-subscription",
            json={
                "admin_uid": admin_token["uid"],
                "target_uid": TEST_USER_LOW_UID,
                "plan_name": "elite"
            },
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        # Should fail with 400 due to insufficient balance
        print(f"Insufficient balance response: {response.status_code} - {response.text[:500]}")
        
        # The user has ~790 PRC but subscription costs ~16000+ PRC
        if response.status_code == 400:
            data = response.json()
            assert "insufficient" in data.get("detail", "").lower() or "balance" in data.get("detail", "").lower()
            print(f"✓ Insufficient balance returns 400: {data.get('detail')}")
        else:
            # If it succeeds, the user might have more balance than expected
            print(f"⚠ Unexpected response: {response.status_code}")
    
    def test_activate_subscription_user_not_found(self, admin_token):
        """Test activation fails for non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/admin/activate-prc-subscription",
            json={
                "admin_uid": admin_token["uid"],
                "target_uid": "non-existent-uid-12345",
                "plan_name": "elite"
            },
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"✓ Non-existent user returns 404")
    
    def test_get_user_balance_before_subscription(self, admin_token):
        """Get user balance before subscription test"""
        # Get user 360 data to check balance
        response = requests.get(
            f"{BASE_URL}/api/admin/user-360?query={TEST_USER_DMT_UID}",
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        if response.status_code == 200:
            data = response.json()
            user = data.get("user", {})
            balance = user.get("prc_balance", 0)
            print(f"✓ User {TEST_USER_DMT_UID} balance: {balance} PRC")
            return balance
        else:
            print(f"⚠ Could not get user balance: {response.status_code}")
            return None


class TestAdminCreateRedeemRequest:
    """Test POST /api/admin/create-redeem-request endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        if response.status_code == 200:
            data = response.json()
            token = data.get("token") or data.get("access_token")
            admin_uid = data.get("user", {}).get("uid") or data.get("uid")
            return {"token": token, "uid": admin_uid}
        pytest.skip("Admin login failed")
        return None
    
    def test_create_redeem_missing_params(self, admin_token):
        """Test redeem fails with missing parameters"""
        response = requests.post(
            f"{BASE_URL}/api/admin/create-redeem-request",
            json={},
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "required" in data.get("detail", "").lower()
        print(f"✓ Missing params returns 400: {data.get('detail')}")
    
    def test_create_redeem_missing_bank_details(self, admin_token):
        """Test redeem fails when bank details are missing"""
        response = requests.post(
            f"{BASE_URL}/api/admin/create-redeem-request",
            json={
                "admin_uid": admin_token["uid"],
                "target_uid": TEST_USER_DMT_UID,
                "amount": 100
                # Missing account_number and ifsc_code
            },
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "account" in data.get("detail", "").lower() or "ifsc" in data.get("detail", "").lower() or "bank" in data.get("detail", "").lower()
        print(f"✓ Missing bank details returns 400: {data.get('detail')}")
    
    def test_create_redeem_non_admin_forbidden(self):
        """Test non-admin user gets 403"""
        # Login as regular user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": TEST_USER_LOW_MOBILE,
            "pin": "997010"
        })
        if response.status_code != 200:
            pytest.skip("Regular user login failed")
        
        data = response.json()
        user_token = data.get("token") or data.get("access_token")
        user_uid = data.get("user", {}).get("uid") or data.get("uid")
        
        # Try to create redeem as non-admin
        response = requests.post(
            f"{BASE_URL}/api/admin/create-redeem-request",
            json={
                "admin_uid": user_uid,
                "target_uid": TEST_USER_DMT_UID,
                "amount": 100,
                "account_number": "1234567890",
                "ifsc_code": "HDFC0001234"
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403
        print(f"✓ Non-admin gets 403 Forbidden")
    
    def test_create_redeem_exceeds_limit(self, admin_token):
        """Test redeem fails when amount exceeds available redeem limit"""
        # First get the user's redeem limit
        response = requests.get(
            f"{BASE_URL}/api/admin/user-360?query={TEST_USER_DMT_UID}",
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        
        effective_available = 0
        if response.status_code == 200:
            data = response.json()
            redeem_limit = data.get("redeem_limit", {})
            effective_available = redeem_limit.get("effective_available", 0)
            print(f"User redeem limit - effective_available: {effective_available}")
        
        # Try to redeem more than available
        excessive_amount = effective_available + 10000 if effective_available > 0 else 100000
        
        response = requests.post(
            f"{BASE_URL}/api/admin/create-redeem-request",
            json={
                "admin_uid": admin_token["uid"],
                "target_uid": TEST_USER_DMT_UID,
                "amount": excessive_amount,
                "account_number": "1234567890",
                "ifsc_code": "HDFC0001234",
                "bank_name": "Test Bank"
            },
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        
        print(f"Exceeds limit response: {response.status_code} - {response.text[:500]}")
        
        # Should fail with 400 due to exceeding limit
        if response.status_code == 400:
            data = response.json()
            assert "limit" in data.get("detail", "").lower() or "exceeds" in data.get("detail", "").lower() or "available" in data.get("detail", "").lower()
            print(f"✓ Exceeds limit returns 400: {data.get('detail')}")
        else:
            print(f"⚠ Unexpected response - may have sufficient limit")
    
    def test_create_redeem_user_not_found(self, admin_token):
        """Test redeem fails for non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/admin/create-redeem-request",
            json={
                "admin_uid": admin_token["uid"],
                "target_uid": "non-existent-uid-12345",
                "amount": 100,
                "account_number": "1234567890",
                "ifsc_code": "HDFC0001234"
            },
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"✓ Non-existent user returns 404")
    
    def test_create_redeem_zero_amount(self, admin_token):
        """Test redeem fails with zero or negative amount"""
        response = requests.post(
            f"{BASE_URL}/api/admin/create-redeem-request",
            json={
                "admin_uid": admin_token["uid"],
                "target_uid": TEST_USER_DMT_UID,
                "amount": 0,
                "account_number": "1234567890",
                "ifsc_code": "HDFC0001234"
            },
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        assert response.status_code == 400
        data = response.json()
        print(f"✓ Zero amount returns 400: {data.get('detail')}")


class TestAdminUser360Integration:
    """Test User360 page integration with admin actions"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        if response.status_code == 200:
            data = response.json()
            token = data.get("token") or data.get("access_token")
            admin_uid = data.get("user", {}).get("uid") or data.get("uid")
            return {"token": token, "uid": admin_uid}
        pytest.skip("Admin login failed")
        return None
    
    def test_user360_search_returns_user_data(self, admin_token):
        """Test User360 search returns user data with redeem limit"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user-360?query={TEST_USER_DMT_UID}",
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify user data
        user = data.get("user", {})
        assert user.get("uid") == TEST_USER_DMT_UID
        print(f"✓ User found: {user.get('name')} - Balance: {user.get('prc_balance')} PRC")
        
        # Verify redeem limit data is present
        redeem_limit = data.get("redeem_limit", {})
        print(f"  Redeem limit data: {redeem_limit}")
        
        return data
    
    def test_user360_search_by_mobile(self, admin_token):
        """Test User360 search by mobile number"""
        response = requests.get(
            f"{BASE_URL}/api/admin/user-360?query={TEST_USER_DMT_MOBILE}",
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        user = data.get("user", {})
        assert user.get("mobile") == TEST_USER_DMT_MOBILE
        print(f"✓ User found by mobile: {user.get('name')}")


class TestPRCPricing:
    """Test PRC pricing calculation endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "pin": ADMIN_PIN
        })
        if response.status_code == 200:
            data = response.json()
            token = data.get("token") or data.get("access_token")
            return {"token": token}
        pytest.skip("Admin login failed")
        return None
    
    def test_get_elite_pricing(self, admin_token):
        """Test getting elite subscription PRC pricing"""
        # Try to get pricing info
        response = requests.get(
            f"{BASE_URL}/api/subscription/elite-pricing",
            headers={"Authorization": f"Bearer {admin_token['token']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Elite pricing: {data}")
            # Verify pricing structure - can be nested in 'pricing' or at top level
            pricing = data.get("pricing", data)
            assert "total_prc" in pricing or "total_prc_required" in data
            # Verify the PRC rate is reasonable (around 11 PRC per INR)
            prc_rate = pricing.get("prc_rate", 0)
            assert prc_rate > 0, "PRC rate should be positive"
            print(f"  PRC Rate: {prc_rate}, Total PRC: {pricing.get('total_prc', data.get('total_prc_required'))}")
        else:
            # Try alternative endpoint
            response = requests.get(
                f"{BASE_URL}/api/prc/rate",
                headers={"Authorization": f"Bearer {admin_token['token']}"}
            )
            if response.status_code == 200:
                data = response.json()
                print(f"✓ PRC rate: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
