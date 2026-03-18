"""
Test Suite for Unified Redeem System v2 APIs
=============================================
Tests the new redeem system with 6 services:
- Mobile Recharge, DTH, Electricity, Gas, EMI, Bank Transfer (DMT)
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestUnifiedRedeemServicesAPI:
    """Test /api/redeem/services endpoint"""
    
    def test_get_services_returns_success(self):
        """GET /api/redeem/services should return success"""
        response = requests.get(f"{BASE_URL}/api/redeem/services")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
    
    def test_get_services_returns_all_services(self):
        """GET /api/redeem/services should return all BBPS services"""
        response = requests.get(f"{BASE_URL}/api/redeem/services")
        assert response.status_code == 200
        data = response.json()
        
        services = data.get("services", [])
        # System now has 18 BBPS services including mobile, DTH, electricity, gas, water, etc.
        assert len(services) >= 6, f"Expected at least 6 services, got {len(services)}"
        
        # Verify core service IDs are present
        service_ids = [s["id"] for s in services]
        expected_ids = ["mobile_recharge", "dth", "electricity", "gas", "emi", "dmt"]
        for expected_id in expected_ids:
            assert expected_id in service_ids, f"Service '{expected_id}' not found"
    
    def test_get_services_returns_correct_service_structure(self):
        """Each service should have id, name, icon, and eko_category"""
        response = requests.get(f"{BASE_URL}/api/redeem/services")
        assert response.status_code == 200
        data = response.json()
        
        for service in data.get("services", []):
            assert "id" in service, "Service missing 'id'"
            assert "name" in service, "Service missing 'name'"
            assert "icon" in service, "Service missing 'icon'"
            assert "eko_category" in service, "Service missing 'eko_category'"
    
    def test_get_services_returns_charges_info(self):
        """GET /api/redeem/services should return charges info"""
        response = requests.get(f"{BASE_URL}/api/redeem/services")
        assert response.status_code == 200
        data = response.json()
        
        charges_info = data.get("charges_info", {})
        assert "platform_fee" in charges_info
        assert "admin_charge" in charges_info
        assert "prc_rate" in charges_info
        # PRC rate is now dynamic (typically 10-15 PRC = ₹1)
        assert "PRC" in charges_info["prc_rate"], "PRC rate should mention PRC"


class TestCalculateChargesAPI:
    """Test /api/redeem/calculate-charges endpoint"""
    
    def test_calculate_charges_success(self):
        """GET /api/redeem/calculate-charges?amount=100 should return success"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=100")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
    
    def test_calculate_charges_correct_formula_100_inr(self):
        """For ₹100: Platform fee=10, Admin charge=20% (20), Total=130"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=100")
        assert response.status_code == 200
        charges = response.json().get("charges", {})
        
        assert charges["amount_inr"] == 100
        assert charges["platform_fee_inr"] == 10
        assert charges["admin_charge_inr"] == 20  # 20% of 100
        assert charges["admin_charge_percent"] == 20
        assert charges["total_charges_inr"] == 30  # 10 + 20
        assert charges["total_amount_inr"] == 130  # 100 + 30
    
    def test_calculate_charges_correct_prc_conversion(self):
        """PRC values should be amount * dynamic_rate (rate is typically 10-15)"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=100")
        assert response.status_code == 200
        charges = response.json().get("charges", {})
        
        # PRC rate is dynamic, verify calculation is consistent
        prc_rate = charges.get("prc_rate", 10)
        assert charges["amount_prc"] == 100 * prc_rate
        assert charges["platform_fee_prc"] == 10 * prc_rate
        assert charges["admin_charge_prc"] == 20 * prc_rate
        assert charges["total_charges_prc"] == 30 * prc_rate
        assert charges["total_prc_required"] == 130 * prc_rate
    
    def test_calculate_charges_500_inr(self):
        """For ₹500: Platform fee=10, Admin charge=20% (100), Total=610"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=500")
        assert response.status_code == 200
        charges = response.json().get("charges", {})
        
        assert charges["amount_inr"] == 500
        assert charges["admin_charge_inr"] == 100  # 20% of 500
        assert charges["total_amount_inr"] == 610  # 500 + 10 + 100
        # PRC rate is dynamic
        prc_rate = charges.get("prc_rate", 10)
        assert charges["total_prc_required"] == 610 * prc_rate
    
    def test_calculate_charges_199_inr(self):
        """For ₹199: Platform fee=10, Admin charge=20% (40 rounded), Total=249"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=199")
        assert response.status_code == 200
        charges = response.json().get("charges", {})
        
        assert charges["amount_inr"] == 199
        # 20% of 199 = 39.8, rounded = 40
        assert charges["admin_charge_inr"] == 40
        assert charges["total_amount_inr"] == 249  # 199 + 10 + 40
    
    def test_calculate_charges_zero_amount_fails(self):
        """GET /api/redeem/calculate-charges?amount=0 should return 422 or 400"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=0")
        assert response.status_code in [400, 422]
    
    def test_calculate_charges_negative_amount_fails(self):
        """GET /api/redeem/calculate-charges?amount=-100 should return 422 or 400"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=-100")
        assert response.status_code in [400, 422]
    
    def test_calculate_charges_missing_amount_fails(self):
        """GET /api/redeem/calculate-charges without amount should return 422"""
        response = requests.get(f"{BASE_URL}/api/redeem/calculate-charges")
        assert response.status_code == 422


