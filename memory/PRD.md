# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: Razorpay (Payments), Eko (BBPS/Recharge)

## What's Been Implemented

### Major Code Cleanup & Lint Fixes (DONE - April 19, 2026)
- **1.9 GB disk space saved** — deleted dead `admin-frontend/`, `frontend-admin/`, `admin-deploy/` folders
- Deleted duplicate logos & unused images (paras-logo-new/light/dark, abstract-growth, guilloche-bg)
- Deleted `support_chatbot.py`, `ai_routes.py`, `server.py.backup`, 19 scratch test files
- Removed 3 commented-out imports in `server.py`
- Production `console.log/debug/info` silenced in `index.js` (Play Store compliance)
- Fixed 182 F821 undefined name errors → **0 remaining**
- Total lint reduction: 94% (543 → 33 cosmetic-only warnings)

### User-Side Community Comment Delete (DONE - April 19, 2026)
- Added Delete button on comments and replies (author OR moderator)
- Confirmation popup + auto-refresh on success

### Bottom Nav Cleanup (DONE - April 19, 2026)
- Removed "Plan" (Crown) icon from BottomNav — now 4 tabs: Home, Invite, Community, Profile

### Admin Management Panels for Public Pages (DONE - April 19, 2026)
- **Admin Community Forum** (`/admin/community`, top-level sidebar)
  - Posts: list/search/filter by category/sort, Pin/Unpin, Delete, View with comments, Delete comments, Block author
  - Reports: pending/resolved tabs, actions (Dismiss / Delete Post / Delete + Block)
  - Blocked Users: list + Unblock
  - Moderators: Add (by UID) / Remove
  - Stats: Total Posts, Pending Reports, Blocked, Moderators
  - Backend: 26/26 pytest PASSED
- **Admin Careers** (`/admin/careers`, top-level sidebar)
  - Jobs: CRUD (title/dept/type/exp/salary/description/requirements), Activate/Deactivate, Filter by state, Search
  - Applications: List, filter by status/job, Status update inline or in detail modal (6 statuses), Download resume, Add admin notes
  - Stats: global count pills (fixed un-filtered fetch after testing)
  - Backend: 27/27 pytest PASSED
- **Admin Investors** (`/admin/investors`, top-level sidebar)
  - FAQ: Add/Edit/Delete (order-based sort)
  - Team: Add/Edit/Delete with photo, role, bio, LinkedIn
  - Press: Add/Delete press releases with source/URL/date
  - Documents: Multipart upload (PDF/DOC, 20MB), password-protect, Delete (removes file from disk), download count shown
  - Inquiries: List, filter by status, detail modal with Update status (5 statuses), Delete, Email Reply, Admin note
  - Metrics preview: Total users, Active subscribers, MAU, Growth%
  - Backend: 32/32 pytest PASSED (incl. NEW DELETE endpoints for FAQ/Team/Press + PUT for inquiry status)

### "We're Hiring" Badge (DONE - April 19, 2026)
- Animated ribbon on Careers hero (shimmer + pulse + pop)
- Floating dismissable pill on Investors page linking to /careers
- Auto-shows live job count, hides when no active jobs

### Careers Page (DONE - April 19, 2026) - PUBLIC
- Dynamic job postings (Admin CRUD): title, dept, location, type, experience, salary, description
- Application with resume upload (PDF 5MB), duplicate prevention
- Application status tracking: New → Reviewed → Shortlisted → Interview → Hired → Rejected
- Application status check by email (public)
- Admin notes on applications
- Company values, benefits, search/filter jobs

### Investors Page (DONE - April 19, 2026) - PUBLIC
- Real platform metrics from production DB (users, subscribers, transactions, growth)
- Revenue streams, competitive advantages, milestones timeline
- FAQ section (auto-seeds defaults, admin editable)
- Leadership team section (admin managed)
- Press/News section
- Password-protected document download
- Investor contact inquiry form with investment range
- Admin: view inquiries, manage docs/team/FAQ/press

