# PARAS REWARD - Production Application

## Product Overview
A production-grade reward platform serving 3000+ users with subscription management, referral system, mining features, and marketplace.


## Recent Changes (February 2026)

### 🔥 New Simple PRC Burn Control ✅ (Feb 24, 2026 - LATEST)

**User Request:** Delete all old complex burn pages/code and create a simple admin-controlled % burn system.

**Changes Made:**

1. **Deleted Files:**
   - `frontend/src/pages/AdminBurnDashboard.js` - Old complex burn dashboard
   - `frontend/src/components/PRCBurnAlert.js` - Old user-facing burn alert component
   
2. **New Files Created:**
   - `frontend/src/pages/AdminPRCBurnControl.js` - Simple % burn control page for Admin/Manager

3. **New Backend APIs:**
   - `GET /api/admin/prc-burn-control/settings` - Get burn settings
   - `POST /api/admin/prc-burn-control/settings` - Save burn settings
   - `GET /api/admin/prc-burn-control/stats` - Get PRC circulation stats
   - `POST /api/admin/prc-burn-control/execute` - Execute burn on all eligible users

4. **Features:**
   - Enable/Disable burn toggle
   - Burn percentage (0.1% - 50%)
   - Minimum balance threshold
   - Target users: All / Free Only / Inactive (30+ days)
   - One-click execute burn
   - Manager access allowed

5. **Files Modified:**
   - `frontend/src/App.js` - Updated route from `/admin/burn-management` to `/admin/prc-burn-control`
   - `frontend/src/components/layouts/AdminLayout.js` - Updated menu link
   - `frontend/src/pages/Mining.js` - Removed PRCBurnAlert usage

---

### 📋 Unified Payment Dashboard - EMI Integration Complete ✅ (Feb 24, 2026)

**User Request:** Add EMI Pay requests tab to unified payment dashboard.

**Changes Made:**
1. **AdminBankWithdrawals.js** now has 3 tabs:
   - Bank Redeem
   - EMI Pay (NEW)
   - Savings Vault
   
2. **EMI Tab Features:**
   - Fetches from `/api/admin/bill-payment/requests?payment_type=emi`
   - Shows EMI-specific details (Bank Name, Loan Account, IFSC)
   - Approve/Reject handlers wired correctly
   - Stats cards update dynamically per tab

3. **Action Handlers Fixed:**
   - Now uses correct handlers based on `requestType`:
     - `requestType === 'emi'` → `handleEmiApprove/handleEmiReject`
     - `requestType === 'rd'` → `handleRdApprove/handleRdReject`
     - `requestType === 'bank'` → `handleApprove/handleReject`

---

### 🧹 Old Burn Code Cleanup - COMPLETE ✅ (Feb 2026)

**All old PRC burn logic has been DEPRECATED:**

| Function | Status | Notes |
|----------|--------|-------|
| `burn_expired_prc_for_explorer_users()` | DEPRECATED | Returns skip message |
| `burn_expired_prc_for_free_users()` | DEPRECATED | Returns skip message |
| `burn_expired_subscription_prc()` | DEPRECATED | Returns skip message |
| `run_prc_burn_job()` | DEPRECATED | Returns skip message |
| `/api/admin/finance/prc-burn-execute` | DEPRECATED | Returns skip message |
| `/api/admin/burn-prc-now` | DEPRECATED | Returns skip message |

**Scheduled Jobs REMOVED:**
- `burn_free_user_prc` (hourly) - REMOVED
- `burn_expired_subscription_prc` (daily 2 AM) - REMOVED

**Reason:** Free users cannot collect PRC anymore, so burning is unnecessary.

---

### 🚫 Free Users PRC Block - No Collection, No Expiry ✅ (Feb 2026)

**Problem Solved:** Complex PRC burning/expiry logic was causing issues. Paid users accidentally getting burned.

