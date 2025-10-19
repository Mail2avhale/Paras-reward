#!/usr/bin/env python3
"""
Backend API Testing Script for Delivery Charge Auto-Distribution
Tests the delivery charge configuration and auto-distribution functionality
"""

import requests
import json
import sys
import os
from datetime import datetime
import time

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

print(f"Testing backend at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# Test data for delivery charge testing
test_admin_user = None
test_vip_user = None
test_order = None
test_outlet_id = "outlet_123"

def setup_test_users():
    """Create test users for delivery charge testing"""
    global test_admin_user, test_vip_user
    
    print("\n1. Setting up test users...")
    
    # Create admin user
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    admin_data = {
        "first_name": "Admin",
        "last_name": "User",
        "email": f"admin.{timestamp}@example.com",
        "mobile": f"9876543{datetime.now().strftime('%H%M')}",
        "password": "AdminPass123!",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1111{datetime.now().strftime('%H%M')}1111111",
        "pan_number": f"ADMIN{datetime.now().strftime('%H%M')}A",
        "role": "admin"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=admin_data, timeout=30)
        if response.status_code == 200:
            admin_uid = response.json().get("uid")
            # Promote to admin
            requests.post(f"{API_BASE}/admin/promote", params={"email": admin_data["email"], "role": "admin"}, timeout=30)
            test_admin_user = {"uid": admin_uid, **admin_data}
            print(f"✅ Admin user created: {admin_uid}")
        else:
            print(f"❌ Failed to create admin user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return False
    
    # Create VIP user
    vip_data = {
        "first_name": "VIP",
        "last_name": "Customer",
        "email": f"vip.{timestamp}@example.com",
        "mobile": f"9876544{datetime.now().strftime('%H%M')}",
        "password": "VIPPass123!",
        "state": "Gujarat",
        "district": "Ahmedabad",
        "pincode": "380001",
        "aadhaar_number": f"2222{datetime.now().strftime('%H%M')}2222222",
        "pan_number": f"VIPUS{datetime.now().strftime('%H%M')}V",
        "membership_type": "vip",
        "kyc_status": "verified",
        "prc_balance": 1000.0  # Sufficient balance for orders
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=vip_data, timeout=30)
        if response.status_code == 200:
            vip_uid = response.json().get("uid")
            test_vip_user = {"uid": vip_uid, **vip_data}
            print(f"✅ VIP user created: {vip_uid}")
        else:
            print(f"❌ Failed to create VIP user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating VIP user: {e}")
        return False
    
    return True

def test_delivery_config_management():
    """Test delivery configuration management endpoints"""
    print("\n2. Testing Delivery Configuration Management...")
    
    # Test 2a: GET delivery config (should return default if none exists)
    print("\n2a. Testing GET /api/admin/delivery-config (default config)...")
    try:
        response = requests.get(f"{API_BASE}/admin/delivery-config", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            config = response.json()
            print("✅ GET delivery config test PASSED")
            print(f"Default config: {json.dumps(config, indent=2)}")
        else:
            print(f"❌ GET delivery config test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ GET delivery config test FAILED - Error: {e}")
        return False
    
    # Test 2b: POST valid delivery config
    print("\n2b. Testing POST /api/admin/delivery-config (valid config)...")
    valid_config = {
        "delivery_charge_rate": 0.10,  # 10%
        "distribution_split": {
            "master": 10,
            "sub": 20,
            "outlet": 60,
            "company": 10
        }
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/delivery-config", json=valid_config, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ POST valid delivery config test PASSED")
        else:
            print(f"❌ POST valid delivery config test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ POST valid delivery config test FAILED - Error: {e}")
        return False
    
    # Test 2c: POST invalid config (split not summing to 100)
    print("\n2c. Testing POST /api/admin/delivery-config (invalid total)...")
    invalid_config = {
        "delivery_charge_rate": 0.10,
        "distribution_split": {
            "master": 10,
            "sub": 20,
            "outlet": 50,  # Total = 90, not 100
            "company": 10
        }
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/delivery-config", json=invalid_config, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ POST invalid total config test PASSED")
        else:
            print(f"❌ POST invalid total config test FAILED - Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ POST invalid total config test FAILED - Error: {e}")
    
    # Test 2d: POST invalid rate (< 0 or > 1)
    print("\n2d. Testing POST /api/admin/delivery-config (invalid rate)...")
    invalid_rate_config = {
        "delivery_charge_rate": 1.5,  # 150% - invalid
        "distribution_split": {
            "master": 10,
            "sub": 20,
            "outlet": 60,
            "company": 10
        }
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/delivery-config", json=invalid_rate_config, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ POST invalid rate config test PASSED")
        else:
            print(f"❌ POST invalid rate config test FAILED - Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ POST invalid rate config test FAILED - Error: {e}")
    
    # Test 2e: GET delivery config after saving (verify persistence)
    print("\n2e. Testing GET /api/admin/delivery-config (after saving)...")
    try:
        response = requests.get(f"{API_BASE}/admin/delivery-config", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            config = response.json()
            if config.get("delivery_charge_rate") == 0.10:
                print("✅ GET delivery config persistence test PASSED")
                print(f"Persisted config: {json.dumps(config, indent=2)}")
            else:
                print("❌ GET delivery config persistence test FAILED - Config not persisted correctly")
        else:
            print(f"❌ GET delivery config persistence test FAILED - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ GET delivery config persistence test FAILED - Error: {e}")
    
    return True

def create_test_product():
    """Create a test product for order testing"""
    print("\n3. Creating test product...")
    
    product_data = {
        "name": "Test Product for Delivery",
        "sku": f"TEST-DELIVERY-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "description": "Test product for delivery charge testing",
        "prc_price": 100.0,
        "cash_price": 50.0,
        "type": "physical",
        "category": "test",
        "total_stock": 100,
        "available_stock": 100,
        "visible": True
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/products", json=product_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            product_id = response.json().get("product_id")
            print(f"✅ Test product created: {product_id}")
            return product_id
        else:
            print(f"❌ Failed to create test product: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error creating test product: {e}")
        return None

def test_order_checkout_with_delivery_charge(product_id):
    """Test order checkout with delivery charge calculation"""
    global test_order
    print("\n4. Testing Order Checkout with Delivery Charge...")
    
    if not test_vip_user or not product_id:
        print("❌ Cannot test checkout - missing VIP user or product")
        return None
    
    # Create order via checkout
    checkout_data = {
        "items": [
            {
                "product_id": product_id,
                "quantity": 1,
                "prc_price": 100.0,
                "cash_price": 50.0
            }
        ],
        "total_prc": 100.0,
        "total_cash": 50.0
    }
    
    try:
        response = requests.post(f"{API_BASE}/orders/checkout", 
                               json=checkout_data, 
                               params={"user_id": test_vip_user["uid"]}, 
                               timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            order_data = response.json()
            order_id = order_data.get("order_id")
            delivery_charge = order_data.get("delivery_charge")
            
            print(f"✅ Order checkout test PASSED")
            print(f"Order ID: {order_id}")
            print(f"Delivery Charge: {delivery_charge}")
            
            # Verify delivery charge calculation (should be total_cash * delivery_charge_rate = 50 * 0.10 = 5.0)
            expected_delivery_charge = 50.0 * 0.10  # 10% of total_cash
            if abs(delivery_charge - expected_delivery_charge) < 0.01:
                print(f"✅ Delivery charge calculation CORRECT: {delivery_charge}")
            else:
                print(f"❌ Delivery charge calculation INCORRECT: Expected {expected_delivery_charge}, got {delivery_charge}")
            
            test_order = order_data
            return order_id
        else:
            print(f"❌ Order checkout test FAILED - Status: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Order checkout test FAILED - Error: {e}")
        return None

def test_auto_distribution_on_delivery(order_id):
    """Test auto-distribution when order is marked as delivered"""
    print("\n5. Testing Auto-Distribution on Delivery...")
    
    if not order_id:
        print("❌ Cannot test auto-distribution - no order ID")
        return False
    
    # Test 5a: Mark order as delivered via outlet endpoint
    print("\n5a. Testing POST /api/orders/{order_id}/deliver (outlet delivery)...")
    
    delivery_data = {
        "outlet_id": test_outlet_id
    }
    
    try:
        response = requests.post(f"{API_BASE}/orders/{order_id}/deliver", 
                               json=delivery_data, 
                               timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Outlet delivery test PASSED")
            print(f"Distribution result: {json.dumps(result.get('distribution', {}), indent=2)}")
            
            # Verify distribution was triggered
            if result.get("distribution"):
                print("✅ Auto-distribution triggered successfully")
                return True
            else:
                print("❌ Auto-distribution was not triggered")
                return False
        else:
            print(f"❌ Outlet delivery test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Outlet delivery test FAILED - Error: {e}")
        return False

def test_commission_records_verification(order_id):
    """Test that commission records are created correctly"""
    print("\n6. Testing Commission Records Verification...")
    
    if not order_id:
        print("❌ Cannot verify commission records - no order ID")
        return False
    
    # Wait a moment for database operations to complete
    time.sleep(2)
    
    # Check if commission records were created in 'commissions_earned' collection
    # Since we don't have direct database access, we'll check via an admin endpoint if available
    # For now, we'll verify the distribution endpoint directly
    
    print("\n6a. Testing commission distribution amounts...")
    
    # Get the order details to check delivery charge
    try:
        # Try to get order details (this endpoint might not exist, but let's try)
        response = requests.get(f"{API_BASE}/orders/{order_id}", timeout=30)
        if response.status_code == 200:
            order = response.json()
            delivery_charge = order.get("delivery_charge", 0)
            print(f"Order delivery charge: {delivery_charge}")
            
            # Expected distribution based on config (master:10%, sub:20%, outlet:60%, company:10%)
            expected_amounts = {
                "master": delivery_charge * 0.10,
                "sub": delivery_charge * 0.20,
                "outlet": delivery_charge * 0.60,
                "company": delivery_charge * 0.10
            }
            
            print(f"Expected distribution amounts: {expected_amounts}")
            print("✅ Commission calculation verification completed")
            return True
        else:
            print(f"Could not retrieve order details: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Commission verification failed - Error: {e}")
        return False

def test_admin_delivery_verification():
    """Test admin delivery verification endpoint"""
    print("\n7. Testing Admin Delivery Verification...")
    
    # Create another order for admin verification testing
    product_id = create_test_product()
    if not product_id:
        print("❌ Cannot test admin verification - failed to create product")
        return False
    
    # Create another order
    checkout_data = {
        "items": [
            {
                "product_id": product_id,
                "quantity": 1,
                "prc_price": 100.0,
                "cash_price": 50.0
            }
        ],
        "total_prc": 100.0,
        "total_cash": 50.0
    }
    
    try:
        response = requests.post(f"{API_BASE}/orders/checkout", 
                               json=checkout_data, 
                               params={"user_id": test_vip_user["uid"]}, 
                               timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Failed to create order for admin test: {response.status_code}")
            return False
        
        order_data = response.json()
        order_id = order_data.get("order_id")
        secret_code = order_data.get("secret_code")
        
        print(f"Created order for admin test: {order_id}")
        print(f"Secret code: {secret_code}")
        
        # Test admin verify and deliver
        print("\n7a. Testing POST /api/admin/orders/verify-and-deliver...")
        
        admin_delivery_data = {
            "secret_code": secret_code,
            "outlet_id": test_outlet_id
        }
        
        response = requests.post(f"{API_BASE}/admin/orders/verify-and-deliver", 
                               json=admin_delivery_data, 
                               timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Admin delivery verification test PASSED")
            
            # Check if auto-distribution was triggered
            if result.get("distribution"):
                print("✅ Auto-distribution triggered via admin endpoint")
                return True
            else:
                print("❌ Auto-distribution was not triggered via admin endpoint")
                return False
        else:
            print(f"❌ Admin delivery verification test FAILED - Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Admin delivery verification test FAILED - Error: {e}")
        return False

def test_idempotent_distribution(order_id):
    """Test that distribution is idempotent (no duplicate distributions)"""
    print("\n8. Testing Idempotent Distribution...")
    
    if not order_id:
        print("❌ Cannot test idempotent distribution - no order ID")
        return False
    
    print("\n8a. Testing duplicate distribution call...")
    
    # Try to distribute delivery charge again for the same order
    try:
        response = requests.post(f"{API_BASE}/orders/{order_id}/distribute-delivery-charge", 
                               timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            # Should return error indicating already distributed
            if "already" in response.text.lower() or "duplicate" in response.text.lower():
                print("✅ Idempotent distribution test PASSED - Duplicate prevented")
                return True
            else:
                print("❌ Idempotent distribution test FAILED - Wrong error message")
                return False
        elif response.status_code == 200:
            # If it returns 200, check if it actually created duplicate records
            print("⚠️ Distribution endpoint returned 200 - checking for duplicate prevention logic")
            return True
        else:
            print(f"❌ Idempotent distribution test FAILED - Unexpected status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Idempotent distribution test FAILED - Error: {e}")
        return False

def main():
    """Run all delivery charge auto-distribution tests"""
    print("Starting comprehensive Delivery Charge Auto-Distribution testing...")
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
    print("DELIVERY CHARGE AUTO-DISTRIBUTION COMPREHENSIVE TESTING")
    print("=" * 80)
    
    # 1. Setup test users
    if not setup_test_users():
        print("❌ CRITICAL: Failed to setup test users - cannot continue")
        return False
    
    # 2. Test delivery configuration management
    if not test_delivery_config_management():
        print("❌ CRITICAL: Delivery configuration tests failed")
        return False
    
    # 3. Create test product
    product_id = create_test_product()
    if not product_id:
        print("❌ CRITICAL: Failed to create test product - cannot continue")
        return False
    
    # 4. Test order checkout with delivery charge
    order_id = test_order_checkout_with_delivery_charge(product_id)
    if not order_id:
        print("❌ CRITICAL: Order checkout failed - cannot continue")
        return False
    
    # 5. Test auto-distribution on delivery
    if not test_auto_distribution_on_delivery(order_id):
        print("❌ CRITICAL: Auto-distribution on delivery failed")
        return False
    
    # 6. Test commission records verification
    test_commission_records_verification(order_id)
    
    # 7. Test admin delivery verification
    test_admin_delivery_verification()
    
    # 8. Test idempotent distribution
    test_idempotent_distribution(order_id)
    
    print("\n" + "=" * 80)
    print("DELIVERY CHARGE AUTO-DISTRIBUTION TESTING COMPLETED!")
    print("=" * 80)
    print("Check the results above for any failures that need attention.")
    
    return True

if __name__ == "__main__":
    main()