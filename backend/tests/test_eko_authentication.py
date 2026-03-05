"""
Test Eko Authentication Implementation
=====================================
Tests for Eko HMAC-SHA256 authentication as per Eko documentation.

The authentication algorithm must:
1. Base64 encode authenticator key FIRST
2. Generate timestamp in milliseconds (not seconds)
3. HMAC-SHA256(encoded_key, timestamp)
4. Base64 encode result to get secret-key

For request_hash:
1. Base64 encode the authenticator key FIRST
2. Concatenate: timestamp + utility_acc_no + amount + user_code
3. HMAC-SHA256 with BASE64 ENCODED key
4. Base64 encode the result

Reference: Eko Support confirmed Python example on docs is WRONG - use Java/PHP/C# example
"""

import pytest
import requests
import hmac
import hashlib
import base64
import time
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://eko-integration.preview.emergentagent.com')

# Test authentication key (if not available, use a test key)
TEST_AUTH_KEY = os.environ.get('EKO_AUTHENTICATOR_KEY', '7a2529f5-3587-4add-a2df-3d0606d62460')


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestEkoSecretKeyGeneration:
    """Tests for Eko secret-key generation algorithm"""
    
    def test_timestamp_is_in_milliseconds(self):
        """Verify timestamp is in milliseconds format (13 digits)"""
        timestamp = str(int(time.time() * 1000))
        assert len(timestamp) == 13, f"Timestamp should be 13 digits (milliseconds), got {len(timestamp)} digits"
        assert timestamp.isdigit(), "Timestamp should contain only digits"
    
    def test_base64_encode_key_first(self):
        """Test that key is base64 encoded before HMAC"""
        key = TEST_AUTH_KEY
        key_bytes = key.encode('utf-8')
        encoded_key = base64.b64encode(key_bytes).decode('utf-8')
        
        # Verify encoded key is valid base64
        try:
            decoded = base64.b64decode(encoded_key)
            assert decoded.decode('utf-8') == key, "Base64 decode should return original key"
        except Exception as e:
            pytest.fail(f"Base64 encoding failed: {e}")
    
    def test_secret_key_generation_algorithm(self):
        """Test the complete secret-key generation algorithm"""
        # Step 1: Get timestamp in milliseconds
        timestamp = str(int(time.time() * 1000))
        
        # Step 2: Base64 encode the authenticator key FIRST (CRITICAL!)
        key_bytes = TEST_AUTH_KEY.encode('utf-8')
        encoded_key = base64.b64encode(key_bytes).decode('utf-8')
        
        # Step 3: Use encoded key for HMAC
        encoded_key_bytes = encoded_key.encode('utf-8')
        
        # Step 4: HMAC SHA256 of timestamp using encoded key
        message = timestamp.encode('utf-8')
        signature = hmac.new(encoded_key_bytes, message, hashlib.sha256).digest()
        
        # Step 5: Base64 encode the signature to get secret-key
        secret_key = base64.b64encode(signature).decode('utf-8')
        
        # Verify output format
        assert len(secret_key) in [43, 44], f"Secret key should be 43 or 44 chars (base64), got {len(secret_key)}"
        
        # Verify it's valid base64
        try:
            base64.b64decode(secret_key)
        except Exception:
            pytest.fail("Secret key is not valid base64")
    
    def test_secret_key_changes_with_timestamp(self):
        """Test that secret-key changes when timestamp changes"""
        def generate_secret_key(ts):
            key_bytes = TEST_AUTH_KEY.encode('utf-8')
            encoded_key = base64.b64encode(key_bytes).decode('utf-8')
            encoded_key_bytes = encoded_key.encode('utf-8')
            message = ts.encode('utf-8')
            signature = hmac.new(encoded_key_bytes, message, hashlib.sha256).digest()
            return base64.b64encode(signature).decode('utf-8')
        
        ts1 = str(int(time.time() * 1000))
        time.sleep(0.01)  # Small delay
        ts2 = str(int(time.time() * 1000))
        
        key1 = generate_secret_key(ts1)
        key2 = generate_secret_key(ts2)
        
        assert key1 != key2, "Secret keys should be different for different timestamps"