**New Policy (Simple & Safe):**
- ✅ Free/Explorer users CAN start mining session (see animation)
- ❌ Free/Explorer users CANNOT collect PRC
- ❌ Free/Explorer users CANNOT earn PRC from Tap Game
- 🎯 Result: No PRC = No burning/expiry needed = Zero risk

**Implementation:**

1. **Mining Collect Blocked (`/api/mining/collect/{uid}`):**
   - Free users see: "तुम्ही Free user आहात. PRC collect करण्यासाठी Startup किंवा Elite plan घ्या!"
   - Session restarts automatically
   - Returns `blocked: true, upgrade_required: true`

2. **Tap Game Blocked (`/api/game/tap/{uid}`):**
   - Free users see: "तुम्ही Free user आहात. Tap Game मधून PRC मिळवण्यासाठी Startup किंवा Elite plan घ्या!"
   - Tap count updates (UI feedback) but PRC = 0
   - Returns `blocked: true, upgrade_required: true`

3. **One-Time Cleanup API (`/api/admin/clear-free-users-prc`):**
   - Clears existing free users' PRC balance
   - Logs every clear to `prc_balance_logs`
   - Already executed: 46 users, 3476.53 PRC cleared

**Benefits:**
- 🛡️ Zero risk of accidentally burning paid users
- 🧹 No complex burn jobs needed
- 💰 Strong conversion incentive to upgrade
- 🎮 Free users still get app experience

---

### 📊 Comprehensive User Logging System ✅ (Feb 2026)

**New Module:** `routes/user_logs.py`

**Purpose:** Debug issues like paid users losing PRC balance by tracking every action.

**New Collections Created:**
- `prc_balance_logs` - Every PRC credit/debit/burn with before/after balance
- `burn_operation_logs` - Complete burn job records (who was burned, who was skipped & why)
- `user_activity_logs` - User actions (login, mining, orders, etc.)
- `admin_action_logs` - Admin actions audit trail

**New API Endpoints:**
- `GET /api/admin/logs/dashboard` - Overview of all logs
- `GET /api/admin/logs/prc-balance` - PRC balance change history
- `GET /api/admin/logs/prc-balance/user/{email}` - Specific user PRC history
- `GET /api/admin/logs/burn-operations` - Burn job logs
- `GET /api/admin/logs/burn-operations/check-user/{email}` - Check if user was ever burned
- `GET /api/admin/logs/user-activity` - User activity logs
- `GET /api/admin/logs/admin-actions` - Admin action audit logs
- `POST /api/admin/logs/create-indexes` - Create indexes for performance

**Integration with Burn Functions:**
- Every burn operation now logs detailed records
- Skipped users are logged with reasons
- Burned users are logged with amounts

---

### 🔴 CRITICAL: PRC Burn Ultimate Safety Fix ✅ (Feb 2026)

**Problem:** Paid user (`nisha@gmail.com`) repeatedly had PRC balance reset to zero despite previous fixes.

**Root Cause Analysis (via troubleshoot_agent):** The burn functions lacked a FINAL safety check. Even though query filters existed, the actual execution loop didn't have an explicit verify before burning each user.

**Solution - Ultimate Safety Layer Added:**

1. **New Global Protection Function `is_protected_from_burn(db, uid)`**
   - Added in `server.py` as the ULTIMATE safety check
   - Called BEFORE any burn operation for any user
   - 6-layer protection checking:
     1. `subscription_plan` in ['startup', 'growth', 'elite', 'vip', 'pro']
     2. Active `subscription_expiry` (expiry > now)
     3. `vip_activated_at` exists (was VIP)
     4. `subscription_start` exists (was paid)
     5. `vip_expiry` exists (was VIP)
     6. `membership_type` in ['vip', 'paid', 'premium']

2. **`PAID_PLANS` Updated**
   - Added 'growth' back to protected plans (for backward compatibility with existing growth users)
   - `PAID_PLANS = ["startup", "growth", "elite", "vip", "pro"]`

3. **Safety Check Added to All Burn Functions:**
   - `burn_expired_prc_for_explorer_users()` - Line ~3267 in server.py
   - `burn_expired_prc_for_free_users()` - Line ~3407 in server.py
   - `prc-burn-execute` endpoint in admin_finance.py - `is_truly_free_user()` enhanced

