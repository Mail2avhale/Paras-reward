"""
Test suite for BBPS/DMT route separation
========================================
Tests to verify:
1. BBPS routes working - /api/bbps/health, /api/bbps/error-codes
2. DMT routes working - /api/eko/dmt/health
3. Legacy Eko routes disabled - /api/eko/balance should return 404
4. KYC routes still working - /api/kyc/stats
5. Mining routes still working - /api/mining/status/{uid}
6. Health check - /api/health
7. Leaderboard - /api/leaderboard
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Test main health check endpoint"""
    
    def test_health_endpoint_returns_200(self):
        """Test that /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        assert data.get("service") == "paras-reward-api"


class TestBBPSRoutes:
    """Test BBPS service routes"""
    
    def test_bbps_health_endpoint(self):
        """Test /api/bbps/health returns proper response"""
        response = requests.get(f"{BASE_URL}/api/bbps/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "PARAS REWARD BBPS RUNNING"
        assert data.get("version") == "2.0"
        assert "services" in data
        services = data.get("services", [])
        assert "electricity" in services
        assert "dth" in services
        assert "fastag" in services
        assert "emi" in services
        assert "mobile_prepaid" in services
        assert "water" in services
        assert "credit_card" in services
        assert "insurance" in services
    
    def test_bbps_error_codes_endpoint(self):
        """Test /api/bbps/error-codes returns error code reference"""
        response = requests.get(f"{BASE_URL}/api/bbps/error-codes")
        assert response.status_code == 200
        data = response.json()
        
        # Check HTTP codes section
        assert "http_codes" in data
        http_codes = data.get("http_codes", {})
        assert "200" in http_codes
        assert "403" in http_codes
        assert "404" in http_codes
        assert "500" in http_codes
        
        # Check status codes section
        assert "status_codes" in data
        status_codes = data.get("status_codes", {})
        assert "0" in status_codes or 0 in status_codes  # Success code
        
        # Check tx_status section
        assert "tx_status" in data
        tx_status = data.get("tx_status", {})
        assert "0" in tx_status or 0 in tx_status  # Transaction successful


class TestDMTRoutes:
    """Test DMT (Domestic Money Transfer) routes"""
    
    def test_dmt_health_endpoint(self):
        """Test /api/eko/dmt/health returns proper response"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "DMT SERVICE RUNNING"
        assert data.get("config_valid") == True
        assert data.get("version") == "2.0"
        assert data.get("prc_rate") == "100 PRC = ₹1"
        assert data.get("min_redeem") == "₹100"
        assert data.get("max_daily") == "₹5000"


class TestLegacyEkoRoutesDisabled:
    """Test that legacy Eko routes are disabled (return 404)"""
    
    def test_eko_balance_returns_404(self):
        """Test /api/eko/balance returns 404 (disabled)"""
        response = requests.get(f"{BASE_URL}/api/eko/balance")
        assert response.status_code == 404
        data = response.json()
        assert data.get("detail") == "Not Found"
    
    def test_eko_operators_returns_404(self):
        """Test /api/eko/operators returns 404 (disabled)"""
        response = requests.get(f"{BASE_URL}/api/eko/operators")
        assert response.status_code == 404
        data = response.json()
        assert data.get("detail") == "Not Found"


class TestKYCRoutes:
    """Test KYC routes are still working"""
    
    def test_kyc_stats_endpoint(self):
        """Test /api/kyc/stats returns KYC statistics"""
        response = requests.get(f"{BASE_URL}/api/kyc/stats")
        assert response.status_code == 200
        data = response.json()
        # Check expected keys exist
        assert "pending" in data
        assert "verified" in data
        assert "rejected" in data
        assert "total" in data


class TestMiningRoutes:
    """Test Mining routes are still working"""
    
    def test_mining_status_endpoint(self):
        """Test /api/mining/status/{uid} returns proper response"""
        response = requests.get(f"{BASE_URL}/api/mining/status/test-user-123")
        # Can return 200 with data or 404 for non-existent user
        assert response.status_code in [200, 404, 422]
        data = response.json()
        # If 404, should have detail
        if response.status_code == 404:
            assert "detail" in data


class TestLeaderboardRoutes:
    """Test Leaderboard routes"""
    
    def test_leaderboard_endpoint(self):
        """Test /api/leaderboard returns leaderboard data"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert "leaderboard" in data
        leaderboard = data.get("leaderboard", [])
        assert isinstance(leaderboard, list)
        
        # If leaderboard has entries, verify structure
        if len(leaderboard) > 0:
            first_entry = leaderboard[0]
            assert "rank" in first_entry
            assert "user_id" in first_entry
            assert "name" in first_entry
            assert "prc_balance" in first_entry


class TestEkoCommonUtilities:
    """Test eko_common.py utilities are accessible through routes"""
    
    def test_bbps_fetch_endpoint_exists(self):
        """Test /api/bbps/fetch endpoint exists (POST)"""
        # Send minimal invalid request to check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/bbps/fetch",
            json={"operator_id": "test", "account": "test", "mobile": "1234567890"}
        )
        # Should not return 404 - endpoint should exist
        # Can return 200, 400, 422, 500 depending on validation
        assert response.status_code != 404
    
    def test_bbps_pay_endpoint_exists(self):
        """Test /api/bbps/pay endpoint exists (POST)"""
        response = requests.post(
            f"{BASE_URL}/api/bbps/pay",
            json={"operator_id": "test", "account": "test", "amount": "100", "mobile": "1234567890"}
        )
        # Should not return 404 - endpoint should exist
        assert response.status_code != 404
    
    def test_bbps_operators_endpoint(self):
        """Test /api/bbps/operators/{category} endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/bbps/operators/electricity")
        # Should return 200 with operators or error response
        # Should NOT return 404
        assert response.status_code != 404


class TestRouterRegistration:
    """Test that all routers are properly registered"""
    
    def test_bbps_router_registered(self):
        """Verify BBPS router is registered"""
        response = requests.get(f"{BASE_URL}/api/bbps/health")
        assert response.status_code == 200
    
    def test_dmt_router_registered(self):
        """Verify DMT router is registered"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        assert response.status_code == 200
    
    def test_kyc_router_registered(self):
        """Verify KYC router is registered"""
        response = requests.get(f"{BASE_URL}/api/kyc/stats")
        assert response.status_code == 200
    
    def test_leaderboard_router_registered(self):
        """Verify leaderboard router is registered"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
