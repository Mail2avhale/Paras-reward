#!/usr/bin/env python3
"""
ADMIN ACCOUNT DELETE TESTING

Test the account deletion feature using admin credentials as specified in the review request.
Admin: admin@paras.com / admin
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

print(f"👨‍💼 ADMIN ACCOUNT DELETE TESTING")
print(f"Backend URL: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def test_admin_account_deletion():
    """Test account deletion with admin credentials"""
    print(f"\n👨‍💼 TESTING WITH ADMIN CREDENTIALS")
    print("=" * 60)
    
    # Admin credentials from review request
    admin_email = "admin@paras.com"
    admin_password = "admin"
    
    test_results = {
        "admin_login_success": False,
        "admin_deletion_status_check": False,
        "admin_deletion_request": False,
        "admin_cancellation": False
    }
    
    # Step 1: Test admin login
    print(f"\n🔍 STEP 1: TEST ADMIN LOGIN")
    print("=" * 40)
    
    try:
        login_response = requests.post(f"{API_BASE}/auth/login", params={
            "identifier": admin_email,
            "password": admin_password
        }, timeout=30)
        
        if login_response.status_code == 200:
            login_result = login_response.json()
            admin_uid = login_result.get("uid")
            
            if admin_uid:
                test_results["admin_login_success"] = True
                print(f"✅ Admin login successful")
                print(f"   📋 Admin UID: {admin_uid}")
                print(f"   📋 Role: {login_result.get('role')}")
                
                # Step 2: Test admin deletion status check
                print(f"\n🔍 STEP 2: TEST ADMIN DELETION STATUS CHECK")
                print("=" * 40)
                
                try:
                    status_response = requests.get(f"{API_BASE}/user/{admin_uid}/deletion-status", timeout=30)
                    if status_response.status_code == 200:
                        status_result = status_response.json()
                        test_results["admin_deletion_status_check"] = True
                        print(f"✅ Admin deletion status check successful")
                        print(f"   📋 Is Scheduled: {status_result.get('is_scheduled_for_deletion')}")
                        print(f"   📋 Message: {status_result.get('message')}")
                    else:
                        print(f"❌ Admin deletion status check failed: {status_response.status_code}")
                except Exception as e:
                    print(f"❌ Error checking admin deletion status: {e}")
                
                # Step 3: Test admin account deletion request
                print(f"\n🔍 STEP 3: TEST ADMIN ACCOUNT DELETION REQUEST")
                print("=" * 40)
                
                deletion_data = {
                    "password": admin_password,
                    "reason": "Testing admin account deletion"
                }
                
                try:
                    deletion_response = requests.post(f"{API_BASE}/user/{admin_uid}/request-account-deletion", json=deletion_data, timeout=30)
                    if deletion_response.status_code == 200:
                        deletion_result = deletion_response.json()
                        test_results["admin_deletion_request"] = True
                        print(f"✅ Admin account deletion request successful")
                        print(f"   📋 Message: {deletion_result.get('message')}")
                        print(f"   📋 Hard Delete Date: {deletion_result.get('hard_delete_date')}")
                        print(f"   📋 PRC Forfeited: {deletion_result.get('prc_forfeited')}")
                        print(f"   📋 Cashback Forfeited: {deletion_result.get('cashback_forfeited')}")
                        
                        # Step 4: Test admin cancellation
                        print(f"\n🔍 STEP 4: TEST ADMIN CANCELLATION")
                        print("=" * 40)
                        
                        cancel_data = {
                            "password": admin_password
                        }
                        
                        try:
                            cancel_response = requests.post(f"{API_BASE}/user/{admin_uid}/cancel-account-deletion", json=cancel_data, timeout=30)
                            if cancel_response.status_code == 200:
                                cancel_result = cancel_response.json()
                                test_results["admin_cancellation"] = True
                                print(f"✅ Admin account cancellation successful")
                                print(f"   📋 Message: {cancel_result.get('message')}")
                                print(f"   📋 Note: {cancel_result.get('note')}")
                            else:
                                print(f"❌ Admin cancellation failed: {cancel_response.status_code}")
                                print(f"   Response: {cancel_response.text}")
                        except Exception as e:
                            print(f"❌ Error testing admin cancellation: {e}")
                        
                    else:
                        print(f"❌ Admin deletion request failed: {deletion_response.status_code}")
                        print(f"   Response: {deletion_response.text}")
                except Exception as e:
                    print(f"❌ Error testing admin deletion: {e}")
                
            else:
                print(f"❌ Admin login successful but no UID returned")
        else:
            print(f"❌ Admin login failed: {login_response.status_code}")
            print(f"   Response: {login_response.text}")
    except Exception as e:
        print(f"❌ Error testing admin login: {e}")
    
    return test_results

def main():
    """Run admin account deletion testing"""
    print(f"\n🚀 STARTING ADMIN ACCOUNT DELETE TESTING")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Test with admin credentials
    admin_results = test_admin_account_deletion()
    
    # Final Summary
    print(f"\n🏁 ADMIN ACCOUNT DELETE - FINAL SUMMARY")
    print("=" * 80)
    
    tests = [
        ("Admin login success", admin_results.get("admin_login_success", False)),
        ("Admin deletion status check", admin_results.get("admin_deletion_status_check", False)),
        ("Admin deletion request", admin_results.get("admin_deletion_request", False)),
        ("Admin cancellation", admin_results.get("admin_cancellation", False))
    ]
    
    total_tests = len(tests)
    passed_tests = sum(1 for _, result in tests if result)
    
    for test_name, result in tests:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {test_name}")
    
    print(f"\n📊 ADMIN RESULTS: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    if passed_tests == total_tests:
        print(f"\n🎉 ALL ADMIN ACCOUNT DELETE TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total_tests - passed_tests} admin tests failed")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)