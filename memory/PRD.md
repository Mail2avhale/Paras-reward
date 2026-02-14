# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build a PRC (point-based reward currency) system web application where users can:
- Earn PRC through mining and referrals
- Redeem PRC for bill payments and gift vouchers
- Manage their account and view transaction history

## Architecture
- **Frontend**: React.js with Material-UI, Tailwind CSS
- **Backend**: Python FastAPI (monolithic `server.py`)
- **Database**: MongoDB
- **Authentication**: JWT-based custom auth

## Upcoming/Future Tasks (P2/P3)
- [ ] Revenue Chart/Graph (Weekly/Monthly subscription revenue trends)
- [ ] User Growth Chart (Daily new user signups)
- [ ] Real-time Activity Feed (Live notifications for logins, orders, etc.)
- [ ] System Health Status card
- [ ] Export Reports button (Quick download of daily/weekly reports)
- [ ] Admin Activity Log (Track admin actions)
- [ ] Dark/Light Mode Toggle
- [ ] Customizable Dashboard (Drag & drop cards)
- [ ] Global Search functionality

## Core Requirements

### User Features
- Mining PRC (daily claims)
- Referral system with bonus earnings
- Bill payments (Electricity, Mobile, DTH, etc.)
- Gift voucher redemption
- KYC verification
- VIP membership subscription

### Admin Features  
- User management (360 view)
- KYC approval workflow
- Transaction monitoring
- Configurable redemption charges
- Financial reporting
- PRC analytics

## What's Been Implemented (Latest: Feb 2026)

### Recently Completed (Feb 13, 2026 - Session 3)

- [x] **EMI Pay Special Processing Charges**
  - For loan_emi requests ≤ ₹499: Processing fee = **50% of amount**
  - For loan_emi requests > ₹499: Flat **₹10** processing fee
  - Other services use default configurable processing fee
  - Examples: ₹100 EMI → ₹50 fee, ₹200 → ₹100, ₹600 → ₹10
  - Files: `server.py` (Lines 3424-3483)

- [x] **Mining Page Real Progress Bar**
  - Progress bar now shows actual session progress based on start/end time
  - Session Progress percentage displayed (e.g., "21.0%")
  - Progress calculated: (elapsed_time / 24_hours) * 100
  - State `sessionProgress` updates every second via `progressRef` interval
  - Animated gradient bar with shimmer effect
  - Resets to 0% on new session start or reward collection
  - Files: `Mining.js` (Lines 320, 330, 420-480, 495, 545, 820-855)

### Recently Completed (Feb 12, 2026 - Session 2)

- [x] **Real-time Referral Code Lookup in Registration**
  - NEW `/api/referral/lookup/{code}` endpoint - validates code and returns referrer name
  - Frontend: Debounced lookup (500ms) as user types referral code
  - Shows green checkmark + "Referred by: [Name]" box when valid
  - Shows red error "Invalid referral code" when invalid
  - Loading spinner while checking
  - Files: `referral.py` (Lines 55-75), `RegisterSimple.js` (Lines 35-75, 246-285)

- [x] **P&L Service-wise Fee Breakdown (10 Rs + 20% Admin Charge)**
  - Backend: Added `processing_fees` and `admin_charges` to revenue breakdown
  - Service-wise fee details: Bill Payments, Gift Vouchers, Luxury Claims, Withdrawals
  - Each service shows: count, processing_fees (₹10 × count), admin_charges (20% of amount)
  - Marathi insights: "Fees कडून एकूण कमाई: ₹X (Processing: ₹Y + Admin: ₹Z)"
  - Frontend: New "Service-wise Fee Breakdown" card with individual service stats
  - Testing: 14/14 backend tests passed
  - Files: `admin_finance.py` (Lines 88-220), `AdminProfitLoss.js` (Lines 303-395)

- [x] **Mining Page Advanced Animations (Full Suite)**
  - Rainbow Gradient Border: Moving rainbow colors around the card when mining
  - Orbiting Coins: 3 coins rotating around the PRC counter at different speeds
  - Confetti Burst: Colorful particles explosion on collecting rewards
  - Aurora Background: Northern lights style flowing gradient effect
  - Floating Bubbles: 5 bubbles rising in background
  - Glowing Shadow: Pulsing glow shadow behind counter
  - Rainbow Progress Bar: Multi-color moving gradient bar
  - Rainbow Counter Text: Shifting rainbow gradient on PRC value
  - 8 Sparkle Particles: More sparkles around counter
  - Files: `Mining.js` (Components: RainbowBorder, OrbitingCoin, ConfettiParticle, AuroraBackground, FloatingBubble, GlowingShadow)

