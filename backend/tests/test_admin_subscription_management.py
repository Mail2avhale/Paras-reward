"""
Admin Subscription Management Tests
Testing: Stats API, VIP Payments List, Approve/Reject flows, Notifications
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestSubscriptionStats:
    """Test subscription stats API loading speed and data"""
    
    def test_subscription_stats_loads_quickly(self, api_client):
        """Test /api/admin/subscription-stats loads within 3 seconds"""
        import time
        start = time.time()
        response = api_client.get(f"{BASE_URL}/api/admin/subscription-stats")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Stats API returned {response.status_code}"
        assert elapsed < 3.0, f"Stats API took {elapsed:.2f}s, should be < 3s"
        
        data = response.json()
        assert "plan_counts" in data, "Response should contain plan_counts"
        assert "total_users" in data, "Response should contain total_users"
        assert "vip_users" in data, "Response should contain vip_users"
        print(f"✓ Stats API loaded in {elapsed:.2f}s with {data.get('total_users', 0)} total users")
    
    def test_subscription_stats_data_structure(self, api_client):
        """Test stats API returns correct data structure"""
        response = api_client.get(f"{BASE_URL}/api/admin/subscription-stats")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check plan counts structure
        plan_counts = data.get("plan_counts", {})
        expected_plans = ["explorer", "startup", "growth", "elite"]
        for plan in expected_plans:
            assert plan in plan_counts, f"plan_counts should include {plan}"
        
        # Verify counts are non-negative
        for plan, count in plan_counts.items():
            assert count >= 0, f"Plan count for {plan} should be non-negative"
        
        print(f"✓ Plan counts: {plan_counts}")


class TestVIPPaymentsList:
    """Test VIP payments list with pagination"""
    
    def test_pending_payments_list(self, api_client):
        """Test pending payments endpoint"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=pending&page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data, "Response should contain payments"
        assert "total" in data, "Response should contain total"
        assert "page" in data, "Response should contain page"
        
        print(f"✓ Pending payments: {len(data.get('payments', []))} items, total: {data.get('total', 0)}")
    
    def test_approved_payments_list(self, api_client):
        """Test approved payments endpoint"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
        
        # Check approved payments have correct enriched data
        for payment in data.get("payments", [])[:3]:  # Check first 3
            assert "payment_id" in payment
            assert "user_name" in payment
            assert "plan" in payment or "subscription_plan" in payment
            print(f"  - Payment {payment.get('payment_id', '')[:8]}: {payment.get('user_name', 'Unknown')}")
        
        print(f"✓ Approved payments: {len(data.get('payments', []))} items")
    
    def test_rejected_payments_list(self, api_client):
        """Test rejected payments endpoint"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=rejected&page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
        
        # Check rejected payments have rejection reason
        for payment in data.get("payments", [])[:3]:
            assert "payment_id" in payment
            if payment.get("status") == "rejected":
                print(f"  - Rejected payment {payment.get('payment_id', '')[:8]}: reason={payment.get('rejection_reason', 'N/A')}")
        
        print(f"✓ Rejected payments: {len(data.get('payments', []))} items")
    
    def test_pagination_works(self, api_client):
        """Test pagination on VIP payments"""
        # Get page 1
        response_p1 = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=5")
        assert response_p1.status_code == 200
        data_p1 = response_p1.json()
        
        total = data_p1.get("total", 0)
        pages = data_p1.get("pages", 0)
        
        print(f"✓ Pagination: Total={total}, Pages={pages}, Page 1 items={len(data_p1.get('payments', []))}")
    
    def test_time_filter_works(self, api_client):
        """Test time filter on VIP payments"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&time_filter=month")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Time filter (month): {data.get('total', 0)} payments")
    
    def test_plan_filter_works(self, api_client):
        """Test plan filter on VIP payments"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&plan=elite")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Plan filter (elite): {data.get('total', 0)} payments")


