# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

## COMPLETED: Production 520 Error Fix (P0 CRITICAL) - 29 March 2026
- Removed `.env` from git tracking, made `load_dotenv` conditional

## COMPLETED: Single Leg Tree + Mining Testing - 29 March 2026
- Single Leg Tree: All users in single chain by `created_at`
- String/datetime fix for `mining_session_end`

## COMPLETED: Growth Network UI Improvements - 29 March 2026
- Fixed API URL mismatch, Active/Inactive badges

## COMPLETED: Subscription & Redeem Economy Rules (P0) - 29 March 2026
- **Explorer Plan**: Free (₹0)
- **Elite (Cash/INR)**: ₹999 + 18% GST → 100% mining speed, 1% burn rate
- **Elite (PRC)**: → 70% mining speed, 5% burn rate
- **Burn formula (ALL redeem services)**: Subtotal = Amount + ₹10 Processing + 20% Admin; Burn = burn_rate% × Subtotal; Total = Subtotal + Burn
- Testing: iteration 159 - 14/14 PASS

## COMPLETED: Razorpay Elite Pricing (P1) - Active from 29 March 2026
- ₹999 + 18% GST = ₹1178.82 (Razorpay), 15,692 PRC (PRC payment)
- Fixed `subscription_payment_type: "cash"` in all 6 Razorpay activation flows

## COMPLETED: PRC Subscription Flow Test - 29 March 2026
- Successfully tested PRC subscription: User 6c96a6cc paid 15,692 PRC for Elite
- Verified: `subscription_payment_type: "prc"` set correctly after PRC payment
- Pricing breakdown confirmed: Base ₹999 + GST ₹179.82 + ₹10 Processing + 20% Admin = 15,692 PRC

## COMPLETED: Burn Rate Breakdown on Frontend Redeem Pages - 29 March 2026
- **RedeemPageV2.js**: Shows burn line (rate%, INR, PRC) in charge breakdown
- **BankRedeemPage.js**: Shows burn line in fee breakdown section
- **GiftVoucherRedemption.js**: Shows burn line with PRC user warning
- **unified_redeem_v2.py**: Added `get_user_burn_rate_redeem()`, updated `calculate_charges()` with burn fields
- PRC users see red warning: "PRC subscribers: 5% burn rate. Cash subscribers pay only 1%."
- Testing: iteration 160 - 10/10 PASS (both APIs verified)

## Active Architecture
- `tree_position`: Integer position in single leg (1=first, N=last)
- `network_parent`: UID of user above in chain
- Mining formula: (500 + N×prc_per_user) × boost_multiplier
- **Boost multiplier**: Cash=1.0, PRC=0.70
- **Burn rate**: Cash=1%, PRC=5% of (Amount + Processing + Admin)
- **Razorpay**: ₹999 + 18% GST = ₹1178.82

## Key DB Fields (users collection)
- `subscription_plan`: explorer | elite
- `subscription_payment_type`: cash | prc
- `tree_position`, `network_parent`, `mining_active`, `mining_session_end`

## Upcoming
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
