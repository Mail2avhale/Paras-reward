"""
DMT (Domestic Money Transfer) Backend API Tests
================================================
Tests for the EKO DMT service endpoints.
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from the test request
TEST_USER_ID = "73b95483-f36b-4637-a5ee-d447300c6835"
TEST_CUSTOMER_MOBILE = "9970100782"
TEST_RECIPIENT_ID = "15186062"


class TestDMTHealthAndConfig:
    """Test DMT service health and configuration endpoints"""

    def test_dmt_health_check(self):
        """DMT health endpoint should return running status"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "DMT SERVICE RUNNING"
        assert "prc_rate" in data
        assert "min_redeem" in data
        assert "max_daily" in data

    def test_dmt_health_contains_correct_rate(self):
        """DMT health should show correct PRC conversion rate"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/health")
        data = response.json()
        assert data["prc_rate"] == "100 PRC = ₹1"
        assert data["min_redeem"] == "₹100"
        assert data["max_daily"] == "₹5000"


class TestDMTWallet:
    """Test DMT wallet balance endpoint"""

    def test_wallet_for_valid_user(self):
        """Wallet endpoint should return balance for valid user"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/wallet/{TEST_USER_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        wallet = data["data"]
        assert "prc_balance" in wallet
        assert "inr_equivalent" in wallet
        assert "can_redeem" in wallet
        assert "daily_limit_inr" in wallet
        assert "remaining_limit_inr" in wallet

    def test_wallet_for_invalid_user(self):
        """Wallet endpoint should return 404 for invalid user"""
        response = requests.get(f"{BASE_URL}/api/eko/dmt/wallet/invalid-user-id-12345")
        assert response.status_code == 404


class TestDMTCustomerSearch:
    """Test DMT customer search endpoint"""

    def test_customer_search_valid_mobile(self):
        """Customer search should find registered customer"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={
                "mobile": TEST_CUSTOMER_MOBILE,
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        customer = data["data"]
        assert customer["customer_exists"] == True
        assert customer["mobile"] == TEST_CUSTOMER_MOBILE
        assert "name" in customer
        assert "available_limit" in customer

    def test_customer_search_invalid_mobile_length(self):
        """Customer search should reject invalid mobile length"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={
                "mobile": "123",  # Too short
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 422  # Validation error

    def test_customer_search_non_numeric_mobile(self):
        """Customer search should reject non-numeric mobile"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={
                "mobile": "99701a0078",  # Contains letters
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 422


class TestDMTRecipients:
    """Test DMT recipients list endpoint"""

    def test_get_recipients_for_valid_customer(self):
        """Should return recipients list for registered customer"""
        response = requests.get(
            f"{BASE_URL}/api/eko/dmt/recipients/{TEST_CUSTOMER_MOBILE}",
            params={"user_id": TEST_USER_ID}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        recipients_data = data["data"]
        assert "count" in recipients_data
        assert "recipients" in recipients_data
        assert recipients_data["count"] >= 0

    def test_recipients_contains_expected_recipient(self):
        """Recipients list should contain the test recipient"""
        response = requests.get(
            f"{BASE_URL}/api/eko/dmt/recipients/{TEST_CUSTOMER_MOBILE}",
            params={"user_id": TEST_USER_ID}
        )
        data = response.json()
        recipients = data["data"]["recipients"]
        
        # Find the test recipient
        test_recipient = None
        for r in recipients:
            if str(r["recipient_id"]) == TEST_RECIPIENT_ID:
                test_recipient = r
                break
        
        assert test_recipient is not None, f"Test recipient {TEST_RECIPIENT_ID} not found"
        assert test_recipient["recipient_name"] is not None
        assert test_recipient["ifsc"] is not None

    def test_recipients_response_structure(self):
        """Recipients should have correct data structure"""
        response = requests.get(
            f"{BASE_URL}/api/eko/dmt/recipients/{TEST_CUSTOMER_MOBILE}",
            params={"user_id": TEST_USER_ID}
        )
        data = response.json()
        
        if data["data"]["count"] > 0:
            recipient = data["data"]["recipients"][0]
            assert "recipient_id" in recipient
            assert "recipient_name" in recipient
            assert "account_masked" in recipient or "account_number" in recipient
            assert "ifsc" in recipient


class TestDMTTransactions:
    """Test DMT transaction history endpoint"""

    def test_get_transactions_for_valid_user(self):
        """Should return transaction history for valid user"""
        response = requests.get(
            f"{BASE_URL}/api/eko/dmt/transactions/{TEST_USER_ID}",
            params={"limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "total" in data["data"]
        assert "transactions" in data["data"]

    def test_transactions_structure(self):
        """Transactions should have correct data structure"""
        response = requests.get(
            f"{BASE_URL}/api/eko/dmt/transactions/{TEST_USER_ID}",
            params={"limit": 5}
        )
        data = response.json()
        
        if data["data"]["count"] > 0:
            txn = data["data"]["transactions"][0]
            assert "transaction_id" in txn
            assert "status" in txn
            assert "amount_inr" in txn
            assert "prc_used" in txn
            assert "created_at" in txn


class TestDMTTransferValidation:
    """Test DMT transfer validation (without actually executing transfers)"""

    def test_transfer_requires_user_id(self):
        """Transfer should require user_id"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/transfer",
            json={
                "mobile": TEST_CUSTOMER_MOBILE,
                "recipient_id": TEST_RECIPIENT_ID,
                "prc_amount": 10000
            }
        )
        assert response.status_code == 422

    def test_transfer_requires_valid_mobile(self):
        """Transfer should require valid mobile"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/transfer",
            json={
                "user_id": TEST_USER_ID,
                "mobile": "123",  # Invalid
                "recipient_id": TEST_RECIPIENT_ID,
                "prc_amount": 10000
            }
        )
        assert response.status_code == 422

    def test_transfer_minimum_amount_validation(self):
        """Transfer should enforce minimum amount (₹100 = 10000 PRC)"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/transfer",
            json={
                "user_id": TEST_USER_ID,
                "mobile": TEST_CUSTOMER_MOBILE,
                "recipient_id": TEST_RECIPIENT_ID,
                "prc_amount": 100  # Too low (only ₹1)
            }
        )
        # Should fail validation
        assert response.status_code == 422


