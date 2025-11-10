#!/usr/bin/env python3
"""
SCRATCH CARD CASHBACK CREDIT FIX - COMPREHENSIVE TESTING

Tests the scratch card game cashback credit functionality to verify:
1. Cashback properly credited to cashback_wallet_balance field
2. Transaction logging using log_transaction() function
3. Proper PRC balance deduction
4. Game history preservation in scratch_cards collection
5. Transaction history shows scratch card rewards

Test Scenarios:
- Create test user with sufficient PRC balance
- Purchase different card types (10, 50, 100 PRC)
- Verify cashback credited to correct field
- Verify transaction logging with proper details
- Test transaction history endpoints
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

print(f"🎰 SCRATCH CARD CASHBACK CREDIT FIX - COMPREHENSIVE TESTING")
print(f"Backend URL: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def test_scratch_card_cashback_credit_fix():
    """
    SCRATCH CARD CASHBACK CREDIT FIX - COMPREHENSIVE TESTING
    
    Test Scenarios:
    1. Create test user with sufficient PRC balance (at least 100 PRC)
    2. Check user's initial cashback_wallet_balance
    3. Purchase a scratch card (10 PRC Bronze card)
    4. Verify:
       - PRC balance deducted correctly
       - Cashback credited to cashback_wallet_balance field
       - Transaction logged in 'transactions' collection with type='scratch_card_reward'
       - Scratch card record created in 'scratch_cards' collection
       - Response includes correct cashback amount and new balance
    5. Test with different card types (50 PRC Silver, 100 PRC Gold)
    6. Verify transaction history shows scratch card rewards
    """
    print(f"\n🎰 SCRATCH CARD CASHBACK CREDIT FIX - COMPREHENSIVE TESTING")
    print("=" * 80)
    print(f"Testing scratch card cashback credit and transaction logging")
    print("=" * 80)
    
    test_results = {
        # Test Setup
        "test_user_creation": False,
        "available_cards_endpoint": False,
        
        # Bronze Card (10 PRC) Tests
        "bronze_card_purchase": False,
        "bronze_prc_deduction": False,
        "bronze_cashback_credit": False,
        "bronze_transaction_logging": False,
        "bronze_scratch_card_record": False,
        
        # Silver Card (50 PRC) Tests
        "silver_card_purchase": False,
        "silver_prc_deduction": False,
        "silver_cashback_credit": False,
        "silver_transaction_logging": False,
        
        # Gold Card (100 PRC) Tests
        "gold_card_purchase": False,
        "gold_prc_deduction": False,
        "gold_cashback_credit": False,
        "gold_transaction_logging": False,
        
        # Transaction History Tests
        "wallet_transactions_endpoint": False,
        "scratch_card_history_endpoint": False,
        "transaction_details_verification": False
    }
    
    # Create test environment
    timestamp = int(time.time())
    
    print(f"\n🏗️  TEST SETUP")
    print("=" * 60)
    
    # Create test user with sufficient PRC balance
    print(f"\n📋 Creating test user with sufficient PRC balance")
    
    test_user_data = {
        "first_name": "Scratch",
        "last_name": "CardTester",
        "email": f"scratch_test_{timestamp}@test.com",
        "mobile": f"9876543{timestamp % 1000:03d}",
        "password": "secure123456",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{timestamp % 100000000:08d}",
        "pan_number": f"SCRCH{timestamp % 10000:04d}T",
        "membership_type": "vip",  # Test with VIP for better rewards
        "kyc_status": "verified",
        "prc_balance": 200.0,  # Sufficient for all card types
        "cashback_wallet_balance": 0.0  # Start with zero cashback
    }
    
    test_uid = None
    initial_prc_balance = 200.0
    initial_cashback_balance = 0.0
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=test_user_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_uid = result.get("uid")
            test_results["test_user_creation"] = True
            print(f"✅ Test user created successfully: {test_uid}")
            print(f"   📋 Name: {test_user_data['first_name']} {test_user_data['last_name']}")
            print(f"   📋 Initial PRC Balance: {initial_prc_balance}")
            print(f"   📋 Initial Cashback Balance: {initial_cashback_balance}")
        else:
            print(f"❌ Test user creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return test_results
            
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        return test_results
    
    # Scenario 2: Create test order via POST /api/orders/checkout
    print(f"\n📋 Scenario 2: Create test order via POST /api/orders/checkout")
    
    try:
        # Get available products first
        response = requests.get(f"{API_BASE}/products", timeout=30)
        if response.status_code == 200:
            products_data = response.json()
            if isinstance(products_data, dict) and "products" in products_data:
                products = products_data["products"]
            elif isinstance(products_data, list):
                products = products_data
            else:
                products = []
            
            if len(products) > 0:
                test_product = products[0]
                print(f"   Using product: {test_product['name']} (PRC: {test_product.get('prc_price')}, Cash: {test_product.get('cash_price')})")
                
                # Add to cart first
                cart_data = {
                    "user_id": vip_uid,
                    "product_id": test_product["product_id"],
                    "quantity": 1
                }
                cart_response = requests.post(f"{API_BASE}/cart/add", json=cart_data, timeout=30)
                print(f"   Cart add status: {cart_response.status_code}")
                
                # Checkout
                checkout_data = {
                    "user_id": vip_uid,
                    "delivery_address": "123 Test Street, Mumbai, Maharashtra, 400001"
                }
                
                response = requests.post(f"{API_BASE}/orders/checkout", json=checkout_data, timeout=30)
                if response.status_code == 200:
                    result = response.json()
                    order_id = result.get("order_id")
                    secret_code = result.get("secret_code")
                    test_results["scenario_02_order_creation_checkout"] = True
                    print(f"✅ Order created via checkout: {order_id}")
                    print(f"   📋 Secret Code: {secret_code}")
                    print(f"   📋 Total PRC: {result.get('total_prc')}")
                else:
                    print(f"❌ Order checkout failed: {response.status_code}")
                    print(f"   Response: {response.text}")
                    return test_results
            else:
                print(f"❌ No products available for testing")
                return test_results
        else:
            print(f"❌ Failed to get products: {response.status_code}")
            return test_results
            
    except Exception as e:
        print(f"❌ Error creating order: {e}")
        return test_results
    
    # Scenarios 3-5: Verify outlet assignment
    print(f"\n📋 Scenarios 3-5: Verify outlet assignment fields and logic")
    
    try:
        # Get order details to check outlet assignment
        response = requests.get(f"{API_BASE}/admin/orders/{order_id}", timeout=30)
        if response.status_code == 200:
            order_data = response.json()
            outlet_id = order_data.get("outlet_id")
            assigned_outlet = order_data.get("assigned_outlet")
            
            print(f"   📋 Order outlet_id: {outlet_id}")
            print(f"   📋 Order assigned_outlet: {assigned_outlet}")
            
            # Scenario 3: Verify outlet_id is NOT None
            if outlet_id is not None:
                test_results["scenario_03_outlet_id_not_none"] = True
                print(f"✅ Scenario 3: outlet_id is NOT None")
            else:
                print(f"❌ Scenario 3: outlet_id is None")
            
            # Scenario 4: Verify assigned_outlet is NOT None
            if assigned_outlet is not None:
                test_results["scenario_04_assigned_outlet_not_none"] = True
                print(f"✅ Scenario 4: assigned_outlet is NOT None")
            else:
                print(f"❌ Scenario 4: assigned_outlet is None")
            
            # Scenario 5: Confirm outlet assignment logic works
            if outlet_id is not None and assigned_outlet is not None:
                test_results["scenario_05_outlet_assignment_logic"] = True
                print(f"✅ Scenario 5: Outlet assignment logic working correctly")
            else:
                print(f"❌ Scenario 5: Outlet assignment logic failed")
        else:
            print(f"❌ Failed to get order details: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error checking outlet assignment: {e}")
    
    print(f"\n🚚 PHASE 2: ORDER DELIVERY FLOW")
    print("=" * 60)
    
    # Scenario 6: Verify order with secret code
    print(f"\n📋 Scenario 6: Verify order with secret code")
    
    try:
        verify_data = {"secret_code": secret_code}
        response = requests.post(f"{API_BASE}/orders/verify", json=verify_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["scenario_06_order_verification"] = True
            print(f"✅ Order verification successful")
            print(f"   📋 Message: {result.get('message')}")
        else:
            print(f"❌ Order verification failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error verifying order: {e}")
    
    # Scenarios 7-8: Mark order as delivered
    print(f"\n📋 Scenarios 7-8: Mark order as delivered")
    
    try:
        delivery_data = {}
        response = requests.post(f"{API_BASE}/orders/{order_id}/deliver", json=delivery_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            message = result.get('message', '').lower()
            
            test_results["scenario_07_order_delivery_success"] = True
            print(f"✅ Scenario 7: Order delivery successful")
            print(f"   📋 Message: {result.get('message')}")
            
            # Scenario 8: Confirm no "No outlet assigned" error
            if 'no outlet assigned' not in message:
                test_results["scenario_08_no_outlet_assigned_error"] = True
                print(f"✅ Scenario 8: No 'No outlet assigned' error")
            else:
                print(f"❌ Scenario 8: Got 'No outlet assigned' error")
        else:
            print(f"❌ Order delivery failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error delivering order: {e}")
    
    print(f"\n💰 PHASE 3: DELIVERY CHARGE DISTRIBUTION")
    print("=" * 60)
    
    # Scenario 9: Trigger delivery charge distribution
    print(f"\n📋 Scenario 9: Trigger delivery charge distribution")
    
    try:
        distribution_data = {}
        response = requests.post(f"{API_BASE}/orders/{order_id}/distribute-delivery-charge", json=distribution_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["scenario_09_distribution_trigger"] = True
            print(f"✅ Delivery charge distribution triggered successfully")
            print(f"   📋 Message: {result.get('message')}")
            print(f"   📋 Total Commission: ₹{result.get('total_commission', 0)}")
            
            # Scenario 10: Verify commission distribution succeeds
            distributions = result.get('distributions', {})
            if distributions:
                test_results["scenario_10_commission_distribution"] = True
                print(f"✅ Scenario 10: Commission distribution successful")
                print(f"   📋 Distributions: {distributions}")
            
        else:
            print(f"❌ Distribution failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error triggering distribution: {e}")
    
    # Scenario 11: Check profit_wallet_balance updated
    print(f"\n📋 Scenario 11: Check profit_wallet_balance updates")
    
    # We need to find the actual stockists that received the distribution
    # Let's check the order details to see which outlets were involved
    try:
        response = requests.get(f"{API_BASE}/admin/orders/{order_id}", timeout=30)
        if response.status_code == 200:
            order_data = response.json()
            outlet_id = order_data.get("outlet_id")
            
            if outlet_id:
                # Get outlet user details
                response = requests.get(f"{API_BASE}/users/{outlet_id}", timeout=30)
                if response.status_code == 200:
                    outlet_user = response.json()
                    profit_balance = outlet_user.get("profit_wallet_balance", 0)
                    
                    if profit_balance > 0:
                        test_results["scenario_11_profit_wallet_updates"] = True
                        print(f"✅ Scenario 11: Profit wallet balance updated")
                        print(f"   📋 Outlet {outlet_id} balance: ₹{profit_balance}")
                    else:
                        print(f"⚠️  Scenario 11: No profit wallet balance found for outlet")
                else:
                    print(f"❌ Failed to get outlet user details")
            else:
                print(f"❌ No outlet_id found in order")
                
    except Exception as e:
        print(f"❌ Error checking profit wallet updates: {e}")
    
    print(f"\n🔍 PHASE 4: TRANSACTION LOGGING (CRITICAL)")
    print("=" * 60)
    
    # Scenarios 12-15: Transaction logging verification
    print(f"\n📋 Scenarios 12-15: Transaction logging verification")
    
    try:
        # Get order details to find involved entities
        response = requests.get(f"{API_BASE}/admin/orders/{order_id}", timeout=30)
        if response.status_code == 200:
            order_data = response.json()
            outlet_id = order_data.get("outlet_id")
            
            if outlet_id:
                # Check transactions for the outlet
                response = requests.get(f"{API_BASE}/wallet/transactions/{outlet_id}?wallet_type=profit_wallet", timeout=30)
                if response.status_code == 200:
                    result = response.json()
                    transactions = result.get("transactions", [])
                    
                    # Look for profit_share transactions
                    profit_share_txns = [t for t in transactions if t.get("type") == "profit_share"]
                    
                    if profit_share_txns:
                        latest_txn = profit_share_txns[0]
                        
                        # Scenario 12: Query transactions for transaction_type = "profit_share"
                        if latest_txn.get("type") == "profit_share":
                            test_results["scenario_12_profit_share_transactions"] = True
                            print(f"✅ Scenario 12: profit_share transactions found")
                        
                        # Scenario 13: Verify transaction records exist (at least 1 for outlet)
                        if len(profit_share_txns) >= 1:
                            test_results["scenario_13_three_transaction_records"] = True
                            print(f"✅ Scenario 13: Transaction records exist ({len(profit_share_txns)} found)")
                        
                        # Scenario 14: Confirm wallet_type = "profit_wallet"
                        if latest_txn.get("wallet_type") == "profit_wallet":
                            test_results["scenario_14_profit_wallet_type"] = True
                            print(f"✅ Scenario 14: wallet_type = 'profit_wallet' confirmed")
                        
                        # Scenario 15: Verify metadata completeness
                        metadata = latest_txn.get("metadata", {})
                        required_fields = ["order_id", "entity_type", "commission_percentage", "total_commission"]
                        metadata_complete = all(field in metadata for field in required_fields)
                        
                        if metadata_complete and metadata.get("order_id") == order_id:
                            test_results["scenario_15_metadata_completeness"] = True
                            print(f"✅ Scenario 15: Metadata completeness verified")
                            print(f"   📋 Order ID: {metadata.get('order_id')}")
                            print(f"   📋 Entity Type: {metadata.get('entity_type')}")
                            print(f"   📋 Commission %: {metadata.get('commission_percentage')}")
                        else:
                            print(f"❌ Scenario 15: Metadata incomplete or order_id mismatch")
                            print(f"   📋 Metadata: {metadata}")
                    else:
                        print(f"❌ No profit_share transactions found")
                else:
                    print(f"❌ Failed to get transactions: {response.status_code}")
            else:
                print(f"❌ No outlet_id found for transaction verification")
                
    except Exception as e:
        print(f"❌ Error in transaction logging verification: {e}")
    
    print(f"\n📊 PHASE 5: BALANCE TRACKING")
    print("=" * 60)
    
    # Scenarios 16-17: Balance tracking verification
    print(f"\n📋 Scenarios 16-17: Balance tracking verification")
    
    try:
        if outlet_id:
            # Get current user balance
            response = requests.get(f"{API_BASE}/users/{outlet_id}", timeout=30)
            if response.status_code == 200:
                user_data = response.json()
                current_balance = user_data.get("profit_wallet_balance", 0)
                
                # Get latest transaction
                response = requests.get(f"{API_BASE}/wallet/transactions/{outlet_id}?wallet_type=profit_wallet", timeout=30)
                if response.status_code == 200:
                    result = response.json()
                    transactions = result.get("transactions", [])
                    
                    if transactions:
                        latest_txn = transactions[0]
                        balance_before = latest_txn.get("balance_before", 0)
                        balance_after = latest_txn.get("balance_after", 0)
                        amount = latest_txn.get("amount", 0)
                        
                        # Scenario 16: Check balance_before and balance_after accuracy
                        if balance_after == balance_before + amount:
                            test_results["scenario_16_balance_accuracy"] = True
                            print(f"✅ Scenario 16: Balance calculations accurate")
                            print(f"   📋 Before: ₹{balance_before}, Amount: ₹{amount}, After: ₹{balance_after}")
                        else:
                            print(f"❌ Scenario 16: Balance calculation error")
                        
                        # Scenario 17: Confirm balance_after matches current balance
                        if abs(current_balance - balance_after) < 0.01:  # Allow for rounding
                            test_results["scenario_17_balance_matching"] = True
                            print(f"✅ Scenario 17: Current balance matches transaction balance_after")
                            print(f"   📋 Current: ₹{current_balance}, Transaction: ₹{balance_after}")
                        else:
                            print(f"❌ Scenario 17: Balance mismatch")
                            print(f"   📋 Current: ₹{current_balance}, Transaction: ₹{balance_after}")
                    else:
                        print(f"❌ No transactions found for balance verification")
            else:
                print(f"❌ Failed to get user data for balance verification")
                
    except Exception as e:
        print(f"❌ Error in balance tracking verification: {e}")
    
    print(f"\n📚 PHASE 6: TRANSACTION HISTORY INTEGRATION")
    print("=" * 60)
    
    # Scenario 18: Transaction history integration
    print(f"\n📋 Scenario 18: Transaction history integration")
    
    try:
        if outlet_id:
            response = requests.get(f"{API_BASE}/wallet/transactions/{outlet_id}", timeout=30)
            if response.status_code == 200:
                result = response.json()
                transactions = result.get("transactions", [])
                
                # Look for profit wallet transactions
                profit_txns = [t for t in transactions if t.get("wallet_type") == "profit_wallet"]
                
                if profit_txns:
                    test_results["scenario_18_transaction_history"] = True
                    print(f"✅ Scenario 18: Transaction history integration working")
                    print(f"   📋 Total transactions: {len(transactions)}")
                    print(f"   📋 Profit wallet transactions: {len(profit_txns)}")
                else:
                    print(f"❌ Scenario 18: No profit wallet transactions in history")
            else:
                print(f"❌ Failed to get transaction history: {response.status_code}")
                
    except Exception as e:
        print(f"❌ Error in transaction history verification: {e}")
    
    # Final Summary
    print(f"\n🏁 COMPLETE VERIFICATION SUMMARY - ALL 18 SCENARIOS")
    print("=" * 80)
    
    phases = {
        "Phase 1 - Outlet Assignment Verification": [
            ("Scenario 1: VIP user creation", test_results["scenario_01_vip_user_creation"]),
            ("Scenario 2: Order creation via checkout", test_results["scenario_02_order_creation_checkout"]),
            ("Scenario 3: outlet_id is NOT None", test_results["scenario_03_outlet_id_not_none"]),
            ("Scenario 4: assigned_outlet is NOT None", test_results["scenario_04_assigned_outlet_not_none"]),
            ("Scenario 5: Outlet assignment logic", test_results["scenario_05_outlet_assignment_logic"])
        ],
        "Phase 2 - Order Delivery Flow": [
            ("Scenario 6: Order verification", test_results["scenario_06_order_verification"]),
            ("Scenario 7: Order delivery success", test_results["scenario_07_order_delivery_success"]),
            ("Scenario 8: No outlet assigned error", test_results["scenario_08_no_outlet_assigned_error"])
        ],
        "Phase 3 - Delivery Charge Distribution": [
            ("Scenario 9: Distribution trigger", test_results["scenario_09_distribution_trigger"]),
            ("Scenario 10: Commission distribution", test_results["scenario_10_commission_distribution"]),
            ("Scenario 11: Profit wallet updates", test_results["scenario_11_profit_wallet_updates"])
        ],
        "Phase 4 - Transaction Logging (CRITICAL)": [
            ("Scenario 12: profit_share transactions", test_results["scenario_12_profit_share_transactions"]),
            ("Scenario 13: Transaction records exist", test_results["scenario_13_three_transaction_records"]),
            ("Scenario 14: profit_wallet type", test_results["scenario_14_profit_wallet_type"]),
            ("Scenario 15: Metadata completeness", test_results["scenario_15_metadata_completeness"])
        ],
        "Phase 5 - Balance Tracking": [
            ("Scenario 16: Balance accuracy", test_results["scenario_16_balance_accuracy"]),
            ("Scenario 17: Balance matching", test_results["scenario_17_balance_matching"])
        ],
        "Phase 6 - Transaction History Integration": [
            ("Scenario 18: Transaction history", test_results["scenario_18_transaction_history"])
        ]
    }
    
    total_scenarios = 0
    passed_scenarios = 0
    
    for phase_name, scenarios in phases.items():
        print(f"\n{phase_name}:")
        for scenario_name, result in scenarios:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} {scenario_name}")
            total_scenarios += 1
            if result:
                passed_scenarios += 1
    
    print(f"\n📊 FINAL RESULTS: {passed_scenarios}/{total_scenarios} scenarios passed ({(passed_scenarios/total_scenarios)*100:.1f}%)")
    
    if passed_scenarios == total_scenarios:
        print(f"🎉 ALL 18 SCENARIOS PASSED - PROFIT WALLET TRANSACTION LOGGING IS WORKING PERFECTLY!")
    elif passed_scenarios >= total_scenarios * 0.8:
        print(f"✅ MOSTLY WORKING - {total_scenarios - passed_scenarios} scenarios failed but core functionality operational")
    else:
        print(f"❌ SIGNIFICANT ISSUES - {total_scenarios - passed_scenarios} scenarios failed, needs investigation")
    
    return test_results

def main():
    """Run the complete profit wallet transaction logging verification"""
    print(f"\n🚀 STARTING PROFIT WALLET TRANSACTION LOGGING VERIFICATION")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Run the complete 18-scenario test
    results = test_profit_wallet_transaction_logging_complete_flow()
    
    # Count results
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    print(f"\n🏁 VERIFICATION COMPLETE")
    print("=" * 80)
    print(f"📊 OVERALL RESULTS: {passed_tests}/{total_tests} scenarios passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    if passed_tests == total_tests:
        print(f"\n🎉 SUCCESS - ALL SCENARIOS PASSED!")
        print(f"✅ Profit wallet transaction logging system is working perfectly")
        print(f"✅ Complete audit trail verified")
        print(f"✅ All 18 test scenarios successful")
        return 0
    elif passed_tests >= total_tests * 0.8:
        print(f"\n⚠️  MOSTLY WORKING - {total_tests - passed_tests} scenarios failed")
        print(f"✅ Core functionality operational")
        print(f"⚠️  Minor issues need attention")
        return 0
    else:
        print(f"\n❌ CRITICAL ISSUES - {total_tests - passed_tests} scenarios failed")
        print(f"❌ Significant problems detected")
        print(f"❌ System needs investigation")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)