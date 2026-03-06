# PARAS Reward Portal - Product Requirements Document

## Original Problem Statement
Build a comprehensive BBPS (Bill Payment) and DMT (Domestic Money Transfer) system for Paras Reward Portal where users can redeem their PRC (Paras Reward Coins) for real-world services like bill payments and bank transfers.

## Core Features

### 1. BBPS Module (COMPLETED ✅)
- Universal bill payment engine for Electricity, DTH, FASTag, Loan/EMI, Gas, LPG
- Robust Eko API error handling with user-friendly Marathi messages
- A-Z sorted operator lists
- **March 6, 2026**: Removed all hardcoded values (SOURCE_IP, credentials)

### 2. DMT Module (REWRITTEN ✅ - March 6, 2026)
Complete E2E Flow:
1. **Customer Search** → Check if mobile registered with Eko
2. **Customer Registration** → Register new sender with name
3. **OTP Verification** → Complete registration via OTP
4. **Add Recipient** → Add bank account (IFSC, Account Number)
5. **Money Transfer** → Execute IMPS transfer
6. **Transaction Status** → Check pending/completed status

**Key Fixes (March 6, 2026)**:
- ✅ NO HARDCODED VALUES - All config from environment variables
- ✅ Dynamic IP detection from request headers
- ✅ Config validation on startup

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

**Single Leg Global Pool:**
- All users sorted by `created_at` (joining date/time)
- User's downline = active users who joined AFTER them
- Active = Subscription active + KYC verified + Mining session active

**Files Created/Modified:**
- `/app/backend/routes/mining_economy.py` - NEW mining calculation module
- `/app/backend/server.py` - Updated `calculate_mining_rate()` and `get_base_rate()`
- `/app/backend/routes/referral.py` - Changed from 5 levels to 3 levels

### 4. Admin Panel (COMPLETED ✅)
- DMT Dashboard with enable/disable toggle
- Global & per-user limits configuration
- Transaction viewer with filters
- Error Monitor with Eko codes
- Popup Message feature

### 5. Razorpay Integration (FIXED ✅)
- Webhook configured correctly
- Manual sync tools for payment activation
- Subscription renewal adds remaining days

### 6. Auto Burn (EXISTING ✅)
- Daily 1% burn from wallet balance
- Already implemented

### 7. Redeem Limit (EXISTING ✅)
- Base: 39,950 PRC/month
- +20% per direct referral

## Environment Variables Required

### EKO Configuration (backend/.env)
```
EKO_DEVELOPER_KEY=7c179a397b4710e71b2248d1f5892d19
EKO_INITIATOR_ID=9936606966
EKO_AUTHENTICATOR_KEY=7a2529f5-3587-4add-a2df-3d0606d62460
EKO_USER_CODE=20810200
EKO_BASE_URL=https://api.eko.in:25002/ekoicici
```

## Test Credentials
- **User**: 9421331342 / PIN: 942133
- **Admin**: admin@paras.com

## Files Modified (March 6, 2026)
1. `/app/backend/routes/eko_dmt_service.py` - Complete rewrite, no hardcoding
2. `/app/backend/routes/bbps_services.py` - Removed hardcoded SOURCE_IP
3. `/app/backend/routes/mining_economy.py` - NEW: Mining economy calculation
4. `/app/backend/server.py` - Updated mining rate calculation
5. `/app/backend/routes/referral.py` - 5 levels → 3 levels
6. `/app/backend/.env` - Fixed EKO_AUTHENTICATOR_KEY

## Known Issues
1. **Preview Environment**: DMT/BBPS returns 403 (IP not whitelisted with Eko)
2. **AEML, JPDCL Billers**: May require additional parameters

## Pending Tasks
- P0: Test DMT flow after production deployment
- P1: Investigate failing billers (AEML, JPDCL)
- P2: Remove legacy eko_payments.py router
- P2: Admin "Failed to delete plan" bug
- P3: Email/Mobile OTP verification
