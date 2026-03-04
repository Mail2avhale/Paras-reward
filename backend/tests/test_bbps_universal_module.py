"""
BBPS Universal Module - Backend Integration Tests
Tests the new unified BBPS API endpoints from /api/bbps/*
Covers: Electricity, DTH, FASTag, EMI/Loan operators and bill fetch
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestBBPSHealthCheck:
    """Test BBPS health endpoint"""
    
    def test_bbps_health_endpoint(self, api_client):
        """Test /api/bbps/health returns running status"""
        response = api_client.get(f"{BASE_URL}/api/bbps/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "PARAS REWARD BBPS RUNNING"


class TestBBPSElectricityOperators:
    """Test Electricity operators from new BBPS API"""
    
    def test_electricity_operators_load(self, api_client):
        """Test /api/bbps/operators/electricity returns 89 operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/electricity")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data.get("category") == "electricity"
        operators = data.get("operators", [])
        assert len(operators) >= 85, f"Expected ~89 electricity operators, got {len(operators)}"
        
    def test_electricity_operator_structure(self, api_client):
        """Test electricity operator has correct structure"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/electricity")
        data = response.json()
        operators = data.get("operators", [])
        
        # Check first operator has required fields
        if operators:
            op = operators[0]
            assert "operator_id" in op
            assert "name" in op
            assert "fetch_bill" in op
            
    def test_electricity_known_operators_present(self, api_client):
        """Test known electricity operators are present"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/electricity")
        data = response.json()
        operators = data.get("operators", [])
        
        # Find known operators
        operator_ids = {str(op.get("operator_id")) for op in operators}
        operator_names_lower = [op.get("name", "").lower() for op in operators]
        
        # BSES Rajdhani (22), MSEDCL (62), BEST Mumbai (53)
        assert "22" in operator_ids, "BSES Rajdhani (22) should be present"
        assert "62" in operator_ids, "MSEDCL (62) should be present"
        assert any("best" in name for name in operator_names_lower), "BEST Mumbai should be present"


class TestBBPSDTHOperators:
    """Test DTH operators from new BBPS API"""
    
    def test_dth_operators_load(self, api_client):
        """Test /api/bbps/operators/dth returns 5 operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/dth")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data.get("category") == "dth"
        operators = data.get("operators", [])
        assert len(operators) >= 4, f"Expected at least 4 DTH operators, got {len(operators)}"
        
    def test_dth_known_operators_present(self, api_client):
        """Test known DTH operators are present"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/dth")
        data = response.json()
        operators = data.get("operators", [])
        
        operator_names_lower = [op.get("name", "").lower() for op in operators]
        
        # Check Dish TV, Tata Sky, Airtel DTH
        assert any("dish" in name for name in operator_names_lower), "Dish TV should be present"
        assert any("tata" in name for name in operator_names_lower), "Tata Sky should be present"
        assert any("airtel" in name for name in operator_names_lower), "Airtel DTH should be present"


