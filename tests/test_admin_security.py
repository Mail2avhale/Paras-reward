"""
Admin Security Features Test Suite
Tests: JWT Token Authentication, Rate Limiting, Session Management, 
       Emergency Lockdown, IP Whitelisting, Audit Logging
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminLogin:
    """Test admin login with JWT token generation"""
    
    def test_admin_login_returns_tokens(self):
        """Test that admin login returns access_token and refresh_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin"
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify JWT tokens are returned
        assert "access_token" in data, "access_token not in response"
        assert "refresh_token" in data, "refresh_token not in response"
        assert len(data["access_token"]) > 50, "access_token seems too short"
        assert len(data["refresh_token"]) > 50, "refresh_token seems too short"
        
        # Verify user data
        assert "uid" in data, "uid not in response"
        assert data.get("role") in ["admin", "sub_admin"], f"Expected admin role, got {data.get('role')}"
        
        print(f"✅ Admin login successful - access_token length: {len(data['access_token'])}")
        print(f"✅ refresh_token length: {len(data['refresh_token'])}")
        
    def test_invalid_login_returns_error(self):
        """Test that invalid credentials return proper error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid login correctly returns 401")


class TestRateLimiting:
    """Test rate limiting on login endpoint"""
    
    def test_rate_limit_after_failed_attempts(self):
        """Test that login is blocked after 5 failed attempts"""
        # Use a unique identifier to avoid affecting other tests
        test_identifier = f"ratelimit_test_{int(time.time())}@test.com"
        
        # Make 5 failed login attempts
        for i in range(5):
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                params={
                    "identifier": test_identifier,
                    "password": "wrongpassword"
                }
            )
            # First attempts should return 404 (user not found) or 401 (wrong password)
            if i < 4:
                assert response.status_code in [401, 404], f"Attempt {i+1}: Expected 401/404, got {response.status_code}"
        
        # 6th attempt should be rate limited (429)
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": test_identifier,
                "password": "wrongpassword"
            }
        )
        
        # After 5 failed attempts, should get 429 Too Many Requests
        assert response.status_code == 429, f"Expected 429 after rate limit, got {response.status_code}: {response.text}"
        print("✅ Rate limiting working - 429 returned after 5 failed attempts")


class TestSecurityDashboard:
    """Test security dashboard endpoint"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin UID from login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin"
            }
        )
        assert response.status_code == 200
        return response.json()["uid"]
    
    def test_security_dashboard_loads(self, admin_uid):
        """Test that security dashboard returns all expected stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/dashboard",
            params={"admin_uid": admin_uid}
        )
        
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify all expected fields
        expected_fields = [
            "active_admin_sessions",
            "today_admin_logins",
            "failed_login_attempts_active",
            "lockdown_status",
            "ip_whitelist_enabled",
            "ip_whitelist_count",
            "session_timeout_minutes",
            "rate_limit_login_attempts",
            "jwt_token_expiry_minutes"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify data types
        assert isinstance(data["active_admin_sessions"], int)
        assert isinstance(data["today_admin_logins"], int)
        assert isinstance(data["lockdown_status"], dict)
        assert isinstance(data["ip_whitelist_enabled"], bool)
        
        print(f"✅ Security dashboard loaded successfully")
        print(f"   - Active sessions: {data['active_admin_sessions']}")
        print(f"   - Today's logins: {data['today_admin_logins']}")
        print(f"   - Session timeout: {data['session_timeout_minutes']} min")
        print(f"   - Rate limit: {data['rate_limit_login_attempts']} attempts")
        print(f"   - JWT expiry: {data['jwt_token_expiry_minutes']} min")
    
    def test_security_dashboard_requires_admin(self):
        """Test that non-admin cannot access security dashboard"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/dashboard",
            params={"admin_uid": "invalid_uid"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ Security dashboard correctly requires admin access")


class TestEmergencyLockdown:
    """Test emergency lockdown functionality"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin UID from login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin"
            }
        )
        assert response.status_code == 200
        return response.json()["uid"]
    
    def test_get_lockdown_status(self, admin_uid):
        """Test getting lockdown status"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/lockdown-status",
            params={"admin_uid": admin_uid}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify lockdown status structure
        assert "lockdown_active" in data
        assert isinstance(data["lockdown_active"], bool)
        
        print(f"✅ Lockdown status retrieved - Active: {data['lockdown_active']}")
    
    def test_activate_partial_lockdown(self, admin_uid):
        """Test activating partial lockdown"""
        response = requests.post(
            f"{BASE_URL}/api/admin/security/lockdown",
            params={
                "admin_uid": admin_uid,
                "lockdown_type": "partial",
                "reason": "Test partial lockdown",
                "locked_features": ["withdrawals", "registrations"]
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "partial" in data["message"].lower() or "lockdown" in data["message"].lower()
        
        print(f"✅ Partial lockdown activated: {data['message']}")
        
        # Verify lockdown is active
        status_response = requests.get(
            f"{BASE_URL}/api/admin/security/lockdown-status",
            params={"admin_uid": admin_uid}
        )
        status = status_response.json()
        assert status["lockdown_active"] == True, "Lockdown should be active"
        
    def test_deactivate_lockdown(self, admin_uid):
        """Test deactivating lockdown"""
        response = requests.post(
            f"{BASE_URL}/api/admin/security/lockdown/deactivate",
            params={"admin_uid": admin_uid}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "deactivate" in data["message"].lower()
        
        print(f"✅ Lockdown deactivated: {data['message']}")
        
        # Verify lockdown is inactive
        status_response = requests.get(
            f"{BASE_URL}/api/admin/security/lockdown-status",
            params={"admin_uid": admin_uid}
        )
        status = status_response.json()
        assert status["lockdown_active"] == False, "Lockdown should be inactive"
    
    def test_activate_full_lockdown_and_deactivate(self, admin_uid):
        """Test full lockdown cycle"""
        # Activate full lockdown
        response = requests.post(
            f"{BASE_URL}/api/admin/security/lockdown",
            params={
                "admin_uid": admin_uid,
                "lockdown_type": "full",
                "reason": "Test full lockdown"
            }
        )
        
        assert response.status_code == 200, f"Failed to activate: {response.text}"
        print("✅ Full lockdown activated")
        
        # Deactivate
        response = requests.post(
            f"{BASE_URL}/api/admin/security/lockdown/deactivate",
            params={"admin_uid": admin_uid}
        )
        
        assert response.status_code == 200, f"Failed to deactivate: {response.text}"
        print("✅ Full lockdown deactivated")


class TestIPWhitelist:
    """Test IP whitelist functionality"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin UID from login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin"
            }
        )
        assert response.status_code == 200
        return response.json()["uid"]
    
    def test_get_ip_whitelist(self, admin_uid):
        """Test getting IP whitelist"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/ip-whitelist",
            params={"admin_uid": admin_uid}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "enabled" in data
        assert "whitelist" in data
        assert isinstance(data["whitelist"], list)
        
        print(f"✅ IP whitelist retrieved - Enabled: {data['enabled']}, IPs: {len(data['whitelist'])}")
    
    def test_update_ip_whitelist(self, admin_uid):
        """Test updating IP whitelist"""
        test_ips = ["192.168.1.1", "10.0.0.1"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/security/ip-whitelist",
            params={
                "admin_uid": admin_uid,
                "enabled": True,
                "whitelist": test_ips
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        print(f"✅ IP whitelist updated: {data['message']}")
        
        # Verify update
        get_response = requests.get(
            f"{BASE_URL}/api/admin/security/ip-whitelist",
            params={"admin_uid": admin_uid}
        )
        whitelist_data = get_response.json()
        assert whitelist_data["enabled"] == True
        
    def test_disable_ip_whitelist(self, admin_uid):
        """Test disabling IP whitelist"""
        response = requests.post(
            f"{BASE_URL}/api/admin/security/ip-whitelist",
            params={
                "admin_uid": admin_uid,
                "enabled": False,
                "whitelist": []
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✅ IP whitelist disabled")


class TestAuditLogs:
    """Test audit logging functionality"""
    
    @pytest.fixture
    def admin_uid(self):
        """Get admin UID from login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin"
            }
        )
        assert response.status_code == 200
        return response.json()["uid"]
    
    def test_get_audit_logs(self, admin_uid):
        """Test getting audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/audit-logs",
            params={
                "admin_uid": admin_uid,
                "page": 1,
                "limit": 20
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "logs" in data
        assert "total" in data
        assert isinstance(data["logs"], list)
        assert isinstance(data["total"], int)
        
        print(f"✅ Audit logs retrieved - Total: {data['total']}, Page items: {len(data['logs'])}")
        
        # Verify log structure if logs exist
        if data["logs"]:
            log = data["logs"][0]
            expected_fields = ["action", "entity_type", "timestamp"]
            for field in expected_fields:
                assert field in log, f"Missing field in log: {field}"
            print(f"   - Latest action: {log['action']}")
    
    def test_audit_logs_pagination(self, admin_uid):
        """Test audit logs pagination"""
        # Get page 1
        response1 = requests.get(
            f"{BASE_URL}/api/admin/security/audit-logs",
            params={
                "admin_uid": admin_uid,
                "page": 1,
                "limit": 5
            }
        )
        
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Get page 2
        response2 = requests.get(
            f"{BASE_URL}/api/admin/security/audit-logs",
            params={
                "admin_uid": admin_uid,
                "page": 2,
                "limit": 5
            }
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Total should be same
        assert data1["total"] == data2["total"]
        print(f"✅ Audit logs pagination working - Total: {data1['total']}")
    
    def test_audit_logs_filtering(self, admin_uid):
        """Test audit logs filtering by action"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/audit-logs",
            params={
                "admin_uid": admin_uid,
                "action": "login",
                "page": 1,
                "limit": 10
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All logs should have action = login
        for log in data["logs"]:
            assert log["action"] == "login", f"Expected login action, got {log['action']}"
        
        print(f"✅ Audit logs filtering working - Found {len(data['logs'])} login events")


class TestSessionManagement:
    """Test admin session management"""
    
    def test_login_creates_session(self):
        """Test that login creates an admin session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify session-related data
        assert "access_token" in data
        assert "uid" in data
        
        # Check dashboard shows active session
        dashboard_response = requests.get(
            f"{BASE_URL}/api/admin/security/dashboard",
            params={"admin_uid": data["uid"]}
        )
        
        assert dashboard_response.status_code == 200
        dashboard = dashboard_response.json()
        
        assert dashboard["active_admin_sessions"] >= 1, "Should have at least 1 active session"
        print(f"✅ Login creates session - Active sessions: {dashboard['active_admin_sessions']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
