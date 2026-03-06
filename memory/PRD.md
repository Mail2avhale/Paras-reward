# PARAS Reward Portal - Product Requirements Document

## Original Problem Statement
Build a comprehensive BBPS (Bill Payment) and DMT (Domestic Money Transfer) system for Paras Reward Portal where users can redeem their PRC (Paras Reward Coins) for real-world services.

## Core Features

### 1. BBPS Module (COMPLETED ✅)
- Universal bill payment engine for Electricity, DTH, FASTag, Loan/EMI, Gas, LPG
- Robust Eko API error handling

### 2. DMT Module (REWRITTEN ✅ - March 6, 2026)
- Complete E2E flow with NO hardcoded values
- Customer Search → Registration → OTP → Add Recipient → Transfer

### 3. Mining Economy System (UPDATED ✅ - March 6, 2026)

**NEW FORMULA (Per Hour):**
```
BaseRate = 20.83 + (SingleLegUsers × 0.5) PRC/hour
FinalRate = BaseRate × BoostMultiplier
```

**Constants:**
| Parameter | Value |
|-----------|-------|
| Daily Base Bonus | 500 PRC (20.83 PRC/hr) |
| Single Leg Bonus | 0.5 PRC/hr per user |
| Max Single Leg Users | 500 |
| L1 Team Boost | +10% per active user |
| L2 Team Boost | +5% per active user |
| L3 Team Boost | +3% per active user |

### 4. Gift Subscription Feature (NEW ✅ - March 6, 2026)

**Feature:** Parent can gift 24hr Elite subscription to L1 referrals

| Parameter | Value |
|-----------|-------|
| Cost | 600 PRC |
| Duration | 24 hours |
| Plan Given | Elite |
| Eligible | Only unsubscribed L1 referrals |
| Multiple Gifts | Allowed |
| Notification | Yes (to child) |

**API Endpoints:**
- `GET /api/gift/eligible-referrals/{parent_uid}` - Get eligible L1 referrals
- `POST /api/gift/send` - Send gift subscription
- `GET /api/gift/history/{user_uid}` - Gift history

### 5. Subscription Plans (UPDATED ✅ - March 6, 2026)

**Startup Plan (₹299) - DISCONTINUED**
- Removed from all frontend pages
- Existing users still work (backward compatibility)

**Available Plans:**
| Plan | Price | Features |
|------|-------|----------|
| Explorer | Free | Basic mining, PRC expires in 2 days |
| Elite | ₹799/month | 3x rewards, no PRC expiry, redeems enabled |

### 6. Referral Levels (UPDATED ✅ - March 6, 2026)

**Changed from 5 levels to 3 levels:**
- L1: +10% per active user
- L2: +5% per active user
- L3: +3% per active user
- ~~L4: Removed~~
- ~~L5: Removed~~

## Files Modified (March 6, 2026)

### Backend:
1. `/app/backend/routes/mining_economy.py` - NEW: Mining calculation
2. `/app/backend/routes/gift_subscription.py` - NEW: Gift feature
3. `/app/backend/server.py` - Updated mining rate, startup discontinued
4. `/app/backend/routes/referral.py` - 5→3 levels

### Frontend:
1. `Mining.js` - Removed L4, L5
2. `ReferralsEnhanced.js` - Added Gift button & modal, removed L4/L5
3. `ReferralEarningsHistory.js` - 3 levels only
4. `NetworkTreeAdvanced.js` - 3 levels only
5. `AINetworkReferral.js` - 3 levels only
6. `SubscriptionPlans.js` - Removed Startup plan
7. `FAQ.js` - Updated to 3-level bonus info

## Test Credentials
- **User**: 9421331342 / PIN: 942133
- **Admin**: admin@paras.com

## Pending Tasks
- P0: Test DMT flow after production deployment
- P1: Investigate failing BBPS billers (AEML, JPDCL)
- P2: Remove legacy eko_payments.py router
- P3: Email/Mobile OTP verification
