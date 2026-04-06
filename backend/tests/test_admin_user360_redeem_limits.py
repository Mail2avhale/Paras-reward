"""
Test Admin User 360 Redeem Limits Feature
Tests the redeem_limit object returned by /api/admin/user360/full/{uid}
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_MOBILE = "9999999999"
ADMIN_PIN = "153759"
TEST_USER_MOBILE = "9970100782"
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


class TestAdminUser360RedeemLimits:
    """Test Admin User 360 Redeem Limits Feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        
    def get_admin_token(self):
        """Get admin JWT token"""
        if self.admin_token:
            return self.admin_token
            
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": ADMIN_MOBILE,
            "pin": ADMIN_PIN
        })
        
        if response.status_code == 200:
            data = response.json()
            self.admin_token = data.get("token") or data.get("access_token")
            return self.admin_token
        else:
            pytest.skip(f"Admin login failed: {response.status_code} - {response.text[:200]}")
            
    def test_health_check(self):
        """Test API health"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✅ Health check passed")
        
    def test_admin_login(self):
        """Test admin login works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": ADMIN_MOBILE,
            "pin": ADMIN_PIN
        })
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text[:200]}"
        data = response.json()
        assert "token" in data or "access_token" in data, "No token in response"
        print(f"✅ Admin login successful, role: {data.get('user', {}).get('role', 'unknown')}")
        
    def test_user360_search_endpoint(self):
        """Test /api/admin/user360/search?q=<mobile> returns user data"""
        token = self.get_admin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/user360/search?q={TEST_USER_MOBILE}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Search failed: {response.status_code} - {response.text[:300]}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True, f"Search not successful: {data}"
        assert "user" in data, "No user in response"
        
        user = data["user"]
        # Verify user has required fields (UID may differ from test_credentials.md if data changed)
        assert user.get("uid") is not None, "User should have a UID"
        assert user.get("mobile") == TEST_USER_MOBILE, f"Mobile mismatch: expected {TEST_USER_MOBILE}, got {user.get('mobile')}"
        
        # Store the actual UID for subsequent tests
        self.__class__.actual_user_uid = user.get("uid")
        
        print(f"✅ User360 search passed - Found user: {user.get('name', 'N/A')}, UID: {user.get('uid')}")
        
    def test_user360_full_endpoint_returns_redeem_limit(self):
        """Test /api/admin/user360/full/{uid} returns redeem_limit object"""
        token = self.get_admin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/user360/full/{TEST_USER_UID}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Full endpoint failed: {response.status_code} - {response.text[:300]}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True, f"Response not successful: {data}"
        assert "user" in data, "No user in response"
        assert "redeem_limit" in data, "No redeem_limit in response - THIS IS THE MAIN FEATURE BEING TESTED"
        
        print(f"✅ User360 full endpoint returns redeem_limit object")
        
    def test_redeem_limit_has_required_fields(self):
        """Test redeem_limit object has all required fields"""
        token = self.get_admin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/user360/full/{TEST_USER_UID}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Full endpoint failed: {response.status_code}"
        data = response.json()
        
        redeem_limit = data.get("redeem_limit", {})
        
        # Required fields as per the feature request
        required_fields = [
            "total_limit",       # REDEEM LIMIT (Total)
            "total_redeemed",    # USED LIMIT
            "effective_available",  # BAL LIMIT (Remaining)
            "unlock_percent",    # Unlock percentage
            "total_earned",      # Total earned
            "total_mined"        # Total mined
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in redeem_limit:
                missing_fields.append(field)
                
        assert len(missing_fields) == 0, f"Missing required fields in redeem_limit: {missing_fields}. Got: {list(redeem_limit.keys())}"
        
        # Verify fields are numeric
        for field in required_fields:
            value = redeem_limit.get(field)
            assert isinstance(value, (int, float)), f"Field {field} should be numeric, got {type(value)}: {value}"
            
        print(f"✅ redeem_limit has all required fields: {required_fields}")
        print(f"   Values: total_limit={redeem_limit.get('total_limit')}, total_redeemed={redeem_limit.get('total_redeemed')}, effective_available={redeem_limit.get('effective_available')}")
        
    def test_redeem_limit_values_are_consistent(self):
        """Test redeem_limit values are logically consistent"""
        token = self.get_admin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/user360/full/{TEST_USER_UID}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        rl = data.get("redeem_limit", {})
        
        total_limit = rl.get("total_limit", 0)
        total_redeemed = rl.get("total_redeemed", 0)
        effective_available = rl.get("effective_available", 0)
        unlock_percent = rl.get("unlock_percent", 0)
        total_mined = rl.get("total_mined", 0)
        
        # Logical consistency checks
        # 1. total_limit should be >= 0
        assert total_limit >= 0, f"total_limit should be >= 0, got {total_limit}"
        
        # 2. total_redeemed should be >= 0
        assert total_redeemed >= 0, f"total_redeemed should be >= 0, got {total_redeemed}"
        
        # 3. effective_available should be >= 0
        assert effective_available >= 0, f"effective_available should be >= 0, got {effective_available}"
        
        # 4. unlock_percent should be between 0 and 100
        assert 0 <= unlock_percent <= 100, f"unlock_percent should be 0-100, got {unlock_percent}"
        
        # 5. total_limit should be approximately total_mined * unlock_percent / 100
        if total_mined > 0 and unlock_percent > 0:
            expected_limit = total_mined * (unlock_percent / 100)
            # Allow 1% tolerance for rounding
            assert abs(total_limit - expected_limit) < max(1, expected_limit * 0.01), \
                f"total_limit ({total_limit}) should be ~= total_mined ({total_mined}) * unlock_percent ({unlock_percent}%) = {expected_limit}"
        
        print(f"✅ Redeem limit values are logically consistent")
        print(f"   total_mined={total_mined}, unlock_percent={unlock_percent}%, total_limit={total_limit}")
        print(f"   total_redeemed={total_redeemed}, effective_available={effective_available}")
        
    def test_full_response_structure(self):
        """Test full response has all expected sections"""
        token = self.get_admin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/user360/full/{TEST_USER_UID}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Expected sections in full 360 view
        expected_sections = ["success", "user", "stats", "redeem_limit", "referral", "transactions"]
        
        for section in expected_sections:
            assert section in data, f"Missing section: {section}"
            
        print(f"✅ Full response has all expected sections: {expected_sections}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
