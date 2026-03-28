# PARAS REWARD - Product Requirements Document

## ✅ DEPLOYED - 19 March 2026
## 📝 LAST UPDATED - 28 March 2026 (P0 Mining Collect Bug Fixed & Verified)

## ✅ COMPLETED: Mining Collect P0 Bug Fix - 28 March 2026
- Fixed frontend using deprecated `/api/mining/claim` → correct `/api/mining/collect`
- Verified with 14 automated tests (iteration_149): Start → Collect → Balance Update → Session Reset
- Translation key `processing` added to LanguageContext.js

## ✅ COMPLETED: Auto-Start Session After Collect - 28 March 2026
- Backend `/api/mining/collect` now auto-starts a new session after collecting PRC
- Returns `auto_started: true`, `new_session_start`, `new_session_end` in response
- Frontend handles auto-start: keeps mining UI active with fresh 24h timer
- No manual "Start Session" click needed after collect

## ✅ COMPLETED: Login Two-Step Flow Fix - 28 March 2026
- Fixed: PIN input was appearing while user typed ID (auto-debounce triggering check-auth-type)
- New flow: Step 1 (ID only) → Click Sign In → DB verify → Step 2 (PIN input)
- Non-existent users get "Account Not Found" error, PIN never shown
- "Change" button on Step 2 to go back to ID input
- Added ✅/❌ visual icons next to ID field for instant feedback
- File: `/app/frontend/src/pages/LoginNew.js`

## ✅ COMPLETED: Dynamic Redeem Limit System - 28 March 2026
- Replaced old DEPRECATED unlimited system with Growth Network based dynamic limits
- Formula: Unlock% = min(Level × 10, AdminMaxCap), Redeemable = TotalEarned × Unlock%
- Available = max(0, Redeemable - TotalRedeemed), capped at current balance
- Level tiers (cumulative users): L1:2, L2:6, L3:14, L4:30, L5:62, L6:126, L7:254, L8:454, L9:654, L10:800 → 10% per level
- Admin max cap default 70%, configurable
- Single unified limit across all pages (removed category-wise limits)
- New UnifiedRedeemLimit component with progress bar, stats grid, next level hint
- 17 backend tests passed (iteration_150)
- Deep scan: 10 collections with redeem data (redeem_requests, bank_transfer_requests, gift_voucher_requests, bill_payment_requests, dmt_transactions, chatbot_withdrawal_requests, transactions, wallet_transactions, prc_transactions in users, prc_burns)
- Files: server.py (calculate_user_redeem_limit, check_redeem_limit), growth_economy.py (calculate_growth_level, get_user_unlock_percent), CategoryLimitsDisplay.js (rewritten)
- Root cause: `/api/user/{uid}` had 2-min cache AND `/api/user/{uid}/dashboard` had 60s cache. Mining collect didn't invalidate either.
- Fix: Both caches (`user_data:{uid}` + `user:dashboard:{uid}`) invalidated after mining start and collect
- Added `onBalanceUpdate` callback from App.js → Mining.js for immediate global state + localStorage update
- Result: PRC balance now matches instantly across Mining page, Dashboard, Profile, all pages

## ✅ COMPLETED: Growth Economy System - 26 March 2026
```
╔════════════════════════════════════════════════════════════════╗
║  GROWTH ECONOMY SYSTEM - FULLY IMPLEMENTED                     ║
║                                                                 ║
║  1. MINING FORMULA (Per User - Decreasing)                     ║
║     • R(U) = max(3, 8 - 0.5 × log₂(U))                        ║
║     • Daily PRC = 550 + (U × R(U))                             ║
║     • Subscription: Cash=100%, PRC=70% speed                   ║
║                                                                 ║
║  2. GROWTH NETWORK (Referral Capacity)                         ║
║     • Network Cap = min(4000, 800 + 16×D)                      ║
║     • No MLM commission - capacity increase only               ║
║                                                                 ║
║  3. REDEEM SYSTEM (Dynamic PRC Rate)                           ║
║     • Total = Redeem + Burn(5%) + Processing(₹10) + Admin(20%) ║
║     • All converted to PRC at dynamic rate                     ║
║                                                                 ║
║  4. ADMIN CONTROLS                                              ║
║     • Redeem %: 50/60/70/80/100 (Default 70%)                  ║
║     • Burn Rate: Default 5%                                     ║
║     • Processing Fee: ₹10 (converted to PRC)                   ║
║     • Admin Charges: 20% of PRC                                ║
║     • PRC Rate: Manual override or dynamic                      ║
║                                                                 ║
║  5. MLM-FREE TERMINOLOGY                                        ║
║     • Single Leg → Growth Network                               ║
║     • Downline → Network Members                                ║
║     • Team Size → Network Size                                  ║
║                                                                 ║
║  NEW APIs:                                                       ║
║  • GET /api/growth/economy-settings                             ║
║  • GET /api/growth/prc-rate                                     ║
║  • GET /api/growth/mining-speed/{user_id}                       ║
║  • GET /api/growth/network-stats/{user_id}                      ║
║  • POST /api/growth/calculate-redeem                            ║
║  • POST /api/growth/calculate-redeem-inr                        ║
║  • POST /api/growth/admin/economy-settings                      ║
║  • POST /api/growth/admin/set-prc-rate                          ║
║                                                                 ║
║  NEW FILES:                                                      ║
║  • /app/backend/routes/growth_economy.py                        ║
║  • /app/frontend/src/pages/Mining.js (updated)                  ║
║  • /app/frontend/src/pages/ReferralsEnhanced.js (updated)       ║
║  • /app/frontend/src/pages/AdminEconomySettings.js              ║
║                                                                 ║
║  TESTING: 100% passed (27/27 tests)                             ║
╚════════════════════════════════════════════════════════════════╝
```

