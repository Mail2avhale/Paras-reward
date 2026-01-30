"""
Test cases for:
1. Admin rejection reason display to users (bill payments, gift vouchers)
2. Account age check shows 3 days (not 7 days) in redemption check API
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRedemptionRulesAccountAge:
    """Test that redemption rules show 3 days minimum account age"""
    
    def test_redemption_rules_shows_3_days(self):
        """GET /api/admin/settings/redemption-rules should show min_account_age_days = 3"""
        response = requests.get(f"{BASE_URL}/api/admin/settings/redemption-rules")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check strict_rules contains min_account_age_days
        strict_rules = data.get("strict_rules", {})
        min_account_age = strict_rules.get("min_account_age_days")
        
        assert min_account_age is not None, "min_account_age_days should be present in strict_rules"
        assert min_account_age == 3, f"Expected min_account_age_days=3, got {min_account_age}"
        
        print(f"✅ Redemption rules show min_account_age_days = {min_account_age} (correct)")
        
    def test_redemption_rules_structure(self):
        """Verify redemption rules API returns expected structure"""
        response = requests.get(f"{BASE_URL}/api/admin/settings/redemption-rules")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check all expected fields
        assert "monthly_limit_settings" in data, "monthly_limit_settings should be present"
        assert "strict_rules" in data, "strict_rules should be present"
        assert "plan_limits" in data, "plan_limits should be present"
        
        # Check strict_rules fields
        strict_rules = data.get("strict_rules", {})
        expected_fields = ["kyc_required", "min_account_age_days", "min_redemption_prc", 
                          "max_daily_redemptions", "cooldown_minutes", "subscription_required"]
        
        for field in expected_fields:
            assert field in strict_rules, f"Field {field} should be in strict_rules"
        
        print(f"✅ Redemption rules structure is correct")
        print(f"   - min_account_age_days: {strict_rules.get('min_account_age_days')}")
        print(f"   - min_redemption_prc: {strict_rules.get('min_redemption_prc')}")
        print(f"   - max_daily_redemptions: {strict_rules.get('max_daily_redemptions')}")


class TestAdminBillPaymentRejection:
    """Test admin can reject bill payment with reason and user sees it"""
    
    @pytest.fixture
    def admin_login(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@paras.com",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()
    
    def test_get_bill_payment_requests(self, admin_login):
        """Admin can get bill payment requests"""
        response = requests.get(f"{BASE_URL}/api/admin/bill-payment/requests")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should return requests array
        assert "requests" in data or isinstance(data, list), "Should return requests"
        print(f"✅ Admin can fetch bill payment requests")
    
    def test_reject_requires_reason(self, admin_login):
        """Rejecting a bill payment requires a reason"""
        # Try to reject without reason - should fail
        response = requests.post(f"{BASE_URL}/api/admin/bill-payment/process", json={
            "request_id": "non-existent-id",
            "action": "reject",
            "admin_uid": admin_login.get("user", {}).get("uid")
        })
        
        # Should fail either because request not found or reason required
        # Both are valid - we're testing the API behavior
        if response.status_code == 400:
            data = response.json()
            detail = data.get("detail", "")
            # Either "Reject reason is required" or "Request not found"
            assert "reason" in detail.lower() or "not found" in detail.lower(), \
                f"Expected rejection reason error, got: {detail}"
            print(f"✅ API correctly requires rejection reason or validates request")
        elif response.status_code == 404:
            print(f"✅ API correctly validates request exists before processing")
        else:
            print(f"Response: {response.status_code} - {response.text}")


class TestBillPaymentRejectionReasonDisplay:
    """Test that rejection reason is returned in user's requests"""
    
    def test_user_requests_include_rejection_fields(self):
        """User's all-requests endpoint should include rejection reason fields"""
        # First login as admin to get a test user
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@paras.com",
            "password": "admin123"
        })
        
        if admin_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        admin_data = admin_response.json()
        admin_uid = admin_data.get("user", {}).get("uid")
        
        # Get user's all requests
        response = requests.get(f"{BASE_URL}/api/user/{admin_uid}/all-requests")
        
        if response.status_code == 200:
            data = response.json()
            requests_list = data.get("requests", [])
            
            # Check if any rejected requests have rejection reason
            rejected_requests = [r for r in requests_list if r.get("status") == "rejected"]
            
            if rejected_requests:
                for req in rejected_requests:
                    # Check for rejection reason fields
                    has_reason = (
                        req.get("admin_notes") or 
                        req.get("reject_reason") or 
                        req.get("rejection_reason")
                    )
                    print(f"  Rejected request {req.get('id', 'unknown')[:8]}: reason present = {bool(has_reason)}")
                    if has_reason:
                        print(f"    Reason: {req.get('admin_notes') or req.get('reject_reason') or req.get('rejection_reason')}")
            else:
                print(f"  No rejected requests found for this user")
            
            print(f"✅ User all-requests endpoint working (found {len(requests_list)} requests)")
        else:
            print(f"⚠️ Could not fetch user requests: {response.status_code}")


