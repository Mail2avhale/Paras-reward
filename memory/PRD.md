# PARAS REWARD - Production Application

## Product Overview
A production-grade reward platform serving 3000+ users with subscription management, referral system, mining features, and marketplace.

## Recent Changes (February 2026)

### KYC Orphaned Records Fix & Recovery Tool ✅ (Feb 19, 2026)
**Problem:** Critical bug - 74 users had `kyc_status: "pending"` but no actual documents in `kyc_documents` collection. This caused:
- Admin couldn't see these KYC requests
- Users stuck in "pending" state forever
- No way to re-submit documents

**Solution:**
1. **Backend - New Endpoints:**
   - `GET /api/kyc/check-status/{uid}` - Detailed status check for users (detects orphaned status)
   - `POST /api/kyc/reset-for-resubmit/{uid}` - Allows users to reset and re-submit
   - `GET /api/admin/kyc/orphaned-requests` - Admin tool to find orphaned records
   - `POST /api/admin/kyc/fix-orphaned` - Fix selected orphaned records
   - `POST /api/admin/kyc/fix-all-orphaned` - Auto-fix all orphaned records

2. **Frontend - User KYC Page (`KYCVerification.js`):**
   - Added detection for orphaned status
   - Shows orange "Re-submit" badge for affected users
   - Shows reset button with Marathi message
   - After reset, user can re-submit documents

3. **Frontend - Admin KYC Page (`AdminKYC.js`):**
   - Added "Find Orphaned" button (orange)
   - Modal shows list of affected users
   - "Fix All" button to auto-reset all orphaned records
   - Individual "Fix" button per user

**Test Results:**
- API Test: ✅ Found 74 orphaned records
- API Test: ✅ Fixed all 74 records in one click
- API Test: ✅ After fix, 0 orphaned records remaining
- User notification sent to all fixed users (Marathi)

**Files Modified:**
- `backend/server.py` - Added 5 new endpoints for KYC recovery
- `frontend/src/pages/KYCVerification.js` - User-facing status check & re-submit
- `frontend/src/pages/AdminKYC.js` - Admin tool for finding/fixing orphaned records

### Admin Service Toggles Feature ✅ (Feb 18, 2026)
**Feature:** Admin can enable/disable services temporarily
**Services Available:**
1. Mobile Recharge - on/off
2. DTH/Dish Recharge - on/off  
3. Electricity Bill - on/off
4. Credit Card Payment - on/off
5. Pay EMI - on/off
6. Gift Voucher - on/off
7. Shopping - on/off
8. Redeem to Bank - on/off

**Error Message (English):** "Service temporarily down. Please try again later."

**Files Modified:**
- `backend/server.py` - Service toggle endpoints & service check in bill-payment
- `backend/routes/bank_redeem.py` - Service check for bank redeem
- `frontend/src/pages/AdminServiceToggles.js` - Admin UI page
- `frontend/src/pages/AdminSettingsHub.js` - Added "Service On/Off" link
- `frontend/src/App.js` - Route for /admin/service-toggles

**Test Results:** 100% passed (10/10 backend, all frontend verified)

### Mobile Recharge Dropdowns ✅ (Feb 17, 2026)
**Added:**
1. Recharge Type dropdown (Prepaid/Postpaid)
2. Mobile Operator dropdown (Jio, Airtel, Vi, BSNL, MTNL)
3. Telecom Circle dropdown (23 circles - Delhi NCR, Mumbai, etc.)
**Files Modified:**
- `frontend/src/pages/BillPayments.js` - User form with dropdowns
- `frontend/src/pages/AdminBillPayments.js` - Admin view with better labels

### Weekly EMI/Bank Redeem Rule ✅ (Feb 17, 2026)
**STRICT Rule:** Only ONE of Pay EMI OR Bank Redeem per week
- If Pay EMI done → Bank Redeem blocked
- If Bank Redeem done → Pay EMI blocked
- Resets every Monday 00:00 UTC

### KYC Status Bug Fix ✅ (Feb 17, 2026)
**Problem:** `admin_users.py` मध्ये KYC approve केल्यावर `kyc_status: "approved"` set होत होते, पण withdrawal मध्ये `kyc_status: "verified"` check होत होते. याचा अर्थ admin ने user page वरून KYC approve केले तरी withdrawal काम करत नव्हते.
**Solution:** 
1. `/app/backend/routes/admin_users.py` मध्ये `"approved"` → `"verified"` बदलले
2. AI KYC verify मध्ये पण `"verified"` status set केले (`server.py`)
3. Stats count मध्ये backwards compatibility साठी दोन्ही status count केले
**Test Results:** API test passed - KYC approve केल्यावर आता `kyc_status: "verified"` होतो

### User 360 KYC Approval Feature ✅ (Feb 17, 2026)
**Problem:** Admin ला User 360 page वरून direct KYC approve/reject करायचे होते
**Solution:**
1. Backend: `server.py` मध्ये `approve_kyc` आणि `reject_kyc` actions जोडले user-360/action endpoint मध्ये
2. Frontend: `AdminUser360.js` मध्ये Quick Actions section मध्ये "Approve KYC" आणि "Reject KYC" buttons जोडले
3. Conditional display: KYC verified असेल तर buttons दिसत नाहीत
**Test Results:** API test passed - approve आणि reject दोन्ही काम करतात

### Performance Optimization ✅ (Feb 16, 2026)
**Problem:** Production server extreme slowness
**Solution:**
1. Added caching to `/api/stats`, `/api/leaderboard`, `/api/subscription/plans`, `/api/products`, `/api/settings/public`
2. Added MongoDB indexes for `total_mined`, `is_active`, `subscription_plan`, `membership_type`
**Status:** User verified - Performance improved

