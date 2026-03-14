"""
DMT Global Limits API Tests
============================
Tests for the new DMT V3 Limits Management features:
- GET /api/admin/dmt-limits - Get global DMT limits
- PUT /api/admin/dmt-limits - Update global DMT limits
- GET /api/admin/user/{user_id}/dmt-usage - Get user's DMT usage
- POST /api/admin/service-toggles/dmt - Enable/Disable DMT service
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fund-transfer-app-4.preview.emergentagent.com').rstrip('/')

# Test credentials from request
EKO_DEVELOPER_KEY = "7c179a397b4710e71b2248d1f5892d19"
EKO_USER_CODE = "19560001"
TEST_MOBILE = "9421331342"


class TestDMTLimitsAPI:
    """Test DMT Global Limits API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup and teardown for each test"""
        # Store original limits before test
        response = requests.get(f"{BASE_URL}/api/admin/dmt-limits")
        self.original_limits = response.json().get('limits', {}) if response.ok else {}
        
        yield
        
        # Restore original limits after test
        if self.original_limits:
            requests.put(f"{BASE_URL}/api/admin/dmt-limits", json=self.original_limits)
    
    def test_get_dmt_limits_returns_success(self):
        """GET /api/admin/dmt-limits returns success"""
        response = requests.get(f"{BASE_URL}/api/admin/dmt-limits")
        assert response.status_code == 200
        
        data = response.json()
        assert data['success'] is True
        assert 'limits' in data
    
    def test_get_dmt_limits_has_all_required_fields(self):
        """GET /api/admin/dmt-limits returns all required limit fields"""
        response = requests.get(f"{BASE_URL}/api/admin/dmt-limits")
        data = response.json()
        
        limits = data['limits']
        required_fields = ['daily_limit', 'weekly_limit', 'monthly_limit', 'per_txn_limit', 'min_amount']
        
        for field in required_fields:
            assert field in limits, f"Missing field: {field}"
            assert isinstance(limits[field], int), f"Field {field} should be int"
    
    def test_get_dmt_limits_returns_valid_values(self):
        """GET /api/admin/dmt-limits returns valid limit values"""
        response = requests.get(f"{BASE_URL}/api/admin/dmt-limits")
        data = response.json()
        limits = data['limits']
        
        # All limits should be positive
        assert limits['daily_limit'] > 0
        assert limits['weekly_limit'] > 0
        assert limits['monthly_limit'] > 0
        assert limits['per_txn_limit'] > 0
        assert limits['min_amount'] > 0
        
        # Hierarchy should be: per_txn <= daily <= weekly <= monthly
        assert limits['per_txn_limit'] <= limits['daily_limit']
        assert limits['daily_limit'] <= limits['weekly_limit']
        assert limits['weekly_limit'] <= limits['monthly_limit']
    
    def test_update_dmt_limits_success(self):
        """PUT /api/admin/dmt-limits successfully updates limits"""
        new_limits = {
            "daily_limit": 30000,
            "weekly_limit": 120000,
            "monthly_limit": 250000,
            "per_txn_limit": 20000,
            "min_amount": 200,
            "admin_id": "test_admin"
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/dmt-limits", json=new_limits)
        assert response.status_code == 200
        
        data = response.json()
        assert data['success'] is True
        assert data['message'] == "DMT limits updated successfully"
        assert data['limits']['daily_limit'] == 30000
        assert data['limits']['weekly_limit'] == 120000
        assert data['limits']['monthly_limit'] == 250000
    
    def test_update_dmt_limits_persists(self):
        """PUT /api/admin/dmt-limits changes persist to GET"""
        new_limits = {
            "daily_limit": 35000,
            "weekly_limit": 140000,
            "monthly_limit": 280000,
            "per_txn_limit": 25000,
            "min_amount": 150,
            "admin_id": "test_admin"
        }
        
        # Update limits
        update_response = requests.put(f"{BASE_URL}/api/admin/dmt-limits", json=new_limits)
        assert update_response.status_code == 200
        
        # Verify via GET
        get_response = requests.get(f"{BASE_URL}/api/admin/dmt-limits")
        data = get_response.json()
        
        assert data['limits']['daily_limit'] == 35000
        assert data['limits']['weekly_limit'] == 140000
        assert data['limits']['monthly_limit'] == 280000
        assert data['limits']['per_txn_limit'] == 25000
        assert data['limits']['min_amount'] == 150
    
    def test_update_dmt_limits_validation_daily_exceeds_weekly(self):
        """PUT /api/admin/dmt-limits rejects daily > weekly"""
        invalid_limits = {
            "daily_limit": 200000,
            "weekly_limit": 100000,
            "monthly_limit": 300000,
            "per_txn_limit": 25000,
            "min_amount": 100
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/dmt-limits", json=invalid_limits)
        assert response.status_code == 400
        assert "Daily limit cannot exceed weekly limit" in response.json().get('detail', '')
    
    def test_update_dmt_limits_validation_weekly_exceeds_monthly(self):
        """PUT /api/admin/dmt-limits rejects weekly > monthly"""
        invalid_limits = {
            "daily_limit": 20000,
            "weekly_limit": 500000,
            "monthly_limit": 200000,
            "per_txn_limit": 15000,
            "min_amount": 100
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/dmt-limits", json=invalid_limits)
        assert response.status_code == 400
        assert "Weekly limit cannot exceed monthly limit" in response.json().get('detail', '')
    
    def test_update_dmt_limits_validation_per_txn_exceeds_daily(self):
        """PUT /api/admin/dmt-limits rejects per_txn > daily"""
        invalid_limits = {
            "daily_limit": 20000,
            "weekly_limit": 100000,
            "monthly_limit": 200000,
            "per_txn_limit": 50000,  # > daily_limit
            "min_amount": 100
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/dmt-limits", json=invalid_limits)
        assert response.status_code == 400
        assert "Per transaction limit cannot exceed daily limit" in response.json().get('detail', '')
    
    def test_update_dmt_limits_records_admin_id(self):
        """PUT /api/admin/dmt-limits records admin_id in updated_by"""
        new_limits = {
            "daily_limit": 25000,
            "weekly_limit": 100000,
            "monthly_limit": 200000,
            "per_txn_limit": 25000,
            "min_amount": 100,
            "admin_id": "test_admin_xyz"
        }
        
        requests.put(f"{BASE_URL}/api/admin/dmt-limits", json=new_limits)
        
        # Verify admin_id recorded
        get_response = requests.get(f"{BASE_URL}/api/admin/dmt-limits")
        data = get_response.json()
        
        assert data['limits'].get('updated_by') == "test_admin_xyz"
        assert 'updated_at' in data['limits']


class TestUserDMTUsageAPI:
    """Test User DMT Usage API endpoint"""
    
    def test_get_user_dmt_usage_returns_success(self):
        """GET /api/admin/user/{user_id}/dmt-usage returns success"""
        test_user_id = f"test_user_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(f"{BASE_URL}/api/admin/user/{test_user_id}/dmt-usage")
        assert response.status_code == 200
        
        data = response.json()
        assert data['success'] is True
        assert data['user_id'] == test_user_id
    
    def test_get_user_dmt_usage_has_all_usage_fields(self):
        """GET /api/admin/user/{user_id}/dmt-usage returns daily/weekly/monthly usage"""
        test_user_id = "test_user_123"
        
        response = requests.get(f"{BASE_URL}/api/admin/user/{test_user_id}/dmt-usage")
        data = response.json()
        
        usage = data['usage']
        
        # Daily usage
        assert 'daily' in usage
        assert 'used' in usage['daily']
        assert 'limit' in usage['daily']
        assert 'remaining' in usage['daily']
        assert 'count' in usage['daily']
        
        # Weekly usage
        assert 'weekly' in usage
        assert 'used' in usage['weekly']
        assert 'limit' in usage['weekly']
        assert 'remaining' in usage['weekly']
        assert 'count' in usage['weekly']
        
        # Monthly usage
        assert 'monthly' in usage
        assert 'used' in usage['monthly']
        assert 'limit' in usage['monthly']
        assert 'remaining' in usage['monthly']
        assert 'count' in usage['monthly']
    
    def test_get_user_dmt_usage_has_limit_fields(self):
        """GET /api/admin/user/{user_id}/dmt-usage returns per_txn and min limits"""
        test_user_id = "test_user_abc"
        
        response = requests.get(f"{BASE_URL}/api/admin/user/{test_user_id}/dmt-usage")
        data = response.json()
        
        assert 'limits' in data
        assert 'per_txn_limit' in data['limits']
        assert 'min_amount' in data['limits']
    
    def test_get_user_dmt_usage_reflects_global_limits(self):
        """User usage endpoint reflects global DMT limits"""
        # First, get current global limits
        limits_response = requests.get(f"{BASE_URL}/api/admin/dmt-limits")
        global_limits = limits_response.json()['limits']
        
        # Get user usage
        test_user_id = "test_user_limits_check"
        usage_response = requests.get(f"{BASE_URL}/api/admin/user/{test_user_id}/dmt-usage")
        data = usage_response.json()
        
        # User limits should match global limits
        assert data['usage']['daily']['limit'] == global_limits['daily_limit']
        assert data['usage']['weekly']['limit'] == global_limits['weekly_limit']
        assert data['usage']['monthly']['limit'] == global_limits['monthly_limit']
    
    def test_new_user_has_zero_usage(self):
        """New user should have zero usage"""
        test_user_id = f"brand_new_user_{uuid.uuid4().hex[:12]}"
        
        response = requests.get(f"{BASE_URL}/api/admin/user/{test_user_id}/dmt-usage")
        data = response.json()
        
        assert data['usage']['daily']['used'] == 0
        assert data['usage']['weekly']['used'] == 0
        assert data['usage']['monthly']['used'] == 0
        assert data['usage']['daily']['count'] == 0


class TestDMTServiceToggleAPI:
    """Test DMT Service Toggle API endpoint"""
    
    @pytest.fixture(autouse=True)
    def ensure_dmt_enabled(self):
        """Ensure DMT is enabled after each test"""
        yield
        # Re-enable DMT after test
        requests.post(
            f"{BASE_URL}/api/admin/service-toggles/dmt",
            json={"enabled": True, "admin_id": "test_cleanup"}
        )
    
    def test_enable_dmt_service(self):
        """POST /api/admin/service-toggles/dmt can enable DMT"""
        response = requests.post(
            f"{BASE_URL}/api/admin/service-toggles/dmt",
            json={"enabled": True, "admin_id": "test_admin"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['service'] == 'dmt'
        assert data['enabled'] is True
    
    def test_disable_dmt_service(self):
        """POST /api/admin/service-toggles/dmt can disable DMT"""
        response = requests.post(
            f"{BASE_URL}/api/admin/service-toggles/dmt",
            json={"enabled": False, "admin_id": "test_admin"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['service'] == 'dmt'
        assert data['enabled'] is False
    
    def test_dmt_toggle_persists_in_service_list(self):
        """DMT toggle change persists in GET /api/admin/service-toggles"""
        # Disable DMT
        requests.post(
            f"{BASE_URL}/api/admin/service-toggles/dmt",
            json={"enabled": False, "admin_id": "test_admin"}
        )
        
        # Verify in service list
        response = requests.get(f"{BASE_URL}/api/admin/service-toggles")
        assert response.status_code == 200
        
        data = response.json()
        dmt_service = data['services'].get('dmt', {})
        assert dmt_service.get('enabled') is False
    
    def test_enable_disable_cycle(self):
        """DMT can be toggled on and off repeatedly"""
        # Disable
        response1 = requests.post(
            f"{BASE_URL}/api/admin/service-toggles/dmt",
            json={"enabled": False, "admin_id": "test_admin"}
        )
        assert response1.json()['enabled'] is False
        
        # Enable
        response2 = requests.post(
            f"{BASE_URL}/api/admin/service-toggles/dmt",
            json={"enabled": True, "admin_id": "test_admin"}
        )
        assert response2.json()['enabled'] is True
        
        # Disable again
        response3 = requests.post(
            f"{BASE_URL}/api/admin/service-toggles/dmt",
            json={"enabled": False, "admin_id": "test_admin"}
        )
        assert response3.json()['enabled'] is False


class TestLevinDMTHealthAPI:
    """Test Levin DMT Health endpoint"""
    
    def test_levin_dmt_health_returns_success(self):
        """GET /api/eko/levin-dmt/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/eko/levin-dmt/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data['status'] == 'healthy'
        assert data['service'] == 'Levin DMT V3'
    
    def test_levin_dmt_health_has_config_fields(self):
        """GET /api/eko/levin-dmt/health returns configuration fields"""
        response = requests.get(f"{BASE_URL}/api/eko/levin-dmt/health")
        data = response.json()
        
        assert 'base_url' in data
        assert 'user_code' in data
        assert 'timestamp' in data
        assert data['user_code'] == EKO_USER_CODE


