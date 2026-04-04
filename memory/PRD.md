# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 4 April 2026

## COMPLETED: Production 520 Error Fix (P0) - 29 March 2026
## COMPLETED: Single Leg Tree + Mining - 29 March 2026
## COMPLETED: Growth Network UI - 29 March 2026
## COMPLETED: Economy Rules (P0) - 29 March 2026
## COMPLETED: Razorpay + PRC Pricing (with 5% Burn) - 29 March 2026
## COMPLETED: Burn Display + Dynamic PRC Rate - 29 March 2026
## COMPLETED: Login Bug Fix - 29 March 2026

## COMPLETED: RewardLoader Spinners (All User Pages) - 29 March 2026
- Replaced ALL full-page spinners with animated PRC coin loader
- Pages: ProfileAdvanced, BankRedeemPage, ReferralsEnhanced, SubscriptionPlans, Setup, NetworkTreeAdvanced
- Component: `/app/frontend/src/components/RewardLoader.js` (data-testid="reward-loader")
- Testing: iteration 163 + 164 PASS

## COMPLETED: Registration Error Handling - 29 March 2026
- **Backend**: Mobile number now REQUIRED (was optional). Full name now REQUIRED.
- **Frontend**: Field-level errors with clear English messages
- Testing: iteration 164 (13/13 PASS)

## COMPLETED: 3-Tier Network Cap Formula (P0) - 29 March 2026
- **Tier 1 (Base)**: 800 cap (everyone starts here)
- **Tier 2 (Direct Referrals)**: +16 per direct referral → max 4000
- **Tier 3 (L1 Indirect Referrals)**: +5 per L1 indirect → max 6000
- **Formula**: `min(6000, 800 + 16×D + 5×L1)`
- L1 indirect = users referred by user's direct referrals
- Updated files: `mining.py`, `growth_economy.py`, `test_growth_economy.py`
- All 3 endpoints return tier breakdown: `l1_indirect_referrals`, `cap_tier1_base`, `cap_tier2_bonus`, `cap_tier3_bonus`
- Testing: iteration 165 (28/28 PASS) + unit tests (41/41 PASS)

## Active Architecture
- Mining: (500 + N×prc_per_user) × boost (Cash=1.0, PRC=0.70)
- Network Cap: min(6000, 800 + 16×D + 5×L1)
- Burn: Cash=1%, PRC=5% on ALL services (redeem + PRC subscription)
- Razorpay: ₹999 + 18% GST = ₹1178.82
- PRC sub: 16,477 PRC (with 5% burn, dynamic rate=11)
- PRC rate: Dynamic `/api/prc-economy/current-rate`

## COMPLETED: PRC Collect Balance UI Bug Fix (P0) - 30 March 2026
- **Bug**: "Collect Rewards" button showed success toast but Current Balance didn't update visually
- **Root Cause**: Race condition - `onBalanceUpdate` triggered parent re-render → `fetchUserData(true)` re-ran via useEffect → overwrote the optimistic balance
- **Fix**: Added `collectInProgressRef` to protect optimistic update for 3 seconds, preventing re-fetch from overwriting
- **File**: `/app/frontend/src/pages/Mining.js` (lines 191, 293-310, 487-563)
- Testing: iteration 167 (100% PASS - balance updates, persists, auto-session restart)

## COMPLETED: Smart AI Chatbot (SupportChatbot) - 30 March 2026
- Uses real user data (balance, cap, referrals) for contextual answers via GPT-4o-mini
- Does not expose internal formulas to users

## COMPLETED: Auto-Burning System (3.33% daily) - 30 March 2026
- Deducts 3.33% daily from PRC balance for users with expired subscriptions

## COMPLETED: Admin Redeem Limits Overview - 30 March 2026
- Aggregated + user-wise redeem limit tracking on Admin Dashboard

## COMPLETED: Chatbot Earning Projections (P1) - 30 March 2026
- Users can ask "If I get X more referrals, what will be my daily earning?" in any language
- Pre-computes projections for +5/+10/+25/+50/+100 referral scenarios using mining formulas
- Injected as [PROJECTION_DATA] alongside [USER_DATA] into GPT-4o-mini system prompt
- Responds in English, Marathi, Hindi, Hinglish with exact numbers (no vague answers)
- File: `/app/backend/routes/support_chatbot.py` (compute_projections + updated system prompt)
- Testing: iteration 168 (100% PASS - all projections verified, multilingual, PRC Collect regression OK)

