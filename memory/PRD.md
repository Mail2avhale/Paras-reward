# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

## COMPLETED: Production 520 Error Fix (P0 CRITICAL) - 29 March 2026
- Removed `.env` from git tracking, made `load_dotenv` conditional
- Production backend responds 200 OK with MongoDB Atlas connected

## COMPLETED: Single Leg Tree Implementation - 29 March 2026
- All users arranged in single chain by `created_at` (joining date/time)
- `tree_position` (integer) and `network_parent` (uid of user above)
- Network size = count ACTIVE users with `tree_position > user's position`
- Direct referrals unchanged (referral_code based `referred_by`)
- Auto-migration on server startup for users without `tree_position`

## COMPLETED: Growth Network UI Improvements - 29 March 2026
- **Fixed**: API URL mismatch - frontend was calling wrong endpoint for direct referrals list
- **Network Progress Bar**: Shows "X active users" and "Cap: Y" below the bar
- **Direct Referrals**: Green (Active) / Red (Inactive) status with colored dots and badges
  - Active = Elite subscription + mining_active
  - Inactive = Explorer or not mining

## Active Architecture
- `tree_position`: Integer position in single leg (1=first joiner, N=last)
- `network_parent`: UID of user immediately above in single leg chain
- `referred_by`: UID of referrer (referral_code based) - SEPARATE from tree
- Network size for mining = tree_position based query
- Direct referrals for network cap = referred_by based count

## Pricing Formula
Rs999 + 18% GST = Rs1178.82 base + Rs10 Processing + 20% Admin + Burning (PRC: 5%, Cash: 1%)

## TWO-PLAN SYSTEM
| Feature | Cash Subscription | PRC Subscription |
|---------|------------------|------------------|
| Mining Speed | 100% | 70% |
| Burn Rate | 1% | 5% |

## Upcoming
- P1: Razorpay pricing update (Rs999 + GST) - April 1, 2026
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
