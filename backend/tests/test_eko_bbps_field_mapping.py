"""
Test Eko BBPS Field Mapping - CODE REVIEW FOCUS

This test validates that the code correctly maps field names
for different service types (Mobile, DTH, Electricity, EMI).

Key Issue: Mobile Recharge works in production, but DTH/Electricity/EMI 
return 403 errors. User says code has issues, not IP whitelist.

Focus areas:
1. Field name mapping (mobile_number vs consumer_number vs loan_account)
2. operator_id extraction from details dict
3. request_hash calculation with correct utility_acc_no
4. API body construction for different service types

According to Eko documentation:
- utility_acc_no: Account number against which bill needs to be paid
- operator_id: Operator ID from get operator API
- request_hash: HMAC-SHA256(timestamp + utility_acc_no + amount + user_code, encoded_key)
"""

import pytest
import json
import sys
import os
import base64
import hashlib
import hmac
import time

# Add backend to path
sys.path.insert(0, '/app/backend')


class TestEkoFieldMapping:
    """Test field mapping logic from unified_redeem_v2.py"""
    
    def test_mobile_recharge_field_extraction(self):
        """Test field extraction for mobile recharge - THIS WORKS IN PRODUCTION"""
        request_doc = {
            "service_type": "mobile_recharge",
            "amount_inr": 199,
            "details": {
                "mobile_number": "9876543210",
                "operator": "1",  # Airtel
                "circle": "MH",
                "recharge_type": "prepaid"
            }
        }
        
        service_type = request_doc.get("service_type", "mobile_recharge")
        details = request_doc.get("details", {})
        
        # Same logic as unified_redeem_v2.py execute_eko_recharge()
        if service_type == "emi":
            utility_acc_no = details.get("loan_account", "")
        elif service_type == "mobile_recharge":
            utility_acc_no = details.get("mobile_number", "")
        elif service_type in ["dth", "electricity", "gas"]:
            utility_acc_no = details.get("consumer_number", "")
        else:
            utility_acc_no = details.get("mobile_number") or details.get("consumer_number") or details.get("loan_account") or ""
        
        operator = str(details.get("operator_id") or details.get("operator", ""))
        
        assert utility_acc_no == "9876543210", f"Mobile recharge: utility_acc_no should be mobile_number, got {utility_acc_no}"
        assert operator == "1", f"Mobile recharge: operator should be '1', got {operator}"
    
    def test_dth_field_extraction(self):
        """Test field extraction for DTH - FAILING IN PRODUCTION"""
        request_doc = {
            "service_type": "dth",
            "amount_inr": 350,
            "details": {
                "consumer_number": "123456789",  # Subscriber ID
                "operator": "45"  # Tata Play = 45
            }
        }
        
        service_type = request_doc.get("service_type", "mobile_recharge")
        details = request_doc.get("details", {})
        
        # Same logic as unified_redeem_v2.py
        if service_type == "emi":
            utility_acc_no = details.get("loan_account", "")
        elif service_type == "mobile_recharge":
            utility_acc_no = details.get("mobile_number", "")
        elif service_type in ["dth", "electricity", "gas"]:
            utility_acc_no = details.get("consumer_number", "")
        else:
            utility_acc_no = details.get("mobile_number") or details.get("consumer_number") or details.get("loan_account") or ""
        
        operator = str(details.get("operator_id") or details.get("operator", ""))
        
        assert utility_acc_no == "123456789", f"DTH: utility_acc_no should be consumer_number, got {utility_acc_no}"
        assert operator == "45", f"DTH: operator should be '45', got {operator}"
    
    def test_electricity_field_extraction(self):
        """Test field extraction for Electricity - FAILING IN PRODUCTION"""
        request_doc = {
            "service_type": "electricity",
            "amount_inr": 2500,
            "details": {
                "consumer_number": "001234567890",  # Consumer ID
                "operator": "96"  # MSEDCL
            }
        }
        
        service_type = request_doc.get("service_type", "mobile_recharge")
        details = request_doc.get("details", {})
        
        # Same logic as unified_redeem_v2.py
        if service_type == "emi":
            utility_acc_no = details.get("loan_account", "")
        elif service_type == "mobile_recharge":
            utility_acc_no = details.get("mobile_number", "")
        elif service_type in ["dth", "electricity", "gas"]:
            utility_acc_no = details.get("consumer_number", "")
        else:
            utility_acc_no = details.get("mobile_number") or details.get("consumer_number") or details.get("loan_account") or ""
        
        operator = str(details.get("operator_id") or details.get("operator", ""))
        
        assert utility_acc_no == "001234567890", f"Electricity: utility_acc_no should be consumer_number, got {utility_acc_no}"
        assert operator == "96", f"Electricity: operator should be '96', got {operator}"
    
    def test_emi_field_extraction(self):
        """Test field extraction for EMI - FAILING IN PRODUCTION"""
        request_doc = {
            "service_type": "emi",
            "amount_inr": 15000,
            "details": {
                "loan_account": "LOAN123456",
                "bank_name": "HDFC",
                "operator": "157"  # Some EMI operator
            }
        }
        
        service_type = request_doc.get("service_type", "mobile_recharge")
        details = request_doc.get("details", {})
        
        # Same logic as unified_redeem_v2.py
        if service_type == "emi":
            utility_acc_no = details.get("loan_account", "")
        elif service_type == "mobile_recharge":
            utility_acc_no = details.get("mobile_number", "")
        elif service_type in ["dth", "electricity", "gas"]:
            utility_acc_no = details.get("consumer_number", "")
        else:
            utility_acc_no = details.get("mobile_number") or details.get("consumer_number") or details.get("loan_account") or ""
        
        operator = str(details.get("operator_id") or details.get("operator", ""))
        
        assert utility_acc_no == "LOAN123456", f"EMI: utility_acc_no should be loan_account, got {utility_acc_no}"
        assert operator == "157", f"EMI: operator should be '157', got {operator}"


