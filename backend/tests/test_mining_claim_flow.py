"""
Test Mining/Daily Rewards Flow - Specifically testing the claim endpoint fix
Tests:
1. Mining page loads correctly after login
2. Start mining session if not active
3. Session timer counts down properly
4. Session earnings (PRC) accumulate over time
5. Collect Rewards button is clickable when PRC >= 0.01
6. After clicking Collect Rewards: success response
7. After clicking Collect Rewards: session PRC resets to 0
8. After clicking Collect Rewards: session timer resets to 24 hours
9. After clicking Collect Rewards: balance updates correctly
10. Mining continues after collection (session stays active)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMiningClaimFlow:
    """Test the complete mining claim flow - verifying the fix for session reset"""
    
    test_uid = None
    initial_balance = 0
    session_was_active = False
    mined_before_claim = 0
    claimed_amount = 0
    new_balance = 0
    
    @classmethod
    def login(cls):
        """Login and get user UID"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": "admin@paras.com", "password": "admin123"}
        )
        if response.status_code == 200:
            cls.test_uid = response.json().get("uid")
        return response
        
    def test_01_login_and_get_user(self):
        """Test login and get user UID"""
        response = self.__class__.login()
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "uid" in data, "No uid in login response"
        print(f"✅ Login successful, UID: {self.__class__.test_uid}")
        
    def test_02_get_mining_status_initial(self):
        """Test getting initial mining status"""
        if not self.__class__.test_uid:
            self.__class__.login()
            
        uid = self.__class__.test_uid
        assert uid, "No test UID available"
            
        response = requests.get(f"{BASE_URL}/api/mining/status/{uid}")
        assert response.status_code == 200, f"Mining status failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "current_balance" in data, "Missing current_balance"
        assert "mining_rate" in data or "mining_rate_per_hour" in data, "Missing mining_rate"
        assert "session_active" in data, "Missing session_active"
        assert "mined_this_session" in data, "Missing mined_this_session"
        
        print(f"✅ Mining status: session_active={data.get('session_active')}, balance={data.get('current_balance')}")
        self.__class__.initial_balance = data.get("current_balance", 0)
        self.__class__.session_was_active = data.get("session_active", False)
        
    def test_03_start_mining_session(self):
        """Test starting a mining session"""
        if not self.__class__.test_uid:
            self.__class__.login()
            
        uid = self.__class__.test_uid
        assert uid, "No test UID available"
            
        response = requests.post(f"{BASE_URL}/api/mining/start/{uid}")
        assert response.status_code == 200, f"Start mining failed: {response.text}"
        data = response.json()
        
        # Should either start new session or return existing active session
        assert "session_active" in data, "Missing session_active in response"
        assert data["session_active"] == True, "Session should be active"
        assert "session_start" in data, "Missing session_start"
        assert "session_end" in data, "Missing session_end"
        assert "remaining_hours" in data, "Missing remaining_hours"
        
        print(f"✅ Mining session active: remaining_hours={data.get('remaining_hours')}")
        
    def test_04_verify_session_active(self):
        """Verify mining session is active after starting"""
        if not self.__class__.test_uid:
            self.__class__.login()
            
        uid = self.__class__.test_uid
        assert uid, "No test UID available"
            
        response = requests.get(f"{BASE_URL}/api/mining/status/{uid}")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("session_active") == True, "Session should be active"
        assert data.get("remaining_hours", 0) > 0, "Should have remaining hours"
        
        print(f"✅ Session verified active: remaining={data.get('remaining_hours')} hours")
        
    def test_05_wait_for_prc_accumulation(self):
        """Wait a few seconds for PRC to accumulate"""
        if not self.__class__.test_uid:
            self.__class__.login()
            
        uid = self.__class__.test_uid
        assert uid, "No test UID available"
            
        # Wait 3 seconds for some PRC to accumulate
        print("⏳ Waiting 3 seconds for PRC accumulation...")
        time.sleep(3)
        
        response = requests.get(f"{BASE_URL}/api/mining/status/{uid}")
        assert response.status_code == 200
        data = response.json()
        
        mined = data.get("mined_this_session", 0)
        print(f"✅ Mined this session: {mined} PRC")
        self.__class__.mined_before_claim = mined
        
    def test_06_claim_mining_rewards(self):
        """Test claiming mining rewards - THE MAIN FIX TEST"""
        if not self.__class__.test_uid:
            self.__class__.login()
            
        uid = self.__class__.test_uid
        assert uid, "No test UID available"
            
        # Get balance before claim
        status_before = requests.get(f"{BASE_URL}/api/mining/status/{uid}").json()
        balance_before = status_before.get("current_balance", 0)
        mined_before = status_before.get("mined_this_session", 0)
        
        print(f"📊 Before claim: balance={balance_before}, mined_this_session={mined_before}")
        
        # Claim rewards
        response = requests.post(f"{BASE_URL}/api/mining/claim/{uid}")
        assert response.status_code == 200, f"Claim failed: {response.text}"
        data = response.json()
        
        # Verify response structure (THE FIX)
        assert "success" in data, "Missing success field"
        assert data.get("success") == True, "Claim should be successful"
        assert "claimed_amount" in data, "Missing claimed_amount"
        assert "new_balance" in data, "Missing new_balance"
        
        # CRITICAL: Verify session reset data is present (THE FIX)
        assert "session_reset" in data, "Missing session_reset - FIX NOT APPLIED"
        assert data.get("session_reset") == True, "session_reset should be True"
        assert "new_session_start" in data, "Missing new_session_start"
        assert "new_session_end" in data, "Missing new_session_end"
        assert "remaining_hours" in data, "Missing remaining_hours"
        assert data.get("remaining_hours") == 24, f"remaining_hours should be 24, got {data.get('remaining_hours')}"
        
        print(f"✅ Claim successful!")
        print(f"   - claimed_amount: {data.get('claimed_amount')}")
        print(f"   - new_balance: {data.get('new_balance')}")
        print(f"   - session_reset: {data.get('session_reset')}")
        print(f"   - remaining_hours: {data.get('remaining_hours')}")
        
        self.__class__.claimed_amount = data.get("claimed_amount", 0)
        self.__class__.new_balance = data.get("new_balance", 0)
        
    def test_07_verify_session_reset_after_claim(self):
        """Verify session is properly reset after claim"""
        if not self.__class__.test_uid:
            self.__class__.login()
            
        uid = self.__class__.test_uid
        assert uid, "No test UID available"
            
        # Small delay to ensure cache is invalidated
        time.sleep(1)
        
        response = requests.get(f"{BASE_URL}/api/mining/status/{uid}")
        assert response.status_code == 200
        data = response.json()
        
        # Session should still be active (continuous mining)
        assert data.get("session_active") == True, "Session should still be active after claim"
        
        # Remaining hours should be close to 24 (just reset)
        remaining = data.get("remaining_hours", 0)
        assert remaining > 23.9, f"Remaining hours should be ~24, got {remaining}"
        
        # Mined this session should be very small (just started new session)
        mined = data.get("mined_this_session", 0)
        assert mined < 0.1, f"Mined this session should be near 0 after reset, got {mined}"
        
        print(f"✅ Session properly reset:")
        print(f"   - session_active: {data.get('session_active')}")
        print(f"   - remaining_hours: {remaining}")
        print(f"   - mined_this_session: {mined}")
        
    def test_08_verify_balance_updated(self):
        """Verify balance was updated correctly"""
        if not self.__class__.test_uid:
            self.__class__.login()
            
        uid = self.__class__.test_uid
        assert uid, "No test UID available"
            
        response = requests.get(f"{BASE_URL}/api/mining/status/{uid}")
        assert response.status_code == 200
        data = response.json()
        
        current_balance = data.get("current_balance", 0)
        expected_balance = self.__class__.new_balance
        
        # Balance should match what was returned in claim response
        assert abs(current_balance - expected_balance) < 0.01, \
            f"Balance mismatch: current={current_balance}, expected={expected_balance}"
        
        print(f"✅ Balance verified: {current_balance}")
        
    def test_09_mining_continues_after_claim(self):
        """Verify mining continues after claim (session stays active)"""
        if not self.__class__.test_uid:
            self.__class__.login()
            
        uid = self.__class__.test_uid
        assert uid, "No test UID available"
            
        # Wait a bit for more PRC to accumulate
        print("⏳ Waiting 2 seconds to verify mining continues...")
        time.sleep(2)
        
        response = requests.get(f"{BASE_URL}/api/mining/status/{uid}")
        assert response.status_code == 200
        data = response.json()
        
        # Session should still be active
        assert data.get("session_active") == True, "Mining should continue after claim"
        
        # Should have accumulated some PRC
        mined = data.get("mined_this_session", 0)
        assert mined > 0, "Should have accumulated some PRC after waiting"
        
        print(f"✅ Mining continues: mined_this_session={mined}")
        
    def test_10_second_claim_works(self):
        """Test that a second claim also works correctly"""
        if not self.__class__.test_uid:
            self.__class__.login()
            
        uid = self.__class__.test_uid
        assert uid, "No test UID available"
            
        # Wait for more PRC
        print("⏳ Waiting 2 seconds before second claim...")
        time.sleep(2)
        
        # Second claim
        response = requests.post(f"{BASE_URL}/api/mining/claim/{uid}")
        assert response.status_code == 200, f"Second claim failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Second claim should succeed"
        assert data.get("session_reset") == True, "Session should reset on second claim"
        assert data.get("remaining_hours") == 24, "Should reset to 24 hours"
        
        print(f"✅ Second claim successful: claimed={data.get('claimed_amount')}")


