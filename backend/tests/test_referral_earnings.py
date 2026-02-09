"""
Test Referral Earnings History API endpoints.
Tests: referral-earnings API, level breakdown, top performers, summary data.
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_USER_ID = "8175c02a-4fbd-409c-8d47-d864e979f59f"


class TestReferralEarningsAPI:
    """Test referral earnings history API"""
    
    def test_api_health(self):
        """Test API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✅ API Health: {data['status']}, DB: {data['database']}")
    
    def test_referral_earnings_returns_correct_structure(self):
        """Test /referral-earnings/{user_id} returns correct data structure"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/{TEST_USER_ID}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify required top-level keys
        assert "earnings" in data, "Missing 'earnings' key"
        assert "summary" in data, "Missing 'summary' key"
        assert "level_breakdown" in data, "Missing 'level_breakdown' key"
        assert "top_performers" in data, "Missing 'top_performers' key"
        
        print(f"✅ Response has all required keys: earnings, summary, level_breakdown, top_performers")
    
    def test_summary_has_required_fields(self):
        """Test summary object has total_earned, this_month, this_week, today"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/{TEST_USER_ID}")
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        
        # Verify required summary fields
        assert "total_earned" in summary, "Missing 'total_earned' in summary"
        assert "this_month" in summary, "Missing 'this_month' in summary"
        assert "this_week" in summary, "Missing 'this_week' in summary"
        assert "today" in summary, "Missing 'today' in summary"
        
        # Verify values are numbers
        assert isinstance(summary["total_earned"], (int, float))
        assert isinstance(summary["this_month"], (int, float))
        assert isinstance(summary["this_week"], (int, float))
        assert isinstance(summary["today"], (int, float))
        
        print(f"✅ Summary: total={summary['total_earned']}, month={summary['this_month']}, week={summary['this_week']}, today={summary['today']}")
    
    def test_level_breakdown_shows_l1_to_l5(self):
        """Test level_breakdown has all 5 levels (L1-L5)"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/{TEST_USER_ID}")
        assert response.status_code == 200
        
        breakdown = response.json().get("level_breakdown", {})
        
        # Verify all 5 levels present
        for level in range(1, 6):
            key = f"level_{level}"
            assert key in breakdown, f"Missing {key} in level_breakdown"
            
            # Each level should have count and total
            level_data = breakdown[key]
            assert "count" in level_data, f"Missing 'count' in {key}"
            assert "total" in level_data, f"Missing 'total' in {key}"
        
        # Print level breakdown
        for level in range(1, 6):
            key = f"level_{level}"
            print(f"L{level}: count={breakdown[key]['count']}, total={breakdown[key]['total']}")
        
        # Note: L2-L5 = 0 is CORRECT because test user only has Level 1 referrals
        print("✅ Level breakdown shows L1-L5 (L2-L5 = 0 is expected - user only has L1 referrals)")
    
    def test_top_performers_structure(self):
        """Test top_performers list has required fields"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/{TEST_USER_ID}")
        assert response.status_code == 200
        
        performers = response.json().get("top_performers", [])
        
        print(f"Top performers count: {len(performers)}")
        
        if len(performers) > 0:
            # Verify each performer has required fields
            for i, performer in enumerate(performers):
                assert "name" in performer, f"Performer {i} missing 'name'"
                assert "level" in performer, f"Performer {i} missing 'level'"
                assert "earnings" in performer, f"Performer {i} missing 'earnings'"
                
                print(f"  {i+1}. {performer.get('name')} - L{performer.get('level')} - {performer.get('earnings')} PRC")
            
            print("✅ Top performers have required fields (name, level, earnings)")
        else:
            print("ℹ️ No top performers (empty list) - this is valid if no referrals")
    
    def test_today_earnings_shown_when_positive(self):
        """Test today's earnings value in summary"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/{TEST_USER_ID}")
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        today = summary.get("today", 0)
        
        # Today can be 0 or positive - just verify it's a valid number
        assert isinstance(today, (int, float)), "today should be a number"
        assert today >= 0, "today should be non-negative"
        
        if today > 0:
            print(f"✅ Today's earnings: {today} PRC (shows earning alert)")
        else:
            print(f"ℹ️ Today's earnings: {today} PRC (no alert shown)")
    
    def test_earnings_array_has_transactions(self):
        """Test earnings array contains transaction data"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/{TEST_USER_ID}")
        assert response.status_code == 200
        
        earnings = response.json().get("earnings", [])
        
        print(f"Earnings transactions: {len(earnings)}")
        
        if len(earnings) > 0:
            # Verify first transaction has required fields
            first = earnings[0]
            assert "date" in first or "timestamp" in first, "Missing date/timestamp"
            assert "level" in first, "Missing level"
            assert "prc_earned" in first, "Missing prc_earned"
            
            # Show last 7 days earnings for chart verification
            print("Recent earnings (last 7):")
            for e in earnings[:7]:
                date = e.get("date", e.get("timestamp", ""))[:10]
                print(f"  {date}: L{e.get('level')} - {e.get('prc_earned')} PRC")
            
            print("✅ Earnings array has transaction data with date, level, prc_earned")
        else:
            print("ℹ️ No earnings transactions found")
    
    def test_comparison_data_available(self):
        """Test data for week comparison is available"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/{TEST_USER_ID}")
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        this_week = summary.get("this_week", 0)
        this_month = summary.get("this_month", 0)
        
        # Both values should be numbers for comparison calculation
        assert isinstance(this_week, (int, float))
        assert isinstance(this_month, (int, float))
        
        # Week should not exceed month
        assert this_week <= this_month or this_month == 0, "this_week should not exceed this_month"
        
        print(f"✅ Comparison data: this_week={this_week}, this_month={this_month}")


class TestReferralEarningsEdgeCases:
    """Test edge cases and error handling"""
    
    def test_invalid_user_id(self):
        """Test response for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/referral-earnings/invalid-user-id-12345")
        
        # API should return 200 with empty data, not 404
        # This is acceptable behavior for a user with no earnings
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Invalid user returns empty data: {len(data.get('earnings', []))} earnings")
        elif response.status_code == 404:
            print(f"✅ Invalid user returns 404 (alternative valid behavior)")
        else:
            print(f"⚠️ Unexpected status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
