"""
Test Network Analytics Feature for Referral/Downline View
Tests the new /api/referrals/{user_id}/network-analytics endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user IDs
ADMIN_UID = "8175c02a-4fbd-409c-8d47-d864e979f59f"


class TestNetworkAnalyticsEndpoint:
    """Test the network analytics API endpoint"""
    
    def test_network_analytics_returns_200(self):
        """Test that network analytics endpoint returns 200 for valid user"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Network analytics endpoint returns 200")
    
    def test_network_analytics_has_health_score(self):
        """Test that response includes network health score (0-100)"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        assert "network_health_score" in data, "Missing network_health_score field"
        assert isinstance(data["network_health_score"], (int, float)), "Health score should be numeric"
        assert 0 <= data["network_health_score"] <= 100, f"Health score {data['network_health_score']} should be 0-100"
        print(f"✅ Network health score: {data['network_health_score']}")
    
    def test_network_analytics_has_subscription_distribution(self):
        """Test that response includes subscription distribution breakdown"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        assert "subscription_distribution" in data, "Missing subscription_distribution field"
        dist = data["subscription_distribution"]
        
        # Check all subscription plans are present
        expected_plans = ["explorer", "startup", "growth", "elite"]
        for plan in expected_plans:
            assert plan in dist, f"Missing {plan} in subscription distribution"
            assert isinstance(dist[plan], int), f"{plan} count should be integer"
        
        print(f"✅ Subscription distribution: Elite={dist['elite']}, Growth={dist['growth']}, Startup={dist['startup']}, Explorer={dist['explorer']}")
    
    def test_network_analytics_has_level_distribution(self):
        """Test that response includes level distribution (L1-L5)"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        assert "level_distribution" in data, "Missing level_distribution field"
        levels = data["level_distribution"]
        
        assert isinstance(levels, list), "Level distribution should be a list"
        assert len(levels) == 5, f"Expected 5 levels, got {len(levels)}"
        
        for level in levels:
            assert "level" in level, "Missing level number"
            assert "total" in level, "Missing total count"
            assert "active" in level, "Missing active count"
            assert "bonus_percent" in level, "Missing bonus_percent"
            assert level["active"] <= level["total"], f"Active ({level['active']}) cannot exceed total ({level['total']})"
        
        print(f"✅ Level distribution: {[(l['level'], l['total'], l['active']) for l in levels]}")
    
    def test_network_analytics_has_top_performers(self):
        """Test that response includes top performers list"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        assert "top_performers" in data, "Missing top_performers field"
        performers = data["top_performers"]
        
        assert isinstance(performers, list), "Top performers should be a list"
        
        if len(performers) > 0:
            performer = performers[0]
            assert "uid" in performer, "Missing uid in performer"
            assert "name" in performer, "Missing name in performer"
            assert "prc_balance" in performer, "Missing prc_balance in performer"
            assert "subscription_plan" in performer, "Missing subscription_plan in performer"
            assert "is_active" in performer, "Missing is_active in performer"
        
        print(f"✅ Top performers count: {len(performers)}")
    
    def test_network_analytics_has_reengagement_opportunities(self):
        """Test that response includes re-engagement opportunities"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        assert "reengagement_opportunities" in data, "Missing reengagement_opportunities field"
        opportunities = data["reengagement_opportunities"]
        
        assert isinstance(opportunities, list), "Re-engagement opportunities should be a list"
        
        if len(opportunities) > 0:
            opp = opportunities[0]
            assert "uid" in opp, "Missing uid in opportunity"
            assert "name" in opp, "Missing name in opportunity"
            assert "level" in opp, "Missing level in opportunity"
            assert "subscription_plan" in opp, "Missing subscription_plan in opportunity"
        
        print(f"✅ Re-engagement opportunities count: {len(opportunities)}")
    
    def test_network_analytics_has_bonus_metrics(self):
        """Test that response includes bonus opportunity metrics"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        assert "current_bonus_percent" in data, "Missing current_bonus_percent"
        assert "potential_bonus_percent" in data, "Missing potential_bonus_percent"
        assert "bonus_opportunity" in data, "Missing bonus_opportunity"
        
        # Verify bonus_opportunity = potential - current
        expected_opportunity = data["potential_bonus_percent"] - data["current_bonus_percent"]
        assert abs(data["bonus_opportunity"] - expected_opportunity) < 0.1, \
            f"Bonus opportunity mismatch: {data['bonus_opportunity']} vs expected {expected_opportunity}"
        
        print(f"✅ Bonus metrics: Current={data['current_bonus_percent']}%, Potential={data['potential_bonus_percent']}%, Opportunity={data['bonus_opportunity']}%")
    
    def test_network_analytics_has_activity_metrics(self):
        """Test that response includes activity metrics"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        assert "total_network_size" in data, "Missing total_network_size"
        assert "active_users" in data, "Missing active_users"
        assert "inactive_users" in data, "Missing inactive_users"
        assert "activity_rate" in data, "Missing activity_rate"
        
        # Verify active + inactive = total
        assert data["active_users"] + data["inactive_users"] == data["total_network_size"], \
            f"Active ({data['active_users']}) + Inactive ({data['inactive_users']}) should equal Total ({data['total_network_size']})"
        
        print(f"✅ Activity metrics: Total={data['total_network_size']}, Active={data['active_users']}, Inactive={data['inactive_users']}, Rate={data['activity_rate']}%")
    
    def test_network_analytics_invalid_user_returns_404(self):
        """Test that invalid user ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/referrals/invalid-user-id-12345/network-analytics")
        assert response.status_code == 404, f"Expected 404 for invalid user, got {response.status_code}"
        print("✅ Invalid user returns 404")


class TestNetworkAnalyticsDataIntegrity:
    """Test data integrity and consistency of network analytics"""
    
    def test_health_score_calculation_consistency(self):
        """Test that health score is calculated consistently"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        # Health score should be based on:
        # - Activity rate (40% weight)
        # - Subscription quality (30% weight)
        # - Level depth (15% weight)
        # - Recent growth (15% weight)
        
        health_score = data["network_health_score"]
        activity_rate = data["activity_rate"]
        
        # Basic sanity check: if activity rate is 50%, health score should be at least 20 (50 * 0.4)
        if data["total_network_size"] > 0:
            min_expected = activity_rate * 0.4
            assert health_score >= min_expected * 0.9, \
                f"Health score {health_score} seems too low for activity rate {activity_rate}"
        
        print(f"✅ Health score {health_score} is consistent with activity rate {activity_rate}")
    
    def test_subscription_distribution_totals_match(self):
        """Test that subscription distribution totals match network size"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        dist = data["subscription_distribution"]
        total_from_dist = sum(dist.values())
        
        assert total_from_dist == data["total_network_size"], \
            f"Subscription distribution total ({total_from_dist}) doesn't match network size ({data['total_network_size']})"
        
        print(f"✅ Subscription distribution total ({total_from_dist}) matches network size")
    
    def test_level_distribution_totals_match(self):
        """Test that level distribution totals match network size"""
        response = requests.get(f"{BASE_URL}/api/referrals/{ADMIN_UID}/network-analytics")
        data = response.json()
        
        levels = data["level_distribution"]
        total_from_levels = sum(l["total"] for l in levels)
        
        assert total_from_levels == data["total_network_size"], \
            f"Level distribution total ({total_from_levels}) doesn't match network size ({data['total_network_size']})"
        
        print(f"✅ Level distribution total ({total_from_levels}) matches network size")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
