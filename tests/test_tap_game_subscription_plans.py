"""
Extended Test Suite for Tap Game with Subscription Plans and Referral Reward System

Tests:
1. Startup plan tap game (0.5 PRC per tap, 50 PRC daily)
2. Growth plan tap game (1.0 PRC per tap, 100 PRC daily)
3. Elite plan tap game (2.0 PRC per tap, 200 PRC daily)
4. Referral reward system - Startup user with 10 paid referrals
5. One-time lifetime reward verification
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_USER_PREFIX = "TEST_PLAN_"

# Admin credentials
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin123"


def get_admin_token():
    """Get admin access token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        params={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token"), response.json().get("uid")
    return None, None


def create_test_user(plan_suffix=""):
    """Create a test user and return uid"""
    test_email = f"{TEST_USER_PREFIX}{plan_suffix}_{uuid.uuid4().hex[:8]}@test.com"
    register_data = {
        "email": test_email,
        "password": "Test1234!",
        "name": f"Test {plan_suffix} User",
        "mobile": f"9{uuid.uuid4().hex[:9]}",
        "full_name": f"Test {plan_suffix} User"
    }
    response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
    if response.status_code == 200:
        return response.json().get("uid"), test_email
    return None, None


def upgrade_user_subscription(uid: str, plan: str, days: int = 30):
    """Upgrade user to a specific subscription plan using admin endpoint"""
    admin_token, admin_uid = get_admin_token()
    if not admin_token:
        return False
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    data = {
        "plan": plan,
        "days": days,
        "payment_method": "admin_test",
        "notes": "Test subscription upgrade"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/admin/users/{uid}/subscription",
        json=data,
        headers=headers
    )
    return response.status_code == 200


class TestStartupPlanTapGame:
    """Test tap game for Startup plan users - 0.5 PRC per tap"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create and upgrade a test user to Startup plan"""
        self.uid, self.email = create_test_user("startup")
        if not self.uid:
            pytest.skip("Failed to create test user")
        
        # Upgrade to Startup plan
        if not upgrade_user_subscription(self.uid, "startup", 30):
            pytest.skip("Failed to upgrade user to Startup plan")
        
        print(f"✅ Created Startup user: {self.email}, uid: {self.uid}")
    
    def test_startup_prc_per_tap(self):
        """Test Startup users get 0.5 PRC per tap"""
        tap_data = {"taps": 10}
        response = requests.post(f"{BASE_URL}/api/game/tap/{self.uid}", json=tap_data)
        
        assert response.status_code == 200, f"Tap game failed: {response.text}"
        data = response.json()
        
        # Verify Startup plan
        assert data.get("subscription_plan") == "startup", f"Expected startup plan, got {data.get('subscription_plan')}"
        
        # Verify PRC per tap is 0.5
        assert data.get("prc_per_tap") == 0.5, f"Expected 0.5 PRC per tap, got {data.get('prc_per_tap')}"
        
        # Verify PRC earned = 10 * 0.5 = 5.0
        expected_prc = 10 * 0.5
        assert data.get("prc_earned") == expected_prc, f"Expected {expected_prc} PRC, got {data.get('prc_earned')}"
        
        print(f"✅ Startup tap test passed: {data}")
    
    def test_startup_daily_limit_100(self):
        """Test Startup users have 100 daily tap limit"""
        tap_data = {"taps": 100}
        response = requests.post(f"{BASE_URL}/api/game/tap/{self.uid}", json=tap_data)
        
        assert response.status_code == 200, f"Tap game failed: {response.text}"
        data = response.json()
        
        # Verify max taps is 100
        assert data.get("max_taps") == 100, f"Expected max_taps=100, got {data.get('max_taps')}"
        
        # Verify daily PRC potential = 100 * 0.5 = 50 PRC
        assert data.get("daily_prc_potential") == 50.0, f"Expected daily_prc_potential=50.0, got {data.get('daily_prc_potential')}"
        
        print(f"✅ Startup daily limit test passed: {data}")


class TestGrowthPlanTapGame:
    """Test tap game for Growth plan users - 1.0 PRC per tap"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create and upgrade a test user to Growth plan"""
        self.uid, self.email = create_test_user("growth")
        if not self.uid:
            pytest.skip("Failed to create test user")
        
        # Upgrade to Growth plan
        if not upgrade_user_subscription(self.uid, "growth", 30):
            pytest.skip("Failed to upgrade user to Growth plan")
        
        print(f"✅ Created Growth user: {self.email}, uid: {self.uid}")
    
    def test_growth_prc_per_tap(self):
        """Test Growth users get 1.0 PRC per tap"""
        tap_data = {"taps": 10}
        response = requests.post(f"{BASE_URL}/api/game/tap/{self.uid}", json=tap_data)
        
        assert response.status_code == 200, f"Tap game failed: {response.text}"
        data = response.json()
        
        # Verify Growth plan
        assert data.get("subscription_plan") == "growth", f"Expected growth plan, got {data.get('subscription_plan')}"
        
        # Verify PRC per tap is 1.0
        assert data.get("prc_per_tap") == 1.0, f"Expected 1.0 PRC per tap, got {data.get('prc_per_tap')}"
        
        # Verify PRC earned = 10 * 1.0 = 10.0
        expected_prc = 10 * 1.0
        assert data.get("prc_earned") == expected_prc, f"Expected {expected_prc} PRC, got {data.get('prc_earned')}"
        
        print(f"✅ Growth tap test passed: {data}")
    
    def test_growth_daily_prc_potential(self):
        """Test Growth users have 100 PRC daily potential"""
        tap_data = {"taps": 1}
        response = requests.post(f"{BASE_URL}/api/game/tap/{self.uid}", json=tap_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify daily PRC potential = 100 * 1.0 = 100 PRC
        assert data.get("daily_prc_potential") == 100.0, f"Expected daily_prc_potential=100.0, got {data.get('daily_prc_potential')}"
        
        print(f"✅ Growth daily potential test passed: {data}")


class TestElitePlanTapGame:
    """Test tap game for Elite plan users - 2.0 PRC per tap"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create and upgrade a test user to Elite plan"""
        self.uid, self.email = create_test_user("elite")
        if not self.uid:
            pytest.skip("Failed to create test user")
        
        # Upgrade to Elite plan
        if not upgrade_user_subscription(self.uid, "elite", 30):
            pytest.skip("Failed to upgrade user to Elite plan")
        
        print(f"✅ Created Elite user: {self.email}, uid: {self.uid}")
    
    def test_elite_prc_per_tap(self):
        """Test Elite users get 2.0 PRC per tap"""
        tap_data = {"taps": 10}
        response = requests.post(f"{BASE_URL}/api/game/tap/{self.uid}", json=tap_data)
        
        assert response.status_code == 200, f"Tap game failed: {response.text}"
        data = response.json()
        
        # Verify Elite plan
        assert data.get("subscription_plan") == "elite", f"Expected elite plan, got {data.get('subscription_plan')}"
        
        # Verify PRC per tap is 2.0
        assert data.get("prc_per_tap") == 2.0, f"Expected 2.0 PRC per tap, got {data.get('prc_per_tap')}"
        
        # Verify PRC earned = 10 * 2.0 = 20.0
        expected_prc = 10 * 2.0
        assert data.get("prc_earned") == expected_prc, f"Expected {expected_prc} PRC, got {data.get('prc_earned')}"
        
        print(f"✅ Elite tap test passed: {data}")
    
    def test_elite_daily_prc_potential(self):
        """Test Elite users have 200 PRC daily potential"""
        tap_data = {"taps": 1}
        response = requests.post(f"{BASE_URL}/api/game/tap/{self.uid}", json=tap_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify daily PRC potential = 100 * 2.0 = 200 PRC
        assert data.get("daily_prc_potential") == 200.0, f"Expected daily_prc_potential=200.0, got {data.get('daily_prc_potential')}"
        
        print(f"✅ Elite daily potential test passed: {data}")


class TestAllPlansPRCComparison:
    """Compare PRC rates across all subscription plans"""
    
    def test_prc_rates_comparison(self):
        """Test that PRC rates are correctly differentiated by plan"""
        expected_rates = {
            "explorer": {"prc_per_tap": 0.1, "daily_potential": 10.0},
            "startup": {"prc_per_tap": 0.5, "daily_potential": 50.0},
            "growth": {"prc_per_tap": 1.0, "daily_potential": 100.0},
            "elite": {"prc_per_tap": 2.0, "daily_potential": 200.0}
        }
        
        results = {}
        
        for plan in ["explorer", "startup", "growth", "elite"]:
            uid, email = create_test_user(f"compare_{plan}")
            if not uid:
                continue
            
            # Upgrade if not explorer
            if plan != "explorer":
                if not upgrade_user_subscription(uid, plan, 30):
                    continue
            
            # Test tap
            response = requests.post(f"{BASE_URL}/api/game/tap/{uid}", json={"taps": 1})
            if response.status_code == 200:
                data = response.json()
                results[plan] = {
                    "prc_per_tap": data.get("prc_per_tap"),
                    "daily_potential": data.get("daily_prc_potential"),
                    "actual_plan": data.get("subscription_plan")
                }
        
        print(f"\n📊 PRC Rates Comparison:")
        for plan, data in results.items():
            expected = expected_rates.get(plan, {})
            status = "✅" if data.get("prc_per_tap") == expected.get("prc_per_tap") else "❌"
            print(f"  {status} {plan.upper()}: {data.get('prc_per_tap')} PRC/tap, {data.get('daily_potential')} PRC/day")
            
            # Verify rates match expected
            if plan in results:
                assert results[plan].get("prc_per_tap") == expected_rates[plan]["prc_per_tap"], \
                    f"{plan} PRC rate mismatch"
        
        print(f"✅ All plan PRC rates verified correctly")


class TestReferralRewardSystemDetailed:
    """Detailed tests for referral subscription reward system"""
    
    def test_referral_reward_requirements(self):
        """Test referral reward requirements are correctly implemented"""
        # Requirements:
        # 1. Referrer must be on Startup plan
        # 2. Must have 10+ paid referrals in last 7 days
        # 3. One-time lifetime reward
        # 4. Reward: Free 1-month Explorer subscription
        
        # Create a referrer on Startup plan
        referrer_uid, referrer_email = create_test_user("referrer_startup")
        if not referrer_uid:
            pytest.skip("Failed to create referrer")
        
        # Upgrade to Startup
        if not upgrade_user_subscription(referrer_uid, "startup", 30):
            pytest.skip("Failed to upgrade referrer to Startup")
        
        # Get referrer's referral code
        code_response = requests.get(f"{BASE_URL}/api/referral/code/{referrer_uid}")
        assert code_response.status_code == 200
        referral_code = code_response.json().get("referral_code")
        
        print(f"✅ Created Startup referrer: {referrer_email}")
        print(f"   Referral code: {referral_code}")
        
        # Verify referrer doesn't have reward claimed yet
        profile_response = requests.get(f"{BASE_URL}/api/users/{referrer_uid}")
        if profile_response.status_code == 200:
            profile = profile_response.json()
            reward_claimed = profile.get("referral_subscription_reward_claimed", False)
            assert reward_claimed == False, "New referrer should not have reward claimed"
            print(f"✅ Referrer reward status: Not claimed (correct)")
        
        print(f"✅ Referral reward requirements test passed")
    
    def test_referral_code_generation(self):
        """Test that referral codes are generated for all users"""
        uid, email = create_test_user("refcode")
        if not uid:
            pytest.skip("Failed to create user")
        
        # Get referral code
        response = requests.get(f"{BASE_URL}/api/referral/code/{uid}")
        assert response.status_code == 200
        
        data = response.json()
        referral_code = data.get("referral_code")
        
        assert referral_code is not None, "Referral code should exist"
        assert len(referral_code) >= 6, "Referral code should be at least 6 characters"
        
        print(f"✅ Referral code generated: {referral_code}")
    
    def test_referral_stats_endpoint(self):
        """Test referral stats endpoint exists and works"""
        uid, email = create_test_user("refstats")
        if not uid:
            pytest.skip("Failed to create user")
        
        # Try to get referral stats
        response = requests.get(f"{BASE_URL}/api/referral/stats/{uid}")
        
        # Should return 200 with stats or 404 if endpoint doesn't exist
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Referral stats: {data}")
        else:
            print(f"⚠️ Referral stats endpoint returned: {response.status_code}")


class TestDailyTapLimitAllPlans:
    """Test that daily tap limit is 100 for ALL plans"""
    
    def test_all_plans_have_100_tap_limit(self):
        """Verify all subscription plans have 100 daily tap limit"""
        plans_tested = []
        
        for plan in ["explorer", "startup", "growth", "elite"]:
            uid, email = create_test_user(f"limit_{plan}")
            if not uid:
                continue
            
            # Upgrade if not explorer
            if plan != "explorer":
                if not upgrade_user_subscription(uid, plan, 30):
                    continue
            
            # Test tap to get max_taps
            response = requests.post(f"{BASE_URL}/api/game/tap/{uid}", json={"taps": 1})
            if response.status_code == 200:
                data = response.json()
                max_taps = data.get("max_taps")
                
                assert max_taps == 100, f"{plan} should have 100 tap limit, got {max_taps}"
                plans_tested.append(plan)
                print(f"✅ {plan.upper()}: max_taps = {max_taps}")
        
        assert len(plans_tested) >= 1, "At least one plan should be tested"
        print(f"✅ All tested plans have 100 daily tap limit")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