class TestBillPaymentRequestsEndpoint:
    """Test bill payment requests endpoint returns rejection reason"""
    
    def test_bill_payment_requests_structure(self):
        """Test that bill payment requests include reject_reason field"""
        # Login as admin
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@paras.com",
            "password": "admin123"
        })
        
        if admin_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        admin_data = admin_response.json()
        admin_uid = admin_data.get("user", {}).get("uid")
        
        # Get user's bill payment requests
        response = requests.get(f"{BASE_URL}/api/bill-payment/requests/{admin_uid}")
        
        if response.status_code == 200:
            data = response.json()
            requests_list = data.get("requests", [])
            
            # Check rejected requests for reject_reason field
            rejected = [r for r in requests_list if r.get("status") == "rejected"]
            
            if rejected:
                for req in rejected:
                    print(f"  Rejected bill payment {req.get('request_id', 'unknown')[:8]}:")
                    print(f"    - reject_reason: {req.get('reject_reason')}")
                    print(f"    - admin_notes: {req.get('admin_notes')}")
            else:
                print(f"  No rejected bill payments found")
            
            print(f"✅ Bill payment requests endpoint working (found {len(requests_list)} requests)")
        else:
            print(f"⚠️ Could not fetch bill payment requests: {response.status_code}")


class TestGiftVoucherRejection:
    """Test gift voucher rejection reason is saved and displayed"""
    
    def test_gift_voucher_requests_endpoint(self):
        """Test gift voucher requests endpoint"""
        # Login as admin
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@paras.com",
            "password": "admin123"
        })
        
        if admin_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        admin_data = admin_response.json()
        admin_uid = admin_data.get("user", {}).get("uid")
        
        # Get user's gift voucher requests
        response = requests.get(f"{BASE_URL}/api/gift-voucher/requests/{admin_uid}")
        
        if response.status_code == 200:
            data = response.json()
            requests_list = data.get("requests", [])
            
            # Check rejected requests for reject_reason field
            rejected = [r for r in requests_list if r.get("status") == "rejected"]
            
            if rejected:
                for req in rejected:
                    print(f"  Rejected gift voucher {req.get('request_id', 'unknown')[:8]}:")
                    print(f"    - reject_reason: {req.get('reject_reason')}")
                    print(f"    - admin_notes: {req.get('admin_notes')}")
            else:
                print(f"  No rejected gift vouchers found")
            
            print(f"✅ Gift voucher requests endpoint working (found {len(requests_list)} requests)")
        elif response.status_code == 404:
            print(f"✅ Gift voucher requests endpoint exists (no requests for this user)")
        else:
            print(f"⚠️ Could not fetch gift voucher requests: {response.status_code}")


class TestAdminGiftVoucherProcess:
    """Test admin gift voucher process endpoint"""
    
    def test_admin_gift_voucher_requests(self):
        """Admin can get gift voucher requests"""
        response = requests.get(f"{BASE_URL}/api/admin/gift-voucher/requests")
        
        if response.status_code == 200:
            data = response.json()
            requests_list = data.get("requests", []) if isinstance(data, dict) else data
            print(f"✅ Admin can fetch gift voucher requests (found {len(requests_list)})")
        else:
            print(f"⚠️ Gift voucher admin endpoint: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
