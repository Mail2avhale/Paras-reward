"""
Test suite for User 360° View Admin Feature
Tests: GET /api/admin/user-360 and POST /api/admin/user-360/action
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bugfix-rewards-hub.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "demo_startup@test.com"


class TestUser360Search:
    """Test User 360° View search functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.admin_uid = data.get("user", {}).get("uid")
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_search_by_email(self):
        """Test searching user by email"""
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user' field"
        assert "stats" in data, "Response should contain 'stats' field"
        assert "referral" in data, "Response should contain 'referral' field"
        assert "transactions" in data, "Response should contain 'transactions' field"
        assert "activity" in data, "Response should contain 'activity' field"
        
        # Verify user data
        user = data["user"]
        assert user.get("email") == TEST_USER_EMAIL, f"Email mismatch: {user.get('email')}"
        assert "uid" in user, "User should have uid"
        assert "password_hash" not in user, "Password hash should be excluded"
        assert "_id" not in user, "MongoDB _id should be excluded"
        
        print(f"✓ Search by email successful - Found user: {user.get('name', user.get('email'))}")
    
    def test_search_by_uid(self):
        """Test searching user by UID"""
        # First get a user's UID
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        if response.status_code != 200:
            pytest.skip("Could not get test user")
        
        user_uid = response.json()["user"]["uid"]
        
        # Now search by UID
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": user_uid})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["user"]["uid"] == user_uid, "UID should match"
        
        print(f"✓ Search by UID successful")
    
    def test_search_by_referral_code(self):
        """Test searching user by referral code"""
        # First get a user's referral code
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        if response.status_code != 200:
            pytest.skip("Could not get test user")
        
        referral_code = response.json()["user"].get("referral_code")
        if not referral_code:
            pytest.skip("Test user has no referral code")
        
        # Now search by referral code
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": referral_code})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["user"]["referral_code"] == referral_code, "Referral code should match"
        
        print(f"✓ Search by referral code successful")
    
    def test_search_short_query_rejected(self):
        """Test that short queries are rejected"""
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": "a"})
        
        assert response.status_code == 400, f"Expected 400 for short query, got {response.status_code}"
        
        print(f"✓ Short query correctly rejected")
    
    def test_search_nonexistent_user(self):
        """Test searching for non-existent user"""
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": "nonexistent_user_xyz@test.com"})
        
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        
        print(f"✓ Non-existent user correctly returns 404")
    
    def test_financial_stats_structure(self):
        """Test that financial stats are returned correctly"""
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        
        assert response.status_code == 200
        
        stats = response.json()["stats"]
        assert "total_mined" in stats, "Stats should contain total_mined"
        assert "total_redeemed" in stats, "Stats should contain total_redeemed"
        assert "net_balance" in stats, "Stats should contain net_balance"
        
        # Verify numeric types
        assert isinstance(stats["total_mined"], (int, float)), "total_mined should be numeric"
        assert isinstance(stats["total_redeemed"], (int, float)), "total_redeemed should be numeric"
        assert isinstance(stats["net_balance"], (int, float)), "net_balance should be numeric"
        
        print(f"✓ Financial stats structure correct - Balance: {stats['net_balance']} PRC")
    
    def test_referral_data_structure(self):
        """Test that referral data is returned correctly"""
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        
        assert response.status_code == 200
        
        referral = response.json()["referral"]
        assert "total_referrals" in referral, "Referral should contain total_referrals"
        assert "active_referrals" in referral, "Referral should contain active_referrals"
        assert "total_earnings" in referral, "Referral should contain total_earnings"
        assert "referrals" in referral, "Referral should contain referrals list"
        
        print(f"✓ Referral data structure correct - Total: {referral['total_referrals']}, Active: {referral['active_referrals']}")
    
    def test_transactions_structure(self):
        """Test that transactions data is returned correctly"""
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        
        assert response.status_code == 200
        
        transactions = response.json()["transactions"]
        assert "orders" in transactions, "Transactions should contain orders"
        assert "bill_payments" in transactions, "Transactions should contain bill_payments"
        assert "gift_vouchers" in transactions, "Transactions should contain gift_vouchers"
        assert "subscriptions" in transactions, "Transactions should contain subscriptions"
        
        # Verify they are lists
        assert isinstance(transactions["orders"], list), "orders should be a list"
        assert isinstance(transactions["bill_payments"], list), "bill_payments should be a list"
        assert isinstance(transactions["gift_vouchers"], list), "gift_vouchers should be a list"
        assert isinstance(transactions["subscriptions"], list), "subscriptions should be a list"
        
        print(f"✓ Transactions structure correct - Orders: {len(transactions['orders'])}, Bills: {len(transactions['bill_payments'])}")
    
    def test_activity_timeline(self):
        """Test that activity timeline is returned correctly"""
        response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        
        assert response.status_code == 200
        
        activity = response.json()["activity"]
        assert isinstance(activity, list), "Activity should be a list"
        
        # If there's activity, verify structure
        if len(activity) > 0:
            first_activity = activity[0]
            assert "type" in first_activity or "action_type" in first_activity, "Activity should have type"
            assert "description" in first_activity, "Activity should have description"
        
        print(f"✓ Activity timeline correct - {len(activity)} activities")


