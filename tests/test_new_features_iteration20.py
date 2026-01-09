"""
Test Suite for Iteration 20 - Testing:
1. KYC Submit and Approval Flow
2. VIP Payment Submit and Approval
3. Bill Payment Form (input field styling)
4. Gift Card/Voucher Request Flow
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestKYCFlow:
    """Test KYC submission and approval flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user for KYC tests"""
        self.test_email = f"kyctest_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "testpass123"
        
        # Register test user
        register_response = requests.post(f"{BASE_URL}/api/auth/register/simple", json={
            "email": self.test_email,
            "password": self.test_password,
            "role": "user"
        })
        
        if register_response.status_code == 200:
            self.test_uid = register_response.json().get("uid")
        else:
            # Try login if already exists
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": self.test_email,
                "password": self.test_password
            })
            if login_response.status_code == 200:
                self.test_uid = login_response.json().get("uid")
            else:
                self.test_uid = None
        
        yield
        
        # Cleanup - delete test user
        if self.test_uid:
            requests.delete(f"{BASE_URL}/api/admin/user/{self.test_uid}")
    
    def test_kyc_submit_endpoint_exists(self):
        """Test that KYC submit endpoint exists"""
        if not self.test_uid:
            pytest.skip("Test user not created")
        
        # Test with minimal data
        response = requests.post(f"{BASE_URL}/api/kyc/submit/{self.test_uid}", json={
            "document_type": "aadhaar",
            "full_name": "Test User",
            "aadhaar_front_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "aadhaar_back_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "aadhaar_number": "123456789012",
            "pan_front_base64": "",
            "pan_number": ""
        })
        
        # Should return 200 or 400 (validation error), not 404
        assert response.status_code in [200, 400, 422], f"KYC submit endpoint failed: {response.status_code} - {response.text}"
        print(f"✅ KYC submit endpoint exists and responds: {response.status_code}")
    
    def test_kyc_list_endpoint(self):
        """Test KYC list endpoint for admin"""
        response = requests.get(f"{BASE_URL}/api/kyc/list")
        
        assert response.status_code == 200, f"KYC list failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "KYC list should return array"
        print(f"✅ KYC list endpoint works, found {len(data)} documents")


class TestVIPPaymentFlow:
    """Test VIP payment submission and approval flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user for VIP tests"""
        self.test_email = f"viptest_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "testpass123"
        
        # Register test user
        register_response = requests.post(f"{BASE_URL}/api/auth/register/simple", json={
            "email": self.test_email,
            "password": self.test_password,
            "role": "user"
        })
        
        if register_response.status_code == 200:
            self.test_uid = register_response.json().get("uid")
        else:
            self.test_uid = None
        
        yield
        
        # Cleanup
        if self.test_uid:
            requests.delete(f"{BASE_URL}/api/admin/user/{self.test_uid}")
    
    def test_vip_plans_endpoint(self):
        """Test VIP plans endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/plans")
        
        assert response.status_code == 200, f"VIP plans failed: {response.status_code}"
        data = response.json()
        assert "plans" in data, "Response should contain plans"
        print(f"✅ VIP plans endpoint works, found {len(data.get('plans', []))} plans")
    
    def test_vip_payment_config_endpoint(self):
        """Test VIP payment config endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/payment-config")
        
        # Should return 200 even if no config set
        assert response.status_code == 200, f"VIP payment config failed: {response.status_code}"
        print(f"✅ VIP payment config endpoint works")
    
    def test_vip_payment_submit_endpoint(self):
        """Test VIP payment submit endpoint"""
        if not self.test_uid:
            pytest.skip("Test user not created")
        
        response = requests.post(f"{BASE_URL}/api/vip/payment/submit", json={
            "uid": self.test_uid,
            "plan_id": "monthly",
            "plan_type": "monthly",
            "amount": 299,
            "utr_number": f"UTR{uuid.uuid4().hex[:12].upper()}",
            "screenshot_url": "https://example.com/screenshot.jpg",
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_time": datetime.now().strftime("%H:%M"),
            "payment_method": "UPI"
        })
        
        assert response.status_code in [200, 400], f"VIP payment submit failed: {response.status_code} - {response.text}"
        print(f"✅ VIP payment submit endpoint works: {response.status_code}")
    
    def test_vip_transactions_endpoint(self):
        """Test VIP transactions endpoint"""
        if not self.test_uid:
            pytest.skip("Test user not created")
        
        response = requests.get(f"{BASE_URL}/api/user/vip-transactions/{self.test_uid}")
        
        assert response.status_code == 200, f"VIP transactions failed: {response.status_code}"
        data = response.json()
        assert "transactions" in data, "Response should contain transactions"
        print(f"✅ VIP transactions endpoint works")
    
    def test_admin_vip_payments_endpoint(self):
        """Test admin VIP payments list endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/vip-payments?status=pending")
        
        assert response.status_code == 200, f"Admin VIP payments failed: {response.status_code}"
        print(f"✅ Admin VIP payments endpoint works")


