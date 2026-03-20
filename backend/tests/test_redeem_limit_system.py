"""
Test Suite for Redeem Limit System and Subscription from PRC

Test Coverage:
1. Redeem Limit Formula: Plan × 5 × 10 + 20% per active referral
   - Elite (799): 39,950 PRC base
   - Growth (499): 24,950 PRC base (legacy)
   - Startup (299): 14,950 PRC base (legacy)
   - Explorer (0): 0 PRC (no redeem)
2. Admin Members List API with sorting
3. PRC Subscription payment requiring redeem limit
4. 28-day Elite plan via PRC subscription
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://elite-explorer-app.preview.emergentagent.com').rstrip('/')

# Test credentials
USER_MOBILE = "9421331342"
USER_PIN = "942133"
ADMIN_EMAIL = "Admin@paras.com"
ADMIN_PIN = "153759"


@pytest.fixture(scope="module")
def api_session():
    """Create requests session for API calls"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def test_user_uid(api_session):
    """Login as test user and get UID"""
    response = api_session.post(f"{BASE_URL}/api/auth/login", json={
        "mobile": USER_MOBILE,
        "pin": USER_PIN
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("uid")
    pytest.skip("Could not login as test user")


class TestGlobalRedeemSettings:
    """Test global redeem limit settings API"""
    
    def test_get_global_redeem_settings(self, api_session):
        """Verify global settings return correct base limit formula"""
        response = api_session.get(f"{BASE_URL}/api/admin/global-redeem-settings")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        settings = data["settings"]
        
        # Verify base limit formula: 799 × 5 × 10 = 39,950
        assert settings["base_limit"] == 39950, f"Expected 39950, got {settings['base_limit']}"
        assert settings["referral_increase_percent"] == 20, "Each referral should add 20%"
        assert "carry_forward_enabled" in settings
    
    def test_explanation_fields_present(self, api_session):
        """Verify explanation fields are present"""
        response = api_session.get(f"{BASE_URL}/api/admin/global-redeem-settings")
        data = response.json()
        
        assert "explanation" in data
        explanation = data["explanation"]
        assert "base_limit" in explanation
        assert "referral_increase_percent" in explanation
        assert "carry_forward_enabled" in explanation


class TestUserRedeemLimit:
    """Test user-specific redeem limit calculation"""
    
    def test_user_redeem_limit_api_exists(self, api_session, test_user_uid):
        """Verify user redeem limit API endpoint exists and returns data"""
        response = api_session.get(f"{BASE_URL}/api/user/{test_user_uid}/redeem-limit")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "limit" in data
        limit = data["limit"]
        
        # Required fields
        required_fields = [
            "total_limit", "total_redeemed", "remaining_limit",
            "months_active", "active_referrals"
        ]
        for field in required_fields:
            assert field in limit, f"Missing field: {field}"
    
    def test_elite_user_has_correct_limit(self, api_session):
        """Elite users should have 39,950 PRC base limit"""
        # Get an elite user from admin members list
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?subscription=elite&limit=1")
        if response.status_code != 200 or not response.json().get("members"):
            pytest.skip("No Elite users found in system")
        
        elite_user = response.json()["members"][0]
        redeem_limit = elite_user.get("redeem_limit", {})
        
        # Elite: 799 × 5 × 10 = 39,950 for first month
        # With no referrals, base should be 39,950
        total_limit = redeem_limit.get("total_limit", 0)
        months_active = redeem_limit.get("months_active", 1)
        
        # Base limit per month for Elite = 39,950
        expected_base = 39950.0 * months_active
        assert total_limit == expected_base, f"Expected {expected_base}, got {total_limit}"
    
    def test_explorer_user_has_zero_limit(self, api_session):
        """Explorer (free) users should have 0 PRC redeem limit"""
        # Create a fake explorer user ID to test limit calculation
        response = api_session.get(f"{BASE_URL}/api/user/nonexistent_explorer_test/redeem-limit")
        
        # API should return 0 limit for unknown users (treated as explorer)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                limit = data["limit"]
                assert limit.get("total_limit", 0) == 0, "Explorer should have 0 limit"


class TestAdminMembersSorting:
    """Test Admin Members list API with sorting"""
    
    def test_members_list_returns_redeem_limit_data(self, api_session):
        """Verify members list includes redeem_limit object"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?limit=5")
        assert response.status_code == 200
        data = response.json()
        
        assert "members" in data
        if data["members"]:
            member = data["members"][0]
            assert "redeem_limit" in member, "Each member should have redeem_limit data"
            
            redeem_limit = member["redeem_limit"]
            assert "total_limit" in redeem_limit
            assert "total_redeemed" in redeem_limit
            assert "remaining_limit" in redeem_limit
    
    def test_sort_by_prc_balance(self, api_session):
        """Test sorting by PRC balance works"""
        # Descending order - using correct param names: sort_by and sort_order
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?sort_by=prc_balance&sort_order=desc&limit=10")
        assert response.status_code == 200
        members = response.json().get("members", [])
        
        if len(members) > 1:
            balances = [m.get("prc_balance", 0) for m in members]
            # Filter out None values
            balances = [b if b is not None else 0 for b in balances]
            assert balances == sorted(balances, reverse=True), "Members should be sorted by PRC balance descending"
    
    def test_sort_by_redeem_limit(self, api_session):
        """Test sorting by redeem_limit (total_limit) works"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?sort_by=redeem_limit&sort_order=desc&limit=10")
        assert response.status_code == 200
        members = response.json().get("members", [])
        
        if len(members) > 1:
            limits = [m.get("redeem_limit", {}).get("total_limit", 0) for m in members]
            assert limits == sorted(limits, reverse=True), "Members should be sorted by redeem limit descending"
    
    def test_sort_by_used_limit(self, api_session):
        """Test sorting by used_limit (total_redeemed) works"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?sort_by=used_limit&sort_order=desc&limit=10")
        assert response.status_code == 200
        members = response.json().get("members", [])
        
        if len(members) > 1:
            used = [m.get("redeem_limit", {}).get("total_redeemed", 0) for m in members]
            assert used == sorted(used, reverse=True), "Members should be sorted by used limit descending"
    
    def test_sort_by_available_limit(self, api_session):
        """Test sorting by available_limit (remaining_limit) works"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?sort_by=available_limit&sort_order=desc&limit=10")
        assert response.status_code == 200
        members = response.json().get("members", [])
        
        if len(members) > 1:
            available = [m.get("redeem_limit", {}).get("remaining_limit", 0) for m in members]
            assert available == sorted(available, reverse=True), f"Members should be sorted by available limit descending. Got: {available}"
    
    def test_sort_by_joined_date(self, api_session):
        """Test sorting by created_at (joined) works"""
        response = api_session.get(f"{BASE_URL}/api/admin/members/list?sort_by=created_at&sort_order=desc&limit=10")
        assert response.status_code == 200
        members = response.json().get("members", [])
        
        if len(members) > 1:
            dates = [m.get("created_at") for m in members if m.get("created_at")]
            # Dates should be in descending order (most recent first)
            assert dates == sorted(dates, reverse=True), "Members should be sorted by join date descending"


