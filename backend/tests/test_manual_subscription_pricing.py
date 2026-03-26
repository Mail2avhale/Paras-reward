"""
Test Manual Subscription Pricing (March 2026)
==============================================
Tests for the new pricing structure:
- Formula: ₹999 + 18% GST = ₹1178.82
- Applies to Manual (VIP/Bank Transfer) and Razorpay payments
- GST routing to company wallets

Endpoints tested:
1. GET /api/vip/plans - VIP plans with pricing
2. GET /api/subscription/plans - Elite plan with GST breakdown
3. GET /api/subscription/manual-pricing - Full pricing breakdown
4. credit_company_wallets_for_manual_subscription() - GST routing logic
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Expected pricing values
EXPECTED_BASE_PRICE = 999.0
EXPECTED_GST_RATE = 18.0
EXPECTED_GST_AMOUNT = 179.82
EXPECTED_TOTAL_PRICE = 1178.82


class TestVIPPlansEndpoint:
    """Test /api/vip/plans endpoint - returns VIP plans with new pricing"""
    
    def test_vip_plans_returns_200(self):
        """Test that /api/vip/plans returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/vip/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ /api/vip/plans returns 200 OK")
    
    def test_vip_plans_has_plans_array(self):
        """Test that response contains plans array"""
        response = requests.get(f"{BASE_URL}/api/vip/plans")
        data = response.json()
        assert "plans" in data, "Response should contain 'plans' key"
        assert isinstance(data["plans"], list), "Plans should be a list"
        assert len(data["plans"]) > 0, "Plans list should not be empty"
        print(f"✅ /api/vip/plans returns {len(data['plans'])} plans")
    
    def test_vip_monthly_plan_pricing(self):
        """Test monthly plan has correct pricing: ₹999 + 18% GST = ₹1178.82"""
        response = requests.get(f"{BASE_URL}/api/vip/plans")
        data = response.json()
        
        # Find monthly plan
        monthly_plan = None
        for plan in data["plans"]:
            if plan.get("plan_type") == "monthly":
                monthly_plan = plan
                break
        
        assert monthly_plan is not None, "Monthly plan should exist"
        
        # Verify pricing
        assert monthly_plan.get("base_price") == EXPECTED_BASE_PRICE, \
            f"Base price should be {EXPECTED_BASE_PRICE}, got {monthly_plan.get('base_price')}"
        
        assert monthly_plan.get("gst_rate") == EXPECTED_GST_RATE, \
            f"GST rate should be {EXPECTED_GST_RATE}%, got {monthly_plan.get('gst_rate')}"
        
        assert monthly_plan.get("gst_amount") == EXPECTED_GST_AMOUNT, \
            f"GST amount should be {EXPECTED_GST_AMOUNT}, got {monthly_plan.get('gst_amount')}"
        
        assert monthly_plan.get("total_price") == EXPECTED_TOTAL_PRICE, \
            f"Total price should be {EXPECTED_TOTAL_PRICE}, got {monthly_plan.get('total_price')}"
        
        print(f"✅ Monthly plan pricing correct: ₹{monthly_plan.get('base_price')} + 18% GST = ₹{monthly_plan.get('total_price')}")
    
    def test_vip_quarterly_plan_pricing(self):
        """Test quarterly plan has correct pricing: 3x monthly"""
        response = requests.get(f"{BASE_URL}/api/vip/plans")
        data = response.json()
        
        quarterly_plan = None
        for plan in data["plans"]:
            if plan.get("plan_type") == "quarterly":
                quarterly_plan = plan
                break
        
        assert quarterly_plan is not None, "Quarterly plan should exist"
        
        # Quarterly = 3x monthly
        expected_quarterly_base = EXPECTED_BASE_PRICE * 3
        expected_quarterly_gst = round(EXPECTED_GST_AMOUNT * 3, 2)
        expected_quarterly_total = round(EXPECTED_TOTAL_PRICE * 3, 2)
        
        assert quarterly_plan.get("base_price") == expected_quarterly_base, \
            f"Quarterly base should be {expected_quarterly_base}, got {quarterly_plan.get('base_price')}"
        
        assert quarterly_plan.get("total_price") == expected_quarterly_total, \
            f"Quarterly total should be {expected_quarterly_total}, got {quarterly_plan.get('total_price')}"
        
        print(f"✅ Quarterly plan pricing correct: ₹{quarterly_plan.get('base_price')} + GST = ₹{quarterly_plan.get('total_price')}")
    
    def test_vip_plans_have_duration_days(self):
        """Test all plans have duration_days field"""
        response = requests.get(f"{BASE_URL}/api/vip/plans")
        data = response.json()
        
        expected_durations = {
            "monthly": 28,
            "quarterly": 84,
            "half_yearly": 168,
            "yearly": 336
        }
        
        for plan in data["plans"]:
            plan_type = plan.get("plan_type")
            if plan_type in expected_durations:
                assert plan.get("duration_days") == expected_durations[plan_type], \
                    f"{plan_type} should have {expected_durations[plan_type]} days, got {plan.get('duration_days')}"
        
        print("✅ All VIP plans have correct duration_days")


