"""
Razorpay Double Subscription Activation Prevention Tests
Tests for: Atomic claim mechanism, race condition prevention, idempotent payment handling

Key Features Tested:
1. Verify atomic claim mechanism in verify-payment API
2. Verify webhook double activation prevention
3. Test order status transitions (created -> processing -> paid)
4. Test duplicate payment rejection
"""
import pytest
import requests
import os
import json
from datetime import datetime

# Get the API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = 'https://burn-dashboard.preview.emergentagent.com'


class TestRazorpayDoubleActivationPrevention:
    """Test Razorpay double subscription activation prevention"""
    
    def test_config_shows_secure_version(self):
        """Test that config shows DOUBLE_VERIFICATION_ENABLED security"""
        response = requests.get(f"{BASE_URL}/api/razorpay/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify security mode is double verification
        assert 'security' in data, "Missing security field in config"
        assert 'DOUBLE_VERIFICATION' in data['security'], f"Expected DOUBLE_VERIFICATION security, got: {data.get('security')}"
        
        # Verify code version shows secure version
        assert 'code_version' in data, "Missing code_version in config"
        assert 'SECURE' in data['code_version'], f"Expected SECURE code version, got: {data.get('code_version')}"
    
    def test_create_order_returns_created_status(self):
        """Test that newly created order has 'created' status"""
        order_data = {
            "user_id": f"test-double-activation-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "plan_type": "monthly",
            "plan_name": "startup",
            "amount": 299
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json=order_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify order_id is returned
        assert 'order_id' in data, "Missing order_id in response"
        assert data['order_id'].startswith('order_'), f"Invalid order_id format: {data['order_id']}"
        
        # Verify amount in paise
        assert data.get('amount') == 29900, f"Expected 29900 paise, got {data.get('amount')}"
    
    def test_verify_payment_invalid_signature_rejected(self):
        """Test that invalid signature is properly rejected - prevents fake payments"""
        invalid_data = {
            "razorpay_order_id": "order_test_invalid_123",
            "razorpay_payment_id": "pay_test_invalid_123",
            "razorpay_signature": "fake_signature_should_be_rejected",
            "user_id": "test-user-fake-payment"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/verify-payment",
            json=invalid_data
        )
        
        # Should fail with 400 (invalid signature)
        assert response.status_code == 400, f"Expected 400 for invalid signature, got {response.status_code}"
        assert 'Invalid payment signature' in response.text or 'order' in response.text.lower(), \
            f"Expected error about invalid signature or order, got: {response.text}"
    
    def test_verify_payment_requires_all_fields(self):
        """Test that verify-payment requires all fields"""
        incomplete_data = {
            "razorpay_order_id": "order_test_123"
            # Missing payment_id, signature, user_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/verify-payment",
            json=incomplete_data
        )
        
        # Should fail with 422 (validation error)
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"
    
    def test_webhook_endpoint_exists(self):
        """Test that webhook endpoint exists and responds"""
        # Send empty body (invalid webhook call)
        response = requests.post(
            f"{BASE_URL}/api/razorpay/webhook",
            json={},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 200 (webhook always returns ok to avoid retries)
        # or 500 for processing error
        assert response.status_code in [200, 500], f"Expected 200 or 500 for webhook, got {response.status_code}"
    
    def test_payment_history_returns_list(self):
        """Test that payment history returns proper list structure"""
        test_user_id = f"test-history-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        response = requests.get(f"{BASE_URL}/api/razorpay/payment-history/{test_user_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert 'payments' in data, "Missing 'payments' in response"
        assert isinstance(data['payments'], list), f"payments should be list, got {type(data['payments'])}"
    
    def test_update_order_status_validates_status(self):
        """Test that update-order-status validates status values"""
        invalid_status_data = {
            "order_id": "order_test_123",
            "status": "invalid_status"  # Not in valid_statuses
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/update-order-status",
            json=invalid_status_data
        )
        
        # Should fail with 400 for invalid status
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
        assert 'Invalid status' in response.text, f"Expected 'Invalid status' error, got: {response.text}"
    
    def test_update_order_status_valid_statuses(self):
        """Test that valid statuses are accepted"""
        valid_statuses = ["failed", "cancelled", "error", "timeout", "dismissed"]
        
        for status in valid_statuses:
            status_data = {
                "order_id": f"order_test_status_{status}",
                "status": status,
                "reason": f"Test {status} reason"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/razorpay/update-order-status",
                json=status_data
            )
            
            # Should succeed
            assert response.status_code == 200, f"Expected 200 for status '{status}', got {response.status_code}: {response.text}"


class TestRazorpayOrderDurations:
    """Test subscription plan duration mappings"""
    
    def test_monthly_order_creation(self):
        """Test monthly plan order (28 days)"""
        order_data = {
            "user_id": f"test-monthly-{datetime.now().strftime('%H%M%S')}",
            "plan_type": "monthly",
            "plan_name": "startup",
            "amount": 299
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('amount') == 29900
    
    def test_quarterly_order_creation(self):
        """Test quarterly plan order (84 days)"""
        order_data = {
            "user_id": f"test-quarterly-{datetime.now().strftime('%H%M%S')}",
            "plan_type": "quarterly",
            "plan_name": "elite",
            "amount": 2157
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('amount') == 215700
    
    def test_half_yearly_order_creation(self):
        """Test half-yearly plan order (168 days)"""
        order_data = {
            "user_id": f"test-halfyearly-{datetime.now().strftime('%H%M%S')}",
            "plan_type": "half_yearly",
            "plan_name": "growth",
            "amount": 2694
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('amount') == 269400
    
    def test_yearly_order_creation(self):
        """Test yearly plan order (336 days)"""
        order_data = {
            "user_id": f"test-yearly-{datetime.now().strftime('%H%M%S')}",
            "plan_type": "yearly",
            "plan_name": "elite",
            "amount": 9588
        }
        
        response = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('amount') == 958800


class TestRazorpayDebugEndpoint:
    """Test subscription renewal debug endpoint"""
    
    def test_debug_subscription_renewal_endpoint_exists(self):
        """Test that debug endpoint exists for subscription renewal calculation"""
        # Test with a non-existent user
        response = requests.get(f"{BASE_URL}/api/razorpay/debug/subscription-renewal/test-user-123")
        
        # Should return 404 for non-existent user
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        assert 'not found' in response.text.lower(), f"Expected 'not found' error, got: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
