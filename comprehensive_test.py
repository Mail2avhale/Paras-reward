#!/usr/bin/env python3
"""
COMPREHENSIVE BACKEND TESTING - PRC ANALYTICS & SCRATCH CARD DOUBLE CREDITING

This test covers the critical functionalities mentioned in the review request:

TEST SCENARIO 1: PRC Analytics Dashboard
- GET /api/admin/prc-analytics
- Verify comprehensive PRC statistics
- Check all required fields and data structure

TEST SCENARIO 2: Scratch Card Double Crediting Bug Check
- Create VIP user with sufficient PRC balance
- Purchase Bronze scratch card (10 PRC cost)
- Verify cashback is credited ONLY ONCE (not twice)
- Check transaction logs for duplicate crediting
- Verify wallet balance is correctly updated

TEST SCENARIO 3: Scratch Card History Endpoint
- GET /api/scratch-cards/history/{uid}
- Verify no ObjectId serialization errors
- Check response structure and stats

Expected Success Criteria:
1. PRC Analytics endpoint returns valid data without errors
2. Scratch card purchase credits cashback EXACTLY ONCE (no double crediting)
3. Transaction logs show single entry for each scratch card reward
4. History endpoint works without ObjectId errors
5. All balance calculations are accurate
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

print(f"🧪 COMPREHENSIVE BACKEND TESTING - PRC ANALYTICS & SCRATCH CARD SYSTEM")
print(f"Backend URL: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def test_prc_analytics_dashboard():
    """
    TEST SCENARIO 1: PRC Analytics Dashboard
    Verify GET /api/admin/prc-analytics returns comprehensive statistics
    """
    print(f"\n📊 TEST SCENARIO 1: PRC Analytics Dashboard")
    print("=" * 60)
    
    test_results = {
        "endpoint_accessible": False,
        "returns_valid_json": False,
        "has_total_prc_mined": False,
        "has_total_prc_consumed": False,
        "has_total_prc_in_circulation": False,
        "has_consumption_rate": False,
        "has_consumption_breakdown": False,
        "has_timeline_data": False,
        "has_user_statistics": False,
        "numeric_values_rounded": False,
        "timeline_structure_correct": False
    }
    
    try:
        print(f"📋 Testing GET /api/admin/prc-analytics...")
        response = requests.get(f"{API_BASE}/admin/prc-analytics", timeout=30)
        
        if response.status_code == 200:
            test_results["endpoint_accessible"] = True
            print(f"✅ Endpoint accessible (200 OK)")
            
            try:
                data = response.json()
                test_results["returns_valid_json"] = True
                print(f"✅ Returns valid JSON")
                
                # Check required fields
                required_fields = [
                    "total_prc_mined", "total_prc_consumed", "total_prc_in_circulation",
                    "consumption_rate", "consumption_breakdown", "timeline_data",
                    "total_users", "vip_users", "avg_prc_per_user"
                ]
                
                for field in required_fields:
                    if field in data:
                        test_results[f"has_{field}"] = True
                        print(f"✅ Has {field}: {data[field]}")
                    else:
                        print(f"❌ Missing {field}")
                
                # Check consumption breakdown structure
                if "consumption_breakdown" in data:
                    breakdown = data["consumption_breakdown"]
                    expected_breakdown_fields = ["marketplace", "treasure_hunt", "scratch_cards", "vip_memberships"]
                    breakdown_complete = all(field in breakdown for field in expected_breakdown_fields)
                    if breakdown_complete:
                        print(f"✅ Consumption breakdown complete: {breakdown}")
                    else:
                        print(f"❌ Consumption breakdown incomplete: {breakdown}")
                
                # Check timeline data structure
                if "timeline_data" in data and isinstance(data["timeline_data"], list):
                    timeline = data["timeline_data"]
                    if timeline and len(timeline) > 0:
                        sample_entry = timeline[0]
                        if all(field in sample_entry for field in ["date", "mined", "consumed"]):
                            test_results["timeline_structure_correct"] = True
                            print(f"✅ Timeline data structure correct (sample: {sample_entry})")
                            print(f"   📋 Timeline entries: {len(timeline)}")
                        else:
                            print(f"❌ Timeline data structure incorrect: {sample_entry}")
                    else:
                        print(f"⚠️  Timeline data empty")
                
                # Check numeric values are properly rounded
                numeric_fields = ["total_prc_mined", "total_prc_consumed", "total_prc_in_circulation", "consumption_rate", "avg_prc_per_user"]
                all_rounded = True
                for field in numeric_fields:
                    if field in data:
                        value = data[field]
                        if isinstance(value, float):
                            # Check if rounded to 2 decimal places
                            if round(value, 2) == value:
                                continue
                            else:
                                all_rounded = False
                                print(f"❌ {field} not properly rounded: {value}")
                        
                if all_rounded:
                    test_results["numeric_values_rounded"] = True
                    print(f"✅ All numeric values properly rounded")
                
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON response: {e}")
                
        else:
            print(f"❌ Endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing PRC analytics: {e}")
    
    return test_results

def test_scratch_card_double_crediting():
    """
    TEST SCENARIO 2: Scratch Card Double Crediting Bug Check
    Create VIP user, purchase Bronze card, verify cashback credited only once
    """
    print(f"\n🎰 TEST SCENARIO 2: Scratch Card Double Crediting Bug Check")
    print("=" * 60)
    
    test_results = {
        "vip_user_created": False,
        "initial_balance_correct": False,
        "purchase_successful": False,
        "cashback_credited_once": False,
        "wallet_balance_correct": False,
        "transaction_logged_once": False,
        "no_duplicate_transactions": False,
        "balance_calculation_accurate": False
    }
    
    # Create VIP test user
    timestamp = int(time.time())
    test_user_data = {
        "first_name": "VIPTest",
        "last_name": "DoubleCredit",
        "email": f"vip_double_test_{timestamp}@test.com",
        "mobile": f"9876543{timestamp % 1000:03d}",
        "password": "secure123456",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{timestamp % 100000000:08d}",
        "pan_number": f"VTEST{timestamp % 10000:04d}T",
        "membership_type": "vip",
        "kyc_status": "verified",
        "prc_balance": 100.0,  # Sufficient for Bronze card (10 PRC)
        "cashback_wallet_balance": 0.0  # Start with zero cashback
    }
    
    test_uid = None
    
    try:
        print(f"📋 Creating VIP test user...")
        response = requests.post(f"{API_BASE}/auth/register", json=test_user_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_uid = result.get("uid")
            test_results["vip_user_created"] = True
            print(f"✅ VIP user created: {test_uid}")
            print(f"   📋 Name: {test_user_data['first_name']} {test_user_data['last_name']}")
            print(f"   📋 Initial PRC Balance: {test_user_data['prc_balance']}")
            print(f"   📋 Initial Cashback Balance: ₹{test_user_data['cashback_wallet_balance']}")
        else:
            print(f"❌ VIP user creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return test_results
            
    except Exception as e:
        print(f"❌ Error creating VIP user: {e}")
        return test_results
    
    # Get initial wallet balance
    initial_prc_balance = 0
    initial_cashback_balance = 0
    
    try:
        print(f"\n📋 Getting initial wallet balance...")
        response = requests.get(f"{API_BASE}/wallet/{test_uid}", timeout=30)
        if response.status_code == 200:
            wallet_data = response.json()
            initial_prc_balance = wallet_data.get("prc_balance", 0)
            initial_cashback_balance = wallet_data.get("cashback_balance", 0)
            
            if initial_prc_balance >= 100 and initial_cashback_balance == 0:
                test_results["initial_balance_correct"] = True
                print(f"✅ Initial balances correct")
                print(f"   📋 PRC Balance: {initial_prc_balance}")
                print(f"   📋 Cashback Balance: ₹{initial_cashback_balance}")
            else:
                print(f"❌ Initial balances incorrect")
                print(f"   📋 PRC Balance: {initial_prc_balance} (expected ≥100)")
                print(f"   📋 Cashback Balance: ₹{initial_cashback_balance} (expected 0)")
        else:
            print(f"❌ Failed to get initial wallet balance: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error getting initial wallet balance: {e}")
    
    # Purchase Bronze scratch card (10 PRC)
    transaction_id = None
    cashback_won = 0
    
    try:
        print(f"\n📋 Purchasing Bronze scratch card (10 PRC)...")
        purchase_data = {"card_type": 10}
        response = requests.post(f"{API_BASE}/scratch-cards/purchase?uid={test_uid}", json=purchase_data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            transaction_id = result.get("transaction_id")
            cashback_won = result.get("cashback_won_inr", 0)
            new_prc_balance = result.get("new_prc_balance", 0)
            new_cashback_balance = result.get("new_cashback_wallet", 0)
            
            test_results["purchase_successful"] = True
            print(f"✅ Purchase successful")
            print(f"   📋 Transaction ID: {transaction_id}")
            print(f"   📋 Cashback Won: ₹{cashback_won}")
            print(f"   📋 Cashback Percentage: {result.get('cashback_percentage')}%")
            print(f"   📋 New PRC Balance: {new_prc_balance}")
            print(f"   📋 New Cashback Balance: ₹{new_cashback_balance}")
            
            # Verify PRC deduction is correct
            expected_prc_after = initial_prc_balance - 10
            if abs(new_prc_balance - expected_prc_after) < 0.01:
                print(f"✅ PRC deduction correct: {initial_prc_balance} - 10 = {new_prc_balance}")
            else:
                print(f"❌ PRC deduction incorrect: Expected {expected_prc_after}, got {new_prc_balance}")
            
            # Verify cashback credit is correct
            expected_cashback_after = initial_cashback_balance + cashback_won
            if abs(new_cashback_balance - expected_cashback_after) < 0.01:
                test_results["cashback_credited_once"] = True
                print(f"✅ Cashback credit appears correct: ₹{initial_cashback_balance} + ₹{cashback_won} = ₹{new_cashback_balance}")
            else:
                print(f"❌ Cashback credit incorrect: Expected ₹{expected_cashback_after}, got ₹{new_cashback_balance}")
                
        else:
            print(f"❌ Purchase failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return test_results
            
    except Exception as e:
        print(f"❌ Error purchasing scratch card: {e}")
        return test_results
    
    # Verify wallet balance after purchase (double-check for double crediting)
    try:
        print(f"\n📋 Verifying wallet balance after purchase...")
        response = requests.get(f"{API_BASE}/wallet/{test_uid}", timeout=30)
        if response.status_code == 200:
            wallet_data = response.json()
            actual_prc_balance = wallet_data.get("prc_balance", 0)
            actual_cashback_balance = wallet_data.get("cashback_balance", 0)
            
            print(f"   📋 Actual PRC Balance: {actual_prc_balance}")
            print(f"   📋 Actual Cashback Balance: ₹{actual_cashback_balance}")
            
            # Check if wallet balance matches the purchase response
            expected_prc = initial_prc_balance - 10
            expected_cashback = initial_cashback_balance + cashback_won
            
            prc_correct = abs(actual_prc_balance - expected_prc) < 0.01
            cashback_correct = abs(actual_cashback_balance - expected_cashback) < 0.01
            
            if prc_correct and cashback_correct:
                test_results["wallet_balance_correct"] = True
                test_results["balance_calculation_accurate"] = True
                print(f"✅ Wallet balance correct - no double crediting detected")
                print(f"   📋 PRC: {initial_prc_balance} - 10 = {actual_prc_balance} ✓")
                print(f"   📋 Cashback: ₹{initial_cashback_balance} + ₹{cashback_won} = ₹{actual_cashback_balance} ✓")
            else:
                print(f"❌ Wallet balance incorrect - possible double crediting")
                print(f"   📋 PRC: Expected {expected_prc}, got {actual_prc_balance}")
                print(f"   📋 Cashback: Expected ₹{expected_cashback}, got ₹{actual_cashback_balance}")
                
                # Check for double crediting specifically
                double_credit_amount = initial_cashback_balance + (2 * cashback_won)
                if abs(actual_cashback_balance - double_credit_amount) < 0.01:
                    print(f"🚨 DOUBLE CREDITING DETECTED: Balance suggests cashback was credited twice!")
                    print(f"   📋 Double credit calculation: ₹{initial_cashback_balance} + 2×₹{cashback_won} = ₹{double_credit_amount}")
        else:
            print(f"❌ Failed to verify wallet balance: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error verifying wallet balance: {e}")
    
    # Check transaction logs for duplicates
    try:
        print(f"\n📋 Checking transaction logs for duplicates...")
        response = requests.get(f"{API_BASE}/wallet/transactions/{test_uid}", timeout=30)
        if response.status_code == 200:
            result = response.json()
            transactions = result.get("transactions", [])
            
            # Filter for scratch card reward transactions
            scratch_card_transactions = [
                t for t in transactions 
                if t.get("type") == "scratch_card_reward" and t.get("transaction_id") == transaction_id
            ]
            
            print(f"   📋 Total transactions: {len(transactions)}")
            print(f"   📋 Scratch card reward transactions with this ID: {len(scratch_card_transactions)}")
            
            if len(scratch_card_transactions) == 1:
                test_results["transaction_logged_once"] = True
                test_results["no_duplicate_transactions"] = True
                print(f"✅ Transaction logged exactly once - no duplicates")
                
                # Verify transaction details
                txn = scratch_card_transactions[0]
                print(f"   📋 Transaction Amount: ₹{txn.get('amount')}")
                print(f"   📋 Transaction Description: {txn.get('description')}")
                print(f"   📋 Wallet Type: {txn.get('wallet_type')}")
                
                # Check metadata
                metadata = txn.get("metadata", {})
                if metadata.get("card_type") == 10 and "cashback_percentage" in metadata:
                    print(f"   📋 Metadata correct: Card Type {metadata.get('card_type')}, Cashback {metadata.get('cashback_percentage')}%")
                else:
                    print(f"   ⚠️  Metadata incomplete: {metadata}")
                    
            elif len(scratch_card_transactions) > 1:
                print(f"🚨 DUPLICATE TRANSACTIONS DETECTED: {len(scratch_card_transactions)} transactions with same ID")
                for i, txn in enumerate(scratch_card_transactions):
                    print(f"   📋 Transaction {i+1}: Amount ₹{txn.get('amount')}, Time {txn.get('created_at')}")
            else:
                print(f"❌ No scratch card reward transaction found with ID {transaction_id}")
                
        else:
            print(f"❌ Failed to get transaction logs: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error checking transaction logs: {e}")
    
    return test_results

def test_scratch_card_history():
    """
    TEST SCENARIO 3: Scratch Card History Endpoint
    Verify GET /api/scratch-cards/history/{uid} works without ObjectId errors
    """
    print(f"\n📜 TEST SCENARIO 3: Scratch Card History Endpoint")
    print("=" * 60)
    
    test_results = {
        "endpoint_accessible": False,
        "no_objectid_errors": False,
        "returns_valid_json": False,
        "has_history_array": False,
        "has_stats_object": False,
        "stats_structure_correct": False,
        "no_500_errors": False
    }
    
    # Create a test user for history testing
    timestamp = int(time.time())
    test_user_data = {
        "first_name": "HistoryTest",
        "last_name": "User",
        "email": f"history_test_{timestamp}@test.com",
        "mobile": f"9876543{timestamp % 1000:03d}",
        "password": "secure123456",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{timestamp % 100000000:08d}",
        "pan_number": f"HTEST{timestamp % 10000:04d}T",
        "membership_type": "vip",
        "kyc_status": "verified",
        "prc_balance": 50.0,
        "cashback_wallet_balance": 0.0
    }
    
    test_uid = None
    
    try:
        print(f"📋 Creating test user for history testing...")
        response = requests.post(f"{API_BASE}/auth/register", json=test_user_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_uid = result.get("uid")
            print(f"✅ Test user created: {test_uid}")
        else:
            print(f"❌ Test user creation failed: {response.status_code}")
            return test_results
            
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        return test_results
    
    # Test history endpoint
    try:
        print(f"\n📋 Testing GET /api/scratch-cards/history/{test_uid}...")
        response = requests.get(f"{API_BASE}/scratch-cards/history/{test_uid}", timeout=30)
        
        if response.status_code == 200:
            test_results["endpoint_accessible"] = True
            test_results["no_500_errors"] = True
            test_results["no_objectid_errors"] = True
            print(f"✅ Endpoint accessible (200 OK) - no 500 errors")
            
            try:
                data = response.json()
                test_results["returns_valid_json"] = True
                print(f"✅ Returns valid JSON - no ObjectId serialization errors")
                
                # Check response structure
                if "history" in data and isinstance(data["history"], list):
                    test_results["has_history_array"] = True
                    print(f"✅ Has history array: {len(data['history'])} records")
                else:
                    print(f"❌ Missing or invalid history array")
                
                if "stats" in data and isinstance(data["stats"], dict):
                    test_results["has_stats_object"] = True
                    print(f"✅ Has stats object")
                    
                    # Check stats structure
                    stats = data["stats"]
                    expected_stats_fields = ["total_cards_played", "total_prc_spent", "total_cashback_won"]
                    if all(field in stats for field in expected_stats_fields):
                        test_results["stats_structure_correct"] = True
                        print(f"✅ Stats structure correct:")
                        for field in expected_stats_fields:
                            print(f"   📋 {field}: {stats[field]}")
                    else:
                        print(f"❌ Stats structure incomplete: {stats}")
                else:
                    print(f"❌ Missing or invalid stats object")
                
                # Check for _id fields in history records (should not be present)
                history = data.get("history", [])
                if history:
                    has_id_fields = any("_id" in record for record in history)
                    if not has_id_fields:
                        print(f"✅ No _id fields in history records - ObjectId exclusion working")
                    else:
                        print(f"❌ _id fields found in history records - ObjectId exclusion not working")
                        test_results["no_objectid_errors"] = False
                
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON response: {e}")
                test_results["no_objectid_errors"] = False
                
        elif response.status_code == 500:
            print(f"❌ 500 Internal Server Error - likely ObjectId serialization issue")
            print(f"   Response: {response.text}")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing scratch card history: {e}")
    
    return test_results

def main():
    """Run comprehensive backend testing"""
    print(f"\n🚀 STARTING COMPREHENSIVE BACKEND TESTING")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    all_results = {}
    
    # Test Scenario 1: PRC Analytics Dashboard
    print(f"\n" + "="*80)
    analytics_results = test_prc_analytics_dashboard()
    all_results["prc_analytics"] = analytics_results
    
    # Test Scenario 2: Scratch Card Double Crediting
    print(f"\n" + "="*80)
    double_credit_results = test_scratch_card_double_crediting()
    all_results["double_crediting"] = double_credit_results
    
    # Test Scenario 3: Scratch Card History
    print(f"\n" + "="*80)
    history_results = test_scratch_card_history()
    all_results["scratch_card_history"] = history_results
    
    # Final Summary
    print(f"\n🏁 COMPREHENSIVE TESTING SUMMARY")
    print("=" * 80)
    
    test_categories = {
        "PRC Analytics Dashboard": analytics_results,
        "Scratch Card Double Crediting": double_credit_results,
        "Scratch Card History": history_results
    }
    
    total_tests = 0
    passed_tests = 0
    critical_failures = []
    
    for category_name, results in test_categories.items():
        print(f"\n{category_name}:")
        category_passed = 0
        category_total = 0
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} {test_name}")
            category_total += 1
            total_tests += 1
            if result:
                category_passed += 1
                passed_tests += 1
            else:
                # Identify critical failures
                if test_name in ["cashback_credited_once", "no_duplicate_transactions", "no_objectid_errors", "endpoint_accessible"]:
                    critical_failures.append(f"{category_name}: {test_name}")
        
        print(f"  📊 Category Result: {category_passed}/{category_total} ({(category_passed/category_total)*100:.1f}%)")
    
    print(f"\n📊 OVERALL RESULTS: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    # Critical failure analysis
    if critical_failures:
        print(f"\n🚨 CRITICAL FAILURES DETECTED:")
        for failure in critical_failures:
            print(f"  ❌ {failure}")
    
    # Final assessment
    if passed_tests == total_tests:
        print(f"\n🎉 ALL TESTS PASSED - SYSTEM FULLY FUNCTIONAL!")
        print(f"✅ PRC Analytics Dashboard working correctly")
        print(f"✅ No double crediting bug detected in scratch card system")
        print(f"✅ Scratch card history endpoint working without ObjectId errors")
        return 0
    elif len(critical_failures) == 0 and passed_tests >= total_tests * 0.8:
        print(f"\n✅ MOSTLY WORKING - {total_tests - passed_tests} minor issues")
        print(f"✅ No critical failures detected")
        print(f"⚠️  Some minor issues need attention")
        return 0
    else:
        print(f"\n❌ CRITICAL ISSUES DETECTED - {len(critical_failures)} critical failures")
        print(f"❌ System needs immediate attention")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)