### Free Startup Subscription Module - REMOVED ✅ (Feb 15, 2026)
**Problem:** User requested complete removal of "Free Startup Subscription" reward feature
**Solution:** 
1. Frontend: Removed reward progress tracker UI from ReferralsEnhanced.js
2. Backend: Disabled `/api/referrals/{uid}/reward-progress` endpoint (returns 404)
3. Backend: Disabled `check_and_grant_referral_reward` function
**Test Results:** 100% tests passed (11/11 backend tests, frontend verified)

### Invite/Referral Page Bug Fix ✅ (Feb 15, 2026)
**Problem:** Users reported level-wise referral data not displaying
**Root Cause:** Feature working correctly - users need to tap/click on level row to expand and see users
**Status:** VERIFIED WORKING - Level 1 shows expandable user list with name, subscription badge, active status
**Test Results:** All referral features verified working

### Pagination & Sorting Added ✅
- **Admin Subscription Page**: Pagination (15 items/page), FIFO (oldest first) sorting
- **Admin Bank Withdrawals Page**: Pagination (15 items/page), FIFO (oldest first) sorting
- Both pages reset to page 1 when filter/tab changes

## Previous Changes (December 2025)

### Admin Subscription Management - REBUILT ✅
**Problem:** "Database temporarily unavailable" errors during subscription approval
**Solution:** Complete rebuild of `admin_vip.py` with simplified architecture

**Changes Made:**
1. Removed complex circuit breaker pattern
2. Removed retry logic with exponential backoff
3. Replaced parallel `asyncio.gather()` operations with sequential database calls
4. Simplified error handling
5. Frontend `AdminSubscriptionManagement.js` also cleaned up and simplified

**Test Results:** 100% tests passed (15/15 backend, all frontend UI verified)

### Referrals/Invite Page - VERIFIED ✅
**Status:** Working correctly
- Backend API `/api/referrals/{user_id}/levels` returns user data correctly
- Frontend displays 5 levels with user details (expandable)
- Note: Admin users are redirected from /referrals by design

## Architecture

### Backend (`/app/backend/`)
- FastAPI with async operations
- MongoDB database
- In-memory caching with TTL
- JWT authentication

### Frontend (`/app/frontend/`)
- React 18
- Tailwind CSS
- Shadcn/UI components
- Sonner for toast notifications

## Key Files

### Subscription Management
- Backend: `/app/backend/routes/admin_vip.py` (REBUILT)
- Frontend: `/app/frontend/src/pages/AdminSubscriptionManagement.js` (SIMPLIFIED)

### Referrals
- Backend: `/app/backend/server.py` (referral endpoints around line 26200)
- Frontend: `/app/frontend/src/pages/ReferralsEnhanced.js` (Free Startup module removed)

## API Endpoints

### Admin Service Toggles (NEW)
- `GET /api/admin/service-toggles` - Get status of all 8 services
- `POST /api/admin/service-toggles/{service_key}` - Toggle a service on/off

### Admin KYC Management
- `GET /api/admin/kyc/pending` - Get pending KYC users (paginated)
- `POST /api/admin/kyc/{uid}/approve` - Approve user KYC (sets kyc_status: "verified")
- `POST /api/admin/kyc/{uid}/reject` - Reject user KYC
- `GET /api/admin/kyc/orphaned-requests` - Find users with orphaned KYC status (NEW)
- `POST /api/admin/kyc/fix-orphaned` - Fix selected orphaned records (NEW)
- `POST /api/admin/kyc/fix-all-orphaned` - Auto-fix all orphaned records (NEW)

### User KYC Endpoints (NEW)
- `GET /api/kyc/check-status/{uid}` - Check KYC status & detect orphaned state
- `POST /api/kyc/reset-for-resubmit/{uid}` - Reset KYC for re-submission

### Admin User 360 KYC Actions
- `POST /api/admin/user-360/action` with `action: "approve_kyc"` - Approve KYC from User 360 page
- `POST /api/admin/user-360/action` with `action: "reject_kyc"` - Reject KYC from User 360 page (with reason)

### Admin Subscription
- `GET /api/admin/subscription-stats` - Get plan counts
- `GET /api/admin/vip-payments?status=pending|approved|rejected` - List payments
- `POST /api/admin/vip-payment/{id}/approve` - Approve payment
- `POST /api/admin/vip-payment/{id}/reject` - Reject payment
- `PUT /api/admin/vip-payments/{id}` - Update payment
- `DELETE /api/admin/vip-payments/{id}` - Delete payment

### Referrals
- `GET /api/referrals/{user_id}/levels` - Get referral levels with users
- `GET /api/referrals/{uid}/reward-progress` - DISABLED (returns 404)

## Test Credentials
- Admin: `admin@test.com` / PIN: `123456`
- Test User: `mail2avhale@gmail.com` / PIN: `123456`

## Upcoming Tasks
- P1: UPI Payment Gateway Integration (Razorpay)
- P1: "DIRECTOR 365" Subscription Plan
- P1: Advanced PRC Burning Concepts
- P2: Force PIN Change Feature
- P3: KYC Images migrate MongoDB → S3 (reduce database bloat)

## Known Behaviors
- Admin users are redirected from `/referrals` to `/admin` (by design)
- Subscription page refresh recommended after approval operations
- Referral levels need to be clicked/tapped to expand and show users