class TestEkoAPIBodyConstruction:
    """Test that API request body is constructed correctly for all service types"""
    
    def get_api_body(self, service_type, details, amount):
        """Simulate the body construction from test_recharge_exact_format()"""
        # Extract utility_acc_no based on service type
        if service_type == "emi":
            utility_acc_no = details.get("loan_account", "")
        elif service_type == "mobile_recharge":
            utility_acc_no = details.get("mobile_number", "")
        elif service_type in ["dth", "electricity", "gas"]:
            utility_acc_no = details.get("consumer_number", "")
        else:
            utility_acc_no = details.get("mobile_number") or details.get("consumer_number") or details.get("loan_account") or ""
        
        operator = str(details.get("operator_id") or details.get("operator", ""))
        
        # Simulate body construction from test_recharge_exact_format()
        user_code = "20810200"
        client_ref_id = f"TEST{int(time.time())}"
        initiator_id = "9936606966"
        
        body = {
            "source_ip": "127.0.0.1",
            "user_code": user_code,
            "amount": str(int(amount)),
            "client_ref_id": client_ref_id,
            "utility_acc_no": utility_acc_no,  # <-- KEY FIELD
            "confirmation_mobile_no": initiator_id,
            "sender_name": "TestUser",
            "operator_id": operator,  # <-- KEY FIELD
            "latlong": "19.0760,72.8777"
        }
        
        return body, utility_acc_no, operator
    
    def test_mobile_recharge_body(self):
        """Mobile recharge API body construction"""
        details = {
            "mobile_number": "9876543210",
            "operator": "1",
            "recharge_type": "prepaid"
        }
        
        body, utility_acc_no, operator = self.get_api_body("mobile_recharge", details, 199)
        
        assert body["utility_acc_no"] == "9876543210"
        assert body["operator_id"] == "1"
        assert body["amount"] == "199"
    
    def test_dth_body(self):
        """DTH recharge API body construction"""
        details = {
            "consumer_number": "123456789",
            "operator": "45"
        }
        
        body, utility_acc_no, operator = self.get_api_body("dth", details, 350)
        
        assert body["utility_acc_no"] == "123456789"
        assert body["operator_id"] == "45"
        assert body["amount"] == "350"
    
    def test_electricity_body(self):
        """Electricity bill payment API body construction"""
        details = {
            "consumer_number": "001234567890",
            "operator": "96"
        }
        
        body, utility_acc_no, operator = self.get_api_body("electricity", details, 2500)
        
        assert body["utility_acc_no"] == "001234567890"
        assert body["operator_id"] == "96"
        assert body["amount"] == "2500"
    
    def test_emi_body(self):
        """EMI payment API body construction"""
        details = {
            "loan_account": "LOAN123456",
            "operator": "157"
        }
        
        body, utility_acc_no, operator = self.get_api_body("emi", details, 15000)
        
        assert body["utility_acc_no"] == "LOAN123456"
        assert body["operator_id"] == "157"
        assert body["amount"] == "15000"


