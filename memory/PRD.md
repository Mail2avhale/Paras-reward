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
## COMPLETED: Registration Error Handling - 29 March 2026
## COMPLETED: 3-Tier Network Cap Formula (P0) - 29 March 2026
## COMPLETED: PRC Collect Balance UI Bug Fix (P0) - 30 March 2026
## COMPLETED: Smart AI Chatbot (SupportChatbot) - 30 March 2026
## COMPLETED: Auto-Burning System (3.33% daily) - 30 March 2026
## COMPLETED: Admin Redeem Limits Overview - 30 March 2026
## COMPLETED: Chatbot Earning Projections (P1) - 30 March 2026
## COMPLETED: Daily Mining Base Rate Change (500→1000/0) - 31 March 2026
## COMPLETED: Speed Display Rebranding (PRC 100% + Cash POPCORN) - 31 March 2026
## COMPLETED: Admin Auto-Burn Manual Trigger + Stats - 31 March 2026
## COMPLETED: Invoice Display with Print Option (P0) - 31 March 2026
## COMPLETED: Auto-Burn Background Cron Job - 31 March 2026
## COMPLETED: Popcorn Icon UI Replacement - 31 March 2026
## COMPLETED: Subscription Expiry Bug Fix (P0 Critical) - 1 April 2026
## COMPLETED: Admin Dashboard PRC Economy Stats - 1 April 2026
## COMPLETED: PRC Audit Endpoint (P0) - 1 April 2026
## COMPLETED: Holiday Calendar Date Fix (P0 Bug) - 1 April 2026
## COMPLETED: Admin Login-As-User Dual Logout Bug Fix - 1 April 2026
## COMPLETED: Login "Account Not Found" Bug Fix - 2 April 2026
## COMPLETED: PRC Subscription Bypasses Redeem Limit - 2 April 2026
## COMPLETED: Redeem Limit Formula Fix — Total Earned = Balance Only - 2 April 2026
## COMPLETED: PRC Dynamic Rate Inconsistency Bug Fix - 3 April 2026
## COMPLETED: Admin PRC Subscription & Redeem Actions - 3 April 2026
## COMPLETED: Admin PRC Subscription Carry-Forward Confirmation - 3 April 2026
## COMPLETED: Total Redeemed ₹0 Bug Fix - 3 April 2026
## COMPLETED: PRC Amount Mismatch Bug Fix (Subscription Page) - 3 April 2026
## COMPLETED: Admin Subscription Management + Upcoming Plan Concept - 3 April 2026
## COMPLETED: Code Quality & Security Fixes - 3 April 2026

## COMPLETED: Redeem Limit Status Filter Bug Fix (P0 Critical) - 4 April 2026
- **Bug**: Failed/Refunded redeem requests counted as "Used" in redeem limit
- **Root Cause**: Missing `pending` in valid statuses, unfiltered `max()` logic, inconsistent status lists across 8+ files
- **Fix Phase 1** (Core): 
  - `server.py` `get_user_all_time_redeemed`: Added `pending`, removed `max(txn_total, total_redeemed)`, orders $nin→$in
  - `admin_user360.py`: Uses centralized function via `set_redeemed_fn`
- **Fix Phase 2** (Comprehensive — all files):
  - `routes/users.py`: Status list updated with all valid variants including `pending`
  - `routes/redeem_validations.py`: Monthly limit check now includes `pending`, `paid`
  - `routes/admin_dashboard.py`: All 8 aggregation queries updated with full status list
  - `routes/prc_audit.py`: All 6 debit queries updated with full status list
  - `routes/bank_redeem.py`: Cooldown check added `paid`/`Paid`/`PAID` (no `pending` — cooldown logic)
  - `routes/admin_misc.py`: Blocking status checks added `paid`
  - `server.py` weekly checks: BBPS + Bank cooldown added `paid`/`Paid`/`PAID` variants
- **Two status categories established**:
  - **VALID_REDEEMED** (Used calculation): completed, success, approved, paid, pending, processing, delivered (+ case variants)
  - **COOLDOWN_ONLY** (blocking): Same minus pending/processing (pending shouldn't block retry)
- **Testing**: iteration 174 (100% PASS)

## Active Architecture
- Mining: (500 + N×prc_per_user) × boost (Cash=1.0, PRC=0.70)
- Network Cap: min(6000, 800 + 16×D + 5×L1)
- Burn: Cash=1%, PRC=5% on ALL services (redeem + PRC subscription)
- PRC rate: Dynamic `/api/prc-economy/current-rate`

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P2: server.py refactoring (45k+ lines)
- P2: 218 React hook dependency warnings fix
- P2: Large frontend component files split
- Future: MongoDB to PostgreSQL migration