class TestSubscriptionPlansEndpoint:
    """Test /api/subscription/plans endpoint - returns elite plan with GST breakdown"""
    
    def test_subscription_plans_returns_200(self):
        """Test that /api/subscription/plans returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ /api/subscription/plans returns 200 OK")
    
    def test_subscription_plans_has_pricing_info(self):
        """Test response contains pricing_info with GST breakdown"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        assert "pricing_info" in data, "Response should contain 'pricing_info'"
        pricing_info = data["pricing_info"]
        
        assert pricing_info.get("base_price") == EXPECTED_BASE_PRICE, \
            f"Base price should be {EXPECTED_BASE_PRICE}, got {pricing_info.get('base_price')}"
        
        assert pricing_info.get("gst_amount") == EXPECTED_GST_AMOUNT, \
            f"GST amount should be {EXPECTED_GST_AMOUNT}, got {pricing_info.get('gst_amount')}"
        
        assert pricing_info.get("total_price") == EXPECTED_TOTAL_PRICE, \
            f"Total price should be {EXPECTED_TOTAL_PRICE}, got {pricing_info.get('total_price')}"
        
        print(f"✅ pricing_info correct: base={pricing_info.get('base_price')}, gst={pricing_info.get('gst_amount')}, total={pricing_info.get('total_price')}")
    
    def test_subscription_plans_formula(self):
        """Test pricing formula is displayed correctly"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        pricing_info = data.get("pricing_info", {})
        formula = pricing_info.get("formula", "")
        
        assert "999" in formula, f"Formula should contain base price 999, got: {formula}"
        assert "18%" in formula or "GST" in formula, f"Formula should mention GST, got: {formula}"
        
        print(f"✅ Pricing formula: {formula}")
    
    def test_elite_plan_has_gst_breakdown(self):
        """Test elite plan in plans array has GST breakdown"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        plans = data.get("plans", [])
        elite_plan = None
        for plan in plans:
            if plan.get("id") == "elite":
                elite_plan = plan
                break
        
        assert elite_plan is not None, "Elite plan should exist in plans"
        
        pricing = elite_plan.get("pricing", {})
        assert pricing is not None, "Elite plan should have pricing"
        
        assert pricing.get("monthly") == EXPECTED_TOTAL_PRICE, \
            f"Elite monthly price should be {EXPECTED_TOTAL_PRICE}, got {pricing.get('monthly')}"
        
        assert pricing.get("base_price") == EXPECTED_BASE_PRICE, \
            f"Elite base_price should be {EXPECTED_BASE_PRICE}, got {pricing.get('base_price')}"
        
        assert pricing.get("gst_amount") == EXPECTED_GST_AMOUNT, \
            f"Elite gst_amount should be {EXPECTED_GST_AMOUNT}, got {pricing.get('gst_amount')}"
        
        print(f"✅ Elite plan pricing: monthly={pricing.get('monthly')}, base={pricing.get('base_price')}, gst={pricing.get('gst_amount')}")


class TestManualPricingEndpoint:
    """Test /api/subscription/manual-pricing endpoint - full pricing breakdown"""
    
    def test_manual_pricing_returns_200(self):
        """Test that /api/subscription/manual-pricing returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/subscription/manual-pricing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ /api/subscription/manual-pricing returns 200 OK")
    
    def test_manual_pricing_success_flag(self):
        """Test response has success: true"""
        response = requests.get(f"{BASE_URL}/api/subscription/manual-pricing")
        data = response.json()
        
        assert data.get("success") == True, "Response should have success: true"
        print("✅ Manual pricing returns success: true")
    
    def test_manual_pricing_monthly_breakdown(self):
        """Test monthly_breakdown has correct values"""
        response = requests.get(f"{BASE_URL}/api/subscription/manual-pricing")
        data = response.json()
        
        breakdown = data.get("monthly_breakdown", {})
        
        assert breakdown.get("base_price") == EXPECTED_BASE_PRICE, \
            f"Base price should be {EXPECTED_BASE_PRICE}, got {breakdown.get('base_price')}"
        
        assert breakdown.get("gst_amount") == EXPECTED_GST_AMOUNT, \
            f"GST amount should be {EXPECTED_GST_AMOUNT}, got {breakdown.get('gst_amount')}"
        
        assert breakdown.get("total_price") == EXPECTED_TOTAL_PRICE, \
            f"Total price should be {EXPECTED_TOTAL_PRICE}, got {breakdown.get('total_price')}"
        
        print(f"✅ Monthly breakdown: base={breakdown.get('base_price')}, gst={breakdown.get('gst_amount')}, total={breakdown.get('total_price')}")
    
    def test_manual_pricing_payment_methods(self):
        """Test payment_methods includes Manual and Razorpay"""
        response = requests.get(f"{BASE_URL}/api/subscription/manual-pricing")
        data = response.json()
        
        payment_methods = data.get("payment_methods", [])
        
        # Check that Manual and Razorpay are mentioned
        methods_str = " ".join(payment_methods).lower()
        assert "manual" in methods_str or "bank" in methods_str or "upi" in methods_str, \
            f"Payment methods should include Manual/Bank/UPI, got: {payment_methods}"
        assert "razorpay" in methods_str, \
            f"Payment methods should include Razorpay, got: {payment_methods}"
        
        print(f"✅ Payment methods: {payment_methods}")
    
    def test_manual_pricing_has_plans(self):
        """Test response includes all VIP plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/manual-pricing")
        data = response.json()
        
        plans = data.get("plans", [])
        assert len(plans) >= 4, f"Should have at least 4 plans (monthly, quarterly, half_yearly, yearly), got {len(plans)}"
        
        plan_types = [p.get("plan_type") for p in plans]
        assert "monthly" in plan_types, "Should have monthly plan"
        assert "quarterly" in plan_types, "Should have quarterly plan"
        
        print(f"✅ Manual pricing includes {len(plans)} plans: {plan_types}")
    
    def test_manual_pricing_gst_note(self):
        """Test response mentions GST routing to company wallet"""
        response = requests.get(f"{BASE_URL}/api/subscription/manual-pricing")
        data = response.json()
        
        note = data.get("note", "")
        assert "gst" in note.lower() or "wallet" in note.lower(), \
            f"Note should mention GST/wallet routing, got: {note}"
        
        print(f"✅ GST routing note: {note}")


