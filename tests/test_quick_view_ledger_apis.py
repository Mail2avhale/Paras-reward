"""
Test Quick View Ledger APIs for Admin Accounting Dashboard
Tests the new ledger endpoints used by Quick View mode:
- /api/admin/ledger/master-summary
- /api/admin/ledger/cash
- /api/admin/ledger/bank
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bugfix-rewards-hub.preview.emergentagent.com').rstrip('/')


class TestMasterSummaryAPI:
    """Tests for /api/admin/ledger/master-summary endpoint"""
    
    def test_master_summary_endpoint_exists(self):
        """Test that master-summary endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Master summary endpoint returns 200")
    
    def test_master_summary_response_structure(self):
        """Test that response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        data = response.json()
        
        # Check top-level keys
        assert "income" in data, "Missing 'income' key"
        assert "expense" in data, "Missing 'expense' key"
        assert "net_profit_loss" in data, "Missing 'net_profit_loss' key"
        assert "prc_stats" in data, "Missing 'prc_stats' key"
        print("✓ Master summary has correct top-level structure")
    
    def test_master_summary_income_breakdown(self):
        """Test income breakdown structure"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        data = response.json()
        
        income = data.get("income", {})
        required_income_fields = ["ad_revenue", "subscription", "commission", "interest", "penalty_forfeit", "total"]
        
        for field in required_income_fields:
            assert field in income, f"Missing income field: {field}"
            assert isinstance(income[field], (int, float)), f"Income {field} should be numeric"
        print("✓ Income breakdown has all 5 categories + total")
    
    def test_master_summary_expense_breakdown(self):
        """Test expense breakdown structure"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        data = response.json()
        
        expense = data.get("expense", {})
        required_expense_fields = ["operational", "redeem_payouts", "total"]
        
        for field in required_expense_fields:
            assert field in expense, f"Missing expense field: {field}"
            assert isinstance(expense[field], (int, float)), f"Expense {field} should be numeric"
        print("✓ Expense breakdown has 2 categories + total")
    
    def test_master_summary_prc_stats(self):
        """Test PRC statistics structure"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        data = response.json()
        
        prc_stats = data.get("prc_stats", {})
        required_prc_fields = ["total_in_system", "inr_liability", "conversion_rate"]
        
        for field in required_prc_fields:
            assert field in prc_stats, f"Missing prc_stats field: {field}"
            assert isinstance(prc_stats[field], (int, float)), f"PRC stats {field} should be numeric"
        print("✓ PRC stats has all 3 metrics")
    
    def test_master_summary_net_pl_calculation(self):
        """Test that net P&L = income.total - expense.total"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/master-summary")
        data = response.json()
        
        income_total = data.get("income", {}).get("total", 0)
        expense_total = data.get("expense", {}).get("total", 0)
        net_pl = data.get("net_profit_loss", 0)
        
        expected_net = round(income_total - expense_total, 2)
        assert net_pl == expected_net, f"Net P&L mismatch: expected {expected_net}, got {net_pl}"
        print(f"✓ Net P&L calculation correct: {income_total} - {expense_total} = {net_pl}")


class TestCashLedgerAPI:
    """Tests for /api/admin/ledger/cash endpoint"""
    
    def test_cash_ledger_endpoint_exists(self):
        """Test that cash ledger endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/cash")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Cash ledger endpoint returns 200")
    
    def test_cash_ledger_response_structure(self):
        """Test cash ledger response structure"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/cash")
        data = response.json()
        
        assert "entries" in data, "Missing 'entries' key"
        assert "total" in data, "Missing 'total' key"
        assert "current_balance" in data, "Missing 'current_balance' key"
        assert "page" in data, "Missing 'page' key"
        
        assert isinstance(data["entries"], list), "entries should be a list"
        assert isinstance(data["current_balance"], (int, float)), "current_balance should be numeric"
        print("✓ Cash ledger has correct response structure")
    
    def test_cash_ledger_pagination(self):
        """Test cash ledger pagination parameters"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/cash?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        print("✓ Cash ledger pagination works")


class TestBankLedgerAPI:
    """Tests for /api/admin/ledger/bank endpoint"""
    
    def test_bank_ledger_endpoint_exists(self):
        """Test that bank ledger endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/bank")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Bank ledger endpoint returns 200")
    
    def test_bank_ledger_response_structure(self):
        """Test bank ledger response structure"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/bank")
        data = response.json()
        
        assert "entries" in data, "Missing 'entries' key"
        assert "total" in data, "Missing 'total' key"
        assert "current_balance" in data, "Missing 'current_balance' key"
        assert "page" in data, "Missing 'page' key"
        
        assert isinstance(data["entries"], list), "entries should be a list"
        assert isinstance(data["current_balance"], (int, float)), "current_balance should be numeric"
        print("✓ Bank ledger has correct response structure")
    
    def test_bank_ledger_pagination(self):
        """Test bank ledger pagination parameters"""
        response = requests.get(f"{BASE_URL}/api/admin/ledger/bank?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        print("✓ Bank ledger pagination works")


class TestAdminAccountingDashboardAPIs:
    """Tests for existing accounting dashboard APIs used by detailed view"""
    
    def test_master_dashboard_endpoint(self):
        """Test master dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/master-dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Master dashboard endpoint returns 200")
    
    def test_accounting_settings_endpoint(self):
        """Test accounting settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Accounting settings endpoint returns 200")
    
    def test_conversion_rate_endpoint(self):
        """Test conversion rate endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/conversion-rate")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Conversion rate endpoint returns 200")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
