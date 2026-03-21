"""
Test Suite for Admin Members List - Sorting Bug Fix Verification

Bug Fix: Frontend was sending sort_field/sort_direction but backend expected sort_by/sort_order
After fix: AdminMembers.js now correctly sends sort_by and sort_order params

Test Coverage:
1. Sorting by redeem_limit DESC - Elite (39950) should appear first, Growth (24950) second
2. Sorting by prc_balance DESC - highest balance first
3. Sorting by used_limit and available_limit
4. PRC Balance field shows actual values (not 0)
5. Redeem Limit formula validation: Plan Price × 5 × 10

Formula: Total Limit = Plan Price × 5 × 10 × months_active × (1 + 0.20 × active_referrals)
- Elite = 799 × 5 × 10 = 39,950 PRC base/month
- Growth = 499 × 5 × 10 = 24,950 PRC base/month
- Explorer = 0 PRC
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://redemption-limits.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def api_session():
    """Create requests session for API calls"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestSortingBugFix:
    """Verify sorting bug is fixed - backend accepts sort_by and sort_order params"""
    
    def test_sort_by_redeem_limit_desc(self, api_session):
        """
        When sorting by redeem_limit DESC, Elite users (39950) should appear 
        before Growth users (24950)
        """
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?sort_by=redeem_limit&sort_order=desc&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        members = data.get("members", [])
        assert len(members) > 0, "Should have at least one member"
        
        # Extract redeem limits
        limits = [m.get("redeem_limit", {}).get("total_limit", 0) for m in members]
        
        # Verify sorted in descending order
        for i in range(len(limits) - 1):
            assert limits[i] >= limits[i+1], f"Not sorted DESC at index {i}: {limits[i]} < {limits[i+1]}"
        
        # Verify Elite (39950) comes before Growth (24950) if both exist
        elite_users = [m for m in members if m.get("subscription_plan") == "elite"]
        growth_users = [m for m in members if m.get("subscription_plan") == "growth"]
        
        if elite_users and growth_users:
            elite_idx = next(i for i, m in enumerate(members) if m.get("subscription_plan") == "elite")
            growth_idx = next(i for i, m in enumerate(members) if m.get("subscription_plan") == "growth")
            assert elite_idx < growth_idx, f"Elite user should appear before Growth user. Elite at {elite_idx}, Growth at {growth_idx}"
    
    def test_sort_by_prc_balance_desc(self, api_session):
        """
        When sorting by prc_balance DESC, highest balance should appear first
        """
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?sort_by=prc_balance&sort_order=desc&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        members = data.get("members", [])
        assert len(members) > 0, "Should have at least one member"
        
        # Extract balances, treating None as 0
        balances = [m.get("prc_balance") or 0 for m in members]
        
        # Verify sorted in descending order
        for i in range(len(balances) - 1):
            assert balances[i] >= balances[i+1], f"Not sorted DESC at index {i}: {balances[i]} < {balances[i+1]}"
    
    def test_sort_by_used_limit_desc(self, api_session):
        """Verify sorting by used_limit (total_redeemed) works"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?sort_by=used_limit&sort_order=desc&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        members = data.get("members", [])
        if len(members) > 1:
            used = [m.get("redeem_limit", {}).get("total_redeemed", 0) for m in members]
            for i in range(len(used) - 1):
                assert used[i] >= used[i+1], f"Not sorted DESC at index {i}"
    
    def test_sort_by_available_limit_desc(self, api_session):
        """Verify sorting by available_limit (remaining_limit) works"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?sort_by=available_limit&sort_order=desc&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        members = data.get("members", [])
        if len(members) > 1:
            available = [m.get("redeem_limit", {}).get("remaining_limit", 0) for m in members]
            for i in range(len(available) - 1):
                assert available[i] >= available[i+1], f"Not sorted DESC at index {i}"