### Community Help Page (DONE - April 19, 2026)
- Posts with text + image, 6 categories, Like/Comment/Bookmark/Report
- Edit post, Comment like, Nested replies, Share link
- Trending, My Posts, Saved tabs, Time filters, View count
- User community profile with reputation
- Moderation: Moderators, Block users, Pin posts, Resolve reports

### Employee Management System (DONE - April 18, 2026)
- Full CRUD with DOB, Gender, Father Name, Blood Group, Employment Type
- Documents: Aadhar, PAN, Bank, IFSC, UAN, ESIC
- Leave Management: CL/SL/EL, Attendance, Salary Slip (Indian standard)
- Employee Pool Wallet: 20% from mining, salary-proportional distribution

### Mining Formula v2.0 (DONE - April 18, 2026)
- Subscription position-based network (1822 positions migrated on prod)

### Previous Features (DONE)
- Eko Refund, Subscription Fixes, Core Team Pool Wallet
- Admin Bank Transfer, PRC Analytics, Chatbot Removed

### Employee Self-Service Portal (DONE - April 19, 2026)
- `/my-reports` route wired in App.js with lazy-load
- `/employee/my-reports` alias -> `/my-reports`
- Profile page shows "My Employee Portal" card (data-testid='my-employee-portal-card') for employee-linked users only (non-blocking probe to /api/employees/reports/my/profile)
- Portal tabs: Overview, Downloads (Payslips/Form16), YTD, Attendance, Leaves, Pool History
- Tested 13/13 backend + 4/4 frontend flows (test_reports/iteration_211.json)

### Bug Fixes (DONE - April 19, 2026)
- **Dashboard Pool Wallet "Total Distributed" always 0**: Fixed MongoDB projection in /api/user/{uid}/dashboard — projection was `{"balance":1}` only, now includes `total_distributed`. Verified returns 2.8905 PRC correctly.
- **Community comment count not refreshing in post list**: Added `fetchPosts()` call in `handleComment` and `handleDeleteComment` on CommunityPage.js so list view reflects updated count immediately.

### Security Hardening (DONE - April 19, 2026)
- **Auth guard on `/api/employees/reports/my/*`**: Added `_require_self_or_admin(request, user_id)` helper in `routes/employee_reports.py` — decodes JWT from Authorization header, asserts `payload.uid == query user_id` (or caller has admin/sub_admin/manager role). Prevents employee A from downloading employee B's payslip / Form 16 / pool history / attendance / leave records. Verified: 401 on missing/invalid token, 403 on cross-user access, 200 on self-access and admin-bypass.

### server.py Refactor — Phase 1 (DONE - April 19, 2026)
- **Extracted 9 social endpoints** from `server.py` into new `routes/social_profile.py` (~330 lines):
  - `/users/{uid}/public-profile`, `/users/{uid}/privacy-settings`
  - `/users/{uid}/follow`, `/users/{uid}/unfollow`, `/users/{uid}/check-follow/{target}`
  - `/users/{uid}/followers`, `/users/{uid}/following`
  - `/feed/global`, `/feed/network/{uid}`
- **server.py reduced: 34,091 → 33,661 lines (–430 lines)**
- Regression verified: **19/19 backend pytest cases PASSED** (iteration_212.json) — zero regressions across extracted, unrelated, cross-endpoint consistency, and auth flows
- Pattern establishes safe template for Phase 2 (Subscription, VIP, BBPS domain extractions)

### CRITICAL Pool Wallet NEGATIVE Balance Fix (DONE - April 20, 2026)
- **Production Issue**: Dashboard showed Pool Balance = **-3,682.89 PRC** (negative!) for Core Team Pool Wallet card.
- **Root Causes Identified (3)**:
  1. **Floating-point over-distribution**: `per_member = round(pool_balance / N, 6)` could round UP, making `per_member × N > pool_balance`. Over many runs, tiny over-deductions accumulated into large negative balances.
  2. **No concurrency guard**: `catch_up_pool_distributions` (startup) + scheduled `pool_wallet_daily_distribute` cron could fire simultaneously, reading same balance, both deducting full amount → double-deduct.
  3. **No safeguard against negative balance**: `$inc {balance: -X}` never checked if balance had enough funds.
