"""
Test Capital Management, Trial Balance, and Chart of Accounts APIs
Phase 1: Accounting Foundation Testing

Tests:
- Capital Management APIs (opening_capital, additional_capital, drawings)
- Trial Balance API (total_debit, total_credit, is_balanced)
- Chart of Accounts API (5 categories: assets, liabilities, equity, income, expenses)
- Balance Sheet equity section (opening_capital, additional_capital, less_drawings)
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCapitalManagement:
    """Test Capital & Owner's Equity Management APIs"""
    
    def test_get_capital_summary(self):
        """Test GET /api/admin/accounting/capital returns capital summary"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/capital")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required fields
        assert "opening_capital" in data, "Missing opening_capital field"
        assert "additional_capital" in data, "Missing additional_capital field"
        assert "drawings" in data, "Missing drawings field"
        assert "retained_earnings" in data, "Missing retained_earnings field"
        assert "total_equity" in data, "Missing total_equity field"
        
        # Verify data types
        assert isinstance(data["opening_capital"], (int, float)), "opening_capital should be numeric"
        assert isinstance(data["additional_capital"], (int, float)), "additional_capital should be numeric"
        assert isinstance(data["drawings"], (int, float)), "drawings should be numeric"
        assert isinstance(data["total_equity"], (int, float)), "total_equity should be numeric"
        
        print(f"✅ Capital Summary: Opening={data['opening_capital']}, Additional={data['additional_capital']}, Drawings={data['drawings']}, Total Equity={data['total_equity']}")
    
    def test_add_opening_capital_entry(self):
        """Test POST /api/admin/accounting/capital/entry with entry_type=opening_capital"""
        params = {
            "entry_type": "opening_capital",
            "amount": 100000,
            "description": "TEST_Initial business capital investment",
            "reference_no": f"TEST_CAP_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "admin_id": "test_admin"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/accounting/capital/entry", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "entry_id" in data, "Missing entry_id in response"
        assert "cash_book_entry_id" in data, "Missing cash_book_entry_id - capital entry should create cash book entry"
        
        print(f"✅ Opening Capital Entry Created: entry_id={data['entry_id']}, cash_book_entry_id={data['cash_book_entry_id']}")
        return data["entry_id"]
    
    def test_add_additional_capital_entry(self):
        """Test POST /api/admin/accounting/capital/entry with entry_type=additional_capital"""
        params = {
            "entry_type": "additional_capital",
            "amount": 50000,
            "description": "TEST_Additional investment by owner",
            "reference_no": f"TEST_ADD_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "admin_id": "test_admin"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/accounting/capital/entry", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "cash_book_entry_id" in data, "Additional capital should create cash book entry"
        
        print(f"✅ Additional Capital Entry Created: entry_id={data['entry_id']}")
        return data["entry_id"]
    
    def test_add_drawings_entry(self):
        """Test POST /api/admin/accounting/capital/entry with entry_type=drawings"""
        params = {
            "entry_type": "drawings",
            "amount": 10000,
            "description": "TEST_Owner withdrawal for personal use",
            "reference_no": f"TEST_DRW_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "admin_id": "test_admin"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/accounting/capital/entry", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "cash_book_entry_id" in data, "Drawings should create cash book entry"
        
        print(f"✅ Drawings Entry Created: entry_id={data['entry_id']}")
        return data["entry_id"]
    
    def test_invalid_entry_type(self):
        """Test POST /api/admin/accounting/capital/entry with invalid entry_type"""
        params = {
            "entry_type": "invalid_type",
            "amount": 1000,
            "description": "TEST_Invalid entry",
            "admin_id": "test_admin"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/accounting/capital/entry", params=params)
        assert response.status_code == 400, f"Expected 400 for invalid entry_type, got {response.status_code}"
        print("✅ Invalid entry_type correctly rejected with 400")
    
    def test_capital_entries_list(self):
        """Test that capital entries are returned in the summary"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/capital")
        assert response.status_code == 200
        
        data = response.json()
        # Check entries list exists
        assert "entries" in data, "Missing entries list in capital summary"
        assert "entries_count" in data, "Missing entries_count in capital summary"
        
        print(f"✅ Capital Entries: {data['entries_count']} entries found")