class TestPRCBalanceDisplay:
    """Verify PRC balance shows actual values (bug fix: was showing 0)"""
    
    def test_prc_balance_not_zero_for_active_users(self, api_session):
        """
        PRC Balance should show actual values, not 0.
        At least one user with subscription should have non-zero balance.
        """
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?limit=20")
        assert response.status_code == 200
        data = response.json()
        
        members = data.get("members", [])
        paid_users = [m for m in members if m.get("subscription_plan") in ["elite", "growth", "startup"]]
        
        if paid_users:
            # At least one paid user should have some PRC balance
            balances = [m.get("prc_balance", 0) for m in paid_users]
            assert any(b > 0 for b in balances), f"All paid users have 0 balance: {balances}"
    
    def test_prc_balance_field_exists(self, api_session):
        """Verify prc_balance field is present in member data"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?limit=5")
        assert response.status_code == 200
        data = response.json()
        
        members = data.get("members", [])
        for member in members:
            assert "prc_balance" in member, f"prc_balance field missing for {member.get('name')}"


class TestRedeemLimitFormula:
    """Verify redeem limit formula: Plan Price × 5 × 10 + 20% per referral"""
    
    def test_elite_user_limit_formula(self, api_session):
        """
        Elite: 799 × 5 × 10 = 39,950 PRC base per month
        Total = base × months_active × (1 + 0.2 × active_referrals)
        """
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?subscription=elite&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        members = data.get("members", [])
        if not members:
            pytest.skip("No Elite users found")
        
        for member in members:
            redeem = member.get("redeem_limit", {})
            total_limit = redeem.get("total_limit", 0)
            months_active = redeem.get("months_active", 1)
            active_referrals = redeem.get("active_referrals", 0)
            
            # Calculate expected: 799 × 5 × 10 × months × (1 + 0.2 × referrals)
            expected = 39950 * months_active * (1 + 0.2 * active_referrals)
            
            assert total_limit == expected, (
                f"Elite user {member.get('name')} limit mismatch. "
                f"Got {total_limit}, expected {expected} "
                f"(months={months_active}, referrals={active_referrals})"
            )
    
    def test_growth_user_limit_formula(self, api_session):
        """
        Growth: 499 × 5 × 10 = 24,950 PRC base per month
        Total = base × months_active × (1 + 0.2 × active_referrals)
        """
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?subscription=growth&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        members = data.get("members", [])
        if not members:
            pytest.skip("No Growth users found")
        
        for member in members:
            redeem = member.get("redeem_limit", {})
            total_limit = redeem.get("total_limit", 0)
            months_active = redeem.get("months_active", 1)
            active_referrals = redeem.get("active_referrals", 0)
            
            # Calculate expected: 499 × 5 × 10 × months × (1 + 0.2 × referrals)
            expected = 24950 * months_active * (1 + 0.2 * active_referrals)
            
            assert total_limit == expected, (
                f"Growth user {member.get('name')} limit mismatch. "
                f"Got {total_limit}, expected {expected}"
            )
    
    def test_explorer_user_zero_limit(self, api_session):
        """Explorer (free) users should have 0 redeem limit"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?subscription=explorer&limit=10")
        
        # If no explorer filter support, skip
        if response.status_code != 200:
            pytest.skip("Explorer filter not supported")
        
        data = response.json()
        members = data.get("members", [])
        
        for member in members:
            redeem = member.get("redeem_limit", {})
            assert redeem.get("total_limit", 0) == 0, (
                f"Explorer user {member.get('name')} should have 0 limit, got {redeem.get('total_limit')}"
            )


class TestRedeemLimitDataStructure:
    """Verify redeem_limit object has all required fields"""
    
    def test_redeem_limit_object_structure(self, api_session):
        """Each member should have redeem_limit with required fields"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?limit=5")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["total_limit", "total_redeemed", "remaining_limit"]
        
        for member in data.get("members", []):
            redeem = member.get("redeem_limit", {})
            assert redeem, f"Member {member.get('name')} missing redeem_limit object"
            
            for field in required_fields:
                assert field in redeem, f"Missing field '{field}' in redeem_limit for {member.get('name')}"
    
    def test_remaining_limit_calculation(self, api_session):
        """remaining_limit should equal total_limit - total_redeemed"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        for member in data.get("members", []):
            redeem = member.get("redeem_limit", {})
            total = redeem.get("total_limit", 0)
            used = redeem.get("total_redeemed", 0)
            remaining = redeem.get("remaining_limit", 0)
            
            expected_remaining = max(0, total - used)
            assert remaining == expected_remaining, (
                f"Remaining limit calculation error for {member.get('name')}: "
                f"{remaining} != {total} - {used} = {expected_remaining}"
            )


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_members_list_api_accessible(self, api_session):
        """Verify members list API is accessible"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list")
        assert response.status_code == 200
    
    def test_pagination_works(self, api_session):
        """Verify pagination returns correct structure"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        
        assert "members" in data
        assert "pagination" in data
        
        pagination = data["pagination"]
        assert "page" in pagination
        assert "limit" in pagination
        assert "total" in pagination
        assert "total_pages" in pagination
