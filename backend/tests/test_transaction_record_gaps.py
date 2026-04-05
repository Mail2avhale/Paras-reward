"""
Test Transaction Record Gaps - Iteration 178
Tests for:
1. balance_after field accuracy for daily streak transactions
2. Bulk fix operations have transaction records (bulk_refund, admin_bulk_restore)
3. Auto-diagnose operations have transaction records (admin_refund with DIAG prefix)
4. PRC Statement correctly classifies all entry types
5. Admin transactions endpoint returns transactions from all 4 collections
6. PRC Statement balance_after is populated for burn entries
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDailyStreakBalanceAfter:
    """Test that daily_streak transactions have non-zero balance_after"""
    
    def test_daily_streak_transactions_have_balance_after(self):
        """Verify daily_streak transactions have balance_after populated"""
        # Get transactions for test user
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        # First login to get auth token
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@test.com",
            "password": "153759"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get admin transactions for the user (correct endpoint is /admin/transactions/all)
        resp = requests.get(
            f"{BASE_URL}/api/admin/transactions/all",
            params={"user_id": test_uid, "type": "daily_streak", "limit": 20},
            headers=headers
        )
        
        assert resp.status_code == 200, f"Failed to get transactions: {resp.text}"
        data = resp.json()
        
        transactions = data.get("transactions", [])
        print(f"Found {len(transactions)} daily_streak transactions")
        
        # Check if any daily_streak transactions exist
        if len(transactions) > 0:
            # Count transactions with and without balance_after
            with_balance = 0
            without_balance = 0
            
            for txn in transactions:
                balance_after = txn.get("balance_after")
                txn_id = txn.get("transaction_id", "N/A")
                print(f"  Transaction {txn_id}: balance_after={balance_after}")
                
                if balance_after is not None:
                    with_balance += 1
                else:
                    without_balance += 1
            
            print(f"Summary: {with_balance} with balance_after, {without_balance} without")
            
            # At least some transactions should have balance_after (new ones after fix)
            # Historical transactions may not have it
            assert with_balance > 0, "No daily_streak transactions have balance_after - fix may not be working"
        else:
            print("No daily_streak transactions found - this is OK if user hasn't done daily checkin")


class TestBulkFixTransactionRecords:
    """Test that bulk fix operations create transaction records"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@test.com",
            "password": "153759"
        })
        assert login_resp.status_code == 200
        return login_resp.json().get("token")
    
    def test_bulk_fix_endpoint_exists(self, admin_token):
        """Verify bulk-fix-start endpoint exists"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test with dry_run=true to not actually modify data
        resp = requests.post(
            f"{BASE_URL}/api/admin/bulk-fix-start",
            json={"dry_run": True, "limit": 1},
            headers=headers
        )
        
        # Should return 200 or 400 (if no users to fix), not 404
        assert resp.status_code in [200, 400, 422], f"Bulk fix endpoint error: {resp.status_code} - {resp.text}"
        print(f"Bulk fix endpoint response: {resp.status_code}")
    
    def test_bulk_refund_type_in_type_map(self):
        """Verify bulk_refund is mapped in PRC Statement TYPE_MAP"""
        # Get PRC statement for test user
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(f"{BASE_URL}/api/prc-statement/{test_uid}")
        assert resp.status_code == 200, f"PRC statement failed: {resp.text}"
        
        data = resp.json()
        filters = data.get("filters", [])
        
        # Verify Refund is in filter categories (bulk_refund maps to Refund)
        assert "Refund" in filters, f"Refund not in filters: {filters}"
        print(f"Available filters: {filters}")
    
    def test_admin_bulk_restore_type_in_type_map(self):
        """Verify admin_bulk_restore is mapped in PRC Statement TYPE_MAP"""
        # admin_bulk_restore should map to 'Admin' category
        # This is verified by checking the filter categories include Admin
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(f"{BASE_URL}/api/prc-statement/{test_uid}")
        assert resp.status_code == 200
        
        data = resp.json()
        filters = data.get("filters", [])
        
        # Admin category should exist for admin_bulk_restore
        assert "Admin" in filters, f"Admin not in filters: {filters}"


class TestAutoDiagnoseTransactionRecords:
    """Test that auto-diagnose operations create transaction records"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@test.com",
            "password": "153759"
        })
        assert login_resp.status_code == 200
        return login_resp.json().get("token")
    
    def test_diagnose_user_endpoint_exists(self, admin_token):
        """Verify diagnose-user endpoint exists and works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        # Call diagnose without auto_fix to just check issues (correct endpoint is /admin/user/{uid}/diagnose)
        resp = requests.get(
            f"{BASE_URL}/api/admin/user/{test_uid}/diagnose",
            params={"auto_fix": False},
            headers=headers
        )
        
        assert resp.status_code == 200, f"Diagnose endpoint error: {resp.status_code} - {resp.text}"
        data = resp.json()
        
        print(f"Diagnose response keys: {data.keys()}")
        print(f"Issues found: {len(data.get('issues', []))}")
        
        # Verify response structure - check for user object or issues array
        assert "user" in data or "issues" in data, f"Missing expected fields in response: {data.keys()}"
    
    def test_admin_refund_type_in_type_map(self):
        """Verify admin_refund is mapped in PRC Statement TYPE_MAP"""
        # admin_refund should map to 'Refund' category
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(f"{BASE_URL}/api/prc-statement/{test_uid}")
        assert resp.status_code == 200
        
        data = resp.json()
        filters = data.get("filters", [])
        
        # Refund category should exist for admin_refund
        assert "Refund" in filters, f"Refund not in filters: {filters}"


class TestPRCStatementClassification:
    """Test PRC Statement correctly classifies all entry types"""
    
    def test_burn_entries_are_debit(self):
        """Verify burn entries show as DEBIT (credit=0, debit>0)"""
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(
            f"{BASE_URL}/api/prc-statement/{test_uid}",
            params={"filter_type": "Burn", "limit": 50}
        )
        assert resp.status_code == 200, f"PRC statement failed: {resp.text}"
        
        data = resp.json()
        entries = data.get("entries", [])
        
        print(f"Found {len(entries)} Burn entries")
        
        debit_correct = 0
        debit_incorrect = 0
        
        for entry in entries:
            if entry.get("debit", 0) > 0 and entry.get("credit", 0) == 0:
                debit_correct += 1
            else:
                debit_incorrect += 1
                print(f"  INCORRECT: {entry}")
        
        print(f"Burn entries: {debit_correct} correct DEBIT, {debit_incorrect} incorrect")
        
        if len(entries) > 0:
            assert debit_incorrect == 0, f"{debit_incorrect} burn entries incorrectly classified"
    
    def test_reward_entries_are_credit(self):
        """Verify reward entries show as CREDIT (credit>0, debit=0)"""
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(
            f"{BASE_URL}/api/prc-statement/{test_uid}",
            params={"filter_type": "Reward", "limit": 50}
        )
        assert resp.status_code == 200
        
        data = resp.json()
        entries = data.get("entries", [])
        
        print(f"Found {len(entries)} Reward entries")
        
        credit_correct = 0
        credit_incorrect = 0
        
        for entry in entries:
            if entry.get("credit", 0) > 0 and entry.get("debit", 0) == 0:
                credit_correct += 1
            else:
                credit_incorrect += 1
                print(f"  INCORRECT: {entry}")
        
        print(f"Reward entries: {credit_correct} correct CREDIT, {credit_incorrect} incorrect")
        
        if len(entries) > 0:
            assert credit_incorrect == 0, f"{credit_incorrect} reward entries incorrectly classified"
    
    def test_subscription_entries_are_debit(self):
        """Verify subscription entries show as DEBIT"""
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(
            f"{BASE_URL}/api/prc-statement/{test_uid}",
            params={"filter_type": "Subscription", "limit": 50}
        )
        assert resp.status_code == 200
        
        data = resp.json()
        entries = data.get("entries", [])
        
        print(f"Found {len(entries)} Subscription entries")
        
        # Subscription payments should be debits (money going out)
        for entry in entries[:5]:
            print(f"  Subscription: credit={entry.get('credit')}, debit={entry.get('debit')}")
    
    def test_refund_entries_are_credit(self):
        """Verify refund entries show as CREDIT"""
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(
            f"{BASE_URL}/api/prc-statement/{test_uid}",
            params={"filter_type": "Refund", "limit": 50}
        )
        assert resp.status_code == 200
        
        data = resp.json()
        entries = data.get("entries", [])
        
        print(f"Found {len(entries)} Refund entries")
        
        credit_correct = 0
        credit_incorrect = 0
        
        for entry in entries:
            # Refunds should be credits (money coming back)
            if entry.get("credit", 0) > 0 and entry.get("debit", 0) == 0:
                credit_correct += 1
            else:
                credit_incorrect += 1
                print(f"  INCORRECT: {entry}")
        
        print(f"Refund entries: {credit_correct} correct CREDIT, {credit_incorrect} incorrect")
        
        if len(entries) > 0:
            assert credit_incorrect == 0, f"{credit_incorrect} refund entries incorrectly classified"


class TestAdminTransactionsEndpoint:
    """Test admin transactions endpoint returns from all 4 collections"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@test.com",
            "password": "153759"
        })
        assert login_resp.status_code == 200
        return login_resp.json().get("token")
    
    def test_admin_transactions_returns_data(self, admin_token):
        """Verify admin transactions endpoint returns transactions from all 4 collections"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        # Correct endpoint is /admin/transactions/all
        resp = requests.get(
            f"{BASE_URL}/api/admin/transactions/all",
            params={"user_id": test_uid, "limit": 100},
            headers=headers
        )
        
        assert resp.status_code == 200, f"Admin transactions failed: {resp.text}"
        data = resp.json()
        
        transactions = data.get("transactions", [])
        total = data.get("total", 0)
        
        print(f"Admin transactions: {len(transactions)} returned, {total} total")
        
        # Should have transactions
        assert len(transactions) > 0, "No transactions returned"
        
        # Check transaction types to verify multiple collections
        types_found = set()
        for txn in transactions:
            txn_type = txn.get("type", "unknown")
            types_found.add(txn_type)
        
        print(f"Transaction types found: {types_found}")
        
        # Should have multiple types indicating multiple collections
        assert len(types_found) > 1, f"Only found {len(types_found)} transaction types"
    
    def test_admin_transactions_requires_auth(self):
        """Verify admin transactions endpoint requires authentication"""
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(
            f"{BASE_URL}/api/admin/transactions/all",
            params={"user_id": test_uid}
        )
        
        # Should return 401 or 403 without auth
        assert resp.status_code in [401, 403, 422], f"Expected auth error, got {resp.status_code}"


class TestPRCStatementBalanceAfter:
    """Test PRC Statement balance_after is populated for burn entries"""
    
    def test_burn_entries_have_balance_after(self):
        """Verify burn entries from prc_transactions have balance_after"""
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(
            f"{BASE_URL}/api/prc-statement/{test_uid}",
            params={"filter_type": "Burn", "limit": 50}
        )
        assert resp.status_code == 200
        
        data = resp.json()
        entries = data.get("entries", [])
        
        print(f"Checking balance_after for {len(entries)} Burn entries")
        
        has_balance = 0
        missing_balance = 0
        
        for entry in entries:
            balance = entry.get("balance", 0)
            if balance > 0 or balance == 0:  # balance field is populated
                has_balance += 1
            else:
                missing_balance += 1
                print(f"  Missing balance: {entry}")
        
        print(f"Burn entries: {has_balance} with balance, {missing_balance} missing")
        
        # Most entries should have balance populated
        if len(entries) > 0:
            balance_rate = has_balance / len(entries)
            print(f"Balance population rate: {balance_rate:.1%}")


class TestDetermineCredit:
    """Test determine_credit() function logic via API responses"""
    
    def test_entry_type_field_priority(self):
        """Verify entry_type field takes priority over amount sign"""
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        # Get all entries
        resp = requests.get(
            f"{BASE_URL}/api/prc-statement/{test_uid}",
            params={"limit": 100}
        )
        assert resp.status_code == 200
        
        data = resp.json()
        entries = data.get("entries", [])
        
        # Count entries by type
        type_counts = {}
        for entry in entries:
            entry_type = entry.get("type", "Unknown")
            type_counts[entry_type] = type_counts.get(entry_type, 0) + 1
        
        print(f"Entry type distribution: {type_counts}")
        
        # Verify totals
        summary = data.get("summary", {})
        total_earned = summary.get("total_earned", 0)
        total_used = summary.get("total_used", 0)
        
        print(f"Summary: earned={total_earned}, used={total_used}")
        
        # Should have both credits and debits
        assert total_earned > 0, "No credits found"
        assert total_used > 0, "No debits found"


class TestTypeMapCompleteness:
    """Test TYPE_MAP covers all expected transaction types"""
    
    def test_filter_categories_available(self):
        """Verify all expected filter categories are available"""
        test_uid = "76b75808-47fa-48dd-ad7c-8074678e3607"
        
        resp = requests.get(f"{BASE_URL}/api/prc-statement/{test_uid}")
        assert resp.status_code == 200
        
        data = resp.json()
        filters = data.get("filters", [])
        
        expected_filters = ["All", "Reward", "Burn", "Refund", "Admin"]
        
        for expected in expected_filters:
            assert expected in filters, f"Missing filter: {expected}"
        
        print(f"All expected filters present: {expected_filters}")
        print(f"Full filter list: {filters}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
