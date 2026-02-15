"""
Test Admin VIP Routes - Simplified Version
Testing the rebuilt admin_vip.py with simple sequential database operations
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminVIPAPIs:
    """Test Admin VIP subscription management APIs"""
    
    def test_subscription_stats(self):
        """Test subscription stats endpoint returns plan counts"""
        response = requests.get(f"{BASE_URL}/api/admin/subscription-stats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "plan_counts" in data
        assert "total_users" in data
        assert "vip_users" in data
        assert "pending_payments" in data
        
        # Verify plan counts structure
        plan_counts = data["plan_counts"]
        assert "explorer" in plan_counts
        assert "startup" in plan_counts
        assert "growth" in plan_counts
        assert "elite" in plan_counts
        
        # Values should be non-negative integers
        assert isinstance(plan_counts["explorer"], int)
        assert isinstance(plan_counts["startup"], int)
        assert plan_counts["explorer"] >= 0
        
        print(f"Stats: Total Users={data['total_users']}, VIP Users={data['vip_users']}")
    
    def test_vip_payments_pending(self):
        """Test fetching pending VIP payments"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=pending")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "payments" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        
        # Payments should be a list
        assert isinstance(data["payments"], list)
        
        print(f"Pending payments: {data['total']}")
    
    def test_vip_payments_approved(self):
        """Test fetching approved VIP payments"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "payments" in data
        payments = data["payments"]
        
        if payments:
            # Check payment structure
            payment = payments[0]
            assert "payment_id" in payment
            assert "user_id" in payment
            assert "status" in payment
            assert payment["status"] == "approved"
            
            # Check enriched user data
            assert "user_name" in payment
            assert "user_email" in payment
            
            print(f"First approved payment: {payment.get('user_name')} - ₹{payment.get('amount')}")
        else:
            print("No approved payments found")
    
    def test_vip_payments_rejected(self):
        """Test fetching rejected VIP payments"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=rejected&limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "payments" in data
        assert isinstance(data["payments"], list)
        
        print(f"Rejected payments: {data['total']}")
    
    def test_vip_payments_pagination(self):
        """Test pagination works for VIP payments"""
        # Get first page
        response1 = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=3")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Get second page
        response2 = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&page=2&limit=3")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Page numbers should be correct
        assert data1["page"] == 1
        assert data2["page"] == 2
        
        # If there are more than 3 payments, page 1 and 2 should have different payments
        if data1["total"] > 3 and len(data2["payments"]) > 0:
            page1_ids = [p["payment_id"] for p in data1["payments"]]
            page2_ids = [p["payment_id"] for p in data2["payments"]]
            # No overlap between pages
            assert not set(page1_ids) & set(page2_ids)
        
        print(f"Pagination test: Page 1={len(data1['payments'])}, Page 2={len(data2['payments'])}")
    
    def test_vip_payments_plan_filter(self):
        """Test filtering payments by plan"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&plan=growth")
        
        assert response.status_code == 200
        data = response.json()
        
        # All payments should be growth plan
        for payment in data["payments"]:
            assert payment.get("subscription_plan") == "growth" or payment.get("plan") == "growth"
        
        print(f"Growth plan payments: {data['total']}")
    
    def test_vip_payments_time_filter(self):
        """Test filtering payments by time"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&time_filter=week")
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"Payments this week: {data['total']}")
    
    def test_pending_count(self):
        """Test pending count endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments/pending-count")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
        
        print(f"Pending count: {data['count']}")
    
    def test_subscription_pricing_reference(self):
        """Test pricing reference endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/subscription-pricing-reference")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check all plans exist
        assert "explorer" in data
        assert "startup" in data
        assert "growth" in data
        assert "elite" in data
        
        # Check startup has prices
        assert "prices" in data["startup"]
        assert "monthly" in data["startup"]["prices"]
        
        print(f"Startup monthly price: ₹{data['startup']['prices']['monthly']}")
    
    def test_cache_clear(self):
        """Test cache clear endpoint"""
        response = requests.post(f"{BASE_URL}/api/admin/vip-cache-clear")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        print("Cache cleared successfully")
    
    def test_approve_nonexistent_payment(self):
        """Test approving non-existent payment returns 404"""
        fake_id = f"fake-{uuid.uuid4()}"
        response = requests.post(
            f"{BASE_URL}/api/admin/vip-payment/{fake_id}/approve",
            json={}
        )
        
        assert response.status_code == 404
        print("Non-existent payment approval correctly returns 404")
    
    def test_reject_nonexistent_payment(self):
        """Test rejecting non-existent payment returns 404"""
        fake_id = f"fake-{uuid.uuid4()}"
        response = requests.post(
            f"{BASE_URL}/api/admin/vip-payment/{fake_id}/reject",
            json={"reason": "Test reason"}
        )
        
        assert response.status_code == 404
        print("Non-existent payment rejection correctly returns 404")
    
    def test_delete_nonexistent_payment(self):
        """Test deleting non-existent payment returns 404"""
        fake_id = f"fake-{uuid.uuid4()}"
        response = requests.delete(f"{BASE_URL}/api/admin/vip-payments/{fake_id}")
        
        assert response.status_code == 404
        print("Non-existent payment deletion correctly returns 404")
    
    def test_update_nonexistent_payment(self):
        """Test updating non-existent payment returns 404"""
        fake_id = f"fake-{uuid.uuid4()}"
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{fake_id}",
            json={"plan": "growth"}
        )
        
        assert response.status_code == 404
        print("Non-existent payment update correctly returns 404")


class TestApprovalFlow:
    """Test the actual approval/rejection flow (if test data exists)"""
    
    def test_get_payment_details_from_approved(self):
        """Get a sample approved payment to verify data structure"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&limit=1")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["payments"]:
            payment = data["payments"][0]
            
            # Verify all expected fields are present
            assert "payment_id" in payment
            assert "user_id" in payment
            assert "subscription_plan" in payment or "plan" in payment
            assert "amount" in payment
            assert "status" in payment
            assert "user_name" in payment
            assert "user_email" in payment
            
            # Verify approved-specific fields
            assert "approved_at" in payment
            
            print(f"Verified payment structure for: {payment['payment_id']}")
        else:
            pytest.skip("No approved payments available to verify")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
