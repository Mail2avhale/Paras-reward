# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 5 April 2026

## COMPLETED: Admin Transaction Manager UI + Debit/Credit Fix - 5 April 2026

### Admin Transaction Manager Frontend UI (NEW)
- **Route**: `/admin/transaction-manager`
- **Sidebar**: Added under main menu after "Failed Transactions"
- **Features**:
  - Search by User UID with type filter dropdown
  - Transaction table: Date, Type (color-coded badge), Description, Amount (green/red), Source collection, Status, Actions
  - View detail modal: Shows all fields + edit history
  - Edit modal: Change description/amount with required reason
  - Delete: Soft-delete with confirmation (shows "Deleted" status, can be restored)
  - Refund: Only for debit (negative) non-refunded transactions
  - Restore: Undo soft-deleted transactions
  - Pagination with page navigation

### Debit/Credit Classification Fix (Critical Bug)
- **Bug**: `is_credit = entry_type == "credit" or amount > 0` — `or` operator caused entries with `entry_type="debit"` but positive `amount` to show as CREDIT
- **Fix**: New `determine_credit()` function: entry_type field takes priority, falls back to amount sign
- **Verified**: 27/27 burn entries → DEBIT, 22/22 reward entries → CREDIT, 1/1 subscription → DEBIT

### Files Created/Modified
- NEW: `/app/frontend/src/pages/AdminTransactionManager.js`
- Modified: `/app/frontend/src/App.js` — Route + lazy import
- Modified: `/app/frontend/src/components/layouts/AdminLayout.js` — Sidebar menu + permission
- Modified: `/app/backend/routes/prc_statement.py` — `determine_credit()` function, all 4 sources updated

## COMPLETED: Transaction Record Audit & Admin Management - 5 April 2026

### Deep Investigation Results
4 missing transaction records found and fixed:
- Daily Streak First Login (5 PRC, no record)
- EKO Callback DMT Refund (PRC refunded, no record)
- Gift Subscription (600 PRC deducted, embedded array only)
- Fix Negative Balance (balance reset, audit_log only)

### PRC Statement — 4th Source Added
- Added `prc_transactions` collection (auto-burn, admin credits now visible)
- Soft-delete filter on all 4 sources
- 7 new TYPE_MAP entries

### Admin Transaction Management API
- GET, PUT, DELETE, POST /refund, POST /restore — all with audit logging

## COMPLETED: Core Formula System Audit & Refactor - 4 April 2026
1. Subscription Active/Inactive — Consolidated in helpers.py
2. Mining Formula — BASE_MINING=1000, threshold=250 synced
3. Redeem Formula — `total_earned = total_mined - total_redeemed` with reconciliation
4. Network Formula — Verified clean
5. PRC Dynamic — Verified clean (5-factor)
6. Mining Collect — Dual field (total_mined + total_mined_prc)

## Earlier Completed Work
- Redeem Limit Status Filter Fix (15+ files)
- Subscription Activation Desync Bug Fix
- Bulletproof Active/Inactive Detection + Wrongful Burning Fix
- All production fixes from 29 Mar - 3 Apr

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P2: server.py refactoring (45k+ lines monolith)
- P2: 218 React hook dependency warnings
- P2: Split large frontend components
- P3: MongoDB → PostgreSQL migration
