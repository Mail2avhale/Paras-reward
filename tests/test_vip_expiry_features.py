"""
VIP Membership Expiry Feature Tests
Tests for:
1. Login with expired VIP user - should show vip_expired=true, vip_days_expired, and vip_expiry_message
2. Marketplace access - should return 403 for expired VIP with renewal message
3. Gift Voucher request - should return 403 for expired VIP with renewal message
4. Bill Payment request - should return 403 for expired VIP with renewal message
5. PRC Burn job - should burn ONLY PRC mined AFTER VIP expiry AND older than 5 days
6. Active VIP user should have full access
7. Free user should be blocked from VIP services
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
EXPIRED_VIP_USER = {
    "email": "final_test_vip@test.com",
    "password": "testpass123",
    "uid": "final-vip-test-001"
}

ADMIN_USER = {
    "email": "admin@paras.com",
    "password": "admin"
}


class TestExpiredVIPLogin:
    """Test login response for expired VIP users"""
    
    def test_expired_vip_login_shows_expiry_info(self):
        """Login with expired VIP user should show vip_expired=true, vip_days_expired, and vip_expiry_message"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": EXPIRED_VIP_USER["email"],
                "password": EXPIRED_VIP_USER["password"]
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        
        # Verify VIP expiry fields are present
        assert data.get("vip_expired") == True, f"Expected vip_expired=True, got {data.get('vip_expired')}"
        assert "vip_days_expired" in data, "vip_days_expired field missing"
        assert data.get("vip_days_expired") >= 10, f"Expected vip_days_expired >= 10, got {data.get('vip_days_expired')}"
        assert "vip_expiry_message" in data, "vip_expiry_message field missing"
        assert "renew" in data.get("vip_expiry_message", "").lower(), "Renewal message should mention 'renew'"
        
        print(f"✅ Expired VIP login test passed:")
        print(f"   vip_expired: {data.get('vip_expired')}")
        print(f"   vip_days_expired: {data.get('vip_days_expired')}")
        print(f"   vip_expiry_message: {data.get('vip_expiry_message')}")


