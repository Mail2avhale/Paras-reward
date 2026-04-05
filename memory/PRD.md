# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 6 April 2026

## COMPLETED: PRC Subscription Activation Bug Fix (P0) - 6 April 2026
### Bug Report
Users reported PRC subscription activation not working.
### Root Cause
Frontend `SubscriptionPlans.js` was checking **Redeem Limit** instead of **PRC Balance** before calling `/subscription/pay-with-prc` API. Backend explicitly skips redeem limit for subscriptions (only checks PRC balance), but frontend was blocking users with low redeem limit even if they had enough PRC.
### Fix Applied
- Changed all `redeemLimit` references to `user.prc_balance` in payment validation, UI display, and button disabled state
- Labels changed: "Available Redeem Limit" → "Your PRC Balance", "Insufficient redeem limit" → "Insufficient PRC balance"
- Testing: 9/9 backend + 5/5 frontend passed (iteration_185)

## COMPLETED: 24-Hour Cooldown Fix (P0) - 6 April 2026
- Replaced ALL redeem cooldown periods with 24 hours from last request time (was 28-day cycle + 7-day limit)
- Files: manual_bank_transfer.py, bank_redeem.py, server.py, unified_redeem_v2.py
- Testing: 17/17 passed (iteration_184)

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