class TestBBPSFASTagOperators:
    """Test FASTag operators from new BBPS API - category 22"""
    
    def test_fastag_operators_load(self, api_client):
        """Test /api/bbps/operators/fastag returns 20 operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/fastag")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data.get("category") == "fastag"
        operators = data.get("operators", [])
        assert len(operators) >= 15, f"Expected ~20 FASTag operators, got {len(operators)}"
        
    def test_fastag_count_is_20(self, api_client):
        """Verify FASTag operator count is 20"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/fastag")
        data = response.json()
        count = data.get("count", 0)
        assert count == 20, f"Expected exactly 20 FASTag operators, got {count}"
        
    def test_fastag_known_operators_present(self, api_client):
        """Test known FASTag operators are present"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/fastag")
        data = response.json()
        operators = data.get("operators", [])
        
        operator_names_lower = [op.get("name", "").lower() for op in operators]
        
        # Check for common FASTag issuers
        assert any("axis" in name for name in operator_names_lower), "Axis Bank FASTag should be present"
        assert any("paytm" in name for name in operator_names_lower), "Paytm FASTag should be present"
        assert any("icici" in name for name in operator_names_lower), "ICICI FASTag should be present"


class TestBBPSEMIOperators:
    """Test EMI/Loan operators from new BBPS API - category 21"""
    
    def test_emi_operators_load(self, api_client):
        """Test /api/bbps/operators/emi returns 294 operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/emi")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data.get("category") == "emi"
        operators = data.get("operators", [])
        assert len(operators) >= 290, f"Expected ~294 EMI operators, got {len(operators)}"
        
    def test_emi_count_is_294(self, api_client):
        """Verify EMI operator count is 294"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/emi")
        data = response.json()
        count = data.get("count", 0)
        assert count == 294, f"Expected exactly 294 EMI operators, got {count}"
        
    def test_emi_loan_alias_works(self, api_client):
        """Test /api/bbps/operators/loan also returns EMI operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/loan")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        operators = data.get("operators", [])
        assert len(operators) >= 290, f"Expected ~294 EMI/Loan operators via 'loan' alias, got {len(operators)}"
        
    def test_emi_known_operators_present(self, api_client):
        """Test known EMI/Loan operators are present"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/emi")
        data = response.json()
        operators = data.get("operators", [])
        
        operator_names_lower = [op.get("name", "").lower() for op in operators]
        
        # Check for common EMI/Loan providers
        assert any("bajaj" in name for name in operator_names_lower), "Bajaj Finance should be present"
        assert any("hdfc" in name for name in operator_names_lower), "HDFC should be present"


class TestBBPSOperatorParams:
    """Test operator params endpoint"""
    
    def test_bses_rajdhani_params(self, api_client):
        """Test /api/bbps/operator-params/22 returns BSES Rajdhani params"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operator-params/22")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data.get("operator_id") == 22
        assert "BSES Rajdhani" in data.get("operator_name", "")
        
        # Should have CA Number requirement
        raw_response = data.get("raw_response", {})
        params_data = raw_response.get("data", [])
        if params_data:
            ca_param = params_data[0]
            assert ca_param.get("param_name") == "utility_acc_no"
            assert "CA Number" in ca_param.get("param_label", "")
            assert "9" in ca_param.get("regex", "")  # 9-digit regex
            
    def test_dish_tv_params(self, api_client):
        """Test /api/bbps/operator-params/16 returns Dish TV params"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operator-params/16")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "Dish TV" in data.get("operator_name", "")
        
    def test_axis_fastag_params(self, api_client):
        """Test /api/bbps/operator-params/326 returns Axis Bank FASTag params"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operator-params/326")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "Axis" in data.get("operator_name", "")
        assert "Fastag" in data.get("operator_name", "")
        
    def test_bajaj_finance_params(self, api_client):
        """Test /api/bbps/operator-params/340 returns Bajaj Finance params"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operator-params/340")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "Bajaj" in data.get("operator_name", "")
        assert "Finance" in data.get("operator_name", "")


class TestBBPSBillFetch:
    """Test BBPS bill fetch endpoint"""
    


class TestRedeemRequestEndpoint:
    """Test Redeem Request endpoint validations"""
    
    def test_redeem_services_list(self, api_client):
        """Test /api/redeem/services returns all BBPS services"""
        response = api_client.get(f"{BASE_URL}/api/redeem/services")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        services = data.get("services", [])
        assert len(services) >= 15
        
        service_ids = [s.get("id") for s in services]
        assert "electricity" in service_ids
        assert "dth" in service_ids
        assert "fastag" in service_ids
        assert "emi" in service_ids
        
    def test_redeem_calculate_charges(self, api_client):
        """Test /api/redeem/calculate-charges returns correct charges"""
        response = api_client.get(f"{BASE_URL}/api/redeem/calculate-charges?amount=100")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        
        charges = data.get("charges", {})
        assert charges.get("amount_inr") == 100
        assert charges.get("platform_fee_inr") == 10
        assert charges.get("admin_charge_percent") == 20
        assert charges.get("admin_charge_inr") == 20
        # Total PRC = (100 + 10 + 20) * 10 = 1300
        assert charges.get("total_prc_required") == 1300
        
    def test_redeem_request_requires_user_id(self, api_client):
        """Test /api/redeem/request requires user_id"""
        response = api_client.post(
            f"{BASE_URL}/api/redeem/request",
            json={
                "service_type": "electricity",
                "amount": 100,
                "details": {"consumer_number": "123456789", "operator": "22"}
            }
        )
        assert response.status_code == 422
        
    def test_redeem_request_validates_user_exists(self, api_client):
        """Test /api/redeem/request validates user exists"""
        response = api_client.post(
            f"{BASE_URL}/api/redeem/request",
            json={
                "user_id": "nonexistent_user_xyz_123",
                "service_type": "electricity",
                "amount": 100,
                "details": {"consumer_number": "123456789", "operator": "22"}
            }
        )
        assert response.status_code == 404
        data = response.json()
        assert "User not found" in data.get("detail", "")
        
    def test_redeem_request_validates_service_type(self, api_client):
        """Test /api/redeem/request validates service type"""
        response = api_client.post(
            f"{BASE_URL}/api/redeem/request",
            json={
                "user_id": "test_user",
                "service_type": "invalid_service_xyz",
                "amount": 100,
                "details": {}
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "invalid service type" in data.get("detail", "").lower()

    def test_bill_fetch_endpoint_exists(self, api_client):
        """Test /api/bbps/fetch endpoint is reachable"""
        # Using test data - this may fail with Eko API but should not 404
        response = api_client.post(
            f"{BASE_URL}/api/bbps/fetch",
            json={
                "operator_id": "22",
                "account": "123456789",
                "mobile": "9936606966"
            }
        )
        # Accept 200, 422 (validation), or 5xx (Eko error)
        # Should NOT be 404 (endpoint missing)
        assert response.status_code != 404, "Bill fetch endpoint should exist"
        
    def test_bill_fetch_requires_operator_id(self, api_client):
        """Test bill fetch requires operator_id"""
        response = api_client.post(
            f"{BASE_URL}/api/bbps/fetch",
            json={
                "account": "123456789",
                "mobile": "9936606966"
            }
        )
        # Should fail validation (422) without operator_id
        assert response.status_code == 422
        
    def test_bill_fetch_requires_account(self, api_client):
        """Test bill fetch requires account number"""
        response = api_client.post(
            f"{BASE_URL}/api/bbps/fetch",
            json={
                "operator_id": "22",
                "mobile": "9936606966"
            }
        )
        # Should fail validation (422) without account
        assert response.status_code == 422


class TestBBPSInvalidCategory:
    """Test invalid category handling"""
    
    def test_invalid_category_returns_400(self, api_client):
        """Test invalid category returns 400 error"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/invalid_category_xyz")
        assert response.status_code == 400
        data = response.json()
        assert "invalid" in data.get("detail", "").lower() or "error" in str(data).lower()


