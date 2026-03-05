"""
Test Payment History Features for Subscription Plans
Tests for iteration_105: User subscription page improvements

Features to test:
1. Payment history endpoint returns all payment attempts
2. Status messages with emoji and color coding
3. Failure reason displayed for failed payments
4. Alert banner condition when hasUnactivatedPayment
5. API correctly returns include_all parameter
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_USER_ID = "73b95483-f36b-4637-a5ee-d447300c6835"  # mail2avhale@gmail.com


class TestPaymentHistoryAPI:
    """Test Payment History API endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up session for requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_payment_history_returns_all_payments(self):
        """Test that payment history returns all payments when include_all=true"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        # Should return payments list
        assert isinstance(data["payments"], list)
    
    def test_payment_history_without_include_all(self):
        """Test that payment history without include_all returns only successful payments"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        # Check that all returned payments are successful (paid/captured)
        for payment in data["payments"]:
            assert payment.get("status") in ["paid", "captured"]
    
    def test_payment_history_has_status_message(self):
        """Test that payments have status_message field"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Each payment should have status_message
        for payment in data["payments"]:
            assert "status_message" in payment, f"Payment {payment.get('order_id')} missing status_message"
            assert payment["status_message"], "status_message should not be empty"
    
    def test_payment_history_has_status_color(self):
        """Test that payments have status_color field"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Each payment should have status_color
        valid_colors = ["green", "yellow", "red", "orange", "gray"]
        for payment in data["payments"]:
            assert "status_color" in payment, f"Payment {payment.get('order_id')} missing status_color"
            assert payment["status_color"] in valid_colors, f"Invalid color: {payment['status_color']}"
    
    def test_status_message_for_paid_payment(self):
        """Test that paid payments have correct status message"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        
        for payment in data["payments"]:
            if payment.get("status") == "paid":
                assert "✅" in payment["status_message"], "Paid payment should have checkmark emoji"
                assert payment["status_color"] == "green", "Paid payment should be green"
    
    def test_status_message_for_pending_payment(self):
        """Test that pending (created) payments have correct status message"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        
        for payment in data["payments"]:
            if payment.get("status") == "created":
                assert "⏳" in payment["status_message"], "Pending payment should have hourglass emoji"
                assert payment["status_color"] == "yellow", "Pending payment should be yellow"
    
    def test_status_message_for_failed_payment(self):
        """Test that failed payments have correct status message with failure reason"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        
        for payment in data["payments"]:
            if payment.get("status") == "failed":
                assert "❌" in payment["status_message"], "Failed payment should have X emoji"
                assert payment["status_color"] == "red", "Failed payment should be red"
                # If there's a failure_reason, it should be included
                if payment.get("failure_reason"):
                    assert payment["failure_reason"] in payment["status_message"]
    
    def test_status_message_for_error_payment(self):
        """Test that error payments have correct status message"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        
        for payment in data["payments"]:
            if payment.get("status") == "error":
                assert "⚠️" in payment["status_message"], "Error payment should have warning emoji"
                assert payment["status_color"] == "orange", "Error payment should be orange"
    
    def test_status_message_for_cancelled_payment(self):
        """Test that cancelled payments have correct status message"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        
        for payment in data["payments"]:
            if payment.get("status") == "cancelled":
                assert "🚫" in payment["status_message"], "Cancelled payment should have no-entry emoji"
                assert payment["status_color"] == "gray", "Cancelled payment should be gray"
    
    def test_payment_contains_plan_details(self):
        """Test that payment records contain plan details for retry functionality"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        
        for payment in data["payments"]:
            assert "plan_name" in payment, "Payment should have plan_name"
            assert "plan_type" in payment, "Payment should have plan_type"
            assert "amount" in payment, "Payment should have amount"
    
    def test_payment_history_sorted_by_date(self):
        """Test that payments are sorted by date (newest first)"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/{TEST_USER_ID}?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        
        payments = data["payments"]
        if len(payments) >= 2:
            # Check that created_at is in descending order
            for i in range(len(payments) - 1):
                date1 = payments[i].get("created_at", "")
                date2 = payments[i + 1].get("created_at", "")
                assert date1 >= date2, f"Payments not sorted by date: {date1} < {date2}"
    
    def test_nonexistent_user_returns_empty_list(self):
        """Test that non-existent user returns empty payments list"""
        response = self.session.get(
            f"{BASE_URL}/api/razorpay/payment-history/nonexistent-user-id-123?include_all=true"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["payments"] == [], "Non-existent user should return empty list"


class TestUpdateOrderStatusAPI:
    """Test update order status endpoint (for failed/cancelled payments)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up session for requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_update_order_status_requires_order_id(self):
        """Test that order_id is required"""
        response = self.session.post(
            f"{BASE_URL}/api/razorpay/update-order-status",
            json={"status": "failed", "reason": "Test"}
        )
        assert response.status_code == 400
        assert "order_id" in response.json().get("detail", "").lower()
    
    def test_update_order_status_requires_status(self):
        """Test that status is required"""
        response = self.session.post(
            f"{BASE_URL}/api/razorpay/update-order-status",
            json={"order_id": "test_order", "reason": "Test"}
        )
        assert response.status_code == 400
        assert "status" in response.json().get("detail", "").lower()
    
    def test_update_order_status_validates_status(self):
        """Test that invalid status is rejected"""
        response = self.session.post(
            f"{BASE_URL}/api/razorpay/update-order-status",
            json={"order_id": "test_order", "status": "invalid_status"}
        )
        assert response.status_code == 400
        assert "invalid status" in response.json().get("detail", "").lower()
    
    def test_valid_statuses_accepted(self):
        """Test that valid statuses are accepted"""
        valid_statuses = ["failed", "cancelled", "error", "timeout", "dismissed"]
        # We'll just verify the validation passes (may return 200 or other status if order doesn't exist)
        for status in valid_statuses:
            response = self.session.post(
                f"{BASE_URL}/api/razorpay/update-order-status",
                json={"order_id": "test_order_123", "status": status}
            )
            # Should not return 400 with invalid status error
            if response.status_code == 400:
                detail = response.json().get("detail", "")
                assert "invalid status" not in detail.lower(), f"Status {status} should be valid"


class TestSubscriptionUserAPI:
    """Test subscription user endpoint for hasUnactivatedPayment scenario"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up session for requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_subscription_user_returns_data(self):
        """Test that subscription/user endpoint returns user subscription data"""
        response = self.session.get(
            f"{BASE_URL}/api/subscription/user/{TEST_USER_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "subscription" in data
        subscription = data["subscription"]
        assert "plan" in subscription
        assert "plan_name" in subscription
        assert "is_expired" in subscription


class TestRazorpayConfigAPI:
    """Test Razorpay config endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up session for requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_razorpay_config_returns_enabled_status(self):
        """Test that config returns enabled status"""
        response = self.session.get(f"{BASE_URL}/api/razorpay/config")
        assert response.status_code == 200
        data = response.json()
        # Should have 'enabled' field
        assert "enabled" in data
        assert isinstance(data["enabled"], bool)
    
    def test_razorpay_config_returns_key_id(self):
        """Test that config returns key_id"""
        response = self.session.get(f"{BASE_URL}/api/razorpay/config")
        assert response.status_code == 200
        data = response.json()
        assert "key_id" in data
        # Key should start with rzp_
        assert data["key_id"].startswith("rzp_")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