## ✅ COMPLETED: GST Collection Summary Widget - 26 March 2026
```
╔════════════════════════════════════════════════════════════════╗
║  GST COLLECTION SUMMARY WIDGET - IMPLEMENTED                   ║
║                                                                 ║
║  FEATURES:                                                      ║
║  • Total GST Collected display                                  ║
║  • Today / This Week / This Month breakdown                     ║
║  • 30-Day Trend Bar Chart                                       ║
║  • Source Breakdown (PRC vs Manual Subscriptions)               ║
║  • Recent GST Transactions list                                 ║
║                                                                 ║
║  NEW API:                                                        ║
║  • GET /api/admin/gst-summary                                   ║
║                                                                 ║
║  NEW FILES:                                                      ║
║  • /app/frontend/src/components/GSTSummaryWidget.js             ║
║  • Added to AdminDashboard.js                                   ║
╚════════════════════════════════════════════════════════════════╝
```

## ✅ COMPLETED: Manual Subscription Pricing Update - 26 March 2026
```
╔════════════════════════════════════════════════════════════════╗
║  MANUAL SUBSCRIPTION PRICING - IMPLEMENTED                     ║
║                                                                 ║
║  NEW FORMULA: ₹999 + 18% GST = ₹1178.82                        ║
║                                                                 ║
║  APPLIES TO:                                                    ║
║  • Manual (Bank Transfer/UPI) payments                         ║
║  • Razorpay payments (from April 1, 2026)                      ║
║                                                                 ║
║  PRICING BREAKDOWN:                                             ║
║  • Monthly:     ₹999 + ₹179.82 GST  = ₹1,178.82                ║
║  • Quarterly:   ₹2,997 + ₹539.46 GST = ₹3,536.46               ║
║  • Half-Yearly: ₹5,994 + ₹1,078.92 GST = ₹7,072.92             ║
║  • Yearly:      ₹11,988 + ₹2,157.84 GST = ₹14,145.84           ║
║                                                                 ║
║  GST ROUTING:                                                   ║
║  • When admin approves manual payment:                          ║
║    - GST Amount → gst_collection wallet                         ║
║    - Base Amount → subscription wallet                          ║
║                                                                 ║
║  PRC SUBSCRIPTION (Different Formula):                          ║
║  • ₹999 + 18% GST + ₹10 Processing + 20% Admin Charges          ║
║  • Already implemented in previous session                      ║
║                                                                 ║
║  NEW APIs:                                                       ║
║  • GET /api/vip/plans - All VIP plans with GST breakdown        ║
║  • GET /api/subscription/manual-pricing - Manual pricing info   ║
║  • GET /api/subscription/plans - Updated with new pricing       ║
║                                                                 ║
║  NEW FUNCTIONS:                                                  ║
║  • calculate_manual_subscription_price() - Pricing calculator   ║
║  • get_vip_plan_pricing() - Single plan pricing                 ║
║  • get_all_vip_plans() - All plans with pricing                 ║
║  • credit_company_wallets_for_manual_subscription() - GST route ║
╚════════════════════════════════════════════════════════════════╝
```

## ❌ REMOVED FEATURES - 25 March 2026
```
╔════════════════════════════════════════════════════════════════╗
║  FEATURES REMOVED (User Requested - Fresh Implementation)      ║
║                                                                 ║
║  1. MINING FORMULA - Completely removed                         ║
║     • mining.py deprecated                                      ║
║     • mining_economy.py deprecated                              ║
║     • calculate_mining_rate() returns 0                         ║
║     • Mining.js shows "Feature Removed" notice                  ║
║                                                                 ║
║  2. REFERRAL BONUS - Completely removed                         ║
║     • referral.py deprecated                                    ║
║     • Bonus calculations disabled                               ║
║     • Referral code kept for sharing only                       ║
║                                                                 ║
║  3. SINGLE LEG BONUS - Removed                                  ║
║     • Single leg calculations removed from mining               ║
║                                                                 ║
║  4. LEVEL BONUS (L1, L2, L3) - Removed                          ║
║     • get_multi_level_referrals() returns empty                 ║
║     • count_active_referrals_by_level() returns zeros           ║
║     • Level bonus percentages disabled                          ║
║                                                                 ║
║  5. REDEEM LIMIT - Removed                                      ║
║     • redeem_categories.py deprecated                           ║
║     • calculate_user_redeem_limit() returns unlimited           ║
║     • All redemptions now unlimited (subject to PRC balance)    ║
║                                                                 ║
║  Note: Database data preserved for rollback if needed           ║
╚════════════════════════════════════════════════════════════════╝
```

## ⏳ AWAITING: Fresh Requirements from User
- Mining Formula
- Referral Bonus
- Single Leg
- Level Bonus (L1, L2, L3)
- Redeem Limit

## ✅ COMPLETED: Razorpay Admin Enhancements - 25 March 2026
```
╔════════════════════════════════════════════════════════════════╗
║  RAZORPAY ADMIN FEATURES - IMPLEMENTED                         ║
║                                                                 ║
║  1. REVENUE DASHBOARD                                          ║
║     • Today/Week/Month/Year revenue cards                      ║
║     • Payment method breakdown (UPI/Card/NetBanking)           ║
║     • Plan-wise revenue breakdown                              ║
║     • 30-day bar chart visualization                           ║
║     • Success rate statistics                                  ║
║                                                                 ║
║  2. DATE RANGE FILTER                                          ║
║     • Filter orders by From/To date                            ║
║     • Shows filtered revenue total                             ║
║     • Clear filters button                                     ║
║                                                                 ║
║  3. INVOICE GENERATION                                         ║
║     • Professional invoice with GST breakdown                  ║
║     • Company & customer details                               ║
║     • HSN/SAC codes for compliance                             ║
║     • Print/Download functionality                             ║
║                                                                 ║
║  4. REFUND PROCESSING                                          ║
║     • Initiate refunds via Razorpay API                        ║
║     • Full or partial refund support                           ║
║     • Admin PIN verification                                   ║
║     • Refund status tracking                                   ║
║                                                                 ║
║  5. ENHANCED SEARCH                                            ║
║     • Search by UTR/RRN number                                 ║
║     • Search by UPI ID                                         ║
║     • Search by amount                                         ║
╚════════════════════════════════════════════════════════════════╝
```

