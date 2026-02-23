# PARAS REWARD - Production Application

## Product Overview
A production-grade reward platform serving 3000+ users with subscription management, referral system, mining features, and marketplace.


## Recent Changes (February 2026)

### 🤖 Smart Diagnostic AI Chatbot ✅ (Feb 23, 2026 - Latest)
**User Request:** Enhance existing chatbot to automatically diagnose user issues by analyzing their real-time account data.

**What Changed:**
User asks a question → Chatbot fetches user's complete data from DB → Analyzes all conditions → Gives EXACT problem + Solution

**Features Implemented:**

**1. Subscription Diagnostics:**
- Current plan, status, expiry date
- Plan benefits (bill payment, vouchers, shopping access)
- Renewal reminders

**2. Redeem Status (All Types):**
- Bank Redeem: Pending, Approved, Rejected with reasons
- PRC Savings Vault: All request statuses
- Weekly limit tracking
- Last rejection reasons shown

**3. Bill Services:**
- Available services (Mobile, DTH, Electricity, Water, Gas)
- Pending/Completed/Failed bills history
- Eligibility based on plan

**4. Gift Vouchers:**
- Available brands (Amazon, Flipkart, Myntra, Swiggy, Zomato)
- Pending/Redeemed vouchers
- Latest voucher details

**5. Wallet & Transactions:**
- PRC Balance, Cashback Balance
- Recent 10 transactions
- Monthly earnings breakdown by type

**6. Contact & Support:**
- Email: support@parasreward.com
- WhatsApp: +91-9999999999
- Working hours, response time

**7. Additional Features:**
- Orders & Shopping status
- Referral network with earnings
- Mining/Session status
- Security status (login attempts, lockout)
- KYC status with rejection reasons

**Diagnostic Keywords Added:**
- Marathi: काम नाही, समस्या, पेंडिंग, रिजेक्ट, सबस्क्रिप्शन, व्हाउचर, बिल, etc.
- Hindi: kyun, kaise, pending, reject, subscription, voucher, bill, etc.
- English: fail, pending, rejected, subscription, voucher, bill, contact, etc.

**Test Results:** ✅ All 5 test scenarios passed
1. Subscription status → Plan details with expiry
2. Gift voucher query → Available brands + steps
3. Bill payment query → Services + eligibility
4. Contact support → Email, WhatsApp, hours
5. Redeem status → Pending/Approved/Rejected counts

---

### 🔐 Security Question PIN Reset Feature ✅ (Feb 23, 2026)
**User Request:** Add security question as additional verification step during PIN reset for enhanced security.

**Features Implemented:**
1. **Security Question Setup:**
   - Users can set/update security question from Profile page
   - 5 predefined questions available (English)
   - Answers stored as SHA256 hash (case-insensitive)

2. **Enhanced PIN Reset Flow:**
   - Step 1: Email verification
   - Step 2: Mobile verification  
   - Step 3: Aadhaar/PAN verification
   - Step 4: Security Question verification (if set)
   - Step 5: Set new PIN
   - Flow automatically skips Step 4 if user hasn't set security question

3. **Backend APIs:**
   - `GET /api/auth/security-questions` - Get list of available questions
   - `POST /api/auth/security-question/set` - Set security question for user
   - `GET /api/auth/security-question/check/{user_id}` - Check if user has question set
   - `POST /api/auth/forgot-pin/verify-security` - Verify answer during PIN reset

4. **Bug Fix:** Fixed `set-new-pin` API to update `pin_hash` and `password_hash` fields (not just `pin` and `password`)

**Files Modified:**
- `backend/server.py` - Added Security Question APIs, fixed PIN reset update fields
- `frontend/src/pages/ForgotPin.js` - Added Step 4 for Security Question, dynamic step indicators
- `frontend/src/pages/ProfileAdvanced.js` - SecurityQuestionCard component for setting question

**Test Results:** ✅ Complete E2E flow tested with curl
- New user with security question: PIN reset with 5 steps - PASSED
- Old user without security question: PIN reset with 4 steps - PASSED
- Login with new PIN after reset - PASSED

---

## Recent Changes (February 2026)

### 🗑️ PRC Rain Drop Feature Removed ✅ (Feb 23, 2026)
**User Request:** Complete removal of PRC Rain Drop feature from entire codebase for Google Play Store compliance.

**Changes Made:**
1. **Frontend Removed:**
   - App.js - Removed route `/admin/prc-rain`
   - AdminLayout.js - Removed PRC Rain from settings menu
   - RewardsHome.js - Removed PRC Rain feature card
   - Mining.js - Removed "Rain Drop Game" text from tooltip
   - NetworkFeed.js - Removed `prc_rain` from activity categories
   - Orders.js - Removed rain_game earnings display
   - AIChatbotEnhanced.js - Removed PRC Rain quick question

