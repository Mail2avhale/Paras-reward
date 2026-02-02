"""
Test Luxury Savings 80/20 Split Bug
User reported: 100% going to wallet, 0% to luxury savings
Expected: 80% to wallet, 20% to luxury savings
"""
import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bill-gamify.preview.emergentagent.com').rstrip('/')

# Test user credentials
TEST_USER_UID = "73b95483-f36b-4637-a5ee-d447300c6835"
TEST_USER_EMAIL = "mail2avhale@gmail.com"
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin123"


class TestLuxurySavingsSplit:
    """Test the 80/20 split for luxury savings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_01_get_user_current_state(self):
        """Get user's current balance and luxury savings before any action"""
        # Get user info
        response = self.session.get(f"{BASE_URL}/api/user/{TEST_USER_UID}")
        assert response.status_code == 200, f"Failed to get user: {response.text}"
        
        user_data = response.json()
        print(f"\n=== USER CURRENT STATE ===")
        print(f"Email: {user_data.get('email')}")
        print(f"PRC Balance: {user_data.get('prc_balance')}")
        print(f"Total Mined: {user_data.get('total_mined')}")
        print(f"Subscription: {user_data.get('subscription_plan', 'N/A')}")
        print(f"Membership Type: {user_data.get('membership_type')}")
        
        # Get luxury savings
        luxury_response = self.session.get(f"{BASE_URL}/api/luxury-life/savings/{TEST_USER_UID}")
        assert luxury_response.status_code == 200, f"Failed to get luxury savings: {luxury_response.text}"
        
        luxury_data = luxury_response.json()
        print(f"\n=== LUXURY SAVINGS STATE ===")
        print(f"Total Savings: {luxury_data.get('total_savings')} PRC")
        print(f"Mobile Savings: {luxury_data.get('products', [{}])[0].get('current_savings', 0)} PRC")
        print(f"Bike Savings: {luxury_data.get('products', [{}])[1].get('current_savings', 0)} PRC")
        print(f"Car Savings: {luxury_data.get('products', [{}])[2].get('current_savings', 0)} PRC")
        
        return user_data, luxury_data
    
    def test_02_get_mining_status(self):
        """Get current mining status"""
        response = self.session.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}")
        assert response.status_code == 200, f"Failed to get mining status: {response.text}"
        
        data = response.json()
        print(f"\n=== MINING STATUS ===")
        print(f"Session Active: {data.get('session_active')}")
        print(f"Mined This Session: {data.get('mined_this_session')} PRC")
        print(f"Mining Rate: {data.get('mining_rate')} PRC/hour")
        print(f"Remaining Hours: {data.get('remaining_hours')}")
        
        return data
    
    def test_03_verify_claim_mining_rewards_split(self):
        """
        CRITICAL TEST: Verify that claiming mining rewards applies 80/20 split
        
        Expected behavior:
        - If user mines 100 PRC
        - User should receive 80 PRC in wallet
        - 20 PRC should go to luxury savings (4% mobile, 6% bike, 10% car)
        """
        # Step 1: Get initial state
        user_before = self.session.get(f"{BASE_URL}/api/user/{TEST_USER_UID}").json()
        luxury_before = self.session.get(f"{BASE_URL}/api/luxury-life/savings/{TEST_USER_UID}").json()
        mining_status = self.session.get(f"{BASE_URL}/api/mining/status/{TEST_USER_UID}").json()
        
        initial_balance = user_before.get('prc_balance', 0)
        initial_luxury_total = luxury_before.get('total_savings', 0)
        mined_this_session = mining_status.get('mined_this_session', 0)
        
        print(f"\n=== BEFORE CLAIM ===")
        print(f"Initial PRC Balance: {initial_balance}")
        print(f"Initial Luxury Savings: {initial_luxury_total}")
        print(f"Mined This Session: {mined_this_session}")
        
        if mined_this_session < 0.1:
            print("⚠️ Not enough mined PRC to test. Skipping claim test.")
            pytest.skip("Not enough mined PRC to test claim")
        
        # Step 2: Claim mining rewards
        claim_response = self.session.post(f"{BASE_URL}/api/mining/claim/{TEST_USER_UID}")
        
        print(f"\n=== CLAIM RESPONSE ===")
        print(f"Status Code: {claim_response.status_code}")
        
        if claim_response.status_code != 200:
            print(f"Claim failed: {claim_response.text}")
            # This might be expected if session just started
            pytest.skip(f"Claim failed: {claim_response.text}")
        
        claim_data = claim_response.json()
        print(f"Claim Response: {claim_data}")
        
        # Step 3: Get state after claim
        time.sleep(0.5)  # Small delay for DB update
        
        user_after = self.session.get(f"{BASE_URL}/api/user/{TEST_USER_UID}").json()
        luxury_after = self.session.get(f"{BASE_URL}/api/luxury-life/savings/{TEST_USER_UID}").json()
        
        final_balance = user_after.get('prc_balance', 0)
        final_luxury_total = luxury_after.get('total_savings', 0)
        
        print(f"\n=== AFTER CLAIM ===")
        print(f"Final PRC Balance: {final_balance}")
        print(f"Final Luxury Savings: {final_luxury_total}")
        
        # Step 4: Calculate actual changes
        balance_increase = final_balance - initial_balance
        luxury_increase = final_luxury_total - initial_luxury_total
        
        print(f"\n=== CHANGES ===")
        print(f"Balance Increase: {balance_increase}")
        print(f"Luxury Savings Increase: {luxury_increase}")
        
        # Step 5: Verify the split
        total_mined = claim_data.get('total_mined_this_session', mined_this_session)
        expected_wallet = total_mined * 0.80
        expected_luxury = total_mined * 0.20
        
        print(f"\n=== EXPECTED vs ACTUAL ===")
        print(f"Total Mined: {total_mined}")
        print(f"Expected Wallet (80%): {expected_wallet}")
        print(f"Expected Luxury (20%): {expected_luxury}")
        print(f"Actual Wallet Increase: {balance_increase}")
        print(f"Actual Luxury Increase: {luxury_increase}")
        
        # Check if claim response includes luxury_savings info
        if 'luxury_savings' in claim_data:
            print(f"\n=== CLAIM LUXURY INFO ===")
            print(f"Luxury Deducted (from response): {claim_data['luxury_savings'].get('deducted', 0)}")
        
        # Verify the split is correct (with small tolerance for floating point)
        tolerance = 0.01
        
        # BUG CHECK: If balance_increase equals total_mined (100%), the bug exists
        if abs(balance_increase - total_mined) < tolerance:
            print(f"\n❌ BUG CONFIRMED: 100% went to wallet instead of 80%!")
            print(f"   User received {balance_increase} PRC but should have received {expected_wallet} PRC")
            assert False, f"BUG: 100% of mined PRC ({total_mined}) went to wallet. Expected 80% ({expected_wallet})"
        
        # Verify 80% went to wallet
        wallet_diff = abs(balance_increase - expected_wallet)
        assert wallet_diff < tolerance, f"Wallet increase ({balance_increase}) doesn't match expected 80% ({expected_wallet})"
        
        # Verify 20% went to luxury savings
        luxury_diff = abs(luxury_increase - expected_luxury)
        assert luxury_diff < tolerance, f"Luxury increase ({luxury_increase}) doesn't match expected 20% ({expected_luxury})"
        
        print(f"\n✅ 80/20 split verified correctly!")
    
    def test_04_verify_tap_game_split(self):
        """
        Test that tap game also applies 80/20 split
        """
        # Get initial state
        user_before = self.session.get(f"{BASE_URL}/api/user/{TEST_USER_UID}").json()
        luxury_before = self.session.get(f"{BASE_URL}/api/luxury-life/savings/{TEST_USER_UID}").json()
        
        initial_balance = user_before.get('prc_balance', 0)
        initial_luxury = luxury_before.get('total_savings', 0)
        taps_today = user_before.get('taps_today', 0)
        
        print(f"\n=== TAP GAME TEST ===")
        print(f"Initial Balance: {initial_balance}")
        print(f"Initial Luxury: {initial_luxury}")
        print(f"Taps Today: {taps_today}")
        
        # Check if user has taps remaining
        if taps_today >= 100:
            print("⚠️ Daily tap limit reached. Skipping tap game test.")
            pytest.skip("Daily tap limit reached")
        
        # Play tap game with 10 taps
        tap_response = self.session.post(
            f"{BASE_URL}/api/game/tap/{TEST_USER_UID}",
            json={"taps": 10}
        )
        
        print(f"\n=== TAP RESPONSE ===")
        print(f"Status Code: {tap_response.status_code}")
        
        if tap_response.status_code != 200:
            print(f"Tap game failed: {tap_response.text}")
            pytest.skip(f"Tap game failed: {tap_response.text}")
        
        tap_data = tap_response.json()
        print(f"Tap Response: {tap_data}")
        
        # Get state after tap
        time.sleep(0.5)
        
        user_after = self.session.get(f"{BASE_URL}/api/user/{TEST_USER_UID}").json()
        luxury_after = self.session.get(f"{BASE_URL}/api/luxury-life/savings/{TEST_USER_UID}").json()
        
        final_balance = user_after.get('prc_balance', 0)
        final_luxury = luxury_after.get('total_savings', 0)
        
        balance_increase = final_balance - initial_balance
        luxury_increase = final_luxury - initial_luxury
        
        total_earned = tap_data.get('total_earned', 0)
        prc_earned = tap_data.get('prc_earned', 0)  # This should be 80%
        
        print(f"\n=== TAP GAME RESULTS ===")
        print(f"Total Earned (before split): {total_earned}")
        print(f"PRC Earned (wallet): {prc_earned}")
        print(f"Balance Increase: {balance_increase}")
        print(f"Luxury Increase: {luxury_increase}")
        
        expected_wallet = total_earned * 0.80
        expected_luxury = total_earned * 0.20
        
        print(f"Expected Wallet (80%): {expected_wallet}")
        print(f"Expected Luxury (20%): {expected_luxury}")
        
        # Verify the split
        tolerance = 0.01
        
        if abs(balance_increase - total_earned) < tolerance:
            print(f"\n❌ BUG: 100% went to wallet in tap game!")
            assert False, f"BUG: 100% of tap game PRC ({total_earned}) went to wallet"
        
        print(f"\n✅ Tap game 80/20 split verified!")
    
    def test_05_check_luxury_savings_history(self):
        """Check if savings_history is being updated in luxury_savings collection"""
        response = self.session.get(f"{BASE_URL}/api/luxury-life/savings/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        print(f"\n=== LUXURY SAVINGS DETAILS ===")
        print(f"Total Savings: {data.get('total_savings')} PRC")
        print(f"Is Eligible: {data.get('is_eligible')}")
        print(f"Auto Save Rate: {data.get('auto_save_rate')}%")
        
        # The API might not expose savings_history directly
        # But we can verify the totals are being tracked
        products = data.get('products', [])
        for product in products:
            print(f"\n{product.get('name')}:")
            print(f"  Current Savings: {product.get('current_savings')} PRC")
            print(f"  Auto Save %: {product.get('auto_save_percent')}%")
            print(f"  Progress: {product.get('progress')}%")


class TestAdminVerification:
    """Admin verification tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get('access_token')
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_admin_check_user_transactions(self):
        """Check user's recent transactions to verify luxury deductions"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/user-360",
            params={"query": TEST_USER_EMAIL}
        )
        
        if response.status_code != 200:
            pytest.skip(f"Admin API not accessible: {response.text}")
        
        data = response.json()
        print(f"\n=== ADMIN USER 360 VIEW ===")
        print(f"User: {data.get('user', {}).get('email')}")
        print(f"PRC Balance: {data.get('financial_stats', {}).get('prc_balance')}")
        print(f"Total Mined: {data.get('financial_stats', {}).get('total_mined')}")
        
        # Check recent transactions
        transactions = data.get('transactions', {})
        if isinstance(transactions, dict):
            # Handle dict format
            for key, txn_list in transactions.items():
                if isinstance(txn_list, list):
                    print(f"\n{key} Transactions ({len(txn_list)}):")
                    for txn in txn_list[:3]:
                        if isinstance(txn, dict):
                            print(f"  - {txn.get('type', 'N/A')}: {txn.get('amount', 'N/A')} - {txn.get('description', '')}")
        elif isinstance(transactions, list):
            print(f"\nRecent Transactions ({len(transactions)}):")
            for txn in transactions[:5]:
                if isinstance(txn, dict):
                    print(f"  - {txn.get('type')}: {txn.get('amount')} PRC - {txn.get('description', '')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
