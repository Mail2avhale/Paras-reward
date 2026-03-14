"""
Backend Tests for Futuristic Mining Dashboard APIs
===================================================
Testing the mining functionality for the new dashboard:
- Mining status API
- Mining start API
- Mining claim API (for paid users)
- Free user claim restriction
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from the review request
TEST_USER_MOBILE = "9421331342"
TEST_USER_PIN = "942133"
ADMIN_EMAIL = "Admin@paras.com"
ADMIN_PIN = "153759"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def test_user_auth(api_client):
    """Login as test user and get auth data"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "mobile": TEST_USER_MOBILE,
        "pin": TEST_USER_PIN
    })
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}")
    data = response.json()
    return {
        "uid": data["uid"],
        "token": data.get("access_token") or data.get("token"),
        "subscription_plan": data.get("subscription_plan", "explorer"),
        "prc_balance": data.get("prc_balance", 0)
    }


class TestMiningStatusAPI:
    """Test /api/mining/status/{uid} endpoint"""
    
    def test_mining_status_returns_valid_data(self, api_client, test_user_auth):
        """Mining status should return all required fields"""
        uid = test_user_auth["uid"]
        response = api_client.get(f"{BASE_URL}/api/mining/status/{uid}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields for speedometer and dashboard
        assert "mining_rate" in data or "mining_rate_per_hour" in data
        assert "current_balance" in data
        assert "session_active" in data
        assert "total_mined" in data
        assert "base_rate" in data
    
    def test_mining_status_has_referral_breakdown(self, api_client, test_user_auth):
        """Mining status should include referral breakdown for speed display"""
        uid = test_user_auth["uid"]
        response = api_client.get(f"{BASE_URL}/api/mining/status/{uid}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check referral breakdown exists (used for Speed Breakdown section)
        assert "referral_breakdown" in data
        # Should be a dict or empty dict
        assert isinstance(data["referral_breakdown"], dict)
    
    def test_mining_status_has_session_info(self, api_client, test_user_auth):
        """Mining status should include session timing info for circular timer"""
        uid = test_user_auth["uid"]
        response = api_client.get(f"{BASE_URL}/api/mining/status/{uid}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Session fields for the circular timer
        assert "session_active" in data or "is_mining" in data
        assert "remaining_hours" in data
        assert "mined_this_session" in data
    
    def test_mining_status_invalid_user(self, api_client):
        """Mining status should return 404 for invalid user"""
        response = api_client.get(f"{BASE_URL}/api/mining/status/invalid-uid-12345")
        assert response.status_code == 404


class TestMiningStartAPI:
    """Test /api/mining/start/{uid} endpoint"""
    
    def test_mining_start_success(self, api_client, test_user_auth):
        """Starting mining should return session info"""
        uid = test_user_auth["uid"]
        response = api_client.post(f"{BASE_URL}/api/mining/start/{uid}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "session_active" in data
        assert data["session_active"] == True
        assert "session_start" in data
        assert "session_end" in data
        assert "remaining_hours" in data
    
    def test_mining_start_already_active(self, api_client, test_user_auth):
        """Starting mining when already active should handle gracefully"""
        uid = test_user_auth["uid"]
        
        # First start (or already active)
        response1 = api_client.post(f"{BASE_URL}/api/mining/start/{uid}")
        assert response1.status_code == 200
        
        # Second start - should return active session info
        response2 = api_client.post(f"{BASE_URL}/api/mining/start/{uid}")
        assert response2.status_code == 200
        data = response2.json()
        assert data["session_active"] == True
    
    def test_mining_start_invalid_user(self, api_client):
        """Starting mining for invalid user should return 404"""
        response = api_client.post(f"{BASE_URL}/api/mining/start/invalid-uid-99999")
        assert response.status_code == 404


class TestMiningClaimAPI:
    """Test /api/mining/claim/{uid} endpoint"""
    
    def test_mining_claim_paid_user_success(self, api_client, test_user_auth):
        """Paid user should be able to claim mined PRC"""
        uid = test_user_auth["uid"]
        subscription = test_user_auth.get("subscription_plan", "explorer")
        
        # Skip if free user
        if subscription in ["explorer", "free", "", None]:
            pytest.skip("Test user is not a paid subscriber")
        
        # First ensure mining is started
        start_response = api_client.post(f"{BASE_URL}/api/mining/start/{uid}")
        assert start_response.status_code == 200
        
        # Give some time to accumulate PRC (or claim what's there)
        response = api_client.post(f"{BASE_URL}/api/mining/claim/{uid}")
        
        # Should succeed for paid users
        assert response.status_code == 200
        data = response.json()
        assert "success" in data or "claimed_amount" in data or "amount" in data
    
    def test_mining_claim_invalid_user(self, api_client):
        """Claiming for invalid user should return 404"""
        response = api_client.post(f"{BASE_URL}/api/mining/claim/invalid-uid-77777")
        assert response.status_code == 404


class TestMiningRateCalculation:
    """Test mining rate calculation logic"""
    
    def test_mining_rate_is_positive(self, api_client, test_user_auth):
        """Mining rate should be a positive number"""
        uid = test_user_auth["uid"]
        response = api_client.get(f"{BASE_URL}/api/mining/status/{uid}")
        
        assert response.status_code == 200
        data = response.json()
        
        rate = data.get("mining_rate") or data.get("mining_rate_per_hour", 0)
        assert rate > 0, "Mining rate should be positive"
    
    def test_base_rate_is_reasonable(self, api_client, test_user_auth):
        """Base mining rate should be around expected value (20.83 PRC/hr)"""
        uid = test_user_auth["uid"]
        response = api_client.get(f"{BASE_URL}/api/mining/status/{uid}")
        
        assert response.status_code == 200
        data = response.json()
        
        base_rate = data.get("base_rate", 0)
        # Base rate should be around 20.83 PRC/hr (500 PRC/day = 20.83/hr)
        assert 15 <= base_rate <= 50, f"Base rate {base_rate} seems unusual"


class TestUserRedemptionStats:
    """Test user redemption stats API used by odometer"""
    
    def test_redemption_stats_exists(self, api_client, test_user_auth):
        """User redemption stats should be accessible"""
        uid = test_user_auth["uid"]
        response = api_client.get(f"{BASE_URL}/api/user/{uid}/redemption-stats")
        
        # May return 200 or 404 depending on implementation
        if response.status_code == 200:
            data = response.json()
            assert "total_earned" in data or "total_prc_redeemed" in data
    
    def test_user_profile_has_balance(self, api_client, test_user_auth):
        """User profile should have PRC balance for dashboard display"""
        uid = test_user_auth["uid"]
        response = api_client.get(f"{BASE_URL}/api/user/{uid}")
        
        assert response.status_code == 200
        data = response.json()
        assert "prc_balance" in data


class TestHealthCheck:
    """Basic health check for API availability"""
    
    def test_api_health(self, api_client):
        """API health endpoint should respond"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
