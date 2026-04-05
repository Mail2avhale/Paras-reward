# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 6 April 2026

## COMPLETED: Deduplication Refactoring Verification (P0) - 6 April 2026
- All 5 endpoints refactored to use central `get_user_all_time_redeemed()` function
- Testing agent verified 100% consistency across all endpoints (iteration_183)
- Primary user: 48,646.52 PRC, PRC user: 34,369.47 PRC - identical across dashboard, redemption-stats, profile, usage-history

## COMPLETED: Double-Count Deduplication Fix (P0) - 5 April 2026
### Root Cause
Same transaction existed in multiple MongoDB collections. The `get_user_all_time_redeemed()` function summed from ALL 18+ collections without deduplication.
### Fix Applied
- Fingerprint-based deduplication: `{amount}_{timestamp_rounded_to_minute}`. Same fingerprint across collections counted only once.
- Applied to both `server.py` and `prc_statement.py`

## COMPLETED: Total Redeem Limit Formula Change (P0) - 5 April 2026
- `TOTAL LIMIT = total_mined * (unlock% / 100)` (was `total_earned * unlock%`)

## COMPLETED: Redeem Used Details Page - 5 April 2026
## COMPLETED: Code Quality Fixes - 5 April 2026
## COMPLETED: PRC Dynamic Rate Fix - 5 April 2026
## COMPLETED: Deep Transaction Investigation - 5 April 2026
## COMPLETED: Core Formula System Audit - 4 April 2026

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js

## Future/Backlog
- P2: Split oversized React components
- P2: server.py refactoring (45k+ lines)
- P3: MongoDB -> PostgreSQL migration
