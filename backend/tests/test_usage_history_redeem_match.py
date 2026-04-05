"""
Test: Usage History and Redeem Limit Match Verification
Bug Fix: Dashboard USED should match Usage History page (no burns/admin debits)

Key validations:
1. usage-history API returns ONLY service categories (no Burns, Admin, Other)
2. usage-history total_used MUST match redeem-limit total_redeemed
3. by_category contains only: Mobile Recharge, Bank Redeem, Gift Cards, Subscription, Bill Pay, Shopping, Redeem, Loan EMI
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Service categories that should appear in usage-history
ALLOWED_CATEGORIES = {
    'Mobile Recharge', 'Bank Redeem', 'Gift Cards', 'Subscription', 
    'Bill Pay', 'Shopping', 'Redeem', 'Loan EMI'
}

# Categories that should NOT appear in usage-history
EXCLUDED_CATEGORIES = {'Burn', 'Admin', 'Admin Credit', 'Admin Debit', 'Other', 'Reward', 'Refund'}

# Test users from test_credentials.md
PRIMARY_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
PRC_USER_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


class TestHealthCheck:
    """Health check tests"""
    
    def test_health_endpoint_returns_200(self):
        """Test health endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health check passed: {data}")


class TestUsageHistoryAPI:
    """Usage History API tests - verifies only service categories are returned"""
    
    def test_usage_history_returns_200(self):
        """Test usage-history endpoint returns 200 for valid user"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRIMARY_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "summary" in data
        print(f"✅ Usage history API returns 200")
    
    def test_usage_history_has_required_fields(self):
        """Test usage-history response has all required fields"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRIMARY_USER_UID}")
        data = response.json()
        
        # Check required top-level fields
        assert "success" in data
        assert "user_id" in data
        assert "summary" in data
        assert "graph_data" in data
        assert "daily_breakdown" in data
        
        # Check summary fields
        summary = data["summary"]
        assert "total_used" in summary
        assert "total_transactions" in summary
        assert "by_category" in summary
        assert "months_active" in summary
        print(f"✅ Usage history has all required fields")
    
    def test_usage_history_no_burns_or_admin(self):
        """CRITICAL: Verify usage-history does NOT include Burns or Admin transactions"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRIMARY_USER_UID}")
        data = response.json()
        
        by_category = data["summary"].get("by_category", {})
        categories_found = set(by_category.keys())
        
        # Check no excluded categories are present
        excluded_found = categories_found.intersection(EXCLUDED_CATEGORIES)
        assert len(excluded_found) == 0, f"Found excluded categories: {excluded_found}"
        
        # Check all categories are in allowed list
        for cat in categories_found:
            assert cat in ALLOWED_CATEGORIES, f"Unexpected category: {cat}"
        
        print(f"✅ No Burns/Admin/Other in usage-history. Categories: {categories_found}")
    
    def test_usage_history_prc_user_no_burns(self):
        """Test PRC user also has no burns in usage-history"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRC_USER_UID}")
        data = response.json()
        
        by_category = data["summary"].get("by_category", {})
        categories_found = set(by_category.keys())
        
        # Check no excluded categories
        excluded_found = categories_found.intersection(EXCLUDED_CATEGORIES)
        assert len(excluded_found) == 0, f"Found excluded categories: {excluded_found}"
        
        print(f"✅ PRC user has no Burns/Admin. Categories: {categories_found}")


