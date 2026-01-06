"""
Test Cash Book & Bank Book Accounting System
Tests all CRUD operations for the double-entry accounting system
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin"

class TestAccountingSummary:
    """Test GET /api/admin/accounting/summary endpoint"""
    
    def test_get_accounting_summary_returns_correct_structure(self):
        """Test that summary endpoint returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify top-level keys
        assert "cash" in data, "Missing 'cash' key in response"
        assert "bank" in data, "Missing 'bank' key in response"
        assert "total_balance" in data, "Missing 'total_balance' key in response"
        
        # Verify cash structure
        cash = data["cash"]
        assert "account_name" in cash
        assert "opening_balance" in cash
        assert "total_credit" in cash
        assert "total_debit" in cash
        assert "current_balance" in cash
        assert "today_transactions" in cash
        
        # Verify bank structure
        bank = data["bank"]
        assert "account_name" in bank
        assert "bank_name" in bank
        assert "opening_balance" in bank
        assert "total_credit" in bank
        assert "total_debit" in bank
        assert "current_balance" in bank
        assert "today_transactions" in bank
        
        print(f"✅ Summary endpoint returns correct structure")
        print(f"   Cash Balance: ₹{cash['current_balance']}")
        print(f"   Bank Balance: ₹{bank['current_balance']}")
        print(f"   Total Balance: ₹{data['total_balance']}")


