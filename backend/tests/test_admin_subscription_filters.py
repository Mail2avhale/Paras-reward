"""
Admin Subscription Filtering API Tests
Tests the filtering functionality for /api/admin/vip-payments endpoint
- Time filters: today, week, month, all
- Plan filters: all, startup, growth, elite
- Duration filters: all, monthly, quarterly, half_yearly, yearly
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminSubscriptionFilters:
    """Test admin subscription filtering API"""

    def test_api_health(self):
        """Test API is reachable"""
        response = requests.get(f"{BASE_URL}/api/stats", timeout=10)
        assert response.status_code == 200
        print("✓ API health check passed")

    # === TIME FILTER TESTS ===
    
    def test_time_filter_today(self):
        """Test time_filter=today returns recent payments"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&time_filter=today",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        assert "total" in data
        assert "page" in data
        print(f"✓ time_filter=today returned {data['total']} payments")

    def test_time_filter_week(self):
        """Test time_filter=week returns last 7 days payments"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&time_filter=week",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        assert "total" in data
        print(f"✓ time_filter=week returned {data['total']} payments")

    def test_time_filter_month(self):
        """Test time_filter=month returns last 30 days payments"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&time_filter=month",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        assert "total" in data
        print(f"✓ time_filter=month returned {data['total']} payments")

    def test_time_filter_all(self):
        """Test time_filter=all (no time filter) returns all payments"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        assert "total" in data
        print(f"✓ No time filter (all) returned {data['total']} payments")

    # === PLAN FILTER TESTS ===
    
    def test_plan_filter_startup(self):
        """Test plan=startup filters by startup plan"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&plan=startup",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        # Verify returned payments have startup plan
        for payment in data.get("payments", []):
            assert payment.get("plan") == "startup" or payment.get("subscription_plan") == "startup", \
                f"Expected startup plan, got {payment.get('plan')} / {payment.get('subscription_plan')}"
        print(f"✓ plan=startup returned {data['total']} payments")

    def test_plan_filter_growth(self):
        """Test plan=growth filters by growth plan"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&plan=growth",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        for payment in data.get("payments", []):
            assert payment.get("plan") == "growth" or payment.get("subscription_plan") == "growth", \
                f"Expected growth plan, got {payment.get('plan')} / {payment.get('subscription_plan')}"
        print(f"✓ plan=growth returned {data['total']} payments")

    def test_plan_filter_elite(self):
        """Test plan=elite filters by elite plan"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&plan=elite",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        for payment in data.get("payments", []):
            assert payment.get("plan") == "elite" or payment.get("subscription_plan") == "elite", \
                f"Expected elite plan, got {payment.get('plan')} / {payment.get('subscription_plan')}"
        print(f"✓ plan=elite returned {data['total']} payments")

    # === DURATION FILTER TESTS ===
    
    def test_duration_filter_monthly(self):
        """Test duration=monthly filters by monthly duration"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&duration=monthly",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ duration=monthly returned {data['total']} payments")

    def test_duration_filter_quarterly(self):
        """Test duration=quarterly filters by quarterly duration"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&duration=quarterly",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ duration=quarterly returned {data['total']} payments")

    def test_duration_filter_half_yearly(self):
        """Test duration=half_yearly filters by half yearly duration"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&duration=half_yearly",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ duration=half_yearly returned {data['total']} payments")

    def test_duration_filter_yearly(self):
        """Test duration=yearly filters by yearly duration"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&duration=yearly",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ duration=yearly returned {data['total']} payments")

    # === COMBINED FILTER TESTS ===
    
    def test_combined_plan_and_time_filter(self):
        """Test combining plan and time filter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&plan=startup&time_filter=month",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ Combined plan=startup + time_filter=month returned {data['total']} payments")

    def test_combined_plan_and_duration_filter(self):
        """Test combining plan and duration filter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&plan=startup&duration=monthly",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ Combined plan=startup + duration=monthly returned {data['total']} payments")

    def test_combined_all_filters(self):
        """Test combining all three filters"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=approved&page=1&limit=10&plan=startup&duration=monthly&time_filter=month",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ Combined all filters returned {data['total']} payments")

    # === PENDING STATUS FILTER TESTS ===
    
    def test_pending_with_plan_filter(self):
        """Test filtering pending payments by plan"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=pending&page=1&limit=10&plan=startup",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ Pending payments with plan=startup returned {data['total']} payments")

    def test_pending_with_time_filter(self):
        """Test filtering pending payments by time"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vip-payments?status=pending&page=1&limit=10&time_filter=week",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ Pending payments with time_filter=week returned {data['total']} payments")

    # === SUBSCRIPTION STATS ENDPOINT ===
    
    def test_subscription_stats(self):
        """Test subscription stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/subscription-stats",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "plan_counts" in data
        assert "total_users" in data
        assert "vip_users" in data
        print(f"✓ Subscription stats - Total: {data['total_users']}, VIP: {data['vip_users']}")
        print(f"  Plan counts: {data['plan_counts']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
