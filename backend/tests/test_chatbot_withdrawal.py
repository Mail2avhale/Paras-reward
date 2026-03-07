"""
Chatbot Bank Withdrawal System Tests
=====================================
Tests for the new chatbot-based bank withdrawal flow.

Features tested:
1. Eligibility check API - /api/chatbot-redeem/eligibility/{uid}
2. Fee calculation API - /api/chatbot-redeem/calculate-fees?amount=X
3. Admin stats API - /api/chatbot-redeem/admin/stats
4. Admin pending requests API - /api/chatbot-redeem/admin/pending
5. Admin all requests API - /api/chatbot-redeem/admin/all
6. Request creation and status APIs

Fee structure:
- Processing Fee: ₹10 flat
- Admin Charge: 20% of amount
- Minimum withdrawal: ₹500
- PRC to INR rate: 10 PRC = ₹1
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestFeeCalculationAPI:
    """Test /api/chatbot-redeem/calculate-fees endpoint"""
    
    def test_calculate_fees_minimum_amount(self):
        """Test fee calculation at minimum ₹500"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/calculate-fees?amount=500")
        
        assert response.status_code == 200, f"Fee calculation failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "amount_inr" in data
        assert "processing_fee" in data
        assert "admin_charge" in data
        assert "admin_charge_percent" in data
        assert "total_fees" in data
        assert "net_amount" in data
        assert "prc_required" in data
        
    def test_fee_calculation_values_500(self):
        """Test correct fee values at ₹500"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/calculate-fees?amount=500")
        
        assert response.status_code == 200
        data = response.json()
        
        # Processing fee should be ₹10
        assert data["processing_fee"] == 10, f"Processing fee should be 10, got {data['processing_fee']}"
        
        # Admin charge should be 20% = ₹100
        assert data["admin_charge"] == 100.0, f"Admin charge should be 100.0, got {data['admin_charge']}"
        assert data["admin_charge_percent"] == 20, f"Admin charge percent should be 20, got {data['admin_charge_percent']}"
        
        # Total fees = 10 + 100 = ₹110
        assert data["total_fees"] == 110.0, f"Total fees should be 110.0, got {data['total_fees']}"
        
        # Net amount = 500 - 110 = ₹390
        assert data["net_amount"] == 390.0, f"Net amount should be 390.0, got {data['net_amount']}"
        
        # PRC required = 500 * 10 = 5000 PRC
        assert data["prc_required"] == 5000.0, f"PRC required should be 5000.0, got {data['prc_required']}"
        
    def test_fee_calculation_values_1000(self):
        """Test correct fee values at ₹1000"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/calculate-fees?amount=1000")
        
        assert response.status_code == 200
        data = response.json()
        
        # Processing fee should be ₹10 (flat)
        assert data["processing_fee"] == 10
        
        # Admin charge should be 20% = ₹200
        assert data["admin_charge"] == 200.0
        
        # Total fees = 10 + 200 = ₹210
        assert data["total_fees"] == 210.0
        
        # Net amount = 1000 - 210 = ₹790
        assert data["net_amount"] == 790.0
        
        # PRC required = 1000 * 10 = 10000 PRC
        assert data["prc_required"] == 10000.0
        
    def test_fee_calculation_below_minimum(self):
        """Test fee calculation below minimum (should fail)"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/calculate-fees?amount=400")
        
        assert response.status_code == 400, f"Should reject below minimum, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "500" in data["detail"] or "minimum" in data["detail"].lower()
        
    def test_fee_calculation_high_amount(self):
        """Test fee calculation for high amount ₹5000"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/calculate-fees?amount=5000")
        
        assert response.status_code == 200
        data = response.json()
        
        # Processing fee should be ₹10 (flat)
        assert data["processing_fee"] == 10
        
        # Admin charge should be 20% = ₹1000
        assert data["admin_charge"] == 1000.0
        
        # Total fees = 10 + 1000 = ₹1010
        assert data["total_fees"] == 1010.0
        
        # Net amount = 5000 - 1010 = ₹3990
        assert data["net_amount"] == 3990.0


