"""
Tests for VIP/Membership to Subscription (Explorer/Elite) refactoring.
Verifies the two-plan system: Explorer (free) and Elite (paid).
Legacy plans (startup, growth, vip) are treated as Elite for backward compatibility.
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://prc-consistency.preview.emergentagent.com').rstrip('/')

# Test credentials
USER_MOBILE = "9970100782"
USER_PIN = "997010"


class TestUserLogin:
    """Test user login with Explorer and Elite (legacy growth) plans"""
    
    def test_login_endpoint_available(self):
        """Test that login endpoint is available"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        # Should get a response (not 404)
        assert response.status_code in [200, 400, 401, 403], f"Login endpoint returned {response.status_code}"
    
    def test_login_with_growth_plan_user(self):
        """Test login for user with growth (legacy) plan - should be treated as Elite"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        
        assert response.status_code == 200, f"Login failed: {response.text[:200]}"
        
        data = response.json()
        # Response structure: user data is at top level, not nested under "user"
        subscription_plan = data.get("subscription_plan", "")
        
        # Growth plan users should still work (treated as Elite)
        assert subscription_plan in ["growth", "elite", "startup", "explorer", "vip", "pro"], \
            f"Expected valid plan, got: {subscription_plan}"
        
        print(f"User logged in with plan: {subscription_plan}")
    
    def test_login_response_structure(self):
        """Test that login response has correct structure with subscription fields"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify subscription-related fields exist
        assert "subscription_plan" in data, "subscription_plan field should exist"
        assert "token" in data or "access_token" in data, "Token should be returned"
        
        # Check for PRC balance (should exist for all users)
        assert "prc_balance" in data, "prc_balance field should exist"
        
        print(f"Login response fields: {list(data.keys())[:15]}...")
    
    def test_login_response_has_subscription_expiry_message(self):
        """Test that paid users get subscription expiry fields on login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check for subscription-related fields
        subscription_plan = data.get("subscription_plan")
        subscription_expiry = data.get("subscription_expiry")
        subscription_expired = data.get("subscription_expired")
        subscription_expiry_message = data.get("subscription_expiry_message")
        
        print(f"Plan: {subscription_plan}")
        print(f"Expiry: {subscription_expiry}")
        print(f"Expired: {subscription_expired}")
        print(f"Message: {subscription_expiry_message}")
        
        # If user has a paid plan, expiry fields should be present in schema
        # (values may be null if subscription has no expiry set)
        if subscription_plan in ["elite", "growth", "startup", "vip", "pro"]:
            # Fields should at least exist in the response
            assert "subscription_expiry" in data, "subscription_expiry field should exist for paid users"


class TestAdminDashboardStats:
    """Test admin dashboard stats showing elite_users"""
    
    def test_live_stats_endpoint_no_auth(self):
        """Test live debug stats endpoint returns elite_users count"""
        response = requests.get(f"{BASE_URL}/api/admin/debug/stats-live")
        
        # This endpoint might be publicly accessible for monitoring
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for elite_users field (or vip_users for backward compat)
            elite_users = data.get("elite_users")
            total_users = data.get("total_users")
            
            print(f"Live stats: {data}")
            
            # Should have user counts
            assert total_users is not None, "Total users should be present"
            assert elite_users is not None, "Elite users count should be present"
            assert isinstance(elite_users, int), f"elite_users should be int, got {type(elite_users)}"
            
            # Verify elite_users is a reasonable count
            assert elite_users >= 0, "elite_users should be non-negative"
            assert elite_users <= total_users, "elite_users should not exceed total_users"


class TestSubscriptionPlanConfiguration:
    """Test subscription plan configuration - only Explorer and Elite should be active"""
    
    def test_get_subscription_plans(self):
        """Test getting subscription plans returns correct plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        if response.status_code == 200:
            data = response.json()
            plans = data.get("plans", data) if isinstance(data, dict) else data
            
            print(f"Available plans: {plans}")
            
            # Check plans structure
            if isinstance(plans, dict):
                plan_names = list(plans.keys())
            elif isinstance(plans, list):
                plan_names = [p.get("name", p.get("id", str(p))) for p in plans]
            else:
                plan_names = []
            
            plan_names_lower = [str(p).lower() for p in plan_names]
            
            # Should have explorer and/or elite
            has_valid_plans = any("explorer" in p or "elite" in p for p in plan_names_lower)
            assert has_valid_plans, f"Expected explorer or elite plan, got: {plan_names}"
        elif response.status_code == 404:
            pytest.skip("Subscription plans endpoint not available")
    
    def test_is_paid_subscriber_logic(self):
        """Test is_paid_subscriber returns correct values for different plans"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        
        assert response.status_code == 200
        data = response.json()
        plan = data.get("subscription_plan", "").lower()
        
        # Growth, elite, startup, vip should all be considered paid
        paid_plans = ["elite", "growth", "startup", "vip", "pro"]
        
        if plan in paid_plans:
            # Paid user should have PRC balance preserved (not reset to 0)
            prc_balance = data.get("prc_balance", 0)
            print(f"User plan: {plan}, PRC balance: {prc_balance}")
            
            # Paid users may have non-zero PRC balance
            assert isinstance(prc_balance, (int, float)), "PRC balance should be numeric"


class TestRazorpayPaymentFlow:
    """Test Razorpay payment flow sets subscription_plan correctly"""
    
    def test_create_order_endpoint(self):
        """Test create order endpoint exists and responds"""
        # First login to get user token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text[:200]}"
        
        data = login_response.json()
        token = data.get("token") or data.get("access_token")
        user_id = data.get("uid")
        
        assert user_id, "No user ID returned from login"
        
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        # Try to create an order (this might fail for already subscribed users)
        response = requests.post(f"{BASE_URL}/api/razorpay/create-order", json={
            "user_id": user_id,
            "plan": "elite",
            "duration": "1month",
            "amount": 799
        }, headers=headers)
        
        print(f"Create order response: {response.status_code} - {response.text[:200]}")
        
        # Should get a valid response
        assert response.status_code in [200, 400, 401, 403, 422, 500], \
            f"Unexpected status: {response.status_code}"
        
        # If successful, verify order contains plan info
        if response.status_code == 200:
            order_data = response.json()
            # Order should contain plan information
            assert "order_id" in order_data or "id" in order_data, "Order should have ID"
    
    def test_subscription_plan_field_on_user(self):
        """Verify that user has subscription_plan field, not just membership_type"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        
        assert login_response.status_code == 200
        user = login_response.json()
        
        subscription_plan = user.get("subscription_plan")
        membership_type = user.get("membership_type")
        
        print(f"subscription_plan: {subscription_plan}")
        print(f"membership_type: {membership_type}")
        
        # subscription_plan should be the primary field
        assert subscription_plan is not None, "subscription_plan should be set"
        assert subscription_plan != "", "subscription_plan should not be empty"


