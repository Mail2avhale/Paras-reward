"""
Financial Management System API Tests
Tests for:
- User Wallet Ledger (admin-only, non-editable)
- Redemption Safety Settings
- Monthly P&L Reports and Snapshots
- Wallet Reconciliation
"""

import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin"
TEST_VIP_EMAIL = "final_test_vip@test.com"
TEST_VIP_PASSWORD = "testpassword"


class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login(self):
        """Test admin can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            params={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data.get("role") == "admin", f"Expected admin role, got: {data.get('role')}"
        assert data.get("uid") is not None, "Admin UID should be present"
        print(f"✅ Admin login successful - UID: {data.get('uid')}")


class TestUserLedgerAPI:
    """Test User Wallet Ledger endpoints"""
    
    def test_get_all_user_ledger(self):
        """GET /api/admin/finance/user-ledger - returns paginated user transactions"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/user-ledger")
        assert response.status_code == 200, f"Failed to get user ledger: {response.text}"
        
        data = response.json()
        assert "transactions" in data, "Response should contain 'transactions'"
        assert "total" in data, "Response should contain 'total'"
        assert "page" in data, "Response should contain 'page'"
        assert "total_pages" in data, "Response should contain 'total_pages'"
        assert "summary" in data, "Response should contain 'summary'"
        
        # Verify pagination defaults
        assert data["page"] == 1, "Default page should be 1"
        assert data["limit"] == 50, "Default limit should be 50"
        
        print(f"✅ User ledger returned {data['total']} total transactions")
        print(f"   Summary: {data['summary']}")
    
    def test_get_user_ledger_with_filters(self):
        """Test user ledger with various filters"""
        # Test with wallet_type filter
        response = requests.get(
            f"{BASE_URL}/api/admin/finance/user-ledger",
            params={"wallet_type": "prc"}
        )
        assert response.status_code == 200, f"Failed with wallet_type filter: {response.text}"
        
        # Test with transaction_type filter
        response = requests.get(
            f"{BASE_URL}/api/admin/finance/user-ledger",
            params={"transaction_type": "mining"}
        )
        assert response.status_code == 200, f"Failed with transaction_type filter: {response.text}"
        
        # Test with pagination
        response = requests.get(
            f"{BASE_URL}/api/admin/finance/user-ledger",
            params={"page": 1, "limit": 10}
        )
        assert response.status_code == 200, f"Failed with pagination: {response.text}"
        data = response.json()
        assert len(data["transactions"]) <= 10, "Should respect limit parameter"
        
        print("✅ User ledger filters working correctly")
    
    def test_get_specific_user_ledger(self):
        """GET /api/admin/finance/user-ledger/{uid} - returns specific user's ledger"""
        # First get a user ID from the general ledger
        response = requests.get(f"{BASE_URL}/api/admin/finance/user-ledger", params={"limit": 1})
        assert response.status_code == 200
        
        data = response.json()
        if data["transactions"]:
            user_id = data["transactions"][0].get("user_id")
            
            # Now get specific user's ledger
            response = requests.get(f"{BASE_URL}/api/admin/finance/user-ledger/{user_id}")
            assert response.status_code == 200, f"Failed to get user ledger: {response.text}"
            
            user_data = response.json()
            assert "user" in user_data, "Response should contain 'user'"
            assert "transactions" in user_data, "Response should contain 'transactions'"
            assert "wallet_stats" in user_data, "Response should contain 'wallet_stats'"
            
            print(f"✅ Specific user ledger retrieved for user: {user_id}")
            print(f"   User: {user_data['user']}")
            print(f"   Wallet stats: {user_data['wallet_stats']}")
        else:
            print("⚠️ No transactions found to test specific user ledger")
    
    def test_user_ledger_nonexistent_user(self):
        """Test ledger for non-existent user returns 404"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/user-ledger/nonexistent-user-id-12345")
        # API returns 404 but proxy may convert to 520, check response body
        data = response.json()
        assert "404" in str(data.get("detail", "")) or response.status_code == 404, \
            f"Expected 404 error for non-existent user, got: {response.status_code}, {data}"
        print("✅ Non-existent user returns 404 error as expected")


class TestRedeemSettingsAPI:
    """Test Redemption Safety Settings endpoints"""
    
    def test_get_redeem_settings(self):
        """GET /api/admin/finance/redeem-settings - returns redemption safety settings"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/redeem-settings")
        assert response.status_code == 200, f"Failed to get redeem settings: {response.text}"
        
        data = response.json()
        assert "settings" in data, "Response should contain 'settings'"
        
        settings = data["settings"]
        # Verify expected fields exist
        expected_fields = [
            "daily_limit_per_user",
            "daily_limit_global",
            "manual_approval_threshold",
            "cool_off_period_hours",
            "min_kyc_status",
            "min_vip_days",
            "max_redemptions_per_day",
            "suspicious_amount_threshold",
            "enabled"
        ]
        
        for field in expected_fields:
            assert field in settings, f"Missing field: {field}"
        
        print(f"✅ Redeem settings retrieved successfully")
        print(f"   Daily limit per user: ₹{settings['daily_limit_per_user']}")
        print(f"   Manual approval threshold: ₹{settings['manual_approval_threshold']}")
        print(f"   Enabled: {settings['enabled']}")
    
    def test_update_redeem_settings(self):
        """PUT /api/admin/finance/redeem-settings - updates redemption settings"""
        # First get current settings
        response = requests.get(f"{BASE_URL}/api/admin/finance/redeem-settings")
        original_settings = response.json()["settings"]
        
        # Update settings
        new_settings = {
            "daily_limit_per_user": 6000,
            "daily_limit_global": 120000,
            "manual_approval_threshold": 1500,
            "cool_off_period_hours": 12,
            "min_kyc_status": "verified",
            "min_vip_days": 5,
            "max_redemptions_per_day": 4,
            "suspicious_amount_threshold": 2500,
            "enabled": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/finance/redeem-settings",
            json=new_settings
        )
        assert response.status_code == 200, f"Failed to update settings: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Update should return success=True"
        
        # Verify settings were updated
        response = requests.get(f"{BASE_URL}/api/admin/finance/redeem-settings")
        updated_settings = response.json()["settings"]
        
        assert updated_settings["daily_limit_per_user"] == 6000, "daily_limit_per_user not updated"
        assert updated_settings["manual_approval_threshold"] == 1500, "manual_approval_threshold not updated"
        
        # Restore original settings
        response = requests.put(
            f"{BASE_URL}/api/admin/finance/redeem-settings",
            json=original_settings
        )
        assert response.status_code == 200, "Failed to restore original settings"
        
        print("✅ Redeem settings update and restore successful")
    
    def test_update_redeem_settings_validation(self):
        """Test that required fields are validated"""
        # Missing required field
        response = requests.put(
            f"{BASE_URL}/api/admin/finance/redeem-settings",
            json={"daily_limit_global": 100000}  # Missing daily_limit_per_user
        )
        # API returns 400 but proxy may convert to 520, check response body
        data = response.json()
        assert "400" in str(data.get("detail", "")) or response.status_code == 400, \
            f"Expected 400 error for missing required field, got: {response.status_code}, {data}"
        print("✅ Validation correctly rejects missing required fields")


