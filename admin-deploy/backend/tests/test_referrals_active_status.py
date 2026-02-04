"""
Test Referral System - Active Status Check
Tests the fix for active status checking using both 'created_at' and 'timestamp' fields
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin123"


class TestReferralLevelsAPI:
    """Test /api/referrals/{user_id}/levels endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get admin user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login?identifier={ADMIN_EMAIL}&password={ADMIN_PASSWORD}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.user_data = response.json()
        self.admin_uid = self.user_data.get("uid")
        assert self.admin_uid, "Failed to get admin UID"
    
    def test_referral_levels_endpoint_returns_200(self):
        """Test that /api/referrals/{user_id}/levels returns 200"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/levels")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
    def test_referral_levels_returns_all_5_levels(self):
        """Test that response contains all 5 levels"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/levels")
        data = response.json()
        
        assert "levels" in data, "Response missing 'levels' key"
        levels = data["levels"]
        assert len(levels) == 5, f"Expected 5 levels, got {len(levels)}"
        
        # Verify level numbers
        for i, level in enumerate(levels, 1):
            assert level["level"] == i, f"Level {i} has wrong level number: {level['level']}"
    
    def test_referral_levels_contains_user_details(self):
        """Test that each level contains user details with active status"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/levels")
        data = response.json()
        
        for level in data["levels"]:
            if level["count"] > 0:
                assert "users" in level, f"Level {level['level']} missing 'users' key"
                for user in level["users"]:
                    assert "uid" in user, "User missing 'uid'"
                    assert "name" in user, "User missing 'name'"
                    assert "is_active" in user, "User missing 'is_active'"
                    assert "active_reason" in user, "User missing 'active_reason'"
    
    def test_active_count_matches_active_users(self):
        """Test that active_count matches number of users with is_active=True"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/levels")
        data = response.json()
        
        for level in data["levels"]:
            if level["count"] > 0:
                actual_active = sum(1 for u in level["users"] if u["is_active"])
                assert level["active_count"] == actual_active, \
                    f"Level {level['level']}: active_count={level['active_count']} but found {actual_active} active users"
    
    def test_total_matches_sum_of_level_counts(self):
        """Test that total equals sum of all level counts"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/levels")
        data = response.json()
        
        calculated_total = sum(level["count"] for level in data["levels"])
        assert data["total"] == calculated_total, \
            f"Total {data['total']} doesn't match sum of levels {calculated_total}"
    
    def test_total_active_matches_sum_of_active_counts(self):
        """Test that total_active equals sum of all active_counts"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/levels")
        data = response.json()
        
        calculated_active = sum(level["active_count"] for level in data["levels"])
        assert data["total_active"] == calculated_active, \
            f"Total active {data['total_active']} doesn't match sum {calculated_active}"


class TestNetworkAnalyticsAPI:
    """Test /api/referrals/{user_id}/network-analytics endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get admin user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login?identifier={ADMIN_EMAIL}&password={ADMIN_PASSWORD}")
        assert response.status_code == 200
        self.admin_uid = response.json().get("uid")
    
    def test_network_analytics_returns_200(self):
        """Test that network analytics endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/network-analytics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_network_analytics_contains_health_score(self):
        """Test that response contains network health score"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/network-analytics")
        data = response.json()
        
        assert "network_health_score" in data, "Missing network_health_score"
        assert 0 <= data["network_health_score"] <= 100, "Health score should be 0-100"
    
    def test_network_analytics_contains_activity_metrics(self):
        """Test that response contains activity metrics"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/network-analytics")
        data = response.json()
        
        assert "total_network_size" in data, "Missing total_network_size"
        assert "active_users" in data, "Missing active_users"
        assert "inactive_users" in data, "Missing inactive_users"
        assert "activity_rate" in data, "Missing activity_rate"
    
    def test_network_analytics_contains_level_distribution(self):
        """Test that response contains level distribution"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/network-analytics")
        data = response.json()
        
        assert "level_distribution" in data, "Missing level_distribution"
        assert len(data["level_distribution"]) == 5, "Should have 5 levels"
        
        for level in data["level_distribution"]:
            assert "level" in level
            assert "total" in level
            assert "active" in level
            assert "bonus_percent" in level
    
    def test_network_analytics_contains_subscription_distribution(self):
        """Test that response contains subscription distribution"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/network-analytics")
        data = response.json()
        
        assert "subscription_distribution" in data, "Missing subscription_distribution"
        dist = data["subscription_distribution"]
        assert "explorer" in dist
        assert "startup" in dist
        assert "growth" in dist
        assert "elite" in dist


