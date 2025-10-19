#!/usr/bin/env python3
"""
Test to demonstrate the registration fix needed
"""

import requests
import json
from datetime import datetime

# Get backend URL
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            BACKEND_URL = line.split('=', 1)[1].strip()
            break

API_BASE = f"{BACKEND_URL}/api"
REGISTER_URL = f"{API_BASE}/auth/register"

print("Testing registration with correct vs incorrect field names")
print("=" * 60)

# Test 1: What frontend currently sends (FAILS)
print("\n1. Testing with frontend format (first_name, last_name) - SHOULD FAIL:")
frontend_format = {
    "first_name": "John",
    "last_name": "Doe",
    "email": f"john.doe.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
    "mobile": "9876543210",
    "password": "password123",
    "state": "Maharashtra",
    "district": "Mumbai",
    "pincode": "400001",
    "aadhaar_number": "123456789012",
    "pan_number": "ABCDE1234F"
}

try:
    response = requests.post(REGISTER_URL, json=frontend_format, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")

# Test 2: What backend expects (WORKS)
print("\n2. Testing with backend format (name field) - SHOULD WORK:")
backend_format = {
    "name": "Jane Smith",
    "email": f"jane.smith.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
    "mobile": "9876543211",
    "password": "password123",
    "state": "Maharashtra", 
    "district": "Mumbai",
    "pincode": "400001",
    "aadhaar_number": "123456789013",
    "pan_number": "ABCDE1234G"
}

try:
    response = requests.post(REGISTER_URL, json=backend_format, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 60)
print("CONCLUSION:")
print("- Frontend sends first_name/last_name but backend expects 'name'")
print("- Backend User model missing: mobile, state, district, pincode, aadhaar_number, pan_number")
print("- These fields are silently ignored, breaking duplicate detection")
print("- Fix needed: Either update User model OR modify registration endpoint to handle first_name/last_name")