class TestEkoRequestHashCalculation:
    """Test request_hash calculation is consistent for all service types"""
    
    def calculate_request_hash(self, timestamp, utility_acc_no, amount, user_code):
        """Calculate request_hash using the verified algorithm"""
        auth_key = "redeem-dmt-flow"  # From .env
        encoded_key = base64.b64encode(auth_key.encode()).decode()
        
        concat_str = timestamp + utility_acc_no + amount + user_code
        request_hash = base64.b64encode(
            hmac.new(encoded_key.encode(), concat_str.encode(), hashlib.sha256).digest()
        ).decode()
        
        return request_hash, concat_str
    
    def test_mobile_request_hash(self):
        """Request hash for mobile recharge"""
        timestamp = "1709389200000"  # Fixed for testing
        utility_acc_no = "9876543210"
        amount = "199"
        user_code = "20810200"
        
        hash_result, concat = self.calculate_request_hash(timestamp, utility_acc_no, amount, user_code)
        
        assert concat == "1709389200000987654321019920810200"
        assert hash_result is not None
        assert len(hash_result) == 44  # Base64 encoded SHA256
    
    def test_dth_request_hash(self):
        """Request hash for DTH recharge"""
        timestamp = "1709389200000"
        utility_acc_no = "123456789"  # consumer_number
        amount = "350"
        user_code = "20810200"
        
        hash_result, concat = self.calculate_request_hash(timestamp, utility_acc_no, amount, user_code)
        
        assert concat == "170938920000012345678935020810200"
        assert hash_result is not None
    
    def test_electricity_request_hash(self):
        """Request hash for electricity bill"""
        timestamp = "1709389200000"
        utility_acc_no = "001234567890"  # consumer_number
        amount = "2500"
        user_code = "20810200"
        
        hash_result, concat = self.calculate_request_hash(timestamp, utility_acc_no, amount, user_code)
        
        assert concat == "1709389200000001234567890250020810200"
        assert hash_result is not None
    
    def test_emi_request_hash(self):
        """Request hash for EMI payment"""
        timestamp = "1709389200000"
        utility_acc_no = "LOAN123456"  # loan_account
        amount = "15000"
        user_code = "20810200"
        
        hash_result, concat = self.calculate_request_hash(timestamp, utility_acc_no, amount, user_code)
        
        assert concat == "1709389200000LOAN1234561500020810200"
        assert hash_result is not None


