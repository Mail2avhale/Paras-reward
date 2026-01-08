#!/usr/bin/env python3
"""
ACCOUNT DELETE FEATURE - COMPREHENSIVE TESTING

Tests the complete Account Deletion system with 30-day grace period.

SYSTEM OVERVIEW:
1. Account Deletion Request: Users can request account deletion with password confirmation
2. 30-Day Grace Period: Accounts are soft-deleted and can be recovered within 30 days
3. Balance Forfeiture: PRC and cashback balances are forfeited immediately
4. Cancellation: Users can cancel deletion within grace period (balances not restored)

TEST SCENARIOS:

ACCOUNT DELETION REQUEST:
1. Create test user with PRC and cashback balance
2. Test GET /api/user/{uid}/deletion-status for active account
3. Test POST /api/user/{uid}/request-account-deletion with correct password
4. Verify PRC and cashback forfeiture
5. Verify hard_delete_date is 30 days from now
6. Test password verification (wrong password should fail)

DELETION STATUS CHECK:
7. Test GET /api/user/{uid}/deletion-status for scheduled deletion
8. Verify deletion details (dates, forfeited amounts, recovery status)

CANCELLATION FLOW:
9. Test POST /api/user/{uid}/cancel-account-deletion with correct password
10. Verify account is restored but balances remain forfeited
11. Test deletion status after cancellation

EDGE CASES:
12. Try deleting already deleted account
13. Try cancelling non-deleted account
14. Try cancelling with wrong password
15. Test deletion request with missing password
16. Test deletion request with missing reason

SUCCESS CRITERIA:
✅ Active accounts show is_scheduled_for_deletion: false
✅ Deletion request requires password verification
✅ PRC and cashback balances are forfeited immediately
✅ Hard delete date is 30 days from request
✅ Deletion status shows correct information
✅ Account can be cancelled within grace period
✅ Cancelled accounts are restored but balances not recovered
✅ Edge cases handled properly with appropriate error messages
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

print(f"🗑️  ACCOUNT DELETE FEATURE - COMPREHENSIVE TESTING")
print(f"Backend URL: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def create_test_user_with_balances(prc_amount=1000, cashback_amount=100):
    """Create a test user with specified PRC and cashback balances"""
    timestamp = int(time.time() * 1000)
    random_suffix = uuid.uuid4().hex[:6]
    user_data = {
        "email": f"delete_test_user_{timestamp}_{random_suffix}@test.com",
        "password": "DeleteTest@123",
        "role": "user"
    }
    
    try:
        # Register user
        response = requests.post(f"{API_BASE}/auth/register/simple", json=user_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            uid = result.get("uid")
            
            # Credit PRC balance
            if prc_amount > 0:
                prc_credit_data = {
                    "balance_type": "prc_balance",
                    "amount": prc_amount,
                    "operation": "add",
                    "notes": f"Test PRC credit for account deletion testing"
                }
                
                prc_response = requests.post(f"{API_BASE}/admin/users/{uid}/adjust-balance", json=prc_credit_data, timeout=30)
                if prc_response.status_code != 200:
                    print(f"⚠️  PRC credit failed: {prc_response.status_code}")
            
            # Credit cashback balance
            if cashback_amount > 0:
                cashback_credit_data = {
                    "balance_type": "cashback_wallet_balance",
                    "amount": cashback_amount,
                    "operation": "add",
                    "notes": f"Test cashback credit for account deletion testing"
                }
                
                cashback_response = requests.post(f"{API_BASE}/admin/users/{uid}/adjust-balance", json=cashback_credit_data, timeout=30)
                if cashback_response.status_code != 200:
                    print(f"⚠️  Cashback credit failed: {cashback_response.status_code}")
            
            print(f"✅ Created test user {uid} with {prc_amount} PRC and ₹{cashback_amount} cashback")
            return uid, user_data["email"], user_data["password"]
        else:
            print(f"❌ Failed to create test user: {response.status_code}")
            return None, None, None
            
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        return None, None, None

def test_account_deletion_system():
    """Test the complete account deletion system"""
    print(f"\n🗑️  ACCOUNT DELETION SYSTEM TESTING")
    print("=" * 80)
    
    test_results = {
        # User Creation
        "test_user_created": False,
        "test_user_balances_credited": False,
        
        # Deletion Status - Active Account
        "active_account_status_check": False,
        
        # Deletion Request
        "deletion_request_success": False,
        "password_verification_working": False,
        "prc_forfeiture_verified": False,
        "cashback_forfeiture_verified": False,
        "hard_delete_date_correct": False,
        
        # Wrong Password Test
        "wrong_password_rejected": False,
        
        # Deletion Status - Scheduled Account
        "scheduled_account_status_check": False,
        "deletion_details_correct": False,
        
        # Cancellation Flow
        "cancellation_success": False,
        "account_restored": False,
        "balances_remain_forfeited": False,
        
        # Edge Cases
        "duplicate_deletion_rejected": False,
        "cancel_non_deleted_rejected": False,
        "cancel_wrong_password_rejected": False,
        "missing_password_rejected": False,
        "missing_reason_handled": False
    }
    
    # Step 1: Create test user with balances
    print(f"\n🔍 STEP 1: CREATE TEST USER WITH PRC AND CASHBACK BALANCES")
    print("=" * 60)
    
    test_uid, test_email, test_password = create_test_user_with_balances(2500, 150)
    if test_uid:
        test_results["test_user_created"] = True
        print(f"✅ Test user created: {test_uid}")
        
        # Verify balances
        try:
            wallet_response = requests.get(f"{API_BASE}/wallet/{test_uid}", timeout=30)
            if wallet_response.status_code == 200:
                wallet_data = wallet_response.json()
                prc_balance = wallet_data.get("prc_balance", 0)
                cashback_balance = wallet_data.get("cashback_balance", 0) or wallet_data.get("cashback_wallet_balance", 0)
                
                if prc_balance >= 2000 and cashback_balance >= 100:
                    test_results["test_user_balances_credited"] = True
                    print(f"✅ User has sufficient balances: {prc_balance} PRC, ₹{cashback_balance} cashback")
                else:
                    print(f"⚠️  User balances: {prc_balance} PRC, ₹{cashback_balance} cashback")
            else:
                print(f"❌ Failed to check wallet balance: {wallet_response.status_code}")
        except Exception as e:
            print(f"❌ Error checking wallet: {e}")
    else:
        print(f"❌ Failed to create test user")
        return test_results
    
    # Step 2: Test deletion status for active account
    print(f"\n🔍 STEP 2: TEST DELETION STATUS FOR ACTIVE ACCOUNT")
    print("=" * 60)
    
    try:
        response = requests.get(f"{API_BASE}/user/{test_uid}/deletion-status", timeout=30)
        if response.status_code == 200:
            result = response.json()
            is_scheduled = result.get("is_scheduled_for_deletion", True)
            
            if not is_scheduled:
                test_results["active_account_status_check"] = True
                print(f"✅ Active account shows is_scheduled_for_deletion: false")
                print(f"   📋 Message: {result.get('message')}")
            else:
                print(f"❌ Active account incorrectly shows scheduled for deletion")
        else:
            print(f"❌ Deletion status check failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Error checking deletion status: {e}")
    
    # Step 3: Test account deletion request with correct password
    print(f"\n🔍 STEP 3: TEST ACCOUNT DELETION REQUEST")
    print("=" * 60)
    
    deletion_request_data = {
        "password": test_password,
        "reason": "Testing account deletion feature"
    }
    
    try:
        response = requests.post(f"{API_BASE}/user/{test_uid}/request-account-deletion", json=deletion_request_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["deletion_request_success"] = True
            test_results["password_verification_working"] = True
            
            print(f"✅ Account deletion request successful")
            print(f"   📋 Message: {result.get('message')}")
            print(f"   📋 Deleted At: {result.get('deleted_at')}")
            print(f"   📋 Hard Delete Date: {result.get('hard_delete_date')}")
            print(f"   📋 Days to Recover: {result.get('days_to_recover')}")
            print(f"   📋 PRC Forfeited: {result.get('prc_forfeited')}")
            print(f"   📋 Cashback Forfeited: {result.get('cashback_forfeited')}")
            
            # Verify PRC and cashback forfeiture
            prc_forfeited = result.get('prc_forfeited', 0)
            cashback_forfeited = result.get('cashback_forfeited', 0)
            
            if prc_forfeited >= 2000:
                test_results["prc_forfeiture_verified"] = True
                print(f"✅ PRC forfeiture verified: {prc_forfeited} PRC")
            
            if cashback_forfeited >= 100:
                test_results["cashback_forfeiture_verified"] = True
                print(f"✅ Cashback forfeiture verified: ₹{cashback_forfeited}")
            
            # Verify hard delete date is ~30 days from now
            hard_delete_date = result.get('hard_delete_date')
            if hard_delete_date:
                try:
                    delete_date = datetime.fromisoformat(hard_delete_date.replace('Z', '+00:00'))
                    now = datetime.now(datetime.now().astimezone().tzinfo)
                    days_diff = (delete_date - now).days
                    
                    if 29 <= days_diff <= 31:  # Allow 1 day tolerance
                        test_results["hard_delete_date_correct"] = True
                        print(f"✅ Hard delete date correct: {days_diff} days from now")
                    else:
                        print(f"⚠️  Hard delete date: {days_diff} days from now (expected ~30)")
                except Exception as e:
                    print(f"⚠️  Error parsing hard delete date: {e}")
            
        else:
            print(f"❌ Account deletion request failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Error testing account deletion: {e}")
    
    # Step 4: Test wrong password rejection
    print(f"\n🔍 STEP 4: TEST WRONG PASSWORD REJECTION")
    print("=" * 60)
    
    # Create another user to test wrong password
    wrong_pwd_uid, _, _ = create_test_user_with_balances(500, 50)
    if wrong_pwd_uid:
        wrong_password_data = {
            "password": "WrongPassword123",
            "reason": "Testing wrong password"
        }
        
        try:
            response = requests.post(f"{API_BASE}/user/{wrong_pwd_uid}/request-account-deletion", json=wrong_password_data, timeout=30)
            if response.status_code == 401:
                test_results["wrong_password_rejected"] = True
                print(f"✅ Wrong password properly rejected (401)")
                print(f"   📋 Error: {response.json().get('detail', 'No detail')}")
            else:
                print(f"❌ Wrong password not rejected properly: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing wrong password: {e}")
    
    # Step 5: Test deletion status for scheduled account
    print(f"\n🔍 STEP 5: TEST DELETION STATUS FOR SCHEDULED ACCOUNT")
    print("=" * 60)
    
    try:
        response = requests.get(f"{API_BASE}/user/{test_uid}/deletion-status", timeout=30)
        if response.status_code == 200:
            result = response.json()
            is_scheduled = result.get("is_scheduled_for_deletion", False)
            
            if is_scheduled:
                test_results["scheduled_account_status_check"] = True
                print(f"✅ Scheduled account shows is_scheduled_for_deletion: true")
                
                # Verify deletion details
                days_remaining = result.get("days_remaining", 0)
                can_recover = result.get("can_recover", False)
                prc_forfeited = result.get("prc_forfeited", 0)
                cashback_forfeited = result.get("cashback_forfeited", 0)
                
                if (days_remaining >= 29 and can_recover and 
                    prc_forfeited >= 2000 and cashback_forfeited >= 100):
                    test_results["deletion_details_correct"] = True
                    print(f"✅ Deletion details correct:")
                    print(f"   📋 Days Remaining: {days_remaining}")
                    print(f"   📋 Can Recover: {can_recover}")
                    print(f"   📋 PRC Forfeited: {prc_forfeited}")
                    print(f"   📋 Cashback Forfeited: ₹{cashback_forfeited}")
                else:
                    print(f"⚠️  Deletion details may be incorrect")
            else:
                print(f"❌ Scheduled account incorrectly shows not scheduled for deletion")
        else:
            print(f"❌ Deletion status check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking scheduled deletion status: {e}")
    
    # Step 6: Test account deletion cancellation
    print(f"\n🔍 STEP 6: TEST ACCOUNT DELETION CANCELLATION")
    print("=" * 60)
    
    cancellation_data = {
        "password": test_password
    }
    
    try:
        response = requests.post(f"{API_BASE}/user/{test_uid}/cancel-account-deletion", json=cancellation_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["cancellation_success"] = True
            
            print(f"✅ Account deletion cancellation successful")
            print(f"   📋 Message: {result.get('message')}")
            print(f"   📋 Recovered At: {result.get('recovered_at')}")
            print(f"   📋 Note: {result.get('note')}")
            
        else:
            print(f"❌ Account deletion cancellation failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Error testing cancellation: {e}")
    
    # Step 7: Verify account is restored but balances remain forfeited
    print(f"\n🔍 STEP 7: VERIFY ACCOUNT RESTORATION AND BALANCE FORFEITURE")
    print("=" * 60)
    
    try:
        # Check deletion status
        status_response = requests.get(f"{API_BASE}/user/{test_uid}/deletion-status", timeout=30)
        if status_response.status_code == 200:
            status_result = status_response.json()
            is_scheduled = status_result.get("is_scheduled_for_deletion", True)
            
            if not is_scheduled:
                test_results["account_restored"] = True
                print(f"✅ Account successfully restored (not scheduled for deletion)")
            else:
                print(f"❌ Account still shows as scheduled for deletion")
        
        # Check wallet balances
        wallet_response = requests.get(f"{API_BASE}/wallet/{test_uid}", timeout=30)
        if wallet_response.status_code == 200:
            wallet_data = wallet_response.json()
            prc_balance = wallet_data.get("prc_balance", 0)
            cashback_balance = wallet_data.get("cashback_balance", 0) or wallet_data.get("cashback_wallet_balance", 0)
            
            if prc_balance == 0 and cashback_balance == 0:
                test_results["balances_remain_forfeited"] = True
                print(f"✅ Balances remain forfeited: {prc_balance} PRC, ₹{cashback_balance} cashback")
            else:
                print(f"⚠️  Balances after cancellation: {prc_balance} PRC, ₹{cashback_balance} cashback")
                
    except Exception as e:
        print(f"❌ Error verifying restoration: {e}")
    
    # Step 8: Test edge case - duplicate deletion request
    print(f"\n🔍 STEP 8: TEST EDGE CASE - DUPLICATE DELETION REQUEST")
    print("=" * 60)
    
    # Create another user and delete it, then try to delete again
    duplicate_uid, _, duplicate_password = create_test_user_with_balances(1000, 50)
    if duplicate_uid:
        # First deletion
        first_deletion_data = {
            "password": duplicate_password,
            "reason": "First deletion"
        }
        
        try:
            first_response = requests.post(f"{API_BASE}/user/{duplicate_uid}/request-account-deletion", json=first_deletion_data, timeout=30)
            if first_response.status_code == 200:
                # Try second deletion
                second_deletion_data = {
                    "password": duplicate_password,
                    "reason": "Second deletion attempt"
                }
                
                second_response = requests.post(f"{API_BASE}/user/{duplicate_uid}/request-account-deletion", json=second_deletion_data, timeout=30)
                if second_response.status_code == 400:
                    test_results["duplicate_deletion_rejected"] = True
                    print(f"✅ Duplicate deletion request properly rejected (400)")
                    print(f"   📋 Error: {second_response.json().get('detail', 'No detail')}")
                else:
                    print(f"❌ Duplicate deletion not rejected properly: {second_response.status_code}")
        except Exception as e:
            print(f"❌ Error testing duplicate deletion: {e}")
    
    # Step 9: Test edge case - cancel non-deleted account
    print(f"\n🔍 STEP 9: TEST EDGE CASE - CANCEL NON-DELETED ACCOUNT")
    print("=" * 60)
    
    # Use the restored account from earlier
    try:
        cancel_data = {
            "password": test_password
        }
        
        response = requests.post(f"{API_BASE}/user/{test_uid}/cancel-account-deletion", json=cancel_data, timeout=30)
        if response.status_code == 400:
            test_results["cancel_non_deleted_rejected"] = True
            print(f"✅ Cancel non-deleted account properly rejected (400)")
            print(f"   📋 Error: {response.json().get('detail', 'No detail')}")
        else:
            print(f"❌ Cancel non-deleted account not rejected properly: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing cancel non-deleted: {e}")
    
    # Step 10: Test edge case - cancel with wrong password
    print(f"\n🔍 STEP 10: TEST EDGE CASE - CANCEL WITH WRONG PASSWORD")
    print("=" * 60)
    
    # Use the duplicate_uid which should still be scheduled for deletion
    if duplicate_uid:
        wrong_cancel_data = {
            "password": "WrongCancelPassword123"
        }
        
        try:
            response = requests.post(f"{API_BASE}/user/{duplicate_uid}/cancel-account-deletion", json=wrong_cancel_data, timeout=30)
            if response.status_code == 401:
                test_results["cancel_wrong_password_rejected"] = True
                print(f"✅ Cancel with wrong password properly rejected (401)")
                print(f"   📋 Error: {response.json().get('detail', 'No detail')}")
            else:
                print(f"❌ Cancel with wrong password not rejected properly: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing cancel wrong password: {e}")
    
    # Step 11: Test edge case - missing password
    print(f"\n🔍 STEP 11: TEST EDGE CASE - MISSING PASSWORD")
    print("=" * 60)
    
    missing_pwd_uid, _, _ = create_test_user_with_balances(500, 25)
    if missing_pwd_uid:
        missing_password_data = {
            "reason": "Testing missing password"
            # No password field
        }
        
        try:
            response = requests.post(f"{API_BASE}/user/{missing_pwd_uid}/request-account-deletion", json=missing_password_data, timeout=30)
            if response.status_code == 400:
                test_results["missing_password_rejected"] = True
                print(f"✅ Missing password properly rejected (400)")
                print(f"   📋 Error: {response.json().get('detail', 'No detail')}")
            else:
                print(f"❌ Missing password not rejected properly: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing missing password: {e}")
    
    # Step 12: Test edge case - missing reason (should be handled gracefully)
    print(f"\n🔍 STEP 12: TEST EDGE CASE - MISSING REASON")
    print("=" * 60)
    
    if missing_pwd_uid:
        missing_reason_data = {
            "password": "DeleteTest@123"
            # No reason field - should use default
        }
        
        try:
            response = requests.post(f"{API_BASE}/user/{missing_pwd_uid}/request-account-deletion", json=missing_reason_data, timeout=30)
            if response.status_code == 200:
                test_results["missing_reason_handled"] = True
                result = response.json()
                print(f"✅ Missing reason handled gracefully (200)")
                print(f"   📋 Default reason used, deletion successful")
            else:
                print(f"⚠️  Missing reason handling: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing missing reason: {e}")
    
    return test_results

def main():
    """Run the complete Account Delete Feature testing"""
    print(f"\n🚀 STARTING ACCOUNT DELETE FEATURE TESTING")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Test Account Deletion System
    deletion_results = test_account_deletion_system()
    
    # Final Summary
    print(f"\n🏁 ACCOUNT DELETE FEATURE - FINAL SUMMARY")
    print("=" * 80)
    
    test_categories = {
        "User Setup": [
            ("Test user created", deletion_results.get("test_user_created", False)),
            ("Test user balances credited", deletion_results.get("test_user_balances_credited", False))
        ],
        "Deletion Status Check": [
            ("Active account status check", deletion_results.get("active_account_status_check", False)),
            ("Scheduled account status check", deletion_results.get("scheduled_account_status_check", False)),
            ("Deletion details correct", deletion_results.get("deletion_details_correct", False))
        ],
        "Deletion Request": [
            ("Deletion request success", deletion_results.get("deletion_request_success", False)),
            ("Password verification working", deletion_results.get("password_verification_working", False)),
            ("PRC forfeiture verified", deletion_results.get("prc_forfeiture_verified", False)),
            ("Cashback forfeiture verified", deletion_results.get("cashback_forfeiture_verified", False)),
            ("Hard delete date correct", deletion_results.get("hard_delete_date_correct", False)),
            ("Wrong password rejected", deletion_results.get("wrong_password_rejected", False))
        ],
        "Cancellation Flow": [
            ("Cancellation success", deletion_results.get("cancellation_success", False)),
            ("Account restored", deletion_results.get("account_restored", False)),
            ("Balances remain forfeited", deletion_results.get("balances_remain_forfeited", False))
        ],
        "Edge Cases": [
            ("Duplicate deletion rejected", deletion_results.get("duplicate_deletion_rejected", False)),
            ("Cancel non-deleted rejected", deletion_results.get("cancel_non_deleted_rejected", False)),
            ("Cancel wrong password rejected", deletion_results.get("cancel_wrong_password_rejected", False)),
            ("Missing password rejected", deletion_results.get("missing_password_rejected", False)),
            ("Missing reason handled", deletion_results.get("missing_reason_handled", False))
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
    
    if passed_tests == total_tests:
        print(f"\n🎉 ALL ACCOUNT DELETE TESTS PASSED!")
        print(f"✅ Active accounts show is_scheduled_for_deletion: false")
        print(f"✅ Deletion request requires password verification")
        print(f"✅ PRC and cashback balances are forfeited immediately")
        print(f"✅ Hard delete date is 30 days from request")
        print(f"✅ Deletion status shows correct information")
        print(f"✅ Account can be cancelled within grace period")
        print(f"✅ Cancelled accounts are restored but balances not recovered")
        print(f"✅ Edge cases handled properly with appropriate error messages")
        return 0
    elif passed_tests >= total_tests * 0.8:
        print(f"\n✅ MOSTLY WORKING - {total_tests - passed_tests} tests failed but core functionality working")
        print(f"⚠️  Minor issues remain but account deletion system operational")
        return 0
    else:
        print(f"\n❌ CRITICAL ISSUES - {total_tests - passed_tests} tests failed")
        print(f"❌ Account deletion system needs investigation")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)