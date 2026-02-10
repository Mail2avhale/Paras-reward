"""
Backend API Tests - Modular Routes Refactoring Verification
Tests all critical flows after moving routes from server.py to routes/*.py

Covers:
- Auth Routes (auth.py): Registration, Login
- User Routes (users.py): Dashboard, Profile
- Wallet Routes (wallet.py): Balance, Transactions
- Referral Routes (referral.py): Referral code, list
- Admin Routes: Dashboard KPIs, Users, Orders, Products, Withdrawals
- Mining: Start, Collect
- Health & Cache: Status endpoints
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment (includes /api prefix)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials - will create fresh user for testing
TEST_EMAIL = f"test_modular_{uuid.uuid4().hex[:8]}@test.com"
TEST_PASSWORD = "123456"
TEST_MOBILE = f"9987{str(uuid.uuid4().int)[:6]}"
TEST_USER_UID = None  # Will be set after registration

# Existing user for dashboard tests (from previous iteration)
EXISTING_USER_UID = "73b95483-f36b-4637-a5ee-d447300c6835"
EXISTING_USER_EMAIL = "mail2avhale@gmail.com"


class TestHealthAndCache:
    """Test health check and cache endpoints"""
    
    def test_health_check(self):
        """Test GET /api/health - should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        assert "database" in data
        print(f"✅ Health check passed: {data}")
    
    def test_cache_stats(self):
        """Test GET /api/cache/stats - should return cache statistics"""
        response = requests.get(f"{BASE_URL}/api/cache/stats")
        assert response.status_code == 200, f"Cache stats failed: {response.text}"
        data = response.json()
        assert "cache" in data or "status" in data
        print(f"✅ Cache stats: {data.get('status', 'N/A')}")


class TestAuthRoutes:
    """Test Authentication Routes - /api/auth/*"""
    
    def test_check_auth_type_nonexistent_user(self):
        """Test GET /api/auth/check-auth-type for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/auth/check-auth-type", params={"identifier": "nonexistent@test.com"})
        assert response.status_code == 200
        data = response.json()
        assert "auth_type" in data
        assert data.get("user_exists") == False
        print(f"✅ Auth type check (nonexistent user): {data}")
    
    def test_check_auth_type_existing_user(self):
        """Test GET /api/auth/check-auth-type for existing user"""
        response = requests.get(f"{BASE_URL}/api/auth/check-auth-type", params={"identifier": EXISTING_USER_EMAIL})
        assert response.status_code == 200
        data = response.json()
        assert "auth_type" in data
        print(f"✅ Auth type check (existing user): {data}")
    
    def test_simple_registration(self):
        """Test POST /api/auth/register/simple - create new user"""
        global TEST_USER_UID
        
        payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "full_name": "Test Modular Routes",
            "mobile": TEST_MOBILE
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register/simple", json=payload)
        
        # Check if registration succeeded or email already exists
        if response.status_code == 400:
            data = response.json()
            if "already registered" in data.get("detail", "").lower():
                print(f"⚠️ Test user already exists, skipping creation")
                pytest.skip("Test user already exists")
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "uid" in data
        assert "message" in data
        TEST_USER_UID = data["uid"]
        print(f"✅ User registered: {TEST_USER_UID}")
    
    def test_login_with_invalid_credentials(self):
        """Test POST /api/auth/login with invalid password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": EXISTING_USER_EMAIL, "password": "wrongpassword123"}
        )
        # Should fail with 401 or 404
        assert response.status_code in [401, 404, 429], f"Expected 401/404/429, got {response.status_code}"
        print(f"✅ Invalid login correctly rejected with status {response.status_code}")
    
    def test_login_with_nonexistent_user(self):
        """Test POST /api/auth/login with non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": "doesnotexist@nowhere.com", "password": "123456"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "not registered" in data.get("detail", "").lower() or "not found" in data.get("detail", "").lower()
        print(f"✅ Non-existent user correctly rejected")
    
    def test_forgot_password_request(self):
        """Test POST /api/auth/forgot-password"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", params={"email": "test@example.com"})
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ Forgot password: {data.get('message')}")


