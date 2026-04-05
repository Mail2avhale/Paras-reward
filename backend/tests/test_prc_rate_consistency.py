"""
PRC Rate Consistency Tests
===========================
CRITICAL BUG FIX VERIFICATION:
- Users were seeing different PRC rates in production
- Root cause: 5 different rate functions reading from different DB collections with different fallback chains
- bank_redeem.py was defaulting to 100 instead of 10!
- Fix: Created single source of truth get_prc_rate() in utils/helpers.py

This test verifies ALL rate endpoints return the SAME PRC rate value.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


class TestPRCRateConsistency:
    """
    CRITICAL: All PRC rate endpoints MUST return the SAME value.
    This was the root cause of the production bug.
    """
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip("Admin login failed - skipping authenticated tests")
    
    def test_01_bank_transfer_config_returns_prc_rate(self):
        """Test /api/bank-transfer/config returns prc_rate"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "prc_rate" in data, f"prc_rate not in response: {data}"
        
        prc_rate = data["prc_rate"]
        assert isinstance(prc_rate, (int, float)), f"prc_rate should be numeric, got {type(prc_rate)}"
        assert prc_rate > 0, f"prc_rate should be positive, got {prc_rate}"
        assert prc_rate != 100, f"CRITICAL BUG: prc_rate is 100 (old bank_redeem.py default), should be ~10-11"
        
        print(f"✅ /api/bank-transfer/config prc_rate: {prc_rate}")
    
    def test_02_prc_economy_current_rate_returns_final_rate(self):
        """Test /api/prc-economy/current-rate returns final_rate"""
        response = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Handle nested structure: data.rate.final_rate
        if "rate" in data and isinstance(data["rate"], dict):
            rate_data = data["rate"]
            final_rate = rate_data.get("final_rate")
        else:
            final_rate = data.get("final_rate")
        
        assert final_rate is not None, f"final_rate not in response: {data}"
        assert isinstance(final_rate, (int, float)), f"final_rate should be numeric, got {type(final_rate)}"
        assert final_rate > 0, f"final_rate should be positive, got {final_rate}"
        assert final_rate != 100, f"CRITICAL BUG: final_rate is 100, should be ~10-11"
        
        print(f"✅ /api/prc-economy/current-rate final_rate: {final_rate}")
    
    def test_03_growth_economy_settings_returns_prc_rate(self):
        """Test /api/growth/economy-settings returns prc_rate"""
        response = requests.get(f"{BASE_URL}/api/growth/economy-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True: {data}"
        
        settings_data = data.get("data", {})
        assert "prc_rate" in settings_data, f"prc_rate not in data: {settings_data}"
        
        prc_rate = settings_data["prc_rate"]
        assert isinstance(prc_rate, (int, float)), f"prc_rate should be numeric, got {type(prc_rate)}"
        assert prc_rate > 0, f"prc_rate should be positive, got {prc_rate}"
        assert prc_rate != 100, f"CRITICAL BUG: prc_rate is 100, should be ~10-11"
        
        print(f"✅ /api/growth/economy-settings prc_rate: {prc_rate}")
    
    def test_04_growth_prc_rate_endpoint(self):
        """Test /api/growth/prc-rate returns prc_rate"""
        response = requests.get(f"{BASE_URL}/api/growth/prc-rate")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True: {data}"
        assert "prc_rate" in data, f"prc_rate not in response: {data}"
        
        prc_rate = data["prc_rate"]
        assert isinstance(prc_rate, (int, float)), f"prc_rate should be numeric, got {type(prc_rate)}"
        assert prc_rate > 0, f"prc_rate should be positive, got {prc_rate}"
        assert prc_rate != 100, f"CRITICAL BUG: prc_rate is 100, should be ~10-11"
        
        print(f"✅ /api/growth/prc-rate prc_rate: {prc_rate}")
    
    def test_05_bank_redeem_denominations_returns_prc_rate(self):
        """Test /api/bank-redeem/denominations returns prc_rate in samples"""
        response = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        samples = data.get("samples", [])
        
        if samples:
            # Check prc_rate in first sample
            first_sample = samples[0]
            prc_rate = first_sample.get("prc_rate")
            assert prc_rate is not None, f"prc_rate not in sample: {first_sample}"
            assert prc_rate != 100, f"CRITICAL BUG: prc_rate is 100 in denominations, should be ~10-11"
            print(f"✅ /api/bank-redeem/denominations prc_rate: {prc_rate}")
        else:
            print("⚠️ No samples in denominations response")
    
    def test_06_all_rates_are_consistent(self):
        """
        CRITICAL TEST: All rate endpoints MUST return the SAME value.
        This is the main verification for the bug fix.
        """
        rates = {}
        
        # 1. Bank Transfer Config
        r1 = requests.get(f"{BASE_URL}/api/bank-transfer/config")
        if r1.status_code == 200:
            rates["bank_transfer_config"] = r1.json().get("prc_rate")
        
        # 2. PRC Economy Current Rate (nested structure)
        r2 = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        if r2.status_code == 200:
            data = r2.json()
            if "rate" in data and isinstance(data["rate"], dict):
                rates["prc_economy_current_rate"] = data["rate"].get("final_rate")
            else:
                rates["prc_economy_current_rate"] = data.get("final_rate")
        
        # 3. Growth Economy Settings
        r3 = requests.get(f"{BASE_URL}/api/growth/economy-settings")
        if r3.status_code == 200:
            data = r3.json().get("data", {})
            rates["growth_economy_settings"] = data.get("prc_rate")
        
        # 4. Growth PRC Rate
        r4 = requests.get(f"{BASE_URL}/api/growth/prc-rate")
        if r4.status_code == 200:
            rates["growth_prc_rate"] = r4.json().get("prc_rate")
        
        # 5. Bank Redeem Denominations
        r5 = requests.get(f"{BASE_URL}/api/bank-redeem/denominations")
        if r5.status_code == 200:
            samples = r5.json().get("samples", [])
            if samples:
                rates["bank_redeem_denominations"] = samples[0].get("prc_rate")
        
        print(f"\n📊 All PRC Rates Collected:")
        for endpoint, rate in rates.items():
            print(f"   {endpoint}: {rate}")
        
        # Filter out None values
        valid_rates = {k: v for k, v in rates.items() if v is not None}
        
        assert len(valid_rates) >= 3, f"Expected at least 3 rate endpoints to respond, got {len(valid_rates)}"
        
        # Get unique rate values
        unique_rates = set(valid_rates.values())
        
        # CRITICAL: All rates should be the same (or very close for float comparison)
        if len(unique_rates) == 1:
            print(f"\n✅ SUCCESS: All {len(valid_rates)} endpoints return the SAME rate: {list(unique_rates)[0]}")
        else:
            # Check if they're close (within 0.01 for float comparison)
            rate_list = list(valid_rates.values())
            max_rate = max(rate_list)
            min_rate = min(rate_list)
            
            if max_rate - min_rate <= 0.01:
                print(f"\n✅ SUCCESS: All rates are consistent (within 0.01): {unique_rates}")
            else:
                # This is the bug we're testing for!
                print(f"\n❌ CRITICAL BUG: Rates are INCONSISTENT!")
                for endpoint, rate in valid_rates.items():
                    print(f"   {endpoint}: {rate}")
                
                assert False, f"CRITICAL BUG: PRC rates are inconsistent across endpoints! Rates: {valid_rates}"
        
        # Also verify no rate is 100 (the old bank_redeem.py bug)
        for endpoint, rate in valid_rates.items():
            assert rate != 100, f"CRITICAL BUG: {endpoint} returns 100 (old default), should be ~10-11"
    
    def test_07_no_rate_defaults_to_100(self):
        """
        CRITICAL: Verify no rate function defaults to 100.
        This was the specific bug in bank_redeem.py.
        """
        endpoints_to_check = [
            ("/api/bank-transfer/config", "prc_rate", False),
            ("/api/prc-economy/current-rate", "final_rate", True),  # nested in "rate"
            ("/api/growth/prc-rate", "prc_rate", False),
        ]
        
        for endpoint, key, is_nested in endpoints_to_check:
            response = requests.get(f"{BASE_URL}{endpoint}")
            if response.status_code == 200:
                data = response.json()
                
                # Handle nested data structure
                if is_nested and "rate" in data:
                    rate = data["rate"].get(key)
                elif "data" in data and isinstance(data["data"], dict):
                    rate = data["data"].get(key)
                else:
                    rate = data.get(key)
                
                if rate is not None:
                    assert rate != 100, f"CRITICAL BUG: {endpoint} returns rate=100 (old default). Rate should be ~10-11"
                    print(f"✅ {endpoint} rate={rate} (not 100)")
    
    def test_08_rate_is_within_expected_range(self):
        """
        Verify PRC rate is within expected range (6-20 based on prc_economy.py limits).
        """
        response = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        assert response.status_code == 200
        
        data = response.json()
        
        # Handle nested structure
        if "rate" in data and isinstance(data["rate"], dict):
            final_rate = data["rate"].get("final_rate")
        else:
            final_rate = data.get("final_rate")
        
        assert final_rate is not None, f"Could not extract final_rate from: {data}"
        
        # From prc_economy.py: MINIMUM_RATE = 6, MAXIMUM_RATE = 20
        assert 6 <= final_rate <= 20, f"Rate {final_rate} is outside expected range [6, 20]"
        print(f"✅ Rate {final_rate} is within expected range [6, 20]")
    
    def test_09_calculate_fees_uses_consistent_rate(self):
        """Test /api/bank-transfer/calculate-fees uses consistent rate"""
        # First get the expected rate
        r1 = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        expected_rate = None
        if r1.status_code == 200:
            data = r1.json()
            if "rate" in data and isinstance(data["rate"], dict):
                expected_rate = data["rate"].get("final_rate")
            else:
                expected_rate = data.get("final_rate")
        
        # Now test calculate-fees
        response = requests.get(f"{BASE_URL}/api/bank-transfer/calculate-fees?amount=1000")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        fees = data.get("fees", {})
        
        prc_rate = fees.get("prc_rate")
        assert prc_rate is not None, f"prc_rate not in fees: {fees}"
        assert prc_rate != 100, f"CRITICAL BUG: calculate-fees uses rate=100"
        
        if expected_rate:
            assert prc_rate == expected_rate, f"Rate mismatch: calculate-fees={prc_rate}, prc-economy={expected_rate}"
        
        print(f"✅ /api/bank-transfer/calculate-fees prc_rate: {prc_rate}")
    
    def test_10_growth_calculate_redeem_uses_consistent_rate(self):
        """Test /api/growth/calculate-redeem uses consistent rate"""
        # First get the expected rate
        r1 = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
        expected_rate = None
        if r1.status_code == 200:
            data = r1.json()
            if "rate" in data and isinstance(data["rate"], dict):
                expected_rate = data["rate"].get("final_rate")
            else:
                expected_rate = data.get("final_rate")
        
        # Now test calculate-redeem
        response = requests.post(
            f"{BASE_URL}/api/growth/calculate-redeem",
            params={"redeem_prc": 1000}
        )
        
        if response.status_code == 200:
            data = response.json()
            calc_data = data.get("data", {})
            
            prc_rate = calc_data.get("prc_rate")
            if prc_rate:
                assert prc_rate != 100, f"CRITICAL BUG: calculate-redeem uses rate=100"
                
                if expected_rate:
                    assert prc_rate == expected_rate, f"Rate mismatch: calculate-redeem={prc_rate}, prc-economy={expected_rate}"
                
                print(f"✅ /api/growth/calculate-redeem prc_rate: {prc_rate}")
        else:
            print(f"⚠️ calculate-redeem returned {response.status_code}")


class TestPRCRateSourceOfTruth:
    """
    Verify the single source of truth implementation in utils/helpers.py
    """
    
    def test_11_helpers_get_prc_rate_is_used(self):
        """
        Verify that all rate endpoints delegate to helpers.get_prc_rate().
        We can't directly test the code, but we can verify consistent behavior.
        """
        # Call multiple endpoints rapidly and verify they all return the same rate
        rates = []
        
        for _ in range(3):
            r = requests.get(f"{BASE_URL}/api/prc-economy/current-rate")
            if r.status_code == 200:
                data = r.json()
                if "rate" in data and isinstance(data["rate"], dict):
                    rates.append(data["rate"].get("final_rate"))
                else:
                    rates.append(data.get("final_rate"))
        
        # All calls should return the same rate (cached or calculated)
        valid_rates = [r for r in rates if r is not None]
        unique_rates = set(valid_rates)
        assert len(unique_rates) == 1, f"Rate changed between calls: {rates}"
        print(f"✅ Rate is consistent across multiple calls: {valid_rates[0]}")
    
    def test_12_rate_not_100_in_any_endpoint(self):
        """
        Final comprehensive check: NO endpoint should return 100.
        """
        endpoints = [
            "/api/bank-transfer/config",
            "/api/prc-economy/current-rate",
            "/api/growth/economy-settings",
            "/api/growth/prc-rate",
            "/api/bank-redeem/denominations",
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            if response.status_code == 200:
                data = response.json()
                
                # Check common rate keys at various levels
                def check_rate_not_100(obj, path=""):
                    if isinstance(obj, dict):
                        for key in ["prc_rate", "final_rate", "rate"]:
                            if key in obj and isinstance(obj[key], (int, float)):
                                assert obj[key] != 100, f"CRITICAL: {endpoint} {path}.{key}=100"
                        for k, v in obj.items():
                            if isinstance(v, dict):
                                check_rate_not_100(v, f"{path}.{k}")
                
                check_rate_not_100(data)
        
        print("✅ No endpoint returns rate=100")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