- **Fixes (`routes/pool_wallet.py`)**:
  1. **math.floor for shares**: `per_member = math.floor(pool_balance / N * 1e6) / 1e6` — guarantees `per_member × N <= pool_balance`.
  2. **asyncio.Lock concurrency guard**: New `_distribution_lock` ensures only 1 distribution run at a time; duplicate invocations return `{success:False, skipped:True}`.
  3. **Atomic conditional deduct**: `update_one({wallet_id:"main", balance:{$gte: total_distributed}}, {...})` — if balance changed during run, deduction aborts with no user credits.
  4. **Auto-heal on negative balance**: If `pool_balance < 0` on distribute entry, reset to 0.0 with warning log before returning early.
  5. **New admin endpoint**: `POST /api/pool-wallet/admin/heal-negative-balance` — manually reset negative balance to 0 with audit trail in `pool_wallet_transactions`.
- **Verified (iteration_215.json - 12/12 pytest PASS)**: Tricky 10.000001/4 split leaves remainder 9.99e-7 (no negative); 3 concurrent calls → 1 success + 2 skipped; 8 back-to-back cycles never goes negative; admin heal endpoint correctly idempotent.

### Employee Pool Wallet — Same Hardening Applied (DONE - April 20, 2026)
- Applied identical floor+lock+atomic-deduct pattern to `distribute_employee_pool()` in `routes/employee_management.py` (proportional salary-based version).
- Split into lock-wrapped `distribute_employee_pool` + inner `_distribute_employee_pool_inner`.
- Plan-compute pass (floor each share) → atomic conditional deduct → credit pass (only if deduct succeeds).
- Auto-heal on negative pool_balance in same entry flow.
- New admin endpoint: `POST /api/employees/pool/heal-negative-balance` with audit log in `employee_pool_transactions`.
- **Manually verified**: (1) negative -1234.56 → auto-heals to 0; (2) 3 concurrent calls → 1 success + 2 skipped; (3) pool=1000.000001 across 4 employees → distributed=1000.0, remainder=9.99e-7 (positive); (4) admin heal endpoint returns correct response.

### Admin Employee Pool % Configuration UI (DONE - April 20, 2026)
- Backend `POST /api/employees/pool/settings` now validates: pool_rate must be 0-100, prc_to_inr_rate must be > 0; returns 400 with clear error message on invalid input. Logs admin updates with timestamp.
- Admin UI (`/admin/employees` → Pool tab) redesigned:
  - Pool Rate input with % suffix, step=0.5, preset-pill buttons for common values (10/15/20/25/30)
  - PRC → INR Rate input with ₹ prefix and `salary_cap_prc = monthly_salary / {rate}` formula preview
  - "Current: X% from mining" badge in section header
  - **"⚠️ Heal Negative Balance" button** appears only when `poolData.pool_balance < 0` for safety
  - Toast feedback shows actual values saved: `Settings saved — Pool 25%, 1 PRC = ₹0.12`
  - data-testids: `pool-rate-input`, `pool-rate-preset-{N}`, `prc-inr-rate-input`, `save-pool-settings-btn`, `heal-pool-balance-btn`
- **Tested via curl**: settings update succeeds with valid values, rejects -5 and 150 with HTTP 400.

### Admin Pages White Theme Conversion (DONE - April 20, 2026)
- User requested: 4 admin pages should have pure white backgrounds
- **Files converted**: `AdminEmployeeReports.js`, `AdminCommunity.js`, `AdminCareers.js`, `AdminInvestors.js`
- **Systematic class replacement** (order-preserving, safe): bg-slate-900→bg-white, bg-slate-800→bg-white, bg-slate-800/40→bg-slate-50, bg-slate-700/40→bg-slate-100, text-slate-100→text-slate-900, text-slate-400→text-slate-500, text-slate-300→text-slate-700, border-slate-700→border-slate-200, hover:bg-slate-700→hover:bg-slate-100, plus accent `text-*-400`→`text-*-600` for proper contrast on white.
- **Verified (iteration_216 - 100% PASSED)**: bodyBg=rgb(255,255,255) on all 4 pages, 0 dark-slate bg elements remaining, 0 invisible text elements (luminance check), all data-testids preserved, sidebar/hover states intact. No backend changes, lint clean on all files.

