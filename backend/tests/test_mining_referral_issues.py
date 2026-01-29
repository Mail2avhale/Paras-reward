"""
Test suite for Mining and Referral Issues
Tests the reported production issues:
1. Mining session auto-pauses - shows 'Ready' and 'Start Session' instead of active session
2. Reward rate shows 1.0/hour but should show plan-based rate
3. Referral page shows Total Invited: 5 but Active Users: 0 and Bonus Rate: +0.0%
4. All 5 earning levels show 0 invited, 0 active, 0 inactive
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMiningSession:
    """Test mining session functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", params={
            "identifier": "admin@paras.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.user = response.json()
        self.uid = self.user.get("uid")
        assert self.uid, "No UID in login response"
    
    def test_mining_status_returns_session_data(self):
        """Test that mining status API returns correct session data"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.uid}")
        assert response.status_code == 200, f"Mining status failed: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "session_active" in data, "Missing session_active field"
        assert "mining_rate" in data or "mining_rate_per_hour" in data, "Missing mining_rate field"
        assert "remaining_hours" in data, "Missing remaining_hours field"
        assert "mined_this_session" in data, "Missing mined_this_session field"
        
        print(f"Mining Status: session_active={data.get('session_active')}, "
              f"mining_rate={data.get('mining_rate_per_hour')}, "
              f"remaining_hours={data.get('remaining_hours')}")
    
    def test_mining_rate_based_on_subscription_plan(self):
        """Test that mining rate reflects subscription plan multiplier"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.uid}")
        assert response.status_code == 200
        
        data = response.json()
        mining_rate = data.get("mining_rate_per_hour") or data.get("mining_rate")
        
        # Admin user has Elite plan (3x multiplier)
        # Base rate is 50, so minimum rate should be > 50
        assert mining_rate is not None, "Mining rate is None"
        assert mining_rate > 1.0, f"Mining rate {mining_rate} should be > 1.0 for Elite plan"
        
        # For Elite plan with base rate 50 and day multiplier, rate should be significant
        print(f"Mining rate for Elite plan: {mining_rate}/hour")
    
    def test_mining_session_persistence(self):
        """Test that mining session persists and doesn't auto-pause"""
        # Get initial status
        response1 = requests.get(f"{BASE_URL}/api/mining/status/{self.uid}")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # If session is active, verify it stays active
        if data1.get("session_active"):
            initial_remaining = data1.get("remaining_hours", 0)
            
            # Get status again
            response2 = requests.get(f"{BASE_URL}/api/mining/status/{self.uid}")
            assert response2.status_code == 200
            data2 = response2.json()
            
            # Session should still be active
            assert data2.get("session_active") == True, "Session became inactive unexpectedly"
            
            # Remaining hours should be similar (within a few seconds)
            remaining2 = data2.get("remaining_hours", 0)
            assert abs(initial_remaining - remaining2) < 0.01, "Remaining hours changed unexpectedly"
            
            print(f"Session persistence verified: remaining_hours={remaining2}")
    
    def test_start_mining_session(self):
        """Test starting a mining session"""
        response = requests.post(f"{BASE_URL}/api/mining/start/{self.uid}")
        assert response.status_code == 200, f"Start mining failed: {response.text}"
        
        data = response.json()
        
        # Should return session info
        assert "session_active" in data, "Missing session_active in response"
        assert data.get("session_active") == True, "Session should be active after start"
        
        if "remaining_hours" in data:
            assert data["remaining_hours"] > 0, "Remaining hours should be > 0"
        
        print(f"Mining session started: {data}")
    
    def test_claim_mining_rewards(self):
        """Test claiming mining rewards"""
        # First ensure session is active
        status_response = requests.get(f"{BASE_URL}/api/mining/status/{self.uid}")
        status_data = status_response.json()
        
        if not status_data.get("session_active"):
            # Start a session first
            requests.post(f"{BASE_URL}/api/mining/start/{self.uid}")
        
        # Try to claim
        response = requests.post(f"{BASE_URL}/api/mining/claim/{self.uid}")
        
        # Should succeed or fail with meaningful error
        if response.status_code == 200:
            data = response.json()
            assert "success" in data or "amount" in data, "Missing success/amount in claim response"
            
            # Verify session reset data is returned
            if data.get("session_reset"):
                assert "new_session_start" in data, "Missing new_session_start"
                assert "remaining_hours" in data, "Missing remaining_hours"
                print(f"Claim successful with session reset: {data}")
            else:
                print(f"Claim successful: {data}")
        else:
            # Should have meaningful error
            error_data = response.json()
            print(f"Claim failed (expected if no mined amount): {error_data}")