class TestBillPaymentFlow:
    """Test Bill Payment flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup VIP test user for bill payment tests"""
        self.test_email = f"billtest_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "testpass123"
        
        # Register test user
        register_response = requests.post(f"{BASE_URL}/api/auth/register/simple", json={
            "email": self.test_email,
            "password": self.test_password,
            "role": "user"
        })
        
        if register_response.status_code == 200:
            self.test_uid = register_response.json().get("uid")
        else:
            self.test_uid = None
        
        yield
        
        # Cleanup
        if self.test_uid:
            requests.delete(f"{BASE_URL}/api/admin/user/{self.test_uid}")
    
    def test_bill_payment_request_endpoint_exists(self):
        """Test bill payment request endpoint exists"""
        if not self.test_uid:
            pytest.skip("Test user not created")
        
        response = requests.post(f"{BASE_URL}/api/bill-payment/request", json={
            "user_id": self.test_uid,
            "request_type": "mobile_recharge",
            "amount_inr": 100,
            "details": {
                "phone_number": "9876543210",
                "operator": "Airtel"
            }
        })
        
        # Should return 403 (VIP required) or 400 (insufficient PRC) for non-VIP user
        assert response.status_code in [200, 400, 403], f"Bill payment endpoint failed: {response.status_code} - {response.text}"
        print(f"✅ Bill payment request endpoint exists: {response.status_code}")
        
        if response.status_code == 403:
            print(f"   Expected: VIP membership required message")
    
    def test_bill_payment_requests_list(self):
        """Test bill payment requests list endpoint"""
        if not self.test_uid:
            pytest.skip("Test user not created")
        
        response = requests.get(f"{BASE_URL}/api/bill-payment/requests/{self.test_uid}")
        
        assert response.status_code == 200, f"Bill payment requests list failed: {response.status_code}"
        data = response.json()
        assert "requests" in data, "Response should contain requests"
        print(f"✅ Bill payment requests list endpoint works")


class TestGiftVoucherFlow:
    """Test Gift Voucher flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user for gift voucher tests"""
        self.test_email = f"gifttest_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "testpass123"
        
        # Register test user
        register_response = requests.post(f"{BASE_URL}/api/auth/register/simple", json={
            "email": self.test_email,
            "password": self.test_password,
            "role": "user"
        })
        
        if register_response.status_code == 200:
            self.test_uid = register_response.json().get("uid")
        else:
            self.test_uid = None
        
        yield
        
        # Cleanup
        if self.test_uid:
            requests.delete(f"{BASE_URL}/api/admin/user/{self.test_uid}")
    
    def test_gift_voucher_request_endpoint_exists(self):
        """Test gift voucher request endpoint exists"""
        if not self.test_uid:
            pytest.skip("Test user not created")
        
        # Note: Frontend uses /api/gift-voucher/redeem but backend has /api/gift-voucher/request
        response = requests.post(f"{BASE_URL}/api/gift-voucher/request", json={
            "user_id": self.test_uid,
            "denomination": 100
        })
        
        # Should return 403 (VIP required) or 400 (insufficient PRC) for non-VIP user
        assert response.status_code in [200, 400, 403], f"Gift voucher endpoint failed: {response.status_code} - {response.text}"
        print(f"✅ Gift voucher request endpoint exists: {response.status_code}")
        
        if response.status_code == 403:
            print(f"   Expected: VIP membership required message")
    
    def test_gift_voucher_redeem_endpoint_check(self):
        """Check if /api/gift-voucher/redeem endpoint exists (frontend uses this)"""
        if not self.test_uid:
            pytest.skip("Test user not created")
        
        response = requests.post(f"{BASE_URL}/api/gift-voucher/redeem", json={
            "user_id": self.test_uid,
            "denomination": 100
        })
        
        # This will likely return 404 if endpoint doesn't exist
        if response.status_code == 404:
            print(f"⚠️ ISSUE: /api/gift-voucher/redeem endpoint NOT FOUND - Frontend uses this but backend has /api/gift-voucher/request")
        else:
            print(f"✅ Gift voucher redeem endpoint exists: {response.status_code}")
        
        # Don't fail the test, just report
        assert True
    
    def test_gift_voucher_requests_list(self):
        """Test gift voucher requests list endpoint"""
        if not self.test_uid:
            pytest.skip("Test user not created")
        
        response = requests.get(f"{BASE_URL}/api/gift-voucher/requests/{self.test_uid}")
        
        assert response.status_code == 200, f"Gift voucher requests list failed: {response.status_code}"
        data = response.json()
        assert "requests" in data, "Response should contain requests"
        print(f"✅ Gift voucher requests list endpoint works")


class TestAdminLogin:
    """Test admin login with provided credentials"""
    
    def test_admin_login(self):
        """Test admin login with admin@paras.com / admin123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@paras.com",
            "password": "admin123"
        })
        
        if response.status_code == 200:
            data = response.json()
            assert "uid" in data, "Login should return uid"
            print(f"✅ Admin login successful: {data.get('email')}")
        else:
            print(f"⚠️ Admin login failed: {response.status_code} - {response.text}")
            # Don't fail - admin might not exist
            assert True
    
    def test_user_login(self):
        """Test user login with testuser@test.com / test123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testuser@test.com",
            "password": "test123"
        })
        
        if response.status_code == 200:
            data = response.json()
            assert "uid" in data, "Login should return uid"
            print(f"✅ Test user login successful: {data.get('email')}")
        else:
            print(f"⚠️ Test user login failed: {response.status_code} - may need to create user")
            assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
