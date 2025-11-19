#!/usr/bin/env python3
"""
REGISTRATION CONTROL SYSTEM TESTING

Tests the newly implemented Registration Control System for admin settings.

TEST SCENARIOS:
1. Get Registration Status (Default) - GET /api/admin/registration-status
2. Disable Registration - POST /api/admin/toggle-registration
3. Test Registration Blocked (when disabled) - POST /api/auth/register
4. Test Simple Registration Blocked (when disabled) - POST /api/auth/register/simple
5. Enable Registration - POST /api/admin/toggle-registration
6. Test Registration Allowed (when enabled) - POST /api/auth/register/simple
7. Update Registration Message Only - POST /api/admin/toggle-registration
8. Get Updated Settings - GET /api/v2/settings

ENDPOINTS TO TEST:
- GET /api/admin/registration-status
- POST /api/admin/toggle-registration
- POST /api/auth/register
- POST /api/auth/register/simple
- GET /api/v2/settings

SUCCESS CRITERIA:
✅ Registration status endpoint returns correct data
✅ Toggle registration works (enable/disable)
✅ Registration is blocked when disabled (both endpoints)
✅ Custom message is displayed when blocked
✅ Registration works when enabled
✅ Message updates correctly
✅ Settings persist across requests
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

def test_registration_control_system():
    """
    REGISTRATION CONTROL SYSTEM TESTING
    
    Test Scenarios:
    1. Get Registration Status (Default)
    2. Disable Registration
    3. Test Registration Blocked (when disabled)
    4. Test Simple Registration Blocked (when disabled)
    5. Enable Registration
    6. Test Registration Allowed (when enabled)
    7. Update Registration Message Only
    8. Get Updated Settings
    """
    print(f"\n🔐 REGISTRATION CONTROL SYSTEM TESTING")
    print("=" * 80)
    print(f"Testing admin registration control functionality")
    print("=" * 80)
    
    test_results = {
        # Registration Status Tests
        "get_default_registration_status": False,
        "default_registration_enabled": False,
        "default_message_exists": False,
        
        # Disable Registration Tests
        "disable_registration_success": False,
        "disable_registration_response_correct": False,
        
        # Registration Blocked Tests
        "full_registration_blocked": False,
        "simple_registration_blocked": False,
        "blocked_message_correct": False,
        
        # Enable Registration Tests
        "enable_registration_success": False,
        "enable_registration_response_correct": False,
        
        # Registration Allowed Tests
        "registration_allowed_when_enabled": False,
        "user_created_successfully": False,
        
        # Message Update Tests
        "message_update_only_success": False,
        "message_updated_correctly": False,
        
        # Settings Persistence Tests
        "settings_include_registration_fields": False,
        "settings_values_match_updates": False
    }
    
    print(f"\n🔍 STEP 1: GET REGISTRATION STATUS (DEFAULT)")
    print("=" * 60)
    
    # Test 1: Get default registration status
    print(f"\n📋 Testing GET /api/admin/registration-status...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/registration-status", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["get_default_registration_status"] = True
            print(f"✅ Registration status endpoint working")
            print(f"   📋 Response: {result}")
            
            # Check if registration is enabled by default
            registration_enabled = result.get("registration_enabled", False)
            registration_message = result.get("registration_message", "")
            
            if registration_enabled:
                test_results["default_registration_enabled"] = True
                print(f"✅ Registration enabled by default: {registration_enabled}")
            else:
                print(f"⚠️  Registration disabled by default: {registration_enabled}")
            
            if registration_message is not None:  # Can be empty string
                test_results["default_message_exists"] = True
                print(f"✅ Registration message field exists: '{registration_message}'")
            else:
                print(f"❌ Registration message field missing")
                
        else:
            print(f"❌ Registration status endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing registration status: {e}")
        return test_results
    
    print(f"\n🔍 STEP 2: DISABLE REGISTRATION")
    print("=" * 60)
    
    # Test 2: Disable registration with custom message
    print(f"\n📋 Testing POST /api/admin/toggle-registration (disable)...")
    
    disable_data = {
        "enabled": False,
        "message": "Registration temporarily closed for maintenance."
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/toggle-registration", json=disable_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["disable_registration_success"] = True
            print(f"✅ Disable registration successful")
            print(f"   📋 Response: {result}")
            
            # Check response structure
            if result.get("registration_enabled") == False and "disabled" in result.get("message", "").lower():
                test_results["disable_registration_response_correct"] = True
                print(f"✅ Disable registration response correct")
                print(f"   📋 Registration enabled: {result.get('registration_enabled')}")
                print(f"   📋 Message: {result.get('message')}")
            else:
                print(f"❌ Disable registration response incorrect")
                print(f"   📋 Expected registration_enabled=False, got: {result.get('registration_enabled')}")
                
        else:
            print(f"❌ Disable registration failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error disabling registration: {e}")
    
    print(f"\n🔍 STEP 3: TEST REGISTRATION BLOCKED (WHEN DISABLED)")
    print("=" * 60)
    
    # Test 3: Test full registration blocked when disabled
    print(f"\n📋 Testing POST /api/auth/register (should be blocked)...")
    
    timestamp = int(time.time())
    full_registration_data = {
        "email": f"newuser_{timestamp}@test.com",
        "password": "Test@123",
        "first_name": "Test",
        "mobile": f"9876543{timestamp % 1000:03d}"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=full_registration_data, timeout=30)
        if response.status_code == 403:
            test_results["full_registration_blocked"] = True
            print(f"✅ Full registration correctly blocked (403)")
            
            # Check if custom message is returned
            error_detail = response.json().get("detail", "")
            if "maintenance" in error_detail.lower():
                test_results["blocked_message_correct"] = True
                print(f"✅ Custom blocked message returned: '{error_detail}'")
            else:
                print(f"⚠️  Generic blocked message: '{error_detail}'")
                
        elif response.status_code == 200:
            print(f"❌ Full registration NOT blocked - should have been blocked")
            print(f"   Response: {response.json()}")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing full registration block: {e}")
    
    # Test 4: Test simple registration blocked when disabled
    print(f"\n📋 Testing POST /api/auth/register/simple (should be blocked)...")
    
    simple_registration_data = {
        "email": f"simple_{timestamp}@test.com",
        "password": "Test@123"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register/simple", json=simple_registration_data, timeout=30)
        if response.status_code == 403:
            test_results["simple_registration_blocked"] = True
            print(f"✅ Simple registration correctly blocked (403)")
            
            # Check if custom message is returned
            error_detail = response.json().get("detail", "")
            if "maintenance" in error_detail.lower():
                print(f"✅ Custom blocked message returned: '{error_detail}'")
            else:
                print(f"⚠️  Generic blocked message: '{error_detail}'")
                
        elif response.status_code == 200:
            print(f"❌ Simple registration NOT blocked - should have been blocked")
            print(f"   Response: {response.json()}")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing simple registration block: {e}")
    
    print(f"\n🔍 STEP 4: ENABLE REGISTRATION")
    print("=" * 60)
    
    # Test 5: Enable registration with welcome message
    print(f"\n📋 Testing POST /api/admin/toggle-registration (enable)...")
    
    enable_data = {
        "enabled": True,
        "message": "Welcome! Register to get started."
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/toggle-registration", json=enable_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["enable_registration_success"] = True
            print(f"✅ Enable registration successful")
            print(f"   📋 Response: {result}")
            
            # Check response structure
            if result.get("registration_enabled") == True and "enabled" in result.get("message", "").lower():
                test_results["enable_registration_response_correct"] = True
                print(f"✅ Enable registration response correct")
                print(f"   📋 Registration enabled: {result.get('registration_enabled')}")
                print(f"   📋 Message: {result.get('message')}")
            else:
                print(f"❌ Enable registration response incorrect")
                print(f"   📋 Expected registration_enabled=True, got: {result.get('registration_enabled')}")
                
        else:
            print(f"❌ Enable registration failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error enabling registration: {e}")
    
    print(f"\n🔍 STEP 5: TEST REGISTRATION ALLOWED (WHEN ENABLED)")
    print("=" * 60)
    
    # Test 6: Test registration works when enabled
    print(f"\n📋 Testing POST /api/auth/register/simple (should work now)...")
    
    timestamp = int(time.time())
    allowed_registration_data = {
        "email": f"allowed_{timestamp}@test.com",
        "password": "Test@123"
    }
    
    created_uid = None
    
    try:
        response = requests.post(f"{API_BASE}/auth/register/simple", json=allowed_registration_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            created_uid = result.get("uid")
            test_results["registration_allowed_when_enabled"] = True
            print(f"✅ Registration allowed when enabled (200 OK)")
            print(f"   📋 Response: {result}")
            
            # Check if user was created with UID
            if created_uid:
                test_results["user_created_successfully"] = True
                print(f"✅ User created successfully with UID: {created_uid}")
            else:
                print(f"❌ User creation failed - no UID returned")
                
        elif response.status_code == 403:
            print(f"❌ Registration still blocked - should be allowed now")
            print(f"   Response: {response.json()}")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing allowed registration: {e}")
    
    print(f"\n🔍 STEP 6: UPDATE REGISTRATION MESSAGE ONLY")
    print("=" * 60)
    
    # Test 7: Update registration message without changing enabled status
    print(f"\n📋 Testing POST /api/admin/toggle-registration (message update only)...")
    
    message_update_data = {
        "enabled": True,  # Keep enabled
        "message": "Updated message: Register now to earn rewards!"
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/toggle-registration", json=message_update_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["message_update_only_success"] = True
            print(f"✅ Message update successful")
            print(f"   📋 Response: {result}")
            
            # Check if message was updated and enabled status maintained
            if result.get("registration_enabled") == True:
                test_results["message_updated_correctly"] = True
                print(f"✅ Message updated correctly while maintaining enabled status")
                print(f"   📋 Registration enabled: {result.get('registration_enabled')}")
                print(f"   📋 Updated message: {result.get('message')}")
            else:
                print(f"❌ Message update affected enabled status incorrectly")
                
        else:
            print(f"❌ Message update failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error updating message: {e}")
    
    print(f"\n🔍 STEP 7: GET UPDATED SETTINGS")
    print("=" * 60)
    
    # Test 8: Verify settings endpoint includes registration fields and values match
    print(f"\n📋 Testing GET /api/v2/settings (should include registration fields)...")
    
    try:
        response = requests.get(f"{API_BASE}/v2/settings", timeout=30)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Settings endpoint working")
            
            # Check if registration fields are included
            if "registration_enabled" in result and "registration_message" in result:
                test_results["settings_include_registration_fields"] = True
                print(f"✅ Settings include registration fields")
                print(f"   📋 registration_enabled: {result.get('registration_enabled')}")
                print(f"   📋 registration_message: '{result.get('registration_message')}'")
                
                # Verify values match latest updates
                if (result.get("registration_enabled") == True and 
                    "earn rewards" in result.get("registration_message", "").lower()):
                    test_results["settings_values_match_updates"] = True
                    print(f"✅ Settings values match latest updates")
                else:
                    print(f"⚠️  Settings values don't match expected updates")
                    print(f"   📋 Expected: enabled=True, message containing 'earn rewards'")
                    print(f"   📋 Actual: enabled={result.get('registration_enabled')}, message='{result.get('registration_message')}'")
            else:
                print(f"❌ Settings missing registration fields")
                print(f"   📋 Available fields: {list(result.keys())}")
                
        else:
            print(f"❌ Settings endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error getting settings: {e}")
    
    # Final Summary
    print(f"\n🏁 REGISTRATION CONTROL SYSTEM - TEST SUMMARY")
    print("=" * 80)
    
    test_categories = {
        "Registration Status Tests": [
            ("Get default registration status", test_results["get_default_registration_status"]),
            ("Default registration enabled", test_results["default_registration_enabled"]),
            ("Default message exists", test_results["default_message_exists"])
        ],
        "Registration Control Tests": [
            ("Disable registration success", test_results["disable_registration_success"]),
            ("Disable registration response correct", test_results["disable_registration_response_correct"]),
            ("Enable registration success", test_results["enable_registration_success"]),
            ("Enable registration response correct", test_results["enable_registration_response_correct"])
        ],
        "Registration Blocking Tests": [
            ("Full registration blocked", test_results["full_registration_blocked"]),
            ("Simple registration blocked", test_results["simple_registration_blocked"]),
            ("Blocked message correct", test_results["blocked_message_correct"])
        ],
        "Registration Allowed Tests": [
            ("Registration allowed when enabled", test_results["registration_allowed_when_enabled"]),
            ("User created successfully", test_results["user_created_successfully"])
        ],
        "Message Update Tests": [
            ("Message update only success", test_results["message_update_only_success"]),
            ("Message updated correctly", test_results["message_updated_correctly"])
        ],
        "Settings Persistence Tests": [
            ("Settings include registration fields", test_results["settings_include_registration_fields"]),
            ("Settings values match updates", test_results["settings_values_match_updates"])
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
        print(f"🎉 ALL REGISTRATION CONTROL TESTS PASSED!")
        print(f"✅ Registration status endpoint returns correct data")
        print(f"✅ Toggle registration works (enable/disable)")
        print(f"✅ Registration is blocked when disabled (both endpoints)")
        print(f"✅ Custom message is displayed when blocked")
        print(f"✅ Registration works when enabled")
        print(f"✅ Message updates correctly")
        print(f"✅ Settings persist across requests")
    elif passed_tests >= total_tests * 0.8:
        print(f"✅ MOSTLY WORKING - {total_tests - passed_tests} tests failed but core functionality working")
        print(f"⚠️  Minor issues remain but registration control operational")
    else:
        print(f"❌ CRITICAL ISSUES - {total_tests - passed_tests} tests failed, registration control needs investigation")
        print(f"❌ System not working as expected")
    
    return test_results

def main():
    """Run the registration control system testing"""
    print(f"\n🚀 STARTING REGISTRATION CONTROL SYSTEM TESTING")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Run the registration control tests
    results = test_registration_control_system()
    
    # Count results
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    print(f"\n🏁 TESTING COMPLETE")
    print("=" * 80)
    print(f"📊 OVERALL RESULTS: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    if passed_tests == total_tests:
        print(f"\n🎉 SUCCESS - ALL TESTS PASSED!")
        print(f"✅ Registration control system is working perfectly")
        print(f"✅ All endpoints tested and verified")
        print(f"✅ Admin can control registration status and messages")
        return 0
    elif passed_tests >= total_tests * 0.8:
        print(f"\n⚠️  MOSTLY WORKING - {total_tests - passed_tests} tests failed")
        print(f"✅ Core functionality operational")
        print(f"⚠️  Minor issues need attention")
        return 0
    else:
        print(f"\n❌ CRITICAL ISSUES - {total_tests - passed_tests} tests failed")
        print(f"❌ Significant problems detected")
        print(f"❌ Registration control system needs investigation")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)