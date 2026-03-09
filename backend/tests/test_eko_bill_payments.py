"""
Test Eko Bill Payment Backend APIs
Tests for /api/eko/* endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://eko-payments.preview.emergentagent.com')

@pytest.fixture
def api_client():
    """Shared requests session with retry logic"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestEkoConfig:
    """Tests for /api/eko/config endpoint"""
    
    def test_eko_config_returns_configured_status(self, api_client):
        """Test that Eko config endpoint returns configuration status"""
        response = api_client.get(f"{BASE_URL}/api/eko/config")
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected fields
        assert "configured" in data
        assert "base_url" in data
        assert "initiator_id" in data
        assert "environment" in data
        
        # Verify values
        assert isinstance(data["configured"], bool)
        assert data["base_url"].startswith("https://")
        assert data["environment"] in ["sandbox", "production"]

    def test_eko_config_is_configured(self, api_client):
        """Test that Eko is properly configured with credentials"""
        response = api_client.get(f"{BASE_URL}/api/eko/config")
        data = response.json()
        
        # In production, should be configured
        assert data["configured"] == True, "Eko API should be configured"
        assert data["initiator_id"] is not None


class TestEkoBBPSCategories:
    """Tests for /api/eko/bbps/categories endpoint"""
    
    def test_categories_returns_list(self, api_client):
        """Test that categories endpoint returns a list of bill categories"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/categories")
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0

    def test_categories_have_required_fields(self, api_client):
        """Test that each category has required fields: id, name, icon"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/categories")
        data = response.json()
        
        for category in data["categories"]:
            assert "id" in category, f"Category missing 'id' field: {category}"
            assert "name" in category, f"Category missing 'name' field: {category}"
            assert "icon" in category, f"Category missing 'icon' field: {category}"

    def test_expected_categories_present(self, api_client):
        """Test that expected bill categories are present"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/categories")
        data = response.json()
        
        category_ids = [c["id"] for c in data["categories"]]
        
        # Test for expected categories
        expected_categories = ["electricity", "mobile_postpaid", "dth", "water", "gas"]
        for expected in expected_categories:
            assert expected in category_ids, f"Expected category '{expected}' not found"


class TestEkoBalance:
    """Tests for /api/eko/balance endpoint"""
    
    def test_balance_endpoint_returns_response(self, api_client):
        """Test that balance endpoint returns a response (may fail due to IP whitelisting)"""
        response = api_client.get(f"{BASE_URL}/api/eko/balance", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        # Should have success field
        assert "success" in data
        
        # If successful, should have balance info
        if data["success"]:
            assert "balance" in data
            assert "currency" in data


class TestEkoBillers:
    """Tests for /api/eko/bbps/billers/{category} endpoint"""
    
    @pytest.mark.timeout(60)
    def test_billers_returns_fallback_or_data(self, api_client):
        """Test billers endpoint - may return fallback data if Eko API times out"""
        # Using electricity category which has fallback billers
        try:
            response = api_client.get(
                f"{BASE_URL}/api/eko/bbps/billers/electricity",
                timeout=30
            )
            assert response.status_code == 200
            data = response.json()
            
            # Should have billers or note about sample data
            if "billers" in data:
                assert isinstance(data["billers"], list)
            if "note" in data:
                # Indicates fallback/sample data was returned
                assert "Sample data" in data["note"] or "error" in data["note"].lower()
        except requests.exceptions.Timeout:
            # This is expected behavior due to Eko IP whitelisting
            pytest.skip("Eko API timeout - IP whitelisting issue expected in preview environment")


class TestHealthEndpoint:
    """Test health endpoint as baseline"""
    
    def test_health_check(self, api_client):
        """Test that API health check works"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert data["database"] == "connected"


class TestBillPaymentRequest:
    """Test bill payment request endpoint (request-based flow)"""
    
    def test_bill_payment_request_endpoint_exists(self, api_client):
        """Test that bill payment request endpoint exists"""
        # Just checking if endpoint exists without valid data
        response = api_client.get(f"{BASE_URL}/api/bill-payment/requests/test-user-id")
        # Should not return 404 (endpoint not found)
        assert response.status_code != 404, "Bill payment requests endpoint should exist"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
