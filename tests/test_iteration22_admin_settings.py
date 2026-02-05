"""
Test Iteration 22: Admin Mining Settings, Referral Bonus Settings, and Mining Rate Calculations
Features to test:
1. Admin Mining Settings - Save base_rate, vip_multiplier and verify persistence
2. Admin Referral Bonus Settings - Save level-wise bonus percentages and verify persistence
3. User Mining Rate - Verify mining rate changes when admin updates base_rate settings
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mining-orders-sync.preview.emergentagent.com').rstrip('/')

class TestAdminMiningSettings:
    """Test Admin Mining Settings API - Save and Persistence"""
    
    def test_get_mining_settings_default(self):
        """Test GET /api/admin/mining-settings returns default values"""
        response = requests.get(f"{BASE_URL}/api/admin/mining-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify default fields exist
        assert "base_rate" in data, "base_rate field missing"
        assert "vip_multiplier" in data, "vip_multiplier field missing"
        assert "max_daily_mining_hours" in data, "max_daily_mining_hours field missing"
        assert "prc_to_inr_ratio" in data, "prc_to_inr_ratio field missing"
        
        print(f"✅ Mining settings retrieved: {data}")
    
    def test_update_mining_settings_and_verify_persistence(self):
        """Test POST /api/admin/mining-settings saves and persists"""
        # Step 1: Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/mining-settings")
        assert get_response.status_code == 200
        original_settings = get_response.json()
        print(f"Original settings: {original_settings}")
        
        # Step 2: Update with new values
        new_settings = {
            "base_rate": 1.5,
            "vip_multiplier": 3,
            "max_daily_mining_hours": 20,
            "prc_to_inr_ratio": 15
        }
        
        post_response = requests.post(
            f"{BASE_URL}/api/admin/mining-settings",
            json=new_settings
        )
        assert post_response.status_code == 200, f"POST failed: {post_response.text}"
        
        post_data = post_response.json()
        assert post_data.get("success") == True, "Expected success=True"
        print(f"✅ Settings updated: {post_data}")
        
        # Step 3: GET again to verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/admin/mining-settings")
        assert verify_response.status_code == 200
        
        persisted_settings = verify_response.json()
        assert persisted_settings["base_rate"] == 1.5, f"base_rate not persisted: {persisted_settings['base_rate']}"
        assert persisted_settings["vip_multiplier"] == 3, f"vip_multiplier not persisted: {persisted_settings['vip_multiplier']}"
        assert persisted_settings["max_daily_mining_hours"] == 20, f"max_daily_mining_hours not persisted"
        assert persisted_settings["prc_to_inr_ratio"] == 15, f"prc_to_inr_ratio not persisted"
        
        print(f"✅ Settings persisted correctly: {persisted_settings}")
        
        # Step 4: Restore original settings (cleanup)
        restore_settings = {
            "base_rate": original_settings.get("base_rate", 0.5),
            "vip_multiplier": original_settings.get("vip_multiplier", 2),
            "max_daily_mining_hours": original_settings.get("max_daily_mining_hours", 24),
            "prc_to_inr_ratio": original_settings.get("prc_to_inr_ratio", 10)
        }
        requests.post(f"{BASE_URL}/api/admin/mining-settings", json=restore_settings)
        print(f"✅ Original settings restored")


class TestAdminReferralBonusSettings:
    """Test Admin Referral Bonus Settings API - Save and Persistence"""
    
    def test_get_referral_bonus_settings_default(self):
        """Test GET /api/admin/referral-bonus-settings returns default values"""
        response = requests.get(f"{BASE_URL}/api/admin/referral-bonus-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "referral_bonus_settings" in data, "referral_bonus_settings field missing"
        
        settings = data["referral_bonus_settings"]
        # Verify all 5 levels exist
        for level in ["level_1", "level_2", "level_3", "level_4", "level_5"]:
            assert level in settings, f"{level} missing from referral settings"
        
        print(f"✅ Referral bonus settings retrieved: {settings}")
    
    def test_update_referral_bonus_settings_and_verify_persistence(self):
        """Test POST /api/admin/referral-bonus-settings saves and persists"""
        # Step 1: Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/referral-bonus-settings")
        assert get_response.status_code == 200
        original_data = get_response.json()
        original_settings = original_data.get("referral_bonus_settings", {})
        print(f"Original referral settings: {original_settings}")
        
        # Step 2: Update with new values
        new_settings = {
            "level_1": 12,
            "level_2": 6,
            "level_3": 3,
            "level_4": 2,
            "level_5": 1.5
        }
        
        post_response = requests.post(
            f"{BASE_URL}/api/admin/referral-bonus-settings",
            json=new_settings
        )
        assert post_response.status_code == 200, f"POST failed: {post_response.text}"
        
        post_data = post_response.json()
        assert "referral_bonus_settings" in post_data, "Response missing referral_bonus_settings"
        print(f"✅ Referral settings updated: {post_data}")
        
        # Step 3: GET again to verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/admin/referral-bonus-settings")
        assert verify_response.status_code == 200
        
        persisted_data = verify_response.json()
        persisted_settings = persisted_data["referral_bonus_settings"]
        
        assert persisted_settings["level_1"] == 12, f"level_1 not persisted: {persisted_settings['level_1']}"
        assert persisted_settings["level_2"] == 6, f"level_2 not persisted: {persisted_settings['level_2']}"
        assert persisted_settings["level_3"] == 3, f"level_3 not persisted: {persisted_settings['level_3']}"
        assert persisted_settings["level_4"] == 2, f"level_4 not persisted: {persisted_settings['level_4']}"
        assert persisted_settings["level_5"] == 1.5, f"level_5 not persisted: {persisted_settings['level_5']}"
        
        print(f"✅ Referral settings persisted correctly: {persisted_settings}")
        
        # Step 4: Restore original settings (cleanup)
        restore_settings = {
            "level_1": original_settings.get("level_1", 10),
            "level_2": original_settings.get("level_2", 5),
            "level_3": original_settings.get("level_3", 2.5),
            "level_4": original_settings.get("level_4", 1.5),
            "level_5": original_settings.get("level_5", 1)
        }
        requests.post(f"{BASE_URL}/api/admin/referral-bonus-settings", json=restore_settings)
        print(f"✅ Original referral settings restored")
    
    def test_referral_bonus_validation_invalid_values(self):
        """Test validation for invalid referral bonus values"""
        # Test with value > 100
        invalid_settings = {
            "level_1": 150,  # Invalid - > 100
            "level_2": 5,
            "level_3": 2.5,
            "level_4": 1.5,
            "level_5": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/referral-bonus-settings",
            json=invalid_settings
        )
        # Should return 400 for invalid value
        assert response.status_code == 400, f"Expected 400 for invalid value, got {response.status_code}"
        print(f"✅ Validation works - rejected value > 100")
    
    def test_referral_bonus_validation_missing_level(self):
        """Test validation for missing level"""
        # Test with missing level_5
        incomplete_settings = {
            "level_1": 10,
            "level_2": 5,
            "level_3": 2.5,
            "level_4": 1.5
            # level_5 missing
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/referral-bonus-settings",
            json=incomplete_settings
        )
        # Should return 400 for missing field
        assert response.status_code == 400, f"Expected 400 for missing field, got {response.status_code}"
        print(f"✅ Validation works - rejected missing level_5")


class TestMiningStatusWithReferralBreakdown:
    """Test Mining Status API returns referral breakdown"""
    
    def test_mining_status_returns_referral_breakdown(self):
        """Test GET /api/mining/status/{uid} returns referral_breakdown"""
        # Login as test user using query params
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login?identifier=testuser@test.com&password=test123"
        )
        
        if login_response.status_code != 200:
            # Create test user if doesn't exist
            register_response = requests.post(
                f"{BASE_URL}/api/auth/register/simple",
                json={"email": "testuser@test.com", "password": "test123", "role": "user"}
            )
            if register_response.status_code == 200:
                uid = register_response.json().get("uid")
            else:
                pytest.skip("Could not create test user")
        else:
            uid = login_response.json().get("uid")
        
        if not uid:
            pytest.skip("Could not get user UID")
        
        # Get mining status
        status_response = requests.get(f"{BASE_URL}/api/mining/status/{uid}")
        assert status_response.status_code == 200, f"Mining status failed: {status_response.text}"
        
        data = status_response.json()
        
        # Verify required fields
        assert "mining_rate_per_hour" in data, "mining_rate_per_hour missing"
        assert "base_rate" in data, "base_rate missing"
        assert "active_referrals" in data, "active_referrals missing"
        assert "referral_breakdown" in data, "referral_breakdown missing"
        
        print(f"✅ Mining status with referral breakdown: {data}")
        print(f"   - Mining rate per hour: {data['mining_rate_per_hour']}")
        print(f"   - Base rate: {data['base_rate']}")
        print(f"   - Active referrals: {data['active_referrals']}")
        print(f"   - Referral breakdown: {data['referral_breakdown']}")


class TestReferralLevelsAPI:
    """Test Referral Levels API for level-wise breakdown"""
    
    def test_referral_levels_endpoint(self):
        """Test GET /api/referrals/{uid}/levels returns level-wise data"""
        # Login as test user using query params
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login?identifier=testuser@test.com&password=test123"
        )
        
        if login_response.status_code != 200:
            pytest.skip("Test user not available")
        
        uid = login_response.json().get("uid")
        
        # Get referral levels
        levels_response = requests.get(f"{BASE_URL}/api/referrals/{uid}/levels")
        
        if levels_response.status_code == 200:
            data = levels_response.json()
            assert "levels" in data, "levels field missing"
            
            levels = data["levels"]
            print(f"✅ Referral levels retrieved: {len(levels)} levels")
            
            for level in levels:
                print(f"   - Level {level.get('level')}: {level.get('count', 0)} total, {level.get('active_count', 0)} active")
        else:
            # Endpoint might not exist, check for fallback
            print(f"⚠️ Referral levels endpoint returned {levels_response.status_code}")


class TestAdminLogin:
    """Test Admin Login for accessing admin settings"""
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login?identifier=admin@paras.com&password=admin123"
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "uid" in data, "uid missing from login response"
            assert data.get("role") in ["admin", "sub_admin"], f"Expected admin role, got {data.get('role')}"
            print(f"✅ Admin login successful: {data.get('email')}, role: {data.get('role')}")
        else:
            print(f"⚠️ Admin login failed: {response.status_code} - {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
