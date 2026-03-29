# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

## COMPLETED: Production 520 Error Fix (P0 CRITICAL) - 29 March 2026
- Removed `.env` from git tracking, made `load_dotenv` conditional
- Production backend responds 200 OK with MongoDB Atlas connected

## COMPLETED: Single Leg Tree + Mining Testing - 29 March 2026
- **Single Leg Tree**: All users in single chain by `created_at`
- **String/datetime fix**: `get_network_size()` handles both ISO string and datetime for `mining_session_end`
- **Testing Results** (iteration 158 - ALL PASS):
  - Mining: base=500 + network=119.13 = 619.13 PRC/day (20 active users)
  - Network Size: 20 (tree_position based, capped at 912)
  - Direct Referrals: 7 (5 green active, 2 red inactive)

## COMPLETED: Growth Network UI Improvements - 29 March 2026
- Fixed API URL mismatch for direct referrals list
- Green Active / Red Inactive badges with colored dots

## COMPLETED: Subscription & Redeem Economy Rules (P0) - 29 March 2026
- **Explorer Plan**: Free (₹0)
- **Elite (Cash/INR/Razorpay/Manual)**: ₹999 + 18% GST → 100% mining speed, 1% burn rate
- **Elite (PRC)**: → 70% mining speed, 5% burn rate
- **Burn formula applied to ALL redeem services**: 
  - Subtotal = Service Charges + ₹10 Processing Fee + 20% Admin Charges
  - Burn = burn_rate% × Subtotal (1% for cash, 5% for PRC)
  - Total = Subtotal + Burn
- Updated functions: `calculate_redemption_charges`, `get_bill_payment_service_charge`, `get_gift_voucher_service_charge` in server.py
- Updated functions: `calculate_total_prc`, `calculate_charges`, added `get_user_burn_rate_bank` in bank_redeem.py
- Mining boost: server.py admin view updated to use payment-type-based multiplier
- **Testing** (iteration 159 - 14/14 PASS): All burn rate and mining speed tests passed

## Active Architecture
- `tree_position`: Integer position in single leg (1=first, N=last)
- `network_parent`: UID of user above in chain
- `referred_by`: Referral code based (unchanged, for direct referrals)
- Network size = ACTIVE users (Elite+mining) with tree_position > user's position
- Mining formula: (500 + N×prc_per_user) × boost_multiplier
- **Boost multiplier**: Cash=1.0, PRC=0.70
- **Burn rate**: Cash=1%, PRC=5% of (Amount + Processing + Admin)

## Key DB Fields (users collection)
- `subscription_plan`: explorer | elite
- `subscription_payment_type`: cash | prc
- `tree_position`: int (single leg position)
- `network_parent`: str (uid of parent in chain)
- `mining_active`: bool
- `mining_session_end`: datetime

## Upcoming
- P1: Razorpay pricing update (Rs999 + GST) - April 1, 2026
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