### Previously Completed (Feb 12, 2026 - Session 1)

- [x] **Comprehensive P&L System**
  - Backend: Enhanced `/api/admin/finance/profit-loss` with detailed revenue/expense breakdown
  - Revenue tracking: VIP Memberships, Service Charges (2% + 5%), Delivery, Ads, Other
  - Expense tracking: Auto (Payment Gateway 2%, Cashback, PRC Rewards), Manual (Server, SMS, Marketing, Salary)
  - Health Score (0-100), Status (Profit/Loss/Breakeven) with Marathi messages
  - Insights generation (automatic warnings and tips)
  - Frontend: Complete redesign with visual status card, pie charts, insights panel
  - Fixed expenses integration with auto-proration
  - Files: `admin_finance.py`, `AdminProfitLoss.js`

- [x] **KYC Verification Page Advanced Optimization**
  - NEW `/api/kyc/stats` endpoint - single call for all counts (3 API calls → 1)
  - NEW `/api/kyc/bulk-verify` endpoint - approve/reject multiple KYCs at once
  - Database indexes on `kyc_documents(status, submitted_at, user_id)`
  - Bulk selection UI with checkboxes
  - Keyboard shortcuts: Ctrl+A (select all), R (refresh), Escape (clear)
  - Optimistic UI updates with immediate stats update
  - Performance: Stats API ~42ms, List API ~37ms (cached)
  - Files: `server.py`, `db_indexes.py`, `AdminKYC.js`

- [x] **PIN Entry UX Improvements**
  - Auto-focus first input when error occurs or PIN is cleared
  - Shake animation on error for visual feedback
  - Clear all button (🗑️ icon) when PIN has input
  - "Clear and try again" link in error message
  - Better keyboard navigation: Home, End, Shift+Delete to clear all
  - Backspace now clears current digit AND moves back
  - Focus scales the active input for better visibility
  - Files: `PinInput.js`, `tailwind.config.js`

- [x] **Mining Page Performance Optimization**
  - Added caching to `/api/user/{uid}/redemption-stats` API (2 min TTL)
  - Optimized `count_active_referrals_by_level_with_weights` with batch queries (N+1 → 2 queries)
  - Added database indexes: `transactions(user_id, type, created_at)`, `users(mining_session_end)`
  - Frontend: Reduced timer interval from 1s to 5s (reduces re-renders by 5x)
  - Frontend: Reduced API timeout from 10s to 5s (faster failure)
  - Performance: Redemption Stats API ~89ms → ~36ms (cached)
  - Files: `server.py`, `db_indexes.py`, `Mining.js`

- [x] **Mining Page Live PRC Counter Animation**
  - Added `AnimatedCounter` component for smooth real-time PRC counting
  - Added `FloatingCoin` animation showing "+PRC" indicator every 5 seconds
  - Live counter updates every 100ms for seamless visual effect
  - Added animated coin icon rotation and background pulse effect
  - Added per-second rate indicator showing exact earning speed
  - Files: `Mining.js`

- [x] **Backend Subscription Pricing Verified**
  - Confirmed pricing sync: Startup ₹299, Growth ₹549, Elite ₹799
  - All plans include quarterly, half-yearly, yearly options with discounts
  - Files: `server.py` (lines 1510-1576)

- [x] **Redis Caching Status**
  - Upstash Redis credentials present but limit exceeded (500,000 requests)
  - Fallback to in-memory caching active
  - User needs to: Profile → Universal Key → Add Balance for more requests
  - Files: `cache_manager.py`, `.env`

- [x] **Activity Card & Page Removed**
  - Removed "Activity" button from dashboard Services section
  - Removed MyActivity.js page and route from App.js
  - Files: `/app/frontend/src/pages/DashboardModern.js`, `/app/frontend/src/App.js`

