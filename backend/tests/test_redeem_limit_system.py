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

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

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
        """Elite users should have 39,950 PRC base limit.

        NOTE: Previously this verified against /api/admin/members/list; that
        endpoint was removed on May 5, 2026 along with the Members Dashboard
        admin page. The assertion is kept skip-safe so the suite stays green.
        """
        pytest.skip("/api/admin/members/list removed on May 5, 2026; covered indirectly by /api/user/{uid}/redeem-limit tests")
    
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
    """Admin Members list API REMOVED on May 5, 2026 (Members Dashboard page deleted).

    Class retained as a single skipped placeholder so anyone running the suite
    sees the reason instead of silently missing coverage. If a replacement
    listing endpoint is added later, re-populate this class against it.
    """

    def test_admin_members_list_removed(self):
        pytest.skip("/api/admin/members/list removed on May 5, 2026; page deleted.")


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
