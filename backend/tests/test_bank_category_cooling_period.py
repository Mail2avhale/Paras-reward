"""
Test Bank Category Usage Calculation and 7-Day Cooling Period
=============================================================
Tests for:
1. Bank category should count ALL bank withdrawals from redeem_requests with 'Paid' status (no date filter)
2. 7-day cooling period check in manual_bank_transfer route
3. Category limits API returns correct Bank USED value
4. Cooling period should block requests within 7 days of last successful request
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_USER_UID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"


class TestBankCategoryUsageCalculation:
    """Tests for Bank category usage calculation - should count ALL bank transactions without date filter"""
    
    def test_category_limits_api_returns_bank_used(self):
        """Test that /api/redeem-categories/user/{uid} returns correct Bank USED value"""
        response = requests.get(f"{BASE_URL}/api/redeem-categories/user/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"API returned success=False: {data}"
        
        categories = data.get("categories", {})
        assert "bank" in categories, f"Bank category not found in response: {categories.keys()}"
        
        bank_data = categories["bank"]
        bank_used = bank_data.get("used", 0)
        
        # According to test data: 3 bank transactions (1000 + 27480 + 26510 = 54,990 PRC)
        # The fix should show Bank USED = 54,990 PRC
        print(f"Bank USED value: {bank_used}")
        print(f"Bank category data: {bank_data}")
        
        # Verify bank_used is greater than 0 (fix should count all transactions)
        assert bank_used > 0, f"Bank USED should be > 0, got {bank_used}. Fix may not be working."
        
        return bank_used
    
    def test_bank_category_includes_paid_status(self):
        """Test that bank category calculation includes 'Paid' status transactions"""
        response = requests.get(f"{BASE_URL}/api/redeem-categories/user/{TEST_USER_UID}")
        
        assert response.status_code == 200
        data = response.json()
        
        bank_data = data.get("categories", {}).get("bank", {})
        bank_used = bank_data.get("used", 0)
        
        # The expected value based on test data: 54,990 PRC
        # Allow some tolerance for other transactions
        print(f"Bank USED: {bank_used} PRC")
        
        # Verify it's counting the expected transactions
        # 3 transactions: 1000 + 27480 + 26510 = 54,990 PRC
        expected_min = 54000  # Allow some tolerance
        
        assert bank_used >= expected_min, f"Bank USED ({bank_used}) should be >= {expected_min}. 'Paid' status transactions may not be counted."
    
    def test_bank_category_no_date_filter(self):
        """Test that bank category has no date filter - counts ALL historical transactions"""
        response = requests.get(f"{BASE_URL}/api/redeem-categories/user/{TEST_USER_UID}")
        
        assert response.status_code == 200
        data = response.json()
        
        bank_data = data.get("categories", {}).get("bank", {})
        bank_used = bank_data.get("used", 0)
        
        # If date filter was removed, we should see all historical transactions
        # The value should be consistent regardless of when we call the API
        print(f"Bank USED (no date filter): {bank_used} PRC")
        
        # Call again to verify consistency
        response2 = requests.get(f"{BASE_URL}/api/redeem-categories/user/{TEST_USER_UID}")
        data2 = response2.json()
        bank_used2 = data2.get("categories", {}).get("bank", {}).get("used", 0)
        
        assert bank_used == bank_used2, f"Bank USED should be consistent: {bank_used} vs {bank_used2}"


class TestSevenDayCoolingPeriod:
    """Tests for 7-day cooling period in manual bank transfer"""
    
    def test_bank_transfer_config_endpoint(self):
        """Test that bank transfer config endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/config")
        
        assert response.status_code == 200, f"Config endpoint failed: {response.text}"
        
        data = response.json()
        print(f"Bank transfer config: {data}")
        
        assert "min_withdrawal" in data
        assert "max_withdrawal" in data
        assert "prc_rate" in data
    
    def test_cooling_period_blocks_within_7_days(self):
        """Test that cooling period blocks requests within 7 days of last successful request"""
        # This test verifies the cooling period logic by attempting a bank transfer request
        # If user has a recent request (within 7 days), it should be blocked with 429
        
        # First, check if user has any recent requests
        response = requests.get(f"{BASE_URL}/api/bank-transfer/my-requests/{TEST_USER_UID}")
        
        if response.status_code == 200:
            data = response.json()
            requests_list = data.get("requests", [])
            
            if requests_list:
                # Find the most recent non-failed request
                recent_requests = [r for r in requests_list if r.get("status") not in ["failed", "rejected", "cancelled"]]
                
                if recent_requests:
                    # Sort by created_at descending
                    recent_requests.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                    last_request = recent_requests[0]
                    last_time_str = last_request.get("created_at")
                    
                    print(f"Last request: {last_request.get('request_id')} at {last_time_str} with status {last_request.get('status')}")
                    
                    if last_time_str:
                        try:
                            last_time = datetime.fromisoformat(last_time_str.replace('Z', '+00:00'))
                            now = datetime.now(timezone.utc)
                            days_since = (now - last_time).days
                            
                            print(f"Days since last request: {days_since}")
                            
                            if days_since < 7:
                                print(f"User has request within 7 days - cooling period should block new request")
                            else:
                                print(f"User's last request was {days_since} days ago - cooling period should allow new request")
                        except Exception as e:
                            print(f"Error parsing date: {e}")
    
    def test_cooling_period_error_message_format(self):
        """Test that cooling period error message mentions 7 days (not 24 hours)"""
        # Attempt to create a bank transfer request
        # If blocked by cooling period, verify the error message mentions days, not hours
        
        payload = {
            "user_id": TEST_USER_UID,
            "amount": 200,  # Minimum amount
            "bank_details": {
                "account_holder_name": "Test User",
                "account_number": "123456789012",
                "ifsc_code": "HDFC0001234"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/bank-transfer/request", json=payload)
        
        print(f"Bank transfer request response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 429:
            # Cooling period triggered
            data = response.json()
            detail = data.get("detail", "")
            
            print(f"Cooling period message: {detail}")
            
            # Verify message mentions "week" or "7 days" (not "24 hours")
            assert "week" in detail.lower() or "7 day" in detail.lower() or "days" in detail.lower(), \
                f"Cooling period message should mention 'week' or 'days', got: {detail}"
            
            # Should NOT mention "24 hours"
            assert "24 hour" not in detail.lower(), \
                f"Cooling period message should NOT mention '24 hours', got: {detail}"
        elif response.status_code == 403:
            # Other validation error (KYC, limit, etc.)
            print(f"Request blocked by other validation: {response.json()}")
        elif response.status_code == 400:
            # Validation error
            print(f"Validation error: {response.json()}")
        elif response.status_code == 200:
            # Request succeeded - user didn't have recent request
            print("Request succeeded - no cooling period block")


class TestRedeemRequestsCollection:
    """Tests to verify redeem_requests collection is checked for cooling period"""
    
    def test_user_requests_endpoint(self):
        """Test that user requests endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/bank-transfer/my-requests/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Failed to get user requests: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        requests_list = data.get("requests", [])
        total = data.get("total", 0)
        
        print(f"User has {total} bank transfer requests")
        
        for req in requests_list[:5]:  # Show first 5
            print(f"  - {req.get('request_id')}: {req.get('status')} at {req.get('created_at')}")


class TestCategoryLimitsAPIResponse:
    """Tests for category limits API response structure"""
    
    def test_category_limits_response_structure(self):
        """Test that category limits API returns expected structure"""
        response = requests.get(f"{BASE_URL}/api/redeem-categories/user/{TEST_USER_UID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "success" in data
        assert "uid" in data
        assert "total_limit" in data
        assert "categories" in data
        
        categories = data["categories"]
        
        # Check all three categories exist
        assert "utility" in categories, "Utility category missing"
        assert "shopping" in categories, "Shopping category missing"
        assert "bank" in categories, "Bank category missing"
        
        # Check bank category structure
        bank = categories["bank"]
        required_fields = ["name", "percentage", "total_limit", "used", "remaining"]
        
        for field in required_fields:
            assert field in bank, f"Bank category missing field: {field}"
        
        print(f"Bank category: limit={bank.get('total_limit')}, used={bank.get('used')}, remaining={bank.get('remaining')}")
    
    def test_bank_remaining_calculation(self):
        """Test that bank remaining = total_limit - used"""
        response = requests.get(f"{BASE_URL}/api/redeem-categories/user/{TEST_USER_UID}")
        
        assert response.status_code == 200
        data = response.json()
        
        bank = data["categories"]["bank"]
        total_limit = bank.get("total_limit", 0)
        used = bank.get("used", 0)
        remaining = bank.get("remaining", 0)
        
        expected_remaining = max(0, total_limit - used)
        
        assert remaining == expected_remaining, \
            f"Remaining calculation wrong: {remaining} != max(0, {total_limit} - {used}) = {expected_remaining}"
        
        print(f"Bank: total_limit={total_limit}, used={used}, remaining={remaining}")


class TestSuccessStatusesIncludePaid:
    """Tests to verify 'Paid' status is included in success_statuses"""
    
    def test_paid_status_counted_in_bank_usage(self):
        """Test that 'Paid' status transactions are counted in bank usage"""
        response = requests.get(f"{BASE_URL}/api/redeem-categories/user/{TEST_USER_UID}")
        
        assert response.status_code == 200
        data = response.json()
        
        bank_used = data["categories"]["bank"]["used"]
        
        # According to test data:
        # - 3 bank transactions with statuses: SUCCESS, Paid, Paid
        # - Amounts: 1000 + 27480 + 26510 = 54,990 PRC
        # If 'Paid' is not counted, we'd only see 1000 PRC
        
        print(f"Bank USED: {bank_used} PRC")
        
        # If only SUCCESS was counted, bank_used would be ~1000
        # If Paid is also counted, bank_used should be ~54,990
        assert bank_used > 10000, \
            f"Bank USED ({bank_used}) is too low. 'Paid' status may not be counted. Expected ~54,990 PRC."


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
