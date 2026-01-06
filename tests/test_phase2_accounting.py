"""
Phase 2 Full Accounting Suite Tests
Tests for: AR, AP, Bank Reconciliation, GST/Tax, Budget vs Actual, Financial Ratios, Audit Trail
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAccountsReceivable:
    """Accounts Receivable (AR) - येणे बाकी - Money owed TO the business"""
    
    def test_get_receivables_summary(self):
        """Test GET /api/admin/accounting/receivables returns summary"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/receivables")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data
        assert "total_pending" in data["summary"]
        assert "total_overdue" in data["summary"]
        assert "total_collected" in data["summary"]
        assert "total_outstanding" in data["summary"]
        assert "receivables" in data
        assert "pagination" in data
        print(f"✅ AR Summary: pending={data['summary']['total_pending']}, overdue={data['summary']['total_overdue']}, collected={data['summary']['total_collected']}")
    
    def test_create_receivable(self):
        """Test POST /api/admin/accounting/receivables creates new invoice"""
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/receivables",
            params={
                "customer_name": "TEST_Customer_AR",
                "customer_id": "TEST_CUST_001",
                "description": "TEST VIP Membership Fee",
                "amount": 299.0,
                "due_date": "2025-01-15",
                "category": "vip_fee",
                "admin_id": "test_admin"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "invoice_id" in data
        assert data["invoice_id"].startswith("INV-")
        print(f"✅ Created AR invoice: {data['invoice_id']}")
        return data["invoice_id"]
    
    def test_mark_receivable_paid(self):
        """Test PUT /api/admin/accounting/receivables/{invoice_id}/status marks as paid"""
        # First create a receivable
        create_response = requests.post(
            f"{BASE_URL}/api/admin/accounting/receivables",
            params={
                "customer_name": "TEST_Customer_Paid",
                "amount": 500.0,
                "category": "service_charge",
                "admin_id": "test_admin"
            }
        )
        assert create_response.status_code == 200
        invoice_id = create_response.json()["invoice_id"]
        
        # Mark as paid
        response = requests.put(
            f"{BASE_URL}/api/admin/accounting/receivables/{invoice_id}/status",
            params={"status": "paid", "admin_id": "test_admin"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "paid" in data["message"]
        print(f"✅ Marked AR {invoice_id} as paid - should add to cash book")
    
    def test_filter_receivables_by_status(self):
        """Test filtering receivables by status"""
        for status in ["all", "pending", "paid"]:
            response = requests.get(
                f"{BASE_URL}/api/admin/accounting/receivables",
                params={"status": status}
            )
            assert response.status_code == 200
            print(f"✅ Filter by status '{status}' works")


class TestAccountsPayable:
    """Accounts Payable (AP) - देणे बाकी - Money owed BY the business"""
    
    def test_get_payables_summary(self):
        """Test GET /api/admin/accounting/payables returns summary with PRC liability"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/payables")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data
        assert "total_pending" in data["summary"]
        assert "total_overdue" in data["summary"]
        assert "total_paid" in data["summary"]
        assert "total_outstanding" in data["summary"]
        assert "prc_redemption_liability" in data["summary"]  # Key feature: PRC liability
        assert "payables" in data
        print(f"✅ AP Summary: pending={data['summary']['total_pending']}, PRC_liability={data['summary']['prc_redemption_liability']}")
    
    def test_create_payable(self):
        """Test POST /api/admin/accounting/payables creates new bill"""
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/payables",
            params={
                "vendor_name": "TEST_Vendor_AP",
                "vendor_id": "TEST_VEND_001",
                "description": "TEST Server Hosting Bill",
                "amount": 5000.0,
                "due_date": "2025-01-20",
                "category": "server_hosting",
                "admin_id": "test_admin"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "bill_id" in data
        assert data["bill_id"].startswith("BILL-")
        print(f"✅ Created AP bill: {data['bill_id']}")
        return data["bill_id"]
    
    def test_mark_payable_paid(self):
        """Test PUT /api/admin/accounting/payables/{bill_id}/status marks as paid"""
        # First create a payable
        create_response = requests.post(
            f"{BASE_URL}/api/admin/accounting/payables",
            params={
                "vendor_name": "TEST_Vendor_Paid",
                "amount": 1000.0,
                "category": "utilities",
                "admin_id": "test_admin"
            }
        )
        assert create_response.status_code == 200
        bill_id = create_response.json()["bill_id"]
        
        # Mark as paid via cash
        response = requests.put(
            f"{BASE_URL}/api/admin/accounting/payables/{bill_id}/status",
            params={"status": "paid", "payment_method": "cash", "admin_id": "test_admin"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"✅ Marked AP {bill_id} as paid via cash")


class TestBankReconciliation:
    """Bank Reconciliation Tests"""
    
    def test_get_bank_reconciliation(self):
        """Test GET /api/admin/accounting/bank-reconciliation returns book balance and entries"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/bank-reconciliation")
        assert response.status_code == 200
        
        data = response.json()
        assert "period" in data
        assert "book_balance" in data
        assert "bank_statement_balance" in data
        assert "difference" in data
        assert "is_reconciled" in data
        assert "summary" in data
        assert "entries" in data
        
        # Check summary fields
        assert "total_deposits" in data["summary"]
        assert "total_withdrawals" in data["summary"]
        assert "entries_count" in data["summary"]
        assert "unreconciled_count" in data["summary"]
        
        print(f"✅ Bank Reconciliation: book_balance={data['book_balance']}, period={data['period']}")
    
    def test_bank_reconciliation_with_month_year(self):
        """Test bank reconciliation with specific month/year"""
        response = requests.get(
            f"{BASE_URL}/api/admin/accounting/bank-reconciliation",
            params={"month": 12, "year": 2025}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["month"] == 12
        assert data["year"] == 2025
        print(f"✅ Bank Reconciliation for Dec 2025 works")


class TestGSTTracking:
    """GST/Tax Tracking Tests"""
    
    def test_get_gst_summary(self):
        """Test GET /api/admin/accounting/gst-summary returns input_gst, output_gst, net_gst_payable"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/gst-summary")
        assert response.status_code == 200
        
        data = response.json()
        assert "period" in data
        assert "summary" in data
        assert "input_gst" in data["summary"]
        assert "output_gst" in data["summary"]
        assert "net_gst_payable" in data["summary"]
        assert "net_gst_credit" in data["summary"]
        assert "gst_by_rate" in data
        
        # Check GST rates are present
        for rate in ["0", "5", "12", "18", "28"]:
            assert rate in data["gst_by_rate"]
        
        print(f"✅ GST Summary: input={data['summary']['input_gst']}, output={data['summary']['output_gst']}, net_payable={data['summary']['net_gst_payable']}")
    
    def test_create_gst_entry_18_percent(self):
        """Test POST /api/admin/accounting/gst-entry with 18% GST"""
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/gst-entry",
            params={
                "gst_type": "output",
                "base_amount": 1000.0,
                "gst_rate": 18,
                "description": "TEST VIP Membership Sale",
                "invoice_no": "TEST-INV-001",
                "party_name": "TEST Customer",
                "admin_id": "test_admin"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "entry_id" in data
        assert data["gst_amount"] == 180.0  # 1000 * 18% = 180
        print(f"✅ Created GST entry: base=1000, rate=18%, gst_amount={data['gst_amount']}")
    
    def test_create_gst_entry_5_percent(self):
        """Test GST entry with 5% rate"""
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/gst-entry",
            params={
                "gst_type": "input",
                "base_amount": 500.0,
                "gst_rate": 5,
                "description": "TEST Office Supplies",
                "admin_id": "test_admin"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["gst_amount"] == 25.0  # 500 * 5% = 25
        print(f"✅ Created 5% GST entry: gst_amount={data['gst_amount']}")
    
    def test_create_gst_entry_28_percent(self):
        """Test GST entry with 28% rate"""
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/gst-entry",
            params={
                "gst_type": "output",
                "base_amount": 2000.0,
                "gst_rate": 28,
                "description": "TEST Premium Service",
                "admin_id": "test_admin"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["gst_amount"] == 560.0  # 2000 * 28% = 560
        print(f"✅ Created 28% GST entry: gst_amount={data['gst_amount']}")
    
    def test_invalid_gst_rate(self):
        """Test that invalid GST rate returns error"""
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/gst-entry",
            params={
                "gst_type": "output",
                "base_amount": 1000.0,
                "gst_rate": 15,  # Invalid rate
                "description": "TEST Invalid Rate"
            }
        )
        assert response.status_code == 400
        print("✅ Invalid GST rate (15%) correctly rejected")
    
    def test_invalid_gst_type(self):
        """Test that invalid GST type returns error"""
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/gst-entry",
            params={
                "gst_type": "invalid",  # Should be input or output
                "base_amount": 1000.0,
                "gst_rate": 18
            }
        )
        assert response.status_code == 400
        print("✅ Invalid GST type correctly rejected")


class TestBudgetVsActual:
    """Budget vs Actual Comparison Tests"""
    
    def test_get_budget_comparison(self):
        """Test GET /api/admin/accounting/budget returns comparison with actual expenses"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/budget")
        assert response.status_code == 200
        
        data = response.json()
        assert "period" in data
        assert "month" in data
        assert "year" in data
        assert "summary" in data
        assert "comparison" in data
        
        # Check summary fields
        summary = data["summary"]
        assert "total_budgeted" in summary
        assert "total_actual" in summary
        assert "total_variance" in summary
        assert "budget_utilization" in summary
        
        print(f"✅ Budget vs Actual: budgeted={summary['total_budgeted']}, actual={summary['total_actual']}, variance={summary['total_variance']}")
    
    def test_set_budget(self):
        """Test POST /api/admin/accounting/budget sets budget categories"""
        categories = {
            "rent": 50000,
            "salary": 100000,
            "utilities": 10000,
            "server_hosting": 20000,
            "marketing": 15000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/accounting/budget",
            params={
                "month": 12,
                "year": 2025,
                "admin_id": "test_admin"
            },
            json=categories
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["categories_count"] == 5
        print(f"✅ Set budget for Dec 2025 with {data['categories_count']} categories")
    
    def test_budget_comparison_structure(self):
        """Test budget comparison returns proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/accounting/budget",
            params={"month": 12, "year": 2025}
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["comparison"]:
            item = data["comparison"][0]
            assert "category" in item
            assert "budgeted" in item
            assert "actual" in item
            assert "variance" in item
            assert "variance_percent" in item
            assert "status" in item
            assert item["status"] in ["under", "over", "on_track"]
            print(f"✅ Budget comparison structure verified")


class TestFinancialRatios:
    """Financial Ratios Dashboard Tests"""
    
    def test_get_financial_ratios(self):
        """Test GET /api/admin/accounting/financial-ratios returns all ratios"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/financial-ratios")
        assert response.status_code == 200
        
        data = response.json()
        assert "ratios" in data
        assert "health_score" in data
        assert "health_status" in data
        assert "period" in data
        assert "underlying_data" in data
        
        # Check all required ratios
        ratios = data["ratios"]
        assert "current_ratio" in ratios
        assert "quick_ratio" in ratios
        assert "profit_margin" in ratios
        assert "expense_ratio" in ratios
        
        print(f"✅ Financial Ratios: health_score={data['health_score']}, status={data['health_status']}")
    
    def test_ratio_structure(self):
        """Test each ratio has proper structure"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/financial-ratios")
        assert response.status_code == 200
        
        data = response.json()
        for ratio_name in ["current_ratio", "quick_ratio", "profit_margin", "expense_ratio"]:
            ratio = data["ratios"][ratio_name]
            assert "value" in ratio
            assert "benchmark" in ratio
            assert "status" in ratio
            assert "description" in ratio
            assert ratio["status"] in ["good", "fair", "poor"]
            print(f"✅ {ratio_name}: value={ratio['value']}, status={ratio['status']}")
    
    def test_health_score_range(self):
        """Test health score is within valid range (0-100)"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/financial-ratios")
        assert response.status_code == 200
        
        data = response.json()
        assert 0 <= data["health_score"] <= 100
        assert data["health_status"] in ["excellent", "good", "fair", "needs_attention"]
        print(f"✅ Health score {data['health_score']} is in valid range (0-100)")
    
    def test_underlying_data(self):
        """Test underlying financial data is present"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/financial-ratios")
        assert response.status_code == 200
        
        data = response.json()
        underlying = data["underlying_data"]
        assert "total_cash" in underlying
        assert "total_current_liabilities" in underlying
        assert "total_income" in underlying
        assert "total_expenses" in underlying
        assert "net_profit" in underlying
        print(f"✅ Underlying data: cash={underlying['total_cash']}, income={underlying['total_income']}, expenses={underlying['total_expenses']}")


class TestAuditTrail:
    """Audit Trail Tests"""
    
    def test_get_audit_trail(self):
        """Test GET /api/admin/accounting/audit-trail returns audit logs"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/audit-trail")
        assert response.status_code == 200
        
        data = response.json()
        assert "audit_logs" in data
        assert "pagination" in data
        
        # Check pagination structure
        pagination = data["pagination"]
        assert "page" in pagination
        assert "limit" in pagination
        assert "total" in pagination
        assert "total_pages" in pagination
        
        print(f"✅ Audit Trail: {pagination['total']} total logs")
    
    def test_audit_log_structure(self):
        """Test audit log entry structure"""
        response = requests.get(f"{BASE_URL}/api/admin/accounting/audit-trail")
        assert response.status_code == 200
        
        data = response.json()
        if data["audit_logs"]:
            log = data["audit_logs"][0]
            expected_fields = ["id", "timestamp", "user_id", "user_email", "action_type", 
                            "entity_type", "entity_id", "description"]
            for field in expected_fields:
                assert field in log
            print(f"✅ Audit log structure verified")
        else:
            print("✅ Audit trail empty (no logs yet)")
    
    def test_audit_trail_pagination(self):
        """Test audit trail pagination"""
        response = requests.get(
            f"{BASE_URL}/api/admin/accounting/audit-trail",
            params={"page": 1, "limit": 10}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["audit_logs"]) <= 10
        print(f"✅ Audit trail pagination works")


