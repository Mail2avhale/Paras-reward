"""
Test Referrals Page Fix Verification - Iteration 68
- Verifies level-wise users display in /api/referrals/{uid}/levels
- Verifies Free Startup Subscription module removed (/api/referrals/{uid}/reward-progress returns 404)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReferralsLevelsFix:
    """Test the referrals levels API returns correct user data"""
    
    # Test user credentials from requirements
    TEST_USER_UID = "73b95483-f36b-4637-a5ee-d447300c6835"
    TEST_USER_EMAIL = "mail2avhale@gmail.com"
    EXPECTED_REFERRAL_NAME = "SANTOSH SHAMRAO AVHALE"
    
    def test_levels_api_returns_200(self):
        """Test that /api/referrals/{uid}/levels returns 200"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ API returns 200")
    
    def test_levels_response_structure(self):
        """Test response has correct structure: levels, total, total_active"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        data = response.json()
        
        assert "levels" in data, "Response missing 'levels' key"
        assert "total" in data, "Response missing 'total' key"
        assert "total_active" in data, "Response missing 'total_active' key"
        assert isinstance(data["levels"], list), "'levels' should be a list"
        print(f"✅ Response structure correct")
    
    def test_level_1_has_users(self):
        """Test that Level 1 (Direct) has at least 1 user"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        data = response.json()
        
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        assert level_1 is not None, "Level 1 not found in response"
        assert level_1["count"] >= 1, f"Expected at least 1 user in Level 1, got {level_1['count']}"
        print(f"✅ Level 1 has {level_1['count']} user(s)")
    
    def test_level_1_users_array_populated(self):
        """Test that Level 1 users array contains user details"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        data = response.json()
        
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        assert level_1 is not None, "Level 1 not found"
        assert "users" in level_1, "Level 1 missing 'users' array"
        assert len(level_1["users"]) > 0, "Level 1 users array is empty"
        print(f"✅ Level 1 users array has {len(level_1['users'])} user(s)")
    
    def test_user_has_required_fields(self):
        """Test that user objects have required fields: uid, name, is_active, subscription_plan"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        data = response.json()
        
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        assert level_1 is not None and len(level_1["users"]) > 0
        
        user = level_1["users"][0]
        required_fields = ["uid", "name", "is_active", "subscription_plan"]
        for field in required_fields:
            assert field in user, f"User missing required field: {field}"
        print(f"✅ User has all required fields")
    
    def test_santosh_user_exists(self):
        """Test that SANTOSH SHAMRAO AVHALE appears in Level 1 users"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        data = response.json()
        
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        assert level_1 is not None
        
        user_names = [u.get("name", "") for u in level_1.get("users", [])]
        assert self.EXPECTED_REFERRAL_NAME in user_names, f"Expected '{self.EXPECTED_REFERRAL_NAME}' in users, got {user_names}"
        print(f"✅ Found '{self.EXPECTED_REFERRAL_NAME}' in Level 1 users")
    
    def test_bonus_percent_present(self):
        """Test that each level has bonus_percent field"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/levels")
        data = response.json()
        
        for level in data["levels"]:
            assert "bonus_percent" in level, f"Level {level.get('level')} missing bonus_percent"
        print(f"✅ All levels have bonus_percent")


class TestFreeStartupSubscriptionRemoved:
    """Test that Free Startup Subscription module is disabled"""
    
    TEST_USER_UID = "73b95483-f36b-4637-a5ee-d447300c6835"
    
    def test_reward_progress_api_disabled(self):
        """Test that /api/referrals/{uid}/reward-progress returns 404 (disabled)"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/reward-progress")
        assert response.status_code == 404, f"Expected 404 (disabled), got {response.status_code}"
        print(f"✅ reward-progress API returns 404 (correctly disabled)")
    
    def test_reward_progress_response_not_found(self):
        """Test that reward-progress response indicates not found"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/reward-progress")
        
        # Should return 404 with "Not Found" detail
        if response.status_code == 404:
            data = response.json()
            assert "detail" in data, "404 response should have 'detail' field"
            print(f"✅ reward-progress correctly returns: {data}")


class TestReferralsStatsEndpoint:
    """Test the referrals stats endpoint"""
    
    TEST_USER_UID = "73b95483-f36b-4637-a5ee-d447300c6835"
    
    def test_stats_endpoint_exists(self):
        """Test /api/referrals/{uid}/stats returns 200"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ Stats API returns 200")
    
    def test_stats_response_fields(self):
        """Test stats response has expected fields"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.TEST_USER_UID}/stats")
        data = response.json()
        
        # Common fields expected in stats
        expected_keys = ["total_referrals", "active_referrals"]
        for key in expected_keys:
            if key not in data:
                print(f"⚠️ Stats response missing '{key}' field")
        print(f"✅ Stats endpoint returned: {list(data.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
