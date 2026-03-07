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

#### BBPS/DMT Separation
**BBPS (Bill Payment):**
- `routes/bbps_services.py` (980 lines) - Clean BBPS implementation

**DMT (Money Transfer):**
- `routes/eko_dmt_service.py` (1,350 lines) - DMT v1
- `routes/eko_dmt_v3.py` (863 lines) - DMT v3 with OTP
- `routes/eko_dmt_icici.py` (858 lines) - ICICI specific
- `routes/admin_dmt_routes.py` (701 lines) - Admin management

**Common Utilities:**
- `routes/eko_common.py` (220 lines) - Shared auth/request functions
- `routes/eko_error_handler.py` (612 lines) - Error handling

**Archived:**
- `routes/_archive_eko_payments_legacy.py` (4,386 lines) - DISABLED

#### Subscription E2E Flow (Verified)
**Flow:**
1. User selects plan → `/api/razorpay/create-order`
2. Razorpay checkout opens
3. User completes payment
4. Frontend calls `/api/razorpay/verify-payment`
5. Backend: DOUBLE VERIFICATION (signature + Razorpay API)
6. Subscription activated + remaining days added
7. Records in: transactions, vip_payments, razorpay_orders

**Security:**
- CODE_VERSION: "2.0-SECURE"
- DOUBLE_VERIFICATION_ENABLED
- Amount verification (±₹1 tolerance)
- Duplicate payment prevention

#### Stats
- **server.py**: 43,143 → 39,105 lines (~4,040 lines removed)
- **Route files**: 46 active files

---

## Testing Status

### Iteration 108 - BBPS/DMT Separation
- Backend: 16/16 passed ✅
- Frontend: 20/20 passed ✅

### Iteration 109 - Subscription E2E
- Backend: 34/34 passed (1 skipped) ✅
- Frontend: 16/16 passed ✅

**Test Files Created:**
- `/app/backend/tests/test_bbps_dmt_separation.py`
- `/app/backend/tests/test_razorpay_subscription_e2e.py`
- `/app/tests/e2e/razorpay-subscription-e2e.spec.ts`

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

## API Endpoints (Key)

### Razorpay/Subscription
- `GET /api/razorpay/config` - Get Razorpay public key
- `POST /api/razorpay/create-order` - Create payment order
- `POST /api/razorpay/verify-payment` - Verify and activate subscription
- `POST /api/razorpay/webhook` - Handle Razorpay webhooks
- `GET /api/razorpay/payment-history/{uid}` - User payment history

### Other
- `/api/health` - Health check
- `/api/bbps/*` - BBPS bill payments
- `/api/eko/dmt/*` - DMT money transfer
- `/api/kyc/*` - KYC operations
- `/api/mining/*` - Mining operations

## Credentials (Test)
- Admin (Production): admin@paras.com / PIN: 153759
- Test User (Preview): Database specific