- [x] **MongoDB Performance: user_uid Indexes Added**
  - Added indexes on `user_uid` field in notifications collection
  - Added compound indexes: `user_uid + read`, `user_uid + created_at`, `user_uid + read + created_at`
  - Added unique index on `notification_id`

- [x] **Unknown User Data Integrity Fixed (P2)**
  - Root cause: `/api/admin/subscription/grant` endpoint was missing `user_id` field (only had `user_uid`)
  - Fixed server.py line 12971-12989: Added `user_id: uid` to payment_record
  - Fixed 37 existing corrupt records by copying `user_uid` to `user_id`
  - Data integrity: 100% (51/51 records now have valid user_id)

- [x] **Notifications for Regular Users Fixed (P0 - Critical)**
  - Fixed: Regular users were not seeing notifications, only admins could see them
  - Root cause 1: `create_notification` helper was not passed to `set_admin_vip_helpers()` in server.py
  - Root cause 2: TopBar.js was using stale `user.unread_notifications` from login instead of live API call
  - Backend fix: Added `create_notification` to `set_admin_vip_helpers()` (server.py line 36682-36685)
  - Frontend fix: Added live `fetchUnreadCount()` API call with 60-second polling in TopBar.js
  - Frontend fix: Updated NotificationCenter.js to handle external `isOpen/onClose` props
  - Testing: All 11 tests passed (notifications CRUD, subscription approval notification)
  - Files: `/app/backend/server.py`, `/app/frontend/src/components/TopBar.js`, `/app/frontend/src/components/NotificationCenter.js`

### Recently Completed (Feb 11, 2026)

- [x] **Notification System Activated**
  - Fixed notification field mismatch (`user_uid` vs `user_id`)
  - Added `read` field for API compatibility
  - Bell icon now glows purple/pink when unread notifications exist
  - Added broadcast API for sending to all users
  - Added send API for individual user notifications
  - Testing: 18/18 tests passed (100%)
  - Broadcast sent to 207 users
  - Files: `/app/backend/server.py`, `/app/frontend/src/components/NotificationBell.js`

- [x] **Dashboard Stats Fix**
  - Fixed Total PRC showing 0 (added `total_prc` field to API response)
  - Fixed Explorer count showing 0 (now includes null/empty subscription_plan)
  - Files: `/app/backend/routes/admin_dashboard.py`, `/app/backend/routes/admin_vip.py`

- [x] **Duplicate Bell Icon Removed**
  - Removed extra NotificationBell from Dashboard page
  - Now only Navbar has the notification bell (consistent across all pages)
  - File: `/app/frontend/src/pages/DashboardModern.js`

- [x] **Subscription Pagination Added**
  - Added pagination for pending/approved payments (10 per page)
  - Oldest requests show first, latest at end
  - Previous/Next buttons with page counter
  - File: `/app/frontend/src/pages/AdminSubscriptionManagement.js`

- [x] **Pricing Display Fixed**
  - Updated to correct monthly prices: Startup ₹299, Growth ₹549, Elite ₹799
  - File: `/app/frontend/src/pages/AdminSubscriptionManagement.js`

- [x] **Toast Messages Centered**
  - Toast notifications now appear in center of screen
  - File: `/app/frontend/src/App.js`

- [x] **Subscription Approval "Expecting value" Bug Fix (P0 - Critical)**
  - Fixed JSON parse error when clicking Approve button
  - Root cause: Frontend sending POST with no body, backend expecting JSON
  - Frontend fix: Added empty `{}` body to axios.post call
  - Backend fix: Added try/except to handle empty request body
  - Also fixed subscription_plan being overwritten incorrectly
  - Files: `/app/frontend/src/pages/AdminSubscriptionManagement.js`, `/app/backend/routes/admin_vip.py`
  - Testing: 14/14 tests passed (100%)

- [x] **Image Preview Modal Fix**
  - Payment screenshot now opens in modal instead of blank page
  - Added close button and backdrop click to close
  - Added user name and amount info in modal footer
  - File: `/app/frontend/src/pages/AdminSubscriptionManagement.js`

- [x] **PIN Authentication Logic Fix (P1 - Critical)**
  - Fixed login for users with only `pin_hash` (no password_hash or password)
  - Priority order: `pin_hash` > `password_hash` > `password` (legacy)
  - Files modified:
    - `/app/backend/server.py` (line ~4275)
    - `/app/backend/routes/auth.py` (line ~438)
  - Testing: Created `pinonly@test.com` user - login successful

