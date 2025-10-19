#!/usr/bin/env python3
"""
Backend API Testing Script for Mining System Fix
Tests the mining rate calculation and display functionality
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

print(f"Testing Mining System Fix at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# Test data for mining system testing
test_user_no_mining = None
test_user_with_mining = None
test_user_with_referrals = None

def setup_test_users():
    """Create test users for mining system testing"""
    global test_user_no_mining, test_user_with_mining, test_user_with_referrals
    
    print("\n1. Setting up test users for mining system testing...")
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    microseconds = str(datetime.now().microsecond)[:3]
    
    # Create User 1: No active mining session
    user1_data = {
        "first_name": "Mining",
        "last_name": "TestUser1",
        "email": f"mining1.{timestamp}.{microseconds}@example.com",
        "mobile": f"98701{timestamp[-6:]}",
        "password": "MiningPass123!",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1111{timestamp[-8:]}111",
        "pan_number": f"MIN1{timestamp[-5:]}A"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=user1_data, timeout=30)
        if response.status_code == 200:
            user1_uid = response.json().get("uid")
            test_user_no_mining = {"uid": user1_uid, **user1_data}
            print(f"✅ Mining test user 1 (no mining) created: {user1_uid}")
        else:
            print(f"❌ Failed to create mining test user 1: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating mining test user 1: {e}")
        return False
    
    # Create User 2: Will have active mining session
    user2_data = {
        "first_name": "Mining",
        "last_name": "TestUser2",
        "email": f"mining2.{timestamp}.{microseconds}@example.com",
        "mobile": f"98702{timestamp[-6:]}",
        "password": "MiningPass123!",
        "state": "Gujarat",
        "district": "Ahmedabad",
        "pincode": "380001",
        "aadhaar_number": f"2222{timestamp[-8:]}222",
        "pan_number": f"MIN2{timestamp[-5:]}B"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=user2_data, timeout=30)
        if response.status_code == 200:
            user2_uid = response.json().get("uid")
            test_user_with_mining = {"uid": user2_uid, **user2_data}
            print(f"✅ Mining test user 2 (with mining) created: {user2_uid}")
        else:
            print(f"❌ Failed to create mining test user 2: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating mining test user 2: {e}")
        return False
    
    # Create User 3: Will have referrals
    user3_data = {
        "first_name": "Mining",
        "last_name": "TestUser3",
        "email": f"mining3.{timestamp}.{microseconds}@example.com",
        "mobile": f"98703{timestamp[-6:]}",
        "password": "MiningPass123!",
        "state": "Karnataka",
        "district": "Bangalore",
        "pincode": "560001",
        "aadhaar_number": f"3333{timestamp[-8:]}333",
        "pan_number": f"MIN3{timestamp[-5:]}C"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=user3_data, timeout=30)
        if response.status_code == 200:
            user3_uid = response.json().get("uid")
            test_user_with_referrals = {"uid": user3_uid, **user3_data}
            print(f"✅ Mining test user 3 (with referrals) created: {user3_uid}")
        else:
            print(f"❌ Failed to create mining test user 3: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating mining test user 3: {e}")
        return False
    
    return True

def test_mining_status_no_active_session():
    """Test mining status endpoint for user with NO active mining session"""
    print("\n2. Testing Mining Status - User with NO active mining session...")
    
    try:
        response = requests.get(f"{API_BASE}/mining/status/{test_user_no_mining['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            
            # Check required fields
            required_fields = ["mining_rate_per_hour", "mining_rate", "base_rate", "active_referrals", "is_mining"]
            missing_fields = []
            
            for field in required_fields:
                if field not in result:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ Mining status test FAILED - Missing fields: {missing_fields}")
                return False
            
            # Verify mining_rate_per_hour is NOT 0
            mining_rate_per_hour = result.get("mining_rate_per_hour", 0)
            mining_rate = result.get("mining_rate", 0)
            base_rate = result.get("base_rate", 0)
            active_referrals = result.get("active_referrals", 0)
            is_mining = result.get("is_mining", False)
            
            print(f"Mining Rate Per Hour: {mining_rate_per_hour}")
            print(f"Mining Rate: {mining_rate}")
            print(f"Base Rate: {base_rate}")
            print(f"Active Referrals: {active_referrals}")
            print(f"Is Mining: {is_mining}")
            
            # Verify mining rate is NOT 0
            if mining_rate_per_hour == 0:
                print("❌ Mining status test FAILED - mining_rate_per_hour is 0 (should NOT be 0)")
                return False
            
            # Verify mining_rate matches mining_rate_per_hour
            if mining_rate != mining_rate_per_hour:
                print(f"❌ Mining status test FAILED - mining_rate ({mining_rate}) doesn't match mining_rate_per_hour ({mining_rate_per_hour})")
                return False
            
            # Verify base_rate is positive
            if base_rate <= 0:
                print(f"❌ Mining status test FAILED - base_rate ({base_rate}) should be positive")
                return False
            
            # Verify is_mining is False (no active session)
            if is_mining:
                print(f"❌ Mining status test FAILED - is_mining should be False for user with no active session")
                return False
            
            print("✅ Mining status test PASSED - All required fields present and mining rate is non-zero")
            return True
            
        else:
            print(f"❌ Mining status test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Mining status test FAILED - Error: {e}")
        return False

def start_mining_session():
    """Start mining session for test user 2"""
    print("\n3. Starting mining session for test user 2...")
    
    try:
        response = requests.post(f"{API_BASE}/mining/start/{test_user_with_mining['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            session_active = result.get("session_active", False)
            
            if session_active:
                print("✅ Mining session started successfully")
                return True
            else:
                print("❌ Mining session start FAILED - session_active is False")
                return False
        else:
            print(f"❌ Mining session start FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Mining session start FAILED - Error: {e}")
        return False

def test_mining_status_with_active_session():
    """Test mining status endpoint for user WITH active mining session"""
    print("\n4. Testing Mining Status - User WITH active mining session...")
    
    try:
        response = requests.get(f"{API_BASE}/mining/status/{test_user_with_mining['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            
            # Check required fields
            required_fields = ["mining_rate_per_hour", "mining_rate", "base_rate", "active_referrals", "is_mining"]
            missing_fields = []
            
            for field in required_fields:
                if field not in result:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ Mining status with active session test FAILED - Missing fields: {missing_fields}")
                return False
            
            # Verify mining_rate_per_hour is NOT 0
            mining_rate_per_hour = result.get("mining_rate_per_hour", 0)
            mining_rate = result.get("mining_rate", 0)
            base_rate = result.get("base_rate", 0)
            active_referrals = result.get("active_referrals", 0)
            is_mining = result.get("is_mining", False)
            session_active = result.get("session_active", False)
            
            print(f"Mining Rate Per Hour: {mining_rate_per_hour}")
            print(f"Mining Rate: {mining_rate}")
            print(f"Base Rate: {base_rate}")
            print(f"Active Referrals: {active_referrals}")
            print(f"Is Mining: {is_mining}")
            print(f"Session Active: {session_active}")
            
            # Verify mining rate is NOT 0
            if mining_rate_per_hour == 0:
                print("❌ Mining status with active session test FAILED - mining_rate_per_hour is 0 (should NOT be 0)")
                return False
            
            # Verify mining_rate matches mining_rate_per_hour
            if mining_rate != mining_rate_per_hour:
                print(f"❌ Mining status with active session test FAILED - mining_rate ({mining_rate}) doesn't match mining_rate_per_hour ({mining_rate_per_hour})")
                return False
            
            # Verify base_rate is positive
            if base_rate <= 0:
                print(f"❌ Mining status with active session test FAILED - base_rate ({base_rate}) should be positive")
                return False
            
            # Verify is_mining is True (active session)
            if not is_mining:
                print(f"❌ Mining status with active session test FAILED - is_mining should be True for user with active session")
                return False
            
            # Verify session_active is True
            if not session_active:
                print(f"❌ Mining status with active session test FAILED - session_active should be True")
                return False
            
            print("✅ Mining status with active session test PASSED - All required fields present and mining rate is non-zero")
            return True
            
        else:
            print(f"❌ Mining status with active session test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Mining status with active session test FAILED - Error: {e}")
        return False

def test_mining_rate_calculation():
    """Test mining rate calculation formula"""
    print("\n5. Testing Mining Rate Calculation Formula...")
    
    try:
        # Get mining status for user with no referrals
        response = requests.get(f"{API_BASE}/mining/status/{test_user_no_mining['uid']}", timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            
            mining_rate_per_hour = result.get("mining_rate_per_hour", 0)
            base_rate = result.get("base_rate", 0)
            active_referrals = result.get("active_referrals", 0)
            
            # Get current day for calculation
            current_day = datetime.now().day
            
            # Calculate expected rate using the formula:
            # (current_day * base_rate) + (active_referrals * 0.1 * base_rate)
            # Then divide by 1440 (minutes in a day) to get per-minute rate
            # Multiply by 60 to get per-hour rate
            
            expected_total_rate = (current_day * base_rate) + (active_referrals * 0.1 * base_rate)
            expected_per_minute_rate = expected_total_rate / 1440
            expected_per_hour_rate = expected_per_minute_rate * 60
            
            print(f"Current Day: {current_day}")
            print(f"Base Rate: {base_rate}")
            print(f"Active Referrals: {active_referrals}")
            print(f"Expected Total Rate: {expected_total_rate}")
            print(f"Expected Per-Hour Rate: {expected_per_hour_rate}")
            print(f"Actual Per-Hour Rate: {mining_rate_per_hour}")
            
            # Allow small floating point differences
            rate_difference = abs(expected_per_hour_rate - mining_rate_per_hour)
            tolerance = 0.01  # 1 cent tolerance
            
            if rate_difference <= tolerance:
                print("✅ Mining rate calculation test PASSED - Formula is correct")
                return True
            else:
                print(f"❌ Mining rate calculation test FAILED - Expected: {expected_per_hour_rate}, Got: {mining_rate_per_hour}, Difference: {rate_difference}")
                return False
        else:
            print(f"❌ Mining rate calculation test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Mining rate calculation test FAILED - Error: {e}")
        return False

def test_mining_rate_never_zero():
    """Test that mining rate is never zero under various conditions"""
    print("\n6. Testing Mining Rate Never Zero...")
    
    # Test all created users to ensure none have zero mining rate
    test_users = [test_user_no_mining, test_user_with_mining, test_user_with_referrals]
    
    for i, user in enumerate(test_users, 1):
        print(f"\n6.{chr(96+i)}. Testing mining rate for user {i}...")
        try:
            response = requests.get(f"{API_BASE}/mining/status/{user['uid']}", timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                mining_rate_per_hour = result.get("mining_rate_per_hour", 0)
                
                if mining_rate_per_hour == 0:
                    print(f"❌ Mining rate never zero test FAILED - User {i} has zero mining rate")
                    return False
                else:
                    print(f"✅ User {i} mining rate: {mining_rate_per_hour} (non-zero)")
            else:
                print(f"❌ Mining rate never zero test FAILED - Status: {response.status_code} for user {i}")
                return False
        except Exception as e:
            print(f"❌ Mining rate never zero test FAILED - Error: {e} for user {i}")
            return False
    
    print("✅ Mining rate never zero test PASSED - All users have non-zero mining rates")
    return True

def main():
    """Run all Mining System Fix tests"""
    print("Starting Mining System Fix testing...")
    print(f"Target API: {API_BASE}")
    
    # Test basic connectivity
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=10)
        print(f"Backend connectivity test - Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend connectivity FAILED: {e}")
        print("Cannot proceed with testing - backend is not accessible")
        return False
    
    # Run all tests in sequence
    print("\n" + "=" * 80)
    print("MINING SYSTEM FIX COMPREHENSIVE TESTING")
    print("=" * 80)
    
    # 1. Setup test users
    if not setup_test_users():
        print("❌ CRITICAL: Failed to setup test users - cannot continue")
        return False
    
    # 2. Test mining status for user with NO active mining session
    if not test_mining_status_no_active_session():
        print("❌ CRITICAL: Mining status (no active session) test failed")
        return False
    
    # 3. Start mining session for test user 2
    if not start_mining_session():
        print("❌ CRITICAL: Failed to start mining session - cannot continue with active session tests")
        return False
    
    # 4. Test mining status for user WITH active mining session
    if not test_mining_status_with_active_session():
        print("❌ CRITICAL: Mining status (with active session) test failed")
        return False
    
    # 5. Test mining rate calculation formula
    if not test_mining_rate_calculation():
        print("❌ CRITICAL: Mining rate calculation test failed")
        return False
    
    # 6. Test that mining rate is never zero
    if not test_mining_rate_never_zero():
        print("❌ CRITICAL: Mining rate never zero test failed")
        return False
    
    print("\n" + "=" * 80)
    print("MINING SYSTEM FIX TESTING COMPLETED!")
    print("=" * 80)
    print("✅ ALL TESTS PASSED - Mining system fix is working correctly!")
    print("✅ Mining rate displays correctly and is never zero")
    print("✅ Mining rate calculation formula is working as expected")
    print("✅ Both active and inactive mining sessions work properly")
    
    return True

if __name__ == "__main__":
    main()