class TestActiveStatusLogic:
    """Test the active status determination logic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get admin user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login?identifier={ADMIN_EMAIL}&password={ADMIN_PASSWORD}")
        assert response.status_code == 200
        self.admin_uid = response.json().get("uid")
    
    def test_active_reasons_are_valid(self):
        """Test that active_reason values are valid"""
        valid_reasons = [
            "mining_session_active",
            "mining_active_flag", 
            "mining_active_no_session",
            "session_end_valid",
            "calculated_from_start",
            "bonus_collected_24h",
            "game_played_24h",
            "inactive",
            "user_not_found"
        ]
        
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/levels")
        data = response.json()
        
        for level in data["levels"]:
            for user in level.get("users", []):
                reason = user.get("active_reason")
                assert reason in valid_reasons, f"Invalid active_reason: {reason}"
    
    def test_active_users_have_valid_reasons(self):
        """Test that active users have non-inactive reasons"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/levels")
        data = response.json()
        
        for level in data["levels"]:
            for user in level.get("users", []):
                if user["is_active"]:
                    assert user["active_reason"] != "inactive", \
                        f"Active user {user['name']} has 'inactive' reason"
    
    def test_inactive_users_have_inactive_reason(self):
        """Test that inactive users have 'inactive' reason"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/levels")
        data = response.json()
        
        for level in data["levels"]:
            for user in level.get("users", []):
                if not user["is_active"]:
                    assert user["active_reason"] == "inactive", \
                        f"Inactive user {user['name']} has reason: {user['active_reason']}"


class TestApplyReferralCodeAPI:
    """Test /api/referrals/apply endpoint"""
    
    def test_apply_referral_code_requires_uid(self):
        """Test that apply referral code requires uid"""
        response = requests.post(
            f"{BASE_URL}/api/referrals/apply",
            json={"referral_code": "TESTCODE"}
        )
        # Should fail due to missing uid
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
    
    def test_apply_referral_code_invalid_user(self):
        """Test that apply referral code fails for invalid user"""
        response = requests.post(
            f"{BASE_URL}/api/referrals/apply",
            json={"uid": "invalid-uid-12345", "referral_code": "ADMIN8175C02A"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        assert "not found" in response.json().get("detail", "").lower()
    
    def test_apply_referral_code_invalid_code(self):
        """Test that apply referral code fails for invalid code"""
        # First login to get a valid user
        login_response = requests.post(f"{BASE_URL}/api/auth/login?identifier={ADMIN_EMAIL}&password={ADMIN_PASSWORD}")
        admin_uid = login_response.json().get("uid")
        
        response = requests.post(
            f"{BASE_URL}/api/referrals/apply",
            json={"uid": admin_uid, "referral_code": "INVALIDCODE123"}
        )
        # Should fail - either invalid code or user already has referrer
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"


class TestReferralTreeAPI:
    """Test /api/referrals/{user_id}/tree endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get admin user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login?identifier={ADMIN_EMAIL}&password={ADMIN_PASSWORD}")
        assert response.status_code == 200
        self.admin_uid = response.json().get("uid")
    
    def test_referral_tree_returns_200(self):
        """Test that referral tree endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/tree")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_referral_tree_contains_tree_structure(self):
        """Test that response contains tree structure"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/tree")
        data = response.json()
        
        assert "tree" in data, "Response missing 'tree' key"


class TestRewardProgressAPI:
    """Test /api/referrals/{user_id}/reward-progress endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get admin user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login?identifier={ADMIN_EMAIL}&password={ADMIN_PASSWORD}")
        assert response.status_code == 200
        self.admin_uid = response.json().get("uid")
    
    def test_reward_progress_returns_200(self):
        """Test that reward progress endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/reward-progress")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_reward_progress_contains_required_fields(self):
        """Test that response contains required fields"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.admin_uid}/reward-progress")
        data = response.json()
        
        required_fields = [
            "is_eligible",
            "is_explorer_plan",
            "reward_already_claimed",
            "progress_percent",
            "paid_referrals_7days",
            "required_paid_referrals"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
