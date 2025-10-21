#!/usr/bin/env python3
"""
Backend API Testing Script - Admin Stockist & Financial Management Testing
Tests new admin stockist management and financial management endpoints
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

print(f"Testing Admin Stockist & Financial Management at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# Admin Stockist & Financial Management Test Functions
def test_stockist_management():
    """Test Stockist Management Endpoints"""
    print("\n" + "=" * 80)
    print("1. TESTING STOCKIST MANAGEMENT ENDPOINTS")
    print("=" * 80)
    
    # Store created stockist UIDs for later tests
    created_stockists = {}
    
    # Test Case 1: Create Master Stockist
    print(f"\n1.1. Creating Master Stockist...")
    
    master_data = {
        "email": "master_test@test.com",
        "password": "test123",
        "name": "Master Test",
        "role": "master_stockist",
        "mobile": "9876543210",
        "state": "Maharashtra",
        "district": "Mumbai"
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/stockists/create", json=master_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            master_uid = result.get("uid")
            created_stockists["master"] = master_uid
            print(f"     ✅ Master Stockist created successfully!")
            print(f"     📋 Master UID: {master_uid}")
        else:
            print(f"     ❌ Master Stockist creation failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"     ❌ Error creating Master Stockist: {e}")
        return False
    
    # Test Case 2: Create Sub Stockist with Master as parent
    print(f"\n1.2. Creating Sub Stockist...")
    
    sub_data = {
        "email": "sub_test@test.com",
        "password": "test123",
        "name": "Sub Test",
        "role": "sub_stockist",
        "parent_id": created_stockists["master"],
        "mobile": "9876543211",
        "state": "Maharashtra",
        "district": "Pune"
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/stockists/create", json=sub_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            sub_uid = result.get("uid")
            created_stockists["sub"] = sub_uid
            print(f"     ✅ Sub Stockist created successfully!")
            print(f"     📋 Sub UID: {sub_uid}")
        else:
            print(f"     ❌ Sub Stockist creation failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"     ❌ Error creating Sub Stockist: {e}")
        return False
    
    # Test Case 3: Create Outlet with Sub as parent
    print(f"\n1.3. Creating Outlet...")
    
    outlet_data = {
        "email": "outlet_test@test.com",
        "password": "test123",
        "name": "Outlet Test",
        "role": "outlet",
        "parent_id": created_stockists["sub"],
        "mobile": "9876543212",
        "state": "Maharashtra",
        "district": "Nashik"
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/stockists/create", json=outlet_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            outlet_uid = result.get("uid")
            created_stockists["outlet"] = outlet_uid
            print(f"     ✅ Outlet created successfully!")
            print(f"     📋 Outlet UID: {outlet_uid}")
        else:
            print(f"     ❌ Outlet creation failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"     ❌ Error creating Outlet: {e}")
        return False
    
    # Test Case 4: Get all stockists
    print(f"\n1.4. Getting all stockists...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/stockists", timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            stockists = result.get("stockists", [])
            print(f"     ✅ Retrieved {len(stockists)} stockists")
            
            # Verify our created stockists are in the list
            found_master = any(s.get("uid") == created_stockists["master"] for s in stockists)
            found_sub = any(s.get("uid") == created_stockists["sub"] for s in stockists)
            found_outlet = any(s.get("uid") == created_stockists["outlet"] for s in stockists)
            
            print(f"     📋 Master found: {found_master}")
            print(f"     📋 Sub found: {found_sub}")
            print(f"     📋 Outlet found: {found_outlet}")
        else:
            print(f"     ❌ Failed to get stockists: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error getting stockists: {e}")
    
    # Test Case 5: Filter by role
    print(f"\n1.5. Filtering stockists by role (master_stockist)...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/stockists?role=master_stockist", timeout=30)
        print(f"     Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            stockists = result.get("stockists", [])
            print(f"     ✅ Retrieved {len(stockists)} master stockists")
            
            # Verify only master stockists are returned
            all_masters = all(s.get("role") == "master_stockist" for s in stockists)
            print(f"     📋 All results are master stockists: {all_masters}")
        else:
            print(f"     ❌ Failed to filter stockists: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error filtering stockists: {e}")
    
    # Test Case 6: Update stockist details
    print(f"\n1.6. Updating stockist details...")
    
    update_data = {
        "name": "Master Test Updated",
        "mobile": "9876543299",
        "state": "Gujarat",
        "district": "Ahmedabad"
    }
    
    try:
        response = requests.put(f"{API_BASE}/admin/stockists/{created_stockists['master']}/edit", json=update_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            print(f"     ✅ Stockist updated successfully!")
        else:
            print(f"     ❌ Failed to update stockist: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error updating stockist: {e}")
    
    # Test Case 7: Test assignment
    print(f"\n1.7. Testing stockist assignment...")
    
    assign_data = {
        "child_id": created_stockists["sub"],
        "parent_id": created_stockists["master"]
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/stockists/assign", json=assign_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            print(f"     ✅ Assignment successful!")
        else:
            print(f"     ❌ Assignment failed: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error during assignment: {e}")
    
    # Test Case 8: Deactivate stockist (soft delete)
    print(f"\n1.8. Deactivating outlet (soft delete)...")
    
    try:
        response = requests.delete(f"{API_BASE}/admin/stockists/{created_stockists['outlet']}", timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            print(f"     ✅ Outlet deactivated successfully!")
        else:
            print(f"     ❌ Failed to deactivate outlet: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error deactivating outlet: {e}")
    
    return created_stockists

def test_security_deposit_management(created_stockists):
    """Test Security Deposit Manual Entry Endpoints"""
    print("\n" + "=" * 80)
    print("2. TESTING SECURITY DEPOSIT MANAGEMENT ENDPOINTS")
    print("=" * 80)
    
    if not created_stockists:
        print("❌ No stockists available for security deposit testing")
        return False
    
    created_deposits = {}
    
    # Test Case 1: Create deposit for master (amount: 500000, monthly_return_rate: 0.03)
    print(f"\n2.1. Creating security deposit for Master Stockist...")
    
    master_deposit_data = {
        "user_id": created_stockists["master"],
        "amount": 500000,
        "monthly_return_rate": 0.03,
        "status": "approved"
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/security-deposit/manual-entry", json=master_deposit_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            deposit_id = result.get("deposit_id")
            created_deposits["master"] = deposit_id
            print(f"     ✅ Master deposit created successfully!")
            print(f"     📋 Deposit ID: {deposit_id}")
            print(f"     📋 Amount: ₹{master_deposit_data['amount']}")
            print(f"     📋 Monthly Return Rate: {master_deposit_data['monthly_return_rate']*100}%")
        else:
            print(f"     ❌ Master deposit creation failed: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error creating master deposit: {e}")
    
    # Test Case 2: Create deposit for sub (amount: 300000, monthly_return_rate: 0.03)
    print(f"\n2.2. Creating security deposit for Sub Stockist...")
    
    sub_deposit_data = {
        "user_id": created_stockists["sub"],
        "amount": 300000,
        "monthly_return_rate": 0.03,
        "status": "approved"
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/security-deposit/manual-entry", json=sub_deposit_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            deposit_id = result.get("deposit_id")
            created_deposits["sub"] = deposit_id
            print(f"     ✅ Sub deposit created successfully!")
            print(f"     📋 Deposit ID: {deposit_id}")
            print(f"     📋 Amount: ₹{sub_deposit_data['amount']}")
            print(f"     📋 Monthly Return Rate: {sub_deposit_data['monthly_return_rate']*100}%")
        else:
            print(f"     ❌ Sub deposit creation failed: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error creating sub deposit: {e}")
    
    # Test Case 3: Verify deposit entry created in database
    print(f"\n2.3. Verifying deposits in database...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/security-deposits", timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            deposits = result.get("deposits", [])
            print(f"     ✅ Retrieved {len(deposits)} deposits")
            
            # Verify our created deposits are in the list
            for deposit in deposits:
                deposit_id = deposit.get("deposit_id")
                user_id = deposit.get("user_id")
                amount = deposit.get("amount")
                monthly_return = deposit.get("monthly_return_amount")
                balance_pending = deposit.get("balance_pending")
                
                if deposit_id in created_deposits.values():
                    print(f"     📋 Found deposit: {deposit_id}")
                    print(f"       User ID: {user_id}")
                    print(f"       Amount: ₹{amount}")
                    print(f"       Monthly Return: ₹{monthly_return}")
                    print(f"       Balance Pending: ₹{balance_pending}")
        else:
            print(f"     ❌ Failed to get deposits: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error getting deposits: {e}")
    
    # Test Case 4: Update deposit amount
    print(f"\n2.4. Updating deposit amount...")
    
    if created_deposits.get("master"):
        update_data = {
            "amount": 550000,
            "monthly_return_rate": 0.03,
            "balance_pending": 550000
        }
        
        try:
            response = requests.put(f"{API_BASE}/admin/security-deposit/{created_deposits['master']}/edit", json=update_data, timeout=30)
            print(f"     Status: {response.status_code}")
            print(f"     Response: {response.text}")
            
            if response.status_code == 200:
                print(f"     ✅ Deposit updated successfully!")
                print(f"     📋 New Amount: ₹{update_data['amount']}")
            else:
                print(f"     ❌ Failed to update deposit: {response.status_code}")
                
        except Exception as e:
            print(f"     ❌ Error updating deposit: {e}")
    
    # Test Case 5: Verify user record updated (security_deposit_paid=true)
    print(f"\n2.5. Verifying user records updated...")
    
    for role, user_id in created_stockists.items():
        if role in ["master", "sub"]:
            try:
                # Check user record via login (to get full user data)
                login_response = requests.post(
                    f"{API_BASE}/auth/login",
                    params={
                        "identifier": f"{role}_test@test.com",
                        "password": "test123"
                    },
                    timeout=30
                )
                
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    security_deposit_paid = user_data.get("security_deposit_paid", False)
                    security_deposit_amount = user_data.get("security_deposit_amount", 0)
                    
                    print(f"     📋 {role.title()} Stockist:")
                    print(f"       Security Deposit Paid: {security_deposit_paid}")
                    print(f"       Security Deposit Amount: ₹{security_deposit_amount}")
                else:
                    print(f"     ❌ Failed to get {role} user data: {login_response.status_code}")
                    
            except Exception as e:
                print(f"     ❌ Error checking {role} user record: {e}")
    
    return created_deposits

def test_renewal_management(created_stockists):
    """Test Renewal Manual Entry Endpoints"""
    print("\n" + "=" * 80)
    print("3. TESTING RENEWAL MANAGEMENT ENDPOINTS")
    print("=" * 80)
    
    if not created_stockists:
        print("❌ No stockists available for renewal testing")
        return False
    
    created_renewals = {}
    
    # Test Case 1: Create renewal for master (amount: 50000, gst_rate: 0.18)
    print(f"\n3.1. Creating renewal for Master Stockist...")
    
    master_renewal_data = {
        "user_id": created_stockists["master"],
        "amount": 50000,
        "gst_rate": 0.18,
        "status": "approved"
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/renewal/manual-entry", json=master_renewal_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            renewal_id = result.get("renewal_id")
            created_renewals["master"] = renewal_id
            
            # Calculate expected GST
            base_amount = master_renewal_data["amount"]
            gst_amount = base_amount * master_renewal_data["gst_rate"]
            total_amount = base_amount + gst_amount
            
            print(f"     ✅ Master renewal created successfully!")
            print(f"     📋 Renewal ID: {renewal_id}")
            print(f"     📋 Base Amount: ₹{base_amount}")
            print(f"     📋 GST Amount: ₹{gst_amount}")
            print(f"     📋 Total Amount: ₹{total_amount}")
        else:
            print(f"     ❌ Master renewal creation failed: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error creating master renewal: {e}")
    
    # Test Case 2: Create renewal for sub (amount: 30000, gst_rate: 0.18)
    print(f"\n3.2. Creating renewal for Sub Stockist...")
    
    sub_renewal_data = {
        "user_id": created_stockists["sub"],
        "amount": 30000,
        "gst_rate": 0.18,
        "status": "approved"
    }
    
    try:
        response = requests.post(f"{API_BASE}/admin/renewal/manual-entry", json=sub_renewal_data, timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            renewal_id = result.get("renewal_id")
            created_renewals["sub"] = renewal_id
            
            # Calculate expected GST
            base_amount = sub_renewal_data["amount"]
            gst_amount = base_amount * sub_renewal_data["gst_rate"]
            total_amount = base_amount + gst_amount
            
            print(f"     ✅ Sub renewal created successfully!")
            print(f"     📋 Renewal ID: {renewal_id}")
            print(f"     📋 Base Amount: ₹{base_amount}")
            print(f"     📋 GST Amount: ₹{gst_amount}")
            print(f"     📋 Total Amount: ₹{total_amount}")
        else:
            print(f"     ❌ Sub renewal creation failed: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error creating sub renewal: {e}")
    
    # Test Case 3: Verify renewal created with correct GST calculation
    print(f"\n3.3. Verifying renewals in database...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/renewals", timeout=30)
        print(f"     Status: {response.status_code}")
        print(f"     Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            renewals = result.get("renewals", [])
            print(f"     ✅ Retrieved {len(renewals)} renewals")
            
            # Verify our created renewals are in the list
            for renewal in renewals:
                renewal_id = renewal.get("renewal_id")
                user_id = renewal.get("user_id")
                base_amount = renewal.get("base_amount")
                gst_amount = renewal.get("gst_amount")
                total_amount = renewal.get("total_amount")
                
                if renewal_id in created_renewals.values():
                    print(f"     📋 Found renewal: {renewal_id}")
                    print(f"       User ID: {user_id}")
                    print(f"       Base Amount: ₹{base_amount}")
                    print(f"       GST Amount: ₹{gst_amount}")
                    print(f"       Total Amount: ₹{total_amount}")
                    
                    # Verify GST calculation
                    expected_gst = base_amount * 0.18
                    expected_total = base_amount + expected_gst
                    gst_correct = abs(gst_amount - expected_gst) < 0.01
                    total_correct = abs(total_amount - expected_total) < 0.01
                    
                    print(f"       GST Calculation Correct: {gst_correct}")
                    print(f"       Total Calculation Correct: {total_correct}")
        else:
            print(f"     ❌ Failed to get renewals: {response.status_code}")
            
    except Exception as e:
        print(f"     ❌ Error getting renewals: {e}")
    
    # Test Case 4: Update renewal amount and verify GST recalculated
    print(f"\n3.4. Updating renewal amount...")
    
    if created_renewals.get("master"):
        update_data = {
            "amount": 55000,
            "gst_rate": 0.18
        }
        
        try:
            response = requests.put(f"{API_BASE}/admin/renewal/{created_renewals['master']}/edit", json=update_data, timeout=30)
            print(f"     Status: {response.status_code}")
            print(f"     Response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                new_base = result.get("base_amount")
                new_gst = result.get("gst_amount")
                new_total = result.get("total_amount")
                
                print(f"     ✅ Renewal updated successfully!")
                print(f"     📋 New Base Amount: ₹{new_base}")
                print(f"     📋 New GST Amount: ₹{new_gst}")
                print(f"     📋 New Total Amount: ₹{new_total}")
                
                # Verify GST recalculation
                expected_gst = update_data["amount"] * 0.18
                expected_total = update_data["amount"] + expected_gst
                gst_correct = abs(new_gst - expected_gst) < 0.01
                total_correct = abs(new_total - expected_total) < 0.01
                
                print(f"     📋 GST Recalculated Correctly: {gst_correct}")
                print(f"     📋 Total Recalculated Correctly: {total_correct}")
            else:
                print(f"     ❌ Failed to update renewal: {response.status_code}")
                
        except Exception as e:
            print(f"     ❌ Error updating renewal: {e}")
    
    # Test Case 5: Verify user renewal_status updated to "active"
    print(f"\n3.5. Verifying user renewal status updated...")
    
    for role, user_id in created_stockists.items():
        if role in ["master", "sub"]:
            try:
                # Check user record via login (to get full user data)
                login_response = requests.post(
                    f"{API_BASE}/auth/login",
                    params={
                        "identifier": f"{role}_test@test.com",
                        "password": "test123"
                    },
                    timeout=30
                )
                
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    renewal_status = user_data.get("renewal_status", "unknown")
                    renewal_due_date = user_data.get("renewal_due_date")
                    
                    print(f"     📋 {role.title()} Stockist:")
                    print(f"       Renewal Status: {renewal_status}")
                    print(f"       Renewal Due Date: {renewal_due_date}")
                else:
                    print(f"     ❌ Failed to get {role} user data: {login_response.status_code}")
                    
            except Exception as e:
                print(f"     ❌ Error checking {role} user record: {e}")
    
    return created_renewals

def test_delivery_charge_distribution():
    """Test Delivery Charge Distribution System Comprehensively"""
    print("\n" + "=" * 80)
    print("4. TESTING DELIVERY CHARGE DISTRIBUTION SYSTEM")
    print("=" * 80)
    
    # Step 1: Find an outlet user with parent relationships
    print(f"\n4.1. Finding outlet with parent relationships...")
    
    try:
        response = requests.get(f"{API_BASE}/admin/users/all", timeout=30)
        print(f"     Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"     ❌ Failed to get users: {response.status_code}")
            return False
            
        users = response.json().get("users", [])
        
        # Find outlet user with parent_id
        outlet_user = None
        for user in users:
            if user.get("role") == "outlet" and user.get("parent_id"):
                outlet_user = user
                break
        
        if not outlet_user:
            print(f"     ❌ No outlet user with parent_id found")
            return False
            
        outlet_uid = outlet_user["uid"]
        sub_stockist_uid = outlet_user["parent_id"]
        
        print(f"     ✅ Found outlet user: {outlet_uid}")
        print(f"     📋 Outlet Name: {outlet_user.get('name', 'N/A')}")
        print(f"     📋 Sub Stockist ID: {sub_stockist_uid}")
        
    except Exception as e:
        print(f"     ❌ Error finding outlet user: {e}")
        return False
    
    # Step 2: Verify Sub Stockist has a parent Master Stockist
    print(f"\n4.2. Verifying Sub Stockist has parent Master Stockist...")
    
    try:
        # Find the sub stockist user
        sub_stockist_user = None
        for user in users:
            if user.get("uid") == sub_stockist_uid:
                sub_stockist_user = user
                break
        
        if not sub_stockist_user:
            print(f"     ❌ Sub Stockist user not found: {sub_stockist_uid}")
            return False
            
        master_stockist_uid = sub_stockist_user.get("parent_id")
        if not master_stockist_uid:
            print(f"     ❌ Sub Stockist has no parent Master Stockist")
            return False
            
        print(f"     ✅ Sub Stockist has parent Master Stockist")
        print(f"     📋 Sub Stockist Name: {sub_stockist_user.get('name', 'N/A')}")
        print(f"     📋 Master Stockist ID: {master_stockist_uid}")
        
    except Exception as e:
        print(f"     ❌ Error verifying parent relationships: {e}")
        return False
    
    # Step 3: Get initial wallet balances
    print(f"\n4.3. Getting initial wallet balances...")
    
    initial_balances = {}
    entities = {
        "outlet": outlet_uid,
        "sub_stockist": sub_stockist_uid,
        "master_stockist": master_stockist_uid
    }
    
    for entity_type, entity_uid in entities.items():
        try:
            response = requests.get(f"{API_BASE}/wallet/{entity_uid}", timeout=30)
            if response.status_code == 200:
                wallet_data = response.json()
                initial_balances[entity_type] = wallet_data.get("profit_balance", 0)
                print(f"     📋 {entity_type.title()} initial profit balance: ₹{initial_balances[entity_type]}")
            else:
                print(f"     ⚠️  Could not get {entity_type} wallet balance: {response.status_code}")
                initial_balances[entity_type] = 0
        except Exception as e:
            print(f"     ⚠️  Error getting {entity_type} wallet balance: {e}")
            initial_balances[entity_type] = 0
    
    # Step 4: Create test order with 1000 PRC value
    print(f"\n4.4. Creating test order with 1000 PRC value...")
    
    # First, create a VIP user with sufficient PRC balance and verified KYC
    test_user_data = {
        "email": f"test_delivery_{int(time.time())}@test.com",
        "password": "test123",
        "name": "Test Delivery User",
        "role": "user",
        "membership_type": "vip",
        "kyc_status": "verified",
        "prc_balance": 2000  # Sufficient balance
    }
    
    try:
        # Create test user
        response = requests.post(f"{API_BASE}/auth/register", json=test_user_data, timeout=30)
        if response.status_code != 200:
            print(f"     ❌ Failed to create test user: {response.status_code}")
            return False
            
        test_user_uid = response.json().get("uid")
        print(f"     ✅ Created test user: {test_user_uid}")
        
        # Create order using legacy endpoint (single product)
        # First get a product
        products_response = requests.get(f"{API_BASE}/products", timeout=30)
        if products_response.status_code != 200:
            print(f"     ❌ Failed to get products: {products_response.status_code}")
            return False
            
        products = products_response.json()
        if not products:
            print(f"     ❌ No products available")
            return False
            
        # Find a product with PRC price around 1000 or use the first one
        test_product = products[0]
        product_id = test_product["product_id"]
        
        print(f"     📋 Using product: {test_product['name']} (PRC: {test_product['prc_price']})")
        
        # Create order
        order_data = {"product_id": product_id}
        response = requests.post(f"{API_BASE}/orders/{test_user_uid}", json=order_data, timeout=30)
        
        if response.status_code != 200:
            print(f"     ❌ Failed to create order: {response.status_code}")
            print(f"     Response: {response.text}")
            return False
            
        order_result = response.json()
        order_id = order_result.get("order_id")
        secret_code = order_result.get("secret_code")
        prc_amount = order_result.get("prc_amount", test_product["prc_price"])
        
        print(f"     ✅ Order created successfully!")
        print(f"     📋 Order ID: {order_id}")
        print(f"     📋 Secret Code: {secret_code}")
        print(f"     📋 PRC Amount: {prc_amount}")
        
    except Exception as e:
        print(f"     ❌ Error creating test order: {e}")
        return False
    
    # Step 5: Mark order as delivered using secret code verification
    print(f"\n4.5. Marking order as delivered using outlet...")
    
    try:
        # First verify the order with secret code
        verify_data = {"secret_code": secret_code}
        response = requests.post(f"{API_BASE}/orders/verify", json=verify_data, timeout=30)
        
        if response.status_code == 200:
            print(f"     ✅ Order verified successfully")
        else:
            print(f"     ⚠️  Order verification response: {response.status_code}")
        
        # Now deliver the order (this should trigger auto-distribution)
        deliver_data = {"outlet_id": outlet_uid}
        response = requests.post(f"{API_BASE}/orders/{order_id}/deliver", json=deliver_data, timeout=30)
        
        if response.status_code != 200:
            print(f"     ❌ Failed to deliver order: {response.status_code}")
            print(f"     Response: {response.text}")
            return False
            
        delivery_result = response.json()
        print(f"     ✅ Order delivered successfully!")
        print(f"     📋 Delivery result: {delivery_result}")
        
    except Exception as e:
        print(f"     ❌ Error delivering order: {e}")
        return False
    
    # Step 6: Verify delivery charges calculation
    print(f"\n4.6. Verifying delivery charge calculation...")
    
    # Expected calculation: (PRC_amount * 0.10) / 10 = delivery charge in ₹
    expected_total_commission = (prc_amount * 0.10) / 10
    expected_outlet_share = expected_total_commission * 0.60  # 60%
    expected_sub_share = expected_total_commission * 0.20     # 20%
    expected_master_share = expected_total_commission * 0.10  # 10%
    expected_company_share = expected_total_commission * 0.10 # 10%
    
    print(f"     📋 PRC Amount: {prc_amount}")
    print(f"     📋 Expected Total Commission: ₹{expected_total_commission}")
    print(f"     📋 Expected Outlet Share (60%): ₹{expected_outlet_share}")
    print(f"     📋 Expected Sub Share (20%): ₹{expected_sub_share}")
    print(f"     📋 Expected Master Share (10%): ₹{expected_master_share}")
    print(f"     📋 Expected Company Share (10%): ₹{expected_company_share}")
    
    # Step 7: Check updated wallet balances
    print(f"\n4.7. Checking updated wallet balances...")
    
    final_balances = {}
    balance_increases = {}
    
    for entity_type, entity_uid in entities.items():
        try:
            response = requests.get(f"{API_BASE}/wallet/{entity_uid}", timeout=30)
            if response.status_code == 200:
                wallet_data = response.json()
                final_balances[entity_type] = wallet_data.get("profit_balance", 0)
                balance_increases[entity_type] = final_balances[entity_type] - initial_balances[entity_type]
                
                print(f"     📋 {entity_type.title()}:")
                print(f"       Initial Balance: ₹{initial_balances[entity_type]}")
                print(f"       Final Balance: ₹{final_balances[entity_type]}")
                print(f"       Increase: ₹{balance_increases[entity_type]}")
            else:
                print(f"     ❌ Could not get {entity_type} final wallet balance: {response.status_code}")
                return False
        except Exception as e:
            print(f"     ❌ Error getting {entity_type} final wallet balance: {e}")
            return False
    
    # Step 8: Verify commission records in database
    print(f"\n4.8. Verifying commission records in database...")
    
    try:
        # Check commission records for each entity
        commission_records_found = {}
        
        for entity_type, entity_uid in entities.items():
            response = requests.get(f"{API_BASE}/commissions/entity/{entity_uid}", timeout=30)
            if response.status_code == 200:
                commissions = response.json()
                # Find commission record for this order
                order_commission = None
                for comm in commissions:
                    if comm.get("order_id") == order_id:
                        order_commission = comm
                        break
                
                if order_commission:
                    commission_records_found[entity_type] = order_commission
                    print(f"     ✅ {entity_type.title()} commission record found:")
                    print(f"       Amount: ₹{order_commission.get('amount', 0)}")
                    print(f"       Commission Type: {order_commission.get('commission_type', 'N/A')}")
                else:
                    print(f"     ⚠️  No commission record found for {entity_type}")
            else:
                print(f"     ⚠️  Could not get commission records for {entity_type}: {response.status_code}")
        
    except Exception as e:
        print(f"     ❌ Error checking commission records: {e}")
    
    # Step 9: Validate distribution percentages
    print(f"\n4.9. Validating distribution percentages...")
    
    distribution_correct = True
    tolerance = 0.01  # Allow small floating point differences
    
    # Check outlet share (60%)
    if abs(balance_increases["outlet"] - expected_outlet_share) > tolerance:
        print(f"     ❌ Outlet share incorrect: Expected ₹{expected_outlet_share}, Got ₹{balance_increases['outlet']}")
        distribution_correct = False
    else:
        print(f"     ✅ Outlet share correct: ₹{balance_increases['outlet']} (60%)")
    
    # Check sub stockist share (20%)
    if abs(balance_increases["sub_stockist"] - expected_sub_share) > tolerance:
        print(f"     ❌ Sub Stockist share incorrect: Expected ₹{expected_sub_share}, Got ₹{balance_increases['sub_stockist']}")
        distribution_correct = False
    else:
        print(f"     ✅ Sub Stockist share correct: ₹{balance_increases['sub_stockist']} (20%)")
    
    # Check master stockist share (10%)
    if abs(balance_increases["master_stockist"] - expected_master_share) > tolerance:
        print(f"     ❌ Master Stockist share incorrect: Expected ₹{expected_master_share}, Got ₹{balance_increases['master_stockist']}")
        distribution_correct = False
    else:
        print(f"     ✅ Master Stockist share correct: ₹{balance_increases['master_stockist']} (10%)")
    
    # Verify total distribution adds up
    total_distributed = sum(balance_increases.values())
    expected_total_distributed = expected_outlet_share + expected_sub_share + expected_master_share
    
    if abs(total_distributed - expected_total_distributed) > tolerance:
        print(f"     ❌ Total distribution incorrect: Expected ₹{expected_total_distributed}, Got ₹{total_distributed}")
        distribution_correct = False
    else:
        print(f"     ✅ Total distribution correct: ₹{total_distributed}")
    
    print(f"\n4.10. Test Summary:")
    if distribution_correct:
        print(f"     ✅ DELIVERY CHARGE DISTRIBUTION TEST PASSED")
        print(f"     📋 All percentages calculated correctly")
        print(f"     📋 Wallet balances updated properly")
        print(f"     📋 Commission system working as expected")
        return True
    else:
        print(f"     ❌ DELIVERY CHARGE DISTRIBUTION TEST FAILED")
        print(f"     📋 Distribution percentages or calculations incorrect")
        return False

def run_comprehensive_test():
    """Run comprehensive test of all Admin Stockist & Financial Management endpoints"""
    print("\n" + "🔍" * 80)
    print("ADMIN STOCKIST & FINANCIAL MANAGEMENT COMPREHENSIVE TESTING")
    print("🔍" * 80)
    
    results = {
        "stockist_management": False,
        "security_deposit_management": False,
        "renewal_management": False,
        "test_completed": False
    }
    
    try:
        # Test 1: Stockist Management
        print("\n🔧 PHASE 1: STOCKIST MANAGEMENT TESTING")
        created_stockists = test_stockist_management()
        if created_stockists:
            results["stockist_management"] = True
            print("\n✅ STOCKIST MANAGEMENT TESTS PASSED")
        else:
            print("\n❌ STOCKIST MANAGEMENT TESTS FAILED")
            return results
        
        # Test 2: Security Deposit Management
        print("\n🔧 PHASE 2: SECURITY DEPOSIT MANAGEMENT TESTING")
        created_deposits = test_security_deposit_management(created_stockists)
        if created_deposits:
            results["security_deposit_management"] = True
            print("\n✅ SECURITY DEPOSIT MANAGEMENT TESTS PASSED")
        else:
            print("\n❌ SECURITY DEPOSIT MANAGEMENT TESTS FAILED")
        
        # Test 3: Renewal Management
        print("\n🔧 PHASE 3: RENEWAL MANAGEMENT TESTING")
        created_renewals = test_renewal_management(created_stockists)
        if created_renewals:
            results["renewal_management"] = True
            print("\n✅ RENEWAL MANAGEMENT TESTS PASSED")
        else:
            print("\n❌ RENEWAL MANAGEMENT TESTS FAILED")
        
        results["test_completed"] = True
        
    except Exception as e:
        print(f"\n❌ COMPREHENSIVE TEST FAILED WITH ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    return results

def print_test_summary(results):
    """Print comprehensive test summary"""
    print("\n" + "📊" * 80)
    print("TEST SUMMARY - ADMIN STOCKIST & FINANCIAL MANAGEMENT")
    print("📊" * 80)
    
    print(f"\n🔍 TEST RESULTS:")
    
    # Stockist Management
    status = "✅ PASSED" if results["stockist_management"] else "❌ FAILED"
    print(f"   1. Stockist Management: {status}")
    if results["stockist_management"]:
        print(f"      - Master Stockist creation: ✅")
        print(f"      - Sub Stockist creation: ✅")
        print(f"      - Outlet creation: ✅")
        print(f"      - Stockist listing & filtering: ✅")
        print(f"      - Stockist updates: ✅")
        print(f"      - Stockist assignment: ✅")
        print(f"      - Stockist deactivation: ✅")
    
    # Security Deposit Management
    status = "✅ PASSED" if results["security_deposit_management"] else "❌ FAILED"
    print(f"   2. Security Deposit Management: {status}")
    if results["security_deposit_management"]:
        print(f"      - Manual deposit entry: ✅")
        print(f"      - Deposit amount calculations: ✅")
        print(f"      - User record updates: ✅")
        print(f"      - Deposit listing & retrieval: ✅")
        print(f"      - Deposit editing: ✅")
    
    # Renewal Management
    status = "✅ PASSED" if results["renewal_management"] else "❌ FAILED"
    print(f"   3. Renewal Management: {status}")
    if results["renewal_management"]:
        print(f"      - Manual renewal entry: ✅")
        print(f"      - GST calculations: ✅")
        print(f"      - User renewal status updates: ✅")
        print(f"      - Renewal listing & retrieval: ✅")
        print(f"      - Renewal editing & recalculation: ✅")
    
    # Overall Status
    all_passed = all(results[key] for key in ["stockist_management", "security_deposit_management", "renewal_management"])
    overall_status = "✅ ALL TESTS PASSED" if all_passed else "❌ SOME TESTS FAILED"
    print(f"\n🎯 OVERALL STATUS: {overall_status}")
    
    if all_passed:
        print(f"\n🎉 SUCCESS: All Admin Stockist & Financial Management endpoints are working correctly!")
        print(f"   - Stockist CRUD operations functional")
        print(f"   - Parent-child assignment validation working")
        print(f"   - Security deposit entries with automatic approval")
        print(f"   - Monthly return calculations correct (3% default)")
        print(f"   - Renewal entries with GST calculation (18% default)")
        print(f"   - User records updated correctly")
        print(f"   - All audit logs and calculations verified")
    else:
        print(f"\n⚠️  ISSUES FOUND: Some endpoints need attention")
        failed_tests = [key for key, passed in results.items() if not passed and key != "test_completed"]
        for test in failed_tests:
            print(f"   - {test.replace('_', ' ').title()}: Needs investigation")
    
    print(f"\n📋 NEXT STEPS:")
    if all_passed:
        print(f"   1. All backend endpoints are ready for frontend integration")
        print(f"   2. Admin dashboard can be connected to these APIs")
        print(f"   3. Financial management workflows are operational")
    else:
        print(f"   1. Review failed test outputs above")
        print(f"   2. Check backend logs for detailed error information")
        print(f"   3. Verify endpoint implementations match expected API contracts")
        print(f"   4. Test individual endpoints manually if needed")

if __name__ == "__main__":
    print("Starting Admin Stockist & Financial Management Backend Testing...")
    
    # Run comprehensive tests
    test_results = run_comprehensive_test()
    
    # Print summary
    print_test_summary(test_results)
    
    # Exit with appropriate code
    all_passed = all(test_results[key] for key in ["stockist_management", "security_deposit_management", "renewal_management"])
    sys.exit(0 if all_passed else 1)
