"""
Bank Redeem E2E Test - Complete User → Admin → User Lifecycle
Tests the full "Redeem to Bank" flow:
1. User creates bank withdrawal request (PRC deducted immediately)
2. Admin can approve/complete OR reject
3. If completed: PRC stays deducted
4. If rejected: PRC refunded back + redeem limit should increase back
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://formula-audit-fix.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"

ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"


@pytest.fixture(scope="module")
def admin_session():
    """Create authenticated admin session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login admin
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "pin": ADMIN_PIN
    })
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token") or data.get("token")
        admin_uid = data.get("uid")
        
        if token:
            session.headers.update({"Authorization": f"Bearer {token}"})
        
        session.admin_uid = admin_uid
        print(f"✓ Admin session created. UID: {admin_uid}")
    else:
        pytest.skip(f"Admin login failed: {response.text}")
    
    return session


@pytest.fixture(scope="module")
def user_session():
    """Create authenticated user session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login user
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "mobile": TEST_USER_MOBILE,
        "pin": TEST_USER_PIN
    })
    
    if response.status_code == 200:
        data = response.json()
        user = data.get("user", data)
        token = data.get("access_token") or data.get("token")
        
        if token:
            session.headers.update({"Authorization": f"Bearer {token}"})
        
        session.user_uid = user.get("uid")
        session.initial_balance = user.get("prc_balance", 0)
        print(f"✓ User session created. UID: {session.user_uid}, Balance: {session.initial_balance}")
    else:
        pytest.skip(f"User login failed: {response.text}")
    
    return session


class TestBankRedeemE2EFlow:
    """Complete E2E test for Bank Redeem flow"""
    
    def test_01_user_login_and_get_initial_state(self, user_session):
        """Step 1: Login user and get initial PRC balance and redeem limit"""
        assert user_session.user_uid == TEST_USER_UID, f"User UID mismatch"
        print(f"✓ User logged in. Initial PRC balance: {user_session.initial_balance}")
        
        # Get redeem limit
        limit_response = user_session.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        assert limit_response.status_code == 200, f"Failed to get redeem limit: {limit_response.text}"
        
        limit_data = limit_response.json()
        if limit_data.get("success"):
            limit = limit_data.get("limit", {})
            print(f"✓ Redeem limit: total={limit.get('total_limit')}, used={limit.get('total_redeemed')}, available={limit.get('effective_available')}")
    
    def test_02_check_withdrawal_eligibility(self, user_session):
        """Step 2: Check if user is eligible for bank withdrawal"""
        response = user_session.get(f"{BASE_URL}/api/bank-redeem/check-eligibility/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Eligibility check failed: {response.text}"
        data = response.json()
        
        print(f"✓ Eligibility check response: eligible={data.get('eligible')}")
        
        if not data.get("eligible"):
            reason = data.get("reason", "unknown")
            message = data.get("message", "")
            print(f"⚠ User not eligible: {reason} - {message}")
            
            # If cooldown, that's expected behavior - not a failure
            if reason in ["bank_redeem_recently", "emi_done_recently", "rd_redeem_recently"]:
                print(f"→ User on 24-hour cooldown (expected behavior)")
        else:
            print(f"✓ User is eligible for withdrawal. PRC balance: {data.get('prc_balance')}")
    
    def test_03_admin_login(self, admin_session):
        """Step 3: Login admin to get admin_id for later actions"""
        assert admin_session.admin_uid, "Admin UID not found"
        print(f"✓ Admin logged in. Admin UID: {admin_session.admin_uid}")
    
    def test_04_get_user_current_balance(self, user_session):
        """Step 4: Get user's current PRC balance"""
        response = user_session.get(f"{BASE_URL}/api/users/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Failed to get user: {response.text}"
        user = response.json()
        
        balance = user.get("prc_balance", 0)
        print(f"✓ User current PRC balance: {balance}")


class TestAdminBankRedeemOperations:
    """Test admin operations on bank redeem requests"""
    
    def test_01_admin_get_pending_requests(self, admin_session):
        """Admin can view pending bank redeem requests"""
        response = admin_session.get(f"{BASE_URL}/api/admin/bank-redeem/requests?status=pending")
        
        assert response.status_code == 200, f"Failed to get pending requests: {response.text}"
        data = response.json()
        
        requests_list = data.get("requests", [])
        total = data.get("total", 0)
        
        print(f"✓ Found {len(requests_list)} pending requests (total: {total})")
        
        if requests_list:
            for req in requests_list[:3]:
                print(f"  - {req.get('request_id')}: ₹{req.get('amount_inr')} by {req.get('user_name', 'Unknown')}")
    
    def test_02_admin_get_all_requests(self, admin_session):
        """Admin can view all bank redeem requests"""
        response = admin_session.get(f"{BASE_URL}/api/admin/bank-redeem/requests")
        
        assert response.status_code == 200, f"Failed to get requests: {response.text}"
        data = response.json()
        
        total = data.get("total", 0)
        stats = data.get("stats", {})
        
        print(f"✓ Total bank redeem requests: {total}")
        print(f"✓ Stats by status: {stats}")
    
    def test_03_admin_get_eko_failed_requests(self, admin_session):
        """Admin can view eko_failed requests"""
        response = admin_session.get(f"{BASE_URL}/api/admin/bank-redeem/requests?status=eko_failed")
        
        assert response.status_code == 200, f"Failed to get eko_failed requests: {response.text}"
        data = response.json()
        
        requests_list = data.get("requests", [])
        print(f"✓ Found {len(requests_list)} eko_failed requests")


class TestUserBankRedeemHistory:
    """Test user can see their bank redeem history"""
    
    def test_01_user_can_view_history(self, user_session):
        """User can view their bank redeem history"""
        response = user_session.get(f"{BASE_URL}/api/bank-redeem/history/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Failed to get history: {response.text}"
        data = response.json()
        
        requests_list = data.get("requests", [])
        total = data.get("total", 0)
        
        print(f"✓ User has {total} bank redeem requests in history")
        
        if requests_list:
            for req in requests_list[:5]:
                status = req.get("status", "unknown")
                amount = req.get("amount_inr", 0)
                created = req.get("created_at", "")[:10]
                print(f"  - {req.get('request_id')}: ₹{amount} - {status} ({created})")


class TestBankRedeemRejectionFlow:
    """Test the rejection flow with PRC refund"""
    
    def test_rejection_flow_with_existing_request(self, admin_session, user_session):
        """Test admin can reject a pending request and PRC is refunded"""
        
        # Get pending requests
        print("\n=== Get Pending Requests ===")
        pending_response = admin_session.get(f"{BASE_URL}/api/admin/bank-redeem/requests?status=pending")
        assert pending_response.status_code == 200, f"Failed to get pending requests: {pending_response.text}"
        
        pending_list = pending_response.json().get("requests", [])
        
        if not pending_list:
            pytest.skip("No pending requests to test rejection flow")
        
        # Find a request from our test user if possible
        test_user_request = next((r for r in pending_list if r.get("user_id") == TEST_USER_UID), None)
        
        if test_user_request:
            request = test_user_request
            print(f"✓ Found pending request from test user")
        else:
            # Use first available request
            request = pending_list[0]
            print(f"⚠ No pending request from test user. Using first available request.")
        
        request_id = request.get("request_id")
        user_id = request.get("user_id")
        prc_to_refund = request.get("total_prc_deducted", 0)
        
        print(f"Testing with request: {request_id}")
        print(f"User: {user_id}, PRC to refund: {prc_to_refund}")
        
        # Get user balance before rejection
        print("\n=== Get User Balance Before Rejection ===")
        user_before = admin_session.get(f"{BASE_URL}/api/users/{user_id}")
        balance_before = user_before.json().get("prc_balance", 0) if user_before.status_code == 200 else 0
        print(f"Balance before rejection: {balance_before}")
        
        # Reject the request
        print("\n=== Admin Rejects Request ===")
        reject_response = admin_session.post(f"{BASE_URL}/api/admin/bank-redeem/{request_id}/reject", json={
            "admin_id": admin_session.admin_uid,
            "reason": "E2E Test - Testing rejection flow"
        })
        
        assert reject_response.status_code == 200, f"Rejection failed: {reject_response.text}"
        reject_data = reject_response.json()
        assert reject_data.get("success"), f"Rejection not successful: {reject_data}"
        print(f"✓ Request {request_id} rejected successfully")
        
        # Verify PRC was refunded
        print("\n=== Verify PRC Refunded ===")
        user_after = admin_session.get(f"{BASE_URL}/api/users/{user_id}")
        balance_after = user_after.json().get("prc_balance", 0) if user_after.status_code == 200 else 0
        
        expected_balance = balance_before + prc_to_refund
        print(f"Balance after rejection: {balance_after}")
        print(f"Expected balance: {expected_balance}")
        
        # Allow small floating point difference
        assert abs(balance_after - expected_balance) < 1, f"PRC refund incorrect. Expected ~{expected_balance}, got {balance_after}"
        print(f"✓ PRC refunded correctly! (+{prc_to_refund} PRC)")
        
        # Verify status in history
        print("\n=== Verify Rejection Status ===")
        history = admin_session.get(f"{BASE_URL}/api/bank-redeem/history/{user_id}")
        if history.status_code == 200:
            history_requests = history.json().get("requests", [])
            rejected_req = next((r for r in history_requests if r.get("request_id") == request_id), None)
            if rejected_req:
                assert rejected_req.get("status") == "rejected", f"Status is {rejected_req.get('status')}, expected 'rejected'"
                print(f"✓ Request shows as rejected in history")


class TestBankRedeemManualComplete:
    """Test manual completion flow (for when Eko is not available)"""
    
    def test_manual_complete_flow(self, admin_session):
        """Test admin can manually complete a request"""
        
        # Get pending or eko_failed requests
        print("\n=== Get Requests for Manual Completion ===")
        pending = admin_session.get(f"{BASE_URL}/api/admin/bank-redeem/requests?status=pending")
        assert pending.status_code == 200
        pending_list = pending.json().get("requests", [])
        
        eko_failed = admin_session.get(f"{BASE_URL}/api/admin/bank-redeem/requests?status=eko_failed")
        eko_failed_list = eko_failed.json().get("requests", []) if eko_failed.status_code == 200 else []
        
        all_requests = pending_list + eko_failed_list
        
        if not all_requests:
            pytest.skip("No pending/eko_failed requests to test manual completion")
        
        # Use first request
        request = all_requests[0]
        request_id = request.get("request_id")
        user_id = request.get("user_id")
        prc_deducted = request.get("total_prc_deducted", 0)
        
        print(f"Testing manual complete with request: {request_id}")
        print(f"User: {user_id}, PRC deducted: {prc_deducted}")
        
        # Get user balance before completion
        user_before = admin_session.get(f"{BASE_URL}/api/users/{user_id}")
        balance_before = user_before.json().get("prc_balance", 0) if user_before.status_code == 200 else 0
        print(f"Balance before completion: {balance_before}")
        
        # Manual complete
        print("\n=== Manual Complete Request ===")
        complete_response = admin_session.post(f"{BASE_URL}/api/admin/bank-redeem/{request_id}/manual-complete", json={
            "admin_id": admin_session.admin_uid,
            "txn_reference": f"TEST_UTR_{int(time.time())}",
            "admin_notes": "E2E Test - Manual completion"
        })
        
        assert complete_response.status_code == 200, f"Manual complete failed: {complete_response.text}"
        complete_data = complete_response.json()
        assert complete_data.get("success"), f"Manual complete not successful: {complete_data}"
        print(f"✓ Request manually completed")
        print(f"✓ Status: {complete_data.get('status')}")
        print(f"✓ Txn Reference: {complete_data.get('txn_reference')}")
        
        # Verify PRC stays deducted (no refund on completion)
        print("\n=== Verify PRC Stays Deducted ===")
        user_after = admin_session.get(f"{BASE_URL}/api/users/{user_id}")
        balance_after = user_after.json().get("prc_balance", 0) if user_after.status_code == 200 else 0
        
        print(f"Balance after completion: {balance_after}")
        
        # Balance should remain the same (no refund on completion)
        assert abs(balance_after - balance_before) < 1, f"PRC balance changed unexpectedly after completion"
        print(f"✓ PRC stays deducted (correct behavior for completion)")
        
        # Verify status in history
        print("\n=== Verify Completed Status ===")
        history = admin_session.get(f"{BASE_URL}/api/bank-redeem/history/{user_id}")
        if history.status_code == 200:
            history_requests = history.json().get("requests", [])
            completed_req = next((r for r in history_requests if r.get("request_id") == request_id), None)
            if completed_req:
                assert completed_req.get("status") == "completed", f"Status is {completed_req.get('status')}, expected 'completed'"
                print(f"✓ Request shows as completed in history")


class TestRedeemLimitVerification:
    """Test redeem limit reflects changes correctly"""
    
    def test_redeem_limit_endpoint(self, user_session):
        """Verify redeem limit endpoint returns correct data"""
        response = user_session.get(f"{BASE_URL}/api/user/{TEST_USER_UID}/redeem-limit")
        
        assert response.status_code == 200, f"Failed to get redeem limit: {response.text}"
        data = response.json()
        
        assert data.get("success"), f"Redeem limit request not successful: {data}"
        
        limit = data.get("limit", {})
        print(f"✓ Redeem Limit Data:")
        print(f"  - Total Limit: {limit.get('total_limit')} PRC")
        print(f"  - Total Redeemed: {limit.get('total_redeemed')} PRC")
        print(f"  - Effective Available: {limit.get('effective_available')} PRC")
        print(f"  - Unlock Percent: {limit.get('unlock_percent')}%")
        
        # Verify structure
        assert "total_limit" in limit, "Missing total_limit"
        assert "total_redeemed" in limit, "Missing total_redeemed"


class TestBankRedeemCreateRequest:
    """Test creating a new bank redeem request"""
    
    def test_create_request_flow(self, user_session, admin_session):
        """Test creating a new bank withdrawal request"""
        
        # Check eligibility first
        print("\n=== Check Eligibility ===")
        eligibility = user_session.get(f"{BASE_URL}/api/bank-redeem/check-eligibility/{TEST_USER_UID}")
        assert eligibility.status_code == 200
        elig_data = eligibility.json()
        
        if not elig_data.get("eligible"):
            reason = elig_data.get("reason", "unknown")
            message = elig_data.get("message", "")
            print(f"⚠ User not eligible: {reason} - {message}")
            pytest.skip(f"User not eligible for new request: {message}")
        
        print(f"✓ User is eligible")
        
        # Get initial balance
        print("\n=== Get Initial Balance ===")
        user_before = user_session.get(f"{BASE_URL}/api/users/{TEST_USER_UID}")
        assert user_before.status_code == 200
        initial_balance = user_before.json().get("prc_balance", 0)
        print(f"Initial PRC balance: {initial_balance}")
        
        # Create request
        print("\n=== Create Bank Withdrawal Request ===")
        create_response = user_session.post(f"{BASE_URL}/api/bank-redeem/request/{TEST_USER_UID}", json={
            "amount_inr": 100  # Minimum amount
        })
        
        if create_response.status_code == 429:
            print("⚠ Rate limited (24-hour cooldown)")
            pytest.skip("User on 24-hour cooldown")
        
        assert create_response.status_code == 200, f"Failed to create request: {create_response.text}"
        create_data = create_response.json()
        
        assert create_data.get("success"), f"Request creation failed: {create_data}"
        request_id = create_data.get("request_id")
        prc_deducted = create_data.get("total_prc_deducted")
        
        print(f"✓ Request created: {request_id}")
        print(f"✓ PRC deducted: {prc_deducted}")
        
        # Verify PRC was deducted
        print("\n=== Verify PRC Deducted ===")
        user_after = user_session.get(f"{BASE_URL}/api/users/{TEST_USER_UID}")
        assert user_after.status_code == 200
        balance_after = user_after.json().get("prc_balance", 0)
        
        expected_balance = initial_balance - prc_deducted
        print(f"Balance after request: {balance_after}")
        print(f"Expected balance: {expected_balance}")
        
        assert abs(balance_after - expected_balance) < 1, f"PRC not deducted correctly"
        print(f"✓ PRC deducted correctly!")
        
        # Verify request appears in admin list
        print("\n=== Verify Request in Admin List ===")
        admin_list = admin_session.get(f"{BASE_URL}/api/admin/bank-redeem/requests?status=pending")
        assert admin_list.status_code == 200
        pending_requests = admin_list.json().get("requests", [])
        
        found = any(r.get("request_id") == request_id for r in pending_requests)
        assert found, f"Request {request_id} not found in pending list"
        print(f"✓ Request found in admin pending list")
        
        return request_id, prc_deducted


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
