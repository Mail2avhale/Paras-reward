#!/usr/bin/env python3
"""
Test to verify that the order status is properly updated after verification
"""

import requests
import json

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
API_BASE = f"{BACKEND_URL}/api"

print("TESTING ORDER STATUS UPDATE AFTER VERIFICATION")
print("=" * 60)

# Test with a different secret code
secret_code = "PRC-JJ4OCIJB"  # Different from the one we used before

print(f"\n1. Testing verification with secret code: {secret_code}")
payload = {"secret_code": secret_code}
response = requests.post(f"{API_BASE}/orders/verify", json=payload, timeout=30)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    result = response.json()
    print(f"✅ Verification successful!")
    print(f"Message: {result.get('message')}")
    
    order_data = result.get('order', {})
    order_id = order_data.get('order_id')
    status_in_response = order_data.get('status')
    
    print(f"Order ID: {order_id}")
    print(f"Status in response: {status_in_response}")
    
    # Now check if the order was actually updated in the database
    print(f"\n2. Checking order status in database...")
    
    # Get all orders to see the updated status
    orders_response = requests.get(f"{API_BASE}/admin/orders/all", timeout=30)
    if orders_response.status_code == 200:
        orders_data = orders_response.json()
        orders = orders_data.get("orders", [])
        
        # Find our order
        for order in orders:
            if order.get("order_id") == order_id:
                db_status = order.get("status")
                print(f"✅ Found order in database")
                print(f"Status in database: {db_status}")
                
                if db_status == "verified":
                    print("✅ Order status correctly updated to 'verified'")
                elif db_status == "pending":
                    print("❌ Order status still 'pending' - update may have failed")
                else:
                    print(f"⚠️  Order status is '{db_status}' - unexpected value")
                break
        else:
            print("❌ Order not found in database")
    else:
        print(f"❌ Failed to get orders from database: {orders_response.status_code}")

elif response.status_code == 400:
    print("⚠️  Order already processed (expected if we used this secret code before)")
    print(f"Response: {response.text}")
elif response.status_code == 404:
    print("❌ Invalid secret code")
    print(f"Response: {response.text}")
else:
    print(f"❌ Unexpected status: {response.status_code}")
    print(f"Response: {response.text}")

print(f"\n3. Testing with already verified order...")
# Try to verify the same order again
response2 = requests.post(f"{API_BASE}/orders/verify", json=payload, timeout=30)
print(f"Status: {response2.status_code}")
print(f"Response: {response2.text}")

if response2.status_code == 400:
    print("✅ Correctly rejected already processed order")
else:
    print("⚠️  Unexpected behavior for already processed order")