4. **Enhanced `is_truly_free_user()` in admin_finance.py:**
   - Returns False (PROTECTED) if ANY paid indicator exists
   - Added email logging for better debugging
   - Protects if expiry can't be parsed (fail-safe)

**Testing Verification:**
- ✅ Burn query correctly EXCLUDES elite users
- ✅ Burn query correctly INCLUDES free users
- ✅ `is_protected_from_burn()` correctly protects elite users
- ✅ `is_protected_from_burn()` correctly protects ex-VIP users
- ✅ Free users with no paid history can be burned

---

### 🔥 PRC Burn Logic Fixed & Re-enabled ✅ (Dec 2025)

**Problem:** PRC burn jobs were disabled because they incorrectly targeted paid users, causing their balances to reset to zero.

**Root Cause:** The query `{"membership_type": {"$ne": "vip"}}` was too broad and caught paid users who had `subscription_plan` but different `membership_type`.

**Solution - Complete Rewrite with Triple Safety Checks:**

1. **`burn_expired_prc_for_explorer_users()`** - Burns 100% PRC after 2 days inactive
   - Query now explicitly checks:
     - `subscription_plan` is explorer/free/null/empty
     - `subscription_plan` NOT in startup/growth/elite/vip/pro
     - NO `subscription_expiry` (never had subscription)
     - NO `subscription_start` (never started subscription)
     - NO `vip_activated_at` (never was VIP)
   - Additional runtime safety checks before each burn

2. **`burn_expired_prc_for_free_users()`** - Burns PRC older than 48 hours (FIFO)
   - Same triple safety checks
   - Only targets users with no active subscription

3. **`burn_expired_subscription_prc()`** - Burns PRC mined AFTER expiry (5 days grace)
   - Only targets users whose subscription HAS expired
   - Only burns PRC mined AFTER the expiry date
   - PRC earned BEFORE expiry is SAFE

**New Admin APIs:**
- `GET /api/admin/burn-prc-preview` - Preview which users would be affected WITHOUT burning
- `POST /api/admin/burn-prc-now` - Execute burn job

---

### 📊 Enhanced P&L Dashboard with Auto Burn ✅ (Dec 2025)

**New Features Added to Profit & Loss Page:**

1. **Paid Users Wallet Summary Card**
   - Total PRC balance सर्व paid users चे with INR value
   - Plan-wise breakdown (Startup/Growth/Elite)
   - Total redeemed amount

2. **Month-over-Month Comparison**
   - Current vs Previous month comparison
   - Growth/Decline percentages for revenue, users, paid users

3. **Cash Flow Projection**
   - Next 3 months projected revenue
   - Based on historical growth rate

4. **Subscription Revenue Details**
   - Plan-wise revenue breakdown
   - New vs Renewal breakdown with renewal rate

5. **PRC Liability Tracker**
   - Total PRC in circulation
   - INR liability calculation
   - Daily mining vs burn rates
   - 30/90 day liability projections

6. **Auto PRC Burn System** (Moved to PRC Burn Management page)
   - Admin can enable/disable auto burn
   - Set daily burn percentage (0.1% to 10%)
   - Choose target users (free/inactive)
   - Set minimum balance threshold
   - Manual "Execute Burn Now" button

**Admin API Performance Optimizations:**
- `GET /api/admin/performance-report` - Optimized with MongoDB aggregation (was timing out)
- `GET /api/admin/prc-analytics` - Optimized with aggregation, fixed undefined variable bug
- All APIs now respond in <0.5 seconds instead of timing out

**New Backend APIs:**
- `GET /api/admin/finance/month-comparison`
- `GET /api/admin/finance/subscription-revenue-details`
- `GET /api/admin/finance/prc-liability`
- `GET /api/admin/finance/cash-flow-projection`
- `GET /api/admin/finance/prc-burn-settings`
- `POST /api/admin/finance/prc-burn-settings`
- `POST /api/admin/finance/prc-burn-execute`
- `GET /api/admin/finance/prc-burn-history`

