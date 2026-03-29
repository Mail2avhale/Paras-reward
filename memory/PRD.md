# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

## COMPLETED: Production 520 Error Fix (P0 CRITICAL) - 29 March 2026
- **Root Cause**: `.env` files committed to git with `MONGO_URL="mongodb://localhost:27017"` were overwriting Emergent's System Keys
- **Fix**: Removed `.env` from git tracking, added to `.gitignore`, made `load_dotenv` conditional
- **Result**: Production backend responds 200 OK with MongoDB Atlas connected

## COMPLETED: Single Leg Tree Implementation - 29 March 2026
- **What**: All users arranged in single chain by joining date/time (`created_at`)
- **Fields**: `tree_position` (integer, 1=oldest) and `network_parent` (uid of user above)
- **Network Size**: Count ACTIVE users (Elite + mining_active) with `tree_position > user's position`
- **Direct Referrals**: Unchanged - still uses `referred_by` field (referral_code based)
- **Mining Formula**: Unchanged - 500 base + team_bonus, uses single leg tree for network
- **Network Cap**: Unchanged - min(4000, 800 + 16 × direct_referrals)
- **Migration**: Auto-runs on server startup for users without `tree_position`
- **New Users**: Auto-assigned to end of chain on registration
- **Files changed**: mining.py, growth_economy.py, auth.py, server.py
- **Testing**: 9/9 backend tests passed

## Active Architecture
- `tree_position`: Integer position in single leg (1=first joiner, N=last)
- `network_parent`: UID of user immediately above in single leg chain
- `referred_by`: UID of referrer (referral_code based) - SEPARATE from tree
- Network size for mining = tree_position based query (efficient single MongoDB query)
- Direct referrals for network cap = referred_by based count (unchanged)

## Pricing Formula
Rs999 + 18% GST = Rs1178.82 base
+ Rs10 Processing Fee
+ 20% Admin on (base_prc + processing_prc)
+ Burning (PRC: 5%, Cash: 1%) on total_before_burn
= Final PRC Amount

## TWO-PLAN SYSTEM
| Feature | Cash Subscription | PRC Subscription |
|---------|------------------|------------------|
| Mining Speed | 100% | 70% |
| Burn Rate | 1% | 5% |

## Upcoming
- P1: Razorpay pricing update (Rs999 + GST) - April 1, 2026
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