## ✅ COMPLETED: Admin Light Theme (Bulkpe Style) - 25 March 2026
```
╔════════════════════════════════════════════════════════════════╗
║  ADMIN LIGHT THEME - COMPLETELY IMPLEMENTED                    ║
║                                                                 ║
║  As per user request, all admin pages now have a clean,        ║
║  light (white) theme matching the Bulkpe design style.         ║
║                                                                 ║
║  FILES UPDATED:                                                 ║
║  • AdminBankTransfers.js - Full light theme conversion         ║
║  • AdminGiftVouchers.js - Header fixed to white                ║
║  • AdminPendingRequests.js - Background fixed to white         ║
║  • AdminUser360New.js - Cards fixed to white                   ║
║  • ErrorMonitor.js - Background fixed to white                 ║
║  • admin-theme.css - Light theme CSS variables                 ║
║  • AdminLayout.js - Master layout with light theme             ║
║  • AdminDashboard.js - Main dashboard light theme              ║
║  • AdminMembers.js - Members page light theme                  ║
║  • public/index.html - Removed hardcoded dark background       ║
║                                                                 ║
║  THEME CLASSES USED:                                            ║
║  • Background: bg-white, bg-slate-50                           ║
║  • Borders: border-slate-200, border-slate-300                 ║
║  • Text: text-slate-900, text-slate-700, text-slate-500        ║
║  • Cards: bg-white border-slate-200 shadow-sm                  ║
║  • Status badges: Pastel colors (green-100, yellow-100, etc.)  ║
╚════════════════════════════════════════════════════════════════╝
```

## ❌ REMOVED: PRC Burning Module (25 March 2026)
```
╔════════════════════════════════════════════════════════════════╗
║  PRC BURNING MODULE - COMPLETELY REMOVED                       ║
║                                                                 ║
║  As per user request on 25 March 2026, the entire PRC burning  ║
║  system has been permanently removed from the application.     ║
║                                                                 ║
║  WHAT WAS REMOVED (~1100 lines of code):                        ║
║  • All burn functions (calculate_and_apply_burn, daily_burn)   ║
║  • Burn scheduler jobs (hourly burn, inactive user burn)       ║
║  • Burn API endpoints (now return {deprecated: true})          ║
║  • AdminAccountingDashboard burn tab                           ║
║  • Burn statistics and controls                                ║
║                                                                 ║
║  NEW BEHAVIOR:                                                  ║
║  • PRC has LIFETIME validity (no expiry, no burn)              ║
║  • All burn endpoints return: {deprecated: true, message: ...} ║
║  • No automatic PRC deduction for inactivity                   ║
║                                                                 ║
║  DEPRECATED ENDPOINTS (return deprecated response):            ║
║  • GET/POST /api/admin/burn-statistics                         ║
║  • GET/POST /api/admin/prc-burn-control/*                      ║
║  • POST /api/admin/run-prc-burn                                ║
║  • POST /api/admin/smart-burn                                  ║
║  • POST /api/admin/run-explorer-burn                           ║
║  • GET /api/admin/burn-settings                                ║
║  • POST /api/admin/accounting/burn-inactive-prc                ║
╚════════════════════════════════════════════════════════════════╝
```

## ✅ NEW: PRC Restoration for Zero-Balance Users (20 March 2026)
```
╔════════════════════════════════════════════════════════════════╗
║  NEW ADMIN ENDPOINT: POST /api/admin/restore-zero-balance-prc  ║
║                                                                 ║
║  PURPOSE: Restore PRC for users whose balance became 0 after   ║
║           subscription expiry (auto-correction bug)             ║
║                                                                 ║
║  PARAMS:                                                        ║
║  • dry_run=true  → Preview changes (default)                    ║
║  • dry_run=false → Apply restorations                           ║
║  • limit=500     → Max users to process                         ║
║                                                                 ║
║  DATA SOURCES (priority order):                                 ║
║  1. prc_corrections_log collection (balance before correction)  ║
║  2. user.prc_before_correction field (fallback)                 ║
║                                                                 ║
║  LOGS CREATED:                                                  ║
║  • prc_restorations_log - audit trail                          ║
║  • transactions - admin_restore type                            ║
╚════════════════════════════════════════════════════════════════╝
```

## ⚠️ IMPORTANT: TWO-PLAN SYSTEM ONLY ⚠️
```
╔════════════════════════════════════════════════════════════════╗
║  ACTIVE PLANS (March 2026 onwards):                            ║
║  ┌─────────────┬─────────────┐                                 ║
║  │  EXPLORER   │    ELITE    │                                 ║
║  │   (FREE)    │   (PAID)    │                                 ║
║  │  ₹0/month   │  ₹799/month │                                 ║
║  └─────────────┴─────────────┘                                 ║
║                                                                 ║
║  ❌ NO MORE: VIP, Startup, Growth, Pro                         ║
║  ✅ Legacy users (Startup/Growth/VIP) → Treated as Elite       ║
╚════════════════════════════════════════════════════════════════╝
```