2. **Backend Deprecated:**
   - All PRC Rain API endpoints marked as deprecated and return disabled status
   - Chatbot FAQ updated to remove PRC Rain information

**Files Modified:**
- `frontend/src/App.js`
- `frontend/src/components/layouts/AdminLayout.js`
- `frontend/src/pages/RewardsHome.js`
- `frontend/src/pages/Mining.js`
- `frontend/src/pages/NetworkFeed.js`
- `frontend/src/pages/Orders.js`
- `frontend/src/components/AIChatbotEnhanced.js`
- `backend/server.py`

---

### 🔧 PWA Install Banner Fix ✅ (Feb 23, 2026)
**Problem:** "Install App" banner showing even when PWA is already installed.

**Root Cause:** Insufficient checks for installed state - only checked `display-mode: standalone`.

**Solution - Enhanced Installation Detection:**
1. Added multiple display mode checks: `standalone`, `fullscreen`, `minimal-ui`, `window-controls-overlay`
2. Added iOS Safari `navigator.standalone` check
3. Added Android TWA `document.referrer` check
4. Added localStorage flag persistence
5. Added URL parameter detection (`?source=pwa`)
6. Added **real-time MediaQuery listener** to detect installation while user is on site
7. Proper cleanup of event listeners

**Files Modified:**
- `frontend/src/components/PWAInstallPrompt.js`

---

### 🐛 Admin Performance Report Fix ✅ (Feb 23, 2026)
**Problem:** Admin Performance Report page stuck on loading due to missing `FileText` icon import.

**Solution:** Added `FileText` to lucide-react imports in AdminPerformanceReport.js.

**Files Modified:**
- `frontend/src/pages/AdminPerformanceReport.js`

---

### 🏷️ "Recurring Deposit" → "PRC Savings Vault" Rename + Disclaimer ✅ (Feb 22, 2026 - Session 2)
**User Request:**
1. "Recurring Deposit" नाव Google Play policy साठी योग्य नाही - बदलणे
2. User ला clarity देणे की हे PRC points आहे, real money नाही

**Changes Made:**
1. **Renamed throughout app:** "Recurring Deposit" → "PRC Savings Vault"
2. **Added Disclaimer Banner** on savings page:
   > "⚠️ This is a virtual PRC points savings feature. No real money deposits are accepted. PRC points have no cash value and cannot be exchanged for real currency."
3. **Updated all notifications, toasts, and admin panel labels**

**Files Modified:**
- `frontend/src/pages/ParasRecurringDeposit.js` - Main savings page with disclaimer
- `frontend/src/pages/Orders.js` - Order history
- `frontend/src/pages/Mining.js` - Collection toast
- `frontend/src/pages/AdminBankWithdrawals.js` - Admin panel
- `frontend/src/pages/AdminRecurringDeposits.js` - Admin management
- `frontend/src/components/layouts/AdminLayout.js` - Sidebar menu + fixed pending counts
- `backend/routes/recurring_deposit.py` - API tags and notifications

---

### 📊 Admin Performance Report & Menu Counts Fix ✅ (Feb 22, 2026 - Session 2)
**User Request:**
1. Menu मधील pending request numbers चुकीचे दाखवत होते - fix करणे
2. Admin Performance Report - कोणत्या admin ने किती requests approve/reject केल्या हे दाखवणे

**Features Implemented:**
1. **Admin Performance Report Page** (`/admin/performance-report`):
   - Admin-wise approval/rejection counts
   - Category-wise breakdown (Bank Redeem, RD Redeem, Subscription, KYC, etc.)
   - Date range filters (All Time, Last 7 Days, Last 30 Days, Custom)
   - Approval rate percentage for each admin
   - Last activity timestamp
2. **Menu Counts Fixed:**
   - KYC API path corrected (`/kyc/stats` instead of `/admin/kyc/stats`)
   - Bank Withdrawals and RD Redeem counts now included in total
   - All pending counts fetch from correct API endpoints

**Files Created/Modified:**
- NEW: `frontend/src/pages/AdminPerformanceReport.js` - Admin performance dashboard
- NEW: `backend/server.py` - Added `/admin/performance-report` API
- MODIFIED: `frontend/src/components/layouts/AdminLayout.js` - Fixed API paths, added menu item
- MODIFIED: `frontend/src/App.js` - Added route for performance report

---

### 🔒 Admin Tracking & Weekly Limit Bug Fix ✅ (Feb 22, 2026 - Session 1)
**User Request:** 
1. Track which admin approved/rejected each request for accountability
2. Fix weekly redeem limit bug that was incorrectly blocking all requests
3. Add date range filters and sorting to admin panel

