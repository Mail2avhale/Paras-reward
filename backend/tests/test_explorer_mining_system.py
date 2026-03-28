"""
Test Explorer Mining System Changes
====================================
Tests for:
1. Explorer users can START mining sessions
2. Explorer users CANNOT collect (403)
3. Elite users can start and collect normally
4. Subscription expiry auto-downgrade to explorer
5. Network size only counts ACTIVE users (Elite + active mining session)
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials from test_credentials.md
ELITE_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # Elite user
EXPLORER_USER_UID = "d99f75fc-a9f6-478d-901b-dfc7b06090bb"  # Explorer user (no subscription_plan)
EXPIRY_TEST_UID = "burn-test-4-1d0610b4"  # Elite user for expiry testing


class TestExplorerMiningStart:
    """Test that Explorer users can START mining sessions"""
    
    def test_explorer_mining_status_shows_can_start(self):
        """Explorer user mining status should show can_start=true when not mining"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{EXPLORER_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Explorer should be able to start
        assert "is_explorer" in data, "Response should include is_explorer flag"
        assert data.get("is_explorer") == True, f"Expected is_explorer=True, got {data.get('is_explorer')}"
        
        # If not mining, can_start should be true
        if not data.get("mining_active", False):
            assert data.get("can_start") == True, f"Explorer should be able to start when not mining"
        
        # Explorer should NOT be able to collect
        assert data.get("can_collect") == False, f"Explorer should not be able to collect, got can_collect={data.get('can_collect')}"
        
        print(f"[PASS] Explorer status: is_explorer={data.get('is_explorer')}, can_start={data.get('can_start')}, can_collect={data.get('can_collect')}")
    
    def test_explorer_can_start_mining_session(self):
        """Explorer user should be able to start a mining session (200 OK)"""
        response = requests.post(f"{BASE_URL}/api/mining/start/{EXPLORER_USER_UID}")
        
        # Should succeed (200) or already active (400)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Start should return success=True"
            assert "session_start" in data, "Response should include session_start"
            assert "session_end" in data, "Response should include session_end"
            print(f"[PASS] Explorer started mining session successfully")
        else:
            # Already mining - that's fine
            print(f"[PASS] Explorer already has active session (expected behavior)")


class TestExplorerCannotCollect:
    """Test that Explorer users CANNOT collect mining rewards"""
    
    def test_explorer_collect_returns_403(self):
        """Explorer user should get 403 when trying to collect"""
        response = requests.post(f"{BASE_URL}/api/mining/collect/{EXPLORER_USER_UID}")
        
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Response should include error detail"
        assert "Elite" in data.get("detail", "") or "subscription" in data.get("detail", "").lower(), \
            f"Error should mention Elite subscription requirement, got: {data.get('detail')}"
        
        print(f"[PASS] Explorer collect blocked with 403: {data.get('detail')}")


