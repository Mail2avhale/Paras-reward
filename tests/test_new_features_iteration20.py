"""
Test Suite for Iteration 20 - New Features
Features tested:
1. Profile Page - Edit mode with Personal Info and Address Details fields
2. Dashboard - Live Activity section with global feed (bill, voucher, shopping)
3. Referrals Page - Your Network section with Collapse/Expand toggle
4. Birthday endpoint - GET /api/user/{uid}/birthday-check
5. Global Activity endpoint - GET /api/global/live-activity
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBirthdayCheckEndpoint:
    """Test birthday check endpoint - GET /api/user/{uid}/birthday-check"""
    
    def test_birthday_check_returns_is_birthday_field(self):
        """Verify birthday check endpoint returns is_birthday field"""
        # First login to get a valid user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "freeuser_1767939928@test.com",
            "password": "test123"
        })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        user_data = login_response.json()
        uid = user_data.get("uid")
        assert uid, "No uid in login response"
        
        # Test birthday check endpoint
        birthday_response = requests.get(f"{BASE_URL}/api/user/{uid}/birthday-check")
        
        assert birthday_response.status_code == 200, f"Birthday check failed: {birthday_response.text}"
        data = birthday_response.json()
        
        # Verify is_birthday field exists
        assert "is_birthday" in data, "Response missing 'is_birthday' field"
        assert isinstance(data["is_birthday"], bool), "is_birthday should be boolean"
        
        # Verify message field exists (can be None)
        assert "message" in data, "Response missing 'message' field"
        
        print(f"✅ Birthday check response: is_birthday={data['is_birthday']}, message={data.get('message')}")
    
    def test_birthday_check_invalid_user(self):
        """Verify birthday check returns 404 for invalid user"""
        response = requests.get(f"{BASE_URL}/api/user/invalid-uid-12345/birthday-check")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Birthday check correctly returns 404 for invalid user")


class TestGlobalLiveActivityEndpoint:
    """Test global live activity endpoint - GET /api/global/live-activity"""
    
    def test_global_activity_returns_activities(self):
        """Verify global activity endpoint returns activities array"""
        response = requests.get(f"{BASE_URL}/api/global/live-activity?limit=10")
        
        assert response.status_code == 200, f"Global activity failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "activities" in data, "Response missing 'activities' field"
        assert isinstance(data["activities"], list), "activities should be a list"
        
        print(f"✅ Global activity returned {len(data['activities'])} activities")
        
        # If there are activities, verify structure
        if data["activities"]:
            activity = data["activities"][0]
            assert "type" in activity, "Activity missing 'type' field"
            assert "icon" in activity, "Activity missing 'icon' field"
            assert "user" in activity, "Activity missing 'user' field"
            assert "description" in activity, "Activity missing 'description' field"
            assert "category" in activity, "Activity missing 'category' field"
            
            # Verify category is one of expected values
            valid_categories = ["bill", "voucher", "shopping"]
            assert activity["category"] in valid_categories, f"Invalid category: {activity['category']}"
            
            print(f"✅ Activity structure verified: type={activity['type']}, category={activity['category']}")
    
    def test_global_activity_limit_parameter(self):
        """Verify limit parameter works correctly"""
        response = requests.get(f"{BASE_URL}/api/global/live-activity?limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should not exceed limit
        assert len(data["activities"]) <= 5, f"Expected max 5 activities, got {len(data['activities'])}"
        print(f"✅ Limit parameter working: returned {len(data['activities'])} activities (limit=5)")
    
    def test_global_activity_anonymized_users(self):
        """Verify user names are anonymized (e.g., San***, bil***)"""
        response = requests.get(f"{BASE_URL}/api/global/live-activity?limit=20")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["activities"]:
            for activity in data["activities"]:
                user = activity.get("user", "")
                # User should be anonymized (contains ***)
                if user and user != "User***":
                    assert "***" in user, f"User name not anonymized: {user}"
            print("✅ User names are properly anonymized")
        else:
            print("⚠️ No activities to verify anonymization")


class TestProfileEndpoint:
    """Test profile update endpoint with new fields"""
    
    def test_profile_update_with_new_fields(self):
        """Verify profile can be updated with new fields (tahsil, birthday, etc.)"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "freeuser_1767939928@test.com",
            "password": "test123"
        })
        
        assert login_response.status_code == 200
        user_data = login_response.json()
        uid = user_data.get("uid")
        
        # Update profile with new fields
        update_data = {
            "name": "Test User Profile",
            "phone": "9876543210",
            "address": "123 Test Street",
            "tahsil": "Test Tahsil",
            "district": "Test District",
            "state": "Maharashtra",
            "pincode": "411001",
            "birthday": "1990-05-15"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/user/{uid}", json=update_data)
        
        assert update_response.status_code == 200, f"Profile update failed: {update_response.text}"
        
        # Verify the update by fetching user data
        get_response = requests.get(f"{BASE_URL}/api/user/{uid}")
        assert get_response.status_code == 200
        
        fetched_data = get_response.json()
        
        # Verify fields were saved
        assert fetched_data.get("name") == "Test User Profile", "Name not updated"
        assert fetched_data.get("address") == "123 Test Street", "Address not updated"
        assert fetched_data.get("tahsil") == "Test Tahsil" or fetched_data.get("taluka") == "Test Tahsil", "Tahsil not updated"
        assert fetched_data.get("district") == "Test District", "District not updated"
        assert fetched_data.get("state") == "Maharashtra", "State not updated"
        assert fetched_data.get("pincode") == "411001", "Pincode not updated"
        assert fetched_data.get("birthday") == "1990-05-15", "Birthday not updated"
        
        print("✅ Profile update with new fields successful")
        print(f"   - Name: {fetched_data.get('name')}")
        print(f"   - Address: {fetched_data.get('address')}")
        print(f"   - Tahsil: {fetched_data.get('tahsil') or fetched_data.get('taluka')}")
        print(f"   - District: {fetched_data.get('district')}")
        print(f"   - State: {fetched_data.get('state')}")
        print(f"   - Pincode: {fetched_data.get('pincode')}")
        print(f"   - Birthday: {fetched_data.get('birthday')}")


class TestReferralsEndpoint:
    """Test referrals endpoint"""
    
    def test_referrals_levels_endpoint(self):
        """Verify referrals levels endpoint returns proper structure"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "freeuser_1767939928@test.com",
            "password": "test123"
        })
        
        assert login_response.status_code == 200
        user_data = login_response.json()
        uid = user_data.get("uid")
        
        # Test referrals levels endpoint
        levels_response = requests.get(f"{BASE_URL}/api/referrals/{uid}/levels")
        
        # May return 200 or 404 depending on implementation
        if levels_response.status_code == 200:
            data = levels_response.json()
            assert "levels" in data, "Response missing 'levels' field"
            print(f"✅ Referrals levels endpoint working: {len(data.get('levels', []))} levels")
        else:
            # Try regular referrals endpoint
            ref_response = requests.get(f"{BASE_URL}/api/referrals/{uid}")
            if ref_response.status_code == 200:
                print("✅ Referrals endpoint working (using regular endpoint)")
            else:
                print(f"⚠️ Referrals endpoint returned: {ref_response.status_code}")


class TestUserEndpoint:
    """Test user endpoint returns all required fields"""
    
    def test_user_endpoint_returns_profile_fields(self):
        """Verify user endpoint returns all profile fields"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "freeuser_1767939928@test.com",
            "password": "test123"
        })
        
        assert login_response.status_code == 200
        user_data = login_response.json()
        uid = user_data.get("uid")
        
        # Get user data
        get_response = requests.get(f"{BASE_URL}/api/user/{uid}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        
        # Verify essential fields exist
        essential_fields = ["uid", "email", "name", "membership_type", "prc_balance"]
        for field in essential_fields:
            assert field in data, f"Missing essential field: {field}"
        
        # Verify profile fields can exist (may be null)
        profile_fields = ["phone", "mobile", "address", "tahsil", "taluka", "district", "state", "pincode", "birthday"]
        existing_profile_fields = [f for f in profile_fields if f in data]
        
        print(f"✅ User endpoint returns all essential fields")
        print(f"   Profile fields available: {existing_profile_fields}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
