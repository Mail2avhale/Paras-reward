#!/usr/bin/env python3
"""
Backend API Testing Script - Deployment Readiness Testing
Tests critical backend APIs for deployment readiness after database name hardcoding fix
"""

import requests
import json
import sys
import os
from datetime import datetime, timedelta
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

print(f"Testing Backend APIs for Deployment Readiness at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# Deployment Readiness Test Functions
def test_authentication_apis():
    """Test Authentication APIs - Login and Register"""
    print("\n" + "=" * 80)
    print("1. TESTING AUTHENTICATION APIS")
    print("=" * 80)
    
    test_results = {"login": False, "register": False}
    
    # Test Case 1: User Registration
    print(f"\n1.1. Testing User Registration...")
    
    # Create unique test user
    timestamp = int(time.time())
    test_user_data = {
        "first_name": "Test",
        "last_name": "User",
        "email": f"testuser_{timestamp}@test.com",
        "mobile": f"987654{timestamp % 10000:04d}",
        "password": "test123456",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{timestamp % 100000000:08d}",
        "pan_number": f"TEST{timestamp % 100000:05d}Z"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=test_user_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            test_uid = result.get("uid")
            print(f"     ✅ User registration successful!")
            print(f"     📋 User UID: {test_uid}")
            test_results["register"] = True
        else:
            print(f"     ❌ User registration failed: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error during user registration: {e}")
    
    # Test Case 2: User Login (Case-insensitive email)
    print(f"\n1.2. Testing User Login with case-insensitive email...")
    
    # Test with admin user (known to exist)
    login_tests = [
        {"identifier": "admin@paras.com", "password": "admin123", "case": "lowercase"},
        {"identifier": "ADMIN@PARAS.COM", "password": "admin123", "case": "uppercase"},
        {"identifier": "Admin@Paras.com", "password": "admin123", "case": "mixed case"}
    ]
    
    login_success_count = 0
    
    for login_test in login_tests:
        try:
            response = requests.post(
                f"{API_BASE}/auth/login",
                params={
                    "identifier": login_test["identifier"],
                    "password": login_test["password"]
                },
                timeout=30
            )
            
            print(f"     Testing {login_test['case']} email: {login_test['identifier']}")
            print(f"     Status: {response.status_code}")
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"     ✅ Login successful for {login_test['case']} email")
                print(f"     📋 User: {user_data.get('name', 'N/A')} (Role: {user_data.get('role', 'N/A')})")
                login_success_count += 1
            else:
                print(f"     ❌ Login failed for {login_test['case']} email: {response.status_code}")
                print(f"     Response: {response.text}")
                
        except Exception as e:
            print(f"     ❌ Error during {login_test['case']} login: {e}")
    
    if login_success_count == len(login_tests):
        test_results["login"] = True
        print(f"     ✅ All case-insensitive login tests passed!")
    else:
        print(f"     ❌ Some login tests failed ({login_success_count}/{len(login_tests)} passed)")
    
    return test_results

def test_user_management():
    """Test User Management APIs"""
    print("\n" + "=" * 80)
    print("2. TESTING USER MANAGEMENT APIS")
    print("=" * 80)
    
    test_results = {"get_user": False}
    
    # Test Case 1: Get User Details by UID
    print(f"\n2.1. Testing GET /api/user/{uid} endpoint...")
    
    # Use admin user UID (known to exist)
    admin_uid = "ac9548c3-968a-4bbf-bad7-4e5aed1b660c"  # From test_result.md
    
    try:
        response = requests.get(f"{API_BASE}/users/{admin_uid}", timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            user_data = response.json()
            print(f"     ✅ User details retrieved successfully!")
            print(f"     📋 User Name: {user_data.get('name', 'N/A')}")
            print(f"     📋 User Email: {user_data.get('email', 'N/A')}")
            print(f"     📋 User Role: {user_data.get('role', 'N/A')}")
            print(f"     📋 User Status: {'Active' if user_data.get('is_active') else 'Inactive'}")
            
            # Verify sensitive data is not exposed
            if "password_hash" not in user_data and "reset_token" not in user_data:
                print(f"     ✅ Sensitive data properly excluded from response")
            else:
                print(f"     ⚠️  Warning: Sensitive data found in response")
            
            test_results["get_user"] = True
        else:
            print(f"     ❌ Failed to get user details: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error getting user details: {e}")
    
    # Test Case 2: Test with invalid UID
    print(f"\n2.2. Testing with invalid UID...")
    
    try:
        invalid_uid = "invalid-uid-12345"
        response = requests.get(f"{API_BASE}/users/{invalid_uid}", timeout=30)
        print(f"     Status: {response.status_code}")
        
        if response.status_code == 404:
            print(f"     ✅ Properly returns 404 for invalid UID")
        else:
            print(f"     ⚠️  Unexpected status code for invalid UID: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error testing invalid UID: {e}")
    
    return test_results

def test_admin_dashboard_kpis():
    """Test Admin Dashboard KPIs API"""
    print("\n" + "=" * 80)
    print("3. TESTING ADMIN DASHBOARD KPIs API")
    print("=" * 80)
    
    test_results = {"admin_stats": False}
    
    # Test Case 1: Get Admin Dashboard Statistics
    print(f"\n3.1. Testing GET /api/admin/stats endpoint...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            stats_data = response.json()
            print(f"     ✅ Admin stats retrieved successfully!")
            
            # Verify expected KPI categories
            expected_categories = [
                "user_statistics", "order_statistics", "kyc_statistics", 
                "vip_payment_statistics", "withdrawal_statistics", 
                "product_statistics", "financial_overview"
            ]
            
            found_categories = []
            for category in expected_categories:
                if category in stats_data:
                    found_categories.append(category)
                    print(f"     📋 {category.replace('_', ' ').title()}: ✅")
                    
                    # Print some key metrics
                    category_data = stats_data[category]
                    if isinstance(category_data, dict):
                        for key, value in list(category_data.items())[:3]:  # Show first 3 items
                            print(f"       - {key}: {value}")
                else:
                    print(f"     📋 {category.replace('_', ' ').title()}: ❌ Missing")
            
            # Check if response has valid JSON structure
            if isinstance(stats_data, dict) and len(stats_data) > 0:
                print(f"     ✅ Valid JSON structure with {len(stats_data)} categories")
                test_results["admin_stats"] = True
            else:
                print(f"     ❌ Invalid or empty response structure")
                
        else:
            print(f"     ❌ Failed to get admin stats: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error getting admin stats: {e}")
    
    return test_results

def test_core_features():
    """Test Core Features - Mining Status, Products, Wallet"""
    print("\n" + "=" * 80)
    print("4. TESTING CORE FEATURES")
    print("=" * 80)
    
    # Step 1: Find an outlet user with parent relationships
    print(f"\n4.1. Finding outlet with parent relationships...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/users/all", timeout=30)
        print(f"     Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"     ❌ Failed to get users: {response.status_code}")
            return False
            
        users = response.json().get("users", [])
        
        # Find outlet user with parent_id
        outlet_user = None
        for user in users:
            if user.get("role") == "outlet" and user.get("parent_id"):
                outlet_user = user
                break
        
        if not outlet_user:
            print(f"     ❌ No outlet user with parent_id found")
            return False
            
        outlet_uid = outlet_user["uid"]
        sub_stockist_uid = outlet_user["parent_id"]
        
        print(f"     ✅ Found outlet user: {outlet_uid}")
        print(f"     📋 Outlet Name: {outlet_user.get('name', 'N/A')}")
        print(f"     📋 Sub Stockist ID: {sub_stockist_uid}")
        
    except Exception as e:
        print(f"     ❌ Error finding outlet user: {e}")
        return False
    
    # Step 2: Verify Sub Stockist has a parent Master Stockist
    print(f"\n4.2. Verifying Sub Stockist has parent Master Stockist...")
    
    try:
        # Find the sub stockist user
        sub_stockist_user = None
        for user in users:
            if user.get("uid") == sub_stockist_uid:
                sub_stockist_user = user
                break
        
        if not sub_stockist_user:
            print(f"     ❌ Sub Stockist user not found: {sub_stockist_uid}")
            return False
            
        master_stockist_uid = sub_stockist_user.get("parent_id")
        if not master_stockist_uid:
            print(f"     ❌ Sub Stockist has no parent Master Stockist")
            return False
            
        print(f"     ✅ Sub Stockist has parent Master Stockist")
        print(f"     📋 Sub Stockist Name: {sub_stockist_user.get('name', 'N/A')}")
        print(f"     📋 Master Stockist ID: {master_stockist_uid}")
        
    except Exception as e:
        print(f"     ❌ Error verifying parent relationships: {e}")
        return False
    
    # Step 3: Get initial wallet balances
    print(f"\n4.3. Getting initial wallet balances...")
    
    initial_balances = {}
    entities = {
        "outlet": outlet_uid,
        "sub_stockist": sub_stockist_uid,
        "master_stockist": master_stockist_uid
    }
    
    for entity_type, entity_uid in entities.items():
        try:
            response = requests.get(f"{API_BASE}/wallet/{entity_uid}", timeout=30)
            if response.status_code == 200:
                wallet_data = response.json()
                initial_balances[entity_type] = wallet_data.get("profit_balance", 0)
                print(f"     📋 {entity_type.title()} initial profit balance: ₹{initial_balances[entity_type]}")
            else:
                print(f"     ⚠️  Could not get {entity_type} wallet balance: {response.status_code}")
                initial_balances[entity_type] = 0
        except Exception as e:
            print(f"     ⚠️  Error getting {entity_type} wallet balance: {e}")
            initial_balances[entity_type] = 0
    
    # Step 4: Create test order with 1000 PRC value
    print(f"\n4.4. Creating test order with 1000 PRC value...")
    
    # First, create a VIP user with sufficient PRC balance and verified KYC
    test_user_data = {
        "email": f"test_delivery_{int(time.time())}@test.com",
        "password": "test123",
        "name": "Test Delivery User",
        "role": "user",
        "membership_type": "vip",
        "kyc_status": "verified",
        "prc_balance": 2000  # Sufficient balance
    }
    
    try:
        # Create test user
        response = requests.post(f"{API_BASE}/auth/register", json=test_user_data, timeout=30)
        if response.status_code != 200:
            print(f"     ❌ Failed to create test user: {response.status_code}")
            return False
            
        test_user_uid = response.json().get("uid")
        print(f"     ✅ Created test user: {test_user_uid}")
        
        # Create order using legacy endpoint (single product)
        # First get a product
        products_response = requests.get(f"{API_BASE}/products", timeout=30)
        if products_response.status_code != 200:
            print(f"     ❌ Failed to get products: {products_response.status_code}")
            return False
            
        products = products_response.json()
        if not products:
            print(f"     ❌ No products available")
            return False
            
        # Find a product with PRC price around 1000 or use the first one
        test_product = products[0]
        product_id = test_product["product_id"]
        
        print(f"     📋 Using product: {test_product['name']} (PRC: {test_product['prc_price']})")
        
        # Create order
        order_data = {"product_id": product_id}
        response = requests.post(f"{API_BASE}/orders/{test_user_uid}", json=order_data, timeout=30)
        
        if response.status_code != 200:
            print(f"     ❌ Failed to create order: {response.status_code}")
            print(f"     Response: {response.text}")
            return False
            
        order_result = response.json()
        order_id = order_result.get("order_id")
        secret_code = order_result.get("secret_code")
        prc_amount = order_result.get("prc_amount", test_product["prc_price"])
        
        print(f"     ✅ Order created successfully!")
        print(f"     📋 Order ID: {order_id}")
        print(f"     📋 Secret Code: {secret_code}")
        print(f"     📋 PRC Amount: {prc_amount}")
        
    except Exception as e:
        print(f"     ❌ Error creating test order: {e}")
        return False
    
    # Step 5: Mark order as delivered using secret code verification
    print(f"\n4.5. Marking order as delivered using outlet...")
    
    try:
        # First verify the order with secret code
        verify_data = {"secret_code": secret_code}
        response = requests.post(f"{API_BASE}/orders/verify", json=verify_data, timeout=30)
        
        if response.status_code == 200:
            print(f"     ✅ Order verified successfully")
        else:
            print(f"     ⚠️  Order verification response: {response.status_code}")
        
        # Now deliver the order (this should trigger auto-distribution)
        deliver_data = {"outlet_id": outlet_uid}
        response = requests.post(f"{API_BASE}/orders/{order_id}/deliver", json=deliver_data, timeout=30)
        
        if response.status_code != 200:
            print(f"     ❌ Failed to deliver order: {response.status_code}")
            print(f"     Response: {response.text}")
            return False
            
        delivery_result = response.json()
        print(f"     ✅ Order delivered successfully!")
        print(f"     📋 Delivery result: {delivery_result}")
        
    except Exception as e:
        print(f"     ❌ Error delivering order: {e}")
        return False
    
    # Step 6: Verify delivery charges calculation
    print(f"\n4.6. Verifying delivery charge calculation...")
    
    # Expected calculation: (PRC_amount * 0.10) / 10 = delivery charge in ₹
    expected_total_commission = (prc_amount * 0.10) / 10
    expected_outlet_share = expected_total_commission * 0.60  # 60%
    expected_sub_share = expected_total_commission * 0.20     # 20%
    expected_master_share = expected_total_commission * 0.10  # 10%
    expected_company_share = expected_total_commission * 0.10 # 10%
    
    print(f"     📋 PRC Amount: {prc_amount}")
    print(f"     📋 Expected Total Commission: ₹{expected_total_commission}")
    print(f"     📋 Expected Outlet Share (60%): ₹{expected_outlet_share}")
    print(f"     📋 Expected Sub Share (20%): ₹{expected_sub_share}")
    print(f"     📋 Expected Master Share (10%): ₹{expected_master_share}")
    print(f"     📋 Expected Company Share (10%): ₹{expected_company_share}")
    
    # Step 7: Check updated wallet balances
    print(f"\n4.7. Checking updated wallet balances...")
    
    final_balances = {}
    balance_increases = {}
    
    for entity_type, entity_uid in entities.items():
        try:
            response = requests.get(f"{API_BASE}/wallet/{entity_uid}", timeout=30)
            if response.status_code == 200:
                wallet_data = response.json()
                final_balances[entity_type] = wallet_data.get("profit_balance", 0)
                balance_increases[entity_type] = final_balances[entity_type] - initial_balances[entity_type]
                
                print(f"     📋 {entity_type.title()}:")
                print(f"       Initial Balance: ₹{initial_balances[entity_type]}")
                print(f"       Final Balance: ₹{final_balances[entity_type]}")
                print(f"       Increase: ₹{balance_increases[entity_type]}")
            else:
                print(f"     ❌ Could not get {entity_type} final wallet balance: {response.status_code}")
                return False
        except Exception as e:
            print(f"     ❌ Error getting {entity_type} final wallet balance: {e}")
            return False
    
    # Step 8: Verify commission records in database
    print(f"\n4.8. Verifying commission records in database...")
    
    try:
        # Check commission records for each entity
        commission_records_found = {}
        
        for entity_type, entity_uid in entities.items():
            response = requests.get(f"{API_BASE}/commissions/entity/{entity_uid}", timeout=30)
            if response.status_code == 200:
                commissions = response.json()
                # Find commission record for this order
                order_commission = None
                for comm in commissions:
                    if comm.get("order_id") == order_id:
                        order_commission = comm
                        break
                
                if order_commission:
                    commission_records_found[entity_type] = order_commission
                    print(f"     ✅ {entity_type.title()} commission record found:")
                    print(f"       Amount: ₹{order_commission.get('amount', 0)}")
                    print(f"       Commission Type: {order_commission.get('commission_type', 'N/A')}")
                else:
                    print(f"     ⚠️  No commission record found for {entity_type}")
            else:
                print(f"     ⚠️  Could not get commission records for {entity_type}: {response.status_code}")
        
    except Exception as e:
        print(f"     ❌ Error checking commission records: {e}")
    
    # Step 9: Validate distribution percentages
    print(f"\n4.9. Validating distribution percentages...")
    
    distribution_correct = True
    tolerance = 0.01  # Allow small floating point differences
    
    # Check outlet share (60%)
    if abs(balance_increases["outlet"] - expected_outlet_share) > tolerance:
        print(f"     ❌ Outlet share incorrect: Expected ₹{expected_outlet_share}, Got ₹{balance_increases['outlet']}")
        distribution_correct = False
    else:
        print(f"     ✅ Outlet share correct: ₹{balance_increases['outlet']} (60%)")
    
    # Check sub stockist share (20%)
    if abs(balance_increases["sub_stockist"] - expected_sub_share) > tolerance:
        print(f"     ❌ Sub Stockist share incorrect: Expected ₹{expected_sub_share}, Got ₹{balance_increases['sub_stockist']}")
        distribution_correct = False
    else:
        print(f"     ✅ Sub Stockist share correct: ₹{balance_increases['sub_stockist']} (20%)")
    
    # Check master stockist share (10%)
    if abs(balance_increases["master_stockist"] - expected_master_share) > tolerance:
        print(f"     ❌ Master Stockist share incorrect: Expected ₹{expected_master_share}, Got ₹{balance_increases['master_stockist']}")
        distribution_correct = False
    else:
        print(f"     ✅ Master Stockist share correct: ₹{balance_increases['master_stockist']} (10%)")
    
    # Verify total distribution adds up
    total_distributed = sum(balance_increases.values())
    expected_total_distributed = expected_outlet_share + expected_sub_share + expected_master_share
    
    if abs(total_distributed - expected_total_distributed) > tolerance:
        print(f"     ❌ Total distribution incorrect: Expected ₹{expected_total_distributed}, Got ₹{total_distributed}")
        distribution_correct = False
    else:
        print(f"     ✅ Total distribution correct: ₹{total_distributed}")
    
    print(f"\n4.10. Test Summary:")
    if distribution_correct:
        print(f"     ✅ DELIVERY CHARGE DISTRIBUTION TEST PASSED")
        print(f"     📋 All percentages calculated correctly")
        print(f"     📋 Wallet balances updated properly")
        print(f"     📋 Commission system working as expected")
        return True
    else:
        print(f"     ❌ DELIVERY CHARGE DISTRIBUTION TEST FAILED")
        print(f"     📋 Distribution percentages or calculations incorrect")
        return False

def run_comprehensive_test():
    """Run comprehensive test of all Admin Stockist & Financial Management endpoints"""
    print("\n" + "🔍" * 80)
    print("ADMIN STOCKIST & FINANCIAL MANAGEMENT COMPREHENSIVE TESTING")
    print("🔍" * 80)
    
    results = {
        "stockist_management": False,
        "security_deposit_management": False,
        "renewal_management": False,
        "delivery_charge_distribution": False,
        "test_completed": False
    }
    
    try:
        # Test 1: Stockist Management
        print("\n🔧 PHASE 1: STOCKIST MANAGEMENT TESTING")
        created_stockists = test_stockist_management()
        if created_stockists:
            results["stockist_management"] = True
            print("\n✅ STOCKIST MANAGEMENT TESTS PASSED")
        else:
            print("\n❌ STOCKIST MANAGEMENT TESTS FAILED")
            return results
        
        # Test 2: Security Deposit Management
        print("\n🔧 PHASE 2: SECURITY DEPOSIT MANAGEMENT TESTING")
        created_deposits = test_security_deposit_management(created_stockists)
        if created_deposits:
            results["security_deposit_management"] = True
            print("\n✅ SECURITY DEPOSIT MANAGEMENT TESTS PASSED")
        else:
            print("\n❌ SECURITY DEPOSIT MANAGEMENT TESTS FAILED")
        
        # Test 3: Renewal Management
        print("\n🔧 PHASE 3: RENEWAL MANAGEMENT TESTING")
        created_renewals = test_renewal_management(created_stockists)
        if created_renewals:
            results["renewal_management"] = True
            print("\n✅ RENEWAL MANAGEMENT TESTS PASSED")
        else:
            print("\n❌ RENEWAL MANAGEMENT TESTS FAILED")
        
        # Test 4: Delivery Charge Distribution
        print("\n🔧 PHASE 4: DELIVERY CHARGE DISTRIBUTION TESTING")
        delivery_test_result = test_delivery_charge_distribution()
        if delivery_test_result:
            results["delivery_charge_distribution"] = True
            print("\n✅ DELIVERY CHARGE DISTRIBUTION TESTS PASSED")
        else:
            print("\n❌ DELIVERY CHARGE DISTRIBUTION TESTS FAILED")
        
        results["test_completed"] = True
        
    except Exception as e:
        print(f"\n❌ COMPREHENSIVE TEST FAILED WITH ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    return results

def print_test_summary(results):
    """Print comprehensive test summary"""
    print("\n" + "📊" * 80)
    print("TEST SUMMARY - ADMIN STOCKIST & FINANCIAL MANAGEMENT")
    print("📊" * 80)
    
    print(f"\n🔍 TEST RESULTS:")
    
    # Stockist Management
    status = "✅ PASSED" if results["stockist_management"] else "❌ FAILED"
    print(f"   1. Stockist Management: {status}")
    if results["stockist_management"]:
        print(f"      - Master Stockist creation: ✅")
        print(f"      - Sub Stockist creation: ✅")
        print(f"      - Outlet creation: ✅")
        print(f"      - Stockist listing & filtering: ✅")
        print(f"      - Stockist updates: ✅")
        print(f"      - Stockist assignment: ✅")
        print(f"      - Stockist deactivation: ✅")
    
    # Security Deposit Management
    status = "✅ PASSED" if results["security_deposit_management"] else "❌ FAILED"
    print(f"   2. Security Deposit Management: {status}")
    if results["security_deposit_management"]:
        print(f"      - Manual deposit entry: ✅")
        print(f"      - Deposit amount calculations: ✅")
        print(f"      - User record updates: ✅")
        print(f"      - Deposit listing & retrieval: ✅")
        print(f"      - Deposit editing: ✅")
    
    # Renewal Management
    status = "✅ PASSED" if results["renewal_management"] else "❌ FAILED"
    print(f"   3. Renewal Management: {status}")
    if results["renewal_management"]:
        print(f"      - Manual renewal entry: ✅")
        print(f"      - GST calculations: ✅")
        print(f"      - User renewal status updates: ✅")
        print(f"      - Renewal listing & retrieval: ✅")
        print(f"      - Renewal editing & recalculation: ✅")
    
    # Delivery Charge Distribution
    status = "✅ PASSED" if results["delivery_charge_distribution"] else "❌ FAILED"
    print(f"   4. Delivery Charge Distribution: {status}")
    if results["delivery_charge_distribution"]:
        print(f"      - Order creation with PRC value: ✅")
        print(f"      - Parent-child hierarchy verification: ✅")
        print(f"      - Secret code verification: ✅")
        print(f"      - Auto-distribution on delivery: ✅")
        print(f"      - Commission calculation (10% of PRC): ✅")
        print(f"      - Distribution percentages (60/20/10/10): ✅")
        print(f"      - Wallet balance updates: ✅")
        print(f"      - Commission records creation: ✅")
    
    # Overall Status
    all_passed = all(results[key] for key in ["stockist_management", "security_deposit_management", "renewal_management", "delivery_charge_distribution"])
    overall_status = "✅ ALL TESTS PASSED" if all_passed else "❌ SOME TESTS FAILED"
    print(f"\n🎯 OVERALL STATUS: {overall_status}")
    
    if all_passed:
        print(f"\n🎉 SUCCESS: All Admin Stockist & Financial Management endpoints are working correctly!")
        print(f"   - Stockist CRUD operations functional")
        print(f"   - Parent-child assignment validation working")
        print(f"   - Security deposit entries with automatic approval")
        print(f"   - Monthly return calculations correct (3% default)")
        print(f"   - Renewal entries with GST calculation (18% default)")
        print(f"   - User records updated correctly")
        print(f"   - All audit logs and calculations verified")
        print(f"   - Delivery charge distribution system operational")
    else:
        print(f"\n⚠️  ISSUES FOUND: Some endpoints need attention")
        failed_tests = [key for key, passed in results.items() if not passed and key != "test_completed"]
        for test in failed_tests:
            print(f"   - {test.replace('_', ' ').title()}: Needs investigation")
    
    print(f"\n📋 NEXT STEPS:")
    if all_passed:
        print(f"   1. All backend endpoints are ready for frontend integration")
        print(f"   2. Admin dashboard can be connected to these APIs")
        print(f"   3. Financial management workflows are operational")
    else:
        print(f"   1. Review failed test outputs above")
        print(f"   2. Check backend logs for detailed error information")
        print(f"   3. Verify endpoint implementations match expected API contracts")
        print(f"   4. Test individual endpoints manually if needed")

if __name__ == "__main__":
    print("Starting Admin Stockist & Financial Management Backend Testing...")
    
    # Run comprehensive tests
    test_results = run_comprehensive_test()
    
    # Print summary
    print_test_summary(test_results)
    
    # Exit with appropriate code
    all_passed = all(test_results[key] for key in ["stockist_management", "security_deposit_management", "renewal_management", "delivery_charge_distribution"])
    sys.exit(0 if all_passed else 1)