## COMPLETED: Daily Mining Base Rate Change (500→1000/0) - 31 March 2026
- Base rate: 1000 PRC/day when network < 250, 0 PRC/day when >= 250 (only network bonus)
- Backend: mining.py `BASE_MINING_PRC=1000, BASE_MINING_THRESHOLD=250`, conditional in `calculate_mining_rate()`
- Chatbot projections updated to use new threshold logic
- Frontend Mining.js default miningRate updated to 41.67 (1000/24)
- User Guide updated with new examples and base rate info
- Testing: iteration 170 (100% PASS - 9/9 backend + frontend tests)

## COMPLETED: Speed Display Rebranding (PRC 100% + Cash POPCORN) - 31 March 2026
- PRC subscribers: Display changed from "70% Speed" to "100% Speed" (backend formula unchanged)
- Cash subscribers: Display changed from "100% Speed" to "100% + 30% POPCORN" bonus (backend formula unchanged)
- Updated across: Mining.js, DashboardModern.js, SubscriptionPlans.js comparison table, Chatbot system prompt, User Guide
- Purpose: Reduce PRC user dissatisfaction while giving Cash users premium branding

## COMPLETED: Admin Auto-Burn Manual Trigger + Stats - 31 March 2026
- Admin Dashboard "Auto-Burn (3.33%/day)" section with "Run Now" button
- Shows: Total PRC Burned, Users Burned, Eligible Now, Burn Txns stats
- Last Burn Job details: timestamp, users burned/skipped, PRC amount, errors
- Recent Burns list with per-user amounts
- Backend: `/api/admin/run-prc-burn` (POST) + `/api/admin/burn-stats` (GET)
- Files: `AdminDashboard.js`, `admin_misc.py`

## COMPLETED: Invoice Display with Print Option (P0) - 31 March 2026
- Invoice modal on Subscription page Payment History for all paid payments
- Company: PARAS REWARD TECHNOLOGIES PVT LTD, GSTIN: 27AAQCP6686E1ZR, HSN: 998314
- Shows: Subtotal ₹999, CGST 9% ₹89.91, SGST 9% ₹89.91, Total ₹1178.82, PAID badge
- Print option opens styled print window
- Backend updated to merge razorpay_orders + subscription_payments in payment history
- Files: `/app/frontend/src/components/InvoiceModal.js`, `SubscriptionPlans.js`, `razorpay_payments.py`
- Testing: iteration 169 (100% PASS - 8/8 invoice + 1/1 regression)

## COMPLETED: Auto-Burn Background Cron Job - 31 March 2026
- Added `run_auto_burn_all_expired()` in `burning.py` — runs via APScheduler at 5:30 AM & 5:30 PM UTC (11 AM & 11 PM IST)
- Iterates ALL users with expired subscriptions, calculates elapsed time burn (3.33%/day), deducts from balance
- First run initializes `burn_last_checked`, subsequent runs apply actual burns
- Logs results to `burn_job_logs` + individual transactions to `prc_transactions`
- Tested: 57 users burned, 4341 PRC total in 12h simulation

