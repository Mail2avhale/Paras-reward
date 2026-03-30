# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 30 March 2026

## COMPLETED: Production 520 Error Fix (P0) - 29 March 2026
## COMPLETED: Single Leg Tree + Mining - 29 March 2026
## COMPLETED: Growth Network UI - 29 March 2026
## COMPLETED: Economy Rules (P0) - 29 March 2026
## COMPLETED: Razorpay + PRC Pricing (with 5% Burn) - 29 March 2026
## COMPLETED: Burn Display + Dynamic PRC Rate - 29 March 2026
## COMPLETED: Login Bug Fix - 29 March 2026

## COMPLETED: RewardLoader Spinners (All User Pages) - 29 March 2026
- Replaced ALL full-page spinners with animated PRC coin loader
- Pages: ProfileAdvanced, BankRedeemPage, ReferralsEnhanced, SubscriptionPlans, Setup, NetworkTreeAdvanced
- Component: `/app/frontend/src/components/RewardLoader.js` (data-testid="reward-loader")
- Testing: iteration 163 + 164 PASS

## COMPLETED: Registration Error Handling - 29 March 2026
- **Backend**: Mobile number now REQUIRED (was optional). Full name now REQUIRED.
- **Frontend**: Field-level errors with clear English messages
- Testing: iteration 164 (13/13 PASS)

## COMPLETED: 3-Tier Network Cap Formula (P0) - 29 March 2026
- **Tier 1 (Base)**: 800 cap (everyone starts here)
- **Tier 2 (Direct Referrals)**: +16 per direct referral → max 4000
- **Tier 3 (L1 Indirect Referrals)**: +5 per L1 indirect → max 6000
- **Formula**: `min(6000, 800 + 16×D + 5×L1)`
- L1 indirect = users referred by user's direct referrals
- Updated files: `mining.py`, `growth_economy.py`, `test_growth_economy.py`
- All 3 endpoints return tier breakdown: `l1_indirect_referrals`, `cap_tier1_base`, `cap_tier2_bonus`, `cap_tier3_bonus`
- Testing: iteration 165 (28/28 PASS) + unit tests (41/41 PASS)

## Active Architecture
- Mining: (500 + N×prc_per_user) × boost (Cash=1.0, PRC=0.70)
- Network Cap: min(6000, 800 + 16×D + 5×L1)
- Burn: Cash=1%, PRC=5% on ALL services (redeem + PRC subscription)
- Razorpay: ₹999 + 18% GST = ₹1178.82
- PRC sub: 16,477 PRC (with 5% burn, dynamic rate=11)
- PRC rate: Dynamic `/api/prc-economy/current-rate`

## COMPLETED: PRC Collect Balance UI Bug Fix (P0) - 30 March 2026
- **Bug**: "Collect Rewards" button showed success toast but Current Balance didn't update visually
- **Root Cause**: Race condition - `onBalanceUpdate` triggered parent re-render → `fetchUserData(true)` re-ran via useEffect → overwrote the optimistic balance
- **Fix**: Added `collectInProgressRef` to protect optimistic update for 3 seconds, preventing re-fetch from overwriting
- **File**: `/app/frontend/src/pages/Mining.js` (lines 191, 293-310, 487-563)
- Testing: iteration 167 (100% PASS - balance updates, persists, auto-session restart)

## COMPLETED: Smart AI Chatbot (SupportChatbot) - 30 March 2026
- Uses real user data (balance, cap, referrals) for contextual answers via GPT-4o-mini
- Does not expose internal formulas to users

## COMPLETED: Auto-Burning System (3.33% daily) - 30 March 2026
- Deducts 3.33% daily from PRC balance for users with expired subscriptions

## COMPLETED: Admin Redeem Limits Overview - 30 March 2026
- Aggregated + user-wise redeem limit tracking on Admin Dashboard

## COMPLETED: Chatbot Earning Projections (P1) - 30 March 2026
- Users can ask "If I get X more referrals, what will be my daily earning?" in any language
- Pre-computes projections for +5/+10/+25/+50/+100 referral scenarios using mining formulas
- Injected as [PROJECTION_DATA] alongside [USER_DATA] into GPT-4o-mini system prompt
- Responds in English, Marathi, Hindi, Hinglish with exact numbers (no vague answers)
- File: `/app/backend/routes/support_chatbot.py` (compute_projections + updated system prompt)
- Testing: iteration 168 (100% PASS - all projections verified, multilingual, PRC Collect regression OK)

## Upcoming
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
