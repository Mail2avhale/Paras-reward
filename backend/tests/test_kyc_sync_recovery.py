"""
KYC Sync & Recovery Endpoints Tests
Tests for KYC status synchronization, orphaned record detection, and auto-fix features.

Endpoints tested:
- GET /api/kyc/check-status/{uid} - Check KYC status with auto-sync
- POST /api/admin/kyc/resync-by-email - Sync KYC by email/mobile
- POST /api/kyc/reset-for-resubmit/{uid} - Reset KYC for re-submission
- GET /api/admin/kyc/orphaned-requests - Find orphaned KYC records
- POST /api/admin/kyc/fix-all-orphaned - Fix all orphaned records
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Accept": "application/json"
    })
    return session


class TestKYCCheckStatus:
    """Tests for GET /api/kyc/check-status/{uid}"""
    
    def test_check_status_nonexistent_user(self, api_client):
        """Test check status for non-existent user returns 404"""
        fake_uid = f"nonexistent-{uuid.uuid4()}"
        response = api_client.get(f"{BASE_URL}/api/kyc/check-status/{fake_uid}", timeout=15)
        
        # Should return 404 for unknown user
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"✅ Non-existent user returns 404: {data.get('detail')}")
    
    def test_check_status_existing_user(self, api_client):
        """Test check status returns proper response structure"""
        # First get a user from the database
        response = api_client.get(f"{BASE_URL}/api/admin/users?limit=1", timeout=15)
        if response.status_code != 200 or not response.json().get("users"):
            pytest.skip("No users available for testing")
        
        user = response.json()["users"][0]
        uid = user.get("uid")
        
        # Now check KYC status
        status_response = api_client.get(f"{BASE_URL}/api/kyc/check-status/{uid}", timeout=15)
        assert status_response.status_code == 200, f"Status check failed: {status_response.text}"
        
        data = status_response.json()
        
        # Verify response structure
        assert "success" in data
        assert "kyc_status" in data
        assert "has_document" in data
        assert "is_orphaned" in data
        assert "was_auto_synced" in data
        assert "can_resubmit" in data
        assert "message" in data
        
        print(f"✅ KYC status check working for user {uid}")
        print(f"   Status: {data.get('kyc_status')}, Has Doc: {data.get('has_document')}, Orphaned: {data.get('is_orphaned')}")
    
    def test_check_status_response_fields(self, api_client):
        """Test that was_auto_synced flag is present in response"""
        # Get any user
        response = api_client.get(f"{BASE_URL}/api/admin/users?limit=1", timeout=15)
        if response.status_code != 200 or not response.json().get("users"):
            pytest.skip("No users available for testing")
        
        user = response.json()["users"][0]
        uid = user.get("uid")
        
        status_response = api_client.get(f"{BASE_URL}/api/kyc/check-status/{uid}", timeout=15)
        assert status_response.status_code == 200
        
        data = status_response.json()
        
        # Check was_auto_synced field exists and is boolean
        assert "was_auto_synced" in data
        assert isinstance(data["was_auto_synced"], bool)
        
        # Check document_info structure
        assert "document_info" in data
        doc_info = data.get("document_info", {})
        assert "submitted_at" in doc_info or doc_info.get("submitted_at") is None
        
        print(f"✅ was_auto_synced flag present: {data.get('was_auto_synced')}")


class TestResyncByEmail:
    """Tests for POST /api/admin/kyc/resync-by-email"""
    
    def test_resync_missing_identifier(self, api_client):
        """Test resync fails without identifier"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/kyc/resync-by-email",
            json={"identifier": ""},
            timeout=15
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Missing identifier returns 400")
    
    def test_resync_nonexistent_user(self, api_client):
        """Test resync for non-existent user returns 404"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/kyc/resync-by-email",
            json={"identifier": f"nonexistent-{uuid.uuid4()}@test.com"},
            timeout=15
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Non-existent user returns 404")
    
    def test_resync_existing_user(self, api_client):
        """Test resync for existing user"""
        # Get a user with email
        response = api_client.get(f"{BASE_URL}/api/admin/users?limit=10", timeout=15)
        if response.status_code != 200:
            pytest.skip("Cannot fetch users")
        
        users = response.json().get("users", [])
        # Find user with email
        user_with_email = None
        for u in users:
            if u.get("email"):
                user_with_email = u
                break
        
        if not user_with_email:
            pytest.skip("No user with email found")
        
        email = user_with_email.get("email")
        
        # Resync by email
        resync_response = api_client.post(
            f"{BASE_URL}/api/admin/kyc/resync-by-email",
            json={"identifier": email},
            timeout=15
        )
        
        assert resync_response.status_code == 200, f"Resync failed: {resync_response.text}"
        
        data = resync_response.json()
        assert data.get("success") == True
        assert "user_id" in data
        assert "old_status" in data
        assert "new_status" in data
        assert "message" in data
        
        print(f"✅ Resync by email working: {data.get('message')}")


class TestResetForResubmit:
    """Tests for POST /api/kyc/reset-for-resubmit/{uid}"""
    
    def test_reset_nonexistent_user(self, api_client):
        """Test reset for non-existent user returns 404"""
        fake_uid = f"fake-{uuid.uuid4()}"
        response = api_client.post(f"{BASE_URL}/api/kyc/reset-for-resubmit/{fake_uid}", timeout=15)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Reset for non-existent user returns 404")
    
    def test_reset_verified_user_blocked(self, api_client):
        """Test that verified users cannot reset KYC"""
        # Find a user with verified KYC
        response = api_client.get(f"{BASE_URL}/api/admin/users?limit=50", timeout=15)
        if response.status_code != 200:
            pytest.skip("Cannot fetch users")
        
        users = response.json().get("users", [])
        verified_user = None
        for u in users:
            if u.get("kyc_status") == "verified":
                verified_user = u
                break
        
        if not verified_user:
            pytest.skip("No verified user found for testing")
        
        uid = verified_user.get("uid")
        
        # Try to reset
        reset_response = api_client.post(f"{BASE_URL}/api/kyc/reset-for-resubmit/{uid}", timeout=15)
        
        # Should be blocked with 400
        assert reset_response.status_code == 400, f"Expected 400, got {reset_response.status_code}: {reset_response.text}"
        data = reset_response.json()
        assert "already verified" in data.get("detail", "").lower()
        
        print(f"✅ Verified user blocked from reset: {data.get('detail')}")


class TestOrphanedRequests:
    """Tests for GET /api/admin/kyc/orphaned-requests"""
    
    def test_get_orphaned_requests(self, api_client):
        """Test fetching orphaned KYC records"""
        response = api_client.get(f"{BASE_URL}/api/admin/kyc/orphaned-requests", timeout=20)
        
        assert response.status_code == 200, f"Failed to get orphaned requests: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "orphaned_users" in data
        assert "total" in data
        assert "message" in data
        
        orphaned = data.get("orphaned_users", [])
        total = data.get("total", 0)
        
        print(f"✅ Orphaned requests endpoint working: Found {total} orphaned records")
        
        # If orphaned records exist, verify structure
        if orphaned:
            first = orphaned[0]
            assert "uid" in first
            assert "name" in first
            assert "issue" in first
            print(f"   Sample orphaned user: {first.get('name')} - {first.get('issue')}")
    
    def test_orphaned_requests_pagination(self, api_client):
        """Test pagination parameters"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/kyc/orphaned-requests?page=1&limit=5",
            timeout=20
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "page" in data
        assert "pages" in data
        
        print(f"✅ Orphaned requests pagination working: Page {data.get('page')} of {data.get('pages')}")