class TestBBPSCategoryMappings:
    """Test category mappings are correct per agent context"""
    
    def test_fastag_is_category_22_not_5(self, api_client):
        """Verify FASTag uses category 22, not the incorrect category 5"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/fastag")
        data = response.json()
        
        # FASTag should return operators (category 22 has 20 operators)
        # Category 5 (incorrect) would return different operators
        assert data.get("success") is True
        operators = data.get("operators", [])
        
        # Category 22 (FASTag) should have ~20 operators
        # If it was using wrong category 5, count would be different
        assert len(operators) >= 15, f"FASTag should have 15+ operators (category 22)"
        
        # Verify FASTag-specific operators are present
        operator_names = [op.get("name", "").lower() for op in operators]
        has_fastag_provider = any(
            "fastag" in name or "fast" in name 
            for name in operator_names
        )
        assert has_fastag_provider, "FASTag category should return FASTag providers"
        
    def test_emi_is_category_21_not_6(self, api_client):
        """Verify EMI uses category 21 (294 operators), not category 6 (2 operators)"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/emi")
        data = response.json()
        
        # Category 21 (correct) has 294 EMI operators
        # Category 6 (incorrect) had only 2 legacy operators
        operators = data.get("operators", [])
        assert len(operators) >= 290, f"EMI should have 290+ operators (category 21), got {len(operators)}"
        
        # If using wrong category 6, count would be ~2
        assert len(operators) != 2, "EMI should NOT have only 2 operators (that would be category 6)"
