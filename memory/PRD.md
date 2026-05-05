# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: Razorpay (Payments), Eko (BBPS/Recharge)


### Code Smell Cleanup — Plan B (DONE - 1 May 2026)

**Goal**: Remove technical debt flagged in user's audit without touching core business logic.

**Changes**:
1. **JWT fail-fast across all files**: Removed hardcoded `'paras-reward-secret-key-2024'` fallback from `routes/auth.py:594`, `routes/employee_reports.py:42`, `tests/test_sustainability_burn_integration.py`. Now all read `JWT_SECRET_KEY` from env and raise `RuntimeError` if missing. Strong 64-char secret committed to `backend/.env`.
2. **Frontend API URL centralization**: Created `/app/frontend/src/lib/api.js` as single source of truth (`export const API`, `export const BACKEND_URL`). Migrated 107 duplicate `const API = ...` declarations across `pages/`, `components/`, `utils/` to `import { API } from "../lib/api"`. Remaining 10 files (semantically different `API = BACKEND_URL` pattern) kept intact.
3. **Service worker unification**: Deleted duplicate `/app/frontend/public/sw.js` + its inline registration in `public/index.html`. Only `/service-worker.js` remains (feature-rich with SKIP_WAITING + update logic), registered in `src/index.js`.
4. **Language selector unification**: Deleted stub `/components/LanguageSwitcher.js` (fake `useState`-only, not wired to i18n). `Footer.js` now uses real `LanguageSelectorCompact` (connects to `LanguageContext`).
5. **Business constants centralized**: `PLATFORM_FEE` + `ADMIN_CHARGE_PERCENT` now imported from `routes/growth_economy.DEFAULT_PROCESSING_FEE_INR` / `DEFAULT_ADMIN_CHARGE_PERCENT` in 3 files (`unified_redeem_v2.py`, `bank_redeem.py`, `admin_finance.py`).
6. **Admin PINs moved to env**: Added `ADMIN_OPERATION_PIN` (was hardcoded `"123456"` in 15 checks) and `ADMIN_OVERRIDE_PIN` (was hardcoded `"153759"`) to `backend/.env`. `server.py` reads both at boot; production can rotate without code change.

**Testing**: iteration_225.json — 15/15 backend cases PASSED (JWT, admin PIN guards at both 123456 and 153759, `/api/auth/me` decoding, fees constants live at PLATFORM_FEE=10/ADMIN_CHARGE_PERCENT=20, Eko refund auth). Frontend build succeeded, login page renders with 2 inputs. No regressions.


### Admin Force-Activate Elite (PRC Override) — DONE (30 Apr 2026)

**Goal**: Let an admin manually activate an Elite subscription for a user using PRC, even when the user has insufficient PRC balance — with proper guardrails, audit trail, and auto debt-recovery.

**Rules (confirmed with user)**:
- Admin PIN required (`153759`).
- Only Elite plan; price = `calculate_elite_prc_price()` dynamic (`₹999 + 18% GST + processing + admin charges → PRC`).
- Consumes 1 of 3 lifetime PRC-subscription chances (`MAX_PRC_SUBSCRIPTIONS=3`).
- 7-day subscription cooldown ENFORCED (NOT bypassed).
- PRC balance IS allowed to go NEGATIVE (overdraft / debt).
- Full audit trail: `admin_audit_logs` (`action="force_activate_elite_prc"`) + `transactions` statement row (`SUB-PRC-ADMIN-*`, `type="subscription_prc_admin_override"`, negative amount) + `subscription_payments` row with `admin_force_activated=true`.
- Auto-posts a Success Story to Community Forum on immediate activations (via `create_success_story_post`).

**Debt Recovery**:
- Since all credit paths (`mining`, `referral`, `cashback`, `admin_credit`, …) use `$inc: {prc_balance: +x}`, the negative balance naturally offsets until it returns to ≥ 0.
- On force-activation with overdraft, we stamp `prc_debt_active=True`, `prc_debt_original=abs(balance_after)`, `prc_debt_at`, `prc_debt_reason="admin_force_activate_elite"` on the user.
- `GET /api/user/prc-debt-status/{uid}` computes `in_debt/remaining/recovered` from current balance and auto-clears `prc_debt_active` (stamps `prc_debt_cleared_at`) once balance ≥ 0.
- Withdrawals while negative are blocked implicitly by `effective_available = min(available, current_balance)` already.

**New endpoints (backend/server.py)**:
- `POST /api/admin/subscription/force-activate-elite-prc` — validates admin PIN → looks up user by mobile/email/uid → enforces cap + cooldown → `calculate_elite_prc_price()` → `$inc prc_balance -= total_prc` (no `$gte` guard → overdraft allowed) → activates / queues Elite → credits company wallets → audit/activity/notification/community-post/sustainability-burn.
- `GET /api/admin/subscription/force-activate-preview?identifier=...` — returns `{user, pricing, projection(overdraft/is_upcoming), eligibility(chances, cooldown, can_proceed, blockers)}` for the 3-step confirm UI.
- `GET /api/user/prc-debt-status/{uid}` — PRC debt status with auto-clear.

**New frontend page**:
- `/admin/force-activate-subscription` → `AdminForceActivateSubscription.js` (3-step search → preview → PIN modal → success result).
- Sidebar link under *Request Approvals* group (AdminLayout, `KeyRound` icon, `highlight=true`).

**Tests**: `/app/backend/tests/test_admin_force_activate_elite_prc.py` — 9 cases, all passing. Frontend Playwright verified all testids end-to-end.


### Sustainability Auto-Burn 1% (DONE - Feb 1, 2026)

**Goal**: After every successful PRC service transaction, burn 1% of the user's POST-deduction balance to maintain platform sustainability.

**Rules** (per user spec):
- Trigger: Mobile Recharge, DTH Recharge, Bank Redeem (mark-paid), PRC Subscription activation.
- Burn = 1% × (balance AFTER service deduction).
- **Threshold**: only if post-deduction balance > 30,000 PRC. Below threshold → skip.
- Permanently destroyed (PRC supply ↓; no company-wallet credit).
- **Refund** of source service → reverses the burn (balance restored, original entry marked `reversed=true`).
- Statement description: **"PRC BURN BY APP TO MAINTAIN SUSTAINABILITY"**.
- Idempotent: same `(service_type, service_ref_id)` never double-burns.

**Implementation**:
- New module `/app/backend/routes/sustainability_burn.py` with `apply_sustainability_burn(...)` and `reverse_sustainability_burn(...)`.
- Records in BOTH `prc_ledger` (modern; type=`auto_burn`) AND `transactions` (legacy; type=`prc_burn`) for full PRC Statement visibility and historical reports compatibility.
- Hooks added at:
  - `/app/backend/routes/eko_recharge.py` — recharge success + refund flows.
  - `/app/backend/routes/manual_bank_transfer.py` — `mark-paid` and `bulk-mark-paid`.
  - `/app/backend/server.py` `pay_subscription_with_prc` — both immediate and upcoming subscription activations.
- `/app/backend/routes/prc_statement.py` — `auto_burn` mapped to "Burn" filter category; `auto_burn_reversal` → "Refund".
- `get_user_all_time_redeemed` does NOT include burns (separate semantic; burns are a SYSTEM action, not user redeem).

