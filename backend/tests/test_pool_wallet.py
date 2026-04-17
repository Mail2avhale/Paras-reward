"""
Pool Wallet & Core Team System Tests
=====================================
Tests for:
1. GET /api/pool-wallet/info - Public pool info
2. GET /api/pool-wallet/admin/balance - Admin detailed pool info
3. POST /api/pool-wallet/admin/add-member - Add core team member
4. DELETE /api/pool-wallet/admin/remove-member/{uid} - Remove member
5. GET /api/pool-wallet/admin/members - List core team members
6. PUT /api/pool-wallet/admin/settings - Update pool rate
7. POST /api/pool-wallet/admin/distribute - Manual distribution
8. GET /api/pool-wallet/is-member/{uid} - Check membership
9. Dashboard API returns pool_wallet object
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_MOBILE = "9970100782"


class TestPoolWalletPublicEndpoints:
    """Test public pool wallet endpoints"""
    
    def test_get_pool_info(self):
        """GET /api/pool-wallet/info - Returns pool balance, team count, rate"""
        response = requests.get(f"{BASE_URL}/api/pool-wallet/info")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "pool_balance" in data, f"Missing pool_balance in response: {data}"
        assert "core_team_count" in data, f"Missing core_team_count in response: {data}"
        assert "pool_rate" in data, f"Missing pool_rate in response: {data}"
        
        # Validate types
        assert isinstance(data["pool_balance"], (int, float)), f"pool_balance should be numeric"
        assert isinstance(data["core_team_count"], int), f"core_team_count should be int"
        assert isinstance(data["pool_rate"], (int, float)), f"pool_rate should be numeric"
        
        print(f"✅ Pool Info: balance={data['pool_balance']}, team_count={data['core_team_count']}, rate={data['pool_rate']}%")
    
    def test_check_membership_not_member(self):
        """GET /api/pool-wallet/is-member/{uid} - Check non-member"""
        # Use a random UID that's unlikely to be a member
        random_uid = "test-random-uid-12345"
        response = requests.get(f"{BASE_URL}/api/pool-wallet/is-member/{random_uid}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "is_member" in data, f"Missing is_member in response: {data}"
        assert isinstance(data["is_member"], bool), f"is_member should be boolean"
        
        print(f"✅ Membership check for random UID: is_member={data['is_member']}")
    
    def test_check_membership_test_user(self):
        """GET /api/pool-wallet/is-member/{uid} - Check test user membership"""
        response = requests.get(f"{BASE_URL}/api/pool-wallet/is-member/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "is_member" in data, f"Missing is_member in response: {data}"
        
        print(f"✅ Test user membership: is_member={data['is_member']}")


class TestPoolWalletAdminEndpoints:
    """Test admin pool wallet endpoints"""
    
    def test_admin_get_pool_balance(self):
        """GET /api/pool-wallet/admin/balance - Detailed pool info"""
        response = requests.get(f"{BASE_URL}/api/pool-wallet/admin/balance")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        
        # Check required fields
        required_fields = ["balance", "total_credited", "total_distributed", "settings", "core_team_count", "recent_transactions"]
        for field in required_fields:
            assert field in data, f"Missing {field} in response: {data}"
        
        # Validate settings structure
        settings = data.get("settings", {})
        assert "pool_rate" in settings, f"Missing pool_rate in settings: {settings}"
        
        print(f"✅ Admin Pool Balance: balance={data['balance']}, credited={data['total_credited']}, distributed={data['total_distributed']}")
        print(f"   Settings: {settings}")
        print(f"   Core team count: {data['core_team_count']}")
        print(f"   Recent transactions: {len(data.get('recent_transactions', []))} items")
    
    def test_admin_list_members(self):
        """GET /api/pool-wallet/admin/members - List all core team members"""
        response = requests.get(f"{BASE_URL}/api/pool-wallet/admin/members")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "members" in data, f"Missing members in response: {data}"
        assert "count" in data, f"Missing count in response: {data}"
        
        members = data.get("members", [])
        assert isinstance(members, list), f"members should be a list"
        
        print(f"✅ Core Team Members: count={data['count']}")
        for m in members[:3]:  # Show first 3
            print(f"   - {m.get('name', 'N/A')} (uid: {m.get('uid', 'N/A')[:8]}...)")
    
    def test_admin_add_member(self):
        """POST /api/pool-wallet/admin/add-member - Add test user to core team"""
        response = requests.post(
            f"{BASE_URL}/api/pool-wallet/admin/add-member",
            json={"uid": TEST_USER_UID}
        )
        
        # Can be 200 (success) or 400 (already member)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        if response.status_code == 200:
            assert data.get("success") == True, f"Expected success=True, got {data}"
            print(f"✅ Added test user to core team: {data.get('message')}")
        else:
            # Already a member
            print(f"✅ Test user already a core team member: {data.get('detail')}")
    
    def test_admin_verify_membership_after_add(self):
        """Verify test user is now a core team member"""
        response = requests.get(f"{BASE_URL}/api/pool-wallet/is-member/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("is_member") == True, f"Expected is_member=True after adding, got {data}"
        
        print(f"✅ Verified test user is core team member: is_member={data['is_member']}")
    
    def test_admin_update_settings(self):
        """PUT /api/pool-wallet/admin/settings - Update pool rate"""
        # First get current settings
        info_response = requests.get(f"{BASE_URL}/api/pool-wallet/info")
        current_rate = info_response.json().get("pool_rate", 20)
        
        # Update to a new rate (toggle between 20 and 25)
        new_rate = 25 if current_rate == 20 else 20
        
        response = requests.put(
            f"{BASE_URL}/api/pool-wallet/admin/settings",
            json={"pool_rate": new_rate}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "updated" in data, f"Missing updated in response: {data}"
        
        print(f"✅ Updated pool settings: {data.get('updated')}")
        
        # Verify the change
        verify_response = requests.get(f"{BASE_URL}/api/pool-wallet/info")
        verify_data = verify_response.json()
        assert verify_data.get("pool_rate") == new_rate, f"Rate not updated: expected {new_rate}, got {verify_data.get('pool_rate')}"
        
        print(f"✅ Verified pool rate changed to {new_rate}%")
        
        # Restore original rate
        requests.put(f"{BASE_URL}/api/pool-wallet/admin/settings", json={"pool_rate": current_rate})
        print(f"✅ Restored pool rate to {current_rate}%")
    
    def test_admin_manual_distribute(self):
        """POST /api/pool-wallet/admin/distribute - Manual distribution"""
        response = requests.post(f"{BASE_URL}/api/pool-wallet/admin/distribute")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Distribution can succeed with 0 balance or 0 members
        assert "success" in data, f"Missing success in response: {data}"
        
        if data.get("success"):
            print(f"✅ Manual distribution result: distributed={data.get('distributed', 0)}, members={data.get('members', 0)}")
            print(f"   Message: {data.get('message', 'N/A')}")
        else:
            print(f"⚠️ Distribution failed: {data.get('error', 'Unknown error')}")
    
    def test_admin_remove_member(self):
        """DELETE /api/pool-wallet/admin/remove-member/{uid} - Remove test user"""
        response = requests.delete(f"{BASE_URL}/api/pool-wallet/admin/remove-member/{TEST_USER_UID}")
        
        # Can be 200 (success) or 404 (not found/already removed)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        if response.status_code == 200:
            assert data.get("success") == True, f"Expected success=True, got {data}"
            print(f"✅ Removed test user from core team: {data.get('message')}")
        else:
            print(f"✅ Test user was not a member or already removed: {data.get('detail')}")
    
    def test_admin_verify_membership_after_remove(self):
        """Verify test user is no longer a core team member"""
        response = requests.get(f"{BASE_URL}/api/pool-wallet/is-member/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("is_member") == False, f"Expected is_member=False after removal, got {data}"
        
        print(f"✅ Verified test user is NOT core team member: is_member={data['is_member']}")


class TestDashboardPoolWalletIntegration:
    """Test dashboard API returns pool_wallet object"""
    
    def test_dashboard_returns_pool_wallet(self):
        """GET /api/user/{uid}/dashboard - Returns pool_wallet object"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check pool_wallet object exists
        assert "pool_wallet" in data, f"Missing pool_wallet in dashboard response: {list(data.keys())}"
        
        pool_wallet = data.get("pool_wallet", {})
        
        # Validate pool_wallet structure
        assert "balance" in pool_wallet, f"Missing balance in pool_wallet: {pool_wallet}"
        assert "core_team_count" in pool_wallet, f"Missing core_team_count in pool_wallet: {pool_wallet}"
        assert "is_core_member" in pool_wallet, f"Missing is_core_member in pool_wallet: {pool_wallet}"
        
        # Validate types
        assert isinstance(pool_wallet["balance"], (int, float)), f"balance should be numeric"
        assert isinstance(pool_wallet["core_team_count"], int), f"core_team_count should be int"
        assert isinstance(pool_wallet["is_core_member"], bool), f"is_core_member should be boolean"
        
        print(f"✅ Dashboard pool_wallet: balance={pool_wallet['balance']}, team_count={pool_wallet['core_team_count']}, is_member={pool_wallet['is_core_member']}")


