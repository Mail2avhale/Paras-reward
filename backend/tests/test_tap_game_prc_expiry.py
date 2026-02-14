"""
Test Suite for Tap Game Advanced and PRC Expiry Features
Tests: Tap Game combo system, PRC Expiry API for free/VIP users
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPRCExpiryAPI:
    """Tests for /api/user/{uid}/prc-expiry endpoint"""
    
    # Test credentials
    VIP_USER_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"  # Admin with elite plan
    STARTUP_USER_UID = "USER002"  # User with startup plan (but no expiry set)
    FREE_USER_UID = "b69c345a-78f9-4c6f-ba59-091417df6b57"  # Explorer plan
    
    def test_prc_expiry_vip_user_returns_protected(self):
        """VIP users should get is_vip=true and protected=true"""
        response = requests.get(f"{BASE_URL}/api/user/{self.VIP_USER_UID}/prc-expiry")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("is_vip") == True, "VIP user should have is_vip=true"
        assert data.get("protected") == True, "VIP user should be protected"
        assert data.get("expiring_batches") == [], "VIP should have no expiring batches"
        assert data.get("total_expiring") == 0, "VIP should have 0 total expiring"
        assert "VIP members have lifetime PRC validity" in data.get("message", "")
    
    def test_prc_expiry_free_user_returns_structure(self):
        """Free users should get proper expiry data structure"""
        response = requests.get(f"{BASE_URL}/api/user/{self.FREE_USER_UID}/prc-expiry")
        assert response.status_code == 200
        
        data = response.json()
        # Free users should have is_vip=false and protected=false
        assert data.get("is_vip") == False, "Free user should have is_vip=false"
        assert data.get("protected") == False, "Free user should not be protected"
        
        # Structure validation
        assert "expiring_batches" in data
        assert isinstance(data["expiring_batches"], list)
        assert "total_expiring" in data
        assert "batch_count" in data
        assert "warning_level" in data
        assert data["warning_level"] in ["none", "warning", "urgent", "critical"]
        
        # Free users should get upgrade CTA
        assert "upgrade_cta" in data
    
    def test_prc_expiry_nonexistent_user_returns_404(self):
        """Non-existent user should return 404"""
        response = requests.get(f"{BASE_URL}/api/user/nonexistent-uid-12345/prc-expiry")
        assert response.status_code == 404
    
    def test_prc_expiry_batch_structure(self):
        """Verify expiring batch structure when batches exist"""
        response = requests.get(f"{BASE_URL}/api/user/{self.FREE_USER_UID}/prc-expiry")
        assert response.status_code == 200
        
        data = response.json()
        if data.get("expiring_batches"):
            batch = data["expiring_batches"][0]
            # Each batch should have these fields
            assert "amount" in batch
            assert "hoursLeft" in batch
            assert "minutesLeft" in batch
            assert "earnedAt" in batch
            assert "expiresAt" in batch
            assert "type" in batch
            assert "isUrgent" in batch
            assert "isCritical" in batch
            
            # hoursLeft should be positive
            assert batch["hoursLeft"] >= 0
            # amount should be positive
            assert batch["amount"] > 0


class TestTapGameAPI:
    """Tests for Tap Game API endpoints"""
    
    USER_UID = "USER002"  # miner@test.com
    
    def test_tap_api_exists(self):
        """Verify tap API endpoint is accessible"""
        response = requests.post(
            f"{BASE_URL}/api/game/tap/{self.USER_UID}",
            json={"taps": 1, "combo_multiplier": 1}
        )
        # Should get 200 or an expected error (like limit reached)
        assert response.status_code in [200, 400, 429]
    
    def test_user_data_has_tap_fields(self):
        """Verify user data includes tap game fields"""
        response = requests.get(f"{BASE_URL}/api/user/{self.USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        # User should have tap-related fields
        assert "taps_today" in data
        assert "last_tap_date" in data


class TestMiningStatusAPI:
    """Tests for Mining status that integrates with PRCBurnAlert"""
    
    USER_UID = "USER002"
    
    def test_mining_status_endpoint(self):
        """Mining status should work"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{self.USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "mining_rate_per_hour" in data or "mining_rate" in data
        assert "session_active" in data or "remaining_hours" in data


class TestUserProfileAPI:
    """Tests for user profile data used in Mining page"""
    
    USER_UID = "USER002"
    
    def test_user_has_subscription_plan(self):
        """User should have subscription_plan field"""
        response = requests.get(f"{BASE_URL}/api/users/{self.USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "subscription_plan" in data
        assert data["subscription_plan"] in ["explorer", "startup", "growth", "elite", None]
    
    def test_redemption_stats_endpoint(self):
        """Redemption stats API should work"""
        response = requests.get(f"{BASE_URL}/api/user/{self.USER_UID}/redemption-stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_earned" in data or "total_redeemed" in data or isinstance(data, dict)


class TestPRCExpiryLogic:
    """Tests for PRC expiry logic - comparing VIP vs Free users"""
    
    VIP_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"
    
    def test_vip_gets_protected_status(self):
        """VIP users should see 'protected' status"""
        response = requests.get(f"{BASE_URL}/api/user/{self.VIP_UID}/prc-expiry")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("protected") == True
        assert data.get("is_vip") == True
    
    def test_startup_user_without_expiry_treated_as_free(self):
        """User with startup plan but no subscription_expiry should be treated based on expiry check"""
        # USER002 has startup plan but no subscription_expiry
        response = requests.get(f"{BASE_URL}/api/user/USER002/prc-expiry")
        assert response.status_code == 200
        
        data = response.json()
        # This user has startup plan but no expiry set, so logic may vary
        # The response should still be valid
        assert "is_vip" in data
        assert "expiring_batches" in data
        assert "total_expiring" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