**Regression tests** (`/app/backend/tests/test_sustainability_burn.py` — 5 passing):
- Burn 1% when balance > 30k.
- Skip when balance ≤ 30k.
- Idempotent (re-fire doesn't double-burn).
- Refund of service reverses the burn.
- Burns NOT counted in Total Redeemed.

### Bulk Fail Over-Limit Pending Bank Redeems (DONE - Apr 27, 2026)

**Goal**: One-time admin action — programmatically fail all pending bank redeem requests where the user has already crossed their cumulative redeem cap (`total_redeemed > total_limit`), refunding the locked PRC back to wallets.

**Production Result**:
- Identified via paginated dry-run on `/api/bank-transfer/admin/requests?status=pending`
- **606 over-limit requests** failed with `admin_remark="Over Limit"`
- **13,519,367 PRC** refunded across users (1.35 कोटी PRC)
- Pending count: 1806 → 1201 | Failed count: 2090 → 2696
- 5 stubborn timeout-prone records turned out to be within-limit on retry (no action needed)

**Scripts** (kept for future re-runs):
- `/app/backend/scripts/prod_bulk_fail_overlimit.py` — `--dry-run` paginates with auto-retry on enrichment timeouts (limit=30 per page, falls back to limit=10 on big-page timeouts). `--execute` chunks calls to existing `/admin/bulk-mark-failed` (50 IDs per batch).
- `/app/backend/scripts/prod_retry_unresolved.py` — re-checks any IDs that were timeout-skipped in dry-run.





### Total Redeemed "0 PRC" False Display Bug (DONE - Feb 1, 2026)

**User-reported**: "Total Redeemed" on Redeem Used Details page showed `0.00 PRC`, and "USED" on Home Dashboard showed `0.00 PRC`, even though the "Redeem Breakdown" clearly listed Bank Redeem 18,365 + Subscription 16,477 + Bill Pay 7,155 ≈ 42,000 PRC.

**User requirement**:
1. "Total Redeemed" = "USED" = sum of "Redeem Breakdown" categories.
2. Include ALL legacy PRC debits from old/deprecated services that aren't in current service collections (e.g., old `subscription_prc`, orphan `bank_withdrawal`, `admin_debit` in `transactions` wallet log; `redeem`/`retry_debit` in `prc_ledger`).
3. EXCLUDE `prc_burn` (voluntary PRC destruction, not a service spend).
4. NO refund netting — gross lifetime spend.

**Fix** (`/app/backend/server.py` `get_user_all_time_redeemed`):
- **Layer 1**: Scan all 16 service collections, collect every `reference_id` / `request_id` / `redeem_id` / `txn_id` / `order_id` / `payment_id` (even from non-success records) into `seen_refs` set — so later layers can dedup strongly.
- **Layer 2**: Sum service collections with success status (defines the category breakdown).
- **Layer 3**: Scan `transactions` wallet log for legacy debit types (`subscription_prc`, `bank_withdrawal_request`, `admin_debit`, etc.) — count ONLY if `reference_id` is NOT already in `seen_refs` (true orphans). `prc_burn` is explicitly NOT in this list.
- **Layer 4**: Scan `prc_ledger` for `redeem` / `retry_debit` types — same strong ref-based dedup. This handles the case where `redeem` + `retry_debit` share the same `reference` (same event billed twice in ledger) — both get deduped against the single service-collection ref.
- Fallback: `(amount_rounded, YYYY-MM-DDTHH:MM)` fingerprint for records missing reference IDs.

**Admin diagnostic**: `GET /api/admin/debug/total-redeemed/{user_id}` returns entry-by-entry breakdown (source, type, ref, amount, timestamp) plus `discrepancy_prc` vs by-category sum.

**Verified on preview user 9970100782**:
- `total_redeemed` (limit API) = **109,609 PRC**
- `total_used` (usage-history) = **109,609 PRC**
- Breakdown sum (Bank 108,609 + Redeem 500 + Bill Pay 500) = **109,609 PRC**
- All three match exactly ✅

**Regression tests** (`/app/backend/tests/test_total_redeemed_display.py` — 8 passing):
- Total = breakdown sum
- Refunds don't wipe total to 0
- Same redeem in multiple service collections → counted once
- INR field not misused as PRC
- Pending redeems counted (PRC already deducted)
- Legacy `admin_debit` in `transactions` → counted
- `prc_burn` → NOT counted
- `prc_ledger` `retry_debit` sharing ref with service redeem → counted once





### Admin Redeem Limit Override + Bank Redeem False "0 Available" Fix (DONE - Feb 1, 2026)

**User-reported bug**: Production user `9970100782` (Elite Subscription, 1196 active network users, 65.22% unlocked, Remaining Redeem Limit = 12,99,837 PRC ≈ ₹99,987 as shown on Home) got "Insufficient Redeem Limit. Available: 0 PRC" when submitting Bank Redeem.

**REAL root cause (frontend)**:
`BankRedeemPage.js` line 101 used `.catch(() => ({ data: null }))` to silently swallow ANY error from `GET /api/user/{uid}/redeem-limit` — timeout, 403, 500, mobile network blip, ALL collapsed to `null`. Then the submit guard evaluated `redeemLimit?.effective_available || ... || 0 = 0` and falsely showed "Available: 0 PRC" even though the user legitimately had 12+ lakh PRC of limit.

Home screen loaded the API successfully on first Dashboard render → showed correct 12,99,837 PRC. The Bank Redeem page's *second* call (on mobile, often a slower network path) occasionally failed transiently → silent null → false block.

**Fix** (`/app/frontend/src/pages/BankRedeemPage.js`):
1. `/redeem-limit` fetch now retries up to 3 times with back-off (400/800 ms).
2. After retries, if it still fails, a toast surfaces the error AND the user can still submit. The client-side "available" guard is *only* applied when `redeemLimit` is non-null — otherwise the backend's authoritative `check_redeem_limit` at POST `/bank-transfer/request` validates (line 413 `manual_bank_transfer.py`).
3. `availableLimit` now uses `Math.max(effective_available, effective_remaining, remaining_limit, available)` instead of `||` chain, which correctly coalesces zero values without falling back to 0 prematurely.

**Bonus (separate fix — admin safety net)**:
- `calculate_user_redeem_limit` now honors `redeem_limit_override` (previously set by admin but ignored) as *additional* headroom above `total_redeemed`. `check_redeem_limit` bypasses the "zero unlock" block when override is active.
- New Admin UI in `AdminUser360New.js` → "Redeem Override" button + modal with amount, reason, permanent toggle.
- Badge on Redeem Limit card when override is active.

**Regression tests** (all passing):
- `/app/backend/tests/test_redeem_limit_override.py` — 3 tests
- `/app/backend/tests/test_bank_redeem_transient_failure.py` — authoritative server-side check




## What's Been Implemented

### Live Wins / Success Stories Feed in Community Forum (DONE - April 23, 2026)

**Business Goal**: Social proof loop — every successful Mobile Recharge, DTH Recharge, and Bank Redeem is auto-posted as a visually distinct "Success Story" card in the Community Forum, driving engagement and trust.

**Key Changes**:
1. **Backend — `community.py`**:
   - `create_success_story_post()` helper — idempotent via `ref_id` dedup. Posts are unified with regular feed schema (`user_id='system'`, `status='active'`, `category='Success Story'`) so they appear in `/posts` queries.
   - Triggers wired into `eko_recharge.py` (mobile + DTH) and `manual_bank_transfer.py` (paid bank transfers).
   - `GET /api/community/success-stats` — returns `{total_lifetime, total_7d, total_24h, total_amount_inr, breakdown}` for Live Wins banner. Handles legacy case variations (`paid`/`Paid`/`PAID`).
   - `POST /api/community/posts/{id}/react` with emoji (`celebrate`|`love`|`fire`) — add / swap / remove in single endpoint.
   - `GET /api/community/posts/{id}/my-reaction?user_id=X` — returns current user's reaction.
   - `POST /api/community/admin/backfill-success-stories` — one-shot script to backfill historical success stories from `recharge_transactions` + `bank_transfer_requests`.
   - `POST /api/community/posts/create` blocks `category='Success Story'` with 403 (system-generated only).

2. **Frontend — `SuccessStoryCard.js` (new component)**:
   - Gradient strip (blue=mobile, purple=DTH, emerald=bank).
   - Shows only: service chip, "Successfully Completed" badge, first name, city/state, ₹amount, 3 reaction buttons.
   - **No timestamp rendered** (per user request).
   - Optimistic reaction UI with rollback on API error, light celebration Sparkles for brand-new posts.

3. **Frontend — `CommunityPage.js`**:
   - Live Wins amber banner at top with Trophy icon — "X successful requests completed · ₹Y disbursed · Join Z wins this week".
   - Category chip "🎉 Wins" filters to Success Story posts only.
   - Conditional render: `post.category === 'Success Story'` → `<SuccessStoryCard />`, else `<PostCard />`.
   - Create Post modal correctly excludes Success Story from user dropdown.

**Test Coverage**: 12/12 pytest backend cases + full frontend verification on live preview (iteration_222.json). No issues.

### Eko Pending Refunds — Smart Mobile Attribution + Production Reconciliation (DONE - April 22, 2026)

**Business Goal**: ₹87,977 of real money stuck at Eko in "Refund Pending" state (60 transactions). Until Eko's Refund API is called with OTP, Eko won't release eValue back to retailer wallet. Priority: unblock this money flow.

**Architecture Decision**: Pure user self-service via RefundBlockerModal. Each transaction attributed to the end-user (customer whose mobile is involved), not the retailer. Falls back to retailer (SANTOSH) only when no user match found.

**Key Changes**:
1. **`reconcile-pending-refunds` endpoint** extended with 2 new modes:
   - `create_missing=true`: Creates DB records for transactions that exist on Eko side but not in our DB (53 BBPS from Eko Connect retailer portal)
   - `match_by_mobile=true`: Looks up user by cell_number (BBPS) or sender_phone (DMT) before attributing. Falls back to `owner_uid` if no user found.

2. **Helper functions added**:
   - `_find_user_by_mobile(mobile)`: Normalizes +91/91 prefixes, matches against `users.mobile` or `users.phone`
   - `_create_bbps_record(...)`: Creates record in `recharge_transactions` with full metadata + `customer_mobile` (where OTP goes)
   - `_create_dmt_record(...)`: Creates record in `dmt_transactions` with beneficiary/account/bank/IFSC + `customer_mobile`

3. **`pending-refunds` endpoint** now returns `customer_mobile` for BBPS too (was DMT-only). Modal shows prominent "OTP will be sent to +91 XXXXXXXXXX" amber box.

4. **Admin UI** (`AdminFailedTransactions`): "Reconcile Eko Pending Refunds" button triggers dry-run → confirmation → actual run with smart defaults.

**Production Reconciliation Executed (April 22, 2026, 13:55 UTC)**:
- Total candidates: 60 (53 BBPS + 7 DMT)
- Matched/Created: 60 (100%)
- Impacted users: **31 total**
  - **30 self-serve users** (₹87,477, 99.4%) — registered customers who will login and handle OTP themselves
  - **1 fallback** (SANTOSH, ₹500, 0.6%) — his own DMT test transactions
- Top users: Mohd Ameen (₹15,295), Shubham Bajpai (₹10,797), Sandeep Kumar (₹7,598)

**Eko API Compliance (verified)**:
- EKO_INITIATOR_ID = 9936606966 (PARAS retailer mobile) ✅
- EKO_USER_CODE = 19560001 ✅
- Refund APIs implemented per https://developers.eko.in/v1/reference/resend-refund-otp-1 and refund docs
- OTP flow: Eko sends SMS to `customer_mobile` stored on transaction → user enters → v2 refund API → eValue returns to retailer wallet

**User Flow (Per Impacted Customer)**:
1. Customer logs in to parasreward.com with their own credentials
2. RefundBlockerModal auto-opens (dashboard blocked)
3. Sees their pending refunds with full metadata + OTP destination mobile
4. Clicks "Send Refund OTP to My Mobile" → Eko SMSs their mobile
5. Enters OTP → Verify → Refund completes → Eko releases eValue to PARAS wallet

**Test Status**: 45/45 backend pytest pass. Lint clean. Production validated for Siddhali's DMT record (full data confirmed).


### Eko Refund APIs Final Verification + Customer Mobile Hint (DONE - April 22, 2026)
**Context**: User reported OTP not delivering after deploying refund flow. Deep investigation revealed Eko sends OTP to transaction's stored `customer_mobile`, not user's login mobile.

**Eko API Compliance (verified against docs)**:
- **Resend Refund OTP**: `POST {BASE_URL}/v1/transactions/{tid}/refund/otp` — body: `initiator_id`, `developer_key`; headers: `developer_key`, `secret-key`, `secret-key-timestamp` ✅
- **Refund**: `POST {BASE_URL}/v2/transactions/{tid}/refund` — body: `initiator_id`, `otp`, `state=1`, `user_code`; same headers ✅
- Both match https://developers.eko.in/v1/reference/resend-refund-otp-1 and refund docs exactly.

**Root Cause of OTP Non-Delivery (Confirmed)**:
Examined all 5 matched DMT transactions in production:
- 2 of SANTOSH's DMTs: `customer_mobile=9421331342` (his walk-in customer) — OTP goes there, not to SANTOSH
- 3 others: `customer_mobile` matches user's mobile but `otp_ref_id` empty in Eko response (transactions 39+ days old)
- Eko returns `status=0` (accepted) but actual SMS queue skipped for stale transactions.

**Changes Made**:
- `eko_recharge.py`: `/pending-refunds/{user_id}` now returns `customer_mobile` field (DMT + bank_transfer). Helper scans all 4 collections unchanged.
- `RefundBlockerModal.js`: Shows prominent amber box "OTP will be sent to: +91 XXXXXXXXXX" with note "(Mobile registered with Eko for this transaction)" so user knows which mobile to check.
- **Reverted admin UI features** per user request — pure user self-service OTP flow:
  - Removed `/refund/debug-send-otp` admin diagnostic endpoint
  - Removed `/refund/admin-force-refund` admin endpoint
  - Removed "Force Refund All" button from AdminFailedTransactions page
- Kept: `/api/admin/failed-transactions/reconcile-pending-refunds` (admin one-click tagging) — this is initial setup, not runtime action.

**Production Reconciliation Run (Completed April 22, 2026)**:
- Admin ran reconcile-pending-refunds on production
- Matched 5 of 60 transactions (3 users: SANTOSH/Siddhali/Sujan, ₹2,300 total)
- 55 unmatched BBPS (not in production DB — likely Eko Connect retailer portal direct transactions)
- Impacted users will see RefundBlockerModal on next login with proper customer_mobile display.

**Test Status**: 45/45 backend pytest pass. Frontend lint clean. Production verified via screenshot.


### User-Side Pending Refunds Blocker Modal - DMT + BBPS Support (DONE - April 22, 2026)
- **Context**: 53 BBPS + 7 DMT transactions stuck in Eko `REFUND PENDING` status. Per Eko flow, customer must complete OTP refund; SMS-based OTP is sent to registered mobile.
- **Dashboard Blocker**: Before user can access dashboard, all pending refunds must be cleared.
- **Backend Changes**:
  - `routes/eko_recharge.py`:
    - `_find_user_txn`: Extended to scan all 4 collections (recharge_transactions, bill_payment_requests, dmt_transactions, bank_transfer_requests) and match by `eko_tid`, `client_ref_id`, or `eko_client_ref_id`.
    - `_mark_refunded`: Updates all 4 collections; tracks `_source_collection` for audit.
    - `GET /api/recharge/pending-refunds/{user_id}`: Returns rich per-transaction data — amount, phone/account, bank, IFSC, beneficiary_name, service_type ("Mobile Recharge" / "Bill Payment" / "Money Remittance (DMT)" / "Bank Transfer"), source.
    - `POST /api/recharge/refund/process/{tid}`: Primary "Send OTP" endpoint. Calls Eko v1 `/transactions/{tid}/refund/otp`. In production, OTP is SMS-delivered; in staging, if Eko returns OTP inline, we auto-complete.
    - `POST /api/recharge/refund/verify-otp/{tid}`: Calls Eko v2 `/transactions/{tid}/refund` with `otp, initiator_id, user_code, state=1`. On success, marks refunded + credits PRC back.
  - `server.py` dashboard endpoint: `pending_refund_count` now counts across all 4 collections.
- **Frontend**: `RefundBlockerModal.js` rewritten — SMS-first 2-step flow:
  1. Rich data display per txn: Amount (prominent ₹), service badge (color-coded), TID, Client Ref, Phone/Account, Bank, Beneficiary, IFSC
  2. "Send Refund OTP to My Mobile" button → calls Eko → SMS to user's mobile
  3. OTP input field → "Verify" button → completes refund
  4. Resend OTP option + graceful error display
- **Reconciliation Script**: `/app/backend/scripts/seed_pending_refunds.py`
  - Hardcoded 53 BBPS + 7 DMT transactions from Eko Excel export
  - Idempotent — searches by `eko_tid`, `client_ref_id`, `eko_client_ref_id` across all 4 collections
  - Updates matched records to `status: refund_pending` (skips already-refunded)
  - Prints per-user impact summary and unmatched list
  - Admin runs once on production: `cd /app/backend && python scripts/seed_pending_refunds.py`
- **E2E Testing (Verified)**:
  - Dashboard API returns `requires_refund_action: true` + `pending_refund_count` (tested: 2)
  - `/pending-refunds/{uid}` returns rich data for both BBPS + DMT
  - Send OTP click → real Eko API hit → graceful error handling (test TID → `Invalid_tid_Length` shown in UI; real production TID → OTP sent via SMS, UI switches to OTP input)
  - Verify OTP → Eko v2 refund call → marks refunded + credits PRC
  - Dashboard blocker auto-closes when all refunds cleared
- **Eko API Compliance**: Implementation matches official docs at https://developers.eko.in/v1/reference/resend-refund-otp-1 (v1 OTP) and https://developers.eko.in/v1/reference/refund (v2 refund).


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

### Live Ticker Round-Robin Rotation (DONE - April 21, 2026)
- **User request**: "Live ticker strip मध्ये transaction randomly दाखव — 1 subscription then 1 mobile then 1 bank redeem... like this, latest transaction first".
- **Fix** (`routes/live_ticker.py`): Replaced flat time-desc sort with category round-robin. Items grouped into 5 buckets (subscription/mobile/bank/dth/bbps) by icon. Each bucket sorted newest-first. Round-robin picker iterates `[subscription, mobile, bank, dth, bbps]` until 50 items or all buckets empty. Cache key bumped to `v2_interleaved` to bust old payloads.
- **Verified via curl**: Ticker order now reads `crown → mobile → bank → bolt(bbps) → crown → crown → ...` — first round correctly rotates one of each category; remaining subscriptions fill after all other buckets exhausted.

### Live Ticker — Bank Redeem Fix (DONE - April 21, 2026)
- **User reports**: (1) Ticker showed `Bank Redeem XX******XX ₹0`, (2) Admin-completed bank redeems from `/admin/bank-transfers` page were not appearing.
- **Root causes** (`routes/live_ticker.py`):
  1. `bank_transfer_requests` collection (source of `/admin/bank-transfers` page) was not queried at all — only `bank_withdrawal_requests` and `chatbot_withdrawal_requests` were.
  2. `bank_transfer_requests` status field uses PascalCase `"Paid"` but `SUCCESS_STATUSES` only matched lowercase `"paid"`.
  3. Amount field names differ across collections — `amount_inr` vs `amount` — code only read `amount_inr`.
  4. `bank_withdrawal_requests.user_mobile` is often empty; no fallback enrichment from `users.mobile`.
  5. Legacy redeem_requests docs with only `prc_amount` (no `amount_inr`) rendered as `₹0`.
- **Fixes**:
  1. Added `db.bank_transfer_requests` query block that reads `amount_inr` OR `amount` with `_needs_mobile=True` flag for downstream enrichment.
  2. Extended `SUCCESS_STATUSES` to include PascalCase variants: `"Paid", "Completed", "Approved", "Success", "PAID", "COMPLETED"`.
  3. Enrichment logic upgraded: re-fetch mobile from `users` collection whenever `_needs_mobile` is set OR current mask is the all-X fallback (`XX******XX`) — but only overwrite if the enriched mask is not the same fallback (preserves mask for test-data edge cases).
  4. Drop any item with `amount <= 0` before round-robin interleaving — prevents ₹0 entries from polluting the ticker.
  5. Cache key bumped to `v4_nozero` to bust stale payload.
- **Verified via curl**: 11 items returned. Bank Redeem entries now show real admin-completed amounts `₹1900`, `₹2000`, `₹2000` with `99******82` mobile mask. Round-robin order: crown → mobile → bank → bolt → crown → bank → crown → bank → crown → bank → crown.

### P&L Dashboard — Critical Bug Fixes (DONE - April 21, 2026)
- **User request**: "App प्रॉफिट मध्ये आहे का लॉस मध्ये आहे हे समजायला पाहिजे. अगोदर code check कर — बरोबर आहे का?"
- **Audit**: `routes/admin_finance.py#get_profit_loss_statement` (`/api/admin/finance/profit-loss`) and `pages/AdminProfitLoss.js` (`/admin/profit-loss`) were already built, but showed ₹0 revenue / wrong loss numbers in production due to six data-source mismatches:
  1. **Subscription revenue**: queried empty `vip_payments` (legacy) instead of current `subscription_payments` with status `"paid"`. Primary revenue source entirely missing.
  2. **Bank withdrawal status**: filtered by `"approved"` only, but actual statuses are `"completed"` / `"Paid"` / `"PAID"`.
  3. **`bank_transfer_requests`** collection (admin-completed manual redeems, source of `/admin/bank-transfers` page) not queried at all — revenue and payout both missing.
  4. **Gift vouchers**: used `"completed"` but actual delivered records use `"delivered"` status.
  5. **Status case-sensitivity**: MongoDB `$in` is case-sensitive; `"PAID"`, `"Paid"`, `"SUCCESS"`, `"Delivered"` etc. all missed.
  6. **PRC → INR liability rate** hardcoded at `0.10`; should read from `settings.prc_economy.prc_to_inr_rate`.
- **Fixes applied**:
  - Added `SUCCESS_STATUSES` array with lowercase + PascalCase + UPPERCASE variants (similar to live_ticker fix).
  - Replaced primary subscription source: query `subscription_payments` first (inr_equivalent / amount_inr / amount / prc_amount*rate fallback), keep `vip_payments` as legacy fallback.
  - Bank redeems now sum from BOTH `bank_withdrawal_requests` + `bank_transfer_requests` with additive date clause for `paid_at/completed_at/approved_at`.
  - Per-txn fees: prefer stored `processing_fee_inr`/`admin_charge_inr`; fall back to computed (₹10 + 20%) only if missing.
  - PRC_TO_INR loaded dynamically from `settings.prc_economy`.
  - Increased `.to_list()` caps (10k → 50k-200k) to avoid truncated aggregations on heavy months.
- **Verified on preview**: P&L for April 2026 now returns:
  - Status: **PROFIT 📈**, Net ₹2,647.08, Revenue ₹3,606 (3 subscriptions + ₹70 fees), Expenses ₹959 (prc_rewards ₹788 + gateway ₹71 + bank payout ₹100), Margin 73.4%, Health Score 100
  - Previously (before fix) same period showed: ₹0 revenue, -₹78.86 "breakeven" (wrong).
- **Frontend**: No changes needed — `AdminProfitLoss.js` already renders every field correctly. Screenshot captured showing PROFIT card, insights, revenue/expense breakdown.

### Manager Role — Permissions Sync with Live Admin Pages (DONE - April 21, 2026)
- **User request**: "manager का सर्व नवीन पेजेस access allow/disallow कर. काही पेजेस डिलिट केलेले आहे ते manager role मध्ये दिसत आहे — सर्व latest stage प्रमाणे कर."
- **Three critical issues found**:
  1. **Endpoint URL mismatch (always broken)**: `admin_accounting.py` router has prefix `/admin/accounting` but the 4 permission endpoints were defined as `@router.get("/admin/permissions/list")` → actual URL became `/api/admin/accounting/admin/permissions/list`. Frontend `ManagerPermissions.js` called `/api/admin/permissions/list` → always 404. Manager permissions UI silently broken since inception.
     - **Fix**: Created a secondary `permissions_router = APIRouter()` (no prefix) in `admin_accounting.py` and moved the 4 endpoints (`/admin/permissions/list`, `/admin/user/{uid}/permissions` GET+PUT, `/admin/managers/sync-permissions` POST) to it. Wired in `server.py` as `api_router.include_router(admin_permissions_router)`.
  2. **Out-of-date permissions list**: `ALL_ADMIN_PERMISSIONS` had only 28 entries and was stale — 10 entries pointed to dead routes (redirect to `/dashboard`): `analytics`, `error-monitor`, `company-wallets`, `prc-analytics`, `liquidity`, `user-ledger`, `security`, `fraud-alerts`, `fraud-dashboard`, `settings-hub`. Missing 22 live admin pages: `core-team`, `employees`, `employee-reports`, `community`, `careers`, `investors`, `failed-transactions`, `transaction-manager`, `contact-settings`, `service-toggles`, `policies`, `service-charges`, `cash-bank-book`, `ledger`, `capital-management`, `financial-reports`, `financial-ratios`, `trial-balance`, `accounts-receivable`, `accounts-payable`, `economy-settings`.
     - **Fix**: Rewrote `ALL_ADMIN_PERMISSIONS` with 40 entries grouped into 6 categories (General / HR & Community / Operations / Payments / Finance / Security & Economy) — all verified against actual React routes in `App.js`.
  3. **Invalid default permissions**: `DEFAULT_MANAGER_PERMISSIONS` contained non-existent keys `subscription_payment` (actual ID is `subscriptions`), `gift_vouchers` (actual is `gift-vouchers`), `users` (route redirects to user360).
     - **Fix**: Rewrote default list to 13 valid keys for a standard ops manager (dashboard, members, user360, kyc, subscriptions, bank-transfers, razorpay-subs, bbps-dashboard, eko-services, gift-vouchers, support, contact-submissions, popup-messages).
- **Sync endpoint upgrade**: `/admin/managers/sync-permissions` now REMOVES stale permissions from existing managers (previously only added missing defaults) so deleted pages disappear from manager accounts. Returns `stale_removed` count for audit.
- **Frontend** (`AdminLayout.js`):
  - `MENU_TO_PERMISSION` rewritten to match new 40-permission catalog.
  - `ROUTE_TO_PERMISSION` rewritten to map every working `/admin/*` route to its permission ID.
  - Sidebar `menuGroups.finance` purged of 4 dead links; added 8 new working finance pages.
  - Sidebar `menuGroups.controls` purged of dead links; kept popup-messages, prc-economy, economy-settings, data-backup.
  - `settings` group renamed to "Operations & Settings" with 4 working pages (service-toggles, service-charges, contact-settings, policies) — all `/settings-hub` variants were dead and removed.
  - Top-level `analytics` menu item removed.
- **Verified via curl (preview)**: `/api/admin/permissions/list` returns 200 with 40 permissions + 13 defaults. `/api/admin/managers/sync-permissions` returns 200 with `stale_removed` field. Sidebar screenshot shows all new links working, no dead links.

### State-wise Monthly GST Report (DONE - April 22, 2026)
- **User request**: "आपण अगोदरच GST implement केलेले आहे. मला monthly एक report पाहिजे — कोणत्या state मधून किती GST जमा झाला आहे."
- **Audit of existing GST implementation** (`routes/gst_invoice.py`):
  - Already had `POST /invoice/generate`, `GET /invoice/admin/all`, PDF generation, 29 real invoices in DB.
  - Gap: Customer state was never captured on invoices → no way to group by state. Every invoice's gst_breakdown always split to CGST+SGST even for inter-state customers (GST compliance gap, but not asked to fix).
- **Two new backend endpoints**:
  - `GET /api/invoice/admin/state-wise-report?month=&year=` — For the given month, aggregates invoices by customer state. Enrichment priority: `invoice.customer_state` (new snapshot field) → `users.state` → `kyc_submissions.state` → "Unknown". Returns per-state: invoice_count, base, cgst, sgst, igst, total_gst, total_amount. Classifies as CGST+SGST when state==Maharashtra (company HQ), IGST otherwise. Summary includes intra/inter/unknown counts.
  - `GET /api/invoice/admin/yearly-gst-summary?year=` — 12-month trend for chart (invoice_count + total_gst + total_amount per month).
- **Invoice generation updated**: `POST /invoice/generate` now resolves `customer_state` at generation time (users.state → kyc_submissions fallback) and persists it in the invoice document. Future invoices will have correct state snapshot; existing ones fall back to current users.state.
- **New admin page** `/admin/gst-report` (`pages/AdminGSTReport.js` - 280 lines):
  - 4 summary cards: Total GST, CGST+SGST (intra-state), IGST (inter-state), Total Revenue.
  - Month/Year dropdowns with auto-refresh on change.
  - State-wise breakdown table with GST-Type badge (Home State / CGST+SGST / IGST / UNKNOWN), per-state and total row.
  - Amber advisory when Unknown-state invoices exist.
  - Stacked bar chart showing CGST/SGST/IGST per state.
  - Yearly trend line chart for monthly GST collected.
  - **Export CSV** button for accountant/CA use.
- **Wiring**: Added `gst-report` permission to `ALL_ADMIN_PERMISSIONS` (Finance category). Sidebar link under Finance & Accounting (highlighted). Route `/admin/gst-report` + permission mapping in `App.js` and `AdminLayout.js` MENU_TO_PERMISSION / ROUTE_TO_PERMISSION.
- **Verified**: Backend curl returns 29 invoices ₹3,549.77 GST for March 2026. Frontend screenshot shows summary cards, table, Export CSV button, and amber note about unknown-state invoices — all rendering correctly.

### Pending Bank Redeems — Excel Export (DONE - April 22, 2026)
- **User request**: "Redeem to Bank मधील फक्त pending requests ची Excel sheet download करून पाहिजे (Sr.No, Name, A/c, IFSC, Amount, Active/Inactive, Date)."
- **Backend**: New endpoint `GET /api/admin/bank-redeem/export-pending-excel` (`routes/bank_redeem.py`). Pulls pending from BOTH `bank_withdrawal_requests` (modern) and `bank_transfer_requests` (legacy admin-manual) collections, dedupes by request_id, sorts oldest-first, batch-enriches user names + active/banned/blocked status from `users` collection, and builds an `.xlsx` via openpyxl with:
  - Title row (purple fill, timestamp)
  - Header row (indigo fill, 7 columns)
  - Data rows with color-coded Active/Inactive cells (green for Active, red for Inactive)
  - Total row (yellow fill, ₹ formatted)
  - Frozen header, column widths tuned, ₹ number format
  - IST timestamps (UTC+5:30) for date column
  - Filename `pending-bank-redeems-YYYYMMDD-HHMM.xlsx`
  - Response headers `X-Total-Pending` and `X-Total-Amount` for quick checks
- **Frontend**: Green "Download Pending (Excel)" button on `/admin/bank-transfers` page header (next to Refresh). Uses axios `responseType: 'blob'` + blob URL + anchor click to trigger download. Toast notifications for Preparing/Success/Failure.
- **Tested**: curl returns 200, 5.5 KB .xlsx file, 4 rows (title, header, 1 data, total). Screenshot shows button in place.

### Pending Bank Redeems Excel — Data Robustness Fix (DONE - April 22, 2026)
- **User report (screenshot)**: Downloaded Excel showed 100+ pending with Name but Account Number, IFSC, Amount all blank / ₹0.
- **Root causes**:
  1. Legacy pending records in production were spread across 4 collections (my code only queried 2): `bank_withdrawal_requests`, `bank_transfer_requests`, `bank_redeem_requests`, `chatbot_withdrawal_requests`. Chatbot ones use `uid` (not `user_id`), `inr_amount` (not `amount_inr`), `account_number` at top-level (not nested), and no `ifsc_code`.
  2. Many pending requests don't have `bank_details` embedded — they only reference the user. Admin expects to see the user's saved bank details from their profile.
  3. Field name inconsistency: `amount_inr` vs `amount` vs `amount_requested` vs `inr_amount`. Values often stored as strings, breaking `float()` calls.
- **Fixes in `routes/bank_redeem.py#export_pending_bank_redeem_excel`**:
  - Query ALL 4 pending collections and merge with robust dedupe (request_id → fallback composite key).
  - Normalize `uid` → `user_id` for legacy chatbot rows.
  - Name resolution chain: `request.user_name` → `users.name` → `request.bank_details.account_holder_name` → `users.bank_details.account_holder_name` → `request.account_holder_name` → "—".
  - **Account Number fallback** across 11 field variants + `users.bank_details` fallback when request lacks bank fields.
  - **IFSC fallback** across 10 variants, uppercased.
  - **Amount fallback** across 6 field names with safe string→float conversion.
  - Preserved color-coded Active/Inactive, IST dates, Total row, frozen header.
- **Verified on preview** (after setting bank_details on a test user):
  ```
  Row 3: 1 | Test User DMT   | 1234567890     | —           | ₹100  | Active | 09-03-2026 16:36 IST
  Row 4: 2 | SANTOSH AVHALE  | 98765432101234 | SBIN0002345 | ₹2000 | Active | 21-03-2026 20:30 IST
  ```

### Eko Failed Transaction Refund — OTP Secured (DONE - April 22, 2026)
- **User request**: "Refund साठी OTP पाठवायचा आहे — Eko failed transaction refund OTP."
- **Security before**: Refund was 1-click (`POST /admin/failed-transactions/refund`). Any admin/manager could refund any transaction instantly — no out-of-band verification. High-risk fraud vector.
- **New backend flow** (`routes/admin_failed_transactions.py`):
  1. `POST /admin/failed-transactions/refund/send-otp` — generates 6-digit OTP via `secrets.randbelow`, binds it to `(admin_id + request_id + amount)` in new `refund_otps` collection with 5-min expiry. Verifies transaction exists and isn't already refunded. Returns email/mobile hint (masked).
  2. `POST /admin/failed-transactions/refund` (updated) — now REQUIRES `otp` in payload. Validates: (a) OTP exists for this admin+request, (b) not expired, (c) not already used, (d) max 5 attempts, (e) amount wasn't tampered between send-otp and verify-refund. On success, marks OTP as `used: true` so it can't be replayed.
- **New `RefundRequest.otp` field** and new `SendRefundOTPRequest` model added.
- **Delivery** (dev/staging): OTP printed to backend stdout (`[REFUND OTP] admin=... OTP=...`) + stored in DB. Production integration note (Resend/SendGrid/MSG91) documented as TODO.
- **Frontend** (`pages/AdminFailedTransactions.js`):
  - Refund modal is now 2-step: amount + reason → **"Send OTP & Continue"** (amber) → OTP entry panel (autofocus, 6-digit, digits-only) → **"Verify OTP & Refund"** (green).
  - Amount/Reason inputs disable during OTP step so no tampering.
  - "Resend OTP" link if user misses it.
  - All fields + buttons have `data-testid` for automation.
- **Verified E2E via curl** (5 assertions all pass):
  1. Send OTP → 200 with email_hint + mobile_hint
  2. Refund without OTP → 400 "OTP required"
  3. Refund with wrong OTP → 400 "Invalid OTP" (attempt counter++)
  4. Refund with correct OTP → 200 "Refunded 1000.0 PRC to user", balance credited
  5. Replay same OTP → 400 "OTP already used"
- **Audit trail**: `refund_otps` collection keeps a permanent record of every OTP issued (who, when, which txn, amount, attempts) — useful for compliance investigations.

### Eko BBPS Refund OTP Integration — REBUILT (DONE - April 22, 2026)
- **User correction**: "मी Eko docs दिली होती — resend-refund-otp आणि refund. तू पुर्वीच admin-side OTP gate बनवला होता — पण तो हवे होते Eko चा native flow."
- **References**:
  - [POST /transactions/{tid}/refund/otp](https://developers.eko.in/v1/reference/resend-refund-otp-1) — Eko resends OTP to customer's mobile
  - [POST /transactions/{tid}/refund](https://developers.eko.in/v1/reference/refund) — Admin posts OTP, Eko refunds eValue to partner wallet

- **Flow replaced** in `routes/admin_failed_transactions.py`:
  1. Previous "admin-local 6-digit OTP to admin's email" flow removed.
  2. `POST /admin/failed-transactions/refund/send-otp` now **proxies directly to Eko** — builds `secret-key`/`timestamp` headers via `generate_headers_for_payment()` from `bbps_services.py`, posts form-urlencoded `{initiator_id, developer_key}` to `{BASE_URL}/transactions/{tid}/refund/otp`. Logs full Eko response in `refund_otps` collection for audit.
  3. `POST /admin/failed-transactions/refund` now has a branch:
     - If txn has `eko_tid` → **requires OTP**, calls `{BASE_URL}/transactions/{tid}/refund` with `{initiator_id, otp, state=1, user_code, developer_key}`. Only credits PRC back after Eko returns `status=0`.
     - If no `eko_tid` (legacy/manual txns) → no OTP required, behaves like before (backward compatible).
  4. On success, stores Eko `refund_tid` on the transaction for future reconciliation.
  5. Audit log now records `action: "eko_refund"` vs `"manual_refund"` and full Eko response.

- **Frontend** (`pages/AdminFailedTransactions.js`):
  - Modal wording updated: "OTP sent to **customer's registered mobile by Eko**. Ask customer to share the 6-digit OTP."
  - Shows Eko TID so admin can cross-reference
  - Button label: "Send OTP to Customer" → "Verify OTP & Refund via Eko"
  - "Resend OTP to customer" link

- **Verified E2E via curl**:
  - (A) Legacy txn without eko_tid → refunded without OTP (backward compatible)
  - (B) Fake eko_tid → send-otp returns `HTTP 400: Eko rejected OTP request (HTTP 404)` (surfaces Eko's real response correctly)
  - (C) eko_tid but no OTP provided → 400 "OTP required for Eko refund"
  - On real production Eko TIDs, the OTP will actually fire to the customer's registered mobile (as per Eko's BBPS flow).

### Bulk Eko Refund OTP (DONE - April 22, 2026)
- **User report (2 screenshots)**: 100+ transactions stuck in "Refund Pending" on Eko Connect portal (DMT/Money Remittance + Mobile/DTH recharges). Bulk OTP needed — one-by-one is impractical.
- **Backend**: New endpoint `POST /admin/failed-transactions/refund/bulk-send-otp` accepting either `request_ids` (looked up in redeem_requests) or `eko_tids` (pasted from Eko Connect). Uses `asyncio.gather` with `Semaphore(5)` for controlled concurrency, calls Eko `POST /transactions/{tid}/refund/otp` per-TID with existing auth headers from `bbps_services.generate_headers_for_payment`. Returns per-TID result (success, http_status, eko_status, message, error) plus sent/failed counts. Persists audit trail to `refund_otps` collection with `bulk: true` flag and summary to `admin_audit_logs` as `bulk_eko_refund_otp`.
- **Frontend**: New admin page `/admin/bulk-refund-otp` (`AdminBulkRefundOTP.js` - 230 lines):
  - Paste-area accepts TIDs separated by lines/commas/spaces/tabs/semicolons — auto-parses and counts valid TIDs (length 6-50).
  - "How to get Eko TIDs" guide card linking to `connect.eko.in/#!/history`.
  - Confirm dialog before dispatching (prevents accidental 500-TID Eko hit).
  - Max 500 TIDs per batch guard rail.
  - Results panel with 3 summary cards (Total / Sent / Failed), expandable tables for Failed (with HTTP status + reason) and Sent (with copy button for each TID).
  - Download CSV button for audit trail.
- **Wiring**: New `bulk-refund-otp` permission in `ALL_ADMIN_PERMISSIONS`, sidebar link under General, route + permission mapping in `App.js` and `AdminLayout.js`. Sidebar screenshot confirms link active.
- **Verified**: Backend bulk endpoint tested with 3 fake TIDs — all 3 correctly returned HTTP 404 from Eko ("Eko rejected"). Real production TIDs from Eko portal will trigger actual OTP SMS to customer mobile.

### Email Case-Insensitive Duplicate Signup Block (DONE - 29 Apr 2026)
- **User report (production)**: PRAFULLA MUKUND KOYANDE thought he "lost" his Elite plan + 1.82 lakh PRC. RCA showed it wasn't lost at all — he had registered TWICE:
  1. Original account: email `Prafullakoyande8@gmail.com` (capital P) + mobile `9769723462` → 1.82L PRC + Elite ✓
  2. Duplicate account (29 Apr): same email lowercased `prafullakoyande8@gmail.com` + mobile `9324183388` → 0 PRC + Explorer (this is what user was logging into and panicking about).
- **Root cause**: `routes/auth.py register_user()` did a literal `find_one({"email": data["email"]})` — case-SENSITIVE. So `Foo@bar.com` and `foo@bar.com` slipped through as separate accounts.
- **Fix** (`routes/auth.py register_user`):
  1. Email is **lowercased BEFORE** storage AND BEFORE duplicate check.
  2. Duplicate check now uses case-insensitive regex anchor (`^email$` with `$options: "i"`) — covers any legacy mixed-case rows.
  3. Helpful error message: `"An account with this email already exists. If this is yours, please log in using mobile number ending in ...XXXX or use the password reset option."` — surfaces the right account's masked mobile.
  4. Added duplicate-mobile block as a defensive double-check.
- **Regression-guarded** with 5 tests in `tests/test_regression_email_case_signup.py`:
  - case-insensitive duplicate-check exists in source
  - email is lowercased before store
  - duplicate mobile is blocked
  - helpful error message includes masked mobile
  - **LIVE integration**: actually signs up two case-variant emails on preview → second is rejected with proper status & message → cleanup wipes test users.
- **Did NOT merge accounts**: per user choice (Option C). Existing duplicate (PRAFULLA's 27 Mar Explorer record) stays. He just needs to log in with mobile `9769723462` to access his Elite + PRC.

### Eko Refund Excel Reconcile — Bug Fix v2 (DONE - Feb 28, 2026)
**Two production bugs found AFTER first reconcile run, both fixed and locked:**

#### Bug 1 — `update_one({"request_id": None})` race
- After production write, only **1 of 4 intended DMT rows** got actually updated. Why? `request_id` was `None` for all 4 rows. `update_one({"request_id": None})` matches the first doc with that match — same query reused for all 4 calls just kept hitting the same doc. The other 3 stayed in `refund_pending`, so the modal kept showing for user 9970100782.
- **Fix**: Reconcile now uses `_id` (Mongo's truly unique key) for the update match, with fallback chain `(_id → eko_tid+user_id → cref+user_id → request_id)`. Includes `_id` in the find projection.
- Added emergency rollback endpoint: `POST /api/recharge/admin/revert-eko-reconcile` — finds all rows with `reconcile_source: "admin_excel_reconcile"` and reverts them to `refund_pending`. Safe `dry_run=true` by default.

#### Bug 2 — Reconcile touched out-of-scope rows
- Admin's Excel was **filtered to only contain Mobile/DTH recharge transactions**. DMT (Money Remittance) rows were NOT in the Excel at all. But reconcile logic naively marked any `refund_pending` DB row as completed if its TID wasn't in Excel's pending list — including DMT rows that Excel never even mentioned. Result: 5 DMT rows would have been wrongly closed.
- **Fix** (3-way logic):
  1. TID **in Excel's "Refund pending" list** → keep `refund_pending` (modal stays).
  2. TID **in Excel but not pending status** → mark `refund_completed` (Eko has refunded externally).
  3. TID **not in Excel at all** → **skip with `skip_out_of_excel_scope`** (out of scope, do not touch).
- New summary field: `skipped_out_of_excel_scope` + per-collection `out_of_scope` count.
- New response field: `total_unique_tids_in_excel` (helps admin verify Excel coverage).
- **Verified on preview** with seeded test rows: `kept_pending=1`, `marked_completed=1`, `out_of_scope=0` (when TIDs are in Excel scope) — exact behavior expected.

#### Production rollback applied
- Reverted the 1 wrongly-updated DMT row from morning's run.
- Awaiting deploy of bug-fix v2 → will re-run reconcile correctly (43 Mobile/DTH kept pending, all DMT rows skipped as out-of-scope).

### Eko Refund Excel Reconcile Endpoint (DONE - Feb 28, 2026)
- **User context**: Periodically the Eko portal updates: many transactions that were "Refund pending" earlier are now actually "Refunded" (Eko has sent the money back to customer's bank). The DB still says `refund_pending` for those, so the self-service refund modal keeps showing for users who already got their money — wrong UX.
- **Goal**: Upload the latest Eko Excel → DB auto-marks rows that are no longer "Refund pending" in Eko as `refund_completed`. Self-service modal stops showing for those users. Modal stays only for users whose TIDs are still in Excel's "Refund pending" state.
- **Backend** (`routes/eko_recharge.py`):
  - New endpoint: `POST /api/recharge/admin/reconcile-eko-refund-pending` (multipart form: `admin_id`, `dry_run`, `file`).
  - Parses the Excel, extracts the set of currently-pending eko_tids + client_ref_ids.
  - Walks every DB row in `status: "refund_pending"` across `recharge_transactions`, `bill_payment_requests`, `dmt_transactions`, `bank_transfer_requests`.
  - If row's eko_tid OR client_ref_id matches Excel's pending set → keep `refund_pending`.
  - If NOT → mark `refund_completed` with `reconcile_note` and `refund_completed_at` timestamp.
  - Returns summary `{kept_pending, marked_completed, skipped_no_eko_tid, by_collection}` + per-row preview (cap 500).
- **Frontend** (`AdminFailedTransactions.js`):
  - New green "Upload Eko Excel → Reconcile" button next to existing "Reconcile Eko Pending Refunds".
  - Two-step UX: dry-run preview first → confirm dialog showing kept/completed counts → actual write.
  - Results panel shows per-collection breakdown + first 50 actions in a collapsible details list.
- **E2E verified**: Uploaded the user-supplied Excel (647 rows, 43 still-pending). Seeded 2 test rows (one with TID matching Excel's pending list, one matching Excel's "Refunded"). Reconcile correctly kept the first as `refund_pending` and marked the second as `refund_completed` with proper reconcile_note. DB state verified post-write.

### Production Bug — `subscription-stats` 404 → "Server is busy" toast (DONE - Feb 28, 2026)
- **User report (production screenshots)**: On `parasreward.com/admin/subscriptions`, all stat cards showed `0` (Explorer/Startup/Growth/Elite) and a "Server is busy. Please try again in a few seconds." red banner appeared at the top of the page AND inside the Reject modal.
- **Root cause**: `get_subscription_stats()` in `server.py:11051` was an **orphaned async function** with NO `@api_router` decorator (third occurrence of this exact bug class — same as `approve_vip_payment`, `reject_vip_payment` earlier today). Frontend called `/api/admin/subscription-stats` → received 404 → axios interceptor converted to "Server is busy" toast.
- **Curl verified on production**: `GET https://www.parasreward.com/api/admin/subscription-stats` → `HTTP 404 {"detail":"Not Found"}` while VIP-payments list returned 200 in 218ms.
- **Fix** (`server.py`):
  - Added `@api_router.get("/admin/subscription-stats")` decorator above `get_subscription_stats()`.
  - Updated revenue formula `799 → 999` to match current Elite pricing.
- **Regression-guarded** with new test #9 in `tests/test_regression_top_redeemers_subscription_card.py`:
  - `test_subscription_stats_endpoint_has_decorator` parses server.py and asserts the decorator exists. Will fail loud if any future agent strips it.
- **Health-check endpoint extended**: `subscription_stats_endpoint` is now check #11 in `/api/admin/health/regression` so this exact regression class is caught BEFORE deploy via the Pre-Deploy Health Check page.
- **Verified on preview**: `/admin/subscription-stats` returns `{total_users: 72, plan_counts: {...}, monthly_revenue: 3096}` in 94ms. Health check now reports 11/11 passed.

### Pre-Deploy Regression Health-Check Endpoint (DONE - Feb 28, 2026)
- **Goal**: One-click smoke test BEFORE clicking "Save to Github → Deploy" to catch regressions like:
  - Top Redeemers leaderboard returning empty (collection name mismatch)
  - User-360 timing out on heavy users (sequential queries hitting K8s ingress 60s)
  - Subscription history sort crashes (datetime/str mix)
  - Admin VIP payments list returning 404 (missing decorator)
- **Backend** (`server.py`): `GET /admin/health/regression?deep=true|false` runs ~10 critical checks in parallel via `asyncio.gather`, each with its own 4–10s timeout. Returns JSON with `overall_status`, `ok_to_deploy`, per-check `{name, status, latency_ms, message}`.
  - Checks include: mongo_ping, top_redeemers_leaderboard, subscription_history_endpoint, vip_payments lists (pending/approved/rejected), pending_count badge, redeem_limits_quick, recharge_transactions_collection, community_feed.
  - Optional `deep` mode adds heavy User-360 lookup on the user with most referrals.
- **Frontend** (`pages/Admin/AdminHealthCheck.js`): clean panel at `/admin/health-check` with:
  - "Run Smoke Test" button + "Deep mode" toggle.
  - Big PASS/FAIL banner (`✓ Ok to deploy` or `✗ Do NOT deploy`).
  - Summary cards (total/passed/warned/failed), per-check rows with latency + message + status pill.
- **Wired into AdminLayout sidebar** under "Controls & Security → Pre-Deploy Health Check" with `health-check` permission added to `ALL_ADMIN_PERMISSIONS` so manager admins can also access.
- **Live verified**: `?deep=false` runs 10 checks in 70ms total. `?deep=true` runs 11 checks in 31ms total. All pass.
- **Regression-guarded**: 3 new tests in `tests/test_regression_top_redeemers_subscription_card.py` (8 total now): the endpoint must always return `ok_to_deploy=true`, and `health-check` permission must remain in the master list.

### Bulk Approve / Bulk Reject Manual Subscription Payments (DONE - Feb 28, 2026)
- **Goal**: Save admin time by approving/rejecting many pending subscription payments in 1 click instead of 2 clicks + wait per row.
- **Backend** (`server.py`):
  - `POST /admin/vip-payments/bulk-approve` — body `{"payment_ids":[...], "admin_id":"...", "notes":"..."}`. Internally calls the canonical `approve_vip_payment` per ID **sequentially** (avoids race conditions when the same user has 2 pending payments). Returns `{results, approved, failed, total}`.
  - `POST /admin/vip-payments/bulk-reject` — body `{"payment_ids":[...], "reason":"...", "admin_id":"..."}`. Calls `reject_vip_payment` per ID **in parallel** via `asyncio.gather` (independent updates). Returns `{results, rejected, failed, total}`.
  - Hard cap: 50 IDs per request (prevent accidental bulk-approve of 1000s).
  - All fraud prevention, GST routing, community success-story hooks, notifications fire identically to single-approve since we reuse the canonical functions.
- **Frontend** (`AdminSubscriptionManagement.js`):
  - Per-row checkbox (pending tab only) at the start of each `PaymentCard`.
  - Bulk action bar above the list with "Select all on page" indeterminate checkbox + "Approve Selected (N)" + "Reject Selected (N)" buttons. Auto-clears selection on tab/page/filter change.
  - Bulk reject opens a modal with a single textarea — same reason applied to all selected.
  - Confirm dialog before bulk-approve. Optimistic removal of successful rows from list. Mixed success/failure surfaces a warning toast + first-failure detail.
- **E2E verified**:
  1. `bulk-approve [P1, P2]` → both approved (2 of 3 in 1.2s), each correctly extends user's expiry by 28 days.
  2. `bulk-reject [P3]` with reason → rejected, reason persisted.
  3. Re-approving an already-approved ID → idempotent (success=True, "Payment already approved").
  4. Empty payment_ids → 400 "payment_ids array is required".
  5. Bulk-reject without reason → 400 "Reject reason is required".
  6. 51 payment_ids → 400 "Cannot bulk-approve more than 50 payments at once".

### Subscription Approve/Reject Stuck-Spinner Fix (DONE - Feb 28, 2026)
- **User issue (video)**: While activating subscription, admin saw "Server is busy" / "Database timeout" banners; reject preset reason failed; ALL rows in pending tab showed spinning loaders simultaneously.
- **Root causes**:
  1. **Visual bug** — `disabled={processing}` & icon switch was a global truthy check on `processing` (which holds payment_id | null). When admin clicked Approve on row-1, ALL rows in the table showed spinning RefreshCw icon. Looked like the entire page was hung.
  2. **No optimistic update** — After a successful approve/reject, the row stayed visible until the slow `fetchData()` refetch completed → admin thought the action failed.
  3. **Tight DB timeouts** — Approve and reject endpoints used 10s `asyncio.wait_for` on Mongo queries. Atlas occasionally slows past 10s during peak load → 504 → "Server is busy" toast even though the real op would have completed at 11–15s.
  4. **Reject endpoint had no timeout protection at all** — bare `find_one` and `update_one` calls; could hang indefinitely.
  5. **Activity log insert failure could fail the whole reject** — wrapped in try/except, best-effort.
- **Fixes**:
  - Frontend `AdminSubscriptionManagement.js`: changed `disabled={processing}` → `disabled={processing === payment.payment_id}` for ALL approve/reject/delete buttons (approved + rejected + pending tabs).
  - Frontend: optimistic remove on approve/reject success — `setPayments(prev => prev.filter(p => p.payment_id !== paymentId))` so the row disappears instantly.
  - Backend `approve_vip_payment`: bumped DB timeouts 10s → 25s on payment fetch, user fetch, user update.
  - Backend `reject_vip_payment`: added 25s `asyncio.wait_for` on `find_one` and `update_one`. activity_log insert wrapped in try/except.
- **Verified**: Reject completes in 140ms with HTTP 200, status persisted correctly.

### Production Regression Fixes — Top Redeemers + Subscription Card (DONE - Feb 28, 2026)
**Two issues reported on production after deploy + protection put in place:**

#### Issue 1 — Top Redeemers leaderboard returned empty `[]`
- **Root cause**: `routes/leaderboard.py` source list referenced collection `recharge_requests` but the actual production collection is `recharge_transactions`. Users who only did mobile/DTH recharges were never picked as candidates → empty leaderboard. Compounded by:
  - No empty-result fallback (if pass-2 reconcile timed out, served `[]` to users).
  - 2-hour cache locked the empty result in for 2 hours.
- **Fix** (`routes/leaderboard.py`):
  - Added `recharge_transactions` to sources (with `amount_inr` field).
  - All sources now use a fallback chain `[primary, fallback1, fallback2]` of field names (handles schema drift across collections).
  - Safety net: if pass-2 reconciliation yields empty, fall back to pass-1 `rough_totals` candidates so leaderboard is never empty when data exists.
  - Empty results no longer cached for full 2-hour TTL — only 60 seconds.
- **Verified**: Endpoint returns 4 ranked users on preview, all PRC totals > 0.

#### Issue 2 — Subscription post in Community feed showed "Mobile Recharge" icon/label
- **Root cause**: `frontend/src/components/SuccessStoryCard.js` `SERVICE_THEME` map had no `subscription` key. Default fallback was `mobile_recharge` → wrong blue gradient, 📱 icon, "Mobile Recharge" label for Elite/Growth subscription wins.
- **Fix** (`SuccessStoryCard.js`):
  - Added `subscription` theme: amber→orange→rose gradient + 👑 icon + "Subscription" label.
  - Chip dynamically appends plan name → "Subscription • Elite".
  - Completion badge text adapts: "Upgraded" for subscriptions, "Successfully Completed" for redeems.
  - "Redeemed till" badge hidden for subscription posts (irrelevant context).

#### Regression protection
- `tests/test_regression_top_redeemers_subscription_card.py` — 6 guards:
  1. `recharge_transactions` must remain in sources list.
  2. Empty-fallback safety-net must exist.
  3. Empty results must not be cached for full TTL.
  4. SERVICE_THEME must have `subscription` entry with label/icon/gradient.
  5. `subscription` icon must be celebratory (👑/🏆/⭐) not phone.
  6. Live integration test asserts endpoint returns non-empty when data exists.

### Manual Subscription Payment Flow — Wired Up & E2E Verified (DONE - Feb 28, 2026)
- **Critical bug found**: `AdminSubscriptionManagement.js` called `/admin/vip-payments` (list), `/admin/vip-payment/{id}/approve`, `/admin/vip-payment/{id}/reject` — all 3 endpoints existed as orphaned functions in `server.py` (no `@api_router` decorator). Entire admin manual subscription approval flow was returning 404.
- **Fixes (`server.py`)**:
  - Added `@api_router.post("/admin/vip-payment/{payment_id}/approve")` decorator on `approve_vip_payment` (line 13176).
  - Added `@api_router.post("/admin/vip-payment/{payment_id}/reject")` decorator on `reject_vip_payment` (line 13651).
  - Fixed `create_notification` kwarg mismatch in reject (was passing `related_id` & `icon` which are not in signature) → switched to canonical `(user_id, notification_type, title, message, data=...)` signature inside try/except.
  - **NEW**: `GET /admin/vip-payments?status=pending|approved|rejected&page=&limit=&search=` — list with FIFO/desc sort, user enrichment, pagination.
  - **NEW**: `GET /admin/vip-payments/pending-count` — pending badge.
  - Side fix: User-360 endpoint sort crash on combined subscription history (`TypeError: '<' not supported between datetime and str`) → normalize to ISO string before sort.
- **E2E test (preview)**:
  1. User `9970100782` submits Payment-1 (Elite ₹799) → `submitted` ✓
  2. User submits Payment-2 (Startup ₹299) → `submitted` ✓
  3. PENDING tab → both visible, total=2 ✓
  4. Admin approves P1 → `success: true`, +28 days added to existing expiry, plan=elite ✓
  5. Admin rejects P2 with reason → `success: true`, reason stored ✓
  6. APPROVED tab → contains P1 with new_expiry, fraud_warning surfaces (recent sub) ✓
  7. REJECTED tab → contains P2 with rejection_reason, rejected_by, rejected_at ✓
  8. PENDING tab → empty ✓
  9. Community success-story post auto-created with plan_name=Elite, tags include `['subscription','success','subscription','elite']` ✓
  10. Activity logs recorded for both approve and reject actions ✓

### Subscription → Community Success Story Auto-Posts (DONE - Feb 28, 2026)
- **Goal**: Whenever a user gets a subscription activated (any path), automatically post a celebratory "Success Story" in the Community Forum.
- **Hooks added**: 
  - `pay_subscription_with_prc` (PRC purchase, immediate only — not upcoming/queued) — already in place.
  - `/admin/razorpay/manual-activate` (admin manual Razorpay activation) — already in place.
  - `/admin/razorpay/sync-pending` (bulk sync) — already in place.
  - **NEW**: `approve_vip_payment` (admin manual UTR/screenshot approval at server.py:13441).
  - **NEW**: `sync_single_razorpay_order` (server.py:10473).
  - **NEW**: `admin_update_user_subscription` (admin manual override at server.py:18398).
  - **NEW**: `check_and_activate_upcoming` in `routes/admin_subscription.py:483` (when an upcoming PRC plan auto-activates after current expires).
- **Hook signature**: `create_success_story_post(user_id, service_type="subscription", amount_inr, plan_name, ref_id="sub_<payment_id>")` — idempotent via ref_id, fire-and-forget via `asyncio.create_task`, errors logged but never raised.
- **Verified**: Direct call produces post `"👑 User from City, State upgraded to Elite!"` with metadata.plan_name and tags `['subscription', 'success', 'subscription', 'elite']`.

### Admin User 360° — 503 Timeout Fix (DONE - Feb 28, 2026)
- **User report**: "Request failed with status code 503" on User 360 page (heavy-network users like SANTOSH with 1196+ active referrals).
- **Root cause**: `/api/admin/user-360` ran 12+ sequential MongoDB queries plus an N+1 loop (one `transactions.find_one` per direct referral up to 50). Total wall-clock easily exceeded the Kubernetes ingress 60s timeout for heavy users → ingress returned 503.
- **Fix** (`server.py /admin/user-360`):
  1. **`active_referrals` N+1 → `asyncio.gather`**: All up-to-50 referral activity probes now fire in parallel.
  2. **Transactions history → `asyncio.gather`**: 7 independent collection queries (orders, bill_payments, gift_vouchers, subscriptions, vip_subscriptions, vip_payments, razorpay_orders) fired in one batch.
  3. **Redeem breakdown → `asyncio.gather`**: 5 independent aggregations (bbps, gift_voucher, bank_transfer, dmt, shop) fired in parallel.
  4. **Failed transactions → `asyncio.gather`**: 3 independent collection queries (bbps, vouchers, bank) fired in parallel.
- **Result**: Wall-clock for primary user-360 endpoint reduced from sum-of-all to max-of-each. Verified on preview: 0.14–0.17s for SANTOSH (10 refs, 137 txns) and Test User DMT (49 txns). No data shape changes — frontend untouched.

### Admin Subscription Management — Approved/Rejected Empty UI Fix (DONE - May 2, 2026)
- **User report**: "Approved data not showing. Check Approved and Rejected." (screenshot showing empty list despite data existing in DB).
- **Root cause (inherited)**: Backend `/admin/vip-payments` was occasionally returning 500/"Server is busy" due to missing MongoDB indexes (fixed earlier this session) + COLLSCANs. On failure, the React component (`AdminSubscriptionManagement.js`) silently left `payments=[]` and rendered "No approved payments" — masking the error.
- **Verification (preview)**: With indexes live, backend returns 5 approved + 4 rejected records in ~135ms. UI now renders them correctly (screenshot captured — GROWTH UPGRADE #5 ₹499, STARTUP RENEWAL #4 ₹299, ELITE UPGRADE #3 ₹1178.82 etc.).
- **Defensive frontend hardening** (`pages/AdminSubscriptionManagement.js`):
  1. **Clear stale state on tab change**: `setPayments([]); setTotal(0); setSelectedIds([])` inside `useEffect` before `fetchData()` fires. Prevents showing the previous tab's rows during the fetch window.
  2. **Surface fetch failures**: If `paymentsRes` promise rejects (timeout / 5xx), show a `toast.error('Failed to load {tab} payments: ...')` instead of silently displaying "No approved payments".
  3. **Loading spinner**: New `data-testid="admin-sub-list-loading"` state with `RefreshCw` spinner + "Loading {activeTab} payments..." text shown while fetch is in flight — replaces the misleading empty-state CheckCircle.
  4. **Payload shape safety**: Accepts both `{payments: [...], total: N}` and raw array responses.

### Admin "Login As User" Impersonation Search — Production Timeout Fix (DONE - May 2, 2026)
- **User report**: Searching a mobile like `9936222482` in the admin "Login As User" dialog on **production** triggers a red "Search failed" toast. Worked fine earlier on lighter DBs.
- **Root cause**: `/api/admin/search-user-for-impersonation` built a single `$or` query with three **case-insensitive** regexes — `{mobile: {$regex: q, $options: "i"}}` + same on `name` + `email`. The `$options: "i"` flag disables index use in MongoDB even when `mobile` is indexed. On a large production users collection this forced a COLLSCAN that exceeded the K8s ingress timeout → axios saw a 5xx/504 → generic "Search failed".
- **Fix** (`routes/admin_misc.py:search_user_for_impersonation`):
  1. **Digit-only fast path**: If `query` has ≥3 digits, issue an index-backed exact match (`mobile == q`, `phone == q`) **and** an anchored prefix regex (`^q`, no `i` flag — uses the mobile/phone index) in parallel via `asyncio.gather`. Each awaited with a **3s `asyncio.wait_for`** cap.
  2. **Email prefix path**: If query contains alpha chars, lowercase + anchored `^` regex on the indexed `email` field (3s cap).
  3. **Bounded name regex**: Only falls back to the slow case-insensitive name regex after exact paths, with a 4s cap and a hard 10-row limit.
  4. **Unified dedupe + max 10 results**: Same doc returned by multiple paths isn't duplicated.
  5. **Exception mapping**: On any exception returns a crisp `500 "Search error: <Type>"` so the UI toast is actionable.
- **Frontend** (`components/AdminLoginAsUser.js`): Error toast now shows the backend's `detail` (`Search failed: <reason>`) instead of a generic string.
- **Verification (preview)**: All cases return in ~100–150 ms — 10-digit exact mobile, 3-digit prefix, email prefix, name regex, and a short-query 400 guard. UI search input populates the result row (e.g. "Test Admin — EXPLORER — 9999999999") without any toast.

### Atlas M10 Scale-Up — Pool + Indexes + Parallel Stats (DONE - May 2, 2026)
- **Context**: Production on MongoDB Atlas M10 with ~6000 live users was throwing timeouts across the admin surface ("Search failed", "mongodb.net:27017: read operation timed out", "Database is slow right now"). Reported with screenshots.
- **Root cause bundle**:
  1. `socketTimeoutMS=12000` was too aggressive for Atlas M10 heavy aggregations (user-360, dashboard stats, vip-payment lists).
  2. `maxPoolSize=100` saturated when multiple admins + API workers hit the DB concurrently — new queries queued behind existing ones.
  3. Several hot collections were missing compound + single-field indexes — COLLSCANs on `vip_payments.payment_id`, `prc_transactions.(user_id,created_at)`, `razorpay_orders.order_id`, etc.
  4. `/admin/subscription-stats` ran 3 independent MongoDB queries sequentially on cold-cache path.
- **Fixes**:
  1. **Connection pool env-configurable** (`server.py`): `maxPoolSize=200` (was 100), `minPoolSize=20`, `socketTimeoutMS=45000`, `serverSelectionTimeoutMS=10000`, `waitQueueTimeoutMS=10000` — all overridable via `MONGO_MAX_POOL_SIZE`, `MONGO_MIN_POOL_SIZE`, `MONGO_SOCKET_TIMEOUT_MS`, etc. in `backend/.env`.
  2. **Startup index creation extended** (`db_indexes.py`): Added 30+ critical compound indexes for `vip_payments` (payment_id unique, utr_number, 6 status+date sort variants, user+status), `prc_transactions` (user+created_at, type+created_at, user+type+created_at), `razorpay_orders` (order_id sparse, user+created_at), `vip_subscriptions` (user+status, expires_at), `success_stories` (ref_id sparse for idempotency), `admin_audit_logs` (action+created_at). Verified 159 indexes created/existing, 0 failed on restart.
  3. **Manual rebuild endpoint extended** (`routes/admin_system.py`): `/admin/db/create-indexes` now mirrors the startup set — safe to re-run anytime. Each `safe_create_index` swallows `IndexKeySpecsConflict` so partial failures never abort the rest.
  4. **`/admin/subscription-stats` parallelized** (`server.py`): The 3 independent queries (plan aggregate, expiring-this-week count, pending vip-payments count) now fire via `asyncio.gather` — cold-cache wall-clock drops from sum-of-all to max-of-each. Hot-cache hit still < 50 ms via 60 s cache.
- **Verified (preview)**: `/admin/subscription-stats` → 719 ms cold, ~40 ms cached. `/admin/vip-payments?status=approved` → 149 ms. `/admin/search-user-for-impersonation?query=9999999999` → 158 ms. `vip_payments` collection index count went from 6 → 17. `prc_transactions` went from 0 → 7. `success_stories`, `razorpay_orders`, `vip_subscriptions`, `admin_audit_logs` all now indexed.
- **Deploy checklist for prod**:
  - Backend restart auto-creates all new indexes (background: true, non-blocking).
  - If you want to tune further per-traffic, set in production `.env`: `MONGO_MAX_POOL_SIZE=300`, `MONGO_SOCKET_TIMEOUT_MS=60000` (upper safety bound).
  - After deploy, one-time trigger of `POST /admin/db/create-indexes` is a safe idempotent belt-and-braces.

### Admin User-360 — Further Parallelization for Atlas M10 (DONE - May 2, 2026)
- **Context**: After the subscription-management timeouts were resolved, User-360 was the next slowest admin screen on production with the same M10 + 6000-user load pattern.
- **What was still sequential** (despite earlier parallelization of transactions/redeem/failed blocks):
  1. Financial stats: `total_mined` → `total_redeemed` (2 awaits).
  2. Referral network: referrer → referrals list → referral_earnings (3 awaits).
  3. Metadata chain: recent_transactions → recent_activities → kyc_docs → login_history → redeem_limit → razorpay_orders_history → vip_payments_history → plan_changes (8 awaits).
  4. Trailing lookups: upcoming_plan → core_team_member → employee_record (3 awaits).
  5. **Critical un-indexed collections**: `admin_actions` (5 docs but scanned on every load), `core_team_members`, `employees`, `redemption_requests`, `dmt_requests` — all had only `_id_` index → COLLSCAN on production.
- **Fixes** (`server.py /admin/user-360` + `db_indexes.py`):
  1. **Stats + Referral prep merged** into a single `asyncio.gather` (5 queries in parallel): `total_mined_agg`, `total_redeemed`, `referrer`, `referrals_list`, `referral_earnings_agg`.
  2. **Metadata batch merged** into a single `asyncio.gather` (8 queries in parallel): recent_transactions, activity_logs, kyc_documents, login_history, redeem_limit, razorpay_orders history, vip_payments history, admin_actions plan_changes.
  3. **Trailing batch merged** into a single `asyncio.gather` (3 queries in parallel): upcoming subscription, core_team membership, employee record.
  4. **Duplicate fetches removed**: the now-parallel subscription history and plan_changes no longer run a second time in the fraud-check block.
  5. **New indexes** (auto-created on startup, belt-and-braces exposed via `/admin/db/create-indexes`):
     - `admin_actions`: `user_id`, `action`, `(user_id, action, timestamp)`, `(user_id, timestamp)`
     - `core_team_members`: `uid`, `(uid, status)`
     - `employees`: `user_id`, `(user_id, status)`
     - `redemption_requests`: `user_id`, `status`, `(user_id, created_at)`
     - `dmt_requests`: `user_id`, `status`, `(user_id, status)`, `(user_id, created_at)`
- **Verified (preview)**: User-360 endpoint timings on heaviest available user (Test User DMT, 49 txns, fraud score 30):
  - Email lookup cold: 239 ms
  - Email lookup warm: 176 ms
  - Mobile lookup: 169 ms
  - UID exact lookup: 195 ms
  - All wall-clocks reduced from max(Σ sequential awaits) to max(individual awaits) — observed ~3-4× speedup on cold-path vs. pre-fix preview timings.
- **Startup log on restart**: `174 indexes created/existing, 0 failed`.

### Daily-Critical Admin Pages — Bulk Optimization (DONE - May 2, 2026)
- **Context**: User requested fast + error-free loads for the 7 most-used admin pages (User-360, Subscription Mgmt, BBPS, Bank Redeem, KYC, Razorpay, Login-As-User). 3 already covered (User-360, Subscription Mgmt, Login-As-User). Remaining 4 + global improvements:
- **Phase 1 — Global**:
  - **GZip middleware** (`server.py`): `GZipMiddleware(minimum_size=512, compresslevel=6)` added — ~60-80% smaller JSON for every admin list page. Verified `content-encoding: gzip` on responses.
- **Phase 2 — BBPS Dashboard** (`routes/unified_redeem_v2.py /admin/bbps-requests`):
  - 3 `count_documents` + 3 `find` queries → single `asyncio.gather` (6 in parallel).
  - **N+1 user enrichment** (50 sequential lookups per page) → 1 batched `$in` query into a `users_by_uid` dict.
  - 6 stats aggregations across 3 collections → single `asyncio.gather`.
- **Phase 2 — Bank Redeem** (`routes/manual_bank_transfer.py /admin/requests`):
  - 4 `count_documents` (total/pending/paid/failed) + 1 `aggregate` → single `asyncio.gather` (5 in parallel).
- **Phase 2 — KYC** (`routes/kyc.py /list`): Already had parallel gather + batch user enrichment + count timeout — left as-is.
- **Phase 2 — Razorpay Revenue Dashboard** (`routes/razorpay_payments.py /admin/revenue-dashboard`):
  - 60 s in-process cache (`_REVENUE_DASHBOARD_CACHE`) — first cold call computes, subsequent admin refreshes return instantly.
  - 2 trailing `count_documents` calls → `asyncio.gather`.
- **New indexes** (auto-startup + idempotent rebuild endpoint):
  - `razorpay_orders`: `paid_at`, `(status, paid_at -1)` — drives revenue date-bucketing.
  - `recharge_transactions`: `user_id`, `status`, `recharge_type`, `created_at`, `request_id` (sparse), `eko_tid` (sparse), `(status, created_at -1)`, `(user_id, created_at -1)`.
  - `bill_payment_requests`: `service_type`, `eko_tid` (sparse), `client_ref_id` (sparse), `(service_type, created_at -1)`, `(status, service_type, created_at -1)`.
  - `redeem_requests`: `service_type`, `eko_tid` (sparse), `client_ref_id` (sparse), `request_id` (sparse), `(service_type, created_at -1)`, `(status, service_type, created_at -1)`.
- **Verified preview timings (all gzipped)**:
  | Page | Cold | Warm |
  |------|------|------|
  | BBPS Dashboard list | 102 ms | 107 ms |
  | Bank Redeem list | 135 ms | 131 ms |
  | KYC list | 102 ms | 108 ms |
  | Razorpay revenue dashboard | 102 ms | 99 ms (cached) |
  | User-360 | 164 ms | 185 ms |
  | Subscription stats | 673 ms | 340 ms (60 s cache) |
  | VIP payments list | 103 ms | 99 ms |
  | Login-As-User search | 113 ms | 144 ms |
- **Startup log**: `195 indexes created/existing, 0 failed`.

### Razorpay Revenue Dashboard — `$facet` Server-Side Aggregation (DONE - May 2, 2026)
- **Context**: Earlier fix added a 60 s cache + parallelized 2 trailing counts, but the cold path still ran `db.razorpay_orders.find({"status": "paid"}).to_list(10000)` followed by a Python loop building all bucket dicts. This scales linearly with paid-order count and pulls up to 10 000 raw documents into Python memory on every cache miss.
- **Fix** (`routes/razorpay_payments.py /admin/revenue-dashboard`): Rewrote using a single MongoDB **`$facet`** aggregation that computes everything server-side:
  1. Stage 1 `$match status:paid` — uses the `(status, paid_at -1)` index.
  2. Stage 2 `$addFields` — parses `paid_at` ISO string once via `$dateFromString` (with `onError:None`).
  3. Stage 3 `$facet` — runs **9 parallel sub-pipelines** in one round-trip: `totals`, `today`, `week`, `month`, `year`, `daily` (last 30 days bucketed via `$dateToString`), `monthly` (last 12 months), `payment_methods`, `plans`.
  4. Aggregation + the 2 count_documents calls fire in `asyncio.gather` — true wall-clock = max-of-each.
  5. Python only does final zero-fill for missing chart buckets and lightweight plan/method bucketing on tens of grouped rows (not thousands of raw orders).
- **Result on preview**: Cold path 151 ms, cache hit ~137 ms (network-bound). On production with thousands of paid orders, the Python loop bottleneck is fully eliminated — wall-clock now scales with grouped row count (~hundreds), not raw order count (~thousands+).
- **Bonus**: `allowDiskUse=True` set so the pipeline never fails on memory limits.

### Subscription-Stats + PRC Analytics — `$facet` & Parallelization (DONE - May 2, 2026)
- **Subscription Stats** (`server.py /admin/subscription-stats`):
  - Combined `users.aggregate(plan_counts)` + `users.count_documents(expiring_this_week)` into a single `$facet` aggregation over `users` (one round-trip instead of two).
  - Added missing `users.subscription_expiry` index (drives the expiring-this-week count) — was COLLSCAN.
  - VIP-payments pending count still parallel via `asyncio.gather` (different collection).
  - 60 s cache retained.
  - Server-side timing (localhost direct): ~257 ms (was 673 ms via preview ingress).
- **PRC Analytics Detailed** (`server.py /admin/prc-analytics/detailed`):
  - Was 7 sequential awaits: current period agg, prev period agg, user stats agg, vip_payments_current `find().to_list(1000)` + Python sum, vip_payments_prev same, chart pipeline, total_user count.
  - Now: all 7 fire in a single `asyncio.gather`. VIP revenue uses server-side `$group $sum` (no 1000-doc Python pull). Chart pipeline runs alongside instead of after.
  - Period-keyed 60 s cache (`admin:prc_analytics:detailed:{period}:v1`) — admin tab switches stay instant.
  - Server-side timing (localhost direct): ~258 ms for `period=month` (was ~1-2 s sequential), ~280 ms for `period=year`.
- **Startup log on restart**: `196 indexes created/existing, 0 failed`.

### Comprehensive Analytics + Members Dashboard + Transactions Indexes (DONE - May 2, 2026)
- **Comprehensive Analytics** (`server.py /admin/analytics/comprehensive`):
  - 5 chart aggregations + top_users were previously sequential — now fire in single `asyncio.gather`.
  - Range-keyed 60 s cache (`admin:analytics:comprehensive:s={start}:e={end}:v1`).
  - Server-side warm cache hit ~250 ms (cache layer overhead from Upstash HTTP — still 50% faster than uncached).
- **Members Dashboard** (`server.py /admin/members/dashboard`):
  - Folded the trailing `last_month_count` query into the same 14-query gather → 15 queries in one round-trip (was 14 + 1 trailing).
  - 90 s cache retained.
  - Warm: ~252 ms.
- **Transactions / PRC ledger / Bank transfer indexes** added to startup (`db_indexes.py`):
  - `transactions`: `timestamp`, `(type, timestamp -1)`, `(transaction_type, timestamp -1)`, `(type, created_at -1)` — drives PRC analytics + chart pipelines.
  - `prc_ledger`: `type`, `entry_type`, `created_at`, `(type, entry_type, created_at -1)`, `(user_id, created_at -1)` — drives daily redeem trend.
  - `bank_transfer_requests`: `processed_at`, `(status, processed_at -1)` — drives bank redeem trend.
- **Final localhost-direct timings (warm cache, after init)**:
  | Page | Time |
  |------|------|
  | Razorpay revenue dashboard | **5 ms** |
  | User-360 | **36 ms** |
  | Members Dashboard | **252 ms** |
  | Comprehensive Analytics | **253 ms** |
  | PRC Analytics Detailed | **245 ms** |
  | Subscription Stats | **242 ms** |
- **Startup log**: `207 indexes created/existing, 0 failed`.

### Production Hot-Fix — User-360 + Impersonation Latency on M10 (DONE - May 2, 2026)
- **Context**: Production smoke test on https://parasreward.com after deploy revealed:
  - `/api/admin/user-360?query=...` consistently 8 s for ALL queries (admin's own + others)
  - `/api/admin/search-user-for-impersonation?query=test` 4.2 s (digit queries fast)
  - Stale `/api/rd/admin/redeem-requests` returning 404 on every admin page load
  - `/admin/db/create-indexes` rebuild endpoint timing out with 504 (>60 s)
- **Root cause #1 (User-360)**: Initial user lookup used a single `$or` query with 5+ conditions mixing exact + regex variants:
  ```
  {"$or": [{"uid": q}, {"mobile": q}, {"email": q.lower()},
           {"referral_code": q.upper()}, {"pan_number": q.upper()},
           {"email": {"$regex": ..., "$options": "i"}}, ...]}
  ```
  Atlas can't use ANY single index for this `$or` mix → COLLSCAN on 6000-user collection → hit the `asyncio.wait_for(timeout=8)` cap every time.
- **Fix**: Replaced with **sequential index-backed attempts** in priority order — uid → mobile → phone → email.lower() → referral_code.upper() → pan_number.upper(). All 6 fire **in parallel** via `asyncio.gather(_try(...))` with 6 s per-attempt timeout; first hit wins. Aadhaar (12-digit / last-4) and case-insensitive regex tried only as last fallback. **Result**: localhost timing 18-42 ms (was 8000 ms+).
- **Root cause #2 (Impersonation name search)**: Bounded name regex used `{"$regex": q, "$options": "i"}` which disables index. On 6000-user DB, matching common substrings like "test" forces COLLSCAN.
- **Fix**: Use existing **`name_text_email_text`** compound text index via `{"$text": {"$search": q}}` — fast, case-insensitive, index-backed. Falls back to anchored prefix regex only if `$text` returns < 5 results. **Result**: localhost 4-9 ms for any name query (was 4200 ms for "test").
- **Frontend hot-fix**: Removed stale `/api/rd/admin/redeem-requests` call from `AdminLayout.js` — endpoint no longer exists in backend, was polluting console + masking real errors.
- **`/admin/db/create-indexes` rewritten** as **fire-and-forget** (`background_mode=true` default) — returns instantly, runs the ~200 idempotent `create_index` calls in `asyncio.create_task` so K8s ingress 60-s timeout never trips. Pass `?background_mode=false` to wait for completion (debug only).
- **Files touched**: `backend/server.py` (`/admin/user-360` lookup rewrite), `backend/routes/admin_misc.py` ($text impersonation search), `backend/routes/admin_system.py` (background-mode index endpoint), `frontend/src/components/layouts/AdminLayout.js` (stale endpoint removal).

### Production Hot-Fix #2 — User-360 In-Process Cache + Frontend Timeout (DONE - May 2, 2026)
- **Context**: Post-deploy production smoke test showed User-360 timing was inconsistent — 1-2 s when warm, but 20-26 s under load (Atlas connection pool saturation under real production traffic). Testing agent (iteration_227) saw browser HTTP 503 from frontend axios interceptor when responses exceeded the 25 s default timeout.
- **Fix #1: 90 s in-process per-uid cache** (`server.py /admin/user-360`):
  - Plain `dict` keyed by `uid` with `time.monotonic()` timestamps. No Upstash REST round-trip overhead (a previous attempt in Apr 2026 found Upstash too slow for this payload).
  - Bounded to 200 entries — admin views ~few dozen users per session. Eviction trims oldest 25 % when bound is hit.
  - Cache fast-path placed right after the user lookup (so search-by-mobile vs. search-by-email both hit the same `uid` cache entry).
  - **Verified locally**: cold 36 ms, warm 5 ms (7× faster). Cache hit by-uid even when query identifier differs.
- **Fix #2: Frontend axios timeout 30 s** (`pages/AdminUser360New.js`):
  - `timeout: 30000` on both User-360 GET requests so a hung Atlas connection never strands the UI in 'Loading user data...' indefinitely.
  - Frontend axios interceptor's auto-retry on 502/503/504 still active for transient blips.
- **Production impact**: Under load the first admin click on a heavy user may still take 1-3 s, but every subsequent click on the same user is instant. Multiple admins navigating each other's profiles benefit from cache sharing on the same backend pod.
- **Files touched**: `backend/server.py` (cache module + integration), `frontend/src/pages/AdminUser360New.js` (timeout: 30000).

### Production Hot-Fix #3 — Global Error Sanitization (DONE - May 2, 2026)
- **Reported issue**: User screenshot of /admin/user360 showed a toast leaking raw Atlas internals: `Search failed: customer-apps-shard-00-01.hfzqpg.mongodb.net:27017: The read operation timed out`. Plus a duplicate inline error card with the same text.
- **Root causes**:
  1. Several backend endpoints (`server.py` ~20 occurrences, plus `routes/*.py`) raise `HTTPException(detail=str(e))` directly — when the `e` is a `pymongo` timeout, the formatted shard hostname leaks into the response body and reaches the admin UI.
  2. `AdminLoginAsUser.js` was rendering `Search failed: ${detail}` verbatim — earlier sanitization regex was only on `AdminUser360New.js`, missing this component.
- **Fixes**:
  1. **Global error sanitization handlers** in `server.py`: Added two FastAPI exception handlers (`@app.exception_handler(Exception)` and `@app.exception_handler(HTTPException)`) that run AFTER all endpoint code. Both call `_sanitize_error_text()` which regex-matches:
     ```
     [a-z0-9-]+-shard-\d+-\d+\.[a-z0-9]+\.mongodb\.net:\d+
     mongodb\.net:\d+
     mongodb://[^\s]+
     the read operation timed out
     server selection timeout error
     connection.*\(closed\)
     ```
     Any match → response body becomes the friendly `"Database is busy right now. Please try again in a few seconds."`. Doesn't change endpoints that already return safe messages.
  2. **`AdminLoginAsUser.js` defensive sanitization**: same regex applied client-side as belt-and-braces (in case backend sanitization is bypassed by a future endpoint). Toast becomes `Search failed: Database is busy right now...`.
  3. **`AdminUser360New.js` enhanced sanitization**: Added patterns for axios timeout errors (`ECONNABORTED`, `timeout of 30000ms exceeded`) so even client-side timeouts show actionable text. Inline pink error card automatically reflects sanitized message via `setError(message)`.
- **Removed stale comment** in `server.py` claiming the User-360 endpoint was cache-free (we now have in-process per-uid cache from Hot-Fix #2).
- **Verified locally**: regex matches all variants of the leaked string. Normal HTTP 200 responses + cached User-360 still work (36 ms warm).
- **Files**: `backend/server.py` (global handlers + comment cleanup), `frontend/src/components/AdminLoginAsUser.js`, `frontend/src/pages/AdminUser360New.js`.

### FINAL Production Verification — Zero Error Goal Achieved ✅ (DONE - May 2, 2026)
- **Testing agent iteration_228 (live https://parasreward.com)**: Forbidden-string scan over 80 polling samples × 6 test scenarios returned **0 hits** for any of: `customer-apps-shard`, `mongodb.net`, `shard-00`, `shard-01`, `27017`, `hfzqpg`, `read operation timed out`.
- **Result**: User's "0 errors on this page" goal is achieved. Even when Atlas returns transient 503s during cold-load of the heaviest admin profile, the spinner remains visible and full data eventually renders — the admin sees only friendly text or successful results.
- **Verified flows (all PASS)**:
  - Admin login via 9696969696 / PIN 969696
  - User-360 initial load: clean (no error toast / card)
  - User-360 admin's own heavy profile: 36 s cold (with internal axios retries) → 2.5 s on cached re-search
  - User-360 not-found query (0000000000): friendly "User not found. Please check your search query." in ~8 s
  - Login-As-User digit search '9696': 4 results in ~0.3 s — no toast
  - Login-As-User name search 'test': 4 results in ~0.3 s — no toast
- **Acceptable known behaviour** (non-blocking):
  - Cold first-load of the admin's own (heaviest) profile takes ~36 s due to Atlas connection warm-up + index-selection on a large data subset. Subsequent calls hit the 90 s in-process cache and return in < 3 s.
  - Two "Search" affordances on the User-360 page (cosmetic) — flagged for future cleanup but does not affect functionality.
- **Closeout summary**: Sanitization layer (server-side global handlers + client-side regex on User-360 + Login-As-User) is robust. No raw Atlas / Mongo internals can reach the admin UI even if a future endpoint forgets to map exceptions properly.

### Production Hot-Fix #4 — Bank Transfer Pending Page Cache (DONE - May 2, 2026)
- **Reported issue**: User screenshots showed Bank Transfer admin page "Failed to load requests" toast and KYC modal "Database is busy" friendly text. Pages were loading 0 stats due to backend timeouts.
- **Root cause**: `/api/bank-transfer/admin/requests` endpoint runs per-user `calculate_redeem_limit_func` enrichment (up to 20 users in parallel × 6-18 s timeout each). On cold Atlas + heavy user data, the gather can hit 22 s wall-clock — exceeding the K8s ingress 60 s soft limit when stacked with multiple admin tabs / users hitting the endpoint simultaneously. Frontend axios saw timeout / 503 → "Failed to load requests" toast.
- **Fixes** (`routes/manual_bank_transfer.py`):
  1. **30 s in-process cache** keyed by full filter set (`status`, `limit`, `skip`, `search`, `date_from`, `date_to`, `sort_by`, `sort_order`, `redeem_min`, `redeem_max`, `never_redeemed`, `subscription_status`, `over_limit_only`). Bounded to 50 entries with LRU-ish eviction.
  2. **Skip redeem-limit enrichment for non-pending tabs** — paid/failed rows don't display the redeem-limit column anyway, so this saves 5-25 s per non-pending tab navigation.
  3. **Reduced per-user enrichment timeout**: 18 s → 6 s (single heavy user can't block whole page).
  4. **Reduced gather timeout**: 22 s → 10 s.
- **Verified locally**: cold 16 ms, cache hit 3 ms (~5× faster on 2nd load). Production cold-load may be slower due to Atlas latency, but every subsequent click within 30 s is instant.
- **Files touched**: `backend/routes/manual_bank_transfer.py` (cache module + integration + enrichment guards).

### Gift Voucher Feature — FULL REMOVAL (DONE - May 3, 2026)
- **User decision**: "Remove this page. Full cleanup related this page." + "Auto reject pending".
- **Production pre-cleanup**: All 3 open pending gift voucher requests (`4f4f1f1d`, `adb3c7d1`, `c8c107f1`) auto-rejected via `/admin/gift-voucher/process` → PRC refunded to user wallets with reason "Gift voucher feature discontinued. PRC refunded to your wallet." Verified via subsequent `status=rejected` query (3/3 found with updated reason).
- **Backend (server.py)**:
  - `POST /gift-voucher/request` → returns HTTP 410 Gone with friendly message "The Gift Voucher feature has been discontinued. Please use Bank Transfer or BBPS recharge instead." Old implementation kept inlined as `_legacy_gift_voucher_request_impl` for historical reference only.
  - `GET /admin/gift-voucher/requests` → 410 Gone (admin list, old body renamed `_legacy_admin_gift_voucher_list`).
  - `POST /admin/gift-voucher/process` → 410 Gone (approve/reject, old body renamed `_legacy_admin_gift_voucher_process`).
  - `GET /gift-voucher/requests/{user_id}` → **KEPT LIVE** (users can still see their past requests in account history; no new ones can be created).
  - Historical readers in `server.py` and analytics endpoints left untouched (preserves audit trail and P&L reporting of past gift voucher revenue).
- **Frontend cleanup**:
  - `/app/frontend/src/pages/AdminGiftVouchers.js` → **file deleted**.
  - `App.js`: lazy import line replaced with a comment; `/admin/gift-vouchers` Route replaced with `<Navigate to="/admin" replace />` so any bookmark is silently redirected.
  - `components/layouts/AdminLayout.js`: sidebar nav item removed (including pending-count badge); `pendingCounts.gifts` key + polling axios call dropped; path-to-key map entry + route map entry removed.
  - `pages/AdminServiceCharges.js`: Gift Voucher percentage/fixed config card and all related state (`giftVoucherConfig`, `setGiftVoucherConfig`, `save('gift_voucher')` handler branch) removed. Bill Payment card stays fully functional.
- **Result**: 0 references to live gift-voucher UI; 3 backend endpoints return 410; 1 historical read endpoint kept; lint clean; smoke-test screenshot confirms admin sidebar + dashboard render correctly.
- **DB collection `gift_voucher_requests`**: **preserved** (audit trail) — no drop or purge performed.

### Eko Direct Services Admin Page — REMOVED (DONE - May 3, 2026)
- **User decision**: "हे pण page full cleanup पाहिजे" + pointed at 'Eko Direct Services' in sidebar (highlighted in blue).
- **What it was**: A no-approval-required direct Eko API admin tool (`/admin/eko-services`) exposing direct DMT transfer, mobile/DTH recharge, bill pay, and wallet balance check — all via the same backend endpoints the regular user-facing BBPS/DMT flow uses.
- **Cleanup** (frontend only — backend endpoints SHARED with user-facing flows, not removed):
  - `/app/frontend/src/pages/AdminEkoServices.js` → **file deleted**.
  - `App.js`: lazy import + Route both removed. Route replaced with `<Navigate to="/admin" replace />` so any bookmark silently redirects.
  - `components/layouts/AdminLayout.js`: sidebar nav item removed; `serviceName` key map entry removed; path → key map entry removed.
- **Backend unchanged**: `/eko/balance`, `/eko/recharge`, `/eko/bbps/paybill`, `/admin/bank-redeem/verify-account`, `/admin/eko/dmt-transfer` all remain live — they're used by user-facing BBPS, DMT, and recharge flows. Removing them would break the live users' recharge feature.
- **Smoke-test verified** via Playwright: dashboard renders, sidebar clean (no "Eko Direct Services", no "Gift Vouchers"), BBPS Instant preserved, direct URL redirects to `/admin`, no compile/lint errors.

### Subscription Plans Cleanup — Keep Only Explorer + Elite (DONE - May 3, 2026)
- **User decision**: "Clean up Subscription plans. Keep ONLY Explorer and Elite. Do not touch them. Clean up all others." + "Startup किंवा growth प्लान वरती आता कोणताच युजर नाही" (confirmed no existing users on Startup/Growth so no legacy migration needed).
- **Backend (`server.py`)**:
  - `POST /api/subscription/payment/{uid}` (line 11285): now rejects any plan other than `elite` with 400 "Invalid plan selected. Only Elite plan is available."
  - `POST /api/subscription/upgrade/{uid}` (line 12688): admin upgrade endpoint now accepts only `explorer` or `elite`.
  - `GET /api/subscription/plans`: already filtered by `ACTIVE_SUBSCRIPTION_PLANS = ["explorer","elite"]` — confirmed via curl (returns exactly those 2 plan IDs).
  - `SUBSCRIPTION_PLANS` dict left intact with `_legacy_startup`/`_legacy_growth` entries carrying `treat_as:"elite"` for any future legacy data safety.
- **Frontend**:
  - `AdminDashboard.js` (L526-562): Subscription Overview grid reduced from 4 cards → 2 cards (Explorer + Elite). Elite card price updated to "₹999 + GST".
  - `AdminSubscriptionManagement.js`:
    - Stat cards: only Explorer + Elite (removed Startup/Growth cards and unused `Rocket`/`TrendingUp` imports).
    - Plan filter dropdown: `All Plans / Explorer / Elite` only.
    - `EditModal` plan select: only `Elite` option.
    - `UserSubscriptionEditor` "New Plan" dropdown: only `Explorer (Free)` + `Elite (₹999 + GST)`.
    - `PaymentCard.planColors` trimmed to explorer + elite.
    - EditModal default `plan` is now `elite` (was `startup`).
    - Current-plan badge colours collapsed to Elite (amber) vs default (slate).
  - `ProfileAdvanced.js` (L545-566): `hasPaidPlan` + `getPlanDisplayName` + `getPlanGradient` simplified. Legacy `startup/growth/vip/pro` users (if any exist in data) are displayed as "Elite" with amber gradient (graceful fallback).
  - `PublicProfile.js` (L171, L186): avatar gradient + Crown badge now triggered for Elite or any legacy paid plan.
  - `SubscriptionPlans.js`: already only referenced `explorer`/`elite` — no change needed.
- **Tests** (`/app/backend/tests/test_subscription_plans_cleanup.py`): 13/13 PASSED end-to-end against live preview URL — plan list endpoint, submit-payment rejection of startup/growth/explorer, submit-payment acceptance of elite, admin upgrade rejection of startup/growth/junk, admin upgrade acceptance of explorer/elite, and regression auth/health checks.
- **Follow-up (defensive, not blocking)**: many $facet/aggregation pipelines in `server.py` still use `$in: ["startup","growth","elite"]` filters for historical/analytics queries — left intact since they only read data; no new users can reach those plan states.

### V1 Refund OTP — Full E2E Code Audit + Test Suite (DONE - May 3, 2026)
- **User concern**: "बरेच युजर्स म्हणतात की आम्हाला otp mobile वरती येत नाही" — many production users complain refund OTP not received on mobile after a recharge/bill-pay failure puts the txn in `refund_pending`.
- **Code audit findings** (`backend/routes/eko_recharge.py` lines 1495-2110):
  - V1 endpoint URL/body/headers ALL match Eko official docs (https://developers.eko.in/v1/reference/resend-refund-otp-1) — `POST {BASE}/v1/transactions/{tid}/refund/otp` with `initiator_id` + `developer_key` form-encoded body, plus `developer_key`/`secret-key`/`secret-key-timestamp` headers via `_build_eko_headers()`.
  - `EKO_USER_CODE` auto-correction (`19560001` instead of docs sample `20810200`) is in place via inline check at module load + `eko_credentials.py` helper module.
  - Eko's "silent success" quirk (`status:0`, `data:{tid:"",otp_ref_id:""}`) is correctly classified as success in our code.
  - Production "OTP not received" complaint is most likely **Eko-side SMS delivery delay/failure** — not a code bug. Our code correctly logs every send/verify attempt to `eko_refund_logs` for audit, with rate limit (5 sends/hour/TID/user).
- **Bug found + fixed**: In `user_verify_refund_otp`, the `success` field could leak an empty string (instead of `False`) when Eko returned `data.tid=""` due to short-circuit `and` chain returning `""`. Wrapped in `bool(...)` so the public response always carries a boolean.
- **New test suite** (`/app/backend/tests/test_refund_otp_v1_e2e.py` — 13/13 PASSED):
  - Production-SMS happy path (Eko empty data, no inline OTP, template-token message normalised)
  - Staging inline-OTP auto-completion path (Eko returns OTP inline → server self-calls V2 refund and credits PRC)
  - Invalid TID → friendly error, audit log written, counts toward rate limit
  - Rejects request when txn is not currently `refund_pending`
  - Rejects request when txn belongs to a different user
  - Rejects request when txn has only `client_ref_id` and no numeric `eko_tid` (Excel-imported rows)
  - Rate-limit kicks in after 5 OTP-send attempts within 1 hour
  - Pins exact V1 request shape (URL, body, headers) — guards against contract drift
  - Verify happy path → marks `refunded`, increments user `prc_balance` by stored `total_prc_deducted`
  - Verify wrong OTP → response success=False, txn stays `refund_pending`, failed audit log
  - Verify with no numeric eko_tid → friendly error
  - Pending refunds endpoint respects the global `refund_blocker_modal_enabled` kill switch (returns empty when disabled)
  - Pending refunds endpoint surfaces rows when kill switch is enabled
- **All Eko HTTP calls mocked with `respx`** (added to `requirements.txt` indirectly — installed via `pip install respx`). No real Eko traffic in tests.
- **Recommended next step (NOT done — needs user decision)**: Add a "Resend OTP after 60s" button on the user-facing refund modal. If after 3 resends the user still hasn't received SMS, surface a "Contact Support" CTA so users aren't stuck. Eko itself has no SMS-delivery confirmation API, so we can't programmatically detect SMS failure.

### Refund OTP Deep Bug Fix + Community Forum Gating + Moderation (DONE - May 3, 2026)

**🚨 Refund OTP Deep Fix (Production: "बरेच users ना OTP येत नाही"):**
- **Root cause** (git blame `fa9d7201` April 28): success-detection logic was relaxed from
  `(response_status_id==0 AND data.tid OR data.otp_ref_id non-empty)` →
  `(status==0 AND no invalid_params)`. This **REMOVED Eko's silent-failure detection**
  — Eko returns `status:0` even when SMS is silently dropped (e.g. user_code mismatch,
  rate-limit, customer mobile invalid). Old code rejected those; April 28 onwards code
  reported success but no SMS arrived.
- **Fix** (`backend/routes/eko_recharge.py` user_process_refund + verify):
  - Three-bucket classification: HARD_FAIL / CONFIRMED_SEND / AMBIGUOUS_SEND.
  - CONFIRMED requires non-empty `data.tid` OR `data.otp_ref_id` (Eko docs schema).
  - AMBIGUOUS = status:0, no invalid_params, message says "OTP...sent", but data empty.
    Returns `success:true, delivery_confirmed:false` so frontend shows softer "Try
    again in 60s / contact support" hint instead of plain "OTP sent".
  - Audit log writes `result="ambiguous"` + full Eko response payload to
    `eko_refund_logs.eko_full_response` so admins can triage SMS failures with
    raw Eko data.
- **Frontend** (`RefundBlockerModal.js`): consumes `delivery_confirmed=false` to
  show amber warning banner above OTP input + softer toast.
- **Tests** (`test_refund_otp_v1_e2e.py`): 15/15 PASS — happy path (confirmed),
  ambiguous silent-failure (NEW), no-data-no-msg failure (NEW), invalid TID,
  wrong status, wrong user, missing eko_tid, rate-limit, V1 contract pinning,
  verify happy/wrong-OTP, kill-switch on/off, etc. All Eko HTTP mocked via `respx`.

**🛡️ Community Forum Hardening:**
- **Explorer block** (`assert_can_interact` helper in `community.py`): Free /
  Explorer users now get `403 "Upgrade to Elite to interact with the community"`
  on EVERY interactive endpoint — create_post, comment, like, react, bookmark,
  comment-like. Admins + moderators always allowed.
- **Two-tier content moderation** (`backend/routes/community_moderation.py`):
  - **Tier 1 — keyword blacklist**: English profanity, romanised Hindi/Marathi
    (chutiya, madarchod, bhenchod, etc.), Devanagari (चूतिया, मादरचोद, etc.),
    URL spam (≥3 links in <400 chars), shouting+punctuation patterns.
    Boundary-aware regex, single compile, ~microsecond latency.
  - **Tier 2 — Gemini 2.5 Flash classifier** (Emergent Universal LLM Key):
    Called only for posts ≥25 chars that pass Tier 1. JSON output schema
    `{category, reason}` parsed defensively (strips code fences, regex-matches
    first JSON object). On AI error → fallback to "clean" so a broken LLM key
    never blocks the feature.
  - Negative/spam verdicts → 400 + friendly user message; post NEVER inserted
    (effective hard delete of would-be content). Audit log written to
    `community_moderation_logs` with full title/content preview + tier/category.
  - Admins + moderators bypass moderation entirely.
- **Tests** (`test_community_gating_and_moderation.py`): 19/19 PASS — Explorer
  blocked on all 5 interactions, Elite/Admin/Mod allowed, Tier-1 catches
  English+Hindi+Marathi profanity (romanised + Devanagari) + URL spam, Tier-2
  AI mocked verdict path, AI-failure fallback to clean, audit log persistence,
  comment-level moderation, admin moderation bypass.

**Combined test summary**: 47/47 PASS across refund OTP (15) + subscription
cleanup (13) + community gating/moderation (19) — all backend route handler
tests on a single `pytest` run.

## Upcoming Tasks
- P1: HRMS Reporting Phase D — Email salary slips/Form 16 (needs Resend/SendGrid)
- P1: Invoice PDF Download
- P1: Run Notification Script for 606 "Over Limit" failed bank-redeem users
- P2: WhatsApp Share Receipt

## Future/Backlog
- P2: server.py monolith refactor
- P3: MongoDB -> PostgreSQL migration