### User 360° Referrals Showing 0 — Schema Mismatch Fix (DONE - April 20, 2026)
- **Issue**: In Admin User 360° view, every user's referral count showed 0 even when the user had actual referrals.
- **Root Cause**: Two endpoints return different response schema for referrals:
  - PRIMARY `/admin/user-360` returns `{total_referrals, active_referrals, referrals, referred_by_name, total_earnings}`
  - FALLBACK `/admin/user360/full/{uid}` returns `{l1_count, l2_count, l1_users, total_network}`
  - Frontend `AdminUser360New.js` reads `userData.referral?.total_referrals` — which is undefined when fallback is used → displays 0.
- **Fix** (`routes/admin_user360.py`): Fallback endpoint now returns BOTH schemas (backward-compatible). Added: `total_referrals = len(l1_users)`, `active_referrals` (based on `mining_active` flag), `referrals` (first 10 l1 users), `referred_by_name` (upline lookup), and `total_earnings` (aggregation over `referral/referral_bonus/referral_reward` transactions).
- **Verified via curl**:
  - User with 10 referrals: fallback now returns `total_referrals=10, active_referrals=7, l1_count=10` (both schemas)
  - User with 2 referrals: fallback+primary both show `total_referrals=2, referred_by_name='SANTOSH AVHALE'` — identical schema

### Live Transaction Ticker Strip (DONE - April 20, 2026)
- **Feature**: Social-proof bottom-fixed strip showing latest 50 SUCCESSFUL transactions across 4 types: Mobile Recharge, DTH, Bank Redeem, Subscription.
- **Format**: `🔴 LIVE • 98******20 • Mobile Recharge • ₹199 ✓ • Pune` (no timestamps, no names)
- **Backend** (`/app/backend/routes/live_ticker.py`): `GET /api/public/live-transactions` merges data from `redeem_requests` (mobile/DTH) + `bank_withdrawal_requests` + `chatbot_withdrawal_requests` + `subscription_payments (status=paid)`. Masks mobile as `XX******XX` format. Enriches with user city (best-effort from users.city or address). Cached 30s. No PII fields (uid/name/email) in response.
- **Frontend** (`/app/frontend/src/components/LiveTickerStrip.js`): Fixed-bottom strip with horizontal marquee (right→left) animation, LIVE red pulse badge, service icon, green checkmark, dismiss (×) button, hover/touch-to-pause. Adaptive duration (~50px/sec). Mounted in `App.js` alongside BottomNav, visible only for logged-in regular users (roles admin/sub_admin/manager excluded via role check).
- **Tested (iteration_217 - 100% PASSED)**: 12/12 backend + all frontend acceptance criteria.

### Admin User 360° — 5 UX Cleanup + Badges (DONE - April 20, 2026)
- **User-requested cleanup:**
  1. Profile section: avatar enlarged (16→20), name `text-2xl/3xl`, UID prominent mono, contact fields in solid slate-800
  2. Removed "Redeem to Bank" admin action section (45-line block)
  3. Removed "Referral Bonus" StatCard (grid 5→4 cols)
  4. Removed "Logins" tab
  5. KYC Data tab enriched: status banner + identity/banking/address/nominee blocks + clickable document thumbnails (PAN/Aadhaar Front/Back/Selfie)
- **NEW Badges** (`core_team` + `employee`):
  - Backend: both `/admin/user-360` (primary) and `/admin/user360/full/{uid}` (fallback) now enrich `response.user` with `core_team` object (member_id, designation, added_at) and `employee` object (employee_id, designation, department, monthly_salary, joined_at). Returns `null` if not a member.
  - Frontend: Profile card renders amber-orange "CORE TEAM" badge (Crown icon) + indigo-violet "EMPLOYEE" badge (Briefcase icon). Tooltips show designation/department on hover. data-testids: `core-team-badge`, `employee-badge`
- **Quick Copy buttons**: Added on Email/Mobile/Referral Code fields — visible on hover (opacity-0 → group-hover:opacity-100). data-testids: `copy-email-btn`, `copy-mobile-btn`, `copy-ref-btn`
- **Verified via curl**: test user uid=`76b75808` (both CTM + Employee) returns both objects; regular user returns both as `null`. No regression on `total_referrals=10` field.

