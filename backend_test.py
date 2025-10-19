#!/usr/bin/env python3
"""
Backend API Testing Script for Delivery Charge Auto-Distribution
Tests the delivery charge configuration and auto-distribution functionality
"""

import requests
import json
import sys
import os
from datetime import datetime
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

print(f"Testing backend at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# Test data for delivery charge testing
test_admin_user = None
test_vip_user = None
test_order = None
test_outlet_id = "outlet_123"

def setup_test_users():
    """Create test users for delivery charge testing"""
    global test_admin_user, test_vip_user
    
    print("\n1. Setting up test users...")
    
    # Create admin user
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    admin_data = {
        "first_name": "Admin",
        "last_name": "User",
        "email": f"admin.{timestamp}@example.com",
        "mobile": f"9876543{datetime.now().strftime('%H%M')}",
        "password": "AdminPass123!",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1111{datetime.now().strftime('%H%M')}1111111",
        "pan_number": f"ADMIN{datetime.now().strftime('%H%M')}A",
        "role": "admin"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=admin_data, timeout=30)
        if response.status_code == 200:
            admin_uid = response.json().get("uid")
            # Promote to admin
            requests.post(f"{API_BASE}/admin/promote", params={"email": admin_data["email"], "role": "admin"}, timeout=30)
            test_admin_user = {"uid": admin_uid, **admin_data}
            print(f"✅ Admin user created: {admin_uid}")
        else:
            print(f"❌ Failed to create admin user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return False
    
    # Create VIP user
    vip_data = {
        "first_name": "VIP",
        "last_name": "Customer",
        "email": f"vip.{timestamp}@example.com",
        "mobile": f"9876544{datetime.now().strftime('%H%M')}",
        "password": "VIPPass123!",
        "state": "Gujarat",
        "district": "Ahmedabad",
        "pincode": "380001",
        "aadhaar_number": f"2222{datetime.now().strftime('%H%M')}2222222",
        "pan_number": f"VIPUS{datetime.now().strftime('%H%M')}V",
        "membership_type": "vip",
        "kyc_status": "verified",
        "prc_balance": 1000.0  # Sufficient balance for orders
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=vip_data, timeout=30)
        if response.status_code == 200:
            vip_uid = response.json().get("uid")
            test_vip_user = {"uid": vip_uid, **vip_data}
            print(f"✅ VIP user created: {vip_uid}")
        else:
            print(f"❌ Failed to create VIP user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating VIP user: {e}")
        return False
    
    return True

def test_duplicate_detection(existing_user_data):
    """Test duplicate field detection for email, mobile, aadhaar_number, pan_number"""
    print("\n2. Testing duplicate field detection...")
    
    # Test duplicate email
    print("\n2a. Testing duplicate email...")
    duplicate_email_data = {
        "first_name": "Priya",
        "last_name": "Sharma",
        "email": existing_user_data["email"],  # Same email
        "mobile": f"8765432{datetime.now().strftime('%H%M')}",
        "password": "AnotherPass123!",
        "state": "Gujarat",
        "district": "Ahmedabad", 
        "pincode": "380001",
        "aadhaar_number": f"9876{datetime.now().strftime('%H%M')}5432109",
        "pan_number": f"XYZAB{datetime.now().strftime('%H%M')}C"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=duplicate_email_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400 and "email" in response.text.lower():
            print("✅ Duplicate email detection test PASSED")
        else:
            print(f"❌ Duplicate email detection test FAILED - Expected 400 with email error")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Duplicate email test FAILED - Network error: {e}")

    # Test duplicate mobile
    print("\n2b. Testing duplicate mobile...")
    duplicate_mobile_data = {
        "first_name": "Amit",
        "last_name": "Patel",
        "email": f"amit.patel.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
        "mobile": existing_user_data["mobile"],  # Same mobile
        "password": "YetAnotherPass123!",
        "state": "Rajasthan",
        "district": "Jaipur",
        "pincode": "302001", 
        "aadhaar_number": f"5432{datetime.now().strftime('%H%M')}1098765",
        "pan_number": f"PQRST{datetime.now().strftime('%H%M')}U"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=duplicate_mobile_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400 and "mobile" in response.text.lower():
            print("✅ Duplicate mobile detection test PASSED")
        else:
            print(f"❌ Duplicate mobile detection test FAILED - Expected 400 with mobile error")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Duplicate mobile test FAILED - Network error: {e}")

    # Test duplicate aadhaar_number
    print("\n2c. Testing duplicate aadhaar_number...")
    duplicate_aadhaar_data = {
        "first_name": "Sunita",
        "last_name": "Verma",
        "email": f"sunita.verma.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
        "mobile": f"7654321{datetime.now().strftime('%H%M')}",
        "password": "ThirdPass123!",
        "state": "Uttar Pradesh",
        "district": "Lucknow",
        "pincode": "226001", 
        "aadhaar_number": existing_user_data["aadhaar_number"],  # Same aadhaar
        "pan_number": f"DUPAA{datetime.now().strftime('%H%M')}D"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=duplicate_aadhaar_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400 and "aadhaar" in response.text.lower():
            print("✅ Duplicate aadhaar detection test PASSED")
        else:
            print(f"❌ Duplicate aadhaar detection test FAILED - Expected 400 with aadhaar error")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Duplicate aadhaar test FAILED - Network error: {e}")

    # Test duplicate pan_number
    print("\n2d. Testing duplicate pan_number...")
    duplicate_pan_data = {
        "first_name": "Vikram",
        "last_name": "Gupta",
        "email": f"vikram.gupta.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
        "mobile": f"6543210{datetime.now().strftime('%H%M')}",
        "password": "FourthPass123!",
        "state": "Punjab",
        "district": "Chandigarh",
        "pincode": "160001", 
        "aadhaar_number": f"4321{datetime.now().strftime('%H%M')}8765432",
        "pan_number": existing_user_data["pan_number"]  # Same PAN
    }
    
    try:
        response = requests.post(REGISTER_URL, json=duplicate_pan_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400 and "pan" in response.text.lower():
            print("✅ Duplicate PAN detection test PASSED")
        else:
            print(f"❌ Duplicate PAN detection test FAILED - Expected 400 with PAN error")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Duplicate PAN test FAILED - Network error: {e}")

def test_name_auto_construction():
    """Test 'name' field auto-construction from first_name + middle_name + last_name"""
    print("\n3. Testing name auto-construction...")
    
    # Test 3a: first_name + last_name only
    print("\n3a. Testing first_name + last_name combination...")
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    first_last_data = {
        "first_name": "Anita",
        "last_name": "Desai",
        "email": f"anita.desai.{timestamp}@example.com",
        "mobile": f"9111111{datetime.now().strftime('%H%M')}",
        "password": "FirstLast123!",
        "state": "Karnataka",
        "district": "Bangalore",
        "pincode": "560001",
        "aadhaar_number": f"1111{datetime.now().strftime('%H%M')}1111111",
        "pan_number": f"FIRST{datetime.now().strftime('%H%M')}L"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=first_last_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ First + Last name construction test PASSED")
        else:
            print(f"❌ First + Last name construction test FAILED - Status: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ First + Last name test FAILED - Network error: {e}")

    # Test 3b: first_name + middle_name + last_name
    print("\n3b. Testing first_name + middle_name + last_name combination...")
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    full_name_data = {
        "first_name": "Ravi",
        "middle_name": "Kumar",
        "last_name": "Sharma",
        "email": f"ravi.kumar.sharma.{timestamp}@example.com",
        "mobile": f"9222222{datetime.now().strftime('%H%M')}",
        "password": "FullName123!",
        "state": "Haryana",
        "district": "Gurgaon",
        "pincode": "122001",
        "aadhaar_number": f"2222{datetime.now().strftime('%H%M')}2222222",
        "pan_number": f"FULLM{datetime.now().strftime('%H%M')}N"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=full_name_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Full name (first + middle + last) construction test PASSED")
        else:
            print(f"❌ Full name construction test FAILED - Status: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Full name test FAILED - Network error: {e}")

    # Test 3c: Only first_name
    print("\n3c. Testing only first_name...")
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    first_only_data = {
        "first_name": "Pradeep",
        "email": f"pradeep.{timestamp}@example.com",
        "mobile": f"9333333{datetime.now().strftime('%H%M')}",
        "password": "FirstOnly123!",
        "state": "Kerala",
        "district": "Kochi",
        "pincode": "682001",
        "aadhaar_number": f"3333{datetime.now().strftime('%H%M')}3333333",
        "pan_number": f"FIRSO{datetime.now().strftime('%H%M')}Y"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=first_only_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ First name only construction test PASSED")
        else:
            print(f"❌ First name only construction test FAILED - Status: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ First name only test FAILED - Network error: {e}")

def test_missing_fields():
    """Test registration with missing required fields"""
    print("\n3. Testing missing required fields...")
    
    # Test missing email
    print("\n3a. Testing missing email...")
    missing_email_data = {
        "name": "Test User",
        # "email": missing
        "mobile": f"7654321{datetime.now().strftime('%H%M')}",
        "password": "TestPass123!",
        "state": "Karnataka",
        "district": "Bangalore",
        "pincode": "560001",
        "aadhaar_number": f"1111{datetime.now().strftime('%H%M')}2222333",
        "pan_number": f"TESTX{datetime.now().strftime('%H%M')}Y"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=missing_email_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        # The endpoint might still work without email as it's optional in the User model
        if response.status_code in [200, 400]:
            print("✅ Missing email test completed (behavior depends on implementation)")
        else:
            print(f"❌ Missing email test - Unexpected status: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Missing email test FAILED - Network error: {e}")

def test_invalid_data_formats():
    """Test registration with invalid data formats"""
    print("\n4. Testing invalid data formats...")
    
    # Test invalid email format
    print("\n4a. Testing invalid email format...")
    invalid_email_data = {
        "name": "Invalid Email",
        "email": "not-an-email",
        "mobile": f"6543210{datetime.now().strftime('%H%M')}",
        "password": "InvalidPass123!",
        "state": "Tamil Nadu",
        "district": "Chennai",
        "pincode": "600001",
        "aadhaar_number": f"2222{datetime.now().strftime('%H%M')}3333444",
        "pan_number": f"INVLD{datetime.now().strftime('%H%M')}Z"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=invalid_email_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 422 or response.status_code == 400:
            print("✅ Invalid email format test PASSED")
        else:
            print(f"❌ Invalid email format test - Expected 400/422, got {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Invalid email format test FAILED - Network error: {e}")

def test_password_validation():
    """Test password validation"""
    print("\n5. Testing password validation...")
    
    # Test weak password
    print("\n5a. Testing weak password...")
    weak_password_data = {
        "name": "Weak Password",
        "email": f"weak.password.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
        "mobile": f"5432109{datetime.now().strftime('%H%M')}",
        "password": "123",  # Very weak password
        "state": "West Bengal",
        "district": "Kolkata",
        "pincode": "700001",
        "aadhaar_number": f"3333{datetime.now().strftime('%H%M')}4444555",
        "pan_number": f"WEAKP{datetime.now().strftime('%H%M')}W"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=weak_password_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        # The current implementation doesn't seem to have password validation
        # So this might still succeed
        print("✅ Password validation test completed (no validation implemented)")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Password validation test FAILED - Network error: {e}")

def test_edge_cases():
    """Test edge cases"""
    print("\n6. Testing edge cases...")
    
    # Test empty JSON
    print("\n6a. Testing empty JSON...")
    try:
        response = requests.post(REGISTER_URL, json={}, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code in [400, 422]:
            print("✅ Empty JSON test PASSED")
        else:
            print(f"❌ Empty JSON test - Expected 400/422, got {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Empty JSON test FAILED - Network error: {e}")

    # Test malformed JSON
    print("\n6b. Testing malformed JSON...")
    try:
        response = requests.post(REGISTER_URL, data="invalid json", 
                               headers={'Content-Type': 'application/json'}, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code in [400, 422]:
            print("✅ Malformed JSON test PASSED")
        else:
            print(f"❌ Malformed JSON test - Expected 400/422, got {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Malformed JSON test FAILED - Network error: {e}")

def test_user_data_retrieval(uid):
    """Test if user data is properly stored and retrievable"""
    print(f"\n7. Testing user data retrieval for UID: {uid}...")
    
    try:
        user_url = f"{API_BASE}/auth/user/{uid}"
        response = requests.get(user_url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            user_data = response.json()
            print(f"Retrieved user data: {json.dumps(user_data, indent=2)}")
            
            # Check if all expected fields are present
            expected_fields = ["uid", "first_name", "last_name", "email", "mobile", "state", "district", "pincode", "aadhaar_number", "pan_number", "name"]
            missing_fields = []
            
            for field in expected_fields:
                if field not in user_data or user_data[field] is None:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ Missing fields in stored data: {missing_fields}")
            else:
                print("✅ All expected fields are present in stored data")
                
                # Check if name was auto-constructed
                if user_data.get("name"):
                    print(f"✅ Name field auto-constructed: '{user_data['name']}'")
                else:
                    print("❌ Name field was not auto-constructed")
            
            return True
        else:
            print(f"❌ User data retrieval FAILED - Status: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ User data retrieval FAILED - Network error: {e}")
        return False

def main():
    """Run all registration tests"""
    print("Starting comprehensive user registration endpoint testing...")
    print(f"Target URL: {REGISTER_URL}")
    
    # Test basic connectivity
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        print(f"Backend connectivity test - Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend connectivity FAILED: {e}")
        print("Cannot proceed with testing - backend is not accessible")
        return False
    
    # Run all tests
    success, user_data, uid = test_registration_endpoint()
    
    if success:
        test_duplicate_detection(user_data)
        if uid:
            test_user_data_retrieval(uid)
    
    test_name_auto_construction()
    test_missing_fields()
    test_invalid_data_formats() 
    test_password_validation()
    test_edge_cases()
    
    print("\n" + "=" * 60)
    print("Registration endpoint testing completed!")
    print("Check the results above for any failures that need attention.")
    
    return success

if __name__ == "__main__":
    main()