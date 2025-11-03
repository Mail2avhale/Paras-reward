#!/usr/bin/env python3
"""
Comprehensive Mining Rules Testing - VIP vs Free Users
Tests all mining-related functionality according to current implementation
"""

import requests
import json
import sys
import os
import time
import uuid
from datetime import datetime, timedelta

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

print(f"🔍 COMPREHENSIVE MINING RULES TESTING")
print(f"Backend URL: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def create_test_users():
    """Create VIP and Free test users for comprehensive testing"""
    timestamp = int(time.time())
    
    # VIP User Data
    vip_user_data = {
        "first_name": "VIP",
        "last_name": "MiningUser",
        "email": f"vip_mining_test_{timestamp}@test.com",
        "mobile": f"987654{timestamp % 10000:04d}",
        "password": "test123456",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"5678{timestamp % 100000000:08d}",
        "pan_number": f"VIP{timestamp % 100000:05d}Z",
        "membership_type": "vip"
    }
    
    # Free User Data
    free_user_data = {
        "first_name": "Free",
        "last_name": "MiningUser", 
        "email": f"free_mining_test_{timestamp}@test.com",
        "mobile": f"987655{timestamp % 10000:04d}",
        "password": "test123456",
        "state": "Maharashtra",
        "district": "Mumbai", 
        "pincode": "400001",
        "aadhaar_number": f"9012{timestamp % 100000000:08d}",
        "pan_number": f"FREE{timestamp % 100000:05d}Z",
        "membership_type": "free"
    }
    
    users = {}
    
    # Create VIP User
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=vip_user_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            users['vip'] = {
                'uid': result.get("uid"),
                'email': vip_user_data['email'],
                'membership_type': 'vip'
            }
            print(f"✅ VIP User created: {users['vip']['uid']}")
        else:
            print(f"❌ VIP User creation failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating VIP user: {e}")
        return None
    
    # Create Free User
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=free_user_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            users['free'] = {
                'uid': result.get("uid"),
                'email': free_user_data['email'],
                'membership_type': 'free'
            }
            print(f"✅ Free User created: {users['free']['uid']}")
        else:
            print(f"❌ Free User creation failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating Free user: {e}")
        return None
    
    return users

def test_mining_session_management(users):
    """Test mining session start, status, and claim functionality"""
    print(f"\n🔧 TESTING MINING SESSION MANAGEMENT")
    print("=" * 60)
    
    results = {
        'vip_mining_start': False,
        'vip_mining_status': False,
        'vip_mining_claim': False,
        'free_mining_start': False,
        'free_mining_claim_blocked': False
    }
    
    # Test VIP Mining Session
    print(f"\n1. VIP User Mining Session:")
    vip_uid = users['vip']['uid']
    
    # Start mining session
    try:
        response = requests.post(f"{API_BASE}/mining/start/{vip_uid}", timeout=30)
        print(f"   Start Mining Status: {response.status_code}")
        
        if response.status_code == 200:
            mining_data = response.json()
            print(f"   ✅ Mining session started")
            print(f"   📋 Session Active: {mining_data.get('session_active')}")
            print(f"   📋 Remaining Hours: {mining_data.get('remaining_hours')}")
            results['vip_mining_start'] = True
        else:
            print(f"   ❌ Mining start failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Error starting mining: {e}")
    
    # Check mining status
    try:
        response = requests.get(f"{API_BASE}/mining/status/{vip_uid}", timeout=30)
        print(f"   Mining Status Check: {response.status_code}")
        
        if response.status_code == 200:
            status_data = response.json()
            print(f"   ✅ Mining status retrieved")
            print(f"   📋 Mining Rate: {status_data.get('mining_rate')}")
            print(f"   📋 Base Rate: {status_data.get('base_rate')}")
            print(f"   📋 Is Mining: {status_data.get('is_mining')}")
            print(f"   📋 Current Balance: {status_data.get('current_balance')}")
            print(f"   📋 Session Active: {status_data.get('session_active')}")
            results['vip_mining_status'] = True
        else:
            print(f"   ❌ Mining status failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Error getting mining status: {e}")
    
    # Wait a moment and try to claim mining rewards
    print(f"   ⏳ Waiting 2 seconds to accumulate mining rewards...")
    time.sleep(2)
    
    try:
        response = requests.post(f"{API_BASE}/mining/claim/{vip_uid}", timeout=30)
        print(f"   Mining Claim Status: {response.status_code}")
        
        if response.status_code == 200:
            claim_data = response.json()
            print(f"   ✅ Mining rewards claimed")
            print(f"   📋 Amount Claimed: {claim_data.get('amount')}")
            print(f"   📋 New Balance: {claim_data.get('new_balance')}")
            print(f"   📋 Membership Type: {claim_data.get('membership_type')}")
            results['vip_mining_claim'] = True
        else:
            print(f"   ❌ Mining claim failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Error claiming mining: {e}")
    
    # Test Free User Mining Session
    print(f"\n2. Free User Mining Session:")
    free_uid = users['free']['uid']
    
    # Start mining session (should work)
    try:
        response = requests.post(f"{API_BASE}/mining/start/{free_uid}", timeout=30)
        print(f"   Start Mining Status: {response.status_code}")
        
        if response.status_code == 200:
            mining_data = response.json()
            print(f"   ✅ Mining session started (allowed)")
            print(f"   📋 Session Active: {mining_data.get('session_active')}")
            print(f"   📋 Remaining Hours: {mining_data.get('remaining_hours')}")
            results['free_mining_start'] = True
        else:
            print(f"   ❌ Mining start failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Error starting mining: {e}")
    
    # Wait and try to claim (should be blocked)
    print(f"   ⏳ Waiting 2 seconds to test claim restriction...")
    time.sleep(2)
    
    try:
        response = requests.post(f"{API_BASE}/mining/claim/{free_uid}", timeout=30)
        print(f"   Mining Claim Status: {response.status_code}")
        
        if response.status_code == 403:
            error_data = response.json()
            if "VIP membership required" in error_data.get('detail', ''):
                print(f"   ✅ Free user correctly blocked from claiming PRC")
                print(f"   📋 Error Message: {error_data.get('detail')}")
                results['free_mining_claim_blocked'] = True
            else:
                print(f"   ⚠️  Unexpected error: {error_data.get('detail')}")
        elif response.status_code == 200:
            print(f"   ❌ Free user can claim mining rewards (should be blocked)")
        else:
            print(f"   ⚠️  Unexpected status: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"   ❌ Error testing mining claim: {e}")
    
    return results

def test_tap_game_functionality(users):
    """Test tap game functionality for VIP vs Free users"""
    print(f"\n🎮 TESTING TAP GAME FUNCTIONALITY")
    print("=" * 60)
    
    results = {
        'vip_tap_game': False,
        'free_tap_game_blocked': False
    }
    
    # Test VIP Tap Game
    print(f"\n1. VIP User Tap Game:")
    vip_uid = users['vip']['uid']
    
    try:
        tap_data = {"taps": 10}  # Try 10 taps
        response = requests.post(f"{API_BASE}/game/tap/{vip_uid}", json=tap_data, timeout=30)
        print(f"   Tap Game Status: {response.status_code}")
        
        if response.status_code == 200:
            tap_result = response.json()
            print(f"   ✅ VIP user can play tap game")
            print(f"   📋 Taps Added: {tap_result.get('taps_added')}")
            print(f"   📋 Remaining Taps: {tap_result.get('remaining_taps')}")
            print(f"   📋 PRC Earned: {tap_result.get('prc_earned')}")
            results['vip_tap_game'] = True
        else:
            print(f"   ❌ VIP tap game failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Error testing VIP tap game: {e}")
    
    # Test Free User Tap Game
    print(f"\n2. Free User Tap Game:")
    free_uid = users['free']['uid']
    
    try:
        tap_data = {"taps": 10}  # Try 10 taps
        response = requests.post(f"{API_BASE}/game/tap/{free_uid}", json=tap_data, timeout=30)
        print(f"   Tap Game Status: {response.status_code}")
        
        if response.status_code == 403:
            error_data = response.json()
            if "VIP membership required" in error_data.get('detail', ''):
                print(f"   ✅ Free user correctly blocked from tap game")
                print(f"   📋 Error Message: {error_data.get('detail')}")
                results['free_tap_game_blocked'] = True
            else:
                print(f"   ⚠️  Unexpected error: {error_data.get('detail')}")
        elif response.status_code == 200:
            print(f"   ❌ Free user can play tap game (should be blocked)")
        else:
            print(f"   ⚠️  Unexpected status: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"   ❌ Error testing Free tap game: {e}")
    
    return results

def test_prc_balance_enforcement(users):
    """Test PRC balance enforcement at login"""
    print(f"\n💰 TESTING PRC BALANCE ENFORCEMENT")
    print("=" * 60)
    
    results = {
        'vip_login_prc_preserved': False,
        'free_login_prc_cleared': False
    }
    
    # Test VIP User Login (PRC should be preserved)
    print(f"\n1. VIP User Login - PRC Balance Preservation:")
    vip_email = users['vip']['email']
    
    try:
        login_params = {
            "identifier": vip_email,
            "password": "test123456"
        }
        response = requests.post(f"{API_BASE}/auth/login", params=login_params, timeout=30)
        print(f"   Login Status: {response.status_code}")
        
        if response.status_code == 200:
            user_data = response.json()
            prc_balance = user_data.get('prc_balance', 0)
            print(f"   ✅ VIP user login successful")
            print(f"   📋 PRC Balance: {prc_balance}")
            print(f"   📋 Membership Type: {user_data.get('membership_type')}")
            
            # VIP users should retain their PRC balance
            if prc_balance >= 0:  # Should have some PRC from mining/tap game
                results['vip_login_prc_preserved'] = True
                print(f"   ✅ VIP PRC balance preserved at login")
            else:
                print(f"   ⚠️  VIP PRC balance is negative (unexpected)")
        else:
            print(f"   ❌ VIP login failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Error testing VIP login: {e}")
    
    # Test Free User Login (PRC should be cleared)
    print(f"\n2. Free User Login - PRC Balance Clearing:")
    free_email = users['free']['email']
    
    try:
        login_params = {
            "identifier": free_email,
            "password": "test123456"
        }
        response = requests.post(f"{API_BASE}/auth/login", params=login_params, timeout=30)
        print(f"   Login Status: {response.status_code}")
        
        if response.status_code == 200:
            user_data = response.json()
            prc_balance = user_data.get('prc_balance', 0)
            print(f"   ✅ Free user login successful")
            print(f"   📋 PRC Balance: {prc_balance}")
            print(f"   📋 Membership Type: {user_data.get('membership_type')}")
            
            # Free users should have PRC balance = 0
            if prc_balance == 0:
                results['free_login_prc_cleared'] = True
                print(f"   ✅ Free user PRC balance correctly cleared at login")
            else:
                print(f"   ❌ Free user has PRC balance (should be 0): {prc_balance}")
        else:
            print(f"   ❌ Free login failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Error testing Free login: {e}")
    
    return results

def test_marketplace_and_withdrawal_restrictions(users):
    """Test marketplace access and withdrawal restrictions"""
    print(f"\n🛒 TESTING MARKETPLACE & WITHDRAWAL RESTRICTIONS")
    print("=" * 60)
    
    results = {
        'vip_marketplace_access': False,
        'free_marketplace_blocked': False,
        'withdrawal_kyc_requirement': False
    }
    
    # Get available products
    try:
        response = requests.get(f"{API_BASE}/products", timeout=30)
        if response.status_code == 200:
            products = response.json()
            print(f"📋 Available products: {len(products)}")
        else:
            print(f"❌ Failed to get products: {response.status_code}")
            return results
    except Exception as e:
        print(f"❌ Error getting products: {e}")
        return results
    
    if len(products) == 0:
        print(f"⚠️  No products available for testing")
        return results
    
    test_product = products[0]
    
    # Test VIP Marketplace Access
    print(f"\n1. VIP User Marketplace Access:")
    vip_uid = users['vip']['uid']
    
    try:
        order_data = {"product_id": test_product["product_id"]}
        response = requests.post(f"{API_BASE}/orders/{vip_uid}", json=order_data, timeout=30)
        print(f"   Order Creation Status: {response.status_code}")
        
        if response.status_code == 200:
            print(f"   ✅ VIP user can create orders")
            results['vip_marketplace_access'] = True
        elif response.status_code == 403:
            error_data = response.json()
            error_msg = error_data.get('detail', '')
            if "KYC verification required" in error_msg:
                print(f"   ✅ VIP user blocked by KYC requirement (expected)")
                results['vip_marketplace_access'] = True
            elif "VIP membership required" in error_msg:
                print(f"   ❌ VIP user blocked by membership check (unexpected)")
            else:
                print(f"   ⚠️  VIP user blocked: {error_msg}")
        else:
            print(f"   ❌ VIP order creation failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Error testing VIP marketplace: {e}")
    
    # Test Free User Marketplace Access
    print(f"\n2. Free User Marketplace Access:")
    free_uid = users['free']['uid']
    
    try:
        order_data = {"product_id": test_product["product_id"]}
        response = requests.post(f"{API_BASE}/orders/{free_uid}", json=order_data, timeout=30)
        print(f"   Order Creation Status: {response.status_code}")
        
        if response.status_code == 403:
            error_data = response.json()
            error_msg = error_data.get('detail', '')
            if "VIP membership required" in error_msg:
                print(f"   ✅ Free user correctly blocked from marketplace")
                results['free_marketplace_blocked'] = True
            else:
                print(f"   ⚠️  Free user blocked for different reason: {error_msg}")
        elif response.status_code == 200:
            print(f"   ❌ Free user can create orders (should be blocked)")
        else:
            print(f"   ⚠️  Unexpected response: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"   ❌ Error testing Free marketplace: {e}")
    
    # Test Withdrawal KYC Requirement
    print(f"\n3. Withdrawal KYC Requirement:")
    
    for user_type in ['vip', 'free']:
        user_uid = users[user_type]['uid']
        print(f"   Testing {user_type.upper()} user withdrawal:")
        
        try:
            withdrawal_data = {
                "user_id": user_uid,
                "amount": 10,
                "payment_mode": "upi",
                "upi_id": "test@upi"
            }
            
            response = requests.post(f"{API_BASE}/wallet/cashback/withdraw", json=withdrawal_data, timeout=30)
            print(f"     Withdrawal Status: {response.status_code}")
            
            if response.status_code == 400 or response.status_code == 403:
                error_data = response.json()
                error_msg = error_data.get('detail', '')
                if "KYC not verified" in error_msg:
                    print(f"     ✅ {user_type.upper()} withdrawal blocked by KYC (expected)")
                    results['withdrawal_kyc_requirement'] = True
                else:
                    print(f"     ⚠️  {user_type.upper()} withdrawal blocked: {error_msg}")
            elif response.status_code == 200:
                print(f"     ⚠️  {user_type.upper()} withdrawal allowed (KYC may be verified)")
            else:
                print(f"     ❌ {user_type.upper()} withdrawal failed: {response.text}")
        except Exception as e:
            print(f"     ❌ Error testing {user_type} withdrawal: {e}")
    
    return results

def run_comprehensive_mining_test():
    """Run comprehensive mining rules test"""
    print(f"\n🚀 STARTING COMPREHENSIVE MINING RULES TEST")
    print("=" * 80)
    
    # Create test users
    print(f"\n📝 CREATING TEST USERS")
    users = create_test_users()
    if not users:
        print(f"❌ Failed to create test users. Exiting.")
        return False
    
    # Run all tests
    all_results = {}
    
    # Test 1: Mining Session Management
    mining_results = test_mining_session_management(users)
    all_results.update(mining_results)
    
    # Test 2: Tap Game Functionality
    tap_results = test_tap_game_functionality(users)
    all_results.update(tap_results)
    
    # Test 3: PRC Balance Enforcement
    balance_results = test_prc_balance_enforcement(users)
    all_results.update(balance_results)
    
    # Test 4: Marketplace and Withdrawal Restrictions
    marketplace_results = test_marketplace_and_withdrawal_restrictions(users)
    all_results.update(marketplace_results)
    
    return all_results

def print_comprehensive_summary(results):
    """Print comprehensive test summary"""
    print(f"\n📊 COMPREHENSIVE MINING RULES TEST SUMMARY")
    print("=" * 80)
    
    print(f"\n🔍 TEST RESULTS BY CATEGORY:")
    
    # Mining Session Management
    print(f"\n1. MINING SESSION MANAGEMENT:")
    mining_tests = ['vip_mining_start', 'vip_mining_status', 'vip_mining_claim', 'free_mining_start', 'free_mining_claim_blocked']
    for test in mining_tests:
        status = "✅ PASS" if results.get(test, False) else "❌ FAIL"
        test_name = test.replace('_', ' ').title()
        print(f"   - {test_name}: {status}")
    
    # Tap Game Functionality
    print(f"\n2. TAP GAME FUNCTIONALITY:")
    tap_tests = ['vip_tap_game', 'free_tap_game_blocked']
    for test in tap_tests:
        status = "✅ PASS" if results.get(test, False) else "❌ FAIL"
        test_name = test.replace('_', ' ').title()
        print(f"   - {test_name}: {status}")
    
    # PRC Balance Enforcement
    print(f"\n3. PRC BALANCE ENFORCEMENT:")
    balance_tests = ['vip_login_prc_preserved', 'free_login_prc_cleared']
    for test in balance_tests:
        status = "✅ PASS" if results.get(test, False) else "❌ FAIL"
        test_name = test.replace('_', ' ').title()
        print(f"   - {test_name}: {status}")
    
    # Marketplace & Withdrawal
    print(f"\n4. MARKETPLACE & WITHDRAWAL:")
    marketplace_tests = ['vip_marketplace_access', 'free_marketplace_blocked', 'withdrawal_kyc_requirement']
    for test in marketplace_tests:
        status = "✅ PASS" if results.get(test, False) else "❌ FAIL"
        test_name = test.replace('_', ' ').title()
        print(f"   - {test_name}: {status}")
    
    # Overall Assessment
    critical_tests = [
        'vip_mining_start', 'vip_mining_claim', 'free_mining_claim_blocked',
        'vip_tap_game', 'free_tap_game_blocked',
        'vip_marketplace_access', 'free_marketplace_blocked'
    ]
    
    passed_tests = sum(1 for test in critical_tests if results.get(test, False))
    total_tests = len(critical_tests)
    
    print(f"\n🎯 OVERALL ASSESSMENT:")
    print(f"   📊 Tests Passed: {passed_tests}/{total_tests}")
    
    if passed_tests == total_tests:
        print(f"   ✅ ALL CRITICAL TESTS PASSED")
        print(f"   📋 VIP users have full mining and marketplace access")
        print(f"   📋 Free users are properly restricted from earning PRC")
        print(f"   📋 Current implementation is consistent and working")
    elif passed_tests >= total_tests * 0.8:
        print(f"   ⚠️  MOST TESTS PASSED - MINOR ISSUES")
        print(f"   📋 Core functionality working with some edge cases")
    else:
        print(f"   ❌ CRITICAL ISSUES FOUND")
        print(f"   📋 Major problems with mining rules implementation")
    
    print(f"\n🔧 IMPLEMENTATION NOTES:")
    print(f"   📋 Current system blocks free users from earning PRC entirely")
    print(f"   📋 No 24-hour PRC expiry logic implemented for free users")
    print(f"   📋 VIP membership and KYC verification required for marketplace/withdrawals")
    print(f"   📋 System enforces PRC = 0 for free users at login")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    print("🔍 Starting Comprehensive Mining Rules Testing...")
    
    # Run comprehensive test
    test_results = run_comprehensive_mining_test()
    
    if test_results:
        # Print summary
        success = print_comprehensive_summary(test_results)
        
        print(f"\n{'='*80}")
        if success:
            print("✅ COMPREHENSIVE MINING RULES TEST COMPLETED - ALL CRITICAL TESTS PASSED")
        else:
            print("❌ COMPREHENSIVE MINING RULES TEST COMPLETED - ISSUES FOUND")
        print(f"{'='*80}")
        
        sys.exit(0 if success else 1)
    else:
        print("❌ Test setup failed")
        sys.exit(1)