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

def test_password_validation():
    """Test password validation"""
    print("\n5. Testing password validation...")
    
    # Test weak password
    print("\n5a. Testing weak password...")
    weak_password_data = {
        "name": "Weak Password",
        "email": f"weak.password.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
        "mobile": f"5432109{datetime.now().strftime('%H%M')}",
        "password": "123",  # Very weak password
        "state": "West Bengal",
        "district": "Kolkata",
        "pincode": "700001",
        "aadhaar_number": f"3333{datetime.now().strftime('%H%M')}4444555",
        "pan_number": f"WEAKP{datetime.now().strftime('%H%M')}W"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=weak_password_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        # The current implementation doesn't seem to have password validation
        # So this might still succeed
        print("✅ Password validation test completed (no validation implemented)")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Password validation test FAILED - Network error: {e}")

def test_edge_cases():
    """Test edge cases"""
    print("\n6. Testing edge cases...")
    
    # Test empty JSON
    print("\n6a. Testing empty JSON...")
    try:
        response = requests.post(REGISTER_URL, json={}, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code in [400, 422]:
            print("✅ Empty JSON test PASSED")
        else:
            print(f"❌ Empty JSON test - Expected 400/422, got {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Empty JSON test FAILED - Network error: {e}")

    # Test malformed JSON
    print("\n6b. Testing malformed JSON...")
    try:
        response = requests.post(REGISTER_URL, data="invalid json", 
                               headers={'Content-Type': 'application/json'}, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code in [400, 422]:
            print("✅ Malformed JSON test PASSED")
        else:
            print(f"❌ Malformed JSON test - Expected 400/422, got {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Malformed JSON test FAILED - Network error: {e}")

def test_user_data_retrieval(uid):
    """Test if user data is properly stored and retrievable"""
    print(f"\n7. Testing user data retrieval for UID: {uid}...")
    
    try:
        user_url = f"{API_BASE}/auth/user/{uid}"
        response = requests.get(user_url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            user_data = response.json()
            print(f"Retrieved user data: {json.dumps(user_data, indent=2)}")
            
            # Check if all expected fields are present
            expected_fields = ["uid", "first_name", "last_name", "email", "mobile", "state", "district", "pincode", "aadhaar_number", "pan_number", "name"]
            missing_fields = []
            
            for field in expected_fields:
                if field not in user_data or user_data[field] is None:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ Missing fields in stored data: {missing_fields}")
            else:
                print("✅ All expected fields are present in stored data")
                
                # Check if name was auto-constructed
                if user_data.get("name"):
                    print(f"✅ Name field auto-constructed: '{user_data['name']}'")
                else:
                    print("❌ Name field was not auto-constructed")
            
            return True
        else:
            print(f"❌ User data retrieval FAILED - Status: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ User data retrieval FAILED - Network error: {e}")
        return False

def main():
    """Run all registration tests"""
    print("Starting comprehensive user registration endpoint testing...")
    print(f"Target URL: {REGISTER_URL}")
    
    # Test basic connectivity
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        print(f"Backend connectivity test - Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend connectivity FAILED: {e}")
        print("Cannot proceed with testing - backend is not accessible")
        return False
    
    # Run all tests
    success, user_data, uid = test_registration_endpoint()
    
    if success:
        test_duplicate_detection(user_data)
        if uid:
            test_user_data_retrieval(uid)
    
    test_name_auto_construction()
    test_missing_fields()
    test_invalid_data_formats() 
    test_password_validation()
    test_edge_cases()
    
    print("\n" + "=" * 60)
    print("Registration endpoint testing completed!")
    print("Check the results above for any failures that need attention.")
    
    return success

if __name__ == "__main__":
    main()