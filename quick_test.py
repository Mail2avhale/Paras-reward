#!/usr/bin/env python3
"""
Quick test for delivery charge auto-distribution functionality
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

print(f"Testing backend at: {API_BASE}")

# Test 1: Check order endpoint
print("\n1. Testing order endpoint...")
order_id = "983b0d43-e368-40f0-bbbd-616048c51609"
response = requests.get(f"{API_BASE}/orders/{order_id}", timeout=30)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    order = response.json()
    print(f"✅ Order found: {order.get('order_id')}")
    print(f"Delivery charge: {order.get('delivery_charge')}")
    print(f"Distribution amounts: {order.get('distribution_amounts')}")
    print(f"Distributed: {order.get('delivery_charge_distributed')}")
else:
    print(f"❌ Order not found: {response.text}")

# Test 2: Check delivery config
print("\n2. Testing delivery config...")
response = requests.get(f"{API_BASE}/admin/delivery-config", timeout=30)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    config = response.json()
    print(f"✅ Config found:")
    print(f"Rate: {config.get('delivery_charge_rate')}")
    print(f"Split: {config.get('distribution_split')}")
else:
    print(f"❌ Config not found: {response.text}")

# Test 3: Test idempotent distribution
print("\n3. Testing idempotent distribution...")
response = requests.post(f"{API_BASE}/orders/{order_id}/distribute-delivery-charge", timeout=30)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

print("\n✅ Quick test completed!")