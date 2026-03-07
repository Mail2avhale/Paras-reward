"""
Test suite for Chatbot Payment Issue Auto-Resolution API
=========================================================
Tests for /api/chatbot-payment-fix/* endpoints

Features tested:
1. Check pending payments API
2. Search payment API
3. Resolve payment API  
4. Resolution history API
5. Admin stats API
6. Rate limiting (max 5 attempts/day)
7. 30 day time limit enforcement
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestChatbotPaymentFixAPI:
    """Test suite for chatbot payment fix API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.api_base = f"{BASE_URL}/api/chatbot-payment-fix"
        self.test_uid = f"test-user-{uuid.uuid4().hex[:8]}"
        
    # ==================== CHECK PENDING PAYMENTS ====================
    
    def test_check_pending_payments_returns_valid_response(self):
        """Test check-pending endpoint returns valid structure"""
        response = requests.get(f"{self.api_base}/check-pending/{self.test_uid}")
        assert response.status_code == 200
        data = response.json()
        
        # Should have required fields
        assert "has_pending" in data
        assert "message" in data
        assert isinstance(data["has_pending"], bool)
        
    def test_check_pending_with_no_pending_payments(self):
        """Test check-pending returns proper message when no pending payments"""
        # Use a fresh test UID that won't have any orders
        fresh_uid = f"fresh-test-{uuid.uuid4().hex[:8]}"
        response = requests.get(f"{self.api_base}/check-pending/{fresh_uid}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["has_pending"] == False
        assert "pending" in data["message"].lower() or "सापडले" in data["message"]
        
    def test_check_pending_with_existing_user(self):
        """Test check-pending endpoint with a known user ID that has orders"""
        # This test user has pending orders from earlier test
        response = requests.get(f"{self.api_base}/check-pending/test-user-123")
        assert response.status_code == 200
        data = response.json()
        
        # Response should be valid regardless of whether pending exists
        assert "has_pending" in data
        assert "message" in data
        
        if data["has_pending"]:
            assert "count" in data
            assert "orders" in data
            assert isinstance(data["orders"], list)
            
            # Verify order structure if orders exist
            if len(data["orders"]) > 0:
                order = data["orders"][0]
                assert "order_id" in order
                assert "amount" in order
                assert "plan" in order
                assert "date" in order
    
    # ==================== SEARCH PAYMENT ====================
    
    def test_search_payment_requires_payment_id_or_utr(self):
        """Test search-payment fails without payment_id or utr_number"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01/03/2026"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "Payment ID" in data["detail"] or "UTR" in data["detail"]
        
    def test_search_payment_with_payment_id(self):
        """Test search-payment with payment_id"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "pay_test123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Response should have search result structure
        assert "found" in data
        assert "message" in data
        
    def test_search_payment_with_utr_number(self):
        """Test search-payment with UTR number"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "utr_number": "UTR123456789"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "found" in data
        assert "message" in data
        
    def test_search_payment_date_format_dd_mm_yyyy(self):
        """Test search-payment accepts DD/MM/YYYY date format"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "pay_test123"
            }
        )
        assert response.status_code == 200
        
    def test_search_payment_date_format_yyyy_mm_dd(self):
        """Test search-payment accepts YYYY-MM-DD date format"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "2026-03-01",
                "payment_id": "pay_test123"
            }
        )
        assert response.status_code == 200
        
    def test_search_payment_date_format_dd_mm_yyyy_dash(self):
        """Test search-payment accepts DD-MM-YYYY date format"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01-03-2026",
                "payment_id": "pay_test123"
            }
        )
        assert response.status_code == 200
        
    def test_search_payment_invalid_date_format(self):
        """Test search-payment rejects invalid date format"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "invalid-date",
                "payment_id": "pay_test123"
            }
        )
        assert response.status_code == 422  # Validation error
        
    def test_search_payment_extracts_payment_id_from_text(self):
        """Test search-payment extracts payment_id from text containing pay_xxx"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "My payment was pay_ABC123XYZ on this date"
            }
        )
        assert response.status_code == 200
        
    # ==================== 30 DAY TIME LIMIT ====================
    
    def test_search_payment_rejects_old_date(self):
        """Test search-payment rejects dates older than 30 days"""
        old_date = (datetime.now() - timedelta(days=35)).strftime("%d/%m/%Y")
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": old_date,
                "payment_id": "pay_old123"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "30" in data["detail"] or "days" in data["detail"].lower()
        
    def test_search_payment_accepts_recent_date(self):
        """Test search-payment accepts dates within 30 days"""
        recent_date = (datetime.now() - timedelta(days=5)).strftime("%d/%m/%Y")
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": recent_date,
                "payment_id": "pay_recent123"
            }
        )
        assert response.status_code == 200
        
    def test_search_payment_accepts_today_date(self):
        """Test search-payment accepts today's date"""
        today = datetime.now().strftime("%d/%m/%Y")
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": today,
                "payment_id": "pay_today123"
            }
        )
        assert response.status_code == 200

    # ==================== RESOLVE PAYMENT ====================
    
    def test_resolve_payment_requires_payment_id_or_utr(self):
        """Test resolve-payment requires payment_id or utr_number"""
        response = requests.post(
            f"{self.api_base}/resolve-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01/03/2026"
            }
        )
        assert response.status_code == 400
        
    def test_resolve_payment_returns_result_structure(self):
        """Test resolve-payment returns proper ResolutionResult structure"""
        response = requests.post(
            f"{self.api_base}/resolve-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "pay_nonexistent123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have ResolutionResult fields
        assert "success" in data
        assert "message" in data
        assert isinstance(data["success"], bool)
        
    def test_resolve_payment_fails_for_nonexistent_payment(self):
        """Test resolve-payment fails gracefully for non-existent payment"""
        response = requests.post(
            f"{self.api_base}/resolve-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "pay_doesnotexist"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == False
        assert "message" in data
        
    # ==================== RATE LIMITING ====================
    
    def test_rate_limiting_enforced(self):
        """Test rate limiting enforces max 5 attempts per day per user"""
        # Use a unique UID for this rate limit test
        rate_test_uid = f"rate-limit-test-{uuid.uuid4().hex[:8]}"
        
        # Make 5 requests (should all succeed)
        for i in range(5):
            response = requests.post(
                f"{self.api_base}/search-payment",
                json={
                    "uid": rate_test_uid,
                    "amount": 299,
                    "payment_date": "01/03/2026",
                    "payment_id": f"pay_rate{i}"
                }
            )
            assert response.status_code == 200, f"Request {i+1} should succeed"
            
        # 6th request should be rate limited
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": rate_test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "pay_rate6"
            }
        )
        assert response.status_code == 429
        data = response.json()
        assert "limit" in data["detail"].lower() or "attempts" in data["detail"]
        
    def test_rate_limiting_per_user(self):
        """Test rate limiting is per-user (different users have separate limits)"""
        # User 1 makes 5 requests
        user1_uid = f"user1-{uuid.uuid4().hex[:8]}"
        for i in range(5):
            requests.post(
                f"{self.api_base}/search-payment",
                json={
                    "uid": user1_uid,
                    "amount": 299,
                    "payment_date": "01/03/2026",
                    "payment_id": f"pay_{i}"
                }
            )
            
        # User 2 should still be able to make requests
        user2_uid = f"user2-{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": user2_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "pay_user2"
            }
        )
        assert response.status_code == 200, "User 2 should not be rate limited"
        
    # ==================== RESOLUTION HISTORY ====================
    
    def test_resolution_history_returns_valid_structure(self):
        """Test resolution-history endpoint returns valid structure"""
        response = requests.get(f"{self.api_base}/resolution-history/{self.test_uid}")
        assert response.status_code == 200
        data = response.json()
        
        assert "attempts" in data
        assert "total" in data
        assert isinstance(data["attempts"], list)
        assert isinstance(data["total"], int)
        
    def test_resolution_history_with_limit(self):
        """Test resolution-history respects limit parameter"""
        response = requests.get(f"{self.api_base}/resolution-history/{self.test_uid}?limit=5")
        assert response.status_code == 200
        data = response.json()
        
        # If there are attempts, they should not exceed limit
        assert len(data["attempts"]) <= 5
        
    def test_resolution_history_records_attempts(self):
        """Test resolution-history records search attempts"""
        # Create unique user for this test
        history_test_uid = f"history-test-{uuid.uuid4().hex[:8]}"
        
        # Make a search request
        requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": history_test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "pay_history_test"
            }
        )
        
        # Check history contains the attempt
        response = requests.get(f"{self.api_base}/resolution-history/{history_test_uid}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] >= 1
        assert len(data["attempts"]) >= 1
        
        # Verify attempt structure
        if data["attempts"]:
            attempt = data["attempts"][0]
            assert "attempt_id" in attempt
            assert "uid" in attempt
            assert "timestamp" in attempt
            assert "request" in attempt
            assert "result" in attempt
            
    # ==================== ADMIN STATS ====================
    
    def test_admin_stats_returns_valid_structure(self):
        """Test admin/stats endpoint returns valid structure"""
        response = requests.get(f"{self.api_base}/admin/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_attempts" in data
        assert "successful_resolutions" in data
        assert "today_attempts" in data
        
        # All values should be integers
        assert isinstance(data["total_attempts"], int)
        assert isinstance(data["successful_resolutions"], int)
        assert isinstance(data["today_attempts"], int)
        
        # Values should be non-negative
        assert data["total_attempts"] >= 0
        assert data["successful_resolutions"] >= 0
        assert data["today_attempts"] >= 0
        
    def test_admin_stats_today_attempts_increments(self):
        """Test admin/stats today_attempts increments after search"""
        # Get initial stats
        initial_response = requests.get(f"{self.api_base}/admin/stats")
        initial_today = initial_response.json()["today_attempts"]
        
        # Make a search request with unique user
        stats_test_uid = f"stats-test-{uuid.uuid4().hex[:8]}"
        requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": stats_test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "pay_stats_test"
            }
        )
        
        # Check stats incremented
        final_response = requests.get(f"{self.api_base}/admin/stats")
        final_today = final_response.json()["today_attempts"]
        
        assert final_today > initial_today
        
    # ==================== INPUT VALIDATION ====================
    
    def test_search_payment_rejects_zero_amount(self):
        """Test search-payment rejects zero amount"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 0,
                "payment_date": "01/03/2026",
                "payment_id": "pay_test"
            }
        )
        assert response.status_code == 422  # Validation error
        
    def test_search_payment_rejects_negative_amount(self):
        """Test search-payment rejects negative amount"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": -100,
                "payment_date": "01/03/2026",
                "payment_id": "pay_test"
            }
        )
        assert response.status_code == 422  # Validation error
        
    def test_search_payment_accepts_decimal_amount(self):
        """Test search-payment accepts decimal amounts"""
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299.50,
                "payment_date": "01/03/2026",
                "payment_id": "pay_decimal"
            }
        )
        assert response.status_code == 200


class TestRazorpayIntegration:
    """Test Razorpay API integration (may require real credentials)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.api_base = f"{BASE_URL}/api/chatbot-payment-fix"
        self.test_uid = f"razorpay-test-{uuid.uuid4().hex[:8]}"
        
    def test_razorpay_credentials_configured(self):
        """Test that Razorpay credentials are configured"""
        # This test implicitly checks credentials by making a payment verification
        # If credentials are missing, the search would return an error
        response = requests.post(
            f"{self.api_base}/search-payment",
            json={
                "uid": self.test_uid,
                "amount": 299,
                "payment_date": "01/03/2026",
                "payment_id": "pay_test_cred_check"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should not have credential error in message
        assert "credentials not configured" not in data.get("message", "").lower()
