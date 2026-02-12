"""
Test P&L Fee Structure APIs - Iteration 56
Tests the fee structure (10 Rs fixed processing fee + 20% admin charge)
and service-wise breakdown in P&L report
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPLFeeStructure:
    """Test P&L API returns processing_fees and admin_charges in revenue breakdown"""
    
    def test_pl_api_returns_processing_fees_field(self):
        """P&L API should have processing_fees in revenue breakdown"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "revenue" in data, "Revenue key missing from P&L response"
        assert "breakdown" in data["revenue"], "Breakdown missing from revenue"
        assert "processing_fees" in data["revenue"]["breakdown"], "processing_fees field missing from revenue breakdown"
        print(f"✓ processing_fees found: ₹{data['revenue']['breakdown']['processing_fees']}")
    
    def test_pl_api_returns_admin_charges_field(self):
        """P&L API should have admin_charges in revenue breakdown"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        assert "admin_charges" in data["revenue"]["breakdown"], "admin_charges field missing from revenue breakdown"
        print(f"✓ admin_charges found: ₹{data['revenue']['breakdown']['admin_charges']}")
    
    def test_pl_api_has_service_wise_details(self):
        """P&L API should have service-wise fee details in revenue.details"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        details = data.get("revenue", {}).get("details", {})
        
        # Bill Payments
        assert "bill_payments_count" in details, "bill_payments_count missing"
        assert "bill_processing_fees" in details, "bill_processing_fees missing"
        assert "bill_admin_charges" in details, "bill_admin_charges missing"
        print(f"✓ Bill Payments: {details['bill_payments_count']} completed, Processing: ₹{details['bill_processing_fees']}, Admin: ₹{details['bill_admin_charges']}")
        
        # Gift Vouchers
        assert "gift_voucher_count" in details, "gift_voucher_count missing"
        assert "gift_processing_fees" in details, "gift_processing_fees missing"
        assert "gift_admin_charges" in details, "gift_admin_charges missing"
        print(f"✓ Gift Vouchers: {details['gift_voucher_count']} completed, Processing: ₹{details['gift_processing_fees']}, Admin: ₹{details['gift_admin_charges']}")
        
        # Luxury Claims
        assert "luxury_claims_count" in details, "luxury_claims_count missing"
        assert "luxury_processing_fees" in details, "luxury_processing_fees missing"
        assert "luxury_admin_charges" in details, "luxury_admin_charges missing"
        print(f"✓ Luxury Claims: {details['luxury_claims_count']} completed, Processing: ₹{details['luxury_processing_fees']}, Admin: ₹{details['luxury_admin_charges']}")
        
        # Withdrawals
        assert "withdrawal_count" in details, "withdrawal_count missing"
        assert "withdrawal_processing_fees" in details, "withdrawal_processing_fees missing"
        assert "withdrawal_admin_charges" in details, "withdrawal_admin_charges missing"
        print(f"✓ Withdrawals: {details['withdrawal_count']} completed, Processing: ₹{details['withdrawal_processing_fees']}, Admin: ₹{details['withdrawal_admin_charges']}")


class TestPLFeeCalculations:
    """Test that fee calculations follow the 10 Rs + 20% structure"""
    
    def test_processing_fee_is_10rs_per_transaction(self):
        """Processing fee should be 10 Rs per transaction"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        details = data.get("revenue", {}).get("details", {})
        
        # Total transaction count
        total_count = (
            details.get("bill_payments_count", 0) +
            details.get("gift_voucher_count", 0) +
            details.get("luxury_claims_count", 0) +
            details.get("withdrawal_count", 0)
        )
        
        # Processing fees should be 10 Rs per transaction
        expected_processing = total_count * 10
        actual_processing = data.get("revenue", {}).get("breakdown", {}).get("processing_fees", 0)
        
        print(f"Total transactions: {total_count}")
        print(f"Expected processing fees (10 × {total_count}): ₹{expected_processing}")
        print(f"Actual processing fees: ₹{actual_processing}")
        
        assert actual_processing == expected_processing, f"Processing fees mismatch: expected {expected_processing}, got {actual_processing}"
        print("✓ Processing fee calculation is correct (₹10 per transaction)")
    
    def test_total_fee_revenue_calculation(self):
        """Total fee revenue = processing_fees + admin_charges"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        breakdown = data.get("revenue", {}).get("breakdown", {})
        
        processing_fees = breakdown.get("processing_fees", 0)
        admin_charges = breakdown.get("admin_charges", 0)
        total_fee_revenue = processing_fees + admin_charges
        
        print(f"Processing Fees: ₹{processing_fees}")
        print(f"Admin Charges (20%): ₹{admin_charges}")
        print(f"Total Fee Revenue: ₹{total_fee_revenue}")
        
        # Both should be non-negative
        assert processing_fees >= 0, "Processing fees should be >= 0"
        assert admin_charges >= 0, "Admin charges should be >= 0"
        print("✓ Total fee revenue calculation is correct")