class TestDMTAddRecipientValidation:
    """Test DMT add recipient validation"""

    def test_add_recipient_requires_all_fields(self):
        """Add recipient should require all fields"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/recipient/add",
            json={
                "mobile": TEST_CUSTOMER_MOBILE,
                "user_id": TEST_USER_ID
                # Missing recipient_name, account_number, ifsc
            }
        )
        assert response.status_code == 422

    def test_add_recipient_validates_ifsc_length(self):
        """Add recipient should validate IFSC is 11 characters"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/recipient/add",
            json={
                "mobile": TEST_CUSTOMER_MOBILE,
                "user_id": TEST_USER_ID,
                "recipient_name": "Test User",
                "account_number": "12345678901",
                "ifsc": "SBIN"  # Too short (should be 11)
            }
        )
        assert response.status_code == 422

    def test_add_recipient_validates_account_numeric(self):
        """Add recipient should validate account number is numeric"""
        response = requests.post(
            f"{BASE_URL}/api/eko/dmt/recipient/add",
            json={
                "mobile": TEST_CUSTOMER_MOBILE,
                "user_id": TEST_USER_ID,
                "recipient_name": "Test User",
                "account_number": "123abc456",  # Contains letters
                "ifsc": "SBIN0001234"
            }
        )
        assert response.status_code == 422


class TestDMTEndToEndFlow:
    """Test the full DMT flow - simulating what frontend does"""

    def test_full_dmt_flow_search_and_recipients(self):
        """Test full flow: wallet -> search -> recipients"""
        # Step 1: Check wallet
        wallet_resp = requests.get(f"{BASE_URL}/api/eko/dmt/wallet/{TEST_USER_ID}")
        assert wallet_resp.status_code == 200
        wallet = wallet_resp.json()["data"]
        assert wallet["prc_balance"] >= 0

        # Step 2: Search customer
        search_resp = requests.post(
            f"{BASE_URL}/api/eko/dmt/customer/search",
            json={
                "mobile": TEST_CUSTOMER_MOBILE,
                "user_id": TEST_USER_ID
            }
        )
        assert search_resp.status_code == 200
        customer = search_resp.json()["data"]
        assert customer["customer_exists"] == True

        # Step 3: Get recipients
        recipients_resp = requests.get(
            f"{BASE_URL}/api/eko/dmt/recipients/{TEST_CUSTOMER_MOBILE}",
            params={"user_id": TEST_USER_ID}
        )
        assert recipients_resp.status_code == 200
        recipients = recipients_resp.json()["data"]
        assert recipients["count"] >= 0

        # Step 4: Get transactions
        txn_resp = requests.get(
            f"{BASE_URL}/api/eko/dmt/transactions/{TEST_USER_ID}",
            params={"limit": 5}
        )
        assert txn_resp.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