### CRITICAL User Block/Unblock Bug Fix (DONE - April 20, 2026)
- **Issue**: Admin User 360° → Block/Unblock button appeared to "work" (toast success) but user was NOT actually blocked — they could continue logging in normally.
- **Root Cause**: 3-way field mismatch:
  - Backend `block_user` action set `is_blocked: true` and `is_active: false`
  - Frontend `AdminUser360New.js` checked `userData?.user?.is_banned` (wrong field — always `undefined`)
  - Auth middleware at login (server.py ~L1403) checks `is_banned` — never set by the block action, so blocked users still logged in
- **Fix** (`server.py` ~L21878): `block_user` action now atomically sets `is_banned=True`, `is_blocked=True`, `is_active=False`, `banned_at`, `banned_by` (plus `blocked_at`, `blocked_by` for backward compat). Also unsets `session_token` + `refresh_token` to kick out active sessions. Clears user cache. Symmetric cleanup in `unblock_user` — clears all 3 flags and cache.
- **Verified end-to-end**:
  - Before block: login returns 200 ✅
  - Block action: `is_banned=True, is_blocked=True, is_active=False` in DB ✅
  - `/admin/user-360` endpoint exposes `is_banned=True` to frontend ✅
  - Login after block: **403 "Account suspended: Contact support"** ✅
  - Unblock action: all 3 flags cleared ✅
  - Login after unblock: 200 ✅

### CRITICAL Production Bug Fix — Subscription Auto-Start (DONE - April 19, 2026)
- **Issue**: Many users complained their "upcoming" subscription (already paid-for in PRC) did NOT auto-activate when their current plan expired. Root cause:
  1. `auto_expire_subscriptions` cron only processes users whose `subscription_plan != explorer` AND `subscription_expired != True`. If a user was already on explorer (manually downgraded or previous cron ran) with a stuck `"upcoming"` payment, it was **never activated**.
  2. No startup catch-up — if server was down or deployed during user's expiry window, upcoming plans could be delayed up to 30 minutes OR stuck indefinitely.
- **Fix 1 (Secondary Sweep)** in `auto_expire_subscriptions` (server.py ~L2727): After the main expire pass, iterate ALL `subscription_payments` with `status="upcoming"` whose `scheduled_start` has passed, and activate them if the user is on explorer/free/past-expiry. Invalidates user cache on activation.
- **Fix 2 (Startup Catch-up)** (server.py ~L33624): Added `subscription_catch_up()` task that runs `auto_expire_subscriptions()` 15 seconds after server startup to heal any missed expirations from deploy downtime.
- **Manual test**: Created test user on explorer+expired+has upcoming payment → ran cron → user activated to elite, expiry set +28 days, payment status flipped to `paid`, cache invalidated. Verified green.

### Upcoming Subscription UX Polish (DONE - April 19, 2026)
- Problem: Users saw "Upcoming - starts afte..." (truncated text) in PRC Statement; also dashboard card didn't surface queued plan because `/user/{uid}/dashboard` endpoint didn't expose `upcoming_plan`.
- **Fix (a) — Full Date in PRC Statement description** (server.py `purchase_prc_subscription`): Transaction description now reads `Elite Subscription (28 days) (Starts on DD MMM YYYY after current plan expires)`.
- **Fix (b) — Dashboard Upcoming Plan card**: Added `upcoming_plan` + `upcoming_plans_count` to `/api/user/{uid}/dashboard` response. The "Next Renewal: Paid & Confirmed" card in DashboardModern now renders with Start/End dates, PRC paid, and "Auto-renews on DD MMM YYYY. No action needed." line.
- **Fix (c) — Notifications**: New daily cron `notify_upcoming_subscription_starts` at 10:00 AM IST (4:30 UTC) sends "Your new plan starts in 3 days" and "Your new plan starts tomorrow" reminders with de-duplication via `upcoming_notify_sent.d3/d1` flags. Also added "Your new plan is now active!" notification in `check_and_activate_upcoming`.
- **Fix (d) — Admin User 360° badge**: Added `user.upcoming_plan` to PRIMARY `/api/admin/user-360` endpoint AND fallback `/api/admin/user360/full/{uid}`. Frontend AdminUser360New.js now shows amber "Upcoming Plan Queued" block (`data-testid='admin-user-upcoming-plan'`) with plan name, start date, and PRC paid.
- **Infrastructure bug fix**: `routes/notifications.py#create_notification` now sets a unique `notification_id = uuid4()` on every insert. Previously, duplicate-key errors on the `notification_id_1` unique index caused notifications to silently fail after the first null-id doc existed.
- **Guarded send**: `notify_upcoming_subscription_starts` now only marks `upcoming_notify_sent.d3/d1` AFTER `create_notification` returns a truthy id (prevents false "sent" when actual delivery fails).
- **Tests**: Iteration 214 → **10/10 backend + frontend admin badge PASSED** (zero regressions).

