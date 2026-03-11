"""
BBPS New Services API Tests
============================
Tests for /api/bbps/* endpoints (new clean implementation)

Test categories:
1. Health check endpoint
2. Operators listing per category
3. Operator params retrieval
4. Bill fetch API
5. Transaction status inquiry
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials provided
TEST_MSEDCL_CONSUMER = "000437378053"
TEST_MSEDCL_BU = "3667"
TEST_MSEDCL_OPERATOR_ID = "62"
TEST_GAS_OPERATOR_ID = "28"  # Mahanagar Gas

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestBBPSHealthCheck:
    """Test BBPS health check endpoint"""
    
    def test_health_endpoint_returns_status(self, api_client):
        """Health check returns correct status"""
        response = api_client.get(f"{BASE_URL}/api/bbps/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "PARAS REWARD BBPS RUNNING"
        assert data["version"] == "2.1"  # Updated version after BBPS fix
        assert "services" in data
        assert len(data["services"]) == 8
        
    def test_health_services_list(self, api_client):
        """Health check includes all 8 service categories"""
        response = api_client.get(f"{BASE_URL}/api/bbps/health")
        data = response.json()
        
        expected_services = ["electricity", "dth", "fastag", "emi", "mobile_prepaid", "water", "credit_card", "insurance"]
        assert set(data["services"]) == set(expected_services)


class TestBBPSOperators:
    """Test BBPS operators listing API"""
    
    def test_electricity_operators(self, api_client):
        """Electricity category returns 89 operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/electricity")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["category"] == "electricity"
        assert data["eko_category_id"] == 8
        assert data["count"] == 89
        assert len(data["operators"]) == 89
        
    def test_electricity_operators_sorted_alphabetically(self, api_client):
        """Operators should be sorted A-Z by name"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/electricity")
        data = response.json()
        
        names = [op["name"] for op in data["operators"]]
        assert names == sorted(names, key=lambda x: x.lower())
        
    def test_dth_operators(self, api_client):
        """DTH category returns operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/dth")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["eko_category_id"] == 4
        assert data["count"] >= 4
        
    def test_mobile_prepaid_operators(self, api_client):
        """Mobile Prepaid category returns operators including Jio, Airtel"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/mobile_prepaid")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["eko_category_id"] == 5
        
        operator_names = [op["name"].lower() for op in data["operators"]]
        # Verify major operators present
        has_jio = any("jio" in name for name in operator_names)
        has_airtel = any("airtel" in name for name in operator_names)
        assert has_jio or has_airtel, "Major operators (Jio/Airtel) should be present"
        
    def test_fastag_operators(self, api_client):
        """FASTag category returns operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/fastag")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["eko_category_id"] == 22
        assert data["count"] >= 10
        
    def test_emi_operators(self, api_client):
        """EMI/Loan category returns 294 operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/emi")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["eko_category_id"] == 21
        assert data["count"] == 294
        
    def test_credit_card_operators(self, api_client):
        """Credit Card category returns 29 operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/credit_card")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["eko_category_id"] == 7
        assert data["count"] == 29
        
    def test_insurance_operators(self, api_client):
        """Insurance category returns operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/insurance")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["eko_category_id"] == 20
        assert data["count"] >= 30
        
    def test_water_operators(self, api_client):
        """Water category returns operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/water")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["eko_category_id"] == 11
        assert data["count"] >= 40
        
    def test_invalid_category_returns_error(self, api_client):
        """Invalid category returns 400 error"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/invalid_category")
        assert response.status_code == 200  # Returns 200 with error in body
        
        data = response.json()
        assert data["success"] == False
        assert data["error_code"] == 400
    
    def test_gas_operators(self, api_client):
        """Gas (PNG) category returns operators - category_id should be 2"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/gas")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        # Gas category ID should be 2 (not 14 - was fixed in BBPS update)
        assert data["eko_category_id"] == 2
        assert data["count"] >= 20  # Should have 20+ gas operators
        
        # Verify Mahanagar Gas is present
        operator_names = [op["name"].lower() for op in data["operators"]]
        has_mahanagar = any("mahanagar" in name for name in operator_names)
        assert has_mahanagar, "Mahanagar Gas should be present in gas operators"
    
    def test_lpg_operators(self, api_client):
        """LPG category returns operators"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/lpg")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["eko_category_id"] == 18
        # Should have Bharat Gas, HP Gas, Indane Gas
        assert data["count"] >= 3
        
    def test_operator_response_structure(self, api_client):
        """Each operator has required fields"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operators/electricity")
        data = response.json()
        
        # Check first operator has all required fields
        operator = data["operators"][0]
        assert "operator_id" in operator
        assert "name" in operator
        assert "supports_bill_fetch" in operator
        assert "billFetchResponse" in operator