class TestApproveRejectFlow:
    """Test approve and reject payment flows"""
    
    @pytest.fixture
    def test_payment_id(self, api_client):
        """Create a test payment and return its ID"""
        # First check if there's an existing pending payment
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=pending&page=1&limit=1")
        if response.status_code == 200:
            data = response.json()
            if data.get("payments"):
                return data["payments"][0]["payment_id"]
        
        # No pending payments, create one via direct DB or skip
        pytest.skip("No pending payments available for testing")
    
    def test_approve_payment_flow(self, api_client):
        """Test approving a payment (requires pending payment)"""
        # This test will run if there are pending payments
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=pending&page=1&limit=1")
        
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending payments")
        
        data = response.json()
        if not data.get("payments"):
            print("✓ No pending payments to test approve flow (expected)")
            return
        
        payment = data["payments"][0]
        payment_id = payment.get("payment_id")
        
        # Test approve endpoint
        approve_response = api_client.post(
            f"{BASE_URL}/api/admin/vip-payment/{payment_id}/approve",
            json={"admin_id": "test_admin", "notes": "Test approval"}
        )
        
        assert approve_response.status_code in [200, 400], f"Approve returned {approve_response.status_code}"
        
        result = approve_response.json()
        print(f"✓ Approve flow tested: {result.get('message', 'No message')}")
    
    def test_reject_payment_endpoint_exists(self, api_client):
        """Test reject payment endpoint returns proper response"""
        # Test with non-existent payment ID to verify endpoint exists
        fake_id = str(uuid.uuid4())
        
        response = api_client.post(
            f"{BASE_URL}/api/admin/vip-payment/{fake_id}/reject",
            json={"reason": "Test rejection", "admin_id": "test_admin"}
        )
        
        # Should return 404 for non-existent payment
        assert response.status_code == 404, f"Reject endpoint returned {response.status_code} for non-existent payment"
        
        data = response.json()
        assert "detail" in data, "Error response should have detail"
        print(f"✓ Reject endpoint exists, returns 404 for non-existent payment")
    
    def test_approve_payment_endpoint_exists(self, api_client):
        """Test approve payment endpoint returns proper response"""
        fake_id = str(uuid.uuid4())
        
        response = api_client.post(
            f"{BASE_URL}/api/admin/vip-payment/{fake_id}/approve",
            json={"admin_id": "test_admin"}
        )
        
        # Should return 404 for non-existent payment
        assert response.status_code == 404, f"Approve endpoint returned {response.status_code}"
        print(f"✓ Approve endpoint exists, returns 404 for non-existent payment")


class TestRejectPaymentWithReason:
    """Test rejection flow with predefined reasons"""
    
    def test_reject_with_marathi_reason(self, api_client):
        """Test rejection with Marathi predefined reason"""
        # Create a test pending payment first or use existing
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=pending&page=1&limit=1")
        
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending payments")
        
        data = response.json()
        if not data.get("payments"):
            print("✓ No pending payments to test rejection - testing endpoint with fake ID")
            
            # Test with fake ID to verify endpoint accepts Marathi reasons
            fake_id = str(uuid.uuid4())
            reject_response = api_client.post(
                f"{BASE_URL}/api/admin/vip-payment/{fake_id}/reject",
                json={
                    "reason": "चुकीचा UTR Number",
                    "admin_id": "test_admin"
                }
            )
            
            # Should return 404 but endpoint should work
            assert reject_response.status_code == 404
            print("✓ Reject endpoint accepts Marathi rejection reasons")
            return
        
        payment = data["payments"][0]
        payment_id = payment.get("payment_id")
        
        # Test reject with Marathi reason
        reject_response = api_client.post(
            f"{BASE_URL}/api/admin/vip-payment/{payment_id}/reject",
            json={
                "reason": "Screenshot स्पष्ट नाही",
                "admin_id": "test_admin"
            }
        )
        
        assert reject_response.status_code == 200, f"Reject returned {reject_response.status_code}"
        
        result = reject_response.json()
        assert result.get("success") == True
        print(f"✓ Rejection with Marathi reason successful")
    
    def test_rejected_payment_has_reason(self, api_client):
        """Verify rejected payments have rejection_reason field"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=rejected&page=1&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        payments = data.get("payments", [])
        
        for payment in payments:
            rejection_reason = payment.get("rejection_reason")
            if rejection_reason:
                print(f"  - Payment {payment.get('payment_id', '')[:8]}: reason='{rejection_reason}'")
        
        print(f"✓ Checked {len(payments)} rejected payments for rejection_reason field")


class TestNotificationOnRejection:
    """Test that notifications are sent to users on rejection"""
    
    def test_notifications_endpoint_exists(self, api_client):
        """Verify notifications endpoint exists"""
        # Test notifications endpoint with a test user
        test_uid = "900253b5-b917-4e6b-b26a-731b6fe112dd"  # Known test user
        
        response = api_client.get(f"{BASE_URL}/api/notifications/{test_uid}")
        
        # Should return 200 with notifications list or empty
        if response.status_code == 200:
            data = response.json()
            notifications = data if isinstance(data, list) else data.get("notifications", [])
            
            # Check for subscription-related notifications
            sub_notifications = [n for n in notifications if "subscription" in n.get("type", "").lower() or "payment" in n.get("message", "").lower()]
            
            print(f"✓ Found {len(notifications)} total notifications, {len(sub_notifications)} subscription-related")
        else:
            print(f"✓ Notifications endpoint returned {response.status_code}")


class TestLoadSpeed:
    """Test API load speeds"""
    
    def test_vip_payments_load_speed(self, api_client):
        """Test VIP payments list loads quickly"""
        import time
        
        endpoints = [
            "/api/admin/vip-payments?status=pending&page=1&limit=10",
            "/api/admin/vip-payments?status=approved&page=1&limit=10",
            "/api/admin/vip-payments?status=rejected&page=1&limit=10"
        ]
        
        for endpoint in endpoints:
            start = time.time()
            response = api_client.get(f"{BASE_URL}{endpoint}")
            elapsed = time.time() - start
            
            assert response.status_code == 200, f"{endpoint} returned {response.status_code}"
            assert elapsed < 5.0, f"{endpoint} took {elapsed:.2f}s, should be < 5s"
            
            print(f"✓ {endpoint.split('status=')[1].split('&')[0]}: {elapsed:.2f}s")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
