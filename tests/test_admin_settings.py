"""
Test Admin Settings APIs - Mining Settings, Contact Settings, Logo Settings
Tests for:
1. Mining Formula settings save and persist
2. Contact Settings save and persist  
3. Logo upload via file
4. Logo settings save and persist
"""

import pytest
import requests
import os
import io
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMiningSettings:
    """Test Mining Formula Settings API - GET and POST"""
    
    def test_get_mining_settings(self):
        """Test GET /api/admin/mining-settings returns default or saved settings"""
        response = requests.get(f"{BASE_URL}/api/admin/mining-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify expected fields exist
        assert "base_rate" in data, "Missing base_rate field"
        assert "vip_multiplier" in data, "Missing vip_multiplier field"
        assert "max_daily_mining_hours" in data, "Missing max_daily_mining_hours field"
        assert "prc_to_inr_ratio" in data, "Missing prc_to_inr_ratio field"
        
        print(f"✅ GET mining-settings: {data}")
    
    def test_post_mining_settings_and_verify_persistence(self):
        """Test POST /api/admin/mining-settings saves and persists data"""
        # First, get current settings to restore later
        original_response = requests.get(f"{BASE_URL}/api/admin/mining-settings")
        original_settings = original_response.json()
        
        # Create test settings with unique values
        test_settings = {
            "base_rate": 1.5,
            "vip_multiplier": 3,
            "max_daily_mining_hours": 12,
            "prc_to_inr_ratio": 15
        }
        
        # POST new settings
        post_response = requests.post(
            f"{BASE_URL}/api/admin/mining-settings",
            json=test_settings
        )
        assert post_response.status_code == 200, f"POST failed: {post_response.text}"
        
        post_data = post_response.json()
        assert post_data.get("success") == True, "Expected success=True in response"
        print(f"✅ POST mining-settings response: {post_data}")
        
        # GET to verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/admin/mining-settings")
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        assert verify_data["base_rate"] == test_settings["base_rate"], f"base_rate not persisted: {verify_data}"
        assert verify_data["vip_multiplier"] == test_settings["vip_multiplier"], f"vip_multiplier not persisted: {verify_data}"
        assert verify_data["max_daily_mining_hours"] == test_settings["max_daily_mining_hours"], f"max_daily_mining_hours not persisted: {verify_data}"
        assert verify_data["prc_to_inr_ratio"] == test_settings["prc_to_inr_ratio"], f"prc_to_inr_ratio not persisted: {verify_data}"
        
        print(f"✅ Mining settings persisted correctly: {verify_data}")
        
        # Restore original settings
        requests.post(f"{BASE_URL}/api/admin/mining-settings", json=original_settings)


class TestContactSettings:
    """Test Contact Settings API - GET and POST"""
    
    def test_get_contact_settings(self):
        """Test GET /api/admin/contact-settings returns default or saved settings"""
        response = requests.get(f"{BASE_URL}/api/admin/contact-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify expected fields exist
        expected_fields = [
            "company_name", "country", "email_business", "working_hours",
            "address_line1", "address_line2", "city", "state", "pincode",
            "phone_primary", "phone_secondary", "email_support"
        ]
        for field in expected_fields:
            assert field in data, f"Missing {field} field in contact settings"
        
        print(f"✅ GET contact-settings: {data}")
    
    def test_post_contact_settings_and_verify_persistence(self):
        """Test POST /api/admin/contact-settings/update saves and persists data"""
        # First, get current settings to restore later
        original_response = requests.get(f"{BASE_URL}/api/admin/contact-settings")
        original_settings = original_response.json()
        
        # Create test settings with unique values
        test_settings = {
            "company_name": "TEST COMPANY NAME",
            "address_line1": "Test Address Line 1",
            "address_line2": "Test Address Line 2",
            "city": "Test City",
            "state": "Test State",
            "pincode": "123456",
            "country": "Test Country",
            "phone_primary": "+91 9876543210",
            "phone_secondary": "+91 9876543211",
            "email_support": "test_support@test.com",
            "email_business": "test_business@test.com",
            "working_hours": "10:00 AM - 7:00 PM (Mon-Fri)"
        }
        
        # POST new settings
        post_response = requests.post(
            f"{BASE_URL}/api/admin/contact-settings/update",
            json=test_settings
        )
        assert post_response.status_code == 200, f"POST failed: {post_response.text}"
        
        post_data = post_response.json()
        assert post_data.get("success") == True, "Expected success=True in response"
        print(f"✅ POST contact-settings response: {post_data}")
        
        # GET to verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/admin/contact-settings")
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        assert verify_data["company_name"] == test_settings["company_name"], f"company_name not persisted: {verify_data}"
        assert verify_data["country"] == test_settings["country"], f"country not persisted: {verify_data}"
        assert verify_data["email_business"] == test_settings["email_business"], f"email_business not persisted: {verify_data}"
        assert verify_data["working_hours"] == test_settings["working_hours"], f"working_hours not persisted: {verify_data}"
        assert verify_data["city"] == test_settings["city"], f"city not persisted: {verify_data}"
        assert verify_data["phone_primary"] == test_settings["phone_primary"], f"phone_primary not persisted: {verify_data}"
        
        print(f"✅ Contact settings persisted correctly: {verify_data}")
        
        # Restore original settings
        requests.post(f"{BASE_URL}/api/admin/contact-settings/update", json=original_settings)


class TestLogoSettings:
    """Test Logo Settings API - GET and POST"""
    
    def test_get_logo_settings(self):
        """Test GET /api/admin/logo-settings returns default or saved settings"""
        response = requests.get(f"{BASE_URL}/api/admin/logo-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify expected fields exist
        expected_fields = ["logo_url", "footer_logo_url", "favicon_url", "app_name", "tagline"]
        for field in expected_fields:
            assert field in data, f"Missing {field} field in logo settings"
        
        print(f"✅ GET logo-settings: {data}")
    
    def test_post_logo_settings_and_verify_persistence(self):
        """Test POST /api/admin/logo-settings/update saves and persists data"""
        # First, get current settings to restore later
        original_response = requests.get(f"{BASE_URL}/api/admin/logo-settings")
        original_settings = original_response.json()
        
        # Create test settings with unique values
        test_settings = {
            "logo_url": "/uploads/test_logo.png",
            "footer_logo_url": "/uploads/test_footer_logo.png",
            "favicon_url": "/uploads/test_favicon.png",
            "app_name": "TEST APP NAME",
            "tagline": "Test Tagline Here"
        }
        
        # POST new settings
        post_response = requests.post(
            f"{BASE_URL}/api/admin/logo-settings/update",
            json=test_settings
        )
        assert post_response.status_code == 200, f"POST failed: {post_response.text}"
        
        post_data = post_response.json()
        assert post_data.get("success") == True, "Expected success=True in response"
        print(f"✅ POST logo-settings response: {post_data}")
        
        # GET to verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/admin/logo-settings")
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        assert verify_data["app_name"] == test_settings["app_name"], f"app_name not persisted: {verify_data}"
        assert verify_data["tagline"] == test_settings["tagline"], f"tagline not persisted: {verify_data}"
        
        print(f"✅ Logo settings persisted correctly: {verify_data}")
        
        # Restore original settings
        requests.post(f"{BASE_URL}/api/admin/logo-settings/update", json=original_settings)


class TestLogoUpload:
    """Test Logo Upload API - POST with file upload"""
    
    def test_logo_upload_main_logo(self):
        """Test POST /api/admin/logo-upload for main logo"""
        # Create a simple test image (1x1 pixel PNG)
        # This is a minimal valid PNG file
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 pixel
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {
            'file': ('test_logo.png', io.BytesIO(png_data), 'image/png')
        }
        data = {
            'logo_type': 'logo'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/logo-upload",
            files=files,
            data=data
        )
        
        # Check response
        assert response.status_code == 200, f"Upload failed: {response.status_code} - {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Expected success=True: {result}"
        assert "url" in result, f"Missing url in response: {result}"
        assert result["url"].startswith("/uploads/"), f"URL should start with /uploads/: {result}"
        
        print(f"✅ Logo upload successful: {result}")
    
    def test_logo_upload_footer_logo(self):
        """Test POST /api/admin/logo-upload for footer logo"""
        # Create a simple test image
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {
            'file': ('test_footer_logo.png', io.BytesIO(png_data), 'image/png')
        }
        data = {
            'logo_type': 'footer_logo'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/logo-upload",
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Upload failed: {response.status_code} - {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Expected success=True: {result}"
        assert "url" in result, f"Missing url in response: {result}"
        
        print(f"✅ Footer logo upload successful: {result}")
    
    def test_logo_upload_favicon(self):
        """Test POST /api/admin/logo-upload for favicon"""
        # Create a simple test image
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {
            'file': ('test_favicon.png', io.BytesIO(png_data), 'image/png')
        }
        data = {
            'logo_type': 'favicon'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/logo-upload",
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Upload failed: {response.status_code} - {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Expected success=True: {result}"
        assert "url" in result, f"Missing url in response: {result}"
        
        print(f"✅ Favicon upload successful: {result}")
    
    def test_logo_upload_updates_settings(self):
        """Test that logo upload also updates logo-settings in database"""
        # Get current settings
        original_response = requests.get(f"{BASE_URL}/api/admin/logo-settings")
        original_settings = original_response.json()
        
        # Upload a new logo
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {
            'file': ('test_logo_update.png', io.BytesIO(png_data), 'image/png')
        }
        data = {
            'logo_type': 'logo'
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/admin/logo-upload",
            files=files,
            data=data
        )
        assert upload_response.status_code == 200
        
        uploaded_url = upload_response.json().get("url")
        
        # Verify settings were updated
        verify_response = requests.get(f"{BASE_URL}/api/admin/logo-settings")
        verify_data = verify_response.json()
        
        assert verify_data["logo_url"] == uploaded_url, f"logo_url not updated in settings: expected {uploaded_url}, got {verify_data['logo_url']}"
        
        print(f"✅ Logo upload correctly updates settings: {verify_data['logo_url']}")
        
        # Restore original settings
        requests.post(f"{BASE_URL}/api/admin/logo-settings/update", json=original_settings)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
