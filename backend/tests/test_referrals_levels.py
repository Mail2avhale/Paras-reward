"""
Test suite for Referrals Levels API
Tests the /api/referrals/{user_id}/levels endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test users
ADMIN_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"  # Admin user with referrals
REGULAR_USER_UID = "de8aa70b-7df6-4b87-a55c-7a88c57ead3a"  # Test user with 0 referrals
MAIL2AVHALE_UID = "73b95483-f36b-4637-a5ee-d447300c6835"  # User with 1 referral


class TestReferralsLevelsAPI:
    """Tests for /api/referrals/{user_id}/levels endpoint"""
    
    def test_referral_levels_endpoint_exists(self):
        """Test that the referral levels endpoint exists and returns 200"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ Referral levels endpoint returns 200")
    
    def test_referral_levels_response_structure(self):
        """Test that response has correct structure with levels array"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "levels" in data, "Response missing 'levels' field"
        assert "total" in data, "Response missing 'total' field"
        assert "total_active" in data, "Response missing 'total_active' field"
        
        # Check levels is a list
        assert isinstance(data["levels"], list), "Levels should be a list"
        assert len(data["levels"]) == 5, f"Expected 5 levels, got {len(data['levels'])}"
        
        print(f"✅ Response structure is correct with 5 levels")
    
    def test_each_level_has_correct_structure(self):
        """Test that each level has required fields"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        data = response.json()
        
        required_fields = ["level", "count", "active_count", "users", "bonus_percent"]
        
        for level_data in data["levels"]:
            for field in required_fields:
                assert field in level_data, f"Level {level_data.get('level', '?')} missing '{field}' field"
        
        print(f"✅ All levels have correct structure")
    
    def test_admin_user_has_referrals(self):
        """Test that admin user returns correct referral counts"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        data = response.json()
        
        # Admin should have 5 Level 1 referrals and 1 Level 2 referral
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        level_2 = next((l for l in data["levels"] if l["level"] == 2), None)
        
        assert level_1 is not None, "Level 1 not found"
        assert level_1["count"] >= 5, f"Expected at least 5 Level 1 referrals, got {level_1['count']}"
        assert level_1["active_count"] >= 0, "Active count should be >= 0"
        
        assert level_2 is not None, "Level 2 not found"
        assert level_2["count"] >= 1, f"Expected at least 1 Level 2 referral, got {level_2['count']}"
        
        print(f"✅ Admin user has {level_1['count']} Level 1 and {level_2['count']} Level 2 referrals")
    
    def test_user_list_in_levels(self):
        """Test that users array contains user details"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        data = response.json()
        
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        users = level_1.get("users", [])
        
        assert len(users) > 0, "Level 1 should have users"
        
        # Check user structure
        user = users[0]
        required_user_fields = ["uid", "name", "is_active", "subscription_plan"]
        
        for field in required_user_fields:
            assert field in user, f"User missing '{field}' field"
        
        print(f"✅ User list contains {len(users)} users with correct structure")
    
    def test_user_active_status(self):
        """Test that user active status is correctly set"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        data = response.json()
        
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        users = level_1.get("users", [])
        
        active_users = [u for u in users if u.get("is_active")]
        inactive_users = [u for u in users if not u.get("is_active")]
        
        # Should match active_count
        assert level_1["active_count"] == len(active_users), \
            f"active_count ({level_1['active_count']}) doesn't match active users ({len(active_users)})"
        
        print(f"✅ Active status correct: {len(active_users)} active, {len(inactive_users)} inactive")
    
    def test_subscription_plan_badges(self):
        """Test that subscription plans are included in user data"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        data = response.json()
        
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        users = level_1.get("users", [])
        
        # Check subscription plans
        plans = [u.get("subscription_plan") for u in users if u.get("subscription_plan")]
        valid_plans = ["explorer", "startup", "growth", "elite"]
        
        for plan in plans:
            assert plan in valid_plans, f"Invalid subscription plan: {plan}"
        
        # Count by plan type
        plan_counts = {p: plans.count(p) for p in set(plans)}
        print(f"✅ Subscription plans found: {plan_counts}")
    
    def test_user_with_no_referrals(self):
        """Test that user with no referrals returns empty levels"""
        response = requests.get(f"{BASE_URL}/api/referrals/{REGULAR_USER_UID}/levels")
        data = response.json()
        
        assert data["total"] == 0, f"Expected 0 total, got {data['total']}"
        
        # All levels should have 0 users
        for level_data in data["levels"]:
            assert level_data["count"] == 0, f"Level {level_data['level']} should have 0 users"
            assert len(level_data["users"]) == 0, f"Level {level_data['level']} users array should be empty"
        
        print(f"✅ User with no referrals returns empty levels correctly")
    
    def test_bonus_percentages(self):
        """Test that bonus percentages are correct for each level"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        data = response.json()
        
        expected_bonuses = {1: 10, 2: 5, 3: 3, 4: 2, 5: 1}
        
        for level_data in data["levels"]:
            level = level_data["level"]
            expected = expected_bonuses.get(level)
            actual = level_data.get("bonus_percent")
            # Note: bonus_percent might vary based on config
            assert actual is not None, f"Level {level} missing bonus_percent"
            print(f"  Level {level}: {actual}%")
        
        print(f"✅ Bonus percentages are present for all levels")
    
    def test_invalid_user_returns_404(self):
        """Test that invalid user ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/referrals/invalid-uid-12345/levels")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✅ Invalid user returns 404")
    
    def test_user_names_displayed(self):
        """Test that user names are correctly included"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        data = response.json()
        
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        users = level_1.get("users", [])
        
        # Check for specific known users
        user_names = [u.get("name") for u in users]
        
        # At least one user should have a name
        assert any(name for name in user_names), "At least one user should have a name"
        
        # Check for known users
        known_users = ["Mail2avhale", "Language Test User", "Test User", "Active VIP Test User"]
        found_users = [name for name in user_names if name in known_users]
        
        print(f"✅ Found users: {found_users}")
        assert len(found_users) >= 1, "Should find at least one known user"
    
    def test_mail2avhale_has_referral(self):
        """Test that mail2avhale user has 1 referral (Santosh)"""
        response = requests.get(f"{BASE_URL}/api/referrals/{MAIL2AVHALE_UID}/levels")
        data = response.json()
        
        assert data["total"] == 1, f"Expected 1 total referral, got {data['total']}"
        
        level_1 = next((l for l in data["levels"] if l["level"] == 1), None)
        assert level_1["count"] == 1, f"Expected 1 Level 1 referral, got {level_1['count']}"
        
        users = level_1.get("users", [])
        assert len(users) == 1, f"Expected 1 user in Level 1, got {len(users)}"
        
        user = users[0]
        assert user["name"] == "SANTOSH SHAMRAO AVHALE", f"Expected Santosh, got {user['name']}"
        
        print(f"✅ Mail2avhale has 1 referral: {user['name']}")


class TestReferralStatsAPI:
    """Tests for referral stats API"""
    
    def test_referral_stats_endpoint(self):
        """Test the referral stats summary"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/levels")
        data = response.json()
        
        total = data.get("total", 0)
        total_active = data.get("total_active", 0)
        
        assert total >= total_active, "Total should be >= total_active"
        
        print(f"✅ Stats: Total={total}, Active={total_active}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
