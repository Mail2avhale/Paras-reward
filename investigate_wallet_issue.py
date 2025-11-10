#!/usr/bin/env python3
"""
INVESTIGATE WALLET BALANCE ISSUE

This test investigates why the wallet endpoint is showing double the expected cashback balance.
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

print(f"🔍 INVESTIGATE WALLET BALANCE ISSUE")
print(f"Backend URL: {BACKEND_URL}")
print("=" * 60)

def investigate_wallet_issue():
    """Investigate the wallet balance calculation issue"""
    
    timestamp = int(time.time())
    
    test_user_data = {
        "first_name": "Investigate",
        "last_name": "WalletIssue",
        "email": f"investigate_{timestamp}@test.com",
        "mobile": f"9876543{timestamp % 1000:03d}",
        "password": "secure123456",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{timestamp % 100000000:08d}",
        "pan_number": f"INV{timestamp % 10000:04d}T",
        "membership_type": "vip",
        "kyc_status": "verified",
        "prc_balance": 50.0
    }
    
    print(f"\n📋 Creating user and investigating wallet balance calculation...")
    
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
            
        # Check initial wallet balance
        print(f"\n📋 Initial wallet balance:")
        response = requests.get(f"{API_BASE}/wallet/{test_uid}", timeout=30)
        if response.status_code == 200:
            wallet_data = response.json()
            print(f"   📋 Initial cashback_balance: ₹{wallet_data.get('cashback_balance', 0)}")
        
        # Check user data directly
        print(f"\n📋 Initial user data:")
        response = requests.get(f"{API_BASE}/users/{test_uid}", timeout=30)
        if response.status_code == 200:
            user_data = response.json()
            print(f"   📋 cashback_wallet_balance: {user_data.get('cashback_wallet_balance', 'NOT SET')}")
            print(f"   📋 cash_wallet_balance: {user_data.get('cash_wallet_balance', 'NOT SET')}")
            print(f"   📋 cashback_balance: {user_data.get('cashback_balance', 'NOT SET')}")
            
        # Purchase scratch card
        print(f"\n📋 Purchasing scratch card...")
        purchase_data = {"card_type": 10}
        response = requests.post(f"{API_BASE}/scratch-cards/purchase?uid={test_uid}", json=purchase_data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            cashback_won = result.get("cashback_won_inr", 0)
            print(f"✅ Scratch card purchased")
            print(f"   📋 Cashback won: ₹{cashback_won}")
            print(f"   📋 Response new_cashback_wallet: ₹{result.get('new_cashback_wallet', 0)}")
            
            # Check user data after purchase
            print(f"\n📋 User data after purchase:")
            response = requests.get(f"{API_BASE}/users/{test_uid}", timeout=30)
            if response.status_code == 200:
                user_data = response.json()
                print(f"   📋 cashback_wallet_balance: {user_data.get('cashback_wallet_balance', 'NOT SET')}")
                print(f"   📋 cash_wallet_balance: {user_data.get('cash_wallet_balance', 'NOT SET')}")
                print(f"   📋 cashback_balance: {user_data.get('cashback_balance', 'NOT SET')}")
                
            # Check wallet endpoint after purchase
            print(f"\n📋 Wallet endpoint after purchase:")
            response = requests.get(f"{API_BASE}/wallet/{test_uid}", timeout=30)
            if response.status_code == 200:
                wallet_data = response.json()
                returned_cashback = wallet_data.get("cashback_balance", 0)
                print(f"   📋 Returned cashback_balance: ₹{returned_cashback}")
                
                # Analyze the discrepancy
                print(f"\n📋 Analysis:")
                print(f"   📋 Expected: ₹{cashback_won}")
                print(f"   📋 Actual: ₹{returned_cashback}")
                print(f"   📋 Difference: ₹{returned_cashback - cashback_won}")
                
                if abs(returned_cashback - (cashback_won * 2)) < 0.01:
                    print(f"   ⚠️  ISSUE: Wallet endpoint returning DOUBLE the expected amount")
                elif abs(returned_cashback - cashback_won) < 0.01:
                    print(f"   ✅ CORRECT: Wallet endpoint returning expected amount")
                else:
                    print(f"   ❌ UNKNOWN: Unexpected calculation")
                    
            # Check transaction history
            print(f"\n📋 Transaction history:")
            response = requests.get(f"{API_BASE}/wallet/transactions/{test_uid}", timeout=30)
            if response.status_code == 200:
                result = response.json()
                transactions = result.get("transactions", [])
                print(f"   📋 Total transactions: {len(transactions)}")
                
                for i, txn in enumerate(transactions[:3]):  # Show first 3
                    print(f"   📋 Transaction {i+1}: {txn.get('type')} - ₹{txn.get('amount')} - {txn.get('description')}")
                    
        else:
            print(f"❌ Scratch card purchase failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    investigate_wallet_issue()