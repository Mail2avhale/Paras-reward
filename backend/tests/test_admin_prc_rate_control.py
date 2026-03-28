"""
Admin PRC Rate Control API Tests
Tests for: Manual override, current rate retrieval, rate source detection

Key Features Tested:
1. GET /api/admin/prc-rate/current - Get current rate with source info
2. POST /api/admin/prc-rate/manual-override - Set/disable rate override
"""
import pytest
import requests
import os
from datetime import datetime

# Get the API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = 'https://redeem-limit-test.preview.emergentagent.com'


class TestPRCRateCurrent:
    """Test GET /api/admin/prc-rate/current endpoint"""
    
    def test_get_current_rate_success(self):
        """Test successful retrieval of current PRC rate"""
        response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify required fields
        assert data.get('success') == True, "Expected success=true"
        assert 'current_rate' in data, "Missing current_rate"
        assert 'source' in data, "Missing source"
        
        # Verify rate is positive number
        assert isinstance(data['current_rate'], (int, float)), "current_rate should be number"
        assert data['current_rate'] > 0, f"Rate should be positive, got {data['current_rate']}"
    
    def test_current_rate_has_source_info(self):
        """Test that current rate includes source information"""
        response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
        
        assert response.status_code == 200
        data = response.json()
        
        # Source should be either 'manual_override' or 'dynamic_economy'
        valid_sources = ['manual_override', 'dynamic_economy', 'fallback']
        assert data['source'] in valid_sources, f"Invalid source: {data['source']}"
    
    def test_current_rate_has_note(self):
        """Test that current rate includes human-readable note"""
        response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have note explaining the rate
        assert 'note' in data, "Missing note field"
        assert 'PRC' in data['note'], f"Note should mention PRC, got: {data['note']}"


class TestPRCRateManualOverride:
    """Test POST /api/admin/prc-rate/manual-override endpoint"""
    
    def test_set_override_success(self):
        """Test setting manual rate override"""
        override_data = {
            "rate": 20,
            "enabled": True,
            "expires_hours": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/prc-rate/manual-override",
            json=override_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get('success') == True, "Expected success=true"
        assert data.get('rate') == 20, f"Expected rate=20, got {data.get('rate')}"
        assert 'expires_at' in data, "Missing expires_at"
    
    def test_override_reflects_in_current(self):
        """Test that override is reflected in current rate"""
        # First set override
        override_data = {
            "rate": 25,
            "enabled": True,
            "expires_hours": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/prc-rate/manual-override",
            json=override_data
        )
        assert response.status_code == 200
        
        # Now check current rate
        response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
        assert response.status_code == 200
        data = response.json()
        
        assert data['current_rate'] == 25, f"Expected current_rate=25, got {data['current_rate']}"
        assert data['source'] == 'manual_override', f"Expected source='manual_override', got {data['source']}"
        
        # Override info should exist
        assert data.get('override') is not None, "Missing override info"
        assert data['override'].get('rate') == 25, f"Override rate mismatch"
    
    def test_disable_override(self):
        """Test disabling manual override"""
        # First enable override
        enable_data = {
            "rate": 30,
            "enabled": True
        }
        response = requests.post(
            f"{BASE_URL}/api/admin/prc-rate/manual-override",
            json=enable_data
        )
        assert response.status_code == 200
        
        # Now disable
        disable_data = {
            "enabled": False
        }
        response = requests.post(
            f"{BASE_URL}/api/admin/prc-rate/manual-override",
            json=disable_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get('success') == True, "Expected success=true"
        assert data.get('enabled') == False, "Expected enabled=false"
    
    def test_invalid_rate_rejected(self):
        """Test that invalid rate values are rejected"""
        invalid_data = {
            "rate": -5,  # Negative rate
            "enabled": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/prc-rate/manual-override",
            json=invalid_data
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for negative rate, got {response.status_code}"
    
    def test_zero_rate_rejected(self):
        """Test that zero rate is rejected"""
        invalid_data = {
            "rate": 0,
            "enabled": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/prc-rate/manual-override",
            json=invalid_data
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for zero rate, got {response.status_code}"
    
    def test_permanent_override(self):
        """Test setting permanent override (no expiry)"""
        override_data = {
            "rate": 15,
            "enabled": True
            # No expires_hours = permanent
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/prc-rate/manual-override",
            json=override_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get('success') == True
        # expires_at should be None for permanent
        assert data.get('expires_at') is None, f"Expected expires_at=None for permanent, got {data.get('expires_at')}"
        assert 'Permanent' in data.get('note', ''), f"Expected 'Permanent' in note, got {data.get('note')}"
    
    def test_cleanup_disable_override(self):
        """Cleanup: Disable override after tests"""
        disable_data = {
            "enabled": False
        }
        response = requests.post(
            f"{BASE_URL}/api/admin/prc-rate/manual-override",
            json=disable_data
        )
        
        assert response.status_code == 200
        
        # Verify disabled
        response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
        assert response.status_code == 200
        data = response.json()
        
        # Source should be dynamic_economy after disabling
        assert data['source'] in ['dynamic_economy', 'fallback'], f"Expected dynamic source, got {data['source']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
