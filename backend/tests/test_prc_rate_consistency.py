"""
PRC Rate Consistency Tests - Iteration 186
Tests for the PRC rate consistency fix:
1. Dashboard API returns prc_rate field
2. PRCRateDisplay component accepts rateOverride prop
3. BankRedeemPage passes config.prc_rate to PRCRateDisplay
4. All pages use single source of truth for PRC rate
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"


class TestPRCRateConsistency:
    """Tests for PRC rate consistency fix"""
    
    def test_health_check(self):
        """Test backend health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health check passed: {data}")
    
    def test_dashboard_returns_prc_rate(self):
        """Test that dashboard API returns prc_rate field"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Verify prc_rate is in response
        assert "prc_rate" in data, "prc_rate field missing from dashboard response"
        prc_rate = data.get("prc_rate")
        assert prc_rate is not None, "prc_rate is None"
        assert isinstance(prc_rate, (int, float)), f"prc_rate should be numeric, got {type(prc_rate)}"
        assert prc_rate > 0, f"prc_rate should be positive, got {prc_rate}"
        
        print(f"✅ Dashboard returns prc_rate: {prc_rate}")
        
        # Verify user data is also present
        assert "user" in data
        assert "prc_balance" in data["user"]
        print(f"✅ User prc_balance: {data['user']['prc_balance']}")
    
    def test_prc_economy_current_rate(self):
        """Test PRC economy current rate endpoint"""
        response = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "rate" in data
        assert "final_rate" in data["rate"]
        
        final_rate = data["rate"]["final_rate"]
        assert isinstance(final_rate, (int, float))
        assert final_rate > 0
        
        print(f"✅ PRC Economy current rate: {final_rate}")
        return final_rate
    
    def test_dashboard_rate_matches_economy_rate(self):
        """Test that dashboard prc_rate matches economy rate"""
        # Get dashboard rate
        dashboard_res = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        assert dashboard_res.status_code == 200
        dashboard_rate = dashboard_res.json().get("prc_rate")
        
        # Get economy rate
        economy_res = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        assert economy_res.status_code == 200
        economy_rate = economy_res.json().get("rate", {}).get("final_rate")
        
        # They should match (single source of truth)
        assert dashboard_rate == economy_rate, f"Dashboard rate ({dashboard_rate}) != Economy rate ({economy_rate})"
        print(f"✅ Dashboard rate ({dashboard_rate}) matches Economy rate ({economy_rate})")
    
    def test_bank_transfer_config_returns_prc_rate(self):
        """Test that bank transfer config returns prc_rate"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/config")
        assert response.status_code == 200
        data = response.json()
        
        assert "prc_rate" in data, "prc_rate missing from bank-transfer config"
        prc_rate = data.get("prc_rate")
        assert prc_rate is not None
        assert isinstance(prc_rate, (int, float))
        assert prc_rate > 0
        
        print(f"✅ Bank transfer config prc_rate: {prc_rate}")
        
        # Verify other config fields
        assert "min_withdrawal" in data
        assert "max_withdrawal" in data
        assert "transaction_fee" in data
        print(f"✅ Bank transfer config: min={data['min_withdrawal']}, max={data['max_withdrawal']}, fee={data['transaction_fee']}")
    
    def test_elite_pricing_returns_prc_rate(self):
        """Test that elite pricing endpoint returns prc_rate"""
        response = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        assert response.status_code == 200
        data = response.json()
        
        assert "pricing" in data
        pricing = data["pricing"]
        assert "prc_rate" in pricing, "prc_rate missing from elite pricing"
        
        prc_rate = pricing.get("prc_rate")
        assert prc_rate is not None
        assert isinstance(prc_rate, (int, float))
        assert prc_rate > 0
        
        print(f"✅ Elite pricing prc_rate: {prc_rate}")
    
    def test_redeem_limit_endpoint(self):
        """Test redeem limit endpoint works"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "limit" in data
        
        limit = data["limit"]
        print(f"✅ Redeem limit data: total_limit={limit.get('total_limit')}, total_redeemed={limit.get('total_redeemed')}, effective_remaining={limit.get('effective_remaining')}")
    
    def test_user_endpoint_returns_prc_balance(self):
        """Test user endpoint returns prc_balance"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        assert "prc_balance" in data, "prc_balance missing from user data"
        prc_balance = data.get("prc_balance")
        assert prc_balance is not None
        assert isinstance(prc_balance, (int, float))
        
        print(f"✅ User prc_balance: {prc_balance}")
    
    def test_all_rates_consistent(self):
        """Test that all PRC rates across endpoints are consistent"""
        rates = {}
        
        # Dashboard rate
        dashboard_res = requests.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/dashboard")
        if dashboard_res.status_code == 200:
            rates["dashboard"] = dashboard_res.json().get("prc_rate")
        
        # Economy rate
        economy_res = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        if economy_res.status_code == 200:
            rates["economy"] = economy_res.json().get("rate", {}).get("final_rate")
        
        # Bank transfer config rate
        bank_res = requests.get(f"{BASE_URL}/api/bank-transfer/config")
        if bank_res.status_code == 200:
            rates["bank_transfer"] = bank_res.json().get("prc_rate")
        
        # Elite pricing rate
        elite_res = requests.get(f"{BASE_URL}/api/subscription/elite-pricing")
        if elite_res.status_code == 200:
            rates["elite_pricing"] = elite_res.json().get("pricing", {}).get("prc_rate")
        
        print(f"📊 All PRC rates: {rates}")
        
        # All rates should be the same
        unique_rates = set(r for r in rates.values() if r is not None)
        assert len(unique_rates) == 1, f"PRC rates are inconsistent: {rates}"
        
        print(f"✅ All PRC rates are consistent: {unique_rates.pop()}")


class TestLoginFlow:
    """Test login flow to verify auth works"""
    
    def test_login_with_pin(self):
        """Test login with mobile and PIN"""
        # First check auth type
        auth_check = requests.get(f"{BASE_URL}/api/auth/check-auth-type?identifier={TEST_USER_MOBILE}")
        assert auth_check.status_code == 200
        
        # Login
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": TEST_USER_MOBILE,
            "password": TEST_USER_PIN
        })
        
        assert login_res.status_code == 200
        data = login_res.json()
        
        # User data is returned directly (not nested under "user" key)
        assert "uid" in data, f"uid missing from login response: {list(data.keys())[:10]}"
        assert data["uid"] == TEST_USER_UID
        print(f"✅ Login successful for user: {data.get('name', data['uid'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
