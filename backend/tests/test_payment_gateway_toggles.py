"""
Test Payment Gateway Toggles for Subscription Page
Tests:
1. /settings/public returns all 3 flags: manual_subscription_enabled, razorpay_enabled, prc_subscription_enabled
2. /admin/toggle-prc-subscription endpoint works correctly
3. /admin/toggle-manual-subscription endpoint works correctly
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicSettingsAPI:
    """Test /settings/public endpoint returns all payment gateway flags"""
    
    def test_public_settings_returns_all_flags(self):
        """Verify /settings/public returns all 3 payment gateway flags"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all 3 flags are present
        assert "manual_subscription_enabled" in data, "manual_subscription_enabled flag missing"
        assert "razorpay_enabled" in data, "razorpay_enabled flag missing"
        assert "prc_subscription_enabled" in data, "prc_subscription_enabled flag missing"
        
        # Verify flags are boolean type
        assert isinstance(data["manual_subscription_enabled"], bool), "manual_subscription_enabled should be boolean"
        assert isinstance(data["razorpay_enabled"], bool), "razorpay_enabled should be boolean"
        assert isinstance(data["prc_subscription_enabled"], bool), "prc_subscription_enabled should be boolean"
        
        print(f"✅ Public settings returned all 3 flags:")
        print(f"   - manual_subscription_enabled: {data['manual_subscription_enabled']}")
        print(f"   - razorpay_enabled: {data['razorpay_enabled']}")
        print(f"   - prc_subscription_enabled: {data['prc_subscription_enabled']}")


class TestTogglePRCSubscription:
    """Test /admin/toggle-prc-subscription endpoint"""
    
    def test_toggle_prc_subscription_with_valid_pin(self):
        """Toggle PRC subscription with valid admin PIN"""
        # First get current state
        settings_response = requests.get(f"{BASE_URL}/api/settings/public")
        current_state = settings_response.json().get("prc_subscription_enabled", True)
        
        # Toggle to opposite state
        new_state = not current_state
        response = requests.post(
            f"{BASE_URL}/api/admin/toggle-prc-subscription",
            json={"enabled": new_state, "admin_pin": "123456"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Toggle should succeed"
        assert data.get("enabled") == new_state, f"Expected enabled={new_state}"
        
        # Verify the change persisted
        verify_response = requests.get(f"{BASE_URL}/api/settings/public")
        verify_data = verify_response.json()
        assert verify_data.get("prc_subscription_enabled") == new_state, "PRC toggle did not persist"
        
        print(f"✅ PRC subscription toggled from {current_state} to {new_state}")
        
        # Restore original state
        requests.post(
            f"{BASE_URL}/api/admin/toggle-prc-subscription",
            json={"enabled": current_state, "admin_pin": "123456"}
        )
        print(f"✅ Restored PRC subscription to original state: {current_state}")
    
    def test_toggle_prc_subscription_with_invalid_pin(self):
        """Toggle PRC subscription with invalid admin PIN should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/toggle-prc-subscription",
            json={"enabled": False, "admin_pin": "wrong_pin"}
        )
        
        assert response.status_code == 403, f"Expected 403 for invalid PIN, got {response.status_code}"
        print("✅ Invalid PIN correctly rejected for PRC toggle")


class TestToggleManualSubscription:
    """Test /admin/toggle-manual-subscription endpoint"""
    
    def test_toggle_manual_subscription_with_valid_pin(self):
        """Toggle Manual subscription with valid admin PIN"""
        # First get current state
        settings_response = requests.get(f"{BASE_URL}/api/settings/public")
        current_state = settings_response.json().get("manual_subscription_enabled", True)
        
        # Toggle to opposite state
        new_state = not current_state
        response = requests.post(
            f"{BASE_URL}/api/admin/toggle-manual-subscription",
            json={"enabled": new_state, "admin_pin": "123456"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Toggle should succeed"
        assert data.get("enabled") == new_state, f"Expected enabled={new_state}"
        
        # Verify the change persisted
        verify_response = requests.get(f"{BASE_URL}/api/settings/public")
        verify_data = verify_response.json()
        assert verify_data.get("manual_subscription_enabled") == new_state, "Manual toggle did not persist"
        
        print(f"✅ Manual subscription toggled from {current_state} to {new_state}")
        
        # Restore original state
        requests.post(
            f"{BASE_URL}/api/admin/toggle-manual-subscription",
            json={"enabled": current_state, "admin_pin": "123456"}
        )
        print(f"✅ Restored Manual subscription to original state: {current_state}")
    
    def test_toggle_manual_subscription_with_invalid_pin(self):
        """Toggle Manual subscription with invalid admin PIN should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/toggle-manual-subscription",
            json={"enabled": False, "admin_pin": "wrong_pin"}
        )
        
        assert response.status_code == 403, f"Expected 403 for invalid PIN, got {response.status_code}"
        print("✅ Invalid PIN correctly rejected for Manual toggle")


class TestPaymentGatewayIntegration:
    """Integration tests for payment gateway toggles"""
    
    def test_disable_all_gateways_and_verify(self):
        """Test disabling all payment gateways"""
        # Get current states
        settings_response = requests.get(f"{BASE_URL}/api/settings/public")
        original_data = settings_response.json()
        original_manual = original_data.get("manual_subscription_enabled", True)
        original_prc = original_data.get("prc_subscription_enabled", True)
        
        # Disable both manual and PRC
        requests.post(
            f"{BASE_URL}/api/admin/toggle-manual-subscription",
            json={"enabled": False, "admin_pin": "123456"}
        )
        requests.post(
            f"{BASE_URL}/api/admin/toggle-prc-subscription",
            json={"enabled": False, "admin_pin": "123456"}
        )
        
        # Verify both are disabled
        verify_response = requests.get(f"{BASE_URL}/api/settings/public")
        verify_data = verify_response.json()
        
        assert verify_data.get("manual_subscription_enabled") == False, "Manual should be disabled"
        assert verify_data.get("prc_subscription_enabled") == False, "PRC should be disabled"
        
        print("✅ Both Manual and PRC gateways disabled successfully")
        
        # Restore original states
        requests.post(
            f"{BASE_URL}/api/admin/toggle-manual-subscription",
            json={"enabled": original_manual, "admin_pin": "123456"}
        )
        requests.post(
            f"{BASE_URL}/api/admin/toggle-prc-subscription",
            json={"enabled": original_prc, "admin_pin": "123456"}
        )
        print(f"✅ Restored original states - Manual: {original_manual}, PRC: {original_prc}")
    
    def test_enable_all_gateways_and_verify(self):
        """Test enabling all payment gateways"""
        # Enable both manual and PRC
        requests.post(
            f"{BASE_URL}/api/admin/toggle-manual-subscription",
            json={"enabled": True, "admin_pin": "123456"}
        )
        requests.post(
            f"{BASE_URL}/api/admin/toggle-prc-subscription",
            json={"enabled": True, "admin_pin": "123456"}
        )
        
        # Verify both are enabled
        verify_response = requests.get(f"{BASE_URL}/api/settings/public")
        verify_data = verify_response.json()
        
        assert verify_data.get("manual_subscription_enabled") == True, "Manual should be enabled"
        assert verify_data.get("prc_subscription_enabled") == True, "PRC should be enabled"
        
        print("✅ Both Manual and PRC gateways enabled successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
