#!/usr/bin/env python3
"""
KYC and VIP Payment Admin Endpoints Testing Script
Tests the specific endpoints requested in the review:
- GET /api/kyc/list
- POST /api/kyc/{kyc_id}/verify (approve/reject)
- GET /api/membership/payments  
- POST /api/membership/payment/{payment_id}/action (approve/reject)
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

print(f"Testing KYC and VIP Payment Admin Endpoints at: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def test_kyc_endpoints():
    """Test KYC Admin Endpoints as requested in review"""
    print("\n" + "=" * 80)
    print("TESTING KYC ADMIN ENDPOINTS")
    print("=" * 80)
    
    # Test 1: GET /api/kyc/list - Should return all KYC documents
    print("\n1. Testing GET /api/kyc/list - Should return all KYC documents")
    try:
        response = requests.get(f"{API_BASE}/kyc/list", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            kyc_docs = response.json()
            print(f"Response type: {type(kyc_docs)}")
            
            if isinstance(kyc_docs, list):
                print(f"✅ KYC list endpoint working - {len(kyc_docs)} documents found")
                
                # Check structure of documents
                if len(kyc_docs) > 0:
                    sample_doc = kyc_docs[0]
                    required_fields = ["kyc_id", "user_id", "status", "submitted_at"]
                    missing_fields = [f for f in required_fields if f not in sample_doc]
                    
                    if missing_fields:
                        print(f"❌ KYC document missing fields: {missing_fields}")
                        return False
                    
                    print(f"Sample KYC document structure verified:")
                    print(f"  - KYC ID: {sample_doc.get('kyc_id')}")
                    print(f"  - User ID: {sample_doc.get('user_id')}")
                    print(f"  - Status: {sample_doc.get('status')}")
                    print(f"  - Submitted: {sample_doc.get('submitted_at')}")
                else:
                    print("ℹ️  No KYC documents in database (empty system)")
                
                kyc_list_working = True
            else:
                print(f"❌ KYC list endpoint failed - Expected list, got {type(kyc_docs)}")
                return False
        else:
            print(f"❌ KYC list endpoint failed - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ KYC list endpoint failed - Error: {e}")
        return False
    
    # Test 2: Find a KYC document to test verification endpoints
    kyc_id_for_testing = None
    if len(kyc_docs) > 0:
        # Find a pending KYC document
        for doc in kyc_docs:
            if doc.get("status") == "pending":
                kyc_id_for_testing = doc.get("kyc_id")
                break
        
        # If no pending, use the first one
        if not kyc_id_for_testing:
            kyc_id_for_testing = kyc_docs[0].get("kyc_id")
    
    # Test 3: POST /api/kyc/{kyc_id}/verify with action="approve"
    print(f"\n2. Testing POST /api/kyc/{{kyc_id}}/verify with action='approve'")
    
    if kyc_id_for_testing:
        try:
            verify_data = {"action": "approve"}
            response = requests.post(
                f"{API_BASE}/kyc/{kyc_id_for_testing}/verify", 
                json=verify_data, 
                timeout=30
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                if "message" in result:
                    print(f"✅ KYC approve endpoint working - {result.get('message')}")
                    kyc_approve_working = True
                else:
                    print(f"❌ KYC approve endpoint - Missing message in response")
                    kyc_approve_working = False
            else:
                print(f"❌ KYC approve endpoint failed - Status: {response.status_code}")
                kyc_approve_working = False
        except Exception as e:
            print(f"❌ KYC approve endpoint failed - Error: {e}")
            kyc_approve_working = False
    else:
        print("⚠️  No KYC documents available for testing approve action")
        kyc_approve_working = True  # Not a failure, just no data
    
    # Test 4: POST /api/kyc/{kyc_id}/verify with action="reject"
    print(f"\n3. Testing POST /api/kyc/{{kyc_id}}/verify with action='reject'")
    
    # Find another KYC document or create a test scenario
    if len(kyc_docs) > 1:
        # Use second document if available
        second_kyc_id = kyc_docs[1].get("kyc_id")
    else:
        # Use the same document (it might already be approved, but test the endpoint)
        second_kyc_id = kyc_id_for_testing
    
    if second_kyc_id:
        try:
            reject_data = {"action": "reject"}
            response = requests.post(
                f"{API_BASE}/kyc/{second_kyc_id}/verify", 
                json=reject_data, 
                timeout=30
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                if "message" in result:
                    print(f"✅ KYC reject endpoint working - {result.get('message')}")
                    kyc_reject_working = True
                else:
                    print(f"❌ KYC reject endpoint - Missing message in response")
                    kyc_reject_working = False
            else:
                print(f"❌ KYC reject endpoint failed - Status: {response.status_code}")
                kyc_reject_working = False
        except Exception as e:
            print(f"❌ KYC reject endpoint failed - Error: {e}")
            kyc_reject_working = False
    else:
        print("⚠️  No KYC documents available for testing reject action")
        kyc_reject_working = True  # Not a failure, just no data
    
    # Test 5: Test with invalid KYC ID
    print(f"\n4. Testing KYC endpoints with invalid KYC ID")
    try:
        invalid_kyc_id = "invalid-kyc-id-12345"
        verify_data = {"action": "approve"}
        response = requests.post(
            f"{API_BASE}/kyc/{invalid_kyc_id}/verify", 
            json=verify_data, 
            timeout=30
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 404:
            print(f"✅ KYC endpoint properly handles invalid ID (404)")
            invalid_id_handling = True
        else:
            print(f"❌ KYC endpoint should return 404 for invalid ID, got {response.status_code}")
            invalid_id_handling = False
    except Exception as e:
        print(f"❌ Error testing invalid KYC ID: {e}")
        invalid_id_handling = False
    
    # Summary
    print(f"\n" + "=" * 60)
    print("KYC ENDPOINTS TEST SUMMARY")
    print("=" * 60)
    
    all_tests_passed = all([
        kyc_list_working,
        kyc_approve_working, 
        kyc_reject_working,
        invalid_id_handling
    ])
    
    if all_tests_passed:
        print("✅ ALL KYC ENDPOINTS WORKING CORRECTLY")
        print("  - GET /api/kyc/list returns KYC documents")
        print("  - POST /api/kyc/{kyc_id}/verify with action='approve' works")
        print("  - POST /api/kyc/{kyc_id}/verify with action='reject' works")
        print("  - Invalid KYC ID handling works properly")
    else:
        print("❌ SOME KYC ENDPOINTS HAVE ISSUES")
        if not kyc_list_working:
            print("  - KYC list endpoint failed")
        if not kyc_approve_working:
            print("  - KYC approve endpoint failed")
        if not kyc_reject_working:
            print("  - KYC reject endpoint failed")
        if not invalid_id_handling:
            print("  - Invalid ID handling failed")
    
    return all_tests_passed

def test_vip_payment_endpoints():
    """Test VIP Payment Admin Endpoints as requested in review"""
    print("\n" + "=" * 80)
    print("TESTING VIP PAYMENT ADMIN ENDPOINTS")
    print("=" * 80)
    
    # Test 1: GET /api/membership/payments - Should return all VIP payment requests
    print("\n1. Testing GET /api/membership/payments - Should return all VIP payment requests")
    try:
        response = requests.get(f"{API_BASE}/membership/payments", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            vip_payments = response.json()
            print(f"Response type: {type(vip_payments)}")
            
            if isinstance(vip_payments, list):
                print(f"✅ VIP payments list endpoint working - {len(vip_payments)} payments found")
                
                # Check structure of payments
                if len(vip_payments) > 0:
                    sample_payment = vip_payments[0]
                    required_fields = ["payment_id", "user_id", "amount", "status", "created_at"]
                    missing_fields = [f for f in required_fields if f not in sample_payment]
                    
                    if missing_fields:
                        print(f"❌ VIP payment missing fields: {missing_fields}")
                        return False
                    
                    print(f"Sample VIP payment structure verified:")
                    print(f"  - Payment ID: {sample_payment.get('payment_id')}")
                    print(f"  - User ID: {sample_payment.get('user_id')}")
                    print(f"  - Amount: ₹{sample_payment.get('amount')}")
                    print(f"  - Status: {sample_payment.get('status')}")
                    print(f"  - UTR: {sample_payment.get('utr_number')}")
                    print(f"  - Created: {sample_payment.get('created_at')}")
                else:
                    print("ℹ️  No VIP payments in database (empty system)")
                
                payments_list_working = True
            else:
                print(f"❌ VIP payments list endpoint failed - Expected list, got {type(vip_payments)}")
                return False
        else:
            print(f"❌ VIP payments list endpoint failed - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ VIP payments list endpoint failed - Error: {e}")
        return False
    
    # Test 2: Find a VIP payment to test action endpoints
    payment_id_for_testing = None
    if len(vip_payments) > 0:
        # Find a pending payment
        for payment in vip_payments:
            if payment.get("status") == "pending":
                payment_id_for_testing = payment.get("payment_id")
                break
        
        # If no pending, use the first one
        if not payment_id_for_testing:
            payment_id_for_testing = vip_payments[0].get("payment_id")
    
    # Test 3: POST /api/membership/payment/{payment_id}/action with action="approve"
    print(f"\n2. Testing POST /api/membership/payment/{{payment_id}}/action with action='approve'")
    
    if payment_id_for_testing:
        try:
            approve_data = {"action": "approve"}
            response = requests.post(
                f"{API_BASE}/membership/payment/{payment_id_for_testing}/action", 
                json=approve_data, 
                timeout=30
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                if "message" in result:
                    print(f"✅ VIP payment approve endpoint working - {result.get('message')}")
                    payment_approve_working = True
                else:
                    print(f"❌ VIP payment approve endpoint - Missing message in response")
                    payment_approve_working = False
            else:
                print(f"❌ VIP payment approve endpoint failed - Status: {response.status_code}")
                payment_approve_working = False
        except Exception as e:
            print(f"❌ VIP payment approve endpoint failed - Error: {e}")
            payment_approve_working = False
    else:
        print("⚠️  No VIP payments available for testing approve action")
        payment_approve_working = True  # Not a failure, just no data
    
    # Test 4: POST /api/membership/payment/{payment_id}/action with action="reject"
    print(f"\n3. Testing POST /api/membership/payment/{{payment_id}}/action with action='reject'")
    
    # Find another payment or create a test scenario
    if len(vip_payments) > 1:
        # Use second payment if available
        second_payment_id = vip_payments[1].get("payment_id")
    else:
        # Use the same payment (it might already be approved, but test the endpoint)
        second_payment_id = payment_id_for_testing
    
    if second_payment_id:
        try:
            reject_data = {"action": "reject"}
            response = requests.post(
                f"{API_BASE}/membership/payment/{second_payment_id}/action", 
                json=reject_data, 
                timeout=30
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                if "message" in result:
                    print(f"✅ VIP payment reject endpoint working - {result.get('message')}")
                    payment_reject_working = True
                else:
                    print(f"❌ VIP payment reject endpoint - Missing message in response")
                    payment_reject_working = False
            else:
                print(f"❌ VIP payment reject endpoint failed - Status: {response.status_code}")
                payment_reject_working = False
        except Exception as e:
            print(f"❌ VIP payment reject endpoint failed - Error: {e}")
            payment_reject_working = False
    else:
        print("⚠️  No VIP payments available for testing reject action")
        payment_reject_working = True  # Not a failure, just no data
    
    # Test 5: Test with invalid payment ID
    print(f"\n4. Testing VIP payment endpoints with invalid payment ID")
    try:
        invalid_payment_id = "invalid-payment-id-12345"
        action_data = {"action": "approve"}
        response = requests.post(
            f"{API_BASE}/membership/payment/{invalid_payment_id}/action", 
            json=action_data, 
            timeout=30
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 404:
            print(f"✅ VIP payment endpoint properly handles invalid ID (404)")
            invalid_payment_id_handling = True
        else:
            print(f"❌ VIP payment endpoint should return 404 for invalid ID, got {response.status_code}")
            invalid_payment_id_handling = False
    except Exception as e:
        print(f"❌ Error testing invalid payment ID: {e}")
        invalid_payment_id_handling = False
    
    # Test 6: Check response format correctness for frontend
    print(f"\n5. Checking response format correctness for frontend")
    try:
        response = requests.get(f"{API_BASE}/membership/payments", timeout=30)
        if response.status_code == 200:
            payments = response.json()
            
            # Check if response is properly formatted for frontend consumption
            format_correct = True
            
            for payment in payments:
                # Check for ObjectId serialization issues
                for key, value in payment.items():
                    if isinstance(value, str) and value.startswith("ObjectId("):
                        print(f"❌ Found ObjectId serialization issue in field '{key}': {value}")
                        format_correct = False
                
                # Check datetime fields are properly formatted
                datetime_fields = ["created_at"]
                for field in datetime_fields:
                    if field in payment:
                        try:
                            # Try to parse the datetime
                            datetime.fromisoformat(payment[field].replace('Z', '+00:00'))
                        except:
                            print(f"❌ Invalid datetime format in field '{field}': {payment[field]}")
                            format_correct = False
            
            if format_correct:
                print("✅ Response format is correct for frontend consumption")
            else:
                print("❌ Response format has issues for frontend")
            
            response_format_correct = format_correct
        else:
            print(f"❌ Could not check response format - Status: {response.status_code}")
            response_format_correct = False
    except Exception as e:
        print(f"❌ Error checking response format: {e}")
        response_format_correct = False
    
    # Summary
    print(f"\n" + "=" * 60)
    print("VIP PAYMENT ENDPOINTS TEST SUMMARY")
    print("=" * 60)
    
    all_tests_passed = all([
        payments_list_working,
        payment_approve_working, 
        payment_reject_working,
        invalid_payment_id_handling,
        response_format_correct
    ])
    
    if all_tests_passed:
        print("✅ ALL VIP PAYMENT ENDPOINTS WORKING CORRECTLY")
        print("  - GET /api/membership/payments returns payment requests")
        print("  - POST /api/membership/payment/{payment_id}/action with action='approve' works")
        print("  - POST /api/membership/payment/{payment_id}/action with action='reject' works")
        print("  - Invalid payment ID handling works properly")
        print("  - Response format is correct for frontend")
    else:
        print("❌ SOME VIP PAYMENT ENDPOINTS HAVE ISSUES")
        if not payments_list_working:
            print("  - VIP payments list endpoint failed")
        if not payment_approve_working:
            print("  - VIP payment approve endpoint failed")
        if not payment_reject_working:
            print("  - VIP payment reject endpoint failed")
        if not invalid_payment_id_handling:
            print("  - Invalid payment ID handling failed")
        if not response_format_correct:
            print("  - Response format has issues for frontend")
    
    return all_tests_passed

def check_database_data():
    """Check if there are pending KYC or VIP payment requests in the database"""
    print("\n" + "=" * 80)
    print("CHECKING DATABASE FOR PENDING REQUESTS")
    print("=" * 80)
    
    # Check KYC documents
    print("\n1. Checking KYC documents in database...")
    try:
        response = requests.get(f"{API_BASE}/kyc/list", timeout=30)
        if response.status_code == 200:
            kyc_docs = response.json()
            
            total_kyc = len(kyc_docs)
            pending_kyc = sum(1 for doc in kyc_docs if doc.get("status") == "pending")
            verified_kyc = sum(1 for doc in kyc_docs if doc.get("status") == "verified")
            rejected_kyc = sum(1 for doc in kyc_docs if doc.get("status") == "rejected")
            
            print(f"📊 KYC Documents Summary:")
            print(f"   Total: {total_kyc}")
            print(f"   Pending: {pending_kyc}")
            print(f"   Verified: {verified_kyc}")
            print(f"   Rejected: {rejected_kyc}")
            
            if pending_kyc > 0:
                print(f"⚠️  {pending_kyc} KYC documents are pending admin review")
            else:
                print(f"✅ No pending KYC documents")
        else:
            print(f"❌ Could not fetch KYC documents - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking KYC documents: {e}")
    
    # Check VIP payments
    print("\n2. Checking VIP payment requests in database...")
    try:
        response = requests.get(f"{API_BASE}/membership/payments", timeout=30)
        if response.status_code == 200:
            vip_payments = response.json()
            
            total_payments = len(vip_payments)
            pending_payments = sum(1 for payment in vip_payments if payment.get("status") == "pending")
            approved_payments = sum(1 for payment in vip_payments if payment.get("status") == "approved")
            rejected_payments = sum(1 for payment in vip_payments if payment.get("status") == "rejected")
            
            print(f"📊 VIP Payment Requests Summary:")
            print(f"   Total: {total_payments}")
            print(f"   Pending: {pending_payments}")
            print(f"   Approved: {approved_payments}")
            print(f"   Rejected: {rejected_payments}")
            
            if pending_payments > 0:
                print(f"⚠️  {pending_payments} VIP payment requests are pending admin review")
                
                # Show details of pending payments
                print(f"\n📋 Pending Payment Details:")
                for payment in vip_payments:
                    if payment.get("status") == "pending":
                        print(f"   - Payment ID: {payment.get('payment_id')}")
                        print(f"     User ID: {payment.get('user_id')}")
                        print(f"     Amount: ₹{payment.get('amount')}")
                        print(f"     UTR: {payment.get('utr_number')}")
                        print(f"     Date: {payment.get('date')} {payment.get('time')}")
            else:
                print(f"✅ No pending VIP payment requests")
        else:
            print(f"❌ Could not fetch VIP payments - Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking VIP payments: {e}")

def main():
    """Main test execution focused on KYC and VIP Payment endpoints"""
    print("Starting KYC and VIP Payment Admin Endpoints Testing...")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    
    # Check database data first
    check_database_data()
    
    # Run focused tests
    tests = [
        ("KYC Admin Endpoints", test_kyc_endpoints),
        ("VIP Payment Admin Endpoints", test_vip_payment_endpoints)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*80}")
        print(f"Running: {test_name}")
        print(f"{'='*80}")
        
        try:
            result = test_func()
            results.append((test_name, result))
            
            if result:
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
        except Exception as e:
            print(f"🔥 {test_name}: ERROR - {e}")
            results.append((test_name, False))
    
    # Print summary
    print(f"\n{'='*80}")
    print("KYC & VIP PAYMENT ENDPOINTS TEST SUMMARY")
    print(f"{'='*80}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nOverall: {passed}/{total} endpoint groups passed")
    
    if passed == total:
        print("🎉 All KYC and VIP Payment endpoints are working correctly!")
        print("\n📋 VERIFICATION COMPLETE:")
        print("  ✅ KYC endpoints return data correctly")
        print("  ✅ VIP payment endpoints return data correctly") 
        print("  ✅ Approval/rejection actions work correctly")
        print("  ✅ Response format is correct for frontend")
        return True
    else:
        print("💥 Some KYC or VIP Payment endpoints have issues!")
        print("\n🔍 ISSUES IDENTIFIED:")
        for test_name, result in results:
            if not result:
                print(f"  ❌ {test_name} - Check backend logs for details")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)