## ⚠️ IMPORTANT: PRC FIELD STANDARDIZATION (March 2026)
```
╔════════════════════════════════════════════════════════════════╗
║  STANDARD FIELD: total_prc_deducted                            ║
║                                                                 ║
║  LEGACY FIELDS (handled via get_prc_amount() helper):          ║
║  • prc_used - old bill_payment_requests                        ║
║  • prc_deducted - old bank transfers                           ║
║  • prc_amount - generic legacy field                           ║
║  • total_prc - orders                                          ║
║                                                                 ║
║  Helper: /app/backend/utils/prc_fields.py                      ║
║  Migration: /app/backend/migrations/standardize_prc_fields.py  ║
╚════════════════════════════════════════════════════════════════╝
```

## ⚠️ DEPRECATED FEATURES (March 2026)
```
╔════════════════════════════════════════════════════════════════╗
║  CHATBOT WITHDRAWAL - COMPLETELY REMOVED                       ║
║                                                                 ║
║  Files Removed:                                                 ║
║  • chatbot_withdrawal.py, chatbot_payment_fix.py               ║
║  • AdminChatbotWithdrawals.js, UserWithdrawalHistory.js        ║
║  • AIChatbotEnhanced.js, ChatbotWithdrawalFlow.js              ║
║                                                                 ║
║  Endpoints deprecated (return deprecation notice):             ║
║  • POST /api/ai/chatbot                                        ║
║  • GET /api/ai/chatbot/history/{uid}                           ║
║                                                                 ║
║  DMT (Fund Transfer) - Also removed (Eko API not working)      ║
╚════════════════════════════════════════════════════════════════╝
```

## Original Problem Statement
User's original request was to redesign the Mining Session UI with a futuristic design and complete the Manual Fintech Redeem System. Later expanded to include a major refactoring to simplify the subscription system from multi-plan (VIP, Startup, Growth) to a two-plan model (Explorer/Elite).

## Application Overview
Paras Reward is a PRC (Paras Reward Coin) mining and redemption platform where:
- Users can earn PRC through mining
- Use PRC for subscriptions, bill payments, gift vouchers
- Redeem to INR via bank transfers
- Earn bonuses through referral system

## Core Features
1. **Mining System** - Time-based PRC mining with referral bonuses
2. **Subscription Plans** - **Explorer (FREE)** and **Elite (PAID)** ONLY
3. **Redemption Services** - BBPS Bill Payments, Gift Vouchers, Bank Transfers
4. **Payment Integration** - Razorpay (online) + Manual UPI/Bank
5. **Admin Panel** - Complete management dashboard

## Subscription System (FINALIZED - March 2026)

### ONLY TWO PLANS - SAME MINING SPEED:
```
╔═══════════════════════════════════════════════════════════════════╗
║  Feature          │  EXPLORER (Free)   │  ELITE (₹799/month)      ║
╠═══════════════════════════════════════════════════════════════════╣
║  Mining Speed     │  SAME              │  SAME                    ║
║  PRC दिसेल         │  ✅ Yes            │  ✅ Yes                  ║
║  PRC Collect      │  ❌ NO             │  ✅ Yes                  ║
║  Redeem           │  ❌ NO             │  ✅ Yes                  ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Key Difference:** Explorer users can MINE but CANNOT COLLECT or REDEEM PRC!

### Code Implementation:
```python
# In server.py - SUBSCRIPTION_PLANS
"explorer": {
    "mining_rate": 90,      # SAME as Elite
    "prc_per_tap": 2.0,     # SAME as Elite
    "can_collect": False,   # ❌ Cannot collect
    "can_redeem": False     # ❌ Cannot redeem
}
"elite": {
    "mining_rate": 90,
    "prc_per_tap": 2.0,
    "can_collect": True,    # ✅ Can collect
    "can_redeem": True      # ✅ Can redeem
}

