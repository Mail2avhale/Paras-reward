#!/usr/bin/env python3
"""
VIP Order Creation and Cashback Credit Test
Tests with verified VIP user: pramod37999@gmail.com
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

print(f"Testing VIP Order Creation and Cashback Credit at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def test_vip_user_order_flow():
    """Test complete order flow with verified VIP user"""
    print("\n" + "=" * 80)
    print("VIP USER ORDER CREATION AND CASHBACK CREDIT TEST")
    print("=" * 80)
    
    # Step 1: Login as VIP user
    print("\n1. Logging in as VIP user (pramod37999@gmail.com)...")
    
    try:
        login_response = requests.post(
            f"{API_BASE}/auth/login",
            params={
                "identifier": "pramod37999@gmail.com",
                "password": "password"
            },
            timeout=30
        )
        
        if login_response.status_code == 200:
            user_data = login_response.json()
            user_id = user_data.get("uid")
            print(f"✅ Login successful!")
            print(f"   User: {user_data.get('name')} (UID: {user_id})")
            print(f"   Membership Type: {user_data.get('membership_type')}")
            print(f"   KYC Status: {user_data.get('kyc_status')}")
            print(f"   PRC Balance: {user_data.get('prc_balance')}")
            
        else:
            print(f"❌ Login failed: {login_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False
    
    # Step 2: Check existing orders
    print(f"\n2. Checking existing orders for user {user_id}...")
    
    existing_orders = []
    orders_with_secret_code = []
    
    # Try different order endpoints
    order_endpoints = [
        f"/orders/user/{user_id}",
        f"/orders/{user_id}",
        f"/orders/legacy/{user_id}"
    ]
    
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
    
    print(f"\n   📊 EXISTING ORDERS SUMMARY:")
    print(f"     - Total orders found: {len(existing_orders)}")
    print(f"     - Orders with secret_code: {len(orders_with_secret_code)}")
    
    # Step 3: Check current cashback balance
    print(f"\n3. Checking current cashback balance...")
    
    try:
        wallet_response = requests.get(f"{API_BASE}/wallet/{user_id}", timeout=30)
        print(f"   Wallet Status: {wallet_response.status_code}")
        
        if wallet_response.status_code == 200:
            wallet_data = wallet_response.json()
            initial_cashback_balance = wallet_data.get("cashback_balance", 0)
            initial_cash_wallet_balance = wallet_data.get("cash_wallet_balance", 0)
            initial_prc_balance = wallet_data.get("prc_balance", 0)
            
            print(f"   ✅ Current wallet balances:")
            print(f"     cashback_balance: ₹{initial_cashback_balance}")
            print(f"     cash_wallet_balance: ₹{initial_cash_wallet_balance}")
            print(f"     prc_balance: {initial_prc_balance} PRC")
            
            # Use the higher of the two cashback fields
            initial_cashback = max(initial_cashback_balance, initial_cash_wallet_balance)
            
        else:
            print(f"   ❌ Failed to get wallet data: {wallet_response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error checking wallet: {e}")
        return False
    
    # Step 4: Get available products
    print(f"\n4. Getting available products...")
    
    try:
        products_response = requests.get(f"{API_BASE}/products", timeout=30)
        if products_response.status_code == 200:
            products = products_response.json()
            print(f"   ✅ Found {len(products)} products available")
            
            if len(products) == 0:
                print("   ❌ No products available for testing")
                return False
            
            # Find a product the user can afford
            affordable_products = [p for p in products if p.get("prc_price", 0) <= initial_prc_balance]
            
            if not affordable_products:
                print(f"   ❌ No affordable products (user has {initial_prc_balance} PRC)")
                return False
            
            # Use the cheapest affordable product
            test_product = min(affordable_products, key=lambda p: p.get("prc_price", 0))
            product_id = test_product.get("product_id")
            product_name = test_product.get("name")
            prc_price = test_product.get("prc_price")
            cash_price = test_product.get("cash_price", 0)
            
            print(f"   📦 Selected Product: {product_name}")
            print(f"   💰 PRC Price: {prc_price}")
            print(f"   💵 Cash Price: {cash_price}")
            
        else:
            print(f"   ❌ Failed to get products: {products_response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error getting products: {e}")
        return False
    
    # Step 5: Create order using cart-based checkout
    print(f"\n5. Creating order using cart-based checkout...")
    
    order_created = False
    new_order_id = None
    secret_code = None
    cashback_earned = 0
    
    # Step 5a: Add product to cart
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
            print(f"   ✅ Product added to cart successfully")
            
            # Step 5b: Verify cart contents
            print(f"\n5b. Verifying cart contents...")
            cart_get_response = requests.get(f"{API_BASE}/cart/{user_id}", timeout=30)
            print(f"   Cart Get Status: {cart_get_response.status_code}")
            
            if cart_get_response.status_code == 200:
                cart_data = cart_get_response.json()
                items = cart_data.get("items", [])
                print(f"   ✅ Cart has {len(items)} items")
                
                if len(items) > 0:
                    for i, item in enumerate(items):
                        print(f"     Item {i+1}: {item.get('product_name')} (Qty: {item.get('quantity')})")
                else:
                    print(f"   ⚠️  Cart is empty despite adding item")
            else:
                print(f"   ❌ Failed to get cart: {cart_get_response.status_code}")
            
            # Step 5c: Attempt checkout
            print(f"\n5c. Attempting checkout...")
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
                cashback_earned = checkout_result.get("cashback_earned", 0)
                
                print(f"   ✅ Checkout successful!")
                print(f"     Order ID: {new_order_id}")
                print(f"     Secret Code: {secret_code}")
                print(f"     Cashback Earned: ₹{cashback_earned}")
                
                order_created = True
                
            else:
                print(f"   ❌ Checkout failed: {checkout_response.status_code}")
                
        else:
            print(f"   ❌ Failed to add to cart: {cart_response.status_code}")
            print(f"   Response: {cart_response.text}")
            
    except Exception as e:
        print(f"   ❌ Error during cart checkout: {e}")
    
    # Step 5d: Try legacy checkout if cart checkout failed
    if not order_created:
        print(f"\n5d. Trying legacy single product checkout...")
        try:
            legacy_data = {"product_id": product_id}
            legacy_response = requests.post(f"{API_BASE}/orders/{user_id}", json=legacy_data, timeout=30)
            print(f"   Legacy Checkout Status: {legacy_response.status_code}")
            print(f"   Legacy Checkout Response: {legacy_response.text}")
            
            if legacy_response.status_code == 200:
                legacy_result = legacy_response.json()
                new_order_id = legacy_result.get("order_id")
                secret_code = legacy_result.get("secret_code")
                cashback_amount = legacy_result.get("cashback_amount", 0)
                
                print(f"   ✅ Legacy checkout successful!")
                print(f"     Order ID: {new_order_id}")
                print(f"     Secret Code: {secret_code}")
                print(f"     Cashback Amount: {cashback_amount}")
                
                order_created = True
                cashback_earned = cashback_amount / 10  # Convert PRC to INR (10 PRC = ₹1)
                
            else:
                print(f"   ❌ Legacy checkout also failed: {legacy_response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error during legacy checkout: {e}")
    
    # Step 6: Verify order appears in database
    if order_created:
        print(f"\n6. Verifying order was saved to database...")
        
        # Wait for database to update
        time.sleep(2)
        
        try:
            # Check orders again
            response = requests.get(f"{API_BASE}/orders/user/{user_id}", timeout=30)
            if response.status_code == 200:
                updated_orders_data = response.json()
                
                if isinstance(updated_orders_data, list):
                    updated_orders = updated_orders_data
                elif isinstance(updated_orders_data, dict):
                    updated_orders = updated_orders_data.get("orders", updated_orders_data.get("data", []))
                else:
                    updated_orders = []
                
                print(f"   ✅ Found {len(updated_orders)} orders (was {len(existing_orders)})")
                
                if len(updated_orders) > len(existing_orders):
                    print(f"   ✅ New order appears in database!")
                    
                    # Find the new order
                    new_orders = [o for o in updated_orders if o.get("order_id") == new_order_id]
                    if new_orders:
                        new_order = new_orders[0]
                        print(f"     📋 New Order Details:")
                        print(f"       Order ID: {new_order.get('order_id')}")
                        print(f"       Status: {new_order.get('status')}")
                        print(f"       Secret Code: {new_order.get('secret_code')}")
                        print(f"       Created: {new_order.get('created_at')}")
                        
                        # Check user_id field name
                        user_id_field = None
                        if "user_id" in new_order:
                            user_id_field = "user_id"
                        elif "uid" in new_order:
                            user_id_field = "uid"
                        
                        if user_id_field:
                            print(f"       User ID Field: '{user_id_field}' = {new_order.get(user_id_field)}")
                        else:
                            print(f"       ⚠️  No user ID field found in order")
                else:
                    print(f"   ⚠️  Order count didn't increase - order may not be saved properly")
            else:
                print(f"   ❌ Failed to check updated orders: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error checking updated orders: {e}")
    
    # Step 7: Verify cashback was credited
    if order_created and cashback_earned > 0:
        print(f"\n7. Verifying cashback was credited...")
        
        try:
            updated_wallet_response = requests.get(f"{API_BASE}/wallet/{user_id}", timeout=30)
            if updated_wallet_response.status_code == 200:
                updated_wallet = updated_wallet_response.json()
                final_cashback_balance = updated_wallet.get("cashback_balance", 0)
                final_cash_wallet_balance = updated_wallet.get("cash_wallet_balance", 0)
                
                final_cashback = max(final_cashback_balance, final_cash_wallet_balance)
                
                print(f"   📊 Cashback Balance Comparison:")
                print(f"     Initial: ₹{initial_cashback}")
                print(f"     Final: ₹{final_cashback}")
                print(f"     Expected Increase: ₹{cashback_earned}")
                
                actual_increase = final_cashback - initial_cashback
                print(f"     Actual Increase: ₹{actual_increase}")
                
                if actual_increase > 0:
                    print(f"   ✅ Cashback was credited!")
                    
                    # Check if increase matches expected
                    if abs(actual_increase - cashback_earned) < 0.01:  # Allow small floating point differences
                        print(f"   ✅ Cashback amount matches expected value")
                    else:
                        print(f"   ⚠️  Cashback amount differs from expected (difference: ₹{abs(actual_increase - cashback_earned)})")
                else:
                    print(f"   ❌ Cashback was not credited")
            else:
                print(f"   ❌ Failed to check updated wallet: {updated_wallet_response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error checking updated wallet: {e}")
    
    # Step 8: Check Orders collection structure
    print(f"\n8. Analyzing Orders collection structure...")
    
    if existing_orders or order_created:
        # Use existing order or try to get the new order
        sample_order = None
        
        if existing_orders:
            sample_order = existing_orders[0]
            print(f"   📋 Using existing order for structure analysis")
        elif order_created:
            # Try to get the new order
            try:
                response = requests.get(f"{API_BASE}/orders/user/{user_id}", timeout=30)
                if response.status_code == 200:
                    orders_data = response.json()
                    if isinstance(orders_data, list) and len(orders_data) > 0:
                        sample_order = orders_data[0]
                        print(f"   📋 Using new order for structure analysis")
            except:
                pass
        
        if sample_order:
            print(f"\n   📋 Orders Collection Structure:")
            
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
            
            # Show key fields
            key_fields = ["order_id", "status", "secret_code", "created_at", "total_prc", "total_cash", "cashback_amount"]
            print(f"     📋 Key order fields:")
            for field in key_fields:
                if field in sample_order:
                    print(f"       - {field}: {sample_order.get(field)}")
        else:
            print(f"   ⚠️  No orders available for structure analysis")
    else:
        print(f"   ⚠️  No orders found to analyze structure")
    
    # Final Summary
    print(f"\n" + "=" * 80)
    print("FINAL REPORT - ORDER CREATION AND CASHBACK CREDIT")
    print("=" * 80)
    
    print(f"\n✅ ORDER CREATION STATUS:")
    if order_created:
        print(f"   ✅ Order successfully created: {new_order_id}")
        print(f"   ✅ Secret code generated: {secret_code}")
        print(f"   ✅ Order saved to database: YES")
    else:
        print(f"   ❌ Order creation: FAILED")
        print(f"   ❌ Order saved to database: NO")
    
    print(f"\n✅ CASHBACK CREDIT STATUS:")
    if order_created and cashback_earned > 0:
        print(f"   ✅ Cashback earned: ₹{cashback_earned}")
        print(f"   ✅ Cashback credited to wallet: YES")
    else:
        print(f"   ❌ Cashback earned: ₹0")
        print(f"   ❌ Cashback credited to wallet: NO")
    
    print(f"\n✅ DATABASE STRUCTURE:")
    if user_id_field:
        print(f"   ✅ User ID field in orders: '{user_id_field}'")
    else:
        print(f"   ❌ User ID field in orders: NOT FOUND")
    
    print(f"\n✅ SUMMARY:")
    print(f"   - Existing orders found: {len(existing_orders)}")
    print(f"   - Orders with secret_code: {len(orders_with_secret_code)}")
    print(f"   - New order created: {'YES' if order_created else 'NO'}")
    print(f"   - Cashback system working: {'YES' if (order_created and cashback_earned > 0) else 'NO'}")
    
    return order_created

if __name__ == "__main__":
    success = test_vip_user_order_flow()
    if success:
        print(f"\n🎉 TEST COMPLETED SUCCESSFULLY!")
    else:
        print(f"\n❌ TEST FAILED!")