class TestEligibilityAPI:
    """Test /api/chatbot-redeem/eligibility/{uid} endpoint"""
    
    def test_eligibility_nonexistent_user(self):
        """Test eligibility check for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/eligibility/nonexistent-user-12345")
        
        assert response.status_code == 200, f"Eligibility check failed: {response.text}"
        data = response.json()
        
        assert "eligible" in data
        assert data["eligible"] is False
        assert "reason" in data
        assert "not found" in data["reason"].lower() or "User not found" in data["reason"]
        
    def test_eligibility_response_structure(self):
        """Test eligibility response has proper structure"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/eligibility/test-uid-abc")
        
        assert response.status_code == 200
        data = response.json()
        
        # For non-existent user, should have eligible and reason
        assert "eligible" in data
        assert isinstance(data["eligible"], bool)
        if not data["eligible"]:
            assert "reason" in data


class TestAdminStatsAPI:
    """Test /api/chatbot-redeem/admin/stats endpoint"""
    
    def test_admin_stats_endpoint_exists(self):
        """Test admin stats endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/stats")
        
        assert response.status_code == 200, f"Admin stats failed: {response.text}"
        
    def test_admin_stats_structure(self):
        """Test admin stats response structure"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify counts structure
        assert "counts" in data, "Missing 'counts' field"
        counts = data["counts"]
        assert "pending" in counts
        assert "processing" in counts
        assert "completed" in counts
        assert "rejected" in counts
        assert "total" in counts
        
        # All counts should be non-negative integers
        for key in ["pending", "processing", "completed", "rejected", "total"]:
            assert isinstance(counts[key], int), f"{key} should be integer"
            assert counts[key] >= 0, f"{key} should be non-negative"
            
    def test_admin_stats_completed_summary(self):
        """Test admin stats has completed summary"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "completed_summary" in data
        summary = data["completed_summary"]
        assert "total_amount" in summary
        assert "total_fees" in summary
        assert "count" in summary
        
    def test_admin_stats_total_calculation(self):
        """Test admin stats total equals sum of individual counts"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/stats")
        
        assert response.status_code == 200
        data = response.json()
        counts = data["counts"]
        
        expected_total = counts["pending"] + counts["processing"] + counts["completed"] + counts["rejected"]
        assert counts["total"] == expected_total, f"Total should be {expected_total}, got {counts['total']}"


class TestAdminPendingAPI:
    """Test /api/chatbot-redeem/admin/pending endpoint"""
    
    def test_admin_pending_endpoint_exists(self):
        """Test admin pending endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/pending")
        
        assert response.status_code == 200, f"Admin pending failed: {response.text}"
        
    def test_admin_pending_structure(self):
        """Test admin pending response structure"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/pending")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "requests" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        
        assert isinstance(data["requests"], list)
        assert isinstance(data["total"], int)
        assert data["total"] >= 0
        
    def test_admin_pending_pagination_params(self):
        """Test admin pending accepts pagination params"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/pending?limit=10&skip=0")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["limit"] == 10
        assert data["skip"] == 0


class TestAdminAllRequestsAPI:
    """Test /api/chatbot-redeem/admin/all endpoint"""
    
    def test_admin_all_endpoint_exists(self):
        """Test admin all requests endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/all")
        
        assert response.status_code == 200, f"Admin all failed: {response.text}"
        
    def test_admin_all_response_structure(self):
        """Test admin all response structure"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/all")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "requests" in data
        assert "total" in data
        assert "stats" in data
        
        # Stats should have status counts
        stats = data["stats"]
        assert "pending" in stats
        assert "processing" in stats
        assert "completed" in stats
        assert "rejected" in stats
        
    def test_admin_all_status_filter(self):
        """Test admin all with status filter"""
        for status in ["pending", "processing", "completed", "rejected"]:
            response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/all?status={status}")
            assert response.status_code == 200, f"Status filter '{status}' failed"
            
    def test_admin_all_pagination(self):
        """Test admin all with pagination"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/all?limit=5&skip=0")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify pagination applied
        assert isinstance(data["requests"], list)


