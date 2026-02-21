"""
Test Suite for Recurring Deposit (RD) System
Tests all RD-related APIs including:
- Interest rates retrieval
- RD creation, listing, details
- Withdrawal with penalty calculation
- Admin endpoints
- Migration from Luxury Life
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test constants
TEST_USER_ID = "elite-test-user-123"
TEST_RD_ID = "RD-2026-C5201C"
TEST_NEW_USER_PREFIX = "TEST_RD_"


class TestRDInterestRates:
    """Test GET /api/rd/interest-rates endpoint"""
    
    def test_get_interest_rates_success(self):
        """Should return all interest rate tiers"""
        response = requests.get(f"{BASE_URL}/api/rd/interest-rates")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert data["success"] is True
        assert "rates" in data
        assert len(data["rates"]) == 4  # 6, 12, 24, 36 months
        
        # Verify rate values
        rates_dict = {r["tenure_months"]: r["rate"] for r in data["rates"]}
        assert rates_dict[6] == 7.5
        assert rates_dict[12] == 8.5
        assert rates_dict[24] == 9.0
        assert rates_dict[36] == 9.25
        
        # Verify additional info
        assert data["min_deposit"] == 100
        assert data["premature_penalty"] == 3.0
        assert data["auto_deduction_percent"] == 20
        
        print("✅ Interest rates API working correctly")


class TestRDListAndDetails:
    """Test RD list and details endpoints"""
    
    def test_get_user_rds_success(self):
        """Should return list of RDs for a user"""
        response = requests.get(f"{BASE_URL}/api/rd/list/{TEST_USER_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "rds" in data
        assert "summary" in data
        
        # Verify summary structure
        assert "total_rds" in data["summary"]
        assert "active_rds" in data["summary"]
        assert "total_deposited" in data["summary"]
        assert "total_interest_earned" in data["summary"]
        assert "total_current_value" in data["summary"]
        
        print(f"✅ User has {data['summary']['total_rds']} RD(s)")
        print(f"   - Total deposited: {data['summary']['total_deposited']} PRC")
    
    def test_get_user_rds_has_active_rd(self):
        """Should have at least one active RD"""
        response = requests.get(f"{BASE_URL}/api/rd/list/{TEST_USER_ID}")
        data = response.json()
        
        assert data["summary"]["active_rds"] >= 1
        
        # Verify RD structure
        if data["rds"]:
            rd = data["rds"][0]
            assert "rd_id" in rd
            assert "tenure_months" in rd
            assert "interest_rate" in rd
            assert "monthly_deposit" in rd
            assert "total_deposited" in rd
            assert "status" in rd
            assert "progress_percent" in rd
            
        print(f"✅ Active RDs: {data['summary']['active_rds']}")
    
    def test_get_rd_details_success(self):
        """Should return detailed RD info"""
        response = requests.get(f"{BASE_URL}/api/rd/details/{TEST_RD_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "rd" in data
        
        rd = data["rd"]
        
        # Verify RD details
        assert rd["rd_id"] == TEST_RD_ID
        assert rd["user_id"] == TEST_USER_ID
        assert rd["tenure_months"] == 12
        assert rd["interest_rate"] == 8.5
        
        # Verify calculated fields
        assert "current_value" in rd
        assert "days_elapsed" in rd
        assert "days_remaining" in rd
        assert "premature_withdrawal" in rd
        assert "is_mature" in rd
        
        # Verify premature withdrawal calculation
        pw = rd["premature_withdrawal"]
        assert pw["penalty_percent"] == 3.0
        assert "amount" in pw
        assert "penalty_amount" in pw
        
        print(f"✅ RD Details - Status: {rd['status']}, Value: {rd['current_value']} PRC")
        print(f"   - Premature withdrawal amount: {pw['amount']} PRC (penalty: {pw['penalty_amount']})")
    
    def test_get_rd_details_not_found(self):
        """Should return 404 for non-existent RD"""
        response = requests.get(f"{BASE_URL}/api/rd/details/RD-NONEXISTENT-123")
        
        assert response.status_code == 404
        print("✅ Correctly returns 404 for non-existent RD")
    
    def test_get_user_rds_nonexistent_user(self):
        """Should return empty list for user with no RDs"""
        response = requests.get(f"{BASE_URL}/api/rd/list/nonexistent-user-xyz")
        
        # Should return 200 with empty list, not 404
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["summary"]["total_rds"] == 0
        print("✅ Correctly returns empty list for user with no RDs")


class TestRDCreation:
    """Test RD creation endpoint"""
    
    def test_create_rd_invalid_tenure(self):
        """Should reject invalid tenure"""
        response = requests.post(f"{BASE_URL}/api/rd/create", json={
            "user_id": TEST_USER_ID,
            "monthly_deposit": 500,
            "tenure_months": 15,  # Invalid - not 6, 12, 24, or 36
            "initial_deposit": 0
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print("✅ Correctly rejects invalid tenure")
    
    def test_create_rd_insufficient_deposit(self):
        """Should reject deposit below minimum"""
        response = requests.post(f"{BASE_URL}/api/rd/create", json={
            "user_id": TEST_USER_ID,
            "monthly_deposit": 50,  # Below minimum of 100
            "tenure_months": 12,
            "initial_deposit": 0
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "100" in data["detail"]  # Should mention minimum
        print("✅ Correctly rejects deposit below minimum")
    
    def test_create_rd_user_not_found(self):
        """Should reject creation for non-existent user"""
        response = requests.post(f"{BASE_URL}/api/rd/create", json={
            "user_id": "nonexistent-user-xyz",
            "monthly_deposit": 500,
            "tenure_months": 12,
            "initial_deposit": 0
        })
        
        assert response.status_code == 404
        data = response.json()
        assert "User not found" in data["detail"]
        print("✅ Correctly rejects non-existent user")


class TestRDAdminEndpoints:
    """Test admin endpoints for RD management"""
    
    def test_admin_get_all_rds(self):
        """Admin should be able to view all RDs"""
        response = requests.get(f"{BASE_URL}/api/rd/admin/all")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "rds" in data
        assert "pagination" in data
        assert "stats" in data
        
        # Verify pagination
        assert "total" in data["pagination"]
        assert "skip" in data["pagination"]
        assert "limit" in data["pagination"]
        
        # Verify stats
        assert "total_active" in data["stats"]
        assert "total_matured" in data["stats"]
        assert "total_withdrawn" in data["stats"]
        assert "total_deposited" in data["stats"]
        
        print(f"✅ Admin view - Total RDs: {data['pagination']['total']}")
        print(f"   - Active: {data['stats']['total_active']}")
        print(f"   - Total deposited: {data['stats']['total_deposited']} PRC")
    
    def test_admin_get_all_rds_with_status_filter(self):
        """Admin should be able to filter by status"""
        response = requests.get(f"{BASE_URL}/api/rd/admin/all?status=active")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned RDs should be active
        for rd in data["rds"]:
            assert rd["status"] == "active"
        
        print(f"✅ Status filter working - Found {len(data['rds'])} active RDs")
    
    def test_admin_process_daily_interest(self):
        """Admin should be able to process daily interest"""
        response = requests.post(f"{BASE_URL}/api/rd/admin/process-daily-interest")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "processed" in data
        assert "errors" in data
        
        print(f"✅ Daily interest processed - {data['processed']} RDs, {data['errors']} errors")
    
    def test_admin_check_matured_rds(self):
        """Admin should be able to check for matured RDs"""
        response = requests.post(f"{BASE_URL}/api/rd/admin/check-matured")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "matured_count" in data
        
        print(f"✅ Matured RDs check - Found {data['matured_count']} newly matured")


class TestRDDeposit:
    """Test deposit to RD endpoint"""
    
    def test_deposit_to_rd_success(self):
        """Should successfully deposit to active RD"""
        response = requests.post(f"{BASE_URL}/api/rd/deposit/{TEST_RD_ID}", json={
            "user_id": TEST_USER_ID,
            "amount": 100,
            "source": "manual"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "new_balance" in data
        assert "expected_maturity" in data
        
        print(f"✅ Deposit successful - New balance: {data['new_balance']} PRC")
    
    def test_deposit_to_rd_invalid_amount(self):
        """Should reject invalid deposit amount"""
        response = requests.post(f"{BASE_URL}/api/rd/deposit/{TEST_RD_ID}", json={
            "user_id": TEST_USER_ID,
            "amount": 0,  # Invalid
            "source": "manual"
        })
        
        assert response.status_code == 400
        print("✅ Correctly rejects invalid deposit amount")
    
    def test_deposit_to_rd_not_found(self):
        """Should reject deposit to non-existent RD"""
        response = requests.post(f"{BASE_URL}/api/rd/deposit/RD-NONEXISTENT-123", json={
            "user_id": TEST_USER_ID,
            "amount": 100,
            "source": "manual"
        })
        
        assert response.status_code == 404
        print("✅ Correctly returns 404 for non-existent RD")
    
    def test_deposit_unauthorized_user(self):
        """Should reject deposit from unauthorized user"""
        response = requests.post(f"{BASE_URL}/api/rd/deposit/{TEST_RD_ID}", json={
            "user_id": "another-user-xyz",
            "amount": 100,
            "source": "manual"
        })
        
        assert response.status_code == 403
        print("✅ Correctly rejects unauthorized deposit")


class TestRDWithdrawal:
    """Test RD withdrawal endpoint (premature withdrawal)"""
    
    def test_withdraw_rd_unauthorized(self):
        """Should reject withdrawal from unauthorized user"""
        response = requests.post(f"{BASE_URL}/api/rd/withdraw/{TEST_RD_ID}", json={
            "user_id": "unauthorized-user-xyz",
            "reason": "Test"
        })
        
        assert response.status_code == 403
        print("✅ Correctly rejects unauthorized withdrawal")
    
    def test_withdraw_nonexistent_rd(self):
        """Should return 404 for non-existent RD"""
        response = requests.post(f"{BASE_URL}/api/rd/withdraw/RD-NONEXISTENT-123", json={
            "user_id": TEST_USER_ID,
            "reason": "Test"
        })
        
        assert response.status_code == 404
        print("✅ Correctly returns 404 for non-existent RD")


class TestRDMigration:
    """Test Luxury Life to RD migration endpoint"""
    
    def test_migrate_user_not_found(self):
        """Should reject migration for non-existent user"""
        response = requests.post(f"{BASE_URL}/api/rd/migrate-from-luxury/nonexistent-user-xyz")
        
        assert response.status_code == 404
        print("✅ Correctly returns 404 for non-existent user migration")


class TestRDToggleAutoDeduction:
    """Test auto-deduction toggle endpoint"""
    
    def test_toggle_auto_deduction_success(self):
        """Should toggle auto-deduction setting"""
        # Enable
        response = requests.post(
            f"{BASE_URL}/api/rd/toggle-auto-deduction/{TEST_RD_ID}",
            params={"user_id": TEST_USER_ID, "enabled": "true"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["auto_deduction_enabled"] is True
        
        print("✅ Auto-deduction toggle working")
    
    def test_toggle_auto_deduction_unauthorized(self):
        """Should reject toggle from unauthorized user"""
        response = requests.post(
            f"{BASE_URL}/api/rd/toggle-auto-deduction/{TEST_RD_ID}",
            params={"user_id": "unauthorized-user", "enabled": "true"}
        )
        
        assert response.status_code == 403
        print("✅ Correctly rejects unauthorized toggle")


# Summary test to verify overall RD system health
class TestRDSystemHealth:
    """Overall system health tests"""
    
    def test_rd_system_health(self):
        """Verify RD system is functioning properly"""
        # 1. Interest rates available
        rates_response = requests.get(f"{BASE_URL}/api/rd/interest-rates")
        assert rates_response.status_code == 200
        
        # 2. User list works
        list_response = requests.get(f"{BASE_URL}/api/rd/list/{TEST_USER_ID}")
        assert list_response.status_code == 200
        
        # 3. Details work
        details_response = requests.get(f"{BASE_URL}/api/rd/details/{TEST_RD_ID}")
        assert details_response.status_code == 200
        
        # 4. Admin view works
        admin_response = requests.get(f"{BASE_URL}/api/rd/admin/all")
        assert admin_response.status_code == 200
        
        print("✅ RD System Health Check PASSED")
        print("   - Interest rates: OK")
        print("   - User RD list: OK")
        print("   - RD details: OK")
        print("   - Admin view: OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