class TestRedeemLimitAPI:
    """Redeem Limit API tests"""
    
    def test_redeem_limit_returns_200(self):
        """Test redeem-limit endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redeem-limit")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "limit" in data
        print(f"✅ Redeem limit API returns 200")
    
    def test_redeem_limit_has_total_redeemed(self):
        """Test redeem-limit has total_redeemed field"""
        response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redeem-limit")
        data = response.json()
        
        limit = data.get("limit", {})
        assert "total_redeemed" in limit
        assert isinstance(limit["total_redeemed"], (int, float))
        print(f"✅ Redeem limit has total_redeemed: {limit['total_redeemed']}")


class TestUsageHistoryRedeemLimitMatch:
    """CRITICAL: Verify usage-history total_used matches redeem-limit total_redeemed"""
    
    def test_primary_user_totals_match(self):
        """CRITICAL: Primary user usage-history total_used MUST match redeem-limit total_redeemed"""
        # Get usage-history
        usage_response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRIMARY_USER_UID}")
        usage_data = usage_response.json()
        total_used = usage_data["summary"]["total_used"]
        
        # Get redeem-limit
        limit_response = requests.get(f"{BASE_URL}/api/user/{PRIMARY_USER_UID}/redeem-limit")
        limit_data = limit_response.json()
        total_redeemed = limit_data["limit"]["total_redeemed"]
        
        # CRITICAL ASSERTION: These must match exactly
        assert abs(total_used - total_redeemed) < 0.01, \
            f"MISMATCH! usage-history total_used={total_used} != redeem-limit total_redeemed={total_redeemed}"
        
        print(f"✅ PRIMARY USER MATCH: usage-history total_used={total_used} == redeem-limit total_redeemed={total_redeemed}")
    
    def test_prc_user_totals_match(self):
        """CRITICAL: PRC user usage-history total_used MUST match redeem-limit total_redeemed"""
        # Get usage-history
        usage_response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRC_USER_UID}")
        usage_data = usage_response.json()
        total_used = usage_data["summary"]["total_used"]
        
        # Get redeem-limit
        limit_response = requests.get(f"{BASE_URL}/api/user/{PRC_USER_UID}/redeem-limit")
        limit_data = limit_response.json()
        total_redeemed = limit_data["limit"]["total_redeemed"]
        
        # CRITICAL ASSERTION: These must match exactly
        assert abs(total_used - total_redeemed) < 0.01, \
            f"MISMATCH! usage-history total_used={total_used} != redeem-limit total_redeemed={total_redeemed}"
        
        print(f"✅ PRC USER MATCH: usage-history total_used={total_used} == redeem-limit total_redeemed={total_redeemed}")


class TestUsageHistoryDataStructure:
    """Test usage-history data structure for frontend compatibility"""
    
    def test_graph_data_structure(self):
        """Test graph_data has correct structure for chart rendering"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRC_USER_UID}")
        data = response.json()
        
        graph_data = data.get("graph_data", [])
        if len(graph_data) > 0:
            item = graph_data[0]
            assert "month" in item, "graph_data item missing 'month'"
            assert "total" in item, "graph_data item missing 'total'"
            assert "count" in item, "graph_data item missing 'count'"
        print(f"✅ Graph data structure valid. {len(graph_data)} months of data")
    
    def test_daily_breakdown_structure(self):
        """Test daily_breakdown has correct structure for expandable rows"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/{PRC_USER_UID}")
        data = response.json()
        
        daily_breakdown = data.get("daily_breakdown", [])
        if len(daily_breakdown) > 0:
            day = daily_breakdown[0]
            assert "date" in day, "daily_breakdown item missing 'date'"
            assert "total" in day, "daily_breakdown item missing 'total'"
            assert "entries" in day, "daily_breakdown item missing 'entries'"
            
            if len(day["entries"]) > 0:
                entry = day["entries"][0]
                assert "time" in entry, "entry missing 'time'"
                assert "amount" in entry, "entry missing 'amount'"
                assert "category" in entry, "entry missing 'category'"
                assert "narration" in entry, "entry missing 'narration'"
        print(f"✅ Daily breakdown structure valid. {len(daily_breakdown)} days of data")


class TestInvalidUser:
    """Test error handling for invalid users"""
    
    def test_usage_history_invalid_user_returns_404(self):
        """Test usage-history returns 404 for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/prc-statement/usage-history/invalid-user-id-12345")
        assert response.status_code == 404
        print(f"✅ Invalid user returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
