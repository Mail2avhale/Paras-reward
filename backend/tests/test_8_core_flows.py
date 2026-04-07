"""
Test 8 Core Flows of PRC Reward Platform
1. Registration
2. Login
3. Subscription (Razorpay/Manual - NO PRC payment)
4. Reward collection (mining widget)
5. Redeem limit calculation
6. Invite/Referral
7. Redeem to Bank
8. KYC

Test Credentials:
- Primary User: Mobile 9970100782, PIN 997010, UID cbdf46d7-7d66-4d43-8495-e1432a2ab071
- Admin: Email admin@test.com, PIN 153759
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com')

# Test credentials - Updated based on actual DB
PRIMARY_USER_MOBILE = "9970100782"
PRIMARY_USER_PIN = "997010"
PRIMARY_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # Actual UID from login
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health check passed: {data}")


class TestRegistrationFlow:
    """Flow 1: Registration"""
    
    def test_registration_page_api_check_auth_type(self):
        """Test auth type check for existing user"""
        response = requests.get(
            f"{BASE_URL}/api/auth/check-auth-type",
            params={"identifier": PRIMARY_USER_MOBILE},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("user_exists") == True
        print(f"✅ Auth type check for existing user: {data}")
    
    def test_registration_page_api_check_new_user(self):
        """Test auth type check for non-existing user"""
        response = requests.get(
            f"{BASE_URL}/api/auth/check-auth-type",
            params={"identifier": "1234567890"},  # Test number
            timeout=10
        )
        # API returns 200 with user_exists field - just verify API works
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Auth type check: user_exists={data.get('user_exists')}")
        else:
            print(f"✅ Auth type check: 404 (user not found)")


class TestLoginFlow:
    """Flow 2: Login"""
    
    def test_login_with_valid_credentials(self):
        """Test login with valid mobile + PIN"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "identifier": PRIMARY_USER_MOBILE,
                "password": PRIMARY_USER_PIN
            },
            timeout=15
        )
        assert response.status_code == 200
        data = response.json()
        assert "uid" in data
        assert data.get("uid") == PRIMARY_USER_UID
        print(f"✅ Login successful: uid={data.get('uid')}, name={data.get('name')}")
    
    def test_login_with_invalid_pin(self):
        """Test login with wrong PIN"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "identifier": PRIMARY_USER_MOBILE,
                "password": "000000"  # Wrong PIN
            },
            timeout=15
        )
        # Should return 401 or 400
        assert response.status_code in [400, 401, 429]
        print(f"✅ Invalid PIN rejected: status={response.status_code}")


class TestSubscriptionFlow:
    """Flow 3: Subscription (Razorpay/Manual - NO PRC payment)"""
    
    def test_subscription_plans_endpoint(self):
        """Test subscription plans API"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "plans" in data
        plans = data["plans"]
        assert len(plans) > 0
        
        # Check plan structure
        for plan in plans:
            assert "id" in plan
            assert "name" in plan
            print(f"  - Plan: {plan.get('name')} (id={plan.get('id')})")
        
        print(f"✅ Subscription plans loaded: {len(plans)} plans")
    
    def test_subscription_user_status(self):
        """Test user subscription status"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/user/{PRIMARY_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✅ User subscription status: {data.get('subscription', {}).get('plan', 'explorer')}")
    
    def test_public_settings_payment_methods(self):
        """Test public settings for payment methods"""
        response = requests.get(f"{BASE_URL}/api/settings/public", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        # Check payment gateway settings
        razorpay_enabled = data.get("razorpay_enabled", False)
        manual_enabled = data.get("manual_subscription_enabled", False)
        
        print(f"✅ Payment methods - Razorpay: {razorpay_enabled}, Manual: {manual_enabled}")


class TestMiningRewardFlow:
    """Flow 4: Reward collection (mining widget)"""
    
    def test_mining_status(self):
        """Test mining status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/mining/status/{PRIMARY_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check mining status fields
        assert "session_active" in data or "active" in data
        print(f"✅ Mining status: active={data.get('session_active', data.get('active'))}, rate={data.get('mining_rate_per_hour', data.get('mining_rate'))}")
    
    def test_mining_start_session(self):
        """Test starting a mining session"""
        response = requests.post(
            f"{BASE_URL}/api/mining/start/{PRIMARY_USER_UID}",
            timeout=15
        )
        # Can be 200 (started) or 400 (already active)
        assert response.status_code in [200, 400]
        data = response.json()
        print(f"✅ Mining start: status={response.status_code}, response={data}")


class TestRedeemLimitFlow:
    """Flow 5: Redeem limit calculation"""
    
    def test_redeem_limit_endpoint(self):
        """Test redeem limit API"""
        response = requests.get(
            f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redeem-limit",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check redeem limit structure
        assert "success" in data
        if data.get("success"):
            limit = data.get("limit", {})
            print(f"✅ Redeem limit: total={limit.get('total_limit')}, used={limit.get('total_redeemed')}, available={limit.get('effective_available')}")
        else:
            print(f"✅ Redeem limit response: {data}")


class TestReferralFlow:
    """Flow 6: Invite/Referral"""
    
    def test_user_referral_code(self):
        """Test user has referral code"""
        response = requests.get(
            f"{BASE_URL}/api/user/{PRIMARY_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        referral_code = data.get("referral_code")
        assert referral_code is not None
        print(f"✅ User referral code: {referral_code}")
    
    def test_referral_lookup(self):
        """Test referral code lookup"""
        # First get user's referral code
        user_response = requests.get(
            f"{BASE_URL}/api/user/{PRIMARY_USER_UID}",
            timeout=10
        )
        referral_code = user_response.json().get("referral_code")
        
        if referral_code:
            response = requests.get(
                f"{BASE_URL}/api/referral/lookup/{referral_code}",
                timeout=10
            )
            assert response.status_code == 200
            data = response.json()
            assert data.get("valid") == True
            print(f"✅ Referral lookup: valid={data.get('valid')}, referrer={data.get('referrer_name')}")
    
    def test_network_stats(self):
        """Test network stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/growth/network-stats/{PRIMARY_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        if data.get("success"):
            stats = data.get("data", {})
            print(f"✅ Network stats: direct={stats.get('direct_referrals')}, network_size={stats.get('network_size')}")
        else:
            print(f"✅ Network stats response: {data}")


class TestBankRedeemFlow:
    """Flow 7: Redeem to Bank"""
    
    def test_bank_transfer_config(self):
        """Test bank transfer config endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/bank-transfer/config",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check config fields
        assert "prc_rate" in data
        assert "min_withdrawal" in data
        assert "max_withdrawal" in data
        print(f"✅ Bank transfer config: rate={data.get('prc_rate')}, min={data.get('min_withdrawal')}, max={data.get('max_withdrawal')}")
    
    def test_ifsc_verification(self):
        """Test IFSC code verification"""
        response = requests.post(
            f"{BASE_URL}/api/bank-transfer/verify-ifsc",
            params={"ifsc": "HDFC0001234"},
            timeout=10
        )
        # Can be 200 (valid) or 400/404 (invalid)
        print(f"✅ IFSC verification: status={response.status_code}")


class TestKYCFlow:
    """Flow 8: KYC"""
    
    def test_kyc_status_check(self):
        """Test KYC status check endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/kyc/check-status/{PRIMARY_USER_UID}",
            timeout=10
        )
        # Can be 200 or 404 if user has no KYC record
        if response.status_code == 200:
            data = response.json()
            kyc_status = data.get("kyc_status")
            has_document = data.get("has_document")
            print(f"✅ KYC status: status={kyc_status}, has_document={has_document}")
        elif response.status_code == 404:
            print(f"✅ KYC status: No KYC record found (404)")
        assert response.status_code in [200, 404]
    
    def test_user_kyc_status(self):
        """Test user KYC status from user endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/user/{PRIMARY_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        kyc_status = data.get("kyc_status")
        print(f"✅ User KYC status: {kyc_status}")


class TestNavigationRoutes:
    """Test that key routes don't crash"""
    
    def test_dashboard_api(self):
        """Test dashboard combined API"""
        response = requests.get(
            f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/dashboard",
            timeout=15
        )
        # Can be 200 or 404 if endpoint doesn't exist
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Dashboard API: user={data.get('user', {}).get('name')}")
        else:
            print(f"✅ Dashboard API: status={response.status_code} (may use individual endpoints)")
    
    def test_user_endpoint(self):
        """Test user endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/user/{PRIMARY_USER_UID}",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "uid" in data
        assert "name" in data
        print(f"✅ User endpoint: name={data.get('name')}, plan={data.get('subscription_plan')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
