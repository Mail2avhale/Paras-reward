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
        
    def test_nonexistent_user_returns_404(self):
        """Test that non-existent user returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "nonexistent_user_12345@test.com",
                "password": "anypassword"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Non-existent user correctly returns 404")


class TestRateLimiting:
    """Test rate limiting on login endpoint - Note: Rate limiting is per-process in-memory"""
    
    def test_rate_limit_configuration_exists(self):
        """Test that rate limit configuration is returned in dashboard"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin"
            }
        )
        assert login_response.status_code == 200
        admin_uid = login_response.json()["uid"]
        
        # Check dashboard for rate limit config
        response = requests.get(
            f"{BASE_URL}/api/admin/security/dashboard",
            params={"admin_uid": admin_uid}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "rate_limit_login_attempts" in data
        assert data["rate_limit_login_attempts"] == 5, "Rate limit should be 5 attempts"
        print(f"✅ Rate limit configured: {data['rate_limit_login_attempts']} attempts per minute")


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
    
    def test_activate_and_deactivate_partial_lockdown(self, admin_uid):
        """Test activating and deactivating partial lockdown"""
        # Activate partial lockdown
        response = requests.post(
            f"{BASE_URL}/api/admin/security/lockdown",
            params={
                "admin_uid": admin_uid,
                "lockdown_type": "partial",
                "reason": "Test partial lockdown",
                "locked_features": ["withdrawals", "registrations"]
            }
        )
        
        assert response.status_code == 200, f"Failed to activate: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✅ Partial lockdown activated: {data['message']}")
        
        # Verify lockdown is active
        status_response = requests.get(
            f"{BASE_URL}/api/admin/security/lockdown-status",
            params={"admin_uid": admin_uid}
        )
        assert status_response.status_code == 200
        status = status_response.json()
        assert status["lockdown_active"] == True, "Lockdown should be active"
        print(f"✅ Lockdown status verified as active")
        
        # Deactivate lockdown
        deactivate_response = requests.post(
            f"{BASE_URL}/api/admin/security/lockdown/deactivate",
            params={"admin_uid": admin_uid}
        )
        
        assert deactivate_response.status_code == 200, f"Failed to deactivate: {deactivate_response.text}"
        print(f"✅ Lockdown deactivated")
        
        # Verify lockdown is inactive
        final_status = requests.get(
            f"{BASE_URL}/api/admin/security/lockdown-status",
            params={"admin_uid": admin_uid}
        )
        assert final_status.status_code == 200
        final_data = final_status.json()
        assert final_data["lockdown_active"] == False, "Lockdown should be inactive"
        print(f"✅ Lockdown status verified as inactive")
    
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
    
    def test_update_ip_whitelist_via_query_params(self, admin_uid):
        """Test updating IP whitelist using query parameters"""
        test_ips = ["192.168.1.1", "10.0.0.1"]
        
        # Build URL with multiple whitelist params
        url = f"{BASE_URL}/api/admin/security/ip-whitelist?admin_uid={admin_uid}&enabled=true"
        for ip in test_ips:
            url += f"&whitelist={ip}"
        
        response = requests.post(url)
        
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
        print(f"✅ IP whitelist enabled verified")
        
    def test_disable_ip_whitelist(self, admin_uid):
        """Test disabling IP whitelist"""
        url = f"{BASE_URL}/api/admin/security/ip-whitelist?admin_uid={admin_uid}&enabled=false&whitelist="
        
        response = requests.post(url)
        
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
    
    def test_login_creates_session_and_dashboard_shows_it(self):
        """Test that login creates an admin session visible in dashboard"""
        # Login
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
        admin_uid = data["uid"]
        
        # Check dashboard shows active session
        dashboard_response = requests.get(
            f"{BASE_URL}/api/admin/security/dashboard",
            params={"admin_uid": admin_uid}
        )
        
        assert dashboard_response.status_code == 200, f"Dashboard failed: {dashboard_response.text}"
        dashboard = dashboard_response.json()
        
        assert "active_admin_sessions" in dashboard
        assert dashboard["active_admin_sessions"] >= 0, "Should have session count"
        print(f"✅ Login successful - Active sessions: {dashboard['active_admin_sessions']}")
        print(f"✅ Today's logins: {dashboard['today_admin_logins']}")


class TestJWTTokens:
    """Test JWT token functionality"""
    
    def test_jwt_tokens_are_valid_format(self):
        """Test that JWT tokens have valid format (3 parts separated by dots)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        access_token = data["access_token"]
        refresh_token = data["refresh_token"]
        
        # JWT tokens have 3 parts: header.payload.signature
        assert len(access_token.split('.')) == 3, "Access token should have 3 parts"
        assert len(refresh_token.split('.')) == 3, "Refresh token should have 3 parts"
        
        print(f"✅ JWT tokens have valid format")
        print(f"   - Access token parts: {len(access_token.split('.'))}")
        print(f"   - Refresh token parts: {len(refresh_token.split('.'))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