class TestUser360Actions:
    """Test User 360° View quick actions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.admin_uid = data.get("user", {}).get("uid")
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        # Get test user UID
        user_response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        if user_response.status_code == 200:
            self.test_user_uid = user_response.json()["user"]["uid"]
        else:
            pytest.skip("Could not get test user")
    
    def test_pause_mining_action(self):
        """Test pause mining action"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "pause_mining",
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Action should succeed"
        assert "message" in data, "Response should contain message"
        
        print(f"✓ Pause mining action successful: {data.get('message')}")
    
    def test_resume_mining_action(self):
        """Test resume mining action"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "resume_mining",
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Action should succeed"
        
        print(f"✓ Resume mining action successful: {data.get('message')}")
    
    def test_adjust_balance_action(self):
        """Test adjust balance action"""
        # Get current balance
        user_response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        original_balance = user_response.json()["stats"]["net_balance"]
        
        # Add 10 PRC
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "adjust_balance",
            "amount": 10,
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Action should succeed"
        
        # Verify balance changed
        user_response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        new_balance = user_response.json()["stats"]["net_balance"]
        
        assert new_balance == original_balance + 10, f"Balance should increase by 10. Original: {original_balance}, New: {new_balance}"
        
        # Revert the change
        self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "adjust_balance",
            "amount": -10,
            "admin_id": self.admin_uid
        })
        
        print(f"✓ Adjust balance action successful: {original_balance} -> {new_balance}")
    
    def test_adjust_balance_zero_rejected(self):
        """Test that zero amount adjustment is rejected"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "adjust_balance",
            "amount": 0,
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 400, f"Expected 400 for zero amount, got {response.status_code}"
        
        print(f"✓ Zero amount adjustment correctly rejected")
    
    def test_set_daily_cap_action(self):
        """Test set daily cap action"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "set_cap",
            "cap": 100,
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Action should succeed"
        
        # Reset cap to unlimited
        self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "set_cap",
            "cap": 0,
            "admin_id": self.admin_uid
        })
        
        print(f"✓ Set daily cap action successful: {data.get('message')}")
    
    def test_send_notification_action(self):
        """Test send notification action"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "send_notification",
            "message": "Test notification from User 360 testing",
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Action should succeed"
        
        print(f"✓ Send notification action successful: {data.get('message')}")
    
    def test_send_notification_empty_message_rejected(self):
        """Test that empty notification message is rejected"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "send_notification",
            "message": "",
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 400, f"Expected 400 for empty message, got {response.status_code}"
        
        print(f"✓ Empty notification message correctly rejected")
    
    def test_save_notes_action(self):
        """Test save admin notes action"""
        test_note = f"Test note from User 360 testing - {datetime.now().isoformat()}"
        
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "save_notes",
            "notes": test_note,
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Action should succeed"
        
        # Verify notes were saved
        user_response = self.session.get(f"{BASE_URL}/api/admin/user-360", params={"query": TEST_USER_EMAIL})
        saved_notes = user_response.json()["user"].get("admin_notes")
        
        assert saved_notes == test_note, f"Notes should be saved. Expected: {test_note}, Got: {saved_notes}"
        
        print(f"✓ Save notes action successful")
    
    def test_reset_password_action(self):
        """Test reset password action"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "reset_password",
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Action should succeed"
        
        print(f"✓ Reset password action successful: {data.get('message')}")
    
    def test_unknown_action_rejected(self):
        """Test that unknown actions are rejected"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "action": "unknown_action_xyz",
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 400, f"Expected 400 for unknown action, got {response.status_code}"
        
        print(f"✓ Unknown action correctly rejected")
    
    def test_action_missing_user_id(self):
        """Test that missing user_id is rejected"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "action": "pause_mining",
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 400, f"Expected 400 for missing user_id, got {response.status_code}"
        
        print(f"✓ Missing user_id correctly rejected")
    
    def test_action_missing_action(self):
        """Test that missing action is rejected"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": self.test_user_uid,
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 400, f"Expected 400 for missing action, got {response.status_code}"
        
        print(f"✓ Missing action correctly rejected")
    
    def test_action_nonexistent_user(self):
        """Test action on non-existent user"""
        response = self.session.post(f"{BASE_URL}/api/admin/user-360/action", json={
            "user_id": "nonexistent-user-id-xyz",
            "action": "pause_mining",
            "admin_id": self.admin_uid
        })
        
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        
        print(f"✓ Non-existent user action correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
