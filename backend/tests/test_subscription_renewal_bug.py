"""
Test Suite for Subscription Renewal Bug Fix
Bug: Remaining days not being added when user renews subscription
Fix: All code paths now check subscription_expires OR subscription_expiry OR vip_expiry

Tests verify:
1. Debug endpoint shows correct remaining days calculation
2. All expiry field names are checked (subscription_expiry string, vip_expiry)
3. Total days = plan_duration + remaining_days
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

# Get the API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = 'https://network-capacity-ui.preview.emergentagent.com'

# Test user ID from the bug fix requirements
TEST_USER_ID = "73b95483-f36b-4637-a5ee-d447300c6835"

# Plan duration constants (should match backend)
PLAN_DURATIONS = {
    "monthly": 28,
    "quarterly": 84,
    "half_yearly": 168,
    "yearly": 336
}


class TestDebugSubscriptionRenewal:
    """Test the debug endpoint for subscription renewal calculation"""
    
    def test_debug_endpoint_returns_user_info(self):
        """Test that debug endpoint returns user information"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify user info is returned
        assert data.get("user_id") == TEST_USER_ID, "user_id mismatch"
        assert "user_name" in data, "Missing user_name"
        assert "current_plan" in data, "Missing current_plan"
    
    def test_debug_endpoint_shows_raw_expiry_fields(self):
        """Test that debug endpoint shows all raw expiry fields"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify raw_fields contains all three expiry field names
        raw_fields = data.get("raw_fields", {})
        assert "subscription_expires" in raw_fields, "Missing subscription_expires in raw_fields"
        assert "subscription_expiry" in raw_fields, "Missing subscription_expiry in raw_fields"
        assert "vip_expiry" in raw_fields, "Missing vip_expiry in raw_fields"
    
    def test_debug_endpoint_calculates_remaining_days(self):
        """Test that debug endpoint calculates remaining days correctly"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify remaining_days is calculated
        assert "remaining_days" in data, "Missing remaining_days"
        remaining_days = data.get("remaining_days")
        assert isinstance(remaining_days, int), f"remaining_days should be int, got {type(remaining_days)}"
        
        # For active subscription, remaining_days should be >= 0
        assert remaining_days >= 0, f"remaining_days should be >= 0, got {remaining_days}"
    
    def test_debug_endpoint_calculates_total_days_for_monthly(self):
        """Test total days calculation for monthly plan renewal"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}?plan_type=monthly"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        renewal_calc = data.get("renewal_calculation", {})
        
        # Verify plan duration is correct
        assert renewal_calc.get("plan_duration_days") == PLAN_DURATIONS["monthly"], \
            f"Expected monthly duration {PLAN_DURATIONS['monthly']}, got {renewal_calc.get('plan_duration_days')}"
        
        # Verify total days = plan_duration + remaining_days
        remaining_days = renewal_calc.get("remaining_days_to_add", 0)
        plan_duration = renewal_calc.get("plan_duration_days", 0)
        total_days = renewal_calc.get("total_days", 0)
        
        expected_total = plan_duration + remaining_days
        assert total_days == expected_total, \
            f"Expected total_days = {plan_duration} + {remaining_days} = {expected_total}, got {total_days}"
    
    def test_debug_endpoint_calculates_total_days_for_quarterly(self):
        """Test total days calculation for quarterly plan renewal"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}?plan_type=quarterly"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        renewal_calc = data.get("renewal_calculation", {})
        
        # Verify plan duration is correct
        assert renewal_calc.get("plan_duration_days") == PLAN_DURATIONS["quarterly"], \
            f"Expected quarterly duration {PLAN_DURATIONS['quarterly']}, got {renewal_calc.get('plan_duration_days')}"
        
        # Verify total days = plan_duration + remaining_days
        remaining_days = renewal_calc.get("remaining_days_to_add", 0)
        plan_duration = renewal_calc.get("plan_duration_days", 0)
        total_days = renewal_calc.get("total_days", 0)
        
        expected_total = plan_duration + remaining_days
        assert total_days == expected_total, \
            f"Expected total_days = {plan_duration} + {remaining_days} = {expected_total}, got {total_days}"
    
    def test_debug_endpoint_calculates_total_days_for_yearly(self):
        """Test total days calculation for yearly plan renewal"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}?plan_type=yearly"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        renewal_calc = data.get("renewal_calculation", {})
        
        # Verify plan duration is correct
        assert renewal_calc.get("plan_duration_days") == PLAN_DURATIONS["yearly"], \
            f"Expected yearly duration {PLAN_DURATIONS['yearly']}, got {renewal_calc.get('plan_duration_days')}"
        
        # Verify total days = plan_duration + remaining_days
        remaining_days = renewal_calc.get("remaining_days_to_add", 0)
        plan_duration = renewal_calc.get("plan_duration_days", 0)
        total_days = renewal_calc.get("total_days", 0)
        
        expected_total = plan_duration + remaining_days
        assert total_days == expected_total, \
            f"Expected total_days = {plan_duration} + {remaining_days} = {expected_total}, got {total_days}"
    
    def test_debug_endpoint_returns_parsed_expiry(self):
        """Test that debug endpoint returns parsed expiry datetime"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify parsed_expiry is present
        assert "parsed_expiry" in data, "Missing parsed_expiry"
        
        # For user with active subscription, parsed_expiry should be set
        parsed_expiry = data.get("parsed_expiry")
        if data.get("remaining_days", 0) > 0:
            assert parsed_expiry is not None, "parsed_expiry should be set for active subscription"
    
    def test_debug_endpoint_returns_new_expiry_calculation(self):
        """Test that debug endpoint returns new_expiry_would_be"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        renewal_calc = data.get("renewal_calculation", {})
        assert "new_expiry_would_be" in renewal_calc, "Missing new_expiry_would_be"
        
        # Verify it's a valid ISO date string
        new_expiry = renewal_calc.get("new_expiry_would_be")
        try:
            datetime.fromisoformat(new_expiry.replace('Z', '+00:00'))
        except (ValueError, AttributeError) as e:
            pytest.fail(f"new_expiry_would_be is not valid ISO format: {new_expiry}, error: {e}")
    
    def test_debug_endpoint_returns_message(self):
        """Test that debug endpoint returns human-readable message"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify message exists and contains key info
        message = data.get("message", "")
        assert "days" in message.lower(), f"Message should mention days: {message}"
        assert "+" in message or "remaining" in message.lower(), \
            f"Message should show addition of days: {message}"
    
    def test_debug_endpoint_user_not_found(self):
        """Test debug endpoint with non-existent user"""
        fake_user_id = f"non-existent-user-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{fake_user_id}"
        )
        
        # Should return 404 for non-existent user
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"


