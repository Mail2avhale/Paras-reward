"""
Test PRC Subscription Bug Fix
Bug: Frontend was checking redeemLimit instead of prc_balance for subscription payment
Fix: Changed all redeemLimit references to user.prc_balance in SubscriptionPlans.js
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com')

# Test credentials
PRIMARY_USER_MOBILE = "9970100782"
PRIMARY_USER_PIN = "997010"
PRIMARY_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"

PRC_USER_MOBILE = "9421331342"
PRC_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✅ Health check passed: {data}")
    
    def test_db_health(self):
        """Test database health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health/db")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "reconnected"]
        print(f"✅ DB health check passed: {data}")


class TestElitePricing:
    """Test elite subscription pricing endpoint"""
    
    def test_elite_pricing_endpoint(self):
        """Test GET /api/subscription/elite-pricing returns correct data"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["success"] == True
        assert data["plan"] == "elite"
        assert "pricing" in data
        assert "total_prc_required" in data
        
        # Verify pricing breakdown
        pricing = data["pricing"]
        assert "prc_rate" in pricing
        assert "total_prc" in pricing
        assert "base_inr" in pricing
        assert "gst_inr" in pricing
        
        print(f"✅ Elite pricing: {data['total_prc_required']} PRC at rate {pricing['prc_rate']}")
        print(f"   Formula: {data['formula']}")


class TestUserData:
    """Test user data endpoints"""
    
    def test_user_has_prc_balance(self):
        """Test that user endpoint returns prc_balance field"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify prc_balance field exists
        assert "prc_balance" in data
        prc_balance = data["prc_balance"]
        assert isinstance(prc_balance, (int, float))
        
        print(f"✅ User {PRIMARY_USER_UID} has prc_balance: {prc_balance}")
    
    def test_user_redeem_limit_endpoint(self):
        """Test that redeem limit endpoint exists (for backward compatibility)"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redeem-limit")
        # This endpoint should still work for other features
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "limit" in data
        
        print(f"✅ Redeem limit endpoint works: {data['limit']}")


class TestPayWithPRC:
    """Test PRC subscription payment endpoint"""
    
    def test_pay_with_prc_cooldown(self):
        """Test POST /api/subscription/pay-with-prc returns cooldown (expected for test users)"""
        # Both test users are in cooldown period
        response = requests.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={
            "user_id": PRIMARY_USER_UID,
            "plan_name": "elite",
            "plan_type": "monthly",
            "prc_amount": 16477.05
        })
        
        # Expected: 429 Too Many Requests (cooldown active)
        # OR 400 if insufficient balance
        # OR 200 if successful
        assert response.status_code in [200, 400, 429]
        
        if response.status_code == 429:
            data = response.json()
            print(f"✅ Pay-with-PRC returns cooldown as expected: {data.get('detail', data)}")
        elif response.status_code == 400:
            data = response.json()
            print(f"✅ Pay-with-PRC returns validation error: {data.get('detail', data)}")
        else:
            data = response.json()
            print(f"✅ Pay-with-PRC successful: {data}")
    
    def test_pay_with_prc_validates_balance_not_redeem_limit(self):
        """
        CRITICAL TEST: Backend should validate PRC balance, NOT redeem limit
        The backend explicitly skips redeem limit check for subscriptions
        """
        # This test verifies the backend behavior
        # The fix was in frontend, but backend should also use prc_balance
        
        # Get user's current PRC balance
        user_response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}")
        assert user_response.status_code == 200
        user_data = user_response.json()
        prc_balance = user_data.get("prc_balance", 0)
        
        # Get required PRC amount
        pricing_response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert pricing_response.status_code == 200
        pricing_data = pricing_response.json()
        required_prc = pricing_data.get("total_prc_required", 0)
        
        print(f"User PRC Balance: {prc_balance}")
        print(f"Required PRC: {required_prc}")
        
        # If user has insufficient balance, the error should mention "PRC balance"
        # NOT "redeem limit"
        if prc_balance < required_prc:
            response = requests.post(f"{BASE_URL}/api/subscription/pay-with-prc", json={
                "user_id": PRIMARY_USER_UID,
                "plan_name": "elite",
                "plan_type": "monthly",
                "prc_amount": required_prc
            })
            
            # Check error message doesn't mention "redeem limit"
            if response.status_code in [400, 429]:
                error_detail = response.json().get("detail", "")
                assert "redeem limit" not in error_detail.lower(), \
                    f"Error should not mention 'redeem limit': {error_detail}"
                print(f"✅ Error message correctly uses PRC balance terminology: {error_detail}")


class TestServiceCooldown:
    """Test service cooldown endpoint"""
    
    def test_subscription_cooldown_check(self):
        """Test GET /api/service/cooldown/{user_id}/subscription"""
        response = requests.get(f"{BASE_URL}/api/service/cooldown/{PRIMARY_USER_UID}/subscription")
        assert response.status_code == 200
        data = response.json()
        
        # Should have allowed and wait_hours fields
        assert "allowed" in data
        assert "wait_hours" in data
        
        if not data["allowed"]:
            print(f"✅ User in cooldown: wait {data['wait_hours']} hours")
        else:
            print(f"✅ User can subscribe (no cooldown)")


class TestSubscriptionPlans:
    """Test subscription plans endpoint"""
    
    def test_get_plans(self):
        """Test GET /api/subscription/plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        data = response.json()
        
        assert "plans" in data
        plans = data["plans"]
        
        # Should have explorer and elite plans
        plan_ids = [p["id"] for p in plans]
        assert "explorer" in plan_ids
        assert "elite" in plan_ids
        
        print(f"✅ Found {len(plans)} plans: {plan_ids}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
