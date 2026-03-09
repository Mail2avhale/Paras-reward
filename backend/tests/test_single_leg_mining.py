"""
Test Single Leg Mining Bonus API
Tests the /api/mining/status/{uid} endpoint returns single_leg_info
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


class TestSingleLegMiningAPI:
    """Test single_leg_info in mining status endpoint"""
    
    def test_mining_status_returns_single_leg_info(self):
        """Test that mining status includes single_leg_info object"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}", timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify single_leg_info exists
        assert "single_leg_info" in data, "single_leg_info missing from response"
        single_leg_info = data["single_leg_info"]
        
        # Verify all required fields exist
        required_fields = [
            "active_downline",
            "total_downline", 
            "bonus_prc_per_day",
            "bonus_prc_per_hour",
            "max_users",
            "prc_per_user_per_day"
        ]
        
        for field in required_fields:
            assert field in single_leg_info, f"Field '{field}' missing from single_leg_info"
    
    def test_single_leg_info_field_types(self):
        """Test that single_leg_info fields have correct types"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}", timeout=30)
        
        assert response.status_code == 200
        single_leg_info = response.json()["single_leg_info"]
        
        # Check numeric types
        assert isinstance(single_leg_info["active_downline"], (int, float)), "active_downline should be numeric"
        assert isinstance(single_leg_info["total_downline"], (int, float)), "total_downline should be numeric"
        assert isinstance(single_leg_info["bonus_prc_per_day"], (int, float)), "bonus_prc_per_day should be numeric"
        assert isinstance(single_leg_info["bonus_prc_per_hour"], (int, float)), "bonus_prc_per_hour should be numeric"
        assert isinstance(single_leg_info["max_users"], (int, float)), "max_users should be numeric"
        assert isinstance(single_leg_info["prc_per_user_per_day"], (int, float)), "prc_per_user_per_day should be numeric"
    
    def test_single_leg_info_default_values(self):
        """Test that single_leg_info has expected default values for constants"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}", timeout=30)
        
        assert response.status_code == 200
        single_leg_info = response.json()["single_leg_info"]
        
        # Check constants
        assert single_leg_info["max_users"] == 800, f"max_users should be 800, got {single_leg_info['max_users']}"
        assert single_leg_info["prc_per_user_per_day"] == 5, f"prc_per_user_per_day should be 5, got {single_leg_info['prc_per_user_per_day']}"
    
    def test_single_leg_info_non_negative_values(self):
        """Test that single_leg_info values are non-negative"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}", timeout=30)
        
        assert response.status_code == 200
        single_leg_info = response.json()["single_leg_info"]
        
        assert single_leg_info["active_downline"] >= 0, "active_downline should be non-negative"
        assert single_leg_info["total_downline"] >= 0, "total_downline should be non-negative"
        assert single_leg_info["bonus_prc_per_day"] >= 0, "bonus_prc_per_day should be non-negative"
        assert single_leg_info["bonus_prc_per_hour"] >= 0, "bonus_prc_per_hour should be non-negative"
    
    def test_mining_status_returns_other_fields(self):
        """Test that mining status still includes all other required fields"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}", timeout=30)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify other important fields
        required_fields = [
            "current_balance",
            "mining_rate",
            "mining_rate_per_hour",
            "base_rate",
            "referral_breakdown",
            "session_active",
            "remaining_hours"
        ]
        
        for field in required_fields:
            assert field in data, f"Field '{field}' missing from mining status response"
    
    def test_mining_status_invalid_uid(self):
        """Test that mining status returns 404 for invalid user"""
        response = requests.get(f"{BASE_URL}/api/mining/status/invalid-uid-12345", timeout=30)
        
        assert response.status_code == 404, f"Expected 404 for invalid UID, got {response.status_code}"


class TestMiningStatusPerformance:
    """Test mining status endpoint performance"""
    
    def test_mining_status_response_time(self):
        """Test that mining status responds within reasonable time"""
        import time
        
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}", timeout=30)
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 5, f"Mining status took too long: {elapsed:.2f}s (should be < 5s)"