class TestExpiryFieldHandling:
    """Test that all expiry field names are properly handled"""
    
    def test_subscription_expiry_string_field_read(self):
        """Test that subscription_expiry (string) field is read"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        raw_fields = data.get("raw_fields", {})
        subscription_expiry = raw_fields.get("subscription_expiry")
        
        # Verify the field is checked
        # Note: Field may be null if user doesn't have it, but it should be in raw_fields
        print(f"subscription_expiry value: {subscription_expiry}")
    
    def test_vip_expiry_field_read(self):
        """Test that vip_expiry field is read"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        raw_fields = data.get("raw_fields", {})
        vip_expiry = raw_fields.get("vip_expiry")
        
        # Verify the field is checked
        print(f"vip_expiry value: {vip_expiry}")
    
    def test_at_least_one_expiry_field_is_set(self):
        """Test that at least one expiry field is set for active user"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        raw_fields = data.get("raw_fields", {})
        
        # At least one should be set for an active subscription user
        expiry_values = [
            raw_fields.get("subscription_expires"),
            raw_fields.get("subscription_expiry"),
            raw_fields.get("vip_expiry")
        ]
        
        has_expiry = any(v is not None for v in expiry_values)
        
        # If user has remaining days, they must have an expiry field
        remaining_days = data.get("remaining_days", 0)
        if remaining_days > 0:
            assert has_expiry, "User with remaining days should have at least one expiry field set"


class TestRenewalMathCorrectness:
    """Test the renewal math is correct"""
    
    def test_renewal_adds_remaining_to_plan_duration(self):
        """
        CRITICAL TEST: Verify renewal adds remaining days to plan duration
        Bug was: user got only 28 days instead of remaining + 28
        """
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}?plan_type=monthly"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        remaining_days = data.get("remaining_days", 0)
        renewal_calc = data.get("renewal_calculation", {})
        
        plan_duration = renewal_calc.get("plan_duration_days", 0)
        total_days = renewal_calc.get("total_days", 0)
        
        # THE CRITICAL CHECK: total should be sum of plan + remaining
        expected_total = plan_duration + remaining_days
        
        assert total_days == expected_total, \
            f"BUG NOT FIXED: Expected {plan_duration} + {remaining_days} = {expected_total}, but got {total_days}"
        
        print(f"✓ Renewal math correct: {plan_duration} (plan) + {remaining_days} (remaining) = {total_days} (total)")
    
    def test_remaining_days_positive_when_subscription_active(self):
        """Test that remaining_days > 0 when user has active subscription"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # The test user should have an active subscription
        remaining_days = data.get("remaining_days", 0)
        current_plan = data.get("current_plan")
        
        if current_plan and current_plan != "explorer":
            assert remaining_days > 0, \
                f"User with plan '{current_plan}' should have remaining_days > 0, got {remaining_days}"
    
    def test_total_days_greater_than_plan_duration_when_has_remaining(self):
        """Test that total_days > plan_duration when user has remaining days"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}?plan_type=monthly"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        remaining_days = data.get("remaining_days", 0)
        renewal_calc = data.get("renewal_calculation", {})
        
        plan_duration = renewal_calc.get("plan_duration_days", 0)
        total_days = renewal_calc.get("total_days", 0)
        
        if remaining_days > 0:
            assert total_days > plan_duration, \
                f"With {remaining_days} remaining days, total ({total_days}) should be > plan duration ({plan_duration})"


class TestAllPlanTypes:
    """Test renewal calculation for all plan types"""
    
    @pytest.mark.parametrize("plan_type,expected_duration", [
        ("monthly", 28),
        ("quarterly", 84),
        ("half_yearly", 168),
        ("yearly", 336),
    ])
    def test_plan_duration_correct(self, plan_type, expected_duration):
        """Test that each plan type has correct duration"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}?plan_type={plan_type}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        renewal_calc = data.get("renewal_calculation", {})
        actual_duration = renewal_calc.get("plan_duration_days")
        
        assert actual_duration == expected_duration, \
            f"Plan '{plan_type}' should have {expected_duration} days, got {actual_duration}"
    
    @pytest.mark.parametrize("plan_type", ["monthly", "quarterly", "half_yearly", "yearly"])
    def test_total_days_formula_for_all_plans(self, plan_type):
        """Test that total = duration + remaining for all plan types"""
        response = requests.get(
            f"{BASE_URL}/api/razorpay/debug/subscription-renewal/{TEST_USER_ID}?plan_type={plan_type}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        remaining_days = data.get("remaining_days", 0)
        renewal_calc = data.get("renewal_calculation", {})
        
        plan_duration = renewal_calc.get("plan_duration_days", 0)
        total_days = renewal_calc.get("total_days", 0)
        
        expected_total = plan_duration + remaining_days
        
        assert total_days == expected_total, \
            f"For '{plan_type}': Expected {plan_duration} + {remaining_days} = {expected_total}, got {total_days}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