class TestMarketplaceAccess:
    """Test marketplace access for different user types"""
    
    def test_expired_vip_blocked_from_marketplace(self):
        """Expired VIP user should get 403 when accessing marketplace"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace/products",
            params={"user_id": EXPIRED_VIP_USER["uid"]}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        detail = data.get("detail", "")
        
        # Should mention renewal
        assert "renew" in detail.lower() or "expired" in detail.lower(), f"Error message should mention renewal/expiry: {detail}"
        
        print(f"✅ Expired VIP marketplace block test passed: {detail}")


class TestGiftVoucherAccess:
    """Test gift voucher request for different user types"""
    
    def test_expired_vip_blocked_from_gift_voucher(self):
        """Expired VIP user should get 403 when requesting gift voucher"""
        response = requests.post(
            f"{BASE_URL}/api/gift-voucher/request",
            json={
                "user_id": EXPIRED_VIP_USER["uid"],
                "denomination": 100
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        detail = data.get("detail", "")
        
        # Should mention renewal
        assert "renew" in detail.lower() or "expired" in detail.lower(), f"Error message should mention renewal/expiry: {detail}"
        
        print(f"✅ Expired VIP gift voucher block test passed: {detail}")


class TestBillPaymentAccess:
    """Test bill payment request for different user types"""
    
    def test_expired_vip_blocked_from_bill_payment(self):
        """Expired VIP user should get 403 when requesting bill payment"""
        response = requests.post(
            f"{BASE_URL}/api/bill-payment/request",
            json={
                "user_id": EXPIRED_VIP_USER["uid"],
                "request_type": "mobile_recharge",
                "amount_inr": 100,
                "details": {"phone_number": "9876543210", "operator": "Jio"}
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        detail = data.get("detail", "")
        
        # Should mention renewal
        assert "renew" in detail.lower() or "expired" in detail.lower(), f"Error message should mention renewal/expiry: {detail}"
        
        print(f"✅ Expired VIP bill payment block test passed: {detail}")


class TestPRCBurnJob:
    """Test PRC burn job for expired VIP users"""
    
    def test_prc_burn_job_execution(self):
        """Admin should be able to trigger PRC burn job"""
        # First login as admin
        admin_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": ADMIN_USER["email"],
                "password": ADMIN_USER["password"]
            }
        )
        
        # Admin login might fail if password is different, but we can still test the endpoint
        # The burn endpoint should work with admin_uid parameter
        
        response = requests.post(
            f"{BASE_URL}/api/admin/burn-prc-now",
            params={"admin_uid": "8175c02a-4fbd-409c-8d47-d864e979f59f"}  # Admin UID from DB
        )
        
        assert response.status_code == 200, f"PRC burn job failed: {response.text}"
        
        data = response.json()
        print(f"✅ PRC burn job executed successfully:")
        print(f"   Response: {data}")
    
    def test_verify_prc_balance_after_burn(self):
        """Verify that PRC balance is correct after burn (should be 700)"""
        # Login to get current balance
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": EXPIRED_VIP_USER["email"],
                "password": EXPIRED_VIP_USER["password"]
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        prc_balance = data.get("prc_balance", 0)
        
        # Expected: 1000 initial - 300 burned (mined after expiry, >5 days old) = 700
        # The 500 PRC mined before expiry should NOT be burned
        # The 200 PRC mined after expiry but <5 days old should NOT be burned yet
        assert prc_balance == 700, f"Expected PRC balance 700, got {prc_balance}"
        
        print(f"✅ PRC balance verification passed: {prc_balance} PRC")


class TestFreeUserAccess:
    """Test that free users are blocked from VIP services"""
    
    @pytest.fixture(autouse=True)
    def setup_free_user(self):
        """Create a free user for testing"""
        self.free_user_email = f"free_test_user_{datetime.now().timestamp()}@test.com"
        self.free_user_password = "testpass123"
        
        # Register free user
        response = requests.post(
            f"{BASE_URL}/api/auth/register/simple",
            json={
                "email": self.free_user_email,
                "password": self.free_user_password,
                "role": "user"
            }
        )
        
        if response.status_code == 200:
            self.free_user_uid = response.json().get("uid")
        else:
            # User might already exist or registration disabled
            pytest.skip(f"Could not create free user: {response.text}")
    
    def test_free_user_blocked_from_marketplace(self):
        """Free user should get 403 when accessing marketplace"""
        if not hasattr(self, 'free_user_uid'):
            pytest.skip("Free user not created")
        
        response = requests.get(
            f"{BASE_URL}/api/marketplace/products",
            params={"user_id": self.free_user_uid}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        detail = data.get("detail", "")
        
        # Should mention VIP requirement
        assert "vip" in detail.lower(), f"Error message should mention VIP requirement: {detail}"
        
        print(f"✅ Free user marketplace block test passed: {detail}")
    
    def test_free_user_blocked_from_gift_voucher(self):
        """Free user should get 403 when requesting gift voucher"""
        if not hasattr(self, 'free_user_uid'):
            pytest.skip("Free user not created")
        
        response = requests.post(
            f"{BASE_URL}/api/gift-voucher/request",
            json={
                "user_id": self.free_user_uid,
                "denomination": 100
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        detail = data.get("detail", "")
        
        # Should mention VIP requirement
        assert "vip" in detail.lower(), f"Error message should mention VIP requirement: {detail}"
        
        print(f"✅ Free user gift voucher block test passed: {detail}")
    
    def test_free_user_blocked_from_bill_payment(self):
        """Free user should get 403 when requesting bill payment"""
        if not hasattr(self, 'free_user_uid'):
            pytest.skip("Free user not created")
        
        response = requests.post(
            f"{BASE_URL}/api/bill-payment/request",
            json={
                "user_id": self.free_user_uid,
                "request_type": "mobile_recharge",
                "amount_inr": 100,
                "details": {"phone_number": "9876543210", "operator": "Jio"}
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        detail = data.get("detail", "")
        
        # Should mention VIP requirement
        assert "vip" in detail.lower(), f"Error message should mention VIP requirement: {detail}"
        
        print(f"✅ Free user bill payment block test passed: {detail}")


class TestActiveVIPAccess:
    """Test that active VIP users have full access"""
    
    @pytest.fixture(autouse=True)
    def setup_active_vip_user(self):
        """Create an active VIP user for testing"""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        
        async def create_active_vip():
            client = AsyncIOMotorClient('mongodb://localhost:27017')
            db = client['test_database']
            
            # Create active VIP user with future expiry
            active_vip_uid = f"active-vip-test-{datetime.now().timestamp()}"
            future_expiry = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            
            user_data = {
                "uid": active_vip_uid,
                "email": f"active_vip_{datetime.now().timestamp()}@test.com",
                "password_hash": pwd_context.hash("testpass123"),
                "name": "Active VIP Test User",
                "membership_type": "vip",
                "vip_expiry": future_expiry,
                "prc_balance": 5000.0,  # Enough PRC for testing
                "role": "user",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.users.insert_one(user_data)
            client.close()
            
            return active_vip_uid, user_data["email"]
        
        try:
            self.active_vip_uid, self.active_vip_email = asyncio.run(create_active_vip())
        except Exception as e:
            pytest.skip(f"Could not create active VIP user: {e}")
    
    def test_active_vip_can_access_marketplace(self):
        """Active VIP user should be able to access marketplace"""
        if not hasattr(self, 'active_vip_uid'):
            pytest.skip("Active VIP user not created")
        
        response = requests.get(
            f"{BASE_URL}/api/marketplace/products",
            params={"user_id": self.active_vip_uid}
        )
        
        # Should return 200 (or 404 if no products, but not 403)
        assert response.status_code != 403, f"Active VIP should not be blocked: {response.text}"
        
        print(f"✅ Active VIP marketplace access test passed: status={response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
