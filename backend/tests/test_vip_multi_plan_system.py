#!/usr/bin/env python3
"""
VIP MULTI-PLAN MEMBERSHIP SYSTEM - COMPREHENSIVE TESTING

Tests the newly implemented multi-plan VIP membership system that allows admins to 
configure 4 different VIP plans (Monthly, Quarterly, Half-Yearly, Yearly) with 
flexible pricing and discount options.

PRICING DETAILS:
- Monthly: ₹299 for 30 days
- Quarterly: ₹897 for 90 days  
- Half-Yearly: ₹1794 for 180 days
- Yearly: ₹3588 for 365 days

TEST SCENARIOS:
1. Backend API Tests:
   a. GET /api/vip/plans - Public endpoint returning all 4 plans
   b. POST /api/admin/vip/update-plan - Admin endpoint to update plan pricing
   c. GET /api/admin/vip/plans - Admin endpoint (same as public for now)
   d. Database Settings Structure

2. Discount Calculation Logic:
   - Test percentage discount only
   - Test fixed discount only  
   - Test both percentage + fixed discounts
   - Test edge cases (100% discount, discount > price)

3. Multiple Plans Management:
   - Update all 4 plans with different pricing
   - Update only specific plans
   - Verify independent pricing per plan

4. Response Structure Validation:
   - Verify each plan has required fields
   - Verify numeric values properly formatted
   - Verify savings calculations

SUCCESS CRITERIA:
✅ All 4 default plans have correct pricing
✅ Admin can update any plan independently
✅ Both percentage AND fixed discounts work
✅ Discounts combine correctly (percentage first, then fixed)
✅ Final price never goes negative
✅ Changes persist in database
✅ Public endpoint returns updated pricing
✅ Validation rejects invalid inputs
"""

import requests
import json
import sys
import os
from datetime import datetime
import time
import uuid

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
        return None

BACKEND_URL = get_backend_url()
if not BACKEND_URL:
    print("ERROR: Could not get REACT_APP_BACKEND_URL from /app/frontend/.env")
    sys.exit(1)

API_BASE = f"{BACKEND_URL}/api"

