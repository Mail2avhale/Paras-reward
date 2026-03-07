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

## User Personas
1. **End Users**: Mine PRC, pay bills, transfer money, invite friends
2. **Admins**: Manage users, verify KYC, handle withdrawals, view analytics
3. **Managers**: Regional management, order handling, reports

## Tech Stack
- **Frontend**: React.js with Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Razorpay for subscriptions, Eko for BBPS/DMT

---

## What's Been Implemented

### December 2025 - Major Refactoring

#### Features Removed (Complete)
1. **Marketplace** - All product, cart, order, checkout routes removed
   - Backend: ~2,130 lines deleted
   - Frontend: Orders.js, AdminOrders.js deleted
   - Navigation updated to redirect /orders to /dashboard

2. **Luxury Life** - Auto-save for luxury products feature removed
   - Backend: ~700 lines deleted
   - Frontend: Migration UI removed from ParasRecurringDeposit.js

3. **TAP Game** - Tap-to-earn game feature removed
   - Backend: ~130 lines deleted
   - Frontend: Already removed in previous session

#### Code Refactoring (Complete)
1. **KYC Routes Extracted** - `routes/kyc.py` created (~350 lines)
   - `/api/kyc/submit/{uid}` - Submit KYC documents
   - `/api/kyc/status/{uid}` - Get KYC status
   - `/api/kyc/list` - List all KYC submissions (admin)
   - `/api/kyc/details/{uid}` - Get full KYC details (admin)
   - `/api/kyc/verify/{uid}` - Verify/Approve KYC (admin)
   - `/api/kyc/reject/{uid}` - Reject KYC (admin)
   - `/api/kyc/stats` - Get KYC statistics (admin)

2. **Unused Route Files Deleted**
   - routes/social.py - Routes exist in server.py
   - routes/support.py - Routes exist in server.py
   - routes/admin_ledger.py - Never used, routes in server.py

#### Stats
- **server.py**: 43,143 → 39,103 lines (~4,040 lines removed)
- **Route files**: 48 → 45 files

---

## Prioritized Backlog

### P0 - Critical
- [ ] Razorpay auto-subscription fails on production server
  - Fix applied in preview (faster sync), needs production deployment

### P1 - High Priority
- [ ] BBPS billers (AEML, JPDCL) fail to fetch bills
- [ ] Continue server.py refactoring:
  - Mining routes (~1,300 lines)
  - User Profile routes (~550 lines)
  - Subscription routes (~2,400 lines)
  - Admin Ledger routes (~4,600 lines)

### P2 - Medium Priority
- [ ] "Payment Status Check on Login" safeguard
- [ ] Remove legacy eko_payments.py router conflict
- [ ] DMT APIs blocked in preview (IP whitelisting)

### P3 - Low Priority
- [ ] Eko DMT v3 with Aadhaar/eKYC
- [ ] PRC Vault migration script for production
- [ ] Email/Mobile OTP verification on signup
- [ ] KYC/Receipt images migration (base64 to file storage)

---

## Known Issues
1. **Razorpay Production** - Auto-activation fails sometimes (sync delay)
2. **DMT Preview** - IP not whitelisted by Eko
3. **BBPS** - Some billers have non-standard parameters

---

## Testing Status
- **Last Test**: iteration_100.json - All tests passed (39/39)
- **Backend Tests**: 19/19 passed
- **Frontend Tests**: 20/20 passed

---

## API Endpoints (Key)
- `/api/health` - Health check
- `/api/kyc/*` - KYC operations (extracted to routes/kyc.py)
- `/api/mining/*` - Mining operations
- `/api/leaderboard` - Leaderboard
- `/api/support/*` - Support tickets
- `/api/admin/*` - Admin operations

## Credentials (Test)
- Admin (Production): admin@paras.com / PIN: 153759
- Test User (Preview): 9421331342 / 942133
