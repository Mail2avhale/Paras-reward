#!/usr/bin/env python3
"""
DEBUG WALLET ENDPOINT - CASHBACK FIELD PRIORITY ISSUE

This test specifically debugs the wallet endpoint to understand why it's not 
showing the correct cashback balance from cashback_wallet_balance field.
"""

import requests
import json
import sys
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
API_BASE = f"{BACKEND_URL}/api"

print(f"🔍 DEBUG WALLET ENDPOINT - CASHBACK FIELD PRIORITY")
print(f"Backend URL: {BACKEND_URL}")
print("=" * 60)

def debug_wallet_endpoint():
    """Debug the wallet endpoint cashback field priority issue"""
    
    # Create test user with explicit cashback_wallet_balance
    timestamp = int(time.time())
    
    test_user_data = {
        "first_name": "Debug",
        "last_name": "WalletTest",
        "email": f"debug_wallet_{timestamp}@test.com",
        "mobile": f"9876543{timestamp % 1000:03d}",
        "password": "secure123456",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{timestamp % 100000000:08d}",
        "pan_number": f"DEBUG{timestamp % 10000:04d}T",
        "membership_type": "vip",
        "kyc_status": "verified",
        "prc_balance": 50.0,
        "cashback_wallet_balance": 5.4  # This should be returned by wallet endpoint
    }
    
    print(f"\n📋 Creating test user with cashback_wallet_balance: ₹5.4")
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=test_user_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_uid = result.get("uid")
            print(f"✅ Test user created: {test_uid}")
        else:
            print(f"❌ User creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        return
    
    # Get user data directly to see what was actually stored
    print(f"\n📋 Getting user data directly to check stored values...")
    
    try:
        response = requests.get(f"{API_BASE}/users/{test_uid}", timeout=30)
        if response.status_code == 200:
            user_data = response.json()
            print(f"✅ User data retrieved")
            print(f"   📋 cashback_wallet_balance: {user_data.get('cashback_wallet_balance', 'NOT SET')}")
            print(f"   📋 cashback_balance: {user_data.get('cashback_balance', 'NOT SET')}")
            print(f"   📋 cash_wallet_balance: {user_data.get('cash_wallet_balance', 'NOT SET')}")
            print(f"   📋 prc_balance: {user_data.get('prc_balance', 'NOT SET')}")
        else:
            print(f"❌ Failed to get user data: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error getting user data: {e}")
    
    # Test wallet endpoint
    print(f"\n📋 Testing wallet endpoint...")
    
    try:
        response = requests.get(f"{API_BASE}/wallet/{test_uid}", timeout=30)
        if response.status_code == 200:
            wallet_data = response.json()
            print(f"✅ Wallet endpoint response:")
            print(f"   📋 cashback_balance: ₹{wallet_data.get('cashback_balance', 'NOT SET')}")
            print(f"   📋 profit_balance: ₹{wallet_data.get('profit_balance', 'NOT SET')}")
            print(f"   📋 prc_balance: {wallet_data.get('prc_balance', 'NOT SET')}")
            print(f"   📋 wallet_status: {wallet_data.get('wallet_status', 'NOT SET')}")
            
            # Check if the expected value is returned
            expected_cashback = 5.4
            actual_cashback = wallet_data.get('cashback_balance', 0)
            
            if abs(actual_cashback - expected_cashback) < 0.01:
                print(f"✅ WALLET ENDPOINT WORKING: Correct cashback balance returned")
            else:
                print(f"❌ WALLET ENDPOINT ISSUE: Expected ₹{expected_cashback}, got ₹{actual_cashback}")
                
        else:
            print(f"❌ Wallet endpoint failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing wallet endpoint: {e}")
    
    # Test with manual cashback credit to see if that works
    print(f"\n📋 Testing manual cashback credit...")
    
    try:
        credit_data = {
            "amount": 2.5,
            "description": "Manual test credit"
        }
        response = requests.post(f"{API_BASE}/wallet/credit-cashback/{test_uid}", json=credit_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Manual credit successful")
            print(f"   📋 New balance: ₹{result.get('new_balance', 'NOT SET')}")
            
            # Check wallet endpoint again
            response = requests.get(f"{API_BASE}/wallet/{test_uid}", timeout=30)
            if response.status_code == 200:
                wallet_data = response.json()
                print(f"✅ Wallet after manual credit:")
                print(f"   📋 cashback_balance: ₹{wallet_data.get('cashback_balance', 'NOT SET')}")
            
        else:
            print(f"❌ Manual credit failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error with manual credit: {e}")

if __name__ == "__main__":
    debug_wallet_endpoint()