# Use this function to check paid status:
is_paid_subscriber(user)  # Returns True for Elite + Legacy plans
```

### Legacy Plan Handling:
- Existing Startup/Growth/VIP users → Automatically treated as Elite
- Their features work exactly like Elite
- No new signups for legacy plans

## Tech Stack
- **Frontend**: React.js with Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Razorpay, Eko (BBPS)

---

## What's Been Implemented (March 2026)

### Session (20 March 2026) - Security Audit & BBPS Fixes

**CRITICAL SECURITY FIXES:**

1. **Webhook Signature Enforcement**
   - Fixed: Invalid Razorpay webhook signatures now rejected (was being skipped!)
   - File: `routes/razorpay_payments.py` line 555-558

2. **Rate Limiting Added:**
   - `/verify-payment`: Max 5 attempts per order per 5 minutes
   - `/mining/claim`: 60-second cooldown between claims

3. **Eko Balance Pre-Check:**
   - BBPS payments now check Eko wallet balance before initiating
   - Prevents stuck transactions when balance is insufficient

4. **Admin Audit Endpoints:**
   - `POST /api/razorpay/admin/audit-cancelled-elite` - Find suspicious users
   - `POST /api/razorpay/admin/bulk-reverse-subscriptions` - Mass downgrade
   - `POST /api/razorpay/admin/reverse-subscription` - Single user downgrade
   - `POST /api/razorpay/admin/fix-cancelled-subscriptions` - Auto-fix

**SECURITY AUDIT REPORT:** `/app/backend/SECURITY_AUDIT.md`

**BBPS FIXES:**
- MSEDCL Electricity: Fixed `cycle_number` (BU) extraction
- Credit Card: Added `registered_mobile_number` field
- Sender name sanitization working
- Jio Prepaid working with `recharge_plan_id`

**Admin Tools:**
- `/admin/pending-requests` - Manage stuck requests with bulk fail
- Eko wallet balance display on redeem page

### Previous Session (19 March 2026) - VIP/Membership to Elite Refactoring

**COMPLETED: Two-Plan System Refactoring**
- Simplified from 4 plans (VIP, Startup, Growth, Elite) to 2 plans (Explorer, Elite)
- Legacy plans treated as Elite for backward compatibility
- Removed deprecated `membership_type` field usage from new code
- Updated all backend routes to use `subscription_plan` instead of `membership_type`
- Updated frontend UI text from "VIP" to "Elite"

**Key Changes:**
1. **Backend Constants Updated** (`server.py`):
   - `PAID_PLANS = ["elite"]`
   - `LEGACY_PAID_PLANS = ["startup", "growth", "vip", "pro"]`
   - `SUBSCRIPTION_PLANS` dictionary with explorer and elite configs

2. **Helper Function**: `is_paid_subscriber(user)` - centralized check for paid status

3. **Routes Updated**:
   - `auth.py`: Subscription expiry check instead of VIP expiry
   - `razorpay_payments.py`: Removed `membership_type: "vip"` from all user updates
   - `admin_dashboard.py`: Uses `subscription_plan` for elite_users count
   - `admin_users.py`: Filters by `subscription_plan` instead of `membership_type`
   - `admin_misc.py`: Updated renewal notifications to query by plan
   - `admin_reports.py`: Updated conversion analytics

4. **Frontend Updated**:
   - HowItWorks.js: "Unlock Elite Benefits"
   - SupportTickets.js: "KYC/Subscription" category
   - AdminSettings.js: "Elite Payment Settings"
   - RefundPolicy.js: "Elite Membership Fees"
   - AdminPolicies.js: "Elite Membership" policy

5. **Migration Script Created**: `/app/backend/migrations/migrate_to_two_plans.py`

**Test Results**: 19 tests passed (13 backend + 6 frontend)
- Test File: `/app/backend/tests/test_subscription_refactoring.py`
- E2E Test: `/app/tests/e2e/subscription-refactoring.spec.ts`

### Deprecated Features Removed (19 March 2026)
**Completely removed from codebase:**
| Feature | Files Deleted | DB Collections Dropped |
|---------|---------------|------------------------|
| Tap Game | - | tap_games, tap_game_sessions |
| Rain Drop / PRC Rain | - | prc_rain, prc_rain_drops, rain_drops |
| Luxury Life | - | luxury_life, luxury_claims, luxury_savings |
| PRC Savings Vault | ParasRecurringDeposit.js, AdminRecurringDeposits.js, recurring_deposit.py | recurring_deposits, rd_deposits, rd_transactions, prc_vault, prc_savings_vault |

**Routes Removed:**
- `/recurring-deposit`, `/rd` → Redirect to `/dashboard`
- `/admin/recurring-deposits`, `/admin/rd` → Redirect to `/admin`

---

## Known Issues (P0-P2)

### P0 - Blocked
- **Eko Fund Transfer (DMT)**: Bank-side transaction reversals. BLOCKED on Eko support action - user needs to:
  1. Configure callback URL: `https://www.parasreward.com/api/eko/callback`
  2. Ask Eko to investigate why beneficiary banks are reversing transfers
- **Eko Aadhaar Auto-KYC**: Blocked on Eko support - user needs to contact Eko account manager
- **Gift Vouchers White Screen**: Blocked - needs browser console error from user's production environment

### P1 - Pending
- **User Rakhi Ghehlod Refund**: 14,260 PRC refund pending (PRODUCTION ONLY - cannot test in preview)
- **Full audit for unauthorized redemptions**: Need to run on production database
- **Run Migration Script**: `/app/backend/migrations/migrate_to_two_plans.py` on production DB

### P2 - Lower Priority
- **MSEDCL bill payment**: Requires 4-digit "BU" number from user's bill
- **Hardcoded credentials in `eko_kyc_service.py`**: Needs environment variables refactoring

---

## Upcoming Tasks

### P1
1. Run migration script on production to convert legacy users to Elite
2. Update frontend pricing pages to only show Explorer/Elite
3. Admin UI to override category percentages for individual users
4. Backend logic to carry forward unused category limits to next month
5. UI for "Shopping" category redemption

### P2
1. Refactor `eko_kyc_service.py` to remove hardcoded credentials
2. Refactor `unified_redeem_v2.py` to reduce file size
3. Manual bank transfer notifications (Firebase/Email)
4. Refactor `server.py` (44K lines) into smaller modules

### Future
1. Database migration to PostgreSQL
2. Email/Mobile OTP verification
3. Receipt generation for transactions

---

## Key API Endpoints

### Redemption
- `POST /api/redeem/request` - Create redemption request (with full validation)
- `GET /api/redeem/services` - List available services
- `GET /api/redeem/calculate-charges` - Calculate PRC required

### GST Invoice
- `POST /api/invoice/generate` - Generate GST invoice with PDF
- `GET /api/invoice/user/{user_id}` - List user's invoices
- `GET /api/invoice/{invoice_id}/pdf` - Download invoice PDF
- `GET /api/invoice/admin/all` - Admin: All invoices with GST summary

### Eko Integration
- `POST /api/eko/callback` - Receive transaction status updates from Eko

---

## Credentials (Testing)
- **User Login**: `9970100782` / PIN: `997010` (Growth plan - treated as Elite)
- **Admin Login**: `Admin@paras.com` / PIN: `153759`
- **Test User UID (KYC verified, Growth plan)**: `6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21`

---

## Notes for Next Agent
1. User's primary language is **English and Marathi** - respond accordingly
2. Razorpay webhook is **disabled** by user
3. `server.py` is very large (~45K lines) - needs refactoring
4. Always run tests after making changes to redemption logic
5. **Eko DMT is BLOCKED** - needs Eko support action, not code fix
6. **Rakhi Ghehlod refund (14,260 PRC)** - PRODUCTION ONLY task
7. Category-based redeem limits: Utility (40%), Shopping (30%), Bank (30%)
8. Validation order is correct - KYC -> Subscription -> Expiry -> Limits
9. **Two-Plan System**: Explorer (free) and Elite (paid). Legacy plans (startup/growth/vip) treated as Elite
10. Use `is_paid_subscriber(user)` to check if user has paid subscription

