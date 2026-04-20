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

## Upcoming Tasks
- P1: HRMS Reporting Phase D — Email salary slips/Form 16 (needs Resend/SendGrid)
- P1: Invoice PDF Download
- P2: WhatsApp Share Receipt

## Future/Backlog
- P2: server.py monolith refactor
- P3: MongoDB -> PostgreSQL migration
