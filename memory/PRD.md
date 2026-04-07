# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 7 April 2026

## COMPLETED: Subscription Plan History UI - 7 April 2026
- Added Plan History section on Subscription page showing Ongoing and Expired plans
- Backend: Extended `/api/subscription/history/{uid}` to return `plan_periods` with start/expiry dates and status
- Frontend: Prominent Plan History cards with green (Ongoing) and gray (Expired) styling
- Shows Start Date, Expiry Date, Days Remaining for each subscription period

## COMPLETED: Redeem Limit Formula Update (User-defined Tiers) - 7 April 2026
- Updated `calculate_growth_level()` in `routes/growth_economy.py` per user's spreadsheet
- New tiers: 2→4%, 4→4%, 8→5%, 16→6%, 32→6%, 64→6%, 128→7%, 256→7%, 512→8%, 1024→9%, 2048→9%, 4096→9%, 8192→10%
- Max unlock: 90% (was 94.5%). All 13 tier boundaries verified via unit test
- Mid-tier proportional calculation intact (e.g., 7 users = 11.75%)

## COMPLETED: Bottom Navigation Fix - Subscription Icon Added - 7 April 2026
- Removed duplicate inline BottomNavItem from DashboardModern.js (was overriding global BottomNav.js)
- Global BottomNav.js now renders correctly on Dashboard with 4 items: Home, Invite, Plan (Crown), Profile
- Subscription/Plan icon (Crown) added as requested by user
- Removed unused imports (Home, Users, User, UserPlus) and dead code (activeTab state, handleNavigation function)

## COMPLETED: Security PIN System (Replaced Security Question) - 8 April 2026
- Replaced Security Question with 4-digit Security PIN in Forgot PIN flow
- Default Security PIN = last 4 digits of registered mobile (auto-set on registration)
- All 32 existing users migrated with default security PIN
- User can change Security PIN (verify via current PIN or login PIN)
- Security PIN NEVER disclosed in any API response (tested & verified)
- Fixed security leak: security_pin_hash was exposed in user profile → excluded
- APIs: /auth/security-pin/check/{uid}, /auth/security-pin/change, /auth/forgot-pin/verify-security
- Test: 19/19 backend pass, frontend verified (iteration_192.json)

## VERIFIED: Razorpay Subscription E2E Flow - 8 April 2026
- Create order, auto-activation, remaining+28 days renewal, expiry→explorer downgrade
- 16/17 backend tests passed (1 skipped - admin activate needs email)
- Fixed: payment history sort TypeError (datetime vs string)
- Frontend subscription page verified (Elite plan, 74 days remaining)
- Test file: /app/backend/tests/test_razorpay_subscription_e2e.py

## VERIFIED: Bank Redeem E2E Flow (Testing Agent) - 8 April 2026
- Full lifecycle: User request → Admin complete/reject → User status → PRC deduction/refund
- Fixed: KYC check accepts both "verified" and "approved" statuses
- Fixed: MongoDB database boolean check (if db is None)
- 9/9 backend tests passed, frontend verified (Dashboard + BankRedeemPage)
- Test file: /app/backend/tests/test_bank_redeem_e2e.py

## COMPLETED: Dashboard Redeem Limit Card Restored - 8 April 2026
- Added Redeem Limit card on Dashboard (after Mining Widget)
- Shows Total Limit, Redeemed, Available with progress bar
- Fetches from /api/user/{uid}/redeem-limit (non-blocking)
- Click navigates to /bank-redeem page
- Fixed early return bug preventing API call when combined dashboard API succeeds

## COMPLETED: P0 Security Fixes (Code Quality) - 8 April 2026
- Removed SSL verify=False from bbps_services.py (2 instances) — MITM vulnerability fix
- Fixed XSS in AdminRazorpaySubscriptions.js printInvoice — DOMPurify.sanitize on full body content
- Fixed XSS in InvoiceModal.js handlePrint — null check + DOMPurify.sanitize
- Verified circular imports (helpers.py <-> prc_economy.py) properly handled via callback registration
- BlogArticle.js already safe — uses DOMPurify.sanitize
- Python `is` vs `==` comparison — 0 instances found in production code (no action needed)
- Regression test: 20/20 backend, frontend 100% pass (iteration_189.json)

## COMPLETED: server.py Monolith Refactoring (P2) - 7 April 2026
- Reduced server.py from 45,221 -> 33,323 lines (-26%, -11,898 lines)
- Extracted 7 new modular route files

## VERIFIED: All 8 Core Flows Pass (Testing Agent) - 7 April 2026
- Backend: 20/20 tests passed | Frontend: 100% verified
- Flows: Registration, Login, Subscription (Razorpay/Manual), Mining Widget, Redeem Limit, Referrals, Bank Redeem, KYC

## COMPLETED: Restore Subscription + Bank Redeem Pages + Remove PRC Payment (P0) - 7 April 2026
## COMPLETED: Reward Page Removed + Mining Widget on Dashboard (P0) - 7 April 2026
## COMPLETED: Full Burning Concept Removal - User + Admin (P0) - 7 April 2026
## COMPLETED: Subscription from PRC Full Frontend Cleanup (P0) - 7 April 2026
## COMPLETED: Full BBPS + Gift Voucher + Marketplace Cleanup (P0) - 7 April 2026
## COMPLETED: Cooldown Time IST Display Fix (P0) - 7 April 2026
## COMPLETED: Admin Members Table Color Fix (P0) - 7 April 2026
## COMPLETED: Deprecated Code Cleanup (P0) - 7 April 2026
## COMPLETED: EKO Integration Fixes - 7 April 2026
## COMPLETED: Excel Reconciliation System - 7 April 2026

## Architecture
/app/backend/
├── server.py (33,323 lines - main monolith)
├── routes/ (25+ route files)
│   ├── admin_accounting.py (4,954 lines)
│   ├── notifications_routes.py (3,010 lines)
│   ├── unified_redeem_v2.py (3,182 lines)
│   ├── bbps_services.py (3,105 lines)
│   ├── razorpay_payments.py (3,074 lines)
│   ├── mining.py (720 lines - centralized Reward formula)
│   ├── prc_economy.py (947 lines)
│   └── ... (20+ more)
├── utils/helpers.py (320 lines - PRC rate, subscriptions)

## Upcoming (P1 Code Quality)
- Replace Index Keys with Stable Keys in React (82 instances)
- Remove localStorage Security Risks (11 instances)
- Remove Console Statements for production (235 instances)
- Missing React Hook Dependencies (192 instances - most critical files first)
- High-complexity function refactoring (wallet services)

## Future/Backlog
- P1: Invoice PDF Download option in InvoiceModal.js
- P2: Split oversized React components (AdminBBPSDashboard, AdminBankTransfers, etc.)
- P2: Continue server.py extraction (33K -> target 20K)
- P3: MongoDB -> PostgreSQL migration
