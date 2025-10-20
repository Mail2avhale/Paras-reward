#!/usr/bin/env python3
"""
Test to confirm the routing issue with /orders/verify endpoint
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

print("TESTING ROUTING ISSUE")
print("=" * 50)

# Test 1: Confirm that /orders/verify is being treated as /orders/{uid}
print("\n1. Testing /orders/verify with secret_code payload (should fail with product_id required)")
payload = {"secret_code": "PRC-LJ1DUT5I"}
response = requests.post(f"{API_BASE}/orders/verify", json=payload, timeout=30)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# Test 2: Test what happens if we provide product_id (should treat 'verify' as UID)
print("\n2. Testing /orders/verify with product_id payload (should treat 'verify' as UID)")
payload_with_product = {"product_id": "test-product-123"}
response2 = requests.post(f"{API_BASE}/orders/verify", json=payload_with_product, timeout=30)
print(f"Status: {response2.status_code}")
print(f"Response: {response2.text}")

print("\n🔍 ANALYSIS:")
print("The /orders/verify endpoint is being matched by /orders/{uid} pattern")
print("FastAPI treats 'verify' as a UID parameter, not as a separate endpoint")
print("This is why it expects 'product_id' field (from OrderCreate model)")
print("The actual verify endpoint with OrderVerify model is never reached")

print("\n🔧 SOLUTION:")
print("Move the /orders/verify endpoint definition BEFORE /orders/{uid} in server.py")
print("Or change the endpoint path to avoid the conflict")