class TestMiningEndpointResponses:
    """Test mining endpoint response structures"""
    
    @staticmethod
    def get_uid():
        """Get user UID via login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": "admin@paras.com", "password": "admin123"}
        )
        if response.status_code == 200:
            return response.json().get("uid")
        return None
    
    def test_mining_status_response_structure(self):
        """Verify mining status endpoint returns all required fields"""
        uid = self.get_uid()
        assert uid, "Failed to get UID"
        
        response = requests.get(f"{BASE_URL}/api/mining/status/{uid}")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "current_balance",
            "mining_rate_per_hour",
            "base_rate",
            "active_referrals",
            "total_mined",
            "session_active",
            "remaining_hours",
            "mined_this_session",
            "is_mining"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            
        print(f"✅ Mining status response has all required fields")
        
    def test_mining_start_response_structure(self):
        """Verify mining start endpoint returns all required fields"""
        uid = self.get_uid()
        assert uid, "Failed to get UID"
        
        response = requests.post(f"{BASE_URL}/api/mining/start/{uid}")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "session_active",
            "session_start",
            "session_end",
            "remaining_hours"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            
        print(f"✅ Mining start response has all required fields")
        
    def test_mining_claim_response_structure(self):
        """Verify mining claim endpoint returns all required fields including session reset"""
        uid = self.get_uid()
        assert uid, "Failed to get UID"
        
        # Ensure session is active
        requests.post(f"{BASE_URL}/api/mining/start/{uid}")
        time.sleep(1)  # Wait for some PRC
        
        response = requests.post(f"{BASE_URL}/api/mining/claim/{uid}")
        assert response.status_code == 200
        data = response.json()
        
        # Required fields for the fix
        required_fields = [
            "success",
            "claimed_amount",
            "new_balance",
            "total_mined",
            "session_reset",  # THE FIX
            "new_session_start",  # THE FIX
            "new_session_end",  # THE FIX
            "remaining_hours"  # THE FIX
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            
        # Verify session reset values
        assert data["session_reset"] == True, "session_reset should be True"
        assert data["remaining_hours"] == 24, "remaining_hours should be 24"
        
        print(f"✅ Mining claim response has all required fields including session reset data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