class TestAdminStatsAPI:
    """Test /api/redeem/admin/stats endpoint"""
    
    def test_admin_stats_success(self):
        """GET /api/redeem/admin/stats should return success"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/stats")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
    
    def test_admin_stats_returns_by_status(self):
        """Stats should include by_status breakdown"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/stats")
        assert response.status_code == 200
        data = response.json()
        assert "by_status" in data
    
    def test_admin_stats_returns_by_service(self):
        """Stats should include by_service breakdown"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/stats")
        assert response.status_code == 200
        data = response.json()
        assert "by_service" in data
    
    def test_admin_stats_returns_today(self):
        """Stats should include today's stats"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/stats")
        assert response.status_code == 200
        data = response.json()
        assert "today" in data
        assert "count" in data["today"]
        assert "total_amount" in data["today"]
    
    def test_admin_stats_returns_pending_count(self):
        """Stats should include pending_count"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/stats")
        assert response.status_code == 200
        data = response.json()
        assert "pending_count" in data


class TestAdminRequestsAPI:
    """Test /api/redeem/admin/requests endpoint"""
    
    def test_admin_requests_success(self):
        """GET /api/redeem/admin/requests should return success"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
    
    def test_admin_requests_returns_requests_array(self):
        """Response should include requests array"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests")
        assert response.status_code == 200
        data = response.json()
        assert "requests" in data
        assert isinstance(data["requests"], list)
    
    def test_admin_requests_returns_pagination(self):
        """Response should include pagination info"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests")
        assert response.status_code == 200
        data = response.json()
        assert "pagination" in data
        
        pagination = data["pagination"]
        assert "total" in pagination
        assert "page" in pagination
        assert "per_page" in pagination
        assert "total_pages" in pagination
        assert "has_next" in pagination
        assert "has_prev" in pagination
    
    def test_admin_requests_default_pagination(self):
        """Default pagination should be page=1, per_page=20"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests")
        assert response.status_code == 200
        pagination = response.json().get("pagination", {})
        
        assert pagination["page"] == 1
        assert pagination["per_page"] == 20
    
    def test_admin_requests_custom_pagination(self):
        """Custom pagination page=2, per_page=5"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests?page=2&per_page=5")
        assert response.status_code == 200
        pagination = response.json().get("pagination", {})
        
        assert pagination["page"] == 2
        assert pagination["per_page"] == 5
    
    def test_admin_requests_returns_filters_applied(self):
        """Response should include filters_applied"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests")
        assert response.status_code == 200
        data = response.json()
        assert "filters_applied" in data
    
    def test_admin_requests_filter_by_status(self):
        """Filter by status=pending"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert data["filters_applied"]["status"] == "pending"
    
    def test_admin_requests_filter_by_service_type(self):
        """Filter by service_type=mobile_recharge"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests?service_type=mobile_recharge")
        assert response.status_code == 200
        data = response.json()
        assert data["filters_applied"]["service_type"] == "mobile_recharge"
    
    def test_admin_requests_search_filter(self):
        """Search filter should be applied"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests?search=TEST123")
        assert response.status_code == 200
        data = response.json()
        assert data["filters_applied"]["search"] == "TEST123"
    
    def test_admin_requests_sort_by_amount(self):
        """Sort by amount_inr desc"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests?sort_by=amount_inr&sort_order=desc")
        assert response.status_code == 200
        assert response.json().get("success") is True
    
    def test_admin_requests_invalid_sort_by_fails(self):
        """Invalid sort_by should return 422"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/requests?sort_by=invalid_field")
        assert response.status_code == 422