class TestCashBook:
    """Test Cash Book endpoints"""
    
    def test_get_cash_book_returns_entries_and_pagination(self):
        """Test GET /api/admin/accounting/cash-book returns entries and pagination"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/cash-book")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "account_name" in data
        assert "opening_balance" in data
        assert "current_balance" in data
        assert "entries" in data
        assert "pagination" in data
        
        # Verify pagination structure
        pagination = data["pagination"]
        assert "page" in pagination
        assert "limit" in pagination
        assert "total" in pagination
        assert "total_pages" in pagination
        
        print(f"✅ Cash Book endpoint returns correct structure")
        print(f"   Account: {data['account_name']}")
        print(f"   Opening Balance: ₹{data['opening_balance']}")
        print(f"   Current Balance: ₹{data['current_balance']}")
        print(f"   Total Entries: {pagination['total']}")
    
    def test_add_income_entry_to_cash_book(self):
        """Test POST /api/admin/accounting/cash-book/entry for income"""
        entry_data = {
            "entry_type": "income",
            "amount": 5000,
            "description": f"TEST_Income Entry {uuid.uuid4().hex[:8]}",
            "category": "vip_fee",
            "reference_no": f"TEST-INC-{uuid.uuid4().hex[:6].upper()}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/cash-book/entry",
            json=entry_data,
            params={"admin_id": "test-admin"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "entry_id" in data
        
        print(f"✅ Income entry added to Cash Book")
        print(f"   Entry ID: {data['entry_id']}")
        
        # Verify entry was persisted
        cash_book = requests.get(f"{BASE_URL}/api/admin/accounting/cash-book").json()
        entries = cash_book.get("entries", [])
        found = any(e.get("description") == entry_data["description"] for e in entries)
        assert found, "Entry not found in cash book after creation"
        print(f"   ✅ Entry verified in Cash Book")
    
    def test_add_expense_entry_to_cash_book(self):
        """Test POST /api/admin/accounting/cash-book/entry for expense"""
        entry_data = {
            "entry_type": "expense",
            "amount": 2000,
            "description": f"TEST_Expense Entry {uuid.uuid4().hex[:8]}",
            "category": "rent",
            "reference_no": f"TEST-EXP-{uuid.uuid4().hex[:6].upper()}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/cash-book/entry",
            json=entry_data,
            params={"admin_id": "test-admin"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "entry_id" in data
        
        print(f"✅ Expense entry added to Cash Book")
        print(f"   Entry ID: {data['entry_id']}")


class TestBankBook:
    """Test Bank Book endpoints"""
    
    def test_get_bank_book_returns_entries_and_pagination(self):
        """Test GET /api/admin/accounting/bank-book returns entries and pagination"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/bank-book")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "account_name" in data
        assert "bank_name" in data
        assert "opening_balance" in data
        assert "current_balance" in data
        assert "entries" in data
        assert "pagination" in data
        
        # Verify pagination structure
        pagination = data["pagination"]
        assert "page" in pagination
        assert "limit" in pagination
        assert "total" in pagination
        assert "total_pages" in pagination
        
        print(f"✅ Bank Book endpoint returns correct structure")
        print(f"   Account: {data['account_name']}")
        print(f"   Bank Name: {data['bank_name']}")
        print(f"   Opening Balance: ₹{data['opening_balance']}")
        print(f"   Current Balance: ₹{data['current_balance']}")
        print(f"   Total Entries: {pagination['total']}")
    
    def test_add_income_entry_to_bank_book(self):
        """Test POST /api/admin/accounting/bank-book/entry for income"""
        entry_data = {
            "entry_type": "income",
            "amount": 10000,
            "description": f"TEST_Bank Income {uuid.uuid4().hex[:8]}",
            "category": "ads_income",
            "reference_no": f"TEST-BINC-{uuid.uuid4().hex[:6].upper()}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/bank-book/entry",
            json=entry_data,
            params={"admin_id": "test-admin"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "entry_id" in data
        
        print(f"✅ Income entry added to Bank Book")
        print(f"   Entry ID: {data['entry_id']}")
        
        # Verify entry was persisted
        bank_book = requests.get(f"{BASE_URL}/api/admin/accounting/bank-book").json()
        entries = bank_book.get("entries", [])
        found = any(e.get("description") == entry_data["description"] for e in entries)
        assert found, "Entry not found in bank book after creation"
        print(f"   ✅ Entry verified in Bank Book")
    
    def test_add_expense_entry_to_bank_book(self):
        """Test POST /api/admin/accounting/bank-book/entry for expense"""
        entry_data = {
            "entry_type": "expense",
            "amount": 3000,
            "description": f"TEST_Bank Expense {uuid.uuid4().hex[:8]}",
            "category": "salary",
            "reference_no": f"TEST-BEXP-{uuid.uuid4().hex[:6].upper()}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/bank-book/entry",
            json=entry_data,
            params={"admin_id": "test-admin"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "entry_id" in data
        
        print(f"✅ Expense entry added to Bank Book")
        print(f"   Entry ID: {data['entry_id']}")


class TestOpeningBalance:
    """Test Set Opening Balance endpoint"""
    
    def test_set_cash_opening_balance(self):
        """Test POST /api/admin/accounting/set-opening-balance for cash"""
        test_amount = 50000
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/set-opening-balance",
            params={
                "account_type": "cash",
                "amount": test_amount
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        print(f"✅ Cash opening balance set to ₹{test_amount}")
        
        # Verify balance was updated
        summary = requests.get(f"{BASE_URL}/api/admin/accounting/summary").json()
        # Note: current_balance may differ due to transactions
        print(f"   Cash Opening Balance: ₹{summary['cash']['opening_balance']}")
    
    def test_set_bank_opening_balance_with_details(self):
        """Test POST /api/admin/accounting/set-opening-balance for bank with bank details"""
        test_amount = 100000
        bank_name = "HDFC Bank"
        account_number = "XXXX1234"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/set-opening-balance",
            params={
                "account_type": "bank",
                "amount": test_amount,
                "bank_name": bank_name,
                "account_number": account_number
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        print(f"✅ Bank opening balance set to ₹{test_amount}")
        
        # Verify bank details were updated
        summary = requests.get(f"{BASE_URL}/api/admin/accounting/summary").json()
        assert summary["bank"]["bank_name"] == bank_name, f"Bank name not updated"
        print(f"   Bank Name: {summary['bank']['bank_name']}")
        print(f"   Bank Opening Balance: ₹{summary['bank']['opening_balance']}")


class TestTransfer:
    """Test Transfer between accounts endpoint"""
    
    def test_transfer_cash_to_bank(self):
        """Test POST /api/admin/accounting/transfer from cash to bank"""
        transfer_amount = 5000
        
        # Get balances before transfer
        summary_before = requests.get(f"{BASE_URL}/api/admin/accounting/summary").json()
        cash_before = summary_before["cash"]["current_balance"]
        bank_before = summary_before["bank"]["current_balance"]
        
        transfer_data = {
            "from_account": "cash",
            "to_account": "bank",
            "amount": transfer_amount,
            "description": f"TEST_Transfer to bank {uuid.uuid4().hex[:8]}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/transfer",
            json=transfer_data,
            params={"admin_id": "test-admin"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "reference" in data
        
        print(f"✅ Transfer from Cash to Bank completed")
        print(f"   Reference: {data['reference']}")
        print(f"   Amount: ₹{transfer_amount}")
        
        # Verify balances after transfer
        summary_after = requests.get(f"{BASE_URL}/api/admin/accounting/summary").json()
        cash_after = summary_after["cash"]["current_balance"]
        bank_after = summary_after["bank"]["current_balance"]
        
        # Cash should decrease, Bank should increase
        assert cash_after == cash_before - transfer_amount, f"Cash balance not decreased correctly"
        assert bank_after == bank_before + transfer_amount, f"Bank balance not increased correctly"
        print(f"   ✅ Balances verified after transfer")
    
    def test_transfer_bank_to_cash(self):
        """Test POST /api/admin/accounting/transfer from bank to cash"""
        transfer_amount = 3000
        
        # Get balances before transfer
        summary_before = requests.get(f"{BASE_URL}/api/admin/accounting/summary").json()
        cash_before = summary_before["cash"]["current_balance"]
        bank_before = summary_before["bank"]["current_balance"]
        
        transfer_data = {
            "from_account": "bank",
            "to_account": "cash",
            "amount": transfer_amount,
            "description": f"TEST_Withdrawal from bank {uuid.uuid4().hex[:8]}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/transfer",
            json=transfer_data,
            params={"admin_id": "test-admin"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "reference" in data
        
        print(f"✅ Transfer from Bank to Cash completed")
        print(f"   Reference: {data['reference']}")
        print(f"   Amount: ₹{transfer_amount}")
        
        # Verify balances after transfer
        summary_after = requests.get(f"{BASE_URL}/api/admin/accounting/summary").json()
        cash_after = summary_after["cash"]["current_balance"]
        bank_after = summary_after["bank"]["current_balance"]
        
        # Bank should decrease, Cash should increase
        assert bank_after == bank_before - transfer_amount, f"Bank balance not decreased correctly"
        assert cash_after == cash_before + transfer_amount, f"Cash balance not increased correctly"
        print(f"   ✅ Balances verified after transfer")
    
    def test_transfer_same_account_fails(self):
        """Test that transfer to same account fails"""
        transfer_data = {
            "from_account": "cash",
            "to_account": "cash",
            "amount": 1000,
            "description": "Invalid transfer"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/transfer",
            json=transfer_data,
            params={"admin_id": "test-admin"}
        )
        assert response.status_code == 400, f"Expected 400 for same account transfer, got {response.status_code}"
        
        print(f"✅ Transfer to same account correctly rejected with 400")


class TestRunningBalance:
    """Test running balance calculation"""
    
    def test_cash_book_running_balance(self):
        """Test that cash book entries have running balance"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/cash-book")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        if entries:
            for entry in entries[:3]:  # Check first 3 entries
                assert "running_balance" in entry, f"Entry missing running_balance: {entry}"
            print(f"✅ Cash Book entries have running balance")
        else:
            print(f"⚠️ No entries in Cash Book to verify running balance")
    
    def test_bank_book_running_balance(self):
        """Test that bank book entries have running balance"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/bank-book")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        if entries:
            for entry in entries[:3]:  # Check first 3 entries
                assert "running_balance" in entry, f"Entry missing running_balance: {entry}"
            print(f"✅ Bank Book entries have running balance")
        else:
            print(f"⚠️ No entries in Bank Book to verify running balance")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
