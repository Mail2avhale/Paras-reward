"""
Test Razorpay Admin Subscription APIs
Tests for: GET /api/admin/razorpay-subscriptions, search, filter, stats, sync-pending
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestAdminRazorpaySubscriptions:
    """Test suite for Admin Razorpay Subscriptions API"""
    
    def test_get_all_subscriptions(self, api_client):
        """Test GET /api/admin/razorpay-subscriptions returns all orders"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions")
        assert response.status_code == 200
        
        data = response.json()
        assert "orders" in data
        assert "stats" in data
        assert isinstance(data["orders"], list)
        
    def test_stats_fields(self, api_client):
        """Test stats include expected fields including failed_orders"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions")
        assert response.status_code == 200
        
        data = response.json()
        stats = data.get("stats", {})
        
        # Verify expected stat fields
        assert "total_orders" in stats
        assert "paid_orders" in stats
        assert "pending_orders" in stats
        assert "failed_orders" in stats  # Critical: failed_orders must be present
        assert "total_revenue" in stats
        
        # All should be integers
        assert isinstance(stats["total_orders"], int)
        assert isinstance(stats["paid_orders"], int)
        assert isinstance(stats["pending_orders"], int)
        assert isinstance(stats["failed_orders"], int)
        assert isinstance(stats["total_revenue"], (int, float))
        
    def test_order_fields(self, api_client):
        """Test order includes user_current_plan and user_subscription_expiry"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions")
        assert response.status_code == 200
        
        data = response.json()
        orders = data.get("orders", [])
        
        if orders:
            order = orders[0]
            # Verify expected order fields
            assert "order_id" in order
            assert "user_id" in order
            assert "user_name" in order
            assert "plan_name" in order
            assert "amount" in order
            assert "status" in order
            assert "failure_reason" in order  # Critical: should be present
            assert "error_code" in order  # Critical: should be present
            assert "user_current_plan" in order  # Critical: new field
            assert "user_subscription_expiry" in order  # Critical: new field
            
    def test_search_by_name(self, api_client):
        """Test search by user name"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions?search=admin")
        assert response.status_code == 200
        
        data = response.json()
        orders = data.get("orders", [])
        
        # If results, all should match the search term
        for order in orders:
            name_match = "admin" in order.get("user_name", "").lower()
            email_match = "admin" in order.get("user_email", "").lower() if order.get("user_email") else False
            order_match = "admin" in order.get("order_id", "").lower()
            assert name_match or email_match or order_match
            
    def test_search_by_email(self, api_client):
        """Test search by user email"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions?search=mail2avhale")
        assert response.status_code == 200
        
        data = response.json()
        orders = data.get("orders", [])
        
        # If results found, should match search term
        if orders:
            found_match = False
            for order in orders:
                if order.get("user_email") and "mail2avhale" in order.get("user_email", "").lower():
                    found_match = True
                    break
            assert found_match or len(orders) == 0  # Either match found or empty results
            
    def test_search_by_phone(self, api_client):
        """Test search by phone number"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions?search=9970100783")
        assert response.status_code == 200
        
        data = response.json()
        orders = data.get("orders", [])
        
        # If results, verify mobile matches
        for order in orders:
            mobile = order.get("user_mobile") or ""
            assert "9970100783" in mobile
            
    def test_search_by_order_id(self, api_client):
        """Test search by order_id"""
        # First get an order ID
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions")
        data = response.json()
        orders = data.get("orders", [])
        
        if orders:
            order_id = orders[0].get("order_id")
            
            # Search by that order ID
            search_response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions?search={order_id}")
            assert search_response.status_code == 200
            
            search_data = search_response.json()
            search_orders = search_data.get("orders", [])
            
            # Should find the exact order
            assert len(search_orders) >= 1
            assert any(o.get("order_id") == order_id for o in search_orders)
            
    def test_filter_by_status_paid(self, api_client):
        """Test filter by status=paid"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions?status=paid")
        assert response.status_code == 200
        
        data = response.json()
        orders = data.get("orders", [])
        
        # All returned orders should have paid status
        for order in orders:
            assert order.get("status") == "paid"
            
    def test_filter_by_status_created(self, api_client):
        """Test filter by status=created (pending)"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions?status=created")
        assert response.status_code == 200
        
        data = response.json()
        orders = data.get("orders", [])
        
        # All returned orders should have created status
        for order in orders:
            assert order.get("status") == "created"
            
    def test_filter_by_status_failed(self, api_client):
        """Test filter by status=failed"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions?status=failed")
        assert response.status_code == 200
        
        data = response.json()
        orders = data.get("orders", [])
        
        # All returned orders should have failed status
        for order in orders:
            assert order.get("status") == "failed"
            
    def test_search_with_status_filter(self, api_client):
        """Test search combined with status filter"""
        response = api_client.get(f"{BASE_URL}/api/admin/razorpay-subscriptions?status=created&search=test")
        assert response.status_code == 200
        
        data = response.json()
        assert "orders" in data
        assert "stats" in data


