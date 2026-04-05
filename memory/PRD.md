# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 5 April 2026

## COMPLETED: PRC Usage History Page (P0) - 5 April 2026

### Feature Description
Users can click "Used >" on the Dashboard PRC balance card to view date-wise PRC usage history with narrations and a monthly usage graph from their joining date.

### Implementation
- **Backend**: `GET /api/prc-statement/usage-history/{uid}` — Aggregates debits from 4 collections (prc_ledger, transactions, prc_transactions, ledger), returns summary, monthly graph data, and daily breakdown
- **Frontend**: `PRCUsageHistory.js` — Recharts bar chart, type breakdown, expandable date-wise entries
- **Navigation**: Dashboard "Used >" link (data-testid='used-prc-link') → `/usage-history` route
- **Route protection**: Redirects to `/login` if unauthenticated

### Files Modified
- `App.js` — Added lazy import + route for `/usage-history`
- `DashboardModern.js` — Made "Used" text clickable with navigation
- `PRCUsageHistory.js` — Full page component (already created by previous agent)
- `prc_statement.py` — Backend endpoint (already created by previous agent)

### Verification
- Backend: 13/13 tests passed (iteration 180)
- Frontend: All UI components verified (login, navigation, chart, expand/collapse, route protection)

## COMPLETED: PRC Dynamic Rate Inconsistency Bug Fix (P0) - 5 April 2026

### Root Cause
5 different rate functions reading from different DB collections with different fallback chains. One had 100 default (10x wrong).

### Fix
Single Source of Truth: `utils/helpers.py` → `get_prc_rate(db)` and `get_prc_rate_sync()`
All 6 duplicate functions delegate to this single function. 12/12 tests passed.

## COMPLETED: Deep Transaction Investigation (100% Coverage) - 5 April 2026
- 30+ prc_balance modification points traced, 11 gaps fixed
- PRC Statement: 4 sources, soft-delete filter, determine_credit() bug fixed
- Admin Transaction Manager UI: CRUD + Refund + Restore

## COMPLETED: Core Formula System Audit - 4 April 2026
- 5 formulas audited: Subscription, Mining (BASE=1000), Redeem (total_mined), Network, PRC Dynamic
- All consolidated and de-duplicated

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P2: server.py refactoring (45k+ lines monolith)
- P2: 218 React hook dependency warnings
- P2: Split large frontend components
- P3: MongoDB → PostgreSQL migration