class TestBBPSOperatorParams:
    """Test operator parameters retrieval"""
    
    def test_msedcl_operator_params(self, api_client):
        """MSEDCL operator params return 2 parameters"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operator-params/{TEST_MSEDCL_OPERATOR_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["operator_id"] == TEST_MSEDCL_OPERATOR_ID
        assert "MSEDCL" in data["operator_name"]
        assert data["fetch_bill_required"] == True  # Key is fetch_bill_required, not supports_bill_fetch
        assert data["is_bbps"] == True
        assert len(data["parameters"]) == 2
        
    def test_operator_params_structure(self, api_client):
        """Operator params have correct structure"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operator-params/{TEST_MSEDCL_OPERATOR_ID}")
        data = response.json()
        
        # Check Consumer No parameter
        consumer_param = data["parameters"][0]
        assert consumer_param["param_name"] == "utility_acc_no"
        assert consumer_param["param_label"] == "Consumer No"
        assert "regex" in consumer_param
        assert consumer_param["param_type"] == "Numeric"
        
        # Check BU parameter
        bu_param = data["parameters"][1]
        assert bu_param["param_name"] == "cycle_number"
        assert bu_param["param_label"] == "BU"
        
    def test_operator_param_regex_validation(self, api_client):
        """Operator param regex should be valid"""
        response = api_client.get(f"{BASE_URL}/api/bbps/operator-params/{TEST_MSEDCL_OPERATOR_ID}")
        data = response.json()
        
        import re
        consumer_param = data["parameters"][0]
        regex = consumer_param["regex"]
        
        # Test regex matches valid consumer number
        pattern = re.compile(regex)
        assert pattern.match(TEST_MSEDCL_CONSUMER)
        
        # Test regex rejects invalid consumer number
        assert not pattern.match("12345")  # Too short


class TestBBPSBillFetch:
    """Test bill fetch API"""
    
    def test_bill_fetch_with_valid_consumer(self, api_client):
        """Bill fetch returns bill details for valid consumer"""
        payload = {
            "operator_id": TEST_MSEDCL_OPERATOR_ID,
            "account": TEST_MSEDCL_CONSUMER,
            "mobile": "9999999999",
            "sender_name": "Test User"
        }
        
        response = api_client.post(f"{BASE_URL}/api/bbps/fetch", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # Bill fetch may succeed or fail based on actual bill status
        # Just verify response structure
        assert "success" in data
        assert "status" in data
        
        if data["success"]:
            assert data["status"] == "SUCCESS"
            assert "bill_amount" in data
            assert "customer_name" in data
    
    def test_bill_fetch_with_cycle_number_param(self, api_client):
        """Bill fetch with cycle_number (BU) parameter for MSEDCL"""
        payload = {
            "operator_id": TEST_MSEDCL_OPERATOR_ID,
            "account": TEST_MSEDCL_CONSUMER,
            "mobile": "9999999999",
            "sender_name": "Test User",
            "cycle_number": TEST_MSEDCL_BU  # BU parameter for MSEDCL
        }
        
        response = api_client.post(f"{BASE_URL}/api/bbps/fetch", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "success" in data
        assert "status" in data
        
        # With correct BU parameter, bill fetch should succeed
        if data["success"]:
            assert data["status"] == "SUCCESS"
            assert "bill_amount" in data
            # Verify bill amount is returned as string (can be converted to float)
            bill_amount = data["bill_amount"]
            float(bill_amount)  # Should not raise error
            
    def test_bill_fetch_invalid_mobile_rejected(self, api_client):
        """Bill fetch rejects invalid mobile number"""
        payload = {
            "operator_id": TEST_MSEDCL_OPERATOR_ID,
            "account": TEST_MSEDCL_CONSUMER,
            "mobile": "12345",  # Invalid - not 10 digits
            "sender_name": "Test"
        }
        
        response = api_client.post(f"{BASE_URL}/api/bbps/fetch", json=payload)
        # Should return 422 validation error
        assert response.status_code == 422
        
    def test_bill_fetch_empty_account_rejected(self, api_client):
        """Bill fetch rejects empty account number"""
        payload = {
            "operator_id": TEST_MSEDCL_OPERATOR_ID,
            "account": "",  # Empty
            "mobile": "9999999999",
            "sender_name": "Test"
        }
        
        response = api_client.post(f"{BASE_URL}/api/bbps/fetch", json=payload)
        assert response.status_code == 422


class TestBBPSTransactionStatus:
    """Test transaction status inquiry API"""
    
    def test_status_check_invalid_tid(self, api_client):
        """Status check for invalid TID returns error"""
        response = api_client.get(f"{BASE_URL}/api/bbps/status/invalid_tid_12345")
        assert response.status_code == 200
        
        data = response.json()
        # Should indicate failure to find transaction
        assert data["success"] == False
        
    def test_status_response_structure(self, api_client):
        """Status response has expected structure"""
        response = api_client.get(f"{BASE_URL}/api/bbps/status/test123")
        data = response.json()
        
        # Error response structure
        assert "success" in data
        if not data["success"]:
            assert "message" in data or "user_message" in data


class TestBBPSErrorCodes:
    """Test error codes reference endpoint"""
    
    def test_error_codes_endpoint(self, api_client):
        """Error codes endpoint returns reference data"""
        response = api_client.get(f"{BASE_URL}/api/bbps/error-codes")
        assert response.status_code == 200
        
        data = response.json()
        assert "http_codes" in data
        assert "status_codes" in data
        assert "tx_status" in data
        
    def test_http_codes_documented(self, api_client):
        """HTTP codes include standard responses"""
        response = api_client.get(f"{BASE_URL}/api/bbps/error-codes")
        data = response.json()
        
        http_codes = data["http_codes"]
        assert "200" in http_codes
        assert "403" in http_codes
        assert "404" in http_codes
        assert "500" in http_codes
