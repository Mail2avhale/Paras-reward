"""
Integration tests for POST /api/admin/restore-zero-balance-prc endpoint
with database setup and cleanup for complete flow verification.

These tests create temporary test data to verify:
1. Restoration from prc_corrections_log
2. Restoration from user.prc_before_correction field
3. Transaction and restoration logging
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'paras_reward_db')


class TestRestoreZeroBalancePRCWithDatabaseSetup:
    """
    Integration tests that set up test data in the database to verify
    the complete restoration flow.
    """
    
    @pytest.fixture
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture
    def db_client(self):
        """MongoDB client for test data setup"""
        client = MongoClient(MONGO_URL)
        return client[DB_NAME]
    
    @pytest.fixture
    def test_user_with_correction_log(self, db_client):
        """
        Create a test user with zero balance and backup in prc_corrections_log.
        Returns the user uid for verification.
        Cleans up after test.
        """
        test_uid = f"TEST_RESTORE_{uuid.uuid4().hex[:8]}"
        test_email = f"test_restore_{uuid.uuid4().hex[:6]}@test.com"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create user with zero balance
        user_doc = {
            "uid": test_uid,
            "name": "TEST Restore User Correction Log",
            "email": test_email,
            "prc_balance": 0,
            "subscription_plan": "elite",
            "created_at": timestamp,
            "test_data": True
        }
        db_client.users.insert_one(user_doc)
        
        # Create prc_corrections_log entry with backup balance
        correction_doc = {
            "uid": test_uid,
            "before": 500.0,  # Previous balance before correction
            "after": 0,
            "reason": "subscription_expiry",
            "corrected_at": timestamp,
            "test_data": True
        }
        db_client.prc_corrections_log.insert_one(correction_doc)
        
        yield {
            "uid": test_uid,
            "email": test_email,
            "expected_restore_balance": 500.0,
            "expected_source": "prc_corrections_log"
        }
        
        # Cleanup
        db_client.users.delete_one({"uid": test_uid})
        db_client.prc_corrections_log.delete_many({"uid": test_uid})
        db_client.prc_restorations_log.delete_many({"uid": test_uid})
        db_client.transactions.delete_many({"user_id": test_uid})
    
    @pytest.fixture
    def test_user_with_before_correction_field(self, db_client):
        """
        Create a test user with zero balance and backup in prc_before_correction field.
        No correction log entry.
        """
        test_uid = f"TEST_RESTORE_{uuid.uuid4().hex[:8]}"
        test_email = f"test_restore_{uuid.uuid4().hex[:6]}@test.com"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create user with zero balance and prc_before_correction
        user_doc = {
            "uid": test_uid,
            "name": "TEST Restore User Before Correction",
            "email": test_email,
            "prc_balance": 0,
            "prc_before_correction": 750.5,  # Backup balance in user doc
            "subscription_plan": "growth",
            "created_at": timestamp,
            "test_data": True
        }
        db_client.users.insert_one(user_doc)
        
        yield {
            "uid": test_uid,
            "email": test_email,
            "expected_restore_balance": 750.5,
            "expected_source": "user.prc_before_correction"
        }
        
        # Cleanup
        db_client.users.delete_one({"uid": test_uid})
        db_client.prc_restorations_log.delete_many({"uid": test_uid})
        db_client.transactions.delete_many({"user_id": test_uid})
    
    @pytest.fixture
    def test_user_with_both_sources(self, db_client):
        """
        Create a test user with backup in both places.
        prc_corrections_log should take priority.
        """
        test_uid = f"TEST_RESTORE_{uuid.uuid4().hex[:8]}"
        test_email = f"test_restore_{uuid.uuid4().hex[:6]}@test.com"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create user with zero balance and prc_before_correction
        user_doc = {
            "uid": test_uid,
            "name": "TEST Restore User Both Sources",
            "email": test_email,
            "prc_balance": 0,
            "prc_before_correction": 300.0,  # Lower priority backup
            "subscription_plan": "startup",
            "created_at": timestamp,
            "test_data": True
        }
        db_client.users.insert_one(user_doc)
        
        # Create prc_corrections_log entry (higher priority)
        correction_doc = {
            "uid": test_uid,
            "before": 1000.0,  # Higher priority backup
            "after": 0,
            "reason": "subscription_expiry",
            "corrected_at": timestamp,
            "test_data": True
        }
        db_client.prc_corrections_log.insert_one(correction_doc)
        
        yield {
            "uid": test_uid,
            "email": test_email,
            "expected_restore_balance": 1000.0,  # Should use correction_log value
            "expected_source": "prc_corrections_log"
        }
        
        # Cleanup
        db_client.users.delete_one({"uid": test_uid})
        db_client.prc_corrections_log.delete_many({"uid": test_uid})
        db_client.prc_restorations_log.delete_many({"uid": test_uid})
        db_client.transactions.delete_many({"user_id": test_uid})
    
    # ============== TEST CASES ==============
    
    def test_dry_run_finds_user_from_correction_log(self, api_client, test_user_with_correction_log):
        """Test that dry_run finds user with backup in prc_corrections_log"""
        response = api_client.post(f"{BASE_URL}/api/admin/restore-zero-balance-prc?dry_run=true&limit=100")
        assert response.status_code == 200
        data = response.json()
        
        user_info = test_user_with_correction_log
        restorations = data.get("restorations", [])
        
        # Find our test user
        test_user_restoration = next(
            (r for r in restorations if r.get("uid") == user_info["uid"]),
            None
        )
        
        assert test_user_restoration is not None, f"Test user {user_info['uid']} not found in restorations"
        assert test_user_restoration.get("status") == "would_restore", f"Expected would_restore, got {test_user_restoration.get('status')}"
        assert test_user_restoration.get("restore_balance") == user_info["expected_restore_balance"], \
            f"Expected restore_balance {user_info['expected_restore_balance']}, got {test_user_restoration.get('restore_balance')}"
        assert test_user_restoration.get("restore_source") == user_info["expected_source"], \
            f"Expected source {user_info['expected_source']}, got {test_user_restoration.get('restore_source')}"
    
    def test_dry_run_finds_user_from_before_correction_field(self, api_client, test_user_with_before_correction_field):
        """Test that dry_run finds user with backup in prc_before_correction field"""
        response = api_client.post(f"{BASE_URL}/api/admin/restore-zero-balance-prc?dry_run=true&limit=100")
        assert response.status_code == 200
        data = response.json()
        
        user_info = test_user_with_before_correction_field
        restorations = data.get("restorations", [])
        
        # Find our test user
        test_user_restoration = next(
            (r for r in restorations if r.get("uid") == user_info["uid"]),
            None
        )
        
        assert test_user_restoration is not None, f"Test user {user_info['uid']} not found in restorations"
        assert test_user_restoration.get("status") == "would_restore", f"Expected would_restore, got {test_user_restoration.get('status')}"
        assert test_user_restoration.get("restore_balance") == user_info["expected_restore_balance"], \
            f"Expected restore_balance {user_info['expected_restore_balance']}, got {test_user_restoration.get('restore_balance')}"
        assert test_user_restoration.get("restore_source") == user_info["expected_source"], \
            f"Expected source {user_info['expected_source']}, got {test_user_restoration.get('restore_source')}"
    
    def test_correction_log_takes_priority_over_user_field(self, api_client, test_user_with_both_sources):
        """Test that prc_corrections_log takes priority over user.prc_before_correction"""
        response = api_client.post(f"{BASE_URL}/api/admin/restore-zero-balance-prc?dry_run=true&limit=100")
        assert response.status_code == 200
        data = response.json()
        
        user_info = test_user_with_both_sources
        restorations = data.get("restorations", [])
        
        # Find our test user
        test_user_restoration = next(
            (r for r in restorations if r.get("uid") == user_info["uid"]),
            None
        )
        
        assert test_user_restoration is not None, f"Test user {user_info['uid']} not found in restorations"
        # Should use correction_log value (1000) not user.prc_before_correction (300)
        assert test_user_restoration.get("restore_balance") == 1000.0, \
            f"Expected restore_balance 1000.0 (from correction_log), got {test_user_restoration.get('restore_balance')}"
        assert test_user_restoration.get("restore_source") == "prc_corrections_log", \
            f"Expected source prc_corrections_log, got {test_user_restoration.get('restore_source')}"
    
    def test_actual_restoration_updates_user_balance(self, api_client, db_client, test_user_with_correction_log):
        """Test that dry_run=false actually updates the user's balance"""
        user_info = test_user_with_correction_log
        
        # Verify initial state
        user_before = db_client.users.find_one({"uid": user_info["uid"]})
        assert user_before is not None
        assert user_before.get("prc_balance") == 0
        
        # Perform actual restoration
        response = api_client.post(f"{BASE_URL}/api/admin/restore-zero-balance-prc?dry_run=false&limit=100")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("dry_run") is False
        
        # Verify user balance was updated
        user_after = db_client.users.find_one({"uid": user_info["uid"]})
        assert user_after is not None
        assert user_after.get("prc_balance") == user_info["expected_restore_balance"], \
            f"Expected balance {user_info['expected_restore_balance']}, got {user_after.get('prc_balance')}"
        
        # Verify additional fields set
        assert user_after.get("prc_restored_at") is not None, "prc_restored_at not set"
        assert user_after.get("prc_restore_source") == user_info["expected_source"], \
            f"Expected prc_restore_source {user_info['expected_source']}, got {user_after.get('prc_restore_source')}"
        assert user_after.get("prc_balance_before_restore") == 0, "prc_balance_before_restore not set correctly"
    
    def test_actual_restoration_creates_restoration_log(self, api_client, db_client, test_user_with_correction_log):
        """Test that dry_run=false creates entry in prc_restorations_log"""
        user_info = test_user_with_correction_log
        
        # Perform actual restoration
        response = api_client.post(f"{BASE_URL}/api/admin/restore-zero-balance-prc?dry_run=false&limit=100")
        assert response.status_code == 200
        
        # Check restoration log
        restoration_log = db_client.prc_restorations_log.find_one({"uid": user_info["uid"]})
        assert restoration_log is not None, "No restoration log entry created"
        
        assert restoration_log.get("balance_before") == 0, "balance_before not correct"
        assert restoration_log.get("balance_after") == user_info["expected_restore_balance"], \
            f"balance_after should be {user_info['expected_restore_balance']}, got {restoration_log.get('balance_after')}"
        assert restoration_log.get("restore_source") == user_info["expected_source"], \
            f"restore_source should be {user_info['expected_source']}, got {restoration_log.get('restore_source')}"
        assert restoration_log.get("restored_at") is not None, "restored_at not set"
        assert "subscription expiry" in restoration_log.get("reason", "").lower(), \
            f"reason should mention subscription expiry, got {restoration_log.get('reason')}"
    
    def test_actual_restoration_creates_transaction_log(self, api_client, db_client, test_user_with_correction_log):
        """
        Test that dry_run=false creates entry in transactions collection.
        
        BUG DETECTED: The endpoint fails to create transaction log due to missing
        'transaction_id' field. The transactions collection has a unique index on
        'transaction_id' (not sparse), so inserting documents without this field
        causes duplicate key errors.
        
        This test captures the bug by checking the API response for errors.
        """
        user_info = test_user_with_correction_log
        
        # Perform actual restoration
        response = api_client.post(f"{BASE_URL}/api/admin/restore-zero-balance-prc?dry_run=false&limit=100")
        assert response.status_code == 200
        data = response.json()
        
        # Find our user's restoration record
        restorations = data.get("restorations", [])
        our_restoration = next(
            (r for r in restorations if r.get("uid") == user_info["uid"]),
            None
        )
        
        # BUG: Transaction creation fails due to missing transaction_id
        # The restoration record should have status 'error' with the duplicate key error
        if our_restoration and our_restoration.get("status") == "error":
            error_msg = our_restoration.get("error", "")
            if "duplicate key" in error_msg and "transaction_id" in error_msg:
                # This is the known bug - transaction_id is missing from the insert
                pytest.fail(
                    "BUG: Transaction log creation fails due to missing 'transaction_id' field. "
                    "The transactions collection has a unique index on 'transaction_id'. "
                    f"Error: {error_msg}"
                )
        
        # If no error, verify transaction was created (this would be the expected behavior)
        transaction = db_client.transactions.find_one({
            "user_id": user_info["uid"],
            "type": "admin_restore"
        })
        
        if transaction is None:
            # Check if there's an error in the response
            errors = data.get("errors", [])
            user_error = next((e for e in errors if e.get("uid") == user_info["uid"]), None)
            if user_error:
                pytest.fail(f"Transaction creation failed with error: {user_error.get('error')}")
            else:
                pytest.fail("No transaction entry created and no error reported")
        
        expected_amount = user_info["expected_restore_balance"] - 0  # restore - current
        assert transaction.get("amount") == expected_amount, \
            f"amount should be {expected_amount}, got {transaction.get('amount')}"
        assert transaction.get("balance_before") == 0, "balance_before not correct"
        assert transaction.get("balance_after") == user_info["expected_restore_balance"], \
            f"balance_after should be {user_info['expected_restore_balance']}, got {transaction.get('balance_after')}"
        assert "PRC restored" in transaction.get("description", ""), \
            f"description should mention PRC restored, got {transaction.get('description')}"
        assert transaction.get("created_at") is not None, "created_at not set"
    
    def test_restored_user_not_processed_again(self, api_client, db_client, test_user_with_correction_log):
        """Test that a user who was restored is not processed again (balance > 0)"""
        user_info = test_user_with_correction_log
        
        # First restoration
        response1 = api_client.post(f"{BASE_URL}/api/admin/restore-zero-balance-prc?dry_run=false&limit=100")
        assert response1.status_code == 200
        
        # Verify balance was restored
        user_after = db_client.users.find_one({"uid": user_info["uid"]})
        assert user_after.get("prc_balance") == user_info["expected_restore_balance"]
        
        # Second restoration attempt
        response2 = api_client.post(f"{BASE_URL}/api/admin/restore-zero-balance-prc?dry_run=true&limit=100")
        assert response2.status_code == 200
        data = response2.json()
        
        # User should NOT be in restorations (balance > 0 now)
        restorations = data.get("restorations", [])
        test_user_restoration = next(
            (r for r in restorations if r.get("uid") == user_info["uid"]),
            None
        )
        
        assert test_user_restoration is None, \
            f"Restored user {user_info['uid']} should not appear in second run (balance > 0)"


