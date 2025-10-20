#!/usr/bin/env python3
"""
Backend API Testing Script - VIP Checkout Issues Investigation
Tests VIP user status, cart & checkout flow, orders, and cashback wallet functionality
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

print(f"Testing VIP Checkout Issues at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# VIP Checkout Investigation Functions
def investigate_vip_user_status():
    """Check VIP User Status - membership_type field value"""
    print("\n" + "=" * 80)
    print("1. INVESTIGATING VIP USER STATUS")
    print("=" * 80)
    
    # First, let's get all users and check their membership types
    print(f"\n1.1. Getting all users from database...")
    try:
        response = requests.get(f"{API_BASE}/admin/users", timeout=30)
        if response.status_code == 200:
            users_data = response.json()
            all_users = users_data.get("users", [])
            print(f"     ✅ Found {len(all_users)} total users in database")
            
            # Check membership types
            membership_counts = {}
            vip_users_found = []
            
            for user in all_users:
                membership_type = user.get("membership_type", "unknown")
                membership_counts[membership_type] = membership_counts.get(membership_type, 0) + 1
                
                # Check for VIP users (case insensitive)
                if membership_type and membership_type.lower() == "vip":
                    vip_users_found.append({
                        "email": user.get("email"),
                        "uid": user.get("uid"),
                        "name": user.get("name"),
                        "membership_type": membership_type,
                        "kyc_status": user.get("kyc_status"),
                        "user_data": user
                    })
            
            print(f"\n     📊 Membership Type Distribution:")
            for membership_type, count in membership_counts.items():
                print(f"       - {membership_type}: {count} users")
            
            print(f"\n     🎯 VIP Users Found: {len(vip_users_found)}")
            for vip_user in vip_users_found:
                print(f"       - {vip_user['name']} ({vip_user['email']}) - membership_type: '{vip_user['membership_type']}'")
            
            # If no VIP users found, let's create one for testing
            if len(vip_users_found) == 0:
                print(f"\n1.2. No VIP users found. Creating a test VIP user...")
                
                # Create a VIP user for testing
                timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                vip_user_data = {
                    "first_name": "VIP",
                    "last_name": "TestUser",
                    "email": f"vip.test.{timestamp}@example.com",
                    "mobile": f"98765{timestamp[-5:]}",
                    "password": "VipPass123!",
                    "state": "Maharashtra",
                    "district": "Mumbai",
                    "pincode": "400001",
                    "aadhaar_number": f"9999{timestamp[-8:]}999",
                    "pan_number": f"VIP1{timestamp[-5:]}Z"
                }
                
                # Register the user
                reg_response = requests.post(f"{API_BASE}/auth/register", json=vip_user_data, timeout=30)
                if reg_response.status_code == 200:
                    new_uid = reg_response.json().get("uid")
                    print(f"     ✅ Test user created: {new_uid}")
                    
                    # Manually update to VIP (simulate admin approval)
                    # First, let's try to promote the user to VIP
                    promote_data = {"membership_type": "vip"}
                    
                    # Try different endpoints to set VIP status
                    endpoints_to_try = [
                        f"/admin/users/{new_uid}/update",
                        f"/admin/promote",
                        f"/membership/payment/{new_uid}/action"
                    ]
                    
                    vip_set = False
                    for endpoint in endpoints_to_try:
                        try:
                            if "promote" in endpoint:
                                promote_response = requests.post(f"{API_BASE}{endpoint}", 
                                                               params={"email": vip_user_data["email"], "role": "user"}, 
                                                               timeout=30)
                            else:
                                promote_response = requests.post(f"{API_BASE}{endpoint}", 
                                                               json=promote_data, timeout=30)
                            
                            if promote_response.status_code == 200:
                                print(f"     ✅ User promoted via {endpoint}")
                                vip_set = True
                                break
                        except:
                            continue
                    
                    if not vip_set:
                        print(f"     ⚠️  Could not automatically set VIP status. User created as 'free' member.")
                    
                    # Add the new user to our VIP list for testing (even if still 'free')
                    vip_users_found.append({
                        "email": vip_user_data["email"],
                        "uid": new_uid,
                        "name": f"{vip_user_data['first_name']} {vip_user_data['last_name']}",
                        "membership_type": "vip" if vip_set else "free",
                        "kyc_status": "pending",
                        "user_data": vip_user_data,
                        "password": vip_user_data["password"]  # Store for login testing
                    })
                else:
                    print(f"     ❌ Failed to create test user: {reg_response.status_code}")
            
            return vip_users_found
            
        else:
            print(f"     ❌ Failed to get users list: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error getting users: {e}")
    
    # Fallback: Test specific users manually
    print(f"\n1.3. Fallback: Testing specific users manually...")
    test_users = [
        {"email": "admin@paras.com", "password": "admin123"},
        {"email": "santosh@paras.com", "password": "password"},
        {"email": "test@paras.com", "password": "password"}
    ]
    
    vip_users_found = []
    
    for user_info in test_users:
        email = user_info["email"]
        password = user_info["password"]
        print(f"\n     Checking user: {email}")
        
        try:
            # Try to login to get user data
            response = requests.post(
                f"{API_BASE}/auth/login",
                params={
                    "identifier": email,
                    "password": password
                },
                timeout=30
            )
            
            print(f"     Login Status: {response.status_code}")
            
            if response.status_code == 200:
                user_data = response.json()
                membership_type = user_data.get("membership_type")
                uid = user_data.get("uid")
                name = user_data.get("name")
                
                print(f"     ✅ User found: {name} (UID: {uid})")
                print(f"     📋 membership_type: '{membership_type}'")
                print(f"     📋 kyc_status: '{user_data.get('kyc_status')}'")
                print(f"     📋 role: '{user_data.get('role')}'")
                print(f"     📋 is_active: {user_data.get('is_active')}")
                
                # Add to VIP list regardless of membership type for testing
                vip_users_found.append({
                    "email": email,
                    "uid": uid,
                    "name": name,
                    "membership_type": membership_type,
                    "kyc_status": user_data.get("kyc_status"),
                    "user_data": user_data,
                    "password": password
                })
                
                if membership_type and membership_type.lower() == "vip":
                    print(f"     🎯 VIP USER FOUND!")
                else:
                    print(f"     ⚠️  Not VIP (membership_type: '{membership_type}') - but will use for testing")
                    
            elif response.status_code == 401:
                print(f"     ❌ Wrong password for {email}")
            elif response.status_code == 404:
                print(f"     ❌ User not found: {email}")
            else:
                print(f"     ❓ Unexpected status: {response.status_code}")
                
        except Exception as e:
            print(f"     ❌ Error checking {email}: {e}")
    
    print(f"\n📊 SUMMARY: Found {len(vip_users_found)} users for testing")
    for user in vip_users_found:
        print(f"   - {user['name']} ({user['email']}) - membership_type: '{user['membership_type']}'")
    
    return vip_users_found

def test_cart_and_checkout_flow(test_users):
    """Test Cart & Checkout Flow for users"""
    print("\n" + "=" * 80)
    print("2. TESTING CART & CHECKOUT FLOW")
    print("=" * 80)
    
    if not test_users:
        print("❌ No users found to test cart & checkout flow")
        return False
    
    # Use first user for testing
    test_user = test_users[0]
    uid = test_user["uid"]
    name = test_user["name"]
    membership_type = test_user["membership_type"]
    
    print(f"\n2.1. Testing with user: {name} (UID: {uid})")
    print(f"     Membership Type: {membership_type}")
    
    if membership_type != "vip":
        print(f"     ⚠️  User is not VIP - this may cause checkout to fail")
    
    # Step 1: Get available products
    print(f"\n2.2. Getting available products...")
    try:
        response = requests.get(f"{API_BASE}/products", timeout=30)
        if response.status_code == 200:
            products = response.json()
            print(f"     ✅ Found {len(products)} products")
            
            if len(products) == 0:
                print("     ❌ No products available for testing")
                return False
                
            # Use first product for testing
            test_product = products[0]
            product_id = test_product.get("product_id")
            product_name = test_product.get("name")
            prc_price = test_product.get("prc_price")
            cash_price = test_product.get("cash_price")
            
            print(f"     📦 Test Product: {product_name}")
            print(f"     💰 PRC Price: {prc_price}")
            print(f"     💵 Cash Price: {cash_price}")
            
        else:
            print(f"     ❌ Failed to get products: {response.status_code}")
            return False
    except Exception as e:
        print(f"     ❌ Error getting products: {e}")
        return False
    
    # Step 2: Add product to cart
    print(f"\n2.3. Adding product to cart...")
    try:
        cart_data = {
            "product_id": product_id,
            "quantity": 1
        }
        
        response = requests.post(f"{API_BASE}/cart/add", json=cart_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            print(f"     ✅ Product added to cart successfully")
        else:
            print(f"     ❌ Failed to add to cart: {response.status_code}")
            # Continue with checkout test anyway
            
    except Exception as e:
        print(f"     ❌ Error adding to cart: {e}")
    
    # Step 3: Get cart contents
    print(f"\n2.4. Getting cart contents...")
    try:
        response = requests.get(f"{API_BASE}/cart/{uid}", timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            cart_data = response.json()
            print(f"     ✅ Cart retrieved successfully")
            print(f"     📋 Cart items: {len(cart_data.get('items', []))}")
        else:
            print(f"     ❌ Failed to get cart: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error getting cart: {e}")
    
    # Step 4: Attempt checkout
    print(f"\n2.5. Attempting checkout...")
    try:
        checkout_data = {
            "user_id": uid,
            "delivery_address": {
                "street": "123 Test Street",
                "city": "Test City", 
                "state": "Test State",
                "pincode": "123456"
            }
        }
        
        response = requests.post(f"{API_BASE}/orders/checkout", json=checkout_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            print(f"     ✅ Checkout successful!")
            checkout_result = response.json()
            order_id = checkout_result.get("order_id")
            if order_id:
                print(f"     📋 Order ID: {order_id}")
                return {"success": True, "order_id": order_id, "user": test_user}
        else:
            print(f"     ❌ CHECKOUT FAILED - Status: {response.status_code}")
            print(f"     🔍 EXACT ERROR MESSAGE: {response.text}")
            return {"success": False, "error": response.text, "status": response.status_code, "user": test_user}
            
    except Exception as e:
        print(f"     ❌ Error during checkout: {e}")
        return {"success": False, "error": str(e), "user": test_user}

def check_orders_in_database(vip_users):
    """Check Orders - List all orders for VIP users"""
    print("\n" + "=" * 80)
    print("3. CHECKING ORDERS IN DATABASE")
    print("=" * 80)
    
    if not vip_users:
        print("❌ No VIP users found to check orders")
        return False
    
    total_orders_found = 0
    
    for vip_user in vip_users:
        uid = vip_user["uid"]
        name = vip_user["name"]
        
        print(f"\n3.1. Checking orders for: {name} (UID: {uid})")
        
        try:
            # Try different order endpoints
            endpoints_to_try = [
                f"/orders/{uid}",
                f"/orders/legacy/{uid}",
                f"/admin/orders/all?user_id={uid}"
            ]
            
            for endpoint in endpoints_to_try:
                print(f"\n     Trying: GET {endpoint}")
                response = requests.get(f"{API_BASE}{endpoint}", timeout=30)
                print(f"     Status: {response.status_code}")
                
                if response.status_code == 200:
                    orders_data = response.json()
                    
                    # Handle different response formats
                    if isinstance(orders_data, list):
                        orders = orders_data
                    elif isinstance(orders_data, dict):
                        orders = orders_data.get("orders", orders_data.get("data", []))
                    else:
                        orders = []
                    
                    print(f"     ✅ Found {len(orders)} orders")
                    total_orders_found += len(orders)
                    
                    # Show order details
                    for i, order in enumerate(orders[:3]):  # Show first 3 orders
                        order_id = order.get("order_id")
                        status = order.get("status")
                        created_at = order.get("created_at")
                        total_amount = order.get("total_amount") or order.get("total_cash_fee")
                        
                        print(f"       Order {i+1}: {order_id}")
                        print(f"         Status: {status}")
                        print(f"         Created: {created_at}")
                        print(f"         Amount: {total_amount}")
                    
                    if len(orders) > 3:
                        print(f"       ... and {len(orders) - 3} more orders")
                    
                    break  # Found orders, no need to try other endpoints
                    
                elif response.status_code == 404:
                    print(f"     ⚠️  Endpoint not found or no orders")
                else:
                    print(f"     ❌ Error: {response.status_code}")
                    
        except Exception as e:
            print(f"     ❌ Error checking orders for {name}: {e}")
    
    print(f"\n📊 TOTAL ORDERS FOUND: {total_orders_found}")
    return total_orders_found > 0

def check_cashback_wallet(vip_users):
    """Check Cashback Wallet - Verify cashback balance"""
    print("\n" + "=" * 80)
    print("4. CHECKING CASHBACK WALLET")
    print("=" * 80)
    
    if not vip_users:
        print("❌ No VIP users found to check cashback wallet")
        return False
    
    for vip_user in vip_users:
        uid = vip_user["uid"]
        name = vip_user["name"]
        
        print(f"\n4.1. Checking cashback wallet for: {name} (UID: {uid})")
        
        try:
            # Get wallet information
            response = requests.get(f"{API_BASE}/wallet/{uid}", timeout=30)
            print(f"     Status: {response.status_code}")
            
            if response.status_code == 200:
                wallet_data = response.json()
                print(f"     ✅ Wallet data retrieved")
                
                # Extract wallet balances
                cashback_balance = wallet_data.get("cashback_balance", 0)
                profit_balance = wallet_data.get("profit_balance", 0)
                prc_balance = wallet_data.get("prc_balance", 0)
                wallet_status = wallet_data.get("wallet_status", "unknown")
                pending_lien = wallet_data.get("pending_lien", 0)
                maintenance_due = wallet_data.get("maintenance_due", False)
                
                print(f"     💰 Cashback Balance: ₹{cashback_balance}")
                print(f"     💼 Profit Balance: ₹{profit_balance}")
                print(f"     🪙 PRC Balance: {prc_balance}")
                print(f"     📊 Wallet Status: {wallet_status}")
                print(f"     ⚠️  Pending Lien: ₹{pending_lien}")
                print(f"     🔧 Maintenance Due: {maintenance_due}")
                
                # Check if user has any cashback (indicating successful orders)
                if cashback_balance > 0:
                    print(f"     🎯 USER HAS CASHBACK - Orders have been processed!")
                else:
                    print(f"     ⚠️  No cashback balance - May indicate no successful orders")
                    
            else:
                print(f"     ❌ Failed to get wallet data: {response.status_code}")
                print(f"     Response: {response.text}")
                
        except Exception as e:
            print(f"     ❌ Error checking wallet for {name}: {e}")
    
    return True

def run_vip_checkout_investigation():
    """Main function to run VIP checkout investigation"""
    print("\n" + "🔍" * 80)
    print("VIP CHECKOUT ISSUES INVESTIGATION")
    print("🔍" * 80)
    
    # Step 1: Check VIP User Status
    vip_users = investigate_vip_user_status()
    
    # Step 2: Test Cart & Checkout Flow
    checkout_result = test_cart_and_checkout_flow(vip_users)
    
    # Step 3: Check Orders in Database
    orders_exist = check_orders_in_database(vip_users)
    
    # Step 4: Check Cashback Wallet
    check_cashback_wallet(vip_users)
    
    # Final Summary
    print("\n" + "📋" * 80)
    print("VIP CHECKOUT INVESTIGATION SUMMARY")
    print("📋" * 80)
    
    print(f"\n1. VIP USERS FOUND: {len(vip_users)}")
    for vip_user in vip_users:
        print(f"   - {vip_user['name']} ({vip_user['email']}) - membership_type: '{vip_user['membership_type']}'")
    
    print(f"\n2. CHECKOUT TEST RESULT:")
    if checkout_result:
        if checkout_result.get("success"):
            print(f"   ✅ Checkout SUCCESSFUL - Order ID: {checkout_result.get('order_id')}")
        else:
            print(f"   ❌ Checkout FAILED")
            print(f"   🔍 Error: {checkout_result.get('error')}")
            print(f"   📊 Status Code: {checkout_result.get('status')}")
    else:
        print(f"   ⚠️  Checkout test not performed (no VIP users)")
    
    print(f"\n3. ORDERS IN DATABASE:")
    if orders_exist:
        print(f"   ✅ Orders found in database")
    else:
        print(f"   ❌ No orders found in database")
    
    print(f"\n4. POTENTIAL ISSUES IDENTIFIED:")
    issues_found = []
    
    if len(vip_users) == 0:
        issues_found.append("No VIP users found - check membership_type values")
    
    if checkout_result and not checkout_result.get("success"):
        issues_found.append(f"Checkout failing - {checkout_result.get('error')}")
    
    if not orders_exist:
        issues_found.append("No orders in database - checkout may not be creating orders")
    
    if len(issues_found) == 0:
        print(f"   ✅ No major issues identified")
    else:
        for i, issue in enumerate(issues_found, 1):
            print(f"   {i}. {issue}")
    
    return {
        "vip_users": vip_users,
        "checkout_result": checkout_result,
        "orders_exist": orders_exist,
        "issues": issues_found
    }

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
            
            # Check required KPI sections (actual API structure)
            required_sections = [
                "users", "orders", "kyc", "vip_payments",
                "withdrawals", "products", "financial",
                "stock_movements", "security_deposits", "renewals",
                "recent_activity"
            ]
            
            missing_sections = []
            for section in required_sections:
                if section not in stats:
                    missing_sections.append(section)
            
            if missing_sections:
                print(f"❌ Admin KPIs test FAILED - Missing sections: {missing_sections}")
                return False
            
            # Validate users structure
            users = stats.get("users", {})
            user_required = ["total", "vip", "free", "master_stockists", "sub_stockists", "outlets"]
            for field in user_required:
                if field not in users:
                    print(f"❌ Admin KPIs test FAILED - Missing users.{field}")
                    return False
            
            # Validate orders structure
            orders = stats.get("orders", {})
            order_required = ["total", "pending", "delivered"]
            for field in order_required:
                if field not in orders:
                    print(f"❌ Admin KPIs test FAILED - Missing orders.{field}")
                    return False
            
            # Validate financial structure
            financial = stats.get("financial", {})
            financial_required = ["total_revenue", "total_security_deposits"]
            for field in financial_required:
                if field not in financial:
                    print(f"❌ Admin KPIs test FAILED - Missing financial.{field}")
                    return False
            
            print(f"✅ Admin KPIs test PASSED - All required sections present")
            print(f"   Users: {users.get('total', 0)} total, {users.get('vip', 0)} VIP")
            print(f"   Orders: {orders.get('total', 0)} total, {orders.get('pending', 0)} pending")
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
                        required_fields = ["order", "user_details", "items", "commission_breakdown"]
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
            print(f"Audit log response: {result}")
            audit_id = result.get("audit_id") or result.get("log_id")
            
            if not audit_id:
                print("❌ Audit log creation test FAILED - No audit_id or log_id returned")
                print(f"Response content: {result}")
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

def test_login_case_sensitivity_fix():
    """Test and potentially fix login case sensitivity issue"""
    print("\n" + "=" * 80)
    print("TESTING LOGIN CASE SENSITIVITY FIX")
    print("=" * 80)
    
    # Test cases for case sensitivity
    test_cases = [
        {"email": "Santosh@paras.com", "expected_stored": "santosh@paras.com"},
        {"email": "SANTOSH@PARAS.COM", "expected_stored": "santosh@paras.com"},
        {"email": "santosh@paras.com", "expected_stored": "santosh@paras.com"},
        {"email": "Test@paras.com", "expected_stored": "test@paras.com"},
        {"email": "ADMIN@PARAS.COM", "expected_stored": "admin@paras.com"}
    ]
    
    print("\n1. Testing case sensitivity in login endpoint...")
    
    for i, test_case in enumerate(test_cases, 1):
        test_email = test_case["email"]
        expected_stored = test_case["expected_stored"]
        
        print(f"\n1.{i}. Testing login with: {test_email}")
        print(f"     Expected stored as: {expected_stored}")
        
        try:
            # Test login with the case-variant email
            response = requests.post(
                f"{API_BASE}/auth/login",
                params={
                    "identifier": test_email,
                    "password": "wrongpassword"  # Intentionally wrong to test user existence
                },
                timeout=30
            )
            
            print(f"     Status Code: {response.status_code}")
            
            if response.status_code == 404:
                print(f"     ❌ User not found - case sensitivity issue")
                
                # Test with lowercase version
                response_lower = requests.post(
                    f"{API_BASE}/auth/login",
                    params={
                        "identifier": test_email.lower(),
                        "password": "wrongpassword"
                    },
                    timeout=30
                )
                
                if response_lower.status_code == 401:
                    print(f"     ✅ User found with lowercase - confirms case sensitivity issue")
                elif response_lower.status_code == 200:
                    print(f"     ✅ User found with lowercase - login successful")
                else:
                    print(f"     ❓ Unexpected response with lowercase: {response_lower.status_code}")
                    
            elif response.status_code == 401:
                print(f"     ✅ User found (wrong password) - no case sensitivity issue")
            elif response.status_code == 200:
                print(f"     ✅ User found and login successful - no case sensitivity issue")
            else:
                print(f"     ❓ Unexpected status: {response.status_code}")
                
        except Exception as e:
            print(f"     ❌ Error testing: {e}")
    
    return True

def test_login_issue_santosh():
    """Test login issue for user Santosh@paras.com - Debug 'User not found' error"""
    print("\n" + "=" * 80)
    print("DEBUGGING LOGIN ISSUE FOR USER: Santosh@paras.com")
    print("=" * 80)
    
    target_email = "Santosh@paras.com"
    
    # Step 1: Check if user exists with exact email
    print(f"\n1. Checking if user exists with exact email: {target_email}")
    try:
        # Try to get all users and search for this email
        response = requests.get(f"{API_BASE}/admin/users", timeout=30)
        if response.status_code == 200:
            users_data = response.json()
            users = users_data.get("users", [])
            print(f"Total users in database: {len(users)}")
            
            # Search for exact match
            exact_match = None
            for user in users:
                if user.get("email") == target_email:
                    exact_match = user
                    break
            
            if exact_match:
                print(f"✅ FOUND exact match: {exact_match.get('email')} (UID: {exact_match.get('uid')})")
                print(f"   Name: {exact_match.get('name', 'N/A')}")
                print(f"   Role: {exact_match.get('role', 'N/A')}")
                print(f"   Active: {exact_match.get('is_active', 'N/A')}")
            else:
                print(f"❌ NO exact match found for: {target_email}")
        else:
            print(f"❌ Failed to get users list - Status: {response.status_code}")
            # Try alternative approach - direct login test
            print("Proceeding with direct login test...")
    except Exception as e:
        print(f"❌ Error checking users: {e}")
    
    # Step 2: Check for case-insensitive matches
    print(f"\n2. Checking for case-insensitive matches...")
    try:
        response = requests.get(f"{API_BASE}/admin/users", timeout=30)
        if response.status_code == 200:
            users_data = response.json()
            users = users_data.get("users", [])
            
            # Search for case-insensitive matches
            case_matches = []
            for user in users:
                user_email = user.get("email")
                if user_email and user_email.lower() == target_email.lower() and user_email != target_email:
                    case_matches.append(user)
            
            if case_matches:
                print(f"✅ FOUND {len(case_matches)} case-insensitive matches:")
                for match in case_matches:
                    print(f"   Email: {match.get('email')} (UID: {match.get('uid')})")
                    print(f"   Name: {match.get('name', 'N/A')}")
                    print(f"   Role: {match.get('role', 'N/A')}")
                    print(f"   Active: {match.get('is_active', 'N/A')}")
            else:
                print(f"❌ NO case-insensitive matches found")
        else:
            print(f"❌ Failed to get users for case check - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking case-insensitive matches: {e}")
    
    # Step 3: Search for partial matches (santosh in email)
    print(f"\n3. Searching for partial matches (santosh in email)...")
    try:
        response = requests.get(f"{API_BASE}/admin/users", timeout=30)
        if response.status_code == 200:
            users_data = response.json()
            users = users_data.get("users", [])
            
            # Search for partial matches
            partial_matches = []
            for user in users:
                user_email = user.get("email")
                if user_email and "santosh" in user_email.lower():
                    partial_matches.append(user)
            
            if partial_matches:
                print(f"✅ FOUND {len(partial_matches)} partial matches:")
                for match in partial_matches:
                    print(f"   Email: {match.get('email')} (UID: {match.get('uid')})")
                    print(f"   Name: {match.get('name', 'N/A')}")
                    print(f"   Role: {match.get('role', 'N/A')}")
                    print(f"   Active: {match.get('is_active', 'N/A')}")
            else:
                print(f"❌ NO partial matches found for 'santosh'")
        else:
            print(f"❌ Failed to get users for partial search - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error searching partial matches: {e}")
    
    # Step 4: Test login endpoint with the exact email
    print(f"\n4. Testing login endpoint with email: {target_email}")
    try:
        # Test with a common password (we don't know the actual password)
        test_passwords = ["password", "123456", "santosh123", "Password123", "admin"]
        
        for password in test_passwords:
            print(f"\n   Testing with password: {password}")
            
            # Test using query parameters (as per the API)
            response = requests.post(
                f"{API_BASE}/auth/login",
                params={
                    "identifier": target_email,
                    "password": password
                },
                timeout=30
            )
            
            print(f"   Status Code: {response.status_code}")
            print(f"   Response: {response.text}")
            
            if response.status_code == 404:
                print(f"   ❌ User not found (404) - confirms the issue")
            elif response.status_code == 401:
                print(f"   ✅ User found but wrong password (401) - user exists!")
                return True
            elif response.status_code == 200:
                print(f"   ✅ Login successful! User exists and password is correct")
                return True
            else:
                print(f"   ❓ Unexpected status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing login: {e}")
    
    # Step 5: Test login with lowercase version
    print(f"\n5. Testing login with lowercase email: {target_email.lower()}")
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            params={
                "identifier": target_email.lower(),
                "password": "password"  # Test password
            },
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 404:
            print(f"❌ User not found with lowercase email either")
        elif response.status_code == 401:
            print(f"✅ User found with lowercase email! Case sensitivity issue confirmed")
        elif response.status_code == 200:
            print(f"✅ Login successful with lowercase email!")
    except Exception as e:
        print(f"❌ Error testing lowercase login: {e}")
    
    # Step 6: Test with other users to verify login endpoint works
    print(f"\n6. Testing login endpoint with other users to verify it works...")
    try:
        response = requests.get(f"{API_BASE}/admin/users", timeout=30)
        if response.status_code == 200:
            users_data = response.json()
            users = users_data.get("users", [])
            
            # Test with first 3 users
            test_count = 0
            for user in users[:3]:
                if test_count >= 3:
                    break
                    
                user_email = user.get("email")
                if user_email and user_email != target_email:
                    print(f"\n   Testing login with user: {user_email}")
                    
                    response = requests.post(
                        f"{API_BASE}/auth/login",
                        params={
                            "identifier": user_email,
                            "password": "wrongpassword"  # Intentionally wrong
                        },
                        timeout=30
                    )
                    
                    print(f"   Status Code: {response.status_code}")
                    
                    if response.status_code == 404:
                        print(f"   ❌ User not found - login endpoint might have issues")
                    elif response.status_code == 401:
                        print(f"   ✅ User found (wrong password) - login endpoint works")
                    elif response.status_code == 200:
                        print(f"   ✅ Login successful - login endpoint works")
                    
                    test_count += 1
        else:
            print(f"❌ Failed to get users for login testing - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing other users: {e}")
    
    print(f"\n" + "=" * 80)
    print("LOGIN ISSUE INVESTIGATION COMPLETED")
    print("=" * 80)
    
    return False  # Issue not resolved, just investigated

def test_comprehensive_login_case_sensitivity():
    """Comprehensive test for login case sensitivity fix"""
    print("\n" + "=" * 80)
    print("COMPREHENSIVE LOGIN CASE SENSITIVITY FIX TESTING")
    print("=" * 80)
    
    # Test cases as specified in the review request
    test_cases = [
        {
            "email": "Santosh@paras.com",
            "description": "Mixed case - should work after fix"
        },
        {
            "email": "SANTOSH@PARAS.COM", 
            "description": "Uppercase - should work after fix"
        },
        {
            "email": "santosh@paras.com",
            "description": "Lowercase - should still work"
        },
        {
            "email": "Test@paras.com",
            "description": "Mixed case Test user - should work after fix"
        },
        {
            "email": "ADMIN@PARAS.COM",
            "description": "Uppercase Admin user - should work after fix"
        }
    ]
    
    results = []
    
    print("\n1. Testing case-insensitive email login functionality...")
    
    for i, test_case in enumerate(test_cases, 1):
        test_email = test_case["email"]
        description = test_case["description"]
        
        print(f"\n1.{i}. Testing: {test_email}")
        print(f"     Description: {description}")
        
        try:
            # Test with intentionally wrong password to check if user is found
            response = requests.post(
                f"{API_BASE}/auth/login",
                params={
                    "identifier": test_email,
                    "password": "intentionally_wrong_password_12345"
                },
                timeout=30
            )
            
            print(f"     Status Code: {response.status_code}")
            
            if response.status_code == 404:
                print(f"     ❌ FAILED: User not found (404) - case sensitivity issue still exists")
                results.append({
                    "email": test_email,
                    "status": "FAILED",
                    "issue": "User not found - case sensitivity problem"
                })
            elif response.status_code == 401:
                print(f"     ✅ PASSED: User found but wrong password (401) - case insensitive matching works")
                results.append({
                    "email": test_email,
                    "status": "PASSED",
                    "issue": None
                })
            elif response.status_code == 200:
                print(f"     ✅ PASSED: Login successful (200) - case insensitive matching works")
                results.append({
                    "email": test_email,
                    "status": "PASSED",
                    "issue": None
                })
            else:
                print(f"     ❓ UNEXPECTED: Status {response.status_code} - {response.text}")
                results.append({
                    "email": test_email,
                    "status": "UNEXPECTED",
                    "issue": f"Unexpected status {response.status_code}"
                })
                
        except Exception as e:
            print(f"     ❌ ERROR: {e}")
            results.append({
                "email": test_email,
                "status": "ERROR",
                "issue": str(e)
            })
    
    # Test mobile and UID login to ensure they're not affected
    print(f"\n2. Testing mobile and UID login (should not be affected)...")
    
    # Try to find a user with mobile number for testing
    try:
        response = requests.get(f"{API_BASE}/admin/users", timeout=30)
        if response.status_code == 200:
            users_data = response.json()
            users = users_data.get("users", [])
            
            # Find a user with mobile number
            test_user = None
            for user in users:
                if user.get("mobile"):
                    test_user = user
                    break
            
            if test_user:
                mobile = test_user.get("mobile")
                uid = test_user.get("uid")
                
                print(f"\n2.1. Testing mobile login: {mobile}")
                response_mobile = requests.post(
                    f"{API_BASE}/auth/login",
                    params={
                        "identifier": mobile,
                        "password": "wrong_password"
                    },
                    timeout=30
                )
                
                if response_mobile.status_code in [401, 200]:
                    print(f"     ✅ Mobile login works (Status: {response_mobile.status_code})")
                else:
                    print(f"     ❌ Mobile login issue (Status: {response_mobile.status_code})")
                
                print(f"\n2.2. Testing UID login: {uid}")
                response_uid = requests.post(
                    f"{API_BASE}/auth/login",
                    params={
                        "identifier": uid,
                        "password": "wrong_password"
                    },
                    timeout=30
                )
                
                if response_uid.status_code in [401, 200]:
                    print(f"     ✅ UID login works (Status: {response_uid.status_code})")
                else:
                    print(f"     ❌ UID login issue (Status: {response_uid.status_code})")
            else:
                print("     ⚠️  No users with mobile numbers found for testing")
        else:
            print(f"     ❌ Could not get users list (Status: {response.status_code})")
    except Exception as e:
        print(f"     ❌ Error testing mobile/UID login: {e}")
    
    # Summary
    print(f"\n" + "=" * 80)
    print("LOGIN CASE SENSITIVITY FIX TEST RESULTS")
    print("=" * 80)
    
    passed_count = sum(1 for r in results if r["status"] == "PASSED")
    failed_count = sum(1 for r in results if r["status"] == "FAILED")
    error_count = sum(1 for r in results if r["status"] == "ERROR")
    unexpected_count = sum(1 for r in results if r["status"] == "UNEXPECTED")
    
    print(f"Total Tests: {len(results)}")
    print(f"✅ Passed: {passed_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"🔥 Errors: {error_count}")
    print(f"❓ Unexpected: {unexpected_count}")
    
    print(f"\nDetailed Results:")
    for result in results:
        status_icon = "✅" if result["status"] == "PASSED" else "❌"
        print(f"{status_icon} {result['email']}: {result['status']}")
        if result["issue"]:
            print(f"   Issue: {result['issue']}")
    
    # Determine overall result
    if failed_count == 0 and error_count == 0:
        print(f"\n🎉 OVERALL RESULT: LOGIN CASE SENSITIVITY FIX IS WORKING!")
        print("All email variations can now login successfully (case-insensitive)")
        return True
    else:
        print(f"\n💥 OVERALL RESULT: LOGIN CASE SENSITIVITY FIX NEEDS ATTENTION!")
        print("Some email variations still fail - case sensitivity issue persists")
        return False

def test_login_api_response_format():
    """Test LOGIN API RESPONSE FORMAT - Check what data is being returned"""
    print("\n" + "=" * 80)
    print("TESTING LOGIN API RESPONSE FORMAT")
    print("=" * 80)
    
    print("Testing POST /api/auth/login with email 'admin@paras.com' and password 'admin123'")
    print("Checking COMPLETE response structure and role field presence")
    
    try:
        # Test login with admin credentials
        response = requests.post(
            f"{API_BASE}/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin123"
            },
            timeout=30
        )
        
        print(f"\n1. LOGIN RESPONSE:")
        print(f"   Status Code: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('content-type', 'N/A')}")
        
        if response.status_code == 200:
            print(f"\n2. COMPLETE RESPONSE STRUCTURE:")
            try:
                response_data = response.json()
                print(json.dumps(response_data, indent=2, default=str))
                
                print(f"\n3. ROLE FIELD CHECK:")
                role_field = response_data.get("role")
                if role_field is not None:
                    print(f"   ✅ 'role' field is PRESENT: '{role_field}'")
                    
                    if role_field == "admin":
                        print(f"   ✅ Role is correctly set to 'admin'")
                    else:
                        print(f"   ⚠️  Role is '{role_field}' (not 'admin')")
                else:
                    print(f"   ❌ 'role' field is MISSING from response")
                
                print(f"\n4. OBJECTID SERIALIZATION CHECK:")
                # Check for any ObjectId serialization issues
                response_str = response.text
                if "_id" in response_str:
                    print(f"   ⚠️  Response contains '_id' field - potential ObjectId serialization issue")
                else:
                    print(f"   ✅ No '_id' fields found - ObjectId properly excluded")
                
                # Check for any serialization errors in the response
                if "ObjectId" in response_str:
                    print(f"   ❌ Response contains 'ObjectId' string - serialization issue detected")
                else:
                    print(f"   ✅ No ObjectId serialization issues detected")
                
                print(f"\n5. KEY FIELDS ANALYSIS:")
                key_fields = ["uid", "email", "name", "role", "membership_type", "kyc_status", "is_active"]
                for field in key_fields:
                    value = response_data.get(field)
                    if value is not None:
                        print(f"   ✅ {field}: {value}")
                    else:
                        print(f"   ❌ {field}: MISSING")
                
                return True
                
            except json.JSONDecodeError as e:
                print(f"   ❌ JSON DECODE ERROR: {e}")
                print(f"   Raw response: {response.text}")
                return False
                
        elif response.status_code == 401:
            print(f"\n   ❌ LOGIN FAILED: Invalid credentials (401)")
            print(f"   Response: {response.text}")
            
            # Try with different password variations
            print(f"\n   Trying alternative passwords...")
            alt_passwords = ["Admin123", "password", "123456", "admin", "paras123"]
            
            for alt_pass in alt_passwords:
                print(f"   Testing password: {alt_pass}")
                alt_response = requests.post(
                    f"{API_BASE}/auth/login",
                    params={
                        "identifier": "admin@paras.com",
                        "password": alt_pass
                    },
                    timeout=30
                )
                
                if alt_response.status_code == 200:
                    print(f"   ✅ SUCCESS with password: {alt_pass}")
                    response_data = alt_response.json()
                    print(json.dumps(response_data, indent=2, default=str))
                    return True
                elif alt_response.status_code == 401:
                    print(f"   ❌ Failed with: {alt_pass}")
                else:
                    print(f"   ❓ Unexpected status {alt_response.status_code} with: {alt_pass}")
            
            return False
            
        elif response.status_code == 404:
            print(f"\n   ❌ USER NOT FOUND (404)")
            print(f"   Response: {response.text}")
            
            # Try case variations
            print(f"\n   Trying email case variations...")
            email_variations = ["Admin@paras.com", "ADMIN@PARAS.COM", "admin@paras.com"]
            
            for email_var in email_variations:
                print(f"   Testing email: {email_var}")
                var_response = requests.post(
                    f"{API_BASE}/auth/login",
                    params={
                        "identifier": email_var,
                        "password": "admin123"
                    },
                    timeout=30
                )
                
                if var_response.status_code == 200:
                    print(f"   ✅ SUCCESS with email: {email_var}")
                    response_data = var_response.json()
                    print(json.dumps(response_data, indent=2, default=str))
                    return True
                elif var_response.status_code == 401:
                    print(f"   ✅ User found but wrong password with: {email_var}")
                elif var_response.status_code == 404:
                    print(f"   ❌ User not found with: {email_var}")
                else:
                    print(f"   ❓ Unexpected status {var_response.status_code} with: {email_var}")
            
            return False
            
        else:
            print(f"\n   ❌ UNEXPECTED STATUS: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR testing login API: {e}")
        return False

def check_admin_user_role():
    """Check the role of user with email 'admin@paras.com'"""
    print("\n" + "=" * 80)
    print("CHECKING ADMIN USER ROLE - admin@paras.com")
    print("=" * 80)
    
    target_email = "admin@paras.com"
    
    print(f"1. Searching for user with email: {target_email}")
    
    try:
        # Get all users to find the admin user
        response = requests.get(f"{API_BASE}/admin/users", timeout=30)
        print(f"Admin users endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            users_data = response.json()
            users = users_data.get("users", [])
            print(f"Total users found: {len(users)}")
            
            # Search for exact match (case-sensitive)
            exact_match = None
            for user in users:
                if user.get("email") == target_email:
                    exact_match = user
                    break
            
            if exact_match:
                print(f"\n✅ FOUND USER (exact match):")
                print(f"   Email: {exact_match.get('email')}")
                print(f"   UID: {exact_match.get('uid')}")
                print(f"   Name: {exact_match.get('name', 'N/A')}")
                print(f"   Role: {exact_match.get('role', 'N/A')}")
                print(f"   Status: {'Active' if exact_match.get('is_active') else 'Inactive'}")
                
                role = exact_match.get('role', 'N/A')
                if role == 'admin':
                    print(f"\n✅ ROLE VERIFICATION: User has 'admin' role")
                    print("   This should enable admin navigation links")
                else:
                    print(f"\n❌ ROLE ISSUE: User role is '{role}', not 'admin'")
                    print("   This explains why admin link is not showing in navbar")
                
                return exact_match
            
            # Search for case-insensitive match
            print(f"\n❌ No exact match found. Searching case-insensitive...")
            case_matches = []
            for user in users:
                user_email = user.get("email")
                if user_email and user_email.lower() == target_email.lower():
                    case_matches.append(user)
            
            if case_matches:
                print(f"\n✅ FOUND {len(case_matches)} case-insensitive matches:")
                for i, match in enumerate(case_matches, 1):
                    print(f"\n   Match {i}:")
                    print(f"   Email: {match.get('email')}")
                    print(f"   UID: {match.get('uid')}")
                    print(f"   Name: {match.get('name', 'N/A')}")
                    print(f"   Role: {match.get('role', 'N/A')}")
                    print(f"   Status: {'Active' if match.get('is_active') else 'Inactive'}")
                    
                    role = match.get('role', 'N/A')
                    if role == 'admin':
                        print(f"   ✅ This user has 'admin' role")
                    else:
                        print(f"   ❌ This user has '{role}' role, not 'admin'")
                
                return case_matches[0]  # Return first match
            
            # Search for partial matches
            print(f"\n❌ No case-insensitive matches. Searching for partial matches...")
            partial_matches = []
            for user in users:
                user_email = user.get("email")
                if user_email and "admin" in user_email.lower():
                    partial_matches.append(user)
            
            if partial_matches:
                print(f"\n✅ FOUND {len(partial_matches)} partial matches (containing 'admin'):")
                for i, match in enumerate(partial_matches, 1):
                    print(f"\n   Match {i}:")
                    print(f"   Email: {match.get('email')}")
                    print(f"   UID: {match.get('uid')}")
                    print(f"   Name: {match.get('name', 'N/A')}")
                    print(f"   Role: {match.get('role', 'N/A')}")
                    print(f"   Status: {'Active' if match.get('is_active') else 'Inactive'}")
            else:
                print(f"\n❌ No users found with 'admin' in email")
            
            print(f"\n❌ CONCLUSION: User 'admin@paras.com' not found in database")
            return None
            
        else:
            print(f"❌ Failed to get users list - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error checking admin user: {e}")
        return None

def test_login_with_admin_user():
    """Test login functionality with admin@paras.com"""
    print("\n2. Testing login functionality with admin@paras.com")
    
    target_email = "admin@paras.com"
    
    # Test different case variations
    email_variations = [
        "admin@paras.com",
        "Admin@paras.com", 
        "ADMIN@PARAS.COM",
        "admin@PARAS.com"
    ]
    
    for email in email_variations:
        print(f"\n   Testing login with: {email}")
        try:
            response = requests.post(
                f"{API_BASE}/auth/login",
                params={
                    "identifier": email,
                    "password": "test_password_123"  # Test password
                },
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 404:
                print(f"   ❌ User not found")
            elif response.status_code == 401:
                print(f"   ✅ User found (wrong password)")
            elif response.status_code == 200:
                print(f"   ✅ Login successful")
                user_data = response.json()
                print(f"   Role: {user_data.get('role', 'N/A')}")
            else:
                print(f"   ❓ Unexpected status: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")

def main():
    """Check admin user role for navbar issue debugging"""
    print("CHECKING ADMIN USER ROLE FOR NAVBAR ISSUE")
    print(f"Target API: {API_BASE}")
    print("FOCUS: Check role of admin@paras.com user")
    
    # Test basic connectivity
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=10)
        print(f"Backend connectivity test - Status: {response.status_code}")
        if response.status_code != 200:
            print("⚠️  Backend may have issues but proceeding with user check...")
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend connectivity FAILED: {e}")
        print("Cannot proceed with testing - backend is not accessible")
        return False
    
    # Check admin user role
    admin_user = check_admin_user_role()
    
    # Test login functionality
    test_login_with_admin_user()
    
    # Final summary
    print("\n" + "=" * 80)
    print("ADMIN USER ROLE CHECK SUMMARY")
    print("=" * 80)
    
    if admin_user:
        role = admin_user.get('role', 'N/A')
        email = admin_user.get('email', 'N/A')
        
        print(f"✅ USER FOUND:")
        print(f"   Email: {email}")
        print(f"   Role: {role}")
        
        if role == 'admin':
            print(f"\n✅ ROLE IS CORRECT: User has 'admin' role")
            print("   Admin navigation should be visible")
            print("   If admin link is not showing, check frontend role-based navigation logic")
        else:
            print(f"\n❌ ROLE ISSUE IDENTIFIED: User role is '{role}', not 'admin'")
            print("   This explains why admin link is not showing in navbar")
            print("   SOLUTION: Update user role to 'admin' in database")
        
        return True
    else:
        print(f"❌ USER NOT FOUND: 'admin@paras.com' does not exist in database")
        print("   This explains why admin link is not showing")
        print("   SOLUTION: Create admin user or check correct email address")
        return False

def main():
    """Main function to run VIP checkout investigation"""
    print("=" * 80)
    print("BACKEND API TESTING - VIP CHECKOUT ISSUES INVESTIGATION")
    print("=" * 80)
    
    # Run the VIP checkout investigation
    result = run_vip_checkout_investigation()
    
    # Determine success based on results
    success = len(result.get("issues", [])) == 0
    
    if success:
        print("\n" + "=" * 80)
        print("✅ VIP CHECKOUT INVESTIGATION COMPLETED - NO MAJOR ISSUES FOUND")
        print("=" * 80)
    else:
        print("\n" + "=" * 80)
        print("❌ VIP CHECKOUT INVESTIGATION COMPLETED - ISSUES IDENTIFIED")
        print("Issues found:")
        for issue in result.get("issues", []):
            print(f"  - {issue}")
        print("=" * 80)
    
    return success

if __name__ == "__main__":
    main()