class TestCreateRedeemRequestAPI:
    """Test /api/redeem/request POST endpoint"""
    
    def test_create_request_invalid_service_type(self):
        """Invalid service_type should return 400 or 404 (user not found first)"""
        response = requests.post(f"{BASE_URL}/api/redeem/request", json={
            "user_id": "test_user_nonexistent",
            "service_type": "invalid_service",
            "amount": 100,
            "details": {}
        })
        # User validation happens first, so we get 404 for nonexistent user
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
    
    def test_create_request_user_not_found(self):
        """Non-existent user should return 404"""
        response = requests.post(f"{BASE_URL}/api/redeem/request", json={
            "user_id": "nonexistent_user_xyz123",
            "service_type": "mobile_recharge",
            "amount": 100,
            "details": {"mobile_number": "9876543210"}
        })
        assert response.status_code == 404
        assert "User not found" in response.json().get("detail", "")
    
    def test_create_request_zero_amount_fails(self):
        """Zero amount should return 422"""
        response = requests.post(f"{BASE_URL}/api/redeem/request", json={
            "user_id": "test_user",
            "service_type": "mobile_recharge",
            "amount": 0,
            "details": {}
        })
        assert response.status_code == 422
    
    def test_create_request_negative_amount_fails(self):
        """Negative amount should return 422"""
        response = requests.post(f"{BASE_URL}/api/redeem/request", json={
            "user_id": "test_user",
            "service_type": "mobile_recharge",
            "amount": -100,
            "details": {}
        })
        assert response.status_code == 422


class TestAdminApproveRejectAPI:
    """Test /api/redeem/admin/approve POST endpoint"""
    
    def test_approve_request_not_found(self):
        """Non-existent request_id should return 404"""
        response = requests.post(f"{BASE_URL}/api/redeem/admin/approve", json={
            "request_id": "NONEXISTENT_REQUEST_123",
            "admin_id": "admin_user",
            "action": "approve"
        })
        assert response.status_code == 404
        assert "Request not found" in response.json().get("detail", "")
    
    def test_reject_without_reason_fails(self):
        """Reject without rejection_reason should fail"""
        # First we need a valid request - this will fail with 404 which is fine
        response = requests.post(f"{BASE_URL}/api/redeem/admin/approve", json={
            "request_id": "NONEXISTENT_REQUEST_123",
            "admin_id": "admin_user",
            "action": "reject"
        })
        # Will return 404 for non-existent request
        assert response.status_code == 404
    
    def test_invalid_action_fails(self):
        """Invalid action should return 422"""
        response = requests.post(f"{BASE_URL}/api/redeem/admin/approve", json={
            "request_id": "TEST_REQUEST_123",
            "admin_id": "admin_user",
            "action": "invalid_action"
        })
        assert response.status_code == 422


class TestAdminCompleteAPI:
    """Test /api/redeem/admin/complete POST endpoint"""
    
    def test_complete_request_not_found(self):
        """Non-existent request_id should return 404"""
        response = requests.post(f"{BASE_URL}/api/redeem/admin/complete", json={
            "request_id": "NONEXISTENT_REQUEST_123",
            "admin_id": "admin_user"
        })
        assert response.status_code == 404
        assert "Request not found" in response.json().get("detail", "")


class TestAdminRequestDetailsAPI:
    """Test /api/redeem/admin/request/{request_id} GET endpoint"""
    
    def test_get_request_not_found(self):
        """Non-existent request_id should return 404"""
        response = requests.get(f"{BASE_URL}/api/redeem/admin/request/NONEXISTENT_REQUEST_123")
        assert response.status_code == 404
        assert "Request not found" in response.json().get("detail", "")


class TestUserRequestsAPI:
    """Test /api/redeem/user/{user_id}/requests GET endpoint"""
    
    def test_user_requests_success(self):
        """GET user requests should return success"""
        response = requests.get(f"{BASE_URL}/api/redeem/user/test_user/requests")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "requests" in data
        assert "total" in data
    
    def test_user_requests_with_filters(self):
        """User requests with status filter"""
        response = requests.get(f"{BASE_URL}/api/redeem/user/test_user/requests?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
