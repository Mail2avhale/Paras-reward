"""
BBPS Operators API Tests - Backend Integration Tests
Tests all BBPS service operator endpoints from Eko API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestHealthCheck:
    """Test API health endpoint"""
    
    def test_health_check(self, api_client):
        """Test that API is healthy"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"


class TestBBPSMobileRechargeOperators:
    """Test Mobile Recharge operators API"""
    
    def test_mobile_prepaid_operators_load(self, api_client):
        """Test that mobile prepaid operators load correctly"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/operators/mobile_prepaid")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "operators" in data
        operators = data["operators"]
        assert len(operators) >= 4, f"Expected at least 4 mobile prepaid operators, got {len(operators)}"
        
        # Verify operator structure
        for op in operators:
            assert "id" in op or "operator_id" in op
            assert "name" in op
        
        # Check for expected operators
        operator_names = [op["name"].lower() for op in operators]
        assert any("airtel" in name for name in operator_names), "Airtel should be in operators"
        assert any("jio" in name for name in operator_names), "Jio should be in operators"


class TestBBPSDTHOperators:
    """Test DTH operators API"""
    
    def test_dth_operators_load(self, api_client):
        """Test that DTH operators load correctly"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/operators/dth")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "operators" in data
        operators = data["operators"]
        assert len(operators) >= 4, f"Expected at least 4 DTH operators, got {len(operators)}"
        
        # Check for expected DTH providers
        operator_names = [op["name"].lower() for op in operators]
        assert any("dish" in name or "tata" in name or "airtel" in name for name in operator_names)


class TestBBPSElectricityOperators:
    """Test Electricity operators API"""
    
    def test_electricity_operators_load(self, api_client):
        """Test that electricity operators load correctly - should return ~89 operators"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/operators/electricity")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "operators" in data
        operators = data["operators"]
        # Per requirements: 89 electricity operators expected
        assert len(operators) >= 80, f"Expected at least 80 electricity operators, got {len(operators)}"
        
    def test_best_mumbai_in_electricity_operators(self, api_client):
        """Test that BEST Mumbai (operator 53) is in the electricity operators list"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/operators/electricity")
        assert response.status_code == 200
        data = response.json()
        operators = data.get("operators", [])
        
        # Find BEST Mumbai
        best_mumbai = None
        for op in operators:
            if str(op.get("id")) == "53" or str(op.get("operator_id")) == "53":
                best_mumbai = op
                break
        
        assert best_mumbai is not None, "BEST Mumbai (operator 53) should be in electricity operators"
        assert "BEST" in best_mumbai.get("name", "").upper() or "Mumbai" in best_mumbai.get("name", "")


class TestBBPSEMIOperators:
    """Test EMI/Loan operators API"""
    
    def test_emi_operators_load(self, api_client):
        """Test that EMI/Loan operators load correctly - should return 294 operators"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/operators/loan_emi")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "operators" in data
        operators = data["operators"]
        # Per requirements: 294 EMI operators expected
        assert len(operators) >= 290, f"Expected at least 290 EMI operators, got {len(operators)}"
        
    def test_emi_operators_count_exact(self, api_client):
        """Verify exact count of EMI operators is 294"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/operators/loan_emi")
        assert response.status_code == 200
        data = response.json()
        count = data.get("count", len(data.get("operators", [])))
        assert count == 294, f"Expected exactly 294 EMI operators, got {count}"


class TestBBPSCreditCardOperators:
    """Test Credit Card operators API"""
    
    def test_credit_card_operators_load(self, api_client):
        """Test that Credit Card operators load correctly - should return 29 operators"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/operators/credit_card")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "operators" in data
        operators = data["operators"]
        # Per requirements: 29 credit card operators expected
        assert len(operators) >= 25, f"Expected at least 25 credit card operators, got {len(operators)}"
        
    def test_credit_card_operators_count_exact(self, api_client):
        """Verify exact count of Credit Card operators is 29"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/operators/credit_card")
        assert response.status_code == 200
        data = response.json()
        count = data.get("count", len(data.get("operators", [])))
        assert count == 29, f"Expected exactly 29 credit card operators, got {count}"


class TestBBPSOperatorParams:
    """Test Operator Parameters API"""
    
    def test_best_mumbai_params(self, api_client):
        """Test BEST Mumbai (operator 53) params returns correct format requirements"""
        response = api_client.get(f"{BASE_URL}/api/eko/bbps/operator-params/53")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data.get("operator_id") == 53 or str(data.get("operator_id")) == "53"
        assert "BEST Mumbai" in data.get("operator_name", "")
        
        # Check parameters structure
        params = data.get("parameters", [])
        assert len(params) >= 1, "Should have at least one parameter"
        
        # Check Consumer Number parameter
        consumer_param = params[0]
        assert consumer_param.get("param_label") == "Consumer Number"
        # BEST Mumbai requires 10-digit or 9-digit with comma
        assert "regex" in consumer_param
        

class TestBBPSCharges:
    """Test charges calculation API"""
    
    def test_calculate_charges(self, api_client):
        """Test charges calculation for bill payment"""
        response = api_client.get(f"{BASE_URL}/api/eko/charges/calculate?amount=100")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        charges = data.get("charges", {})
        assert "amount_inr" in charges
        assert "platform_fee_inr" in charges
        assert "total_amount_inr" in charges
        
    def test_charges_config(self, api_client):
        """Test charges configuration endpoint"""
        response = api_client.get(f"{BASE_URL}/api/eko/charges/config")
        assert response.status_code == 200
        data = response.json()
        assert "platform_fee_inr" in data
        assert "admin_charge_percent" in data


class TestBBPSBillFetch:
    """Test Bill Fetch API"""
    
    def test_bill_fetch_best_mumbai(self, api_client):
        """
        Test bill fetch for BEST Mumbai (operator 53) with test consumer
        Note: This may return 403 if IP not whitelisted with Eko
        """
        response = api_client.post(
            f"{BASE_URL}/api/eko/bbps/fetch-bill",
            json={
                "category": "electricity",
                "biller_id": "53",
                "customer_params": {
                    "consumer_number": "5700964071"
                }
            }
        )
        # Accept 200 (success) or 403 (IP whitelist issue - not app bug)
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                # Verify bill details if successful
                assert "bill_amount" in data or "customer_name" in data
            else:
                # Error from Eko API is acceptable
                assert "message" in data or "error_code" in data