class TestEkoRequestHashGeneration:
    """Tests for Eko request_hash generation (used for BBPS Pay Bill)"""
    
    def test_request_hash_concatenation(self):
        """Test the concatenation format for request_hash"""
        timestamp = "1772441593882"
        utility_acc_no = "9876543210"
        amount = "199"
        user_code = "20810200"
        
        concatenated = timestamp + utility_acc_no + amount + user_code
        expected = "1772441593882987654321019920810200"
        
        assert concatenated == expected, f"Concatenation format incorrect: {concatenated}"
    
    def test_request_hash_generation_algorithm(self):
        """Test the complete request_hash generation algorithm"""
        timestamp = str(int(time.time() * 1000))
        utility_acc_no = "9876543210"
        amount = "199"
        user_code = "20810200"
        
        # Step 1: Base64 encode the authenticator key FIRST
        key_bytes = TEST_AUTH_KEY.encode('utf-8')
        encoded_key = base64.b64encode(key_bytes).decode('utf-8')
        encoded_key_bytes = encoded_key.encode('utf-8')
        
        # Step 2: Concatenate parameters
        concatenated_string = timestamp + utility_acc_no + amount + user_code
        message = concatenated_string.encode('utf-8')
        
        # Step 3: HMAC SHA256 with encoded key
        signature = hmac.new(encoded_key_bytes, message, hashlib.sha256).digest()
        
        # Step 4: Base64 encode
        request_hash = base64.b64encode(signature).decode('utf-8')
        
        # Verify output format
        assert len(request_hash) in [43, 44], f"Request hash should be 43 or 44 chars (base64), got {len(request_hash)}"
    
    def test_request_hash_changes_with_parameters(self):
        """Test that request_hash changes when parameters change"""
        def generate_request_hash(ts, acc, amt, code):
            key_bytes = TEST_AUTH_KEY.encode('utf-8')
            encoded_key = base64.b64encode(key_bytes).decode('utf-8')
            encoded_key_bytes = encoded_key.encode('utf-8')
            concat = ts + acc + amt + code
            message = concat.encode('utf-8')
            signature = hmac.new(encoded_key_bytes, message, hashlib.sha256).digest()
            return base64.b64encode(signature).decode('utf-8')
        
        ts = str(int(time.time() * 1000))
        
        hash1 = generate_request_hash(ts, "9876543210", "199", "20810200")
        hash2 = generate_request_hash(ts, "9876543211", "199", "20810200")  # Different account
        hash3 = generate_request_hash(ts, "9876543210", "299", "20810200")  # Different amount
        
        assert hash1 != hash2, "Request hash should change with different account number"
        assert hash1 != hash3, "Request hash should change with different amount"