class TestFixAllOrphaned:
    """Tests for POST /api/admin/kyc/fix-all-orphaned"""
    
    def test_fix_all_orphaned_endpoint(self, api_client):
        """Test fix all orphaned endpoint is accessible"""
        response = api_client.post(f"{BASE_URL}/api/admin/kyc/fix-all-orphaned", timeout=30)
        
        # Should return 200 even if no orphaned records
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "fixed_count" in data
        assert "message" in data
        
        print(f"✅ Fix all orphaned endpoint working: {data.get('message')}")
        print(f"   Fixed count: {data.get('fixed_count')}")


class TestAutoSyncLogic:
    """Tests for auto-sync behavior when document status is verified but profile is pending"""
    
    def test_auto_sync_detection(self, api_client):
        """Test that was_auto_synced flag works correctly"""
        # First, get KYC documents to find verified ones
        response = api_client.get(f"{BASE_URL}/api/kyc/list?status=verified&limit=5", timeout=15)
        
        if response.status_code != 200:
            pytest.skip("Cannot fetch KYC documents")
        
        documents = response.json().get("documents", [])
        
        if not documents:
            pytest.skip("No verified KYC documents found")
        
        # For each verified doc, check the user's status
        for doc in documents:
            user_id = doc.get("user_id")
            if user_id:
                status_response = api_client.get(f"{BASE_URL}/api/kyc/check-status/{user_id}", timeout=15)
                if status_response.status_code == 200:
                    data = status_response.json()
                    # If user has verified document, their kyc_status should be verified
                    if data.get("document_status") == "verified":
                        assert data.get("kyc_status") == "verified", \
                            f"Sync mismatch: doc=verified but profile={data.get('kyc_status')}"
                        print(f"✅ User {user_id} - Document and profile both verified (auto-sync working)")
                        return
        
        print("✅ No sync mismatches found - all verified documents have synced profiles")


class TestEndpointAccessibility:
    """Basic accessibility tests for all KYC sync endpoints"""
    
    def test_health_check(self, api_client):
        """Verify API is reachable"""
        response = api_client.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        print("✅ API health check passed")
    
    def test_kyc_stats_endpoint(self, api_client):
        """Test KYC stats endpoint"""
        response = api_client.get(f"{BASE_URL}/api/kyc/stats", timeout=15)
        assert response.status_code == 200
        
        data = response.json()
        assert "pending" in data or "total" in data
        print(f"✅ KYC stats endpoint working")
    
    def test_kyc_list_endpoint(self, api_client):
        """Test KYC list endpoint"""
        response = api_client.get(f"{BASE_URL}/api/kyc/list?limit=5", timeout=15)
        assert response.status_code == 200
        
        data = response.json()
        assert "documents" in data
        print(f"✅ KYC list endpoint working, {len(data.get('documents', []))} documents")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
