"""
Test Subscription Approval Flow - Bug Fix Verification
Tests the admin VIP payment approval/rejection functionality
Fixed bugs:
1. Frontend was sending empty body to POST /approve causing JSON parse error
2. Backend was not handling empty request body
3. Fixed bug where subscription_plan was being overwritten
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSubscriptionStats:
    """Test subscription statistics endpoint"""

    def test_get_subscription_stats(self):
        """GET /api/admin/subscription-stats should return stats"""
        response = requests.get(f"{BASE_URL}/api/admin/subscription-stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify expected fields exist
        assert "plan_counts" in data or "by_plan" in data, "Missing plan data in response"
        assert "total_users" in data or "vip_users" in data, "Missing user count data"
        assert "pending_payments" in data, "Missing pending_payments field"
        print(f"Subscription stats: {data}")


class TestVIPPaymentsList:
    """Test VIP payments list endpoints"""

    def test_get_pending_payments(self):
        """GET /api/admin/vip-payments?status=pending should return pending payments"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=pending&limit=20")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "payments" in data, "Missing payments field"
        assert "total" in data, "Missing total field"
        assert isinstance(data["payments"], list), "Payments should be a list"
        
        print(f"Pending payments: total={data['total']}, returned={len(data['payments'])}")

    def test_get_approved_payments(self):
        """GET /api/admin/vip-payments?status=approved should return approved payments"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&limit=50")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "payments" in data, "Missing payments field"
        assert "total" in data, "Missing total field"
        assert isinstance(data["payments"], list), "Payments should be a list"
        
        print(f"Approved payments: total={data['total']}, returned={len(data['payments'])}")

    def test_get_all_payments(self):
        """GET /api/admin/vip-payments should return all payments"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?limit=20")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "payments" in data, "Missing payments field"
        assert "page" in data, "Missing page field"
        assert "pages" in data, "Missing pages field"
        
        print(f"All payments: total={data['total']}, page={data['page']}, pages={data['pages']}")


class TestApprovePaymentEmptyBody:
    """Test approval with empty body - THE MAIN BUG FIX"""

    def test_approve_with_empty_body(self):
        """POST /api/admin/vip-payment/{id}/approve with empty body {} should work"""
        # First get a pending payment
        pending_response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=pending&limit=1")
        assert pending_response.status_code == 200
        
        pending_data = pending_response.json()
        
        if pending_data.get("payments") and len(pending_data["payments"]) > 0:
            payment_id = pending_data["payments"][0]["payment_id"]
            
            # This is the exact fix - sending empty {} body
            response = requests.post(
                f"{BASE_URL}/api/admin/vip-payment/{payment_id}/approve",
                json={}  # Empty body - this was causing the bug
            )
            
            # Should succeed or say already approved
            assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
            
            data = response.json()
            if response.status_code == 200:
                assert data.get("success") == True or "approved" in str(data.get("message", "")).lower()
                print(f"Approval successful: {data}")
            else:
                # Already processed
                print(f"Payment already processed: {data}")
        else:
            # No pending payments - test the endpoint with a fake ID
            response = requests.post(
                f"{BASE_URL}/api/admin/vip-payment/fake-payment-id/approve",
                json={}
            )
            assert response.status_code == 404, f"Expected 404 for fake payment ID, got {response.status_code}"
            print("No pending payments available, verified 404 for non-existent payment")

    def test_approve_with_notes(self):
        """POST /api/admin/vip-payment/{id}/approve with notes should work"""
        # Get a pending payment
        pending_response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=pending&limit=1")
        assert pending_response.status_code == 200
        
        pending_data = pending_response.json()
        
        if pending_data.get("payments") and len(pending_data["payments"]) > 0:
            payment_id = pending_data["payments"][0]["payment_id"]
            
            response = requests.post(
                f"{BASE_URL}/api/admin/vip-payment/{payment_id}/approve",
                json={
                    "notes": "Test approval with notes",
                    "admin_id": "test-admin"
                }
            )
            
            assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
            print(f"Approval with notes: {response.json()}")
        else:
            print("No pending payments to test with notes")

    def test_approve_nonexistent_payment(self):
        """POST /api/admin/vip-payment/{id}/approve with non-existent ID should return 404"""
        fake_payment_id = f"TEST-{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/vip-payment/{fake_payment_id}/approve",
            json={}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"Non-existent payment returns 404 as expected: {response.json()}")