class TestDMTLimitsIntegration:
    """Integration tests for DMT limits enforcement"""
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup and teardown for integration tests"""
        # Store original limits
        response = requests.get(f"{BASE_URL}/api/admin/dmt-limits")
        self.original_limits = response.json().get('limits', {})
        
        yield
        
        # Restore original limits
        if self.original_limits:
            requests.put(f"{BASE_URL}/api/admin/dmt-limits", json=self.original_limits)
        
        # Ensure DMT is enabled
        requests.post(
            f"{BASE_URL}/api/admin/service-toggles/dmt",
            json={"enabled": True, "admin_id": "test_cleanup"}
        )
    
    def test_limits_change_reflected_in_user_usage(self):
        """Changing global limits reflects in user usage endpoint"""
        # Set new limits
        new_limits = {
            "daily_limit": 40000,
            "weekly_limit": 160000,
            "monthly_limit": 320000,
            "per_txn_limit": 25000,
            "min_amount": 100,
            "admin_id": "test_admin"
        }
        requests.put(f"{BASE_URL}/api/admin/dmt-limits", json=new_limits)
        
        # Check user usage reflects new limits
        test_user_id = "test_user_integration"
        response = requests.get(f"{BASE_URL}/api/admin/user/{test_user_id}/dmt-usage")
        data = response.json()
        
        assert data['usage']['daily']['limit'] == 40000
        assert data['usage']['weekly']['limit'] == 160000
        assert data['usage']['monthly']['limit'] == 320000
    
    def test_user_remaining_equals_limit_for_new_user(self):
        """New user's remaining equals limit (no usage)"""
        test_user_id = f"new_user_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(f"{BASE_URL}/api/admin/user/{test_user_id}/dmt-usage")
        data = response.json()
        
        # For new user: remaining == limit (no usage)
        assert data['usage']['daily']['remaining'] == data['usage']['daily']['limit']
        assert data['usage']['weekly']['remaining'] == data['usage']['weekly']['limit']
        assert data['usage']['monthly']['remaining'] == data['usage']['monthly']['limit']


class TestServiceTogglesListAPI:
    """Test GET /api/admin/service-toggles endpoint"""
    
    def test_get_service_toggles_returns_success(self):
        """GET /api/admin/service-toggles returns service list"""
        response = requests.get(f"{BASE_URL}/api/admin/service-toggles")
        assert response.status_code == 200
        
        data = response.json()
        assert 'services' in data
    
    def test_get_service_toggles_includes_dmt(self):
        """GET /api/admin/service-toggles includes DMT service"""
        response = requests.get(f"{BASE_URL}/api/admin/service-toggles")
        data = response.json()
        
        assert 'dmt' in data['services']
        dmt = data['services']['dmt']
        assert 'name' in dmt
        assert 'enabled' in dmt
        assert 'key' in dmt
        assert dmt['key'] == 'dmt'
    
    def test_service_toggles_dmt_has_correct_name(self):
        """DMT service has correct display name"""
        response = requests.get(f"{BASE_URL}/api/admin/service-toggles")
        data = response.json()
        
        dmt = data['services']['dmt']
        assert 'Money Transfer' in dmt['name'] or 'DMT' in dmt['name']