**Features Implemented:**
1. **Admin Tracking:** All approve/reject actions now save:
   - `processed_by` - Admin name
   - `processed_by_uid` - Admin UID  
   - `approved_by_name` / `rejected_by_name` - Clear field names
   - `processed_at` - Timestamp
2. **Weekly Limit Bug Fixed:** Changed from Python string comparison to MongoDB `$gte` query
3. **Date Filters:** Both Bank Redeem and RD Redeem admin APIs support `date_from`, `date_to`, `sort_order` params
4. **Frontend Display:** Admin panel shows "Approved By: {name}" or "Rejected By: {name}"

**Files Modified:**
- `backend/routes/bank_redeem.py` - approve_withdrawal(), reject_withdrawal() with admin tracking
- `backend/routes/recurring_deposit.py` - admin_approve_rd_redeem(), admin_reject_rd_redeem() with admin tracking, fixed weekly limit query
- `frontend/src/pages/AdminBankWithdrawals.js` - Displays admin names, passes date filter params

**Test Results:** ✅ 100% tests passed (21 backend tests)

---

### 🏦 Recurring Deposit (RD) System - NEW FEATURE ✅ (Feb 21, 2026)
**User Request:** Implement a bank-like RD system with interest to replace the old "Luxury Life" feature.

**Latest Updates:**
- ✅ All text converted to English (removed Marathi)
- ✅ Luxury Life banner removed from Dashboard
- ✅ Interest Calculator widget added to RD page
- ✅ Auto-migration: All existing Luxury savings converted to RD
- ✅ Bulk migration API for admin

**Features Implemented:**
1. **Interest Rates:** 6 Months: 7.5%, 1 Year: 8.5%, 2 Years: 9%, 3 Years: 9.25% p.a.
2. **Auto-Deduction:** 20% of mining earnings automatically deposited to active RD
3. **Premature Withdrawal:** 3% penalty for early withdrawal
4. **Luxury → RD Migration:** Automatic conversion when user visits RD page
5. **Interest Calculator:** Real-time calculator widget on RD page
6. **Bulk Admin Migration:** One-click convert all users' Luxury savings

**Files Created:**
- `/app/backend/routes/recurring_deposit.py` - All RD backend logic and APIs
- `/app/frontend/src/pages/ParasRecurringDeposit.js` - User RD page
- `/app/frontend/src/pages/AdminRecurringDeposits.js` - Admin RD management

**Files Modified:**
- `backend/server.py` - Added RD router, updated `process_luxury_savings()` to use RD if active
- `frontend/src/App.js` - Added routes for `/recurring-deposit`, `/rd`, `/admin/recurring-deposits`
- `frontend/src/pages/DashboardModern.js` - Added new RD banner above Luxury Life banner
- `frontend/src/components/layouts/AdminLayout.js` - Added RD to admin sidebar

**API Endpoints (NEW):**
- `GET /api/rd/interest-rates` - Get all interest rate tiers
- `POST /api/rd/create` - Create new RD account
- `GET /api/rd/list/{user_id}` - List all RDs for user with summary
- `GET /api/rd/details/{rd_id}` - Get detailed RD info
- `POST /api/rd/deposit/{rd_id}` - Add deposit to RD
- `POST /api/rd/withdraw/{rd_id}` - Withdraw (with 3% penalty if premature)
- `POST /api/rd/migrate-from-luxury/{user_id}` - Migrate Luxury Life → RD
- `POST /api/rd/toggle-auto-deduction/{rd_id}` - Enable/disable auto-deduction
- `GET /api/rd/admin/all` - Admin: View all RDs with stats
- `POST /api/rd/admin/process-daily-interest` - Admin: Daily cron job
- `POST /api/rd/admin/check-matured` - Admin: Check matured RDs

**Database Schema (NEW Collection: `recurring_deposits`):**
```javascript
{
  "rd_id": "RD-2026-XXXXXX",
  "user_id": "uid",
  "monthly_deposit": 1000,
  "tenure_months": 12,  // 6, 12, 24, or 36
  "interest_rate": 8.5,
  "total_deposited": 5000,
  "interest_earned": 212,
  "expected_maturity_amount": 13020,
  "status": "active",  // active, matured, withdrawn, closed
  "migrated_from_luxury": false,
  "auto_deduction_enabled": true
}
```

**Test Results:** ✅ 100% tests passed (23 backend, all frontend verified)

---

### P0 CRITICAL BUG FIX: PRC Collect Not Working ✅ (Feb 20, 2026)
**Problem:** Users could not collect their earned PRC. The "Collect Rewards" button showed success message but balance never updated.

**Root Cause:**
- The `claim_mining` and `collect_mining_rewards` functions in `server.py` used `membership_type` variable without defining it
- This was a side-effect of the previous membership refactoring where `membership_type` was deprecated in favor of `subscription_plan`
- Backend threw `NameError: name 'membership_type' is not defined`