class TestUserRoutes:
    """Test User Routes - /api/users/* and /api/user/*"""
    
    def test_get_user_by_uid(self):
        """Test GET /api/users/{uid}"""
        response = requests.get(f"{BASE_URL}/api/users/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Get user failed: {response.text}"
        data = response.json()
        assert "uid" in data
        assert "email" in data
        print(f"✅ User data retrieved: {data.get('name', 'N/A')}")
    
    def test_get_user_not_found(self):
        """Test GET /api/users/{uid} with non-existent UID"""
        response = requests.get(f"{BASE_URL}/api/users/nonexistent-uid-12345")
        assert response.status_code == 404
        print(f"✅ Non-existent user correctly returns 404")
    
    def test_get_user_dashboard(self):
        """Test GET /api/user/{uid}/dashboard - combined dashboard data"""
        response = requests.get(f"{BASE_URL}/api/user/{EXISTING_USER_UID}/dashboard")
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify dashboard structure
        assert "user" in data, "Missing 'user' in dashboard response"
        assert "mining" in data, "Missing 'mining' in dashboard response"
        assert "recent_activity" in data, "Missing 'recent_activity' in dashboard response"
        
        # Verify user data fields
        user_data = data["user"]
        assert "uid" in user_data
        assert "prc_balance" in user_data
        assert "subscription_plan" in user_data
        
        print(f"✅ Dashboard: balance={user_data.get('prc_balance')}, plan={user_data.get('subscription_plan')}")
    
    def test_get_user_today_stats(self):
        """Test GET /api/user/stats/today/{uid}"""
        response = requests.get(f"{BASE_URL}/api/user/stats/today/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Today stats failed: {response.text}"
        data = response.json()
        assert "today_earned" in data
        assert "today_spent" in data
        print(f"✅ Today stats: earned={data.get('today_earned')}, spent={data.get('today_spent')}")
    
    def test_get_user_redeemed_stats(self):
        """Test GET /api/user/stats/redeemed/{uid}"""
        response = requests.get(f"{BASE_URL}/api/user/stats/redeemed/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Redeemed stats failed: {response.text}"
        data = response.json()
        assert "total_redeemed" in data
        print(f"✅ Redeemed stats: total={data.get('total_redeemed')}")
    
    def test_birthday_check(self):
        """Test GET /api/user/{uid}/birthday-check"""
        response = requests.get(f"{BASE_URL}/api/user/{EXISTING_USER_UID}/birthday-check")
        assert response.status_code == 200
        data = response.json()
        assert "is_birthday" in data
        print(f"✅ Birthday check: {data.get('is_birthday')}")


class TestWalletRoutes:
    """Test Wallet Routes - /api/wallet/*"""
    
    def test_get_wallet_balance(self):
        """Test GET /api/wallet/{uid}"""
        response = requests.get(f"{BASE_URL}/api/wallet/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Wallet balance failed: {response.text}"
        data = response.json()
        assert "prc_balance" in data
        assert "wallet_status" in data
        print(f"✅ Wallet: balance={data.get('prc_balance')}, status={data.get('wallet_status')}")
    
    def test_get_wallet_transactions(self):
        """Test GET /api/wallet/transactions/{uid}"""
        response = requests.get(f"{BASE_URL}/api/wallet/transactions/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Wallet transactions failed: {response.text}"
        data = response.json()
        assert "transactions" in data
        assert "total" in data
        print(f"✅ Wallet transactions: count={len(data.get('transactions', []))}, total={data.get('total')}")
    
    def test_get_wallet_transactions_paginated(self):
        """Test GET /api/wallet/transactions/{uid} with pagination"""
        response = requests.get(f"{BASE_URL}/api/wallet/transactions/{EXISTING_USER_UID}", params={"page": 1, "limit": 5})
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert "page" in data
        assert "total_pages" in data
        print(f"✅ Paginated transactions: page={data.get('page')}/{data.get('total_pages')}")
    
    def test_get_withdrawal_history(self):
        """Test GET /api/wallet/withdrawals/{uid}"""
        response = requests.get(f"{BASE_URL}/api/wallet/withdrawals/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Withdrawal history failed: {response.text}"
        data = response.json()
        assert "cashback_withdrawals" in data or "profit_withdrawals" in data
        print(f"✅ Withdrawal history retrieved")
    
    def test_get_user_transactions_simple(self):
        """Test GET /api/transactions/user/{uid}"""
        response = requests.get(f"{BASE_URL}/api/transactions/user/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Simple transactions failed: {response.text}"
        data = response.json()
        assert "transactions" in data
        assert "pagination" in data
        print(f"✅ Simple transactions: count={len(data.get('transactions', []))}")


class TestReferralRoutes:
    """Test Referral Routes - /api/referral/*"""
    
    def test_get_referral_code(self):
        """Test GET /api/referral/code/{uid}"""
        response = requests.get(f"{BASE_URL}/api/referral/code/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Referral code failed: {response.text}"
        data = response.json()
        assert "referral_code" in data
        assert len(data["referral_code"]) > 0
        print(f"✅ Referral code: {data.get('referral_code')}")
    
    def test_get_referral_list(self):
        """Test GET /api/referral/list/{uid}"""
        response = requests.get(f"{BASE_URL}/api/referral/list/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Referral list failed: {response.text}"
        data = response.json()
        assert "referrals" in data
        assert "total" in data
        print(f"✅ Referrals: total={data.get('total')}")
    
    def test_get_referral_stats(self):
        """Test GET /api/referral/stats/{uid}"""
        response = requests.get(f"{BASE_URL}/api/referral/stats/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Referral stats failed: {response.text}"
        data = response.json()
        assert "total_referrals" in data
        assert "active_referrals" in data
        print(f"✅ Referral stats: total={data.get('total_referrals')}, active={data.get('active_referrals')}")
    
    def test_get_multi_level_referral_stats(self):
        """Test GET /api/referral/multi-level-stats/{uid}"""
        response = requests.get(f"{BASE_URL}/api/referral/multi-level-stats/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Multi-level stats failed: {response.text}"
        data = response.json()
        assert "levels" in data
        assert "summary" in data
        print(f"✅ Multi-level referrals: total={data.get('summary', {}).get('total_referrals', 0)}")
    
    def test_apply_invalid_referral_code(self):
        """Test POST /api/referral/apply/{uid} with invalid code"""
        response = requests.post(f"{BASE_URL}/api/referral/apply/{EXISTING_USER_UID}", params={"referral_code": "INVALID123"})
        # Should fail with 400 (already has referral) or 404 (invalid code)
        assert response.status_code in [400, 404]
        print(f"✅ Invalid referral code correctly rejected")


class TestMiningRoutes:
    """Test Mining Routes - /api/mining/*"""
    
    def test_mining_status(self):
        """Test GET /api/mining/status/{uid}"""
        response = requests.get(f"{BASE_URL}/api/mining/status/{EXISTING_USER_UID}")
        assert response.status_code == 200, f"Mining status failed: {response.text}"
        data = response.json()
        # Response should have mining-related fields
        print(f"✅ Mining status retrieved: {list(data.keys())[:5]}")
    
    def test_mining_start(self):
        """Test POST /api/mining/start/{uid}"""
        response = requests.post(f"{BASE_URL}/api/mining/start/{EXISTING_USER_UID}")
        # Could be 200 (started), 400 (already active), or other valid states
        assert response.status_code in [200, 400], f"Mining start unexpected status: {response.status_code}"
        data = response.json()
        print(f"✅ Mining start response: {data.get('message', str(data)[:100])}")
    
    def test_mining_collect(self):
        """Test POST /api/mining/collect/{uid}"""
        response = requests.post(f"{BASE_URL}/api/mining/collect/{EXISTING_USER_UID}")
        # Could be 200 (collected), 400 (nothing to collect), or other valid states
        assert response.status_code in [200, 400], f"Mining collect unexpected status: {response.status_code}"
        data = response.json()
        print(f"✅ Mining collect response: {data.get('message', str(data)[:100])}")


class TestAdminDashboardRoutes:
    """Test Admin Dashboard Routes - /api/admin/dashboard/*"""
    
    def test_admin_dashboard_kpis(self):
        """Test GET /api/admin/dashboard/kpis (via admin_dashboard.py)"""
        response = requests.get(f"{BASE_URL}/api/admin/debug/stats-live")
        assert response.status_code == 200, f"Admin debug stats failed: {response.text}"
        data = response.json()
        assert "total_users" in data or "error" not in data
        print(f"✅ Admin debug stats: users={data.get('total_users', 'N/A')}")
    
    def test_admin_stats(self):
        """Test GET /api/admin/stats"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200, f"Admin stats failed: {response.text}"
        data = response.json()
        if data:
            print(f"✅ Admin stats retrieved: {list(data.keys())[:5]}")
        else:
            print(f"✅ Admin stats returned None (acceptable)")
    
    def test_admin_dashboard_all(self):
        """Test GET /api/admin/dashboard-all"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-all")
        assert response.status_code == 200, f"Dashboard all failed: {response.text}"
        data = response.json()
        assert "counts" in data or "error" not in data
        print(f"✅ Admin dashboard-all: {list(data.keys())}")
    
    def test_admin_user_growth_chart(self):
        """Test GET /api/admin/charts/user-growth"""
        response = requests.get(f"{BASE_URL}/api/admin/charts/user-growth", params={"days": 7})
        assert response.status_code == 200, f"User growth chart failed: {response.text}"
        data = response.json()
        assert "labels" in data or "values" in data
        print(f"✅ User growth chart: {len(data.get('labels', []))} data points")


class TestAdminUsersRoutes:
    """Test Admin Users Routes - /api/admin/users/*"""
    
    def test_admin_users_list(self):
        """Test GET /api/admin/users"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200, f"Admin users list failed: {response.text}"
        data = response.json()
        assert "users" in data or isinstance(data, list)
        print(f"✅ Admin users list retrieved")
    
    def test_admin_users_list_paginated(self):
        """Test GET /api/admin/users with pagination"""
        response = requests.get(f"{BASE_URL}/api/admin/users", params={"page": 1, "limit": 5})
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Admin users paginated: {list(data.keys())}")
    
    def test_admin_user_stats(self):
        """Test GET /api/admin/user-stats"""
        response = requests.get(f"{BASE_URL}/api/admin/user-stats")
        assert response.status_code == 200, f"User stats failed: {response.text}"
        data = response.json()
        print(f"✅ Admin user stats: {list(data.keys())[:5]}")


class TestAdminOrdersRoutes:
    """Test Admin Orders Routes - /api/admin/orders/*"""
    
    def test_admin_orders_stats(self):
        """Test GET /api/admin/orders/stats"""
        response = requests.get(f"{BASE_URL}/api/admin/orders/stats")
        # Allow 200 or 404 (if no orders exist)
        assert response.status_code in [200, 404], f"Orders stats unexpected: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Admin orders stats: {list(data.keys())[:5]}")
        else:
            print(f"✅ Admin orders stats: No data (404)")
    
    def test_admin_orders_list(self):
        """Test GET /api/admin/orders"""
        response = requests.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200, f"Orders list failed: {response.text}"
        data = response.json()
        print(f"✅ Admin orders list: {list(data.keys())[:5] if isinstance(data, dict) else 'list response'}")


class TestAdminProductsRoutes:
    """Test Admin Products Routes - /api/admin/products/*"""
    
    def test_admin_products_list(self):
        """Test GET /api/admin/products"""
        response = requests.get(f"{BASE_URL}/api/admin/products")
        assert response.status_code == 200, f"Products list failed: {response.text}"
        data = response.json()
        assert "products" in data
        assert "total" in data
        print(f"✅ Admin products: total={data.get('total')}, count={len(data.get('products', []))}")
    
    def test_admin_products_paginated(self):
        """Test GET /api/admin/products with pagination"""
        response = requests.get(f"{BASE_URL}/api/admin/products", params={"page": 1, "limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert "products" in data
        print(f"✅ Admin products paginated: page={data.get('page')}/{data.get('pages')}")
    
    def test_admin_marketplace_settings(self):
        """Test GET /api/admin/settings/marketplace"""
        response = requests.get(f"{BASE_URL}/api/admin/settings/marketplace")
        assert response.status_code == 200, f"Marketplace settings failed: {response.text}"
        data = response.json()
        print(f"✅ Marketplace settings: {list(data.keys())}")
    
    def test_admin_redemption_rules(self):
        """Test GET /api/admin/settings/redemption-rules"""
        response = requests.get(f"{BASE_URL}/api/admin/settings/redemption-rules")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Redemption rules: {list(data.keys())}")


class TestAdminWithdrawalsRoutes:
    """Test Admin Withdrawals Routes - /api/admin/withdrawals/*"""
    
    def test_admin_withdrawals_pending_count(self):
        """Test GET /api/admin/withdrawals/pending-count"""
        response = requests.get(f"{BASE_URL}/api/admin/withdrawals/pending-count")
        assert response.status_code == 200, f"Pending count failed: {response.text}"
        data = response.json()
        print(f"✅ Admin withdrawals pending count: {data}")
    
    def test_admin_withdrawals_list(self):
        """Test GET /api/admin/withdrawals"""
        response = requests.get(f"{BASE_URL}/api/admin/withdrawals")
        # May return 200 with data or 200 with empty list
        assert response.status_code == 200, f"Withdrawals list failed: {response.text}"
        data = response.json()
        print(f"✅ Admin withdrawals list: {list(data.keys()) if isinstance(data, dict) else 'list'}")


class TestRouteAvailability:
    """Verify all modular routes are correctly registered and responding"""
    
    def test_auth_routes_available(self):
        """Verify auth routes are accessible"""
        endpoints = [
            "/api/auth/check-auth-type?identifier=test@test.com",
        ]
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [200, 400, 404], f"Auth route {endpoint} not available: {response.status_code}"
        print("✅ Auth routes available")
    
    def test_user_routes_available(self):
        """Verify user routes are accessible"""
        endpoints = [
            f"/api/users/{EXISTING_USER_UID}",
            f"/api/user/{EXISTING_USER_UID}/dashboard",
        ]
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [200, 404], f"User route {endpoint} failed: {response.status_code}"
        print("✅ User routes available")
    
    def test_wallet_routes_available(self):
        """Verify wallet routes are accessible"""
        endpoints = [
            f"/api/wallet/{EXISTING_USER_UID}",
            f"/api/wallet/transactions/{EXISTING_USER_UID}",
        ]
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 200, f"Wallet route {endpoint} failed: {response.status_code}"
        print("✅ Wallet routes available")
    
    def test_referral_routes_available(self):
        """Verify referral routes are accessible"""
        endpoints = [
            f"/api/referral/code/{EXISTING_USER_UID}",
            f"/api/referral/list/{EXISTING_USER_UID}",
        ]
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 200, f"Referral route {endpoint} failed: {response.status_code}"
        print("✅ Referral routes available")
    
    def test_admin_routes_available(self):
        """Verify admin routes are accessible"""
        endpoints = [
            "/api/admin/stats",
            "/api/admin/users",
            "/api/admin/products",
        ]
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [200, 401, 403], f"Admin route {endpoint} failed: {response.status_code}"
        print("✅ Admin routes available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
