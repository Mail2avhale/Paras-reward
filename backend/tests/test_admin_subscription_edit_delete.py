"""
Tests for Admin Subscription Edit/Delete/Correct Feature
Tests the ability to edit, delete, or correct user subscriptions via admin panel.
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminSubscriptionEdit:
    """Tests for PUT /api/admin/vip-payments/{payment_id} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get an approved payment for testing"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=5")
        assert response.status_code == 200, f"Failed to get payments: {response.text}"
        data = response.json()
        payments = data.get('payments', [])
        assert len(payments) > 0, "No approved payments found for testing"
        self.test_payment = payments[0]
        self.payment_id = self.test_payment['payment_id']
        # Store original values for cleanup
        self.original_plan = self.test_payment.get('plan') or self.test_payment.get('subscription_plan', 'startup')
        self.original_duration = self.test_payment.get('duration') or self.test_payment.get('plan_type', 'monthly')
        self.original_amount = self.test_payment.get('amount', 0)
    
    def test_edit_plan_field(self):
        """Test updating subscription plan"""
        new_plan = 'elite' if self.original_plan != 'elite' else 'startup'
        
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={
                "plan": new_plan,
                "admin_id": "test-admin-001"
            }
        )
        
        assert response.status_code == 200, f"Edit plan failed: {response.text}"
        data = response.json()
        assert data.get('success') == True
        assert data.get('message') == "Subscription updated successfully"
        
        # Revert changes
        requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={"plan": self.original_plan, "admin_id": "test-cleanup"}
        )
    
    def test_edit_duration_field(self):
        """Test updating subscription duration"""
        new_duration = 'yearly' if self.original_duration != 'yearly' else 'monthly'
        
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={
                "duration": new_duration,
                "admin_id": "test-admin-002"
            }
        )
        
        assert response.status_code == 200, f"Edit duration failed: {response.text}"
        data = response.json()
        assert data.get('success') == True
        
        # Revert changes
        requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={"duration": self.original_duration, "admin_id": "test-cleanup"}
        )
    
    def test_edit_amount_field(self):
        """Test updating subscription amount"""
        new_amount = 999
        
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={
                "amount": new_amount,
                "admin_id": "test-admin-003"
            }
        )
        
        assert response.status_code == 200, f"Edit amount failed: {response.text}"
        data = response.json()
        assert data.get('success') == True
        
        # Revert changes
        requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={"amount": self.original_amount, "admin_id": "test-cleanup"}
        )
    
    def test_edit_expiry_date(self):
        """Test updating subscription expiry date"""
        # Set expiry to 1 year from now
        new_expiry = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={
                "expires_at": new_expiry,
                "admin_id": "test-admin-004"
            }
        )
        
        assert response.status_code == 200, f"Edit expiry failed: {response.text}"
        data = response.json()
        assert data.get('success') == True
    
    def test_edit_multiple_fields(self):
        """Test updating multiple fields at once"""
        new_plan = 'growth'
        new_duration = 'quarterly'
        new_amount = 1399
        new_expiry = (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')
        
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={
                "plan": new_plan,
                "duration": new_duration,
                "amount": new_amount,
                "expires_at": new_expiry,
                "admin_id": "test-admin-005"
            }
        )
        
        assert response.status_code == 200, f"Edit multiple fields failed: {response.text}"
        data = response.json()
        assert data.get('success') == True
        
        # Revert to original
        requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={
                "plan": self.original_plan,
                "duration": self.original_duration,
                "amount": self.original_amount,
                "admin_id": "test-cleanup"
            }
        )
    
    def test_edit_nonexistent_payment(self):
        """Test editing a payment that doesn't exist"""
        fake_payment_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{fake_payment_id}",
            json={
                "plan": "elite",
                "admin_id": "test-admin-006"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
    
    def test_edit_empty_request(self):
        """Test editing with empty update data"""
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={
                "admin_id": "test-admin-007"
            }
        )
        
        # Should still return success (no fields to update)
        assert response.status_code == 200, f"Empty update failed: {response.text}"


class TestAdminSubscriptionDelete:
    """Tests for DELETE /api/admin/vip-payments/{payment_id} endpoint"""
    
    def test_delete_endpoint_exists(self):
        """Test that delete endpoint is accessible"""
        # Use a fake ID to test endpoint exists
        fake_payment_id = str(uuid.uuid4())
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/vip-payments/{fake_payment_id}"
        )
        
        # Should return 404 for non-existent payment, not 405 or 500
        assert response.status_code == 404, f"Expected 404 for non-existent, got {response.status_code}"
    
    def test_delete_nonexistent_payment(self):
        """Test deleting a payment that doesn't exist returns 404"""
        fake_payment_id = "nonexistent-" + str(uuid.uuid4())[:8]
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/vip-payments/{fake_payment_id}"
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get('detail', '').lower()


class TestAdminVipPaymentsGet:
    """Tests for GET /api/admin/vip-payments with approved status - verifying edit data persistence"""
    
    def test_get_approved_payments(self):
        """Test fetching approved payments"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'payments' in data
        assert 'total' in data
        assert 'page' in data
        assert 'pages' in data
        
        if len(data['payments']) > 0:
            payment = data['payments'][0]
            # Check required fields for edit modal
            assert 'payment_id' in payment
            assert 'user_name' in payment or 'user_id' in payment
    
    def test_payment_has_required_fields_for_edit(self):
        """Test that payment data has all fields needed for edit modal"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=1")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data['payments']) > 0:
            payment = data['payments'][0]
            
            # Fields needed for Edit Modal
            required_fields = ['payment_id', 'user_id']
            for field in required_fields:
                assert field in payment, f"Missing field: {field}"
            
            # Plan-related fields (at least one should exist)
            plan_fields = ['plan', 'subscription_plan']
            has_plan = any(field in payment for field in plan_fields)
            assert has_plan, f"Missing plan field. Available: {list(payment.keys())}"
            
            # Duration-related fields (at least one should exist)
            duration_fields = ['duration', 'plan_type']
            has_duration = any(field in payment for field in duration_fields)
            assert has_duration, f"Missing duration field"
            
            # Amount field
            assert 'amount' in payment, "Missing amount field"


class TestAdminSubscriptionEditValidation:
    """Tests for validation of edit input values"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get a payment for testing"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=1")
        data = response.json()
        if data.get('payments'):
            self.payment_id = data['payments'][0]['payment_id']
        else:
            pytest.skip("No approved payments available for testing")
    
    def test_edit_with_valid_plans(self):
        """Test editing with all valid plan values"""
        valid_plans = ['startup', 'growth', 'elite']
        
        for plan in valid_plans:
            response = requests.put(
                f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
                json={"plan": plan, "admin_id": f"test-plan-{plan}"}
            )
            assert response.status_code == 200, f"Failed for plan: {plan}"
    
    def test_edit_with_valid_durations(self):
        """Test editing with all valid duration values"""
        valid_durations = ['monthly', 'quarterly', 'half_yearly', 'yearly']
        
        for duration in valid_durations:
            response = requests.put(
                f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
                json={"duration": duration, "admin_id": f"test-duration-{duration}"}
            )
            assert response.status_code == 200, f"Failed for duration: {duration}"
    
    def test_edit_with_date_format(self):
        """Test editing with different date formats"""
        # Standard date format
        response = requests.put(
            f"{BASE_URL}/api/admin/vip-payments/{self.payment_id}",
            json={"expires_at": "2027-06-15", "admin_id": "test-date-1"}
        )
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