class TestPaymentHistory:
    """Test suite for Payment History API"""
    
    def test_payment_history_include_all(self, api_client):
        """Test GET /api/razorpay/payment-history/{user_id}?include_all=true"""
        # Use known test user
        user_id = "73b95483-f36b-4637-a5ee-d447300c6835"
        
        response = api_client.get(f"{BASE_URL}/api/razorpay/payment-history/{user_id}?include_all=true")
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
        
        payments = data.get("payments", [])
        if payments:
            payment = payments[0]
            # Verify status_message is present
            assert "status_message" in payment
            assert "status_color" in payment
            
    def test_payment_history_status_messages(self, api_client):
        """Test payment history includes correct status messages"""
        user_id = "73b95483-f36b-4637-a5ee-d447300c6835"
        
        response = api_client.get(f"{BASE_URL}/api/razorpay/payment-history/{user_id}?include_all=true")
        assert response.status_code == 200
        
        data = response.json()
        payments = data.get("payments", [])
        
        for payment in payments:
            status = payment.get("status")
            status_message = payment.get("status_message")
            
            # Verify status_message corresponds to status
            if status == "paid":
                assert "successful" in status_message.lower() or "activated" in status_message.lower()
            elif status == "created":
                assert "pending" in status_message.lower()
            elif status == "failed":
                assert "failed" in status_message.lower()
                
    def test_payment_history_only_successful(self, api_client):
        """Test GET /api/razorpay/payment-history/{user_id} without include_all (default)"""
        user_id = "73b95483-f36b-4637-a5ee-d447300c6835"
        
        response = api_client.get(f"{BASE_URL}/api/razorpay/payment-history/{user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data


class TestSyncPending:
    """Test suite for Sync Pending API"""
    
    def test_sync_pending_endpoint(self, api_client):
        """Test POST /api/admin/razorpay/sync-pending"""
        response = api_client.post(f"{BASE_URL}/api/admin/razorpay/sync-pending")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert data["success"] == True
        assert "synced" in data
        assert "total_pending" in data
        
        # Should have results array
        if "results" in data:
            assert isinstance(data["results"], list)
            
    def test_sync_pending_returns_results(self, api_client):
        """Test sync-pending returns order sync results"""
        response = api_client.post(f"{BASE_URL}/api/admin/razorpay/sync-pending")
        assert response.status_code == 200
        
        data = response.json()
        results = data.get("results", [])
        
        # Each result should have order_id and status
        for result in results:
            assert "order_id" in result
            assert "user_id" in result
            assert "status" in result
            
    def test_sync_pending_handles_errors(self, api_client):
        """Test sync-pending handles errors gracefully"""
        response = api_client.post(f"{BASE_URL}/api/admin/razorpay/sync-pending")
        assert response.status_code == 200
        
        data = response.json()
        
        # If there are errors, they should be in errors array
        if "errors" in data:
            errors = data["errors"]
            for error in errors:
                assert "order_id" in error
                assert "error" in error


class TestRazorpayConfig:
    """Test Razorpay configuration endpoint"""
    
    def test_razorpay_config(self, api_client):
        """Test GET /api/razorpay/config"""
        response = api_client.get(f"{BASE_URL}/api/razorpay/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "key_id" in data
        assert "enabled" in data
        assert "currency" in data
        assert data["currency"] == "INR"


class TestUpdateOrderStatus:
    """Test update order status endpoint"""
    
    def test_update_order_status_requires_fields(self, api_client):
        """Test POST /api/razorpay/update-order-status requires order_id and status"""
        # Missing order_id
        response = api_client.post(
            f"{BASE_URL}/api/razorpay/update-order-status",
            json={"status": "failed"}
        )
        assert response.status_code == 400
        
        # Missing status
        response = api_client.post(
            f"{BASE_URL}/api/razorpay/update-order-status",
            json={"order_id": "test123"}
        )
        assert response.status_code == 400
        
    def test_update_order_status_validates_status(self, api_client):
        """Test update-order-status validates status values"""
        response = api_client.post(
            f"{BASE_URL}/api/razorpay/update-order-status",
            json={
                "order_id": "test123",
                "status": "invalid_status"
            }
        )
        assert response.status_code == 400
        assert "Invalid status" in response.json().get("detail", "")
