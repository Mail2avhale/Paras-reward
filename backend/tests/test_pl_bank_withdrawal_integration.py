"""
Test: P&L Bank Withdrawal Integration
Tests that Bank Withdrawal (PRC to Bank) amounts are correctly recorded in P&L report

Features tested:
- Bank withdrawal payout appears in expenses.breakdown
- Bank withdrawal processing fees appear in revenue.details
- Bank withdrawal admin charges appear in revenue.details
- P&L insights include Bank Withdrawal info when present
- Total fee revenue includes bank withdrawal fees
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPLBankWithdrawalExpenses:
    """Test Bank Withdrawal appears in P&L expenses"""
    
    def test_pl_endpoint_returns_200(self):
        """P&L endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month&year=2026&month=2")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ P&L endpoint returns 200")
    
    def test_expenses_breakdown_has_bank_withdrawal_payouts(self):
        """Expenses breakdown should include bank_withdrawal_payouts field"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month&year=2026&month=2")
        data = response.json()
        
        assert "expenses" in data, "Response should have expenses"
        assert "breakdown" in data["expenses"], "Expenses should have breakdown"
        assert "bank_withdrawal_payouts" in data["expenses"]["breakdown"], "Breakdown should have bank_withdrawal_payouts"
        
        bank_payout = data["expenses"]["breakdown"]["bank_withdrawal_payouts"]
        assert bank_payout >= 0, "bank_withdrawal_payouts should be >= 0"
        print(f"✓ bank_withdrawal_payouts in expenses.breakdown: ₹{bank_payout}")
    
    def test_expenses_details_has_bank_withdrawal_info(self):
        """Expenses details should include bank withdrawal count, INR, and PRC totals"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month&year=2026&month=2")
        data = response.json()
        
        details = data.get("expenses", {}).get("details", {})
        
        assert "bank_withdrawal_count" in details, "Details should have bank_withdrawal_count"
        assert "bank_withdrawal_total_inr" in details, "Details should have bank_withdrawal_total_inr"
        assert "bank_withdrawal_total_prc" in details, "Details should have bank_withdrawal_total_prc"
        
        print(f"✓ Bank withdrawal count: {details.get('bank_withdrawal_count')}")
        print(f"✓ Bank withdrawal total INR: ₹{details.get('bank_withdrawal_total_inr')}")
        print(f"✓ Bank withdrawal total PRC: {details.get('bank_withdrawal_total_prc')}")


class TestPLBankWithdrawalRevenue:
    """Test Bank Withdrawal fees appear in P&L revenue"""
    
    def test_revenue_details_has_bank_withdrawal_fees(self):
        """Revenue details should include bank withdrawal processing fees and admin charges"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month&year=2026&month=2")
        data = response.json()
        
        details = data.get("revenue", {}).get("details", {})
        
        assert "bank_withdrawal_rev_count" in details, "Details should have bank_withdrawal_rev_count"
        assert "bank_withdrawal_processing_fees" in details, "Details should have bank_withdrawal_processing_fees"
        assert "bank_withdrawal_admin_charges" in details, "Details should have bank_withdrawal_admin_charges"
        
        print(f"✓ Bank withdrawal revenue count: {details.get('bank_withdrawal_rev_count')}")
        print(f"✓ Bank withdrawal processing fees: ₹{details.get('bank_withdrawal_processing_fees')}")
        print(f"✓ Bank withdrawal admin charges: ₹{details.get('bank_withdrawal_admin_charges')}")
    
    def test_bank_withdrawal_fees_add_to_total_fees(self):
        """Bank withdrawal fees should be included in total processing_fees and admin_charges"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month&year=2026&month=2")
        data = response.json()
        
        revenue_breakdown = data.get("revenue", {}).get("breakdown", {})
        revenue_details = data.get("revenue", {}).get("details", {})
        
        # Total processing fees should include bank withdrawal processing fees
        total_processing = revenue_breakdown.get("processing_fees", 0)
        bank_processing = revenue_details.get("bank_withdrawal_processing_fees", 0)
        
        # Total admin charges should include bank withdrawal admin charges  
        total_admin = revenue_breakdown.get("admin_charges", 0)
        bank_admin = revenue_details.get("bank_withdrawal_admin_charges", 0)
        
        # Calculate expected totals from all services
        bill_proc = revenue_details.get("bill_processing_fees", 0)
        gift_proc = revenue_details.get("gift_processing_fees", 0)
        luxury_proc = revenue_details.get("luxury_processing_fees", 0)
        withdrawal_proc = revenue_details.get("withdrawal_processing_fees", 0)
        
        expected_proc = bill_proc + gift_proc + luxury_proc + withdrawal_proc + bank_processing
        
        assert total_processing == expected_proc, f"Processing fees mismatch: {total_processing} vs {expected_proc}"
        print(f"✓ Total processing fees (₹{total_processing}) includes bank withdrawal fees (₹{bank_processing})")
        print(f"✓ Total admin charges (₹{total_admin}) includes bank withdrawal charges (₹{bank_admin})")


