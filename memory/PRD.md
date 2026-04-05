# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 5 April 2026

## COMPLETED: Redeem Used Details Page Fix (P0) - 5 April 2026

### Bug Report
Dashboard "USED" showed 39,047 PRC but Usage History page showed 71,288 PRC (included burns, admin debits).

### Root Cause
The usage-history endpoint was querying generic transaction collections (prc_ledger, transactions, etc.) which included ALL debits — burns, admin, etc. The dashboard's "USED" value comes from service-specific collections only.

### Fix Applied
- **Backend**: Rewrote `/api/prc-statement/usage-history/{uid}` to query 17 service-specific collections (same as `calculate_total_redeemed()`), excluding burns and admin transactions
- **Frontend**: Renamed to "Redeem Used Details", shows only: Mobile Recharge, Bank Redeem, Gift Cards, Subscription, Bill Pay, Shopping, Loan EMI categories with icons and progress bars
- **Validation**: `total_used` from usage-history now matches `total_redeemed` from redeem-limit exactly for all users

### Verification
- Backend: 12/12 tests passed (iteration 182)
- Two users verified: Primary (48,646.52 PRC match), PRC user (34,369.47 PRC match)

## COMPLETED: Code Quality Fixes - 5 April 2026
- Circular imports, undefined variables (36→0), mutable defaults, random→secrets, localStorage sanitization

## COMPLETED: PRC Usage History Page (P0) - 5 April 2026
- Backend endpoint + Frontend Recharts UI + Dashboard "Used >" clickable link

## COMPLETED: PRC Dynamic Rate Fix (P0) - 5 April 2026
- Single Source of Truth in utils/helpers.py

## COMPLETED: Deep Transaction Investigation - 5 April 2026
- 30+ prc_balance modification points traced, 11 gaps fixed

## COMPLETED: Core Formula System Audit - 4 April 2026
- 5 formulas audited and de-duplicated

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js

## Future/Backlog
- P2: Split oversized React components
- P2: server.py refactoring (45k+ lines monolith)
- P2: 218 React hook dependency warnings
- P3: MongoDB → PostgreSQL migration