class TestRequestStatusAPI:
    """Test /api/chatbot-redeem/status/{request_id} endpoint"""
    
    def test_status_nonexistent_request(self):
        """Test status check for non-existent request returns 404"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/status/NONEXISTENT-12345")
        
        assert response.status_code == 404, f"Should return 404 for non-existent request"


class TestHistoryAPI:
    """Test /api/chatbot-redeem/history/{uid} endpoint"""
    
    def test_history_for_user(self):
        """Test history endpoint for a user"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/history/test-user-123")
        
        assert response.status_code == 200, f"History endpoint failed: {response.text}"
        data = response.json()
        
        assert "requests" in data
        assert "total" in data
        assert isinstance(data["requests"], list)
        
    def test_history_with_pagination(self):
        """Test history endpoint with pagination"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/history/test-user-123?limit=5&skip=0")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "requests" in data


class TestSavedAccountsAPI:
    """Test /api/chatbot-redeem/saved-accounts/{uid} endpoint"""
    
    def test_saved_accounts_for_user(self):
        """Test saved accounts endpoint"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/saved-accounts/test-user-123")
        
        assert response.status_code == 200, f"Saved accounts failed: {response.text}"
        data = response.json()
        
        assert "accounts" in data
        assert isinstance(data["accounts"], list)


class TestAdminRequestDetailsAPI:
    """Test /api/chatbot-redeem/admin/request/{request_id} endpoint"""
    
    def test_admin_request_details_nonexistent(self):
        """Test admin request details for non-existent request"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/admin/request/NONEXISTENT-12345")
        
        assert response.status_code == 404


class TestAPIDocumentation:
    """Test API route documentation and consistency"""
    
    def test_fee_structure_documented_correctly(self):
        """Verify documented fee structure matches implementation"""
        # Test with ₹500 - documented as minimum
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/calculate-fees?amount=500")
        data = response.json()
        
        # Fee structure should be:
        # - Processing Fee: ₹10 flat
        # - Admin Charge: 20%
        # - Minimum: ₹500
        
        assert data["processing_fee"] == 10, "Processing fee should be ₹10 flat"
        assert data["admin_charge_percent"] == 20, "Admin charge should be 20%"
        
    def test_minimum_withdrawal_enforced(self):
        """Verify minimum ₹500 withdrawal is enforced"""
        # Test amounts below minimum
        for amount in [100, 200, 300, 400, 499]:
            response = requests.get(f"{BASE_URL}/api/chatbot-redeem/calculate-fees?amount={amount}")
            assert response.status_code == 400, f"Amount {amount} should be rejected"
            
    def test_prc_to_inr_rate(self):
        """Verify PRC to INR conversion rate is 10:1"""
        response = requests.get(f"{BASE_URL}/api/chatbot-redeem/calculate-fees?amount=500")
        data = response.json()
        
        # 500 INR should require 5000 PRC (10 PRC = 1 INR)
        assert data["prc_required"] == 5000.0
        assert data["amount_inr"] * 10 == data["prc_required"]



class TestEkoCustomerCheckAPI:
    """Test /api/chatbot-redeem/eko/check-customer endpoint"""
    
    def test_eko_check_customer_endpoint_exists(self):
        """Test Eko check customer endpoint returns 200"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/eko/check-customer",
            json={"uid": "test-uid-123", "mobile": "9876543210"}
        )
        
        assert response.status_code == 200, f"Eko check customer failed: {response.text}"
        
    def test_eko_check_customer_response_structure(self):
        """Test Eko check customer response has proper structure"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/eko/check-customer",
            json={"uid": "test-uid-123", "mobile": "9876543210"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have success field
        assert "success" in data
        assert data["success"] is True
        
        # In preview environment, should have skip_otp flag
        assert "skip_otp" in data or "verified" in data
        
    def test_eko_check_customer_skip_otp_in_preview(self):
        """Test Eko returns skip_otp due to IP not whitelisted in preview"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/eko/check-customer",
            json={"uid": "test-uid", "mobile": "9876543210"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # In preview, IP is not whitelisted so Eko returns skip_otp
        assert data.get("skip_otp") is True or data.get("verified") is True
        
    def test_eko_check_customer_invalid_mobile_format(self):
        """Test Eko check customer with invalid mobile format"""
        # Mobile must be exactly 10 digits
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/eko/check-customer",
            json={"uid": "test-uid", "mobile": "123"}  # Too short
        )
        
        # Should fail validation
        assert response.status_code == 422


