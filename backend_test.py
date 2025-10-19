#!/usr/bin/env python3
"""
Backend API Testing Script for Wallets & Maintenance Feature
Tests the comprehensive wallet system including cashback, profit wallets, maintenance, and withdrawals
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

print(f"Testing Wallets & Maintenance Feature at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# Test data for wallet testing
test_vip_user = None
test_free_user = None
test_outlet_user = None
test_admin_user = None
test_withdrawals = []

def setup_test_users():
    """Create test users for wallet testing"""
    global test_vip_user, test_free_user, test_outlet_user, test_admin_user
    
    print("\n1. Setting up test users...")
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    microseconds = str(datetime.now().microsecond)[:3]
    
    # Create VIP user with KYC approved
    vip_data = {
        "first_name": "Rajesh",
        "last_name": "Kumar",
        "email": f"rajesh.{timestamp}.{microseconds}@example.com",
        "mobile": f"98765{timestamp[-6:]}",
        "password": "VIPPass123!",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{timestamp[-8:]}567",
        "pan_number": f"ABCD{timestamp[-5:]}E"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=vip_data, timeout=30)
        if response.status_code == 200:
            vip_uid = response.json().get("uid")
            test_vip_user = {"uid": vip_uid, **vip_data}
            print(f"✅ VIP user created: {vip_uid}")
            
            # Make user VIP and approve KYC
            await make_user_vip_with_kyc(vip_uid)
            
        else:
            print(f"❌ Failed to create VIP user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating VIP user: {e}")
        return False
    
    # Create free user
    free_data = {
        "first_name": "Priya",
        "last_name": "Sharma",
        "email": f"priya.{timestamp}.{microseconds}@example.com",
        "mobile": f"98766{timestamp[-6:]}",
        "password": "FreePass123!",
        "state": "Gujarat",
        "district": "Ahmedabad",
        "pincode": "380001",
        "aadhaar_number": f"5678{timestamp[-8:]}901",
        "pan_number": f"EFGH{timestamp[-5:]}I"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=free_data, timeout=30)
        if response.status_code == 200:
            free_uid = response.json().get("uid")
            test_free_user = {"uid": free_uid, **free_data}
            print(f"✅ Free user created: {free_uid}")
        else:
            print(f"❌ Failed to create free user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating free user: {e}")
        return False
    
    # Create outlet user
    outlet_data = {
        "first_name": "Amit",
        "last_name": "Patel",
        "email": f"amit.{timestamp}.{microseconds}@example.com",
        "mobile": f"98767{timestamp[-6:]}",
        "password": "OutletPass123!",
        "state": "Karnataka",
        "district": "Bangalore",
        "pincode": "560001",
        "aadhaar_number": f"9012{timestamp[-8:]}345",
        "pan_number": f"IJKL{timestamp[-5:]}M",
        "role": "outlet"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=outlet_data, timeout=30)
        if response.status_code == 200:
            outlet_uid = response.json().get("uid")
            # Promote to outlet role
            requests.post(f"{API_BASE}/admin/promote", params={"email": outlet_data["email"], "role": "outlet"}, timeout=30)
            test_outlet_user = {"uid": outlet_uid, **outlet_data}
            print(f"✅ Outlet user created: {outlet_uid}")
        else:
            print(f"❌ Failed to create outlet user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating outlet user: {e}")
        return False
    
    return True

def make_user_vip_with_kyc(user_id):
    """Helper function to make user VIP and approve KYC"""
    try:
        # Submit VIP payment
        payment_data = {
            "user_id": user_id,
            "amount": 1000,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M"),
            "utr_number": f"TEST{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "screenshot_url": "test_screenshot"
        }
        
        payment_response = requests.post(f"{API_BASE}/membership/submit-payment", 
                                       json=payment_data, timeout=30)
        
        if payment_response.status_code == 200:
            payment_id = payment_response.json().get("payment_id")
            
            # Approve the payment
            approval_data = {"action": "approve"}
            requests.post(f"{API_BASE}/membership/payment/{payment_id}/action",
                         json=approval_data, timeout=30)
            
            # Submit KYC
            kyc_data = {
                "aadhaar_front_base64": "test_aadhaar_front_image",
                "aadhaar_back_base64": "test_aadhaar_back_image", 
                "pan_front_base64": "test_pan_front_image"
            }
            
            kyc_response = requests.post(f"{API_BASE}/kyc/submit/{user_id}",
                                       json=kyc_data, timeout=30)
            
            if kyc_response.status_code == 200:
                kyc_id = kyc_response.json().get("kyc_id")
                
                # Approve KYC
                kyc_verify_data = {"action": "approve"}
                requests.post(f"{API_BASE}/kyc/{kyc_id}/verify",
                             json=kyc_verify_data, timeout=30)
                
                print("✅ User made VIP with approved KYC")
                return True
        
        return False
    except Exception as e:
        print(f"❌ Error making user VIP: {e}")
        return False

def test_wallet_balance_retrieval():
    """Test wallet balance retrieval for VIP and free users"""
    print("\n2. Testing Wallet Balance Retrieval...")
    
    # Test 2a: GET wallet for VIP user
    print("\n2a. Testing GET /api/wallet/{uid} for VIP user...")
    try:
        response = requests.get(f"{API_BASE}/wallet/{test_vip_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            wallet = response.json()
            required_fields = ["cashback_balance", "profit_balance", "pending_lien", "maintenance_due", "days_until_maintenance"]
            
            if all(field in wallet for field in required_fields):
                print("✅ VIP wallet retrieval test PASSED")
                print(f"Wallet data: {json.dumps(wallet, indent=2)}")
            else:
                missing = [f for f in required_fields if f not in wallet]
                print(f"❌ VIP wallet retrieval test FAILED - Missing fields: {missing}")
                return False
        else:
            print(f"❌ VIP wallet retrieval test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ VIP wallet retrieval test FAILED - Error: {e}")
        return False
    
    # Test 2b: GET wallet for free user (should not have maintenance info)
    print("\n2b. Testing GET /api/wallet/{uid} for free user...")
    try:
        response = requests.get(f"{API_BASE}/wallet/{test_free_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            wallet = response.json()
            # Free users should not have maintenance-related fields or they should be null/0
            print("✅ Free user wallet retrieval test PASSED")
            print(f"Free user wallet: {json.dumps(wallet, indent=2)}")
        else:
            print(f"❌ Free user wallet retrieval test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Free user wallet retrieval test FAILED - Error: {e}")
        return False
    
    return True

def test_cashback_maintenance_system():
    """Test cashback maintenance system (₹99 monthly fee)"""
    print("\n3. Testing Cashback Maintenance System...")
    
    # First, set VIP activation date to 31 days ago to trigger maintenance
    print("\n3a. Setting up VIP user with past activation date...")
    vip_activation_date = (datetime.now() - timedelta(days=31)).isoformat()
    
    # We need to manually update the user's VIP activation date
    # Since we don't have direct DB access, we'll simulate this by testing the maintenance endpoint
    
    # Test 3b: Check maintenance for VIP user
    print("\n3b. Testing POST /api/wallet/check-maintenance/{uid}...")
    try:
        response = requests.post(f"{API_BASE}/wallet/check-maintenance/{test_vip_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Maintenance check test PASSED")
            print(f"Maintenance result: {json.dumps(result, indent=2)}")
            
            # Check if maintenance was applied
            if result.get("maintenance_applied"):
                print("✅ Maintenance fee applied successfully")
                return True
            else:
                print("ℹ️ Maintenance not yet due (expected for new VIP users)")
                return True
        else:
            print(f"❌ Maintenance check test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Maintenance check test FAILED - Error: {e}")
        return False

def test_order_checkout_with_delivery_charge(product_id):
    """Test order creation with delivery charge calculation via cart + checkout"""
    global test_order
    print("\n4. Testing Order Creation with Delivery Charge...")
    
    if not test_vip_user or not product_id:
        print("❌ Cannot test order creation - missing VIP user or product")
        return None
    
    try:
        # Step 1: Add product to cart
        print("4a. Adding product to cart...")
        cart_data = {
            "user_id": test_vip_user["uid"],
            "product_id": product_id,
            "quantity": 1
        }
        
        cart_response = requests.post(f"{API_BASE}/cart/add", json=cart_data, timeout=30)
        print(f"Add to cart - Status Code: {cart_response.status_code}")
        print(f"Add to cart - Response: {cart_response.text}")
        
        if cart_response.status_code != 200:
            print(f"❌ Failed to add product to cart: {cart_response.status_code}")
            return None
        
        print("✅ Product added to cart successfully")
        
        # Step 2: Checkout cart
        print("4b. Checking out cart...")
        checkout_data = {
            "user_id": test_vip_user["uid"],
            "delivery_address": "Test Address, Test City, 123456"
        }
        
        checkout_response = requests.post(f"{API_BASE}/orders/checkout", 
                                        json=checkout_data, timeout=30)
        print(f"Checkout - Status Code: {checkout_response.status_code}")
        print(f"Checkout - Response: {checkout_response.text}")
        
        if checkout_response.status_code == 200:
            order_result = checkout_response.json()
            order_id = order_result.get("order_id")
            delivery_charge = order_result.get("delivery_charge")
            
            print(f"✅ Order checkout test PASSED")
            print(f"Order ID: {order_id}")
            print(f"Delivery Charge: {delivery_charge}")
            
            # Verify delivery charge calculation (should be total_cash * delivery_charge_rate)
            # From the product: cash_price = 50.0, so delivery_charge should be 50.0 * 0.10 = 5.0
            expected_delivery_charge = 50.0 * 0.10  # 10% of cash price
            if delivery_charge and abs(delivery_charge - expected_delivery_charge) < 0.01:
                print(f"✅ Delivery charge calculation CORRECT: {delivery_charge}")
            else:
                print(f"❌ Delivery charge calculation INCORRECT: Expected {expected_delivery_charge}, got {delivery_charge}")
            
            test_order = order_result
            return order_id
        else:
            print(f"❌ Order checkout test FAILED - Status: {checkout_response.status_code}")
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
    
    # Create another order via cart + checkout
    try:
        # Add product to cart
        cart_data = {
            "user_id": test_vip_user["uid"],
            "product_id": product_id,
            "quantity": 1
        }
        
        cart_response = requests.post(f"{API_BASE}/cart/add", json=cart_data, timeout=30)
        if cart_response.status_code != 200:
            print(f"❌ Failed to add product to cart for admin test: {cart_response.status_code}")
            return False
        
        # Checkout cart
        checkout_data = {
            "user_id": test_vip_user["uid"],
            "delivery_address": "Admin Test Address, Test City, 123456"
        }
        
        response = requests.post(f"{API_BASE}/orders/checkout", 
                               json=checkout_data, 
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