# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 6 April 2026

## COMPLETED: 24-Hour Cooldown Fix (P0) - 6 April 2026
### Bug Report
Users were getting "28 days" cooldown error for Redeem to Bank. Root cause: 3 layers of stacked cooldown checks — 28-day subscription cycle (manual_bank_transfer.py), 7-day rolling window (bank_redeem.py), weekly limits (server.py).
### Fix Applied
- Replaced ALL cooldown periods with **24 hours from last request time**
- Files changed: `manual_bank_transfer.py`, `bank_redeem.py`, `server.py`, `unified_redeem_v2.py`
- Removed 28-day cycle check entirely, changed 7-day to 24h, updated all error messages
- Testing: 17/17 backend tests passed (iteration_184)

## COMPLETED: Deduplication Refactoring Verification (P0) - 6 April 2026
- All 5 endpoints refactored to use central `get_user_all_time_redeemed()` function
- 100% consistency across all endpoints (iteration_183)

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
