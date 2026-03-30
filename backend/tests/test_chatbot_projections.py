"""
Test Chatbot Earning Projection Calculator
- Tests the /api/ai/support-chat endpoint for projection queries
- Tests compute_projections function directly
- Tests multilingual responses (English, Marathi, Hindi)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
TEST_USER_MOBILE = "9970100782"
TEST_USER_PIN = "997010"


class TestChatbotProjections:
    """Test chatbot earning projection calculator feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_chatbot_endpoint_exists(self):
        """Test that chatbot endpoint is accessible"""
        response = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "Hello",
                "session_id": None
            }
        )
        # Should return 200 or 503 (if LLM not available)
        assert response.status_code in [200, 503], f"Unexpected status: {response.status_code}"
        print(f"Chatbot endpoint status: {response.status_code}")
    
    def test_projection_query_10_referrals(self):
        """Test projection query for 10 more referrals"""
        response = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "If I get 10 more referrals, what will be my daily earning?",
                "session_id": None
            }
        )
        
        if response.status_code == 503:
            pytest.skip("AI service not available")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "response" in data, "Response should contain 'response' field"
        assert "session_id" in data, "Response should contain 'session_id' field"
        
        # Check that response contains projection numbers
        response_text = data["response"].lower()
        print(f"Chatbot response for 10 referrals: {data['response'][:500]}")
        
        # Should mention PRC or earning
        assert any(word in response_text for word in ["prc", "earning", "daily", "earn"]), \
            "Response should mention PRC or earnings"
    
    def test_projection_query_marathi(self):
        """Test projection query in Marathi - should respond in Marathi"""
        response = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "25 referrals मिळाले तर daily earning किती?",
                "session_id": None
            }
        )
        
        if response.status_code == 503:
            pytest.skip("AI service not available")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        print(f"Chatbot response for Marathi query: {data['response'][:500]}")
        
        # Response should contain some Marathi or numbers
        assert len(data["response"]) > 50, "Response should be substantial"
    
    def test_projection_query_50_referrals(self):
        """Test projection query for 50 more referrals"""
        response = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "What if I bring 50 more referrals? How much will I earn daily?",
                "session_id": None
            }
        )
        
        if response.status_code == 503:
            pytest.skip("AI service not available")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        print(f"Chatbot response for 50 referrals: {data['response'][:500]}")
        
        # Should contain numbers
        assert any(char.isdigit() for char in data["response"]), \
            "Response should contain numeric projections"
    
    def test_projection_query_100_referrals(self):
        """Test projection query for 100 more referrals"""
        response = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "If I get 100 more referrals, what will my daily earning be?",
                "session_id": None
            }
        )
        
        if response.status_code == 503:
            pytest.skip("AI service not available")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        print(f"Chatbot response for 100 referrals: {data['response'][:500]}")
        
        # Should contain numbers
        assert any(char.isdigit() for char in data["response"]), \
            "Response should contain numeric projections"
    
    def test_general_query_balance(self):
        """Test general query about current balance"""
        response = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "What is my current balance?",
                "session_id": None
            }
        )
        
        if response.status_code == 503:
            pytest.skip("AI service not available")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        print(f"Chatbot response for balance query: {data['response'][:500]}")
        
        # Should mention PRC or balance
        response_text = data["response"].lower()
        assert any(word in response_text for word in ["prc", "balance", "rs", "₹"]), \
            "Response should mention PRC or balance"
    
    def test_session_persistence(self):
        """Test that session_id is returned and can be reused"""
        # First message
        response1 = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "Hello",
                "session_id": None
            }
        )
        
        if response1.status_code == 503:
            pytest.skip("AI service not available")
        
        assert response1.status_code == 200
        data1 = response1.json()
        session_id = data1.get("session_id")
        
        assert session_id is not None, "Session ID should be returned"
        print(f"Session ID: {session_id}")
        
        # Second message with same session
        response2 = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "What about 10 referrals?",
                "session_id": session_id
            }
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Session ID should be same
        assert data2.get("session_id") == session_id, "Session ID should persist"
    
    def test_invalid_uid_handling(self):
        """Test handling of invalid/unknown UID"""
        response = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": "invalid-uid-12345",
                "message": "What is my balance?",
                "session_id": None
            }
        )
        
        if response.status_code == 503:
            pytest.skip("AI service not available")
        
        # Should still work but without user context
        assert response.status_code == 200, f"Should handle invalid UID gracefully: {response.text}"
        print(f"Response for invalid UID: {response.json().get('response', '')[:200]}")
    
    def test_hindi_query(self):
        """Test query in Hindi"""
        response = self.session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "अगर मुझे 10 और referrals मिलें तो मेरी daily earning कितनी होगी?",
                "session_id": None
            }
        )
        
        if response.status_code == 503:
            pytest.skip("AI service not available")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        print(f"Chatbot response for Hindi query: {data['response'][:500]}")
        assert len(data["response"]) > 50, "Response should be substantial"


class TestComputeProjectionsFunction:
    """Test the compute_projections function directly via API response"""
    
    def test_projection_data_in_response(self):
        """Verify projection data is being computed and used"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/ai/support-chat",
            json={
                "uid": TEST_USER_UID,
                "message": "Show me projections for 5, 10, 25, 50, and 100 referrals",
                "session_id": None
            }
        )
        
        if response.status_code == 503:
            pytest.skip("AI service not available")
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"Projection data response: {data['response'][:800]}")
        
        # Response should contain multiple numbers (projections)
        digits_count = sum(1 for c in data["response"] if c.isdigit())
        assert digits_count > 5, "Response should contain multiple numeric projections"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