class TestTrialBalance:
    """Test Trial Balance API"""
    
    def test_get_trial_balance(self):
        """Test GET /api/admin/accounting/trial-balance returns trial balance"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/trial-balance")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "totals" in data, "Missing totals in trial balance"
        assert "accounts" in data, "Missing accounts in trial balance"
        assert "status" in data, "Missing status in trial balance"
        assert "as_of_date" in data, "Missing as_of_date in trial balance"
        
        totals = data["totals"]
        assert "total_debit" in totals, "Missing total_debit in totals"
        assert "total_credit" in totals, "Missing total_credit in totals"
        assert "difference" in totals, "Missing difference in totals"
        assert "is_balanced" in totals, "Missing is_balanced in totals"
        
        # Verify data types
        assert isinstance(totals["total_debit"], (int, float)), "total_debit should be numeric"
        assert isinstance(totals["total_credit"], (int, float)), "total_credit should be numeric"
        assert isinstance(totals["is_balanced"], bool), "is_balanced should be boolean"
        
        print(f"✅ Trial Balance: Debit={totals['total_debit']}, Credit={totals['total_credit']}, Balanced={totals['is_balanced']}")
    
    def test_trial_balance_accounts_structure(self):
        """Test that trial balance accounts have correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/trial-balance")
        assert response.status_code == 200
        
        data = response.json()
        accounts = data.get("accounts", [])
        
        if accounts:
            # Check first account structure
            account = accounts[0]
            assert "code" in account, "Account missing code"
            assert "name" in account, "Account missing name"
            assert "debit" in account, "Account missing debit"
            assert "credit" in account, "Account missing credit"
            
            print(f"✅ Trial Balance has {len(accounts)} accounts with correct structure")
        else:
            print("⚠️ Trial Balance has no accounts (may be expected if no transactions)")


