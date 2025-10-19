#!/usr/bin/env python3
"""
Simple Delivery Charge Distribution Test
Tests the core distribution functionality by mocking an order scenario
"""

import requests
import json
import sys
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

print(f"Testing Delivery Charge Distribution at: {API_BASE}")
print("=" * 80)

def test_delivery_config_endpoints():
    """Test delivery configuration management"""
    print("\n1. Testing Delivery Configuration Endpoints...")
    
    # Test GET delivery config
    print("\n1a. GET /api/admin/delivery-config")
    try:
        response = requests.get(f"{API_BASE}/admin/delivery-config", timeout=30)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            config = response.json()
            print(f"✅ Config retrieved: {json.dumps(config, indent=2)}")
            return True
        else:
            print(f"❌ Failed to get config: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_delivery_config_validation():
    """Test delivery configuration validation"""
    print("\n2. Testing Delivery Configuration Validation...")
    
    # Test valid config
    print("\n2a. Testing valid configuration...")
    valid_config = {
        "delivery_charge_rate": 0.15,  # 15%
        "distribution_split": {
            "master": 15,
            "sub": 25,
            "outlet": 50,
            "company": 10
        }
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/delivery-config", 
                               json=valid_config, timeout=30)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Valid config accepted")
        else:
            print(f"❌ Valid config rejected: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test invalid config (total != 100)
    print("\n2b. Testing invalid configuration (total != 100)...")
    invalid_config = {
        "delivery_charge_rate": 0.10,
        "distribution_split": {
            "master": 15,
            "sub": 25,
            "outlet": 50,
            "company": 5  # Total = 95, not 100
        }
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/delivery-config", 
                               json=invalid_config, timeout=30)
        print(f"Status: {response.status_code}")
        if response.status_code == 400:
            print("✅ Invalid config properly rejected")
        else:
            print(f"❌ Invalid config not rejected: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test invalid rate
    print("\n2c. Testing invalid rate (> 1.0)...")
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
        response = requests.post(f"{API_BASE}/admin/delivery-config", 
                               json=invalid_rate_config, timeout=30)
        print(f"Status: {response.status_code}")
        if response.status_code == 400:
            print("✅ Invalid rate properly rejected")
        else:
            print(f"❌ Invalid rate not rejected: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_distribution_endpoint_directly():
    """Test the distribution endpoint with a mock order ID"""
    print("\n3. Testing Distribution Endpoint Behavior...")
    
    # Test with non-existent order
    print("\n3a. Testing with non-existent order...")
    fake_order_id = "fake-order-id-12345"
    
    try:
        response = requests.post(f"{API_BASE}/orders/{fake_order_id}/distribute-delivery-charge", 
                               timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 404:
            print("✅ Non-existent order properly handled")
        else:
            print(f"❌ Unexpected response for non-existent order")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_admin_endpoints():
    """Test admin-related endpoints"""
    print("\n4. Testing Admin Endpoints...")
    
    # Test admin stats
    print("\n4a. Testing admin stats...")
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=30)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Admin stats: {json.dumps(stats, indent=2)}")
        else:
            print(f"❌ Failed to get admin stats: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Run all delivery charge tests"""
    print("DELIVERY CHARGE AUTO-DISTRIBUTION CORE FUNCTIONALITY TESTING")
    print("=" * 80)
    
    # Test basic connectivity
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=10)
        print(f"✅ Backend connectivity: {response.status_code}")
    except Exception as e:
        print(f"❌ Backend connectivity failed: {e}")
        return False
    
    # Run tests
    test_delivery_config_endpoints()
    test_delivery_config_validation()
    test_distribution_endpoint_directly()
    test_admin_endpoints()
    
    print("\n" + "=" * 80)
    print("DELIVERY CHARGE CORE FUNCTIONALITY TESTING COMPLETED")
    print("=" * 80)
    
    return True

if __name__ == "__main__":
    main()