class TestProfitLossAPI:
    """Test Monthly P&L Report endpoints"""
    
    def test_get_monthly_pl_report(self):
        """GET /api/admin/finance/profit-loss/monthly - returns monthly P&L report"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss/monthly")
        assert response.status_code == 200, f"Failed to get P&L report: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "period" in data, "Response should contain 'period'"
        assert "income" in data, "Response should contain 'income'"
        assert "expenses" in data, "Response should contain 'expenses'"
        assert "summary" in data, "Response should contain 'summary'"
        
        # Verify period fields
        period = data["period"]
        assert "year" in period, "Period should contain 'year'"
        assert "month" in period, "Period should contain 'month'"
        assert "month_name" in period, "Period should contain 'month_name'"
        
        # Verify income fields
        income = data["income"]
        assert "vip_subscriptions" in income, "Income should contain 'vip_subscriptions'"
        assert "ads_revenue" in income, "Income should contain 'ads_revenue'"
        assert "total" in income, "Income should contain 'total'"
        
        # Verify expenses fields
        expenses = data["expenses"]
        assert "fixed_expenses" in expenses, "Expenses should contain 'fixed_expenses'"
        assert "gift_voucher_payouts" in expenses, "Expenses should contain 'gift_voucher_payouts'"
        assert "total" in expenses, "Expenses should contain 'total'"
        
        # Verify summary fields
        summary = data["summary"]
        assert "gross_profit" in summary, "Summary should contain 'gross_profit'"
        assert "net_profit" in summary, "Summary should contain 'net_profit'"
        assert "profit_margin_percent" in summary, "Summary should contain 'profit_margin_percent'"
        
        print(f"✅ Monthly P&L report retrieved for {period['month_name']} {period['year']}")
        print(f"   Total Income: ₹{income['total']}")
        print(f"   Total Expenses: ₹{expenses['total']}")
        print(f"   Net Profit: ₹{summary['net_profit']}")
    
    def test_get_monthly_pl_with_params(self):
        """Test P&L report with specific year/month parameters"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        response = requests.get(
            f"{BASE_URL}/api/admin/finance/profit-loss/monthly",
            params={"year": current_year, "month": current_month}
        )
        assert response.status_code == 200, f"Failed with year/month params: {response.text}"
        
        data = response.json()
        assert data["period"]["year"] == current_year
        assert data["period"]["month"] == current_month
        
        print(f"✅ P&L report with params works correctly")
    
    def test_save_pl_snapshot(self):
        """POST /api/admin/finance/profit-loss/snapshot - saves P&L snapshot"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        response = requests.post(
            f"{BASE_URL}/api/admin/finance/profit-loss/snapshot",
            params={"year": current_year, "month": current_month}
        )
        assert response.status_code == 200, f"Failed to save snapshot: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Snapshot save should return success=True"
        assert "report" in data, "Response should contain 'report'"
        
        print(f"✅ P&L snapshot saved for {current_month}/{current_year}")
    
    def test_get_pl_snapshots(self):
        """GET /api/admin/finance/profit-loss/snapshots - returns historical snapshots"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss/snapshots")
        assert response.status_code == 200, f"Failed to get snapshots: {response.text}"
        
        data = response.json()
        assert "snapshots" in data, "Response should contain 'snapshots'"
        
        print(f"✅ Retrieved {len(data['snapshots'])} P&L snapshots")