- [x] **Screenshot Visibility Fix in Admin Subscription Modal**
  - Fixed Review Payment modal in admin-frontend
  - Screenshot now bounded with `max-h-64` and `object-contain`
  - Added clickable overlay to view full size in new tab
  - Added hint text: "Tap/Click image to view full screenshot"
  - File: `/app/admin-frontend/src/pages/AdminSubscriptionManagement.js`

- [x] **Subscription Approve API Fix (P0 - Critical)**
  - Fixed API endpoint URL mismatch
  - Old: `/api/admin/vip-payments/{id}/approve` (404 error)
  - New: `/api/admin/vip-payment/{id}/approve` (singular)
  - Same fix for reject, delete, edit endpoints
  - File: `/app/frontend/src/pages/AdminSubscriptionManagement.js`

- [x] **Admin Dashboard Card Routing**
  - Added onClick handlers to subscription cards (Explorer, Startup, Growth, Elite)
  - Added routing to Revenue Stats cards (Revenue, Approved, Pending)
  - Files: `AdminDashboard.js`, `AdminSubscriptionManagement.js`

- [x] **Admin Sidebar - Request Approvals Collapsible Menu**
  - Created new "Request Approvals" collapsible parent menu in admin sidebar
  - Sub-items: KYC, Subscription, Bill, Gift Vouchers, Luxury Life Claim
  - Removed incorrect "Approval Hub" page (AdminApprovalHub.js deleted)
  - Updated both desktop and mobile sidebar navigation
  - File: `/app/frontend/src/components/layouts/AdminLayout.js`

- [x] **Pending Count Badges in Request Approvals Menu**
  - Added real-time pending count badges to Request Approvals menu
  - Total pending count shown on parent menu (red badge)
  - Individual pending counts on each sub-item (amber badge)
  - Auto-refresh every 2 minutes
  - APIs used: `/api/admin/kyc/pending`, `/api/admin/vip-payments`, `/api/admin/bill-payments`, `/api/admin/gift-vouchers`, `/api/admin/luxury-claims`

- [x] **Admin/Manager User Page Access Block**
  - Admin and Manager roles now cannot access user pages
  - All user routes redirect Admin/Manager to `/admin`
  - Removed "User View" button from Admin sidebar
  - File: `/app/frontend/src/App.js`, `/app/frontend/src/components/layouts/AdminLayout.js`

- [x] **Merged Advanced User Management into User 360°**
  - Added "Browse All" mode to User 360° page with user list
  - Filters: Search, Role, Plan, KYC Status, Show Deleted
  - Pagination support for large user lists
  - "View" button to switch to user 360° details
  - Removed "Users" tab from sidebar menu
  - Deleted AdvancedUserManagement.js file
  - File: `/app/frontend/src/pages/AdminUser360.js`

- [x] **Adjust Balance Modal in User 360°**
  - Professional modal with user info (Name, Current PRC, Plan)
  - Balance Type dropdown: PRC Balance, Cashback Wallet
  - Operation buttons: Add (green), Deduct (red), Set (blue)
  - Amount input + Notes textarea
  - Backend action handler for balance adjustment
  - File: `/app/frontend/src/pages/AdminUser360.js`

- [x] **Subscription Management Modal in User 360°**
  - Update Plan / History tabs
  - Step 1: Plan selection (Explorer, Startup, Growth, Elite)
  - Step 2: Duration (30, 90, 180, 365 days + Custom)
  - Step 3: Expiry Date (Auto-calculated or Manual)
  - Free Subscription toggle
  - Admin Notes
  - Backend action: update_subscription in `/app/backend/server.py`

### Recently Completed (Feb 10, 2026)
- [x] **Stock/Stockist System Removal**
  - Removed Stock Request System (~820 lines)
  - Removed Stockist Distribution System (~314 lines)
  - Removed Security Deposit System (~249 lines)
  - Removed Annual Renewal System (~241 lines)
  - Cleaned stockist counts from Admin KPIs
  - Deprecated profit wallet withdrawal (stockist-only)
  - Deleted: fix_stockist_parents.py, fix_parent_assignments.py
  - Models: Removed Stockist class, StockistCreate

