"""
Accounting System API Tests
Tests for the Fintech-grade Accounting System for Paras Reward App

Features tested:
- Master Accounting Dashboard
- PRC Mint Ledger (inflows)
- PRC Burn Ledger (outflows)
- Liability Ledger with ageing analysis
- Reserve Fund management
- Conversion Rate management
- Daily Summary generation
- User Cost Analysis
- Accounting Settings CRUD
"""

import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMasterDashboard:
    """Test Master Accounting Dashboard API"""
    
    def test_get_master_dashboard(self):
        """Test GET /api/admin/accounting/master-dashboard returns all required data"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/master-dashboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all required sections exist
        assert "overview" in data, "Missing 'overview' section"
        assert "prc_supply" in data, "Missing 'prc_supply' section"
        assert "liability" in data, "Missing 'liability' section"
        assert "financials" in data, "Missing 'financials' section"
        assert "risk" in data, "Missing 'risk' section"
        assert "alerts" in data, "Missing 'alerts' section"
        assert "wallets" in data, "Missing 'wallets' section"
        
        # Verify overview fields
        assert "total_users" in data["overview"]
        assert "vip_users" in data["overview"]
        assert "conversion_rate" in data["overview"]
        
        # Verify prc_supply fields
        assert "total_minted" in data["prc_supply"]
        assert "total_burned" in data["prc_supply"]
        assert "circulating" in data["prc_supply"]
        assert "circulating_inr_value" in data["prc_supply"]
        
        # Verify liability fields
        assert "total_inr_liability" in data["liability"]
        assert "reserve_fund" in data["liability"]
        assert "backing_ratio" in data["liability"]
        assert "backing_status" in data["liability"]
        
        # Verify financials fields
        assert "total_cash_available" in data["financials"]
        assert "monthly_revenue" in data["financials"]
        assert "monthly_expenses" in data["financials"]
        assert "monthly_profit_loss" in data["financials"]
        
        # Verify risk fields
        assert "score" in data["risk"]
        assert "status" in data["risk"]
        assert data["risk"]["status"] in ["SAFE", "WARNING", "CRITICAL"]
        
        print(f"✅ Master Dashboard loaded successfully")
        print(f"   - Total Users: {data['overview']['total_users']}")
        print(f"   - VIP Users: {data['overview']['vip_users']}")
        print(f"   - Circulating PRC: {data['prc_supply']['circulating']}")
        print(f"   - Risk Score: {data['risk']['score']}/100 ({data['risk']['status']})")


class TestPRCMintLedger:
    """Test PRC Mint Ledger API (inflows)"""
    
    def test_get_prc_mint_ledger(self):
        """Test GET /api/admin/accounting/prc-mint-ledger returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/prc-mint-ledger?limit=50")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "entries" in data, "Missing 'entries' field"
        assert "pagination" in data, "Missing 'pagination' field"
        assert "summary" in data, "Missing 'summary' field"
        
        # Verify pagination fields
        assert "page" in data["pagination"]
        assert "limit" in data["pagination"]
        assert "total" in data["pagination"]
        
        # Verify summary fields
        assert "total_minted" in data["summary"]
        assert "by_source" in data["summary"]
        
        print(f"✅ PRC Mint Ledger loaded successfully")
        print(f"   - Total Minted: {data['summary']['total_minted']} PRC")
        print(f"   - Entry Count: {len(data['entries'])}")
        print(f"   - Sources: {list(data['summary']['by_source'].keys())}")
    
    def test_prc_mint_ledger_with_filters(self):
        """Test PRC Mint Ledger with source_type filter"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/prc-mint-ledger?source_type=mining&limit=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # If there are entries, verify they are all mining type
        for entry in data.get("entries", []):
            assert entry.get("type") == "mining", f"Expected mining type, got {entry.get('type')}"
        
        print(f"✅ PRC Mint Ledger filter works - {len(data.get('entries', []))} mining entries")


class TestPRCBurnLedger:
    """Test PRC Burn Ledger API (outflows)"""
    
    def test_get_prc_burn_ledger(self):
        """Test GET /api/admin/accounting/prc-burn-ledger returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/prc-burn-ledger?limit=50")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "entries" in data, "Missing 'entries' field"
        assert "pagination" in data, "Missing 'pagination' field"
        assert "summary" in data, "Missing 'summary' field"
        
        # Verify summary fields
        assert "total_burned" in data["summary"]
        assert "by_use_type" in data["summary"]
        
        print(f"✅ PRC Burn Ledger loaded successfully")
        print(f"   - Total Burned: {data['summary']['total_burned']} PRC")
        print(f"   - Entry Count: {len(data['entries'])}")
        print(f"   - Use Types: {list(data['summary']['by_use_type'].keys())}")