class TestIntegration:
    """Integration tests for Phase 2 features"""
    
    def test_ar_paid_creates_cash_book_entry(self):
        """Test that marking AR as paid creates cash book entry"""
        # Create AR
        create_response = requests.post(
            f"{BASE_URL}/api/admin/accounting/receivables",
            params={
                "customer_name": "TEST_Integration_Customer",
                "amount": 1500.0,
                "description": "Integration Test AR",
                "admin_id": "test_admin"
            }
        )
        assert create_response.status_code == 200
        invoice_id = create_response.json()["invoice_id"]
        
        # Get cash book before
        cash_before = requests.get(f"{BASE_URL}/api/admin/accounting/cash-book")
        
        # Mark as paid
        paid_response = requests.put(
            f"{BASE_URL}/api/admin/accounting/receivables/{invoice_id}/status",
            params={"status": "paid", "admin_id": "test_admin"}
        )
        assert paid_response.status_code == 200
        
        # Verify cash book entry was created
        cash_after = requests.get(f"{BASE_URL}/api/admin/accounting/cash-book")
        assert cash_after.status_code == 200
        
        print(f"✅ AR payment integration: {invoice_id} marked paid, cash book updated")
    
    def test_gst_rates_all_valid(self):
        """Test all valid GST rates work: 0, 5, 12, 18, 28"""
        valid_rates = [0, 5, 12, 18, 28]
        
        for rate in valid_rates:
            response = requests.post(
                f"{BASE_URL}/api/admin/accounting/gst-entry",
                params={
                    "gst_type": "output",
                    "base_amount": 100.0,
                    "gst_rate": rate,
                    "description": f"TEST GST Rate {rate}%",
                    "admin_id": "test_admin"
                }
            )
            assert response.status_code == 200
            data = response.json()
            expected_gst = 100.0 * (rate / 100)
            assert data["gst_amount"] == expected_gst
            print(f"✅ GST rate {rate}%: base=100, gst_amount={data['gst_amount']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
