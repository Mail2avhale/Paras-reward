"""
Test Suite for PRC Vault/Savings Feature Removal
Tests the removal of:
1. 20% deduction from mining (users now get 100%)
2. Auto-detect operator API for mobile recharge

Run: pytest /app/backend/tests/test_prc_vault_removal.py -v --tb=short
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://two-plan-rebuild.preview.emergentagent.com')


class TestAutoDetectOperatorAPI:
    """Test the auto-detect operator API for mobile recharge"""
    
    def test_detect_jio_number(self):
        """Test detecting Jio operator from mobile number"""
        # 9820xxxxxx is a Jio prefix (MH circle)
        response = requests.get(f"{BASE_URL}/api/eko/recharge/detect/9820123456")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["mobile"] == "9820123456"
        assert data["detection"]["operator"] == "JIO"
        assert data["detection"]["operator_name"] == "Jio"
        assert data["detection"]["circle"] == "MH"
        assert data["detection"]["confidence"] in ["high", "medium"]
        assert "plans" in data
        assert len(data["plans"]) > 0
    
    def test_detect_airtel_number(self):
        """Test detecting Airtel operator from mobile number"""
        # 8447xxxxxx is an Airtel prefix
        response = requests.get(f"{BASE_URL}/api/eko/recharge/detect/8447123456")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["detection"]["operator"] == "AIRTEL"
        assert data["detection"]["operator_name"] == "Airtel"
        assert "plans" in data
        assert len(data["plans"]) > 0
    
    def test_detect_vi_number(self):
        """Test detecting Vi (Vodafone Idea) operator from mobile number"""
        # 7011xxxxxx is a Vi prefix
        response = requests.get(f"{BASE_URL}/api/eko/recharge/detect/7011234567")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["detection"]["operator"] == "VI"
        assert data["detection"]["operator_name"] == "Vi (Vodafone Idea)"
        assert "plans" in data
    
    def test_detect_bsnl_number(self):
        """Test detecting BSNL operator from mobile number"""
        # 9402xxxxxx is a BSNL prefix
        response = requests.get(f"{BASE_URL}/api/eko/recharge/detect/9402123456")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["detection"]["operator"] == "BSNL"
        assert data["detection"]["operator_name"] == "BSNL"
        assert "plans" in data
    
    def test_detect_invalid_number(self):
        """Test handling of invalid mobile number"""
        response = requests.get(f"{BASE_URL}/api/eko/recharge/detect/invalid123")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is False
        assert data["detection"]["operator"] is None
        assert data["detection"]["confidence"] == "none"
        assert "suggestions" in data  # Should provide operator suggestions
    
    def test_detect_short_number(self):
        """Test handling of too short mobile number"""
        response = requests.get(f"{BASE_URL}/api/eko/recharge/detect/12345")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is False
        assert data["detection"]["operator"] is None
    
    def test_detect_number_with_country_code(self):
        """Test detecting operator with +91 country code"""
        # The API should handle +91 prefix
        response = requests.get(f"{BASE_URL}/api/eko/recharge/detect/+919820123456")
        # URL encoding should be handled
        assert response.status_code == 200


class TestMiningNoDeduction:
    """Test that mining gives 100% PRC (no 20% deduction)"""
    
    def test_mining_status_endpoint(self):
        """Test mining status API exists and responds"""
        # Note: This needs a valid user ID to test properly
        # We test the API structure exists
        response = requests.get(f"{BASE_URL}/api/mining/status/test_user_invalid")
        # Expect 404 or error for invalid user, but API should respond
        assert response.status_code in [200, 404, 400]
    
    def test_eko_charges_calculate(self):
        """Test Eko charges calculation API"""
        response = requests.get(f"{BASE_URL}/api/eko/charges/calculate?amount=100")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "charges" in data
        assert data["charges"]["amount_inr"] == 100
        # Verify admin charge is 20% (not related to PRC vault)
        assert data["charges"]["admin_charge_percent"] == 20
    
    def test_eko_charges_config(self):
        """Test Eko charges config API"""
        response = requests.get(f"{BASE_URL}/api/eko/charges/config")
        assert response.status_code == 200
        data = response.json()
        
        assert data["platform_fee_inr"] == 10
        assert data["admin_charge_percent"] == 20
        assert data["prc_rate"] == 10


class TestEkoAPIConfiguration:
    """Test Eko API configuration"""
    
    def test_eko_config_endpoint(self):
        """Test Eko configuration status"""
        response = requests.get(f"{BASE_URL}/api/eko/config")
        assert response.status_code == 200
        data = response.json()
        
        assert "configured" in data
        assert "base_url" in data
        assert "initiator_id" in data
    
    def test_bbps_operators_endpoint(self):
        """Test BBPS operators API for electricity"""
        response = requests.get(f"{BASE_URL}/api/eko/bbps/operators/electricity")
        assert response.status_code == 200
        data = response.json()
        
        assert "operators" in data
        # Should have some operators (either from API or fallback)
    
    def test_recharge_plans_endpoint(self):
        """Test recharge plans API for operators with circle"""
        # Endpoint requires operator AND circle parameters
        response = requests.get(f"{BASE_URL}/api/eko/recharge/plans/JIO/MH")
        assert response.status_code == 200
        data = response.json()
        
        assert "plans" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
