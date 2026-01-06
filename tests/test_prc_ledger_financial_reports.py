"""
Test Suite for PRC Ledger, Financial Reports, and Auto-Categorization APIs
Tests the comprehensive accounting features:
1. PRC Ledger with DR/CR entries and INR value conversion (10 PRC = ₹1)
2. Monthly Financial Reports (P&L Statement, Balance Sheet, PRC Flow Report)
3. Auto Expense Categorization using keywords and amount patterns
"""

import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPRCLedger:
    """Test PRC Ledger API endpoints"""
    
    def test_get_prc_ledger_returns_summary_and_entries(self):
        """Test GET /api/admin/accounting/prc-ledger returns summary with INR values and entries"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/prc-ledger")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify summary structure
        assert "summary" in data, "Response should contain 'summary'"
        summary = data["summary"]
        assert "total_mined_prc" in summary, "Summary should have total_mined_prc"
        assert "total_mined_inr" in summary, "Summary should have total_mined_inr"
        assert "total_consumed_prc" in summary, "Summary should have total_consumed_prc"
        assert "total_consumed_inr" in summary, "Summary should have total_consumed_inr"
        assert "total_burned_prc" in summary, "Summary should have total_burned_prc"
        assert "total_burned_inr" in summary, "Summary should have total_burned_inr"
        assert "net_circulation_prc" in summary, "Summary should have net_circulation_prc"
        assert "conversion_rate" in summary, "Summary should have conversion_rate"
        
        # Verify conversion rate is correct
        assert summary["conversion_rate"] == "10 PRC = ₹1", f"Conversion rate should be '10 PRC = ₹1', got {summary['conversion_rate']}"
        
        # Verify entries structure
        assert "entries" in data, "Response should contain 'entries'"
        assert "pagination" in data, "Response should contain 'pagination'"
        
        print(f"✅ PRC Ledger summary: mined={summary['total_mined_prc']} PRC, consumed={summary['total_consumed_prc']} PRC")
    
    def test_prc_ledger_filter_credit_only(self):
        """Test GET /api/admin/accounting/prc-ledger with filter_type=credit shows only credits"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/prc-ledger", params={"filter_type": "credit"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        entries = data.get("entries", [])
        
        # All entries should be credits (CR)
        for entry in entries:
            assert entry.get("dr_cr") == "CR", f"Expected CR entry, got {entry.get('dr_cr')} for type {entry.get('type')}"
        
        print(f"✅ Credit filter returned {len(entries)} CR entries")
    
    def test_prc_ledger_filter_debit_only(self):
        """Test GET /api/admin/accounting/prc-ledger with filter_type=debit shows only debits"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/prc-ledger", params={"filter_type": "debit"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        entries = data.get("entries", [])
        
        # All entries should be debits (DR)
        for entry in entries:
            assert entry.get("dr_cr") == "DR", f"Expected DR entry, got {entry.get('dr_cr')} for type {entry.get('type')}"
        
        print(f"✅ Debit filter returned {len(entries)} DR entries")
    
    def test_prc_ledger_inr_conversion(self):
        """Test that INR values are correctly calculated (10 PRC = ₹1)"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/prc-ledger")
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        
        # Verify INR conversion (10 PRC = ₹1, so 1 PRC = ₹0.1)
        expected_mined_inr = round(summary["total_mined_prc"] * 0.1, 2)
        expected_consumed_inr = round(summary["total_consumed_prc"] * 0.1, 2)
        expected_burned_inr = round(summary["total_burned_prc"] * 0.1, 2)
        
        assert abs(summary["total_mined_inr"] - expected_mined_inr) < 0.01, f"Mined INR mismatch: {summary['total_mined_inr']} vs {expected_mined_inr}"
        assert abs(summary["total_consumed_inr"] - expected_consumed_inr) < 0.01, f"Consumed INR mismatch"
        assert abs(summary["total_burned_inr"] - expected_burned_inr) < 0.01, f"Burned INR mismatch"
        
        print(f"✅ INR conversion verified: {summary['total_mined_prc']} PRC = ₹{summary['total_mined_inr']}")
    
    def test_sync_prc_to_books(self):
        """Test POST /api/admin/accounting/sync-prc-to-books syncs PRC transactions to cash book"""
        response = requests.post(f"{BASE_URL}/api/admin/accounting/sync-prc-to-books", params={"admin_id": "test_admin"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should have 'success' field"
        assert data["success"] == True, "Sync should be successful"
        assert "totals" in data, "Response should have 'totals' field"
        
        print(f"✅ PRC sync completed: {data.get('message', 'OK')}")


class TestProfitLossStatement:
    """Test Profit & Loss Statement API"""
    
    def test_get_profit_loss_statement(self):
        """Test GET /api/admin/reports/profit-loss-statement returns income, expenses, net profit"""
        response = requests.get(f"{BASE_URL}/api/admin/reports/profit-loss-statement")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "report_type" in data, "Should have report_type"
        assert data["report_type"] == "Profit & Loss Statement"
        assert "period" in data, "Should have period"
        assert "income" in data, "Should have income"
        assert "expenses" in data, "Should have expenses"
        assert "net_profit" in data, "Should have net_profit"
        assert "profit_margin" in data, "Should have profit_margin"
        assert "prc_metrics" in data, "Should have prc_metrics"
        
        # Verify income structure
        income = data["income"]
        assert "categories" in income, "Income should have categories"
        assert "total" in income, "Income should have total"
        
        # Verify expenses structure
        expenses = data["expenses"]
        assert "categories" in expenses, "Expenses should have categories"
        assert "total" in expenses, "Expenses should have total"
        
        # Verify net profit calculation
        expected_net = income["total"] - expenses["total"]
        assert abs(data["net_profit"] - expected_net) < 0.01, f"Net profit mismatch: {data['net_profit']} vs {expected_net}"
        
        print(f"✅ P&L Statement: Income=₹{income['total']}, Expenses=₹{expenses['total']}, Net=₹{data['net_profit']}")
    
    def test_profit_loss_with_month_year(self):
        """Test P&L statement with specific month and year"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.get(f"{BASE_URL}/api/admin/reports/profit-loss-statement", 
                               params={"month": current_month, "year": current_year})
        assert response.status_code == 200
        
        data = response.json()
        assert data["month"] == current_month
        assert data["year"] == current_year
        
        print(f"✅ P&L for {data['period']} retrieved successfully")


class TestBalanceSheet:
    """Test Balance Sheet API"""
    
    def test_get_balance_sheet(self):
        """Test GET /api/admin/reports/balance-sheet returns assets, liabilities, equity"""
        response = requests.get(f"{BASE_URL}/api/admin/reports/balance-sheet")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert data["report_type"] == "Balance Sheet"
        assert "as_of_date" in data
        assert "assets" in data
        assert "liabilities" in data
        assert "equity" in data
        assert "balance_check" in data
        
        # Verify assets structure
        assets = data["assets"]
        assert "current_assets" in assets
        assert "cash_in_hand" in assets["current_assets"]
        assert "bank_balance" in assets["current_assets"]
        assert "total_assets" in assets
        
        # Verify liabilities structure
        liabilities = data["liabilities"]
        assert "current_liabilities" in liabilities
        assert "prc_redemption_liability" in liabilities["current_liabilities"]
        assert "prc_in_circulation" in liabilities["current_liabilities"]
        assert "total_liabilities" in liabilities
        
        # Verify equity structure
        equity = data["equity"]
        assert "capital" in equity
        assert "retained_earnings" in equity
        assert "total_equity" in equity
        
        # Verify balance check
        balance_check = data["balance_check"]
        assert "assets" in balance_check
        assert "liabilities_plus_equity" in balance_check
        assert "is_balanced" in balance_check
        
        print(f"✅ Balance Sheet: Assets=₹{assets['total_assets']}, Liabilities=₹{liabilities['total_liabilities']}, Equity=₹{equity['total_equity']}")
        print(f"   Balance check: {balance_check['is_balanced']}")


class TestPRCFlowReport:
    """Test PRC Flow Report API"""
    
    def test_get_prc_flow_report(self):
        """Test GET /api/admin/reports/prc-flow returns inflow, outflow, net flow breakdown"""
        response = requests.get(f"{BASE_URL}/api/admin/reports/prc-flow")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert data["report_type"] == "PRC Flow Report"
        assert "period" in data
        assert "inflow" in data
        assert "outflow" in data
        assert "net_flow" in data
        
        # Verify inflow structure
        inflow = data["inflow"]
        assert "breakdown" in inflow
        assert "total" in inflow
        assert "inr_value" in inflow
        
        # Verify outflow structure
        outflow = data["outflow"]
        assert "breakdown" in outflow
        assert "total" in outflow
        assert "inr_value" in outflow
        
        # Verify net flow
        net_flow = data["net_flow"]
        assert "prc" in net_flow
        assert "inr_value" in net_flow
        
        # Verify net flow calculation
        expected_net = inflow["total"] - outflow["total"]
        assert abs(net_flow["prc"] - expected_net) < 0.01, f"Net flow mismatch: {net_flow['prc']} vs {expected_net}"
        
        print(f"✅ PRC Flow: Inflow={inflow['total']} PRC, Outflow={outflow['total']} PRC, Net={net_flow['prc']} PRC")
    
    def test_prc_flow_with_month_year(self):
        """Test PRC flow report with specific month and year"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.get(f"{BASE_URL}/api/admin/reports/prc-flow",
                               params={"month": current_month, "year": current_year})
        assert response.status_code == 200
        
        data = response.json()
        assert data["month"] == current_month
        assert data["year"] == current_year
        
        print(f"✅ PRC Flow for {data['period']} retrieved successfully")


class TestAutoCategorization:
    """Test Auto Expense Categorization API"""
    
    def test_auto_categorize_rent(self):
        """Test POST /api/admin/accounting/auto-categorize with 'rent payment' description returns rent category"""
        response = requests.post(f"{BASE_URL}/api/admin/accounting/auto-categorize",
                                params={"description": "rent payment for office", "amount": 15000})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "suggested_category" in data
        assert data["suggested_category"] == "rent", f"Expected 'rent', got {data['suggested_category']}"
        assert data["suggested_type"] == "expense"
        assert data["confidence"] > 0
        
        print(f"✅ Auto-categorize 'rent payment': {data['suggested_category']} ({data['confidence']*100}% confidence)")
    
    def test_auto_categorize_salary(self):
        """Test POST /api/admin/accounting/auto-categorize with 'salary' description returns salary category"""
        response = requests.post(f"{BASE_URL}/api/admin/accounting/auto-categorize",
                                params={"description": "monthly salary payment", "amount": 25000})
        assert response.status_code == 200
        
        data = response.json()
        assert data["suggested_category"] == "salary", f"Expected 'salary', got {data['suggested_category']}"
        assert data["suggested_type"] == "expense"
        
        print(f"✅ Auto-categorize 'salary': {data['suggested_category']}")
    
    def test_auto_categorize_capital(self):
        """Test POST /api/admin/accounting/auto-categorize with 'capital investment' returns capital category"""
        response = requests.post(f"{BASE_URL}/api/admin/accounting/auto-categorize",
                                params={"description": "director capital investment", "amount": 100000})
        assert response.status_code == 200
        
        data = response.json()
        assert data["suggested_category"] == "capital", f"Expected 'capital', got {data['suggested_category']}"
        assert data["suggested_type"] == "income"
        
        print(f"✅ Auto-categorize 'capital investment': {data['suggested_category']} (type: {data['suggested_type']})")
    
    def test_auto_categorize_utilities(self):
        """Test auto-categorization for utilities"""
        response = requests.post(f"{BASE_URL}/api/admin/accounting/auto-categorize",
                                params={"description": "electricity bill payment", "amount": 5000})
        assert response.status_code == 200
        
        data = response.json()
        assert data["suggested_category"] == "utilities", f"Expected 'utilities', got {data['suggested_category']}"
        
        print(f"✅ Auto-categorize 'electricity': {data['suggested_category']}")
    
    def test_auto_categorize_vip_fee(self):
        """Test auto-categorization for VIP membership"""
        response = requests.post(f"{BASE_URL}/api/admin/accounting/auto-categorize",
                                params={"description": "vip membership fee received", "amount": 299})
        assert response.status_code == 200
        
        data = response.json()
        assert data["suggested_category"] == "vip_fee", f"Expected 'vip_fee', got {data['suggested_category']}"
        assert data["suggested_type"] == "income"
        
        print(f"✅ Auto-categorize 'vip membership': {data['suggested_category']}")
    
    def test_get_category_suggestions(self):
        """Test GET /api/admin/accounting/category-suggestions returns list of all categories"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/category-suggestions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "categories" in data
        
        categories = data["categories"]
        assert len(categories) > 0, "Should have at least one category"
        
        # Verify category structure
        for cat in categories:
            assert "id" in cat
            assert "label" in cat
            assert "keywords" in cat
            assert "type" in cat
        
        # Verify expected categories exist
        category_ids = [c["id"] for c in categories]
        expected_categories = ["rent", "salary", "capital", "utilities", "vip_fee", "marketing"]
        for expected in expected_categories:
            assert expected in category_ids, f"Expected category '{expected}' not found"
        
        print(f"✅ Category suggestions: {len(categories)} categories available")
        print(f"   Categories: {', '.join(category_ids)}")


class TestPRCLedgerEntryStructure:
    """Test PRC Ledger entry structure and data integrity"""
    
    def test_ledger_entry_has_required_fields(self):
        """Test that ledger entries have all required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/prc-ledger", params={"limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        if entries:
            entry = entries[0]
            required_fields = ["date", "description", "type", "prc_amount", "inr_value", "dr_cr"]
            for field in required_fields:
                assert field in entry, f"Entry missing required field: {field}"
            
            # Verify dr_cr is either CR or DR
            assert entry["dr_cr"] in ["CR", "DR"], f"dr_cr should be CR or DR, got {entry['dr_cr']}"
            
            print(f"✅ Ledger entry structure verified with {len(required_fields)} required fields")
        else:
            print("⚠️ No entries to verify structure (empty ledger)")
    
    def test_pagination_works(self):
        """Test pagination in PRC ledger"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/prc-ledger", params={"page": 1, "limit": 5})
        assert response.status_code == 200
        
        data = response.json()
        pagination = data["pagination"]
        
        assert pagination["page"] == 1
        assert pagination["limit"] == 5
        assert "total" in pagination
        assert "total_pages" in pagination
        
        print(f"✅ Pagination: page {pagination['page']}/{pagination['total_pages']}, total {pagination['total']} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