---

## Whitepaper Finalization (21 March 2026)

### ✅ COMPLETED: Multi-Lingual Whitepaper
- **File**: `/app/frontend/public/whitepaper.html`
- **Features Implemented**:
  - Dark theme professional design with gradient accents
  - 3-language support: English, Hindi (हिंदी), Marathi (मराठी)
  - Language toggle in top-right corner
  - All sections: Introduction, Vision, How It Works, Subscription Plans, Tokenomics with Chart.js Pie Chart, Referral System, Redemption Options, Security, Revenue Model, Growth Strategy, Roadmap, App Demo with REAL screenshots, Risk/Disclaimer, Founder's Message
  - Responsive design for mobile/desktop
- **Testing**: Verified via screenshot tool - all sections render correctly, language switching works

---

## Payment Gateway Toggles (22 March 2026)

### ✅ COMPLETED: Strict Enable/Disable for Payment Methods
- **Files Modified**:
  - `/app/backend/server.py`: Added `prc_subscription_enabled` flag to `/settings/public` and new `/admin/toggle-prc-subscription` endpoint
  - `/app/frontend/src/pages/AdminSettings.js`: Added PRC payment toggle card
  - `/app/frontend/src/pages/SubscriptionPlans.js`: Added conditional rendering for all 3 payment methods
- **Features**:
  - Manual UPI/Bank - toggle enable/disable
  - Razorpay Gateway - toggle enable/disable  
  - Pay with PRC - toggle enable/disable (NEW)
  - Strict conditional rendering: When disabled, option does NOT appear on subscription page
  - Admin PIN (123456) required for toggle actions
- **Testing**: Backend 7/7 tests passed, Frontend code review passed

---

## Recent Bug Fixes (21 March 2026)

### ✅ P0 FIXED: Admin User 360 Search Error
- **Issue**: "Failed to search user" error in AdminUser360 page
- **Root Cause**: Special characters in search queries were not escaped, causing regex errors
- **Fix Applied**: 
  - Added `regex_module.escape(query)` in `/api/admin/user-360` endpoint (server.py line 19714-19715)
  - Improved frontend error handling with specific error messages for 404, 500, network errors
- **Testing**: 16/16 backend tests pass - search by mobile, email, UID, special chars all work
- **Test File**: `/app/backend/tests/test_admin_user_360_search.py`

### ✅ P1 FIXED: Used PRC = 0 Display Bug (21 March 2026)
- **Issue**: Redeem limit showed "Used = 0" for all users even when they had redemptions
- **Root Cause**:
  1. `get_user_all_time_redeemed()` had early return preventing backup collections check
  2. `/user/{uid}` endpoint had duplicate logic not using centralized function
  3. Status checks didn't include 'SUCCESS' uppercase for bank withdrawals
- **Fix Applied**:
  - Removed early return in `get_user_all_time_redeemed()` - now always checks backup collections (line 3614-3745)
  - Updated `/user/{uid}` endpoint to use centralized `get_user_all_time_redeemed()` (line 8489)
  - Added 'SUCCESS' to status checks in bank withdrawal queries (line 3722)
  - Made stats.total_redeemed consistent with redeem_limit.total_redeemed
- **Testing**: 11/11 backend tests pass - all endpoints show consistent Used PRC values
- **Test File**: `/app/backend/tests/test_used_prc_redeem_limit_bug.py`

---

## 🔒 SECURITY AUDIT - Phase 1 Complete (23 March 2026)

### ✅ COMPLETED: Admin API Authentication

**Issue**: All `/api/admin/*` endpoints were accessible without authentication - CRITICAL security vulnerability.

**Fix Applied**:
1. Created `/app/backend/middleware/auth.py` with:
   - `get_current_user()` - JWT token verification
   - `get_current_admin()` - Admin role verification
   - `verify_user_access()` - IDOR protection helper

2. Protected `/app/backend/routes/admin_settings.py`:
   - Added `Depends(get_current_admin)` to ALL 25+ routes
   - PRC Rate, Redeem Limit, Mining Rates, PRC Economy, Video Ads, Registration, Contact Submissions

3. Added **AdminAuthMiddleware** in `/app/backend/server.py`:
   - Automatically protects ALL `/api/admin/*` routes
   - Validates JWT token
   - Checks admin role (admin/sub_admin)
   - Returns 401 for missing token, 403 for non-admin

4. Fixed JWT Secret consistency:
   - `server.py` and `middleware/auth.py` now use same `JWT_SECRET_KEY`
   - Removed `secrets.token_hex(32)` random generation on restart

5. Fixed Login `hashed_pin` field compatibility:
   - Added `hashed_pin` to password field priority in `/app/backend/routes/auth.py`

**Test Results**:
- ✅ Without token: 401 "Authentication required"
- ✅ With admin token: Data returned
- ✅ With regular user token: 403 "Admin access required"

**Test Credentials** (paras_reward_db):
- Admin: `admin@test.com` / PIN: `153759`
- User: `test@parasreward.com` / PIN: `153759`

### 🟡 PENDING: Security Phase 2

1. **CORS Restriction** (P1)
   - Currently: `CORS_ORIGINS="*"` with credentials
   - Fix needed: Restrict to specific origins

2. **Frontend Admin Validation** (P1)
   - Currently: Admin role checked via localStorage
   - Fix needed: Validate role via `/api/auth/me` endpoint

3. **IDOR Protection** (P1)
   - User endpoints like `/api/user/{uid}` need owner verification
   - Use `verify_user_access()` from middleware

### ✅ COMPLETED: Security Phase 2 (23 March 2026)