class TestEkoBalanceAPI:
    """Test the Eko Balance API endpoint"""
    
    def test_balance_api_works(self, api_client):
        """Test that Balance API endpoint returns expected response"""
        response = api_client.get(f"{BASE_URL}/api/eko/balance", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success" in data, "Response should have 'success' field"
        
        if data["success"]:
            assert "balance" in data, "Successful response should have 'balance'"
            assert "currency" in data, "Successful response should have 'currency'"
            assert data["currency"] == "INR", "Currency should be INR"
    
    def test_balance_api_returns_numeric_balance(self, api_client):
        """Test that balance is a valid numeric value"""
        response = api_client.get(f"{BASE_URL}/api/eko/balance", timeout=30)
        data = response.json()
        
        if data["success"]:
            balance = data["balance"]
            # Balance should be convertible to float
            try:
                float_balance = float(balance)
                assert float_balance >= 0, "Balance should be non-negative"
            except ValueError:
                pytest.fail(f"Balance '{balance}' is not a valid number")


class TestEkoConfigAPI:
    """Test the Eko Config API endpoint"""
    
    def test_config_api_returns_expected_fields(self, api_client):
        """Test that Config API returns all expected fields"""
        response = api_client.get(f"{BASE_URL}/api/eko/config")
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = ["configured", "base_url", "initiator_id", "environment"]
        for field in expected_fields:
            assert field in data, f"Config should have '{field}' field"
    
    def test_eko_is_configured(self, api_client):
        """Test that Eko is properly configured"""
        response = api_client.get(f"{BASE_URL}/api/eko/config")
        data = response.json()
        
        assert data["configured"] == True, "Eko should be configured with credentials"
        assert data["initiator_id"] is not None, "Initiator ID should be set"
        assert "api.eko.in" in data["base_url"], "Base URL should point to Eko API"
    
    def test_eko_environment_is_production(self, api_client):
        """Test that Eko is configured for production environment"""
        response = api_client.get(f"{BASE_URL}/api/eko/config")
        data = response.json()
        
        # Since we're using api.eko.in (not staging.eko.in), should be production
        assert data["environment"] == "production", f"Expected production, got {data['environment']}"


class TestEkoRechargeAPIHeaders:
    """Test that Recharge API sends correct headers (may get 403 due to IP whitelisting)"""
    
    def test_recharge_api_structure(self, api_client):
        """Test that Recharge API endpoint is accessible and structured correctly"""
        # This will return 403 due to IP whitelisting but we can verify the endpoint exists
        response = api_client.post(
            f"{BASE_URL}/api/eko/recharge/process",
            params={
                "mobile_number": "9876543210",
                "operator_id": "90",
                "amount": "199",
                "circle_id": "MH"
            },
            timeout=30
        )
        
        # We expect either 403 (IP not whitelisted) or a valid response
        # 404 would mean endpoint doesn't exist (which is a bug)
        assert response.status_code != 404, "Recharge API endpoint should exist"
        
        # If we get 403, it means authentication was sent but IP is not whitelisted
        if response.status_code == 403:
            # This is expected behavior for preview environment
            pass
    
    def test_bbps_paybill_api_structure(self, api_client):
        """Test that BBPS Paybill API endpoint is accessible"""
        response = api_client.post(
            f"{BASE_URL}/api/eko/bbps/paybill",
            json={
                "utility_acc_no": "9876543210",
                "operator_id": "90",
                "amount": 199,
                "bill_type": "mobile_prepaid"
            },
            timeout=30
        )
        
        # We expect either 403 (IP not whitelisted) or a valid response
        assert response.status_code != 404, "BBPS Paybill API endpoint should exist"


class TestEkoStatusCodes:
    """Test Eko status codes reference endpoint"""
    
    def test_status_codes_endpoint(self, api_client):
        """Test that status codes endpoint returns reference info"""
        response = api_client.get(f"{BASE_URL}/api/eko/status-codes")
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected sections
        assert "transaction_status" in data, "Should have transaction_status section"
        assert "error_codes" in data, "Should have error_codes section"
        assert "channels" in data, "Should have channels section"
    
    def test_status_codes_contains_403_error(self, api_client):
        """Test that 403 error code is documented"""
        response = api_client.get(f"{BASE_URL}/api/eko/status-codes")
        data = response.json()
        
        error_codes = data.get("error_codes", {})
        assert "403" in error_codes, "Should document 403 error code"
        assert "IP" in error_codes["403"] or "whitelist" in error_codes["403"].lower(), \
            "403 error should mention IP whitelisting"


class TestEkoChargesAPI:
    """Test Eko charges calculation API"""
    
    def test_charges_calculation(self, api_client):
        """Test bill payment charges calculation"""
        response = api_client.get(f"{BASE_URL}/api/eko/charges/calculate", params={"amount": 199})
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "charges" in data
        
        charges = data["charges"]
        assert "platform_fee_inr" in charges
        assert "admin_charge_inr" in charges
        assert "total_charges_inr" in charges
        assert "total_prc_required" in charges
    
    def test_charges_config(self, api_client):
        """Test charges configuration endpoint"""
        response = api_client.get(f"{BASE_URL}/api/eko/charges/config")
        assert response.status_code == 200
        data = response.json()
        
        assert "platform_fee_inr" in data
        assert "admin_charge_percent" in data
        assert "prc_rate" in data


class TestEkoOperatorsAPI:
    """Test Eko mobile operators and circles API"""
    
    def test_mobile_operators(self, api_client):
        """Test mobile operators endpoint"""
        response = api_client.get(f"{BASE_URL}/api/eko/recharge/operators")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "operators" in data
        assert len(data["operators"]) > 0
        
        # Check operator structure
        for op in data["operators"]:
            assert "id" in op
            assert "name" in op
    
    def test_recharge_circles(self, api_client):
        """Test recharge circles endpoint"""
        response = api_client.get(f"{BASE_URL}/api/eko/recharge/circles")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "circles" in data
        assert len(data["circles"]) > 0
    
    def test_dth_operators(self, api_client):
        """Test DTH operators endpoint"""
        response = api_client.get(f"{BASE_URL}/api/eko/dth/operators")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "operators" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
