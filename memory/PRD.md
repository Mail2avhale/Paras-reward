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
- **Frontend**: Field-level errors with clear English messages:
  - "This mobile number is already registered. Please login instead."
  - "Mobile number is required" / "Please enter a valid 10-digit mobile number."
  - "This email is already registered. Please login instead."
  - "PIN cannot be all same digits (e.g., 111111)."
  - "Full name must be at least 2 characters."
  - General error banner for registration-closed (403)
- Testing: iteration 164 (13/13 PASS)

## Active Architecture
- Mining: (500 + N×prc_per_user) × boost (Cash=1.0, PRC=0.70)
- Burn: Cash=1%, PRC=5% on ALL services (redeem + PRC subscription)
- Razorpay: ₹999 + 18% GST = ₹1178.82
- PRC sub: 16,477 PRC (with 5% burn, dynamic rate=11)
- PRC rate: Dynamic `/api/prc-economy/current-rate`

## Upcoming
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