1. **CORS Restriction** ✅
   - Changed `CORS_ORIGINS="*"` to specific origins
   - Now: `https://network-capacity-ui.preview.emergentagent.com,http://localhost:3000`
   - File: `/app/backend/.env`

2. **Frontend Admin Validation via API** ✅
   - Created `/api/auth/me` endpoint in `/app/backend/routes/auth.py`
   - Returns verified user info: `uid, email, name, role, is_admin`
   - Frontend can call this to validate admin role server-side

3. **IDOR Protection on User Endpoints** ✅
   - Protected `/api/user/{uid}` endpoint
   - Protected `/api/user/{uid}/dashboard` endpoint  
   - Protected `/api/user/{user_id}/redeem-limit` endpoint
   - Non-admins get 403 when accessing other users' data
   - Admins can access any user's data

**Test Results**:
| Test Case | Result |
|-----------|--------|
| `/auth/me` with token | ✅ Returns user info |
| `/auth/me` without token | ✅ 401 "Authentication required" |
| User accessing own data | ✅ Success |
| User accessing other's data | ✅ 403 "Access denied" |
| Admin accessing any user | ✅ Success |

### ✅ COMPLETED: Frontend Role Validation + Extended IDOR (23 March 2026)

1. **Frontend Role Validation via API** ✅
   - Added `validateUserRole()` function in `/app/frontend/src/App.js`
   - Calls `/api/auth/me` on app load to verify role server-side
   - Auto-logout on invalid/expired token
   - Updates localStorage if role mismatch detected

2. **Extended IDOR Protection** ✅
   - `/api/user/{uid}/weekly-limits` - Protected
   - `/api/user/{uid}/redemption-stats` - Protected
   - `/api/subscription/user/{uid}` - Protected
   - `/api/subscription/history/{uid}` - Protected
   - All return 403 for unauthorized access

**Files Modified**:
- `/app/frontend/src/App.js` - validateUserRole() function added
- `/app/backend/server.py` - IDOR protection on 4 additional endpoints

### ✅ COMPLETED: Extended Security Enhancements (23 March 2026)

1. **Additional IDOR Protected Endpoints** ✅
   - `/api/user/{uid}/location-visibility` (PUT)
   - `/api/user/settings/{uid}` (PUT)
   - `/api/user/security/{uid}` (GET)
   - `/api/user/statement/{uid}` (GET)
   - Helper function `verify_user_access_sync()` created for reuse

2. **Rate Limiting for Sensitive Endpoints** ✅
   - `/api/auth/forgot-pin/check-mobile` - 3 requests/10 min per mobile, 10/hour per IP
   - `/api/auth/forgot-pin/send-email-otp` - Same limits
   - `check_otp_rate_limit()` function created
   - Returns 429 "Too many OTP requests" when exceeded

3. **Comprehensive Audit Logging** ✅
   - `log_sensitive_operation()` function for security audit trail
   - Logs: login attempts, OTP requests, rate limits, admin operations
   - Collection: `security_audit_logs`
   - Admin write operations (POST/PUT/DELETE) auto-logged via middleware

**Test Results**:
| Feature | Test | Result |
|---------|------|--------|
| IDOR | User accessing own security info | ✅ Success |
| IDOR | User accessing other's security info | ✅ 403 Blocked |
| IDOR | User updating other's settings | ✅ 403 Blocked |
| Rate Limit | 4 OTP requests | ✅ Allowed |
| Rate Limit | 5th OTP request | ✅ 429 Blocked |
| Audit Log | Rate limit event logged | ✅ Recorded |

### ✅ VERIFIED: User 360 API (23 March 2026)

**Issue Reported**: Admin User 360 page showing "Failed to search user" error.

**Root Cause Analysis**:
- User `Suresh Rama Dhuri` (annadhuri51@gmail.com) is in **production database**, not preview
- Preview environment uses `paras_reward_db` database with only 12 test users
- User 360 API code is **fully functional** with comprehensive error handling

**Test Results** (Preview Environment):
| Test | Query | Result |
|------|-------|--------|
| UID Search | fcd8c6f8-9596-4f56-8556-568847d5ab86 | ✅ SUCCESS |
| Email Search | annadhuri51@gmail.com | ✅ SUCCESS |
| Mobile Search | 9158367636 | ✅ SUCCESS |
| All Users | admin, test users | ✅ All passed |

**Improvements Made**:
- Added detailed logging: `[USER360] Request received - query: ...`
- Enhanced error messages for debugging

**Production Debugging**:
If issue persists in production, call `/api/admin/user-360-debug?query={uid}` to get step-by-step diagnostics.

### 🔴 INVESTIGATED: FASTag Recharge Failure (23 March 2026)

**Issue Reported**: FASTag recharge fails and PRC is refunded even after successful bill fetch.

**Investigation Summary**:
1. Bill fetch works correctly (Customer Name, Amount displayed)
2. Payment call is made to Eko API
3. Payment fails → PRC is refunded
4. User sees "X PRC has been refunded to your account"

**Root Cause Analysis**:
- Code flow is correct: Frontend → unified_redeem_v2.py → bbps_services.py pay_bill()
- `billfetchresponse` is properly passed when available
- Eko API credentials are valid (verified via /api/bbps/debug-config)

**Possible Causes** (Need Production Logs):
1. **Eko API Error**: Specific error from Eko not visible in test environment
2. **Operator ID Mismatch**: IDBI Bank Fastag (ID 431) not in backend mapping
3. **Invalid billfetchresponse format**: May not be correctly parsed from bill fetch
4. **Vehicle Number Format**: May need specific format validation

**Debug Endpoints Added**:
- `GET /api/bbps/debug-fastag-errors` - Shows last 10 failed FASTag transactions with error details
- `GET /api/bbps/debug-config` - Shows Eko API configuration status