**Solution:**
- Added `membership_type` variable derivation from `is_vip` helper function in both functions:
  ```python
  membership_type = "vip" if is_vip else "free"
  ```

**Files Modified:**
- `backend/server.py` - Lines 6069-6071 (claim_mining) and 6640-6644 (collect_mining_rewards)

**Test Results:**
- ✅ `/api/mining/claim/{uid}` - Working
- ✅ `/api/mining/collect/{uid}` - Working
- Both endpoints now return proper `success: true` with updated balance

---

### Marketplace Feature Removed ✅ (Feb 20, 2026)
**User Request:** Complete removal of marketplace from both admin and user sides.

**Files Deleted:**
- `/app/frontend/src/pages/MarketplaceNew.js`
- `/app/frontend/src/pages/AdminMarketplace.js`
- `/app/frontend/src/components/skeletons/ProductCardSkeleton.js`

**Files Updated (marketplace references removed):**
- `App.js` - Removed imports, routes redirect to dashboard
- `AdminLayout.js` - Removed from sidebar menu
- `Sidebar.js` - Removed from user menu
- `Navbar.js` - Removed from navigation
- `Footer.js` - Removed from footer links
- `AdminDashboard.js` - Removed quick action button
- `AIChatbotEnhanced.js` - Updated suggestions
- `InteractiveWalkthrough.js` - Removed marketplace step
- `PRCExpiryTimer.js` - Changed CTA to gift vouchers
- `AIContextualHelp.js` - Removed path mapping
- `skeletons/index.js` - Removed ProductCardSkeleton export

**Backend:** Routes kept for backward compatibility but no longer accessible via UI.

---

### P0 Critical Bug Fix: PRC Balance Reset Bug ✅ (Feb 20, 2026)
**Problem:** Paid users (Elite, Startup, Growth) had their PRC balance reset to zero upon login.

**Root Cause Analysis:**
- Users had `subscription_plan` set to paid plan (elite/startup/growth) but `membership_type` was incorrectly set to "free"
- Login code only checked `membership_type == "free"` to determine if PRC should be reset
- This caused paid users to lose their entire PRC balance on every login

**Solution - Simplified Membership System:**

1. **NEW: Helper Functions (Single Source of Truth)** - Lines 519-543:
   ```python
   PAID_PLANS = ["startup", "growth", "elite", "vip", "pro"]
   
   def is_paid_subscriber(user): # Returns True for paid users
   def is_free_user(user):       # Returns True for free/explorer users
   def get_user_plan(user):      # Returns subscription_plan
   ```
   - `subscription_plan` is now THE ONLY source of truth
   - `membership_type` kept for backward compatibility but NOT used in logic

2. **Simplified Login Logic (line 4598):**
   - Now uses: `user_is_free = is_free_user(user)`
   - Auto-syncs `membership_type` for backward compatibility

3. **Updated 28+ Critical Code Paths:**
   - Mining rate calculation
   - Withdrawal limits
   - Marketplace access
   - VIP service access
   - Order creation
   - PRC expiry checks

4. **PRC Restoration APIs:**
   - `GET /api/admin/prc-affected-users` - Find affected users
   - `POST /api/admin/restore-prc/{uid}` - Restore single user
   - `POST /api/admin/bulk-restore-prc` - Bulk restore all

**Test Results:**
- ✅ Backend: All APIs verified working
- ✅ Health check, diagnose, and user functions operational

**Files Modified:**
- `backend/server.py` - Helper functions + 28 code path updates

---

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
- Test User: `mail2avhale@gmail.com` / PIN: `152759`
- Test User with RD: `elite-test-user-123` (RD: RD-2026-C5201C)

## Upcoming Tasks
- P0: Verify PRC collection bug is resolved on production (critical user verification pending)
- P1: Guide admin on running daily cron jobs (`/api/rd/admin/process-daily-interest`, `/api/rd/admin/check-matured`)
- P1: Utility Payments API Integration (Mobile recharge, DTH, Bill payment)
- P1: UPI Payment Gateway Integration (Razorpay)
- P1: "DIRECTOR 365" Subscription Plan
- P1: Advanced PRC Burning Concepts
- P2: Email/Mobile OTP verification on signup
- P2: Force PIN Change Feature
- P2: AAB Generation for Play Store (pwabuilder.com)
- P3: KYC Images migrate MongoDB → S3 (reduce database bloat)
- P3: Refactor server.py into proper route/service/model structure

## Known Behaviors
- Admin users are redirected from `/referrals` to `/admin` (by design)
- Subscription page refresh recommended after approval operations
- Referral levels need to be clicked/tapped to expand and show users