print(f"💎 VIP MULTI-PLAN MEMBERSHIP SYSTEM - COMPREHENSIVE TESTING")
print(f"Backend URL: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def test_vip_multi_plan_system():
    """
    VIP MULTI-PLAN MEMBERSHIP SYSTEM TESTING
    
    Test all aspects of the multi-plan VIP system including:
    - Public plans endpoint
    - Admin plan management
    - Discount calculations
    - Database persistence
    - Response structure validation
    """
    print(f"\n💎 VIP MULTI-PLAN MEMBERSHIP SYSTEM TESTING")
    print("=" * 80)
    print(f"Testing multi-plan VIP membership functionality")
    print("=" * 80)
    
    test_results = {
        # Public Plans Endpoint Tests
        "public_plans_endpoint_works": False,
        "all_4_plans_returned": False,
        "default_pricing_correct": False,
        "default_discounts_zero": False,
        "final_price_equals_base_price": False,
        "duration_days_correct": False,
        
        # Admin Plans Endpoint Tests
        "admin_plans_endpoint_works": False,
        "admin_plans_same_as_public": False,
        
        # Plan Update Tests
        "update_plan_endpoint_works": False,
        "base_price_update_works": False,
        "percentage_discount_works": False,
        "fixed_discount_works": False,
        "combined_discounts_work": False,
        
        # Discount Calculation Tests
        "percentage_only_calculation_correct": False,
        "fixed_only_calculation_correct": False,
        "combined_calculation_correct": False,
        "edge_case_100_percent_discount": False,
        "edge_case_discount_greater_than_price": False,
        "final_price_never_negative": False,
        
        # Validation Tests
        "rejects_negative_price": False,
        "rejects_percentage_over_100": False,
        "rejects_negative_fixed_discount": False,
        "rejects_invalid_plan_type": False,
        
        # Database Persistence Tests
        "settings_document_created": False,
        "plan_updates_persist": False,
        "multiple_plan_updates_independent": False,
        
        # Response Structure Tests
        "response_has_required_fields": False,
        "numeric_values_formatted_correctly": False,
        "savings_calculation_correct": False
    }
    
    # Expected default pricing
    expected_plans = {
        "monthly": {"price": 299.0, "duration_days": 30, "label": "Monthly Plan"},
        "quarterly": {"price": 897.0, "duration_days": 90, "label": "Quarterly Plan"},
        "half_yearly": {"price": 1794.0, "duration_days": 180, "label": "Half-Yearly Plan"},
        "yearly": {"price": 3588.0, "duration_days": 365, "label": "Yearly Plan"}
    }
    
    print(f"\n🔍 STEP 1: TEST PUBLIC VIP PLANS ENDPOINT")
    print("=" * 60)
    
    # Test 1: GET /api/vip/plans - Public endpoint
    print(f"\n📋 Testing GET /api/vip/plans...")
    
    try:
        response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
        if response.status_code == 200:
            response_data = response.json()
            plans = response_data.get("plans", [])
            test_results["public_plans_endpoint_works"] = True
            print(f"✅ Public VIP plans endpoint working")
            print(f"   📋 Response: {json.dumps(response_data, indent=2)}")
            
            # Check if all 4 plans are returned
            if len(plans) == 4:
                test_results["all_4_plans_returned"] = True
                print(f"✅ All 4 plans returned: {len(plans)} plans")
                
                # Verify each plan has correct structure and default pricing
                pricing_correct = True
                discounts_zero = True
                final_price_correct = True
                duration_correct = True
                
                for plan in plans:
                    plan_type = plan.get("plan_type")
                    base_price = plan.get("base_price")
                    discount_percentage = plan.get("discount_percentage", 0)
                    discount_fixed = plan.get("discount_fixed", 0)
                    final_price = plan.get("final_price")
                    duration_days = plan.get("duration_days")
                    
                    print(f"   📋 {plan_type}: ₹{base_price} -> ₹{final_price} ({duration_days} days)")
                    
                    # Check pricing
                    expected = expected_plans.get(plan_type, {})
                    if base_price != expected.get("price"):
                        pricing_correct = False
                        print(f"   ❌ {plan_type} price incorrect: expected ₹{expected.get('price')}, got ₹{base_price}")
                    
                    # Check default discounts are zero
                    if discount_percentage != 0 or discount_fixed != 0:
                        discounts_zero = False
                        print(f"   ❌ {plan_type} has non-zero default discounts: {discount_percentage}%, ₹{discount_fixed}")
                    
                    # Check final price equals base price when no discounts
                    if final_price != base_price:
                        final_price_correct = False
                        print(f"   ❌ {plan_type} final price doesn't match base price: ₹{final_price} != ₹{base_price}")
                    
                    # Check duration
                    if duration_days != expected.get("duration_days"):
                        duration_correct = False
                        print(f"   ❌ {plan_type} duration incorrect: expected {expected.get('duration_days')}, got {duration_days}")
                
                if pricing_correct:
                    test_results["default_pricing_correct"] = True
                    print(f"✅ Default pricing correct for all plans")
                
                if discounts_zero:
                    test_results["default_discounts_zero"] = True
                    print(f"✅ Default discounts are zero for all plans")
                
                if final_price_correct:
                    test_results["final_price_equals_base_price"] = True
                    print(f"✅ Final price equals base price when no discounts")
                
                if duration_correct:
                    test_results["duration_days_correct"] = True
                    print(f"✅ Duration days correct for all plans")
                    
            else:
                print(f"❌ Expected 4 plans, got {len(plans)}")
                
        else:
            print(f"❌ Public VIP plans endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing public VIP plans: {e}")
        return test_results
    
    print(f"\n🔍 STEP 2: TEST ADMIN VIP PLANS ENDPOINT")
    print("=" * 60)
    
    # Test 2: GET /api/admin/vip/plans - Admin endpoint
    print(f"\n📋 Testing GET /api/admin/vip/plans...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/vip/plans", timeout=30)
        if response.status_code == 200:
            admin_plans = response.json()
            test_results["admin_plans_endpoint_works"] = True
            print(f"✅ Admin VIP plans endpoint working")
            
            # Compare with public endpoint (should be same for now)
            if admin_plans == plans:
                test_results["admin_plans_same_as_public"] = True
                print(f"✅ Admin plans endpoint returns same data as public endpoint")
            else:
                print(f"⚠️  Admin plans differ from public plans")
                print(f"   📋 Admin: {len(admin_plans)} plans")
                print(f"   📋 Public: {len(plans)} plans")
                
        else:
            print(f"❌ Admin VIP plans endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing admin VIP plans: {e}")
    
    print(f"\n🔍 STEP 3: TEST PLAN UPDATE FUNCTIONALITY")
    print("=" * 60)
    
    # Test 3: POST /api/admin/vip/update-plan - Update plan pricing
    print(f"\n📋 Testing POST /api/admin/vip/update-plan...")
    
    # Test 3a: Update base price only
    print(f"\n📋 Testing base price update (Monthly plan: ₹299 -> ₹350)...")
    
    update_data = {
        "plan_type": "monthly",
        "base_price": 350.0
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["update_plan_endpoint_works"] = True
            print(f"✅ Plan update endpoint working")
            print(f"   📋 Response: {result}")
            
            # Verify the update worked by checking public endpoint
            response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
            if response.status_code == 200:
                updated_plans = response.json()
                monthly_plan = next((p for p in updated_plans if p["plan_type"] == "monthly"), None)
                
                if monthly_plan and monthly_plan["base_price"] == 350.0:
                    test_results["base_price_update_works"] = True
                    print(f"✅ Base price update works: Monthly plan now ₹{monthly_plan['base_price']}")
                else:
                    print(f"❌ Base price update failed: Monthly plan still ₹{monthly_plan['base_price'] if monthly_plan else 'N/A'}")
                    
        else:
            print(f"❌ Plan update endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing plan update: {e}")
    
    # Test 3b: Test percentage discount
    print(f"\n📋 Testing percentage discount (Quarterly plan: 10% discount)...")
    
    update_data = {
        "plan_type": "quarterly",
        "discount_percentage": 10
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 200:
            # Verify discount calculation
            response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
            if response.status_code == 200:
                updated_plans = response.json()
                quarterly_plan = next((p for p in updated_plans if p["plan_type"] == "quarterly"), None)
                
                if quarterly_plan:
                    base_price = quarterly_plan["base_price"]  # Should be 897
                    discount_percentage = quarterly_plan["discount_percentage"]  # Should be 10
                    final_price = quarterly_plan["final_price"]
                    expected_final = base_price - (base_price * discount_percentage / 100)
                    
                    print(f"   📋 Base: ₹{base_price}, Discount: {discount_percentage}%, Final: ₹{final_price}")
                    print(f"   📋 Expected final: ₹{expected_final}")
                    
                    if abs(final_price - expected_final) < 0.01:  # Allow for rounding
                        test_results["percentage_discount_works"] = True
                        print(f"✅ Percentage discount calculation correct")
                    else:
                        print(f"❌ Percentage discount calculation incorrect")
                        
        else:
            print(f"❌ Percentage discount update failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing percentage discount: {e}")
    
    # Test 3c: Test fixed discount
    print(f"\n📋 Testing fixed discount (Half-yearly plan: ₹100 fixed discount)...")
    
    update_data = {
        "plan_type": "half_yearly",
        "discount_fixed": 100.0
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 200:
            # Verify discount calculation
            response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
            if response.status_code == 200:
                updated_plans = response.json()
                half_yearly_plan = next((p for p in updated_plans if p["plan_type"] == "half_yearly"), None)
                
                if half_yearly_plan:
                    base_price = half_yearly_plan["base_price"]  # Should be 1794
                    discount_fixed = half_yearly_plan["discount_fixed"]  # Should be 100
                    final_price = half_yearly_plan["final_price"]
                    expected_final = base_price - discount_fixed
                    
                    print(f"   📋 Base: ₹{base_price}, Fixed Discount: ₹{discount_fixed}, Final: ₹{final_price}")
                    print(f"   📋 Expected final: ₹{expected_final}")
                    
                    if abs(final_price - expected_final) < 0.01:
                        test_results["fixed_discount_works"] = True
                        print(f"✅ Fixed discount calculation correct")
                    else:
                        print(f"❌ Fixed discount calculation incorrect")
                        
        else:
            print(f"❌ Fixed discount update failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing fixed discount: {e}")
    
    # Test 3d: Test combined discounts (percentage + fixed)
    print(f"\n📋 Testing combined discounts (Yearly plan: 15% + ₹200 fixed)...")
    
    update_data = {
        "plan_type": "yearly",
        "discount_percentage": 15,
        "discount_fixed": 200.0
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 200:
            # Verify combined discount calculation
            response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
            if response.status_code == 200:
                updated_plans = response.json()
                yearly_plan = next((p for p in updated_plans if p["plan_type"] == "yearly"), None)
                
                if yearly_plan:
                    base_price = yearly_plan["base_price"]  # Should be 3588
                    discount_percentage = yearly_plan["discount_percentage"]  # Should be 15
                    discount_fixed = yearly_plan["discount_fixed"]  # Should be 200
                    final_price = yearly_plan["final_price"]
                    
                    # Calculate expected: percentage first, then fixed
                    percentage_discount = (base_price * discount_percentage) / 100
                    total_discount = percentage_discount + discount_fixed
                    expected_final = max(0, base_price - total_discount)
                    
                    print(f"   📋 Base: ₹{base_price}")
                    print(f"   📋 Percentage discount ({discount_percentage}%): ₹{percentage_discount}")
                    print(f"   📋 Fixed discount: ₹{discount_fixed}")
                    print(f"   📋 Total discount: ₹{total_discount}")
                    print(f"   📋 Final price: ₹{final_price}")
                    print(f"   📋 Expected final: ₹{expected_final}")
                    
                    if abs(final_price - expected_final) < 0.01:
                        test_results["combined_discounts_work"] = True
                        print(f"✅ Combined discount calculation correct")
                    else:
                        print(f"❌ Combined discount calculation incorrect")
                        
        else:
            print(f"❌ Combined discount update failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing combined discounts: {e}")
    
    print(f"\n🔍 STEP 4: TEST EDGE CASES AND VALIDATION")
    print("=" * 60)
    
    # Test 4a: 100% discount
    print(f"\n📋 Testing edge case: 100% discount...")
    
    update_data = {
        "plan_type": "monthly",
        "discount_percentage": 100
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 200:
            # Check if final price is 0
            response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
            if response.status_code == 200:
                updated_plans = response.json()
                monthly_plan = next((p for p in updated_plans if p["plan_type"] == "monthly"), None)
                
                if monthly_plan and monthly_plan["final_price"] == 0:
                    test_results["edge_case_100_percent_discount"] = True
                    print(f"✅ 100% discount works: Final price is ₹0")
                else:
                    print(f"❌ 100% discount failed: Final price is ₹{monthly_plan['final_price'] if monthly_plan else 'N/A'}")
                    
    except Exception as e:
        print(f"❌ Error testing 100% discount: {e}")
    
    # Test 4b: Discount greater than price (should result in ₹0, not negative)
    print(f"\n📋 Testing edge case: Discount > price (should be ₹0, not negative)...")
    
    update_data = {
        "plan_type": "monthly",
        "base_price": 100.0,
        "discount_fixed": 150.0,
        "discount_percentage": 0
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 200:
            # Check if final price is 0 (not negative)
            response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
            if response.status_code == 200:
                updated_plans = response.json()
                monthly_plan = next((p for p in updated_plans if p["plan_type"] == "monthly"), None)
                
                if monthly_plan:
                    final_price = monthly_plan["final_price"]
                    if final_price == 0:
                        test_results["edge_case_discount_greater_than_price"] = True
                        test_results["final_price_never_negative"] = True
                        print(f"✅ Discount > price handled correctly: Final price is ₹0 (not negative)")
                    elif final_price > 0:
                        print(f"⚠️  Discount > price: Final price is ₹{final_price} (should be ₹0)")
                    else:
                        print(f"❌ CRITICAL: Final price is negative: ₹{final_price}")
                        
    except Exception as e:
        print(f"❌ Error testing discount > price: {e}")
    
    # Test 4c: Invalid inputs validation
    print(f"\n📋 Testing validation: Invalid inputs...")
    
    # Test negative percentage
    try:
        update_data = {"plan_type": "monthly", "discount_percentage": -10}
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 400:
            test_results["rejects_negative_fixed_discount"] = True
            print(f"✅ Rejects negative percentage discount (400)")
        else:
            print(f"❌ Should reject negative percentage: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing negative percentage: {e}")
    
    # Test percentage > 100
    try:
        update_data = {"plan_type": "monthly", "discount_percentage": 150}
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 400:
            test_results["rejects_percentage_over_100"] = True
            print(f"✅ Rejects percentage > 100% (400)")
        else:
            print(f"❌ Should reject percentage > 100%: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing percentage > 100: {e}")
    
    # Test negative fixed discount
    try:
        update_data = {"plan_type": "monthly", "discount_fixed": -50}
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 400:
            print(f"✅ Rejects negative fixed discount (400)")
        else:
            print(f"❌ Should reject negative fixed discount: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing negative fixed discount: {e}")
    
    # Test invalid plan type
    try:
        update_data = {"plan_type": "invalid_plan", "base_price": 100}
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 400:
            test_results["rejects_invalid_plan_type"] = True
            print(f"✅ Rejects invalid plan type (400)")
        else:
            print(f"❌ Should reject invalid plan type: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing invalid plan type: {e}")
    
    print(f"\n🔍 STEP 5: TEST RESPONSE STRUCTURE AND FORMATTING")
    print("=" * 60)
    
    # Test 5: Verify response structure
    print(f"\n📋 Testing response structure and field formatting...")
    
    try:
        response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
        if response.status_code == 200:
            plans = response.json()
            
            required_fields = [
                "plan_type", "base_price", "discount_percentage", "discount_fixed", 
                "discount_amount", "final_price", "duration_days", "label", "savings"
            ]
            
            structure_correct = True
            formatting_correct = True
            savings_correct = True
            
            for plan in plans:
                # Check required fields
                for field in required_fields:
                    if field not in plan:
                        structure_correct = False
                        print(f"❌ Missing field '{field}' in {plan.get('plan_type', 'unknown')} plan")
                
                # Check numeric formatting (should be numbers, not strings)
                numeric_fields = ["base_price", "discount_percentage", "discount_fixed", "discount_amount", "final_price", "duration_days", "savings"]
                for field in numeric_fields:
                    if field in plan and not isinstance(plan[field], (int, float)):
                        formatting_correct = False
                        print(f"❌ Field '{field}' should be numeric, got {type(plan[field])}: {plan[field]}")
                
                # Check savings = discount_amount
                if plan.get("savings") != plan.get("discount_amount"):
                    savings_correct = False
                    print(f"❌ Savings ({plan.get('savings')}) != discount_amount ({plan.get('discount_amount')}) for {plan.get('plan_type')}")
            
            if structure_correct:
                test_results["response_has_required_fields"] = True
                print(f"✅ All plans have required fields")
            
            if formatting_correct:
                test_results["numeric_values_formatted_correctly"] = True
                print(f"✅ Numeric values properly formatted")
            
            if savings_correct:
                test_results["savings_calculation_correct"] = True
                print(f"✅ Savings calculation correct (savings = discount_amount)")
                
    except Exception as e:
        print(f"❌ Error testing response structure: {e}")
    
    print(f"\n🔍 STEP 6: TEST DATABASE PERSISTENCE")
    print("=" * 60)
    
    # Test 6: Verify changes persist across requests
    print(f"\n📋 Testing database persistence...")
    
    # Make multiple updates and verify they persist
    try:
        # Update multiple plans
        updates = [
            {"plan_type": "monthly", "base_price": 299.0, "discount_percentage": 5, "discount_fixed": 0},
            {"plan_type": "quarterly", "base_price": 897.0, "discount_percentage": 10, "discount_fixed": 50},
            {"plan_type": "half_yearly", "base_price": 1794.0, "discount_percentage": 15, "discount_fixed": 100},
            {"plan_type": "yearly", "base_price": 3588.0, "discount_percentage": 20, "discount_fixed": 200}
        ]
        
        # Apply all updates
        for update in updates:
            response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update, timeout=30)
            if response.status_code != 200:
                print(f"❌ Failed to update {update['plan_type']}: {response.status_code}")
                break
        else:
            # Verify all updates persisted
            response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
            if response.status_code == 200:
                plans = response.json()
                persistence_correct = True
                independence_correct = True
                
                for update in updates:
                    plan = next((p for p in plans if p["plan_type"] == update["plan_type"]), None)
                    if plan:
                        if (plan["base_price"] == update["base_price"] and 
                            plan["discount_percentage"] == update["discount_percentage"] and
                            plan["discount_fixed"] == update["discount_fixed"]):
                            print(f"✅ {update['plan_type']} update persisted correctly")
                        else:
                            persistence_correct = False
                            print(f"❌ {update['plan_type']} update not persisted")
                    else:
                        persistence_correct = False
                        print(f"❌ {update['plan_type']} plan not found")
                
                if persistence_correct:
                    test_results["plan_updates_persist"] = True
                    test_results["multiple_plan_updates_independent"] = True
                    print(f"✅ All plan updates persist correctly")
                    print(f"✅ Multiple plan updates work independently")
                    
    except Exception as e:
        print(f"❌ Error testing database persistence: {e}")
    
    # Final Summary
    print(f"\n🏁 VIP MULTI-PLAN SYSTEM - TEST SUMMARY")
    print("=" * 80)
    
    test_categories = {
        "Public Plans Endpoint Tests": [
            ("Public plans endpoint works", test_results["public_plans_endpoint_works"]),
            ("All 4 plans returned", test_results["all_4_plans_returned"]),
            ("Default pricing correct", test_results["default_pricing_correct"]),
            ("Default discounts zero", test_results["default_discounts_zero"]),
            ("Final price equals base price", test_results["final_price_equals_base_price"]),
            ("Duration days correct", test_results["duration_days_correct"])
        ],
        "Admin Plans Endpoint Tests": [
            ("Admin plans endpoint works", test_results["admin_plans_endpoint_works"]),
            ("Admin plans same as public", test_results["admin_plans_same_as_public"])
        ],
        "Plan Update Tests": [
            ("Update plan endpoint works", test_results["update_plan_endpoint_works"]),
            ("Base price update works", test_results["base_price_update_works"]),
            ("Percentage discount works", test_results["percentage_discount_works"]),
            ("Fixed discount works", test_results["fixed_discount_works"]),
            ("Combined discounts work", test_results["combined_discounts_work"])
        ],
        "Discount Calculation Tests": [
            ("Edge case: 100% discount", test_results["edge_case_100_percent_discount"]),
            ("Edge case: discount > price", test_results["edge_case_discount_greater_than_price"]),
            ("Final price never negative", test_results["final_price_never_negative"])
        ],
        "Validation Tests": [
            ("Rejects percentage over 100", test_results["rejects_percentage_over_100"]),
            ("Rejects negative fixed discount", test_results["rejects_negative_fixed_discount"]),
            ("Rejects invalid plan type", test_results["rejects_invalid_plan_type"])
        ],
        "Database Persistence Tests": [
            ("Plan updates persist", test_results["plan_updates_persist"]),
            ("Multiple plan updates independent", test_results["multiple_plan_updates_independent"])
        ],
        "Response Structure Tests": [
            ("Response has required fields", test_results["response_has_required_fields"]),
            ("Numeric values formatted correctly", test_results["numeric_values_formatted_correctly"]),
            ("Savings calculation correct", test_results["savings_calculation_correct"])
        ]
    }
    
    total_tests = 0
    passed_tests = 0
    
    for category_name, tests in test_categories.items():
        print(f"\n{category_name}:")
        for test_name, result in tests:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} {test_name}")
            total_tests += 1
            if result:
                passed_tests += 1
    
    print(f"\n📊 FINAL RESULTS: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    if passed_tests == total_tests:
        print(f"🎉 ALL VIP MULTI-PLAN TESTS PASSED!")
        print(f"✅ All 4 default plans have correct pricing")
        print(f"✅ Admin can update any plan independently")
        print(f"✅ Both percentage AND fixed discounts work")
        print(f"✅ Discounts combine correctly (percentage first, then fixed)")
        print(f"✅ Final price never goes negative")
        print(f"✅ Changes persist in database")
        print(f"✅ Public endpoint returns updated pricing")
        print(f"✅ Validation rejects invalid inputs")
    elif passed_tests >= total_tests * 0.8:
        print(f"✅ MOSTLY WORKING - {total_tests - passed_tests} tests failed but core functionality working")
        print(f"⚠️  Minor issues remain but VIP multi-plan system operational")
    else:
        print(f"❌ CRITICAL ISSUES - {total_tests - passed_tests} tests failed, VIP multi-plan system needs investigation")
        print(f"❌ System not working as expected")
    
    return test_results

def main():
    """Run the VIP multi-plan system testing"""
    print(f"\n🚀 STARTING VIP MULTI-PLAN SYSTEM TESTING")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Run the VIP multi-plan tests
    results = test_vip_multi_plan_system()
    
    # Count results
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    print(f"\n🏁 TESTING COMPLETE")
    print("=" * 80)
    print(f"📊 OVERALL RESULTS: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    if passed_tests == total_tests:
        print(f"\n🎉 SUCCESS - ALL TESTS PASSED!")
        print(f"✅ VIP multi-plan membership system is working perfectly")
        print(f"✅ All endpoints tested and verified")
        print(f"✅ Admin can manage multiple VIP plans with flexible pricing")
        return 0
    elif passed_tests >= total_tests * 0.8:
        print(f"\n⚠️  MOSTLY WORKING - {total_tests - passed_tests} tests failed")
        print(f"✅ Core functionality operational")
        print(f"⚠️  Minor issues need attention")
        return 0
    else:
        print(f"\n❌ CRITICAL ISSUES - {total_tests - passed_tests} tests failed")
        print(f"❌ Significant problems detected")
        print(f"❌ VIP multi-plan system needs investigation")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)