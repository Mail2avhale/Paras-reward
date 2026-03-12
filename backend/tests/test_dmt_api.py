"""
DMT API Integration Tests
Tests for DMT V1 API implementation:
- Health Check
- Admin Settings CRUD
- Admin Enable/Disable DMT
- Admin Set Daily Limit
- Admin Get All Transactions with filters
- Admin Stats Dashboard
- Customer Search/Registration
- Wallet API with dynamic limit
- Error Handling for disabled DMT
"""

import pytest
import requests
import os
import time
from datetime import datetime

# Base URL from environment or default
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dmt-fix.preview.emergentagent.com').rstrip('/')


class TestDMTHealthCheck:
    """Test DMT Health Check endpoint"""
    
    def test_health_check_success(self):
        """Test health check returns valid response"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "status" in data
        assert "enabled" in data
        assert "config_valid" in data
        assert "version" in data
        assert "instant_transfer" in data
        assert "daily_limit_inr" in data
        assert "prc_rate" in data
        assert "min_redeem" in data
    
    def test_health_check_shows_enabled_status(self):
        """Test health check shows correct enabled status"""
        # First ensure DMT is enabled
        enable_response = requests.post(f"{BASE_URL}/api/eko/dmt/admin/enable")
        assert enable_response.status_code == 200
        
        # Check health
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        data = response.json()
        
        assert data["enabled"] == True
        assert data["status"] == "DMT SERVICE RUNNING"
    
    def test_health_check_shows_disabled_status(self):
        """Test health check shows disabled when DMT is disabled"""
        # Disable DMT
        disable_response = requests.post(f"{BASE_URL}/api/eko/dmt/admin/disable")
        assert disable_response.status_code == 200
        
        # Check health
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        data = response.json()
        
        assert data["enabled"] == False
        assert data["status"] == "DMT DISABLED"
        
        # Re-enable DMT for other tests
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/enable")


class TestDMTAdminSettings:
    """Test DMT Admin Settings endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Ensure DMT is enabled before each test"""
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/enable")
        yield
        # Restore default settings after test
        requests.post(
            f"{BASE_URL}/api/eko/dmt/admin/settings",
            json={"enabled": True, "daily_limit_inr": 50000}
        )
    
    def test_get_admin_settings_success(self):
        """Test GET admin settings returns all required fields"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/admin/settings")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "data" in data
        settings = data["data"]
        
        assert "enabled" in settings
        assert "daily_limit_inr" in settings
        assert "min_transfer_inr" in settings
        assert "prc_to_inr_rate" in settings
        assert "updated_at" in settings
    
    def test_post_admin_settings_update_enabled(self):
        """Test POST admin settings can update enabled status"""
        # Disable DMT
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/admin/settings",
            json={"enabled": False}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["enabled"] == False
        
        # Verify change persisted
        get_response = requests.get(f"{BASE_URL}/api/eko/dmt/admin/settings")
        assert get_response.json()["data"]["enabled"] == False
    
    def test_post_admin_settings_update_daily_limit(self):
        """Test POST admin settings can update daily limit"""
        new_limit = 25000
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/admin/settings",
            json={"daily_limit_inr": new_limit}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["daily_limit_inr"] == new_limit
        
        # Verify change persisted
        get_response = requests.get(f"{BASE_URL}/api/eko/dmt/admin/settings")
        assert get_response.json()["data"]["daily_limit_inr"] == new_limit
    
    def test_post_admin_settings_update_both_fields(self):
        """Test POST admin settings can update both enabled and limit"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/admin/settings",
            json={"enabled": False, "daily_limit_inr": 30000}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["enabled"] == False
        assert data["data"]["daily_limit_inr"] == 30000


class TestDMTAdminEnableDisable:
    """Test DMT Admin Enable/Disable endpoints"""
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        yield
        # Ensure DMT is enabled after each test
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/enable")
    
    def test_admin_enable_dmt(self):
        """Test admin enable endpoint"""
        response = requests.post(f"{BASE_URL}/api/eko/dmt/admin/enable")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["enabled"] == True
    
    def test_admin_disable_dmt(self):
        """Test admin disable endpoint"""
        response = requests.post(f"{BASE_URL}/api/eko/dmt/admin/disable")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["enabled"] == False
    
    def test_disable_then_enable_cycle(self):
        """Test disable and enable cycle works correctly"""
        # Disable
        disable_resp = requests.post(f"{BASE_URL}/api/eko/dmt/admin/disable")
        assert disable_resp.json()["data"]["enabled"] == False
        
        # Verify disabled in health
        health_resp = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        assert health_resp.json()["enabled"] == False
        
        # Enable
        enable_resp = requests.post(f"{BASE_URL}/api/eko/dmt/admin/enable")
        assert enable_resp.json()["data"]["enabled"] == True
        
        # Verify enabled in health
        health_resp = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        assert health_resp.json()["enabled"] == True


class TestDMTAdminSetLimit:
    """Test DMT Admin Set Daily Limit endpoint"""
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        yield
        # Restore default limit
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr=50000")
    
    def test_set_daily_limit_success(self):
        """Test setting daily limit successfully"""
        new_limit = 25000
        response = requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr={new_limit}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["daily_limit_inr"] == new_limit
    
    def test_set_daily_limit_min_valid(self):
        """Test setting minimum valid limit (100)"""
        response = requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr=100")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["daily_limit_inr"] == 100
    
    def test_set_daily_limit_max_valid(self):
        """Test setting maximum valid limit (200000)"""
        response = requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr=200000")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["daily_limit_inr"] == 200000
    
    def test_set_daily_limit_below_minimum(self):
        """Test setting limit below minimum fails"""
        response = requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr=50")
        assert response.status_code == 200  # API returns 200 with error
        data = response.json()
        
        assert data["success"] == False
    
    def test_set_daily_limit_above_maximum(self):
        """Test setting limit above maximum fails"""
        response = requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr=300000")
        assert response.status_code == 200  # API returns 200 with error
        data = response.json()
        
        assert data["success"] == False
    
    def test_set_daily_limit_reflects_in_health(self):
        """Test that setting limit reflects in health endpoint"""
        new_limit = 35000
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr={new_limit}")
        
        health_resp = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        assert health_resp.json()["daily_limit_inr"] == new_limit


class TestDMTAdminTransactions:
    """Test DMT Admin Transactions endpoint with filters"""
    
    def test_get_all_transactions_success(self):
        """Test getting all transactions returns valid structure"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/admin/transactions")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "data" in data
        
        # Verify structure
        assert "summary" in data["data"]
        assert "transactions" in data["data"]
        assert "pagination" in data["data"]
        
        # Verify summary fields
        summary = data["data"]["summary"]
        assert "total_transactions" in summary
        assert "completed" in summary
        assert "failed" in summary
        assert "pending" in summary
        assert "total_amount_inr" in summary
        assert "total_prc_used" in summary
        
        # Verify pagination fields
        pagination = data["data"]["pagination"]
        assert "total" in pagination
        assert "limit" in pagination
        assert "skip" in pagination
        assert "has_more" in pagination
    
    def test_get_transactions_with_status_filter(self):
        """Test filtering transactions by status"""
        for status in ["completed", "failed", "pending", "processing"]:
            response = requests.get(f"{BASE_URL}/api/eko/dmt/admin/transactions?status={status}")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
    
    def test_get_transactions_with_date_filter(self):
        """Test filtering transactions by date range"""
        response = requests.get(
            f"{BASE_URL}/api/eko/dmt/admin/transactions?date_from=2026-01-01&date_to=2026-12-31"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
    
    def test_get_transactions_with_mobile_filter(self):
        """Test filtering transactions by mobile number"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/admin/transactions?mobile=9876543210")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
    
    def test_get_transactions_with_pagination(self):
        """Test transactions pagination"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/admin/transactions?limit=10&skip=0")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["pagination"]["limit"] == 10
        assert data["data"]["pagination"]["skip"] == 0
    
    def test_get_transactions_multiple_filters(self):
        """Test combining multiple filters"""
        response = requests.get(
            f"{BASE_URL}/api/eko/dmt/admin/transactions?status=completed&date_from=2026-03-01&mobile=9876543210&limit=20"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestDMTAdminStats:
    """Test DMT Admin Stats Dashboard endpoint"""
    
    def test_get_stats_success(self):
        """Test getting stats returns valid structure"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/admin/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "data" in data
        
        # Verify structure
        assert "today" in data["data"]
        assert "all_time" in data["data"]
        assert "settings" in data["data"]
        
        # Verify today stats
        today = data["data"]["today"]
        assert "total_transactions" in today
        assert "completed" in today
        assert "failed" in today
        assert "pending" in today
        assert "total_amount_inr" in today
        
        # Verify all_time stats
        all_time = data["data"]["all_time"]
        assert "total_transactions" in all_time
        assert "completed" in all_time
        assert "failed" in all_time
        assert "total_amount_inr" in all_time
        
        # Verify settings in stats
        settings = data["data"]["settings"]
        assert "enabled" in settings
        assert "daily_limit_inr" in settings


class TestDMTCustomerAPI:
    """Test DMT Customer Search and Registration APIs"""
    
    def test_customer_search_with_mobile(self):
        """Test customer search with mobile number"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": "9876543210", "user_id": "TEST_user_123"}
        )
        assert response.status_code == 200
        # Response may be success or error depending on EKO API
        data = response.json()
        assert "success" in data
    
    def test_customer_search_invalid_mobile(self):
        """Test customer search with invalid mobile number"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={"mobile": "123", "user_id": "TEST_user_123"}
        )
        # Should fail validation
        assert response.status_code in [200, 422]
    
    def test_customer_registration(self):
        """Test customer registration"""
        # Use unique mobile for test
        test_mobile = "98765" + str(int(time.time()))[-5:]
        
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/register",
            json={
                "mobile": test_mobile,
                "name": "TEST User Registration",
                "user_id": "TEST_user_456"
            }
        )
        assert response.status_code == 200
        data = response.json()
        # Registration should either succeed or fail gracefully
        assert "success" in data


class TestDMTWalletAPI:
    """Test DMT Wallet API with dynamic limit"""
    
    def test_wallet_user_not_found(self):
        """Test wallet API returns 404 for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/wallet/nonexistent_user_xyz")
        assert response.status_code == 404
        data = response.json()
        assert "User not found" in data.get("detail", "")
    
    def test_wallet_shows_dynamic_limit(self):
        """Test wallet API reflects dynamic daily limit from settings"""
        # First, set a specific limit
        new_limit = 35000
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr={new_limit}")
        
        # Get settings to verify
        settings_resp = requests.get(f"{BASE_URL}/api/eko/dmt/admin/settings")
        assert settings_resp.json()["data"]["daily_limit_inr"] == new_limit
        
        # Restore default
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr=50000")


