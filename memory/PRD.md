# Paras Reward App - Product Requirements Document

## Original Problem Statement
Paras Reward is a mining economy app with subscription-based rewards. Users can mine PRC (Paras Reward Coins) based on their subscription level and network (referrals).

## Core Features
- **Mining System**: Users mine PRC based on subscription tier + single-leg bonus + team boost
- **Subscription Plans**: Multiple tiers (Explorer, Basic, Plus, Premium, Enterprise)
- **Referral/Invite System**: Multi-level referral bonuses
- **KYC Verification**: Aadhaar + PAN verification for withdrawals
- **BBPS Integration**: Bill payments using Eko API
- **DMT Integration**: Domestic Money Transfer using Eko API
- **Recurring Deposits**: PRC savings with interest

## Tech Stack
- **Frontend**: React.js with Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Razorpay for subscriptions, Eko for BBPS/DMT

---

## What's Been Implemented

### December 2025 - Major Refactoring Session

#### Features Removed (Complete)
1. **Marketplace** - All product, cart, order, checkout routes removed (~2,130 lines)
2. **Luxury Life** - Auto-save for luxury products feature removed (~700 lines)
3. **TAP Game** - Tap-to-earn game feature removed (~130 lines)

#### Code Refactoring (Complete)
1. **KYC Routes Extracted** - `routes/kyc.py` created (~350 lines)
2. **Unused Route Files Deleted** - social.py, support.py, admin_ledger.py
3. **BBPS/DMT Separation** - Clean separation of payment services

#### BBPS/DMT Separation (NEW)
**BBPS (Bill Payment):**
- `routes/bbps_services.py` (980 lines) - Clean BBPS implementation

**DMT (Money Transfer):**
- `routes/eko_dmt_service.py` (1,350 lines) - DMT v1
- `routes/eko_dmt_v3.py` (863 lines) - DMT v3 with OTP
- `routes/eko_dmt_icici.py` (858 lines) - ICICI specific
- `routes/admin_dmt_routes.py` (701 lines) - Admin management

**Common Utilities:**
- `routes/eko_common.py` (220 lines) - NEW: Shared auth/request functions
- `routes/eko_error_handler.py` (612 lines) - Error handling

**Archived:**
- `routes/_archive_eko_payments_legacy.py` (4,386 lines) - DISABLED

#### Stats
- **server.py**: 43,143 → 39,105 lines (~4,040 lines removed)
- **Route files**: 46 active files

---

## Prioritized Backlog

### P0 - Critical
- [ ] Razorpay auto-subscription fails on production (fix in preview, needs deployment)

### P1 - High Priority
- [ ] BBPS billers (AEML, JPDCL) fail to fetch bills
- [ ] Continue server.py refactoring (Mining, Subscription routes)

### P2 - Medium Priority
- [ ] "Payment Status Check on Login" safeguard
- [ ] DMT APIs blocked in preview (IP whitelisting)

### P3 - Low Priority
- [ ] Eko DMT v3 with Aadhaar/eKYC
- [ ] Email/Mobile OTP verification on signup

---

## Testing Status
- **Last Test**: iteration_108.json - All 36 tests passed
- **Backend Tests**: 16/16 passed (BBPS/DMT separation verified)
- **Frontend Tests**: 20/20 passed

## API Endpoints (Key)
- `/api/health` - Health check
- `/api/bbps/*` - BBPS bill payments (NEW clean routes)
- `/api/eko/dmt/*` - DMT money transfer (clean routes)
- `/api/kyc/*` - KYC operations (extracted)
- `/api/mining/*` - Mining operations
- `/api/leaderboard` - Leaderboard

## Credentials (Test)
- Admin (Production): admin@paras.com / PIN: 153759
- Test User (Preview): 9421331342 / 942133
