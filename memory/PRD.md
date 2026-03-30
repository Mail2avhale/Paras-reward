# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

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

## Upcoming
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