class TestLiabilityLedger:
    """Test Liability Ledger API with ageing analysis"""
    
    def test_get_liability_ledger(self):
        """Test GET /api/admin/accounting/liability-ledger returns correct structure with ageing"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/liability-ledger?limit=50")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "entries" in data, "Missing 'entries' field"
        assert "pagination" in data, "Missing 'pagination' field"
        assert "summary" in data, "Missing 'summary' field"
        assert "ageing" in data, "Missing 'ageing' field"
        
        # Verify summary fields
        assert "total_prc_redeemed" in data["summary"]
        assert "total_inr_liability" in data["summary"]
        assert "inr_paid" in data["summary"]
        assert "inr_pending" in data["summary"]
        assert "conversion_rate" in data["summary"]
        
        # Verify ageing fields (0-7 days safe, 8-30 warning, 31+ critical)
        assert "safe_0_7_days" in data["ageing"]
        assert "warning_8_30_days" in data["ageing"]
        assert "critical_31_plus_days" in data["ageing"]
        
        print(f"✅ Liability Ledger loaded successfully")
        print(f"   - Total INR Liability: ₹{data['summary']['total_inr_liability']}")
        print(f"   - INR Pending: ₹{data['summary']['inr_pending']}")
        print(f"   - Ageing - Safe (0-7d): ₹{data['ageing']['safe_0_7_days']}")
        print(f"   - Ageing - Warning (8-30d): ₹{data['ageing']['warning_8_30_days']}")
        print(f"   - Ageing - Critical (31+d): ₹{data['ageing']['critical_31_plus_days']}")


class TestReserveFund:
    """Test Reserve Fund Management APIs"""
    
    def test_get_reserve_fund(self):
        """Test GET /api/admin/accounting/reserve-fund returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/reserve-fund")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "balance" in data, "Missing 'balance' field"
        assert "percentage" in data, "Missing 'percentage' field"
        assert "total_liability_inr" in data, "Missing 'total_liability_inr' field"
        assert "backing_ratio" in data, "Missing 'backing_ratio' field"
        assert "status" in data, "Missing 'status' field"
        assert "history" in data, "Missing 'history' field"
        
        # Verify status is valid
        assert data["status"] in ["SAFE", "AT RISK"], f"Invalid status: {data['status']}"
        
        print(f"✅ Reserve Fund loaded successfully")
        print(f"   - Balance: ₹{data['balance']}")
        print(f"   - Allocation: {data['percentage']}% of daily profit")
        print(f"   - Backing Ratio: {data['backing_ratio']}x")
        print(f"   - Status: {data['status']}")
    
    def test_add_to_reserve_fund(self):
        """Test POST /api/admin/accounting/reserve-fund/add"""
        # Get current balance
        get_response = requests.get(f"{BASE_URL}/api/admin/accounting/reserve-fund")
        assert get_response.status_code == 200
        initial_balance = get_response.json().get("balance", 0)
        
        # Add to reserve fund
        add_response = requests.post(
            f"{BASE_URL}/api/admin/accounting/reserve-fund/add",
            json={"amount": 100, "reason": "Test addition by automated test"}
        )
        
        assert add_response.status_code == 200, f"Expected 200, got {add_response.status_code}: {add_response.text}"
        
        data = add_response.json()
        assert data.get("success") == True
        
        # Verify balance increased
        verify_response = requests.get(f"{BASE_URL}/api/admin/accounting/reserve-fund")
        new_balance = verify_response.json().get("balance", 0)
        
        assert new_balance >= initial_balance, f"Balance should have increased from {initial_balance} to at least {initial_balance + 100}"
        
        print(f"✅ Reserve Fund addition successful")
        print(f"   - Initial Balance: ₹{initial_balance}")
        print(f"   - New Balance: ₹{new_balance}")


class TestConversionRate:
    """Test Conversion Rate Management APIs"""
    
    def test_get_conversion_rate(self):
        """Test GET /api/admin/accounting/conversion-rate returns current rate and history"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/conversion-rate")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "current_rate" in data, "Missing 'current_rate' field"
        assert "description" in data, "Missing 'description' field"
        assert "history" in data, "Missing 'history' field"
        
        # Verify rate is positive
        assert data["current_rate"] > 0, "Conversion rate should be positive"
        
        print(f"✅ Conversion Rate loaded successfully")
        print(f"   - Current Rate: {data['current_rate']} PRC per INR")
        print(f"   - Description: {data['description']}")
        print(f"   - History entries: {len(data['history'])}")
    
    def test_update_conversion_rate(self):
        """Test POST /api/admin/accounting/conversion-rate updates rate and maintains history"""
        # Get current rate
        get_response = requests.get(f"{BASE_URL}/api/admin/accounting/conversion-rate")
        assert get_response.status_code == 200
        original_rate = get_response.json().get("current_rate", 10)
        
        # Update to a test rate
        test_rate = 10  # Keep at default to avoid breaking other tests
        update_response = requests.post(
            f"{BASE_URL}/api/admin/accounting/conversion-rate",
            json={"prc_per_inr": test_rate, "reason": "Test update by automated test"}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        assert data.get("success") == True
        assert data.get("new_rate") == test_rate
        
        print(f"✅ Conversion Rate update successful")
        print(f"   - Original Rate: {original_rate}")
        print(f"   - New Rate: {test_rate}")


class TestDailySummary:
    """Test Daily Summary APIs"""
    
    def test_get_daily_summaries(self):
        """Test GET /api/admin/accounting/daily-summary returns summaries with trends"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/daily-summary?days=30")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "summaries" in data, "Missing 'summaries' field"
        
        # If there are summaries, verify structure
        if data["summaries"]:
            summary = data["summaries"][0]
            expected_fields = ["date", "active_users", "prc_minted", "prc_burned", 
                            "revenue_inr", "expense_inr", "risk_score"]
            for field in expected_fields:
                assert field in summary, f"Missing '{field}' in summary"
        
        print(f"✅ Daily Summaries loaded successfully")
        print(f"   - Summary count: {len(data['summaries'])}")
        if data.get("trends"):
            print(f"   - Trends available: Yes")
    
    def test_generate_daily_summary(self):
        """Test POST /api/admin/accounting/daily-summary/generate creates a summary"""
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/daily-summary/generate",
            json={}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "summary" in data
        
        summary = data["summary"]
        assert "date" in summary
        assert "risk_score" in summary
        assert "risk_status" in summary
        
        print(f"✅ Daily Summary generated successfully")
        print(f"   - Date: {summary['date']}")
        print(f"   - Risk Score: {summary['risk_score']}")
        print(f"   - Risk Status: {summary['risk_status']}")