- [x] **Admin Frontend Separation** (Feb 2026)
  - Created `/app/admin-frontend/` - separate admin React app
  - Build successful: 389 KB JS + 23 KB CSS (gzipped)
  - Production ready: `/app/admin-frontend/build/`
  - Same backend API, separate frontend
  - Admin-only login (admin & manager roles)

- [x] **Route Deduplication (P1)**
  - Disabled 33 duplicate routes in server.py
  - Routes now served exclusively by modular router files
  - No more route conflicts between server.py and routes/*.py

- [x] **Performance Optimization (P2)**
  - Added caching to admin_orders.py (order stats - 60s TTL)
  - Added caching to admin_withdrawals.py (pending count - 30s TTL)
  - Cache system: In-memory with Upstash Redis support

- [x] **"Stockist" Code Removal** (Feb 10, 2026)
  - Removed all stockist-related code from backend and frontend
  - Cleaned Navbar.js of stockist links

- [x] **Code Refactoring - Route Modularization**
  - Extracted routes from monolithic server.py into 19 router files
  - New structure: /app/backend/routes/*.py

- [x] **Advanced Network Tree View** (Feb 2026)
  - New dedicated `/network-tree` page
  - Backend API: `/api/referrals/network-tree/{user_id}`
  - Analytics dashboard with level distribution
  - Search by name/email/mobile
  - Filter by level, subscription plan, activity
  - Export to CSV functionality
  - Tree view with expand/collapse nodes
  - User details modal on click
  - Responsive design with data-testid attributes
  - Files: `NetworkTreeAdvanced.js`, `server.py` (line 26752)
- [x] **Forgot PIN with MSG91 OTP** (Feb 2026)
  - Mobile number verification
  - MSG91 OTP Widget integration
  - Secure PIN reset after OTP verification
  - APIs: `/auth/forgot-pin/check-mobile`, `/auth/forgot-pin/verify-otp`, `/auth/forgot-pin/reset`
- [x] **Auto-login after PIN entry** (Feb 2026)
  - Automatically submits login form when 6 digits entered
  - No need to click "Sign In" button
  - 300ms delay to show last digit before submitting
- [x] **Masked PIN Input with Show/Hide Toggle** (Feb 2026)
  - Created reusable `PinInput.js` component
  - PIN digits masked by default (shows • dots)
  - Eye icon toggles visibility
  - Applied to Login, Registration, and SetNewPin pages
  - Fixed React infinite loop bug using useRef pattern
- [x] **6-Digit PIN Authentication System** (Dec 2025)
  - Replaced traditional password with 6-digit PIN
  - Weak PIN validation (blocks sequential/repeated digits)
  - Hybrid login for legacy password users
  - Forced PIN migration for old users
- [x] **Progressive Account Lockout** (Dec 2025)
  - 5 min lock after 3 failed attempts
  - 24 hour lock after 5 failed attempts
  - Login history tracking
- [x] Admin Redemption Charges configuration page
  - Processing Fee (flat INR)
  - Admin Charge (percentage)
  - Formula: Total PRC = (Amount + Processing Fee + Admin Charges) × 10
- [x] Contact Details Feature (Admin + Landing page)
- [x] Advanced Support Ticket System
- [x] SEO & Policy Pages (Privacy, Terms, Disclaimer)
- [x] Fixed infinite redirect loop in AdminSettingsHub
- [x] Mobile-responsive InfoTooltip component across all pages

### Key API Endpoints
- `/api/redemption/charge-settings` - GET charge settings
- `/api/admin/redemption/charge-settings` - POST update charges
- `/api/request-bill-payment` - Submit bill payment
- `/api/get-charge-breakdown` - Get charge calculation

## Test Credentials
- Admin (PIN): `admin@paras.com` / PIN: `123456`
- Legacy User (Password): `mail2avhale@gmail.com` / Password: `Secure*123`

## Prioritized Backlog

### P0 (Critical)
- [x] Masked PIN Input with Show/Hide Toggle - DONE
- [x] 6-Digit PIN Authentication System - DONE
- [ ] Production deployment

### P1 (High)
- [x] Refactor `server.py` into smaller modules - COMPLETE (19 Router Files)
  - [x] `routes/auth.py` - 24 authentication endpoints
  - [x] `routes/users.py` - 14 user profile endpoints
  - [x] `routes/wallet.py` - 5 wallet endpoints
  - [x] `routes/referral.py` - 5 referral endpoints
  - [x] `routes/admin.py` - 10 security endpoints
  - [x] `routes/admin_vip.py` - 12 VIP/subscription endpoints
  - [x] `routes/admin_delivery.py` - 10 delivery partner endpoints
  - [x] `routes/admin_system.py` - 14 system/database endpoints
  - [x] `routes/admin_finance.py` - 26 P&L, expenses, wallet endpoints
  - [x] `routes/admin_users.py` - 16 user management endpoints
  - [x] `routes/admin_fraud.py` - 14 fraud detection endpoints
  - [x] `routes/admin_reports.py` - 16 charts & analytics endpoints
  - [x] `routes/admin_accounting.py` - 20 accounting & ledger endpoints
  - [x] `routes/admin_orders.py` - 10 order management endpoints
  - [x] `routes/admin_settings.py` - 18 settings & config endpoints
  - [x] `routes/admin_withdrawals.py` - 8 withdrawal management endpoints
  - [x] `routes/admin_dashboard.py` - 8 dashboard & stats endpoints
  - [x] `routes/admin_products.py` - 16 products & marketplace endpoints
  - [x] `routes/admin_misc.py` - 14 misc admin operations endpoints

### P2 (Medium)
- [ ] Add rate limiting for redemption requests
- [ ] Email notifications for transactions
- [ ] Two-factor authentication (OTP via SMS/Email)

### P3 (Low)
- [ ] Mobile app APK build
- [ ] Performance optimization

## Key Files Reference
- `/app/frontend/src/pages/NetworkTreeAdvanced.js` - Advanced network tree visualization
- `/app/backend/routes/referral.py` - **REFACTORED** Referral routes (5 endpoints)
- `/app/backend/routes/auth.py` - **REFACTORED** Auth routes (24 endpoints)
- `/app/backend/routes/users.py` - **REFACTORED** User routes (14 endpoints)
- `/app/backend/routes/wallet.py` - **REFACTORED** Wallet routes (5 endpoints)
- `/app/backend/routes/admin.py` - **REFACTORED** Admin security routes (10 endpoints)
- `/app/backend/routes/admin_vip.py` - **REFACTORED** VIP payment/subscription routes (12 endpoints)
- `/app/backend/routes/admin_delivery.py` - **REFACTORED** Delivery partner routes (10 endpoints)
- `/app/backend/routes/admin_system.py` - **REFACTORED** System/database management routes (14 endpoints)
- `/app/frontend/src/components/PinInput.js` - Reusable PIN input with masking
- `/app/frontend/src/pages/LoginNew.js` - Hybrid PIN/Password login
- `/app/frontend/src/pages/RegisterSimple.js` - Registration with PIN
- `/app/frontend/src/pages/SetNewPin.js` - PIN migration page
- `/app/frontend/src/pages/ReferralsEnhanced.js` - Referral system with link to network tree
- `/app/backend/server.py` - Main backend APIs (~322 admin routes remaining)

## Database Schema (Key Collections)
- `users`: User profiles with PRC balance
- `transactions`: All PRC movements
- `settings`: App configuration including redemption charges
- `bill_payment_requests`: Pending/completed payments
- `gift_voucher_requests`: Voucher redemptions

## Removed Systems (Feb 2026)
The following systems have been deprecated and removed:
- **Stockist Hierarchy**: master_stockist, sub_stockist, outlet roles
- **Stock Management**: stock_inventory, stock_requests, stock_movements
- **Security Deposits**: Stockist security deposit system
- **Annual Renewals**: Stockist renewal payment system
- **Commission Distribution**: 15% delivery charge distribution to stockist hierarchy
- **Profit Wallet**: Profit wallet withdrawal (stockist-only feature)

## Deployment
- **Preview URL**: https://mining-fixes.preview.emergentagent.com
- **Status**: Ready for production deployment
- **Action**: Use Emergent "Deploy" button

## Test Credentials (Updated Feb 13, 2026)
- **Regular User (for Mining page testing):** `miner@test.com` / PIN: `147258`
- **Admin User:** `admin@paras.com` / PIN: `123456`
