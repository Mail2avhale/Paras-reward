"""
Razorpay Payment Gateway Integration Tests
Tests for: Config, Order Creation, and Payment Flow
"""
import pytest
import requests
import os
import json
from datetime import datetime

# Get the API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = 'https://bbps-services-ui.preview.emergentagent.com'


class TestRazorpayConfig:
    """Test Razorpay Configuration API"""
    
    def test_razorpay_config_returns_live_key(self):
        """Test that /api/razorpay/config returns a live Razorpay key"""
        response = requests.get(f"{BASE_URL}/api/razorpay/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify key_id exists and is a live key (starts with rzp_live_)
        assert 'key_id' in data, "Missing key_id in response"
        assert data['key_id'].startswith('rzp_live_'), f"Expected live key (rzp_live_*), got: {data['key_id']}"
        
        # Verify other required fields
        assert data.get('currency') == 'INR', f"Expected currency INR, got: {data.get('currency')}"
        assert 'company_name' in data, "Missing company_name in response"
    
    def test_razorpay_config_contains_required_fields(self):
        """Test that config has all required fields"""
        response = requests.get(f"{BASE_URL}/api/razorpay/config")
        
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ['key_id', 'currency', 'company_name']
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


class TestRazorpayOrderCreation:
    """Test Razorpay Order Creation API"""
    
    @pytest.fixture
    def order_data(self):
        """Test order data"""
        return {
            "user_id": f"test-user-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "plan_type": "monthly",
            "plan_name": "startup",
            "amount": 299
        }
    
    def test_create_order_success(self, order_data):
        """Test successful order creation"""
        response = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json=order_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify order creation response
        assert 'order_id' in data, "Missing order_id in response"
        assert data['order_id'].startswith('order_'), f"Invalid order_id format: {data['order_id']}"
        
        # Verify amount (should be in paise)
        expected_amount = order_data['amount'] * 100  # Convert to paise
        assert data.get('amount') == expected_amount, f"Expected amount {expected_amount}, got {data.get('amount')}"
        
        # Verify currency and key_id
        assert data.get('currency') == 'INR', f"Expected currency INR, got {data.get('currency')}"
        assert 'key_id' in data, "Missing key_id in response"
        assert data['key_id'].startswith('rzp_live_'), f"Expected live key, got: {data['key_id']}"
    
    def test_create_order_elite_plan(self):
        """Test order creation for Elite plan"""
        order_data = {
            "user_id": f"test-elite-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "plan_type": "monthly",
            "plan_name": "elite",
            "amount": 799
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'order_id' in data
        assert data.get('amount') == 79900  # 799 * 100 paise
    
    def test_create_order_quarterly_duration(self):
        """Test order creation for quarterly plan"""
        order_data = {
            "user_id": f"test-quarterly-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "plan_type": "quarterly",
            "plan_name": "startup",
            "amount": 807
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'order_id' in data
        assert data.get('amount') == 80700  # 807 * 100 paise
    
    def test_create_order_missing_fields(self):
        """Test order creation with missing required fields"""
        incomplete_data = {
            "user_id": "test-incomplete"
            # Missing plan_type, plan_name, amount
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json=incomplete_data
        )
        
        # Should fail with validation error
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"


class TestSubscriptionPlans:
    """Test Subscription Plans API"""
    
    def test_get_subscription_plans(self):
        """Test that subscription plans API returns valid plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify plans exist
        assert 'plans' in data, "Missing 'plans' in response"
        plans = data['plans']
        assert len(plans) >= 2, f"Expected at least 2 plans, got {len(plans)}"
        
        # Verify plan structure
        plan_ids = [p['id'] for p in plans]
        assert 'explorer' in plan_ids, "Missing Explorer plan"
        assert 'startup' in plan_ids or 'elite' in plan_ids, "Missing paid plans"
    
    def test_subscription_plans_have_pricing(self):
        """Test that paid plans have pricing information"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        assert response.status_code == 200
        plans = response.json().get('plans', [])
        
        # Find paid plans (non-free)
        paid_plans = [p for p in plans if not p.get('is_free')]
        assert len(paid_plans) >= 1, "No paid plans found"
        
        for plan in paid_plans:
            assert plan.get('pricing') is not None, f"Plan {plan['id']} missing pricing"
            assert plan['pricing'].get('monthly') is not None, f"Plan {plan['id']} missing monthly pricing"
    
    def test_subscription_plans_explorer_is_free(self):
        """Test that Explorer plan is free"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        assert response.status_code == 200
        plans = response.json().get('plans', [])
        
        explorer = next((p for p in plans if p['id'] == 'explorer'), None)
        assert explorer is not None, "Explorer plan not found"
        assert explorer.get('is_free') == True, "Explorer should be a free plan"


class TestRazorpayPaymentVerification:
    """Test payment verification endpoint (without actual payment)"""
    
    def test_verify_payment_invalid_signature(self):
        """Test that invalid signature is rejected"""
        invalid_data = {
            "razorpay_order_id": "order_invalid123",
            "razorpay_payment_id": "pay_invalid123",
            "razorpay_signature": "invalid_signature_12345",
            "user_id": "test-user-123"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/verify-payment",
            json=invalid_data
        )
        
        # Should fail with 400 (invalid signature) or 404 (order not found)
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"


class TestPaymentHistory:
    """Test payment history endpoint"""
    
    def test_get_payment_history_for_user(self):
        """Test getting payment history for a user"""
        test_user_id = "test-user-history-check"
        response = requests.get(f"{BASE_URL}/api/razorpay/payment-history/{test_user_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return payments array (may be empty for test user)
        assert 'payments' in data, "Missing 'payments' in response"
        assert isinstance(data['payments'], list), "payments should be a list"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
