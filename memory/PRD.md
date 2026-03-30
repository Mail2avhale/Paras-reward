# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

## COMPLETED: Production 520 Error Fix (P0) - 29 March 2026
## COMPLETED: Single Leg Tree + Mining - 29 March 2026
## COMPLETED: Growth Network UI - 29 March 2026

## COMPLETED: Economy Rules (P0) - 29 March 2026
- Explorer=Free, Elite(Cash)=₹999+GST/100% speed/1% burn, Elite(PRC)=70% speed/5% burn
- Burn on ALL redeem+subscription: Subtotal = Amount + ₹10 + 20% Admin; Burn = rate% × Subtotal

## COMPLETED: Razorpay + PRC Pricing - 29 March 2026
- Razorpay: ₹1178.82. PRC: 16,477 PRC (with 5% burn). Dynamic rate=11

## COMPLETED: Burn Display + Dynamic PRC Rate - 29 March 2026
- All redeem pages show burn breakdown. All hardcoded PRC rate=10 removed

## COMPLETED: Login Bug Fix - 29 March 2026
- **Bug**: Wrong login ID still showed green checkmark and proceeded to PIN entry
- **Fix**: Catch block in LoginNew.js now sets `idStatus='invalid'` for ALL errors (not just 404)
- Testing: iteration 163 (11/11 PASS)

## COMPLETED: RewardLoader Spinners - 29 March 2026
- Replaced plain CSS spinners with animated PRC coin (`RewardLoader`) on 4 user pages:
  - ProfileAdvanced, BankRedeemPage, ReferralsEnhanced, SubscriptionPlans
- PRC coin flip animation + sparkle particles + contextual loading message
- Testing: iteration 163 (11/11 PASS)

## Active Architecture
- Mining: (500 + N×prc_per_user) × boost (Cash=1.0, PRC=0.70)
- Burn: Cash=1%, PRC=5% on ALL services (redeem + PRC subscription)
- Razorpay: ₹999 + 18% GST = ₹1178.82
- PRC sub: 16,477 PRC (with 5% burn, dynamic rate=11)
- PRC rate: Dynamic from `/api/prc-economy/current-rate`

## Upcoming
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