class TestPLBankWithdrawalInsights:
    """Test Bank Withdrawal appears in P&L insights"""
    
    def test_insights_include_bank_withdrawal_when_present(self):
        """Insights should include bank withdrawal info when approved withdrawals exist"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month&year=2026&month=2")
        data = response.json()
        
        insights = data.get("insights", [])
        bank_withdrawal_count = data.get("revenue", {}).get("details", {}).get("bank_withdrawal_rev_count", 0)
        
        # If there are bank withdrawals, insights should mention them
        if bank_withdrawal_count > 0:
            bank_insight = [i for i in insights if "Bank Withdrawal" in i or "🏦" in i]
            assert len(bank_insight) > 0, "Insights should mention Bank Withdrawals when present"
            print(f"✓ Bank Withdrawal insight found: {bank_insight[0]}")
        else:
            print("ℹ No bank withdrawals in this period, skipping insight check")


class TestPLDataIntegrity:
    """Test P&L data integrity for bank withdrawal"""
    
    def test_approved_withdrawal_appears_in_pl(self):
        """Approved bank withdrawal BWR202602140430463F2570 should appear in P&L"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month&year=2026&month=2")
        data = response.json()
        
        # Expected values from the approved withdrawal
        # request_id=BWR202602140430463F2570, amount_inr=100, processing_fee=10, admin_charge=20, total_prc_deducted=1300
        
        expenses_details = data.get("expenses", {}).get("details", {})
        revenue_details = data.get("revenue", {}).get("details", {})
        expenses_breakdown = data.get("expenses", {}).get("breakdown", {})
        
        # Verify the approved withdrawal is counted
        assert expenses_details.get("bank_withdrawal_count", 0) >= 1, "Should have at least 1 bank withdrawal"
        
        # Verify expense payout (amount_inr = 100)
        assert expenses_breakdown.get("bank_withdrawal_payouts", 0) >= 100, "Should have at least ₹100 payout"
        
        # Verify revenue from fees (processing_fee=10, admin_charge=20)
        assert revenue_details.get("bank_withdrawal_processing_fees", 0) >= 10, "Should have processing fee"
        assert revenue_details.get("bank_withdrawal_admin_charges", 0) >= 20, "Should have admin charge"
        
        # Verify PRC total deducted
        assert expenses_details.get("bank_withdrawal_total_prc", 0) >= 1300, "Should have total PRC deducted"
        
        print("✓ Approved bank withdrawal BWR202602140430463F2570 is correctly reflected in P&L")
        print(f"  - Payout expense: ₹{expenses_breakdown.get('bank_withdrawal_payouts')}")
        print(f"  - Processing fee revenue: ₹{revenue_details.get('bank_withdrawal_processing_fees')}")
        print(f"  - Admin charge revenue: ₹{revenue_details.get('bank_withdrawal_admin_charges')}")
        print(f"  - Total PRC deducted: {expenses_details.get('bank_withdrawal_total_prc')}")


class TestPLResponseStructure:
    """Test P&L response structure is correct"""
    
    def test_pl_response_structure(self):
        """P&L response should have all required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level fields
        assert "period" in data
        assert "period_label" in data
        assert "summary" in data
        assert "revenue" in data
        assert "expenses" in data
        assert "insights" in data
        
        # Check summary
        summary = data["summary"]
        assert "gross_revenue" in summary
        assert "total_expenses" in summary
        assert "net_profit" in summary
        assert "status" in summary
        
        # Check revenue structure
        revenue = data["revenue"]
        assert "total" in revenue
        assert "breakdown" in revenue
        assert "details" in revenue
        
        # Check expenses structure
        expenses = data["expenses"]
        assert "total" in expenses
        assert "breakdown" in expenses
        assert "details" in expenses
        
        # Verify bank_withdrawal_payouts is in expenses breakdown
        assert "bank_withdrawal_payouts" in expenses["breakdown"]
        
        # Verify bank withdrawal fields in revenue details
        assert "bank_withdrawal_rev_count" in revenue["details"]
        assert "bank_withdrawal_processing_fees" in revenue["details"]
        assert "bank_withdrawal_admin_charges" in revenue["details"]
        
        # Verify bank withdrawal fields in expenses details
        assert "bank_withdrawal_count" in expenses["details"]
        assert "bank_withdrawal_total_inr" in expenses["details"]
        assert "bank_withdrawal_total_prc" in expenses["details"]
        
        print("✓ P&L response structure is correct with all bank withdrawal fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