## COMPLETED: Popcorn Icon UI Replacement - 31 March 2026
- Replaced "POPCORN" text with custom SVG popcorn icon across all 3 pages
- Pages updated: Mining.js (speed badge), DashboardModern.js (mining speed card), SubscriptionPlans.js (comparison table)
- Icon: Yellow (#fbbf24) popcorn SVG, 16x16px, inline with text
- Verified: All 3 pages render correctly with no layout issues

## COMPLETED: Subscription Expiry Bug Fix (P0 Critical) - 1 April 2026
- **Bug**: Expired subscriptions were NOT auto-downgrading to "explorer", allowing continued mining & collection
- **Root Cause 1**: `get_user_data` and dashboard endpoints never checked subscription expiry — only mining endpoints did
- **Root Cause 2**: `check_subscription_expiry` in mining.py had timezone comparison bug — MongoDB stores naive datetimes, but comparison was against timezone-aware `datetime.now(timezone.utc)`, causing silent TypeError (caught by try/except)
- **Fix**: 
  - Added timezone-naive handling (`expiry_dt.replace(tzinfo=timezone.utc)`) in `mining.py`
  - Added subscription expiry check in `get_user_data` endpoint (server.py line ~8046)
  - Added subscription expiry check in dashboard endpoint (server.py line ~7835)
  - All 3 code paths now correctly downgrade expired users to "explorer" and block collection
- **Files**: `mining.py` (check_subscription_expiry), `server.py` (get_user_data + dashboard)
- **Testing**: 4/4 tests pass (mining status, user data, collect blocked, timezone-naive datetime handled)

## COMPLETED: Admin Dashboard PRC Economy Stats - 1 April 2026
- **Hero Card**: "Total PRC" → "Total PRC Mined" (all-time sum of users.total_mined)
- **PRC Economy Section**: Expanded from 3 to 5 exact figures:
  - Total Mined (all-time from users.total_mined)
  - In Circulation (current prc_balance sum)
  - Total Redeemed (COMPLETE: orders + bills + vouchers + bank withdrawals + bank transfers + PRC subs + DMT + unified)
  - Total Burned (from burn_logs)
  - Available for Redeem
- **Files**: `admin_dashboard.py` (backend stats), `AdminDashboard.js` (frontend UI)
- **Bug 1**: PRC subscription payment record PRC statement मध्ये दिसत नव्हता
  - Root Cause: Transaction record `prc_amount` field वापरत होतं पण statement `amount` field read करतो
  - Fix: `amount: -prc_amount` field added to transaction record + `subscription_prc` type added to TYPE_MAP + "Subscription" filter added
- **Bug 2**: PRC subscription redeem limit मधून deduct होत नव्हतं
  - Fix: `get_user_monthly_redemption_usage` मध्ये `subscription_payments` collection query added
  - Fix: PRC subscription endpoint मध्ये redeem limit check added (uses `calculate_user_redeem_limit`)
- **Files**: `server.py` (subscription_pay_with_prc, get_user_monthly_redemption_usage), `prc_statement.py` (TYPE_MAP, FILTER_CATEGORIES)

## COMPLETED: PRC Audit Endpoint (P0) - 1 April 2026
- Admin can audit any user's complete PRC ledger from joining date
- Endpoint: `GET /api/admin/audit/prc/{uid}` (admin auth required)
- Fetches ALL credits (mining, referrals, refunds, admin credits, ledger) and ALL debits (bills, bank withdrawals, vouchers, PRC subs, DMT, burns, unified redeems)
- Returns: chronological entries with running balance, category summary, calculated vs actual balance, discrepancy detection
- **Integrated into User 360 page** as "PRC Audit" tab with Run Audit button, summary cards, category breakdown, and scrollable ledger
- Files: `/app/backend/routes/prc_audit.py`, `/app/frontend/src/pages/AdminUser360New.js`
- Testing: Backend curl verified + Frontend screenshot verified (audit data renders correctly)

## COMPLETED: Holiday Calendar Date Fix (P0 Bug) - 1 April 2026
- Fixed wrong dates for ALL government holidays (Ram Navami, Holi, Eid, Mahavir Jayanti, Good Friday, etc.)
- Added missing Hanuman Jayanti (2 April 2026)
- Verified from ClearTax/Govt official sources
- Seed function now upserts correct dates on every restart
- File: `/app/backend/routes/holidays.py`

## COMPLETED: Admin Login-As-User Dual Logout Bug Fix - 1 April 2026
- **Bug**: Admin impersonation would overwrite user's session_token (logging out real user) AND overwrite admin's localStorage (logging out admin)
- **Backend Fix**: Removed `session_token` overwrite on user document; impersonation sessions validated separately via `admin_impersonation_sessions` collection
- **Session Validation Fix**: Added IMP_ token check in `/api/auth/validate-session` — both user's original session AND impersonation session can be active simultaneously
- **Frontend Fix**: Admin's localStorage backup/restore — admin session preserved when opening impersonation window
- Files: `admin_misc.py`, `server.py`, `AdminLoginAsUser.js`

## COMPLETED: Login "Account Not Found" Bug Fix - 2 April 2026
- **Bug**: User enters correct email → PIN screen दिसतो → PIN enter केल्यावर "Account Not Found" error
- **Root Cause**: `check_auth_type` (step 1) used case-insensitive regex email match, but `login` (step 2) used exact match. If DB stored email with different case, step 2 would fail.
- **Fix**: Made `login` function in `routes/auth.py` also use case-insensitive regex (`$regex` with `$options: "i"`) for email lookup, with `re.escape()` for security
- File: `routes/auth.py` (line ~593)

## COMPLETED: PRC Subscription Bypasses Redeem Limit - 2 April 2026
- **Feature**: Subscription PRC payment now only checks `prc_balance`, bypasses redeem limit
- **Redeem Balance Goes Negative**: After subscription, `available = redeemable - total_redeemed` can be negative (e.g., -799)
- **Natural Recovery**: Mining/earning increases total_earned → redeemable increases → negative recovers to positive
- **Bank/Bill Pay Still Blocked**: `effective_available = max(0, available)` — redeem limit still enforced for bank/bill pay
- **Dashboard UI**: Shows negative redeem balance in red with "Subscription मुळे negative — mining ने recover होईल" message
- **PRC Statement**: Simple entry "Elite Subscription -999 PRC" (no split details)
- Files: `server.py` (subscription_pay_with_prc, calculate_user_redeem_limit), `DashboardModern.js`

## COMPLETED: Redeem Limit Formula Fix — Total Earned = Balance Only - 2 April 2026
- **Change**: `total_earned = current_balance` (previously `current_balance + total_redeemed`)
- **Reason**: Redeemed PRC should not inflate redeem limit — only current balance determines earning capacity
- **Effect**: Self-correcting economy — spend more → balance drops → limit drops → prevents overspending
- File: `server.py` line ~15938 (1 line change in `calculate_user_redeem_limit`)

## COMPLETED: PRC Dynamic Rate Inconsistency Bug Fix - 3 April 2026
- **Bug**: Different users seeing different PRC rates (11 vs 13) on production
- **Root Cause**: 3 separate `get_dynamic_prc_rate` functions with own in-memory caches per worker process → different workers calculated independently → different cached rates
- **Fix**: All rate functions now read from `system_settings.prc_dynamic_rate` in MongoDB (single source of truth shared across all workers). Only recalculates if DB rate older than 5 min.
- **Frontend**: Fixed hardcoded fallback from 11 to 10 (consistent with backend)
- Files: `server.py`, `growth_economy.py`, `unified_redeem_v2.py`, `DashboardModern.js`

## COMPLETED: Admin PRC Subscription & Redeem Actions - 3 April 2026
- **Admin Activate PRC Subscription**: Admin can activate Elite subscription for any user using their PRC balance. Bypasses cooldown. Shows in PRC statement as "Activated by Admin".
- **Admin Redeem to Bank**: Admin can create bank redeem request for any user. Respects available redeem limit. Shows in PRC statement.
- Backend: `POST /api/admin/activate-prc-subscription`, `POST /api/admin/create-redeem-request`
- Frontend: User360 "Admin Actions" section with both features
- Files: `admin_misc.py`, `AdminUser360New.js`

## COMPLETED: Admin PRC Subscription Carry-Forward Confirmation - 3 April 2026
- **Bug**: Admin activating PRC subscription for user with active plan showed unexpected long expiry (remaining + 28 days). No confirmation shown.
- **Fix**: Added English confirmation dialog (`window.confirm`) showing remaining days, new expiry, and total days before proceeding.
- File: `AdminUser360New.js` (Activate Elite button onClick handler)

## COMPLETED: Total Redeemed ₹0 Bug Fix - 3 April 2026
- **Bug**: Total Redeemed stat showed ₹0 in Admin User 360 View
- **Root Cause**: Fallback endpoint (`admin_user360.py`) only queried `redeem_requests.amount_inr`, missing subscription_prc, gift vouchers, etc.
- **Fix**: Changed to comprehensive aggregation on `transactions` collection (all negative txns excluding burns). Changed display from ₹ to PRC.
- Files: `admin_user360.py`, `AdminUser360New.js`

## COMPLETED: PRC Amount Mismatch Bug Fix (Subscription Page) - 3 April 2026
- **Bug**: Three different PRC amounts shown: "Required" (stale 16,477), "Total PRC Required" in Fee Breakdown (19,446), Backend expected (19,473)
- **Root Cause 1**: `PRCRateDisplay` admin charge = 20% of `amount` only. Backend = 20% of `(amount + processingFee)`.
- **Root Cause 2**: `getPRCPrice()` used stale pricing from page load (rate changes between load and payment).
- **Root Cause 3**: Intermediate `Math.round()` per step vs backend's single final round.
- **Fix**: PRCRateDisplay and getPRCPrice formulas now match backend exactly. handlePRCPayment re-fetches fresh pricing before submitting.
- Files: `PRCRateDisplay.js`, `SubscriptionPlans.js`

## COMPLETED: Admin Subscription Management + Upcoming Plan Concept - 3 April 2026
### Subscription Details (User 360 Tab)
- **New Tab**: "Subscription" in User 360 data tabs
- Shows Current Plan: plan name, start date, end date, remaining days, status badge
- Shows Upcoming Plans: queued plans with cancel & refund button
- Shows Payment History: all past subscription payments with status badges
- **Edit Button**: Extend days (+7/14/28/60/custom) or set specific expiry date. Requires note.
- **Cancel Button**: Cancel current or upcoming plan. Refund options: Full / Pro-rated / None. Requires note.
- All actions logged to `admin_actions` collection for audit trail

### Upcoming Plan Concept
- When user/admin pays for subscription while active plan exists, plan is QUEUED as "upcoming"
- PRC deducted immediately, but plan starts AFTER current plan expires
- Auto-activation: When current plan expires, upcoming plan auto-activates on next dashboard/login access
- Backend: `subscription_payments` collection with `status: "upcoming"`, `scheduled_start`, `scheduled_end`
- Modified: `subscription_pay_with_prc()` in server.py and `admin_activate_prc_subscription()` in admin_misc.py

### User Dashboard Upcoming Plan Card
- Shows upcoming plan info (plan name, scheduled start, duration) on user dashboard
- Renders conditionally when `stats.upcomingPlan` exists
- `data-testid="upcoming-plan-card"`

### Backend Endpoints
- `GET /api/admin/subscription/{uid}/details` — Full subscription info
- `POST /api/admin/subscription/{uid}/edit` — Edit (extend_days / set_expiry)
- `POST /api/admin/subscription/{uid}/cancel` — Cancel + refund
- `GET /api/admin/subscription/user/{uid}/info` — User-facing subscription info (auto-activates upcoming)

### Files Modified/Created
- NEW: `/app/backend/routes/admin_subscription.py`
- MODIFIED: `/app/backend/server.py` (upcoming plan logic in subscription_pay_with_prc, auto-activation on /me, prc_ledger fix)
- MODIFIED: `/app/backend/routes/admin_misc.py` (upcoming plan logic in admin_activate_prc_subscription)
- MODIFIED: `/app/frontend/src/pages/AdminUser360New.js` (Subscription tab, Edit/Cancel modals)
- MODIFIED: `/app/frontend/src/pages/DashboardModern.js` (Upcoming Plan card)

## COMPLETED: Code Quality & Security Fixes - 3 April 2026
### Security Fixes
- Removed `verify=False` from `eko_kyc_service.py` (3) and `bbps_services.py` (2) — SSL MITM prevention
- Added DOMPurify for XSS in `BlogArticle.js`, `InvoiceModal.js`, `AdminRazorpaySubscriptions.js`
- Replaced `random.randint/choices` with `secrets` module for PIN/OTP/referral code generation
- Replaced hardcoded test credentials with `os.environ.get()` in test files
### Deferred (P2)
- 218 React hook deps, 83 array index keys, component splits, localStorage, complex function refactoring

## COMPLETED: Redeem Limit "Used" Calculation Bug Fix (P0 Critical) - 4 April 2026
- **Bug**: Failed and refunded redeem requests were incorrectly counted as "Used" in the user's redeem limit
- **Root Cause 1**: `success_statuses` in `get_user_all_time_redeemed` was missing `pending/Pending/PENDING` — user explicitly requires Pending to count as Used
- **Root Cause 2**: `max(txn_total, total_redeemed)` logic picked the higher of unfiltered `transactions` collection total vs. status-filtered collections total, bypassing all status filtering when transactions had more data
- **Root Cause 3**: `orders` collection used `$nin` (exclusion list) instead of `$in` (inclusion list), potentially missing new invalid statuses
- **Fix**:
  - Added `pending/PENDING/Pending` to `success_statuses` array
  - Replaced `max(txn_total, total_redeemed)` with just `total_redeemed` (status-filtered collections only)
  - Changed `orders` collection to use `$in: success_statuses` instead of `$nin`
  - Fixed `admin_user360.py` to use centralized `get_user_all_time_redeemed` via `set_redeemed_fn` pattern
- **Verified**: 
  - Bug user (cbdf46d7): 18788 PRC `retry_failed` correctly excluded
  - PRC user (6c96a6cc): 9240 PRC `failed` correctly excluded
  - `pending` bank_transfer_requests now correctly included
- **Files**: `server.py` (get_user_all_time_redeemed), `admin_user360.py` (set_redeemed_fn)
- **Testing**: iteration 174 (100% PASS - 10/10 backend + frontend verified)


## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P2: server.py refactoring (45k+ lines)
- P2: 218 React hook dependency warnings fix
- P2: Large frontend component files split
- Future: MongoDB to PostgreSQL migration
