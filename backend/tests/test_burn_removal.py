"""
Test PRC Burn Module Removal - March 2026
Tests that all burn-related endpoints return deprecated responses
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://prc-economy-fix.preview.emergentagent.com')


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    url = f"{BASE_URL}/api/auth/login"
    response = requests.post(url, json={
        "email": "admin@test.com",
        "pin": "153759"
    })
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("token") or data.get("access_token")
        if token:
            print(f"✓ Admin login successful, got token")
            return token
    
    print(f"Admin login failed: {response.status_code} - {response.text}")
    pytest.skip("Could not authenticate as admin")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestBurnModuleRemoval:
    """Test that all burn-related endpoints return deprecated responses"""
    
    def test_burn_statistics_deprecated(self, auth_headers):
        """Test GET /api/admin/burn-statistics returns deprecated response"""
        url = f"{BASE_URL}/api/admin/burn-statistics"
        response = requests.get(url, headers=auth_headers)
        
        # Should return 200 with deprecated message
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ burn-statistics returns deprecated response: {data}")
    
    def test_prc_burn_control_settings_get_deprecated(self, auth_headers):
        """Test GET /api/admin/prc-burn-control/settings returns deprecated response"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/settings"
        response = requests.get(url, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ prc-burn-control/settings GET returns deprecated response: {data}")
    
    def test_prc_burn_control_settings_post_deprecated(self, auth_headers):
        """Test POST /api/admin/prc-burn-control/settings returns deprecated response"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/settings"
        response = requests.post(url, json={}, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ prc-burn-control/settings POST returns deprecated response: {data}")
    
    def test_prc_burn_control_stats_deprecated(self, auth_headers):
        """Test GET /api/admin/prc-burn-control/stats returns deprecated response"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/stats"
        response = requests.get(url, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ prc-burn-control/stats returns deprecated response: {data}")
    
    def test_prc_burn_control_execute_deprecated(self, auth_headers):
        """Test POST /api/admin/prc-burn-control/execute returns deprecated response"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/execute"
        response = requests.post(url, json={}, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ prc-burn-control/execute returns deprecated response: {data}")
    
    def test_prc_burn_control_history_deprecated(self, auth_headers):
        """Test GET /api/admin/prc-burn-control/history returns deprecated response"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/history"
        response = requests.get(url, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ prc-burn-control/history returns deprecated response: {data}")
    
    def test_prc_burn_control_retry_deprecated(self, auth_headers):
        """Test POST /api/admin/prc-burn-control/retry returns deprecated response"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/retry"
        response = requests.post(url, json={}, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ prc-burn-control/retry returns deprecated response: {data}")


class TestAdminMiscBurnRoutes:
    """Test burn routes in admin_misc.py"""
    
    def test_run_explorer_burn_deprecated(self, auth_headers):
        """Test POST /api/admin/run-explorer-burn returns deprecated response"""
        url = f"{BASE_URL}/api/admin/run-explorer-burn"
        response = requests.post(url, json={}, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ run-explorer-burn returns deprecated response: {data}")
    
    def test_smart_burn_deprecated(self, auth_headers):
        """Test POST /api/admin/smart-burn returns deprecated response"""
        url = f"{BASE_URL}/api/admin/smart-burn"
        response = requests.post(url, json={}, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ smart-burn returns deprecated response: {data}")
    
    def test_run_prc_burn_deprecated(self, auth_headers):
        """Test POST /api/admin/run-prc-burn returns deprecated response"""
        url = f"{BASE_URL}/api/admin/run-prc-burn"
        response = requests.post(url, json={}, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ run-prc-burn returns deprecated response: {data}")
    
    def test_burn_settings_deprecated(self, auth_headers):
        """Test GET /api/admin/burn-settings returns deprecated response"""
        url = f"{BASE_URL}/api/admin/burn-settings"
        response = requests.get(url, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("deprecated") == True, f"Expected deprecated: true, got {data}"
        print(f"✓ burn-settings returns deprecated response: {data}")


class TestHealthEndpoints:
    """Test that basic health endpoints still work"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        url = f"{BASE_URL}/api/health"
        response = requests.get(url)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "healthy", "Expected status: healthy"
        print(f"✓ Health endpoint working: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
