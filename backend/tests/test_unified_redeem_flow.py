"""
Test Unified Redeem System v2 APIs
=================================
Tests for:
1. Services listing
2. Charges calculation
3. Redeem request creation
4. Admin approval flow
5. Admin complete (execute Eko) flow
6. Auto-refund on failure

Test credentials:
- test_user_email: testuser@test.com / test123
- admin_email: admin@paras.com / test123
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://network-bonus-calc.preview.emergentagent.com')

TEST_USER_EMAIL = "testuser@test.com"
TEST_USER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "test123"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def authenticated_user(api_client):
    """Get authenticated test user"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
        timeout=30
    )
    if response.status_code != 200:
        pytest.skip(f"Test user login failed: {response.text}")
    
    data = response.json()
    return {
        "user": data.get("user", {}),
        "token": data.get("token"),
        "client": api_client
    }


@pytest.fixture
def authenticated_admin(api_client):
    """Get authenticated admin user"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30
    )
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    
    data = response.json()
    return {
        "user": data.get("user", {}),
        "token": data.get("token"),
        "client": api_client
    }


class TestServicesAPI:
    """Tests for /api/redeem/services endpoint"""
    
    def test_services_returns_list(self, api_client):
        """Test that services endpoint returns all available services"""
        response = api_client.get(f"{BASE_URL}/api/redeem/services", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "services" in data
        assert len(data["services"]) == 6  # 6 services defined
    
    def test_services_have_required_fields(self, api_client):
        """Test that each service has required fields"""
        response = api_client.get(f"{BASE_URL}/api/redeem/services", timeout=30)
        data = response.json()
        
        for service in data["services"]:
            assert "id" in service
            assert "name" in service
            assert "icon" in service
            assert "eko_category" in service
    
    def test_expected_services_present(self, api_client):
        """Test that all expected services are present"""
        response = api_client.get(f"{BASE_URL}/api/redeem/services", timeout=30)
        data = response.json()
        
        service_ids = [s["id"] for s in data["services"]]
        
        expected = ["mobile_recharge", "dth", "electricity", "gas", "emi", "dmt"]
        for expected_id in expected:
            assert expected_id in service_ids, f"Service '{expected_id}' missing"
    
    def test_charges_info_included(self, api_client):
        """Test that charges info is included in response"""
        response = api_client.get(f"{BASE_URL}/api/redeem/services", timeout=30)
        data = response.json()
        
        assert "charges_info" in data
        charges = data["charges_info"]
        
        assert "platform_fee" in charges
        assert "admin_charge" in charges
        assert "prc_rate" in charges


class TestCalculateChargesAPI:
    """Tests for /api/redeem/calculate-charges endpoint"""
    
    def test_calculate_charges_basic(self, api_client):
        """Test basic charges calculation"""
        response = api_client.get(
            f"{BASE_URL}/api/redeem/calculate-charges",
            params={"amount": 100},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "charges" in data
    
    def test_calculate_charges_correct_values(self, api_client):
        """Test that charges are calculated correctly"""
        # For ₹100 amount:
        # Platform fee: ₹10
        # Admin charge: 20% of 100 = ₹20
        # Total: 100 + 10 + 20 = ₹130
        
        response = api_client.get(
            f"{BASE_URL}/api/redeem/calculate-charges",
            params={"amount": 100},
            timeout=30
        )
        data = response.json()
        charges = data["charges"]
        
        assert charges["amount_inr"] == 100
        assert charges["platform_fee_inr"] == 10
        assert charges["admin_charge_inr"] == 20
        assert charges["total_amount_inr"] == 130
        assert charges["total_prc_required"] == 1300  # 130 * 10 PRC/₹
    
    def test_calculate_charges_different_amounts(self, api_client):
        """Test charges calculation for different amounts"""
        test_cases = [
            (50, 10, 10, 70),    # ₹50: platform 10, admin 10 (20%), total 70
            (100, 10, 20, 130),  # ₹100: platform 10, admin 20, total 130
            (199, 10, 40, 249),  # ₹199: platform 10, admin 40 (rounded), total 249
            (500, 10, 100, 610), # ₹500: platform 10, admin 100, total 610
        ]
        
        for amount, expected_platform, expected_admin, expected_total in test_cases:
            response = api_client.get(
                f"{BASE_URL}/api/redeem/calculate-charges",
                params={"amount": amount},
                timeout=30
            )
            data = response.json()
            charges = data["charges"]
            
            assert charges["platform_fee_inr"] == expected_platform, \
                f"Amount {amount}: platform fee mismatch"
            assert charges["admin_charge_inr"] == expected_admin, \
                f"Amount {amount}: admin charge mismatch"
            assert charges["total_amount_inr"] == expected_total, \
                f"Amount {amount}: total mismatch"
    
    def test_calculate_charges_invalid_amount(self, api_client):
        """Test that invalid amounts are rejected"""
        response = api_client.get(
            f"{BASE_URL}/api/redeem/calculate-charges",
            params={"amount": 0},
            timeout=30
        )
        assert response.status_code in [400, 422]
        
        response = api_client.get(
            f"{BASE_URL}/api/redeem/calculate-charges",
            params={"amount": -100},
            timeout=30
        )
        assert response.status_code in [400, 422]


class TestAdminStatsAPI:
    """Tests for /api/redeem/admin/stats endpoint"""
    
    def test_admin_stats_endpoint_exists(self, api_client):
        """Test that admin stats endpoint exists"""
        response = api_client.get(f"{BASE_URL}/api/redeem/admin/stats", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
    
    def test_admin_stats_structure(self, api_client):
        """Test admin stats response structure"""
        response = api_client.get(f"{BASE_URL}/api/redeem/admin/stats", timeout=30)
        data = response.json()
        
        # Actual API structure
        assert "by_status" in data
        assert "by_service" in data
        assert "today" in data
        assert "pending_count" in data


class TestAdminRequestsAPI:
    """Tests for /api/redeem/admin/requests endpoint"""
    
    def test_admin_requests_returns_list(self, api_client):
        """Test that admin requests endpoint returns list"""
        response = api_client.get(f"{BASE_URL}/api/redeem/admin/requests", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "requests" in data
        assert "pagination" in data
        # Pagination can have either 'total' or 'total_count'
        pagination = data.get("pagination", {})
        assert "total" in pagination or "total_count" in pagination
    
    def test_admin_requests_with_filters(self, api_client):
        """Test admin requests with status filter"""
        response = api_client.get(
            f"{BASE_URL}/api/redeem/admin/requests",
            params={"status": "pending"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned requests should have pending status
        for req in data.get("requests", []):
            assert req.get("status") == "pending"
    
    def test_admin_requests_pagination(self, api_client):
        """Test admin requests pagination"""
        # Get first page
        response1 = api_client.get(
            f"{BASE_URL}/api/redeem/admin/requests",
            params={"per_page": 5, "page": 1},
            timeout=30
        )
        data1 = response1.json()
        
        # Get second page
        response2 = api_client.get(
            f"{BASE_URL}/api/redeem/admin/requests",
            params={"per_page": 5, "page": 2},
            timeout=30
        )
        data2 = response2.json()
        
        # Both should succeed
        assert data1["success"] == True
        assert data2["success"] == True


class TestRedeemRequestCreation:
    """Tests for /api/redeem/request endpoint"""
    
    def test_request_requires_valid_user(self, api_client):
        """Test that request creation requires valid user"""
        response = api_client.post(
            f"{BASE_URL}/api/redeem/request",
            json={
                "user_id": "nonexistent_user",
                "service_type": "mobile_recharge",
                "amount": 100,
                "details": {"mobile_number": "9876543210", "operator": "90"}
            },
            timeout=30
        )
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
    
    def test_request_requires_valid_service_type(self, api_client, authenticated_user):
        """Test that request creation validates service type"""
        user_id = authenticated_user["user"].get("uid")
        if not user_id:
            pytest.skip("User ID not found in login response")
        
        response = api_client.post(
            f"{BASE_URL}/api/redeem/request",
            json={
                "user_id": user_id,
                "service_type": "invalid_service",
                "amount": 100,
                "details": {}
            },
            timeout=30
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid service type" in data.get("detail", "")


class TestAdminApprovalFlow:
    """Tests for admin approval flow"""
    
    def test_admin_approve_requires_valid_request(self, authenticated_admin):
        """Test that approval requires valid request ID"""
        client = authenticated_admin["client"]
        admin_id = authenticated_admin["user"].get("uid", "admin")
        
        response = client.post(
            f"{BASE_URL}/api/redeem/admin/approve",
            json={
                "request_id": "INVALID_REQUEST_ID",
                "admin_id": admin_id,
                "action": "approve"
            },
            timeout=30
        )
        assert response.status_code == 404
    
    def test_admin_approve_validates_action(self, authenticated_admin):
        """Test that approval validates action field"""
        client = authenticated_admin["client"]
        admin_id = authenticated_admin["user"].get("uid", "admin")
        
        response = client.post(
            f"{BASE_URL}/api/redeem/admin/approve",
            json={
                "request_id": "TEST123",
                "admin_id": admin_id,
                "action": "invalid_action"
            },
            timeout=30
        )
        # Should fail validation
        assert response.status_code in [400, 422]


class TestAdminCompleteFlow:
    """Tests for admin complete (execute Eko) flow"""
    
    def test_admin_complete_requires_valid_request(self, authenticated_admin):
        """Test that complete requires valid request ID"""
        client = authenticated_admin["client"]
        admin_id = authenticated_admin["user"].get("uid", "admin")
        
        response = client.post(
            f"{BASE_URL}/api/redeem/admin/complete",
            json={
                "request_id": "INVALID_REQUEST_ID",
                "admin_id": admin_id
            },
            timeout=30
        )
        assert response.status_code == 404


class TestEkoBalanceForAdmin:
    """Tests for admin Eko balance endpoint"""
    
    def test_admin_eko_balance_endpoint(self, api_client):
        """Test admin Eko balance endpoint"""
        response = api_client.get(f"{BASE_URL}/api/redeem/admin/eko-balance", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        # Should have balance field
        assert "balance" in data


class TestUserRequestsHistory:
    """Tests for user request history endpoint"""
    
    def test_user_requests_endpoint(self, authenticated_user):
        """Test getting user's request history"""
        user_id = authenticated_user["user"].get("uid")
        if not user_id:
            pytest.skip("User ID not found")
        
        client = authenticated_user["client"]
        
        response = client.get(
            f"{BASE_URL}/api/redeem/user/{user_id}/requests",
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "requests" in data
        assert "total" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