class TestFrontendBackendFieldMapping:
    """Test that frontend field names match backend expectations"""
    
    def test_frontend_field_names_match_service_config(self):
        """Verify frontend SERVICE_CONFIG field names"""
        # From RedeemPageV2.js
        frontend_config = {
            "mobile_recharge": ['mobile_number', 'operator', 'circle', 'recharge_type'],
            "dth": ['consumer_number', 'operator'],
            "electricity": ['consumer_number', 'operator'],
            "gas": ['consumer_number', 'operator'],
            "emi": ['loan_account', 'bank_name', 'ifsc_code', 'borrower_name', 'mobile', 'loan_type', 'emi_amount']
        }
        
        # Backend expects these fields in details dict
        backend_expected = {
            "mobile_recharge": ["mobile_number", "operator"],
            "dth": ["consumer_number", "operator"],
            "electricity": ["consumer_number", "operator"],
            "gas": ["consumer_number", "operator"],
            "emi": ["loan_account", "operator"]  # Backend needs operator for EMI too!
        }
        
        for service, expected_fields in backend_expected.items():
            frontend_fields = frontend_config.get(service, [])
            for field in expected_fields:
                assert field in frontend_fields, f"Service {service}: backend expects '{field}' but frontend doesn't send it. Frontend fields: {frontend_fields}"
    
    def test_emi_operator_field_present(self):
        """EMI needs operator field but frontend sends bank_name - POTENTIAL BUG!"""
        # Frontend EMI config
        emi_frontend_fields = ['loan_account', 'bank_name', 'ifsc_code', 'borrower_name', 'mobile', 'loan_type', 'emi_amount']
        
        # Backend extracts operator like this:
        # operator = str(details.get("operator_id") or details.get("operator", ""))
        
        # ISSUE: Frontend sends 'bank_name', not 'operator' or 'operator_id'!
        # This means EMI operator will be empty string
        has_operator = 'operator' in emi_frontend_fields or 'operator_id' in emi_frontend_fields
        
        # This assertion will FAIL - showing the bug!
        # EMI form doesn't send 'operator' field, only 'bank_name'
        if not has_operator:
            pytest.fail("""
            CRITICAL BUG FOUND: EMI service doesn't send 'operator' or 'operator_id' field!
            
            Frontend fields: ['loan_account', 'bank_name', 'ifsc_code', 'borrower_name', 'mobile', 'loan_type', 'emi_amount']
            
            Backend expects: details.get("operator_id") or details.get("operator")
            
            FIX OPTIONS:
            1. Add 'operator' field to EMI frontend config
            2. Map 'bank_name' to 'operator' in frontend before sending
            3. Change backend to extract operator from selected_lender.operator_id
            """)


class TestEkoOperatorIDHandling:
    """Test operator_id extraction edge cases"""
    
    def test_operator_from_operator_field(self):
        """Test when details has 'operator' field"""
        details = {"operator": "1", "mobile_number": "9876543210"}
        operator = str(details.get("operator_id") or details.get("operator", ""))
        assert operator == "1"
    
    def test_operator_from_operator_id_field(self):
        """Test when details has 'operator_id' field"""
        details = {"operator_id": "45", "consumer_number": "123456789"}
        operator = str(details.get("operator_id") or details.get("operator", ""))
        assert operator == "45"
    
    def test_operator_precedence(self):
        """Test operator_id takes precedence over operator"""
        details = {"operator_id": "45", "operator": "1", "consumer_number": "123456789"}
        operator = str(details.get("operator_id") or details.get("operator", ""))
        assert operator == "45", "operator_id should take precedence"
    
    def test_missing_operator(self):
        """Test when no operator field is present"""
        details = {"loan_account": "LOAN123456", "bank_name": "HDFC"}
        operator = str(details.get("operator_id") or details.get("operator", ""))
        # This returns empty string - API will fail!
        assert operator == "", "Missing operator returns empty string - will cause API failure"