### Admin Impersonation Hardening (DONE - April 21, 2026)
- **User report**: "Admin dashboard वरती अगोदरच Login as a user button आहे" — a previous fork added a duplicate impersonation endpoint in `server.py` (`POST /api/admin/impersonate/{target_uid}`, ~80 lines) without checking that the feature already existed at `POST /api/admin/login-as-user` (admin_misc.py:647) with full UI in `AdminLoginAsUser.js`.
- **Fix 1 — Duplicate removal**: Deleted the unused duplicate endpoint from server.py. Only `/api/admin/login-as-user` remains. Regression verified: `/api/admin/impersonate/{uid}` returns HTTP 404.
- **Fix 2 — Race condition (iteration_218)**: Previous flow wrote admin data to localStorage, opened new tab, then restored admin's localStorage after a 300ms setTimeout. In slower scenarios the new tab read the already-restored admin data and mounted as admin. **New flow**: `AdminLoginAsUser.js` no longer touches localStorage at all; it encodes the impersonation payload via `btoa(JSON.stringify(payload))` and opens `/dashboard#imp=<base64>` in a new tab. A top-level IIFE in `App.js` (lines 27-54) parses the hash BEFORE React mounts, writes payload to `sessionStorage` (tab-scoped), and clears the hash with `history.replaceState`. `getStoredUserRaw/setStoredUserRaw/removeStoredUser` helpers prefer sessionStorage when `paras_imp_active==='1'`, else localStorage. Admin's shared localStorage is never touched.
- **Fix 3 — /api/auth/me 401 on IMP_ tokens (iteration_219)**: `/api/auth/me` used only `jwt.decode` and returned 401 for IMP_ tokens, causing `validateUserRole` in App.js to purge sessionStorage on impersonation-tab mount. **Backend** (`routes/auth.py` get_current_user_info): if `token.startswith("IMP_")`, look up `admin_impersonation_sessions`, verify expiry, and return the target user's info with forced `role="user", is_admin=false, is_impersonation=true`. **Frontend** (defense-in-depth): `validateUserRole` short-circuits and returns stored user when `is_impersonation===true` OR token starts with `IMP_`.
- **UX**: Added orange sticky impersonation banner at top of every page in impersonation tab — "IMPERSONATION MODE: You are viewing as {name} ({mobile})" with an "Exit Impersonation" button that logs out and closes the tab. data-testids: `impersonation-banner`, `impersonation-exit-btn`, `admin-login-as-user-btn`, `impersonation-search-input/btn`, `impersonation-result-<uid>`, `impersonation-confirm-login-btn`.
- **Verified (iteration_220 - 100% PASS)**: 13/13 frontend E2E assertions — new tab hydrates correctly with SANTOSH data, banner visible, sessionStorage populated, admin's localStorage unchanged (admin-test-123 intact), Exit button closes impersonation tab. 18/18 backend pytest still green.

## Upcoming Tasks
- P1: HRMS Reporting Phase D — Email salary slips/Form 16 (needs Resend/SendGrid)
- P1: Invoice PDF Download
- P2: WhatsApp Share Receipt

## Future/Backlog
- P2: server.py monolith refactor
- P3: MongoDB -> PostgreSQL migration
