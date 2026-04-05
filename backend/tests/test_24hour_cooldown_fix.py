"""
Test Suite: 24-Hour Cooldown Period Fix
========================================
Verifies that all cooldown periods have been changed from 28-day/7-day to 24-hour.

Key Changes Tested:
1. GET /api/bank-transfer/config - should show cooldown_hours: 24, NO cycle_days field
2. GET /api/bank-redeem/denominations - should show 'per 24 hours' in note
3. GET /api/bank-redeem/check-eligibility/{user_id} - eligibility check working
4. GET /api/service/cooldown/{user_id}/bank_transfer - cooldown check returns correct data
5. No remaining '28 days' or '7-day limit' error messages in any redeem endpoint response
6. Backend health check - no crashes after changes
7. Login flow still works correctly
"""

import pytest
import requests
import os
import json
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is required")

# Test credentials from test_credentials.md
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


class TestHealthCheck:
    """Test 1: Backend health check - no crashes after changes"""
    
    def test_health_endpoint_returns_200(self):
        """Health endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Unexpected status: {data}"
        print(f"✅ Health check passed: {data}")
    
    def test_db_health_endpoint(self):
        """DB health endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/health/db", timeout=10)
        assert response.status_code == 200, f"DB health check failed: {response.text}"
        data = response.json()
        assert data.get("status") in ["healthy", "reconnected"], f"DB status: {data}"
        print(f"✅ DB health check passed: {data}")