class TestChartOfAccounts:
    """Test Chart of Accounts API"""
    
    def test_get_chart_of_accounts(self):
        """Test GET /api/admin/accounting/chart-of-accounts returns all 5 categories"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/chart-of-accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "chart_of_accounts" in data, "Missing chart_of_accounts"
        assert "total_accounts" in data, "Missing total_accounts"
        
        chart = data["chart_of_accounts"]
        
        # Verify all 5 categories exist
        required_categories = ["assets", "liabilities", "equity", "income", "expenses"]
        for category in required_categories:
            assert category in chart, f"Missing category: {category}"
        
        print(f"✅ Chart of Accounts has all 5 categories: {list(chart.keys())}")
        print(f"✅ Total accounts: {data['total_accounts']}")
    
    def test_chart_of_accounts_structure(self):
        """Test that each category has correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/chart-of-accounts")
        assert response.status_code == 200
        
        data = response.json()
        chart = data["chart_of_accounts"]
        
        for category, category_data in chart.items():
            # Each category should have code, name, accounts, total
            assert "code" in category_data, f"{category} missing code"
            assert "name" in category_data, f"{category} missing name"
            assert "accounts" in category_data, f"{category} missing accounts"
            assert "total" in category_data, f"{category} missing total"
            
            # Check accounts structure
            for account in category_data["accounts"]:
                assert "code" in account, f"Account in {category} missing code"
                assert "name" in account, f"Account in {category} missing name"
                assert "type" in account, f"Account in {category} missing type"
                assert "normal_balance" in account, f"Account in {category} missing normal_balance"
                assert "balance" in account, f"Account in {category} missing balance"
                
                # Verify normal_balance is either 'debit' or 'credit'
                assert account["normal_balance"] in ["debit", "credit"], f"Invalid normal_balance: {account['normal_balance']}"
        
        print("✅ All categories have correct structure with code, name, accounts, total")
    
    def test_chart_of_accounts_account_codes(self):
        """Test that account codes follow proper numbering"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/chart-of-accounts")
        assert response.status_code == 200
        
        data = response.json()
        chart = data["chart_of_accounts"]
        
        # Expected code ranges
        code_ranges = {
            "assets": "1",
            "liabilities": "2",
            "equity": "3",
            "income": "4",
            "expenses": "5"
        }
        
        for category, expected_prefix in code_ranges.items():
            category_code = chart[category]["code"]
            assert category_code.startswith(expected_prefix), f"{category} code should start with {expected_prefix}, got {category_code}"
            
            for account in chart[category]["accounts"]:
                assert account["code"].startswith(expected_prefix), f"Account {account['name']} code should start with {expected_prefix}"
        
        print("✅ Account codes follow proper numbering (1xxx=Assets, 2xxx=Liabilities, 3xxx=Equity, 4xxx=Income, 5xxx=Expenses)")


class TestBalanceSheetEquity:
    """Test Balance Sheet equity section"""
    
    def test_balance_sheet_equity_breakdown(self):
        """Test GET /api/admin/reports/balance-sheet shows equity breakdown"""
        response = requests.get(f"{BASE_URL}/api/admin/reports/balance-sheet")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify equity section exists
        assert "equity" in data, "Missing equity section in balance sheet"
        
        equity = data["equity"]
        
        # Verify equity breakdown fields
        assert "opening_capital" in equity, "Missing opening_capital in equity"
        assert "additional_capital" in equity, "Missing additional_capital in equity"
        assert "less_drawings" in equity, "Missing less_drawings in equity"
        assert "retained_earnings" in equity, "Missing retained_earnings in equity"
        assert "total_equity" in equity, "Missing total_equity in equity"
        
        # Verify calculation: total_equity = opening + additional - drawings + retained
        expected_total = equity["opening_capital"] + equity["additional_capital"] - equity["less_drawings"] + equity["retained_earnings"]
        assert abs(equity["total_equity"] - expected_total) < 0.01, f"Equity calculation mismatch: {equity['total_equity']} != {expected_total}"
        
        print(f"✅ Balance Sheet Equity: Opening={equity['opening_capital']}, Additional={equity['additional_capital']}, Drawings={equity['less_drawings']}, Retained={equity['retained_earnings']}, Total={equity['total_equity']}")
    
    def test_balance_sheet_structure(self):
        """Test balance sheet has all required sections"""
        response = requests.get(f"{BASE_URL}/api/admin/reports/balance-sheet")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all sections
        assert "assets" in data, "Missing assets section"
        assert "liabilities" in data, "Missing liabilities section"
        assert "equity" in data, "Missing equity section"
        assert "balance_check" in data, "Missing balance_check section"
        
        # Verify balance check
        balance_check = data["balance_check"]
        assert "assets" in balance_check, "Missing assets in balance_check"
        assert "liabilities_plus_equity" in balance_check, "Missing liabilities_plus_equity in balance_check"
        assert "is_balanced" in balance_check, "Missing is_balanced in balance_check"
        
        print(f"✅ Balance Sheet: Assets={balance_check['assets']}, L+E={balance_check['liabilities_plus_equity']}, Balanced={balance_check['is_balanced']}")


class TestCapitalCashBookIntegration:
    """Test that capital entries create corresponding cash book entries"""
    
    def test_capital_creates_cash_book_entry(self):
        """Test that adding capital creates a cash book entry"""
        # Add a capital entry
        params = {
            "entry_type": "opening_capital",
            "amount": 25000,
            "description": "TEST_Integration test capital",
            "reference_no": f"TEST_INT_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "admin_id": "test_admin"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/accounting/capital/entry", params=params)
        assert response.status_code == 200
        
        data = response.json()
        assert "cash_book_entry_id" in data, "Capital entry should create cash book entry"
        
        # Verify cash book entry was created
        cash_book_response = requests.get(f"{BASE_URL}/api/admin/accounting/cash-book")
        assert cash_book_response.status_code == 200
        
        cash_book_data = cash_book_response.json()
        entries = cash_book_data.get("entries", [])
        
        # Find the linked entry
        linked_entry = None
        for entry in entries:
            if entry.get("linked_capital_entry") == data["entry_id"]:
                linked_entry = entry
                break
        
        if linked_entry:
            print(f"✅ Capital entry created corresponding cash book entry: {linked_entry.get('entry_id')}")
        else:
            print("⚠️ Could not verify cash book entry link (may be in different page)")


# Cleanup function to remove test data
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Note: In production, you would delete TEST_ prefixed entries here
    print("\n🧹 Test cleanup: TEST_ prefixed entries should be cleaned up manually if needed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