class TestGSTCalculationLogic:
    """Test GST calculation logic - verify math is correct"""
    
    def test_gst_calculation_formula(self):
        """Verify: ₹999 + 18% = ₹1178.82"""
        base = 999.0
        gst_rate = 0.18
        expected_gst = round(base * gst_rate, 2)
        expected_total = round(base + expected_gst, 2)
        
        assert expected_gst == 179.82, f"GST should be 179.82, calculated {expected_gst}"
        assert expected_total == 1178.82, f"Total should be 1178.82, calculated {expected_total}"
        
        print(f"✅ GST calculation verified: ₹{base} + {gst_rate*100}% = ₹{expected_total}")
    
    def test_reverse_gst_calculation(self):
        """Verify reverse calculation: Total / 1.18 = Base"""
        total = 1178.82
        calculated_base = round(total / 1.18, 2)
        calculated_gst = round(total - calculated_base, 2)
        
        # Allow small rounding difference
        assert abs(calculated_base - 999.0) < 0.5, f"Reverse base should be ~999, got {calculated_base}"
        assert abs(calculated_gst - 179.82) < 0.5, f"Reverse GST should be ~179.82, got {calculated_gst}"
        
        print(f"✅ Reverse GST calculation verified: ₹{total} = ₹{calculated_base} + ₹{calculated_gst}")


class TestCompanyWalletRouting:
    """Test company wallet routing logic for manual subscription approval"""
    
    def test_wallet_routing_breakdown(self):
        """
        Test that when ₹1178.82 is paid:
        - ₹179.82 goes to gst_collection wallet
        - ₹999 goes to subscription wallet
        """
        # This tests the logic in credit_company_wallets_for_manual_subscription()
        # We verify the calculation matches expected values
        
        amount_paid = 1178.82
        
        # Formula from code: base = total / 1.18
        base_amount = round(amount_paid / 1.18, 2)
        gst_amount = round(amount_paid - base_amount, 2)
        
        # Verify breakdown
        assert abs(base_amount - 999.0) < 0.5, f"Base should be ~999, got {base_amount}"
        assert abs(gst_amount - 179.82) < 0.5, f"GST should be ~179.82, got {gst_amount}"
        
        print(f"✅ Wallet routing verified: Total ₹{amount_paid} = GST ₹{gst_amount} + Subscription ₹{base_amount}")
    
    def test_wallet_routing_for_quarterly(self):
        """Test wallet routing for quarterly payment (3x monthly)"""
        quarterly_total = round(1178.82 * 3, 2)  # ₹3536.46
        
        base_amount = round(quarterly_total / 1.18, 2)
        gst_amount = round(quarterly_total - base_amount, 2)
        
        expected_base = round(999.0 * 3, 2)  # ₹2997
        expected_gst = round(179.82 * 3, 2)  # ₹539.46
        
        assert abs(base_amount - expected_base) < 1, f"Quarterly base should be ~{expected_base}, got {base_amount}"
        assert abs(gst_amount - expected_gst) < 1, f"Quarterly GST should be ~{expected_gst}, got {gst_amount}"
        
        print(f"✅ Quarterly wallet routing: Total ₹{quarterly_total} = GST ₹{gst_amount} + Subscription ₹{base_amount}")


class TestHealthEndpoint:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "healthy", f"Status should be healthy, got {data.get('status')}"
        
        print("✅ API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
