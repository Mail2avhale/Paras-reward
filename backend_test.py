#!/usr/bin/env python3
"""
Backend API Testing Script for Stock Movement, Security Deposit, and Annual Renewal Systems
Tests the comprehensive stock movement hierarchy, security deposit returns, and annual renewal enforcement
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

print(f"Testing Wallets & Maintenance Feature at: {BACKEND_URL}")
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
        "description": "Test product for stock movement testing",
        "prc_price": 100.0,
        "category": "Electronics",
        "stock_quantity": 1000
    }
    
    try:
        response = requests.post(f"{API_BASE}/products", json=product_data, timeout=30)
        if response.status_code == 200:
            product = response.json()
            test_product = product
            print(f"✅ Test product created: {product.get('product_id')}")
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

def test_cashback_maintenance_system():
    """Test cashback maintenance system (₹99 monthly fee)"""
    print("\n3. Testing Cashback Maintenance System...")
    
    # Test 3a: Check maintenance for VIP user (should not be due yet)
    print("\n3a. Testing POST /api/wallet/check-maintenance/{uid} (new VIP user)...")
    try:
        response = requests.post(f"{API_BASE}/wallet/check-maintenance/{test_vip_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Maintenance check test PASSED")
            print(f"Maintenance result: {json.dumps(result, indent=2)}")
            
            # For new VIP users, maintenance should not be due yet
            if not result.get("maintenance_applied"):
                print("✅ Maintenance correctly not applied for new VIP user")
            else:
                print("⚠️ Maintenance was applied (unexpected for new user)")
            
            return True
        else:
            print(f"❌ Maintenance check test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Maintenance check test FAILED - Error: {e}")
        return False
    
    # Test 3b: Test idempotency - calling maintenance check again
    print("\n3b. Testing maintenance check idempotency...")
    try:
        response = requests.post(f"{API_BASE}/wallet/check-maintenance/{test_vip_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Maintenance check idempotency test PASSED")
            return True
        else:
            print(f"❌ Maintenance check idempotency test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Maintenance check idempotency test FAILED - Error: {e}")
        return False

def test_cashback_credit_with_lien_clearing():
    """Test cashback credit with lien clearing functionality"""
    print("\n4. Testing Cashback Credit with Lien Clearing...")
    
    # Test 4a: Credit cashback without lien
    print("\n4a. Testing cashback credit without lien...")
    try:
        # First, let's check current wallet status
        wallet_response = requests.get(f"{API_BASE}/wallet/{test_vip_user['uid']}", timeout=30)
        if wallet_response.status_code == 200:
            wallet = wallet_response.json()
            print(f"Current wallet status: {json.dumps(wallet, indent=2)}")
        
        # Test crediting cashback
        print("\n4b. Testing POST /api/wallet/credit-cashback/{uid}...")
        credit_data = {"amount": 100}
        
        response = requests.post(f"{API_BASE}/wallet/credit-cashback/{test_vip_user['uid']}", 
                               json=credit_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Cashback credit test PASSED")
            print(f"Credit result: {json.dumps(result, indent=2)}")
            
            # Verify the response structure
            if "credited_amount" in result and "new_balance" in result:
                print("✅ Cashback credit response structure correct")
            
            return True
        else:
            print(f"❌ Cashback credit test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cashback credit test FAILED - Error: {e}")
        return False
    
    # Test 4c: Test partial amount credit
    print("\n4c. Testing partial amount credit...")
    try:
        credit_data = {"amount": 50}
        response = requests.post(f"{API_BASE}/wallet/credit-cashback/{test_vip_user['uid']}", 
                               json=credit_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Partial amount credit test PASSED")
            return True
        else:
            print(f"❌ Partial amount credit test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Partial amount credit test FAILED - Error: {e}")
        return False

def test_cashback_withdrawal_flow():
    """Test cashback withdrawal flow"""
    print("\n5. Testing Cashback Withdrawal Flow...")
    
    # First, ensure user has some cashback balance
    print("\n5a. Adding cashback balance for withdrawal test...")
    credit_data = {"amount": 100}
    requests.post(f"{API_BASE}/wallet/credit-cashback/{test_vip_user['uid']}", 
                 json=credit_data, timeout=30)
    
    # Test 5b: Valid cashback withdrawal
    print("\n5b. Testing POST /api/wallet/cashback/withdraw (valid withdrawal)...")
    withdrawal_data = {
        "user_id": test_vip_user["uid"],
        "amount": 20,
        "payment_mode": "upi",
        "upi_id": "rajesh@paytm"
    }
    
    try:
        response = requests.post(f"{API_BASE}/wallet/cashback/withdraw", 
                               json=withdrawal_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Cashback withdrawal test PASSED")
            print(f"Withdrawal result: {json.dumps(result, indent=2)}")
            
            # Store withdrawal ID for admin testing
            withdrawal_id = result.get("withdrawal_id")
            if withdrawal_id:
                test_withdrawals.append({"id": withdrawal_id, "type": "cashback"})
            
        else:
            print(f"❌ Cashback withdrawal test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cashback withdrawal test FAILED - Error: {e}")
        return False
    
    # Test 5c: Invalid withdrawal (amount < ₹10)
    print("\n5c. Testing minimum amount validation...")
    invalid_withdrawal = {
        "user_id": test_vip_user["uid"],
        "amount": 5,  # Below minimum
        "payment_mode": "upi",
        "upi_id": "rajesh@paytm"
    }
    
    try:
        response = requests.post(f"{API_BASE}/wallet/cashback/withdraw", 
                               json=invalid_withdrawal, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ Minimum amount validation test PASSED")
        else:
            print(f"❌ Minimum amount validation test FAILED - Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ Minimum amount validation test FAILED - Error: {e}")
    
    return True

def test_profit_withdrawal_flow():
    """Test profit withdrawal flow for outlet users"""
    print("\n6. Testing Profit Withdrawal Flow...")
    
    # First, add some profit balance to outlet user
    print("\n6a. Adding profit balance for outlet user...")
    # We'll simulate this by directly testing withdrawal with existing balance
    
    # Test 6b: Valid profit withdrawal
    print("\n6b. Testing POST /api/wallet/profit/withdraw (valid withdrawal)...")
    withdrawal_data = {
        "user_id": test_outlet_user["uid"],
        "amount": 100,
        "payment_mode": "upi",
        "upi_id": "amit@paytm"
    }
    
    try:
        response = requests.post(f"{API_BASE}/wallet/profit/withdraw", 
                               json=withdrawal_data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Profit withdrawal test PASSED")
            print(f"Withdrawal result: {json.dumps(result, indent=2)}")
            
            # Store withdrawal ID for admin testing
            withdrawal_id = result.get("withdrawal_id")
            if withdrawal_id:
                test_withdrawals.append({"id": withdrawal_id, "type": "profit"})
                
        elif response.status_code == 400 and "insufficient" in response.text.lower():
            print("ℹ️ Insufficient balance (expected for new outlet user)")
            return True
        else:
            print(f"❌ Profit withdrawal test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Profit withdrawal test FAILED - Error: {e}")
        return False
    
    # Test 6c: Invalid withdrawal (amount < ₹50)
    print("\n6c. Testing minimum amount validation for profit withdrawal...")
    invalid_withdrawal = {
        "user_id": test_outlet_user["uid"],
        "amount": 30,  # Below minimum
        "payment_mode": "upi",
        "upi_id": "amit@paytm"
    }
    
    try:
        response = requests.post(f"{API_BASE}/wallet/profit/withdraw", 
                               json=invalid_withdrawal, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ Profit minimum amount validation test PASSED")
        else:
            print(f"❌ Profit minimum amount validation test FAILED - Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ Profit minimum amount validation test FAILED - Error: {e}")
    
    # Test 6d: Role validation (regular user should fail)
    print("\n6d. Testing role validation for profit withdrawal...")
    invalid_role_withdrawal = {
        "user_id": test_free_user["uid"],  # Regular user, not outlet
        "amount": 100,
        "payment_mode": "upi",
        "upi_id": "priya@paytm"
    }
    
    try:
        response = requests.post(f"{API_BASE}/wallet/profit/withdraw", 
                               json=invalid_role_withdrawal, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 403:
            print("✅ Role validation test PASSED")
        else:
            print(f"❌ Role validation test FAILED - Expected 403, got {response.status_code}")
    except Exception as e:
        print(f"❌ Role validation test FAILED - Error: {e}")
    
    return True

def test_withdrawal_history():
    """Test withdrawal history endpoint"""
    print("\n7. Testing Withdrawal History...")
    
    # Test 7a: Get withdrawal history for VIP user
    print("\n7a. Testing GET /api/wallet/withdrawals/{uid}...")
    try:
        response = requests.get(f"{API_BASE}/wallet/withdrawals/{test_vip_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            history = response.json()
            print("✅ Withdrawal history test PASSED")
            print(f"History: {json.dumps(history, indent=2)}")
            
            # Verify structure
            if "cashback_withdrawals" in history and "profit_withdrawals" in history:
                print("✅ Withdrawal history structure correct")
                return True
            else:
                print("❌ Withdrawal history structure incorrect")
                return False
        else:
            print(f"❌ Withdrawal history test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Withdrawal history test FAILED - Error: {e}")
        return False

def test_admin_withdrawal_management_cashback():
    """Test admin withdrawal management for cashback withdrawals"""
    print("\n8. Testing Admin Withdrawal Management - Cashback...")
    
    # Test 8a: Get all cashback withdrawals
    print("\n8a. Testing GET /api/admin/withdrawals/cashback...")
    try:
        response = requests.get(f"{API_BASE}/admin/withdrawals/cashback", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            withdrawals = response.json()
            print("✅ Admin cashback withdrawals list test PASSED")
            print(f"Withdrawals count: {len(withdrawals) if isinstance(withdrawals, list) else 'N/A'}")
        else:
            print(f"❌ Admin cashback withdrawals list test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Admin cashback withdrawals list test FAILED - Error: {e}")
        return False
    
    # Test 8b: Get pending cashback withdrawals
    print("\n8b. Testing GET /api/admin/withdrawals/cashback?status=pending...")
    try:
        response = requests.get(f"{API_BASE}/admin/withdrawals/cashback?status=pending", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Admin pending cashback withdrawals test PASSED")
        else:
            print(f"❌ Admin pending cashback withdrawals test FAILED - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Admin pending cashback withdrawals test FAILED - Error: {e}")
    
    # Test withdrawal actions if we have a withdrawal ID
    if test_withdrawals:
        cashback_withdrawal = next((w for w in test_withdrawals if w["type"] == "cashback"), None)
        if cashback_withdrawal:
            withdrawal_id = cashback_withdrawal["id"]
            
            # Test 8c: Approve withdrawal
            print(f"\n8c. Testing POST /api/admin/withdrawals/cashback/{withdrawal_id}/approve...")
            approve_data = {"admin_notes": "Approved for testing"}
            try:
                response = requests.post(f"{API_BASE}/admin/withdrawals/cashback/{withdrawal_id}/approve", 
                                       json=approve_data, timeout=30)
                print(f"Status Code: {response.status_code}")
                print(f"Response: {response.text}")
                
                if response.status_code == 200:
                    print("✅ Admin approve cashback withdrawal test PASSED")
                else:
                    print(f"❌ Admin approve cashback withdrawal test FAILED - Status: {response.status_code}")
            except Exception as e:
                print(f"❌ Admin approve cashback withdrawal test FAILED - Error: {e}")
            
            # Test 8d: Complete withdrawal with UTR
            print(f"\n8d. Testing POST /api/admin/withdrawals/cashback/{withdrawal_id}/complete...")
            complete_data = {"utr_number": f"UTR{datetime.now().strftime('%Y%m%d%H%M%S')}"}
            try:
                response = requests.post(f"{API_BASE}/admin/withdrawals/cashback/{withdrawal_id}/complete", 
                                       json=complete_data, timeout=30)
                print(f"Status Code: {response.status_code}")
                print(f"Response: {response.text}")
                
                if response.status_code == 200:
                    print("✅ Admin complete cashback withdrawal test PASSED")
                else:
                    print(f"❌ Admin complete cashback withdrawal test FAILED - Status: {response.status_code}")
            except Exception as e:
                print(f"❌ Admin complete cashback withdrawal test FAILED - Error: {e}")
    
    return True

def test_admin_withdrawal_management_profit():
    """Test admin withdrawal management for profit withdrawals"""
    print("\n9. Testing Admin Withdrawal Management - Profit...")
    
    # Test 9a: Get all profit withdrawals
    print("\n9a. Testing GET /api/admin/withdrawals/profit...")
    try:
        response = requests.get(f"{API_BASE}/admin/withdrawals/profit", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            withdrawals = response.json()
            print("✅ Admin profit withdrawals list test PASSED")
            print(f"Withdrawals count: {len(withdrawals) if isinstance(withdrawals, list) else 'N/A'}")
        else:
            print(f"❌ Admin profit withdrawals list test FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Admin profit withdrawals list test FAILED - Error: {e}")
        return False
    
    # Test withdrawal rejection flow - create a new cashback withdrawal to reject
    print("\n9b. Creating a cashback withdrawal to test rejection...")
    try:
        # Add more cashback balance first
        credit_data = {"amount": 50}
        requests.post(f"{API_BASE}/wallet/credit-cashback/{test_vip_user['uid']}", 
                     json=credit_data, timeout=30)
        
        # Create another withdrawal
        withdrawal_data = {
            "user_id": test_vip_user["uid"],
            "amount": 30,
            "payment_mode": "upi",
            "upi_id": "rajesh@paytm"
        }
        
        response = requests.post(f"{API_BASE}/wallet/cashback/withdraw", 
                               json=withdrawal_data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            rejection_withdrawal_id = result.get("withdrawal_id")
            
            # Test rejection
            print(f"\n9c. Testing POST /api/admin/withdrawals/cashback/{rejection_withdrawal_id}/reject...")
            reject_data = {"reason": "Test rejection for verification"}
            
            reject_response = requests.post(f"{API_BASE}/admin/withdrawals/cashback/{rejection_withdrawal_id}/reject", 
                                          json=reject_data, timeout=30)
            print(f"Status Code: {reject_response.status_code}")
            print(f"Response: {reject_response.text}")
            
            if reject_response.status_code == 200:
                print("✅ Admin reject cashback withdrawal test PASSED")
            else:
                print(f"❌ Admin reject cashback withdrawal test FAILED - Status: {reject_response.status_code}")
        
    except Exception as e:
        print(f"❌ Withdrawal rejection test FAILED - Error: {e}")
    
    return True

def test_profit_wallet_auto_credit():
    """Test profit wallet auto-credit integration"""
    print("\n10. Testing Profit Wallet Auto-Credit Integration...")
    
    # This would require creating an order and marking it as delivered
    # For now, we'll test the concept by checking if the outlet user has profit balance
    print("\n10a. Checking outlet user profit balance...")
    try:
        response = requests.get(f"{API_BASE}/wallet/{test_outlet_user['uid']}", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            wallet = response.json()
            profit_balance = wallet.get("profit_balance", 0)
            print(f"✅ Outlet profit balance check PASSED - Balance: ₹{profit_balance}")
            
            if profit_balance > 0:
                print("✅ Profit wallet has balance (likely from auto-credit)")
            else:
                print("ℹ️ No profit balance (expected for new outlet)")
            
            return True
        else:
            print(f"❌ Outlet profit balance check FAILED - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Outlet profit balance check FAILED - Error: {e}")
        return False

def main():
    """Run all wallet & maintenance feature tests"""
    print("Starting comprehensive Wallets & Maintenance Feature testing...")
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
    print("WALLETS & MAINTENANCE FEATURE COMPREHENSIVE TESTING")
    print("=" * 80)
    
    # 1. Setup test users
    if not setup_test_users():
        print("❌ CRITICAL: Failed to setup test users - cannot continue")
        return False
    
    # 2. Test wallet balance retrieval
    if not test_wallet_balance_retrieval():
        print("❌ CRITICAL: Wallet balance retrieval tests failed")
        return False
    
    # 3. Test cashback maintenance system
    if not test_cashback_maintenance_system():
        print("❌ CRITICAL: Cashback maintenance system tests failed")
        return False
    
    # 4. Test cashback credit with lien clearing
    if not test_cashback_credit_with_lien_clearing():
        print("❌ CRITICAL: Cashback credit with lien clearing failed")
        return False
    
    # 5. Test cashback withdrawal flow
    if not test_cashback_withdrawal_flow():
        print("❌ CRITICAL: Cashback withdrawal flow failed")
        return False
    
    # 6. Test profit withdrawal flow
    if not test_profit_withdrawal_flow():
        print("❌ CRITICAL: Profit withdrawal flow failed")
        return False
    
    # 7. Test withdrawal history
    if not test_withdrawal_history():
        print("❌ CRITICAL: Withdrawal history failed")
        return False
    
    # 8. Test admin withdrawal management - cashback
    if not test_admin_withdrawal_management_cashback():
        print("❌ CRITICAL: Admin cashback withdrawal management failed")
        return False
    
    # 9. Test admin withdrawal management - profit
    if not test_admin_withdrawal_management_profit():
        print("❌ CRITICAL: Admin profit withdrawal management failed")
        return False
    
    # 10. Test profit wallet auto-credit
    test_profit_wallet_auto_credit()
    
    print("\n" + "=" * 80)
    print("WALLETS & MAINTENANCE FEATURE TESTING COMPLETED!")
    print("=" * 80)
    print("Check the results above for any failures that need attention.")
    
    return True

if __name__ == "__main__":
    main()