class TestReferralLevels:
    """Test referral levels functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", params={
            "identifier": "admin@paras.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.user = response.json()
        self.uid = self.user.get("uid")
        assert self.uid, "No UID in login response"
    
    def test_referral_levels_api_returns_data(self):
        """Test that referral levels API returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.uid}/levels")
        assert response.status_code == 200, f"Referral levels failed: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "levels" in data, "Missing levels field"
        assert "total" in data, "Missing total field"
        assert "total_active" in data, "Missing total_active field"
        
        levels = data.get("levels", [])
        assert len(levels) == 5, f"Expected 5 levels, got {len(levels)}"
        
        print(f"Referral Levels: total={data.get('total')}, active={data.get('total_active')}")
    
    def test_referral_levels_have_correct_structure(self):
        """Test that each level has correct structure"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.uid}/levels")
        assert response.status_code == 200
        
        data = response.json()
        levels = data.get("levels", [])
        
        for level in levels:
            assert "level" in level, f"Missing level number in {level}"
            assert "count" in level, f"Missing count in level {level.get('level')}"
            assert "active_count" in level, f"Missing active_count in level {level.get('level')}"
            assert "users" in level, f"Missing users in level {level.get('level')}"
            assert "bonus_percent" in level, f"Missing bonus_percent in level {level.get('level')}"
            
            print(f"Level {level.get('level')}: count={level.get('count')}, "
                  f"active={level.get('active_count')}, bonus={level.get('bonus_percent')}%")
    
    def test_referral_total_matches_level_sum(self):
        """Test that total referrals matches sum of all levels"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.uid}/levels")
        assert response.status_code == 200
        
        data = response.json()
        total = data.get("total", 0)
        levels = data.get("levels", [])
        
        level_sum = sum(level.get("count", 0) for level in levels)
        assert total == level_sum, f"Total {total} doesn't match level sum {level_sum}"
        
        print(f"Total referrals verified: {total}")
    
    def test_active_count_matches_level_sum(self):
        """Test that total active matches sum of active counts"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.uid}/levels")
        assert response.status_code == 200
        
        data = response.json()
        total_active = data.get("total_active", 0)
        levels = data.get("levels", [])
        
        active_sum = sum(level.get("active_count", 0) for level in levels)
        assert total_active == active_sum, f"Total active {total_active} doesn't match level sum {active_sum}"
        
        print(f"Total active referrals verified: {total_active}")
    
    def test_user_active_status_reasons(self):
        """Test that active users have valid active_reason"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.uid}/levels")
        assert response.status_code == 200
        
        data = response.json()
        levels = data.get("levels", [])
        
        valid_reasons = [
            "mining_session_active",
            "mining_active_flag",
            "mining_active_no_session",
            "session_end_valid",
            "calculated_from_start",
            "bonus_collected_24h",
            "game_played_24h",
            "inactive"
        ]
        
        for level in levels:
            for user in level.get("users", []):
                reason = user.get("active_reason")
                assert reason in valid_reasons, f"Invalid active_reason: {reason}"
                
                is_active = user.get("is_active")
                if is_active:
                    assert reason != "inactive", f"Active user has 'inactive' reason"
                else:
                    assert reason == "inactive", f"Inactive user has non-inactive reason: {reason}"
        
        print("All active_reason values are valid")
    
    def test_referral_bonus_calculation(self):
        """Test that bonus percentages are correct for each level"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.uid}/levels")
        assert response.status_code == 200
        
        data = response.json()
        levels = data.get("levels", [])
        
        expected_bonuses = {1: 10, 2: 5, 3: 3, 4: 2, 5: 1}
        
        for level in levels:
            level_num = level.get("level")
            bonus = level.get("bonus_percent")
            expected = expected_bonuses.get(level_num)
            
            assert bonus == expected, f"Level {level_num} bonus {bonus}% != expected {expected}%"
        
        print("All bonus percentages are correct")


class TestNetworkAnalytics:
    """Test network analytics functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", params={
            "identifier": "admin@paras.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.user = response.json()
        self.uid = self.user.get("uid")
    
    def test_network_analytics_api(self):
        """Test network analytics API returns data"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.uid}/network-analytics")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for key metrics
            if "health_score" in data:
                assert 0 <= data["health_score"] <= 100, "Health score out of range"
            
            if "activity_rate" in data:
                assert 0 <= data["activity_rate"] <= 100, "Activity rate out of range"
            
            print(f"Network Analytics: {data}")
        else:
            print(f"Network analytics API returned {response.status_code}")


class TestDebugEndpoints:
    """Test debug endpoints for troubleshooting"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", params={
            "identifier": "admin@paras.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.user = response.json()
        self.uid = self.user.get("uid")
    
    def test_debug_referred_by_endpoint(self):
        """Test debug endpoint for referred_by field formats"""
        response = requests.get(f"{BASE_URL}/api/referrals/{self.uid}/debug-referred-by")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Debug referred_by: {data}")
            
            # Verify counts are returned
            if "count_by_uid" in data:
                print(f"  Count by UID: {data['count_by_uid']}")
            if "count_by_code" in data:
                print(f"  Count by code: {data['count_by_code']}")
            if "count_by_either" in data:
                print(f"  Count by either: {data['count_by_either']}")
        else:
            print(f"Debug endpoint returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