class TestSubscriptionPlans:
    """Test subscription plans API"""
    
    def test_plans_api_returns_elite_and_explorer(self, api_session):
        """Verify only Elite and Explorer plans are available"""
        response = api_session.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        data = response.json()
        
        assert "plans" in data
        plan_ids = [p["id"] for p in data["plans"]]
        
        assert "explorer" in plan_ids, "Explorer plan should exist"
        assert "elite" in plan_ids, "Elite plan should exist"
    
    def test_elite_plan_pricing(self, api_session):
        """Verify Elite plan pricing is ₹799/month"""
        response = api_session.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        elite_plan = next((p for p in data["plans"] if p["id"] == "elite"), None)
        assert elite_plan is not None, "Elite plan not found"
        assert elite_plan["pricing"]["monthly"] == 799, "Elite monthly should be ₹799"
    
    def test_elite_duration_28_days(self, api_session):
        """Verify Elite plan duration is 28 days"""
        response = api_session.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        durations = data.get("durations", {})
        assert durations.get("monthly") == 28, "Monthly plan should be 28 days"
    
    def test_explorer_is_free(self, api_session):
        """Verify Explorer plan is free and cannot redeem"""
        response = api_session.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        explorer_plan = next((p for p in data["plans"] if p["id"] == "explorer"), None)
        assert explorer_plan is not None, "Explorer plan not found"
        assert explorer_plan["is_free"] is True, "Explorer should be free"
        assert explorer_plan["can_redeem"] is False, "Explorer cannot redeem"


class TestPRCSubscriptionPayment:
    """Test PRC subscription payment endpoint"""
    
    def test_pay_with_prc_endpoint_exists(self, api_session):
        """Verify pay-with-prc endpoint exists"""
        # Test with invalid params - should get 400, not 404
        response = api_session.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={})
        assert response.status_code in [400, 422], "Endpoint should exist and return validation error"
    
    def test_pay_with_prc_requires_user_id(self, api_session):
        """Verify user_id is required"""
        response = api_session.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={
            "plan_name": "elite",
            "prc_amount": 15980
        })
        assert response.status_code == 400
        assert "user_id" in response.text.lower() or "missing" in response.text.lower()
    
    def test_pay_with_prc_requires_plan_name(self, api_session):
        """Verify plan_name is required"""
        response = api_session.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={
            "user_id": "test_user",
            "prc_amount": 15980
        })
        assert response.status_code == 400
    
    def test_pay_with_prc_validates_prc_amount(self, api_session, test_user_uid):
        """Verify PRC amount is validated against formula (Price × 2 × Rate)"""
        # Elite price = 799, PRC rate = 10, multiplier = 2
        # Expected PRC = 799 × 2 × 10 = 15,980
        
        # Test with wrong amount
        response = api_session.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={
            "user_id": test_user_uid,
            "plan_name": "elite",
            "prc_amount": 5000  # Wrong amount
        })
        
        # Should fail with invalid amount error
        assert response.status_code == 400
        assert "invalid" in response.text.lower() or "expected" in response.text.lower()
    
    def test_pay_with_prc_checks_redeem_limit(self, api_session):
        """Verify API checks available redeem limit"""
        # Use a user with insufficient limit
        response = api_session.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={
            "user_id": "nonexistent_user_no_limit",
            "plan_name": "elite",
            "prc_amount": 15980
        })
        
        # Should fail - either user not found or insufficient limit
        assert response.status_code in [400, 404]


class TestBankRedeemLimitCheck:
    """Test bank redeem page checks redeem limit"""
    
    def test_bank_transfer_config_exists(self, api_session):
        """Verify bank transfer config endpoint returns data"""
        response = api_session.get(f"{BASE_URL}/api/bank-transfer/config")
        assert response.status_code == 200
        data = response.json()
        
        assert "prc_rate" in data
        assert "min_withdrawal" in data
        assert "max_withdrawal" in data


class TestHealthAndAPIs:
    """Basic health and API checks"""
    
    def test_api_health(self, api_session):
        """API health check"""
        response = api_session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_subscription_plans_no_comparison_section(self, api_session):
        """Verify no plan comparison data in API (removed from UI)"""
        response = api_session.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        # Should not have comparison or features section
        assert "comparison" not in data, "Plan comparison should be removed"
        assert "features_comparison" not in data, "Features comparison should be removed"
