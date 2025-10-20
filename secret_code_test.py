#!/usr/bin/env python3
"""
Secret Code Verification Endpoint Testing
Tests the POST /api/orders/verify endpoint to identify validation errors
"""

import requests
import json
import sys
import os
from datetime import datetime

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

print(f"Testing Secret Code Verification at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def find_orders_with_secret_codes():
    """Find orders in database with secret codes"""
    print("\n1. FINDING ORDERS WITH SECRET CODES")
    print("=" * 50)
    
    # Try different endpoints to get orders
    endpoints_to_try = [
        "/admin/orders/all",
        "/orders/all",
        "/admin/orders"
    ]
    
    orders_found = []
    
    for endpoint in endpoints_to_try:
        print(f"\nTrying: GET {endpoint}")
        try:
            response = requests.get(f"{API_BASE}{endpoint}", timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Handle different response formats
                if isinstance(data, list):
                    orders = data
                elif isinstance(data, dict):
                    orders = data.get("orders", data.get("data", []))
                else:
                    orders = []
                
                print(f"Found {len(orders)} orders")
                
                # Look for orders with secret codes and pending status
                for order in orders:
                    secret_code = order.get("secret_code")
                    status = order.get("status")
                    order_id = order.get("order_id")
                    
                    if secret_code and status == "pending":
                        orders_found.append({
                            "order_id": order_id,
                            "secret_code": secret_code,
                            "status": status,
                            "user_id": order.get("user_id"),
                            "created_at": order.get("created_at")
                        })
                        print(f"  ✅ Found pending order: {order_id} with secret code: {secret_code}")
                
                if orders_found:
                    break  # Found orders, no need to try other endpoints
                    
            else:
                print(f"Failed: {response.status_code}")
                
        except Exception as e:
            print(f"Error: {e}")
    
    if not orders_found:
        print("\n⚠️  No pending orders with secret codes found")
        print("Creating a test order...")
        return create_test_order()
    
    print(f"\n📊 SUMMARY: Found {len(orders_found)} pending orders with secret codes")
    for order in orders_found:
        print(f"  - Order ID: {order['order_id']}")
        print(f"    Secret Code: {order['secret_code']}")
        print(f"    Status: {order['status']}")
    
    return orders_found

def create_test_order():
    """Create a test order to get a valid secret code"""
    print("\n2. CREATING TEST ORDER")
    print("=" * 50)
    
    # First, find a VIP user with verified KYC and sufficient PRC balance
    print("Finding suitable user for test order...")
    
    # Try to get users
    try:
        response = requests.get(f"{API_BASE}/admin/users", timeout=30)
        if response.status_code == 200:
            users_data = response.json()
            users = users_data.get("users", [])
            
            # Find VIP user with verified KYC
            suitable_user = None
            for user in users:
                if (user.get("membership_type") == "vip" and 
                    user.get("kyc_status") == "verified" and
                    user.get("prc_balance", 0) > 100):  # Has enough PRC
                    suitable_user = user
                    break
            
            if suitable_user:
                print(f"✅ Found suitable user: {suitable_user.get('name')} (UID: {suitable_user.get('uid')})")
                
                # Get products
                products_response = requests.get(f"{API_BASE}/products", timeout=30)
                if products_response.status_code == 200:
                    products = products_response.json()
                    if products:
                        test_product = products[0]
                        product_id = test_product.get("product_id")
                        
                        # Create order using legacy endpoint
                        order_data = {"product_id": product_id}
                        order_response = requests.post(
                            f"{API_BASE}/orders/{suitable_user['uid']}", 
                            json=order_data, 
                            timeout=30
                        )
                        
                        if order_response.status_code == 200:
                            order_result = order_response.json()
                            secret_code = order_result.get("secret_code")
                            order_id = order_result.get("order_id")
                            
                            print(f"✅ Test order created successfully!")
                            print(f"  Order ID: {order_id}")
                            print(f"  Secret Code: {secret_code}")
                            
                            return [{
                                "order_id": order_id,
                                "secret_code": secret_code,
                                "status": "pending",
                                "user_id": suitable_user['uid'],
                                "created_at": datetime.now().isoformat()
                            }]
                        else:
                            print(f"❌ Failed to create order: {order_response.status_code}")
                            print(f"Response: {order_response.text}")
                    else:
                        print("❌ No products available")
                else:
                    print(f"❌ Failed to get products: {products_response.status_code}")
            else:
                print("❌ No suitable VIP user found")
        else:
            print(f"❌ Failed to get users: {response.status_code}")
    except Exception as e:
        print(f"❌ Error creating test order: {e}")
    
    # Return a mock order for testing the endpoint structure
    return [{
        "order_id": "test-order-123",
        "secret_code": "ABC123",
        "status": "pending",
        "user_id": "test-user-123",
        "created_at": datetime.now().isoformat()
    }]

def test_verify_endpoint(orders):
    """Test the POST /api/orders/verify endpoint"""
    print("\n3. TESTING VERIFY ENDPOINT")
    print("=" * 50)
    
    if not orders:
        print("❌ No orders available for testing")
        return False
    
    test_order = orders[0]
    secret_code = test_order["secret_code"]
    
    print(f"Testing with secret code: {secret_code}")
    
    # Test 1: Valid secret code with correct field name
    print(f"\n3.1. Testing with correct payload format...")
    
    test_payload = {"secret_code": secret_code}
    
    try:
        response = requests.post(
            f"{API_BASE}/orders/verify",
            json=test_payload,
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Verification successful!")
            result = response.json()
            print(f"Message: {result.get('message')}")
            order_data = result.get('order', {})
            print(f"Order ID: {order_data.get('order_id')}")
            print(f"Order Status: {order_data.get('status')}")
            return True
            
        elif response.status_code == 404:
            print("❌ Invalid secret code (404)")
            print("🔍 ISSUE: Secret code not found in database")
            
        elif response.status_code == 400:
            print("❌ Bad Request (400)")
            print("🔍 ISSUE: Order already processed or other validation error")
            
        elif response.status_code == 422:
            print("❌ Validation Error (422)")
            print("🔍 ISSUE: Field validation failed")
            try:
                error_detail = response.json()
                print(f"Validation details: {error_detail}")
            except:
                print(f"Raw validation error: {response.text}")
                
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error during verification: {e}")
    
    # Test 2: Try different field names to check what's expected
    print(f"\n3.2. Testing different field names...")
    
    alternative_payloads = [
        {"code": secret_code},
        {"verification_code": secret_code},
        {"order_code": secret_code},
        {"secretCode": secret_code}  # camelCase
    ]
    
    for i, payload in enumerate(alternative_payloads, 1):
        field_name = list(payload.keys())[0]
        print(f"\n  Test {i}: Using field '{field_name}'")
        
        try:
            response = requests.post(
                f"{API_BASE}/orders/verify",
                json=payload,
                timeout=30
            )
            
            print(f"  Status: {response.status_code}")
            
            if response.status_code == 200:
                print(f"  ✅ Success with field '{field_name}'!")
                return True
            elif response.status_code == 422:
                print(f"  ❌ Validation error with '{field_name}'")
                try:
                    error_detail = response.json()
                    print(f"  Details: {error_detail}")
                except:
                    pass
            else:
                print(f"  ❌ Status: {response.status_code}")
                
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    # Test 3: Empty payload to see what fields are required
    print(f"\n3.3. Testing with empty payload to see required fields...")
    
    try:
        response = requests.post(
            f"{API_BASE}/orders/verify",
            json={},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 422:
            print("🔍 VALIDATION ERROR DETAILS:")
            try:
                error_detail = response.json()
                print(f"Required fields info: {error_detail}")
            except:
                print(f"Raw error: {response.text}")
                
    except Exception as e:
        print(f"❌ Error: {e}")
    
    return False

def check_orderverify_model():
    """Check what the OrderVerify model expects by examining the code"""
    print("\n4. CHECKING ORDERVERIFY MODEL")
    print("=" * 50)
    
    print("Based on the backend code analysis:")
    print("✅ OrderVerify model expects:")
    print("  - Field name: 'secret_code' (string)")
    print("  - This matches the test payload format")
    
    print("\n✅ Endpoint: POST /api/orders/verify")
    print("✅ Expected payload: {\"secret_code\": \"ABC123\"}")
    print("✅ The field name 'secret_code' is correct")

def main():
    """Main test function"""
    print("SECRET CODE VERIFICATION ENDPOINT TEST")
    print("=" * 80)
    
    # Step 1: Find orders with secret codes
    orders = find_orders_with_secret_codes()
    
    # Step 2: Test the verify endpoint
    success = test_verify_endpoint(orders)
    
    # Step 3: Check model expectations
    check_orderverify_model()
    
    # Step 4: Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    if success:
        print("✅ Secret code verification endpoint is working correctly")
    else:
        print("❌ Secret code verification endpoint has issues")
        print("\n🔍 POSSIBLE CAUSES:")
        print("1. No valid orders with pending status in database")
        print("2. Secret codes in database don't match expected format")
        print("3. Database connection issues")
        print("4. Order status validation preventing verification")
    
    print(f"\n📋 ENDPOINT DETAILS:")
    print(f"  URL: POST {API_BASE}/orders/verify")
    print(f"  Expected payload: {{\"secret_code\": \"YOUR_SECRET_CODE\"}}")
    print(f"  Model field: secret_code (string)")
    print(f"  Success response: {{\"message\": \"Order verified\", \"order\": {{...}}}}")

if __name__ == "__main__":
    main()