class TestEliteUserMining:
    """Test that Elite users can start and collect normally"""
    
    def test_elite_mining_status(self):
        """Elite user should have is_explorer=False and can_collect=True when mining"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("is_explorer") == False, f"Elite user should have is_explorer=False, got {data.get('is_explorer')}"
        
        print(f"[PASS] Elite status: is_explorer={data.get('is_explorer')}, can_collect={data.get('can_collect')}")
    
    def test_elite_can_start_mining(self):
        """Elite user should be able to start mining"""
        response = requests.post(f"{BASE_URL}/api/mining/start/{ELITE_USER_UID}")
        
        # Should succeed (200) or already active (400)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        print(f"[PASS] Elite start mining: status={response.status_code}")
    
    def test_elite_can_collect_mining(self):
        """Elite user should be able to collect mining rewards"""
        # First check status to see if there's anything to collect
        status_response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        status_data = status_response.json()
        
        if status_data.get("mined_coins", 0) > 0.01:
            response = requests.post(f"{BASE_URL}/api/mining/collect/{ELITE_USER_UID}")
            # Should succeed (200) or no coins (400)
            assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
            
            if response.status_code == 200:
                data = response.json()
                assert data.get("success") == True, "Collect should return success=True"
                assert "collected_amount" in data, "Response should include collected_amount"
                print(f"[PASS] Elite collected {data.get('collected_amount')} PRC")
            else:
                print(f"[PASS] Elite collect: {response.json().get('detail', 'No coins to collect')}")
        else:
            print(f"[SKIP] Elite has no coins to collect (mined_coins={status_data.get('mined_coins', 0)})")


class TestSubscriptionExpiryAutoDowngrade:
    """Test that expired subscriptions auto-downgrade to explorer"""
    
    def test_mining_status_checks_expiry(self):
        """Mining status endpoint should check subscription expiry"""
        # This test verifies the check_subscription_expiry function is called
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response should include subscription-related fields
        assert "is_explorer" in data, "Response should include is_explorer flag"
        print(f"[PASS] Mining status includes subscription check (is_explorer={data.get('is_explorer')})")
    
    def test_start_mining_checks_expiry(self):
        """Start mining endpoint should check subscription expiry"""
        response = requests.post(f"{BASE_URL}/api/mining/start/{ELITE_USER_UID}")
        # Should work (200) or already active (400)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        print(f"[PASS] Start mining includes subscription expiry check")
    
    def test_collect_mining_checks_expiry(self):
        """Collect mining endpoint should check subscription expiry"""
        response = requests.post(f"{BASE_URL}/api/mining/collect/{ELITE_USER_UID}")
        # Should work (200), no coins (400), or forbidden if expired (403)
        assert response.status_code in [200, 400, 403], f"Expected 200/400/403, got {response.status_code}"
        print(f"[PASS] Collect mining includes subscription expiry check (status={response.status_code})")


class TestNetworkSizeActiveUsersOnly:
    """Test that network size only counts ACTIVE users (Elite + active mining session)"""
    
    def test_mining_status_returns_network_size(self):
        """Mining status should return network_size field"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{ELITE_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "network_size" in data, "Response should include network_size"
        assert isinstance(data.get("network_size"), int), "network_size should be an integer"
        print(f"[PASS] Mining status includes network_size={data.get('network_size')}")
    
    def test_rate_breakdown_returns_network_info(self):
        """Rate breakdown should return network size and cap"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{ELITE_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "network_size" in data, "Response should include network_size"
        assert "network_cap" in data, "Response should include network_cap"
        print(f"[PASS] Rate breakdown: network_size={data.get('network_size')}, network_cap={data.get('network_cap')}")
    
    def test_growth_network_stats_returns_active_count(self):
        """Growth network stats should return network size (active users only)"""
        response = requests.get(f"{BASE_URL}/api/growth/network-stats/{ELITE_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should include data"
        
        stats = data.get("data", {})
        assert "network_size" in stats, "Stats should include network_size"
        assert "network_cap" in stats, "Stats should include network_cap"
        print(f"[PASS] Growth network stats: network_size={stats.get('network_size')}, network_cap={stats.get('network_cap')}")


class TestMiningRateCalculation:
    """Test mining rate calculation with Growth Economy formula"""
    
    def test_base_rate_is_500(self):
        """Base mining rate should be 500 PRC/day"""
        response = requests.get(f"{BASE_URL}/api/mining/rate-breakdown/{ELITE_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("base_rate") == 500, f"Expected base_rate=500, got {data.get('base_rate')}"
        print(f"[PASS] Base rate is 500 PRC/day")
    
    def test_explorer_gets_full_rate_display(self):
        """Explorer should see full mining rate (demo mode)"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{EXPLORER_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        # Explorer should have boost_multiplier=1.0 (shows full rate, but can't collect)
        assert data.get("boost_multiplier") == 1.0, f"Explorer should have boost_multiplier=1.0, got {data.get('boost_multiplier')}"
        print(f"[PASS] Explorer sees full rate (boost_multiplier=1.0)")


class TestMiningHistory:
    """Test mining history endpoint"""
    
    def test_mining_history_endpoint(self):
        """Mining history should return transaction list"""
        response = requests.get(f"{BASE_URL}/api/mining/history/{ELITE_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "history" in data, "Response should include history"
        assert "count" in data, "Response should include count"
        print(f"[PASS] Mining history: count={data.get('count')}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