---

### 🧹 Code Cleanup: Non-Existent Plans Removed ✅ (Dec 2025)

**User Request:** Remove all references to non-existent subscription plans (`professional`, `enterprise`, `director365`, `Starter`) from the codebase.

**Changes Made:**
1. **Backend (server.py):**
   - Fixed chatbot system prompt: Subscription Revenue plans updated to "Startup, Growth, Elite"
   - Fixed Weekly Limits: Removed "Professional" and "Enterprise" tiers, corrected to actual plans
   - Fixed Gift Voucher requirements: Changed "Starter+" to "Startup/Growth/Elite"

2. **Frontend (AISmartTip.js):**
   - Fixed Plan Comparison message: Updated from "Professional: 0.5 PRC/hr" to correct rates

**Actual Plans in System:**
- **Explorer:** Free plan (0.10 PRC/hr)
- **Startup:** ₹299/month (0.50 PRC/hr)
- **Growth:** Discontinued but exists for legacy users (1.0 PRC/hr)
- **Elite:** ₹799/month (2.0 PRC/hr)

---

## Recent Changes (February 2026)

### 🤖 Smart Diagnostic AI Chatbot ✅ (Feb 23, 2026)

**New: AI Smart Tips on Every Page** ✅
Added intelligent, context-aware tips on all major pages:
- **Dashboard:** Session inactive tip, KYC reminder, Upgrade prompt
- **Referrals:** Network growth tips, Earning structure
- **Gift Vouchers:** Brand info, Delivery time
- **Bill Payments:** Service availability, Balance check
- **Subscription:** Plan comparison, Mining rates
- **Profile:** Security question reminder
- **KYC:** Document tips, Clear photo guide

**Features:**
- Marathi/Hindi/English language support
- User-specific tips based on:
  - Mining session status
  - KYC verification status
  - Subscription plan level
  - PRC balance
  - Referral count
- Three variants: Banner (dashboard), Compact (other pages), Card
- Dismissible tips, Auto-rotate multiple tips
- Action buttons for quick navigation

**User Request:** Enhance existing chatbot with complete app knowledge.

**What Changed:**
User asks a question → Chatbot fetches user's complete data from DB → Analyzes all conditions → Gives EXACT problem + Solution

**Features Implemented:**

**1. Complete App Knowledge:**
- All subscription plans with prices and benefits
- Mining rates per plan
- PRC Savings Vault details
- All app features explained

**2. Important Disclaimers:**
- PRC काय आहे (Digital Reward Currency)
- PRC काय नाही (Not Cryptocurrency, Not Investment)
- Legal disclaimer for users

**3. Today's Rates:**
- Base mining rates per plan
- User's current rate with comparison
- Rate mismatch detection

**4. Step-by-Step Guides:**
- **KYC Process:** Complete Aadhaar + PAN upload steps
- **Bank Redeem:** Requirements + Steps + Limits
- **Gift Vouchers:** Brand selection + Redemption
- **Bill Payments:** All services + How to pay
- **Subscription Renewal:** Payment methods + Steps
- **Invite Friends:** Referral code sharing + Earnings

**5. Diagnostic Features:**
- All redeem statuses (Pending/Approved/Rejected)
- Subscription details with expiry
- Bill services history
- Gift voucher redemptions
- Wallet transactions
- Monthly earnings breakdown
- Contact & Support info

**Test Results:** ✅ All 6 scenarios passed
1. "PRC cryptocurrency आहे का?" → Clear disclaimer given ✓
2. "आजचा mining rate?" → User's rate + mismatch detected ✓
3. "KYC कशी करायची?" → Step-by-step guide ✓
4. "Bank redeem कसे?" → KYC requirement + steps ✓
5. "Subscription renewal?" → Payment methods + steps ✓
6. "Friends ला invite कसे?" → Referral code + steps ✓

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
