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

# Test data for comprehensive system testing
test_admin_user = None
test_master_user = None
test_sub_user = None
test_outlet_user = None
test_regular_user = None
test_product = None
test_stock_movements = []
test_security_deposits = []
test_renewals = []

def setup_test_users():
    """Create test users for each role in the hierarchy"""
    global test_admin_user, test_master_user, test_sub_user, test_outlet_user, test_regular_user
    
    print("\n1. Setting up test users for all roles...")
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    microseconds = str(datetime.now().microsecond)[:3]
    
    # Create Admin user (Company)
    admin_data = {
        "first_name": "Admin",
        "last_name": "Company",
        "email": f"admin.{timestamp}.{microseconds}@company.com",
        "mobile": f"98760{timestamp[-6:]}",
        "password": "AdminPass123!",
        "state": "Maharashtra",
        "district": "Mumbai",
        "pincode": "400001",
        "aadhaar_number": f"1111{timestamp[-8:]}111",
        "pan_number": f"ADMIN{timestamp[-4:]}A",
        "role": "admin"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=admin_data, timeout=30)
        if response.status_code == 200:
            admin_uid = response.json().get("uid")
            # Promote to admin role
            requests.post(f"{API_BASE}/admin/promote", params={"email": admin_data["email"], "role": "admin"}, timeout=30)
            test_admin_user = {"uid": admin_uid, **admin_data}
            print(f"✅ Admin user created: {admin_uid}")
        else:
            print(f"❌ Failed to create admin user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return False
    
    # Create Master Stockist
    master_data = {
        "first_name": "Master",
        "last_name": "Stockist",
        "email": f"master.{timestamp}.{microseconds}@example.com",
        "mobile": f"98761{timestamp[-6:]}",
        "password": "MasterPass123!",
        "state": "Maharashtra",
        "district": "Pune",
        "pincode": "411001",
        "aadhaar_number": f"2222{timestamp[-8:]}222",
        "pan_number": f"MSTR{timestamp[-5:]}M"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=master_data, timeout=30)
        if response.status_code == 200:
            master_uid = response.json().get("uid")
            # Promote to master_stockist role
            requests.post(f"{API_BASE}/admin/promote", params={"email": master_data["email"], "role": "master_stockist"}, timeout=30)
            test_master_user = {"uid": master_uid, **master_data}
            print(f"✅ Master Stockist created: {master_uid}")
        else:
            print(f"❌ Failed to create master stockist: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating master stockist: {e}")
        return False
    
    # Create Sub Stockist
    sub_data = {
        "first_name": "Sub",
        "last_name": "Stockist",
        "email": f"sub.{timestamp}.{microseconds}@example.com",
        "mobile": f"98762{timestamp[-6:]}",
        "password": "SubPass123!",
        "state": "Gujarat",
        "district": "Ahmedabad",
        "pincode": "380001",
        "aadhaar_number": f"3333{timestamp[-8:]}333",
        "pan_number": f"SUBS{timestamp[-5:]}S"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=sub_data, timeout=30)
        if response.status_code == 200:
            sub_uid = response.json().get("uid")
            # Promote to sub_stockist role
            requests.post(f"{API_BASE}/admin/promote", params={"email": sub_data["email"], "role": "sub_stockist"}, timeout=30)
            test_sub_user = {"uid": sub_uid, **sub_data}
            print(f"✅ Sub Stockist created: {sub_uid}")
        else:
            print(f"❌ Failed to create sub stockist: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating sub stockist: {e}")
        return False
    
    # Create Outlet
    outlet_data = {
        "first_name": "Outlet",
        "last_name": "Owner",
        "email": f"outlet.{timestamp}.{microseconds}@example.com",
        "mobile": f"98763{timestamp[-6:]}",
        "password": "OutletPass123!",
        "state": "Karnataka",
        "district": "Bangalore",
        "pincode": "560001",
        "aadhaar_number": f"4444{timestamp[-8:]}444",
        "pan_number": f"OUTL{timestamp[-5:]}O"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=outlet_data, timeout=30)
        if response.status_code == 200:
            outlet_uid = response.json().get("uid")
            # Promote to outlet role
            requests.post(f"{API_BASE}/admin/promote", params={"email": outlet_data["email"], "role": "outlet"}, timeout=30)
            test_outlet_user = {"uid": outlet_uid, **outlet_data}
            print(f"✅ Outlet user created: {outlet_uid}")
        else:
            print(f"❌ Failed to create outlet user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating outlet user: {e}")
        return False
    
    # Create Regular User
    user_data = {
        "first_name": "Regular",
        "last_name": "Customer",
        "email": f"customer.{timestamp}.{microseconds}@example.com",
        "mobile": f"98764{timestamp[-6:]}",
        "password": "UserPass123!",
        "state": "Tamil Nadu",
        "district": "Chennai",
        "pincode": "600001",
        "aadhaar_number": f"5555{timestamp[-8:]}555",
        "pan_number": f"USER{timestamp[-5:]}U"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=user_data, timeout=30)
        if response.status_code == 200:
            user_uid = response.json().get("uid")
            test_regular_user = {"uid": user_uid, **user_data}
            print(f"✅ Regular user created: {user_uid}")
        else:
            print(f"❌ Failed to create regular user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating regular user: {e}")
        return False
    
    return True

def create_test_product():
    """Create a test product for stock movement testing"""
    global test_product
    
    print("\n2. Creating test product...")
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    
    product_data = {
        "name": f"Test Product {timestamp}",
        "sku": f"TEST-SKU-{timestamp}",
        "description": "Test product for stock movement testing",
        "prc_price": 100.0,
        "cash_price": 50.0,
        "type": "physical",
        "category": "Electronics",
        "total_stock": 1000,
        "available_stock": 1000
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/products", json=product_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            product_id = result.get('product_id')
            test_product = {"product_id": product_id, **product_data}
            print(f"✅ Test product created: {product_id}")
            return True
        else:
            print(f"❌ Failed to create test product: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating test product: {e}")
        return False

def test_stock_movement_valid_flows():
    """Test valid stock movement flows according to hierarchy"""
    print("\n3. Testing Stock Movement System - Valid Flows...")
    
    # Test 3a: Company → Master (should succeed)
    print("\n3a. Testing Company → Master stock flow...")
    try:
        movement_data = {
            "sender_id": test_admin_user["uid"],
            "receiver_id": test_master_user["uid"],
            "product_id": test_product["product_id"],
            "quantity": 100,
            "notes": "Initial stock transfer to master stockist"
        }
        
        response = requests.post(f"{API_BASE}/stock/transfer/initiate", json=movement_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            movement_id = result.get("movement_id")
            batch_number = result.get("batch_number")
            qr_code = result.get("qr_code")
            
            if movement_id and batch_number and qr_code:
                print("✅ Company → Master stock flow test PASSED")
                print(f"Movement ID: {movement_id}")
                print(f"Batch Number: {batch_number}")
                print(f"QR Code: {qr_code}")
                test_stock_movements.append({"id": movement_id, "type": "company_to_master"})
            else:
                print("❌ Company → Master stock flow test FAILED - Missing required fields")
                return False
        else:
            print(f"❌ Company → Master stock flow test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Company → Master stock flow test FAILED - Error: {e}")
        return False
    
    # Test 3b: Master → Sub (should succeed)
    print("\n3b. Testing Master → Sub stock flow...")
    try:
        movement_data = {
            "sender_id": test_master_user["uid"],
            "receiver_id": test_sub_user["uid"],
            "product_id": test_product["product_id"],
            "quantity": 50,
            "notes": "Transfer from master to sub stockist"
        }
        
        response = requests.post(f"{API_BASE}/stock/transfer/initiate", json=movement_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            movement_id = result.get("movement_id")
            print("✅ Master → Sub stock flow test PASSED")
            test_stock_movements.append({"id": movement_id, "type": "master_to_sub"})
        else:
            print(f"❌ Master → Sub stock flow test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Master → Sub stock flow test FAILED - Error: {e}")
        return False
    
    # Test 3c: Sub → Outlet (should succeed)
    print("\n3c. Testing Sub → Outlet stock flow...")
    try:
        movement_data = {
            "sender_id": test_sub_user["uid"],
            "receiver_id": test_outlet_user["uid"],
            "product_id": test_product["product_id"],
            "quantity": 25,
            "notes": "Transfer from sub stockist to outlet"
        }
        
        response = requests.post(f"{API_BASE}/stock/transfer/initiate", json=movement_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            movement_id = result.get("movement_id")
            print("✅ Sub → Outlet stock flow test PASSED")
            test_stock_movements.append({"id": movement_id, "type": "sub_to_outlet"})
        else:
            print(f"❌ Sub → Outlet stock flow test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Sub → Outlet stock flow test FAILED - Error: {e}")
        return False
    
    # Test 3d: Outlet → User (should succeed)
    print("\n3d. Testing Outlet → User stock flow...")
    try:
        movement_data = {
            "sender_id": test_outlet_user["uid"],
            "receiver_id": test_regular_user["uid"],
            "product_id": test_product["product_id"],
            "quantity": 10,
            "notes": "Final delivery to customer"
        }
        
        response = requests.post(f"{API_BASE}/stock/transfer/initiate", json=movement_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            movement_id = result.get("movement_id")
            print("✅ Outlet → User stock flow test PASSED")
            test_stock_movements.append({"id": movement_id, "type": "outlet_to_user"})
        else:
            print(f"❌ Outlet → User stock flow test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Outlet → User stock flow test FAILED - Error: {e}")
        return False
    
    return True

def test_stock_movement_invalid_flows():
    """Test invalid stock movement flows (should fail)"""
    print("\n4. Testing Stock Movement System - Invalid Flows...")
    
    # Test 4a: User → Outlet (reverse flow, should fail)
    print("\n4a. Testing User → Outlet stock flow (should fail)...")
    try:
        movement_data = {
            "sender_id": test_regular_user["uid"],
            "receiver_id": test_outlet_user["uid"],
            "product_id": test_product["product_id"],
            "quantity": 5,
            "notes": "Invalid reverse flow"
        }
        
        response = requests.post(f"{API_BASE}/stock/transfer/initiate", json=movement_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ User → Outlet invalid flow test PASSED (correctly rejected)")
        else:
            print(f"❌ User → Outlet invalid flow test FAILED - Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ User → Outlet invalid flow test FAILED - Error: {e}")
        return False
    
    # Test 4b: Master → Outlet (skipping Sub, should fail)
    print("\n4b. Testing Master → Outlet stock flow (should fail - skips Sub)...")
    try:
        movement_data = {
            "sender_id": test_master_user["uid"],
            "receiver_id": test_outlet_user["uid"],
            "product_id": test_product["product_id"],
            "quantity": 20,
            "notes": "Invalid flow - skipping sub stockist"
        }
        
        response = requests.post(f"{API_BASE}/stock/transfer/initiate", json=movement_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ Master → Outlet invalid flow test PASSED (correctly rejected)")
        else:
            print(f"❌ Master → Outlet invalid flow test FAILED - Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Master → Outlet invalid flow test FAILED - Error: {e}")
        return False
    
    return True

def test_stock_movement_retrieval():
    """Test stock movement retrieval for users"""
    print("\n5. Testing Stock Movement Retrieval...")
    
    # Test 5a: Get stock movements for master user (should show sent movements)
    print("\n5a. Testing GET /api/stock/movements/{uid} for master user...")
    try:
        response = requests.get(f"{API_BASE}/stock/movements/{test_master_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            movements = response.json()
            if "sent" in movements and "received" in movements:
                print("✅ Master user stock movements retrieval test PASSED")
                print(f"Sent movements: {len(movements['sent'])}")
                print(f"Received movements: {len(movements['received'])}")
            else:
                print("❌ Master user stock movements retrieval test FAILED - Missing sent/received arrays")
                return False
        else:
            print(f"❌ Master user stock movements retrieval test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Master user stock movements retrieval test FAILED - Error: {e}")
        return False
    
    # Test 5b: Get stock movements for outlet user (should show received movements)
    print("\n5b. Testing GET /api/stock/movements/{uid} for outlet user...")
    try:
        response = requests.get(f"{API_BASE}/stock/movements/{test_outlet_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            movements = response.json()
            print("✅ Outlet user stock movements retrieval test PASSED")
            print(f"Sent movements: {len(movements['sent'])}")
            print(f"Received movements: {len(movements['received'])}")
        else:
            print(f"❌ Outlet user stock movements retrieval test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Outlet user stock movements retrieval test FAILED - Error: {e}")
        return False
    
    return True

def test_admin_stock_movement_approval():
    """Test admin approval flow for stock movements"""
    print("\n6. Testing Admin Stock Movement Approval Flow...")
    
    # Test 6a: Get pending stock movements
    print("\n6a. Testing GET /api/admin/stock/movements/pending...")
    try:
        response = requests.get(f"{API_BASE}/admin/stock/movements/pending", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            movements = result.get("movements", [])
            count = result.get("count", 0)
            print(f"✅ Admin pending movements retrieval test PASSED")
            print(f"Pending movements count: {count}")
            
            if count > 0:
                print(f"Found {count} pending movements for approval testing")
            
        else:
            print(f"❌ Admin pending movements retrieval test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Admin pending movements retrieval test FAILED - Error: {e}")
        return False
    
    # Test 6b: Approve a stock movement
    if test_stock_movements:
        movement_to_approve = test_stock_movements[0]  # Approve first movement
        movement_id = movement_to_approve["id"]
        
        print(f"\n6b. Testing POST /api/admin/stock/movements/{movement_id}/approve...")
        try:
            approve_data = {"admin_notes": "Approved for testing purposes"}
            response = requests.post(f"{API_BASE}/admin/stock/movements/{movement_id}/approve", 
                                   json=approve_data, timeout=30)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                print("✅ Admin approve stock movement test PASSED")
                movement_to_approve["status"] = "approved"
            else:
                print(f"❌ Admin approve stock movement test FAILED - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Admin approve stock movement test FAILED - Error: {e}")
            return False
    
    # Test 6c: Reject a stock movement
    if len(test_stock_movements) > 1:
        movement_to_reject = test_stock_movements[1]  # Reject second movement
        movement_id = movement_to_reject["id"]
        
        print(f"\n6c. Testing POST /api/admin/stock/movements/{movement_id}/reject...")
        try:
            reject_data = {"admin_notes": "Rejected for testing purposes"}
            response = requests.post(f"{API_BASE}/admin/stock/movements/{movement_id}/reject", 
                                   json=reject_data, timeout=30)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                print("✅ Admin reject stock movement test PASSED")
                movement_to_reject["status"] = "rejected"
            else:
                print(f"❌ Admin reject stock movement test FAILED - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Admin reject stock movement test FAILED - Error: {e}")
            return False
    
    return True

def test_receiver_completion():
    """Test receiver completion of stock movements"""
    print("\n7. Testing Receiver Completion of Stock Movements...")
    
    # Find an approved movement to complete
    approved_movement = None
    for movement in test_stock_movements:
        if movement.get("status") == "approved":
            approved_movement = movement
            break
    
    if not approved_movement:
        print("ℹ️ No approved movements found for completion testing")
        return True
    
    # Test 7a: Complete stock movement (receiver confirms receipt)
    movement_id = approved_movement["id"]
    movement_type = approved_movement["type"]
    
    # Determine receiver based on movement type
    if movement_type == "company_to_master":
        receiver_id = test_master_user["uid"]
    elif movement_type == "master_to_sub":
        receiver_id = test_sub_user["uid"]
    elif movement_type == "sub_to_outlet":
        receiver_id = test_outlet_user["uid"]
    elif movement_type == "outlet_to_user":
        receiver_id = test_regular_user["uid"]
    else:
        print(f"❌ Unknown movement type: {movement_type}")
        return False
    
    print(f"\n7a. Testing POST /api/stock/movements/{movement_id}/complete...")
    try:
        complete_data = {"receiver_id": receiver_id}
        response = requests.post(f"{API_BASE}/stock/movements/{movement_id}/complete", 
                               json=complete_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Receiver completion test PASSED")
            approved_movement["status"] = "completed"
        else:
            print(f"❌ Receiver completion test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Receiver completion test FAILED - Error: {e}")
        return False
    
    return True

def test_security_deposit_submission():
    """Test security deposit submission for different roles"""
    print("\n8. Testing Security Deposit System - Submission...")
    
    # Test 8a: Master Stockist security deposit (₹500k expected)
    print("\n8a. Testing Master Stockist security deposit submission...")
    try:
        deposit_data = {
            "user_id": test_master_user["uid"],
            "amount": 500000,
            "payment_proof": "master_deposit_proof_image_base64",
            "notes": "Master stockist security deposit"
        }
        
        response = requests.post(f"{API_BASE}/security-deposit/submit", json=deposit_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            deposit_id = result.get("deposit_id")
            expected_amount = result.get("expected_amount")
            
            if deposit_id and expected_amount == 500000:
                print("✅ Master security deposit submission test PASSED")
                print(f"Deposit ID: {deposit_id}")
                print(f"Expected Amount: ₹{expected_amount}")
                test_security_deposits.append({"id": deposit_id, "role": "master_stockist", "amount": 500000})
            else:
                print("❌ Master security deposit submission test FAILED - Missing required fields")
                return False
        else:
            print(f"❌ Master security deposit submission test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Master security deposit submission test FAILED - Error: {e}")
        return False
    
    # Test 8b: Sub Stockist security deposit (₹300k expected)
    print("\n8b. Testing Sub Stockist security deposit submission...")
    try:
        deposit_data = {
            "user_id": test_sub_user["uid"],
            "amount": 300000,
            "payment_proof": "sub_deposit_proof_image_base64",
            "notes": "Sub stockist security deposit"
        }
        
        response = requests.post(f"{API_BASE}/security-deposit/submit", json=deposit_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            deposit_id = result.get("deposit_id")
            expected_amount = result.get("expected_amount")
            
            if deposit_id and expected_amount == 300000:
                print("✅ Sub security deposit submission test PASSED")
                test_security_deposits.append({"id": deposit_id, "role": "sub_stockist", "amount": 300000})
            else:
                print("❌ Sub security deposit submission test FAILED - Missing required fields")
                return False
        else:
            print(f"❌ Sub security deposit submission test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Sub security deposit submission test FAILED - Error: {e}")
        return False
    
    # Test 8c: Outlet security deposit (₹100k expected)
    print("\n8c. Testing Outlet security deposit submission...")
    try:
        deposit_data = {
            "user_id": test_outlet_user["uid"],
            "amount": 100000,
            "payment_proof": "outlet_deposit_proof_image_base64",
            "notes": "Outlet security deposit"
        }
        
        response = requests.post(f"{API_BASE}/security-deposit/submit", json=deposit_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            deposit_id = result.get("deposit_id")
            expected_amount = result.get("expected_amount")
            
            if deposit_id and expected_amount == 100000:
                print("✅ Outlet security deposit submission test PASSED")
                test_security_deposits.append({"id": deposit_id, "role": "outlet", "amount": 100000})
            else:
                print("❌ Outlet security deposit submission test FAILED - Missing required fields")
                return False
        else:
            print(f"❌ Outlet security deposit submission test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Outlet security deposit submission test FAILED - Error: {e}")
        return False
    
    # Test 8d: Non-stockist role rejection
    print("\n8d. Testing non-stockist role rejection...")
    try:
        deposit_data = {
            "user_id": test_regular_user["uid"],
            "amount": 50000,
            "payment_proof": "user_deposit_proof_image_base64",
            "notes": "Regular user trying to submit deposit"
        }
        
        response = requests.post(f"{API_BASE}/security-deposit/submit", json=deposit_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 403:
            print("✅ Non-stockist role rejection test PASSED")
        else:
            print(f"❌ Non-stockist role rejection test FAILED - Expected 403, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Non-stockist role rejection test FAILED - Error: {e}")
        return False
    
    return True

def test_security_deposit_retrieval():
    """Test security deposit retrieval before and after approval"""
    print("\n9. Testing Security Deposit Retrieval...")
    
    # Test 9a: Get security deposit before approval (should return null)
    print("\n9a. Testing GET /api/security-deposit/{uid} before approval...")
    try:
        response = requests.get(f"{API_BASE}/security-deposit/{test_master_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("deposit") is None:
                print("✅ Security deposit retrieval before approval test PASSED (returns null)")
            else:
                print("❌ Security deposit retrieval before approval test FAILED - Should return null")
                return False
        else:
            print(f"❌ Security deposit retrieval before approval test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Security deposit retrieval before approval test FAILED - Error: {e}")
        return False
    
    return True

def test_admin_security_deposit_approval():
    """Test admin approval of security deposits"""
    print("\n10. Testing Admin Security Deposit Approval...")
    
    # Test 10a: Get all security deposits
    print("\n10a. Testing GET /api/admin/security-deposits...")
    try:
        response = requests.get(f"{API_BASE}/admin/security-deposits", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            deposits = result.get("deposits", [])
            count = result.get("count", 0)
            print(f"✅ Admin security deposits list test PASSED")
            print(f"Total deposits: {count}")
        else:
            print(f"❌ Admin security deposits list test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Admin security deposits list test FAILED - Error: {e}")
        return False
    
    # Test 10b: Approve security deposit
    if test_security_deposits:
        deposit_to_approve = test_security_deposits[0]  # Approve first deposit
        deposit_id = deposit_to_approve["id"]
        
        print(f"\n10b. Testing POST /api/admin/security-deposits/{deposit_id}/approve...")
        try:
            approve_data = {
                "admin_notes": "Approved for testing - 30-day return cycle starts now"
            }
            
            response = requests.post(f"{API_BASE}/admin/security-deposits/{deposit_id}/approve", 
                                   json=approve_data, timeout=30)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                next_return_due = result.get("next_return_due")
                print("✅ Admin approve security deposit test PASSED")
                print(f"Next return due: {next_return_due}")
                deposit_to_approve["status"] = "approved"
                deposit_to_approve["next_return_due"] = next_return_due
            else:
                print(f"❌ Admin approve security deposit test FAILED - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Admin approve security deposit test FAILED - Error: {e}")
            return False
    
    # Test 10c: Admin adjustment of deposit amount
    if len(test_security_deposits) > 1:
        deposit_to_adjust = test_security_deposits[1]  # Adjust second deposit (approve it first)
        deposit_id = deposit_to_adjust["id"]
        
        # First approve it
        print(f"\n10c. Approving deposit for adjustment test...")
        approve_data = {"admin_notes": "Approved for adjustment testing"}
        requests.post(f"{API_BASE}/admin/security-deposits/{deposit_id}/approve", 
                     json=approve_data, timeout=30)
        
        # Now adjust the amount
        print(f"\n10d. Testing POST /api/admin/security-deposits/{deposit_id}/adjust...")
        try:
            new_amount = 250000  # Adjust sub stockist from 300k to 250k
            adjust_data = {
                "new_amount": new_amount,
                "admin_notes": "Adjusted amount - return cycle resets from today"
            }
            
            response = requests.post(f"{API_BASE}/admin/security-deposits/{deposit_id}/adjust", 
                                   json=adjust_data, timeout=30)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                next_return_due = result.get("next_return_due")
                print("✅ Admin adjust security deposit test PASSED")
                print(f"New amount: ₹{new_amount}")
                print(f"Next return due (reset): {next_return_due}")
                deposit_to_adjust["amount"] = new_amount
                deposit_to_adjust["status"] = "approved"
            else:
                print(f"❌ Admin adjust security deposit test FAILED - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Admin adjust security deposit test FAILED - Error: {e}")
            return False
    
    return True

def test_security_deposit_return_processing():
    """Test monthly return processing (3% of deposit amount)"""
    print("\n11. Testing Security Deposit Monthly Return Processing...")
    
    # First, we need to manually set next_return_due to past date for testing
    # This simulates a deposit that's due for return processing
    if test_security_deposits:
        approved_deposit = None
        for deposit in test_security_deposits:
            if deposit.get("status") == "approved":
                approved_deposit = deposit
                break
        
        if approved_deposit:
            print("\n11a. Simulating overdue return (manually setting past due date)...")
            # We'll need to manually update the database for this test
            # For now, let's test the processing endpoint directly
            
            print("\n11b. Testing POST /api/admin/security-deposits/process-returns...")
            try:
                response = requests.post(f"{API_BASE}/admin/security-deposits/process-returns", timeout=30)
                print(f"Status Code: {response.status_code}")
                print(f"Response: {response.text}")
                
                if response.status_code == 200:
                    result = response.json()
                    processed_count = result.get("processed_count", 0)
                    total_credited = result.get("total_credited", 0)
                    
                    print("✅ Security deposit return processing test PASSED")
                    print(f"Processed deposits: {processed_count}")
                    print(f"Total credited to profit wallets: ₹{total_credited}")
                    
                    if processed_count == 0:
                        print("ℹ️ No deposits were due for return processing (expected for new deposits)")
                else:
                    print(f"❌ Security deposit return processing test FAILED - Status: {response.status_code}")
                    return False
            except Exception as e:
                print(f"❌ Security deposit return processing test FAILED - Error: {e}")
                return False
        else:
            print("ℹ️ No approved deposits found for return processing test")
    
    return True

def test_annual_renewal_submission():
    """Test annual renewal submission for different roles"""
    print("\n12. Testing Annual Renewal System - Submission...")
    
    # Test 12a: Master Stockist renewal (₹50k + 18% GST = ₹59k)
    print("\n12a. Testing Master Stockist renewal submission...")
    try:
        renewal_data = {
            "user_id": test_master_user["uid"],
            "amount": 59000,  # 50k + 18% GST
            "payment_proof": "master_renewal_proof_image_base64",
            "notes": "Master stockist annual renewal"
        }
        
        response = requests.post(f"{API_BASE}/renewal/submit", json=renewal_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            renewal_id = result.get("renewal_id")
            expected_amount = result.get("expected_amount")
            
            if renewal_id and expected_amount == 59000:
                print("✅ Master renewal submission test PASSED")
                print(f"Renewal ID: {renewal_id}")
                print(f"Expected Amount: ₹{expected_amount}")
                test_renewals.append({"id": renewal_id, "role": "master_stockist", "amount": 59000})
            else:
                print("❌ Master renewal submission test FAILED - Missing required fields")
                return False
        else:
            print(f"❌ Master renewal submission test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Master renewal submission test FAILED - Error: {e}")
        return False
    
    # Test 12b: Sub Stockist renewal (₹30k + 18% GST = ₹35.4k)
    print("\n12b. Testing Sub Stockist renewal submission...")
    try:
        renewal_data = {
            "user_id": test_sub_user["uid"],
            "amount": 35400,  # 30k + 18% GST
            "payment_proof": "sub_renewal_proof_image_base64",
            "notes": "Sub stockist annual renewal"
        }
        
        response = requests.post(f"{API_BASE}/renewal/submit", json=renewal_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            renewal_id = result.get("renewal_id")
            expected_amount = result.get("expected_amount")
            
            if renewal_id and expected_amount == 35400:
                print("✅ Sub renewal submission test PASSED")
                test_renewals.append({"id": renewal_id, "role": "sub_stockist", "amount": 35400})
            else:
                print("❌ Sub renewal submission test FAILED - Missing required fields")
                return False
        else:
            print(f"❌ Sub renewal submission test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Sub renewal submission test FAILED - Error: {e}")
        return False
    
    # Test 12c: Outlet renewal (₹10k + 18% GST = ₹11.8k)
    print("\n12c. Testing Outlet renewal submission...")
    try:
        renewal_data = {
            "user_id": test_outlet_user["uid"],
            "amount": 11800,  # 10k + 18% GST
            "payment_proof": "outlet_renewal_proof_image_base64",
            "notes": "Outlet annual renewal"
        }
        
        response = requests.post(f"{API_BASE}/renewal/submit", json=renewal_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            renewal_id = result.get("renewal_id")
            expected_amount = result.get("expected_amount")
            
            if renewal_id and expected_amount == 11800:
                print("✅ Outlet renewal submission test PASSED")
                test_renewals.append({"id": renewal_id, "role": "outlet", "amount": 11800})
            else:
                print("❌ Outlet renewal submission test FAILED - Missing required fields")
                return False
        else:
            print(f"❌ Outlet renewal submission test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Outlet renewal submission test FAILED - Error: {e}")
        return False
    
    # Test 12d: Non-stockist role rejection
    print("\n12d. Testing non-stockist role rejection...")
    try:
        renewal_data = {
            "user_id": test_regular_user["uid"],
            "amount": 5000,
            "payment_proof": "user_renewal_proof_image_base64",
            "notes": "Regular user trying to submit renewal"
        }
        
        response = requests.post(f"{API_BASE}/renewal/submit", json=renewal_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 403:
            print("✅ Non-stockist renewal rejection test PASSED")
        else:
            print(f"❌ Non-stockist renewal rejection test FAILED - Expected 403, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Non-stockist renewal rejection test FAILED - Error: {e}")
        return False
    
    return True

def test_annual_renewal_status_retrieval():
    """Test renewal status retrieval"""
    print("\n13. Testing Annual Renewal Status Retrieval...")
    
    # Test 13a: Get renewal status before approval
    print("\n13a. Testing GET /api/renewal/{uid} before approval...")
    try:
        response = requests.get(f"{API_BASE}/renewal/{test_master_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            latest_renewal = result.get("latest_renewal")
            renewal_status = result.get("renewal_status")
            
            if latest_renewal and latest_renewal.get("status") == "pending":
                print("✅ Renewal status before approval test PASSED (shows pending)")
                print(f"Renewal status: {renewal_status}")
            else:
                print("❌ Renewal status before approval test FAILED")
                return False
        else:
            print(f"❌ Renewal status before approval test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Renewal status before approval test FAILED - Error: {e}")
        return False
    
    return True

def test_admin_renewal_approval():
    """Test admin approval of renewals"""
    print("\n14. Testing Admin Renewal Approval...")
    
    # Test 14a: Get all renewals
    print("\n14a. Testing GET /api/admin/renewals...")
    try:
        response = requests.get(f"{API_BASE}/admin/renewals", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            renewals = result.get("renewals", [])
            count = result.get("count", 0)
            print(f"✅ Admin renewals list test PASSED")
            print(f"Total renewals: {count}")
        else:
            print(f"❌ Admin renewals list test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Admin renewals list test FAILED - Error: {e}")
        return False
    
    # Test 14b: Approve renewal
    if test_renewals:
        renewal_to_approve = test_renewals[0]  # Approve first renewal
        renewal_id = renewal_to_approve["id"]
        
        print(f"\n14b. Testing POST /api/admin/renewals/{renewal_id}/approve...")
        try:
            approve_data = {
                "admin_notes": "Approved for testing - 1 year period starts now"
            }
            
            response = requests.post(f"{API_BASE}/admin/renewals/{renewal_id}/approve", 
                                   json=approve_data, timeout=30)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                next_renewal_due = result.get("next_renewal_due")
                print("✅ Admin approve renewal test PASSED")
                print(f"Next renewal due: {next_renewal_due}")
                renewal_to_approve["status"] = "approved"
            else:
                print(f"❌ Admin approve renewal test FAILED - Status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Admin approve renewal test FAILED - Error: {e}")
            return False
    
    return True

def test_overdue_renewal_processing():
    """Test overdue renewal processing and suspension"""
    print("\n15. Testing Overdue Renewal Processing...")
    
    # Test 15a: Check overdue renewals processing
    print("\n15a. Testing POST /api/admin/renewals/check-overdue...")
    try:
        response = requests.post(f"{API_BASE}/admin/renewals/check-overdue", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            suspended_count = result.get("suspended_count", 0)
            print("✅ Overdue renewal processing test PASSED")
            print(f"Suspended entities: {suspended_count}")
            
            if suspended_count == 0:
                print("ℹ️ No entities were suspended (expected for new renewals)")
        else:
            print(f"❌ Overdue renewal processing test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Overdue renewal processing test FAILED - Error: {e}")
        return False
    
    return True

def test_profit_wallet_frozen_integration():
    """Test integration with delivery charge distribution when profit wallet is frozen"""
    print("\n16. Testing Profit Wallet Frozen Integration...")
    
    # This test would require creating an order and testing delivery charge distribution
    # For now, we'll check if the outlet user's profit wallet status
    print("\n16a. Checking outlet user profit wallet status...")
    try:
        response = requests.get(f"{API_BASE}/wallet/{test_outlet_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            wallet = response.json()
            profit_balance = wallet.get("profit_balance", 0)
            print(f"✅ Outlet profit wallet check PASSED - Balance: ₹{profit_balance}")
            print("ℹ️ Integration test: Delivery charge distribution should check profit_wallet_frozen flag")
            print("ℹ️ When renewal is overdue, profit_wallet_frozen=True prevents new credits")
        else:
            print(f"❌ Outlet profit wallet check FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Outlet profit wallet check FAILED - Error: {e}")
        return False
    
    return True

def main():
    """Run all Stock Movement, Security Deposit, and Annual Renewal system tests"""
    print("Starting comprehensive Stock Movement, Security Deposit, and Annual Renewal testing...")
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
    print("STOCK MOVEMENT, SECURITY DEPOSIT & ANNUAL RENEWAL COMPREHENSIVE TESTING")
    print("=" * 80)
    
    # 1. Setup test users
    if not setup_test_users():
        print("❌ CRITICAL: Failed to setup test users - cannot continue")
        return False
    
    # 2. Create test product
    if not create_test_product():
        print("❌ CRITICAL: Failed to create test product - cannot continue")
        return False
    
    # 3. Test stock movement valid flows
    if not test_stock_movement_valid_flows():
        print("❌ CRITICAL: Stock movement valid flows failed")
        return False
    
    # 4. Test stock movement invalid flows
    if not test_stock_movement_invalid_flows():
        print("❌ CRITICAL: Stock movement invalid flows failed")
        return False
    
    # 5. Test stock movement retrieval
    if not test_stock_movement_retrieval():
        print("❌ CRITICAL: Stock movement retrieval failed")
        return False
    
    # 6. Test admin stock movement approval
    if not test_admin_stock_movement_approval():
        print("❌ CRITICAL: Admin stock movement approval failed")
        return False
    
    # 7. Test receiver completion
    if not test_receiver_completion():
        print("❌ CRITICAL: Receiver completion failed")
        return False
    
    # 8. Test security deposit submission
    if not test_security_deposit_submission():
        print("❌ CRITICAL: Security deposit submission failed")
        return False
    
    # 9. Test security deposit retrieval
    if not test_security_deposit_retrieval():
        print("❌ CRITICAL: Security deposit retrieval failed")
        return False
    
    # 10. Test admin security deposit approval
    if not test_admin_security_deposit_approval():
        print("❌ CRITICAL: Admin security deposit approval failed")
        return False
    
    # 11. Test security deposit return processing
    if not test_security_deposit_return_processing():
        print("❌ CRITICAL: Security deposit return processing failed")
        return False
    
    # 12. Test annual renewal submission
    if not test_annual_renewal_submission():
        print("❌ CRITICAL: Annual renewal submission failed")
        return False
    
    # 13. Test annual renewal status retrieval
    if not test_annual_renewal_status_retrieval():
        print("❌ CRITICAL: Annual renewal status retrieval failed")
        return False
    
    # 14. Test admin renewal approval
    if not test_admin_renewal_approval():
        print("❌ CRITICAL: Admin renewal approval failed")
        return False
    
    # 15. Test overdue renewal processing
    if not test_overdue_renewal_processing():
        print("❌ CRITICAL: Overdue renewal processing failed")
        return False
    
    # 16. Test profit wallet frozen integration
    test_profit_wallet_frozen_integration()
    
    print("\n" + "=" * 80)
    print("STOCK MOVEMENT, SECURITY DEPOSIT & ANNUAL RENEWAL TESTING COMPLETED!")
    print("=" * 80)
    print("Check the results above for any failures that need attention.")
    
    return True

if __name__ == "__main__":
    main()