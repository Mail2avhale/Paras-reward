#!/usr/bin/env python3
"""
Delivery Charge Distribution System Test
Tests the comprehensive delivery charge distribution system as requested
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

print(f"Testing Delivery Charge Distribution System at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def test_delivery_charge_distribution():
    """Test Delivery Charge Distribution System Comprehensively"""
    print("\n" + "=" * 80)
    print("TESTING DELIVERY CHARGE DISTRIBUTION SYSTEM")
    print("=" * 80)
    
    # Step 1: Find an outlet user with parent relationships
    print(f"\n1. Finding outlet with parent relationships...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/users/all", timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ Failed to get users: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
        users = response.json().get("users", [])
        
        # Find outlet user with parent_id
        outlet_user = None
        for user in users:
            if user.get("role") == "outlet" and user.get("parent_id"):
                outlet_user = user
                break
        
        if not outlet_user:
            print(f"   ❌ No outlet user with parent_id found")
            print(f"   Available users: {len(users)}")
            # Show available outlet users
            outlets = [u for u in users if u.get("role") == "outlet"]
            print(f"   Outlet users found: {len(outlets)}")
            for outlet in outlets[:3]:  # Show first 3
                print(f"     - {outlet.get('name', 'N/A')} (UID: {outlet.get('uid')}, Parent: {outlet.get('parent_id', 'None')})")
            return False
            
        outlet_uid = outlet_user["uid"]
        sub_stockist_uid = outlet_user["parent_id"]
        
        print(f"   ✅ Found outlet user: {outlet_uid}")
        print(f"   📋 Outlet Name: {outlet_user.get('name', 'N/A')}")
        print(f"   📋 Sub Stockist ID: {sub_stockist_uid}")
        
    except Exception as e:
        print(f"   ❌ Error finding outlet user: {e}")
        return False
    
    # Step 2: Verify Sub Stockist has a parent Master Stockist
    print(f"\n2. Verifying Sub Stockist has parent Master Stockist...")
    
    try:
        # Find the sub stockist user
        sub_stockist_user = None
        for user in users:
            if user.get("uid") == sub_stockist_uid:
                sub_stockist_user = user
                break
        
        if not sub_stockist_user:
            print(f"   ❌ Sub Stockist user not found: {sub_stockist_uid}")
            return False
            
        master_stockist_uid = sub_stockist_user.get("parent_id")
        if not master_stockist_uid:
            print(f"   ❌ Sub Stockist has no parent Master Stockist")
            print(f"   📋 Sub Stockist: {sub_stockist_user.get('name', 'N/A')}")
            print(f"   📋 Role: {sub_stockist_user.get('role', 'N/A')}")
            return False
            
        print(f"   ✅ Sub Stockist has parent Master Stockist")
        print(f"   📋 Sub Stockist Name: {sub_stockist_user.get('name', 'N/A')}")
        print(f"   📋 Master Stockist ID: {master_stockist_uid}")
        
    except Exception as e:
        print(f"   ❌ Error verifying parent relationships: {e}")
        return False
    
    # Step 3: Get initial wallet balances
    print(f"\n3. Getting initial wallet balances...")
    
    initial_balances = {}
    entities = {
        "outlet": outlet_uid,
        "sub_stockist": sub_stockist_uid,
        "master_stockist": master_stockist_uid
    }
    
    for entity_type, entity_uid in entities.items():
        try:
            response = requests.get(f"{API_BASE}/wallet/{entity_uid}", timeout=30)
            if response.status_code == 200:
                wallet_data = response.json()
                initial_balances[entity_type] = wallet_data.get("profit_balance", 0)
                print(f"   📋 {entity_type.title()} initial profit balance: ₹{initial_balances[entity_type]}")
            else:
                print(f"   ⚠️  Could not get {entity_type} wallet balance: {response.status_code}")
                initial_balances[entity_type] = 0
        except Exception as e:
            print(f"   ⚠️  Error getting {entity_type} wallet balance: {e}")
            initial_balances[entity_type] = 0
    
    # Step 4: Create test order with PRC value
    print(f"\n4. Creating test order with PRC value...")
    
    # Find a VIP user with verified KYC and sufficient balance
    vip_user = None
    for user in users:
        if (user.get("membership_type") == "vip" and 
            user.get("kyc_status") == "verified" and 
            user.get("prc_balance", 0) >= 100):
            vip_user = user
            break
    
    if not vip_user:
        print(f"   ❌ No VIP user with verified KYC and sufficient PRC balance found")
        # Show available VIP users
        vip_users = [u for u in users if u.get("membership_type") == "vip"]
        print(f"   VIP users found: {len(vip_users)}")
        for vip in vip_users[:3]:  # Show first 3
            print(f"     - {vip.get('name', 'N/A')} (KYC: {vip.get('kyc_status', 'N/A')}, PRC: {vip.get('prc_balance', 0)})")
        return False
    
    test_user_uid = vip_user["uid"]
    print(f"   ✅ Using VIP user: {vip_user.get('name', 'N/A')}")
    print(f"   📋 User UID: {test_user_uid}")
    print(f"   📋 PRC Balance: {vip_user.get('prc_balance', 0)}")
    
    try:
        # Get a product
        products_response = requests.get(f"{API_BASE}/products", timeout=30)
        if products_response.status_code != 200:
            print(f"   ❌ Failed to get products: {products_response.status_code}")
            return False
            
        products = products_response.json()
        if not products:
            print(f"   ❌ No products available")
            return False
            
        # Use the first product
        test_product = products[0]
        product_id = test_product["product_id"]
        
        print(f"   📋 Using product: {test_product['name']} (PRC: {test_product['prc_price']})")
        
        # Create order using legacy endpoint
        order_data = {"product_id": product_id}
        response = requests.post(f"{API_BASE}/orders/{test_user_uid}", json=order_data, timeout=30)
        
        if response.status_code != 200:
            print(f"   ❌ Failed to create order: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
        order_result = response.json()
        order_id = order_result.get("order_id")
        secret_code = order_result.get("secret_code")
        prc_amount = order_result.get("prc_amount", test_product["prc_price"])
        
        print(f"   ✅ Order created successfully!")
        print(f"   📋 Order ID: {order_id}")
        print(f"   📋 Secret Code: {secret_code}")
        print(f"   📋 PRC Amount: {prc_amount}")
        
    except Exception as e:
        print(f"   ❌ Error creating test order: {e}")
        return False
    
    # Step 5: Mark order as delivered using secret code verification
    print(f"\n5. Marking order as delivered using outlet...")
    
    try:
        # First verify the order with secret code
        verify_data = {"secret_code": secret_code}
        response = requests.post(f"{API_BASE}/orders/verify", json=verify_data, timeout=30)
        
        if response.status_code == 200:
            print(f"   ✅ Order verified successfully")
        else:
            print(f"   ⚠️  Order verification response: {response.status_code}")
            print(f"   Response: {response.text}")
        
        # Now deliver the order (this should trigger auto-distribution)
        deliver_data = {"outlet_id": outlet_uid}
        response = requests.post(f"{API_BASE}/orders/{order_id}/deliver", json=deliver_data, timeout=30)
        
        if response.status_code != 200:
            print(f"   ❌ Failed to deliver order: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
        delivery_result = response.json()
        print(f"   ✅ Order delivered successfully!")
        print(f"   📋 Delivery result: {delivery_result}")
        
    except Exception as e:
        print(f"   ❌ Error delivering order: {e}")
        return False
    
    # Step 6: Verify delivery charges calculation
    print(f"\n6. Verifying delivery charge calculation...")
    
    # Expected calculation: (PRC_amount * 0.10) / 10 = delivery charge in ₹
    expected_total_commission = (prc_amount * 0.10) / 10
    expected_outlet_share = expected_total_commission * 0.60  # 60%
    expected_sub_share = expected_total_commission * 0.20     # 20%
    expected_master_share = expected_total_commission * 0.10  # 10%
    expected_company_share = expected_total_commission * 0.10 # 10%
    
    print(f"   📋 PRC Amount: {prc_amount}")
    print(f"   📋 Expected Total Commission: ₹{expected_total_commission}")
    print(f"   📋 Expected Outlet Share (60%): ₹{expected_outlet_share}")
    print(f"   📋 Expected Sub Share (20%): ₹{expected_sub_share}")
    print(f"   📋 Expected Master Share (10%): ₹{expected_master_share}")
    print(f"   📋 Expected Company Share (10%): ₹{expected_company_share}")
    
    # Step 7: Check updated wallet balances
    print(f"\n7. Checking updated wallet balances...")
    
    final_balances = {}
    balance_increases = {}
    
    for entity_type, entity_uid in entities.items():
        try:
            response = requests.get(f"{API_BASE}/wallet/{entity_uid}", timeout=30)
            if response.status_code == 200:
                wallet_data = response.json()
                final_balances[entity_type] = wallet_data.get("profit_balance", 0)
                balance_increases[entity_type] = final_balances[entity_type] - initial_balances[entity_type]
                
                print(f"   📋 {entity_type.title()}:")
                print(f"     Initial Balance: ₹{initial_balances[entity_type]}")
                print(f"     Final Balance: ₹{final_balances[entity_type]}")
                print(f"     Increase: ₹{balance_increases[entity_type]}")
            else:
                print(f"   ❌ Could not get {entity_type} final wallet balance: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Error getting {entity_type} final wallet balance: {e}")
            return False
    
    # Step 8: Verify commission records in database
    print(f"\n8. Verifying commission records in database...")
    
    try:
        # Check commission records for each entity
        commission_records_found = {}
        
        for entity_type, entity_uid in entities.items():
            response = requests.get(f"{API_BASE}/commissions/entity/{entity_uid}", timeout=30)
            if response.status_code == 200:
                commission_data = response.json()
                commissions = commission_data.get("commissions", [])
                # Find commission record for this order
                order_commission = None
                for comm in commissions:
                    if comm.get("order_id") == order_id:
                        order_commission = comm
                        break
                
                if order_commission:
                    commission_records_found[entity_type] = order_commission
                    print(f"   ✅ {entity_type.title()} commission record found:")
                    print(f"     Amount: ₹{order_commission.get('amount', 0)}")
                    print(f"     Commission Type: {order_commission.get('commission_type', 'N/A')}")
                else:
                    print(f"   ⚠️  No commission record found for {entity_type}")
            else:
                print(f"   ⚠️  Could not get commission records for {entity_type}: {response.status_code}")
                print(f"   Response: {response.text}")
        
    except Exception as e:
        print(f"   ❌ Error checking commission records: {e}")
    
    # Step 9: Validate distribution percentages
    print(f"\n9. Validating distribution percentages...")
    
    distribution_correct = True
    tolerance = 0.01  # Allow small floating point differences
    
    # Check outlet share (60%)
    if abs(balance_increases["outlet"] - expected_outlet_share) > tolerance:
        print(f"   ❌ Outlet share incorrect: Expected ₹{expected_outlet_share}, Got ₹{balance_increases['outlet']}")
        distribution_correct = False
    else:
        print(f"   ✅ Outlet share correct: ₹{balance_increases['outlet']} (60%)")
    
    # Check sub stockist share (20%)
    if abs(balance_increases["sub_stockist"] - expected_sub_share) > tolerance:
        print(f"   ❌ Sub Stockist share incorrect: Expected ₹{expected_sub_share}, Got ₹{balance_increases['sub_stockist']}")
        distribution_correct = False
    else:
        print(f"   ✅ Sub Stockist share correct: ₹{balance_increases['sub_stockist']} (20%)")
    
    # Check master stockist share (10%)
    if abs(balance_increases["master_stockist"] - expected_master_share) > tolerance:
        print(f"   ❌ Master Stockist share incorrect: Expected ₹{expected_master_share}, Got ₹{balance_increases['master_stockist']}")
        distribution_correct = False
    else:
        print(f"   ✅ Master Stockist share correct: ₹{balance_increases['master_stockist']} (10%)")
    
    # Verify total distribution adds up
    total_distributed = sum(balance_increases.values())
    expected_total_distributed = expected_outlet_share + expected_sub_share + expected_master_share
    
    if abs(total_distributed - expected_total_distributed) > tolerance:
        print(f"   ❌ Total distribution incorrect: Expected ₹{expected_total_distributed}, Got ₹{total_distributed}")
        distribution_correct = False
    else:
        print(f"   ✅ Total distribution correct: ₹{total_distributed}")
    
    print(f"\n10. Test Summary:")
    if distribution_correct:
        print(f"   ✅ DELIVERY CHARGE DISTRIBUTION TEST PASSED")
        print(f"   📋 All percentages calculated correctly")
        print(f"   📋 Wallet balances updated properly")
        print(f"   📋 Commission system working as expected")
        return True
    else:
        print(f"   ❌ DELIVERY CHARGE DISTRIBUTION TEST FAILED")
        print(f"   📋 Distribution percentages or calculations incorrect")
        return False

if __name__ == "__main__":
    print("Starting Delivery Charge Distribution System Testing...")
    
    # Run the test
    test_result = test_delivery_charge_distribution()
    
    # Print final result
    print("\n" + "=" * 80)
    if test_result:
        print("🎉 DELIVERY CHARGE DISTRIBUTION SYSTEM TEST PASSED!")
        print("✅ All functionality working correctly")
        sys.exit(0)
    else:
        print("❌ DELIVERY CHARGE DISTRIBUTION SYSTEM TEST FAILED!")
        print("⚠️  Issues found that need attention")
        sys.exit(1)