class TestPoolWalletEdgeCases:
    """Test edge cases and validation"""
    
    def test_add_nonexistent_user(self):
        """POST /api/pool-wallet/admin/add-member - Add non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/pool-wallet/admin/add-member",
            json={"uid": "nonexistent-user-uid-12345"}
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, f"Missing detail in error response: {data}"
        
        print(f"✅ Correctly rejected non-existent user: {data.get('detail')}")
    
    def test_remove_nonexistent_member(self):
        """DELETE /api/pool-wallet/admin/remove-member/{uid} - Remove non-member"""
        response = requests.delete(f"{BASE_URL}/api/pool-wallet/admin/remove-member/nonexistent-uid-12345")
        
        assert response.status_code == 404, f"Expected 404 for non-member, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, f"Missing detail in error response: {data}"
        
        print(f"✅ Correctly rejected non-member removal: {data.get('detail')}")
    
    def test_invalid_pool_rate(self):
        """PUT /api/pool-wallet/admin/settings - Invalid pool rate"""
        # Test rate > 100
        response = requests.put(
            f"{BASE_URL}/api/pool-wallet/admin/settings",
            json={"pool_rate": 150}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid rate, got {response.status_code}: {response.text}"
        
        print(f"✅ Correctly rejected invalid pool rate (150%)")
        
        # Test negative rate
        response = requests.put(
            f"{BASE_URL}/api/pool-wallet/admin/settings",
            json={"pool_rate": -10}
        )
        
        assert response.status_code == 400, f"Expected 400 for negative rate, got {response.status_code}: {response.text}"
        
        print(f"✅ Correctly rejected negative pool rate (-10%)")
    
    def test_empty_settings_update(self):
        """PUT /api/pool-wallet/admin/settings - Empty update"""
        response = requests.put(
            f"{BASE_URL}/api/pool-wallet/admin/settings",
            json={}
        )
        
        assert response.status_code == 400, f"Expected 400 for empty update, got {response.status_code}: {response.text}"
        
        print(f"✅ Correctly rejected empty settings update")


class TestPoolWalletFullFlow:
    """Test complete flow: add member → verify → distribute → remove"""
    
    def test_full_core_team_flow(self):
        """Complete core team member lifecycle
        
        Note: Dashboard API has 60-second cache. We test the direct is-member endpoint
        which is not cached, and verify dashboard structure separately.
        """
        print("\n=== Full Core Team Flow Test ===")
        
        # Step 1: Check initial membership via direct endpoint (not cached)
        response = requests.get(f"{BASE_URL}/api/pool-wallet/is-member/{TEST_USER_UID}")
        initial_membership = response.json().get("is_member", False)
        print(f"1. Initial membership: {initial_membership}")
        
        # Step 2: Add to core team
        response = requests.post(
            f"{BASE_URL}/api/pool-wallet/admin/add-member",
            json={"uid": TEST_USER_UID}
        )
        if response.status_code == 200:
            print(f"2. Added to core team: {response.json().get('message')}")
        else:
            print(f"2. Already a member: {response.json().get('detail')}")
        
        # Step 3: Verify membership via direct endpoint (not cached)
        response = requests.get(f"{BASE_URL}/api/pool-wallet/is-member/{TEST_USER_UID}")
        assert response.json().get("is_member") == True, "Should be member after adding"
        print(f"3. Verified membership: is_member=True")
        
        # Step 4: Verify dashboard has pool_wallet structure (cache may have stale is_core_member)
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        pool_wallet = response.json().get("pool_wallet", {})
        # Just verify structure exists - cache may have stale data
        assert "is_core_member" in pool_wallet, "Dashboard should have is_core_member field"
        assert "balance" in pool_wallet, "Dashboard should have balance field"
        assert "core_team_count" in pool_wallet, "Dashboard should have core_team_count field"
        print(f"4. Dashboard pool_wallet structure verified (cache may have stale is_core_member)")
        
        # Step 5: Trigger distribution (may have 0 balance)
        response = requests.post(f"{BASE_URL}/api/pool-wallet/admin/distribute")
        dist_result = response.json()
        print(f"5. Distribution result: {dist_result.get('message', 'N/A')}")
        
        # Step 6: Remove from core team
        response = requests.delete(f"{BASE_URL}/api/pool-wallet/admin/remove-member/{TEST_USER_UID}")
        if response.status_code == 200:
            print(f"6. Removed from core team: {response.json().get('message')}")
        else:
            print(f"6. Removal status: {response.json().get('detail')}")
        
        # Step 7: Verify no longer a member via direct endpoint (not cached)
        response = requests.get(f"{BASE_URL}/api/pool-wallet/is-member/{TEST_USER_UID}")
        assert response.json().get("is_member") == False, "Should not be member after removal"
        print(f"7. Verified removal: is_member=False")
        
        print("=== Full Flow Test PASSED ===\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