**Improvements Made**:
1. Better error logging in `unified_redeem_v2.py` - logs full Eko response on failure
2. User-facing error message now shows actual Eko error instead of generic message
3. Debug endpoint for production investigation

**Production Debugging Steps**:
1. Deploy code to production
2. Call `/api/bbps/debug-fastag-errors` after a failed FASTag recharge
3. Check `error_message` and `eko_error_code` in response
4. Check `had_bill_fetch_response` - if false, bill fetch data not passed correctly

**Files Modified**:
- `/app/backend/routes/bbps_services.py` - Added debug-fastag-errors endpoint, db initialization
- `/app/backend/routes/unified_redeem_v2.py` - Enhanced error logging and user message
- `/app/backend/server.py` - Added set_bbps_db() call

### ✅ ADDED: FASTag Flexible Amount Support (23 March 2026)

**User Request**: "User fastag flexible amount ने recharge करू शकतो का?"

**Answer**: Yes! FASTag supports flexible amount recharge.

**Implementation**:
1. **Frontend Changes** (`RedeemPageV2.js`):
   - FASTag bill fetch shows "Current Balance" instead of "Bill Amount"
   - Amount field shows hint: "Enter any amount (min ₹100)"
   - Bill fetch does NOT auto-fill amount for FASTag (user enters manually)
   - Cyan colored hint: "💡 FASTag Recharge: Enter any amount (min ₹100)"

2. **Backend Changes** (`unified_redeem_v2.py`):
   - Added FASTag-specific validation
   - Minimum amount check: ₹100
   - Vehicle number required validation

**User Flow**:
1. Select FASTag provider (IDBI, ICICI, etc.)
2. Enter Vehicle Number
3. Click "Fetch Bill" → Shows current FASTag balance
4. Enter any recharge amount (₹100 or more)
5. Click "Pay Now"

**Why Flexible Amount?**
- FASTag = Prepaid wallet (not a bill)
- User adds money to FASTag wallet
- Similar to mobile prepaid recharge

### 📁 Files Modified (Security Phase 1)
- `/app/backend/middleware/auth.py` - NEW
- `/app/backend/routes/admin_settings.py` - All routes protected
- `/app/backend/routes/auth.py` - hashed_pin fix, login security
- `/app/backend/server.py` - AdminAuthMiddleware, JWT secret fix

---

## ✅ Admin User 360 Full Restructure Complete (24 March 2026)

### What Was Done:
1. **Backend Actions Extended** (`/app/backend/routes/admin_user360.py`):
   - `block_user` / `unblock_user` - Block/unblock user
   - `reset_pin` - Generates new 6-digit PIN
   - `change_role` - user/sub_admin/admin
   - `change_referral` - Change/remove referrer
   - `delete_user` - Archive and delete permanently

2. **NEW Frontend Page** (`/app/frontend/src/pages/AdminUser360New.js` - ~1100 lines):
   - **Browse Mode** - View all users with filters (Role, Plan, KYC)
   - **Search Mode** - UID, email, mobile, PAN, Aadhaar
   - **UserProfileCard** - Complete user info
   - **Stats Row** - Mined, Redeemed, Referrals, Risk Score
   - **Admin Actions** (12+ buttons): Block, Mining Toggle, Reset PIN, Change Role, Adjust Balance, Change Referral, Subscription, Auto Diagnose, KYC Actions, Delete User
   - **Edit Profile Modal** - Personal, Contact, Address, KYC, Bank, Nominee
   - **6 Data Tabs** - Transactions, Redemptions, Referrals, Sub History, Logins, KYC Data
   - **Admin Notes**

3. **OLD File Deleted** (`AdminUser360.js` - 3740 lines removed)

4. **Routes Updated**:
   - `/admin/user360` → New AdminUser360New
   - `/admin/user-360` → Redirects to `/admin/user360`
   - Sidebar updated

### Test Results (iteration_144):
- Frontend: 100% success rate (24 features tested)

---

## ✅ Admin Pages & Manager Permissions Cleanup (24 March 2026)

### What Was Done:
1. **Backend Permissions Cleaned** (`/app/backend/server.py`):
   - Removed 24 deprecated pages from `ALL_ADMIN_PERMISSIONS`
   - Updated `DEFAULT_MANAGER_PERMISSIONS` with only active pages
   - Total: 30 clean permissions organized by category

2. **Frontend AdminLayout Updated** (`/app/frontend/src/components/layouts/AdminLayout.js`):
   - Cleaned `MENU_TO_PERMISSION` mapping
   - Cleaned `ROUTE_TO_PERMISSION` mapping
   - Removed all deprecated page references

3. **Popup Messages Auth Fixed** (`/app/frontend/src/pages/Admin/AdminPopupMessages.js`):
   - Added Authorization headers to all API calls (fetchPopups, handleSubmit, handleToggle, handleDelete)

### Removed Deprecated Pages:
- Orders, Marketplace (December 2025)
- Bill Payments, Unified Payments (rejected/refunded)
- Recurring Deposits (feature deprecated)
- PRC Burn Control (old system)
- Video Ads, PRC Rain Drop (moved to Settings)
- Ads Income, Fixed Expenses, Capital (unused)
- All duplicate entries (underscores vs dashes)

### Current Permissions Categories:
| Category | Count | Pages |
|----------|-------|-------|
| General | 6 | Dashboard, Members, User 360, Users, Analytics, Admin Performance |
| Operations | 5 | KYC, Support, Contact, Popup Messages, System Monitor |
| Payments | 6 | Subscriptions, Bank Transfers, Razorpay, BBPS, Eko, Gift Vouchers |
| Finance | 7 | Accounting, Company Wallets, PRC Analytics, PRC Ledger, P&L, User Ledger, Liquidity |
| Security | 5 | Fraud Dashboard, Fraud Alerts, Security, PRC Economy, Data Backup |
| Settings | 1 | All Settings |

---

