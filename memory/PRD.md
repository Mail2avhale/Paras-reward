# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

## COMPLETED: Production 520 Error Fix (P0 CRITICAL) - 29 March 2026
- Removed `.env` from git tracking, made `load_dotenv` conditional

## COMPLETED: Single Leg Tree + Mining Testing - 29 March 2026
- Single Leg Tree by `created_at`, `tree_position`, `network_parent`

## COMPLETED: Growth Network UI Improvements - 29 March 2026
- Fixed API URL, Active/Inactive badges

## COMPLETED: Subscription & Redeem Economy Rules (P0) - 29 March 2026
- Explorer=Free, Elite(Cash)=₹999+GST/100% speed/1% burn, Elite(PRC)=70% speed/5% burn
- Burn formula: Subtotal = Amount + ₹10 + 20% Admin; Burn = rate% × Subtotal; Total = Subtotal + Burn
- Testing: iteration 159 (14/14 PASS)

## COMPLETED: Razorpay Pricing Active - 29 March 2026
- ₹999 + 18% GST = ₹1178.82, PRC: 15,692 PRC
- Fixed `subscription_payment_type: "cash"` in all 6 Razorpay activation flows

## COMPLETED: PRC Subscription Flow Tested - 29 March 2026
- Successfully tested: deducts 15,692 PRC, sets `subscription_payment_type: "prc"`

## COMPLETED: Burn Rate Breakdown Frontend - 29 March 2026
- All 3 redeem pages show burn line (rate%, INR, PRC), PRC user warning
- Testing: iteration 160 (10/10 PASS)

## COMPLETED: PRC Subscription Page Bug Fix - 29 March 2026
- **Bug**: PRC Rate=10 (should 11), Admin Charge=100% (should 20%), Total=23,576 (should 15,692)
- **Root cause**: `PRC_MULTIPLIER=2` hack + hardcoded `adminChargePercent={100}` + admin-only PRC rate endpoint returning 403
- **Fix**: 
  - Removed `PRC_MULTIPLIER`, `getPRCPrice()` now uses `/api/subscription/elite-pricing` backend response
  - PRCRateDisplay: 3-level fallback (admin -> prc-economy/current-rate -> elite-pricing)
  - Admin charge fixed to 20%, Processing fee ₹10 added
- Testing: iteration 161 (8/8 PASS — verified PRC Rate=11, Admin=20%, Total=15,692.42)

## Active Architecture
- Mining: (500 + N×prc_per_user) × boost (Cash=1.0, PRC=0.70)
- Burn: Cash=1%, PRC=5% of (Amount + Processing + Admin)
- Razorpay: ₹999 + 18% GST = ₹1178.82
- PRC subscription: 15,692.42 PRC (dynamic rate=11)

## Upcoming
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