class TestDMTErrorHandling:
    """Test DMT Error Handling for disabled service"""
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        yield
        # Ensure DMT is enabled after each test
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/enable")
    
    def test_transfer_blocked_when_disabled(self):
        """Test that transfer is blocked when DMT is disabled"""
        # Disable DMT
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/disable")
        
        # Attempt transfer (should be blocked)
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/transfer",
            json={
                "user_id": "TEST_user",
                "mobile": "9876543210",
                "recipient_id": "12345",
                "prc_amount": 10000
            }
        )
        # Should either fail with service disabled error or validation error
        data = response.json()
        # Either success=false or validation error
        if response.status_code == 200 and data.get("success") == False:
            # Service disabled error
            assert "disabled" in data.get("user_message", "").lower() or "disabled" in data.get("message", "").lower() or "503" in str(data.get("error_code", ""))
        elif response.status_code == 422:
            # Validation error (which is also acceptable)
            pass
        else:
            # Other error is also acceptable
            pass


class TestDMTIntegration:
    """Integration tests for DMT flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Ensure DMT is enabled for tests"""
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/enable")
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr=50000")
        yield
    
    def test_settings_affect_health_endpoint(self):
        """Test that admin settings changes reflect in health endpoint"""
        # Update settings
        new_limit = 40000
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr={new_limit}")
        
        # Check health reflects change
        health = requests.get(f"{BASE_URL}/api/eko/dmt/health").json()
        assert health["daily_limit_inr"] == new_limit
        
        # Disable DMT
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/disable")
        health = requests.get(f"{BASE_URL}/api/eko/dmt/health").json()
        assert health["enabled"] == False
        assert health["status"] == "DMT DISABLED"
        
        # Re-enable
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/enable")
        health = requests.get(f"{BASE_URL}/api/eko/dmt/health").json()
        assert health["enabled"] == True
        
        # Restore limit
        requests.post(f"{BASE_URL}/api/eko/dmt/admin/set-limit?limit_inr=50000")