class TestLoginFlow:
    """Test 7: Login flow still works correctly"""
    
    def test_login_with_valid_credentials(self):
        """Login should work with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"mobile": TEST_USER_MOBILE, "pin": TEST_USER_PIN},
            timeout=15
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get("success") == True or "user" in data or "uid" in data, f"Login response: {data}"
        print(f"✅ Login successful for user {TEST_USER_MOBILE}")
        return data


class TestBankTransferConfig:
    """Test 1: GET /api/bank-transfer/config - should show cooldown_hours: 24"""
    
    def test_config_shows_24_hour_cooldown(self):
        """Config endpoint should show cooldown_hours: 24"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/config", timeout=10)
        assert response.status_code == 200, f"Config endpoint failed: {response.text}"
        data = response.json()
        
        # Verify cooldown_hours is 24
        assert "cooldown_hours" in data, f"Missing cooldown_hours in response: {data}"
        assert data["cooldown_hours"] == 24, f"Expected cooldown_hours=24, got {data['cooldown_hours']}"
        
        # Verify NO cycle_days field (28-day cycle removed)
        assert "cycle_days" not in data, f"cycle_days should NOT be present: {data}"
        
        # Verify note mentions 24 hours
        note = data.get("note", "")
        assert "24 hours" in note.lower() or "24 hour" in note.lower(), f"Note should mention 24 hours: {note}"
        
        print(f"✅ Bank transfer config shows 24-hour cooldown: {data}")
        return data
    
    def test_config_no_28_day_reference(self):
        """Config should NOT contain any 28-day references"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/config", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        # Convert entire response to string and check for 28-day references
        response_str = json.dumps(data).lower()
        assert "28 day" not in response_str, f"Found '28 day' reference in config: {data}"
        assert "28-day" not in response_str, f"Found '28-day' reference in config: {data}"
        assert "cycle_days" not in response_str, f"Found 'cycle_days' reference in config: {data}"
        
        print(f"✅ No 28-day references in bank transfer config")


class TestBankRedeemDenominations:
    """Test 2: GET /api/bank-redeem/denominations - should show 'per 24 hours' in note"""
    
    def test_denominations_shows_24_hour_note(self):
        """Denominations endpoint should mention 24 hours"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations", timeout=10)
        assert response.status_code == 200, f"Denominations endpoint failed: {response.text}"
        data = response.json()
        
        # Check note field
        note = data.get("note", "")
        assert "24 hour" in note.lower() or "per 24" in note.lower(), f"Note should mention 24 hours: {note}"
        
        # Verify NO 7-day references
        assert "7 day" not in note.lower(), f"Note should NOT mention 7 days: {note}"
        assert "7-day" not in note.lower(), f"Note should NOT mention 7-day: {note}"
        assert "per week" not in note.lower(), f"Note should NOT mention 'per week': {note}"
        
        print(f"✅ Bank redeem denominations shows 24-hour note: {note}")
        return data
    
    def test_denominations_no_weekly_references(self):
        """Denominations should NOT contain weekly/7-day references in user-facing text"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        # Check the note field specifically (user-facing text)
        note = data.get("note", "").lower()
        assert "7 day" not in note, f"Found '7 day' in note: {note}"
        assert "7-day" not in note, f"Found '7-day' in note: {note}"
        assert "per week" not in note, f"Found 'per week' in note: {note}"
        
        # Note: 'weekly_limit' field name exists but note correctly says "per 24 hours"
        # This is a minor cosmetic issue - field should be renamed to 'daily_limit'
        if "weekly_limit" in data:
            print(f"⚠️ Minor: Field 'weekly_limit' should be renamed to 'daily_limit' for consistency")
        
        print(f"✅ User-facing note correctly says 24 hours: {data.get('note')}")


class TestBankRedeemEligibility:
    """Test 3: GET /api/bank-redeem/check-eligibility/{user_id} - eligibility check working"""
    
    def test_eligibility_check_returns_valid_response(self):
        """Eligibility check should return valid response"""
        response = requests.get(
            f"{BASE_URL}/api/bank-redeem/check-eligibility/{TEST_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200, f"Eligibility check failed: {response.text}"
        data = response.json()
        
        # Should have either eligible=True/False or a reason
        assert "eligible" in data or "reason" in data, f"Missing eligibility info: {data}"
        
        print(f"✅ Eligibility check returned: {data}")
        return data
    
    def test_eligibility_error_messages_use_24_hours(self):
        """If not eligible, error messages should mention 24 hours, not 7 days or 28 days"""
        response = requests.get(
            f"{BASE_URL}/api/bank-redeem/check-eligibility/{TEST_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check message field if present
        message = data.get("message", "")
        response_str = json.dumps(data).lower()
        
        # Should NOT contain old cooldown references
        assert "28 day" not in response_str, f"Found '28 day' in eligibility: {data}"
        assert "28-day" not in response_str, f"Found '28-day' in eligibility: {data}"
        assert "7 day" not in response_str, f"Found '7 day' in eligibility: {data}"
        assert "7-day" not in response_str, f"Found '7-day' in eligibility: {data}"
        
        # If there's a cooldown message, it should mention 24 hours
        if "limit" in message.lower() or "cooldown" in message.lower():
            assert "24" in message or "hour" in message.lower(), f"Cooldown message should mention 24 hours: {message}"
        
        print(f"✅ Eligibility messages use correct cooldown period")


class TestServiceCooldownEndpoint:
    """Test 4: GET /api/service/cooldown/{user_id}/bank_transfer - cooldown check returns correct data"""
    
    def test_cooldown_endpoint_returns_valid_response(self):
        """Cooldown endpoint should return valid response"""
        response = requests.get(
            f"{BASE_URL}/api/service/cooldown/{TEST_USER_UID}/bank_transfer",
            timeout=10
        )
        assert response.status_code == 200, f"Cooldown endpoint failed: {response.text}"
        data = response.json()
        
        # Should have allowed field
        assert "allowed" in data, f"Missing 'allowed' field: {data}"
        
        # Should have wait_hours field
        assert "wait_hours" in data, f"Missing 'wait_hours' field: {data}"
        
        print(f"✅ Cooldown endpoint returned: {data}")
        return data
    
    def test_cooldown_message_uses_24_hours(self):
        """Cooldown message should mention 24 hours if not allowed"""
        response = requests.get(
            f"{BASE_URL}/api/service/cooldown/{TEST_USER_UID}/bank_transfer",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        message = data.get("message", "")
        response_str = json.dumps(data).lower()
        
        # Should NOT contain old cooldown references
        assert "28 day" not in response_str, f"Found '28 day' in cooldown: {data}"
        assert "7 day" not in response_str, f"Found '7 day' in cooldown: {data}"
        
        print(f"✅ Cooldown messages use correct period")


class TestNoOldCooldownMessages:
    """Test 5: No remaining '28 days' or '7-day limit' error messages in any redeem endpoint"""
    
    def test_bank_transfer_request_error_uses_24_hours(self):
        """Bank transfer request error should mention 24 hours, not 28 days"""
        # Try to create a request (will likely fail due to various checks, but error message is what we test)
        response = requests.post(
            f"{BASE_URL}/api/bank-transfer/request",
            json={
                "user_id": TEST_USER_UID,
                "amount": 200,
                "bank_details": {
                    "account_holder_name": "TEST USER",
                    "account_number": "123456789012",
                    "ifsc_code": "HDFC0001234"
                }
            },
            timeout=15
        )
        
        # We expect this to fail (user may not have balance, KYC, etc.)
        # But the error message should NOT mention 28 days
        if response.status_code != 200:
            error_text = response.text.lower()
            assert "28 day" not in error_text, f"Found '28 day' in error: {response.text}"
            assert "28-day" not in error_text, f"Found '28-day' in error: {response.text}"
            assert "cooling period" not in error_text or "24" in error_text, f"Cooling period should be 24h: {response.text}"
            
            # If it mentions cooldown, should be 24 hours
            if "cooldown" in error_text or "redeem" in error_text:
                # Check that if there's a time reference, it's 24 hours
                if "hour" in error_text or "day" in error_text:
                    assert "24" in error_text or "1 day" in error_text, f"Should mention 24 hours: {response.text}"
        
        print(f"✅ Bank transfer request error messages use 24-hour cooldown")
    
    def test_bank_redeem_request_error_uses_24_hours(self):
        """Bank redeem request error should mention 24 hours, not 7 days"""
        response = requests.post(
            f"{BASE_URL}/api/bank-redeem/request/{TEST_USER_UID}",
            json={"amount_inr": 200},
            timeout=15
        )
        
        if response.status_code != 200:
            error_text = response.text.lower()
            assert "7 day" not in error_text, f"Found '7 day' in error: {response.text}"
            assert "7-day" not in error_text, f"Found '7-day' in error: {response.text}"
            assert "per week" not in error_text, f"Found 'per week' in error: {response.text}"
            
            # If it mentions limit, should be 24 hours
            if "limit" in error_text:
                assert "24" in error_text or "hour" in error_text, f"Limit should mention 24 hours: {response.text}"
        
        print(f"✅ Bank redeem request error messages use 24-hour cooldown")


class TestUserRequestHistory:
    """Test user's request history endpoints work correctly"""
    
    def test_user_bank_transfer_history(self):
        """User's bank transfer history should be accessible"""
        response = requests.get(
            f"{BASE_URL}/api/bank-transfer/my-requests/{TEST_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200, f"History endpoint failed: {response.text}"
        data = response.json()
        assert "success" in data or "requests" in data, f"Unexpected response: {data}"
        print(f"✅ Bank transfer history accessible")
    
    def test_user_bank_redeem_history(self):
        """User's bank redeem history should be accessible"""
        response = requests.get(
            f"{BASE_URL}/api/bank-redeem/history/{TEST_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200, f"History endpoint failed: {response.text}"
        data = response.json()
        assert "requests" in data or "total" in data, f"Unexpected response: {data}"
        print(f"✅ Bank redeem history accessible")


class TestCalculateFees:
    """Test fee calculation endpoints work correctly"""
    
    def test_bank_transfer_calculate_fees(self):
        """Fee calculation should work"""
        response = requests.get(
            f"{BASE_URL}/api/bank-transfer/calculate-fees?amount=500",
            timeout=10
        )
        assert response.status_code == 200, f"Calculate fees failed: {response.text}"
        data = response.json()
        assert "success" in data or "fees" in data, f"Unexpected response: {data}"
        print(f"✅ Fee calculation working: {data}")


class TestAdminEndpoints:
    """Test admin endpoints still work (basic check)"""
    
    def test_admin_bank_transfer_stats(self):
        """Admin stats endpoint should be accessible (may require auth)"""
        response = requests.get(
            f"{BASE_URL}/api/bank-transfer/admin/stats",
            timeout=10
        )
        # May return 401 if auth required, but should not crash
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"
        print(f"✅ Admin stats endpoint responding: {response.status_code}")


# Run all tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