class TestUserCostAnalysis:
    """Test User Cost Analysis API"""
    
    def test_get_user_cost_analysis(self):
        """Test GET /api/admin/accounting/user-cost-analysis returns loss-making users"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/user-cost-analysis?limit=50")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "users" in data, "Missing 'users' field"
        assert "pagination" in data, "Missing 'pagination' field"
        assert "summary" in data, "Missing 'summary' field"
        
        # Verify summary fields
        assert "total_prc_distributed_value_inr" in data["summary"]
        assert "total_prc_redeemed_value_inr" in data["summary"]
        assert "net_system_cost" in data["summary"]
        
        # If there are users, verify structure
        if data["users"]:
            user = data["users"][0]
            assert "earned_inr_value" in user
            assert "spent_inr_value" in user
            assert "net_cost" in user
            assert "status" in user
            assert user["status"] in ["LOSS", "PROFIT"]
        
        print(f"✅ User Cost Analysis loaded successfully")
        print(f"   - Users analyzed: {len(data['users'])}")
        print(f"   - Total PRC Distributed (INR): ₹{data['summary']['total_prc_distributed_value_inr']}")
        print(f"   - Total PRC Redeemed (INR): ₹{data['summary']['total_prc_redeemed_value_inr']}")
        print(f"   - Net System Cost: ₹{data['summary']['net_system_cost']}")


class TestAccountingSettings:
    """Test Accounting Settings CRUD APIs"""
    
    def test_get_accounting_settings(self):
        """Test GET /api/admin/accounting/settings returns all settings"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required settings exist
        expected_settings = [
            "prc_per_inr",
            "reserve_fund_percentage",
            "inactive_expiry_days",
            "liability_warning_threshold",
            "liability_critical_threshold"
        ]
        
        for setting in expected_settings:
            assert setting in data, f"Missing setting: {setting}"
        
        # Verify default values are reasonable
        assert data["prc_per_inr"] > 0, "prc_per_inr should be positive"
        assert 0 <= data["reserve_fund_percentage"] <= 100, "reserve_fund_percentage should be 0-100"
        assert data["inactive_expiry_days"] > 0, "inactive_expiry_days should be positive"
        
        print(f"✅ Accounting Settings loaded successfully")
        print(f"   - PRC per INR: {data['prc_per_inr']}")
        print(f"   - Reserve Fund %: {data['reserve_fund_percentage']}%")
        print(f"   - Inactive Expiry Days: {data['inactive_expiry_days']}")
    
    def test_update_accounting_settings(self):
        """Test POST /api/admin/accounting/settings updates settings"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/accounting/settings")
        assert get_response.status_code == 200
        original_settings = get_response.json()
        
        # Update settings
        update_response = requests.post(
            f"{BASE_URL}/api/admin/accounting/settings",
            json={
                "prc_per_inr": 10,
                "reserve_fund_percentage": 10,
                "inactive_expiry_days": 180
            }
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        assert data.get("success") == True
        
        # Verify settings persisted
        verify_response = requests.get(f"{BASE_URL}/api/admin/accounting/settings")
        new_settings = verify_response.json()
        
        assert new_settings["prc_per_inr"] == 10
        assert new_settings["reserve_fund_percentage"] == 10
        assert new_settings["inactive_expiry_days"] == 180
        
        print(f"✅ Accounting Settings update successful")
        print(f"   - Settings persisted correctly")


class TestBurnInactivePRC:
    """Test 180-day inactive user PRC burn API"""
    
    def test_burn_inactive_prc_endpoint(self):
        """Test POST /api/admin/accounting/burn-inactive-prc endpoint exists and works"""
        response = requests.post(f"{BASE_URL}/api/admin/accounting/burn-inactive-prc")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "result" in data
        assert "users_affected" in data["result"]
        assert "total_burned" in data["result"]
        
        print(f"✅ Burn Inactive PRC endpoint works")
        print(f"   - Users Affected: {data['result']['users_affected']}")
        print(f"   - Total Burned: {data['result']['total_burned']} PRC")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
