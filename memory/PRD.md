# PARAS REWARD - Bill Payment Platform

## Original Problem Statement
Full-stack bill payment platform using Eko BBPS APIs for electricity, mobile, DTH, and other utility bill payments.

## Architecture
- **Frontend:** React.js with Tailwind CSS, Shadcn UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Payment Gateway:** Razorpay (subscriptions), Eko (BBPS)

## What's Been Implemented

### Session: 2026-03-04 - Eko Electricity Bill Payment Fix

**Critical Fix Applied:**
- **Issue:** All POST requests to Eko API were failing with 403 Forbidden
- **Root Cause:** Wrong `EKO_AUTHENTICATOR_KEY` was configured
  - Old (Wrong): `dmt-bbps-migration`
  - New (Correct): `7a2529f5-3587-4add-a2df-3d0606d62460`
- **Fix:** Updated `/app/backend/.env` with correct AUTH_KEY

**Verification Results:**
1. ✅ GET /api/eko/bbps/operators/electricity - 89 operators retrieved
2. ✅ GET /api/eko/bbps/operator-params/{id} - Dynamic parameters working
3. ✅ POST /api/eko/bbps/fetch-bill - Bill fetch working (Adani Mumbai tested)
4. ✅ POST /api/eko/bbps/pay-bill - Payment API working (TID generated)

**Additional Fixes:**
- Fixed frontend compilation error in `/app/frontend/src/pages/Admin/ErrorMonitor.js`
  - Wrong import path: `../components/ui/card` → `../../components/ui/card`
- Added manual subscription activation endpoint for Razorpay issues

### Key Eko API Configuration
```
EKO_BASE_URL=https://api.eko.in:25002/ekoicici
EKO_DEVELOPER_KEY=7c179a397b4710e71b2248d1f5892d19
EKO_AUTHENTICATOR_KEY=7a2529f5-3587-4add-a2df-3d0606d62460
EKO_INITIATOR_ID=9936606966
EKO_USER_CODE=20810200
```

### Tested Operators
- **BSES Rajdhani (22):** billFetchResponse=0, 9-digit CA Number
- **MSEDCL (62):** 12-digit Consumer No + 4-digit BU (currently down)
- **Adani Electricity Mumbai (242):** 9-digit Consumer Number

## Pending/Backlog Tasks

### P0 - Critical
- [ ] User subscription issue: `order_SOtM3kCj7Hl58c` - User should use manual activation endpoint

### P1 - High Priority
- [ ] FASTag, DTH services require "HG Pay enrollment" from Eko (business requirement, not code)
- [ ] Admin Panel "Failed to delete plan" error

### P2 - Medium Priority
- [ ] Eko DMT Service integration (blocked on API specs)
- [ ] PRC Vault to PRC Balance migration script

### P3 - Low Priority
- [ ] Email/Mobile OTP verification on signup
- [ ] KYC/Receipt images file storage migration
- [ ] Code refactoring: RedeemPageV2.js and server.py split

## API Endpoints Reference

### Electricity Bill Payment Flow
```
1. GET /api/eko/bbps/operators/{category}    - List operators
2. GET /api/eko/bbps/operator-params/{id}    - Get required parameters
3. POST /api/eko/bbps/fetch-bill             - Fetch bill details
4. POST /api/eko/bbps/pay-bill               - Execute payment
```

### Admin Endpoints
```
POST /api/razorpay/admin/manual-activate-by-email  - Manual subscription activation
GET /admin/error-monitor                            - Error monitoring dashboard
```

## Test Credentials
- **User:** mail2avhale@gmail.com / PIN: 153759
- **Admin:** admin@paras.com / 123456

## Notes
- MSEDCL operator is currently down (Eko side issue)
- Fetch bill may timeout (up to 120s) - normal Eko latency
- For operators with billFetchResponse=0, fetch is not required