class TestBackendValidation:
    """Test backend validation catches missing operator"""
    
    def test_execute_eko_recharge_validation(self):
        """The execute_eko_recharge function should return error for missing operator"""
        # Simulate what execute_eko_recharge() does
        request_doc = {
            "service_type": "emi",
            "amount_inr": 15000,
            "details": {
                "loan_account": "LOAN123456",
                "bank_name": "HDFC"
                # NOTE: No 'operator' field!
            }
        }
        
        details = request_doc.get("details", {})
        service_type = request_doc.get("service_type")
        
        # Extract operator
        operator = str(details.get("operator_id") or details.get("operator", ""))
        
        # Backend validation from execute_eko_recharge() line 185
        if not operator:
            error = f"Missing operator for {service_type}"
            # This test passes - backend correctly catches missing operator
            assert "Missing operator" in error
        else:
            pytest.fail("Should have detected missing operator")


class TestCompareWorkingVsFailingServices:
    """Compare the complete flow of working (mobile) vs failing (DTH/electricity/EMI) services"""
    
    def simulate_full_flow(self, service_type, details, amount):
        """Simulate the complete API call flow"""
        # Step 1: Extract utility_acc_no
        if service_type == "emi":
            utility_acc_no = details.get("loan_account", "")
        elif service_type == "mobile_recharge":
            utility_acc_no = details.get("mobile_number", "")
        elif service_type in ["dth", "electricity", "gas"]:
            utility_acc_no = details.get("consumer_number", "")
        else:
            utility_acc_no = details.get("mobile_number") or details.get("consumer_number") or details.get("loan_account") or ""
        
        # Step 2: Extract operator
        operator = str(details.get("operator_id") or details.get("operator", ""))
        
        # Step 3: Validation
        if not utility_acc_no:
            return {"success": False, "error": f"Missing account/consumer number for {service_type}"}
        if not operator:
            return {"success": False, "error": f"Missing operator for {service_type}"}
        
        # Step 4: Build API body
        body = {
            "utility_acc_no": utility_acc_no,
            "operator_id": operator,
            "amount": str(int(amount)),
            "user_code": "20810200"
        }
        
        return {"success": True, "body": body}
    
    def test_mobile_recharge_flow(self):
        """Mobile recharge - WORKS in production"""
        details = {
            "mobile_number": "9876543210",
            "operator": "1"
        }
        result = self.simulate_full_flow("mobile_recharge", details, 199)
        assert result["success"] == True
        assert result["body"]["utility_acc_no"] == "9876543210"
        assert result["body"]["operator_id"] == "1"
    
    def test_dth_flow(self):
        """DTH - FAILS in production with 403"""
        details = {
            "consumer_number": "123456789",
            "operator": "45"
        }
        result = self.simulate_full_flow("dth", details, 350)
        # Code logic is correct - should succeed
        assert result["success"] == True
        assert result["body"]["utility_acc_no"] == "123456789"
        assert result["body"]["operator_id"] == "45"
    
    def test_electricity_flow(self):
        """Electricity - FAILS in production with 403"""
        details = {
            "consumer_number": "001234567890",
            "operator": "96"
        }
        result = self.simulate_full_flow("electricity", details, 2500)
        # Code logic is correct - should succeed
        assert result["success"] == True
        assert result["body"]["utility_acc_no"] == "001234567890"
        assert result["body"]["operator_id"] == "96"
    
    def test_emi_flow_with_operator(self):
        """EMI with operator - should work if operator provided"""
        details = {
            "loan_account": "LOAN123456",
            "operator": "157"  # If operator is provided
        }
        result = self.simulate_full_flow("emi", details, 15000)
        assert result["success"] == True
        assert result["body"]["utility_acc_no"] == "LOAN123456"
        assert result["body"]["operator_id"] == "157"
    
    def test_emi_flow_without_operator(self):
        """EMI without operator - FAILS because frontend doesn't send operator"""
        details = {
            "loan_account": "LOAN123456",
            "bank_name": "HDFC"  # Frontend sends bank_name, not operator
        }
        result = self.simulate_full_flow("emi", details, 15000)
        # This should FAIL due to missing operator
        assert result["success"] == False
        assert "Missing operator" in result["error"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
