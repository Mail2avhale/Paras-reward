"""
PRC Statement API Tests
Tests for bank passbook style ledger showing Credit/Debit with running balance
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials from test_credentials.md
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # Elite user with transactions


class TestPRCStatementAPI:
    """PRC Statement endpoint tests"""
    
    def test_get_prc_statement_basic(self):
        """Test basic PRC statement retrieval returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should have success=True"
        assert "summary" in data, "Response should have summary"
        assert "entries" in data, "Response should have entries"
        assert "pagination" in data, "Response should have pagination"
        assert "filters" in data, "Response should have filters"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_earned" in summary, "Summary should have total_earned"
        assert "total_used" in summary, "Summary should have total_used"
        assert "current_balance" in summary, "Summary should have current_balance"
        
        print(f"✓ Basic PRC statement retrieved: {len(data['entries'])} entries")
        print(f"  Summary: earned={summary['total_earned']}, used={summary['total_used']}, balance={summary['current_balance']}")
    
    def test_entry_structure(self):
        """Test that each entry has required fields: date, type, narration, credit, debit, balance"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        assert len(entries) > 0, "Should have at least one entry"
        
        for i, entry in enumerate(entries[:5]):  # Check first 5 entries
            assert "date" in entry, f"Entry {i} missing date"
            assert "type" in entry, f"Entry {i} missing type"
            assert "narration" in entry, f"Entry {i} missing narration"
            assert "credit" in entry, f"Entry {i} missing credit"
            assert "debit" in entry, f"Entry {i} missing debit"
            assert "balance" in entry, f"Entry {i} missing balance"
            
            # Verify types
            assert isinstance(entry["credit"], (int, float)), f"Entry {i} credit should be numeric"
            assert isinstance(entry["debit"], (int, float)), f"Entry {i} debit should be numeric"
            assert isinstance(entry["balance"], (int, float)), f"Entry {i} balance should be numeric"
            
            print(f"  Entry {i}: type={entry['type']}, narration={entry['narration'][:30]}..., CR={entry['credit']}, DR={entry['debit']}")
        
        print(f"✓ Entry structure verified for {len(entries)} entries")
    
    def test_filter_by_reward(self):
        """Test filter_type=Reward returns only Reward entries"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?filter_type=Reward")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        for entry in entries:
            assert entry["type"] == "Reward", f"Expected type=Reward, got {entry['type']}"
        
        print(f"✓ Filter by Reward: {len(entries)} entries, all type=Reward")
    
    def test_filter_by_burn(self):
        """Test filter_type=Burn returns only Burn entries"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?filter_type=Burn")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        for entry in entries:
            assert entry["type"] == "Burn", f"Expected type=Burn, got {entry['type']}"
        
        print(f"✓ Filter by Burn: {len(entries)} entries, all type=Burn")
    
    def test_sort_order_asc(self):
        """Test sort_order=asc sorts oldest first"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?sort_order=asc&limit=20")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        if len(entries) >= 2:
            # Verify ascending order (oldest first)
            for i in range(len(entries) - 1):
                date1 = entries[i]["date"]
                date2 = entries[i + 1]["date"]
                assert date1 <= date2, f"Entries not in ascending order: {date1} > {date2}"
        
        print(f"✓ Sort order asc verified: {len(entries)} entries in oldest-first order")
    
    def test_sort_order_desc(self):
        """Test sort_order=desc sorts newest first (default)"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?sort_order=desc&limit=20")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        if len(entries) >= 2:
            # Verify descending order (newest first)
            for i in range(len(entries) - 1):
                date1 = entries[i]["date"]
                date2 = entries[i + 1]["date"]
                assert date1 >= date2, f"Entries not in descending order: {date1} < {date2}"
        
        print(f"✓ Sort order desc verified: {len(entries)} entries in newest-first order")
    
    def test_mining_entries_show_as_reward(self):
        """Test that mining entries show type=Reward and narration='Daily Reward Collected'"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?filter_type=Reward&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        # Check that Reward entries have proper narration
        daily_reward_count = 0
        for entry in entries:
            if entry["narration"] == "Daily Reward Collected":
                daily_reward_count += 1
                assert entry["type"] == "Reward", f"Daily Reward Collected should have type=Reward"
        
        print(f"✓ Mining entries verified: {daily_reward_count} 'Daily Reward Collected' entries found")
    
    def test_summary_totals_are_numeric(self):
        """Test that summary totals are numeric and reasonable"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("summary", {})
        
        total_earned = summary.get("total_earned", 0)
        total_used = summary.get("total_used", 0)
        current_balance = summary.get("current_balance", 0)
        
        assert isinstance(total_earned, (int, float)), "total_earned should be numeric"
        assert isinstance(total_used, (int, float)), "total_used should be numeric"
        assert isinstance(current_balance, (int, float)), "current_balance should be numeric"
        
        assert total_earned >= 0, "total_earned should be non-negative"
        assert total_used >= 0, "total_used should be non-negative"
        
        print(f"✓ Summary totals verified: earned={total_earned}, used={total_used}, balance={current_balance}")
    
    def test_pagination_works(self):
        """Test pagination returns correct page info"""
        # Get page 1
        response1 = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?page=1&limit=10")
        assert response1.status_code == 200
        data1 = response1.json()
        
        pagination = data1.get("pagination", {})
        assert pagination.get("page") == 1, "Page should be 1"
        assert pagination.get("limit") == 10, "Limit should be 10"
        assert "total_entries" in pagination, "Should have total_entries"
        assert "total_pages" in pagination, "Should have total_pages"
        
        total_pages = pagination.get("total_pages", 1)
        
        if total_pages > 1:
            # Get page 2
            response2 = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?page=2&limit=10")
            assert response2.status_code == 200
            data2 = response2.json()
            
            # Verify different entries on page 2
            entries1 = [e.get("txn_id") for e in data1.get("entries", [])]
            entries2 = [e.get("txn_id") for e in data2.get("entries", [])]
            
            # At least some entries should be different
            if entries1 and entries2:
                assert entries1 != entries2, "Page 1 and Page 2 should have different entries"
        
        print(f"✓ Pagination verified: {pagination['total_entries']} total entries, {total_pages} pages")
    
    def test_filter_categories_returned(self):
        """Test that filter categories are returned in response"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        filters = data.get("filters", [])
        
        expected_filters = ["All", "Reward", "Recharge", "Bill Pay", "Redeem", "Bank Redeem", "Voucher Redeem", "Refund", "Burn", "Admin"]
        
        for f in expected_filters:
            assert f in filters, f"Filter '{f}' should be in filters list"
        
        print(f"✓ Filter categories verified: {filters}")
    
    def test_active_filter_returned(self):
        """Test that active_filter is returned correctly"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?filter_type=Burn")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("active_filter") == "Burn", f"active_filter should be 'Burn', got {data.get('active_filter')}"
        
        print(f"✓ Active filter verified: {data.get('active_filter')}")
    
    def test_user_not_found(self):
        """Test 404 for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/non-existent-uid-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ User not found returns 404")
    
    def test_credit_debit_values(self):
        """Test that credit and debit values are mutually exclusive per entry"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/{TEST_USER_UID}?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        for entry in entries:
            credit = entry.get("credit", 0)
            debit = entry.get("debit", 0)
            
            # Either credit or debit should be non-zero, not both
            if credit > 0:
                assert debit == 0, f"Entry has both credit ({credit}) and debit ({debit})"
            if debit > 0:
                assert credit == 0, f"Entry has both credit ({credit}) and debit ({debit})"
        
        print(f"✓ Credit/Debit mutual exclusivity verified for {len(entries)} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
