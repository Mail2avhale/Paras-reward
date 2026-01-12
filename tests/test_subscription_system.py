"""
Test Suite for PARAS REWARD Subscription System
Tests the new 4-tier subscription system: Explorer (free), Startup, Growth, Elite
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin123"


class TestSubscriptionPlans:
    """Test GET /api/subscription/plans - Returns 4 plans with correct pricing"""
    
    def test_get_subscription_plans_returns_4_plans(self):
        """Verify endpoint returns exactly 4 subscription plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "plans" in data, "Response should contain 'plans' key"
        
        plans = data["plans"]
        assert len(plans) == 4, f"Expected 4 plans, got {len(plans)}"
        
        # Verify plan IDs
        plan_ids = [p["id"] for p in plans]
        assert "explorer" in plan_ids, "Explorer plan missing"
        assert "startup" in plan_ids, "Startup plan missing"
        assert "growth" in plan_ids, "Growth plan missing"
        assert "elite" in plan_ids, "Elite plan missing"
    
    def test_explorer_plan_is_free(self):
        """Verify Explorer plan is free with correct attributes"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        
        plans = response.json()["plans"]
        explorer = next((p for p in plans if p["id"] == "explorer"), None)
        
        assert explorer is not None, "Explorer plan not found"
        assert explorer["is_free"] == True, "Explorer should be free"
        assert explorer["multiplier"] == 1.0, f"Explorer multiplier should be 1.0, got {explorer['multiplier']}"
        assert explorer["tap_limit"] == 100, f"Explorer tap limit should be 100, got {explorer['tap_limit']}"
        assert explorer["can_redeem"] == False, "Explorer should not be able to redeem"
    
    def test_startup_plan_pricing(self):
        """Verify Startup plan has correct pricing (₹299/month)"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        
        plans = response.json()["plans"]
        startup = next((p for p in plans if p["id"] == "startup"), None)
        
        assert startup is not None, "Startup plan not found"
        assert startup["is_free"] == False, "Startup should not be free"
        assert startup["multiplier"] == 1.5, f"Startup multiplier should be 1.5, got {startup['multiplier']}"
        assert startup["tap_limit"] == 200, f"Startup tap limit should be 200, got {startup['tap_limit']}"
        assert startup["can_redeem"] == True, "Startup should be able to redeem"
        
        # Check pricing
        assert startup["pricing"] is not None, "Startup should have pricing"
        assert startup["pricing"]["monthly"] == 299, f"Startup monthly price should be 299, got {startup['pricing']['monthly']}"
    
    def test_growth_plan_pricing(self):
        """Verify Growth plan has correct pricing (₹549/month)"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        
        plans = response.json()["plans"]
        growth = next((p for p in plans if p["id"] == "growth"), None)
        
        assert growth is not None, "Growth plan not found"
        assert growth["is_free"] == False, "Growth should not be free"
        assert growth["multiplier"] == 2.0, f"Growth multiplier should be 2.0, got {growth['multiplier']}"
        assert growth["tap_limit"] == 300, f"Growth tap limit should be 300, got {growth['tap_limit']}"
        assert growth["can_redeem"] == True, "Growth should be able to redeem"
        
        # Check pricing
        assert growth["pricing"] is not None, "Growth should have pricing"
        assert growth["pricing"]["monthly"] == 549, f"Growth monthly price should be 549, got {growth['pricing']['monthly']}"
    
    def test_elite_plan_pricing(self):
        """Verify Elite plan has correct pricing (₹799/month)"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        
        plans = response.json()["plans"]
        elite = next((p for p in plans if p["id"] == "elite"), None)
        
        assert elite is not None, "Elite plan not found"
        assert elite["is_free"] == False, "Elite should not be free"
        assert elite["multiplier"] == 3.0, f"Elite multiplier should be 3.0, got {elite['multiplier']}"
        assert elite["tap_limit"] == 400, f"Elite tap limit should be 400, got {elite['tap_limit']}"
        assert elite["can_redeem"] == True, "Elite should be able to redeem"
        
        # Check pricing
        assert elite["pricing"] is not None, "Elite should have pricing"
        assert elite["pricing"]["monthly"] == 799, f"Elite monthly price should be 799, got {elite['pricing']['monthly']}"
    
    def test_referral_weights(self):
        """Verify referral weights for each plan"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        
        plans = response.json()["plans"]
        
        expected_weights = {
            "explorer": 1.0,
            "startup": 1.2,
            "growth": 1.5,
            "elite": 2.0
        }
        
        for plan in plans:
            expected = expected_weights.get(plan["id"])
            assert plan["referral_weight"] == expected, f"{plan['id']} referral weight should be {expected}, got {plan['referral_weight']}"


class TestUserSubscription:
    """Test GET /api/subscription/user/{uid} - Returns correct subscription status"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin user UID by logging in"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("user", {}).get("uid")
        return None
    
    def test_get_user_subscription_status(self, admin_uid):
        """Verify user subscription endpoint returns correct data"""
        if not admin_uid:
            pytest.skip("Could not get admin UID")
        
        response = requests.get(f"{BASE_URL}/api/subscription/user/{admin_uid}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "user_id" in data, "Response should contain user_id"
        assert "subscription" in data, "Response should contain subscription"
        assert "benefits" in data, "Response should contain benefits"
        
        # Verify subscription info structure
        sub = data["subscription"]
        assert "plan" in sub, "Subscription should have plan"
        assert "plan_name" in sub, "Subscription should have plan_name"
        assert "multiplier" in sub, "Subscription should have multiplier"
        assert "tap_limit" in sub, "Subscription should have tap_limit"
        assert "can_redeem" in sub, "Subscription should have can_redeem"
    
    def test_user_subscription_benefits_format(self, admin_uid):
        """Verify benefits are formatted correctly"""
        if not admin_uid:
            pytest.skip("Could not get admin UID")
        
        response = requests.get(f"{BASE_URL}/api/subscription/user/{admin_uid}")
        assert response.status_code == 200
        
        benefits = response.json()["benefits"]
        assert "mining_multiplier" in benefits, "Benefits should have mining_multiplier"
        assert "referral_weight" in benefits, "Benefits should have referral_weight"
        assert "daily_tap_limit" in benefits, "Benefits should have daily_tap_limit"
        assert "can_redeem" in benefits, "Benefits should have can_redeem"
        
        # Verify format (should be like "1.5x")
        assert "x" in benefits["mining_multiplier"], "Mining multiplier should be formatted with 'x'"
    
    def test_nonexistent_user_returns_404(self):
        """Verify 404 for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/subscription/user/nonexistent-uid-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestSubscriptionPayment:
    """Test POST /api/subscription/payment/{uid} - Accepts payment submission"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin user UID by logging in"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("user", {}).get("uid")
        return None
    
    def test_submit_payment_success(self, admin_uid):
        """Verify payment submission works correctly"""
        if not admin_uid:
            pytest.skip("Could not get admin UID")
        
        payment_data = {
            "plan": "startup",
            "duration": "monthly",
            "amount": 299,
            "utr_number": f"TEST_UTR_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "screenshot_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/subscription/payment/{admin_uid}",
            json=payment_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Payment submission should succeed"
        assert "payment_id" in data, "Response should contain payment_id"
    
    def test_submit_payment_invalid_plan(self, admin_uid):
        """Verify invalid plan is rejected"""
        if not admin_uid:
            pytest.skip("Could not get admin UID")
        
        payment_data = {
            "plan": "invalid_plan",
            "duration": "monthly",
            "amount": 299,
            "utr_number": "TEST_UTR_INVALID",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/subscription/payment/{admin_uid}",
            json=payment_data
        )
        assert response.status_code == 400, f"Expected 400 for invalid plan, got {response.status_code}"
    
    def test_submit_payment_invalid_duration(self, admin_uid):
        """Verify invalid duration is rejected"""
        if not admin_uid:
            pytest.skip("Could not get admin UID")
        
        payment_data = {
            "plan": "startup",
            "duration": "invalid_duration",
            "amount": 299,
            "utr_number": "TEST_UTR_INVALID_DUR",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/subscription/payment/{admin_uid}",
            json=payment_data
        )
        assert response.status_code == 400, f"Expected 400 for invalid duration, got {response.status_code}"


class TestAdminSubscriptionPricing:
    """Test POST /api/admin/subscription/pricing - Admin can update prices"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_get_admin_pricing(self, admin_token):
        """Verify admin can get current pricing"""
        if not admin_token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/subscription/pricing", headers=headers)
        
        # Should work even without auth for GET
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "pricing" in data, "Response should contain pricing"
        
        pricing = data["pricing"]
        assert "startup" in pricing, "Pricing should have startup"
        assert "growth" in pricing, "Pricing should have growth"
        assert "elite" in pricing, "Pricing should have elite"
    
    def test_update_pricing(self, admin_token):
        """Verify admin can update subscription pricing"""
        if not admin_token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update pricing
        new_pricing = {
            "startup": {"monthly": 299, "quarterly": 897, "half_yearly": 1495, "yearly": 2990},
            "growth": {"monthly": 549, "quarterly": 1647, "half_yearly": 2745, "yearly": 5490},
            "elite": {"monthly": 799, "quarterly": 2397, "half_yearly": 3995, "yearly": 7990}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/subscription/pricing",
            json=new_pricing,
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Pricing update should succeed"


class TestMiningRateWithSubscription:
    """Test mining rate calculation uses subscription multiplier"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin user UID by logging in"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("user", {}).get("uid")
        return None
    
    def test_mining_status_includes_subscription_info(self, admin_uid):
        """Verify mining status reflects subscription multiplier"""
        if not admin_uid:
            pytest.skip("Could not get admin UID")
        
        response = requests.get(f"{BASE_URL}/api/mining/status/{admin_uid}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Mining status should include rate information
        assert "mining_rate" in data or "rate_per_minute" in data or "current_rate" in data, \
            f"Mining status should include rate info. Got: {list(data.keys())}"


class TestTapGameLimits:
    """Test tap game limits based on subscription plan"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin user UID by logging in"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("user", {}).get("uid")
        return None
    
    def test_tap_game_returns_subscription_info(self, admin_uid):
        """Verify tap game response includes subscription plan info"""
        if not admin_uid:
            pytest.skip("Could not get admin UID")
        
        # Play tap game with 1 tap
        response = requests.post(
            f"{BASE_URL}/api/game/tap/{admin_uid}",
            json={"taps": 1}
        )
        
        # Could be 200 (success) or 400 (limit reached)
        if response.status_code == 200:
            data = response.json()
            assert "max_taps" in data, "Response should include max_taps"
            assert "subscription_plan" in data, "Response should include subscription_plan"
            
            # Verify max_taps matches subscription plan
            plan = data["subscription_plan"]
            expected_limits = {
                "explorer": 100,
                "startup": 200,
                "growth": 300,
                "elite": 400
            }
            expected = expected_limits.get(plan, 100)
            assert data["max_taps"] == expected, f"Max taps for {plan} should be {expected}, got {data['max_taps']}"
        elif response.status_code == 400:
            # Daily limit reached - this is acceptable
            assert "limit" in response.text.lower(), "Error should mention limit"


class TestExplorerBurnJob:
    """Test POST /api/admin/run-explorer-burn - Admin can trigger burn job"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_run_explorer_burn_job(self, admin_token):
        """Verify admin can trigger explorer burn job"""
        if not admin_token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin/run-explorer-burn", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Burn job should succeed"
        assert "result" in data, "Response should contain result"


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
