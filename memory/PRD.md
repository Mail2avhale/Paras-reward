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
  - Network Cap: min(4000, 800 + 16×7) = 912
  - PRC per user: max(2.5, 5×(21-log₂(20))/14) = 5.956
  - Progress Bar: 20/912 = 2.2%
  - Redeem Limit: 18.38%
  - Direct Referrals: 7 (5 green active, 2 red inactive)
  - Frontend: All data displayed correctly

## COMPLETED: Growth Network UI Improvements - 29 March 2026
- Fixed API URL mismatch for direct referrals list
- Green Active / Red Inactive badges with colored dots
- Progress bar shows "X active users" and "Cap: Y"

## Active Architecture
- `tree_position`: Integer position in single leg (1=first, N=last)
- `network_parent`: UID of user above in chain
- `referred_by`: Referral code based (unchanged, for direct referrals)
- Network size = ACTIVE users (Elite+mining) with tree_position > user's position
- Mining formula: (500 + N×prc_per_user) × subscription_multiplier

## Upcoming
- P1: Razorpay pricing update (Rs999 + GST) - April 1, 2026
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
