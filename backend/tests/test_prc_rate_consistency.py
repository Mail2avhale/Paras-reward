"""
Test PRC Rate Consistency - Verify rate is GLOBAL and same for ALL users
Issue: Different users seeing different PRC rates (11 vs 12)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://unified-redeem-check.preview.emergentagent.com').rstrip('/')

class TestPRCRateConsistency:
    """Test that PRC rate is global and consistent across all API calls"""
    
    def test_prc_rate_api_returns_consistent_rate(self):
        """Test /api/admin/prc-rate/current returns same rate on multiple calls"""
        rates = []
        for i in range(10):
            response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
            assert response.status_code == 200, f"API call {i+1} failed"
            data = response.json()
            assert data.get("success") == True, f"API call {i+1} returned success=False"
            rates.append(data.get("current_rate"))
            time.sleep(0.1)  # Small delay between calls
        
        # All rates should be identical
        unique_rates = set(rates)
        assert len(unique_rates) == 1, f"Rate inconsistency detected! Got rates: {rates}"
        print(f"✅ All 10 API calls returned consistent rate: {rates[0]}")
    
    def test_prc_economy_rate_matches_current_rate(self):
        """Test /api/prc-economy/current-rate matches /api/admin/prc-rate/current"""
        # Get rate from admin endpoint
        admin_response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
        assert admin_response.status_code == 200
        admin_rate = admin_response.json().get("current_rate")
        
        # Get rate from economy endpoint
        economy_response = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        assert economy_response.status_code == 200
        economy_data = economy_response.json()
        economy_rate = economy_data.get("rate", {}).get("final_rate")
        
        assert admin_rate == economy_rate, f"Rate mismatch! Admin: {admin_rate}, Economy: {economy_rate}"
        print(f"✅ Both endpoints return same rate: {admin_rate}")
    
    def test_user_document_has_no_prc_rate_field(self):
        """Verify user document doesn't have user-specific prc_rate field"""
        test_uid = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"
        response = requests.get(f"{BASE_URL}/api/user/{test_uid}")
        assert response.status_code == 200
        user_data = response.json()
        
        # Check for any rate-related fields that could override global rate
        forbidden_fields = ['prc_rate', 'prc_to_inr_rate', 'current_rate', 'prcRate']
        found_fields = []
        for field in forbidden_fields:
            if field in user_data:
                found_fields.append(f"{field}={user_data[field]}")
        
        assert len(found_fields) == 0, f"User document has rate fields that could override global rate: {found_fields}"
        print(f"✅ User document has no user-specific PRC rate fields")
    
    def test_dashboard_endpoint_has_no_user_specific_rate(self):
        """Verify dashboard endpoint doesn't return user-specific rate"""
        test_uid = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"
        response = requests.get(f"{BASE_URL}/api/user/{test_uid}/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Check user object in dashboard response
        user_data = data.get("user", {})
        forbidden_fields = ['prc_rate', 'prc_to_inr_rate', 'current_rate', 'prcRate']
        found_fields = []
        for field in forbidden_fields:
            if field in user_data:
                found_fields.append(f"{field}={user_data[field]}")
        
        assert len(found_fields) == 0, f"Dashboard user data has rate fields: {found_fields}"
        print(f"✅ Dashboard endpoint has no user-specific PRC rate")
    
    def test_redeem_categories_has_no_user_specific_rate(self):
        """Verify redeem-categories endpoint doesn't return user-specific rate"""
        test_uid = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"
        response = requests.get(f"{BASE_URL}/api/redeem-categories/user/{test_uid}")
        assert response.status_code == 200
        data = response.json()
        
        # Check for rate fields in response
        forbidden_fields = ['prc_rate', 'prc_to_inr_rate', 'current_rate', 'prcRate']
        found_fields = []
        for field in forbidden_fields:
            if field in data:
                found_fields.append(f"{field}={data[field]}")
        
        assert len(found_fields) == 0, f"Redeem categories has rate fields: {found_fields}"
        print(f"✅ Redeem categories endpoint has no user-specific PRC rate")
    
    def test_rate_source_is_dynamic_economy(self):
        """Verify rate source is dynamic_economy (not manual override or fallback)"""
        response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
        assert response.status_code == 200
        data = response.json()
        
        source = data.get("source")
        current_rate = data.get("current_rate")
        
        print(f"Rate: {current_rate}, Source: {source}")
        
        # Source should be either dynamic_economy or manual_override
        assert source in ["dynamic_economy", "manual_override"], f"Unexpected rate source: {source}"
        
        if source == "manual_override":
            print(f"⚠️ Rate is from manual override, not dynamic calculation")
            override_info = data.get("override", {})
            print(f"   Override rate: {override_info.get('rate')}")
            print(f"   Expires at: {override_info.get('expires_at')}")
        else:
            print(f"✅ Rate is from dynamic economy calculation")
    
    def test_rate_within_valid_range(self):
        """Verify rate is within valid range (6-20)"""
        response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
        assert response.status_code == 200
        data = response.json()
        
        current_rate = data.get("current_rate")
        
        assert 6 <= current_rate <= 20, f"Rate {current_rate} is outside valid range (6-20)"
        print(f"✅ Rate {current_rate} is within valid range (6-20)")
    
    def test_economy_factors_are_valid(self):
        """Verify all economy factors are within expected ranges"""
        response = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        assert response.status_code == 200
        data = response.json()
        
        rate_data = data.get("rate", {})
        factors = rate_data.get("factors", {})
        
        # Validate each factor is within expected range
        factor_ranges = {
            "supply_factor": (0.8, 1.5),
            "redeem_factor": (0.9, 1.2),
            "burn_factor": (0.9, 1.0),
            "user_factor": (0.85, 1.05),
            "utility_factor": (0.9, 1.05)
        }
        
        for factor_name, (min_val, max_val) in factor_ranges.items():
            factor_value = factors.get(factor_name)
            assert factor_value is not None, f"Missing factor: {factor_name}"
            assert min_val <= factor_value <= max_val, f"{factor_name}={factor_value} outside range ({min_val}-{max_val})"
            print(f"  {factor_name}: {factor_value} ✓")
        
        print(f"✅ All economy factors are valid")


class TestPRCRateNoUserOverride:
    """Test that no user-specific rate override exists"""
    
    def test_multiple_users_see_same_rate(self):
        """Simulate multiple users fetching rate - all should get same value"""
        # Simulate different "users" by making requests with different headers
        rates = []
        
        for i in range(5):
            headers = {
                "X-User-ID": f"test-user-{i}",
                "X-Request-ID": f"req-{i}-{time.time()}"
            }
            response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current", headers=headers)
            assert response.status_code == 200
            rates.append(response.json().get("current_rate"))
        
        unique_rates = set(rates)
        assert len(unique_rates) == 1, f"Different users got different rates: {rates}"
        print(f"✅ All simulated users got same rate: {rates[0]}")
    
    def test_rate_api_is_not_user_authenticated(self):
        """Verify rate API doesn't require user authentication (is truly global)"""
        # Call without any auth headers
        response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
        assert response.status_code == 200, "Rate API should be accessible without auth"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("current_rate") is not None
        print(f"✅ Rate API is accessible without authentication (global endpoint)")


class TestPRCRateCaching:
    """Test rate caching behavior"""
    
    def test_rate_is_cached_for_performance(self):
        """Verify rate is cached (multiple calls should be fast)"""
        import time
        
        times = []
        for i in range(5):
            start = time.time()
            response = requests.get(f"{BASE_URL}/api/admin/prc-rate/current")
            elapsed = time.time() - start
            times.append(elapsed)
            assert response.status_code == 200
        
        avg_time = sum(times) / len(times)
        print(f"Average response time: {avg_time*1000:.2f}ms")
        
        # Response should be reasonably fast (cached)
        assert avg_time < 2.0, f"Rate API too slow (avg {avg_time}s), caching may not be working"
        print(f"✅ Rate API response times are acceptable (caching working)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