class TestRejectPayment:
    """Test rejection flow"""

    def test_reject_with_reason(self):
        """POST /api/admin/vip-payment/{id}/reject with reason should work"""
        # Get a pending payment
        pending_response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=pending&limit=1")
        assert pending_response.status_code == 200
        
        pending_data = pending_response.json()
        
        if pending_data.get("payments") and len(pending_data["payments"]) > 0:
            payment_id = pending_data["payments"][0]["payment_id"]
            
            response = requests.post(
                f"{BASE_URL}/api/admin/vip-payment/{payment_id}/reject",
                json={
                    "reason": "TEST - Payment verification failed",
                    "admin_id": "test-admin"
                }
            )
            
            assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
            
            data = response.json()
            if response.status_code == 200:
                assert data.get("success") == True
                print(f"Rejection successful: {data}")
            else:
                print(f"Payment already processed: {data}")
        else:
            print("No pending payments to test rejection")

    def test_reject_nonexistent_payment(self):
        """POST /api/admin/vip-payment/{id}/reject with non-existent ID should return 404"""
        fake_payment_id = f"TEST-{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/vip-payment/{fake_payment_id}/reject",
            json={"reason": "Test rejection"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"Non-existent payment reject returns 404 as expected")


class TestPendingCount:
    """Test pending payments count endpoint"""

    def test_get_pending_count(self):
        """GET /api/admin/vip-payments/pending-count should return count"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments/pending-count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "count" in data, "Missing count field"
        assert isinstance(data["count"], int), "Count should be an integer"
        
        print(f"Pending payments count: {data['count']}")


class TestSubscriptionPricing:
    """Test subscription pricing endpoints"""

    def test_get_pricing_reference(self):
        """GET /api/admin/subscription-pricing-reference should return pricing table"""
        response = requests.get(f"{BASE_URL}/api/admin/subscription-pricing-reference")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Check expected plans exist
        expected_plans = ["explorer", "startup", "growth", "elite"]
        for plan in expected_plans:
            assert plan in data, f"Missing {plan} plan in pricing reference"
        
        print(f"Subscription pricing reference: {list(data.keys())}")

    def test_get_subscription_pricing(self):
        """GET /api/admin/subscription/pricing should return current pricing"""
        response = requests.get(f"{BASE_URL}/api/admin/subscription/pricing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify it returns some data (could be empty plans dict initially)
        assert isinstance(data, dict), "Pricing should return a dictionary"
        print(f"Current subscription pricing: {data}")


class TestVIPMigrationStatus:
    """Test VIP to subscription migration status"""

    def test_get_migration_status(self):
        """GET /api/admin/vip-migration-status should return migration status"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-migration-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "legacy_vip_users" in data, "Missing legacy_vip_users field"
        assert "migrated_users" in data, "Missing migrated_users field"
        assert "migration_complete" in data, "Missing migration_complete field"
        
        print(f"VIP Migration status: legacy={data['legacy_vip_users']}, migrated={data['migrated_users']}, complete={data['migration_complete']}")


class TestUpdateSubscription:
    """Test subscription update endpoint"""

    def test_update_nonexistent_payment(self):
        """PUT /api/admin/vip-payments/{id} with non-existent ID should return 404"""
        fake_payment_id = f"TEST-{uuid.uuid4().hex[:8]}"
        
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{fake_payment_id}",
            json={"plan": "growth"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent payment update returns 404 as expected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