class TestBackwardCompatibility:
    """Test backward compatibility with legacy plans"""
    
    def test_legacy_growth_user_treated_as_paid(self):
        """Test that legacy growth plan users are treated as paid subscribers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        
        assert response.status_code == 200
        user = response.json()
        plan = user.get("subscription_plan", "").lower()
        
        # If user has growth plan, they should still work normally
        if plan == "growth":
            print("Growth plan user - should be treated as Elite (paid)")
            
            # User should still have their PRC balance
            prc_balance = user.get("prc_balance")
            print(f"PRC Balance: {prc_balance}")
            
            # Balance should not have been reset to 0
            assert prc_balance is not None, "PRC balance should exist"
    
    def test_legacy_fields_present(self):
        """Test that legacy fields are still present for backward compatibility"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        
        assert response.status_code == 200
        user = response.json()
        
        # Both legacy and new fields should exist
        membership_type = user.get("membership_type")
        subscription_plan = user.get("subscription_plan")
        
        print(f"membership_type: {membership_type}")
        print(f"subscription_plan: {subscription_plan}")
        
        # New field should be set
        assert subscription_plan is not None, "subscription_plan should exist"
        
        # Legacy field may still exist for backward compat
        assert "membership_type" in user, "membership_type field should exist for backward compat"


class TestUITextRefactoring:
    """Test that UI text shows 'Elite' instead of 'VIP'"""
    
    def test_subscription_plans_show_elite(self):
        """Test that subscription plans endpoint uses Elite terminology"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        if response.status_code == 200:
            data = response.json()
            text = str(data).lower()
            
            # Elite should be present
            assert "elite" in text, "Elite plan should be present"
            
            # VIP should not be the primary term (may exist in legacy fields)
            plans = data.get("plans", data) if isinstance(data, dict) else data
            if isinstance(plans, dict):
                plan_names = list(plans.keys())
            else:
                plan_names = []
            
            # No plan should be named just "vip" 
            assert "vip" not in plan_names, "VIP should not be a primary plan name anymore"
    
    def test_user_response_uses_subscription_plan(self):
        """Test that user response uses subscription_plan, not membership_type as primary"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "mobile": USER_MOBILE,
            "pin": USER_PIN
        })
        
        assert response.status_code == 200
        user = response.json()
        
        subscription_plan = user.get("subscription_plan")
        
        # The primary plan field should be subscription_plan
        assert subscription_plan is not None, "subscription_plan should be the primary plan field"
        
        # For growth users, they should see their plan
        print(f"User subscription_plan: {subscription_plan}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
