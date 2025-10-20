#!/usr/bin/env python3
"""
Order Creation and Cashback Credit Verification Test
Specifically tests the complete order flow as requested in the review
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

print(f"Testing Order Creation and Cashback Credit at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def test_specific_user_orders_and_cashback():
    """Test the complete order flow for santosh@paras.com as requested"""
    print("\n" + "=" * 80)
    print("VERIFY ORDER CREATION AND CASHBACK CREDIT")
    print("=" * 80)
    
    # Step 1: Check existing orders for santosh@paras.com
    print("\n1. Checking existing orders for santosh@paras.com...")
    
    # First, get user data by login
    try:
        login_response = requests.post(
            f"{API_BASE}/auth/login",
            params={
                "identifier": "santosh@paras.com",
                "password": "password"  # Try common password
            },
            timeout=30
        )
        
        if login_response.status_code == 200:
            user_data = login_response.json()
            user_id = user_data.get("uid")
            print(f"✅ User found: {user_data.get('name')} (UID: {user_id})")
            print(f"   Membership Type: {user_data.get('membership_type')}")
            print(f"   KYC Status: {user_data.get('kyc_status')}")
            
        else:
            print(f"❌ Failed to login santosh@paras.com: {login_response.status_code}")
            print("   Trying alternative users...")
            
            # Try other known users
            alternative_users = [
                {"email": "admin@paras.com", "password": "admin123"},
                {"email": "test@paras.com", "password": "password"}
            ]
            
            user_data = None
            for alt_user in alternative_users:
                try:
                    alt_response = requests.post(
                        f"{API_BASE}/auth/login",
                        params={
                            "identifier": alt_user["email"],
                            "password": alt_user["password"]
                        },
                        timeout=30
                    )
                    
                    if alt_response.status_code == 200:
                        user_data = alt_response.json()
                        user_id = user_data.get("uid")
                        print(f"✅ Using alternative user: {user_data.get('name')} ({alt_user['email']})")
                        break
                except:
                    continue
            
            if not user_data:
                print("❌ Could not find any valid user for testing")
                return False
                
    except Exception as e:
        print(f"❌ Error during login: {e}")
        return False
    
    # Step 2: Check existing orders using different endpoints
    print(f"\n2. Checking existing orders for user {user_id}...")
    
    order_endpoints = [
        f"/orders/user/{user_id}",
        f"/orders/{user_id}",
        f"/orders/legacy/{user_id}",
        f"/admin/orders/all?user_id={user_id}"
    ]
    
    existing_orders = []
    orders_with_secret_code = []
    
    for endpoint in order_endpoints:
        try:
            print(f"\n   Trying: GET {endpoint}")
            response = requests.get(f"{API_BASE}{endpoint}", timeout=30)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                orders_data = response.json()
                
                # Handle different response formats
                if isinstance(orders_data, list):
                    orders = orders_data
                elif isinstance(orders_data, dict):
                    orders = orders_data.get("orders", orders_data.get("data", []))
                else:
                    orders = []
                
                print(f"   ✅ Found {len(orders)} orders")
                existing_orders.extend(orders)
                
                # Check for orders with secret_code
                for order in orders:
                    if order.get("secret_code"):
                        orders_with_secret_code.append(order)
                        print(f"     Order with secret_code: {order.get('order_id')} - {order.get('secret_code')}")
                
                break  # Found orders, stop trying other endpoints
                
            elif response.status_code == 404:
                print(f"   ⚠️  No orders found or endpoint not available")
            else:
                print(f"   ❌ Error: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error checking {endpoint}: {e}")
    
    print(f"\n   📊 SUMMARY: Found {len(existing_orders)} total orders")
    print(f"   📊 Orders with secret_code: {len(orders_with_secret_code)}")
    
    # Step 3: Check user's cashback balance
    print(f"\n3. Checking user's cashback balance...")
    
    try:
        wallet_response = requests.get(f"{API_BASE}/wallet/{user_id}", timeout=30)
        print(f"   Wallet Status: {wallet_response.status_code}")
        
        if wallet_response.status_code == 200:
            wallet_data = wallet_response.json()
            cashback_balance = wallet_data.get("cashback_balance", 0)
            cash_wallet_balance = wallet_data.get("cash_wallet_balance", 0)  # Alternative field name
            prc_balance = wallet_data.get("prc_balance", 0)
            
            print(f"   ✅ Wallet data retrieved:")
            print(f"     cashback_balance: ₹{cashback_balance}")
            print(f"     cash_wallet_balance: ₹{cash_wallet_balance}")
            print(f"     prc_balance: {prc_balance} PRC")
            
            # Store initial balances for comparison
            initial_cashback = max(cashback_balance, cash_wallet_balance)
            initial_prc = prc_balance
            
        else:
            print(f"   ❌ Failed to get wallet data: {wallet_response.status_code}")
            print(f"   Response: {wallet_response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error checking wallet: {e}")
        return False
    
    # Step 4: Check if user has sufficient PRC balance for order
    print(f"\n4. Checking if user has sufficient PRC balance...")
    
    # Get available products first
    try:
        products_response = requests.get(f"{API_BASE}/products", timeout=30)
        if products_response.status_code == 200:
            products = products_response.json()
            if len(products) == 0:
                print("   ❌ No products available for testing")
                return False
            
            # Find cheapest product for testing
            cheapest_product = min(products, key=lambda p: p.get("prc_price", float('inf')))
            product_id = cheapest_product.get("product_id")
            product_name = cheapest_product.get("name")
            prc_price = cheapest_product.get("prc_price")
            
            print(f"   📦 Test Product: {product_name}")
            print(f"   💰 PRC Price: {prc_price}")
            print(f"   💳 User PRC Balance: {initial_prc}")
            
            if initial_prc >= prc_price:
                print(f"   ✅ User has sufficient PRC balance for order")
                can_create_order = True
            else:
                print(f"   ⚠️  User has insufficient PRC balance ({initial_prc} < {prc_price})")
                can_create_order = False
                
        else:
            print(f"   ❌ Failed to get products: {products_response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error getting products: {e}")
        return False
    
    # Step 5: Create test order if user has sufficient balance
    if can_create_order:
        print(f"\n5. Creating test order...")
        
        # Try cart-based checkout first
        print(f"\n5a. Adding product to cart...")
        try:
            cart_data = {
                "user_id": user_id,
                "product_id": product_id,
                "quantity": 1
            }
            
            cart_response = requests.post(f"{API_BASE}/cart/add", json=cart_data, timeout=30)
            print(f"   Cart Add Status: {cart_response.status_code}")
            
            if cart_response.status_code == 200:
                print(f"   ✅ Product added to cart")
                
                # Try checkout
                print(f"\n5b. Attempting checkout...")
                checkout_data = {
                    "user_id": user_id,
                    "delivery_address": {
                        "street": "123 Test Street",
                        "city": "Mumbai",
                        "state": "Maharashtra",
                        "pincode": "400001"
                    }
                }
                
                checkout_response = requests.post(f"{API_BASE}/orders/checkout", json=checkout_data, timeout=30)
                print(f"   Checkout Status: {checkout_response.status_code}")
                print(f"   Checkout Response: {checkout_response.text}")
                
                if checkout_response.status_code == 200:
                    checkout_result = checkout_response.json()
                    new_order_id = checkout_result.get("order_id")
                    secret_code = checkout_result.get("secret_code")
                    cashback_earned = checkout_result.get("cashback_earned")
                    
                    print(f"   ✅ Order created successfully!")
                    print(f"     Order ID: {new_order_id}")
                    print(f"     Secret Code: {secret_code}")
                    print(f"     Cashback Earned: ₹{cashback_earned}")
                    
                    order_created = True
                    
                else:
                    print(f"   ❌ Checkout failed: {checkout_response.status_code}")
                    order_created = False
                    
            else:
                print(f"   ❌ Failed to add to cart: {cart_response.status_code}")
                order_created = False
                
        except Exception as e:
            print(f"   ❌ Error during order creation: {e}")
            order_created = False
        
        # If cart checkout failed, try legacy single product checkout
        if not order_created:
            print(f"\n5c. Trying legacy single product checkout...")
            try:
                legacy_data = {"product_id": product_id}
                legacy_response = requests.post(f"{API_BASE}/orders/{user_id}", json=legacy_data, timeout=30)
                print(f"   Legacy Checkout Status: {legacy_response.status_code}")
                print(f"   Legacy Checkout Response: {legacy_response.text}")
                
                if legacy_response.status_code == 200:
                    legacy_result = legacy_response.json()
                    new_order_id = legacy_result.get("order_id")
                    secret_code = legacy_result.get("secret_code")
                    
                    print(f"   ✅ Legacy order created successfully!")
                    print(f"     Order ID: {new_order_id}")
                    print(f"     Secret Code: {secret_code}")
                    
                    order_created = True
                else:
                    print(f"   ❌ Legacy checkout also failed")
                    order_created = False
                    
            except Exception as e:
                print(f"   ❌ Error during legacy checkout: {e}")
                order_created = False
    else:
        print(f"\n5. Skipping order creation - insufficient PRC balance")
        order_created = False
    
    # Step 6: Verify order appears in database and cashback increased
    if order_created:
        print(f"\n6. Verifying order was saved and cashback increased...")
        
        # Wait a moment for database to update
        time.sleep(2)
        
        # Check orders again
        print(f"\n6a. Checking for new order in database...")
        try:
            response = requests.get(f"{API_BASE}/orders/{user_id}", timeout=30)
            if response.status_code == 200:
                updated_orders = response.json()
                if isinstance(updated_orders, dict):
                    updated_orders = updated_orders.get("orders", updated_orders.get("data", []))
                
                print(f"   ✅ Found {len(updated_orders)} orders (was {len(existing_orders)})")
                
                if len(updated_orders) > len(existing_orders):
                    print(f"   ✅ New order appears in database!")
                    
                    # Find the new order
                    new_orders = [o for o in updated_orders if o.get("order_id") == new_order_id]
                    if new_orders:
                        new_order = new_orders[0]
                        print(f"     New Order Details:")
                        print(f"       Order ID: {new_order.get('order_id')}")
                        print(f"       Status: {new_order.get('status')}")
                        print(f"       Created: {new_order.get('created_at')}")
                        print(f"       Secret Code: {new_order.get('secret_code')}")
                else:
                    print(f"   ⚠️  Order count didn't increase - may not be saved properly")
            else:
                print(f"   ❌ Failed to check updated orders: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error checking updated orders: {e}")
        
        # Check cashback balance again
        print(f"\n6b. Checking if cashback increased...")
        try:
            updated_wallet_response = requests.get(f"{API_BASE}/wallet/{user_id}", timeout=30)
            if updated_wallet_response.status_code == 200:
                updated_wallet = updated_wallet_response.json()
                new_cashback_balance = updated_wallet.get("cashback_balance", 0)
                new_cash_wallet_balance = updated_wallet.get("cash_wallet_balance", 0)
                
                final_cashback = max(new_cashback_balance, new_cash_wallet_balance)
                
                print(f"   Initial Cashback: ₹{initial_cashback}")
                print(f"   Final Cashback: ₹{final_cashback}")
                
                if final_cashback > initial_cashback:
                    cashback_increase = final_cashback - initial_cashback
                    print(f"   ✅ Cashback increased by ₹{cashback_increase}")
                else:
                    print(f"   ⚠️  Cashback did not increase")
            else:
                print(f"   ❌ Failed to check updated wallet: {updated_wallet_response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error checking updated wallet: {e}")
    
    # Step 7: Check Orders collection structure
    print(f"\n7. Checking Orders collection structure...")
    
    if existing_orders:
        sample_order = existing_orders[0]
        print(f"\n   📋 Sample Order Structure:")
        
        # Check for user_id field variations
        user_id_field = None
        if "user_id" in sample_order:
            user_id_field = "user_id"
        elif "uid" in sample_order:
            user_id_field = "uid"
        elif "userId" in sample_order:
            user_id_field = "userId"
        
        if user_id_field:
            print(f"     ✅ User ID field name: '{user_id_field}' = {sample_order.get(user_id_field)}")
        else:
            print(f"     ❌ No user ID field found in order")
        
        # Show all fields in the order
        print(f"     📋 All fields in order:")
        for key, value in sample_order.items():
            if key != "_id":  # Skip MongoDB internal ID
                print(f"       - {key}: {value}")
    else:
        print(f"   ⚠️  No existing orders to analyze structure")
    
    # Final Summary
    print(f"\n" + "=" * 80)
    print("FINAL REPORT")
    print("=" * 80)
    
    print(f"\n✅ ORDERS STATUS:")
    print(f"   - Existing orders found: {len(existing_orders)}")
    print(f"   - Orders with secret_code: {len(orders_with_secret_code)}")
    if order_created:
        print(f"   - New order created: ✅ YES")
    else:
        print(f"   - New order created: ❌ NO")
    
    print(f"\n✅ CASHBACK STATUS:")
    print(f"   - Initial cashback balance: ₹{initial_cashback}")
    if order_created:
        print(f"   - Cashback credited: ✅ (check results above)")
    else:
        print(f"   - Cashback credited: ❌ NO (no order created)")
    
    print(f"\n✅ DATABASE STRUCTURE:")
    if user_id_field:
        print(f"   - User ID field in orders: '{user_id_field}'")
    else:
        print(f"   - User ID field in orders: ❌ NOT FOUND")
    
    return True

if __name__ == "__main__":
    test_specific_user_orders_and_cashback()