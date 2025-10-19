#!/usr/bin/env python3
"""
Frontend Mining Debug Test - Investigate specific user's mining status
Tests the exact scenario described in the user report
"""

import requests
import json
import sys
import os
from datetime import datetime, timedelta
import time

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

print(f"Frontend Mining Debug Test at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def get_all_users_with_mining():
    """Get all users and their mining status from MongoDB"""
    print("\n1. Checking all users with mining sessions...")
    
    try:
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import load_dotenv
        
        async def check_users():
            # Load environment
            load_dotenv('/app/backend/.env')
            mongo_url = os.environ['MONGO_URL']
            client = AsyncIOMotorClient(mongo_url)
            db = client[os.environ['DB_NAME']]
            
            # Find all users with any mining data
            users = await db.users.find({
                "$or": [
                    {"mining_active": True},
                    {"mining_start_time": {"$exists": True, "$ne": None}}
                ]
            }, {
                "uid": 1, "name": 1, "email": 1, "mining_active": 1, 
                "mining_start_time": 1, "mining_session_end": 1
            }).to_list(length=50)
            
            print(f"Found {len(users)} users with mining data:")
            for user in users:
                print(f"  UID: {user.get('uid')}")
                print(f"  Name: {user.get('name')}")
                print(f"  Email: {user.get('email')}")
                print(f"  Mining Active: {user.get('mining_active')}")
                print(f"  Mining Start: {user.get('mining_start_time')}")
                print(f"  Session End: {user.get('mining_session_end')}")
                print(f"  ---")
            
            return users
        
        return asyncio.run(check_users())
        
    except Exception as e:
        print(f"❌ Error checking MongoDB: {e}")
        return []

def test_user_mining_status(uid, name):
    """Test mining status for a specific user"""
    print(f"\n2. Testing mining status for {name} (UID: {uid})...")
    
    try:
        response = requests.get(f"{API_BASE}/mining/status/{uid}", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2)}")
            
            # Check the exact field that frontend uses
            session_active = result.get("session_active", False)
            is_mining = result.get("is_mining", False)
            remaining_hours = result.get("remaining_hours", 0)
            
            print(f"\n🔍 Frontend Analysis for {name}:")
            print(f"session_active: {session_active} (This is what frontend checks)")
            print(f"is_mining: {is_mining}")
            print(f"remaining_hours: {remaining_hours}")
            
            # Determine what frontend would show
            if session_active:
                frontend_display = "Mining Active"
                show_start_button = False
            else:
                frontend_display = "Mining Paused"
                show_start_button = True
            
            print(f"\n📱 Frontend would display: '{frontend_display}'")
            print(f"📱 Show start mining button: {show_start_button}")
            
            # Check session timing
            session_start = result.get("session_start")
            session_end = result.get("session_end")
            
            if session_start and session_end:
                try:
                    start_time = datetime.fromisoformat(session_start.replace('Z', '+00:00'))
                    end_time = datetime.fromisoformat(session_end.replace('Z', '+00:00'))
                    now = datetime.now(start_time.tzinfo)
                    
                    print(f"\n⏰ Session Timing:")
                    print(f"Start: {start_time}")
                    print(f"End: {end_time}")
                    print(f"Now: {now}")
                    print(f"Session Valid: {now < end_time}")
                    print(f"Hours Elapsed: {(now - start_time).total_seconds() / 3600:.2f}")
                    print(f"Hours Remaining: {(end_time - now).total_seconds() / 3600:.2f}")
                    
                    if now >= end_time:
                        print(f"⚠️  SESSION EXPIRED - This explains 'Mining Paused'!")
                        return False
                    
                except Exception as e:
                    print(f"❌ Error parsing session times: {e}")
            
            return session_active
            
        else:
            print(f"❌ API call failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing user {uid}: {e}")
        return False

def test_start_mining_for_user(uid, name):
    """Try to start mining for a user to see what happens"""
    print(f"\n3. Attempting to start mining for {name} (UID: {uid})...")
    
    try:
        response = requests.post(f"{API_BASE}/mining/start/{uid}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            session_active = result.get("session_active", False)
            
            if session_active:
                print(f"✅ Mining started successfully for {name}")
                
                # Check status immediately after starting
                print(f"\n📊 Checking status after starting...")
                status_response = requests.get(f"{API_BASE}/mining/status/{uid}", timeout=30)
                if status_response.status_code == 200:
                    status_result = status_response.json()
                    print(f"New status: session_active = {status_result.get('session_active')}")
                    return True
            else:
                print(f"❌ Mining start failed - session_active is False")
                return False
        else:
            print(f"❌ Failed to start mining: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error starting mining for {uid}: {e}")
        return False

def main():
    """Run comprehensive mining debug test"""
    print("Starting Frontend Mining Debug Testing...")
    print(f"Target API: {API_BASE}")
    
    # Test basic connectivity
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=10)
        print(f"Backend connectivity test - Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend connectivity FAILED: {e}")
        return False
    
    print("\n" + "=" * 80)
    print("FRONTEND MINING DEBUG TESTING")
    print("=" * 80)
    
    # Get all users with mining data
    users = get_all_users_with_mining()
    
    if not users:
        print("❌ No users with mining data found")
        return False
    
    # Test each user
    active_users = []
    paused_users = []
    
    for user in users:
        uid = user.get('uid')
        name = user.get('name', 'Unknown')
        
        if test_user_mining_status(uid, name):
            active_users.append((uid, name))
        else:
            paused_users.append((uid, name))
    
    print(f"\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    print(f"\n✅ Users with ACTIVE mining ({len(active_users)}):")
    for uid, name in active_users:
        print(f"  • {name} ({uid})")
    
    print(f"\n⏸️  Users with PAUSED mining ({len(paused_users)}):")
    for uid, name in paused_users:
        print(f"  • {name} ({uid})")
    
    # If there are paused users, try to restart their mining
    if paused_users:
        print(f"\n🔄 Attempting to restart mining for paused users...")
        for uid, name in paused_users:
            test_start_mining_for_user(uid, name)
    
    print(f"\n" + "=" * 80)
    print("CONCLUSION")
    print("=" * 80)
    
    if active_users:
        print(f"✅ Backend is working correctly - {len(active_users)} users have active mining")
        print(f"   If frontend shows 'Mining Paused' for these users, it's a frontend issue")
    
    if paused_users:
        print(f"⚠️  {len(paused_users)} users have paused/expired mining sessions")
        print(f"   This could explain the 'Mining Paused' display")
    
    print(f"\n🔍 DEBUGGING RECOMMENDATIONS:")
    print(f"   1. Check if the user in the screenshot is one of the paused users")
    print(f"   2. Verify the user's UID matches what the frontend is sending")
    print(f"   3. Check for browser caching issues")
    print(f"   4. Verify the frontend is using the correct API endpoint")
    
    return True

if __name__ == "__main__":
    main()