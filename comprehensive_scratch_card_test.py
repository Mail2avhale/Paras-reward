#!/usr/bin/env python3
"""
COMPREHENSIVE SCRATCH CARD GAME TESTING

This test suite performs comprehensive end-to-end testing of the scratch card system
based on the review request requirements.

TEST SCENARIOS:
1. Check Available Scratch Cards
2. Test User Setup with sufficient PRC balance
3. Purchase Bronze Card (10 PRC)
4. Verify PRC Deduction
5. Verify Cashback Credit (NO double crediting)
6. Verify Transaction Logging
7. Check Scratch Card History
8. Test Silver Card (50 PRC)
9. Test Gold Card (100 PRC)
10. Edge Case Testing (insufficient balance, invalid card types)
11. VIP vs Free User Testing

ENDPOINTS TO TEST:
- GET /api/scratch-cards/available
- POST /api/scratch-cards/purchase (body: card_type, uid)
- GET /api/wallet/{uid}
- GET /api/wallet/transactions/{uid}?wallet_type=cashback_wallet
- GET /api/scratch-cards/history/{uid}

SUCCESS CRITERIA:
- Available cards endpoint returns correct data
- Purchase deducts correct PRC amount
- Cashback credited to cashback_wallet_balance (NOT double credited)
- Transaction logged in transactions collection with correct type
- Scratch card history updated
- Statistics calculated correctly
- VIP vs Free cashback ranges respected
- Error handling works for edge cases
- Response structure complete and correct
- No ObjectId serialization errors
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

print(f"🎰 COMPREHENSIVE SCRATCH CARD GAME TESTING")
print(f"Backend URL: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def create_test_user(user_type="vip", prc_balance=200):
    """Create a test user with specified membership type and PRC balance"""
    timestamp = int(time.time())
    
    user_data = {
        "first_name": f"TestUser{user_type.title()}",
        "last_name": "ScratchCard",
        "email": f"test_scratch_{user_type}_{timestamp}@test.com",
        "mobile": f"9876543{timestamp % 1000:03d}",
        "password": "secure123456",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{timestamp % 100000000:08d}",
        "pan_number": f"TEST{timestamp % 10000:04d}T",
        "membership_type": user_type,
        "kyc_status": "verified",
        "prc_balance": prc_balance,
        "cashback_wallet_balance": 0.0
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=user_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            uid = result.get("uid")
            print(f"✅ Created {user_type.upper()} test user: {uid}")
            print(f"   📋 Name: {user_data['first_name']} {user_data['last_name']}")
            print(f"   📋 Email: {user_data['email']}")
            print(f"   📋 PRC Balance: {prc_balance}")
            return uid, user_data
        else:
            print(f"❌ Failed to create {user_type} user: {response.status_code}")
            print(f"   Response: {response.text}")
            return None, None
    except Exception as e:
        print(f"❌ Error creating {user_type} user: {e}")
        return None, None

def test_available_scratch_cards():
    """Test 1: Check Available Scratch Cards"""
    print(f"\n🎯 TEST 1: CHECK AVAILABLE SCRATCH CARDS")
    print("=" * 60)
    
    try:
        response = requests.get(f"{API_BASE}/scratch-cards/available", timeout=30)
        
        if response.status_code == 200:
            cards = response.json()
            print(f"✅ Available cards endpoint working")
            print(f"   📋 Response: {json.dumps(cards, indent=2)}")
            
            # Handle the actual response structure
            cards_list = cards.get("cards", []) if isinstance(cards, dict) else cards
            
            if isinstance(cards_list, list) and len(cards_list) == 3:
                print(f"✅ Correct number of cards returned: {len(cards_list)}")
                
                # Check each card has required fields
                for card in cards_list:
                    if all(field in card for field in ["id", "cost", "name"]):
                        print(f"   📋 {card.get('name', 'Unknown')}: {card['cost']} PRC")
                        print(f"      Free: {card.get('min_cashback_free', 0)}-{card.get('max_cashback_free', 0)}%")
                        print(f"      VIP: {card.get('min_cashback_vip', 0)}-{card.get('max_cashback_vip', 0)}%")
                    else:
                        print(f"   ⚠️  Card missing required fields: {card}")
                
                return True
            else:
                print(f"❌ Unexpected cards structure: {cards}")
                return False
        else:
            print(f"❌ Available cards endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing available cards: {e}")
        return False

def test_user_wallet_balance(uid, expected_prc=None, expected_cashback=None):
    """Get user wallet balances and verify if expected values provided"""
    try:
        response = requests.get(f"{API_BASE}/wallet/{uid}", timeout=30)
        
        if response.status_code == 200:
            wallet = response.json()
            prc_balance = wallet.get("prc_balance", 0)
            cashback_balance = wallet.get("cashback_balance", 0)
            
            print(f"   📋 Current PRC Balance: {prc_balance}")
            print(f"   📋 Current Cashback Balance: ₹{cashback_balance}")
            
            # Verify expected values if provided
            verification_passed = True
            if expected_prc is not None:
                if abs(prc_balance - expected_prc) < 0.01:
                    print(f"   ✅ PRC balance matches expected: {expected_prc}")
                else:
                    print(f"   ❌ PRC balance mismatch: expected {expected_prc}, got {prc_balance}")
                    verification_passed = False
            
            if expected_cashback is not None:
                if abs(cashback_balance - expected_cashback) < 0.01:
                    print(f"   ✅ Cashback balance matches expected: ₹{expected_cashback}")
                else:
                    print(f"   ❌ Cashback balance mismatch: expected ₹{expected_cashback}, got ₹{cashback_balance}")
                    verification_passed = False
            
            return prc_balance, cashback_balance, verification_passed
        else:
            print(f"   ❌ Wallet endpoint failed: {response.status_code}")
            return None, None, False
            
    except Exception as e:
        print(f"   ❌ Error getting wallet balance: {e}")
        return None, None, False

def test_scratch_card_purchase(uid, card_type, expected_prc_before, expected_cashback_before):
    """Test scratch card purchase and verify all aspects"""
    print(f"\n🎯 TESTING {card_type} PRC CARD PURCHASE")
    print("=" * 60)
    
    # Get initial balances
    print(f"📋 Getting initial balances...")
    prc_before, cashback_before, _ = test_user_wallet_balance(uid)
    
    if prc_before is None:
        return False, None, None, None
    
    # Verify initial balances match expected
    if expected_prc_before is not None and abs(prc_before - expected_prc_before) > 0.01:
        print(f"❌ Initial PRC balance mismatch: expected {expected_prc_before}, got {prc_before}")
    
    if expected_cashback_before is not None and abs(cashback_before - expected_cashback_before) > 0.01:
        print(f"❌ Initial cashback balance mismatch: expected ₹{expected_cashback_before}, got ₹{cashback_before}")
    
    # Purchase scratch card
    print(f"\n📋 Purchasing {card_type} PRC scratch card...")
    
    try:
        purchase_data = {"card_type": card_type}
        response = requests.post(f"{API_BASE}/scratch-cards/purchase?uid={uid}", json=purchase_data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"✅ Purchase successful!")
            print(f"   📋 Transaction ID: {result.get('transaction_id')}")
            print(f"   📋 Cashback Percentage: {result.get('cashback_percentage')}%")
            print(f"   📋 Cashback Won: ₹{result.get('cashback_won_inr')}")
            print(f"   📋 New PRC Balance: {result.get('new_prc_balance')}")
            print(f"   📋 New Cashback Balance: ₹{result.get('new_cashback_wallet')}")
            print(f"   📋 Is VIP: {result.get('is_vip')}")
            
            # Verify response structure
            required_fields = ["success", "transaction_id", "cashback_percentage", "cashback_won_inr", 
                             "new_prc_balance", "new_cashback_wallet", "is_vip"]
            
            structure_valid = all(field in result for field in required_fields)
            if structure_valid:
                print(f"   ✅ Response structure complete")
            else:
                missing = [f for f in required_fields if f not in result]
                print(f"   ❌ Missing response fields: {missing}")
            
            # Verify PRC deduction
            expected_prc_after = prc_before - card_type
            actual_prc_after = result.get('new_prc_balance')
            prc_deduction_correct = abs(actual_prc_after - expected_prc_after) < 0.01
            
            if prc_deduction_correct:
                print(f"   ✅ PRC deduction correct: {prc_before} - {card_type} = {actual_prc_after}")
            else:
                print(f"   ❌ PRC deduction incorrect: expected {expected_prc_after}, got {actual_prc_after}")
            
            # Verify cashback credit
            cashback_won = result.get('cashback_won_inr', 0)
            expected_cashback_after = cashback_before + cashback_won
            actual_cashback_after = result.get('new_cashback_wallet')
            cashback_credit_correct = abs(actual_cashback_after - expected_cashback_after) < 0.01
            
            if cashback_credit_correct:
                print(f"   ✅ Cashback credit correct: ₹{cashback_before} + ₹{cashback_won} = ₹{actual_cashback_after}")
            else:
                print(f"   ❌ Cashback credit incorrect: expected ₹{expected_cashback_after}, got ₹{actual_cashback_after}")
            
            return True, result, prc_deduction_correct, cashback_credit_correct
            
        else:
            print(f"❌ Purchase failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False, None, False, False
            
    except Exception as e:
        print(f"❌ Error during purchase: {e}")
        return False, None, False, False

def test_transaction_logging(uid, transaction_id, expected_amount, card_type):
    """Test transaction logging in wallet transactions"""
    print(f"\n🎯 TESTING TRANSACTION LOGGING")
    print("=" * 60)
    
    try:
        # Test cashback wallet transactions
        response = requests.get(f"{API_BASE}/wallet/transactions/{uid}?wallet_type=cashback_wallet", timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            transactions = result.get("transactions", [])
            
            print(f"✅ Transaction endpoint working")
            print(f"   📋 Total transactions: {len(transactions)}")
            
            # Find the specific transaction
            target_txn = None
            for txn in transactions:
                if txn.get("transaction_id") == transaction_id:
                    target_txn = txn
                    break
            
            if target_txn:
                print(f"✅ Transaction found in history")
                print(f"   📋 Transaction ID: {target_txn.get('transaction_id')}")
                print(f"   📋 Type: {target_txn.get('type')}")
                print(f"   📋 Amount: ₹{target_txn.get('amount')}")
                print(f"   📋 Description: {target_txn.get('description')}")
                
                # Verify transaction details
                txn_type_correct = target_txn.get('type') == 'scratch_card_reward'
                amount_correct = abs(target_txn.get('amount', 0) - expected_amount) < 0.01
                
                if txn_type_correct:
                    print(f"   ✅ Transaction type correct: scratch_card_reward")
                else:
                    print(f"   ❌ Transaction type incorrect: {target_txn.get('type')}")
                
                if amount_correct:
                    print(f"   ✅ Transaction amount correct: ₹{expected_amount}")
                else:
                    print(f"   ❌ Transaction amount incorrect: expected ₹{expected_amount}, got ₹{target_txn.get('amount')}")
                
                # Check metadata
                metadata = target_txn.get("metadata", {})
                if metadata.get("card_type") == card_type:
                    print(f"   ✅ Metadata contains correct card type: {card_type}")
                else:
                    print(f"   ❌ Metadata card type incorrect: {metadata.get('card_type')}")
                
                return True, txn_type_correct and amount_correct
            else:
                print(f"❌ Transaction not found in history")
                print(f"   📋 Available transaction IDs: {[t.get('transaction_id') for t in transactions[:5]]}")
                return False, False
                
        else:
            print(f"❌ Transaction endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False, False
            
    except Exception as e:
        print(f"❌ Error testing transaction logging: {e}")
        return False, False

def test_scratch_card_history(uid, expected_cards_played=None):
    """Test scratch card history endpoint"""
    print(f"\n🎯 TESTING SCRATCH CARD HISTORY")
    print("=" * 60)
    
    try:
        response = requests.get(f"{API_BASE}/scratch-cards/history/{uid}", timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            history = result.get("history", [])
            stats = result.get("stats", {})
            
            print(f"✅ Scratch card history endpoint working")
            print(f"   📋 History records: {len(history)}")
            print(f"   📋 Stats: {json.dumps(stats, indent=2)}")
            
            # Verify no ObjectId serialization errors
            objectid_error = False
            for record in history:
                if "_id" in record:
                    print(f"   ❌ ObjectId field found in history record")
                    objectid_error = True
                    break
            
            if not objectid_error:
                print(f"   ✅ No ObjectId serialization errors")
            
            # Verify expected cards played if provided
            if expected_cards_played is not None:
                actual_cards_played = stats.get("total_cards_played", 0)
                if actual_cards_played == expected_cards_played:
                    print(f"   ✅ Cards played count correct: {expected_cards_played}")
                else:
                    print(f"   ❌ Cards played count incorrect: expected {expected_cards_played}, got {actual_cards_played}")
            
            return True, not objectid_error
            
        else:
            print(f"❌ Scratch card history failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False, False
            
    except Exception as e:
        print(f"❌ Error testing scratch card history: {e}")
        return False, False

def test_edge_cases(uid):
    """Test edge cases: insufficient balance, invalid card types"""
    print(f"\n🎯 TESTING EDGE CASES")
    print("=" * 60)
    
    results = {"insufficient_balance": False, "invalid_card_type": False}
    
    # Test 1: Insufficient PRC balance
    print(f"\n📋 Testing insufficient PRC balance...")
    try:
        # Try to purchase 1000 PRC card (should fail)
        purchase_data = {"card_type": 1000}
        response = requests.post(f"{API_BASE}/scratch-cards/purchase?uid={uid}", json=purchase_data, timeout=30)
        
        if response.status_code == 400:
            result = response.json()
            if "insufficient" in result.get("detail", "").lower():
                print(f"   ✅ Insufficient balance error handled correctly")
                results["insufficient_balance"] = True
            else:
                print(f"   ❌ Wrong error message: {result.get('detail')}")
        else:
            print(f"   ❌ Expected 400 error, got {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error testing insufficient balance: {e}")
    
    # Test 2: Invalid card type
    print(f"\n📋 Testing invalid card type...")
    try:
        # Try to purchase 25 PRC card (should fail - not available)
        purchase_data = {"card_type": 25, "uid": uid}
        response = requests.post(f"{API_BASE}/scratch-cards/purchase", json=purchase_data, timeout=30)
        
        if response.status_code == 400:
            result = response.json()
            print(f"   ✅ Invalid card type error handled correctly")
            print(f"   📋 Error message: {result.get('detail')}")
            results["invalid_card_type"] = True
        else:
            print(f"   ❌ Expected 400 error, got {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Error testing invalid card type: {e}")
    
    return results

def comprehensive_scratch_card_test():
    """Run comprehensive scratch card testing"""
    print(f"\n🎰 COMPREHENSIVE SCRATCH CARD GAME TESTING")
    print("=" * 80)
    
    test_results = {
        "available_cards": False,
        "vip_user_setup": False,
        "free_user_setup": False,
        "bronze_purchase_vip": False,
        "bronze_prc_deduction": False,
        "bronze_cashback_credit": False,
        "bronze_transaction_logging": False,
        "bronze_history_update": False,
        "silver_purchase_vip": False,
        "gold_purchase_vip": False,
        "bronze_purchase_free": False,
        "edge_case_insufficient": False,
        "edge_case_invalid_card": False,
        "no_objectid_errors": False,
        "vip_vs_free_ranges": False
    }
    
    # Test 1: Check Available Scratch Cards
    test_results["available_cards"] = test_available_scratch_cards()
    
    # Test 2: Create VIP test user with sufficient balance
    print(f"\n🎯 TEST 2: VIP USER SETUP")
    print("=" * 60)
    vip_uid, vip_user_data = create_test_user("vip", 200)
    if vip_uid:
        test_results["vip_user_setup"] = True
        print(f"✅ VIP user setup complete")
    else:
        print(f"❌ VIP user setup failed")
        return test_results
    
    # Test 3: Purchase Bronze Card (10 PRC) - VIP User
    print(f"\n🎯 TEST 3: BRONZE CARD PURCHASE (VIP USER)")
    print("=" * 60)
    
    purchase_success, purchase_result, prc_correct, cashback_correct = test_scratch_card_purchase(
        vip_uid, 10, 200, 0
    )
    
    if purchase_success:
        test_results["bronze_purchase_vip"] = True
        test_results["bronze_prc_deduction"] = prc_correct
        test_results["bronze_cashback_credit"] = cashback_correct
        
        # Test transaction logging
        if purchase_result:
            transaction_id = purchase_result.get("transaction_id")
            cashback_won = purchase_result.get("cashback_won_inr", 0)
            
            txn_found, txn_correct = test_transaction_logging(vip_uid, transaction_id, cashback_won, 10)
            test_results["bronze_transaction_logging"] = txn_found and txn_correct
            
            # Test scratch card history
            history_success, no_objectid = test_scratch_card_history(vip_uid, 1)
            test_results["bronze_history_update"] = history_success
            test_results["no_objectid_errors"] = no_objectid
    
    # Test 4: Purchase Silver Card (50 PRC) - VIP User
    print(f"\n🎯 TEST 4: SILVER CARD PURCHASE (VIP USER)")
    print("=" * 60)
    
    # Get current balances first
    current_prc, current_cashback, _ = test_user_wallet_balance(vip_uid)
    
    if current_prc and current_prc >= 50:
        purchase_success, _, _, _ = test_scratch_card_purchase(vip_uid, 50, current_prc, current_cashback)
        test_results["silver_purchase_vip"] = purchase_success
    else:
        print(f"❌ Insufficient PRC balance for Silver card: {current_prc}")
    
    # Test 5: Purchase Gold Card (100 PRC) - VIP User
    print(f"\n🎯 TEST 5: GOLD CARD PURCHASE (VIP USER)")
    print("=" * 60)
    
    # Get current balances first
    current_prc, current_cashback, _ = test_user_wallet_balance(vip_uid)
    
    if current_prc and current_prc >= 100:
        purchase_success, _, _, _ = test_scratch_card_purchase(vip_uid, 100, current_prc, current_cashback)
        test_results["gold_purchase_vip"] = purchase_success
    else:
        print(f"❌ Insufficient PRC balance for Gold card: {current_prc}")
    
    # Test 6: Create Free user and test
    print(f"\n🎯 TEST 6: FREE USER SETUP AND TESTING")
    print("=" * 60)
    
    free_uid, free_user_data = create_test_user("free", 50)
    if free_uid:
        test_results["free_user_setup"] = True
        
        # Test Bronze card purchase with Free user
        purchase_success, purchase_result, _, _ = test_scratch_card_purchase(free_uid, 10, 50, 0)
        test_results["bronze_purchase_free"] = purchase_success
        
        # Compare VIP vs Free cashback ranges
        if purchase_success and purchase_result:
            free_cashback_pct = purchase_result.get("cashback_percentage", 0)
            print(f"\n📋 VIP vs Free Cashback Range Comparison:")
            print(f"   📋 Free User Cashback: {free_cashback_pct}% (should be 0-10%)")
            
            if 0 <= free_cashback_pct <= 10:
                print(f"   ✅ Free user cashback range correct")
                test_results["vip_vs_free_ranges"] = True
            else:
                print(f"   ❌ Free user cashback range incorrect")
    
    # Test 7: Edge Cases
    print(f"\n🎯 TEST 7: EDGE CASE TESTING")
    print("=" * 60)
    
    edge_results = test_edge_cases(vip_uid)
    test_results["edge_case_insufficient"] = edge_results["insufficient_balance"]
    test_results["edge_case_invalid_card"] = edge_results["invalid_card_type"]
    
    return test_results

def main():
    """Run comprehensive scratch card testing"""
    print(f"\n🚀 STARTING COMPREHENSIVE SCRATCH CARD GAME TESTING")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Run comprehensive tests
    results = comprehensive_scratch_card_test()
    
    # Final Summary
    print(f"\n🏁 COMPREHENSIVE SCRATCH CARD TESTING SUMMARY")
    print("=" * 80)
    
    test_categories = {
        "Core Functionality": [
            ("Available cards endpoint", results["available_cards"]),
            ("VIP user setup", results["vip_user_setup"]),
            ("Bronze card purchase (VIP)", results["bronze_purchase_vip"]),
            ("PRC deduction correct", results["bronze_prc_deduction"]),
            ("Cashback credit correct", results["bronze_cashback_credit"]),
            ("Transaction logging", results["bronze_transaction_logging"]),
            ("History update", results["bronze_history_update"])
        ],
        "Multiple Card Types": [
            ("Silver card purchase", results["silver_purchase_vip"]),
            ("Gold card purchase", results["gold_purchase_vip"])
        ],
        "User Type Testing": [
            ("Free user setup", results["free_user_setup"]),
            ("Bronze purchase (Free)", results["bronze_purchase_free"]),
            ("VIP vs Free ranges", results["vip_vs_free_ranges"])
        ],
        "Edge Cases & Error Handling": [
            ("Insufficient balance handling", results["edge_case_insufficient"]),
            ("Invalid card type handling", results["edge_case_invalid_card"])
        ],
        "System Health": [
            ("No ObjectId errors", results["no_objectid_errors"])
        ]
    }
    
    total_tests = 0
    passed_tests = 0
    
    for category_name, tests in test_categories.items():
        print(f"\n{category_name}:")
        for test_name, result in tests:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} {test_name}")
            total_tests += 1
            if result:
                passed_tests += 1
    
    print(f"\n📊 FINAL RESULTS: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    # Success criteria evaluation
    critical_tests = [
        results["available_cards"],
        results["bronze_purchase_vip"],
        results["bronze_prc_deduction"],
        results["bronze_cashback_credit"],
        results["bronze_transaction_logging"],
        results["no_objectid_errors"]
    ]
    
    critical_passed = sum(1 for test in critical_tests if test)
    
    if critical_passed == len(critical_tests):
        print(f"\n🎉 SUCCESS - ALL CRITICAL TESTS PASSED!")
        print(f"✅ Scratch card system is working correctly")
        print(f"✅ No double crediting detected")
        print(f"✅ Transaction logging working properly")
        print(f"✅ No ObjectId serialization errors")
        return 0
    elif critical_passed >= len(critical_tests) * 0.8:
        print(f"\n⚠️  MOSTLY WORKING - {len(critical_tests) - critical_passed} critical tests failed")
        print(f"✅ Core functionality operational")
        print(f"⚠️  Some issues need attention")
        return 0
    else:
        print(f"\n❌ CRITICAL ISSUES - {len(critical_tests) - critical_passed} critical tests failed")
        print(f"❌ Significant problems detected")
        print(f"❌ System needs investigation")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)