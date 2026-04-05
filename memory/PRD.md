# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 5 April 2026

## COMPLETED: Double-Count Deduplication Fix (P0) - 5 April 2026

### Bug Report
Production user (c8a2eb82) reported "Used" showing more PRC than actually redeemed.

### Root Cause
Same transaction existed in multiple MongoDB collections (e.g., bank redeem in both `bank_transfer_requests` AND `redeem_requests`). The `get_user_all_time_redeemed()` function summed from ALL 18+ collections without deduplication — counting the same PRC deduction 2-3 times.

### Fix Applied
- **Fingerprint-based deduplication**: Each transaction is fingerprinted as `{amount}_{timestamp_rounded_to_minute}`. If the same fingerprint appears across multiple collections, it's counted only once.
- Applied to BOTH:
  - `server.py` → `get_user_all_time_redeemed()` (affects Dashboard USED)
  - `prc_statement.py` → `get_prc_usage_history()` (affects Details page)
- Both now produce identical totals (verified with 2 test users)

### Files Modified
- `/app/backend/server.py` — `get_user_all_time_redeemed()` rewritten with dedup
- `/app/backend/routes/prc_statement.py` — usage-history endpoint with dedup

## COMPLETED: Total Redeem Limit Formula Change (P0) - 5 April 2026
- `TOTAL LIMIT = total_mined × unlock%` (was `total_earned × unlock%`)

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
- P3: MongoDB → PostgreSQL migration