class TestEkoVerificationStatusAPI:
    """Test /api/chatbot-redeem/eko/verification-status/{mobile} endpoint"""
    
    def test_verification_status_for_new_mobile(self):
        """Test verification status for unverified mobile"""
        response = requests.get(
            f"{BASE_URL}/api/chatbot-redeem/eko/verification-status/9999999999"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "verified" in data
        # New mobile should not be verified
        assert data["verified"] is False or "message" in data


class TestEkoResendOTPAPI:
    """Test /api/chatbot-redeem/eko/resend-otp endpoint"""
    
    def test_resend_otp_endpoint_exists(self):
        """Test resend OTP endpoint returns response"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/eko/resend-otp",
            json={"uid": "test-uid", "mobile": "9876543210"}
        )
        
        # Should return 200 (may have success=False due to IP not whitelisted)
        assert response.status_code == 200
        data = response.json()
        assert "success" in data


class TestEkoVerifyOTPAPI:
    """Test /api/chatbot-redeem/eko/verify-otp endpoint"""
    
    def test_verify_otp_endpoint_exists(self):
        """Test verify OTP endpoint returns response"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/eko/verify-otp",
            json={"uid": "test-uid", "mobile": "9876543210", "otp": "123456"}
        )
        
        # In preview env, this should succeed (skip OTP check)
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        
    def test_verify_otp_with_short_otp(self):
        """Test verify OTP with invalid OTP format"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/eko/verify-otp",
            json={"uid": "test-uid", "mobile": "9876543210", "otp": "12"}  # Too short
        )
        
        # Should fail validation (OTP must be 4-6 digits)
        assert response.status_code == 422


class TestWithdrawalRequestAPI:
    """Test /api/chatbot-redeem/request endpoint for creating withdrawal requests"""
    
    def test_create_request_missing_bank_details(self):
        """Test request creation fails without bank details"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/request",
            json={
                "uid": "test-uid",
                "amount_inr": 500
                # Missing bank details
            }
        )
        
        assert response.status_code == 422
        
    def test_create_request_invalid_ifsc(self):
        """Test request creation fails with invalid IFSC"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/request",
            json={
                "uid": "test-uid",
                "amount_inr": 500,
                "account_holder_name": "TEST USER",
                "account_number": "123456789012",
                "bank_name": "Test Bank",
                "ifsc_code": "INVALID"  # Invalid format
            }
        )
        
        assert response.status_code == 422
        
    def test_create_request_below_minimum_amount(self):
        """Test request creation fails with amount below minimum"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/request",
            json={
                "uid": "test-uid",
                "amount_inr": 100,  # Below ₹500 minimum
                "account_holder_name": "TEST USER",
                "account_number": "123456789012",
                "bank_name": "Test Bank",
                "ifsc_code": "SBIN0001234"
            }
        )
        
        assert response.status_code == 422
        
    def test_create_request_invalid_account_number(self):
        """Test request creation fails with non-numeric account number"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/request",
            json={
                "uid": "test-uid",
                "amount_inr": 500,
                "account_holder_name": "TEST USER",
                "account_number": "ABC123XYZ",  # Contains letters
                "bank_name": "Test Bank",
                "ifsc_code": "SBIN0001234"
            }
        )
        
        assert response.status_code == 422


class TestAdminProcessRequestAPI:
    """Test /api/chatbot-redeem/admin/process/{request_id} endpoint"""
    
    def test_admin_process_nonexistent_request(self):
        """Test processing non-existent request returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/admin/process/NONEXISTENT-12345",
            json={
                "admin_uid": "admin-test",
                "action": "approve"
            }
        )
        
        assert response.status_code == 404
        
    def test_admin_process_invalid_action(self):
        """Test processing with invalid action"""
        # First need a request ID (which we don't have)
        # This would normally require creating a request first
        response = requests.post(
            f"{BASE_URL}/api/chatbot-redeem/admin/process/TEST-123",
            json={
                "admin_uid": "admin-test",
                "action": "invalid_action"
            }
        )
        
        # Should return 404 (request not found) or 400 (invalid action)
        assert response.status_code in [400, 404]
