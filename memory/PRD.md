# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 7 April 2026

## COMPLETED: Admin User 360 Redeem Limits Display (P0) - 7 April 2026
- Backend `admin_user360.py` returns `redeem_limit` (total_limit, total_redeemed, effective_available, unlock_percent, total_earned, total_mined)
- Frontend `AdminUser360New.js` displays 3 color-coded cards: REDEEM LIMIT, USED LIMIT, BAL LIMIT
- Testing: 100% passed (iteration_187)

## COMPLETED: Double Recharge Race Condition Fix (P0) - 6 April 2026
### Bug Report
Same user doing double mobile recharge at exact same time (e.g., 2x ₹1,199 at 12:56am)
### Root Cause
1. `check_weekly_one_service_limit` only counted COMPLETED/SUCCESS status — PENDING/PROCESSING were ignored
2. `create_bill_payment_request` didn't call `check_weekly_one_service_limit` at all
3. No duplicate request protection
### Fix Applied
- Status filter expanded: added pending/processing/submitted to block simultaneous requests
- Added `check_weekly_one_service_limit` call to `create_bill_payment_request` endpoint
- Added 2-minute duplicate request guard to both `bill-payment/request` and `redeem/request` endpoints
- Testing: 17/17 passed (iteration_186)

## COMPLETED: PRC Rate Consistency + INR Conversion (P0) - 6 April 2026
- PRCRateDisplay uses rateOverride prop, no independent fetch
- Dashboard API includes prc_rate, PRC to INR conversion (≈ ₹X) added

## COMPLETED: PRC Subscription Activation Bug Fix (P0) - 6 April 2026
## COMPLETED: 24-Hour Cooldown Fix (P0) - 6 April 2026
## COMPLETED: Deduplication Refactoring Verification (P0) - 6 April 2026
## COMPLETED: Double-Count Deduplication Fix (P0) - 5 April 2026
## COMPLETED: Total Redeem Limit Formula Change (P0) - 5 April 2026
## COMPLETED: Redeem Used Details Page - 5 April 2026
## COMPLETED: Code Quality Fixes - 5 April 2026
## COMPLETED: PRC Dynamic Rate Fix - 5 April 2026
## COMPLETED: Core Formula System Audit - 4 April 2026

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js

## Future/Backlog
- P2: Split oversized React components
- P2: server.py refactoring (45k+ lines)
- P3: MongoDB -> PostgreSQL migration
