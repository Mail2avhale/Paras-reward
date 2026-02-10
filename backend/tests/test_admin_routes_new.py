"""
Test Admin VIP, Delivery, and System Routes
Tests for the 3 new admin route modules:
- admin_vip.py - VIP payment management, subscription stats
- admin_delivery.py - Delivery partner management
- admin_system.py - Database stats, diagnostics, user lockout management
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment - NO default to fail fast if missing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user from previous iteration
TEST_USER_UID = "73b95483-f36b-4637-a5ee-d447300c6835"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ========== ADMIN VIP ROUTES TESTS ==========

class TestAdminVIPPayments:
    """Tests for /api/admin/vip-payments* endpoints"""
    
    def test_get_pending_payments_count(self, api_client):
        """Test GET /api/admin/vip-payments/pending-count"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments/pending-count")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
        print(f"✓ Pending payments count: {data['count']}")
    
    def test_get_vip_payments_list(self, api_client):
        """Test GET /api/admin/vip-payments - List all VIP payments"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments")
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        assert isinstance(data["payments"], list)
        print(f"✓ VIP payments list returned {len(data['payments'])} payments, total: {data['total']}")
    
    def test_get_vip_payments_with_status_filter(self, api_client):
        """Test GET /api/admin/vip-payments?status=pending"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        # Verify all payments have pending status
        for payment in data["payments"]:
            assert payment.get("status") == "pending"
        print(f"✓ Pending VIP payments: {len(data['payments'])}")
    
    def test_get_vip_payments_with_pagination(self, api_client):
        """Test GET /api/admin/vip-payments with pagination params"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-payments?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert len(data["payments"]) <= 10
        print(f"✓ Pagination working - Page 1, limit 10")


class TestAdminSubscriptionStats:
    """Tests for subscription management endpoints"""
    
    def test_get_subscription_stats(self, api_client):
        """Test GET /api/admin/subscription-stats"""
        response = api_client.get(f"{BASE_URL}/api/admin/subscription-stats")
        assert response.status_code == 200
        data = response.json()
        assert "by_plan" in data
        assert "total_users" in data
        assert "vip_users" in data
        assert isinstance(data["total_users"], int)
        assert isinstance(data["vip_users"], int)
        print(f"✓ Subscription stats: total_users={data['total_users']}, vip_users={data['vip_users']}")
    
    def test_get_subscription_pricing_reference(self, api_client):
        """Test GET /api/admin/subscription-pricing-reference"""
        response = api_client.get(f"{BASE_URL}/api/admin/subscription-pricing-reference")
        assert response.status_code == 200
        data = response.json()
        # Check expected plans exist
        assert "explorer" in data
        assert "startup" in data
        assert "growth" in data
        assert "elite" in data
        # Check explorer plan structure
        assert data["explorer"]["name"] == "Explorer"
        assert data["explorer"]["price"] == 0
        # Check startup plan has prices for durations
        assert "prices" in data["startup"]
        assert "monthly" in data["startup"]["prices"]
        print(f"✓ Pricing reference returned {len(data)} plans")
    
    def test_get_vip_migration_status(self, api_client):
        """Test GET /api/admin/vip-migration-status"""
        response = api_client.get(f"{BASE_URL}/api/admin/vip-migration-status")
        assert response.status_code == 200
        data = response.json()
        assert "legacy_vip_users" in data
        assert "migrated_users" in data
        assert "migration_complete" in data
        assert isinstance(data["legacy_vip_users"], int)
        assert isinstance(data["migrated_users"], int)
        assert isinstance(data["migration_complete"], bool)
        print(f"✓ Migration status: legacy={data['legacy_vip_users']}, migrated={data['migrated_users']}, complete={data['migration_complete']}")


# ========== ADMIN DELIVERY ROUTES TESTS ==========

class TestAdminDeliveryPartners:
    """Tests for /api/admin/delivery-partners* endpoints"""
    
    def test_get_delivery_partners_list(self, api_client):
        """Test GET /api/admin/delivery-partners"""
        response = api_client.get(f"{BASE_URL}/api/admin/delivery-partners")
        assert response.status_code == 200
        data = response.json()
        assert "partners" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        assert isinstance(data["partners"], list)
        print(f"✓ Delivery partners list: {len(data['partners'])} partners, total: {data['total']}")
    
    def test_get_delivery_partners_with_status_filter(self, api_client):
        """Test GET /api/admin/delivery-partners?status=active"""
        response = api_client.get(f"{BASE_URL}/api/admin/delivery-partners?status=active")
        assert response.status_code == 200
        data = response.json()
        assert "partners" in data
        # Verify all partners are active
        for partner in data["partners"]:
            assert partner.get("is_active") == True
        print(f"✓ Active delivery partners: {len(data['partners'])}")
    
    def test_get_delivery_partner_stats(self, api_client):
        """Test GET /api/admin/delivery-partners/stats"""
        response = api_client.get(f"{BASE_URL}/api/admin/delivery-partners/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_partners" in data
        assert "active_partners" in data
        assert "verified_partners" in data
        assert "pending_assignment" in data
        assert "out_for_delivery" in data
        print(f"✓ Delivery stats: total={data['total_partners']}, active={data['active_partners']}, pending_orders={data['pending_assignment']}")
    
    def test_create_delivery_partner(self, api_client):
        """Test POST /api/admin/delivery-partners - Create partner"""
        test_partner = {
            "name": f"TEST_Partner_{uuid.uuid4().hex[:6]}",
            "company_name": "Test Delivery Co",
            "phone": "9999999999",
            "email": f"test_partner_{uuid.uuid4().hex[:6]}@test.com",
            "service_states": ["Maharashtra", "Gujarat"],
            "commission_type": "percentage",
            "commission_rate": 10
        }
        response = api_client.post(f"{BASE_URL}/api/admin/delivery-partners", json=test_partner)
        assert response.status_code == 200
        data = response.json()
        assert "partner_id" in data
        assert "message" in data
        assert data["message"] == "Delivery partner created successfully"
        print(f"✓ Delivery partner created: {data['partner_id']}")
        
        # Store partner_id for cleanup
        return data["partner_id"]
    
    def test_get_delivery_partner_by_id(self, api_client):
        """Test GET /api/admin/delivery-partners/{partner_id}"""
        # First create a partner
        test_partner = {
            "name": f"TEST_GetPartner_{uuid.uuid4().hex[:6]}",
            "company_name": "Test Get Co",
            "phone": "8888888888",
            "email": f"test_get_{uuid.uuid4().hex[:6]}@test.com",
            "service_states": ["Delhi"]
        }
        create_response = api_client.post(f"{BASE_URL}/api/admin/delivery-partners", json=test_partner)
        assert create_response.status_code == 200
        partner_id = create_response.json()["partner_id"]
        
        # Now get the partner
        response = api_client.get(f"{BASE_URL}/api/admin/delivery-partners/{partner_id}")
        assert response.status_code == 200
        data = response.json()
        assert "partner" in data
        assert "recent_orders" in data
        assert data["partner"]["partner_id"] == partner_id
        assert data["partner"]["name"] == test_partner["name"]
        print(f"✓ Retrieved delivery partner: {partner_id}")
    
    def test_get_nonexistent_delivery_partner(self, api_client):
        """Test GET /api/admin/delivery-partners/{partner_id} with non-existent ID"""
        response = api_client.get(f"{BASE_URL}/api/admin/delivery-partners/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ Returns 404 for non-existent partner")


# ========== ADMIN SYSTEM ROUTES TESTS ==========

class TestAdminDatabaseStats:
    """Tests for database and system statistics endpoints"""
    
    def test_get_database_stats(self, api_client):
        """Test GET /api/admin/database/stats"""
        response = api_client.get(f"{BASE_URL}/api/admin/database/stats")
        assert response.status_code == 200
        data = response.json()
        # Check required fields
        assert "users" in data
        assert "transactions" in data
        assert "orders" in data
        assert "vip_payments" in data
        assert "activity_logs" in data
        assert "today" in data
        # Check today's activity
        assert "new_users" in data["today"]
        assert "transactions" in data["today"]
        assert "orders" in data["today"]
        print(f"✓ Database stats: users={data['users']}, transactions={data['transactions']}, orders={data['orders']}")
    
    def test_get_dashboard_diagnostic(self, api_client):
        """Test GET /api/admin/system/dashboard-diagnostic"""
        response = api_client.get(f"{BASE_URL}/api/admin/system/dashboard-diagnostic")
        assert response.status_code == 200
        data = response.json()
        assert "timestamp" in data
        assert "database" in data
        assert "cache" in data
        assert "today_activity" in data
        # Check database status
        assert data["database"]["connected"] == True
        assert "collections" in data["database"]
        print(f"✓ Dashboard diagnostic: DB connected, {data['database']['collections']} collections")


class TestAdminLockoutManagement:
    """Tests for user lockout management endpoints"""
    
    def test_clear_all_lockouts_now(self, api_client):
        """Test GET /api/admin/clear-all-lockouts-now"""
        response = api_client.get(f"{BASE_URL}/api/admin/clear-all-lockouts-now")
        assert response.status_code == 200
        data = response.json()
        assert "cleared" in data
        assert isinstance(data["cleared"], int)
        print(f"✓ Cleared lockouts: {data['cleared']}")
    
    def test_diagnose_user_by_uid(self, api_client):
        """Test GET /api/admin/diagnose-user/{identifier} with UID"""
        response = api_client.get(f"{BASE_URL}/api/admin/diagnose-user/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert "found" in data
        if data["found"]:
            assert "user" in data
            assert "login_attempts" in data
            assert data["user"]["uid"] == TEST_USER_UID
            print(f"✓ User diagnosed: {data['user'].get('email', 'N/A')}")
        else:
            print(f"✓ User not found (expected for non-existent user)")
    
    def test_diagnose_nonexistent_user(self, api_client):
        """Test GET /api/admin/diagnose-user/{identifier} with non-existent identifier"""
        response = api_client.get(f"{BASE_URL}/api/admin/diagnose-user/nonexistent-user-12345")
        assert response.status_code == 200
        data = response.json()
        assert data["found"] == False
        assert data["identifier"] == "nonexistent-user-12345"
        print("✓ Returns found=False for non-existent user")


class TestAdminSystemIndexes:
    """Tests for system index and cache endpoints"""
    
    def test_get_system_index_stats(self, api_client):
        """Test GET /api/admin/system/index-stats"""
        response = api_client.get(f"{BASE_URL}/api/admin/system/index-stats")
        assert response.status_code == 200
        data = response.json()
        assert "collections" in data
        assert "index_stats" in data
        print(f"✓ Index stats: {data['collections']} collections")
    
    def test_get_cache_stats(self, api_client):
        """Test GET /api/admin/system/cache-stats"""
        response = api_client.get(f"{BASE_URL}/api/admin/system/cache-stats")
        assert response.status_code == 200
        data = response.json()
        assert "cache_enabled" in data
        print(f"✓ Cache stats: enabled={data['cache_enabled']}")
    
    def test_get_db_index_status(self, api_client):
        """Test GET /api/admin/db/index-status"""
        response = api_client.get(f"{BASE_URL}/api/admin/db/index-status")
        assert response.status_code == 200
        data = response.json()
        assert "indexes" in data
        # Check expected collections have indexes
        expected_collections = ["users", "transactions", "orders", "vip_payments"]
        for coll in expected_collections:
            if coll in data["indexes"]:
                print(f"  - {coll}: {len(data['indexes'][coll])} indexes")
        print(f"✓ Index status retrieved for {len(data['indexes'])} collections")


class TestAdminSubscriptionPricing:
    """Tests for subscription pricing management"""
    
    def test_get_subscription_pricing(self, api_client):
        """Test GET /api/admin/subscription/pricing"""
        response = api_client.get(f"{BASE_URL}/api/admin/subscription/pricing")
        assert response.status_code == 200
        data = response.json()
        # May return empty plans if not set
        assert isinstance(data, dict)
        print(f"✓ Subscription pricing retrieved")


class TestRouteAvailability:
    """Verify all new admin routes are accessible"""
    
    def test_admin_vip_routes_available(self, api_client):
        """Test that all admin VIP routes return expected status codes"""
        routes = [
            ("/api/admin/vip-payments/pending-count", 200),
            ("/api/admin/vip-payments", 200),
            ("/api/admin/subscription-stats", 200),
            ("/api/admin/subscription-pricing-reference", 200),
            ("/api/admin/vip-migration-status", 200),
        ]
        for route, expected_status in routes:
            response = api_client.get(f"{BASE_URL}{route}")
            assert response.status_code == expected_status, f"Route {route} returned {response.status_code}, expected {expected_status}"
            print(f"  ✓ {route} -> {response.status_code}")
        print("✓ All admin VIP routes accessible")
    
    def test_admin_delivery_routes_available(self, api_client):
        """Test that all admin delivery routes return expected status codes"""
        routes = [
            ("/api/admin/delivery-partners", 200),
            ("/api/admin/delivery-partners/stats", 200),
        ]
        for route, expected_status in routes:
            response = api_client.get(f"{BASE_URL}{route}")
            assert response.status_code == expected_status, f"Route {route} returned {response.status_code}, expected {expected_status}"
            print(f"  ✓ {route} -> {response.status_code}")
        print("✓ All admin delivery routes accessible")
    
    def test_admin_system_routes_available(self, api_client):
        """Test that all admin system routes return expected status codes"""
        routes = [
            ("/api/admin/database/stats", 200),
            ("/api/admin/system/dashboard-diagnostic", 200),
            ("/api/admin/clear-all-lockouts-now", 200),
            ("/api/admin/system/index-stats", 200),
            ("/api/admin/system/cache-stats", 200),
            ("/api/admin/db/index-status", 200),
            (f"/api/admin/diagnose-user/{TEST_USER_UID}", 200),
        ]
        for route, expected_status in routes:
            response = api_client.get(f"{BASE_URL}{route}")
            assert response.status_code == expected_status, f"Route {route} returned {response.status_code}, expected {expected_status}"
            print(f"  ✓ {route} -> {response.status_code}")
        print("✓ All admin system routes accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
