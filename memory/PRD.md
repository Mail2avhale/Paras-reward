# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

## COMPLETED: Production 520 Error Fix (P0 CRITICAL) - 29 March 2026
- Removed `.env` from git tracking, made `load_dotenv` conditional
- Production backend responds 200 OK with MongoDB Atlas connected

## COMPLETED: Single Leg Tree + Mining Testing - 29 March 2026
- **Single Leg Tree**: All users in single chain by `created_at`
- **String/datetime fix**: `get_network_size()` handles both ISO string and datetime for `mining_session_end`
- **Testing Results** (iteration 158 - ALL PASS)

## COMPLETED: Growth Network UI Improvements - 29 March 2026
- Fixed API URL mismatch for direct referrals list
- Green Active / Red Inactive badges with colored dots

## COMPLETED: Subscription & Redeem Economy Rules (P0) - 29 March 2026
- **Explorer Plan**: Free (₹0)
- **Elite (Cash/INR)**: ₹999 + 18% GST → 100% mining speed, 1% burn rate
- **Elite (PRC)**: → 70% mining speed, 5% burn rate
- **Burn formula (ALL redeem services)**: Subtotal = Service + ₹10 Processing + 20% Admin; Burn = burn_rate% × Subtotal; Total = Subtotal + Burn
- **Testing** (iteration 159 - 14/14 PASS)

## COMPLETED: Razorpay Elite Pricing (P1) - Active from 29 March 2026
- **Razorpay/Cash**: ₹999 + 18% GST = ₹1178.82 ✅
- **PRC**: ₹999 + GST + ₹10 Processing + 20% Admin = 15,692 PRC ✅
- **Razorpay enabled**: Live keys configured, gateway active
- **Bug fix**: Added `subscription_payment_type: "cash"` to ALL 6 Razorpay activation flows in `razorpay_payments.py` (was missing in webhook, manual_sync, admin_fix, manual_activate flows)
- This ensures burn rate (1% for cash vs 5% for PRC) is correctly determined for all users

## Active Architecture
- `tree_position`: Integer position in single leg (1=first, N=last)
- `network_parent`: UID of user above in chain
- `referred_by`: Referral code based (unchanged, for direct referrals)
- Mining formula: (500 + N×prc_per_user) × boost_multiplier
- **Boost multiplier**: Cash=1.0, PRC=0.70
- **Burn rate**: Cash=1%, PRC=5% of (Amount + Processing + Admin)
- **Razorpay pricing**: ₹999 + 18% GST = ₹1178.82

## Key DB Fields (users collection)
- `subscription_plan`: explorer | elite
- `subscription_payment_type`: cash | prc (set by ALL activation flows)
- `tree_position`: int (single leg position)
- `network_parent`: str (uid of parent in chain)
- `mining_active`: bool
- `mining_session_end`: datetime

## Upcoming
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
