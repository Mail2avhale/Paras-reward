"""
PRC Usage History API Tests
Tests for GET /api/prc-statement/usage-history/{uid}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com')

# Test user credentials from test_credentials.md
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"

PRC_TEST_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


class TestPRCUsageHistoryAPI:
    """Tests for PRC Usage History endpoint"""
    
    def test_01_usage_history_returns_200(self):
        """Test that usage history endpoint returns 200 for valid user"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Usage history endpoint returns 200")
    
    def test_02_usage_history_has_success_field(self):
        """Test that response contains success: true"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data.get('success')}"
        print("PASS: Response has success=True")
    
    def test_03_usage_history_has_summary(self):
        """Test that response contains summary with required fields"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        
        assert "summary" in data, "Response missing 'summary' field"
        summary = data["summary"]
        
        # Check required summary fields
        assert "total_used" in summary, "Summary missing 'total_used'"
        assert "total_transactions" in summary, "Summary missing 'total_transactions'"
        assert "months_active" in summary, "Summary missing 'months_active'"
        
        # Validate types
        assert isinstance(summary["total_used"], (int, float)), "total_used should be numeric"
        assert isinstance(summary["total_transactions"], int), "total_transactions should be int"
        assert isinstance(summary["months_active"], int), "months_active should be int"
        
        print(f"PASS: Summary contains total_used={summary['total_used']}, total_transactions={summary['total_transactions']}, months_active={summary['months_active']}")
    
    def test_04_usage_history_has_graph_data(self):
        """Test that response contains graph_data array"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        
        assert "graph_data" in data, "Response missing 'graph_data' field"
        assert isinstance(data["graph_data"], list), "graph_data should be a list"
        
        if len(data["graph_data"]) > 0:
            first_item = data["graph_data"][0]
            assert "month" in first_item, "graph_data item missing 'month'"
            assert "total" in first_item, "graph_data item missing 'total'"
            assert "count" in first_item, "graph_data item missing 'count'"
            print(f"PASS: graph_data has {len(data['graph_data'])} months of data")
        else:
            print("PASS: graph_data is empty (no usage yet)")
    
    def test_05_usage_history_has_daily_breakdown(self):
        """Test that response contains daily_breakdown array"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        
        assert "daily_breakdown" in data, "Response missing 'daily_breakdown' field"
        assert isinstance(data["daily_breakdown"], list), "daily_breakdown should be a list"
        
        if len(data["daily_breakdown"]) > 0:
            first_day = data["daily_breakdown"][0]
            assert "date" in first_day, "daily_breakdown item missing 'date'"
            assert "total" in first_day, "daily_breakdown item missing 'total'"
            assert "entries" in first_day, "daily_breakdown item missing 'entries'"
            assert isinstance(first_day["entries"], list), "entries should be a list"
            
            if len(first_day["entries"]) > 0:
                entry = first_day["entries"][0]
                assert "time" in entry, "entry missing 'time'"
                assert "amount" in entry, "entry missing 'amount'"
                assert "type" in entry, "entry missing 'type'"
                assert "narration" in entry, "entry missing 'narration'"
            
            print(f"PASS: daily_breakdown has {len(data['daily_breakdown'])} days with entries")
        else:
            print("PASS: daily_breakdown is empty (no usage yet)")
    
    def test_06_usage_history_has_join_date(self):
        """Test that response contains join_date"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        
        assert "join_date" in data, "Response missing 'join_date' field"
        # join_date can be null if not set
        if data["join_date"]:
            assert isinstance(data["join_date"], str), "join_date should be a string (ISO format)"
        print(f"PASS: join_date = {data.get('join_date')}")
    
    def test_07_usage_history_has_current_balance(self):
        """Test that response contains current_balance"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        
        assert "current_balance" in data, "Response missing 'current_balance' field"
        assert isinstance(data["current_balance"], (int, float)), "current_balance should be numeric"
        print(f"PASS: current_balance = {data.get('current_balance')}")
    
    def test_08_usage_history_summary_by_type(self):
        """Test that summary contains by_type breakdown"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        
        summary = data.get("summary", {})
        assert "by_type" in summary, "Summary missing 'by_type' field"
        assert isinstance(summary["by_type"], dict), "by_type should be a dict"
        
        # If there are types, verify they have numeric values
        for type_name, amount in summary["by_type"].items():
            assert isinstance(amount, (int, float)), f"by_type[{type_name}] should be numeric"
        
        print(f"PASS: by_type breakdown = {summary['by_type']}")
    
    def test_09_usage_history_404_for_invalid_user(self):
        """Test that endpoint returns 404 for non-existent user"""
        fake_uid = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{fake_uid}")
        assert response.status_code == 404, f"Expected 404 for invalid user, got {response.status_code}"
        print("PASS: Returns 404 for non-existent user")
    
    def test_10_usage_history_calculation_accuracy(self):
        """Test that total_used matches sum of daily totals"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        
        summary_total = data["summary"]["total_used"]
        daily_sum = sum(day["total"] for day in data["daily_breakdown"])
        
        # Allow small floating point difference
        diff = abs(summary_total - daily_sum)
        assert diff < 0.1, f"Calculation mismatch: summary={summary_total}, daily_sum={daily_sum}, diff={diff}"
        print(f"PASS: Calculation accurate - summary_total={summary_total}, daily_sum={daily_sum}")
    
    def test_11_usage_history_transaction_count_matches(self):
        """Test that total_transactions matches count of all entries"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        
        summary_count = data["summary"]["total_transactions"]
        entry_count = sum(len(day["entries"]) for day in data["daily_breakdown"])
        
        assert summary_count == entry_count, f"Transaction count mismatch: summary={summary_count}, entries={entry_count}"
        print(f"PASS: Transaction count matches - {summary_count} transactions")
    
    def test_12_usage_history_months_active_matches_graph(self):
        """Test that months_active matches graph_data length"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{TEST_USER_UID}")
        data = response.json()
        
        months_active = data["summary"]["months_active"]
        graph_months = len(data["graph_data"])
        
        assert months_active == graph_months, f"Months mismatch: summary={months_active}, graph={graph_months}"
        print(f"PASS: months_active={months_active} matches graph_data length")


class TestPRCUsageHistorySecondUser:
    """Tests for PRC Usage History with second test user"""
    
    def test_01_prc_user_usage_history(self):
        """Test usage history for PRC test user"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRC_TEST_USER_UID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert "summary" in data
        assert "graph_data" in data
        assert "daily_breakdown" in data
        
        print(f"PASS: PRC test user has {data['summary']['total_transactions']} transactions")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
