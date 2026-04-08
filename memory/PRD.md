# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 8 April 2026

## VERIFIED: E2E Core Flows Test - 8 April 2026
- Backend: 17/17 tests passed (100%)
- Frontend: All core flows working (100%)
- Flows verified: Login, Dashboard, Bottom Nav, Growth Network, Subscription Plans, Profile, Bank Redeem
- Test report: /app/test_reports/iteration_193.json
- Fixed minor nested button HTML issue in ProfileAdvanced.js

## COMPLETED: Network Size / referred_by Bug Fix - 8 April 2026
- Root cause: register_user() stored raw `referral_code` in `referred_by` field instead of `uid`
- BFS network count functions only checked against `uid`, missing newer users
- Fix: Updated queries across server.py, growth_economy.py, mining.py, notifications_routes.py
- Now queries `{"referred_by": {"$in": [uid, referral_code]}}` to catch both formats
- Verified: API endpoints return correct network_size and unlock_percent

## COMPLETED: Subscription Plan History UI - 7 April 2026
- Added Plan History section on Subscription page showing Ongoing and Expired plans
- Backend: Extended `/api/subscription/history/{uid}` to return `plan_periods` with start/expiry dates and status
- Frontend: Prominent Plan History cards with green (Ongoing) and gray (Expired) styling

## COMPLETED: Performance Summary Card - 7 April 2026
- New API: `GET /api/user/{uid}/performance-summary` 
- Shows: Total Subscription Paid (INR), Total Rewards Redeemed (INR), Available PRC Balance, Estimated PRC Value (INR)
- Legal safe: No investment/profit/ROI language. Disclaimer text at bottom
- PRC subscription payments use `inr_equivalent` field for accurate INR amounts

## COMPLETED: Redeem Limit Formula Update (User-defined Tiers) - 7 April 2026
- Updated `calculate_growth_level()` in `routes/growth_economy.py` per user's spreadsheet
- New tiers: 2→4%, 4→4%, 8→5%, 16→6%, 32→6%, 64→6%, 128→7%, 256→7%, 512→8%, 1024→9%, 2048→9%, 4096→9%, 8192→10%
- Max unlock: 90%. All 13 tier boundaries verified via unit test

## COMPLETED: Referral PRC USED Fix - 7 April 2026
- Fixed PRC USED showing 0 on Growth Network page
- Now calls `get_user_all_time_redeemed()` per referral to compute actual PRC redeemed

## COMPLETED: Bottom Navigation Fix - Subscription Icon Added - 7 April 2026
- Global BottomNav.js renders correctly with 4 items: Home, Invite, Plan (Crown), Profile

## COMPLETED: Security PIN System - 8 April 2026
- Replaced Security Question with 4-digit Security PIN in Forgot PIN flow
- Default Security PIN = last 4 digits of registered mobile
- APIs: /auth/security-pin/check/{uid}, /auth/security-pin/change, /auth/forgot-pin/verify-security

## VERIFIED: Razorpay Subscription E2E Flow - 8 April 2026
## VERIFIED: Bank Redeem E2E Flow - 8 April 2026
## COMPLETED: Dashboard Redeem Limit Card Restored - 8 April 2026
## COMPLETED: P0 Security Fixes (Code Quality) - 8 April 2026
## COMPLETED: server.py Monolith Refactoring (P2) - 7 April 2026
## VERIFIED: All 8 Core Flows Pass - 7 April 2026
## COMPLETED: Full Burning Concept Removal - 7 April 2026
## COMPLETED: Full BBPS + Gift Voucher + Marketplace Cleanup - 7 April 2026

## Architecture
/app/backend/
├── server.py (33,323 lines - main monolith)
├── routes/ (25+ route files)
│   ├── growth_economy.py (816 lines - BFS network, redeem tiers)
│   ├── mining.py (728 lines - mining formula)
│   ├── notifications_routes.py (3,010 lines)
│   ├── unified_redeem_v2.py (3,182 lines)
│   └── ... (20+ more)
├── utils/helpers.py (320 lines - PRC rate, subscriptions)

## Upcoming (P1)
- Invoice PDF Download option in InvoiceModal.js

## Code Quality (P1-P2)
- Missing React Hook Dependencies (192 instances)
- Replace Index Keys with Stable Keys in React (82 instances)
- Remove localStorage Security Risks (11 instances)
- Remove Console Statements for production (235 instances)

## Future/Backlog
- P2: Split oversized React components (AdminBBPSDashboard, AdminBankTransfers, etc.)
- P2: Continue server.py extraction (33K -> target 20K)
- P3: MongoDB -> PostgreSQL migration
