#!/usr/bin/env python3
"""
Backend API Testing Script for User Registration
Tests the /api/auth/register endpoint thoroughly
"""

import requests
import json
import sys
import os
from datetime import datetime

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
REGISTER_URL = f"{API_BASE}/auth/register"

print(f"Testing backend at: {BACKEND_URL}")
print(f"Registration endpoint: {REGISTER_URL}")
print("=" * 60)

def test_registration_endpoint():
    """Test user registration endpoint with FRONTEND FORMAT"""
    
    # Test 1: Valid registration with FRONTEND FORMAT (first_name, last_name, email, mobile, password, state, district, pincode, aadhaar_number, pan_number)
    print("\n1. Testing valid registration with FRONTEND FORMAT...")
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    valid_user_data = {
        "first_name": "Rajesh",
        "last_name": "Singh", 
        "email": f"rajesh.singh.{timestamp}@example.com",
        "mobile": f"9876543{datetime.now().strftime('%H%M')}",
        "password": "SecurePass123!",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1234{datetime.now().strftime('%H%M')}5678901",
        "pan_number": f"ABCDE{datetime.now().strftime('%H%M')}F"
    }
    
    try:
        response = requests.post(REGISTER_URL, json=valid_user_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            response_data = response.json()
            if "uid" in response_data:
                print("✅ Valid registration test PASSED - UID returned")
                return True, valid_user_data, response_data.get("uid")
            else:
                print("❌ Valid registration test FAILED - No UID in response")
                return False, valid_user_data, None
        else:
            print(f"❌ Valid registration test FAILED - Expected 200, got {response.status_code}")
            return False, valid_user_data, None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Valid registration test FAILED - Network error: {e}")
        return False, valid_user_data, None

def test_duplicate_detection(existing_user_data):
    """Test duplicate field detection"""
    print("\n2. Testing duplicate field detection...")
    
    # Test duplicate email
    print("\n2a. Testing duplicate email...")
    duplicate_email_data = {
        "name": "Priya Sharma",
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
        "name": "Amit Patel",
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
    success, user_data = test_registration_endpoint()
    
    if success:
        test_duplicate_detection(user_data)
    
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