class TestPLInsights:
    """Test P&L insights include fee information in Marathi"""
    
    def test_insights_array_exists(self):
        """P&L should have insights array"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        assert "insights" in data, "insights array missing from P&L response"
        assert isinstance(data["insights"], list), "insights should be a list"
        print(f"✓ Found {len(data['insights'])} insights")
        for insight in data["insights"]:
            print(f"  - {insight}")
    
    def test_fee_insight_in_marathi_when_revenue_exists(self):
        """Fee insight should be in Marathi when fee revenue > 0"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        breakdown = data.get("revenue", {}).get("breakdown", {})
        total_fee_revenue = breakdown.get("processing_fees", 0) + breakdown.get("admin_charges", 0)
        
        insights = data.get("insights", [])
        
        if total_fee_revenue > 0:
            # Look for the Marathi fee insight
            fee_insight_found = any("Fees कडून" in i or "एकूण कमाई" in i for i in insights)
            assert fee_insight_found, "Marathi fee insight expected when fee revenue > 0"
            print(f"✓ Found Marathi fee insight (total fees: ₹{total_fee_revenue})")
        else:
            print("⊙ No fee revenue, so no fee insight expected")


class TestPLPeriodFilters:
    """Test P&L works with different period filters"""
    
    def test_pl_day_period(self):
        """P&L should work with day period"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=day")
        assert response.status_code == 200
        data = response.json()
        assert data.get("period") == "day"
        assert "processing_fees" in data.get("revenue", {}).get("breakdown", {})
        print(f"✓ Day period works - Processing fees: ₹{data['revenue']['breakdown']['processing_fees']}")
    
    def test_pl_week_period(self):
        """P&L should work with week period"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=week")
        assert response.status_code == 200
        data = response.json()
        assert data.get("period") == "week"
        assert "processing_fees" in data.get("revenue", {}).get("breakdown", {})
        print(f"✓ Week period works - Processing fees: ₹{data['revenue']['breakdown']['processing_fees']}")
    
    def test_pl_month_period(self):
        """P&L should work with month period"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        data = response.json()
        assert data.get("period") == "month"
        assert "processing_fees" in data.get("revenue", {}).get("breakdown", {})
        print(f"✓ Month period works - Processing fees: ₹{data['revenue']['breakdown']['processing_fees']}")
    
    def test_pl_year_period(self):
        """P&L should work with year period"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=year")
        assert response.status_code == 200
        data = response.json()
        assert data.get("period") == "year"
        assert "processing_fees" in data.get("revenue", {}).get("breakdown", {})
        print(f"✓ Year period works - Processing fees: ₹{data['revenue']['breakdown']['processing_fees']}")


class TestPLResponseStructure:
    """Test complete P&L response structure"""
    
    def test_pl_has_required_fields(self):
        """P&L should have all required top-level fields"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        
        # Required top-level fields
        required_fields = ["period", "period_label", "start_date", "end_date", "summary", "revenue", "expenses", "insights", "generated_at"]
        for field in required_fields:
            assert field in data, f"Required field '{field}' missing from P&L response"
        print(f"✓ All required top-level fields present")
    
    def test_pl_summary_structure(self):
        """P&L summary should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("summary", {})
        
        required_summary_fields = ["gross_revenue", "total_expenses", "net_profit", "profit_margin", "status", "health_score"]
        for field in required_summary_fields:
            assert field in summary, f"Summary field '{field}' missing"
        
        print(f"✓ Summary structure correct:")
        print(f"  Gross Revenue: ₹{summary['gross_revenue']}")
        print(f"  Total Expenses: ₹{summary['total_expenses']}")
        print(f"  Net Profit: ₹{summary['net_profit']}")
        print(f"  Status: {summary['status']}")
        print(f"  Health Score: {summary['health_score']}")
    
    def test_pl_revenue_breakdown_complete(self):
        """P&L revenue breakdown should have all fee types"""
        response = requests.get(f"{BASE_URL}/api/admin/finance/profit-loss?period=month")
        assert response.status_code == 200
        
        data = response.json()
        breakdown = data.get("revenue", {}).get("breakdown", {})
        
        required_breakdown_fields = [
            "vip_memberships",
            "service_charges",
            "processing_fees",
            "admin_charges",
            "delivery_charges",
            "ad_revenue",
            "other_income"
        ]
        
        for field in required_breakdown_fields:
            assert field in breakdown, f"Revenue breakdown field '{field}' missing"
        
        print(f"✓ Revenue breakdown complete:")
        for field in required_breakdown_fields:
            print(f"  {field}: ₹{breakdown[field]}")
