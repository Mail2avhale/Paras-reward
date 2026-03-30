"""
Test Registration Validation - Iteration 164
Tests for POST /api/auth/register/simple endpoint validation

Features tested:
1. Empty mobile returns 400 'Mobile number is required'
2. Duplicate mobile (9970100782) returns 400 'Mobile number already registered'
3. 5-digit mobile returns 400 'Mobile number must be 10 digits'
4. Empty name returns 400 'Full name is required'
5. PIN 111111 returns 400 'PIN cannot be all same digits'
6. Duplicate email returns 400 'Email already registered'
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRegistrationValidation:
    """Registration endpoint validation tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.api_url = f"{BASE_URL}/api/auth/register/simple"
        self.existing_mobile = "9970100782"  # Known existing user
        self.unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        # Generate valid 10-digit mobile starting with 9 (Indian format)
        import random
        self.unique_mobile = f"9{random.randint(100000000, 999999999)}"
        
    def test_empty_mobile_returns_400(self):
        """Test: Empty mobile returns 400 'Mobile number is required'"""
        payload = {
            "full_name": "Test User",
            "mobile": "",
            "email": self.unique_email,
            "password": "123456"
        }
        response = requests.post(self.api_url, json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "mobile number is required" in data.get("detail", "").lower(), f"Expected 'Mobile number is required', got: {data}"
        print(f"✓ Empty mobile test PASSED: {data.get('detail')}")
    
    def test_duplicate_mobile_returns_400(self):
        """Test: Duplicate mobile (9970100782) returns 400 'Mobile number already registered'"""
        payload = {
            "full_name": "Test User",
            "mobile": self.existing_mobile,
            "email": self.unique_email,
            "password": "123456"
        }
        response = requests.post(self.api_url, json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "mobile number already registered" in data.get("detail", "").lower(), f"Expected 'Mobile number already registered', got: {data}"
        print(f"✓ Duplicate mobile test PASSED: {data.get('detail')}")
    
    def test_5_digit_mobile_returns_400(self):
        """Test: 5-digit mobile returns 400 'Mobile number must be 10 digits'"""
        payload = {
            "full_name": "Test User",
            "mobile": "12345",  # Only 5 digits
            "email": self.unique_email,
            "password": "123456"
        }
        response = requests.post(self.api_url, json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "10 digits" in data.get("detail", "").lower(), f"Expected '10 digits' in error, got: {data}"
        print(f"✓ 5-digit mobile test PASSED: {data.get('detail')}")
    
    def test_empty_name_returns_400(self):
        """Test: Empty name returns 400 'Full name is required'"""
        payload = {
            "full_name": "",
            "mobile": self.unique_mobile,
            "email": self.unique_email,
            "password": "123456"
        }
        response = requests.post(self.api_url, json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "full name is required" in data.get("detail", "").lower(), f"Expected 'Full name is required', got: {data}"
        print(f"✓ Empty name test PASSED: {data.get('detail')}")
    
    def test_weak_pin_all_same_digits_returns_400(self):
        """Test: PIN 111111 returns 400 'PIN cannot be all same digits'"""
        payload = {
            "full_name": "Test User",
            "mobile": self.unique_mobile,
            "email": self.unique_email,
            "password": "111111"  # All same digits
        }
        response = requests.post(self.api_url, json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "all same digits" in data.get("detail", "").lower(), f"Expected 'all same digits' in error, got: {data}"
        print(f"✓ Weak PIN (all same) test PASSED: {data.get('detail')}")
    
    def test_duplicate_email_returns_400(self):
        """Test: Duplicate email returns 400 'Email already registered'"""
        # Use a fresh unique mobile for this test
        import random
        fresh_mobile = f"9{random.randint(100000000, 999999999)}"
        
        payload = {
            "full_name": "Test User",
            "mobile": fresh_mobile,
            "email": "admin@paras.com",  # Known existing admin email
            "password": "123456"
        }
        response = requests.post(self.api_url, json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "email already registered" in data.get("detail", "").lower(), f"Expected 'Email already registered', got: {data}"
        print(f"✓ Duplicate email test PASSED: {data.get('detail')}")
    
    def test_invalid_email_format_returns_400(self):
        """Test: Invalid email format returns 400"""
        payload = {
            "full_name": "Test User",
            "mobile": self.unique_mobile,
            "email": "invalid-email",  # No @ symbol
            "password": "123456"
        }
        response = requests.post(self.api_url, json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "email" in data.get("detail", "").lower(), f"Expected email error, got: {data}"
        print(f"✓ Invalid email format test PASSED: {data.get('detail')}")
    
    def test_pin_not_6_digits_returns_400(self):
        """Test: PIN not 6 digits returns 400"""
        payload = {
            "full_name": "Test User",
            "mobile": self.unique_mobile,
            "email": self.unique_email,
            "password": "1234"  # Only 4 digits
        }
        response = requests.post(self.api_url, json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "6 digits" in data.get("detail", "").lower(), f"Expected '6 digits' in error, got: {data}"
        print(f"✓ PIN not 6 digits test PASSED: {data.get('detail')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
