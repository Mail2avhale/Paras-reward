#!/usr/bin/env python3
"""
Mining Session Debug Test - Investigate "Mining Paused" Issue
Tests the specific issue where frontend shows "Mining Paused" despite active mining session
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

print(f"Mining Session Debug Test at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# Known user with active mining from MongoDB query
ACTIVE_MINING_USER_UID = "e499fd22-6c8c-48ba-b87f-83aa7bd4b81e"

def test_active_mining_user_status():
    """Test mining status API for user with active mining session"""
    print(f"\n1. Testing mining status for user with active mining: {ACTIVE_MINING_USER_UID}")
    
    try:
        response = requests.get(f"{API_BASE}/mining/status/{ACTIVE_MINING_USER_UID}", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Full Response: {json.dumps(result, indent=2)}")
            
            # Check all required fields for frontend
            required_fields = [
                "session_active", "is_mining", "mining_start_time", 
                "remaining_hours", "session_start", "session_end", 
                "mined_this_session", "mining_rate_per_hour", "mining_rate"
            ]
            
            print(f"\n📋 Field Analysis:")
            for field in required_fields:
                value = result.get(field)
                status = "✅" if value is not None else "❌"
                print(f"{status} {field}: {value}")
            
            # Critical checks for "Mining Paused" issue
            session_active = result.get("session_active", False)
            is_mining = result.get("is_mining", False)
            remaining_hours = result.get("remaining_hours", 0)
            session_start = result.get("session_start")
            session_end = result.get("session_end")
            
            print(f"\n🔍 Critical Analysis:")
            print(f"session_active: {session_active} (Frontend likely checks this)")
            print(f"is_mining: {is_mining} (Alternative field frontend might check)")
            print(f"remaining_hours: {remaining_hours} (Should be > 0 and <= 24)")
            
            # Check session timing
            if session_start and session_end:
                try:
                    start_time = datetime.fromisoformat(session_start.replace('Z', '+00:00'))
                    end_time = datetime.fromisoformat(session_end.replace('Z', '+00:00'))
                    now = datetime.now(start_time.tzinfo)
                    
                    print(f"Session Start: {start_time}")
                    print(f"Session End: {end_time}")
                    print(f"Current Time: {now}")
                    print(f"Session Valid: {now < end_time}")
                    print(f"Time Elapsed: {(now - start_time).total_seconds() / 3600:.2f} hours")
                    print(f"Time Remaining: {(end_time - now).total_seconds() / 3600:.2f} hours")
                    
                except Exception as e:
                    print(f"❌ Error parsing session times: {e}")
            
            # Identify potential issues
            issues = []
            if not session_active:
                issues.append("session_active is False - this could cause 'Mining Paused'")
            if not is_mining:
                issues.append("is_mining is False - this could cause 'Mining Paused'")
            if remaining_hours <= 0:
                issues.append(f"remaining_hours is {remaining_hours} - session might be expired")
            if not session_start:
                issues.append("session_start is missing - frontend can't validate session")
            if not session_end:
                issues.append("session_end is missing - frontend can't validate session")
            
            if issues:
                print(f"\n⚠️  Potential Issues Found:")
                for issue in issues:
                    print(f"   • {issue}")
                return False
            else:
                print(f"\n✅ No obvious issues found - mining session appears active")
                return True
                
        else:
            print(f"❌ API call failed with status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing active mining user: {e}")
        return False

def test_start_new_mining_session():
    """Start a new mining session for a test user to verify the flow"""
    print(f"\n2. Creating test user and starting fresh mining session...")
    
    # Create a test user
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    test_user_data = {
        "first_name": "Debug",
        "last_name": "MiningUser",
        "email": f"debug.mining.{timestamp}@example.com",
        "mobile": f"99999{timestamp[-6:]}",
        "password": "DebugPass123!",
        "state": "TestState",
        "district": "TestDistrict",
        "pincode": "123456",
        "aadhaar_number": f"9999{timestamp[-8:]}999",
        "pan_number": f"DBG{timestamp[-6:]}X"
    }
    
    try:
        # Register user
        response = requests.post(f"{API_BASE}/auth/register", json=test_user_data, timeout=30)
        if response.status_code != 200:
            print(f"❌ Failed to create test user: {response.status_code} - {response.text}")
            return False
        
        test_uid = response.json().get("uid")
        print(f"✅ Test user created: {test_uid}")
        
        # Start mining session
        response = requests.post(f"{API_BASE}/mining/start/{test_uid}", timeout=30)
        print(f"Mining start status: {response.status_code}")
        
        if response.status_code == 200:
            start_result = response.json()
            print(f"Mining start response: {json.dumps(start_result, indent=2)}")
            
            # Immediately check status
            print(f"\n📊 Checking status immediately after starting mining...")
            response = requests.get(f"{API_BASE}/mining/status/{test_uid}", timeout=30)
            
            if response.status_code == 200:
                status_result = response.json()
                print(f"Status response: {json.dumps(status_result, indent=2)}")
                
                # Verify all fields are correct
                session_active = status_result.get("session_active", False)
                is_mining = status_result.get("is_mining", False)
                remaining_hours = status_result.get("remaining_hours", 0)
                
                print(f"\n🔍 Fresh Session Analysis:")
                print(f"session_active: {session_active}")
                print(f"is_mining: {is_mining}")
                print(f"remaining_hours: {remaining_hours}")
                
                if session_active and is_mining and remaining_hours > 0:
                    print(f"✅ Fresh mining session working correctly")
                    return True
                else:
                    print(f"❌ Fresh mining session has issues")
                    return False
            else:
                print(f"❌ Failed to get status after starting mining: {response.status_code}")
                return False
        else:
            print(f"❌ Failed to start mining: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error in fresh mining session test: {e}")
        return False

def test_field_name_consistency():
    """Test for field name mismatches between backend and frontend expectations"""
    print(f"\n3. Testing field name consistency...")
    
    try:
        response = requests.get(f"{API_BASE}/mining/status/{ACTIVE_MINING_USER_UID}", timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            
            # Check for potential field name issues
            print(f"\n🔍 Field Name Analysis:")
            
            # Check if both session_active and is_mining exist and match
            session_active = result.get("session_active")
            is_mining = result.get("is_mining")
            
            print(f"session_active: {session_active}")
            print(f"is_mining: {is_mining}")
            
            if session_active != is_mining:
                print(f"⚠️  MISMATCH: session_active ({session_active}) != is_mining ({is_mining})")
                print(f"   This could cause frontend confusion!")
                return False
            
            # Check mining_rate vs mining_rate_per_hour
            mining_rate = result.get("mining_rate")
            mining_rate_per_hour = result.get("mining_rate_per_hour")
            
            print(f"mining_rate: {mining_rate}")
            print(f"mining_rate_per_hour: {mining_rate_per_hour}")
            
            if mining_rate != mining_rate_per_hour:
                print(f"⚠️  MISMATCH: mining_rate ({mining_rate}) != mining_rate_per_hour ({mining_rate_per_hour})")
                return False
            
            print(f"✅ Field names and values are consistent")
            return True
            
        else:
            print(f"❌ Failed to get mining status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing field consistency: {e}")
        return False

def test_session_expiry_logic():
    """Test session expiry detection logic"""
    print(f"\n4. Testing session expiry logic...")
    
    try:
        response = requests.get(f"{API_BASE}/mining/status/{ACTIVE_MINING_USER_UID}", timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            
            session_start = result.get("session_start")
            session_end = result.get("session_end")
            remaining_hours = result.get("remaining_hours", 0)
            
            if session_start and session_end:
                try:
                    start_time = datetime.fromisoformat(session_start.replace('Z', '+00:00'))
                    end_time = datetime.fromisoformat(session_end.replace('Z', '+00:00'))
                    now = datetime.now(start_time.tzinfo)
                    
                    # Calculate expected remaining hours
                    expected_remaining = (end_time - now).total_seconds() / 3600
                    
                    print(f"Expected remaining hours: {expected_remaining:.2f}")
                    print(f"API remaining hours: {remaining_hours}")
                    
                    # Check if session should be expired
                    if now >= end_time:
                        print(f"⚠️  Session should be EXPIRED (current time >= end time)")
                        if result.get("session_active", False):
                            print(f"❌ BUG: session_active is True but session is expired!")
                            return False
                    else:
                        print(f"✅ Session is within valid time range")
                        if not result.get("session_active", False):
                            print(f"❌ BUG: session_active is False but session should be active!")
                            return False
                    
                    # Check remaining hours calculation
                    if abs(expected_remaining - remaining_hours) > 0.1:  # 6 minute tolerance
                        print(f"⚠️  Remaining hours calculation might be off")
                        print(f"   Expected: {expected_remaining:.2f}, Got: {remaining_hours}")
                    
                    return True
                    
                except Exception as e:
                    print(f"❌ Error parsing session times: {e}")
                    return False
            else:
                print(f"❌ Missing session_start or session_end")
                return False
                
        else:
            print(f"❌ Failed to get mining status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing session expiry: {e}")
        return False

def main():
    """Run mining session debug tests"""
    print("Starting Mining Session Debug Testing...")
    print(f"Target API: {API_BASE}")
    
    # Test basic connectivity
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=10)
        print(f"Backend connectivity test - Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend connectivity FAILED: {e}")
        return False
    
    print("\n" + "=" * 80)
    print("MINING SESSION DEBUG TESTING")
    print("=" * 80)
    
    all_passed = True
    
    # Test 1: Check active mining user
    if not test_active_mining_user_status():
        print("❌ Active mining user test FAILED")
        all_passed = False
    
    # Test 2: Start fresh mining session
    if not test_start_new_mining_session():
        print("❌ Fresh mining session test FAILED")
        all_passed = False
    
    # Test 3: Field name consistency
    if not test_field_name_consistency():
        print("❌ Field consistency test FAILED")
        all_passed = False
    
    # Test 4: Session expiry logic
    if not test_session_expiry_logic():
        print("❌ Session expiry logic test FAILED")
        all_passed = False
    
    print("\n" + "=" * 80)
    print("MINING SESSION DEBUG TESTING COMPLETED!")
    print("=" * 80)
    
    if all_passed:
        print("✅ ALL TESTS PASSED - No obvious backend issues found")
        print("   If frontend still shows 'Mining Paused', the issue is likely:")
        print("   • Frontend field name mismatch")
        print("   • Frontend session validation logic")
        print("   • Caching issues in frontend")
    else:
        print("❌ ISSUES FOUND - Backend has problems that could cause 'Mining Paused'")
    
    return all_passed

if __name__ == "__main__":
    main()