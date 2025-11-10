#!/usr/bin/env python3
"""
FIND EXISTING USER WITH CASHBACK BALANCE

This test tries to find an existing user who has actually played scratch cards
and has a real cashback balance, then tests the wallet endpoint fix.
"""

import requests
import json
import sys

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

print(f"🔍 FIND EXISTING USER WITH CASHBACK BALANCE")
print(f"Backend URL: {BACKEND_URL}")
print("=" * 60)

def find_and_test_existing_user():
    """Find existing user with cashback balance and test wallet endpoint"""
    
    # Let's create a user and immediately purchase a scratch card to get real cashback
    import time
    timestamp = int(time.time())
    
    test_user_data = {
        "first_name": "RealTest",
        "last_name": "CashbackUser",
        "email": f"real_test_{timestamp}@test.com",
        "mobile": f"9876543{timestamp % 1000:03d}",
        "password": "secure123456",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{timestamp % 100000000:08d}",
        "pan_number": f"REAL{timestamp % 10000:04d}T",
        "membership_type": "vip",
        "kyc_status": "verified",
        "prc_balance": 50.0
    }
    
    print(f"\n📋 Creating user and purchasing scratch card to get real cashback...")
    
    try:
        # Create user
        response = requests.post(f"{API_BASE}/auth/register", json=test_user_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_uid = result.get("uid")
            print(f"✅ Test user created: {test_uid}")
        else:
            print(f"❌ User creation failed: {response.status_code}")
            return
            
        # Purchase scratch card to get real cashback
        purchase_data = {"card_type": 10}
        response = requests.post(f"{API_BASE}/scratch-cards/purchase?uid={test_uid}", json=purchase_data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            cashback_won = result.get("cashback_won_inr", 0)
            print(f"✅ Scratch card purchased successfully")
            print(f"   📋 Cashback won: ₹{cashback_won}")
            print(f"   📋 New cashback balance: ₹{result.get('new_cashback_wallet', 0)}")
            
            # Now test wallet endpoint
            print(f"\n📋 Testing wallet endpoint after real scratch card purchase...")
            
            response = requests.get(f"{API_BASE}/wallet/{test_uid}", timeout=30)
            if response.status_code == 200:
                wallet_data = response.json()
                returned_cashback = wallet_data.get("cashback_balance", 0)
                
                print(f"✅ Wallet endpoint response:")
                print(f"   📋 cashback_balance: ₹{returned_cashback}")
                print(f"   📋 prc_balance: {wallet_data.get('prc_balance', 0)}")
                
                if abs(returned_cashback - cashback_won) < 0.01:
                    print(f"✅ WALLET FIX VERIFIED: Correct cashback balance returned")
                    print(f"   📋 Expected ₹{cashback_won}, got ₹{returned_cashback}")
                else:
                    print(f"❌ WALLET FIX FAILED: Expected ₹{cashback_won}, got ₹{returned_cashback}")
                    
                # Test scratch card history
                print(f"\n📋 Testing scratch card history endpoint...")
                
                response = requests.get(f"{API_BASE}/scratch-cards/history/{test_uid}", timeout=30)
                if response.status_code == 200:
                    result = response.json()
                    history = result.get("history", [])
                    stats = result.get("stats", {})
                    
                    print(f"✅ HISTORY FIX VERIFIED: No 500 error")
                    print(f"   📋 History records: {len(history)}")
                    print(f"   📋 Total cashback won: ₹{stats.get('total_cashback_won', 0)}")
                    
                    if len(history) > 0:
                        latest_card = history[0]
                        if "_id" not in latest_card:
                            print(f"✅ OBJECTID FIX VERIFIED: No _id field in response")
                        else:
                            print(f"❌ OBJECTID FIX FAILED: _id field still present")
                            
                elif response.status_code == 500:
                    print(f"❌ HISTORY FIX FAILED: Still returning 500 error")
                else:
                    print(f"⚠️  Unexpected status: {response.status_code}")
                    
            else:
                print(f"❌ Wallet endpoint failed: {response.status_code}")
                
        else:
            print(f"❌ Scratch card purchase failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    find_and_test_existing_user()