class TestRestoreZeroBalancePRCNegativeBalance:
    """Tests for users with negative balance"""
    
    @pytest.fixture
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture
    def db_client(self):
        """MongoDB client for test data setup"""
        client = MongoClient(MONGO_URL)
        return client[DB_NAME]
    
    @pytest.fixture
    def test_user_with_negative_balance(self, db_client):
        """Create a test user with negative balance"""
        test_uid = f"TEST_RESTORE_{uuid.uuid4().hex[:8]}"
        test_email = f"test_restore_{uuid.uuid4().hex[:6]}@test.com"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create user with negative balance
        user_doc = {
            "uid": test_uid,
            "name": "TEST Restore User Negative",
            "email": test_email,
            "prc_balance": -50.0,  # Negative balance
            "prc_before_correction": 200.0,
            "subscription_plan": "elite",
            "created_at": timestamp,
            "test_data": True
        }
        db_client.users.insert_one(user_doc)
        
        yield {
            "uid": test_uid,
            "email": test_email,
            "current_balance": -50.0,
            "expected_restore_balance": 200.0
        }
        
        # Cleanup
        db_client.users.delete_one({"uid": test_uid})
        db_client.prc_restorations_log.delete_many({"uid": test_uid})
        db_client.transactions.delete_many({"user_id": test_uid})
    
    def test_negative_balance_user_found(self, api_client, test_user_with_negative_balance):
        """Test that users with negative balance are also found"""
        response = api_client.post(f"{BASE_URL}/api/admin/restore-zero-balance-prc?dry_run=true&limit=100")
        assert response.status_code == 200
        data = response.json()
        
        user_info = test_user_with_negative_balance
        restorations = data.get("restorations", [])
        
        # Find our test user
        test_user_restoration = next(
            (r for r in restorations if r.get("uid") == user_info["uid"]),
            None
        )
        
        assert test_user_restoration is not None, f"Test user with negative balance not found"
        assert test_user_restoration.get("current_balance") == user_info["current_balance"], \
            f"Expected current_balance {user_info['current_balance']}, got {test_user_restoration.get('current_balance')}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