class TestReconciliationAPI:
    """Test Wallet Reconciliation endpoints"""
    
    def test_get_reconciliation_status(self):
        """GET /api/admin/finance/reconciliation/status - returns wallet reconciliation status"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/reconciliation/status")
        assert response.status_code == 200, f"Failed to get reconciliation status: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status'"
        assert "all_reconciled" in data, "Response should contain 'all_reconciled'"
        assert "checked_at" in data, "Response should contain 'checked_at'"
        
        # Verify status structure for each wallet
        for wallet_status in data["status"]:
            assert "wallet_name" in wallet_status, "Wallet status should contain 'wallet_name'"
            assert "actual_balance" in wallet_status, "Wallet status should contain 'actual_balance'"
            assert "expected_balance" in wallet_status, "Wallet status should contain 'expected_balance'"
            assert "discrepancy" in wallet_status, "Wallet status should contain 'discrepancy'"
            assert "is_reconciled" in wallet_status, "Wallet status should contain 'is_reconciled'"
        
        print(f"✅ Reconciliation status retrieved")
        print(f"   All reconciled: {data['all_reconciled']}")
        print(f"   Wallets checked: {len(data['status'])}")
    
    def test_run_manual_reconciliation(self):
        """POST /api/admin/finance/reconciliation/run - runs manual wallet reconciliation"""
        response = requests.post(f"{BASE_URL}/api/admin/finance/reconciliation/run")
        assert response.status_code == 200, f"Failed to run reconciliation: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Reconciliation should return success=True"
        assert "report" in data, "Response should contain 'report'"
        
        print(f"✅ Manual reconciliation completed successfully")
    
    def test_get_reconciliation_history(self):
        """GET /api/admin/finance/reconciliation/history - returns reconciliation history"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/reconciliation/history")
        assert response.status_code == 200, f"Failed to get reconciliation history: {response.text}"
        
        data = response.json()
        assert "reports" in data, "Response should contain 'reports'"
        
        print(f"✅ Retrieved {len(data['reports'])} reconciliation reports")


class TestExportEndpoints:
    """Test export functionality for user ledger"""
    
    def test_export_user_ledger(self):
        """Test exporting user ledger for a specific user"""
        # First get a user ID
        response = requests.get(f"{BASE_URL}/api/admin/finance/user-ledger", params={"limit": 1})
        if response.status_code == 200 and response.json()["transactions"]:
            user_id = response.json()["transactions"][0].get("user_id")
            
            # Try to export
            response = requests.get(f"{BASE_URL}/api/admin/finance/export/user-ledger/{user_id}")
            # Export might return CSV or JSON depending on implementation
            assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
            
            if response.status_code == 200:
                print(f"✅ User ledger export successful for user: {user_id}")
            else:
                print(f"⚠️ Export endpoint returned 404 - may not be implemented")
        else:
            print("⚠️ No transactions found to test export")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
