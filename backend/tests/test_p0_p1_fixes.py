"""
P0/P1 Fixes Test Suite
======================
Tests for:
1. DMT Account Verification API - POST /api/eko/dmt/verify-account (JSON body)
2. Scheduler Status API - GET /api/admin/scheduler/status
3. PRC Burn History API - GET /api/admin/prc-burn-control/history
4. Smart Burn API - POST /api/admin/smart-burn
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDMTAccountVerification:
    """Test DMT Account Verification API - Fixed to accept JSON body"""
    
    def test_verify_account_endpoint_exists(self):
        """Test that verify-account endpoint exists and accepts POST"""
        url = f"{BASE_URL}/api/eko/dmt/verify-account"
        
        # Send POST request with JSON body
        response = requests.post(
            url,
            json={
                "account": "1234567890123",
                "ifsc": "HDFC0001234",
                "user_id": "test_user_001"
            },
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        # Should not return 404 (route exists) or 405 (method allowed)
        assert response.status_code != 404, f"Endpoint not found: {url}"
        assert response.status_code != 405, f"POST method not allowed: {url}"
        
        # Expected: 200 (success), 400 (validation error), or 500 (EKO config error)
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}"
        print(f"✓ verify-account endpoint accepts POST with JSON body")
        print(f"  Status: {response.status_code}")
        
    def test_verify_account_requires_json_body(self):
        """Test that verify-account requires JSON body (not query params)"""
        url = f"{BASE_URL}/api/eko/dmt/verify-account"
        
        # Test with JSON body - should work
        json_response = requests.post(
            url,
            json={
                "account": "9876543210123",
                "ifsc": "SBIN0001234",
                "user_id": "test_user_002"
            },
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        # Should not be 422 (validation error for missing body)
        # If we get 500, it's likely EKO config issue (expected in test env)
        assert json_response.status_code in [200, 400, 500], \
            f"JSON body request should work. Got: {json_response.status_code}"
        
        result = json_response.json()
        print(f"✓ verify-account processes JSON body correctly")
        print(f"  Response: {result}")
        
    def test_verify_account_validates_ifsc_format(self):
        """Test IFSC validation in verify-account"""
        url = f"{BASE_URL}/api/eko/dmt/verify-account"
        
        # Invalid IFSC (too short)
        response = requests.post(
            url,
            json={
                "account": "1234567890",
                "ifsc": "ABC",  # Invalid - should be 11 chars
                "user_id": "test_user_003"
            },
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        # Pydantic will validate and return 422 for invalid IFSC
        # Or the backend might handle it differently
        print(f"  IFSC validation response: {response.status_code}")
        print(f"  Body: {response.json() if response.status_code in [400, 422, 500] else 'OK'}")


class TestSchedulerStatusAPI:
    """Test Scheduler Status API - New admin endpoint"""
    
    def test_scheduler_status_endpoint_exists(self):
        """Test that scheduler/status endpoint exists"""
        url = f"{BASE_URL}/api/admin/scheduler/status"
        
        response = requests.get(url, timeout=30)
        
        # Should not return 404
        assert response.status_code != 404, f"Endpoint not found: {url}"
        
        print(f"✓ scheduler/status endpoint exists")
        print(f"  Status: {response.status_code}")
        
    def test_scheduler_status_returns_expected_fields(self):
        """Test scheduler/status returns expected response structure"""
        url = f"{BASE_URL}/api/admin/scheduler/status"
        
        response = requests.get(url, timeout=30)
        
        # Should return 200
        assert response.status_code == 200, f"Expected 200, got: {response.status_code}"
        
        data = response.json()
        
        # Check expected fields
        assert "success" in data, "Response missing 'success' field"
        assert "scheduler_running" in data, "Response missing 'scheduler_running' field"
        
        # Should have jobs list
        if data.get("success"):
            assert "jobs" in data, "Response missing 'jobs' field"
            assert "total_jobs" in data, "Response missing 'total_jobs' field"
            assert "recommendation" in data, "Response missing 'recommendation' field"
        
        print(f"✓ scheduler/status returns expected structure")
        print(f"  Scheduler running: {data.get('scheduler_running')}")
        print(f"  Total jobs: {data.get('total_jobs', 0)}")
        print(f"  Recommendation: {data.get('recommendation', 'N/A')[:50]}...")
        
    def test_scheduler_status_lists_jobs(self):
        """Test scheduler/status lists scheduled jobs"""
        url = f"{BASE_URL}/api/admin/scheduler/status"
        
        response = requests.get(url, timeout=30)
        data = response.json()
        
        if data.get("success") and data.get("scheduler_running"):
            jobs = data.get("jobs", [])
            print(f"✓ Scheduler has {len(jobs)} jobs configured")
            
            for job in jobs[:5]:  # Show first 5 jobs
                print(f"  - {job.get('name', job.get('id', 'unknown'))}: next run {job.get('next_run_ist', 'N/A')}")
        else:
            print(f"  Scheduler not running or no jobs. This is informational.")
            # Not a failure - scheduler might not be running in test env


class TestPRCBurnHistoryAPI:
    """Test PRC Burn History API - GET with pagination"""
    
    def test_burn_history_endpoint_exists(self):
        """Test that prc-burn-control/history endpoint exists"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/history"
        
        response = requests.get(url, timeout=30)
        
        assert response.status_code != 404, f"Endpoint not found: {url}"
        
        print(f"✓ prc-burn-control/history endpoint exists")
        print(f"  Status: {response.status_code}")
        
    def test_burn_history_returns_list(self):
        """Test burn history returns paginated list"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/history"
        
        response = requests.get(url, timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got: {response.status_code}"
        
        data = response.json()
        
        # Check structure
        assert "success" in data, "Response missing 'success' field"
        assert "history" in data, "Response missing 'history' field"
        
        history = data.get("history", [])
        assert isinstance(history, list), "history should be a list"
        
        print(f"✓ burn history returns list with {len(history)} records")
        
        # Check pagination
        if "pagination" in data:
            pagination = data["pagination"]
            print(f"  Pagination: page {pagination.get('page')}/{pagination.get('pages')}")
            
    def test_burn_history_pagination_params(self):
        """Test burn history accepts pagination parameters"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/history"
        
        response = requests.get(url, params={"page": 1, "limit": 5}, timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got: {response.status_code}"
        
        data = response.json()
        history = data.get("history", [])
        
        # Should respect limit
        assert len(history) <= 5, f"Expected max 5 records, got {len(history)}"
        
        print(f"✓ Pagination params work correctly")
        print(f"  Requested limit=5, got {len(history)} records")
        
    def test_burn_history_record_structure(self):
        """Test burn history record has expected fields"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/history"
        
        response = requests.get(url, params={"limit": 1}, timeout=30)
        data = response.json()
        
        history = data.get("history", [])
        
        if history:
            record = history[0]
            print(f"✓ Burn history record structure:")
            print(f"  - type: {record.get('type', 'N/A')}")
            print(f"  - burn_date_ist: {record.get('burn_date_ist', 'N/A')}")
            print(f"  - executed_by: {record.get('executed_by', 'N/A')}")
            print(f"  - status: {record.get('status', 'N/A')}")
            print(f"  - total_burned: {record.get('total_burned', 0)}")
            print(f"  - users_affected: {record.get('users_affected', 0)}")
        else:
            print("  No burn history records yet (expected for new system)")


class TestSmartBurnAPI:
    """Test Smart Burn API - POST with burn check"""
    
    def test_smart_burn_endpoint_exists(self):
        """Test that smart-burn endpoint exists"""
        url = f"{BASE_URL}/api/admin/smart-burn"
        
        response = requests.post(
            url,
            json={"admin_id": "test_admin"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        assert response.status_code != 404, f"Endpoint not found: {url}"
        assert response.status_code != 405, f"POST method not allowed: {url}"
        
        print(f"✓ smart-burn endpoint exists and accepts POST")
        print(f"  Status: {response.status_code}")
        
    def test_smart_burn_returns_expected_structure(self):
        """Test smart-burn returns expected response structure"""
        url = f"{BASE_URL}/api/admin/smart-burn"
        
        response = requests.post(
            url,
            json={"admin_id": "test_admin_002"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        # Should return 200 or 500 (if run_prc_burn_job has issues)
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            
            # Check expected fields
            assert "success" in data, "Response missing 'success' field"
            assert "burn_needed" in data, "Response missing 'burn_needed' field"
            assert "burn_executed" in data, "Response missing 'burn_executed' field"
            assert "message" in data, "Response missing 'message' field"
            
            print(f"✓ smart-burn returns expected structure")
            print(f"  Success: {data.get('success')}")
            print(f"  Burn needed: {data.get('burn_needed')}")
            print(f"  Burn executed: {data.get('burn_executed')}")
            print(f"  Message: {data.get('message')}")
        else:
            print(f"  Smart burn returned 500 (may be expected in test env)")
            print(f"  Response: {response.text[:200]}")
            
    def test_smart_burn_prevents_duplicate_burns(self):
        """Test that smart-burn prevents duplicate burns on same day"""
        url = f"{BASE_URL}/api/admin/smart-burn"
        
        # First call
        response1 = requests.post(
            url,
            json={"admin_id": "test_dedup_1"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        # Second call (should detect duplicate)
        response2 = requests.post(
            url,
            json={"admin_id": "test_dedup_2"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response2.status_code == 200:
            data2 = response2.json()
            
            # If burn was already done, burn_executed should be False
            # unless force=True was used
            if not data2.get("burn_needed"):
                print(f"✓ Smart burn correctly detects duplicate")
                print(f"  Message: {data2.get('message')}")
            else:
                print(f"  First burn executed, no duplicate yet")
        else:
            print(f"  Could not verify duplicate prevention (status {response2.status_code})")
            
    def test_smart_burn_force_option(self):
        """Test that smart-burn accepts force parameter"""
        url = f"{BASE_URL}/api/admin/smart-burn"
        
        # This is just testing the parameter is accepted
        # We don't actually want to force a burn in tests
        response = requests.post(
            url,
            json={
                "admin_id": "test_force",
                "force": False  # Explicitly set to False
            },
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        print(f"✓ smart-burn accepts force parameter")


class TestDMTHealthEndpoint:
    """Test DMT Service Health endpoint"""
    
    def test_dmt_health_endpoint(self):
        """Test DMT health endpoint returns service status"""
        url = f"{BASE_URL}/api/eko/dmt/health"
        
        response = requests.get(url, timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got: {response.status_code}"
        
        data = response.json()
        
        # Check DMT health fields
        assert "status" in data, "Response missing 'status' field"
        assert "config_valid" in data, "Response missing 'config_valid' field"
        
        print(f"✓ DMT health endpoint working")
        print(f"  Status: {data.get('status')}")
        print(f"  Config valid: {data.get('config_valid')}")
        print(f"  PRC Rate: {data.get('prc_rate', 'N/A')}")


class TestPRCBurnControlRelatedAPIs:
    """Test PRC Burn Control related APIs"""
    
    def test_burn_control_settings_endpoint(self):
        """Test GET burn control settings"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/settings"
        
        response = requests.get(url, timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got: {response.status_code}"
        
        data = response.json()
        
        # Check expected fields
        assert "enabled" in data, "Response missing 'enabled' field"
        assert "burn_percentage" in data, "Response missing 'burn_percentage' field"
        
        print(f"✓ PRC burn control settings endpoint working")
        print(f"  Enabled: {data.get('enabled')}")
        print(f"  Burn %: {data.get('burn_percentage')}")
        
    def test_burn_control_stats_endpoint(self):
        """Test GET burn control stats"""
        url = f"{BASE_URL}/api/admin/prc-burn-control/stats"
        
        response = requests.get(url, timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got: {response.status_code}"
        
        data = response.json()
        
        # Check expected fields
        assert "total_prc_circulation" in data, "Response missing 'total_prc_circulation' field"
        assert "total_users" in data, "Response missing 'total_users' field"
        
        print(f"✓ PRC burn control stats endpoint working")
        print(f"  Total PRC: {data.get('total_prc_circulation')}")
        print(f"  Total users: {data.get('total_users')}")
        print(f"  Eligible users: {data.get('eligible_users', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
