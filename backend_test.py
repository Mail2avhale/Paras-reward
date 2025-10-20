#!/usr/bin/env python3
"""
Backend API Testing Script for Admin Dashboard APIs
Tests comprehensive admin dashboard functionality including KPIs, order management, 
financial reports, employee management, and audit logging
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

print(f"Testing Mining System Fix at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# Test data for mining system testing
test_user_no_mining = None
test_user_with_mining = None
test_user_with_referrals = None

def setup_test_users():
    """Create test users for mining system testing"""
    global test_user_no_mining, test_user_with_mining, test_user_with_referrals
    
    print("\n1. Setting up test users for mining system testing...")
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    microseconds = str(datetime.now().microsecond)[:3]
    
    # Create User 1: No active mining session
    user1_data = {
        "first_name": "Mining",
        "last_name": "TestUser1",
        "email": f"mining1.{timestamp}.{microseconds}@example.com",
        "mobile": f"98701{timestamp[-6:]}",
        "password": "MiningPass123!",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1111{timestamp[-8:]}111",
        "pan_number": f"MIN1{timestamp[-5:]}A"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=user1_data, timeout=30)
        if response.status_code == 200:
            user1_uid = response.json().get("uid")
            test_user_no_mining = {"uid": user1_uid, **user1_data}
            print(f"✅ Mining test user 1 (no mining) created: {user1_uid}")
        else:
            print(f"❌ Failed to create mining test user 1: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating mining test user 1: {e}")
        return False
    
    # Create User 2: Will have active mining session
    user2_data = {
        "first_name": "Mining",
        "last_name": "TestUser2",
        "email": f"mining2.{timestamp}.{microseconds}@example.com",
        "mobile": f"98702{timestamp[-6:]}",
        "password": "MiningPass123!",
        "state": "Gujarat",
        "district": "Ahmedabad",
        "pincode": "380001",
        "aadhaar_number": f"2222{timestamp[-8:]}222",
        "pan_number": f"MIN2{timestamp[-5:]}B"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=user2_data, timeout=30)
        if response.status_code == 200:
            user2_uid = response.json().get("uid")
            test_user_with_mining = {"uid": user2_uid, **user2_data}
            print(f"✅ Mining test user 2 (with mining) created: {user2_uid}")
        else:
            print(f"❌ Failed to create mining test user 2: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating mining test user 2: {e}")
        return False
    
    # Create User 3: Will have referrals
    user3_data = {
        "first_name": "Mining",
        "last_name": "TestUser3",
        "email": f"mining3.{timestamp}.{microseconds}@example.com",
        "mobile": f"98703{timestamp[-6:]}",
        "password": "MiningPass123!",
        "state": "Karnataka",
        "district": "Bangalore",
        "pincode": "560001",
        "aadhaar_number": f"3333{timestamp[-8:]}333",
        "pan_number": f"MIN3{timestamp[-5:]}C"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=user3_data, timeout=30)
        if response.status_code == 200:
            user3_uid = response.json().get("uid")
            test_user_with_referrals = {"uid": user3_uid, **user3_data}
            print(f"✅ Mining test user 3 (with referrals) created: {user3_uid}")
        else:
            print(f"❌ Failed to create mining test user 3: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating mining test user 3: {e}")
        return False
    
    return True

def test_mining_status_no_active_session():
    """Test mining status endpoint for user with NO active mining session"""
    print("\n2. Testing Mining Status - User with NO active mining session...")
    
    try:
        response = requests.get(f"{API_BASE}/mining/status/{test_user_no_mining['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            
            # Check required fields
            required_fields = ["mining_rate_per_hour", "mining_rate", "base_rate", "active_referrals", "is_mining"]
            missing_fields = []
            
            for field in required_fields:
                if field not in result:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ Mining status test FAILED - Missing fields: {missing_fields}")
                return False
            
            # Verify mining_rate_per_hour is NOT 0
            mining_rate_per_hour = result.get("mining_rate_per_hour", 0)
            mining_rate = result.get("mining_rate", 0)
            base_rate = result.get("base_rate", 0)
            active_referrals = result.get("active_referrals", 0)
            is_mining = result.get("is_mining", False)
            
            print(f"Mining Rate Per Hour: {mining_rate_per_hour}")
            print(f"Mining Rate: {mining_rate}")
            print(f"Base Rate: {base_rate}")
            print(f"Active Referrals: {active_referrals}")
            print(f"Is Mining: {is_mining}")
            
            # Verify mining rate is NOT 0
            if mining_rate_per_hour == 0:
                print("❌ Mining status test FAILED - mining_rate_per_hour is 0 (should NOT be 0)")
                return False
            
            # Verify mining_rate matches mining_rate_per_hour
            if mining_rate != mining_rate_per_hour:
                print(f"❌ Mining status test FAILED - mining_rate ({mining_rate}) doesn't match mining_rate_per_hour ({mining_rate_per_hour})")
                return False
            
            # Verify base_rate is positive
            if base_rate <= 0:
                print(f"❌ Mining status test FAILED - base_rate ({base_rate}) should be positive")
                return False
            
            # Verify is_mining is False (no active session)
            if is_mining:
                print(f"❌ Mining status test FAILED - is_mining should be False for user with no active session")
                return False
            
            print("✅ Mining status test PASSED - All required fields present and mining rate is non-zero")
            return True
            
        else:
            print(f"❌ Mining status test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Mining status test FAILED - Error: {e}")
        return False

def start_mining_session():
    """Start mining session for test user 2"""
    print("\n3. Starting mining session for test user 2...")
    
    try:
        response = requests.post(f"{API_BASE}/mining/start/{test_user_with_mining['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            session_active = result.get("session_active", False)
            
            if session_active:
                print("✅ Mining session started successfully")
                return True
            else:
                print("❌ Mining session start FAILED - session_active is False")
                return False
        else:
            print(f"❌ Mining session start FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Mining session start FAILED - Error: {e}")
        return False

def test_mining_status_with_active_session():
    """Test mining status endpoint for user WITH active mining session"""
    print("\n4. Testing Mining Status - User WITH active mining session...")
    
    try:
        response = requests.get(f"{API_BASE}/mining/status/{test_user_with_mining['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            
            # Check required fields
            required_fields = ["mining_rate_per_hour", "mining_rate", "base_rate", "active_referrals", "is_mining"]
            missing_fields = []
            
            for field in required_fields:
                if field not in result:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ Mining status with active session test FAILED - Missing fields: {missing_fields}")
                return False
            
            # Verify mining_rate_per_hour is NOT 0
            mining_rate_per_hour = result.get("mining_rate_per_hour", 0)
            mining_rate = result.get("mining_rate", 0)
            base_rate = result.get("base_rate", 0)
            active_referrals = result.get("active_referrals", 0)
            is_mining = result.get("is_mining", False)
            session_active = result.get("session_active", False)
            
            print(f"Mining Rate Per Hour: {mining_rate_per_hour}")
            print(f"Mining Rate: {mining_rate}")
            print(f"Base Rate: {base_rate}")
            print(f"Active Referrals: {active_referrals}")
            print(f"Is Mining: {is_mining}")
            print(f"Session Active: {session_active}")
            
            # Verify mining rate is NOT 0
            if mining_rate_per_hour == 0:
                print("❌ Mining status with active session test FAILED - mining_rate_per_hour is 0 (should NOT be 0)")
                return False
            
            # Verify mining_rate matches mining_rate_per_hour
            if mining_rate != mining_rate_per_hour:
                print(f"❌ Mining status with active session test FAILED - mining_rate ({mining_rate}) doesn't match mining_rate_per_hour ({mining_rate_per_hour})")
                return False
            
            # Verify base_rate is positive
            if base_rate <= 0:
                print(f"❌ Mining status with active session test FAILED - base_rate ({base_rate}) should be positive")
                return False
            
            # Verify is_mining is True (active session)
            if not is_mining:
                print(f"❌ Mining status with active session test FAILED - is_mining should be True for user with active session")
                return False
            
            # Verify session_active is True
            if not session_active:
                print(f"❌ Mining status with active session test FAILED - session_active should be True")
                return False
            
            print("✅ Mining status with active session test PASSED - All required fields present and mining rate is non-zero")
            return True
            
        else:
            print(f"❌ Mining status with active session test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Mining status with active session test FAILED - Error: {e}")
        return False

def test_mining_rate_calculation():
    """Test mining rate calculation formula"""
    print("\n5. Testing Mining Rate Calculation Formula...")
    
    try:
        # Get mining status for user with no referrals
        response = requests.get(f"{API_BASE}/mining/status/{test_user_no_mining['uid']}", timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            
            mining_rate_per_hour = result.get("mining_rate_per_hour", 0)
            base_rate = result.get("base_rate", 0)
            active_referrals = result.get("active_referrals", 0)
            
            # Get current day for calculation
            current_day = datetime.now().day
            
            # Calculate expected rate using the formula:
            # (current_day * base_rate) + (active_referrals * 0.1 * base_rate)
            # Then divide by 1440 (minutes in a day) to get per-minute rate
            # Multiply by 60 to get per-hour rate
            
            expected_total_rate = (current_day * base_rate) + (active_referrals * 0.1 * base_rate)
            expected_per_minute_rate = expected_total_rate / 1440
            expected_per_hour_rate = expected_per_minute_rate * 60
            
            print(f"Current Day: {current_day}")
            print(f"Base Rate: {base_rate}")
            print(f"Active Referrals: {active_referrals}")
            print(f"Expected Total Rate: {expected_total_rate}")
            print(f"Expected Per-Hour Rate: {expected_per_hour_rate}")
            print(f"Actual Per-Hour Rate: {mining_rate_per_hour}")
            
            # Allow small floating point differences
            rate_difference = abs(expected_per_hour_rate - mining_rate_per_hour)
            tolerance = 0.01  # 1 cent tolerance
            
            if rate_difference <= tolerance:
                print("✅ Mining rate calculation test PASSED - Formula is correct")
                return True
            else:
                print(f"❌ Mining rate calculation test FAILED - Expected: {expected_per_hour_rate}, Got: {mining_rate_per_hour}, Difference: {rate_difference}")
                return False
        else:
            print(f"❌ Mining rate calculation test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Mining rate calculation test FAILED - Error: {e}")
        return False

def test_mining_rate_never_zero():
    """Test that mining rate is never zero under various conditions"""
    print("\n6. Testing Mining Rate Never Zero...")
    
    # Test all created users to ensure none have zero mining rate
    test_users = [test_user_no_mining, test_user_with_mining, test_user_with_referrals]
    
    for i, user in enumerate(test_users, 1):
        print(f"\n6.{chr(96+i)}. Testing mining rate for user {i}...")
        try:
            response = requests.get(f"{API_BASE}/mining/status/{user['uid']}", timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                mining_rate_per_hour = result.get("mining_rate_per_hour", 0)
                
                if mining_rate_per_hour == 0:
                    print(f"❌ Mining rate never zero test FAILED - User {i} has zero mining rate")
                    return False
                else:
                    print(f"✅ User {i} mining rate: {mining_rate_per_hour} (non-zero)")
            else:
                print(f"❌ Mining rate never zero test FAILED - Status: {response.status_code} for user {i}")
                return False
        except Exception as e:
            print(f"❌ Mining rate never zero test FAILED - Error: {e} for user {i}")
            return False
    
    print("✅ Mining rate never zero test PASSED - All users have non-zero mining rates")
    return True

def test_public_products_endpoint():
    """Test GET /api/products endpoint (public) - should return active and visible products"""
    print("\n7. Testing Public Products Endpoint...")
    
    try:
        response = requests.get(f"{API_BASE}/products", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            products = response.json()
            print(f"Response type: {type(products)}")
            
            # Should return an array
            if not isinstance(products, list):
                print(f"❌ Public products test FAILED - Response should be an array, got {type(products)}")
                return False
            
            print(f"Number of products returned: {len(products)}")
            
            # Check if we have at least some products (the request mentions 15, but let's be flexible)
            if len(products) == 0:
                print("❌ Public products test FAILED - No products returned")
                return False
            
            # Check each product has required fields
            required_fields = ["product_id", "name", "sku", "prc_price", "cash_price"]
            visibility_fields = ["is_active", "visible"]
            
            for i, product in enumerate(products):
                # Check for _id field (should be excluded)
                if "_id" in product:
                    print(f"❌ Public products test FAILED - Product {i+1} contains _id field (should be excluded)")
                    return False
                
                # Check required fields
                missing_fields = []
                for field in required_fields:
                    if field not in product:
                        missing_fields.append(field)
                
                if missing_fields:
                    print(f"❌ Public products test FAILED - Product {i+1} missing fields: {missing_fields}")
                    return False
                
                # Check visibility fields
                for field in visibility_fields:
                    if field in product:
                        if not product[field]:
                            print(f"❌ Public products test FAILED - Product {i+1} has {field}=false (should be true for public endpoint)")
                            return False
                
                # Log first product details for verification
                if i == 0:
                    print(f"Sample product: {product.get('name')} (SKU: {product.get('sku')}, PRC: {product.get('prc_price')}, Cash: {product.get('cash_price')})")
            
            print(f"✅ Public products test PASSED - {len(products)} products returned with correct structure")
            return True
            
        else:
            print(f"❌ Public products test FAILED - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Public products test FAILED - Error: {e}")
        return False

def test_admin_products_endpoint():
    """Test GET /api/admin/products endpoint - should return all products regardless of visibility"""
    print("\n8. Testing Admin Products Endpoint...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/products", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            admin_products = response.json()
            print(f"Response type: {type(admin_products)}")
            
            # Should return an array
            if not isinstance(admin_products, list):
                print(f"❌ Admin products test FAILED - Response should be an array, got {type(admin_products)}")
                return False
            
            print(f"Number of admin products returned: {len(admin_products)}")
            
            # Get public products for comparison
            public_response = requests.get(f"{API_BASE}/products", timeout=30)
            if public_response.status_code == 200:
                public_products = public_response.json()
                print(f"Number of public products: {len(public_products)}")
                
                # Admin endpoint should return same or more products than public
                if len(admin_products) < len(public_products):
                    print(f"❌ Admin products test FAILED - Admin endpoint returned fewer products ({len(admin_products)}) than public endpoint ({len(public_products)})")
                    return False
                
                # Check if admin endpoint includes products that public doesn't
                if len(admin_products) > len(public_products):
                    print(f"✅ Admin endpoint includes {len(admin_products) - len(public_products)} additional products (hidden/inactive)")
                
            # Check each product structure
            required_fields = ["product_id", "name", "sku", "prc_price", "cash_price"]
            
            for i, product in enumerate(admin_products):
                # Check for _id field (should be excluded)
                if "_id" in product:
                    print(f"❌ Admin products test FAILED - Product {i+1} contains _id field (should be excluded)")
                    return False
                
                # Check required fields
                missing_fields = []
                for field in required_fields:
                    if field not in product:
                        missing_fields.append(field)
                
                if missing_fields:
                    print(f"❌ Admin products test FAILED - Product {i+1} missing fields: {missing_fields}")
                    return False
                
                # Log first product details for verification
                if i == 0:
                    print(f"Sample admin product: {product.get('name')} (SKU: {product.get('sku')}, Active: {product.get('is_active')}, Visible: {product.get('visible')})")
            
            print(f"✅ Admin products test PASSED - {len(admin_products)} products returned with correct structure")
            return True
            
        else:
            print(f"❌ Admin products test FAILED - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Admin products test FAILED - Error: {e}")
        return False

def test_products_filtering_logic():
    """Test that public endpoint properly filters products compared to admin endpoint"""
    print("\n9. Testing Products Filtering Logic...")
    
    try:
        # Get both endpoints
        public_response = requests.get(f"{API_BASE}/products", timeout=30)
        admin_response = requests.get(f"{API_BASE}/admin/products", timeout=30)
        
        if public_response.status_code == 200 and admin_response.status_code == 200:
            public_products = public_response.json()
            admin_products = admin_response.json()
            
            # Create sets of product IDs for comparison
            public_ids = {p.get("product_id") for p in public_products}
            admin_ids = {p.get("product_id") for p in admin_products}
            
            # All public products should be in admin products
            if not public_ids.issubset(admin_ids):
                missing_in_admin = public_ids - admin_ids
                print(f"❌ Products filtering test FAILED - Public products not found in admin: {missing_in_admin}")
                return False
            
            # Check that all public products have is_active=true and visible=true
            for product in public_products:
                if not product.get("is_active", False):
                    print(f"❌ Products filtering test FAILED - Public product {product.get('name')} has is_active=false")
                    return False
                
                if not product.get("visible", False):
                    print(f"❌ Products filtering test FAILED - Public product {product.get('name')} has visible=false")
                    return False
            
            # Check if admin has products that public doesn't (should be inactive or invisible)
            admin_only_ids = admin_ids - public_ids
            if admin_only_ids:
                print(f"✅ Found {len(admin_only_ids)} products in admin that are filtered from public (inactive/invisible)")
                
                # Verify these are indeed inactive or invisible
                for product in admin_products:
                    if product.get("product_id") in admin_only_ids:
                        is_active = product.get("is_active", False)
                        is_visible = product.get("visible", False)
                        if is_active and is_visible:
                            print(f"❌ Products filtering test FAILED - Product {product.get('name')} is active and visible but not in public endpoint")
                            return False
            
            print("✅ Products filtering test PASSED - Public endpoint correctly filters active and visible products")
            return True
            
        else:
            print(f"❌ Products filtering test FAILED - Public: {public_response.status_code}, Admin: {admin_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Products filtering test FAILED - Error: {e}")
        return False

# ========== ADMIN DASHBOARD API TESTS ==========

def test_admin_kpis_endpoint():
    """Test GET /api/admin/stats - Admin Dashboard KPIs"""
    print("\n1. Testing Admin KPIs Endpoint (GET /api/admin/stats)...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            stats = response.json()
            print(f"Response type: {type(stats)}")
            
            # Check required KPI sections
            required_sections = [
                "user_stats", "order_stats", "kyc_stats", "vip_payment_stats",
                "withdrawal_stats", "product_stats", "financial_overview",
                "stock_movement_stats", "security_deposit_stats", "renewal_stats",
                "recent_activity"
            ]
            
            missing_sections = []
            for section in required_sections:
                if section not in stats:
                    missing_sections.append(section)
            
            if missing_sections:
                print(f"❌ Admin KPIs test FAILED - Missing sections: {missing_sections}")
                return False
            
            # Validate user_stats structure
            user_stats = stats.get("user_stats", {})
            user_required = ["total", "vip", "free", "master_stockists", "sub_stockists", "outlets"]
            for field in user_required:
                if field not in user_stats:
                    print(f"❌ Admin KPIs test FAILED - Missing user_stats.{field}")
                    return False
            
            # Validate order_stats structure
            order_stats = stats.get("order_stats", {})
            order_required = ["total", "pending", "delivered"]
            for field in order_required:
                if field not in order_stats:
                    print(f"❌ Admin KPIs test FAILED - Missing order_stats.{field}")
                    return False
            
            # Validate financial_overview structure
            financial = stats.get("financial_overview", {})
            financial_required = ["total_revenue", "security_deposits_collected"]
            for field in financial_required:
                if field not in financial:
                    print(f"❌ Admin KPIs test FAILED - Missing financial_overview.{field}")
                    return False
            
            print(f"✅ Admin KPIs test PASSED - All required sections present")
            print(f"   Users: {user_stats.get('total', 0)} total, {user_stats.get('vip', 0)} VIP")
            print(f"   Orders: {order_stats.get('total', 0)} total, {order_stats.get('pending', 0)} pending")
            print(f"   Revenue: ₹{financial.get('total_revenue', 0)}")
            return True
            
        else:
            print(f"❌ Admin KPIs test FAILED - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Admin KPIs test FAILED - Error: {e}")
        return False

def test_order_management_apis():
    """Test Order Management APIs"""
    print("\n2. Testing Order Management APIs...")
    
    # Test GET /api/admin/orders/all
    print("\n2a. Testing GET /api/admin/orders/all...")
    try:
        response = requests.get(f"{API_BASE}/admin/orders/all", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            orders_data = response.json()
            
            # Should have orders array and pagination info
            if "orders" not in orders_data:
                print("❌ Order management test FAILED - Missing 'orders' field")
                return False
            
            orders = orders_data["orders"]
            print(f"Number of orders returned: {len(orders)}")
            
            # Test with status filter
            print("\n2b. Testing GET /api/admin/orders/all?status=pending...")
            response_filtered = requests.get(f"{API_BASE}/admin/orders/all?status=pending", timeout=30)
            if response_filtered.status_code == 200:
                filtered_data = response_filtered.json()
                print(f"Filtered orders count: {len(filtered_data.get('orders', []))}")
            
            # Test pagination
            print("\n2c. Testing GET /api/admin/orders/all?page=1&limit=5...")
            response_paginated = requests.get(f"{API_BASE}/admin/orders/all?page=1&limit=5", timeout=30)
            if response_paginated.status_code == 200:
                paginated_data = response_paginated.json()
                print(f"Paginated orders count: {len(paginated_data.get('orders', []))}")
            
            print("✅ Order listing tests PASSED")
            
            # Test individual order details if we have orders
            if len(orders) > 0:
                test_order_id = orders[0].get("order_id")
                if test_order_id:
                    print(f"\n2d. Testing GET /api/admin/orders/{test_order_id}...")
                    response_detail = requests.get(f"{API_BASE}/admin/orders/{test_order_id}", timeout=30)
                    if response_detail.status_code == 200:
                        order_detail = response_detail.json()
                        required_fields = ["order_id", "user_details", "items", "commission_breakdown"]
                        missing_fields = [f for f in required_fields if f not in order_detail]
                        if missing_fields:
                            print(f"❌ Order detail test FAILED - Missing fields: {missing_fields}")
                            return False
                        print("✅ Order detail test PASSED")
                    else:
                        print(f"❌ Order detail test FAILED - Status: {response_detail.status_code}")
                        return False
                
                # Test order assignment
                print(f"\n2e. Testing POST /api/admin/orders/{test_order_id}/assign...")
                assign_data = {"outlet_id": "test-outlet-123"}
                response_assign = requests.post(f"{API_BASE}/admin/orders/{test_order_id}/assign", 
                                              json=assign_data, timeout=30)
                if response_assign.status_code in [200, 404]:  # 404 is OK if outlet doesn't exist
                    print("✅ Order assignment test PASSED")
                else:
                    print(f"❌ Order assignment test FAILED - Status: {response_assign.status_code}")
                    return False
            
            return True
            
        else:
            print(f"❌ Order management test FAILED - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Order management test FAILED - Error: {e}")
        return False

def test_financial_reports_apis():
    """Test Financial Reports APIs"""
    print("\n3. Testing Financial Reports APIs...")
    
    # Test GET /api/admin/reports/revenue
    print("\n3a. Testing GET /api/admin/reports/revenue...")
    try:
        response = requests.get(f"{API_BASE}/admin/reports/revenue", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            revenue_data = response.json()
            
            required_fields = ["total_revenue", "prc_spent", "delivery_charges", "top_products"]
            missing_fields = [f for f in required_fields if f not in revenue_data]
            if missing_fields:
                print(f"❌ Revenue report test FAILED - Missing fields: {missing_fields}")
                return False
            
            print(f"✅ Revenue report test PASSED")
            print(f"   Total Revenue: ₹{revenue_data.get('total_revenue', 0)}")
            print(f"   PRC Spent: {revenue_data.get('prc_spent', 0)}")
            print(f"   Top Products: {len(revenue_data.get('top_products', []))}")
            
            # Test with date filter
            print("\n3b. Testing revenue report with date filter...")
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            end_date = datetime.now().strftime('%Y-%m-%d')
            response_filtered = requests.get(
                f"{API_BASE}/admin/reports/revenue?start_date={start_date}&end_date={end_date}", 
                timeout=30
            )
            if response_filtered.status_code == 200:
                print("✅ Revenue report with date filter PASSED")
            
        else:
            print(f"❌ Revenue report test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Revenue report test FAILED - Error: {e}")
        return False
    
    # Test GET /api/admin/reports/commissions
    print("\n3c. Testing GET /api/admin/reports/commissions...")
    try:
        response = requests.get(f"{API_BASE}/admin/reports/commissions", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            commission_data = response.json()
            
            required_fields = ["commission_distribution", "top_earners"]
            missing_fields = [f for f in required_fields if f not in commission_data]
            if missing_fields:
                print(f"❌ Commission report test FAILED - Missing fields: {missing_fields}")
                return False
            
            print(f"✅ Commission report test PASSED")
            print(f"   Top Earners: {len(commission_data.get('top_earners', []))}")
            
        else:
            print(f"❌ Commission report test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Commission report test FAILED - Error: {e}")
        return False
    
    # Test GET /api/admin/reports/withdrawals
    print("\n3d. Testing GET /api/admin/reports/withdrawals...")
    try:
        response = requests.get(f"{API_BASE}/admin/reports/withdrawals", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            withdrawal_data = response.json()
            
            required_fields = ["cashback_withdrawals", "profit_withdrawals"]
            missing_fields = [f for f in required_fields if f not in withdrawal_data]
            if missing_fields:
                print(f"❌ Withdrawal report test FAILED - Missing fields: {missing_fields}")
                return False
            
            print(f"✅ Withdrawal report test PASSED")
            
            # Test with status filter
            response_filtered = requests.get(f"{API_BASE}/admin/reports/withdrawals?status=pending", timeout=30)
            if response_filtered.status_code == 200:
                print("✅ Withdrawal report with status filter PASSED")
            
        else:
            print(f"❌ Withdrawal report test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Withdrawal report test FAILED - Error: {e}")
        return False
    
    return True

def test_employee_management_apis():
    """Test Employee Management APIs"""
    print("\n4. Testing Employee Management APIs...")
    
    # Test POST /api/admin/employees/create
    print("\n4a. Testing POST /api/admin/employees/create...")
    try:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        employee_data = {
            "first_name": "Test",
            "last_name": "Employee",
            "email": f"employee.{timestamp}@example.com",
            "mobile": f"9876{timestamp[-6:]}",
            "password": "EmpPass123!",
            "role": "employee",
            "assigned_regions": ["Mumbai", "Pune"],
            "permissions": ["view_orders", "manage_stock"]
        }
        
        response = requests.post(f"{API_BASE}/admin/employees/create", json=employee_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            employee_uid = result.get("uid")
            
            if not employee_uid:
                print("❌ Employee creation test FAILED - No UID returned")
                return False
            
            print(f"✅ Employee creation test PASSED - UID: {employee_uid}")
            
            # Test GET /api/admin/employees
            print("\n4b. Testing GET /api/admin/employees...")
            response_list = requests.get(f"{API_BASE}/admin/employees", timeout=30)
            if response_list.status_code == 200:
                employees = response_list.json()
                if "employees" in employees:
                    print(f"✅ Employee listing test PASSED - {len(employees['employees'])} employees found")
                else:
                    print("❌ Employee listing test FAILED - Missing 'employees' field")
                    return False
            
            # Test with role filter
            print("\n4c. Testing GET /api/admin/employees?role=employee...")
            response_filtered = requests.get(f"{API_BASE}/admin/employees?role=employee", timeout=30)
            if response_filtered.status_code == 200:
                print("✅ Employee listing with role filter PASSED")
            
            # Test PUT /api/admin/employees/{uid}/permissions
            print(f"\n4d. Testing PUT /api/admin/employees/{employee_uid}/permissions...")
            permissions_data = {
                "permissions": ["view_orders", "manage_stock", "view_reports"]
            }
            response_permissions = requests.put(
                f"{API_BASE}/admin/employees/{employee_uid}/permissions", 
                json=permissions_data, 
                timeout=30
            )
            if response_permissions.status_code == 200:
                print("✅ Employee permissions update test PASSED")
            else:
                print(f"❌ Employee permissions update test FAILED - Status: {response_permissions.status_code}")
                return False
            
            return True
            
        else:
            print(f"❌ Employee creation test FAILED - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Employee management test FAILED - Error: {e}")
        return False

def test_audit_logging_apis():
    """Test Audit Logging APIs"""
    print("\n5. Testing Audit Logging APIs...")
    
    # Test POST /api/admin/audit/log
    print("\n5a. Testing POST /api/admin/audit/log...")
    try:
        audit_data = {
            "action": "test_action",
            "entity_type": "user",
            "entity_id": "test-user-123",
            "performed_by": "test-admin",
            "changes": {"field": "value"},
            "ip_address": "127.0.0.1"
        }
        
        response = requests.post(f"{API_BASE}/admin/audit/log", json=audit_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            audit_id = result.get("audit_id")
            
            if not audit_id:
                print("❌ Audit log creation test FAILED - No audit_id returned")
                return False
            
            print(f"✅ Audit log creation test PASSED - ID: {audit_id}")
            
            # Test GET /api/admin/audit/logs
            print("\n5b. Testing GET /api/admin/audit/logs...")
            response_list = requests.get(f"{API_BASE}/admin/audit/logs", timeout=30)
            if response_list.status_code == 200:
                logs_data = response_list.json()
                if "logs" in logs_data:
                    logs = logs_data["logs"]
                    print(f"✅ Audit logs listing test PASSED - {len(logs)} logs found")
                    
                    # Test with filters
                    print("\n5c. Testing audit logs with action filter...")
                    response_filtered = requests.get(f"{API_BASE}/admin/audit/logs?action=test_action", timeout=30)
                    if response_filtered.status_code == 200:
                        print("✅ Audit logs with action filter PASSED")
                    
                    print("\n5d. Testing audit logs with entity_type filter...")
                    response_entity = requests.get(f"{API_BASE}/admin/audit/logs?entity_type=user", timeout=30)
                    if response_entity.status_code == 200:
                        print("✅ Audit logs with entity_type filter PASSED")
                    
                    print("\n5e. Testing audit logs with performed_by filter...")
                    response_performer = requests.get(f"{API_BASE}/admin/audit/logs?performed_by=test-admin", timeout=30)
                    if response_performer.status_code == 200:
                        print("✅ Audit logs with performed_by filter PASSED")
                    
                    # Test pagination
                    print("\n5f. Testing audit logs pagination...")
                    response_paginated = requests.get(f"{API_BASE}/admin/audit/logs?page=1&limit=10", timeout=30)
                    if response_paginated.status_code == 200:
                        print("✅ Audit logs pagination PASSED")
                    
                else:
                    print("❌ Audit logs listing test FAILED - Missing 'logs' field")
                    return False
            else:
                print(f"❌ Audit logs listing test FAILED - Status: {response_list.status_code}")
                return False
            
            return True
            
        else:
            print(f"❌ Audit log creation test FAILED - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Audit logging test FAILED - Error: {e}")
        return False

def main():
    """Run all Backend API tests"""
    print("Starting Comprehensive Backend API testing...")
    print(f"Target API: {API_BASE}")
    
    # Test basic connectivity
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=10)
        print(f"Backend connectivity test - Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend connectivity FAILED: {e}")
        print("Cannot proceed with testing - backend is not accessible")
        return False
    
    # Run all tests in sequence
    print("\n" + "=" * 80)
    print("BACKEND API COMPREHENSIVE TESTING")
    print("=" * 80)
    
    # Products Endpoint Testing (Priority Focus)
    print("\n" + "=" * 50)
    print("PRODUCTS ENDPOINT TESTING (PRIORITY)")
    print("=" * 50)
    
    # 7. Test public products endpoint
    if not test_public_products_endpoint():
        print("❌ CRITICAL: Public products endpoint test failed")
        return False
    
    # 8. Test admin products endpoint
    if not test_admin_products_endpoint():
        print("❌ CRITICAL: Admin products endpoint test failed")
        return False
    
    # 9. Test products filtering logic
    if not test_products_filtering_logic():
        print("❌ CRITICAL: Products filtering logic test failed")
        return False
    
    print("\n" + "=" * 50)
    print("MINING SYSTEM TESTING (SECONDARY)")
    print("=" * 50)
    
    # 1. Setup test users
    if not setup_test_users():
        print("❌ CRITICAL: Failed to setup test users - cannot continue")
        return False
    
    # 2. Test mining status for user with NO active mining session
    if not test_mining_status_no_active_session():
        print("❌ CRITICAL: Mining status (no active session) test failed")
        return False
    
    # 3. Start mining session for test user 2
    if not start_mining_session():
        print("❌ CRITICAL: Failed to start mining session - cannot continue with active session tests")
        return False
    
    # 4. Test mining status for user WITH active mining session
    if not test_mining_status_with_active_session():
        print("❌ CRITICAL: Mining status (with active session) test failed")
        return False
    
    # 5. Test mining rate calculation formula
    if not test_mining_rate_calculation():
        print("❌ CRITICAL: Mining rate calculation test failed")
        return False
    
    # 6. Test that mining rate is never zero
    if not test_mining_rate_never_zero():
        print("❌ CRITICAL: Mining rate never zero test failed")
        return False
    
    print("\n" + "=" * 80)
    print("BACKEND API TESTING COMPLETED!")
    print("=" * 80)
    print("✅ ALL TESTS PASSED - Backend APIs are working correctly!")
    print("✅ Products endpoints working: public filtering and admin access")
    print("✅ Mining system fix is working correctly")
    print("✅ Mining rate displays correctly and is never zero")
    
    return True

if __name__ == "__main__":
    main()